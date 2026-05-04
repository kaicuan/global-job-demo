'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { cancelOperation } from '@/app/actions';
import type { OperationStatePayload } from '@/app/api/operations/state/route';
import type { Operation, OperationLog } from '@/lib/db/schema';

import { LogStream } from './log-stream';

const POLL_INTERVAL_MS = 500;

type Props = {
  operation: Operation;
  initialLogs: OperationLog[];
};

/**
 * Owns the running phase end-to-end:
 *   - Polls `/api/operations/state` every 500ms for fresh logs.
 *   - When it observes a non-running status, fires a single
 *     `router.refresh()` to swap the parent over to the new view via a
 *     fresh RSC payload.
 *   - Drives the cancel button via its own `useTransition`.
 *
 * Mounts only while `operation.status === 'running'`; the parent's switch
 * handles unmount on transition.
 */
export function RunningView({ operation, initialLogs }: Props) {
  const router = useRouter();
  const [logs, setLogs] = useState(initialLogs);
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);
  const refreshed = useRef(false);

  // runId is non-null whenever status is 'running' — the parent only
  // renders this view in that case.
  const onCancel = () =>
    startTransition(() => void cancelOperation(operation.runId!));

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (cancelled || refreshed.current || inFlight.current) return;
      inFlight.current = true;
      try {
        const res = await fetch('/api/operations/state', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const payload = (await res.json()) as OperationStatePayload;
        if (cancelled) return;
        setLogs(payload.logs);
        if (payload.operation.status !== 'running') {
          refreshed.current = true;
          router.refresh();
        }
      } finally {
        inFlight.current = false;
      }
    };

    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [router]);

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
          </span>
          <span className="text-sm font-medium">Running</span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </header>
      <LogStream logs={logs} />
    </section>
  );
}
