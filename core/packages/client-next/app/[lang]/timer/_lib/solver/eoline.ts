/**
 * EOLine solver — finds the shortest sequence of face-turns that orients all
 * 12 edges (cstimer EO convention: F/B flip, U/D/L/R don't) and additionally
 * places DF and DB at their home slots (slot 8 and 10 respectively).
 *
 * State space size:
 *   - 2^12 = 4096 EO patterns (only 2^11 reachable, EO parity invariant).
 *   - 12 * 11 = 132 ordered (DF-slot, DB-slot) pairs.
 *   total ≈ 540k — BFS visits ≤ this many nodes, doable in <100ms in JS.
 *
 * BFS uses key = (eoBits << 8) | (dfSlot << 4) | dbSlot. We track the full
 * 12-edge state during expansion (for accurate move application) but key
 * only on the reduced view.
 */

import { parseScramble } from '../cube/moves';
import type { Face, ParsedMove } from '../cube/moves';

// Reuse the edge primitives by re-defining (kept self-contained per file
// for clarity — same conventions as cross.ts).

type EdgeState = number[]; // length 12

const DF_CUBIE = 8;
const DB_CUBIE = 10;

function solvedEdges(): EdgeState {
  const e: number[] = [];
  for (let i = 0; i < 12; i++) e.push(i << 1);
  return e;
}

function cycle4(ea: EdgeState, a: number, b: number, c: number, d: number, flip: 0 | 1): void {
  const tmp = ea[a];
  ea[a] = ea[d] ^ flip;
  ea[d] = ea[c] ^ flip;
  ea[c] = ea[b] ^ flip;
  ea[b] = tmp ^ flip;
}

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

function applyMoveN(ea: EdgeState, m: number, count: number): void {
  for (let i = 0; i < count; i++) edgeMove(ea, m);
}

const FACE_TO_M: Record<Face, number> = {
  F: 0, R: 1, U: 2, B: 3, L: 4, D: 5,
};
const M_TO_FACE: Face[] = ['F', 'R', 'U', 'B', 'L', 'D'];

function applyParsedToEdges(ea: EdgeState, moves: ParsedMove[]): void {
  for (const mv of moves) {
    if (mv.isRotation || mv.layers !== 1) continue;
    const m = FACE_TO_M[mv.face];
    const count = mv.amount === 1 ? 1 : mv.amount === -1 ? 3 : 2;
    applyMoveN(ea, m, count);
  }
}

// Key: 12 EO bits (one per slot in slot-order) | DF-slot (4 bits) | DB-slot (4 bits).
function encodeKey(ea: EdgeState): number {
  let eo = 0;
  let df = -1, db = -1;
  for (let i = 0; i < 12; i++) {
    eo |= (ea[i] & 1) << i;
    const c = ea[i] >> 1;
    if (c === DF_CUBIE) df = i;
    else if (c === DB_CUBIE) db = i;
  }
  return (eo << 8) | (df << 4) | db;
}

function isGoal(ea: EdgeState): boolean {
  // DF home with ori 0, DB home with ori 0, all EO=0.
  if (ea[8] !== (DF_CUBIE << 1)) return false;
  if (ea[10] !== (DB_CUBIE << 1)) return false;
  for (let i = 0; i < 12; i++) if (ea[i] & 1) return false;
  return true;
}

interface ParentEntry {
  parent: number;
  m: number;
  count: number;
}

function formatMove(m: number, count: number): string {
  const f = M_TO_FACE[m];
  if (count === 1) return f;
  if (count === 2) return f + '2';
  return f + "'";
}

const MAX_DEPTH = 12;

function bfs(start: EdgeState): string[] | null {
  if (isGoal(start)) return [];

  const startKey = encodeKey(start);
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
      const last = parents.get(key)!;
      const lastM = last.m;

      for (let m = 0; m < 6; m++) {
        if (m === lastM) continue;
        if (lastM >= 0) {
          const lastAxis = lastM % 3;
          const curAxis = m % 3;
          if (lastAxis === curAxis && m < lastM) continue;
        }
        for (let count = 1; count <= 3; count++) {
          const nea = cur.slice();
          applyMoveN(nea, m, count);
          const nkey = encodeKey(nea);
          if (parents.has(nkey)) continue;
          parents.set(nkey, { parent: key, m, count });
          states.set(nkey, nea);
          if (isGoal(nea)) {
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

export interface EOLineSolution {
  moves: string;
  length: number;
}

export function solveEOLine(scramble: string): EOLineSolution {
  const moves = parseScramble(scramble);
  const ea = solvedEdges();
  applyParsedToEdges(ea, moves);
  const sol = bfs(ea);
  if (sol == null) return { moves: '—', length: -1 };
  return { moves: sol.join(' '), length: sol.length };
}
