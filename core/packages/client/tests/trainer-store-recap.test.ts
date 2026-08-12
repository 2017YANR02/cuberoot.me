import { describe, it, expect, beforeEach } from 'vitest';

// 回归:单机复习(recap)队列契约。
//  1) 复习队列 = 选中池整集(不分片);
//  2) 顺序模式(seq)= set 原序,与勾选先后无关;
//  3) 整集出完默认停下来弹「本轮复习结束」,也可关闭后直接换轮;
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
  beforeEach(() => {
    g.localStorage = makeLocalStorage();
    useTrainerStore.getState().setMultiScramble(false);
    useTrainerStore.getState().setShowRecapRoundEnd(true);
  });

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

  it('整集出完停下来弹窗,「继续下一轮」才进新一轮', () => {
    boot(['A', 'B']);
    const st = useTrainerStore.getState();
    st.setMode('recap');
    st.setRecapOrder('seq');
    expect(curRecap()).toEqual({ pos: 1, total: 2 });
    useTrainerStore.getState().nextScramble();        // {2,2}
    expect(curRecap()).toEqual({ pos: 2, total: 2 });
    useTrainerStore.getState().nextScramble();        // 出完 → 拦住,弹「本轮复习结束」
    expect(useTrainerStore.getState().recapRoundDone).toBe(true);
    expect(curRecap()).toEqual({ pos: 2, total: 2 });  // 题面停在最后这个,没偷偷翻页
    useTrainerStore.getState().continueRecapRound();
    expect(useTrainerStore.getState().recapRoundDone).toBe(false);
    expect(curRecap()).toEqual({ pos: 1, total: 2 });
  });

  it('「先不了」停在原地,再点一下直接进新一轮(本轮不再弹)', () => {
    boot(['A', 'B']);
    const st = useTrainerStore.getState();
    st.setMode('recap');
    st.setRecapOrder('seq');
    useTrainerStore.getState().nextScramble();
    useTrainerStore.getState().nextScramble();
    expect(useTrainerStore.getState().recapRoundDone).toBe(true);
    useTrainerStore.getState().dismissRecapRound();
    expect(useTrainerStore.getState().recapRoundDone).toBe(false);
    expect(curRecap()).toEqual({ pos: 2, total: 2 });  // 关掉弹窗不换题
    useTrainerStore.getState().nextScramble();         // 这一下不再弹,直接进新一轮
    expect(useTrainerStore.getState().recapRoundDone).toBe(false);
    expect(curRecap()).toEqual({ pos: 1, total: 2 });
    // 新一轮刷完照弹(acked 只管上一轮)
    useTrainerStore.getState().nextScramble();
    useTrainerStore.getState().nextScramble();
    expect(useTrainerStore.getState().recapRoundDone).toBe(true);
  });

  it('关闭本轮结束提示后直接进入下一轮', () => {
    boot(['A', 'B']);
    const st = useTrainerStore.getState();
    st.setMode('recap');
    st.setRecapOrder('seq');
    st.setShowRecapRoundEnd(false);

    st.nextScramble();
    expect(curRecap()).toEqual({ pos: 2, total: 2 });
    st.nextScramble();
    expect(useTrainerStore.getState().recapRoundDone).toBe(false);
    expect(curRecap()).toEqual({ pos: 1, total: 2 });
  });

  it('分轮训练即使关闭偏好也必须停下来选择下一轮', () => {
    const cases = ['A', 'B'].map(mkCase);
    const st = useTrainerStore.getState();
    st.loadSession('3x3', 'rounds', cases, { roundEndPromptRequired: true });
    st.setSelected(cases.map(caseKey));
    st.setMode('recap');
    st.setRecapOrder('seq');
    st.setShowRecapRoundEnd(false);

    st.nextScramble();
    st.nextScramble();
    expect(useTrainerStore.getState().recapRoundDone).toBe(true);
    expect(curRecap()).toEqual({ pos: 2, total: 2 });
  });

  it('F2L 覆盖模式用最少 16 题走完全部 AUF × y 组合', () => {
    const f2lCase: AlgCase = {
      subgroup: 'T',
      name: 'F2L',
      setup: "R U R'",
      algs: [],
      sticker: { kind: 'f2l', fl: '' },
    };
    const st = useTrainerStore.getState();
    st.setRandomFinalAuf(true);
    st.setRandomFinalY(true);
    st.setShowRecapRoundEnd(false);
    st.loadSession('3x3', 'f2l', [f2lCase]);
    st.setSelected([caseKey(f2lCase)]);
    st.setMode('recap');

    const seen: string[] = [];
    for (let i = 0; i < 16; i++) {
      const cur = useTrainerStore.getState();
      const adjustment = cur.hist.list[cur.hist.idx]?.f2lFinalAdjustment;
      expect(adjustment).toBeDefined();
      seen.push(`${adjustment?.auf}|${adjustment?.y}`);
      if (i < 15) cur.nextScramble();
    }
    expect(new Set(seen).size).toBe(16);
  });

  // 三条一屏:屏上摆的是 current + peek + peek2,所以「刷完没」要看 peek2 而不是 current,
  // 「继续下一轮」也得一次翻过去三条 —— 否则新一屏会带上刚做完的那两条。
  it('三条一屏:整屏三条都是本轮的,弹窗与继续都按屏算', () => {
    boot(['A', 'B', 'C', 'D', 'E', 'F']);
    const st = useTrainerStore.getState();
    st.setMode('recap');
    st.setRecapOrder('seq');
    st.setMultiScramble(true);
    const screenNext = () => { for (let i = 0; i < 3; i++) useTrainerStore.getState().nextScramble(); };
    expect(curRecap()).toEqual({ pos: 1, total: 6 });   // 屏上 1、2、3
    screenNext();
    expect(curRecap()).toEqual({ pos: 4, total: 6 });   // 屏上 4、5、6 = 本轮最后一屏
    screenNext();
    expect(useTrainerStore.getState().recapRoundDone).toBe(true);
    expect(curRecap()).toEqual({ pos: 4, total: 6 });   // 停在原地,没把新一轮的混进这一屏
    useTrainerStore.getState().continueRecapRound();
    expect(curRecap()).toEqual({ pos: 1, total: 6 });   // 新一屏 = 新一轮的 1、2、3
  });

  it('重开一轮:进度归 1,成绩不动', () => {
    boot(['A', 'B', 'C', 'D']);
    const st = useTrainerStore.getState();
    st.setMode('recap');
    st.setRecapOrder('seq');
    useTrainerStore.getState().nextScramble();
    useTrainerStore.getState().nextScramble();
    expect(curRecap()).toEqual({ pos: 3, total: 4 });
    const solvesBefore = useTrainerStore.getState().solves;
    useTrainerStore.getState().restartRecapRound();
    expect(curRecap()).toEqual({ pos: 1, total: 4 });
    expect(useTrainerStore.getState().hist.list.length).toBe(1); // 打乱历史一并清空
    expect(useTrainerStore.getState().solves).toBe(solvesBefore); // 成绩是长期资产,不清
  });

  it('训练模式下重开一轮是空操作', () => {
    boot(['A', 'B', 'C']);
    const st = useTrainerStore.getState();
    st.setMode('train');
    useTrainerStore.getState().nextScramble();
    const before = useTrainerStore.getState().hist.list.length;
    useTrainerStore.getState().restartRecapRound();
    expect(useTrainerStore.getState().hist.list.length).toBe(before);
  });

  it('训练模式无 recap 进度,永不暂停', () => {
    boot(['A', 'B', 'C']);
    const st = useTrainerStore.getState();
    st.setMode('train');
    for (let i = 0; i < 6; i++) useTrainerStore.getState().nextScramble();
    expect(useTrainerStore.getState().recapRoundDone).toBe(false);
  });
});
