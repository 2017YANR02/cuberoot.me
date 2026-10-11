import { expect, it } from 'vitest';
import { detectRotations, rotationPoseAt } from '@cuberoot/shared/timer/reconstruct/rotation-detect';
import { CUBE_ORIENTATIONS, QUAT_IDENTITY, quatAngleTo, type Quat } from '@cuberoot/shared/smart-cube/orientation';
import type { GyroSample } from '@cuberoot/shared/smart-cube/gyro-track';
import { humanizeStream } from '@cuberoot/shared/timer/reconstruct/humanize';
import { htmMoves } from '@cuberoot/shared/timer/reconstruct/htm';

const x = (degrees: number): Quat => ({ w: Math.cos(degrees * Math.PI / 360), x: Math.sin(degrees * Math.PI / 360), y: 0, z: 0 });
const samples = (degrees: number[]): GyroSample[] => degrees.map((deg, tMs) => ({ tMs, q: x(deg), frame: 'scramble' }));

it('updates immediately, including a one-sample full turn and return', () => {
  expect(detectRotations(samples([0, 90, 0])).map(e => [e.token, e.tMs])).toEqual([['x', 1], ["x'", 2]]);
});

it('uses separate forward and return boundaries without a dwell timer', () => {
  expect(detectRotations(samples([0, 54, 56, 50, 44, 36, 34])).map(e => [e.token, e.tMs])).toEqual([['x', 2], ["x'", 6]]);
  expect(detectRotations(samples([0, 44, 46, 44, 46]))).toEqual([]);
});

it('retains intermediate poses throughout a continuous half turn', () => {
  const events = detectRotations(samples([0, 60, 120, 160, 180]));
  expect(events.map(e => [e.token, e.tMs])).toEqual([['x', 1], ['x', 3]]);
  expect(quatAngleTo(rotationPoseAt(events, 1), x(90))).toBeLessThan(1e-6);
  expect(quatAngleTo(rotationPoseAt(events, 4), x(180))).toBeLessThan(1e-6);
});

it.each(CUBE_ORIENTATIONS.map((q, i) => [i, q] as const))('preserves the pose of sparse compound jump %i', (_, q) => {
  const events = detectRotations([{ tMs: 0, q: QUAT_IDENTITY, frame: 'scramble' }, { tMs: 1, q, frame: 'scramble' }]);
  expect(events.every(e => e.token !== '?')).toBe(true);
  expect(quatAngleTo(rotationPoseAt(events, 1), q)).toBeLessThan(1e-6);
});

it.each(['x', "x'", 'y', "y'", 'z', "z'"])('compacts consecutive %s quarters only in notation', token => {
  const core = { frame: 'scramble' as const, events: [100, 150].map(tMs => ({ tMs, token, angleRad: Math.PI / 2 })) };
  const result = humanizeStream([], { core });
  expect(result.rotations.map(e => e.token)).toEqual([`${token[0]}2${token.endsWith("'") ? "'" : ''}`]);
  expect(core.events).toHaveLength(2);
  expect(humanizeStream(htmMoves([{ m: 'F', ts: 125 }]), { core }).rotations).toHaveLength(2);
});

it('keeps a genuine immediate reversal in notation', () => {
  const core = { frame: 'scramble' as const, events: ['x', "x'"].map((token, tMs) => ({ tMs, token, angleRad: Math.PI / 2 })) };
  expect(humanizeStream([], { core }).rotations.map(e => e.token)).toEqual(['x', "x'"]);
});
