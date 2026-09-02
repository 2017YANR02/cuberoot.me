/**
 * localStorage-backed solve store.
 *
 * v3 adds a SESSION layer on top of the v2 per-event model (cstimer / dctimer
 * style named sessions). loadAll()/saveAll() still operate on the ACTIVE
 * session so existing SoloView calls keep working; new listSessions() /
 * setActiveSession() / createAndActivateSession() / … manage the session set.
 *
 * Migration chain (loses no data):
 *   v1 (sessions[] → flat byEvent) → v2 (byEvent) → v3 (single "default"
 *   session holding the migrated byEvent, marked active).
 *
 * Schema versioned via `version` so we can migrate later.
 */

import {
  createTimerDatabase,
  parseTimerDatabaseJson,
  summarizeTimerDatabase,
  type EventId,
  type Solve,
  type TimerDatabase,
  type TimerSessionMeta,
  type TimerSolvesByEvent,
} from '../types';
import {
  activateTimerSession,
  activateTimerSessionForEvent as activateSharedTimerSessionForEvent,
  associateTimerSessionEvent,
  clearTimerSession as clearSharedTimerSession,
  createAndActivateTimerSession,
  deleteTimerSession as deleteSharedTimerSession,
  moveTimerSolveToSession,
  renameTimerSession as renameSharedTimerSession,
  selectTimerEventSession,
  timerDefaultSessionName,
  timerSessionEvent,
  timerSessionSelectedEvent,
  timerSessionSnapshot,
  type TimerSessionMutationFailure,
  type TimerSessionMutationResult,
  type TimerSessionSelectionResult,
} from '@cuberoot/shared/timer';
import { getSettings } from '../settings';
import { BACKUP_LS_PREFIX, idbBackupGet, idbBackupList, idbBackupPut } from './backup-idb';
import { persistItem } from '@/lib/safe-storage';

const KEY = 'cuberoot-timer.v3';
const LEGACY_V2_KEY = 'cuberoot-timer.v2';
const LEGACY_V1_KEY = 'cuberoot-timer.v1';
const SAVE_COUNTER_KEY = 'cuberoot-timer.saveCounter';
const BACKUP_KEEP = 10;

type ByEvent = TimerSolvesByEvent;
export type SessionMeta = TimerSessionMeta;
type DbShapeV3 = TimerDatabase;

function genSessionId(): string {
  return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaultSessionLanguage(): 'en' | 'zh' {
  // Best-effort i18n at migration time (settings/i18n may not be loaded yet).
  try {
    if (typeof navigator !== 'undefined' && /^zh/i.test(navigator.language || '')) return 'zh';
  } catch { /* ignore */ }
  return 'en';
}

function defaultSessionName(): string {
  return timerDefaultSessionName(defaultSessionLanguage());
}

function databaseEnvironment() {
  return {
    nowMs: Date.now(),
    sessionId: genSessionId(),
    language: defaultSessionLanguage(),
  };
}

function emptyDb(): DbShapeV3 {
  const environment = databaseEnvironment();
  return createTimerDatabase(environment.nowMs, environment.sessionId, environment.language);
}

let volatileDatabase: DbShapeV3 | null = null;

function rememberDatabase(database: DbShapeV3): DbShapeV3 {
  volatileDatabase = database;
  return database;
}

function loadRaw(): DbShapeV3 {
  try {
    const s = localStorage.getItem(KEY);
    if (s) {
      const parsed = parseTimerDatabaseJson(s, databaseEnvironment());
      if (parsed) return rememberDatabase(parsed);
    }
    // Migrate forward: v2 first, then v1.
    const v2 = localStorage.getItem(LEGACY_V2_KEY);
    if (v2) {
      const migrated = parseTimerDatabaseJson(v2, databaseEnvironment());
      if (migrated) {
        saveRaw(migrated);
        return rememberDatabase(migrated);
      }
    }
    const v1 = localStorage.getItem(LEGACY_V1_KEY);
    if (v1) {
      const migrated = parseTimerDatabaseJson(v1, databaseEnvironment());
      if (migrated) {
        saveRaw(migrated);
        return rememberDatabase(migrated);
      }
    }
    if (volatileDatabase) return volatileDatabase;
    const created = emptyDb();
    if (!saveRaw(created)) volatileDatabase = created;
    return created;
  } catch {
    if (volatileDatabase) return volatileDatabase;
    return rememberDatabase(emptyDb());
  }
}

function saveRaw(db: DbShapeV3): boolean {
  // 活库写入:配额满时 persistItem 会先驱逐可再生缓存再重试,尽量保住真实数据。
  const saved = persistItem(KEY, JSON.stringify(db));
  if (saved) volatileDatabase = db;
  return saved;
}

export class TimerSessionWriteError extends Error {
  constructor() {
    super('Could not persist timer session change');
    this.name = 'TimerSessionWriteError';
  }
}

export class TimerSessionMutationError extends Error {
  constructor(readonly failure: TimerSessionMutationFailure) {
    super(`Timer session operation failed: ${failure}`);
    this.name = 'TimerSessionMutationError';
  }
}

function persistSessionMutation<T extends TimerSessionMutationResult>(result: T): T {
  if (result.failure) throw new TimerSessionMutationError(result.failure);
  if (result.changed && !saveRaw(result.database)) throw new TimerSessionWriteError();
  return result;
}

/** Read the active session's byEvent map (always an object). */
function activeByEvent(db: DbShapeV3): ByEvent {
  return db.dataBySession[db.activeSessionId] ?? {};
}

/* ---------- Public API: solves (active session) ---------- */

export function loadAll(): Record<string, Solve[]> {
  const db = loadRaw();
  return activeByEvent(db) as Record<string, Solve[]>;
}

/**
 * 自动备份的写入计数器 —— 存 localStorage,不是模块变量。
 *
 * 它原来是 `let _saveCounter = 0`,每次刷新页面归零,于是设置里那句「每 N 次
 * 写入触发」实际的意思变成了「**单次页面会话里**连续存够 N 次才触发」。默认
 * N=10,而开发时热更新和手动刷新极频繁,计数器基本到不了 10 —— 实测两个月只
 * 落下过一条备份,真丢数据时几乎没有可回滚的点。计数器跟着库一起持久化之后,
 * N 次写入就是 N 次写入,和刷新无关。
 *
 * 返回 -1 表示计数不可用(localStorage 读写抛了,隐私模式 / 配额满)。这时候
 * **不备份** —— 而不是当成 0 —— 否则 `0 % every === 0` 会让每一次保存都触发一
 * 次全量备份,在本来就写不进去的环境里雪上加霜。
 */
function bumpSaveCounter(): number {
  let prev = 0;
  try {
    prev = Number(localStorage.getItem(SAVE_COUNTER_KEY));
  } catch {
    return -1;
  }
  const next = Number.isFinite(prev) && prev > 0 ? Math.floor(prev) + 1 : 1;
  persistItem(SAVE_COUNTER_KEY, String(next));
  return next;
}

export function saveAll(byEvent: Record<string, Solve[]>): void {
  const db = loadRaw();
  db.dataBySession[db.activeSessionId] = byEvent as ByEvent;
  saveRaw(db);
  const n = bumpSaveCounter();
  const every = getSettings().autoBackupEvery | 0;
  if (every > 0 && n > 0 && n % every === 0) {
    void pushBackup(); // fire-and-forget:备份失败不影响保存本体
  }
}

/* ---------- Public API: sessions ---------- */

export function listSessions(): SessionMeta[] {
  return loadRaw().sessions.slice();
}

export function getSessionSnapshot() {
  return timerSessionSnapshot(loadRaw());
}

/** Read one session's byEvent map (empty object if the id is unknown). */
export function loadSessionData(id: string): Record<string, Solve[]> {
  return (loadRaw().dataBySession[id] ?? {}) as Record<string, Solve[]>;
}

/**
 * Read every session's byEvent map keyed by session id — for cross-session
 * aggregate stats. Order matches `listSessions()`.
 */
export function loadAllSessionData(): Array<{ session: SessionMeta; byEvent: Record<string, Solve[]> }> {
  const db = loadRaw();
  return db.sessions.map(session => ({
    session,
    byEvent: (db.dataBySession[session.id] ?? {}) as Record<string, Solve[]>,
  }));
}

export function getActiveSessionId(): string {
  return loadRaw().activeSessionId;
}

/** Explicit association, or a safe inference for a legacy single-event session. */
export function getSessionEvent(id: string): EventId | null {
  return timerSessionEvent(loadRaw(), id);
}

/** Update the event that should be selected when this session is activated. */
export function setSessionEvent(id: string, event: EventId): void {
  const db = loadRaw();
  persistSessionMutation(associateTimerSessionEvent(db, id, event));
}

/**
 * Activate a session associated with `event`, preferring the current session.
 * Returns the matching id, or null when no unambiguous association exists.
 */
export function activateSessionForEvent(event: EventId): string | null {
  const db = loadRaw();
  const mutation = activateSharedTimerSessionForEvent(db, event);
  if (mutation.failure === 'no-matching-session') return null;
  const result = persistSessionMutation<TimerSessionSelectionResult>(mutation);
  return result.sessionId;
}

export function selectSessionForEvent(
  event: EventId,
  autoSessionForEvent: boolean,
): TimerSessionSelectionResult {
  return persistSessionMutation(selectTimerEventSession(loadRaw(), event, autoSessionForEvent));
}

export function getSelectedSessionEvent(
  sessionId: string | null,
  currentEvent: EventId,
  autoEventForSession: boolean,
): EventId {
  return timerSessionSelectedEvent(
    loadRaw(),
    sessionId,
    currentEvent,
    autoEventForSession,
  );
}

export function setActiveSession(id: string): void {
  const db = loadRaw();
  persistSessionMutation(activateTimerSession(db, id));
}

/** Create and activate with one durable write for the shared switcher host. */
export function createAndActivateSession(name: string, event: EventId): string {
  const db = loadRaw();
  let id = genSessionId();
  let created = createAndActivateTimerSession(db, {
    id,
    name,
    fallbackName: defaultSessionName(),
    createdTs: Date.now(),
    event,
  });
  while (created.failure === 'duplicate-session-id') {
    id = genSessionId();
    created = createAndActivateTimerSession(db, {
      id,
      name,
      fallbackName: defaultSessionName(),
      createdTs: Date.now(),
      event,
    });
  }
  persistSessionMutation(created);
  return id;
}

export interface NamedSessionImport {
  name: string;
  /** Empty, unmapped source sessions may omit an event association. */
  event?: EventId;
  solves: Solve[];
}

export interface NamedSessionImportResult {
  sessionCount: number;
  solveCount: number;
}

/**
 * Add multiple named sessions in source order with one localStorage write.
 * Existing sessions and the active-session selection are left untouched.
 * A populated source session without an event is rejected before any write.
 */
export function importNamedSessions(
  sources: readonly NamedSessionImport[],
): NamedSessionImportResult | null {
  if (sources.length === 0 || sources.some(source => source.solves.length > 0 && !source.event)) {
    return null;
  }

  const db = loadRaw();
  const usedIds = new Set(db.sessions.map(session => session.id));
  const createdTs = Date.now();
  let solveCount = 0;

  for (const source of sources) {
    let id = genSessionId();
    while (usedIds.has(id)) id = genSessionId();
    usedIds.add(id);

    const name = source.name.trim().length > 0 ? source.name : defaultSessionName();
    db.sessions.push({
      id,
      name,
      createdTs,
      ...(source.event ? { event: source.event } : {}),
    });

    if (source.event && source.solves.length > 0) {
      const normalized = source.solves
        .map(solve => solve.event === source.event ? solve : { ...solve, event: source.event })
        .sort((a, b) => a.ts - b.ts);
      db.dataBySession[id] = { [source.event]: normalized };
      solveCount += normalized.length;
    } else {
      db.dataBySession[id] = {};
    }
  }

  if (!saveRaw(db)) return null;
  return { sessionCount: sources.length, solveCount };
}

export function renameSession(id: string, name: string): void {
  persistSessionMutation(renameSharedTimerSession(loadRaw(), id, name));
}

/** Wipe a session's solves (keep the session). */
export function clearSession(id: string): void {
  persistSessionMutation(clearSharedTimerSession(loadRaw(), id));
}

/**
 * Delete a session and its solves. Refuses to delete the last session.
 * If the active session is deleted, falls back to the first remaining one.
 * Returns the new active session id only when deleting the active session.
 */
export function deleteSession(id: string): string | null {
  return persistSessionMutation(deleteSharedTimerSession(loadRaw(), id)).sessionId;
}

/**
 * Move a single solve out of the ACTIVE session into `targetSessionId` (same
 * event). Removes it from the active session's event list and appends it to the
 * target session's same-event list (kept chronologically sorted). Returns true
 * if the solve was found and moved.
 */
export function moveSolveToSession(solveId: string, targetSessionId: string): boolean {
  const db = loadRaw();
  const result = moveTimerSolveToSession(db, solveId, targetSessionId);
  if (!result.changed) return false;
  return saveRaw(result.database);
}

/* ---------- Auto-backup ----------
 * 主路径 IndexedDB(backup-idb.ts,含存量 localStorage 备份的一次性迁移);
 * IDB 不可用(隐私模式等)才退回老的 localStorage 配额循环。
 * BackupEntry.key:IDB 条目 = String(ts)(纯数字);legacy = 完整 LS key。 */

export interface BackupEntry { key: string; ts: number; size: number; }

export async function pushBackup(): Promise<void> {
  let json: string;
  try { json = exportJson(); } catch { return; }
  try {
    await idbBackupPut(Date.now(), json, BACKUP_KEEP);
  } catch {
    pushBackupLS(json);
  }
}

export async function listBackups(): Promise<BackupEntry[]> {
  try {
    const list = await idbBackupList();
    return list.map(e => ({ key: String(e.ts), ts: e.ts, size: e.size }));
  } catch {
    return listBackupsLS();
  }
}

export async function restoreBackup(key: string): Promise<boolean> {
  if (/^\d+$/.test(key)) {
    try {
      const v = await idbBackupGet(Number(key));
      if (v != null) return importJson(v);
    } catch { /* fall through to legacy */ }
  }
  try {
    const v = localStorage.getItem(key);
    if (!v) return false;
    return importJson(v);
  } catch {
    return false;
  }
}

/* ----- legacy localStorage fallback ----- */

function pushBackupLS(json: string): void {
  const key = BACKUP_LS_PREFIX + Date.now();
  // Quota loop: drop oldest backup until setItem succeeds, or no more to drop.
  for (let attempts = 0; attempts < 16; attempts++) {
    try {
      // allow-raw-localstorage: 自带驱逐-重试循环,不能走吞异常的 persistItem
      localStorage.setItem(key, json);
      break;
    } catch {
      const all = listBackupsLS();
      if (all.length === 0) return; // nothing left to drop, quota truly full
      try { localStorage.removeItem(all[all.length - 1]!.key); } catch { return; }
    }
  }
  // Rotate: keep only the most-recent BACKUP_KEEP entries.
  const all = listBackupsLS();
  if (all.length > BACKUP_KEEP) {
    for (const e of all.slice(BACKUP_KEEP)) {
      try { localStorage.removeItem(e.key); } catch { /* ignore */ }
    }
  }
}

function listBackupsLS(): BackupEntry[] {
  const out: BackupEntry[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(BACKUP_LS_PREFIX)) continue;
      const tsStr = k.slice(BACKUP_LS_PREFIX.length);
      const ts = Number(tsStr);
      if (!Number.isFinite(ts)) continue;
      const v = localStorage.getItem(k) ?? '';
      out.push({ key: k, ts, size: v.length });
    }
  } catch { /* ignore */ }
  out.sort((a, b) => b.ts - a.ts);
  return out;
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/**
 * JSON export — full DB contents as a downloadable string (v3, all sessions).
 */
export function exportJson(): string {
  return JSON.stringify(loadRaw(), null, 2);
}

function parseImportedDb(json: string): DbShapeV3 | null {
  return parseTimerDatabaseJson(json, databaseEnvironment());
}

export interface NativeImportPreview {
  sessionCount: number;
  solveCount: number;
}

/** Validate a native CubeRoot backup without changing local data. */
export function inspectImportJson(json: string): NativeImportPreview | null {
  const db = parseImportedDb(json);
  if (!db) return null;
  return summarizeTimerDatabase(db);
}

/**
 * Native JSON import — replaces contents. Accepts v3 (all sessions), v2
 * (byEvent → wrapped into a default session), or v1 (sessions[] → byEvent →
 * default session). Returns true on success.
 * For cstimer's export format, see `importCstimerJson` in `import_export.ts`.
 */
export function importJson(json: string): boolean {
  const db = parseImportedDb(json);
  if (!db) return false;
  return saveRaw(db);
}

/**
 * Replace all solves for a single event in the ACTIVE session. Other events
 * are untouched. Used by csTimer per-session import.
 */
export function replaceSolves(eventId: EventId, solves: Solve[]): void {
  let db = loadRaw();
  const be = activeByEvent(db);
  be[eventId] = solves
    .map(solve => solve.event === eventId ? solve : { ...solve, event: eventId })
    .sort((a, b) => a.ts - b.ts);
  db.dataBySession[db.activeSessionId] = be;
  db = associateTimerSessionEvent(db, db.activeSessionId, eventId).database;
  saveRaw(db);
}

/**
 * Append solves to a single event in the ACTIVE session, preserving
 * chronological order. Used by csTimer per-session import.
 */
export function appendSolves(eventId: EventId, solves: Solve[]): void {
  let db = loadRaw();
  const be = activeByEvent(db);
  const existing = be[eventId] ?? [];
  const normalized = solves.map(solve => solve.event === eventId ? solve : { ...solve, event: eventId });
  be[eventId] = [...existing, ...normalized].sort((a, b) => a.ts - b.ts);
  db.dataBySession[db.activeSessionId] = be;
  db = associateTimerSessionEvent(db, db.activeSessionId, eventId).database;
  saveRaw(db);
}

/**
 * Bulk update existing solves for one event (active session) by id. Solves not
 * present in the `updates` array are left untouched; ids in `updates` that
 * don't exist in the event are silently dropped. Single read + single write —
 * used by the reanalyze migration.
 */
export function updateSolves(eventId: EventId, updates: Solve[]): void {
  if (updates.length === 0) return;
  const db = loadRaw();
  const be = activeByEvent(db);
  const existing = be[eventId];
  if (!existing || existing.length === 0) return;
  const byId = new Map<string, Solve>();
  for (const u of updates) byId.set(u.id, u);
  be[eventId] = existing.map(s => byId.get(s.id) ?? s);
  db.dataBySession[db.activeSessionId] = be;
  saveRaw(db);
}

/** Convenience: build a Solve. */
export function makeSolve(args: {
  timeMs: number;
  scramble: string;
  event: EventId;
  penalty?: Solve['penalty'];
  comment?: string;
}): Solve {
  return {
    id: newId(),
    timeMs: args.timeMs,
    penalty: args.penalty ?? 'ok',
    scramble: args.scramble,
    event: args.event,
    ts: Date.now(),
    comment: args.comment,
  };
}

/**
 * 按「打乱 + 用时」把一条**对战**成绩认回本机记录。
 *
 * 对战记分板和本机计时记录是两本账:前者只存数字,后者存整把(转动流 / 姿态流 /
 * 分段)。智能魔方那条路会把同一把按 Solo 的格式也留一份(见 `useBattleCubes`),
 * 所以对战那一行**可能**有对应的复盘 —— 但两边没有共用的 id。
 *
 * 与其给对战自己的持久化格式加一个 id(那是要迁移的),不如按内容认:同一条打乱
 * 加上**没取整的**用时。两把要撞,得是同一条打乱、还得毫秒的小数位一模一样。
 * 只认带转动流的那些 —— 没有转动流就没有复盘可看,认回来也没用。
 *
 * 认不回来返回 null,绝大多数把都这样(没连魔方就没有转动流)。
 */
export function battleReconKey(scramble: string, timeMs: number): string {
  return `${timeMs}|${scramble}`;
}

/**
 * 一个事件下所有**能复盘**的把,按上面那个键索引;`solves` 是同一次读出来的整份
 * 列表(复盘面板要拿它算个人分段均值)。整份记录只读一次 —— 逐行去查会把一次
 * localStorage 解析乘上行数。
 */
export function battleReconIndex(eventId: EventId): { index: Map<string, Solve>; solves: Solve[] } {
  const solves = loadAll()[eventId] ?? [];
  const index = new Map<string, Solve>();
  for (const s of solves) {
    if (s.moves && s.moves.length > 0 && s.scramble) index.set(battleReconKey(s.scramble, s.timeMs), s);
  }
  return { index, solves };
}

/* ---------- Re-exports from import_export.ts ---------- */
// So callers can do `import { importCstimerJson } from './storage/db'`.
export {
  importCstimerJson,
  exportCsv,
  exportTsv,
  exportSpeedstacks,
} from './import_export';
