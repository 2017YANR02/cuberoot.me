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
import { exportTimerCstimerJson } from '@cuberoot/shared/timer';
import { generateNativePuzzleScramble } from '@cuberoot/puzzle-solvers/native-puzzles';

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
  it('keeps the legacy null versus empty-session contract', () => {
    for (const text of ['{', 'null', '[]', '{}', '{"other":[]}']) {
      expect(importCstimerJson(text)).toBeNull();
    }
    expect(importCstimerJson('{"session1":[]}')).toEqual({});
    expect(importCstimerJson('{"session1":"["}')).toEqual({});
  });

  it.each([['333ble', '333bld'], ['4ni', '444bld'], ['5ni', '555bld']] as const)(
    'preserves the legacy %s alias in both import APIs', (scrType, event) => {
      const text = JSON.stringify({
        session1: JSON.stringify([[[0, 12_340], 'R U', '', 1_700_000_000]]),
        properties: { sessionData: JSON.stringify({ 1: { opt: { scrType } } }) },
      });
      expect(parseCstimerExport(text)[0].event).toBe(event);
      expect(importCstimerJson(text)?.[event]?.[0].event).toBe(event);
    },
  );

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

describe('Pyraminx Duo csTimer compatibility', () => {
  it('uses csTimer manual input and restores renamed sessions from original-event metadata', () => {
    const solve = {
      id: 'duo-solve', event: 'pyraminx_duo' as const, timeMs: 4_321,
      scramble: "R U' L B", penalty: '+2' as const, ts: 1_700_000_000_000, comment: 'practice',
    };
    const exported = exportTimerCstimerJson({ pyraminx_duo: [solve] });
    const outer = JSON.parse(exported.json);
    const metadata = JSON.parse(outer.properties.sessionData);
    expect(metadata['1']).toMatchObject({
      opt: { scrType: 'input' }, cuberootEvent: 'pyraminx_duo',
    });
    metadata['1'].name = 'Morning practice';
    outer.properties.sessionData = JSON.stringify(metadata);
    const renamed = JSON.stringify(outer);
    const session = parseCstimerExport(renamed)[0];
    expect(session.event).toBe('pyraminx_duo');
    expect(session.solves).toHaveLength(1);
    expect(session.solves[0]).toMatchObject({
      event: solve.event, timeMs: solve.timeMs, scramble: solve.scramble,
      penalty: solve.penalty, ts: solve.ts, comment: solve.comment,
    });
    const merged = importCstimerJson(renamed)?.pyraminx_duo;
    expect(merged).toHaveLength(1);
    expect(merged?.[0]).toMatchObject({ ...solve, id: expect.any(String) });
  });

  it.each(['pyraminx_duo', 'Pyraminx Duo', 'duo', '二重奏魔方', 'Session: Pyraminx Duo', 'Pyraminx-Duo practice'])(
    'recognizes %s without treating the full name as ordinary Pyraminx', (name) => {
      const exported = JSON.stringify({
        session1: JSON.stringify([[[0, 4_321], "R U'", '', 1_700_000_000]]),
        properties: { sessionData: JSON.stringify({
          1: { name, opt: { scrType: 'input' } },
        }) },
      });
      expect(parseCstimerExport(exported)[0].event).toBe('pyraminx_duo');
    },
  );

  it('does not override an explicitly different scramble type with stale Duo metadata', () => {
    const exported = JSON.stringify({
      session1: JSON.stringify([[[0, 4_321], 'R U', '', 1_700_000_000]]),
      properties: { sessionData: JSON.stringify({
        1: { name: 'Practice', opt: { scrType: 'pyram' }, cuberootEvent: 'pyraminx_duo' },
      }) },
    });
    expect(parseCstimerExport(exported)[0].event).toBe('pyra');
  });
});

describe.each([
  { event: 'superz', nameEn: 'SuperZ (2×2 + Skewb)', nameZh: '二阶＋斜转' },
  { event: 'dogic', nameEn: 'Dogic', nameZh: 'Dogic 二十面体' },
  { event: 'octahedron4', nameEn: '4×4 Octahedron', nameZh: '四阶八面体' },
  { event: 'dinoskewb', nameEn: 'Dino Skewb', nameZh: '恐龙斜转' },
  { event: 'cube3dino', nameEn: '3×3 + Dino', nameZh: '三阶＋恐龙' },
  { event: 'lattice', nameEn: 'Lattice Cube', nameZh: 'Lattice' },
  { event: 'hyperx', nameEn: 'Hyper X', nameZh: 'Hyper X' },
  { event: 'latticex', nameEn: 'Lattice X', nameZh: 'Lattice X' },
  { event: 'masterbrilic', nameEn: 'Master Brilic', nameZh: 'Master Brilic' },
  { event: 'masterftov2', nameEn: 'Master FTO v2', nameZh: '四阶 FTO v2' },
] as const)('$event csTimer compatibility', ({ event, nameEn, nameZh }) => {
  it('preserves renamed sessions and mixed native notation through both import APIs', () => {
    const solve = {
      id: `${event}-solve`, event, timeMs: 8_765,
      scramble: generateNativePuzzleScramble(event, () => 0.375), penalty: '+2' as const, ts: 1_700_000_000_000,
    };
    const outer = JSON.parse(exportTimerCstimerJson({ [event]: [solve] }).json);
    const metadata = JSON.parse(outer.properties.sessionData);
    expect(metadata['1']).toMatchObject({ opt: { scrType: 'input' }, cuberootEvent: event });
    metadata['1'].name = 'Morning practice';
    outer.properties.sessionData = JSON.stringify(metadata);
    const renamed = JSON.stringify(outer);
    expect(parseCstimerExport(renamed)).toMatchObject([{
      event, name: 'Morning practice', matched: true,
      solves: [{ ...solve, id: expect.any(String) }],
    }]);
    expect(importCstimerJson(renamed)).toMatchObject({
      [event]: [{ ...solve, id: expect.any(String) }],
    });
  });

  it.each([event, nameEn, nameZh, `Session: ${nameEn}`])(
    'recognizes the manual-input session name %s', (name) => {
      const raw = JSON.stringify({
        session1: JSON.stringify([[[0, 8_765], generateNativePuzzleScramble(event, () => 0.375), '', 1_700_000_000]]),
        properties: { sessionData: JSON.stringify({ 1: { name, opt: { scrType: 'input' } } }) },
      });
      expect(parseCstimerExport(raw)[0]).toMatchObject({ event, matched: true });
    },
  );

  it('retains an explicitly different scramble type despite stale native-puzzle metadata', () => {
    const [scrType, importedEvent] = event === 'dinoskewb' ? ['skbso', 'skewb']
      : event === 'octahedron4' ? ['444', '444'] : ['333', '333'];
    const raw = JSON.stringify({
      session1: JSON.stringify([[[0, 8_765], 'R U', '', 1_700_000_000]]),
      properties: { sessionData: JSON.stringify({
        1: { name: 'Practice', opt: { scrType }, cuberootEvent: event },
      }) },
    });
    expect(parseCstimerExport(raw)[0].event).toBe(importedEvent);
  });
});

describe('3×3 + Dino csTimer session names', () => {
  it.each([
    '3Dino', 'Session: cube3dino', '3x3 + Dino practice', 'Session: 3×3 ＋ Dino', '练习：三阶＋恐龙',
    'Session_3x3 + Dino', '3x3 + Dino_Practice',
  ])(
    'recognizes %s before considering ordinary 3x3 tokens', (name) => {
      const raw = JSON.stringify({
        session1: [[[0, 8_765], "R UFR' 2F DRFw", '', 1_700_000_000]],
        properties: { sessionData: { 1: { name, opt: { scrType: 'input' } } } },
      });
      expect(parseCstimerExport(raw)[0]).toMatchObject({ event: 'cube3dino', matched: true });
      const byEvent = importCstimerJson(raw);
      expect(byEvent?.cube3dino?.[0].event).toBe('cube3dino');
      expect(byEvent?.['333']).toBeUndefined();
    },
  );
});

describe('compound native csTimer session names', () => {
  it.each([
    ['Session_Lattice_Cube', 'lattice'],
    ['Hyper_X_Practice', 'hyperx'],
    ['Session_Lattice_X', 'latticex'],
    ['Lattice X_Practice', 'latticex'],
    ['Session_Master_Brilic', 'masterbrilic'],
    ['Session_Master_FTO_v2', 'masterftov2'],
    ['Master FTO v2_Practice', 'masterftov2'],
    ['练习：四阶 FTO v2', 'masterftov2'],
  ] as const)('preserves %s as %s before trying shorter event tokens', (name, event) => {
    const raw = JSON.stringify({
      session1: [[[0, 8_765], 'R', '', 1_700_000_000]],
      properties: { sessionData: { 1: { name, opt: { scrType: 'input' } } } },
    });
    expect(parseCstimerExport(raw)[0]).toMatchObject({ event, matched: true });
    expect(importCstimerJson(raw)).toMatchObject({ [event]: [{ event, scramble: 'R' }] });
  });
});

describe('Sphere Cube csTimer compatibility', () => {
  it('keeps renamed Sphere Cube and ordinary 3x3 histories separate after export and import', () => {
    const sphereSolve = {
      id: 'sphere-solve', event: 'sphere' as const, timeMs: 6_543,
      scramble: "R U2 F' L", penalty: '+2' as const, ts: 1_700_000_000_000, comment: 'practice',
    };
    const cubeSolve = { ...sphereSolve, id: 'cube-solve', event: '333' as const, timeMs: 12_345 };
    const exported = exportTimerCstimerJson({ sphere: [sphereSolve], '333': [cubeSolve] });
    expect([exported.solveCount, exported.sessionCount]).toEqual([2, 2]);
    const outer = JSON.parse(exported.json);
    const metadata = JSON.parse(outer.properties.sessionData);
    expect(metadata['2']).toMatchObject({ opt: { scrType: '333' }, cuberootEvent: 'sphere' });
    expect(metadata['1'].cuberootEvent).toBeUndefined();
    metadata['2'].name = 'Morning practice';
    outer.properties.sessionData = JSON.stringify(metadata);
    const renamed = JSON.stringify(outer);

    expect(parseCstimerExport(renamed)).toMatchObject([
      { event: '333', matched: true, solves: [{ ...cubeSolve, id: expect.any(String) }] },
      { event: 'sphere', name: 'Morning practice', matched: true, solves: [{ ...sphereSolve, id: expect.any(String) }] },
    ]);
    expect(importCstimerJson(renamed)).toEqual({
      '333': [{ ...cubeSolve, id: expect.any(String) }],
      sphere: [{ ...sphereSolve, id: expect.any(String) }],
    });
  });

  it.each(['sphere', 'Sphere Cube', '球形魔方', '球形三阶'])(
    'recognizes %s as a scramble-type alias or a manual session name', (alias) => {
      const entries = [[[0, 6_543], "R U2 F' L", '', 1_700_000_000]];
      const text = JSON.stringify({
        session1: entries,
        session2: entries,
        properties: { sessionData: {
          1: { name: 'Imported group', opt: { scrType: alias } },
          2: { name: alias, opt: { scrType: 'input' } },
        } },
      });
      expect(parseCstimerExport(text).map(({ event, matched }) => ({ event, matched }))).toEqual([
        { event: 'sphere', matched: true },
        { event: 'sphere', matched: true },
      ]);
    },
  );

  it('requires matching original-event metadata to override an explicit scramble type', () => {
    const entries = [[[0, 6_543], 'R U', '', 1_700_000_000]];
    const text = JSON.stringify({
      session1: entries,
      session2: entries,
      properties: { sessionData: {
        1: { name: 'Sphere Cube', opt: { scrType: '333' } },
        2: { name: 'Sphere Cube', opt: { scrType: '222' }, cuberootEvent: 'sphere' },
      } },
    });
    expect(parseCstimerExport(text).map(({ event }) => event)).toEqual(['333', '222']);
  });
});
