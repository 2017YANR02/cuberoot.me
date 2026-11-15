/** Recon imports the same REST round as the competition page. */
import { fetchCubingLiveRound } from './cubing_source.js';
import { fetchCubingMeta } from './cubing_live.js';

/** Seconds for timed events; FMC and multi-blind keep their event-specific encoding. */
export async function fetchCubingAttempts(slug: string, event: string, round: string, personId: string): Promise<(number | null)[] | null> {
  const meta = await fetchCubingMeta(slug);
  const rounds = meta.events.find(entry => entry.i === event)?.rs ?? [];
  // Legacy combined-final / semi-final codes refer to the same numbered rounds.
  const code = ({ c: 'f', b: 'f', d: '1', e: '2', g: '3' } as Record<string, string>)[round] ?? round;
  const target = rounds.find(entry => entry.i === code)
    ?? (code === 'f' ? rounds.at(-1) : rounds.find(entry => entry.liveId === code));
  if (!target) return null;
  const snapshot = await fetchCubingLiveRound(slug, event, Number(target.liveId), target.i, undefined, true);
  const user = Object.values(snapshot.users).find(entry => entry.wcaid === personId);
  const row = user && snapshot.results.find(entry => entry.n === user.number);
  if (!row) return null;
  return row.v.map(value => value === 0 ? null : value < 0 || event === '333fm' || event === '333mbf' ? value : value / 100);
}
