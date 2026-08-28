const API_URL = 'https://api.cuberoot.me/v1/wca/scrambles/random?event=333&count=50';
const CACHE_KEY = 'cuberoot.mobile.real-scrambles.333.v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 50;

export interface RealScramble {
  competitionId: string;
  competitionName: string;
  eventId: string;
  groupId: string;
  roundTypeId: string;
  scramble: string;
  scrambleNumber: number;
}

interface ApiScramble {
  scramble?: unknown;
  ci?: unknown;
  cn?: unknown;
  e?: unknown;
  r?: unknown;
  g?: unknown;
  n?: unknown;
}

interface CacheEnvelope {
  fetchedAt: number;
  scrambles: RealScramble[];
}

interface LegacyCacheEnvelope {
  savedAt?: unknown;
  fetchedAt?: unknown;
  scrambles?: unknown;
}

function normalizeScramble(value: string): string {
  return value.trim().replace(/[‘’ʼ′]/g, "'");
}

function isThreeByThreeScramble(value: string): boolean {
  const moves = value.split(/\s+/);
  return moves.length >= 1
    && moves.length <= 40
    && moves.every((move) => /^[UDLRFB](?:2|')?$/.test(move));
}

function parseItem(value: ApiScramble): RealScramble | null {
  if (
    typeof value.scramble !== 'string'
    || typeof value.ci !== 'string'
    || value.e !== '333'
    || typeof value.r !== 'string'
    || typeof value.g !== 'string'
    || typeof value.n !== 'number'
    || !Number.isInteger(value.n)
    || value.n < 1
  ) return null;
  const scramble = normalizeScramble(value.scramble);
  if (!isThreeByThreeScramble(scramble)) return null;
  return {
    competitionId: value.ci,
    competitionName: typeof value.cn === 'string' && value.cn.trim() ? value.cn.trim() : value.ci,
    eventId: value.e,
    groupId: value.g,
    roundTypeId: value.r,
    scramble,
    scrambleNumber: value.n,
  };
}

export function readRealScrambleCache(
  storage: Pick<Storage, 'getItem'> = localStorage,
  now = Date.now(),
): RealScramble[] {
  try {
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LegacyCacheEnvelope;
    const fetchedAt = typeof parsed.fetchedAt === 'number' ? parsed.fetchedAt : parsed.savedAt;
    if (
      typeof fetchedAt !== 'number'
      || now - fetchedAt > CACHE_TTL_MS
      || !Array.isArray(parsed.scrambles)
    ) return [];
    return parsed.scrambles.map((item) => parseItem({
      scramble: item?.scramble,
      ci: item?.competitionId,
      cn: item?.competitionName,
      e: item?.eventId,
      r: item?.roundTypeId,
      g: item?.groupId,
      n: item?.scrambleNumber,
    })).filter((item): item is RealScramble => item !== null).slice(0, CACHE_LIMIT);
  } catch {
    return [];
  }
}

export function writeRealScrambleCache(
  scrambles: RealScramble[],
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  fetchedAt?: number,
): void {
  const unique = [...new Map(scrambles.map((item) => [item.scramble, item])).values()]
    .slice(0, CACHE_LIMIT);
  try {
    let originalFetchedAt: number | undefined;
    if (fetchedAt === undefined) {
      const raw = storage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LegacyCacheEnvelope;
        const timestamp = typeof parsed.fetchedAt === 'number' ? parsed.fetchedAt : parsed.savedAt;
        if (typeof timestamp === 'number') originalFetchedAt = timestamp;
      }
    }
    storage.setItem(CACHE_KEY, JSON.stringify({
      fetchedAt: fetchedAt ?? originalFetchedAt ?? Date.now(),
      scrambles: unique,
    } satisfies CacheEnvelope));
  } catch {
    // Storage can be unavailable or full. The in-memory pool remains usable.
  }
}

export async function fetchRealScrambles(
  fetcher: typeof fetch = fetch,
): Promise<RealScramble[]> {
  const response = await fetcher(API_URL);
  if (!response.ok) throw new Error(`real scramble request failed (${response.status})`);
  const payload = await response.json() as { scrambles?: ApiScramble[] };
  if (!Array.isArray(payload.scrambles)) throw new Error('real scramble response is invalid');
  const scrambles = payload.scrambles
    .map(parseItem)
    .filter((item): item is RealScramble => item !== null)
    .slice(0, CACHE_LIMIT);
  if (scrambles.length === 0) throw new Error('real scramble response contains no valid 3x3 rows');
  return scrambles;
}
