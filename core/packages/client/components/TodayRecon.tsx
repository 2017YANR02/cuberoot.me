'use client';

// Landing「今日复盘」— /recon 最新录入那天的全部复盘。每次加载自动取最新一天。
// 默认只显示最新一行两条预览卡(复用 /recon?view=grid 的 ReconCard);
// 当天录入多条时下方出现展开按钮,展开后逐条列出。点卡进 /recon/[id] 看完整回放。
// 数据:lib/recon-api getTodayRecons()(主用 /v1/recon/today,回退 /latest 单条)。
import { useEffect, useState } from 'react';
import Link from '@/components/AppLink';
import MoreToggle from '@/components/MoreToggle';
import type { ReconSolve } from '@cuberoot/shared';
import { getTodayRecons } from '@/lib/recon-api';
import { ReconCard } from '@/components/ReconCard/ReconCard';
import { reconPathSeg } from '@/lib/recon-seo';
import './today_recon.css';
import { tr } from '@/i18n/tr';

interface Props { lang: 'zh' | 'en' }

export default function TodayRecon({ lang }: Props) {
  const isZh = lang === 'zh';
  const [recons, setRecons] = useState<ReconSolve[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  // idle-defer fetch(同 RecentScrambles / OngoingComps,不阻塞首屏)
  useEffect(() => {
    let on = true;
    const kick = () => {
      if (!on) return;
      getTodayRecons()
        .then((list) => { if (on) setRecons(list); })
        .catch(() => { if (on) setRecons([]); });
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

  if (!recons || recons.length === 0) return null;

  // 默认显示首行两条(一行两卡);其余折进「更多」。
  const visible = expanded ? recons : recons.slice(0, 2);

  return (
    <div className="today-recon">
      <div className="tr-head">
        <span className="tr-title">{tr({ zh: '今日复盘', en: 'Recon of the Day'
        })}</span>
        <Link href="/recon" prefetch={false} className="tr-all">{tr({ zh: '全部', en: 'All recons' })}</Link>
      </div>

      <div className="tr-cards">
        {visible.map((s) => (
          <ReconCard key={s.id} solve={s} isZh={isZh} href={`/recon/${reconPathSeg(s)}`} horizontal />
        ))}
      </div>

      {recons.length > 2 && (
        <MoreToggle expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
      )}
    </div>
  );
}
