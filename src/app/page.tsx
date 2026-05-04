import { OperationPanel } from '@/components/operation-panel';
import { getLogs, getOperation } from '@/lib/operations/state';

// This route always reflects the live DB state — it must never be cached.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const [operation, logs] = await Promise.all([getOperation(), getLogs()]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Aggregated calculation
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Runs four modules — skills, abilities, gear, units — in parallel,
          aggregates their outputs, and surfaces the result. The operation
          state is global: any user can start, cancel, or reset it.
        </p>
      </header>

      <OperationPanel operation={operation} initialLogs={logs} />
    </main>
  );
}
