'use client';

/**
 * useBattleCubes — 对战里的智能魔方,两种语义一套代码。
 * ==========================================================================
 *
 * 用户没定语义,因为**两种都是真的**:
 *
 *   `'own'`    每人自己一颗。家里几个人各带各的魔方,各连各的,谁拧谁起表。
 *   `'shared'` 全场一颗轮流拧。线下活动上常见 —— 只有一颗智能魔方,拧完传下一个。
 *
 * 所以这里不选一种,而是把两种做成同一套东西的两个投影:**永远开 MAX_PLAYERS 路
 * 连接**(`useBluetoothCube` 一次调用就是一路,而 hooks 不能进循环,所以只能写死
 * 调 4 次 —— MAX_PLAYERS 本来就是常量),再把「这一路的事件算在谁头上」这件事
 * 交给语义决定:
 *
 *   own    → 第 i 路算第 i 个人;
 *   shared → 只有第 0 路在用,它的事件算在 `cubeHolder` 头上,那个人停表就换下一个。
 *
 * 换句话说,`'shared'` 不是「另一种连接方式」,而是**同一路连接换了记账对象**。
 * 这是这两种语义唯一真正的区别,所以代码里也只该有这一处差别。
 *
 * ## 起表怎么判
 *
 * 和 solo 那边同一条(csTimer 的规矩,`bluetoothAutoReady: 'scrambled'` 是站内默认):
 *
 *   魔方状态 == 这个人的打乱  → 预备(`cubeArm`)
 *   预备之后第一下转动        → 起表(`cubeStart`)
 *   拧回复原                  → 停表(`cubeStop`)
 *
 * 三个动作在 store 里,和按键那条路并存(见 battle_store 的注释);这个文件只负责
 * 把 BLE 事件翻译成「谁的第几个动作」。
 *
 * ## 时刻
 *
 * `onMove` 给的是 BLE 值到达时的 `performance.now()`,和 store 里的时间同一口径,
 * 所以原样往下传。`onSolved` 不带时刻 —— 它是状态跃迁的回调 —— 这一路只能用
 * 「最近一手的时刻」当停表点,比 `performance.now()` 准(BLE 会晚到)。
 */

import { useCallback, useEffect, useRef } from 'react';

import { useBluetoothCube } from '../_lib/bluetooth';
import type { BluetoothCubeHandle } from '../_lib/bluetooth';
import { applyScramble, facesEqual, type CubeFaces } from '../_lib/cube/state';
import { stageSegmentsFor } from '../_lib/reconstruct/stage_segments';
import { appendSolves, makeSolve } from '../_lib/storage/db';
import type { EventId } from '../_lib/types';
import { battleToTimerEvent, MAX_PLAYERS, useBattleStore } from './engine/battle_store';
import { PENALTY } from './engine/constants';

export interface BattleCubes {
  /** 每个槽位一路连接(`'shared'` 下只有 [0] 在用)。长度恒为 MAX_PLAYERS。 */
  handles: BluetoothCubeHandle[];
  /** 这个槽位现在有没有一颗连着的魔方(已按语义折算)。 */
  isLive: (playerId: number) => boolean;
  /** 这个槽位该点哪一路的「连接」按钮(`'shared'` 下所有人都指向第 0 路)。 */
  handleFor: (playerId: number) => BluetoothCubeHandle;
}

export interface BattleCubesOpts {
  /**
   * GAN / MoYu / QiYi 这些用 MAC 当解密密钥的牌子,广播里读不到 MAC 时要问用户。
   * 四路共用一个回调,第一个参数说是哪一路 —— 弹窗本来就只开一个。
   */
  onNeedMac?: (slot: number, deviceName: string, isWrongKey?: boolean) => Promise<string | null>;
}

/**
 * 这一路的事件算在谁头上。own = 自己;shared = 现在拿着魔方的人。
 *
 * 导出只为可测:这一行就是两种语义的**全部**差别,值得单独钉住 —— 以后谁把它
 * 改成「shared 也按槽位」,测试要立刻红。
 */
export function ownerOf(slot: number, cubeMode: 'own' | 'shared', holder: number): number {
  return cubeMode === 'shared' ? holder : slot;
}

export function useBattleCubes(opts: BattleCubesOpts = {}): BattleCubes {
  // 回调可能每次渲染都是新的;用 ref 打住,免得四路连接跟着重挂。
  const onNeedMacRef = useRef(opts.onNeedMac);
  onNeedMacRef.current = opts.onNeedMac;
  const needMac = useCallback(
    (slot: number, deviceName: string, isWrongKey?: boolean) =>
      onNeedMacRef.current?.(slot, deviceName, isWrongKey) ?? Promise.resolve(null),
    [],
  );

  // 每一路最近一手的时刻。onSolved 不带时刻,停表点用它 —— 用 performance.now()
  // 会把 BLE 那几十毫秒的延迟白算进成绩里。
  const lastMoveAtRef = useRef<number[]>(Array.from({ length: MAX_PLAYERS }, () => 0));
  // 这一路上一次是不是已经预备过了。BLE 会把同一个状态重复报上来,重复 arm 本身
  // 无害(store 幂等),但重复算「第一下转动」就会把起表时刻往后挪。
  const armedRef = useRef<boolean[]>(Array.from({ length: MAX_PLAYERS }, () => false));
  /**
   * 这一把的转动流,每路一份。对战的成绩表只存数字,所以在此之前,拿智能魔方在
   * 对战里拧的每一把都是**扔掉的**。这里把它按 Solo 那条路留一份到本机计时记录里
   * (同一个 `makeSolve` + `stageSegmentsFor` + `appendSolves`),复盘 / 回放 / 分段
   * 统计就全都有了 —— 对战自己的记分板一个字都不用改。
   */
  const trackRef = useRef<Array<{ moves: Array<{ m: string; ts: number }>; t0: number; scramble: string; event: string }>>(
    Array.from({ length: MAX_PLAYERS }, () => ({ moves: [], t0: 0, scramble: '', event: '333' })),
  );
  const deviceRef = useRef<Array<{ model: string; name: string } | null>>(
    Array.from({ length: MAX_PLAYERS }, () => null),
  );

  const onMove = useCallback((slot: number, move: string, ts: number) => {
    lastMoveAtRef.current[slot] = ts;
    const st = useBattleStore.getState();
    const owner = ownerOf(slot, st.cubeMode, st.cubeHolder);
    const p = st.players[owner];
    if (p.isTiming) { trackRef.current[slot].moves.push({ m: move, ts: ts - trackRef.current[slot].t0 }); return; }
    if (armedRef.current[slot] && p.canStart) {
      armedRef.current[slot] = false;
      if (!st.cubeStart(owner, ts)) return;
      // 起表那一手也属于这一把,零点就定在它身上。
      trackRef.current[slot] = {
        moves: [{ m: move, ts: 0 }],
        t0: ts,
        scramble: st.scrambles[owner] ?? '',
        event: st.puzzleIds[owner],
      };
      return;
    }
    // 没预备就转动 —— 可能正在拧打乱。下面的 checkArm 会在拧到位时把预备补上。
  }, []);

  const onSolved = useCallback((slot: number) => {
    const st = useBattleStore.getState();
    const owner = ownerOf(slot, st.cubeMode, st.cubeHolder);
    const stopped = st.cubeStop(owner, lastMoveAtRef.current[slot] || performance.now());
    armedRef.current[slot] = false;
    if (!stopped) return;                       // 没成把(太短 / 没在计时)就不留档
    const track = trackRef.current[slot];
    trackRef.current[slot] = { moves: [], t0: 0, scramble: '', event: '333' };
    if (track.moves.length === 0 || !track.scramble) return;
    const ev = battleToTimerEvent(track.event) as EventId;
    // 停表已经把观察罚时结算进 player.penalty 了,照抄过来 —— 本机记录和对战记分板
    // 对同一把不该给出两个判罚。
    const done = useBattleStore.getState().players[owner];
    const solve = makeSolve({
      timeMs: done.time,
      scramble: track.scramble,
      event: ev,
      penalty: done.penalty === PENALTY.DNF ? 'DNF' : done.penalty === PENALTY.PLUS2 ? '+2' : 'ok',
    });
    solve.moves = track.moves;
    if (deviceRef.current[slot]) solve.device = deviceRef.current[slot]!;
    const segs = stageSegmentsFor(solve);
    if (segs) solve.stageSegments = segs;
    appendSolves(ev, [solve]);
  }, []);

  // 打乱后的目标状态,按「打乱字符串」缓存 —— 每一手都重算一次 applyScramble 太浪费,
  // 而打乱一轮才换一次。
  const targetCacheRef = useRef<Map<string, CubeFaces | null>>(new Map());
  const targetFor = (scramble: string): CubeFaces | null => {
    const cache = targetCacheRef.current;
    if (!cache.has(scramble)) {
      let t: CubeFaces | null = null;
      try { t = applyScramble(3, scramble); } catch { t = null; }
      if (cache.size > 32) cache.clear();
      cache.set(scramble, t);
    }
    return cache.get(scramble) ?? null;
  };

  /**
   * 拧到与打乱一致 → 预备。每一手之后查一次:这是站内 solo 的默认判据
   * (`bluetoothAutoReady: 'scrambled'`,csTimer `giiSD='s'`),对战沿用同一条,
   * 不另发明。只有三阶能比 —— 追踪器建模的就是三阶。
   */
  const checkArm = useCallback((slot: number, handle: BluetoothCubeHandle) => {
    const st = useBattleStore.getState();
    const owner = ownerOf(slot, st.cubeMode, st.cubeHolder);
    const p = st.players[owner];
    if (p.isTiming || p.canStart) return;
    if (st.puzzleIds[owner] !== '333') return;
    const scramble = st.scrambles[owner];
    if (!scramble) return;
    const target = targetFor(scramble);
    if (!target) return;
    const faces = handle.getFaces();
    if (!faces || !facesEqual(faces, target)) return;
    if (!st.cubeArm(owner)) return;
    armedRef.current[slot] = true;
    // 哪颗魔方拧的,在预备这一刻定下来 —— 中途掉线不该把这一把的出处抹掉。
    deviceRef.current[slot] = handle.status.connected
      ? { model: handle.status.brand, name: handle.status.deviceName }
      : null;
  }, []);

  // hooks 不能进循环 —— MAX_PLAYERS 是常量,所以写死四次。多出来的那几路在
  // 没人点「连接」之前不碰任何 GATT,代价是零。
  const h0 = useSlot(0, onMove, onSolved, checkArm, needMac);
  const h1 = useSlot(1, onMove, onSolved, checkArm, needMac);
  const h2 = useSlot(2, onMove, onSolved, checkArm, needMac);
  const h3 = useSlot(3, onMove, onSolved, checkArm, needMac);
  const handles = [h0, h1, h2, h3];

  const cubeMode = useBattleStore(s => s.cubeMode);

  const handleFor = useCallback(
    (playerId: number) => handles[cubeMode === 'shared' ? 0 : playerId] ?? handles[0],
    // handles 每次渲染都是新数组,但里面的 handle 是稳定的;依赖写 cubeMode 就够。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cubeMode, h0, h1, h2, h3],
  );

  const isLive = useCallback(
    (playerId: number) => handleFor(playerId).status.connected,
    [handleFor],
  );

  return { handles, isLive, handleFor };
}

/** 一路连接。抽出来只是为了让上面那四行看着像四行。 */
function useSlot(
  slot: number,
  onMove: (slot: number, move: string, ts: number) => void,
  onSolved: (slot: number) => void,
  checkArm: (slot: number, handle: BluetoothCubeHandle) => void,
  needMac: (slot: number, deviceName: string, isWrongKey?: boolean) => Promise<string | null>,
): BluetoothCubeHandle {
  // handle 要在自己的回调里被读到,而它是这次调用的返回值 —— 用 ref 打个结。
  // 在 effect 里写而不是渲染期写:连接必须由用户点出来,所以第一次 BLE 回调一定
  // 晚于挂载 effect,拿不到 null。
  const selfRef = useRef<BluetoothCubeHandle | null>(null);
  const handle = useBluetoothCube({
    onMove: (m, ts) => {
      onMove(slot, m, ts);
      if (selfRef.current) checkArm(slot, selfRef.current);
    },
    onSolved: () => onSolved(slot),
    onNeedMac: (deviceName, isWrongKey) => needMac(slot, deviceName, isWrongKey),
  });
  useEffect(() => { selfRef.current = handle; });
  return handle;
}
