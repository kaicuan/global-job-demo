import type { OperationLog } from '@/lib/db/schema';

type Props = {
  logs: OperationLog[];
};

export function LogStream({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <p className="font-mono text-xs text-zinc-500">Waiting for first log…</p>
    );
  }
  return (
    <ul className="flex flex-col gap-1 font-mono text-xs">
      {logs.map((log) => (
        <LogRow key={log.id} log={log} />
      ))}
    </ul>
  );
}

function LogRow({ log }: { log: OperationLog }) {
  const duration = formatDuration(log);
  return (
    <li className="flex items-center gap-2">
      <StatusGlyph status={log.status} />
      <span
        className={
          log.status === 'fail'
            ? 'text-red-600 dark:text-red-400'
            : log.status === 'completed'
              ? 'text-zinc-600 dark:text-zinc-400'
              : 'text-zinc-900 dark:text-zinc-100'
        }
      >
        {log.message}
      </span>
      {duration && (
        <span className="text-zinc-400 dark:text-zinc-600">({duration})</span>
      )}
    </li>
  );
}

function StatusGlyph({ status }: { status: OperationLog['status'] }) {
  switch (status) {
    case 'running':
      return (
        <span
          aria-label="running"
          className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
        />
      );
    case 'completed':
      return (
        <span aria-label="completed" className="text-green-600 dark:text-green-500">
          ✓
        </span>
      );
    case 'fail':
      return (
        <span aria-label="failed" className="text-red-600 dark:text-red-500">
          ✗
        </span>
      );
  }
}

function formatDuration(log: OperationLog): string | null {
  if (!log.completedAt || !log.createdAt) return null;
  const ms =
    new Date(log.completedAt).getTime() - new Date(log.createdAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
