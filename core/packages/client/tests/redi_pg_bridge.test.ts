import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { PgEngineBinding } from '@/app/[lang]/sim/engine/pgBinding';
import { rediPgBridge } from '@/app/[lang]/sim/engine/redi/rediPgBridge';
import {
  solvedRedi, applyRediMove, isSolved, type RediMove, type RediState,
} from '@/app/[lang]/sim/engine/redi/rediState';

const OUT = 'C:/Users/CubeRoot/AppData/Local/Temp/claude/D--cube-cuberoot-me-core/8cfc6cbc-9406-42db-a3f9-539c5f8a1922/scratchpad/redi_result.json';

// Deterministic LCG (Numerical Recipes constants) — reproducible, never Math.random.
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// Random legal scramble: n twists, never the same corner twice in a row.
function scramble(rng: () => number, n: number): RediMove[] {
  const out: RediMove[] = [];
  let last = -1;
  for (let i = 0; i < n; i++) {
    let corner: number;
    do { corner = Math.floor(rng() * 8); } while (corner === last);
    last = corner;
    out.push({ corner, dir: rng() < 0.5 ? 1 : -1 });
  }
  return out;
}

const apply = (moves: RediMove[]): RediState => {
  let st = solvedRedi();
  for (const m of moves) st = applyRediMove(st, m);
  return st;
};

describe('Redi (compy cube) PG bridge — group + closed loop', () => {
  const t0 = Date.now();
  const binding = new PgEngineBinding(rediPgBridge);
  const order = binding.order; // forces the constructive BSGS build
  const buildMs = Date.now() - t0;

  it('|G| = 12!/2 · 3⁸ (physical Redi group), solvable, fast BSGS build', () => {
    expect(binding.solvable).toBe(true);
    expect(order).toBe(1571364748800n);
    expect(buildMs).toBeLessThan(10000);
  });

  it('facts() over the 8 real corner twists = |G| (deep 2X slices excluded), clean index', () => {
    const f = binding.facts();
    expect(f.order).toBe(1571364748800n);
    expect(f.reassembly % f.order).toBe(0n); // constraint index is a positive integer
    expect(f.index).toBeGreaterThan(0n);
    expect(f.moveNames.length).toBe(8);
  });

  it('binding.solved tracks the oracle + BSGS solve zeroes it (30 LCG scrambles)', () => {
    const rng = lcg(0xC0FFEE);
    let nonTrivial = 0;
    for (let t = 0; t < 30; t++) {
      const moves = scramble(rng, 12 + (t % 9));
      let st = apply(moves);
      binding.rebuild(moves);
      expect(binding.solved).toBe(isSolved(st));
      if (!isSolved(st)) nonTrivial++;
      for (const m of binding.solveMoves()) st = applyRediMove(st, m);
      expect(isSolved(st)).toBe(true);
    }
    expect(nonTrivial).toBeGreaterThan(27); // scrambles are essentially never trivial
  });

  it('random-STATE scramble is reached then undone (15 uniform BSGS states)', () => {
    let nonTrivial = 0;
    for (let t = 0; t < 15; t++) {
      const scr = binding.scrambleMoves();
      let st = apply(scr);
      if (!isSolved(st)) nonTrivial++;
      binding.rebuild(scr);
      for (const m of binding.solveMoves()) st = applyRediMove(st, m);
      expect(isSolved(st)).toBe(true);
    }
    expect(nonTrivial).toBeGreaterThan(13);
  });

  it('records the run for the integrator', () => {
    const f = binding.facts();
    writeFileSync(OUT, JSON.stringify({
      puzzle: 'redi',
      pgName: 'compy cube',
      order: order.toString(),
      factsOrder: f.order.toString(),
      index: f.index.toString(),
      reassembly: f.reassembly.toString(),
      turningOrder: f.turningOrder.toString(),
      reorientations: f.reorientations.toString(),
      orbits: f.orbits,
      moveNames: f.moveNames,
      solvable: binding.solvable,
      buildMs,
    }, null, 2));
    expect(true).toBe(true);
  });
});
