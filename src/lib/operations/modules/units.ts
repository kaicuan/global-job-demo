import { type Module, delay } from './types';

type RawUnit = { id: string; name: string; class: string; level: number };
type UnitConfig = { unitId: string; equippedSlots: number };
type UnitsOutput = {
  totalUnits: number;
  averageLevel: number;
  totalEquipped: number;
  byClass: Record<string, number>;
};

const RAW_UNITS: RawUnit[] = [
  { id: 'u_01', name: 'Aria', class: 'mage', level: 18 },
  { id: 'u_02', name: 'Borin', class: 'warrior', level: 22 },
  { id: 'u_03', name: 'Cael', class: 'rogue', level: 15 },
  { id: 'u_04', name: 'Dara', class: 'mage', level: 20 },
  { id: 'u_05', name: 'Eyra', class: 'cleric', level: 17 },
];

const RAW_CONFIGS: UnitConfig[] = [
  { unitId: 'u_01', equippedSlots: 4 },
  { unitId: 'u_02', equippedSlots: 5 },
  { unitId: 'u_03', equippedSlots: 3 },
  { unitId: 'u_04', equippedSlots: 4 },
  { unitId: 'u_05', equippedSlots: 5 },
];

export const unitsModule: Module = {
  name: 'units',
  async run({ step }): Promise<UnitsOutput> {
    const units = await step('Fetching unit roster…', async () => {
      await delay(750);
      return RAW_UNITS;
    });

    const configs = await step('Fetching unit configurations…', async () => {
      await delay(550);
      return RAW_CONFIGS;
    });

    return step('Computing roster summary…', async () => {
      await delay(500);
      const configById = new Map(configs.map((c) => [c.unitId, c]));
      const byClass: Record<string, number> = {};
      let totalLevel = 0;
      let totalEquipped = 0;
      for (const u of units) {
        totalLevel += u.level;
        totalEquipped += configById.get(u.id)?.equippedSlots ?? 0;
        byClass[u.class] = (byClass[u.class] ?? 0) + 1;
      }
      return {
        totalUnits: units.length,
        averageLevel: units.length ? totalLevel / units.length : 0,
        totalEquipped,
        byClass,
      };
    });
  },
};

export type { UnitsOutput };
