/*
 * Perf gates that survive a loaded machine.
 *
 * The cross-trainer budgets exist to prove we beat the vendored or18 trainers, so they have to
 * stay tight — but the full suite runs 14 workers and inflates every wall-clock measurement, which
 * made them pass alone and fail in `pnpm test`. So a budget is written as "ms on an idle box" and
 * multiplied by how slow a fixed workload runs RIGHT NOW.
 *
 * The workload has to be the same KIND of work, not just work: building a coordinate table is
 * random access over megabytes, and under 14 workers that degrades ~5x while a pure-ALU loop
 * degrades only ~1.5x (measured). A tight arithmetic loop as the yardstick would report scale 1.5
 * for a 5x-slower machine — which is exactly the false failure this file exists to prevent.
 */

const SIZE = 1 << 23;                 // 8 MB — past L2, like the trainer's tables
const MASK = SIZE - 1;
const buf = new Uint8Array(SIZE);
for (let i = 0; i < SIZE; i++) buf[i] = i & 255;

/** 2M pseudo-random reads + writes over the buffer: memory-latency bound, like a BFS. */
function loop(n: number): number {
  let i = 1, s = 0;
  for (let k = 0; k < n; k++) {
    i = (i * 1664525 + 1013904223) >>> 0;
    s += buf[i & MASK];
    buf[(i >>> 7) & MASK] = s & 255;
  }
  return s;
}

const OPS = 2e6;
/** ms for OPS, idle, node 22 — the box the budgets were measured on (18–25 ms; ~100 under load). */
const REF_MS = 20;

/** ≥1: multiply an idle-box budget by this. Never tightens a budget, only loosens it. */
export function perfScale(): number {
  loop(OPS); // tier the loop up first — cold V8 reports several times slower
  const t = Date.now();
  loop(OPS);
  return Math.max(1, (Date.now() - t) / REF_MS);
}
