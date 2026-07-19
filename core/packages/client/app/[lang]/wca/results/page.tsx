'use client';

/**
 * 排名 — /wca/results
 * 同一条事件选择器,按「选中项目数」驱动两种视图:
 *   选 1 项  → 单项排名(show=results 每条成绩 / show=persons 每选手年末累积最佳;截至/当期口径)
 *   选 2+ 项 → 名次和(把所选项目的世界/国家排名相加;含查选手最优组合 + 名人堂 + 排名演化)
 * 交互(累加):点事件 = 加入/取消对比(留 1 项回单项);分类快选替换整组;清除 → 空。
 * 合并自原 /wca/sum-of-ranks(已整页并入,旧路由弃用)。
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { EChartsType } from 'echarts';
import Link from '@/components/AppLink';
import HomeLink from '@/components/HomeLink';
import { UnofficialMark } from '@/components/UnofficialMark';
import dynamic from 'next/dynamic';
import { useQueryStates, parseAsString } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, HelpCircle, ChevronDown, ChevronRight } from 'lucide-react';
import Paginator from '@/components/wca-stats/Paginator';
import NameStatsView, { type NameStatsData } from '@/components/wca-stats/NameStatsView';
import { type NameMode, NAME_MODES, nameByMode, FormerNames } from '@/components/wca-stats/nameMode';
import { statsUrl } from '@/lib/stats-base';
import WcaEventSelector from '@/components/WcaEventSelector';
import { Flag } from '@/components/Flag';
import { loadFlagData } from '@/lib/country-flags';
import { CompCell } from '@/components/CompCell/CompCell';
import { ClearButton } from '@/components/ClearButton';
import { AttemptHeaderCells, AttemptCells } from '@/components/wca-results/AttemptsGrid';
import { formatWcaResult } from '@/lib/wca-format-result';
import { displayCuberName } from '@/lib/cuber-name-display';
import { RecordBadge } from '@/components/RecordBadge';
import { apiUrl } from '@/lib/api-base';
import { compLinkProps } from '@/lib/comp-link';
import { useCountries } from '@/components/wca-stats/useCountries';
import RegionCountrySelect from '@/components/wca-stats/RegionCountrySelect';
import { countryName } from '@/lib/country-name';
import { EventIcon } from '@/components/EventIcon';
import { eventDisplayName } from '@/lib/wca-events';
import { SortArrow } from '@/components/SortArrow';
import PillToggle from '@/components/PillToggle/PillToggle';
import BoolToggle from '@/components/BoolToggle';
import { WcaStatView } from '@/components/wca-stats/WcaStatView';
import { WR_METRICS, RANK_TYPE_IDS, DEFAULT_METRIC_ID } from '@/lib/wr-metrics';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../_wca_stats_extra.css';
import { tr } from '@/i18n/tr';
import '@/i18n/i18n-client';

// Persons / Results display mode for the WCA ranking view — was exported by the
// (now removed) ShowToggle component; this page is its sole consumer.
type ShowMode = 'persons' | 'results';

// echarts-for-react / SorRace 仅客户端,名次和的名人堂时间线 + 排名演化用,懒挂.
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });
const SorRace = dynamic(() => import('@/components/wca-stats/SorRace'), { ssr: false });
// 单项视图(单次 / 平均)排名表上方常显的「纪录走势」bar chart race —— 复用 wr_metric 的同款组件(受控:
// controlledEventId=当前单项, controlledMetric=single/average)。组件较重(含视频导出/canvas),懒挂 + 仅客户端.
const Top10HistoryPage = dynamic(() => import('@/components/wca-stats/Top10HistoryPage'), { ssr: false });

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
  { key: 'cubic', zh: '正阶', en: 'Cubic', events: ['333','222','444','555','666','777','333oh'] },
  { key: 'sub25', zh: '二至五阶', en: '2-5', events: ['222','333','444','555'] },
  { key: 'quiet', zh: '安静', en: 'Quiet', events: ['333bf','333fm','444bf','555bf','333mbf'] },
  { key: 'blind', zh: '盲拧', en: 'Blind', events: ['333bf','444bf','555bf','333mbf'] },
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

// ---- 空态「分布」:姓名统计(复用 /wca/name_stats 的可视化) ----
type NameStatsPayload = NameStatsData & { note?: string; noteZh?: string };
// ---- 空态「名录」:全选手 A-Z 行 ----
interface DirRow { wcaId: string; name: string; countryId: string; iso2: string | null; former?: string[]; }

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
  const [query, setQuery] = useQueryStates(
    {
      view: parseAsString,      // 'metric' = 嵌入 wr_metric 指标视图;其余/null = 排名
      mmetric: parseAsString,   // 指标视图选中的指标 id(WcaStatView 的 scoped 'm'+'metric');顶层下拉驱动
      events: parseAsString,    // 逗号串;null=默认 333;'__none__'=空
      type: parseAsString,
      country: parseAsString,
      gender: parseAsString,    // 性别:all(默认,省略) / m / f
      show: parseAsString,      // 单项:results / persons
      year: parseAsString,
      month: parseAsString,
      q: parseAsString,
      basis: parseAsString,
      hidePodium: parseAsString, // 名次和:未登领奖台
      ssort: parseAsString,      // 名次和表头排序:'total'(默认) | 'best'(历史最佳名次) | 项目 id(单项名次列)
      sdir: parseAsString,       // 名次和排序方向:'asc'(默认) | 'desc'
      psort: parseAsString,      // 名录排序:'name'(首字母) | 'len'(名字长度)
      pdir: parseAsString,       // 'asc' | 'desc'
      pname: parseAsString,      // 名录名字口径:latin | full | local | aka
      plmin: parseAsString,      // 名录长度筛选:最小字符数
      plmax: parseAsString,      // 名录长度筛选:最大字符数
      page: parseAsString,
      size: parseAsString,
    },
    { history: 'replace', scroll: false },
  );

  // ---- 顶层视图:排名(本页原功能) / 指标(嵌入退役 wr_metric 的某个派生指标视图) ----
  // 统一在「排名」标题下:单次 / 平均 = 排名表;派生指标 = wr_metric 记录视图。不再出现「指标」字样。
  const view: 'rank' | 'metric' = query.view === 'metric' ? 'metric' : 'rank';
  useDocumentTitle('排名', 'Rankings');

  // ---- 选中项目 → 模式 ----
  const selectedSet: Set<string> = useMemo(() => {
    if (query.events == null) return new Set(['333']);
    if (query.events === 'all') return new Set(ACTIVE_EVENTS);   // 短哨兵:17 活跃项(名次和默认入口)
    if (query.events === '__none__') return new Set();
    return new Set(query.events.split(',').filter(Boolean));
  }, [query.events]);
  const mode: 'single' | 'sor' | 'empty' =
    selectedSet.size === 0 ? 'empty' : selectedSet.size === 1 ? 'single' : 'sor';
  const singleEvent = mode === 'single' ? [...selectedSet][0]! : '333';
  const includeCancelled = CANCELLED_EVENTS.some(e => selectedSet.has(e));
  // 名次和搜索子集:恰为 17 活跃项 → 走 server 快路径(省略 events,带历史最佳列);否则发显式列表.
  const isActive17 = selectedSet.size === ACTIVE_EVENTS.length && ACTIVE_EVENTS.every(e => selectedSet.has(e));
  const sorEventsParam = isActive17 ? '' : RANK_EVENTS.filter(e => selectedSet.has(e)).join(',');

  // 共享 / 单项参数
  const type = (query.type ?? 'single') as 'single' | 'average';
  // 指标视图选中的指标 id(默认 bao5);顶层「类型」下拉在指标视图下回显它
  const metricId = view === 'metric' ? (query.mmetric || DEFAULT_METRIC_ID) : null;
  // 顶层「类型」下拉当前值:排名视图=口径 id(single/average);指标视图=指标 id
  const typeView: string = view === 'metric' ? (metricId ?? DEFAULT_METRIC_ID) : type;
  // 切换:single/average → 排名视图(清 view+mmetric);其余 id → 指标视图(view=metric, mmetric=id)
  const onTypeViewChange = (id: string) => {
    if (RANK_TYPE_IDS.has(id)) {
      setQuery({ view: null, mmetric: null, type: id === 'average' ? 'average' : null, page: null });
    } else {
      setQuery({ view: 'metric', mmetric: id, type: null, page: null });
    }
  };
  const country = query.country ?? '';
  const gender: 'all' | 'm' | 'f' = query.gender === 'm' || query.gender === 'f' ? query.gender : 'all';
  // 默认显示「选手」(每选手年末累积最佳),而非「成绩」(每条成绩);仅显式 show=results 才回成绩视图。
  const show: ShowMode = (query.show === 'results') ? 'results' : 'persons';
  const currentYear = new Date().getUTCFullYear();
  const yearRaw = parseInt(query.year ?? '0', 10);
  const year = show === 'persons' && yearRaw === 0 ? currentYear : yearRaw;
  const month = parseInt(query.month ?? '0', 10);
  const qFromUrl = query.q ?? '';
  const page = parseInt(query.page ?? '1', 10);
  const size = parseInt(query.size ?? '100', 10);
  const hidePodium = query.hidePodium === '1';
  // 名次和表头排序(服务端分页 → 排序也走服务端;default total / asc)。
  // ssort 除 'total'/'best' 外还接受单个项目 id(RANK_EVENT_SET 白名单)→ 按该项目名次列排.
  const ssort: string = query.ssort === 'best' ? 'best' : query.ssort && RANK_EVENT_SET.has(query.ssort) ? query.ssort : 'total';
  const sdir: 'asc' | 'desc' = query.sdir === 'desc' ? 'desc' : 'asc';
  const setSorSort = (key: string) => {
    if (ssort !== key) { setQuery({ ssort: key === 'total' ? null : key, sdir: null, page: null }); return; }
    if (key === 'total') { setQuery({ sdir: sdir === 'asc' ? 'desc' : null, page: null }); return; }
    // 非默认列(historical/单项):asc → desc → 恢复默认(名次总和),三态循环
    if (sdir === 'asc') setQuery({ sdir: 'desc', page: null });
    else setQuery({ ssort: null, sdir: null, page: null });
  };
  // 空态:姓名分布 + 名录(A-Z 平铺列表)同页共存(分布在上、名录在下)
  const psort: 'name' | 'len' = query.psort === 'len' ? 'len' : 'name';
  const pdir: 'asc' | 'desc' = query.pdir === 'desc' ? 'desc' : 'asc';
  const pname: NameMode = (NAME_MODES as string[]).includes(query.pname ?? '') ? (query.pname as NameMode) : 'latin';
  const plmin = query.plmin ?? '';
  const plmax = query.plmax ?? '';
  const setSort = (key: 'name' | 'len') => {
    if (psort === key) setQuery({ pdir: pdir === 'asc' ? 'desc' : 'asc', page: null });
    else setQuery({ psort: key, pdir: 'asc', page: null });
  };
  // 多盲平均 = 非官方 Mo3(builder 现算进 wca_results_flat,有 is_avg 行),单项可排;名次和不计入。
  // 333mbf(新)+ 333mbo(旧,仅极少数完成过 3 轮)同口径。
  const isMbldAvg = singleEvent === '333mbf' || singleEvent === '333mbo';
  const effType: 'single' | 'average' = type === 'average' ? 'average' : 'single';
  // 单项 bar race 的指标标签(single/average 必在 WR_METRICS 内);复用同一份口径表,免再写语言三元
  const effMetricMeta = WR_METRICS.find(m => m.id === effType)!;
  // 333mbf 非官方平均只有「当期」口径:historical_ranks_snapshot 不含 333mbf 平均(截至口径会 400),
  // wca_results_flat 的 is_avg 行只支持 period → 强制 period 并禁用「口径」切换,避免落到 historical-ranks。
  const mbfAvgPeriodOnly = isMbldAvg && effType === 'average';
  const basisRaw = query.basis;
  const basis: 'period' | 'cumulative' =
    mbfAvgPeriodOnly
      ? 'period'
      : basisRaw === 'cumulative' || basisRaw === 'period'
        ? basisRaw
        : (show === 'persons' ? 'cumulative' : 'period');

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
  const toggleCategory = (cat: typeof EVENT_CATEGORIES[0]) => {
    const cur = new Set(selectedSet);
    const allIn = cat.events.every(e => cur.has(e));
    if (allIn) cat.events.forEach(e => cur.delete(e)); else cat.events.forEach(e => cur.add(e));
    setQuery({ events: serializeEvents(cur), page: null });
  };
  const isCatActive = (cat: typeof EVENT_CATEGORIES[0]) => cat.events.every(e => selectedSet.has(e));

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

  // 全参数常驻 URL:把 Image#1 筛选栏(显示/类型/国家/性别/口径/年份/月份/搜索)的有效值补进 URL,
  // 含默认值 —— 让 URL 永远反映完整筛选状态、可分享/强制显示。只「补缺」(参数为 null 时填有效值),
  // 绝不覆盖已有值,避免与用户改动竞态(否则会把刚选的国家/大洲又刷回默认)。仅「排名」视图(rank)生效。
  useEffect(() => {
    if (view !== 'rank') return;
    const patch: Record<string, string> = {};
    if (query.show == null) patch.show = show;
    if (query.type == null) patch.type = type === 'average' ? 'average' : 'single';
    if (query.country == null) patch.country = country;
    if (query.gender == null) patch.gender = gender;
    if (query.basis == null) patch.basis = basis;
    if (query.year == null) patch.year = String(year);
    if (query.month == null) patch.month = String(month);
    if (query.q == null) patch.q = qFromUrl;
    if (Object.keys(patch).length > 0) setQuery(patch as Parameters<typeof setQuery>[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, query.show, query.type, query.country, query.gender, query.basis, query.year, query.month, query.q,
      show, type, country, gender, basis, year, month, qFromUrl]);

  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = currentYear; y >= 2003; y--) ys.push(y);
    return ys;
  }, [currentYear]);

  const [data, setData] = useState<SingleData | null>(null);
  const [nameStats, setNameStats] = useState<NameStatsPayload | null>(null);
  const [dirData, setDirData] = useState<{ rows: DirRow[]; total: number } | null>(null);
  const [sorData, setSorData] = useState<{ rows: SorRow[]; total: number; events: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setFlagBust] = useState(0);
  const countries = useCountries();
  // bar race「按国家」:选中国家 id → iso2(拆分文件名 key)+ 本地化显示名
  const barRaceCountryOpt = countries.find(c => c.id === country);
  const barRaceCountryIso2 = barRaceCountryOpt?.iso2 ?? '';
  const barRaceCountryName = barRaceCountryOpt
    ? (barRaceCountryOpt.iso2 ? countryName(barRaceCountryOpt.iso2, isZh) : barRaceCountryOpt.name)
    : '';
  useEffect(() => { loadFlagData().then(v => setFlagBust(v)); }, []);

  // 单项数据
  useEffect(() => {
    if (view !== 'rank' || mode !== 'single') return;
    setLoading(true); setError(null);
    const qs = new URLSearchParams();
    qs.set('event', singleEvent);
    qs.set('type', effType);
    qs.set('page', String(page));
    qs.set('size', String(size));
    if (country) qs.set('country', country);
    if (gender !== 'all') qs.set('gender', gender);
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
  }, [view, mode, show, basis, singleEvent, effType, country, gender, year, month, qFromUrl, page, size]);

  // 空态「分布」:姓名统计(静态 JSON,缓存一次)
  useEffect(() => {
    if (view !== 'rank' || mode !== 'empty' || nameStats) return;
    setLoading(true); setError(null);
    // v=2:name_stats 加了 全名/本地名/含曾用名 面板(shape 变),bump 破浏览器 + CDN 缓存
    fetch(statsUrl('/stats/name_stats.json?v=2'))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((j: NameStatsPayload) => setNameStats(j))
      .catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [view, mode, nameStats]);

  // 空态「名录」:全选手 A-Z(按 首字母 / 名字长度 排序,可叠加国家)
  useEffect(() => {
    if (view !== 'rank' || mode !== 'empty') return;
    setLoading(true); setError(null);
    const qs = new URLSearchParams();
    qs.set('sort', psort); qs.set('dir', pdir); qs.set('name', pname);
    if (plmin) qs.set('lmin', plmin);
    if (plmax) qs.set('lmax', plmax);
    qs.set('page', String(page)); qs.set('size', String(size));
    if (country) qs.set('country', country);
    if (gender !== 'all') qs.set('gender', gender);
    fetch(apiUrl(`/v1/wca/persons-directory?${qs.toString()}`))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((j: { rows: DirRow[]; total: number }) => setDirData({ rows: j.rows, total: j.total }))
      .catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [view, mode, psort, pdir, pname, plmin, plmax, country, gender, page, size]);

  // 名次和数据
  useEffect(() => {
    if (view !== 'rank' || mode !== 'sor') return;
    setLoading(true); setError(null);
    const qs = new URLSearchParams();
    qs.set('type', type);
    qs.set('page', String(page));
    qs.set('size', String(size));
    if (country) qs.set('country', country);
    if (sorEventsParam) qs.set('events', sorEventsParam);
    if (hidePodium) qs.set('hidePodium', '1');
    if (ssort !== 'total') qs.set('sort', ssort);
    if (sdir !== 'asc') qs.set('dir', sdir);
    qs.set('v', '3');
    fetch(apiUrl(`/v1/wca/sum-of-ranks?${qs.toString()}`))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setSorData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [view, mode, type, country, sorEventsParam, hidePodium, ssort, sdir, page, size]);

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
  // 折线图的 symbol 点太小、精确点击命中率低 → 用 zrender 原始 click + convertFromPixel
  // 把整根 grid 竖列都算作"点这一年"(跟 tooltip 的 axis trigger 手感一致),而非只认小圆点本身。
  const onChartReady = useCallback((chart: EChartsType) => {
    chart.getZr().on('click', (p: { offsetX: number; offsetY: number }) => {
      if (!chart.containPixel('grid', [p.offsetX, p.offsetY])) return;
      const idx = Math.round(chart.convertFromPixel({ xAxisIndex: 0 }, p.offsetX));
      const years = (chart.getOption().xAxis as Array<{ data: number[] }>)[0]!.data;
      const year = years[idx];
      if (year != null) setCensusYear(year);
    });
  }, []);


  // 顶层「类型」下拉(单次 / 平均 = 排名口径;其余派生指标 = 嵌入 wr_metric 对应指标视图)。
  // 同时是 排名 ↔ 指标 的切换入口,故各模式(单项 / 名次和 / 空态 / 指标视图)都渲染一份,保证哪都能切。
  // 各模式互斥 → 同时只挂一份,id 不重复。单项里放在「显示」右侧,其余模式作首个控件。
  const typeSelect = (
    <div className="wse-filter wse-filter-show">
      <label htmlFor="wse-type-view">{tr({ zh: '类型', en: 'Type' })}</label>
      <select id="wse-type-view" className="wse-filter-select" value={typeView} onChange={(e) => onTypeViewChange(e.target.value)}>
        {WR_METRICS.map(m => (
          <option key={m.id} value={m.id}>{tr({ zh: m.zh, en: m.en })}</option>
        ))}
      </select>
    </div>
  );

  // 性别下拉(所有 / 男 / 女)。WCA 不设性别纪录,但排名按性别筛是常见口径(对标 WCA rankings / cubing.com);
  // 名次按位置算 → 自动在性别子集内重排。默认 all 省略出 URL。
  const genderSelect = (
    <div className="wse-filter wse-filter-show">
      <label htmlFor="wse-gender">{tr({ zh: '性别', en: 'Gender' })}</label>
      <select id="wse-gender" className="wse-filter-select" value={gender} onChange={(e) => update('gender', e.target.value === 'all' ? '' : e.target.value)}>
        <option value="all">{tr({ zh: '所有', en: 'All' })}</option>
        <option value="m">{tr({ zh: '男', en: 'Male' })}</option>
        <option value="f">{tr({ zh: '女', en: 'Female' })}</option>
      </select>
    </div>
  );

  return (
    <div className="wse-page">
      <header className="wse-header">
        <div className="wse-header-row">
          <HomeLink className="wse-back"><ChevronLeft size={16} /> {tr({ zh: '首页', en: 'Home' })}</HomeLink>
        </div>
        <h1 className="wse-title-row">
          {tr({ zh: '排名', en: 'Rankings' })}
          {view === 'rank' && (
            <Link
              href={mode === 'sor' ? '/wca/about/sum-of-ranks' : '/wca/about/all-results'}
              className="wse-title-help"
              title={tr({ zh: '这页是干啥的?', en: 'What is this page?' })}
              aria-label={tr({ zh: '查看说明', en: 'About this page' })}
            >
              <HelpCircle size={18} strokeWidth={1.75} />
            </Link>
          )}
        </h1>
      </header>

      {/* ============ 指标视图:嵌入退役的 wr_metric;指标由「类型」下拉受控(隐藏其内置选择器)。
          顶层「类型」下拉作为 afterEventSelector 插在 WcaStatView 的项目选择器之后 → 项目在类型上方 ============ */}
      {view === 'metric' && (
        <WcaStatView
          statId="wr_metric" headerMode="note" urlScope="m" metricId={metricId}
          afterEventSelector={<div className="wse-type-standalone">{typeSelect}</div>}
        />
      )}

      {/* ↓↓↓ 排名视图(本页原功能):事件多选 + 空态 / 单项 / 名次和 ↓↓↓ */}
      {view === 'rank' && (<>
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
          <div className="wse-events-bar">
            <ClearButton variant="standalone" onClick={clearAll} isZh={isZh} />
            <button type="button" className="wse-cat-btn" onClick={selectAll}>{tr({ zh: '全选', en: 'All' })}</button>
            {EVENT_CATEGORIES.map(cat => (
              <button
                key={cat.key}
                type="button"
                onClick={() => toggleCategory(cat)}
                className={isCatActive(cat) ? 'wse-cat-btn wse-cat-on' : 'wse-cat-btn'}
              >
                {tr(cat)}
              </button>
            ))}
            <BoolToggle
              value={includeCancelled}
              onChange={onToggleCancelled}
              label={tr({ zh: '废止项', en: 'Cancelled' })}
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

      {/* ============ 空态:姓名分布(name_stats viz) + 名录(A-Z 平铺) ============ */}
      {mode === 'empty' && (
        <>
          <div className="wse-type-standalone">{typeSelect}</div>
          {/* ── 姓名分布 ── */}
          <h2 className="wse-section-title">{tr({ zh: '姓名分布', en: 'Name distribution' })}</h2>
          <div className="wse-table-wrapper">
            {loading && !nameStats && <div className="wse-state">{tr({ zh: '加载中...', en: 'Loading...' })}</div>}
            {error && !nameStats && <div className="wse-state wse-state-error">Error: {error}</div>}
            {nameStats && (
              <>
                {(nameStats.note || nameStats.noteZh) && (
                  <p className="wse-subtitle" style={{ marginTop: 0 }}>
                    {tr({ zh: nameStats.noteZh ?? nameStats.note ?? '', en: nameStats.note ?? '' })}
                  </p>
                )}
                <NameStatsView
                  data={nameStats}
                  isZh={isZh}
                  queryKey="nstab"
                  nameMode={pname}
                  onNameModeChange={(m) => update('pname', m === 'latin' ? '' : m)}
                />
              </>
            )}
          </div>

          {/* ── 名录 A–Z ── */}
          <h2 className="wse-section-title">{tr({ zh: '名录 A–Z', en: 'Directory A–Z' })}</h2>
          <div className="wse-filters">
            <RegionCountrySelect countries={countries} value={country} isZh={isZh} onChange={v => update('country', v)} />
            {genderSelect}
            <div className="wse-filter wse-filter-show">
              <label>{tr({ zh: '排序', en: 'Sort' })}</label>
              <div className="wse-show-toggle">
                <button type="button" className={`wse-show-btn${psort === 'name' ? ' active' : ''}`} onClick={() => setSort('name')}>
                  {tr({ zh: '首字母', en: 'A–Z' })}
                </button>
                <button type="button" className={`wse-show-btn${psort === 'len' ? ' active' : ''}`} onClick={() => setSort('len')}>
                  {tr({ zh: '名字长度', en: 'Name length' })}
                </button>
              </div>
            </div>
            <div className="wse-filter wse-filter-show">
              <label title={tr({ zh: '按当前名字口径的字符数筛选', en: 'Filter by character count of the current name form' })}>
                {tr({ zh: '长度', en: 'Length' })}
              </label>
              <div className="wse-len-range">
                <input type="number" min={0} inputMode="numeric" className="wse-len-input"
                  placeholder={tr({ zh: '最小', en: 'min' })} value={plmin}
                  onChange={e => update('plmin', e.target.value)} />
                <span className="wse-len-dash">–</span>
                <input type="number" min={0} inputMode="numeric" className="wse-len-input"
                  placeholder={tr({ zh: '最大', en: 'max' })} value={plmax}
                  onChange={e => update('plmax', e.target.value)} />
                {(plmin || plmax) && (
                  <ClearButton variant="standalone"
                    onClick={() => setQuery({ plmin: null, plmax: null, page: null })} />
                )}
              </div>
            </div>
          </div>
          <div className="wse-table-wrapper sticky-scroll">
            {loading && !dirData && <div className="wse-state">{tr({ zh: '加载中...', en: 'Loading...' })}</div>}
            {error && !dirData && <div className="wse-state wse-state-error">Error: {error}</div>}
            {dirData && (
              <>
                <div className="wse-result-meta">{tr({ zh: `共 ${dirData.total.toLocaleString()} 人`, en: `${dirData.total.toLocaleString()} cubers` })}</div>
                <table className="wse-table sticky-thead">
                  <thead>
                    <tr>
                      <th className="wse-rank-col">#</th>
                      <th>
                        {/* 列头箭头 = 当前排序方向(首字母 / 名字长度都排这一列),点一下翻方向;排序键由上方切换器选 */}
                        <button type="button" className="wse-th-sort" onClick={() => setQuery({ pdir: pdir === 'asc' ? 'desc' : 'asc', page: null })}>
                          {tr({ zh: '选手', en: 'Person' })}
                          <SortArrow active dir={pdir} />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dirData.rows.map((r, i) => (
                      <tr key={r.wcaId}>
                        <td className="wse-rank-col">{(page - 1) * size + i + 1}</td>
                        <td>
                          {r.iso2 && <Flag iso2={r.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}{' '}
                          <span className="ns-person-wrap">
                            <Link prefetch={false} href={personHref(r.wcaId)}>{nameByMode(r.name, pname)}</Link>
                            {pname === 'aka' && <FormerNames former={r.former} />}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {dirData.total > size && (
                  <Paginator page={page} totalPages={totalPages(dirData)} size={size} pageSizeOptions={PAGE_SIZE_OPTIONS} isZh={isZh} onPageChange={(p) => update('page', String(p), false)} onSizeChange={(s) => update('size', String(s))} />
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* ============ 单项 ============ */}
      {mode === 'single' && (
        <>
          <div className="wse-filters">
            <div className="wse-filter wse-filter-show">
              <label>{tr({ zh: '显示', en: 'Show' })}</label>
              <PillToggle
                className="wse-pill"
                value={show === 'persons'}
                onChange={(v) => handleShowChange(v ? 'persons' : 'results')}
                onLabel={tr({ zh: '选手', en: 'Persons' })}
                offLabel={tr({ zh: '成绩', en: 'Results' })}
              />
            </div>
            {typeSelect}
            <RegionCountrySelect countries={countries} value={country} isZh={isZh} onChange={v => update('country', v)} />
            {genderSelect}
            <div className="wse-filter wse-filter-show"
              title={mbfAvgPeriodOnly ? tr({ zh: '多盲非官方平均仅支持「当期」口径', en: 'Multi-Blind unofficial average supports the period basis only' }) : undefined}>
              <label>{tr({ zh: '口径', en: 'Basis' })}</label>
              <PillToggle
                className="wse-pill"
                value={basis === 'cumulative'}
                onChange={(v) => handleBasisChange(v ? 'cumulative' : 'period')}
                onLabel={tr({ zh: '截至', en: 'Cumulative' })}
                offLabel={tr({ zh: '当期', en: 'Period' })}
                disabled={mbfAvgPeriodOnly}
              />
            </div>
            <div className="wse-filter">
              <label>{tr({ zh: '年份', en: 'Year' })}</label>
              <select className="wse-filter-select" value={year} onChange={e => update('year', e.target.value === '0' ? '' : e.target.value)}>
                {show === 'results' && <option value={0}>{tr({ zh: '全部年份', en: 'All years' })}</option>}
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {/* 截至口径按年末、不分月 → 直接隐藏月份框(不再灰显占位) */}
            {basis !== 'cumulative' && (
              <div className="wse-filter">
                <label>{tr({ zh: '月份', en: 'Month' })}</label>
                <select
                  className="wse-filter-select"
                  value={month}
                  onChange={e => update('month', e.target.value === '0' ? '' : e.target.value)}
                >
                  <option value={0}>{tr({ zh: '全年', en: 'All months' })}</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}
            {show === 'results' && (
              <div className="wse-filter wse-filter-q">
                <label>{tr({ zh: '搜索', en: 'Search' })}</label>
                <div className="wse-q-wrap">
                  <input type="search" className="wse-q-input" value={qInput} onChange={e => setQInput(e.target.value)} placeholder={tr({ zh: '选手或比赛名', en: 'Person or competition' })} />
                  {qInput && <ClearButton onClick={() => { setQInput(''); update('q', ''); }} isZh={isZh} preserveFocus />}
                </div>
              </div>
            )}
          </div>

          {/* 纪录走势 bar chart race:常显在排名表上方(方案 B)。复用 wr_metric 的 Top10HistoryPage,
              受控到当前单项 + 单次 / 平均;筛选(年份 / 国家 / 选手)只作用于下方表,走势恒为全时段。
              图义跟随「显示」开关:选手 = 历史前 10 选手(按人去重);成绩 = 历史最快前 10 条成绩(同人可多条)。 */}
          <div className="wse-barrace">
            <Top10HistoryPage
              controlledEventId={singleEvent}
              controlledMetric={effType}
              controlledMode={show === 'persons' ? 'persons' : 'results'}
              controlledCountry={barRaceCountryIso2 || undefined}
              controlledCountryName={barRaceCountryName || undefined}
              controlledMetricLabelZh={effMetricMeta.zh}
              controlledMetricLabelEn={effMetricMeta.en}
            />
          </div>

          <div className="wse-table-wrapper sticky-scroll">
            {loading && <div className="wse-state">{tr({ zh: '加载中...', en: 'Loading...' })}</div>}
            {error && <div className="wse-state wse-state-error">Error: {error}</div>}
            {data && !loading && data.mode === 'results' && (
              <>
                <div className="wse-result-meta">
                  {isZh ? `共 ${data.total.toLocaleString()} 条,显示 ${data.rows.length}` : `${data.total.toLocaleString()} results, showing ${data.rows.length}`}
                </div>
                <table className="wse-table sticky-thead">
                  <thead>
                    <tr>
                      <th className="wse-rank-col">#</th>
                      <th>{tr({ zh: '选手', en: 'Person' })}</th>
                      <th className="wse-value-col">{isZh ? (effType === 'single' ? '单次' : '平均') : (effType === 'single' ? 'Single' : 'Average')}{isMbldAvg && effType === 'average' && <UnofficialMark />}</th>
                      <th>{tr({ zh: '日期', en: 'Date' })}</th>
                      <th>{tr({ zh: '比赛', en: 'Competition' })}</th>
                      <AttemptHeaderCells count={Math.min(5, data.rows.reduce((m, r) => Math.max(m, r.attempts?.length ?? 0), 0))} />
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
                        <AttemptCells attempts={r.attempts} eventId={singleEvent} count={Math.min(5, data.rows.reduce((m, r) => Math.max(m, r.attempts?.length ?? 0), 0))} />
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
                <table className="wse-table sticky-thead">
                  <thead>
                    <tr>
                      <th className="wse-rank-col">#</th>
                      <th>{tr({ zh: '选手', en: 'Person' })}</th>
                      <th className="wse-value-col">{isZh ? (effType === 'single' ? '单次' : '平均') : (effType === 'single' ? 'Single' : 'Average')}{isMbldAvg && effType === 'average' && <UnofficialMark />}</th>
                      <th>{tr({ zh: '日期', en: 'Date' })}</th>
                      <th>{tr({ zh: '比赛', en: 'Competition' })}</th>
                      <AttemptHeaderCells count={Math.min(5, data.rows.reduce((m, r) => Math.max(m, r.attempts?.length ?? 0), 0))} />
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
                        <AttemptCells attempts={r.value != null ? r.attempts : []} eventId={singleEvent} count={Math.min(5, data.rows.reduce((m, r) => Math.max(m, r.attempts?.length ?? 0), 0))} />
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
            {typeSelect}
            <RegionCountrySelect countries={countries} value={country} isZh={isZh} onChange={v => update('country', v)} />
            {/* 单次 / 平均 由「类型」下拉统一控制(单次 / 平均 → 排名,派生指标 → 指标视图);此处仅保留「多盲平均不计入名次和」提示 */}
            {type === 'average' && selectedSet.has('333mbf') && (
              <div className="wse-filter wse-filter-show">
                <span className="wse-sor-note">{tr({ zh: '多盲平均(非官方 Mo3)不计入名次和', en: 'Multi-Blind average (unofficial Mo3) is not counted in the sum of ranks' })}</span>
              </div>
            )}
            <div className="wse-filter wse-filter-show">
              <BoolToggle
                value={hidePodium}
                onChange={v => { setQuery({ hidePodium: v ? '1' : null, page: null }); }}
                label={tr({ zh: '未登领奖台', en: 'No podium' })}
              />
            </div>
          </div>

          {/* 名人堂 */}
          <div className="sor-census">
            <button type="button" className="sor-census-toggle" onClick={() => setCensusOpen(o => !o)} aria-expanded={censusOpen}>
              {censusOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              {tr({ zh: '谁当过 SoWR?', en: "Who's ever topped the SoWR?" })}
            </button>
            {censusOpen && (
              <div className="sor-census-body">
                <div className="sor-census-controls">
                  {census && (census.years?.length ?? 0) > 1 && census.year != null && (
                    <label className="sor-census-year">
                      {tr({ zh: '截至', en: 'As of' })}
                      <select className="sor-census-year-select" value={census.year} onChange={e => setCensusYear(parseInt(e.target.value, 10))}>
                        {[...census.years].reverse().map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </label>
                  )}
                </div>
                {chartOption && (
                  <div className="sor-census-chart">
                    <ReactECharts option={chartOption} style={{ height: 190, width: '100%', cursor: 'pointer' }} opts={{ renderer: 'canvas' }} onChartReady={onChartReady} />
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

          <div className="wse-table-wrapper sticky-scroll">
            {loading && <div className="wse-state">{tr({ zh: '加载中...', en: 'Loading...' })}</div>}
            {error && <div className="wse-state wse-state-error">{error}</div>}
            {sorData && !loading && (
              <>
                <div className="wse-result-meta">{isZh ? `共 ${sorData.total.toLocaleString()} 人` : `${sorData.total.toLocaleString()} cubers`}</div>
                <table className="wse-table sticky-thead">
                  <thead>
                    <tr>
                      <th className="wse-rank-col">#</th>
                      <th>{tr({ zh: '选手', en: 'Person' })}</th>
                      <th className="wse-value-col">
                        <button type="button" className="wse-th-sort" onClick={() => setSorSort('total')}>
                          {tr({ zh: '名次总和', en: 'Total' })}
                          <SortArrow active={ssort === 'total'} dir={sdir} />
                        </button>
                      </th>
                      {showBest && (
                        <th className="wse-value-col">
                          <button type="button" className="wse-th-sort" onClick={() => setSorSort('best')}
                            title={tr({ zh: '历史最佳名次(及达成年份)', en: 'Best-ever placement (and year)' })}>
                            {tr({ zh: '历史最佳', en: 'Best ever' })}
                            <SortArrow active={ssort === 'best'} dir={sdir} />
                          </button>
                        </th>
                      )}
                      {RANK_EVENTS.map(ev => (
                        <th key={ev} className="wse-sor-evcell" style={{ opacity: selectedSet.has(ev) ? 1 : 0.3 }}>
                          <button type="button" className="wse-th-sort wse-th-sort-ev" onClick={() => setSorSort(ev)}
                            title={eventDisplayName(ev, isZh)}>
                            <EventIcon event={ev} />
                            <SortArrow active={ssort === ev} dir={sdir} size={10} />
                          </button>
                        </th>
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
                          <td className="wse-value-col"
                            title={r.bestTotal != null ? tr({ zh: `最佳名次总和 ${r.bestTotal}`, en: `Best sum-of-ranks total ${r.bestTotal}` }) : undefined}>
                            {r.bestRank != null ? (
                              <span className="wse-best">
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
      </>)}
    </div>
  );
}

export default function AllResultsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: 'var(--muted)' }}>Loading…</div>}>
      <AllResultsPageInner />
    </Suspense>
  );
}
