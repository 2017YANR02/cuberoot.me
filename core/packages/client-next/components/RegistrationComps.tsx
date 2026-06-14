'use client';

// 「报名」— 首页 OngoingComps 的报名标签内容。全世界比赛,按下一个报名里程碑
// (开放/截止)的本地日分组:今天/明天/后天/本周内/更晚。登录用户可「盯一下」关注的
// 比赛,置顶为「已关注」组,跨设备同步(server PG comp_follows)。
// 取数 + 分组纯逻辑在 lib/comp-registration.ts;关注 API 在 lib/comp-follows.ts。
import { useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { Star, LogIn } from 'lucide-react';
import { WCA_EVENT_ORDER } from '@cuberoot/shared/wca-events';
import type { Comp } from '@/lib/comp-search';
import {
  buildRegView,
  localDayDiff,
  type RegItem,
  type RegBucketKey,
} from '@/lib/comp-registration';
import { FollowStar, type CompFollowState } from '@/components/CompFollow';
import { useAuthStore } from '@/lib/auth-store';
import { compLinkProps } from '@/lib/comp-link';
import { localizeCompName } from '@/lib/comp-localize';
import { localizeCity } from '@/lib/city-localize';
import { countryName } from '@/lib/country-name';
import { toWcaEventId } from '@/lib/wca-events';
import { Flag } from '@/components/Flag';
import { CubingIcon } from '@/components/EventIcon';
import { formatDateRangeIso } from '@/lib/wca-date';
import { tr } from '@/i18n/tr';
import './registration_comps.css';

const EVENT_RANK = new Map<string, number>(WCA_EVENT_ORDER.map((e, i) => [e, i]));

// ── 文案 ────────────────────────────────────────────────────────────────────
function pad2(n: number): string { return n < 10 ? `0${n}` : `${n}`; }
function clockOf(at: number): string { const d = new Date(at); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function mdOf(at: number): string { const d = new Date(at); return `${d.getMonth() + 1}-${d.getDate()}`; }
const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六'];
const WEEKDAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function weekdayOf(at: number, isZh: boolean): string {
  const d = new Date(at).getDay();
  return isZh ? `周${WEEKDAY_ZH[d]}` : WEEKDAY_EN[d];
}

function bucketLabel(key: RegBucketKey): string {
  switch (key) {
    case 'today': return tr({ zh: '今天', en: 'Today', zhHant: '今天' });
    case 'tomorrow': return tr({ zh: '明天', en: 'Tomorrow', zhHant: '明天' });
    case 'dayAfter': return tr({ zh: '后天', en: 'In 2 days', zhHant: '後天' });
    case 'soon': return tr({ zh: '本周内', en: 'This week', zhHant: '本週內' });
    case 'later': return tr({ zh: '更晚', en: 'Later', zhHant: '更晚' });
  }
}

function actionWord(kind: RegItem['kind']): string {
  if (kind === 'closed') return tr({ zh: '报名已截止', en: 'Closed', zhHant: '報名已截止' });
  if (kind === 'open') return tr({ zh: '开放', en: 'Opens', zhHant: '開放' });
  return tr({ zh: '截止', en: 'Closes', zhHant: '截止' });
}

/** 里程碑的「何时」标签。day 模式:日分组里靠组标题,只补时间细节;followed 模式:无组标题,带相对日。 */
function whenLabel(item: RegItem, now: number, isZh: boolean, mode: 'day' | 'followed'): string {
  if (item.kind === 'closed') return '';
  const diff = localDayDiff(item.at, now);
  if (mode === 'day') {
    if (diff <= 2) return clockOf(item.at);   // 组标题已说今天/明天/后天
    if (diff <= 6) return weekdayOf(item.at, isZh);
    return mdOf(item.at);
  }
  if (diff <= 0) return `${tr({ zh: '今天', en: 'Today', zhHant: '今天' })} ${clockOf(item.at)}`;
  if (diff === 1) return tr({ zh: '明天', en: 'Tomorrow', zhHant: '明天' });
  if (diff === 2) return tr({ zh: '后天', en: 'In 2 days', zhHant: '後天' });
  if (diff <= 6) return weekdayOf(item.at, isZh);
  return mdOf(item.at);
}

/** 报名状态 pill 的色调:已截止灰;开放 accent;截止默认 amber,24h 内 urgent(红)。 */
function pillTone(item: RegItem, now: number): 'closed' | 'open' | 'close' | 'urgent' {
  if (item.kind === 'closed') return 'closed';
  if (item.kind === 'open') return 'open';
  return item.at - now <= 86_400_000 ? 'urgent' : 'close';
}

// ── 卡片 ────────────────────────────────────────────────────────────────────
function RegistrationCard({ item, isZh, lang, now, mode, followed, onToggle, showFollow }: {
  item: RegItem;
  isZh: boolean;
  lang: 'zh' | 'en';
  now: number;
  mode: 'day' | 'followed';
  followed: boolean;
  onToggle: (id: string) => void;
  showFollow: boolean;
}) {
  const c = item.comp;
  const name = localizeCompName(c.id, c.name, isZh).replace(/\s*20\d\d\s*$/, '');
  const city = c.city ? (isZh ? localizeCity(c.city, true) : c.city) : '';
  const country = countryName(c.country, isZh);
  const dateStr = formatDateRangeIso(c.start_date, c.end_date).replace(/20\d\d-/g, '');
  const when = whenLabel(item, now, isZh, mode);
  const tone = pillTone(item, now);
  const action = actionWord(item.kind);
  const events = useMemo(
    () => [...new Set((c.events ?? []).map(toWcaEventId).filter(Boolean))]
      .sort((a, b) => (EVENT_RANK.get(a) ?? 99) - (EVENT_RANK.get(b) ?? 99)),
    [c.events],
  );

  return (
    <div className={`rc-card${item.kind === 'closed' ? ' is-closed' : ''}`}>
      {showFollow && (
        <FollowStar variant="corner" compId={c.id} followed={followed} onToggle={onToggle} />
      )}
      <Link {...compLinkProps(c.id, undefined, lang)} className="rc-main">
        <div className="rc-title">
          <Flag iso2={c.country} spanClassName="rc-flag" imgClassName="rc-flag-img" />
          <span className="rc-name">{name}</span>
        </div>
        <div className="rc-meta">
          <span className="rc-date">{dateStr}</span>
          <span>{city ? `${city}${isZh ? '，' : ', '}${country}` : country}</span>
        </div>
        <span className={`rc-pill rc-pill--${tone}`}>
          {when && <span className="rc-when">{when}</span>}
          <span className="rc-action">{action}</span>
        </span>
        {events.length > 0 && (
          <div className="rc-events">
            {events.map((eid) => (
              <CubingIcon key={eid} icon={`event-${eid}`} className="rc-event" />
            ))}
          </div>
        )}
      </Link>
    </div>
  );
}

// ── 视图 ────────────────────────────────────────────────────────────────────
export function RegistrationView({ comps, isZh, lang, loggedIn, follows, toggle }: {
  comps: Comp[];
  isZh: boolean;
  lang: 'zh' | 'en';
} & Pick<CompFollowState, 'loggedIn' | 'follows' | 'toggle'>) {
  const login = useAuthStore((s) => s.login);
  // now 在组件生命周期内固定,避免 useMemo 依赖每帧抖动(首页不会开几小时)。
  const [now] = useState(() => Date.now());
  const view = useMemo(() => buildRegView(comps, now, follows), [comps, now, follows]);

  return (
    <div className="reg-comps">
      {loggedIn && view.followed.length > 0 && (
        <section className="reg-group">
          <h3 className="reg-group-head reg-group-head--fav">
            <Star size={13} fill="currentColor" aria-hidden="true" />
            {tr({ zh: '已关注', en: 'Following', zhHant: '已關注' })}
          </h3>
          <div className="reg-cards">
            {view.followed.map((it) => (
              <RegistrationCard
                key={`f-${it.comp.id}`} item={it} isZh={isZh} lang={lang} now={now}
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
                key={`${b.key}-${it.comp.id}`} item={it} isZh={isZh} lang={lang} now={now}
                mode="day" followed={false} onToggle={toggle} showFollow={loggedIn}
              />
            ))}
          </div>
        </section>
      ))}

      {!loggedIn && view.buckets.length > 0 && (
        <button type="button" className="reg-login-hint" onClick={login}>
          <LogIn size={13} aria-hidden="true" />
          {tr({ zh: '登录后可盯住想报的比赛', en: 'Sign in to follow competitions', zhHant: '登入後可盯住想報的比賽' })}
        </button>
      )}
    </div>
  );
}
