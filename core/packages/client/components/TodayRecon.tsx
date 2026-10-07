'use client';

// Landing「今日复盘」— /recon 最新录入那天的全部复盘。每次加载自动取最新一天。
// 宽屏一行四卡、≤1080px 三卡、≤900px 两卡(复用 /recon?view=grid 的 ReconCard 竖排卡,
// 但不显示打乱公式:showScrambleFallback={false},只有视频封面才出媒体区);
// 超出固定高度的部分走右侧滚动条(.scroll-panel,与「比赛中心」同一套)。点卡进 /recon/[id] 看完整回放。
// 数据:lib/recon-api getTodayRecons()(主用 /v1/recon/today,回退 /latest 单条)。
import { useEffect, useState } from 'react';
import Link from '@/components/AppLink';
import type { ReconSolve } from '@cuberoot/shared';
import { getTodayRecons } from '@/lib/recon-api';
import { ReconCard } from '@/components/ReconCard/ReconCard';
import { reconPathSeg } from '@/lib/recon-seo';
import './today_recon.css';
import './scroll_panel.css';
import { tr } from '@/i18n/tr';
import { Pin, PinOff } from 'lucide-react';

interface Props {
  lang: 'zh' | 'en';
  pinnedRecons: ReconSolve[] | null;
  pinnedOnly?: boolean;
  isAdmin: boolean;
  savingPins: ReadonlySet<number>;
  pinError: string | null;
  onPin: (solve: ReconSolve, pinned: boolean) => Promise<void>;
}

export default function TodayRecon({ lang, pinnedRecons, pinnedOnly = false, isAdmin, savingPins, pinError, onPin }: Props) {
  const isZh = lang === 'zh';
  const [recons, setRecons] = useState<ReconSolve[] | null>(null);

  // idle-defer fetch(同 RecentScrambles / OngoingComps,不阻塞首屏)
  useEffect(() => {
    if (pinnedOnly) return;
    let on = true;
    const kick = () => {
      if (!on) return;
      getTodayRecons()
        .then((list) => { if (on) setRecons(list.filter(s => s.recordType !== 'timing')); })
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
  }, [pinnedOnly]);

  const visibleRecons = pinnedOnly ? pinnedRecons : recons;
  if (pinnedOnly && !visibleRecons?.length) return null;
  if (visibleRecons === null) return <div className="today-recon today-recon--loading" aria-hidden="true" />;
  if (visibleRecons.length === 0) return null;

  return (
    <div className="today-recon">
      <div className="tr-head">
        <span className="tr-title">{pinnedOnly ? tr({ zh: '置顶复盘', en: 'Pinned recons' }) : tr({ zh: '今日复盘', en: 'Recon of the Day' })}</span>
        <Link href="/recon" prefetch={false} className="tr-all">{tr({ zh: '全部', en: 'All recons' })}</Link>
      </div>

      {isAdmin && pinError && <p role="alert">{pinError}</p>}
      <div className="tr-cards scroll-panel scroll-panel--hover-lift">
        {visibleRecons.map((s) => {
          const pinned = pinnedRecons?.some(item => item.id === s.id) ?? false;
          const label = pinned ? tr({ zh: '取消置顶', en: 'Unpin from homepage' }) : tr({ zh: '置顶到主页', en: 'Pin to homepage' });
          return (
            <div key={s.id} className={isAdmin ? 'tr-card-item tr-card-item--admin' : 'tr-card-item'}>
              <ReconCard solve={s} isZh={isZh} href={`/recon/${reconPathSeg(s)}`} showScrambleFallback={false} />
              {isAdmin && (
                <button type="button" className="tr-pin" aria-label={label} title={label}
                  aria-pressed={pinned} disabled={pinnedRecons === null || savingPins.has(s.id)}
                  onClick={() => void onPin(s, !pinned)}>
                  {pinned ? <PinOff size={16} aria-hidden="true" /> : <Pin size={16} aria-hidden="true" />}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
