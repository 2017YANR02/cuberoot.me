/**
 * An ideal rigid-panel reconstruction of Maurizio Paolini's eight-panel Magic
 * solution path, independently evaluated with edge rotations below.
 *
 * References (geometric path parameters, not imported program code):
 * https://dmf.unicatt.it/rubiksmagic/rubiksmagic.pdf (panel orientation/hinges)
 * https://svn.dmf.unicatt.it/svn/projects/rubiksmagic/trunk/povray/animations/solve.pov
 *
 * This is one reversible, closed folding path. It does not solve arbitrary
 * string constraints or accept arbitrary hinge moves. Panels have zero physical
 * thickness here; coincident panels at a fold are intentional. A renderer may
 * represent their thickness separately, without changing the path parameters.
 */

type Vector = readonly [number, number, number];

/** Unit-square panel, with local front in XY and outward front normal +Z. */
export type MagicPose = {
  position: Vector;
  right: Vector;
  up: Vector;
  normal: Vector;
};

export const MAGIC_EIGHT_STEPS: number = 12;

const FOLDING_STEPS = 11;

type AngleRange = readonly [number, number];
type Phase = { edges: string; angles: readonly AngleRange[] };

// Angles are fractions of a half turn. All changing hinges in a phase share
// one parameter: moving them independently would break the cyclic closure.
const FLAT: AngleRange = [0, 0];
const FOLD_NEGATIVE: AngleRange = [0, -1];
const OPEN_NEGATIVE: AngleRange = [-1, 0];
const FOLD_POSITIVE: AngleRange = [0, 1];
const OPEN_POSITIVE: AngleRange = [1, 0];
const FOLDED: AngleRange = [1, 1];

// Seven relative poses determine the eight panels. The closing T7--T0 hinge
// is also continuous: U 0→-1, R -1→0, R 0, R 0→-1, U -1→0, then U 0.
// A change of edge between phases occurs only with those panels fully stacked.
const PHASES: readonly Phase[] = [
  { edges: 'RRRURRR', angles: [FLAT, FLAT, FLAT, FOLD_NEGATIVE, FLAT, FLAT, FLAT] },
  { edges: 'RRRRRRR', angles: [FLAT, FLAT, FOLD_NEGATIVE, OPEN_NEGATIVE, FLAT, FLAT, FOLD_NEGATIVE] },
  { edges: 'RRDRRRD', angles: [FLAT, FLAT, OPEN_NEGATIVE, FLAT, FLAT, FLAT, OPEN_NEGATIVE] },
  { edges: 'RRDRRRD', angles: [FLAT, FOLD_NEGATIVE, FLAT, FOLD_NEGATIVE, FLAT, FOLD_NEGATIVE, FLAT] },
  { edges: 'RUDURUD', angles: [FLAT, OPEN_NEGATIVE, FLAT, OPEN_NEGATIVE, FLAT, OPEN_NEGATIVE, FLAT] },
  { edges: 'RUDURUD', angles: [FLAT, FLAT, FLAT, FOLD_POSITIVE, FLAT, FOLD_POSITIVE, FLAT] },
  { edges: 'RUDLRUD', angles: [FLAT, FLAT, FLAT, OPEN_POSITIVE, FOLD_NEGATIVE, FOLDED, FLAT] },
  { edges: 'RUDLDLD', angles: [FLAT, FLAT, FOLD_POSITIVE, FLAT, OPEN_NEGATIVE, FOLDED, FLAT] },
  { edges: 'RUDLDLD', angles: [FLAT, FLAT, FOLDED, FOLD_NEGATIVE, FLAT, OPEN_POSITIVE, FLAT] },
  { edges: 'RUDDDLD', angles: [FLAT, FLAT, FOLDED, OPEN_NEGATIVE, FOLD_POSITIVE, FLAT, FLAT] },
  { edges: 'RULDLLD', angles: [FLAT, FLAT, OPEN_POSITIVE, FLAT, OPEN_POSITIVE, FLAT, FLAT] },
];

// Render-only stack order at the same eleven folding phase boundaries. Values
// are signed multiples of half a panel thickness along that panel's front
// normal. These geometric layer placements follow the referenced animation;
// interpolating them separates stacked panels while preserving continuity.
const LEVEL: readonly number[] = [0, 0, 0, 0, 0, 0, 0, 0];
const UNDER: readonly number[] = [-1, -1, -1, -1, -1, -1, -1, -1];
const OVER: readonly number[] = [1, 1, 1, 1, 1, 1, 1, 1];
const LAYER_BOUNDARIES: readonly (readonly number[])[] = [
  LEVEL, UNDER, UNDER, LEVEL, UNDER, LEVEL, OVER,
  [0, 0, -1, -2, -2, 0, 2, 1],
  OVER,
  [1, 2, 2, 0, -2, -2, -1, 0],
  OVER, LEVEL,
];

function combine(a: Vector, b: Vector, aScale: number, bScale: number): Vector {
  return [a[0] * aScale + b[0] * bScale, a[1] * aScale + b[1] * bScale, a[2] * aScale + b[2] * bScale];
}

function nextPanel(parent: MagicPose, edge: string, angle: number): MagicPose {
  const c = Math.cos(angle), s = Math.sin(angle);
  const { right: r, up: u, normal: n } = parent;
  let right: Vector, up: Vector, normal: Vector, displacement: Vector;
  if (edge === 'R' || edge === 'L') {
    const sign = edge === 'R' ? 1 : -1;
    right = combine(r, n, c, -sign * s);
    up = u;
    normal = combine(r, n, sign * s, c);
    displacement = combine(r, right, sign / 2, sign / 2);
  } else {
    const sign = edge === 'U' ? 1 : -1;
    right = [-r[0], -r[1], -r[2]];
    up = combine(u, n, -c, sign * s);
    normal = combine(u, n, sign * s, c);
    displacement = combine(u, up, sign / 2, -sign / 2);
  }
  return { position: combine(parent.position, displacement, 1, 1), right, up, normal };
}

function turnOver(pose: MagicPose, angle: number): MagicPose {
  const c = Math.cos(angle), s = Math.sin(angle);
  const rotate = ([x, y, z]: Vector): Vector => [x, c * y - s * z, s * y + c * z];
  // Regrip the completed 3×3 outline around its centre. The X-axis half turn
  // exposes the back artwork and puts the missing square at the upper right.
  const centre: Vector = [1, 1, 0];
  return {
    position: combine(centre, rotate(combine(pose.position, centre, 1, -1)), 1, 1),
    right: rotate(pose.right),
    up: rotate(pose.up),
    normal: rotate(pose.normal),
  };
}

function requireProgress(progress: number): void {
  if (!Number.isFinite(progress) || progress < 0 || progress > MAGIC_EIGHT_STEPS) {
    throw new RangeError('Magic eight-panel progress must be finite and in [0, 12]');
  }
}

/**
 * Evaluate progress in [0, 12]; integer values are stable step boundaries.
 * T0 is fixed at the origin. Initially T0..T3 form the bottom row left to
 * right, and T4..T7 form the top row right to left. After eleven folding
 * steps, step twelve turns over the complete assembly so the linked back
 * artwork faces the initial viewer (+Z). Only this regrip moves T0.
 * Decreasing progress retraces exactly the same path without mutable state.
 */
export function magicEightPoses(progress: number): MagicPose[] {
  requireProgress(progress);
  const phaseIndex = Math.min(Math.floor(progress), FOLDING_STEPS - 1);
  const t = Math.min(progress, FOLDING_STEPS) - phaseIndex;
  const phase = PHASES[phaseIndex];
  const poses: MagicPose[] = [{ position: [0, 0, 0], right: [1, 0, 0], up: [0, 1, 0], normal: [0, 0, 1] }];
  for (let joint = 0; joint < phase.edges.length; joint++) {
    const [from, to] = phase.angles[joint];
    poses.push(nextPanel(poses[joint], phase.edges[joint], Math.PI * (from + (to - from) * t)));
  }
  return progress > FOLDING_STEPS
    ? poses.map(pose => turnOver(pose, Math.PI * (progress - FOLDING_STEPS)))
    : poses;
}

/**
 * Visual stack coefficients for the same progress as magicEightPoses().
 * Render centre = ideal position + normal * halfThickness * coefficient.
 * This is finite-thickness presentation only: retain the ideal poses for
 * mechanical constraints, since these offsets can slightly separate hinges.
 */
export function magicEightLayerOffsets(progress: number): number[] {
  requireProgress(progress);
  if (progress >= FOLDING_STEPS) return Array.from(LEVEL);
  const index = Math.floor(progress), t = progress - index;
  const from = LAYER_BOUNDARIES[index], to = LAYER_BOUNDARIES[index + 1];
  return from.map((value, tile) => value + (to[tile] - value) * t);
}
