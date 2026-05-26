'use client';

/**
 * StatsModal — overview statistics for the current event (count, best, mean,
 * ao5/ao12/ao50/ao100, best aoN, σ, DNF%) plus histogram + trend charts.
 *
 * Slim port of packages/client/src/pages/timer/components/StatsModal.tsx (429
 * lines). Drops case-stats and CFOP-recognize tabs which depend on subset.
 */

import { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import type { Solve } from '../timer-db';
import { effectiveMs } from '../timer-db';
import { averageOfN, bestAverageOfN, bestSingle, formatMs } from '../timer-stats';
import HistogramChart from './HistogramChart';
import TrendChart from './TrendChart';

interface Props {
  solves: Solve[];
  isZh: boolean;
  onClose: () => void;
}

function mean(arr: number[]): number | null {
  if (arr.length === 0) return null;
  let s = 0;
  let c = 0;
  for (const x of arr) {
    if (!Number.isFinite(x)) continue;
    s += x;
    c++;
  }
  return c === 0 ? null : s / c;
}

function stdev(arr: number[]): number | null {
  const m = mean(arr);
  if (m === null) return null;
  let sumSq = 0;
  let c = 0;
  for (const x of arr) {
    if (!Number.isFinite(x)) continue;
    sumSq += (x - m) ** 2;
    c++;
  }
  if (c < 2) return null;
  return Math.sqrt(sumSq / (c - 1));
}

export default function StatsModal({ solves, isZh, onClose }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const stats = useMemo(() => {
    const eff = solves.map(effectiveMs);
    const finite = eff.filter(Number.isFinite) as number[];
    const dnfCount = eff.filter((v) => !Number.isFinite(v)).length;
    const overallMean = mean(finite);
    const sd = stdev(finite);
    return {
      count: solves.length,
      best: bestSingle(solves),
      mean: overallMean,
      stdev: sd,
      dnfCount,
      dnfPct: solves.length ? (dnfCount / solves.length) * 100 : 0,
      ao5: averageOfN(solves, 5),
      ao12: averageOfN(solves, 12),
      ao50: averageOfN(solves, 50),
      ao100: averageOfN(solves, 100),
      bestAo5: bestAverageOfN(solves, 5),
      bestAo12: bestAverageOfN(solves, 12),
      bestAo50: bestAverageOfN(solves, 50),
      bestAo100: bestAverageOfN(solves, 100),
    };
  }, [solves]);

  return (
    <div className="tmr-modal-backdrop" onClick={onClose}>
      <div className="tmr-modal tmr-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="tmr-modal-head">
          <h3>{t('统计', 'Statistics')}</h3>
          <button type="button" className="tmr-icon-btn" onClick={onClose} aria-label={t('关闭', 'Close')}>
            <X size={16} />
          </button>
        </div>

        <div className="tmr-stats-grid">
          <Cell label={t('数量', 'Solves')} val={String(stats.count)} />
          <Cell label={t('最佳', 'Best')} val={fmt(stats.best)} />
          <Cell label={t('平均 (全部)', 'Mean (all)')} val={fmt(stats.mean)} />
          <Cell label={t('σ', 'σ')} val={fmt(stats.stdev)} />
          <Cell label="ao5" val={fmt(stats.ao5)} />
          <Cell label="ao12" val={fmt(stats.ao12)} />
          <Cell label="ao50" val={fmt(stats.ao50)} />
          <Cell label="ao100" val={fmt(stats.ao100)} />
          <Cell label={t('最佳 ao5', 'Best ao5')} val={fmt(stats.bestAo5)} />
          <Cell label={t('最佳 ao12', 'Best ao12')} val={fmt(stats.bestAo12)} />
          <Cell label={t('最佳 ao50', 'Best ao50')} val={fmt(stats.bestAo50)} />
          <Cell label={t('最佳 ao100', 'Best ao100')} val={fmt(stats.bestAo100)} />
          <Cell label={t('DNF', 'DNF')} val={`${stats.dnfCount} (${stats.dnfPct.toFixed(1)}%)`} />
        </div>

        <div className="tmr-stats-charts">
          <div className="tmr-stats-chart">
            <div className="tmr-stats-chart-title">{t('分布', 'Distribution')}</div>
            <HistogramChart solves={solves} isZh={isZh} width={460} height={160} />
          </div>
          <div className="tmr-stats-chart">
            <div className="tmr-stats-chart-title">{t('趋势', 'Trend')}</div>
            <TrendChart solves={solves} isZh={isZh} width={460} height={160} />
          </div>
        </div>

        <div className="tmr-modal-foot">
          <button type="button" className="tmr-action-btn" onClick={onClose}>{t('关闭', 'Close')}</button>
        </div>
      </div>
    </div>
  );
}

function Cell({ label, val }: { label: string; val: string }) {
  return (
    <div className="tmr-stats-cell">
      <span className="tmr-stats-cell-label">{label}</span>
      <span className="tmr-stats-cell-val">{val}</span>
    </div>
  );
}

function fmt(v: number | null | undefined): string {
  if (v == null) return '—';
  if (v === Infinity) return 'DNF';
  return formatMs(v, 2);
}
