'use client';

import { useEffect, useState, useTransition } from 'react';

import { resetOperation } from '@/app/actions';
import type { Operation } from '@/lib/db/schema';

type Props = {
  operation: Operation;
};

type ResultPayload = {
  totalScore: number;
  failedModules: string[];
  modules: Record<string, unknown>;
};

type FetchState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; data: ResultPayload; bytes: number };

export function CompletedView({ operation }: Props) {
  const { resultUrl, startedAt, completedAt, runId } = operation;
  const [fetched, setFetched] = useState<FetchState>({ kind: 'loading' });
  const [pending, startTransition] = useTransition();
  // runId is non-null whenever status is 'completed' — the parent only
  // renders this view in that case. Asserted to keep the action signature
  // honest about requiring a runId.
  const onReset = () =>
    startTransition(() => void resetOperation(runId!));

  useEffect(() => {
    if (!resultUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(resultUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (cancelled) return;
        setFetched({
          kind: 'ok',
          data: JSON.parse(text) as ResultPayload,
          bytes: new Blob([text]).size,
        });
      } catch (err) {
        if (cancelled) return;
        setFetched({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resultUrl]);

  const elapsed = formatElapsed(startedAt, completedAt);

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-green-600 dark:text-green-500">✓</span>
          <span className="text-sm font-medium">Completed</span>
          {elapsed && (
            <span className="text-xs text-zinc-500">in {elapsed}</span>
          )}
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={pending}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          {pending ? 'Resetting…' : 'Reset'}
        </button>
      </header>

      {fetched.kind === 'loading' && (
        <p className="text-sm text-zinc-500">Loading result…</p>
      )}
      {fetched.kind === 'error' && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Failed to load result: {fetched.message}
        </p>
      )}
      {fetched.kind === 'ok' && (
        <ResultView data={fetched.data} bytes={fetched.bytes} />
      )}
    </section>
  );
}

function ResultView({
  data,
  bytes,
}: {
  data: ResultPayload;
  bytes: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-semibold tabular-nums">
          {data.totalScore.toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })}
        </span>
        <span className="text-xs text-zinc-500">total score</span>
      </div>

      {data.failedModules.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {data.failedModules.length} module(s) failed:{' '}
          {data.failedModules.join(', ')}
        </p>
      )}

      <details className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
        <summary className="cursor-pointer select-none font-medium text-zinc-700 dark:text-zinc-300">
          Module outputs ({formatBytes(bytes)})
        </summary>
        <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          {JSON.stringify(data.modules, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function formatElapsed(
  startedAt: Date | string | null,
  completedAt: Date | string | null,
): string | null {
  if (!startedAt || !completedAt) return null;
  const ms =
    new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
