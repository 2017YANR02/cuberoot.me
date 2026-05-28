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
import {
  baseValue, histogram, COLOR_BASES, COLOR_BASE_LABEL,
  type ColorBase, type Histogram,
} from '@/lib/comp-cross';
import PillToggle from '@/components/PillToggle/PillToggle';
import type { RoundSheet } from './SheetView';

type Metric = 'cross' | 'xc' | 'xxc';
const METRICS: { key: Metric; label: string }[] = [
  { key: 'cross', label: '十字' },
  { key: 'xc', label: 'XC' },
  { key: 'xxc', label: 'XXC' },
];

interface Props {
  sheets333: RoundSheet[];
  crossMap: Map<string, number[]>;
  ready: boolean;
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

export default function CompCrossAnalysis({ sheets333, crossMap, ready, t }: Props) {
  const [metric, setMetric] = useState<Metric>('cross');
  const [base, setBase] = useState<ColorBase>('white');
  const [includeExtras, setIncludeExtras] = useState(true);

  const data = useMemo(() => {
    const byRound = new Map<number, { values: number[]; groups: Set<string> }>();
    const all: number[] = [];
    const allGroups = new Set<string>();
    for (const sh of sheets333) {
      const gkey = `${sh.roundIdx}:${sh.groupIdx}`;
      for (const a of sh.attempts) {
        if (!includeExtras && a.isExtra) continue;
        const d = a.scramble ? crossMap.get(a.scramble) : undefined;
        if (!d) continue;
        const v = baseValue(d, base);
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
  }, [sheets333, crossMap, base, includeExtras]);

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
      <div className="gen-cx-toprow">
        <h2 className="gen-cx-title">{t('十字步数分布统计', 'Cross length distribution')}</h2>
        <PillToggle
          value={includeExtras}
          onChange={setIncludeExtras}
          onLabel={t('备打', 'Extras')}
          offLabel={t('备打', 'Extras')}
          ariaLabel={t('含备用打乱', 'Include extra scrambles')}
        />
      </div>

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
        <div className="gen-cx-tabs">
          {COLOR_BASES.map((b) => (
            <button
              key={b}
              type="button"
              className={`gen-cx-tab${base === b ? ' is-active' : ''}`}
              onClick={() => setBase(b)}
            >
              {t(COLOR_BASE_LABEL[b].zh, COLOR_BASE_LABEL[b].en)}
            </button>
          ))}
        </div>
      </div>

      {metric !== 'cross' ? (
        <p className="gen-cx-pending">
          {t(
            'XC / XXC 最少步需要离线预计算管线,暂未接入(十字为浏览器实时计算)。',
            'XC / XXC optimal lengths need the offline analyzer pipeline — not wired yet (Cross is computed live in-browser).',
          )}
        </p>
      ) : !ready ? (
        <p className="gen-cx-loading"><Loader2 size={15} className="gen-spin" />{t('计算十字步数中…', 'Computing cross lengths…')}</p>
      ) : data.totalHist.total === 0 ? (
        <p className="gen-cx-pending">{t('该比赛没有可分析的三阶打乱。', 'No analysable 3x3 scrambles in this competition.')}</p>
      ) : (
        <>
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
