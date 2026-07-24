/**
 * mountSimWorld — the one copy of the "/sim engine in a box" lifecycle.
 *
 * The /sim engine (app/[lang]/sim/engine/world.ts) deliberately ships no
 * renderer and no render loop: `new World()` builds a scene + camera + puzzle
 * and nothing else. Every embedder therefore has to hand-roll the same ~90
 * lines — create a WebGLRenderer, append its canvas, mirror the host box into
 * `world.width/height` + `world.resize()`, run a rAF that renders only while
 * `world.dirty`, and tear all of it down again. This module is that lifecycle,
 * extracted once.
 *
 * WHY A PLAIN FUNCTION, NOT A HOOK:
 *   - hooks/ is a closed directory — every export there must be registered in
 *     the /code catalog and is React-only. This has to stay callable from the
 *     non-React path too (components/EnginePuzzleSVG.tsx builds a shared World
 *     at module scope, outside any component).
 *   - The lifecycle is imperative and effect-shaped anyway; a hook would only
 *     add a ref dance around it.
 *
 * three + the engine are imported statically HERE, so this whole module (and
 * with it three) stays out of the initial bundle as long as callers reach it
 * through `await import('@/components/sim-embed/mountSimWorld')` — which is
 * exactly what every existing embed already does with three itself.
 *
 * NOTE (2026-07-24): shipped as an extraction only. The four existing embeds —
 * components/recon/ReconPlayerBase.tsx, app/[lang]/scramble/solver/
 * _Interactive3DCube.tsx, components/PllPerformerOverlay.tsx and
 * components/EnginePuzzleSVG.tsx — still carry their own copies. Migrating them
 * one at a time is follow-up work, kept separate so a regression in any of them
 * can't be blamed on this file.
 */

import * as THREE from 'three';
import World, { type PuzzleKind } from '@/app/[lang]/sim/engine/world';
import { attachInteraction } from '@/app/[lang]/sim/worldInteraction';

export interface SimMountOpts {
  /** Element the canvas is appended to. Its client box drives the render size
   *  (observed with a ResizeObserver), so give it a real width/height. */
  host: HTMLElement;
  /** Puzzle to build. Default 3 (the World constructor already builds a 3x3,
   *  so the default costs nothing). */
  puzzle?: PuzzleKind;
  /** Attach the pointer Controller (drag-to-twist). Default false — a
   *  read-only embed must NOT attach it, or the controller fights whatever the
   *  embedder is doing with the cube/scene transform. */
  interactive?: boolean;
  /** Show the U/D/L/R/F/B orientation letters. Default false. */
  faceHints?: boolean;
  /** world.perspective override (framing tightness). Engine default is 5. */
  perspective?: number;
  /** Clamp for devicePixelRatio. Default 2 — a corner overlay on a 3x DPR
   *  phone does not need 9x the fragments. */
  pixelRatioCap?: number;
  /**
   * Per-frame hook, called before the dirty check with the ms since the last
   * frame. Return true to mark the world dirty (i.e. "I changed something,
   * please render"). This is the extension point the engine itself lacks —
   * gyro orientation, custom easing, anything that must run each frame.
   */
  onFrame?: (world: World, dtMs: number) => boolean;
}

export interface SimMount {
  world: World;
  renderer: THREE.WebGLRenderer;
  /** Force a render on the next frame (after mutating the cube/scene). */
  invalidate(): void;
  /** Stop the loop, drop the canvas, release the GL context. Idempotent. */
  dispose(): void;
}

export function mountSimWorld(opts: SimMountOpts): SimMount {
  const {
    host,
    puzzle = 3,
    interactive = false,
    faceHints = false,
    perspective,
    pixelRatioCap = 2,
    onFrame,
  } = opts;

  const world = new World();
  // Controller injection is opt-in: World's core is headless and the pointer
  // Controller is what makes an embed interactive. Omitting it is a supported
  // path (setPuzzle is null-safe about a missing controller).
  if (interactive) attachInteraction(world);
  // The constructor already ran setPuzzle(3); re-running it for 3 would rebuild
  // framing for nothing.
  if (puzzle !== 3) world.setPuzzle(puzzle);
  if (faceHints) world.faceHints.show();
  else world.faceHints.hide();
  if (perspective != null) world.perspective = perspective;

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.autoClear = false;
  renderer.setClearColor(0xffffff, 0);
  renderer.setPixelRatio(Math.min(pixelRatioCap, window.devicePixelRatio || 1));

  const canvas = renderer.domElement;
  canvas.style.outline = 'none';
  canvas.style.display = 'block';
  canvas.style.touchAction = 'none';
  host.appendChild(canvas);

  const resize = (): void => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w <= 0 || h <= 0) return;
    world.width = w;
    world.height = h;
    world.resize();
    renderer.setSize(w, h, true);
    world.dirty = true;
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  let raf = 0;
  let disposed = false;
  let lastFrameAt = performance.now();

  const loop = (): void => {
    const now = performance.now();
    const dt = now - lastFrameAt;
    lastFrameAt = now;
    if (onFrame?.(world, dt)) world.dirty = true;
    // Orientation letters fade in/out over several frames of their own.
    if (faceHints && world.faceHints.tick(dt)) world.dirty = true;
    // world.dirty proxies cube.dirty (world.ts) — both are read for parity with
    // the hand-rolled loops this replaces.
    if (world.dirty || world.cube.dirty) {
      renderer.clear();
      renderer.render(world.scene, world.camera);
      world.dirty = false;
      world.cube.dirty = false;
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return {
    world,
    renderer,
    invalidate(): void {
      world.dirty = true;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      // Controller owns document-level pointer listeners; stop it before the
      // canvas goes away or they outlive the mount.
      if (interactive) world.controller?.stop();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      (world.cube as { dispose?: () => void }).dispose?.();
      renderer.dispose();
      renderer.forceContextLoss?.();
    },
  };
}
