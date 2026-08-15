'use client';

/**
 * 公式动画 —— 跑站内 `/sim` 引擎,不是 cubing.js 的 TwistyPlayer。
 *
 * 公式库默认接 NxN(2x2 / 3x3 / 4x4 / 5x5)和 Square-1。记号教学还会显式接入
 * 文法一致的金字塔和斜转;五魔仍由 `AlgPlayer` 分流到 TwistyPlayer。
 *
 * ## 三件与 TwistyPlayer 不同、写的时候会绊一下的事
 *
 * 1. **状态 = setup + 已走的步**,不是「一个可 seek 的时间轴」。引擎只有两个入口:
 *    `twister.setup(exp)`(先复位再整体重放,瞬时)和 `twister.push(exp)`(排队播动画)。
 *    所以只有「刚好往前走一步」才 push 出动画,其余(拖进度条 / 后退 / 换公式)一律
 *    整条 setup 重来。同一套取舍见 `/predict` 的题板。
 * 2. **拖拽只转视角,不转层**。`paintMode` + `dragEmpty='view'` 把每一次拖都判成看视角,
 *    再配 `orbitSceneFree`(只转场景,不折成整体转体)—— 折成转体会改动魔方本身的状态,
 *    那是画板要的,预览不要。
 * 3. **转速是引擎的模块级全局**(`timing.frames`),用完必须还回去,否则会漏给整站其它嵌入点。
 *
 * 顶层遮罩(F2L 灰顶、ZBLS 只亮该看的那些)复用 `/sim` 自己的阶段遮罩,名字与 cubing.js
 * 的 `experimentalStickering` 同名,所以 `pickStickering` 一份两用。
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { AlgPuzzle } from '@cuberoot/shared';
import SimStage from '@/components/sim-embed/SimStage';
import { useT } from '@/hooks/useT';
import type { SimMount } from '@/components/sim-embed/mountSimWorld';
import type Cube from '@/app/[lang]/sim/engine/nxn/cube';
import type Sq1Cube from '@/app/[lang]/sim/engine/sq1/Sq1Cube';
import type { PuzzleKind } from '@/app/[lang]/sim/engine/world';
import type { AlgPlayerControlMode, AlgPlayerHandle } from './AlgPlayer';
import { pickStickering } from './stickering';
import { resolvePlayerSetup, resolvePreviewTiming, resolveSimMoveDurationScale, resolveSimPreviewMoves } from './player-setup';
import AlgPlaybackControls from './AlgPlaybackControls';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { createStepSeekPlayer } from './step-seek-player';
import './alg-sim-player.css';

const LOOP_PAUSE_MS = 900;

export const NXN_ORDER: Partial<Record<AlgPuzzle, number>> = {
  '2x2': 2, '3x3': 3, '4x4': 4, '5x5': 5,
};

const SIM_PUZZLE: Partial<Record<AlgPuzzle, PuzzleKind>> = {
  ...NXN_ORDER,
  sq1: 'sq1',
  pyraminx: 'pyraminx',
  skewb: 'skewb',
};

type PreviewTwister = {
  setup(scramble: string): void;
  push(scramble: string): void;
};

async function preloadEngine() {
  const [embed, view, timingMod, stickering, toucherMod] = await Promise.all([
    import('@/components/sim-embed/mountSimWorld'),
    import('@/app/[lang]/sim/engine/viewControls'),
    import('@/app/[lang]/sim/engine/tweenTiming'),
    import('@/app/[lang]/sim/engine/nxn/stickering'),
    import('@/app/[lang]/sim/Toucher'),
  ]);
  return {
    mountSimWorld: embed.mountSimWorld,
    orbitSceneFree: view.orbitSceneFree,
    ORBIT_K: view.ORBIT_K,
    timing: timingMod.timing,
    stickeringMaskFn: stickering.stickeringMaskFn,
    Toucher: toucherMod.default,
  };
}

const AlgSimPlayer = forwardRef<AlgPlayerHandle, {
  alg: string;
  puzzle: AlgPuzzle;
  set: string;
  setup?: string;
  orientation?: string;
  startSolved?: boolean;
  autoPlay?: boolean;
  playRequest?: number;
  loop?: boolean;
  controlMode?: AlgPlayerControlMode;
  moveDurationMs?: number;
  size?: number;
  /** 撑满父容器。给编辑器那种「右半屏放预览」的布局用。 */
  fillPane?: boolean;
}>(function AlgSimPlayer({
  alg, puzzle, set, setup, orientation = '', startSolved = false, autoPlay = false, playRequest = 0, loop = false, controlMode = 'full', moveDurationMs, size = 260, fillPane = false,
}, ref) {
  const t = useT();
  const puzzleKind = SIM_PUZZLE[puzzle] ?? 3;

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

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [replayRequest, setReplayRequest] = useState(0);
  const [ready, setReady] = useState(false);
  const seekPlayer = useMemo(
    () => createStepSeekPlayer(moves.length, setStep),
    [moves.length],
  );
  useImperativeHandle(ref, () => ({ getPlayer: () => seekPlayer }), [seekPlayer]);
  const mountRef = useRef<SimMount | null>(null);
  const orientationRef = useRef(orientation);
  orientationRef.current = orientation;
  /** 上一帧同步到引擎的状态 —— 用来判断「是不是刚好往前一步」。 */
  const lastRef = useRef<{ setupAlg: string; step: number } | null>(null);

  // 换公式 = 从头开始。
  useEffect(() => { setStep(0); setPlaying(false); }, [setupAlg, moves]);

  useEffect(() => {
    if (!ready || !autoPlay || moves.length === 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setStep(0);
    setPlaying(true);
    setReplayRequest(request => request + 1);
  }, [ready, autoPlay, alg, playRequest, setupAlg, moves.length]);

  const mount = useCallback(async (host: HTMLElement) => {
    const {
      mountSimWorld, orbitSceneFree, ORBIT_K, timing, stickeringMaskFn, Toucher,
    } = await preloadEngine();

    const m = mountSimWorld({ host, puzzle: puzzleKind, interactive: true });
    mountRef.current = m;
    const world = m.world;
    const cube = world.cube;

    // 拖 = 看视角。paintMode 关掉「拖层」那条路,dragEmpty 让空处拖也算看视角;
    // orbitSceneFree 只转场景,不把超出的角度折成整体转体(那会改魔方状态)。
    const toucher = new Toucher();
    toucher.init(m.renderer.domElement, world.controller.touch);
    world.controller.paintMode = true;
    world.controller.dragEmpty = 'view';
    world.controller.onOrbit = (dx, dy) => orbitSceneFree(world, dx, dy, ORBIT_K);

    const order = NXN_ORDER[puzzle];
    const name = pickStickering(puzzle, set, 'sim');
    if (order) {
      (cube as Cube).instancedRenderer.setFaceColorOverride(orientedCubeFaceColors(orientationRef.current));
    }
    if (order && name) {
      (cube as Cube).instancedRenderer.setStickering(stickeringMaskFn(order, name) ?? null);
    }
    if (puzzle === 'sq1') {
      (cube as Sq1Cube).setStickering(set);
    }

    const prevFrames = timing.frames;
    timing.frames = previewTiming.frames;

    return () => {
      timing.frames = prevFrames;
      toucher.destroy();
      m.dispose();
      mountRef.current = null;
      lastRef.current = null;
    };
  }, [puzzleKind, puzzle, set, previewTiming.frames]);

  /** 菜单切换只重贴当前预览的颜色，不重建 world，也不改变 case 状态。 */
  useEffect(() => {
    const m = mountRef.current;
    if (!m || !ready || !NXN_ORDER[puzzle]) return;
    (m.world.cube as Cube).instancedRenderer.setFaceColorOverride(orientedCubeFaceColors(orientation));
    m.invalidate();
  }, [orientation, puzzle, ready]);

  /**
   * 把 (setup, step) 同步到引擎。只有「同一条公式、刚好 +1 步」才播动画,
   * 其余一律整条重放 —— 后退和拖进度条没有「倒着播」的入口,硬凑只会把状态弄脏。
   */
  useEffect(() => {
    const m = mountRef.current;
    if (!m || !ready) return;
    const twister = m.world.cube.twister as PreviewTwister;
    const last = lastRef.current;
    lastRef.current = { setupAlg, step };

    if (last && last.setupAlg === setupAlg && step === last.step + 1 && step > 0) {
      twister.push(moves[step - 1]);   // push 自己排队,还在转也不会丢
    } else {
      twister.setup([setupAlg, ...moves.slice(0, step)].join(' '));
    }
    m.invalidate();
  }, [setupAlg, moves, step, ready]);

  // 自动播放:走到头就停。
  useEffect(() => {
    if (!playing) return;
    const atLastFrame = step >= moves.length;
    if (atLastFrame && !loop) { setPlaying(false); return; }
    const delay = atLastFrame
      ? LOOP_PAUSE_MS + (hasCustomTiming ? previewTiming.stepMs : 0)
      : step === 0
        ? Math.min(previewTiming.stepMs, 260)
        : previewTiming.stepMs;
    const id = setTimeout(
      () => setStep(s => atLastFrame ? 0 : Math.min(s + 1, moves.length)),
      delay,
    );
    return () => clearTimeout(id);
  }, [playing, loop, step, moves.length, hasCustomTiming, previewTiming.stepMs, replayRequest]);

  return (
    <div className={`alg-sim-player${fillPane ? ' is-fill' : ''}`}>
      <SimStage
        size={size}
        mount={mount}
        onReady={() => setReady(true)}
        busyLabel={t('正在加载魔方', 'Loading the cube')}
      />
      {controlMode !== 'none' && (
        <AlgPlaybackControls
          step={step}
          count={moves.length}
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
      )}
    </div>
  );
});

export default AlgSimPlayer;
