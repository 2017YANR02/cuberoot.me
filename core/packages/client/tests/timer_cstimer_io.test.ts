/**
 * csTimer JSON interop — REAL upstream wire format.
 *
 * The per-solve tuple csTimer writes is:
 *
 *   [[penalty, totalMs, ...phaseSplits], scramble, comment, unixSeconds]
 *
 * penalty is 0 (none) / 2000 (+2) / -1 (DNF); the time is in MILLISECONDS and
 * is the value BEFORE the penalty is applied. Upstream references (local clone
 * at D:\cube\cstimer):
 *   - src/js/lib/tdconverter.js:112-126  — writes time[0] = -1 / 2000 / 0,
 *     then fills time[1..] with millisecond values and builds the 4-tuple.
 *   - src/js/stats/stats.js:1288, src/js/stats/hugestat.js:27,
 *     src/js/tools/onlinecomp.js:294 — all read the final result as
 *     `time[0] + time[1]`, which only type-checks if [0] is the penalty.
 *
 * We used to emit and parse `[timeCs, penalty]` (reversed, centiseconds). That
 * round-tripped against ourselves but meant a genuine csTimer export imported
 * as all-zero times, and our export was unreadable by csTimer. These fixtures
 * are written in the upstream format on purpose — they are the regression
 * guard for that fix, so do NOT "fix" them to match our encoder.
 */

import { describe, it, expect } from 'vitest';
import { parseCstimerExport } from '@/app/[lang]/timer/_lib/storage/import_cstimer';
import { importCstimerJson } from '@/app/[lang]/timer/_lib/storage/import_export';

/** A minimal but genuine-shaped csTimer export: one 3x3 session, 4 solves. */
function realCstimerExport(): string {
  const session1 = [
    // plain solve — 12.34s
    [[0, 12340], "R U R' U'", '', 1_700_000_000],
    // +2 — recorded 9.87s, so it displays as 11.87
    [[2000, 9870], "F R U R' U' F'", 'lockup', 1_700_000_100],
    // DNF — csTimer keeps the recorded time alongside the -1
    [[-1, 15020], "L D L' D'", '', 1_700_000_200],
    // multi-phase (csTimer's default 4-phase 3x3): the total first, then the
    // cumulative splits back-to-front → [pen, total, +oll, +f2l, cross]
    [[0, 20000, 15000, 9000, 2000], 'U2 R2 F2', '', 1_700_000_300],
    // DNS — csTimer has no DNS code, so we write it as a DNF (-1) whose
    // comment carries a "DNS " marker; a genuine csTimer file never has this
    // and just reads as a plain DNF.
    [[-1, 0], "B2 D' L2", 'DNS arrived late', 1_700_000_400],
    [[-1, 0], "F2 U' R2", 'DNS', 1_700_000_500],
  ];

  return JSON.stringify({
    session1: JSON.stringify(session1),
    properties: {
      sessionData: JSON.stringify({
        '1': { name: '3x3', opt: { scrType: '333' }, rank: 1 },
      }),
    },
  });
}

describe('csTimer import — upstream tuple order', () => {
  it('reads [penalty, timeMs] and keeps milliseconds', () => {
    const sessions = parseCstimerExport(realCstimerExport());
    expect(sessions).toHaveLength(1);
    const s = sessions[0];
    expect(s.event).toBe('333');
    expect(s.solves).toHaveLength(6);

    expect(s.solves[0].timeMs).toBe(12340);
    expect(s.solves[0].penalty).toBe('ok');

    expect(s.solves[1].timeMs).toBe(9870);
    expect(s.solves[1].penalty).toBe('+2');
    expect(s.solves[1].comment).toBe('lockup');

    // DNF keeps its recorded time rather than collapsing to 0.
    expect(s.solves[2].timeMs).toBe(15020);
    expect(s.solves[2].penalty).toBe('DNF');
  });

  it('recovers 4-phase splits into `stages`', () => {
    const sessions = parseCstimerExport(realCstimerExport());
    const multi = sessions[0].solves[3];
    expect(multi.timeMs).toBe(20000);
    // time = [pen, 20000, 15000, 9000, 2000] → cross 2000, f2l 9000, oll 15000
    expect(multi.stages).toEqual({ cross: 2000, f2l: 9000, oll: 15000, pll: 20000 });
  });

  it('the second importer (importCstimerJson) agrees with the first', () => {
    const byEvent = importCstimerJson(realCstimerExport());
    expect(byEvent).not.toBeNull();
    const solves = byEvent!['333'];
    expect(solves.map(s => s.timeMs)).toEqual([12340, 9870, 15020, 20000, 0, 0]);
    expect(solves.map(s => s.penalty)).toEqual(['ok', '+2', 'DNF', 'ok', 'DNS', 'DNS']);
  });
});

describe('csTimer DNS marker', () => {
  it('promotes a "DNS"-marked DNF back to DNS and strips the marker', () => {
    const solves = parseCstimerExport(realCstimerExport())[0].solves;
    expect(solves[4].penalty).toBe('DNS');
    expect(solves[4].comment).toBe('arrived late');
    // Marker with no trailing note → no comment at all.
    expect(solves[5].penalty).toBe('DNS');
    expect(solves[5].comment).toBeUndefined();
  });

  it('leaves an ordinary DNF alone', () => {
    const solves = parseCstimerExport(realCstimerExport())[0].solves;
    expect(solves[2].penalty).toBe('DNF');
    expect(solves[2].comment).toBeUndefined();
  });

  it('both importers agree on the DNS rows', () => {
    const byEvent = importCstimerJson(realCstimerExport())!;
    expect(byEvent['333'].slice(4).map(s => s.comment)).toEqual(['arrived late', undefined]);
  });
});

describe('csTimer import — regression guard on the old reversed format', () => {
  it('does NOT read a plain solve as time 0', () => {
    // Under the old `[timeCs, penalty]` reading, [0, 12340] parsed as
    // cs = 0 → timeMs = 0. Every imported solve was 0.00.
    const sessions = parseCstimerExport(realCstimerExport());
    expect(sessions[0].solves[0].timeMs).not.toBe(0);
  });
});

describe('csTimer import — session structure', () => {
  it('preserves group names, empty groups, and the user-visible rank order', () => {
    const raw = JSON.stringify({
      session2: JSON.stringify([[[0, 2_000], 'R', '', 1_700_000_200]]),
      session7: JSON.stringify([]),
      session10: JSON.stringify([[[0, 10_000], 'U', '', 1_700_000_100]]),
      properties: {
        sessionData: JSON.stringify({
          '2': { name: 'Second by id', opt: { scrType: '222' }, rank: 3 },
          '7': { name: 'Empty drills', opt: { scrType: 'fto' }, rank: 1 },
          '10': { name: 'Main 3x3', opt: { scrType: '333' }, rank: 2 },
        }),
      },
    });

    const sessions = parseCstimerExport(raw);
    expect(sessions.map(session => session.sessionId)).toEqual(['7', '10', '2']);
    expect(sessions.map(session => session.name)).toEqual(['Empty drills', 'Main 3x3', 'Second by id']);
    expect(sessions.map(session => session.event)).toEqual(['fto', '333', '222']);
    expect(sessions[0].solves).toEqual([]);
  });
});
