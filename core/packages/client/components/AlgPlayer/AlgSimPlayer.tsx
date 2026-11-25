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

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Lock } from '@app-foundation/icons/lucide';
import { invertMoveString } from '@cuberoot/shared/alg-notation';
import SimStage, { afterFirstPaint } from '@/components/sim-embed/SimStage';
import { useT } from '@/hooks/useT';
import type { SimMount } from '@/components/sim-embed/mountSimWorld';
import type { BlockedLayerTurnHandler, CubeletTap, EmbeddedWholeCubeDrag } from '@/components/sim-embed/attachEmbeddedSimInteraction';
import type HandsRig from '@/app/[lang]/sim/engine/hands/handsRig';
import type { GripSimStep } from '@/app/[lang]/sim/engine/hands/handsRig';
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
import { FACE, SIZE } from '@cuberoot/puzzle-render-core/engine/define';
import { DoubleSide, Matrix4, Mesh, MeshBasicMaterial, Shape, ShapeGeometry, Vector3 } from 'three';
import { createStickerHintFade } from './sticker-hint-fade';
import { transitionCubeletCase } from './cubelet-case-transition';
import { attachCornerSlotHint } from './corner-slot-hint';

const LOOP_PAUSE_MS = 900;
const ALIGNMENT_PAUSE_MS = 1200;

export const NXN_ORDER: Partial<Record<AlgPlayerPuzzle, number>> = {
  '2x2': 2, '3x3': 3, '4x4': 4, '5x5': 5, '6x6': 6,
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
  frontFaceArrow?: { from: number; to: number };
  cornerSlotHint?: { positions: readonly number[]; request: number; color: string; includeBackFacelets?: boolean };
  moveHint?: string;
  moveHintRecovery?: boolean;
  moveHintStyle?: 'orbit';
  stickerColorOverrides?: Readonly<Record<string, string>>;
  setup?: string;
  orientation?: string;
  sceneRot?: { x: number; y: number; z: number };
  hintFacelets?: boolean;
  maxFramingEdge?: number;
  startSolved?: boolean;
  autoPlay?: boolean;
  playRequest?: number;
  loop?: boolean;
  resetAfterPlayback?: boolean;
  stageOverlay?: ReactNode;
  controlMode?: AlgPlayerControlMode;
  stepMarkers?: readonly number[];
  hideResetView?: boolean;
  interactionMode?: AlgPlayerInteractionMode;
  lockView?: boolean;
  wholeCubeDrag?: EmbeddedWholeCubeDrag;
  onUserMove?: (move: string) => void;
  allowUserLayerTurn?: (move: string) => boolean;
  onBlockedUserLayerTurn?: BlockedLayerTurnHandler;
  onCubeletTap?: (selection: CubeletTap) => void;
  orbitSnapDegrees?: number;
  orbitSnapLocked?: boolean;
  pauseAfterSteps?: readonly number[];
  sectionPauseMs?: number;
  onStepChange?: (step: number) => void;
  onReady?: () => void;
  stickeringAtStep?: (step: number) => import('@cuberoot/puzzle-render-core/engine/nxn/stickering').StickeringMaskFn;
  highlightDaisyAlignment?: boolean;
  daisyAlignmentFace?: 'F' | 'R';
  showHands?: boolean | 'left' | 'left-thumb';
  handsVisible?: boolean;
  holdReferenceThumb?: boolean;
  moveDurationMs?: number;
  size?: number;
  /** 撑满父容器。给编辑器那种「右半屏放预览」的布局用。 */
  fillPane?: boolean;
}>(function AlgSimPlayer({
  alg, puzzle, puzzleOrder, set, additionalStickering, hiddenStickers, outlinedStickers, highlightedStickers, frontFaceArrow, moveHint, moveHintRecovery = false, stickerColorOverrides, setup, orientation = '', sceneRot, startSolved = false, autoPlay = false, playRequest = 0, loop = false, resetAfterPlayback = false, controlMode = 'full', stepMarkers, hideResetView = false, interactionMode = 'view', lockView = false, wholeCubeDrag, onUserMove, onCubeletTap, orbitSnapDegrees, orbitSnapLocked, pauseAfterSteps, sectionPauseMs, onStepChange, onReady, stickeringAtStep, highlightDaisyAlignment = false, showHands = false, moveDurationMs, size = 260, fillPane = false,
  stageOverlay, daisyAlignmentFace, hintFacelets = false, maxFramingEdge, allowUserLayerTurn, onBlockedUserLayerTurn, cornerSlotHint, handsVisible = true, holdReferenceThumb = false, moveHintStyle,
}, ref) {
  const t = useT();
  const [handsUnavailable, setHandsUnavailable] = useState(false);
  const timedSectionPauses = typeof sectionPauseMs === 'number' && Number.isFinite(sectionPauseMs) && sectionPauseMs > 0;
  const canonicalPuzzleKind = SIM_PUZZLE[puzzle] ?? NXN_ORDER_DEFAULT;
  const puzzleKind = NXN_ORDER[puzzle] !== undefined && puzzleOrder !== undefined
    ? clampNxNOrder(puzzleOrder)
    : canonicalPuzzleKind;
  const handsEnabled = showHands && (puzzleKind === 2 || puzzleKind === 3);
  const loadedHands = typeof showHands === 'string' ? showHands : 'both';

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
  const baseStickerColors = useRef(stickerColorOverrides);
  baseStickerColors.current = stickerColorOverrides;
  const caseFadeColors = useRef<Readonly<Record<string, string>> | undefined>(undefined);
  const animationPaused = useRef(false);
  const playbackStartStep = useRef(0);
  const onStepChangeRef = useRef(onStepChange);
  onStepChangeRef.current = onStepChange;
  useEffect(() => { onStepChangeRef.current?.(step); }, [step]);
  const movesRef = useRef(moves);
  movesRef.current = moves;
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
  const viewListeners = useRef(new Set<() => void>());
  const handsRef = useRef<HandsRig | null>(null);
  const handsVisibleRef = useRef(handsVisible);
  handsVisibleRef.current = handsVisible;
  const holdReferenceThumbRef = useRef(holdReferenceThumb);
  holdReferenceThumbRef.current = holdReferenceThumb;
  const queuedThumbTaps = useRef(0);
  const onUserMoveRef = useRef(onUserMove);
  onUserMoveRef.current = onUserMove;
  const reportUserMove = useCallback((move: string) => {
    if (loadedHands === 'left-thumb' && handsVisibleRef.current) {
      const topTurn = /^U(\d+)?'?$/.exec(move);
      if (topTurn && Number(topTurn[1] ?? 1) % 4 !== 0) {
        if (handsRef.current) handsRef.current.queueReferenceThumbTaps();
        else queuedThumbTaps.current++;
      }
    }
    onUserMoveRef.current?.(move);
  }, [loadedHands]);
  useImperativeHandle(ref, () => ({
    getPlayer: () => seekPlayer,
    setAnimationPaused: (paused: boolean) => {
      animationPaused.current = paused;
      const mount = mountRef.current;
      if (mount && typeof mount.world.puzzleKind === 'number') (mount.world.cube as Cube).twister.setAnimationPaused(paused);
    },
    playMove: (index: number) => {
      if (!ready || !Number.isInteger(index) || index < 0 || index >= moves.length) return;
      setPlaying(false);
      requestedMoveRef.current = index;
      instantStepRef.current = null;
      stepRef.current = index + 1;
      setStep(index + 1);
      setMoveRequest(request => request + 1);
    },
    resetView: (durationMs?: number) => resetViewRef.current?.(durationMs),
    orbitView: (dx, dy) => {
      const mount = mountRef.current;
      if (!mount || !ready) return;
      orbitSceneFree(mount.world, dx, dy, 1);
      mount.invalidate();
    },
    setSceneRotation: ({ x, y, z }) => {
      const mount = mountRef.current;
      if (!mount || !ready) return;
      const { scene } = mount.world;
      const { rotation } = scene;
      if (rotation.x === x && rotation.y === y && rotation.z === z) return;
      rotation.set(x, y, z);
      scene.updateMatrix();
      mount.invalidate();
    },
    getStickerAnchor: (stickers) => {
      const mount = mountRef.current;
      if (!mount || !ready || typeof puzzleKind !== 'number') return null;
      const { camera, cube } = mount.world;
      const nxn = cube as Cube;
      const renderer = nxn.instancedRenderer;
      nxn.updateWorldMatrix(true, false);
      const matrix = new Matrix4();
      const point = new Vector3();
      const normal = new Vector3();
      const towardCamera = new Vector3();
      const eye = camera.getWorldPosition(new Vector3());
      let bestFacing = 0.02;
      let anchor: { x: number; y: number; sticker: string } | null = null;
      const canvas = mount.renderer.domElement.getBoundingClientRect();
      for (const slot of renderer.stickerSlots) {
        const sticker = engineHomeSid(slot.cubeletInitial, slot.face, puzzleKind);
        if (!slot.visible || !stickers.includes(sticker)) continue;
        if (!renderer.getCubeletRenderMatrix(slot.cubeletInitial, matrix)) continue;
        matrix.multiply(slot.localMat).premultiply(nxn.matrixWorld);
        point.setFromMatrixPosition(matrix);
        normal.set(0, 0, 1).transformDirection(matrix);
        const facing = normal.dot(towardCamera.subVectors(eye, point).normalize());
        if (facing <= bestFacing) continue;
        point.project(camera);
        if (Math.abs(point.x) > 1 || Math.abs(point.y) > 1 || Math.abs(point.z) > 1) continue;
        bestFacing = facing;
        anchor = { x: canvas.left + (point.x + 1) * canvas.width / 2, y: canvas.top + (1 - point.y) * canvas.height / 2, sticker };
      }
      return anchor;
    },
    subscribeRenderedView: callback => {
      viewListeners.current.add(callback);
      return () => { viewListeners.current.delete(callback); };
    },
    subscribeSettledCube: callback => {
      const mount = mountRef.current;
      if (!mount || !ready || typeof puzzleKind !== 'number') return () => {};
      const { callbacks, twister } = mount.world.cube as Cube;
      const report = () => callback(twister.backlog);
      // Observe the settled slots before the twister starts the next queued turn.
      callbacks.unshift(report);
      return () => {
        const index = callbacks.indexOf(report);
        if (index >= 0) callbacks.splice(index, 1);
      };
    },
    getStickerPlacement: (homeIndex, homeFace) => {
      const mount = mountRef.current;
      if (!mount || !ready || typeof mount.world.puzzleKind !== 'number') return null;
      const placement = (mount.world.cube as Cube).getStickerPlacement(homeIndex, FACE[homeFace]);
      return placement && { positionIndex: placement.positionIndex, face: FACE[placement.face] };
    },
    isUserMovePending: (includeHands = true) => {
      const mount = mountRef.current;
      const handRig = handsRef.current;
      const handPhase = handRig?.getLoadState().hands;
      const handsPending = handsEnabled && !handsUnavailable && ((handPhase !== 'ready' && handPhase !== 'error')
        || (handsVisibleRef.current && (queuedThumbTaps.current > 0 || handRig?.hasPendingThumbTaps)));
      return !mount || !ready || (includeHands && handsPending)
        || (typeof mount.world.puzzleKind === 'number' && (mount.world.cube as Cube).twister.backlog > 0);
    },
    applyUserMove: (move: string) => {
      const mount = mountRef.current;
      if (!mount || !ready || interactionMode !== 'turn' || controlMode !== 'none' || typeof mount.world.puzzleKind !== 'number') return false;
      const steps = resolveSimPreviewMoves(puzzle, move);
      const blocked = steps.find(step => layerTurnGuard.current?.(step) === false);
      if (blocked) {
        blockedLayerTurnCallback.current?.(blocked);
        return false;
      }
      (mount.world.cube as Cube).twister.push(steps.join(' '));
      for (const step of steps) reportUserMove(step);
      mount.invalidate();
      return true;
    },
    transitionCubeletCase: async (homeIndex, setup, signal) => {
      const mount = mountRef.current;
      if (!mount || !ready || controlMode !== 'none' || typeof mount.world.puzzleKind !== 'number') return false;
      const cube = mount.world.cube as Cube;
      return transitionCubeletCase(cube, homeIndex, setup, signal, colors => {
        if (mountRef.current !== mount) return;
        caseFadeColors.current = colors;
        cube.instancedRenderer.setStickerColorOverrides(colors
          ? { ...baseStickerColors.current, ...colors }
          : baseStickerColors.current ?? null);
        mount.invalidate();
      });
    },
    playSingleTurn: (move: string, durationMs?: number) => {
      const mount = mountRef.current;
      if (!mount || !ready || interactionMode !== 'view' || controlMode !== 'none'
        || typeof mount.world.puzzleKind !== 'number' || !/^[RLUDFBxyz]'?$/.test(move)) return false;
      const { twister } = mount.world.cube as Cube;
      if (twister.backlog) return false;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      twister.push(move, false, 1, reducedMotion ? 0 : resolvePreviewTiming(durationMs).frames);
      mount.invalidate();
      return true;
    },
  }), [seekPlayer, ready, interactionMode, controlMode, puzzle, puzzleKind, moves.length, handsEnabled, handsUnavailable, reportUserMove]);
  const mountRef = useRef<SimMount | null>(null);
  useEffect(() => {
    const mount = mountRef.current;
    if (!ready || !mount || typeof mount.world.puzzleKind !== 'number') return;
    (mount.world.cube as Cube).instancedRenderer.hint = hintFacelets;
  }, [hintFacelets, ready]);
  useEffect(() => {
    const mount = mountRef.current;
    if (ready && animationPaused.current && mount && typeof mount.world.puzzleKind === 'number') (mount.world.cube as Cube).twister.setAnimationPaused(true);
  }, [ready]);
  useEffect(() => {
    if (!handsVisible) queuedThumbTaps.current = 0;
    if (handsRef.current) mountRef.current?.world.setHandsWanted(handsVisible && !handsUnavailable, 'cube');
  }, [handsVisible, handsUnavailable]);
  const restoreGripsRef = useRef<((prefix: string[]) => void) | null>(null);
  const alignmentRef = useRef<ReturnType<typeof import('./daisy-alignment').attachDaisyAlignment> | null>(null);
  const daisyAlignmentFaceRef = useRef(daisyAlignmentFace);
  daisyAlignmentFaceRef.current = daisyAlignmentFace;
  const resetViewRef = useRef<((durationMs?: number) => void | Promise<void>) | null>(null);
  const clockUserMoveRef = useRef<((action: string) => void) | null>(null);
  const handlesCubeletTaps = !!onCubeletTap;
  const interactionOptionsRef = useRef({ interactionMode, lockView, wholeCubeDrag, handlesCubeletTaps, orbitSnapDegrees });
  interactionOptionsRef.current = { interactionMode, lockView, wholeCubeDrag, handlesCubeletTaps, orbitSnapDegrees };
  const updateInteractionRef = useRef<(() => void) | null>(null);
  useEffect(() => { updateInteractionRef.current?.(); }, [interactionMode, lockView, wholeCubeDrag, handlesCubeletTaps, orbitSnapDegrees]);
  const layerTurnGuard = useRef(allowUserLayerTurn);
  layerTurnGuard.current = allowUserLayerTurn;
  const blockedLayerTurnCallback = useRef(onBlockedUserLayerTurn);
  blockedLayerTurnCallback.current = onBlockedUserLayerTurn;
  const onCubeletTapRef = useRef(onCubeletTap);
  onCubeletTapRef.current = onCubeletTap;
  const orbitSnapLockedRef = useRef(orbitSnapLocked);
  orbitSnapLockedRef.current = orbitSnapLocked;
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

  const updateMoveHintRef = useRef<(() => boolean) | null>(null);
  const updateCornerSlotHint = useRef<(() => boolean) | null>(null);
  const mount = useCallback(async (host: HTMLElement) => {
    const {
      mountSimWorld, attachEmbeddedSimInteraction, timing, stickeringMaskFn, mergeStickeringMaskFns, resolveStageMaskFn, resetSceneView,
    } = await preloadEngine();

    const alignmentModule = highlightDaisyAlignment && puzzleKind === 3
      ? await import('./daisy-alignment') : null;
    let hands: HandsRig | null = null;
    let alignment: ReturnType<NonNullable<typeof alignmentModule>['attachDaisyAlignment']> | undefined;
    const m = mountSimWorld({ host, puzzle: puzzleKind, interactive: true, sceneRot, maxFramingEdge,
      onFrame: (_world, dt) => {
        const handsChanged = hands?.tick(dt, holdReferenceThumbRef.current);
        const hintChanged = updateMoveHintRef.current?.() ?? false;
        const cornerHintChanged = updateCornerSlotHint.current?.() ?? false;
        return (alignment?.update() ?? false) || (handsChanged ?? false) || hintChanged || cornerHintChanged;
      },
      onRendered: () => { for (const listener of viewListeners.current) listener(); },
    });
    mountRef.current = m;
    const world = m.world;
    const cube = world.cube;
    if (alignmentModule) alignment = alignmentModule.attachDaisyAlignment(cube as Cube, () => daisyAlignmentFaceRef.current);
    alignmentRef.current = alignment ?? null;
    let cancelViewReset: (() => void) | undefined;
    resetViewRef.current = (durationMs = 0) => {
      cancelViewReset?.();
      const start = world.scene.quaternion.clone();
      if (sceneRot) {
        world.scene.rotation.set(sceneRot.x, sceneRot.y, sceneRot.z);
        world.scene.updateMatrix();
      } else {
        resetSceneView(world);
      }
      if (!Number.isFinite(durationMs) || durationMs <= 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        m.invalidate();
        return;
      }
      const target = world.scene.quaternion.clone();
      world.scene.quaternion.copy(start);
      world.scene.updateMatrix();
      return new Promise<void>(resolve => {
        let frame = 0;
        const started = performance.now();
        cancelViewReset = () => { cancelAnimationFrame(frame); cancelViewReset = undefined; resolve(); };
        const tick = (now: number) => {
          const progress = Math.min(1, (now - started) / durationMs);
          world.scene.quaternion.slerpQuaternions(start, target, progress * progress * (3 - 2 * progress));
          world.scene.updateMatrix();
          m.invalidate();
          if (progress < 1) frame = requestAnimationFrame(tick);
          else { cancelViewReset = undefined; resolve(); }
        };
        frame = requestAnimationFrame(tick);
      });
    };

    let detachInteraction: (() => void) | undefined;
    const updateInteraction = () => {
      detachInteraction?.();
      const options = interactionOptionsRef.current;
      detachInteraction = attachEmbeddedSimInteraction({
        world, dom: m.renderer.domElement, mode: options.interactionMode,
        lockView: options.lockView, wholeCubeDrag: options.wholeCubeDrag,
        onUserMove: reportUserMove,
        allowUserLayerTurn: move => layerTurnGuard.current?.(move) !== false,
        onBlockedUserLayerTurn: (move, point) => blockedLayerTurnCallback.current?.(move, point),
        onCubeletTap: options.handlesCubeletTaps ? selection => onCubeletTapRef.current?.(selection) : undefined,
        orbitSnapDegrees: options.orbitSnapDegrees,
        isOrbitSnapLocked: () => orbitSnapLockedRef.current === true,
      });
    };
    updateInteractionRef.current = updateInteraction;
    updateInteraction();
    const order = typeof puzzleKind === 'number' ? puzzleKind : undefined;
    const name = puzzle === 'clock' || puzzle === 'ivy' || puzzle === 'baby_fto' ? undefined : pickStickering(puzzle, set, 'sim');
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

    let disposed = false;
    let unsubscribeHands: (() => void) | undefined;
    if (handsEnabled) {
      const mountHands = async () => {
        // Let the cube paint before the hand chunk and models start loading.
        await afterFirstPaint();
        if (disposed) return;
        const [handsModule, twisterModule] = await Promise.all([
          import('@/app/[lang]/sim/engine/hands/handsRig'),
          import('@/app/[lang]/sim/engine/nxn/twister'),
        ]);
        if (disposed) return;
        const rig = new handsModule.default(loadedHands);
        hands = rig;
        handsRef.current = rig;
        world.handsFactory = () => rig;
        world.setHandsWanted(handsVisibleRef.current, 'cube');
        rig.queueReferenceThumbTaps(queuedThumbTaps.current);
        queuedThumbTaps.current = 0;
        const nxn = cube as Cube;
        restoreGripsRef.current = prefix => {
          const sequence: GripSimStep[] = [];
          for (const move of prefix) {
            const rotations = nxn.table.convert(new twisterModule.TwistAction(move));
            if (!rotations.length) continue;
            const { axis } = rotations[0].group;
            if (axis !== 'x' && axis !== 'y' && axis !== 'z') continue;
            sequence.push({ axis, layers: rotations.map(rotation => rotation.group.layer), quarters: rotations[0].twist });
          }
          const grips = handsModule.simulateGrips(sequence, nxn.order);
          rig.setGrips(grips.R, grips.L, grips.wristAngles);
        };
        restoreGripsRef.current(movesRef.current.slice(0, stepRef.current));
        const updateHands = () => {
          const failed = rig.getLoadState().hands === 'error';
          setHandsUnavailable(failed);
          if (failed) world.setHandsWanted(false);
          m.invalidate();
        };
        unsubscribeHands = rig.subscribeLoadState(updateHands);
        updateHands();
      };
      void mountHands().catch(() => {
        if (!disposed) setHandsUnavailable(true);
      });
    }

    const prevFrames = timing.frames;
    timing.frames = previewTiming.frames;

    return () => {
      timing.frames = prevFrames;
      cancelViewReset?.();
      detachInteraction?.();
      updateInteractionRef.current = null;
      alignment?.dispose();
      alignmentRef.current = null;
      disposed = true;
      unsubscribeHands?.();
      hands?.dispose();
      handsRef.current = null;
      queuedThumbTaps.current = 0;
      restoreGripsRef.current = null;
      m.dispose();
      mountRef.current = null;
      resetViewRef.current = null;
      lastRef.current = null;
      instantStepRef.current = null;
    };
  }, [puzzleKind, puzzle, set, additionalStickering, hiddenStickers, outlinedStickers, previewTiming.frames, sceneRot, maxFramingEdge, highlightDaisyAlignment, handsEnabled, loadedHands, reportUserMove]);

  const resetView = useCallback(() => resetViewRef.current?.(), []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !ready || typeof puzzleKind !== 'number' || !stickerColorOverrides) return;
    const renderer = (mount.world.cube as Cube).instancedRenderer;
    const fadeColors = caseFadeColors.current;
    renderer.setStickerColorOverrides(fadeColors ? { ...stickerColorOverrides, ...fadeColors } : stickerColorOverrides);
    mount.invalidate();
    return () => {
      if (mountRef.current !== mount) return;
      renderer.setStickerColorOverrides(caseFadeColors.current ?? null);
      mount.invalidate();
    };
  }, [stickerColorOverrides, puzzleKind, ready]);

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

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !ready || typeof puzzleKind !== 'number' || !frontFaceArrow) return;
    const { from, to } = frontFaceArrow;
    if (![from, to].every(index => Number.isInteger(index) && index >= 0 && index < puzzleKind * puzzleKind) || from === to) return;
    const half = (puzzleKind - 1) / 2;
    // Slot coordinates belong to the cube, so camera orbit and resizing preserve alignment.
    const position = (index: number) => new Vector3(
      (index % puzzleKind - half) * SIZE,
      (half - Math.floor(index / puzzleKind)) * SIZE,
      puzzleKind * SIZE / 2 + 5,
    );
    const origin = position(from);
    const direction = position(to).sub(origin);
    const length = direction.length();
    const shaftHalfWidth = SIZE * .065;
    const headHalfWidth = SIZE * .2;
    const headStart = length - Math.min(SIZE * .35, length * .45);
    const shape = new Shape();
    shape.moveTo(-shaftHalfWidth, 0);
    shape.lineTo(shaftHalfWidth, 0);
    shape.lineTo(shaftHalfWidth, headStart);
    shape.lineTo(headHalfWidth, headStart);
    shape.lineTo(0, length);
    shape.lineTo(-headHalfWidth, headStart);
    shape.lineTo(-shaftHalfWidth, headStart);
    shape.closePath();
    const geometry = new ShapeGeometry(shape);
    const material = new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide });
    const arrow = new Mesh(geometry, material);
    arrow.position.copy(origin);
    arrow.rotation.z = Math.atan2(direction.y, direction.x) - Math.PI / 2;
    const cube = mount.world.cube as Cube;
    cube.add(arrow);
    mount.invalidate();
    return () => {
      cube.remove(arrow);
      geometry.dispose();
      material.dispose();
      if (mountRef.current === mount) mount.invalidate();
    };
  }, [frontFaceArrow?.from, frontFaceArrow?.to, puzzleKind, ready]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !ready || typeof puzzleKind !== 'number' || !cornerSlotHint) return;
    const cube = mount.world.cube as Cube;
    const hint = attachCornerSlotHint(cube, cornerSlotHint.positions, cornerSlotHint.color,
      hintFacelets && cornerSlotHint.includeBackFacelets);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const started = performance.now();
    const fade = createStickerHintFade(started, reducedMotion);
    let previousOpacity = fade(started).opacity;
    hint.setOpacity(previousOpacity);
    updateCornerSlotHint.current = () => {
      const { opacity, complete } = fade(performance.now(), cube.busy);
      if (complete) updateCornerSlotHint.current = null;
      if (opacity === previousOpacity) return false;
      hint.setOpacity(opacity);
      previousOpacity = opacity;
      return true;
    };
    mount.invalidate();
    return () => {
      updateCornerSlotHint.current = null;
      hint.dispose();
      if (mountRef.current === mount) mount.invalidate();
    };
  }, [cornerSlotHint, hintFacelets, puzzleKind, ready]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !ready || !moveHint || typeof puzzleKind !== 'number') return;
    let disposed = false;
    let detach: (() => void) | undefined;
    void import('./move-hint-arrows').then(({ attachMoveHintArrows }) => {
      if (disposed || mountRef.current !== mount) return;
      const style = getComputedStyle(mount.renderer.domElement);
      const accent = style.getPropertyValue(moveHintRecovery ? '--destructive' : moveHintStyle === 'orbit' ? '--accent' : '--signal-success').trim();
      const secondary = style.getPropertyValue('--move-hint-secondary').trim();
      const arrows = attachMoveHintArrows(mount.world.cube as Cube, moveHint, accent, secondary, moveHintStyle);
      detach = arrows;
      const started = performance.now();
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      updateMoveHintRef.current = () => arrows.update(reducedMotion ? 0 : performance.now() - started);
      mount.invalidate();
    });
    return () => {
      disposed = true;
      updateMoveHintRef.current = null;
      detach?.();
      if (mountRef.current === mount) mount.invalidate();
    };
  }, [moveHint, moveHintRecovery, moveHintStyle, puzzleKind, ready]);
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
      // Sequential requests already have the correct starting state. Re-running
      // setup here also finishes the engine's shared tweens, snapping other
      // simultaneously playing cubes to the end of their current turns.
      if (last?.sequenceKey !== sequenceKey || last.setupAlg !== setupAlg || last.step !== requestedMove) {
        twister.setup([setupAlg, ...moves.slice(0, requestedMove)].join(' '));
        restoreGripsRef.current?.(moves.slice(0, requestedMove));
      }
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
      restoreGripsRef.current?.(moves.slice(0, syncStep));
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

  // Playback completion may hold the result briefly before restoring the setup.
  useEffect(() => {
    if (!playing) return;
    const atLastFrame = step >= moves.length;
    if (atLastFrame && !loop) {
      if (!resetAfterPlayback) { setPlaying(false); return; }
      const afterFinalTurn = () => {
        const twister = mountRef.current?.world.cube.twister as PreviewTwister | undefined;
        if ((twister?.backlog ?? 0) > 0) {
          resetTimer = setTimeout(afterFinalTurn, 16);
          return;
        }
        resetTimer = setTimeout(() => {
          jumpToStep(0);
          setPlaying(false);
        }, 1000);
      };
      let resetTimer = setTimeout(afterFinalTurn, previewTiming.stepMs);
      return () => clearTimeout(resetTimer);
    }
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
  }, [playing, loop, resetAfterPlayback, sequenceKey, step, moves.length, hasCustomTiming, previewTiming.stepMs, replayRequest, jumpToStep, stepForward, highlightDaisyAlignment, pauseAfterSteps, sectionPauseMs, timedSectionPauses]);

  return (
    <div className={`alg-sim-player${fillPane ? ' is-fill' : ''}`}
      data-canvas-interactive={interactionMode === 'turn' || (interactionMode === 'view' && (!lockView || handlesCubeletTaps)) || undefined}
      style={{ '--alg-player-size': `${size}px` } as CSSProperties}>
      {showHands && handsVisible && handsUnavailable && <small role="status">{t('手部模型加载失败', 'Could not load the hand models')}</small>}
      <SimStage
        size={size}
        mount={mount}
        onReady={() => { setReady(true); onReady?.(); }}
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
        {stageOverlay}
        {orbitSnapLocked && interactionMode !== 'none' && typeof puzzleKind === 'number' && (
          <span className="alg-sim-rotation-lock">
            <Lock size={12} aria-hidden="true" />
            <span>{t('转体已锁定', 'Cube rotation locked')}</span>
          </span>
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
          onScrub={next => { if (timedSectionPauses || resetAfterPlayback) setPlaying(false); jumpToStep(next); }}
          onStepBack={() => { if (timedSectionPauses || resetAfterPlayback) setPlaying(false); stepBack(); }}
          onTogglePlay={togglePlayback}
          onStepForward={() => { if (timedSectionPauses || resetAfterPlayback) setPlaying(false); stepForward(); }}
          onResetView={resetView}
        />
      ) : null}
    </div>
  );
});

export default AlgSimPlayer;
