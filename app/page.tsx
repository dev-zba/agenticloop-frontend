"use client";

import { useMemo, useState } from "react";
import { Loader2, Play, ShieldAlert, Search, FileText } from "lucide-react";
import { sanitizeErrorMessage } from "./sanitize";
import { usePipelineRun } from "./usePipelineRun";
import { FinalEvaluation } from "./FinalEvaluation";
import type { PipelineEvent, Requirement, RunResponse } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type Mode = "baseline" | "pipeline";

export default function HomePage() {
  const [repoPath, setRepoPath] = useState("");
  const [request, setRequest] = useState("");
  const [mode, setMode] = useState<Mode>("pipeline");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baselineResult, setBaselineResult] = useState<RunResponse | null>(null);
  const [view, setView] = useState<"setup" | "investigation" | "specification" | "evaluation">("setup");
  const [checkpointNote, setCheckpointNote] = useState("");
  const [applyOnSuccess, setApplyOnSuccess] = useState(true);

  const pipeline = usePipelineRun();

  async function onRun(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBaselineResult(null);

    if (mode === "pipeline") {
      setView("investigation");
      await pipeline.startPipeline(repoPath, request, applyOnSuccess);
      if (!pipeline.error) setView("specification");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/runs?mode=baseline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo_path: repoPath,
          request,
          apply_on_success: applyOnSuccess,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setBaselineResult((await res.json()) as RunResponse);
    } catch (err) {
      setError(sanitizeErrorMessage(err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || pipeline.loading;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <header className="mb-8 border-b border-[var(--line)] pb-6">
        <p className="mono text-xs tracking-[0.25em] text-[var(--gold)] uppercase">
          Spec Detective · Final
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Run Setup</h1>
        <p className="mt-2 max-w-3xl text-[var(--muted)]">
          Full pipeline: Explorer → Spec Detective → Evidence → Adversary → Builder → Verifier, with
          human checkpoint when blocked.
        </p>
        <nav className="mt-4 flex flex-wrap gap-2">
          {(["setup", "investigation", "specification", "evaluation"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setView(tab)}
              className={`mono rounded-lg px-3 py-1 text-xs uppercase tracking-widest ${
                view === tab
                  ? "bg-[var(--gold)] text-[#1a1408]"
                  : "border border-[var(--line)] text-[var(--muted)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </header>

      {pipeline.checkpointOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--gold)]/40 bg-[var(--bg-card)] p-6 shadow-xl">
            <h3 className="text-xl font-semibold text-[var(--gold)]">Human checkpoint (BLOCKED)</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {(pipeline.result?.checkpoint as { message?: string } | undefined)?.message ||
                "The spec loop could not converge. Choose how to proceed."}
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Note is optional. Wait until the run status is BLOCKED (modal stays up), then click one
              action once.
            </p>
            <textarea
              value={checkpointNote}
              onChange={(e) => setCheckpointNote(e.target.value)}
              rows={3}
              placeholder="Optional — e.g. “implement only farewell, ignore JWT”"
              className="mt-4 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 font-mono text-sm"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pipeline.loading || pipeline.result?.status !== "blocked"}
                className="rounded-lg bg-[var(--gold)] px-3 py-2 text-sm font-semibold text-[#1a1408] disabled:opacity-50"
                onClick={() => pipeline.respondCheckpoint("clarify", checkpointNote)}
              >
                Clarify &amp; retry
              </button>
              <button
                type="button"
                disabled={pipeline.loading || pipeline.result?.status !== "blocked"}
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm disabled:opacity-50"
                onClick={() => pipeline.respondCheckpoint("accept_assumption", checkpointNote)}
              >
                Accept assumption
              </button>
              <button
                type="button"
                disabled={pipeline.loading || pipeline.result?.status !== "blocked"}
                className="rounded-lg border border-[var(--fail)]/40 px-3 py-2 text-sm text-[var(--fail)] disabled:opacity-50"
                onClick={() => pipeline.respondCheckpoint("stop", checkpointNote)}
              >
                Stop
              </button>
            </div>
            {pipeline.result?.status && pipeline.result.status !== "blocked" && (
              <p className="mt-3 text-xs text-[var(--gold)]">
                Waiting for status=blocked (now: {pipeline.result.status})…
              </p>
            )}
          </div>
        </div>
      )}

      {(view === "setup" || busy) && (
        <form onSubmit={onRun} className="space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] p-6">
          <div className="flex gap-3">
            {(["pipeline", "baseline"] as const).map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm">
                <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />
                <span className="capitalize">{m}</span>
              </label>
            ))}
          </div>
          <label className="block">
            <span className="mono text-xs tracking-widest text-[var(--muted)] uppercase">Repo path</span>
            <input
              required
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              placeholder="/absolute/path/to/eval/cases/02_remember_me/repo"
              className="mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--gold)]"
            />
          </label>
          <label className="block">
            <span className="mono text-xs tracking-widest text-[var(--muted)] uppercase">Change request</span>
            <textarea
              required
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--gold)]"
            />
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-[var(--line)] px-3 py-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={applyOnSuccess}
              onChange={(e) => setApplyOnSuccess(e.target.checked)}
            />
            <span>
              <span className="font-medium text-[var(--ink)]">Apply to original repo on success</span>
              <span className="mt-1 block text-[var(--muted)]">
                Builder still works in a sandbox first. When Verifier passes, copy the diff onto the
                real repo path (your approval for this run).
              </span>
            </span>
          </label>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-[#1a1408] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {busy ? "Running…" : mode === "pipeline" ? "Run pipeline" : "Run baseline"}
          </button>
        </form>
      )}

      {(error || pipeline.error) && (
        <div className="mt-6 flex gap-3 rounded-xl border border-[var(--fail)]/40 bg-[var(--fail)]/10 p-4 text-sm">
          <ShieldAlert className="h-5 w-5 shrink-0 text-[var(--fail)]" />
          <pre className="whitespace-pre-wrap font-mono text-[var(--fail)]">
            {sanitizeErrorMessage(error || pipeline.error || "")}
          </pre>
        </div>
      )}

      {(view === "investigation" || pipeline.events.length > 0) && (
        <LiveInvestigation
          events={pipeline.events}
          activeAgent={pipeline.activeAgent}
          loading={pipeline.loading}
        />
      )}

      {view === "specification" && pipeline.result && (
        <SpecificationView result={pipeline.result} />
      )}

      {view === "evaluation" && <FinalEvaluation />}

      {baselineResult && mode === "baseline" && <BaselineResults result={baselineResult} />}
    </main>
  );
}

function LiveInvestigation({
  events,
  activeAgent,
  loading,
}: {
  events: PipelineEvent[];
  activeAgent: string | null;
  loading: boolean;
}) {
  return (
    <section className="mt-8 space-y-4">
      <div className="flex items-center gap-2">
        <Search className="h-5 w-5 text-[var(--gold)]" />
        <h2 className="text-2xl font-semibold">Live Investigation</h2>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-[var(--gold)]" />}
      </div>
      {activeAgent && (
        <p className="mono text-sm text-[var(--gold)]">
          Active agent: <span className="text-[var(--text)]">{activeAgent}</span>
        </p>
      )}
      <div className="max-h-[420px] overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--bg-card)]">
        {events.length === 0 ? (
          <p className="p-4 text-sm text-[var(--muted)]">Waiting for agent events…</p>
        ) : (
          events.map((ev, i) => <EventRow key={i} event={ev} />)
        )}
      </div>
    </section>
  );
}

function EventRow({ event }: { event: PipelineEvent }) {
  const d = event.data ?? {};
  const type = event.type;
  let detail = "";
  let highlight = false;
  if (type === "tool_call") {
    detail = `${String(d.tool)}(${JSON.stringify(d.args ?? {})})`;
  } else if (type === "tool_result") {
    detail = String(d.summary ?? "");
  } else if (type === "spec_updated") {
    const iter = d.spec_iteration ? ` · iter ${d.spec_iteration}` : "";
    const src = d.source ? ` · ${String(d.source)}` : "";
    detail = `${String(d.count ?? 0)} requirements${iter}${src}${d.revising ? " · revision" : ""}`;
  } else if (type === "agent_started") {
    detail = String(d.label || d.agent || "");
    if (d.revising || (typeof d.spec_iteration === "number" && Number(d.spec_iteration) > 1)) {
      highlight = true;
    }
  } else if (type === "conflict_found") {
    highlight = true;
    if (d.action === "loop_back") {
      detail = String(d.label || `loop → iteration ${d.next_iteration}`);
    } else {
      detail = `${String(d.requirement_id || "")}: ${String(d.summary || d.detail || "")}`;
    }
  } else {
    detail = JSON.stringify(d);
  }

  return (
    <div
      className={`border-b border-[var(--line)] px-4 py-2 font-mono text-xs last:border-0 ${
        highlight ? "bg-[var(--gold)]/10" : ""
      }`}
    >
      <span className="text-[var(--gold)]">{type}</span>
      <span className={`ml-2 ${highlight ? "text-[var(--text)]" : "text-[var(--muted)]"}`}>{detail}</span>
    </div>
  );
}

function SpecificationView({ result }: { result: RunResponse }) {
  const accepted = (result.specification ?? []) as Requirement[];
  const rejected = (result.rejected_requirements ?? []) as Requirement[];
  const revisions = result.revision_log ?? [];
  const cost = useMemo(
    () =>
      (result.token_cost ?? 0) < 0.0001
        ? `$${(result.token_cost ?? 0).toFixed(6)}`
        : `$${(result.token_cost ?? 0).toFixed(4)}`,
    [result.token_cost],
  );
  const hasBuild =
    Boolean(result.diff) ||
    (result.tests_passed ?? 0) > 0 ||
    (result.tests_failed ?? 0) > 0 ||
    result.status === "implementation_failed" ||
    result.status === "success";

  return (
    <section className="mt-10 space-y-6">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-[var(--gold)]" />
        <h2 className="text-2xl font-semibold">Specification decision</h2>
      </div>
      <p className="max-w-3xl text-sm text-[var(--muted)]">
        What Builder was allowed to implement, what was rejected, and what Adversary sent back for
        another Spec Detective pass.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric label="Accepted" value={String(accepted.length)} tone="pass" />
        <Metric label="Rejected" value={String(rejected.length)} tone={rejected.length ? "fail" : "muted"} />
        <Metric label="Revisions" value={String(revisions.length)} />
        <Metric label="Runtime" value={`${(result.runtime_seconds ?? 0).toFixed(2)}s`} />
        <Metric label="Token cost" value={cost} />
      </div>
      {result.status === "spec_conflict" && (
        <p className="rounded-xl border border-[var(--fail)]/40 bg-[var(--fail)]/10 p-3 text-sm text-[var(--fail)]">
          Spec conflict after {result.spec_iteration} iteration(s) — Builder did not run.
        </p>
      )}

      {revisions.length > 0 && (
        <Panel title="↻ Sent back to Spec Detective">
          <div className="space-y-4">
            {revisions.map((rev, i) => (
              <div key={i} className="rounded-lg border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-3">
                <p className="mono text-xs text-[var(--gold)]">
                  Iteration {rev.from_iteration} → {rev.to_iteration} · {rev.action || "loop_back"}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Adversary found conflict(s); draft was revised before Builder.
                </p>
                <ul className="mt-2 space-y-2">
                  {(rev.conflicts || []).map((c, j) => (
                    <li key={j} className="text-sm">
                      <span className="mono text-xs text-[var(--fail)]">
                        {String(c.requirement_id || "SPEC")}
                      </span>{" "}
                      <span className="text-[var(--text)]">{String(c.summary || c.detail || "")}</span>
                      {Array.isArray(c.evidence) && c.evidence.length > 0 && (
                        <p className="mono mt-0.5 text-[10px] text-[var(--muted)]">
                          {(c.evidence as string[]).join(" · ")}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                {(rev.draft_snapshot?.length ?? 0) > 0 && (
                  <details className="mt-2">
                    <summary className="mono cursor-pointer text-[10px] uppercase tracking-widest text-[var(--muted)]">
                      Draft at conflict ({rev.draft_snapshot!.length})
                    </summary>
                    <ul className="mt-2 space-y-1 pl-2">
                      {rev.draft_snapshot!.map((r) => (
                        <li key={r.id} className="text-xs text-[var(--muted)]">
                          <span className="text-[var(--gold)]">{r.id}</span> [{r.status}] {r.text}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--pass)]">Accepted → Builder</h3>
        {accepted.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nothing accepted for implementation.</p>
        ) : (
          accepted.map((req) => <RequirementCard key={req.id} req={req} />)
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--fail)]">Rejected — not built</h3>
        {rejected.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No requirements rejected on the final pass.</p>
        ) : (
          rejected.map((req) => <RequirementCard key={req.id} req={req} showRejection />)
        )}
      </div>

      {hasBuild && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Builder output</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric
              label="Tests passed"
              value={String(result.tests_passed ?? 0)}
              tone={(result.tests_failed ?? 0) === 0 && (result.tests_passed ?? 0) > 0 ? "pass" : "muted"}
            />
            <Metric
              label="Tests failed"
              value={String(result.tests_failed ?? 0)}
              tone={(result.tests_failed ?? 0) > 0 ? "fail" : "muted"}
            />
            <Metric label="Build iters" value={String(result.build_iteration ?? "—")} />
            <Metric label="Status" value={result.status || "—"} />
          </div>
          <Panel
            title={
              result.applied_to_repo
                ? "Diff (applied to original repo)"
                : "Diff (sandbox — not applied to original repo)"
            }
          >
            {result.apply_message && (
              <p
                className={`mb-3 text-sm ${
                  result.applied_to_repo ? "text-[var(--pass)]" : "text-[var(--fail)]"
                }`}
              >
                {result.apply_message}
              </p>
            )}
            <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-5">
              {result.diff || "(empty diff)"}
            </pre>
          </Panel>
          {result.test_output && (
            <Panel title="Test output">
              <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-5 text-[var(--muted)]">
                {result.test_output}
              </pre>
            </Panel>
          )}
        </div>
      )}
      {result.explorer_findings && (
        <Panel title="Explorer open questions">
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
            {((result.explorer_findings.open_questions as string[]) || []).map((q, i) => (
              <li key={i}>{q}</li>
            ))}
            {!((result.explorer_findings.open_questions as string[]) || []).length && (
              <li className="list-none pl-0">None recorded.</li>
            )}
          </ul>
        </Panel>
      )}
    </section>
  );
}

function RequirementCard({
  req,
  showRejection = false,
}: {
  req: Requirement;
  showRejection?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-card)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mono text-xs text-[var(--gold)]">{req.id}</p>
          <p className="mt-1 text-sm leading-relaxed">{req.text}</p>
          {showRejection && req.rejection_reason && (
            <p className="mt-2 text-xs text-[var(--fail)]">{req.rejection_reason}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusBadge status={req.status} />
          <ConfidenceBadge level={req.confidence} />
        </div>
      </div>
      <div className="mt-3">
        <p className="mono text-[10px] uppercase tracking-widest text-[var(--muted)]">Evidence</p>
        <ul className="mt-1 space-y-1">
          {(req.evidence || []).map((ev, i) => (
            <li key={i} className="font-mono text-xs text-[var(--pass)]">
              {ev}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = (status || "proposed").toLowerCase();
  const map: Record<string, { label: string; cls: string }> = {
    accepted: { label: "✓ accepted", cls: "border-[var(--pass)]/40 text-[var(--pass)]" },
    supported: { label: "✓ supported", cls: "border-[var(--pass)]/40 text-[var(--pass)]" },
    contradicted: { label: "✗ contradicted", cls: "border-[var(--fail)]/40 text-[var(--fail)]" },
    insufficient_evidence: {
      label: "⚠ insufficient evidence",
      cls: "border-[var(--gold)]/40 text-[var(--gold)]",
    },
    proposed: { label: "proposed", cls: "border-[var(--line)] text-[var(--muted)]" },
  };
  const item = map[normalized] || map.proposed;
  return (
    <span className={`mono rounded border px-2 py-0.5 text-[10px] uppercase tracking-widest ${item.cls}`}>
      {item.label}
    </span>
  );
}

function ConfidenceBadge({ level }: { level: string }) {
  const colors =
    level === "high"
      ? "border-[var(--pass)]/40 text-[var(--pass)]"
      : level === "low"
        ? "border-[var(--fail)]/40 text-[var(--fail)]"
        : "border-[var(--gold)]/40 text-[var(--gold)]";
  return (
    <span className={`mono shrink-0 rounded border px-2 py-0.5 text-[10px] uppercase tracking-widest ${colors}`}>
      {level}
    </span>
  );
}

function BaselineResults({ result }: { result: RunResponse }) {
  const total = result.tests_passed + result.tests_failed;
  const cost = useMemo(
    () =>
      result.token_cost < 0.0001
        ? `$${result.token_cost.toFixed(6)}`
        : `$${result.token_cost.toFixed(4)}`,
    [result.token_cost],
  );

  return (
    <section className="mt-10 space-y-6">
      <h2 className="text-2xl font-semibold">Baseline result</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Tests passed" value={String(result.tests_passed)} tone={result.tests_failed === 0 && total > 0 ? "pass" : "muted"} />
        <Metric label="Tests failed" value={String(result.tests_failed)} tone={result.tests_failed > 0 ? "fail" : "muted"} />
        <Metric label="Runtime" value={`${result.runtime_seconds.toFixed(2)}s`} />
        <Metric label="Token cost" value={cost} />
      </div>
      {result.error && (
        <p className="text-sm text-[var(--fail)]">Apply warning: {sanitizeErrorMessage(result.error)}</p>
      )}
      <Panel title="Diff">
        <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-5">
          {result.diff || "(empty diff)"}
        </pre>
      </Panel>
    </section>
  );
}

function Metric({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "pass" | "fail" | "muted";
}) {
  const color =
    tone === "pass" ? "text-[var(--pass)]" : tone === "fail" ? "text-[var(--fail)]" : "text-[var(--text)]";
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] p-4">
      <div className="mono text-[10px] tracking-widest text-[var(--muted)] uppercase">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg-card)]">
      <div className="border-b border-[var(--line)] px-4 py-2 mono text-xs tracking-widest text-[var(--muted)] uppercase">
        {title}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
