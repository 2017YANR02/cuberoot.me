import { describe, it, expect, beforeEach } from 'vitest';

// 回归:训练器「当前题 + 两级下一题预览(peek / peek2)」的 lookahead 契约。
//  1) 出题时 current 与 peek、peek2 同时就位;
//  2) 出下一题 = 把 peek 扶正为 current、peek2 递补为 peek,打乱一字不差(train 随机也不重 roll);
//  3) 停表记录成绩并自动换题(current 前进到原 peek);
//  4) ← 回看后下一题回落到历史 idx+1。
// peek2 是二级预抽:UI 据它把「下一个」卡片将显示的图提前一格离屏预取,换题右图秒出。

// 最小假 localStorage(store 初始化会读 window / localStorage)。
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

// sticker.kind 非 'f2l' 即走常规 AUF 路径;standard 提供 inv 打乱的底稿。
const mkCase = (name: string): AlgCase => ({
  subgroup: 'T', name, standard: "R U R' U'", algs: [], sticker: { kind: 'pll' },
} as unknown as AlgCase);

/** 建会话 + 全选 + 出第一道题(模拟 run 页挂载后的初始出题 effect)。 */
function boot(names: string[]) {
  const cases = names.map(mkCase);
  const st = useTrainerStore.getState();
  st.loadSession('3x3', 'pll', cases);
  st.setSelected(cases.map(caseKey));
  useTrainerStore.getState().nextScramble();
  return cases;
}

describe('trainer-store lookahead (peek)', () => {
  beforeEach(() => { g.localStorage = makeLocalStorage(); });

  it('出题时 current 与两级预览 peek / peek2 同时就位', () => {
    boot(['A', 'B', 'C']);
    const s = useTrainerStore.getState();
    expect(s.currentKey).not.toBeNull();
    expect(s.currentScramble).toBeTruthy();
    expect(s.peek).not.toBeNull();
    expect(s.peek!.key).toBeTruthy();
    expect(s.peek!.scramble).toBeTruthy();
    expect(s.peek2).not.toBeNull();                         // 二级预抽也就位
    expect(s.peek2!.scramble).toBeTruthy();
  });

  it('出下一题把 peek 扶正为 current、peek2 递补为 peek,打乱一字不差、不重 roll', () => {
    boot(['A', 'B', 'C']);
    const before = useTrainerStore.getState();
    const previewedKey = before.peek!.key;
    const previewedScramble = before.peek!.scramble;
    const previewed2Key = before.peek2!.key;
    const previewed2Scramble = before.peek2!.scramble;

    useTrainerStore.getState().nextScramble();

    const after = useTrainerStore.getState();
    expect(after.currentKey).toBe(previewedKey);            // 看到的下一题 == 现在要做的这题
    expect(after.currentScramble).toBe(previewedScramble);  // 同一条打乱,而非重新生成
    expect(after.peek).not.toBeNull();                      // 又预抽好了新的下一题
    expect(after.peek!.key).toBe(previewed2Key);            // 原 peek2 递补为新 peek(同一条打乱)
    expect(after.peek!.scramble).toBe(previewed2Scramble);
    expect(after.peek2).not.toBeNull();                     // 并再预抽一条新的 peek2
  });

  it('停表记录成绩并自动换题:预览的下一题扶正为当前题', async () => {
    boot(['A', 'B', 'C']);
    const before = useTrainerStore.getState();
    const solvedKey = before.currentKey;            // 刚做完这把
    const previewedKey = before.peek!.key;           // 之前预览的下一题
    const previewedScramble = before.peek!.scramble;

    useTrainerStore.getState().startTimer();
    useTrainerStore.getState().stopTimer();
    await new Promise(r => setTimeout(r, 0));         // 放行 stopTimer 里的 setTimeout(nextScramble)

    const after = useTrainerStore.getState();
    expect(after.solves.length).toBe(1);
    expect(after.solves[0].caseKey).toBe(solvedKey); // 成绩记在刚做完这把
    expect(after.currentKey).toBe(previewedKey);      // 自动前进到「原来预览的下一题」
    expect(after.currentScramble).toBe(previewedScramble);
    expect(after.peek).not.toBeNull();               // 又预抽了新的下一题
  });

  it('← 回看后,下一题预览回落到历史里 idx+1 那条', () => {
    boot(['A', 'B', 'C']);
    useTrainerStore.getState().nextScramble(); // 再出一道 → 历史 [x0, x1],idx=1
    const atEnd = useTrainerStore.getState();
    const x1Key = atEnd.currentKey;

    useTrainerStore.getState().prevScramble(); // 回看到 x0,idx=0
    const back = useTrainerStore.getState();
    // 历史中段:下一题 = 历史里 idx+1(x1),而不是队尾之后的 peek
    const nextEntry = back.hist.list[back.hist.idx + 1];
    expect(nextEntry.key).toBe(x1Key);
  });
});
