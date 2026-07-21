/**
 * simCaps — the single source of truth for each /sim puzzle's UI capabilities.
 *
 * PlayerControls (which controls/toggles to render) and SettingDrawer (which cube
 * methods to drive) both read this. Adding a puzzle's control surface is therefore
 * ONE entry here — never a hand-edit to the toggle JSX or a per-puzzle boolean
 * chain (`isDinoLocal || isRediLocal || …`). Sibling registry: `CORNER_SPECS` in
 * PlayerControls.tsx holds the engine-action specs (parse / scramble / invert /
 * reduce) for corner-turn puzzles; together they keep the shared sim files free of
 * per-puzzle wiring.
 */
import type { SimPuzzle } from './PlayerControls';

export type SimRenderer = 'cubing' | 'engine' | 'group';

/** Which element a puzzle turns — sets the debug "carve" toggle's label/semantics. */
export type CarveElement = 'corner' | 'face' | 'edge';

/** Debug "isolate" piece kinds a puzzle can show one-at-a-time (inverse of carve:
 *  keep this kind, hide the rest). The cube taxonomy; a puzzle declares the subset
 *  it tags + implements `setIsolate` for. */
export type IsolateKind = 'corner' | 'edge' | 'center' | 'core';

/** One isolate-able kind + how many pieces of it there are, so the UI can offer a
 *  「全部 / 第 1…count 个」index picker (user wants to view a single piece, or all).
 *  `setIsolate(kind, index)` — index −1 = all, 0…count−1 = that one piece. */
export interface IsolateSpec { kind: IsolateKind; count: number; }

export interface SimPuzzleCaps {
  /** Who renders it → which controls apply.
   *  - `always`     in-house Three.js engine only (nxn / sq1 / ivy / dino / redi / rex / heli)
   *  - `engineMode` cubing.js by default, in-house engine when renderer !== 'cubing'
   *                 (skewb / pyraminx / megaminx — these get the renderer dropdown)
   *  - `never`      cubing.js TwistyPlayer only (PG explore puzzles) */
  engine: 'always' | 'engineMode' | 'never';
  /** The debug "carve" toggle hides one move's moving group to reveal the core; which
   *  element the puzzle turns sets the label:
   *  - `corner` 挖角 — corner-turn puzzles + ivy (Ivy / Dino / Redi / Rex / Skewb / Pyraminx)
   *  - `face`   挖面 — face-turn puzzles (Megaminx)
   *  - `edge`   挖棱 — edge-turn puzzles (Helicopter)
   *  Omitted = no carve (NxN / SQ1 — no single moving group to lift off). A puzzle turns
   *  exactly one kind of element, so this is one value, not a set. The cube implements a
   *  uniform `setCarve(on)` regardless of element. */
  carve?: CarveElement;
  /** Debug "isolate": the piece kinds this puzzle can show alone (hiding the rest) —
   *  the inverse of carve — each with its piece count for the index picker. Requires
   *  the cube to implement `setIsolate(kind|null, index)` and tag its pieces by kind.
   *  The dropdown lists exactly these kinds (+ 关). Omitted = the puzzle has no
   *  per-kind isolation → the control grays out. Gear (corner/edge gear/center) is
   *  the first; other engines opt in by declaring their subset. */
  isolate?: IsolateSpec[];
  /** Whether the /sim 图像 panel shows for this puzzle. Spec-renderable types (NxN cube /
   *  mirror / sq1 / skewb / pyraminx / megaminx) get the full studio (spec controls + API
   *  links);其余引擎拼图(fto / ivy / dino / redi / rex / heli / gear)走 engine-only
   *  模式 —— 面板只有引擎矢量伴图 + SVG/PNG 下载(SimPage 的 imageStudioEngineOnly),
   *  且要求引擎路径激活(cubing.js 渲染下无 world 出不了伴图)。false 仅剩 custom /
   *  PG-explore(纯 TwistyPlayer,无 world)。 */
  imageStudio: boolean;
}

const NXN_CAPS: SimPuzzleCaps = { engine: 'always', imageStudio: true };
const TWISTY_CAPS: SimPuzzleCaps = { engine: 'never', imageStudio: false };

/** Per-kind capabilities. Keyed by the string puzzle kinds; NxN (numeric kind) and
 *  PG explore puzzles fall back to NXN_CAPS / TWISTY_CAPS respectively. */
const CAPS: Record<string, SimPuzzleCaps> = {
  sq1: { engine: 'always', imageStudio: true },
  ivy: { engine: 'always', carve: 'corner', imageStudio: true },
  dino: { engine: 'always', carve: 'corner', imageStudio: true },
  redi: { engine: 'always', carve: 'corner', imageStudio: true },
  rex: { engine: 'always', carve: 'corner', imageStudio: true },
  heli: { engine: 'always', carve: 'edge', imageStudio: true },
  // Gear Cube — geared 180° face flips; carving lifts one face layer off the middle.
  // Isolate: inspect one block kind alone (角 8 / 棱 12 / 中心 6) — user request. 中心块
  // shows the center pieces + core together (merged 中心块 + 骨架, one skeleton unit).
  gear: {
    engine: 'always', carve: 'face',
    isolate: [{ kind: 'corner', count: 8 }, { kind: 'edge', count: 12 }, { kind: 'center', count: 6 }],
    imageStudio: true,
  },
  skewb: { engine: 'engineMode', carve: 'corner', imageStudio: true },
  pyraminx: { engine: 'engineMode', carve: 'corner', imageStudio: true },
  megaminx: { engine: 'engineMode', carve: 'face', imageStudio: true },
  fto: { engine: 'engineMode', carve: 'face', imageStudio: true },
  // Mirror Cube — order-3 NxN engine (uniform logic, non-uniform geometry). Like NxN
  // it has no single moving group to lift off, so no carve. Studio renders it as a cube.
  mirror: { engine: 'always', imageStudio: true },
};

/** Static capabilities for a puzzle kind (independent of the active renderer). */
export function puzzleCaps(kind: SimPuzzle): SimPuzzleCaps {
  if (typeof kind === 'number') return NXN_CAPS;
  return CAPS[kind] ?? TWISTY_CAPS;
}

/** Which settings actually DO something for the current (kind, renderer). A `false`
 *  control still renders (the panel shape stays identical per puzzle) but is grayed out
 *  and non-interactive — "feature not built for this puzzle yet". Grounded in the two
 *  apply paths, NOT guessed:
 *   - in-house engine (SettingDrawer.applySettings, runs only when a `world` exists):
 *     drives sensitivity / perspective / face-label常显 / lockView / 立体贴片 / 镂空 /
 *     半转停 / 结构着色 / 内核色, plus NxN-InstancedRenderer-only 面色 / logo / 箭头.
 *   - cubing.js TwistyPlayer (components/TwistySection, world-less): honors only
 *     scale / yaw / pitch / speed / 提示贴片(hint) / 小窗(backView) / 锁定大小位置(lockView)
 *     / 方位字母常显(FaceOverlay, skewb/pyraminx/megaminx only) — the rest no-op.
 *   - shared by both paths regardless of engine: 动画(play loop) / 背景(CSS data-attr) /
 *     拖空白(twisty honors 'rotate') / 锁定大小位置(both wire a lockView guard into their
 *     zoom handlers), so those are never disabled here.
 *  So everything below keys off `engineActive`, except 锁定大小位置(both paths honor it),
 *  方位字母(engine via faceHints OR cubing.js FaceOverlay puzzles), and 面色/logo which need
 *  the NxN InstancedRenderer specifically. */
export interface ControlSupport {
  sensitivity: boolean;
  perspective: boolean;
  faceLabels: boolean;
  lockView: boolean;
  thickness: boolean;
  hollow: boolean;
  holdPartialTurn: boolean;
  structureColor: boolean;
  coreColor: boolean;
  faceColors: boolean;
  logo: boolean;
  carve: boolean;
  /** 隔离(只看某类块):inverse of carve. True iff the engine is active and the puzzle
   *  declares isolate kinds. The kinds themselves are in ResolvedCaps.isolate. */
  isolate: boolean;
  /** 手指(指法演示):双手握持 + 腕转/弹指跟层动画。仅 3x3(手势姿态按
   *  order-3 的几何标定;镜面块形不均不贴手)。 */
  hands: boolean;
  /** 调试:手部 MediaPipe 风格骨架叠加线(关节点+连线)。同 hands 一样仅 3x3。 */
  handsSkeleton: boolean;
  /** 按阶段展示色块(twizzle edit 的 Stickering 下拉,issue #27)。NxN(order≥2)走
   *  引擎遮罩(engine/nxn/stickering.ts);megaminx / fto 在 cubing.js 渲染下走原生
   *  experimentalStickering。镜面(单色)/ 其余拼图(cubing.js 只有 full)不支持。
   *  例外约定:false 时播放条**隐藏**该下拉(不是置灰)—— 它住在魔方下方的播放条,
   *  不在设置抽屉,置灰只会占掉窄屏播放条的空间。 */
  stickering: boolean;
}

export interface ResolvedCaps {
  /** Rendered by the in-house engine right now → engine-only toggles apply
   *  (立体贴片 / 镂空 / 调试:半转停住 / 调试:结构着色). */
  engineActive: boolean;
  /** The carve element to show a 挖角 / 挖面 / 挖棱 toggle for, or null (no carve). */
  carve: CarveElement | null;
  /** The isolate-able kinds (+ counts) the 隔离 dropdown offers (empty = unsupported
   *  → control grays). Count drives the 「全部 / 第 N 个」 index picker. */
  isolate: IsolateSpec[];
  /** Show the cubing.js ↔ 群论内核 renderer dropdown. Always true: every puzzle exposes
   *  the dropdown so 群论内核 is offered everywhere — even on puzzles whose group kernel
   *  isn't built yet (a forward placeholder; selecting an unimplemented renderer is a safe
   *  no-op, the rendering pipeline keeps the puzzle's only working path). */
  hasRendererChoice: boolean;
  /** Per-control support — false → gray the control out (see ControlSupport). */
  supports: ControlSupport;
}

/** Capabilities resolved against the active renderer. */
export function resolveCaps(kind: SimPuzzle, renderer: SimRenderer): ResolvedCaps {
  const c = puzzleCaps(kind);
  const engineActive = c.engine === 'always' || (c.engine === 'engineMode' && renderer !== 'cubing');
  const carve = engineActive ? (c.carve ?? null) : null;
  const isolate = engineActive ? (c.isolate ?? []) : [];
  const isNxN = typeof kind === 'number';
  const isMirror = kind === 'mirror';
  // 方位字母 overlay 仅这三个拼图在 cubing.js 渲染下有(FACE_TABLES);engine 渲染走自有 faceHints。
  // FTO / PG explore 在 cubing.js 下无 overlay → 字母仍不支持。
  const overlayLabels = kind === 'skewb' || kind === 'pyraminx' || kind === 'megaminx';
  return {
    engineActive,
    carve,
    isolate,
    hasRendererChoice: true,
    supports: {
      sensitivity: engineActive,
      perspective: engineActive,
      // 方位字母:engine 路径走自有 faceHints;cubing.js 路径仅 skewb/pyraminx/megaminx 有 FaceOverlay。
      faceLabels: engineActive || overlayLabels,
      // 锁定大小位置:两条路径都接了 —— 引擎走 SimPage onWheel/pan/pinch 的 lockView 提前 return,
      // cubing.js 走 TwistySection wheel/pinch effect 的 lockViewRef 守卫。每个拼图都有缩放可锁 → 恒真。
      lockView: true,
      thickness: engineActive,
      hollow: engineActive,
      holdPartialTurn: engineActive,
      structureColor: engineActive,
      // 内核色 / 原核: NxN sets frame材质, engine-body puzzles paint raw bodies — both need
      // the in-house engine; cubing.js has no equivalent. Mirror (engine='always') 走 grooves.
      coreColor: engineActive,
      // 面色: only the NxN InstancedRenderer (and Mirror, which IS the NxN engine) re-applies
      // face colors live; other engine-body puzzles bake their sticker colors at construction.
      faceColors: isNxN || isMirror,
      // 顶面 U 中心 logo: NxN InstancedRenderer 特性 —— 含镜面(它是 order-3 NxN 引擎,
      // 走同一条 cube.setLogo() 路径,有正中心块)。其它 engine-body 拼图无中心贴片不支持。
      logo: isNxN || isMirror,
      carve: carve !== null,
      isolate: isolate.length > 0,
      // 手指(指法演示): rig 的握持/手势按 order-3 标定,且要求 NxN 引擎的
      // table.groups 逐层 angle 可轮询 → 仅 3x3(镜面走 'mirror' kind,不含)。
      hands: kind === 3,
      handsSkeleton: kind === 3,
      // 阶段色块:NxN 引擎(1 阶无层可分)或 cubing.js 原生支持的 megaminx / fto。
      stickering: (isNxN && (kind as number) >= 2)
        || (!engineActive && (kind === 'megaminx' || kind === 'fto')),
    },
  };
}
