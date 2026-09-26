import { SmartCubeAttemptProducer } from '@cuberoot/shared/timer/smart-cube-attempt';
import { describe, expect, it } from 'vitest';

describe('SmartCubeAttemptProducer', () => {
  it('snapshots the starting device and drains moves at finish', () => {
    const producer = new SmartCubeAttemptProducer();
    producer.begin(1_000, { model: 'gan-v4', name: 'GAN16ui' });
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
});
