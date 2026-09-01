import { sliceReconstruction as sharedSlice } from '@cuberoot/shared/timer/reconstruct/solve-metrics';
import { describe, expect, it } from 'vitest';

import { sliceReconstruction as webSlice } from '../app/[lang]/timer/_lib/reconstruct/slice';

describe('shared timer reconstruction metrics', () => {
  it('keeps the Web compatibility export identical and preserves metric boundaries', () => {
    expect(webSlice).toBe(sharedSlice);

    expect(sharedSlice([
      { m: 'R', ts: 100 },
      { m: 'R', ts: 200 },
    ], 1_000)).toMatchObject({
      firstMoveLatencyMs: 100,
      htmCount: 1,
      htps: 1,
      qtmCount: 2,
      qtps: 2,
    });

    expect(sharedSlice([
      { m: 'U', ts: 900 },
      { m: 'R', ts: 1_500 },
      { m: 'U', ts: 2_000 },
      { m: 'F', ts: 2_501 },
    ], 4_000, 1_000)).toMatchObject({
      executionMs: 3_000,
      firstMoveLatencyMs: 500,
      htmCount: 3,
      longestPauseMs: 501,
      memoMs: 1_000,
      pauseCount: 1,
    });

    expect(sharedSlice([{ m: 'R', ts: 0 }], 0)).toMatchObject({ htps: 0, qtps: 0 });
  });
});
