import { Alg } from 'cubing/alg';

const right = "U R U' R' U' F' U F";
const left = "U' L' U L U F U' F'";
// Fixed choreography: a bottom-color-up first corner and two swapped bottom corners, left/right insertions,
// and a middle edge that needs extraction before reinsertion.
const parts = [
  "R U2 R' U' R U R'", "U R U R'", "R' U' R U2 R U R'", "U F' U F",
  `U2 R U' R' U' F' U F`, left, `${right} U2 ${right}`, `${right}`,
];
// The cube stays in a fixed frame. Remap local teaching moves to that frame;
// the player orbits to these headings without adding whole-cube moves.
const headings = [0, 1, 2, 3, 4, 6, 6, 7];
const sides = 'FRBL';
let end = 0;
const targets = [
  ['D2', 'F8', 'R6'], ['D8', 'R8', 'B6'], ['D6', 'B8', 'L6'], ['D0', 'L8', 'F6'],
  ['F5', 'R3'], ['R5', 'B3'], ['B5', 'L3'], ['L5', 'F3'],
];
export const LBL_INTRO_SEGMENTS = parts.map((alg, index) => {
  const heading = headings[index];
  const fixedAlg = new Alg(alg).expand().toString().split(/\s+/).map(move => {
    const side = sides.indexOf(move[0]);
    return side < 0 ? move : sides[(side + heading) % 4] + move.slice(1);
  }).join(' ');
  const start = end;
  end += fixedAlg.split(/\s+/).length;
  return { alg: fixedAlg, start, end, yaw: -heading * Math.PI / 2, stickers: targets[index] };
});
export const LBL_INTRO_VIDEO_ALG = LBL_INTRO_SEGMENTS.map(segment => segment.alg).join(' ');
export const LBL_INTRO_VIDEO_SETUP = new Alg(LBL_INTRO_VIDEO_ALG).invert().toString();
// Same starting state, solved pair by pair. Frozen from the tutorial catalog,
// with extraction where the target corner occupies another slot.
const pairParts = [
  "F' U2 F U F' U' F",
  "U B U2 B' U' B U B'",
  "F U F' U' L U' L' U B' U' B",
  "U F U' F2 L F L' F U' F'",
];
let pairEnd = 0;
export const F2L_INTRO_SEGMENTS = pairParts.map((alg, index) => {
  const start = pairEnd;
  pairEnd += alg.split(/\s+/).length;
  return { alg, start, end: pairEnd, yaw: -index * Math.PI / 2, stickers: [...targets[index], ...targets[index + 4]] };
});
export const F2L_INTRO_VIDEO_ALG = pairParts.join(' ');
export const LBL_INTRO_CORNER_STICKERS = [0, 2, 6, 8].map(i => `D${i}`).concat([...'FRBL'].flatMap(f => [6, 8].map(i => `${f}${i}`)));
export const LBL_INTRO_EDGE_STICKERS = [...'FRBL'].flatMap(f => [3, 5].map(i => `${f}${i}`));
