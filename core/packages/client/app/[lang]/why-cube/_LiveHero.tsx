'use client';

// Living hero cube. Both modes reuse the site's own /sim engine:
//   • 看它还原 (watch) — auto-plays the scramble → solve with shared controls.
//   • 你来拧 (play)   — drag a face to turn it, or drag empty space to orbit.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw } from 'lucide-react';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import { useT } from '../../../hooks/useT';
import { HERO_SCRAMBLE, HERO_SOLUTION } from './_cube-util';
import './_LiveHero.css';

export default function LiveHero() {
  useTranslation();
  const t = useT();
  const [mode, setMode] = useState<'watch' | 'play'>('watch');
  const [moveCount, setMoveCount] = useState(0);
  const [playSession, setPlaySession] = useState(0);

  function reset() {
    setMoveCount(0);
    setPlaySession((session) => session + 1);
  }

  function switchMode(next: 'watch' | 'play') {
    if (next === mode) return;
    reset();
    setMode(next);
  }

  return (
    <div className="wc-livehero">
      <div className="wc-livehero-glow" aria-hidden />
      <div className="wc-livehero-stage">
        <AlgPlayer
          key={`${mode}-${playSession}`}
          puzzle="3x3"
          set=""
          engine="sim"
          alg={mode === 'watch' ? HERO_SOLUTION : ''}
          setup={mode === 'watch' ? HERO_SCRAMBLE : undefined}
          autoPlay={mode === 'watch'}
          controlMode={mode === 'watch' ? 'full' : 'none'}
          interactionMode={mode === 'watch' ? 'view' : 'turn'}
          onUserMove={mode === 'play' ? () => setMoveCount((count) => count + 1) : undefined}
          moveDurationMs={360}
          size={300}
        />
      </div>

      <div className="wc-livehero-modes" role="tablist" aria-label={t('魔方互动', 'Cube interaction')}>
        <button
          type="button" role="tab" aria-selected={mode === 'watch'}
          className={`wc-livehero-mode${mode === 'watch' ? ' is-active' : ''}`}
          onClick={() => switchMode('watch')}
        >{t('看它还原', 'Watch it solve')}</button>
        <button
          type="button" role="tab" aria-selected={mode === 'play'}
          className={`wc-livehero-mode${mode === 'play' ? ' is-active' : ''}`}
          onClick={() => switchMode('play')}
        >{t('你来拧', 'You try')}</button>
      </div>

      {mode === 'play' && (
        <div className="wc-livehero-pad">
          <div className="wc-livehero-pad-foot">
            <span className="wc-livehero-count">{t('已转', 'Turns')} {moveCount}</span>
            <button type="button" className="wc-livehero-reset" onClick={reset}>
              <RotateCcw size={14} />{t('重置', 'Reset')}
            </button>
          </div>
          <p className="wc-livehero-hint">
            {t('点方块上的面也能拧,拖动转视角。', 'Tap the cube faces too, and drag to rotate the view.')}
          </p>
        </div>
      )}
    </div>
  );
}
