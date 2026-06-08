'use client';

/**
 * TimerShell — the mode host for /timer.
 *
 * Renders a top-left segmented [单人 Solo | 双人 Duo] pill and switches
 * between SoloView and (Phase 3) BattleView. The mode (?mode=solo | ?mode=duo)
 * is owned by nuqs (useQueryState) — solo is the default and is auto-omitted
 * from the URL (clearOnDefault). solo↔duo is a genuine big-mode switch between
 * two distinct full-screen experiences, so it pushes a history entry
 * (history:'push') → browser back / iOS edge-swipe returns to the previous mode.
 *
 * SSG note: useQueryState calls useSearchParams, but app/[lang]/layout.tsx wraps
 * pages in <Suspense>, so static generation does not bail. To avoid an SSR /
 * hydration mismatch (server prerenders with empty searchParams → SoloView) we
 * keep a `mounted` gate on the BattleView render: first client paint is always
 * SoloView, and we only swap to BattleView after mount once nuqs has read the
 * real URL param.
 *
 * Phase 1: BattleView does not exist yet — selecting 对战 flips the mode and
 * renders Solo with a small "coming soon" notice (TODO: swap in <BattleView/>
 * in Phase 3 at the marked import point).
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryState, parseAsStringEnum } from 'nuqs';
import { User, Users } from 'lucide-react';
import SoloView from './SoloView';
import BattleView from './BattleView';

const MODES = ['solo', 'duo'] as const;
type Mode = typeof MODES[number];

export default function TimerShell() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useQueryState(
    'mode',
    parseAsStringEnum<Mode>([...MODES]).withDefault('solo').withOptions({ history: 'push' }),
  );

  // First client paint stays on SoloView (matches the SSG prerender) — only swap
  // in BattleView after mount once nuqs has hydrated ?mode from the real URL.
  useEffect(() => { setMounted(true); }, []);

  const switchMode = (next: Mode) => { void setMode(next); };

  const modePill = (
    <div className="shell-mode-pill" role="tablist" aria-label={isZh ? '模式' : 'Mode'}>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'solo'}
        aria-label={isZh ? '单人' : 'Solo'}
        title={isZh ? '单人' : 'Solo'}
        className={`shell-mode-opt${mode === 'solo' ? ' active' : ''}`}
        onClick={() => switchMode('solo')}
      >
        <User size={16} />
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'duo'}
        aria-label={isZh ? '双人' : 'Duo'}
        title={isZh ? '双人' : 'Duo'}
        className={`shell-mode-opt${mode === 'duo' ? ' active' : ''}`}
        onClick={() => switchMode('duo')}
      >
        <Users size={16} />
      </button>
    </div>
  );

  // First paint is always Solo (mounted gate keeps SSG calm). After mount, if
  // ?mode=duo we render <BattleView/> (the Duo experience); the mode pill is
  // injected into its middle-bar / bottom-nav. Switching modes never remounts the
  // page — each view owns its own engine state.
  if (mounted && mode === 'duo') {
    return <BattleView modePill={modePill} />;
  }

  return <SoloView modePill={modePill} />;
}
