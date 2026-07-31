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
const { ownerOf, slotCounts, recordsToLocalHistory } = await import(
  '@/app/[lang]/timer/_battle/useBattleCubes'
);

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

/**
 * 回归(审查发现):`cubeHolder` 是**指进玩家数组的下标**,所以凡是重建这个数组的动作
 * 都得把它拉回范围内。写入口 `setCubeHolder` 一直有边界检查,漏的是「范围在存好的值
 * **底下**缩了」这条路 —— 4 人 shared、魔方在 3 号手里,改成 2 人之后 `cubeHolder`
 * 还是 3,`inPlay(3)` = false,于是 arm / start / stop 全被拒,魔方彻底哑掉。而且**自愈
 * 不了**:`advanceCubeHolder` 只能从 `cubeStop` 进,而 `cubeStop` 自己就先被拒了;界面上
 * 3 号的传递 chip 也不渲染,用户点不到。所以测试不能只看字段,要一路拧到停表。
 */
describe('参战人数变了之后魔方还能用', () => {
  it('4 人 shared 缩到 2 人:魔方交回 0 号,预备/起表/停表整条路都还通', () => {
    resetPlayers(4, 'shared');
    useBattleStore.getState().setCubeHolder(3);
    expect(useBattleStore.getState().cubeHolder).toBe(3);

    useBattleStore.getState().setPlayerCount(2);
    expect(useBattleStore.getState().cubeHolder).toBe(0);

    // 光看字段不算数 —— 真拧一把:0 号槽的事件记在持有者(还是 0 号)头上。
    useBattleStore.setState({
      scrambles: Array.from({ length: MAX_PLAYERS }, (_, i) => (i < 2 ? "R U R' U'" : null)),
    });
    const st = useBattleStore.getState();
    expect(st.cubeArm(0)).toBe(true);
    expect(P(0).canStart).toBe(true);
    expect(st.cubeStart(0, 1000)).toBe(true);
    expect(P(0).isTiming).toBe(true);
    expect(st.cubeStop(0, 6000)).toBe(true);
    expect(P(0).time).toBe(5000);
  });

  it('切到 solo 也一样(solo 只有 0 号在场)', () => {
    resetPlayers(4, 'shared');
    useBattleStore.getState().setCubeHolder(2);
    useBattleStore.getState().setMode('solo');
    expect(useBattleStore.getState().cubeHolder).toBe(0);
  });
});

/**
 * 回归(审查发现):传魔方原先只挂在 `cubeStop` 上,可是「拧完」不止魔方那一条路。
 * 队友用按键停表、观察超时自动 DNF,都会让持有者变成一个**已经拧完**的人;而
 * `cubeArm` 对已完成的人恒拒,于是下一位怎么拧都预备不了 —— 整颗魔方这一轮就废了。
 * 现在挂在 `checkBothFinished` 上(四条「拧完」的路都汇到那儿),因此也必须**幂等**:
 * 持有者自己还没拧完的时候,别人拧完不该把魔方从他手里推走。
 */
describe('传魔方跟的是「有人拧完了」,不是「魔方停的表」', () => {
  it('持有者用按键停表,魔方照样传给下一位', () => {
    resetPlayers(3, 'shared');
    const st = useBattleStore.getState();
    expect(st.cubeHolder).toBe(0);
    // P1 走按键那条路:预备 → 起表 → 停表
    st.playerDown(0);
    vi.advanceTimersByTime(DELAY + 10);
    st.playerUp(0);
    expect(P(0).isTiming).toBe(true);
    vi.advanceTimersByTime(5000);
    st.playerDown(0);
    expect(P(0).hasFinished).toBe(true);
    expect(useBattleStore.getState().cubeHolder).toBe(1);
  });

  it('轮到的人自己还没拧完时,别人拧完不动他手里的魔方', () => {
    resetPlayers(3, 'shared');
    useBattleStore.getState().setCubeHolder(1);
    const st = useBattleStore.getState();
    // P3(槽位 2)先用按键拧完 —— 魔方在 P2 手里,不该被推走
    st.playerDown(2);
    vi.advanceTimersByTime(DELAY + 10);
    st.playerUp(2);
    vi.advanceTimersByTime(5000);
    st.playerDown(2);
    expect(P(2).hasFinished).toBe(true);
    expect(useBattleStore.getState().cubeHolder).toBe(1);
  });

  it('传走之后下一位能预备(原来这里是死的)', () => {
    resetPlayers(2, 'shared');
    const st = useBattleStore.getState();
    st.playerDown(0);
    vi.advanceTimersByTime(DELAY + 10);
    st.playerUp(0);
    vi.advanceTimersByTime(5000);
    st.playerDown(0);
    expect(useBattleStore.getState().cubeHolder).toBe(1);
    expect(useBattleStore.getState().cubeArm(1)).toBe(true);
    expect(P(1).canStart).toBe(true);
  });
});

/**
 * 回归(审查发现):「同时开始」下预备是一次**集合**,`checkBothReady` 要求全员
 * `isReady && !canStart`。而 `cubeArm` 原先直接给绿灯(`isReady:false, canStart:true`),
 * 于是那条判据永远凑不齐 —— 谁都起不了表,这一轮连结算都走不到,只能关掉「同时开始」
 * 或刷新页面。混着用魔方和按键是这个功能明写的场景,而 shared 语义下非持有者**必然**
 * 在用按键,所以这条是必踩的。
 */
describe('同时开始 + 智能魔方', () => {
  beforeEach(() => {
    resetPlayers(2, 'own');
    useBattleStore.setState({ syncStart: true });
  });

  it('魔方预备的人按「已准备」入列,不自己先绿', () => {
    expect(useBattleStore.getState().cubeArm(0)).toBe(true);
    expect(P(0).isReady).toBe(true);
    expect(P(0).canStart).toBe(false);
  });

  it('魔方 + 按键各一人:两人到齐后一起绿灯', () => {
    useBattleStore.getState().cubeArm(0);
    useBattleStore.getState().playerDown(1);
    vi.advanceTimersByTime(DELAY + 10);
    expect(P(0).canStart).toBe(true);
    expect(P(1).canStart).toBe(true);
  });

  it('绿灯之后魔方那一路照常起表、停表,这一轮能结算', () => {
    useBattleStore.getState().cubeArm(0);
    useBattleStore.getState().playerDown(1);
    vi.advanceTimersByTime(DELAY + 10);
    expect(useBattleStore.getState().cubeStart(0, 1000)).toBe(true);
    expect(useBattleStore.getState().cubeStop(0, 6000)).toBe(true);
    expect(P(0).time).toBe(5000);
    // 按键那位照常收尾,全员拧完 = 这一轮真的结算得掉
    useBattleStore.getState().playerUp(1);
    vi.advanceTimersByTime(4000);
    useBattleStore.getState().playerDown(1);
    expect(P(1).hasFinished).toBe(true);
    expect(useBattleStore.getState().winners.length).toBeGreaterThan(0);
  });

  it('各自开始时仍旧直接绿灯(没有红灯延时那 300ms)', () => {
    useBattleStore.setState({ syncStart: false });
    expect(useBattleStore.getState().cubeArm(0)).toBe(true);
    expect(P(0).canStart).toBe(true);
  });
});

/**
 * 回归(审查发现):四路连接一直挂着,换语义并不断开谁。`'shared'` 的定义是「只有
 * 第 0 路在用」,可原先没人挡 —— own 模式下连好的那几颗切到 shared 之后还在报事件,
 * 而 `ownerOf` 把它们全记到持有者头上:队友碰一下手边那颗闲置的(恰好复原态)魔方,
 * 持有者的表就被停了。
 */
describe('slotCounts —— shared 语义下只有第 0 路算数', () => {
  it('own:四路都算自己的', () => {
    for (let i = 0; i < MAX_PLAYERS; i++) expect(slotCounts(i, 'own')).toBe(true);
  });

  it('shared:只有第 0 路算,别的一律不理', () => {
    expect(slotCounts(0, 'shared')).toBe(true);
    for (let i = 1; i < MAX_PLAYERS; i++) expect(slotCounts(i, 'shared')).toBe(false);
  });
});

/**
 * 回归(审查发现):同屏对战里 P2~P4 是**别人**,他们的成绩原先照样被写进本机计时
 * 记录 —— 也就是设备主人的练习历史,直接污染 PB / Ao5 / 分段统计,而 `Solve` 里没有
 * 「谁拧的」这个字段,事后再也筛不出来。
 */
describe('recordsToLocalHistory —— 只留设备主人自己的把', () => {
  it('own:只有 P1 那一路进本机历史', () => {
    expect(recordsToLocalHistory(0, 'own', 0)).toBe(true);
    for (let i = 1; i < MAX_PLAYERS; i++) expect(recordsToLocalHistory(i, 'own', 0)).toBe(false);
  });

  it('shared:同样一路连接,轮到别人时就不进 —— 判据是折算后的人,不是槽位', () => {
    expect(recordsToLocalHistory(0, 'shared', 0)).toBe(true);
    expect(recordsToLocalHistory(0, 'shared', 1)).toBe(false);
    expect(recordsToLocalHistory(0, 'shared', 3)).toBe(false);
  });
});
