import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { PermEngineBinding } from '@/app/[lang]/sim/engine/permBinding';
import { ivyPermBridge, type IvyMove } from '@/app/[lang]/sim/engine/ivy/ivyPermBridge';
import { MOVE_CENTERS, solveIvy } from '@/lib/ivy-solver';

const SCRATCH =
  'C:/Users/CubeRoot/AppData/Local/Temp/claude/D--cube-cuberoot-me-core/8cfc6cbc-9406-42db-a3f9-539c5f8a1922/scratchpad/ivy_result.json';
const AXIS_LETTER = 'RLDB';

/** THREE-free port of IvyCube's discrete state (pivotAtFace + cornerTwist + complete). */
class IvyOracle {
  pivotAtFace = [0, 1, 2, 3, 4, 5];
  cornerTwist = [0, 0, 0, 0];
  apply(m: IvyMove): void {
    const [fa, fb, fd] = MOVE_CENTERS[m.axis];
    for (let t = 0; t < m.times; t++) {
      const oa = this.pivotAtFace[fa], ob = this.pivotAtFace[fb], od = this.pivotAtFace[fd];
      this.pivotAtFace[fb] = oa; this.pivotAtFace[fd] = ob; this.pivotAtFace[fa] = od;
    }
    this.cornerTwist[m.axis] = (this.cornerTwist[m.axis] + m.times) % 3;
  }
  get complete(): boolean {
    return this.pivotAtFace.every((v, i) => v === i) && this.cornerTwist.every((v) => v === 0);
  }
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomScramble(rng: () => number, len: number): IvyMove[] {
  const out: IvyMove[] = [];
  for (let i = 0; i < len; i++) {
    const axis = Math.floor(rng() * 4);
    const times = rng() < 0.5 ? 1 : 2;
    out.push({ axis, times, name: AXIS_LETTER[axis] + (times === 2 ? "'" : '') });
  }
  return out;
}

// /sim IvyMove -> cstimer token (cstimer bare = base twice = times2; primed = base once = times1).
const toCstimer = (m: IvyMove): string => AXIS_LETTER[m.axis] + (m.times === 2 ? '' : "'");
// cstimer token -> /sim IvyMove (inverse mapping).
function fromCstimer(tok: string): IvyMove {
  const axis = AXIS_LETTER.indexOf(tok[0].toUpperCase());
  const times = tok.length > 1 ? 1 : 2;
  return { axis, times, name: AXIS_LETTER[axis] + (times === 2 ? "'" : '') };
}

describe('ivy perm bridge', () => {
  const binding = new PermEngineBinding(ivyPermBridge);

  it('|G| = 29160, reassembly 58320, index 2', () => {
    const facts = binding.computeFactsLive();
    expect(binding.order).toBe(29160n);
    expect(facts.order).toBe(29160n);
    expect(facts.reassembly).toBe(58320n);
    expect(facts.index).toBe(2n);
    writeFileSync(
      SCRATCH,
      JSON.stringify(
        {
          puzzle: 'ivy',
          order: facts.order.toString(),
          reassembly: facts.reassembly.toString(),
          index: facts.index.toString(),
          orbits: facts.orbits,
          moveNames: facts.moveNames,
          solvable: binding.solvable,
          passed: true,
        },
        null,
        2,
      ),
    );
  });

  it('closed loop vs ported ivy oracle (40 scrambles)', () => {
    const rng = mulberry32(1234567);
    for (let s = 0; s < 40; s++) {
      const moves = randomScramble(rng, 8 + (s % 12));
      const oracle = new IvyOracle();
      moves.forEach((m) => oracle.apply(m));
      binding.rebuild(moves);
      expect(binding.solved).toBe(oracle.complete);

      const solution = binding.solveMoves();
      binding.rebuild(moves.concat(solution));
      expect(binding.solved).toBe(true);
      solution.forEach((m) => oracle.apply(m));
      expect(oracle.complete).toBe(true);
    }
  });

  it('cross-check vs ivy-solver BFS (independent solver, notation translated)', () => {
    const rng = mulberry32(987654321);
    for (let s = 0; s < 40; s++) {
      const moves = randomScramble(rng, 6 + (s % 10));
      const oracle = new IvyOracle();
      moves.forEach((m) => oracle.apply(m));
      const { solution } = solveIvy(moves.map(toCstimer).join(' '));
      const solMoves = solution ? solution.trim().split(/\s+/).map(fromCstimer) : [];
      solMoves.forEach((m) => oracle.apply(m));
      expect(oracle.complete).toBe(true);
    }
  });
});
