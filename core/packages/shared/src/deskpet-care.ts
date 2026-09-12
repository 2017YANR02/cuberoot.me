/** Forgiving pet care. Each character has an independent record. */
export const PET_CARE_KEY = 'cuberoot-pet-care-v1';
export const CARE_ACTIONS = ['feed', 'pet', 'play', 'rest'] as const;
export type CareAction = typeof CARE_ACTIONS[number];
export interface PetCare {
  updatedAt: number;
  food: number;
  mood: number;
  energy: number;
  bond: number;
  rewardDay: string;
  rewarded: CareAction[];
  lastAction: Partial<Record<CareAction, number>>;
}
export type CareBook = Record<string, PetCare>;
const COOLDOWN: Record<CareAction, number> = { feed: 60_000, pet: 5_000, play: 15_000, rest: 30_000 };
const HOUR = 3_600_000;
const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
// One UTC day boundary for server awards and every browser, independent of device timezone.
export function careDay(now: number): string {
  const date = new Date(now);
  return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
}
export function createPetCare(now: number): PetCare {
  return { updatedAt: now, food: 70, mood: 75, energy: 80, bond: 0, rewardDay: careDay(now), rewarded: [], lastAction: {} };
}

// Boundaries: malformed records are isolated; unknown pets/actions are discarded;
// numeric values are finite and bounded; future timestamps cannot lock actions.
export function readCareBook(raw: string | null, ids: readonly string[], now: number): CareBook {
  let parsed: unknown;
  try { parsed = JSON.parse(raw ?? 'null'); } catch { return {}; }
  if (!parsed || typeof parsed !== 'object' || !('version' in parsed) || parsed.version !== 1 ||
    !('pets' in parsed) || !parsed.pets || typeof parsed.pets !== 'object') return {};
  const pets = parsed.pets as Record<string, unknown>;
  const result: CareBook = {};
  for (const id of ids) {
    const value = pets[id];
    if (!value || typeof value !== 'object') continue;
    const p = value as Partial<PetCare>;
    if (![p.updatedAt, p.food, p.mood, p.energy, p.bond].every(finite)) continue;
    const lastAction: PetCare['lastAction'] = {};
    for (const action of CARE_ACTIONS) {
      const at = p.lastAction?.[action];
      if (finite(at) && at >= 0 && at <= now) lastAction[action] = at;
    }
    result[id] = {
      updatedAt: clamp(p.updatedAt!, 0, now), food: clamp(p.food!), mood: clamp(p.mood!), energy: clamp(p.energy!),
      bond: Math.floor(clamp(p.bond!, 0, 1_000_000)),
      rewardDay: typeof p.rewardDay === 'string' ? p.rewardDay : careDay(now),
      rewarded: CARE_ACTIONS.filter(action => Array.isArray(p.rewarded) && p.rewarded.includes(action)), lastAction,
    };
  }
  return result;
}
export function serializeCareBook(pets: CareBook): string {
  return JSON.stringify({ version: 1, pets });
}
export function currentCare(pet: PetCare, now: number): PetCare {
  // No death, lost bond, or return penalty below 25. Rest recovers naturally offline.
  const hours = clamp((now - pet.updatedAt) / HOUR, 0, 24);
  const day = careDay(now);
  return { ...pet, updatedAt: now,
    food: Math.max(25, pet.food - hours * 3), mood: Math.max(25, pet.mood - hours * 2),
    energy: clamp(pet.energy + hours * 8),
    rewardDay: day, rewarded: day === pet.rewardDay ? pet.rewarded : [],
  };
}
export function careWait(pet: PetCare, action: CareAction, now: number): number {
  const at = pet.lastAction[action];
  return at === undefined || at > now ? 0 : Math.max(0, COOLDOWN[action] - (now - at));
}
export function careFor(pet: PetCare, action: CareAction, now: number): { pet: PetCare; accepted: boolean; gained: boolean } {
  const next = currentCare(pet, now);
  if (careWait(next, action, now) > 0 || (action === 'play' && next.energy < 15)) {
    return { pet: next, accepted: false, gained: false };
  }
  if (action === 'feed') next.food = clamp(next.food + 25);
  if (action === 'pet') next.mood = clamp(next.mood + 18);
  if (action === 'play') { next.mood = clamp(next.mood + 25); next.energy = clamp(next.energy - 12); }
  if (action === 'rest') next.energy = clamp(next.energy + 20);
  const gained = !next.rewarded.includes(action);
  if (gained) { next.bond = Math.min(1_000_000, next.bond + 1); next.rewarded = [...next.rewarded, action]; }
  next.lastAction = { ...next.lastAction, [action]: now };
  return { pet: next, accepted: true, gained };
}
export const BOND_STAGES = [
  { at: 0, label: { zh: '初次见面', en: 'Just met' } },
  { at: 4, label: { zh: '熟悉彼此', en: 'Getting close' } },
  { at: 12, label: { zh: '好朋友', en: 'Good friends' } },
  { at: 28, label: { zh: '形影不离', en: 'Best friends' } },
] as const;

/** Earned care is permanent. One star per level, four stars per moon, four moons per sun. */
export function petLevel(bond: number) {
  const xp = Number.isFinite(bond) ? Math.max(0, Math.floor(bond)) : 0;
  const threshold = (level: number) => (level - 1) * (level + 2);
  let level = 1;
  while (level < 64 && xp >= threshold(level + 1)) level++;
  const start = threshold(level), next = level < 64 ? threshold(level + 1) : null;
  return { level, xp, start, next, progress: next === null ? 1 : (xp - start) / (next - start),
    suns: Math.floor(level / 16), moons: Math.floor(level % 16 / 4), stars: level % 4 };
}
