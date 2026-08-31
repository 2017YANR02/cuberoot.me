/** Runtime-neutral cube-face subset vocabulary shared by timer difficulty UIs. */

export type TimerColorLetter = 'B' | 'G' | 'O' | 'R' | 'W' | 'Y';
export type TimerColorMode = 'cn' | 'quad' | 'dual' | 'single';

export const TIMER_COLOR_LETTERS: readonly TimerColorLetter[] = ['B', 'G', 'O', 'R', 'W', 'Y'];

/** Physical sticker colors, intentionally independent from application theme tokens. */
export const TIMER_COLOR_HEX: Readonly<Record<TimerColorLetter, string>> = {
  W: '#FFFFFF',
  Y: '#FEFE00',
  R: '#EE0000',
  O: '#FFA100',
  B: '#0000F2',
  G: '#00D800',
};

export const TIMER_COLOR_NAMES: Readonly<Record<
  TimerColorLetter,
  Readonly<{ en: string; zh: string }>
>> = {
  W: { en: 'White', zh: '白' },
  Y: { en: 'Yellow', zh: '黄' },
  R: { en: 'Red', zh: '红' },
  O: { en: 'Orange', zh: '橙' },
  B: { en: 'Blue', zh: '蓝' },
  G: { en: 'Green', zh: '绿' },
};

export const TIMER_COLOR_GRADIENT_ORDER: readonly TimerColorLetter[] = [
  'W', 'Y', 'G', 'B', 'R', 'O',
];

export interface TimerColorPair {
  key: string;
  letters: readonly [TimerColorLetter, TimerColorLetter];
}

export const TIMER_COLOR_DUAL_PAIRS: readonly TimerColorPair[] = [
  { key: 'WY', letters: ['W', 'Y'] },
  { key: 'BG', letters: ['B', 'G'] },
  { key: 'OR', letters: ['O', 'R'] },
];

export const TIMER_COLOR_MODE_ORDER: readonly TimerColorMode[] = [
  'dual', 'cn', 'single', 'quad',
];

export interface TimerColorSubsetOption {
  colors: readonly TimerColorLetter[];
  id: string;
  key: string;
  mode: TimerColorMode;
}

export function timerColorSubsetKey(letters: readonly TimerColorLetter[]): string {
  return [...letters].sort().join('');
}

export function timerColorSubsetOptions(mode: TimerColorMode): TimerColorSubsetOption[] {
  switch (mode) {
    case 'single':
      return TIMER_COLOR_GRADIENT_ORDER.map((color) => ({
        colors: [color], id: color, key: color, mode,
      }));
    case 'dual':
      return TIMER_COLOR_DUAL_PAIRS.map((pair) => ({
        colors: [...pair.letters],
        id: pair.key,
        key: timerColorSubsetKey(pair.letters),
        mode,
      }));
    case 'quad':
      return TIMER_COLOR_DUAL_PAIRS.map((pair) => {
        const colors = TIMER_COLOR_LETTERS.filter((color) => !pair.letters.includes(color));
        return {
          colors,
          id: pair.key,
          key: timerColorSubsetKey(colors),
          mode,
        };
      });
    case 'cn':
      return [{
        colors: [...TIMER_COLOR_LETTERS],
        id: 'cn',
        key: timerColorSubsetKey(TIMER_COLOR_LETTERS),
        mode,
      }];
  }
}

export function timerAllColorSubsetOptions(): TimerColorSubsetOption[] {
  return TIMER_COLOR_MODE_ORDER.flatMap(timerColorSubsetOptions);
}

/** Invalid or legacy subset keys converge to canonical six-color neutrality. */
export function normalizeTimerColorSubsetKey(value: unknown): string {
  if (typeof value !== 'string') return timerColorSubsetKey(TIMER_COLOR_LETTERS);
  const letters = [...new Set(value.toUpperCase().split('').filter(
    (color): color is TimerColorLetter => TIMER_COLOR_LETTERS.includes(color as TimerColorLetter),
  ))];
  const key = timerColorSubsetKey(letters);
  return timerAllColorSubsetOptions().some((option) => option.key === key)
    ? key
    : timerColorSubsetKey(TIMER_COLOR_LETTERS);
}

export function timerColorSubsetOption(value: unknown): TimerColorSubsetOption {
  const key = normalizeTimerColorSubsetKey(value);
  return timerAllColorSubsetOptions().find((option) => option.key === key)
    ?? timerColorSubsetOptions('cn')[0]!;
}
