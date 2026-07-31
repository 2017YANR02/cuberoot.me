/**
 * 智能魔方驱动的多人对战(battle_store 的 cubeArm / cubeStart / cubeStop)。
 * =========================================================================
 *
 * 两种语义都要,因为它们是两种真实场景:
 *
 *   `'own'`    每人自己一颗 —— 各连各的,谁拧谁起表;
 *   `'shared'` 全场一颗轮流 —— 事件全记在「现在拿着魔方的人」头上,他停表就传下一个。
 *
 * 这套动作和按键那条路**并存**,走的是同一批 player 字段,所以「一半人用魔方、一半人
 * 用键盘」必须自然成立 —— 这里专门有一条锁住它。
 *
 * 另外锁住三条容易被后续重构悄悄改掉的:
 *   1. `cubeArm` **不走**红灯延时(把魔方拧回打乱状态本身就是准备好了);
 *   2. `cubeStart` 用魔方那一下的**时刻**当起点,不是 `performance.now()`(BLE 会晚到);
 *   3. 没预备就转动**不起表**,起表后立刻「复原」**不算一把**。
 *
 * store 顶层会摸 localStorage / 打乱引擎,和 battle_start_mode.test.ts 一样 mock 掉。
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
vi.mock('@/app/[lang]/timer/_lib/scramble/wca_pool', () => ({
  hasWcaSource: () => false,
  peekWca: () => null,
  nextWca: () => Promise.resolve(null),
  prefetchWca: () => {},
  wcaMetaFor: () => null,
}));

const { useBattleStore, MAX_PLAYERS } = await import(
  '@/app/[lang]/timer/_battle/engine/battle_store'
);
const { ownerOf } = await import('@/app/[lang]/timer/_battle/useBattleCubes');

const DELAY = 300;

function resetPlayers(playerCount: number, cubeMode: 'own' | 'shared') {
  const s = useBattleStore.getState();
  s.cancelReadyTimer();
  useBattleStore.setState({
    mode: '1v1',
    playerCount,
    syncStart: false,
    cubeMode,
    cubeHolder: 0,
    winners: [],
    inspectionTime: 0,
    puzzleIds: Array.from({ length: MAX_PLAYERS }, () => '333'),
    scrambles: Array.from({ length: MAX_PLAYERS }, (_, i) => (i < playerCount ? "R U R' U'" : null)),
    scrambleLoadings: Array.from({ length: MAX_PLAYERS }, () => false),
    players: s.players.map((p, i) => ({
      ...p,
      id: i,
      isReady: false,
      canStart: false,
      isTiming: false,
      hasFinished: false,
      isInspecting: false,
      inspectionPenalty: null,
      rafId: null,
      time: 0,
      points: 0,
      phaseSplits: [],
      solveHistory: [],
    })),
  });
}

const P = (i: number) => useBattleStore.getState().players[i];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  resetPlayers(2, 'own');
});

describe('cubeArm', () => {
  it('直接绿灯,不用等红灯延时', () => {
    expect(useBattleStore.getState().cubeArm(0)).toBe(true);
    // 一毫秒都没过就已经可以起表了
    expect(P(0).canStart).toBe(true);
    expect(P(0).isReady).toBe(false);
  });

  it('没打乱就不给预备(还没拿到题,拧什么都不算)', () => {
    useBattleStore.setState({ scrambles: [null, null, null, null] });
    expect(useBattleStore.getState().cubeArm(0)).toBe(false);
    expect(P(0).canStart).toBe(false);
  });

  it('没参战的槽位一律不理', () => {
    expect(useBattleStore.getState().cubeArm(2)).toBe(false);
    expect(useBattleStore.getState().cubeArm(-1)).toBe(false);
  });

  it('全员拧完之后再预备 = 开下一轮(旧成绩清掉)', () => {
    for (const i of [0, 1]) {
      useBattleStore.getState().cubeArm(i);
      useBattleStore.getState().cubeStart(i, 0);
      useBattleStore.getState().cubeStop(i, 8000);
    }
    expect(P(0).hasFinished).toBe(true);
    expect(P(1).hasFinished).toBe(true);
    useBattleStore.getState().cubeArm(0);
    expect(P(0).hasFinished).toBe(false);
    expect(P(0).canStart).toBe(true);
  });
});

describe('cubeStart', () => {
  it('起点是魔方那一下的时刻,不是现在 —— BLE 晚到的几十毫秒不能白送', () => {
    useBattleStore.getState().cubeArm(0);
    vi.advanceTimersByTime(1000);          // 现在是 t=1000
    useBattleStore.getState().cubeStart(0, 940);   // 但那一下发生在 t=940
    expect(P(0).startTime).toBe(940);
    expect(P(0).isTiming).toBe(true);
  });

  it('没预备就转动不起表(还在打乱 / 手滑)', () => {
    expect(useBattleStore.getState().cubeStart(0, 0)).toBe(false);
    expect(P(0).isTiming).toBe(false);
  });

  it('已经在计时的人再来一下不重复起表', () => {
    useBattleStore.getState().cubeArm(0);
    useBattleStore.getState().cubeStart(0, 100);
    expect(useBattleStore.getState().cubeStart(0, 200)).toBe(false);
    expect(P(0).startTime).toBe(100);
  });

  it('只起自己这一路,队友不受影响', () => {
    useBattleStore.getState().cubeArm(0);
    useBattleStore.getState().cubeArm(1);
    useBattleStore.getState().cubeStart(0, 0);
    expect(P(0).isTiming).toBe(true);
    expect(P(1).isTiming).toBe(false);
    expect(P(1).canStart).toBe(true);
  });
});

describe('cubeStop', () => {
  it('用时 = 停表时刻 − 起表时刻,两个都是魔方给的', () => {
    useBattleStore.getState().cubeArm(0);
    useBattleStore.getState().cubeStart(0, 500);
    expect(useBattleStore.getState().cubeStop(0, 12860)).toBe(true);
    expect(P(0).time).toBe(12360);
    expect(P(0).hasFinished).toBe(true);
    expect(P(0).isTiming).toBe(false);
  });

  it('起表后立刻「复原」不算一把(打乱没拧完 / 误报)', () => {
    useBattleStore.getState().cubeArm(0);
    useBattleStore.getState().cubeStart(0, 0);
    expect(useBattleStore.getState().cubeStop(0, 50)).toBe(false);
    expect(P(0).isTiming).toBe(true);
    expect(P(0).hasFinished).toBe(false);
  });

  it('没在计时的人停不了表', () => {
    expect(useBattleStore.getState().cubeStop(0, 9999)).toBe(false);
  });
});

describe('一颗魔方轮流拧(shared)', () => {
  beforeEach(() => resetPlayers(3, 'shared'));

  it('这位停表,魔方就到下一位手里', () => {
    expect(useBattleStore.getState().cubeHolder).toBe(0);
    useBattleStore.getState().cubeArm(0);
    useBattleStore.getState().cubeStart(0, 0);
    useBattleStore.getState().cubeStop(0, 9000);
    expect(useBattleStore.getState().cubeHolder).toBe(1);
  });

  it('跳过已经拧完的人', () => {
    // 让 1 号先用键盘拧完
    useBattleStore.setState({
      players: useBattleStore.getState().players.map((p, i) =>
        (i === 1 ? { ...p, hasFinished: true, time: 5000 } : p)),
    });
    useBattleStore.getState().cubeArm(0);
    useBattleStore.getState().cubeStart(0, 0);
    useBattleStore.getState().cubeStop(0, 9000);
    expect(useBattleStore.getState().cubeHolder).toBe(2);
  });

  it('全员拧完就停在原地,不绕回一个已经拧完的人', () => {
    for (const i of [0, 1, 2]) {
      useBattleStore.getState().cubeArm(i);
      useBattleStore.getState().cubeStart(i, 0);
      useBattleStore.getState().cubeStop(i, 9000);
    }
    const holder = useBattleStore.getState().cubeHolder;
    expect(useBattleStore.getState().players[holder].hasFinished).toBe(true);
  });

  it('each-own 模式下停表**不**动持有者(那个字段在这个模式里没意义)', () => {
    resetPlayers(3, 'own');
    useBattleStore.getState().cubeArm(0);
    useBattleStore.getState().cubeStart(0, 0);
    useBattleStore.getState().cubeStop(0, 9000);
    expect(useBattleStore.getState().cubeHolder).toBe(0);
  });
});

describe('和按键那条路并存', () => {
  it('一个人用魔方、一个人用键盘,同一轮里各走各的', () => {
    // 0 号用魔方
    useBattleStore.getState().cubeArm(0);
    useBattleStore.getState().cubeStart(0, 0);
    // 1 号用键盘:按住 → 过红灯 → 松手
    useBattleStore.getState().playerDown(1);
    vi.advanceTimersByTime(DELAY + 1);
    useBattleStore.getState().playerUp(1);
    expect(P(0).isTiming).toBe(true);
    expect(P(1).isTiming).toBe(true);

    // 0 号魔方停表,1 号按键停表
    useBattleStore.getState().cubeStop(0, 9000);
    vi.advanceTimersByTime(6000);
    useBattleStore.getState().playerDown(1);
    expect(P(0).hasFinished).toBe(true);
    expect(P(1).hasFinished).toBe(true);
    expect(P(0).time).toBe(9000);
  });

  it('魔方预备之后还能用键盘停表(手上那颗断线了也不至于卡死)', () => {
    useBattleStore.getState().cubeArm(0);
    useBattleStore.getState().cubeStart(0, 0);
    vi.advanceTimersByTime(7000);
    useBattleStore.getState().playerDown(0);
    expect(P(0).hasFinished).toBe(true);
  });
});

describe('ownerOf —— 两种语义的全部差别就这一行', () => {
  it('own:第 i 路就是第 i 个人,持有者无关', () => {
    expect(ownerOf(0, 'own', 3)).toBe(0);
    expect(ownerOf(2, 'own', 0)).toBe(2);
  });

  it('shared:哪一路来的都记在持有者头上', () => {
    expect(ownerOf(0, 'shared', 2)).toBe(2);
    expect(ownerOf(3, 'shared', 1)).toBe(1);
  });
});

describe('setCubeMode / setCubeHolder', () => {
  it('换语义时把持有者归零(上一种模式的持有者没有意义)', () => {
    resetPlayers(3, 'shared');
    useBattleStore.getState().setCubeHolder(2);
    expect(useBattleStore.getState().cubeHolder).toBe(2);
    useBattleStore.getState().setCubeMode('own');
    expect(useBattleStore.getState().cubeHolder).toBe(0);
  });

  it('持有者不能指到没参战的槽位', () => {
    resetPlayers(2, 'shared');
    useBattleStore.getState().setCubeHolder(3);
    expect(useBattleStore.getState().cubeHolder).toBe(0);
  });
});
