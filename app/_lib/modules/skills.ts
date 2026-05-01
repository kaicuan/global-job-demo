import { sleep } from "../async";
import type { Module } from "./types";

interface Skill {
  name: string;
  level: number;
}

/**
 * Skills — straightforward request/response fetch and a reduce-style compute.
 * The simplest of the four; serves as the baseline shape.
 */
export const skillsModule: Module<Skill[]> = {
  key: "skills",
  label: "skills",

  async fetch({ signal }) {
    await sleep(2400, signal);
    return [
      { name: "Swordsmanship", level: 8 },
      { name: "Arcana", level: 6 },
      { name: "Stealth", level: 4 },
      { name: "Diplomacy", level: 5 },
    ];
  },

  async compute(skills, { signal }) {
    await sleep(2000, signal);
    const value = skills.reduce((sum, s) => sum + s.level, 0);
    return { key: "skills", label: "skills", value };
  },
};
