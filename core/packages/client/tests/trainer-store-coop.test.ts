import { describe, it, expect, beforeEach } from 'vitest';

// 回归:复习模式「协同刷题」分片契约(零后端多设备)。
//  1) n 台各取一份,合起来覆盖全集各一次(不重不漏);
//  2) 乱序模式各设备同协同码 → 同一条全序 → 分片对齐;
//  3) 顺序模式无需码也不重不漏;
//  4) 关闭协同 = 单机整集。
// 白盒读 store.recapQueue —— draw() 把「已分片的本机队列」写在这里(其长度即侧栏
// 显示的 recap total,例如 472 → 236)。

function makeLocalStorage() {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    key(i: number) { return [...map.keys()][i] ?? null; },
    getItem(k: string) { return map.has(k) ? (map.get(k) as string) : null; },
    setItem(k: string, v: string) { map.set(k, v); },
    removeItem(k: string) { map.delete(k); },
    clear() { map.clear(); },
  };
}

const g = globalThis as unknown as { window?: unknown; localStorage?: ReturnType<typeof makeLocalStorage> };
g.window = { addEventListener() {} };
g.localStorage = makeLocalStorage();

const { useTrainerStore } = await import('@/lib/trainer-store');
const { caseKey } = await import('@/lib/trainer-case-key');
type AlgCase = import('@cuberoot/shared').AlgCase;
type TrainerRecapOrder = import('@/lib/trainer-store').TrainerRecapOrder;

const mkCase = (name: string): AlgCase => ({
  subgroup: 'T', name, standard: "R U R' U'", algs: [], sticker: { kind: 'pll' },
} as unknown as AlgCase);

function boot(names: string[]) {
  const cases = names.map(mkCase);
  const st = useTrainerStore.getState();
  st.loadSession('3x3', 'pll', cases);
  st.setSelected(cases.map(caseKey));
  return cases;
}

/** 装 pool + 复习模式 + 指定顺序 + 协同(第 k 台),返回本机分片队列。 */
function shard(names: string[], order: TrainerRecapOrder, code: string, n: number, k: number): string[] {
  boot(names);
  const st = useTrainerStore.getState();
  st.setMode('recap');
  st.setRecapOrder(order);
  st.setCoop({ on: true, code, n, k });
  return [...useTrainerStore.getState().recapQueue];
}

describe('trainer-store coop sharding', () => {
  beforeEach(() => { g.localStorage = makeLocalStorage(); });

  it('乱序同码:两台合起来覆盖全集各一次(不重不漏)', () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const a = shard(names, 'shuffle', 'TEAM', 2, 0);
    const b = shard(names, 'shuffle', 'TEAM', 2, 1);
    expect(a.length + b.length).toBe(names.length);        // 无交集 → 长度相加 = 全集
    expect(new Set([...a, ...b]).size).toBe(names.length); // 覆盖全集
    const setA = new Set(a);
    expect(b.some(k => setA.has(k))).toBe(false);          // 严格无交集
    expect(a.length).toBe(4);                              // 8 / 2 = 4/4
    expect(b.length).toBe(4);
  });

  it('顺序模式无需码也不重不漏(奇数集切 4/3)', () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const a = shard(names, 'seq', '', 2, 0);
    const b = shard(names, 'seq', '', 2, 1);
    expect(a.length + b.length).toBe(names.length);
    expect(new Set([...a, ...b]).size).toBe(names.length);
    expect(a.length).toBe(4); // 索引 0,2,4,6
    expect(b.length).toBe(3); // 索引 1,3,5
  });

  it('3 台各取一份,三份不重不漏', () => {
    const names = Array.from({ length: 9 }, (_, i) => `c${i}`);
    const shards = [0, 1, 2].map(k => shard(names, 'seq', '', 3, k));
    const merged = shards.flat();
    expect(merged.length).toBe(9);
    expect(new Set(merged).size).toBe(9);
    shards.forEach(s => expect(s.length).toBe(3));
  });

  it('乱序:同码两台切在同一条全序上(并集 == 单机整序的洗牌集)', () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F'];
    const a = shard(names, 'shuffle', 'ROOM9', 2, 0);
    const b = shard(names, 'shuffle', 'ROOM9', 2, 1);
    // 两台合起来 = 该 seed 洗出的完整队列(顺序无关,集合相等即证明切在同一全序)
    expect(new Set([...a, ...b]).size).toBe(names.length);
  });

  it('关闭协同回到单机整集', () => {
    const names = ['A', 'B', 'C', 'D'];
    shard(names, 'seq', '', 2, 0);                 // 先开(本机得 2 张)
    expect(useTrainerStore.getState().recapQueue.length).toBe(2);
    useTrainerStore.getState().setCoop({ on: false, code: '', n: 2, k: 0 });
    expect(useTrainerStore.getState().recapQueue.length).toBe(names.length); // 整集 4
  });
});
