// Names and aliases come from the real consumers; artwork stays in event-icon.
import { TIMER_EVENT_PICKER_ITEMS } from '@cuberoot/shared/timer/event-catalog';
import { CSTIMER_EVENTS } from '@/lib/cstimer-scramble';
import { NATIVE_SCRAMBLE_EVENTS } from '@/lib/native-scramble';
import { SHAPE_MOD_EVENTS } from '@/lib/shape-mod-scramble';
import { ALL_PUZZLE_TYPE_OPTIONS } from '../sim/puzzleOptions';

const PROJECT_ICONS = [
  { id: 'skewb-ultimate-exact', iconClass: 'puzzle-skewb-ultimate', en: 'Skewb Ultimate', zh: '终极斜转' },
  { id: 'rubiks-ufo-ftm-exact', iconClass: 'puzzle-rubiks-ufo', en: "Rubik's UFO", zh: '鲁比克飞碟' },
  { id: 'rubiks-ufo-stm-exact', iconClass: 'puzzle-rubiks-ufo', en: "Rubik's UFO", zh: '鲁比克飞碟' },
  ...CSTIMER_EVENTS,
  ...SHAPE_MOD_EVENTS,
  ...NATIVE_SCRAMBLE_EVENTS,
  ...TIMER_EVENT_PICKER_ITEMS.map(({ id, iconClass, nameEn, nameZh }) => ({
    id, iconClass, en: nameEn, zh: nameZh,
  })),
  // Preserve the simulator's established gallery names when several event IDs
  // use the same artwork. All other names remain searchable below.
  ...ALL_PUZZLE_TYPE_OPTIONS.map(({ value, iconClass, labelEn, labelZh }) => ({
    id: value, iconClass, en: labelEn, zh: labelZh,
  })),
];

export const PUZZLE_ICON_NAMES: Record<string, { en: string; zh: string }> = Object.fromEntries(
  PROJECT_ICONS.flatMap(({ iconClass, en, zh }) => iconClass ? [[iconClass, { en, zh }]] : []),
);

/** Search by any consuming page's name or stable event ID, in either language. */
export const PUZZLE_ICON_SEARCH_TERMS: Record<string, string> = {};
for (const { id, iconClass, en, zh } of PROJECT_ICONS) {
  if (!iconClass) continue;
  PUZZLE_ICON_SEARCH_TERMS[iconClass] = [PUZZLE_ICON_SEARCH_TERMS[iconClass], id, en, zh]
    .filter(Boolean).join(' ').toLowerCase();
}
