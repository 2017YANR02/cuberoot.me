/** Solo layout preferences. Gaps participate in flow so long scrambles
 * and enlarged previews never overlap the readout. */
const defaultSoloGeometry = {
  scrambleGap: 16,
  sourceGap: 16,
  timerGap: 20,
  cubeGap: 8,
  scrambleOffsetY: 0,
  sourceOffsetY: 0,
  timerOffsetY: 0,
  cubeOffsetY: 0,
  sourceScale: 1,
  cubeScale: 1,
};
export const DEFAULT_SOLO_LAYOUT = {
  ...defaultSoloGeometry,
  hideCompetitionInfo: false,
  hideCubePreview: false,
};
export type SoloLayout = typeof DEFAULT_SOLO_LAYOUT;

export interface TimerSoloLayoutSettings {
  soloLayout: SoloLayout;
  timerFontScale: number;
  scrambleFontScale: number;
}

export const TIMER_SOLO_LAYOUT_REGIONS = [
  { gap: 'scrambleGap', offset: 'scrambleOffsetY', scale: 'scrambleFontScale', label: { zh: '打乱文字', en: 'Scramble' }, min: 0.6, max: 2.5 },
  { gap: 'sourceGap', offset: 'sourceOffsetY', scale: 'sourceScale', hide: 'hideCompetitionInfo',
    label: { zh: '比赛信息', en: 'Competition information' }, hideLabel: { zh: '隐藏比赛信息', en: 'Hide competition information' }, min: 0.5, max: 2 },
  { gap: 'timerGap', offset: 'timerOffsetY', scale: 'timerFontScale', label: { zh: '计时数字', en: 'Timer digits' }, min: 0.5, max: 2 },
  { gap: 'cubeGap', offset: 'cubeOffsetY', scale: 'cubeScale', hide: 'hideCubePreview',
    label: { zh: '魔方图示', en: 'Cube preview' }, hideLabel: { zh: '隐藏魔方图示', en: 'Hide cube preview' }, min: 0.5, max: 2 },
] as const;
export type TimerSoloLayoutRegion = typeof TIMER_SOLO_LAYOUT_REGIONS[number];
export type TimerSoloHideableRegion = Extract<TimerSoloLayoutRegion, { hide: keyof SoloLayout }>['gap'];
export type TimerSoloLayoutGesture = 'move' | 'size';
export const TIMER_SOLO_LAYOUT_COPY = {
  edit: { zh: '布局调整', en: 'Layout editing' },
  reset: { zh: '恢复默认布局', en: 'Reset layout' },
  done: { zh: '完成', en: 'Done' },
  move: { zh: '上下拖动', en: 'Drag vertically' },
  size: { zh: '拖动缩放', en: 'Drag to resize' },
} as const;

export function timerSoloRegionValue(settings: TimerSoloLayoutSettings, region: TimerSoloLayoutRegion, mode: TimerSoloLayoutGesture, independentMove = false): number {
  if (mode === 'move') return settings.soloLayout[independentMove ? region.offset : region.gap];
  const key = region.scale;
  return key === 'timerFontScale' || key === 'scrambleFontScale' ? settings[key] : settings.soloLayout[key];
}

export function timerSoloRegionPatch(settings: TimerSoloLayoutSettings, region: TimerSoloLayoutRegion, mode: TimerSoloLayoutGesture, requested: number, independentMove = false): Partial<TimerSoloLayoutSettings> {
  const value = mode === 'move' ? Math.round(Math.max(independentMove ? -240 : 0, Math.min(240, requested)))
    : Math.round(Math.max(region.min, Math.min(region.max, requested)) * 100) / 100;
  if (value === timerSoloRegionValue(settings, region, mode, independentMove)) return {};
  if (mode === 'move') return { soloLayout: { ...settings.soloLayout, [independentMove ? region.offset : region.gap]: value } };
  const key = region.scale;
  return key === 'timerFontScale' || key === 'scrambleFontScale'
    ? { [key]: value } : { soloLayout: { ...settings.soloLayout, [key]: value } };
}

export function timerSoloDragValue(mode: TimerSoloLayoutGesture, startValue: number, distance: number, height: number): number {
  return startValue + (mode === 'move' ? distance : distance / Math.max(40, height) * startValue);
}

export function normalizeSoloLayout(value: unknown): SoloLayout {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const result = { ...defaultSoloGeometry };
  for (const key of Object.keys(result) as (keyof typeof defaultSoloGeometry)[]) {
    const candidate = input[key];
    const scale = key.endsWith('Scale');
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      result[key] = Math.min(scale ? 2 : 240, Math.max(scale ? 0.5 : key.endsWith('OffsetY') ? -240 : 0, candidate));
    }
  }
  return { ...result, hideCompetitionInfo: input.hideCompetitionInfo === true, hideCubePreview: input.hideCubePreview === true };
}

export const TIMER_SOLO_STAT_RAIL_KEYS = ['count', 'best', 'ao5', 'ao12'] as const;

export function timerSoloStatRailRows(summary: { count: number; solved: number; best: string; ao5: string; ao12: string }) {
  return TIMER_SOLO_STAT_RAIL_KEYS.map(key => key === 'count'
    ? { label: '', value: `${summary.solved}/${summary.count}` }
    : { label: key, value: summary.count === 0 || summary[key] === '—' ? '-' : summary[key] });
}
