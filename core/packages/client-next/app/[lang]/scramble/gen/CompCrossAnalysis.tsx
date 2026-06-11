'use client';

/**
 * Competition cross-step distribution, à la XC Master's 比赛打乱分析.
 * Aggregates every 3x3 scramble in the loaded comp, computes optimal cross
 * length per the chosen colour base, and shows total + per-round distributions.
 * Two interchangeable views (heatmap grid / stacked bars). Clicking any step
 * (legend / column head / cell / bar segment) reports that selection up via
 * `onFilterChange`; TNoodleMode then filters the real scramble sheets below to
 * just those scrambles. Cross is computed live (lib/cross-solver); XC/XXC need
 * the offline analyzer pipeline.
 */
import { useEffect, useMemo, useState } from 'react';
import { Loader2, LayoutGrid, BarChart3 } from 'lucide-react';
import { histogram, type Histogram } from '@/lib/comp-cross';
import { reduceDigits, type ColorLetter } from '@/lib/cross-color-subset';
import type { StepMapState, StepMetric } from './useStepMap';
import { normScramble, type CompStepsState } from './useCompSteps';
import { stageLabel } from '@/lib/scramble-variants';
import type { RoundSheet } from './SheetView';

// b122/b123/b222/b223/bf2b = 块类指标(1x2x2 方块 / 1x2x3 / 2x2x2 / 2x2x3 / 双1x2x3),
// beo/beoline/bdr = EOLine 系与 DR;数据在各自变体的 comp_steps_<key> 里按阶段序排
// (123/eoline 两阶段,其余单阶段)。
export type Metric = 'cross' | StepMetric | 'b122' | 'b123' | 'b222' | 'b223' | 'bf2b' | 'beo' | 'beoline' | 'bdr';
// 指标显示名统一走 lib/scramble-variants 的 stageLabel(b 前缀指标键已在表内别名)。
// comp_steps [30] 里各阶段的起始下标(每阶段 6 底色)。逐行徽标切片也用它。
export const METRIC_OFFSET: Record<Metric, number> = {
  cross: 0, xc: 6, xxc: 12, xxxc: 18, xxxxc: 24,
  b122: 0, b123: 6, b222: 0, b223: 0,
  bf2b: 0, beo: 0, beoline: 6, bdr: 0,
};
const EMPTY_MAP: Map<string, number[]> = new Map();

type View = 'heatmap' | 'bars';
const VIEW_KEY = 'gen:cxView';
function readView(): View {
  if (typeof localStorage === 'undefined') return 'heatmap';
  return localStorage.getItem(VIEW_KEY) === 'bars' ? 'bars' : 'heatmap';
}

/** Selection reported to the parent so it can filter the scramble sheets. */
export interface CrossFilter {
  /** Selected step count (e.g. 5 = 5-move cross). */
  step: number;
  /** Exact scramble strings whose current-metric value == step. */
  scrambles: Set<string>;
}

interface Props {
  sheets333: RoundSheet[];
  crossMap: Map<string, number[]>;
  ready: boolean;
  /** 预计算步数表(由 TNoodleMode 共享,避免与逐行徽标重复 fetch)。 */
  pre: CompStepsState;
  /** 非 cross 指标的实时 WASM 步数表 + 进度(由 TNoodleMode 统一跑,与逐行徽标共用)。 */
  step: StepMapState;
  /** 当前指标下需实时解算的打乱数(=0 时无需等 step,直接 ready)。 */
  stepUncoveredCount: number;
  /** 该变体无 client 引擎(eo/pair/pseudo/pseudo_pair):未命中预计算即「暂无数据」,不会现算。 */
  engineless?: boolean;
  /** 含备用打乱(开关提到 TNoodleMode,与「分析」同行)。 */
  includeExtras: boolean;
  /** 当前指标(十字 / XC / …)与底色子集字母,均由 TNoodleMode 的控制行提供。 */
  metric: Metric;
  letters: ColorLetter[];
  /** 点击步数 → 把选中步 + 命中打乱集合上报,父级据此过滤下方打乱表。 */
  onFilterChange?: (filter: CrossFilter | null) => void;
  t: (zh: string, en: string, zhHant?: string) => string;
}

function roundLabel(idx: number, t: (zh: string, en: string, zhHant?: string) => string): string {
  if (idx === 3) return t('决赛', 'Final', "決賽");
  return `${t('第', 'R')}${idx + 1}${t('轮', '', "輪")}`;
}

function segColor(step: number, min: number, max: number): string {
  const f = Math.round(((step - min) / (max - min || 1)) * 100);
  return `color-mix(in srgb, var(--gen-accent) ${f}%, var(--gen-step-lo))`;
}

/** One single-row stacked bar (步号着色,无百分比文字 — 数值看图例 / tooltip)。 */
function Bar({ hist, gMin, gMax, selStep, onStep }: {
  hist: Histogram; gMin: number; gMax: number;
  selStep: number | null; onStep: (s: number) => void;
}) {
  const steps = Object.keys(hist.count).map(Number).sort((a, b) => a - b);
  return (
    <div className="gen-cx-bar">
      {steps.map((s) => {
        const c = hist.count[s];
        const pct = Math.round((c / hist.total) * 1000) / 10;
        const frac = c / hist.total;
        const cls = `gen-cx-seg${selStep != null && selStep !== s ? ' is-dim' : ''}${selStep === s ? ' is-sel' : ''}`;
        return (
          <span
            key={s}
            className={cls}
            style={{ flexGrow: c, background: segColor(s, gMin, gMax) }}
            title={`${s} · ${pct}% (${c}/${hist.total})`}
            onClick={() => onStep(s)}
          >
            <span className="gen-cx-seg-label">{frac >= 0.08 ? s : ''}</span>
          </span>
        );
      })}
    </div>
  );
}

export default function CompCrossAnalysis({ sheets333, crossMap, ready, pre, step, stepUncoveredCount, engineless, includeExtras, metric, letters, onFilterChange, t }: Props) {
  const [view, setViewState] = useState<View>(readView);
  const setView = (v: View) => {
    setViewState(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* swallow */ }
  };
  const [selStep, setSelStep] = useState<number | null>(null);
  const toggleStep = (s: number) => setSelStep((cur) => (cur === s ? null : s));

  // 每条打乱:先查预计算(pre.map 各指标 6 列),miss 再用实时 map(cross=crossMap / 其它=step WASM)。
  const valFor = useMemo(() => {
    const off = METRIC_OFFSET[metric];
    const pm = pre.map;
    const live = metric === 'cross' ? crossMap : (step.map ?? EMPTY_MAP);
    return (scr: string): number | null => {
      const pv = pm?.get(normScramble(scr));
      if (pv) return reduceDigits(pv.slice(off, off + 6), letters);
      const d = live.get(scr);
      return d ? reduceDigits(d, letters) : null;
    };
  }, [pre.map, metric, crossMap, step.map, step.done, letters]);

  const data = useMemo(() => {
    const byRound = new Map<number, { values: number[]; groups: Set<string> }>();
    const all: number[] = [];
    const allGroups = new Set<string>();
    for (const sh of sheets333) {
      const gkey = `${sh.roundIdx}:${sh.groupIdx}`;
      for (const a of sh.attempts) {
        if (!includeExtras && a.isExtra) continue;
        const v = a.scramble ? valFor(a.scramble) : null;
        if (v == null) continue;
        all.push(v);
        allGroups.add(gkey);
        let r = byRound.get(sh.roundIdx);
        if (!r) { r = { values: [], groups: new Set() }; byRound.set(sh.roundIdx, r); }
        r.values.push(v);
        r.groups.add(gkey);
      }
    }
    const rounds = [...byRound.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([idx, r]) => ({ idx, groups: r.groups.size, hist: histogram(r.values) }));
    return { rounds, totalGroups: allGroups.size, totalHist: histogram(all) };
  }, [sheets333, valFor, includeExtras]);

  const activeReady = !pre.ready ? false
    : metric === 'cross' ? ready
    : stepUncoveredCount === 0 ? true : step.ready;
  const metricName = t(stageLabel(metric, true), stageLabel(metric, false));
  const progressLabel = !pre.ready
    ? t('加载预计算数据中…', 'Loading precomputed data…', "載入預計算資料中…")
    : metric === 'cross'
      ? t('计算十字步数中…', 'Computing cross lengths…', "計算十字步數中…")
      : t(`计算 ${metricName} 步数中… (${step.done}/${step.total})`, `Computing ${metricName} lengths… (${step.done}/${step.total})`, `計算 ${metricName} 步數中… (${step.done}/${step.total})`);

  const gMin = data.totalHist.min;
  const gMax = data.totalHist.max;
  const legendSteps = Object.keys(data.totalHist.count).map(Number).sort((a, b) => a - b);

  // metric / 底色子集 改变后,旧的 selStep 可能已不在分布里 → 清掉。
  useEffect(() => {
    setSelStep((cur) => (cur != null && !legendSteps.includes(cur) ? null : cur));
  }, [legendSteps]);

  // 选中某步:命中该比赛里十字步数 == selStep 的打乱集合(尊重备打开关),上报父级过滤打乱表。
  const matchSet = useMemo(() => {
    const set = new Set<string>();
    if (selStep == null) return set;
    for (const sh of sheets333) {
      for (const a of sh.attempts) {
        if (!includeExtras && a.isExtra) continue;
        if (a.scramble && valFor(a.scramble) === selStep) set.add(a.scramble);
      }
    }
    return set;
  }, [selStep, sheets333, includeExtras, valFor]);

  useEffect(() => {
    onFilterChange?.(selStep == null ? null : { step: selStep, scrambles: matchSet });
  }, [selStep, matchSet, onFilterChange]);
  // 卸载(关掉十字分析 / 切到非 333 项目)时清掉父级 filter,避免打乱表残留过滤。
  useEffect(() => () => onFilterChange?.(null), [onFilterChange]);

  // ── 两种视图共享的数据行 ──
  const dataRows = [
    { key: 'total', name: t('总计', 'Total', "總計"), groups: data.totalGroups, hist: data.totalHist },
    ...(data.rounds.length > 1
      ? data.rounds.map((r) => ({ key: `r${r.idx}`, name: roundLabel(r.idx, t), groups: r.groups, hist: r.hist }))
      : []),
  ];

  const rowHead = (name: string, scr: number, groups: number) => (
    <div className="gen-cx-rowhead" title={`${t('打乱数', 'Scrambles', "打亂數")}: ${scr}　${t('组数', 'Groups', "組數")}: ${groups}`}>
      <span className="gen-cx-rowname">{name}</span>
      <span className="gen-cx-rowsub">{scr} · {groups}{t('组', 'g', "組")}</span>
    </div>
  );

  return (
    <section className="gen-cx-panel">
      {step.error ? (
        <p className="gen-cx-pending">{t('计算失败', 'Computation failed', "計算失敗")}: {step.error}</p>
      ) : !activeReady && data.totalHist.total === 0 ? (
        <p className="gen-cx-loading"><Loader2 size={15} className="gen-spin" />{progressLabel}</p>
      ) : data.totalHist.total === 0 ? (
        <p className="gen-cx-pending">{
          engineless && !pre.map
            ? t('该变体此比赛暂无预计算数据(等待服务端补算)。', 'No precomputed data for this variant in this competition yet.', "該變體此比賽暫無預計算資料(等待服務端補算)。")
            : t('该比赛没有可分析的三阶打乱。', 'No analysable 3x3 scrambles in this competition.', "該比賽沒有可分析的三階打亂。")
        }</p>
      ) : (
        <>
          {!activeReady && (
            <p className="gen-cx-loading"><Loader2 size={15} className="gen-spin" />{progressLabel}</p>
          )}
          <div className="gen-cx-legendrow">
            {/* 热力网格的列头已是「色点 + 步号 + 可点筛选」,图例重复 → 仅条形图显示图例当色标 */}
            {view === 'bars' ? (
              <ul className="gen-cx-legend">
                {legendSteps.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      className={`gen-cx-legbtn${selStep != null && selStep !== s ? ' is-dim' : ''}${selStep === s ? ' is-sel' : ''}`}
                      onClick={() => toggleStep(s)}
                      title={t(`筛选 ${s} 步`, `Filter ${s}`, `篩選 ${s} 步`)}
                    >
                      <i className="gen-cx-dot" style={{ background: segColor(s, gMin, gMax) }} />
                      {t(`${s}步`, `${s}`)}
                    </button>
                  </li>
                ))}
              </ul>
            ) : <span />}
            <div className="gen-cx-viewtoggle" role="group" aria-label={t('视图', 'View', "檢視")}>
              <button
                type="button"
                className={`gen-cx-viewbtn${view === 'heatmap' ? ' is-on' : ''}`}
                onClick={() => setView('heatmap')}
                title={t('热力网格', 'Heatmap grid', "熱力網格")}
                aria-label={t('热力网格', 'Heatmap grid', "熱力網格")}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                type="button"
                className={`gen-cx-viewbtn${view === 'bars' ? ' is-on' : ''}`}
                onClick={() => setView('bars')}
                title={t('条形图', 'Stacked bars', "條形圖")}
                aria-label={t('条形图', 'Stacked bars', "條形圖")}
              >
                <BarChart3 size={14} />
              </button>
            </div>
          </div>

          {view === 'bars' ? (
            <div className="gen-cx-rows">
              {dataRows.map((dr) => (
                <div key={dr.key} className="gen-cx-row">
                  {rowHead(dr.name, dr.hist.total, dr.groups)}
                  <Bar hist={dr.hist} gMin={gMin} gMax={gMax} selStep={selStep} onStep={toggleStep} />
                </div>
              ))}
            </div>
          ) : (
            <div className="gen-cx-hm" style={{ ['--cx-cols' as string]: legendSteps.length }}>
              <div className="gen-cx-hm-corner" />
              {legendSteps.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`gen-cx-hm-colhead${selStep != null && selStep !== s ? ' is-dim' : ''}${selStep === s ? ' is-sel' : ''}`}
                  onClick={() => toggleStep(s)}
                  title={t(`筛选 ${s} 步`, `Filter ${s}`, `篩選 ${s} 步`)}
                >
                  <i className="gen-cx-dot" style={{ background: segColor(s, gMin, gMax) }} />{s}
                </button>
              ))}
              {dataRows.map((dr) => {
                const rowMax = Math.max(1, ...legendSteps.map((s) => dr.hist.count[s] ?? 0));
                return [
                  <div key={`${dr.key}-h`} className="gen-cx-hm-headcell">{rowHead(dr.name, dr.hist.total, dr.groups)}</div>,
                  ...legendSteps.map((s) => {
                    const c = dr.hist.count[s] ?? 0;
                    if (!c) return <div key={`${dr.key}-${s}`} className="gen-cx-hm-cell is-empty">·</div>;
                    const alpha = Math.round(22 + 78 * (c / rowMax));
                    const cls = `gen-cx-hm-cell${selStep != null && selStep !== s ? ' is-dim' : ''}${selStep === s ? ' is-sel' : ''}`;
                    return (
                      <div
                        key={`${dr.key}-${s}`}
                        className={cls}
                        onClick={() => toggleStep(s)}
                        title={`${s} ${t('步', '')} · ${Math.round((c / dr.hist.total) * 1000) / 10}% (${c}/${dr.hist.total})`}
                        style={{
                          background: `color-mix(in srgb, ${segColor(s, gMin, gMax)} ${alpha}%, transparent)`,
                          color: alpha > 55 ? '#fff' : 'var(--gen-text)',
                        }}
                      >
                        {c}
                      </div>
                    );
                  }),
                ];
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
