# Aggregated calculation demo

A Next.js demo of a single, **globally-shared** background operation that
processes four modules in parallel and aggregates their outputs. The
operation state is the single source of truth — any user can start, cancel,
or reset it, and every browser converges on the same view via polling.

## What it does

1. User clicks **Start operation** → server action atomically claims the
   global slot and schedules the worker via `next/server`'s `after()`.
2. The worker runs four modules in parallel: `skills`, `abilities`, `gear`,
   `units`. Each module runs its steps sequentially, threading prior results
   only where actually needed.
3. Each step emits a live log entry (`running` → `completed`/`fail`).
4. On completion, the aggregated payload is written to **Vercel Blob** (or
   the local filesystem in dev) and the operation transitions to
   `completed`.
5. The UI polls `/api/operations/state` while running and tears down
   polling on terminal states.

## Architecture

```
src/
├── app/
│   ├── page.tsx                          server-rendered shell, reads DB state
│   ├── actions.ts                        start / cancel / reset server actions
│   └── api/operations/
│       ├── state/route.ts                polling endpoint (single roundtrip)
│       └── result/[id]/route.ts          local-FS result fallback
├── components/
│   ├── operation-panel.tsx               client root — owns polling + state
│   ├── idle-view.tsx
│   ├── running-view.tsx
│   ├── completed-view.tsx
│   └── log-stream.tsx
└── lib/
    ├── db/schema.ts                      Drizzle schema (singleton row + logs)
    └── operations/
        ├── state.ts                      atomic state-machine transitions
        ├── runner.ts                     parallel orchestrator + cancel watcher
        ├── storage.ts                    Vercel Blob ↔ FS fallback
        └── modules/
            ├── types.ts                  Module / StepFn / CancelledError
            ├── skills.ts
            ├── abilities.ts
            ├── gear.ts
            ├── units.ts
            └── index.ts
```

### Key design decisions

- **Single source of truth = Postgres.** The `operations` table holds one
  singleton row enforced by a CHECK constraint. State transitions
  (`idle → running → completed → idle`) are atomic UPDATEs whose `WHERE`
  clauses include the expected source state, so concurrent starts/cancels
  can't race past each other.
- **Background work = `after()`.** The start action returns immediately;
  the worker runs after the response, extending the invocation lifetime via
  Vercel's `waitUntil`. No internal HTTP round-trip, no queue.
- **Live logs = client-side polling.** The client polls
  `/api/operations/state` every 500 ms while running, tears down on
  terminal states. Simple and infrastructure-free vs. SSE / Postgres
  LISTEN/NOTIFY (which would be the upgrade path if scale demanded it).
- **Module shape = injected `step` helper, not a step array.** Each module
  is a single `async run({ step, signal })` function. The runner injects
  `step(message, fn)` — a higher-order wrapper that handles logging,
  cancellation checks, and error capture. Step results become local
  variables, so a step that depends on two prior steps just references
  them; a step that needs nothing references nothing. No forced linear
  threading.
- **Cancellation = flag + watcher + `AbortSignal`.** Cancel sets a flag in
  the DB; a poller in the worker observes it and aborts an
  `AbortController` shared by every in-flight step. The runner uses
  `Promise.allSettled` so cancelled siblings don't surface as unhandled
  rejections.
- **Large results = blob storage.** Results aren't stored in Postgres
  (avoids 100 MB row pressure). They're written to Vercel Blob in
  production; a temp-FS fallback exists for dev so the demo runs without a
  blob token. The operation row only stores the resulting URL.

## Running locally

```bash
npm install

# Run migrations against your Postgres
# (see drizzle.config.ts; uses DATABASE_URL from .env.local)
npx drizzle-kit push

npm run dev
```

Required env vars (`.env.local`):

| Name                     | When                          |
| ------------------------ | ----------------------------- |
| `DATABASE_URL`           | always (Postgres connection)  |
| `BLOB_READ_WRITE_TOKEN`  | optional — falls back to temp filesystem in dev |

## Deploying to Vercel

1. Connect the repo. Vercel detects Next.js automatically.
2. Add `DATABASE_URL` (Vercel Postgres / Neon / Supabase, etc.).
3. Add a Vercel Blob store and bind `BLOB_READ_WRITE_TOKEN`.
4. Run migrations (`drizzle-kit push`) against the production DB.

The worker runs inside the start action's `after()` callback — bound by the
route's `maxDuration`. With Hobby plans (60 s) the demo's mocked work
finishes comfortably; for longer real-world workloads, set
`export const maxDuration = 300` on the relevant route segment.

## Trade-offs flagged for future work

- **Polling vs. push.** Polling is fine at one-tab-per-user-on-a-demo
  scale. For many simultaneous viewers, switching the state endpoint to
  SSE (with the server side still polling Postgres) would cut request
  volume without changing the data model.
- **Stale-worker recovery.** If the worker process dies mid-run (e.g.,
  Vercel function timeout), the row stays at `running` indefinitely. A
  background sweeper that resets rows whose `startedAt` is older than N
  minutes would close that gap.
- **100 MB result rendering.** The current UI fetches and `JSON.parse`s
  the full result. For genuinely 100 MB payloads the UI should display the
  small top-level summary fields immediately and lazy-load module bodies
  on demand (or stream-parse). For this demo the payload is well under a
  KB.
