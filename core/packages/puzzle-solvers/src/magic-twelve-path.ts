import type { MagicPose } from './magic-eight-path'

/**
 * The original-stringing Master Magic, following Stefan Pochmann's solution.
 *
 * Source: Jaap Scherphuis, "Master Edition", Solution 4, and its fold diagrams:
 * https://www.jaapsch.net/puzzles/magicmast.htm
 * https://www.jaapsch.net/puzzles/images/magic/mastsol4.gif
 * The two six-flip sections use the shape-changing transform described at:
 * https://www.jaapsch.net/puzzles/magictrn.htm#transhape
 *
 * This is a specific, reversible construction, not a free-folding simulator.
 * Tiles have unit sides and ideal zero thickness. IDs are fixed: 0..5 along
 * the original top row, then 6..11 right-to-left along the bottom row.
 * Local front/right/up are the printed front, right and top at the start.
 * In this original stringing, the used front grooves are / on source-numbered
 * odd tiles and \\ on even tiles. At the end every front normal is -Z, so the
 * solved, unlinked-ring reverse face is already visible from +Z.
 *
 * All folds below use fixed world axes at a flat stage boundary. The one
 * four-bar motion (source step e1) has two rotating arms and a rigid bridge;
 * its translation is derived from those arms, not from interpolated targets.
 */
type Vec3 = readonly [number, number, number]
type Fold = {
    kind: 'fold'
    /** Source diagram numbers are 1-based, converted when applying the fold. */
    tiles: readonly number[]
    axis: 'x' | 'y'
    pivot: number
    sign: 1 | -1
}
type Phase = Fold | { kind: 'bridge' }

const PHASES: readonly Phase[] = [
    // b: right six-flip, tracking tile 7: left, up, left, down, right, down.
    { kind: 'fold', tiles: [6, 7], axis: 'y', pivot: 4.5, sign: -1 },
    { kind: 'fold', tiles: [7], axis: 'x', pivot: 0.5, sign: -1 },
    { kind: 'fold', tiles: [7, 8], axis: 'y', pivot: 3.5, sign: -1 },
    { kind: 'fold', tiles: [6, 7], axis: 'x', pivot: 0.5, sign: 1 },
    { kind: 'fold', tiles: [7], axis: 'y', pivot: 3.5, sign: 1 },
    { kind: 'fold', tiles: [7, 8], axis: 'x', pivot: -0.5, sign: 1 },
    // c1-c2: fold the left end in, then tile 1 down onto tile 12.
    { kind: 'fold', tiles: [1, 12], axis: 'y', pivot: 0.5, sign: 1 },
    { kind: 'fold', tiles: [1], axis: 'x', pivot: 0.5, sign: 1 },
    // d: turn the whole puzzle over, away from the viewer.
    { kind: 'fold', tiles: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], axis: 'x', pivot: 0, sign: 1 },
    // e1: move 8/9 right, unrolling 12/11/10 through the pictured arch.
    { kind: 'bridge' },
    // e2-e8: the numbered folds from the source.
    { kind: 'fold', tiles: [1, 12, 11, 10], axis: 'x', pivot: -0.5, sign: 1 },
    { kind: 'fold', tiles: [8, 9, 10], axis: 'y', pivot: 3.5, sign: -1 },
    { kind: 'fold', tiles: [1, 12, 11, 10], axis: 'x', pivot: -0.5, sign: -1 },
    { kind: 'fold', tiles: [8, 9], axis: 'y', pivot: 3.5, sign: -1 },
    { kind: 'fold', tiles: [9, 10], axis: 'x', pivot: 0.5, sign: 1 },
    { kind: 'fold', tiles: [7], axis: 'x', pivot: 0.5, sign: 1 },
    { kind: 'fold', tiles: [7, 8], axis: 'y', pivot: 4.5, sign: 1 },
    // f: the left six-flip, tracking tile 2: right, up, right, down, left, down.
    { kind: 'fold', tiles: [1, 2], axis: 'y', pivot: 1.5, sign: 1 },
    { kind: 'fold', tiles: [2], axis: 'x', pivot: -0.5, sign: -1 },
    { kind: 'fold', tiles: [2, 3], axis: 'y', pivot: 2.5, sign: 1 },
    { kind: 'fold', tiles: [1, 2], axis: 'x', pivot: -0.5, sign: 1 },
    { kind: 'fold', tiles: [2], axis: 'y', pivot: 2.5, sign: -1 },
    { kind: 'fold', tiles: [2, 3], axis: 'x', pivot: -1.5, sign: 1 },
]

export const MAGIC_TWELVE_STEPS: number = PHASES.length

// Signed half-thickness coefficients, along each tile's own front normal.
// At each flat boundary, track the source folds' bottom-to-top stack order:
// a turned stack reverses, and a newly landing group enters on its approach
// side. Recenter each stack around z=0. In particular c2 gives [11,12,1],
// d reverses it to [1,12,11], and e1 closes the arch as [6,9,10]. The e4
// fold reverses the lifted pair [11,10] to [10,11] above tile 9.
// These are presentation offsets, not corrections to the ideal hinge model.
const LAYER_BOUNDARIES: readonly (readonly number[])[] = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, -1, -1, -1, -1, 0, 0, 0, 0],
    [0, 0, 0, 0, -2, 0, 2, 0, 0, 0, 0, 0],
    [0, 0, 0, -1, -1, -1, -1, -1, -1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 2, 0, -2, 0, 0, 0],
    [0, 0, 0, 0, 0, -1, -1, -1, -1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [-1, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1, -1],
    [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, -2, 0],
    [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, -2, 0],
    [0, 0, 0, 0, 0, 2, 1, 1, 0, -2, 0, 0],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 2, 0, 0, 0, 0, 0, -2, 0, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 2, 0, -2, 0],
    [0, 0, 0, 0, 0, -1, -1, -1, -1, -1, -1, 0],
    [0, 0, 0, 0, 0, 0, -2, 0, 2, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [0, -2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
    [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1],
    [0, -2, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
]

function rotate(v: Vec3, axis: 'x' | 'y', angle: number): Vec3 {
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    return axis === 'x'
        ? [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]]
        : [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]
}

function rotatePose(pose: MagicPose, axis: 'x' | 'y', pivot: number, angle: number): MagicPose {
    const origin: Vec3 = axis === 'x' ? [0, pivot, 0] : [pivot, 0, 0]
    const relative: Vec3 = [
        pose.position[0] - origin[0],
        pose.position[1] - origin[1],
        pose.position[2] - origin[2],
    ]
    const position = rotate(relative, axis, angle)
    return {
        position: [position[0] + origin[0], position[1] + origin[1], position[2] + origin[2]],
        right: rotate(pose.right, axis, angle),
        up: rotate(pose.up, axis, angle),
        normal: rotate(pose.normal, axis, angle),
    }
}

function applyPhase(poses: MagicPose[], phase: Phase, fraction: number): void {
    const angle = fraction * Math.PI
    if (phase.kind === 'fold') {
        for (const tile of phase.tiles) {
            poses[tile - 1] = rotatePose(poses[tile - 1]!, phase.axis, phase.pivot, phase.sign * angle)
        }
        return
    }

    // The arch's fixed, parallel hinges lie at x=1.5 and x=3.5. The left arm
    // is tile 12, the right arm is 9 (with 8 attached). Tiles 11 and 10 form
    // the two-unit bridge between their free edges. Both arms rotate by θ:
    // their free edges move by (1-cos θ, 0, sin θ), which fixes the bridge's
    // position throughout the motion and keeps all twelve cyclic seams shut.
    poses[11] = rotatePose(poses[11]!, 'y', 1.5, angle)
    poses[8] = rotatePose(poses[8]!, 'y', 3.5, angle)
    poses[7] = rotatePose(poses[7]!, 'y', 3.5, angle)
    const dx = 1 - Math.cos(angle)
    const dz = Math.sin(angle)
    for (const tile of [10, 11]) {
        const pose = poses[tile - 1]!
        poses[tile - 1] = {
            ...pose,
            position: [pose.position[0] + dx, pose.position[1], pose.position[2] + dz],
        }
    }
}

function requireProgress(progress: number): void {
    if (!Number.isFinite(progress) || progress < 0 || progress > MAGIC_TWELVE_STEPS) {
        throw new RangeError('Master Magic progress must be finite and in [0, 23]')
    }
}

/** Fractional progress 0..23, with one continuous physical fold per interval. */
export function magicTwelvePoses(progress: number): MagicPose[] {
    requireProgress(progress)
    const poses: MagicPose[] = Array.from({ length: 12 }, (_, id) => ({
        position: [id < 6 ? id : 11 - id, id < 6 ? 1 : 0, 0],
        right: [1, 0, 0],
        up: [0, 1, 0],
        normal: [0, 0, 1],
    }))
    const completed = Math.floor(progress)
    for (let step = 0; step < completed; step++) applyPhase(poses, PHASES[step]!, 1)
    if (completed < MAGIC_TWELVE_STEPS) applyPhase(poses, PHASES[completed]!, progress - completed)
    // A fixed translation centers the original rectangle without altering any
    // fold, local orientation, or the chain's closure.
    return poses.map(pose => ({
        ...pose,
        position: [pose.position[0] - 2.5, pose.position[1] - 0.5, pose.position[2]],
    }))
}

/**
 * Visual layer offsets for the same progress as magicTwelvePoses().
 * Render center = ideal position + frontNormal * halfThickness * coefficient.
 * Keep using the unmodified ideal poses to evaluate mechanical constraints.
 */
export function magicTwelveLayerOffsets(progress: number): number[] {
    requireProgress(progress)
    if (progress === MAGIC_TWELVE_STEPS) return Array.from(LAYER_BOUNDARIES[MAGIC_TWELVE_STEPS]!)
    const boundary = Math.floor(progress)
    const fraction = progress - boundary
    const from = LAYER_BOUNDARIES[boundary]!
    const to = LAYER_BOUNDARIES[boundary + 1]!
    return from.map((value, tile) => value + (to[tile]! - value) * fraction)
}
