'use client';

/**
 * CuberReconPlayer — read-only NxN preview for the recon submit flow, driven by
 * the local cuber WebGL engine (the same one /sim uses for NxN). It's the NxN
 * counterpart to Sq1ReconPlayer, offered as an alternative to the cubing.js
 * TwistySection so recon previews can match /sim exactly.
 *
 * A back-view mini window (createBackView) is ALWAYS shown here — the recon flow
 * forces it on, no toggle.
 *
 * three + the cuber World are lazy-imported inside the mount effect so the
 * ~1.2MB three bundle stays out of pages that never select this engine.
 *
 * Cursor sync: when `playerRef` is given, the instance exposes
 * `{ __kind: 'nxn-cuber', jumpToMoveCount(n) }` so the form's caret handler can
 * scrub the cube as the user clicks through the solution text.
 */

import {
  useCallback, useEffect, useRef, useState, type RefObject,
} from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import type World from '@/app/[lang]/sim/engine/world';
import type { BackView } from '@/app/[lang]/sim/engine/backView';
import './CuberReconPlayer.css';

const PLAY_INTERVAL_MS = 520;

/** Whitespace-tokenize an alg into individual moves (matches the form's caret
 *  move-count which splits on /\s+/). */
function tokenize(alg: string): string[] {
  return alg.trim().split(/\s+/).filter(Boolean);
}

export default function CuberReconPlayer({
  scramble, alg, order, fillPane = false, playerRef, hideControls = false,
}: {
  scramble: string;
  alg: string;
  /** NxN order (2..7). */
  order: number;
  fillPane?: boolean;
  /** 隐藏底部播放/步进/scrubber 控制条(嵌成绩弹窗预览时用)。 */
  hideControls?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playerRef?: RefObject<any>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const backFrameRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rendererRef = useRef<any>(null);
  const backViewRef = useRef<BackView | null>(null);
  const scrambleRef = useRef(scramble);
  const tokensRef = useRef<string[]>(tokenize(alg));
  const orderRef = useRef(order);
  const stepRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [step, setStepState] = useState(0);
  const [total, setTotal] = useState(tokensRef.current.length);
  const [playing, setPlaying] = useState(false);

  const setStep = useCallback((n: number) => {
    stepRef.current = n;
    setStepState(n);
  }, []);

  /** Reset to the scramble, then snap the first `n` solution moves on top — all
   *  instant (twister.setup re-applies from solved). */
  const applyStep = useCallback((n: number) => {
    const world = worldRef.current;
    if (!world || world.puzzleKind === 'sq1') return;
    const cube = world.cube as import('@/app/[lang]/sim/engine/nxn/cube').default;
    const toks = tokensRef.current;
    const target = Math.max(0, Math.min(n, toks.length));
    const prefix = toks.slice(0, target).join(' ');
    cube.twister.setup((scrambleRef.current + ' ' + prefix).trim());
    world.dirty = true;
    return target;
  }, []);

  const jumpToStep = useCallback((n: number) => {
    setPlaying(false);
    const target = applyStep(n);
    if (target != null) setStep(target);
  }, [applyStep, setStep]);

  // ── Mount: lazy-load three + cuber World, build NxN cube, render loop +
  //    always-on back view, orbit drag ──
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      const THREE = await import('three');
      const { default: World } = await import('@/app/[lang]/sim/engine/world');
      const { SIZE } = await import('@/app/[lang]/sim/engine/define');
      const { createBackView } = await import('@/app/[lang]/sim/engine/backView');
      if (cancelled) return;
      const host = hostRef.current;
      if (!host) return;

      const world = new World();
      world.setPuzzle(orderRef.current);
      // Always-on face-orientation letters (U/D/L/R/F/B), same as /sim — they
      // render in both the main view and the back-view window.
      world.faceHints.show();
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

      // Always-on back-view mini window (recon forces it).
      const backView = createBackView(THREE, SIZE, 120);
      backViewRef.current = backView;
      if (backFrameRef.current) backFrameRef.current.appendChild(backView.domElement);

      const resize = () => {
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (w <= 0 || h <= 0) return;
        world.width = w;
        world.height = h;
        world.resize();
        renderer.setSize(w, h, true);
        const bs = Math.round(Math.min(132, Math.max(72, Math.min(w, h) * 0.3)));
        const frame = backFrameRef.current;
        if (frame) {
          frame.style.width = `${bs}px`;
          frame.style.height = `${bs}px`;
        }
        backView.setSize(bs);
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
        (world.cube as import('@/app/[lang]/sim/engine/nxn/cube').default).dispose?.();
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

  // ── Order change → rebuild the puzzle, re-apply baseline ──
  useEffect(() => {
    orderRef.current = order;
    const world = worldRef.current;
    if (!ready || !world) return;
    if (world.puzzleKind !== order) world.setPuzzle(order);
    const target = applyStep(stepRef.current);
    if (target != null) setStep(target);
  }, [order, ready, applyStep, setStep]);

  // ── Scramble change → re-apply baseline, clamp step ──
  useEffect(() => {
    scrambleRef.current = scramble;
    if (!ready) return;
    const target = applyStep(stepRef.current);
    if (target != null) setStep(target);
  }, [scramble, ready, applyStep, setStep]);

  // ── Solution change → reparse moves, clamp step ──
  useEffect(() => {
    const toks = tokenize(alg);
    tokensRef.current = toks;
    setTotal(toks.length);
    if (!ready) return;
    const target = applyStep(Math.min(stepRef.current, toks.length));
    if (target != null) setStep(target);
  }, [alg, ready, applyStep, setStep]);

  // ── Animated playback (push one move at a time) ──
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const world = worldRef.current;
      const toks = tokensRef.current;
      const s = stepRef.current;
      if (!world || world.puzzleKind === 'sq1' || s >= toks.length) {
        setPlaying(false);
        return;
      }
      const cube = world.cube as import('@/app/[lang]/sim/engine/nxn/cube').default;
      cube.twister.push(toks[s]);
      setStep(s + 1);
    }, PLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [playing, setStep]);

  // ── Expose imperative handle for caret-driven scrubbing ──
  useEffect(() => {
    if (!playerRef) return;
    playerRef.current = {
      __kind: 'nxn-cuber' as const,
      jumpToMoveCount: (n: number) => jumpToStep(n),
    };
    return () => { if (playerRef.current?.__kind === 'nxn-cuber') playerRef.current = null; };
  }, [playerRef, jumpToStep]);

  const atEnd = step >= total;

  return (
    <div className={`cuber-recon-player${fillPane ? ' cuber-recon-player--fill' : ''}`}>
      <div ref={hostRef} className="cuber-recon-canvas">
        <div ref={backFrameRef} className="cuber-recon-backview" aria-hidden />
      </div>
      {!hideControls && (
      <div className="cuber-recon-controls">
        <button type="button" className="cuber-recon-ctrl-btn" onClick={() => jumpToStep(0)} disabled={step === 0} aria-label="Reset">
          <RotateCcw size={14} />
        </button>
        <button type="button" className="cuber-recon-ctrl-btn" onClick={() => jumpToStep(step - 1)} disabled={step === 0} aria-label="Step back">
          <SkipBack size={14} />
        </button>
        <button
          type="button"
          className="cuber-recon-ctrl-btn"
          onClick={() => { if (atEnd) jumpToStep(0); setPlaying(p => !p); }}
          disabled={total === 0}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button type="button" className="cuber-recon-ctrl-btn" onClick={() => jumpToStep(step + 1)} disabled={atEnd} aria-label="Step forward">
          <SkipForward size={14} />
        </button>
        <input
          type="range"
          className="cuber-recon-scrubber"
          min={0}
          max={Math.max(total, 1)}
          value={step}
          disabled={total === 0}
          onChange={e => jumpToStep(Number(e.target.value))}
          aria-label="Scrub solution"
        />
        <span className="cuber-recon-progress">{step} / {total}</span>
      </div>
      )}
    </div>
  );
}
