'use client';

// Landing page — 3-tab comp view (upcoming / in-progress / past month)
// In-progress: grouped by country (flag-only header).
// Upcoming / past: grouped by date, country flag prefix on each chip.
// Data: lib/comp-search.ts loadComps() — LandingSearch (when present) preloads, this shares the cache.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { loadComps, type Comp } from '@/lib/comp-search';
import { compLinkProps } from '@/lib/comp-link';
import { localizeCompName } from '@/lib/comp-localize';
import { Flag } from '@/components/Flag';
import { toIsoDate, formatDateRangeIso } from '@/lib/wca-date';
import { countryName } from '@/lib/country-name';
import { useRecentRecords, RecentRecordsList } from '@/components/RecentRecords';
import { useAnnouncedComps, AnnouncedCard } from '@/components/AnnouncedComps';
import { RegistrationView } from '@/components/RegistrationComps';
import { useCompFollows, FollowStar } from '@/components/CompFollow';
import { countActionableReg } from '@/lib/comp-registration';
import './ongoing_comps.css';
import i18n from '@/i18n/i18n-client';
import { tr } from '@/i18n/tr';

interface Props { lang: 'zh' | 'en' }

type TabKey = 'announced' | 'registration' | 'upcoming' | 'inProgress' | 'past' | 'records';

type Group =
  | { kind: 'country'; iso2: string; comps: Comp[] }
  | { kind: 'date'; date: string; comps: Comp[] };

// 各 tab 覆盖的时效窗口 — 跟随当前 tab 的一行 muted 说明 + 每个 tab 的 hover title,
// 让用户知道每个标签看的是多久内的数据。
const TAB_SCOPE: Record<TabKey, { zh: string; en: string; }> = {
  records:    { zh: '近 10 天',   en: 'last 10 days' },
  inProgress: { zh: '进行中',     en: 'ongoing' },
  announced:  { zh: '近 48 小时', en: 'last 48h' },
  registration: { zh: '报名窗口', en: 'registration' },
  upcoming:   { zh: '未来 30 天', en: 'next 30 days' },
  past:       { zh: '过去 30 天', en: 'past 30 days' },
};
function pickScope(key: TabKey): string {
  const o = TAB_SCOPE[key];
  return tr(o);
}

function stripTrailingYear(s: string): string {
  return s.replace(/\s?\d{4}$/, '').trim();
}

function shiftIso(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

// 比赛日期(start_date/end_date)存的是「比赛当地时区」的日历日。若用用户浏览器本地 today
// 分桶,领先时区正在进行的比赛会被误判:中国比赛在美洲看像「明天才开始」而落进「未来」。
// 用比赛经度估算 UTC 偏移(≈ 经度/15 小时)得到比赛当地「今天」,各比赛按自己的本地日期分桶。
// 经度缺失时回退用户本地日期(同旧行为)。
function compLocalDate(nowMs: number, lon: number | undefined): string {
  if (lon == null || !Number.isFinite(lon)) return toIsoDate(new Date(nowMs));
  const d = new Date(nowMs + Math.round((lon / 15) * 60) * 60_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
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

// 当前 / 未来 / 往期 的比赛 chip(国家分组无内联旗、日期分组带旗)。登录用户在尾部加一颗
// 轻量关注星(在 Link 之外,避免锚点嵌按钮);未登录则保持原样,零新增杂物。
function CompChip({ comp, lang, isZh, showFlag, loggedIn, followed, onToggle }: {
  comp: Comp;
  lang: 'zh' | 'en';
  isZh: boolean;
  showFlag: boolean;
  loggedIn: boolean;
  followed: boolean;
  onToggle: (id: string) => void;
}) {
  const link = (
    <Link
      {...compLinkProps(comp.id, undefined, lang)}
      className="ongoing-comps-chip"
      title={`${comp.name}  ${formatDateRangeIso(comp.start_date, comp.end_date)}`}
    >
      {showFlag && <Flag iso2={(comp.country || '').toLowerCase()} className="ongoing-comps-chip-flag" />}
      <span>{stripTrailingYear(localizeCompName(comp.id, comp.name, isZh))}</span>
    </Link>
  );
  if (!loggedIn) return link;
  return (
    <span className="ongoing-comps-chip-wrap">
      {link}
      <FollowStar variant="chip" compId={comp.id} followed={followed} onToggle={onToggle} />
    </span>
  );
}

export default function OngoingComps({ lang }: Props) {
  const isZh = lang === 'zh';
  const [comps, setComps] = useState<Comp[] | null>(null);
  const [tab, setTab] = useState<TabKey | null>(null);
  const { filled: records } = useRecentRecords(isZh);
  const announced = useAnnouncedComps();
  const announcedList = announced ?? [];
  // 全 5 个比赛标签共用一份关注状态(单次 fetch,统一乐观态),下发给卡片 / chip。
  const { loggedIn, follows, toggle } = useCompFollows();

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

  const buckets = useMemo<{ upcoming: Comp[]; inProgress: Comp[]; past: Comp[] }>(() => {
    if (!comps) return { upcoming: [], inProgress: [], past: [] };
    const nowMs = Date.now();
    const userToday = toIsoDate(new Date(nowMs));
    const monthAgo = shiftIso(userToday, -30);
    const monthAhead = shiftIso(userToday, 30);
    const upcoming: Comp[] = [];
    const inProgress: Comp[] = [];
    const past: Comp[] = [];
    for (const c of comps) {
      const end = c.end_date || c.start_date;
      const today = compLocalDate(nowMs, c.longitude_degrees);
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
    if (tab !== null) return;
    if (buckets.inProgress.length > 0) setTab('inProgress');
    else if (buckets.upcoming.length > 0) setTab('upcoming');
    else if (buckets.past.length > 0) setTab('past');
    else if (records.length > 0) setTab('records');
    else if (announcedList.length > 0) setTab('announced');
  }, [tab, buckets, records, announcedList.length]);

  const active: TabKey =
    tab ??
    (buckets.inProgress.length > 0 ? 'inProgress'
      : buckets.upcoming.length > 0 ? 'upcoming'
      : buckets.past.length > 0 ? 'past'
      : records.length > 0 ? 'records'
      : 'announced');
  const activeComps: Comp[] =
    active === 'inProgress' ? buckets.inProgress
      : active === 'upcoming' ? buckets.upcoming
      : active === 'past' ? buckets.past
      : [];

  const groups = useMemo<Group[]>(() => {
    if (active === 'inProgress') return groupByCountry(activeComps);
    if (active === 'upcoming') return groupByDate(activeComps, 'start_date', true);
    if (active === 'past') return groupByDate(activeComps, 'end_date', false);
    return [];
  }, [activeComps, active]);

  // 「报名」标签:全世界 upcoming 比赛里,视野内还有报名里程碑(开放/截止)的场数。
  const regCount = useMemo(() => comps ? countActionableReg(comps, Date.now()) : 0, [comps]);

  const total = buckets.upcoming.length + buckets.inProgress.length + buckets.past.length;
  if (total === 0 && records.length === 0 && announcedList.length === 0 && regCount === 0) return null;

  // 只显示有数据的 tab(某分类为空 → 直接隐藏该 tab,不留灰态)
  const allTabs: { key: TabKey; zh: string; en: string; count: number
 }[] = [
    { key: 'records',    zh: '纪录', en: 'Records',  count: records.length
    },
    { key: 'inProgress', zh: '当前', en: 'Now',      count: buckets.inProgress.length
    },
    { key: 'announced',  zh: '公示', en: 'Announced', count: announcedList.length
    },
    { key: 'registration', zh: '报名', en: 'Register', count: regCount
    },
    { key: 'upcoming',   zh: '未来', en: 'Upcoming', count: buckets.upcoming.length
    },
    { key: 'past',       zh: '往期', en: 'Past',     count: buckets.past.length },
  ];
  const tabs = allTabs.filter(t => t.count > 0);

  return (
    <div className="ongoing-comps">
      <div className="ongoing-comps-tabbar">
        <div className="ongoing-comps-tabs" role="tablist">
          {tabs.map(t => {
            const isActive = t.key === active;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`ongoing-comps-tab${isActive ? ' is-active' : ''}`}
                onClick={() => setTab(t.key)}
                title={pickScope(t.key)}
              >
                <span>{tr(t)}</span>
              </button>
            );
          })}
        </div>
        <span className="ongoing-comps-scope">{pickScope(active)}</span>
      </div>
      <div className="ongoing-comps-groups">
        {active === 'announced' ? (
          <div className="tac-grid">
            {announcedList.map((c) => (
              <AnnouncedCard
                key={c.id} comp={c} isZh={isZh} lang={lang}
                loggedIn={loggedIn} followed={follows.has(c.id)} onToggle={toggle}
              />
            ))}
          </div>
        ) : active === 'registration' ? (
          <RegistrationView comps={comps ?? []} isZh={isZh} lang={lang} loggedIn={loggedIn} follows={follows} toggle={toggle} />
        ) : active === 'records' ? (
          <RecentRecordsList filled={records} isZh={isZh} />
        ) : groups.map(g => g.kind === 'country' ? (
          <div key={`c-${g.iso2}`} className="ongoing-comps-group">
            <Flag iso2={g.iso2} className="ongoing-comps-flag" />
            <div className="ongoing-comps-list">
              {g.comps.map(c => (
                <CompChip
                  key={c.id} comp={c} lang={lang} isZh={isZh} showFlag={false}
                  loggedIn={loggedIn} followed={follows.has(c.id)} onToggle={toggle}
                />
              ))}
            </div>
          </div>
        ) : (
          <div key={`d-${g.date}`} className="ongoing-comps-group ongoing-comps-group-date">
            <span className="ongoing-comps-date">{g.date.slice(5)}</span>
            <div className="ongoing-comps-list">
              {g.comps.map(c => (
                <CompChip
                  key={c.id} comp={c} lang={lang} isZh={isZh} showFlag
                  loggedIn={loggedIn} followed={follows.has(c.id)} onToggle={toggle}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
