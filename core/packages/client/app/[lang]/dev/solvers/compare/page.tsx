'use client';

import { parseAsStringEnum, useQueryState } from 'nuqs';
import BackHome from '@/components/BackHome';
import HeaderToggles from '@/components/HeaderToggles';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';
import { BENCHMARK_GROUPS, COMPARISON_ROWS, type Family, type GroupId } from './comparison-data';
import { WCA100 } from './unified-benchmark';
import '@/components/sticky-table.css';
import './compare.css';

const families: Family[] = ['opt', 'nissy', 'rust'];
const names = { opt: 'cube48opt · WASM', nissy: 'Nissy · C', rust: 'CubeRoot · Rust H' };
const memory = (n: number | null) => n === null ? '—' : n < 1e9 ? `${Math.round(n / 1e6)} MB` : `${(n / 1e9).toFixed(1)} GB`;
const shortMemory = (n: number) => n < 1e9 ? `${Math.round(n / 1e6)}M` : `${(n / 1e9).toFixed(1)}G`;
const seconds = (n: number) => `${n.toFixed(3)} s`;

export default function SolverComparisonPage() {
  const t = useT();
  const [metric, setMetric] = useQueryState('metric', parseAsStringEnum(['table', 'time', 'rss']).withDefault('table'));
  const [family, setFamily] = useQueryState('family', parseAsStringEnum(['all', ...families]).withDefault('all'));
  const [scale, setScale] = useQueryState('scale', parseAsStringEnum(['log', 'linear']).withDefault('log'));
  const [historyGroup, setHistoryGroup] = useQueryState('benchmark', parseAsStringEnum<GroupId>(BENCHMARK_GROUPS.map(g => g.id)).withDefault('h10-60'));
  const selectedFamilies = families.filter(f => family === 'all' || family === f);
  const rows = COMPARISON_ROWS.filter(r => selectedFamilies.includes(r.family));
  const value = (id: string, tableBytes: number) => {
    const measured = WCA100.results.find(r => r.id === id);
    return metric === 'table' ? tableBytes : metric === 'time' ? measured?.seconds ?? null : measured?.peakRssBytes ?? null;
  };
  const groups = [...new Set(rows.map(r => r.eoBits))].sort((a, b) => a - b).map(eo => ({ eo, rows: rows.filter(r => r.eoBits === eo) }));
  const measuredRows = rows.filter(r => value(r.id, r.tableBytes) !== null);
  const max = Math.max(1, ...rows.map(r => value(r.id, r.tableBytes) ?? 0));
  const log = metric !== 'time' && scale === 'log';
  const logMax = Math.max(7, Math.ceil(Math.log10(max)));
  const step = 10 ** Math.floor(Math.log10(max));
  const linearMax = Math.ceil(max / step) * step;
  const height = (n: number) => 100 * (log ? (Math.log10(n) - 6) / (logMax - 6) : n / linearMax);
  const ticks = log ? Array.from({ length: logMax - 5 }, (_, i) => 10 ** (i + 6)) : [0, .25, .5, .75, 1].map(x => x * linearMax);
  const format = (n: number) => metric === 'time' ? seconds(n) : memory(n);
  const history = BENCHMARK_GROUPS.find(g => g.id === historyGroup)!;
  const historyMax = Math.max(...history.comparisons.flatMap(r => [r.originalSeconds, r.rustSeconds]));

  return <main className="solver-compare">
    <div className="compare-top"><BackHome prefetch={false} /><HeaderToggles /></div>
    <header className="compare-header"><h1>{t('求解器对比', 'Solver comparison')}</h1><span>{t('WCA 前 100 条 · ', 'First 100 WCA scrambles · ') + tr(WCA100.status)}</span></header>
    <div className="compare-controls">
      <label>{t('指标', 'Metric')}<select className="compare-select" value={metric} onChange={e => { void setMetric(e.target.value as typeof metric); }}><option value="table">{t('表容量', 'Table size')}</option><option value="time">{t('100 条求解耗时', '100-scramble solve time')}</option><option value="rss">{t('峰值内存', 'Peak memory')}</option></select></label>
      <label>{t('系列', 'Family')}<select className="compare-select" value={family} onChange={e => { void setFamily(e.target.value as typeof family); }}><option value="all">{t('全部', 'All')}</option>{families.map(f => <option key={f} value={f}>{names[f]}</option>)}</select></label>
      {metric !== 'time' && <label>{t('刻度', 'Scale')}<select className="compare-select" value={scale} onChange={e => { void setScale(e.target.value as typeof scale); }}><option value="log">{t('对数', 'Logarithmic')}</option><option value="linear">{t('线性', 'Linear')}</option></select></label>}
    </div>
    <div className="compare-legend">{selectedFamilies.map(f => <span key={f}><i className={'is-' + f} />{names[f]}</span>)}</div>
    {measuredRows.length ? <figure className="compare-chart">
      <div className="compare-chart-scroll"><div className="compare-chart-inner" style={{ minWidth: Math.max(540, groups.length * 65 + 60) }}>
        <div className="compare-axis">{ticks.map(tick => <span key={tick} style={{ bottom: height(tick) + '%' }}>{metric === 'time' ? `${Number(tick.toFixed(2))} s` : memory(tick)}</span>)}</div>
        <div className="compare-plot" style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}>
          <div className="compare-grid" aria-hidden="true">{ticks.map(tick => <span key={tick} style={{ bottom: height(tick) + '%' }} />)}</div>
          {groups.map(g => { const opt = g.rows.find(r => r.family === 'opt'); return <div key={g.eo} className="compare-cluster">
            <div className="compare-cluster-bars">{selectedFamilies.map(f => { const row = g.rows.find(r => r.family === f); const n = row ? value(row.id, row.tableBytes) : null; return <div key={f} className="compare-lane">{row && (n === null ? <span className="compare-missing">—</span> : <div className={'compare-column is-' + f} style={{ height: height(n) + '%' }} aria-label={`${row.label}: ${format(n)}`}><span>{metric === 'time' ? n.toFixed(2) : shortMemory(n)}</span></div>)}</div>; })}</div>
            <span className="compare-x-label">{opt ? opt.label + (selectedFamilies.length > 1 ? ` / H${g.eo}` : '') : `H${g.eo}`}</span>
          </div>; })}
        </div>
      </div></div>
      <figcaption>{metric === 'table' ? t('按 EO 位数对齐 · 表容量不等于运行内存 · H11 未运行', 'Aligned by EO bits · table size is not runtime memory · H11 not run') : t('相同 100 条完整打乱 · 未测记为 —', 'Same 100 complete scrambles · — means not measured')}{log && t(' · 对数刻度，每格 10 倍', ' · logarithmic scale, 10× per interval')}</figcaption>
    </figure> : <div className="compare-empty">{t('统一的 100 条基准尚无结果', 'No results yet for the unified 100-scramble benchmark')}</div>}
    <details className="compare-details"><summary className="compare-summary">{t('详细数据', 'Detailed data')}</summary><div className="sticky-scroll"><table className="sticky-thead compare-table"><thead><tr><th>{t('求解器', 'Solver')}</th><th>EO</th><th>{t('表容量', 'Table size')}</th><th>{t('100 条耗时', '100-scramble time')}</th><th>{t('峰值内存', 'Peak memory')}</th><th>{t('实现状态', 'Implementation')}</th></tr></thead><tbody>{rows.map(row => { const result = WCA100.results.find(r => r.id === row.id); return <tr key={row.id}><th><i className={'compare-dot is-' + row.family} />{row.label}</th><td>{row.eoBits}</td><td><span>{memory(row.tableBytes)}</span><small>{row.tableBytes.toLocaleString('en-US')} B</small></td><td>{result ? seconds(result.seconds) : '—'}</td><td>{memory(result?.peakRssBytes ?? null)}</td><td>{row.family === 'rust' ? t('已实现', 'Implemented') : t('上游支持', 'Upstream supported')}{row.eoBits === 11 && t(' · 禁止运行', ' · execution disabled')}</td></tr>; })}</tbody></table></div></details>
    <details className="compare-details"><summary className="compare-summary">{t('历史测试', 'Historical tests')}</summary>
      <div className="compare-controls"><label>{t('样本', 'Sample')}<select className="compare-select" value={historyGroup} onChange={e => { void setHistoryGroup(e.target.value as GroupId); }}>{BENCHMARK_GROUPS.map(g => <option key={g.id} value={g.id}>{tr(g.label)}</option>)}</select></label><span className="compare-note">{t('不同样本不可比较，不属于 100 条统一基准。', 'Different samples are not comparable. These are not the unified 100-case results.')}</span></div>
      <div className="compare-history">{history.comparisons.map(row => <div className="compare-history-pair" key={row.id}><strong>{row.label}</strong>{[{ label: row.originalLabel, seconds: row.originalSeconds, rust: false }, { label: `Rust ${row.label}`, seconds: row.rustSeconds, rust: true }].map(bar => <div className="compare-history-row" key={bar.label}><span>{bar.label}</span><div className="compare-history-track"><div className={bar.rust ? 'is-rust' : 'is-opt'} style={{ width: bar.seconds / historyMax * 100 + '%' }} /></div><strong>{seconds(bar.seconds)}</strong></div>)}</div>)}</div>
      <p className="compare-note">{t(`每轮 ${history.cases} 个状态的求解总耗时 · 三轮中位数 · 排除加载和预热`, `Total solve time for ${history.cases} states per round · median of 3 rounds · loading and warmup excluded`)}</p>
      <details><summary className="compare-summary">{t('测试条件', 'Test conditions')}</summary><p className="compare-note">{tr(history.description)}</p></details>
    </details>
  </main>;
}
