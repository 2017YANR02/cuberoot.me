import { it, expect } from 'vitest';

import { parseSolveTimeFromFilename } from './useFrameCount';

it('parses solve time from typical cubing filenames (truncated to centiseconds)', () => {
  expect(parseSolveTimeFromFilename('1 0.688.mp4')).toBe(0.68); // WCA-truncated, not rounded
  expect(parseSolveTimeFromFilename('2 1.07.mp4')).toBe(1.07);
  expect(parseSolveTimeFromFilename('2x2 R1 1.07 avg.mp4')).toBe(1.07);
  expect(parseSolveTimeFromFilename('solve 12.349.mov')).toBe(12.34);
  expect(parseSolveTimeFromFilename('5 1:23.459.mp4')).toBe(83.45); // mm:ss takes priority, also truncated
});

it('handles paths with directories and odd extensions', () => {
  expect(parseSolveTimeFromFilename('Z:/cubing/260523 Liuzhou Open 2026/2x2 R1 1.07 avg.mp4')).toBe(1.07);
  expect(parseSolveTimeFromFilename(String.raw`C:\videos\1 0.688.mp4`)).toBe(0.68);
  expect(parseSolveTimeFromFilename('clip-3.149.mkv')).toBe(3.14);
});

it('returns undefined when no time-like number present', () => {
  expect(parseSolveTimeFromFilename('IMG_0123.mp4')).toBeUndefined();
  expect(parseSolveTimeFromFilename('untitled.mp4')).toBeUndefined();
  expect(parseSolveTimeFromFilename('.hidden')).toBeUndefined();
});

it('rejects out-of-range values', () => {
  expect(parseSolveTimeFromFilename('5000.00.mp4')).toBeUndefined();
  expect(parseSolveTimeFromFilename('0.0.mp4')).toBeUndefined();
});
