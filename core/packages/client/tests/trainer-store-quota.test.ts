import { describe, it, expect, beforeEach } from 'vitest';

// 回归:线上 localStorage 被 timer 备份塞满时,trainer 全选(setSelected)曾因
// persist 先于 set() 抛 QuotaExceededError,状态更新被吞 → 点全选没反应。
// persist 现走 lib/safe-storage 的 persistItem(驱逐可再生缓存重试,永不抛)。

// 与 auth-store-quota.test.ts 同款的限额假 localStorage。
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

const { useTrainerStore } = await import('@/lib/trainer-store');
const { caseKey } = await import('@/lib/trainer-case-key');
type AlgCase = import('@cuberoot/shared').AlgCase;

const mkCase = (name: string): AlgCase => ({
  subgroup: 'T', name, standard: "R U R' U'", algs: [],
} as unknown as AlgCase);

describe('trainer-store quota resilience', () => {
  beforeEach(() => { g.localStorage = makeLocalStorage(1_000_000); });

  it('setSelected updates state even when localStorage is completely full', () => {
    const ls = makeLocalStorage(200);
    g.localStorage = ls;
    // 不可驱逐的活数据占满配额 → persist 必然失败
    ls.setItem('cuberoot-timer.v3', 'd'.repeat(180));

    const cases = [mkCase('A'), mkCase('B')];
    useTrainerStore.getState().loadSession('3x3', 'zbll', cases);
    const keys = cases.map(caseKey);
    useTrainerStore.getState().setSelected(keys);

    // 落盘失败,但选择状态必须照常生效(这就是线上点不了全选的 bug)
    expect(useTrainerStore.getState().selected).toEqual(keys);
    expect(ls.getItem('trainer:3x3/zbll')).toBeNull();
    expect(ls.getItem('cuberoot-timer.v3')).toBe('d'.repeat(180));
  });

  it('setSelected evicts regenerable backups and persists when possible', () => {
    const ls = makeLocalStorage(300);
    g.localStorage = ls;
    ls.setItem('cuberoot-timer.backup.v1.100', 'x'.repeat(120));
    ls.setItem('cuberoot-timer.backup.v1.200', 'x'.repeat(120));

    const cases = [mkCase('A'), mkCase('B')];
    useTrainerStore.getState().loadSession('3x3', 'zbll', cases);
    const keys = cases.map(caseKey);
    useTrainerStore.getState().setSelected(keys);

    expect(useTrainerStore.getState().selected).toEqual(keys);
    const raw = ls.getItem('trainer:3x3/zbll');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).selected).toEqual(keys);
    expect(ls._keys().some(k => k.startsWith('cuberoot-timer.backup.v1.'))).toBe(false);
  });
});
