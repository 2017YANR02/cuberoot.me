import { describe, it, expect, beforeEach, vi } from 'vitest';

// 回归:训练器「在线协同房间」的客户端状态机(mock 掉 trainer-room-api,只验 store 逻辑)。
//  1) 建房 → 领第一题落 current,recap.pos = 全局领取序号(合并进度);
//  2) nextScramble 换题:手上有预取就同步扶正(不等网络),补领丢后台,推进 roomClaimed;
//  3) 队列领完 → recapRoundDone(真·全队同时结束);
//  4) continueRecapRound → 开下一轮再领第一题;
//  5) leaveRoom → 回本机模式。
//
// 领取数(roomClaimed / sim.idx)一律比「屏上摆着的」多一屏:单条多 1 条、三条一屏多 3 条 ——
// 那就是预取,别当成漏领或重复领。

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

// 内存房间模拟:createRoom 记下 keys,claimRoomBatch 顺序出队(最多 count 格),nextRoundRoom 重置游标 + 轮次。
const sim = { code: 'ROOM1', order: 'shuffle' as 'seq' | 'shuffle', round: 1, total: 0, keys: [] as string[], idx: 0 };
/** >0 时接下来这么多次 claim 抛 429(模拟限流);vi.mock 提升到顶层,用 var 让工厂能读到。 */
// eslint-disable-next-line no-var
var claimFail = 0;
vi.mock('@/lib/trainer-room-api', () => ({
  createRoom: vi.fn(async (puzzle: string, set: string, order: 'seq' | 'shuffle', keys: string[], start = 0) => {
    sim.order = order; sim.round = 1; sim.total = keys.length; sim.keys = keys; sim.idx = start;
    return { code: sim.code, puzzle, set, order, round: 1, total: keys.length, claimed: start };
  }),
  getRoom: vi.fn(async (code: string) => ({
    code, puzzle: '3x3', set: 'pll', order: sim.order, round: sim.round, total: sim.total,
    claimed: sim.idx, done: sim.idx >= sim.total,
  })),
  claimRoomBatch: vi.fn(async (_code: string, round: number, count: number) => {
    if (claimFail > 0) { claimFail--; throw new Error('Rate limit exceeded'); }
    if (round < sim.round) return { kind: 'advanced', round: sim.round, total: sim.total };
    if (sim.idx >= sim.total) return { kind: 'done', round: sim.round, total: sim.total };
    const cases: { caseKey: string; index: number }[] = [];
    for (let i = 0; i < count && sim.idx < sim.total; i++) {
      const idx = sim.idx++;
      cases.push({ caseKey: sim.keys[idx], index: idx });
    }
    return { kind: 'cases', cases, round: sim.round, total: sim.total };
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

/** 跑一个会踩到「限流退避重试」的动作:假时钟推过退避窗口,免得测试真等几秒。 */
const runPastBackoff = async (action: () => void) => {
  vi.useFakeTimers();
  try {
    action();
    await vi.advanceTimersByTimeAsync(5000);
  } finally {
    vi.useRealTimers();
  }
  await flush();
};

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
  beforeEach(() => { g.localStorage = makeLocalStorage(); sim.round = 1; sim.idx = 0; claimFail = 0; });

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
    expect(s.roomClaimed).toBe(2);                // 领了 2 格:屏上这条 + 揣手里的预取
    expect(s.peek?.key).toBe(keys[1]);            // 房间模式也预取一条 —— 下一次换题不等网络

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

  it('三条一屏:建房即领满三条(current+peek+peek2),切下一屏再领三条', async () => {
    boot(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']);
    const K = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].map(n => caseKey(mkCase(n)));
    const store = useTrainerStore.getState();
    store.leaveRoom();          // 清掉上个用例可能残留的房间,避免 fillPreviews 误领
    store.setTiming(false);     // 三条一屏仅不计时模式
    store.setMultiScramble(true);
    // leaveRoom 会触发单机 pickFresh 建复习队列;本用例测「无进度建房领全集」,先清掉单机进度。
    useTrainerStore.setState({ recapQueue: [], recapPos: 0, recapSig: '' });

    await useTrainerStore.getState().createRoom();
    await flush();
    let s = useTrainerStore.getState();
    expect(s.currentKey).toBe(K[0]);
    expect(s.peek?.key).toBe(K[1]);       // 预抽第 2 条
    expect(s.peek2?.key).toBe(K[2]);      // 预抽第 3 条
    expect(s.roomClaimed).toBe(6);        // 屏上三格 + 预备好的下一屏三格
    expect(s.hist.list.length).toBe(1);   // 仅 current 进历史,peek/peek2 是队尾预抽

    // 切下一屏 = 连推 3 格,领全新三条
    await useTrainerStore.getState().roomAdvance(3);
    await flush();
    s = useTrainerStore.getState();
    expect(s.currentKey).toBe(K[3]);
    expect(s.peek?.key).toBe(K[4]);
    expect(s.peek2?.key).toBe(K[5]);
    expect(s.roomClaimed).toBe(9);        // 又备好了再下一屏(K6/K7/K8)
    // 上一屏三条(K0/K1/K2)已进历史,current(K3)在队尾 → 「上三个」正好取 idx-3..idx-1
    const h = s.hist;
    expect(h.list[h.idx].key).toBe(K[3]);
    expect(h.list[h.idx - 1].key).toBe(K[2]);
    expect(h.list[h.idx - 2].key).toBe(K[1]);
    expect(h.list[h.idx - 3].key).toBe(K[0]);

    store.leaveRoom();
    store.setMultiScramble(false);        // 复位,避免污染其它用例
  });

  it('有复习进度:建房全集都入,从当前题接着来、进度不重置', async () => {
    useTrainerStore.getState().leaveRoom();
    boot(['A', 'B', 'C', 'D', 'E']);
    const K = ['A', 'B', 'C', 'D', 'E'].map(n => caseKey(mkCase(n)));
    // 走真实路径攒进度:seq 复习刷过 A、B,当前题是 C(3/5)。单条领取便于断言 currentKey。
    const st0 = useTrainerStore.getState();
    st0.setTiming(true);
    st0.setMultiScramble(false);
    st0.setMode('recap');
    st0.setRecapOrder('seq');
    st0.restartRecapRound();
    useTrainerStore.getState().nextScramble();
    useTrainerStore.getState().nextScramble();
    expect(curRecap()).toEqual({ pos: 3, total: 5 });
    expect(useTrainerStore.getState().currentKey).toBe(K[2]);

    await useTrainerStore.getState().createRoom();
    await flush();
    const s = useTrainerStore.getState();
    expect(sim.keys).toEqual(K);                  // 全集都入(total 不变 = 5)
    expect(s.room?.total).toBe(5);
    expect(sim.idx).toBe(4);                       // 起始游标 = start+2(跳过前 2 格,领了第 3 格 + 1 条预取)
    expect(s.currentKey).toBe(K[2]);              // 从第 3 个(index 2)继续 = 单机当前题 C
    expect(curRecap()).toEqual({ pos: 3, total: 5 }); // 进度接着显示 3/5,不重置到 1

    useTrainerStore.getState().leaveRoom();
  });

  // 生产事故回归(2026-07-26):刚开页面就建房,全队从 3/472 起步、头两个 case 永不派发。
  // 因 createRoom 拿 recapPos 当「已刷前缀」,而它是「已抽到第几格」—— 预抽 peek/peek2 让它
  // 一开局就等于 3,于是 start=2。线上 16 个房无一幸免:建房后 <200ms 游标即到 3,且这条分支
  // 顺手把 order 钉成 seq(store 默认是 shuffle,用户选的乱序全被吞掉)。
  it('毫无进度就建房:从第 1 格派发,且不篡改用户选的乱序', async () => {
    useTrainerStore.getState().leaveRoom();
    boot(['A', 'B', 'C', 'D', 'E']);
    const st0 = useTrainerStore.getState();
    st0.setTiming(true);
    st0.setMultiScramble(false);
    st0.setMode('recap');
    st0.setRecapOrder('shuffle');
    st0.restartRecapRound();                       // 开局:current = 1/5,而 recapPos 已是 3
    expect(curRecap()).toEqual({ pos: 1, total: 5 });
    expect(useTrainerStore.getState().recapPos).toBe(3); // ← 就是这个数曾被当成「已刷 3 个」

    await useTrainerStore.getState().createRoom();
    await flush();
    expect(sim.idx).toBe(2);                       // 首题领的是第 1 格(曾是第 3 格),第 2 格进预取
    expect(curRecap()).toEqual({ pos: 1, total: 5 }); // ← 事故点:曾显示 3/5
    expect(sim.order).toBe('shuffle');             // 用户选的顺序照旧(曾被钉死成 seq)

    useTrainerStore.getState().leaveRoom();
  });

  // 退房后本轮接着走,而不是从 1/N 重来 —— 否则房间里刷过的全白刷、还得再刷一遍。
  // 与建房那条互为逆操作(建房把本机进度带进房间,退房把房间进度带回本机)。
  it('退出房间回单机:停在同一题、进度接着走,刷过的不再出', async () => {
    useTrainerStore.getState().leaveRoom();
    boot(['A', 'B', 'C', 'D', 'E']);
    const K = ['A', 'B', 'C', 'D', 'E'].map(n => caseKey(mkCase(n)));
    const st0 = useTrainerStore.getState();
    st0.setTiming(true);
    st0.setMultiScramble(false);
    st0.setMode('recap');
    st0.setRecapOrder('seq');
    await useTrainerStore.getState().createRoom();
    await flush();
    useTrainerStore.getState().nextScramble();
    await flush();
    useTrainerStore.getState().nextScramble();
    await flush();
    expect(curRecap()).toEqual({ pos: 3, total: 5 });   // 房间里刷到第 3 题(C)
    expect(useTrainerStore.getState().currentKey).toBe(K[2]);

    useTrainerStore.getState().leaveRoom();
    await flush();
    const s = useTrainerStore.getState();
    expect(s.room).toBeNull();
    expect(curRecap()).toEqual({ pos: 3, total: 5 });   // 进度接着显示 3/5
    expect(s.currentKey).toBe(K[2]);                    // 还停在同一题,不重发也不跳过

    useTrainerStore.getState().nextScramble();
    expect(curRecap()).toEqual({ pos: 4, total: 5 });
    expect(useTrainerStore.getState().currentKey).toBe(K[3]); // 接着往下,A/B 不再出
  });

  it('退房时若一题都没领到(建房即退),照旧整轮从头开始', async () => {
    useTrainerStore.getState().leaveRoom();
    boot(['A', 'B', 'C', 'D', 'E']);
    const st0 = useTrainerStore.getState();
    st0.setTiming(true);
    st0.setMultiScramble(false);
    st0.setMode('recap');
    st0.setRecapOrder('seq');
    st0.restartRecapRound();
    useTrainerStore.setState({ room: { code: 'ROOM1', order: 'seq', round: 1, total: 5 }, hist: { list: [], idx: -1 } });

    useTrainerStore.getState().leaveRoom();
    await flush();
    expect(curRecap()).toEqual({ pos: 1, total: 5 });
  });

  // 生产事故回归(2026-07-26):claim 被限流 429,客户端把「领取失败」当成「本轮领完」,
  // 弹「全队已刷完全部 472 个 case」;用户点「继续下一轮」→ 真的重洗并把全队进度清零,
  // 再 claim 再 429 再弹窗,30 秒内房间空转到第 6 轮(DB next_index 一直是 0)。
  it('领取失败(限流/断网)只报错,绝不冒充本轮结束', async () => {
    useTrainerStore.getState().leaveRoom();
    boot(['A', 'B', 'C']);
    await useTrainerStore.getState().createRoom();
    await flush();

    claimFail = 99;                                  // 持续 429(含内部退避重试)
    // 先把手上的预取吃掉:这一下是同步换题,后台补领失败也不该打扰用户
    await runPastBackoff(() => useTrainerStore.getState().nextScramble());
    const before = useTrainerStore.getState().currentKey;
    expect(useTrainerStore.getState().roomError).toBeNull(); // 后台的错咽回去
    expect(useTrainerStore.getState().peek).toBeNull();      // 手空了

    // 手空再点:这一下真的等网络,失败必须如实报错
    await runPastBackoff(() => useTrainerStore.getState().nextScramble());
    const s = useTrainerStore.getState();
    expect(s.recapRoundDone).toBe(false);            // ← 事故点:曾误置 true 弹窗
    expect(s.roomError).toMatch(/Rate limit/);
    expect(s.currentKey).toBe(before);               // 题面原地不动
    expect(sim.round).toBe(1);                       // 房间轮次没被误推进

    claimFail = 0;                                   // 恢复后照常领题
    useTrainerStore.getState().nextScramble();
    await flush();
    expect(useTrainerStore.getState().currentKey).not.toBe(before);
    useTrainerStore.getState().leaveRoom();
  });

  it('限流一次后退避重试成功,用户无感', async () => {
    useTrainerStore.getState().leaveRoom();
    boot(['A', 'B', 'C']);
    await useTrainerStore.getState().createRoom();
    await flush();
    const before = useTrainerStore.getState().currentKey;

    claimFail = 1;                                   // 只失败一次 → 内部重试应该救回来
    await runPastBackoff(() => useTrainerStore.getState().nextScramble());
    const s = useTrainerStore.getState();
    expect(s.recapRoundDone).toBe(false);
    expect(s.currentKey).not.toBe(before);
    expect(s.peek).not.toBeNull();                   // 预取补上了 ⟹ 那次退避重试确实成功了
    useTrainerStore.getState().leaveRoom();
  });

  it('本机落后(别人已开新一轮)→ claim 返回 advanced → 自动重同步再领', async () => {
    useTrainerStore.getState().leaveRoom();
    boot(['A', 'B']);
    await useTrainerStore.getState().createRoom();
    await flush();
    // 先吃掉手上的预取,下一次点击才会真去领(否则同步扶正就走完了,压根不发请求)
    useTrainerStore.getState().nextScramble();
    await flush();
    // 模拟别人开了下一轮:sim.round 前进,本机 room.round 仍是 1
    sim.round = 2; sim.idx = 0;
    useTrainerStore.getState().nextScramble(); // claim(round=1) → advanced → 重同步到 2 再领
    await flush();
    const s = useTrainerStore.getState();
    expect(s.room?.round).toBe(2);
    expect(s.currentKey).not.toBeNull();       // 重同步后成功领到题
  });
  // 核心契约(issue #62「协同模式换题延迟大」):点一下就换题,不等 claim 回包 —— 手上永远
  // 揣着一条预取,网络往返只发生在后台补领。这里把 claim 悬住不回包,题面照样立刻前进。
  it('换题不等网络:claim 悬着不回包,题面也已经换过去', async () => {
    useTrainerStore.getState().leaveRoom();
    boot(['A', 'B', 'C', 'D']);
    const K = ['A', 'B', 'C', 'D'].map(n => caseKey(mkCase(n)));
    await useTrainerStore.getState().createRoom();
    await flush();
    expect(useTrainerStore.getState().peek?.key).toBe(K[1]);  // 建房就多领一条揣手里

    const api = await import('@/lib/trainer-room-api');
    const deferred: { resolve?: (r: unknown) => void } = {};
    const pending = new Promise<never>(r => { deferred.resolve = r as unknown as (v: unknown) => void; });
    vi.mocked(api.claimRoomBatch).mockImplementationOnce(() => pending);

    useTrainerStore.getState().nextScramble();                // 故意不 await
    expect(useTrainerStore.getState().currentKey).toBe(K[1]); // ← 契约:回包之前题面就换好了
    expect(useTrainerStore.getState().peek).toBeNull();       // 预取用掉了,补领在途

    deferred.resolve!({ kind: 'cases', cases: [{ caseKey: K[2], index: 2 }], round: 1, total: 4 });
    await flush();
    const s = useTrainerStore.getState();
    expect(s.peek?.key).toBe(K[2]);                           // 补领回来只落进预取
    expect(s.currentKey).toBe(K[1]);                          // 题面不被回包再动一次
    useTrainerStore.getState().leaveRoom();
  });
});
