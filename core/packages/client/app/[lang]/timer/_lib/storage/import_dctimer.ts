import type { Database, SqlValue } from 'sql.js';
import type { EventId, Solve } from '../types';
import { newId } from './db';
import type { TimerImportSession } from './import_timer';

const SQLITE_HEADER = 'SQLite format 3\0';
const ANDROID_RESULT_TABLES = [
  'resulttb',
  'result2',
  'result3',
  'result4',
  'result5',
  'result6',
  'result7',
  'result8',
  'result9',
  'result10',
  'result11',
  'result12',
  'result13',
  'result14',
  'result15',
] as const;

type SqlRow = Record<string, SqlValue>;

let sqlJsPromise: Promise<Awaited<ReturnType<typeof import('sql.js/dist/sql-asm-memory-growth.js').default>>> | null = null;

function loadSqlJs() {
  sqlJsPromise ??= import('sql.js/dist/sql-asm-memory-growth.js').then(({ default: initSqlJs }) => initSqlJs());
  return sqlJsPromise;
}

export function isDctimerDatabase(bytes: Uint8Array): boolean {
  if (bytes.length < SQLITE_HEADER.length) return false;
  for (let i = 0; i < SQLITE_HEADER.length; i += 1) {
    if (bytes[i] !== SQLITE_HEADER.charCodeAt(i)) return false;
  }
  return true;
}

function rows(db: Database, sql: string, params?: SqlValue[]): SqlRow[] {
  const result = db.exec(sql, params);
  if (result.length === 0) return [];
  const { columns, values } = result[0]!;
  return values.map((valuesRow) => Object.fromEntries(
    columns.map((column, index) => [column.toLowerCase(), valuesRow[index] ?? null]),
  ));
}

function safeIdentifier(name: string): string {
  if (!/^[a-z0-9_]+$/i.test(name)) throw new Error('Invalid SQLite identifier');
  return `"${name}"`;
}

function tableNames(db: Database): Set<string> {
  return new Set(rows(db, "SELECT name FROM sqlite_master WHERE type='table'")
    .map((row) => String(row.name).toLowerCase()));
}

function columnNames(db: Database, table: string): Set<string> {
  return new Set(rows(db, `PRAGMA table_info(${safeIdentifier(table)})`)
    .map((row) => String(row.name).toLowerCase()));
}

function finiteNumber(value: SqlValue | undefined): number | null {
  if (value === null || value === undefined || value instanceof Uint8Array) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function integer(value: SqlValue | undefined): number | null {
  const number = finiteNumber(value);
  return number === null ? null : Math.trunc(number);
}

function text(value: SqlValue | undefined): string {
  return typeof value === 'string' ? value : '';
}

function parseLocalTimestamp(value: SqlValue | undefined): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const date = new Date(year, month - 1, day, hour, minute, second);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
    || date.getHours() !== hour
    || date.getMinutes() !== minute
    || date.getSeconds() !== second
  ) return null;
  return date.getTime();
}

function mapped(event: EventId): { event: EventId; matched: true } {
  return { event, matched: true };
}

function dctimerEvent(rawType: SqlValue | undefined): { event: EventId; matched: boolean } {
  const type = integer(rawType);
  if (type === null) return { event: '333', matched: false };
  const group = type >> 5;
  const sub = type & 31;

  if (group === -1) {
    const wca: Partial<Record<number, EventId>> = {
      0: '333', 1: '444', 2: '555', 3: '222', 4: '333bld', 5: '333oh',
      6: '333fm', 7: 'mega', 8: 'pyra', 9: 'sq1', 10: 'clock', 11: 'skewb',
      12: '666', 13: '777', 14: '444bld', 15: '555bld', 16: '333mbld',
    };
    const event = wca[sub];
    return event ? mapped(event) : { event: '333', matched: false };
  }

  const puzzleGroups: Partial<Record<number, EventId>> = {
    0: '222',
    1: '333',
    2: '444',
    3: '555',
    4: '666',
    5: '777',
    6: 'mega',
    7: 'pyra',
    8: 'sq1',
    9: 'clock',
    10: 'skewb',
    13: 'gear',
    17: '333',
    19: 'mega',
  };
  const puzzleEvent = puzzleGroups[group];
  if (puzzleEvent) return mapped(puzzleEvent);

  if (group === 16) {
    if (sub === 5) return mapped('fto');
    if (sub === 6) return mapped('redi');
    if (sub === 7) return mapped('mpyram');
  }
  if (group === 20) {
    if (sub === 1) return mapped('r3');
    if (sub === 2) return mapped('r4');
    if (sub === 3) return mapped('r5');
  }
  return { event: '333', matched: false };
}

function stagesFromDurations(row: SqlRow, timeMs: number): Solve['stages'] | undefined {
  const parts = [row.p1, row.p2, row.p3, row.p4].map(finiteNumber);
  if (parts.some((part) => part === null || part < 0)) return undefined;
  const [p1, p2, p3] = parts as [number, number, number, number];
  const f2l = p1 + p2;
  const oll = f2l + p3;
  if (oll > timeMs) return undefined;
  return { cross: p1, f2l, oll, pll: timeMs };
}

interface SolveRowOptions {
  event: EventId;
  hasDnfColumn: boolean;
  includeStages: boolean;
  fallbackTs: number;
}

function solveFromRow(row: SqlRow, options: SolveRowOptions): Solve | null {
  const rawTime = finiteNumber(row.rest ?? row.result);
  if (rawTime === null || rawTime < 0) return null;
  const timeMs = Math.round(rawTime);
  const rawPenalty = integer(row.resp ?? row.penalty) ?? 0;
  const dnf = options.hasDnfColumn ? integer(row.resd) === 0 : rawPenalty === 2;
  const penalty: Solve['penalty'] = dnf ? 'DNF' : rawPenalty === 1 ? '+2' : 'ok';
  const comment = text(row.note).trim();
  const moveSequence = text(row.moves).trim();
  const stages = options.includeStages ? stagesFromDurations(row, timeMs) : undefined;

  return {
    id: newId(),
    timeMs,
    penalty,
    scramble: text(row.scr ?? row.scramble),
    event: options.event,
    ts: parseLocalTimestamp(row.time ?? row.date) ?? options.fallbackTs,
    ...(comment ? { comment } : {}),
    ...(moveSequence ? { reconstruction: [moveSequence] } : {}),
    ...(stages ? { stages } : {}),
  };
}

function resultRows(
  db: Database,
  tables: Set<string>,
  table: string,
  sessionId?: number,
): { columns: Set<string>; values: SqlRow[] } {
  if (!tables.has(table)) return { columns: new Set(), values: [] };
  const columns = columnNames(db, table);
  const identifier = safeIdentifier(table);
  const values = sessionId !== undefined && columns.has('sid')
    ? rows(db, `SELECT * FROM ${identifier} WHERE sid = ?`, [sessionId])
    : rows(db, `SELECT * FROM ${identifier}`);
  values.sort((a, b) => (integer(a.id) ?? 0) - (integer(b.id) ?? 0));
  return { columns, values };
}

function parseAndroid(db: Database, tables: Set<string>): TimerImportSession[] | null {
  const columns = columnNames(db, 'sessiontb');
  if (!columns.has('id') || !columns.has('type')) return null;

  const sessionRows = rows(db, 'SELECT * FROM "sessiontb"')
    .map((row, sourceIndex) => ({ row, sourceIndex }))
    .sort((a, b) => {
      const aRank = integer(a.row.sorting);
      const bRank = integer(b.row.sorting);
      const aOrder = aRank !== null && aRank > 0 ? aRank : a.sourceIndex + 1;
      const bOrder = bRank !== null && bRank > 0 ? bRank : b.sourceIndex + 1;
      return aOrder - bOrder || a.sourceIndex - b.sourceIndex;
    });
  const fallbackBase = Date.now() - sessionRows.length * 1_000_000;

  return sessionRows.flatMap(({ row }, sessionIndex) => {
    const sessionId = integer(row.id);
    if (sessionId === null || sessionId < 0) return [];
    const eventMatch = dctimerEvent(row.type);
    const table = sessionId < ANDROID_RESULT_TABLES.length
      ? ANDROID_RESULT_TABLES[sessionId]!
      : 'resultstb';
    const result = resultRows(db, tables, table, sessionId >= 15 ? sessionId : undefined);
    const includeStages = eventMatch.event === '333' && integer(row.mulp) === 3;
    const solves = result.values.flatMap((resultRow, resultIndex) => {
      const solve = solveFromRow(resultRow, {
        event: eventMatch.event,
        hasDnfColumn: result.columns.has('resd'),
        includeStages,
        fallbackTs: fallbackBase + sessionIndex * 1_000_000 + resultIndex,
      });
      return solve ? [solve] : [];
    }).sort((a, b) => a.ts - b.ts);

    return [{
      sessionId: String(sessionId),
      name: text(row.name).trim() || `Session ${sessionId + 1}`,
      ...eventMatch,
      solves,
    }];
  });
}

function parseIos(db: Database, tables: Set<string>): TimerImportSession[] | null {
  if (!tables.has('resulttb')) return null;
  const sessionColumns = columnNames(db, 'sessiontb');
  const resultColumns = columnNames(db, 'resulttb');
  if (!sessionColumns.has('rowid') || !resultColumns.has('sesid') || !resultColumns.has('rest')) return null;

  const result = resultRows(db, tables, 'resulttb');
  const resultGroups = new Set(result.values.map((row) => integer(row.sesid)).filter((id): id is number => id !== null));
  const typeRows = tables.has('scrtypetb') ? rows(db, 'SELECT * FROM "scrtypetb"') : [];
  const types = new Map(typeRows.flatMap((row) => {
    const id = integer(row.sesid);
    return id === null ? [] : [[id, row.type] as const];
  }));
  const customSessions = rows(db, 'SELECT * FROM "sessiontb"')
    .map((row, sourceIndex) => ({ id: integer(row.rowid), name: text(row.name), sourceIndex }))
    .filter((session): session is { id: number; name: string; sourceIndex: number } => session.id !== null && session.id > 0)
    .sort((a, b) => a.id - b.id || a.sourceIndex - b.sourceIndex);
  const knownIds = new Set([0, ...customSessions.map((session) => session.id)]);
  const orphanIds = [...new Set([...resultGroups, ...types.keys()])]
    .filter((id) => id > 0 && !knownIds.has(id))
    .sort((a, b) => a - b);
  const sourceSessions = [
    { id: 0, name: 'Default' },
    ...customSessions.map(({ id, name }) => ({ id, name })),
    ...orphanIds.map((id) => ({ id, name: `Session ${id}` })),
  ];
  const fallbackBase = Date.now() - sourceSessions.length * 1_000_000;

  return sourceSessions.map((session, sessionIndex) => {
    const eventMatch = dctimerEvent(types.get(session.id));
    const sessionResultRows = result.values.filter((row) => integer(row.sesid) === session.id);
    const solves = sessionResultRows.flatMap((resultRow, resultIndex) => {
      const solve = solveFromRow(resultRow, {
        event: eventMatch.event,
        hasDnfColumn: false,
        includeStages: false,
        fallbackTs: fallbackBase + sessionIndex * 1_000_000 + resultIndex,
      });
      return solve ? [solve] : [];
    }).sort((a, b) => a.ts - b.ts);
    return {
      sessionId: String(session.id),
      name: session.name.trim() || `Session ${session.id || 1}`,
      ...eventMatch,
      solves,
    };
  });
}

/** Parse Android `database.db` and legacy iOS `spdcube.sqlite` dcTimer exports. */
export async function parseDctimerExport(bytes: Uint8Array): Promise<TimerImportSession[]> {
  if (!isDctimerDatabase(bytes)) return [];
  let db: Database | null = null;
  try {
    const SQL = await loadSqlJs();
    db = new SQL.Database(bytes);
    const tables = tableNames(db);
    if (!tables.has('sessiontb')) return [];
    return parseAndroid(db, tables) ?? parseIos(db, tables) ?? [];
  } catch {
    return [];
  } finally {
    db?.close();
  }
}
