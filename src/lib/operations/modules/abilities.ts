import { type Module, delay } from './types';

type RawAbility = {
  id: string;
  name: string;
  affinity: 'fire' | 'water' | 'earth' | 'air';
};
type AbilitiesOutput = {
  totalAbilities: number;
  synergyScore: number;
  byAffinity: Record<RawAbility['affinity'], number>;
};

const RAW_ABILITIES: RawAbility[] = [
  { id: 'ab_01', name: 'Ignite', affinity: 'fire' },
  { id: 'ab_02', name: 'Tidewall', affinity: 'water' },
  { id: 'ab_03', name: 'Stoneform', affinity: 'earth' },
  { id: 'ab_04', name: 'Tempest', affinity: 'air' },
  { id: 'ab_05', name: 'Inferno', affinity: 'fire' },
  { id: 'ab_06', name: 'Geyser', affinity: 'water' },
  { id: 'ab_07', name: 'Whirlwind', affinity: 'air' },
];

export const abilitiesModule: Module = {
  name: 'abilities',
  async run({ step }): Promise<AbilitiesOutput> {
    const abilities = await step('Fetching abilities…', async () => {
      await delay(5600);
      return RAW_ABILITIES;
    });

    return step('Computing synergy score…', async () => {
      await delay(600);
      const byAffinity = abilities.reduce<
        Record<RawAbility['affinity'], number>
      >(
        (acc, a) => {
          acc[a.affinity] = (acc[a.affinity] ?? 0) + 1;
          return acc;
        },
        { fire: 0, water: 0, earth: 0, air: 0 },
      );
      // Synergy = sum of pairs within each affinity (n choose 2).
      const synergyScore = Object.values(byAffinity).reduce(
        (sum, n) => sum + (n * (n - 1)) / 2,
        0,
      );
      return {
        totalAbilities: abilities.length,
        synergyScore,
        byAffinity,
      };
    });
  },
};

export type { AbilitiesOutput };
