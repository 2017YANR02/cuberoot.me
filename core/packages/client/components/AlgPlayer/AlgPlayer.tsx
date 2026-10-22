'use client';

/**
 * Inline algorithm preview with the shared `/sim` renderer and controls.
 *
 * Lazy-imports cubing/twisty(~150 KB),所以仅在真正用到时才加载。
 * 接受 (alg, puzzle, set, setup),挂载到一个 div 容器里。
 *
 * 主要入口:
 *  - case 详情页:用户点击公式行展开后播放
 *  - AlgEditor (admin):编辑时显示当前 focused 行的预览,核对公式
 */
import { useEffect, useRef, useImperativeHandle, forwardRef, type CSSProperties } from 'react';
import { mountTwistyPlayer, type MountedTwistyPlayer } from '@cuberoot/timer-ui/mount-twisty-player';
import { normalizeAlgForTwisty } from '@/lib/alg_normalize';
import { pickStickering } from './stickering';
import AlgSimPlayer from './AlgSimPlayer';
import FtoEifAlgPlayer from './FtoEifAlgPlayer';
import AlgPlaybackControls from './AlgPlaybackControls';
import {
  DEFAULT_ALG_MOVE_DURATION_MS,
  resolvePlayerSetup,
  resolveTwistyTempoScale,
  type AlgPlayerPuzzle,
} from './player-setup';
import './alg-sim-player.css';

export interface AlgPlayerHandle {
  /** Sim: restore the preceding state, animate this zero-based move, then pause. */
  playMove?: (index: number) => void;
  /** Move only the embedded simulator view, without turning any puzzle layers. */
  orbitView?: (dx: number, dy: number) => void;
  resetView?: () => void;
  /** Manual NxN practice input, available with turn interaction and no playback controls. */
  applyUserMove?: (move: string) => boolean;
  isUserMovePending?: () => boolean;
  /** 拿到底层播放器或兼容 seek adapter,给光标 sync 等高级用法用。 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getPlayer(): any | null;
}

export type AlgPlayerControlMode = 'full' | 'replay' | 'none';
export type AlgPlayerInteractionMode = 'view' | 'turn' | 'none';

/** Map our AlgPuzzle slug to cubing.js's TwistyPlayer puzzle id. */
export const TWISTY_PUZZLE: Partial<Record<AlgPlayerPuzzle, string>> = {
  '2x2': '2x2x2',
  '3x3': '3x3x3',
  '4x4': '4x4x4',
  '5x5': '5x5x5',
  'sq1': 'square1',
  'megaminx': 'megaminx',
  'pyraminx': 'pyraminx',
  'skewb': 'skewb',
  'fto': 'fto',
  'clock': 'clock',
};

/** 归一化搬去了 `lib/alg_normalize.ts`(校验器要用同一份)。这里转出去,老 import 不用改。 */
export { normalizeAlgForTwisty };

/** 遮罩名表搬去了 `./stickering`(sim 那版播放器也要用,不该经过这个文件把 cubing.js 拖进去)。 */
export { pickStickering };

interface Props {
  alg: string;
  puzzle: AlgPlayerPuzzle;
  /** Override the rendered NxN order while retaining the selected notation grammar. */
  puzzleOrder?: number;
  set: string;
  /** Sim NxN: also reveal the pieces covered by this existing stage mask. */
  additionalStickering?: string;
  /** Sim NxN: hide these solved sticker IDs (e.g. U6); the mask follows their pieces. */
  hiddenStickers?: readonly string[];
  /** Home sticker IDs whose original colors remain visible inside an outline. */
  outlinedStickers?: readonly string[];
  setup?: string;
  /** NxN 预览的整体拿方；只重贴颜色，不改公式状态。 */
  orientation?: string;
  /** Initial scene angles in radians for the sim engine; also used by reset view. */
  sceneRot?: { x: number; y: number; z: number };
  /** 从还原态演示输入的转动。记号教学用;公式预览默认仍从公式的逆状态开始。 */
  startSolved?: boolean;
  /** 装好后自动播放;尊重 prefers-reduced-motion。 */
  autoPlay?: boolean;
  /** 数值变化时从头播放一次，不重建播放器。 */
  playRequest?: number;
  /** 自动播放到末尾后从头重播。 */
  loop?: boolean;
  /** 完整播放条或仅重播按钮。记号教学使用极简重播模式。 */
  controlMode?: AlgPlayerControlMode;
  /** Sim engine: move counts at teaching stage boundaries on the scrubber. */
  stepMarkers?: readonly number[];
  hideResetView?: boolean;
  /** 拖拽只调整视角，或直接使用 `/sim` 的手拧交互。 */
  interactionMode?: AlgPlayerInteractionMode;
  /** Sim engine: keep the initial camera orientation while allowing layer turns. */
  lockView?: boolean;
  /** `interactionMode='turn'` 时返回 `/sim` 产生的标准转动记号。 */
  onUserMove?: (move: string) => void;
  /** Sim 教学预览：在这些完整步数之后暂停；继续播放会越过当前边界。 */
  pauseAfterSteps?: readonly number[];
  /** Sim only: automatically continue after this many ms at section boundaries.
   * Omitted or non-positive keeps the existing manual-resume behavior. */
  sectionPauseMs?: number;
  /** Sim 教学预览的动作位置，用于同步逐步说明。 */
  onStepChange?: (step: number) => void;
  /** Sim renderer only: update piece visibility without resetting playback. */
  stickeringAtStep?: (step: number) => import('@cuberoot/puzzle-render-core/engine/nxn/stickering').StickeringMaskFn;
  /** Sim 3x3: frame each daisy petal whose side matches the center below it. */
  highlightDaisyAlignment?: boolean;
  /** 每个 STM 的动画时长(ms)，默认 1000。 */
  moveDurationMs?: number;
  /** 自定义尺寸,默认 260px;`fillPane=true` 时忽略 */
  size?: number;
  /** 撑满父容器(用 ResizeObserver 把像素尺寸直接写入 player),否则用 size 固定方形 */
  fillPane?: boolean;
  /**
   * 用哪个引擎画。已具备完整公式预览契约的拼图默认走共享引擎。
   *
   * 显式传 `'twisty'` 可钉死 cubing.js。FTO 例外:EIF 宏不是 cubing.js 文法,
   * 因此始终走自有播放器,并通过兼容 handle 支持 admin 光标同步。
   */
  engine?: 'sim' | 'twisty';
}

/** `/sim` 公式播放器当前支持的全部拼图。 */
const SIM_SUPPORTED = new Set<AlgPlayerPuzzle>([
  '2x2', '3x3', '4x4', '5x5', 'sq1', 'megaminx', 'pyraminx', 'skewb', 'clock', 'ivy',
]);

/** EIF macros expand to several physical turns, so the FTO engine uses a shorter beat. */
const DEFAULT_FTO_MOVE_DURATION_MS = 320;

const AlgPlayer = forwardRef<AlgPlayerHandle, Props>(function AlgPlayer(props, ref) {
  if (props.puzzle === 'fto') {
    return (
      <FtoEifAlgPlayer
        ref={ref}
        alg={props.alg}
        setup={props.setup}
        startSolved={props.startSolved}
        autoPlay={props.autoPlay}
        playRequest={props.playRequest}
        loop={props.loop}
        controlMode={props.controlMode}
        interactionMode={props.interactionMode}
        onUserMove={props.onUserMove}
        moveDurationMs={props.moveDurationMs ?? DEFAULT_FTO_MOVE_DURATION_MS}
        size={props.size}
        fillPane={props.fillPane}
      />
    );
  }
  const moveDurationMs = props.moveDurationMs ?? DEFAULT_ALG_MOVE_DURATION_MS;
  const requestedEngine = props.engine ?? (SIM_SUPPORTED.has(props.puzzle) ? 'sim' : 'twisty');
  const useSim = requestedEngine === 'sim' && SIM_SUPPORTED.has(props.puzzle);
  if (useSim) {
    const simInstanceKey = JSON.stringify([
      props.puzzle,
      props.puzzleOrder ?? null,
      props.set,
      props.additionalStickering,
      props.hiddenStickers,
      moveDurationMs,
      props.size ?? 260,
      props.fillPane ?? false,
      props.interactionMode ?? 'view',
      props.lockView ?? false,
      props.sceneRot?.x, props.sceneRot?.y, props.sceneRot?.z,
    ]);
    return (
      <AlgSimPlayer
        hideResetView={props.hideResetView}
        key={simInstanceKey}
        ref={ref}
        alg={props.alg} puzzle={props.puzzle} set={props.set} setup={props.setup}
        puzzleOrder={props.puzzleOrder}
        orientation={props.orientation}
        sceneRot={props.sceneRot}
        additionalStickering={props.additionalStickering}
        hiddenStickers={props.hiddenStickers}
        outlinedStickers={props.outlinedStickers}
        onStepChange={props.onStepChange}
        highlightDaisyAlignment={props.highlightDaisyAlignment}
        startSolved={props.startSolved} autoPlay={props.autoPlay} loop={props.loop}
        playRequest={props.playRequest}
        controlMode={props.controlMode}
        interactionMode={props.interactionMode}
        lockView={props.lockView}
        onUserMove={props.onUserMove}
        moveDurationMs={moveDurationMs} size={props.size ?? 260} fillPane={props.fillPane}
        pauseAfterSteps={props.pauseAfterSteps}
        sectionPauseMs={props.sectionPauseMs}
        stickeringAtStep={props.stickeringAtStep}
        stepMarkers={props.stepMarkers}
      />
    );
  }
  return <TwistyAlgPlayer {...props} moveDurationMs={moveDurationMs} ref={ref} />;
});

const TwistyAlgPlayer = forwardRef<AlgPlayerHandle, Props>(function TwistyAlgPlayer({ alg, puzzle, set, setup, startSolved = false, autoPlay = false, playRequest = 0, loop = false, controlMode = 'full', moveDurationMs, size = 260, fillPane = false }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  useImperativeHandle(ref, () => ({ getPlayer: () => playerRef.current }), []);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let player: any = null;
    const abort = new AbortController();
    let mount: MountedTwistyPlayer | undefined;
    let replayTimer: ReturnType<typeof setInterval> | null = null;
    const normalized = puzzle === 'clock' || puzzle === 'ivy' ? alg : normalizeAlgForTwisty(puzzle, alg);
    const stickering = puzzle === 'clock' || puzzle === 'ivy' ? undefined : pickStickering(puzzle, set);
    const twistyPuzzle = TWISTY_PUZZLE[puzzle];
    if (!twistyPuzzle) return;
    const setupForTwisty = resolvePlayerSetup(puzzle, alg, setup, startSolved);
    const tempoScale = resolveTwistyTempoScale(moveDurationMs, normalized);
    const replayDelayMs = tempoScale !== undefined && moveDurationMs ? moveDurationMs + 900 : 1800;
    // NOTE: 播的是库里的完整公式(含收尾 AUF),动画才停在还原态。前端只在**显示/复制**时
    // 用 displayAlg() 剥掉那个 AUF —— 别把 displayAlg 的结果传进来。
    void (async () => {
      if (cancelled || !host) return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const opts: any = {
          puzzle: twistyPuzzle,
          experimentalSetupAlg: setupForTwisty,
          alg: normalized,
          controlPanel: controlMode === 'full' ? 'bottom-row' : 'none',
          background: 'none',
          hintFacelets: 'none',
          backView: 'none',
        };
        if (stickering) opts.experimentalStickering = stickering;
        mount = await mountTwistyPlayer(host, opts, { signal: abort.signal, size: fillPane ? undefined : size });
        if (cancelled) { mount.dispose(); return; }
        player = mount.player;
        if (tempoScale !== undefined) player.tempoScale = tempoScale;
        player.style.colorScheme = 'light';
        playerRef.current = player;
        if (startSolved) player.timestamp = 0;
        const canAutoPlay = autoPlay && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (canAutoPlay) {
          player.play?.();
          if (loop) {
            replayTimer = setInterval(() => {
              try { player.timestamp = 0; player.play?.(); } catch { /* player may be between frames */ }
            }, replayDelayMs);
          }
        }
      } catch (err) {
        if (cancelled) return;
        console.warn(`[AlgPlayer] ${puzzle} alg failed: ${alg}`, err);
        host.innerHTML = `<div style="font-size:12px;color:#888;padding:8px">player unavailable</div>`;
      }
    })();
    return () => {
      cancelled = true;
      abort.abort();
      if (replayTimer) clearInterval(replayTimer);
      mount?.dispose();
      if (playerRef.current === player) playerRef.current = null;
    };
  }, [alg, puzzle, set, setup, startSolved, autoPlay, loop, controlMode, moveDurationMs, size, fillPane]);

  const handledPlayRequestRef = useRef(playRequest);
  useEffect(() => {
    if (handledPlayRequestRef.current === playRequest) return;
    handledPlayRequestRef.current = playRequest;
    const player = playerRef.current;
    if (!player) return;
    try {
      player.pause?.();
      player.timestamp = 0;
      player.play?.();
    } catch { /* player may still be initializing */ }
  }, [playRequest]);

  // NOTE: 固定 host 尺寸,player 重 mount 时容器占位不丢,父布局不抖
  const hostStyle: CSSProperties = fillPane
    ? { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }
    : { width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const host = <div ref={hostRef} className="alg-twisty-host" style={hostStyle} />;
  if (controlMode !== 'replay') return host;

  return (
    <div className={`alg-sim-player${fillPane ? ' is-fill' : ''}`}>
      {host}
      <AlgPlaybackControls
        mode="replay"
        count={alg.trim() ? 1 : 0}
        onReplay={() => {
          const player = playerRef.current;
          if (!player) return;
          try {
            player.pause?.();
            player.timestamp = 0;
            player.play?.();
          } catch { /* player may still be initializing */ }
        }}
      />
    </div>
  );
});

export default AlgPlayer;
