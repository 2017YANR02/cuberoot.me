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

export interface SimPuzzleCaps {
  /** Who renders it → which controls apply.
   *  - `always`     in-house Three.js engine only (nxn / sq1 / ivy / dino / redi / rex / heli)
   *  - `engineMode` cubing.js by default, in-house engine when renderer !== 'cubing'
   *                 (skewb / pyraminx / megaminx — these get the renderer dropdown)
   *  - `never`      cubing.js TwistyPlayer only (PG explore puzzles) */
  engine: 'always' | 'engineMode' | 'never';
  /** Supports the 挖角 (carve-corner) debug toggle = corner-turn engine puzzles + ivy.
   *  Megaminx is face-turn (no corner to carve); NxN / SQ1 have no carve either. */
  carveCorner: boolean;
}

const NXN_CAPS: SimPuzzleCaps = { engine: 'always', carveCorner: false };
const TWISTY_CAPS: SimPuzzleCaps = { engine: 'never', carveCorner: false };

/** Per-kind capabilities. Keyed by the string puzzle kinds; NxN (numeric kind) and
 *  PG explore puzzles fall back to NXN_CAPS / TWISTY_CAPS respectively. */
const CAPS: Record<string, SimPuzzleCaps> = {
  sq1: { engine: 'always', carveCorner: false },
  ivy: { engine: 'always', carveCorner: true },
  dino: { engine: 'always', carveCorner: true },
  redi: { engine: 'always', carveCorner: true },
  rex: { engine: 'always', carveCorner: true },
  heli: { engine: 'always', carveCorner: true },
  skewb: { engine: 'engineMode', carveCorner: true },
  pyraminx: { engine: 'engineMode', carveCorner: true },
  megaminx: { engine: 'engineMode', carveCorner: false },
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
  /** Show the 挖角 (carve-corner) debug toggle. */
  carveCorner: boolean;
  /** Show the cubing.js ↔ 群论内核 renderer dropdown. */
  hasRendererChoice: boolean;
}

/** Capabilities resolved against the active renderer. */
export function resolveCaps(kind: SimPuzzle, renderer: SimRenderer): ResolvedCaps {
  const c = puzzleCaps(kind);
  const engineActive = c.engine === 'always' || (c.engine === 'engineMode' && renderer !== 'cubing');
  return {
    engineActive,
    carveCorner: engineActive && c.carveCorner,
    hasRendererChoice: c.engine === 'engineMode',
  };
}
