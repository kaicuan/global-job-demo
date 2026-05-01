import type { ModuleSummary } from "../job-types";
import { skillsModule } from "./skills";
import { abilitiesModule } from "./abilities";
import { gearModule } from "./gear";
import { unitsModule } from "./units";
import type { Module, ModuleContext, ModuleKey } from "./types";

/**
 * The orchestrator needs a uniform list of modules but each implementation
 * has its own `TData` type. We erase the data type at the boundary so the
 * orchestrator can iterate without knowing the specific shapes — each
 * module's internal `fetch → compute` pairing remains type-safe inside
 * its own file.
 */
export interface OrchestratedModule {
  readonly key: ModuleKey;
  readonly label: string;
  fetch(ctx: ModuleContext): Promise<unknown>;
  compute(data: unknown, ctx: ModuleContext): Promise<ModuleSummary>;
}

function orchestrate<T>(m: Module<T>): OrchestratedModule {
  return {
    key: m.key,
    label: m.label,
    fetch: (ctx) => m.fetch(ctx),
    compute: (data, ctx) => m.compute(data as T, ctx),
  };
}

/**
 * Order of execution. Serial processing keeps logs readable and makes
 * cancellation semantics straightforward — at most one module is in-flight.
 */
export const modules: ReadonlyArray<OrchestratedModule> = [
  orchestrate(skillsModule),
  orchestrate(abilitiesModule),
  orchestrate(gearModule),
  orchestrate(unitsModule),
];

export type { Module, ModuleContext, ModuleKey } from "./types";
