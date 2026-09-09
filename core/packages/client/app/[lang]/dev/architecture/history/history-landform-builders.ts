import type { Group } from 'three';
import type { PaperScenery } from './history-scenery';
import type { HistoryLandform } from './history-landforms';
import { RELIEF_LANDFORMS } from './history-landforms-relief';
import { INLAND_LANDFORMS } from './history-landforms-inland';
import { WATER_LANDFORMS } from './history-landforms-water';

export const LANDFORM_BUILDERS = {
  ...RELIEF_LANDFORMS, ...INLAND_LANDFORMS, ...WATER_LANDFORMS,
} satisfies Record<HistoryLandform, (art: PaperScenery, root: Group, day: number) => void>;
