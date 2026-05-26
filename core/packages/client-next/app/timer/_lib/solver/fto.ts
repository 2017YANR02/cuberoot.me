/**
 * Face-Turning Octahedron (FTO) solver — 3-phase Kociemba-style port of
 * cstimer's `src/js/solver/ftocta.js`. Pruning tables are built lazily on
 * the first call to `solveFto` (~few-hundred ms cold start; subsequent
 * solves complete in tens of ms).
 *
 * The cstimer source uses helpers from `mathlib.js` (createMoveHash,
 * createPrun, getPruning, Searcher, Coord, fillFacelet, detectFacelet,
 * getNPerm, getNParity, bitCount, permOriMult). Those helpers are ported
 * inline at the top of this file (TypeScript) so this solver is
 * self-contained. Move/state encodings are kept identical to cstimer for
 * easy cross-checking.
 *
 * Public API:
 *   - solveFtoFromFacelet(facelet, invSol?) — accepts an 8*9 facelet array
 *     (cstimer numeric encoding) and returns a move-string solution.
 *   - solveFto(scramble) — apply an FTO scramble (UFRLDB Bl Br notation,
 *     possibly with `'`) to the solved state and solve.
 *
 * Move notation in/out follows cstimer:
 *   U F r l D B R L  with optional `'` for inverse.
 *   Lower-case `r`/`l` are emitted as `BR`/`BL` by `prettyMoves`, since
 *   community FTO notation calls those wide-back faces. Wide moves are
 *   not used internally during search.
 */

// ============================================================================
// Inline mathlib helpers (ported from cstimer mathlib.js)
// ============================================================================

const fact: number[] = [1];
for (let i = 0; i < 16; i++) fact.push(fact[i] * (i + 1));

function bitCount(x: number): number {
  x -= (x >> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
  return ((x + (x >> 4) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

function getPruning(table: Int32Array, index: number): number {
  return (table[index >> 3] >> ((index & 7) << 2)) & 15;
}

function getNPerm(arr: number[], n: number, even?: number): number {
  let idx = 0;
  let vall = 0x76543210;
  let valh = 0xfedcba98;
  for (let i = 0; i < n - 1; i++) {
    const v = arr[i] << 2;
    idx *= n - i;
    if (v >= 32) {
      idx += (valh >>> (v - 32)) & 0xf;
      valh -= 0x11111110 << (v - 32);
    } else {
      idx += (vall >>> v) & 0xf;
      valh -= 0x11111111;
      vall -= 0x11111110 << v;
    }
  }
  return (even !== undefined && even < 0) ? (idx >> 1) : idx;
}


function getNParity(idx: number, n: number): number {
  let p = 0;
  for (let i = n - 2; i >= 0; --i) {
    p ^= idx % (n - i);
    idx = Math.floor(idx / (n - i));
  }
  return p & 1;
}

function getMPerm(arr: number[], n: number, cnts: number[], cums: number[]): number {
  let seen = ~0;
  let idx = 0;
  let x = 1;
  for (let i = 0; i < n; i++) {
    const pi = arr[i];
    idx = idx * (n - i) + bitCount(seen & ((1 << cums[pi]) - 1)) * x;
    x = x * cnts[pi]--;
    seen &= ~(1 << (cums[pi] + cnts[pi]));
  }
  return Math.round(idx / x);
}

function setMPerm(arr: number[], idx: number, n: number, cnts: number[], x: number): number[] {
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < cnts.length; j++) {
      if (cnts[j] === 0) continue;
      const x2 = ((x * cnts[j]) / (n - i)) | 0;
      if (idx < x2) {
        cnts[j]--;
        arr[i] = j;
        x = x2;
        break;
      }
      idx -= x2;
    }
  }
  return arr;
}

class CoordC {
  cnts: number[];
  cntn: number;
  cums: number[];
  n: number;
  x: number;
  constructor(cnts: number[]) {
    this.cnts = cnts.slice();
    this.cntn = this.cnts.length;
    this.cums = [0];
    for (let i = 1; i <= this.cntn; i++) this.cums[i] = this.cums[i - 1] + cnts[i - 1];
    this.n = this.cums[this.cntn];
    let n = this.n;
    let x = 1;
    for (let i = 0; i < this.cntn; i++) {
      for (let j = 1; j <= cnts[i]; j++, n--) x *= n / j;
    }
    this.x = Math.round(x);
  }
  get(arr: number[]): number {
    return getMPerm(arr, this.n, this.cnts.slice(), this.cums);
  }
  set(arr: number[], idx: number): number[] {
    return setMPerm(arr, idx, this.n, this.cnts.slice(), this.x);
  }
}

function fillFacelet(facelets: (number | number[])[], f: number[], perm: number[], ori: number[], divcol: number): void {
  for (let i = 0; i < facelets.length; i++) {
    const cubie = facelets[i];
    const p = perm[i] === undefined ? i : perm[i];
    if (typeof cubie === 'number') {
      f[cubie] = Math.floor((facelets[p] as number) / divcol);
      continue;
    }
    const o = ori[i] || 0;
    const fp = facelets[p] as number[];
    for (let j = 0; j < cubie.length; j++) {
      f[cubie[(j + o) % cubie.length]] = Math.floor(fp[j] / divcol);
    }
  }
}

function detectFacelet(facelets: number[][], f: number[], perm: number[], ori: number[], divcol: number): number {
  for (let i = 0; i < facelets.length; i++) {
    const n_ori = facelets[i].length;
    let matched = false;
    for (let j = 0; j < facelets.length; j++) {
      if (facelets[j].length !== n_ori) continue;
      for (let o = 0; o < n_ori; o++) {
        let isMatch = true;
        for (let t = 0; t < n_ori; t++) {
          if (Math.floor(facelets[j][t] / divcol) !== f[facelets[i][(t + o) % n_ori]]) {
            isMatch = false;
            break;
          }
        }
        if (isMatch) {
          perm[i] = j;
          if (ori) ori[i] = o;
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
    if (!matched) return -1;
  }
  return 0;
}

function permOriMult(p1: number[], p2: number[], prod: number[]): void {
  for (let i = 0; i < p2.length; i++) prod[i] = p1[p2[i]];
}

/** BFS state-explorer (cstimer createMoveHash). Returns [moveTable, hash2idx]. */
function createMoveHash<S>(
  initState: S,
  validMoves: number[],
  hashFunc: (s: S) => string | number,
  moveFunc: (s: S, m: number) => S,
): [number[][], Record<string, number>] {
  const states: S[] = [initState];
  const hash2idx: Record<string, number> = {};
  hash2idx['' + hashFunc(initState)] = 0;
  const moveTable: number[][] = [];
  for (let m = 0; m < validMoves.length; m++) moveTable[m] = [];
  for (let i = 0; i < states.length; i++) {
    const cur = states[i];
    for (let m = 0; m < validMoves.length; m++) {
      const ns = moveFunc(cur, validMoves[m]);
      if (!ns) {
        moveTable[m][i] = -1;
        continue;
      }
      const h = '' + hashFunc(ns);
      if (!(h in hash2idx)) {
        hash2idx[h] = states.length;
        states.push(ns);
      }
      moveTable[m][i] = hash2idx[h];
    }
  }
  return [moveTable, hash2idx];
}

/** 4-bits-per-cell pruning table (cstimer createPrun). */
function createPrun(
  prun: Int32Array,
  init: number | number[],
  size: number,
  maxd: number,
  doMove: number[][] | ((idx: number, m: number) => number),
  N_MOVES: number,
  N_POWER: number,
  N_INV?: number,
): void {
  const isMoveTable = Array.isArray(doMove);
  N_INV = N_INV ?? 256;
  for (let i = 0, len = (size + 7) >>> 3; i < len; i++) prun[i] = -1;
  const inits = Array.isArray(init) ? init : [init];
  for (const v of inits) prun[v >> 3] ^= 15 << ((v & 7) << 2);
  let val = 0;
  for (let l = 0; l <= maxd; l++) {
    let done = 0;
    const inv = l >= N_INV;
    const fill = (l + 1) ^ 15;
    const find = inv ? 0xf : l;
    const check = inv ? l : 0xf;
    out: for (let p = 0; p < size; p++, val >>= 4) {
      if ((p & 7) === 0) {
        val = prun[p >> 3];
        if (!inv && val === -1) {
          p += 7;
          continue;
        }
      }
      if ((val & 0xf) !== find) continue;
      for (let m = 0; m < N_MOVES; m++) {
        let q = p;
        for (let c = 0; c < N_POWER; c++) {
          q = isMoveTable ? (doMove as number[][])[m][q] : (doMove as (i: number, m: number) => number)(q, m);
          if (q < 0) break;
          if (getPruning(prun, q) !== check) continue;
          ++done;
          if (inv) {
            prun[p >> 3] ^= fill << ((p & 7) << 2);
            continue out;
          }
          prun[q >> 3] ^= fill << ((q & 7) << 2);
        }
      }
    }
    if (done === 0) break;
  }
}

/** IDA* searcher (cstimer Searcher). idx is opaque (number, array, etc.). */
type SearchIdx = number | number[];
type Sol = [number, number][]; // [axis, pow]

class Searcher {
  isSolved: (idx: SearchIdx) => boolean;
  getPrun: (idx: SearchIdx) => number;
  doMove: (idx: SearchIdx, axis: number, pow: number) => SearchIdx | null;
  N_AXIS: number;
  N_POWER: number;
  ckmv: number[];
  sidx = 0;
  sol: Sol = [];
  length = 0;
  idxs: SearchIdx[] = [];
  cost = 0;
  callback: (sol: Sol, sidx: number) => boolean = () => true;

  constructor(
    isSolved: ((idx: SearchIdx) => boolean) | null,
    getPrun: (idx: SearchIdx) => number,
    doMove: (idx: SearchIdx, axis: number, pow: number) => SearchIdx | null,
    N_AXIS: number,
    N_POWER: number,
    ckmv?: number[],
  ) {
    this.isSolved = isSolved || (() => true);
    this.getPrun = getPrun;
    this.doMove = doMove;
    this.N_AXIS = N_AXIS;
    this.N_POWER = N_POWER;
    if (ckmv) this.ckmv = ckmv.slice();
    else {
      this.ckmv = [];
      for (let i = 0; i < N_AXIS; i++) this.ckmv[i] = 1 << i;
    }
  }

  solve(idx: SearchIdx, minl: number, MAXL: number, callback?: (sol: Sol, sidx: number) => boolean, cost?: number): Sol | null {
    const r = this.solveMulti([idx], minl, MAXL, callback, cost);
    return r ? r[0] as Sol : null;
  }

  solveMulti(idxs: SearchIdx[], minl: number, MAXL: number, callback?: (sol: Sol, sidx: number) => boolean, cost?: number): [Sol, number] | null {
    this.sidx = 0;
    this.sol = [];
    this.length = minl;
    this.idxs = idxs;
    this.cost = (cost ?? 1e9) + 1;
    this.callback = callback ?? (() => true);
    for (; this.length <= MAXL; this.length++) {
      for (; this.sidx < this.idxs.length; this.sidx++) {
        if (this.idaSearch(this.idxs[this.sidx], this.length, 0, -1, this.sol) === 0) {
          return this.cost <= 0 ? null : [this.sol, this.sidx];
        }
      }
      this.sidx = 0;
    }
    return null;
  }

  private idaSearch(idx: SearchIdx, maxl: number, depth: number, lm: number, sol: Sol): number {
    if (--this.cost <= 0) return 0;
    const prun = this.getPrun(idx);
    if (prun > maxl) return prun > maxl + 1 ? 2 : 1;
    if (maxl === 0) return this.isSolved(idx) && this.callback(sol, this.sidx) ? 0 : 1;
    if (prun === 0 && maxl === 1 && this.isSolved(idx)) return 1;
    let axis = sol.length > depth ? sol[depth][0] : 0;
    for (; axis < this.N_AXIS; axis++) {
      if (lm >= 0 && (this.ckmv[lm] >> axis) & 1) continue;
      let idx1: SearchIdx = Array.isArray(idx) ? idx.slice() : idx;
      let pow = sol.length > depth ? sol[depth][1] : 0;
      for (; pow < this.N_POWER; pow++) {
        const r = this.doMove(idx1, axis, pow);
        if (r == null) break;
        idx1 = r;
        sol[depth] = [axis, pow];
        const ret = this.idaSearch(idx1, maxl - 1, depth + 1, axis, sol);
        if (ret === 0) return 0;
        sol.pop();
        if (ret === 2) break;
      }
    }
    return 1;
  }
}

// ============================================================================
// FTO Cubie + moves (port of cstimer ftocta.js initMoveCube)
// ============================================================================

class FtoCubie {
  cp: number[];
  co: number[];
  ep: number[];
  uf: number[];
  rl: number[];
  constructor(cp?: number[] | null, co?: number[] | null, ep?: number[] | null, uf?: number[] | null, rl?: number[] | null) {
    this.cp = cp ? cp.slice() : [0, 1, 2, 3, 4, 5];
    this.co = co ? co.slice() : [0, 0, 0, 0, 0, 0];
    this.ep = ep ? ep.slice() : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    this.uf = uf ? uf.slice() : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    this.rl = rl ? rl.slice() : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  }
  isEqual(fc: FtoCubie): boolean {
    for (let i = 0; i < 12; i++) {
      if (this.ep[i] !== fc.ep[i] || this.uf[i] !== fc.uf[i] || this.rl[i] !== fc.rl[i]
          || (i < 6 && (this.cp[i] !== fc.cp[i] || this.co[i] !== fc.co[i]))) {
        return false;
      }
    }
    return true;
  }
}

/** cstimer FtoMult equivalent. seq is the operands left→right; prod is
 *  the destination cube (caller-provided so cstimer's reuse pattern works,
 *  but we always pass a fresh `new FtoCubie()` so don't depend on it). */
function ftoMultImpl(seq: FtoCubie[], prod: FtoCubie): FtoCubie {
  // cstimer args.reduceRight: returns accumulator after pairing all.
  // Initial b = seq[last]; for i = last-1 .. 0: a = seq[i]; prod := a * b; b = prod.
  if (seq.length === 0) return prod;
  let b: FtoCubie = seq[seq.length - 1] as FtoCubie;
  for (let i = seq.length - 2; i >= 0; i--) {
    const a = seq[i] as FtoCubie;
    // prod = a * b
    const newCp = new Array<number>(6);
    const newCo = new Array<number>(6);
    for (let k = 0; k < 6; k++) {
      newCo[k] = a.co[b.cp[k]] ^ b.co[k];
      newCp[k] = a.cp[b.cp[k]];
    }
    const newEp = new Array<number>(12);
    const newUf = new Array<number>(12);
    const newRl = new Array<number>(12);
    for (let k = 0; k < 12; k++) {
      newEp[k] = a.ep[b.ep[k]];
      newUf[k] = a.uf[b.uf[k]];
      newRl[k] = a.rl[b.rl[k]];
    }
    prod.cp = newCp;
    prod.co = newCo;
    prod.ep = newEp;
    prod.uf = newUf;
    prod.rl = newRl;
    b = prod;
  }
  return prod;
}

let moveCube: FtoCubie[] = [];
let symCube: FtoCubie[] = [];
let symMult: number[][] = [];
let symMulI: number[][] = [];
let symMulM: number[][] = [];
let pyraSymCube: FtoCubie[] = [];
let initialized = false;

function initMoveCube(): void {
  if (initialized) return;
  initialized = true;

  const rotU = new FtoCubie(
    [1, 2, 0, 4, 5, 3], [0, 0, 0, 0, 0, 0], [2, 0, 1, 5, 3, 4, 10, 11, 6, 7, 8, 9],
    [1, 2, 0, 7, 8, 6, 10, 11, 9, 4, 5, 3], [2, 0, 1, 8, 6, 7, 11, 9, 10, 5, 3, 4],
  );
  const rotR = new FtoCubie(
    [5, 0, 4, 2, 3, 1], [1, 1, 0, 1, 1, 0], [6, 5, 7, 9, 2, 10, 11, 4, 3, 8, 1, 0],
    [5, 3, 4, 8, 6, 7, 2, 0, 1, 11, 9, 10], [4, 5, 3, 7, 8, 6, 1, 2, 0, 10, 11, 9],
  );

  const rotUi = ftoMultImpl([rotU, rotU], new FtoCubie());
  const rotRi = ftoMultImpl([rotR, rotR], new FtoCubie());
  const rotL = ftoMultImpl([rotUi, rotR, rotU], new FtoCubie());
  const rotF = ftoMultImpl([rotR, rotU, rotRi], new FtoCubie());

  moveCube = new Array<FtoCubie>(24);
  moveCube[0] = new FtoCubie(
    [1, 2, 0, 3, 4, 5], [0, 0, 0, 0, 0, 0], [2, 0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    [1, 2, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11], [0, 1, 2, 3, 6, 7, 11, 9, 8, 5, 10, 4],
  );
  moveCube[2] = new FtoCubie(
    [4, 1, 2, 3, 5, 0], [1, 0, 0, 0, 1, 0], [0, 1, 2, 3, 4, 6, 7, 5, 8, 9, 10, 11],
    [0, 1, 2, 4, 5, 3, 6, 7, 8, 9, 10, 11], [0, 9, 10, 3, 4, 5, 2, 7, 1, 8, 6, 11],
  );
  moveCube[4] = new FtoCubie(
    [0, 5, 2, 1, 4, 3], [0, 1, 0, 0, 0, 1], [0, 1, 2, 3, 10, 5, 6, 7, 8, 9, 11, 4],
    [0, 1, 2, 3, 4, 5, 7, 8, 6, 9, 10, 11], [5, 3, 2, 11, 4, 10, 6, 7, 8, 9, 0, 1],
  );
  moveCube[6] = new FtoCubie(
    [0, 1, 3, 4, 2, 5], [0, 0, 1, 1, 0, 0], [0, 1, 2, 8, 4, 5, 6, 7, 9, 3, 10, 11],
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 9], [8, 1, 7, 2, 0, 5, 6, 3, 4, 9, 10, 11],
  );
  moveCube[8] = new FtoCubie(
    [0, 1, 2, 5, 3, 4], [0, 0, 0, 0, 0, 0], [0, 1, 2, 4, 5, 3, 6, 7, 8, 9, 10, 11],
    [0, 1, 2, 3, 9, 10, 5, 7, 4, 8, 6, 11], [1, 2, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  );
  moveCube[10] = new FtoCubie(
    [0, 3, 1, 2, 4, 5], [0, 1, 1, 0, 0, 0], [0, 1, 10, 3, 4, 5, 6, 7, 8, 2, 9, 11],
    [0, 6, 7, 3, 4, 5, 11, 9, 8, 2, 10, 1], [0, 1, 2, 4, 5, 3, 6, 7, 8, 9, 10, 11],
  );
  moveCube[12] = new FtoCubie(
    [5, 0, 2, 3, 4, 1], [1, 1, 0, 0, 0, 0], [6, 1, 2, 3, 4, 5, 11, 7, 8, 9, 10, 0],
    [5, 3, 2, 8, 4, 7, 6, 0, 1, 9, 10, 11], [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 9],
  );
  moveCube[14] = new FtoCubie(
    [2, 1, 4, 3, 0, 5], [1, 0, 1, 0, 0, 0], [0, 8, 2, 3, 4, 5, 6, 1, 7, 9, 10, 11],
    [11, 1, 10, 2, 0, 5, 6, 7, 8, 9, 3, 4], [0, 1, 2, 3, 4, 5, 7, 8, 6, 9, 10, 11],
  );
  // Wide moves (only used for compatibility — phase searchers don't use these).
  moveCube[16] = ftoMultImpl([rotU, moveCube[8]], new FtoCubie());
  moveCube[18] = ftoMultImpl([rotF, moveCube[10]], new FtoCubie());
  moveCube[20] = ftoMultImpl([rotR, moveCube[6]], new FtoCubie());
  moveCube[22] = ftoMultImpl([rotL, moveCube[4]], new FtoCubie());

  for (let i = 1; i < 24; i += 2) {
    moveCube[i] = new FtoCubie();
    ftoMultImpl([moveCube[i - 1], moveCube[i - 1]], moveCube[i]);
  }

  const moveHash: string[] = [];
  for (let i = 0; i < 24; i++) moveHash[i] = moveCube[i].ep.join(',');

  // Build symmetry group (12 rotations).
  symCube = [];
  symMult = [];
  symMulI = [];
  symMulM = [];
  const symHash: string[] = [];
  let fc = new FtoCubie();
  for (let s = 0; s < 12; s++) {
    symCube[s] = new FtoCubie(fc.cp, fc.co, fc.ep, fc.uf, fc.rl);
    symHash[s] = symCube[s].ep.join(',');
    symMult[s] = [];
    symMulI[s] = [];
    fc = ftoMultImpl([fc, rotU], new FtoCubie());
    if (s % 3 === 2) fc = ftoMultImpl([fc, rotR, rotU], new FtoCubie());
    if (s % 6 === 5) fc = ftoMultImpl([fc, rotU, rotR], new FtoCubie());
  }
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 12; j++) {
      const tmp = ftoMultImpl([symCube[i], symCube[j]], new FtoCubie());
      const k = symHash.indexOf(tmp.ep.join(','));
      symMult[i][j] = k;
      symMulI[k][j] = i;
    }
  }
  for (let s = 0; s < 12; s++) {
    symMulM[s] = [];
    for (let j = 0; j < 8; j++) {
      const tmp = ftoMultImpl([symCube[symMulI[0][s]], moveCube[j * 2], symCube[s]], new FtoCubie());
      const k = moveHash.indexOf(tmp.ep.join(','));
      symMulM[s][j] = k >> 1;
    }
  }

  pyraSymCube = [];
  for (let i = 0; i < 12; i++) {
    pyraSymCube.push(new FtoCubie(
      symCube[i].cp, symCube[i].co, null, symCube[i].uf, null,
    ));
  }
}

function ftoPermMove(key: 'ep' | 'rl' | 'uf' | 'cp' | 'co', perm: number[], move: number): number[] {
  const movePerm = (moveCube[move] as unknown as Record<string, number[]>)[key];
  const ret: number[] = new Array(perm.length);
  for (let i = 0; i < perm.length; i++) ret[i] = perm[movePerm[i]];
  return ret;
}

function ftoFullMove(fc: FtoCubie, move: number): FtoCubie {
  return ftoMultImpl([fc, moveCube[move]], new FtoCubie());
}

// Convert FtoCubie → 8*9 facelet array (cstimer convention).
const U_OFF = 0, F_OFF = 9, r_OFF = 18, l_OFF = 27, D_OFF = 36, B_OFF = 45, R_OFF = 54, L_OFF = 63;
const cornFacelets: number[][] = [
  [U_OFF + 0, R_OFF + 0, F_OFF + 0, L_OFF + 0],
  [U_OFF + 4, B_OFF + 8, r_OFF + 4, R_OFF + 8],
  [U_OFF + 8, L_OFF + 4, l_OFF + 8, B_OFF + 4],
  [l_OFF + 0, D_OFF + 0, r_OFF + 0, B_OFF + 0],
  [F_OFF + 4, D_OFF + 8, l_OFF + 4, L_OFF + 8],
  [r_OFF + 8, D_OFF + 4, F_OFF + 8, R_OFF + 4],
];
const edgeFacelets: number[][] = [
  [U_OFF + 1, R_OFF + 3], [U_OFF + 3, L_OFF + 1], [U_OFF + 6, B_OFF + 6],
  [l_OFF + 1, D_OFF + 3], [r_OFF + 3, D_OFF + 1], [F_OFF + 6, D_OFF + 6],
  [F_OFF + 3, R_OFF + 1], [F_OFF + 1, L_OFF + 3], [l_OFF + 6, L_OFF + 6],
  [l_OFF + 3, B_OFF + 1], [r_OFF + 1, B_OFF + 3], [r_OFF + 6, R_OFF + 6],
];
const ctufFacelets: number[] = [
  U_OFF + 2, U_OFF + 5, U_OFF + 7,
  F_OFF + 2, F_OFF + 5, F_OFF + 7,
  r_OFF + 2, r_OFF + 5, r_OFF + 7,
  l_OFF + 2, l_OFF + 5, l_OFF + 7,
];
const ctrlFacelets: number[] = [
  D_OFF + 2, D_OFF + 5, D_OFF + 7,
  B_OFF + 2, B_OFF + 5, B_OFF + 7,
  L_OFF + 2, L_OFF + 5, L_OFF + 7,
  R_OFF + 2, R_OFF + 5, R_OFF + 7,
];

function fcToFaceCube(fc: FtoCubie, todiv: number = 9): number[] {
  const f: number[] = [];
  for (let i = 0; i < 72; i++) f[i] = 0;
  const co: number[] = [];
  for (let i = 0; i < 6; i++) co[i] = fc.co[i] * 2;
  // For corner facelets the indices are integers (per layer), but stored as nested arrays of size 4.
  // Use fillFacelet's nested-array branch: facelets entries are arrays.
  fillFacelet(cornFacelets as (number | number[])[], f, fc.cp, co, todiv);
  fillFacelet(edgeFacelets as (number | number[])[], f, fc.ep, [], todiv);
  // ctuf / ctrl: facelets entries are plain numbers.
  fillFacelet(ctufFacelets as (number | number[])[], f, fc.uf, [], todiv);
  fillFacelet(ctrlFacelets as (number | number[])[], f, fc.rl, [], todiv);
  return f;
}

function fcFromFacelet(facelet: number[]): FtoCubie | null {
  const fc = new FtoCubie();
  let count = 0;
  const f: number[] = [];
  for (let i = 0; i < 72; i++) {
    f[i] = facelet[i];
    count += Math.pow(16, f[i]);
  }
  if (count !== 0x99999999) return null;
  const co: number[] = [];
  if (detectFacelet(cornFacelets, f, fc.cp, co, 9) === -1) return null;
  if (detectFacelet(edgeFacelets, f, fc.ep, [], 9) === -1) return null;
  let parity = 0;
  for (let i = 0; i < 6; i++) {
    fc.co[i] = co[i] >> 1;
    parity ^= fc.co[i];
  }
  if (parity !== 0) return null;
  if (getNParity(getNPerm(fc.cp, 6), 6) !== 0) return null;
  if (getNParity(getNPerm(fc.ep, 12), 12) !== 0) return null;
  let remainCnts = [3, 3, 3, 3];
  for (let i = 0; i < 12; i++) {
    const col = f[ctufFacelets[i]];
    if (!(remainCnts[col] > 0)) return null;
    fc.uf[i] = col * 3 + 3 - remainCnts[col];
    remainCnts[col]--;
  }
  remainCnts = [3, 3, 3, 3];
  const colMap = [0, 1, 3, 2];
  for (let i = 0; i < 12; i++) {
    const col = colMap[f[ctrlFacelets[i]] - 4];
    if (!(remainCnts[col] > 0)) return null;
    fc.rl[i] = col * 3 + 3 - remainCnts[col];
    remainCnts[col]--;
  }
  if (getNParity(getNPerm(fc.uf, 12), 12) !== 0) {
    for (let i = 0; i < 12; i++) fc.uf[i] ^= fc.uf[i] < 2 ? 1 : 0;
  }
  if (getNParity(getNPerm(fc.rl, 12), 12) !== 0) {
    for (let i = 0; i < 12; i++) fc.rl[i] ^= fc.rl[i] < 2 ? 1 : 0;
  }
  return fc;
}

// ============================================================================
// Phase 1
// ============================================================================

function phase1EdgeHash(ep: number[]): number {
  let ret = 0;
  let e3fst = -1;
  for (let i = 0; i < 12; i++) {
    if (((0x38 >> ep[i]) & 1) === 0) continue;
    if (e3fst === -1) e3fst = ep[i];
    ret += (((ep[i] - e3fst + 3) % 3 + 1) << (i * 2));
  }
  return ret;
}

function phase1CtrlHash(rl: number[]): number {
  let ret = 0;
  for (let i = 0; i < 12; i++) {
    if (rl[i] < 3) ret |= 1 << i;
  }
  return ret;
}

function genCkmv(moves: number[]): number[] {
  const ckmv: number[] = [];
  for (let m1 = 0; m1 < moves.length; m1++) {
    ckmv[m1] = 1 << m1;
    for (let m2 = 0; m2 < m1; m2++) {
      const tmp1 = ftoMultImpl([moveCube[moves[m1]], moveCube[moves[m2]]], new FtoCubie());
      const tmp2 = ftoMultImpl([moveCube[moves[m2]], moveCube[moves[m1]]], new FtoCubie());
      if (tmp1.isEqual(tmp2)) ckmv[m1] |= 1 << m2;
    }
  }
  return ckmv;
}

const phase1Moves = [0, 2, 22, 6, 16, 10, 12, 14];
let p1epMoves: [number[][], Record<string, number>] | null = null;
let p1rlMoves: [number[][], Record<string, number>] | null = null;
let ckmv1: number[] | null = null;
let solv1: Searcher | null = null;

function phase1Init(): void {
  initMoveCube();
  const fc = new FtoCubie();
  p1epMoves = createMoveHash(
    fc.ep.slice(),
    phase1Moves,
    (s: number[]) => phase1EdgeHash(s),
    (s: number[], m: number) => ftoPermMove('ep', s, m),
  );
  p1rlMoves = createMoveHash(
    fc.rl.slice(),
    phase1Moves,
    (s: number[]) => phase1CtrlHash(s),
    (s: number[], m: number) => ftoPermMove('rl', s, m),
  );
  const N_P1EP = p1epMoves[0][0].length;
  const N_P1RL = p1rlMoves[0][0].length;

  ckmv1 = genCkmv(phase1Moves);
  const tableSize = N_P1EP * N_P1RL;
  const p1eprlPrun = new Int32Array((tableSize + 7) >>> 3);
  createPrun(p1eprlPrun, 0, tableSize, 14, (idx: number, move: number) => {
    const rl = Math.floor(idx / N_P1EP);
    const ep = idx % N_P1EP;
    return p1rlMoves![0][move][rl] * N_P1EP + p1epMoves![0][move][ep];
  }, phase1Moves.length, 2);

  solv1 = new Searcher(
    null,
    (idx) => {
      const a = idx as number[];
      return getPruning(p1eprlPrun, a[1] * N_P1EP + a[0]);
    },
    (idx, axis, _pow) => {
      // cstimer Searcher convention: doMove applies ONE more CW turn per call.
      // `axis` selects the move (0..N_AXIS-1). The Searcher loop iterates `pow`
      // by feeding the result back in.
      void _pow;
      const a = idx as number[];
      const ep = p1epMoves![0][axis][a[0]];
      const rl = p1rlMoves![0][axis][a[1]];
      if (ep < 0 || rl < 0) return null;
      return [ep, rl];
    },
    phase1Moves.length, 2, ckmv1,
  );
}

function phase1GenIdxs(fc: FtoCubie): { idxs: number[][]; syms: number[][] } {
  const idxs: number[][] = [];
  const syms: number[][] = [];
  for (let sidx = 0; sidx < 12; sidx += 3) {
    const fc2 = ftoMultImpl([symCube[sidx % 12], fc], new FtoCubie());
    let rot = 0;
    let fc3 = new FtoCubie();
    for (rot = 0; rot < 12; rot++) {
      fc3 = ftoMultImpl([fc2, symCube[rot]], new FtoCubie());
      if (fc3.ep[4] === 4) break;
    }
    idxs.push([
      p1epMoves![1][phase1EdgeHash(fc3.ep)],
      p1rlMoves![1][phase1CtrlHash(fc3.rl)],
    ]);
    syms.push([sidx, rot]);
  }
  return { idxs, syms };
}

function move2std(moves: number[]): { ret: number[]; sym: number } {
  let sym = 0;
  const ret: number[] = [];
  const w2axis = [4, 5, 3, 2];
  const w2rot = [1, 10, 5, 11];
  for (let i = 0; i < moves.length; i++) {
    let rot = 0;
    let axis = moves[i] >> 1;
    const pow = moves[i] & 1;
    if (axis >= 8) {
      rot = w2rot[axis - 8];
      axis = w2axis[axis - 8];
    }
    if (!pow) rot = symMult[rot][rot];
    ret.push(symMulM[sym][axis] * 2 + pow);
    sym = symMult[rot][sym];
  }
  return { ret, sym };
}

function phase1ProcSol(sol: Sol, solsym: number[], fc: FtoCubie): { fc: FtoCubie; sol: number[]; symA: number; symB: number } {
  // Convert IDA-output [axis,pow] pairs into raw move indices.
  const rawSol: number[] = [];
  for (let i = 0; i < sol.length; i++) rawSol.push(phase1Moves[sol[i][0]] + sol[i][1]);
  const std = move2std(rawSol);
  const out: number[] = [];
  let cur = fc;
  for (let i = 0; i < std.ret.length; i++) {
    const move = std.ret[i];
    const real = symMulM[symMulI[0][solsym[1]]][move >> 1] * 2 + (move & 1);
    out.push(real);
    cur = ftoMultImpl([cur, moveCube[real]], new FtoCubie());
  }
  const newSymB = symMulI[solsym[1]][std.sym];
  cur = ftoMultImpl(
    [pyraSymCube[Math.floor(solsym[0] / 12)], symCube[solsym[0] % 12], cur, symCube[newSymB]],
    new FtoCubie(),
  );
  return { fc: cur, sol: out, symA: solsym[0], symB: newSymB };
}

const N_PHASE1_SOLS = 200;

interface Phase1Sol {
  fc: FtoCubie;
  sol: number[];
  symA: number;
  symB: number;
}

function solvePhase1(fc: FtoCubie): Phase1Sol[] {
  if (!solv1) phase1Init();
  const { idxs, syms } = phase1GenIdxs(fc);
  const p1sols: Phase1Sol[] = [];
  solv1!.solveMulti(idxs, 0, 12, (sol, sidx) => {
    const param = phase1ProcSol(sol.slice() as Sol, syms[sidx].slice(), fc);
    p1sols.push(param);
    return p1sols.length >= N_PHASE1_SOLS;
  });
  return p1sols;
}

// ============================================================================
// Phase 2
// ============================================================================

const phase2Moves = [0, 12, 14, 8, 10];
let p2epMoves: [number[][], Record<string, number>] | null = null;
let p2rlMoves: [number[][], Record<string, number>] | null = null;
let p2ccMoves: [number[][], Record<string, number>] | null = null;
const p2cc2ufBit: Record<string, number> = {};
let ckmv2: number[] | null = null;
let solv2: Searcher | null = null;
const P2EPRL_MAXL = 11;
const p2symMap: number[] = [];
const ufStd2Raw: number[] = [];
const ufRaw2Std: number[] = [];
let p2ufCoord: CoordC | null = null;

const cornExFacelets: number[][] = [
  [U_OFF + 2, R_OFF + 2, F_OFF + 2, L_OFF + 2],
  [U_OFF + 5, B_OFF + 7, r_OFF + 5, R_OFF + 7],
  [U_OFF + 7, L_OFF + 5, l_OFF + 7, B_OFF + 5],
  [l_OFF + 2, D_OFF + 2, r_OFF + 2, B_OFF + 2],
  [F_OFF + 5, D_OFF + 7, l_OFF + 5, L_OFF + 7],
  [r_OFF + 7, D_OFF + 5, F_OFF + 7, R_OFF + 5],
];

function phase2EdgeHash(ep: number[]): number {
  const edge2group = [0, 1, 2, 3, 3, 3, 0, 1, 1, 2, 2, 0];
  const groups = [[0, 6, 11], [1, 7, 8], [2, 9, 10], [3, 4, 5]];
  let ret = 0;
  const egoff = [-1, -1, -1, -1];
  // Use a multiplicative encoding (the cstimer code uses Math.pow(16, i)).
  for (let i = 0; i < 12; i++) {
    const g = edge2group[ep[i]];
    const gidx = groups[g].indexOf(ep[i]);
    if (egoff[g] === -1) egoff[g] = gidx;
    ret += (g * 4 + (gidx - egoff[g] + 3) % 3) * Math.pow(16, i);
  }
  return ret;
}

function phase2CtHash(ct: number[]): number {
  let ret = 0;
  for (let i = 0; i < 12; i++) ret |= (Math.floor(ct[i] / 3)) << (i * 2);
  return ret;
}

function phase2CpcoHash(fc: FtoCubie): string {
  const ret = String.fromCharCode(...fc.cp, ...fc.co);
  if (!(ret in p2cc2ufBit)) {
    const co: number[] = [];
    for (let i = 0; i < 6; i++) co[i] = fc.co[i] * 2;
    const facelet = fcToFaceCube(fc);
    fillFacelet(cornExFacelets as (number | number[])[], facelet, fc.cp, co, 9);
    const fc2 = fcFromFacelet(facelet);
    if (fc2) p2cc2ufBit[ret] = phase2CtHash(fc2.uf);
    else p2cc2ufBit[ret] = 0;
  }
  return ret;
}

function phase2ufStd(uf: number[], symMap: number[]): number {
  const col1 = uf[0];
  let col2 = -1;
  for (let i = 1; i < 12; i++) {
    if (uf[i] !== col1) { col2 = uf[i]; break; }
  }
  const sym = symMap[col1 * 4 + col2];
  for (let i = 0; i < 12; i++) {
    uf[i] = Math.floor(symCube[sym].uf[uf[i] * 3] / 3);
  }
  return sym;
}

function getPhase2ufIdx(uf: number[]): number {
  const ufstd: number[] = [];
  for (let i = 0; i < 12; i++) ufstd[i] = Math.floor(uf[i] / 3);
  const sym = phase2ufStd(ufstd, p2symMap);
  return (ufRaw2Std[p2ufCoord!.get(ufstd)] << 4) | sym;
}

function phase2Init(): void {
  if (solv2) return;
  initMoveCube();
  if (!p1epMoves) phase1Init();

  const fc = new FtoCubie();
  p2ufCoord = new CoordC([3, 3, 3, 3]);
  p2epMoves = createMoveHash(
    fc.ep.slice(),
    phase2Moves,
    (s: number[]) => phase2EdgeHash(s),
    (s: number[], m: number) => ftoPermMove('ep', s, m),
  );
  p2rlMoves = createMoveHash(
    fc.rl.slice(),
    phase2Moves,
    (s: number[]) => phase2CtHash(s),
    (s: number[], m: number) => ftoPermMove('rl', s, m),
  );
  p2ccMoves = createMoveHash(
    new FtoCubie(),
    phase2Moves,
    (s: FtoCubie) => phase2CpcoHash(s),
    (s: FtoCubie, m: number) => ftoFullMove(s, m),
  );

  // Build ufStd2Raw / ufRaw2Std (equivalent classes under symmetry).
  const arr: number[] = [];
  const arr2: number[] = [];
  const p2ufMoveStd: number[][] = [[], [], [], [], []];
  const ufStd2Bit: number[] = [];
  const p2ccRecol: number[][] = [];
  for (let s = 0; s < 12; s++) {
    const uf = symCube[s].uf;
    const col1 = Math.floor(uf.indexOf(0) / 3);
    const col2 = Math.floor(uf.indexOf(3) / 3);
    p2symMap[col1 * 4 + col2] = s;
    p2ccRecol[s] = [];
  }
  out: for (let i = 0; i < 42000; i++) {
    p2ufCoord.set(arr, i);
    for (let j = 1; j < 12; j++) {
      if (arr[j] > 1) continue out;
      else if (arr[j] === 1) break;
    }
    ufRaw2Std[i] = ufStd2Raw.length;
    ufStd2Raw.push(i);
  }
  for (let i = 0; i < ufStd2Raw.length; i++) {
    p2ufCoord.set(arr, ufStd2Raw[i]);
    let hash = 0;
    for (let j = 0; j < 12; j++) hash |= arr[j] << (j * 2);
    ufStd2Bit[i] = hash;
    for (let m = 0; m < phase2Moves.length; m++) {
      permOriMult(arr, moveCube[phase2Moves[m]].uf, arr2);
      const sym = phase2ufStd(arr2, p2symMap);
      p2ufMoveStd[m][i] = (ufRaw2Std[p2ufCoord.get(arr2)] << 4) | sym;
    }
  }
  const cc2Bit: number[] = [];
  for (const key in p2ccMoves[1]) {
    const idx = p2ccMoves[1][key];
    cc2Bit[idx] = p2cc2ufBit[key];
    const cpco: number[] = [];
    for (let s = 0; s < 12; s++) {
      const sc = symCube[s];
      for (let i = 0; i < 6; i++) {
        const scpi = key.charCodeAt(i);
        cpco[i] = sc.cp[scpi];
        cpco[i + 6] = sc.co[scpi] ^ key.charCodeAt(i + 6);
      }
      const hash = String.fromCharCode(...cpco);
      p2ccRecol[s][idx] = p2ccMoves[1][hash];
    }
  }

  const p2necPrun = [
    0, 99, 3, 4, 5, 6, 8,
    99, 2, 3, 4, 5, 6, 8,
    1, 3, 4, 5, 6, 7, 8,
    1, 3, 4, 5, 6, 7, 9,
    99, 2, 3, 4, 5, 6, 8,
    2, 2, 4, 4, 5, 6, 8,
    3, 3, 4, 5, 6, 7, 8,
    3, 3, 4, 5, 6, 7, 9,
    3, 3, 4, 5, 6, 7, 8,
    4, 4, 4, 5, 6, 7, 8,
    4, 4, 5, 6, 7, 8, 9,
    4, 4, 5, 6, 7, 8, 9,
    4, 4, 5, 6, 7, 8, 9,
    4, 4, 5, 6, 7, 8, 9,
    5, 5, 6, 7, 8, 9, 10,
    5, 5, 6, 7, 8, 9, 10,
  ];

  const N_P2EP = p2epMoves[0][0].length;
  const N_P2RL = p2rlMoves[0][0].length;
  const eprlSize = N_P2EP * N_P2RL;
  const p2eprlPrun = new Int32Array((eprlSize + 7) >>> 3);
  createPrun(p2eprlPrun, 0, eprlSize, P2EPRL_MAXL - 2, (idx: number, move: number) => {
    const rl = Math.floor(idx / N_P2EP);
    const ep = idx % N_P2EP;
    return p2rlMoves![0][move][rl] * N_P2EP + p2epMoves![0][move][ep];
  }, phase2Moves.length, 2);
  ckmv2 = genCkmv(phase2Moves);

  solv2 = new Searcher(
    null,
    (idx) => {
      const a = idx as number[];
      let xors = ufStd2Bit[a[3] >> 4] ^ cc2Bit[p2ccRecol[a[3] & 0xf][a[2]]];
      xors = (xors | (xors >> 1)) & 0x555555;
      const necIdx = ((bitCount(xors & 0x3f) << 2) | bitCount(xors & 0xc0c0c0)) * 7 + bitCount(xors & 0x3f3f00);
      return Math.max(
        Math.min(P2EPRL_MAXL, getPruning(p2eprlPrun, a[1] * N_P2EP + a[0])),
        p2necPrun[necIdx],
      );
    },
    (idx, axis, _pow) => {
      void _pow;
      const a = idx as number[];
      const ep = p2epMoves![0][axis][a[0]];
      const rl = p2rlMoves![0][axis][a[1]];
      const cc = p2ccMoves![0][axis][a[2]];
      const ufidx1 = p2ufMoveStd[axis][a[3] >> 4];
      if (ep < 0 || rl < 0 || cc < 0 || ufidx1 < 0) return null;
      const ufcol = symMult[ufidx1 & 0xf][a[3] & 0xf];
      return [ep, rl, cc, (ufidx1 & ~0xf) | ufcol];
    },
    phase2Moves.length, 2, ckmv2,
  );
}

interface Phase2Result {
  fc: FtoCubie;
  sol: number[];
  symA: number;
  symB: number;
  src: number;
}

function solvePhase2(p1sols: Phase1Sol[]): Phase2Result {
  if (!solv2) phase2Init();
  const idxs: number[][] = [];
  for (let i = 0; i < p1sols.length; i++) {
    const fc = p1sols[i].fc;
    idxs.push([
      p2epMoves![1][phase2EdgeHash(fc.ep)],
      p2rlMoves![1][phase2CtHash(fc.rl)],
      p2ccMoves![1][phase2CpcoHash(fc)],
      getPhase2ufIdx(fc.uf),
    ]);
  }
  const r = solv2!.solveMulti(idxs, 0, 25);
  if (!r) throw new Error('FTO phase 2: no solution found');
  const sol = r[0];
  const src = r[1];
  const p1 = p1sols[src];
  let cur = p1.fc;
  const out: number[] = [];
  for (let i = 0; i < sol.length; i++) {
    const move = phase2Moves[sol[i][0]] + sol[i][1];
    const real = symMulM[symMulI[0][p1.symB]][move >> 1] * 2 + (move & 1);
    out.push(real);
    cur = ftoMultImpl([cur, moveCube[move]], new FtoCubie()); // apply via raw "move" (cstimer does this)
  }
  return { fc: cur, sol: out, symA: p1.symA, symB: p1.symB, src };
}

// ============================================================================
// Phase 3
// ============================================================================

const phase3Moves = [8, 10, 12, 14];
let p3epMoves: [number[][], Record<string, number>] | null = null;
let p3ufMoves: [number[][], Record<string, number>] | null = null;
let p3epPrun: Int32Array | null = null;
let p3ufPrun: Int32Array | null = null;
let ckmv3: number[] | null = null;
let solv3: Searcher | null = null;

function phase3EdgeHash(ep: number[]): string {
  return String.fromCharCode(...ep);
}
function phase3CcufHash(fc: FtoCubie): string {
  return String.fromCharCode(...fc.cp, ...fc.co);
}

function phase3Init(): void {
  if (solv3) return;
  initMoveCube();
  const fc = new FtoCubie();
  p3epMoves = createMoveHash(
    fc.ep.slice(),
    phase3Moves,
    (s: number[]) => phase3EdgeHash(s),
    (s: number[], m: number) => ftoPermMove('ep', s, m),
  );
  p3ufMoves = createMoveHash(
    new FtoCubie(),
    phase3Moves,
    (s: FtoCubie) => phase3CcufHash(s),
    (s: FtoCubie, m: number) => ftoFullMove(s, m),
  );
  p3epPrun = new Int32Array((81 + 7) >>> 3);
  p3ufPrun = new Int32Array((11520 + 7) >>> 3);
  createPrun(p3epPrun, 0, 81, 14, p3epMoves[0], 4, 2);
  createPrun(p3ufPrun, 0, 11520, 14, p3ufMoves[0], 4, 2);
  ckmv3 = genCkmv(phase3Moves);

  solv3 = new Searcher(
    null,
    (idx) => {
      const a = idx as number[];
      return Math.max(getPruning(p3epPrun!, a[0]), getPruning(p3ufPrun!, a[1]));
    },
    (idx, axis, _pow) => {
      void _pow;
      const a = idx as number[];
      const ep = p3epMoves![0][axis][a[0]];
      const uf = p3ufMoves![0][axis][a[1]];
      if (ep < 0 || uf < 0) return null;
      return [ep, uf];
    },
    4, 2, ckmv3,
  );
}

function solvePhase3(p2: Phase2Result): { sol: number[] } {
  if (!solv3) phase3Init();
  const fc = p2.fc;
  const epIdx = p3epMoves![1][phase3EdgeHash(fc.ep)];
  const ufIdx = p3ufMoves![1][phase3CcufHash(fc)];
  const sol = solv3!.solve([epIdx, ufIdx], 0, 25);
  if (!sol) throw new Error('FTO phase 3: no solution found');
  const out: number[] = [];
  for (let i = 0; i < sol.length; i++) {
    const move = phase3Moves[sol[i][0]] + sol[i][1];
    const real = symMulM[symMulI[0][p2.symB]][move >> 1] * 2 + (move & 1);
    out.push(real);
  }
  return { sol: out };
}

// ============================================================================
// Public API
// ============================================================================

const move2str = ['U', "U'", 'F', "F'", 'r', "r'", 'l', "l'", 'D', "D'", 'B', "B'", 'R', "R'", 'L', "L'"];

export function prettyMoves(moves: number[]): string {
  const buf: string[] = [];
  for (let i = 0; i < moves.length; i++) buf.push(move2str[moves[i]]);
  // FTO community notation: lowercase l/r are wide-back faces shown as BL/BR.
  return buf.join(' ').replace(/l/g, 'BL').replace(/r/g, 'BR');
}

/** Solve from cstimer-style 8*9 facelet array. Returns a string of moves. */
export function solveFtoFromFacelet(facelet: number[], invSol = false): string {
  initMoveCube();
  const fc = fcFromFacelet(facelet);
  if (!fc) throw new Error('FTO solver: invalid facelet');
  return doSolve(fc, invSol);
}

function doSolve(fc: FtoCubie, invSol: boolean): string {
  if (!solv1) phase1Init();
  if (!solv2) phase2Init();
  if (!solv3) phase3Init();
  const p1sols = solvePhase1(fc);
  const p2 = solvePhase2(p1sols);
  // Re-base phase 2's intermediate cube using phase1 sym chain (cstimer does:
  //   solvInfo2[0] = FtoCubie.FtoMult(pyraSymCube[symMulI[0][~~(symA/12)]], solvInfo2[0])
  const p1 = p1sols[p2.src];
  p2.fc = ftoMultImpl([pyraSymCube[symMulI[0][Math.floor(p1.symA / 12)]], p2.fc], new FtoCubie());

  const p3 = solvePhase3(p2);
  const sol = [...p1.sol, ...p2.sol, ...p3.sol];
  if (invSol) {
    for (let i = 0; i < sol.length; i++) sol[i] ^= 1;
    sol.reverse();
  }
  return prettyMoves(sol);
}

// Move-token parsing for FTO scrambles. Tokens accepted:
//   U, F, R, L, D, B, BR, BL, r, l (plus optional `'`).
const MOVE_TOKEN_TO_INDEX: Record<string, number> = {
  'U': 0, 'F': 2, 'r': 4, 'BR': 4, 'l': 6, 'BL': 6,
  'D': 8, 'B': 10, 'R': 12, 'L': 14,
};

export function parseFtoScramble(scr: string): number[] {
  const tokens = scr.trim().split(/\s+/).filter(Boolean);
  const out: number[] = [];
  for (const tok of tokens) {
    let isPrime = false;
    let body = tok;
    if (body.endsWith("'")) { isPrime = true; body = body.slice(0, -1); }
    if (!(body in MOVE_TOKEN_TO_INDEX)) throw new Error(`FTO solver: unknown move "${tok}"`);
    out.push(MOVE_TOKEN_TO_INDEX[body] + (isPrime ? 1 : 0));
  }
  return out;
}

/** Apply a sequence of move indices to a cubie. */
export function applyMoves(fc: FtoCubie, moves: number[]): FtoCubie {
  let cur = fc;
  for (const m of moves) cur = ftoMultImpl([cur, moveCube[m]], new FtoCubie());
  return cur;
}

/** Solve an FTO scramble. Returns move-string + numeric move count. */
export function solveFto(scramble: string): { moves: string; length: number } {
  initMoveCube();
  const moves = parseFtoScramble(scramble);
  const fc = applyMoves(new FtoCubie(), moves);
  const sol = doSolve(fc, false);
  const cnt = sol.trim() === '' ? 0 : sol.trim().split(/\s+/).length;
  return { moves: sol, length: cnt };
}

/** Verify scramble + solution → solved state. Used by self-test. */
export function verifyScrambleSolution(scramble: string, solution: string): boolean {
  initMoveCube();
  const scr = parseFtoScramble(scramble);
  // Convert "BR"/"BL" back to lowercase r/l for parser.
  const solTokens = solution
    .trim().split(/\s+/).filter(Boolean)
    .map(t => t.replace(/^BR/, 'r').replace(/^BL/, 'l'));
  const sol = parseFtoScramble(solTokens.join(' '));
  const all = [...scr, ...sol];
  let cur = new FtoCubie();
  for (const m of all) cur = ftoMultImpl([cur, moveCube[m]], new FtoCubie());
  // Solved state: facelet array's per-face stickers all share the same color
  // per-face. Easier check: all of cp/co/ep/uf/rl match identity (mod symmetry?).
  // cstimer test asserts facelets[i*9..i*9+8] are all equal — implement that.
  const f = fcToFaceCube(cur);
  for (let face = 0; face < 8; face++) {
    for (let j = 1; j < 9; j++) {
      if (f[face * 9 + j] !== f[face * 9]) return false;
    }
  }
  return true;
}
