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
 *     the /dev catalog and is React-only. This lifecycle is also useful to
 *     imperative non-React embedders.
 *   - The lifecycle is imperative and effect-shaped anyway; a hook would only
 *     add a ref dance around it.
 *
 * three + the engine are imported statically HERE, so this whole module (and
 * with it three) stays out of the initial bundle as long as callers reach it
 * through `await import('@/components/sim-embed/mountSimWorld')` — which is
 * exactly what every existing embed already does with three itself.
 *
 * NOTE (2026-08-23): interactive WebGL embedders share this lifecycle.
 * EnginePuzzleSVG is not an embedder: it calls the headless SVG renderer from
 * @cuberoot/puzzle-render-core and owns no World/render lifecycle.
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
  /**
   * 镜头轨道角度(`scene.rotation`),弧度。省略 = 引擎自己的开局姿态
   * (`viewControls.HOME_SCENE_ROT`,等轴)。想正对一面传 `FRONT_SCENE_ROT`。
   *
   * 在挂载时摆而不是让调用方挂载后再改:后者会先按等轴画出一帧再跳过去。
   */
  sceneRot?: { x: number; y: number; z: number };
  /** Clamp for devicePixelRatio. Default 2. Embedded canvases supersample at
   *  2x for crisp cube edges; an explicit cap below 2 opts out for a cheaper
   *  overlay. */
  pixelRatioCap?: number;
  /**
   * Per-frame hook, called before the dirty check with the ms since the last
   * frame. Return true to mark the world dirty (i.e. "I changed something,
   * please render"). This is the extension point the engine itself lacks —
   * gyro orientation, custom easing, anything that must run each frame.
   */
  onFrame?: (world: World, dtMs: number) => boolean;
  /**
   * 主渲染刚画完时调用(只在真的渲染了那一帧)。给「跟着主视图一起画的第二个渲染器」
   * 用 —— 目前是 recon 播放器右下角那个 backView 小窗。
   */
  onRendered?: (world: World) => void;
  /**
   * 画布尺寸。默认取 host 的 client box;返回别的尺寸就按它渲染(PLL 表演浮层的
   * 立方体只占舞台的一小块,舞台还要留给桌宠的身体和爪子)。
   */
  measure?: (host: HTMLElement) => { width: number; height: number };
}

export interface SimMount {
  world: World;
  renderer: THREE.WebGLRenderer;
  /** Force a render on the next frame (after mutating the cube/scene). */
  invalidate(): void;
  /** Stop the loop, drop the canvas, release the GL context. Idempotent. */
  dispose(): void;
}

/** Match the full /sim renderer: small canvases need 2x supersampling even on
 *  a 1x desktop display, while the caller's cap remains the upper bound. */
export function resolveRenderPixelRatio(devicePixelRatio: number, cap: number): number {
  const safeDpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? devicePixelRatio
    : 1;
  const safeCap = Number.isFinite(cap) && cap > 0 ? cap : 2;
  return Math.min(safeCap, Math.max(safeDpr, 2));
}

type HintBackdropRenderer = { setHintBackdrop(color: string): void };

/** Inject the resolved page background into an NxN hint renderer. Non-NxN
 *  puzzles and hosts without a resolved token intentionally do nothing. */
export function syncSimHintBackdrop(
  puzzleKind: PuzzleKind,
  cube: unknown,
  backdrop: string,
): HintBackdropRenderer | null {
  const color = backdrop.trim();
  if (typeof puzzleKind !== 'number' || !color) return null;
  const current = (cube as { instancedRenderer?: HintBackdropRenderer } | null)?.instancedRenderer;
  if (!current) return null;
  current.setHintBackdrop(color);
  return current;
}

export function mountSimWorld(opts: SimMountOpts): SimMount {
  const {
    host,
    puzzle = 3,
    interactive = false,
    faceHints = false,
    perspective,
    sceneRot,
    pixelRatioCap = 2,
    onFrame,
    onRendered,
    measure,
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
  if (sceneRot) {
    world.scene.rotation.set(sceneRot.x, sceneRot.y, sceneRot.z);
    world.scene.updateMatrix();
  }

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.autoClear = false;
  renderer.setClearColor(0xffffff, 0);
  renderer.setPixelRatio(resolveRenderPixelRatio(window.devicePixelRatio, pixelRatioCap));

  const canvas = renderer.domElement;
  canvas.style.outline = 'none';
  canvas.style.display = 'block';
  canvas.style.touchAction = 'none';
  host.appendChild(canvas);

  const resize = (): void => {
    const box = measure?.(host);
    const w = box ? box.width : host.clientWidth;
    const h = box ? box.height : host.clientHeight;
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

  // NxN's floating back-sticker hints are opaque planes whose colors are
  // pre-mixed with the page backdrop. /sim injects --background through its
  // settings lifecycle; embeds have no settings drawer, so do the same here at
  // the shared render boundary. Track the renderer as well as the color because
  // setPuzzle() can replace an NxN renderer without changing the theme.
  let hintRenderer: HintBackdropRenderer | null = null;
  let hintBackdrop = '';
  const syncHintBackdrop = (): void => {
    const backdrop = getComputedStyle(host).getPropertyValue('--background').trim();
    const current = typeof world.puzzleKind === 'number'
      ? (world.cube as { instancedRenderer?: HintBackdropRenderer }).instancedRenderer ?? null
      : null;
    if (current === hintRenderer && backdrop === hintBackdrop) return;
    const synced = syncSimHintBackdrop(world.puzzleKind, world.cube, backdrop);
    if (!synced) return;
    hintRenderer = synced;
    hintBackdrop = backdrop;
  };

  const invalidateHintBackdrop = (): void => {
    hintRenderer = null;
    world.dirty = true;
  };
  const themeObserver = new MutationObserver(invalidateHintBackdrop);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'data-palette', 'data-contrast'],
  });
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  darkQuery.addEventListener('change', invalidateHintBackdrop);

  let raf = 0;
  let disposed = false;
  let lastFrameAt = performance.now();

  const loop = (): void => {
    const now = performance.now();
    const dt = now - lastFrameAt;
    lastFrameAt = now;
    if (onFrame?.(world, dt)) world.dirty = true;
    // Orientation letters fade in/out over several frames of their own.
    if (faceHints && world.faceHints.tick(dt, world.camera)) world.dirty = true;
    // world.dirty proxies cube.dirty (world.ts) — both are read for parity with
    // the hand-rolled loops this replaces.
    if (world.dirty || world.cube.dirty) {
      syncHintBackdrop();
      renderer.clear();
      renderer.render(world.scene, world.camera);
      onRendered?.(world);
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
      themeObserver.disconnect();
      darkQuery.removeEventListener('change', invalidateHintBackdrop);
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
