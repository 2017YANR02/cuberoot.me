'use client';

/**
 * Competition cross-step distribution, à la XC Master's 比赛打乱分析.
 * Aggregates every 3x3 scramble in the loaded comp, computes optimal cross
 * length per the chosen colour base, and shows total + per-round histograms as
 * compact single-row bars under one shared legend. Cross is computed live
 * (lib/cross-solver); XC/XXC need the offline analyzer pipeline (pending).
 */
import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { histogram, type Histogram } from '@/lib/comp-cross';
import {
  activeLetters, reduceDigits, COLOR_MODES, MODE_LABEL, BADGE_LETTERS,
  OPPOSITE_PAIRS, COLOR_NAME, CX_CLASS, DEFAULT_COLOR_SEL,
  type ColorMode, type ColorLetter,
} from '@/lib/cross-color-subset';
import { useStepMap, type StepMetric } from './useStepMap';
import { normScramble, type CompStepsState } from './useCompSteps';
import type { RoundSheet } from './SheetView';

type Metric = 'cross' | StepMetric;
const METRICS: { key: Metric; label: string }[] = [
  { key: 'cross', label: '十字' },
  { key: 'xc', label: 'XC' },
  { key: 'xxc', label: 'XXC' },
  { key: 'xxxc', label: 'XXXC' },
  { key: 'xxxxc', label: 'XXXXC' },
];
// comp_steps [30] 里各阶段的起始下标(每阶段 6 底色)
const METRIC_OFFSET: Record<Metric, number> = { cross: 0, xc: 6, xxc: 12, xxxc: 18, xxxxc: 24 };
const EMPTY_MAP: Map<string, number[]> = new Map();
const NO_SCR: string[] = [];

interface Props {
  sheets333: RoundSheet[];
  /** 全部唯一 333 打乱(稳定引用);未收录比赛才用它跑实时 Rust 求解兜底。 */
  scrambles: string[];
  crossMap: Map<string, number[]>;
  ready: boolean;
  /** 预计算步数表(由 TNoodleMode 共享,避免与逐行徽标重复 fetch)。 */
  pre: CompStepsState;
  /** 含备用打乱(开关提到 TNoodleMode,与「十字分析」同行)。 */
  includeExtras: boolean;
  t: (zh: string, en: string) => string;
}

function roundLabel(idx: number, t: (zh: string, en: string) => string): string {
  if (idx === 3) return t('决赛', 'Final');
  return `${t('第', 'R')}${idx + 1}${t('轮', '')}`;
}

function segColor(step: number, min: number, max: number): string {
  const f = Math.round(((step - min) / (max - min || 1)) * 100);
  return `color-mix(in srgb, var(--gen-accent) ${f}%, var(--gen-step-lo))`;
}

/** One single-row stacked bar. Steps coloured by the global (total) range so
 *  the same step is the same colour across every round. */
function Bar({ hist, gMin, gMax }: { hist: Histogram; gMin: number; gMax: number }) {
  const steps = Object.keys(hist.count).map(Number).sort((a, b) => a - b);
  return (
    <div className="gen-cx-bar">
      {steps.map((s) => {
        const c = hist.count[s];
        const pct = Math.round((c / hist.total) * 1000) / 10;
        const frac = c / hist.total;
        return (
          <span
            key={s}
            className="gen-cx-seg"
            style={{ flexGrow: c, background: segColor(s, gMin, gMax) }}
            title={`${s} · ${pct}% (${c}/${hist.total})`}
          >
            <span className="gen-cx-seg-label">{frac >= 0.16 ? `${s} ${pct}%` : s}</span>
          </span>
        );
      })}
    </div>
  );
}

export default function CompCrossAnalysis({ sheets333, scrambles, crossMap, ready, pre, includeExtras, t }: Props) {
  const [metric, setMetric] = useState<Metric>('cross');
  const [mode, setMode] = useState<ColorMode>(DEFAULT_COLOR_SEL.mode);
  const [single, setSingle] = useState<ColorLetter>(DEFAULT_COLOR_SEL.single);
  const [pair, setPair] = useState(DEFAULT_COLOR_SEL.pair);
  const [quadExcl, setQuadExcl] = useState(DEFAULT_COLOR_SEL.quadExcl);

  const letters = useMemo(
    () => activeLetters({ mode, single, pair, quadExcl }),
    [mode, single, pair, quadExcl],
  );

  // 历史比赛走 comp_steps 预计算(零解算秒出)。comp_steps 未覆盖的打乱(整场未收录 /
  // 比赛在库内不完整)逐条退回实时:cross 用 JS crossMap(瞬时),xc/xxc/xxxc/xxxxc 用 WASM
  // (只对未覆盖的算,不全量重跑)。
  const uncovered = useMemo(() => {
    if (!pre.ready) return NO_SCR;          // 还在 fetch,先不实时,避免抖动
    if (!pre.map) return scrambles;          // 整场未收录 → 全实时
    return scrambles.filter((s) => !pre.map!.has(normScramble(s)));
  }, [scrambles, pre.ready, pre.map]);
  const stepUncovered = metric === 'cross' ? NO_SCR : uncovered;
  const step = useStepMap(stepUncovered, stepUncovered.length === 0 ? null : (metric as StepMetric));

  // 每条打乱:先查预计算,miss 再用实时 map(cross=crossMap / step=WASM)。
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
    : stepUncovered.length === 0 ? true : step.ready;
  const metricName = metric === 'cross' ? t('十字', 'Cross') : metric.toUpperCase();
  const progressLabel = !pre.ready
    ? t('加载预计算数据中…', 'Loading precomputed data…')
    : metric === 'cross'
      ? t('计算十字步数中…', 'Computing cross lengths…')
      : t(`计算 ${metricName} 步数中… (${step.done}/${step.total})`, `Computing ${metricName} lengths… (${step.done}/${step.total})`);

  const gMin = data.totalHist.min;
  const gMax = data.totalHist.max;
  const legendSteps = Object.keys(data.totalHist.count).map(Number).sort((a, b) => a - b);

  const row = (key: string, name: string, scrambles: number, groups: number, hist: Histogram) => (
    <div key={key} className="gen-cx-row">
      <div className="gen-cx-rowhead" title={`${t('打乱数', 'Scrambles')}: ${scrambles}　${t('组数', 'Groups')}: ${groups}`}>
        <span className="gen-cx-rowname">{name}</span>
        <span className="gen-cx-rowsub">{scrambles} · {groups}{t('组', 'g')}</span>
      </div>
      <Bar hist={hist} gMin={gMin} gMax={gMax} />
    </div>
  );

  return (
    <section className="gen-cx-panel">
      <div className="gen-cx-controls">
        <div className="gen-cx-tabs">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              className={`gen-cx-tab${metric === m.key ? ' is-active' : ''}`}
              onClick={() => setMetric(m.key)}
            >
              {m.key === 'cross' ? t('十字', 'Cross') : m.label}
            </button>
          ))}
        </div>
        <div className="gen-cx-colorsel">
          <select
            className="gen-cx-modesel"
            value={mode}
            onChange={(e) => setMode(e.target.value as ColorMode)}
            aria-label={t('底色模式', 'Bottom-colour mode')}
          >
            {COLOR_MODES.map((m) => (
              <option key={m} value={m}>{t(MODE_LABEL[m].zh, MODE_LABEL[m].en)}</option>
            ))}
          </select>
          <div className="gen-cx-swatches">
            {mode === 'cn' && BADGE_LETTERS.map((c) => (
              <i key={c} className={`gen-cx-sw ${CX_CLASS[c]}`} title={t(COLOR_NAME[c].zh, COLOR_NAME[c].en)} />
            ))}
            {mode === 'single' && BADGE_LETTERS.map((c) => (
              <button
                key={c}
                type="button"
                className={`gen-cx-swbtn${single === c ? ' is-on' : ''}`}
                onClick={() => setSingle(c)}
                title={t(COLOR_NAME[c].zh, COLOR_NAME[c].en)}
              >
                <i className={`gen-cx-sw ${CX_CLASS[c]}`} />
              </button>
            ))}
            {mode === 'dual' && OPPOSITE_PAIRS.map((p, i) => (
              <button
                key={i}
                type="button"
                className={`gen-cx-swbtn${pair === i ? ' is-on' : ''}`}
                onClick={() => setPair(i)}
                title={p.map((c) => t(COLOR_NAME[c].zh, COLOR_NAME[c].en)).join(' / ')}
              >
                {p.map((c) => <i key={c} className={`gen-cx-sw ${CX_CLASS[c]}`} />)}
              </button>
            ))}
            {mode === 'quad' && OPPOSITE_PAIRS.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`gen-cx-swbtn${quadExcl === i ? ' is-on' : ''}`}
                onClick={() => setQuadExcl(i)}
                title={`${t('排除', 'Exclude')} ${OPPOSITE_PAIRS[i].map((c) => t(COLOR_NAME[c].zh, COLOR_NAME[c].en)).join('/')}`}
              >
                {BADGE_LETTERS.filter((c) => !OPPOSITE_PAIRS[i].includes(c)).map((c) => (
                  <i key={c} className={`gen-cx-sw ${CX_CLASS[c]}`} />
                ))}
              </button>
            ))}
          </div>
        </div>
      </div>

      {step.error ? (
        <p className="gen-cx-pending">{t('计算失败', 'Computation failed')}: {step.error}</p>
      ) : !activeReady && data.totalHist.total === 0 ? (
        <p className="gen-cx-loading"><Loader2 size={15} className="gen-spin" />{progressLabel}</p>
      ) : data.totalHist.total === 0 ? (
        <p className="gen-cx-pending">{t('该比赛没有可分析的三阶打乱。', 'No analysable 3x3 scrambles in this competition.')}</p>
      ) : (
        <>
          {!activeReady && (
            <p className="gen-cx-loading"><Loader2 size={15} className="gen-spin" />{progressLabel}</p>
          )}
          <ul className="gen-cx-legend">
            {legendSteps.map((s) => (
              <li key={s}>
                <i className="gen-cx-dot" style={{ background: segColor(s, gMin, gMax) }} />
                {t(`${s}步`, `${s}`)}
              </li>
            ))}
          </ul>
          <div className="gen-cx-rows">
            {row('total', t('总计', 'Total'), data.totalHist.total, data.totalGroups, data.totalHist)}
            {data.rounds.length > 1 && data.rounds.map((r) =>
              row(`r${r.idx}`, roundLabel(r.idx, t), r.hist.total, r.groups, r.hist),
            )}
          </div>
        </>
      )}
    </section>
  );
}
