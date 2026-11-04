'use client';
import '@cuberoot/timer-ui/compact-select.css';

/**
 * 成绩 — /wca/results
 * 排名 / 纪录共用一层导航,切换时同步适用的项目、类型、地区和性别。
 * 旧 /wca/records 在验收期间继续使用同一纪录组件。
 * 普通排名使用同一条事件选择器,按「选中项目数」驱动两种视图:
 *   选 1 项  → 单项排名(show=results 每条成绩 / show=persons 每选手年末累积最佳;截至/当期口径)
 *   选 2+ 项 → 名次和(把所选项目的世界/国家排名相加;含查选手最优组合 + 排名演化)
 * 交互(累加):点事件 = 加入/取消对比(留 1 项回单项);分类快选替换整组;清除 → 空。
 * 合并自原 /wca/sum-of-ranks(已整页并入,旧路由弃用)。
 */
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import PageHeading from '@/components/PageHeading';
import { UnofficialMark } from '@/components/UnofficialMark';
import dynamic from 'next/dynamic';
import { WcaPersonRelationCells, useWcaTeams } from './_components/WcaTeamCell';
import { useQueryStates, parseAsString } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { HelpCircle, Search, ChevronDown } from '@app-foundation/icons/lucide';
import Paginator from '@/components/wca-stats/Paginator';
import NameStatsView, { type NameStatsData } from '@/components/wca-stats/NameStatsView';
import { type NameMode, NAME_MODES, nameByMode, FormerNames } from '@/components/wca-stats/nameMode';
import { statsUrl } from '@/lib/stats-base';
import WcaEventMultiSelector from '@/components/WcaEventMultiSelector';
import { Flag } from '@/components/Flag';
import { loadFlagData } from '@/lib/country-flags';
import { CompCell } from '@/components/CompCell/CompCell';
import { ClearButton } from '@/components/ClearButton';
import { SearchInput } from '@/components/SearchInput';
import { AttemptHeaderCells, AttemptCells } from '@/components/wca-results/AttemptsGrid';
import { formatWcaResult } from '@/lib/wca-format-result';
import { displayCuberName } from '@/lib/cuber-name-display';
import { WcaPersonTeamBadge } from '@/components/WcaPersonTeamBadge';
import { RecordBadge } from '@/components/RecordBadge';
import { apiUrl } from '@/lib/api-base';
import { compLinkProps } from '@/lib/comp-link';
import { useCountries } from '@/components/wca-stats/useCountries';
import RegionCountrySelect, { countryToRecordRegion, recordRegionToCountry } from '@/components/wca-stats/RegionCountrySelect';
import { WcaGenderSelect } from '@/components/wca-stats/WcaGenderSelect';
import { countryName } from '@/lib/country-name';
import { EventIcon } from '@/components/EventIcon';
import { eventDisplayName } from '@/lib/wca-events';
import { SortArrow } from '@/components/SortArrow';
import BoolToggle from '@/components/BoolToggle';
import { WcaStatView } from '@/components/wca-stats/WcaStatView';
import { WR_METRICS, RANK_TYPE_IDS, DEFAULT_METRIC_ID } from '@/lib/wr-metrics';
import '../_wca_stats_extra.css';
import '@/components/wca-stats/wca-stats-controls.css';
import { tr } from '@/i18n/tr';
import '@/i18n/i18n-client';
import {
  WcaTeacherColumnHeader,
  useWcaTeachers,
} from '@/components/WcaTeacherCell';
import { WcaRelationColumnHeader, teacherFilterItems } from '@/components/WcaRelationColumnHeader';
import { wcaTeamSelectItems } from '@/components/wca-team-select-items';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { useMembership } from '@/hooks/useMembership';
import { useRequireMembership } from '@/hooks/useRequireMembership';
import { useAuthUser } from '@/lib/auth-store';
import { WCA_ID_REGEX } from '@cuberoot/shared/wca-person';
import MyStudentsPrompt from './_components/MyStudentsPrompt';

// Persons / Results display mode for the WCA ranking view — was exported by the
// (now removed) ShowToggle component; this page is its sole consumer.
type ShowMode = 'persons' | 'results';

const RecordsView = dynamic(() => import('@/components/wca-records/RecordsView'), {
  ssr: false,
  loading: () => <div className="wse-state"><LoadingIndicator /></div>,
});
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
const PAGE_SIZE_OPTIONS = [50, 100, 200];

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

function AllResultsPageInner() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const personHref = (id: string) => `/${(i18n.language.startsWith('zh') ? 'zh' : 'en')}/wca/persons/${id}`;
  const [query, setQuery] = useQueryStates(
    {
      rtype: parseAsString,
      rdetails: parseAsString,
      scancelled: parseAsString,
      revent: parseAsString,
      rshow: parseAsString,
      rregion: parseAsString,
      rgender: parseAsString,
      mevent: parseAsString,
      mtype: parseAsString,
      tab: parseAsString,       // records = 纪录;rank = 排名;无参数时默认纪录,兼容旧排名深链
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
      qmode: parseAsString,   // 名字匹配:any(选手/比赛) | first | last | exact
      basis: parseAsString,
      team: parseAsString,
      teacherFilter: parseAsString,
      myStudents: parseAsString, // One-time continuation after login/membership; never a shared identity.
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
  // Legacy metric-history links now open Records with the same metric/event.
  const legacyMetricHistory = query.tab !== 'records' && query.view === 'metric' && query.mtype === 'history';
  const recordsActive = query.tab === 'records' || legacyMetricHistory || Object.values(query).every(value => value === null);
  useEffect(() => {
    if (legacyMetricHistory) {
      void setQuery({ tab: 'records', rshow: 'history', rtype: query.mmetric || DEFAULT_METRIC_ID,
        revent: query.mevent || '333', rregion: 'world', rgender: null, mtype: null,
        rdetails: RANK_TYPE_IDS.has(query.mmetric || '') ? '1' : null });
    } else if (recordsActive && query.tab === null) void setQuery({ tab: 'records' });
  }, [recordsActive, legacyMetricHistory, query.tab, query.mmetric, query.mevent, setQuery]);
  const view: 'rank' | 'metric' | 'records' = recordsActive ? 'records' : query.view === 'metric' ? 'metric' : 'rank';

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
      setQuery({ view: null, mmetric: null, type: id === 'average' ? 'average' : 'single',
        events: view === 'metric' ? query.mevent || '333' : query.events, page: null });
    } else {
      setQuery({ view: 'metric', mmetric: id,
        mevent: view === 'metric' ? query.mevent || '333' : mode === 'single' ? singleEvent : query.mevent || '333',
        mtype: 'ranking', type: 'single', page: null });
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
  const qMode = ['first', 'last', 'exact'].includes(query.qmode ?? '') ? query.qmode! : 'any';
  const teamFilter = query.team ?? '';
  const teacherFilter = query.teacherFilter ?? '';
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
  const setEventsSet = (events: Set<string>) => setQuery({ events: serializeEvents(events), page: null });

  // 单项控件。**写什么就是什么,不做 `v || null` 折叠** —— 下面「全参数常驻 URL」的 effect 覆盖的那批
  // 筛选参数(show/type/country/gender/basis/year/month/q)缺省时会被补成派生值,而派生值不一定等于
  // 「空」的语义(show 缺省=persons、year 缺省+persons=当年),折成 null 就等于把用户的选择丢给派生规则。
  // 想清除某个参数的调用方自己传 null(仅限不在 backfill 名单里的键,如 pname/plmin/plmax)。
  // 守卫:tests/wca-results-url-params.test.ts。
  const update = (k: string, v: string | null, resetPage = true) => {
    const patch: Record<string, string | null> = { [k]: v };
    if (resetPage) patch.page = null;
    setQuery(patch as Parameters<typeof setQuery>[0]);
  };
  const handleBasisChange = (v: 'period' | 'cumulative') => {
    setQuery({ basis: v, ...(v === 'cumulative' ? { month: '0' } : {}), page: null });
  };
  const handleShowChange = (v: ShowMode) => {
    if (v === 'persons') {
      const keepYear = query.year && query.year !== '0';
      setQuery({ show: 'persons', month: '0', q: '', ...(keepYear ? {} : { year: String(currentYear) }), page: null });
    } else {
      // 必须写显式 'results':show 缺省时派生值是 'persons',而下面「全参数常驻 URL」的 effect
      // 会把缺省参数补回派生值 —— 写 null 等于立刻被刷回 persons,toggle 看起来取消不掉。
      setQuery({ show: 'results', page: null });
    }
  };

  const [qInput, setQInput] = useState(qFromUrl);
  useEffect(() => { setQInput(qFromUrl); }, [qFromUrl]);
  useEffect(() => {
    if (view !== 'rank' || mode !== 'single') return;
    if (qInput === qFromUrl) return;
    const t = setTimeout(() => { setQuery({ q: qInput, page: null }); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, qInput, qFromUrl, show, mode]);

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
    const controller = new AbortController();
    setLoading(true); setError(null);
    const qs = new URLSearchParams();
    qs.set('event', singleEvent);
    if (teamFilter) qs.set('team', teamFilter);
    if (teacherFilter) qs.set('teacherFilter', teacherFilter);
    qs.set('v', '4');
    qs.set('type', effType);
    qs.set('page', String(page));
    qs.set('size', String(size));
    if (country) qs.set('country', country);
    if (gender !== 'all') qs.set('gender', gender);
    if (show === 'persons' && basis === 'cumulative' && !qFromUrl) {
      qs.set('year', String(year));
      fetch(apiUrl(`/v1/wca/historical-ranks?${qs.toString()}`), { signal: controller.signal })
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((j: { rows: PersonRow[]; total: number }) => { if (!controller.signal.aborted) setData({ mode: 'persons', rows: j.rows, total: j.total }); })
        .catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    } else if (show === 'persons') {
      qs.set('group', 'person'); qs.set('basis', basis); qs.set('year', String(year));
      if (month > 0) qs.set('month', String(month));
      if (qFromUrl) { qs.set('q', qFromUrl); qs.set('nameMode', qMode); }
      fetch(apiUrl(`/v1/wca/all-results?${qs.toString()}`), { signal: controller.signal })
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((j: { rows: PersonRow[]; total: number }) => { if (!controller.signal.aborted) setData({ mode: 'persons', rows: j.rows, total: j.total }); })
        .catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    } else {
      qs.set('basis', basis);
      if (year > 0) qs.set('year', String(year));
      if (basis === 'period' && month > 0) qs.set('month', String(month));
      if (qFromUrl) { qs.set('q', qFromUrl); qs.set('nameMode', qMode); }
      fetch(apiUrl(`/v1/wca/all-results?${qs.toString()}`), { signal: controller.signal })
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((j: { rows: ResultRow[]; total: number }) => { if (!controller.signal.aborted) setData({ mode: 'results', rows: j.rows, total: j.total }); })
        .catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }
    return () => controller.abort();
  }, [view, mode, show, basis, singleEvent, effType, country, gender, year, month, qFromUrl, qMode, page, size, teamFilter, teacherFilter]);

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
    const controller = new AbortController();
    setLoading(true); setError(null);
    const qs = new URLSearchParams();
    qs.set('type', type);
    if (teamFilter) qs.set('team', teamFilter);
    if (teacherFilter) qs.set('teacherFilter', teacherFilter);
    qs.set('page', String(page));
    qs.set('size', String(size));
    if (country) qs.set('country', country);
    if (sorEventsParam) qs.set('events', sorEventsParam);
    if (hidePodium) qs.set('hidePodium', '1');
    if (ssort !== 'total') qs.set('sort', ssort);
    if (sdir !== 'asc') qs.set('dir', sdir);
    qs.set('v', '4');
    fetch(apiUrl(`/v1/wca/sum-of-ranks?${qs.toString()}`), { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(j => { if (!controller.signal.aborted) setSorData(j); }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [view, mode, type, country, sorEventsParam, hidePodium, ssort, sdir, page, size, teamFilter, teacherFilter]);

  const teacherStudentIds = useMemo(() => {
    if (view !== 'rank') return [];
    if (mode === 'empty') return [];
    if (mode === 'single') return data?.rows.map((row) => row.wcaId) ?? [];
    return sorData?.rows.map((row) => row.wcaId) ?? [];
  }, [view, mode, data, sorData]);
  const teacherEventIds = useMemo(() => {
    if (view !== 'rank' || mode === 'empty') return [];
    if (mode === 'single') return [singleEvent];
    return RANK_EVENTS.filter((eventId) => selectedSet.has(eventId));
  }, [view, mode, singleEvent, selectedSet]);
  const teamDirectory = useWcaTeams(teacherStudentIds);
  const teacherDirectory = useWcaTeachers(teacherStudentIds, teacherEventIds);
  const { membership, loading: membershipLoading } = useMembership();
  const [teacherOptions, setTeacherOptions] = useState<Array<{ teacherWcaId: string; teacherName: string }>>([]);
  const [teacherOptionsReady, setTeacherOptionsReady] = useState(false);
  const teacherEventsKey = teacherEventIds.join(',');
  useEffect(() => {
    if (view !== 'rank') return;
    const controller = new AbortController();
    setTeacherOptionsReady(false);
    const qs = new URLSearchParams({ options: '1', events: teacherEventsKey, v: '7' });
    fetch(apiUrl('/v1/wca/teachers?' + qs), { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Failed to load teachers');
      const data = await response.json();
      if (!Array.isArray(data.options)) throw new Error('Teacher filters unavailable');
      if (!controller.signal.aborted) { setTeacherOptions(data.options); setTeacherOptionsReady(true); }
    }).catch(() => { /* Keep the header disabled until its directory is available. */ });
    return () => controller.abort();
  }, [view, teacherEventsKey]);
  const user = useAuthUser();
  const memberActive = !membershipLoading && !!membership?.active && membership.wcaId === user?.wcaId;
  const myTeacherId = memberActive && WCA_ID_REGEX.test(user?.wcaId ?? '') ? user!.wcaId! : '';
  const requireMembership = useRequireMembership(memberActive);
  const [showMyStudentsPrompt, setShowMyStudentsPrompt] = useState(false);
  const applyMyStudents = () => {
    if (!myTeacherId) { setShowMyStudentsPrompt(true); return; }
    void setQuery({ teacherFilter: myTeacherId, myStudents: null, page: null });
  };
  // Resolve the account only after returning; shared links always contain a concrete teacher ID.
  useEffect(() => {
    if (query.myStudents !== '1' || !myTeacherId) return;
    void setQuery({ teacherFilter: myTeacherId, myStudents: null, page: null });
  }, [query.myStudents, myTeacherId, setQuery]);
  const continueMyStudents = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('myStudents', '1');
    const returnPath = url.pathname + url.search + url.hash;
    if (!requireMembership({ returnPath, requireActive: true })) return;
    if (!myTeacherId) return; // The prompt offers account binding for members without a WCA ID.
    setShowMyStudentsPrompt(false);
    applyMyStudents();
  };
  const teacherItems = teacherFilterItems(teacherOptions, isZh);
  const teacherColumnFilter = {
    value: teacherFilter,
    onChange: (value: string) => {
      if (value === '__mine__') { applyMyStudents(); return; }
      void setQuery({ teacherFilter: value || null, myStudents: null, page: null });
    },
    items: [
      { value: '__mine__', label: tr({ zh: '我的学生', en: 'My students' }) },
      ...teacherItems.map(item => ({ ...item, disabled: !teacherOptionsReady })),
    ],
    selectedLabel: myTeacherId && teacherFilter === myTeacherId ? tr({ zh: '老师：我', en: 'Teacher: me' }) : undefined,
  };
  const teamColumnFilter = {
    value: teamFilter, onChange: (value: string) => { void setQuery({ team: value || null, page: null }); },
    items: [{ value: 'none', label: tr({ zh: '未设置', en: 'Not set' }) }, ...wcaTeamSelectItems(teamDirectory.teams, 'filter')],
    disabled: !teamDirectory.ready,
  };
  const totalPages = (d: { total: number } | null) => d ? Math.max(1, Math.ceil(d.total / size)) : 1;
  const isCountryMode = !!country;
  const showBest = !!sorData && sorData.rows.length > 0 && 'bestRank' in sorData.rows[0]!;
  // 顶层「类型」下拉(单次 / 平均 = 排名口径;其余派生指标 = 嵌入 wr_metric 对应指标视图)。
  // 同时是 排名 ↔ 指标 的切换入口,故各模式(单项 / 名次和 / 空态 / 指标视图)都渲染一份,保证哪都能切。
  // 各模式互斥 → 同时只挂一份,id 不重复。单项里放在「显示」右侧,其余模式作首个控件。
  const renderTypeSelect = (availableMetricIds?: ReadonlySet<string>) => {
    const metrics = availableMetricIds
      ? WR_METRICS.filter(metric => RANK_TYPE_IDS.has(metric.id) || availableMetricIds.has(metric.id) || metric.id === typeView)
      : WR_METRICS;
    return (
      <div className="wse-filter wse-filter-show">
        <select id="wse-type-view" aria-label={tr({ zh: '类型', en: 'Type' })} className="wse-filter-select" value={typeView} onChange={(e) => onTypeViewChange(e.target.value)}>
          {metrics.map(metric => (
            <option key={metric.id} value={metric.id}>{tr({ zh: metric.zh, en: metric.en })}</option>
          ))}
        </select>
      </div>
    );
  };

  // 性别下拉(所有 / 男 / 女)。WCA 不设性别纪录,但排名按性别筛是常见口径(对标 WCA rankings / cubing.com);
  // 名次按位置算 → 自动在性别子集内重排。默认 all 省略出 URL。
  const genderSelect = (
    <div className="wse-filter wse-filter-show">
      <WcaGenderSelect value={gender} onChange={value => update('gender', value)} />
    </div>
  );
  const changeTab = (target: 'rank' | 'records') => {
    if ((target === 'records') === recordsActive) return;
    if (target === 'records') {
      const metricView = view === 'metric';
      void setQuery({ tab: target,
        rtype: metricView ? metricId : mode === 'empty' ? 'both' : type,
        revent: metricView ? query.mevent || '333' : mode === 'single' ? singleEvent : mode === 'sor' ? 'sor' : 'all',
        rshow: metricView || mode === 'sor' ? 'history' : query.rshow,
        scancelled: mode === 'sor' ? (includeCancelled ? '1' : null) : query.scancelled,
        rregion: metricView ? 'world' : countryToRecordRegion(country, countries),
        rgender: metricView ? null : gender,
        mtype: null,
      }, { history: 'push' });
    } else {
      const recordMetric = query.rtype || 'both';
      const derived = recordMetric !== 'both' && !RANK_TYPE_IDS.has(recordMetric);
      const recordEvent = RANK_EVENT_SET.has(query.revent || '') ? query.revent : null;
      void setQuery({ tab: target, view: derived ? 'metric' : null,
        mmetric: derived ? recordMetric : null, mtype: 'ranking',
        mevent: recordEvent || query.mevent || '333',
        events: recordEvent || (query.revent === 'all' ? 'all'
          : query.revent === 'sor' && mode !== 'sor' ? 'all' : query.events),
        type: RANK_TYPE_IDS.has(recordMetric) ? recordMetric : query.type,
        country: countryToRecordRegion(country, countries) === (query.rregion || 'world')
          ? country : recordRegionToCountry(query.rregion || 'world', countries),
        gender: query.rgender || null,
      }, { history: 'push' });
    }
  };

  const viewTabs = (
    <nav className="wca-stats-tab-bar wca-stats-tab-bar-connected" aria-label={tr({ zh: '排名视图', en: 'Ranking views' })}>
      <button type="button" className={`wca-stats-tab${!recordsActive ? ' active' : ''}`}
        aria-pressed={!recordsActive} onClick={() => changeTab('rank')}>
        {tr({ zh: '排名', en: 'Rankings' })}
      </button>
      <button type="button" className={`wca-stats-tab${recordsActive ? ' active' : ''}`}
        aria-pressed={recordsActive} onClick={() => changeTab('records')}>
        {tr({ zh: '纪录', en: 'Records' })}
      </button>
    </nav>
  );

  return (
    <div className="wse-page wse-results-page">
      {showMyStudentsPrompt && <MyStudentsPrompt
        loggedIn={!!user} needsWcaId={memberActive && !myTeacherId} loading={membershipLoading}
        onClose={() => setShowMyStudentsPrompt(false)} onContinue={continueMyStudents}
      />}
      <header className="wse-header">
        <PageHeading backHref="/wca" titleClassName="wse-title-row">
          {tr({ zh: '成绩', en: 'Results' })}
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
        </PageHeading>
      </header>

      {recordsActive && !legacyMetricHistory && <RecordsView embedded leadingControls={viewTabs} />}

      {/* ============ 指标视图:嵌入退役的 wr_metric;指标由「类型」下拉受控(隐藏其内置选择器)。
          顶层「类型」下拉作为 afterEventSelector 插在 WcaStatView 的项目选择器之后，与类型同行 ============ */}
      {view === 'metric' && (
        <WcaStatView
          statId="wr_metric" headerMode="note" urlScope="m" metricId={metricId}
          panelId="ranking" panelNavigation={false}
          eventId={query.mevent || '333'} onEventChange={event => setQuery({ mevent: event })}
          eventSelectorPresentation="inline"
          afterEventSelector={(availableMetricIds) => (
            <div className="wca-stats-controls">{renderTypeSelect(availableMetricIds)}{viewTabs}</div>
          )}
        />
      )}

      {/* ↓↓↓ 排名视图(本页原功能):事件多选 + 空态 / 单项 / 名次和 ↓↓↓ */}
      {view === 'rank' && (<>
      {/* 项目选择器在模式切换时保持挂载。 */}
      <div className="wse-filters wca-stats-controls">
        <div className="wse-filter wse-filter-events" style={{ minWidth: '100%' }}>
          <WcaEventMultiSelector
            presentation="inline"
            availableEvents={RANK_EVENT_SET}
            selectedEvents={selectedSet}
            onChange={setEventsSet}
            isZh={isZh}
          />
        </div>
        {mode === 'empty' && <div className="wca-stats-controls">{renderTypeSelect()}{viewTabs}</div>}
        {mode === 'single' && (<>
          <div className="wse-filter wse-filter-show">
            <label className="sr-only">{tr({ zh: '显示', en: 'Show' })}</label>
            <select
              value={String(show === 'persons')}
              onChange={event => { const v = event.currentTarget.value === 'true'; handleShowChange(v ? 'persons' : 'results'); }}
              aria-label={tr({ zh: '选手', en: 'Persons' }) + ' / ' + tr({ zh: '成绩', en: 'Results' })}
              className={['native-select', "wse-pill"].filter(Boolean).join(' ')}
            >
              <option value="true">{tr({ zh: '选手', en: 'Persons' })}</option>
              <option value="false">{tr({ zh: '成绩', en: 'Results' })}</option>
            </select>
          </div>
          <div className="wca-stats-controls">{renderTypeSelect()}{viewTabs}</div>
          <RegionCountrySelect hideLabel countries={countries} value={country} isZh={isZh} onChange={v => update('country', v)} />
          {genderSelect}
          <div className="wse-filter wse-filter-show"
            title={mbfAvgPeriodOnly ? tr({ zh: '多盲非官方平均仅支持「当期」口径', en: 'Multi-Blind unofficial average supports the period basis only' }) : undefined}>
            <label className="sr-only">{tr({ zh: '口径', en: 'Basis' })}</label>
            <select
              disabled={mbfAvgPeriodOnly}
              value={String(basis === 'cumulative')}
              onChange={event => { const v = event.currentTarget.value === 'true'; handleBasisChange(v ? 'cumulative' : 'period'); }}
              aria-label={tr({ zh: '截至', en: 'Cumulative' }) + ' / ' + tr({ zh: '当期', en: 'Period' })}
              className={['native-select', "wse-pill"].filter(Boolean).join(' ')}
            >
              <option value="true">{tr({ zh: '截至', en: 'Cumulative' })}</option>
              <option value="false">{tr({ zh: '当期', en: 'Period' })}</option>
            </select>
          </div>
          <div className="wse-filter wse-filter-show">
            <label className="sr-only">{tr({ zh: '年份', en: 'Year' })}</label>
            <select aria-label={tr({ zh: '年份', en: 'Year' })} className="wse-filter-select" value={year} onChange={e => update('year', e.target.value)}>
              {show === 'results' && <option value={0}>{tr({ zh: '全部年份', en: 'All years' })}</option>}
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {/* 截至口径按年末、不分月 → 直接隐藏月份框(不再灰显占位) */}
          {basis !== 'cumulative' && (
            <div className="wse-filter wse-filter-show">
              <label className="sr-only">{tr({ zh: '月份', en: 'Month' })}</label>
              <select
                className="wse-filter-select"
                aria-label={tr({ zh: '月份', en: 'Month' })}
                value={month}
                onChange={e => update('month', e.target.value)}
              >
                <option value={0}>{tr({ zh: '全年', en: 'All months' })}</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}
          <div className="wse-filter wse-filter-q">
            <div className="wse-name-search" role="group" aria-label={tr({ zh: '选手搜索', en: 'Person search' })}>
              <Search size={16} aria-hidden className="wse-name-search-icon" />
              <SearchInput type="search" className="wse-name-search-input" value={qInput}
                onChange={value => { setQInput(value); if (!value) update('q', ''); }}
                placeholder={show === 'persons' || qMode !== 'any'
                  ? tr({ zh: '搜索选手姓名…', en: 'Search person name…' })
                  : tr({ zh: '搜索选手或比赛…', en: 'Search person or competition…' })} />
              <div className="wse-name-search-mode">
                <select aria-label={tr({ zh: '姓名匹配方式', en: 'Name matching' })}
                  value={qMode} onChange={e => update('qmode', e.target.value === 'any' ? '' : e.target.value)}>
                  <option value="any">{tr({ zh: '包含', en: 'Contains' })}</option>
                  <option value="first">{tr({ zh: '名完全匹配', en: 'Exact first name' })}</option>
                  <option value="last">{tr({ zh: '姓完全匹配', en: 'Exact last name' })}</option>
                  <option value="exact">{tr({ zh: '全名完全匹配', en: 'Exact full name' })}</option>
                </select>
                <ChevronDown size={14} aria-hidden />
              </div>
            </div>
          </div>
        </>)}
        {mode === 'sor' && (<>
          <div className="wca-stats-controls">{renderTypeSelect()}{viewTabs}</div>
          <RegionCountrySelect hideLabel countries={countries} value={country} isZh={isZh} onChange={v => update('country', v)} />
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
        </>)}
      </div>

      {/* 排名演化数据固定覆盖 17 个现役项目，仅在选择范围一致时挂载。 */}
      {isActive17 && (
        <div className="sor-census" style={{ marginBottom: 16 }}>
          <h2 className="wse-section-title">
            {tr({ zh: 'SOR 排名演化(世界 / 大洲 / 国家)', en: 'SOR over time (World / Continent / Country)' })}
          </h2>
          <SorRace metric={type} region={countryToRecordRegion(country, countries)} />
        </div>
      )}

      {/* ============ 空态:姓名分布(name_stats viz) + 名录(A-Z 平铺) ============ */}
      {mode === 'empty' && (
        <>
          {/* ── 姓名分布 ── */}
          <h2 className="wse-section-title">{tr({ zh: '姓名分布', en: 'Name distribution' })}</h2>
          <div className="wse-table-wrapper">
            {loading && !nameStats && <div className="wse-state"><LoadingIndicator>{tr({ zh: '加载中...', en: 'Loading...' })}</LoadingIndicator></div>}
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
                  onNameModeChange={(m) => update('pname', m === 'latin' ? null : m)}
                />
              </>
            )}
          </div>

          {/* ── 名录 A–Z ── */}
          <h2 className="wse-section-title">{tr({ zh: '名录 A–Z', en: 'Directory A–Z' })}</h2>
          <div className="wse-filters">
            <RegionCountrySelect hideLabel countries={countries} value={country} isZh={isZh} onChange={v => update('country', v)} />
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
                  onChange={e => update('plmin', e.target.value || null)} />
                <span className="wse-len-dash">–</span>
                <input type="number" min={0} inputMode="numeric" className="wse-len-input"
                  placeholder={tr({ zh: '最大', en: 'max' })} value={plmax}
                  onChange={e => update('plmax', e.target.value || null)} />
                {(plmin || plmax) && (
                  <ClearButton variant="standalone"
                    onClick={() => setQuery({ plmin: null, plmax: null, page: null })} />
                )}
              </div>
            </div>
          </div>
          <div className="wse-table-wrapper sticky-scroll">
            {loading && !dirData && <div className="wse-state"><LoadingIndicator>{tr({ zh: '加载中...', en: 'Loading...' })}</LoadingIndicator></div>}
            {error && !dirData && <div className="wse-state wse-state-error">Error: {error}</div>}
            {dirData && (
              <>
                <div className="wse-result-meta">{tr({ zh: `共 ${dirData.total.toLocaleString()} 人`, en: `${dirData.total.toLocaleString()} cubers` })}</div>
                <table className="wse-table sticky-thead">
                  <thead>
                    <tr>
                      <th className="wse-rank-col">#</th>
                      <th className="wca-person-column">
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
                          <WcaPersonTeamBadge wcaId={r.wcaId} />{r.iso2 && <Flag iso2={r.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}{' '}
                          <span className="ns-person-wrap">
                            <><Link prefetch={false} href={personHref(r.wcaId)}>{nameByMode(r.name, pname)}</Link></>
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

          <div className="wse-table-wrapper sticky-scroll wse-refresh-region" aria-busy={loading}>
            {loading && <div className={data ? "wse-refresh-status" : "wse-state"} role="status"><LoadingIndicator>{tr({ zh: '加载中...', en: 'Loading...' })}</LoadingIndicator></div>}
            {error && <div className="wse-state wse-state-error">Error: {error}</div>}
            {data && data.mode === show && data.mode === 'results' && (
              <>
                <table className="wse-table sticky-thead">
                  <thead>
                    <tr>
                      <th className="wse-rank-col">#</th>
                      <WcaRelationColumnHeader className="wca-person-column" label={tr({ zh: '选手', en: 'Person' })} filterLabel={tr({ zh: '战队', en: 'Team' })} resetLabel={tr({ zh: '不限战队', en: 'Any team' })} filter={teamColumnFilter} />
                      <WcaTeacherColumnHeader filter={teacherColumnFilter} />
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
                          <WcaPersonTeamBadge wcaId={r.wcaId} />{r.iso2 && <Flag iso2={r.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}{' '}
                          <Link prefetch={false} href={personHref(r.wcaId)}>{displayCuberName(r.name, isZh)}</Link>
                        </td>
                        <WcaPersonRelationCells wcaId={r.wcaId} eventIds={teacherEventIds} teacherDirectory={teacherDirectory} teamDirectory={teamDirectory} isZh={isZh} />
                        <td className="wse-value-col">
                          <span className="record-num-cell">
                            {formatWcaResult(r.value, singleEvent, effType)}
                            {r.record && <RecordBadge record={r.record} variant="inline" iso2={r.iso2} />}
                          </span>
                        </td>
                        <td className="wse-detail-cell">{r.compDate ?? ''}</td>
                        <td><Link {...compLinkProps(r.compId)}><CompCell compId={r.compId} compName={r.compName} isZh={isZh} date={r.compDate ?? null} /></Link></td>
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
            {data && data.mode === show && data.mode === 'persons' && (
              <>
                <table className="wse-table sticky-thead">
                  <thead>
                    <tr>
                      <th className="wse-rank-col">#</th>
                      <WcaRelationColumnHeader className="wca-person-column" label={tr({ zh: '选手', en: 'Person' })} filterLabel={tr({ zh: '战队', en: 'Team' })} resetLabel={tr({ zh: '不限战队', en: 'Any team' })} filter={teamColumnFilter} />
                      <WcaTeacherColumnHeader filter={teacherColumnFilter} />
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
                          <WcaPersonTeamBadge wcaId={r.wcaId} />{r.iso2 && <Flag iso2={r.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}{' '}
                          <Link prefetch={false} href={personHref(r.wcaId)}>{displayCuberName(r.name, isZh)}</Link>
                        </td>
                        <WcaPersonRelationCells wcaId={r.wcaId} eventIds={teacherEventIds} teacherDirectory={teacherDirectory} teamDirectory={teamDirectory} isZh={isZh} />
                        <td className="wse-value-col">{r.value != null ? formatWcaResult(r.value, singleEvent, effType) : '—'}</td>
                        <td className="wse-detail-cell">{r.compDate ?? ''}</td>
                        <td>{r.compId ? <Link {...compLinkProps(r.compId)}><CompCell compId={r.compId} compName={r.compName} isZh={isZh} date={r.compDate ?? null} /></Link> : ''}</td>
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
          <div className="wse-table-wrapper sticky-scroll wse-refresh-region" aria-busy={loading}>
            {loading && <div className={sorData ? "wse-refresh-status" : "wse-state"} role="status"><LoadingIndicator>{tr({ zh: '加载中...', en: 'Loading...' })}</LoadingIndicator></div>}
            {error && <div className="wse-state wse-state-error">{error}</div>}
            {sorData && (
              <>
                <table className="wse-table sticky-thead">
                  <thead>
                    <tr>
                      <th className="wse-rank-col">#</th>
                      <WcaRelationColumnHeader className="wca-person-column" label={tr({ zh: '选手', en: 'Person' })} filterLabel={tr({ zh: '战队', en: 'Team' })} resetLabel={tr({ zh: '不限战队', en: 'Any team' })} filter={teamColumnFilter} />
                      <WcaTeacherColumnHeader filter={teacherColumnFilter} />
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
                            <WcaPersonTeamBadge wcaId={r.wcaId} />{r.iso2 && <Flag iso2={r.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                            <Link prefetch={false} href={personHref(r.wcaId)}>{displayCuberName(r.name, isZh)}</Link>
                          </span>
                        </td>
                        <WcaPersonRelationCells wcaId={r.wcaId} eventIds={teacherEventIds} teacherDirectory={teacherDirectory} teamDirectory={teamDirectory} isZh={isZh} />
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
    <Suspense fallback={<div style={{ padding: 16, color: 'var(--muted)' }}><LoadingIndicator /></div>}>
      <AllResultsPageInner />
    </Suspense>
  );
}
