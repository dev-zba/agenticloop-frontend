"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type Summary = {
  case_count: number;
  baseline: {
    correct_implementation_rate: number;
    correct_count: number;
    regression_count: number;
    total_token_cost_usd: number;
    total_runtime_seconds: number;
  };
  pipeline: {
    correct_implementation_rate: number;
    correct_count: number;
    regression_count: number;
    total_token_cost_usd: number;
    total_runtime_seconds: number;
    blocked_cases?: string[];
  };
  cases?: Array<{
    id: string;
    baseline: { correct: boolean; tests_passed: number; tests_failed: number; token_cost: number };
    pipeline: { correct: boolean; status: string; tests_passed: number; tests_failed: number; token_cost: number };
  }>;
};

export function FinalEvaluation() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/eval/results/latest`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) {
    return (
      <section className="mt-10 space-y-3">
        <h2 className="text-2xl font-semibold">Final Evaluation</h2>
        <p className="text-sm text-[var(--muted)]">
          No harness output yet. Run:{" "}
          <code className="mono text-[var(--gold)]">python eval/harness.py</code>
        </p>
        <pre className="text-xs text-[var(--fail)]">{error}</pre>
      </section>
    );
  }
  if (!data) {
    return <p className="mt-10 text-sm text-[var(--muted)]">Loading harness summary…</p>;
  }

  const chart = [
    {
      metric: "Correct rate",
      baseline: Math.round(data.baseline.correct_implementation_rate * 100),
      pipeline: Math.round(data.pipeline.correct_implementation_rate * 100),
    },
    {
      metric: "Regressions",
      baseline: data.baseline.regression_count,
      pipeline: data.pipeline.regression_count,
    },
  ];

  return (
    <section className="mt-10 space-y-6">
      <h2 className="text-2xl font-semibold">Final Evaluation</h2>
      <p className="text-sm text-[var(--muted)]">
        Baseline vs pipeline across {data.case_count} eval cases (from{" "}
        <code className="mono">eval/results/harness_summary.json</code>).
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Baseline correct rate"
          value={`${(data.baseline.correct_implementation_rate * 100).toFixed(0)}%`}
        />
        <Stat
          label="Pipeline correct rate"
          value={`${(data.pipeline.correct_implementation_rate * 100).toFixed(0)}%`}
          good
        />
        <Stat label="Baseline cost" value={`$${data.baseline.total_token_cost_usd.toFixed(4)}`} />
        <Stat label="Pipeline cost" value={`$${data.pipeline.total_token_cost_usd.toFixed(4)}`} />
      </div>
      <div className="h-72 rounded-xl border border-[var(--line)] bg-[var(--bg-card)] p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="metric" stroke="#aaa" />
            <YAxis stroke="#aaa" />
            <Tooltip />
            <Legend />
            <Bar dataKey="baseline" fill="#888" name="Baseline" />
            <Bar dataKey="pipeline" fill="#c9a227" name="Pipeline" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--bg-elevated)] mono text-xs uppercase tracking-widest text-[var(--muted)]">
            <tr>
              <th className="p-3">Case</th>
              <th className="p-3">Baseline</th>
              <th className="p-3">Pipeline</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(data.cases || []).map((c) => (
              <tr key={c.id} className="border-b border-[var(--line)]">
                <td className="p-3 font-mono text-xs">{c.id}</td>
                <td className="p-3">{c.baseline.correct ? "✓" : "✗"} {c.baseline.tests_passed}p/{c.baseline.tests_failed}f</td>
                <td className="p-3">{c.pipeline.correct ? "✓" : "✗"} {c.pipeline.tests_passed}p/{c.pipeline.tests_failed}f</td>
                <td className="p-3 mono text-xs">{c.pipeline.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(data.pipeline.blocked_cases?.length ?? 0) > 0 && (
        <p className="text-sm text-[var(--gold)]">
          BLOCKED checkpoint cases: {data.pipeline.blocked_cases!.join(", ")}
        </p>
      )}
    </section>
  );
}

function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] p-4">
      <div className="mono text-[10px] tracking-widest text-[var(--muted)] uppercase">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${good ? "text-[var(--pass)]" : ""}`}>{value}</div>
    </div>
  );
}
