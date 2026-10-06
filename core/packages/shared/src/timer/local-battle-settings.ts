export interface LocalBattlePreferences {
  layout: 'side' | 'versus'; flipTopRow: boolean; syncStart: boolean;
  precision: 0 | 1 | 2 | 3; inspectionSec: number; holdMs: number;
  showImage: boolean; hideTime: boolean; scrambleScale: number;
  bgOpacity: number; bgColors: string[]; bgImages: (string | null)[];
}
export const LOCAL_BATTLE_PRECISIONS = [0, 1, 2, 3] as const;
export const LOCAL_BATTLE_INSPECTIONS = [0, 8, 15, 9999] as const;
export const LOCAL_BATTLE_BG_MAX_BYTES = 4 * 1024 * 1024;
export function defaultLocalBattlePreferences(): LocalBattlePreferences {
  return { layout: 'versus', flipTopRow: true, syncStart: false, precision: 3, inspectionSec: 0, holdMs: 300,
    showImage: true, hideTime: false, scrambleScale: 1, bgOpacity: 1, bgColors: ['', '', '', ''], bgImages: [null, null, null, null] };
}
const keys = { layout: 'layout', flipTopRow: 'flipTopRow', syncStart: 'syncStart', precision: 'timerPrecision', inspectionSec: 'inspectionTime', holdMs: 'startDelay', showImage: 'showImage', scrambleScale: 'scrambleScale', bgOpacity: 'bgOpacity' } as const;
export function readLocalBattlePreferences(storage: { getItem(key: string): string | null }): LocalBattlePreferences {
  const defaults = defaultLocalBattlePreferences();
  const get = (key: string) => storage.getItem(`battle_${key}`);
  const num = (key: string, fallback: number, min: number, max: number) => {
    const raw = get(key), value = raw === null ? fallback : Number(raw);
    return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
  };
  const precision = num('timerPrecision', 3, 0, 3);
  const inspectionSec = num('inspectionTime', 0, 0, 9999);
  return { ...defaults, layout: get('layout') === 'side' ? 'side' : 'versus',
    flipTopRow: get('flipTopRow') !== 'false', syncStart: get('syncStart') === 'true',
    precision: LOCAL_BATTLE_PRECISIONS.includes(precision as 0) ? precision as 0 | 1 | 2 | 3 : 3,
    inspectionSec: LOCAL_BATTLE_INSPECTIONS.includes(inspectionSec as 0) ? inspectionSec : 0,
    holdMs: num('startDelay', 300, 0, 1000), showImage: get('showImage') !== 'false', hideTime: get('showTime') === 'false',
    scrambleScale: num('scrambleScale', 1, .5, 2), bgOpacity: num('bgOpacity', 1, .1, 1),
    bgColors: defaults.bgColors.map((_, i) => { const color = get(`bg_color_${i}`); return color && /^#[0-9a-f]{6}$/i.test(color) ? color : ''; }),
    bgImages: defaults.bgImages.map((_, i) => { const image = get(`bg_img_${i}`); return image?.startsWith('data:image/') ? image : null; }),
  };
}
export function saveLocalBattlePreferences(storage: { setItem(key: string, value: string): void }, value: LocalBattlePreferences): void {
  for (const [field, key] of Object.entries(keys)) storage.setItem(`battle_${key}`, String(value[field as keyof typeof keys]));
  storage.setItem('battle_showTime', String(!value.hideTime));
  for (let i = 0; i < 4; i++) {
    storage.setItem(`battle_bg_color_${i}`, value.bgColors[i] ?? '');
    storage.setItem(`battle_bg_img_${i}`, value.bgImages[i] ?? '');
  }
}
