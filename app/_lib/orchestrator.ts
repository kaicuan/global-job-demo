import "server-only";
import { isAbortError } from "./async";
import { jobStore } from "./job-store";
import type { ModuleSummary } from "./job-types";
import { modules, type OrchestratedModule } from "./modules";

/**
 * Runs all modules concurrently, writing log entries through `jobStore`
 * for each fetch and compute step. Modules are independent (the final
 * step just sums their values), so parallel execution cuts total wall-
 * clock time from `sum(modules)` to `max(modules)`.
 *
 * The signal is the same one held by the store, so any cancel() call
 * propagates to every in-flight module simultaneously. `Promise.all`
 * rejects on the first AbortError; other modules abort at their next
 * `sleep` checkpoint and their rejections are absorbed by `Promise.all`.
 *
 * Cancellation is handled at this layer — when the signal aborts, we
 * exit silently. The store has already been transitioned to `idle` by
 * `cancel()` so any post-abort write would no-op anyway, but we short-
 * circuit to keep the log free of half-finished entries.
 */
export async function runJob(jobId: string, signal: AbortSignal): Promise<void> {
  try {
    const summaries = await Promise.all(
      modules.map((module) => runModule(module, signal)),
    );

    if (signal.aborted) return;

    const aggregateLogId = jobStore.appendLog("Aggregating final score…");
    const total = summaries.reduce((sum, s) => sum + s.value, 0);
    jobStore.resolveLog(aggregateLogId, "success");

    jobStore.complete(jobId, { total, modules: summaries });
  } catch (err) {
    if (isAbortError(err) || signal.aborted) return;
    // Mocks don't fail; if a real module throws non-abort, surface it on
    // the server log and reset the store so users aren't stuck.
    console.error("[runJob]", err);
    jobStore.reset();
  }
}

async function runModule(
  module: OrchestratedModule,
  signal: AbortSignal,
): Promise<ModuleSummary> {
  const fetchLogId = jobStore.appendLog(`Fetching ${module.label}…`);
  let data: unknown;
  try {
    data = await module.fetch({ signal });
  } catch (err) {
    if (isAbortError(err) || signal.aborted) throw err;
    jobStore.resolveLog(fetchLogId, "failure", errorMessage(err));
    throw err;
  }
  jobStore.resolveLog(fetchLogId, "success");

  const computeLogId = jobStore.appendLog(`Computing ${module.label}…`);
  try {
    const summary = await module.compute(data, { signal });
    jobStore.resolveLog(computeLogId, "success");
    return summary;
  } catch (err) {
    if (isAbortError(err) || signal.aborted) throw err;
    jobStore.resolveLog(computeLogId, "failure", errorMessage(err));
    throw err;
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
