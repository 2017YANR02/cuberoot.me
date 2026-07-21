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
import HomeLink from '@/components/HomeLink';
import { persistItem } from '@/lib/safe-storage';
// THREE is type-only at module scope — runtime instance is dynamically imported
// inside the world-init effect so the ~1.2MB three bundle doesn't ship with
// pyraminx/skewb/megaminx (which use cubing.js TwistyPlayer, not THREE).
import type * as THREE from 'three';
import {
  ChevronLeft, ChevronRight,
  BookOpen,
  Maximize2, Minimize2,
  ArrowLeftRight,
  ImagePlus,
  PictureInPicture2,
  X,
} from 'lucide-react';
import World, { type PuzzleKind } from './engine/world';
import { bspSceneAudit, exportSimSvgBsp } from './sim_svg_export_bsp';
import { exportSimSvg } from './sim_svg_export';
import { exportSimSvgSchematic, hasSchematicFacelets } from './sim_svg_export_schematic';
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
  sq1SliceLiveStart, sq1SliceLiveApply, sq1SliceLiveSnapBack,
  type Sq1DragStart, type Sq1TurnDrag, type Sq1SliceLive,
} from './engine/sq1/sq1Drag';
import { moveToString as sq1MoveToString, isSlashValid as sq1SlashValid } from './engine/sq1/sq1State';
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
import GearCube from './engine/gear/GearCube';
import { gearPickHit, gearResolveMove, gearResolveLive, type GearPickHit } from './engine/gear/gearDrag';
import { gearMoveToString, type GearMove } from './engine/gear/gearState';
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
import CutEditor from './CutEditor';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  loadSettings, saveSettings, applySettings,
  mapOrbitK, mapTurnDragFactor, type SimSettings,
} from './SettingDrawer';
import PlayerControls, { stripHandMarks, type SimPuzzle } from './PlayerControls';
import AppLink from '@/components/AppLink';
import { reconEventForSim, buildReconSubmitQuery } from '@/lib/sim-recon-link';
import { PG_DEF_BY_ID, isPgPuzzleId } from './pgCatalog';
import { EXPLORE_BOUND } from './engine/exploreBound';
import AlgsPanel from './AlgsPanel';
import PuzzleImageStudio, { type SimBridge } from '@/components/puzzle-image/PuzzleImageStudio';
import type { TwistyPlayerLike } from '@/components/puzzle-image/SimCaptureGroup';
import { useImageSpec } from '@/components/puzzle-image/useImageSpec';
import { rotationDefaultsFor } from '@/lib/puzzle-image/defaults';
import type { InheritedFields } from '@/lib/puzzle-image/codec';
import type { ImageSpec, PuzzleType } from '@/lib/puzzle-image/types';
import { parseMask, MASK_COLOR } from '@/lib/puzzle-image/mask-core';
import { toEngineMask } from '@/lib/puzzle-image/puzzle-mask';
import GroupTheoryPanel, { type SimWorldView } from './GroupTheoryPanel';
import { nxnHasPgKernel } from './engine/nxn/nxnPgBridge';
import { stickeringMaskFn } from './engine/nxn/stickering';
import SimCubeNet from './_SimCubeNet';
import {
  loadKeymap, saveKeymap, resetKeymap as resetKeymapStorage, type KeyMove,
} from './keymap';
import './sim.css';
import { useT } from "@/hooks/useT";

/** Gap (px) between the back-view window and the canvas top-right corner.
 *  Must match the `top`/`right` in `.sim-backview` (sim.css). */
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

/** 每种拼图的开局默认视角(内部 0..100 的 viewAngle/viewGradient)。以显示度数表达意图:
 *  megaminx 正对一面(左右 0°),fto 平视(上下 0°),pyraminx 与所有还原态是正方体的拼图都
 *  30° / 30°。度→内部要按当前渲染器换算:左右在 twisty(cubing.js)量程 ±180°(系数 3.6)、
 *  在引擎 ±90°(系数 1.8);上下两渲染器都是 ±90°(系数 1.8)。同一 viewAngle 字段在两渲染器
 *  下含义不同,所以换拼图 / 换渲染器时必须按目标重算这两值,不能跨拼图沿用。 */
function defaultViewFor(kind: SimPuzzle, twisty: boolean): { viewAngle: number; viewGradient: number } {
  const yawDeg = kind === 'megaminx' ? 0 : 30;
  const pitchDeg = kind === 'fto' ? 0 : 30;
  const yawFactor = twisty ? 3.6 : 1.8;
  return { viewAngle: 50 - yawDeg / yawFactor, viewGradient: 50 - pitchDeg / 1.8 };
}

// Default description for the Puzzle Cuts editor (puzzle=custom) — matches the
// alpha.twizzle.net/explore landing example `c f 0.255`.
const DEFAULT_CUSTOM_CUTS = 'c f 0.255';

/** Per-puzzle calibration (degrees) that makes the exotic image-panel preview show the SAME
 *  orientation as the left 3D: sr rotation = yawSign·yaw + yaw offset (about world-y; sr remaps
 *  to z for sq1/pyraminx) and pitchSign·pitch + pitch offset (about world-x), where yaw/pitch
 *  are the sim's own scene.rotation (SettingDrawer mapYaw/mapPitch). Calibrated against the left
 *  via Playwright. A puzzle ABSENT here is not yet calibrated and falls back to the sr-iso anchor
 *  (no regression) — see the mirror effect. */
const SR_ANGLE_BASE: Partial<Record<PuzzleType, {
  yaw: number; pitch: number; yawSign: 1 | -1; pitchSign: 1 | -1;
}>> = {
  // sr identity shows the R-face where the sim shows F → ~+90 yaw; both signs match the sim.
  // Calibrated at the DEFAULT view (左右 30) against the engine's own render by pixel-counting
  // the projected faces: engine F:R green/red area = 2.08 and U-white fraction = 0.306. yaw 86
  // lands the companion F:R at 2.10 and pitch +4 lands white at 0.315 (both within ~2%). The
  // earlier {100,0} left the companion nearly F-on (R a sliver, F:R ≈ 5) — mis-calibrated once
  // the renderer default moved to the engine; re-measured 2026-07-21. sr's flat shading reveals
  // slightly less per degree than the 72mm bevel camera, so the fit is exact at the default
  // view and approximate off it (default-精确 policy, shared by the other bases).
  skewb: { yaw: 86, pitch: 4, yawSign: 1, pitchSign: 1 },
  // sq1 identity = bird's-eye on top (spin axis z); yaw maps straight (z = sim yaw), pitch
  // offsets −90 (front-on is 90° from bird's-eye): x = pitch_sim − 90. Verified z−36/x−59 = left.
  sq1: { yaw: 0, pitch: -90, yawSign: 1, pitchSign: 1 },
  // pyraminx. sim = in-house engine (renderer defaults to 'group'): apex-up tetra, F(green)
  // flat-on at yaw 0. sr's z spins the apex axis (red flat z0 / green z120 / blue z240, true
  // degrees) and x pitches bird's-eye(0)→front-on(−90), composed z-then-x = the engine's
  // Euler(yaw→pitch) order, so both axes map 1:1: z = simYaw + 120, x = simPitch − 90.
  // yaw biased 120→112 so the DEFAULT (左右 30) R-face sliver width pixel-matches the
  // engine's 72mm camera (sr reveals the side slightly less per degree — 默认精确 policy).
  // (The previous {60,−91} kite base targeted the cubing.js TwistyPlayer edge-forward default,
  // stale since the renderer default moved to the engine.) Colours: srSchemeFor(pyraminx).
  pyraminx: { yaw: 112, pitch: -90, yawSign: 1, pitchSign: 1 },
  // megaminx (spin axis y). sim = in-house engine: dodeca RESTS on D, so F sits in the upper
  // belt with its normal tilted UP 26.57° (90 − 63.43 face-normal step). sr identity is F
  // dead-on at the camera → geometric offset −26.57; biased to −19 so the DEFAULT (上下 30)
  // U-band width pixel-matches the engine's 72mm camera (sr reveals the top slightly less
  // per degree — same 默认精确/off-default-approximate policy as the other bases). (The
  // previous −12.6 matched cubing.js's edge-forward default — stale since the renderer
  // default moved to the engine.) Colours: srSchemeFor(megaminx) sr12→cubing map.
  megaminx: { yaw: 0, pitch: -19, yawSign: 1, pitchSign: 1 },
};

/** Engine puzzle kinds that have a PG group-theory binding (kept in sync with the
 *  pgBindings registry + GroupTheoryPanel.PG_BOUND). Gates the `renderer='group'` panel. */
const PG_BOUND_KINDS = new Set<string>(['pyraminx', 'skewb', 'dino', 'heli', 'megaminx', 'fto', 'redi', 'ivy', 'rex', 'mirror']);

/** Narrow `world.cube` to the NxN Cube type. Returns null for every non-NxN engine puzzle.
 *  正向判断(NxN = 数字阶数 或 mirror),不再用排除法枚举 —— 旧写法漏了 'pyraminx',
 *  stickering effect 对 PyraCube 取 instancedRenderer 直接崩整页(?puzzle=pyraminx 白屏)。 */
function asNxN(world: World): Cube | null {
  return (typeof world.puzzleKind === 'number' || world.puzzleKind === 'mirror') ? (world.cube as Cube) : null;
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
  const t = useT();
  useDocumentTitle('模拟器', 'Sim');

  // Sim editor state in the URL (replace semantics — not navigation).
  // puzzle ALWAYS appears in the URL (clearOnDefault:false keeps even '3'); a mount
  // effect force-writes it so a bare /sim resolves to /sim?puzzle=3 — the puzzle
  // identity is never silently dropped (which used to read back as a 3x3 fallback).
  const [query, setQuery] = useQueryStates(
    {
      puzzle: parseAsString.withDefault('3').withOptions({ clearOnDefault: false }),
      // Custom-cut PuzzleGeometry description for the Puzzle Cuts editor (e.g. "c f 0.255").
      cuts: parseAsString,
      alg: parseAsString,
      setup: parseAsString,
      // Which renderer for an ENGINE_TWISTY puzzle: 'group' = the in-house Three.js engine
      // + a live group-theory panel backed by the vendored puzzle-geometry (the default —
      // its strict superset of the engine view, so the preferred entry point), or 'cubing'
      // = the cubing.js TwistyPlayer. Default 'group' → omitted; 'cubing' is written
      // explicitly. 'engine' is the retired engine-without-panel mode — still parsed so old
      // links degrade to the engine view (treated as 'group' everywhere), no longer in the UI.
      renderer: parseAsStringEnum(['cubing', 'engine', 'group'] as const).withDefault('group'),
      // 按阶段展示色块(twizzle edit 的 Stickering,issue #27)。默认 'full' 省略;
      // 值 = cubing.js 阶段名(OLL/Cross/CMLL…),NxN 走引擎遮罩,megaminx/fto 走
      // cubing.js 原生。不支持的拼图忽略(下拉也隐藏)。
      stickering: parseAsString.withDefault('full'),
      // 十字(底面)颜色(cubedb 的 Cross Color):整套阶段遮罩旋转到所选颜色的面。
      // 默认 yellow(=D,恒等)省略;仅 NxN 引擎遮罩消费,megaminx/fto 无此参数。
      stickeringColor: parseAsString.withDefault('yellow'),
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
    if (raw === 'gear') return 'gear';
    if (raw === 'pyraminx' || raw === 'skewb' || raw === 'megaminx') return raw;
    if (raw === 'fto') return 'fto';
    if (raw === 'custom') return 'custom';
    if (raw === 'mirror') return 'mirror';
    if (isPgPuzzleId(raw)) return raw as SimPuzzle;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1 || n > 400) return 3;
    return n;
  }, [query.puzzle]);

  // Force the puzzle id into the URL on mount (clearOnDefault:false keeps it there):
  // a bare /sim becomes /sim?puzzle=3 so the project is always explicit and never
  // silently resolves to the 3x3 fallback.
  useEffect(() => {
    setQuery({ puzzle: String(puzzleParam) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The puzzle-image studio is mounted as the /sim 图像 panel — every puzzle has it. Its
  // puzzle is NOT chosen inside the panel — the sim's own puzzle dropdown is the single
  // selector, mapped here into the studio's vocabulary (mirror → order-3 cube).
  // spec 渲染器(visualcube / sr)认识的拼图走完整 studio;其余(fto / 枫叶 / 恐龙 /
  // 齿轮 / PG 目录 / 自定义切割…)走 engine-only 模式 —— 伴图 = 实时矢量镜像(引擎
  // world 走 BSP/示意导出;twisty 渲染时从 TwistyPlayer vantage 投影,同截图 SVG 路径),
  // 面板只剩预览 + 截图组 + SVG/PNG 下载。
  const imgSpecRenderable = typeof puzzleParam === 'number' || puzzleParam === 'mirror'
    || puzzleParam === 'sq1' || puzzleParam === 'skewb'
    || puzzleParam === 'pyraminx' || puzzleParam === 'megaminx';
  const imageStudioEngineOnly = !imgSpecRenderable;
  const imgPuzzle = useMemo((): { puzzleType: PuzzleType; cubeSize: number } => {
    if (typeof puzzleParam === 'number') return { puzzleType: 'cube', cubeSize: puzzleParam };
    if (puzzleParam === 'mirror') return { puzzleType: 'cube', cubeSize: 3 };
    if (puzzleParam === 'sq1' || puzzleParam === 'skewb'
      || puzzleParam === 'pyraminx' || puzzleParam === 'megaminx') {
      return { puzzleType: puzzleParam, cubeSize: 3 };
    }
    return { puzzleType: 'cube', cubeSize: 3 };
  }, [puzzleParam]);
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
  // Custom Puzzle Cuts: the editor writes query.cuts immediately (slider stays
  // responsive). TwistySection now updates the puzzle IN PLACE via the player's
  // experimentalPuzzleDescription setter (no element teardown / flash — see
  // TwistySection), so this only needs a short coalescing window to batch the
  // rapid input events of a slider drag, not the old anti-rebuild debounce.
  const customCuts = query.cuts && query.cuts.trim() ? query.cuts : DEFAULT_CUSTOM_CUTS;
  const [debouncedCuts, setDebouncedCuts] = useState(customCuts);
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedCuts(customCuts), 60);
    return () => window.clearTimeout(id);
  }, [customCuts]);

  const pgDef = puzzleParam === 'custom'
    ? debouncedCuts
    : typeof puzzleParam === 'string'
      ? (PG_DEF_BY_ID[puzzleParam] ?? ENGINE_TWISTY_DEF[puzzleParam])
      : undefined;
  const twisty = (isTwistyPuzzle(puzzleParam) || pgDef !== undefined) && !useEngine;
  const useEngineRef = useRef(useEngine);
  useEffect(() => { useEngineRef.current = useEngine; }, [useEngine]);

  // 「去复盘」头部链接:把当前打乱 / 解法交给 /recon/submit,与 recon 表单的「去模拟器」互为往返。
  // 引擎版 skewb/pyra/mega/fto 用自有记号,/recon(WCA 记号)解析不了 → 不给链接(门槛同 useEngine)。
  // 解法先剥手部记号(FTN / 换握 / 推法),否则 recon 的 alg 解析会被这些注解噎住。
  const reconHref = useMemo(() => {
    const ev = useEngine ? null : reconEventForSim(puzzleParam);
    if (!ev) return null;
    return `/recon/submit?${buildReconSubmitQuery(ev, setupParam, stripHandMarks(algParam))}`;
  }, [useEngine, puzzleParam, setupParam, algParam]);

  const containerRef = useRef<HTMLDivElement>(null);
  // Slot below the cube canvas that PlayerControls portals its playback bar into
  // (twizzle-style controls directly under the puzzle). state (not ref) so the
  // portal re-renders once the node mounts.
  const [playbackSlot, setPlaybackSlot] = useState<HTMLDivElement | null>(null);
  const worldRef = useRef<World | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const toucherRef = useRef<Toucher | null>(null);
  // Back-view mini window (NxN / SQ1 only — twisty puzzles use cubing.js native
  // backView). Second renderer shares world.scene with a camera mirrored 180°
  // about Y, rendered into an overlay canvas so snapshots/exports stay clean.
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
    persistItem('sim.skewb.notation', n);
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    persistItem('sim.fullscreen', fullscreen ? '1' : '0');
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
  useEffect(() => {
    if (typeof window === 'undefined') return;
    persistItem('sim.panel.algs', algsOpen ? '1' : '0');
  }, [algsOpen]);

  // 画布左上角图像浮层的显隐(侧栏的 studio 控件常驻,不再受它控制)。分享链接带任何
  // img_ 键 = 对方特意调过图 → 自动显示浮层,否则读持久化偏好。panel 模式的 codec 省略
  // img_pzl 且只写非默认值,所以「一动没动的 studio」不会产生任何 img_ 键。
  const [imageOpen, setImageOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const sp = new URLSearchParams(window.location.search);
      for (const [k] of sp) {
        if (k.startsWith('img_')) return true;
      }
    } catch { /* ignore */ }
    try { return localStorage.getItem('sim.panel.image') === '1'; } catch { return false; }
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    persistItem('sim.panel.image', imageOpen ? '1' : '0');
  }, [imageOpen]);

  // 示意伴图黑边 = 网格缝宽占小面的百分比(visualcube inset 模型:贴纸向心缩,
  // 露出壳色衬底当网格;绝对 px 描边在高阶 NxN 会吞掉贴纸整图发黑)。
  // 默认 15 = visualcube 的 transScale 0.85。
  // 只影响示意伴图,niche 外观,走 localStorage(同 sim.panel.image,非 URL)。
  const [imgOutline, setImgOutline] = useState<number>(() => {
    if (typeof window === 'undefined') return 15;
    try {
      const raw = localStorage.getItem('sim.img.outline');
      if (raw === null) return 15;
      const v = Number(raw);
      return Number.isFinite(v) && v >= 0 ? v : 15;
    } catch { return 15; }
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    persistItem('sim.img.outline', String(imgOutline));
  }, [imgOutline]);

  // 交换主图 ↔ 伴图(伴图铺满画布、实时 3D 缩进左上小框)。观察偏好,走 localStorage。
  // 交换态下渲染器/world 真调到小框尺寸(resize 闭包读 imgSwapRef;CSS 只钉显示位),
  // 否则 Toucher 的像素坐标与射线拾取对不上,小框里没法拖。
  const [imgSwap, setImgSwap] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem('sim.img.swap') === '1'; } catch { return false; }
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    persistItem('sim.img.swap', imgSwap ? '1' : '0');
  }, [imgSwap]);
  const imgSwapRef = useRef(false);
  const resizeMainViewRef = useRef<(() => void) | null>(null);

  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // 换拼图 / 换渲染器 → 把视角落到该拼图的开局默认(defaultViewFor)。同为 NxN 只换阶数时
  // 不重置,保留用户手调的角度;其余(换拼图类型、engine↔cubing 切换、首次挂载)都重取默认。
  // 单个 viewAngle 字段在两渲染器下度数含义不同,所以这是唯一自洽的做法 —— 不能跨拼图沿用。
  const prevViewPuzzleRef = useRef<SimPuzzle | null>(null);
  useEffect(() => {
    const prev = prevViewPuzzleRef.current;
    prevViewPuzzleRef.current = puzzleParam;
    if (typeof prev === 'number' && typeof puzzleParam === 'number') return; // 仅换阶数,保留手调
    const dv = defaultViewFor(puzzleParam, twisty);
    setSettings((s) => (s.viewAngle === dv.viewAngle && s.viewGradient === dv.viewGradient
      ? s : { ...s, viewAngle: dv.viewAngle, viewGradient: dv.viewGradient }));
  }, [puzzleParam, twisty]);

  // Host for the 图像 preview, floated over the canvas' top-left (the studio portals
  // its preview section in here — see PuzzleImageStudio previewHost). State, not a
  // ref, because the studio must re-render once the host element exists.
  const [imageHost, setImageHost] = useState<HTMLDivElement | null>(null);

  // The studio panel is driven entirely by the sim: its puzzle comes from the sim's
  // `puzzle=` dropdown (imgPuzzle — keeps `pzl` out of the URL) and its alg + colour
  // scheme are the sim's own (imgInherit — keeps `alg`/`case`/`sch` out too). Both are
  // injected into the codec so a cold `?img_…` link parses `view`/rotation against the
  // right puzzle and the panel never holds a second, conflicting copy of the sim's state.
  const imgInherit = useMemo<InheritedFields>(() => {
    const fc = settings.faceColors;
    const raw = [setupParam, algParam].filter((x) => x && x.trim()).join(' ');
    // Skewb: translate Sarah → WCA (as the left TwistyPlayer does) before the sr preview parses it,
    // so both sides read the notation identically. sr's skewb parser only knows R/U/L/B and would
    // mis-split Sarah's UL/UR into U+L; toWcaSkewb is identity for the default WCA notation, so this
    // only changes anything for Sarah users. (No chirality translation is needed — sr and cubing.js
    // agree on R/U/L/B move semantics, verified.)
    const applied = puzzleParam === 'skewb' ? toWcaSkewb(raw, skewbNotation) : raw;
    return {
      algType: 'alg', algorithm: applied,
      faceU: fc.U, faceR: fc.R, faceF: fc.F, faceD: fc.D, faceL: fc.L, faceB: fc.B,
    };
  }, [settings.faceColors, setupParam, algParam, puzzleParam, skewbNotation]);
  const [imgSpec, setImgSpec] = useImageSpec('img_', { puzzle: imgPuzzle, inherit: imgInherit });

  // Lay out the back-view mini window: size it ~30% of the smaller container
  // dimension (clamped). Single source of truth for the square pixel size
  // consumed by the back renderer's setSize.
  const layoutBackView = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const W = container.clientWidth;
    const H = container.clientHeight;
    const size = Math.round(Math.min(184, Math.max(104, Math.min(W, H) * 0.3)));
    backSizeRef.current = size;
    // 两个浮层(左上图像 / 右上背面小窗)必须同尺寸,所以尺寸只从这里出一次,
    // 落成画布上的 CSS 变量,两个框各自 width/height 取它 —— 图像浮层是按需挂载的,
    // 走变量就不用关心它和这次 layout 的先后。
    container.style.setProperty('--sim-float-size', `${size}px`);
    backViewRef.current?.setSize(size);
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

    // 拖动改的是 world.scene.rotation,而「左右 / 上下」滑杆存的是 0..100,两者之间没有
    // 回路 —— 所以拖完视角后读数会停在拖动前的旧值。这里反算 mapYaw / mapPitch 写回,
    // 与滚轮缩放后回写 scale 是同一套路(syncScaleToSettings)。
    //  · debounce 到手停:拖动中每帧 setState 会把整棵 React 树卷进拖拽帧。
    //  · 存浮点不 round:滑杆一格 = 1.8°,round 会让松手瞬间吸附一下。
    //  · applySettings 只在值真的变了才写 rotation,写回当前姿态不会反弹。
    const settingsFromYaw = (r: number) => (Math.atan2(Math.sin(r), Math.cos(r)) / Q + 1) * 50;
    const settingsFromPitch = (r: number) => (1 - Math.atan2(Math.sin(r), Math.cos(r)) / Q) * 50;
    let viewSyncTimer: number | null = null;
    const syncViewToSettings = () => {
      if (viewSyncTimer) window.clearTimeout(viewSyncTimer);
      viewSyncTimer = window.setTimeout(() => {
        const w = worldRef.current;
        if (!w) return;
        // 滑杆只跨 ±90°,'view' 模式下视角可以转出这个范围 —— 出界就别写回:钳到端点会
        // 让 applySettings 把姿态硬拉回 ±90°(拖到一半镜头自己跳)。读数停在端点附近、
        // 转回范围内自动跟上,是这里唯一不打架的取法。两轴各自判断。
        const inRange = (v: number) => v >= 0 && v <= 100;
        const yaw = settingsFromYaw(w.scene.rotation.y);
        const pitch = settingsFromPitch(w.scene.rotation.x);
        setSettings((prev) => {
          const viewAngle = inRange(yaw) ? yaw : prev.viewAngle;
          const viewGradient = inRange(pitch) ? pitch : prev.viewGradient;
          return prev.viewAngle === viewAngle && prev.viewGradient === viewGradient
            ? prev
            : { ...prev, viewAngle, viewGradient };
        });
      }, 250);
    };
    /** 所有 orbit 手势的唯一出口 —— 新增手势别再直接调 orbitScene,读数会漏同步。 */
    const orbitView = (dx: number, dy: number) => {
      orbitScene(world, dx, dy, mapOrbitK(settingsRef.current.sensitivity));
      syncViewToSettings();
    };

    world.controller.onOrbit = (dx, dy) => {
      const k = mapOrbitK(settingsRef.current.sensitivity);
      world.scene.rotation.y += dx * k;
      world.scene.rotation.x += dy * k;
      const cube = asNxN(world);
      // 手拧锁 → 按 'view' 处理:纯改 scene.rotation,不把跨 ±90° 的视角折成 y/x 记步。
      if (settingsRef.current.dragEmpty === 'view' || settingsRef.current.pointerTurns === false) {
        world.scene.updateMatrix();
        world.dirty = true;
        syncViewToSettings();
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
      syncViewToSettings();
    };

    world.controller.taps.push((idx, face, opts) => {
      if (face === null) return;
      const cube = asNxN(world);
      if (!cube) return;
      // 「动画」关 → 单击表面转动也瞬切(fast=true),与拖层 / 键盘一致。
      const fast = settingsRef.current.animatePlayback === false;
      const N = cube.order;
      const x = idx % N;
      const y = Math.floor((idx % (N * N)) / N);
      const z = Math.floor(idx / (N * N));
      const modInvert = opts.shift || opts.button === 2;

      if (N === 3) {
        const rule = CLICK_RULES_3X3[`${face}_${x}_${y}_${z}`];
        if (rule) {
          const action = new TwistAction(rule.sign, rule.reverse !== modInvert, 1);
          cube.twister.twist(action, fast, true);
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
      cube.twister.twist(action, fast, true);
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
      // float-size 先算(从容器全尺寸出),交换态的小框渲染尺寸取它。
      layoutBackView();
      const swapped = imgSwapRef.current;
      const w = swapped ? backSizeRef.current : container.clientWidth;
      const h = swapped ? backSizeRef.current : container.clientHeight;
      world.width = w;
      world.height = h;
      world.resize();
      renderer.setSize(w, h, true);
      world.dirty = true;
    };
    resizeMainViewRef.current = resize;
    resize();
    window.addEventListener('resize', resize);
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // 全身模式下 world.resize 已把缩放域整体重映射进后拉段(×0.07,任何档位
    // 都看到整个人),滚轮下限不再需要 0.04 特例(旧特例在重映射后 = 有效
    // 0.0028,人缩成一个点)。
    const scaleMin = (): number => 0.3;
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
      const newScale = Math.max(scaleMin(), Math.min(SCALE_MAX, oldScale * (e.deltaY > 0 ? 0.92 : 1.08)));
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
    // Debug hold-partial: live-tracked SQ1 slice flip. While set, pointermove maps
    // vertical drag → v∈[0,1] and flips the east half live; pointerup freezes it
    // (no commit). Only the slice needs this — turns ride sq1Drag (sq1DragApply).
    let sq1Slice: Sq1SliceLive | null = null;
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
    const gearAdapter: CornerTurnAdapter<GearCube, GearMove, GearPickHit> = {
      match: (c): c is GearCube => c instanceof GearCube,
      pickHit: gearPickHit, resolveLive: gearResolveLive, resolveMove: gearResolveMove,
      beginMove: (c, m) => c.beginMove(m), moveToString: gearMoveToString,
      fullPx: 260, threshold: 6, // one flip = 180° face + 90° middle — a long sweep
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
    const cornerGestures: Record<'dino' | 'redi' | 'rex' | 'heli' | 'gear' | 'skewb' | 'pyraminx' | 'megaminx' | 'fto', CornerGestureHandle> = {
      dino: new CornerTurnGesture(dinoAdapter, cornerCtx),
      redi: new CornerTurnGesture(rediAdapter, cornerCtx),
      rex: new CornerTurnGesture(rexAdapter, cornerCtx),
      heli: new CornerTurnGesture(heliAdapter, cornerCtx),
      gear: new CornerTurnGesture(gearAdapter, cornerCtx),
      skewb: new CornerTurnGesture(skewbAdapter, cornerCtx),
      pyraminx: new CornerTurnGesture(pyraAdapter, cornerCtx),
      megaminx: new CornerTurnGesture(megaAdapter, cornerCtx),
      fto: new CornerTurnGesture(ftoAdapter, cornerCtx),
    };
    const cornerGestureFor = (pk: unknown): CornerGestureHandle | null =>
      pk === 'dino' || pk === 'redi' || pk === 'rex' || pk === 'heli' || pk === 'gear' || pk === 'skewb' || pk === 'pyraminx' || pk === 'megaminx' || pk === 'fto' ? cornerGestures[pk] : null;
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
          // 手拧锁:不 pick → 恒等于"没抓到" → 整段手势都是 orbit 视角。
          ivyPick = settingsRef.current.pointerTurns !== false && w.cube instanceof IvyCube
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
          sq1Slice = null;
          sq1DragLastDelta = 0;
          sq1Rotating = false;
          sq1LastX = e.clientX;
          sq1LastY = e.clientY;
          if (e.pointerType !== 'touch') renderer.domElement.setPointerCapture(e.pointerId);
        }
        if (e.pointerType === 'touch') {
          activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (activePointers.size === 2) {
            if (sq1Slice) { sq1SliceLiveSnapBack(sq1Slice); sq1Slice = null; } // pinch cancels a live slice
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
        orbitView(dx, dy);
        return;
      }
      if (worldRef.current?.puzzleKind === 'sq1') {
        const rmove = renderer.domElement.getBoundingClientRect();
        const localX = e.clientX - rmove.left;
        const localY = e.clientY - rmove.top;
        if (sq1Slice) {
          sq1SliceLiveApply(sq1Slice, localY);
          worldRef.current.dirty = true;
          return;
        }
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
          orbitView(dx, dy);
          return;
        }
        if (sq1Pending && !sq1MovedPastThreshold && !pinching) {
          const dx = localX - sq1DownX;
          const dy = localY - sq1DownY;
          if (Math.hypot(dx, dy) >= SQ1_DRAG_THRESHOLD_PX) {
            sq1MovedPastThreshold = true;
            const w = worldRef.current;
            const c = w.cube;
            // 手拧锁:不解析抓取 → sq1Drag 留 null → 落到下方 orbit 分支。
            if (c instanceof Sq1Cube && settingsRef.current.pointerTurns !== false) {
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
              if (settingsRef.current.holdPartialTurn && sq1SlashValid(c2.state)) {
                clearPartialFreeze();
                sq1Slice = sq1SliceLiveStart(c2, sliceDir, sq1DownY);
              } else {
                const ok = c2.twister.twist({ kind: 'slice' }, false, true, sliceDir);
                if (ok) userMoveRef.current?.(new TwistAction('/', false, 1));
              }
              sq1Drag = null;
            } else if (sq1Drag) {
              if (sq1Drag.startEastHalf && Math.abs(dy) > Math.abs(dx) * 1.5) {
                const c2 = w.cube as Sq1Cube;
                const sliceDir: 1 | -1 = (dy < 0) ? -1 : 1;
                if (settingsRef.current.holdPartialTurn && sq1SlashValid(c2.state)) {
                  sq1DragSnapBack(sq1Drag); // undo the small cap rotation before flipping
                  clearPartialFreeze();
                  sq1Slice = sq1SliceLiveStart(c2, sliceDir, sq1DownY);
                } else {
                  const ok = c2.twister.twist({ kind: 'slice' }, false, true, sliceDir);
                  if (ok) userMoveRef.current?.(new TwistAction('/', false, 1));
                }
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
              orbitView(dx2, dy2);
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
        world.scale = Math.max(scaleMin(), Math.min(SCALE_MAX, pinchStartScale * ratio));
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
      if (sq1Slice) {
        // Hold-partial: freeze the flip where released — keep the live pivots,
        // register a snap-back (next gesture / toggle-off restores them), no commit.
        const frozen = sq1Slice;
        partialSnapBackRef.current = () => sq1SliceLiveSnapBack(frozen);
        sq1Slice = null;
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
      if (sq1Pending && !sq1MovedPastThreshold && worldRef.current?.puzzleKind === 'sq1'
        && settingsRef.current.pointerTurns !== false) {
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
      // 'rotate' 模式松手会 snapViewToQuadrant(上面 sq1、以及 corner gesture 的 onUp
      // 里各一处),那是拖动之后又一次改姿态 —— 补一次同步,否则读数停在吸附前的角度。
      syncViewToSettings();
      if (e.pointerType !== 'touch') return;
      activePointers.delete(e.pointerId);
      if (pinching && activePointers.size < 2) {
        pinching = false;
        const pk = worldRef.current?.puzzleKind;
        world.controller.disable = pk === 'sq1' || pk === 'ivy' || pk === 'dino' || pk === 'redi' || pk === 'rex' || pk === 'heli' || pk === 'gear' || pk === 'skewb' || pk === 'fto';
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
      // corner turn — skill pitfall #10); each puzzle picks its set by puzzleKind.
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
      // 方位字母完全由设置面板「字母」开关控制:开=该拼图的方位标签常驻,关=完全不显示
      // (拖视角 / 拖层时也不再浮现 —— 这个开关是字母的唯一开关,用户明确要求)。
      // SMPL-X 全身查看时字母无意义(拼图已藏),一并压掉。
      const showLabels = settingsRef.current.faceLabels === true && !world.smplxBodyOn;
      if (showLabels) activeHints.show(); else activeHints.hide();
      for (const h of allHints) if (h !== activeHints) h.hide();
      let hintsAnimating = false;
      for (const h of allHints) if (h.tick(dt)) hintsAnimating = true;
      if (hintsAnimating) world.dirty = true;
      // 手部指法 rig(3x3 + 设置开启时才存在):轮询转层角度驱动手势,动着就重渲。
      if (world.hands && world.hands.tick(dt)) world.dirty = true;
      if (world.dirty || world.cube.dirty) {
        // 让 U 面中心 logo 贴片跟住它所贴的实体中心块(转层动画 + 整方旋转都跟手)。
        // 仅 NxN/镜面 Cube 有此方法,duck-type 调用,其它拼图自动跳过。
        (world.cube as { updateLogoTransform?: () => void }).updateLogoTransform?.();
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
        if (viewSyncTimer) window.clearTimeout(viewSyncTimer);
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
        resizeMainViewRef.current = null;
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
    // Mirror Cube is an order-3 NxN under the hood — pin order to 3 so the NxN
    // scramble/play path (which reads `order`) drives a standard 3x3.
    else if (kind === 'mirror') setOrder(3);
    const world = worldRef.current;
    // Always write the puzzle id (incl. '3') so it's forced into the URL — never
    // omit it, or the selection reads back as the 3x3 default on reload/share.
    const writeUrl = () => setQuery({ puzzle: String(kind) });
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
    // 'group' is the default → omit it from the URL; write 'cubing' explicitly.
    setQuery({ renderer: r === 'group' ? null : r });
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

  // 按阶段展示色块 → NxN 引擎(镜面单色不适用;twisty 的 megaminx/fto 由下方
  // TwistySection 的 experimentalStickering prop 接管)。依赖 puzzleParam / worldTick:
  // 换拼图 / 换阶数(world.setPuzzle 造新 Cube = 新 InstancedRenderer)与 world 重建后
  // 都要重挂遮罩。上面的 URL-sync effect 先跑(声明在前),这里读到的已是新 cube。
  useEffect(() => {
    if (twisty) return;
    const world = worldRef.current;
    if (!world) return;
    const cube = asNxN(world);
    if (!cube) return;
    cube.instancedRenderer.setStickering(
      typeof puzzleParam === 'number' ? stickeringMaskFn(cube.order, query.stickering, query.stickeringColor) : null,
    );
  }, [twisty, worldTick, puzzleParam, query.stickering, query.stickeringColor]);

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

  // Swap the main view with the back-view mini window: spin the camera 180°
  // about the vertical axis so the face that was behind comes to the front
  // (and the mini window, always the mirror, swaps in turn). Always a pure
  // view change, never a cube.twister move: the face-letter labels are
  // children of world.scene (not of the cube), so only a scene rotation moves
  // them — a cube twist changes sticker colors but leaves the labels in
  // place. A cube twist also doesn't survive touching the solve textarea
  // (jumpToStep rebuilds the cube from setup + recorded moves on every click/
  // caret move, silently discarding it), while scene.rotation is untouched by
  // that rebuild.
  const handleSwapView = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    if (swapTweenRef.current) {
      tweener.finish(swapTweenRef.current);
      swapTweenRef.current = null;
    }
    const begin = world.scene.rotation.y;
    const end = begin + Math.PI;
    swapTweenRef.current = tweener.tween(begin, end, 16, (v) => {
      const w = worldRef.current;
      if (!w) { swapTweenRef.current = null; return true; }
      w.scene.rotation.y = v;
      w.scene.updateMatrix();
      w.dirty = true;
      if (v >= end) {
        swapTweenRef.current = null;
        // 'orbit' mode folds any ±90° view excess into real y moves as the user
        // drags past it (onOrbit's wrap loop below) — a swap's 180° flip is no
        // different, so fold it here too instead of leaving scene.rotation.y
        // sitting out of range: otherwise the *next* background drag, however
        // tiny, would silently absorb this whole leftover swing into a spurious
        // recorded move the user never actually dragged. Instant (fast=true)
        // compensating twists keep the view visually unchanged — same trick
        // onOrbit already relies on mid-drag. 'rotate' mode never reads
        // scene.rotation (it derives whole-cube turns from raw pixel deltas), so
        // it needs no reconciliation; 'view' mode never commits moves at all.
        const cube = asNxN(w);
        if (cube && settingsRef.current.dragEmpty === 'orbit') {
          const Q = Math.PI / 2;
          let safety = 8;
          while (w.scene.rotation.y > Q && safety-- > 0) {
            const action = new TwistAction('y', true, 1);
            cube.twister.twist(action, true, true);
            userMoveRef.current?.(action);
            w.scene.rotation.y -= Q;
          }
          safety = 8;
          while (w.scene.rotation.y < -Q && safety-- > 0) {
            const action = new TwistAction('y', false, 1);
            cube.twister.twist(action, true, true);
            userMoveRef.current?.(action);
            w.scene.rotation.y += Q;
          }
          w.scene.updateMatrix();
          w.dirty = true;
        }
        return true;
      }
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

  const simBridge = useMemo<SimBridge>(() => ({
    getCanvas, getWorld, getRenderer,
    // cubing.js TwistyPlayer(自定义切割 / PG 目录拼图 / renderer='cubing'):
    // 引擎 world 不在场时,截图组从它的 vantage 取 scene+camera 做 SVG 投影 / PNG。
    getTwistyPlayer: () => twistyPlayerRef.current,
    setup: setupParam, alg: algParam,
  }), [getCanvas, getWorld, getRenderer, setupParam, algParam]);

  // Keep the (seeded) image spec in step with the sim as its puzzle / alg / colours
  // change after mount — the codec injection only runs on the cold-load seed, so every
  // later change is pushed here. The panel dropped these controls, so the sim is the sole
  // writer and there is nothing to clobber. A puzzle-type change also snaps the viewport
  // rotation to the new puzzle's clean iso (what clicking a puzzle chip used to do).
  useEffect(() => {
    // engine-only 拼图(fto / 枫叶…)不消费 spec(伴图直出 engineSvg),别把
    // 'cube' 默认映射 + 视角标定写进 URL 的 img_* 参数。
    if (imageStudioEngineOnly) return;
    const patch: Partial<ImageSpec> = {};
    if (imgSpec.puzzleType !== imgPuzzle.puzzleType) patch.puzzleType = imgPuzzle.puzzleType;
    if (imgSpec.cubeSize !== imgPuzzle.cubeSize) patch.cubeSize = imgPuzzle.cubeSize;
    if (imgSpec.algType !== imgInherit.algType) patch.algType = imgInherit.algType;
    if (imgSpec.algorithm !== imgInherit.algorithm) patch.algorithm = imgInherit.algorithm;
    if (imgSpec.faceU !== imgInherit.faceU) patch.faceU = imgInherit.faceU;
    if (imgSpec.faceR !== imgInherit.faceR) patch.faceR = imgInherit.faceR;
    if (imgSpec.faceF !== imgInherit.faceF) patch.faceF = imgInherit.faceF;
    if (imgSpec.faceD !== imgInherit.faceD) patch.faceD = imgInherit.faceD;
    if (imgSpec.faceL !== imgInherit.faceL) patch.faceL = imgInherit.faceL;
    if (imgSpec.faceB !== imgInherit.faceB) patch.faceB = imgInherit.faceB;
    if (patch.puzzleType !== undefined || patch.cubeSize !== undefined) {
      const d = rotationDefaultsFor({ puzzleType: imgPuzzle.puzzleType, puzzleVariant: imgSpec.puzzleVariant });
      patch.rotateAxis1 = d.axis1; patch.rotateAngle1 = d.angle1;
      patch.rotateAxis2 = d.axis2; patch.rotateAngle2 = d.angle2;
    }
    // Mirror the sim's 左右 / 上下 / 透视 onto the CUBE preview (visualcube). visualcube
    // shares the sim's base orientation (F-forward, offset 0) and has a `dist` knob, so
    // the camera maps straight in (sign-flipped): preview = (−simYaw, −simPitch), and 透视
    // → dist — a full three-way link.
    if (imgPuzzle.puzzleType === 'cube') {
      const a1 = Math.round((1 - settings.viewAngle / 50) * 90);        // 左右
      const a2 = Math.round((settings.viewGradient / 50 - 1) * 90);     // 上下
      const distVal = Math.round((2 + (settings.perspective / 100) * 8) * 10) / 10; // 透视 → dist
      if (imgSpec.dist !== distVal) patch.dist = distVal;
      if (imgSpec.rotateAxis1 !== 'y') patch.rotateAxis1 = 'y';
      if (imgSpec.rotateAxis2 !== 'x') patch.rotateAxis2 = 'x';
      if (imgSpec.rotateAngle1 !== a1) patch.rotateAngle1 = a1;
      if (imgSpec.rotateAngle2 !== a2) patch.rotateAngle2 = a2;
    } else {
      // sr-puzzlegen exotics (sq1 / pyraminx / megaminx / skewb) — a visualcube-style clean
      // vector companion whose colours (PuzzleImage srSchemeFor) + orientation mirror the left.
      // 透视 also drives the sr preview camera (PuzzleImage srCameraDist reads `dist`), so keep
      // img_dist live and in step with the slider — it used to go stale here (never consumed).
      const distVal = Math.round((2 + (settings.perspective / 100) * 8) * 10) / 10;
      if (imgSpec.dist !== distVal) patch.dist = distVal;
      const base = SR_ANGLE_BASE[imgPuzzle.puzzleType];
      if (base) {
        // CALIBRATED: feed the sim's ABSOLUTE world angle (scene.rotation = Euler(pitch, yaw, 0),
        // yaw = (viewAngle/50−1)·90 about world-y, pitch = (1−viewGradient/50)·90 about world-x —
        // SettingDrawer mapYaw/mapPitch) with the puzzle's base offset/sign, so 左右/上下 track the
        // left exactly. PuzzleImage remaps y→z for sq1/pyraminx (their spin axis) and drives the
        // sr camera distance from 透视 (img_dist) via srCameraDist.
        const a1 = Math.round((settings.viewAngle / 50 - 1) * 90 * base.yawSign + base.yaw);
        const a2 = Math.round((1 - settings.viewGradient / 50) * 90 * base.pitchSign + base.pitch);
        if (imgSpec.rotateAxis1 !== 'y') patch.rotateAxis1 = 'y';
        if (imgSpec.rotateAxis2 !== 'x') patch.rotateAxis2 = 'x';
        if (imgSpec.rotateAngle1 !== a1) patch.rotateAngle1 = a1;
        if (imgSpec.rotateAngle2 !== a2) patch.rotateAngle2 = a2;
      } else {
        // NOT yet calibrated → anchor at the puzzle's canonical sr iso + the sim's slider
        // deviation (slope 1.8 = the sim's 90°/50-unit); tracks 左右/上下 approximately.
        const def = rotationDefaultsFor({ puzzleType: imgPuzzle.puzzleType, puzzleVariant: imgSpec.puzzleVariant });
        const a1 = Math.round(def.angle1 + (settings.viewAngle - 30) * 1.8);
        const a2 = Math.round(def.angle2 + (33 - settings.viewGradient) * 1.8);
        if (imgSpec.rotateAxis1 !== def.axis1) patch.rotateAxis1 = def.axis1;
        if (imgSpec.rotateAxis2 !== def.axis2) patch.rotateAxis2 = def.axis2;
        if (imgSpec.rotateAngle1 !== a1) patch.rotateAngle1 = a1;
        if (imgSpec.rotateAngle2 !== a2) patch.rotateAngle2 = a2;
      }
    }
    if (Object.keys(patch).length > 0) setImgSpec(patch);
  }, [imageStudioEngineOnly, imgPuzzle, imgInherit, imgSpec,
      settings.viewAngle, settings.viewGradient, settings.perspective, setImgSpec]);

  // ── 引擎 BSP 伴图镜像(sr / visualcube 伴图退役,Phase 3)────────────────
  // 3D 投影伴图(异形 iso + NxN cube normal)不再走 sr-puzzlegen / visualcube 的
  // 近似角度标定,而是把引擎场景本身经 BSP 解析隐面消除导出为矢量 SVG
  // (sim_svg_export_bsp)—— 相机/配色/状态与左边同源,天然一致,无毛刺。rAF
  // 低频采样场景几何签名,连续两拍不变(≈0.25s 静止)才导出一次;twist 动画 /
  // 拖动期间不重算,伴图显示上一静止帧。原核分色(BSP 会画错色)、超高阶爆量
  // (SVG_TOO_COMPLEX)时置 null 回退旧渲染器(cube→visualcube,异形→sr)。
  // 回退后悔药:/sim?img_engine=sr 强制全程旧路径(单 URL);部署级一键回退走
  // env NEXT_PUBLIC_SR_FALLBACK=1(build 时内联,免逐 URL 传参)。
  const [srCompanionForced] = useState<boolean>(() => {
    if (process.env.NEXT_PUBLIC_SR_FALLBACK === '1') return true;
    if (typeof window === 'undefined') return false;
    try { return new URLSearchParams(window.location.search).get('img_engine') === 'sr'; } catch { return false; }
  });
  const [engineSvg, setEngineSvg] = useState<string | null>(null);
  useEffect(() => {
    const active = imageOpen && !srCompanionForced;
    if (!active) { setEngineSvg(null); return; }
    // 贴纸遮罩(mask 直映):有派生表的拼图把灰化烙进镜像;没有的整程置 null,
    // PuzzleImage 落回 spec 渲染器(sr/visualcube 认 mask)—— 哪条路都不丢遮罩。
    // engine-only 拼图没有遮罩编辑入口,忽略 URL 残值(免把伴图饿死在等待帧)。
    const maskIds = imageStudioEngineOnly ? null : parseMask(imgSpec.stickerMask || '');
    const maskKeys = maskIds?.size ? toEngineMask(imgPuzzle.puzzleType, maskIds) : null;
    if (maskIds?.size && maskKeys === undefined) { setEngineSvg(null); return; }
    // 伴图复杂度上限:普通阶几何 ≈ 88 三角/块 + 204 三角/贴纸,6x6 ≈ 5.7 万已是
    // 主线程单帧 ~1s 量级;更高阶(至 N≥50 换简化几何前)会到百万级,必须掐断。
    // 超限在收集阶段即抛(几十 ms),伴图回退 visualcube,不卡页面。
    const MAX_TRIS = 64_000;
    let raf = 0;
    let frame = 0;
    let lastSig = '';
    let stable = 0;
    let exportedSig = '';
    let disposed = false;
    type SvgView = Pick<World, 'scene' | 'camera' | 'width' | 'height'>;
    const sigOf = (world: SvgView): string => {
      let h = 0;
      const mix = (v: number): void => { h = (h * 31 + Math.round(v * 1000)) | 0; };
      mix(world.width); mix(world.height);
      const ce = world.camera.matrixWorld.elements;
      mix(ce[12]); mix(ce[13]); mix(ce[14]);
      world.scene.traverseVisible((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const e = m.matrixWorld.elements;
        mix(e[12]); mix(e[13]); mix(e[14]); mix(e[0]); mix(e[5]); mix(e[9]);
        const im = m as THREE.InstancedMesh;
        if (im.isInstancedMesh) mix(im.instanceMatrix.version);
        // twisty(cubing.js PG3D)转动/换色改的是顶点属性不是变换矩阵 —— 把
        // position/color 的 version 掺进签名,静止检测才看得见它的变化。
        const g = m.geometry as THREE.BufferGeometry | undefined;
        if (g?.attributes) {
          const pos = g.getAttribute('position');
          if (pos) mix((pos as THREE.BufferAttribute).version);
          const col = g.getAttribute('color');
          if (col) mix((col as THREE.BufferAttribute).version);
        }
      });
      return String(h);
    };
    // twisty 拼图(PG 目录 / 自定义切割 / cubing.js 渲染的 fto)无引擎 world:伴图
    // 从 TwistyPlayer vantage 取 scene+camera,喂截图 SVG 同款投影导出器(painter,
    // 颜色 sRGB 直存)。vantage 异步解析,缓存供采样拍同步用;每拍都发起刷新(不只
    // 解析一次):自定义切割改 experimentalPuzzleDescription 时 player 原地换内部
    // scene,缓存住旧 scene 伴图就冻住了。player 实例换了(切拼图)立即作废缓存。
    let twistyView: { scene: THREE.Scene; camera: THREE.PerspectiveCamera; el: Element } | null = null;
    let twistyRefreshing = false;
    let twistyFor: unknown = null;
    const refreshTwistyView = (tp: TwistyPlayerLike): void => {
      if (twistyRefreshing || !tp.experimentalCurrentVantages) return;
      twistyRefreshing = true;
      void (async () => {
        const vantage = [...await tp.experimentalCurrentVantages!()][0];
        if (!vantage) return;
        const camera = await vantage.camera();
        const scene = await vantage.scene.scene();
        if (disposed || twistyPlayerRef.current !== tp) return;
        twistyView = { scene, camera, el: (vantage.contentWrapper ?? tp) as unknown as Element };
      })().finally(() => { twistyRefreshing = false; });
    };
    const tick = (): void => {
      if (disposed) return;
      raf = requestAnimationFrame(tick);
      if (++frame % 8 !== 0) return; // ~7.5Hz 采样
      const world = worldRef.current;
      if (world) {
        world.scene.updateMatrixWorld(true);
        const sig = sigOf(world);
        if (sig !== lastSig) { lastSig = sig; stable = 0; return; }
        if (stable < 1) { stable++; return; }
        if (sig === exportedSig) return;
        exportedSig = sig;
        try {
          // 拼图带示意小面(userData.schematicPoly)→ SR 范式示意导出器:每个小面
          // 独立多边形 + 黑描边,共享棱逐比特重合;其余拼图走实模 BSP 投影。
          if (hasSchematicFacelets(world.scene)) {
            // 黑边滑块 = 网格缝宽占小面的百分比(inset 模型):比例量纲天然与
            // 视口尺寸、阶数无关 —— 交换态小框视口、40 阶小贴纸下观感都恒定。
            setEngineSvg(exportSimSvgSchematic({
              world,
              inset: imgOutline / 100,
              mask: maskKeys?.size ? { keys: maskKeys, color: MASK_COLOR } : undefined,
            }));
            return;
          }
          if (bspSceneAudit(world.scene).miscolors) { setEngineSvg(null); return; } // 原核分色:回退旧渲染器
          setEngineSvg(exportSimSvgBsp({ world, maxTriangles: MAX_TRIS }));
        } catch (err) {
          if (!(err instanceof Error && err.message.startsWith('SVG_TOO_COMPLEX'))) {
            console.warn('[sim] BSP companion export failed', err);
          }
          setEngineSvg(null); // 本帧回退旧渲染器
        }
        return;
      }
      // twisty 路径。spec 可渲染拼图(skewb/pyra/mega 在 cubing.js 渲染下)保持
      // 既有 sr 伴图,不抢:只有 engine-only 拼图走 vantage 镜像。
      if (!imageStudioEngineOnly) { if (exportedSig) { exportedSig = ''; setEngineSvg(null); } return; }
      const tp = twistyPlayerRef.current as TwistyPlayerLike | null;
      if (!tp) { if (exportedSig) { exportedSig = ''; setEngineSvg(null); } return; }
      if (tp !== twistyFor) { twistyFor = tp; twistyView = null; }
      refreshTwistyView(tp); // 每拍刷新缓存(异步),本拍仍用手头这份
      if (!twistyView) return;
      const rect = twistyView.el.getBoundingClientRect();
      const view: SvgView = {
        scene: twistyView.scene,
        camera: twistyView.camera,
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      };
      view.scene.updateMatrixWorld(true);
      const sig = sigOf(view);
      if (sig !== lastSig) { lastSig = sig; stable = 0; return; }
      if (stable < 1) { stable++; return; }
      if (sig === exportedSig) return;
      exportedSig = sig;
      try {
        setEngineSvg(exportSimSvg({ world: view, srgbColors: true }));
      } catch (err) {
        console.warn('[sim] twisty companion export failed', err);
        setEngineSvg(null);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => { disposed = true; cancelAnimationFrame(raf); };
  }, [imageOpen, srCompanionForced, imageStudioEngineOnly, imgOutline,
      imgSpec.stickerMask, imgPuzzle.puzzleType,
      settings.faceColors, query.stickering, query.stickeringColor]);

  // 伴图当前是否示意版(有示意小面)—— 决定黑边滑块是否可用。
  const [engineSchematic, setEngineSchematic] = useState(false);
  useEffect(() => {
    if (!(imageOpen && !srCompanionForced)) { setEngineSchematic(false); return; }
    const world = worldRef.current;
    setEngineSchematic(!!world && hasSchematicFacelets(world.scene));
  }, [imageOpen, srCompanionForced, imgPuzzle.puzzleType, engineSvg]);

  // 2D flat-net view mode — NxN only (number puzzle), driven by the same live cube.
  const netMode = settings.viewMode === 'net' && typeof puzzleParam === 'number';

  // 主图 ↔ 伴图交换态生效条件(与画布 wrap 的 --imgswap class 同一判据):把它写进
  // resize 闭包读的 ref,再触发一次重排,渲染器在全幅 ↔ 左上小框之间切换。
  const imgSwapActive = imageOpen && imgSwap && !netMode;
  useEffect(() => {
    imgSwapRef.current = imgSwapActive;
    resizeMainViewRef.current?.();
  }, [imgSwapActive]);

  return (
    <div className={`sim-page${fullscreen ? ' sim-page--fullscreen' : ''}`} data-board-bg={settings.boardBg}>
      <header className="sim-header">
        <HomeLink className="sim-back" title={t('返回', 'Back')}>
          <ChevronLeft size={18} />
        </HomeLink>
        <h1 className="sim-title">{t('模拟', 'Sim')}</h1>
        <div className="sim-spacer" />
        {reconHref && (
          <AppLink
            href={reconHref}
            className="sim-open-recon"
            title={t('把当前打乱 / 解法带去发布复盘', 'Take this scramble / solution to a reconstruction')}
          >
            {t('去复盘', 'Open in Recon')}
          </AppLink>
        )}
      </header>

      <div className="sim-body">
        <div className="sim-stage">
        <div
          className={`sim-canvas-wrap${netMode ? ' sim-canvas-wrap--net' : ''}${imgSwapActive ? ' sim-canvas-wrap--imgswap' : ''}`}
          ref={containerRef}
        >
          {netMode && (
            <SimCubeNet
              getWorld={getWorld}
              worldTick={worldTick}
              order={order}
              userMoveRef={userMoveRef}
              faceColors={settings.faceColors}
              pointerTurns={settings.pointerTurns !== false}
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
              // 按阶段展示色块:cubing.js 原生支持的拼图直接透传阶段名(其余拼图
              // 不传 — undefined = TwistySection 不接管该属性)。
              experimentalStickering={(puzzleParam === 'megaminx' || puzzleParam === 'fto') ? query.stickering : undefined}
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
          {/* 图像面板的预览浮在画布左上角(与右上角背面小窗对称),内容由
              PuzzleImageStudio portal 进来 —— 面板折叠时 studio 不挂载,这里自然空着。
              portal 的容器必须是它独占的节点(React 不能同时管容器的 children 和
              portal 内容),所以关闭钮挂在外层、host 是里面那层。 */}
          {/* 常挂:studio 常驻侧栏,预览总要有个 portal 落点。关掉只是 display:none
              (若卸载,previewHost 变 null → studio 会把预览渲回侧栏里)。 */}
          <div className="sim-image-overlay" style={{ display: imageOpen ? 'block' : 'none' }}>
            <div className="sim-image-overlay-host" ref={setImageHost} />
            <button
              type="button"
              className="sim-float-close"
              onClick={() => setImageOpen(false)}
              title={t('关闭图像', 'Hide image')}
              aria-label={t('关闭图像', 'Hide image')}
            >
              <X size={12} />
            </button>
            {/* 交换主图 ↔ 伴图:与背面小窗右下角的交换钮同款。开着时伴图铺满画布、
                实时 3D 缩进左上小框(纯 CSS 换位,见 .sim-canvas-wrap--imgswap)。
                net 视图没有可缩的主 3D → 不给按钮。 */}
            {!netMode && (
              <button
                type="button"
                className="sim-backview-swap sim-image-swap"
                onClick={() => setImgSwap((v) => !v)}
                aria-pressed={imgSwap}
                title={t('交换主图与伴图', 'Swap main view / companion image')}
                aria-label={t('交换主图与伴图', 'Swap main view / companion image')}
              >
                <ArrowLeftRight size={14} />
              </button>
            )}
          </div>
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
          {/* 背面小窗的关闭钮 —— 与图像浮层那个同款,钉在小窗右上内角。小窗自身
              pointer-events:none,按钮在 .sim-float-close 里自带 auto。 */}
          {!twisty && !netMode && settings.backView && (
            <button
              type="button"
              className="sim-float-close sim-float-close--backview"
              onClick={() => setSettings((prev) => ({ ...prev, backView: false }))}
              title={t('关闭小窗', 'Hide back view')}
              aria-label={t('关闭小窗', 'Hide back view')}
            >
              <X size={12} />
            </button>
          )}
        </div>
        <div className="sim-playback-under" ref={setPlaybackSlot} />
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
              activePuzzle={puzzleParam}
            />
          </CollapsibleSection>
          {puzzleParam === 'custom' && (
            <div className="sim-cut-editor-wrap">
              <CutEditor value={customCuts} onChange={(d) => setQuery({ cuts: d })} />
            </div>
          )}
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
            playbackSlot={playbackSlot}
            fullscreenButton={
              <button
                type="button"
                className="playback-bar-btn"
                onClick={() => setFullscreen(!fullscreen)}
                title={fullscreen ? t('退出全屏', 'Exit fullscreen') : t('全屏魔方', 'Fullscreen cube')}
                aria-label={fullscreen ? t('退出全屏', 'Exit fullscreen') : t('全屏魔方', 'Fullscreen cube')}
              >
                {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            }
            /* 两个浮层的「找回来」按钮,位置对应它们在画布上的角:图像在左上 → 按钮在
               最左;背面小窗在右上 → 按钮在最右。只在对应浮层关着时出现 —— 开着时关它
               的入口是浮层自己右上角那个 ×,这里再放一个同义按钮纯属占位。 */
            imageButton={!imageOpen ? (
              <button
                type="button"
                className="playback-bar-btn"
                onClick={() => setImageOpen(true)}
                title={t('显示图像', 'Show image')}
                aria-label={t('显示图像', 'Show image')}
              >
                <ImagePlus size={14} />
              </button>
            ) : null}
            /* 小窗按钮在两条渲染路径下语义不同,因为「关」的入口不一样:
               - 引擎(NxN / SQ1):小窗是我们自己画的浮层,右上角有 ×,所以这里
                 只做「开」,关着时才出现,和图像那个一致;
               - cubing.js:小窗是 player 原生画的,我们钉不上 ×(那块区域归它管),
                 所以这里必须常驻并且是真开关,否则 settings.backView 在这条路径上
                 一个入口都没有 —— 侧栏那个「小窗」toggle 已经删掉了。 */
            backViewButton={!netMode && (twisty || !settings.backView) ? (
              <button
                type="button"
                className="playback-bar-btn"
                aria-pressed={twisty ? settings.backView : undefined}
                onClick={() => setSettings((prev) => ({
                  ...prev, backView: twisty ? !prev.backView : true,
                }))}
                title={twisty && settings.backView ? t('关闭小窗', 'Hide back view') : t('显示小窗', 'Show back view')}
                aria-label={twisty && settings.backView ? t('关闭小窗', 'Hide back view') : t('显示小窗', 'Show back view')}
              >
                <PictureInPicture2 size={14} />
              </button>
            ) : null}
            stickering={query.stickering}
            onStickeringChange={(v) => setQuery({ stickering: v === 'full' ? null : v })}
            stickeringColor={query.stickeringColor}
            onStickeringColorChange={(v) => setQuery({ stickeringColor: v === 'yellow' ? null : v })}
          />
          {/* 图像:不再套折叠区。图本身已经浮在画布左上角,侧栏这一段只剩控件 + 导出,
              一个「图像」标题栏既没东西可折叠也没图可指。显隐归浮层自己的 × 和播放条
              按钮(imageOpen),侧栏常驻。 */}
          <PuzzleImageStudio
            mode="panel"
            spec={imgSpec}
            onSpecChange={setImgSpec}
            simBridge={simBridge}
            previewHost={imageHost}
            engineSvg={engineSvg}
            engineOnly={imageStudioEngineOnly}
            outlineWidth={engineSchematic ? imgOutline : undefined}
            onOutlineWidthChange={setImgOutline}
          />
          {/* Group-theory panel = the visible half of the non-cubing.js view. Shows for any
              PG-bound puzzle that isn't on cubing.js. Pure-engine PG puzzles (dino/heli/NxN)
              have no cubing.js option at all → the panel is always on for them. */}
          {(((PG_BOUND_KINDS.has(String(puzzleParam)) || (typeof puzzleParam === 'number' && nxnHasPgKernel(puzzleParam)))
            && (query.renderer !== 'cubing' || !ENGINE_TWISTY.has(String(puzzleParam))))
            // cubing.js "explore" puzzles: facts-only kernel, shown unless the user picks the
            // plain cubing.js renderer (default renderer is 'group', so on by default).
            || (EXPLORE_BOUND.has(String(puzzleParam)) && query.renderer !== 'cubing')) && (
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
