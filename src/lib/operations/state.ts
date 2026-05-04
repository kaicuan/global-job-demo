import { and, asc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { db } from '@/lib/db';
import {
  type LogStatus,
  type Operation,
  type OperationLog,
  SINGLETON_ID,
  operationLogs,
  operations,
} from '@/lib/db/schema';
import { deleteResult } from '@/lib/operations/storage';

async function ensureInitialized(): Promise<void> {
  await db
    .insert(operations)
    .values({ id: SINGLETON_ID, status: 'idle' })
    .onConflictDoNothing();
}

export async function getOperation(): Promise<Operation> {
  await ensureInitialized();
  const [row] = await db
    .select()
    .from(operations)
    .where(eq(operations.id, SINGLETON_ID));
  return row;
}

export async function getLogs(): Promise<OperationLog[]> {
  return db.select().from(operationLogs).orderBy(asc(operationLogs.id));
}

/**
 * Atomically claims the global slot. Returns a fresh runId iff the system
 * was idle and is now running. Logs from any prior run are wiped in the
 * same transaction.
 *
 * The runId is the worker's lease — it must check it back against the row
 * before each step. If it no longer matches, the run has been replaced.
 */
export async function tryClaimSlot(): Promise<string | null> {
  await ensureInitialized();
  const runId = randomUUID();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(operations)
      .set({
        status: 'running',
        runId,
        resultUrl: null,
        startedAt: new Date(),
        completedAt: null,
      })
      .where(
        and(eq(operations.id, SINGLETON_ID), eq(operations.status, 'idle')),
      )
      .returning();
    if (!row) return null;
    await tx.delete(operationLogs);
    return runId;
  });
}

const IDLE_FIELDS = {
  status: 'idle',
  runId: null,
  resultUrl: null,
  startedAt: null,
  completedAt: null,
} as const;

/**
 * Transitions a *running* run back to idle. Serves both user-initiated
 * cancel and worker-initiated abandon-on-error — they're the same
 * transition with the same guards, so they share one primitive.
 *
 * Gated on (status='running' AND runId match). The runId guard prevents
 * stale-tab / late-worker races where the caller's view of the run no
 * longer reflects reality (e.g., another tab cancelled-and-restarted).
 */
export async function cancelRun(runId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(operations)
      .set(IDLE_FIELDS)
      .where(
        and(
          eq(operations.id, SINGLETON_ID),
          eq(operations.status, 'running'),
          eq(operations.runId, runId),
        ),
      )
      .returning();
    if (!row) return false;
    await tx.delete(operationLogs);
    return true;
  });
}

/**
 * Transitions a *completed* run back to idle and deletes its result blob.
 * Gated on (status='completed' AND runId match) so a stale tab can't
 * accidentally wipe a fresh completed run's result.
 *
 * Blob deletion is best-effort and runs after the transaction commits —
 * a failed delete leaves an orphan but doesn't undo the state transition.
 */
export async function resetAfterCompletion(runId: string): Promise<boolean> {
  const clearedUrl = await db.transaction(async (tx) => {
    // Capture the URL before the UPDATE wipes it. The row lock taken by
    // the UPDATE + the WHERE guard ensure no concurrent transition can
    // race past this read.
    const [existing] = await tx
      .select({ resultUrl: operations.resultUrl })
      .from(operations)
      .where(
        and(
          eq(operations.id, SINGLETON_ID),
          eq(operations.status, 'completed'),
          eq(operations.runId, runId),
        ),
      );
    if (!existing) return null;

    const [row] = await tx
      .update(operations)
      .set(IDLE_FIELDS)
      .where(
        and(
          eq(operations.id, SINGLETON_ID),
          eq(operations.status, 'completed'),
          eq(operations.runId, runId),
        ),
      )
      .returning();
    if (!row) return null;
    await tx.delete(operationLogs);
    return existing.resultUrl;
  });

  if (clearedUrl === null) return false;
  if (clearedUrl) {
    deleteResult(clearedUrl).catch((err) => {
      console.error('[resetAfterCompletion] failed to delete blob:', err);
    });
  }
  return true;
}

/**
 * Worker-side check: am I still the active run? Cheap single-row lookup,
 * called at each step boundary.
 */
export async function isStillActive(runId: string): Promise<boolean> {
  const [row] = await db
    .select({ runId: operations.runId, status: operations.status })
    .from(operations)
    .where(eq(operations.id, SINGLETON_ID));
  return !!row && row.status === 'running' && row.runId === runId;
}

/**
 * running → completed. Atomically guarded by the runId so a stale worker
 * can't overwrite a fresh run.
 */
export async function markCompleted(
  runId: string,
  resultUrl: string,
): Promise<boolean> {
  const [row] = await db
    .update(operations)
    .set({
      status: 'completed',
      resultUrl,
      completedAt: new Date(),
    })
    .where(
      and(
        eq(operations.id, SINGLETON_ID),
        eq(operations.status, 'running'),
        eq(operations.runId, runId),
      ),
    )
    .returning();
  return !!row;
}

export async function startStepLog(message: string): Promise<number> {
  const [row] = await db
    .insert(operationLogs)
    .values({ message, status: 'running' })
    .returning({ id: operationLogs.id });
  return row.id;
}

export async function finishStepLog(
  id: number,
  status: Exclude<LogStatus, 'running'>,
  message?: string,
): Promise<void> {
  await db
    .update(operationLogs)
    .set({ status, completedAt: new Date(), ...(message ? { message } : {}) })
    .where(eq(operationLogs.id, id));
}
