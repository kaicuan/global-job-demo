import { sleep } from "../async";
import type { Module } from "./types";

interface Ability {
  name: string;
  rarity: number;
}

const SOURCE: Ability[] = [
  { name: "Cleave", rarity: 3 },
  { name: "Heal", rarity: 2 },
  { name: "Teleport", rarity: 5 },
  { name: "Frostbite", rarity: 4 },
  { name: "Mend", rarity: 1 },
];

/**
 * Yields one ability at a time with a small delay, simulating a server-pushed
 * stream (e.g. SSE / chunked JSON). Cancellation interrupts mid-stream because
 * `sleep` rejects on the signal.
 */
async function* streamAbilities(signal: AbortSignal): AsyncGenerator<Ability> {
  for (const ability of SOURCE) {
    await sleep(560, signal);
    yield ability;
  }
}

/**
 * Abilities — fetch via async iterator, compute via incremental fold.
 * Demonstrates that the module contract works for streaming sources.
 */
export const abilitiesModule: Module<Ability[]> = {
  key: "abilities",
  label: "abilities",

  async fetch({ signal }) {
    const collected: Ability[] = [];
    for await (const ability of streamAbilities(signal)) {
      collected.push(ability);
    }
    return collected;
  },

  async compute(abilities, { signal }) {
    await sleep(2400, signal);
    const value = abilities.reduce((acc, a) => acc + a.rarity * 10, 0);
    return { key: "abilities", label: "abilities", value };
  },
};
