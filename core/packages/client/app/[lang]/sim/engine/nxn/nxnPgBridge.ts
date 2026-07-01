/**
 * NxNxN cube ↔ PuzzleGeometry move bridge factory for the general `PgEngineBinding`.
 *
 * Unlike the fixed puzzles this is PARAMETERISED by the order N: `nxnPgBridge(N)` builds
 * a bridge for that cube. The engine's move type is a single-slice quarter turn
 * (`NxnAtom`); `parse` decomposes any engine notation into these atoms (see nxnNotation),
 * so every user turn / scramble / alg mirrors into the group. Each atom maps 1:1 to one of
 * the 3N single-slice generators (`nxnPgSlices`).
 *
 * `solvable` only for 2x2 (|G| = 88,179,840 fixed in space — a real BSGS with words is
 * feasible → group-theory scramble/solve). For 3x3 and up |G| is astronomical
 * (3x3 ≈ 1.04×10²¹ fixed in space); like the helicopter cube it opts out of the
 * constructive BSGS but still mirrors live state + serves the (precomputed) facts.
 *
 * `factsOverEngineGens` — PG's default facts() misclassifies the bare single-letter face
 * moves ("R"/"U"/…) as whole-puzzle reorientations (its /^[A-Z]$/ turning-gen filter), so
 * facts are computed over the 3N single-slice generators instead (clean turningOrder ==
 * order, reorientations == 1). These facts are PRECOMPUTED offline (see pgFacts) — the
 * runtime never runs Schreier-Sims for them.
 *
 * The single global engine-dir ↔ PG-op sign (`GLOBAL_FLIP`) is pinned by the closed-loop
 * test (tests/nxn_pg_bridge.test.ts): scramble → mirror → BSGS solve → replay → solved.
 */
import type { MoveBridge } from '../pgBinding';
import type { PGOrbitsDef, PGTransform, PuzzleName } from '@/lib/puzzle-geometry';
import type { WordStep } from '../pgGroup';
import { notationToAtoms, type NxnAtom } from './nxnNotation';
import { buildEngineGens, sliceMoveNames } from './nxnPgSlices';

const POS = ['R', 'U', 'F'] as const;

/** The largest order with a group-theory kernel (a `pgPuzzle` entry + precomputed facts). */
export const NXN_PG_MAX = 7;
export const NXN_PG_MIN = 2;
export function nxnHasPgKernel(N: number): boolean {
  return Number.isInteger(N) && N >= NXN_PG_MIN && N <= NXN_PG_MAX;
}

// engine convert-twist +1 == "+positive-face rotational sense"; whether PG's op in that
// sense agrees with the engine is one global bit, pinned by the closed-loop test.
const GLOBAL_FLIP = false;

/** Merge a run of same-slice atoms and emit one replayable token. `k-kR` range form
 *  addresses a single layer unambiguously for any N; `net` is in convert-twist units. */
function emitToken(axis: 0 | 1 | 2, layer: number, net: number, N: number): string {
  const k = N - layer; // depthFromPos+1 counted from the positive face
  const suffix = net === 2 ? '2' : net === 3 ? "'" : '';
  return `${k}-${k}${POS[axis]}${suffix}`;
}

export function nxnPgBridge(N: number): MoveBridge<NxnAtom> {
  return {
    pgName: `${N}x${N}x${N}` as PuzzleName,
    solvable: N === 2,
    factsOverEngineGens: true,
    factsMoveNames: sliceMoveNames(N),
    engineGens(od: PGOrbitsDef): PGTransform[] {
      return buildEngineGens(od, N);
    },
    moveToStep(m: NxnAtom): WordStep {
      return { gi: m.axis * N + m.layer, inv: GLOBAL_FLIP ? m.dir === 1 : m.dir === -1 };
    },
    stepToMove(s: WordStep): NxnAtom {
      const axis = Math.floor(s.gi / N) as 0 | 1 | 2;
      const layer = s.gi % N;
      const dir: 1 | -1 = (GLOBAL_FLIP ? s.inv : !s.inv) ? 1 : -1;
      return { axis, layer, dir };
    },
    parse(text: string): NxnAtom[] {
      return notationToAtoms(text, N);
    },
    toString(atoms: NxnAtom[]): string {
      const out: string[] = [];
      let i = 0;
      while (i < atoms.length) {
        const { axis, layer } = atoms[i];
        let sum = 0;
        while (i < atoms.length && atoms[i].axis === axis && atoms[i].layer === layer) {
          sum += atoms[i].dir;
          i++;
        }
        const net = ((sum % 4) + 4) % 4;
        if (net !== 0) out.push(emitToken(axis, layer, net, N));
      }
      return out.join(' ');
    },
  };
}
