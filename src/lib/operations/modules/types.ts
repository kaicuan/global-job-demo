export const MODULE_NAMES = ['skills', 'abilities', 'gear', 'units'] as const;
export type ModuleName = (typeof MODULE_NAMES)[number];

/**
 * A `step` runs `fn` while emitting a `running → completed/fail` log entry
 * tied to `message`. The return value of `fn` becomes the step's result.
 *
 * Steps are composed inside a module's `run` function as plain awaits, so
 * any prior step's output is accessible via its own local variable. There
 * is no implicit chain — a step depends on whatever it closes over, and
 * nothing more.
 *
 * Cancellation is checked at step boundaries (before `fn` runs). In-flight
 * `fn` execution is not interrupted; cancel takes effect at the next step.
 */
export type StepFn = <T>(message: string, fn: () => Promise<T>) => Promise<T>;

export type ModuleContext = {
  readonly step: StepFn;
};

export type Module = {
  readonly name: ModuleName;
  run(ctx: ModuleContext): Promise<unknown>;
};

export type ModuleResult = {
  readonly module: ModuleName;
  readonly output: unknown;
};

export class CancelledError extends Error {
  constructor(message = 'Operation cancelled') {
    super(message);
    this.name = 'CancelledError';
  }
}

/** Resolves after `ms`. Used by mocked work to simulate I/O latency. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
