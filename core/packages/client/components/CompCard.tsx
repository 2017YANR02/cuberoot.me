'use client';

// 共享比赛卡片 — 旗 + 比赛名 + 日期/城市 + 报名状态 pill + 项目图标。
// 首页「报名」tab(RegistrationComps)与 /wca/comp 卡片视图复用同一份视觉(registration_comps.css 的 .rc-* 类)。
// 纯展示组件:报名状态 pill 由调用方算好(各页里程碑口径不同)传进来,卡片本身不碰时间逻辑。
import { useMemo, type ReactNode } from 'react';
import { Users } from 'lucide-react';
import Link from '@/components/AppLink';
import { WCA_EVENT_ORDER } from '@cuberoot/shared/wca-events';
import { FollowStar } from '@/components/CompFollow';
import { compLinkProps } from '@/lib/comp-link';
import { localizeCompName } from '@/lib/comp-localize';
import { localizeCity } from '@/lib/city-localize';
import { countryName } from '@/lib/country-name';
import { toWcaEventId } from '@/lib/wca-events';
import { Flag } from '@/components/Flag';
import { CubingIcon } from '@/components/EventIcon';
import { formatDateRangeIso } from '@/lib/wca-date';
import { displayCuberName } from '@/lib/cuber-name-display';
import { personFlagIso2 } from '@/lib/country-flags';
import { tr } from '@/i18n/tr';
import './registration_comps.css';

const EVENT_RANK = new Map<string, number>(WCA_EVENT_ORDER.map((e, i) => [e, i]));

export interface CompCardComp {
  id: string;
  name: string;
  name_zh?: string | null;
  country: string;
  city?: string;
  city_zh?: string;
  start_date: string;
  end_date: string;
  events?: string[];
}

export type CompCardTone = 'open' | 'close' | 'urgent' | 'closed';
export interface CompCardPill {
  when?: string;
  word: string;
  tone: CompCardTone;
}

/** 顶尖选手芯片(卡片底部「顶尖选手」区)。events 带 wr 标注用来给项目图标上色。 */
export interface CompCardCuberEvent { id: string; wr?: 'current' | 'former' | null }
export interface CompCardCuber { id: string; name: string; events?: CompCardCuberEvent[] }

/** 报名状态彩色胶囊 — 首页「报名」tab / 「公示」tab / 比赛卡片视图共用同一视觉。
 *  纯展示:状态由调用方算好({ when, word, tone })传入。 */
export function RegPill({ pill }: { pill: CompCardPill }) {
  return (
    <span className={`rc-pill rc-pill--${pill.tone}`}>
      {pill.when && <span className="rc-when">{pill.when}</span>}
      <span className="rc-action">{pill.word}</span>
    </span>
  );
}

export interface CompCardFollow {
  followed: boolean;
  onToggle: (id: string) => void;
  loggedIn?: boolean;
  onRequireLogin?: () => void;
}

export function CompCard({ comp, isZh, lang, pill, dimmed, follow, competitorLimit, eventRounds, topCubers, children }: {
  comp: CompCardComp;
  isZh: boolean;
  lang: 'zh' | 'en';
  /** 报名状态 pill(调用方按各自里程碑口径算好);null/缺省则不渲染 pill */
  pill?: CompCardPill | null;
  /** 已截止 / 已取消等淡化样式 */
  dimmed?: boolean;
  /** 关注星(角标);缺省不渲染 */
  follow?: CompCardFollow | null;
  /** 报名人数上限(👥 N);缺省不渲染 */
  competitorLimit?: number | null;
  /** 各项目轮次数(项目 id → 轮次);传入(含空对象)即在每个项目图标下显示轮次,未知补「·」。缺省只显示图标。 */
  eventRounds?: Record<string, number> | null;
  /** 顶尖选手列表(项目 top_cubers);传入则在卡片底部渲染「顶尖选手 (N)」芯片区。person 链接是主卡链接的兄弟节点(非嵌套 a)。 */
  topCubers?: CompCardCuber[] | null;
  /** 额外区块(如单场弹窗的纪录列表),渲染在卡片内、主链接与顶尖选手之后(同样不嵌在主 a 里)。 */
  children?: ReactNode;
}) {
  const name = localizeCompName(comp.id, comp.name, isZh, { explicitNameZh: comp.name_zh ?? undefined }).replace(/\s*20\d\d\s*$/, '');
  const city = comp.city ? (isZh ? localizeCity(comp.city, true, comp.country) : comp.city) : '';
  const country = countryName(comp.country, isZh);
  const dateStr = formatDateRangeIso(comp.start_date, comp.end_date || comp.start_date).replace(/20\d\d-/g, '');
  const events = useMemo(
    () => [...new Set((comp.events ?? []).map(toWcaEventId).filter(Boolean))]
      .sort((a, b) => (EVENT_RANK.get(a) ?? 99) - (EVENT_RANK.get(b) ?? 99)),
    [comp.events],
  );

  return (
    <div className={`rc-card${dimmed ? ' is-closed' : ''}`}>
      {follow && (
        <FollowStar
          variant="corner"
          compId={comp.id}
          followed={follow.followed}
          onToggle={follow.onToggle}
          loggedIn={follow.loggedIn}
          onRequireLogin={follow.onRequireLogin}
        />
      )}
      <Link {...compLinkProps(comp.id, undefined, lang)} className="rc-main">
        <div className="rc-title">
          <Flag iso2={comp.country} spanClassName="rc-flag" imgClassName="rc-flag-img" />
          <span className="rc-name">{name}</span>
        </div>
        <div className="rc-meta">
          {pill && <RegPill pill={pill} />}
          <span className="rc-date">{dateStr}</span>
        </div>
        <div className="rc-place">
          <span>{city ? `${city}${tr({ zh: '，', en: ', ' })}${country}` : country}</span>
          {competitorLimit ? (
            <span className="rc-limit" title={tr({ zh: `报名上限 ${competitorLimit} 人`, en: `Competitor limit ${competitorLimit}` })}>
              <Users size={13} aria-hidden="true" />
              {competitorLimit}
            </span>
          ) : null}
        </div>
        {events.length > 0 && (
          <div className="rc-events">
            {events.map((eid) => (
              eventRounds ? (
                <span key={eid} className="rc-event-item">
                  <CubingIcon icon={`event-${eid}`} className="rc-event" />
                  <span className={`rc-event-rounds${eventRounds[eid] ? '' : ' rc-event-rounds--placeholder'}`}>{eventRounds[eid] || '·'}</span>
                </span>
              ) : (
                <CubingIcon key={eid} icon={`event-${eid}`} className="rc-event" />
              )
            ))}
          </div>
        )}
      </Link>
      {topCubers && topCubers.length > 0 && (
        <div className="rc-cubers">
          <div className="rc-cubers-title">{tr({ zh: `顶尖选手 (${topCubers.length})`, en: `Top cubers (${topCubers.length})` })}</div>
          <div className="rc-cuber-list">
            {topCubers.map((c) => (
              <Link key={c.id} href={`/wca/persons/${c.id}`} prefetch={false} className="rc-cuber-tag">
                <Flag iso2={personFlagIso2(c.id)} spanClassName="rc-cuber-flag" imgClassName="rc-cuber-flag-img" />
                <span>{displayCuberName(c.name, isZh)}</span>
                {c.events && c.events.length > 0 && (
                  <span className="rc-cuber-events">
                    {c.events.map((evt) => {
                      const wrClass = evt.wr === 'current' ? ' wr-current' : evt.wr === 'former' ? ' wr-former' : '';
                      return <CubingIcon key={evt.id} icon={`event-${toWcaEventId(evt.id)}`} className={wrClass.trim() || undefined} />;
                    })}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
