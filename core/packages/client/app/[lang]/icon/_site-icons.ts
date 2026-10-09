// Names and keys share /sim's catalog; SVGs all come from @cuberoot/event-icon.
import { ALL_PUZZLE_TYPE_OPTIONS } from '../sim/puzzleOptions';

export const PUZZLE_ICON_NAMES: Record<string, { en: string; zh: string }> = Object.fromEntries(
  ALL_PUZZLE_TYPE_OPTIONS.map(p => [p.iconClass, { en: p.labelEn, zh: p.labelZh }]),
);
