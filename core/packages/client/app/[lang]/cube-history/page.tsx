'use client';

import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryState, useQueryStates, parseAsString, parseAsStringEnum, parseAsArrayOf, parseAsBoolean } from 'nuqs';
import { ArrowUpRight, BookOpen, Check, Columns3, Download, History, Link2, Plus, X } from 'lucide-react';
import HomeLink from '@/components/HomeLink';
import AppLink from '@/components/AppLink';
import HeaderToggles from '@/components/HeaderToggles';
import { ClearButton } from '@/components/ClearButton';
import SearchInput from '@/components/SearchInput';
import { CompactSelect } from '@/components/CompactSelect';
import PillToggle from '@/components/PillToggle/PillToggle';
import { useCopy } from '@/hooks/useCopy';
import { tr, useLang } from '@/i18n/tr';
import { CUBES, SOURCES, SOURCE_BY_ID } from './_data/catalog';
import { BRANDS, CATEGORIES, EVIDENCE_LABELS, MECHANISMS, METHODOLOGY, PERIODS, PRICE_LABELS, RELEASE_LABELS, SNAPSHOT_DATE, SORT_LABELS, SOURCE_LABELS, STATUS_LABELS, TECHNOLOGIES } from './_data/labels';
import { MILESTONES } from './_data/milestones';
import { EMPTY_FILTERS, matchesCube, selectedCubes, sortCubes, sourceIdsForCube } from './_data/query';
import type { Cube, CubePrice, LocalizedText } from './_data/types';
import '@/components/sticky-table.css';
import './cube-history.css';

type View = 'timeline' | 'catalog' | 'compare' | 'sources';
const VIEW_OPTIONS: { id: View; label: LocalizedText; Icon: typeof History }[] = [
  { id: 'timeline', label: { zh: '发展时间线', en: 'Timeline' }, Icon: History },
  { id: 'catalog', label: { zh: '型号图鉴', en: 'Model catalog' }, Icon: BookOpen },
  { id: 'compare', label: { zh: '参数对比', en: 'Compare' }, Icon: Columns3 },
  { id: 'sources', label: { zh: '来源与口径', en: 'Sources & method' }, Icon: Link2 },
];
const brandKeys = [...new Set(CUBES.map(cube => cube.brand))].sort((a, b) => a.localeCompare(b, 'en'));
const UNKNOWN = { zh: '待核实', en: 'Unverified' };
const REGIONS: Record<string, LocalizedText> = {"US / international":{"zh":"美国 / 国际市场","en":"US / international"},"US":{"zh":"美国","en":"US"},"Global":{"zh":"国际市场","en":"Global"},"China":{"zh":"中国","en":"China"},"CN export":{"zh":"中国出口报价","en":"China export"},"CN":{"zh":"中国","en":"China"}};
const brandName = (brand: string) => tr(BRANDS[brand] ?? { zh: brand, en: brand });
const dateText = (cube: Cube) => cube.release.date ?? tr(UNKNOWN);
const SPEC_QUALIFIERS: Record<string, string> = {"official manual":"官方手册","official":"官方","retailer variation":"商家资料存在差异","nonmagnetic":"无磁","non-magnetic":"无磁","standard":"标准版","Standard":"标准版","Magnetic":"磁力版","spring":"弹簧版","matte":"磨砂版","listing":"商品页","original dealer":"早期经销商","original":"初版","dual-adjustment":"双调版","unstickered listing":"无贴纸版本商品页","review sample":"测评样品","Flagship":"旗舰版","Pioneer":"先锋版","Ultimate":"至尊版","UK listing":"英国商家","UK retailer":"英国商家","Enhanced":"增强版","non-magnetic tiled":"无磁色片版","20-magnet MagLev UV":"20 磁轴磁悬浮 UV 版","8-magnet MagLev":"8 磁轴磁悬浮版","standard AI":"标准 AI 版"};
function specText(value: string | null): string {
  if (value === null) return tr(UNKNOWN);
  const zh = value.replace(/\b(?:unstickered listing|20-magnet MagLev UV|retailer variation|non-magnetic tiled|official manual|original dealer|dual-adjustment|8-magnet MagLev|review sample|non-magnetic|nonmagnetic|UK retailer|standard AI|UK listing|official|standard|Standard|Magnetic|original|Flagship|Ultimate|Enhanced|listing|Pioneer|spring|matte)\b/g, word => SPEC_QUALIFIERS[word] ?? word);
  return tr({ zh, en: value });
}


function ReferenceLinks({ ids }: { ids: readonly string[] }) {
  return <span className="ch-refs">{[...new Set(ids)].map(id => {
    const source = SOURCE_BY_ID.get(id);
    if (!source) return null;
    return <a key={id} href={source.url} target="_blank" rel="noopener noreferrer" title={source.title}
      aria-label={tr({ zh: `来源 ${source.number}：${source.title}`, en: `Source ${source.number}: ${source.title}` })}>[{source.number}]</a>;
  })}</span>;
}

function CubeGlyph() {
  return <svg className="ch-glyph" viewBox="0 0 240 250" aria-hidden="true" focusable="false">
    <path d="M120 18 222 77 222 179 120 238 18 179 18 77Z" className="ch-glyph-outline" />
    <g className="ch-glyph-top"><path d="m120 18 102 59-102 59L18 77Z" /></g>
    <g className="ch-glyph-left"><path d="m18 77 102 59v102L18 179Z" /></g>
    <g className="ch-glyph-right"><path d="m120 136 102-59v102l-102 59Z" /></g>
    <g className="ch-glyph-lines">
      <path d="m52 57 102 59M86 37l102 59M52 97l102-59M86 116l102-59M52 97v102M86 116v102M18 111l102 59M18 145l102 59M154 116v102M188 97v102M120 170l102-59M120 204l102-59" />
    </g>
  </svg>;
}

function Hero() {
  useLang();
  const officialDates = CUBES.filter(cube => cube.release.basis === 'official').length;
  return <>
    <header className="ch-header">
      <HomeLink className="ch-wordmark">CubeRoot<span>{tr({ zh: '硬件档案', en: 'Hardware archive' })}</span></HomeLink>
      <HeaderToggles />
    </header>
    <section className="ch-hero" aria-labelledby="ch-title">
      <div className="ch-hero-copy">
        <p className="ch-eyebrow">1974 — 2026 <span> / </span>{tr({ zh: '三阶 · 中国品牌为主', en: '3×3 · A focus on Chinese brands' })}</p>
        <h1 id="ch-title">{tr({ zh: '三阶魔方发展史', en: 'A history of the 3×3 cube' })}</h1>
        <p className="ch-deck">{tr({ zh: '从最初的可转动结构，到 GAN 17。沿着型号、机械结构与真实资料，读懂半个世纪的演进。', en: 'From the first turning mechanism to GAN 17. Follow the models, engineering choices and surviving evidence across half a century.' })}</p>
        <p className="ch-snapshot">{tr({ zh: '资料截止', en: 'Research cutoff' })} <time dateTime={SNAPSHOT_DATE}>{SNAPSHOT_DATE}</time> · {tr({ zh: '持续补全的型号档案', en: 'An evolving model archive' })}</p>
      </div>
      <div className="ch-hero-art"><CubeGlyph /><span>{tr({ zh: '结构示意', en: 'Schematic' })}</span></div>
    </section>
    <dl className="ch-metrics">
      <div><dt>{tr({ zh: '型号记录', en: 'Model entries' })}</dt><dd>{CUBES.length}</dd></div>
      <div><dt>{tr({ zh: '品牌 / 系列标签', en: 'Brand / line labels' })}</dt><dd>{brandKeys.length}</dd></div>
      <div><dt>{tr({ zh: '参考来源', en: 'Sources' })}</dt><dd>{SOURCES.length}</dd></div>
      <div><dt>{tr({ zh: '有官方日期记录', en: 'With official date evidence' })}</dt><dd>{officialDates}</dd></div>
    </dl>
    <p className="ch-scope">{tr({ zh: '包括已发布和预告型号。涂层、限定色和礼包多归入版本；记录数不等于全部商品 SKU。未知的日期、价格和参数保留为空。', en: 'Includes released and announced models. Finishes, colors and bundles are usually grouped as variants; entries are not SKUs. Unknown dates, prices and specifications remain unknown.' })}</p>
  </>;
}

function PriceQuote({ price, compact = false }: { price: CubePrice; compact?: boolean }) {
  return <div className={compact ? 'ch-price ch-price--compact' : 'ch-price'}>
    <span><strong>{price.currency} {price.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
      <span className="ch-badge">{tr(PRICE_LABELS[price.kind])}</span>
      <ReferenceLinks ids={[price.sourceId]} />
    </span>
    <small>{[price.variant, tr(REGIONS[price.region] ?? { zh: price.region, en: price.region }), price.asOf].filter(Boolean).join(' · ')}</small>
    {!compact && <p>{tr(price.note)}</p>}
  </div>;
}

function AddToCompare({ cube, selected, full, onToggle }: { cube: Cube; selected: boolean; full: boolean; onToggle: (id: string) => void }) {
  return <button type="button" className={`ch-button ch-compare-add${selected ? ' is-active' : ''}`}
    aria-pressed={selected} disabled={!selected && full} onClick={() => onToggle(cube.id)}
    aria-label={tr({ zh: `${selected ? '移出对比' : '加入对比'}：${cube.name.zh}`, en: `${selected ? 'Remove from comparison' : 'Compare'}: ${cube.name.en}` })}>
    {selected ? <Check size={15} /> : <Plus size={15} />}
    {tr(selected ? { zh: '已选', en: 'Selected' } : { zh: '对比', en: 'Compare' })}
  </button>;
}

function ModelCard({ cube, selected, full, onToggle, onOpen }: {
  cube: Cube; selected: boolean; full: boolean; onToggle: (id: string) => void; onOpen: (id: string) => void;
}) {
  const leadPrice = cube.prices.find(price => price.currency === 'CNY') ?? cube.prices[0];
  return <article className="ch-model" data-site-surface="panel">
    <div className="ch-model-kicker"><span>{brandName(cube.brand)}</span><span className={`ch-status ch-status--${cube.status}`}>{tr(STATUS_LABELS[cube.status])}</span></div>
    <h3><button type="button" onClick={() => onOpen(cube.id)}>{tr(cube.name)}<ArrowUpRight size={18} /></button></h3>
    <p className="ch-model-date"><time>{dateText(cube)}</time><span className="ch-badge">{tr(RELEASE_LABELS[cube.release.basis])}</span><ReferenceLinks ids={cube.release.sourceIds} /></p>
    <p className="ch-model-summary">{tr(cube.highlights[0] ?? cube.assessment.summary)}</p>
    <dl className="ch-model-specs"><div><dt>{tr({ zh: '尺寸', en: 'Size' })}</dt><dd>{specText(cube.specs.size)}</dd></div><div><dt>{tr({ zh: '净重', en: 'Net weight' })}</dt><dd>{specText(cube.specs.weight)}</dd></div></dl>
    {leadPrice ? <PriceQuote price={leadPrice} compact /> : <p className="ch-muted">{tr({ zh: '售价待核实', en: 'Price unverified' })}</p>}
    <div className="ch-model-bottom"><button type="button" className="ch-text-button" onClick={() => onOpen(cube.id)}>{tr({ zh: '查看完整资料', en: 'View full record' })}<ArrowUpRight size={15} /></button><AddToCompare cube={cube} selected={selected} full={full} onToggle={onToggle} /></div>
  </article>;
}

function CubeDetails({ cube, selected, full, onToggle, onClose }: {
  cube: Cube; selected: boolean; full: boolean; onToggle: (id: string) => void; onClose: () => void;
}) {
  const { copied, copy } = useCopy();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const title = heading.current;
    title?.focus({ preventScroll: true });
    title?.closest('article')?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [cube.id]);
  return <article className="ch-detail" data-site-surface="panel" aria-labelledby="ch-detail-title">
    <div className="ch-detail-heading">
      <div><p className="ch-eyebrow">{brandName(cube.brand)} · {tr(CATEGORIES[cube.category])}</p><h2 id="ch-detail-title" ref={heading} tabIndex={-1}>{tr(cube.name)}</h2></div>
      <ClearButton variant="standalone" onClick={onClose} ariaLabel={tr({ zh: '关闭型号资料', en: 'Close model record' })} />
    </div>
    <div className="ch-detail-actions"><span className={`ch-status ch-status--${cube.status}`}>{tr(STATUS_LABELS[cube.status])}</span>
      <AddToCompare cube={cube} selected={selected} full={full} onToggle={onToggle} />
      <button type="button" className="ch-button" onClick={() => copy(window.location.href)}>{copied ? <Check size={15} /> : <Link2 size={15} />}{tr(copied ? { zh: '已复制', en: 'Copied' } : { zh: '复制型号链接', en: 'Copy model link' })}</button>
    </div>
    <div className="ch-detail-grid">
      <section><h3>{tr({ zh: '发布时间', en: 'Release evidence' })}</h3><p className="ch-detail-date">{dateText(cube)} <span className="ch-badge">{tr(RELEASE_LABELS[cube.release.basis])}</span><ReferenceLinks ids={cube.release.sourceIds} /></p><p>{tr(cube.release.note)}</p></section>
      <section><h3>{tr({ zh: '售价记录', en: 'Price records' })}</h3>{cube.prices.length ? cube.prices.map((price, index) => <PriceQuote key={index} price={price} />) : <p className="ch-muted">{tr({ zh: '尚未找到可核查的报价，未推算或填零。', en: 'No verified quote found; no estimate or zero placeholder is substituted.' })}</p>}</section>
      <section><h3>{tr({ zh: '结构与性能参数', en: 'Mechanism and specifications' })}</h3>
        <dl className="ch-spec-list">
          <div><dt>{tr({ zh: '尺寸', en: 'Size' })}</dt><dd>{specText(cube.specs.size)}</dd></div>
          <div><dt>{tr({ zh: '本体净重', en: 'Item weight' })}</dt><dd>{specText(cube.specs.weight)}</dd></div>
          <div><dt>{tr({ zh: '机制', en: 'Mechanism' })}</dt><dd>{cube.specs.mechanism.length ? cube.specs.mechanism.map(value => tr(MECHANISMS[value] ?? { zh: value, en: value })).join(' · ') : tr(UNKNOWN)}</dd></div>
          <div><dt>{tr({ zh: '调节', en: 'Adjustment' })}</dt><dd>{cube.specs.adjustment ? tr(cube.specs.adjustment) : tr(UNKNOWN)}</dd></div>
        </dl><ReferenceLinks ids={cube.sourceIds} />
      </section>
      <section><h3>{tr({ zh: '亮点与变化', en: 'Highlights and changes' })}</h3><ul>{cube.highlights.map((item, index) => <li key={index}>{tr(item)}</li>)}</ul><ReferenceLinks ids={cube.sourceIds} /></section>
      <section className="ch-assessment"><h3>{tr({ zh: '评价', en: 'Assessment' })}<span className="ch-badge">{tr(cube.assessment.basis === 'review' ? { zh: '亲历评价摘要', en: 'First-hand review summary' } : { zh: '编辑分析', en: 'Editorial analysis' })}</span></h3><p>{tr(cube.assessment.summary)}</p><h4>{tr({ zh: '局限与待核项', en: 'Limitations and open questions' })}</h4><p>{tr(cube.assessment.tradeoffs)}</p><ReferenceLinks ids={cube.assessment.sourceIds} /></section>
      <section><h3>{tr({ zh: '已记录版本', en: 'Documented variants' })}</h3>{cube.variants.length ? <ul>{cube.variants.map((variant, index) => <li key={index}>{variant}</li>)}</ul> : <p className="ch-muted">{tr({ zh: '未找到足够资料进一步区分版本。', en: 'Insufficient evidence to distinguish further variants.' })}</p>}</section>
    </div>
    <footer className="ch-detail-foot">{tr({ zh: '原始来源', en: 'Original sources' })}<ReferenceLinks ids={sourceIdsForCube(cube)} /></footer>
  </article>;
}

function CatalogTable({ cubes, ids, full, onOpen, onToggle }: { cubes: Cube[]; ids: string[]; full: boolean; onOpen: (id: string) => void; onToggle: (id: string) => void }) {
  return <div className="sticky-scroll ch-table-wrap"><table className="sticky-thead ch-table"><caption>{tr({ zh: '三阶魔方型号及可核查参数', en: '3×3 models and sourced specifications' })}</caption><thead><tr>
    {[{ zh: '型号', en: 'Model' }, { zh: '时间及口径', en: 'Date & basis' }, { zh: '尺寸 / 净重', en: 'Size / item weight' }, { zh: '价格', en: 'Price' }, { zh: '对比', en: 'Compare' }].map(label => <th key={label.en} scope="col">{tr(label)}</th>)}
  </tr></thead><tbody>{cubes.map(cube => <tr key={cube.id}>
    <th scope="row"><span className="ch-muted">{brandName(cube.brand)}</span><button type="button" className="ch-text-button" onClick={() => onOpen(cube.id)}>{tr(cube.name)}</button></th>
    <td>{dateText(cube)}<small>{tr(RELEASE_LABELS[cube.release.basis])} · {tr(STATUS_LABELS[cube.status])}</small></td>
    <td>{specText(cube.specs.size)}<small>{specText(cube.specs.weight)}</small></td>
    <td>{cube.prices.length ? <PriceQuote price={cube.prices.find(price => price.currency === 'CNY') ?? cube.prices[0]} compact /> : tr(UNKNOWN)}</td>
    <td><AddToCompare cube={cube} selected={ids.includes(cube.id)} full={full} onToggle={onToggle} /></td>
  </tr>)}</tbody></table></div>;
}

function Comparison({ cubes, onToggle, onBrowse }: { cubes: Cube[]; onToggle: (id: string) => void; onBrowse: () => void }) {
  if (!cubes.length) return <div className="ch-empty" data-site-surface="panel"><Columns3 size={35} /><h2>{tr({ zh: '把想了解的魔方放在一起', en: 'Bring the cubes you want to understand together' })}</h2><p>{tr({ zh: '在型号图鉴中选择最多四款，比较发布时间、版本、售价、结构与评价。', en: 'Choose up to four models from the catalog to compare dates, variants, prices, mechanisms and assessments.' })}</p><button type="button" className="ch-button ch-button--primary" onClick={onBrowse}>{tr({ zh: '选择型号', en: 'Choose models' })}</button></div>;
  const rows: { label: LocalizedText; render: (cube: Cube) => ReactNode }[] = [
    { label: { zh: '品牌', en: 'Brand' }, render: cube => brandName(cube.brand) },
    { label: { zh: '时间', en: 'Date' }, render: cube => <>{dateText(cube)}<small>{tr(RELEASE_LABELS[cube.release.basis])}</small><p>{tr(cube.release.note)}</p><ReferenceLinks ids={cube.release.sourceIds} /></> },
    { label: { zh: '状态', en: 'Status' }, render: cube => tr(STATUS_LABELS[cube.status]) },
    { label: { zh: '售价记录', en: 'Price records' }, render: cube => cube.prices.length ? cube.prices.map((price, index) => <PriceQuote key={index} price={price} compact />) : tr(UNKNOWN) },
    { label: { zh: '尺寸 / 净重', en: 'Size / item weight' }, render: cube => <>{specText(cube.specs.size)}<small>{specText(cube.specs.weight)}</small></> },
    { label: { zh: '机制', en: 'Mechanism' }, render: cube => cube.specs.mechanism.length ? cube.specs.mechanism.map(value => tr(MECHANISMS[value] ?? { zh: value, en: value })).join(' · ') : tr(UNKNOWN) },
    { label: { zh: '调节', en: 'Adjustment' }, render: cube => cube.specs.adjustment ? tr(cube.specs.adjustment) : tr(UNKNOWN) },
    { label: { zh: '亮点', en: 'Highlights' }, render: cube => <ul>{cube.highlights.map((item, index) => <li key={index}>{tr(item)}</li>)}</ul> },
    { label: { zh: '评价', en: 'Assessment' }, render: cube => <><span className="ch-badge">{tr(cube.assessment.basis === 'review' ? { zh: '亲历评价', en: 'First-hand' } : { zh: '编辑分析', en: 'Editorial' })}</span><p>{tr(cube.assessment.summary)}</p><p>{tr(cube.assessment.tradeoffs)}</p><ReferenceLinks ids={cube.assessment.sourceIds} /></> },
    { label: { zh: '版本', en: 'Variants' }, render: cube => cube.variants.join(' · ') || tr(UNKNOWN) },
    { label: { zh: '来源', en: 'Sources' }, render: cube => <ReferenceLinks ids={sourceIdsForCube(cube)} /> },
  ];
  return <section><h2>{tr({ zh: '逐项比较', en: 'Compare field by field' })}</h2><p className="ch-muted">{tr({ zh: '币种、市场和版本保留原样；价格的高低不能直接代表性能。', en: 'Currency, market and version remain explicit; a higher price does not by itself establish better performance.' })}</p><div className="sticky-scroll ch-table-wrap"><table className="sticky-thead ch-table ch-comparison">
    <caption>{tr({ zh: '所选型号的参数与来源对比', en: 'Specifications and sources for the selected models' })}</caption><thead><tr><th scope="col">{tr({ zh: '项目', en: 'Field' })}</th>{cubes.map(cube => <th scope="col" key={cube.id}>{tr(cube.name)}<button type="button" className="ch-text-button" onClick={() => onToggle(cube.id)}><X size={13} />{tr({ zh: '移除', en: 'Remove' })}</button></th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.label.en}><th scope="row">{tr(row.label)}</th>{cubes.map(cube => <td key={cube.id}>{row.render(cube)}</td>)}</tr>)}</tbody>
  </table></div></section>;
}

function Timeline({ onOpen, onPeriod }: { onOpen: (id: string) => void; onPeriod: (period: string) => void }) {
  return <section className="ch-history-section" aria-labelledby="ch-history-heading">
    <div className="ch-section-heading"><div><p className="ch-eyebrow">{tr({ zh: '变化的不只是速度', en: 'More than a race for speed' })}</p><h2 id="ch-history-heading">{tr({ zh: '读懂每一代为什么出现', en: 'Why each generation appeared' })}</h2></div><p>{tr({ zh: '关键节点串起结构、磁力、调节和连接能力的变化。', en: 'Milestones connect changes in geometry, magnets, adjustment and connectivity.' })}</p></div>
    <div className="ch-history">{MILESTONES.map(milestone => <article className="ch-milestone" key={milestone.id}>
      <div className="ch-year"><strong>{milestone.year}</strong><span>{tr(milestone.period)}</span></div>
      <div className="ch-milestone-body" data-site-surface="panel"><h3>{tr(milestone.title)}</h3><p>{tr(milestone.description)} <ReferenceLinks ids={milestone.sourceIds} /></p>
        <div className="ch-related">{milestone.cubeIds.map(id => { const cube = CUBES.find(item => item.id === id); return cube ? <button type="button" className="ch-text-button" key={id} onClick={() => onOpen(id)}>{tr(cube.name)}<ArrowUpRight size={14} /></button> : null; })}</div>
      </div>
    </article>)}</div>
    <div className="ch-periods"><h3>{tr({ zh: '按年代查型号', en: 'Browse models by era' })}</h3><div>{PERIODS.filter(period => period.id !== 'all' && period.id !== 'unknown').map(period => <button type="button" className="ch-button" key={period.id} onClick={() => onPeriod(period.id)}>{tr(period.label)}<ArrowUpRight size={14} /></button>)}</div></div>
  </section>;
}

function SourcesView() {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const q = query.trim().toLowerCase();
  const sources = SOURCES.filter(source => (kind === 'all' || source.kind === kind) && (!q || `${source.title} ${source.publisher} ${source.url}`.toLowerCase().includes(q)));
  const missing = [
    { label: { zh: '年份待核', en: 'Missing year' }, value: CUBES.filter(cube => cube.year === null).length },
    { label: { zh: '暂无可信价格', en: 'Without a verified price' }, value: CUBES.filter(cube => !cube.prices.length).length },
    { label: { zh: '暂无明确净重', en: 'Without item weight' }, value: CUBES.filter(cube => !cube.specs.weight).length },
    { label: { zh: '预告 / 预售型号', en: 'Announced / preorder entries' }, value: CUBES.filter(cube => cube.status === 'announced').length },
  ];
  return <section><h2>{tr({ zh: '每个结论都可以追溯', en: 'Trace each claim to its evidence' })}</h2><dl className="ch-metrics ch-quality">{missing.map(item => <div key={item.label.en}><dt>{tr(item.label)}</dt><dd>{item.value}</dd></div>)}</dl><div className="ch-method-grid">{METHODOLOGY.map(item => <article key={item.title.en} data-site-surface="panel"><h3>{tr(item.title)}</h3><p>{tr(item.text)}</p></article>)}</div>
    <div className="ch-section-heading"><h3>{tr({ zh: '原始资料索引', en: 'Source index' })}</h3><span>{sources.length} / {SOURCES.length}</span></div>
    <div className="ch-source-controls"><SearchInput value={query} onChange={setQuery} placeholder={tr({ zh: '查来源、品牌或网站', en: 'Find a source, brand or website' })} className="ch-search" />
      <CompactSelect label={kind === 'all' ? tr({ zh: '全部来源', en: 'All sources' }) : tr(SOURCE_LABELS[kind])} valueText={kind === 'all' ? tr({ zh: '全部来源', en: 'All sources' }) : tr(SOURCE_LABELS[kind])} value={kind} onChange={setKind} ariaLabel={tr({ zh: '来源类型', en: 'Source type' })} items={[{ value: 'all', label: tr({ zh: '全部来源', en: 'All sources' }) }, ...Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label: tr(label) }))]} />
    </div>
    <ol className="ch-source-list">{sources.map(source => <li key={source.id} value={SOURCE_BY_ID.get(source.id)?.number}>
      <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ArrowUpRight size={14} /></a><small>{source.publisher} · {tr(SOURCE_LABELS[source.kind])}</small>
    </li>)}</ol>
    {!sources.length && <p className="ch-empty">{tr({ zh: '没有匹配的来源。', en: 'No matching sources.' })}</p>}
  </section>;
}

function Explorer() {
  useLang();
  const [view, setView] = useQueryState('view', parseAsStringEnum<View>(['timeline', 'catalog', 'compare', 'sources']).withDefault('timeline').withOptions({ history: 'push' }));
  const [filters, setFilters] = useQueryStates({
    q: parseAsString.withDefault(''),
    brand: parseAsStringEnum(['all', ...brandKeys]).withDefault('all'),
    period: parseAsStringEnum(PERIODS.map(item => item.id)).withDefault('all'),
    category: parseAsStringEnum(['all', ...Object.keys(CATEGORIES)]).withDefault('all'),
    evidence: parseAsStringEnum(Object.keys(EVIDENCE_LABELS)).withDefault('all'),
    technology: parseAsStringEnum(Object.keys(TECHNOLOGIES)).withDefault('all'),
  });
  const [order, setOrder] = useQueryState('order', parseAsStringEnum(['newest', 'oldest', 'name']).withDefault('newest'));
  const [table, setTable] = useQueryState('table', parseAsBoolean.withDefault(false));
  const [compareIds, setCompareIds] = useQueryState('compare', parseAsArrayOf(parseAsString, ',').withDefault([]));
  const [model, setModel] = useQueryState('model', parseAsString.withOptions({ history: 'push' }));
  const [pageSize, setPageSize] = useState({ key: '', count: 24 });
  const openTrigger = useRef<HTMLElement | null>(null);
  const activeCube = model ? CUBES.find(cube => cube.id === model) : undefined;
  const chosen = useMemo(() => selectedCubes(CUBES, compareIds), [compareIds]);
  const chosenIds = chosen.map(cube => cube.id);
  const filtered = useMemo(() => sortCubes(CUBES.filter(cube => matchesCube(cube, filters)), order), [filters, order]);
  const queryKey = JSON.stringify([filters, order]);
  const visibleCount = pageSize.key === queryKey ? pageSize.count : 24;
  const visible = filtered.slice(0, visibleCount);
  const full = chosen.length >= 4;
  const activeFilters = Object.entries(filters).some(([key, value]) => value !== EMPTY_FILTERS[key as keyof typeof EMPTY_FILTERS]);
  const { copied, copy } = useCopy();

  const toggleCompare = (id: string) => {
    const next = chosenIds.includes(id) ? chosenIds.filter(value => value !== id) : chosenIds.length < 4 ? [...chosenIds, id] : chosenIds;
    void setCompareIds(next);
  };
  const openModel = (id: string) => {
    if (id === model) return;
    openTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    void setModel(id);
  };
  const closeModel = () => {
    // An inline record closes independently of filter and comparison changes.
    void setModel(null, { history: 'replace' }).then(() => {
      const target = openTrigger.current?.isConnected
        ? openTrigger.current
        : document.querySelector<HTMLElement>('.ch-tabs button[aria-pressed="true"]');
      target?.focus();
      openTrigger.current = null;
    });
  };
  const navigateView = (next: View) => {
    // Switching the major view preserves filters and comparison choices.
    if (model) void setModel(null, { history: 'replace' });
    void setView(next);
  };
  const selectPeriod = (period: string) => {
    void setFilters({ ...EMPTY_FILTERS, period });
    navigateView('catalog');
  };
  const download = () => {
    const usedSources = new Set(filtered.flatMap(sourceIdsForCube));
    const data = JSON.stringify({ snapshotDate: SNAPSHOT_DATE, filters, cubes: filtered, sources: SOURCES.filter(source => usedSources.has(source.id)) }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `cuberoot-3x3-history-${SNAPSHOT_DATE}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const setFilter = (key: keyof typeof EMPTY_FILTERS, value: string) => { void setFilters({ [key]: value }); };

  return <div id="ch-explorer" className="ch-explorer">
    <nav className="ch-tabs" aria-label={tr({ zh: '档案视图', en: 'Archive view' })}>{VIEW_OPTIONS.map(({ id, label, Icon }) => <button type="button" key={id} aria-pressed={view === id} className={view === id ? 'is-active' : ''} onClick={() => navigateView(id)}><Icon size={17} />{tr(label)}</button>)}</nav>
    {activeCube && <CubeDetails cube={activeCube} selected={chosenIds.includes(activeCube.id)} full={full} onToggle={toggleCompare} onClose={closeModel} />}
    {model && !activeCube && <div role="status" className="ch-empty" data-site-surface="panel"><p>{tr({ zh: '该型号链接未匹配到当前资料。', en: 'This model link does not match the current archive.' })}</p><button type="button" className="ch-button" onClick={closeModel}>{tr({ zh: '关闭', en: 'Close' })}</button></div>}
    {view === 'timeline' && <Timeline onOpen={openModel} onPeriod={selectPeriod} />}
    {view === 'catalog' && <section aria-labelledby="ch-catalog-heading">
      <div className="ch-section-heading"><div><p className="ch-eyebrow">{tr({ zh: '按自己的问题检索', en: 'Explore your own questions' })}</p><h2 id="ch-catalog-heading">{tr({ zh: '型号图鉴', en: 'Model catalog' })}</h2></div><div className="ch-catalog-actions"><button type="button" className="ch-button" onClick={download}><Download size={15} />{tr({ zh: '下载当前资料', en: 'Export results' })}</button><button type="button" className="ch-button" onClick={() => copy(window.location.href)}>{copied ? <Check size={15} /> : <Link2 size={15} />}{tr(copied ? { zh: '已复制', en: 'Copied' } : { zh: '分享筛选', en: 'Share filters' })}</button></div></div>
      <div className="ch-filter-panel" data-site-surface="panel">
        <SearchInput value={filters.q} onChange={value => setFilter('q', value)} debounceMs={150} maxLength={160} type="search" placeholder={tr({ zh: '搜索品牌、型号、别名或技术，如 GAN 12 / 孤鸿 / MagLev', en: 'Search a brand, model, alias or technology, e.g. GAN 12 / GuHong / MagLev' })} className="ch-search" />
        <div className="ch-filter-row">
          <CompactSelect label={filters.brand === 'all' ? tr({ zh: '所有品牌', en: 'All brands' }) : brandName(filters.brand)} valueText={filters.brand === 'all' ? tr({ zh: '所有品牌', en: 'All brands' }) : brandName(filters.brand)} ariaLabel={tr({ zh: '按品牌筛选', en: 'Filter by brand' })} value={filters.brand} onChange={value => setFilter('brand', value)} items={[{ value: 'all', label: tr({ zh: '所有品牌', en: 'All brands' }) }, ...brandKeys.map(value => ({ value, label: brandName(value) }))]} />
          <CompactSelect label={tr(PERIODS.find(item => item.id === filters.period)!.label)} valueText={tr(PERIODS.find(item => item.id === filters.period)!.label)} ariaLabel={tr({ zh: '按年代筛选', en: 'Filter by era' })} value={filters.period} onChange={value => setFilter('period', value)} items={PERIODS.map(period => ({ value: period.id, label: tr(period.label) }))} />
          <CompactSelect label={filters.category === 'all' ? tr({ zh: '所有类型', en: 'All categories' }) : tr(CATEGORIES[filters.category])} valueText={filters.category === 'all' ? tr({ zh: '所有类型', en: 'All categories' }) : tr(CATEGORIES[filters.category])} ariaLabel={tr({ zh: '按类型筛选', en: 'Filter by category' })} value={filters.category} onChange={value => setFilter('category', value)} items={[{ value: 'all', label: tr({ zh: '所有类型', en: 'All categories' }) }, ...Object.entries(CATEGORIES).map(([value, label]) => ({ value, label: tr(label) }))]} />
          <CompactSelect label={tr(TECHNOLOGIES[filters.technology])} valueText={tr(TECHNOLOGIES[filters.technology])} ariaLabel={tr({ zh: '按技术筛选', en: 'Filter by technology' })} value={filters.technology} onChange={value => setFilter('technology', value)} items={Object.entries(TECHNOLOGIES).map(([value, label]) => ({ value, label: tr(label) }))} />
          <CompactSelect label={tr(EVIDENCE_LABELS[filters.evidence])} valueText={tr(EVIDENCE_LABELS[filters.evidence])} ariaLabel={tr({ zh: '按资料完整性筛选', en: 'Filter by evidence' })} value={filters.evidence} onChange={value => setFilter('evidence', value)} items={Object.entries(EVIDENCE_LABELS).map(([value, label]) => ({ value, label: tr(label) }))} />
          {activeFilters && <ClearButton variant="standalone" onClick={() => { void setFilters(EMPTY_FILTERS); }} ariaLabel={tr({ zh: '清除全部筛选', en: 'Clear all filters' })} />}
        </div>
      </div>
      <div className="ch-result-bar"><p role="status" aria-live="polite">{tr({ zh: `找到 ${filtered.length} 条型号记录`, en: `${filtered.length} model records found` })}</p><div><CompactSelect label={tr(SORT_LABELS[order])} valueText={tr(SORT_LABELS[order])} value={order} onChange={value => { void setOrder(value as typeof order); }} ariaLabel={tr({ zh: '排序方式', en: 'Sort order' })} items={[
        { value: 'newest', label: tr({ zh: '由新到旧', en: 'Newest first' }) }, { value: 'oldest', label: tr({ zh: '由旧到新', en: 'Oldest first' }) }, { value: 'name', label: tr({ zh: '型号名称', en: 'Model name' }) },
      ]} /><PillToggle value={!table} onChange={value => { void setTable(!value); }} onLabel={tr({ zh: '卡片', en: 'Cards' })} offLabel={tr({ zh: '表格', en: 'Table' })} ariaLabel={tr({ zh: '图鉴布局', en: 'Catalog layout' })} /></div></div>
      {!filtered.length ? <div className="ch-empty"><h3>{tr({ zh: '没有找到匹配型号', en: 'No matching models' })}</h3><p>{tr({ zh: '试试更短的型号名称，或清除品牌、年代和技术筛选。', en: 'Try a shorter model name or clear the brand, era and technology filters.' })}</p><button type="button" className="ch-button" onClick={() => { void setFilters(EMPTY_FILTERS); }}>{tr({ zh: '重置筛选', en: 'Reset filters' })}</button></div>
        : table ? <CatalogTable cubes={visible} ids={chosenIds} full={full} onOpen={openModel} onToggle={toggleCompare} />
          : <div className="ch-model-grid">{visible.map(cube => <ModelCard key={cube.id} cube={cube} selected={chosenIds.includes(cube.id)} full={full} onOpen={openModel} onToggle={toggleCompare} />)}</div>}
      {visible.length < filtered.length && <div className="ch-load-more"><button type="button" className="ch-button" onClick={() => setPageSize({ key: queryKey, count: visibleCount + 24 })}>{tr({ zh: '继续查看型号', en: 'Show more models' })}</button><button type="button" className="ch-text-button" onClick={() => setPageSize({ key: queryKey, count: filtered.length })}>{tr({ zh: '展开全部', en: 'Show all' })}</button><span>{visible.length} / {filtered.length}</span></div>}
    </section>}
    {view === 'compare' && <Comparison cubes={chosen} onToggle={toggleCompare} onBrowse={() => navigateView('catalog')} />}
    {view === 'sources' && <SourcesView />}
    {chosen.length > 0 && view !== 'compare' && <aside className="ch-comparison-bar" data-site-surface="popover" aria-label={tr({ zh: '已选对比型号', en: 'Selected comparison models' })}>
      <div><strong>{tr({ zh: `已选 ${chosen.length} / 4`, en: `Selected ${chosen.length} / 4` })}</strong><span>{chosen.map(cube => tr(cube.name)).join(' · ')}</span></div><button type="button" className="ch-button ch-button--primary" onClick={() => navigateView('compare')}><Columns3 size={16} />{tr({ zh: '开始对比', en: 'Compare' })}</button><ClearButton variant="standalone" onClick={() => { void setCompareIds([]); }} ariaLabel={tr({ zh: '清空对比', en: 'Clear comparison' })} />
    </aside>}
  </div>;
}

export default function CubeHistoryPage() {
  useLang();
  return <main className="ch-page"><Hero /><Suspense fallback={<p className="ch-loading" role="status">{tr({ zh: '正在加载交互图鉴…', en: 'Loading the interactive archive…' })}</p>}><Explorer /></Suspense>
    <footer className="ch-footer"><p>CubeRoot · {tr({ zh: '三阶魔方硬件档案', en: '3×3 hardware archive' })}</p><p>{tr({ zh: '发现缺失型号或更好的原始资料？欢迎带着来源补充。', en: 'Found a missing model or a better original source? Contributions with evidence are welcome.' })}</p><div><AppLink href="/wiki" prefetch={false}>{tr({ zh: '速拧术语表', en: 'Cubing glossary' })}</AppLink><AppLink href="/forum" prefetch={false}>{tr({ zh: '交流与补充', en: 'Discuss and contribute' })}</AppLink></div></footer>
  </main>;
}
