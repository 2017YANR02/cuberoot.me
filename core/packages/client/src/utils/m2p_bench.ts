// Debug-only A/B benchmark: cubing.js (default 3x3 scrambler) vs min2phase-rust.
// Lives in src/ so Vite can resolve `cubing/scramble`. Not imported from any
// production page — invoke via playwright or console: `window.runM2pBench(100)`.

import { randomScrambleForEvent } from 'cubing/scramble';
import { m2pScramble333 } from './m2p_scramble';

interface Stats { avg: number; p50: number; p95: number; max: number; min: number }

function stats(arr: number[]): Stats {
  const s = [...arr].sort((a, b) => a - b);
  return {
    avg: +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2),
    p50: +s[Math.floor(arr.length * 0.5)].toFixed(2),
    p95: +s[Math.floor(arr.length * 0.95)].toFixed(2),
    max: +s[arr.length - 1].toFixed(2),
    min: +s[0].toFixed(2),
  };
}

function lenHist(arr: number[]): string {
  const h: Record<number, number> = {};
  for (const l of arr) h[l] = (h[l] || 0) + 1;
  return Object.entries(h)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([k, v]) => `${k}:${v}`)
    .join(' ');
}

export async function runM2pBench(N = 100) {
  const warmup: string[] = [];

  const wt0 = performance.now();
  await randomScrambleForEvent('333');
  warmup.push(`cubing.js warm: ${(performance.now() - wt0).toFixed(0)} ms`);

  const wt1 = performance.now();
  await m2pScramble333();
  warmup.push(`m2p-rust warm: ${(performance.now() - wt1).toFixed(0)} ms`);

  // A few extra warm calls so JIT / cache / prefetch settles for both
  for (let i = 0; i < 5; i++) {
    await randomScrambleForEvent('333');
    await m2pScramble333();
  }

  const cubingTimes: number[] = [];
  const m2pTimes: number[] = [];
  const cubingLens: number[] = [];
  const m2pLens: number[] = [];

  for (let i = 0; i < N; i++) {
    const tc = performance.now();
    const ca = await randomScrambleForEvent('333');
    cubingTimes.push(performance.now() - tc);
    cubingLens.push(String(ca).trim().split(/\s+/).length);

    const tm = performance.now();
    const ma = await m2pScramble333();
    m2pTimes.push(performance.now() - tm);
    m2pLens.push(ma.split(/\s+/).length);
  }

  const cs = stats(cubingTimes);
  const ms = stats(m2pTimes);

  return {
    warmup,
    n: N,
    cubing: { ...cs, avgLen: +(cubingLens.reduce((a, b) => a + b, 0) / N).toFixed(3), hist: lenHist(cubingLens) },
    m2p:    { ...ms, avgLen: +(m2pLens.reduce((a, b) => a + b, 0) / N).toFixed(3),    hist: lenHist(m2pLens) },
    speedup: {
      avg: +(cs.avg / ms.avg).toFixed(2),
      p50: +(cs.p50 / ms.p50).toFixed(2),
      p95: +(cs.p95 / ms.p95).toFixed(2),
    },
  };
}

// Expose for playwright / console testing.
if (typeof window !== 'undefined') {
  (window as unknown as { runM2pBench: typeof runM2pBench }).runM2pBench = runM2pBench;
}
