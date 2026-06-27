'use client';

// 「公示」— 最近 48 小时公示的 WCA 比赛(数据 hook + 卡片)。用于首页 OngoingComps 的「公示」tab。
// 卡片样式参考 /wca/comp 详情弹窗:旗 + 名 / 日期 城市 国家 人数上限 / 报名状态 / 项目图标。
// 数据:apiUrl('/v1/comp/announced')(后端后台轮询 WCA announced_at,48h 窗口)。
import { useEffect, useMemo, useState } from 'react';
import { loadFlagData } from '@/lib/country-flags';
import { regStatusPill } from '@/lib/comp-reg-status';
import { CompCard } from '@/components/CompCard';
import { fetchCompRounds } from '@/lib/comp-wcif';
import { apiUrl } from '@/lib/api-base';

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
  name_zh?: string | null;
}

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

export function AnnouncedCard({ comp, isZh, lang, loggedIn = false, followed = false, onToggle }: {
  comp: AnnouncedComp;
  isZh: boolean;
  lang: 'zh' | 'en';
  loggedIn?: boolean;
  followed?: boolean;
  onToggle?: (id: string) => void;
}) {
  // 报名状态彩色胶囊(复用「报名」tab 视觉)。48h 公示窗口必为当年,when 去掉年份只留月日时刻
  // (CompCard 内部已对比赛日期 + 比赛名尾部年份做同样剥离)。
  const reg0 = regStatusPill(comp.registration_open, comp.registration_close);
  const reg = reg0 ? { ...reg0, when: reg0.when ? reg0.when.replace(/20\d\d-/g, '') : reg0.when } : null;
  // 每个项目的轮次数走 WCIF 懒拉(公示比赛后端只给 event_ids,无轮次)。fetchCompRounds 自带
  // 24h localStorage 缓存 + inflight 去重;仅当「公示」tab 展示这些卡片时才会跑。
  // 空对象({})也传给 CompCard,使其在轮次到达前先用「·」占位(区别于报名/卡片视图的纯图标)。
  const [rounds, setRounds] = useState<Record<string, number>>({});
  useEffect(() => {
    let cancelled = false;
    fetchCompRounds(comp.id).then((wcifRounds) => {
      if (cancelled) return;
      const mapped: Record<string, number> = {};
      for (const [eid, formats] of Object.entries(wcifRounds)) mapped[eid] = formats.length;
      setRounds(mapped);
    }).catch(() => { /* WCIF 缺失 → 不显示轮次,降级为纯图标 */ });
    return () => { cancelled = true; };
  }, [comp.id]);

  return (
    <CompCard
      comp={comp}
      isZh={isZh}
      lang={lang}
      pill={reg}
      competitorLimit={comp.competitor_limit}
      eventRounds={rounds}
      follow={loggedIn && onToggle ? { followed, onToggle } : null}
    />
  );
}
