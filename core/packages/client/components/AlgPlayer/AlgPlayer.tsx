'use client';

/**
 * Inline animated cube preview — wraps cubing.js TwistyPlayer.
 *
 * Lazy-imports cubing/twisty(~150 KB),所以仅在真正用到时才加载。
 * 接受 (alg, puzzle, set, setup),挂载到一个 div 容器里。
 *
 * 主要入口:
 *  - case 详情页:用户点击公式行展开后播放
 *  - AlgEditor (admin):编辑时显示当前 focused 行的预览,核对公式
 */
import { useEffect, useRef, useImperativeHandle, forwardRef, type CSSProperties } from 'react';
import type { AlgPuzzle } from '@cuberoot/shared';
import { normalizeAlgForTwisty } from '@/lib/alg_normalize';
import { pickStickering } from './stickering';
import AlgSimPlayer from './AlgSimPlayer';
import FtoEifAlgPlayer from './FtoEifAlgPlayer';
import AlgPlaybackControls from './AlgPlaybackControls';
import { DEFAULT_ALG_MOVE_DURATION_MS, resolvePlayerSetup, resolveTwistyTempoScale } from './player-setup';

export interface AlgPlayerHandle {
  /** 拿到底层 cubing.js TwistyPlayer 实例,给光标 sync 等高级用法用 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getPlayer(): any | null;
}

/** Map our AlgPuzzle slug to cubing.js's TwistyPlayer puzzle id. */
export const TWISTY_PUZZLE: Record<AlgPuzzle, string> = {
  '2x2': '2x2x2',
  '3x3': '3x3x3',
  '4x4': '4x4x4',
  '5x5': '5x5x5',
  'sq1': 'square1',
  'megaminx': 'megaminx',
  'pyraminx': 'pyraminx',
  'skewb': 'skewb',
  'fto': 'fto',
};

/** 归一化搬去了 `lib/alg_normalize.ts`(校验器要用同一份)。这里转出去,老 import 不用改。 */
export { normalizeAlgForTwisty };

/** 遮罩名表搬去了 `./stickering`(sim 那版播放器也要用,不该经过这个文件把 cubing.js 拖进去)。 */
export { pickStickering };

interface Props {
  alg: string;
  puzzle: AlgPuzzle;
  set: string;
  setup?: string;
  /** NxN 预览的整体拿方；只重贴颜色，不改公式状态。 */
  orientation?: string;
  /** 从还原态演示输入的转动。记号教学用;公式预览默认仍从公式的逆状态开始。 */
  startSolved?: boolean;
  /** 装好后自动播放;尊重 prefers-reduced-motion。 */
  autoPlay?: boolean;
  /** 数值变化时从头播放一次，不重建播放器。 */
  playRequest?: number;
  /** 自动播放到末尾后从头重播。 */
  loop?: boolean;
  /** 完整播放条或仅重播按钮。记号教学使用极简重播模式。 */
  controlMode?: 'full' | 'replay';
  /** 每个 STM 的动画时长(ms)，默认 1000。 */
  moveDurationMs?: number;
  /** 自定义尺寸,默认 260px;`fillPane=true` 时忽略 */
  size?: number;
  /** 撑满父容器(用 ResizeObserver 把像素尺寸直接写入 player),否则用 size 固定方形 */
  fillPane?: boolean;
  /**
   * 用哪个引擎画。默认:NxN 走站内 `/sim` 引擎,其余(sq1 / 五魔 / 金字塔 / 斜转)走 TwistyPlayer。
   *
   * 显式传 `'twisty'` 可钉死 cubing.js。FTO 例外:EIF 宏不是 cubing.js 文法,
   * 因此始终走自有播放器,并通过兼容 handle 支持 admin 光标同步。
   */
  engine?: 'sim' | 'twisty';
}

/** 公式库默认只给 NxN 用 sim;教学页可显式启用文法一致的金字塔和斜转。 */
const DEFAULT_SIM = new Set<AlgPuzzle>(['2x2', '3x3', '4x4', '5x5']);
const EXPLICIT_SIM = new Set<AlgPuzzle>([...DEFAULT_SIM, 'pyraminx', 'skewb']);

const AlgPlayer = forwardRef<AlgPlayerHandle, Props>(function AlgPlayer(props, ref) {
  const moveDurationMs = props.moveDurationMs ?? DEFAULT_ALG_MOVE_DURATION_MS;
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
        moveDurationMs={moveDurationMs}
        size={props.size}
        fillPane={props.fillPane}
      />
    );
  }
  const requestedEngine = props.engine ?? (DEFAULT_SIM.has(props.puzzle) ? 'sim' : 'twisty');
  const useSim = requestedEngine === 'sim' && EXPLICIT_SIM.has(props.puzzle);
  if (useSim) {
    return (
      <AlgSimPlayer
        alg={props.alg} puzzle={props.puzzle} set={props.set} setup={props.setup}
        orientation={props.orientation}
        startSolved={props.startSolved} autoPlay={props.autoPlay} loop={props.loop}
        playRequest={props.playRequest}
        controlMode={props.controlMode}
        moveDurationMs={moveDurationMs} size={props.size ?? 260} fillPane={props.fillPane}
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
    let ro: ResizeObserver | null = null;
    let replayTimer: ReturnType<typeof setInterval> | null = null;
    const normalized = normalizeAlgForTwisty(puzzle, alg);
    const stickering = pickStickering(puzzle, set);
    const setupForTwisty = resolvePlayerSetup(puzzle, alg, setup, startSolved);
    const tempoScale = resolveTwistyTempoScale(moveDurationMs, normalized);
    const replayDelayMs = tempoScale !== undefined && moveDurationMs ? moveDurationMs + 900 : 1800;
    // NOTE: 播的是库里的完整公式(含收尾 AUF),动画才停在还原态。前端只在**显示/复制**时
    // 用 displayAlg() 剥掉那个 AUF —— 别把 displayAlg 的结果传进来。
    import('cubing/twisty').then((mod) => {
      if (cancelled || !host) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctor = (mod as any).TwistyPlayer || (mod as any).default;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const opts: any = {
          puzzle: TWISTY_PUZZLE[puzzle],
          experimentalSetupAlg: setupForTwisty,
          alg: normalized,
          controlPanel: controlMode === 'replay' ? 'none' : 'bottom-row',
          background: 'none',
          hintFacelets: 'none',
          backView: 'none',
        };
        if (stickering) opts.experimentalStickering = stickering;
        player = new Ctor(opts);
        if (tempoScale !== undefined) player.tempoScale = tempoScale;
        player.style.colorScheme = 'light';
        if (fillPane) {
          // ResizeObserver 把 host 像素尺寸写到 player,WebGL canvas 才会重绘
          const syncSize = () => {
            const w = host.offsetWidth;
            const h = host.offsetHeight;
            if (w > 0 && h > 0) {
              player.style.width = `${w}px`;
              player.style.height = `${h}px`;
            }
          };
          syncSize();
          ro = new ResizeObserver(syncSize);
          ro.observe(host);
        } else {
          player.style.width = size + 'px';
          player.style.height = size + 'px';
        }
        host.appendChild(player);
        playerRef.current = player;
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
        console.warn(`[AlgPlayer] ${puzzle} alg failed: ${alg}`, err);
        host.innerHTML = `<div style="font-size:12px;color:#888;padding:8px">player unavailable</div>`;
      }
    }).catch(err => console.warn('Failed to load cubing library:', err));
    return () => {
      cancelled = true;
      if (replayTimer) clearInterval(replayTimer);
      if (ro) ro.disconnect();
      if (player && host.contains(player)) host.removeChild(player);
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
        step={0}
        count={alg.trim() ? 1 : 0}
        playing={false}
        onStepChange={() => {}}
        onPlayingChange={() => {}}
        mode="replay"
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
