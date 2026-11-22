import { describe, expect, it, vi } from 'vitest';
import { TIMER_SEARCH_LIMIT_MS } from '@/lib/video-recon/engine/cube-timer';
import type { FrameResult } from '@/lib/video-recon/engine/detector';
import type { FittedPose } from '@/lib/video-recon/engine/pose-types';
import type { MoveSearchResult } from '@/lib/video-recon/engine/move-search-types';
import { TimerReconstruction, type TimerSearchFactory } from '@/lib/video-recon/engine/timer-reconstruction';
import { CameraPreRoll, TimerCaptureGate } from '@/lib/video-recon/engine/timer-capture';
import { TimerReplayStore } from '@/lib/video-recon/engine/timer-replay';
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

describe('camera solve capture windows', () => {
  it('releases only recent buffered frames and preserves source order', () => {
    const buffer = new CameraPreRoll<{ timestamp: number; close: () => void }>();
    const frames = [1, 1.3, 1.5, 1.6].map(timestamp => ({ timestamp, close: vi.fn() }));
    frames.forEach(frame => buffer.push(frame));
    expect(frames[0].close).toHaveBeenCalledOnce();
    expect(buffer.take(1.5)).toEqual(frames.slice(2));
    expect(frames[1].close).toHaveBeenCalledOnce();
    expect(frames[2].close).not.toHaveBeenCalled();
    expect(buffer.take(1.5)).toEqual([]);
  });

  it('closes the previous tail before admitting the first frame of the next solve', () => {
    const gate = new TimerCaptureGate();
    expect(gate.start('first', 2)).toBe(1.5);
    expect(gate.admit(1.6).frame).toEqual({ id: 'first', reset: true });
    gate.stop('first', 10);
    expect(gate.start('second', 10.5)).toBe(10.3);
    expect(gate.admit(10.2).frame).toEqual({ id: 'first', reset: false });
    expect(gate.admit(10.4)).toEqual({
      ends: [{ id: 'first', timestamp: 10.3, latest: false }],
      frame: { id: 'second', reset: true },
    });
    expect(gate.finish('first')).toBe(false);
    expect(gate.admit(10.5).frame).toEqual({ id: 'second', reset: false });
  });

  it.each(['R', ''])('uses the exact filming window with scramble %j', async scramble => {
    const id = 'recording';
    const gate = new TimerCaptureGate();
    const update = vi.fn();
    const search = { submit: vi.fn(), end: vi.fn(async () => {}), dispose: vi.fn() };
    const reconstruction = new TimerReconstruction(() => search, update);
    const publish = vi.fn();
    const replay = new TimerReplayStore(publish);
    const start = gate.start(id, 2, 0);
    expect(start).toBe(2);
    const config = reconstruction.start(id, scramble, 2, 30, false, start, !scramble);
    expect(config.turning_start_frame).toBeNull();
    expect(!!config.infer_scramble).toBe(!scramble);
    replay.start(id, 2, config.fps, start);

    const frame = {} as FrameResult;
    const pose = Promise.resolve({} as FittedPose);
    for (const time of [1.99, 2, 2.5]) {
      reconstruction.submit(time, frame, pose);
      replay.capture(time, frame, async () => new Blob());
    }
    expect(gate.admit(1.99)).toEqual({ ends: [] });
    expect(gate.admit(2).frame).toEqual({ id, reset: true });

    gate.stop(id, 3, 0);
    reconstruction.stop(id, 3, 0);
    replay.stop(id, 3, 0);
    expect(gate.admit(3)).toEqual({ ends: [{ id, timestamp: 3, latest: true }] });
    reconstruction.submit(3, frame, pose);
    replay.capture(3, frame, async () => new Blob());
    reconstruction.finishThrough(3);
    replay.finishThrough(3);

    expect(search.submit.mock.calls.map(([time]) => time)).toEqual([2, 2.5]);
    expect(search.end).toHaveBeenCalledOnce();
    expect(update.mock.lastCall?.[1].config).toMatchObject({ requested_start_seconds: 2, source_end_seconds: 3 });
    await vi.waitFor(() => expect(publish.mock.lastCall?.[0]).toMatchObject({ complete: true, start: 2, end: 3 }));
    expect(publish.mock.lastCall?.[0].frames.map((row: { timestamp: number }) => row.timestamp)).toEqual([2, 2.5]);
    reconstruction.cancel();
  });

  it('finishes publishing a retained camera frame when the search times out', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    try {
      const update = vi.fn();
      const search = { submit: vi.fn(), end: vi.fn(async () => {}), dispose: vi.fn() };
      let report!: Parameters<TimerSearchFactory>[1];
      const reconstruction = new TimerReconstruction((_config, result) => {
        report = result;
        return search;
      }, update);
      const publish = vi.fn();
      const replay = new TimerReplayStore(publish);
      const frame = {} as FrameResult;
      const id = 'recording';
      const image = new Blob(['camera frame']);
      let encode!: (blob: Blob) => void;
      const encoding = new Promise<Blob>(resolve => { encode = resolve; });

      reconstruction.start(id, 'R', 2, 30);
      replay.start(id, 2, 1000);
      reconstruction.submit(2.5, frame, Promise.resolve({} as FittedPose));
      replay.capture(2.5, frame, () => encoding);
      reconstruction.stop(id, 3, 0);
      replay.stop(id, 3, 0);
      reconstruction.finishThrough(3);
      replay.finishThrough(3);
      report({ status: 'running', steps: [] } as unknown as MoveSearchResult, true);
      vi.advanceTimersByTime(TIMER_SEARCH_LIMIT_MS);
      expect(update.mock.lastCall?.[1]).toMatchObject({ status: 'failed', message: expect.stringContaining('timed out') });
      expect(publish).not.toHaveBeenCalled();

      encode(image);
      await vi.advanceTimersByTimeAsync(0);
      expect(publish.mock.lastCall?.[0]).toMatchObject({
        complete: true, end: 3, frames: [{ timestamp: 2.5, image }],
      });
    } finally { vi.useRealTimers(); }
  });

  it('includes pre-roll in search and replay while keeping the stopwatch origin', async () => {
    const update = vi.fn();
    const search = { submit: vi.fn(), end: vi.fn(async () => {}), dispose: vi.fn() };
    const reconstruction = new TimerReconstruction(() => search, update);
    const config = reconstruction.start('solve', 'R', 2, 30, true, 1.5);
    expect(config.turning_start_frame).toBe(2000);
    reconstruction.submit(1.6, {} as FrameResult, Promise.resolve({} as FittedPose));
    expect(search.submit).toHaveBeenCalledOnce();
    expect(update.mock.lastCall?.[1].config).toMatchObject({ requested_start_seconds: 2, source_origin_seconds: 1.6 });
    const publish = vi.fn();
    const replay = new TimerReplayStore(publish);
    replay.start('solve', 2, 1000, 1.5);
    const encode = async () => new Blob();
    for (const timestamp of [1.4, 1.6, 2.1]) replay.capture(timestamp, {} as FrameResult, encode);
    replay.stop('solve', 3);
    replay.finishThrough(3.3);
    await vi.waitFor(() => expect(publish.mock.lastCall?.[0].complete).toBe(true));
    expect(publish.mock.lastCall?.[0].start).toBe(2);
    expect(publish.mock.lastCall?.[0].frames.map((frame: { timestamp: number }) => frame.timestamp)).toEqual([1.6, 2.1]);
    reconstruction.cancel();
  });
});
