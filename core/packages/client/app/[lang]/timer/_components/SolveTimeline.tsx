'use client';

/**
 * SolveTimeline — 一把还原摊平在一根时间轴上。
 *
 *        1.73          11.35            2.01    3.33
 *   ▬▬▬  ▬▬▬▬ ▬▬  ▬▬▬▬▬▬  ▬▬▬ ▬▬▬▬▬  ▬▬▬▬  ▬▬▬▬▬▬▬
 *   CROSS         F2L                  OLL     PLL
 *
 * 一手一个小方块,**宽度就是这一手花的时间**(上一手落下 → 这一手落下),按阶段
 * 上色。所以方块之间的空隙不是装饰,是**真的停顿** —— 一眼就能看出这把慢在哪:
 * 卡在哪一对、末层前愣了多久。条形图给不了这个,因为它把一整步压成一个数。
 *
 * 同一根轴在两个地方用:报告顶部(带阶段名和阶段用时)和回放的进度条(不带名字,
 * 但多一个游标,而且可以点着跳)。所以名字和游标都是可选的,不是两个组件。
 */

import { useMemo } from 'react';

import { tr } from '@/i18n/tr';

import type { ReconTextLine } from '../_lib/reconstruct/recon_text';
import type { SolveMove } from '../_lib/reconstruct/stage_segments';

export interface SolveTimelineProps {
  moves: SolveMove[];
  /** 计时总长。方块的横坐标都按它归一化。 */
  totalMs: number;
  /** 分步的行(切点和分步分析表同一把刀)。用来给每一手上色、给阶段划范围。 */
  lines: ReconTextLine[];
  /** 显示阶段名和阶段用时。回放进度条上不显示(下面已经有一整块列表了)。 */
  showLabels?: boolean;
  /** 已经播了几手。null / 省略 = 不画游标。 */
  currentIdx?: number | null;
  /** 点轴上某处 → 跳到那一手。省略则整条不可点。 */
  onSeek?: (idx: number) => void;
}

type StageKey = 'cross' | 'f2l' | 'oll' | 'pll';

interface StageSpan {
  key: StageKey;
  label: string;
  fromMs: number;
  toMs: number;
  ms: number;
}

const pct = (v: number) => `${(v * 100).toFixed(3)}%`;

export default function SolveTimeline({
  moves, totalMs, lines, showLabels, currentIdx, onSeek,
}: SolveTimelineProps) {
  const span = Math.max(1, totalMs);

  // 每一手属于哪一阶段。行给的是闭区间,直接铺开成一张查找表 —— 手数最多几十,
  // 不值得为它写二分。
  const stageOf = useMemo(() => {
    const out = new Array<StageKey | null>(moves.length).fill(null);
    for (const line of lines) {
      const key: StageKey = line.kind === 'inspection' ? 'cross'
        : line.kind === 'f2l' ? 'f2l'
        : line.kind === 'cross' ? 'cross'
        : line.kind;
      for (let i = line.fromIdx; i <= line.toIdx && i < out.length; i++) out[i] = key;
    }
    return out;
  }, [moves.length, lines]);

  const stages = useMemo<StageSpan[]>(() => {
    const label: Record<StageKey, string> = {
      cross: tr({ zh: '十字', en: 'CROSS' }), f2l: 'F2L', oll: 'OLL', pll: 'PLL',
    };
    const out: StageSpan[] = [];
    for (const line of lines) {
      const key: StageKey = line.kind === 'inspection' || line.kind === 'cross' ? 'cross'
        : line.kind === 'f2l' ? 'f2l' : line.kind;
      // 一步从「上一手落下」算起,所以起点是 fromIdx-1 那一手的时刻(第一步从 0 起)。
      const fromMs = line.fromIdx > 0 ? (moves[line.fromIdx - 1]?.ts ?? 0) : 0;
      const toMs = moves[line.toIdx]?.ts ?? fromMs;
      const last = out[out.length - 1];
      if (last && last.key === key) { last.toMs = toMs; last.ms += toMs - fromMs; }
      else out.push({ key, label: label[key], fromMs, toMs, ms: toMs - fromMs });
    }
    return out;
  }, [lines, moves]);

  if (moves.length === 0) return null;

  const seek = (e: React.MouseEvent<HTMLElement>) => {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const at = ((e.clientX - rect.left) / rect.width) * span;
    // 落在哪一手之后就跳到哪一手之后 —— 游标语义是「已经播了几手」。
    let idx = 0;
    while (idx < moves.length && moves[idx].ts <= at) idx++;
    onSeek(idx);
  };

  const cursorMs = currentIdx === null || currentIdx === undefined
    ? null
    : (currentIdx <= 0 ? 0 : (moves[Math.min(currentIdx, moves.length) - 1]?.ts ?? 0));

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
              {(s.ms / 1000).toFixed(2)}
            </span>
          ))}
        </div>
      )}

      <Track
        className="stl-track"
        {...(onSeek
          ? {
            type: 'button' as const,
            onClick: seek,
            'aria-label': tr({ zh: '跳到时间轴上的某一手', en: 'Seek on the timeline' }),
          }
          : { role: 'img', 'aria-label': tr({ zh: '每一手的用时', en: 'Time per turn' }) })}
      >
        {moves.map((mv, i) => {
          const from = i > 0 ? moves[i - 1].ts : 0;
          const w = Math.max(0, mv.ts - from) / span;
          if (w <= 0) return null;
          return (
            <span
              key={i}
              className="stl-move"
              data-stage={stageOf[i] ?? undefined}
              style={{ left: pct(from / span), width: pct(w) }}
            />
          );
        })}
        {cursorMs !== null && (
          <span className="stl-cursor" style={{ left: pct(Math.min(1, cursorMs / span)) }} />
        )}
      </Track>

      {showLabels && (
        <div className="stl-row stl-names">
          {stages.map((s, i) => (
            <span
              key={`${s.key}-${i}`}
              className="stl-cap"
              data-stage={s.key}
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
