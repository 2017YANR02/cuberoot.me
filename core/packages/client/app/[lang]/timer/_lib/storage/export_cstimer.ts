/**
 * csTimer JSON exporter — symmetric inverse of `import_cstimer.ts`.
 *
 * Builds the cstimer "Local backup → Export" shape from our flat per-event
 * solve store: one cstimer session per non-empty event. The output is
 * round-trip-compatible with `parseCstimerExport`.
 */

import type { EventId, Solve } from '../types';
import { EVENTS, eventInfo } from '../types';
import { loadAll } from './db';

/**
 * Inverse of `CSTIMER_EVENT_MAP` in import_cstimer.ts. We pick a single
 * canonical cstimer scrType per EventId (cstimer accepts our '333',
 * 'pyram' for pyra, etc.).
 */
const EVENT_TO_CSTIMER_SCRTYPE: Record<EventId, string> = {
  '222': '222',
  '333': '333',
  '444': '444',
  '555': '555',
  '666': '666',
  '777': '777',
  '333oh': '333oh',
  '333fm': '333fm',
  '333bld': '333bld',
  '333mbld': '333mbld',
  '333ni': '333ni',
  '333mr': 'mirblocks',
  '444bld': '444bld',
  '555bld': '555bld',
  '666bld': '666bld',
  '777bld': '777bld',
  pyra: 'pyram',
  skewb: 'skbso',
  sq1: 'sq1',
  mega: 'megamx',
  clock: 'clkwca',
  magic: 'magic',
  mmagic: 'mmagic',
  r3: 'r3',
  r4: 'r4',
  r5: 'r5',
  cross: 'cross',
  f2l: 'f2l',
  ll: 'll',
  oll: 'ollt',
  pll: 'pllt',
  coll: 'collt',
  cmll: 'cmll',
  zbll: 'zbllt',
  eg1: 'eg1',
  eg2: 'eg2',
  // cstimer has no native "custom" scramble type — fall back to 333; the
  // user's hand-typed scrambles are preserved verbatim either way.
  custom: '333',
};

/**
 * Convert one of our Solves to a cstimer per-solve tuple:
 *   [[penalty, time_ms], scramble, comment, ts_seconds]
 *
 * The penalty comes FIRST and the time is in MILLISECONDS — verified against
 * upstream csTimer, which writes the tuple in lib/tdconverter.js:112-126 and
 * reads the final result as `time[0] + time[1]` in stats/stats.js:1288,
 * stats/hugestat.js:27 and tools/onlinecomp.js:294. (We previously emitted
 * `[time_cs, penalty]`, which round-tripped against our own importer but was
 * unreadable by real csTimer, and made real csTimer files import as all-zero.)
 *
 *   - DNF → penalty -1, time_ms = the recorded time (csTimer keeps it)
 *   - +2  → penalty 2000, time_ms = recorded time BEFORE the penalty
 *   - ok  → penalty 0
 */
function solveToTuple(s: Solve): [[number, number], string, string, number] {
  const ms = Math.max(0, Math.round(s.timeMs));
  let pen: number;
  if (s.penalty === 'DNF') pen = -1;
  else if (s.penalty === '+2') pen = 2000;
  else pen = 0;
  return [[pen, ms], s.scramble ?? '', s.comment ?? '', Math.floor(s.ts / 1000)];
}

interface ExportResult {
  json: string;
  solveCount: number;
  sessionCount: number;
}

/**
 * Build a cstimer-shaped JSON string from all stored solves. One cstimer
 * session per non-empty event; empty events are skipped.
 */
export async function exportCstimerJson(): Promise<ExportResult> {
  const byEvent = loadAll();

  // Stable ordering: follow EVENTS list (WCA first, then BLD, etc.) so
  // session ids are deterministic across exports.
  const sessionsToEmit: Array<{ event: EventId; solves: Solve[] }> = [];
  for (const e of EVENTS) {
    const arr = byEvent[e.id];
    if (!arr || arr.length === 0) continue;
    sessionsToEmit.push({ event: e.id, solves: arr });
  }

  const outer: Record<string, unknown> = {};
  const sessionData: Record<string, { name: string; opt: { scrType: string }; rank: number }> = {};

  let totalSolves = 0;
  sessionsToEmit.forEach((entry, idx) => {
    const sid = String(idx + 1);
    const tuples = entry.solves.map(solveToTuple);
    outer['session' + sid] = JSON.stringify(tuples);
    const info = eventInfo(entry.event);
    sessionData[sid] = {
      name: info.nameEn,
      opt: { scrType: EVENT_TO_CSTIMER_SCRTYPE[entry.event] },
      rank: idx + 1,
    };
    totalSolves += entry.solves.length;
  });

  outer['properties'] = {
    sessionData: JSON.stringify(sessionData),
  };

  return {
    json: JSON.stringify(outer),
    solveCount: totalSolves,
    sessionCount: sessionsToEmit.length,
  };
}
