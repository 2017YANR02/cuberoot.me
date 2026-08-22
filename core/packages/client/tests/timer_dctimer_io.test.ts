import initSqlJs from 'sql.js/dist/sql-asm-memory-growth.js';
import { describe, expect, it } from 'vitest';
import {
  isDctimerDatabase,
  parseDctimerExport,
} from '@/app/[lang]/timer/_lib/storage/import_dctimer';
import { planTimerImport } from '@/app/[lang]/timer/_lib/storage/import_timer';

async function sqliteFixture(schemaAndData: string): Promise<Uint8Array> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  try {
    db.run(schemaAndData);
    return db.export();
  } finally {
    db.close();
  }
}

describe('dcTimer Android database import', () => {
  it('preserves group order, names, penalties, phases, moves, and empty groups', async () => {
    const bytes = await sqliteFixture(`
      CREATE TABLE sessiontb(id integer not null, name text, type integer, mulp integer, ra integer, sorting integer);
      CREATE TABLE resulttb(id integer not null, rest integer not null, resp integer not null, resd integer not null, scr text not null, time text, note text, p1 integer, p2 integer, p3 integer, p4 integer, p5 integer, p6 integer, moves text);
      CREATE TABLE result2(id integer not null, rest integer not null, resp integer not null, resd integer not null, scr text not null, time text, note text, p1 integer, p2 integer, p3 integer, p4 integer, p5 integer, p6 integer, moves text);
      CREATE TABLE result3(id integer not null, rest integer not null, resp integer not null, resd integer not null, scr text not null, time text, note text, p1 integer, p2 integer, p3 integer, p4 integer, p5 integer, p6 integer, moves text);
      CREATE TABLE result15(id integer not null, rest integer not null, resp integer not null, resd integer not null, scr text not null, time text, note text, p1 integer, p2 integer, p3 integer, p4 integer, p5 integer, p6 integer, moves text);
      CREATE TABLE resultstb(id integer not null, sid integer not null, rest integer not null, resp integer not null, resd integer not null, scr text, time text, note text, p1 integer, p2 integer, p3 integer, p4 integer, p5 integer, p6 integer, moves text);

      INSERT INTO sessiontb VALUES(15, 'FTO drills', 517, 0, 8011, 1);
      INSERT INTO sessiontb VALUES(0, 'Main 3x3', 33, 3, 8011, 2);
      INSERT INTO sessiontb VALUES(1, '', -27, 0, 8011, 3);
      INSERT INTO sessiontb VALUES(14, 'Empty Pyraminx', 224, 0, 8011, 4);
      INSERT INTO sessiontb VALUES(2, 'Mystery puzzle', 999, 0, 8011, 5);

      INSERT INTO resultstb VALUES(20, 15, 7000, 0, 1, 'U R U''', '2024-01-01 09:00:00', '', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
      INSERT INTO resulttb VALUES(1, 12340, 0, 1, 'R U R''', '2024-01-02 10:00:00', 'first', 2000, 4000, 5000, 1340, NULL, NULL, 'R U R''');
      INSERT INTO resulttb VALUES(2, 9870, 1, 1, 'F2', '2024-01-02 10:01:00', '', 1000, 2000, 3000, 3870, NULL, NULL, NULL);
      INSERT INTO resulttb VALUES(3, 15020, 0, 0, 'L2', '2024-01-02 10:02:00', '', 2000, 4000, 5000, 4020, NULL, NULL, NULL);
      INSERT INTO result2 VALUES(4, 11000, 0, 1, 'B2', '2024-01-03 11:00:00', '', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
      INSERT INTO result3 VALUES(5, 5000, 0, 1, 'D2', '2024-01-04 12:00:00', '', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
    `);

    expect(isDctimerDatabase(bytes)).toBe(true);
    const sessions = await parseDctimerExport(bytes);

    expect(sessions.map((session) => session.sessionId)).toEqual(['15', '0', '1', '14', '2']);
    expect(sessions.map((session) => session.name)).toEqual([
      'FTO drills',
      'Main 3x3',
      'Session 2',
      'Empty Pyraminx',
      'Mystery puzzle',
    ]);
    expect(sessions.map((session) => session.event)).toEqual(['fto', '333', '333oh', 'pyra', '333']);
    expect(sessions.map((session) => session.matched)).toEqual([true, true, true, true, false]);
    expect(sessions[3]!.solves).toEqual([]);

    const solves = sessions[1]!.solves;
    expect(solves.map((solve) => solve.timeMs)).toEqual([12340, 9870, 15020]);
    expect(solves.map((solve) => solve.penalty)).toEqual(['ok', '+2', 'DNF']);
    expect(solves[0]!.comment).toBe('first');
    expect(solves[0]!.stages).toEqual({ cross: 2000, f2l: 6000, oll: 11000, pll: 12340 });
    expect(solves[0]!.reconstruction).toEqual(["R U R'"]);
    expect(solves[0]!.ts).toBe(new Date(2024, 0, 2, 10, 0, 0).getTime());
  });

  it('accepts the pre-resd result column aliases', async () => {
    const bytes = await sqliteFixture(`
      CREATE TABLE sessiontb(id integer not null, name text, type integer, mulp integer, ra integer, sorting integer);
      CREATE TABLE resultstb(id integer not null, sid integer not null, result integer not null, penalty integer not null, scramble text, time text, note text);
      INSERT INTO sessiontb VALUES(15, 'Legacy', 32, 0, 8011, 1);
      INSERT INTO resultstb VALUES(1, 15, 8123, 2, 'R2', '2020-05-06 07:08:09', 'old row');
    `);

    const sessions = await parseDctimerExport(bytes);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.event).toBe('333');
    expect(sessions[0]!.solves[0]).toMatchObject({
      timeMs: 8123,
      penalty: 'DNF',
      scramble: 'R2',
      comment: 'old row',
    });
  });
});

describe('dcTimer legacy iOS database import', () => {
  it('synthesizes the default group and retains custom and orphan sessions', async () => {
    const bytes = await sqliteFixture(`
      CREATE TABLE sessiontb(rowid integer, name text);
      CREATE TABLE resulttb(id integer, sesid integer, rest integer, resp integer, scr text, date text, note text);
      CREATE TABLE scrtypetb(sesid integer, type integer);
      INSERT INTO sessiontb VALUES(3, 'Blind practice');
      INSERT INTO sessiontb VALUES(5, 'No type yet');
      INSERT INTO scrtypetb VALUES(0, 0);
      INSERT INTO scrtypetb VALUES(3, -28);
      INSERT INTO resulttb VALUES(1, 0, 4321, 1, 'R U', '2019-02-03 04:05:06', 'default solve');
      INSERT INTO resulttb VALUES(2, 3, 65432, 2, 'F B', '2019-02-04 05:06:07', 'dnf solve');
      INSERT INTO resulttb VALUES(3, 7, 7777, 0, 'L2', '2019-02-05 06:07:08', 'orphan solve');
    `);

    const sessions = await parseDctimerExport(bytes);
    expect(sessions.map((session) => session.sessionId)).toEqual(['0', '3', '5', '7']);
    expect(sessions.map((session) => session.name)).toEqual(['Default', 'Blind practice', 'No type yet', 'Session 7']);
    expect(sessions.map((session) => session.event)).toEqual(['222', '333bld', '333', '333']);
    expect(sessions.map((session) => session.matched)).toEqual([true, true, false, false]);
    expect(sessions[0]!.solves[0]).toMatchObject({ timeMs: 4321, penalty: '+2', comment: 'default solve' });
    expect(sessions[1]!.solves[0]).toMatchObject({ timeMs: 65432, penalty: 'DNF', comment: 'dnf solve' });
    expect(sessions[2]!.solves).toEqual([]);
    expect(sessions[3]!.solves[0]!.timeMs).toBe(7777);
  });
});

describe('dcTimer database validation', () => {
  it('rejects non-SQLite files and unrelated SQLite schemas', async () => {
    expect(isDctimerDatabase(new Uint8Array([1, 2, 3]))).toBe(false);
    expect(await parseDctimerExport(new Uint8Array([1, 2, 3]))).toEqual([]);

    const unrelated = await sqliteFixture('CREATE TABLE notes(id integer, body text);');
    expect(await parseDctimerExport(unrelated)).toEqual([]);
  });
});

describe('external timer one-click import planning', () => {
  it('imports matched and empty groups atomically without asking for event choices', () => {
    const solve = {
      id: 'solve-1',
      timeMs: 1234,
      penalty: 'ok' as const,
      scramble: 'R U',
      event: '333' as const,
      ts: 1,
    };
    const plan = planTimerImport([
      { sessionId: '1', name: 'Main', event: '333', matched: true, solves: [solve] },
      { sessionId: '2', name: 'Empty unknown', event: '333', matched: false, solves: [] },
    ]);

    expect(plan.solveCount).toBe(1);
    expect(plan.unresolvedSessionIds).toEqual([]);
    expect(plan.sessions).toEqual([
      { name: 'Main', event: '333', solves: [solve] },
      { name: 'Empty unknown', solves: [] },
    ]);
  });

  it('pauses the whole import until every populated unknown group has a target event', () => {
    const solve = {
      id: 'solve-2',
      timeMs: 5678,
      penalty: 'ok' as const,
      scramble: 'U2',
      event: '333' as const,
      ts: 2,
    };
    const session = { sessionId: 'mystery', name: 'Mystery', event: '333' as const, matched: false, solves: [solve] };

    expect(planTimerImport([session]).unresolvedSessionIds).toEqual(['mystery']);
    expect(planTimerImport([session], { mystery: 'pyra' })).toEqual({
      solveCount: 1,
      unresolvedSessionIds: [],
      sessions: [{ name: 'Mystery', event: 'pyra', solves: [solve] }],
    });
  });
});
