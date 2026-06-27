'use client';

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
import { Suspense, useState, useEffect, useMemo, useCallback, useRef, useReducer } from 'react';
import type { CSSProperties } from 'react';
import { useQueryState, useQueryStates, parseAsStringEnum, parseAsInteger, parseAsString, parseAsArrayOf, parseAsBoolean } from 'nuqs';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Star, Earth as GlobeIcon, List, LayoutGrid, BarChart3, CalendarDays, CalendarRange, Ban, HelpCircle, Users, Gauge, Percent, CaseSensitive, MapPin, MoveVertical, MoveHorizontal, ArrowDownAZ, ArrowDownZA, X as XIcon, Flag as DebutIcon } from 'lucide-react';
import { WCA_EVENT_ORDER } from '@cuberoot/shared/wca-events';
import {
  fetchAllUpcomingCompsJson,
  fetchAllPastCompsJson,
  fetchCompRoundMetaJson,
  type UpcomingCompRecord,
  type PastCompRecord,
  type RoundMeta,
  type CompRoundMetaMap,
} from '@cuberoot/shared';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { displayCuberName } from '@/lib/name-utils';
import { formatDateRangeIso, toIsoDate } from '@/lib/wca-date';
import { Flag as SharedFlag } from '@/components/Flag';
import { YearMonthPickerPopover } from '@/components/YearMonthPickerPopover';
import { RecordBadge } from '@/components/RecordBadge';
import { RegionPicker } from '@/components/RegionPicker';
import {
  loadCompRecordsSummary,
  loadCompRecordsDetail,
  getCompRecordTop,
  getCompRecordEntries,
  type RecordEntry,
} from '@/lib/comp-records';
import { formatWcaResult } from '@/lib/wca-format-result';
import { loadFlagData, personFlagIso2, compNameZh, countryToIso2, compFlagIso2 } from '@/lib/country-flags';
import { localizeCompName } from '@/lib/comp-localize';
import { compLinkProps } from '@/lib/comp-link';
import { defaultCancelledCutoffIso, isCancelledComp, compNameMatches } from '@/lib/comp-search';
import { formatRegStatus } from '@/lib/comp-reg-status';
import { localizeCity } from '@/lib/city-localize';
import { countryName } from '@/lib/country-name';
import { expandCountrySelection } from '@/lib/continent';
import { fetchCompRounds, fetchCompWcif, fetchCubingZh } from '@/lib/comp-wcif';
import { statsUrl } from '@/lib/stats-base';
import { ClearButton } from '@/components/ClearButton';
import { CubingIcon } from '@/components/EventIcon';
import { fetchUserUpcoming, type WcaPersonLite } from '@/lib/wca-api';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { CompCuberPicker } from '@/components/CompCuberPicker';
import { CompCard } from '@/components/CompCard';
import OnThisDayModal from './_components/OnThisDayModal';
import MonthGrid from '@/components/MonthGrid';
import PillToggle from '@/components/PillToggle/PillToggle';
import { useCompFollows, FollowStar } from '@/components/CompFollow';
import { useAuthStore } from '@/lib/auth-store';
import './calendar_page.css';
import './comp.css';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

// view=globe 视图:复用 /wca/globe 的 MapLibre 地球,dynamic + ssr:false 懒加载,
// ~550KB maplibre 仅在切到地球视图时下载,不进日历首屏 bundle。
const GlobeMapClient = dynamic(() => import('../globe/GlobeMapClient'), {
  ssr: false,
  loading: () => <div className="comp-globe-loading">Loading globe…</div>,
});

// ── 最近浏览(localStorage)─────────────────────────────────────────────────

const RECENT_KEY = 'comp.recent';
const RECENT_MAX = 12;

interface RecentEntry {
  slug: string;
  name: string;
  // 详情页查看时实时解析的中文名(cubing.com 原始全名,含 WCA/魔方),localizeCompName 会 stripWcaPrefix。
  // 持久化它,使最近浏览不必等 comp_names_zh.json 日更也能显示新比赛中文名。
  nameZh?: string;
  // 同理持久化国家 iso2(新比赛尚未进 comp_countries.json 时 compFlagIso2 查不到,用它兜底渲染国旗)。
  iso2?: string;
  viewedAt: number;
}

function decodeEntities(s: string): string {
  if (!s) return s;
  return s
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function loadRecent(): RecentEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const valid = arr.filter((e): e is RecentEntry =>
      e && typeof e.slug === 'string' && typeof e.name === 'string' && typeof e.viewedAt === 'number'
      && (e.nameZh == null || typeof e.nameZh === 'string')
      && (e.iso2 == null || typeof e.iso2 === 'string'),
    );
    const dedup = new Map<string, RecentEntry>();
    for (const e of valid) {
      const norm = { ...e, slug: e.slug.replace(/-/g, '') };
      const existing = dedup.get(norm.slug);
      if (!existing || existing.viewedAt < norm.viewedAt) dedup.set(norm.slug, norm);
    }
    return [...dedup.values()].sort((a, b) => b.viewedAt - a.viewedAt);
  } catch { return []; }
}

export function rememberRecent(slug: string, name: string, nameZh?: string, iso2?: string) {
  if (typeof window === 'undefined') return;
  try {
    const norm = slug.replace(/-/g, '');
    const all = loadRecent();
    // nameZh / iso2 缺省时保留旧记录里已有的(例如 EN 模式再次访问不该抹掉之前解析到的中文 / 国旗)
    const prev = all.find(r => r.slug === norm);
    const cur = all.filter(r => r.slug !== norm);
    const entry: RecentEntry = { slug: norm, name, nameZh: nameZh ?? prev?.nameZh, iso2: iso2 ?? prev?.iso2, viewedAt: Date.now() };
    const next: RecentEntry[] = [entry, ...cur].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* quota */ }
}

// ── 类型定义 ──────────────────────────────────────────────────────────────

interface EventTag {
  id: string;
  wr: 'current' | 'former' | null;
}

interface TopCuber {
  id: string;
  name: string;
  events: EventTag[];
}

interface Competition {
  id: string;
  name: string;
  name_zh?: string;
  city: string;
  city_zh?: string;
  country: string;
  start_date: string;
  end_date: string;
  events: string[];
  /** event 短码 → 该项目轮次数；过去比赛由 all_past_comps.json 静态字段提供，未来比赛打开 modal 时走 WCIF runtime 拉 */
  rounds?: Record<string, number>;
  /** event 短码 → 该项目报名/参赛人数（upcoming=WCIF 报名聚合，past=results 实际参赛）；缺省时格子留空 */
  event_regs?: Record<string, number>;
  /** event 短码 → round-1 WCIF 紧凑配置（限时/及格/晋级/资格）。未来比赛内联自 JSON；过去比赛由懒加载 meta 文件补；缺时运行时 WCIF 兜底 */
  roundMeta?: Record<string, RoundMeta>;
  competitor_limit: number;
  /** 实际参赛人数（过去比赛 all_past_comps.json 提供；未来比赛无此数据） */
  competitors?: number;
  /** 已接受报名人数（未来比赛 WCIF accepted persons 总数）；满员 = registered >= competitor_limit */
  registered?: number;
  /** 经纬度（来自比赛 JSON，Globe 视图同源）；多地代码无真实坐标为 null/缺省 */
  latitude_degrees?: number | null;
  longitude_degrees?: number | null;
  registration_open?: string | null;   // ISO 8601 UTC
  registration_close?: string | null;
  /** 项目修改截止时刻（ISO，单场端点专属，列表数据由管道逐场回填）；缺为 null */
  event_change_deadline?: string | null;
  cubing_china_url?: string;
  top_cubers: TopCuber[];
}

interface UpcomingData {
  competitions: Competition[];
}

// ── 常量 ──────────────────────────────────────────────────────────────────

const SOON_DAYS = 7;
const MAX_TRACKS = 3;

// NOTE: 后端短名 → WCA eventId（用于 cubing-icon CSS class）
const SHORT_TO_EVENT_ID: Record<string, string> = {
  '3': '333', '2': '222', '4': '444', '5': '555', '6': '666', '7': '777',
  '3bf': '333bf', 'fm': '333fm', 'oh': '333oh',
  'minx': 'minx', 'py': 'pyram', 'clock': 'clock',
  'sk': 'skewb', 'sq1': 'sq1',
  '4bf': '444bf', '5bf': '555bf', 'mbf': '333mbf',
  'ft': '333ft', 'mbo': '333mbo', 'mag': 'magic', 'mmag': 'mmagic',
};
// 反向映射：WCA eventId → 后端短名（WCIF 用 WCA eventId,我们的 comp.events 用短名）
const WCA_EVENT_ID_TO_SHORT: Record<string, string> = Object.fromEntries(
  Object.entries(SHORT_TO_EVENT_ID).map(([s, w]) => [w, s])
);

const EVENT_ORDER = WCA_EVENT_ORDER;

const WEEKDAY_EN = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const WEEKDAY_ZH = ['一','二','三','四','五','六','日'];
// ── 工具函数 ──────────────────────────────────────────────────────────────

/** 把 YYYY-MM-DD 字符串解析为本地 Date（00:00 本地时间，避免 UTC 偏移） */
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86400000);
}

/** 获取月历起始日（包含 month 第 1 日那一周的周日） */
function monthGridStart(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  // NOTE: Mon-first 布局 — JS getDay() 里 Sun=0, Mon=1, ..., Sat=6；(day+6)%7 映射为 Mon=0, Tue=1, ..., Sun=6
  return addDays(first, -((first.getDay() + 6) % 7));
}

// ── 国旗 ──────────────────────────────────────────────────────────────────

// 中文模式下比赛名本地化:upcoming JSON 的 name_zh(追踪选手近期赛)→ comp_names_zh.json 的英→中映射 → 兜底英文。
// 走单一入口 localizeCompName,c.name_zh 通过 explicitNameZh 传进去。
function localizeName(c: { id?: string; name: string; name_zh?: string }, isZh: boolean): string {
  return localizeCompName(c.id ?? '', c.name, isZh, { explicitNameZh: c.name_zh });
}

// 日历/紧凑/详情视图里去掉名字结尾的年份 —— 月历自带年月,名字里的年是冗余。
// 英文名 "Wuhan Open 2026"(空格分隔)和中文名贴年 "漳州公开赛2026"(stripWcaPrefix 把前缀年挪到尾部、
// 结尾是 CJK 时不加空格)都要去掉,否则只有英文名/带拉丁后缀的被剥、纯中文名残留年份(就是用户看到的不一致)。
// 仅用于日历相关视图;列表视图保留年份(跨年滚动需消歧)。
function localizeNameNoYear(c: { id?: string; name: string; name_zh?: string }, isZh: boolean): string {
  const name = localizeName(c, isZh);
  const out = name.replace(/\s*(?:19|20)\d{2}$/, '').trimEnd();
  return out || name;
}

function Flag({ iso2 }: { iso2: string }) {
  return <SharedFlag iso2={iso2} spanClassName="flag-span" imgClassName="flag-img" />;
}

// 已关注比赛的视觉标记(日历条 / 列表行 / day-list)。这些都是整行/整条 <button>,不能再嵌
// 可点按钮,故只作状态指示;切换关注在 CompModal / 详情页里完成。仅在 follows 命中时渲染。
function FollowMark() {
  return (
    <span className="comp-follow-mark" aria-hidden="true">
      <Star size={12} fill="currentColor" />
    </span>
  );
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

  // 轮次数：过去比赛走 all_past_comps.json 的静态 rounds 字段（key 用短码 '3'/'2'/...）；
  // 未来比赛该字段缺省，回落 WCIF runtime 拉取（key 是 WCA eventId '333'/'222'/...）。
  // 渲染处统一按短码读取。
  const [rounds, setRounds] = useState<Record<string, number>>(() => comp.rounds ?? {});
  useEffect(() => {
    if (comp.rounds && Object.keys(comp.rounds).length > 0) {
      setRounds(comp.rounds);
      return;
    }
    let cancelled = false;
    fetchCompRounds(comp.id).then((wcifRounds) => {
      if (cancelled) return;
      // WCIF 返回 WCA eventId（'333'）→ 转成前端短码（'3'）以对齐 comp.events / 渲染查找
      const mapped: Record<string, number> = {};
      for (const [eid, formats] of Object.entries(wcifRounds)) {
        mapped[WCA_EVENT_ID_TO_SHORT[eid] ?? eid] = formats.length;
      }
      setRounds(mapped);
    });
    return () => { cancelled = true; };
  }, [comp.id, comp.rounds]);

  const displayName = localizeNameNoYear(comp, isZh);
  const displayCity = isZh ? (comp.city_zh || localizeCity(comp.city, true, comp.country)) : comp.city;
  const displayCountry = countryName(comp.country, isZh);

  const dateStr = formatDateRangeIso(comp.start_date, comp.end_date || comp.start_date);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-panel${cancelled ? ' is-cancelled' : ''}`} onClick={(ev) => ev.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <h2 className="modal-title">
          <Link {...compLinkProps(comp.id)}>
            <Flag iso2={comp.country} />
            <span className={cancelled ? 'modal-title-name is-cancelled' : 'modal-title-name'}>{displayName}</span>
          </Link>
          {cancelled && <span className="modal-cancelled-tag">{tr({ zh: '已取消', en: 'Cancelled' })}</span>}
          <FollowStar
            variant="inline"
            compId={comp.id}
            followed={followed}
            onToggle={onToggleFollow}
            loggedIn={loggedIn}
            onRequireLogin={onRequireLogin}
          />
        </h2>
        <div className="modal-meta">
          {dateStr} · {displayCity}{(i18n.language.startsWith('zh') ? '，' : ', ')}{displayCountry}
          {comp.competitor_limit > 0 && <span> · {t('upcoming.competitorLimit', { count: comp.competitor_limit })}</span>}
        </div>
        {(() => {
          const reg = formatRegStatus(comp.registration_open, comp.registration_close, isZh);
          return reg ? <div className="modal-meta">{reg}</div> : null;
        })()}
        {comp.events && comp.events.length > 0 && (
          <div className="modal-events">
            {comp.events.map((ev) => {
              const eid = SHORT_TO_EVENT_ID[ev] || ev;
              const r = rounds[ev];
              return (
                <div key={ev} className="modal-event">
                  <CubingIcon icon={`event-${eid}`} />
                  {r ? <span className="modal-event-rounds">{r}</span> : <span className="modal-event-rounds modal-event-rounds--placeholder">·</span>}
                </div>
              );
            })}
          </div>
        )}
        {recordEntries.length > 0 && (
          <div className="modal-records">
            <div className="modal-records-title">{t('upcoming.records', { count: recordEntries.length })}</div>
            <ul className="modal-record-list">
              {recordEntries.map((r, idx) => (
                <li key={idx} className="modal-record-item">
                  <RecordBadge record={r.t} />
                  <CubingIcon icon={`event-${r.e}`} />
                  <span className="record-kind">{r.k === 's' ? t('upcoming.single') : t('upcoming.average')}</span>
                  <span className="record-value mono">{formatWcaResult(r.v, r.e, r.k === 's' ? 'single' : 'average')}</span>
                  <Link
                    prefetch={false}
                    href={`/${(i18n.language.startsWith('zh') ? 'zh' : 'en')}/wca/persons/${r.p}`}
                    className="record-person"
                  >
                    <SharedFlag iso2={personFlagIso2(r.p)} />
                    <span>{displayCuberName(r.n, isZh)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {comp.top_cubers.length > 0 && (
          <div className="modal-cubers">
            <div className="modal-cubers-title">{t('upcoming.topCubers', { count: comp.top_cubers.length })}</div>
            <div className="modal-cuber-list">
              {comp.top_cubers.map((c) => (
                <Link
                  key={c.id}
                  prefetch={false}
                  href={`/${(i18n.language.startsWith('zh') ? 'zh' : 'en')}/wca/persons/${c.id}`}
                  className="cuber-tag"
                >
                  <SharedFlag iso2={personFlagIso2(c.id)} />
                  <span>{displayCuberName(c.name, isZh)}</span>
                  {c.events && c.events.length > 0 && (
                    <span className="event-label">
                      {c.events.map((evt) => {
                        const eid = SHORT_TO_EVENT_ID[evt.id] || evt.id;
                        const wrClass = evt.wr === 'current' ? ' wr-current' : evt.wr === 'former' ? ' wr-former' : '';
                        const wrTitle = evt.wr === 'current' ? t('upcoming.wrCurrent') : evt.wr === 'former' ? t('upcoming.wrFormer') : '';
                        return (
                          <CubingIcon
                            key={evt.id}
                            icon={`event-${eid}`}
                            className={wrClass.trim() || undefined}
                            title={wrTitle || undefined}
                          />
                        );
                      })}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
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
    event_regs: w.event_regs,
    roundMeta: w.round_meta,
    competitor_limit: w.competitor_limit,
    registered: w.registered,
    registration_open: w.registration_open ?? undefined,
    registration_close: w.registration_close ?? undefined,
    event_change_deadline: w.event_change_deadline ?? undefined,
    latitude_degrees: w.latitude_degrees,
    longitude_degrees: w.longitude_degrees,
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
    event_regs: w.event_regs,
    competitor_limit: w.competitor_limit ?? 0,
    competitors: w.competitors,
    latitude_degrees: w.latitude_degrees,
    longitude_degrees: w.longitude_degrees,
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

function readQFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const p = new URLSearchParams(window.location.search);
  return p.get('q') ?? '';
}

type ViewMode = 'calendar' | 'card' | 'list' | 'globe';
const VIEW_MODES: ViewMode[] = ['calendar', 'card', 'list', 'globe'];

// 日历视图的两种排布:'comp' = 每场比赛一条 event-bar(原 calendar);'country' = 同国当天聚成一面国旗(原 compact)。
// 由 month-bar 的 PillToggle 切换,取代原先独立的「紧凑」视图图标。
type CalLayout = 'comp' | 'country';
const CAL_LAYOUTS: CalLayout[] = ['comp', 'country'];

// 列表视图每个项目格子显示什么。rounds/regs 走静态字段；其余 4 个走 round-1 WCIF meta（仅 upcoming）。
type EventMetric = 'rounds' | 'regs' | 'timeLimit' | 'cutoff' | 'advancement' | 'qualification';
const EVENT_METRICS: EventMetric[] = ['rounds', 'regs', 'timeLimit', 'cutoff', 'advancement', 'qualification'];
// 需要运行时 WCIF round-1 meta 的 metric（rounds/regs 不需要）
const WCIF_META_METRICS = new Set<EventMetric>(['timeLimit', 'cutoff', 'advancement', 'qualification']);
// 值较宽（时间 / 及格线 / 晋级）的 metric — 列表事件列要加宽，避免 1.3rem 挤不下 "10:00"
const WIDE_METRICS = new Set<EventMetric>(['timeLimit', 'cutoff', 'advancement']);

function pad2n(n: number): string { return n < 10 ? `0${n}` : `${n}`; }
/** 厘秒 → 紧凑时长 "M:SS" / "H:MM:SS"（时间上限用，始终真实时间，不走事件语义） */
function fmtDurationCs(cs: number): string {
  const t = Math.round(cs / 100);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return h > 0 ? `${h}:${pad2n(m)}:${pad2n(s)}` : `${m}:${pad2n(s)}`;
}

/** 结果串去掉无意义的 ".00" 尾巴，让格子更紧凑（"1:15.00"→"1:15"、"30.00"→"30"；非零厘秒保留） */
function compactResult(s: string): string { return s.replace(/\.00$/, ''); }

/** 一个项目格子在给定 metric 下的显示文本 + tooltip。wcaEid 用于事件语义结果格式化，shortEid 用于读静态字段。
 *  meta 为解析后的 round-1 紧凑配置（来自静态 JSON / 懒加载 / 运行时兜底），缺则留空。 */
function eventCellContent(
  metric: EventMetric,
  wcaEid: string,
  shortEid: string,
  c: Competition,
  meta: RoundMeta | undefined,
  isZh: boolean,
): { text: string; title?: string } {
  if (metric === 'rounds' || metric === 'regs') {
    const src = metric === 'regs' ? c.event_regs : c.rounds;
    const v = src?.[shortEid];
    return { text: v != null ? String(v) : '' };
  }
  if (!meta) return { text: '' };
  if (metric === 'timeLimit') {
    if (meta.tl == null) return { text: '' };
    const d = fmtDurationCs(meta.tl);
    return {
      text: meta.cum ? `∑${d}` : d,
      title: meta.cum
        ? (isZh ? `累计时间上限 ${d}` : `Cumulative time limit ${d}`)
        : (isZh ? `时间上限 ${d}` : `Time limit ${d}`),
    };
  }
  if (metric === 'cutoff') {
    if (!meta.co) return { text: '' };
    const [n, res] = meta.co;
    const r = compactResult(formatWcaResult(res, wcaEid, 'single'));
    const bo = n ? (isZh ? `（取${n}把）` : ` (best of ${n})`) : '';
    return { text: r, title: (isZh ? `及格线 ${r}` : `Cutoff ${r}`) + bo };
  }
  if (metric === 'advancement') {
    if (!meta.adv) return { text: '' };
    const kind = meta.adv[0];
    const level = Number(meta.adv.slice(1));
    if (kind === 'r') return { text: `T${level}`, title: isZh ? `前 ${level} 名晋级` : `Top ${level} advance` };
    if (kind === 'p') return { text: `${level}%`, title: isZh ? `前 ${level}% 晋级` : `Top ${level}% advance` };
    const r = compactResult(formatWcaResult(level, wcaEid, 'single'));
    return { text: `≤${r}`, title: isZh ? `成绩 ≤ ${r} 晋级` : `Advance if ≤ ${r}` };
  }
  // qualification: q = "type:resultType:level"
  //   ranking       → level 是排名位次(前 N 名),不是成绩值;禁过 formatWcaResult(会把"前 14 名"读成 0.14s)
  //   attemptResult → level 是成绩值(按 single/average 格式化),报名需 ≤ 该值
  //   anyResult     → 无有效 level,该项目完成过任一有效成绩即可
  if (!meta.q) return { text: '' };
  const [qType, qRes, qLevel] = meta.q.split(':');
  const isAvg = qRes === 'average';
  const rk = isAvg ? 'average' : 'single';
  let detail: string;
  if (qType === 'ranking') {
    const n = Number(qLevel);
    detail = isZh ? `${isAvg ? '平均' : '单次'}排名前 ${n}` : `top ${n} by ${rk}`;
  } else if (qType === 'attemptResult' && qLevel) {
    const r = compactResult(formatWcaResult(Number(qLevel), wcaEid, rk));
    detail = isZh ? `${isAvg ? '平均' : '单次'} ≤ ${r}` : `${rk} ≤ ${r}`;
  } else {
    detail = isZh ? `需有${isAvg ? '平均' : '单次'}成绩` : `any ${rk} result`;
  }
  return { text: 'Q', title: tr({ zh: '参赛资格：', en: 'Qualification: ' }) + detail };
}

// 列表视图整场列 metric：实际人数 / 上限(competitorLimit) / 满员率(实际÷上限) / 不显示。
// 三列合并成一列，由左下拉选当前显示哪个；点列头按它升/降排序。
// latlng = 经纬度,下拉里是一个选项,但表头/行渲染成「纬度 + 经度」两列(各自可排序)
// 'peopleLimit' = 人数 + 上限合并成一个 metric,表头展开成两个子列（人数 | 上限），同 latlng 的双列模式
type CompMetric = 'peopleLimit' | 'ratio' | 'nameLength' | 'cityLength' | 'latlng';
const COMP_METRICS: CompMetric[] = ['peopleLimit', 'ratio', 'nameLength', 'cityLength', 'latlng'];
// 经纬度可正可负、可为 0（赤道/本初子午线），不能套用 "<=0 视为缺失" 的计数列规则
const SIGNED_METRICS = new Set<CompMetric>(['latlng']);
// 经纬度子列排序键：latlng 模式下点哪一列就按哪个坐标排
type CoordKey = 'lat' | 'lng';
// 双列 metric 的子列排序键：latlng → lat/lng；peopleLimit → people/limit
type SubKey = CoordKey | 'people' | 'limit';
// 列表统一排序状态：null = 默认按日期倒序。
// col='comp' 按整场列数值（latlng/peopleLimit 看 coord 子列）；col='name'/'city'/'country' 按比赛名/城市名/国家名首字母（locale 排序）。
type SortCol = 'comp' | 'name' | 'city' | 'country' | 'date' | 'reg';
type ListSort = { col: SortCol; coord?: SubKey; dir: 'asc' | 'desc' } | null;

/** peopleLimit 双列各自的标题（人数 / 上限） */
function subColTitle(kind: 'people' | 'limit'): string {
  return kind === 'people'
    ? tr({ zh: '人数(过去=实际参赛,未来=已报名)', en: 'People (past: competitors, upcoming: registrations)' })
    : tr({ zh: '人数上限', en: 'Competitor limit' });
}

function compColTitle(m: CompMetric): string {
  if (m === 'ratio') return tr({ zh: '满员率(人数/上限)', en: 'Fill rate (people/limit)'
});
  if (m === 'nameLength') return tr({ zh: '比赛名称长度(字符数)', en: 'Name length (characters)'
});
  if (m === 'cityLength') return tr({ zh: '比赛城市名长度(字符数)', en: 'City name length (characters)'
});
  return '';
}

/** 经纬度子列标题（latlng 模式下两列各自的 title / aria） */
function coordColTitle(kind: CoordKey): string {
  return kind === 'lat'
    ? tr({ zh: '纬度(北纬正 / 南纬负)', en: 'Latitude (N+ / S-)'
    })
    : tr({ zh: '经度(东经正 / 西经负)', en: 'Longitude (E+ / W-)'
    });
}

/** 当前语言下比赛城市的显示串（中文走 city_zh / 本地化，英文走原 city） */
function displayCityOf(c: Competition, isZh: boolean): string {
  return isZh ? (c.city_zh || localizeCity(c.city, true, c.country)) : c.city;
}

/** 比赛经纬度，缺坐标 / 多地代码 / (0,0) 哨兵均按缺失返回 null（与 Globe 端口径一致） */
function compCoord(c: Competition, kind: 'lat' | 'lng'): number | null {
  const lat = c.latitude_degrees, lng = c.longitude_degrees;
  if (lat == null || lng == null) return null;
  if (lat === 0 && lng === 0) return null;
  return kind === 'lat' ? lat : lng;
}

/** 整场「人数」取值:过去比赛 = 实际参赛人数(competitors);未来比赛 = 已接受报名人数(registered,开放后才有)。
 *  让列表「实际人数」列对已开放报名的未来比赛也显示报名人数,而不只是已结束的比赛。
 *  registered=0 多为 WCIF 数据缺口(cubing.com 域内赛 / 尚未处理),按缺失留空,不显示误导性的「0」。 */
function compPeople(c: { competitors?: number; registered?: number }): number | undefined {
  if (c.competitors != null) return c.competitors;
  return c.registered ? c.registered : undefined;
}

/** 满员率 = min(人数 / 人数上限, 100%)；缺人数 / 无上限(0) → null。人数 = 实际(过去) 或 报名(未来)。
 *  人数>上限(上限填错 / 多阶段 / 多地点等)视为已满员，封顶 100%，不出现 >100% 的脏值 */
function fillRate(c: { competitors?: number; registered?: number; competitor_limit: number }): number | null {
  const p = compPeople(c);
  return p != null && c.competitor_limit > 0
    ? Math.min(1, p / c.competitor_limit) : null;
}

function regPad(n: number): string { return String(n).padStart(2, '0'); }
/** 本地时区「日期 时刻」(MM-DD HH:MM)。 */
function fmtWhen(d: Date): string {
  if (Number.isNaN(d.getTime())) return '';
  return `${regPad(d.getMonth() + 1)}-${regPad(d.getDate())} ${regPad(d.getHours())}:${regPad(d.getMinutes())}`;
}
/** 本地时区完整「YYYY-MM-DD HH:MM」(hover 标题用,带年份消歧)。 */
function fmtWhenFull(d: Date): string {
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${regPad(d.getMonth() + 1)}-${regPad(d.getDate())} ${regPad(d.getHours())}:${regPad(d.getMinutes())}`;
}
/** cubing.com 退赛/重开是北京时间(UTC+8)墙钟串(如 "2026-07-24 21:00:00") → epoch ms。 */
function parseBeijingMs(s: string): number {
  const m = s.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/);
  if (m) return Date.parse(`${m[1]}T${m[2]}+08:00`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return Date.parse(`${s.trim()}T00:00:00+08:00`);
  return NaN;
}

type CnReg = { withdrawDeadline: string | null; reopenAt: string | null } | null | undefined;

/** 比赛全部报名相关时间点(epoch ms + 标签 + 是否「开放类」,统一本地时区比较/展示)。
 *  开放/截止/修改截止来自 baked ISO(UTC);退赛/重开来自 cubing.com 北京时间串(CN 行懒拉)。 */
function regMilestones(
  open: string | null | undefined,
  close: string | null | undefined,
  change: string | null | undefined,
  cn: CnReg,
): { t: number; word: string; opening: boolean }[] {
  const out: { t: number; word: string; opening: boolean }[] = [];
  const pushIso = (iso: string | null | undefined, word: string, opening: boolean) => {
    if (!iso) return;
    const t = new Date(iso).getTime();
    if (Number.isFinite(t)) out.push({ t, word, opening });
  };
  const pushBeijing = (s: string | null | undefined, word: string, opening: boolean) => {
    if (!s) return;
    const t = parseBeijingMs(s);
    if (Number.isFinite(t)) out.push({ t, word, opening });
  };
  pushIso(open, tr({ zh: '开放', en: 'Opens' }), true);
  pushIso(close, tr({ zh: '截止', en: 'Closes' }), false);
  pushBeijing(cn?.withdrawDeadline, tr({ zh: '退赛截止', en: 'Withdraw' }), false);
  pushBeijing(cn?.reopenAt, tr({ zh: '重开报名', en: 'Reopens' }), true);
  pushIso(change, tr({ zh: '修改截止', en: 'Edit by' }), false);
  return out;
}

/** 列表「报名」列:全部时间点里「离现在最近的将来那个」自动选中(开放类绿 / 截止类黄,24h 内红);
 *  全部已过 → 报名已截止;无报名字段(过去比赛)→ null。 */
function regMilestone(
  open: string | null | undefined,
  close: string | null | undefined,
  change: string | null | undefined,
  cn: CnReg,
): { when: string; word: string; tone: 'open' | 'close' | 'urgent' | 'closed' } | null {
  const cands = regMilestones(open, close, change, cn);
  if (!cands.length) return null;
  const now = Date.now();
  const future = cands.filter((c) => c.t > now).sort((a, b) => a.t - b.t);
  if (!future.length) return { when: '', word: tr({ zh: '报名已截止', en: 'Closed' }), tone: 'closed' };
  const n = future[0]!;
  const tone = n.opening ? 'open' : (n.t - now <= 86_400_000 ? 'urgent' : 'close');
  return { when: fmtWhen(new Date(n.t)), word: n.word, tone };
}

/** 日历胶囊填充色用的「当前报名状态」(本地此刻):未开放 / 报名中 / 满员 / 即将截止(<24h) / 已截止·无字段。
 *  纯色块无文字,故编码「此刻状态」而非列表用的「下一个里程碑」。只用已 bake 的 open/close + registered/limit
 *  (CN 退赛/重开是懒拉,不进上千个胶囊的填充色);过去比赛无报名字段 → closed。
 *  满员 = 报名窗口内且已接受报名 ≥ 上限(超额者进候补);截止后即便满员也只算 closed(反正报不了)。 */
function regState(
  open: string | null | undefined,
  close: string | null | undefined,
  registered: number | null | undefined,
  limit: number | null | undefined,
): 'upcoming' | 'open' | 'urgent' | 'full' | 'closed' {
  const now = Date.now();
  const o = open ? new Date(open).getTime() : NaN;
  const c = close ? new Date(close).getTime() : NaN;
  if (Number.isFinite(o) && now < o) return 'upcoming';   // 还没开放
  if (Number.isFinite(c) && now >= c) return 'closed';    // 已过截止(满不满都报不了)
  // 此刻在报名窗口内(或无 close 字段)
  if (registered != null && limit != null && limit > 0 && registered >= limit) return 'full';  // 满员·仅候补
  if (Number.isFinite(c)) return c - now <= 86_400_000 ? 'urgent' : 'open';  // 报名中(含 24h 内紧急)
  return Number.isFinite(o) ? 'open' : 'closed';          // 无 close:open 已过→报名中;全无字段→已截止
}

/** 列表「报名」列排序键:离现在最近的「将来」报名节点 epoch ms。已全过 / 无字段 → null(沉底)。
 *  退赛/重开是 CN-only 懒拉(排序时未必加载),故排序只用 baked 的 开放/截止/修改截止。 */
function regSortMs(c: { registration_open?: string | null; registration_close?: string | null; event_change_deadline?: string | null }): number | null {
  const now = Date.now();
  const ts = [c.registration_open, c.registration_close, c.event_change_deadline]
    .map((x) => (x ? new Date(x).getTime() : NaN))
    .filter((t) => Number.isFinite(t) && t > now);
  return ts.length ? Math.min(...ts) : null;
}

/** 列表「报名」列 hover:全部报名节点完整时刻(本地时区,按时间升序,每个一行)。
 *  标签补到等宽(CJK 标签用全角空格 U+3000,原生 tooltip 里与汉字同宽)→ 各行日期列对齐。 */
function regFullTitle(
  open: string | null | undefined,
  close: string | null | undefined,
  cn: CnReg,
  change: string | null | undefined,
): string | undefined {
  const items = regMilestones(open, close, change, cn).sort((a, b) => a.t - b.t);
  if (!items.length) return undefined;
  // CJK 标签(码点 > 0xff)按全角空格补齐;拉丁标签按普通空格(原生 tooltip 比例字体无法精确对齐,尽力而为)。
  const padCh = items[0]!.word.charCodeAt(0) > 0xff ? String.fromCharCode(0x3000) : ' ';
  const maxLen = Math.max(...items.map((m) => m.word.length));
  return items
    .map((m) => `${m.word}${padCh.repeat(maxLen - m.word.length)} ${fmtWhenFull(new Date(m.t))}`)
    .join('\n');
}

// ── 列表视图 ──────────────────────────────────────────────────────────────
// 不分月，按 start_date 倒序排列、按年分组；点行同样打开 CompModal。
// 数据量可达 ~17k —— 用 fixed-height 虚拟滚动只渲染视口内 ~30 行，无上限。
// 行高统一 44px（年标题与比赛行同高）以便 O(1) 计算可见区间。

const LIST_ROW_H = 44;
const LIST_BUFFER = 8; // 视口外多渲染几行做缓冲，避免快速滚动时露白

// 列表 name / city / country 各列宽度 cap (px)：上限防极端长名撑爆行；下限保证短名筛选时不至于挤成一团
const LIST_NAME_MIN_PX = 10 * 16;
const LIST_NAME_MAX_PX = 34 * 16;
const LIST_CITY_MIN_PX = 5 * 16;
const LIST_CITY_MAX_PX = 16 * 16;
const LIST_COUNTRY_MIN_PX = 3.5 * 16;
const LIST_COUNTRY_MAX_PX = 12 * 16;
const LIST_CELL_PAD_PX = 8; // 测得最长后再加一点缓冲，防 ellipsis 误切

/** 用 canvas.measureText 分别测当前可视行 country / name / city 最长那行的实际像素宽,
 *  让三列各自贴最长一行、短名筛选场景下空白几乎消失,且各列起点对齐成独立列。
 *  不再压到视口宽:列各取自然宽(带上下限),整张表超出视口时由 .comp-list 横向滚动
 *  (桌面也滚),保证比赛名 / 国家名永远完整,长名走弹窗的旧妥协移除。O(n)，~30 行可视 ≈ 1ms。 */
function measureNameCityCols(comps: Competition[], isZh: boolean): { namePx: number; cityPx: number; countryPx: number } {
  const fallback = { namePx: 18 * 16, cityPx: 11 * 16, countryPx: 6 * 16 };
  if (typeof document === 'undefined' || comps.length === 0) return fallback;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return fallback;
  const rootFontPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const bodyFont = getComputedStyle(document.body).fontFamily || 'sans-serif';
  const nameFontPx = 0.85 * rootFontPx;
  const cityFontPx = 0.78 * rootFontPx;
  ctx.font = `500 ${nameFontPx}px ${bodyFont}`;
  let maxName = 0;
  for (let i = 0; i < comps.length; i++) {
    const w = ctx.measureText(localizeName(comps[i], isZh)).width;
    if (w > maxName) maxName = w;
  }
  ctx.font = `400 ${cityFontPx}px ${bodyFont}`;
  let maxCity = 0;
  let maxCountry = 0;
  for (let i = 0; i < comps.length; i++) {
    const w = ctx.measureText(displayCityOf(comps[i], isZh)).width;
    if (w > maxCity) maxCity = w;
    const cw = ctx.measureText(countryName(comps[i].country, isZh)).width;
    if (cw > maxCountry) maxCountry = cw;
  }
  const nameW = Math.max(LIST_NAME_MIN_PX, Math.min(LIST_NAME_MAX_PX, maxName + LIST_CELL_PAD_PX));
  const cityW = Math.max(LIST_CITY_MIN_PX, Math.min(LIST_CITY_MAX_PX, maxCity + LIST_CELL_PAD_PX));
  const countryW = Math.max(LIST_COUNTRY_MIN_PX, Math.min(LIST_COUNTRY_MAX_PX, maxCountry + LIST_CELL_PAD_PX));
  return { namePx: nameW, cityPx: cityW, countryPx: countryW };
}

interface RowItem { comp: Competition; key: string }

function CompList({ comps, isZh, onSelect, onYearChange, outerRef, cancelledCutoffIso, pageRef, compMetric, listSort, eventMetric, pastMeta, followedIds }: {
  comps: Competition[];
  isZh: boolean;
  onSelect: (c: Competition) => void;
  /** 已关注比赛 id 集合 — 命中则在行内比赛名前显示关注标记(切换关注在 CompModal 里) */
  followedIds: Set<string>;
  /** 每个项目格子显示：'rounds'=轮次数 / 'regs'=报名人数 / WCIF round-1 配置 */
  eventMetric: EventMetric;
  /** 过去比赛 round-1 meta 懒加载表（comp id → short → RoundMeta）；未加载 / 未来比赛为 null */
  pastMeta: CompRoundMetaMap | null;
  /** 整场列显示哪个 metric：实际人数 / 上限 / 满员率 / 不显示 */
  compMetric: CompMetric;
  /** 列表统一排序状态；null = 按日期倒序 */
  listSort: ListSort;
  /** 当前可见区域所在年份（用于在 chip 行 sticky 显示）；可见为空时传 null */
  onYearChange: (info: { year: string; count: number } | null) => void;
  /** 横向滚动容器 — 父组件用它和 chip 表头同步 scrollLeft */
  outerRef?: React.Ref<HTMLDivElement>;
  /** 已取消比赛的 end_date 阈值（ISO 字符串） */
  cancelledCutoffIso: string;
  /** .calendar-page 根元素 ref —— 用来按当前可视行最长 name / city 写 --cl-name-width / --cl-city-width */
  pageRef: React.RefObject<HTMLDivElement | null>;
}) {
  // 整场列单值取值（比例/长度类，用于 col='comp' 数值排序）：经纬度 / peopleLimit 走子列(valOf)、none 返回 null
  const compVal = useCallback((c: Competition): number | null | undefined =>
    compMetric === 'ratio' ? fillRate(c)
      : compMetric === 'nameLength' ? localizeName(c, isZh).length
        : compMetric === 'cityLength' ? displayCityOf(c, isZh).length
          : null, [compMetric, isZh]);
  // 默认按日期倒序。col='name'/'city' 按 locale 首字母排；col='comp' 按整场值排(latlng 看 coord 子列)，
  // 缺值恒沉底、同值再按日期倒序。计数列 <=0 视为缺失；经纬度可正可负可为 0，仅 null 视为缺失。
  const items = useMemo<RowItem[]>(() => {
    const sorted = [...comps];
    const byDateDesc = (a: Competition, b: Competition) => b.start_date.localeCompare(a.start_date);
    if (listSort && listSort.col === 'date') {
      const mul = listSort.dir === 'asc' ? 1 : -1;
      sorted.sort((a, b) => a.start_date.localeCompare(b.start_date) * mul || a.id.localeCompare(b.id));
    } else if (listSort && (listSort.col === 'name' || listSort.col === 'city' || listSort.col === 'country')) {
      const mul = listSort.dir === 'asc' ? 1 : -1;
      const keyOf = listSort.col === 'name'
        ? (c: Competition) => localizeName(c, isZh).trim()
        : listSort.col === 'city'
          ? (c: Competition) => displayCityOf(c, isZh).trim()
          : (c: Competition) => countryName(c.country, isZh).trim();
      const collator = new Intl.Collator(isZh ? 'zh' : 'en', { sensitivity: 'base', numeric: true });
      sorted.sort((a, b) => {
        const cmp = collator.compare(keyOf(a), keyOf(b));
        return cmp !== 0 ? cmp * mul : byDateDesc(a, b);
      });
    } else if (listSort && listSort.col === 'comp') {
      const signed = SIGNED_METRICS.has(compMetric);
      const valOf = compMetric === 'latlng'
        ? (c: Competition) => (listSort.coord === 'lat' || listSort.coord === 'lng' ? compCoord(c, listSort.coord) : null)
        : compMetric === 'peopleLimit'
          ? (c: Competition) => (listSort.coord === 'limit' ? (c.competitor_limit > 0 ? c.competitor_limit : null) : (compPeople(c) ?? null))
          : compVal;
      const mul = listSort.dir === 'asc' ? 1 : -1;
      sorted.sort((a, b) => {
        const av = valOf(a), bv = valOf(b);
        const aM = av == null || (!signed && av <= 0);
        const bM = bv == null || (!signed && bv <= 0);
        if (aM && bM) return byDateDesc(a, b);
        if (aM) return 1;
        if (bM) return -1;
        if (av !== bv) return (av! - bv!) * mul;
        return byDateDesc(a, b);
      });
    } else if (listSort && listSort.col === 'reg') {
      // 报名列：按「下一个报名里程碑时刻」排；缺报名字段（多为过去比赛）恒沉底，同值再按日期倒序
      const mul = listSort.dir === 'asc' ? 1 : -1;
      sorted.sort((a, b) => {
        const av = regSortMs(a), bv = regSortMs(b);
        if (av == null && bv == null) return byDateDesc(a, b);
        if (av == null) return 1;
        if (bv == null) return -1;
        if (av !== bv) return (av - bv) * mul;
        return byDateDesc(a, b);
      });
    } else {
      sorted.sort(byDateDesc);
    }
    return sorted.map((c) => ({ comp: c, key: c.id }));
  }, [comps, listSort, compMetric, isZh, compVal]);
  const yearCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of comps) {
      const y = c.start_date.slice(0, 4);
      m.set(y, (m.get(y) ?? 0) + 1);
    }
    return m;
  }, [comps]);

  const totalH = items.length * LIST_ROW_H;
  const containerRef = useRef<HTMLDivElement>(null);
  // start/end = 渲染窗口（含 LIST_BUFFER 上下缓冲）；top = 真实最顶可见行（不含 buffer），sticky 年份用它
  const [range, setRange] = useState({ start: 0, end: 60, top: 0 });
  const rafRef = useRef<number | null>(null);
  // 中国大陆比赛:懒拉 cubing.com 退赛截止 / 重开报名(server PG 已日更预热,命中即毫秒),
  // 仅对当前可见 CN 行拉(全程 ≤23 场),localStorage 7 天缓存,补进「报名」列 hover。
  const [cnZh, setCnZh] = useState<Record<string, { withdrawDeadline: string | null; reopenAt: string | null }>>({});

  useEffect(() => {
    const compute = () => {
      rafRef.current = null;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // 容器顶相对视口位置：rect.top < 0 表示已滚过，>= 0 表示还没到
      const yTop = Math.max(0, -rect.top) - LIST_BUFFER * LIST_ROW_H;
      const yBot = -rect.top + window.innerHeight + LIST_BUFFER * LIST_ROW_H;
      const start = Math.max(0, Math.floor(yTop / LIST_ROW_H));
      const end = Math.min(items.length, Math.ceil(yBot / LIST_ROW_H));
      const top = Math.max(0, Math.floor(Math.max(0, -rect.top) / LIST_ROW_H));
      setRange((prev) =>
        prev.start === start && prev.end === end && prev.top === top
          ? prev
          : { start, end, top },
      );
    };
    const onScroll = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [items.length]);

  // 通知父组件当前 sticky 年份（真正可见的最顶行的年份 — 用 range.top 而不是 range.start，
  // 后者带 LIST_BUFFER 上缓冲会指向视口外往上 8 行的位置，导致跨年时年份显示滞后）
  // 非日期序（任何列排序）时列表不再按年分组，sticky 年份无意义
  // date 排序仍是按时间分组（年份升/降而已），保留 sticky 年份；其余列排序打散年份分组
  const sorted = !!listSort && listSort.col !== 'date';
  useEffect(() => {
    if (items.length === 0 || sorted) { onYearChange(null); return; }
    const idx = Math.min(range.top, items.length - 1);
    const year = items[idx].comp.start_date.slice(0, 4);
    onYearChange({ year, count: yearCounts.get(year) ?? 0 });
  }, [range.top, items, yearCounts, onYearChange, sorted]);

  // 视口内 upcoming 比赛(无静态 rounds)自动 WCIF 预取 — 让用户不用 hover 也能看到轮次数。
  // fetchCompRounds 内部有 inflight + cache 去重,浏览器同 host 并发上限 6,自然节流。
  // 拉到后直接 mutate c.rounds(WCA eventId → short eid 映射),bump 一次状态触发 re-render。
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    let cancelled = false;
    // round-1 WCIF meta（限时/及格/晋级/资格）只对 upcoming 比赛运行时拉取 —— 过去比赛
    // WCA dump 本就没有这些字段，且 list 含 ~17k 过去赛，逐行拉 WCIF 会狂打 WCA。
    const wantMeta = WCIF_META_METRICS.has(eventMetric);
    const todayIso = toIsoDate(new Date());
    const window = items.slice(range.start, range.end);
    for (const it of window) {
      const c = it.comp;
      const isUpcoming = (c.end_date || c.start_date) >= todayIso;
      if (!isUpcoming) continue;
      const needRounds = !(c.rounds && Object.keys(c.rounds).length > 0);
      const needMeta = wantMeta && !c.roundMeta;
      if (!needRounds && !needMeta) continue;
      fetchCompWcif(c.id).then((w) => {
        if (cancelled) return;
        if (needRounds) {
          const mapped: Record<string, number> = {};
          for (const [eid, formats] of Object.entries(w.rounds)) {
            mapped[WCA_EVENT_ID_TO_SHORT[eid] ?? eid] = formats.length;
          }
          c.rounds = mapped;
        }
        const meta: Record<string, RoundMeta> = {};
        for (const [eid, mm] of Object.entries(w.meta)) {
          meta[WCA_EVENT_ID_TO_SHORT[eid] ?? eid] = mm;
        }
        c.roundMeta = meta;
        forceUpdate();
      });
    }
    return () => { cancelled = true; };
  }, [range.start, range.end, items, eventMetric]);

  // 自适应 country / name / city 三列宽：测当前渲染窗口（含 LIST_BUFFER 缓冲）各自 max，写到
  // .calendar-page 的 --cl-name-width / --cl-city-width / --cl-country-width。滚动到长名行时 cell 扩、滚出再收。
  // 列各取自然宽（不再压到视口）→ 整张表可能比视口宽，由 .comp-list 横向滚动撑开（桌面也滚），
  // 比赛名 / 国家名永远完整。设好列宽后量一次表头 grid 的真实内容宽，写进 --cl-list-min 驱动虚拟列表
  // 的最小宽（≥ 内容宽才能横向滚、≤ 视口时退回 100% 不留滚动条）。LIST_BUFFER=8 让长名提前测到，平滑抖动。
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const apply = () => {
      const visibleComps = items.slice(range.start, range.end).map((it) => it.comp);
      const { namePx, cityPx, countryPx } = measureNameCityCols(visibleComps, isZh);
      el.style.setProperty('--cl-name-width', `${namePx}px`);
      el.style.setProperty('--cl-city-width', `${cityPx}px`);
      el.style.setProperty('--cl-country-width', `${countryPx}px`);
      // 读表头 grid 的实际渲染宽（width:max-content，含新列宽）→ 列表最小宽，桌面/移动端统一横向滚
      const grid = el.querySelector('.event-chips-grid');
      if (grid) el.style.setProperty('--cl-list-min', `${Math.ceil(grid.getBoundingClientRect().width)}px`);
    };
    apply();
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [range.start, range.end, items, isZh, compMetric, eventMetric, pageRef]);

  // 可见 CN 行 → 懒拉 cubing.com 退赛/重开(补进报名 hover)。命中 cnZh 即跳过,只增不重拉,自然收敛。
  useEffect(() => {
    for (const it of items.slice(range.start, range.end)) {
      const c = it.comp;
      if (c.country !== 'CN' || cnZh[c.id]) continue;
      fetchCubingZh(c.id)
        .then((m) => setCnZh((prev) => (prev[c.id] ? prev : { ...prev, [c.id]: { withdrawDeadline: m.withdrawDeadline, reopenAt: m.reopenAt } })))
        .catch(() => {});
    }
  }, [items, range.start, range.end, cnZh]);

  // 卸载时清理 — 切回日历模式不留 stale 列宽变量
  useEffect(() => () => {
    pageRef.current?.style.removeProperty('--cl-name-width');
    pageRef.current?.style.removeProperty('--cl-city-width');
    pageRef.current?.style.removeProperty('--cl-country-width');
    pageRef.current?.style.removeProperty('--cl-list-min');
  }, [pageRef]);

  if (items.length === 0) {
    return <div className="comp-list-empty">{tr({ zh: '没有匹配的比赛', en: 'No competitions match'
    })}</div>;
  }

  const visible = items.slice(range.start, range.end);
  const todayIso = toIsoDate(new Date()); // 列表行判定「比赛已结束」用(本地日)

  return (
    <div className="comp-list" ref={outerRef}>
      <div ref={containerRef} className="comp-list-virtual" style={{ height: totalH }}>
        {visible.map((it, i) => {
          const idx = range.start + i;
          const top = idx * LIST_ROW_H;
          const c = it.comp;
          const endDate = c.end_date || c.start_date;
          const dateStr = formatDateRangeIso(c.start_date, endDate);
          const crossYear = c.start_date.slice(0, 4) !== endDate.slice(0, 4);
          const displayName = localizeName(c, isZh);
          const displayCity = displayCityOf(c, isZh);
          const prefetch = c.rounds ? undefined : () => { void fetchCompRounds(c.id); };
          const events = c.events ?? [];
          const cancelled = isCancelledComp(c, cancelledCutoffIso);
          // 该场 round-1 meta：未来比赛内联 / 运行时兜底走 c.roundMeta；过去比赛走懒加载的 pastMeta 表
          const cMeta = c.roundMeta ?? pastMeta?.[c.id];
          return (
            <button
              key={it.key}
              className={`comp-list-row${cancelled ? ' is-cancelled' : ''}`}
              style={{ top, height: LIST_ROW_H }}
              onClick={() => onSelect(c)}
              onMouseEnter={prefetch}
              onFocus={prefetch}
            >
              {(() => {
                // 比赛已结束(今天在比赛最后一天之后)→ 一律「比赛已结束」,盖过报名状态。
                if (endDate < todayIso) {
                  return (
                    <span className="cl-reg-cell cl-reg-cell--closed">
                      <span className="cl-reg-word">{tr({ zh: '比赛已结束', en: 'Ended' })}</span>
                    </span>
                  );
                }
                // 报名列 = 全部时间点(开放/截止/退赛/重开/修改截止)里离现在最近的「将来」那个,按时间自动选。
                const cn = cnZh[c.id];
                const r = regMilestone(c.registration_open, c.registration_close, c.event_change_deadline, cn);
                const title = regFullTitle(c.registration_open, c.registration_close, cn, c.event_change_deadline);
                if (!r) return <span className="cl-reg-cell" title={title} aria-hidden={!title} />;
                return (
                  <span className={`cl-reg-cell cl-reg-cell--${r.tone}`} title={title}>
                    {r.when && <span className="cl-reg-when mono">{r.when}</span>}
                    <span className="cl-reg-word">{r.word}</span>
                  </span>
                );
              })()}
              <span className="comp-list-date mono">
                {crossYear ? (
                  <>
                    <span className="cl-date-half">{c.start_date}~</span>
                    <span className="cl-date-half">{endDate}</span>
                  </>
                ) : dateStr}
              </span>
              <Flag iso2={c.country} />
              <span className="comp-list-name-cell">
                {followedIds.has(c.id) && <FollowMark />}
                <span className="comp-list-name">{displayName}</span>
              </span>
              <span className="comp-list-country" title={countryName(c.country, isZh)}>{countryName(c.country, isZh)}</span>
              <span className="comp-list-city">{displayCity}</span>
              <span className="cl-days-cell" title={tr({ zh: '天数', en: 'Days'
            })}>
                {daysBetween(parseLocalDate(c.start_date), parseLocalDate(endDate)) + 1}
              </span>
              {compMetric === 'latlng' ? (
                (['lat', 'lng'] as CoordKey[]).map((k) => {
                  const v = compCoord(c, k);
                  return (
                    <span key={k} className="cl-people-cell" title={coordColTitle(k)}>
                      {v == null ? '' : v.toFixed(2)}
                    </span>
                  );
                })
              ) : compMetric === 'peopleLimit' ? (
                (['people', 'limit'] as const).map((k) => {
                  const v = k === 'people' ? compPeople(c) : (c.competitor_limit > 0 ? c.competitor_limit : undefined);
                  return (
                    <span key={k} className={`cl-people-cell${k === 'limit' ? ' cl-limit-cell' : ''}`} title={subColTitle(k)}>
                      {v != null ? v : ''}
                    </span>
                  );
                })
              ) : (
                <span
                  className={`cl-people-cell${compMetric === 'ratio' ? ' cl-limit-cell' : ''}`}
                  title={compColTitle(compMetric)}
                >
                  {(() => {
                    if (compMetric === 'ratio') { const r = fillRate(c); return r == null ? '' : `${Math.round(r * 100)}%`; }
                    if (compMetric === 'nameLength') return localizeName(c, isZh).length;
                    if (compMetric === 'cityLength') return displayCityOf(c, isZh).length;
                    return '';
                  })()}
                </span>
              )}
              {EVENT_ORDER.map((eid) => {
                const shortEid = WCA_EVENT_ID_TO_SHORT[eid] ?? eid;
                const has = events.includes(shortEid);
                const { text, title } = eventCellContent(eventMetric, eid, shortEid, c, cMeta?.[shortEid], isZh);
                return (
                  <span key={eid} className="cl-event-cell" title={title}>
                    {text !== '' ? text : (has ? '·' : '')}
                  </span>
                );
              })}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────────────────────

function CalendarPageInner() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('比赛', 'Competitions');
  const router = useRouter();
  // 比赛关注「盯一下」:登录用户跨设备同步的关注集合(server PG)。在页顶调用一次,把状态下发给
  // 模态 / 列表 / 日历条 / day-list,与首页 OngoingComps 共用同一份 server 数据。
  const { loggedIn: followLoggedIn, follows, toggle: toggleFollow } = useCompFollows();
  const login = useAuthStore((s) => s.login);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  useEffect(() => { setRecent(loadRecent()); }, []);
  const removeRecent = (slug: string) => {
    setRecent((cur) => {
      const next = cur.filter(r => r.slug !== slug);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  };

  const [data, setData] = useState<UpcomingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compQuery, setCompQuery] = useState(() => readQFromUrl());
  // 选手筛选: 静态层(top_cubers + cn_upcoming_registrations) 优先,API 兜底
  const [selectedCuber, setSelectedCuber] = useState<WcaPersonLite | null>(null);
  const [selectedCuberCompIds, setSelectedCuberCompIds] = useState<Set<string> | null>(null);
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
  /** 紧凑模式下点击国旗 tile 时,把 modal 限定到该国家(iso2 小写)。其他场景为 null。 */
  const [dayListCountry, setDayListCountry] = useState<string | null>(null);
  // 点日历格子日期数字 → 打开"历年此日"模态(查跨年 MM-DD 比赛历史)
  const [onThisDayDate, setOnThisDayDate] = useState<Date | null>(null);
  const [mode, setMode] = useState<'top' | 'all'>('all');
  const [allComps, setAllComps] = useState<Competition[] | null>(null);
  const [allLoading, setAllLoading] = useState(false);
  const [allError, setAllError] = useState<string | null>(null);
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
    parseAsStringEnum<ViewMode>(VIEW_MODES).withDefault('calendar').withOptions({ history: 'push' }),
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
  // ?year= ?month= ?q= 走 nuqs(replace,不堆历史)。viewDate/compQuery 仍是真源,
  // 这里只把它们镜像进 URL 方便分享深链;挂载时的初值读取仍走 readMonthFromUrl/readQFromUrl。
  const [, setUrlState] = useQueryStates(
    { year: parseAsInteger, month: parseAsInteger, q: parseAsString },
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
  // 各国首秀：只保留每个国家最早的那一场比赛（一国一条）。走 nuqs，可分享深链。
  const [debutsOnly, setDebutsOnly] = useQueryState(
    'debuts',
    parseAsBoolean.withDefault(false).withOptions({ history: 'replace', scroll: false }),
  );
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

  // NOTE: compQuery 变化时同步 URL ?q= — 支持从全站搜索 deep-link 跳进来,也方便分享筛选状态
  useEffect(() => {
    if (viewMode === 'globe') return;
    setUrlState({ q: compQuery || null });
  }, [compQuery, viewMode, setUrlState]);

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

  // NOTE: All 模式懒加载 — 切到 All 且还没数据时读预生成 JSON（upcoming + past 合并，按 id 去重以 upcoming 为准）
  useEffect(() => {
    if (mode !== 'all' || allComps || allLoading || !data) return;
    setAllLoading(true);
    setAllError(null);
    const topMap = new Map(data.competitions.map((c) => [c.id, c.top_cubers]));
    Promise.all([fetchAllUpcomingCompsJson(), fetchAllPastCompsJson()])
      .then(([upcoming, past]) => {
        const upcomingIds = new Set(upcoming.map((c) => c.id));
        const merged: Competition[] = [
          ...upcoming.map((w) => adaptAllComp(w, topMap)),
          ...past.filter((p) => !upcomingIds.has(p.id)).map(adaptPastComp),
        ];
        setAllComps(merged);
      })
      .catch(() => setAllError(t('upcoming.allLoadFailed')))
      .finally(() => setAllLoading(false));
  }, [mode, allComps, allLoading, data, t]);

  // NOTE: 当前激活的比赛列表——All 模式下数据未到时暂用 Top 数据
  const activeComps: Competition[] = useMemo(() => {
    if (mode === 'all' && allComps) return allComps;
    return data?.competitions ?? [];
  }, [mode, allComps, data]);

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
    const m: Record<string, number> = {};
    for (const c of activeComps) {
      if (!c.rounds) continue;
      for (const [shortEid, n] of Object.entries(c.rounds)) {
        const wcaEid = SHORT_TO_EVENT_ID[shortEid] ?? shortEid;
        if (n > (m[wcaEid] ?? 0)) m[wcaEid] = n;
      }
    }
    return m;
  }, [activeComps]);

  // 比赛天数过滤的循环上限：取数据里实际最长持续天数，封顶 6（>6 天的比赛在 WCA 几乎不存在，
  // 避免脏 end_date 把循环拉长）。chip 单击在 1..cap 间循环。
  const maxDays = useMemo(() => {
    let m = 1;
    for (const c of activeComps) {
      const d = daysBetween(parseLocalDate(c.start_date), parseLocalDate(c.end_date || c.start_date)) + 1;
      if (d > m) m = d;
    }
    return Math.min(m, 6);
  }, [activeComps]);

  // RegionPicker 国家列表(出现过的 iso2,按 count desc),组件保留传入顺序
  const countryOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of activeComps) counts[c.country] = (counts[c.country] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([iso2]) => iso2);
  }, [activeComps]);

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

  // selectedCuber 变化 → 解析出他的未来比赛 ID 集合.
  // 静态索引(top_cubers + cn 报名)对单个选手往往不全:它只覆盖每场的头部选手 + 中国报名,
  // 一个中国选手报名的国际比赛可能不在里面(且 prod 的静态 JSON 还会滞后).所以静态命中先即时
  // 显示(无 spinner),再永远用 WCA API 兜底 union 补全他报名的其余比赛.
  useEffect(() => {
    if (!selectedCuber) { setSelectedCuberCompIds(null); return; }
    const staticHit = personCompIndex.get(selectedCuber.id);
    setSelectedCuberCompIds(staticHit && staticHit.size > 0 ? new Set(staticHit) : new Set());
    let cancelled = false;
    fetchUserUpcoming(selectedCuber.id).then((ids) => {
      if (cancelled || ids.length === 0) return;
      setSelectedCuberCompIds((prev) => {
        const next = new Set(prev ?? []);
        for (const id of ids) next.add(id);
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [selectedCuber, personCompIndex]);

  // 各国首秀 id 集合：activeComps 里每个国家 start_date 最早那场（同日取 id 最小，稳定）。
  // 仅开关打开时计算；用全量 activeComps 求"真正第一场",其他筛选(国家/项目/年月)再在其上叠加。
  const debutIds = useMemo(() => {
    if (!debutsOnly) return null;
    const first = new Map<string, Competition>();
    for (const c of activeComps) {
      const k = c.country.toUpperCase();
      const ex = first.get(k);
      if (!ex || c.start_date < ex.start_date || (c.start_date === ex.start_date && c.id < ex.id)) first.set(k, c);
    }
    const ids = new Set<string>();
    for (const c of first.values()) ids.add(c.id);
    return ids;
  }, [debutsOnly, activeComps]);

  // NOTE: 不匹配的比赛直接从日历中消失（不再"变淡"），所以 displayedComps 走完整过滤链
  const isMatch = useCallback(
    (comp: Competition) => {
      const compQRaw = compQuery.trim();
      if (compQRaw) {
        const cityZh = comp.city ? localizeCity(comp.city, true, comp.country) : '';
        const text = `${comp.name} ${comp.name_zh || ''} ${compNameZh(comp.name)} ${comp.city} ${comp.city_zh || ''} ${cityZh}`.toLowerCase();
        if (!compNameMatches(text, compQRaw)) return false;
      }
      if (selectedCuber && selectedCuberCompIds) {
        if (!selectedCuberCompIds.has(comp.id)) return false;
      }
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
      return true;
    },
    [compQuery, selectedCuber, selectedCuberCompIds, countryFilterSet, eventFilters, daysFilter, dateFrom, dateTo, cancelledFilter, cancelledCutoffIso, debutIds],
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
  }, [activeComps]);

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

  return (
    <div
      ref={pageRef}
      className={`calendar-page${viewMode === 'list' ? ' calendar-page--list' : ''}${viewMode === 'calendar' && calLayout === 'country' ? ' calendar-page--compact' : ''}${viewMode === 'globe' ? ' calendar-page--globe' : ''}`}
      data-wide-metric={viewMode === 'list' && WIDE_METRICS.has(eventMetric) ? '' : undefined}
      data-comp-2col={viewMode === 'list' && (compMetric === 'latlng' || compMetric === 'peopleLimit') ? '' : undefined}
      data-comp-peoplelimit={viewMode === 'list' && compMetric === 'peopleLimit' ? '' : undefined}
    >
      <header className="upcoming-header">
        <h1 className="upcoming-title">
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
        </h1>
        <div className="upcoming-meta">
          <Link href="/wca/comp/stats" className="globe-link">
            <BarChart3 size={12} strokeWidth={1.75} /> {tr({ zh: '统计', en: 'Stats'
            })}
          </Link>
        </div>
      </header>

      <div className="toolbar">
        <CompCuberPicker
          className="search-box-comp"
          query={compQuery}
          onQueryChange={setCompQuery}
          onUrlPaste={(id) => router.push(`/wca/comp/${id}`)}
          onPickComp={(c) => router.push(`/wca/comp/${c.id}`)}
          cuber={selectedCuber}
          onCuberChange={setSelectedCuber}
          staticCubers={staticCubers}
          cuberMatchCount={selectedCuber ? (selectedCuberCompIds?.size ?? null) : null}
          isZh={isZh}
          placeholder={tr({ zh: '搜比赛或选手', en: 'Search comps or cubers'
        })}
        />
        <RegionPicker
          className="country-filter"
          multi
          isZh={isZh}
          value={countryFilters}
          onChange={setCountryFilters}
          restrictTo={countryOptions}
          allLabel={t('upcoming.allCountries')}
        />
        <button
          type="button"
          className={`cancelled-toggle${cancelledFilter === 'only' ? ' is-active' : ''}`}
          onClick={() => setCancelledFilter((v) => (v === 'only' ? 'all' : 'only'))}
          aria-pressed={cancelledFilter === 'only'}
          title={tr({ zh: '只看已取消的比赛', en: 'Show only cancelled competitions'
        })}
        >
          <Ban size={14} strokeWidth={1.75} />
          <span>{tr({ zh: '已取消', en: 'Cancelled' })}</span>
        </button>
        <button
          type="button"
          className={`debuts-toggle${debutsOnly ? ' is-active' : ''}`}
          onClick={() => setDebutsOnly((v) => !v)}
          aria-pressed={debutsOnly}
          title={tr({ zh: '各国首秀：只显示每个国家有史以来的第一场 WCA 比赛（配合左侧国家筛选可锁定某国，日期列点「最早在前」按时间看各国登场）', en: 'Country debuts: show only each country’s first-ever WCA competition (pick a country at left to focus one; click the date header for oldest-first)' })}
        >
          <DebutIcon size={14} strokeWidth={1.75} />
          <span>{tr({ zh: '各国首秀', en: 'Debuts' })}</span>
        </button>
        {(viewMode === 'calendar' || viewMode === 'card') && (
          <div className="mode-toggle" role="tablist">
            <button
              role="tab"
              aria-selected={mode === 'all'}
              className={`mode-btn ${mode === 'all' ? 'is-active' : ''}`}
              onClick={() => setMode('all')}
            >
              <GlobeIcon size={14} strokeWidth={1.75} />
              <span>{t('upcoming.modeAll')}</span>
            </button>
            <button
              role="tab"
              aria-selected={mode === 'top'}
              className={`mode-btn ${mode === 'top' ? 'is-active' : ''}`}
              onClick={() => setMode('top')}
            >
              <Star size={14} strokeWidth={1.75} />
              <span>{t('upcoming.modeTop')}</span>
            </button>
          </div>
        )}
      </div>

      <div className="month-bar">
        <div className="view-toggle" role="tablist" aria-label={tr({ zh: '视图切换', en: 'View toggle'
        })}>
          <button
            role="tab"
            aria-selected={viewMode === 'calendar'}
            className={`view-btn ${viewMode === 'calendar' ? 'is-active' : ''}`}
            onClick={() => setViewMode('calendar')}
            aria-label={tr({ zh: '日历', en: 'Calendar'
            })}
            title={tr({ zh: '日历', en: 'Calendar'
            })}
          >
            <CalendarDays size={16} strokeWidth={1.75} />
          </button>
          <button
            role="tab"
            aria-selected={viewMode === 'card'}
            className={`view-btn ${viewMode === 'card' ? 'is-active' : ''}`}
            onClick={() => setViewMode('card')}
            aria-label={tr({ zh: '卡片', en: 'Cards' })}
            title={tr({ zh: '卡片', en: 'Cards' })}
          >
            <LayoutGrid size={16} strokeWidth={1.75} />
          </button>
          <button
            role="tab"
            aria-selected={viewMode === 'list'}
            className={`view-btn ${viewMode === 'list' ? 'is-active' : ''}`}
            onClick={() => { setViewMode('list'); setMode('all'); }}
            aria-label={tr({ zh: '列表', en: 'List' })}
            title={tr({ zh: '列表', en: 'List' })}
          >
            <List size={16} strokeWidth={1.75} />
          </button>
          <button
            role="tab"
            aria-selected={viewMode === 'globe'}
            className={`view-btn ${viewMode === 'globe' ? 'is-active' : ''}`}
            onClick={() => setViewMode('globe')}
            aria-label={tr({ zh: '地球', en: 'Globe' })}
            title={tr({ zh: '地球', en: 'Globe' })}
          >
            <GlobeIcon size={16} strokeWidth={1.75} />
          </button>
        </div>
        {viewMode === 'calendar' && (
          <PillToggle
            className="cal-layout-toggle"
            value={calLayout === 'country'}
            onChange={(v) => setCalLayout(v ? 'country' : 'comp')}
            offLabel={tr({ zh: '比赛', en: 'Comps' })}
            onLabel={tr({ zh: '国家', en: 'Countries' })}
            ariaLabel={tr({ zh: '日历布局:按比赛或按国家', en: 'Calendar layout: by competition or by country' })}
          />
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
              {(isZh
                                          ? `共 ${displayedComps.length.toLocaleString()} 场`
                                          : `${displayedComps.length.toLocaleString()} comps`)}
            </span>
            <select
              className="list-metric-select"
              value={compMetric}
              onChange={(e) => setCompMetric(e.target.value as CompMetric)}
              aria-label={tr({ zh: '整场列显示', en: 'Whole-comp column'
            })}
              title={tr({ zh: '整场列显示什么（人数和上限 / 满员率 / 名称长度 / 城市名长度 / 纬度 / 经度），点列头可排序', en: 'What the whole-comp column shows (people & limit / fill rate / name length / city length / latitude / longitude); click header to sort'
            })}
            >
              <option value="peopleLimit">{tr({ zh: '人数和上限', en: 'People & limit'
            })}</option>
              <option value="ratio">{tr({ zh: '满员率', en: 'Fill rate'
            })}</option>
              <option value="nameLength">{tr({ zh: '名称长度', en: 'Name length'
            })}</option>
              <option value="cityLength">{tr({ zh: '城市名长度', en: 'City name length'
            })}</option>
              <option value="latlng">{tr({ zh: '经纬度', en: 'Coordinates'
            })}</option>
            </select>
            <select
              className="list-metric-select"
              value={eventMetric}
              onChange={(e) => setEventMetric(e.target.value as EventMetric)}
              aria-label={tr({ zh: '项目格子显示', en: 'Per-event cell' })}
              title={tr({ zh: '每个项目格子显示什么（限时 / 及格 / 晋级 / 资格仅未来比赛有）', en: 'What each event cell shows (time limit / cutoff / advancement / qualification: upcoming only)' })}
            >
              <option value="rounds">{tr({ zh: '轮次', en: 'Rounds' })}</option>
              <option value="regs">{tr({ zh: '人数', en: 'Entries' })}</option>
              <option value="timeLimit">{tr({ zh: '限时', en: 'Time limit' })}</option>
              <option value="cutoff">{tr({ zh: '及格线', en: 'Cutoff' })}</option>
              <option value="advancement">{tr({ zh: '晋级', en: 'Advance' })}</option>
              <option value="qualification">{tr({ zh: '参赛资格', en: 'Qualify' })}</option>
            </select>
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
            const cur = eventFilters[eid];
            const active = cur !== undefined;
            const max = maxRoundsByEid[eid] ?? 0;
            const badge = typeof cur === 'number' ? String(cur) : '';
            const cycle = () => setEventFilters((prev) => {
              const next = { ...prev };
              const c = prev[eid];
              if (c === undefined) {
                next[eid] = 'any';
              } else if (c === 'any') {
                if (max >= 1) next[eid] = 1;
                else delete next[eid]; // 此项目无任何 rounds 数据 → 直接关
              } else {
                const n = c + 1;
                if (n <= max) next[eid] = n as 1 | 2 | 3 | 4;
                else delete next[eid];
              }
              return next;
            });
            const cycleHint = max >= 1
              ? ((isZh ? `点击切换：关 → max → 1 → ... → ${max} → 关` : `Click to cycle: off → max → 1 → ... → ${max} → off`))
              : tr({ zh: '点击切换：关 → max → 关', en: 'Click to cycle: off → max → off'
                            });
            return (
              <button
                key={eid}
                className={`event-chip ${active ? 'is-active' : ''}`}
                onClick={cycle}
                aria-pressed={active}
                title={cycleHint}
              >
                <CubingIcon icon={`event-${eid}`} />
                <span className={`event-chip-rounds${badge === '' ? ' is-empty' : ''}`}>
                  {badge}
                </span>
              </button>
            );
          });
          // 列表模式：用 grid 把表头对齐到下方各列（年份 cell + flag/name 两个 spacer + 天数列头 + 21 chip）。
          if (viewMode !== 'list' || displayedComps.length === 0) return <>{daysChip}{chips}</>;
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
                    {regOn && (listSort?.dir === 'desc'
                      ? <ChevronDown size={11} strokeWidth={2.25} />
                      : <ChevronUp size={11} strokeWidth={2.25} />)}
                  </button>
                );
              })()}
              {(() => {
                // 日期列头：点击在「默认最新在前」与「最早在前」之间切换。
                // 选某国家 + 切到「最早在前」→ 顶部即该国首场比赛。
                const dateActive = listSort?.col === 'date';
                const DateChevron = dateActive && listSort?.dir === 'asc' ? ChevronUp : ChevronDown;
                return (
                  <button
                    type="button"
                    className={`cl-year-cell cl-year-sort${dateActive ? ' is-active' : ''}`}
                    aria-live="polite"
                    aria-pressed={dateActive}
                    title={tr({ zh: '按日期排序（默认最新在前，点击切到最早在前）', en: 'Sort by date (newest first; click for oldest first)' })}
                    onClick={() => setListSort((s) => (s?.col === 'date' && s.dir === 'asc' ? null : { col: 'date', dir: 'asc' }))}
                  >
                    <DateChevron className="cl-date-chevron" size={12} strokeWidth={2.25} />
                    {currentYear && <span className="cl-year-num">{currentYear.year}</span>}
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
                      {on && (listSort?.dir === 'desc'
                        ? <ChevronDown size={11} strokeWidth={2.25} />
                        : <ChevronUp size={11} strokeWidth={2.25} />)}
                      <Icon size={15} strokeWidth={1.75} />
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
                      {on && (listSort?.dir === 'desc'
                        ? <ChevronDown size={11} strokeWidth={2.25} />
                        : <ChevronUp size={11} strokeWidth={2.25} />)}
                      <Icon size={15} strokeWidth={1.75} />
                    </button>
                  );
                })
              ) : (() => {
                const CompIcon = compMetric === 'nameLength' ? CaseSensitive : compMetric === 'cityLength' ? MapPin : Percent;
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
                    {on && (listSort?.dir === 'desc'
                      ? <ChevronDown size={11} strokeWidth={2.25} />
                      : <ChevronUp size={11} strokeWidth={2.25} />)}
                    <CompIcon size={15} strokeWidth={1.75} />
                  </button>
                );
              })()}
              {chips}
            </div>
          );
        })()}
      </div>

      {allLoading && mode === 'all' && (
        <div className="mode-status">{t('upcoming.allLoading')}</div>
      )}
      {allError && mode === 'all' && (
        <div className="mode-status is-error">{allError}</div>
      )}


      {viewMode === 'list' && (
        <CompList
          comps={displayedComps}
          isZh={isZh}
          onSelect={setSelectedComp}
          onYearChange={setCurrentYear}
          compMetric={compMetric}
          listSort={listSort}
          eventMetric={eventMetric}
          pastMeta={pastMeta}
          outerRef={listScrollRef}
          cancelledCutoffIso={cancelledCutoffIso}
          pageRef={pageRef}
          followedIds={follows}
        />
      )}

      {viewMode === 'card' && (
        <div className="comp-card-view">
          {cardComps.length === 0 ? (
            <div className="comp-card-empty">{tr({ zh: '本月没有比赛', en: 'No competitions this month' })}</div>
          ) : (
            <div className="reg-cards">
              {cardComps.map((c) => {
                // 已过比赛即便没有报名字段也补「报名已截止」灰胶囊,避免卡片裸着没胶囊(与首页报名卡片视觉一致)。
                const startPast = parseLocalDate(c.start_date) < cardTodayStart;
                const reg = regMilestone(c.registration_open, c.registration_close, c.event_change_deadline, undefined)
                  ?? (startPast ? { when: '', word: tr({ zh: '报名已截止', en: 'Closed' }), tone: 'closed' as const } : null);
                return (
                  <CompCard
                    key={c.id}
                    comp={c}
                    isZh={isZh}
                    lang={isZh ? 'zh' : 'en'}
                    pill={reg ? { when: reg.when, word: reg.word, tone: reg.tone } : null}
                    dimmed={isCancelledComp(c, cancelledCutoffIso)}
                    follow={{ followed: follows.has(c.id), onToggle: toggleFollow, loggedIn: followLoggedIn, onRequireLogin: login }}
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
                  const displayName = localizeNameNoYear(bar.comp, isZh);
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
                        : `${localizeNameNoYear(c, isZh)} — ${c.top_cubers.length} cubers`;
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
            <h2 className="modal-title">
              {dayListCountry && (
                <Flag iso2={dayListCountry} />
              )}
              <span>{toIsoDate(dayListDate)}</span>
              {dayListCountry && (
                <span className="day-list-country-name">{countryName(dayListCountry, isZh)}</span>
              )}
            </h2>
            <div className="day-list">
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
                  const displayName = localizeNameNoYear(c, isZh);
                  const top = getCompRecordTop(c.id);
                  const cancelled = isCancelledComp(c, cancelledCutoffIso);
                  const prefetchRounds = c.rounds ? undefined : () => { void fetchCompRounds(c.id); };
                  return (
                    <button
                      key={c.id}
                      className={`day-list-item${cancelled ? ' is-cancelled' : ''}`}
                      onClick={() => { setSelectedComp(c); setDayListDate(null); setDayListCountry(null); }}
                      onMouseEnter={prefetchRounds}
                      onFocus={prefetchRounds}
                    >
                      {top && <RecordBadge record={top} />}
                      <Flag iso2={c.country} />
                      {follows.has(c.id) && <FollowMark />}
                      <span className="day-list-item-name">{displayName}</span>
                      <span className="day-list-count">{c.top_cubers.length}</span>
                    </button>
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

      {(viewMode === 'calendar' || viewMode === 'card') && (
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

      {recent.length > 0 && (
        <div className="comp-recent comp-recent-calendar">
          <h2 className="comp-recent-title">{tr({ zh: '最近浏览', en: 'Recent'
        })}</h2>
          <ul className="comp-recent-list">
            {recent.map(r => {
              const iso2 = compFlagIso2(r.slug) || r.iso2 || '';
              const display = localizeCompName(r.slug, decodeEntities(r.name), isZh, { explicitNameZh: r.nameZh });
              return (
                <li key={r.slug} className="comp-recent-item">
                  <Link
                    {...compLinkProps(r.slug)}
                    className="comp-recent-link"
                  >
                    <span className="comp-recent-name">
                      {iso2 && <SharedFlag iso2={iso2} className="comp-flag" />}
                      <span>{display}</span>
                    </span>
                    <span className="comp-recent-slug">{r.slug}</span>
                  </Link>
                  <button
                    type="button"
                    className="comp-recent-remove"
                    onClick={() => removeRecent(r.slug)}
                    aria-label="Remove"
                    title={tr({ zh: '移除', en: 'Remove' })}
                  >
                    <XIcon size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="calendar-page"><div className="calendar-loading">Loading…</div></div>}>
      <CalendarPageInner />
    </Suspense>
  );
}
