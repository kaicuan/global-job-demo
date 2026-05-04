'use client';

import { useTransition } from 'react';

import { startOperation } from '@/app/actions';

export function IdleView() {
  const [pending, startTransition] = useTransition();
  const onStart = () => startTransition(() => void startOperation());

  return (
    <section className="flex flex-col items-start gap-3 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        No operation in progress. Click below to start a new run.
      </p>
      <button
        type="button"
        onClick={onStart}
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? 'Starting…' : 'Start operation'}
      </button>
    </section>
  );
}
