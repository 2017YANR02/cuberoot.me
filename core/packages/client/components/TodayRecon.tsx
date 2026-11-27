'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from '@app-foundation/icons/lucide';
import type { ReconSolve } from '@cuberoot/shared';
import { SkeletonBlock } from '@/components/ContentSkeleton';
import { CuratedReconCard } from '@/components/ReconCard/CuratedReconCard';
import { useRetainedState } from '@/hooks/useRetainedState';
import { useContentRefreshKey } from '@/hooks/useContentRefreshKey';
import { getTodayRecons } from '@/lib/recon-api';
import { reconPathSeg } from '@/lib/recon-seo';
import { tr } from '@/i18n/tr';
import './scroll_panel.css';
import './today_recon.css';

interface Props {
  lang: 'zh' | 'en';
  pinnedRecons: ReconSolve[] | null;
  savingPin: boolean;
  isAdmin: boolean;
  canEditPins: boolean;
  pinError: string | null;
  emptyPin: ReactNode;
  onPin: (solve: ReconSolve, pinned: boolean) => Promise<void>;
}

export default function TodayRecon({ lang, pinnedRecons, savingPin, isAdmin, canEditPins, pinError, emptyPin, onPin }: Props) {
  const refreshKey = useContentRefreshKey();
  const [recons, setRecons] = useRetainedState<ReconSolve[] | null>('home:todayRecons', null);

  useEffect(() => {
    let active = true;
    const load = () => {
      getTodayRecons()
        .then(rows => { if (active) setRecons(rows.filter(solve => solve.recordType !== 'timing')); })
        .catch(() => { if (active) setRecons(previous => previous ?? []); });
    };
    const idleId = window.requestIdleCallback?.(load, { timeout: 1000 });
    const timeoutId = idleId === undefined ? setTimeout(load, 200) : undefined;
    return () => {
      active = false;
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [refreshKey, setRecons]);

  const pinned = pinnedRecons?.[0];
  const loadingPin = pinnedRecons === null && !pinError;
  const recent = recons?.filter(solve => solve.id !== pinned?.id);
  const hasRecent = Boolean(recent?.length);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollEdges, setScrollEdges] = useState({ up: false, down: false });

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    const updateEdges = () => {
      const up = viewport.scrollTop > 1;
      const down = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop > 1;
      setScrollEdges(previous => previous.up === up && previous.down === down ? previous : { up, down });
    };
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(viewport);
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild);
    viewport.addEventListener('scroll', updateEdges, { passive: true });
    return () => {
      observer.disconnect();
      viewport.removeEventListener('scroll', updateEdges);
    };
  }, [hasRecent]);

  const canScroll = scrollEdges.up || scrollEdges.down;
  const arrowUp = scrollEdges.up && !scrollEdges.down;
  const scrollRecent = () => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    viewport.scrollBy({ top: arrowUp ? -viewport.clientHeight : viewport.clientHeight });
  };
  const renderCard = (solve: ReconSolve, compact = false) => {
    const active = pinned?.id === solve.id;
    return (
      <CuratedReconCard key={solve.id} solve={solve} isZh={lang === 'zh'} href={`/recon/${reconPathSeg(solve)}`}
        compact={compact} showScrambleFallback={false}
        pin={canEditPins ? { active, disabled: pinnedRecons === null || savingPin, onToggle: () => void onPin(solve, !active) } : undefined} />
    );
  };

  return (
    <section className="today-recon" data-tour="today-replay"
      aria-label={pinned ? tr({ zh: '置顶复盘', en: 'Pinned reconstruction' }) : tr({ zh: '复盘', en: 'Reconstructions' })}>
      {isAdmin && pinError && <p className="landing-slot-message" role="alert">{pinError}</p>}
      <div className={`tr-content${pinned || loadingPin ? ' tr-content--pinned' : ''}`}>
        <div className="tr-primary" aria-busy={loadingPin}>
          {pinned ? renderCard(pinned) : loadingPin ? <SkeletonBlock className="landing-widget-skeleton" /> : emptyPin}
        </div>
        {recent === undefined ? <SkeletonBlock className="tr-recent-loading" /> : recent.length > 0 && (
          <div className="tr-recent" data-site-surface="panel">
            <div ref={scrollRef} className="tr-recent-scroll scroll-panel" role="region"
              tabIndex={canScroll ? 0 : undefined} aria-label={tr({ zh: '近期复盘', en: 'Recent reconstructions' })}>
              <div className="tr-recent-rows">{recent.map(solve => renderCard(solve, true))}</div>
            </div>
            {canScroll && (
              <button type="button" className="tr-scroll-arrow" data-direction={arrowUp ? 'up' : 'down'} onClick={scrollRecent}
                aria-label={arrowUp
                  ? tr({ zh: '向上滚动复盘列表', en: 'Scroll reconstructions up' })
                  : tr({ zh: '向下滚动复盘列表', en: 'Scroll reconstructions down' })}>
                <ChevronDown size={18} aria-hidden />
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
