/**
 * localStorage-backed solve store.
 *
 * v3 adds a SESSION layer on top of the v2 per-event model (cstimer / dctimer
 * style named sessions). loadAll()/saveAll() still operate on the ACTIVE
 * session so existing SoloView calls keep working; new listSessions() /
 * setActiveSession() / createSession() / … manage the session set.
 *
 * Migration chain (loses no data):
 *   v1 (sessions[] → flat byEvent) → v2 (byEvent) → v3 (single "default"
 *   session holding the migrated byEvent, marked active).
 *
 * Schema versioned via `version` so we can migrate later.
 */

import type { EventId, Solve } from '../types';
import { getSettings } from '../settings';
import { BACKUP_LS_PREFIX, idbBackupGet, idbBackupList, idbBackupPut } from './backup-idb';

const KEY = 'cuberoot-timer.v3';
const LEGACY_V2_KEY = 'cuberoot-timer.v2';
const LEGACY_V1_KEY = 'cuberoot-timer.v1';
const BACKUP_KEEP = 10;

type ByEvent = Partial<Record<EventId, Solve[]>>;

export interface SessionMeta {
  id: string;
  name: string;
  createdTs: number;
}

interface DbShapeV3 {
  version: 3;
  sessions: SessionMeta[];
  activeSessionId: string;
  /** sessionId → (event id → solves, oldest → newest). */
  dataBySession: Record<string, ByEvent>;
}

interface DbShapeV2 {
  version: 2;
  byEvent: ByEvent;
}

function genSessionId(): string {
  return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaultSessionName(): string {
  // Best-effort i18n at migration time (settings/i18n may not be loaded yet).
  try {
    if (typeof navigator !== 'undefined' && /^zh/i.test(navigator.language || '')) return '默认';
  } catch { /* ignore */ }
  return 'Default';
}

function emptyDb(): DbShapeV3 {
  const id = genSessionId();
  return {
    version: 3,
    sessions: [{ id, name: defaultSessionName(), createdTs: Date.now() }],
    activeSessionId: id,
    dataBySession: { [id]: {} },
  };
}

/** Build a v3 db that wraps a single migrated byEvent into a default session. */
function wrapByEventAsDefaultSession(byEvent: ByEvent): DbShapeV3 {
  const id = genSessionId();
  return {
    version: 3,
    sessions: [{ id, name: defaultSessionName(), createdTs: Date.now() }],
    activeSessionId: id,
    dataBySession: { [id]: byEvent },
  };
}

/** v1 sessions[] → flat byEvent. */
function v1ToByEvent(parsed: { sessions?: Array<{ event: EventId; solves: Solve[] }> }): ByEvent {
  const byEvent: ByEvent = {};
  for (const sess of parsed.sessions ?? []) {
    if (!byEvent[sess.event]) byEvent[sess.event] = [];
    byEvent[sess.event]!.push(...sess.solves);
  }
  for (const k of Object.keys(byEvent) as EventId[]) {
    byEvent[k]!.sort((a, b) => a.ts - b.ts);
  }
  return byEvent;
}

function isValidV3(v: unknown): v is DbShapeV3 {
  if (!v || typeof v !== 'object') return false;
  const o = v as Partial<DbShapeV3>;
  return (
    o.version === 3 &&
    Array.isArray(o.sessions) &&
    o.sessions.length > 0 &&
    typeof o.activeSessionId === 'string' &&
    !!o.dataBySession &&
    typeof o.dataBySession === 'object'
  );
}

/** Repair invariants we depend on (active id exists, every session has data). */
function normalizeV3(db: DbShapeV3): DbShapeV3 {
  const sessions = db.sessions.length > 0
    ? db.sessions
    : [{ id: genSessionId(), name: defaultSessionName(), createdTs: Date.now() }];
  const dataBySession = { ...db.dataBySession };
  for (const s of sessions) {
    if (!dataBySession[s.id] || typeof dataBySession[s.id] !== 'object') dataBySession[s.id] = {};
  }
  let activeSessionId = db.activeSessionId;
  if (!sessions.some(s => s.id === activeSessionId)) activeSessionId = sessions[0].id;
  return { version: 3, sessions, activeSessionId, dataBySession };
}

function loadRaw(): DbShapeV3 {
  try {
    const s = localStorage.getItem(KEY);
    if (s) {
      const parsed = JSON.parse(s) as unknown;
      if (isValidV3(parsed)) return normalizeV3(parsed);
    }
    // Migrate forward: v2 first, then v1.
    const v2 = localStorage.getItem(LEGACY_V2_KEY);
    if (v2) {
      const parsed = JSON.parse(v2) as Partial<DbShapeV2>;
      if (parsed.version === 2 && parsed.byEvent && typeof parsed.byEvent === 'object') {
        const migrated = wrapByEventAsDefaultSession(parsed.byEvent);
        saveRaw(migrated);
        return migrated;
      }
    }
    const v1 = localStorage.getItem(LEGACY_V1_KEY);
    if (v1) {
      const parsed = JSON.parse(v1) as { version?: number; sessions?: Array<{ event: EventId; solves: Solve[] }> };
      if (parsed.version === 1 && Array.isArray(parsed.sessions)) {
        const migrated = wrapByEventAsDefaultSession(v1ToByEvent(parsed));
        saveRaw(migrated);
        return migrated;
      }
    }
    return emptyDb();
  } catch {
    return emptyDb();
  }
}

function saveRaw(db: DbShapeV3): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // localStorage quota exceeded or unavailable — ignore.
  }
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

let _saveCounter = 0;

export function saveAll(byEvent: Record<string, Solve[]>): void {
  const db = loadRaw();
  db.dataBySession[db.activeSessionId] = byEvent as ByEvent;
  saveRaw(db);
  _saveCounter++;
  const every = getSettings().autoBackupEvery | 0;
  if (every > 0 && _saveCounter % every === 0) {
    void pushBackup(); // fire-and-forget:备份失败不影响保存本体
  }
}

/* ---------- Public API: sessions ---------- */

export function listSessions(): SessionMeta[] {
  return loadRaw().sessions.slice();
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

export function setActiveSession(id: string): void {
  const db = loadRaw();
  if (!db.sessions.some(s => s.id === id)) return;
  if (db.activeSessionId === id) return;
  db.activeSessionId = id;
  saveRaw(db);
}

/** Create a new (empty) session and return its id. Does NOT switch to it. */
export function createSession(name: string): string {
  const db = loadRaw();
  const id = genSessionId();
  const trimmed = name.trim();
  db.sessions.push({ id, name: trimmed || defaultSessionName(), createdTs: Date.now() });
  db.dataBySession[id] = {};
  saveRaw(db);
  return id;
}

export function renameSession(id: string, name: string): void {
  const db = loadRaw();
  const s = db.sessions.find(x => x.id === id);
  if (!s) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  s.name = trimmed;
  saveRaw(db);
}

/** Wipe a session's solves (keep the session). */
export function clearSession(id: string): void {
  const db = loadRaw();
  if (!db.sessions.some(s => s.id === id)) return;
  db.dataBySession[id] = {};
  saveRaw(db);
}

/**
 * Delete a session and its solves. Refuses to delete the last session.
 * If the active session is deleted, falls back to the first remaining one.
 * Returns the (possibly new) active session id, or null if refused.
 */
export function deleteSession(id: string): string | null {
  const db = loadRaw();
  if (db.sessions.length <= 1) return null;
  if (!db.sessions.some(s => s.id === id)) return db.activeSessionId;
  db.sessions = db.sessions.filter(s => s.id !== id);
  delete db.dataBySession[id];
  if (db.activeSessionId === id) db.activeSessionId = db.sessions[0].id;
  saveRaw(db);
  return db.activeSessionId;
}

/**
 * Move a single solve out of the ACTIVE session into `targetSessionId` (same
 * event). Removes it from the active session's event list and appends it to the
 * target session's same-event list (kept chronologically sorted). Returns true
 * if the solve was found and moved.
 */
export function moveSolveToSession(solveId: string, targetSessionId: string): boolean {
  const db = loadRaw();
  const fromId = db.activeSessionId;
  if (targetSessionId === fromId) return false;
  if (!db.sessions.some(s => s.id === targetSessionId)) return false;

  const fromBe = db.dataBySession[fromId] ?? {};
  let moved: Solve | null = null;
  let movedEvent: EventId | null = null;
  for (const ev of Object.keys(fromBe) as EventId[]) {
    const list = fromBe[ev];
    if (!list) continue;
    const i = list.findIndex(s => s.id === solveId);
    if (i >= 0) {
      moved = list[i];
      movedEvent = ev;
      fromBe[ev] = list.slice(0, i).concat(list.slice(i + 1));
      break;
    }
  }
  if (!moved || !movedEvent) return false;
  db.dataBySession[fromId] = fromBe;

  const toBe = db.dataBySession[targetSessionId] ?? {};
  const existing = toBe[movedEvent] ?? [];
  toBe[movedEvent] = [...existing, moved].sort((a, b) => a.ts - b.ts);
  db.dataBySession[targetSessionId] = toBe;

  saveRaw(db);
  return true;
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

/**
 * Native JSON import — replaces contents. Accepts v3 (all sessions), v2
 * (byEvent → wrapped into a default session), or v1 (sessions[] → byEvent →
 * default session). Returns true on success.
 * For cstimer's export format, see `importCstimerJson` in `import_export.ts`.
 */
export function importJson(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (isValidV3(parsed)) {
      saveRaw(normalizeV3(parsed));
      return true;
    }
    const o = parsed as { version?: number; byEvent?: ByEvent; sessions?: Array<{ event: EventId; solves: Solve[] }> };
    if (o.version === 2 && o.byEvent && typeof o.byEvent === 'object') {
      saveRaw(wrapByEventAsDefaultSession(o.byEvent));
      return true;
    }
    if (o.version === 1 && Array.isArray(o.sessions)) {
      saveRaw(wrapByEventAsDefaultSession(v1ToByEvent(o)));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Replace all solves for a single event in the ACTIVE session. Other events
 * are untouched. Used by csTimer per-session import.
 */
export function replaceSolves(eventId: EventId, solves: Solve[]): void {
  const db = loadRaw();
  const be = activeByEvent(db);
  be[eventId] = solves.slice().sort((a, b) => a.ts - b.ts);
  db.dataBySession[db.activeSessionId] = be;
  saveRaw(db);
}

/**
 * Append solves to a single event in the ACTIVE session, preserving
 * chronological order. Used by csTimer per-session import.
 */
export function appendSolves(eventId: EventId, solves: Solve[]): void {
  const db = loadRaw();
  const be = activeByEvent(db);
  const existing = be[eventId] ?? [];
  be[eventId] = [...existing, ...solves].sort((a, b) => a.ts - b.ts);
  db.dataBySession[db.activeSessionId] = be;
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

/* ---------- Re-exports from import_export.ts ---------- */
// So callers can do `import { importCstimerJson } from './storage/db'`.
export {
  importCstimerJson,
  exportCsv,
  exportTsv,
  exportSpeedstacks,
} from './import_export';
