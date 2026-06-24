// Barrel for the puzzle-geometry notation mappers. Reconstructed during vendoring
// (upstream's `notation-mapping/index.ts` was inlined away by the bundler, so it
// is not present in the shipped source map). Re-exports match the symbols that
// PuzzleGeometry / PermOriSet import from "./notation-mapping". See sibling files
// for the original cubing.js source + license (MPL-2.0).
export type { NotationMapper } from "./NotationMapper";
export { remapKPuzzleDefinition } from "./NotationMapper";
export { NullMapper } from "./NullMapper";
export { FaceRenamingMapper } from "./FaceRenamingMapper";
export { FTONotationMapper } from "./FTONotationMapper";
export { MegaminxScramblingNotationMapper } from "./MegaminxScramblingNotationMapper";
export { NxNxNCubeMapper } from "./NxNxNCubeMapper";
export {
  PyraminxNotationMapper,
  TetraminxNotationMapper,
} from "./PyraminxNotationMapper";
export { SkewbNotationMapper } from "./SkewbNotationMapper";
