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
 * `onMove` 给的是校准到 `performance.now()` 口径的魔方动作时刻,所以原样往下传。
 * 动作触发的 `onSolved` 会带同一个时刻;只有纯状态快照没有,那时回退到最近一手。
 */

import { useCallback, useEffect, useRef } from 'react';
import { timerSupportsLocalBattleSmartCube } from '@cuberoot/shared/timer';

import { useBluetoothCube } from '../_lib/bluetooth';
import type { BluetoothCubeHandle } from '../_lib/bluetooth';
import { GyroRecorder, encodeGyroTrack } from '../_lib/bluetooth/gyro_track';
import type { Quat } from '../_lib/bluetooth/orientation';
import { applyScramble, facesEqual, type CubeFaces } from '../_lib/cube/state';
import { useSettings } from '../_lib/settings';
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

/**
 * 这一路的事件算不算数。
 *
 * `'shared'` 的定义就是「只有第 0 路在用」(见文件头),可是四路连接**一直挂着**,
 * 换语义时并不会把 1~3 路断开。于是在 own 模式下连好的那几颗,切到 shared 之后
 * 还在报事件,而 `ownerOf` 会把它们**全部**记到持有者头上 —— 队友把手边那颗闲置
 * 的魔方碰一下(它恰好是复原态),持有者的表就被停掉了。所以要在入口挡住。
 */
export function slotCounts(slot: number, cubeMode: 'own' | 'shared'): boolean {
  return cubeMode !== 'shared' || slot === 0;
}

/**
 * 这一把该不该进**本机计时记录**。
 *
 * 本机记录是「我」的练习历史 —— PB / Ao5 / 分段统计都从它来,而 `Solve` 里根本没有
 * 「这是谁拧的」这个字段,混进去就再也分不开。同屏对战里 P2~P4 是**别人**:own 语义
 * 下他们各连各的魔方,shared 语义下轮到他们的那几把也走第 0 路 —— 两条都得挡掉,
 * 所以判据是折算之后的 `owner`,不是槽位。他们的成绩照常进对战记分板,那是另一本账。
 */
export function recordsToLocalHistory(
  slot: number, cubeMode: 'own' | 'shared', holder: number,
): boolean {
  return slotCounts(slot, cubeMode) && ownerOf(slot, cubeMode, holder) === 0;
}

/**
 * 一把的身份 = 谁的哪一次起表。`startTime` 由 store 在起表那一刻写死(魔方那条路
 * 用魔方给的时刻,按键那条路用 `performance.now()`,同一口径),所以它天然就是
 * 「这一把」的编号:换人、换轮、重新起表都会变。
 */
function attemptKey(owner: number, startTime: number): string {
  return `${owner}:${startTime}`;
}

interface Track {
  /** 这份缓冲属于哪一把(`attemptKey`)。`''` = 空的,不属于任何一把。 */
  attempt: string;
  moves: Array<{ m: string; ts: number }>;
  t0: number;
  scramble: string;
  event: string;
}

const emptyTrack = (): Track => ({ attempt: '', moves: [], t0: 0, scramble: '', event: '333' });

export function useBattleCubes(opts: BattleCubesOpts = {}): BattleCubes {
  // 回调可能每次渲染都是新的;用 ref 打住,免得四路连接跟着重挂。
  const onNeedMacRef = useRef(opts.onNeedMac);
  onNeedMacRef.current = opts.onNeedMac;
  const needMac = useCallback(
    (slot: number, deviceName: string, isWrongKey?: boolean) =>
      onNeedMacRef.current?.(slot, deviceName, isWrongKey) ?? Promise.resolve(null),
    [],
  );

  // 每一路最近一手的时刻。纯状态快照触发 solved 时没有动作时刻,才用它兜底。
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
  const trackRef = useRef<Array<Track>>(
    Array.from({ length: MAX_PLAYERS }, emptyTrack),
  );
  const deviceRef = useRef<Array<{ model: string; name: string } | null>>(
    Array.from({ length: MAX_PLAYERS }, () => null),
  );
  /**
   * 姿态流,每路一份。开关沿用 Solo 的 `recordGyro` 设置 —— 一个人不会「在单人想录、
   * 在对战不想录」,所以这里不另开一个开关。
   *
   * 零点用 `performance.now()` 自己记一个,不用起表时刻:起表时刻是**魔方那一下**的
   * 时刻(来自 BLE 事件),而陀螺仪回调根本不带时间戳,两个钟相减出来的是垃圾 ——
   * 和 Solo 那边踩过的是同一个坑。
   */
  const gyroRecRef = useRef<GyroRecorder[]>(Array.from({ length: MAX_PLAYERS }, () => new GyroRecorder()));
  const gyroStartRef = useRef<number[]>(Array.from({ length: MAX_PLAYERS }, () => 0));

  /**
   * 这一路的缓冲对得上当前这一把吗?对不上就重开一份。
   *
   * 缓冲原先只在「魔方起表」那条路上开、只在「魔方停表成功」那条路上清。可是一把的
   * **开始和结束都不止那一条路**:队友可以用按键起表(那一刻缓冲还留着上一把的),
   * 这一轮也可以被重置 / 判 DNF 掉(那一刻缓冲永远等不到那次成功的停表)。于是上一把
   * 的转动流会原样挂到下一把的记录上,连打乱字段都还是上一把那条 —— 存下来的复盘
   * 从头到尾是错的。所以缓冲要认「这是谁的哪一次起表」,对不上就整份丢掉重开。
   *
   * 零点统一取 `startTime`(而不是各记各的):转动流和姿态流必须共用一个零点,
   * `rotationsByStep` 就是拿姿态流的时刻去对转动流切出来的步界的。
   */
  const syncTrack = useCallback((slot: number, owner: number): Track => {
    const st = useBattleStore.getState();
    const p = st.players[owner];
    const key = attemptKey(owner, p.startTime);
    if (trackRef.current[slot].attempt !== key) {
      trackRef.current[slot] = {
        attempt: key,
        moves: [],
        t0: p.startTime,
        scramble: st.scrambles[owner] ?? '',
        event: st.puzzleIds[owner],
      };
      gyroRecRef.current[slot].reset();
      gyroStartRef.current[slot] = p.startTime;
    }
    return trackRef.current[slot];
  }, []);

  const onMove = useCallback((slot: number, move: string, ts: number) => {
    const st = useBattleStore.getState();
    if (!slotCounts(slot, st.cubeMode)) return;
    lastMoveAtRef.current[slot] = ts;
    const owner = ownerOf(slot, st.cubeMode, st.cubeHolder);
    const p = st.players[owner];
    if (p.isTiming) {
      const track = syncTrack(slot, owner);
      track.moves.push({ m: move, ts: ts - track.t0 });
      return;
    }
    if (armedRef.current[slot] && p.canStart) {
      armedRef.current[slot] = false;
      if (!st.cubeStart(owner, ts)) return;
      // 起表那一手也属于这一把 —— cubeStart 已经把 startTime 定在它身上了。
      syncTrack(slot, owner).moves.push({ m: move, ts: 0 });
      return;
    }
    // 没预备就转动 —— 可能正在拧打乱。下面的 checkArm 会在拧到位时把预备补上。
  }, [syncTrack]);

  const onSolved = useCallback((slot: number, atMs?: number) => {
    const st = useBattleStore.getState();
    if (!slotCounts(slot, st.cubeMode)) return;
    const owner = ownerOf(slot, st.cubeMode, st.cubeHolder);
    if (!timerSupportsLocalBattleSmartCube(st.puzzleIds[owner] as EventId)) return;
    const attempt = attemptKey(owner, st.players[owner].startTime);
    const stopAt = atMs !== undefined && Number.isFinite(atMs)
      ? atMs
      : lastMoveAtRef.current[slot] || performance.now();
    const stopped = st.cubeStop(owner, stopAt);
    armedRef.current[slot] = false;
    // 缓冲无论如何都要清空:这一路已经不在这一把里了,留着只会漏给下一把。
    const track = trackRef.current[slot];
    const gyro = encodeGyroTrack(gyroRecRef.current[slot].take());
    trackRef.current[slot] = emptyTrack();
    if (!stopped) return;                       // 没成把(太短 / 没在计时)就不留档
    if (track.attempt !== attempt) return;      // 缓冲不是这一把的(上一把没清干净)
    if (!recordsToLocalHistory(slot, st.cubeMode, st.cubeHolder)) return;   // 别人的把,不进我的历史
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
    // 没开录 / 魔方不报姿态 / 一次都没动 → 编码是 null,字段整个不出现 —— 回放面板
    // 就是靠「有没有这个字段」决定要不要给陀螺仪开关的。
    if (gyro) solve.gyro = gyro;
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
    if (!slotCounts(slot, st.cubeMode)) return;
    const owner = ownerOf(slot, st.cubeMode, st.cubeHolder);
    const p = st.players[owner];
    if (p.isTiming || p.canStart) return;
    if (!timerSupportsLocalBattleSmartCube(st.puzzleIds[owner] as EventId)) return;
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
  /**
   * 姿态样本进这一路的录制器。传不传 `onGyro` 本身就是「要不要姿态流」——
   * 有的牌子(MoYu32 的 0xAC)只在有人听的时候才开那条流,所以没开录时**不传**,
   * 一点电和带宽都不多费。
   */
  const recordGyro = useSettings().recordGyro;
  const onGyro = useCallback((slot: number, q: Quat) => {
    const st = useBattleStore.getState();
    if (!slotCounts(slot, st.cubeMode)) return;
    const owner = ownerOf(slot, st.cubeMode, st.cubeHolder);
    // 只在真的在计时的时候录:预备阶段和拧完之后的姿态不属于这一把。
    if (!st.players[owner].isTiming) return;
    // 和转动流同一份缓冲、同一个零点 —— 姿态的时刻要能和转动的时刻直接比,
    // 而且这一把如果是按键起的表,姿态流也得在这里把上一把的残留清掉。
    syncTrack(slot, owner);
    gyroRecRef.current[slot].push(q, performance.now() - gyroStartRef.current[slot]);
  }, [syncTrack]);

  const h0 = useSlot(0, onMove, onSolved, checkArm, needMac, recordGyro ? onGyro : undefined);
  const h1 = useSlot(1, onMove, onSolved, checkArm, needMac, recordGyro ? onGyro : undefined);
  const h2 = useSlot(2, onMove, onSolved, checkArm, needMac, recordGyro ? onGyro : undefined);
  const h3 = useSlot(3, onMove, onSolved, checkArm, needMac, recordGyro ? onGyro : undefined);
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
  onSolved: (slot: number, atMs?: number) => void,
  checkArm: (slot: number, handle: BluetoothCubeHandle) => void,
  needMac: (slot: number, deviceName: string, isWrongKey?: boolean) => Promise<string | null>,
  onGyro: ((slot: number, q: Quat) => void) | undefined,
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
    onSolved: (atMs) => onSolved(slot, atMs),
    onNeedMac: (deviceName, isWrongKey) => needMac(slot, deviceName, isWrongKey),
    onGyro: onGyro ? (q) => onGyro(slot, q) : undefined,
  });
  useEffect(() => { selfRef.current = handle; });
  return handle;
}
