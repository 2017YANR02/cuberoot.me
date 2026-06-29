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
}

const NXN_CAPS: SimPuzzleCaps = { engine: 'always' };
const TWISTY_CAPS: SimPuzzleCaps = { engine: 'never' };

/** Per-kind capabilities. Keyed by the string puzzle kinds; NxN (numeric kind) and
 *  PG explore puzzles fall back to NXN_CAPS / TWISTY_CAPS respectively. */
const CAPS: Record<string, SimPuzzleCaps> = {
  sq1: { engine: 'always' },
  ivy: { engine: 'always', carve: 'corner' },
  dino: { engine: 'always', carve: 'corner' },
  redi: { engine: 'always', carve: 'corner' },
  rex: { engine: 'always', carve: 'corner' },
  heli: { engine: 'always', carve: 'edge' },
  skewb: { engine: 'engineMode', carve: 'corner' },
  pyraminx: { engine: 'engineMode', carve: 'corner' },
  megaminx: { engine: 'engineMode', carve: 'face' },
  fto: { engine: 'engineMode', carve: 'face' },
  // Mirror Cube — order-3 NxN engine (uniform logic, non-uniform geometry). Like NxN
  // it has no single moving group to lift off, so no carve.
  mirror: { engine: 'always' },
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
}

export interface ResolvedCaps {
  /** Rendered by the in-house engine right now → engine-only toggles apply
   *  (立体贴片 / 镂空 / 调试:半转停住 / 调试:结构着色). */
  engineActive: boolean;
  /** The carve element to show a 挖角 / 挖面 / 挖棱 toggle for, or null (no carve). */
  carve: CarveElement | null;
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
  const isNxN = typeof kind === 'number';
  const isMirror = kind === 'mirror';
  // 方位字母 overlay 仅这三个拼图在 cubing.js 渲染下有(FACE_TABLES);engine 渲染走自有 faceHints。
  // FTO / PG explore 在 cubing.js 下无 overlay → 字母仍不支持。
  const overlayLabels = kind === 'skewb' || kind === 'pyraminx' || kind === 'megaminx';
  return {
    engineActive,
    carve,
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
    },
  };
}
