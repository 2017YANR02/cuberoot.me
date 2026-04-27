/**
 * 顶尖选手近期比赛追踪页 — 日历视图
 * 数据源: stats/upcoming_comps.json（Top 模式） + stats/data/all_upcoming_comps.json（All 模式）
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Star, Globe as GlobeIcon, List } from 'lucide-react';
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
import {
  loadCompRecordsSummary,
  loadCompRecordsDetail,
  getCompRecordTop,
  getCompRecordEntries,
  formatRecordValue,
  type RecordEntry,
} from '../utils/comp_records';
import { loadFlagData, personFlagIso2, compNameZh, countryToIso2 } from '../utils/country_flags';
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
  competitor_limit: number;
  cubing_china_url?: string;
  top_cubers: TopCuber[];
}

interface UpcomingData {
  updated_at: string;
  total_cubers_tracked: number;
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

// NOTE: ISO 3166-1 alpha-2 → 国家英文全名
const COUNTRY_MAP: Record<string, string> = {
  'AF': 'Afghanistan', 'AL': 'Albania', 'DZ': 'Algeria', 'AD': 'Andorra', 'AO': 'Angola',
  'AR': 'Argentina', 'AM': 'Armenia', 'AU': 'Australia', 'AT': 'Austria', 'AZ': 'Azerbaijan',
  'BH': 'Bahrain', 'BD': 'Bangladesh', 'BY': 'Belarus', 'BE': 'Belgium', 'BJ': 'Benin',
  'BT': 'Bhutan', 'BO': 'Bolivia', 'BA': 'Bosnia and Herzegovina', 'BR': 'Brazil',
  'BN': 'Brunei', 'BG': 'Bulgaria', 'KH': 'Cambodia', 'CM': 'Cameroon', 'CA': 'Canada',
  'CL': 'Chile', 'CN': 'China', 'CO': 'Colombia', 'CR': 'Costa Rica', 'HR': 'Croatia',
  'CU': 'Cuba', 'CY': 'Cyprus', 'CZ': 'Czech Republic', 'DK': 'Denmark', 'DO': 'Dominican Republic',
  'EC': 'Ecuador', 'EG': 'Egypt', 'SV': 'El Salvador', 'EE': 'Estonia', 'ET': 'Ethiopia',
  'FI': 'Finland', 'FR': 'France', 'GE': 'Georgia', 'DE': 'Germany', 'GH': 'Ghana',
  'GR': 'Greece', 'GT': 'Guatemala', 'HN': 'Honduras', 'HK': 'Hong Kong', 'HU': 'Hungary',
  'IS': 'Iceland', 'IN': 'India', 'ID': 'Indonesia', 'IR': 'Iran', 'IQ': 'Iraq',
  'IE': 'Ireland', 'IL': 'Israel', 'IT': 'Italy', 'JM': 'Jamaica', 'JP': 'Japan',
  'JO': 'Jordan', 'KZ': 'Kazakhstan', 'KE': 'Kenya', 'KR': 'South Korea', 'KW': 'Kuwait',
  'KG': 'Kyrgyzstan', 'LA': 'Laos', 'LV': 'Latvia', 'LB': 'Lebanon', 'LT': 'Lithuania',
  'LU': 'Luxembourg', 'MO': 'Macau', 'MK': 'North Macedonia', 'MY': 'Malaysia', 'MV': 'Maldives',
  'MT': 'Malta', 'MX': 'Mexico', 'MD': 'Moldova', 'MN': 'Mongolia', 'ME': 'Montenegro',
  'MA': 'Morocco', 'MZ': 'Mozambique', 'MM': 'Myanmar', 'NP': 'Nepal', 'NL': 'Netherlands',
  'NZ': 'New Zealand', 'NI': 'Nicaragua', 'NG': 'Nigeria', 'NO': 'Norway', 'OM': 'Oman',
  'PK': 'Pakistan', 'PA': 'Panama', 'PY': 'Paraguay', 'PE': 'Peru', 'PH': 'Philippines',
  'PL': 'Poland', 'PT': 'Portugal', 'QA': 'Qatar', 'RO': 'Romania', 'RU': 'Russia',
  'SA': 'Saudi Arabia', 'RS': 'Serbia', 'SG': 'Singapore', 'SK': 'Slovakia', 'SI': 'Slovenia',
  'ZA': 'South Africa', 'ES': 'Spain', 'LK': 'Sri Lanka', 'SE': 'Sweden', 'CH': 'Switzerland',
  'TW': 'Taiwan', 'TJ': 'Tajikistan', 'TZ': 'Tanzania', 'TH': 'Thailand', 'TN': 'Tunisia',
  'TR': 'Turkey', 'UA': 'Ukraine', 'AE': 'United Arab Emirates',
  'GB': 'United Kingdom', 'US': 'United States', 'UY': 'Uruguay', 'UZ': 'Uzbekistan',
  'VE': 'Venezuela', 'VN': 'Vietnam',
  'XA': 'Multiple Countries (Asia)', 'XE': 'Multiple Countries (Europe)',
  'XN': 'Multiple Countries (North America)', 'XS': 'Multiple Countries (South America)',
  'XW': 'Multiple Countries (World)', 'XF': 'Multiple Countries (Africa)',
  'XO': 'Multiple Countries (Oceania)',
};

const COUNTRY_ALIASES: Record<string, string> = {
  'usa': 'US', 'uk': 'GB', 'england': 'GB', 'britain': 'GB',
  'korea': 'KR', 'south korea': 'KR', 'uae': 'AE', 'czech': 'CZ', 'holland': 'NL',
};

const WEEKDAY_EN = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const WEEKDAY_ZH = ['一','二','三','四','五','六','日'];

// ── 工具函数 ──────────────────────────────────────────────────────────────

function getCountryName(iso2: string): string {
  return COUNTRY_MAP[iso2] || iso2;
}

function buildCountrySearchText(iso2: string): string {
  const enName = getCountryName(iso2).toLowerCase();
  const aliases = Object.entries(COUNTRY_ALIASES)
    .filter(([, v]) => v === iso2)
    .map(([k]) => k);
  return [iso2.toLowerCase(), enName, ...aliases].filter(Boolean).join(' ');
}

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
  if (!isZh) return c.name;
  return c.name_zh || compNameZh(c.name) || c.name;
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
  priorityCountry: string = '',
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
      if (priorityCountry) {
        const am = a.country === priorityCountry ? 0 : 1;
        const bm = b.country === priorityCountry ? 0 : 1;
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

    weeks.push({ days, bars, overflowByCol, maxTrack });
  }

  return weeks;
}

// ── 详情模态框 ────────────────────────────────────────────────────────────

function CompModal({ comp, isZh, onClose, t }: {
  comp: Competition;
  isZh: boolean;
  onClose: () => void;
  t: (k: string, o?: Record<string, unknown>) => string;
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

  const displayName = localizeName(comp, isZh);
  const displayCity = isZh ? (comp.city_zh || comp.city) : comp.city;
  const compUrl = comp.cubing_china_url || `https://www.worldcubeassociation.org/competitions/${comp.id}`;

  const dateStr = formatDateRangeIso(comp.start_date, comp.end_date || comp.start_date);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(ev) => ev.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <h2 className="modal-title">
          <a href={compUrl} target="_blank" rel="noopener noreferrer">
            <Flag iso2={comp.country} />
            <span>{displayName}</span>
          </a>
        </h2>
        <div className="modal-meta">
          {dateStr} · {displayCity}, {getCountryName(comp.country)}
          {comp.competitor_limit > 0 && <span> · {t('upcoming.competitorLimit', { count: comp.competitor_limit })}</span>}
        </div>
        {comp.events && comp.events.length > 0 && (
          <div className="modal-events">
            {comp.events.map((ev) => {
              const eid = SHORT_TO_EVENT_ID[ev] || ev;
              return <span key={ev} className={`cubing-icon event-${eid}`} />;
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
                  <span className="record-value mono">{formatRecordValue(r.v, r.e, r.k)}</span>
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
            <div className="wr-legend">
              <span className="wr-legend-item"><span className="wr-swatch wr-current" />{t('upcoming.wrCurrent')}</span>
              <span className="wr-legend-item"><span className="wr-swatch wr-former" />{t('upcoming.wrFormer')}</span>
            </div>
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
    competitor_limit: w.competitor_limit,
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
    competitor_limit: 0,
    top_cubers: [],
  };
}

// ── 主组件 ────────────────────────────────────────────────────────────────

export default function UpcomingCompsPage() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  const [data, setData] = useState<UpcomingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [viewDate, setViewDate] = useState<Date>(() => new Date()); // 月份锚点（第 1 日无关紧要，只看 Year/Month）
  const [selectedComp, setSelectedComp] = useState<Competition | null>(null);
  const [dayListDate, setDayListDate] = useState<Date | null>(null);
  const [mode, setMode] = useState<'top' | 'all'>('all');
  const [allComps, setAllComps] = useState<Competition[] | null>(null);
  const [allLoading, setAllLoading] = useState(false);
  const [allError, setAllError] = useState<string | null>(null);
  const [eventFilters, setEventFilters] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerBtnRef = useRef<HTMLButtonElement>(null);
  const [, setRecordsVer] = useState(0);

  useEffect(() => {
    loadCompRecordsSummary().then((v) => setRecordsVer(v));
    // NOTE: loadFlagData 加载 comp_names_zh.json，完成后触发重渲染以应用中文名
    loadFlagData().then((v) => setRecordsVer(v));
  }, []);

  useEffect(() => {
    fetch('/stats/upcoming_comps.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load JSON');
        return res.json();
      })
      .then((d: UpcomingData) => {
        setData(d);
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

  const countryOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of activeComps) counts[c.country] = (counts[c.country] || 0) + 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([iso2, count]) => ({ iso2, label: `${getCountryName(iso2)} (${count})`, count }));
  }, [activeComps]);

  // NOTE: 过滤匹配判断（不匹配的事件仍渲染但置灰）
  const isMatch = useCallback(
    (comp: Competition) => {
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const searchName = `${comp.name} ${comp.name_zh || ''} ${compNameZh(comp.name)} ${comp.city} ${comp.city_zh || ''}`.toLowerCase();
        const cuberNames = comp.top_cubers.map((c) => `${c.name.toLowerCase()} ${c.id.toLowerCase()}`).join(' ');
        const countrySearch = buildCountrySearchText(comp.country);
        if (!searchName.includes(q) && !cuberNames.includes(q) && !countrySearch.includes(q)) return false;
      }
      if (countryFilter && comp.country !== countryFilter) return false;
      if (eventFilters.length > 0) {
        const normalized = new Set((comp.events || []).map((e) => SHORT_TO_EVENT_ID[e] || e));
        if (!eventFilters.some((f) => normalized.has(f))) return false;
      }
      return true;
    },
    [searchQuery, countryFilter, eventFilters],
  );

  const weeks = useMemo(() => {
    return computeWeeks(viewDate.getFullYear(), viewDate.getMonth(), activeComps, countryFilter);
  }, [activeComps, viewDate, countryFilter]);

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
    const inMonth = activeComps.filter((c) => {
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
  }, [activeComps, viewDate]);

  const gotoMonth = (delta: number) => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  };
  const gotoToday = () => {
    const now = new Date();
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  // NOTE: 桌面端 ← / → 换月。输入框聚焦或弹层打开时让位
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (selectedComp || dayListDate || pickerOpen) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      const editable = (e.target as HTMLElement | null)?.isContentEditable;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || editable) return;
      e.preventDefault();
      gotoMonth(e.key === 'ArrowLeft' ? -1 : 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedComp, dayListDate, pickerOpen]);

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
    <div className="upcoming-page">
      <header className="upcoming-header">
        <h1 className="upcoming-title">{t('upcoming.title')}</h1>
        <div className="upcoming-meta">
          {isZh ? '追踪世界前 10 / 前 WR 保持者 · ' : 'Tracking world top 10 / former WR holders · '}
          {t('upcoming.updatedAt', { time: toIsoDate(new Date(data.updated_at)) })}
          {' · '}
          <Link to="/globe" className="globe-link">
            <GlobeIcon size={12} strokeWidth={1.75} /> {t('upcoming.viewGlobe')}
          </Link>
        </div>
      </header>

      <div className="toolbar">
        <input
          type="text"
          className="search-box"
          placeholder={t('upcoming.search')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          className="country-filter"
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
        >
          <option value="">{t('upcoming.allCountries')}</option>
          {countryOptions.map((opt) => (
            <option key={opt.iso2} value={opt.iso2}>{opt.label}</option>
          ))}
        </select>
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
      </div>

      <div className="month-bar">
        <div className="month-nav">
          <button className="nav-btn" onClick={() => gotoMonth(-1)} aria-label="Previous month">
            <ChevronLeft size={16} strokeWidth={1.75} />
          </button>
          <button className="nav-today" onClick={gotoToday}>{isZh ? '今天' : 'Today'}</button>
          <button className="nav-btn" onClick={() => gotoMonth(1)} aria-label="Next month">
            <ChevronRight size={16} strokeWidth={1.75} />
          </button>
          <button
            ref={pickerBtnRef}
            className="month-label month-label-btn"
            onClick={() => setPickerOpen((o) => !o)}
            aria-label={isZh ? '选择年月' : 'Select year / month'}
            aria-expanded={pickerOpen}
          >
            <span className="month-label-year">{monthYear}</span>
            <span className="month-label-month">{monthMm}</span>
          </button>
        </div>
        <div className="event-chips">
          {(['333', '222', '444', '555', '333oh', 'pyram', 'skewb', 'sq1', '333bf', '333fm'] as const).map((eid) => (
            <button
              key={eid}
              className={`event-chip ${eventFilters.includes(eid) ? 'is-active' : ''}`}
              onClick={() =>
                setEventFilters((prev) =>
                  prev.includes(eid) ? prev.filter((x) => x !== eid) : [...prev, eid]
                )
              }
              aria-pressed={eventFilters.includes(eid)}
            >
              <span className={`cubing-icon event-${eid}`} />
            </button>
          ))}
          {eventFilters.length > 0 && (
            <button className="event-chip-clear" onClick={() => setEventFilters([])}>
              {isZh ? '清除' : 'Clear'}
            </button>
          )}
        </div>
      </div>

      {allLoading && mode === 'all' && (
        <div className="mode-status">{t('upcoming.allLoading')}</div>
      )}
      {allError && mode === 'all' && (
        <div className="mode-status is-error">{allError}</div>
      )}

      <div className="legend">
        {mode === 'all' && (
          <span className="legend-item"><span className="legend-swatch swatch-none-top" /> {isZh ? '一般比赛' : 'No top cubers'}</span>
        )}
        <span className="legend-item"><span className="legend-swatch swatch-default" /> {isZh ? '有顶尖选手' : 'Has top cubers'}</span>
        <span className="legend-item"><span className="legend-swatch swatch-clash" /> {isZh ? '扎堆 (3+)' : 'Clash (3+)'}</span>
        <span className="month-stats">
          <span title={t('upcoming.statComps')}><List size={14} strokeWidth={1.75} /> {monthStats.comps}</span>
          <span title={t('upcoming.statCountries')}><GlobeIcon size={14} strokeWidth={1.75} /> {monthStats.countries}</span>
        </span>
      </div>

      <div
        className="calendar"
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
                  {inView && <span className="day-number">{day.getDate()}</span>}
                </div>
              );
            })}
            {week.bars.map((bar) => {
              const isClash = bar.comp.top_cubers.length >= 3;
              const hasTop = bar.comp.top_cubers.length > 0;
              const dimmed = !isMatch(bar.comp);
              const displayName = localizeName(bar.comp, isZh);
              const classes = [
                'event-bar',
                isClash ? 'is-clash' : '',
                !hasTop ? 'is-none-top' : '',
                dimmed ? 'is-dimmed' : '',
                bar.continuesFromPrev ? 'continues-prev' : '',
                bar.continuesToNext ? 'continues-next' : '',
              ].filter(Boolean).join(' ');
              return (
                <button
                  key={bar.key}
                  className={classes}
                  style={{
                    gridColumn: `${bar.startCol} / span ${bar.span}`,
                    gridRow: bar.track + 2,
                  }}
                  onClick={() => setSelectedComp(bar.comp)}
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
                onClick={() => setDayListDate(week.days[col - 1])}
              >
                +{overflowComps.length}
              </button>
            ))}
          </div>
        ))}
      </div>

      {selectedComp && (
        <CompModal comp={selectedComp} isZh={isZh} onClose={() => setSelectedComp(null)} t={t} />
      )}

      {pickerOpen && (
        <YearMonthPickerPopover
          year={viewDate.getFullYear()}
          month={viewDate.getMonth() + 1}
          yearMonthsMap={yearMonthsMap}
          anchor={pickerBtnRef.current?.getBoundingClientRect() ?? null}
          onCommit={(y, m) => {
            setViewDate(new Date(y, m - 1, 1));
            setPickerOpen(false);
          }}
          isZh={isZh}
        />
      )}

      {dayListDate && (
        <div className="modal-overlay" onClick={() => setDayListDate(null)}>
          <div className="modal-panel day-list-panel" onClick={(ev) => ev.stopPropagation()}>
            <button className="modal-close" onClick={() => setDayListDate(null)} aria-label="Close">×</button>
            <h2 className="modal-title">{toIsoDate(dayListDate)}</h2>
            <div className="day-list">
              {activeComps
                .filter((c) => {
                  const s = parseLocalDate(c.start_date);
                  const e = parseLocalDate(c.end_date || c.start_date);
                  return s <= dayListDate && dayListDate <= e;
                })
                .map((c) => {
                  const displayName = localizeName(c, isZh);
                  const top = getCompRecordTop(c.id);
                  return (
                    <button
                      key={c.id}
                      className="day-list-item"
                      onClick={() => { setSelectedComp(c); setDayListDate(null); }}
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

      <LangToggle />
    </div>
  );
}
