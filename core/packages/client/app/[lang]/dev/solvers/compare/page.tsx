'use client';

import { parseAsStringEnum, useQueryState } from 'nuqs';
import BackHome from '@/components/BackHome';
import HeaderToggles from '@/components/HeaderToggles';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';
import { COMPARISON_ROWS, type Family, type SolverComparisonRow } from './comparison-data';
import { BENCHMARK_MACHINES, WCA100 } from './unified-benchmark';
import '@/components/sticky-table.css';
import './compare.css';

const families: Family[] = ['opt', 'rust-wasm', 'rust-opt', 'rust', 'nissy'];
const familyFilters = ['all', 'opt', 'nissy', 'rust', 'rust-h', 'rust-opt', 'rust-wasm'] as const;
const names = {
  opt: { zh: '原版 WASM Opt', en: 'Original WASM Opt' },
  nissy: { zh: 'Nissy C', en: 'Nissy C' },
  rust: { zh: 'Rust H', en: 'Rust H' },
  'rust-opt': { zh: 'Rust 原生 Opt', en: 'Rust native Opt' },
  'rust-wasm': { zh: 'Rust WASM Opt', en: 'Rust WASM Opt' },
};
const memory = (n: number | null) => n === null ? '—' : n < 1e9 ? `${Math.round(n / 1e6)} MB` : `${(n / 1e9).toFixed(1)} GB`;
const shortMemory = (n: number) => n < 1e9 ? `${Math.round(n / 1e6)}M` : `${(n / 1e9).toFixed(1)}G`;
const seconds = (n: number) => `${n.toFixed(1)} s`;
const solverName = (row: SolverComparisonRow) => `${tr(names[row.family]).replace(/ (Opt|H)$/, '')} ${row.label}`;

export default function SolverComparisonPage() {
  const t = useT();
  const [metric, setMetric] = useQueryState('metric', parseAsStringEnum(['table', 'time', 'rss']).withDefault('time'));
  const [family, setFamily] = useQueryState('family', parseAsStringEnum([...familyFilters]).withDefault('all'));
  const [scale, setScale] = useQueryState('scale', parseAsStringEnum(['log', 'linear']).withDefault('log'));
  const machine = BENCHMARK_MACHINES.find(m => m.id === 'mac')!;
  const selectedFamilies = families.filter(f => family === 'all'
    || (family === 'rust' ? f === 'rust' || f === 'rust-opt' || f === 'rust-wasm'
      : family === 'rust-h' ? f === 'rust' : family === f));
  const rows = COMPARISON_ROWS.filter(r => selectedFamilies.includes(r.family));
  const results = WCA100.results.filter(r => r.machineId === machine.id && r.threads === machine.threads);
  const measured = rows.flatMap(row => {
    const result = results.find(r => r.id === row.id);
    return result ? [{ row, result }] : [];
  });
  const value = (id: string, tableBytes: number) => {
    const result = results.find(r => r.id === id);
    return metric === 'table' ? tableBytes : metric === 'time' ? result?.seconds ?? null : result?.peakRssBytes ?? null;
  };
  const groups = [...new Set(rows.map(r => r.eoBits))].sort((a, b) => a - b).map(eo => ({ eo, rows: rows.filter(r => r.eoBits === eo) }));
  const max = Math.max(1, ...rows.map(r => value(r.id, r.tableBytes) ?? 0));
  const log = metric !== 'time' && scale === 'log';
  const logMax = Math.max(7, Math.ceil(Math.log10(max)));
  const step = 10 ** Math.floor(Math.log10(max));
  const linearMax = Math.ceil(max / step) * step;
  const height = (n: number) => Math.max(0, 100 * (log ? (Math.log10(n) - 6) / (logMax - 6) : n / linearMax));
  const ticks = log ? Array.from({ length: logMax - 5 }, (_, i) => 10 ** (i + 6)) : [0, .25, .5, .75, 1].map(x => x * linearMax);
  const format = (n: number) => metric === 'time' ? seconds(n) : memory(n);
  const status = (row: SolverComparisonRow) => {
    if (row.execution === 'disabled') return t('禁止运行', 'Execution disabled');
    if (row.family === 'nissy') return row.tableAvailable ? t('有表 · 本轮不测', 'Table available · excluded') : t('无表 · 本轮不测', 'No table · excluded');
    if (!row.tableAvailable) return t('无表', 'No table');
    return results.some(r => r.id === row.id) ? t('已测', 'Measured') : t('有表 · 待测', 'Table available · pending');
  };

  return <main className="solver-compare">
    <div className="compare-top"><BackHome prefetch={false} /><HeaderToggles /></div>
    <header className="compare-header"><h1>{t('求解器对比', 'Solver comparison')}</h1><span>{tr(machine.label)} · WCA{WCA100.count} · {t('单轮不预热', 'one pass, no warmup')}</span></header>
    <div className="compare-controls">
      <label>{t('指标', 'Metric')}<select className="compare-select" value={metric} onChange={e => { void setMetric(e.target.value as typeof metric); }}><option value="table">{t('表容量', 'Table size')}</option><option value="time">{t('100 条求解耗时', '100-scramble solve time')}</option><option value="rss">{t('峰值内存', 'Peak memory')}</option></select></label>
      <label>{t('系列', 'Family')}<select className="compare-select" value={family} onChange={e => { void setFamily(e.target.value as typeof family); }}><option value="all">{t('全部', 'All')}</option><option value="rust">{t('全部 Rust', 'All Rust')}</option>{families.map(f => <option key={f} value={f === 'rust' ? 'rust-h' : f}>{tr(names[f])}</option>)}</select></label>
      {metric !== 'time' && <label>{t('刻度', 'Scale')}<select className="compare-select" value={scale} onChange={e => { void setScale(e.target.value as typeof scale); }}><option value="log">{t('对数', 'Logarithmic')}</option><option value="linear">{t('线性', 'Linear')}</option></select></label>}
    </div>
    {metric === 'table' ? <figure className="compare-chart">
      <div className="compare-legend">{selectedFamilies.map(f => <span key={f}><i className={'is-' + f} />{tr(names[f])}</span>)}</div>
      <div className="compare-chart-scroll"><div className="compare-chart-inner" style={{ minWidth: Math.max(540, groups.length * (selectedFamilies.length > 3 ? 90 : 65) + 60) }}>
        <div className="compare-axis">{ticks.map(tick => <span key={tick} style={{ bottom: height(tick) + '%' }}>{memory(tick)}</span>)}</div>
        <div className="compare-plot" style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}>
          <div className="compare-grid" aria-hidden="true">{ticks.map(tick => <span key={tick} style={{ bottom: height(tick) + '%' }} />)}</div>
          {groups.map(g => <div key={g.eo} className="compare-cluster">
            <div className="compare-cluster-bars">{selectedFamilies.map(f => { const row = g.rows.find(r => r.family === f); return row ? <div key={f} className="compare-lane"><div className={'compare-column is-' + f} style={{ height: height(row.tableBytes) + '%' }} aria-label={`${solverName(row)}: ${memory(row.tableBytes)}`}><span>{shortMemory(row.tableBytes)}</span></div></div> : null; })}</div>
            <span className="compare-x-label">{[...new Set(g.rows.map(r => r.label))].join(' / ')}</span>
          </div>)}
        </div>
      </div></div>
      <figcaption>{t('按 EO 对齐 · 表容量', 'Aligned by EO · table size')}{log && t(' · 对数刻度', ' · logarithmic scale')}</figcaption>
    </figure> : measured.length ? <figure className="compare-performance">
      {measured.map(({ row, result }) => { const n = metric === 'time' ? result.seconds : result.peakRssBytes; return <div className="compare-performance-row" key={row.id}>
        <span>{solverName(row)}</span><div className="compare-performance-track"><div className={'is-' + row.family} style={{ width: height(n) + '%' }} /></div><strong>{format(n)}</strong>
      </div>; })}
    </figure> : <div className="compare-empty">{t(`暂无 ${machine.threads} 线程实测`, `No ${machine.threads}-thread results yet`)}</div>}
    <details className="compare-details"><summary className="compare-summary">{t('详细数据', 'Detailed data')}</summary><div className="sticky-scroll"><table className="sticky-thead compare-table"><thead><tr><th>{t('求解器', 'Solver')}</th><th>EO</th><th>{t('表容量', 'Table size')}</th><th>{t('100 条耗时', '100-scramble time')}</th><th>{t('峰值内存', 'Peak memory')}</th><th>{t('本机状态', 'Local status')}</th></tr></thead><tbody>{rows.map(row => { const result = results.find(r => r.id === row.id); return <tr key={row.id}><th scope="row"><i className={'compare-dot is-' + row.family} />{solverName(row)}</th><td>{row.eoBits}</td><td>{memory(row.tableBytes)}</td><td>{result ? seconds(result.seconds) : '—'}</td><td>{memory(result?.peakRssBytes ?? null)}</td><td>{status(row)}</td></tr>; })}</tbody></table></div></details>
  </main>;
}
