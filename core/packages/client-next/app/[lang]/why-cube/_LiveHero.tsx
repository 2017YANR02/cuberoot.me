'use client';

// Living hero cube. Two modes:
//   • 看它还原 (watch) — auto-plays the scramble → solve, with the cubing.js
//     control panel for replay / scrub.
//   • 你来拧 (play)   — tap the cube faces (or the on-screen keys) to turn it,
//     drag to orbit. A self-paced "it's interactive" demo.

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw } from 'lucide-react';
import TwistySection from '@/components/TwistySection';
import { useT } from '../../../hooks/useT';
import { HERO_SCRAMBLE, HERO_SOLUTION } from './_cube-util';
import './_LiveHero.css';

const FACES = ['U', 'R', 'F', 'L', 'D', 'B'] as const;

export default function LiveHero() {
  useTranslation();
  const t = useT();
  const [mode, setMode] = useState<'watch' | 'play'>('watch');
  const [prime, setPrime] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  const [alg, setAlg] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const movesRef = useRef<string[]>([]);

  // Drop the cubing.js checkerboard (let the warm glow show through) and, in
  // watch mode, auto-play the solve once the async-built player is ready.
  useEffect(() => {
    let tries = 0;
    const id = window.setInterval(() => {
      const p = playerRef.current;
      tries += 1;
      if (p && typeof p.play === 'function') {
        try { p.background = 'none'; } catch { /* */ }
        if (mode === 'watch') {
          try { p.timestamp = 0; } catch { /* */ }
          try { p.play(); } catch { /* */ }
        }
        window.clearInterval(id);
      } else if (tries > 24) {
        window.clearInterval(id);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [mode]);

  function onUserMove(mv: string) {
    movesRef.current = [...movesRef.current, mv];
    setMoveCount(movesRef.current.length);
    setAlg(movesRef.current.join(' '));
  }

  function press(face: string) {
    const move = prime ? `${face}'` : face;
    const p = playerRef.current;
    if (p && typeof p.experimentalAddMove === 'function') {
      try { p.experimentalAddMove(move); } catch { /* */ }
    }
  }

  function reset() {
    movesRef.current = [];
    setMoveCount(0);
    setAlg('');
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
        <TwistySection
          puzzle="3x3x3"
          scramble={mode === 'watch' ? HERO_SCRAMBLE : ''}
          alg={mode === 'watch' ? HERO_SOLUTION : alg}
          twistOnClick={mode === 'play'}
          onUserMove={mode === 'play' ? onUserMove : undefined}
          playerRef={playerRef}
          settings={{ scale: 52, viewAngle: 50, viewGradient: 36, speed: 58, hint: false }}
        />
      </div>

      <div className="wc-livehero-modes" role="tablist" aria-label={t('魔方互动', 'Cube interaction', '魔方互動')}>
        <button
          type="button" role="tab" aria-selected={mode === 'watch'}
          className={`wc-livehero-mode${mode === 'watch' ? ' is-active' : ''}`}
          onClick={() => switchMode('watch')}
        >{t('看它还原', 'Watch it solve', '看它還原')}</button>
        <button
          type="button" role="tab" aria-selected={mode === 'play'}
          className={`wc-livehero-mode${mode === 'play' ? ' is-active' : ''}`}
          onClick={() => switchMode('play')}
        >{t('你来拧', 'You try', '你來擰')}</button>
      </div>

      {mode === 'play' && (
        <div className="wc-livehero-pad">
          <div className="wc-livehero-keys">
            {FACES.map((f) => (
              <button key={f} type="button" className="wc-livehero-key" onClick={() => press(f)}>
                {f}{prime ? '′' : ''}
              </button>
            ))}
          </div>
          <div className="wc-livehero-pad-foot">
            <button
              type="button"
              className={`wc-livehero-dir${prime ? ' is-active' : ''}`}
              onClick={() => setPrime((v) => !v)}
              aria-pressed={prime}
            >{prime ? t('逆时针', 'Counter-CW', '逆時針') : t('顺时针', 'Clockwise', '順時針')}</button>
            <span className="wc-livehero-count">{t('已转', 'Turns', '已轉')} {moveCount}</span>
            <button type="button" className="wc-livehero-reset" onClick={reset}>
              <RotateCcw size={14} />{t('重置', 'Reset')}
            </button>
          </div>
          <p className="wc-livehero-hint">
            {t('点方块上的面也能拧,拖动转视角。', 'Tap the cube faces too, and drag to rotate the view.', '點方塊上的面也能擰,拖動轉視角。')}
          </p>
        </div>
      )}
    </div>
  );
}
