import { sleep } from "../async";
import type { Module } from "./types";

type Tier = "A" | "B" | "C";

interface Unit {
  name: string;
  tier: Tier;
}

interface Page {
  units: Unit[];
  nextCursor: number | null;
}

const PAGES: Unit[][] = [
  [
    { name: "Knight", tier: "A" },
    { name: "Mage", tier: "B" },
  ],
  [
    { name: "Archer", tier: "B" },
    { name: "Squire", tier: "C" },
  ],
  [
    { name: "Healer", tier: "A" },
    { name: "Scout", tier: "C" },
  ],
];

const TIER_SCORE: Record<Tier, number> = { A: 30, B: 20, C: 10 };

async function fetchPage(cursor: number, signal: AbortSignal): Promise<Page> {
  await sleep(950, signal);
  const units = PAGES[cursor] ?? [];
  const nextCursor = cursor + 1 < PAGES.length ? cursor + 1 : null;
  return { units, nextCursor };
}

/**
 * Units — sequential cursor-paginated fetch (each page depends on the
 * previous response), computed via tier classification. Demonstrates a
 * loop-driven fetch where cancellation may interrupt between pages.
 */
export const unitsModule: Module<Unit[]> = {
  key: "units",
  label: "units",

  async fetch({ signal }) {
    const collected: Unit[] = [];
    let cursor: number | null = 0;
    while (cursor !== null) {
      const page = await fetchPage(cursor, signal);
      collected.push(...page.units);
      cursor = page.nextCursor;
    }
    return collected;
  },

  async compute(units, { signal }) {
    await sleep(2200, signal);
    const value = units.reduce((sum, u) => sum + TIER_SCORE[u.tier], 0);
    return { key: "units", label: "units", value };
  },
};
