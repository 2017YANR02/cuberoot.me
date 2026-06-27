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
}

/** Capabilities resolved against the active renderer. */
export function resolveCaps(kind: SimPuzzle, renderer: SimRenderer): ResolvedCaps {
  const c = puzzleCaps(kind);
  const engineActive = c.engine === 'always' || (c.engine === 'engineMode' && renderer !== 'cubing');
  return {
    engineActive,
    carve: engineActive ? (c.carve ?? null) : null,
    hasRendererChoice: true,
  };
}
