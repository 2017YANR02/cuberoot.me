import { ACCENT_KEY, HOME_BACKGROUND_KEY, PALETTE_KEY, normalizeAppearancePreferences, resolveHomeBackground, isHomeBackgroundChoice, type AppearancePreferences, type HomeBackgroundChoice } from '@cuberoot/shared/appearance';

export const APPEARANCE_CHANGE_EVENT = 'cuberoot:appearance-change';
const keys = {
  locale: 'trainer-lang', theme: 'theme', palette: PALETTE_KEY, contrast: 'contrast', accent: ACCENT_KEY,
  lightBackground: `${HOME_BACKGROUND_KEY}.light`, darkBackground: `${HOME_BACKGROUND_KEY}.dark`,
} as const;

/** Missing installed preferences may inherit the old timer theme/language once. */
export function readAppearancePreferences(fallback: Partial<AppearancePreferences> = {}): AppearancePreferences {
  const value: Record<string, unknown> = { ...fallback };
  for (const [field, key] of Object.entries(keys)) {
    let saved: string | null | undefined;
    try { saved = localStorage.getItem(key); } catch { /* Defaults remain usable. */ }
    if (saved !== null && saved !== undefined) value[field] = saved;
  }
  return normalizeAppearancePreferences(value);
}

/** Keep the established Web storage keys; no second drifting preference model. */
export function persistAppearancePreferences(input: AppearancePreferences): void {
  const value = normalizeAppearancePreferences(input);
  const entries: [string, string | null][] = Object.entries(keys)
    .map(([field, key]) => [key, value[field as keyof AppearancePreferences]]);
  for (const scheme of ['light', 'dark'] as const) {
    const next = value[scheme === 'light' ? 'lightBackground' : 'darkBackground'];
    const old = localStorage.getItem(`${HOME_BACKGROUND_KEY}.${scheme}`);
    const remembered = resolveHomeBackground(next, scheme) ? next
      : isHomeBackgroundChoice(old) && resolveHomeBackground(old, scheme) ? old : null;
    if (remembered) entries.push([`${HOME_BACKGROUND_KEY}.last-image.${scheme}`, remembered]);
  }
  const previous = entries.map(([key]) => [key, localStorage.getItem(key)] as const);
  try {
    for (const [key, next] of entries) {
      if (next === null) localStorage.removeItem(key);
      else localStorage.setItem(key, next);
    }
  } catch (error) {
    for (const [key, saved] of previous) {
      try { if (saved === null) localStorage.removeItem(key); else localStorage.setItem(key, saved); }
      catch { /* Preserve the original error when storage is no longer writable. */ }
    }
    throw error;
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(APPEARANCE_CHANGE_EVENT));
}

export function readRememberedAppearanceBackground(scheme: 'light' | 'dark'): HomeBackgroundChoice {
  try {
    const saved = localStorage.getItem(`${HOME_BACKGROUND_KEY}.last-image.${scheme}`);
    if (isHomeBackgroundChoice(saved) && resolveHomeBackground(saved, scheme)) return saved;
  } catch { /* The first enabled scene uses the automatic scheme default. */ }
  return 'auto';
}
