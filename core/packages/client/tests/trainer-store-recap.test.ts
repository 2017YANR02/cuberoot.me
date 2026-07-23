import { describe, it, expect, beforeEach } from 'vitest';

// 回归:单机复习(recap)队列契约。
//  1) 复习队列 = 选中池整集(不分片);
//  2) 顺序模式(seq)= set 原序,与勾选先后无关;
//  3) 整集出完无缝重洗,不置 recapRoundDone(「本轮复习结束」弹窗只在线房间模式弹);
//  4) 训练模式(train)无 recap 进度,永不暂停。
// 白盒读 store.recapQueue —— draw() 把复习队列写在这里(其长度即侧栏显示的 recap total)。

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

// 当前题的本轮进度 {pos,total}
const curRecap = () => {
  const h = useTrainerStore.getState().hist;
  return h.idx >= 0 ? h.list[h.idx].recap : undefined;
};

describe('trainer-store recap queue', () => {
  beforeEach(() => { g.localStorage = makeLocalStorage(); });

  it('复习队列 = 选中池整集(不分片)', () => {
    const names = ['A', 'B', 'C', 'D', 'E'];
    boot(names);
    const st = useTrainerStore.getState();
    st.setMode('recap');
    st.setRecapOrder('seq');
    expect(useTrainerStore.getState().recapQueue.length).toBe(names.length);
    expect(new Set(useTrainerStore.getState().recapQueue).size).toBe(names.length);
  });

  it('顺序模式 = set 原序,与勾选先后无关', () => {
    const names = ['A', 'B', 'C', 'D'];
    const cases = names.map(mkCase);
    const keys = cases.map(caseKey);
    const st = useTrainerStore.getState();
    st.loadSession('3x3', 'pll', cases);
    st.setSelected([...keys].reverse()); // 逆序勾选
    st.setMode('recap');
    st.setRecapOrder('seq');
    // 队列仍按 set 原序(cases 的顺序),不随勾选先后变化
    expect(useTrainerStore.getState().recapQueue).toEqual(keys);
  });

  it('整集出完无缝重洗,不置 recapRoundDone', () => {
    boot(['A', 'B']);
    const st = useTrainerStore.getState();
    st.setMode('recap');
    st.setRecapOrder('seq');
    expect(curRecap()).toEqual({ pos: 1, total: 2 });
    useTrainerStore.getState().nextScramble();        // {2,2}
    useTrainerStore.getState().nextScramble();        // 出完 → 直接进下一轮,不暂停
    expect(useTrainerStore.getState().recapRoundDone).toBe(false);
    expect(curRecap()).toEqual({ pos: 1, total: 2 });
  });

  it('训练模式无 recap 进度,永不暂停', () => {
    boot(['A', 'B', 'C']);
    const st = useTrainerStore.getState();
    st.setMode('train');
    for (let i = 0; i < 6; i++) useTrainerStore.getState().nextScramble();
    expect(useTrainerStore.getState().recapRoundDone).toBe(false);
  });
});
