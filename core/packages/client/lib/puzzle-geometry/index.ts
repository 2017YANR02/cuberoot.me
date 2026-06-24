// Top-level barrel for the vendored cubing.js `puzzle-geometry` subsystem.
// Reconstructed during vendoring (upstream's `index.ts` was inlined away by the
// bundler). Surfaces the public PuzzleGeometry API plus the group-theory core
// (Schreier-Sims, Perm, the PGOrbit wreath algebra) that the original index kept
// internal — we want it reachable for our own |G| / state / scramble work.
// Original cubing.js source + license headers live in the sibling files (MPL-2.0).

// ── Geometry compiler ────────────────────────────────────────────────────────
export {
  PuzzleGeometry,
  PGNotation,
  FaceTree,
  expandfaces,
  getPG3DNamedPuzzles,
  getPuzzleDescriptionString,
  getPuzzleGeometryByDesc,
  getPuzzleGeometryByName,
  parsePuzzleDescription,
  PUZZLE_BASE_SHAPES,
  PUZZLE_CUT_TYPES,
} from "./PuzzleGeometry";
export type {
  StickerDat,
  StickerDatSticker,
  StickerDatFace,
  StickerDatAxis,
  TextureMapper,
  PuzzleBaseShape,
  PuzzleCutType,
  PuzzleCutDescription,
  PuzzleDescription,
} from "./PuzzleGeometry";

// ── Geometry primitives ──────────────────────────────────────────────────────
export { Quat, centermassface, solvethreeplanes } from "./Quat";
export * as PlatonicGenerator from "./PlatonicGenerator";

// ── Group theory ─────────────────────────────────────────────────────────────
export { schreierSims } from "./SchreierSims";
export {
  Perm,
  identity,
  iota,
  zeros,
  random,
  factorial,
  lcm,
} from "./Perm";
export {
  PGOrbitDef,
  PGOrbitsDef,
  PGOrbit,
  PGTransform,
  PGTransformBase,
  VisibleState,
  externalName,
  showcanon,
  showcanon0,
} from "./PermOriSet";

// ── Puzzle catalogue + options ───────────────────────────────────────────────
export { pgPuzzle, legacyPuzzleNameMapping } from "./pgPuzzles";
export type { PuzzleName, PuzzleDescriptionString } from "./pgPuzzles";
export { PuzzleGeometryFullOptions } from "./Options";
export type { PuzzleGeometryOptions } from "./Options";
export { FaceNameSwizzler } from "./FaceNameSwizzler";
export { PGColors, defaultPlatonicColorSchemes } from "./colors";
