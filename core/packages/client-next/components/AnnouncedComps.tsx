'use client';

// 「公示」— 最近 48 小时公示的 WCA 比赛(数据 hook + 卡片)。用于首页 OngoingComps 的「公示」tab。
// 卡片样式参考 /wca/comp 详情弹窗:旗 + 名 / 日期 城市 国家 人数上限 / 报名状态 / 项目图标。
// 数据:apiUrl('/v1/comp/announced')(后端后台轮询 WCA announced_at,48h 窗口)。
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { WCA_EVENT_ORDER } from '@cuberoot/shared/wca-events';
import { Users } from 'lucide-react';
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
import './announced_comps.css';

export interface AnnouncedComp {
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

const EVENT_RANK = new Map<string, number>(WCA_EVENT_ORDER.map((e, i) => [e, i]));

// 最近 48 小时公示(滚动窗口,服务端亦 48h 窗口)。加载中返回 null,无数据返回 []。
// idle-defer fetch(同 TodayRecon / OngoingComps,不阻塞首屏)。
export function useAnnouncedComps(): AnnouncedComp[] | null {
  const [comps, setComps] = useState<AnnouncedComp[] | null>(null);

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

  return useMemo(() => {
    if (!comps) return null;
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    return comps.filter((c) => {
      if (!c.announced_at) return false;
      const ms = new Date(c.announced_at).getTime();
      return !Number.isNaN(ms) && ms >= cutoff;
    });
  }, [comps]);
}

export function AnnouncedCard({ comp, isZh, lang }: {
  comp: AnnouncedComp;
  isZh: boolean;
  lang: 'zh' | 'en';
}) {
  const { t } = useTranslation();
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
