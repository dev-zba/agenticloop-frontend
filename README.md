# Spec Detective — Frontend

Next.js dashboard for **Spec Detective**, an agentic coding system that reconstructs a repository's implicit behavioral specification before implementing changes. This UI is the investigation surface for running baseline and (future) full agent pipeline jobs.

> **Phase 1:** Run Setup + baseline results only. Live multi-agent pipeline UI comes in a later phase. See the parent [PROJECT_BRIEF.md](../PROJECT_BRIEF.md) for the full build plan.

## What this app does

- Collect a **repo path** and **change request**
- POST to the backend `/runs` endpoint to execute the single-LLM baseline
- Display **diff**, **test results**, **runtime**, and **token cost**

The UI is intentionally minimal — a focused run console, not a chat log.

## Tech stack

| Tool | Version (approx.) | Purpose |
|------|-------------------|---------|
| Next.js | 15 | App Router, API proxy |
| React | 19 | UI |
| TypeScript | 5.9 | Types |
| Tailwind CSS | 4 | Styling |
| lucide-react | — | Icons |

## Prerequisites

- **Node.js 20+**
- **Backend running** at `http://127.0.0.1:8000` (see [backend README](../backend/README.md))

## Setup

```bash
cd frontend
npm install
```

## Run locally

Start the backend first (port 8000), then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### API proxy

`next.config.ts` rewrites `/api/*` → `http://127.0.0.1:8000/*`, so the frontend calls `/api/runs` without CORS issues during local dev.

To point at a different backend:

```bash
NEXT_PUBLIC_API_URL=http://your-host:8000 npm run dev
```

## Usage

1. Enter an **absolute path** to an evaluation repo (e.g. `../eval/cases/01_farewell/repo`).
2. Describe the **change request**.
3. Click **Run baseline**.
4. Review the diff, test pass/fail counts, runtime, and cost.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Serve production build |

## Project structure

```
frontend/
├── app/
│   ├── layout.tsx      # Root layout + metadata
│   ├── page.tsx        # Run setup form + results view
│   └── globals.css     # Theme tokens + Tailwind
├── next.config.ts      # API rewrite to backend
├── package.json
└── tsconfig.json
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `/api` | Backend base URL. Defaults to the Next.js rewrite proxy. |

No secrets belong in the frontend — API keys live in the backend `.env`.

## Related

- [Backend README](../backend/README.md) — FastAPI server, baseline runner, sandboxed repo tools
- [PROJECT_BRIEF.md](../PROJECT_BRIEF.md) — Full Spec Detective architecture and submission requirements
