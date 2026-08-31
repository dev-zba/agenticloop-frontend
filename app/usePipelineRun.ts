"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PipelineEvent, Requirement, RunResponse, RunStarted } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export function usePipelineRun() {
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkpointOpen, setCheckpointOpen] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const closeStream = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
  }, []);

  useEffect(() => () => closeStream(), [closeStream]);

  async function fetchResults(id: string) {
    const resultsRes = await fetch(`${API}/runs/${id}/results`);
    if (!resultsRes.ok) throw new Error(await resultsRes.text());
    const data = (await resultsRes.json()) as RunResponse;
    setResult({ ...data, id, mode: "pipeline" });
    // Only open modal once the run is actually blocked (ready for POST /checkpoint)
    if (data.status === "blocked") setCheckpointOpen(true);
    else setCheckpointOpen(false);
    return data;
  }

  async function pollUntilSettled(id: string, timeoutMs = 600_000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const data = await fetchResults(id);
      if (data.status && data.status !== "running") return data;
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("Timed out waiting for pipeline to finish");
  }

  async function startPipeline(repoPath: string, request: string, applyOnSuccess = true) {
    setLoading(true);
    setError(null);
    setEvents([]);
    setResult(null);
    setActiveAgent(null);
    setCheckpointOpen(false);
    closeStream();

    try {
      const res = await fetch(`${API}/runs?mode=pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo_path: repoPath,
          request,
          apply_on_success: applyOnSuccess,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const started = (await res.json()) as RunStarted;
      setRunId(started.id);

      await new Promise<void>((resolve, reject) => {
        const es = new EventSource(`${API}/runs/${started.id}/events`);
        esRef.current = es;
        let settled = false;

        const finish = () => {
          if (settled) return;
          settled = true;
          es.close();
          resolve();
        };

        const fail = (message: string) => {
          if (settled) return;
          settled = true;
          es.close();
          reject(new Error(message));
        };

        const handle = (type: string) => (ev: MessageEvent) => {
          try {
            const payload = JSON.parse(ev.data) as PipelineEvent;
            setEvents((prev) => [...prev, payload]);
            if (type === "agent_started") {
              const label = payload.data?.label;
              const agent = String(payload.data?.agent ?? "");
              const iteration = payload.data?.spec_iteration;
              if (typeof label === "string" && label) {
                setActiveAgent(label);
              } else if (agent === "spec_detective" && iteration && Number(iteration) > 1) {
                setActiveAgent(`↻ Spec Detective (iteration ${iteration})`);
              } else {
                setActiveAgent(agent);
              }
            }
            if (type === "conflict_found" && payload.data?.action === "loop_back") {
              setActiveAgent(String(payload.data?.label || "↻ Spec Detective (revision)"));
            }
            // Do NOT open modal on checkpoint_needed alone — wait for blocked results
            // so POST /checkpoint does not race with status still "running".
            if (type === "checkpoint_needed") {
              setActiveAgent("blocked — awaiting human checkpoint");
            }
            if (type === "run_completed") {
              finish();
            }
          } catch {
            /* ignore malformed */
          }
        };

        for (const t of [
          "agent_started",
          "tool_call",
          "tool_result",
          "spec_updated",
          "conflict_found",
          "verification_result",
          "checkpoint_needed",
          "checkpoint_response",
          "applied_to_repo",
          "run_completed",
        ]) {
          es.addEventListener(t, handle(t));
        }
        es.onerror = () => {
          if (settled) return;
          // Stream often closes after blocked/success; recover via results instead of failing.
          void (async () => {
            try {
              const data = await fetchResults(started.id);
              if (data.status && data.status !== "running") {
                finish();
                return;
              }
              await pollUntilSettled(started.id, 45_000);
              finish();
            } catch {
              fail(
                "SSE connection lost — is the backend running? (cd backend && uvicorn app.main:app --reload --port 8000)",
              );
            }
          })();
        };
      });

      await fetchResults(started.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      closeStream();
    }
  }

  async function respondCheckpoint(action: "clarify" | "accept_assumption" | "stop", note: string) {
    if (!runId) {
      setError("No run id — re-run the pipeline first");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Ensure server is ready (blocked) before posting
      const current = await fetchResults(runId);
      if (current.status !== "blocked") {
        setError(
          `Checkpoint not ready yet (status=${current.status}). Wait until the run finishes as BLOCKED, then click again.`,
        );
        if (current.status === "blocked") setCheckpointOpen(true);
        return;
      }

      setCheckpointOpen(false);
      const res = await fetch(`${API}/runs/${runId}/checkpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note || "" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const body = await res.json();

      if (body.status === "stopped") {
        await fetchResults(runId);
        return;
      }

      // Poll — don't reopen SSE (it would replay old run_completed events)
      setActiveAgent("resuming after checkpoint…");
      await pollUntilSettled(runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCheckpointOpen(true);
    } finally {
      setLoading(false);
      closeStream();
    }
  }

  return {
    events,
    activeAgent,
    result,
    loading,
    error,
    checkpointOpen,
    setCheckpointOpen,
    startPipeline,
    respondCheckpoint,
  };
}

export type { Requirement };
