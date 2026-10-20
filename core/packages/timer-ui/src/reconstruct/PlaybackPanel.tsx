'use client';

/**
 * PlaybackPanel — 把这把重放一遍。
 *
 *   ┌─────────────────────────┬──────────────────────────┐
 *   │  回放          速度 x1   │  十字 [1.73]          ⧉  │
 *   │                          │  U R' F R' B2 L // Y cross│
 *   │        (3D 魔方)         │  F2L [11.35]             │
 *   │                          │    第 1 组  最优         │
 *   │      5.15 / 18.44        │    ...                   │
 *   │  ▬▬ ▬▬▬ ▬▬ ▬▬▬▬ ▬ ▬▬▬    │  OLL [2.01]   最优       │
 *   │   ⏮  ◀  ⏸  ▶  ⏭         │  PLL [3.33]              │
 *   └─────────────────────────┴──────────────────────────┘
 *
 * 左右两栏是**同一件事的两种读法**:魔方现在长什么样,和这一刻拧到了哪一步。
 * 分开放在两个折叠区里的时候,想对着看就得来回开关 —— 而「对着看」正是回放的
 * 全部意义。
 *
 * 进度条是 `SolveTimeline`:一手一个方块、宽度就是那一手的时间,所以拖动之外
 * 它自己还在说「这把慢在哪」。右栏的 `side` 由调用方给(渲染 prop,因为它要读
 * 游标),这样面板不需要知道分步列表是什么。
 *
 * 中间状态就是 `打乱 + 前 idx 手`,状态一定对。往下一手走是**追加**,引擎在当前
 * 状态上把那一手转给你看;拖时间轴 / 上一步是跳,整条重放瞬切 —— 没人真的倒着拧过
 * 那些手,给它配动画是编的。判据和共轭在 `_lib/cube/sim_log.ts`。
 *
 * 魔方本身走 `SimCubeView`(/sim 引擎),和计时页上那颗实时魔方是同一个组件:
 * 同一个站里不该有两种三维魔方长相。非 NxN 的项目没有 sim 魔方,退回打乱预览。
 *
 * 关闭陀螺仪:原始打乱 + 观察朝向 + 重建动作,中层、双层和转体直接交给引擎。
 * 开启陀螺仪:原始打乱 + 编码器动作,同时应用录制姿态。
 * 重建已解析姿态,不能再叠加核心转体。两种流通过原始动作区间与时间戳映射游标。
 */


import { reportSeconds } from './report-presentation';
import ReportContent from './ReportContent';
import { reportPlayback, reportPlayerAction, playbackMoveDurationTicks, type ReportPlayerState } from './report-player';
import type { ReportAction } from './report-content';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { useReconstructHost } from './ReconstructHost';

import type { EventId } from '@cuberoot/shared/timer';
import { TimerCubePreview as CubePreview } from '../TimerCubePreview';
import { timerEventNxnSize as nxnSizeForEvent } from '@cuberoot/shared/timer';
import { decodeGyroTrack, sampleGyroAt } from '@cuberoot/shared/smart-cube/gyro-track';
import { mirrorForBrand, sensorBasisForBrand } from '@cuberoot/shared/smart-cube/orientation';
import type { Quat } from '@cuberoot/shared/smart-cube/orientation';
import { notationQuaternion } from '@cuberoot/shared/timer/reconstruct/gyro-orient';
import type { HumanRotation } from '@cuberoot/shared/timer/reconstruct/humanize';
import type { ReconTextLine } from '@cuberoot/shared/timer/reconstruct/recon-text';
import type { SolveMove } from '@cuberoot/shared/timer/reconstruct/stage-segments';
import type { ReconstructionType } from '@cuberoot/shared/timer/reconstruct/recon-text';
import SolveTimeline from './SolveTimeline';
import type { SolveTimelineHandle } from './SolveTimeline';
import { reconstructedTrack, playbackIndexAt, playbackEndMs, rawPlaybackTarget, playbackFrame, type PlaybackMove } from './playback-track';

// WebGL + the /sim engine. The panel stays visible; the cube itself mounts only
// when it nears the viewport (see cubeNear below).
const SimCubeView = lazy(() => import('../SimCubeView'));

interface Props {
  method?: ReconstructionType;
  event: EventId;
  scramble: string;
  moves: SolveMove[];
  totalMs: number;
  isZh: boolean;
  /** 分步的行,给进度条上色用。没有(非 3x3 / 切不出阶段)就是一条素条。 */
  lines?: ReconTextLine[];
  /** 已从姿态流确认、并排除了中层/宽层的整体转体。关闭陀螺仪时用它驱动离散姿态。 */
  rotations?: readonly HumanRotation[];
  /** 右栏。拿得到游标和 seek,所以是渲染 prop 而不是普通 children。 */
  side?: (ctx: { idx: number; seek: (i: number) => void; playFrom: (i: number, atMs?: number) => void }) => ReactNode;
  /** 这把录到的姿态流(base64,见 `_lib/bluetooth/gyro_track.ts`)。有才给开关。 */
  gyro?: string | null;
  /** 录这把的魔方型号,用来挑传感器基。 */
  deviceModel?: string | null;
  /**
   * 把这把转到「十字朝下」的整体旋转(`normalizeSolve` 的 `rotation`,可能是空串)。
   * 只影响看到的朝向,不影响状态。开陀螺仪时忽略。
   */
  viewRotation?: string;
  /** Initial frame of the simplified steps; raw gyro playback keeps its own frame. */
  inspection?: string;
}


const formatSec = reportSeconds;

export default function PlaybackPanel({
  method, event, scramble, moves: rawMoves, totalMs, lines, rotations, side, gyro, deviceModel, viewRotation, inspection,
}: Props) {
  const { localize: tr } = useReconstructHost();
  // /sim 只画 NxN;这里只有 3x3 会有动作流(智能魔方就这一种),别的项目退回预览图。
  const isNxn3 = nxnSizeForEvent(event) === 3;
  const [playing, setPlaying] = useState(false);
  const [playbackRun, setPlaybackRun] = useState(0);
  const [seekIdx, setSeekIdx] = useState(0);
  const [speedMult, setSpeedMult] = useState(1);
  const [gyroOn, setGyroOn] = useState(false);
  /** 播放头(ms):从这里接着播。播放中由每帧的时钟推,暂停 / 拖动时跟着 idx 走。 */
  const playFromRef = useRef(0);
  const timelineRef = useRef<SolveTimelineHandle | null>(null);
  const counterRef = useRef<HTMLSpanElement | null>(null);
  const playbackQuatRef = useRef<Quat | null>(null);

  // 解一次就够,别每帧解。空录像 → 没开关。
  const gyroTrack = useMemo(() => decodeGyroTrack(gyro), [gyro]);
  const hasGyro = gyroTrack.length > 0;
  const calibrated = gyroTrack[0]?.frame === 'scramble';
  const posed = gyroOn && hasGyro;
  const rebuilt = useMemo(() => reconstructedTrack(lines, rawMoves), [lines, rawMoves]);
  const useRebuilt = !posed && rebuilt !== null;
  const moves = useMemo<PlaybackMove[]>(() => useRebuilt ? rebuilt! : rawMoves.map((move, i) => ({
    ...move, endTs: move.ts, rawAfter: i + 1,
  })), [useRebuilt, rebuilt, rawMoves]);
  const total = moves.length;
  // Track identity prevents interpreting a raw encoder cursor as a gesture cursor
  // for even one render when the gyro mode or reconstruction changes.
  const [position, setPosition] = useState<{ track: PlaybackMove[] | null; index: number }>({ track: null, index: 0 });
  const indexForTrack = () => playFromRef.current > 0 ? playbackIndexAt(moves, playFromRef.current) : 0;
  const idx = position.track === moves ? Math.min(total, position.index) : indexForTrack();
  const setIdx = (next: number | ((index: number) => number)) => setPosition(previous => {
    const index = typeof next === 'function' ? next(previous.track === moves ? previous.index : indexForTrack()) : next;
    return previous.track === moves && previous.index === index ? previous : { track: moves, index };
  });
  const rawIdx = idx > 0 ? moves[idx - 1].rawAfter : 0;
  const playerRef=useRef<ReportPlayerState>({index:0,timeMs:0,playing:false,speed:1,posed:false,run:0});
  playerRef.current={index:idx,timeMs:playFromRef.current,playing,speed:speedMult,posed,run:playbackRun};
  const poseAt = useMemo(() => (
    posed
      ? (tMs: number) => sampleGyroAt(gyroTrack, tMs)
      : useRebuilt ? () => null
        // Written rotations are clockwise in the displayed frame. The detector's
        // body-frame quaternion uses the opposite sign and composition order.
        : (tMs: number) => notationQuaternion((rotations ?? [])
          .filter(rotation => rotation.tMs <= tMs).map(rotation => rotation.token).join(' '))
  ), [posed, useRebuilt, gyroTrack, rotations]);

  useEffect(() => {
    playbackQuatRef.current = poseAt(playFromRef.current);
  }, [poseAt]);

  // 魔方等**滚到跟前**再建。
  //
  // 建一个 /sim world 要开 WebGL 上下文、编 shader、铺 27 个块的实例矩阵,实测
  // 76ms 主线程(dev),而复盘弹窗刚打开时这颗魔方还在视口外 —— 报告顶部那一屏
  // 要能立刻滚动,就不该先替一个看不见的东西付这笔钱。rootMargin 留一屏提前量,
  // 用户滚到这儿时它已经建好了,看不出是后建的。
  //
  // 已经在视口里(宽屏、或直接滚到底)也不亏:回调仍是下一帧才来,等于把这一块
  // 从首帧那批活里挪出去一帧,报告先画完。
  const cubeBoxRef = useRef<HTMLDivElement>(null);
  const [cubeNear, setCubeNear] = useState(false);
  useEffect(() => {
    if (cubeNear) return;
    const el = cubeBoxRef.current;
    if (!el) return;
    if (typeof IntersectionObserver !== 'function') { setCubeNear(true); return; }
    const io = new IntersectionObserver(
      entries => { if (entries.some(e => e.isIntersecting)) setCubeNear(true); },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cubeNear]);

  useEffect(() => {
    if (idx > total) setIdx(total);
  }, [total, idx]);
  useEffect(() => {
    if (!playing) timelineRef.current?.setPlayhead(playFromRef.current);
  }, [playing, idx, moves]);

  const composed = idx > 0
    ? `${scramble} ${moves.slice(0, idx).map(m => m.m).join(' ')}`
    : scramble;

  const elapsedMs = playFromRef.current;
  const lastTs = Math.max(playbackEndMs(moves, rawMoves), method === 'training' ? totalMs : 0);

  // Keep the engine's normal 500 ms duration across observation/put-down pauses.
  // Shorter gaps still shorten the animation to prevent a backlog; the clock
  // retains the full recorded gap and leaves the finished cube still.
  const moveDurationTicks = playbackMoveDurationTicks(moves,idx,totalMs,speedMult);

  /**
   * 播放时钟。**按墙钟走,不是一手一个定时器**。
   *
   * 老写法是给下一手排一个 `setTimeout(gap)`,时长是对的,但屏幕上唯一会动的东西
   * (游标、计数)只在那一手落下的瞬间跳一格 —— 两手之间那 200ms 完全静止,看起来
   * 就是一跳一跳的。现在每帧算一次 `t = 起点 + 已过墙钟 × 倍速`:游标匀速滑,而
   * 「该播到第几手了」是从 t 反查出来的,跨手才 setIdx(魔方那一下动画照旧)。
   *
   * 游标和计数每帧直接写 DOM,不进 React 状态 —— 60 次/秒的 setState 会把右栏
   * 那张分步列表也一起重画,为了一个 4px 的位移不值(见 SolveTimeline 文件头注)。
   */
  useEffect(() => {
    if (!playing || total === 0) return;
    let raf = 0;
    const wall0 = performance.now();
    const solve0 = playFromRef.current;
    const tick = () => {
      const t = solve0 + (performance.now() - wall0) * speedMult;
      const frame = playbackFrame(moves, lastTs, t);
      const at = frame.timeMs;
      playFromRef.current = at;
      playbackQuatRef.current = poseAt(at);
      timelineRef.current?.setPlayhead(at);
      if (counterRef.current) counterRef.current.textContent = formatSec(at);
      setIdx(frame.index);
      if (!frame.playing) { setPlaying(false); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, playbackRun, speedMult, total, moves, lastTs, poseAt]);

  const dispatchPlayer=(action:ReportAction)=>{
    if (method === 'training' && action.type === 'end') action = { type: 'time', value: lastTs };
    const result=reportPlayerAction({...playerRef.current,timeMs:playFromRef.current},action,moves,rawMoves,lastTs,hasGyro);
    const next=result.state;playerRef.current=next;
    playFromRef.current=next.timeMs;playbackQuatRef.current=poseAt(next.timeMs);
    setIdx(next.index);setPlaying(next.playing);setSpeedMult(next.speed);setGyroOn(next.posed);setPlaybackRun(next.run);
    if(result.jump)setSeekIdx(next.index);
    timelineRef.current?.setPlayhead(next.timeMs);
    if(counterRef.current)counterRef.current.textContent=formatSec(next.timeMs);
  };
  const seekRaw=(i:number,atMs?:number)=>{
    if (method === 'training' && atMs !== undefined) { dispatchPlayer({ type: 'time', value: atMs }); return; }
    const target=rawPlaybackTarget(moves,rawMoves,i,atMs);
    dispatchPlayer({type:'time',value:target.timeMs});
  };
  const playFrom=(i:number,atMs?:number)=>dispatchPlayer({type:'play-from',value:i,timeMs:atMs});

  // The inspection rotation is a fixed prefix before reconstructed notation.
  // New gestures append after it; recorded playback instead gets external pose.
  const rebuiltInspection = inspection ?? viewRotation ?? '';
  const simMoves = useMemo(
    () => [
      ...scramble.trim().split(/\s+/).filter(Boolean),
      ...(useRebuilt ? rebuiltInspection.trim().split(/\s+/).filter(Boolean) : []),
      ...moves.slice(0, idx).map(m => m.m),
    ],
    [scramble, moves, idx, useRebuilt, rebuiltInspection],
  );
  const simPose = !useRebuilt && !posed && viewRotation ? viewRotation : '';


  return <ReportContent node={reportPlayback(playerRef.current,total,totalMs,hasGyro,Boolean(side),tr)} dispatch={dispatchPlayer} slots={{
    cube:<div ref={cubeBoxRef} className={`reconstruct-playback-cube${gyroOn ? ' is-gyro' : ''}`}>
          {isNxn3 ? (cubeNear ? (
            <Suspense fallback={<div className="timer-live-cube-3d" aria-hidden />}><SimCubeView
              language={tr({ en: 'en' as const, zh: 'zh' as const })}
              allowViewDrag
              resetViewOnRelease
              moves={simMoves}
              pose={simPose}
              key={useRebuilt ? `rebuilt:${rebuiltInspection}` : 'recorded'}
              quatRef={useRebuilt ? undefined : playbackQuatRef}
              sensorBasis={posed && !calibrated ? sensorBasisForBrand(deviceModel) : 'identity'}
              mirror={posed && !calibrated ? mirrorForBrand(deviceModel) : false}
              // 播放 / 下一步是纯追加,那几手会转给你看;拖时间轴、上一步是跳,瞬切。
              animate={position.track === moves && idx !== seekIdx}
              moveDurationTicks={moveDurationTicks}
              ariaLabel={tr({
                zh: '这把的三维回放',
                en: '3D replay of this solve',
              })}
            /></Suspense>
          ) : (
            /* 空占位,和 SimCubeView 的宿主同一个 class —— 尺寸完全一样,
               魔方建好时原地替换,滚过去不会跳一下。 */
            <div className="timer-live-cube-3d" aria-hidden />
          )) : (
            <CubePreview event={event} scramble={composed} size={20} visualization="3D" />
          )}
        </div>,
    elapsed:<span ref={counterRef}>{formatSec(elapsedMs)}</span>,
    timeline:<SolveTimeline
          method={method}
          ref={timelineRef}
          moves={rawMoves}
          totalMs={totalMs}
          lines={lines ?? []}
          showLabels
          currentIdx={rawIdx}
          onSeek={seekRaw}
        />,
    notation:side?.({idx:rawIdx,seek:seekRaw,playFrom}),
  }}/>;
}
