'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { SimMount } from '@/components/sim-embed/mountSimWorld';
import SimStage from '@/components/sim-embed/SimStage';
import { useT } from '@/hooks/useT';
import { invertFtoEifAlgorithm } from '@/lib/fto-eif-image';
import type FtoTwister from '@/app/[lang]/sim/engine/fto/FtoTwister';
import { invertFtoAnimationMoves } from '@/app/[lang]/sim/engine/fto/ftoAnimation';
import { parseFtoEifMoveGroups } from '@/app/[lang]/sim/engine/fto/ftoEifMoves';
import type { AlgPlayerControlMode, AlgPlayerHandle, AlgPlayerInteractionMode } from './AlgPlayer';
import AlgPlaybackControls from './AlgPlaybackControls';
import { resolvePreviewStepTransition, resolvePreviewTiming } from './player-setup';
import { createStepSeekPlayer } from './step-seek-player';
import './alg-sim-player.css';

const LOOP_PAUSE_MS = 900;

export const createFtoSeekPlayer = createStepSeekPlayer;

async function preloadFtoPlayerEngine() {
  const [embed, interaction, timingMod, viewControls] = await Promise.all([
    import('@/components/sim-embed/mountSimWorld'),
    import('@/components/sim-embed/attachEmbeddedSimInteraction'),
    import('@/app/[lang]/sim/engine/tweenTiming'),
    import('@/app/[lang]/sim/engine/viewControls'),
  ]);
  return {
    mountSimWorld: embed.mountSimWorld,
    attachEmbeddedSimInteraction: interaction.attachEmbeddedSimInteraction,
    timing: timingMod.timing,
    resetSceneView: viewControls.resetSceneView,
  };
}

const FtoEifAlgPlayer = forwardRef<AlgPlayerHandle, {
  alg: string;
  setup?: string;
  startSolved?: boolean;
  autoPlay?: boolean;
  playRequest?: number;
  loop?: boolean;
  controlMode?: AlgPlayerControlMode;
  interactionMode?: AlgPlayerInteractionMode;
  onUserMove?: (move: string) => void;
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
  interactionMode = 'view',
  onUserMove,
  moveDurationMs = 320,
  size = 260,
  fillPane = false,
}, ref) {
  const t = useT();
  const setupAlg = useMemo(
    () => startSolved ? '' : setup?.trim() || invertFtoEifAlgorithm(alg),
    [alg, setup, startSolved],
  );
  const parsedAlg = useMemo(() => parseFtoEifMoveGroups(alg), [alg]);
  const parsedSetup = useMemo(() => parseFtoEifMoveGroups(setupAlg), [setupAlg]);
  const invalid = useMemo(
    () => [...new Set([...parsedSetup.invalid, ...parsedAlg.invalid])],
    [parsedAlg.invalid, parsedSetup.invalid],
  );
  const previewTiming = resolvePreviewTiming(moveDurationMs);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [replayRequest, setReplayRequest] = useState(0);
  const [ready, setReady] = useState(false);
  const stepRef = useRef(step);
  stepRef.current = step;
  const instantStepRef = useRef<number | null>(null);
  const mountRef = useRef<SimMount | null>(null);
  const resetViewRef = useRef<(() => void) | null>(null);
  const onUserMoveRef = useRef(onUserMove);
  onUserMoveRef.current = onUserMove;
  const lastRef = useRef<{ setupAlg: string; step: number } | null>(null);

  const jumpToStep = useCallback((next: number) => {
    const target = Math.max(0, Math.min(parsedAlg.groups.length, next));
    if (target === stepRef.current) return;
    instantStepRef.current = target;
    stepRef.current = target;
    setStep(target);
  }, [parsedAlg.groups.length]);
  const stepBack = useCallback(() => {
    instantStepRef.current = null;
    setStep(current => {
      const next = Math.max(0, current - 1);
      stepRef.current = next;
      return next;
    });
  }, []);
  const stepForward = useCallback(() => {
    instantStepRef.current = null;
    setStep(current => {
      const next = Math.min(parsedAlg.groups.length, current + 1);
      stepRef.current = next;
      return next;
    });
  }, [parsedAlg.groups.length]);
  const seekPlayer = useMemo(
    () => createFtoSeekPlayer(parsedAlg.groups.length, jumpToStep),
    [parsedAlg.groups.length, jumpToStep],
  );
  useImperativeHandle(ref, () => ({ getPlayer: () => seekPlayer }), [seekPlayer]);

  useEffect(() => {
    jumpToStep(0);
    setPlaying(false);
  }, [setupAlg, alg, jumpToStep]);

  useEffect(() => {
    if (!ready || !autoPlay || parsedAlg.groups.length === 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    jumpToStep(0);
    setPlaying(true);
    setReplayRequest(request => request + 1);
  }, [ready, alg, autoPlay, playRequest, setupAlg, parsedAlg.groups.length, jumpToStep]);

  const mount = useCallback(async (host: HTMLElement) => {
    const {
      mountSimWorld, attachEmbeddedSimInteraction, timing, resetSceneView,
    } = await preloadFtoPlayerEngine();
    const mounted = mountSimWorld({ host, puzzle: 'fto', interactive: true });
    mountRef.current = mounted;
    const world = mounted.world;
    resetViewRef.current = () => {
      resetSceneView(world);
      mounted.invalidate();
    };
    const detachInteraction = attachEmbeddedSimInteraction({
      world,
      dom: mounted.renderer.domElement,
      mode: interactionMode,
      onUserMove: move => onUserMoveRef.current?.(move),
    });
    host.setAttribute('role', 'img');
    host.setAttribute('aria-label', t('FTO 公式动画', 'FTO algorithm animation'));

    const previousFrames = timing.frames;
    timing.frames = previewTiming.frames;
    return () => {
      timing.frames = previousFrames;
      detachInteraction();
      mounted.dispose();
      mountRef.current = null;
      resetViewRef.current = null;
      lastRef.current = null;
      instantStepRef.current = null;
    };
  }, [interactionMode, previewTiming.frames, t]);

  const resetView = useCallback(() => resetViewRef.current?.(), []);

  useEffect(() => {
    const mounted = mountRef.current;
    if (!mounted || !ready) return;
    const twister = mounted.world.cube.twister as FtoTwister;
    const last = lastRef.current;
    const instantSeek = instantStepRef.current === step;
    instantStepRef.current = null;
    lastRef.current = { setupAlg, step };

    const transition = resolvePreviewStepTransition(last, setupAlg, step, instantSeek, true);
    if (transition === 'forward') {
      twister.pushMoves(parsedAlg.groups[step - 1]);
    } else if (transition === 'backward') {
      twister.pushMoves(invertFtoAnimationMoves(parsedAlg.groups[step]));
    } else {
      twister.setupMoves([
        ...parsedSetup.groups.flat(),
        ...parsedAlg.groups.slice(0, step).flat(),
      ], setupAlg);
    }
    mounted.invalidate();
  }, [parsedAlg.groups, parsedSetup.groups, ready, setupAlg, step]);

  const togglePlayback = useCallback(() => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (stepRef.current >= parsedAlg.groups.length) jumpToStep(0);
    setPlaying(true);
  }, [jumpToStep, parsedAlg.groups.length, playing]);
  const replay = useCallback(() => {
    jumpToStep(0);
    setPlaying(true);
    setReplayRequest(request => request + 1);
  }, [jumpToStep]);

  useEffect(() => {
    if (!playing) return;
    const atEnd = step >= parsedAlg.groups.length;
    if (atEnd && !loop) {
      setPlaying(false);
      return;
    }
    const physicalTurnCount = step === 0 ? 0 : parsedAlg.groups[step - 1]?.length ?? 1;
    const delay = atEnd
      ? physicalTurnCount * previewTiming.stepMs + LOOP_PAUSE_MS
      : step === 0
        ? Math.min(previewTiming.stepMs, 260)
        : physicalTurnCount * previewTiming.stepMs;
    const timer = setTimeout(
      () => atEnd ? jumpToStep(0) : stepForward(),
      delay,
    );
    return () => clearTimeout(timer);
  }, [jumpToStep, loop, parsedAlg.groups, playing, previewTiming.stepMs, replayRequest, step, stepForward]);

  return (
    <div className={`alg-sim-player${fillPane ? ' is-fill' : ''}`}>
      <SimStage
        size={size}
        mount={mount}
        onReady={() => setReady(true)}
        onResetView={resetView}
        busyLabel={t('正在加载 FTO', 'Loading the FTO')}
      />
      {invalid.length > 0 && (
        <p className="fto-eif-player-error" role="alert">
          {t('不支持的 EIF 记号', 'Unsupported EIF notation')}: {invalid.join(' ')}
        </p>
      )}
      {controlMode === 'replay' ? (
        <AlgPlaybackControls
          mode="replay"
          count={parsedAlg.groups.length}
          onReplay={replay}
        />
      ) : controlMode === 'full' ? (
        <AlgPlaybackControls
          step={step}
          count={parsedAlg.groups.length}
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
