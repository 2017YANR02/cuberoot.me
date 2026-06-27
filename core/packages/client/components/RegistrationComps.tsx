'use client';

// 「报名」— 首页 OngoingComps 的报名标签内容。全世界比赛,按下一个报名里程碑
// (开放/截止)的本地日分组:今天/明天/后天/本周内/更晚。登录用户可「盯一下」关注的
// 比赛,置顶为「已关注」组,跨设备同步(server PG comp_follows)。
// 取数 + 分组纯逻辑在 lib/comp-registration.ts;关注 API 在 lib/comp-follows.ts。
import { useMemo, useState } from 'react';
import { Star, LogIn } from 'lucide-react';
import type { Comp } from '@/lib/comp-search';
import {
  buildRegView,
  localDayDiff,
  type RegItem,
  type RegBucketKey,
} from '@/lib/comp-registration';
import { type CompFollowState } from '@/components/CompFollow';
import { useAuthStore } from '@/lib/auth-store';
import { CompCard, type CompCardTone } from '@/components/CompCard';
import { tr } from '@/i18n/tr';
import './registration_comps.css';

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
    case 'today': return tr({ zh: '今天', en: 'Today' });
    case 'tomorrow': return tr({ zh: '明天', en: 'Tomorrow' });
    case 'dayAfter': return tr({ zh: '后天', en: 'In 2 days' });
    case 'soon': return tr({ zh: '本周内', en: 'This week' });
    case 'later': return tr({ zh: '更晚', en: 'Later' });
  }
}

function actionWord(kind: RegItem['kind']): string {
  if (kind === 'closed') return tr({ zh: '报名已截止', en: 'Closed' });
  if (kind === 'open') return tr({ zh: '开放', en: 'Opens' });
  return tr({ zh: '截止', en: 'Closes' });
}

/** 里程碑的「何时」标签,始终带本地时区时刻(new Date 本地化,即用户所在时区)。
 *  day 模式:日分组里靠组标题,近三天只补时刻,再远补星期/日期 + 时刻;
 *  followed 模式:无组标题,带相对日 + 时刻。 */
function whenLabel(item: RegItem, now: number, isZh: boolean, mode: 'day' | 'followed'): string {
  if (item.kind === 'closed') return '';
  const diff = localDayDiff(item.at, now);
  const clock = clockOf(item.at);
  if (mode === 'day') {
    if (diff <= 2) return clock;   // 组标题已说今天/明天/后天
    if (diff <= 6) return `${weekdayOf(item.at, isZh)} ${clock}`;
    return `${mdOf(item.at)} ${clock}`;
  }
  let day: string;
  if (diff <= 0) day = tr({ zh: '今天', en: 'Today' });
  else if (diff === 1) day = tr({ zh: '明天', en: 'Tomorrow' });
  else if (diff === 2) day = tr({ zh: '后天', en: 'In 2 days' });
  else if (diff <= 6) day = weekdayOf(item.at, isZh);
  else day = mdOf(item.at);
  return `${day} ${clock}`;
}

/** 报名状态 pill 的色调:已截止灰;开放 accent;截止默认 amber,24h 内 urgent(红)。 */
function pillTone(item: RegItem, now: number): CompCardTone {
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
  return (
    <CompCard
      comp={item.comp}
      isZh={isZh}
      lang={lang}
      pill={{ when: whenLabel(item, now, isZh, mode), word: actionWord(item.kind), tone: pillTone(item, now) }}
      dimmed={item.kind === 'closed'}
      follow={showFollow ? { followed, onToggle } : null}
    />
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
            {tr({ zh: '已关注', en: 'Following' })}
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
          {tr({ zh: '登录后可盯住想报的比赛', en: 'Sign in to follow competitions' })}
        </button>
      )}
    </div>
  );
}
