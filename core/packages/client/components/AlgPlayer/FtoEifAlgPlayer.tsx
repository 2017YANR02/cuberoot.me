'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useT } from '@/hooks/useT';
import { invertFtoEifAlgorithm, parseFtoEifAlgorithm, renderFtoEifSvg } from '@/lib/fto-eif-image';
import type { AlgPlayerControlMode, AlgPlayerHandle } from './AlgPlayer';
import AlgPlaybackControls from './AlgPlaybackControls';
import { createStepSeekPlayer } from './step-seek-player';
import './alg-sim-player.css';

const LOOP_PAUSE_MS = 900;

export const createFtoSeekPlayer = createStepSeekPlayer;

const FtoEifAlgPlayer = forwardRef<AlgPlayerHandle, {
  alg: string;
  setup?: string;
  startSolved?: boolean;
  autoPlay?: boolean;
  playRequest?: number;
  loop?: boolean;
  controlMode?: AlgPlayerControlMode;
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
  const jumpToStep = useCallback((next: number) => {
    setStep(Math.max(0, Math.min(parsedAlg.tokens.length, next)));
  }, [parsedAlg.tokens.length]);
  const seekPlayer = useMemo(
    () => createFtoSeekPlayer(parsedAlg.tokens.length, jumpToStep),
    [parsedAlg.tokens.length, jumpToStep],
  );
  useImperativeHandle(ref, () => ({ getPlayer: () => seekPlayer }), [seekPlayer]);

  useEffect(() => {
    jumpToStep(0);
    setPlaying(false);
  }, [setupAlg, alg, jumpToStep]);

  useEffect(() => {
    if (!autoPlay || parsedAlg.tokens.length === 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    jumpToStep(0);
    setPlaying(true);
    setReplayRequest(request => request + 1);
  }, [alg, autoPlay, playRequest, setupAlg, parsedAlg.tokens.length, jumpToStep]);

  const stepBack = useCallback(() => jumpToStep(step - 1), [jumpToStep, step]);
  const stepForward = useCallback(() => jumpToStep(step + 1), [jumpToStep, step]);
  const togglePlayback = useCallback(() => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (step >= parsedAlg.tokens.length) jumpToStep(0);
    setPlaying(true);
  }, [jumpToStep, parsedAlg.tokens.length, playing, step]);
  const replay = useCallback(() => {
    jumpToStep(0);
    setPlaying(true);
    setReplayRequest(request => request + 1);
  }, [jumpToStep]);

  useEffect(() => {
    if (!playing) return;
    const atEnd = step >= parsedAlg.tokens.length;
    if (atEnd && !loop) {
      setPlaying(false);
      return;
    }
    const delay = atEnd ? LOOP_PAUSE_MS : Math.max(40, moveDurationMs);
    const timer = setTimeout(
      () => jumpToStep(atEnd ? 0 : step + 1),
      delay,
    );
    return () => clearTimeout(timer);
  }, [loop, moveDurationMs, parsedAlg.tokens.length, playing, replayRequest, step, jumpToStep]);

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
      {controlMode === 'replay' ? (
        <AlgPlaybackControls
          mode="replay"
          count={parsedAlg.tokens.length}
          onReplay={replay}
        />
      ) : controlMode === 'full' ? (
        <AlgPlaybackControls
          step={step}
          count={parsedAlg.tokens.length}
          playing={playing}
          onScrub={jumpToStep}
          onStepBack={stepBack}
          onTogglePlay={togglePlayback}
          onStepForward={stepForward}
        />
      ) : null}
    </div>
  );
});

export default FtoEifAlgPlayer;
