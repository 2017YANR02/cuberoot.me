import { expect, it, vi } from 'vitest';
import { FrameSelector } from '@/lib/video-recon/engine/frame-stream';
import { PoseFitter } from '@/lib/video-recon/engine/pose-fitter';
import { MoveSearch } from '@/lib/video-recon/engine/move-search';
import type { Detection, FrameResult } from '@/lib/video-recon/engine/detector';
import type { FittedPose } from '@/lib/video-recon/engine/pose-types';
import { createSearchConfig } from '@/lib/video-recon/pose-fitter/runtime/reconstruction-policy.mjs';

it('closes blind video search when the decoded frames skip clock buckets', async () => {
  const postMessage = vi.fn();
  vi.stubGlobal('Worker', class {
    postMessage = postMessage;
    terminate() {}
  });
  const error = vi.fn();
  const config = createSearchConfig({ scramble: '', inferScramble: true, fps: 60, originSeconds: 4 });
  const search = new MoveSearch('http://localhost/vendor/video-recon/', config, vi.fn(), error, true);
  try {
    const first = Promise.withResolvers<FittedPose>();
    const fit: FittedPose = {
      bank: [], wireframe: [], pose: null, bootstrap: false, message: '', elapsedMs: 0,
      pose_flag_reason: null, pose_geometry_flag_reason: 'uncertain',
    };
    const detections = [0, 3, 8].map((classId): Detection => ({
      classId, score: 1, presence: 1, x: 0, y: 0, box: [0, 0, 1, 1],
    }));
    const result = { detections } as FrameResult;
    search.submit(4, result, first.promise);
    search.submit(4.01, result, Promise.resolve(fit));
    search.submit(4.1037, result, Promise.resolve(fit));
    const ended = search.end();
    await Promise.resolve();
    expect(postMessage.mock.calls.map(([request]) => request.type)).toEqual(['init', 'frame']);
    first.resolve(fit);
    await ended;

    const [, second, initial, end] = postMessage.mock.calls.map(([request]) => request);
    expect(second.frame).toEqual({
      sequence: 1, frame: 246, timestamp_ms: 4104, bank: [], landmark_count: 1,
      colors: ['white', 'green'], flagged: false, geometry_flagged: true,
    });
    expect(initial.frame).toMatchObject({ sequence: 0, frame: 240, timestamp_ms: 4000 });
    expect(end).toEqual({ type: 'end' });
    expect(error).not.toHaveBeenCalled();
  } finally {
    search.dispose();
    vi.unstubAllGlobals();
  }
});

it.each(['', 'R U'])('uses decoded time for fitting and dense search ordinals with scramble %j', async scramble => {
  const fps = 29.445727482678983;
  const config = createSearchConfig({ scramble, inferScramble: !scramble, fps, video: true, originSeconds: 2.055 });
  const postMessage = vi.fn();
  vi.stubGlobal('Worker', class { postMessage = postMessage; terminate() {} });
  const fitter = new PoseFitter('', {
    dispose() {},
    async execute(job) {
      if (job.type === 'prepare') return { candidates: [] };
      return { bank: [], wireframe: [], pose: null };
    },
  });
  const search = new MoveSearch('http://localhost/', config, vi.fn(), vi.fn(), true);
  const result = { transform: { sourceWidth: 640, sourceHeight: 480, cropWidth: 640, cropHeight: 480 }, detections: [] } as unknown as FrameResult;
  try {
    const selector = new FrameSelector(30);
    const timestamps = [2.055, 2.0551, 2.088333333333334, 2.119, 2.22].filter(time => selector.accept(time));
    expect(timestamps).toEqual([2.055, 2.088333333333334, 2.119, 2.22]);
    const fits = timestamps.map((time, i) => {
      const fit = fitter.fit(result, i === 0, time, fps, { scramble, turningStartFrame: null, video: true });
      search.submit(time, result, fit);
      return fit;
    });
    await fitter.flush();
    await search.end();
    const ticks = [2055, 2088, 2119, 2220];
    expect((await Promise.all(fits)).map(fit => fit.sourceFrame)).toEqual(ticks);
    const admitted = postMessage.mock.calls.map(([message]) => message).filter(message => message.type === 'frame');
    expect(admitted.map(({ frame }) => [frame.sequence, frame.frame, frame.timestamp_ms]).sort((a, b) => a[0] - b[0]))
      .toEqual(ticks.map((tick, i) => [i, tick, tick]));
    expect(config.fps).toBe(1000);
    expect(config.source_fps).toBe(fps);
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'end' });
  } finally {
    search.dispose();
    fitter.dispose();
    vi.unstubAllGlobals();
  }
});
