/**
 * 多人对战的两种起表方式(battle_store.syncStart)。
 *
 *   默认 false = 各自开始 —— 谁按住谁进红灯、谁松手谁起表,不等别人;
 *        true  = 同时开始 —— 全员按住才亮绿灯,第一个松手的人带全员一起起表。
 *
 * 两种方式共用同一条轮次口径:全员停表后才记历史 / 判胜负 / 换打乱。这份口径 + 「先起表
 * 的人不能把打乱从还没起表的队友眼前抽走」是这次改动最容易被后续重构破坏的两点,故锁在这里。
 *
 * store 顶层会摸 localStorage / 打乱引擎,node 环境下:localStorage 走模块自带的 SSR shim,
 * 打乱引擎 + WCA 池在这里 mock 掉(本文件只测状态机,不测打乱内容)。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/app/[lang]/timer/_battle/engine/engine_loader', () => ({
  isScrambleEngineReady: () => true,
  loadScrambleEngine: () => Promise.resolve(),
}));
vi.mock('@/app/[lang]/timer/_battle/engine/scramble_engine', () => ({
  generateScramble: () => "R U R' U'",
  generateScrambleImageUrl: () => null,
}));
// 打乱来源默认是 WCA 真题(要发网络请求);测试一律走本地生成那条分支。
vi.mock('@/app/[lang]/timer/_lib/scramble/wca_pool', () => ({
  hasWcaSource: () => false,
  peekWca: () => null,
  nextWca: () => Promise.resolve(null),
  prefetchWca: () => {},
  wcaMetaFor: () => null,
}));

const { useBattleStore, isScrambleHidden } = await import(
  '@/app/[lang]/timer/_battle/engine/battle_store'
);

const DELAY = 300; // startDelay 默认值

/** 干净的两人对局:随机打乱已就位,双方都在 idle。 */
function resetTwoPlayer(syncStart: boolean) {
  const s = useBattleStore.getState();
  s.cancelReadyTimer();
  useBattleStore.setState({
    mode: '1v1',
    playerCount: 2,
    syncStart,
    winners: [],
    puzzleIds: ['333', '333', '333', '333'],
    scrambles: ["R U R' U'", "R U R' U'", null, null],
    scrambleLoadings: [false, false, false, false],
    players: s.players.map((p, i) => ({
      ...p,
      id: i,
      isReady: false,
      canStart: false,
      isTiming: false,
      hasFinished: false,
      time: 0,
      points: 0,
      solveHistory: [],
    })),
  });
}

/** 按住 → 等过红灯延时 → 松手起表。 */
function startSolve(playerId: number) {
  useBattleStore.getState().playerDown(playerId);
  vi.advanceTimersByTime(DELAY + 1);
  useBattleStore.getState().playerUp(playerId);
}

/** 计时若干毫秒后按下停表(playerDown 在计时中即停表,需超过 MIN_SOLVE_TIME)。 */
function stopSolve(playerId: number, afterMs = 5000) {
  vi.advanceTimersByTime(afterMs);
  useBattleStore.getState().playerDown(playerId);
}

beforeEach(() => {
  vi.useFakeTimers();
  // performance.now() 跟随 fake timer,elapsed 才是可预期的
  vi.setSystemTime(0);
});

describe('默认起表方式', () => {
  it('未设置过时默认「各自开始」', () => {
    // localStorage 在 node 下是空 shim → 走默认分支
    expect(useBattleStore.getState().syncStart).toBe(false);
  });
});

describe('各自开始(默认)', () => {
  beforeEach(() => resetTwoPlayer(false));

  it('一个人按住只点亮他自己的绿灯', () => {
    useBattleStore.getState().playerDown(0);
    vi.advanceTimersByTime(DELAY + 1);
    const { players } = useBattleStore.getState();
    expect(players[0].canStart).toBe(true);
    expect(players[1].canStart).toBe(false);
    expect(players[1].isReady).toBe(false);
  });

  it('一个人松手只起自己那一路,队友仍可从容起表', () => {
    startSolve(0);
    expect(useBattleStore.getState().players[0].isTiming).toBe(true);
    expect(useBattleStore.getState().players[1].isTiming).toBe(false);

    vi.advanceTimersByTime(3000);
    startSolve(1);
    const { players } = useBattleStore.getState();
    expect(players[1].isTiming).toBe(true);
    // 各自起表 → 起点不同(P1 晚了 ~3s + 一次红灯延时)
    expect(players[1].startTime).toBeGreaterThan(players[0].startTime + 3000);
  });

  it('先停表的人不能自己开下一轮,要等全员停表才结算', () => {
    startSolve(0);
    startSolve(1);
    stopSolve(0, 5000);
    expect(useBattleStore.getState().players[0].hasFinished).toBe(true);
    expect(useBattleStore.getState().players[1].isTiming).toBe(true);

    // P0 再按 → 无效(不重置回合、不抢跑),历史也还没落地
    useBattleStore.getState().playerDown(0);
    expect(useBattleStore.getState().players[0].isTiming).toBe(false);
    expect(useBattleStore.getState().players[0].solveHistory).toHaveLength(0);

    stopSolve(1, 3000);
    const { players, winners } = useBattleStore.getState();
    expect(players[0].solveHistory).toHaveLength(1);
    expect(players[1].solveHistory).toHaveLength(1);
    // 用时短的那位胜出(P0 跑 5s,P1 跑 8s)
    expect(winners).toEqual([0]);
    expect(players[0].points).toBe(1);
  });

  it('红灯期间松手只作废自己那条延时', () => {
    useBattleStore.getState().playerDown(0);
    useBattleStore.getState().playerDown(1);
    useBattleStore.getState().playerUp(0); // P0 反悔
    vi.advanceTimersByTime(DELAY + 1);
    const { players } = useBattleStore.getState();
    expect(players[0].isReady).toBe(false);
    expect(players[0].canStart).toBe(false);
    expect(players[1].canStart).toBe(true); // P1 的延时照常走完
  });

  it('系统取消触摸只撤销预备，绝不能当作松手起表', () => {
    useBattleStore.getState().playerDown(0);
    vi.advanceTimersByTime(DELAY + 1);
    expect(useBattleStore.getState().players[0].canStart).toBe(true);

    useBattleStore.getState().playerCancel(0);

    const { players } = useBattleStore.getState();
    expect(players[0]).toMatchObject({ isReady: false, canStart: false, isTiming: false });
    expect(players[1]).toMatchObject({ isReady: false, canStart: false, isTiming: false });
  });
});

describe('同时开始', () => {
  beforeEach(() => resetTwoPlayer(true));

  it('只有一个人按住时不亮绿灯', () => {
    useBattleStore.getState().playerDown(0);
    vi.advanceTimersByTime(DELAY + 1);
    expect(useBattleStore.getState().players[0].canStart).toBe(false);
  });

  it('全员按住才亮绿灯,一人松手带全员同一刻起表', () => {
    useBattleStore.getState().playerDown(0);
    useBattleStore.getState().playerDown(1);
    vi.advanceTimersByTime(DELAY + 1);
    let players = useBattleStore.getState().players;
    expect(players[0].canStart).toBe(true);
    expect(players[1].canStart).toBe(true);

    useBattleStore.getState().playerUp(0);
    players = useBattleStore.getState().players;
    expect(players[0].isTiming).toBe(true);
    expect(players[1].isTiming).toBe(true);
    expect(players[1].startTime).toBe(players[0].startTime);
  });

  it('任一人红灯期间松手,整条延时作废', () => {
    useBattleStore.getState().playerDown(0);
    useBattleStore.getState().playerDown(1);
    useBattleStore.getState().playerUp(1);
    vi.advanceTimersByTime(DELAY + 1);
    const { players } = useBattleStore.getState();
    expect(players[0].canStart).toBe(false);
    expect(players[1].canStart).toBe(false);
  });

  it('绿灯时任一触摸被系统取消会整组回 idle，而不是误起表或留下死锁', () => {
    useBattleStore.getState().playerDown(0);
    useBattleStore.getState().playerDown(1);
    vi.advanceTimersByTime(DELAY + 1);

    useBattleStore.getState().playerCancel(0);

    const { players } = useBattleStore.getState();
    expect(players.slice(0, 2).every((player) => (
      !player.isReady && !player.canStart && !player.isTiming
    ))).toBe(true);
  });
});

describe('纯布局变化', () => {
  it('旋转视口只换布局，不停表、不换打乱、不清赢家', () => {
    resetTwoPlayer(false);
    startSolve(0);
    useBattleStore.setState({ winners: [0] });
    const before = useBattleStore.getState();

    before.setLayout(before.layout === 'side' ? 'versus' : 'side');

    const after = useBattleStore.getState();
    expect(after.players).toBe(before.players);
    expect(after.players[0].isTiming).toBe(true);
    expect(after.scrambles).toBe(before.scrambles);
    expect(after.winners).toEqual([0]);
  });
});

describe('切换起表方式', () => {
  it('把在途的红灯 / 绿灯清干净,不留下永远等不到绿灯的玩家', () => {
    resetTwoPlayer(true);
    useBattleStore.getState().playerDown(0);
    useBattleStore.getState().playerDown(1);
    vi.advanceTimersByTime(DELAY + 1);
    expect(useBattleStore.getState().players[0].canStart).toBe(true);

    useBattleStore.getState().setSyncStart(false);
    const { players } = useBattleStore.getState();
    expect(players[0].canStart).toBe(false);
    expect(players[0].isReady).toBe(false);
    expect(players[1].canStart).toBe(false);
  });
});

describe('共享打乱的显隐', () => {
  const mk = (flags: Array<{ isTiming?: boolean; hasFinished?: boolean }>) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    flags.map(f => ({ isTiming: false, hasFinished: false, ...f })) as any;

  it('无人计时 → 显示', () => {
    expect(isScrambleHidden(mk([{}, {}]), [0, 1])).toBe(false);
  });

  it('各自开始:一人已起表、另一人还没 → 仍显示', () => {
    expect(isScrambleHidden(mk([{ isTiming: true }, {}]), [0, 1])).toBe(false);
  });

  it('两人都起表 → 隐藏', () => {
    expect(isScrambleHidden(mk([{ isTiming: true }, { isTiming: true }]), [0, 1])).toBe(true);
  });

  it('一人已停表、另一人还在拧 → 隐藏', () => {
    expect(isScrambleHidden(mk([{ hasFinished: true }, { isTiming: true }]), [0, 1])).toBe(true);
  });

  it('全员停表 → 重新显示', () => {
    expect(isScrambleHidden(mk([{ hasFinished: true }, { hasFinished: true }]), [0, 1])).toBe(false);
  });

  it('单格(不共享打乱):自己停表后照旧显示', () => {
    expect(isScrambleHidden(mk([{ isTiming: true }]), [0])).toBe(true);
    expect(isScrambleHidden(mk([{ hasFinished: true }]), [0])).toBe(false);
  });
});
