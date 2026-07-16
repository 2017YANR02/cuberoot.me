import { describe, it, expect } from 'vitest';
import {
  solvedGear, applyGearFlip, applyGearMove, isSolvedGear,
  parseGearMoves, gearMoveToString, gearMovesToString, invertGearMoves, reduceGearAlg,
  normalizeAmt, type GearPieceState, type GearMove,
} from '@/app/[lang]/sim/engine/gear/gearState';
import { GEAR_SOLVED, GEAR_TOTAL_STATES, gearApplyToken, solveGear, randomGearScramble, gearApply } from '@/lib/gear-solver';

function keyOf(st: GearPieceState): string {
  return `${st.cp.join('')}|${st.cent.join('')}|${st.ring.map((r) => r.join('')).join('.')}|${st.phase.join('')}`;
}
function solverKeyOf(s: ReadonlyArray<number>): number {
  return s[0] * 373248 + s[1] * 5184 + s[2] * 72 + s[3];
}

const ALL_TOKENS: string[] = [];
for (const f of ['U', 'R', 'F']) {
  for (const suf of ['', '2', '3', '4', '5', '6', "'", "2'", "3'", "4'", "5'"]) ALL_TOKENS.push(f + suf);
}

// Lockstep BFS: expand BOTH models from solved with the same generators (one CCW flip
// = solver token X'). Built once, shared by the tests below.
let BIJECTION: Map<string, number> | null = null;
function bijection(): Map<string, number> {
  if (BIJECTION) return BIJECTION;
  const myToSolver = new Map<string, number>();
  const solverSeen = new Set<number>();
  const gens: Array<{ face: number; token: string }> = [
    { face: 0, token: "U'" }, { face: 1, token: "R'" }, { face: 2, token: "F'" },
  ];
  let frontier: Array<{ my: GearPieceState; sv: number[] }> = [
    { my: solvedGear(), sv: [...GEAR_SOLVED] },
  ];
  myToSolver.set(keyOf(frontier[0].my), solverKeyOf(frontier[0].sv));
  solverSeen.add(solverKeyOf(frontier[0].sv));
  while (frontier.length) {
    const next: typeof frontier = [];
    for (const { my, sv } of frontier) {
      for (const g of gens) {
        const my2 = applyGearFlip(my, g.face, -1);
        const sv2 = gearApplyToken(sv, g.token);
        const mk = keyOf(my2);
        const sk = solverKeyOf(sv2);
        const prior = myToSolver.get(mk);
        if (prior !== undefined) {
          if (prior !== sk) throw new Error('same piece state reached two solver states');
          continue;
        }
        if (solverSeen.has(sk)) throw new Error('two piece states map to one solver state');
        myToSolver.set(mk, sk);
        solverSeen.add(sk);
        next.push({ my: my2, sv: sv2 });
      }
    }
    frontier = next;
  }
  BIJECTION = myToSolver;
  return myToSolver;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('gearState piece model (vs lib/gear-solver, the cstimer-bit-exact oracle)', () => {
  // If the piece model is a faithful — and exactly-as-fine — representation, the
  // lockstep visited maps form a bijection and the reachable count is Jaap's
  // 4!·(4·3)³ = 41,472. This also proves the centers are DETERMINED by
  // corners+rings on the URF subgroup (a coarser or finer model changes the count).
  it("lockstep BFS over U'/R'/F' is a 41,472-state bijection with the solver", () => {
    expect(bijection().size).toBe(GEAR_TOTAL_STATES);
  });

  // Every one of the 33 solver tokens must act on my piece model exactly as it acts
  // on the solver state, under the BFS-established identification.
  it('all 33 tokens agree between the models on random reachable states', () => {
    const map = bijection();
    const rand = mulberry32(0x6ea2);
    for (let trial = 0; trial < 30; trial++) {
      let my = solvedGear();
      let sv: number[] = [...GEAR_SOLVED];
      const len = Math.floor(rand() * 12);
      for (let i = 0; i < len; i++) {
        const t = ALL_TOKENS[Math.floor(rand() * ALL_TOKENS.length)];
        my = applyGearMove(my, parseGearMoves(t)[0]);
        sv = gearApplyToken(sv, t);
      }
      for (const t of ALL_TOKENS) {
        const myAfter = applyGearMove(my, parseGearMoves(t)[0]);
        const svAfter = gearApplyToken(sv, t);
        expect(map.get(keyOf(myAfter))).toBe(solverKeyOf(svAfter));
      }
    }
  });

  it('optimal solutions from lib/gear-solver solve the piece model (100 random scrambles)', () => {
    for (let i = 0; i < 100; i++) {
      const scramble = randomGearScramble();
      const { solution } = solveGear(scramble);
      let st = solvedGear();
      for (const m of parseGearMoves(scramble + ' ' + solution)) st = applyGearMove(st, m);
      expect(keyOf(st)).toBe(keyOf(solvedGear()));
      expect(isSolvedGear(st)).toBe(true);
      expect(solverKeyOf(gearApply(scramble))).not.toBe(solverKeyOf([...GEAR_SOLVED]));
    }
  });

  it('single-move periods: corners 2, centers 4, gear phase 3, whole move 12', () => {
    let st = solvedGear();
    for (let k = 1; k <= 12; k++) {
      st = applyGearFlip(st, 0, 1);
      expect(st.cp.every((p, i) => p === i)).toBe(k % 2 === 0);
      expect(st.cent.every((p, i) => p === i)).toBe(k % 4 === 0);
      expect(st.phase.every((p) => p === 0)).toBe(k % 3 === 0);
      if (k < 12) expect(keyOf(st)).not.toBe(keyOf(solvedGear()));
    }
    expect(keyOf(st)).toBe(keyOf(solvedGear()));
  });

  it("U D' is a pure whole-cube rotation: solved-up-to-rotation but not exact", () => {
    let st = solvedGear();
    st = applyGearMove(st, { face: 0, amt: 1 });
    expect(isSolvedGear(st)).toBe(false);
    st = applyGearMove(st, { face: 3, amt: -1 });
    expect(keyOf(st)).not.toBe(keyOf(solvedGear()));
    expect(isSolvedGear(st)).toBe(true);
    expect(st.phase).toEqual([0, 0, 0]);
  });

  it('notation round-trips + normalization', () => {
    expect(gearMovesToString(parseGearMoves("U U2 U3' F5 R6 B2' L D'"))).toBe("U U2 U3' F5 R6 B2' L D'");
    expect(gearMoveToString({ face: 0, amt: 7 })).toBe("U5'");   // 7 ≡ −5 (mod 12)
    expect(gearMoveToString({ face: 0, amt: -6 })).toBe('U6');   // ±6 coincide
    expect(normalizeAmt(12)).toBe(0);
    expect(parseGearMoves('U0 U7 xyz U')).toHaveLength(1);       // junk skipped, no throw
    const moves: GearMove[] = parseGearMoves("U2 R' F3");
    expect(gearMovesToString(invertGearMoves(moves))).toBe("F3' R U2'");
    expect(reduceGearAlg('U U')).toBe('U2');
    expect(reduceGearAlg("U U'")).toBe('');
    expect(reduceGearAlg('U3 U3')).toBe('U6');
    expect(reduceGearAlg('U6 U6')).toBe('');
    expect(reduceGearAlg('U4 U4')).toBe("U4'"); // 8 ≡ −4
  });

  it('inverse composition really inverts on the piece model (all 6 faces)', () => {
    const rand = mulberry32(0xbeef);
    for (let trial = 0; trial < 50; trial++) {
      const moves: GearMove[] = [];
      for (let i = 0; i < 8; i++) {
        moves.push({ face: Math.floor(rand() * 6), amt: normalizeAmt(1 + Math.floor(rand() * 11)) || 1 });
      }
      let st = solvedGear();
      for (const m of moves) st = applyGearMove(st, m);
      for (const m of invertGearMoves(moves)) st = applyGearMove(st, m);
      expect(keyOf(st)).toBe(keyOf(solvedGear()));
    }
  });
});
