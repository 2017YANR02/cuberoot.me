'use client';

import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryState, useQueryStates, parseAsString, parseAsStringEnum, parseAsArrayOf, parseAsBoolean } from 'nuqs';
import { ArrowUpRight, BookOpen, Check, ChevronDown, Columns3, Download, History, ImageOff, Link2, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import HomeLink from '@/components/HomeLink';
import AppLink from '@/components/AppLink';
import HeaderToggles from '@/components/HeaderToggles';
import { ClearButton } from '@/components/ClearButton';
import SearchInput from '@/components/SearchInput';
import { CompactSelect } from '@/components/CompactSelect';
import PillToggle from '@/components/PillToggle/PillToggle';
import { useCopy } from '@/hooks/useCopy';
import { tr, useLang } from '@/i18n/tr';
import { CUBES, SOURCES, SOURCE_BY_ID, resolveCubeId } from './_data/catalog';
import { BRANDS, CATEGORIES, EVIDENCE_LABELS, MECHANISMS, METHODOLOGY, PERIODS, PRICE_LABELS, RELEASE_LABELS, SNAPSHOT_DATE, SORT_LABELS, SOURCE_LABELS, STATUS_LABELS, TECHNOLOGIES, TIERS } from './_data/labels';
import { MILESTONES } from './_data/milestones';
import { EMPTY_FILTERS, PRIORITY_BRANDS, matchesCube, selectedCubes, sortBrandKeys, sortCubes, sourceIdsForCube } from './_data/query';
import type { Cube, CubePrice, LocalizedText } from './_data/types';
import '@/components/sticky-table.css';
import './cube-history.css';

type View = 'timeline' | 'catalog' | 'compare' | 'sources';
const VIEW_OPTIONS: { id: View; label: LocalizedText; Icon: typeof History }[] = [
  { id: 'catalog', label: { zh: '型号图鉴', en: 'Model catalog' }, Icon: BookOpen },
  { id: 'timeline', label: { zh: '发展时间线', en: 'Timeline' }, Icon: History },
  { id: 'compare', label: { zh: '参数对比', en: 'Compare' }, Icon: Columns3 },
  { id: 'sources', label: { zh: '来源与口径', en: 'Sources & method' }, Icon: Link2 },
];
const brandKeys = sortBrandKeys(CUBES.map(cube => cube.brand));
const BRAND_FEATURES: Record<string, { model: string; label: LocalizedText; related: string[] }> = {
  GAN: { model: 'gan17', label: { zh: 'GAN 17 · 历代旗舰与入门型号', en: 'GAN 17 · Flagships & entry models' }, related: ['Monster Go', 'Swift Block'] },
  MoYu: { model: 'moyu-weilong-v11', label: { zh: '威龙 · 傲龙 · RS3 M', en: 'WeiLong · AoLong · RS3 M' }, related: ['MoFangJiaoShi', 'GuoGuan', 'HuaMeng'] },
  QiYi: { model: 'qiyi-m-pro-v2', label: { zh: 'M Pro · Valk · 奇航', en: 'M Pro · Valk · QiHang' }, related: ['X-Man Design'] },
  YJ: { model: 'yj-mgc3-beta', label: { zh: 'MGC · 御龙 · 冠龙', en: 'MGC · YuLong · GuanLong' }, related: [] },
};
const FEATURED_MODELS = new Map(CUBES.filter(cube => Object.values(BRAND_FEATURES).some(feature => feature.model === cube.id)).map(cube => [cube.id, cube]));
const ADVANCED_FILTERS = ['period', 'category', 'technology', 'evidence'] as const;
const snapshotYear = Number(SNAPSHOT_DATE.slice(0, 4));
const earliestYear = Math.min(...CUBES.flatMap(cube => cube.year === null ? [] : [cube.year]));
const yearKeys = Array.from({ length: snapshotYear - earliestYear + 1 }, (_, index) => String(snapshotYear - index));
const familyKeys = new Set(CUBES.flatMap(cube => cube.familyId ? [cube.familyId] : []));
const familyRoots = CUBES.filter(cube => familyKeys.has(cube.id)).sort((a, b) => a.name.en.localeCompare(b.name.en, 'en', { numeric: true }));
const UNKNOWN = { zh: '待核实', en: 'Unverified' };
const REGIONS: Record<string, LocalizedText> = {
  'US / international': { zh: '美国 / 国际市场', en: 'US / international' },
  US: { zh: '美国', en: 'US' }, Global: { zh: '国际市场', en: 'Global' },
  China: { zh: '中国', en: 'China' }, 'CN export': { zh: '中国出口报价', en: 'China export' }, CN: { zh: '中国', en: 'China' },
  JP: { zh: '日本', en: 'Japan' }, EU: { zh: '欧洲市场', en: 'European market' },
  FR: { zh: '法国', en: 'France' }, PL: { zh: '波兰', en: 'Poland' }, IN: { zh: '印度', en: 'India' }, UK: { zh: '英国', en: 'UK' },
  International: { zh: '国际市场', en: 'International' },
  'International retailer': { zh: '国际商家报价', en: 'International retailer' },
  BN: { zh: '文莱', en: 'Brunei' }, ES: { zh: '西班牙', en: 'Spain' }, GB: { zh: '英国', en: 'UK' },
  Germany: { zh: '德国', en: 'Germany' }, 'CN / export': { zh: '中国出口报价', en: 'China export' },
  'Global / China-channel edition': { zh: '国际报价 / 中国渠道版本', en: 'Global / China-channel edition' },
  'Slovenia / Europe': { zh: '斯洛文尼亚 / 欧洲市场', en: 'Slovenia / Europe' },
};
const brandName = (brand: string) => tr(BRANDS[brand] ?? { zh: brand, en: brand });
const dateText = (cube: Cube) => cube.release.date ?? tr(UNKNOWN);
const SPEC_QUALIFIERS: Record<string, string> = {"official manual":"官方手册","official":"官方","retailer variation":"商家资料存在差异","nonmagnetic":"无磁","non-magnetic":"无磁","standard":"标准版","Standard":"标准版","Magnetic":"磁力版","spring":"弹簧版","matte":"磨砂版","listing":"商品页","original dealer":"早期经销商","original":"初版","dual-adjustment":"双调版","unstickered listing":"无贴纸版本商品页","review sample":"测评样品","Flagship":"旗舰版","Pioneer":"先锋版","Ultimate":"至尊版","UK listing":"英国商家","UK retailer":"英国商家","Enhanced":"增强版","non-magnetic tiled":"无磁色片版","20-magnet MagLev UV":"20 磁轴磁悬浮 UV 版","8-magnet MagLev":"8 磁轴磁悬浮版","standard AI":"标准 AI 版",stickered:'贴纸款',stickerless:'无贴纸款',nominal:'标称'};
function specText(value: string | null): string {
  if (value === null) return tr(UNKNOWN);
  const zh = value.replace(/\b(?:unstickered listing|20-magnet MagLev UV|retailer variation|non-magnetic tiled|official manual|original dealer|dual-adjustment|8-magnet MagLev|review sample|non-magnetic|nonmagnetic|UK retailer|standard AI|UK listing|official|standard|Standard|Magnetic|original|Flagship|Ultimate|Enhanced|listing|Pioneer|spring|matte|stickered|stickerless|nominal)\b/g, word => SPEC_QUALIFIERS[word] ?? word);
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
  const withImages = CUBES.filter(cube => cube.image).length;
  return <>
    <header className="ch-header">
      <HomeLink className="ch-wordmark">CubeRoot<span>{tr({ zh: '硬件档案', en: 'Hardware archive' })}</span></HomeLink>
      <HeaderToggles />
    </header>
    <div className="ch-intro"><section className="ch-hero" aria-labelledby="ch-title">
      <div className="ch-hero-copy">
        <p className="ch-eyebrow">1974 — 2026 <span> / </span>{tr({ zh: '三阶 · 中国品牌为主', en: '3×3 · A focus on Chinese brands' })}</p>
        <h1 id="ch-title">{tr({ zh: '三阶魔方发展史', en: 'A history of the 3×3 cube' })}</h1>
        <p className="ch-deck">{tr({ zh: '从最初的可转动结构，到 GAN 17。沿着型号、机械结构与真实资料，读懂半个世纪的演进。', en: 'From the first turning mechanism to GAN 17. Follow the models, engineering choices and surviving evidence across half a century.' })}</p>
        <p className="ch-snapshot">{tr({ zh: '资料截止', en: 'Research cutoff' })} <time dateTime={SNAPSHOT_DATE}>{SNAPSHOT_DATE}</time> · {tr({ zh: '持续补全的型号档案', en: 'An evolving model archive' })}</p>
      </div>
    </section>
    <dl className="ch-metrics ch-hero-metrics">
      <div><dt>{tr({ zh: '型号记录', en: 'Model entries' })}</dt><dd>{CUBES.length}</dd></div>
      <div><dt>{tr({ zh: '品牌 / 系列标签', en: 'Brand / line labels' })}</dt><dd>{brandKeys.length}</dd></div>
      <div><dt>{tr({ zh: '参考来源', en: 'Sources' })}</dt><dd>{SOURCES.length}</dd></div>
      <div><dt>{tr({ zh: '附来源图片', en: 'With sourced photos' })}</dt><dd>{withImages}</dd></div>
    </dl></div>
    <p className="ch-scope">{tr({ zh: '旗舰、入门与独立子型号分别收录，图片与参数均可追溯来源。仍有待核资料，记录数不代表全球全部 SKU。', en: 'Individual records for flagships, budget models and distinct versions, with sources for photos and specifications. Evidence gaps remain; this is not a count of every global SKU.' })}</p>
  </>;
}

function BrandShortcut({ brand, selected, onSelect }: { brand: string; selected: boolean; onSelect: (brand: string) => void }) {
  const feature = BRAND_FEATURES[brand];
  const cube = FEATURED_MODELS.get(feature.model);
  const [failed, setFailed] = useState(false);
  const photo = cube?.image;
  const source = photo ? SOURCE_BY_ID.get(photo.sourceId) : undefined;
  return <div className={`ch-brand-card${selected ? ' is-active' : ''}`} data-site-surface="panel">
    <button type="button" className="ch-brand-button" aria-pressed={selected} onClick={() => onSelect(selected ? 'all' : brand)} aria-label={tr({ zh: `按 ${brandName(brand)} 筛选`, en: `Filter by ${brandName(brand)}` })}>
      <span className="ch-brand-copy"><strong>{brandName(brand)}</strong><span>{tr(feature.label)}</span></span>
      <span className="ch-brand-image" aria-hidden="true">{photo && !failed ? <img src={photo.assetPath ?? photo.url} alt="" width={96} height={96} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <CubeGlyph />}</span>
      <span className="ch-brand-indicator" aria-hidden="true">{selected ? <Check size={16} /> : <ArrowUpRight size={16} />}</span>
    </button>
    {source && cube && <a className="ch-brand-credit" href={source.url} target="_blank" rel="noopener noreferrer" title={tr(cube.name)}>{tr({ zh: `图：${cube.name.zh}`, en: `Photo: ${cube.name.en}` })}<ArrowUpRight size={10} /></a>}
  </div>;
}

function CubePhoto({ cube, compact = false, onOpen }: { cube: Cube; compact?: boolean; onOpen?: (id: string) => void }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const photo = cube.image;
  const source = photo ? SOURCE_BY_ID.get(photo.sourceId) : undefined;
  const imageUrl = photo?.assetPath ?? photo?.url;
  const missing = !photo || failedUrl === imageUrl;
  const content = missing
    ? <span className="ch-photo-missing"><ImageOff size={compact ? 20 : 32} /><span>{tr(photo ? { zh: '图片暂未载入', en: 'Photo unavailable' } : { zh: '原始图片待核', en: 'Original photo unverified' })}</span></span>
    : <img className="ch-product-image" src={imageUrl} alt={tr(photo.alt)} width={600} height={450} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedUrl(imageUrl ?? null)} />;
  return <figure className={`ch-photo${compact ? ' ch-photo--compact' : ''}`}>
    {onOpen ? <button type="button" className="ch-photo-button" onClick={() => onOpen(cube.id)} aria-label={tr({ zh: `查看 ${cube.name.zh} 的图片与资料`, en: `View photos and record for ${cube.name.en}` })}>{content}</button> : <div className="ch-photo-frame">{content}</div>}
    <figcaption className="ch-photo-caption">
      {source ? <a href={source.url} target="_blank" rel="noopener noreferrer">{tr({ zh: '图片来源', en: 'Photo source' })} · {source.publisher}<ArrowUpRight size={11} /></a> : <span>{tr({ zh: '保留资料缺口', en: 'Evidence gap retained' })}</span>}
      {photo?.match === 'family' && <span className="ch-badge">{tr({ zh: '来源页共用图', en: 'Shared source photo' })}</span>}
    </figcaption>
  </figure>;
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

function MerchantRating({ cube }: { cube: Cube }) {
  const rating = cube.rating;
  if (!rating) return <p className="ch-muted">{tr({ zh: '暂未核到该商品页的评分和评论数。', en: 'A product-page rating with a review count has not been verified.' })}</p>;
  return <div><p><strong>{rating.value.toFixed(2)} / {rating.scale}</strong> · {tr({ zh: `${rating.count} 条商家页评价`, en: `${rating.count} merchant-page reviews` })} <ReferenceLinks ids={[rating.sourceId]} /></p><small>{rating.asOf}</small><p className="ch-muted">{tr(rating.note)}</p></div>;
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
  const mechanisms = ['bluetooth', 'maglev', 'ball-core', 'core-magnets', 'uv', 'adjustable', 'magnet', 'magnetic', 'non-magnetic', 'tactile']
    .filter(key => cube.specs.mechanism.includes(key))
    .filter(key => !(key === 'core-magnets' && cube.specs.mechanism.includes('ball-core')) && !(key === 'magnetic' && cube.specs.mechanism.includes('magnet')))
    .slice(0, 3);
  return <article className="ch-model" data-site-surface="panel">
    <CubePhoto cube={cube} onOpen={onOpen} />
    <div className="ch-model-kicker"><span>{brandName(cube.brand)}</span><span className={`ch-status ch-status--${cube.status}`}>{tr(STATUS_LABELS[cube.status])}</span></div>
    <h3><button type="button" className="ch-model-title-button" onClick={() => onOpen(cube.id)}>{tr(cube.name)}<ArrowUpRight size={18} /></button></h3>
    <p className="ch-model-date"><time>{dateText(cube)}</time><span className="ch-badge">{tr(RELEASE_LABELS[cube.release.basis])}</span><ReferenceLinks ids={cube.release.sourceIds} /></p>
    <p className="ch-model-position">{tr(TIERS[cube.tier ?? 'unknown'])}{cube.familyId && <> · {tr({ zh: '独立子型号', en: 'Distinct version' })}</>}</p>
    {!!mechanisms.length && <div className="ch-mechanism-tags">{mechanisms.map(key => <span key={key}>{tr(MECHANISMS[key])}</span>)}</div>}
    <p className="ch-model-summary">{tr(cube.highlights[0] ?? cube.assessment.summary)}</p>
    <dl className="ch-model-specs"><div><dt>{tr({ zh: '尺寸', en: 'Size' })}</dt><dd>{specText(cube.specs.size)}</dd></div><div><dt>{tr({ zh: '净重', en: 'Net weight' })}</dt><dd>{specText(cube.specs.weight)}</dd></div></dl>
    {leadPrice ? <PriceQuote price={leadPrice} compact /> : <p className="ch-muted">{tr({ zh: '售价待核实', en: 'Price unverified' })}</p>}
    <div className="ch-model-bottom"><button type="button" className="ch-text-button" onClick={() => onOpen(cube.id)}>{tr({ zh: '查看完整资料', en: 'View full record' })}<ArrowUpRight size={15} /></button><AddToCompare cube={cube} selected={selected} full={full} onToggle={onToggle} /></div>
  </article>;
}

function focusDetailHeading(title: HTMLElement | null) {
  title?.focus({ preventScroll: true });
  title?.closest('article')?.scrollIntoView({ block: 'start', behavior: 'instant' });
}

function CubeDetails({ cube, selected, full, onToggle, onClose, onOpen }: {
  cube: Cube; selected: boolean; full: boolean; onToggle: (id: string) => void; onClose: () => void; onOpen: (id: string) => void;
}) {
  const { copied, copy } = useCopy();
  const heading = useRef<HTMLHeadingElement>(null);
  const related = CUBES.filter(item => (item.familyId ?? item.id) === (cube.familyId ?? cube.id));
  useEffect(() => {
    focusDetailHeading(heading.current);
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
    <div className="ch-detail-photo-row">
      <CubePhoto key={cube.id} cube={cube} />
      <div className="ch-photo-notes"><h3>{tr({ zh: '这一个版本', en: 'This specific version' })}</h3><p>{tr(cube.image?.note ?? cube.imageNote ?? { zh: '尚未找到能够确认对应本型号的产品图片。', en: 'A product photo verified for this model has not yet been found.' })}</p><p>{tr({ zh: '产品定位', en: 'Positioning' })}：{tr(TIERS[cube.tier ?? 'unknown'])}</p>
        {related.length > 1 && <><h4>{tr({ zh: '同系列版本', en: 'Versions in this family' })}</h4><p>{tr({ zh: '切换到具体版本，查看它自己的日期、售价、结构和图片。', en: 'Choose a specific version to inspect its own date, price, mechanism and photo.' })}</p><CompactSelect className="ch-family-select" label={tr(cube.name)} valueText={tr(cube.name)} title={tr(cube.name)} value={cube.id} onChange={onOpen} ariaLabel={tr({ zh: '查看同系列版本', en: 'Choose a family version' })} items={related.map(item => ({ value: item.id, label: tr(item.name) }))} /></>}
      </div>
    </div>
    <div className="ch-detail-grid">
      <section><h3>{tr({ zh: '发布时间', en: 'Release evidence' })}</h3><p className="ch-detail-date">{dateText(cube)} <span className="ch-badge">{tr(RELEASE_LABELS[cube.release.basis])}</span><ReferenceLinks ids={cube.release.sourceIds} /></p><p>{tr(cube.release.note)}</p></section>
      <section><h3>{tr({ zh: '售价记录', en: 'Price records' })}</h3>{cube.prices.length ? cube.prices.map((price, index) => <PriceQuote key={index} price={price} />) : <p className="ch-muted">{tr({ zh: '尚未找到可核查的报价，未推算或填零。', en: 'No verified quote found; no estimate or zero placeholder is substituted.' })}</p>}
        {!!cube.familyPrices?.length && <><h4>{tr({ zh: '同系列官网报价 · 配置未明确', en: 'Official family quote · configuration unspecified' })}</h4><p className="ch-muted">{tr({ zh: '官网未说明这一报价对应哪个配置，因此单独保留作系列资料，不计入本型号的人民币价格筛选或直接价格比较。', en: 'The official page does not identify the configuration for this quote. It is retained as family context and excluded from this model’s CNY-price filter and direct price comparison.' })}</p>{cube.familyPrices.map((price, index) => <PriceQuote key={index} price={price} />)}</>}
      </section>
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
      <section><h3>{tr({ zh: '商家页用户评分', en: 'Merchant-page user rating' })}</h3><MerchantRating cube={cube} /></section>
      <section><h3>{tr({ zh: '已记录版本', en: 'Documented variants' })}</h3>{cube.variants.length ? <ul>{cube.variants.map((variant, index) => <li key={index}>{variant}</li>)}</ul> : <p className="ch-muted">{tr({ zh: '未找到足够资料进一步区分版本。', en: 'Insufficient evidence to distinguish further variants.' })}</p>}</section>
    </div>
    <footer className="ch-detail-foot">{tr({ zh: '原始来源', en: 'Original sources' })}<ReferenceLinks ids={sourceIdsForCube(cube)} /></footer>
  </article>;
}

function CatalogTable({ cubes, ids, full, onOpen, onToggle }: { cubes: Cube[]; ids: string[]; full: boolean; onOpen: (id: string) => void; onToggle: (id: string) => void }) {
  return <div className="sticky-scroll ch-table-wrap"><table className="sticky-thead ch-table"><caption>{tr({ zh: '三阶魔方型号及可核查参数', en: '3×3 models and sourced specifications' })}</caption><thead><tr>
    {[{ zh: '型号', en: 'Model' }, { zh: '时间及口径', en: 'Date & basis' }, { zh: '尺寸 / 净重', en: 'Size / item weight' }, { zh: '价格', en: 'Price' }, { zh: '对比', en: 'Compare' }].map(label => <th key={label.en} scope="col">{tr(label)}</th>)}
  </tr></thead><tbody>{cubes.map(cube => <tr key={cube.id}>
    <th scope="row"><CubePhoto cube={cube} compact onOpen={onOpen} /><span className="ch-muted">{brandName(cube.brand)}</span><button type="button" className="ch-text-button" onClick={() => onOpen(cube.id)}>{tr(cube.name)}</button></th>
    <td>{dateText(cube)}<small>{tr(RELEASE_LABELS[cube.release.basis])} · {tr(STATUS_LABELS[cube.status])}</small></td>
    <td>{specText(cube.specs.size)}<small>{specText(cube.specs.weight)}</small></td>
    <td>{cube.prices.length ? <PriceQuote price={cube.prices.find(price => price.currency === 'CNY') ?? cube.prices[0]} compact /> : tr(UNKNOWN)}</td>
    <td><AddToCompare cube={cube} selected={ids.includes(cube.id)} full={full} onToggle={onToggle} /></td>
  </tr>)}</tbody></table></div>;
}

function Comparison({ cubes, onToggle, onBrowse }: { cubes: Cube[]; onToggle: (id: string) => void; onBrowse: () => void }) {
  if (!cubes.length) return <div className="ch-empty" data-site-surface="panel"><Columns3 size={35} /><h2>{tr({ zh: '把想了解的魔方放在一起', en: 'Bring the cubes you want to understand together' })}</h2><p>{tr({ zh: '在型号图鉴中选择最多四款，比较发布时间、版本、售价、结构与评价。', en: 'Choose up to four models from the catalog to compare dates, variants, prices, mechanisms and assessments.' })}</p><button type="button" className="ch-button ch-button--primary" onClick={onBrowse}>{tr({ zh: '选择型号', en: 'Choose models' })}</button></div>;
  const rows: { label: LocalizedText; render: (cube: Cube) => ReactNode }[] = [
    { label: { zh: '产品图片', en: 'Product photo' }, render: cube => <CubePhoto cube={cube} compact /> },
    { label: { zh: '品牌', en: 'Brand' }, render: cube => brandName(cube.brand) },
    { label: { zh: '定位', en: 'Positioning' }, render: cube => tr(TIERS[cube.tier ?? 'unknown']) },
    { label: { zh: '时间', en: 'Date' }, render: cube => <>{dateText(cube)}<small>{tr(RELEASE_LABELS[cube.release.basis])}</small><p>{tr(cube.release.note)}</p><ReferenceLinks ids={cube.release.sourceIds} /></> },
    { label: { zh: '状态', en: 'Status' }, render: cube => tr(STATUS_LABELS[cube.status]) },
    { label: { zh: '售价记录', en: 'Price records' }, render: cube => cube.prices.length ? cube.prices.map((price, index) => <PriceQuote key={index} price={price} compact />) : tr(UNKNOWN) },
    { label: { zh: '尺寸 / 净重', en: 'Size / item weight' }, render: cube => <>{specText(cube.specs.size)}<small>{specText(cube.specs.weight)}</small></> },
    { label: { zh: '机制', en: 'Mechanism' }, render: cube => cube.specs.mechanism.length ? cube.specs.mechanism.map(value => tr(MECHANISMS[value] ?? { zh: value, en: value })).join(' · ') : tr(UNKNOWN) },
    { label: { zh: '调节', en: 'Adjustment' }, render: cube => cube.specs.adjustment ? tr(cube.specs.adjustment) : tr(UNKNOWN) },
    { label: { zh: '亮点', en: 'Highlights' }, render: cube => <ul>{cube.highlights.map((item, index) => <li key={index}>{tr(item)}</li>)}</ul> },
    { label: { zh: '评价', en: 'Assessment' }, render: cube => <><span className="ch-badge">{tr(cube.assessment.basis === 'review' ? { zh: '亲历评价', en: 'First-hand' } : { zh: '编辑分析', en: 'Editorial' })}</span><p>{tr(cube.assessment.summary)}</p><p>{tr(cube.assessment.tradeoffs)}</p><ReferenceLinks ids={cube.assessment.sourceIds} /></> },
    { label: { zh: '商家页用户评分', en: 'Merchant-page user rating' }, render: cube => <MerchantRating cube={cube} /> },
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

function AnnualLineup({ brand, onYear, onOpen }: { brand: string; onYear: (year: string) => void; onOpen: (id: string) => void }) {
  const models = brand === 'all' ? [] : CUBES.filter(cube => cube.brand === brand);
  const knownYears = models.flatMap(cube => cube.year === null ? [] : [cube.year]);
  const years = knownYears.length ? Array.from({ length: snapshotYear - Math.min(...knownYears) + 1 }, (_, index) => snapshotYear - index) : [];
  const modelList = (items: Cube[]) => items.length ? <ul className="ch-lineup-models">{sortCubes(items, 'name').map(cube => <li key={cube.id}><button type="button" className="ch-text-button" onClick={() => onOpen(cube.id)}>{tr(cube.name)}</button></li>)}</ul> : <span className="ch-muted">{tr({ zh: '暂未核到记录', en: 'No verified record yet' })}</span>;
  return <details className="ch-annual" data-site-surface="panel">
    <summary className="ch-annual-summary">{tr({ zh: '按年核对产品线', en: 'Explore the annual lineup' })}{brand !== 'all' && <> · {brandName(brand)}</>}</summary>
    {brand === 'all' ? <p className="ch-muted">{tr({ zh: '先在上方选择品牌，就能逐年查看旗舰、其他型号与定位待核的记录。', en: 'Choose a brand above to see its flagships, other models and unclassified entries year by year.' })}</p> : <>
      <p className="ch-muted">{tr({ zh: '年份沿用各记录注明的日期证据；商家收录年份不等于全球首发。空白表示资料缺口，不能据此断言厂商当年没有新品。定位是基于来源的编辑归类。', en: 'Years retain each record’s evidence basis; a retailer listing year is not necessarily a worldwide launch. An empty cell is an evidence gap, not proof that a brand released nothing. Positioning is a source-informed editorial classification.' })}</p>
      <div className="sticky-scroll ch-table-wrap"><table className="sticky-thead ch-table ch-lineup"><caption>{brandName(brand)} · {tr({ zh: '按资料年份列出的型号与独立版本', en: 'Models and distinct versions by documented year' })}</caption><thead><tr><th scope="col">{tr({ zh: '年份', en: 'Year' })}</th><th scope="col">{tr({ zh: '旗舰', en: 'Flagships' })}</th><th scope="col">{tr({ zh: '主流、入门及专门用途', en: 'Mainstream, budget & specialty' })}</th><th scope="col">{tr({ zh: '定位待核', en: 'Unclassified' })}</th></tr></thead><tbody>{years.map(year => {
        const entries = models.filter(cube => cube.year === year);
        return <tr key={year}><th scope="row"><button type="button" className="ch-text-button" onClick={() => onYear(String(year))}>{year}</button></th><td>{modelList(entries.filter(cube => cube.tier === 'flagship'))}</td><td>{modelList(entries.filter(cube => cube.tier && cube.tier !== 'flagship' && cube.tier !== 'unknown'))}</td><td>{modelList(entries.filter(cube => !cube.tier || cube.tier === 'unknown'))}</td></tr>;
      })}{models.some(cube => cube.year === null) && <tr><th scope="row"><button type="button" className="ch-text-button" onClick={() => onYear('unknown')}>{tr({ zh: '年份待核', en: 'Year unknown' })}</button></th><td colSpan={3}>{modelList(models.filter(cube => cube.year === null))}</td></tr>}</tbody></table></div>
    </>}
  </details>;
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
    <details className="ch-annual" data-site-surface="panel"><summary className="ch-annual-summary">{tr({ zh: '各品牌的图片与日期覆盖', en: 'Photo and date coverage by brand' })}</summary><p className="ch-muted">{tr({ zh: '统计只反映当前收录记录的资料情况，不作为全球产品已收齐的证明。', en: 'These counts describe evidence in the current archive; they do not prove that every worldwide product has been recovered.' })}</p><div className="sticky-scroll ch-table-wrap"><table className="sticky-thead ch-table"><thead><tr>{[{ zh: '品牌', en: 'Brand' }, { zh: '记录', en: 'Entries' }, { zh: '附图片', en: 'With photos' }, { zh: '其中共用图', en: 'Shared photos' }, { zh: '官方日期', en: 'Official dates' }, { zh: '年份待核', en: 'Unknown years' }].map(label => <th scope="col" key={label.en}>{tr(label)}</th>)}</tr></thead><tbody>{brandKeys.map(brand => { const entries = CUBES.filter(cube => cube.brand === brand); return <tr key={brand}><th scope="row">{brandName(brand)}</th><td>{entries.length}</td><td>{entries.filter(cube => cube.image).length}</td><td>{entries.filter(cube => cube.image?.match === 'family').length}</td><td>{entries.filter(cube => cube.release.basis === 'official').length}</td><td>{entries.filter(cube => cube.year === null).length}</td></tr>; })}</tbody></table></div></details>
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
  const [view, setView] = useQueryState('view', parseAsStringEnum<View>(['timeline', 'catalog', 'compare', 'sources']).withDefault('catalog').withOptions({ history: 'push' }));
  const [filters, setFilters] = useQueryStates({
    q: parseAsString.withDefault(''),
    brand: parseAsStringEnum(['all', ...brandKeys]).withDefault('all'),
    period: parseAsStringEnum(PERIODS.map(item => item.id)).withDefault('all'),
    category: parseAsStringEnum(['all', ...Object.keys(CATEGORIES)]).withDefault('all'),
    evidence: parseAsStringEnum(Object.keys(EVIDENCE_LABELS)).withDefault('all'),
    technology: parseAsStringEnum(Object.keys(TECHNOLOGIES)).withDefault('all'),
    year: parseAsStringEnum(['all', 'unknown', ...yearKeys]).withDefault('all'),
    tier: parseAsStringEnum(Object.keys(TIERS)).withDefault('all'),
    family: parseAsStringEnum(['all', ...familyRoots.map(cube => cube.id)]).withDefault('all'),
  });
  const [order, setOrder] = useQueryState('order', parseAsStringEnum(['relevance', 'newest', 'oldest', 'name']).withDefault('relevance'));
  const [table, setTable] = useQueryState('table', parseAsBoolean.withDefault(false));
  const [compareIds, setCompareIds] = useQueryState('compare', parseAsArrayOf(parseAsString, ',').withDefault([]));
  const [model, setModel] = useQueryState('model', parseAsString.withOptions({ history: 'push' }));
  const [pageSize, setPageSize] = useState({ key: '', count: 24 });
  const openTrigger = useRef<HTMLElement | null>(null);
  const searchArea = useRef<HTMLDivElement>(null);
  const advancedActive = ADVANCED_FILTERS.some(key => filters[key] !== EMPTY_FILTERS[key]);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(advancedActive);
  const activeCube = model ? CUBES.find(cube => cube.id === resolveCubeId(model)) : undefined;
  const chosen = useMemo(() => selectedCubes(CUBES, compareIds.map(resolveCubeId)), [compareIds]);
  const chosenIds = chosen.map(cube => cube.id);
  const filtered = useMemo(() => sortCubes(CUBES.filter(cube => matchesCube(cube, filters)), order, filters.q), [filters, order]);
  const queryKey = JSON.stringify([filters, order]);
  const visibleCount = pageSize.key === queryKey ? pageSize.count : 24;
  const visible = filtered.slice(0, visibleCount);
  const full = chosen.length >= 4;
  const activeEntries = (Object.entries(filters) as [keyof typeof EMPTY_FILTERS, string][]).filter(([key, value]) => value !== EMPTY_FILTERS[key]);
  const hasFacetFilters = activeEntries.some(([key]) => key !== 'q');
  const unrestrictedCount = useMemo(() => !filtered.length && filters.q.trim() && hasFacetFilters
    ? CUBES.filter(cube => matchesCube(cube, { ...EMPTY_FILTERS, q: filters.q })).length : 0, [filtered.length, filters.q, hasFacetFilters]);
  const { copied, copy } = useCopy();

  const toggleCompare = (id: string) => {
    const next = chosenIds.includes(id) ? chosenIds.filter(value => value !== id) : chosenIds.length < 4 ? [...chosenIds, id] : chosenIds;
    void setCompareIds(next);
  };
  const openModel = (id: string) => {
    openTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (id === model) {
      focusDetailHeading(document.getElementById('ch-detail-title'));
      return;
    }
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
  const setFilter = (key: keyof typeof EMPTY_FILTERS, value: string) => {
    if (key === 'brand') { void setFilters({ brand: value, family: 'all' }); return; }
    void setFilters({ [key]: value });
  };
  const focusSearch = () => {
    searchArea.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    searchArea.current?.querySelector('input')?.focus({ preventScroll: true });
  };
  const availableFamilies = familyRoots.filter(cube => filters.brand === 'all' || cube.brand === filters.brand || cube.id === filters.family);
  const selectedFamily = familyRoots.find(cube => cube.id === filters.family);
  const yearLabel = filters.year === 'all' ? tr({ zh: '所有年份', en: 'All years' }) : filters.year === 'unknown' ? tr({ zh: '年份待核', en: 'Year unknown' }) : filters.year;
  const filterLabel = (key: keyof typeof EMPTY_FILTERS, value: string) => {
    switch (key) {
      case 'q': return tr({ zh: `搜索：${value}`, en: `Search: ${value}` });
      case 'brand': return brandName(value);
      case 'year': return yearLabel;
      case 'family': return selectedFamily ? tr(selectedFamily.name) : value;
      case 'tier': return tr(TIERS[value]);
      case 'period': return tr(PERIODS.find(period => period.id === value)!.label);
      case 'category': return tr(CATEGORIES[value]);
      case 'technology': return tr(TECHNOLOGIES[value]);
      case 'evidence': return tr(EVIDENCE_LABELS[value]);
    }
  };
  const relatedBrands = Object.entries(BRAND_FEATURES).find(([brand, feature]) => brand === filters.brand || feature.related.includes(filters.brand));
  const relevanceLabel = tr(filters.q.trim() ? SORT_LABELS.relevance : { zh: '默认 · 由新到旧', en: 'Default · newest first' });
  const sortLabel = order === 'relevance' ? relevanceLabel : tr(SORT_LABELS[order]);

  return <div id="ch-explorer" className="ch-explorer">
    <nav className="ch-tabs" aria-label={tr({ zh: '档案视图', en: 'Archive view' })}>{VIEW_OPTIONS.map(({ id, label, Icon }) => <button type="button" key={id} aria-pressed={view === id} className={`ch-tab-button${view === id ? ' is-active' : ''}`} onClick={() => navigateView(id)}><Icon size={17} />{tr(label)}</button>)}</nav>
    {activeCube && <CubeDetails cube={activeCube} selected={chosenIds.includes(activeCube.id)} full={full} onToggle={toggleCompare} onClose={closeModel} onOpen={openModel} />}
    {model && !activeCube && <div role="status" className="ch-empty" data-site-surface="panel"><p>{tr({ zh: '该型号链接未匹配到当前资料。', en: 'This model link does not match the current archive.' })}</p><button type="button" className="ch-button" onClick={closeModel}>{tr({ zh: '关闭', en: 'Close' })}</button></div>}
    {view === 'timeline' && <Timeline onOpen={openModel} onPeriod={selectPeriod} />}
    {view === 'catalog' && <section aria-labelledby="ch-catalog-heading">
      <div className="ch-section-heading"><div><p className="ch-eyebrow">{tr({ zh: '从一款魔方，读懂一个时代', en: 'Find a cube. Discover its era.' })}</p><h2 id="ch-catalog-heading">{tr({ zh: '型号图鉴', en: 'Model catalog' })}</h2></div><div className="ch-catalog-actions"><button type="button" className="ch-button" onClick={download}><Download size={15} />{tr({ zh: '下载当前资料', en: 'Export results' })}</button><button type="button" className="ch-button" onClick={() => copy(window.location.href)}>{copied ? <Check size={15} /> : <Link2 size={15} />}{tr(copied ? { zh: '已复制', en: 'Copied' } : { zh: '分享筛选', en: 'Share filters' })}</button></div></div>
      <div className="ch-filter-panel" data-site-surface="panel" ref={searchArea}>
        <div className="ch-search-heading"><strong>{tr({ zh: '找到你想了解的那一款', en: 'Find the model you have in mind' })}</strong><span>{tr({ zh: '中文 · 英文 · 型号别名', en: 'Chinese · English · Model aliases' })}</span></div>
        <div className="ch-search-field"><Search size={21} aria-hidden="true" /><SearchInput value={filters.q} onChange={value => setFilter('q', value)} debounceMs={150} maxLength={160} type="search" ariaLabel={tr({ zh: '搜索魔方型号、品牌或别名', en: 'Search cube models, brands or aliases' })} placeholder={tr({ zh: '搜索型号、品牌或别名', en: 'Search a model, brand or alias' })} className="ch-search" inputClassName="ch-model-search-input" autoComplete="off" spellCheck={false} /></div>
        <div className="ch-search-examples"><span>{tr({ zh: '试试', en: 'Try' })}</span>{[{ zh: 'GAN 12 UV', en: 'GAN 12 UV' }, { zh: '威龙 V11', en: 'WeiLong V11' }, { zh: '风四代', en: 'Tornado V4' }].map(example => <button type="button" key={example.en} className="ch-text-button" onClick={() => { void setFilters({ ...EMPTY_FILTERS, q: tr(example) }); void setOrder('relevance'); }}>{tr(example)}<ArrowUpRight size={11} /></button>)}</div>
        <div className="ch-brand-shortcuts" role="group" aria-label={tr({ zh: '重点品牌快捷筛选', en: 'Featured brand filters' })}>{PRIORITY_BRANDS.map(brand => <BrandShortcut key={brand} brand={brand} selected={filters.brand === brand} onSelect={value => setFilter('brand', value)} />)}</div>
        <div className="ch-filter-row ch-primary-filters">
          <CompactSelect className="ch-filter-select" label={filters.brand === 'all' ? tr({ zh: '所有品牌', en: 'All brands' }) : brandName(filters.brand)} valueText={filters.brand === 'all' ? tr({ zh: '所有品牌', en: 'All brands' }) : brandName(filters.brand)} ariaLabel={tr({ zh: '按品牌筛选', en: 'Filter by brand' })} value={filters.brand} onChange={value => setFilter('brand', value)} items={[{ value: 'all', label: tr({ zh: '所有品牌', en: 'All brands' }) }, ...brandKeys.map(value => ({ value, label: brandName(value) }))]} />
          <CompactSelect className="ch-filter-select ch-family-select" label={selectedFamily ? tr(selectedFamily.name) : tr({ zh: '所有系列', en: 'All families' })} valueText={selectedFamily ? tr(selectedFamily.name) : tr({ zh: '所有系列', en: 'All families' })} title={selectedFamily ? tr(selectedFamily.name) : undefined} ariaLabel={tr({ zh: '查看同系列子型号', en: 'Filter by model family' })} value={filters.family} onChange={value => setFilter('family', value)} items={[{ value: 'all', label: tr({ zh: '所有系列', en: 'All families' }) }, ...availableFamilies.map(cube => ({ value: cube.id, label: tr(cube.name) }))]} />
          <CompactSelect className="ch-filter-select" label={yearLabel} valueText={yearLabel} ariaLabel={tr({ zh: '按具体年份筛选', en: 'Filter by year' })} value={filters.year} onChange={value => setFilter('year', value)} items={[{ value: 'all', label: tr({ zh: '所有年份', en: 'All years' }) }, ...yearKeys.map(value => ({ value, label: value })), { value: 'unknown', label: tr({ zh: '年份待核', en: 'Year unknown' }) }]} />
          <CompactSelect className="ch-filter-select" label={tr(TIERS[filters.tier])} valueText={tr(TIERS[filters.tier])} ariaLabel={tr({ zh: '按产品定位筛选', en: 'Filter by positioning' })} value={filters.tier} onChange={value => setFilter('tier', value)} items={Object.entries(TIERS).map(([value, label]) => ({ value, label: tr(label) }))} />
        </div>
        {relatedBrands && relatedBrands[1].related.length > 0 && <div className="ch-related-brands"><span>{tr({ zh: '相关品牌与系列', en: 'Related brands & lines' })}</span>{[relatedBrands[0], ...relatedBrands[1].related].filter(brand => brand !== filters.brand).map(brand => <button type="button" key={brand} className="ch-text-button" onClick={() => setFilter('brand', brand)}>{brandName(brand)}<ArrowUpRight size={11} /></button>)}</div>}
        <details className="ch-advanced-filters" open={moreFiltersOpen} onToggle={event => setMoreFiltersOpen(event.currentTarget.open)}>
          <summary className="ch-advanced-summary"><SlidersHorizontal size={15} /><span>{tr({ zh: '更多筛选', en: 'More filters' })}</span>{advancedActive && <span className="ch-advanced-applied">{tr({ zh: '已应用', en: 'Applied' })}</span>}<ChevronDown size={15} /></summary>
          <div className="ch-filter-row ch-advanced-row">
          <CompactSelect label={tr(PERIODS.find(item => item.id === filters.period)!.label)} valueText={tr(PERIODS.find(item => item.id === filters.period)!.label)} ariaLabel={tr({ zh: '按年代筛选', en: 'Filter by era' })} value={filters.period} onChange={value => setFilter('period', value)} items={PERIODS.map(period => ({ value: period.id, label: tr(period.label) }))} />
          <CompactSelect label={filters.category === 'all' ? tr({ zh: '所有类型', en: 'All categories' }) : tr(CATEGORIES[filters.category])} valueText={filters.category === 'all' ? tr({ zh: '所有类型', en: 'All categories' }) : tr(CATEGORIES[filters.category])} ariaLabel={tr({ zh: '按类型筛选', en: 'Filter by category' })} value={filters.category} onChange={value => setFilter('category', value)} items={[{ value: 'all', label: tr({ zh: '所有类型', en: 'All categories' }) }, ...Object.entries(CATEGORIES).map(([value, label]) => ({ value, label: tr(label) }))]} />
          <CompactSelect label={tr(TECHNOLOGIES[filters.technology])} valueText={tr(TECHNOLOGIES[filters.technology])} ariaLabel={tr({ zh: '按技术筛选', en: 'Filter by technology' })} value={filters.technology} onChange={value => setFilter('technology', value)} items={Object.entries(TECHNOLOGIES).map(([value, label]) => ({ value, label: tr(label) }))} />
          <CompactSelect label={tr(EVIDENCE_LABELS[filters.evidence])} valueText={tr(EVIDENCE_LABELS[filters.evidence])} ariaLabel={tr({ zh: '按资料完整性筛选', en: 'Filter by evidence' })} value={filters.evidence} onChange={value => setFilter('evidence', value)} items={Object.entries(EVIDENCE_LABELS).map(([value, label]) => ({ value, label: tr(label) }))} />
          </div>
        </details>
        {activeEntries.length > 0 && <div className="ch-active-filters" aria-label={tr({ zh: '正在使用的筛选', en: 'Active filters' })}>{activeEntries.map(([key, value]) => <span className="ch-active-filter" key={key}><span title={filterLabel(key, value)}>{filterLabel(key, value)}</span><ClearButton variant="standalone" onClick={() => setFilter(key, EMPTY_FILTERS[key])} ariaLabel={tr({ zh: `移除筛选：${filterLabel(key, value)}`, en: `Remove filter: ${filterLabel(key, value)}` })} /></span>)}<span className="ch-clear-all"><span>{tr({ zh: '清除全部', en: 'Clear all' })}</span><ClearButton variant="standalone" onClick={() => { void setFilters(EMPTY_FILTERS); }} ariaLabel={tr({ zh: '清除全部筛选', en: 'Clear all filters' })} /></span></div>}
      </div>
      <AnnualLineup brand={filters.brand} onYear={year => { void setFilters({ ...EMPTY_FILTERS, brand: filters.brand, year }); }} onOpen={openModel} />
      <div className="ch-result-bar"><p role="status" aria-live="polite"><strong>{filtered.length}</strong> {tr({ zh: '条匹配记录', en: 'matching entries' })}<span>{tr({ zh: `已显示 ${visible.length} 条 · 检索全部 ${CUBES.length} 条档案`, en: `${visible.length} shown · Searching all ${CUBES.length} records` })}</span></p><div><CompactSelect label={sortLabel} valueText={sortLabel} value={order} onChange={value => { void setOrder(value as typeof order); }} ariaLabel={tr({ zh: '排序方式', en: 'Sort order' })} items={[
        { value: 'relevance', label: relevanceLabel }, { value: 'newest', label: tr(SORT_LABELS.newest) }, { value: 'oldest', label: tr(SORT_LABELS.oldest) }, { value: 'name', label: tr(SORT_LABELS.name) },
      ]} /><PillToggle value={!table} onChange={value => { void setTable(!value); }} onLabel={tr({ zh: '卡片', en: 'Cards' })} offLabel={tr({ zh: '表格', en: 'Table' })} ariaLabel={tr({ zh: '图鉴布局', en: 'Catalog layout' })} /></div></div>
      {!filtered.length ? <div className="ch-empty" data-site-surface="panel"><Search size={32} /><h3>{tr({ zh: '没有找到匹配型号', en: 'No matching models' })}</h3><p>{tr(unrestrictedCount > 0 ? { zh: `全部档案中有 ${unrestrictedCount} 条符合这个关键词的记录，可移除其他筛选继续查看。`, en: `${unrestrictedCount} records across the archive match this search. Remove the other filters to see them.` } : { zh: '试试更短的型号名称、中英文别名，或减少筛选条件。', en: 'Try a shorter model name, a Chinese or English alias, or fewer filters.' })}</p><div className="ch-empty-actions">{hasFacetFilters && <button type="button" className="ch-button ch-button--primary" onClick={() => { void setFilters({ ...EMPTY_FILTERS, q: filters.q }); }}>{tr({ zh: '移除其他筛选', en: 'Remove other filters' })}</button>}<button type="button" className="ch-button" onClick={focusSearch}>{tr({ zh: '修改搜索词', en: 'Edit search' })}</button></div></div>
        : table ? <CatalogTable cubes={visible} ids={chosenIds} full={full} onOpen={openModel} onToggle={toggleCompare} />
          : <div className="ch-model-grid">{visible.map(cube => <ModelCard key={cube.id} cube={cube} selected={chosenIds.includes(cube.id)} full={full} onOpen={openModel} onToggle={toggleCompare} />)}</div>}
      {visible.length < filtered.length && <div className="ch-load-more"><button type="button" className="ch-button" onClick={() => setPageSize({ key: queryKey, count: visibleCount + 24 })}>{tr({ zh: '继续查看型号', en: 'Show more models' })}<ChevronDown size={16} /></button><button type="button" className="ch-text-button" onClick={() => setPageSize({ key: queryKey, count: filtered.length })}>{tr({ zh: '展开全部', en: 'Show all' })}</button><span>{visible.length} / {filtered.length}</span><button type="button" className="ch-text-button" onClick={focusSearch}><Search size={14} />{tr({ zh: '回到搜索', en: 'Back to search' })}</button></div>}
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
