'use client';

/**
 * SolveTimeline —— 一把还原摊平在一根时间轴上。
 *
 *        1.73          11.35            2.01    3.33
 *   ▁▁███  ▁▁████ ▁███ ▁▁▁█████  ▁████   ▁▁████  ▁▁████
 *   CROSS         F2L                    OLL     PLL
 *
 * **一步一段,不是一手一格。** 亮的那截是这一步在拧(执行),它前面那截暗的是在
 * 看(识别 —— 上一步收手到这一步起手之间的停顿)。所以整条轨道读出来就是
 * 「想 0.4s、拧 1.2s;想 0.9s、拧 0.8s……」,一眼看得出这把是卡在观察还是卡在手速。
 *
 * 早先是一手一个方块。那个太细了:十几二十个格子挤在 300px 里,看到的是噪声不是
 * 结构,而「哪一步慢」本来就是按步问的问题。识别 / 执行两个数分步分析表里本来就有,
 * 这里只是把它们摆到时间上。
 *
 * 2026-08-03 起只剩一根:回放那根(带阶段名、阶段用时、游标,可以点着跳)。报告
 * 顶部那根删了 —— 同一份切分在一页上画两遍,读者第一反应是去找两者的区别。名字和
 * 游标仍是可选的:切不出还原步骤的把仍会拿它当素条用。
 *
 * ## 游标为什么不走 React 状态
 *
 * 播放中它必须**每帧**动一点,否则看到的是「一手一跳」——两手之间那 200ms 里画面
 * 完全静止,而人眼读进度条读的就是匀速。但每帧 setState 会把整个回放区连同右栏
 * 那张分步列表一起重画(60 次/秒,列表几十个节点),为了一个 4px 的位移不值。
 *
 * 所以位置由外面的时钟每帧**直接写进 DOM**(`setPlayhead`),不经过 React;React
 * 只在跨过一手时重渲染一次。渲染后的 layout effect 会把最后写进去的那个位置补回
 * 去,免得 React 用离散位置盖掉它闪一下。
 */

import { useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useReconstructHost } from './ReconstructHost';
import { reconstructionTimeline, timelineExecutionAt, timelineTooltipOffset } from './timeline-model';

import type { ReconTextLine } from '@cuberoot/shared/timer/reconstruct/recon-text';
import type { SolveMove } from '@cuberoot/shared/timer/reconstruct/stage-segments';
import type { ReconstructionType } from '@cuberoot/shared/timer/reconstruct/recon-text';

export interface SolveTimelineProps {
  method?: ReconstructionType;
  moves: SolveMove[];
  /** 计时总长。所有横坐标都按它归一化。 */
  totalMs: number;
  /** 分步的行(切点和分步分析表同一把刀)。一行 = 轨道上的一段。 */
  lines: ReconTextLine[];
  /** 显示阶段名和阶段用时。回放进度条上不显示(下面已经有一整块列表了)。 */
  showLabels?: boolean;
  /** 已经播了几手。null / 省略 = 不画游标。 */
  currentIdx?: number | null;
  /** 点轴上某处 → 跳到那一手。省略则整条不可点。 */
  onSeek?: (idx: number, atMs?: number) => void;
  /** 播放时钟的把手(见文件头注)。 */
  ref?: React.Ref<SolveTimelineHandle>;
}

export interface SolveTimelineHandle {
  /**
   * 把游标摆到这个时刻,直接写 DOM,不触发渲染。播放中每帧调一次。
   * 传 `null` = 交还给 `currentIdx`(暂停 / 拖动之后)。
   */
  setPlayhead(ms: number | null): void;
}

const pct = (v: number) => `${(v * 100).toFixed(3)}%`;

export default function SolveTimeline({
  method = 'cfop', moves, totalMs, lines, showLabels, currentIdx, onSeek, ref,
}: SolveTimelineProps) {
  const { localize: tr } = useReconstructHost();
  const span = Math.max(1, totalMs);
  const cursorRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  /** 播放时钟接管时的位置(ms);null = 没人接管,听 `currentIdx` 的。 */
  const playheadRef = useRef<number | null>(null);
  const pointerRef = useRef<number | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  // 一行两段:识别(暗)+ 执行(亮)。识别数缺席时整行都算执行 —— 不为它编一个停顿。
  const { segs, stages } = useMemo(() => reconstructionTimeline(lines, moves, method, tr), [lines, moves, method, tr]);
  const hovered = segs.find(segment => segment.key === hoverKey);

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;
    const placeTooltip = () => {
      tooltip.style.transform = 'translateX(-50%)';
      const rect = tooltip.getBoundingClientRect();
      const offset = timelineTooltipOffset(rect.left, rect.right, window.innerWidth);
      tooltip.style.transform = `translateX(calc(-50% + ${offset}px))`;
    };
    placeTooltip();
    window.addEventListener('resize', placeTooltip);
    return () => window.removeEventListener('resize', placeTooltip);
  }, [hovered, span]);

  if (moves.length === 0) return null;

  const seek = (e: React.MouseEvent<HTMLElement>) => {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const at = Math.max(0, Math.min(span, ((e.clientX - rect.left) / rect.width) * span));
    // 落在哪一手之后就跳到哪一手之后 —— 游标语义是「已经播了几手」。
    let idx = 0;
    while (idx < moves.length && moves[idx].ts <= at) idx++;
    onSeek(idx, at);
  };

  const cursorMs = currentIdx === null || currentIdx === undefined
    ? null
    : (currentIdx <= 0 ? 0 : (moves[Math.min(currentIdx, moves.length) - 1]?.ts ?? 0));

  const place = (ms: number) => {
    const el = cursorRef.current;
    if (el) el.style.left = pct(Math.min(1, Math.max(0, ms / span)));
  };
  useImperativeHandle(ref, () => ({
    setPlayhead(ms: number | null) {
      playheadRef.current = ms;
      place(ms ?? cursorMs ?? 0);
    },
  }));
  // 每次渲染后补一次:跨过一手时 React 会用离散位置重写 style,不补回来就是每手
  // 闪一下(播放头一直比「最后落下那一手」靠前一点)。layout effect 在绘制前跑。
  useLayoutEffect(() => { place(playheadRef.current ?? cursorMs ?? 0); });

  const Track = onSeek ? 'button' : 'div';

  return (
    <div className={`stl${showLabels ? ' has-labels' : ''}`}>
      {showLabels && (
        <div className="stl-row stl-times">
          {stages.map((s, i) => (
            <span
              key={`${s.key}-${i}`}
              className="stl-cap"
              style={{ left: pct(s.fromMs / span), width: pct((s.toMs - s.fromMs) / span) }}
            >
              {s.timeText}
            </span>
          ))}
        </div>
      )}

      <div className="stl-track-wrap">
      <Track
        className="stl-track"
        onPointerLeave={() => setHoverKey(null)}
        onPointerMove={(e: React.PointerEvent<HTMLElement>) => {
          if (pointerRef.current === e.pointerId) seek(e);
          const rect = e.currentTarget.getBoundingClientRect();
          const at = rect.width > 0 ? (e.clientX - rect.left) / rect.width * span : -1;
          setHoverKey(timelineExecutionAt(segs, at)?.key ?? null);
        }}
        {...(onSeek
          ? {
            type: 'button' as const,
            onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
              if (pointerRef.current !== null || e.button !== 0) return;
              pointerRef.current = e.pointerId;
              e.currentTarget.setPointerCapture(e.pointerId);
              seek(e);
              e.preventDefault();
            },
            onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
              if (pointerRef.current !== e.pointerId) return;
              seek(e);
              pointerRef.current = null;
              e.currentTarget.releasePointerCapture(e.pointerId);
            },
            onPointerCancel: () => { pointerRef.current = null; },
            onLostPointerCapture: () => { pointerRef.current = null; },
            onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
              const index = currentIdx ?? 0;
              const next = e.key === 'Home' ? 0 : e.key === 'End' ? moves.length
                : e.key === 'ArrowLeft' ? Math.max(0, index - 1)
                  : e.key === 'ArrowRight' ? Math.min(moves.length, index + 1) : null;
              if (next === null) return;
              e.preventDefault();
              onSeek(next);
            },
            role: 'slider',
            'aria-valuemin': 0,
            'aria-valuemax': moves.length,
            'aria-valuenow': currentIdx ?? 0,
            'aria-label': tr({ zh: '跳到时间轴上的某一手', en: 'Seek on the timeline' }),
          }
          : { role: 'img', 'aria-label': tr({ zh: '每一步的观察与执行用时', en: 'Recognition and execution time per step' }) })}
      >
        {segs.map((s) => {
          const w = Math.max(0, s.toMs - s.fromMs) / span;
          if (w <= 0) return null;
          return (
            <span
              key={s.key}
              className="stl-seg"
              data-stage={s.stage}
              data-color={s.color}
              data-shade={Math.min(3, s.shade)}
              data-pause={s.pause ? '' : undefined}
              style={{ left: pct(s.fromMs / span), width: pct(w) }}
            />
          );
        })}
        {cursorMs !== null && (
          <span ref={cursorRef} className="stl-cursor" style={{ left: pct(Math.min(1, cursorMs / span)) }} />
        )}
      </Track>

      {hovered && <div ref={tooltipRef} className="stl-tooltip" role="tooltip"
        style={{ left: pct((hovered.fromMs + hovered.toMs) / (2 * span)) }}>
        <span>{hovered.label}</span>
        <span className="stl-tooltip-moves">{hovered.moves || '—'}</span>
      </div>}
      </div>

      {showLabels && (
        <div className="stl-row stl-names">
          {stages.map((s, i) => (
            <span
              key={`${s.key}-${i}`}
              className="stl-cap"
              data-stage={s.key}
              data-color={s.color}
              style={{ left: pct(s.fromMs / span), width: pct((s.toMs - s.fromMs) / span) }}
            >
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
