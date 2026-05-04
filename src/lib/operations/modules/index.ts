import { abilitiesModule } from './abilities';
import { gearModule } from './gear';
import { skillsModule } from './skills';
import { type Module } from './types';
import { unitsModule } from './units';

export const MODULES: readonly Module[] = [
  skillsModule,
  abilitiesModule,
  gearModule,
  unitsModule,
];

export { type Module, type ModuleName, MODULE_NAMES } from './types';
