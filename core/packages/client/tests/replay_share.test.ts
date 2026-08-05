import { describe, expect, it } from 'vitest';

import { decodeReplayParam, solveFromReplay } from '@/app/[lang]/timer/_lib/share/decode';
import { encodeReplayPayload } from '@/app/[lang]/timer/_lib/share/encode';
import type { Solve } from '@/app/[lang]/timer/_lib/types';

const SOLVE: Solve = {
  id: 'source',
  timeMs: 15269.4,
  penalty: 'ok',
  scramble: "R2 B' L2 R D'",
  event: '333',
  ts: 1,
  moves: [
    { m: "L'", ts: 81.6 },
    { m: "L'", ts: 164.1 },
    { m: 'F', ts: 210.7 },
  ],
  gyro: 'RwECAwQ',
  device: { model: 'gan-v4', name: 'GAN test' },
  reconstruction: ['z2 // insp', "R U R' // BR"],
};

describe('replay share keeps the data needed for an exact reconstruction', () => {
  it('new links round-trip gyro and device together with the rebased moves', () => {
    const decoded = decodeReplayParam(encodeReplayPayload(SOLVE));
    expect(decoded).toEqual({
      event: '333',
      scramble: SOLVE.scramble,
      moves: [
        { m: "L'", ts: 0 },
        { m: "L'", ts: 83 },
        { m: 'F', ts: 129 },
      ],
      totalMs: 15269,
      gyro: SOLVE.gyro,
      device: SOLVE.device,
      reconstruction: SOLVE.reconstruction,
    });
  });

  it('legacy links recover gyro only from an exact local move-stream match', () => {
    const legacy: Solve = { ...SOLVE, gyro: undefined, device: undefined };
    const decoded = decodeReplayParam(encodeReplayPayload(legacy));
    expect(decoded).not.toBeNull();
    const replay = solveFromReplay(decoded!, [SOLVE], 42);
    expect(replay.id).toBe('replay-42');
    expect(replay.gyro).toBe(SOLVE.gyro);
    expect(replay.device).toEqual(SOLVE.device);
  });

  it('does not borrow orientation when one move or timestamp differs', () => {
    const legacy: Solve = { ...SOLVE, gyro: undefined, device: undefined };
    const decoded = decodeReplayParam(encodeReplayPayload(legacy));
    expect(decoded).not.toBeNull();
    const wrongMove: Solve = {
      ...SOLVE,
      moves: SOLVE.moves?.map((m, i) => i === 2 ? { ...m, m: "F'" } : m),
    };
    const wrongTime: Solve = {
      ...SOLVE,
      moves: SOLVE.moves?.map((m, i) => i === 2 ? { ...m, ts: m.ts + 2 } : m),
    };
    expect(solveFromReplay(decoded!, [wrongMove], 42).gyro).toBeUndefined();
    expect(solveFromReplay(decoded!, [wrongTime], 42).gyro).toBeUndefined();
  });

  it('rejects malformed optional gyro/device fields instead of half-decoding them', () => {
    const toToken = (value: unknown): string => Buffer.from(JSON.stringify(value), 'utf8')
      .toString('base64url');
    expect(decodeReplayParam(toToken({ e: '333', s: '', m: [], t: 0, g: '' }))).toBeNull();
    expect(decodeReplayParam(toToken({ e: '333', s: '', m: [], t: 0, d: ['gan-v4'] }))).toBeNull();
  });
});
