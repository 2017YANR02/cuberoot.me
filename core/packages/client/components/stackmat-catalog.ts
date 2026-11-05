/** The artwork, gallery and timer settings share this catalogue. */
export const STACKMAT_GENERATIONS = [1, 2, 3, 4, 5] as const;
export type StackmatGeneration = typeof STACKMAT_GENERATIONS[number];
export const STACKMAT_G5_SKINS = ['classic', 'blackout', 'black-mist', 'phantom'] as const;
export type StackmatG5Skin = typeof STACKMAT_G5_SKINS[number];
export const STACKMAT_G5_SKIN_LABELS = {
  classic: { zh: '原版', en: 'Original' },
  blackout: { zh: 'Blackout', en: 'Blackout' },
  'black-mist': { zh: 'Black Mist', en: 'Black Mist' },
  phantom: { zh: 'Phantom', en: 'Phantom' },
};
export const STACKMAT_PAD_HOLD_MS = 550;
export type StackmatInputMode = 'normal' | '2-pad' | '4-pad';
export const normalizeStackmatSkin = (value: unknown): StackmatG5Skin =>
  STACKMAT_G5_SKINS.find(skin => skin === value) ?? 'classic';
export const normalizeStackmatInput = (value: unknown): StackmatInputMode =>
  value === '2-pad' || value === '4-pad' ? value : 'normal';
export function usesStackmatPads(settings: { timerDisplayMode: string; stackmatInputMode: StackmatInputMode }) {
  return settings.timerDisplayMode === 'stackmat-g5' && settings.stackmatInputMode !== 'normal';
}
