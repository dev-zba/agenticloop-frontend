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
  const esRef = useRef<EventSource | null>(null);

  const closeStream = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
  }, []);

  useEffect(() => () => closeStream(), [closeStream]);

  async function startPipeline(repoPath: string, request: string) {
    setLoading(true);
    setError(null);
    setEvents([]);
    setResult(null);
    setActiveAgent(null);
    closeStream();

    try {
      const res = await fetch(`${API}/runs?mode=pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_path: repoPath, request }),
      });
      if (!res.ok) throw new Error(await res.text());
      const started = (await res.json()) as RunStarted;

      await new Promise<void>((resolve, reject) => {
        const es = new EventSource(`${API}/runs/${started.id}/events`);
        esRef.current = es;

        const handle = (type: string) => (ev: MessageEvent) => {
          try {
            const payload = JSON.parse(ev.data) as PipelineEvent;
            setEvents((prev) => [...prev, payload]);
            if (type === "agent_started") {
              setActiveAgent(String(payload.data?.agent ?? ""));
            }
            if (type === "run_completed") {
              es.close();
              resolve();
            }
          } catch {
            /* ignore malformed */
          }
        };

        es.addEventListener("agent_started", handle("agent_started"));
        es.addEventListener("tool_call", handle("tool_call"));
        es.addEventListener("tool_result", handle("tool_result"));
        es.addEventListener("spec_updated", handle("spec_updated"));
        es.addEventListener("run_completed", handle("run_completed"));
        es.onerror = () => {
          es.close();
          reject(new Error("SSE connection lost"));
        };
      });

      const resultsRes = await fetch(`${API}/runs/${started.id}/results`);
      if (!resultsRes.ok) throw new Error(await resultsRes.text());
      const data = (await resultsRes.json()) as RunResponse;
      setResult({ ...data, id: started.id, mode: "pipeline" });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      closeStream();
    }
  }

  return { events, activeAgent, result, loading, error, startPipeline };
}

export type { Requirement };
