import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { SmartCubeAttemptProducer } from '@cuberoot/shared/timer/smart-cube-attempt';
import { decodeGyroTrack } from '@cuberoot/shared/smart-cube/gyro-track';
import { initialPoseRotation, facePermFor, normalizeSolve } from '@cuberoot/shared/timer/reconstruct/gyro-orient';
import { buildCoreTrack, conjugateCoreTrack, coreTrackPoseAt } from '@cuberoot/shared/timer/reconstruct/core-track';
import { humanizeStream } from '@cuberoot/shared/timer/reconstruct/humanize';
import { quarterMoves } from '@cuberoot/shared/timer/reconstruct/htm';
import { buildReconText } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { computeStageSegments } from '@cuberoot/shared/timer/reconstruct/stage-segments';
import { applyScramble } from '@/app/[lang]/timer/_lib/cube/state';
import { applyOneToken } from '@/app/[lang]/timer/_lib/cube/apply_token';
import { SENSOR_BASES } from '@cuberoot/shared/smart-cube/orientation';

const pose = (axis: 'x' | 'y' | 'z', angle: number) => new Quaternion().setFromAxisAngle(
  new Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0), angle,
);
const raw = (q: Quaternion) => ({ w: q.w, x: q.x, y: q.y, z: q.z });
const notationPose = (alg: string) => alg.split(/\s+/).filter(Boolean).reduce((q, t) =>
  q.premultiply(pose(t[0] as 'x' | 'y' | 'z', -Math.PI / 2 * (t.includes('2') ? 2 : t.endsWith("'") ? -1 : 1))), new Quaternion());
const grips = [...new Map(['', ...['x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2'].flatMap(a =>
  ['', 'x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2'].map(b => `${a} ${b}`.trim()))]
  .map(alg => [JSON.stringify(facePermFor(alg)), alg])).values()];
const directions = { R: new Vector3(1, 0, 0), L: new Vector3(-1, 0, 0), U: new Vector3(0, 1, 0),
  D: new Vector3(0, -1, 0), F: new Vector3(0, 0, 1), B: new Vector3(0, 0, -1) };
const faceAt = (face: keyof typeof directions, q: Quaternion) => Object.entries(directions)
  .sort(([, a], [, b]) => b.dot(directions[face].clone().applyQuaternion(q)) - a.dot(directions[face].clone().applyQuaternion(q)))[0][0];

describe('scramble-relative reconstruction', () => {
  it('pins the replay reference at start even if a later calibration mutates the host snapshot', () => {
    const reference = raw(new Quaternion());
    const initial = raw(notationPose('y'));
    const producer = new SmartCubeAttemptProducer();
    producer.begin(0, { model: 'qiyi', name: 'test' }, { reference, initial });
    Object.assign(reference, raw(notationPose('x')));
    producer.recordMove('R', 0);
    producer.recordGyro(initial, 100);
    const samples = decodeGyroTrack(producer.finish().gyro);
    expect(facePermFor(initialPoseRotation(samples)!)).toEqual(facePermFor('y'));
    expect(buildCoreTrack(samples, { brand: 'qiyi' })?.events).toEqual([]);
  });

  it.each(['', 'z2'])('captures the starting grip in training frame %s without recording inspection detours', orientation => {
    const baseline = pose('z', 0.37).multiply(pose('x', 0.52));
    const start = baseline.clone().multiply(pose('y', -Math.PI / 2));
    const producer = new SmartCubeAttemptProducer();
    producer.begin(10_000, { model: 'qiyi', name: 'test' }, {
      reference: raw(baseline), initial: raw(start), orientation,
    });
    producer.recordMove('R', 10_000);
    const samples = decodeGyroTrack(producer.finish().gyro);
    expect(samples[0]?.tMs).toBe(0);
    expect(samples[0]?.frame).toBe('scramble');
    expect(facePermFor(initialPoseRotation(samples, 'qiyi')!)).toEqual(facePermFor(`y ${orientation}`));
    expect(buildCoreTrack(samples, { brand: 'qiyi' })?.events).toEqual([]);
  });

  it.each(['x', 'y', 'z'] as const)('recognizes real clockwise %s after an initial y grip', axis => {
    const baseline = pose('z', 0.37);
    const start = baseline.clone().multiply(pose('y', -Math.PI / 2));
    const producer = new SmartCubeAttemptProducer();
    producer.begin(1000, { model: 'qiyi', name: 'test' }, { reference: raw(baseline), initial: raw(start) });
    producer.recordMove('R', 1000);
    producer.recordGyro(raw(start.clone().multiply(pose(axis, -Math.PI / 2))), 500);
    const samples = decodeGyroTrack(producer.finish().gyro);
    expect(buildCoreTrack(samples, { brand: 'qiyi' })?.events.map(e => e.token)).toEqual([axis]);
  });

  it('does not replace a measured starting grip with the cross-down heuristic', () => {
    const view = normalizeSolve('R', [{ m: "R'", ts: 100 }], { preferredRotation: 'x', measuredGrip: true });
    expect(view.rotation).toBe('x');
  });

  it.each(['', 'z2'])('removes GAN mounting and arbitrary sensor zero exactly once in frame %s', orientation => {
    const m = SENSOR_BASES.rotX90;
    const mount = new Quaternion(m.x, m.y, m.z, m.w);
    const baseline = pose('y', 0.67).multiply(pose('z', -0.23));
    const grip = notationPose('x y');
    const start = baseline.clone().multiply(mount).multiply(grip).multiply(mount.clone().invert());
    const producer = new SmartCubeAttemptProducer();
    producer.begin(0, { model: 'gan-v4', name: 'GAN' }, { reference: raw(baseline), initial: raw(start), orientation });
    producer.recordMove('R', 0);
    const samples = decodeGyroTrack(producer.finish().gyro);
    expect(facePermFor(initialPoseRotation(samples, 'gan-v4')!)).toEqual(facePermFor(`x y ${orientation}`));
  });

  it.each(grips)('renames every step after non-commuting rotations from grip %s', grip => {
    const initial = notationPose(grip);
    const afterX = initial.clone().multiply(pose('x', -Math.PI / 2));
    const afterZ = afterX.clone().multiply(pose('z', -Math.PI / 2));
    const producer = new SmartCubeAttemptProducer();
    producer.begin(1000, { model: 'qiyi', name: 'test' }, { reference: raw(new Quaternion()), initial: raw(initial) });
    producer.recordMove('R', 1000);
    producer.recordGyro(raw(afterX), 500);
    producer.recordMove('U', 2000);
    producer.recordGyro(raw(afterZ), 1500);
    producer.recordMove('F', 3000);
    const result = producer.finish();
    const samples = decodeGyroTrack(result.gyro);
    const startingRotation = initialPoseRotation(samples, 'qiyi')!;
    expect(startingRotation.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(2);
    const view = normalizeSolve('R U F', result.moves, { preferredRotation: startingRotation, measuredGrip: true });
    const core = conjugateCoreTrack(buildCoreTrack(samples)!, facePermFor(view.rotation));
    const human = humanizeStream(quarterMoves(view.moves), { core });
    expect(human.moves.map(m => m.m)).toEqual([faceAt('R', initial), faceAt('U', afterX), faceAt('F', afterZ)]);
    expect(human.rotations).toHaveLength(2);
    const played = coreTrackPoseAt(buildCoreTrack(samples), startingRotation, 2000);
    expect(Math.abs(new Quaternion(played.x, played.y, played.z, played.w).dot(afterZ))).toBeCloseTo(1, 4);
  });

  it.each([
    ['M', 'R', "L'", "x'"], ['E', 'U', "D'", "y'"], ['S', "F'", 'B', 'z'],
  ])('keeps %s core motion in playback without adding a separate rotation', (slice, a, b, rotation) => {
    const producer = new SmartCubeAttemptProducer();
    producer.begin(0, { model: 'qiyi', name: 'test' }, { reference: raw(new Quaternion()), initial: raw(new Quaternion()) });
    producer.recordGyro(raw(notationPose(rotation)), 500);
    producer.recordMove(a, 500);
    producer.recordMove(b, 510);
    const result = producer.finish();
    const core = buildCoreTrack(decodeGyroTrack(result.gyro), { moves: result.moves });
    const human = humanizeStream(quarterMoves(result.moves), { core });
    expect(human.moves.map(move => move.m)).toEqual([slice]);
    expect(human.rotations).toEqual([]);
    const q = coreTrackPoseAt(core, '', 510);
    expect(Math.abs(new Quaternion(q.x, q.y, q.z, q.w).dot(notationPose(rotation)))).toBeCloseTo(1, 4);
  });

  it('writes a shortest inspection prefix and retains timed z rotations in the complete report', async () => {
    const scramble = "B' D' L' F' U' R'";
    const producer = new SmartCubeAttemptProducer();
    const initial = notationPose('x x z2 x2');
    producer.begin(0, { model: 'qiyi', name: 'test' }, { reference: raw(new Quaternion()), initial: raw(initial) });
    const physicalMoves = ['R', 'U', 'F', 'L', 'D', 'B'];
    physicalMoves.forEach((move, i) => producer.recordMove(move, i * 1000));
    producer.recordGyro(raw(initial.clone().multiply(notationPose('z'))), 500);
    producer.recordGyro(raw(initial.clone().multiply(notationPose('z')).multiply(notationPose('x'))), 1500);
    const result = producer.finish();
    const samples = decodeGyroTrack(result.gyro);
    const rotation = initialPoseRotation(samples)!;
    const view = normalizeSolve(scramble, result.moves, { preferredRotation: rotation, measuredGrip: true });
    const report = await buildReconText({
      scramble: view.scramble, moves: view.moves, totalMs: 5000,
      segs: computeStageSegments(scramble, result.moves, 5000)!, metrics: null, slots: null,
      core: buildCoreTrack(samples, { moves: result.moves }),
      physical: { scramble, moves: result.moves }, viewRotation: view.rotation,
    });
    expect(report.inspection).toBe(rotation);
    expect(report.rotations).toHaveLength(2);
    expect(report.rotations[0].token).toBe('z');
    const written = report.text.split('\n').map(line => line.split('//')[0]).join(' ').trim().split(/\s+/);
    let replay = applyScramble(3, scramble);
    for (const token of written) replay = applyOneToken(replay, token);
    for (const face of Object.values(replay)) expect(new Set(face.flat()).size).toBe(1);
  });
});
