import { getLogs, getOperation } from '@/lib/operations/state';

export type OperationStatePayload = {
  operation: Awaited<ReturnType<typeof getOperation>>;
  logs: Awaited<ReturnType<typeof getLogs>>;
};

/**
 * Single source of truth for the client poller. Returns the current operation
 * row + ordered logs in one round trip so the UI never sees a torn state.
 */
export async function GET(): Promise<Response> {
  const [operation, logs] = await Promise.all([getOperation(), getLogs()]);
  return Response.json({ operation, logs } satisfies OperationStatePayload, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
