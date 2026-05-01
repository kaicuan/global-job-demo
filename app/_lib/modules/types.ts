import type { ModuleSummary } from "../job-types";

export type ModuleKey = "skills" | "abilities" | "gear" | "units";

export interface ModuleContext {
  readonly signal: AbortSignal;
}

/**
 * Each module performs two phases — fetch (acquire raw inputs) and
 * compute (derive a numeric contribution). Both phases must honour the
 * signal so cancellation propagates promptly.
 *
 * The fetch type parameter `TData` lets each module choose its own raw
 * shape; only the `ModuleSummary` returned by `compute` flows into the
 * orchestrator's aggregation step.
 */
export interface Module<TData> {
  readonly key: ModuleKey;
  readonly label: string;
  fetch(ctx: ModuleContext): Promise<TData>;
  compute(data: TData, ctx: ModuleContext): Promise<ModuleSummary>;
}
