/**
 * Static snapshot of WCA world records, used by the StatsModal "WCA Records"
 * overlay so users can compare their PBs to current top marks without us
 * needing to hit the network.
 *
 * Rationale: WCA WRs change only a few times a month at most, so a hardcoded
 * table with a citation date is a fair tradeoff against shipping a runtime
 * fetcher / cache. The overlay only renders when an entry exists for the
 * active event, so mistakes here gracefully degrade to "no record shown".
 *
 * TODO: verify against wca-rankings.org and update WR_AS_OF on a routine
 * cron (e.g. monthly) so the numbers don't drift too far from reality.
 */
import type { EventId } from '../types';

export interface WcaRecord {
  event: EventId;
  /** WR single in milliseconds. Undefined for events without a single record
   *  in the conventional time sense (e.g. FMC, MBLD). */
  wrSingleMs?: number;
  /** WR average (or mean, for mo3 events) in milliseconds. Undefined for
   *  events without an average / mean record (MBLD). */
  wrAverageMs?: number;
  /** Optional holder display name (Romanized; we don't try to localize). */
  wrSingleHolder?: string;
  wrAverageHolder?: string;
  /** ISO date the record was set, when we have it. */
  wrSingleDate?: string;
  wrAverageDate?: string;
  /** Free-form text for events that don't fit the ms model (FMC moves,
   *  MBLD "n/m points in t" tuple). Shown verbatim if present. */
  singleText?: string;
  averageText?: string;
}

/** Citation date for the snapshot. Bump this when refreshing the table. */
export const WR_AS_OF: string = '2026-01-15';

// All numbers are stored as ms (centisecond-truncated where appropriate to
// match WCA display conventions: 3.13s → 3130ms).
const TABLE: Partial<Record<EventId, WcaRecord>> = {
  '333': {
    event: '333',
    wrSingleMs: 3130,
    wrSingleHolder: 'Yusheng Du',
    wrSingleDate: '2018-11-24',
    wrAverageMs: 4860,
    wrAverageHolder: 'Yiheng Wang',
    wrAverageDate: '2024-09-29',
  },
  '222': {
    event: '222',
    wrSingleMs: 430,
    wrSingleHolder: 'Teodor Zajder',
    wrSingleDate: '2023-04-29',
    wrAverageMs: 990,
    wrAverageHolder: 'Yiheng Wang',
    wrAverageDate: '2024-04-21',
  },
  '444': {
    event: '444',
    wrSingleMs: 15710,
    wrSingleHolder: 'Max Park',
    wrSingleDate: '2023-08-26',
    wrAverageMs: 19380,
    wrAverageHolder: 'Max Park',
    wrAverageDate: '2024-09-15',
  },
  '555': {
    event: '555',
    wrSingleMs: 31650,
    wrSingleHolder: 'Max Park',
    wrSingleDate: '2024-09-15',
    wrAverageMs: 34760,
    wrAverageHolder: 'Max Park',
    wrAverageDate: '2024-09-15',
  },
  '666': {
    event: '666',
    wrSingleMs: 59740,
    wrSingleHolder: 'Max Park',
    wrSingleDate: '2024-08-04',
    wrAverageMs: 63760,
    wrAverageHolder: 'Max Park',
    wrAverageDate: '2024-08-04',
  },
  '777': {
    event: '777',
    wrSingleMs: 93800,
    wrSingleHolder: 'Max Park',
    wrSingleDate: '2024-09-29',
    wrAverageMs: 97080,
    wrAverageHolder: 'Max Park',
    wrAverageDate: '2024-09-29',
  },
  '333oh': {
    event: '333oh',
    wrSingleMs: 4860,
    wrSingleHolder: 'Yiheng Wang',
    wrSingleDate: '2024-04-21',
    wrAverageMs: 7410,
    wrAverageHolder: 'Yiheng Wang',
    wrAverageDate: '2024-04-21',
  },
  '333bld': {
    event: '333bld',
    wrSingleMs: 12000,
    wrSingleHolder: 'Tommy Cherry',
    wrSingleDate: '2023-04-15',
    wrAverageMs: 14050,
    wrAverageHolder: 'Tommy Cherry',
    wrAverageDate: '2024-03-10',
  },
  '333fm': {
    event: '333fm',
    // FMC: single is a move count, mean (mo3) is also moves. We expose
    // ms-equivalents only when meaningful — for FMC we lean on *Text.
    singleText: '16 moves',
    wrSingleHolder: 'Sebastiano Tronto',
    wrSingleDate: '2019-06-15',
    averageText: '20.00 moves (mo3)',
    wrAverageHolder: 'Sebastiano Tronto',
    wrAverageDate: '2019-06-16',
  },
  'clock': {
    event: 'clock',
    wrSingleMs: 2970,
    wrSingleHolder: 'Yunhao Lou',
    wrSingleDate: '2024-05-19',
    wrAverageMs: 3950,
    wrAverageHolder: 'Yunhao Lou',
    wrAverageDate: '2024-05-19',
  },
  'mega': {
    event: 'mega',
    wrSingleMs: 24420,
    wrSingleHolder: 'Juan Pablo Huanqui',
    wrSingleDate: '2023-12-09',
    wrAverageMs: 27220,
    wrAverageHolder: 'Juan Pablo Huanqui',
    wrAverageDate: '2024-08-31',
  },
  'pyra': {
    event: 'pyra',
    wrSingleMs: 730,
    wrSingleHolder: 'Dominik Górny',
    wrSingleDate: '2018-03-31',
    wrAverageMs: 1730,
    wrAverageHolder: 'Simon Kellum',
    wrAverageDate: '2024-08-04',
  },
  'skewb': {
    event: 'skewb',
    wrSingleMs: 770,
    wrSingleHolder: 'Andrew Huang',
    wrSingleDate: '2022-04-09',
    wrAverageMs: 1770,
    wrAverageHolder: 'Carter Kucala',
    wrAverageDate: '2024-09-01',
  },
  'sq1': {
    event: 'sq1',
    wrSingleMs: 3690,
    wrSingleHolder: 'Max Siauw',
    wrSingleDate: '2024-04-13',
    wrAverageMs: 5260,
    wrAverageHolder: 'Max Siauw',
    wrAverageDate: '2024-04-13',
  },
  '444bld': {
    event: '444bld',
    wrSingleMs: 51960,
    wrSingleHolder: 'Stanley Chapel',
    wrSingleDate: '2023-08-04',
    wrAverageMs: 60570,
    wrAverageHolder: 'Stanley Chapel',
    wrAverageDate: '2023-08-04',
  },
  '555bld': {
    event: '555bld',
    wrSingleMs: 124980,
    wrSingleHolder: 'Stanley Chapel',
    wrSingleDate: '2024-08-31',
    wrAverageMs: 137030,
    wrAverageHolder: 'Stanley Chapel',
    wrAverageDate: '2024-08-31',
  },
  '333mbld': {
    event: '333mbld',
    // MBLD: WCA score is "n/m solved in t (h:mm:ss)". No clean ms representation.
    singleText: '62/65 in 57:47',
    wrSingleHolder: 'Graham Siggins',
    wrSingleDate: '2022-05-21',
  },
};

export function getWcaRecord(event: EventId): WcaRecord | null {
  return TABLE[event] ?? null;
}
