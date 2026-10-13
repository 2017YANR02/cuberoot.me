'use client';

import { useState } from 'react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import AppLink from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import HeaderToggles from '@/components/HeaderToggles';
import SortArrow from '@/components/SortArrow';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';
import { BENCHMARK_GROUPS, COMPARISON_ROWS, SOURCE_LINKS, SNAPSHOT_DATE, IMPLEMENTATION_DATE, BENCHMARK_MACHINE, type Family, type GroupId } from './comparison-data';
import '@/components/sticky-table.css';
import './compare.css';

const FAMILIES: Family[] = ['opt', 'nissy', 'rust'];
const FAMILY_NAMES = {
  opt: { zh: 'cube48opt · WASM', en: 'cube48opt · WASM' },
  nissy: { zh: 'Nissy · 原 C', en: 'Nissy · original C' },
  rust: { zh: 'CubeRoot · Rust H', en: 'CubeRoot · Rust H' },
};
const GROUP_IDS = BENCHMARK_GROUPS.map((group) => group.id);
const H10 = BENCHMARK_GROUPS.find((group) => group.id === 'h10-60')!.comparisons[0];
const numbers = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });
const exact = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const bytes = (value: number | null) => value === null ? '—' : `${numbers.format(value / (value >= 1e9 ? 1e9 : 1e6))} ${value >= 1e9 ? 'GB' : 'MB'}`;
const seconds = (value: number) => `${value.toFixed(6)} s`;

export default function SolverComparisonPage() {
  const t = useT();
  const [family, setFamily] = useQueryState('family', parseAsStringEnum(['all', ...FAMILIES]).withDefault('all'));
  const [basis, setBasis] = useQueryState('basis', parseAsStringEnum(['memory', 'eo']).withDefault('memory'));
  const [direction, setDirection] = useQueryState('order', parseAsStringEnum<'asc' | 'desc'>(['asc', 'desc']).withDefault('asc'));
  const [metric, setMetric] = useQueryState('memory', parseAsStringEnum(['table', 'rss']).withDefault('table'));
  const [scale, setScale] = useQueryState('scale', parseAsStringEnum(['log', 'linear']).withDefault('log'));
  const [groupId, setGroupId] = useQueryState('benchmark', parseAsStringEnum<GroupId>(GROUP_IDS).withDefault('h10-60'));
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const rows = COMPARISON_ROWS.filter((row) => family === 'all' || row.family === family).sort((a, b) => {
    const difference = basis === 'eo' ? a.eoBits - b.eoBits || a.tableBytes - b.tableBytes : a.tableBytes - b.tableBytes || a.eoBits - b.eoBits;
    return (direction === 'asc' ? 1 : -1) * difference || FAMILIES.indexOf(a.family) - FAMILIES.indexOf(b.family);
  });
  const group = BENCHMARK_GROUPS.find((item) => item.id === groupId) ?? BENCHMARK_GROUPS[0];
  const plotted = rows.flatMap((row) => {
    const value = metric === 'table' ? row.tableBytes : row.nativeRssBytes;
    return value === null ? [] : [{ row, value }];
  });
  const selected = plotted.find(({ row }) => row.id === inspectedId) ?? plotted[0];
  const maxMemory = Math.max(1e6, ...plotted.map(({ value }) => value));
  const logMax = Math.max(7, Math.ceil(Math.log10(maxMemory)));
  const linearMax = Math.ceil(maxMemory / 1e9) * 1e9;
  const y = (value: number) => 275 - (scale === 'log' ? (Math.log10(value) - 6) / (logMax - 6) : value / linearMax) * 245;
  const ticks = scale === 'log' ? Array.from({ length: logMax - 5 }, (_, index) => 10 ** (index + 6)) : [0, .25, .5, .75, 1].map((part) => part * linearMax);
  const maxSeconds = Math.max(...group.comparisons.flatMap((item) => [item.rustSeconds, item.originalSeconds]));
  const sortBy = (next: 'memory' | 'eo') => {
    if (basis === next) void setDirection(direction === 'asc' ? 'desc' : 'asc');
    else { void setBasis(next); void setDirection('asc'); }
  };

  return <main className="solver-compare">
    <header className="solver-compare__header">
      <div className="solver-compare__topbar"><BackHome prefetch={false} /><HeaderToggles /></div>
      <AppLink href="/dev/solvers" prefetch={false} className="solver-compare__parent">{t('求解器研究', 'Solver research')}</AppLink>
      <h1>{t('三阶最优求解器对比', 'Comparing optimal 3×3 solvers')}</h1>
      <p className="solver-compare__intro">{t('对比 cube48opt、原版 Nissy 与 CubeRoot Rust 的表数据、内存和实测耗时。性能结果按相同输入与测量条件分组。', 'Compare cube48opt, original Nissy and CubeRoot Rust by table data, memory and measured search time. Performance results are grouped by matching inputs and measurement conditions.')}</p>
      <div className="solver-compare__takeaway" data-site-surface="panel">
        <div><span>{t('H10 · 同表、单线程、60 例', 'H10 · same table, one thread, 60 cases')}</span><strong>{H10.ratio.toFixed(3)}×</strong><span>{t('本组样本的速度比', 'speed ratio on this sample')}</span></div>
        <p>{t(`Rust ${H10.rustSeconds.toFixed(3)} 秒，原 C ${H10.originalSeconds.toFixed(3)} 秒；取三轮整批总耗时中位数，排除加载与预热。两边原生峰值内存均约 30.34 GB。`, `Rust ${H10.rustSeconds.toFixed(3)} s, original C ${H10.originalSeconds.toFixed(3)} s: median whole-batch time across three measured rounds, excluding loading and warmup. Both peaked at about 30.34 GB of native memory.`)}</p>
        <a href="#measured">{t('查看测量条件与结果', 'Explore the measured results')} <span aria-hidden="true">↓</span></a>
      </div>
    </header>

    <section className="solver-compare__section" aria-labelledby="tiers-title">
      <p className="solver-compare__eyebrow">{t('档位与支持状态', 'Tiers and support')}</p><h2 id="tiers-title">{t('按真实规模对齐', 'Compare the actual scale')}</h2>
      <p className="solver-compare__explain">{t('Opt 的编号不是 H 的编号。Opt1 保留 0 位棱块朝向（EO），Opt2 保留 2 位，之后依次增加。相同 EO 位数也不代表坐标、表格式或剪枝能力相同。', 'Opt numbers are not H numbers. Opt1 retains 0 edge-orientation (EO) bits, Opt2 retains 2, and later tiers add one each. Equal EO bits do not imply identical coordinates, table formats or pruning strength.')}</p>
      <div className="solver-compare__controls">
        <label>{t('系列', 'Family')}<select className="solver-compare__select" value={family} onChange={(event) => { void setFamily(event.target.value as typeof family); }}><option value="all">{t('全部系列', 'All families')}</option>{FAMILIES.map((value) => <option key={value} value={value}>{tr(FAMILY_NAMES[value])}</option>)}</select></label>
        <label>{t('比较依据', 'Compare by')}<select className="solver-compare__select" value={basis} onChange={(event) => { void setBasis(event.target.value as typeof basis); }}><option value="memory">{t('表数据大小', 'Table data size')}</option><option value="eo">{t('EO 位数', 'EO bits')}</option></select></label>
        <span className="solver-compare__hint">{t('— 表示没有对应实测，不推算速度或内存。', '— means no matching measurement; no speed or memory is inferred.')}</span>
      </div>
      <div className="sticky-scroll solver-compare__table-scroll">
        <table className="sticky-thead solver-compare__table">
          <caption>{t('三系列档位对照；GB / MB 为十进制，表数据不等于运行内存。', 'Tier comparison. GB / MB are decimal; table data is not runtime memory.')}</caption>
          <thead><tr><th scope="col">{t('求解器', 'Solver')}</th><th scope="col" aria-sort={basis === 'eo' ? direction === 'asc' ? 'ascending' : 'descending' : undefined}><button className="solver-compare__sort" type="button" onClick={() => sortBy('eo')}>EO <SortArrow active={basis === 'eo'} dir={direction} /></button></th><th scope="col" aria-sort={basis === 'memory' ? direction === 'asc' ? 'ascending' : 'descending' : undefined}><button className="solver-compare__sort" type="button" onClick={() => sortBy('memory')}>{t('表数据', 'Table data')} <SortArrow active={basis === 'memory'} dir={direction} /></button></th><th scope="col">{t('原生峰值 RSS', 'Native peak RSS')}</th><th scope="col">{t('证据状态', 'Evidence')}</th><th scope="col">{t('说明', 'Details')}</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}>
            <th scope="row"><span className={`solver-compare__family-dot is-${row.family}`} aria-hidden="true" /><strong>{row.label}</strong><small>{tr(FAMILY_NAMES[row.family])}</small></th>
            <td className="solver-compare__number">{row.eoBits}</td><td className="solver-compare__number">{bytes(row.tableBytes)}</td><td className="solver-compare__number">{bytes(row.nativeRssBytes)}</td>
            <td><span className={`solver-compare__status is-${row.statusKind}`}>{tr(row.status)}</span></td>
            <td><details><summary>{t('数据与边界', 'Data and scope')}</summary><p>{tr(row.note)}</p><dl><div><dt>{t('表数据总量', 'Total table data')}</dt><dd>{exact.format(row.tableBytes)} B</dd></div><div><dt>{t('主表', 'Main table')}</dt><dd>{exact.format(row.mainTableBytes)} B</dd></div><div><dt>{t('辅助数据与头部', 'Auxiliary data and headers')}</dt><dd>{exact.format(row.auxiliaryBytes)} B</dd></div><div><dt>{t('原生峰值 RSS', 'Native peak RSS')}</dt><dd>{row.nativeRssBytes === null ? '—' : `${exact.format(row.nativeRssBytes)} B`}</dd></div></dl></details></td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="solver-compare__footnote">{t('Opt 表数据包含主剪枝表和对应小表快照；H 系列包含完整 .dat 的主表、辅助段与表头。没有本地表的档位按格式给出容量，不代表已经生成或加载。原 WASM 未测原生 RSS。', 'Opt table data includes its main pruning table and small-table snapshot. H data includes the complete .dat with auxiliary sections and headers. Sizes for tiers without a local table describe the format, not generated or loaded files. Native RSS was not measured for original WASM.')}</p>
    </section>

    <section className="solver-compare__section" aria-labelledby="memory-title">
      <p className="solver-compare__eyebrow">{t('内存视图', 'Memory view')}</p><h2 id="memory-title">{t('EO 位数与空间规模', 'EO bits and memory scale')}</h2>
      <div className="solver-compare__controls">
        <label>{t('显示指标', 'Metric')}<select className="solver-compare__select" value={metric} onChange={(event) => { void setMetric(event.target.value as typeof metric); }}><option value="table">{t('表数据大小', 'Table data size')}</option><option value="rss">{t('实测原生峰值 RSS', 'Measured native peak RSS')}</option></select></label>
        <label>{t('纵轴', 'Vertical scale')}<select className="solver-compare__select" value={scale} onChange={(event) => { void setScale(event.target.value as typeof scale); }}><option value="log">{t('对数', 'Logarithmic')}</option><option value="linear">{t('线性', 'Linear')}</option></select></label>
        <div className="solver-compare__legend">{FAMILIES.filter((item) => family === 'all' || family === item).map((item) => <span key={item}><i className={`solver-compare__family-dot is-${item}`} />{tr(FAMILY_NAMES[item])}</span>)}</div>
      </div>
      {plotted.length ? <div className="solver-compare__plot" data-site-surface="panel">
        <svg viewBox="0 0 760 330" role="group" aria-label={t('横轴为 EO 位数，纵轴为内存；选择点查看数值。', 'EO bits on the horizontal axis and memory on the vertical axis; select a point to inspect it.')}>
          {ticks.map((tick) => <g key={tick} className="solver-compare__grid"><line x1="78" x2="730" y1={y(tick)} y2={y(tick)} /><text x="66" y={y(tick) + 4} textAnchor="end">{bytes(tick)}</text></g>)}
          {Array.from({ length: 12 }, (_, bit) => <text key={bit} className="solver-compare__axis-label" x={100 + bit * 55} y="300" textAnchor="middle">{bit}</text>)}
          <text className="solver-compare__axis-label" x="408" y="323" textAnchor="middle">{t('保留的 EO 位数', 'Retained EO bits')}</text>
          {plotted.map(({ row, value }) => {
            const x = 100 + row.eoBits * 55 + (FAMILIES.indexOf(row.family) - 1) * 9;
            return <g key={row.id} className={`solver-compare__point is-${row.family}${selected?.row.id === row.id ? ' is-selected' : ''}`} role="button" tabIndex={0} aria-label={`${row.label}: ${bytes(value)}, EO ${row.eoBits}`} onPointerEnter={() => setInspectedId(row.id)} onFocus={() => setInspectedId(row.id)} onClick={() => setInspectedId(row.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setInspectedId(row.id); } }}>
              <title>{`${row.label}: ${exact.format(value)} B`}</title><circle cx={x} cy={y(value)} r="6" /><circle className="solver-compare__point-hit" cx={x} cy={y(value)} r="12" />
            </g>;
          })}
        </svg>
        <div className="solver-compare__readout" aria-live="polite">{selected && <><strong>{selected.row.label}</strong><span>EO {selected.row.eoBits}</span><strong>{bytes(selected.value)}</strong><span>{exact.format(selected.value)} B</span></>}</div>
      </div> : <p className="solver-compare__empty">{t('当前系列没有这一指标的实测数据。可切换到表数据或其他系列。', 'No measurements for this metric in the selected family. Choose table data or another family.')}</p>}
      <p className="solver-compare__footnote">{t('沿用上方系列筛选。为区分重叠点，同一 EO 的点轻微横向错开。缺失数据不画成零；表数据大小不能用来推算搜索速度。', 'Uses the family filter above. Points at the same EO are slightly offset for visibility. Missing data is not plotted as zero; table size does not predict search speed.')}</p>
    </section>

    <section id="measured" className="solver-compare__section" aria-labelledby="measured-title">
      <p className="solver-compare__eyebrow">{t('同条件实测', 'Matched benchmarks')}</p><h2 id="measured-title">{t('一次只比较一组语料', 'One benchmark group at a time')}</h2>
      <div className="solver-compare__controls"><label>{t('测试组', 'Benchmark group')}<select className="solver-compare__select" value={group.id} onChange={(event) => { void setGroupId(event.target.value as GroupId); }}>{BENCHMARK_GROUPS.map((item) => <option key={item.id} value={item.id}>{tr(item.label)}</option>)}</select></label></div>
      <p className="solver-compare__explain">{tr(group.description)}</p>
      <p className="solver-compare__measure-label">{t(`每轮 ${group.cases} 例 · ${group.rounds} 轮正式测量 · 整批总时间中位数 · 越短越快`, `${group.cases} cases per round · ${group.rounds} measured rounds · median whole-batch time · shorter is faster`)}</p>
      <div className="solver-compare__bars">{group.comparisons.map((item) => <div key={item.id} className="solver-compare__bar-group"><h3>{item.label}</h3>{[{ key: 'original', label: item.originalLabel, value: item.originalSeconds }, { key: 'rust', label: 'Rust', value: item.rustSeconds }].map((bar) => <div key={bar.key} className="solver-compare__bar-row"><span>{bar.label}</span><div className="solver-compare__bar-track"><div className={`solver-compare__bar is-${bar.key}`} style={{ width: `${bar.value / maxSeconds * 100}%` }} /></div><strong>{seconds(bar.value)}</strong></div>)}</div>)}</div>
      <div className="sticky-scroll solver-compare__table-scroll"><table className="sticky-thead solver-compare__table solver-compare__measurements"><caption>{t('同组配对实测；原版 / Rust 大于 1 表示本次 Rust 用时更少。', 'Paired measurements within this group. Original / Rust above 1 means Rust took less time here.')}</caption><thead><tr><th scope="col">{t('档位', 'Tier')}</th><th scope="col">{t('原版 / Rust', 'Original / Rust')}</th><th scope="col">{t('原版峰值 RSS', 'Original peak RSS')}</th><th scope="col">{t('Rust 峰值 RSS', 'Rust peak RSS')}</th></tr></thead><tbody>{group.comparisons.map((item) => <tr key={item.id}><th scope="row">{item.label}</th><td className="solver-compare__number">{item.ratio.toFixed(3)}×</td><td className="solver-compare__number">{bytes(item.originalRssBytes)}</td><td className="solver-compare__number">{bytes(item.rustRssBytes)}</td></tr>)}</tbody></table></div>
      <p className="solver-compare__footnote">{t('Opt1–8 的 18 例有界样本与 Opt9/H10 的 60 例历史语料分组展示，不合并排名。较短测量受固定开销和计时噪声影响。Opt 的 Rust RSS 来自另测的两条固定历史输入，不是双引擎同时驻留量。', 'The 18 bounded Opt1–8 cases and 60 historical Opt9/H10 cases stay in separate groups, without a combined ranking. Short timings are sensitive to fixed overhead and noise. Rust Opt RSS comes from two separately measured historical cases, not two engines resident together.')}</p>
    </section>

    <section className="solver-compare__section solver-compare__method" aria-labelledby="method-title"><h2 id="method-title">{t('如何阅读这些结果', 'How to read these results')}</h2><div className="solver-compare__method-grid">
      <div><h3>{t('实现与实测分开', 'Implementation versus measurement')}</h3><p>{t('H10 数字来自保留的固定实测版本。H0–H9 与 H11 的 Rust 泛化代码不继承这份计时结果；H11 没有在本机生成、映射或求解。', 'H10 numbers belong to a preserved, measured binary. The generalized Rust H0–H9 and H11 code does not inherit those timings. H11 has not been generated, mapped or solved on this Mac.')}</p></div>
      <div><h3>{t('内存范围分开', 'Keep memory scopes separate')}</h3><p>{t('RSS 是原生进程的内核峰值，包含加载与求解；表容量、监控进程树采样是另外两种量。约 32 GB 是进程档，不保证 32 GB 整机有足够余量。', 'RSS is the native process high-water mark, including loading and solving. Table capacity and sampled process-tree memory are separate quantities. A roughly 32 GB process tier does not guarantee enough headroom on a 32 GB computer.')}</p></div>
      <div><h3>{t('结果边界', 'Scope of the results')}</h3><p>{t(`本地 ${BENCHMARK_MACHINE}、固定语料、单求解线程。已测解经过独立复原和长度检查；有限测试不是全部状态空间的证明，速度比也不能归因于语言本身。页面只展示静态记录，不在浏览器加载大表或求解。`, `Local ${BENCHMARK_MACHINE}, fixed inputs, one solving thread. Measured solutions were independently replayed and length-checked. Finite tests are not a proof over every state, and speed ratios cannot be attributed to the language alone. This page displays static records and runs no large-table solver.`)}</p></div>
    </div><div className="solver-compare__sources">{SOURCE_LINKS.map((source) => <a key={source.href} href={source.href} target="_blank" rel="noreferrer">{source.label} ↗</a>)}<AppLink href="/dev/solvers" prefetch={false}>{t('全部求解器', 'All solvers')}</AppLink></div><p className="solver-compare__footnote">{t('实测快照', 'Measurement snapshot')} · <time dateTime={SNAPSHOT_DATE}>{SNAPSHOT_DATE}</time><br />{t('代码支持状态更新', 'Implementation status updated')} · <time dateTime={IMPLEMENTATION_DATE}>{IMPLEMENTATION_DATE}</time></p></section>
  </main>;
}
