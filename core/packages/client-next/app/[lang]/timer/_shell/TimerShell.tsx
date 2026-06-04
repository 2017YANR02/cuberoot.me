'use client';

/**
 * TimerShell — the mode host for /timer.
 *
 * Renders a top-left segmented [单人 Solo | 双人 Duo] pill and switches
 * between SoloView and (Phase 3) BattleView. First paint is ALWAYS Solo so the
 * page stays SSG-safe: we NEVER call useSearchParams in render. Instead we read
 * window.location.search inside an effect under a `mounted` gate, then hydrate
 * the mode. Switching modes updates the query via history.replaceState (no
 * navigation, no remount).
 *
 * Phase 1: BattleView does not exist yet — selecting 对战 flips local state and
 * renders Solo with a small "coming soon" notice (TODO: swap in <BattleView/>
 * in Phase 3 at the marked import point).
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Users } from 'lucide-react';
import SoloView from './SoloView';
import BattleView from './BattleView';

type Mode = 'solo' | 'battle';

export default function TimerShell() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>('solo');

  // Read ?mode AFTER mount only — first paint is the calm Solo view. Both modes
  // are reflected in the URL (?mode=solo | ?mode=battle); normalize on mount so
  // solo (previously param-less) also shows its mode.
  useEffect(() => {
    setMounted(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const m: Mode = params.get('mode') === 'battle' ? 'battle' : 'solo';
      setMode(m);
      if (params.get('mode') !== m) {
        params.set('mode', m);
        const qs = params.toString();
        history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
      }
    } catch { /* ignore */ }
  }, []);

  const switchMode = (next: Mode) => {
    setMode(next);
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      params.set('mode', next);
      const qs = params.toString();
      const url = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
      history.replaceState(null, '', url);
    } catch { /* ignore */ }
  };

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
        aria-selected={mode === 'battle'}
        aria-label={isZh ? '双人' : 'Duo'}
        title={isZh ? '双人' : 'Duo'}
        className={`shell-mode-opt${mode === 'battle' ? ' active' : ''}`}
        onClick={() => switchMode('battle')}
      >
        <Users size={16} />
      </button>
    </div>
  );

  // First paint is always Solo (mounted gate keeps SSG calm). After mount, if
  // ?mode=battle we render <BattleView/>; the mode pill is injected into the
  // battle middle-bar / bottom-nav. Switching modes never remounts the page —
  // each view owns its own engine state.
  if (mounted && mode === 'battle') {
    return <BattleView modePill={modePill} />;
  }

  return <SoloView modePill={modePill} />;
}
