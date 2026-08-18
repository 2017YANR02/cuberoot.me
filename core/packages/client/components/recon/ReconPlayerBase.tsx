'use client';

/**
 * ReconPlayerBase — the shared read-only WebGL preview for recon flows. It owns
 * the entire cuber-engine lifecycle (lazy three + World import, renderer, resize,
 * drag-to-orbit, RAF render loop, optional back-view window, cleanup) plus the
 * play / step / scrub controls and the imperative handle (ReconPlayerHandle) that
 * lets a caller drive it — recon's caret sync, StageSolver's solution list.
 *
 * Puzzle-specific behavior is supplied by a ReconPlayerAdapter<M>: how to parse
 * the solution into moves, how to build the puzzle, how to snap a prefix instantly,
 * and how to push one move during playback. CuberReconPlayer (NxN) and
 * Sq1ReconPlayer are thin wrappers that only supply an adapter — they were ~85%
 * identical copies of this whole lifecycle before it was extracted here.
 *
 * three + the cuber World are lazy-imported inside the mount effect so the ~1.2MB
 * three bundle stays out of pages that never mount a player.
 */

import {
  useCallback, useEffect, useRef, useState, type ReactNode, type RefObject,
} from 'react';
import type World from '@/app/[lang]/sim/engine/world';
import type { BackView } from '@/app/[lang]/sim/engine/backView';
import ReconPlayOverlay from '@/components/recon/ReconPlayOverlay';
import PlaybackBar from '@/components/PlaybackBar';
import './recon-player.css';

const PLAY_INTERVAL_MS = 520;

/** 播放器的外部控制入口(回填到调用方的 `playerRef`)。
 *  `__kind` 是拼图标签,卸载时用它确认「这个 ref 还是我放的」再清空。 */
export interface ReconPlayerHandle {
  __kind: string;
  /** 跳到「已走 n 步」的那一帧并停下(复盘表单的光标同步、换解法时回到开头)。 */
  jumpToMoveCount(n: number): void;
  /** 从当前位置自动播下去;已在结尾则先回开头(与画面里那颗播放键同一套语义)。 */
  play(): void;
}

export interface ReconPlayerAdapter<M> {
  /** Stable tag exposed on the imperative handle's `__kind`. */
  kind: string;
  /** Whether an always-on back-view mini window is shown. */
  backView: boolean;
  /** Whether the orientation-letter face hints (U/D/L/R/F/B) are drawn. Defaults to
   *  `backView` — the letters are NxN-shaped, and the puzzles that skip the mini
   *  window (skewb / pyraminx) are exactly the ones they'd misdescribe. Set it
   *  explicitly to keep the letters on a player that has no room for the window. */
  faceHints?: boolean;
  /** Extra reactive values that require rebuilding the puzzle + re-applying the
   *  current step when they change (e.g. NxN order). Length must stay constant. */
  deps?: unknown[];
  /** Split the solution alg into engine moves. */
  parseMoves(alg: string): M[];
  /** Build (or rebuild) the puzzle on the world. Called on mount and whenever
   *  `deps` change; guard on world.puzzleKind so it's idempotent. */
  setupPuzzle(world: World): void;
  /** Restore any module-level puzzle state changed by `setupPuzzle` before the
   *  shared renderer is disposed. */
  cleanupPuzzle?(world: World): void;
  /** Reset to the scramble, then snap the first `n` moves instantly. Returns the
   *  clamped target, or undefined if the world isn't the expected kind yet. */
  applyPrefix(world: World, scramble: string, moves: M[], n: number): number | undefined;
  /** Push one move with animation during playback. Returns false if the world
   *  isn't the expected kind (playback then stops). */
  pushMove(world: World, move: M): boolean;
}

export default function ReconPlayerBase<M>({
  scramble, alg, adapter, fillPane = false, hideControls = false, playerRef, fullscreenButton, ariaLabel,
}: {
  scramble: string;
  alg: string;
  adapter: ReconPlayerAdapter<M>;
  fillPane?: boolean;
  /** 隐藏底部完整控制条,改用画面内居中播放/暂停浮层(嵌成绩弹窗预览时用)。 */
  hideControls?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playerRef?: RefObject<any>;
  /** 全屏/退出全屏按钮(调用方持有 fullscreen 状态),渲染在播放条按钮排最左
   *  (与 /sim 的 <PlaybackBar> 同款位置)。 */
  fullscreenButton?: ReactNode;
  ariaLabel?: string;
}) {
  // Latest adapter — the mount effect / loops run once but must always call the
  // current puzzle closures (which close over the latest order / props).
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  const hostRef = useRef<HTMLDivElement>(null);
  const backFrameRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const backViewRef = useRef<BackView | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rendererRef = useRef<any>(null);
  const scrambleRef = useRef(scramble);
  const movesRef = useRef<M[]>(adapter.parseMoves(alg));
  const stepRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [step, setStepState] = useState(0);
  const [total, setTotal] = useState(movesRef.current.length);
  const [playing, setPlaying] = useState(false);

  const setStep = useCallback((n: number) => {
    stepRef.current = n;
    setStepState(n);
  }, []);

  /** Reset to the scramble, then snap the first `n` solution moves on top. */
  const applyStep = useCallback((n: number) => {
    const world = worldRef.current;
    if (!world) return;
    return adapterRef.current.applyPrefix(world, scrambleRef.current, movesRef.current, n);
  }, []);

  const jumpToStep = useCallback((n: number) => {
    setPlaying(false);
    const target = applyStep(n);
    if (target != null) setStep(target);
  }, [applyStep, setStep]);

  // ── Mount: 共享的 /sim 嵌入生命周期(mountSimWorld:渲染器 / 尺寸 / 只在脏时渲染的
  //    rAF / 卸载)+ 共享的拖拽手势(attachOrbitTap,钳 pitch 的看图档),本文件只留
  //    「拼图怎么建」「小窗怎么摆」这两件自己的事 ──
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      const [embed, gesture, three, defineMod, backMod] = await Promise.all([
        import('@/components/sim-embed/mountSimWorld'),
        import('@/components/sim-embed/orbitTapGesture'),
        import('three'),
        import('@/app/[lang]/sim/engine/define'),
        import('@/app/[lang]/sim/engine/backView'),
      ]);
      if (cancelled) return;
      const host = hostRef.current;
      if (!host) return;

      // Orientation letters (U/D/L/R/F/B) — default to following the back view
      // (recon submit forces both), overridable for players too small for the window.
      const wantBackView = adapterRef.current.backView;
      const mount = embed.mountSimWorld({
        host,
        interactive: true,
        faceHints: adapterRef.current.faceHints ?? wantBackView,
        // 看图页要满像素比(贴纸边界 / 方位字母都要清楚),不吃默认的 2× 上限。
        pixelRatioCap: Number.POSITIVE_INFINITY,
        // 右下角小窗跟着主视图一起画(只在真渲染了那一帧)。
        onRendered: (w) => { backViewRef.current?.render(w); },
      });
      const world = mount.world;
      adapterRef.current.setupPuzzle(world);
      worldRef.current = world;
      rendererRef.current = mount.renderer;

      if (wantBackView) {
        const bv = backMod.createBackView(three, defineMod.SIZE, 120);
        backViewRef.current = bv;
        backFrameRef.current?.appendChild(bv.domElement);
      }

      // 小窗边长跟主画布走(主画布自己的尺寸由 mountSimWorld 的 ResizeObserver 管)。
      const sizeBackView = () => {
        const bv = backViewRef.current;
        const frame = backFrameRef.current;
        if (!bv || !frame) return;
        const edge = Math.min(host.clientWidth, host.clientHeight);
        const bs = Math.round(Math.min(132, Math.max(72, edge * 0.3)));
        frame.style.width = `${bs}px`;
        frame.style.height = `${bs}px`;
        bv.setSize(bs);
        mount.invalidate();
      };
      sizeBackView();
      const ro = new ResizeObserver(sizeBackView);
      ro.observe(host);

      // 只读预览:拖动一律转视角(钳 pitch,永远正着看),不碰魔方。右键菜单照常
      // (这里没有右键交互,拦了反而怪)。
      const detach = gesture.attachOrbitTap({
        world,
        canvas: mount.renderer.domElement,
        preventContextMenu: false,
      });

      // Initial state — scramble applied, solution at step 0.
      applyStep(stepRef.current);
      setReady(true);

      cleanup = () => {
        detach();
        ro.disconnect();
        backViewRef.current?.dispose();
        backViewRef.current = null;
        adapterRef.current.cleanupPuzzle?.(world);
        mount.dispose();
        worldRef.current = null;
        rendererRef.current = null;
      };
      if (cancelled) cleanup();
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── deps change (e.g. NxN order) → rebuild the puzzle, re-apply baseline ──
  useEffect(() => {
    if (!ready) return;
    const world = worldRef.current;
    if (!world) return;
    adapterRef.current.setupPuzzle(world);
    const target = applyStep(stepRef.current);
    if (target != null) setStep(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, applyStep, setStep, ...(adapter.deps ?? [])]);

  // ── Scramble change → re-apply baseline, clamp step ──
  useEffect(() => {
    scrambleRef.current = scramble;
    if (!ready) return;
    const target = applyStep(stepRef.current);
    if (target != null) setStep(target);
  }, [scramble, ready, applyStep, setStep]);

  // ── Solution change → reparse moves, clamp step ──
  useEffect(() => {
    const moves = adapterRef.current.parseMoves(alg);
    movesRef.current = moves;
    setTotal(moves.length);
    if (!ready) return;
    const target = applyStep(Math.min(stepRef.current, moves.length));
    if (target != null) setStep(target);
  }, [alg, ready, applyStep, setStep]);

  // ── Animated playback (push one move at a time) ──
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const world = worldRef.current;
      const moves = movesRef.current;
      const s = stepRef.current;
      if (!world || s >= moves.length) {
        setPlaying(false);
        return;
      }
      if (!adapterRef.current.pushMove(world, moves[s])) {
        setPlaying(false);
        return;
      }
      setStep(s + 1);
    }, PLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [playing, setStep]);

  // ── Expose imperative handle for caret-driven scrubbing / list-driven playback ──
  useEffect(() => {
    if (!playerRef) return;
    const { kind } = adapterRef.current;
    const handle: ReconPlayerHandle = {
      __kind: kind,
      jumpToMoveCount: (n: number) => jumpToStep(n),
      play: () => {
        if (stepRef.current >= movesRef.current.length) jumpToStep(0);
        setPlaying(true);
      },
    };
    playerRef.current = handle;
    return () => { if (playerRef.current?.__kind === kind) playerRef.current = null; };
  }, [playerRef, jumpToStep]);

  const atEnd = step >= total;

  return (
    <div className={`recon-player${fillPane ? ' recon-player--fill' : ''}`}>
      <div ref={hostRef} className="recon-player-canvas" role={ariaLabel ? 'img' : undefined} aria-label={ariaLabel}>
        {adapter.backView && <div ref={backFrameRef} className="recon-player-backview" aria-hidden />}
        {hideControls && total > 0 && (
          <ReconPlayOverlay
            playing={playing}
            onToggle={() => { if (atEnd) jumpToStep(0); setPlaying(p => !p); }}
          />
        )}
      </div>
      {!hideControls && (
      <div className="recon-player-controls">
        <PlaybackBar
          step={step}
          total={total}
          playing={playing}
          onScrub={jumpToStep}
          onSkipStart={() => jumpToStep(0)}
          onStepBack={() => jumpToStep(step - 1)}
          onTogglePlay={() => { if (atEnd) jumpToStep(0); setPlaying(p => !p); }}
          onStepForward={() => jumpToStep(step + 1)}
          onSkipEnd={() => jumpToStep(total)}
          leading={fullscreenButton}
          labels={{ scrub: 'Scrub solution' }}
        />
      </div>
      )}
    </div>
  );
}
