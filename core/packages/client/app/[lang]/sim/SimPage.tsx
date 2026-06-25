'use client';

/**
 * /sim — 虚拟魔方 Playground / Player / Algs / Director (Next.js port).
 *
 * Vite source: packages/client-vite/src/pages/sim/SimPage.tsx.
 *
 * Twisty puzzles (pyraminx / skewb / megaminx) render via cubing.js
 * TwistyPlayer (see components/TwistySection). NxN + SQ1 use the local
 * huazhechen/cuber WebGL engine in cuber/.
 */

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useQueryStates, parseAsString, parseAsStringEnum } from 'nuqs';
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
  ArrowLeftRight,
} from 'lucide-react';
import World, { type PuzzleKind } from './engine/world';
import type Cube from './engine/nxn/cube';
import { SIZE } from './engine/define';
import { createBackView, type BackView } from './engine/backView';
import Toucher from './Toucher';
import { TwistAction } from './engine/nxn/twister';
import CubeGroup from './engine/nxn/group';
import Sq1Cube from './engine/sq1/Sq1Cube';
import DinoCube from './engine/dino/DinoCube';
import tweener, { type Tween } from './engine/tweener';
import {
  sq1DragStart, sq1DragDelta, sq1DragApply, sq1DragCommit, sq1DragSnapBack,
  type Sq1DragStart, type Sq1TurnDrag,
} from './engine/sq1/sq1Drag';
import { moveToString as sq1MoveToString } from './engine/sq1/sq1State';
import IvyCube, { type IvyAnim } from './engine/ivy/IvyCube';
import {
  ivyPickHit, ivyResolveMove, ivyResolveLive, ivyApplyPartial, ivySnapBack, type IvyHit,
} from './engine/ivy/ivyDrag';
import { dinoPickHit, dinoResolveMove, dinoResolveLive, type DinoPickHit } from './engine/dino/dinoDrag';
import { dinoMoveToString, type DinoMove } from './engine/dino/dinoState';
import RediCube from './engine/redi/RediCube';
import { rediPickHit, rediResolveMove, rediResolveLive, type RediPickHit } from './engine/redi/rediDrag';
import { rediMoveToString, type RediMove } from './engine/redi/rediState';
import RexCube from './engine/rex/RexCube';
import { rexPickHit, rexResolveMove, rexResolveLive, type RexPickHit } from './engine/rex/rexDrag';
import { rexMoveToString, type RexMove } from './engine/rex/rexState';
import HeliCube from './engine/heli/HeliCube';
import { heliPickHit, heliResolveMove, heliResolveLive, type HeliPickHit } from './engine/heli/heliDrag';
import { heliMoveToString, type HeliMove } from './engine/heli/heliState';
import SkewbCube from './engine/skewb/SkewbCube';
import { skewbPickHit, skewbResolveMove, skewbResolveLive, type SkewbPickHit } from './engine/skewb/skewbDrag';
import { skewbMoveToString, type SkewbMove } from './engine/skewb/skewbState';
import PyraCube from './engine/pyra/PyraCube';
import { pyraPickHit, pyraResolveMove, pyraResolveLive, type PyraPickHit } from './engine/pyra/pyraDrag';
import { pyraMoveToString, type PyraMove } from './engine/pyra/pyraState';
import MegaminxCube from './engine/mega/MegaminxCube';
import { megaPickHit, megaResolveMove, megaResolveLive, type MegaPickHit } from './engine/mega/megaDrag';
import { megaMoveToString, type MegaMove } from './engine/mega/megaState';
import FtoCube from './engine/fto/FtoCube';
import { ftoPickHit, ftoResolveMove, ftoResolveLive, type FtoPickHit } from './engine/fto/ftoDrag';
import { ftoMoveToString, type FtoMove } from './engine/fto/ftoState';
import { orbitScene, snapViewToQuadrant } from './engine/viewControls';
import {
  CornerTurnGesture, type CornerGestureCtx, type CornerGestureHandle, type CornerTurnAdapter,
} from './engine/cornerTurnGesture';
import { FACE } from './engine/define';
import { toWca as toWcaSkewb, type SkewbNotation } from '@cuberoot/shared/skewb-notation';
import TwistySection from '@/components/TwistySection';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  loadSettings, saveSettings, applySettings,
  mapOrbitK, mapTurnDragFactor, type SimSettings,
} from './SettingDrawer';
import PlayerControls, { type SimPuzzle } from './PlayerControls';
import { PG_DEF_BY_ID, isPgPuzzleId } from './pgCatalog';
import AlgsPanel from './AlgsPanel';
import DirectorPanel from './DirectorPanel';
import GroupTheoryPanel, { type SimWorldView } from './GroupTheoryPanel';
import SimCubeNet from './_SimCubeNet';
import {
  loadKeymap, saveKeymap, resetKeymap as resetKeymapStorage, type KeyMove,
} from './keymap';
import './sim.css';
import i18n from "@/i18n/i18n-client";
import { useT } from "@/hooks/useT";

/** Gap (px) between the back-view window / fullscreen button and the canvas
 *  top-right corner. Must match the `top`/`right` in `.sim-backview` +
 *  `.sim-fullscreen-exit` (sim.css). */
const BACKVIEW_MARGIN = 8;

/** Twisty puzzles rendered by cubing.js (not the local cuber engine). */
export const TWISTY_PUZZLES = ['pyraminx', 'skewb', 'megaminx', 'fto'] as const;
export type TwistyPuzzle = typeof TWISTY_PUZZLES[number];
export function isTwistyPuzzle(p: SimPuzzle): p is TwistyPuzzle {
  return p === 'pyraminx' || p === 'skewb' || p === 'megaminx' || p === 'fto';
}

/** Twisty puzzles (cubing.js by default) that ALSO have an in-house Three.js engine
 *  renderer — the user picks which one via the `renderer` toggle (skill: keep both). */
export const ENGINE_TWISTY = new Set<string>(['skewb', 'pyraminx', 'megaminx', 'fto']);

/** Cubing.js `experimentalPuzzleDescription` for ENGINE_TWISTY puzzles that are NOT a
 *  built-in TwistyPlayer puzzle id (skewb/pyraminx/megaminx are built-ins; FTO is a
 *  PuzzleGeometry octahedron). Fed to TwistySection so the cubing.js renderer still works.
 *  Copied verbatim from the vendored puzzle-geometry `FTO` entry. */
const ENGINE_TWISTY_DEF: Record<string, string> = { fto: 'o f 0.333333333333333' };

/** Engine puzzle kinds that have a PG group-theory binding (kept in sync with the
 *  pgBindings registry + GroupTheoryPanel.PG_BOUND). Gates the `renderer='group'` panel. */
const PG_BOUND_KINDS = new Set<string>(['pyraminx', 'skewb', 'dino', 'heli', 'megaminx', 'fto']);

/** Narrow `world.cube` to the NxN Cube type. Returns null for every non-NxN engine puzzle. */
function asNxN(world: World): Cube | null {
  return (world.puzzleKind === 'sq1' || world.puzzleKind === 'ivy' || world.puzzleKind === 'dino' || world.puzzleKind === 'redi' || world.puzzleKind === 'rex' || world.puzzleKind === 'heli' || world.puzzleKind === 'skewb' || world.puzzleKind === 'megaminx' || world.puzzleKind === 'fto') ? null : (world.cube as Cube);
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
  useDocumentTitle('模拟器', 'Sim');

  // Sim editor state in the URL (replace semantics — not navigation).
  // puzzle defaults to '3' (absent reads as 3, and '3' is auto-omitted from
  // the URL by clearOnDefault, so no explicit default-write effect is needed).
  const [query, setQuery] = useQueryStates(
    {
      puzzle: parseAsString.withDefault('3'),
      alg: parseAsString,
      setup: parseAsString,
      // Which renderer for an ENGINE_TWISTY puzzle: cubing.js TwistyPlayer (default) or
      // 'group' = the in-house Three.js engine + a live group-theory panel backed by the
      // vendored puzzle-geometry. Default 'cubing' → omitted. 'engine' is the retired
      // engine-without-panel mode — still parsed so old links degrade to the engine view
      // (treated as 'group' everywhere), no longer offered in the UI.
      renderer: parseAsStringEnum(['cubing', 'engine', 'group'] as const).withDefault('cubing'),
    },
    { history: 'replace', scroll: false },
  );

  const algParam = query.alg || '';
  const setupParam = query.setup || '';

  const puzzleParam: SimPuzzle = useMemo(() => {
    const raw = query.puzzle;
    if (!raw) return 3;
    if (raw === 'sq1') return 'sq1';
    if (raw === 'ivy') return 'ivy';
    if (raw === 'dino') return 'dino';
    if (raw === 'redi') return 'redi';
    if (raw === 'rex') return 'rex';
    if (raw === 'heli') return 'heli';
    if (raw === 'pyraminx' || raw === 'skewb' || raw === 'megaminx') return raw;
    if (raw === 'fto') return 'fto';
    if (isPgPuzzleId(raw)) return raw as SimPuzzle;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1 || n > 400) return 3;
    return n;
  }, [query.puzzle]);
  // A twisty puzzle is rendered by the in-house engine when it has an engine
  // alternative AND the renderer toggle is off cubing.js (default 'cubing' keeps the
  // cubing.js TwistyPlayer). The non-cubing view is always the engine + group panel
  // ('group'; stale 'engine' links land here too). `twisty` = "use the cubing.js path"
  // — false for engine-skewb, which then falls through to the World/Three.js route below.
  const useEngine = isTwistyPuzzle(puzzleParam) && ENGINE_TWISTY.has(puzzleParam)
    && query.renderer !== 'cubing';
  // A PuzzleGeometry puzzle (explore set) renders via cubing.js TwistyPlayer's
  // experimentalPuzzleDescription — twisty-class, no in-house engine. FTO is a promoted
  // engine-twisty whose cubing.js render also needs a description (it's not a built-in id).
  const pgDef = typeof puzzleParam === 'string'
    ? (PG_DEF_BY_ID[puzzleParam] ?? ENGINE_TWISTY_DEF[puzzleParam])
    : undefined;
  const twisty = (isTwistyPuzzle(puzzleParam) || pgDef !== undefined) && !useEngine;
  const useEngineRef = useRef(useEngine);
  useEffect(() => { useEngineRef.current = useEngine; }, [useEngine]);

  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const toucherRef = useRef<Toucher | null>(null);
  // Back-view mini window (NxN / SQ1 only — twisty puzzles use cubing.js native
  // backView). Second renderer shares world.scene with a camera mirrored 180°
  // about Y, rendered into an overlay canvas so snapshots/exports stay clean.
  const fsButtonRef = useRef<HTMLButtonElement>(null);
  // Swap button (main view ↔ back-view mini window). Anchored over the back-view
  // window's bottom-right corner via layoutBackView; only mounted when backView on.
  const swapButtonRef = useRef<HTMLButtonElement>(null);
  const swapTweenRef = useRef<Tween | null>(null);
  const backFrameRef = useRef<HTMLDivElement>(null);
  const backViewRef = useRef<BackView | null>(null);
  const backSizeRef = useRef<number>(140);
  const wasCompleteRef = useRef(false);
  const userMoveRef = useRef<((action: TwistAction | string) => void) | null>(null);
  // Debug "hold partial turn": closure that snaps the currently-frozen SQ1/Ivy
  // partial turn back to its pre-drag pose (NxN's frozen layer lives in the
  // controller). Cleared by clearPartialFreeze() — called before any new gesture,
  // on toggle-off, and (ref dropped) after any committed cube change.
  const partialSnapBackRef = useRef<(() => void) | null>(null);
  const clearPartialFreeze = useCallback(() => {
    if (partialSnapBackRef.current) { partialSnapBackRef.current(); partialSnapBackRef.current = null; }
    worldRef.current?.controller.clearFrozen();
    if (worldRef.current) worldRef.current.dirty = true;
  }, []);
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

  // Lay out the back-view mini window: size it ~30% of the smaller container
  // dimension (clamped), and shift the fullscreen button left of it so they
  // don't overlap in the top-right corner. Single source of truth for the
  // square pixel size consumed by the back renderer's setSize.
  const layoutBackView = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const on = settingsRef.current.backView;
    const W = container.clientWidth;
    const H = container.clientHeight;
    const size = Math.round(Math.min(184, Math.max(104, Math.min(W, H) * 0.3)));
    backSizeRef.current = size;
    const frame = backFrameRef.current;
    if (frame) {
      frame.style.width = `${size}px`;
      frame.style.height = `${size}px`;
    }
    backViewRef.current?.setSize(size);
    const btn = fsButtonRef.current;
    if (btn) btn.style.right = on ? `${size + BACKVIEW_MARGIN * 2}px` : '';
    // Pin the swap button to the back-view window's bottom-right inner corner.
    const swapBtn = swapButtonRef.current;
    if (swapBtn) {
      swapBtn.style.top = `${BACKVIEW_MARGIN + size - 34}px`;
      swapBtn.style.right = `${BACKVIEW_MARGIN + 6}px`;
    }
  }, []);

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
    // Any committed cube change (move / scramble / reset / replay fires callbacks)
    // re-poses the pivots, so a stale SQ1/Ivy freeze snap-back would corrupt them —
    // just drop the closure (don't snap). NxN's frozen layer is released by the
    // controller / PlayerControls before such ops.
    world.callbacks.push(() => { partialSnapBackRef.current = null; });

    const renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: true, preserveDrawingBuffer: true,
    });
    renderer.autoClear = false;
    renderer.setClearColor(0xffffff, 0);
    // Render at ≥2× device pixels (supersampled) so high-contrast tilted edges — e.g. the
    // megaminx's bold black seams against white/colour faces — don't stairstep on 1× displays
    // where 4×MSAA alone isn't enough. Capped at 2.5× to bound fill cost on hi-DPI screens.
    renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio, 2), 2.5));
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
      layoutBackView();
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
      const halfH = (SIZE * 3 * w.height) / (minDim * oldScale);
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
      const cubeWorldSize = SIZE * 3;
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
    // Ivy: drag a petal (a turning corner) to twist it; a drag on a lens/center
    // or empty space orbits the whole scene (pinch still zooms via the shared
    // block below). A move is a discrete 120° twist, so we fire once past a
    // small threshold (no live finger-tracking yet — see ivyDrag.ts).
    let ivyRotating = false;
    let ivyLastX = 0;
    let ivyLastY = 0;
    let ivyPick: IvyHit | null = null; // pending corner-twist gesture (cube grabbed)
    let ivyDownX = 0;
    let ivyDownY = 0;
    let ivyMoved = false;
    // Debug hold-partial: live-tracked Ivy turn. While set, pointermove maps drag
    // → t∈[0,1] and rotates the tripod live; pointerup freezes it (no commit).
    let ivyLive: { anims: IvyAnim[]; tx: number; ty: number; downX: number; downY: number } | null = null;
    const IVY_TURN_THRESHOLD_PX = 6;
    const IVY_FULL_PX = 150; // drag px (along the turn tangent) for a full 120° turn
    // ── Corner/edge-turn gesture controllers (Dino/Redi/Rex 120°, Heli 180°) ──────────
    // The four share one pointer flow (engine/cornerTurnGesture.ts); only the cube class,
    // the pick/resolve functions, the full-turn px span, and whether beginMove takes a
    // sweep dir differ — captured per puzzle in a small adapter. Adding a corner-turn
    // puzzle = one adapter + a registry entry here, not another ~175 lines of dispatch.
    const cornerCtx: CornerGestureCtx = {
      world,
      dom: renderer.domElement,
      settings: () => settingsRef.current,
      pinching: () => pinching,
      emitMove: (token) => userMoveRef.current?.(token),
      orbit: (dx, dy) => orbitScene(world, dx, dy, mapOrbitK(settingsRef.current.sensitivity)),
      clearPartialFreeze,
      setPartialSnapBack: (fn) => { partialSnapBackRef.current = fn; },
    };
    const dinoAdapter: CornerTurnAdapter<DinoCube, DinoMove, DinoPickHit> = {
      match: (c): c is DinoCube => c instanceof DinoCube,
      pickHit: dinoPickHit, resolveLive: dinoResolveLive, resolveMove: dinoResolveMove,
      beginMove: (c, m) => c.beginMove(m), moveToString: dinoMoveToString,
      fullPx: 150, threshold: 6,
    };
    const rediAdapter: CornerTurnAdapter<RediCube, RediMove, RediPickHit> = {
      match: (c): c is RediCube => c instanceof RediCube,
      pickHit: rediPickHit, resolveLive: rediResolveLive, resolveMove: rediResolveMove,
      beginMove: (c, m) => c.beginMove(m), moveToString: rediMoveToString,
      fullPx: 150, threshold: 6,
    };
    const rexAdapter: CornerTurnAdapter<RexCube, RexMove, RexPickHit> = {
      match: (c): c is RexCube => c instanceof RexCube,
      pickHit: rexPickHit, resolveLive: rexResolveLive, resolveMove: rexResolveMove,
      beginMove: (c, m) => c.beginMove(m), moveToString: rexMoveToString,
      fullPx: 150, threshold: 6,
    };
    const heliAdapter: CornerTurnAdapter<HeliCube, HeliMove, HeliPickHit> = {
      match: (c): c is HeliCube => c instanceof HeliCube,
      pickHit: heliPickHit, resolveLive: heliResolveLive, resolveMove: heliResolveMove,
      beginMove: (c, m, dir) => c.beginMove(m, dir), moveToString: heliMoveToString,
      fullPx: 200, threshold: 6,
    };
    const skewbAdapter: CornerTurnAdapter<SkewbCube, SkewbMove, SkewbPickHit> = {
      match: (c): c is SkewbCube => c instanceof SkewbCube,
      pickHit: skewbPickHit, resolveLive: skewbResolveLive, resolveMove: skewbResolveMove,
      beginMove: (c, m) => c.beginMove(m), moveToString: skewbMoveToString,
      fullPx: 150, threshold: 6,
    };
    const pyraAdapter: CornerTurnAdapter<PyraCube, PyraMove, PyraPickHit> = {
      match: (c): c is PyraCube => c instanceof PyraCube,
      pickHit: pyraPickHit, resolveLive: pyraResolveLive, resolveMove: pyraResolveMove,
      beginMove: (c, m) => c.beginMove(m), moveToString: pyraMoveToString,
      fullPx: 150, threshold: 6,
    };
    const megaAdapter: CornerTurnAdapter<MegaminxCube, MegaMove, MegaPickHit> = {
      match: (c): c is MegaminxCube => c instanceof MegaminxCube,
      pickHit: megaPickHit, resolveLive: megaResolveLive, resolveMove: megaResolveMove,
      beginMove: (c, m) => c.beginMove(m), moveToString: megaMoveToString,
      fullPx: 130, threshold: 6,
    };
    const ftoAdapter: CornerTurnAdapter<FtoCube, FtoMove, FtoPickHit> = {
      match: (c): c is FtoCube => c instanceof FtoCube,
      pickHit: ftoPickHit, resolveLive: ftoResolveLive, resolveMove: ftoResolveMove,
      beginMove: (c, m) => c.beginMove(m), moveToString: ftoMoveToString,
      fullPx: 140, threshold: 6,
    };
    const cornerGestures: Record<'dino' | 'redi' | 'rex' | 'heli' | 'skewb' | 'pyraminx' | 'megaminx' | 'fto', CornerGestureHandle> = {
      dino: new CornerTurnGesture(dinoAdapter, cornerCtx),
      redi: new CornerTurnGesture(rediAdapter, cornerCtx),
      rex: new CornerTurnGesture(rexAdapter, cornerCtx),
      heli: new CornerTurnGesture(heliAdapter, cornerCtx),
      skewb: new CornerTurnGesture(skewbAdapter, cornerCtx),
      pyraminx: new CornerTurnGesture(pyraAdapter, cornerCtx),
      megaminx: new CornerTurnGesture(megaAdapter, cornerCtx),
      fto: new CornerTurnGesture(ftoAdapter, cornerCtx),
    };
    const cornerGestureFor = (pk: unknown): CornerGestureHandle | null =>
      pk === 'dino' || pk === 'redi' || pk === 'rex' || pk === 'heli' || pk === 'skewb' || pk === 'pyraminx' || pk === 'megaminx' || pk === 'fto' ? cornerGestures[pk] : null;
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
      if (worldRef.current?.puzzleKind === 'ivy' && (e.pointerType !== 'mouse' || e.button === 0)) {
        const isTouchMulti = e.pointerType === 'touch' && activePointers.size >= 1;
        if (!isTouchMulti) {
          const w = worldRef.current;
          const r0 = renderer.domElement.getBoundingClientRect();
          const lx = e.clientX - r0.left;
          const ly = e.clientY - r0.top;
          // Grab anywhere on the cube → turn (drag direction picks the corner);
          // only an off-cube miss orbits the view (on-cube never rotates whole).
          ivyPick = w.cube instanceof IvyCube
            ? ivyPickHit(w.cube, w.scene, w.camera, lx, ly, w.width, w.height)
            : null;
          ivyDownX = lx;
          ivyDownY = ly;
          ivyMoved = false;
          ivyRotating = ivyPick === null; // orbit only when the cube was missed
          ivyLastX = e.clientX;
          ivyLastY = e.clientY;
          if (e.pointerType !== 'touch') renderer.domElement.setPointerCapture(e.pointerId);
        }
        if (e.pointerType === 'touch') {
          activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (activePointers.size === 2) { ivyRotating = false; ivyPick = null; }
        }
        if (e.pointerType !== 'touch') return;
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
      const downCg = cornerGestureFor(worldRef.current?.puzzleKind);
      if (downCg && (e.pointerType !== 'mouse' || e.button === 0)) {
        const isTouchMulti = e.pointerType === 'touch' && activePointers.size >= 1;
        if (!isTouchMulti) downCg.begin(e);
        if (e.pointerType === 'touch') {
          activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (activePointers.size === 2) downCg.cancel();
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
        cornerGestureFor(worldRef.current?.puzzleKind)?.onPinchStart();
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
      // Debug hold-partial: live-track the locked Ivy turn (drag → partial angle).
      if (worldRef.current?.puzzleKind === 'ivy' && ivyLive) {
        const r0 = renderer.domElement.getBoundingClientRect();
        const lx = e.clientX - r0.left;
        const ly = e.clientY - r0.top;
        const proj = (lx - ivyLive.downX) * ivyLive.tx + (ly - ivyLive.downY) * ivyLive.ty;
        ivyApplyPartial(ivyLive.anims, proj / IVY_FULL_PX);
        worldRef.current.dirty = true;
        return;
      }
      if (worldRef.current?.puzzleKind === 'ivy' && ivyPick && !ivyMoved) {
        const w = worldRef.current;
        const r0 = renderer.domElement.getBoundingClientRect();
        const lx = e.clientX - r0.left;
        const ly = e.clientY - r0.top;
        const ddx = lx - ivyDownX;
        const ddy = ly - ivyDownY;
        if (ddx * ddx + ddy * ddy >= IVY_TURN_THRESHOLD_PX * IVY_TURN_THRESHOLD_PX) {
          ivyMoved = true;
          if (w.cube instanceof IvyCube) {
            if (settingsRef.current.holdPartialTurn) {
              // Lock a live partial turn: resolve corner + drag-aligned tangent,
              // drop any prior freeze, begin (pivots tracked live, NOT committed).
              const plan = ivyResolveLive(w.cube, w.camera, ivyPick, ivyDownX, ivyDownY, lx, ly, w.width, w.height);
              if (plan) {
                clearPartialFreeze();
                const anims = w.cube.beginMove(plan.move);
                ivyLive = { anims, tx: plan.tangentX, ty: plan.tangentY, downX: ivyDownX, downY: ivyDownY };
                const proj = (lx - ivyDownX) * plan.tangentX + (ly - ivyDownY) * plan.tangentY;
                ivyApplyPartial(anims, proj / IVY_FULL_PX);
                w.dirty = true;
              }
            } else {
              const move = ivyResolveMove(w.cube, w.camera, ivyPick, ivyDownX, ivyDownY, lx, ly, w.width, w.height);
              if (move) {
                w.cube.twister.twist(move, false, true);
                userMoveRef.current?.(move.name);
              }
            }
          }
          ivyPick = null;
        }
        return;
      }
      if (worldRef.current?.puzzleKind === 'ivy' && ivyRotating) {
        const dx = e.clientX - ivyLastX;
        const dy = e.clientY - ivyLastY;
        ivyLastX = e.clientX;
        ivyLastY = e.clientY;
        orbitScene(world, dx, dy, mapOrbitK(settingsRef.current.sensitivity));
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
          orbitScene(world, dx, dy, mapOrbitK(settingsRef.current.sensitivity));
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
              // If a prior hold-partial freeze is live, sq1DragStart just captured
              // its rotated pivots as the start pose — snap back & re-capture clean.
              // (Orbit returns null → freeze preserved so you can inspect it.)
              if (sq1Drag && partialSnapBackRef.current) {
                clearPartialFreeze();
                if (sq1Drag.kind === 'turn') {
                  sq1Drag = sq1DragStart(c, w.scene, w.camera, sq1DownX, sq1DownY, w.width, w.height);
                }
              }
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
              orbitScene(world, dx2, dy2, mapOrbitK(settingsRef.current.sensitivity));
            }
            return;
          }
        }
      }
      const moveCg = cornerGestureFor(worldRef.current?.puzzleKind);
      if (moveCg && moveCg.onMove(e)) return;
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
            if (settingsRef.current.holdPartialTurn) {
              // Hold-partial: freeze where released (pivots already live-dragged),
              // register snap-back, do NOT commit.
              const frozen: Sq1TurnDrag = sq1Drag;
              partialSnapBackRef.current = () => sq1DragSnapBack(frozen);
            } else {
              const move = sq1DragCommit(c, sq1Drag, sq1DragLastDelta);
              if (move) userMoveRef.current?.(new TwistAction(sq1MoveToString(move), false, 1));
            }
          }
        }
        sq1Drag = null;
        sq1DragLastDelta = 0;
        sq1MovedPastThreshold = false;
        sq1Pending = false;
        try { renderer.domElement.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      }
      if (ivyLive) {
        // Hold-partial: freeze where released — keep the live pivots, register a
        // snap-back (next turn / toggle-off restores them), do NOT commit.
        const frozen = ivyLive.anims;
        partialSnapBackRef.current = () => ivySnapBack(frozen);
        ivyLive = null;
        ivyPick = null;
        ivyMoved = false;
        try { renderer.domElement.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      }
      if (ivyRotating || ivyPick) {
        ivyRotating = false;
        ivyPick = null;
        ivyMoved = false;
        try { renderer.domElement.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      }
      if (sq1Rotating) {
        sq1Rotating = false;
        sq1MovedPastThreshold = false;
        sq1Pending = false;
        if (settingsRef.current?.dragEmpty === 'rotate') snapViewToQuadrant(world);
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
      cornerGestureFor(worldRef.current?.puzzleKind)?.onUp(e);
      if (e.pointerType !== 'touch') return;
      activePointers.delete(e.pointerId);
      if (pinching && activePointers.size < 2) {
        pinching = false;
        const pk = worldRef.current?.puzzleKind;
        world.controller.disable = pk === 'sq1' || pk === 'ivy' || pk === 'dino' || pk === 'redi' || pk === 'rex' || pk === 'heli' || pk === 'skewb' || pk === 'fto';
        syncScaleToSettings();
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove, { passive: false });
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);

    // Back-view mini window. Lazily spins up a second WebGL renderer (shared
    // createBackView helper) the first time the user enables it. Rendered in
    // lockstep with the main view (only inside the dirty block) so they never
    // drift.
    const renderBackView = (w: World) => {
      if (!settingsRef.current.backView) return;
      const host = backFrameRef.current;
      if (!host) return;
      if (!backViewRef.current) {
        backViewRef.current = createBackView(THREE, SIZE, backSizeRef.current);
        host.appendChild(backViewRef.current.domElement);
      }
      backViewRef.current.render(w);
    };

    let raf = 0;
    let lastFrameAt = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = now - lastFrameAt;
      lastFrameAt = now;
      // Corner-turners (Ivy/Dino/Redi) surface their own twist-axis labels at the
      // corners instead of the 6-face U/D/L/R/F/B letters (those don't describe a
      // corner turn — skill pitfall #10). Each puzzle reveals its set on its own
      // drag-rotate flag; NxN via the controller.
      const loopCg = cornerGestureFor(world.puzzleKind);
      const viewing = world.puzzleKind === 'sq1'
        ? sq1Rotating
        : world.puzzleKind === 'ivy'
          ? ivyRotating
          : loopCg
            ? loopCg.isOrbiting()
            : world.controller.isViewRotating;
      const activeHints = world.puzzleKind === 'ivy' ? world.ivyHints
        : world.puzzleKind === 'dino' ? world.dinoHints
          : world.puzzleKind === 'redi' ? world.rediHints
            : world.puzzleKind === 'rex' ? world.rexHints
              : world.puzzleKind === 'heli' ? world.heliHints
                : world.puzzleKind === 'skewb' ? world.skewbHints
                  : world.puzzleKind === 'pyraminx' ? world.pyraHints
                    : world.puzzleKind === 'megaminx' ? world.megaHints
                      : world.puzzleKind === 'fto' ? world.ftoHints
                        : world.faceHints;
      const allHints = [world.faceHints, world.ivyHints, world.dinoHints, world.rediHints, world.rexHints, world.heliHints, world.skewbHints, world.pyraHints, world.megaHints, world.ftoHints];
      if (viewing) activeHints.show(); else activeHints.hide();
      for (const h of allHints) if (h !== activeHints) h.hide();
      let hintsAnimating = false;
      for (const h of allHints) if (h.tick(dt)) hintsAnimating = true;
      if (hintsAnimating) world.dirty = true;
      if (world.dirty || world.cube.dirty) {
        renderer.clear();
        renderer.render(world.scene, world.camera);
        renderBackView(world);
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
        // Tear down the back-view renderer too (helper disposes only its own GL
        // context — the shared scene geometries belong to the main renderer and
        // stay intact). Frees the second WebGL context when leaving the cuber engine.
        backViewRef.current?.dispose();
        backViewRef.current = null;
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
    // A twisty puzzle on the cubing.js renderer doesn't use World — just update URL.
    // The world-init effect's [twisty] dep tears down any live cuber instance.
    // An ENGINE_TWISTY puzzle (skewb) with renderer='engine' falls through to World.
    const toEngine = ENGINE_TWISTY.has(kind as string) && useEngineRef.current;
    // Twisty-class (cubing.js: pyraminx/megaminx/skewb + PuzzleGeometry explore
    // set) never touches World — just update the URL.
    if ((isTwistyPuzzle(kind) || (typeof kind === 'string' && isPgPuzzleId(kind))) && !toEngine) { writeUrl(); return; }
    const wk = kind as PuzzleKind; // narrowed at runtime: number / sq1 / … / heli / 'skewb'
    if (!world || world.puzzleKind === wk) { writeUrl(); return; }
    world.setPuzzle(wk);
    wasCompleteRef.current = true;
    ensureCubeCallback();
    applySettings(world, settingsRef.current);
    writeUrl();
  }, [ensureCubeCallback, setQuery]);

  // Switch an ENGINE_TWISTY puzzle (skewb) between the cubing.js TwistyPlayer and the
  // in-house engine. Flips `renderer` in the URL; the [twisty] world-init effect then
  // builds/tears down the World, and the sync effect routes the puzzle into it.
  const handleRendererChange = useCallback((r: 'cubing' | 'engine' | 'group') => {
    setQuery({ renderer: r === 'cubing' ? null : r });
  }, [setQuery]);

  const handleOrder = useCallback((n: number) => {
    handlePuzzle(n);
  }, [handlePuzzle]);

  // URL puzzle param → cube. On the cubing.js path there's no world to sync —
  // mirror to local puzzleKind state so PlayerControls renders correctly. Engine
  // puzzles (incl. engine-skewb, where `twisty` is false) route into World.
  useEffect(() => {
    if (twisty) {
      setPuzzleKind(puzzleParam);
      return;
    }
    if (!worldRef.current) return;
    if (worldRef.current.puzzleKind === (puzzleParam as PuzzleKind)) return;
    handlePuzzle(puzzleParam);
  }, [twisty, puzzleParam, handlePuzzle, worldTick]);

  const prevSettingsRef = useRef<SimSettings | null>(null);
  useEffect(() => {
    saveSettings(settings);
    const world = worldRef.current;
    if (world) applySettings(world, settings, prevSettingsRef.current ?? undefined);
    // Turning hold-partial OFF clears any frozen partial turn (SQ1/Ivy snap-back +
    // NxN layer release via controller, done inside clearPartialFreeze).
    if (prevSettingsRef.current?.holdPartialTurn && !settings.holdPartialTurn) clearPartialFreeze();
    prevSettingsRef.current = settings;
  }, [settings, clearPartialFreeze]);

  // Re-layout the back-view window (size + fullscreen-button offset) and force a
  // repaint when the toggle flips, the puzzle engine changes, or the world is
  // (re)created. applySettings already marks world.dirty, but layout depends on
  // the DOM frame which only the component owns.
  useEffect(() => {
    layoutBackView();
    const world = worldRef.current;
    if (world) world.dirty = true;
  }, [settings.backView, twisty, worldTick, layoutBackView]);

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

  // Swap the main view with the back-view mini window: rotate 180° about the
  // vertical axis so the face that was behind comes to the front (and the back
  // view, always the mirror, swaps in turn).
  const handleSwapView = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    if (swapTweenRef.current) {
      tweener.finish(swapTweenRef.current);
      swapTweenRef.current = null;
    }
    const cube = asNxN(world);
    // orbit / rotate modes keep scene.rotation.y within ±90° and bake
    // reorientation into the cube — a pure-view 180° flip there would leave the
    // angle out of range and make the next empty-drag emit a stray y. Reorient
    // the cube itself with an animated y2 instead: view-only (not appended to
    // the alg), undoable, and it keeps the engine + back-view consistent.
    if (cube && settingsRef.current.dragEmpty !== 'view') {
      cube.twister.twist(new TwistAction('y', false, 2), false, true);
      return;
    }
    // view mode + SQ1: spin the camera 180° about the vertical axis. Cube state
    // is untouched (F stays F); the back-view mirror swaps automatically.
    const begin = world.scene.rotation.y;
    const end = begin + Math.PI;
    swapTweenRef.current = tweener.tween(begin, end, 16, (v) => {
      const w = worldRef.current;
      if (!w) { swapTweenRef.current = null; return true; }
      w.scene.rotation.y = v;
      w.scene.updateMatrix();
      w.dirty = true;
      if (v >= end) { swapTweenRef.current = null; return true; }
      return false;
    });
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
  // The sim World as the structural shape GroupTheoryPanel reads (puzzleKind + cube);
  // the panel only drives it when renderer==='group' and the active puzzle has a PG kernel.
  const getWorldView = useCallback((): SimWorldView | null =>
    worldRef.current as unknown as SimWorldView | null, []);
  const getRenderer = useCallback((): THREE.WebGLRenderer | null => rendererRef.current, []);

  // 2D flat-net view mode — NxN only (number puzzle), driven by the same live cube.
  const netMode = settings.viewMode === 'net' && typeof puzzleParam === 'number';

  return (
    <div className={`sim-page${fullscreen ? ' sim-page--fullscreen' : ''}`} data-board-bg={settings.boardBg}>
      <header className="sim-header">
        <HomeLink className="sim-back" title={t('返回', 'Back')}>
          <ChevronLeft size={18} />
        </HomeLink>
        <h1 className="sim-title">{t('模拟', 'Sim')}</h1>
        <div className="sim-spacer" />
      </header>

      <div className="sim-body">
        <div className={`sim-canvas-wrap${netMode ? ' sim-canvas-wrap--net' : ''}`} ref={containerRef}>
          {netMode && (
            <SimCubeNet
              getWorld={getWorld}
              worldTick={worldTick}
              order={order}
              userMoveRef={userMoveRef}
              faceColors={settings.faceColors}
            />
          )}
          {twisty ? (
            <TwistySection
              puzzle={String(puzzleParam)}
              puzzleDescription={pgDef}
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
              // wheel / pinch zoom on twisty → persist as settings.scale (the settings
              // effect re-applies cameraDistance; mirrors the NxN syncScaleToSettings).
              onScaleChange={(scale) => setSettings((prev) => (prev.scale === scale ? prev : { ...prev, scale }))}
            />
          ) : null}
          {/* Back-view window for the cuber engine (NxN / SQ1). Always mounted
              while the cuber engine is active so the second renderer's canvas
              stays attached across toggles; visibility flips with the setting.
              Twisty puzzles use cubing.js native backView instead. */}
          {!twisty && (
            <div
              ref={backFrameRef}
              className="sim-backview"
              style={{ display: settings.backView && !netMode ? 'block' : 'none' }}
              aria-hidden
            />
          )}
          <button
            ref={fsButtonRef}
            className="sim-fullscreen-exit"
            onClick={() => setFullscreen(!fullscreen)}
            title={fullscreen ? t('退出全屏', 'Exit fullscreen') : t('全屏魔方', 'Fullscreen cube')}
            aria-label={fullscreen ? t('退出全屏', 'Exit fullscreen') : t('全屏魔方', 'Fullscreen cube')}
          >
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          {/* Swap main view ↔ back-view mini window. Only while the cuber engine
              back-view is on (NxN / SQ1); twisty puzzles use cubing.js native
              back-view and aren't covered here. */}
          {!twisty && !netMode && settings.backView && (
            <button
              ref={swapButtonRef}
              type="button"
              className="sim-backview-swap"
              onClick={handleSwapView}
              title={t('交换主视图与背面视图', 'Swap main / back view')}
              aria-label={t('交换主视图与背面视图', 'Swap main / back view')}
            >
              <ArrowLeftRight size={14} />
            </button>
          )}
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
            renderer={query.renderer}
            onRendererChange={handleRendererChange}
          />
          {!twisty && (
            <CollapsibleSection
              open={directorOpen}
              onToggle={() => setDirectorOpen((o) => !o)}
              icon={Film}
              label={t('录制', 'Record')}
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
          {/* Group-theory panel = the visible half of the non-cubing.js view. Shows for any
              PG-bound puzzle that isn't on cubing.js. Pure-engine PG puzzles (dino/heli) have
              no cubing.js option at all → the panel is always on for them. */}
          {PG_BOUND_KINDS.has(String(puzzleParam))
            && (query.renderer !== 'cubing' || !ENGINE_TWISTY.has(String(puzzleParam))) && (
            <GroupTheoryPanel puzzle={String(puzzleParam)} getWorld={getWorldView} />
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
