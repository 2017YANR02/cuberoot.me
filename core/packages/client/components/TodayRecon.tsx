'use client';

import { useRetainedState } from '@/hooks/useRetainedState';
import { useContentRefreshKey } from '@/hooks/useContentRefreshKey';

// Landing「今日复盘」— /recon 最新录入那天的全部复盘。每次加载自动取最新一天。
// 宽屏一行四卡、≤1080px 三卡、≤900px 两卡(复用 /recon?view=grid 的 ReconCard 竖排卡,
// 但不显示打乱公式:showScrambleFallback={false},只有视频封面才出媒体区);
// 从第三行起使用右侧滚动条(.scroll-panel,与「比赛中心」同一套)。点卡进 /recon/[id] 看完整回放。
// 数据:lib/recon-api getTodayRecons()(主用 /v1/recon/today,回退 /latest 单条)。
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import Link from '@/components/AppLink';
import { ArrowRight } from 'lucide-react';
import type { ReconSolve } from '@cuberoot/shared';
import { getTodayRecons } from '@/lib/recon-api';
import { CuratedReconCard } from '@/components/ReconCard/CuratedReconCard';
import { reconPathSeg } from '@/lib/recon-seo';
import './today_recon.css';
import './scroll_panel.css';
import { tr } from '@/i18n/tr';

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
  const refreshKey = useContentRefreshKey(!pinnedOnly);
  const [recons, setRecons] = useRetainedState<ReconSolve[] | null>('home:todayRecons', null);
  const cardsRef = useRef<HTMLDivElement>(null);

  // idle-defer fetch(同 RecentScrambles / OngoingComps,不阻塞首屏)
  useEffect(() => {
    if (pinnedOnly) return;
    let on = true;
    const kick = () => {
      if (!on) return;
      getTodayRecons()
        .then((list) => { if (on) setRecons(list.filter(s => s.recordType !== 'timing')); })
        .catch(() => { if (on) setRecons(previous => previous ?? []); });
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
  }, [pinnedOnly, refreshKey, setRecons]);

  const pinnedIds = useMemo(() => new Set(pinnedRecons?.map(solve => solve.id)), [pinnedRecons]);
  const visibleRecons = useMemo(
    () => pinnedOnly ? pinnedRecons : recons?.filter(solve => !pinnedIds.has(solve.id)) ?? null,
    [pinnedOnly, pinnedRecons, recons, pinnedIds],
  );
  useLayoutEffect(() => {
    const panel = cardsRef.current;
    if (!panel) return;
    const cards = Array.from(panel.children);

    const measure = () => {
      if (!panel.clientWidth) return;
      // Resolved grid tracks include the implicit rows and their actual heights.
      const { gridTemplateRows, rowGap, paddingTop, paddingBottom } = getComputedStyle(panel);
      const rows = gridTemplateRows.split(' ').map(Number.parseFloat);
      let maxHeight = '';
      if (rows.length > 2) {
        const firstTwo = rows[0] + rows[1] + Number.parseFloat(rowGap);
        const padding = Number.parseFloat(paddingTop) + Number.parseFloat(paddingBottom);
        maxHeight = `${Math.ceil(Math.max(firstTwo, ...rows) + padding)}px`;
      }
      if (panel.style.maxHeight !== maxHeight) panel.style.maxHeight = maxHeight;
      if (maxHeight) {
        if (panel.tabIndex !== 0) panel.tabIndex = 0;
      } else {
        panel.removeAttribute('tabindex');
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    cards.forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [isAdmin, visibleRecons]);

  if (pinnedOnly && !visibleRecons?.length) return null;
  if (visibleRecons === null) return <div className="today-recon today-recon--loading" data-tour="today-replay" aria-hidden="true" />;
  if (recons?.length === 0 && !pinnedOnly) return <p className="landing-slot-message">{tr({ zh: '暂无复盘', en: 'No recons available' })}</p>;

  const renderCard = (s: ReconSolve) => {
    const pinned = pinnedIds.has(s.id);
    return (
      <CuratedReconCard key={s.id} solve={s} isZh={isZh} href={`/recon/${reconPathSeg(s)}`} showScrambleFallback={false}
        pin={isAdmin ? { active: pinned, disabled: pinnedRecons === null || savingPins.has(s.id), onToggle: () => void onPin(s, !pinned) } : undefined} />
    );
  };
  if (pinnedOnly) return <>{visibleRecons.map(renderCard)}{isAdmin && pinError && <p role="alert">{pinError}</p>}</>;

  return (
    <div className="today-recon" data-tour="today-replay">
      <div className="tr-head">
        <span className="tr-title">{tr({ zh: '复盘', en: 'Reconstructions' })}</span>
        <Link href="/recon" prefetch={false} className="tr-all" aria-label={tr({ zh: '查看全部复盘', en: 'View all reconstructions' })}><ArrowRight size={18} aria-hidden="true" /></Link>
      </div>

      {isAdmin && pinError && <p role="alert">{pinError}</p>}
      {visibleRecons.length > 0 && (
        <div ref={cardsRef} className="tr-cards scroll-panel scroll-panel--hover-lift"
          role="region" aria-label={tr({ zh: '复盘', en: 'Reconstructions' })}>
          {visibleRecons.map(renderCard)}
        </div>
      )}
    </div>
  );
}
