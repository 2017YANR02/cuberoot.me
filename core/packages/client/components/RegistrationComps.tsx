'use client';

// 「报名」— 按国家筛选，显示当前报名状态及按用户本地日分组的下一个里程碑。
// 登录用户可「盯一下」关注的
// 比赛,置顶为「已关注」组,跨设备同步(server PG comp_follows)。
// 取数 + 分组纯逻辑在 lib/comp-registration.ts;关注 API 在 lib/comp-follows.ts。
import { useEffect, useMemo, useState } from 'react';
import { Star, LogIn, Clock3, Globe } from '@app-foundation/icons/lucide';
import type { Comp } from '@/lib/comp-search';
import {
  buildRegView,
  localDayDiff,
  type RegItem,
  type RegBucketKey,
  type CubingRegistrations,
} from '@/lib/comp-registration';
import { type CompFollowState } from '@/components/CompFollow';
import { authActions, useAuthUser } from '@/lib/auth-store';
import { type CompCardTone } from '@/components/CompCard';
import { CompCardWithRounds, wcaRoundsSeed } from '@/components/CompCardWithRounds';
import { tr } from '@/i18n/tr';
import { useRetainedState } from '@/hooks/useRetainedState';
import { apiUrl } from '@/lib/api-base';
import { loadFlagData, personFlagIso2, countryToIso2 } from '@/lib/country-flags';
import { countryName } from '@/lib/country-name';
import { ListSelect } from '@/components/ListSelect';
import { Flag } from '@/components/Flag';
import { zoneSelectItems, zoneLabel } from '@/lib/tz-zones';
import { localZone, wallPartsIn, timeKey } from '@cuberoot/shared/tz';
import './registration_comps.css';

// ── 文案 ────────────────────────────────────────────────────────────────────
function clockOf(at: number, tz: string): string { return timeKey(wallPartsIn(tz, new Date(at))); }
function mdOf(at: number, tz: string): string { const d = wallPartsIn(tz, new Date(at)); return d.mo + '-' + d.d; }
function weekdayOf(at: number, isZh: boolean, tz: string): string {
  return new Intl.DateTimeFormat(isZh ? 'zh-CN' : 'en-US', { timeZone: tz, weekday: 'short' }).format(at);
}

function bucketLabel(key: RegBucketKey): string {
  switch (key) {
    case 'today': return tr({ zh: '今天', en: 'Today' });
    case 'tomorrow': return tr({ zh: '明天', en: 'Tomorrow' });
    case 'dayAfter': return tr({ zh: '后天', en: 'In 2 days' });
    case 'soon': return tr({ zh: '未来 7 天', en: 'Next 7 days' });
    case 'later': return tr({ zh: '更晚', en: 'Later' });
    case 'closed': return tr({ zh: '报名结束', en: 'Registration closed' });
    case 'unknown': return tr({ zh: '报名待定', en: 'Registration pending' });
  }
}

function actionWord(kind: RegItem['kind']): string {
  if (kind === 'closed' || kind === 'unknown') return '';
  if (kind === 'reopen') return tr({ zh: '重开', en: 'Reopens' });
  if (kind === 'open') return tr({ zh: '开放', en: 'Opens' });
  return tr({ zh: '截止', en: 'Closes' });
}

/** 里程碑的「何时」标签，使用所选显示时区。
 *  day 模式:日分组里靠组标题,近三天只补时刻,再远补星期/日期 + 时刻;
 *  followed 模式:无组标题,带相对日 + 时刻。 */
function whenLabel(item: RegItem, now: number, isZh: boolean, mode: 'day' | 'followed', tz: string): string {
  if (item.kind === 'closed' || item.kind === 'unknown') return '';
  const diff = localDayDiff(item.at, now, tz);
  const clock = clockOf(item.at, tz);
  if (mode === 'day') {
    if (diff <= 2) return clock;   // 组标题已说今天/明天/后天
    if (diff <= 6) return `${weekdayOf(item.at, isZh, tz)} ${clock}`;
    return `${mdOf(item.at, tz)} ${clock}`;
  }
  let day: string;
  if (diff <= 0) day = tr({ zh: '今天', en: 'Today' });
  else if (diff === 1) day = tr({ zh: '明天', en: 'Tomorrow' });
  else if (diff === 2) day = tr({ zh: '后天', en: 'In 2 days' });
  else if (diff <= 6) day = weekdayOf(item.at, isZh, tz);
  else day = mdOf(item.at, tz);
  return `${day} ${clock}`;
}

const STATUS_LABELS = {
  upcoming: { zh: '尚未开放', en: 'Not yet open' },
  open: { zh: '报名中', en: 'Registration open' },
  reopened: { zh: '重开报名中', en: 'Registration reopened' },
  paused: { zh: '报名暂停', en: 'Registration paused' },
  closed: { zh: '报名结束', en: 'Registration closed' },
  unknown: { zh: '状态待确认', en: 'Status unconfirmed' },
};
function pillTone(item: RegItem): CompCardTone {
  return { upcoming: 'upcoming', open: 'open', reopened: 'reopened', paused: 'close', closed: 'closed', unknown: 'closed' }[item.status] as CompCardTone;
}

// ── 卡片 ────────────────────────────────────────────────────────────────────
function RegistrationCard({ item, isZh, lang, now, mode, tz, followed, onToggle, showFollow }: {
  item: RegItem;
  isZh: boolean;
  lang: 'zh' | 'en';
  now: number;
  mode: 'day' | 'followed';
  tz: string;
  followed: boolean;
  onToggle: (id: string) => void;
  showFollow: boolean;
}) {
  return (
    <CompCardWithRounds
      comp={item.comp}
      isZh={isZh}
      lang={lang}
      pill={{ word: tr(STATUS_LABELS[item.status]), tone: pillTone(item) }}
      follow={showFollow ? { followed, onToggle } : null}
      roundsSeed={wcaRoundsSeed(item.comp.rounds)}
      registrationTiming={{
        label: item.kind === 'closed' || item.kind === 'unknown' ? '' : `${whenLabel(item, now, isZh, mode, tz)} ${actionWord(item.kind)}`,
        urgent: item.kind === 'close' && item.at - now <= 86_400_000,
      }}
    />
  );
}

// ── 视图 ────────────────────────────────────────────────────────────────────
export function RegistrationView({ comps, isZh, lang, loggedIn, follows, toggle }: {
  comps: Comp[];
  isZh: boolean;
  lang: 'zh' | 'en';
} & Pick<CompFollowState, 'loggedIn' | 'follows' | 'toggle'>) {
  const login = authActions.login;
  const user = useAuthUser();
  const owner = user ? String(user.uid ?? user.wcaId) : '';
  const [choice, setChoice] = useRetainedState<{ owner: string; country: string } | null>('home:registration-country', null);
  const [flagVersion, setFlagVersion] = useState(0);
  const [now, setNow] = useState(0);
  const [zone, setZone] = useRetainedState('home:registration-timezone', '');
  const [deviceZone, setDeviceZone] = useState('UTC');
  useEffect(() => setDeviceZone(localZone()), []);
  const tz = zone || deviceZone;
  const zoneDay = Math.floor(now / 86400_000);
  const zoneItems = useMemo(() => [{ value: '', label: tr({ zh: '时区', en: 'Time zone' }) }, ...zoneSelectItems(isZh, new Date(zoneDay * 86400_000))], [isZh, zoneDay]);
  const [cn, setCn] = useState<CubingRegistrations>({});
  const [sourceFailed, setSourceFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void loadFlagData({ persons: !!user?.wcaId }).then(v => { if (active) setFlagVersion(v); }).catch(() => {});
    return () => { active = false; };
  }, [user?.wcaId]);
  const defaultCountry = useMemo(() => user?.country
    ? countryToIso2(user.country) || user.country.toLowerCase()
    : user?.wcaId ? countryToIso2(personFlagIso2(user.wcaId)) : '', [user, flagVersion]);
  const country = choice?.owner === owner ? choice.country : defaultCountry;
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 30_000);
    window.addEventListener('focus', tick);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', tick); };
  }, []);
  useEffect(() => {
    if (!comps.some(c => c.country.toLowerCase() === 'cn')) return;
    let active = true;
    let pending = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const res = await fetch(apiUrl('/v1/cubing-registration?v=1'), { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
        if (!res.ok) throw new Error('registration source');
        const data = await res.json() as { registrations: CubingRegistrations };
        if (!data.registrations || typeof data.registrations !== 'object') throw new Error('registration data');
        if (active) { setCn(data.registrations); setSourceFailed(false); }
      } catch {
        if (active) { setCn({}); setSourceFailed(true); }
      } finally { pending = false; }
    };
    void refresh();
    const timer = window.setInterval(refresh, 120_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; controller.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [comps]);
  const countries = useMemo(() => [...new Set([...comps.map(c => c.country.toLowerCase()), defaultCountry].filter(Boolean))]
    .sort((a, b) => countryName(a, isZh).localeCompare(countryName(b, isZh), lang)), [comps, defaultCountry, isZh, lang]);
  const filtered = useMemo(() => country ? comps.filter(c => c.country.toLowerCase() === country) : comps, [comps, country]);
  const view = useMemo(() => buildRegView(filtered, now, follows, cn, tz), [filtered, now, follows, cn, tz]);
  const allLabel = tr({ zh: '全部国家', en: 'All countries' });

  return (
    <div className="reg-comps">
      <div className="reg-toolbar">
        <ListSelect
          portal searchable showArrow={false} maxVisible={50} className="reg-filter"
          searchPlaceholder={tr({ zh: '搜索国家', en: 'Search countries' })}
          ariaLabel={tr({ zh: '国家筛选', en: 'Filter by country' })}
          allLabel={allLabel}
          selectedLabel={<span className="reg-filter-label">{country ? <Flag iso2={country} className="rc-flag" /> : <Globe size={15} aria-hidden="true" />}<span>{country ? countryName(country, isZh) : allLabel}</span></span>}
          value={country}
          items={[{ value: '', label: allLabel }, ...countries.map(iso2 => ({ value: iso2, label: countryName(iso2, isZh), country: iso2, searchTerms: [iso2, countryName(iso2, true), countryName(iso2, false)].join(' ') }))]}
          onChange={value => setChoice({ owner, country: value })}
        />
        <ListSelect className="reg-filter reg-zone-filter" showArrow={false} maxVisible={50} selectedLabel={<span className="reg-filter-label"><Clock3 size={15} aria-hidden="true" /><span>{zoneLabel(tz, isZh)}</span></span>} searchPlaceholder={tr({ zh: '搜索时区', en: 'Search time zones' })} items={zoneItems} value={zone} onChange={setZone} allLabel={tr({ zh: '时区', en: 'Time zone' })} searchable portal ariaLabel={tr({ zh: '时区', en: 'Time zone' })} />
      </div>
      {sourceFailed && (!country || country === 'cn') && <p className="reg-source-note" role="status">{tr({ zh: '粗饼报名状态暂不可用', en: 'Cubing China registration status is unavailable' })}</p>}
      {now > 0 && view.total === 0 && <p className="reg-source-note">{tr({ zh: '暂无符合条件的比赛', en: 'No matching competitions' })}</p>}
      {loggedIn && view.followed.length > 0 && (
        <section className="reg-group">
          <h3 className="reg-group-head reg-group-head--fav">
            <Star size={13} fill="currentColor" aria-hidden="true" />
            {tr({ zh: '已关注', en: 'Following' })}
          </h3>
          <div className="reg-cards">
            {view.followed.map((it) => (
              <RegistrationCard
                key={`f-${it.comp.id}`} item={it} isZh={isZh} lang={lang} now={now} tz={tz}
                mode="followed" followed onToggle={toggle} showFollow
              />
            ))}
          </div>
        </section>
      )}

      {view.buckets.map((b) => (
        <section className="reg-group" key={b.key}>
          <h3 className="reg-group-head">{bucketLabel(b.key)}</h3>
          <div className="reg-cards">
            {b.items.map((it) => (
              <RegistrationCard
                key={`${b.key}-${it.comp.id}`} item={it} isZh={isZh} lang={lang} now={now} tz={tz}
                mode="day" followed={false} onToggle={toggle} showFollow={loggedIn}
              />
            ))}
          </div>
        </section>
      ))}

      {!loggedIn && view.buckets.length > 0 && (
        <button type="button" className="reg-login-hint" onClick={login}>
          <LogIn size={13} aria-hidden="true" />
          {tr({ zh: '登录后可盯住想报的比赛', en: 'Sign in to follow competitions' })}
        </button>
      )}
    </div>
  );
}
