'use client';

/**
 * /sim — 虚拟魔方 Playground / Player / Algs / Director (Next.js port).
 *
 * Vite source: packages/client/src/pages/sim/SimPage.tsx.
 *
 * Twisty puzzles (pyraminx / skewb / megaminx) render via cubing.js
 * TwistyPlayer (see components/TwistySection). NxN + SQ1 use the local
 * huazhechen/cuber WebGL engine in cuber/.
 */

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useQueryStates, parseAsString } from 'nuqs';
import { useTranslation } from 'react-i18next';
import HomeLink from '@/components/HomeLink';
// THREE is type-only at module scope — runtime instance is dynamically imported
// inside the world-init effect so the ~1.2MB three bundle doesn't ship with
// pyraminx/skewb/megaminx (which use cubing.js TwistyPlayer, not THREE).
import type * as THREE from 'three';
import {
  ChevronLeft, ChevronRight,
  BookOpen, Film,
  Maximize2, Minimize2,
} from 'lucide-react';
import World from './cuber/world';
import type Cube from './cuber/cube';
import Cubelet from './cuber/cubelet';
import Toucher from './Toucher';
import { TwistAction } from './cuber/twister';
import CubeGroup from './cuber/group';
import Sq1Cube from './cuber/sq1/Sq1Cube';
import tweener from './cuber/tweener';
import {
  sq1DragStart, sq1DragDelta, sq1DragApply, sq1DragCommit,
  type Sq1DragStart,
} from './cuber/sq1/sq1Drag';
import { moveToString as sq1MoveToString } from './cuber/sq1/sq1State';
import { FACE } from './cuber/define';
import { toWca as toWcaSkewb, type SkewbNotation } from '@cuberoot/shared/skewb-notation';
import TwistySection from '@/components/TwistySection';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  loadSettings, saveSettings, applySettings,
  mapOrbitK, mapTurnDragFactor, type SimSettings,
} from './SettingDrawer';
import PlayerControls, { type SimPuzzle } from './PlayerControls';
import AlgsPanel from './AlgsPanel';
import DirectorPanel from './DirectorPanel';
import {
  loadKeymap, saveKeymap, resetKeymap as resetKeymapStorage, type KeyMove,
} from './keymap';
import './sim.css';
import i18n from "@/i18n/i18n-client";
import { useT } from "@/hooks/useT";

/** Twisty puzzles rendered by cubing.js (not the local cuber engine). */
export const TWISTY_PUZZLES = ['pyraminx', 'skewb', 'megaminx'] as const;
export type TwistyPuzzle = typeof TWISTY_PUZZLES[number];
export function isTwistyPuzzle(p: SimPuzzle): p is TwistyPuzzle {
  return p === 'pyraminx' || p === 'skewb' || p === 'megaminx';
}

/** Narrow `world.cube` to the NxN Cube type. Returns null for SQ1. */
function asNxN(world: World): Cube | null {
  return world.puzzleKind === 'sq1' ? null : (world.cube as Cube);
}

/** 3x3 sticker click rules. See Vite original for the geometry derivation. */
const CLICK_RULES_3X3: Record<string, { sign: string; reverse: boolean }> = {
  '3_0_2_2': { sign: 'F', reverse: true },
  '3_2_2_2': { sign: 'F', reverse: false },
  '3_0_2_0': { sign: 'B', reverse: false },
  '3_2_2_0': { sign: 'B', reverse: true },
  '3_0_2_1': { sign: 'S', reverse: true },
  '3_2_2_1': { sign: 'S', reverse: false },
  '3_1_2_2': { sign: 'M', reverse: false },
  '3_1_2_0': { sign: 'M', reverse: true },
  '5_0_2_2': { sign: 'U', reverse: false },
  '5_2_2_2': { sign: 'U', reverse: true },
  '5_0_0_2': { sign: 'D', reverse: true },
  '5_2_0_2': { sign: 'D', reverse: false },
  '5_1_2_2': { sign: 'M', reverse: true },
  '5_1_0_2': { sign: 'M', reverse: false },
  '5_0_1_2': { sign: 'E', reverse: true },
  '5_2_1_2': { sign: 'E', reverse: false },
  '1_2_1_2': { sign: 'E', reverse: true },
  '1_2_1_0': { sign: 'E', reverse: true },
  '1_2_0_0': { sign: 'D', reverse: false },
  '0_0_2_2': { sign: 'U', reverse: true },
  '0_0_2_0': { sign: 'U', reverse: false },
  '0_0_0_2': { sign: 'D', reverse: false },
  '0_0_0_0': { sign: 'D', reverse: true },
  '0_0_2_1': { sign: 'S', reverse: false },
  '0_0_0_1': { sign: 'S', reverse: true },
  '0_0_1_2': { sign: 'E', reverse: false },
  '0_0_1_0': { sign: 'E', reverse: true },
};

interface SimCubeMin {
  history: { moves: number; redoStack: unknown[] };
  twister: {
    undo: () => void;
    redo: () => void;
    twist: (a: TwistAction, fast: boolean, force: boolean) => boolean;
    setup: (e: string) => void;
    push: (e: string) => void;
  };
  callbacks: (() => void)[];
  complete: boolean;
  dirty: boolean;
}

export default function SimPage() {
  const { i18n } = useTranslation();
  const t = useT();
  useDocumentTitle('模拟器', 'Sim', "模擬器");

  // Sim editor state in the URL (replace semantics — not navigation).
  // puzzle defaults to '3' (absent reads as 3, and '3' is auto-omitted from
  // the URL by clearOnDefault, so no explicit default-write effect is needed).
  const [query, setQuery] = useQueryStates(
    {
      puzzle: parseAsString.withDefault('3'),
      alg: parseAsString,
      setup: parseAsString,
    },
    { history: 'replace', scroll: false },
  );

  const algParam = query.alg || '';
  const setupParam = query.setup || '';

  const puzzleParam: SimPuzzle = useMemo(() => {
    const raw = query.puzzle;
    if (!raw) return 3;
    if (raw === 'sq1') return 'sq1';
    if (raw === 'pyraminx' || raw === 'skewb' || raw === 'megaminx') return raw;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1 || n > 400) return 3;
    return n;
  }, [query.puzzle]);
  const twisty = isTwistyPuzzle(puzzleParam);

  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const toucherRef = useRef<Toucher | null>(null);
  const wasCompleteRef = useRef(false);
  const userMoveRef = useRef<((action: TwistAction | string) => void) | null>(null);
  // pyraminx / skewb / megaminx TwistyPlayer instance — used by PlayerControls
  // to jumpToStart + play during animateScramble.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const twistyPlayerRef = useRef<any>(null);

  const [order, setOrder] = useState<number>(3);
  const [puzzleKind, setPuzzleKind] = useState<SimPuzzle>(3);
  const [fullscreen, setFullscreen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem('sim.fullscreen') === '1'; } catch { return false; }
  });
  // Skewb notation choice — only meaningful when puzzleKind === 'skewb'.
  const [skewbNotation, setSkewbNotationState] = useState<SkewbNotation>(() => {
    if (typeof window === 'undefined') return 'wca';
    try { return localStorage.getItem('sim.skewb.notation') === 'sarah' ? 'sarah' : 'wca'; }
    catch { return 'wca'; }
  });
  const setSkewbNotation = useCallback((n: SkewbNotation) => {
    setSkewbNotationState(n);
    try { localStorage.setItem('sim.skewb.notation', n); } catch { /* private */ }
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem('sim.fullscreen', fullscreen ? '1' : '0'); } catch { /* private */ }
  }, [fullscreen]);

  const [worldTick, setWorldTick] = useState(0);
  const [settings, setSettings] = useState<SimSettings>(() => loadSettings());
  const [keymap, setKeymap] = useState<Record<string, KeyMove>>(() => loadKeymap());
  const keymapRef = useRef(keymap);
  useEffect(() => { keymapRef.current = keymap; saveKeymap(keymap); }, [keymap]);

  const [algsOpen, setAlgsOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem('sim.panel.algs') === '1'; } catch { return false; }
  });
  const [directorOpen, setDirectorOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem('sim.panel.director') === '1'; } catch { return false; }
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem('sim.panel.algs', algsOpen ? '1' : '0'); } catch { /* private */ }
  }, [algsOpen]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem('sim.panel.director', directorOpen ? '1' : '0'); } catch { /* private */ }
  }, [directorOpen]);

  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const ensureCubeCallback = useCallback(() => {
    const w = worldRef.current;
    if (!w) return;
    const cube = w.cube as unknown as SimCubeMin;
    const tag = '_simBound';
    const cubeAny = cube as unknown as Record<string, unknown>;
    if (cubeAny[tag]) return;
    cubeAny[tag] = true;
    cube.callbacks.push(() => {
      const wnow = worldRef.current;
      if (!wnow) return;
      const c = wnow.cube as unknown as SimCubeMin;
      wasCompleteRef.current = c.complete;
    });
  }, []);

  // World init. Twisty puzzles (pyraminx/skewb/megaminx) don't use the cuber
  // engine — they render via cubing.js TwistyPlayer in <TwistySection> below.
  // [twisty] in deps lets cleanup tear down a live cuber instance when the
  // user switches NxN ↔ twisty.
  useEffect(() => {
    if (twisty) return;
    if (worldRef.current) return;
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      // Dynamic import — keeps three (~1.2MB) out of the initial sim bundle.
      // Only NxN / SQ1 puzzles instantiate the renderer; twisty puzzles
      // (pyraminx/skewb/megaminx) skip this effect via the `twisty` guard.
      const THREE = await import('three');
      if (cancelled) return;

    const world = new World();
    worldRef.current = world;
    setWorldTick((n) => n + 1);

    const renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: true, preserveDrawingBuffer: true,
    });
    renderer.autoClear = false;
    renderer.setClearColor(0xffffff, 0);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);
    renderer.domElement.style.outline = 'none';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.display = 'block';

    const toucher = new Toucher();
    toucher.init(renderer.domElement, world.controller.touch);
    toucherRef.current = toucher;

    const Q = Math.PI / 2;
    world.controller.onOrbit = (dx, dy) => {
      const k = mapOrbitK(settingsRef.current.sensitivity);
      world.scene.rotation.y += dx * k;
      world.scene.rotation.x += dy * k;
      const cube = asNxN(world);
      if (settingsRef.current.dragEmpty === 'view') {
        world.scene.updateMatrix();
        world.dirty = true;
        return;
      }
      if (cube) {
        let safety = 8;
        while (world.scene.rotation.y > Q && safety-- > 0) {
          const action = new TwistAction('y', true, 1);
          cube.twister.twist(action, true, true);
          userMoveRef.current?.(action);
          world.scene.rotation.y -= Q;
        }
        safety = 8;
        while (world.scene.rotation.y < -Q && safety-- > 0) {
          const action = new TwistAction('y', false, 1);
          cube.twister.twist(action, true, true);
          userMoveRef.current?.(action);
          world.scene.rotation.y += Q;
        }
        safety = 8;
        while (world.scene.rotation.x > Q && safety-- > 0) {
          const action = new TwistAction('x', true, 1);
          cube.twister.twist(action, true, true);
          userMoveRef.current?.(action);
          world.scene.rotation.x -= Q;
        }
        safety = 8;
        while (world.scene.rotation.x < -Q && safety-- > 0) {
          const action = new TwistAction('x', false, 1);
          cube.twister.twist(action, true, true);
          userMoveRef.current?.(action);
          world.scene.rotation.x += Q;
        }
      } else {
        world.scene.rotation.x = Math.max(-Q, Math.min(Q, world.scene.rotation.x));
      }
      world.scene.updateMatrix();
      world.dirty = true;
    };

    world.controller.taps.push((idx, face, opts) => {
      if (face === null) return;
      const cube = asNxN(world);
      if (!cube) return;
      const N = cube.order;
      const x = idx % N;
      const y = Math.floor((idx % (N * N)) / N);
      const z = Math.floor(idx / (N * N));
      const modInvert = opts.shift || opts.button === 2;

      if (N === 3) {
        const rule = CLICK_RULES_3X3[`${face}_${x}_${y}_${z}`];
        if (rule) {
          const action = new TwistAction(rule.sign, rule.reverse !== modInvert, 1);
          cube.twister.twist(action, false, true);
          userMoveRef.current?.(action);
          return;
        }
      }

      let axis: 'x' | 'y' | 'z';
      let layer: number;
      switch (face) {
        case FACE.U: axis = 'z'; layer = z; break;
        case FACE.F: axis = 'y'; layer = y; break;
        case FACE.R: axis = 'y'; layer = y; break;
        case FACE.L: axis = 'y'; layer = y; break;
        default: return;
      }
      const reverse = opts.shift || opts.button === 2;
      const group = cube.table.groups[axis]?.[layer];
      if (!group) return;
      let sign: string;
      if (N === 1) {
        sign = axis;
      } else {
        sign = opts.alt ? CubeGroup.wideFromClick(axis, layer, N).sign : group.name;
      }
      const action = new TwistAction(sign, reverse, 1);
      cube.twister.twist(action, false, true);
      userMoveRef.current?.(action);
    });

    world.controller.userTwist.push((action) => {
      userMoveRef.current?.(action);
    });

    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    renderer.domElement.addEventListener('contextmenu', onContextMenu);

    ensureCubeCallback();
    applySettings(world, settings);

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      world.width = w;
      world.height = h;
      world.resize();
      renderer.setSize(w, h, true);
      world.dirty = true;
    };
    resize();
    window.addEventListener('resize', resize);
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const SCALE_MIN = 0.3;
    const SCALE_MAX = Infinity;
    const settingsFromScale = (s: number) => Math.round((s - 0.5) * 100);
    let scaleSyncTimer: number | null = null;
    const syncScaleToSettings = () => {
      if (scaleSyncTimer) window.clearTimeout(scaleSyncTimer);
      scaleSyncTimer = window.setTimeout(() => {
        const w = worldRef.current;
        if (!w) return;
        if (w.scale < 0.5 || w.scale > 1.5) return;
        const v = Math.max(0, Math.min(100, settingsFromScale(w.scale)));
        setSettings((prev) => prev.scale === v ? prev : { ...prev, scale: v });
      }, 250);
    };
    const onWheel = (e: WheelEvent) => {
      if (settingsRef.current.lockView) return;
      e.preventDefault();
      const w = worldRef.current;
      if (!w) return;
      const oldScale = w.scale;
      const newScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, oldScale * (e.deltaY > 0 ? 0.92 : 1.08)));
      if (newScale === oldScale) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      const minDim = Math.min(w.width, w.height);
      const halfH = (Cubelet.SIZE * 3 * w.height) / (minDim * oldScale);
      const halfW = halfH * (w.width / w.height);
      const tFac = 1 - oldScale / newScale;
      w.panX += nx * halfW * tFac;
      w.panY += ny * halfH * tFac;
      w.scale = newScale;
      w.resize();
      syncScaleToSettings();
    };
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    const screenDeltaToWorld = (dxPx: number, dyPx: number) => {
      const w = worldRef.current;
      if (!w) return { x: 0, y: 0 };
      const cubeWorldSize = Cubelet.SIZE * 3;
      const px = w.height;
      const k = (cubeWorldSize / w.scale) / Math.max(px, 1);
      return { x: -dxPx * k, y: dyPx * k };
    };

    // Pointer state for pinch / pan / SQ1 drag.
    const activePointers = new Map<number, { x: number; y: number }>();
    let pinchStartDist = 0;
    let pinchStartScale = 0;
    let pinchStartCenter = { x: 0, y: 0 };
    let pinchStartPan = { x: 0, y: 0 };
    let pinching = false;
    let mousePanning = false;
    let panLastX = 0;
    let panLastY = 0;
    let sq1Rotating = false;
    let sq1LastX = 0;
    let sq1LastY = 0;
    let sq1Drag: Sq1DragStart | null = null;
    let sq1DragLastDelta = 0;
    const SQ1_DRAG_THRESHOLD_PX = 4;
    let sq1Pending = false;
    let sq1DownX = 0;
    let sq1DownY = 0;
    let sq1MovedPastThreshold = false;
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && (e.button === 2 || e.button === 1)) {
        e.preventDefault();
        if (settingsRef.current.lockView) return;
        mousePanning = true;
        panLastX = e.clientX;
        panLastY = e.clientY;
        renderer.domElement.setPointerCapture(e.pointerId);
        return;
      }
      if (worldRef.current?.puzzleKind === 'sq1' && (e.pointerType !== 'mouse' || e.button === 0)) {
        const isTouchMulti = e.pointerType === 'touch' && activePointers.size >= 1;
        if (!isTouchMulti) {
          const r0 = renderer.domElement.getBoundingClientRect();
          sq1DownX = e.clientX - r0.left;
          sq1DownY = e.clientY - r0.top;
          sq1Pending = true;
          sq1MovedPastThreshold = false;
          sq1Drag = null;
          sq1DragLastDelta = 0;
          sq1Rotating = false;
          sq1LastX = e.clientX;
          sq1LastY = e.clientY;
          if (e.pointerType !== 'touch') renderer.domElement.setPointerCapture(e.pointerId);
        }
        if (e.pointerType === 'touch') {
          activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (activePointers.size === 2) {
            sq1Drag = null;
            sq1Rotating = false;
            sq1Pending = false;
            sq1MovedPastThreshold = false;
          }
        }
        if (e.pointerType !== 'touch') return;
      }
      if (e.pointerType !== 'touch') return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size === 2) {
        const [a, b] = [...activePointers.values()];
        pinchStartDist = dist(a, b);
        pinchStartScale = world.scale;
        pinchStartCenter = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        pinchStartPan = { x: world.panX, y: world.panY };
        pinching = true;
        sq1Rotating = false;
        world.controller.disable = true;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (mousePanning && e.pointerType === 'mouse') {
        const d = screenDeltaToWorld(e.clientX - panLastX, e.clientY - panLastY);
        panLastX = e.clientX;
        panLastY = e.clientY;
        world.panX += d.x;
        world.panY += d.y;
        world.resize();
        return;
      }
      if (worldRef.current?.puzzleKind === 'sq1') {
        const rmove = renderer.domElement.getBoundingClientRect();
        const localX = e.clientX - rmove.left;
        const localY = e.clientY - rmove.top;
        if (sq1Drag && sq1Drag.kind === 'turn') {
          const w = worldRef.current;
          const d = sq1DragDelta(sq1Drag, w.scene, w.camera, localX, localY, w.width, w.height);
          if (d != null) {
            const scaled = d * mapTurnDragFactor(settingsRef.current.sensitivity);
            sq1DragLastDelta = scaled;
            sq1DragApply(sq1Drag, scaled);
            w.dirty = true;
          }
          return;
        }
        if (sq1Rotating) {
          const dx = e.clientX - sq1LastX;
          const dy = e.clientY - sq1LastY;
          sq1LastX = e.clientX;
          sq1LastY = e.clientY;
          const k = mapOrbitK(settingsRef.current.sensitivity);
          world.scene.rotation.y += dx * k;
          world.scene.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, world.scene.rotation.x + dy * k));
          world.scene.updateMatrix();
          world.dirty = true;
          return;
        }
        if (sq1Pending && !sq1MovedPastThreshold && !pinching) {
          const dx = localX - sq1DownX;
          const dy = localY - sq1DownY;
          if (Math.hypot(dx, dy) >= SQ1_DRAG_THRESHOLD_PX) {
            sq1MovedPastThreshold = true;
            const w = worldRef.current;
            const c = w.cube;
            if (c instanceof Sq1Cube) {
              c.twister.finish();
              tweener.finish();
              sq1Drag = sq1DragStart(c, w.scene, w.camera, sq1DownX, sq1DownY, w.width, w.height);
            }
            if (sq1Drag?.kind === 'slice') {
              const c2 = w.cube as Sq1Cube;
              const sliceDir: 1 | -1 = (localY < sq1DownY) ? -1 : 1;
              const ok = c2.twister.twist({ kind: 'slice' }, false, true, sliceDir);
              if (ok) userMoveRef.current?.(new TwistAction('/', false, 1));
              sq1Drag = null;
            } else if (sq1Drag) {
              if (sq1Drag.startEastHalf && Math.abs(dy) > Math.abs(dx) * 1.5) {
                const c2 = w.cube as Sq1Cube;
                const sliceDir: 1 | -1 = (dy < 0) ? -1 : 1;
                const ok = c2.twister.twist({ kind: 'slice' }, false, true, sliceDir);
                if (ok) userMoveRef.current?.(new TwistAction('/', false, 1));
                sq1Drag = null;
                return;
              }
              const d = sq1DragDelta(sq1Drag, w.scene, w.camera, localX, localY, w.width, w.height);
              if (d != null) {
                const scaled = d * mapTurnDragFactor(settingsRef.current.sensitivity);
                sq1DragLastDelta = scaled;
                sq1DragApply(sq1Drag, scaled);
                w.dirty = true;
              }
            } else {
              sq1Rotating = true;
              sq1LastX = sq1DownX + rmove.left;
              sq1LastY = sq1DownY + rmove.top;
              const dx2 = e.clientX - sq1LastX;
              const dy2 = e.clientY - sq1LastY;
              sq1LastX = e.clientX;
              sq1LastY = e.clientY;
              const k = mapOrbitK(settingsRef.current.sensitivity);
              world.scene.rotation.y += dx2 * k;
              world.scene.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, world.scene.rotation.x + dy2 * k));
              world.scene.updateMatrix();
              world.dirty = true;
            }
            return;
          }
        }
      }
      if (e.pointerType !== 'touch') return;
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinching && activePointers.size === 2) {
        e.preventDefault();
        if (settingsRef.current.lockView) return;
        const [a, b] = [...activePointers.values()];
        const ratio = dist(a, b) / Math.max(pinchStartDist, 1);
        world.scale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, pinchStartScale * ratio));
        const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const d = screenDeltaToWorld(center.x - pinchStartCenter.x, center.y - pinchStartCenter.y);
        world.panX = pinchStartPan.x + d.x;
        world.panY = pinchStartPan.y + d.y;
        world.resize();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (mousePanning && e.pointerType === 'mouse') {
        mousePanning = false;
        try { renderer.domElement.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
        return;
      }
      if (sq1Drag && sq1Drag.kind === 'turn') {
        const w = worldRef.current;
        if (w) {
          const c = w.cube;
          if (c instanceof Sq1Cube) {
            const move = sq1DragCommit(c, sq1Drag, sq1DragLastDelta);
            if (move) userMoveRef.current?.(new TwistAction(sq1MoveToString(move), false, 1));
          }
        }
        sq1Drag = null;
        sq1DragLastDelta = 0;
        sq1MovedPastThreshold = false;
        sq1Pending = false;
        try { renderer.domElement.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      }
      if (sq1Rotating) {
        sq1Rotating = false;
        sq1MovedPastThreshold = false;
        sq1Pending = false;
        if (settingsRef.current?.dragEmpty === 'rotate') {
          const q = Math.PI / 2;
          world.scene.rotation.y = Math.round(world.scene.rotation.y / q) * q;
          world.scene.rotation.x = Math.round(world.scene.rotation.x / q) * q;
          world.scene.updateMatrix();
          world.dirty = true;
        }
        try { renderer.domElement.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      }
      if (sq1Pending && !sq1MovedPastThreshold && worldRef.current?.puzzleKind === 'sq1') {
        const w = worldRef.current;
        if (w.cube instanceof Sq1Cube) {
          const hit = sq1DragStart(w.cube, w.scene, w.camera, sq1DownX, sq1DownY, w.width, w.height);
          if (hit?.kind === 'slice') {
            const ok = w.cube.twister.twist({ kind: 'slice' }, false, true, 1);
            if (ok) userMoveRef.current?.(new TwistAction('/', false, 1));
          }
        }
      }
      sq1Pending = false;
      if (e.pointerType !== 'touch') return;
      activePointers.delete(e.pointerId);
      if (pinching && activePointers.size < 2) {
        pinching = false;
        world.controller.disable = worldRef.current?.puzzleKind === 'sq1';
        syncScaleToSettings();
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove, { passive: false });
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);

    let raf = 0;
    let lastFrameAt = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = now - lastFrameAt;
      lastFrameAt = now;
      const viewing = world.puzzleKind === 'sq1'
        ? sq1Rotating
        : world.controller.isViewRotating;
      if (viewing) world.faceHints.show();
      else world.faceHints.hide();
      if (world.faceHints.tick(dt)) world.dirty = true;
      if (world.dirty || world.cube.dirty) {
        renderer.clear();
        renderer.render(world.scene, world.camera);
        world.dirty = false;
        world.cube.dirty = false;
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        ro.disconnect();
        renderer.domElement.removeEventListener('wheel', onWheel);
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        renderer.domElement.removeEventListener('pointercancel', onPointerUp);
        renderer.domElement.removeEventListener('contextmenu', onContextMenu);
        if (scaleSyncTimer) window.clearTimeout(scaleSyncTimer);
        toucher.destroy();
        if (renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
        renderer.dispose();
        worldRef.current = null;
        rendererRef.current = null;
        toucherRef.current = null;
      };
      // If unmount happened during the await above, the cancelled-check at
      // the top short-circuits; if it happens here (between resolve and
      // cleanup assignment), the outer return below catches it.
      if (cancelled) cleanup();
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twisty]);

  const handlePuzzle = useCallback((kind: SimPuzzle) => {
    setPuzzleKind(kind);
    if (typeof kind === 'number') setOrder(kind);
    const world = worldRef.current;
    // kind === 3 → null clears `puzzle` (it's the default, auto-omitted anyway).
    const writeUrl = () => setQuery({ puzzle: kind === 3 ? null : String(kind) });
    // Twisty puzzles don't use World — just update URL. The world-init
    // effect's [twisty] dep tears down the live cuber instance.
    if (isTwistyPuzzle(kind)) { writeUrl(); return; }
    if (!world || world.puzzleKind === kind) { writeUrl(); return; }
    world.setPuzzle(kind);
    wasCompleteRef.current = true;
    ensureCubeCallback();
    applySettings(world, settingsRef.current);
    writeUrl();
  }, [ensureCubeCallback, setQuery]);

  const handleOrder = useCallback((n: number) => {
    handlePuzzle(n);
  }, [handlePuzzle]);

  // URL puzzle param → cube. For twisty puzzles there's no world to sync —
  // mirror to local puzzleKind state so PlayerControls renders correctly.
  useEffect(() => {
    if (isTwistyPuzzle(puzzleParam)) {
      setPuzzleKind(puzzleParam);
      return;
    }
    if (!worldRef.current) return;
    if (worldRef.current.puzzleKind === puzzleParam) return;
    handlePuzzle(puzzleParam);
  }, [puzzleParam, handlePuzzle, worldTick]);

  const prevSettingsRef = useRef<SimSettings | null>(null);
  useEffect(() => {
    saveSettings(settings);
    const world = worldRef.current;
    if (world) applySettings(world, settings, prevSettingsRef.current ?? undefined);
    prevSettingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reapply = () => {
      const w = worldRef.current;
      if (w) applySettings(w, settings);
    };
    const mo = new MutationObserver(reapply);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', reapply);
    return () => { mo.disconnect(); mq.removeEventListener('change', reapply); };
  }, [settings]);

  const handleUndo = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    world.cube.twister.undo();
  }, []);

  const handleRedo = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    world.cube.twister.redo();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyZ')) {
        e.preventDefault();
        if (e.shiftKey) handleRedo(); else handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyY')) {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (e.code === 'Backspace') {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = keymapRef.current[e.code];
      if (!k) return;
      e.preventDefault();
      const world = worldRef.current;
      if (!world) return;
      const cube = asNxN(world);
      if (!cube) return;
      const action = new TwistAction(k.sign, k.reverse, 1);
      cube.twister.twist(action, false, true);
      userMoveRef.current?.(action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo]);

  const onAlgChange = useCallback((alg: string) => {
    setQuery({ alg: alg || null });
  }, [setQuery]);

  const onSetupChange = useCallback((setup: string) => {
    setQuery({ setup: setup || null });
  }, [setQuery]);

  const onAlgPick = useCallback((setup: string, alg: string) => {
    const world = worldRef.current;
    if (!world) return;
    world.cube.twister.setup(setup);
    setQuery({ setup: setup || null, alg: alg || null });
  }, [setQuery]);

  const getCanvas = useCallback((): HTMLCanvasElement | null => {
    return rendererRef.current?.domElement ?? null;
  }, []);
  const getWorld = useCallback((): World | null => worldRef.current, []);
  const getRenderer = useCallback((): THREE.WebGLRenderer | null => rendererRef.current, []);

  return (
    <div className={`sim-page${fullscreen ? ' sim-page--fullscreen' : ''}${settings.checkeredBg ? ' sim-page--checkered' : ''}`}>
      <header className="sim-header">
        <HomeLink className="sim-back" title={t('返回', 'Back')}>
          <ChevronLeft size={18} />
        </HomeLink>
        <h1 className="sim-title">{t('模拟', 'Sim', "模擬")}</h1>
        <div className="sim-spacer" />
      </header>

      <div className="sim-body">
        <div className="sim-canvas-wrap" ref={containerRef}>
          {twisty ? (
            <TwistySection
              puzzle={puzzleParam}
              // Skewb-only: translate Sarah → WCA so cubing.js plays the alg the
              // user intended. URL stays in original notation; TwistyPlayer sees
              // WCA. For pyraminx/megaminx, pass through.
              scramble={puzzleParam === 'skewb' ? toWcaSkewb(setupParam, skewbNotation) : setupParam}
              alg={puzzleParam === 'skewb' ? toWcaSkewb(algParam, skewbNotation) : algParam}
              fillPane
              twistOnClick
              playerRef={twistyPlayerRef}
              settings={settings}
              onUserMove={(moveText) => {
                // moveText is already cubing.js canonical (`Uv`/`BL2`); pass raw
                // to skip TwistAction parsing which would eat multi-char families.
                userMoveRef.current?.(moveText);
              }}
            />
          ) : null}
          <button
            className="sim-fullscreen-exit"
            onClick={() => setFullscreen(!fullscreen)}
            title={fullscreen ? t('退出全屏', 'Exit fullscreen') : t('全屏魔方', 'Fullscreen cube')}
            aria-label={fullscreen ? t('退出全屏', 'Exit fullscreen') : t('全屏魔方', 'Fullscreen cube')}
          >
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>

        <aside className="sim-side">
          <CollapsibleSection
            open={algsOpen}
            onToggle={() => setAlgsOpen((o) => !o)}
            icon={BookOpen}
            label={t('公式', 'Algs')}
          >
            <AlgsPanel
              onSelect={(setup, alg) => { onAlgPick(setup, alg); }}
              onOrderChange={handleOrder}
              disabled={twisty}
            />
          </CollapsibleSection>
          <PlayerControls
            world={worldRef.current}
            alg={algParam}
            setup={setupParam}
            onAlgChange={onAlgChange}
            onSetupChange={onSetupChange}
            order={order}
            onOrderChange={handleOrder}
            puzzleKind={puzzleKind}
            onPuzzleChange={handlePuzzle}
            settings={settings}
            onSettingsChange={setSettings}
            keymap={keymap}
            onKeymapChange={setKeymap}
            onResetKeymap={() => setKeymap(resetKeymapStorage())}
            userMoveRef={userMoveRef}
            twistyPlayerRef={twistyPlayerRef}
            skewbNotation={skewbNotation}
            onSkewbNotationChange={setSkewbNotation}
          />
          {!twisty && (
            <CollapsibleSection
              open={directorOpen}
              onToggle={() => setDirectorOpen((o) => !o)}
              icon={Film}
              label={t('录制', 'Record', "錄製")}
            >
              <DirectorPanel
                getCanvas={getCanvas}
                getWorld={getWorld}
                getRenderer={getRenderer}
                setup={setupParam}
                alg={algParam}
              />
            </CollapsibleSection>
          )}
        </aside>
      </div>
    </div>
  );
}

function CollapsibleSection({
  open, onToggle, icon: Icon, label, children,
}: {
  open: boolean;
  onToggle: () => void;
  icon: typeof BookOpen;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="sim-puzzle">
      <button
        type="button"
        className="sim-puzzle-head"
        onClick={onToggle}
        aria-expanded={open}
        title={label}
      >
        <ChevronRight size={14} className={'sim-puzzle-caret' + (open ? ' open' : '')} />
        <Icon size={14} />
        <span className="sim-puzzle-title">{label}</span>
      </button>
      {open && <div className="sim-section-body">{children}</div>}
    </section>
  );
}
