'use client';

/**
 * 排名 — /wca/all-results
 * 同一条事件选择器,按「选中项目数」驱动两种视图:
 *   选 1 项  → 单项排名(show=results 每条成绩 / show=persons 每选手年末累积最佳;截至/当期口径)
 *   选 2+ 项 → 名次和(把所选项目的世界/国家排名相加;含查选手最优组合 + 名人堂 + 排名演化)
 * 交互(累加):点事件 = 加入/取消对比(留 1 项回单项);分类快选替换整组;清除 → 空。
 * 合并自原 /wca/sum-of-ranks(已整页并入,旧路由弃用)。
 */
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { UnofficialMark } from '@/components/UnofficialMark';
import dynamic from 'next/dynamic';
import { useQueryStates, parseAsString } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, HelpCircle, ChevronDown, ChevronRight } from 'lucide-react';
import Paginator from '@/components/wca-stats/Paginator';
import WcaEventSelector from '@/components/WcaEventSelector';
import { Flag } from '@/components/Flag';
import { loadFlagData } from '@/lib/country-flags';
import { CompCell } from '@/components/CompCell/CompCell';
import { ClearButton } from '@/components/ClearButton';
import { formatWcaResult } from '@/lib/wca-format-result';
import { displayCuberName } from '@/lib/cuber-name-display';
import { RecordBadge } from '@/components/RecordBadge';
import { apiUrl } from '@/lib/api-base';
import { compLinkProps } from '@/lib/comp-link';
import CountrySelect, { useCountries } from '@/components/wca-stats/CountrySelect';
import ShowToggle, { type ShowMode } from '@/components/wca-stats/ShowToggle';
import { EventIcon } from '@/components/EventIcon';
import PillToggle from '@/components/PillToggle/PillToggle';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../_wca_stats_extra.css';
import { tr } from '@/i18n/tr';
import '@/i18n/i18n-client';

// echarts-for-react / SorRace 仅客户端,名次和的名人堂时间线 + 排名演化用,懒挂.
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });
const SorRace = dynamic(() => import('@/components/wca-stats/SorRace'), { ssr: false });

const ACTIVE_EVENTS = [
  '333','222','444','555','666','777',
  '333bf','333fm','333oh',
  'minx','pyram','clock','skewb','sq1',
  '444bf','555bf','333mbf',
];
// 4 个废止项(脚拧/八板/十二板/旧多盲)作可勾选额外项,默认不选.顺序须与 server RANK_EVENTS 一致.
const CANCELLED_EVENTS = ['333ft', 'magic', 'mmagic', '333mbo'];
const RANK_EVENTS = [...ACTIVE_EVENTS, ...CANCELLED_EVENTS];
const RANK_EVENT_SET = new Set(RANK_EVENTS);
const ACTIVE_EVENT_SET = new Set(ACTIVE_EVENTS);
const PAGE_SIZE_OPTIONS = [50, 100, 200];

// 项目快速分类(点一个 = 直接替换当前选中项,进入名次和)
const EVENT_CATEGORIES: { key: string; zh: string; en: string; events: string[]; }[] = [
  { key: 'speed', zh: '速拧', en: 'Speed', events: ['333','222','444','555','666','777','333oh','clock','minx','pyram','skewb','sq1'] },
  { key: 'quiet', zh: '安静', en: 'Quiet', events: ['333bf','333fm','444bf','555bf','333mbf'] },
  { key: 'blind', zh: '盲拧', en: 'Blind', events: ['333bf','444bf','555bf','333mbf'] },
  { key: 'cubic', zh: '正阶', en: 'Cubic', events: ['333','222','444','555','666','777','333oh'] },
  { key: 'sub25', zh: '二至五阶', en: '2-5', events: ['222','333','444','555'] },
  { key: 'shape', zh: '异形', en: 'Other', events: ['clock','minx','pyram','skewb','sq1'] },
];

// ---- 单项视图行 ----
interface ResultRow {
  rank: number; value: number; wcaId: string; name: string;
  countryId: string; iso2: string | null;
  compId: string; compName: string | null; compDate: string | null;
  attempts: number[];
  record: string | null;
}
interface PersonRow {
  rank: number; wcaId: string; name: string;
  value: number | null;
  countryId: string; iso2: string | null;
  compId: string | null; compName: string | null; compDate: string | null;
  attempts: number[];
}
type SingleData =
  | { mode: 'results'; rows: ResultRow[]; total: number }
  | { mode: 'persons'; rows: PersonRow[]; total: number };

// ---- 名次和视图行 ----
interface SorRow {
  wcaId: string; name: string;
  countryId: string; iso2: string | null;
  eventsDone: number;
  totalWorldRank?: number;
  totalCountryRank?: number;
  subsetTotal?: number;
  ranks: number[];
  bestRank?: number | null;
  bestYear?: number | null;
  bestTotal?: number | null;
}
interface CensusRow { rank: number; wcaId: string; name: string; iso2: string | null; subsetsWon: number; }
interface Census { type: string; inclCancelled: boolean; noPodium?: boolean; year: number | null; years: number[]; distinct: number; totalSubsets: number; rows: CensusRow[]; }
interface TimelinePoint { year: number; distinct: number; }

function AllResultsPageInner() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const personHref = (id: string) => `/${(i18n.language.startsWith('zh') ? 'zh' : 'en')}/wca/persons/${id}`;
  useDocumentTitle('排名', 'Rankings');

  const [query, setQuery] = useQueryStates(
    {
      events: parseAsString,    // 逗号串;null=默认 333;'__none__'=空
      type: parseAsString,
      country: parseAsString,
      show: parseAsString,      // 单项:results / persons
      year: parseAsString,
      month: parseAsString,
      q: parseAsString,
      basis: parseAsString,
      hidePodium: parseAsString, // 名次和:未登领奖台
      page: parseAsString,
      size: parseAsString,
    },
    { history: 'replace', scroll: false },
  );

  // ---- 选中项目 → 模式 ----
  const selectedSet: Set<string> = useMemo(() => {
    if (query.events == null) return new Set(['333']);
    if (query.events === 'all') return new Set(ACTIVE_EVENTS);   // 短哨兵:17 活跃项(名次和默认入口)
    if (query.events === '__none__') return new Set();
    return new Set(query.events.split(',').filter(Boolean));
  }, [query.events]);
  const selectedCount = RANK_EVENTS.filter(e => selectedSet.has(e)).length;
  const mode: 'single' | 'sor' | 'empty' =
    selectedSet.size === 0 ? 'empty' : selectedSet.size === 1 ? 'single' : 'sor';
  const singleEvent = mode === 'single' ? [...selectedSet][0]! : '333';
  const includeCancelled = CANCELLED_EVENTS.some(e => selectedSet.has(e));
  // 名次和搜索子集:恰为 17 活跃项 → 走 server 快路径(省略 events,带历史最佳列);否则发显式列表.
  const isActive17 = selectedSet.size === ACTIVE_EVENTS.length && ACTIVE_EVENTS.every(e => selectedSet.has(e));
  const sorEventsParam = isActive17 ? '' : RANK_EVENTS.filter(e => selectedSet.has(e)).join(',');

  // 共享 / 单项参数
  const type = (query.type ?? 'single') as 'single' | 'average';
  const country = query.country ?? '';
  const show: ShowMode = (query.show === 'persons') ? 'persons' : 'results';
  const currentYear = new Date().getUTCFullYear();
  const yearRaw = parseInt(query.year ?? '0', 10);
  const year = show === 'persons' && yearRaw === 0 ? currentYear : yearRaw;
  const month = parseInt(query.month ?? '0', 10);
  const qFromUrl = query.q ?? '';
  const page = parseInt(query.page ?? '1', 10);
  const size = parseInt(query.size ?? '100', 10);
  const hidePodium = query.hidePodium === '1';
  const basisRaw = query.basis;
  const basis: 'period' | 'cumulative' =
    basisRaw === 'cumulative' || basisRaw === 'period'
      ? basisRaw
      : (show === 'persons' ? 'cumulative' : 'period');
  // 多盲平均 = 非官方 Mo3(builder 现算进 wca_results_flat),单项可排;名次和不计入
  const isMbldAvg = singleEvent === '333mbf';
  const effType: 'single' | 'average' = type === 'average' ? 'average' : 'single';

  // ---- 事件选择(累加) ----
  const serializeEvents = (set: Set<string>): string => {
    if (set.size === 0) return '__none__';
    if (set.size === ACTIVE_EVENTS.length && ACTIVE_EVENTS.every(e => set.has(e))) return 'all'; // 全选折叠成短哨兵
    return RANK_EVENTS.filter(e => set.has(e)).join(',');
  };
  const toggleEvent = (ev: string) => {
    const cur = new Set(selectedSet);
    if (cur.has(ev)) cur.delete(ev); else cur.add(ev);  // 可减到 0 → 空态(全灰),再点又选上
    setQuery({ events: serializeEvents(cur), page: null });
  };
  const setEventsSet = (events: string[]) => setQuery({ events: serializeEvents(new Set(events)), page: null });
  const selectAll = () => setEventsSet(ACTIVE_EVENTS);
  const clearAll = () => setQuery({ events: '__none__', page: null });
  const onToggleCancelled = (on: boolean) => {
    const cur = new Set(selectedSet);
    if (on) CANCELLED_EVENTS.forEach(e => cur.add(e)); else CANCELLED_EVENTS.forEach(e => cur.delete(e));
    setEventsSet([...cur]);
  };
  const activeCategory = EVENT_CATEGORIES.find(
    c => c.events.length === selectedSet.size && c.events.every(e => selectedSet.has(e)),
  )?.key;

  // 单项控件
  const update = (k: string, v: string, resetPage = true) => {
    const patch: Record<string, string | null> = { [k]: v || null };
    if (resetPage) patch.page = null;
    setQuery(patch as Parameters<typeof setQuery>[0]);
  };
  const handleBasisChange = (v: 'period' | 'cumulative') => {
    setQuery({ basis: v, ...(v === 'cumulative' ? { month: null } : {}), page: null });
  };
  const handleShowChange = (v: ShowMode) => {
    if (v === 'persons') {
      const keepYear = query.year && query.year !== '0';
      setQuery({ show: 'persons', month: null, q: null, ...(keepYear ? {} : { year: String(currentYear) }), page: null });
    } else {
      setQuery({ show: null, page: null });
    }
  };

  const [qInput, setQInput] = useState(qFromUrl);
  useEffect(() => { setQInput(qFromUrl); }, [qFromUrl]);
  useEffect(() => {
    if (mode !== 'single' || show !== 'results') return;
    if (qInput === qFromUrl) return;
    const t = setTimeout(() => { setQuery({ q: qInput || null, page: null }); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput, qFromUrl, show, mode]);

  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = currentYear; y >= 2003; y--) ys.push(y);
    return ys;
  }, [currentYear]);

  const [data, setData] = useState<SingleData | null>(null);
  const [sorData, setSorData] = useState<{ rows: SorRow[]; total: number; events: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setFlagBust] = useState(0);
  const countries = useCountries();
  useEffect(() => { loadFlagData().then(v => setFlagBust(v)); }, []);

  // 单项数据
  useEffect(() => {
    if (mode !== 'single') return;
    setLoading(true); setError(null);
    const qs = new URLSearchParams();
    qs.set('event', singleEvent);
    qs.set('type', effType);
    qs.set('page', String(page));
    qs.set('size', String(size));
    if (country) qs.set('country', country);
    if (show === 'persons' && basis === 'cumulative') {
      qs.set('year', String(year));
      fetch(apiUrl(`/v1/wca/historical-ranks?${qs.toString()}`))
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((j: { rows: PersonRow[]; total: number }) => setData({ mode: 'persons', rows: j.rows, total: j.total }))
        .catch(e => setError(e.message)).finally(() => setLoading(false));
    } else if (show === 'persons') {
      qs.set('group', 'person'); qs.set('basis', 'period'); qs.set('year', String(year));
      if (month > 0) qs.set('month', String(month));
      fetch(apiUrl(`/v1/wca/all-results?${qs.toString()}`))
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((j: { rows: PersonRow[]; total: number }) => setData({ mode: 'persons', rows: j.rows, total: j.total }))
        .catch(e => setError(e.message)).finally(() => setLoading(false));
    } else {
      qs.set('basis', basis);
      if (year > 0) qs.set('year', String(year));
      if (basis === 'period' && month > 0) qs.set('month', String(month));
      if (qFromUrl) qs.set('q', qFromUrl);
      fetch(apiUrl(`/v1/wca/all-results?${qs.toString()}`))
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((j: { rows: ResultRow[]; total: number }) => setData({ mode: 'results', rows: j.rows, total: j.total }))
        .catch(e => setError(e.message)).finally(() => setLoading(false));
    }
  }, [mode, show, basis, singleEvent, effType, country, year, month, qFromUrl, page, size]);

  // 名次和数据
  useEffect(() => {
    if (mode !== 'sor') return;
    setLoading(true); setError(null);
    const qs = new URLSearchParams();
    qs.set('type', type);
    qs.set('page', String(page));
    qs.set('size', String(size));
    if (country) qs.set('country', country);
    if (sorEventsParam) qs.set('events', sorEventsParam);
    if (hidePodium) qs.set('hidePodium', '1');
    qs.set('v', '3');
    fetch(apiUrl(`/v1/wca/sum-of-ranks?${qs.toString()}`))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setSorData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [mode, type, country, sorEventsParam, hidePodium, page, size]);

  // ---- 名次和工具:名人堂 + 排名演化 ----
  const [raceOpen, setRaceOpen] = useState(false);
  const [census, setCensus] = useState<Census | null>(null);
  const [censusOpen, setCensusOpen] = useState(false);
  const [censusExpanded, setCensusExpanded] = useState(false);
  const [censusYear, setCensusYear] = useState<number | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[] | null>(null);
  useEffect(() => {
    if (!censusOpen) return;
    setCensus(null); setCensusExpanded(false);
    const qs = new URLSearchParams({ type, v: '3' });
    if (includeCancelled) qs.set('cancelled', '1');
    if (hidePodium) qs.set('no_podium', '1');
    if (censusYear != null) qs.set('year', String(censusYear));
    fetch(apiUrl(`/v1/wca/sum-of-ranks/census?${qs.toString()}`))
      .then(r => (r.ok ? r.json() : null)).then(setCensus).catch(() => {});
  }, [censusOpen, type, includeCancelled, hidePodium, censusYear]);
  useEffect(() => {
    if (!censusOpen || hidePodium) { setTimeline(null); return; }
    const qs = new URLSearchParams({ type, timeline: '1' });
    if (includeCancelled) qs.set('cancelled', '1');
    fetch(apiUrl(`/v1/wca/sum-of-ranks/census?${qs.toString()}`))
      .then(r => (r.ok ? r.json() : null)).then(d => setTimeline(d?.points ?? null)).catch(() => {});
  }, [censusOpen, type, includeCancelled, hidePodium]);

  const totalPages = (d: { total: number } | null) => d ? Math.max(1, Math.ceil(d.total / size)) : 1;
  const isCountryMode = !!country;
  const showBest = !!sorData && sorData.rows.length > 0 && 'bestRank' in sorData.rows[0]!;
  const selYear = census?.year ?? null;
  const censusYearLabel = census ? (census.year ?? census.years?.[census.years.length - 1] ?? null) : null;
  const chartOption = useMemo(() => {
    if (!timeline || timeline.length === 0) return null;
    const css = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
    const tok = (name: string, fallback: string) => (css?.getPropertyValue(name).trim() || fallback);
    const accent = tok('--accent', '#d97757');
    const fg = tok('--muted-foreground', '#a8a29e');
    const grid = tok('--border-default', '#44403c');
    return {
      grid: { left: 6, right: 14, top: 16, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis' as const,
        formatter: (ps: Array<{ axisValue: string; data: number }>) =>
          `${ps[0]!.axisValue}<br/>${tr({ zh: '人数', en: 'cubers' })}: <b>${ps[0]!.data}</b>`,
      },
      xAxis: {
        type: 'category' as const,
        data: timeline.map(p => p.year),
        axisLabel: { color: fg, fontSize: 10 },
        axisLine: { lineStyle: { color: grid } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value' as const, minInterval: 1,
        axisLabel: { color: fg, fontSize: 10 },
        splitLine: { lineStyle: { color: grid, opacity: 0.4 } },
      },
      series: [{
        type: 'line' as const,
        data: timeline.map(p => p.distinct),
        smooth: true, symbol: 'circle' as const,
        symbolSize: (_v: number, p: { dataIndex: number }) => (timeline[p.dataIndex]!.year === selYear ? 10 : 4),
        itemStyle: { color: accent },
        lineStyle: { color: accent, width: 2 },
        areaStyle: { color: accent, opacity: 0.12 },
      }],
    };
  }, [timeline, selYear]);
  const onChartEvents = useMemo(() => ({
    click: (p: { dataIndex?: number }) => {
      if (timeline && p.dataIndex != null) setCensusYear(timeline[p.dataIndex]!.year);
    },
  }), [timeline]);

  const subtitle = mode === 'empty'
    ? tr({ zh: '请至少选择一个项目', en: 'Select at least one event' })
    : mode === 'sor'
      ? tr({ zh: '把所选项目的(世界 / 国家)排名相加;缺项以该项目「参赛人数+1」(比倒数第一再差一名)计入。「未登领奖台」按比赛决赛(final round)实际名次过滤', en: 'Sum of (world / country) ranks across selected events; missing events default to "participants+1" (one worse than last). "No podium" filters by actual final-round position' })
      : (show === 'persons'
          ? (basis === 'cumulative'
              ? tr({ zh: '截至所选年末的累积最佳排名(全球 / 单国家)', en: 'Ranking by best up to end of the selected year (worldwide / by country)' })
              : tr({ zh: '仅所选年(或月)内取得的最佳排名(全球 / 单国家)', en: 'Ranking by best within the selected year (or month)' }))
          : (basis === 'cumulative'
              ? tr({ zh: '截至所选年末的全部 valid 成绩,按值升序', en: 'All valid results up to end of the selected year, sorted by value' })
              : tr({ zh: '所选年 / 月内的全部 valid 成绩,按值升序;可叠加国家 / 选手或比赛搜索', en: 'All valid results within the selected year / month, sorted by value' })));

  const eventsLabel = isZh ? `项目(已选 ${selectedCount} / ${RANK_EVENTS.length})` : `Events (${selectedCount}/${RANK_EVENTS.length} selected)`;

  return (
    <div className="wse-page">
      <header className="wse-header">
        <div className="wse-header-row">
          <Link href={`/wca?lang=${i18n.language}`} className="wse-back"><ChevronLeft size={16} /> {tr({ zh: '返回', en: 'Back' })}</Link>
        </div>
        <h1 className="wse-title-row">
          {tr({ zh: '排名', en: 'Rankings' })}
          <Link
            href={mode === 'sor' ? '/wca/about/sum-of-ranks' : '/wca/about/all-results'}
            className="wse-title-help"
            title={tr({ zh: '这页是干啥的?', en: 'What is this page?' })}
            aria-label={tr({ zh: '查看说明', en: 'About this page' })}
          >
            <HelpCircle size={18} strokeWidth={1.75} />
          </Link>
        </h1>
        <p className="wse-subtitle">{subtitle}</p>
      </header>

      {/* 名次和:排名演化 race(世界 / 大洲 / 国家),懒挂 */}
      {mode === 'sor' && (
        <div className="sor-census" style={{ marginBottom: 16 }}>
          <button type="button" className="sor-census-toggle" onClick={() => setRaceOpen(o => !o)} aria-expanded={raceOpen}>
            {raceOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            {tr({ zh: 'SOR 排名演化(世界 / 大洲 / 国家)', en: 'SOR over time (World / Continent / Country)' })}
          </button>
          {raceOpen && <SorRace />}
        </div>
      )}

      {/* 项目选择(共用):分类快选 + 多选事件条 */}
      <div className="wse-filters">
        <div className="wse-filter" style={{ minWidth: '100%' }}>
          <label>{eventsLabel}</label>
          <div className="wse-events-bar">
            <button type="button" onClick={selectAll}>{tr({ zh: '全选', en: 'All' })}</button>
            <button type="button" onClick={clearAll}>{tr({ zh: '清除', en: 'None' })}</button>
            {EVENT_CATEGORIES.map(cat => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setEventsSet(cat.events)}
                className={activeCategory === cat.key ? 'wse-cat-on' : undefined}
              >
                {(i18n.language.startsWith('zh') ? cat.zh : cat.en)}
              </button>
            ))}
            <PillToggle
              className="wse-pill"
              value={includeCancelled}
              onChange={onToggleCancelled}
              onLabel={tr({ zh: '废止项', en: 'Cancelled' })}
              offLabel={tr({ zh: '废止项', en: 'Cancelled' })}
            />
          </div>
          <WcaEventSelector
            availableEvents={includeCancelled ? RANK_EVENT_SET : ACTIVE_EVENT_SET}
            selectedEvents={selectedSet}
            onToggle={toggleEvent}
            isZh={isZh}
            onlyAvailable
          />
        </div>
      </div>

      {/* 状态条:已选项目数 + 模式标签 */}
      {mode !== 'empty' && (
        <div className="wse-mode-status">
          {isZh ? `已选 ${selectedSet.size} 项` : `${selectedSet.size} selected`}
          <span className={`wse-mode-chip ${mode}`}>
            {mode === 'sor'
              ? tr({ zh: '名次和', en: 'Sum of Ranks' })
              : tr({ zh: '单项', en: 'Single event' })}
          </span>
        </div>
      )}

      {mode === 'empty' && (
        <div className="wse-table-wrapper">
          <div className="wse-state">{tr({ zh: '请至少选择一个项目', en: 'Select at least one event' })}</div>
        </div>
      )}

      {/* ============ 单项 ============ */}
      {mode === 'single' && (
        <>
          <div className="wse-filters">
            <div className="wse-filter wse-filter-show">
              <label>{tr({ zh: '显示', en: 'Show' })}</label>
              <ShowToggle value={show} onChange={handleShowChange} isZh={isZh} />
            </div>
            <div className="wse-filter">
              <label>{tr({ zh: '类型', en: 'Type' })}</label>
              <select value={effType} onChange={e => update('type', e.target.value)}>
                <option value="single">{tr({ zh: '单次', en: 'Single' })}</option>
                <option value="average">{tr({ zh: '平均', en: 'Average' })}</option>
              </select>
            </div>
            <CountrySelect countries={countries} value={country} isZh={isZh} onChange={v => update('country', v)} />
            <div className="wse-filter wse-filter-show">
              <label>{tr({ zh: '口径', en: 'Basis' })}</label>
              <div className="wse-show-toggle">
                <button type="button" className={basis === 'cumulative' ? 'active' : ''} onClick={() => handleBasisChange('cumulative')}>{tr({ zh: '截至', en: 'Cumulative' })}</button>
                <button type="button" className={basis === 'period' ? 'active' : ''} onClick={() => handleBasisChange('period')}>{tr({ zh: '当期', en: 'Period' })}</button>
              </div>
            </div>
            <div className="wse-filter">
              <label>{tr({ zh: '年份', en: 'Year' })}</label>
              <select value={year} onChange={e => update('year', e.target.value === '0' ? '' : e.target.value)}>
                {show === 'results' && <option value={0}>{tr({ zh: '全部年份', en: 'All years' })}</option>}
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="wse-filter">
              <label>{tr({ zh: '月份', en: 'Month' })}</label>
              <select
                value={basis === 'cumulative' ? 0 : month}
                disabled={basis === 'cumulative'}
                title={basis === 'cumulative' ? tr({ zh: '截至口径按年末,不分月', en: 'Cumulative basis is year-end; month not applicable' }) : undefined}
                onChange={e => update('month', e.target.value === '0' ? '' : e.target.value)}
              >
                <option value={0}>{tr({ zh: '全年', en: 'All months' })}</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {show === 'results' && (
              <div className="wse-filter wse-filter-q">
                <label>{tr({ zh: '搜索', en: 'Search' })}</label>
                <div className="wse-q-wrap">
                  <input type="search" value={qInput} onChange={e => setQInput(e.target.value)} placeholder={tr({ zh: '选手或比赛名', en: 'Person or competition' })} />
                  {qInput && <ClearButton onClick={() => { setQInput(''); update('q', ''); }} isZh={isZh} preserveFocus />}
                </div>
              </div>
            )}
          </div>

          <div className="wse-table-wrapper">
            {loading && <div className="wse-state">{tr({ zh: '加载中...', en: 'Loading...' })}</div>}
            {error && <div className="wse-state wse-state-error">Error: {error}</div>}
            {data && !loading && data.mode === 'results' && (
              <>
                <div className="wse-result-meta">
                  {isZh ? `共 ${data.total.toLocaleString()} 条,显示 ${data.rows.length}` : `${data.total.toLocaleString()} results, showing ${data.rows.length}`}
                </div>
                <table className="wse-table">
                  <thead>
                    <tr>
                      <th className="wse-rank-col">#</th>
                      <th>{tr({ zh: '选手', en: 'Person' })}</th>
                      <th className="wse-value-col">{isZh ? (effType === 'single' ? '单次' : '平均') : (effType === 'single' ? 'Single' : 'Average')}{isMbldAvg && effType === 'average' && <UnofficialMark />}</th>
                      <th>{tr({ zh: '日期', en: 'Date' })}</th>
                      <th>{tr({ zh: '比赛', en: 'Competition' })}</th>
                      <th className="wse-attempts-col">{tr({ zh: '详细成绩', en: 'Solves' })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map(r => (
                      <tr key={`${r.rank}-${r.wcaId}-${r.compId}`}>
                        <td className="wse-rank-col">{r.rank}</td>
                        <td>
                          {r.iso2 && <Flag iso2={r.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}{' '}
                          <Link prefetch={false} href={personHref(r.wcaId)}>{displayCuberName(r.name, isZh)}</Link>
                        </td>
                        <td className="wse-value-col">
                          <span className="record-num-cell">
                            {formatWcaResult(r.value, singleEvent, effType)}
                            {r.record && <RecordBadge record={r.record} variant="inline" iso2={r.iso2} />}
                          </span>
                        </td>
                        <td className="wse-detail-cell">{r.compDate ?? ''}</td>
                        <td><Link {...compLinkProps(r.compId)}><CompCell compId={r.compId} compName={r.compName} isZh={isZh} /></Link></td>
                        <td className="wse-attempts-col">{formatAttempts(r.attempts, singleEvent, effType, r.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.total > size && (
                  <Paginator page={page} totalPages={totalPages(data)} size={size} pageSizeOptions={PAGE_SIZE_OPTIONS} isZh={isZh} onPageChange={(p) => update('page', String(p), false)} onSizeChange={(s) => update('size', String(s))} />
                )}
              </>
            )}
            {data && !loading && data.mode === 'persons' && (
              <>
                <div className="wse-result-meta">
                  {isZh ? `共 ${data.total.toLocaleString()} 人,${data.rows.length} 条` : `${data.total.toLocaleString()} cubers, showing ${data.rows.length}`}
                </div>
                <table className="wse-table">
                  <thead>
                    <tr>
                      <th className="wse-rank-col">#</th>
                      <th>{tr({ zh: '选手', en: 'Person' })}</th>
                      <th className="wse-value-col">{isZh ? (effType === 'single' ? '单次' : '平均') : (effType === 'single' ? 'Single' : 'Average')}{isMbldAvg && effType === 'average' && <UnofficialMark />}</th>
                      <th>{tr({ zh: '日期', en: 'Date' })}</th>
                      <th>{tr({ zh: '比赛', en: 'Competition' })}</th>
                      <th className="wse-attempts-col">{tr({ zh: '详细成绩', en: 'Solves' })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map(r => (
                      <tr key={r.wcaId}>
                        <td className="wse-rank-col">{r.rank}</td>
                        <td>
                          {r.iso2 && <Flag iso2={r.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}{' '}
                          <Link prefetch={false} href={personHref(r.wcaId)}>{displayCuberName(r.name, isZh)}</Link>
                        </td>
                        <td className="wse-value-col">{r.value != null ? formatWcaResult(r.value, singleEvent, effType) : '—'}</td>
                        <td className="wse-detail-cell">{r.compDate ?? ''}</td>
                        <td>{r.compId ? <Link {...compLinkProps(r.compId)}><CompCell compId={r.compId} compName={r.compName} isZh={isZh} /></Link> : ''}</td>
                        <td className="wse-attempts-col">{r.value != null && r.attempts && r.attempts.length > 0 ? formatAttempts(r.attempts, singleEvent, effType, r.value) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.total > size && (
                  <Paginator page={page} totalPages={totalPages(data)} size={size} pageSizeOptions={PAGE_SIZE_OPTIONS} isZh={isZh} onPageChange={(p) => update('page', String(p), false)} onSizeChange={(s) => update('size', String(s))} />
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* ============ 名次和 ============ */}
      {mode === 'sor' && (
        <>
          <div className="wse-filters">
            <CountrySelect countries={countries} value={country} isZh={isZh} onChange={v => update('country', v)} />
            <div className="wse-filter">
              <label>{tr({ zh: '类型', en: 'Type' })}</label>
              <select value={type} onChange={e => update('type', e.target.value)}>
                <option value="single">{tr({ zh: '单次', en: 'Single' })}</option>
                <option value="average">{tr({ zh: '平均', en: 'Average' })}</option>
              </select>
              {/* 名次和的平均走官方数据,多盲无官方平均 → 不计入,明确告知 */}
              {type === 'average' && selectedSet.has('333mbf') && (
                <span className="wse-sor-note">{tr({ zh: '多盲平均(非官方 Mo3)不计入名次和', en: 'Multi-Blind average (unofficial Mo3) is not counted in the sum of ranks'
                })}</span>
              )}
            </div>
            <div className="wse-filter">
              <label>{tr({ zh: '过滤', en: 'Filter' })}</label>
              <PillToggle
                className="wse-pill"
                value={hidePodium}
                onChange={v => { setQuery({ hidePodium: v ? '1' : null, page: null }); }}
                onLabel={tr({ zh: '未登领奖台', en: 'No podium' })}
                offLabel={tr({ zh: '未登领奖台', en: 'No podium' })}
              />
            </div>
          </div>

          {/* 名人堂 */}
          <div className="sor-census">
            <button type="button" className="sor-census-toggle" onClick={() => setCensusOpen(o => !o)} aria-expanded={censusOpen}>
              {censusOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              {tr({ zh: '名人堂:谁当过名次和第一?', en: 'Hall of fame: who has ever been #1?' })}
            </button>
            {censusOpen && (
              <div className="sor-census-body">
                <div className="sor-census-controls">
                  {census && (census.years?.length ?? 0) > 1 && census.year != null && (
                    <label className="sor-census-year">
                      {tr({ zh: '截至', en: 'As of' })}
                      <select value={census.year} onChange={e => setCensusYear(parseInt(e.target.value, 10))}>
                        {[...census.years].reverse().map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </label>
                  )}
                </div>
                {chartOption && (
                  <div className="sor-census-chart">
                    <ReactECharts option={chartOption} style={{ height: 190, width: '100%' }} opts={{ renderer: 'canvas' }} onEvents={onChartEvents} />
                    <div className="sor-census-chart-hint">{tr({ zh: '历年“名次和第一”不同人数 — 点某年看名单', en: 'Distinct #1-holders by year — click a year' })}</div>
                  </div>
                )}
                {!census && <div className="sor-tool-hint">{tr({ zh: '加载中…', en: 'Loading…' })}</div>}
                {census && (
                  <>
                    <p className="sor-census-lead">{isZh
                      ? `${censusYearLabel != null ? `截至 ${censusYearLabel} 年末,` : ''}${hidePodium ? '在从未登上比赛领奖台的选手中,' : ''}有 ${census.distinct} 名选手曾在 ${census.totalSubsets.toLocaleString()} 种项目组合的至少一种里排到“名次和第一”(${type === 'average' ? '平均' : '单次'}${includeCancelled ? ',含废止项' : ''},世界口径)。`
                      : `${censusYearLabel != null ? `As of end of ${censusYearLabel}, ` : ''}${hidePodium ? 'among cubers who have never reached a competition podium, ' : ''}${census.distinct} cubers have ranked #1 in at least one of ${census.totalSubsets.toLocaleString()} event combinations (${type}${includeCancelled ? ', incl. cancelled' : ''}, world).`}</p>
                    <ol className="sor-census-list">
                      {(censusExpanded ? census.rows : census.rows.slice(0, 12)).map(r => {
                        const share = r.subsetsWon / census.totalSubsets * 100;
                        return (
                          <li key={r.wcaId}>
                            <span className="sor-census-rank">{r.rank}</span>
                            {r.iso2 && <Flag iso2={r.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                            <Link prefetch={false} href={personHref(r.wcaId)}>{displayCuberName(r.name, isZh)}</Link>
                            <span className="sor-census-share">{share < 0.1 ? share.toFixed(3) : share.toFixed(1)}%</span>
                          </li>
                        );
                      })}
                    </ol>
                    {census.rows.length > 12 && (
                      <button type="button" className="sor-census-more" onClick={() => setCensusExpanded(e => !e)}>
                        {censusExpanded ? tr({ zh: '收起', en: 'Show less' }) : (isZh ? `展开全部 ${census.distinct} 人` : `Show all ${census.distinct}`)}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="wse-table-wrapper">
            {loading && <div className="wse-state">{tr({ zh: '加载中...', en: 'Loading...' })}</div>}
            {error && <div className="wse-state wse-state-error">{error}</div>}
            {sorData && !loading && (
              <>
                <div className="wse-result-meta">{isZh ? `共 ${sorData.total.toLocaleString()} 人` : `${sorData.total.toLocaleString()} cubers`}</div>
                <table className="wse-table">
                  <thead>
                    <tr>
                      <th className="wse-rank-col">#</th>
                      <th>{tr({ zh: '选手', en: 'Person' })}</th>
                      <th className="wse-value-col">{tr({ zh: '名次总和', en: 'Total' })}</th>
                      {showBest && <th className="wse-value-col">{tr({ zh: '历史最佳', en: 'Best ever' })}</th>}
                      {RANK_EVENTS.map(ev => (
                        <th key={ev} className="wse-sor-evcell" style={{ opacity: selectedSet.has(ev) ? 1 : 0.3 }}><EventIcon event={ev} /></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorData.rows.map((r, i) => (
                      <tr key={r.wcaId}>
                        <td className="wse-rank-col">{(page - 1) * size + i + 1}</td>
                        <td>
                          <span className="wse-person-cell">
                            {r.iso2 && <Flag iso2={r.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                            <Link prefetch={false} href={personHref(r.wcaId)}>{displayCuberName(r.name, isZh)}</Link>
                          </span>
                        </td>
                        <td className="wse-value-col">{r.subsetTotal != null ? r.subsetTotal : isCountryMode ? r.totalCountryRank : r.totalWorldRank}</td>
                        {showBest && (
                          <td className="wse-value-col">
                            {r.bestRank != null ? (
                              <span className="wse-best">
                                <span className="wse-best-total">{r.bestTotal ?? ''}</span>
                                <span className="wse-best-rank">#{r.bestRank}</span>
                                <span className="wse-best-year">{r.bestYear}</span>
                              </span>
                            ) : '—'}
                          </td>
                        )}
                        {RANK_EVENTS.map((ev, j) => {
                          const rk = r.ranks[j] ?? 0;
                          const cls = rk > 0 && rk <= 3 ? `wse-sor-evcell podium-${rk}` : rk === 0 ? 'wse-sor-evcell empty' : 'wse-sor-evcell';
                          return <td key={ev} className={cls} style={{ opacity: selectedSet.has(ev) ? 1 : 0.3 }}>{rk > 0 ? rk : ''}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sorData.total > size && (
                  <Paginator page={page} totalPages={totalPages(sorData)} size={size} pageSizeOptions={PAGE_SIZE_OPTIONS} isZh={isZh} onPageChange={(p) => update('page', String(p), false)} onSizeChange={(s) => update('size', String(s))} />
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function formatAttempts(attempts: (number | null)[], event: string, type: 'single' | 'average', value: number): string {
  const valid = attempts.filter(a => a != null) as number[];
  if (valid.length === 0) return '';
  if (type === 'single') {
    return valid.map(v => formatWcaResult(v, event, 'single', { failure: 'dnf' })).join('  ');
  }
  const items = valid.map(v => formatWcaResult(v, event, 'single', { failure: 'dnf' }));
  if (valid.length === 5) {
    let bestIdx = 0, worstIdx = 0;
    let bestVal = Number.MAX_SAFE_INTEGER, worstVal = -1;
    valid.forEach((v, i) => {
      if (v > 0 && v < bestVal) { bestVal = v; bestIdx = i; }
      if (v === -1 || (v > 0 && v > worstVal)) { worstVal = v; worstIdx = i; }
    });
    items[bestIdx] = `(${items[bestIdx]})`;
    if (worstIdx !== bestIdx) items[worstIdx] = `(${items[worstIdx]})`;
  }
  void value;
  return items.join('  ');
}

export default function AllResultsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: 'var(--muted)' }}>Loading…</div>}>
      <AllResultsPageInner />
    </Suspense>
  );
}
