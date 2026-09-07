import { describe, expect, it } from 'vitest';
import { checkFrameTimes, checkQuality, videoSize } from '../src/tools/drive_video.js';

describe('Drive video acceptance', () => {
  it('preserves size by default and caps landscape/portrait without upscaling', () => {
    expect(videoSize(3840, 2160, 'original')).toEqual([3840, 2160]);
    expect(videoSize(3840, 2160, '1080p')).toEqual([1920, 1080]);
    expect(videoSize(2160, 3840, '1080p')).toEqual([1080, 1920]);
    expect(videoSize(1280, 720, '1080p')).toEqual([1280, 720]);
    expect(videoSize(2048, 2048, '1080p')).toEqual([1080, 1080]);
    for (const width of [0, -2, 1919, NaN, Infinity, 8194]) expect(() => videoSize(width, 1080, 'original')).toThrow();
  });

  it('rejects dropped, duplicated, shifted and invalid frames, including variable frame rate', () => {
    const frames = (times: string[]) => times.map((best_effort_timestamp_time) => ({ best_effort_timestamp_time }));
    const source = frames(['0.000000', '0.016667', '0.050000', '0.066667']);
    expect(() => checkFrameTimes(source, source)).not.toThrow();
    for (const output of [[], source.slice(1), [...source, source[3]], frames(['0', '0.033333', '0.05', '0.066667']),
      frames(['0', 'NaN', '0.05', '0.066667'])]) expect(() => checkFrameTimes(source, output)).toThrow('frame-timing-changed');
  });

  it('requires high average quality and rejects hidden poor sections', () => {
    expect(checkQuality([98, 99, 100])).toEqual({ mean: 99, min: 98, p1: 98, samples: 3 });
    for (const scores of [[], [NaN], [96, 96], [80, ...Array(99).fill(99)], [79, ...Array(999).fill(100)]]) {
      expect(() => checkQuality(scores)).toThrow('quality-check-failed');
    }
  });
});
