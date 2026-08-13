'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useT } from '@/hooks/useT';
import { invertFtoEifAlgorithm, parseFtoEifAlgorithm, renderFtoEifSvg } from '@/lib/fto-eif-image';
import type { AlgPlayerHandle } from './AlgPlayer';
import AlgPlaybackControls from './AlgPlaybackControls';
import './alg-sim-player.css';

const LOOP_PAUSE_MS = 900;

/** Minimal TwistyPlayer-shaped adapter consumed by syncPlayerToMoveCount(). */
export function createFtoSeekPlayer(moveCount: number, onStep: (step: number) => void) {
  let timestamp = 0;
  return {
    get timestamp() { return timestamp; },
    set timestamp(value: number) {
      timestamp = Number.isFinite(value) ? value : 0;
      onStep(Math.min(moveCount, Math.max(0, Math.round(timestamp))));
    },
    experimentalModel: {
      indexer: {
        get: async () => ({
          numAnimatedLeaves: () => moveCount,
          algDuration: () => moveCount,
          indexToMoveStartTimestamp: (index: number) => index,
        }),
      },
    },
  };
}

const FtoEifAlgPlayer = forwardRef<AlgPlayerHandle, {
  alg: string;
  setup?: string;
  startSolved?: boolean;
  autoPlay?: boolean;
  playRequest?: number;
  loop?: boolean;
  controlMode?: 'full' | 'replay';
  moveDurationMs?: number;
  size?: number;
  fillPane?: boolean;
}>(function FtoEifAlgPlayer({
  alg,
  setup,
  startSolved = false,
  autoPlay = false,
  playRequest = 0,
  loop = false,
  controlMode = 'full',
  moveDurationMs = 260,
  size = 260,
  fillPane = false,
}, ref) {
  const t = useT();
  const parsedAlg = useMemo(() => parseFtoEifAlgorithm(alg), [alg]);
  const parsedSetup = useMemo(() => parseFtoEifAlgorithm(setup ?? ''), [setup]);
  const setupAlg = useMemo(
    () => startSolved ? '' : setup?.trim() || invertFtoEifAlgorithm(alg),
    [alg, setup, startSolved],
  );
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [replayRequest, setReplayRequest] = useState(0);
  const seekPlayer = useMemo(
    () => createFtoSeekPlayer(parsedAlg.tokens.length, setStep),
    [parsedAlg.tokens.length],
  );
  useImperativeHandle(ref, () => ({ getPlayer: () => seekPlayer }), [seekPlayer]);

  useEffect(() => {
    setStep(0);
    setPlaying(false);
  }, [setupAlg, alg]);

  useEffect(() => {
    if (!autoPlay || parsedAlg.tokens.length === 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setStep(0);
    setPlaying(true);
    setReplayRequest(request => request + 1);
  }, [alg, autoPlay, playRequest, setupAlg, parsedAlg.tokens.length]);

  useEffect(() => {
    if (!playing) return;
    const atEnd = step >= parsedAlg.tokens.length;
    if (atEnd && !loop) {
      setPlaying(false);
      return;
    }
    const delay = atEnd ? LOOP_PAUSE_MS : Math.max(40, moveDurationMs);
    const timer = setTimeout(
      () => setStep(current => atEnd ? 0 : Math.min(current + 1, parsedAlg.tokens.length)),
      delay,
    );
    return () => clearTimeout(timer);
  }, [loop, moveDurationMs, parsedAlg.tokens.length, playing, replayRequest, step]);

  const visibleAlgorithm = [setupAlg, ...parsedAlg.tokens.slice(0, step)].filter(Boolean).join(' ');
  const svg = useMemo(
    () => renderFtoEifSvg(visibleAlgorithm, undefined, { title: t('FTO 公式状态', 'FTO algorithm state') }),
    [t, visibleAlgorithm],
  );
  const invalid = [...parsedSetup.invalid, ...parsedAlg.invalid];
  const artStyle = fillPane
    ? { width: '100%', flex: 1, minHeight: 0 }
    : { width: size, height: size };

  return (
    <div className={`alg-sim-player${fillPane ? ' is-fill' : ''}`}>
      <div
        className="fto-eif-player-art"
        style={artStyle}
        role="img"
        aria-label={t('FTO 公式状态', 'FTO algorithm state')}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {invalid.length > 0 && (
        <p className="fto-eif-player-error" role="alert">
          {t('不支持的 EIF 记号', 'Unsupported EIF notation')}: {invalid.join(' ')}
        </p>
      )}
      <AlgPlaybackControls
        step={step}
        count={parsedAlg.tokens.length}
        playing={playing}
        onStepChange={setStep}
        onPlayingChange={setPlaying}
        mode={controlMode}
        onReplay={controlMode === 'replay' ? () => {
          setStep(0);
          setPlaying(true);
          setReplayRequest(request => request + 1);
        } : undefined}
      />
    </div>
  );
});

export default FtoEifAlgPlayer;
