'use client';

/**
 * Sq1ReconPlayer — read-only Square-1 preview for the recon submit/detail flow.
 *
 * cubing.js TwistyPlayer renders SQ1 poorly, so the recon pages previously
 * skipped the player entirely for sq1. This component reuses the local cuber
 * WebGL engine (the same one /sim?puzzle=sq1 drives) to show the scramble +
 * solution with play / step / scrub controls.
 *
 * three + the cuber World are lazy-imported inside the mount effect so the
 * ~1.2MB three bundle stays out of pages that never select sq1 (mirrors
 * TwistySection's lazy cubing.js import).
 *
 * Cursor sync: when `playerRef` is given, the instance exposes
 * `{ __kind: 'sq1', jumpToMoveCount(n) }` so the form's caret handler can scrub
 * the cube as the user clicks through the solution text.
 */

import {
  useCallback, useEffect, useRef, useState, type RefObject,
} from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import { parseSq1Tokens } from '@/lib/sq1-svg';
import type World from '@/app/[lang]/sim/engine/world';
import type Sq1Cube from '@/app/[lang]/sim/engine/sq1/Sq1Cube';
import type { Sq1Move } from '@/app/[lang]/sim/engine/sq1/sq1State';
import type { BackView } from '@/app/[lang]/sim/engine/backView';
import './Sq1ReconPlayer.css';

const PLAY_INTERVAL_MS = 520;

export default function Sq1ReconPlayer({
  scramble, alg, fillPane = false, playerRef, backView = false,
}: {
  scramble: string;
  alg: string;
  fillPane?: boolean;
  /** Show an always-on back-view mini window (recon submit forces it). */
  backView?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playerRef?: RefObject<any>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const backFrameRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const backViewRef = useRef<BackView | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rendererRef = useRef<any>(null);
  const scrambleRef = useRef(scramble);
  const actionsRef = useRef<Sq1Move[]>(parseSq1Tokens(alg) as Sq1Move[]);
  const stepRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [step, setStepState] = useState(0);
  const [total, setTotal] = useState(actionsRef.current.length);
  const [playing, setPlaying] = useState(false);

  const setStep = useCallback((n: number) => {
    stepRef.current = n;
    setStepState(n);
  }, []);

  /** Reset to the scramble, then snap the first `n` solution moves on top. */
  const applyStep = useCallback((n: number) => {
    const world = worldRef.current;
    if (!world || world.puzzleKind !== 'sq1') return;
    const cube = world.cube as Sq1Cube;
    cube.twister.finish();
    cube.twister.setup(scrambleRef.current);
    const acts = actionsRef.current;
    const target = Math.max(0, Math.min(n, acts.length));
    for (let i = 0; i < target; i++) cube.applyMoveInstant(acts[i]);
    world.dirty = true;
    return target;
  }, []);

  const jumpToStep = useCallback((n: number) => {
    setPlaying(false);
    const target = applyStep(n);
    if (target != null) setStep(target);
  }, [applyStep, setStep]);

  // ── Mount: lazy-load three + cuber World, build sq1, render loop, orbit drag ──
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      const THREE = await import('three');
      const { default: World } = await import('@/app/[lang]/sim/engine/world');
      if (cancelled) return;
      const host = hostRef.current;
      if (!host) return;

      // Optional always-on back-view window (recon submit forces it).
      let mkBackView: ((px: number) => BackView) | null = null;
      if (backView) {
        const { SIZE } = await import('@/app/[lang]/sim/engine/define');
        const { createBackView } = await import('@/app/[lang]/sim/engine/backView');
        if (cancelled) return;
        mkBackView = (px: number) => createBackView(THREE, SIZE, px);
      }

      const world = new World();
      world.setPuzzle('sq1');
      // Orientation letters (U/D/L/R/F/B) — shown when the back view is forced
      // (recon submit), hidden elsewhere (detail / SolutionView) as before.
      if (backView) world.faceHints.show(); else world.faceHints.hide();
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
        (world.cube as Sq1Cube).dispose?.();
        renderer.dispose();
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

  // ── Scramble change → re-apply baseline, clamp step ──
  useEffect(() => {
    scrambleRef.current = scramble;
    if (!ready) return;
    const target = applyStep(stepRef.current);
    if (target != null) setStep(target);
  }, [scramble, ready, applyStep, setStep]);

  // ── Solution change → reparse moves, clamp step ──
  useEffect(() => {
    const acts = parseSq1Tokens(alg) as Sq1Move[];
    actionsRef.current = acts;
    setTotal(acts.length);
    if (!ready) return;
    const target = applyStep(Math.min(stepRef.current, acts.length));
    if (target != null) setStep(target);
  }, [alg, ready, applyStep, setStep]);

  // ── Animated playback ──
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const world = worldRef.current;
      const acts = actionsRef.current;
      const s = stepRef.current;
      if (!world || world.puzzleKind !== 'sq1' || s >= acts.length) {
        setPlaying(false);
        return;
      }
      (world.cube as Sq1Cube).twister.twist(acts[s], false, true);
      setStep(s + 1);
    }, PLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [playing, setStep]);

  // ── Expose imperative handle for caret-driven scrubbing ──
  useEffect(() => {
    if (!playerRef) return;
    playerRef.current = {
      __kind: 'sq1' as const,
      jumpToMoveCount: (n: number) => jumpToStep(n),
    };
    return () => { if (playerRef.current?.__kind === 'sq1') playerRef.current = null; };
  }, [playerRef, jumpToStep]);

  const atEnd = step >= total;

  return (
    <div className={`sq1-recon-player${fillPane ? ' sq1-recon-player--fill' : ''}`}>
      <div ref={hostRef} className="sq1-recon-canvas">
        {backView && <div ref={backFrameRef} className="sq1-recon-backview" aria-hidden />}
      </div>
      <div className="sq1-recon-controls">
        <button type="button" onClick={() => jumpToStep(0)} disabled={step === 0} aria-label="Reset">
          <RotateCcw size={14} />
        </button>
        <button type="button" onClick={() => jumpToStep(step - 1)} disabled={step === 0} aria-label="Step back">
          <SkipBack size={14} />
        </button>
        <button
          type="button"
          onClick={() => { if (atEnd) jumpToStep(0); setPlaying(p => !p); }}
          disabled={total === 0}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button type="button" onClick={() => jumpToStep(step + 1)} disabled={atEnd} aria-label="Step forward">
          <SkipForward size={14} />
        </button>
        <input
          type="range"
          className="sq1-recon-scrubber"
          min={0}
          max={Math.max(total, 1)}
          value={step}
          disabled={total === 0}
          onChange={e => jumpToStep(Number(e.target.value))}
          aria-label="Scrub solution"
        />
        <span className="sq1-recon-progress">{step} / {total}</span>
      </div>
    </div>
  );
}
