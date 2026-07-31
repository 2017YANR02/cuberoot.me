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
 * 同一根轴在两个地方用:报告顶部(带阶段名和阶段用时)和回放的进度条(不带名字,
 * 但多一个游标,而且可以点着跳)。所以名字和游标都是可选的,不是两个组件。
 */

import { useMemo } from 'react';

import { tr } from '@/i18n/tr';

import type { ReconTextLine } from '../_lib/reconstruct/recon_text';
import type { SolveMove } from '../_lib/reconstruct/stage_segments';

export interface SolveTimelineProps {
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

/** 轨道上的一段:一步的「在看」或「在拧」。 */
interface Seg {
  key: string;
  stage: StageKey;
  /** 同阶段里的第几段,用来给四对 F2L 分深浅。 */
  shade: number;
  pause: boolean;
  fromMs: number;
  toMs: number;
}

const pct = (v: number) => `${(v * 100).toFixed(3)}%`;

const stageOfLine = (kind: ReconTextLine['kind']): StageKey => (
  kind === 'inspection' || kind === 'cross' ? 'cross' : kind === 'f2l' ? 'f2l' : kind
);

export default function SolveTimeline({
  moves, totalMs, lines, showLabels, currentIdx, onSeek,
}: SolveTimelineProps) {
  const span = Math.max(1, totalMs);

  // 一行两段:识别(暗)+ 执行(亮)。识别数缺席时整行都算执行 —— 不为它编一个停顿。
  const segs = useMemo<Seg[]>(() => {
    const out: Seg[] = [];
    const seen: Record<string, number> = {};
    for (const line of lines) {
      const stage = stageOfLine(line.kind);
      const shade = seen[stage] ?? 0;
      seen[stage] = shade + 1;
      // 一步从「上一手落下」算起,所以起点是 fromIdx-1 那一手的时刻(第一步从 0 起)。
      const fromMs = line.fromIdx > 0 ? (moves[line.fromIdx - 1]?.ts ?? 0) : 0;
      const toMs = moves[line.toIdx]?.ts ?? fromMs;
      // 识别时间是分步分析表算好的,可能因为四舍五入比这一步还长 —— 钳住,
      // 否则执行段会算出负宽度盖到下一步头上。
      const recog = Math.max(0, Math.min(line.recognitionMs ?? 0, toMs - fromMs));
      if (recog > 0) {
        out.push({ key: `${line.key}-p`, stage, shade, pause: true, fromMs, toMs: fromMs + recog });
      }
      out.push({ key: line.key, stage, shade, pause: false, fromMs: fromMs + recog, toMs });
    }
    return out;
  }, [lines, moves]);

  const stages = useMemo<StageSpan[]>(() => {
    const label: Record<StageKey, string> = {
      cross: tr({ zh: '十字', en: 'CROSS' }), f2l: 'F2L', oll: 'OLL', pll: 'PLL',
    };
    const out: StageSpan[] = [];
    for (const line of lines) {
      const key = stageOfLine(line.kind);
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
              data-shade={Math.min(3, s.shade)}
              data-pause={s.pause ? '' : undefined}
              style={{ left: pct(s.fromMs / span), width: pct(w) }}
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
