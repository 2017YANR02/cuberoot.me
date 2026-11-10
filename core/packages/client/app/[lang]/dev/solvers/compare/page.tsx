'use client';

import { ArrowUpRight, ChevronRight, Download } from '@app-foundation/icons/lucide';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import PageBackLink from '@/components/PageBackLink';
import AppLink from '@/components/AppLink';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';
import { BENCHMARK_MANIFEST, CANDIDATES, COHORTS, CURRENT_RESULTS, NODE_COUNTER_DEFINITIONS } from './benchmark-data';
import { SERVER_RESULTS, summarizeServerResults, type ServerComparison } from './server-results';
import RECENT_RESULTS from './recent-results.json';
import './compare.css';

const memoryTiers = ['8', '16', '32'] as const;
const tableTier = (gb: number) => String(2 ** Math.ceil(Math.log2(gb)));
const cohorts = ['opt8', 'opt9', 'opt10'] as const;
const statisticFormat = new Intl.NumberFormat('en-US', {
  minimumSignificantDigits: 2,
  maximumSignificantDigits: 2,
  useGrouping: false,
});

function ServerComparisonSection({ result }: { result: ServerComparison }) {
  const t = useT();
  const summary = summarizeServerResults(result);
  const maximum = Math.max(...summary.rows.map(row => row.solvesPerSecond));
  return <section className="compare-server" aria-labelledby="compare-server-title">
    <div className="compare-section-head"><h2 id="compare-server-title">{t('线上版本', 'Production versions')}</h2><time className="compare-date" dateTime={result.measuredAt}>{result.measuredAt.slice(0, 10)}</time></div>
    <p className="compare-server-summary"><strong>{Math.abs(summary.timeReductionPercent).toFixed(1)}%</strong> {summary.timeReductionPercent >= 0 ? t('云端求解耗时减少', 'less server solve time') : t('云端求解耗时增加', 'more server solve time')}</p>
    <figure className="compare-chart">
      <figcaption>{result.environment.os} · {result.environment.vcpus} vCPU · Opt8 · WCA {result.cases} · {result.threads} {t('线程', 'threads')} <InfoTooltip content={result.environment.cpu} iconSize={14} ariaLabel={t('服务器 CPU', 'Server CPU')} /></figcaption>
      <div className="compare-column-head"><span /><span>{t('每秒求解数', 'Solves per second')}</span><span>{t('100 条耗时', 'Time for 100 solves')}</span></div>
      {summary.rows.map(row => <div className="compare-chart-row" key={row.id}>
        <div className="compare-row-name"><strong>{row.id === 'wasm' ? t('旧线上 WASM', 'Previous production WASM') : t('当前线上原生', 'Current production native')}</strong><span>{row.id === 'wasm' ? t('原生迁移前 · 2026-10-14 发布', 'Before native migration · released 2026-10-14') : t('AVX2 + 预取', 'AVX2 + prefetch')}</span></div>
        <div className="compare-metric-cell" aria-label={t('每秒求解数', 'Solves per second')}>
          <div className="compare-bar-area"><div className="compare-bar" style={{ width: `${row.solvesPerSecond / maximum * 100}%` }} /></div>
          <div className="compare-row-value"><strong>{row.solvesPerSecond.toFixed(2)} <small>{t('条/秒', 'solves/s')}</small></strong></div>
        </div>
        <div className="compare-row-value" aria-label={t('100 条耗时', 'Time for 100 solves')}><strong>{row.seconds.toFixed(2)} <small>s</small></strong></div>
      </div>)}
    </figure>
    <p className="compare-muted">{t('同机同表，单轮、不预热。启动另计，不含网络和排队。', 'Same server and table; one pass, no warmup. Startup is separate; network and queue time excluded.')}</p>
  </section>;
}

function RecentComparisonSection({ result }: { result: typeof RECENT_RESULTS.mac | typeof RECENT_RESULTS.macH8 | typeof RECENT_RESULTS.aliyun }) {
  const t = useT();
  const maximum = Math.max(...result.rows.map(row => row.cases / row.seconds));
  return <section className="compare-server compare-recent" aria-labelledby={`compare-${result.id}`}>
    <div className="compare-section-head"><h2 id={`compare-${result.id}`}>{tr(result.title)}</h2><time className="compare-date" dateTime={result.measuredAt}>{result.measuredAt.slice(0, 10)}</time></div>
    <p className="compare-server-summary">{'speedRatio32' in result
      ? <>{t('32G：egg 速度是 Opt10 的', '32G: egg runs at')} <strong>{result.speedRatio32.toFixed(2)}×</strong> {t('；64G 默认速度是 egg 32G 的', 'Opt10 speed; default egg 64G runs at')} <strong>{result.egg64Over32SpeedRatio.toFixed(2)}×</strong>{t('。', ' egg 32G speed.')}</>
      : 'speedRatio' in result
        ? <>{t('8G：egg 速度是 Opt8 的', '8G: egg runs at')} <strong>{result.speedRatio.toFixed(2)}×</strong>{t('。', ' Opt8 speed.')}</>
        : <>{t('最快实测 egg 用时仍增加', 'The fastest measured egg run still takes')} <strong>{((result.fastestMeasuredWallRatio - 1) * 100).toFixed(1)}%</strong> {t('，Timer 保留 Opt8', 'longer; Timer retains Opt8')}</>}
    </p>
    <figure className="compare-chart">
      <figcaption>{'cpu' in result && <>{result.cpu} · </>}WCA {result.cases} · {result.threads} {t('线程', 'threads')}</figcaption>
      <div className="compare-column-head"><span /><span>{t('每秒求解数', 'Solves per second')}</span><span>{t('总耗时', 'Total solve time')}</span></div>
      {result.rows.map(row => <div className="compare-chart-row" key={row.id}>
        <div className="compare-row-name"><strong>{row.name} {row.tableGB}G</strong><span>{tr(row.note)}</span></div>
        <div className="compare-metric-cell" aria-label={t('每秒求解数', 'Solves per second')}>
          <div className="compare-bar-area"><div className="compare-bar" style={{ width: `${row.cases / row.seconds / maximum * 100}%` }} /></div>
          <div className="compare-row-value"><strong>{(row.cases / row.seconds).toFixed(2)} <small>{t('条/秒', 'solves/s')}</small></strong></div>
        </div>
        <div className="compare-row-value" aria-label={t('总耗时', 'Total solve time')}><strong>{row.seconds.toFixed(2)} <small>s</small></strong></div>
      </div>)}
    </figure>
    <p className="compare-muted">{tr(result.note)}</p>
    {'pageReference' in result && <p className="compare-muted">{t('页面上 10 月 22 日的旧 Opt8 成绩是', 'The older Oct 22 Opt8 result above is')} {result.pageReference.seconds.toFixed(2)} s{t('；本次采用更近的 11 月 9 日成绩作比较。', '; this comparison uses the more recent Nov 9 result.')}</p>}
  </section>;
}

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
    const report = { ...BENCHMARK_MANIFEST, serverComparison: SERVER_RESULTS, recentComparisons: RECENT_RESULTS };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'cuberoot-optimal-benchmark.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <main className="solver-compare">
    <div className="compare-topbar"><PageBackLink fallback="/dev/solvers" prefetch={false} /></div>
    <header className="compare-hero">
      <div className="compare-heading"><h1>{t('三阶最优求解器', 'Optimal 3×3 solvers')}<span>Benchmark<span className="compare-period">.</span></span></h1>
      </div>
      <AppLink className="compare-help-link" href="/dev/solvers#native-init" prefetch={false}>{t('原生版使用说明', 'Native solver quick start')} <ArrowUpRight size={14} aria-hidden="true" /></AppLink>
    </header>

    {SERVER_RESULTS && <ServerComparisonSection result={SERVER_RESULTS} />}

    <section className="compare-results" aria-label={t('性能对比', 'Performance comparison')}>
      <div className="compare-protocol-strip"><span>Apple M5 Pro</span><span>{t('单轮 · 不预热', 'One pass · no warmup')}</span></div>
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

    <RecentComparisonSection result={RECENT_RESULTS.mac} />
    <RecentComparisonSection result={RECENT_RESULTS.macH8} />
    <RecentComparisonSection result={RECENT_RESULTS.aliyun} />

    <details className="compare-history">
      <summary><ChevronRight size={16} aria-hidden="true" />{t('此前的 Opt8 优化实验 · 阿里云 · 2026-11-09', 'Earlier Opt8 experiments · Alibaba Cloud · 2026-11-09')}</summary>
      <p className="compare-muted">{t('WCA 第 1–100 题，4 线程，每版一轮、不预热。原版', 'WCA cases 1–100, 4 threads, one pass per version, no warmup. Baseline:')} {RECENT_RESULTS.opt8Experiments.baselineSeconds.toFixed(2)} s{t('；下列候选均未上线。', '; none of these candidates was promoted.')}</p>
      <div className="compare-table-wrap"><table>
        <thead><tr><th>{t('候选', 'Candidate')}</th><th>{t('100 题耗时', 'Time for 100 cases')}</th><th>{t('耗时变化', 'Time change')}</th></tr></thead>
        <tbody>{RECENT_RESULTS.opt8Experiments.rows.map(row => <tr key={row.id}><td>{tr(row.name)}</td><td className="compare-number">{row.seconds.toFixed(2)} s</td><td className="compare-number">{row.seconds >= RECENT_RESULTS.opt8Experiments.baselineSeconds ? '+' : ''}{((row.seconds / RECENT_RESULTS.opt8Experiments.baselineSeconds - 1) * 100).toFixed(2)}%</td></tr>)}</tbody>
      </table></div>
      <p className="compare-muted">{t('动态分配在另一组第 101–200 题的独立确认中：原版', 'Independent confirmation of dynamic scheduling on cases 101–200: baseline')} {RECENT_RESULTS.opt8Experiments.holdout.baselineSeconds.toFixed(2)} s{t('，候选', ', candidate')} {RECENT_RESULTS.opt8Experiments.holdout.candidateSeconds.toFixed(2)} s{t('，未通过性能验收。此前共 800 个解全部独立验证正确。', '; performance acceptance failed. All 800 earlier solutions independently verified.')}</p>
    </details>

    <footer className="compare-footer"><button className="compare-download" type="button" onClick={downloadProtocol}><Download size={15} />{t('下载测试报告', 'Download test report')}</button><a href="https://github.com/cs0x7f/cube_solver_test" target="_blank" rel="noreferrer">{t('参考基准', 'Reference benchmark')} <ArrowUpRight size={13} /></a></footer>
  </main>;
}
