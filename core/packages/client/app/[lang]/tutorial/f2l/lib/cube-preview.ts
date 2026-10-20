import { Alg, Grouping } from 'cubing/alg';
import { resolveSimPreviewMoves } from '@/components/AlgPlayer/player-setup';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import { FM_REGULAR, FM_IGNORED, stickeringMaskFn, type StickeringMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { CUBE_COLOR_LETTER_FOR_FACE, type CubeFace } from '@/lib/cube-colors';
import { orientedFaceColors } from '@/lib/cube-orientation';

/** Four insertions in successive slots; the final y restores the original frame. */
export const F2L_INTRO_ALG = "(R U R') y (R U' R') y (F' U' F) y (F' U F) y";
// Piece identities in the solved frame: FR → BR → BL → FL under successive y turns.
const INTRO_PAIRS = [[20, 23], [2, 5], [0, 3], [18, 21]];
const INTRO_PIECES = INTRO_PAIRS.flat();
const introBaseMask = stickeringMaskFn(3, 'F2LPair')!;
/** Each section solves one corner/edge, then rotates the next slot to FR. */
export const LBL_INTRO_ALG = [
  "(R U R' y)",
  "(F' U' F y)",
  "(R U R' y)",
  "(F' U' F y)",
  "(U R U' R' U' F' U F y)",
  "(U' F' U F U R U' R' y)",
  "(U R U' R' U' F' U F y)",
  "(U' F' U F U R U' R' y)",
].join(' ');
export const LBL_INTRO_BOUNDARIES = f2lPlaybackSections(LBL_INTRO_ALG).map(section => section.end);
const LBL_INTRO_PIECES = [...INTRO_PAIRS.map(([corner]) => corner), ...INTRO_PAIRS.map(([, edge]) => edge)];
export function lblIntroStickering(step: number): StickeringMaskFn {
  const stage = LBL_INTRO_BOUNDARIES.findIndex(end => step < end);
  return introStickeringForPieces(LBL_INTRO_PIECES.slice(0, stage < 0 ? LBL_INTRO_PIECES.length : stage + 1));
}
export function f2lIntroStickering(step: number): StickeringMaskFn {
  return introStickeringForPairs(Math.min(4, Math.floor(step / 4) + 1));
}
function introStickeringForPairs(count: number): StickeringMaskFn {
  return introStickeringForPieces(INTRO_PAIRS.slice(0, count).flat());
}
function introStickeringForPieces(pieces: readonly number[]): StickeringMaskFn {
  const visible = new Set(pieces);
  return (initial, face) => visible.has(initial) ? FM_REGULAR
    : INTRO_PIECES.includes(initial) ? FM_IGNORED : introBaseMask(initial, face);
}

/** The shifted case reaches the canonical picture after alignment, without inserting it. */
export function f2lAlignmentSetup(alg: string, alignment: string): string {
  return `${new Alg(alg).invert().expand()} ${new Alg(alignment).invert()}`;
}

/** Use the animation's exact piece mask for the existing SVG renderer too. */
export function f2lDiagramFacelets(setup: string, orientation: string, mask = stickeringMaskFn(3, 'F2LPair')!): string {
  const cube = new Cube(3);
  try {
    cube.twister.setup(setup);
    const masks = cube.serializeStickering(mask);
    const colors = orientedFaceColors(orientation);
    return [...cube.serialize()].map((face, index) => masks[index] === FM_REGULAR
      ? CUBE_COLOR_LETTER_FOR_FACE[colors[face as CubeFace]].toLowerCase() : 'd').join('');
  } finally { cube.dispose(); }
}

export function f2lGoalDiagrams(orientation: string): [string, string, string] {
  const cross = introStickeringForPairs(0);
  const corners = new Set(INTRO_PAIRS.map(([corner]) => corner));
  const bottomLayer: StickeringMaskFn = (initial, face) => corners.has(initial) ? FM_REGULAR : cross(initial, face);
  return [
    f2lDiagramFacelets('', orientation, cross),
    f2lDiagramFacelets('', orientation, bottomLayer),
    f2lDiagramFacelets('', orientation, introStickeringForPairs(4)),
  ];
}

/** Top-level parentheses are lesson sections. Nested groups/repeats retain their alg semantics. */
export function f2lPlaybackSections(alg: string) {
  const sections: { alg: string; start: number; end: number }[] = [];
  let loose: string[] = [];
  let end = 0;
  const append = (source: string) => {
    const count = resolveSimPreviewMoves('3x3', source).length;
    if (count) { sections.push({ alg: source, start: end, end: end + count }); end += count; }
  };
  const flush = () => { append(loose.join(' ')); loose = []; };
  for (const node of new Alg(alg).childAlgNodes()) {
    if (node instanceof Grouping) { flush(); append(node.toString()); }
    else loose.push(node.toString());
  }
  flush();
  return sections;
}
