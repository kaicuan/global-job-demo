import { sleep } from "../async";
import type { Module } from "./types";

interface GearBundle {
  armor: number[];
  weapons: number[];
  trinkets: number[];
}

const SLOT_WEIGHTS = { armor: 1, weapons: 1.5, trinkets: 0.5 } as const;

async function fetchSlot(
  delay: number,
  values: number[],
  signal: AbortSignal,
): Promise<number[]> {
  await sleep(delay, signal);
  return values;
}

/**
 * Gear — concurrent multi-source fetch joined with `Promise.all`, computed via
 * a weighted average across slots. Demonstrates parallel I/O within a module.
 *
 * `Promise.all` rejects on the first rejection, so an aborted slot
 * immediately surfaces as an `AbortError` to the orchestrator.
 */
export const gearModule: Module<GearBundle> = {
  key: "gear",
  label: "gear",

  async fetch({ signal }) {
    const [armor, weapons, trinkets] = await Promise.all([
      fetchSlot(2200, [12, 15, 8], signal),
      fetchSlot(3200, [22, 18], signal),
      fetchSlot(1800, [5, 7, 9, 6], signal),
    ]);
    return { armor, weapons, trinkets };
  },

  async compute(gear, { signal }) {
    await sleep(2600, signal);
    const weightedMean = (xs: number[], weight: number): number =>
      xs.length === 0 ? 0 : (xs.reduce((s, x) => s + x, 0) / xs.length) * weight;

    const value = Math.round(
      weightedMean(gear.armor, SLOT_WEIGHTS.armor) +
        weightedMean(gear.weapons, SLOT_WEIGHTS.weapons) +
        weightedMean(gear.trinkets, SLOT_WEIGHTS.trinkets),
    );
    return { key: "gear", label: "gear", value };
  },
};
