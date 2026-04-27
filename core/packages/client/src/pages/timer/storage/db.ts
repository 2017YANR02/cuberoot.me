/**
 * localStorage-backed session store. One key holds the entire DB — sessions
 * are small (text scrambles + numeric times) so we don't need IndexedDB yet.
 *
 * Schema versioned via `version` field so we can migrate later.
 */

import type { EventId, Session, Solve } from '../types';

const KEY = 'cuberoot-timer.v1';

interface DbShape {
  version: 1;
  sessions: Session[];
  /** Currently selected session id (per event). */
  active: Record<string, string>;
}

function emptyDb(): DbShape {
  return { version: 1, sessions: [], active: {} };
}

function loadRaw(): DbShape {
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return emptyDb();
    const parsed = JSON.parse(s) as Partial<DbShape>;
    if (parsed.version !== 1 || !Array.isArray(parsed.sessions)) return emptyDb();
    return {
      version: 1,
      sessions: parsed.sessions as Session[],
      active: parsed.active ?? {},
    };
  } catch {
    return emptyDb();
  }
}

function saveRaw(db: DbShape): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // localStorage quota exceeded or unavailable — ignore (we'll re-try next save)
  }
}

/* ---------- Public API ---------- */

export function loadAll(): { sessions: Session[]; active: Record<string, string> } {
  const db = loadRaw();
  return { sessions: db.sessions, active: db.active };
}

export function saveAll(sessions: Session[], active: Record<string, string>): void {
  saveRaw({ version: 1, sessions, active });
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function newSession(event: EventId, name: string): Session {
  return { id: newId(), name, event, createdAt: Date.now(), solves: [] };
}

export function defaultSessionsForFreshDb(): Session[] {
  // Auto-create one default session for 3x3 so first launch has something usable.
  return [newSession('333', 'Session 1')];
}

/**
 * Mutate-and-save helper: load, mutate via cb, save. Returns the new state.
 */
export function mutate(cb: (db: { sessions: Session[]; active: Record<string, string> }) => void): {
  sessions: Session[]; active: Record<string, string>;
} {
  const cur = loadAll();
  cb(cur);
  saveAll(cur.sessions, cur.active);
  return cur;
}

/**
 * JSON export — full DB contents as a downloadable string.
 */
export function exportJson(): string {
  return JSON.stringify(loadRaw(), null, 2);
}

/**
 * JSON import — replace contents. Returns true on success.
 */
export function importJson(json: string): boolean {
  try {
    const parsed = JSON.parse(json);
    if (parsed.version !== 1 || !Array.isArray(parsed.sessions)) return false;
    saveRaw({ version: 1, sessions: parsed.sessions, active: parsed.active ?? {} });
    return true;
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
