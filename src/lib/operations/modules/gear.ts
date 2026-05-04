import { type Module, delay } from './types';

type RawGear = { id: string; slot: string; baseStat: number };
type Enchantment = { gearId: string; bonus: number; rarity: 'rare' | 'epic' };
type GearOutput = {
  totalStat: number;
  count: number;
  bestPiece: { id: string; slot: string; stat: number } | null;
  bySlot: Record<string, number>;
};

const RAW_GEAR: RawGear[] = [
  { id: 'g_01', slot: 'head', baseStat: 25 },
  { id: 'g_02', slot: 'chest', baseStat: 50 },
  { id: 'g_03', slot: 'legs', baseStat: 40 },
  { id: 'g_04', slot: 'hands', baseStat: 20 },
  { id: 'g_05', slot: 'weapon', baseStat: 90 },
];

const RAW_ENCHANTMENTS: Enchantment[] = [
  { gearId: 'g_02', bonus: 15, rarity: 'rare' },
  { gearId: 'g_05', bonus: 30, rarity: 'epic' },
  { gearId: 'g_03', bonus: 8, rarity: 'rare' },
];

export const gearModule: Module = {
  name: 'gear',
  async run({ step }): Promise<GearOutput> {
    const gear = await step('Fetching gear inventory…', async () => {
      await delay(800);
      return RAW_GEAR;
    });

    const enchantments = await step('Fetching enchantments…', async () => {
      await delay(500);
      return RAW_ENCHANTMENTS;
    });

    const merged = await step('Merging gear with enchantments…', async () => {
      await delay(350);
      const byId = new Map(enchantments.map((e) => [e.gearId, e]));
      return gear.map((g) => {
        const e = byId.get(g.id);
        return {
          ...g,
          bonus: e?.bonus ?? 0,
          rarity: e?.rarity ?? ('common' as const),
        };
      });
    });

    return step('Computing gear totals…', async () => {
      await delay(450);
      const bySlot: Record<string, number> = {};
      let totalStat = 0;
      let bestPiece: GearOutput['bestPiece'] = null;
      for (const g of merged) {
        const stat = g.baseStat + g.bonus;
        totalStat += stat;
        bySlot[g.slot] = (bySlot[g.slot] ?? 0) + stat;
        if (!bestPiece || stat > bestPiece.stat) {
          bestPiece = { id: g.id, slot: g.slot, stat };
        }
      }
      return { totalStat, count: merged.length, bestPiece, bySlot };
    });
  },
};

export type { GearOutput };
