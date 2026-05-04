import { type Module, delay } from './types';

type RawSkill = { id: string; name: string; tier: number; basePower: number };
type SkillsOutput = {
  totalPower: number;
  count: number;
  skills: { id: string; name: string; power: number }[];
};

const RAW_SKILLS: RawSkill[] = [
  { id: 'sk_01', name: 'Pyroblast', tier: 3, basePower: 120 },
  { id: 'sk_02', name: 'Frost Nova', tier: 2, basePower: 80 },
  { id: 'sk_03', name: 'Arcane Missiles', tier: 1, basePower: 40 },
  { id: 'sk_04', name: 'Meteor', tier: 4, basePower: 200 },
  { id: 'sk_05', name: 'Healing Touch', tier: 2, basePower: 60 },
  { id: 'sk_06', name: 'Sunfire', tier: 3, basePower: 110 },
];

export const skillsModule: Module = {
  name: 'skills',
  async run({ step }): Promise<SkillsOutput> {
    const raw = await step('Fetching skills…', async () => {
      await delay(900);
      return RAW_SKILLS;
    });

    const filtered = await step('Filtering by tier threshold…', async () => {
      await delay(400);
      const tierThreshold = 2;
      return raw.filter((s) => s.tier >= tierThreshold);
    });

    return step('Computing power index…', async () => {
      await delay(8000);
      const items = filtered.map((s) => ({
        id: s.id,
        name: s.name,
        power: s.basePower * (1 + s.tier * 0.1),
      }));
      return {
        count: items.length,
        totalPower: items.reduce((sum, s) => sum + s.power, 0),
        skills: items,
      };
    });
  },
};

export type { SkillsOutput };
