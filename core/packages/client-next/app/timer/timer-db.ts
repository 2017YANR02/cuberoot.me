/**
 * Solve storage — IndexedDB-backed with localStorage fallback.
 *
 * Schema (db "cuberoot-timer", v1):
 *   - solves: keyPath 'id'; indexes by 'event' (+ 'ts').
 *
 * Storage is keyed per event so the history list / stats can scope by current
 * event without scanning everything.
 *
 * NOTE: this is a minimal port of packages/client/src/pages/timer/storage/db.ts;
 * the original supports cstimer JSON / CSV / Speedstacks / reanalyze etc.
 * Those are deferred — see TODO at the top of page.tsx.
 */

export type EventId =
  | '333' | '222' | '444' | '555' | '666' | '777'
  | '333oh' | '333fm' | 'pyra' | 'skewb' | 'sq1' | 'mega' | 'clock'
  | 'custom';

export type Penalty = 'ok' | '+2' | 'DNF';

export interface Solve {
  id: string;
  timeMs: number;
  penalty: Penalty;
  scramble: string;
  event: EventId;
  ts: number;
  comment?: string;
}

export interface EventInfo {
  id: EventId;
  nameEn: string;
  nameZh: string;
}

export const EVENTS: EventInfo[] = [
  { id: '333', nameEn: '3x3', nameZh: '三阶' },
  { id: '222', nameEn: '2x2', nameZh: '二阶' },
  { id: '444', nameEn: '4x4', nameZh: '四阶' },
  { id: '555', nameEn: '5x5', nameZh: '五阶' },
  { id: '666', nameEn: '6x6', nameZh: '六阶' },
  { id: '777', nameEn: '7x7', nameZh: '七阶' },
  { id: '333oh', nameEn: '3x3 OH', nameZh: '三阶单手' },
  { id: 'pyra', nameEn: 'Pyraminx', nameZh: '金字塔' },
  { id: 'skewb', nameEn: 'Skewb', nameZh: '斜转' },
  { id: 'sq1', nameEn: 'Square-1', nameZh: 'SQ-1' },
  { id: 'mega', nameEn: 'Megaminx', nameZh: '五魔' },
  { id: 'clock', nameEn: 'Clock', nameZh: '魔表' },
  { id: 'custom', nameEn: 'Custom', nameZh: '自定义' },
];

export function effectiveMs(s: Solve): number {
  if (s.penalty === 'DNF') return Infinity;
  if (s.penalty === '+2') return s.timeMs + 2000;
  return s.timeMs;
}

const DB_NAME = 'cuberoot-timer';
const STORE_SOLVES = 'solves';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('no IndexedDB'));
  }
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SOLVES)) {
        const s = db.createObjectStore(STORE_SOLVES, { keyPath: 'id' });
        s.createIndex('event', 'event', { unique: false });
        s.createIndex('ts', 'ts', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function addSolve(s: Solve): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SOLVES, 'readwrite');
      tx.objectStore(STORE_SOLVES).put(s);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    fallbackPutSolve(s);
  }
}

export async function updateSolve(s: Solve): Promise<void> {
  return addSolve(s);
}

export async function deleteSolve(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SOLVES, 'readwrite');
      tx.objectStore(STORE_SOLVES).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    fallbackDeleteSolve(id);
  }
}

export async function loadSolves(event: EventId): Promise<Solve[]> {
  try {
    const db = await openDb();
    return await new Promise<Solve[]>((resolve, reject) => {
      const tx = db.transaction(STORE_SOLVES, 'readonly');
      const store = tx.objectStore(STORE_SOLVES);
      const idx = store.index('event');
      const req = idx.getAll(IDBKeyRange.only(event));
      req.onsuccess = () => {
        const all = (req.result as Solve[]).sort((a, b) => a.ts - b.ts);
        resolve(all);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return fallbackLoadSolves(event);
  }
}

export async function clearEvent(event: EventId): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SOLVES, 'readwrite');
      const store = tx.objectStore(STORE_SOLVES);
      const idx = store.index('event');
      const req = idx.openCursor(IDBKeyRange.only(event));
      req.onsuccess = () => {
        const cur = req.result;
        if (cur) {
          cur.delete();
          cur.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    fallbackClearEvent(event);
  }
}

export async function exportAllJson(): Promise<string> {
  try {
    const db = await openDb();
    const solves = await new Promise<Solve[]>((resolve, reject) => {
      const tx = db.transaction(STORE_SOLVES, 'readonly');
      const req = tx.objectStore(STORE_SOLVES).getAll();
      req.onsuccess = () => resolve(req.result as Solve[]);
      req.onerror = () => reject(req.error);
    });
    return JSON.stringify({ version: 1, solves }, null, 2);
  } catch {
    return fallbackExport();
  }
}

export async function importJson(json: string): Promise<number> {
  const parsed = JSON.parse(json) as { solves?: Solve[] };
  const solves = parsed.solves ?? [];
  let count = 0;
  for (const s of solves) {
    if (!s.id) continue;
    await addSolve(s);
    count++;
  }
  return count;
}

// ── localStorage fallback (private mode / no IDB) ────────────────────────────

const LS_KEY = 'cuberoot.timer.solves';

function fallbackLoadAll(): Solve[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Solve[];
  } catch { return []; }
}

function fallbackWriteAll(all: Solve[]): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch { /* quota */ }
}

function fallbackPutSolve(s: Solve): void {
  const all = fallbackLoadAll();
  const ix = all.findIndex((x) => x.id === s.id);
  if (ix >= 0) all[ix] = s; else all.push(s);
  fallbackWriteAll(all);
}

function fallbackDeleteSolve(id: string): void {
  fallbackWriteAll(fallbackLoadAll().filter((s) => s.id !== id));
}

function fallbackLoadSolves(event: EventId): Solve[] {
  return fallbackLoadAll().filter((s) => s.event === event).sort((a, b) => a.ts - b.ts);
}

function fallbackClearEvent(event: EventId): void {
  fallbackWriteAll(fallbackLoadAll().filter((s) => s.event !== event));
}

function fallbackExport(): string {
  return JSON.stringify({ version: 1, solves: fallbackLoadAll() }, null, 2);
}

export function makeSolve(args: {
  event: EventId;
  scramble: string;
  timeMs: number;
  penalty?: Penalty;
  comment?: string;
}): Solve {
  const ts = Date.now();
  const id = `${ts}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    ts,
    timeMs: args.timeMs,
    penalty: args.penalty ?? 'ok',
    scramble: args.scramble,
    event: args.event,
    comment: args.comment,
  };
}
