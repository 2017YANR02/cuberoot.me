/*
 * cross-trainer perf budget — the whole point of building our own generator is to beat the
 * vendored or18 trainers, which pay ~1.4 s (cross) / ~13.7 s (xcross, ~630 MB) of table
 * construction before the first scramble. Measured idle here: 285 ms and 1875 ms.
 *
 * The budgets below are reference-box milliseconds scaled by ./_perf_scale — running the whole
 * suite is ~4x slower than running this file alone, and a fixed budget would only measure how
 * busy the machine is.
 */

import { describe, expect, it } from 'vitest';
import { crossHistogram } from '@/lib/cross-trainer/dist';
import { sampleCrossState } from '@/lib/cross-trainer/sample';
import { COLOR_FACE } from '@/lib/cross-trainer/model';
import { frameData, sampleXCoord, type Frame } from '@/lib/cross-trainer/xcross';
import { perfScale } from './_perf_scale';

const log = (s: string) => process.stdout.write(`${s}\n`);

describe('cross-trainer / perf', () => {
  it('cross tables build fast and sampling is sub-millisecond', () => {
    const scale = perfScale();
    const t0 = Date.now();
    crossHistogram(COLOR_FACE.Yellow);
    const build = Date.now() - t0;

    const t1 = Date.now();
    const N = 2000;
    for (let i = 0; i < N; i++) sampleCrossState({ faces: [COLOR_FACE.Yellow], lo: 5, hi: 6 });
    const per = (Date.now() - t1) / N;

    const t2 = Date.now();
    for (let i = 0; i < 200; i++) {
      sampleCrossState({ faces: [0, 1, 2, 3, 4, 5], lo: 7, hi: 7 });  // rarest six-colour bin
    }
    const perRare = (Date.now() - t2) / 200;

    log(`[perf] cross: tables ${build} ms · fixed draw ${per.toFixed(3)} ms · six-colour d=7 draw ${perRare.toFixed(2)} ms (scale ${scale.toFixed(1)})`);
    expect(build).toBeLessThan(1000 * scale);
    expect(per).toBeLessThan(0.1 * scale);
    expect(perRare).toBeLessThan(20 * scale);
  }, 120_000);

  it('xcross tables build in seconds, not tens of seconds', () => {
    const scale = perfScale();
    const frame: Frame = { face: COLOR_FACE.Yellow, slot: 2 };
    const t0 = Date.now();
    frameData(frame);
    const build = Date.now() - t0;

    const runs: Array<[number, number]> = [];
    for (const d of [4, 6, 7, 8, 9, 10]) {
      const t = Date.now();
      const n = d >= 6 && d <= 9 ? 50 : 5;
      for (let i = 0; i < n; i++) expect(sampleXCoord(frame, d, d, Math.random)!.depth).toBe(d);
      runs.push([d, (Date.now() - t) / n]);
    }
    log(`[perf] xcross: tables ${build} ms · ${runs.map(([d, ms]) => `d${d} ${ms.toFixed(1)}ms`).join(' · ')} (scale ${scale.toFixed(1)})`);
    expect(build).toBeLessThan(4000 * scale);   // or18 pays 13,743 ms for the same thing
  }, 300_000);
});
