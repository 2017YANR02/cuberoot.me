import type { SimSettings } from './SettingDrawer';

// A narrow allowlist keeps presets independent of algorithms, uploaded media,
// renderer selection and debugging/interaction settings.
const numbers = ['scale', 'perspective', 'viewAngle', 'viewGradient', 'coreOpacity', 'stickerOpacity', 'stickerEmission', 'stickerGap'] as const;
const booleans = ['thickness', 'hollow', 'arrow', 'hint', 'faceLabels', 'backView'] as const;
const colors = ['coreColor', 'mirrorColor'] as const;
const palettes = ['faceColors', 'ghostFaceColors'] as const;
const choices = {
  boardBg: ['auto', 'white', 'dark', 'checkerDark', 'checkerLight'],
  viewMode: ['cube', 'net'],
  coreStyle: ['normal', 'raw'],
  mirrorColorMode: ['single', 'six'],
} as const;
type AppearanceKey = typeof numbers[number] | typeof booleans[number] | typeof colors[number]
  | typeof palettes[number] | keyof typeof choices;
export type SimAppearance = Partial<Pick<SimSettings, AppearanceKey>>;
export interface AppearancePreset { name: string; appearance: SimAppearance }
export const APPEARANCE_PRESETS_KEY = 'sim.appearance-presets.v1';
export const MAX_APPEARANCE_PRESETS = 20;
const isColor = (value: unknown): value is string => typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);

/** Also used for snapshots: copying palette objects prevents later edits changing a preset. */
export function pickAppearance(value: unknown): SimAppearance {
  if (!value || typeof value !== 'object') return {};
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of numbers) {
    const v = source[key];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100) result[key] = v;
  }
  for (const key of booleans) if (typeof source[key] === 'boolean') result[key] = source[key];
  for (const key of colors) if (isColor(source[key])) result[key] = source[key];
  for (const key of Object.keys(choices) as (keyof typeof choices)[]) {
    if ((choices[key] as readonly unknown[]).includes(source[key])) result[key] = source[key];
  }
  for (const key of palettes) {
    const palette = source[key];
    if (!palette || typeof palette !== 'object') continue;
    const p = palette as Record<string, unknown>;
    const faces = ['U', 'D', 'L', 'R', 'F', 'B'] as const;
    if (faces.every(face => isColor(p[face]))) result[key] = Object.fromEntries(faces.map(face => [face, p[face]]));
  }
  return result as SimAppearance;
}

export function readAppearancePresets(raw: string | null): AppearancePreset[] {
  try {
    const entries: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(entries)) return [];
    const presets: AppearancePreset[] = [];
    for (const entry of entries) {
      if (!entry || typeof entry.name !== 'string') continue;
      const name = entry.name.trim().slice(0, 40);
      const appearance = pickAppearance(entry.appearance);
      if (!name || presets.some(p => p.name === name) || !Object.keys(appearance).length) continue;
      presets.push({ name, appearance });
      if (presets.length === MAX_APPEARANCE_PRESETS) break;
    }
    return presets;
  } catch { return []; }
}
