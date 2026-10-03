import { SmartCubeAttemptProducer } from '@cuberoot/shared/timer/smart-cube-attempt';
import { decodeGyroTrack } from '@cuberoot/shared/smart-cube/gyro-track';
import { describe, expect, it } from 'vitest';

describe('SmartCubeAttemptProducer', () => {
  it('reads live moves, device and gyro without draining or mutating the final recording', () => {
    const producer = new SmartCubeAttemptProducer();
    producer.begin(1_000, { model: 'gan-v4', name: 'GAN16ui' });
    producer.recordMove('R', 1_100);
    producer.recordGyro({ w: 1, x: 0, y: 0, z: 0 }, 20);
    const snapshot = producer.snapshot();
    const expected = structuredClone(snapshot);
    snapshot.moves[0].m = 'F';
    snapshot.device!.name = 'Changed';
    expect(producer.snapshot()).toEqual(expected);
    producer.recordMove('U', 1_200);
    expect(producer.finish()).toEqual({
      ...expected, moves: [{ m: 'R', ts: 100 }, { m: 'U', ts: 200 }],
    });
    producer.begin(2_000);
    expect(producer.snapshot()).toEqual({ moves: [], gyro: null, device: undefined });
  });

  it('snapshots the starting device and drains moves at finish', () => {
    const producer = new SmartCubeAttemptProducer();
    const device = { model: 'gan-v4', name: 'GAN16ui' };
    producer.begin(1_000, device);
    device.name = 'Another cube';
    expect(producer.recordMove('R', 1_125)).toBe(true);

    expect(producer.finish()).toEqual({
      device: { model: 'gan-v4', name: 'GAN16ui' },
      gyro: null,
      moves: [{ m: 'R', ts: 125 }],
    });
    expect(producer.finish()).toEqual({ device: undefined, gyro: null, moves: [] });
  });

  it('does not persist a device when no move stream was recorded', () => {
    const producer = new SmartCubeAttemptProducer();
    producer.begin(1_000, { model: 'qiyi', name: 'QY-QYSC-1-A1B2' });
    expect(producer.finish().device).toBeUndefined();
  });

  it.each(['finish', 'reset'] as const)('rejects samples before begin and after %s', (end) => {
    const producer = new SmartCubeAttemptProducer();
    const q = { w: 1, x: 0, y: 0, z: 0 };
    expect(producer.recordGyro(q, 0)).toBe(false);
    producer.begin(10_000);
    expect(producer.recordMove('R', 10_000)).toBe(true);
    expect(producer.recordGyro(q, 0)).toBe(true);
    producer[end]();
    expect(producer.recordMove('U', 10_100)).toBe(false);
    expect(producer.recordGyro(q, 100)).toBe(false);
    expect(producer.finishSolveFields({ event: '333', scramble: '', timeMs: 100 })).toEqual({});
    producer.begin(20_000);
    producer.recordMove('F', 20_010);
    expect(producer.finish().moves).toEqual([{ m: 'F', ts: 10 }]);
  });

  it('omits every smart-cube field for a gyro-only manual attempt', () => {
    const producer = new SmartCubeAttemptProducer();
    producer.begin(1_000, { model: 'gan-v4', name: 'GAN16ui' });
    producer.recordGyro({ w: 1, x: 0, y: 0, z: 0 }, 0);
    expect(producer.finishSolveFields({ event: '333', scramble: 'R', timeMs: 100 })).toEqual({});
  });

  it('produces persisted fields with independent move and gyro clocks and CFOP segments', () => {
    const producer = new SmartCubeAttemptProducer();
    producer.begin(90_000, { model: 'gan-v4', name: 'GAN16ui' });
    producer.recordMove("R'", 90_100);
    producer.recordGyro({ w: 1, x: 0, y: 0, z: 0 }, 20);
    const fields = producer.finishSolveFields({ event: '333', scramble: 'R', timeMs: 100 });
    expect(fields.moves).toEqual([{ m: "R'", ts: 100 }]);
    expect(fields.device).toEqual({ model: 'gan-v4', name: 'GAN16ui' });
    expect(decodeGyroTrack(fields.gyro!)).toEqual([{ tMs: 20, q: { w: 1, x: 0, y: 0, z: 0 } }]);
    expect(fields.stageSegments?.solvedMs).toBe(100);
  });

  it('keeps moves without inventing CFOP segments for unsupported events', () => {
    const producer = new SmartCubeAttemptProducer();
    producer.begin(0);
    producer.recordMove('R', 100);
    expect(producer.finishSolveFields({ event: '222', scramble: "R'", timeMs: 100 }))
      .toEqual({ moves: [{ m: 'R', ts: 100 }] });
  });
});
