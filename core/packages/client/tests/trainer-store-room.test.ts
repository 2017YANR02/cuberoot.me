import { describe, it, expect, beforeEach, vi } from 'vitest';

// 回归:训练器「在线协同房间」的客户端状态机(mock 掉 trainer-room-api,只验 store 逻辑)。
//  1) 建房 → 领第一题落 current,recap.pos = 全局领取序号(合并进度);
//  2) nextScramble 逐题领取,推进 roomClaimed;
//  3) 队列领完 → recapRoundDone(真·全队同时结束);
//  4) continueRecapRound → 开下一轮再领第一题;
//  5) leaveRoom → 回本机模式。

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

// 内存房间模拟:createRoom 记下 keys,claimRoom 顺序出队,nextRoundRoom 重置游标 + 轮次。
const sim = { code: 'ROOM1', order: 'shuffle' as 'seq' | 'shuffle', round: 1, total: 0, keys: [] as string[], idx: 0 };
vi.mock('@/lib/trainer-room-api', () => ({
  createRoom: vi.fn(async (puzzle: string, set: string, order: 'seq' | 'shuffle', keys: string[]) => {
    sim.order = order; sim.round = 1; sim.total = keys.length; sim.keys = keys; sim.idx = 0;
    return { code: sim.code, puzzle, set, order, round: 1, total: keys.length };
  }),
  getRoom: vi.fn(async (code: string) => ({
    code, puzzle: '3x3', set: 'pll', order: sim.order, round: sim.round, total: sim.total,
    claimed: sim.idx, done: sim.idx >= sim.total,
  })),
  claimRoom: vi.fn(async (_code: string, round: number) => {
    if (round < sim.round) return { kind: 'advanced', round: sim.round, total: sim.total };
    if (sim.idx >= sim.total) return { kind: 'done', round: sim.round, total: sim.total };
    const i = sim.idx++;
    return { kind: 'case', caseKey: sim.keys[i], index: i, round: sim.round, total: sim.total };
  }),
  nextRoundRoom: vi.fn(async (_code: string, round: number) => {
    if (round === sim.round) { sim.round++; sim.idx = 0; }
    return { round: sim.round, total: sim.total };
  }),
}));

const { useTrainerStore } = await import('@/lib/trainer-store');
const { caseKey } = await import('@/lib/trainer-case-key');
type AlgCase = import('@cuberoot/shared').AlgCase;

const mkCase = (name: string): AlgCase => ({
  subgroup: 'T', name, standard: "R U R' U'", algs: [], sticker: { kind: 'pll' },
} as unknown as AlgCase);

const flush = async () => { await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0)); };

function boot(names: string[]) {
  const cases = names.map(mkCase);
  const st = useTrainerStore.getState();
  st.loadSession('3x3', 'pll', cases);
  st.setSelected(cases.map(caseKey));
  return cases;
}
const curRecap = () => {
  const h = useTrainerStore.getState().hist;
  return h.idx >= 0 ? h.list[h.idx].recap : undefined;
};

describe('trainer-store online room', () => {
  beforeEach(() => { g.localStorage = makeLocalStorage(); sim.round = 1; sim.idx = 0; });

  it('建房 → 领题 → 领完弹本轮结束 → 继续下一轮 → 离开', async () => {
    boot(['A', 'B', 'C']);
    const keys = ['A', 'B', 'C'].map(n => caseKey(mkCase(n)));

    const res = await useTrainerStore.getState().createRoom();
    await flush();
    expect(res.ok).toBe(true);
    let s = useTrainerStore.getState();
    expect(s.room?.code).toBe('ROOM1');
    expect(s.mode).toBe('recap');                 // 建房强制复习模式
    expect(s.currentKey).toBe(keys[0]);           // 领到第一题
    expect(curRecap()).toEqual({ pos: 1, total: 3 }); // pos = 全局领取序号
    expect(s.roomClaimed).toBe(1);
    expect(s.peek).toBeNull();                    // 房间模式不预抽

    useTrainerStore.getState().nextScramble();    // 领第 2 题
    await flush();
    expect(useTrainerStore.getState().currentKey).toBe(keys[1]);
    expect(curRecap()).toEqual({ pos: 2, total: 3 });

    useTrainerStore.getState().nextScramble();    // 领第 3 题(最后)
    await flush();
    expect(useTrainerStore.getState().currentKey).toBe(keys[2]);
    expect(curRecap()).toEqual({ pos: 3, total: 3 });

    useTrainerStore.getState().nextScramble();    // 队列领完 → done → 弹本轮结束
    await flush();
    s = useTrainerStore.getState();
    expect(s.recapRoundDone).toBe(true);
    expect(s.currentKey).toBe(keys[2]);           // 不前进

    useTrainerStore.getState().continueRecapRound(); // 开下一轮 → 领新一轮第一题
    await flush();
    s = useTrainerStore.getState();
    expect(s.recapRoundDone).toBe(false);
    expect(s.room?.round).toBe(2);
    expect(curRecap()).toEqual({ pos: 1, total: 3 }); // 下一轮第 1 题

    useTrainerStore.getState().leaveRoom();       // 离开 → 回本机模式
    await flush();
    s = useTrainerStore.getState();
    expect(s.room).toBeNull();
    expect(s.currentKey).not.toBeNull();          // 本机重新出题
  });

  it('本机落后(别人已开新一轮)→ claim 返回 advanced → 自动重同步再领', async () => {
    boot(['A', 'B']);
    await useTrainerStore.getState().createRoom();
    await flush();
    // 模拟别人开了下一轮:sim.round 前进,本机 room.round 仍是 1
    sim.round = 2; sim.idx = 0;
    useTrainerStore.getState().nextScramble(); // claim(round=1) → advanced → 重同步到 2 再领
    await flush();
    const s = useTrainerStore.getState();
    expect(s.room?.round).toBe(2);
    expect(s.currentKey).not.toBeNull();       // 重同步后成功领到题
  });
});
