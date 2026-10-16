import { expect, it } from 'vitest';
import { detectRotations, rotationPoseAt } from '@cuberoot/shared/timer/reconstruct/rotation-detect';
import { CUBE_ORIENTATIONS, QUAT_IDENTITY, quatAngleTo, quatMul, type Quat } from '@cuberoot/shared/smart-cube/orientation';
import type { GyroSample } from '@cuberoot/shared/smart-cube/gyro-track';
import { humanizeStream } from '@cuberoot/shared/timer/reconstruct/humanize';
import { htmMoves } from '@cuberoot/shared/timer/reconstruct/htm';
import { buildCoreTrack, coreTurnsIn, coreTrackPoseAt } from '@cuberoot/shared/timer/reconstruct/core-track';

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

it('separates the notation boundary from the responsive pose snap', () => {
  const events = detectRotations(samples([0, 60, 76]));
  expect(events.map(e => [e.tMs, e.notationMs])).toEqual([[1, 2]]);
  expect(quatAngleTo(rotationPoseAt(events, 1), x(90))).toBeLessThan(1e-6);
  expect(detectRotations(samples([0, 90, 90]))[0].notationMs).toBeUndefined();
  expect(detectRotations(samples([0, 60, 0]))[0].notationMs).toBeUndefined();
  expect(detectRotations([{ tMs: 0, q: x(0), frame: 'scramble' },
    { tMs: 1, q: x(60), frame: 'scramble' },
    { tMs: 1000, q: x(90), frame: 'scramble' }])[0].notationMs).toBeUndefined();
});

it('places a settled regrip before the next face turn even while the grip remains tilted', () => {
  const tilt = { w: Math.cos(25 * Math.PI / 360), x: 0, y: Math.sin(25 * Math.PI / 360), z: 0 };
  const recorded = [
    { tMs: 0, q: x(0), frame: 'scramble' as const },
    { tMs: 100, q: x(60), frame: 'scramble' as const },
    { tMs: 150, q: quatMul(x(80), tilt), frame: 'scramble' as const },
    { tMs: 300, q: x(90), frame: 'scramble' as const },
  ];
  const events = detectRotations(recorded);
  expect(events.map(e => [e.token, e.tMs, e.notationMs])).toEqual([['x', 100, 150]]);
  const core = buildCoreTrack(recorded)!;
  const straight = buildCoreTrack(recorded.map(s => s.tMs === 150 ? { ...s, q: x(80) } : s))!;
  const moves = htmMoves([{ m: 'U', ts: 50 }, { m: "F'", ts: 200 }, { m: 'R', ts: 350 }]);
  expect(humanizeStream(moves, { core })).toEqual(humanizeStream(moves, { core: straight }));
  expect(humanizeStream(moves, { core }).rotations).toEqual([{ token: "x'", tMs: 150 }]);
  expect(quatAngleTo(rotationPoseAt(events, 100), x(90))).toBeLessThan(1e-6);
});

it('assigns a late angular snap to its measured slice approach without moving playback', () => {
  const trackSamples = [
    { tMs: 0, q: x(0), frame: 'scramble' as const },
    { tMs: 100, q: x(90), frame: 'scramble' as const },
    { tMs: 600, q: x(40), frame: 'scramble' as const },
    { tMs: 1000, q: x(34), frame: 'scramble' as const },
  ];
  const moves = htmMoves([
    { m: 'R', ts: 100 }, { m: "L'", ts: 100 }, { m: 'U', ts: 400 },
    { m: "R'", ts: 600 }, { m: 'L', ts: 600 }, { m: 'U', ts: 1200 },
  ]);
  const core = buildCoreTrack(trackSamples)!;
  expect(core.events.map(e => [e.token, e.tMs, e.startMs, e.sliceStartMs]))
    .toEqual([["x'", 100, 100, undefined], ['x', 1000, 1000, 600]]);
  expect(coreTurnsIn(core, 600, 600, "x'")).toEqual([1]);
  expect(coreTurnsIn(core, 600, 600, "z'")).toEqual([]);
  expect(coreTurnsIn(core, 600, 600, 'x')).toEqual([]);
  expect(coreTrackPoseAt(core, '', 800)).toEqual(coreTrackPoseAt({ ...core, events: core.events.slice(0, 1) }, '', 800));
  const onTime = buildCoreTrack(trackSamples.filter(s => s.tMs !== 600).map(s =>
    s.tMs === 1000 ? { ...s, tMs: 600 } : s))!;
  const result = humanizeStream(moves, { core });
  expect(result.rotations).toEqual([]);
  expect(result.moves).toEqual(humanizeStream(moves, { core: onTime }).moves);

  // Returning to the old cell breaks the approach: a later real rotation
  // must not be absorbed by an earlier, already-completed encoder pair.
  const interrupted = buildCoreTrack([...trackSamples.slice(0, 3),
    { tMs: 800, q: x(90), frame: 'scramble' as const }, trackSamples[3]])!;
  expect(coreTurnsIn(interrupted, 600, 600, "x'")).toEqual([]);
  expect(humanizeStream(moves, { core: interrupted }).rotations.map(e => e.token)).toEqual(['x']);
});
