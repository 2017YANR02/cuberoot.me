import { ISO2_TO_CONTINENT, CONTINENT_RECORD_ABBR } from '../continent';
import type { RankResult, RegionRank } from './rank-client';
import type { TimerRankScope } from './settings-contract';

export interface TimerRankOfficialRow { event_id: string; attempts: number[]; average: number; live?: boolean; }
export function timerPersonalOfficialRank(rows: readonly TimerRankOfficialRow[], event: string, centis: number, type: 'single' | 'average'): RegionRank | null {
  const times = rows.filter(row => row.event_id === event && !row.live)
    .flatMap(row => type === 'single' ? row.attempts : [row.average])
    .filter(value => Number.isFinite(value) && value > 0);
  return times.length ? { rank: 1 + times.filter(value => value < centis).length, total: times.length } : null;
}

/** Existing PR → NR → CR → WR order and highest-record suppression. */
export function timerRankPills(scopes: readonly TimerRankScope[], personal: RegionRank | null, result: RankResult | null, country?: string) {
  const continent = country ? ISO2_TO_CONTINENT[country.toUpperCase()] : undefined;
  const crLabel = (continent && CONTINENT_RECORD_ABBR[continent]) || 'CR';
  const pills: { scope: TimerRankScope; label: string; data: RegionRank }[] = [];
  if (scopes.includes('PR') && personal) pills.push({ scope: 'PR', label: 'PR', data: personal });
  if (scopes.includes('NR') && result?.national) pills.push({ scope: 'NR', label: 'NR', data: result.national });
  if (scopes.includes('CR') && result?.continental) pills.push({ scope: 'CR', label: crLabel, data: result.continental });
  if (scopes.includes('WR') && result?.world) pills.push({ scope: 'WR', label: 'WR', data: result.world });
  const highestRecordIndex = pills.map(({ data }) => data.rank === 1).lastIndexOf(true);
  if (highestRecordIndex > 0) pills.splice(0, highestRecordIndex);
  return pills;
}
