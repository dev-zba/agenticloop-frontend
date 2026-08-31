# Spec Detective — Project Brief & Cursor Handoff Document

**Event:** micro1 Agentic Workflows / Frontier Engineering Challenge 2026 (Aug 28–31, 2026)
**Purpose of this file:** Put this document at the root of your repo (e.g. `PROJECT_BRIEF.md`). It is written to be read by both you and your coding agent in Cursor. It contains everything needed to (1) understand what you're building and why, (2) set up the environment, and (3) hand off build instructions to Cursor phase by phase.

---

## 1. Project Intention

### 1.1 One-liner
Spec Detective is an agentic coding system that takes a change request + an existing repository, **reconstructs the repo's implicit behavioral specification from code/tests/docs/config, adversarially stress-tests that spec, implements it, and independently verifies the result** — with a measured, evidence-backed improvement over a simple single-LLM baseline.

### 1.2 Who has this problem / what's the bottleneck
- **User:** An engineer (or team) using a coding agent to modify an existing, non-trivial codebase.
- **Bottleneck:** A plain LLM coding agent reads a request like "add passwordless login" and starts editing. It has no forcing function to first discover the *unwritten* rules already encoded in the repo (existing identity model, session format, rate limiting, mobile contract, etc.), so it silently produces a technically-plausible change that breaks something the request never mentioned.
- **Why it matters:** This is exactly the class of failure the hackathon brief calls out — "incomplete requirements, hidden dependencies, difficult edge cases, failure modes, and decisions that require technical judgment." A system that makes the *implicit spec explicit, evidenced, and challenged before code is written* directly targets that failure mode.

### 1.3 Does the agent solve it well? (your acceptance test)
Yes, if and only if you can show, on a fixed set of repo+request cases:
- The 6-agent pipeline satisfies more of the *unstated* requirements than the single-LLM baseline (primary metric: **correct implementation rate**, i.e., % of hidden/acceptance-test requirements satisfied without regressions).
- Every requirement in the final accepted spec is traceable to a concrete file/line of evidence.
- The system correctly identifies when it should stop and ask a human (`BLOCKED`) rather than guessing.

### 1.4 Can another person reproduce it?
Yes — this is a hard submission requirement. See §5 (Reproduction Guide) and the Ground Rules in §1.5. Every claimed number must trace back to a runnable command against a fixed, checked-in evaluation dataset.

### 1.5 Mapping to the 100-point rubric (keep this visible while building)

| Criterion | Points | What you need to produce |
|---|---|---|
| Problem & User Value | 15 | Clear README framing: who, bottleneck, why it matters (§1.2 above, expanded) |
| Agent Solution & Engineering | 30 | The 6-agent LangGraph pipeline, purposeful tool/permission design, the two loops (spec loop, implementation loop), human checkpoint, max-iteration guardrails |
| End to End Quality | 20 | A polished demo run that produces a real diff + passing tests, not an obvious AI draft; a UI that looks like an investigation dashboard, not a chat log |
| Measured Improvement | 15 | Baseline vs. agent numbers on ≥10 cases, tied to the Improvement Changelog |
| Reproducibility | 15 | Clean-environment setup + exact commands + expected output + versions + runtime/cost |
| Hot Take / Insights | 5 | One real failure mode you hit, and the lesson it taught you |

### 1.6 Deliverables checklist (hard requirements)
- [ ] Full repo + README (intended user, bottleneck, why it matters, what existed before vs. what you built)
- [ ] Improvement Changelog (stage → what/why → evidence → decision, including *removed* experiments)
- [ ] Reproduction guide (clean-env setup, exact commands for solution/baseline/eval, data needed, expected output, versions, runtime & cost)
- [ ] Solution video, ≤5 minutes (problem → baseline → one full realistic run → final comparison → changelog highlight → one removed experiment)
- [ ] Representative agent trajectories for **every** agent (instructions → tool calls → tool responses → what shaped the next step → retries/human checkpoints)
- [ ] Disclosure of which coding agent(s)/tools you used, per hackathon rules
- [ ] Evidence that consequential actions are sandboxed with a human-approval point (Ground Rule 04)

---

## 2. Tools & Environment Setup

### 2.1 Prerequisites

| Tool | Why | Notes |
|---|---|---|
| Python 3.11+ | Backend, agents, repo tools | Use a venv |
| Node.js 20+ | Next.js frontend | |
| Git | Repo tool layer, sandboxed diffs | Required on PATH |
| `ripgrep` (`rg`) | Fast `search_code` tool | `apt install ripgrep` / `brew install ripgrep` |
| An LLM API key | Powers every agent | **micro1 does not provide API credits — you must bring your own key.** Anthropic (Claude) or OpenAI both work; examples below use Anthropic. |
| Docker (optional but recommended) | Sandboxing the Builder's file writes and command execution away from your host | Satisfies Ground Rule 04 (sandbox + human approval before consequential actions) |

### 2.2 Backend — Python (as of Aug 2026, latest stable)

```bash
python3 -m venv .venv
source .venv/bin/activate

pip install \
  "fastapi==0.141.1" \
  "uvicorn[standard]==0.52.4" \
  "langgraph==1.2.11" \
  "langchain-anthropic==1.7.0" \
  "anthropic==1.2.0" \
  "pydantic==2.13.5" \
  "python-dotenv==1.2.3" \
  "gitpython==3.1.61" \
  "pytest==9.1.1" \
  "sse-starlette==3.4.8" \
  "httpx==0.28.1"
```

> Pin these in `requirements.txt` so reviewers get byte-identical environments — reproducibility is 15 rubric points. Re-check versions with `pip index versions <pkg>` right before you freeze, since these move fast.

### 2.3 Frontend — Next.js (as of Aug 2026, latest stable)

```bash
npx create-next-app@latest spec-detective-ui --typescript --tailwind --eslint --app
cd spec-detective-ui
npm install zustand@5.0.15 lucide-react@1.35.0 recharts@3.10.1 eventsource-parser@4.1.0
```

- `zustand` — lightweight client state for live pipeline/agent status.
- `lucide-react` — icons for the investigation-dashboard UI.
- `recharts` — baseline-vs-agent comparison charts on the Final Evaluation screen.
- `eventsource-parser` — parsing the SSE stream from FastAPI for live agent activity.
- Tailwind v4 changed its config model (CSS-first, no `tailwind.config.js` by default) — confirm which major version `create-next-app` scaffolds and adjust the "Live Investigation" screen styling accordingly.

### 2.4 Model / API access

You need **your own** key from whichever provider you pick. Do not commit it.

```bash
# .env (backend, gitignored)
ANTHROPIC_API_KEY=sk-ant-...
# or OPENAI_API_KEY=sk-...
MODEL_NAME=claude-sonnet-4-6      # pick one model for all 6 agents, or vary per-agent if you justify it in the changelog
LOG_COST=true                     # needed for your "cost per task" metric
```

Track token usage/cost per agent call from day one — you'll need "cost per task" and "runtime" numbers for the Final Evaluation screen and the reproduction guide.

### 2.5 Repository tools your system needs at runtime
These are shelled out to by the shared Repository Tools layer (§3.4), not reimplemented:
- `git` (history, diff, worktree-based sandboxing)
- `rg` (search_code)
- `pytest` / `npm test` (whichever the target repo under evaluation uses — detect from repo, don't hardcode)
- Standard filesystem calls (list/read/write)

### 2.6 Evaluation dataset — you must build this yourself
This is not provided by micro1. You need:
- **≥10 evaluation cases**, each a small repo + a change request + a rubric of expected (including *hidden*) requirements. Use public or synthetic repos only (Ground Rule 07) — never private/proprietary code.
- **At least one deliberately hard case** with a genuine hidden contradiction (like the mobile-session example in your blueprint) — the brief explicitly asks for this and explains what it revealed.
- Suggested sourcing: small, real open-source repos (MIT/Apache licensed) with a handful of realistic feature requests you write yourself, or synthetic repos you construct specifically to hide 1–2 non-obvious requirements per case.
- Each case needs a fixed rubric (a checklist of requirements, some explicit in the prompt, some only discoverable from code) so both baseline and Spec Detective can be scored identically and reproducibly.

### 2.7 Suggested repo folder structure

```
spec-detective/
├── PROJECT_BRIEF.md          # this file
├── README.md                 # submission README (see §5)
├── CHANGELOG.md               # Improvement Changelog
├── .env.example
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, SSE endpoint
│   │   ├── state.py           # WorkflowState schema (pydantic)
│   │   ├── graph.py           # LangGraph wiring: nodes, edges, loops, checkpoints
│   │   ├── agents/
│   │   │   ├── explorer.py
│   │   │   ├── spec_detective.py
│   │   │   ├── evidence.py
│   │   │   ├── adversary.py
│   │   │   ├── builder.py
│   │   │   └── verifier.py
│   │   ├── tools/
│   │   │   └── repo_tools.py  # list_files, read_file, search_code, git_history,
│   │   │                      # git_diff, inspect_dependencies, run_command,
│   │   │                      # run_tests, write_file — all sandboxed
│   │   └── baseline.py        # single-LLM baseline implementation
│   └── requirements.txt
├── frontend/                  # Next.js app (§2.3)
├── eval/
│   ├── cases/                 # ≥10 repo+request+rubric cases
│   ├── harness.py             # runs baseline + spec-detective over all cases
│   └── results/                # generated metrics, checked in for the submission
└── trajectories/               # captured agent trajectories per run, per agent
```

---

## 3. What to Give Cursor

Cursor works best with (a) a persistent project-rules file it reads automatically, and (b) an explicit phase-by-phase kickoff prompt so it doesn't jump straight to the UI. Do both.

### 3.1 Create `.cursor/rules/spec-detective.mdc` (persistent context)

```markdown
---
description: Spec Detective project rules
alwaysApply: true
---
- Read PROJECT_BRIEF.md in full before writing or modifying any code.
- Build in the phase order defined in PROJECT_BRIEF.md §3.2. Do not start the
  Next.js UI before the backend agent pipeline (Explorer → Verifier) works
  end-to-end against at least one real evaluation case.
- All Builder file writes and shell/test execution MUST run inside a sandboxed
  git worktree or temp clone — never mutate the user's working directory
  directly, and never auto-merge without an explicit human-approval step.
- Every requirement the Spec Detective agent proposes must carry evidence
  (file + line range) and a confidence label. Never let an assumption become
  a "fact" without it being marked as an assumption.
- Keep the 6 agents' tool permissions scoped exactly as in PROJECT_BRIEF.md §3.4
  — don't give every agent every tool "for convenience."
- Log token usage and wall-clock time for every agent call; this feeds the
  cost/runtime metrics required for the submission.
- Never commit API keys or .env files. Use .env.example as the template.
```

### 3.2 Build order to hand Cursor (do not skip ahead to the UI)

```
1. Repository tools layer (backend/app/tools/repo_tools.py) — sandboxed via git worktree
2. Explorer agent
3. Spec Detective agent
4. Evidence agent
5. Adversary agent
6. Specification loop (Explorer → Detective → Evidence → Adversary → accept/conflict)
7. Builder agent
8. Verifier agent
9. Implementation loop (Builder → Verifier → pass/fail → route back to Builder or Spec Detective)
10. FastAPI app + SSE streaming
11. Next.js UI (Run Setup, Live Investigation, Specification, Final Evaluation)
12. Baseline (single LLM, no pipeline)
13. Evaluation harness + ≥10 dataset cases
14. Run evaluation, capture metrics
15. Improvement Changelog + trajectory capture
16. Reproduction guide
17. 5-minute video
```

### 3.3 Shared state schema (give this to Cursor verbatim)

```python
# backend/app/state.py
from typing import TypedDict, Literal

class Requirement(TypedDict):
    id: str
    text: str
    evidence: list[str]          # e.g. ["auth/verification.py:54-91"]
    confidence: Literal["high", "medium", "low"]
    status: Literal["proposed", "supported", "contradicted", "insufficient_evidence", "accepted"]

class WorkflowState(TypedDict):
    request: str
    repo_path: str
    explorer_findings: dict
    specification: list[Requirement]
    evidence_report: dict
    adversary_findings: list[dict]
    conflicts: list[dict]
    implementation_diff: str | None
    verification: dict | None
    spec_iteration: int
    build_iteration: int
    status: Literal[
        "running", "blocked", "spec_conflict",
        "implementation_failed", "verification_failed",
        "max_iterations_reached", "success"
    ]

MAX_SPEC_ITERATIONS = 4
MAX_BUILD_ITERATIONS = 3
```

### 3.4 Agent specs to hand Cursor (tools, permissions, system prompt seeds)

| Agent | Allowed tools | System-prompt core instruction |
|---|---|---|
| **Explorer** | read_file, list_files, search_code, git_history, inspect_dependencies, run_tests | "Investigate, do not design. Report only what exists — relevant files, tests, configs, APIs, and open questions. Never propose requirements." |
| **Spec Detective** | read_file, search_code | "Turn the request + Explorer findings into a numbered specification. Every requirement needs evidence and a confidence label. Never silently promote an assumption to a fact." |
| **Evidence** | read_file, search_code, run_tests | "Independently check each proposed requirement against the repo. Label each SUPPORTED / CONTRADICTED / INSUFFICIENT_EVIDENCE. Do not accept a requirement you cannot verify." |
| **Adversary** | read_file, search_code, run_tests, git_history | "Assume the specification is wrong — try to prove it. Look for contradictory code, conflicting tests, forgotten edge cases, and unsupported assumptions. Report conflicts, don't fix them." |
| **Builder** | read_file, write_file, search_code, shell (sandboxed), run_tests, git_diff | "Implement only the accepted specification. Do not redefine product requirements. Make the smallest appropriate change and run relevant tests. All writes happen inside the sandboxed worktree." |
| **Verifier** | read_file, search_code, shell (sandboxed), run_tests, git_diff | "Independently check the implementation against the accepted specification, one requirement at a time. Classify any failure as a code problem (→ Builder) or a specification problem (→ Spec Detective)." |

### 3.5 API contract to hand Cursor

```
POST /runs                 # start a run {repo_path, request}
GET  /runs/{id}             # run metadata/status
GET  /runs/{id}/events      # SSE stream: agent_started, tool_call, tool_result,
                             # conflict_found, spec_updated, checkpoint_needed,
                             # verification_result, run_completed
GET  /runs/{id}/results      # final spec, diff, verification, metrics
POST /runs/{id}/checkpoint   # human response to a BLOCKED state:
                             # {"action": "clarify" | "accept_assumption" | "stop", "note": "..."}
```

### 3.6 Literal kickoff prompt — paste this into Cursor to start

```
Read PROJECT_BRIEF.md completely before doing anything else.

Start with Phase 1 only: build backend/app/tools/repo_tools.py implementing
list_files, read_file, search_code (ripgrep-backed), git_history, git_diff,
inspect_dependencies, run_command, run_tests, and write_file. write_file and
run_command must only ever operate inside a sandboxed git worktree created
per-run under a temp directory — never the original repo path directly.

Write a small pytest suite that exercises each tool against a throwaway
sample git repo before moving to Phase 2 (the Explorer agent). Stop and
show me the diff before you touch anything outside backend/app/tools/.
```

---

## 4. Decisions Only You Can Make (not Cursor's job)

- **Which LLM provider/model** powers the agents, and whether every agent uses the same model or you vary it (justify either choice in the changelog).
- **The 10+ evaluation cases**: source repos, the change request text, and the "hidden requirement" rubric for each — this is the actual intellectual content the judges score you on for Measured Improvement.
- **What counts as "consequential"** in your Builder's sandbox-then-approve flow, and what the human-approval UI looks like (Ground Rule 04/05).
- **Data/legal choice**: confirm every repo you use is public or synthetic, and that no credentials or private data ever enter the submission (Ground Rules 07/08).
- **Primary metric definition**: confirm "correct implementation rate" is measured how you actually want it scored (e.g., % of rubric requirements satisfied with zero regressions) before you build the harness around it.
- **Hosting for the demo** (local screen-recording is fine; you don't need to deploy this publicly).

---

## 5. Submission Mapping (final check before you record the video)

| Deliverable | Where it lives in this repo |
|---|---|
| Code + README + Changelog | repo root `README.md`, `CHANGELOG.md` |
| Reproduction guide | `README.md` "Reproduce" section — exact commands for baseline, solution, and eval, from a clean clone |
| Video (≤5 min) | Problem → baseline → one full real run → comparison → changelog highlight → one removed experiment |
| Agent trajectories | `trajectories/`, one file per agent per representative run |
| Tool disclosure | State in README which coding agent(s) you used to build this (required by hackathon rules) |

---

*This document consolidates your finalized "Spec Detective" blueprint with the official micro1 Agentic Workflows Hackathon brief and rubric. Treat §1.5 and §5 as your scoring checklist throughout the build.*