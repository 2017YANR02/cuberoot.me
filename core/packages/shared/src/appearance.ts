/** Web token -> native token boundary. CSS remains the color source of truth. */
export const NATIVE_APPEARANCE_TOKENS = {
  '--cr-bg': '--background',
  '--cr-surface': '--card',
  '--cr-text': '--foreground',
  '--cr-muted': '--muted-foreground',
  '--cr-faint': '--faint-foreground',
  '--cr-line': '--border-default',
  '--cr-accent': '--accent',
  '--cr-accent-soft': '--accent-soft',
  '--cr-ready': '--signal-success',
  '--cr-danger': '--destructive',
} as const;
export type NativeAppearanceColors = Record<keyof typeof NATIVE_APPEARANCE_TOKENS, string>;
export interface NativeAppearance {
  type: 'cuberoot:appearance';
  scheme: 'light' | 'dark';
  followSystem: boolean;
  colors: NativeAppearanceColors;
}
export function decodeNativeAppearance(value: unknown): NativeAppearance | null {
  if (!value || typeof value !== 'object') return null;
  const message = value as Partial<NativeAppearance>;
  if (message.type !== 'cuberoot:appearance'
    || (message.scheme !== 'light' && message.scheme !== 'dark')
    || typeof message.followSystem !== 'boolean'
    || !message.colors || typeof message.colors !== 'object') return null;
  const colors = {} as NativeAppearanceColors;
  for (const key of Object.keys(NATIVE_APPEARANCE_TOKENS) as (keyof NativeAppearanceColors)[]) {
    const color = message.colors[key];
    if (typeof color !== 'string' || !/^#[\da-f]{6}$/i.test(color)) return null;
    colors[key] = color;
  }
  return { type: 'cuberoot:appearance', scheme: message.scheme, followSystem: message.followSystem, colors };
}
