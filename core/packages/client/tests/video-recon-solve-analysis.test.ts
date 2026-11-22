import { describe, expect, it } from 'vitest';
import { checkReconCompletion } from '@cuberoot/shared/recon-completion';
import { facePermFor } from '@cuberoot/shared/timer/reconstruct/gyro-orient';
import { decodeUrlAlg } from '@/lib/cubedb-url';
import { buildReconSubmitQuery } from '@/lib/sim-recon-link';
import { axisAngle, multiply, type CubePose, type Quaternion, type V3 } from '@/lib/video-recon/engine/cube-motion';
import { buildColorTimeline } from '@/lib/video-recon/engine/cube-colors';
import { CAMERA_ORIENTATION, CUBE_GRIP_ROTATIONS, initialGripMoves, openingGripView, relativeCubeGrip } from '@/lib/video-recon/engine/cube-orientation';
import type { MoveStep } from '@/lib/video-recon/engine/move-search-types';
import type { MeasuredCubeFrame } from '@/lib/video-recon/engine/projected-cube';
import { analyzeVideoSolve, matchVideoOpeningScramble, observeVideoSolve, playerGrip, videoGripOptions, videoNotationTimeline } from '@/lib/video-recon/solve-analysis';

const fps = 30;
const identity: Quaternion = [0, 0, 0, 1];
const state: CubePose['state'] = { colors: [], stickers: [], moves: [] };
const frames = (rotation: Quaternion): MeasuredCubeFrame[] => Array.from({ length: 35 }, (_, frame) => ({
  frame,
  timestamp: frame / fps,
  pose: { rotation: frame < 11 ? identity : rotation, axis: 0, angles: [0, 0, 0], state },
}));
const commit = (frame_index: number, ...state_moves: string[]): MoveStep => ({
  frame_index, state_moves, geometry_option_index: 0,
});

describe('video solve reconstruction', () => {
  it.each([
    { token: 'x', vector: [-Math.PI / 2, 0, 0], scramble: 'U R', first: "R'", last: "U'", renamed: "B'" },
    { token: 'y', vector: [0, 0, -Math.PI / 2], scramble: 'R U', first: "U'", last: "R'", renamed: "F'" },
    { token: 'z', vector: [0, Math.PI / 2, 0], scramble: 'U R', first: "R'", last: "U'", renamed: "R'" },
  ])('preserves the physical $token and writes the following turn in the solver’s frame', async ({
    token, vector, scramble, first, last, renamed,
  }) => {
    const steps = [commit(6, first), commit(24, last)];
    const observation = observeVideoSolve(scramble, steps, frames(axisAngle(vector as V3)), fps, 0, 1.15);
    expect(observation.core.events).toMatchObject([{ token, tMs: 367, regripOnly: true }]);
    const analysis = await analyzeVideoSolve(observation, playerGrip('U', 'F')!.rotation, 'en');
    expect(analysis).toMatchObject({ solved: true, fallback: false });
    expect(analysis?.result.lines.flatMap(line => line.moves)).toEqual([first, token, renamed]);
    const result = analysis!.result;
    const query = new URLSearchParams(buildReconSubmitQuery('3x3', result.scramble, result.text, { method: 'CFOP' }));
    expect(decodeUrlAlg(query.get('alg')!)).toBe(result.text);
    expect(decodeUrlAlg(query.get('scramble')!)).toBe(scramble);
  });

  it('preserves the timing of a same-frame move batch and marks a pose gap', async () => {
    const rows = frames(identity).filter(row => row.frame <= 4 || row.frame >= 16);
    const observation = observeVideoSolve('R U', [commit(16, "U'", "R'")], rows, fps, 0, 1);
    expect(observation.moves).toEqual([{ m: "U'", ts: 533 }, { m: "R'", ts: 533 }]);
    expect(observation.uncertain).toEqual([{ startMs: 133, endMs: 533 }]);
    expect(observation.core.events).toHaveLength(0);
    const analysis = await analyzeVideoSolve(observation, playerGrip('U', 'R')!.rotation, 'zh');
    expect(analysis).toMatchObject({ method: 'cfop', solved: true, fallback: false });
    expect(analysis?.result.inspection).toBe('y');
    expect(analysis?.result.lines.flatMap(line => line.moves)).toEqual(["U'", "F'"]);
    expect(analysis?.result.text).not.toContain('(0.000)');
    const text = analysis!.result.text;
    expect(videoNotationTimeline(analysis!.result, 0).map(({ offset, timestampMs }) => [text.slice(0, offset).split(/\s+/).at(-1), timestampMs]))
      .toEqual([['y', 0], ["U'", 533], ["F'", 533]]);
  });

  it('converts the 6.98 opening grip with a half-turn around the solver’s up axis', () => {
    const camera = playerGrip('F', 'D')!;
    const solver = playerGrip('F', 'U')!;
    expect(facePermFor(solver.rotation)).toEqual(facePermFor(`${camera.rotation} y2`));
    expect(facePermFor(solver.rotation)).toEqual(facePermFor("x' z2"));
  });

  it('keeps the 6.98 physical opening when compacting its inferred scramble for the written solve', async () => {
    const recognized = "y Uw' D' D' B' D D B D B' D B B D' B' D Fw L L B' L E' E B' L B L L U L E B L B' E' Dw' L B L' B U B U' B F' F' L' L' U R' D D'";
    const compact = "U' R2 U' L2 F2 D' F2 D2 U' F2 L2 U B F D L B2 F R' B' U'";
    const solution = [
      'x2 z // insp',
      "D L' U2 x D2 // W cross (0.800)",
      "U' L U' L' d' R U' R' // GR (1.200)",
      "f B F' L U' L' S' U' B' // GO (1.100)",
      "U2' L' U' L // RB (0.800)",
      "U' L U2' L' U' L U L' // OB/ZBLS (0.766)",
      "L' U' L U' L' U2' L (U U U) // COLL-S-/PLL Skip (1.734)",
    ].join('\n');
    const colors = buildColorTimeline(recognized, []).initial;
    expect(await checkReconCompletion({ event: '3x3', scramble: compact, solution })).toEqual({ status: 'solved' });
    expect(buildColorTimeline(compact, []).initial).not.toEqual(colors);

    const scramble = await matchVideoOpeningScramble(recognized, compact);
    expect(scramble.endsWith(compact)).toBe(true);
    expect(buildColorTimeline(scramble, []).initial).toEqual(colors);
    expect(await checkReconCompletion({ event: '3x3', scramble, solution })).toEqual({ status: 'solved' });
  });

  it('retains the recognized scramble when rotations cannot match the compact candidate', async () => {
    expect(await matchVideoOpeningScramble("x' R U", 'R F')).toBe("x' R U");
  });

  it('uses the camera millisecond clock while keeping the actual frame interval for analysis', () => {
    const rows = [4600, 4980, 5900].map(frame => ({
      frame, timestamp: frame / 1000,
      pose: { rotation: identity, axis: 0, angles: [0, 0, 0], state } satisfies CubePose,
    }));
    const observation = observeVideoSolve('R', [commit(5333, "R'")], rows, 30, 5, 6, 1000);
    expect(observation.opening?.frame).toBe(4980);
    expect(observation.moves).toEqual([{ m: "R'", ts: 333 }]);
    expect(observation.frameMs).toBeCloseTo(1000 / 30);
    expect(observation.timeMs).toBe(1000);
  });

  it('maps the timer picker’s color pair to the actual center faces after a scramble rotation', () => {
    const observation = observeVideoSolve('y2 R U', [], frames(identity), fps, 0, 1.1);
    const options = videoGripOptions(observation.centers);
    expect(options).toHaveLength(24);
    expect(options.find(option => option.value === 'y2')?.grip).toEqual(playerGrip('U', 'F'));
    expect(options.find(option => option.value === '')?.grip).toEqual(playerGrip('U', 'B'));
  });

  it('displays the selected opening grip while preserving later measured rotations', () => {
    const rounded = axisAngle([0.16, -0.28, 0.12]);
    const opening = { ...frames(identity)[0], pose: { ...frames(identity)[0].pose, rotation: rounded } };
    const next = multiply(rounded, axisAngle([0, 0, Math.PI / 2]));
    for (const grip of CUBE_GRIP_ROTATIONS) {
      const view = openingGripView(rounded, grip);
      expect(initialGripMoves([opening], view).join(' ')).toBe(grip);
      expect(relativeCubeGrip(multiply(view, rounded), multiply(view, next)).moves)
        .toEqual(relativeCubeGrip(rounded, next).moves);
    }
    expect(openingGripView(rounded, initialGripMoves([opening], CAMERA_ORIENTATION).join(' '))).toBe(CAMERA_ORIENTATION);
  });
});
