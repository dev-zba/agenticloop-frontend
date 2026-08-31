"use client";

import { useMemo, useState } from "react";
import { Loader2, Play, ShieldAlert } from "lucide-react";

type RunResponse = {
  id: string;
  diff: string;
  tests_passed: number;
  tests_failed: number;
  runtime_seconds: number;
  token_cost: number;
  test_output?: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  files_in_context?: string[];
  error?: string | null;
  status?: string;
};

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function HomePage() {
  const [repoPath, setRepoPath] = useState("");
  const [request, setRequest] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResponse | null>(null);

  async function onRun(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_path: repoPath, request }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as RunResponse;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <header className="mb-10 border-b border-[var(--line)] pb-6">
        <p className="mono text-xs tracking-[0.25em] text-[var(--gold)] uppercase">
          Spec Detective · Phase 1
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Run Setup</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          Single LLM call, heuristic repo context, sandboxed worktree. No agents.
        </p>
      </header>

      <form onSubmit={onRun} className="space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] p-6">
        <label className="block">
          <span className="mono text-xs tracking-widest text-[var(--muted)] uppercase">Repo path</span>
          <input
            required
            value={repoPath}
            onChange={(e) => setRepoPath(e.target.value)}
            placeholder="/absolute/path/to/eval/cases/01_farewell/repo"
            className="mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--gold)]"
          />
        </label>
        <label className="block">
          <span className="mono text-xs tracking-widest text-[var(--muted)] uppercase">Change request</span>
          <textarea
            required
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            rows={5}
            placeholder="Describe the change you want applied to this repo."
            className="mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--gold)]"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-[#1a1408] disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {loading ? "Running baseline…" : "Run baseline"}
        </button>
      </form>

      {error && (
        <div className="mt-6 flex gap-3 rounded-xl border border-[var(--fail)]/40 bg-[var(--fail)]/10 p-4 text-sm">
          <ShieldAlert className="h-5 w-5 shrink-0 text-[var(--fail)]" />
          <pre className="whitespace-pre-wrap font-mono text-[var(--fail)]">{error}</pre>
        </div>
      )}

      {result && <ResultsView result={result} />}
    </main>
  );
}

function ResultsView({ result }: { result: RunResponse }) {
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
      <p className="mono text-xs text-[var(--muted)]">
        run {result.id}
        {result.model ? ` · ${result.model}` : ""}
        {result.input_tokens != null ? ` · ${result.input_tokens} in / ${result.output_tokens ?? 0} out` : ""}
      </p>
      {result.error && (
        <p className="text-sm text-[var(--fail)]">Apply warning: {result.error}</p>
      )}
      <Panel title="Diff">
        <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-5">
          {result.diff ? <DiffBody diff={result.diff} /> : "(empty diff)"}
        </pre>
      </Panel>
      {result.test_output ? (
        <Panel title="Test output">
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-[var(--muted)]">
            {result.test_output}
          </pre>
        </Panel>
      ) : null}
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

function DiffBody({ diff }: { diff: string }) {
  return (
    <>
      {diff.split("\n").map((line, i) => {
        let cls = "text-[var(--muted)]";
        if (line.startsWith("+") && !line.startsWith("+++")) cls = "text-[var(--pass)]";
        else if (line.startsWith("-") && !line.startsWith("---")) cls = "text-[var(--fail)]";
        else if (line.startsWith("diff ") || line.startsWith("@@")) cls = "text-[var(--gold)]";
        return (
          <span key={i} className={`block ${cls}`}>
            {line || " "}
          </span>
        );
      })}
    </>
  );
}
