'use client';

/**
 * TimerShell — the mode host for /timer.
 *
 * One URL param owns the whole experience: ?players=1..4 (nuqs, default 1,
 * force-written even when default via clearOnDefault:false — a bare /timer
 * gets ?players=1 on first paint so the URL is always shareable/bookmarkable
 * with the exact mode). players=1 renders SoloView; players>=2
 * renders BattleView (2 = the original versus/side duo, 3/4 = 田字格 grid).
 * The old ?mode=solo|duo param and the solo/duo segmented pill are gone — the
 * single 人数 select (rendered here, injected into each view's chrome) is the
 * only switcher. Changing player count is a genuine big-mode switch between
 * full-screen experiences, so it pushes a history entry (history:'push') →
 * browser back / iOS edge-swipe returns to the previous count.
 *
 * SSG note: useQueryState calls useSearchParams, but app/[lang]/layout.tsx wraps
 * pages in <Suspense>, so static generation does not bail. To avoid an SSR /
 * hydration mismatch (server prerenders with empty searchParams → SoloView) we
 * keep a `mounted` gate on the BattleView render: first client paint is always
 * SoloView, and we only swap to BattleView after mount once nuqs has read the
 * real URL param.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryState, parseAsInteger } from 'nuqs';
import SoloView from './SoloView';
import BattleView from './BattleView';
import { tr } from '@/i18n/tr';

export default function TimerShell() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [mounted, setMounted] = useState(false);
  const [playersParam, setPlayersParam] = useQueryState(
    'players',
    parseAsInteger.withDefault(1).withOptions({ history: 'push', clearOnDefault: false }),
  );
  const playerCount = Math.max(1, Math.min(4, playersParam));

  useEffect(() => { setMounted(true); }, []);
  // 裸 /timer 强制写显式 ?players=1(默认人数也进 URL,不再省略)。
  useEffect(() => {
    if (typeof window !== 'undefined' && !new URLSearchParams(window.location.search).has('players')) {
      void setPlayersParam(playerCount, { history: 'replace' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playersControl = (
    <select
      className="shell-players-select"
      value={playerCount}
      onChange={(e) => { void setPlayersParam(parseInt(e.target.value)); }}
      title={tr({ zh: '人数', en: 'Players' })}
      aria-label={tr({ zh: '人数', en: 'Players' })}
    >
      {[1, 2, 3, 4].map(n => (
        <option key={n} value={n}>{isZh ? `${n}人` : `${n}P`}</option>
      ))}
    </select>
  );

  // First paint is always Solo (mounted gate keeps SSG calm). After mount, if
  // ?players>=2 we render <BattleView/>; the players select is injected into
  // its middle-bar (battle) / topbar (solo). Switching never remounts the
  // page — each view owns its own engine state.
  if (mounted && playerCount >= 2) {
    return <BattleView playerCount={playerCount} playersControl={playersControl} />;
  }

  return <SoloView playersControl={playersControl} />;
}
