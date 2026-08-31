"use client";

import { useMemo, useState } from "react";
import { Loader2, Play, ShieldAlert, Search, FileText } from "lucide-react";
import { sanitizeErrorMessage } from "./sanitize";
import { usePipelineRun } from "./usePipelineRun";
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
  const [view, setView] = useState<"setup" | "investigation" | "specification">("setup");

  const pipeline = usePipelineRun();

  async function onRun(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBaselineResult(null);

    if (mode === "pipeline") {
      setView("investigation");
      await pipeline.startPipeline(repoPath, request);
      if (!pipeline.error) setView("specification");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/runs?mode=baseline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_path: repoPath, request }),
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
          Spec Detective · Iteration 1
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Run Setup</h1>
        <p className="mt-2 max-w-3xl text-[var(--muted)]">
          Baseline: single LLM + sandbox. Pipeline: Explorer → Spec Detective with live investigation stream.
        </p>
        <nav className="mt-4 flex gap-2">
          {(["setup", "investigation", "specification"] as const).map((tab) => (
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
  if (type === "tool_call") {
    detail = `${String(d.tool)}(${JSON.stringify(d.args ?? {})})`;
  } else if (type === "tool_result") {
    detail = String(d.summary ?? "");
  } else if (type === "spec_updated") {
    detail = `${String(d.count ?? 0)} requirements drafted`;
  } else if (type === "agent_started") {
    detail = String(d.agent ?? "");
  } else {
    detail = JSON.stringify(d);
  }

  return (
    <div className="border-b border-[var(--line)] px-4 py-2 font-mono text-xs last:border-0">
      <span className="text-[var(--gold)]">{type}</span>
      <span className="ml-2 text-[var(--muted)]">{detail}</span>
    </div>
  );
}

function SpecificationView({ result }: { result: RunResponse }) {
  const specs = (result.specification ?? []) as Requirement[];
  const cost = useMemo(
    () =>
      (result.token_cost ?? 0) < 0.0001
        ? `$${(result.token_cost ?? 0).toFixed(6)}`
        : `$${(result.token_cost ?? 0).toFixed(4)}`,
    [result.token_cost],
  );

  return (
    <section className="mt-10 space-y-6">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-[var(--gold)]" />
        <h2 className="text-2xl font-semibold">Specification</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Requirements" value={String(specs.length)} />
        <Metric label="Runtime" value={`${(result.runtime_seconds ?? 0).toFixed(2)}s`} />
        <Metric label="Token cost" value={cost} />
        <Metric label="Model" value={result.model || "—"} />
      </div>
      <div className="space-y-4">
        {specs.map((req) => (
          <div key={req.id} className="rounded-xl border border-[var(--line)] bg-[var(--bg-card)] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mono text-xs text-[var(--gold)]">{req.id}</p>
                <p className="mt-1 text-sm leading-relaxed">{req.text}</p>
              </div>
              <ConfidenceBadge level={req.confidence} />
            </div>
            <div className="mt-3">
              <p className="mono text-[10px] uppercase tracking-widest text-[var(--muted)]">Evidence</p>
              <ul className="mt-1 space-y-1">
                {req.evidence.map((ev, i) => (
                  <li key={i} className="font-mono text-xs text-[var(--pass)]">
                    {ev}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
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
