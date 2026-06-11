'use client';

// Landing「今日公示」— /v1/comp/announced 里最近 48 小时公示的 WCA 比赛(滚动窗口)。
// 卡片样式参考 /wca/comp 详情弹窗:旗 + 名 / 日期 城市 国家 人数上限 / 报名状态 / 项目图标。
// 数据:apiUrl('/v1/comp/announced')(后端后台轮询 WCA announced_at,48h 窗口)。
// 无公示 → 整块隐藏(同 TodayRecon / OngoingComps)。多条时折叠,「更多」展开。
import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { ChevronDown, Users } from 'lucide-react';
import { WCA_EVENT_ORDER } from '@cuberoot/shared/wca-events';
import { compLinkProps } from '@/lib/comp-link';
import { localizeCompName } from '@/lib/comp-localize';
import { localizeCity } from '@/lib/city-localize';
import { countryName } from '@/lib/country-name';
import { loadFlagData } from '@/lib/country-flags';
import { formatRegStatus } from '@/lib/comp-reg-status';
import { Flag } from '@/components/Flag';
import { CubingIcon } from '@/components/EventIcon';
import { formatDateRangeIso } from '@/lib/wca-date';
import { apiUrl } from '@/lib/api-base';
import { useTranslation } from 'react-i18next';
import { tr } from '@/i18n/tr';
import './today_announced.css';

interface Props { lang: 'zh' | 'en' }

interface AnnouncedComp {
  id: string;
  name: string;
  city: string;
  country: string;
  start_date: string;
  end_date: string;
  events: string[];
  competitor_limit: number | null;
  registration_open: string | null;
  registration_close: string | null;
  announced_at: string;
}

const INITIAL_SHOWN = 6;
const EVENT_RANK = new Map<string, number>(WCA_EVENT_ORDER.map((e, i) => [e, i]));

function AnnouncedCard({ comp, isZh, lang, t }: {
  comp: AnnouncedComp;
  isZh: boolean;
  lang: 'zh' | 'en';
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  const name = localizeCompName(comp.id, comp.name, isZh);
  const city = comp.city ? (isZh ? localizeCity(comp.city, true) : comp.city) : '';
  const country = countryName(comp.country, isZh);
  const dateStr = formatDateRangeIso(comp.start_date, comp.end_date);
  const reg = formatRegStatus(comp.registration_open, comp.registration_close, isZh);
  const events = useMemo(
    () => [...comp.events].sort((a, b) => (EVENT_RANK.get(a) ?? 99) - (EVENT_RANK.get(b) ?? 99)),
    [comp.events],
  );

  return (
    <Link {...compLinkProps(comp.id, undefined, lang)} className="tac-card">
      <div className="tac-title">
        <Flag iso2={comp.country} spanClassName="country-flag" imgClassName="country-flag-ct" />
        <span className="tac-name">{name}</span>
      </div>
      <div className="tac-meta">
        <span className="tac-date">{dateStr}</span>
        <span>{city ? `${city}${isZh ? '，' : ', '}${country}` : country}</span>
        {comp.competitor_limit ? (
          <span className="tac-limit" title={t('upcoming.competitorLimit', { count: comp.competitor_limit })}>
            <Users size={13} aria-hidden="true" />
            {comp.competitor_limit}
          </span>
        ) : null}
      </div>
      {reg && <div className="tac-reg">{reg}</div>}
      {events.length > 0 && (
        <div className="tac-events">
          {events.map((eid) => (
            <CubingIcon key={eid} icon={`event-${eid}`} className="tac-event" />
          ))}
        </div>
      )}
    </Link>
  );
}

export default function TodayAnnouncedComps({ lang }: Props) {
  const isZh = lang === 'zh';
  const { t } = useTranslation();
  const [comps, setComps] = useState<AnnouncedComp[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  // idle-defer fetch(同 TodayRecon / OngoingComps,不阻塞首屏)
  useEffect(() => {
    let on = true;
    const kick = () => {
      if (!on) return;
      loadFlagData().catch(() => 0); // CN 比赛中文名(非 CN 不需要)
      fetch(apiUrl('/v1/comp/announced'))
        .then((r) => (r.ok ? r.json() : { comps: [] }))
        .then((d: { comps?: AnnouncedComp[] }) => { if (on) setComps(d.comps ?? []); })
        .catch(() => { if (on) setComps([]); });
    };
    type RIC = (cb: () => void, opts?: { timeout?: number }) => number;
    const w = window as Window & { requestIdleCallback?: RIC; cancelIdleCallback?: (id: number) => void };
    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (w.requestIdleCallback) idleId = w.requestIdleCallback(kick, { timeout: 2000 });
    else timeoutId = setTimeout(kick, 200);
    return () => {
      on = false;
      if (idleId !== null) w.cancelIdleCallback?.(idleId);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, []);

  // 最近 48 小时内公示(滚动窗口,不卡日历日;服务端也是 48h 窗口,这里精确到当下)
  const recent = useMemo(() => {
    if (!comps) return [];
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    return comps.filter((c) => {
      if (!c.announced_at) return false;
      const ms = new Date(c.announced_at).getTime();
      return !Number.isNaN(ms) && ms >= cutoff;
    });
  }, [comps]);

  if (recent.length === 0) return null;

  const shown = expanded ? recent : recent.slice(0, INITIAL_SHOWN);
  const rest = recent.length - INITIAL_SHOWN;

  return (
    <div className="today-announced">
      <div className="tac-head">
        <span className="tac-head-title">{tr({ zh: '今日公示', en: 'Announced Today',
            zhHant: "今日公示"
        })}</span>
        <Link href="/wca/comp" prefetch={false} className="tac-head-all">{tr({ zh: '比赛日历', en: 'Calendar',
            zhHant: "比賽日曆"
        })}</Link>
      </div>

      <div className="tac-grid">
        {shown.map((c) => (
          <AnnouncedCard key={c.id} comp={c} isZh={isZh} lang={lang} t={t} />
        ))}
      </div>

      {rest > 0 && (
        <button
          type="button"
          className={`tac-more${expanded ? ' is-open' : ''}`}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? tr({ zh: '收起', en: 'Show less' }) : tr({ zh: '更多', en: 'More', zhHant: '更多' })}
          <ChevronDown size={15} className="tac-more-chevron" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
