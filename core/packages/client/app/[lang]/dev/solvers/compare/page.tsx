'use client';

import { ArrowDown, ArrowUpRight, Download } from 'lucide-react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import BackHome from '@/components/BackHome';
import HeaderToggles from '@/components/HeaderToggles';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';
import { BENCHMARK_MANIFEST, CANDIDATES, COHORTS, CURRENT_RESULTS } from './benchmark-data';
import './compare.css';

const metrics = ['time', 'rss', 'nodes'] as const;
const runtimes = ['native', 'wasm'] as const;
const cohorts = ['opt8', 'opt9'] as const;

export default function SolverComparisonPage() {
  const t = useT();
  const [metric, setMetric] = useQueryState('metric', parseAsStringEnum([...metrics]).withDefault('time'));
  const [cohortId, setCohort] = useQueryState('cohort', parseAsStringEnum([...cohorts]).withDefault('opt9'));
  const [requestedRuntime, setRuntime] = useQueryState('runtime', parseAsStringEnum([...runtimes]).withDefault('wasm'));
  const cohort = COHORTS[cohortId];
  const availableRuntimes = runtimes.filter(value => CANDIDATES.some(row => row.cohort === cohortId && row.runtime === value));
  const runtime = availableRuntimes.includes(requestedRuntime) ? requestedRuntime : availableRuntimes[0];
  const rows = CANDIDATES.filter(row => row.cohort === cohortId && row.runtime === runtime);
  const results = CURRENT_RESULTS.filter(result => rows.some(row => row.id === result.id));
  const measuredValue = (id: string) => {
    const result = results.find(row => row.id === id);
    if (!result) return null;
    return metric === 'time' ? result.seconds : metric === 'rss' ? result.peakRssBytes / 1e9 : result.nodes === null ? null : result.nodes / 1e9;
  };
  const maximum = Math.max(1, ...rows.map(row => measuredValue(row.id) ?? 0));
  const ceiling = Math.ceil(maximum / (metric === 'time' ? 10 : 2)) * (metric === 'time' ? 10 : 2);
  const localResult = results.find(row => row.id === (cohortId === 'opt8' ? 'rust-opt8-wasm' : runtime === 'native' ? 'rust-opt-9' : 'rust-opt9-wasm-quarter'))!;
  const localCandidate = rows.find(row => row.id === localResult.id)!;
  const unit = metric === 'time' ? 's' : metric === 'rss' ? 'GB' : t('十亿', 'B');
  const label = metric === 'time' ? t(`${cohort.cases} 条总求解耗时`, `Total solve time · ${cohort.cases} states`) : metric === 'rss' ? t('求解器峰值内存', 'Peak solver memory') : t('搜索节点数', 'Search nodes');

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
      <div className="compare-eyebrow">CUBEROOT / OPEN BENCHMARK <span>{t('本机实测', 'LOCAL RESULTS')}</span></div>
      <div className="compare-heading"><h1>{t('三阶最优求解器', 'Optimal 3×3 solvers')}<span>Benchmark<span className="compare-period">.</span></span></h1>
        <a className="compare-github" href="https://github.com/2017YANR02/cuberoot.me" target="_blank" rel="noreferrer">GitHub · {t('项目源码', 'Project source')}<ArrowUpRight size={15} /></a>
      </div>
      <p className="compare-subtitle">{t('同一台电脑。同一组状态。完整 HTM 最短解。', 'One machine. Identical states. Proven HTM-optimal solutions.')}</p>
      <div className="compare-protocol-strip"><span>{cohort.name}</span><span>{cohort.tableBudgetGB} GB <small>{t('表预算', 'table budget')}</small></span><span>{cohort.threads} <small>{t('线程', 'threads')}</small></span><span>WCA {cohort.cases}</span><span>{t('单轮 · 不预热', 'One pass · no warmup')}</span><span>Apple M5 Pro</span></div>
    </header>

    <section className="compare-results" aria-labelledby="result-title">
      <div className="compare-section-head"><div><div className="compare-eyebrow">01 / {t('性能', 'PERFORMANCE')}</div><h2 id="result-title">{t('同条件对比', 'Matched comparison')}</h2></div>
        <div className="compare-controls">
          <label><span>{t('档位', 'Tier')}</span><select className="compare-filter-select" value={cohortId} onChange={e => { void setCohort(e.target.value as typeof cohortId); }}>{cohorts.map(id => <option value={id} key={id}>{COHORTS[id].name} · {COHORTS[id].tableBudgetGB} GB</option>)}</select></label>
          <label><span>{t('运行时', 'Runtime')}</span><select className="compare-filter-select" value={runtime} onChange={e => { void setRuntime(e.target.value as typeof runtime); }}>{availableRuntimes.map(value => <option value={value} key={value}>{value === 'native' ? t('原生', 'Native') : 'WASM'}</option>)}</select></label>
          <label><span>{t('指标', 'Metric')}</span><select className="compare-filter-select" value={metric} onChange={e => { void setMetric(e.target.value as typeof metric); }}><option value="time">{t('求解耗时', 'Solve time')}</option><option value="rss">{t('峰值内存', 'Peak memory')}</option><option value="nodes">{t('搜索节点', 'Search nodes')}</option></select></label>
        </div>
      </div>
      <div className="compare-chart-caption"><span>{label}</span><span><ArrowDown size={13} />{t('越低越好', 'Lower is better')}</span></div>
      <figure className="compare-chart" aria-label={label}>
        {rows.map(row => {
          const value = measuredValue(row.id);
          const measured = value !== null;
          return <div className={`compare-chart-row${measured ? ' has-baseline' : ''}`} key={row.id}>
            <div className="compare-row-name"><strong>{row.name}</strong><span>{row.implementation}</span></div>
            <div className="compare-bar-area">{value !== null ? <div className="compare-bar" style={{ width: `${value / ceiling * 100}%` }} /> : <div className="compare-pending-line" />}</div>
            <div className="compare-row-value">{value !== null ? <><strong>{value.toFixed(1)} <small>{unit}</small></strong><span>{row.status ? tr(row.status) : t(`${cohort.cases} / ${cohort.cases} 已验证`, `${cohort.cases} / ${cohort.cases} verified`)}</span></> : <><strong className="compare-unmeasured">—</strong><span>{results.some(result => result.id === row.id) ? t('未记录此指标', 'Metric unavailable') : row.status ? tr(row.status) : t('待测', 'Pending')}</span></>}</div>
          </div>;
        })}
        <div className="compare-axis" aria-hidden="true"><span>0</span><span>{ceiling / 2} {unit}</span><span>{ceiling} {unit}</span></div>
        <figcaption>{cohortId === 'opt8' ? t('本机 4 线程，原版尚无同条件结果。Opt8 与 Opt9 的数量和线程不同，不跨档比较耗时。', 'Local 4-thread run; no matched original result yet. Opt8 and Opt9 use different case and thread counts; do not compare their totals.') : runtime === 'wasm' ? t('同一 Node / V8 TurboFan，16 线程。原版保留前 431 条，续跑 569 条；Rust 为连续一轮。仅代表本机。', 'Same Node / V8 TurboFan, 16 threads. Original retains 431 cases and resumes 569; Rust ran continuously. Local results only.') : t('仅显示本轮完整实测。其余项目尚无同条件结果。', 'Only complete measurements from this run. Other candidates lack matched results.')}</figcaption>
      </figure>
    </section>

    <section className="compare-baseline" aria-labelledby="baseline-title">
      <div className="compare-baseline-title"><span className="compare-eyebrow">LOCAL RESULT</span><h2 id="baseline-title">{localCandidate.name}<span>{localCandidate.implementation}</span></h2><span className="compare-date">{localResult.date.slice(0, 10)} · {tr(localCandidate.note)}</span></div>
      <dl><div><dt>{t(`${cohort.cases} 条耗时`, `${cohort.cases}-state solve time`)}</dt><dd>{localResult.seconds.toFixed(1)}<small> s</small></dd></div><div><dt>{t('峰值内存', 'Peak solver memory')}</dt><dd>{(localResult.peakRssBytes / 1e9).toFixed(1)}<small> GB</small></dd></div><div><dt>{t('独立验解', 'Solutions verified')}</dt><dd>{localResult.verifiedSolutions}<small> / {cohort.cases}</small></dd></div></dl>
    </section>

    <section className="compare-candidates" aria-labelledby="candidates-title">
      <div className="compare-section-head"><div><div className="compare-eyebrow">02 / {t('参测项目', 'CANDIDATES')}</div><h2 id="candidates-title">{t('候选求解器', 'Candidate solvers')}</h2></div><span className="compare-muted">{t('缺表与平台限制见下表', 'Table availability and platform limits below')}</span></div>
      <div className="compare-table-wrap"><table><thead><tr><th>{t('求解器', 'Solver')}</th><th>{t('剪枝表', 'Table')}</th><th>{t('进程树峰值', 'Peak process tree')}</th><th>{t('状态', 'Status')}</th><th>{t('来源', 'Source')}</th></tr></thead><tbody>{rows.map(row => {
        const result = results.find(result => result.id === row.id);
        return <tr key={row.id}><td><strong>{row.name}</strong><small>{row.implementation}</small></td><td className="compare-number">{row.tableGB.toFixed(1)} GB</td><td className="compare-number">{result ? `${(result.processTreePeakRssBytes / 1e9).toFixed(1)} GB` : '—'}</td><td>{row.status ? tr(row.note) : result?.continuation ? t(`${result.verifiedSolutions} 条已验证 · 断点续测`, `${result.verifiedSolutions} verified · resumed`) : result ? t(`${result.verifiedSolutions} 条已验证 · 单轮`, `${result.verifiedSolutions} verified · one pass`) : tr(row.note)}</td><td><a href={row.source} target="_blank" rel="noreferrer" aria-label={`${row.name} GitHub`}>GitHub <ArrowUpRight size={13} /></a></td></tr>;
      })}</tbody></table></div>
    </section>

    <details className="compare-method"><summary>{t('测试口径与可复现信息', 'Methodology & reproducibility')}</summary>
      <div className="compare-method-grid"><div><h3>{t('只比最短解', 'Optimal solutions only')}</h3><p>{t('完整三阶，HTM：转动 90° 或 180° 均算一步。逐条回放验解，并核对最优长度；普通两阶段解、QTM 和特定陪集批处理不混入。', 'Full 3×3, HTM: a 90° or 180° face turn counts as one move. Replay every solution and cross-check optimal lengths. Exclude non-optimal two-phase solutions, QTM and specialized coset batches.')}</p></div>
      <div><h3>{t('相同输入与计时', 'Identical input & timing')}</h3><p>{t(`固定统计管道 WCA 前 ${cohort.cases} 条，保持原序。${cohort.threads} 线程，单轮，无额外预热。表加载、建表与独立验解不计入求解耗时。只在同档位、同运行时内比较。`, `First ${cohort.cases} WCA scrambles from the statistics pipeline, in original order. ${cohort.threads} threads, one pass, no extra warmup. Table initialization, generation and independent verification are excluded. Compare within the same tier and runtime only.`)}</p></div>
      <div><h3>{t('内存与并行方式', 'Memory & parallelism')}</h3><p>{t(`${cohort.tableBudgetGB} GB 为十进制剪枝表预算，另报求解器与进程树峰值内存。单状态多线程与多状态吞吐分别统计。`, `${cohort.tableBudgetGB} GB is a decimal table budget; solver and process-tree peak memory are reported separately. Single-state latency and batch throughput are separate.`)}{cohortId === 'opt9' && t('原版首段缺少求解器峰值，以进程树峰值作保守上界。', ' The original first segment lacks a solver peak, so its process-tree peak supplies a conservative upper bound.')}</p></div>
      <div><h3>{t('结果范围', 'Scope of results')}</h3><p>{t('锁定程序、参数和数据摘要。WASM 使用 Node 24.21.0 / V8 TurboFan，两版均禁用 Liftoff。单轮未估计波动，节点计数仅作诊断；这些结果不证明全网最快。', 'Pin binaries, flags and corpus hashes. Both WASM builds use Node 24.21.0 / V8 TurboFan with Liftoff disabled. A single pass does not estimate noise; nodes are diagnostic. These results do not establish a global performance record.')}</p></div></div>
      <div className="compare-evidence"><span>{t('数据集 SHA-256', 'Corpus SHA-256')}</span><code>{cohort.corpusSha256}</code><button className="compare-download" type="button" onClick={downloadProtocol}><Download size={15} />{t('下载协议与实测结果', 'Download protocol & results')}</button></div>
    </details>
    <footer className="compare-footer"><span>CubeRoot · {t('三阶 HTM 最优求解', 'Optimal 3×3 HTM solving')}</span><a href="https://github.com/cs0x7f/cube_solver_test" target="_blank" rel="noreferrer">{t('参考公开横向基准', 'Public benchmark reference')} <ArrowUpRight size={13} /></a></footer>
  </main>;
}
