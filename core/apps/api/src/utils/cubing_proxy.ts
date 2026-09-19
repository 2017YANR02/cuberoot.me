/** Recon imports the same REST round as the competition page. */
import { fetchCubingLiveRound } from '@cuberoot/shared/cubing-live';
import { fetchCubingMeta } from './cubing_live.js';

const roundCache = new Map<string, { expiresAt: number; data: Awaited<ReturnType<typeof fetchCubingLiveRound>> }>();

/** Seconds for timed events; FMC and multi-blind keep their event-specific encoding. */
export async function fetchCubingAttempts(slug: string, event: string, round: string, personId: string): Promise<(number | null)[] | null> {
  const key = [slug, event, round].join('|');
  let data = roundCache.get(key);
  if (!data || data.expiresAt <= Date.now()) {
    const meta = await fetchCubingMeta(slug);
    const rounds = meta.events.find(entry => entry.i === event)?.rs ?? [];
    // Legacy combined-final / semi-final codes refer to the same numbered rounds.
    const code = ({ c: 'f', b: 'f', d: '1', e: '2', g: '3' } as Record<string, string>)[round] ?? round;
    const target = rounds.find(entry => entry.i === code)
      ?? (code === 'f' ? rounds.at(-1) : rounds.find(entry => entry.liveId === code));
    if (!target) return null;
    const snapshot = await fetchCubingLiveRound(slug, event, Number(target.liveId), target.i);
    data = { data: snapshot, expiresAt: Date.now() + 15_000 };
    for (const [cacheKey, value] of roundCache) if (value.expiresAt <= Date.now()) roundCache.delete(cacheKey);
    roundCache.set(key, data);
  }
  const user = Object.values(data.data.users).find(entry => entry.wcaid === personId);
  const row = user && data.data.results.find(entry => entry.n === user.number);
  if (!row) return null;
  return row.v.map(value => value === 0 ? null : value < 0 || event === '333fm' || event === '333mbf' ? value : value / 100);
}
