'use client';

/**
 * ReconPlayerBase — the shared read-only WebGL preview for recon flows. It owns
 * the entire cuber-engine lifecycle (lazy three + World import, renderer, resize,
 * drag-to-orbit, RAF render loop, optional back-view window, cleanup) plus the
 * play / step / scrub controls and the caret-scrub imperative handle.
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

export interface ReconPlayerAdapter<M> {
  /** Stable tag exposed on the imperative handle's `__kind`. */
  kind: string;
  /** Whether an always-on back-view mini window is shown (also drives whether the
   *  orientation-letter face hints are visible). */
  backView: boolean;
  /** Extra reactive values that require rebuilding the puzzle + re-applying the
   *  current step when they change (e.g. NxN order). Length must stay constant. */
  deps?: unknown[];
  /** Split the solution alg into engine moves. */
  parseMoves(alg: string): M[];
  /** Build (or rebuild) the puzzle on the world. Called on mount and whenever
   *  `deps` change; guard on world.puzzleKind so it's idempotent. */
  setupPuzzle(world: World): void;
  /** Reset to the scramble, then snap the first `n` moves instantly. Returns the
   *  clamped target, or undefined if the world isn't the expected kind yet. */
  applyPrefix(world: World, scramble: string, moves: M[], n: number): number | undefined;
  /** Push one move with animation during playback. Returns false if the world
   *  isn't the expected kind (playback then stops). */
  pushMove(world: World, move: M): boolean;
}

export default function ReconPlayerBase<M>({
  scramble, alg, adapter, fillPane = false, hideControls = false, playerRef, fullscreenButton,
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

  // ── Mount: lazy-load three + cuber World, build the puzzle, render loop +
  //    optional back view, drag-to-orbit ──
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      const THREE = await import('three');
      const { default: World } = await import('@/app/[lang]/sim/engine/world');
      const { attachInteraction } = await import('@/app/[lang]/sim/worldInteraction');
      const wantBackView = adapterRef.current.backView;
      let mkBackView: ((px: number) => BackView) | null = null;
      if (wantBackView) {
        const { SIZE } = await import('@/app/[lang]/sim/engine/define');
        const { createBackView } = await import('@/app/[lang]/sim/engine/backView');
        if (cancelled) return;
        mkBackView = (px: number) => createBackView(THREE, SIZE, px);
      }
      if (cancelled) return;
      const host = hostRef.current;
      if (!host) return;

      const world = new World();
      attachInteraction(world); // controller 注入(原 World ctor 内联,headless 化后外置)
      adapterRef.current.setupPuzzle(world);
      // Orientation letters (U/D/L/R/F/B) — shown iff the back view is on (recon
      // submit forces both), hidden on the detail / SolutionView surfaces.
      if (wantBackView) world.faceHints.show(); else world.faceHints.hide();
      worldRef.current = world;

      const renderer = new THREE.WebGLRenderer({
        antialias: true, alpha: true, preserveDrawingBuffer: true,
      });
      renderer.autoClear = false;
      renderer.setClearColor(0xffffff, 0);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.domElement.style.outline = 'none';
      renderer.domElement.style.touchAction = 'none';
      renderer.domElement.style.display = 'block';
      host.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      if (mkBackView) {
        const bv = mkBackView(120);
        backViewRef.current = bv;
        if (backFrameRef.current) backFrameRef.current.appendChild(bv.domElement);
      }

      const resize = () => {
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (w <= 0 || h <= 0) return;
        world.width = w;
        world.height = h;
        world.resize();
        renderer.setSize(w, h, true);
        const frame = backFrameRef.current;
        if (backViewRef.current && frame) {
          const bs = Math.round(Math.min(132, Math.max(72, Math.min(w, h) * 0.3)));
          frame.style.width = `${bs}px`;
          frame.style.height = `${bs}px`;
          backViewRef.current.setSize(bs);
        }
        world.dirty = true;
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      // Drag-to-orbit the view (read-only — no cube interaction).
      const ORBIT_K = 0.01;
      const Q = Math.PI / 2;
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      const onDown = (e: PointerEvent) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        try { renderer.domElement.setPointerCapture(e.pointerId); } catch { /* */ }
      };
      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        world.scene.rotation.y += dx * ORBIT_K;
        world.scene.rotation.x = Math.max(-Q, Math.min(Q, world.scene.rotation.x + dy * ORBIT_K));
        world.scene.updateMatrix();
        world.dirty = true;
      };
      const onUp = (e: PointerEvent) => {
        dragging = false;
        try { renderer.domElement.releasePointerCapture(e.pointerId); } catch { /* */ }
      };
      renderer.domElement.addEventListener('pointerdown', onDown);
      renderer.domElement.addEventListener('pointermove', onMove);
      renderer.domElement.addEventListener('pointerup', onUp);
      renderer.domElement.addEventListener('pointercancel', onUp);

      let raf = 0;
      let lastFrameAt = performance.now();
      const loop = () => {
        const now = performance.now();
        const dt = now - lastFrameAt;
        lastFrameAt = now;
        // Fade the orientation letters in (and keep them rendered).
        if (world.faceHints.tick(dt)) world.dirty = true;
        if (world.dirty || world.cube.dirty) {
          renderer.clear();
          renderer.render(world.scene, world.camera);
          backViewRef.current?.render(world);
          world.dirty = false;
          world.cube.dirty = false;
        }
        raf = requestAnimationFrame(loop);
      };
      loop();

      // Initial state — scramble applied, solution at step 0.
      applyStep(stepRef.current);
      setReady(true);

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        renderer.domElement.removeEventListener('pointerdown', onDown);
        renderer.domElement.removeEventListener('pointermove', onMove);
        renderer.domElement.removeEventListener('pointerup', onUp);
        renderer.domElement.removeEventListener('pointercancel', onUp);
        if (renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
        backViewRef.current?.dispose();
        backViewRef.current = null;
        (world.cube as { dispose?: () => void }).dispose?.();
        renderer.dispose();
        renderer.forceContextLoss?.();
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

  // ── Expose imperative handle for caret-driven scrubbing ──
  useEffect(() => {
    if (!playerRef) return;
    const { kind } = adapterRef.current;
    playerRef.current = {
      __kind: kind,
      jumpToMoveCount: (n: number) => jumpToStep(n),
    };
    return () => { if (playerRef.current?.__kind === kind) playerRef.current = null; };
  }, [playerRef, jumpToStep]);

  const atEnd = step >= total;

  return (
    <div className={`recon-player${fillPane ? ' recon-player--fill' : ''}`}>
      <div ref={hostRef} className="recon-player-canvas">
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
