'use client';
import MoreToggle from '@/components/MoreToggle';
import { SettingsPopover } from '@/components/TrainingSettings';
import PersonLink from '@/components/PersonLink';
import '@cuberoot/timer-ui/compact-select.css';

/**
 * 顶尖选手近期比赛追踪页 — 日历视图
 * 数据源: stats/upcoming_comps.json（Top 模式） + stats/all_upcoming_comps.json（All 模式）
 *
 * 1:1 port from packages/client-vite/src/pages/CalendarPage.tsx (Vite SPA).
 * Adapted for Next.js App Router: react-router-dom Link → next/link Link (href),
 * '../i18n' → '@/i18n/i18n-client', '../components/X' → '@/components/X',
 * '../utils/X' → '@/lib/<kebab>', './calendar/OnThisDayModal' → './_components/OnThisDayModal'.
 * Wrap default export in Suspense because next/navigation useSearchParams requires it.
 */
import { Suspense, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useQueryState, useQueryStates, parseAsStringEnum, parseAsInteger, parseAsString, parseAsArrayOf, parseAsBoolean } from 'nuqs';
import Link from '@/components/AppLink';
import { COMPETITION_VIEWS, loadCalendarManifest, loadCalendarMonth, type CompetitionView } from '@/lib/competition-calendar';
import type { CalendarManifest } from '@cuberoot/shared/competition-calendar';
import PageHeading from '@/components/PageHeading';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Earth as GlobeIcon, List, BarChart3, CalendarRange, HelpCircle, Users, Gauge, Percent, CaseSensitive, MapPin, Mountain, MoveVertical, MoveHorizontal, ArrowDownAZ, ArrowDownZA } from '@app-foundation/icons/lucide';
import { SortArrow } from '@/components/SortArrow';
import {
  fetchAllUpcomingCompsJson,
  fetchAllPastCompsJson,
  fetchCompRoundMetaJson,
  type UpcomingCompRecord,
  type PastCompRecord,
  type CompRoundMetaMap,
} from '@cuberoot/shared';
import { usePanelClamp } from '@/hooks/usePanelClamp';
import { toIsoDate } from '@/lib/wca-date';
import { Flag as SharedFlag } from '@/components/Flag';
import { YearMonthPickerPopover } from '@/components/YearMonthPickerPopover';
import { RecordBadge } from '@/components/RecordBadge';
import { CompetitionSearchFilters } from '@/components/competitions/CompetitionSearchFilters';
import { CompetitionViewToggle } from '@/components/competitions/CompetitionViewToggle';
import {
  loadCompRecordsSummary,
  loadCompRecordsDetail,
  getCompRecordTop,
  getCompRecordEntries,
  type RecordEntry,
} from '@/lib/comp-records';
import { formatWcaResult } from '@/lib/wca-format-result';
import { loadFlagData, personFlagIso2, countryToIso2 } from '@/lib/country-flags';
import { defaultCancelledCutoffIso, isCancelledComp, competitionCountryOptions, competitionMatchesQuery } from '@/lib/comp-search';
import { countryName } from '@/lib/country-name';
import { expandCountrySelection } from '@/lib/continent';
import { fetchCompRounds } from '@/lib/comp-wcif';
import { statsUrl } from '@/lib/stats-base';
import { ClearButton } from '@/components/ClearButton';
import { CubingIcon, EventIcon } from '@/components/EventIcon';
import { getPerson, WCA_ID_REGEX, type WcaPersonLite } from '@/lib/wca-api';
import { usePersonCompetitionIds } from '@/hooks/usePersonCompetitionIds';
import dynamic from 'next/dynamic';
import { useEntryRouter as useRouter } from '@/hooks/useEntryRouter';
import { CompCardWithRounds, wcaRoundsSeed } from '@/components/CompCardWithRounds';
import OnThisDayModal from './_components/OnThisDayModal';
import MonthGrid from '@/components/MonthGrid';
import BoolToggle from '@/components/BoolToggle';
import { useCompFollows } from '@/components/CompFollow';
import { authActions } from '@/lib/auth-store';
import {
  CompetitionList, COMP_METRICS, EVENT_METRICS, EVENT_ORDER, SHORT_TO_EVENT_ID, WCA_EVENT_ID_TO_SHORT, WCIF_META_METRICS,
  Flag, FollowMark, compColTitle, coordColTitle, daysBetween, localizeName, parseLocalDate, regCardPill, regState, subColTitle,
  type Competition, type CompMetric, type CoordKey, type EventMetric, type ListSort, type SortCol, type SubKey, type TopCuber,
} from '@/components/competitions/CompetitionList';
import './calendar_page.css';
import './comp.css';
import { tr } from '@/i18n/tr';
import { LoadingIndicator } from '@/components/LoadingIndicator';

// view=globe 视图:地球是本页的一个视图,不是自己的路由 —— 实现放在 wca/_globe/,
// 下划线前缀让 Next 不当它是路由段(同 alg/_roux、alg/_trainer)。
// dynamic + ssr:false 懒加载,~550KB maplibre 仅在切到地球视图时下载,不进日历首屏 bundle。
const GlobeMapClient = dynamic(() => import('../_globe/GlobeMapClient'), {
  ssr: false,
  loading: () => <div className="comp-globe-loading"><LoadingIndicator /></div>,
});

// ── 类型定义 ──────────────────────────────────────────────────────────────

interface UpcomingData {
  competitions: Competition[];
}

// ── 常量 ──────────────────────────────────────────────────────────────────

const SOON_DAYS = 7;
const MAX_TRACKS = 3;

const WEEKDAY_EN = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const WEEKDAY_ZH = ['一','二','三','四','五','六','日'];
// ── 工具函数 ──────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** 获取月历起始日（包含 month 第 1 日那一周的周日） */
function monthGridStart(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  // NOTE: Mon-first 布局 — JS getDay() 里 Sun=0, Mon=1, ..., Sat=6；(day+6)%7 映射为 Mon=0, Tue=1, ..., Sun=6
  return addDays(first, -((first.getDay() + 6) % 7));
}

// ── 日历计算 ──────────────────────────────────────────────────────────────

interface EventBar {
  comp: Competition;
  startCol: number; // 1-7
  span: number;
  track: number;
  rowSpan: number; // 该 bar 在所跨列里向下能占多少 track 行（无下方阻挡时延伸）
  continuesFromPrev: boolean;
  continuesToNext: boolean;
  key: string;
}

interface WeekRow {
  days: Date[];
  bars: EventBar[];
  overflowByCol: Map<number, Competition[]>;
  maxTrack: number;
}

/** 计算一个月所有周行的事件布局 */
function computeWeeks(
  viewYear: number,
  viewMonth: number,
  comps: Competition[],
  priorityCountries: Set<string> = new Set(),
): WeekRow[] {
  const gridStart = monthGridStart(viewYear, viewMonth);
  const monthStart = new Date(viewYear, viewMonth, 1);
  const monthEnd = new Date(viewYear, viewMonth + 1, 0);
  const weeks: WeekRow[] = [];

  // NOTE: 生成最多 6 行，最后一行如果整行都是下月数据则省略
  for (let w = 0; w < 6; w++) {
    const weekStart = addDays(gridStart, w * 7);
    const weekEnd = addDays(weekStart, 6);

    // 如果 weekStart 已经超过当月末一周且整周都在下月，停
    if (w >= 4) {
      if (weekStart > monthEnd) break;
    }

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) days.push(addDays(weekStart, i));

    // NOTE: 事件只在当月内显示 — 本周有效区间 = 本周 ∩ 本月
    const effStart = weekStart < monthStart ? monthStart : weekStart;
    const effEnd = weekEnd > monthEnd ? monthEnd : weekEnd;

    // 找出与本周有效区间相交的比赛
    const overlaps: Competition[] = comps.filter((c) => {
      const s = parseLocalDate(c.start_date);
      const e = parseLocalDate(c.end_date || c.start_date);
      return e >= effStart && s <= effEnd;
    }).sort((a, b) => {
      // 0. 选中国家的比赛绝对优先（保证被选国家的比赛不会因长赛事挤占而变 overflow）
      if (priorityCountries.size > 0) {
        const am = priorityCountries.has(a.country.toUpperCase()) ? 0 : 1;
        const bm = priorityCountries.has(b.country.toUpperCase()) ? 0 : 1;
        if (am !== bm) return am - bm;
      }
      // 1. 持续天数越多越靠前（长赛事优先占可见 track）
      const aDays = daysBetween(parseLocalDate(a.start_date), parseLocalDate(a.end_date || a.start_date));
      const bDays = daysBetween(parseLocalDate(b.start_date), parseLocalDate(b.end_date || b.start_date));
      if (aDays !== bDays) return bDays - aDays;
      // 2. top cubers 多的靠前
      const tcDiff = b.top_cubers.length - a.top_cubers.length;
      if (tcDiff !== 0) return tcDiff;
      // 3. 开始日期早的靠前
      return a.start_date.localeCompare(b.start_date);
    });

    // 贪心分配 track
    const tracks: Competition[][] = [];
    const compTrack = new Map<Competition, number>();
    for (const c of overlaps) {
      const s = parseLocalDate(c.start_date);
      const e = parseLocalDate(c.end_date || c.start_date);
      let placed = false;
      for (let t = 0; t < tracks.length; t++) {
        const conflict = tracks[t].some((o) => {
          const os = parseLocalDate(o.start_date);
          const oe = parseLocalDate(o.end_date || o.start_date);
          return s <= oe && e >= os;
        });
        if (!conflict) {
          tracks[t].push(c);
          compTrack.set(c, t);
          placed = true;
          break;
        }
      }
      if (!placed) {
        tracks.push([c]);
        compTrack.set(c, tracks.length - 1);
      }
    }

    const bars: EventBar[] = [];
    const overflowByCol = new Map<number, Competition[]>();
    let maxTrack = -1;

    for (const c of overlaps) {
      const track = compTrack.get(c)!;
      const s = parseLocalDate(c.start_date);
      const e = parseLocalDate(c.end_date || c.start_date);
      const clippedStart = s < effStart ? effStart : s;
      const clippedEnd = e > effEnd ? effEnd : e;
      const startCol = daysBetween(weekStart, clippedStart) + 1;
      const span = daysBetween(clippedStart, clippedEnd) + 1;

      if (track < MAX_TRACKS) {
        bars.push({
          comp: c,
          startCol,
          span,
          track,
          rowSpan: 1, // 占位，下面统一计算
          continuesFromPrev: s < effStart,
          continuesToNext: e > effEnd,
          key: `${c.id}-${w}`,
        });
        maxTrack = Math.max(maxTrack, track);
      } else {
        // 放进溢出区：从该事件起止每一天都 +1
        for (let d = 0; d < span; d++) {
          const col = startCol + d;
          if (!overflowByCol.has(col)) overflowByCol.set(col, []);
          overflowByCol.get(col)!.push(c);
        }
      }
    }

    // NOTE: 计算每个 bar 能向下扩展的 track 行数。bar 所跨列里，找下方最近的占用 track（其它 bar 或 +N 溢出按钮）作为阻挡，
    // 取所有列阻挡的最小值。无阻挡时延伸到 MAX_TRACKS。这样单一比赛能占满日格的空白区，长名字可以换行显示。
    const occupiedByCol = new Map<number, Set<number>>();
    for (const b of bars) {
      for (let c = b.startCol; c < b.startCol + b.span; c++) {
        let set = occupiedByCol.get(c);
        if (!set) { set = new Set(); occupiedByCol.set(c, set); }
        set.add(b.track);
      }
    }
    const overflowRowFor = (col: number): number | null =>
      overflowByCol.has(col) ? Math.min(MAX_TRACKS, maxTrack + 1) + 2 : null;
    for (const b of bars) {
      let endRow = MAX_TRACKS + 2; // grid row exclusive 下界（最后 track row 后）
      for (let c = b.startCol; c < b.startCol + b.span; c++) {
        const tracks = occupiedByCol.get(c);
        let blocker = MAX_TRACKS + 2;
        if (tracks) {
          for (const t of tracks) {
            if (t > b.track) {
              const r = t + 2;
              if (r < blocker) blocker = r;
            }
          }
        }
        const ofr = overflowRowFor(c);
        if (ofr !== null && ofr < blocker) blocker = ofr;
        if (blocker < endRow) endRow = blocker;
      }
      b.rowSpan = Math.max(1, endRow - (b.track + 2));
    }

    weeks.push({ days, bars, overflowByCol, maxTrack });
  }

  return weeks;
}

interface CompactDayTile {
  /** 代表比赛(同国家当日 top-priority)。count==1 时点击进 CompModal,>1 时进 day-list */
  rep: Competition;
  /** 同国家当日总场数 */
  count: number;
  /** 该国家当日是否全部已取消 */
  allCancelled: boolean;
}

interface CompactWeekRow {
  days: Date[];
  byDay: CompactDayTile[][];
}

/** 紧凑模式布局：仅按 start_date 把比赛归到日格,同国家当天去重为一面旗。 */
function computeCompactWeeks(
  viewYear: number,
  viewMonth: number,
  comps: Competition[],
  priorityCountries: Set<string>,
  cancelledCutoffIso: string,
): CompactWeekRow[] {
  const gridStart = monthGridStart(viewYear, viewMonth);
  const monthEnd = new Date(viewYear, viewMonth + 1, 0);

  const byDate = new Map<string, Competition[]>();
  for (const c of comps) {
    const arr = byDate.get(c.start_date);
    if (arr) arr.push(c);
    else byDate.set(c.start_date, [c]);
  }

  const sortFn = (a: Competition, b: Competition) => {
    if (priorityCountries.size > 0) {
      const am = priorityCountries.has(a.country.toUpperCase()) ? 0 : 1;
      const bm = priorityCountries.has(b.country.toUpperCase()) ? 0 : 1;
      if (am !== bm) return am - bm;
    }
    const tcDiff = b.top_cubers.length - a.top_cubers.length;
    if (tcDiff !== 0) return tcDiff;
    return a.id.localeCompare(b.id);
  };

  const weeks: CompactWeekRow[] = [];
  for (let w = 0; w < 6; w++) {
    const weekStart = addDays(gridStart, w * 7);
    if (w >= 4 && weekStart > monthEnd) break;
    const days: Date[] = [];
    const byDay: CompactDayTile[][] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      days.push(d);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const list = byDate.get(key);
      if (!list || list.length === 0) {
        byDay.push([]);
        continue;
      }
      const sorted = [...list].sort(sortFn);
      // 按国家分桶,代表是排序后第一个
      const tilesByCountry = new Map<string, CompactDayTile>();
      for (const c of sorted) {
        const country = c.country.toLowerCase();
        const cancelled = isCancelledComp(c, cancelledCutoffIso);
        const ex = tilesByCountry.get(country);
        if (!ex) {
          tilesByCountry.set(country, { rep: c, count: 1, allCancelled: cancelled });
        } else {
          ex.count++;
          if (!cancelled) ex.allCancelled = false;
        }
      }
      // 国家 tile 按当日场数降序;同场数走代表 comp 已有的 priority(top_cubers / id)
      const tiles = [...tilesByCountry.values()].sort((a, b) => {
        if (a.count !== b.count) return b.count - a.count;
        return sortFn(a.rep, b.rep);
      });
      byDay.push(tiles);
    }
    weeks.push({ days, byDay });
  }
  return weeks;
}

// ── 详情模态框 ────────────────────────────────────────────────────────────

function CompModal({ comp, isZh, onClose, t, cancelled, loggedIn, followed, onToggleFollow, onRequireLogin }: {
  comp: Competition;
  isZh: boolean;
  onClose: () => void;
  t: (k: string, o?: Record<string, unknown>) => string;
  cancelled: boolean;
  loggedIn: boolean;
  followed: boolean;
  onToggleFollow: (id: string) => void;
  onRequireLogin: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [recordEntries, setRecordEntries] = useState<RecordEntry[]>([]);
  useEffect(() => {
    loadCompRecordsDetail().then(() => {
      setRecordEntries(getCompRecordEntries(comp.id));
    });
  }, [comp.id]);

  const lang = isZh ? 'zh' : 'en';
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // 报名状态 pill — 与卡片/列表同口径(已结束→「比赛已结束」;否则下一个里程碑;已过且无字段补「报名已截止」)
  const reg = regCardPill(comp, todayStart);

  // 单场弹窗 = 一张卡片(CompCard 同款),底部嵌纪录区(过去比赛才有);轮次缺省时单场可懒拉 WCIF。
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel comp-card-modal" onClick={(ev) => ev.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <CompCardWithRounds
          comp={comp}
          isZh={isZh}
          lang={lang}
          pill={reg}
          dimmed={cancelled}
          competitorLimit={comp.competitor_limit || null}
          follow={{ followed, onToggle: onToggleFollow, loggedIn, onRequireLogin }}
          roundsSeed={wcaRoundsSeed(comp.rounds)}
          fetchIfMissing
          topCubers={comp.top_cubers}
        >
          {recordEntries.length > 0 && (
            <div className="rc-records">
              <div className="rc-cubers-title">{t('upcoming.records', { count: recordEntries.length })}</div>
              <ul className="modal-record-list">
                {recordEntries.map((r, idx) => (
                  <li key={idx} className="modal-record-item">
                    <RecordBadge record={r.t} />
                    <CubingIcon icon={`event-${r.e}`} />
                    <span className="record-kind">{r.k === 's' ? t('upcoming.single') : t('upcoming.average')}</span>
                    <span className="record-value mono">{formatWcaResult(r.v, r.e, r.k === 's' ? 'single' : 'average')}</span>
                    <span className="record-person">
                      <PersonLink wcaId={r.p} name={r.n} isZh={isZh}
                        flag={<><SharedFlag iso2={personFlagIso2(r.p)} />{' '}</>} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CompCardWithRounds>
      </div>
    </div>
  );
}

// NOTE: 预生成 all_upcoming_comps.json 记录 → 本组件 Competition 结构适配
// 合并 top_cubers（从 Top 模式数据字典中反查）
function adaptAllComp(w: UpcomingCompRecord, topCuberMap: Map<string, TopCuber[]>): Competition {
  return {
    id: w.id,
    name: w.name,
    city: w.city,
    country: w.country,
    start_date: w.start_date,
    end_date: w.end_date,
    events: w.events,
    rounds: w.rounds,
    dual_events: w.dual_events,
    h2h_events: w.h2h_events,
    event_regs: w.event_regs,
    roundMeta: w.round_meta,
    competitor_limit: w.competitor_limit,
    registered: w.registered,
    registration_open: w.registration_open ?? undefined,
    registration_close: w.registration_close ?? undefined,
    event_change_deadline: w.event_change_deadline ?? undefined,
    latitude_degrees: w.latitude_degrees,
    longitude_degrees: w.longitude_degrees,
    elevation: w.elevation,
    top_cubers: topCuberMap.get(w.id) ?? [],
  };
}

function adaptPastComp(w: PastCompRecord): Competition {
  // NOTE: past JSON 的 country 是 WCA country_id 全名（"China"），统一转为大写 ISO2 与 upcoming JSON 对齐
  const iso2 = countryToIso2(w.country).toUpperCase();
  return {
    id: w.id,
    name: w.name,
    city: w.city,
    country: iso2 || w.country,
    start_date: w.start_date,
    end_date: w.end_date,
    events: w.events,
    rounds: w.rounds,
    dual_events: w.dual_events,
    h2h_events: w.h2h_events,
    event_regs: w.event_regs,
    competitor_limit: w.competitor_limit ?? 0,
    competitors: w.competitors,
    latitude_degrees: w.latitude_degrees,
    longitude_degrees: w.longitude_degrees,
    elevation: w.elevation,
    top_cubers: [],
  };
}

// ── URL 月份深链 ──────────────────────────────────────────────────────────

/** 校验 YYYY-MM 字符串（年 1900-2099，月 01-12）。空串 / 不合规 → false（不参与过滤） */
function validYM(s: string): boolean {
  return /^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(s);
}

function readMonthFromUrl(): Date | null {
  if (typeof window === 'undefined') return null;
  const p = new URLSearchParams(window.location.search);
  const y = Number(p.get('year'));
  const m = Number(p.get('month'));
  if (!y || !m || m < 1 || m > 12) return null;
  return new Date(y, m - 1, 1);
}

// 日历视图的两种排布:'comp' = 每场比赛一条 event-bar(原 calendar);'country' = 同国当天聚成一面国旗(原 compact)。
// 由 month-bar 的原生下拉菜单切换,取代原先独立的「紧凑」视图图标。
type CalLayout = 'comp' | 'country';
const CAL_LAYOUTS: CalLayout[] = ['comp', 'country'];

// 首秀过滤维度：'off' = 不过滤；'country' = 每个国家的第一场比赛；'event' = 每个项目首次出现的那场比赛
type DebutMode = 'off' | 'country' | 'event';
const DEBUT_MODES: DebutMode[] = ['off', 'country', 'event'];
// 值较宽（时间 / 及格线 / 晋级）的 metric — 列表事件列要加宽，避免 1.3rem 挤不下 "10:00"
const WIDE_METRICS = new Set<EventMetric>(['timeLimit', 'cutoff', 'advancement']);

// ── 主组件 ────────────────────────────────────────────────────────────────

function CalendarPageInner() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const router = useRouter();
  // 比赛关注「盯一下」:登录用户跨设备同步的关注集合(server PG)。在页顶调用一次,把状态下发给
  // 模态 / 列表 / 日历条 / day-list,与首页 OngoingComps 共用同一份 server 数据。
  const { loggedIn: followLoggedIn, follows, toggle: toggleFollow } = useCompFollows();
  const login = authActions.login;

  const [data, setData] = useState<UpcomingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compQuery, setCompQuery] = useQueryState('q', parseAsString.withDefault('').withOptions({ history: 'replace', scroll: false }));
  const [cuberParam, setCuberParam] = useQueryState('cuber', parseAsString.withOptions({ history: 'replace', scroll: false }));
  const normalizedCuber = cuberParam?.trim().toUpperCase() ?? '';
  const selectedCuberId = WCA_ID_REGEX.test(normalizedCuber) ? normalizedCuber : undefined;
  // 选手筛选: 静态层(top_cubers + cn_upcoming_registrations) 优先,API 兜底
  const [resolvedCuber, setResolvedCuber] = useState<WcaPersonLite | null>(null);
  const selectedCuber = selectedCuberId
    ? resolvedCuber?.id === selectedCuberId ? resolvedCuber : { id: selectedCuberId, name: selectedCuberId, country_iso2: '' }
    : null;
  const setSelectedCuber = (person: WcaPersonLite | null) => {
    setResolvedCuber(person);
    void setCuberParam(person?.id ?? null);
  };
  useEffect(() => {
    if (!selectedCuberId || resolvedCuber?.id === selectedCuberId) return;
    let active = true;
    void getPerson(selectedCuberId).then(person => { if (active && person) setResolvedCuber(person); });
    return () => { active = false; };
  }, [selectedCuberId, resolvedCuber?.id]);
  const [cnRegistrations, setCnRegistrations] = useState<Record<string, string[]> | null>(null);
  const [countryFilters, setCountryFilters] = useQueryState(
    'country',
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ history: 'replace', scroll: false }),
  );
  // NOTE: 月份锚点。优先读 URL `?year=YYYY&month=M`（来自 /calendar/stats 热力图深链），
  //       否则用 now（首次加载后若有 upcoming 会跳到最近一场比赛的月份）。
  const [viewDate, setViewDate] = useState<Date>(() => readMonthFromUrl() ?? new Date());
  const [selectedComp, setSelectedComp] = useState<Competition | null>(null);
  const [dayListDate, setDayListDate] = useState<Date | null>(null);
  /** 当日弹窗是否展示每张卡片的顶尖选手(默认不展示,头部 BoolToggle 控制)。 */
  const [dayListShowCubers, setDayListShowCubers] = useState(false);
  /** 紧凑模式下点击国旗 tile 时,把 modal 限定到该国家(iso2 小写)。其他场景为 null。 */
  const [dayListCountry, setDayListCountry] = useState<string | null>(null);
  // 点日历格子日期数字 → 打开"历年此日"模态(查跨年 MM-DD 比赛历史)
  const [onThisDayDate, setOnThisDayDate] = useState<Date | null>(null);
  const [mode, setMode] = useState<'top' | 'all'>('all');
  const [allComps, setAllComps] = useState<Competition[] | null>(null);
  const [allLoading, setAllLoading] = useState(false);
  const [calendarManifest, setCalendarManifest] = useState<CalendarManifest | null>(null);
  const [monthComps, setMonthComps] = useState<{ month: string; rows: Competition[] } | null>(null);
  const calendarMonth = viewDate.getFullYear() + '-' + String(viewDate.getMonth() + 1).padStart(2, '0');
  const globalSummary = mode === 'all' && !allComps ? calendarManifest : null;
  const [allError, setAllError] = useState<string | null>(null);
  // 权威双轮标记（dump rounds.linked_round_id → stats/comp_dual.json，键=完整 WCA event id）。
  // 列表的 dual 筛选/标记本吃 all_past_comps.json 烘焙的 dual_events，但那份由每日 stats CI 重生成、
  // 可能滞后于 linked_round_id 逻辑上线（且不含未结束比赛）。这里整取权威源叠加到 activeComps，
  // 与详情页 loadCompDual 同源。文件极小（几十场），一次拉取。
  const [compDual, setCompDual] = useState<Record<string, string[]>>({});
  // 每个项目独立的轮次约束。1..max = 精确匹配；'any' = 项目存在即过（不检查轮次）；
  // 缺 key = 不过滤此项目。chip 单击循环：undefined → 1 → ... → max → 'any' → undefined。
  // 'any' 状态在 UI 上仅通过 is-active 边框体现（badge 空），不显式写"≥1"等文字。
  const [eventFilters, setEventFilters] = useState<Record<string, 'any' | 1 | 2 | 3 | 4>>({});
  // 按比赛天数过滤：null = 不过滤；1..max = 精确匹配该天数（start~end 跨的天数）。
  // chip 单击循环：null → 1 → 2 → ... → max → null。
  const [daysFilter, setDaysFilter] = useState<number | null>(null);
  // 视图状态走 URL(nuqs):切换 push 进历史 → iOS 左缘滑 / 浏览器后退能在视图间返回;
  // 后退 / 前进由 nuqs 自动同步,无需手写 popstate。calendar 为默认值,自动从 URL 省略。
  const [viewMode, setViewMode] = useQueryState(
    'view',
    parseAsStringEnum<CompetitionView>([...COMPETITION_VIEWS]).withDefault('calendar').withOptions({ history: 'push' }),
  );
  // 日历布局子开关:比赛(event-bar) / 国家(国旗聚合)。仅日历视图有意义;replace 不堆历史(子开关)。
  const [calLayout, setCalLayout] = useQueryState(
    'clayout',
    parseAsStringEnum<CalLayout>(CAL_LAYOUTS).withDefault('comp').withOptions({ history: 'replace', scroll: false }),
  );
  // list 视图每个项目格子显示什么：rounds=轮次数(默认) / regs=报名(参赛)人数。replace 不堆历史。
  const [eventMetric, setEventMetric] = useQueryState(
    'metric',
    parseAsStringEnum<EventMetric>(EVENT_METRICS).withDefault('rounds').withOptions({ history: 'replace', scroll: false }),
  );
  // 年月用于分享当前月份，初值由 readMonthFromUrl 读取。
  const [, setUrlState] = useQueryStates(
    { year: parseAsInteger, month: parseAsInteger },
    { history: 'replace', scroll: false },
  );
  // 列表视图下的年月范围过滤（YYYY-MM 字符串；不合规或空 = 不参与过滤）
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // 列表 sticky 年份（chip 行左侧 cell 显示）；CompList 滚动时回调更新
  const [currentYear, setCurrentYear] = useState<{ year: string; count: number } | null>(null);
  // 列表整场列显示哪个 metric（实际人数/上限/满员率/不显示）。replace 不堆历史。
  const [compMetric, setCompMetric] = useQueryState(
    'cmetric',
    parseAsStringEnum<CompMetric>(COMP_METRICS).withDefault('peopleLimit').withOptions({ history: 'replace', scroll: false }),
  );
  // 列表统一排序（点列头循环 降→升→默认日期序）：整场列 / 比赛名 / 城市名。null = 日期倒序。
  const [listSort, setListSort] = useState<ListSort>(null);
  // 切 metric 时,若当前正按整场列排,清掉(列含义变了);按名字/城市排的与 metric 无关,保留
  useEffect(() => { setListSort((s) => s?.col === 'comp' ? null : s); }, [compMetric]);
  // 点某列头：未排该列 → 降序；已降序 → 升序；已升序 → 取消(回日期序)。coord 用于 latlng 子列
  const cycleSort = useCallback((col: SortCol, coord?: SubKey) => {
    setListSort((s) => {
      if (s && s.col === col && s.coord === coord) {
        return s.dir === 'desc' ? { col, coord, dir: 'asc' } : null;
      }
      return { col, coord, dir: 'desc' };
    });
  }, []);
  // 过去比赛 round-1 meta（~4MB）懒加载：仅列表视图选中 限时/及格/晋级/资格 时才拉
  const [pastMeta, setPastMeta] = useState<CompRoundMetaMap | null>(null);
  const pastMetaTriedRef = useRef(false);
  useEffect(() => {
    if (viewMode !== 'list' || !WCIF_META_METRICS.has(eventMetric)) return;
    if (pastMetaTriedRef.current) return;
    pastMetaTriedRef.current = true;
    fetchCompRoundMetaJson().then(setPastMeta).catch(() => { pastMetaTriedRef.current = false; });
  }, [viewMode, eventMetric]);
  // 已取消过滤：'all' = 默认包含；'only' = 仅展示已取消
  const [cancelledFilter, setCancelledFilter] = useState<'all' | 'only'>('all');
  // 首秀过滤：'country' 只保留每个国家最早的那一场比赛；'event' 只保留每个项目首次出现的那场比赛。走 nuqs，可分享深链。
  const [debutMode, setDebutMode] = useQueryState(
    'debuts',
    parseAsStringEnum<DebutMode>(DEBUT_MODES).withDefault('off').withOptions({ history: 'replace', scroll: false }),
  );
  // 双轮赛制（WCA Reg 9v，2026+）：只保留含≥1 个双轮项目的比赛。走 nuqs，可分享深链。
  const [dualOnly, setDualOnly] = useQueryState(
    'dual',
    parseAsBoolean.withDefault(false).withOptions({ history: 'replace', scroll: false }),
  );
  // H2H（Head to Head）：只保留含至少一个 format=h 项目的比赛。走 nuqs，可分享深链。
  const [h2hOnly, setH2hOnly] = useQueryState(
    'h2h',
    parseAsBoolean.withDefault(false).withOptions({ history: 'replace', scroll: false }),
  );
  // 合并筛选菜单(issue #33):已取消 / 首秀 / 双轮 / H2H + (仅列表视图)整场列/项目格 metric。
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersWrapRef = useRef<HTMLDivElement>(null);
  const filtersPanelRef = useRef<HTMLDivElement>(null);
  usePanelClamp(filtersOpen, filtersPanelRef);
  useEffect(() => {
    if (!filtersOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!filtersWrapRef.current?.contains(e.target as Node)) setFiltersOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFiltersOpen(false); };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [filtersOpen]);
  // 三个 popover 共用一份 state：'month' = 日历模式月份选择；'from'/'to' = 列表模式年月范围
  const [pickerOpen, setPickerOpen] = useState<'month' | 'from' | 'to' | null>(null);
  const monthBtnRef = useRef<HTMLButtonElement>(null);
  const fromBtnRef = useRef<HTMLButtonElement>(null);
  const toBtnRef = useRef<HTMLButtonElement>(null);
  // chip 表头 + 列表外层 — 用来同步横向 scrollLeft（移动端两者各自横向滚动，需要联动）
  const chipsHeaderRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const [recordsVer, setRecordsVer] = useState(0);

  // 已取消判定 cutoff:每次 mount 固定一次,mount 期间不变。
  const cancelledCutoffIso = useMemo(() => defaultCancelledCutoffIso(), []);

  useEffect(() => {
    loadCompRecordsSummary().then((v) => setRecordsVer(v));
    // NOTE: loadFlagData 加载 comp_names_zh.json，完成后触发重渲染以应用中文名
    loadFlagData().then((v) => setRecordsVer(v));
    // NOTE: cubing.com 中国比赛全员注册 (WCA API 不覆盖) — 失败/无文件时静默置空,前端走 API 兜底
    fetch(statsUrl('/stats/cn_upcoming_registrations.json'))
      .then((r) => (r.ok ? r.json() : {}))
      .then((j: Record<string, string[]>) => setCnRegistrations(j))
      .catch(() => setCnRegistrations({}));
  }, []);

  // NOTE: viewDate 变化时同步 URL（?year= ?month=），方便复制分享当前月份链接
  useEffect(() => {
    if (viewMode === 'globe') return; // 地球视图把 URL 让给 globe 自己的参数(wcaId 等)
    setUrlState({ year: viewDate.getFullYear(), month: viewDate.getMonth() + 1 });
  }, [viewDate, viewMode, setUrlState]);

  // 视图切换 / 后退由上面的 useQueryState(nuqs)自动管理,无需手写 changeView / popstate。

  useEffect(() => {
    fetch(statsUrl('/stats/upcoming_comps.json'))
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load JSON');
        return res.json();
      })
      .then((d: UpcomingData) => {
        setData(d);
        // NOTE: URL 已指定年月时不自动跳——尊重深链（如 /calendar/stats 热力图来的）
        if (readMonthFromUrl()) return;
        // NOTE: 默认跳到包含最近一场比赛的月份（如果今天之后有比赛的话）
        const now = new Date();
        const upcoming = d.competitions
          .map((c) => parseLocalDate(c.start_date))
          .filter((dt) => dt >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
          .sort((a, b) => a.getTime() - b.getTime());
        if (upcoming.length > 0) {
          const first = upcoming[0];
          setViewDate(new Date(first.getFullYear(), first.getMonth(), 1));
        }
      })
      .catch(() => setError(t('upcoming.loadError')));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 权威双轮标记：一次性拉 comp_dual.json（{compId: [完整 event id]}）叠加到 activeComps
  useEffect(() => {
    fetch(statsUrl('/stats/comp_dual.json'))
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: Record<string, string[]>) => setCompDual(d))
      .catch(() => {});
  }, []);

  // Calendar/cards download a complete visible window; list and recovery retain the full source.
  useEffect(() => {
    if (allComps) { setAllLoading(false); return; }
    if (mode !== 'all' || !data) return;
    let cancelled = false;
    setAllLoading(true);
    setAllError(null);
    const topMap = new Map(data.competitions.map(c => [c.id, c.top_cubers]));
    const loadFull = async () => {
      const [upcoming, past] = await Promise.all([fetchAllUpcomingCompsJson(), fetchAllPastCompsJson()]);
      const upcomingIds = new Set(upcoming.map(c => c.id));
      if (!cancelled) setAllComps([
        ...upcoming.map(c => adaptAllComp(c, topMap)),
        ...past.filter(c => !upcomingIds.has(c.id)).map(adaptPastComp),
      ]);
    };
    const load = async () => {
      if (viewMode === 'list') return loadFull();
      try {
        const manifest = await loadCalendarManifest();
        if (viewMode === 'globe') {
          if (!cancelled) setCalendarManifest(manifest);
          return;
        }
        const rows = await loadCalendarMonth(manifest, calendarMonth);
        if (!cancelled) {
          setCalendarManifest(manifest);
          setMonthComps({ month: calendarMonth, rows: [...rows.upcoming.map(c => adaptAllComp(c, topMap)), ...rows.past.map(adaptPastComp)] });
        }
      } catch { if (!cancelled) await loadFull(); }
    };
    void load().catch(() => { if (!cancelled) setAllError(t('upcoming.allLoadFailed')); })
      .finally(() => { if (!cancelled) setAllLoading(false); });
    return () => { cancelled = true; };
  }, [mode, allComps, data, viewMode, calendarMonth, t]);

  const activeComps: Competition[] = useMemo(() => {
    const base = mode === 'all' ? (allComps ?? (monthComps?.month === calendarMonth && viewMode !== 'list' ? monthComps.rows : [])) : (data?.competitions ?? []);
    if (Object.keys(compDual).length === 0) return base;
    return base.map(c => {
      const full = compDual[c.id];
      return full ? { ...c, dual_events: full.map(e => WCA_EVENT_ID_TO_SHORT[e] ?? e) } : c;
    });
  }, [mode, allComps, monthComps, calendarMonth, viewMode, data, compDual]);

  const competitionDataReady = mode !== 'all' || Boolean(allComps) || (viewMode !== 'list' && monthComps?.month === calendarMonth);

  // NOTE: 选中国家时整段隐藏其他国家（不是变淡）；country picker / yearMonthsMap 仍用 activeComps
  // 多选 token: 国家 iso2(小写) 或大洲 code(大写)。expandCountrySelection 把大洲展开为下属国家。
  const countryFilterSet = useMemo(
    () => {
      const expanded = expandCountrySelection(countryFilters);
      return new Set(Array.from(expanded).map((s) => s.toUpperCase()));
    },
    [countryFilters],
  );
  // 每个项目在 activeComps 里实际出现过的最大轮次数。chip 循环时按这个上限截断，
  // 例如 FMC 最多 3 轮就只到 3，避免选出"FMC=4"这种永远空的过滤。
  const maxRoundsByEid = useMemo(() => {
    if (globalSummary) return Object.fromEntries(Object.entries(globalSummary.maxRounds).map(([key, n]) => [SHORT_TO_EVENT_ID[key] ?? key, n]));
    const m: Record<string, number> = {};
    for (const c of activeComps) {
      if (!c.rounds) continue;
      for (const [shortEid, n] of Object.entries(c.rounds)) {
        const wcaEid = SHORT_TO_EVENT_ID[shortEid] ?? shortEid;
        if (n > (m[wcaEid] ?? 0)) m[wcaEid] = n;
      }
    }
    return m;
  }, [activeComps, globalSummary]);

  // 比赛天数过滤的循环上限：取数据里实际最长持续天数，封顶 6（>6 天的比赛在 WCA 几乎不存在，
  // 避免脏 end_date 把循环拉长）。chip 单击在 1..cap 间循环。
  const maxDays = useMemo(() => {
    if (globalSummary) return globalSummary.maxDays;
    let m = 1;
    for (const c of activeComps) {
      const d = daysBetween(parseLocalDate(c.start_date), parseLocalDate(c.end_date || c.start_date)) + 1;
      if (d > m) m = d;
    }
    return Math.min(m, 6);
  }, [activeComps, globalSummary]);

  // RegionPicker 国家列表(出现过的 iso2,按 count desc),组件保留传入顺序
  const countryOptions = useMemo(
    () => globalSummary?.countryOptions ?? competitionCountryOptions(activeComps),
    [activeComps, globalSummary],
  );

  // ── 选手静态索引 ────────────────────────────────────────────
  // personIndex: WCA ID → comp ID set;来自 top_cubers (~205) ∪ cn_upcoming_registrations (~1000)
  // 命中即可完全跳过 API,顶尖选手 + 中国选手都走静态。
  const personCompIndex = useMemo(() => {
    const m = new Map<string, Set<string>>();
    if (data) {
      for (const comp of data.competitions) {
        for (const cuber of comp.top_cubers) {
          let s = m.get(cuber.id);
          if (!s) { s = new Set(); m.set(cuber.id, s); }
          s.add(comp.id);
        }
      }
    }
    if (cnRegistrations) {
      for (const [compId, ids] of Object.entries(cnRegistrations)) {
        for (const wcaId of ids) {
          let s = m.get(wcaId);
          if (!s) { s = new Set(); m.set(wcaId, s); }
          s.add(compId);
        }
      }
    }
    return m;
  }, [data, cnRegistrations]);

  // staticCubers: 给 CuberSearchInput 做名字 autocomplete 的静态人名表 (仅 top_cubers,有名字)
  const staticCubers = useMemo<WcaPersonLite[]>(() => {
    if (!data) return [];
    const seen = new Map<string, WcaPersonLite>();
    for (const comp of data.competitions) {
      for (const c of comp.top_cubers) {
        if (seen.has(c.id)) continue;
        seen.set(c.id, {
          id: c.id,
          name: c.name,
          country_iso2: personFlagIso2(c.id) || '',
        });
      }
    }
    return Array.from(seen.values());
  }, [data, recordsVer]);

  const selectedCuberCompIds = usePersonCompetitionIds(
    selectedCuberId, selectedCuberId ? personCompIndex.get(selectedCuberId) : undefined,
  );

  // 首秀 id 集合：'country' 模式下 activeComps 里每个国家 start_date 最早那场；'event' 模式下每个项目
  // 首次出现的那场（一场比赛可能同时是多个项目的首秀,只算一条）。同日取 id 最小,稳定。
  // 仅模式非 off 时计算；用全量 activeComps 求"真正第一场",其他筛选(国家/项目/年月)再在其上叠加。
  // 'event' 模式下顺带记下每场比赛具体是哪些项目的首秀(debutEventsByComp)，供列表行给对应项目格子标记。
  const { debutIds, debutEventsByComp } = useMemo(() => {
    if (debutMode === 'off') return { debutIds: null, debutEventsByComp: null };
    if (globalSummary) {
      const first = debutMode === 'country' ? globalSummary.firstCountry : globalSummary.firstEvent;
      const byComp = debutMode === 'event' ? new Map<string, string[]>() : null;
      for (const [event, id] of Object.entries(first)) if (byComp) byComp.set(id, [...byComp.get(id) ?? [], event]);
      return { debutIds: new Set(Object.values(first)), debutEventsByComp: byComp };
    }
    const first = new Map<string, Competition>();
    const isEarlier = (c: Competition, ex: Competition | undefined) =>
      !ex || c.start_date < ex.start_date || (c.start_date === ex.start_date && c.id < ex.id);
    for (const c of activeComps) {
      if (debutMode === 'country') {
        const k = c.country.toUpperCase();
        if (isEarlier(c, first.get(k))) first.set(k, c);
      } else {
        for (const eid of c.events) {
          if (isEarlier(c, first.get(eid))) first.set(eid, c);
        }
      }
    }
    const ids = new Set<string>();
    const byComp = debutMode === 'event' ? new Map<string, string[]>() : null;
    for (const [key, c] of first) {
      ids.add(c.id);
      if (byComp) {
        const arr = byComp.get(c.id) ?? [];
        arr.push(key);
        byComp.set(c.id, arr);
      }
    }
    return { debutIds: ids, debutEventsByComp: byComp };
  }, [debutMode, activeComps, globalSummary]);

  // NOTE: 不匹配的比赛直接从日历中消失（不再"变淡"），所以 displayedComps 走完整过滤链
  const isMatch = useCallback(
    (comp: Competition) => {
      if (!competitionMatchesQuery(comp, compQuery)) return false;
      if (selectedCuberCompIds && !selectedCuberCompIds.has(comp.id)) return false;
      if (countryFilterSet.size > 0 && !countryFilterSet.has(comp.country.toUpperCase())) return false;
      // AND 语义：每个所选项目都必须存在；rf 是数字时还要轮次精确匹配，'any' 时只看项目存在。
      // comp.events / comp.rounds 用 short code（'3' / 'pyra'），过滤里的 eid 是 WCA 标准 ID（'333'）→ 反查。
      for (const [eid, rf] of Object.entries(eventFilters)) {
        const shortEid = WCA_EVENT_ID_TO_SHORT[eid] ?? eid;
        if (!(comp.events ?? []).includes(shortEid)) return false;
        if (rf === 'any') continue;
        const r = comp.rounds?.[shortEid];
        if (r == null) return false;
        if (r !== rf) return false;
      }
      if (daysFilter != null) {
        const d = daysBetween(parseLocalDate(comp.start_date), parseLocalDate(comp.end_date || comp.start_date)) + 1;
        if (d !== daysFilter) return false;
      }
      if (validYM(dateFrom) || validYM(dateTo)) {
        const ym = comp.start_date.slice(0, 7);
        if (validYM(dateFrom) && ym < dateFrom) return false;
        if (validYM(dateTo) && ym > dateTo) return false;
      }
      if (cancelledFilter === 'only' && !isCancelledComp(comp, cancelledCutoffIso)) return false;
      if (debutIds && !debutIds.has(comp.id)) return false;
      if (dualOnly && !(comp.dual_events && comp.dual_events.length > 0)) return false;
      if (h2hOnly && !(comp.h2h_events && comp.h2h_events.length > 0)) return false;
      return true;
    },
    [compQuery, selectedCuberCompIds, countryFilterSet, eventFilters, daysFilter, dateFrom, dateTo, cancelledFilter, cancelledCutoffIso, debutIds, dualOnly, h2hOnly],
  );

  // 中国内地比赛 WCA WCIF 多无报名数据(报名走 cubing.com),用 cn_upcoming_registrations(compId→WCA ID 列表)
  // 的人数补 registered,让列表「人数」列 + 日历满员判定对 CN 比赛也生效。
  const cnRegCount = useMemo(() => {
    const m = new Map<string, number>();
    if (cnRegistrations) for (const [id, ids] of Object.entries(cnRegistrations)) m.set(id, ids.length);
    return m;
  }, [cnRegistrations]);

  const displayedComps = useMemo(
    () => activeComps.filter(isMatch).map((c) => {
      const cnN = cnRegCount.get(c.id);
      return cnN && (c.registered == null || cnN > c.registered) ? { ...c, registered: cnN } : c;
    }),
    [activeComps, isMatch, cnRegCount],
  );

  // 卡片视图:与日历同样按当前月(start_date 落在 viewDate 当月)展示,按开始日期升序排,场数天然有界。
  const cardComps = useMemo(() => {
    if (viewMode !== 'card') return [];
    const y = viewDate.getFullYear(), m = viewDate.getMonth();
    return displayedComps
      .filter((c) => {
        const s = parseLocalDate(c.start_date);
        return s.getFullYear() === y && s.getMonth() === m;
      })
      .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id.localeCompare(b.id));
  }, [viewMode, displayedComps, viewDate]);

  // .calendar-page 根 ref — 用来由 CompList 按视口可视行实时设 --cl-name-width / --cl-city-width
  const pageRef = useRef<HTMLDivElement>(null);

  const weeks = useMemo(() => {
    return computeWeeks(viewDate.getFullYear(), viewDate.getMonth(), displayedComps, countryFilterSet);
  }, [displayedComps, viewDate, countryFilterSet]);

  const compactWeeks = useMemo(() => {
    if (viewMode !== 'calendar' || calLayout !== 'country') return null;
    return computeCompactWeeks(
      viewDate.getFullYear(),
      viewDate.getMonth(),
      displayedComps,
      countryFilterSet,
      cancelledCutoffIso,
    );
  }, [viewMode, calLayout, displayedComps, viewDate, countryFilterSet, cancelledCutoffIso]);

  /** 紧凑模式列宽：取每列(周一~周日)月内最大场数,sqrt 软化后作 fr。
   * 周末扎堆(20+)/工作日 0~2 → sqrt 把 20:1 拉到 ~4.5:1,周末更宽但工作日不至于消失。
   * minmax(40px,…fr) 保证空列不被挤到不可读。 */
  const compactColTemplate = useMemo(() => {
    if (!compactWeeks) return null;
    const max = [0, 0, 0, 0, 0, 0, 0];
    for (const w of compactWeeks) {
      for (let i = 0; i < 7; i++) {
        if (w.byDay[i].length > max[i]) max[i] = w.byDay[i].length;
      }
    }
    return max.map((n) => `minmax(40px, ${Math.max(1, Math.sqrt(n)).toFixed(2)}fr)`).join(' ');
  }, [compactWeeks]);

  // NOTE: year → months with at least one comp；年月滚筒仅从这里取可选项，空年/空月天然不出
  const yearMonthsMap = useMemo(() => {
    if (globalSummary) return new Map(Object.entries(globalSummary.yearMonths).map(([year, months]) => [Number(year), new Set(months)]));
    const map = new Map<number, Set<number>>();
    for (const c of activeComps) {
      const d = parseLocalDate(c.start_date);
      const y = d.getFullYear();
      const mo = d.getMonth() + 1;
      let set = map.get(y);
      if (!set) { set = new Set(); map.set(y, set); }
      set.add(mo);
    }
    return map;
  }, [activeComps, globalSummary]);

  // NOTE: 当月摘要（基于开始日期在本月的比赛）
  const monthStats = useMemo(() => {
    const y = viewDate.getFullYear(), m = viewDate.getMonth();
    const inMonth = displayedComps.filter((c) => {
      const s = parseLocalDate(c.start_date);
      return s.getFullYear() === y && s.getMonth() === m;
    });
    const countries = new Set<string>();
    const cubers = new Set<string>();
    const now = new Date();
    const soonCutoff = addDays(now, SOON_DAYS);
    let soon = 0;
    for (const c of inMonth) {
      countries.add(c.country);
      for (const p of c.top_cubers) cubers.add(p.id);
      const s = parseLocalDate(c.start_date);
      if (s >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && s <= soonCutoff) soon++;
    }
    return { comps: inMonth.length, countries: countries.size, cubers: cubers.size, soon };
  }, [displayedComps, viewDate]);

  /** 月份切换方向 — 触发 calendar 卷帘动画 */
  const [navDir, setNavDir] = useState<'forward' | 'back' | null>(null);
  const setMonth = useCallback((next: Date) => {
    setViewDate((cur) => {
      const curMs = cur.getFullYear() * 12 + cur.getMonth();
      const nextMs = next.getFullYear() * 12 + next.getMonth();
      if (nextMs === curMs) return cur;
      setNavDir(nextMs > curMs ? 'forward' : 'back');
      return next;
    });
  }, []);
  /** functional setter — 避免读闭包里 stale 的 viewDate(键盘 handler 因 deps 不全曾跳错月) */
  const gotoMonth = useCallback((delta: number) => {
    setViewDate((cur) => {
      const next = new Date(cur.getFullYear(), cur.getMonth() + delta, 1);
      setNavDir(delta > 0 ? 'forward' : 'back');
      return next;
    });
  }, []);
  const gotoToday = () => {
    const now = new Date();
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  // 列表模式 + 移动端：chip 表头与列表外层各自横向滚动，双向同步 scrollLeft
  useEffect(() => {
    if (viewMode !== 'list') return;
    const header = chipsHeaderRef.current;
    const list = listScrollRef.current;
    if (!header || !list) return;
    let lock = false;
    const sync = (src: HTMLDivElement, dst: HTMLDivElement) => {
      if (lock) return;
      lock = true;
      if (dst.scrollLeft !== src.scrollLeft) dst.scrollLeft = src.scrollLeft;
      requestAnimationFrame(() => { lock = false; });
    };
    const onList = () => sync(list, header);
    const onHeader = () => sync(header, list);
    list.addEventListener('scroll', onList, { passive: true });
    header.addEventListener('scroll', onHeader, { passive: true });
    return () => {
      list.removeEventListener('scroll', onList);
      header.removeEventListener('scroll', onHeader);
    };
  }, [viewMode, displayedComps.length]);

  // NOTE: 桌面端 ← / → 换月。输入框聚焦或弹层打开时让位
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (viewMode !== 'calendar') return;
      if (selectedComp || dayListDate || onThisDayDate || pickerOpen != null) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      const editable = (e.target as HTMLElement | null)?.isContentEditable;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || editable) return;
      e.preventDefault();
      gotoMonth(e.key === 'ArrowLeft' ? -1 : 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedComp, dayListDate, onThisDayDate, pickerOpen, viewMode, gotoMonth]);

  // NOTE: 手机端日历区横向滑动换月。touchstart/end 距离阈值 60px、水平占优、500ms 内即视为 swipe；
  // swipe 后用 onClickCapture 吞掉合成 click，避免触发底下 event-bar 的弹窗。
  const swipeStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const swipeFiredRef = useRef(false);
  const onCalendarTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) { swipeStartRef.current = null; return; }
    const t = e.touches[0];
    swipeStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onCalendarTouchEnd = (e: React.TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    const ch = e.changedTouches[0];
    if (!ch) return;
    const dx = ch.clientX - start.x;
    const dy = ch.clientY - start.y;
    const dt = Date.now() - start.t;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 500) {
      gotoMonth(dx > 0 ? -1 : 1);
      swipeFiredRef.current = true;
    }
  };
  const onCalendarClickCapture = (e: React.MouseEvent) => {
    if (swipeFiredRef.current) {
      e.preventDefault();
      e.stopPropagation();
      swipeFiredRef.current = false;
    }
  };

  // ── 渲染 ──

  if (error) {
    return (
      <div className="calendar-page">
        <div className="state-message state-error">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="calendar-page">
        <div className="state-message">{t('upcoming.loading')}</div>
      </div>
    );
  }

  const today = new Date();
  const cardTodayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const monthYear = String(viewDate.getFullYear());
  const monthMm = String(viewDate.getMonth() + 1).padStart(2, '0');
  const weekdays = (isZh ? WEEKDAY_ZH : WEEKDAY_EN);

  const cycleEvent = (eid: string) => setEventFilters(prev => {
    const next = { ...prev };
    const current = prev[eid];
    const max = maxRoundsByEid[eid] ?? 0;
    if (current === undefined) next[eid] = 'any';
    else if (current === 'any' && max >= 1) next[eid] = 1;
    else if (typeof current === 'number' && current < max) next[eid] = (current + 1) as 1 | 2 | 3 | 4;
    else delete next[eid];
    return next;
  });
  return (
    <div
      ref={pageRef}
      style={{ '--cl-event-count': EVENT_ORDER.length } as CSSProperties}
      className={`calendar-page${viewMode === 'list' ? ' calendar-page--list competition-list-layout' : ''}${viewMode === 'calendar' && calLayout === 'country' ? ' calendar-page--compact' : ''}${viewMode === 'globe' ? ' calendar-page--globe' : ''}`}
      data-wide-metric={viewMode === 'list' && WIDE_METRICS.has(eventMetric) ? '' : undefined}
      data-comp-2col={viewMode === 'list' && (compMetric === 'latlng' || compMetric === 'peopleLimit') ? '' : undefined}
      data-comp-peoplelimit={viewMode === 'list' && compMetric === 'peopleLimit' ? '' : undefined}
    >
      <header className="upcoming-header">
          <PageHeading backHref="/wca" titleClassName="upcoming-title">
            {tr({ zh: 'WCA 比赛', en: 'WCA Competitions'
          })}
            <Link
              href="/wca/comp-about"
              className="calendar-title-help"
              title={tr({ zh: '这页是干啥的?', en: 'What is this page?'
              })}
              aria-label={tr({ zh: '查看说明', en: 'About this page'
              })}
            >
              <HelpCircle size={18} strokeWidth={1.75} />
            </Link>
          </PageHeading>
        <div className="upcoming-meta">
          <Link href="/wca/comp/stats" className="globe-link">
            <BarChart3 size={12} strokeWidth={1.75} /> {tr({ zh: '统计', en: 'Stats'
            })}
          </Link>
        </div>
      </header>

      <div className="toolbar competition-search-toolbar">
        <CompetitionSearchFilters
          isZh={isZh}
          search={{
            query: compQuery,
            onQueryChange: setCompQuery,
            onUrlPaste: (id) => router.push(`/wca/comp/${id}`),
            cuber: selectedCuber,
            onCuberChange: setSelectedCuber,
            staticCubers,
            cuberMatchCount: selectedCuberCompIds?.size ?? null,
          }}
          countries={countryFilters}
          onCountriesChange={setCountryFilters}
          countryOptions={countryOptions}
        />
        {(() => {
          // 已取消 / 首秀 / 双轮 / H2H 合并成一个菜单(issue #33,不用 lucide 图标);
          // 整场列 / 项目格 metric 只在列表视图出现(人数和上限 / 满员率等仅列表有意义)。
          const activeCount = (cancelledFilter === 'only' ? 1 : 0)
            + (debutMode !== 'off' ? 1 : 0)
            + (dualOnly ? 1 : 0)
            + (h2hOnly ? 1 : 0);
          return (
            <div className="comp-filters-wrap" ref={filtersWrapRef}>
              <MoreToggle
                type="button"
                className={`comp-filters-btn${activeCount > 0 ? ' is-active' : ''}`}
                onClick={() => setFiltersOpen((o) => !o)}
                expanded={filtersOpen}
                aria-haspopup="true"
              >
                <span>{tr({ zh: '筛选', en: 'Filters' })}</span>
                {activeCount > 0 && <span className="comp-filters-count">{activeCount}</span>}

              </MoreToggle>
              {filtersOpen && (
                /* anchored-panel: clamped (usePanelClamp) */
                <div className="comp-filters-panel" ref={filtersPanelRef}>
                  <div
                    className="comp-filters-row"
                    title={tr({ zh: '只看已取消的比赛', en: 'Show only cancelled competitions' })}
                  >
                    <BoolToggle
                      value={cancelledFilter === 'only'}
                      onChange={(v) => setCancelledFilter(v ? 'only' : 'all')}
                      label={tr({ zh: '已取消', en: 'Cancelled only' })}
                    />
                  </div>
                  <div
                    className="comp-filters-row"
                    title={tr({ zh: '双轮赛制：只显示含双轮项目的比赛（WCA Reg 9v，2026 新规，前两轮合并排名、不淘汰）。含双轮的项目在下方列表里带强调色圈', en: 'Dual rounds: show only competitions with a dual-round event (WCA Reg 9v, new in 2026 — first two rounds combined, no elimination). Dual events are ringed in the list below' })}
                  >
                    <BoolToggle
                      value={dualOnly}
                      onChange={(v) => setDualOnly(v)}
                      label={tr({ zh: '双轮', en: 'Dual rounds' })}
                    />
                  </div>
                  <div
                    className="comp-filters-row"
                    title={tr({ zh: '只显示含 H2H（Head to Head，对阵赛制）项目的比赛；以 WCA 轮次的 format = h 为准', en: 'Show only competitions with an H2H (Head to Head) event, identified by WCA round format = h' })}
                  >
                    <BoolToggle
                      value={h2hOnly}
                      onChange={(v) => setH2hOnly(v)}
                      label={tr({ zh: 'H2H', en: 'H2H' })}
                    />
                  </div>
                  <label
                    className="comp-filters-row comp-filters-row--select"
                    title={tr({ zh: '首秀：国家＝只显示每个国家有史以来的第一场 WCA 比赛；项目＝只显示每个项目有史以来第一次出现的那场比赛（配合左侧国家 / 下方项目筛选可锁定某国或某项目，日期列点「最早在前」按时间看登场顺序）', en: 'Debuts: Country = each country’s first-ever WCA competition; Event = each event’s first-ever appearance (combine with the country filter or event chips to focus one, click the date header for oldest-first)' })}
                  >
                    <span className="comp-filters-label">{tr({ zh: '首秀', en: 'Debuts' })}</span>
                    <select
                      className="list-metric-select"
                      value={debutMode}
                      onChange={(e) => setDebutMode(e.target.value as DebutMode)}
                      aria-label={tr({ zh: '首秀', en: 'Debuts' })}
                    >
                      <option value="off">{tr({ zh: '关', en: 'Off' })}</option>
                      <option value="country">{tr({ zh: '国家首秀', en: 'Country debuts' })}</option>
                      <option value="event">{tr({ zh: '项目首秀', en: 'Event debuts' })}</option>
                    </select>
                  </label>
                  {viewMode === 'list' && (
                    <>
                      <label
                        className="comp-filters-row comp-filters-row--select"
                        title={tr({ zh: '整场列显示什么（人数和上限 / 满员率 / 名称长度 / 城市名长度 / 纬度 / 经度 / 海拔），点列头可排序', en: 'What the whole-comp column shows (people & limit / fill rate / name length / city length / latitude / longitude / elevation); click header to sort' })}
                      >
                        <span className="comp-filters-label">{tr({ zh: '整场列', en: 'Comp column' })}</span>
                        <select
                          className="list-metric-select"
                          value={compMetric}
                          onChange={(e) => setCompMetric(e.target.value as CompMetric)}
                          aria-label={tr({ zh: '整场列显示', en: 'Whole-comp column' })}
                        >
                          <option value="peopleLimit">{tr({ zh: '人数和上限', en: 'People & limit' })}</option>
                          <option value="ratio">{tr({ zh: '满员率', en: 'Fill rate' })}</option>
                          <option value="nameLength">{tr({ zh: '名称长度', en: 'Name length' })}</option>
                          <option value="cityLength">{tr({ zh: '城市名长度', en: 'City name length' })}</option>
                          <option value="latlng">{tr({ zh: '经纬度', en: 'Coordinates' })}</option>
                          <option value="elevation">{tr({ zh: '海拔', en: 'Elevation' })}</option>
                        </select>
                      </label>
                      <label
                        className="comp-filters-row comp-filters-row--select"
                        title={tr({ zh: '每个项目格子显示什么（限时 / 及格 / 晋级 / 资格仅未来比赛有）', en: 'What each event cell shows (time limit / cutoff / advancement / qualification: upcoming only)' })}
                      >
                        <span className="comp-filters-label">{tr({ zh: '项目格', en: 'Event cell' })}</span>
                        <select
                          className="list-metric-select"
                          value={eventMetric}
                          onChange={(e) => setEventMetric(e.target.value as EventMetric)}
                          aria-label={tr({ zh: '项目格子显示', en: 'Per-event cell' })}
                        >
                          <option value="rounds">{tr({ zh: '轮次', en: 'Rounds' })}</option>
                          <option value="regs">{tr({ zh: '人数', en: 'Entries' })}</option>
                          <option value="timeLimit">{tr({ zh: '限时', en: 'Time limit' })}</option>
                          <option value="cutoff">{tr({ zh: '及格线', en: 'Cutoff' })}</option>
                          <option value="advancement">{tr({ zh: '晋级', en: 'Advance' })}</option>
                          <option value="qualification">{tr({ zh: '参赛资格', en: 'Qualify' })}</option>
                        </select>
                      </label>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      <div className="month-bar">
        <CompetitionViewToggle view={viewMode} onViewChange={next => {
          if (next === 'list') setMode('all');
          if (next === 'globe') void setViewMode(next);
          else void setViewMode(next, { history: viewMode === 'globe' ? 'push' : 'replace' });
        }} />
        {viewMode === 'calendar' && (
          <select
            value={String(calLayout === 'country')}
            onChange={event => { const v = event.currentTarget.value === 'true'; setCalLayout(v ? 'country' : 'comp'); }}
            aria-label={tr({ zh: '日历布局:按比赛或按国家', en: 'Calendar layout: by competition or by country' })}
            className={['native-select', "cal-layout-toggle"].filter(Boolean).join(' ')}
          >
            <option value="true">{tr({ zh: '国家', en: 'Countries' })}</option>
            <option value="false">{tr({ zh: '比赛', en: 'Comps' })}</option>
          </select>
        )}
        {(viewMode === 'calendar' || viewMode === 'card') && (
          <div className="month-nav">
            <button className="nav-btn" onClick={() => gotoMonth(-1)} aria-label="Previous month">
              <ChevronLeft size={16} strokeWidth={1.75} />
            </button>
            <button className="nav-today" onClick={gotoToday}>{tr({ zh: '今天', en: 'Today' })}</button>
            <button className="nav-btn" onClick={() => gotoMonth(1)} aria-label="Next month">
              <ChevronRight size={16} strokeWidth={1.75} />
            </button>
            <button
              ref={monthBtnRef}
              className="month-label month-label-btn"
              onClick={() => setPickerOpen((o) => o === 'month' ? null : 'month')}
              aria-label={tr({ zh: '选择年月', en: 'Select year / month'
            })}
              aria-expanded={pickerOpen === 'month'}
            >
              <span className="month-label-year">{monthYear}</span>
              <span className="month-label-month">{monthMm}</span>
            </button>
          </div>
        )}
        {viewMode === 'list' && (
          <div className="date-range-nav">
            <button
              ref={fromBtnRef}
              type="button"
              className={`date-range-pick${dateFrom ? '' : ' is-empty'}`}
              onClick={() => setPickerOpen((o) => o === 'from' ? null : 'from')}
              aria-expanded={pickerOpen === 'from'}
              aria-label={tr({ zh: '起始年月', en: 'From' })}
            >
              {dateFrom || tr({ zh: '起始', en: 'From' })}
            </button>
            <span className="date-range-sep">~</span>
            <button
              ref={toBtnRef}
              type="button"
              className={`date-range-pick${dateTo ? '' : ' is-empty'}`}
              onClick={() => setPickerOpen((o) => o === 'to' ? null : 'to')}
              aria-expanded={pickerOpen === 'to'}
              aria-label={tr({ zh: '结束年月', en: 'To'
            })}
            >
              {dateTo || tr({ zh: '结束', en: 'To'
                                      })}
            </button>
            {(dateFrom || dateTo) && (
              <ClearButton
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                isZh={isZh}
                variant="standalone"
              />
            )}
            <span className="date-range-summary">
              {!competitionDataReady ? '—' : (isZh
                                          ? `共 ${displayedComps.length.toLocaleString()} 场`
                                          : `${displayedComps.length.toLocaleString()} comps`)}
            </span>
          </div>
        )}
      </div>

      <div
        className={`event-chips${viewMode === 'list' && displayedComps.length > 0 ? ' event-chips--list-header' : ''}`}
        ref={viewMode === 'list' && displayedComps.length > 0 ? chipsHeaderRef : undefined}
      >
        {(() => {
          // 天数列表头 = 日历图标，下方每行显示该比赛天数；单击图标循环过滤 null → 1 → ... → maxDays → null。
          const daysActive = daysFilter != null;
          const daysChip = (
            <button
              type="button"
              key="days-filter"
              className={`event-chip days-chip ${daysActive ? 'is-active' : ''}`}
              onClick={() => setDaysFilter((cur) => {
                if (cur == null) return maxDays >= 1 ? 1 : null;
                return cur + 1 <= maxDays ? cur + 1 : null;
              })}
              aria-pressed={daysActive}
              title={tr({ zh: '比赛天数(单击按天数筛选)', en: 'Competition days (click to filter)'
              })}
            >
              <CalendarRange size={18} strokeWidth={1.75} />
              <span className={`event-chip-rounds${daysActive ? '' : ' is-empty'}`}>
                {daysActive ? daysFilter : ''}
              </span>
            </button>
          );
          const chips = EVENT_ORDER.map((eid) => {
            const current = eventFilters[eid];
            const active = current !== undefined;
            const max = maxRoundsByEid[eid] ?? 0;
            const badge = typeof current === 'number' ? String(current) : '';
            const cycleHint = max >= 1
              ? tr({ zh: `点击切换：关 → 任意轮数 → 1 → ... → ${max} → 关`, en: `Click to cycle: off → any rounds → 1 → ... → ${max} → off` })
              : tr({ zh: '点击切换：关 → 任意轮数 → 关', en: 'Click to cycle: off → any rounds → off' });
            return (
              <button
                key={eid}
                type="button"
                className={`event-chip ${active ? 'is-active' : ''}`}
                onClick={() => cycleEvent(eid)}
                aria-pressed={active}
                title={cycleHint}
              >
                <EventIcon event={eid} />
                <span className={`event-chip-rounds${badge === '' ? ' is-empty' : ''}`}>
                  {badge}
                </span>
              </button>
            );
          });
          // 列表模式：用 grid 把表头对齐到下方各列（年份 cell + flag/name 两个 spacer + 天数列头 + 项目 chip）。
          if (viewMode !== 'list' || displayedComps.length === 0) return <SettingsPopover label={tr({ zh: '项目与轮次筛选', en: 'Event and round filters' })} panelClassName="calendar-event-settings"><div className="calendar-event-options">{daysChip}{chips}</div></SettingsPopover>;
          return (
            <div className="event-chips-grid">
              {/* 报名列头（最左）：文字「报名」+ 点击按下一个将发生的报名里程碑时刻排序（已截止/无数据沉底） */}
              {(() => {
                const regOn = listSort?.col === 'reg';
                return (
                  <button
                    type="button"
                    className={`cl-col-icon cl-reg-head cl-col-sort${regOn ? ' is-active' : ''}`}
                    title={tr({ zh: '报名（下一个开放/截止里程碑，本地时区）— 点击按时刻排序；已截止/无数据沉底', en: 'Registration (next opens/closes milestone, local time) — click to sort' })}
                    aria-pressed={regOn}
                    onClick={() => cycleSort('reg')}
                  >
                    <span className="cl-reg-head-text">{tr({ zh: '报名', en: 'Reg' })}</span>
                    <SortArrow active={regOn} dir={listSort?.dir ?? 'asc'} size={11} />
                  </button>
                );
              })()}
              {(() => {
                // 日期列头：点击在「默认最新在前」与「最早在前」之间切换。
                // 选某国家 + 切到「最早在前」→ 顶部即该国首场比赛。
                const dateActive = listSort?.col === 'date';
                return (
                  <button
                    type="button"
                    className={`cl-year-cell cl-year-sort${dateActive ? ' is-active' : ''}`}
                    aria-live="polite"
                    aria-pressed={dateActive}
                    title={tr({ zh: '按日期排序（默认最新在前，点击切到最早在前）', en: 'Sort by date (newest first; click for oldest first)' })}
                    onClick={() => setListSort((s) => (s?.col === 'date' && s.dir === 'asc' ? null : { col: 'date', dir: 'asc' }))}
                  >
                    {currentYear && <span className="cl-year-num">{currentYear.year}</span>}
                    {/* 日期是默认排序轴 → 箭头恒显:升序(最早在前)=↑,否则=↓ */}
                    <SortArrow active dir={dateActive && listSort?.dir === 'asc' ? 'asc' : 'desc'} />
                  </button>
                );
              })()}
              <span className="cl-h-spacer" aria-hidden="true" />
              {/* 比赛名列头：点击按名字首字母 locale 排序 */}
              {(() => {
                const active = listSort?.col === 'name';
                const AZ = active && listSort?.dir === 'desc' ? ArrowDownZA : ArrowDownAZ;
                return (
                  <button
                    type="button"
                    className={`cl-col-icon cl-col-sort cl-text-sort${active ? ' is-active' : ''}`}
                    title={tr({ zh: '按比赛名首字母排序', en: 'Sort by competition name'
                    })}
                    aria-pressed={active}
                    onClick={() => cycleSort('name')}
                  >
                    <AZ size={15} strokeWidth={1.75} />
                    {currentYear && <span className="cl-list-count">{currentYear.count.toLocaleString()}</span>}
                  </button>
                );
              })()}
              {/* 国家名列头：点击按国家名首字母 locale 排序 */}
              {(() => {
                const active = listSort?.col === 'country';
                const AZ = active && listSort?.dir === 'desc' ? ArrowDownZA : ArrowDownAZ;
                return (
                  <button
                    type="button"
                    className={`cl-col-icon cl-col-sort cl-text-sort${active ? ' is-active' : ''}`}
                    title={tr({ zh: '按国家名排序', en: 'Sort by country' })}
                    aria-pressed={active}
                    onClick={() => cycleSort('country')}
                  >
                    <AZ size={15} strokeWidth={1.75} />
                  </button>
                );
              })()}
              {/* 城市名列头：点击按城市名首字母 locale 排序 */}
              {(() => {
                const active = listSort?.col === 'city';
                const AZ = active && listSort?.dir === 'desc' ? ArrowDownZA : ArrowDownAZ;
                return (
                  <button
                    type="button"
                    className={`cl-col-icon cl-col-sort cl-text-sort${active ? ' is-active' : ''}`}
                    title={tr({ zh: '按城市名首字母排序', en: 'Sort by city name' })}
                    aria-pressed={active}
                    onClick={() => cycleSort('city')}
                  >
                    <AZ size={15} strokeWidth={1.75} />
                  </button>
                );
              })()}
              {daysChip}
              {compMetric === 'latlng' ? (
                (['lat', 'lng'] as CoordKey[]).map((k) => {
                  const Icon = k === 'lat' ? MoveVertical : MoveHorizontal;
                  const on = !!listSort && listSort.col === 'comp' && listSort.coord === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      className={`cl-col-icon cl-col-sort${on ? ' is-active' : ''}`}
                      title={coordColTitle(k) + tr({ zh: '(点击排序)', en: ' (click to sort)'
                    })}
                      aria-pressed={on}
                      onClick={() => cycleSort('comp', k)}
                    >
                      <Icon size={15} strokeWidth={1.75} />
                      <SortArrow active={on} dir={listSort?.dir ?? 'asc'} size={11} />
                    </button>
                  );
                })
              ) : compMetric === 'peopleLimit' ? (
                (['people', 'limit'] as const).map((k) => {
                  const Icon = k === 'people' ? Users : Gauge;
                  const on = !!listSort && listSort.col === 'comp' && listSort.coord === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      className={`cl-col-icon cl-col-sort${on ? ' is-active' : ''}`}
                      title={subColTitle(k) + tr({ zh: '(点击排序)', en: ' (click to sort)'
                    })}
                      aria-pressed={on}
                      onClick={() => cycleSort('comp', k)}
                    >
                      <Icon size={15} strokeWidth={1.75} />
                      <SortArrow active={on} dir={listSort?.dir ?? 'asc'} size={11} />
                    </button>
                  );
                })
              ) : (() => {
                const CompIcon = compMetric === 'nameLength' ? CaseSensitive : compMetric === 'cityLength' ? MapPin : compMetric === 'elevation' ? Mountain : Percent;
                const on = listSort?.col === 'comp';
                return (
                  <button
                    type="button"
                    className={`cl-col-icon cl-col-sort${on ? ' is-active' : ''}`}
                    title={compColTitle(compMetric) + tr({ zh: '(点击排序)', en: ' (click to sort)'
                    })}
                    aria-pressed={on}
                    onClick={() => cycleSort('comp')}
                  >
                    <CompIcon size={15} strokeWidth={1.75} />
                    <SortArrow active={on} dir={listSort?.dir ?? 'asc'} size={11} />
                  </button>
                );
              })()}
              {chips}
            </div>
          );
        })()}
      </div>

      {allLoading && mode === 'all' && viewMode !== 'globe' && <div className="mode-status" role="status">{t('upcoming.loading')}</div>}
      {allError && mode === 'all' && (
        <div className="mode-status is-error">{allError}</div>
      )}

      {viewMode === 'list' && competitionDataReady && (
        <CompetitionList
          comps={displayedComps}
          isZh={isZh}
          onSelect={setSelectedComp}
          onYearChange={setCurrentYear}
          compMetric={compMetric}
          listSort={listSort}
          eventMetric={eventMetric}
          pastMeta={pastMeta}
          debutEventsByComp={debutEventsByComp}
          outerRef={listScrollRef}
          cancelledCutoffIso={cancelledCutoffIso}
          pageRef={pageRef}
          followedIds={follows}
        />
      )}

      {viewMode === 'card' && competitionDataReady && (
        <div className="comp-card-view">
          {cardComps.length === 0 ? (
            <div className="comp-card-empty">{tr({ zh: '本月没有比赛', en: 'No competitions this month' })}</div>
          ) : (
            <div className="reg-cards">
              {cardComps.map((c) => {
                // 已结束→「比赛已结束」;已开赛无字段补「报名已截止」灰胶囊,避免卡片裸着没胶囊(与列表/首页同口径)。
                const reg = regCardPill(c, cardTodayStart);
                return (
                  <CompCardWithRounds
                    key={c.id}
                    comp={c}
                    isZh={isZh}
                    lang={isZh ? 'zh' : 'en'}
                    pill={reg ? { when: reg.when, word: reg.word, tone: reg.tone } : null}
                    dimmed={isCancelledComp(c, cancelledCutoffIso)}
                    follow={{ followed: follows.has(c.id), onToggle: toggleFollow, loggedIn: followLoggedIn, onRequireLogin: login }}
                    roundsSeed={wcaRoundsSeed(c.rounds)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {viewMode === 'calendar' && calLayout === 'comp' && (
        <MonthGrid
          key={`cal-${viewDate.getFullYear()}-${viewDate.getMonth()}`}
          year={viewDate.getFullYear()}
          month={viewDate.getMonth() + 1}
          weekdays={weekdays}
          today={today}
          className={navDir ? `calendar--slide-${navDir}` : undefined}
          outerProps={{
            onAnimationEnd: () => setNavDir(null),
            onTouchStart: onCalendarTouchStart,
            onTouchEnd: onCalendarTouchEnd,
            onClickCapture: onCalendarClickCapture,
          }}
          weekRowStyle={(_w, wi) => {
            const week = weeks[wi];
            if (!week) return undefined;
            return { ['--tracks' as string]: Math.max(1, week.maxTrack + 1 + (week.overflowByCol.size > 0 ? 1 : 0)) };
          }}
          renderDay={(day, { inView }) => (
            inView && (
              <button
                type="button"
                className="day-number"
                onClick={() => setOnThisDayDate(day)}
                title={tr({ zh: '历年此日的比赛', en: 'On this day across all years'
                })}
              >
                {day.getDate()}
              </button>
            )
          )}
          renderWeekOverlay={(_w, wi) => {
            const week = weeks[wi];
            if (!week) return null;
            return (
              <>
                {week.bars.map((bar) => {
                  const reg = regState(bar.comp.registration_open, bar.comp.registration_close, bar.comp.registered, bar.comp.competitor_limit);
                  const cancelled = isCancelledComp(bar.comp, cancelledCutoffIso);
                  const displayName = localizeName(bar.comp, isZh, bar.comp.start_date);
                  const classes = [
                    'event-bar',
                    `reg-${reg}`,
                    cancelled ? 'is-cancelled' : '',
                    bar.continuesFromPrev ? 'continues-prev' : '',
                    bar.continuesToNext ? 'continues-next' : '',
                  ].filter(Boolean).join(' ');
                  const prefetchRounds = bar.comp.rounds ? undefined : () => { void fetchCompRounds(bar.comp.id); };
                  return (
                    <button
                      key={bar.key}
                      className={classes}
                      style={{
                        gridColumn: `${bar.startCol} / span ${bar.span}`,
                        gridRow: `${bar.track + 2} / span ${bar.rowSpan}`,
                      }}
                      onClick={() => setSelectedComp(bar.comp)}
                      onMouseEnter={prefetchRounds}
                      onFocus={prefetchRounds}
                      title={`${displayName} — ${bar.comp.top_cubers.length} cubers`}
                    >
                      {(() => {
                        const top = getCompRecordTop(bar.comp.id);
                        return top ? <RecordBadge record={top} /> : null;
                      })()}
                      <Flag iso2={bar.comp.country} />
                      {follows.has(bar.comp.id) && <FollowMark />}
                      <span className="event-bar-name">{displayName}</span>
                    </button>
                  );
                })}
                {Array.from(week.overflowByCol.entries()).map(([col, overflowComps]) => (
                  <button
                    key={`of-${col}`}
                    className="more-btn"
                    style={{ gridColumn: col, gridRow: Math.min(MAX_TRACKS, week.maxTrack + 1) + 2 }}
                    onClick={() => { setDayListCountry(null); setDayListDate(week.days[col - 1]); }}
                  >
                    +{overflowComps.length}
                  </button>
                ))}
              </>
            );
          }}
        />
      )}

      {viewMode === 'calendar' && calLayout === 'country' && compactWeeks && (
        <MonthGrid
          key={`compact-${viewDate.getFullYear()}-${viewDate.getMonth()}`}
          year={viewDate.getFullYear()}
          month={viewDate.getMonth() + 1}
          weekdays={weekdays}
          today={today}
          className={`calendar--compact${navDir ? ` calendar--slide-${navDir}` : ''}`}
          outerProps={{
            onAnimationEnd: () => setNavDir(null),
            onTouchStart: onCalendarTouchStart,
            onTouchEnd: onCalendarTouchEnd,
            onClickCapture: onCalendarClickCapture,
            style: compactColTemplate ? ({ ['--compact-cols' as string]: compactColTemplate } as CSSProperties) : undefined,
          }}
          dayCellProps={(day, { inView }) => inView ? {
            className: 'is-clickable',
            onClick: () => setOnThisDayDate(day),
            role: 'button',
            tabIndex: 0,
            onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOnThisDayDate(day); } },
            title: tr({ zh: '历年此日的比赛', en: 'On this day across all years'
            }),
          } : undefined}
          renderDay={(day, { inView, weekIdx, dayIdx }) => {
            if (!inView) return null;
            const tiles = compactWeeks[weekIdx]?.byDay[dayIdx] ?? [];
            return (
              <>
                <span className="day-number">{day.getDate()}</span>
                {tiles.length > 0 && (
                  <div className="compact-flag-grid">
                    {tiles.map((tile) => {
                      const c = tile.rep;
                      const cls = [
                        'compact-flag-tile',
                        tile.allCancelled ? 'is-cancelled' : '',
                      ].filter(Boolean).join(' ');
                      const prefetchRounds = c.rounds ? undefined : () => { void fetchCompRounds(c.id); };
                      const titleText = tile.count > 1
                        ? `${countryName(c.country, isZh)} — ${tile.count}${tr({ zh: ' 场', en: ' comps'
                        })}`
                        : `${localizeName(c, isZh, c.start_date)} — ${c.top_cubers.length} cubers`;
                      return (
                        <button
                          key={`${c.country.toLowerCase()}-${c.id}`}
                          className={cls}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (tile.count > 1) {
                              setDayListCountry(c.country.toLowerCase());
                              setDayListDate(day);
                            } else {
                              setSelectedComp(c);
                            }
                          }}
                          onMouseEnter={prefetchRounds}
                          onFocus={prefetchRounds}
                          title={titleText}
                        >
                          <Flag iso2={c.country} />
                          {tile.count > 1 && (
                            <span className="compact-flag-count" aria-label={titleText}>{tile.count}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            );
          }}
        />
      )}

      {viewMode === 'globe' && (
        <div className="comp-globe-view">
          <GlobeMapClient embedded />
        </div>
      )}

      {selectedComp && (
        <CompModal
          comp={selectedComp}
          isZh={isZh}
          onClose={() => setSelectedComp(null)}
          t={t}
          cancelled={isCancelledComp(selectedComp, cancelledCutoffIso)}
          loggedIn={followLoggedIn}
          followed={follows.has(selectedComp.id)}
          onToggleFollow={toggleFollow}
          onRequireLogin={login}
        />
      )}

      {pickerOpen === 'month' && (
        <YearMonthPickerPopover
          year={viewDate.getFullYear()}
          month={viewDate.getMonth() + 1}
          yearMonthsMap={yearMonthsMap}
          anchor={monthBtnRef.current?.getBoundingClientRect() ?? null}
          onCommit={(y, m) => {
            setMonth(new Date(y, m - 1, 1));
            setPickerOpen(null);
          }}
          isZh={isZh}
        />
      )}
      {(pickerOpen === 'from' || pickerOpen === 'to') && (() => {
        const cur = pickerOpen === 'from' ? dateFrom : dateTo;
        const validYears = [...yearMonthsMap.keys()].sort((a, b) => a - b);
        const fallbackY = validYears.length > 0 ? validYears[validYears.length - 1] : new Date().getFullYear();
        const y = validYM(cur) ? Number(cur.slice(0, 4)) : fallbackY;
        const m = validYM(cur) ? Number(cur.slice(5, 7)) : 1;
        const setter = pickerOpen === 'from' ? setDateFrom : setDateTo;
        const anchorRef = pickerOpen === 'from' ? fromBtnRef : toBtnRef;
        return (
          <YearMonthPickerPopover
            year={y}
            month={m}
            yearMonthsMap={yearMonthsMap}
            anchor={anchorRef.current?.getBoundingClientRect() ?? null}
            onCommit={(yy, mm) => {
              setter(`${yy}-${String(mm).padStart(2, '0')}`);
              setPickerOpen(null);
            }}
            isZh={isZh}
          />
        );
      })()}

      {dayListDate && (
        <div className="modal-overlay" onClick={() => { setDayListDate(null); setDayListCountry(null); }}>
          <div className="modal-panel day-list-panel" onClick={(ev) => ev.stopPropagation()}>
            <button className="modal-close" onClick={() => { setDayListDate(null); setDayListCountry(null); }} aria-label="Close">×</button>
            <h2 className="modal-title day-list-title">
              {dayListCountry && (
                <Flag iso2={dayListCountry} />
              )}
              <span>{toIsoDate(dayListDate)}</span>
              {dayListCountry && (
                <span className="day-list-country-name">{countryName(dayListCountry, isZh)}</span>
              )}
              <BoolToggle
                className="day-list-cubers-toggle"
                value={dayListShowCubers}
                onChange={setDayListShowCubers}
                label={tr({ zh: '顶尖选手', en: 'Top cubers' })}
              />
            </h2>
            <div className="reg-cards day-list-cards">
              {displayedComps
                .filter((c) => {
                  if (dayListCountry) {
                    // 紧凑模式国旗点击:仅当日 start_date 命中且国家匹配
                    return c.country.toLowerCase() === dayListCountry
                      && c.start_date === toIsoDate(dayListDate);
                  }
                  const s = parseLocalDate(c.start_date);
                  const e = parseLocalDate(c.end_date || c.start_date);
                  return s <= dayListDate && dayListDate <= e;
                })
                .map((c) => {
                  // 与卡片视图同口径:已结束→「比赛已结束」;已开赛无字段补「报名已截止」灰胶囊
                  const reg = regCardPill(c, cardTodayStart);
                  return (
                    <CompCardWithRounds
                      key={c.id}
                      comp={c}
                      isZh={isZh}
                      lang={isZh ? 'zh' : 'en'}
                      pill={reg ? { when: reg.when, word: reg.word, tone: reg.tone } : null}
                      dimmed={isCancelledComp(c, cancelledCutoffIso)}
                      follow={{ followed: follows.has(c.id), onToggle: toggleFollow, loggedIn: followLoggedIn, onRequireLogin: login }}
                      roundsSeed={wcaRoundsSeed(c.rounds)}
                      topCubers={dayListShowCubers ? c.top_cubers : null}
                    />
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {onThisDayDate && (
        <OnThisDayModal
          date={onThisDayDate}
          isZh={isZh}
          onClose={() => setOnThisDayDate(null)}
        />
      )}

      {(viewMode === 'calendar' || viewMode === 'card') && competitionDataReady && (
        <div className="legend">
          {viewMode === 'calendar' && calLayout === 'comp' && (
            <>
              <span className="legend-item"><span className="legend-swatch swatch-reg-open" /> {tr({ zh: '报名中', en: 'Reg open' })}</span>
              <span className="legend-item"><span className="legend-swatch swatch-reg-full" /> {tr({ zh: '满员', en: 'Full' })}</span>
              <span className="legend-item"><span className="legend-swatch swatch-reg-urgent" /> {tr({ zh: '即将截止', en: 'Closing <24h' })}</span>
              <span className="legend-item"><span className="legend-swatch swatch-reg-upcoming" /> {tr({ zh: '未开放', en: 'Not yet open' })}</span>
              <span className="legend-item"><span className="legend-swatch swatch-reg-closed" /> {tr({ zh: '已截止', en: 'Closed' })}</span>
            </>
          )}
          {viewMode === 'calendar' && calLayout === 'comp' && (
            <>
              <span className="legend-item"><span className="wr-swatch wr-current" /> {t('upcoming.wrCurrent')}</span>
              <span className="legend-item"><span className="wr-swatch wr-former" /> {t('upcoming.wrFormer')}</span>
              <span className="legend-item"><span className="wr-swatch wr-top10" /> {t('upcoming.wrTop10')}</span>
            </>
          )}
          <span className="month-stats">
            <span title={t('upcoming.statComps')}><List size={14} strokeWidth={1.75} /> {monthStats.comps}</span>
            <span title={t('upcoming.statCountries')}><GlobeIcon size={14} strokeWidth={1.75} /> {monthStats.countries}</span>
          </span>
        </div>
      )}
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="calendar-page"><div className="calendar-loading"><LoadingIndicator /></div></div>}>
      <CalendarPageInner />
    </Suspense>
  );
}
