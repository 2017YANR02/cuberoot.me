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
 *   [[time_cs, penalty], scramble, comment, ts_seconds]
 *
 * Mirrors import_cstimer.ts:160-181 inversely:
 *   - DNF → time[1] === -1 (we encode the original recorded cs in time[0]
 *     so the import can recover it; import accepts either -1 or a real cs).
 *   - +2  → time[1] === 2000, time[0] === recorded cs (pre-penalty)
 *   - ok  → time[1] === 0,    time[0] === recorded cs
 */
function solveToTuple(s: Solve): [[number, number], string, string, number] {
  const cs = Math.max(0, Math.round(s.timeMs / 10));
  let pen: number;
  if (s.penalty === 'DNF') pen = -1;
  else if (s.penalty === '+2') pen = 2000;
  else pen = 0;
  return [[cs, pen], s.scramble ?? '', s.comment ?? '', Math.floor(s.ts / 1000)];
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
