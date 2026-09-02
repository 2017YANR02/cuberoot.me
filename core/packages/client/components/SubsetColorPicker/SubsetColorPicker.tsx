'use client';

import {
  SubsetColorPicker as SharedSubsetColorPicker,
  type SubsetSelection,
  type TimerUiLanguage,
} from '@cuberoot/timer-ui';

export {
  COLOR_HEX,
  COLOR_LETTERS,
  COLOR_NAME,
  DUAL_PAIRS,
  fillColorsForSubset,
  GRADIENT_ORDER,
  subsetKeyFromLetters,
  subsetOptionsFor,
  SubsetSwatch,
  useSubsetSelection,
  useUrlSubsetSelection,
} from '@cuberoot/timer-ui';
export type {
  ColorLetter,
  ColorMode,
  SubsetOption,
  SubsetSelection,
} from '@cuberoot/timer-ui';

export function SubsetColorPicker({ sel, isZh, className, allOption, ariaLabel }: {
  sel: SubsetSelection;
  isZh: boolean;
  className?: string;
  allOption?: { active: boolean; onSelect: () => void };
  ariaLabel?: string;
}) {
  const language: TimerUiLanguage = isZh ? 'zh' : 'en';
  return <SharedSubsetColorPicker {...{ allOption, ariaLabel, className, language, sel }} />;
}
