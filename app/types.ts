export type Requirement = {
  id: string;
  text: string;
  evidence: string[];
  confidence: "high" | "medium" | "low";
  status: string;
};

export type PipelineEvent = {
  type: string;
  data: Record<string, unknown>;
  ts?: string;
};

export type RunResponse = {
  id: string;
  mode?: string;
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
  specification?: Requirement[];
  explorer_findings?: Record<string, unknown>;
  evidence_report?: Record<string, unknown>;
  adversary_findings?: Record<string, unknown>[];
  conflicts?: Record<string, unknown>[];
  spec_iteration?: number;
  build_iteration?: number;
};

export type RunStarted = {
  id: string;
  mode: "baseline" | "pipeline";
  status: string;
};
