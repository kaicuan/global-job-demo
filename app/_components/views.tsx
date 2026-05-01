import type { JobSnapshot, LogEntry } from "@/app/_lib/job-types";

/**
 * Presentational components for the three job states. Each takes only the
 * data it needs and a single callback — they do not import server actions
 * or the store directly. Imported by JobController, so they ride along on
 * the client bundle without their own `"use client"` directive.
 */

interface Card {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

function Card({ title, subtitle, children }: Card) {
  return (
    <section className="w-full max-w-xl rounded-2xl border border-black/[.08] bg-white p-8 shadow-sm dark:border-white/[.1] dark:bg-zinc-950">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {subtitle}
          </p>
        )}
      </header>
      {children}
    </section>
  );
}

export function IdleView({
  onStart,
  pending,
}: {
  onStart: () => void;
  pending: boolean;
}) {
  return (
    <Card
      title="Calculation engine"
      subtitle="Run the global background job to fetch and compute four modules."
    >
      <button
        type="button"
        onClick={onStart}
        disabled={pending}
        className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Starting…" : "Start calculation"}
      </button>
    </Card>
  );
}

export function ProcessingView({
  snapshot,
  onCancel,
  pending,
}: {
  snapshot: Extract<JobSnapshot, { status: "processing" }>;
  onCancel: () => void;
  pending: boolean;
}) {
  return (
    <Card
      title="Calculating…"
      subtitle={`Job ${snapshot.jobId.slice(0, 8)} is running. All viewers see the same progress.`}
    >
      <LogList logs={snapshot.logs} />
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-full border border-black/[.12] bg-transparent px-5 text-sm font-medium text-foreground transition-colors hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.18] dark:hover:bg-white/[.06]"
        >
          {pending ? "Cancelling…" : "Cancel"}
        </button>
      </div>
    </Card>
  );
}

export function CompletedView({
  snapshot,
  onReset,
  pending,
}: {
  snapshot: Extract<JobSnapshot, { status: "completed" }>;
  onReset: () => void;
  pending: boolean;
}) {
  const { result } = snapshot;
  return (
    <Card
      title="Calculation complete"
      subtitle={`Finished in ${formatDuration(snapshot.endedAt - snapshot.startedAt)}.`}
    >
      <div className="rounded-xl bg-zinc-50 p-6 dark:bg-zinc-900">
        <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Total score
        </p>
        <p className="mt-1 text-4xl font-semibold tabular-nums">
          {result.total}
        </p>
        <ul className="mt-5 space-y-1 text-sm">
          {result.modules.map((m) => (
            <li
              key={m.key}
              className="flex items-baseline justify-between gap-4 text-zinc-600 dark:text-zinc-400"
            >
              <span className="capitalize">{m.label}</span>
              <span className="tabular-nums text-foreground">{m.value}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onReset}
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Resetting…" : "Reset"}
        </button>
      </div>
    </Card>
  );
}

function LogList({ logs }: { logs: LogEntry[] }) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Starting up…</p>
    );
  }
  return (
    <ol className="space-y-2 text-sm">
      {logs.map((log) => (
        <li key={log.id} className="flex items-start gap-3">
          <StatusIcon status={log.status} />
          <span className="flex-1">
            <span
              className={
                log.status === "failure"
                  ? "text-red-600 dark:text-red-400"
                  : "text-foreground"
              }
            >
              {log.message}
            </span>
            {log.error && (
              <span className="mt-0.5 block text-xs text-red-500 dark:text-red-400">
                {log.error}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

function StatusIcon({ status }: { status: LogEntry["status"] }) {
  if (status === "loading") {
    return (
      <span
        aria-label="loading"
        className="mt-0.5 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent text-zinc-400"
      />
    );
  }
  if (status === "success") {
    return (
      <span
        aria-label="success"
        className="mt-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white"
      >
        ✓
      </span>
    );
  }
  return (
    <span
      aria-label="failure"
      className="mt-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
    >
      ✗
    </span>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}
