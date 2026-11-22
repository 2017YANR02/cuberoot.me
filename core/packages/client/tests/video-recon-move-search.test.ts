import { expect, it, vi } from 'vitest';
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
