export type TimerTypeface = 'lcd' | 'mono' | 'liberation' | 'sans';
export interface TimerTypographySettings {
  timerFont: TimerTypeface;
  timerFontScale: number;
  scrambleFont: TimerTypeface;
  scrambleFontScale: number;
}
export const DEFAULT_TIMER_TYPOGRAPHY: Readonly<TimerTypographySettings> = {
  timerFont: 'lcd', timerFontScale: 1, scrambleFont: 'liberation', scrambleFontScale: 1,
};
export function normalizeTimerTypography(value: Partial<Record<keyof TimerTypographySettings, unknown>>): TimerTypographySettings {
  const font = (input: unknown, fallback: TimerTypeface): TimerTypeface =>
    input === 'lcd' || input === 'mono' || input === 'liberation' || input === 'sans' ? input : fallback;
  const scale = (input: unknown, min: number, max: number) =>
    typeof input === 'number' && Number.isFinite(input) ? Math.min(max, Math.max(min, input)) : 1;
  return {
    timerFont: font(value.timerFont, 'lcd'), timerFontScale: scale(value.timerFontScale, 0.5, 2),
    scrambleFont: font(value.scrambleFont, 'liberation'), scrambleFontScale: scale(value.scrambleFontScale, 0.6, 2.5),
  };
}
