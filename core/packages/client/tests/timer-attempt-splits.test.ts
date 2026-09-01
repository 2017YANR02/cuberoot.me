import {
  TimerAttemptSplitRecorder,
  normalizeTimerAttemptSplitSettings,
} from '@cuberoot/shared/timer';
import { describe, expect, it, vi } from 'vitest';

describe('shared timer attempt splits', () => {
  it('records first samples, resets each attempt and emits one normalized solve payload', () => {
    const onChange = vi.fn();
    const recorder = new TimerAttemptSplitRecorder(onChange);

    recorder.begin({ bldMemo: true, multiStage: true });
    recorder.markStage('cross', 5_000);
    recorder.markStage('cross', 6_000);
    recorder.markStage('f2l', 4_000);
    recorder.markStage('oll', 20_000);
    recorder.markMemo(12_000);
    recorder.markMemo(13_000);

    expect(recorder.finish(10_000)).toEqual({
      bld: { memoMs: 10_000 },
      stages: { cross: 5_000, f2l: 5_000, oll: 10_000, pll: 10_000 },
    });
    expect(recorder.snapshot()).toEqual({ stages: {} });

    recorder.begin({ bldMemo: false, multiStage: true });
    recorder.markStage('cross', 1_000);
    recorder.begin({ bldMemo: false, multiStage: true });
    expect(recorder.finish(2_000)).toEqual({ stages: { pll: 2_000 } });
    expect(onChange).toHaveBeenCalled();
  });

  it('reuses canonical move-stream segmentation for automatic stage transitions', () => {
    const recorder = new TimerAttemptSplitRecorder();
    recorder.begin({ bldMemo: false, multiStage: true });
    recorder.markStage('cross', 500);
    recorder.observeMoves({ event: '333', scramble: 'R', moves: [{ m: "R'", ts: 2_500 }], timeMs: Number.NaN });
    recorder.observeMoves({ event: '333', scramble: 'R', moves: [{ m: "R'", ts: 2_500 }], timeMs: 2_500 });
    expect(recorder.finish(3_000)).toEqual({
      stages: { cross: 500, f2l: 2_500, oll: 2_500, pll: 3_000 },
    });
  });

  it('fails closed on invalid final time and normalizes malformed settings', () => {
    const recorder = new TimerAttemptSplitRecorder();
    recorder.begin({ bldMemo: true, multiStage: true });
    recorder.markMemo(1_000);
    expect(recorder.finish(Number.NaN)).toEqual({});
    expect(normalizeTimerAttemptSplitSettings({ bldMemo: 'yes', multiStage: 1 })).toEqual({
      bldMemo: true,
      multiStage: false,
    });
  });
});
