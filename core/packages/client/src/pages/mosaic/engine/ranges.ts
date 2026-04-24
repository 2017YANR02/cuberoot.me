import type { RGB } from '../state/types';

/** Uniform range of N border values spread over (0..255). */
export function createUniformRange(numBorders: number, scatter: number, position: number): number[] {
  const rangeLength = 255 * scatter;
  const distance = rangeLength / (numBorders - 1);
  const x0 = (255 - rangeLength) * position;
  const out: number[] = [];
  for (let i = 0; i < numBorders; i++) out.push(Math.round(x0 + i * distance));
  return out;
}

/** For each (position, scatter) pair, produce one uniform range. */
export function initialRangePopulation(palette: RGB[], positions: number[], scatters: number[]): number[][] {
  const out: number[][] = [];
  for (const p of positions) for (const s of scatters) {
    out.push(createUniformRange(palette.length - 1, s, p));
  }
  return out;
}

/** Given a selected gradient range, return neighbouring variations (shrink/shift/handle wiggle). */
export function populateSetOfRanges(range: number[]): number[][] {
  const changes: Array<[number, number]> = [
    [1.1, -0.1], [1.1, 0],
    [1.0, -0.15], [1.0, 0.15],
    [0.9, -0.1], [0.9, 0], [0.9, 0.1], [0.9, 0.2],
  ];
  const x0 = range[0];
  const len = range[range.length - 1] - x0;

  const out: number[][] = [];
  for (const [scale, shiftFrac] of changes) {
    out.push(range.map(x => x0 + (x - x0) * scale + shiftFrac * len));
  }
  // Shift mid-handles back and forth.
  for (let i = 1; i < range.length - 1; i++) {
    const l = range.slice();
    l[i] -= (l[i] - l[i - 1]) / 3;
    const r = range.slice();
    r[i] += (r[i + 1] - r[i]) / 3;
    out.push(l, r);
  }
  out.sort((a, b) => a[a.length - 1] - b[b.length - 1]);
  return out;
}

/** For dither methods: given selected ratio `opt`, neighbouring variations. */
export function populateScalarOpts(allOpts: number[], opt: number, nonNegative: boolean): number[] {
  const rightShift = 2;
  const amount = 4;
  const idx = allOpts.indexOf(opt);
  let min = idx <= 0 ? allOpts[0] - rightShift : allOpts[idx - 1];
  if (nonNegative && min < 0) min = 0;
  const max = idx === allOpts.length - 1 ? opt + rightShift : allOpts[idx + 1];
  const start = min + (max - min) / (amount + 1);
  const step = (max - min) / amount;

  const out: number[] = [];
  for (let o = start; o < max; o += step) out.push(o);
  return out;
}
