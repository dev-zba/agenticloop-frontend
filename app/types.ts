export type Requirement = {
  id: string;
  text: string;
  evidence: string[];
  confidence: "high" | "medium" | "low";
  status: string;
  rejection_reason?: string;
};

export type RevisionEntry = {
  from_iteration?: number;
  to_iteration?: number;
  action?: string;
  conflicts?: Record<string, unknown>[];
  draft_snapshot?: Requirement[];
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
  rejected_requirements?: Requirement[];
  revision_log?: RevisionEntry[];
  explorer_findings?: Record<string, unknown>;
  evidence_report?: Record<string, unknown>;
  adversary_findings?: Record<string, unknown>[];
  conflicts?: Record<string, unknown>[];
  verification?: Record<string, unknown> | null;
  checkpoint?: Record<string, unknown> | null;
  trajectory_dir?: string | null;
  spec_iteration?: number;
  build_iteration?: number;
  applied_to_repo?: boolean;
  apply_message?: string | null;
};

export type RunStarted = {
  id: string;
  mode: "baseline" | "pipeline";
  status: string;
};
