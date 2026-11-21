import { describe, expect, it, vi } from 'vitest';
import { TIMER_SEARCH_LIMIT_MS } from '@/lib/video-recon/engine/cube-timer';
import type { FrameResult } from '@/lib/video-recon/engine/detector';
import type { FittedPose } from '@/lib/video-recon/engine/pose-types';
import type { MoveSearchResult } from '@/lib/video-recon/engine/move-search-types';
import { TimerReconstruction, type TimerSearchFactory } from '@/lib/video-recon/engine/timer-reconstruction';
import { ParallelSearch } from '@/lib/video-recon/pose-fitter/runtime/parallel-search.mjs';

describe('camera reconstruction search', () => {
  it('counts only the time spent searching after frame preparation', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    try {
      const update = vi.fn();
      const search = { submit: vi.fn(), end: vi.fn(async () => {}), dispose: vi.fn(), pause: vi.fn(), resume: vi.fn() };
      let publish!: Parameters<TimerSearchFactory>[1];
      const reconstruction = new TimerReconstruction((config, result) => {
        expect(config.bidirectional).toBe(true);
        publish = result;
        return search;
      }, update);
      reconstruction.start('first', 'R', 1, 30);
      reconstruction.submit(1.1, {} as FrameResult, Promise.resolve({} as FittedPose));
      reconstruction.stop('first', 2);
      vi.advanceTimersByTime(TIMER_SEARCH_LIMIT_MS * 2);
      expect(update.mock.lastCall?.[1].status).toBe('waiting');
      reconstruction.finishThrough(2.4);
      expect(search.end).toHaveBeenCalledOnce();
      publish({ status: 'waiting_for_frames', steps: [] } as unknown as MoveSearchResult, true);
      vi.advanceTimersByTime(TIMER_SEARCH_LIMIT_MS * 2);
      expect(update.mock.lastCall?.[1].status).toBe('waiting');
      publish({ status: 'running', steps: [] } as unknown as MoveSearchResult, true);
      vi.advanceTimersByTime(10_000);
      reconstruction.start('second', 'U', 3, 30);
      expect(search.pause).toHaveBeenCalledOnce();
      vi.advanceTimersByTime(TIMER_SEARCH_LIMIT_MS * 2);
      expect(search.dispose).not.toHaveBeenCalled();
      reconstruction.cancelSolve('second');
      expect(search.resume).toHaveBeenCalledOnce();
      vi.advanceTimersByTime(TIMER_SEARCH_LIMIT_MS - 10_001);
      expect(update.mock.lastCall?.[1].status).toBe('searching');
      vi.advanceTimersByTime(1);
      expect(update.mock.lastCall?.[1]).toMatchObject({ status: 'failed', message: expect.stringContaining('timed out') });
    } finally { vi.useRealTimers(); }
  });

  it('prepares both search sides while paused and only expands after resuming', async () => {
    const expand = vi.fn(() => new Promise(() => {}));
    const error = vi.fn();
    const report = vi.fn();
    const driver = new ParallelSearch({
      report, error,
      spawn: () => ({
        dispose() {},
        async request(message) {
          if (message.type === 'advance_side') return expand();
          return { stats: { evaluated_states: 0 } };
        },
      }),
    });
    driver.request({ type: 'init', config: { state_limit: 1000 } });
    driver.request({ type: 'pause' });
    driver.request({ type: 'end' });
    await vi.waitFor(() => expect(report.mock.lastCall?.[0].result.status).toBe('running'));
    expect(expand).not.toHaveBeenCalled();
    driver.request({ type: 'resume' });
    expect(expand).toHaveBeenCalledTimes(2);
    expect(error).not.toHaveBeenCalled();
    driver.dispose();
  });
});
