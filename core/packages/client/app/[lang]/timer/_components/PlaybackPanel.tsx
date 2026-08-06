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
 * ## 朝向:转整颗魔方,不换记号
 *
 * `scramble`/`moves` 是魔方自己配色系里的原始那对,`viewRotation` 是把十字转到
 * 下面的那个整体旋转(见 `orient.ts`),作为 `pose` 单独给引擎 —— 它接在动作末尾
 * 生效,但**不混进动作数组**(理由见 `_lib/cube/sim_log.ts`)。
 *
 * 为什么是接一个旋转而不是喂换过名的记号:换名会把颜色也换掉 —— 白面被叫成 D,
 * 而 D 在标准配色里是黄,屏幕上就成了「黄十字朝下」。接一个真旋转是把整颗魔方转
 * 过去,颜色跟着块走,白十字还是白的。
 *
 * 开陀螺仪时不接 —— 姿态流本来就是在魔方自己那个系里测的,朝向由它说了算。
 * 关闭时则用文字复盘已经确认的离散转体驱动 cube transform；开关只决定姿态来源，
 * 不决定 `x/y/z` 是否可见。 */

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ChevronLeft, ChevronRight, Play, Pause, SkipBack, SkipForward,
} from 'lucide-react';

import BoolToggle from '@/components/BoolToggle';
import { tr } from '@/i18n/tr';

import type { EventId } from '../_lib/types';
import CubePreview from '../_lib/cube/CubePreview';
import { nxnSizeForEvent } from '../_lib/cube';
import { decodeGyroTrack, sampleGyroAt } from '../_lib/bluetooth/gyro_track';
import { mirrorForBrand, sensorBasisForBrand } from '../_lib/bluetooth/orientation';
import type { Quat } from '../_lib/bluetooth/orientation';
import { rotationPoseAt } from '../_lib/reconstruct/rotation_detect';
import type { HumanRotation } from '../_lib/reconstruct/humanize';
import type { ReconTextLine } from '../_lib/reconstruct/recon_text';
import type { SolveMove } from '../_lib/reconstruct/stage_segments';
import SolveTimeline from './SolveTimeline';
import type { SolveTimelineHandle } from './SolveTimeline';

// WebGL + the /sim engine. Only mounted when the playback section is open, so a
// report opened just to read the numbers never pays for it.
const SimCubeView = dynamic(() => import('@/components/sim-embed/SimCubeView'), { ssr: false });

interface Props {
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
  side?: (ctx: { idx: number; seek: (i: number) => void }) => ReactNode;
  /** 这把录到的姿态流(base64,见 `_lib/bluetooth/gyro_track.ts`)。有才给开关。 */
  gyro?: string | null;
  /** 录这把的魔方型号,用来挑传感器基。 */
  deviceModel?: string | null;
  /**
   * 把这把转到「十字朝下」的整体旋转(`normalizeSolve` 的 `rotation`,可能是空串)。
   * 只影响看到的朝向,不影响状态。开陀螺仪时忽略。
   */
  viewRotation?: string;
}

const SPEEDS: Array<{ key: string; label: string; mult: number }> = [
  { key: '0.5x', label: '0.5x', mult: 0.5 },
  { key: '1x',   label: '1x',   mult: 1 },
  { key: '2x',   label: '2x',   mult: 2 },
];

function formatSec(ms: number, digits = 2): string {
  return (ms / 1000).toFixed(digits);
}

export default function PlaybackPanel({
  event, scramble, moves, totalMs, lines, rotations, side, gyro, deviceModel, viewRotation,
}: Props) {
  // /sim 只画 NxN;这里只有 3x3 会有动作流(智能魔方就这一种),别的项目退回预览图。
  const isNxn3 = nxnSizeForEvent(event) === 3;
  const total = moves.length;
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
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
  const poseAt = useMemo(() => (
    gyroOn && hasGyro
      ? (tMs: number) => sampleGyroAt(gyroTrack, tMs)
      : (tMs: number) => rotationPoseAt(rotations ?? [], tMs)
  ), [gyroOn, hasGyro, gyroTrack, rotations]);

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

  const composed = idx > 0
    ? `${scramble} ${moves.slice(0, idx).map(m => m.m).join(' ')}`
    : scramble;

  const tsOf = (i: number) => (i <= 0 ? 0 : (moves[Math.min(i, total) - 1]?.ts ?? 0));
  const elapsedMs = tsOf(idx);
  const lastTs = total > 0 ? moves[total - 1].ts : 0;

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
      const at = Math.min(t, lastTs);
      playFromRef.current = at;
      playbackQuatRef.current = poseAt(at);
      timelineRef.current?.setPlayhead(at);
      if (counterRef.current) counterRef.current.textContent = formatSec(at);
      let i = 0;
      while (i < total && moves[i].ts <= at) i++;
      setIdx(i);
      if (t >= lastTs) { setPlaying(false); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speedMult, total, moves, lastTs, poseAt]);

  // 暂停时**不**把游标交还给 idx:两手之间按下暂停,时间确实走到了那儿,而下一下
  // 播放也正是从那儿接着走(playFromRef 就停在那)。倒回「最后落下那一手」看着像
  // 卡了一下,而且和继续播的位置对不上。交还只发生在拖动 / 单步(见 seek / step)。
  const seek = (i: number) => {
    setPlaying(false);
    const j = Math.max(0, Math.min(total, i));
    playFromRef.current = tsOf(j);
    playbackQuatRef.current = poseAt(playFromRef.current);
    setIdx(j);
    timelineRef.current?.setPlayhead(null);
  };
  // 上一步 / 下一步走**函数式**更新,不能写成 `seek(idx + 1)`:idx 是这一帧闭包里的
  // 值,连点五下会算出同一个目标,只前进一步。绝对跳转(时间轴、点某一步)没有这
  // 个问题,因为目标本来就与当前位置无关。
  const step = (delta: number) => {
    setPlaying(false);
    setIdx(i => {
      const j = Math.max(0, Math.min(total, i + delta));
      playFromRef.current = tsOf(j);
      playbackQuatRef.current = poseAt(playFromRef.current);
      return j;
    });
    timelineRef.current?.setPlayhead(null);
  };
  const handleTogglePlay = () => {
    // 播完了再按 = 重播:从头起,播放头也得跟着回零,否则时钟以为还剩 0ms。
    if (idx >= total) {
      setIdx(0);
      playFromRef.current = 0;
      playbackQuatRef.current = poseAt(0);
      setPlaying(true);
      return;
    }
    setPlaying(p => !p);
  };

  // SimCubeView 是 alg 驱动的,必须从**复原态**起算 —— 喂给它的是「打乱 + 已播
  // 的这几手」。视角旋转**不进这个数组**:它是姿态不是动作,混进来的话每多播一手
  // 都插在它前面 = 不是追加 = 逐手动画全没了(见 _lib/cube/sim_log.ts)。
  const posed = gyroOn && hasGyro;
  const simMoves = useMemo(
    () => [
      ...scramble.trim().split(/\s+/).filter(Boolean),
      ...moves.slice(0, idx).map(m => m.m),
    ],
    [scramble, moves, idx],
  );
  const simPose = !posed && viewRotation ? viewRotation : '';

  const playLabel = playing
    ? tr({ zh: '暂停', en: 'Pause' })
    : (idx >= total ? tr({ zh: '重播', en: 'Replay' }) : tr({ zh: '播放', en: 'Play' }));

  return (
    <div className={`reconstruct-playback${side ? ' has-side' : ''}`}>
      <div className="reconstruct-playback-main">
        <div className="reconstruct-playback-top">
          <span className="reconstruct-playback-cap">{tr({ zh: '回放', en: 'replay' })}</span>
          <span className="reconstruct-playback-speed">
            <span className="reconstruct-playback-speed-cap">{tr({ zh: '速度', en: 'Speed' })}</span>
            {SPEEDS.map(s => (
              <button
                key={s.key}
                type="button"
                className={`reconstruct-playback-speed-btn ${speedMult === s.mult ? 'active' : ''}`}
                onClick={() => setSpeedMult(s.mult)}
                aria-pressed={speedMult === s.mult}
              >
                {s.label}
              </button>
            ))}
          </span>
        </div>

        {/* 开关只在**这把真的录到姿态**时出现。没录到就没有 —— 一个按下去什么
            也不会发生的开关比没有这个开关更糟。 */}
        {hasGyro && (
          <div className="reconstruct-playback-gyro">
            <BoolToggle
              value={gyroOn}
              onChange={setGyroOn}
              label={tr({ zh: '陀螺仪', en: 'Gyro' })}
            />
          </div>
        )}

        {/* 3D 而不是展开图:回放是「看别人拧」,展开图看不出这是一次转动还是
            三次。展开图留给打乱预览那种「一眼扫全六面」的场合。

            开启连续陀螺仪就跟原始姿态流，关闭时跟已识别的离散转体；一条转体
            都没有才保持固定等轴视角。同一个组件,不为姿态来源换一套渲染。 */}
        <div ref={cubeBoxRef} className={`reconstruct-playback-cube${gyroOn ? ' is-gyro' : ''}`}>
          {isNxn3 ? (cubeNear ? (
            <SimCubeView
              moves={simMoves}
              pose={simPose}
              quatRef={playbackQuatRef}
              sensorBasis={posed ? sensorBasisForBrand(deviceModel) : 'identity'}
              mirror={posed ? mirrorForBrand(deviceModel) : false}
              // 播放 / 下一步是纯追加,那几手会转给你看;拖时间轴、上一步是跳,瞬切。
              animate
              ariaLabel={tr({
                zh: '这把的三维回放',
                en: '3D replay of this solve',
              })}
            />
          ) : (
            /* 空占位,和 SimCubeView 的宿主同一个 class —— 尺寸完全一样,
               魔方建好时原地替换,滚过去不会跳一下。 */
            <div className="timer-live-cube-3d" aria-hidden />
          )) : (
            <CubePreview event={event} scramble={composed} size={20} visualization="3D" />
          )}
        </div>

        <div className="reconstruct-playback-counter">
          <span ref={counterRef}>{formatSec(elapsedMs)}</span> / {formatSec(totalMs)}
        </div>

        {/* showLabels:这是这一页上唯一一根轴了(报告顶部那根删了),所以阶段名和
            阶段用时归它 —— 一根没有标注的彩条只能看出「有几段」。 */}
        <SolveTimeline
          ref={timelineRef}
          moves={moves}
          totalMs={totalMs}
          lines={lines ?? []}
          showLabels
          currentIdx={idx}
          onSeek={seek}
        />

        <div className="reconstruct-playback-buttons">
          <button
            type="button" className="reconstruct-pb-btn"
            onClick={() => seek(0)} disabled={idx === 0}
            title={tr({ zh: '回到开头', en: 'To start' })}
            aria-label={tr({ zh: '回到开头', en: 'To start' })}
          >
            <SkipBack size={15} />
          </button>
          <button
            type="button" className="reconstruct-pb-btn"
            onClick={() => step(-1)} disabled={idx === 0}
            title={tr({ zh: '上一步', en: 'Step back' })}
            aria-label={tr({ zh: '上一步', en: 'Step back' })}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button" className="reconstruct-pb-btn is-play"
            onClick={handleTogglePlay} disabled={total === 0}
            title={playLabel} aria-label={playLabel}
          >
            {playing ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <button
            type="button" className="reconstruct-pb-btn"
            onClick={() => step(1)} disabled={idx >= total}
            title={tr({ zh: '下一步', en: 'Step forward' })}
            aria-label={tr({ zh: '下一步', en: 'Step forward' })}
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button" className="reconstruct-pb-btn"
            onClick={() => seek(total)} disabled={idx >= total}
            title={tr({ zh: '到结尾', en: 'To end' })}
            aria-label={tr({ zh: '到结尾', en: 'To end' })}
          >
            <SkipForward size={15} />
          </button>
        </div>
      </div>

      {side && <div className="reconstruct-playback-side">{side({ idx, seek })}</div>}
    </div>
  );
}
