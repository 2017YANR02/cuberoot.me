/**
 * 顶尖选手近期比赛追踪页 — 日历视图
 * 数据源: stats/upcoming_comps.json（Top 模式） + WCA REST /competitions（All 模式）
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Star, Globe as GlobeIcon } from 'lucide-react';
import { fetchAllUpcomingCompetitions, type WcaUpcomingComp } from '@cuberoot/shared';
import LangToggle from '../components/LangToggle';
import { displayCuberName } from '../utils/name_utils';
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

const MONTH_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_ZH = ['1 月','2 月','3 月','4 月','5 月','6 月','7 月','8 月','9 月','10 月','11 月','12 月'];
const WEEKDAY_EN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const WEEKDAY_ZH = ['日','一','二','三','四','五','六'];

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
  return addDays(first, -first.getDay());
}

// ── 国旗 ──────────────────────────────────────────────────────────────────

function Flag({ iso2 }: { iso2: string }) {
  if (iso2.toLowerCase() === 'tw') {
    return <img className="flag-img" src="/tools/assets/images/ChineseTaipei.svg" alt="Chinese Taipei" />;
  }
  return <span className={`fi fi-${iso2.toLowerCase()} flag-span`} aria-label={iso2} />;
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
): WeekRow[] {
  const gridStart = monthGridStart(viewYear, viewMonth);
  const weeks: WeekRow[] = [];

  // NOTE: 生成最多 6 行，最后一行如果整行都是下月数据则省略
  for (let w = 0; w < 6; w++) {
    const weekStart = addDays(gridStart, w * 7);
    const weekEnd = addDays(weekStart, 6);

    // 如果 weekStart 已经超过当月末一周且整周都在下月，停
    if (w >= 4) {
      const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0);
      if (weekStart > lastDayOfMonth) break;
    }

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) days.push(addDays(weekStart, i));

    // 找出与本周相交的比赛，按开始日期排序
    const overlaps: Competition[] = comps.filter((c) => {
      const s = parseLocalDate(c.start_date);
      const e = parseLocalDate(c.end_date || c.start_date);
      return e >= weekStart && s <= weekEnd;
    }).sort((a, b) => {
      // NOTE: 优先显示有 top cubers 的比赛（All 模式下尤为重要）
      const tcDiff = b.top_cubers.length - a.top_cubers.length;
      if (tcDiff !== 0) return tcDiff;
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
      const clippedStart = s < weekStart ? weekStart : s;
      const clippedEnd = e > weekEnd ? weekEnd : e;
      const startCol = daysBetween(weekStart, clippedStart) + 1;
      const span = daysBetween(clippedStart, clippedEnd) + 1;

      if (track < MAX_TRACKS) {
        bars.push({
          comp: c,
          startCol,
          span,
          track,
          continuesFromPrev: s < weekStart,
          continuesToNext: e > weekEnd,
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

  const displayName = isZh ? (comp.name_zh || comp.name) : comp.name;
  const displayCity = isZh ? (comp.city_zh || comp.city) : comp.city;
  const compUrl = comp.cubing_china_url || `https://www.worldcubeassociation.org/competitions/${comp.id}`;

  const s = parseLocalDate(comp.start_date);
  const e = parseLocalDate(comp.end_date || comp.start_date);
  const formatDate = (d: Date) => isZh
    ? `${d.getMonth() + 1} 月 ${d.getDate()} 日`
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const dateStr = sameDay(s, e) ? formatDate(s) : `${formatDate(s)} — ${formatDate(e)}`;

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

// NOTE: WCA API 返回的比赛 → 本组件 Competition 结构适配
// 合并 top_cubers（从 Top 模式数据字典中反查）
function adaptWcaComp(w: WcaUpcomingComp, topCuberMap: Map<string, TopCuber[]>): Competition {
  return {
    id: w.id,
    name: w.name,
    city: w.city,
    country: w.country_iso2,
    start_date: w.start_date,
    end_date: w.end_date,
    events: w.event_ids,
    competitor_limit: w.competitor_limit ?? 0,
    top_cubers: topCuberMap.get(w.id) ?? [],
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
  const [mode, setMode] = useState<'top' | 'all'>('top');
  const [allComps, setAllComps] = useState<Competition[] | null>(null);
  const [allLoading, setAllLoading] = useState(false);
  const [allError, setAllError] = useState<string | null>(null);
  const [eventFilters, setEventFilters] = useState<string[]>([]);

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

  // NOTE: All 模式懒加载 — 用户切到 All 且还没数据时才请求 WCA API
  useEffect(() => {
    if (mode !== 'all' || allComps || allLoading || !data) return;
    setAllLoading(true);
    setAllError(null);
    const today = new Date();
    const fromDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    const topMap = new Map(data.competitions.map((c) => [c.id, c.top_cubers]));
    fetchAllUpcomingCompetitions(fromDate)
      .then((list) => setAllComps(list.map((w) => adaptWcaComp(w, topMap))))
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
        const searchName = `${comp.name} ${comp.name_zh || ''} ${comp.city} ${comp.city_zh || ''}`.toLowerCase();
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
    return computeWeeks(viewDate.getFullYear(), viewDate.getMonth(), activeComps);
  }, [activeComps, viewDate]);

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

  // ── 渲染 ──

  if (error) {
    return (
      <div className="upcoming-page">
        <Link to="/" className="back-link">← {t('common.backToHome')}</Link>
        <div className="state-message state-error">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="upcoming-page">
        <Link to="/" className="back-link">← {t('common.backToHome')}</Link>
        <div className="state-message">{t('upcoming.loading')}</div>
      </div>
    );
  }

  const today = new Date();
  const monthLabel = isZh
    ? `${viewDate.getFullYear()} 年 ${MONTH_ZH[viewDate.getMonth()]}`
    : `${MONTH_EN[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
  const weekdays = isZh ? WEEKDAY_ZH : WEEKDAY_EN;

  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className="upcoming-page">
      <Link to="/" className="back-link">← {t('common.backToHome')}</Link>

      <header className="upcoming-header">
        <h1 className="upcoming-title">{t('upcoming.title')}</h1>
        <div className="upcoming-meta">
          {isZh ? '追踪世界前 10 / 前 WR 保持者 · ' : 'Tracking world top 10 / former WR holders · '}
          {t('upcoming.updatedAt', { time: new Date(data.updated_at).toLocaleString() })}
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
            aria-selected={mode === 'top'}
            className={`mode-btn ${mode === 'top' ? 'is-active' : ''}`}
            onClick={() => setMode('top')}
          >
            <Star size={14} strokeWidth={1.75} />
            <span>{t('upcoming.modeTop')}</span>
          </button>
          <button
            role="tab"
            aria-selected={mode === 'all'}
            className={`mode-btn ${mode === 'all' ? 'is-active' : ''}`}
            onClick={() => setMode('all')}
          >
            <GlobeIcon size={14} strokeWidth={1.75} />
            <span>{t('upcoming.modeAll')}</span>
          </button>
        </div>
        <div className="month-nav">
          <button className="nav-btn" onClick={() => gotoMonth(-1)} aria-label="Previous month">
            <ChevronLeft size={16} strokeWidth={1.75} />
          </button>
          <button className="nav-today" onClick={gotoToday}>{isZh ? '今天' : 'Today'}</button>
          <button className="nav-btn" onClick={() => gotoMonth(1)} aria-label="Next month">
            <ChevronRight size={16} strokeWidth={1.75} />
          </button>
          <span className="month-label">{monthLabel}</span>
        </div>
      </div>

      {allLoading && mode === 'all' && (
        <div className="mode-status">{t('upcoming.allLoading')}</div>
      )}
      {allError && mode === 'all' && (
        <div className="mode-status is-error">{allError}</div>
      )}

      <div className="event-chips">
        <span className="event-chips-label">{t('upcoming.eventFilter')}</span>
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

      <div className="calendar">
        <div className="weekday-header">
          {weekdays.map((d, i) => (
            <div key={i} className={`weekday-cell ${i === 0 || i === 6 ? 'is-weekend' : ''}`}>
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
              const isToday = sameDay(day, today);
              const isWeekend = di === 0 || di === 6;
              return (
                <div
                  key={di}
                  className={`day-cell ${inView ? '' : 'out-of-month'} ${isToday ? 'is-today' : ''} ${isWeekend ? 'is-weekend' : ''}`}
                  style={{ gridColumn: di + 1, gridRow: 1 }}
                >
                  <span className="day-number">{day.getDate()}</span>
                </div>
              );
            })}
            {week.bars.map((bar) => {
              const isClash = bar.comp.top_cubers.length >= 3;
              const hasTop = bar.comp.top_cubers.length > 0;
              const dimmed = !isMatch(bar.comp);
              const displayName = isZh ? (bar.comp.name_zh || bar.comp.name) : bar.comp.name;
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
                +{overflowComps.length} more
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="month-stats">
        <span title={t('upcoming.statComps')}>📋 {monthStats.comps}</span>
        <span title={t('upcoming.statCountries')}>🌍 {monthStats.countries}</span>
        <span title={t('upcoming.statCubers')}>👤 {monthStats.cubers}</span>
        {monthStats.soon > 0 && (
          <span className="stat-soon" title={t('upcoming.statSoon')}>⏰ {monthStats.soon}</span>
        )}
      </div>

      <div className="legend">
        {mode === 'all' && (
          <span className="legend-item"><span className="legend-swatch swatch-none-top" /> {isZh ? '一般比赛' : 'No top cubers'}</span>
        )}
        <span className="legend-item"><span className="legend-swatch swatch-default" /> {isZh ? '有顶尖选手' : 'Has top cubers'}</span>
        <span className="legend-item"><span className="legend-swatch swatch-clash" /> {isZh ? '扎堆 (3+)' : 'Clash (3+)'}</span>
      </div>

      {selectedComp && (
        <CompModal comp={selectedComp} isZh={isZh} onClose={() => setSelectedComp(null)} t={t} />
      )}

      {dayListDate && (
        <div className="modal-overlay" onClick={() => setDayListDate(null)}>
          <div className="modal-panel day-list-panel" onClick={(ev) => ev.stopPropagation()}>
            <button className="modal-close" onClick={() => setDayListDate(null)} aria-label="Close">×</button>
            <h2 className="modal-title">
              {isZh
                ? `${dayListDate.getMonth() + 1} 月 ${dayListDate.getDate()} 日`
                : dayListDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </h2>
            <div className="day-list">
              {activeComps
                .filter((c) => {
                  const s = parseLocalDate(c.start_date);
                  const e = parseLocalDate(c.end_date || c.start_date);
                  return s <= dayListDate && dayListDate <= e;
                })
                .map((c) => {
                  const displayName = isZh ? (c.name_zh || c.name) : c.name;
                  return (
                    <button
                      key={c.id}
                      className="day-list-item"
                      onClick={() => { setSelectedComp(c); setDayListDate(null); }}
                    >
                      <Flag iso2={c.country} />
                      <span>{displayName}</span>
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
