import { ISO2_TO_CR } from './record_format.js';
import { COUNTRY_EN_MAP } from '../monitors/region.js';
import { compResultHref } from '@cuberoot/shared/wca-comp-link';
import type { CompData } from '../routes/cubing_live.js';

export interface RecordResultTarget {
  eventId: string;
  roundId?: string;
  roundNumber?: number | null;
  personWcaId?: string | null;
  personName: string;
  type: string;
  value: number;
}

/** Resolve against the same source as the page; upstream person IDs are not site numbers. */
export function recordResultHref(data: CompData, target: RecordResultTarget): string {
  const rounds = data.events.find(e => e.i === target.eventId)?.rs ?? [];
  const roundId = target.roundNumber != null
    ? rounds[target.roundNumber - 1]?.i : target.roundId;
  if (!roundId) throw new Error('Record round is not available yet');
  const matches = (data.resultsByRound[`${target.eventId}:${roundId}`] ?? []).filter(row => {
    const person = data.users[String(row.n)];
    return person && (target.personWcaId ? person.wcaid === target.personWcaId : person.name === target.personName)
      && (target.type === 'average' ? row.a === target.value : row.b === target.value || row.v.includes(target.value));
  });
  if (matches.length !== 1) throw new Error('Record result is not uniquely available yet');
  return compResultHref(data.slug, { eventId: target.eventId, roundId, number: matches[0].n });
}

/** Only earlier rounds establish order; never infer a tie from the current snapshot itself. */
export function tiedInEarlierRound(data: CompData, target: RecordResultTarget, tag: string, iso2: string): boolean {
  const rounds = data.events.find(e => e.i === target.eventId)?.rs ?? [];
  const index = target.roundNumber != null ? target.roundNumber - 1 : rounds.findIndex(r => r.i === target.roundId);
  const values: number[] = [];
  for (const round of rounds.slice(0, Math.max(0, index))) {
    for (const row of data.resultsByRound[`${target.eventId}:${round.i}`] ?? []) {
      const person = data.users[String(row.n)];
      if (!person) continue;
      const country = (COUNTRY_EN_MAP[person.region] || person.region).toUpperCase();
      const sameScope = tag === 'WR' || (tag === 'FWR' ? data.membersByFilter.females.includes(row.n)
        : tag === 'NR' ? country === iso2.toUpperCase()
        : tag === 'PR' ? (target.personWcaId ? person.wcaid === target.personWcaId : person.name === target.personName)
        : !!ISO2_TO_CR[country] && ISO2_TO_CR[country] === ISO2_TO_CR[iso2.toUpperCase()]);
      if (!sameScope) continue;
      const value = target.type === 'average' ? row.a : row.b;
      if (value > 0) values.push(value);
    }
  }
  return values.length > 0 && values.reduce((best, value) => Math.min(best, value), Infinity) === target.value;
}
