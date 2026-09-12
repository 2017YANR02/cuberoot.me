/** Persistent presentation overrides keyed by stable asset IDs, never array positions. */
export interface DeskPetEntry {
  id: string;
  locked: boolean;
  removed: boolean;
  label?: { en: string; zh: string };
}
export interface DeskPetCatalog {
  revision: number;
  entries: DeskPetEntry[];
}
export const DEFAULT_OPEN_PETS: readonly string[] = ['rootbeast', 'clawd', 'calico', 'cloudling'];

export function isDeskPetCatalog(value: unknown): value is DeskPetCatalog {
  if (!value || typeof value !== 'object') return false;
  const { revision, entries } = value as DeskPetCatalog;
  return Number.isSafeInteger(revision) && revision >= 0 && Array.isArray(entries) && entries.length <= 500
    && new Set(entries.map(e => e?.id)).size === entries.length
    && entries.every(e => e && typeof e.id === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(e.id)
      && typeof e.locked === 'boolean' && typeof e.removed === 'boolean'
      && (e.label === undefined || (e.label && ['en', 'zh'].every(lang => {
        const text = e.label?.[lang as 'en' | 'zh'];
        return typeof text === 'string' && text.trim().length > 0 && text.length <= 80;
      }))));
}

/** New assets appear locked; deleted asset IDs cannot create phantom pets. */
export function resolveDeskPets(ids: readonly string[], entries: readonly DeskPetEntry[]): DeskPetEntry[] {
  const available = new Set(ids);
  const saved = new Set(entries.map(e => e.id));
  return [...entries.filter(e => available.has(e.id)), ...ids.filter(id => !saved.has(id)).map(id => ({
    id, locked: !DEFAULT_OPEN_PETS.includes(id), removed: false,
  }))];
}
