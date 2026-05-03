/**
 * Lightweight alg utilities for /notation. Uses cubing/alg's Alg class for
 * parsing + simplify + invert; mirror operations done via face-letter substitution
 * because cubing.js doesn't expose a stable mirror API at this version.
 *
 * Move count metrics:
 *  - HTM (face turn metric):  face/wide move = 1, slice (M/E/S) = 2, rotation = 0
 *  - QTM (quarter turn):       same as HTM but n*180° counts as 2, n*270° as 1
 *  - STM (slice turn metric):  face/wide/slice/rotation? — slice = 1, rotation = 0
 *  - ETM (execution turn):     everything counts as 1, including rotations
 */
import { Alg } from 'cubing/alg';

export interface MoveCounts {
  htm: number;
  qtm: number;
  stm: number;
  etm: number;
}

const FACE_MOVES = new Set(['U', 'D', 'L', 'R', 'F', 'B']);
const WIDE_MOVES = new Set(['Uw', 'Dw', 'Lw', 'Rw', 'Fw', 'Bw', 'u', 'd', 'l', 'r', 'f', 'b']);
const SLICE_MOVES = new Set(['M', 'E', 'S']);
const ROTATIONS = new Set(['x', 'y', 'z']);

function familyClass(family: string): 'face' | 'slice' | 'rotation' | 'other' {
  if (FACE_MOVES.has(family) || WIDE_MOVES.has(family)) return 'face';
  if (SLICE_MOVES.has(family)) return 'slice';
  if (ROTATIONS.has(family)) return 'rotation';
  // Big-cube wide turns like 3Rw, 2Uw etc.
  if (/^\d+[A-Za-z]+w?$/.test(family)) return 'face';
  return 'other';
}

export function countMoves(algStr: string): MoveCounts {
  let alg: Alg;
  try {
    alg = new Alg(algStr);
  } catch {
    return { htm: 0, qtm: 0, stm: 0, etm: 0 };
  }
  let htm = 0;
  let qtm = 0;
  let stm = 0;
  let etm = 0;

  for (const node of alg.experimentalLeafMoves()) {
    etm++;
    const family = node.family;
    const amount = Math.abs(node.amount);
    const cls = familyClass(family);
    const isQuarter = amount % 2 === 1;

    switch (cls) {
      case 'face':
        htm += 1;
        qtm += isQuarter ? 1 : 2;
        stm += 1;
        break;
      case 'slice':
        htm += 2;
        qtm += isQuarter ? 2 : 4;
        stm += 1;
        break;
      case 'rotation':
        // 0 contribution to htm/qtm/stm; etm already counted
        break;
      default:
        // Unknown — treat as face
        htm += 1;
        qtm += isQuarter ? 1 : 2;
        stm += 1;
    }
  }
  return { htm, qtm, stm, etm };
}

export function simplifyAlg(algStr: string): string {
  try {
    return new Alg(algStr).experimentalSimplify({ cancel: true }).toString();
  } catch {
    return algStr;
  }
}

export function invertAlg(algStr: string): string {
  try {
    return new Alg(algStr).invert().toString();
  } catch {
    return algStr;
  }
}

/**
 * Mirror across the M-slice (swap L/R, l/r, Lw/Rw, x→x', and invert each move's direction).
 * Done by tokenizing on whitespace; preserves original spacing roughly.
 *
 * We swap face letters L↔R and lowercase l↔r (wide), keep other letters,
 * then invert the amount on each move (R → L', U → U', M → M', etc. — but
 * for U/D/F/B/M/E/S the swap is no-op so we just invert direction).
 */
export function mirrorM(algStr: string): string {
  return transformPerMove(algStr, (token) => {
    const [, prefix, family, suffix] = token.match(/^(\d*)([A-Za-z]+w?)(2'?|'?2?|'?)$/) ?? [];
    if (!family) return token;
    const swapped = swapLR(family);
    const newSuffix = invertSuffix(suffix);
    return `${prefix}${swapped}${newSuffix}`;
  });
}

/**
 * Mirror across the S-slice (swap F/B, f/b, Fw/Bw, z→z', invert each direction).
 */
export function mirrorS(algStr: string): string {
  return transformPerMove(algStr, (token) => {
    const [, prefix, family, suffix] = token.match(/^(\d*)([A-Za-z]+w?)(2'?|'?2?|'?)$/) ?? [];
    if (!family) return token;
    const swapped = swapFB(family);
    const newSuffix = invertSuffix(suffix);
    return `${prefix}${swapped}${newSuffix}`;
  });
}

function transformPerMove(algStr: string, fn: (token: string) => string): string {
  // Split on whitespace but preserve commutator/conjugate brackets and commas.
  return algStr.split(/(\s+|[,()\[\]])/g).map((part) => {
    if (!part || /^\s+$/.test(part) || /^[,()\[\]]$/.test(part)) return part;
    return fn(part);
  }).join('');
}

const LR_SWAP: Record<string, string> = {
  L: 'R', R: 'L', Lw: 'Rw', Rw: 'Lw', l: 'r', r: 'l',
};
const FB_SWAP: Record<string, string> = {
  F: 'B', B: 'F', Fw: 'Bw', Bw: 'Fw', f: 'b', b: 'f',
};

function swapLR(family: string): string {
  return LR_SWAP[family] ?? family;
}

function swapFB(family: string): string {
  return FB_SWAP[family] ?? family;
}

function invertSuffix(suffix: string): string {
  if (suffix === '') return "'";
  if (suffix === "'") return '';
  if (suffix === '2') return '2';
  if (suffix === "2'" || suffix === "'2") return '2';
  return suffix;
}
