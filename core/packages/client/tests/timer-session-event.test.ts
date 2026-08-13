import { beforeEach, describe, expect, it, vi } from 'vitest';

function makeLocalStorage() {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    key(i: number) { return [...map.keys()][i] ?? null; },
    getItem(k: string) { return map.get(k) ?? null; },
    setItem(k: string, v: string) { map.set(k, v); },
    removeItem(k: string) { map.delete(k); },
    clear() { map.clear(); },
  };
}

const storage = makeLocalStorage();
const globalWithStorage = globalThis as unknown as {
  window?: unknown;
  localStorage?: ReturnType<typeof makeLocalStorage>;
};
globalWithStorage.window = { addEventListener() {} };
globalWithStorage.localStorage = storage;

const DB_KEY = 'cuberoot-timer.v3';

function seed(sessions: unknown[], activeSessionId: string, dataBySession: Record<string, unknown>) {
  storage.setItem(DB_KEY, JSON.stringify({
    version: 3,
    sessions,
    activeSessionId,
    dataBySession,
  }));
}

async function loadDb() {
  vi.resetModules();
  return import('@/app/[lang]/timer/_lib/storage/db');
}

describe('timer session event associations', () => {
  beforeEach(() => storage.clear());

  it('associates a new session with the current event', async () => {
    seed([{ id: 'a', name: 'A', createdTs: 1 }], 'a', { a: {} });
    const db = await loadDb();
    const id = db.createSession('2x2', '222');

    expect(db.getSessionEvent(id)).toBe('222');
  });

  it('activates a matching session and safely infers legacy single-event data', async () => {
    seed(
      [
        { id: 'a', name: 'A', createdTs: 1, event: '333' },
        { id: 'b', name: 'B', createdTs: 2 },
      ],
      'a',
      {
        a: {},
        b: {
          '222': [{ id: 'x', timeMs: 1000, penalty: 'ok', scramble: 'R', event: '222', ts: 3 }],
        },
      },
    );
    const db = await loadDb();

    expect(db.activateSessionForEvent('222')).toBe('b');
    expect(db.getActiveSessionId()).toBe('b');
    expect(db.listSessions().find(session => session.id === 'b')?.event).toBe('222');
  });

  it('does not guess for a legacy session containing multiple events', async () => {
    seed(
      [{ id: 'a', name: 'Mixed', createdTs: 1 }],
      'a',
      {
        a: {
          '333': [{ id: 'x', timeMs: 1000, penalty: 'ok', scramble: 'R', event: '333', ts: 2 }],
          '222': [{ id: 'y', timeMs: 900, penalty: 'ok', scramble: 'U', event: '222', ts: 3 }],
        },
      },
    );
    const db = await loadDb();

    expect(db.getSessionEvent('a')).toBeNull();
    expect(db.activateSessionForEvent('222')).toBeNull();
  });
});
