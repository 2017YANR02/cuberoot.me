// Bridge from a chichu "state" string to actual cube moves, replacing
// spooncuber codetrans.js m2p()/mover2scr() + min2phase.js with the project's
// Min2Phase WASM wrapper (lib/m2p-scramble.ts family).
//
// Only the chichu-state <-> URFDLB facelet PERMUTATION is ported (the order/color
// tables are copied byte-for-byte from codetrans.js). The Kociemba solve itself
// is delegated to the Rust+LTO WASM (same cs0x7f algorithm min2phase.js used).
//
// IMPORTANT: the WASM wrapper is ASYNC (instance is created behind an async
// init()). Upstream m2p/mover2scr were synchronous because min2phase.js was a
// loaded global; here m2pSolve/mover2scr are async and await the instance.

import init, { Min2Phase as Min2PhaseClass } from '../../../../../wasm/m2p/m2p_wasm';
import { CubeModel } from './facelet-model';
import { globalState } from './lettering';

const wasmUrl = new URL('../../../../../wasm/m2p/m2p_wasm_bg.wasm', import.meta.url);

let instancePromise: Promise<Min2PhaseClass> | null = null;

/**
 * Lazily build (once) and return the shared Min2Phase WASM instance. Mirrors the
 * singleton pattern in lib/m2p-scramble.ts so the heavy table build happens once.
 */
export function getM2pInstance(): Promise<Min2PhaseClass> {
  if (instancePromise) return instancePromise;
  instancePromise = (async () => {
    await init({ module_or_path: wasmUrl.href });
    return new Min2PhaseClass();
  })();
  return instancePromise;
}

/** Fire-and-forget warmup of the WASM tables. */
export function prewarm(): void {
  getM2pInstance().catch(() => {
    /* swallow; next real call will surface error */
  });
}

// ----- chichu-state -> facelet permutation (byte-for-byte from codetrans.js) -----

// globalState is cube's code in chichu with chichu's order.
// cube's code in CE with chichu's order:
const COLOR = 'uflulbubrurfdlfdbldrbdfrufuluburdfdldbdrfrflblbrudfbrl';
// code's code in chichu with CE's order (the face's order is urfdlb):
const ORDER = 'DeGc1gAaJKhIr5zZpSBbLs3qNjYWiXk2oOmREdCx6tQlMHfFy4wTnP';
// solved-face string used by mover2scr's face-reorder path:
const FACE = 'uuuuuuuuurrrrrrrrrfffffffffdddddddddlllllllllbbbbbbbbb';

/**
 * Build the 54-char URFDLB facelet string from a chichu state string.
 * Verbatim port of codetrans.js m2p()'s table walk (without the solve):
 *   for each i: chichu = input_state[globalState.indexOf(order[i])];
 *               push color[globalState.indexOf(chichu)];
 * then join + toUpperCase.
 */
export function buildFacelet(state: string): string {
  const m2pCodeList: string[] = [];
  for (let i = 0; i < state.length; i += 1) {
    const chichu = state[globalState.indexOf(ORDER[i])];
    m2pCodeList.push(COLOR[globalState.indexOf(chichu)]);
  }
  return m2pCodeList.join('').toUpperCase();
}

/** Collapse double spaces, matching upstream `.replaceAll("  ", " ")`. */
function collapseSpaces(s: string): string {
  return s.replaceAll('  ', ' ');
}

/**
 * Invert a WCA move string: reverse token order and invert each token
 * (X -> X', X' -> X, X2 -> X2). Replaces reader.js inverse_scramble().
 */
export function inverseScramble(moves: string): string {
  const tokens = moves.split(' ').filter((t) => t.length > 0);
  const out: string[] = [];
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const t = tokens[i];
    if (t.endsWith("'")) {
      out.push(t.slice(0, -1));
    } else if (t.endsWith('2')) {
      out.push(t);
    } else {
      out.push(t + "'");
    }
  }
  return out.join(' ');
}

/**
 * m2p(state): decode a chichu state into a facelet string and return the
 * min2phase 21-move FORWARD solution. Async (awaits the WASM instance).
 * solveEx(facelet, 21, 100000, 0, 0) matches upstream solution(facelet, 21)
 * (forward solution, no INVERSE bit).
 */
export async function m2pSolve(state: string): Promise<string> {
  const m = await getM2pInstance();
  const facelet = buildFacelet(state);
  const ret = m.solveEx(facelet, 21, 100_000, 0, 0);
  return collapseSpaces(ret);
}

/**
 * mover2scr(moves): run a move sequence through the CubeModel virtual cube,
 * reorder faces (1->U,4->L? — see the explicit table below, copied from
 * codetrans.js), patch the 6 centers to their digit codes, lowercase odd slots,
 * build the facelet via FACE/ORDER, min2phase-solve, and return the INVERSE
 * (the scramble that yields that state). Async (awaits the WASM instance).
 */
export async function mover2scr(moves: string): Promise<string> {
  const cube = new CubeModel();
  const inputArr = cube.operatealg(moves); // 1-indexed [0..6][0..9]

  // Face reorder (verbatim codetrans.js): transArr[0..5] from inputArr[1,4,5,2,3,6]
  // each sliced from index 1 (drop the 1-index sentinel) -> 9-length arrays.
  const transArr: (string | number)[][] = [[], [], [], [], [], []];
  transArr[0] = inputArr[1].slice(1);
  transArr[1] = inputArr[4].slice(1);
  transArr[2] = inputArr[5].slice(1);
  transArr[3] = inputArr[2].slice(1);
  transArr[4] = inputArr[3].slice(1);
  transArr[5] = inputArr[6].slice(1);

  // Patch centers (index 4 of each 9-length face) to the digit code.
  transArr[0][4] = '1';
  transArr[1][4] = '5';
  transArr[2][4] = '3';
  transArr[3][4] = '2';
  transArr[4][4] = '6';
  transArr[5][4] = '4';

  // Lowercase the odd slots (1,3,5,7) of every face (edge stickers).
  for (let i = 0; i < 6; i += 1) {
    for (let j = 1; j < 9; j += 2) {
      transArr[i][j] = String(transArr[i][j]).toLowerCase();
    }
  }

  const input_code = transArr.flat().join('');

  // Build facelet via FACE/ORDER tables (verbatim):
  //   for each i: push face[order.indexOf(input_code[i])]
  const m2pCodeList: string[] = [];
  for (let i = 0; i < input_code.length; i += 1) {
    m2pCodeList.push(FACE[ORDER.indexOf(input_code[i])]);
  }
  const m2pCode = m2pCodeList.join('').toUpperCase();

  const m = await getM2pInstance();
  let ret = m.solveEx(m2pCode, 21, 100_000, 0, 0);
  ret = collapseSpaces(ret);

  return inverseScramble(ret);
}
