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
 * 开陀螺仪时不接 —— 姿态流本来就是在魔方自己那个系里测的,朝向由它说了算。 */

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
import type { ReconTextLine } from '../_lib/reconstruct/recon_text';
import type { SolveMove } from '../_lib/reconstruct/stage_segments';
import SolveTimeline from './SolveTimeline';

// WebGL + the /sim engine. Only mounted when the playback section is open, so a
// report opened just to read the numbers never pays for it.
const SimCubeView = dynamic(() => import('./SimCubeView'), { ssr: false });

interface Props {
  event: EventId;
  scramble: string;
  moves: SolveMove[];
  totalMs: number;
  isZh: boolean;
  /** 分步的行,给进度条上色用。没有(非 3x3 / 切不出阶段)就是一条素条。 */
  lines?: ReconTextLine[];
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

const MIN_TIMEOUT_MS = 16;
const SPEEDS: Array<{ key: string; label: string; mult: number }> = [
  { key: '0.5x', label: '0.5x', mult: 0.5 },
  { key: '1x',   label: '1x',   mult: 1 },
  { key: '2x',   label: '2x',   mult: 2 },
];

function formatSec(ms: number, digits = 2): string {
  return (ms / 1000).toFixed(digits);
}

export default function PlaybackPanel({
  event, scramble, moves, totalMs, lines, side, gyro, deviceModel, viewRotation,
}: Props) {
  // /sim 只画 NxN;这里只有 3x3 会有动作流(智能魔方就这一种),别的项目退回预览图。
  const isNxn3 = nxnSizeForEvent(event) === 3;
  const total = moves.length;
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMult, setSpeedMult] = useState(1);
  const [gyroOn, setGyroOn] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 解一次就够,别每帧解。空录像 → 没开关。
  const gyroTrack = useMemo(() => decodeGyroTrack(gyro), [gyro]);
  const hasGyro = gyroTrack.length > 0;

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

  const elapsedMs = idx === 0 ? 0 : (moves[idx - 1]?.ts ?? 0);

  useEffect(() => {
    if (!playing) return;
    if (idx >= total) {
      setPlaying(false);
      return;
    }
    const currentTs = idx === 0 ? 0 : moves[idx - 1].ts;
    const nextTs = moves[idx].ts;
    const rawGap = Math.max(0, nextTs - currentTs);
    const scaled = rawGap / speedMult;
    const delay = Math.max(MIN_TIMEOUT_MS, scaled);
    timerRef.current = setTimeout(() => {
      setIdx(i => Math.min(total, i + 1));
    }, delay);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [playing, idx, total, moves, speedMult]);

  useEffect(() => {
    if (idx >= total && playing) setPlaying(false);
  }, [idx, total, playing]);

  const seek = (i: number) => {
    setPlaying(false);
    setIdx(Math.max(0, Math.min(total, i)));
  };
  // 上一步 / 下一步走**函数式**更新,不能写成 `seek(idx + 1)`:idx 是这一帧闭包里的
  // 值,连点五下会算出同一个目标,只前进一步。绝对跳转(时间轴、点某一步)没有这
  // 个问题,因为目标本来就与当前位置无关。
  const step = (delta: number) => {
    setPlaying(false);
    setIdx(i => Math.max(0, Math.min(total, i + delta)));
  };
  const handleTogglePlay = () => {
    if (idx >= total) {
      setIdx(0);
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

            姿态给了就跟姿态,没给就是引擎自己的等轴视角 —— 同一个组件,不为
            「有没有陀螺仪」换一套渲染。回放不需要它的平滑跟随(样本本来就是按
            时间插好的),但留着也无害:两个样本之间它只是滑得更顺。 */}
        <div ref={cubeBoxRef} className={`reconstruct-playback-cube${gyroOn ? ' is-gyro' : ''}`}>
          {isNxn3 ? (cubeNear ? (
            <SimCubeView
              moves={simMoves}
              pose={simPose}
              quat={posed ? sampleGyroAt(gyroTrack, elapsedMs) : null}
              sensorBasis={sensorBasisForBrand(deviceModel)}
              mirror={mirrorForBrand(deviceModel)}
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
          {formatSec(elapsedMs)} / {formatSec(totalMs)}
        </div>

        <SolveTimeline
          moves={moves}
          totalMs={totalMs}
          lines={lines ?? []}
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
