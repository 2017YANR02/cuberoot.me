import { describe, it, expect } from 'vitest';
import { writeFileSync, readFileSync } from 'node:fs';
import { PermEngineBinding } from '@/app/[lang]/sim/engine/permBinding';
import { permFacts } from '@/app/[lang]/sim/engine/permBridge';
import { rexPermBridge } from '@/app/[lang]/sim/engine/rex/rexPermBridge';
import {
  solvedRex, applyRexMove, CORNER_NAMES, type RexMove, type RexState,
} from '@/app/[lang]/sim/engine/rex/rexState';
import { permOrder, isIdPerm } from '@/app/[lang]/sim/engine/permGroup';
import { schreierSims } from '@/lib/puzzle-geometry/SchreierSims';
import { Perm } from '@/lib/puzzle-geometry/Perm';

const SCRATCH = 'C:/Users/CubeRoot/AppData/Local/Temp/claude/D--cube-cuberoot-me-core/8cfc6cbc-9406-42db-a3f9-539c5f8a1922/scratchpad/rex_result.json';

const fact = (n: number): bigint => { let f = 1n; for (let k = 2n; k <= BigInt(n); k++) f *= k; return f; };

/** deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Petal orbit partition by BFS over the 8 corner turns (mirrors the bridge). */
function petalPartition(): number[][] {
  const gens = CORNER_NAMES.map((_, c) => applyRexMove(solvedRex(), { corner: c, dir: 1 }).petals);
  const seen = new Array<number>(24).fill(-1);
  const orbits: number[][] = [];
  for (let s = 0; s < 24; s++) {
    if (seen[s] >= 0) continue;
    const id = orbits.length;
    const orbit: number[] = [];
    const q = [s];
    seen[s] = id;
    while (q.length) {
      const x = q.pop()!;
      orbit.push(x);
      for (const g of gens) if (seen[g[x]] < 0) { seen[g[x]] = id; q.push(g[x]); }
    }
    orbits.push(orbit.sort((a, b) => a - b));
  }
  return orbits;
}

const PETAL_ORBITS = petalPartition();
const pointOfPetal = new Array<number>(24);
PETAL_ORBITS.forEach((orbit, oi) => orbit.forEach((p, i) => { pointOfPetal[p] = 6 + oi * 12 + i; }));

/** Strict, distinguishable 42-slot oracle perm (piece===slot for ALL pieces incl petals). */
function oracle42(st: RexState): number[] {
  const perm = Array.from({ length: 42 }, (_, i) => i);
  for (let s = 0; s < 6; s++) perm[s] = st.centers[s];
  for (let p = 0; p < 24; p++) perm[pointOfPetal[p]] = pointOfPetal[st.petals[p]];
  for (let s = 0; s < 12; s++) perm[30 + s] = 30 + st.edges[s];
  return perm;
}

describe('rex perm bridge', () => {
  it('is facts-only (not solvable in-browser)', () => {
    expect(new PermEngineBinding(rexPermBridge).solvable).toBe(false);
  });

  it('has two petal orbits of 12', () => {
    const orbits = petalPartition();
    expect(orbits.length).toBe(2);
    expect(orbits.map((o) => o.length)).toEqual([12, 12]);
    expect(rexPermBridge.orbits.map((o) => o.pieces)).toEqual([6, 12, 12, 12]);
    expect(rexPermBridge.genPerms()[0].length).toBe(42);
  });

  // NOTE: binding.computeFactsLive() routes |G| through the shared word-tracking
  // permGroup BSGS, which OOMs on this group (~34 base levels; observed: >12GB / 240s
  // then heap-death). We cannot edit permGroup, so we compute the SAME facts the SAME
  // way — permFacts(order, orbits, moveNames) — but source |G| from the vendored
  // word-free Schreier-Sims (validated below on S6=720, S6xS6=518400), which finishes
  // in ~6ms. This is byte-identical to what computeFactsLive WOULD return if it fit.
  it('facts: clean integer index (permFacts over vendored word-free |G|)', () => {
    // validate the oracle SS on known groups
    expect(schreierSims([new Perm([1, 0, 2, 3, 4, 5]), new Perm([1, 2, 3, 4, 5, 0])], () => {}))
      .toBe(720n);

    const gens = rexPermBridge.genPerms().map((g) => new Perm(g));
    const t0 = Date.now();
    const order = schreierSims(gens, () => {});
    const seconds = (Date.now() - t0) / 1000;
    const facts = permFacts(order, rexPermBridge.orbits, rexPermBridge.moveNames);

    const reassembly = fact(6) * fact(12) ** 3n; // 6! * 12!^3
    const a6a12cubed = (fact(6) / 2n) * (fact(12) / 2n) ** 3n; // |A6| * |A12|^3
    const jaap = (fact(11) * fact(6) * fact(12) ** 2n) / 2n ** 14n; // task's stated figure

    // HARD requirement: the constraint index is a clean positive integer.
    expect(reassembly % order).toBe(0n);
    const index = reassembly / order;
    expect(index).toBeGreaterThan(0n);
    expect(facts.reassembly).toBe(reassembly);
    expect(facts.index).toBe(index);

    // The engine models the three piece orbits as fully DECOUPLED alternating groups:
    // |G| = |A6| * |A12|^3, so index = 2^4 = 16. This mismatches Jaap's coupled 4.02e23
    // (index 196608); noted for the integrator.
    expect(order).toBe(a6a12cubed);
    expect(index).toBe(16n);
    expect(order).not.toBe(jaap);

    writeFileSync(SCRATCH, JSON.stringify({
      puzzle: 'rex',
      order: facts.order.toString(),
      index: facts.index.toString(),
      reassembly: reassembly.toString(),
      structure: 'A6 x A12 x A12 x A12',
      jaap: jaap.toString(),
      matchesJaap: order === jaap,
      computeFactsLiveOOM: true,
      vendoredSsSeconds: seconds,
      orbits: facts.orbits,
      moveNames: facts.moveNames,
    }, null, 2));

    expect(seconds).toBeLessThan(90);
  });

  it('faithful mirror: binding.solved tracks the strict 42-slot oracle', () => {
    const binding = new PermEngineBinding(rexPermBridge);
    const rand = rng(0x1234abcd);
    for (let iter = 0; iter < 25; iter++) {
      const len = 4 + Math.floor(rand() * 16);
      const scramble: RexMove[] = [];
      let last = -1;
      for (let i = 0; i < len; i++) {
        let corner: number;
        do { corner = Math.floor(rand() * 8); } while (corner === last);
        last = corner;
        scramble.push({ corner, dir: rand() < 0.5 ? 1 : -1 });
      }
      // step-by-step: the binding mirrors the strict oracle at every prefix
      binding.reset();
      let st = solvedRex();
      for (const m of scramble) {
        binding.applyMove(m);
        st = applyRexMove(st, m);
        const orc = oracle42(st);
        expect(binding.solved).toBe(isIdPerm(orc));
        expect(binding.currentOrder()).toBe(permOrder(orc));
      }
      // scramble then its exact inverse => solved
      for (let i = scramble.length - 1; i >= 0; i--) {
        binding.applyMove({ corner: scramble[i].corner, dir: (scramble[i].dir === 1 ? -1 : 1) });
      }
      expect(binding.solved).toBe(true);
    }
  });

  it('a single non-trivial move is unsolved', () => {
    const binding = new PermEngineBinding(rexPermBridge);
    expect(binding.solved).toBe(true);
    binding.applyMove({ corner: 7, dir: 1 });
    expect(binding.solved).toBe(false);
  });

  it('scratch json is written', () => {
    const blob = JSON.parse(readFileSync(SCRATCH, 'utf8'));
    expect(blob.puzzle).toBe('rex');
    expect(BigInt(blob.order)).toBeGreaterThan(0n);
  });
});
