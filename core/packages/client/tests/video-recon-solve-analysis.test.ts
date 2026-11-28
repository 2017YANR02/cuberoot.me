import { describe, expect, it } from 'vitest';
import { invertMoveString, toMoveStringStrict } from '@cuberoot/shared/alg-notation';
import { getCube3 } from '@cuberoot/shared/recon/cube3';
import { checkReconCompletion } from '@cuberoot/shared/recon-completion';
import { conjugateSequence, facePermFor } from '@cuberoot/shared/timer/reconstruct/gyro-orient';
import { decodeUrlAlg } from '@/lib/cubedb-url';
import { buildReconSubmitQuery } from '@/lib/sim-recon-link';
import { axisAngle, multiply, type CubePose, type Quaternion, type V3 } from '@/lib/video-recon/engine/cube-motion';
import { buildColorTimeline } from '@/lib/video-recon/engine/cube-colors';
import { CAMERA_ORIENTATION, CUBE_GRIP_ROTATIONS, initialGripMoves, openingGripView, relativeCubeGrip } from '@/lib/video-recon/engine/cube-orientation';
import type { MoveStep } from '@/lib/video-recon/engine/move-search-types';
import type { MeasuredCubeFrame } from '@/lib/video-recon/engine/projected-cube';
import { singleLayerCross, analyzeVideoSolve, matchVideoOpeningScramble, observeVideoSolve, playerGrip, videoGripOptions, videoNotationTimeline } from '@/lib/video-recon/solve-analysis';

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
  it('defaults to the earlier wide turn for the Deqing xcross and preserves the frame ranges', async () => {
    const scramble = "R2 U' B2 L F2 D F2 D F' D2 B L2 D2 B' U2 B U2 R";
    const cross = "R U' L' R' F R' U R B Rw' D";
    const beforeYaw = `${cross} L U' L' L' U' L U B U2' B' U`;
    const afterYaw = "F' L' U' L F U R' U' R F R' U R U' R' F' L F R F' L' U";
    const raw = [
      conjugateSequence(beforeYaw, facePermFor("x'")),
      conjugateSequence(afterYaw, facePermFor("y' x'")),
    ].join(' ');
    const steps = raw.split(' ').map((move, i) => commit(3 + 3 * i, move));
    const observation = observeVideoSolve(scramble, steps, [], fps, 0, 4.7);

    const analysis = (await analyzeVideoSolve(observation, 'x', 'en'))!;
    expect(analysis).toMatchObject({ solved: true, fallback: false, crossNotation: { preferred: 1, lineIndex: 0 } });
    const { result, crossNotation } = analysis;
    const [original, alternate] = crossNotation!.variants;
    expect(crossNotation?.variants).toHaveLength(2);
    const single = singleLayerCross(original)!.result;
    expect(single.lines[0].moves.every(move => /^[URFDLB](?:2'?|')?$/.test(move))).toBe(true);
    expect(single.lines[0].moveRanges?.map(range => range.ts)).toEqual(original.lines[0].moveRanges?.map(range => range.ts));
    expect(await checkReconCompletion({ event: '3x3', scramble, solution: single.text })).toEqual({ status: 'solved' });
    expect(result).toBe(alternate);
    expect(original.lines[0].moves.join(' ')).toBe(cross);
    expect(result.text).toContain("R U' r' R' D R' F R U L' D // Y xcross (RG)");
    expect(result.lines.slice(1)).toEqual(original.lines.slice(1));
    expect(videoNotationTimeline(result, 0).map(({ timestampMs }) => timestampMs))
      .toEqual(videoNotationTimeline(original, 0).map(({ timestampMs }) => timestampMs));
    expect(await checkReconCompletion({ event: '3x3', scramble, solution: result.text })).toEqual({ status: 'solved' });
  });

  it('chooses the yaw with fewer last-layer front and back turns and preserves manual orientation', async () => {
    const scramble = "R2 U' B2 L F2 D F2 D F' D2 B L2 D2 B' U2 B U2 R";
    const solve = [
      'x y',
      "F U' B' F' L F' U F R Fw' D",
      "B U' B'",
      "B' U' B",
      "U R U2' R' U y L' B' U' B L",
      "U F' U' F L F' U F U' F' L' B L F L' B' U",
    ].join(' ');
    const steps = toMoveStringStrict(solve).split(' ').map((move, i) => commit(3 + 3 * i, move));
    const grip = playerGrip('U', 'F')!;
    const observation = { ...observeVideoSolve(scramble, steps, [], fps, 0, 4.7), estimatedGrip: grip };
    const manual = (await analyzeVideoSolve(observation, grip.rotation, 'en'))!.result;
    const automatic = (await analyzeVideoSolve(observation, undefined, 'en'))!.result;
    const frontBack = (result: typeof manual) => result.lines.findLast(line => line.kind === 'oll' || line.kind === 'pll')!
      .moves.filter(move => /^[fb]/i.test(move)).length;

    expect(frontBack(automatic)).toBeLessThan(frontBack(manual));
    expect(manual.inspection).toBe(grip.rotation);
    expect(facePermFor(automatic.inspection).U).toBe('U');
    expect(await checkReconCompletion({ event: '3x3', scramble, solution: automatic.text })).toEqual({ status: 'solved' });
  });

  it.each([
    { token: 'x', vector: [-Math.PI / 2, 0, 0], scramble: 'U R', first: "R'", last: "U'", renamed: "B'" },
    { token: 'y', vector: [0, 0, -Math.PI / 2], scramble: 'R U', first: "U'", last: "R'", renamed: "F'" },
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

  it.each([
    { scramble: "U' R2", face: 'R', finish: 'U', vector: [Math.PI / 2, 0, 0],
      expected: [["x'", 367], ['R2', 800]] },
    { scramble: "R' U2", face: 'U', finish: 'R', vector: [0, 0, -Math.PI / 2],
      expected: [['U', 200], ['y', 367], ['U', 800]] },
  ])('formats repeated $face turns across a video regrip', async ({ scramble, face, finish, vector, expected }) => {
    const steps = [commit(6, face), commit(24, face), commit(28, finish)];
    const observation = observeVideoSolve(scramble, steps, frames(axisAngle(vector as V3)), fps, 0, 1.15);
    const analysis = (await analyzeVideoSolve(observation, playerGrip('U', 'F')!.rotation, 'en'))!;
    expect(analysis).toMatchObject({ solved: true, fallback: false });
    const result = analysis.result;
    const timeline = videoNotationTimeline(result, 0).map(({ offset, timestampMs }) =>
      [result.text.slice(0, offset).split(/\s+/).at(-1), timestampMs]);
    expect(timeline.slice(0, expected.length)).toEqual(expected);
    expect(await checkReconCompletion({ event: '3x3', scramble, solution: result.text })).toEqual({ status: 'solved' });
  });

  it('compacts x z followed by a leading x prime and retains the recorded seek times', async () => {
    const scramble = "U' F2";
    const steps = [commit(6, 'F'), commit(24, 'F'), commit(28, 'U')];
    const observation = observeVideoSolve(scramble, steps, frames(axisAngle([0, -Math.PI / 2, 0])), fps, 0, 1.15);
    const analysis = (await analyzeVideoSolve(observation, 'x z', 'en'))!;
    expect(analysis).toMatchObject({ solved: true, fallback: false });
    const { result } = analysis;
    expect(result.openingRotation).toBe('x z');
    expect(result.inspection).toBe("y'");
    expect(result.lines[0].moves[0]).toBe('R2');
    expect(result.text.split('\n')[0]).toBe("y' // insp");
    expect(videoNotationTimeline(result, 0).slice(0, 2)).toEqual([
      { offset: 2, timestampMs: 367 },
      { offset: result.text.indexOf('R2') + 2, timestampMs: 800 },
    ]);
    expect(await checkReconCompletion({ event: '3x3', scramble, solution: result.text })).toEqual({ status: 'solved' });
  });

  it('puts the yaw before the ZBLS formula and keeps the turn seek times', async () => {
    const afterYaw = "L' U2 L F U R U R' U R U2' R' U2";
    const raw = `R' U ${conjugateSequence(afterYaw, facePermFor("y'"))}`;
    const scramble = invertMoveString(raw);
    const steps = raw.split(' ').map((move, i) => commit(3 + 3 * i, move));
    const observation = observeVideoSolve(scramble, steps, [], fps, 0, 2);
    const analysis = (await analyzeVideoSolve({
      ...observation,
      core: {
        ...observation.core,
        events: [...observation.core.events, { token: 'y', tMs: 250, angleRad: Math.PI / 2, regripOnly: true }],
      },
    }, '', 'en'))!;
    expect(analysis).toMatchObject({ solved: true, fallback: false });
    const { result } = analysis;
    const zb = result.lines.find(line => line.label?.includes('ZBLS'));
    const formula = zb?.moves.join(' ');
    expect(formula).toBe("y F' U L' U2 L F");
    const initial = (await getCube3()).defaultPattern().applyAlg(scramble);
    expect(initial.applyAlg(formula!).isIdentical(initial.applyAlg("R' U y L' U2 L F"))).toBe(true);
    expect(zb?.moveRanges?.map(({ endTs }) => endTs)).toEqual([100, 100, 200, 300, 400, 500, 600]);
    expect(result.rotations).toMatchObject([{ token: 'y', tMs: 250 }]);
    expect(await checkReconCompletion({ event: '3x3', scramble, solution: result.text })).toEqual({ status: 'solved' });
  });

  it.each([
    { description: 'absorbs a fast z rotation into a face and slice', lastHalfFrame: 13,
      expected: ["FS'", 'U', 'L'] },
    { description: 'carries an isolated z rotation through later stages', lastHalfFrame: 21,
      expected: ["B'", 'F2', 'R', 'U'] },
  ])('$description', async ({ lastHalfFrame, expected }) => {
    const steps = [commit(11, "B'"), commit(12, 'F'), commit(lastHalfFrame, 'F'), commit(24, 'R'), commit(28, 'U')];
    const observation = observeVideoSolve("U' R' F2 B", steps, frames(axisAngle([0, -Math.PI / 2, 0])), fps, 0, 1.15);
    expect(observation.core.events).toMatchObject([{ token: "z'", tMs: 367 }]);
    const analysis = await analyzeVideoSolve(observation, playerGrip('U', 'F')!.rotation, 'en');
    expect(analysis).toMatchObject({ solved: true, fallback: false });
    const result = analysis!.result;
    expect(result.lines.flatMap(line => line.moves)).toEqual(expected);
    expect(result.rotations).toEqual([]);
    expect(await checkReconCompletion({ event: '3x3', scramble: result.scramble, solution: result.text }))
      .toEqual({ status: 'solved' });
    if (lastHalfFrame === 13) {
      expect(result.lines[0].moveRanges?.[0]).toEqual({ token: "FS'", ts: 367, endTs: 433, startIdx: 0, endIdx: 2 });
      expect(videoNotationTimeline(result, 0).slice(0, 2)).toEqual([
        { offset: 1, timestampMs: 433 },
        { offset: 3, timestampMs: 433 },
      ]);
    }
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
