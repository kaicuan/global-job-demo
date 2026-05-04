import { deleteResult, writeResult } from '@/lib/operations/storage';

import { MODULES } from './modules';
import {
  CancelledError,
  type Module,
  type ModuleName,
  type ModuleResult,
  type StepFn,
} from './modules/types';
import {
  cancelRun,
  finishStepLog,
  isStillActive,
  markCompleted,
  startStepLog,
} from './state';

type ModuleSettled =
  | { status: 'fulfilled'; module: ModuleName; output: unknown }
  | { status: 'rejected'; module: ModuleName; error: string };

/**
 * Builds the `step` helper handed to a module. Each call:
 *   1. Verifies this run is still the active one (boundary cancel check).
 *   2. Wraps `fn` with a `running → completed/fail` log entry.
 *
 * In-flight `fn` execution is not interrupted — cancellation takes effect
 * at the next step boundary.
 */
function makeStepFn(module: ModuleName, runId: string): StepFn {
  return async function step<T>(message: string, fn: () => Promise<T>): Promise<T> {
    if (!(await isStillActive(runId))) throw new CancelledError();
    const decorated = `[${module}] ${message}`;
    const logId = await startStepLog(decorated);
    try {
      const result = await fn();
      await finishStepLog(logId, 'completed');
      return result;
    } catch (err) {
      await finishStepLog(logId, 'fail', `${decorated} — ${errorMessage(err)}`);
      throw err;
    }
  };
}

async function runModule(
  module: Module,
  runId: string,
): Promise<ModuleResult> {
  const step = makeStepFn(module.name, runId);
  const output = await module.run({ step });
  return { module: module.name, output };
}

/**
 * Aggregates per-module results into the final operation payload.
 * Decoupled from the runner so the aggregation rule can evolve
 * (weighting, normalisation, etc.) without touching orchestration.
 */
function aggregate(settled: ModuleSettled[]): {
  totalScore: number;
  failedModules: ModuleName[];
  modules: Record<string, unknown>;
} {
  const modules: Record<string, unknown> = {};
  const failedModules: ModuleName[] = [];
  let totalScore = 0;

  for (const r of settled) {
    if (r.status === 'fulfilled') {
      modules[r.module] = r.output;
      totalScore += scoreOf(r.module, r.output);
    } else {
      modules[r.module] = { error: r.error };
      failedModules.push(r.module);
    }
  }

  return { totalScore, failedModules, modules };
}

function scoreOf(module: ModuleName, output: unknown): number {
  if (!output || typeof output !== 'object') return 0;
  const o = output as Record<string, unknown>;
  switch (module) {
    case 'skills':
      return numberOr(o.totalPower);
    case 'abilities':
      return numberOr(o.synergyScore) * 10;
    case 'gear':
      return numberOr(o.totalStat);
    case 'units':
      return numberOr(o.totalEquipped) * 5;
  }
}

function numberOr(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Top-level orchestrator. Runs all modules in parallel, aggregates,
 * persists the result, and transitions the operation to its terminal state.
 *
 * Cancellation is observed at step boundaries via the `runId` lease — if
 * the row's runId no longer matches, this run has been replaced and
 * abandons quietly. The cancel action has already done the state reset.
 */
export async function runOperation(runId: string): Promise<void> {
  try {
    // allSettled (vs all) so that one module's failure doesn't leave the
    // others as unhandled rejections — every module reaches a settled
    // state before we look at the results.
    const results = await Promise.allSettled(
      MODULES.map((mod) => runModule(mod, runId)),
    );

    // If any module aborted because we're no longer the active run, the
    // whole operation has been cancelled — bail. The cancel action already
    // transitioned the row to idle.
    if (results.some((r) => r.status === 'rejected' && r.reason instanceof CancelledError)) {
      return;
    }

    const settled: ModuleSettled[] = results.map((r, i) =>
      r.status === 'fulfilled'
        ? {
            status: 'fulfilled',
            module: r.value.module,
            output: r.value.output,
          }
        : {
            status: 'rejected',
            module: MODULES[i].name,
            error: errorMessage(r.reason),
          },
    );

    const payload = aggregate(settled);
    const { url } = await writeResult(payload);
    const completed = await markCompleted(runId, url);
    if (!completed) {
      // We were cancelled in the narrow window between writeResult and
      // markCompleted. The blob is already in storage but no DB row points
      // at it — clean it up so it doesn't orphan.
      deleteResult(url).catch((err) => {
        console.error('[runOperation] failed to delete orphaned blob:', err);
      });
    }
  } catch (err) {
    // Unexpected failure outside the per-module boundary (blob write,
    // markCompleted, etc.). Cancel the lease so the system can be
    // restarted. If the user has already cancelled, the runId no longer
    // matches and this is a no-op.
    await cancelRun(runId);
    throw err;
  }
}
