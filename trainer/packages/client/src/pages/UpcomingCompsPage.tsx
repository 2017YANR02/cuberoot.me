/**
 * 顶尖选手近期比赛追踪页
 * NOTE: 从原版 stats/upcoming_comp/index.md 1:1 复刻
 * 数据源: stats/upcoming_comps.json（Python 脚本生成）
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
const SOON_MS = SOON_DAYS * 24 * 60 * 60 * 1000;

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

// NOTE: 常见别名 → ISO2 码（使搜索 "usa"/"uk" 也能匹配）
const COUNTRY_ALIASES: Record<string, string> = {
  'usa': 'US', 'uk': 'GB', 'england': 'GB', 'britain': 'GB',
  'korea': 'KR', 'south korea': 'KR', 'uae': 'AE', 'czech': 'CZ', 'holland': 'NL',
};

// ── 工具函数 ──────────────────────────────────────────────────────────────

function getCountryName(iso2: string): string {
  return COUNTRY_MAP[iso2] || iso2;
}

/** 构建搜索用国家文本（ISO + 英文名 + 别名），全小写 */
function buildCountrySearchText(iso2: string): string {
  const enName = getCountryName(iso2).toLowerCase();
  const aliases = Object.entries(COUNTRY_ALIASES)
    .filter(([, v]) => v === iso2)
    .map(([k]) => k);
  return [iso2.toLowerCase(), enName, ...aliases].filter(Boolean).join(' ');
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── 子组件 ────────────────────────────────────────────────────────────────

/** 单张比赛卡片 */
function CompCard({ comp, isZh }: { comp: Competition; isZh: boolean }) {
  const isClash = comp.top_cubers.length >= 3;
  const now = new Date();
  const startDate = new Date(comp.start_date + 'T00:00:00');
  const endDate = new Date((comp.end_date || comp.start_date) + 'T23:59:59');
  const daysUntil = startDate.getTime() - now.getTime();
  const isSoon = now <= endDate && daysUntil <= SOON_MS;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isZh) return `${d.getMonth() + 1}月${d.getDate()}日`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  let dateDisplay = formatDate(comp.start_date);
  if (comp.end_date && comp.end_date !== comp.start_date) {
    dateDisplay += ' - ' + formatDate(comp.end_date);
  }

  const displayName = isZh ? (comp.name_zh || comp.name) : comp.name;
  const displayCity = isZh ? (comp.city_zh || comp.city) : comp.city;
  const countryDisplay = getCountryName(comp.country);
  const compUrl = comp.cubing_china_url || `https://www.worldcubeassociation.org/competitions/${comp.id}`;

  const classes = ['comp-card', isClash ? 'highlight' : '', isSoon ? 'soon' : ''].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="comp-header">
        <h2 className="comp-title">
          <a href={compUrl} target="_blank" rel="noopener noreferrer">
            {comp.name.includes('Championship') ? '🏆 ' : ''}
            <span className={`fi fi-${comp.country.toLowerCase()}`} style={{ marginRight: 6, fontSize: '0.8em' }} />
            {displayName}
          </a>
          {isClash && <span className="badge-clash">🔥</span>}
          {isSoon && <span className="badge-soon">⏰</span>}
        </h2>
      </div>
      <div className="comp-meta">
        <div className="comp-location">
          {dateDisplay}, {displayCity}, {countryDisplay}
        </div>
        {comp.competitor_limit > 0 && (
          <span style={{ color: '#9aa0a6', fontSize: 13, display: 'inline-block' }}>
            👥{comp.competitor_limit}
          </span>
        )}
        {comp.events && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#556070' }}>
            {comp.events.map((e) => {
              const eid = SHORT_TO_EVENT_ID[e] || e;
              return <span key={e} className={`cubing-icon event-${eid}`} style={{ fontSize: 14 }} />;
            })}
          </div>
        )}
      </div>
      <div className="cuber-list">
        {comp.top_cubers.map((c) => {
          // NOTE: 中文模式下简化选手姓名（"Yiheng Wang (王艺衡)" → "王艺衡"）
          let displayCuberName = c.name;
          if (isZh) {
            const m = c.name.match(/^(.+?)\s*\(([^)]+)\)$/);
            if (m && /[\u4e00-\u9fff]/.test(m[2])) displayCuberName = m[2];
          }

          return (
            <a
              key={c.id}
              href={`https://www.worldcubeassociation.org/persons/${c.id}`}
              className="cuber-tag"
              target="_blank"
              rel="noopener noreferrer"
            >
              {displayCuberName}
              {c.events && c.events.length > 0 && (
                <span className="event-label">
                  {c.events.map((ev) => {
                    const eid = SHORT_TO_EVENT_ID[ev.id] || ev.id;
                    const wrClass = ev.wr === 'current' ? ' wr-current' : ev.wr === 'former' ? ' wr-former' : '';
                    return <span key={ev.id} className={`cubing-icon event-${eid}${wrClass}`} />;
                  })}
                </span>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────────────────────

export default function UpcomingCompsPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  const [data, setData] = useState<UpcomingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [allExpanded, setAllExpanded] = useState(true);

  // NOTE: 数据加载 — 从静态 JSON 文件获取
  useEffect(() => {
    fetch('/stats/upcoming_comps.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load JSON');
        return res.json();
      })
      .then((d: UpcomingData) => setData(d))
      .catch(() => {
        setError(
          isZh
            ? '加载近期比赛数据失败，请稍后重试。'
            : 'Failed to load upcoming competitions data. Please try again later.'
        );
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // NOTE: 按月份分组
  const monthGroups = useMemo(() => {
    if (!data) return new Map<string, Competition[]>();
    const groups = new Map<string, Competition[]>();
    for (const comp of data.competitions) {
      const key = getMonthKey(comp.start_date);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(comp);
    }
    return groups;
  }, [data]);

  // NOTE: 提取所有国家用于下拉框
  const countryOptions = useMemo(() => {
    if (!data) return [];
    const counts: Record<string, number> = {};
    for (const c of data.competitions) {
      counts[c.country] = (counts[c.country] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([iso2, count]) => ({ iso2, label: `${getCountryName(iso2)} (${count})`, count }));
  }, [data]);

  // NOTE: 过滤函数 — 搜索框 + 国家下拉联动（AND 逻辑）
  const isVisible = useCallback(
    (comp: Competition) => {
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const searchName = `${comp.name} ${comp.name_zh || ''} ${comp.city} ${comp.city_zh || ''}`.toLowerCase();
        const cuberNames = comp.top_cubers.map((c) => `${c.name.toLowerCase()} ${c.id.toLowerCase()}`).join(' ');
        const countrySearch = buildCountrySearchText(comp.country);
        if (!searchName.includes(q) && !cuberNames.includes(q) && !countrySearch.includes(q)) {
          return false;
        }
      }
      if (countryFilter && comp.country !== countryFilter) return false;
      return true;
    },
    [searchQuery, countryFilter]
  );

  // ── 渲染 ──

  if (error) {
    return (
      <div className="upcoming-page">
        <Link to="/" className="back-link">← {isZh ? '返回首页' : 'Back'}</Link>
        <div className="state-message state-error">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="upcoming-page">
        <Link to="/" className="back-link">← {isZh ? '返回首页' : 'Back'}</Link>
        <div className="state-message">{isZh ? '加载赛事数据...' : 'Loading schedule data...'}</div>
      </div>
    );
  }

  const timeStr = new Date(data.updated_at).toLocaleString();
  const metaText = isZh
    ? `更新于: ${timeStr} | 追踪 ${data.total_cubers_tracked} 位选手`
    : `Updated: ${timeStr} | Tracking ${data.total_cubers_tracked} players`;

  return (
    <div className="upcoming-page">
      <Link to="/" className="back-link">← {isZh ? '返回首页' : 'Back'}</Link>

      <div className="timeline-header">
        <h1>{isZh ? '顶尖选手近期比赛' : "Top Cubers' Upcoming Comps"}</h1>
        <div className="timeline-meta">{metaText}</div>
      </div>

      <p className="desc-text">
        {isZh ? (
          <>
            追踪目前在任意官方项目中<strong>世界排名前 10</strong>（单次或平均）的选手，以及历史上<strong>曾保持过世界纪录</strong>的选手。
            每位选手标签显示其上榜项目，<span style={{ color: '#d93025' }}>红色</span>图标表示该项目的现任世界纪录保持者，<span style={{ color: '#e8890c' }}>橙色</span>表示前任世界纪录保持者。
            <br />月度统计：📋 比赛 · 🌍 国家 · 👤 选手 · 🔥 扎堆（3+ 位顶尖选手）· ⏰ 7 天内开赛。
          </>
        ) : (
          <>
            Tracking cubers who are currently <strong>ranked in the world top 10</strong> (single or average) in any official event,
            or have <strong>held a World Record</strong> at any point in history.
            Each cuber's tag shows their relevant events, with <span style={{ color: '#d93025' }}>red</span> icons indicating a current World Record holder, and <span style={{ color: '#e8890c' }}>orange</span> icons indicating a former one.
            <br />Monthly stats: 📋 competitions · 🌍 countries · 👤 cubers · 🔥 clashing (3+ top cubers) · ⏰ starting within 7 days.
          </>
        )}
      </p>

      {/* 工具栏 */}
      <div className="toolbar">
        <input
          type="text"
          className="search-box"
          placeholder={isZh ? '搜索比赛、选手、WCA ID 或国家...' : 'Search by competition, cuber, WCA ID, or country...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          className="country-filter"
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
        >
          <option value="">{isZh ? '所有国家' : 'All Countries'}</option>
          {countryOptions.map((opt) => (
            <option key={opt.iso2} value={opt.iso2}>{opt.label}</option>
          ))}
        </select>
        <button
          className="toggle-btn"
          onClick={() => setAllExpanded(!allExpanded)}
        >
          {allExpanded
            ? (isZh ? '▲ 全部折叠' : '▲ Collapse All')
            : (isZh ? '▼ 全部展开' : '▼ Expand All')}
        </button>
      </div>

      {/* 时间轴 */}
      <div className="timeline">
        {data.competitions.length === 0 ? (
          <div className="state-message">
            {isZh ? '未找到追踪选手的近期比赛。' : 'No upcoming competitions found for the tracked players.'}
          </div>
        ) : (
          Array.from(monthGroups.entries()).map(([monthKey, comps]) => {
            const visibleComps = comps.filter(isVisible);
            if (visibleComps.length === 0) return null;

            // NOTE: 月度统计摘要
            const countrySet = new Set(comps.map((c) => c.country));
            const cuberSet = new Set<string>();
            let clashCount = 0;
            for (const c of comps) {
              if (c.top_cubers.length >= 3) clashCount++;
              for (const p of c.top_cubers) cuberSet.add(p.id);
            }

            const pad = (n: number, w = 3) => String(n).padStart(w, '\u00a0');

            return (
              <details key={monthKey} className="month-group" open={allExpanded}>
                <summary>
                  {monthKey}
                  <span className="month-stats">
                    <span>📋 {pad(comps.length)}</span>
                    <span>🌍 {pad(countrySet.size, 2)}</span>
                    <span>👤 {pad(cuberSet.size)}</span>
                    {clashCount > 0 && <span>🔥 {pad(clashCount, 2)}</span>}
                  </span>
                </summary>
                {visibleComps.map((comp) => (
                  <CompCard key={comp.id} comp={comp} isZh={isZh} />
                ))}
              </details>
            );
          })
        )}
      </div>
    </div>
  );
}
