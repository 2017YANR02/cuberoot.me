'use client';

/**
 * 公式动画 —— 跑站内 `/sim` 引擎,不是 cubing.js 的 TwistyPlayer。
 *
 * 只接 NxN(2x2 / 3x3 / 4x4 / 5x5)。sq1 / 五魔 / 金字塔 / 斜转的记号各是一套文法,
 * `/sim` 那边每种都有专门的解析器,跟公式库存的写法不是一一对应 —— 那几种仍走 TwistyPlayer,
 * 分流在 `AlgPlayer` 里。
 *
 * ## 三件与 TwistyPlayer 不同、写的时候会绊一下的事
 *
 * 1. **状态 = setup + 已走的步**,不是「一个可 seek 的时间轴」。引擎只有两个入口:
 *    `twister.setup(exp)`(先复位再整体重放,瞬时)和 `twister.push(exp)`(排队播动画)。
 *    所以只有「刚好往前走一步」才 push 出动画,其余(拖进度条 / 后退 / 换公式)一律
 *    整条 setup 重来。同一套取舍见 `/predict` 的题板。
 * 2. **拖拽只转视角,不转层**。`paintMode` + `dragEmpty='orbit'` 把每一次拖都判成看视角,
 *    再配 `orbitSceneFree`(只转场景,不折成整体转体)—— 折成转体会改动魔方本身的状态,
 *    那是画板要的,预览不要。
 * 3. **转速是引擎的模块级全局**(`timing.frames`),用完必须还回去,否则会漏给整站其它嵌入点。
 *
 * 顶层遮罩(F2L 灰顶、ZBLS 只亮该看的那些)复用 `/sim` 自己的阶段遮罩,名字与 cubing.js
 * 的 `experimentalStickering` 同名,所以 `pickStickering` 一份两用。
 */

import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
} from 'react';
import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AlgPuzzle } from '@cuberoot/shared';
import SimStage from '@/components/sim-embed/SimStage';
import { normalizeAlgForTwisty } from '@/lib/alg_normalize';
import { useT } from '@/hooks/useT';
import type { SimMount } from '@/components/sim-embed/mountSimWorld';
import type Cube from '@/app/[lang]/sim/engine/nxn/cube';
import { pickStickering } from './stickering';
import './alg-sim-player.css';

/** 一步的播放时长(帧)。引擎默认偏慢,公式预览要能一眼看完。 */
const PLAY_FRAMES = 8;
/** 自动播放每一步之间的间隔(ms),略长于动画本身,让人看清停在哪。 */
const STEP_MS = 260;

export const NXN_ORDER: Partial<Record<AlgPuzzle, number>> = {
  '2x2': 2, '3x3': 3, '4x4': 4, '5x5': 5,
};

async function preloadEngine() {
  const [embed, view, timingMod, stickering] = await Promise.all([
    import('@/components/sim-embed/mountSimWorld'),
    import('@/app/[lang]/sim/engine/viewControls'),
    import('@/app/[lang]/sim/engine/tweenTiming'),
    import('@/app/[lang]/sim/engine/nxn/stickering'),
  ]);
  return {
    mountSimWorld: embed.mountSimWorld,
    orbitSceneFree: view.orbitSceneFree,
    resetSceneView: view.resetSceneView,
    ORBIT_K: view.ORBIT_K,
    timing: timingMod.timing,
    stickeringMaskFn: stickering.stickeringMaskFn,
  };
}

/** 外部控制入口。给「一个播放器跟着一份列表走」的调用方用(StageSolver 的解法行 ▷)。 */
export interface AlgSimPlayerHandle {
  /** 回到起点并停下。换公式/换解法时用 —— 不该停在上一条的进度上。 */
  jumpToStart(): void;
  /** 从当前位置自动播下去。 */
  play(): void;
}

const AlgSimPlayer = forwardRef<AlgSimPlayerHandle, {
  alg: string;
  puzzle: AlgPuzzle;
  /** 公式集 slug,决定顶层遮罩(F2L 灰顶等)。不吃遮罩的调用方不用传。 */
  set?: string;
  setup?: string;
  size?: number;
  /** 撑满父容器(宽度跟布局走,高度 1:1),`size` 变成宽度上限。 */
  fillPane?: boolean;
}>(function AlgSimPlayer({
  alg, puzzle, set = '', setup, size = 260, fillPane = false,
}, ref) {
  const t = useT();
  const order = NXN_ORDER[puzzle] ?? 3;

  /**
   * 逐步切开。库里存的是**人写的**文本(换握记号、连写、分组括号都有),
   * `normalizeAlgForTwisty` 是全站唯一那份清洗,清完就是空格分隔的转动串。
   *
   * 播的是**完整公式**(含收尾 AUF),动画才停在还原态 —— 别把 `displayAlg` 的结果传进来。
   */
  const moves = useMemo(
    () => normalizeAlgForTwisty(puzzle, alg).split(/\s+/).filter(Boolean),
    [puzzle, alg],
  );
  /** 起手态:优先用库里的 setup(不带转体),没有就用公式的逆。 */
  const setupAlg = useMemo(() => {
    const normalized = normalizeAlgForTwisty(puzzle, alg);
    return setup && setup.trim()
      ? normalizeAlgForTwisty(puzzle, setup)
      : `(${normalized})'`;
  }, [puzzle, alg, setup]);

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const mountRef = useRef<SimMount | null>(null);
  const resetViewRef = useRef<() => void>(() => {});
  /** 上一帧同步到引擎的状态 —— 用来判断「是不是刚好往前一步」。 */
  const lastRef = useRef<{ setupAlg: string; step: number } | null>(null);

  // 换公式 = 从头开始。
  useEffect(() => { setStep(0); setPlaying(false); }, [setupAlg, moves]);

  const mount = useCallback(async (host: HTMLElement) => {
    const {
      mountSimWorld, orbitSceneFree, resetSceneView, ORBIT_K, timing, stickeringMaskFn,
    } = await preloadEngine();

    const m = mountSimWorld({ host, puzzle: order, interactive: true });
    mountRef.current = m;
    const world = m.world;
    const cube = world.cube as Cube;

    // 拖 = 看视角。paintMode 关掉「拖层」那条路,dragEmpty 让空处拖也算看视角;
    // orbitSceneFree 只转场景,不把超出的角度折成整体转体(那会改魔方状态)。
    world.controller.paintMode = true;
    world.controller.dragEmpty = 'orbit';
    world.controller.onOrbit = (dx, dy) => orbitSceneFree(world, dx, dy, ORBIT_K);
    resetViewRef.current = () => { resetSceneView(world); m.invalidate(); };

    const name = pickStickering(puzzle, set);
    if (name) cube.instancedRenderer.setStickering(stickeringMaskFn(order, name) ?? null);

    const prevFrames = timing.frames;
    timing.frames = PLAY_FRAMES;

    return () => {
      timing.frames = prevFrames;
      m.dispose();
      mountRef.current = null;
      lastRef.current = null;
    };
  }, [order, puzzle, set]);

  /**
   * 把 (setup, step) 同步到引擎。只有「同一条公式、刚好 +1 步」才播动画,
   * 其余一律整条重放 —— 后退和拖进度条没有「倒着播」的入口,硬凑只会把状态弄脏。
   */
  useEffect(() => {
    const m = mountRef.current;
    if (!m || !ready) return;
    const cube = m.world.cube as Cube;
    const last = lastRef.current;
    lastRef.current = { setupAlg, step };

    if (last && last.setupAlg === setupAlg && step === last.step + 1 && step > 0) {
      cube.twister.push(moves[step - 1]);   // push 自己排队,还在转也不会丢
    } else {
      cube.twister.setup([setupAlg, ...moves.slice(0, step)].join(' '));
    }
    m.invalidate();
  }, [setupAlg, moves, step, ready]);

  // 自动播放:走到头就停。
  useEffect(() => {
    if (!playing) return;
    if (step >= moves.length) { setPlaying(false); return; }
    const id = setTimeout(() => setStep(s => Math.min(s + 1, moves.length)), STEP_MS);
    return () => clearTimeout(id);
  }, [playing, step, moves.length]);

  const atEnd = step >= moves.length;

  useImperativeHandle(ref, () => ({
    jumpToStart() { setPlaying(false); setStep(0); },
    play() { setPlaying(true); },
  }), []);

  return (
    <div className={`alg-sim-player${fillPane ? ' is-fill' : ''}`}>
      <SimStage
        size={size}
        fluid={fillPane}
        mount={mount}
        onReady={() => setReady(true)}
        onResetView={() => resetViewRef.current()}
        busyLabel={t('正在加载魔方', 'Loading the cube')}
      />
      <div className="alg-sim-controls">
        <button
          type="button" className="alg-sim-btn"
          onClick={() => { setPlaying(false); setStep(0); }}
          disabled={step === 0}
          title={t('回到起点', 'Back to start')}
        >
          <SkipBack size={14} />
        </button>
        <button
          type="button" className="alg-sim-btn"
          onClick={() => { setPlaying(false); setStep(s => Math.max(0, s - 1)); }}
          disabled={step === 0}
          title={t('上一步', 'Previous move')}
        >
          <ChevronLeft size={14} />
        </button>
        <button
          type="button" className="alg-sim-btn is-primary"
          onClick={() => { if (atEnd) setStep(0); setPlaying(p => !p); }}
          title={playing ? t('暂停', 'Pause') : t('播放', 'Play')}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button
          type="button" className="alg-sim-btn"
          onClick={() => { setPlaying(false); setStep(s => Math.min(moves.length, s + 1)); }}
          disabled={atEnd}
          title={t('下一步', 'Next move')}
        >
          <ChevronRight size={14} />
        </button>
        <button
          type="button" className="alg-sim-btn"
          onClick={() => { setPlaying(false); setStep(moves.length); }}
          disabled={atEnd}
          title={t('走到最后', 'Jump to the end')}
        >
          <SkipForward size={14} />
        </button>
        <input
          type="range"
          className="alg-sim-scrub"
          min={0}
          max={moves.length}
          value={step}
          onChange={(e) => { setPlaying(false); setStep(Number(e.target.value)); }}
          aria-label={t('进度', 'Progress')}
        />
        <span className="alg-sim-count">{step}/{moves.length}</span>
      </div>
    </div>
  );
});

export default AlgSimPlayer;
