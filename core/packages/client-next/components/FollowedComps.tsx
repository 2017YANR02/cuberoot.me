'use client';

// 「我关注的比赛」— 个人主页 /person/[wcaId] 上展示当前登录用户星标(盯一下)的比赛。
// 仅在「看自己的主页」时出现(登录 wca_id == 页面 wca_id);看别人的主页不显示,也取不到别人的关注。
// 关注集合走 useCompFollows(server PG comp_follows);比赛详情用 loadComps()(全球 upcoming + 近 30 天)
// join 出来。不在该集合里的(更久远的已结束比赛)降级成纯链接行。SSG 页用 mounted 门控避免 hydration 错配。
import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { Star } from 'lucide-react';
import { loadComps, type Comp } from '@/lib/comp-search';
import { compLinkProps } from '@/lib/comp-link';
import { localizeCompName } from '@/lib/comp-localize';
import { localizeCity } from '@/lib/city-localize';
import { countryName } from '@/lib/country-name';
import { formatRegStatus } from '@/lib/comp-reg-status';
import { Flag } from '@/components/Flag';
import { FollowStar, useCompFollows } from '@/components/CompFollow';
import { useAuthStore } from '@/lib/auth-store';
import { apiUrl } from '@/lib/api-base';
import { formatDateRangeIso, toIsoDate } from '@/lib/wca-date';
import { tr } from '@/i18n/tr';
import './followed_comps.css';

// 刚公示、还没进每日重生成的 all_upcoming JSON 的比赛只在实时 announced 端点里,
// 并进来才能 join 出中文名 + 国旗(否则落「其他」只剩裸 id)。
interface AnnouncedLite {
  id: string;
  name: string;
  city?: string;
  country: string;
  start_date: string;
  end_date: string;
  events?: string[];
  competitor_limit?: number | null;
  registration_open?: string | null;
  registration_close?: string | null;
  name_zh?: string | null;
}

function CompRow({ comp, nameZh, isZh, lang, onToggle, ended }: {
  comp: Comp;
  nameZh?: string;
  isZh: boolean;
  lang: 'zh' | 'en';
  onToggle: (id: string) => void;
  ended: boolean;
}) {
  const name = localizeCompName(comp.id, comp.name, isZh, { explicitNameZh: nameZh });
  const city = comp.city ? (isZh ? localizeCity(comp.city, true) : comp.city) : '';
  const country = countryName(comp.country, isZh);
  const dateStr = formatDateRangeIso(comp.start_date, comp.end_date);
  const reg = ended ? null : formatRegStatus(comp.registration_open, comp.registration_close, isZh);

  return (
    <div className="fc-item">
      <Link {...compLinkProps(comp.id, undefined, lang)} className="fc-row">
        <Flag iso2={(comp.country || '').toLowerCase()} className="fc-flag" />
        <div className="fc-body">
          <div className="fc-name">{name}</div>
          <div className="fc-meta">
            <span className="fc-date">{dateStr}</span>
            <span>{city ? `${city}${isZh ? '，' : ', '}${country}` : country}</span>
            {reg && <span className="fc-reg">{reg}</span>}
          </div>
        </div>
      </Link>
      <FollowStar variant="chip" compId={comp.id} followed onToggle={onToggle} />
    </div>
  );
}

export default function FollowedComps({ wcaId, isZh, lang }: {
  wcaId: string;
  isZh: boolean;
  lang: 'zh' | 'en';
}) {
  const user = useAuthStore((s) => s.user);
  const { follows, toggle, loaded } = useCompFollows();
  const [mounted, setMounted] = useState(false);
  const [comps, setComps] = useState<Comp[] | null>(null);
  const [nameZhById, setNameZhById] = useState<Map<string, string>>(() => new Map());

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    let on = true;
    // loadComps(静态 past+upcoming) ∪ 实时 announced(48h 窗口,补刚公示还没进静态 JSON 的)。
    Promise.all([
      loadComps().catch(() => [] as Comp[]),
      fetch(apiUrl('/v1/comp/announced'))
        .then((r) => (r.ok ? r.json() : { comps: [] }))
        .then((d: { comps?: AnnouncedLite[] }) => d.comps ?? [])
        .catch(() => [] as AnnouncedLite[]),
    ]).then(([base, ann]) => {
      if (!on) return;
      const map = new Map<string, Comp>();
      for (const c of base) map.set(c.id, c);
      const zh = new Map<string, string>();
      for (const a of ann) {
        if (a.name_zh) zh.set(a.id, a.name_zh);
        if (!map.has(a.id)) {
          map.set(a.id, {
            id: a.id, name: a.name, city: a.city, country: a.country,
            start_date: a.start_date, end_date: a.end_date, events: a.events,
            registration_open: a.registration_open, registration_close: a.registration_close,
            competitor_limit: a.competitor_limit ?? undefined,
          });
        }
      }
      setComps([...map.values()]);
      setNameZhById(zh);
    });
    return () => { on = false; };
  }, []);

  const { upcoming, past, unknownIds } = useMemo(() => {
    const map = new Map((comps ?? []).map((c) => [c.id, c]));
    const today = toIsoDate(new Date());
    const up: Comp[] = [];
    const pa: Comp[] = [];
    const unk: string[] = [];
    for (const id of follows) {
      const c = map.get(id);
      if (!c) { unk.push(id); continue; }
      const end = c.end_date || c.start_date;
      if (end >= today) up.push(c); else pa.push(c);
    }
    up.sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id.localeCompare(b.id));
    pa.sort((a, b) => (b.end_date || b.start_date).localeCompare(a.end_date || a.start_date) || a.id.localeCompare(b.id));
    return { upcoming: up, past: pa, unknownIds: unk };
  }, [comps, follows]);

  // 仅在「看自己的主页」时出现;SSG 页等 mounted 再判定,避免 hydration 错配。
  const isSelf = mounted && !!user && user.wcaId === wcaId;
  if (!isSelf) return null;
  if (!loaded || comps === null) return null; // 关注集合 / 比赛数据还没回来,先不闪空态

  return (
    <section className="fc-section">
      <h2 className="fc-head">
        <Star size={16} fill="currentColor" aria-hidden="true" />
        {tr({ zh: '我关注的比赛', en: 'Competitions I follow',
            zhHant: "我關注的比賽"
        })}
      </h2>

      {follows.size === 0 ? (
        <p className="fc-empty">
          {tr({ zh: '还没有关注的比赛。去首页的比赛列表点 ☆ 盯一下。', en: 'No followed competitions yet. Tap ☆ on a competition on the home page to follow it.',
              zhHant: "還沒有關注的比賽。去首頁的比賽列表點 ☆ 盯一下。"
        })}
        </p>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="fc-group">
              <h3 className="fc-group-head">{tr({ zh: '即将与进行中', en: 'Upcoming & ongoing',
                  zhHant: "即將與進行中"
            })}</h3>
              <div className="fc-list">
                {upcoming.map((c) => (
                  <CompRow key={c.id} comp={c} nameZh={nameZhById.get(c.id)} isZh={isZh} lang={lang} onToggle={toggle} ended={false} />
                ))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div className="fc-group">
              <h3 className="fc-group-head">{tr({ zh: '已结束', en: 'Finished',
                  zhHant: "已結束"
            })}</h3>
              <div className="fc-list">
                {past.map((c) => (
                  <CompRow key={c.id} comp={c} nameZh={nameZhById.get(c.id)} isZh={isZh} lang={lang} onToggle={toggle} ended />
                ))}
              </div>
            </div>
          )}

          {unknownIds.length > 0 && (
            <div className="fc-group">
              <h3 className="fc-group-head">{tr({ zh: '其他', en: 'Other' })}</h3>
              <div className="fc-list">
                {unknownIds.map((id) => (
                  <div className="fc-item" key={id}>
                    <Link {...compLinkProps(id, undefined, lang)} className="fc-row">
                      <div className="fc-body"><div className="fc-name">{id}</div></div>
                    </Link>
                    <FollowStar variant="chip" compId={id} followed onToggle={toggle} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
