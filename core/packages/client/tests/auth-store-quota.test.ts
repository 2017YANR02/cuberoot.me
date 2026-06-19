import { describe, it, expect, beforeEach } from 'vitest';

// Budget-limited fake localStorage: setItem throws (like iOS Safari's
// "The quota has been exceeded.") once total chars would exceed the budget.
// `used()` mirrors the helper's view (key.length + value.length).
function makeLocalStorage(budgetChars: number) {
  const map = new Map<string, string>();
  const used = () => [...map].reduce((n, [k, v]) => n + k.length + v.length, 0);
  return {
    get length() { return map.size; },
    key(i: number) { return [...map.keys()][i] ?? null; },
    getItem(k: string) { return map.has(k) ? (map.get(k) as string) : null; },
    setItem(k: string, v: string) {
      const prev = map.get(k);
      map.delete(k);
      if (used() + k.length + v.length > budgetChars) {
        if (prev !== undefined) map.set(k, prev);
        throw new Error('The quota has been exceeded.');
      }
      map.set(k, v);
    },
    removeItem(k: string) { map.delete(k); },
    clear() { map.clear(); },
    _keys() { return [...map.keys()]; },
  };
}

type FakeLS = ReturnType<typeof makeLocalStorage>;

// Globals must exist before importing the module (its store init reads them).
const g = globalThis as unknown as { window?: unknown; localStorage?: FakeLS };
g.window = { addEventListener() {} };
g.localStorage = makeLocalStorage(1_000_000);

const { persistAuthItem } = await import('@/lib/auth-store');

function setLS(ls: FakeLS) { g.localStorage = ls; }

describe('persistAuthItem quota resilience', () => {
  beforeEach(() => { setLS(makeLocalStorage(1_000_000)); });

  it('stores normally when there is room', () => {
    const ls = makeLocalStorage(1_000_000);
    setLS(ls);
    expect(persistAuthItem('wca_user', '{"wcaId":"2017FOOB01"}')).toBe(true);
    expect(ls.getItem('wca_user')).toBe('{"wcaId":"2017FOOB01"}');
  });

  it('evicts timer backups + recon cache to make room, then succeeds', () => {
    const ls = makeLocalStorage(200);
    setLS(ls);
    ls.setItem('cuberoot-timer.backup.v1.100', 'x'.repeat(50));
    ls.setItem('cuberoot-timer.backup.v1.200', 'x'.repeat(50));
    // Near full; a fresh auth write would overflow.
    expect(() => ls.setItem('wca_access_token', 'a'.repeat(80))).toThrow();

    expect(persistAuthItem('wca_access_token', 'a'.repeat(80))).toBe(true);
    expect(ls.getItem('wca_access_token')).toBe('a'.repeat(80));
    // Redundant backups were evicted.
    expect(ls._keys().some(k => k.startsWith('cuberoot-timer.backup.v1.'))).toBe(false);
  });

  it('returns false and preserves live data when nothing is evictable', () => {
    const ls = makeLocalStorage(200);
    setLS(ls);
    // The live timer DB is NOT evictable — must never be dropped.
    ls.setItem('cuberoot-timer.v3', 'd'.repeat(180));

    expect(persistAuthItem('wca_user', 'v'.repeat(60))).toBe(false);
    expect(ls.getItem('wca_user')).toBeNull();
    expect(ls.getItem('cuberoot-timer.v3')).toBe('d'.repeat(180));
  });
});
