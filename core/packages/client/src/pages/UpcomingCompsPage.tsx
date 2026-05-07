/**
 * 顶尖选手近期比赛追踪页 — 日历视图
 * 数据源: stats/upcoming_comps.json（Top 模式） + stats/all_upcoming_comps.json（All 模式）
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Star, Earth as GlobeIcon, List, BarChart3, CalendarDays, Ban, LayoutGrid } from 'lucide-react';
import { getLangQuery } from '../i18n';
import {
  fetchAllUpcomingCompsJson,
  fetchAllPastCompsJson,
  type UpcomingCompRecord,
  type PastCompRecord,
} from '@cuberoot/shared';
import LangToggle from '../components/LangToggle';
import { displayCuberName } from '../utils/name_utils';
import { formatDateRangeIso, toIsoDate } from '../utils/date_range';
import { Flag as SharedFlag } from '../utils/flag';
import { WheelPicker } from '../components/WheelPicker';
import { RecordBadge } from '../components/RecordBadge';
import { CountryInput } from '../components/CountryInput';
import {
  loadCompRecordsSummary,
  loadCompRecordsDetail,
  getCompRecordTop,
  getCompRecordEntries,
  type RecordEntry,
} from '../utils/comp_records';
import { formatWcaResult } from '../utils/wca_format_result';
import { loadFlagData, personFlagIso2, compNameZh, countryToIso2 } from '../utils/country_flags';
import { stripWcaPrefix } from '../utils/comp_localize';
import { localizeCity } from '../utils/city_localize';
import { countryName } from '../utils/country_name';
import { expandCountrySelection } from '../utils/continent';
import { fetchCompRounds } from '../utils/comp_wcif';
import { CuberSearchInput } from '../components/CuberSearchInput';
import { ClearButton } from '../components/ClearButton';
import { fetchUserUpcoming, type WcaPersonLite } from '../utils/wca_api';
import OnThisDayModal from './calendar/OnThisDayModal';
import './upcoming_comps.css';

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
  competitor_limit: number;
  registration_open?: string | null;   // ISO 8601 UTC
  registration_close?: string | null;
  cubing_china_url?: string;
  top_cubers: TopCuber[];
}

interface UpcomingData {
  competitions: Competition[];
}

// ── 常量 ──────────────────────────────────────────────────────────────────

const SOON_DAYS = 7;
const MAX_TRACKS = 3;
// 启发式：past comp 结束 60+ 天仍 0 results ⇒ 实际没办成 ⇒ 视为已取消。
// 60 天 buffer 是为了避免最近结束、results 还没传到 WCA dump 里的真比赛被误标。
const CANCELLED_BUFFER_DAYS = 60;

/** 给定 cutoff（today - buffer 的 ISO 日期），判断比赛是否应被显示为已取消 */
function isCancelledComp(c: { end_date?: string; start_date: string; events?: string[] }, cutoffIso: string): boolean {
  const endIso = c.end_date || c.start_date;
  return !!endIso && endIso < cutoffIso && (c.events ?? []).length === 0;
}

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

// 列表视图与 chip 过滤共用的项目顺序（WCA 标准 17 项 + 4 个已停办老项目：333ft 用脚拧、333mbo 旧多盲、magic、mmagic）
const EVENT_ORDER = ['333', '222', '444', '555', '666', '777', '333bf', '333fm', '333oh', 'clock', 'minx', 'pyram', 'skewb', 'sq1', '444bf', '555bf', '333mbf', '333ft', '333mbo', 'magic', 'mmagic'] as const;

const WEEKDAY_EN = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const WEEKDAY_ZH = ['一','二','三','四','五','六','日'];

// ── 工具函数 ──────────────────────────────────────────────────────────────

/** 两个日期是否同一天（忽略时间） */
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

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

// NOTE: TW 特判和 flag-icons 类名统一在 utils/flag.tsx；这里只是个 span/img className 绑定的 thin wrapper
// 中文模式下比赛名本地化: upcoming JSON 的 name_zh（追踪选手近期赛）→ comp_names_zh.json 的英→中映射 → 兜底英文
function localizeName(c: { name: string; name_zh?: string }, isZh: boolean): string {
  const resolved = !isZh ? c.name : (c.name_zh || compNameZh(c.name) || c.name);
  return stripWcaPrefix(resolved);
}

/** 报名时段渲染：未到 → "X 开放报名"；进行中 → "报名中（X 截止）"；已截止 → "报名已截止"。
 *  ISO 转用户本地时区。两个字段都没有时返回 null。 */
function formatRegStatus(open: string | null | undefined, close: string | null | undefined, isZh: boolean): string | null {
  if (!open && !close) return null;
  const now = Date.now();
  const fmt = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${Y}-${M}-${D} ${h}:${m}`;
  };
  const openMs = open ? new Date(open).getTime() : null;
  const closeMs = close ? new Date(close).getTime() : null;
  if (openMs !== null && now < openMs) {
    return isZh ? `${fmt(open!)} 开放报名` : `Registration opens ${fmt(open!)}`;
  }
  if (closeMs !== null && now >= closeMs) {
    return isZh ? '报名已截止' : 'Registration closed';
  }
  if (closeMs !== null) {
    return isZh ? `${fmt(close!)} 截止` : `Closes ${fmt(close!)}`;
  }
  return isZh ? '报名中' : 'Registration open';
}

function Flag({ iso2 }: { iso2: string }) {
  return <SharedFlag iso2={iso2} spanClassName="flag-span" imgClassName="flag-img" />;
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

function CompModal({ comp, isZh, onClose, t, cancelled }: {
  comp: Competition;
  isZh: boolean;
  onClose: () => void;
  t: (k: string, o?: Record<string, unknown>) => string;
  cancelled: boolean;
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

  const displayName = localizeName(comp, isZh);
  const displayCity = isZh ? (comp.city_zh || localizeCity(comp.city, true)) : comp.city;
  const displayCountry = countryName(comp.country, isZh);
  const compUrl = comp.cubing_china_url || `https://www.worldcubeassociation.org/competitions/${comp.id}`;

  const dateStr = formatDateRangeIso(comp.start_date, comp.end_date || comp.start_date);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-panel${cancelled ? ' is-cancelled' : ''}`} onClick={(ev) => ev.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <h2 className="modal-title">
          <a href={compUrl} target="_blank" rel="noopener noreferrer">
            <Flag iso2={comp.country} />
            <span className={cancelled ? 'modal-title-name is-cancelled' : 'modal-title-name'}>{displayName}</span>
          </a>
          {cancelled && <span className="modal-cancelled-tag">{isZh ? '已取消' : 'Cancelled'}</span>}
        </h2>
        <div className="modal-meta">
          {dateStr} · {displayCity}{isZh ? '，' : ', '}{displayCountry}
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
                  <span className={`cubing-icon event-${eid}`} />
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
                  <span className={`cubing-icon event-${r.e}`} />
                  <span className="record-kind">{r.k === 's' ? t('upcoming.single') : t('upcoming.average')}</span>
                  <span className="record-value mono">{formatWcaResult(r.v, r.e, r.k === 's' ? 'single' : 'average')}</span>
                  <a
                    href={`https://www.worldcubeassociation.org/persons/${r.p}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="record-person"
                  >
                    <SharedFlag iso2={personFlagIso2(r.p)} />
                    <span>{displayCuberName(r.n, isZh)}</span>
                  </a>
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
                <a
                  key={c.id}
                  href={`https://www.worldcubeassociation.org/persons/${c.id}`}
                  className="cuber-tag"
                  target="_blank"
                  rel="noopener noreferrer"
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
                          <span
                            key={evt.id}
                            className={`cubing-icon event-${eid}${wrClass}`}
                            title={wrTitle || undefined}
                          />
                        );
                      })}
                    </span>
                  )}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 年月选择浮层 ──────────────────────────────────────────────────────────

function YearMonthPickerPopover({ year, month, yearMonthsMap, anchor, onCommit, isZh }: {
  year: number;
  month: number; // 1..12
  /** 年 → 该年有比赛的月份集；滚筒按此表跳过空年/空月 */
  yearMonthsMap: Map<number, Set<number>>;
  anchor: DOMRect | null;
  /** 关闭浮层时一次性提交 pending 值 + 关闭；拖拽中不调用 */
  onCommit: (y: number, m: number) => void;
  isZh: boolean;
}) {
  const validYears = useMemo(
    () => [...yearMonthsMap.keys()].sort((a, b) => a - b),
    [yearMonthsMap],
  );

  // NOTE: pending 本地态 — 拖拽只改本地，关闭浮层才 flush 给父
  // 用索引存储：WheelPicker 连续整数步进，非连续真实年/月从对应数组反查
  // 若 viewDate 的年不在 validYears（例如 Top 模式未加载数据、或打开到纯空年），fall back 到最近年
  const [pendingYIdx, setPendingYIdx] = useState(() => {
    const exact = validYears.indexOf(year);
    if (exact >= 0) return exact;
    if (validYears.length === 0) return 0;
    let bestIdx = 0;
    for (let i = 1; i < validYears.length; i++) {
      if (Math.abs(validYears[i] - year) < Math.abs(validYears[bestIdx] - year)) bestIdx = i;
    }
    return bestIdx;
  });
  const [pendingM, setPendingM] = useState(month);

  const currentYear = validYears[pendingYIdx] ?? year;

  const validMonths = useMemo(() => {
    const set = yearMonthsMap.get(currentYear);
    if (!set || set.size === 0) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    return [...set].sort((a, b) => a - b);
  }, [yearMonthsMap, currentYear]);

  // NOTE: 当 validMonths 变化（切年）若 pendingM 越界，snap 到最近的合法月份
  useEffect(() => {
    if (validMonths.includes(pendingM)) return;
    let closest = validMonths[0];
    for (const m of validMonths) {
      if (Math.abs(m - pendingM) < Math.abs(closest - pendingM)) closest = m;
    }
    setPendingM(closest);
  }, [validMonths, pendingM]);

  const pendingMIdx = Math.max(0, validMonths.indexOf(pendingM));

  const yearRenderSlot = useCallback(
    (i: number) => (i >= 0 && i < validYears.length) ? String(validYears[i]) : '',
    [validYears],
  );
  const monthRenderSlot = useCallback(
    (i: number) => (i >= 0 && i < validMonths.length) ? String(validMonths[i]).padStart(2, '0') : '',
    [validMonths],
  );
  const monthOnChange = useCallback(
    (i: number) => setPendingM(validMonths[i] ?? pendingM),
    [validMonths, pendingM],
  );

  const pendingRef = useRef({ yIdx: pendingYIdx, mIdx: pendingMIdx });
  pendingRef.current = { yIdx: pendingYIdx, mIdx: pendingMIdx };

  const commit = useCallback(() => {
    const y = validYears[pendingRef.current.yIdx] ?? year;
    const monthsForY = yearMonthsMap.get(y);
    const months = monthsForY && monthsForY.size > 0
      ? [...monthsForY].sort((a, b) => a - b)
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const m = months[pendingRef.current.mIdx] ?? months[0] ?? month;
    onCommit(y, m);
  }, [validYears, yearMonthsMap, year, month, onCommit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') commit(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commit]);

  // NOTE: 根据按钮位置定位面板；贴在按钮下方偏右 8px，越界时夹到视口内
  const panelStyle: React.CSSProperties = anchor
    ? (() => {
        const W = 220, H = 280;
        const top = Math.min(anchor.bottom + 6, window.innerHeight - H - 8);
        const left = Math.max(8, Math.min(anchor.left, window.innerWidth - W - 8));
        return { top, left };
      })()
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <div className="ym-popover-overlay" onClick={commit}>
      <div className="ym-popover-panel" style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <WheelPicker
          value={pendingYIdx}
          minValue={0}
          maxValue={Math.max(0, validYears.length - 1)}
          renderSlot={yearRenderSlot}
          onChange={setPendingYIdx}
          width={96}
          ariaLabel={isZh ? '年' : 'Year'}
        />
        <WheelPicker
          value={pendingMIdx}
          minValue={0}
          maxValue={Math.max(0, validMonths.length - 1)}
          renderSlot={monthRenderSlot}
          onChange={monthOnChange}
          width={80}
          ariaLabel={isZh ? '月' : 'Month'}
        />
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
    competitor_limit: w.competitor_limit,
    registration_open: w.registration_open ?? undefined,
    registration_close: w.registration_close ?? undefined,
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
    competitor_limit: 0,
    top_cubers: [],
  };
}

// ── URL 月份深链 ──────────────────────────────────────────────────────────

/** 校验 YYYY-MM 字符串（年 1900-2099，月 01-12）。空串 / 不合规 → false（不参与过滤） */
function validYM(s: string): boolean {
  return /^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(s);
}

function readMonthFromUrl(): Date | null {
  const p = new URLSearchParams(window.location.search);
  const y = Number(p.get('year'));
  const m = Number(p.get('month'));
  if (!y || !m || m < 1 || m > 12) return null;
  return new Date(y, m - 1, 1);
}

// ── 列表视图 ──────────────────────────────────────────────────────────────
// 不分月，按 start_date 倒序排列、按年分组；点行同样打开 CompModal。
// 数据量可达 ~17k —— 用 fixed-height 虚拟滚动只渲染视口内 ~30 行，无上限。
// 行高统一 44px（年标题与比赛行同高）以便 O(1) 计算可见区间。

const LIST_ROW_H = 44;
const LIST_BUFFER = 8; // 视口外多渲染几行做缓冲，避免快速滚动时露白

// 列表 name+city 列宽 cap (px)：上限防极端长名撑爆行；下限保证短名筛选时不至于挤成一团
const LIST_NAME_CELL_MIN_PX = 10 * 16;
const LIST_NAME_CELL_MAX_PX = 40 * 16;
const LIST_NAME_CELL_PAD_PX = 8; // 测得最长后再加一点缓冲，防 ellipsis 误切

/** 用 canvas.measureText 测当前可视行 name+city 最长那行的实际像素宽,
 *  这样 grid 列宽既能贴最长一行,又让短名筛选场景下空白几乎消失。
 *  另用 containerPx 算视口可用宽度上限——避免 cell 撑爆容器引起 chips header 横向溢出。
 *  O(n)，~30 行可视 ≈ 1ms。 */
function measureMaxNameCityPx(comps: Competition[], isZh: boolean, containerPx?: number): number {
  if (typeof document === 'undefined' || comps.length === 0) return 28 * 16;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return 28 * 16;
  const rootFontPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const bodyFont = getComputedStyle(document.body).fontFamily || 'sans-serif';
  const namePx = 0.85 * rootFontPx;
  const cityPx = 0.78 * rootFontPx;
  const gapPx = 0.5 * rootFontPx;
  ctx.font = `500 ${namePx}px ${bodyFont}`;
  const nameWs: number[] = new Array(comps.length);
  for (let i = 0; i < comps.length; i++) {
    nameWs[i] = ctx.measureText(localizeName(comps[i], isZh)).width;
  }
  ctx.font = `400 ${cityPx}px ${bodyFont}`;
  let maxTotal = 0;
  for (let i = 0; i < comps.length; i++) {
    const c = comps[i];
    const cityStr = isZh ? (c.city_zh || localizeCity(c.city, true)) : c.city;
    const total = nameWs[i] + gapPx + ctx.measureText(cityStr).width;
    if (total > maxTotal) maxTotal = total;
  }
  // 视口上限: container 减掉其他列总宽（date + flag + 21 events + gaps + padding）
  // 其他列在 768px 以上 = 7.2 + 1.4 + 21*1.3 = 36rem，加 23 列 6px gap + 12px*2 padding 约 162px
  let cap = LIST_NAME_CELL_MAX_PX;
  if (containerPx != null && containerPx > 0) {
    const isNarrow = window.innerWidth <= 768;
    const otherColsRem = isNarrow ? (5.5 + 1.2 + 21 * 1.1) : (7.2 + 1.4 + 21 * 1.3);
    const gapPaddingPx = isNarrow ? (4 * 23 + 8 * 2) : (6 * 23 + 12 * 2);
    const avail = containerPx - otherColsRem * rootFontPx - gapPaddingPx;
    cap = Math.min(cap, Math.max(LIST_NAME_CELL_MIN_PX, avail));
  }
  return Math.max(LIST_NAME_CELL_MIN_PX, Math.min(cap, maxTotal + LIST_NAME_CELL_PAD_PX));
}

interface RowItem { comp: Competition; key: string }

function CompList({ comps, isZh, onSelect, onYearChange, outerRef, cancelledCutoffIso, pageRef }: {
  comps: Competition[];
  isZh: boolean;
  onSelect: (c: Competition) => void;
  /** 当前可见区域所在年份（用于在 chip 行 sticky 显示）；可见为空时传 null */
  onYearChange: (info: { year: string; count: number } | null) => void;
  /** 横向滚动容器 — 父组件用它和 chip 表头同步 scrollLeft */
  outerRef?: React.Ref<HTMLDivElement>;
  /** 已取消比赛的 end_date 阈值（ISO 字符串） */
  cancelledCutoffIso: string;
  /** .upcoming-page 根元素 ref —— 用来按当前可视行最长 name+city 写 --cl-name-width */
  pageRef: React.RefObject<HTMLDivElement | null>;
}) {
  // 倒序排列；不再插入"年份分隔"行，年份显示在 chip 行的左侧 sticky cell 里
  const items = useMemo<RowItem[]>(
    () => [...comps]
      .sort((a, b) => b.start_date.localeCompare(a.start_date))
      .map((c) => ({ comp: c, key: c.id })),
    [comps],
  );
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
  useEffect(() => {
    if (items.length === 0) { onYearChange(null); return; }
    const idx = Math.min(range.top, items.length - 1);
    const year = items[idx].comp.start_date.slice(0, 4);
    onYearChange({ year, count: yearCounts.get(year) ?? 0 });
  }, [range.top, items, yearCounts, onYearChange]);

  // 视口自适应 name+city 列宽：测当前渲染窗口（含 LIST_BUFFER 缓冲）max name+city，写到
  // .upcoming-page 的 --cl-name-width。滚动到长名行时 cell 扩、滚出再收，
  // chips 表头跟着同步。LIST_BUFFER=8 让长名进视口前几行就提前测到，平滑视觉抖动。
  // 视口可用宽度作为 cap，避免 cell 撑爆 .upcoming-page 引起 chips header 横向溢出。
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const visibleComps = items.slice(range.start, range.end).map((it) => it.comp);
    const px = measureMaxNameCityPx(visibleComps, isZh, el.clientWidth);
    el.style.setProperty('--cl-name-width', `${px}px`);
  }, [range.start, range.end, items, isZh, pageRef]);

  // 卸载时清理 — 切回日历模式不留 stale --cl-name-width
  useEffect(() => () => { pageRef.current?.style.removeProperty('--cl-name-width'); }, [pageRef]);

  if (items.length === 0) {
    return <div className="comp-list-empty">{isZh ? '没有匹配的比赛' : 'No competitions match'}</div>;
  }

  const visible = items.slice(range.start, range.end);

  return (
    <div className="comp-list" ref={outerRef}>
      <div ref={containerRef} className="comp-list-virtual" style={{ height: totalH }}>
        {visible.map((it, i) => {
          const idx = range.start + i;
          const top = idx * LIST_ROW_H;
          const c = it.comp;
          const endDate = c.end_date || c.start_date;
          const dateStr = formatDateRangeIso(c.start_date, endDate);
          // 跨年(2026-12-31~2027-01-03)在列表 date 列(7.2rem mono)放不下,强制在 ~ 后换行;
          // 每半行加 nowrap 防止 - 处再被切开
          const crossYear = c.start_date.slice(0, 4) !== endDate.slice(0, 4);
          const displayName = localizeName(c, isZh);
          const displayCity = isZh ? (c.city_zh || localizeCity(c.city, true)) : c.city;
          const prefetch = c.rounds ? undefined : () => { void fetchCompRounds(c.id); };
          const events = c.events ?? [];
          const cancelled = isCancelledComp(c, cancelledCutoffIso);
          return (
            <button
              key={it.key}
              className={`comp-list-row${cancelled ? ' is-cancelled' : ''}`}
              style={{ top, height: LIST_ROW_H }}
              onClick={() => onSelect(c)}
              onMouseEnter={prefetch}
              onFocus={prefetch}
            >
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
                <span className="comp-list-name">{displayName}</span>
                <span className="comp-list-city">{displayCity}</span>
              </span>
              {EVENT_ORDER.map((eid) => {
                const shortEid = WCA_EVENT_ID_TO_SHORT[eid] ?? eid;
                const r = c.rounds?.[shortEid];
                const has = events.includes(shortEid);
                return (
                  <span key={eid} className="cl-event-cell">
                    {r != null ? r : (has ? '·' : '')}
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

export default function UpcomingCompsPage() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  const [data, setData] = useState<UpcomingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compQuery, setCompQuery] = useState('');
  // 选手筛选: 静态层(top_cubers + cn_upcoming_registrations) 优先,API 兜底
  const [selectedCuber, setSelectedCuber] = useState<WcaPersonLite | null>(null);
  const [selectedCuberCompIds, setSelectedCuberCompIds] = useState<Set<string> | null>(null);
  const [cnRegistrations, setCnRegistrations] = useState<Record<string, string[]> | null>(null);
  const [countryFilters, setCountryFilters] = useState<string[]>([]);
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
  const [viewMode, setViewMode] = useState<'calendar' | 'compact' | 'list'>('calendar');
  // 列表视图下的年月范围过滤（YYYY-MM 字符串；不合规或空 = 不参与过滤）
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // 列表 sticky 年份（chip 行左侧 cell 显示）；CompList 滚动时回调更新
  const [currentYear, setCurrentYear] = useState<{ year: string; count: number } | null>(null);
  // 已取消过滤：'all' = 默认包含；'only' = 仅展示已取消
  const [cancelledFilter, setCancelledFilter] = useState<'all' | 'only'>('all');
  // 三个 popover 共用一份 state：'month' = 日历模式月份选择；'from'/'to' = 列表模式年月范围
  const [pickerOpen, setPickerOpen] = useState<'month' | 'from' | 'to' | null>(null);
  const monthBtnRef = useRef<HTMLButtonElement>(null);
  const fromBtnRef = useRef<HTMLButtonElement>(null);
  const toBtnRef = useRef<HTMLButtonElement>(null);
  // chip 表头 + 列表外层 — 用来同步横向 scrollLeft（移动端两者各自横向滚动，需要联动）
  const chipsHeaderRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const [recordsVer, setRecordsVer] = useState(0);

  // 已取消判定 cutoff：今天 - 60 天的 ISO 字符串。今日固定一次（每次 mount 重算），mount 期间不变。
  const cancelledCutoffIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - CANCELLED_BUFFER_DAYS);
    return d.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    loadCompRecordsSummary().then((v) => setRecordsVer(v));
    // NOTE: loadFlagData 加载 comp_names_zh.json，完成后触发重渲染以应用中文名
    loadFlagData().then((v) => setRecordsVer(v));
    // NOTE: cubing.com 中国比赛全员注册 (WCA API 不覆盖) — 失败/无文件时静默置空,前端走 API 兜底
    fetch('/stats/cn_upcoming_registrations.json')
      .then((r) => (r.ok ? r.json() : {}))
      .then((j: Record<string, string[]>) => setCnRegistrations(j))
      .catch(() => setCnRegistrations({}));
  }, []);

  // NOTE: viewDate 变化时同步 URL（?year= ?month=），方便复制分享当前月份链接
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    p.set('year', String(viewDate.getFullYear()));
    p.set('month', String(viewDate.getMonth() + 1));
    const newUrl = `${window.location.pathname}?${p.toString()}${window.location.hash}`;
    window.history.replaceState(null, '', newUrl);
  }, [viewDate]);

  useEffect(() => {
    fetch('/stats/upcoming_comps.json')
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

  const countryOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of activeComps) counts[c.country] = (counts[c.country] || 0) + 1;
    // NOTE: 按 count 降序排列的 iso2 列表 + counts 映射，供 CountryInput 使用
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([iso2]) => iso2);
    return { sorted, counts };
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

  // selectedCuber 变化 → 解析出他的未来比赛 ID 集合 (静态优先,miss 走 API)
  useEffect(() => {
    if (!selectedCuber) { setSelectedCuberCompIds(null); return; }
    const staticHit = personCompIndex.get(selectedCuber.id);
    if (staticHit && staticHit.size > 0) {
      setSelectedCuberCompIds(staticHit);
      return;
    }
    // miss → API
    let cancelled = false;
    setSelectedCuberCompIds(new Set());  // 暂时空集合 = 没命中,过滤掉所有
    fetchUserUpcoming(selectedCuber.id).then((ids) => {
      if (cancelled) return;
      setSelectedCuberCompIds(new Set(ids));
    });
    return () => { cancelled = true; };
  }, [selectedCuber, personCompIndex]);

  // NOTE: 不匹配的比赛直接从日历中消失（不再"变淡"），所以 displayedComps 走完整过滤链
  const isMatch = useCallback(
    (comp: Competition) => {
      const compQ = compQuery.toLowerCase().trim();
      if (compQ) {
        const cityZh = comp.city ? localizeCity(comp.city, true) : '';
        const text = `${comp.name} ${comp.name_zh || ''} ${compNameZh(comp.name)} ${comp.city} ${comp.city_zh || ''} ${cityZh}`.toLowerCase();
        if (!text.includes(compQ)) return false;
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
      if (validYM(dateFrom) || validYM(dateTo)) {
        const ym = comp.start_date.slice(0, 7);
        if (validYM(dateFrom) && ym < dateFrom) return false;
        if (validYM(dateTo) && ym > dateTo) return false;
      }
      if (cancelledFilter === 'only' && !isCancelledComp(comp, cancelledCutoffIso)) return false;
      return true;
    },
    [compQuery, selectedCuber, selectedCuberCompIds, countryFilterSet, eventFilters, dateFrom, dateTo, cancelledFilter, cancelledCutoffIso],
  );

  const displayedComps = useMemo(
    () => activeComps.filter(isMatch),
    [activeComps, isMatch],
  );

  // .upcoming-page 根 ref — 用来由 CompList 按视口可视行实时设 --cl-name-width
  const pageRef = useRef<HTMLDivElement>(null);

  const weeks = useMemo(() => {
    return computeWeeks(viewDate.getFullYear(), viewDate.getMonth(), displayedComps, countryFilterSet);
  }, [displayedComps, viewDate, countryFilterSet]);

  const compactWeeks = useMemo(() => {
    if (viewMode !== 'compact') return null;
    return computeCompactWeeks(
      viewDate.getFullYear(),
      viewDate.getMonth(),
      displayedComps,
      countryFilterSet,
      cancelledCutoffIso,
    );
  }, [viewMode, displayedComps, viewDate, countryFilterSet, cancelledCutoffIso]);

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
      if (viewMode !== 'calendar' && viewMode !== 'compact') return;
      if (selectedComp || dayListDate || onThisDayDate || pickerOpen != null) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      const editable = (e.target as HTMLElement | null)?.isContentEditable;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || editable) return;
      e.preventDefault();
      gotoMonth(e.key === 'ArrowLeft' ? -1 : 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedComp, dayListDate, onThisDayDate, pickerOpen]);

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
      <div className="upcoming-page">
        <div className="state-message state-error">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="upcoming-page">
        <div className="state-message">{t('upcoming.loading')}</div>
      </div>
    );
  }

  const today = new Date();
  const monthYear = String(viewDate.getFullYear());
  const monthMm = String(viewDate.getMonth() + 1).padStart(2, '0');
  const weekdays = isZh ? WEEKDAY_ZH : WEEKDAY_EN;

  return (
    <div
      ref={pageRef}
      className={`upcoming-page${viewMode === 'list' ? ' upcoming-page--list' : ''}${viewMode === 'compact' ? ' upcoming-page--compact' : ''}`}
    >
      <header className="upcoming-header">
        <h1 className="upcoming-title">{t('upcoming.title')}</h1>
        <div className="upcoming-meta">
          <Link to={`/calendar/stats${getLangQuery()}`} className="globe-link">
            <BarChart3 size={12} strokeWidth={1.75} /> {isZh ? '统计' : 'Stats'}
          </Link>
          <Link to="/globe" className="globe-link">
            <GlobeIcon size={12} strokeWidth={1.75} /> {t('upcoming.viewGlobe')}
          </Link>
          <LangToggle variant="inline" />
        </div>
      </header>

      <div className="toolbar">
        <div className="search-box-wrap">
          <input
            type="text"
            className="search-box search-box-comp"
            placeholder={t('upcoming.searchComp')}
            value={compQuery}
            onChange={(e) => setCompQuery(e.target.value)}
          />
          {compQuery && (
            <ClearButton onClick={() => setCompQuery('')} isZh={isZh} />
          )}
        </div>
        <CuberSearchInput
          className="search-box-cuber"
          value={selectedCuber}
          onChange={setSelectedCuber}
          staticCubers={staticCubers}
          matchCount={selectedCuber ? (selectedCuberCompIds?.size ?? null) : null}
          placeholder={t('upcoming.searchCuber')}
          isZh={isZh}
        />
        <CountryInput
          className="country-filter"
          multi
          value={countryFilters}
          onChange={setCountryFilters}
          restrictTo={countryOptions.sorted}
          counts={countryOptions.counts}
          allLabel={t('upcoming.allCountries')}
        />
        <button
          type="button"
          className={`cancelled-toggle${cancelledFilter === 'only' ? ' is-active' : ''}`}
          onClick={() => setCancelledFilter((v) => (v === 'only' ? 'all' : 'only'))}
          aria-pressed={cancelledFilter === 'only'}
          title={isZh ? '只看已取消的比赛' : 'Show only cancelled competitions'}
        >
          <Ban size={14} strokeWidth={1.75} />
          <span>{isZh ? '已取消' : 'Cancelled'}</span>
        </button>
        {viewMode === 'calendar' && (
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
        <div className="view-toggle" role="tablist" aria-label={isZh ? '视图切换' : 'View toggle'}>
          <button
            role="tab"
            aria-selected={viewMode === 'calendar'}
            className={`view-btn ${viewMode === 'calendar' ? 'is-active' : ''}`}
            onClick={() => setViewMode('calendar')}
            aria-label={isZh ? '日历' : 'Calendar'}
            title={isZh ? '日历' : 'Calendar'}
          >
            <CalendarDays size={16} strokeWidth={1.75} />
          </button>
          <button
            role="tab"
            aria-selected={viewMode === 'compact'}
            className={`view-btn ${viewMode === 'compact' ? 'is-active' : ''}`}
            onClick={() => setViewMode('compact')}
            aria-label={isZh ? '紧凑日历(国旗)' : 'Compact (flags)'}
            title={isZh ? '紧凑日历(国旗)' : 'Compact (flags)'}
          >
            <LayoutGrid size={16} strokeWidth={1.75} />
          </button>
          <button
            role="tab"
            aria-selected={viewMode === 'list'}
            className={`view-btn ${viewMode === 'list' ? 'is-active' : ''}`}
            onClick={() => { setViewMode('list'); setMode('all'); }}
            aria-label={isZh ? '列表' : 'List'}
            title={isZh ? '列表' : 'List'}
          >
            <List size={16} strokeWidth={1.75} />
          </button>
        </div>
        {(viewMode === 'calendar' || viewMode === 'compact') && (
          <div className="month-nav">
            <button className="nav-btn" onClick={() => gotoMonth(-1)} aria-label="Previous month">
              <ChevronLeft size={16} strokeWidth={1.75} />
            </button>
            <button className="nav-today" onClick={gotoToday}>{isZh ? '今天' : 'Today'}</button>
            <button className="nav-btn" onClick={() => gotoMonth(1)} aria-label="Next month">
              <ChevronRight size={16} strokeWidth={1.75} />
            </button>
            <button
              ref={monthBtnRef}
              className="month-label month-label-btn"
              onClick={() => setPickerOpen((o) => o === 'month' ? null : 'month')}
              aria-label={isZh ? '选择年月' : 'Select year / month'}
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
              aria-label={isZh ? '起始年月' : 'From'}
            >
              {dateFrom || (isZh ? '起始' : 'From')}
            </button>
            <span className="date-range-sep">~</span>
            <button
              ref={toBtnRef}
              type="button"
              className={`date-range-pick${dateTo ? '' : ' is-empty'}`}
              onClick={() => setPickerOpen((o) => o === 'to' ? null : 'to')}
              aria-expanded={pickerOpen === 'to'}
              aria-label={isZh ? '结束年月' : 'To'}
            >
              {dateTo || (isZh ? '结束' : 'To')}
            </button>
            {(dateFrom || dateTo) && (
              <ClearButton
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                isZh={isZh}
                variant="standalone"
              />
            )}
            <span className="date-range-summary">
              {isZh
                ? `共 ${displayedComps.length.toLocaleString()} 场`
                : `${displayedComps.length.toLocaleString()} comps`}
            </span>
          </div>
        )}
      </div>

      <div
        className={`event-chips${viewMode === 'list' ? ' event-chips--list-header' : ''}`}
        ref={viewMode === 'list' ? chipsHeaderRef : undefined}
      >
        {(() => {
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
              ? (isZh ? `点击切换：关 → max → 1 → ... → ${max} → 关` : `Click to cycle: off → max → 1 → ... → ${max} → off`)
              : (isZh ? '点击切换：关 → max → 关' : 'Click to cycle: off → max → off');
            return (
              <button
                key={eid}
                className={`event-chip ${active ? 'is-active' : ''}`}
                onClick={cycle}
                aria-pressed={active}
                title={cycleHint}
              >
                <span className={`cubing-icon event-${eid}`} />
                <span className={`event-chip-rounds${cur === undefined ? ' is-empty' : ''}`}>
                  {badge}
                </span>
              </button>
            );
          });
          if (viewMode !== 'list') return chips;
          return (
            <div className="event-chips-grid">
              <span className="cl-year-cell" aria-live="polite">
                {currentYear && (
                  <>
                    <span className="cl-year-num">{currentYear.year}</span>
                    <span className="cl-year-count">{currentYear.count.toLocaleString()}</span>
                  </>
                )}
              </span>
              <span className="cl-h-spacer" aria-hidden="true" />
              <span className="cl-h-spacer" aria-hidden="true" />
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

      {(viewMode === 'calendar' || viewMode === 'compact') && (
        <div className="legend">
          {viewMode === 'calendar' && mode === 'all' && (
            <span className="legend-item"><span className="legend-swatch swatch-none-top" /> {isZh ? '一般比赛' : 'No top cubers'}</span>
          )}
          {viewMode === 'calendar' && (
            <>
              <span className="legend-item"><span className="legend-swatch swatch-default" /> {isZh ? '有顶尖选手' : 'Has top cubers'}</span>
              <span className="legend-item"><span className="legend-swatch swatch-clash" /> {isZh ? '扎堆 (3+)' : 'Clash (3+)'}</span>
            </>
          )}
          {viewMode === 'calendar' && (
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

      {viewMode === 'list' && (
        <CompList
          comps={displayedComps}
          isZh={isZh}
          onSelect={setSelectedComp}
          onYearChange={setCurrentYear}
          outerRef={listScrollRef}
          cancelledCutoffIso={cancelledCutoffIso}
          pageRef={pageRef}
        />
      )}

      {viewMode === 'calendar' && <div
        key={`cal-${viewDate.getFullYear()}-${viewDate.getMonth()}`}
        className={`calendar${navDir ? ` calendar--slide-${navDir}` : ''}`}
        onAnimationEnd={() => setNavDir(null)}
        onTouchStart={onCalendarTouchStart}
        onTouchEnd={onCalendarTouchEnd}
        onClickCapture={onCalendarClickCapture}
      >
        <div className="weekday-header">
          {weekdays.map((d, i) => (
            <div key={i} className="weekday-cell">
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div
            key={wi}
            className="week-row"
            style={{ ['--tracks' as string]: Math.max(1, week.maxTrack + 1 + (week.overflowByCol.size > 0 ? 1 : 0)) }}
          >
            {week.days.map((day, di) => {
              const inView = day.getMonth() === viewDate.getMonth();
              const isToday = inView && sameDay(day, today);
              return (
                <div
                  key={di}
                  className={`day-cell ${inView ? '' : 'out-of-month'} ${isToday ? 'is-today' : ''}`}
                  style={{ gridColumn: di + 1, gridRow: 1 }}
                >
                  {inView && (
                    <button
                      type="button"
                      className="day-number"
                      onClick={() => setOnThisDayDate(day)}
                      title={isZh ? '历年此日的比赛' : 'On this day across all years'}
                    >
                      {day.getDate()}
                    </button>
                  )}
                </div>
              );
            })}
            {week.bars.map((bar) => {
              const isClash = bar.comp.top_cubers.length >= 3;
              const hasTop = bar.comp.top_cubers.length > 0;
              const cancelled = isCancelledComp(bar.comp, cancelledCutoffIso);
              const displayName = localizeName(bar.comp, isZh);
              const classes = [
                'event-bar',
                isClash ? 'is-clash' : '',
                !hasTop ? 'is-none-top' : '',
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
          </div>
        ))}
      </div>}

      {viewMode === 'compact' && compactWeeks && <div
        key={`compact-${viewDate.getFullYear()}-${viewDate.getMonth()}`}
        className={`calendar calendar--compact${navDir ? ` calendar--slide-${navDir}` : ''}`}
        style={compactColTemplate ? { ['--compact-cols' as string]: compactColTemplate } : undefined}
        onAnimationEnd={() => setNavDir(null)}
        onTouchStart={onCalendarTouchStart}
        onTouchEnd={onCalendarTouchEnd}
        onClickCapture={onCalendarClickCapture}
      >
        <div className="weekday-header">
          {weekdays.map((d, i) => (
            <div key={i} className="weekday-cell">
              {d}
            </div>
          ))}
        </div>
        {compactWeeks.map((week, wi) => (
          <div key={wi} className="week-row">
            {week.days.map((day, di) => {
              const inView = day.getMonth() === viewDate.getMonth();
              const isToday = inView && sameDay(day, today);
              const tiles = week.byDay[di];
              return (
                <div
                  key={di}
                  className={`day-cell ${inView ? '' : 'out-of-month'} ${isToday ? 'is-today' : ''}${inView ? ' is-clickable' : ''}`}
                  onClick={inView ? () => setOnThisDayDate(day) : undefined}
                  role={inView ? 'button' : undefined}
                  tabIndex={inView ? 0 : undefined}
                  onKeyDown={inView ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOnThisDayDate(day); } } : undefined}
                  title={inView ? (isZh ? '历年此日的比赛' : 'On this day across all years') : undefined}
                >
                  {inView && (
                    <span className="day-number">
                      {day.getDate()}
                    </span>
                  )}
                  {inView && tiles.length > 0 && (
                    <div className="compact-flag-grid">
                      {tiles.map((tile) => {
                        const c = tile.rep;
                        const cls = [
                          'compact-flag-tile',
                          tile.allCancelled ? 'is-cancelled' : '',
                        ].filter(Boolean).join(' ');
                        const prefetchRounds = c.rounds ? undefined : () => { void fetchCompRounds(c.id); };
                        const titleText = tile.count > 1
                          ? `${countryName(c.country, isZh)} — ${tile.count}${isZh ? ' 场' : ' comps'}`
                          : `${localizeName(c, isZh)} — ${c.top_cubers.length} cubers`;
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
                </div>
              );
            })}
          </div>
        ))}
      </div>}

      {selectedComp && (
        <CompModal
          comp={selectedComp}
          isZh={isZh}
          onClose={() => setSelectedComp(null)}
          t={t}
          cancelled={isCancelledComp(selectedComp, cancelledCutoffIso)}
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
                  const displayName = localizeName(c, isZh);
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

    </div>
  );
}
