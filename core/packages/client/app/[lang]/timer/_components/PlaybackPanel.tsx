'use client';

/**
 * PlaybackPanel — 把这把重放一遍。
 *
 *   ┌─────────────────────────┬──────────────────────────┐
 *   │  回放          速度 x1   │  十字 [1.73]          ⧉  │
 *   │                          │  U R' F R' B2 L // Y cross│
 *   │        (3D 魔方)         │  F2L [11.35]             │
 *   │                          │    第 1 对   最优        │
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
 * 中间状态靠重算打乱得到:`原打乱 + 前 idx 手` 交给 CubePreview,每次渲染整条
 * 重新应用 —— 状态一定对,代价是没有逐手动画。
 */

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
import { decodeGyroTrack, sampleGyroAt } from '../_lib/bluetooth/gyro_track';
import { mirrorForBrand, sensorBasisForBrand } from '../_lib/bluetooth/orientation';
import type { ReconTextLine } from '../_lib/reconstruct/recon_text';
import type { SolveMove } from '../_lib/reconstruct/stage_segments';
import SolveTimeline from './SolveTimeline';

// WebGL + the /sim engine. Only mounted when the user turns the gyro replay on,
// so a report opened just to read the numbers never pays for it.
const LiveCubeGyroView = dynamic(() => import('./LiveCubeGyroView'), { ssr: false });

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
  event, scramble, moves, totalMs, lines, side, gyro, deviceModel,
}: Props) {
  const total = moves.length;
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMult, setSpeedMult] = useState(1);
  const [gyroOn, setGyroOn] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 解一次就够,别每帧解。空录像 → 没开关。
  const gyroTrack = useMemo(() => decodeGyroTrack(gyro), [gyro]);
  const hasGyro = gyroTrack.length > 0;

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

  // LiveCubeGyroView 是 alg 驱动的,必须从**复原态**起算 —— 所以喂给它的是
  // 「打乱 + 已播的这几手」,不是 composed 那个字符串(内容一样,但那边是给
  // scramble-display 用的整条文本)。
  const gyroMoves = useMemo(
    () => [...scramble.trim().split(/\s+/).filter(Boolean), ...moves.slice(0, idx).map(m => m.m)],
    [scramble, moves, idx],
  );

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

            开了陀螺仪就换成 LiveCubeGyroView —— 它本来就是 alg 驱动、从复原态
            起算的,所以「打乱 + 前 idx 手」原样喂进去就是这一刻的状态,姿态另
            走一路。回放不需要它的平滑跟随(样本本来就是按时间插好的),但留着
            也无害:两个样本之间它只是滑得更顺。 */}
        <div className={`reconstruct-playback-cube${gyroOn ? ' is-gyro' : ''}`}>
          {gyroOn && hasGyro ? (
            <LiveCubeGyroView
              moves={gyroMoves}
              quat={sampleGyroAt(gyroTrack, elapsedMs)}
              sensorBasis={sensorBasisForBrand(deviceModel)}
              mirror={mirrorForBrand(deviceModel)}
            />
          ) : (
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
