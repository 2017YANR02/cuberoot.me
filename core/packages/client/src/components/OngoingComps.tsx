// 落地页 — 搜索框下方的比赛 3 标签视图(即将开赛 / 正在进行 / 近一月)
// 仿 WCA Live 主页 (live.worldcubeassociation.org) 三栏切换;默认 in-progress > upcoming
// in-progress 按国家分组(只显国旗);upcoming/past 按日期分组,chip 前缀国旗
// 数据走 utils/comp_search 的 loadComps()(LandingSearch 已 eager 预拉,共享缓存)
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { loadComps, type Comp } from '../utils/comp_search';
import { compLinkProps } from '../utils/comp_link';
import { localizeCompName } from '../utils/comp_localize';
import { Flag } from '../utils/flag';
import { toIsoDate, formatDateRangeIso } from '../utils/date_range';
import { countryName } from '../utils/country_name';
import './ongoing_comps.css';

interface Props { lang: 'zh' | 'en' }

type TabKey = 'upcoming' | 'inProgress' | 'past';

type Group =
  | { kind: 'country'; iso2: string; comps: Comp[] }
  | { kind: 'date'; date: string; comps: Comp[] };

const DEFAULT_VISIBLE = new Set(['cn', 'us']);

function stripTrailingYear(s: string): string {
  return s.replace(/\s?\d{4}$/, '').trim();
}

function shiftIso(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

function groupByCountry(comps: Comp[]): Group[] {
  const byIso = new Map<string, Comp[]>();
  for (const c of comps) {
    const k = (c.country || '').toLowerCase();
    const arr = byIso.get(k) ?? [];
    arr.push(c);
    byIso.set(k, arr);
  }
  for (const arr of byIso.values()) {
    arr.sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id.localeCompare(b.id));
  }
  const list: Group[] = [...byIso.entries()].map(([iso2, comps]) => ({ kind: 'country', iso2, comps }));
  const rank = (iso2: string) => iso2 === 'cn' ? 0 : iso2 === 'us' ? 1 : 2;
  list.sort((a, b) => {
    if (a.kind !== 'country' || b.kind !== 'country') return 0;
    const ra = rank(a.iso2), rb = rank(b.iso2);
    if (ra !== rb) return ra - rb;
    if (a.comps.length !== b.comps.length) return b.comps.length - a.comps.length;
    return countryName(a.iso2, false).localeCompare(countryName(b.iso2, false));
  });
  return list;
}

function groupByDate(comps: Comp[], keyField: 'start_date' | 'end_date', asc: boolean): Group[] {
  const byDate = new Map<string, Comp[]>();
  for (const c of comps) {
    const k = (keyField === 'end_date' ? (c.end_date || c.start_date) : c.start_date);
    const arr = byDate.get(k) ?? [];
    arr.push(c);
    byDate.set(k, arr);
  }
  for (const arr of byDate.values()) {
    arr.sort((a, b) => a.id.localeCompare(b.id));
  }
  const list: Group[] = [...byDate.entries()].map(([date, comps]) => ({ kind: 'date', date, comps }));
  list.sort((a, b) => {
    if (a.kind !== 'date' || b.kind !== 'date') return 0;
    return asc ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
  });
  return list;
}

export default function OngoingComps({ lang }: Props) {
  const isZh = lang === 'zh';
  const [comps, setComps] = useState<Comp[] | null>(null);
  const [tab, setTab] = useState<TabKey | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let mounted = true;

    const kick = () => {
      if (!mounted) return;
      loadComps().then(all => {
        if (!mounted) return;
        setComps(all);
      }).catch(() => { if (mounted) setComps([]); });
    };

    type RIC = (cb: () => void, opts?: { timeout?: number }) => number;
    type CIC = (id: number) => void;
    const w = window as Window & { requestIdleCallback?: RIC; cancelIdleCallback?: CIC };
    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (w.requestIdleCallback) {
      idleId = w.requestIdleCallback(kick, { timeout: 2000 });
    } else {
      timeoutId = setTimeout(kick, 200);
    }

    return () => {
      mounted = false;
      if (idleId !== null) w.cancelIdleCallback?.(idleId);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, []);

  const buckets = useMemo(() => {
    if (!comps) return { upcoming: [], inProgress: [], past: [] };
    const today = toIsoDate(new Date());
    const monthAgo = shiftIso(today, -30);
    const monthAhead = shiftIso(today, 30);
    const upcoming: Comp[] = [];
    const inProgress: Comp[] = [];
    const past: Comp[] = [];
    for (const c of comps) {
      const end = c.end_date || c.start_date;
      if (c.start_date > today) {
        if (c.start_date <= monthAhead) upcoming.push(c);
      } else if (end >= today) {
        inProgress.push(c);
      } else if (end >= monthAgo) {
        past.push(c);
      }
    }
    return { upcoming, inProgress, past };
  }, [comps]);

  useEffect(() => {
    if (tab !== null || !comps) return;
    if (buckets.inProgress.length > 0) setTab('inProgress');
    else if (buckets.upcoming.length > 0) setTab('upcoming');
    else if (buckets.past.length > 0) setTab('past');
  }, [tab, comps, buckets]);

  useEffect(() => { setExpanded(false); }, [tab]);

  const active = tab ?? 'inProgress';
  const activeComps = buckets[active] ?? [];

  const groups = useMemo<Group[]>(() => {
    if (active === 'inProgress') return groupByCountry(activeComps);
    if (active === 'upcoming') return groupByDate(activeComps, 'start_date', true);
    return groupByDate(activeComps, 'end_date', false);
  }, [activeComps, active]);

  if (!comps) return null;
  const total = buckets.upcoming.length + buckets.inProgress.length + buckets.past.length;
  if (total === 0) return null;

  const tabs: { key: TabKey; zh: string; en: string; count: number }[] = [
    { key: 'upcoming',   zh: '即将开赛', en: 'Upcoming',   count: buckets.upcoming.length },
    { key: 'inProgress', zh: '正在进行', en: 'Right now',  count: buckets.inProgress.length },
    { key: 'past',       zh: '近一月',   en: 'Past month', count: buckets.past.length },
  ];

  // country 模式才有「默认 CN/US,其它折叠」;date 模式全展开
  const isCountryMode = active === 'inProgress';
  const visibleGroups = isCountryMode && !expanded
    ? groups.filter(g => g.kind === 'country' && DEFAULT_VISIBLE.has(g.iso2))
    : groups;
  const hasCollapsible = isCountryMode && groups.some(g => g.kind === 'country' && !DEFAULT_VISIBLE.has(g.iso2));
  const fallbackGroups = isCountryMode && !expanded && visibleGroups.length === 0
    ? groups.slice(0, 2)
    : visibleGroups;
  const fallbackUsed = fallbackGroups !== visibleGroups;

  return (
    <div className="ongoing-comps">
      <div className="ongoing-comps-tabs" role="tablist">
        {tabs.map(t => {
          const isActive = t.key === active;
          const disabled = t.count === 0;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={disabled}
              className={`ongoing-comps-tab${isActive ? ' is-active' : ''}`}
              onClick={() => !disabled && setTab(t.key)}
            >
              <span>{isZh ? t.zh : t.en}</span>
              {t.count > 0 && <span className="ongoing-comps-tab-count">{t.count}</span>}
            </button>
          );
        })}
      </div>
      <div className="ongoing-comps-groups">
        {fallbackGroups.map(g => g.kind === 'country' ? (
          <div key={`c-${g.iso2}`} className="ongoing-comps-group">
            <Flag iso2={g.iso2} className="ongoing-comps-flag" />
            <div className="ongoing-comps-list">
              {g.comps.map(c => (
                <Link
                  key={c.id}
                  {...compLinkProps(c.id)}
                  className="ongoing-comps-chip"
                  title={`${c.name}  ${formatDateRangeIso(c.start_date, c.end_date)}`}
                >
                  {stripTrailingYear(localizeCompName(c.id, c.name, isZh))}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div key={`d-${g.date}`} className="ongoing-comps-group ongoing-comps-group-date">
            <span className="ongoing-comps-date">{g.date}</span>
            <div className="ongoing-comps-list">
              {g.comps.map(c => (
                <Link
                  key={c.id}
                  {...compLinkProps(c.id)}
                  className="ongoing-comps-chip"
                  title={`${c.name}  ${formatDateRangeIso(c.start_date, c.end_date)}`}
                >
                  <Flag iso2={(c.country || '').toLowerCase()} className="ongoing-comps-chip-flag" />
                  <span>{stripTrailingYear(localizeCompName(c.id, c.name, isZh))}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
        {(hasCollapsible && !fallbackUsed) && (
          <button
            type="button"
            className="ongoing-comps-expand"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? <ChevronUp size={14} strokeWidth={1.75} /> : <ChevronDown size={14} strokeWidth={1.75} />}
            {expanded ? (isZh ? '收起' : 'Collapse') : (isZh ? '更多…' : 'More…')}
          </button>
        )}
      </div>
    </div>
  );
}
