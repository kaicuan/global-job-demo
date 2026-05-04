'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';

import { runOperation } from '@/lib/operations/runner';
import {
  cancelRun,
  resetAfterCompletion,
  tryClaimSlot,
} from '@/lib/operations/state';

/**
 * Atomically claims the global slot, then schedules the worker to run
 * after this response is sent. `after()` extends the invocation lifetime
 * via Vercel's `waitUntil`, so the worker continues past the action's
 * return without blocking the user.
 *
 * Always revalidates `/` before returning: on success the caller needs
 * the new `running` view, and on failure (slot already claimed by another
 * user) the caller's "idle" view is stale and needs to catch up too.
 */
export async function startOperation(): Promise<{ started: boolean }> {
  const runId = await tryClaimSlot();

  if (runId) {
    after(async () => {
      try {
        await runOperation(runId);
      } catch (err) {
        // The runner's error path already abandons the lease; this catch
        // exists so an unexpected throw doesn't go to the platform's logs
        // unattributed.
        console.error('[runOperation] unexpected error:', err);
      }
    });
  }

  revalidatePath('/');
  return { started: !!runId };
}

/**
 * Cancels the running operation identified by `runId`. The worker
 * discovers this at its next step boundary (its captured runId no longer
 * matches the row) and abandons quietly. If `runId` doesn't match the
 * current row (stale tab, run already replaced), this is a safe no-op —
 * we still revalidate so the caller's stale view catches up.
 */
export async function cancelOperation(
  runId: string,
): Promise<{ cancelled: boolean }> {
  const cancelled = await cancelRun(runId);
  revalidatePath('/');
  return { cancelled };
}

/**
 * Returns the system to idle from a completed state and deletes the
 * stored result blob. Gated on `runId` so a stale tab can't wipe a fresh
 * completed run's result. Always revalidates — on no-op the caller's
 * view of "completed" is stale and needs the actual current state.
 */
export async function resetOperation(
  runId: string,
): Promise<{ reset: boolean }> {
  const reset = await resetAfterCompletion(runId);
  revalidatePath('/');
  return { reset };
}
