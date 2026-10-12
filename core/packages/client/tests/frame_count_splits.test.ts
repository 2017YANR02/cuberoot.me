import { describe, expect, it } from 'vitest';
import { isVideoFileName, matchesVideoFile, parseSplits, serializeSplits } from '@/app/[lang]/frame-count/splits-file';

describe('frame count sidecar persistence', () => {
  it('restores exact FPS, all marks, entered times and calculation method', () => {
    const solves = [
      { name: 'Solve 1', time: '2.51', marks: [38, 54, 284, 290].map(frame => ({ frame })) },
      { name: 'Solve 2', time: '', marks: [] },
    ];
    const restored = parseSplits(serializeSplits(solves, 99.981, 'timestamp'));
    expect(restored).toEqual({ solves, fps: 99.981, startFrameMethod: 'timestamp', hasTimes: true });
    expect(restored.solves[0].marks[3].frame - restored.solves[0].marks[0].frame).toBe(252);
  });

  it('reads legacy named and pipe-delimited marks without mistaking empty fields for frame zero', () => {
    expect(parseSplits('fps:59.94\nsplits:38|54|284|290\nSolve 2:\n')).toEqual({
      fps: 59.94, startFrameMethod: 'fps', hasTimes: false,
      solves: [
        { name: 'Solve 1', time: '', marks: [38, 54, 284, 290].map(frame => ({ frame })) },
        { name: 'Solve 2', time: '', marks: [] },
      ],
    });
  });

  it.each(['', 'fps:NaN\nSolve 1:3', 'Solve 1:-1', 'Solve 1:1.5', '#frame-count {broken',
    '#frame-count {"version":2,"times":[],"startFrameMethod":"fps"}\nSolve 1:'])('rejects damaged or unsupported files instead of silently replacing their data: %s', text => {
    expect(() => parseSplits(text)).toThrow();
  });

  it('excludes macOS auxiliary files', () => {
    expect(isVideoFileName('._1 2.51 WR.MP4')).toBe(false);
    expect(isVideoFileName('1 2.51 WR.MP4')).toBe(true);
    expect(isVideoFileName('1 2.51 WR.MP4.splits.txt')).toBe(false);
  });

  it('rejects another video with matching name, size and timestamp but different content', async () => {
    const file = (body: string, name = 'video.mp4', lastModified = 123) => new File([body], name, { lastModified });
    expect(await matchesVideoFile(file('abcd'), file('abcd'))).toBe(true);
    expect(await matchesVideoFile(file('abcd'), file('abce'))).toBe(false);
    expect(await matchesVideoFile(file('abcd'), file('abcd', 'other.mp4'))).toBe(false);
    expect(await matchesVideoFile(file('abcd'), file('abcd', 'video.mp4', 124))).toBe(false);
  });
});
