'use client';

import { parseAsStringEnum, useQueryState } from 'nuqs';
import BackHome from '@/components/BackHome';
import HeaderToggles from '@/components/HeaderToggles';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';
import { COMPARISON_ROWS } from './comparison-data';
import { BENCHMARK_MACHINES, WCA_BENCHMARK } from './unified-benchmark';
import './compare.css';

const memory = (n: number) => n < 1e9 ? `${Math.round(n / 1e6)} MB` : `${(n / 1e9).toFixed(1)} GB`;

export default function SolverComparisonPage() {
  const t = useT();
  const [metric, setMetric] = useQueryState('metric', parseAsStringEnum(['table', 'time', 'rss']).withDefault('time'));
  const machine = BENCHMARK_MACHINES.find(m => m.id === 'mac')!;
  const results = WCA_BENCHMARK.results.filter(r => r.machineId === machine.id && r.threads === machine.threads);
  const rows = COMPARISON_ROWS.map(row => {
    const result = results.find(r => r.id === row.id);
    const value = metric === 'table' ? row.tableBytes : metric === 'time' ? result?.seconds : result?.peakRssBytes;
    return { ...row, value };
  });
  const max = Math.max(1, ...rows.map(row => row.value ?? 0));
  const format = (n: number) => metric === 'time' ? `${n.toFixed(1)} s` : memory(n);

  return <main className="solver-compare">
    <div className="compare-topbar"><BackHome prefetch={false} /><HeaderToggles /></div>
    <header className="compare-header">
      <h1>Opt9 / Opt10</h1>
      <span>{t('Rust 原生', 'Native Rust')} · {tr(machine.label)} · WCA{WCA_BENCHMARK.count} · {t('单轮不预热', 'one pass, no warmup')}</span>
    </header>
    <label className="compare-control">{t('指标', 'Metric')}
      <select className="compare-select" value={metric} onChange={e => { void setMetric(e.target.value as typeof metric); }}>
        <option value="time">{t('1000 条求解耗时', '1000-scramble solve time')}</option>
        <option value="table">{t('表容量', 'Table size')}</option>
        <option value="rss">{t('峰值内存', 'Peak memory')}</option>
      </select>
    </label>
    <figure className="compare-performance">
      {rows.map(row => <div className="compare-performance-row" key={row.id}>
        <span>{row.label}</span>
        <div className="compare-performance-track" aria-hidden="true">
          {row.value !== undefined && <div className={`is-${row.label.toLowerCase()}`} style={{ width: `${100 * row.value / max}%` }} />}
        </div>
        <strong>{row.value === undefined ? t('未测', 'Not measured') : format(row.value)}</strong>
      </div>)}
    </figure>
  </main>;
}
