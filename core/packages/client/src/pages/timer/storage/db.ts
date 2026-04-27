/**
 * localStorage-backed solve store. Solves are grouped per event (no session
 * concept). Round 1E will extend with cstimer-JSON / CSV / Speedstacks I/O —
 * see `import_export.ts` (sibling).
 *
 * Schema versioned via `version` field so we can migrate later.
 */

import type { EventId, Solve } from '../types';
import { getSettings } from '../settings';

const KEY = 'cuberoot-timer.v2';
const LEGACY_KEY = 'cuberoot-timer.v1';
const BACKUP_KEY_PREFIX = 'cuberoot-timer.backup.v1.';
const BACKUP_KEEP = 10;

interface DbShape {
  version: 2;
  /** event id → solves (oldest → newest). */
  byEvent: Partial<Record<EventId, Solve[]>>;
}

function emptyDb(): DbShape {
  return { version: 2, byEvent: {} };
}

function loadRaw(): DbShape {
  try {
    const s = localStorage.getItem(KEY);
    if (s) {
      const parsed = JSON.parse(s) as Partial<DbShape>;
      if (parsed.version === 2 && parsed.byEvent && typeof parsed.byEvent === 'object') {
        return { version: 2, byEvent: parsed.byEvent };
      }
    }
    // One-time migration from v1 (sessions[] → flat byEvent[]).
    const v1 = localStorage.getItem(LEGACY_KEY);
    if (v1) {
      const parsed = JSON.parse(v1) as { version?: number; sessions?: Array<{ event: EventId; solves: Solve[] }> };
      if (parsed.version === 1 && Array.isArray(parsed.sessions)) {
        const byEvent: DbShape['byEvent'] = {};
        for (const sess of parsed.sessions) {
          if (!byEvent[sess.event]) byEvent[sess.event] = [];
          byEvent[sess.event]!.push(...sess.solves);
        }
        // Sort each event's solves chronologically.
        for (const k of Object.keys(byEvent) as EventId[]) {
          byEvent[k]!.sort((a, b) => a.ts - b.ts);
        }
        const migrated: DbShape = { version: 2, byEvent };
        try { localStorage.setItem(KEY, JSON.stringify(migrated)); } catch { /* quota; tolerate */ }
        return migrated;
      }
    }
    return emptyDb();
  } catch {
    return emptyDb();
  }
}

function saveRaw(db: DbShape): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // localStorage quota exceeded or unavailable — ignore.
  }
}

/* ---------- Public API ---------- */

export function loadAll(): Record<string, Solve[]> {
  const db = loadRaw();
  return db.byEvent as Record<string, Solve[]>;
}

let _saveCounter = 0;

export function saveAll(byEvent: Record<string, Solve[]>): void {
  saveRaw({ version: 2, byEvent: byEvent as DbShape['byEvent'] });
  _saveCounter++;
  const every = getSettings().autoBackupEvery | 0;
  if (every > 0 && _saveCounter % every === 0) {
    pushBackup();
  }
}

/* ---------- Auto-backup ---------- */

export interface BackupEntry { key: string; ts: number; size: number; }

export function pushBackup(): void {
  try {
    const json = exportJson();
    const key = BACKUP_KEY_PREFIX + Date.now();
    localStorage.setItem(key, json);
    // Rotate: keep only the most-recent BACKUP_KEEP entries.
    const all = listBackups();
    if (all.length > BACKUP_KEEP) {
      const toRemove = all.slice(BACKUP_KEEP);
      for (const e of toRemove) {
        try { localStorage.removeItem(e.key); } catch { /* ignore */ }
      }
    }
  } catch {
    /* quota — drop oldest then retry once */
    try {
      const all = listBackups();
      if (all.length > 0) {
        localStorage.removeItem(all[all.length - 1]!.key);
      }
    } catch { /* ignore */ }
  }
}

export function listBackups(): BackupEntry[] {
  const out: BackupEntry[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(BACKUP_KEY_PREFIX)) continue;
      const tsStr = k.slice(BACKUP_KEY_PREFIX.length);
      const ts = Number(tsStr);
      if (!Number.isFinite(ts)) continue;
      const v = localStorage.getItem(k) ?? '';
      out.push({ key: k, ts, size: v.length });
    }
  } catch { /* ignore */ }
  out.sort((a, b) => b.ts - a.ts);
  return out;
}

export function restoreBackup(key: string): boolean {
  try {
    const v = localStorage.getItem(key);
    if (!v) return false;
    return importJson(v);
  } catch {
    return false;
  }
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/**
 * JSON export — full DB contents as a downloadable string.
 */
export function exportJson(): string {
  return JSON.stringify(loadRaw(), null, 2);
}

/**
 * Native JSON import — replaces contents. Returns true on success.
 * For cstimer's export format, see `importCstimerJson` in `import_export.ts`.
 */
export function importJson(json: string): boolean {
  try {
    const parsed = JSON.parse(json);
    if (parsed.version === 2 && parsed.byEvent && typeof parsed.byEvent === 'object') {
      saveRaw({ version: 2, byEvent: parsed.byEvent });
      return true;
    }
    if (parsed.version === 1 && Array.isArray(parsed.sessions)) {
      // Accept v1 format too (from older exports of this app).
      const byEvent: DbShape['byEvent'] = {};
      for (const sess of parsed.sessions as Array<{ event: EventId; solves: Solve[] }>) {
        if (!byEvent[sess.event]) byEvent[sess.event] = [];
        byEvent[sess.event]!.push(...sess.solves);
      }
      for (const k of Object.keys(byEvent) as EventId[]) {
        byEvent[k]!.sort((a, b) => a.ts - b.ts);
      }
      saveRaw({ version: 2, byEvent });
      return true;
    }
    return false;
  } catch {
    return false;
  }
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
