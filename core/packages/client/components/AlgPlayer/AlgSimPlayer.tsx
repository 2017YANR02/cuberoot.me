'use client';

/**
 * 公式动画 —— 跑站内 `/sim` 引擎,不是 cubing.js 的 TwistyPlayer。
 *
 * 公式库与记号页统一接 NxN、Square-1、魔表、金字塔和斜转。
 *
 * ## 三件与 TwistyPlayer 不同、写的时候会绊一下的事
 *
 * 1. **状态 = setup + 已走的步**,不是「一个可 seek 的时间轴」。引擎只有两个入口:
 *    `twister.setup(exp)`(先复位再整体重放,瞬时)和 `twister.push(exp)`(排队播动画)。
 *    所以 NxN 前后单步用 push 播动画,其余(拖进度条 / 首尾跳转 / 换公式)一律
 *    整条 setup 重来;不支持倒播的拼图后退也走 setup。同一套取舍见 `/sim` 播放器。
 * 2. **默认拖拽只转视角**。记号训练显式切到 `interactionMode='turn'` 时，才复用
 *    `/sim` 的贴块选择和转层手势；空白处仍走 `orbitSceneFree` 调整视角。
 * 3. **转速是引擎的模块级全局**(`timing.frames`),用完必须还回去,否则会漏给整站其它嵌入点。
 *
 * 顶层遮罩(F2L 灰顶、ZBLS 只亮该看的那些)复用 `/sim` 自己的阶段遮罩,名字与 cubing.js
 * 的 `experimentalStickering` 同名,所以 `pickStickering` 一份两用。
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { invertMoveString } from '@cuberoot/shared/alg-notation';
import SimStage from '@/components/sim-embed/SimStage';
import { useT } from '@/hooks/useT';
import type { SimMount } from '@/components/sim-embed/mountSimWorld';
import type Cube from '@/app/[lang]/sim/engine/nxn/cube';
import type Sq1Cube from '@/app/[lang]/sim/engine/sq1/Sq1Cube';
import type { PuzzleKind } from '@/app/[lang]/sim/engine/world';
import SimClockBoard from '@/components/sim-embed/SimClockBoard';
import type { AlgPlayerControlMode, AlgPlayerHandle, AlgPlayerInteractionMode } from './AlgPlayer';
import { pickStickering } from './stickering';
import {
  resolvePlayerSetup,
  resolvePreviewSyncStep,
  resolvePreviewStepTransition,
  resolvePreviewTiming,
  resolveSimMoveDurationScale,
  resolveSimPreviewMoves,
  type AlgPlayerPuzzle,
} from './player-setup';
import AlgPlaybackControls from './AlgPlaybackControls';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { NXN_ORDER_DEFAULT, clampNxNOrder } from '@/lib/nxn-order';
import { createStepSeekPlayer } from './step-seek-player';
import { orbitSceneFree } from '@cuberoot/puzzle-render-core/engine/viewControls';
import { engineHomeSid } from '@cuberoot/puzzle-render-core/engine/nxn/netIndex';
import { FM_IGNORED, FM_REGULAR, FM_OUTLINE } from '@cuberoot/puzzle-render-core/support/sticker-mask';

const LOOP_PAUSE_MS = 900;
const ALIGNMENT_PAUSE_MS = 1200;

export const NXN_ORDER: Partial<Record<AlgPlayerPuzzle, number>> = {
  '2x2': 2, '3x3': 3, '4x4': 4, '5x5': 5,
};

const SIM_PUZZLE: Partial<Record<AlgPlayerPuzzle, PuzzleKind>> = {
  ...NXN_ORDER,
  sq1: 'sq1',
  megaminx: 'megaminx',
  pyraminx: 'pyraminx',
  skewb: 'skewb',
  clock: 'clock',
  ivy: 'ivy',
};

type PreviewTwister = {
  setup(scramble: string): void;
  push(scramble: string): void;
  /** NxN counts queued and active moves; optional for other engines. */
  readonly backlog?: number;
};

async function preloadEngine() {
  const [embed, interaction, timingMod, stickering, viewControls, stageMasks] = await Promise.all([
    import('@/components/sim-embed/mountSimWorld'),
    import('@/components/sim-embed/attachEmbeddedSimInteraction'),
    import('@/app/[lang]/sim/engine/tweenTiming'),
    import('@/app/[lang]/sim/engine/nxn/stickering'),
    import('@/app/[lang]/sim/engine/viewControls'),
    import('@cuberoot/puzzle-render-core/engine/nxn/vcStageMask'),
  ]);
  return {
    mountSimWorld: embed.mountSimWorld,
    attachEmbeddedSimInteraction: interaction.attachEmbeddedSimInteraction,
    timing: timingMod.timing,
    stickeringMaskFn: stickering.stickeringMaskFn,
    mergeStickeringMaskFns: stickering.mergeStickeringMaskFns,
    resolveStageMaskFn: stageMasks.resolveStageMaskFn,
    resetSceneView: viewControls.resetSceneView,
  };
}

const AlgSimPlayer = forwardRef<AlgPlayerHandle, {
  alg: string;
  puzzle: AlgPlayerPuzzle;
  puzzleOrder?: number;
  set: string;
  additionalStickering?: string;
  hiddenStickers?: readonly string[];
  /** Home sticker IDs whose original colors remain visible inside an outline. */
  outlinedStickers?: readonly string[];
  /** Outline home stickers without changing their current mask colors. */
  highlightedStickers?: readonly string[];
  setup?: string;
  orientation?: string;
  sceneRot?: { x: number; y: number; z: number };
  startSolved?: boolean;
  autoPlay?: boolean;
  playRequest?: number;
  loop?: boolean;
  controlMode?: AlgPlayerControlMode;
  stepMarkers?: readonly number[];
  hideResetView?: boolean;
  interactionMode?: AlgPlayerInteractionMode;
  lockView?: boolean;
  onUserMove?: (move: string) => void;
  pauseAfterSteps?: readonly number[];
  sectionPauseMs?: number;
  onStepChange?: (step: number) => void;
  stickeringAtStep?: (step: number) => import('@cuberoot/puzzle-render-core/engine/nxn/stickering').StickeringMaskFn;
  highlightDaisyAlignment?: boolean;
  moveDurationMs?: number;
  size?: number;
  /** 撑满父容器。给编辑器那种「右半屏放预览」的布局用。 */
  fillPane?: boolean;
}>(function AlgSimPlayer({
  alg, puzzle, puzzleOrder, set, additionalStickering, hiddenStickers, outlinedStickers, highlightedStickers, setup, orientation = '', sceneRot, startSolved = false, autoPlay = false, playRequest = 0, loop = false, controlMode = 'full', stepMarkers, hideResetView = false, interactionMode = 'view', lockView = false, onUserMove, pauseAfterSteps, sectionPauseMs, onStepChange, stickeringAtStep, highlightDaisyAlignment = false, moveDurationMs, size = 260, fillPane = false,
}, ref) {
  const t = useT();
  const timedSectionPauses = typeof sectionPauseMs === 'number' && Number.isFinite(sectionPauseMs) && sectionPauseMs > 0;
  const canonicalPuzzleKind = SIM_PUZZLE[puzzle] ?? NXN_ORDER_DEFAULT;
  const puzzleKind = NXN_ORDER[puzzle] !== undefined && puzzleOrder !== undefined
    ? clampNxNOrder(puzzleOrder)
    : canonicalPuzzleKind;

  /**
   * 逐步切开。库里存的是**人写的**文本(换握记号、连写、分组括号都有),
   * `resolveSimPreviewMoves` 先走全站统一清洗；SQ1 再用自己的解析器切 token，
   * 避免 `(1, 0)` 里的空格被误当成分步。
   *
   * 播的是**完整公式**(含收尾 AUF),动画才停在还原态 —— 别把 `displayAlg` 的结果传进来。
   */
  const moves = useMemo(
    () => resolveSimPreviewMoves(puzzle, alg),
    [puzzle, alg],
  );
  const previewTiming = resolvePreviewTiming(
    moveDurationMs,
    resolveSimMoveDurationScale(puzzle, moves[0] ?? ''),
  );
  const hasCustomTiming = typeof moveDurationMs === 'number'
    && Number.isFinite(moveDurationMs)
    && moveDurationMs > 0;
  /** 起手态由共享规则统一决定;教学演示从还原态开始。 */
  const setupAlg = useMemo(() => {
    return resolvePlayerSetup(puzzle, alg, setup, startSolved);
  }, [puzzle, alg, setup, startSolved]);
  /** 同一个 setup 下切换 R / R' 也必须视为一条全新的播放序列。 */
  const sequenceKey = useMemo(
    () => JSON.stringify([puzzle, puzzleKind, setupAlg, moves]),
    [puzzle, puzzleKind, setupAlg, moves],
  );

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [replayRequest, setReplayRequest] = useState(0);
  const [ready, setReady] = useState(false);
  const playbackStartStep = useRef(0);
  const onStepChangeRef = useRef(onStepChange);
  onStepChangeRef.current = onStepChange;
  useEffect(() => { onStepChangeRef.current?.(step); }, [step]);
  const stepRef = useRef(step);
  stepRef.current = step;
  /** 进度条、首尾跳转和外部光标同步都必须瞬时落到完整状态。 */
  const instantStepRef = useRef<number | null>(null);
  const requestedMoveRef = useRef<number | null>(null);
  const [moveRequest, setMoveRequest] = useState(0);
  const jumpToStep = useCallback((next: number) => {
    const target = Math.max(0, Math.min(moves.length, next));
    if (target === stepRef.current) return;
    instantStepRef.current = target;
    stepRef.current = target;
    setStep(target);
  }, [moves.length]);
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
      const next = Math.min(moves.length, current + 1);
      stepRef.current = next;
      return next;
    });
  }, [moves.length]);
  const seekPlayer = useMemo(
    () => createStepSeekPlayer(moves.length, next => { setPlaying(false); jumpToStep(next); }),
    [moves.length, jumpToStep],
  );
  useImperativeHandle(ref, () => ({
    getPlayer: () => seekPlayer,
    playMove: (index: number) => {
      if (!ready || !Number.isInteger(index) || index < 0 || index >= moves.length) return;
      setPlaying(false);
      requestedMoveRef.current = index;
      instantStepRef.current = null;
      stepRef.current = index + 1;
      setStep(index + 1);
      setMoveRequest(request => request + 1);
    },
    resetView: () => resetViewRef.current?.(),
    orbitView: (dx, dy) => {
      const mount = mountRef.current;
      if (!mount || !ready) return;
      orbitSceneFree(mount.world, dx, dy, 1);
      mount.invalidate();
    },
    isUserMovePending: () => {
      const mount = mountRef.current;
      return !mount || !ready || (typeof mount.world.puzzleKind === 'number' && (mount.world.cube as Cube).twister.backlog > 0);
    },
    applyUserMove: (move: string) => {
      const mount = mountRef.current;
      if (!mount || !ready || interactionMode !== 'turn' || controlMode !== 'none' || typeof mount.world.puzzleKind !== 'number') return false;
      const steps = resolveSimPreviewMoves(puzzle, move);
      (mount.world.cube as Cube).twister.push(steps.join(' '));
      for (const step of steps) onUserMoveRef.current?.(step);
      mount.invalidate();
      return true;
    },
  }), [seekPlayer, ready, interactionMode, controlMode, puzzle, moves.length]);
  const mountRef = useRef<SimMount | null>(null);
  const alignmentRef = useRef<ReturnType<typeof import('./daisy-alignment').attachDaisyAlignment> | null>(null);
  const resetViewRef = useRef<(() => void) | null>(null);
  const clockUserMoveRef = useRef<((action: string) => void) | null>(null);
  const onUserMoveRef = useRef(onUserMove);
  onUserMoveRef.current = onUserMove;
  clockUserMoveRef.current = interactionMode === 'turn'
    ? move => onUserMoveRef.current?.(move)
    : null;
  const getWorld = useCallback(() => mountRef.current?.world ?? null, []);
  const orientationRef = useRef(orientation);
  orientationRef.current = orientation;
  /** 上一帧同步到引擎的状态 —— 用来判断「是不是刚好往前一步」。 */
  const lastRef = useRef<{ sequenceKey: string; setupAlg: string; step: number } | null>(null);

  // 换公式 = 从头开始。
  useEffect(() => { jumpToStep(0); setPlaying(false); }, [sequenceKey, jumpToStep]);

  const handledPlayRequestRef = useRef(0);
  useEffect(() => {
    if (!ready || moves.length === 0) return;
    const requested = handledPlayRequestRef.current !== playRequest;
    handledPlayRequestRef.current = playRequest;
    // Reduced motion suppresses automatic playback, not a deliberate replay click.
    if (!requested && (!autoPlay || window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    jumpToStep(0);
    playbackStartStep.current = 0;
    setPlaying(true);
    setReplayRequest(request => request + 1);
  }, [ready, autoPlay, alg, playRequest, setupAlg, moves.length, jumpToStep]);

  const mount = useCallback(async (host: HTMLElement) => {
    const {
      mountSimWorld, attachEmbeddedSimInteraction, timing, stickeringMaskFn, mergeStickeringMaskFns, resolveStageMaskFn, resetSceneView,
    } = await preloadEngine();

    const alignmentModule = highlightDaisyAlignment && puzzleKind === 3
      ? await import('./daisy-alignment') : null;
    let alignment: ReturnType<NonNullable<typeof alignmentModule>['attachDaisyAlignment']> | undefined;
    const m = mountSimWorld({ host, puzzle: puzzleKind, interactive: true, sceneRot,
      onFrame: () => alignment?.update() ?? false });
    mountRef.current = m;
    const world = m.world;
    const cube = world.cube;
    if (alignmentModule) alignment = alignmentModule.attachDaisyAlignment(cube as Cube);
    alignmentRef.current = alignment ?? null;
    resetViewRef.current = () => {
      if (sceneRot) {
        world.scene.rotation.set(sceneRot.x, sceneRot.y, sceneRot.z);
        world.scene.updateMatrix();
      } else {
        resetSceneView(world);
      }
      m.invalidate();
    };

    const detachInteraction = attachEmbeddedSimInteraction({
      world,
      dom: m.renderer.domElement,
      mode: interactionMode,
      lockView,
      onUserMove: move => onUserMoveRef.current?.(move),
    });

    const order = typeof puzzleKind === 'number' ? puzzleKind : undefined;
    const name = puzzle === 'clock' || puzzle === 'ivy' ? undefined : pickStickering(puzzle, set, 'sim');
    if (order) {
      (cube as Cube).instancedRenderer.setFaceColorOverride(orientedCubeFaceColors(orientationRef.current));
    }
    if (order && (name || hiddenStickers?.length || outlinedStickers?.length)) {
      const mask = name ? stickeringMaskFn(order, name) ?? resolveStageMaskFn(order, name) : null;
      const additionalMask = additionalStickering
        ? stickeringMaskFn(order, additionalStickering) ?? resolveStageMaskFn(order, additionalStickering)
        : null;
      const combined = mask && additionalMask ? mergeStickeringMaskFns([mask, additionalMask]) : mask;
      const hidden = new Set(hiddenStickers);
      const outlined = new Set(outlinedStickers);
      (cube as Cube).instancedRenderer.setStickering(hidden.size || outlined.size
        ? (initial, face) => hidden.has(engineHomeSid(initial, face, order))
          ? FM_IGNORED : outlined.has(engineHomeSid(initial, face, order))
            ? FM_OUTLINE : combined?.(initial, face) ?? FM_REGULAR
        : combined);
    }
    if (puzzle === 'sq1') {
      (cube as Sq1Cube).setStickering(set);
    }

    const prevFrames = timing.frames;
    timing.frames = previewTiming.frames;

    return () => {
      timing.frames = prevFrames;
      detachInteraction();
      alignment?.dispose();
      alignmentRef.current = null;
      m.dispose();
      mountRef.current = null;
      resetViewRef.current = null;
      lastRef.current = null;
      instantStepRef.current = null;
    };
  }, [puzzleKind, puzzle, set, additionalStickering, hiddenStickers, outlinedStickers, previewTiming.frames, interactionMode, lockView, sceneRot, highlightDaisyAlignment]);

  const resetView = useCallback(() => resetViewRef.current?.(), []);

  // Preview outlines are independent of stickering: a gray sticker stays gray.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !ready || typeof puzzleKind !== 'number' || highlightedStickers === undefined) return;
    const renderer = (mount.world.cube as Cube).instancedRenderer;
    const highlighted = new Set(highlightedStickers);
    renderer.setStickerPreview(highlighted.size
      ? (initial, face) => highlighted.has(engineHomeSid(initial, face, puzzleKind)) : null);
    mount.invalidate();
    return () => {
      if (mountRef.current !== mount) return;
      renderer.setStickerPreview(null);
      mount.invalidate();
    };
  }, [highlightedStickers, puzzleKind, ready]);

  /** 菜单切换只重贴当前预览的颜色，不重建 world，也不改变 case 状态。 */
  useEffect(() => {
    const m = mountRef.current;
    if (!m || !ready || typeof puzzleKind !== 'number') return;
    (m.world.cube as Cube).instancedRenderer.setFaceColorOverride(orientedCubeFaceColors(orientation));
    m.invalidate();
  }, [orientation, puzzleKind, ready]);

  /**
   * 把 (setup, step) 同步到引擎。前后单步沿用 `/sim` 的转角动画;
   * 拖动、首尾跳转、外部光标同步和循环复位都用 setup 瞬时落到完整状态。
   */
  useEffect(() => {
    const m = mountRef.current;
    if (!m || !ready) return;
    const twister = m.world.cube.twister as PreviewTwister;
    const last = lastRef.current;
    const requestedMove = requestedMoveRef.current;
    if (requestedMove !== null) {
      requestedMoveRef.current = null;
      twister.setup([setupAlg, ...moves.slice(0, requestedMove)].join(' '));
      if (typeof puzzleKind === 'number' && stickeringAtStep) {
        (m.world.cube as Cube).instancedRenderer.setStickering(stickeringAtStep(requestedMove + 1));
      }
      twister.push(moves[requestedMove]);
      lastRef.current = { sequenceKey, setupAlg, step: requestedMove + 1 };
      m.invalidate();
      return;
    }
    // React 会在同一轮 effect 中先请求 step=0，再以旧 render 的 step 同步引擎。
    // 新序列必须在这里直接钉到第 0 步，否则 R → R' 会先瞬移到 R' 末态再复位，形成回弹。
    const syncStep = resolvePreviewSyncStep(last?.sequenceKey ?? null, sequenceKey, step);
    const sequenceChanged = syncStep !== step;
    const instantSeek = sequenceChanged || instantStepRef.current === syncStep;
    if (typeof puzzleKind === 'number' && stickeringAtStep) {
      (m.world.cube as Cube).instancedRenderer.setStickering(stickeringAtStep(syncStep));
    }
    instantStepRef.current = null;
    lastRef.current = { sequenceKey, setupAlg, step: syncStep };

    const transition = resolvePreviewStepTransition(
      last,
      setupAlg,
      syncStep,
      instantSeek,
      typeof puzzleKind === 'number',
    );
    if (transition === 'forward') {
      const move = moves[syncStep - 1];
      twister.push(move);   // push 自己排队,还在转也不会丢
    } else if (transition === 'backward') {
      twister.push(invertMoveString(moves[syncStep]));
    } else {
      twister.setup([setupAlg, ...moves.slice(0, syncStep)].join(' '));
    }
    m.invalidate();
  }, [sequenceKey, setupAlg, moves, puzzle, puzzleKind, step, ready, moveRequest, stickeringAtStep]);

  const togglePlayback = useCallback(() => {
    if (playing) {
      setPlaying(false);
      return;
    }
    playbackStartStep.current = stepRef.current >= moves.length ? 0 : stepRef.current;
    if (stepRef.current >= moves.length) jumpToStep(0);
    setPlaying(true);
  }, [jumpToStep, moves.length, playing]);

  const replay = useCallback(() => {
    jumpToStep(0);
    playbackStartStep.current = 0;
    setPlaying(true);
    setReplayRequest(request => request + 1);
  }, [jumpToStep]);

  // 自动播放:走到头就停。
  useEffect(() => {
    if (!playing) return;
    const atLastFrame = step >= moves.length;
    if (atLastFrame && !loop) { setPlaying(false); return; }
    const atSectionBoundary = !atLastFrame && step !== playbackStartStep.current && pauseAfterSteps?.includes(step);
    const delay = atLastFrame
      ? LOOP_PAUSE_MS + (hasCustomTiming ? previewTiming.stepMs : 0)
      : step === 0
        ? Math.min(previewTiming.stepMs, 260)
        : previewTiming.stepMs;
    const advance = () => {
      if (atLastFrame) { playbackStartStep.current = 0; jumpToStep(0); }
      else stepForward();
    };
    // Start the observation pause only after the turn has actually settled.
    // Clearing this same timer also makes pause, seek and sequence changes immediate.
    const afterTurn = () => {
      if (atSectionBoundary) {
        const twister = mountRef.current?.world.cube.twister as PreviewTwister | undefined;
        if ((twister?.backlog ?? 0) > 0) {
          id = setTimeout(afterTurn, 16);
          return;
        }
        if (timedSectionPauses) id = setTimeout(advance, sectionPauseMs);
        else setPlaying(false);
        return;
      }
      const cube = mountRef.current?.world.cube as Cube | undefined;
      if (highlightDaisyAlignment && step > 0 && !atLastFrame && cube?.order === 3) {
        if (cube.twister.backlog > 0 || [...cube.locks.values()].some(lock => lock.size > 0)) {
          id = setTimeout(afterTurn, 50);
          return;
        }
        const alignment = alignmentRef.current;
        // The engine can settle between render frames; synchronize the frame before checking it.
        if (alignment?.update()) mountRef.current?.invalidate();
        if (alignment?.hasMatch()) {
          id = setTimeout(advance, ALIGNMENT_PAUSE_MS);
          return;
        }
      }
      advance();
    };
    let id = setTimeout(afterTurn, delay);
    return () => clearTimeout(id);
  }, [playing, loop, step, moves.length, hasCustomTiming, previewTiming.stepMs, replayRequest, jumpToStep, stepForward, highlightDaisyAlignment, pauseAfterSteps, sectionPauseMs, timedSectionPauses]);

  return (
    <div className={`alg-sim-player${fillPane ? ' is-fill' : ''}`}>
      <SimStage
        size={size}
        mount={mount}
        onReady={() => setReady(true)}
        onResetView={controlMode === 'none' && !hideResetView ? resetView : undefined}
        busyLabel={t('正在加载魔方', 'Loading the cube')}
      >
        {puzzle === 'clock' && (
          <SimClockBoard
            getWorld={getWorld}
            worldTick={ready ? 1 : 0}
            userMoveRef={clockUserMoveRef}
            pointerTurns={interactionMode === 'turn'}
            showLockedMessage={false}
          />
        )}
      </SimStage>
      {controlMode === 'replay' ? (
        <AlgPlaybackControls
          mode="replay"
          count={moves.length}
          onReplay={replay}
          onResetView={hideResetView ? undefined : resetView}
        />
      ) : controlMode === 'full' ? (
        <AlgPlaybackControls
          step={step}
          count={moves.length}
          playing={playing}
          stepMarkers={stepMarkers}
          onScrub={next => { if (timedSectionPauses) setPlaying(false); jumpToStep(next); }}
          onStepBack={() => { if (timedSectionPauses) setPlaying(false); stepBack(); }}
          onTogglePlay={togglePlayback}
          onStepForward={() => { if (timedSectionPauses) setPlaying(false); stepForward(); }}
          onResetView={resetView}
        />
      ) : null}
    </div>
  );
});

export default AlgSimPlayer;
