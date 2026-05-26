/**
 * Cross solver — BFS over a 12-edge cubie state, restricted to the 4 edges
 * incident to the chosen "cross face". Returns the optimal solution for each
 * of the 6 face orientations.
 *
 * Edge indexing (matches cstimer convention):
 *   0:UF  1:UL  2:UB  3:UR
 *   4:FL  5:BL  6:BR  7:FR
 *   8:DF  9:DL 10:DB 11:DR
 *
 * State `ea[12]` holds at slot i: (cubieIdx << 1) | ori. ori XOR 1 = flipped
 * relative to U/D-good convention. F and B turns flip; U/D/L/R don't.
 *
 * Moves m=0..5 are F, R, U, B, L, D. Each is applied with amount 1, 2, or 3.
 * That gives 18 single moves; we use the standard "no same face twice in a
 * row" reduction to prune the BFS branching factor.
 */

import { parseScramble } from '../cube/moves';
import type { Face, ParsedMove } from '../cube/moves';

export type Orientation = 'D' | 'U' | 'F' | 'B' | 'L' | 'R';

export interface CrossSolution {
  orientation: Orientation;
  moves: string;
  length: number;
}

// 4 edges incident to each face.
const TARGETS: Record<Orientation, [number, number, number, number]> = {
  D: [8, 9, 10, 11],   // DF DL DB DR
  U: [0, 1, 2, 3],     // UF UL UB UR
  F: [0, 7, 8, 4],     // UF FR DF FL
  B: [2, 5, 10, 6],    // UB BL DB BR
  L: [1, 4, 9, 5],     // UL FL DL BL
  R: [3, 7, 11, 6],    // UR FR DR BR
};

type EdgeState = number[]; // length 12

function solvedEdges(): EdgeState {
  const e: number[] = [];
  for (let i = 0; i < 12; i++) e.push(i << 1);
  return e;
}

// Cycle 4 slots (a → b → c → d → a) with optional ori flip on each.
function cycle4(ea: EdgeState, a: number, b: number, c: number, d: number, flip: 0 | 1): void {
  const tmp = ea[a];
  const f = flip;
  ea[a] = ea[d] ^ f;
  ea[d] = ea[c] ^ f;
  ea[c] = ea[b] ^ f;
  ea[b] = tmp ^ f;
}

// One quarter-turn: m = 0..5 = F R U B L D.
function edgeMove(ea: EdgeState, m: number): void {
  switch (m) {
    case 0: cycle4(ea, 0, 7, 8, 4, 1); return; // F
    case 1: cycle4(ea, 3, 6, 11, 7, 0); return; // R
    case 2: cycle4(ea, 0, 1, 2, 3, 0); return; // U
    case 3: cycle4(ea, 2, 5, 10, 6, 1); return; // B
    case 4: cycle4(ea, 1, 4, 9, 5, 0); return; // L
    case 5: cycle4(ea, 11, 10, 9, 8, 0); return; // D
  }
}

// Apply N full quarter-turns of a face (1, 2, or 3).
export function applyMoveN(ea: EdgeState, m: number, count: number): void {
  for (let i = 0; i < count; i++) edgeMove(ea, m);
}

const FACE_TO_M: Record<Face, number> = {
  F: 0, R: 1, U: 2, B: 3, L: 4, D: 5,
};
const M_TO_FACE: Face[] = ['F', 'R', 'U', 'B', 'L', 'D'];

// Convert ParsedMove to a sequence of basic m+count operations. Wide moves /
// rotations / slices are ignored for the cross-state purposes if we wanted
// to keep the cube oriented; but scrambles only use face turns so we can
// accept just face-only and 180. For wide / rotation we apply best-effort by
// skipping them (cross solver inputs are scrambles with only face turns).
function applyParsedToEdges(ea: EdgeState, moves: ParsedMove[]): void {
  for (const mv of moves) {
    if (mv.isRotation || mv.layers !== 1) continue; // skip slices/wides/rotations
    const m = FACE_TO_M[mv.face];
    const count = mv.amount === 1 ? 1 : mv.amount === -1 ? 3 : 2;
    applyMoveN(ea, m, count);
  }
}

// Encode 4 target edges' (slot, ori) into a 20-bit key.
function encodeKey(ea: EdgeState, targets: readonly number[]): number {
  let key = 0;
  for (let t = 0; t < 4; t++) {
    const cubie = targets[t];
    let slot = -1, ori = 0;
    for (let i = 0; i < 12; i++) {
      if ((ea[i] >> 1) === cubie) {
        slot = i;
        ori = ea[i] & 1;
        break;
      }
    }
    key = key * 24 + slot * 2 + ori;
  }
  return key;
}

function isGoal(ea: EdgeState, targets: readonly number[]): boolean {
  for (const t of targets) if (ea[t] !== (t << 1)) return false;
  return true;
}

interface ParentEntry {
  parent: number; // key
  m: number;      // 0..5 face
  count: number;  // 1..3
}

function formatMove(m: number, count: number): string {
  const f = M_TO_FACE[m];
  if (count === 1) return f;
  if (count === 2) return f + '2';
  return f + "'";
}

const MAX_DEPTH = 8;

function bfsCross(start: EdgeState, targets: readonly number[]): string[] | null {
  if (isGoal(start, targets)) return [];

  const startKey = encodeKey(start, targets);
  const parents = new Map<number, ParentEntry>();
  const states = new Map<number, EdgeState>();
  parents.set(startKey, { parent: -1, m: -1, count: 0 });
  states.set(startKey, start);

  let frontier: number[] = [startKey];
  let depth = 0;

  while (frontier.length && depth < MAX_DEPTH) {
    depth++;
    const next: number[] = [];
    for (const key of frontier) {
      const cur = states.get(key)!;
      const lastEntry = parents.get(key)!;
      const lastM = lastEntry.m;

      for (let m = 0; m < 6; m++) {
        if (m === lastM) continue;
        // Don't repeat opposite-axis moves redundantly: e.g. after F, allow B
        // but require canonical order (m > lastM on same axis pair).
        // Axis pairs: (F=0,B=3), (R=1,L=4), (U=2,D=5).
        if (lastM >= 0) {
          const lastAxis = lastM % 3;
          const curAxis = m % 3;
          if (lastAxis === curAxis && m < lastM) continue;
        }
        for (let count = 1; count <= 3; count++) {
          const nea = cur.slice();
          applyMoveN(nea, m, count);
          const nkey = encodeKey(nea, targets);
          if (parents.has(nkey)) continue;
          parents.set(nkey, { parent: key, m, count });
          states.set(nkey, nea);
          if (isGoal(nea, targets)) {
            // Trace back.
            const seq: string[] = [];
            let k = nkey;
            while (true) {
              const e = parents.get(k)!;
              if (e.parent < 0) break;
              seq.push(formatMove(e.m, e.count));
              k = e.parent;
            }
            seq.reverse();
            return seq;
          }
          next.push(nkey);
        }
      }
    }
    frontier = next;
  }
  return null;
}

/** Solve cross for all 6 orientations. */
export function solveCross(scramble: string): CrossSolution[] {
  const moves = parseScramble(scramble);
  const out: CrossSolution[] = [];
  const orientations: Orientation[] = ['D', 'U', 'F', 'B', 'L', 'R'];
  for (const o of orientations) {
    const ea = solvedEdges();
    applyParsedToEdges(ea, moves);
    const sol = bfsCross(ea, TARGETS[o]);
    if (sol == null) {
      out.push({ orientation: o, moves: '—', length: -1 });
    } else {
      out.push({ orientation: o, moves: sol.join(' '), length: sol.length });
    }
  }
  out.sort((a, b) => {
    if (a.length < 0) return 1;
    if (b.length < 0) return -1;
    return a.length - b.length;
  });
  return out;
}
