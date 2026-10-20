'use client';

import { ArrowUpRight, Download } from 'lucide-react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import BackHome from '@/components/BackHome';
import HeaderToggles from '@/components/HeaderToggles';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';
import { BENCHMARK_MANIFEST, CANDIDATES, COHORTS, CURRENT_RESULTS, NODE_COUNTER_DEFINITIONS } from './benchmark-data';
import './compare.css';

const memoryTiers = ['8', '16', '32'] as const;
const tableTier = (gb: number) => String(2 ** Math.ceil(Math.log2(gb)));
const cohorts = ['opt8', 'opt9', 'opt10'] as const;
const statisticFormat = new Intl.NumberFormat('en-US', {
  minimumSignificantDigits: 2,
  maximumSignificantDigits: 2,
  useGrouping: false,
});

export default function SolverComparisonPage() {
  const t = useT();
  const [memory, setMemory] = useQueryState('memory', parseAsStringEnum([...memoryTiers]).withDefault('16'));
  const rows = CANDIDATES.filter(row => !row.archived && tableTier(row.tableGB) === memory);
  const results = CURRENT_RESULTS.filter(result => rows.some(row => row.id === result.id));
  const nodeScale = tr({ zh: 1e8, en: 1e9 });
  const measuredValue = (id: string) => {
    const result = results.find(row => row.id === id);
    if (!result) return null;
    return result.seconds > 0 ? result.cases / result.seconds : null;
  };
  const groups = cohorts.map(id => ({ cohort: COHORTS[id], rows: rows.filter(row => row.cohort === id && measuredValue(row.id) !== null) })).filter(group => group.rows.length > 0);
  const unavailable = rows.filter(row => measuredValue(row.id) === null);
  const unavailableInfo = unavailable.map(row => `${row.name} ${row.runtime === 'wasm' ? 'WASM' : t('原生', 'Native')} ${tableTier(row.tableGB)}G：${results.some(result => result.id === row.id) ? t('未记录此指标', 'Metric unavailable') : tr(row.status ?? row.note)}`).join('\n\n');

  function downloadProtocol() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(BENCHMARK_MANIFEST, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'cuberoot-optimal-benchmark.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <main className="solver-compare">
    <div className="compare-topbar"><BackHome prefetch={false} /><HeaderToggles /></div>
    <header className="compare-hero">
      <div className="compare-heading"><h1>{t('三阶最优求解器', 'Optimal 3×3 solvers')}<span>Benchmark<span className="compare-period">.</span></span></h1>
      </div>
      <div className="compare-protocol-strip"><span>Apple M5 Pro</span><span>{t('单轮 · 不预热', 'One pass · no warmup')}</span></div>
    </header>

    <section className="compare-results" aria-label={t('性能对比', 'Performance comparison')}>
      <div className="compare-section-head">
        <div className="compare-controls">
          <label><span>{t('内存', 'Memory')}</span><select className="compare-filter-select" value={memory} onChange={e => { void setMemory(e.target.value as typeof memory); }}>{memoryTiers.map(value => <option value={value} key={value}>{value}G</option>)}</select></label>
        </div>
        {unavailable.length > 0 && <InfoTooltip content={unavailableInfo} iconSize={18} ariaLabel={t('未测求解器', 'Unmeasured solvers')} />}
      </div>
      {groups.length === 0 && <p>{t('待测试', 'Pending benchmark')}</p>}
      {groups.map(({ cohort, rows: groupRows }) => {
        const maximum = Math.max(1, ...groupRows.map(row => measuredValue(row.id) ?? 0));
        const nodeMaximum = Math.max(1, ...groupRows.map(row => (results.find(result => result.id === row.id)?.nodeCounter.value ?? 0) / nodeScale));
        return <figure className="compare-chart" key={cohort.id}>
          <figcaption>WCA {cohort.cases} · {cohort.threads} {t('线程', 'threads')}</figcaption>
          <div className="compare-column-head"><span /><span>{t('每秒求解数', 'Solves per second')}</span><span>{t('节点数', 'Node count')}</span></div>
        {groupRows.map(row => {
          const value = measuredValue(row.id);
          const measured = value !== null;
          const counter = results.find(result => result.id === row.id)?.nodeCounter;
          return <div className={`compare-chart-row${measured ? ' has-baseline' : ''}`} key={row.id}>
            <div className="compare-row-name"><strong><a href={row.source} target="_blank" rel="noreferrer" aria-label={`${row.name} GitHub`}>{row.name} {row.runtime === 'wasm' ? 'WASM' : t('原生', 'Native')} {tableTier(row.tableGB)}G</a></strong></div>
            <div className="compare-metric-cell" aria-label={t('每秒求解数', 'Solves per second')}>
              <div className="compare-bar-area">{value !== null && <div className="compare-bar" style={{ width: `${value / maximum * 100}%` }} />}</div>
              <div className="compare-row-value"><strong>{value !== null ? statisticFormat.format(value) : '—'} <small>{t('条/秒', 'solves/s')}</small></strong></div>
            </div>
            <div className="compare-metric-cell" aria-label={t('节点数', 'Node count')} title={counter ? tr(NODE_COUNTER_DEFINITIONS[counter.definition]) : undefined}>
              <div className="compare-bar-area">{counter && <div className="compare-bar" style={{ width: `${counter.value / nodeScale / nodeMaximum * 100}%` }} />}</div>
              <div className="compare-row-value"><strong>{counter ? statisticFormat.format(counter.value / nodeScale) : '—'} <small>{t('亿', 'B')}</small></strong></div>
            </div>
          </div>;
        })}
      </figure>;
      })}
    </section>

    <footer className="compare-footer"><button className="compare-download" type="button" onClick={downloadProtocol}><Download size={15} />{t('下载测试报告', 'Download test report')}</button><a href="https://github.com/cs0x7f/cube_solver_test" target="_blank" rel="noreferrer">{t('参考基准', 'Reference benchmark')} <ArrowUpRight size={13} /></a></footer>
  </main>;
}
