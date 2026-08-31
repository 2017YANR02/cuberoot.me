import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const timerUiEntry = new URL(import.meta.resolve('@cuberoot/timer-ui'));
const scrambleCss = readFileSync(new URL('./scramble-strip.css', timerUiEntry), 'utf8');
const liberationMono = readFileSync(
  new URL('../public/fonts/LiberationMono-Regular.ttf', import.meta.url),
);

describe('Mobile timer packaged assets', () => {
  it('packages the exact offline font requested by the shared scramble strip', () => {
    expect(scrambleCss).toContain("url('/fonts/LiberationMono-Regular.ttf')");
    expect(liberationMono.byteLength).toBe(108_492);
    expect([...liberationMono.subarray(0, 4)]).toEqual([0, 1, 0, 0]);
  });
});
