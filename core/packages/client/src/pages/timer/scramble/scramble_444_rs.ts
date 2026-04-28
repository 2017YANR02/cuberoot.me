/**
 * 4x4 random-state scramble — TypeScript port of cstimer's
 * `src/js/scramble/scramble_444.js` (multi-phase IDA*).
 *
 * Tables are built lazily on first call. Cold start is ~5-15 s; subsequent
 * solves are ~50-500 ms.
 *
 * The 3x3 reduction step (after centers + dedges are paired) uses the
 * existing kociemba two-phase solver in `./kociemba` for the final 3x3.
 *
 * Tables (rough sizes):
 *   - Center1Sym2Raw: 15582 entries (sym-reduced)
 *   - Center1SymMove: 15582*36 (Int32)
 *   - Center1SymPrun: 15582 (raw int8-range)
 *   - rlmv 70*28, rlrot 70*16, ctmv 6435*28, ctrot 6435*16, ctprun 450450
 *   - ctmove 29400*20, prun_0 29400
 *   - Edge3Prun 1937880 packed Int32 (~7.5 MB), Edge3Sym2Raw 1538,
 *     Edge3Raw2Sym 11880, mvrot/mvroto 168*12
 *
 * Public API:
 *   scramble444RandomState(rng?): string  // returns space-separated WCA notation
 *
 * Internal state types use `any` to keep the port mechanical.
 */

import {
  buildMoveTables,
  type MoveTables,
} from './kociemba/movetables';
import {
  buildPruneTables,
  type PruneTables,
} from './kociemba/prune';
import { solveCube } from './kociemba/search';
import { type CubieCube } from './kociemba/cube';

/* eslint-disable @typescript-eslint/no-explicit-any */

const DEBUG = false;

// ============================================================================
// mathlib helpers (inlined from cstimer mathlib.js)
// ============================================================================

const mathlib_Cnk: number[][] = [];
const mathlib_fact: number[] = [1];
{
  for (let i = 0; i < 32; ++i) {
    mathlib_Cnk[i] = [];
    for (let j = 0; j < 32; ++j) mathlib_Cnk[i][j] = 0;
  }
  for (let i = 0; i < 32; ++i) {
    mathlib_Cnk[i][0] = mathlib_Cnk[i][i] = 1;
    mathlib_fact[i + 1] = mathlib_fact[i] * (i + 1);
    for (let j = 1; j < i; ++j) {
      mathlib_Cnk[i][j] = mathlib_Cnk[i - 1][j - 1] + mathlib_Cnk[i - 1][j];
    }
  }
}
const Cnk = mathlib_Cnk;

function mathlib_bitCount(x: number): number {
  x -= (x >> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
  return (((x + (x >> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

function mathlib_setNPerm(arr: any[], idx: number, n: number, even?: number): any[] {
  let prt = 0;
  if (even !== undefined && even < 0) idx <<= 1;
  let vall = 0x76543210;
  let valh = 0xfedcba98;
  for (let i = 0; i < n - 1; i++) {
    const p = mathlib_fact[n - 1 - i];
    let v = Math.floor(idx / p);
    idx = idx % p;
    prt ^= v;
    v <<= 2;
    if (v >= 32) {
      v -= 32;
      arr[i] = (valh >> v) & 0xf;
      const m = (1 << v) - 1;
      valh = (valh & m) + ((valh >> 4) & ~m);
    } else {
      arr[i] = (vall >> v) & 0xf;
      const m = (1 << v) - 1;
      vall = (vall & m) + ((vall >>> 4) & ~m) + (valh << 28);
      valh = valh >> 4;
    }
  }
  if (even !== undefined && even < 0 && (prt & 1) !== 0) {
    arr[n - 1] = arr[n - 2];
    arr[n - 2] = vall & 0xf;
  } else {
    arr[n - 1] = vall & 0xf;
  }
  return arr;
}

function circleArr(arr: any[], ...idx: number[]): void {
  const length = idx.length;
  const temp = arr[idx[length - 1]];
  for (let i = length - 1; i > 0; i--) {
    arr[idx[i]] = arr[idx[i - 1]];
  }
  arr[idx[0]] = temp;
}

// ============================================================================
// Generic helpers (from cstimer scramble_444.js)
// ============================================================================

function createArray(length1: number, length2?: number): any[] {
  const result: any[] = new Array(length1);
  if (length2 !== undefined) {
    for (let i = 0; i < length1; i++) result[i] = new Array(length2);
  }
  return result;
}


function fill_0(a: any[]): void {
  for (let i = 0; i < a.length; i++) a[i] = -1;
}

function setPruning(table: any[], index: number, value: number): void {
  table[index >> 4] ^= (3 ^ value) << ((index & 15) << 1);
}

function getPruning_0(table: any[], index: number): number {
  return (table[index >> 4] >> ((index & 15) << 1)) & 3;
}

function binarySearch_0(sortedArray: any[], key: number): number {
  let low = 0, high = sortedArray.length - 1;
  while (low <= high) {
    const mid = low + ((high - low) >> 1);
    const midVal = sortedArray[mid];
    if (midVal < key) low = mid + 1;
    else if (midVal > key) high = mid - 1;
    else return mid;
  }
  return -low - 1;
}

function nowMs(): number {
  return Date.now();
}

function swap(arr: any[], a: number, b: number, c: number, d: number, key: number): void {
  let temp;
  switch (key) {
    case 0:
      temp = arr[d]; arr[d] = arr[c]; arr[c] = arr[b]; arr[b] = arr[a]; arr[a] = temp;
      return;
    case 1:
      temp = arr[a]; arr[a] = arr[c]; arr[c] = temp;
      temp = arr[b]; arr[b] = arr[d]; arr[d] = temp;
      return;
    case 2:
      temp = arr[a]; arr[a] = arr[b]; arr[b] = arr[c]; arr[c] = arr[d]; arr[d] = temp;
      return;
  }
}

function parity_0(arr: any[]): number {
  let parity = 0;
  let mask = 0;
  for (let i = 0; i < arr.length; i++) {
    const val = arr[i];
    parity ^= val - mathlib_bitCount(mask & ((1 << val) - 1));
    mask |= 1 << val;
  }
  return parity & 1;
}

// ============================================================================
// Center1
// ============================================================================

let Center1SymPrun: any[];
let Center1SymMove: any[];
let finish_0: any[];
let Center1Raw2Sym: any[] | null = null;
let Center1Sym2Raw: any[];
let Center1RotPerm: any[];
let SymInv: any[];
let SymMove: any[];
let SymMult: any[];

let clinitCenter1Done = false;
function $clinit_Center1(): void {
  if (clinitCenter1Done) return;
  clinitCenter1Done = true;
  Center1SymMove = createArray(15582, 36);
  Center1Sym2Raw = createArray(15582);
  Center1SymPrun = createArray(15582);
  SymMult = createArray(48, 48);
  SymMove = createArray(48, 36);
  SymInv = createArray(48);
  finish_0 = createArray(48);
}

function Center1$equals(obj: any, c: any): boolean {
  for (let i = 0; i < 24; ++i) if (obj.ct[i] !== c.ct[i]) return false;
  return true;
}

function $get_1(obj: any): number {
  let idx = 0;
  let r = 8;
  for (let i = 23; i >= 0; --i) {
    if (obj.ct[i] === 1) idx += Cnk[i][r--];
  }
  return idx;
}

function getCenter1RotThres(obj: any, rotPerm: number[], thres: number): number {
  let idx = 0;
  let r = 8;
  for (let i = 23; i >= 0; --i) {
    if (obj.ct[rotPerm[i]] === 1) idx += Cnk[i][r--];
    if (idx >= thres) return -1;
  }
  return idx;
}

function $getsym(obj: any): number {
  let ret = 0;
  if (Center1Raw2Sym !== null) {
    for (let s = 0; s < 48; s++) {
      const idx = getCenter1RotThres(obj, Center1RotPerm[s], Cnk[21][8]);
      if (idx !== -1) {
        ret = Center1Raw2Sym[idx];
        return (ret & ~0x3f) | SymMult[s][ret & 0x3f];
      }
    }
  }
  for (let j = 0; j < 48; ++j) {
    const cord = raw2sym_0($get_1(obj));
    if (cord !== -1) return cord * 64 + j;
    $rot(obj, 0);
    if (j % 2 === 1) $rot(obj, 1);
    if (j % 8 === 7) $rot(obj, 2);
    if (j % 16 === 15) $rot(obj, 3);
  }
  return 0;
}

function doMoveCenter1(obj: any, m: number): void {
  doMoveCenterCube(obj, m);
}

function $rot(obj: any, r: number): void {
  switch (r) {
    case 0:
      doMoveCenter1(obj, 19);
      doMoveCenter1(obj, 28);
      break;
    case 1:
      doMoveCenter1(obj, 21);
      doMoveCenter1(obj, 32);
      break;
    case 2:
      swap(obj.ct, 0, 3, 1, 2, 1);
      swap(obj.ct, 8, 11, 9, 10, 1);
      swap(obj.ct, 4, 7, 5, 6, 1);
      swap(obj.ct, 12, 15, 13, 14, 1);
      swap(obj.ct, 16, 19, 21, 22, 1);
      swap(obj.ct, 17, 18, 20, 23, 1);
      break;
    case 3:
      doMoveCenter1(obj, 18);
      doMoveCenter1(obj, 29);
      doMoveCenter1(obj, 24);
      doMoveCenter1(obj, 35);
      break;
  }
}

function Center1Rotate(obj: any, r: number): void {
  for (let j = 0; j < r; ++j) {
    $rot(obj, 0);
    if (j % 2 === 1) $rot(obj, 1);
    if (j % 8 === 7) $rot(obj, 2);
    if (j % 16 === 15) $rot(obj, 3);
  }
}

function $set_0(obj: any, idx: number): void {
  let r = 8;
  for (let i = 23; i >= 0; --i) {
    obj.ct[i] = 0;
    if (idx >= Cnk[i][r]) {
      idx -= Cnk[i][r--];
      obj.ct[i] = 1;
    }
  }
}

function $set_1(obj: any, c: any): void {
  for (let i = 0; i < 24; ++i) obj.ct[i] = c.ct[i];
}

function Center1(this: any, cc?: any): any {
  if (cc) {
    this.ct = cc.ct.slice();
    return;
  }
  this.ct = [];
  for (let i = 0; i < 24; ++i) this.ct[i] = i < 8 ? 1 : 0;
}

(Center1.prototype as any).fromCube = function (cc: any, urf: number): any {
  for (let i = 0; i < 24; ++i) {
    this.ct[i] = (cc.ct[i] % 3 === urf) ? 1 : 0;
  }
  return this;
};

function initCenter1MoveTable(): void {
  const c: any = new (Center1 as any)();
  const d: any = new (Center1 as any)();
  for (let i = 0; i < 15582; ++i) {
    $set_0(d, Center1Sym2Raw[i]);
    for (let m = 0; m < 36; ++m) {
      if (m % 3 === 1 || Center1SymMove[i][m] !== undefined) continue;
      $set_1(c, d);
      doMoveCenter1(c, m);
      const idx = $getsym(c);
      Center1SymMove[i][m] = idx;
      const invM = SymMove[idx & 0x3f][~~(m / 3) * 3 + 2 - (m % 3)];
      if (Center1SymMove[idx >> 6][invM] === undefined) {
        Center1SymMove[idx >> 6][invM] = (i << 6) | SymInv[idx & 0x3f];
      }
    }
  }
  for (let i = 0; i < 15582; i++) {
    for (let m = 0; m < 36; m += 3) {
      const idx = Center1SymMove[i][m];
      const nextM = SymMove[idx & 0x3f][m];
      const nextIdx = Center1SymMove[idx >>> 6][nextM];
      const symx = SymMult[idx & 0x3f][nextIdx & 0x3f];
      Center1SymMove[i][m + 1] = (nextIdx & ~0x3f) | symx;
    }
  }
}

function initCenter1Prun(): void {
  fill_0(Center1SymPrun);
  Center1SymPrun[0] = 0;
  let depth = 0;
  let done = 1;
  while (done !== 15582) {
    const inv = depth > 4;
    const select = inv ? -1 : depth;
    const check = inv ? depth : -1;
    ++depth;
    for (let i = 0; i < 15582; ++i) {
      if (Center1SymPrun[i] !== select) continue;
      for (let m = 0; m < 27; ++m) {
        const idx = Center1SymMove[i][m] >>> 6;
        if (Center1SymPrun[idx] !== check) continue;
        ++done;
        if (inv) { Center1SymPrun[i] = depth; break; }
        else Center1SymPrun[idx] = depth;
      }
    }
  }
}

function getSolvedSym(cube: any): number {
  const c: any = new (Center1 as any)(cube);
  for (let j = 0; j < 48; ++j) {
    let check = true;
    for (let i = 0; i < 24; ++i) {
      if (c.ct[i] !== (centerFacelet[i] >> 4)) { check = false; break; }
    }
    if (check) return j;
    $rot(c, 0);
    if (j % 2 === 1) $rot(c, 1);
    if (j % 8 === 7) $rot(c, 2);
    if (j % 16 === 15) $rot(c, 3);
  }
  return -1;
}

function initSymMeta(): void {
  const c: any = new (Center1 as any)();
  for (let i = 0; i < 24; ++i) c.ct[i] = i;
  const d: any = new (Center1 as any)(c);
  const e: any = new (Center1 as any)(c);
  const f: any = new (Center1 as any)(c);
  for (let i = 0; i < 48; ++i) {
    for (let j = 0; j < 48; ++j) {
      for (let k = 0; k < 48; ++k) {
        if (Center1$equals(c, d)) {
          SymMult[i][j] = k;
          if (k === 0) SymInv[i] = j;
        }
        $rot(d, 0);
        if (k % 2 === 1) $rot(d, 1);
        if (k % 8 === 7) $rot(d, 2);
        if (k % 16 === 15) $rot(d, 3);
      }
      $rot(c, 0);
      if (j % 2 === 1) $rot(c, 1);
      if (j % 8 === 7) $rot(c, 2);
      if (j % 16 === 15) $rot(c, 3);
    }
    $rot(c, 0);
    if (i % 2 === 1) $rot(c, 1);
    if (i % 8 === 7) $rot(c, 2);
    if (i % 16 === 15) $rot(c, 3);
  }
  for (let i = 0; i < 48; ++i) {
    $set_1(c, e);
    Center1Rotate(c, SymInv[i]);
    for (let j = 0; j < 36; ++j) {
      $set_1(d, c);
      doMoveCenter1(d, j);
      Center1Rotate(d, i);
      for (let k = 0; k < 36; ++k) {
        $set_1(f, e);
        doMoveCenter1(f, k);
        if (Center1$equals(f, d)) {
          SymMove[i][j] = k;
          break;
        }
      }
    }
  }
  $set_0(c, 0);
  for (let i = 0; i < 48; ++i) {
    finish_0[SymInv[i]] = $get_1(c);
    $rot(c, 0);
    if (i % 2 === 1) $rot(c, 1);
    if (i % 8 === 7) $rot(c, 2);
    if (i % 16 === 15) $rot(c, 3);
  }
}

function initCenter1Sym2Raw(): void {
  const c: any = new (Center1 as any)();
  Center1RotPerm = [];
  for (let i = 0; i < 24; i++) c.ct[i] = i;
  for (let s = 0; s < 48; s++) {
    Center1RotPerm[s] = c.ct.slice();
    $rot(c, 0);
    if (s % 2 === 1) $rot(c, 1);
    if (s % 8 === 7) $rot(c, 2);
    if (s % 16 === 15) $rot(c, 3);
  }
  const occ: number[] = createArray(22984);
  for (let i = 0; i < 22984; i++) occ[i] = 0;
  let count = 0;
  for (let i = 0; i < Cnk[21][8]; ++i) {
    if ((occ[i >>> 5] & (1 << (i & 31))) === 0) {
      $set_0(c, i);
      for (let j = 0; j < 48; ++j) {
        const idx = getCenter1RotThres(c, Center1RotPerm[j], Cnk[21][8]);
        if (idx === -1) continue;
        occ[idx >>> 5] |= 1 << (idx & 31);
        if (Center1Raw2Sym !== null) Center1Raw2Sym[idx] = (count << 6) | SymInv[j];
      }
      Center1Sym2Raw[count++] = i;
    }
  }
}

function raw2sym_0(n: number): number {
  const m = binarySearch_0(Center1Sym2Raw, n);
  return m >= 0 ? m : -1;
}

// ============================================================================
// Center2
// ============================================================================

let rlmv: any[], ctmv: any[], rlrot: any[], ctrot: any[], ctprun: any[], pmv: any[];
let clinitCenter2Done = false;
function $clinit_Center2(): void {
  if (clinitCenter2Done) return;
  clinitCenter2Done = true;
  rlmv = createArray(70, 28);
  ctmv = createArray(6435, 28);
  rlrot = createArray(70, 16);
  ctrot = createArray(6435, 16);
  ctprun = createArray(450450);
  pmv = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0];
}

function $getct(obj: any): number {
  let idx = 0;
  let r = 8;
  for (let i = 14; i >= 0; --i) {
    if (obj.ct[i] !== obj.ct[15]) idx += Cnk[i][r--];
  }
  return idx;
}

function $getrl(obj: any): number {
  let idx = 0;
  let r = 4;
  for (let i = 6; i >= 0; --i) {
    if (obj.rl[i] !== obj.rl[7]) idx += Cnk[i][r--];
  }
  return idx * 2 + obj.parity;
}

function doMoveCenter2(obj: any, m: number): void {
  obj.parity ^= pmv[m];
  const key = m % 3;
  m = ~~(m / 3);
  switch (m) {
    case 0: swap(obj.ct, 0, 1, 2, 3, key); break;
    case 1: swap(obj.rl, 0, 1, 2, 3, key); break;
    case 2: swap(obj.ct, 8, 9, 10, 11, key); break;
    case 3: swap(obj.ct, 4, 5, 6, 7, key); break;
    case 4: swap(obj.rl, 4, 5, 6, 7, key); break;
    case 5: swap(obj.ct, 12, 13, 14, 15, key); break;
    case 6:
      swap(obj.ct, 0, 1, 2, 3, key);
      swap(obj.rl, 0, 5, 4, 1, key);
      swap(obj.ct, 8, 9, 12, 13, key); break;
    case 7:
      swap(obj.rl, 0, 1, 2, 3, key);
      swap(obj.ct, 1, 15, 5, 9, key);
      swap(obj.ct, 2, 12, 6, 10, key); break;
    case 8:
      swap(obj.ct, 8, 9, 10, 11, key);
      swap(obj.rl, 0, 3, 6, 5, key);
      swap(obj.ct, 3, 2, 5, 4, key); break;
    case 9:
      swap(obj.ct, 4, 5, 6, 7, key);
      swap(obj.rl, 3, 2, 7, 6, key);
      swap(obj.ct, 11, 10, 15, 14, key); break;
    case 10:
      swap(obj.rl, 4, 5, 6, 7, key);
      swap(obj.ct, 0, 8, 4, 14, key);
      swap(obj.ct, 3, 11, 7, 13, key); break;
    case 11:
      swap(obj.ct, 12, 13, 14, 15, key);
      swap(obj.rl, 1, 4, 7, 2, key);
      swap(obj.ct, 1, 0, 7, 6, key);
      break;
  }
}

function $rot_0(obj: any, r: number): void {
  switch (r) {
    case 0:
      doMoveCenter2(obj, 19);
      doMoveCenter2(obj, 28);
      break;
    case 1:
      doMoveCenter2(obj, 21);
      doMoveCenter2(obj, 32);
      break;
    case 2:
      swap(obj.ct, 0, 3, 1, 2, 1);
      swap(obj.ct, 8, 11, 9, 10, 1);
      swap(obj.ct, 4, 7, 5, 6, 1);
      swap(obj.ct, 12, 15, 13, 14, 1);
      swap(obj.rl, 0, 3, 5, 6, 1);
      swap(obj.rl, 1, 2, 4, 7, 1);
  }
}

function $set_2(obj: any, c: any, edgeParity: number): void {
  for (let i = 0; i < 16; ++i) obj.ct[i] = c.ct[i] % 3;
  for (let i = 0; i < 8; ++i) obj.rl[i] = c.ct[i + 16];
  obj.parity = edgeParity;
}

function $setct(obj: any, idx: number): void {
  let r = 8;
  obj.ct[15] = 0;
  for (let i = 14; i >= 0; --i) {
    if (idx >= Cnk[i][r]) { idx -= Cnk[i][r--]; obj.ct[i] = 1; }
    else obj.ct[i] = 0;
  }
}

function $setrl(obj: any, idx: number): void {
  obj.parity = idx & 1;
  idx >>>= 1;
  let r = 4;
  obj.rl[7] = 0;
  for (let i = 6; i >= 0; --i) {
    if (idx >= Cnk[i][r]) { idx -= Cnk[i][r--]; obj.rl[i] = 1; }
    else obj.rl[i] = 0;
  }
}

function Center2(this: any): any {
  this.rl = createArray(8);
  this.ct = createArray(16);
  this.parity = 0;
}

(Center2.prototype as any).copy = function (obj: any): void {
  for (let i = 0; i < 8; i++) this.rl[i] = obj.rl[i];
  for (let i = 0; i < 16; i++) this.ct[i] = obj.ct[i];
  this.parity = obj.parity;
};

function initCenter2(): void {
  const c: any = new (Center2 as any)();
  const d: any = new (Center2 as any)();
  for (let i = 0; i < 70; ++i) {
    for (let m = 0; m < 28; ++m) {
      $setrl(c, i);
      doMoveCenter2(c, move2std[m]);
      rlmv[i][m] = $getrl(c);
    }
  }
  for (let i = 0; i < 70; ++i) {
    $setrl(c, i);
    for (let j = 0; j < 16; ++j) {
      rlrot[i][j] = $getrl(c);
      $rot_0(c, 0);
      if (j % 2 === 1) $rot_0(c, 1);
      if (j % 8 === 7) $rot_0(c, 2);
    }
  }
  for (let i = 0; i < 6435; ++i) {
    $setct(c, i);
    for (let j = 0; j < 16; ++j) {
      ctrot[i][j] = $getct(c);
      $rot_0(c, 0);
      if (j % 2 === 1) $rot_0(c, 1);
      if (j % 8 === 7) $rot_0(c, 2);
    }
  }
  for (let i = 0; i < 6435; ++i) {
    $setct(c, i);
    for (let m = 0; m < 28; ++m) {
      d.copy(c);
      doMoveCenter2(d, move2std[m]);
      ctmv[i][m] = $getct(d);
    }
  }
  fill_0(ctprun);
  ctprun[0] = ctprun[18] = ctprun[28] = ctprun[46] = ctprun[54] = ctprun[56] = 0;
  let depth = 0;
  let done = 6;
  while (done !== 450450) {
    const inv = depth > 6;
    const select = inv ? -1 : depth;
    const check = inv ? depth : -1;
    ++depth;
    for (let i = 0; i < 450450; ++i) {
      if (ctprun[i] !== select) continue;
      const ct = ~~(i / 70);
      const rl = i % 70;
      for (let m = 0; m < 23; ++m) {
        const ctx = ctmv[ct][m];
        const rlx = rlmv[rl][m];
        const idx = ctx * 70 + rlx;
        if (ctprun[idx] !== check) continue;
        ++done;
        if (inv) { ctprun[i] = depth; break; }
        else ctprun[idx] = depth;
      }
    }
  }
}

// ============================================================================
// Center3
// ============================================================================

let ctmove: any[], pmove: any[], prun_0: any[], rl2std: any[], std2rl: any[];

let clinitCenter3Done = false;
function $clinit_Center3(): void {
  if (clinitCenter3Done) return;
  clinitCenter3Done = true;
  ctmove = createArray(29400, 20);
  pmove = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1];
  prun_0 = createArray(29400);
  rl2std = [0, 9, 14, 23, 27, 28, 41, 42, 46, 55, 60, 69];
  std2rl = createArray(70);
}

function $getct_0(obj: any): number {
  let idx = 0;
  let r = 4;
  for (let i = 6; i >= 0; --i) {
    if (obj.ud[i] !== obj.ud[7]) idx += Cnk[i][r--];
  }
  idx *= 35;
  r = 4;
  for (let i = 6; i >= 0; --i) {
    if (obj.fb[i] !== obj.fb[7]) idx += Cnk[i][r--];
  }
  idx *= 12;
  const check = obj.fb[7] ^ obj.ud[7];
  let idxrl = 0;
  r = 4;
  for (let i = 7; i >= 0; --i) {
    if (obj.rl[i] !== check) idxrl += Cnk[i][r--];
  }
  return obj.parity + 2 * (idx + std2rl[idxrl]);
}

function doMoveCenter3(obj: any, i: number): void {
  obj.parity ^= pmove[i];
  switch (i) {
    case 0: case 1: case 2:
      swap(obj.ud, 0, 1, 2, 3, i % 3); break;
    case 3:
      swap(obj.rl, 0, 1, 2, 3, 1); break;
    case 4: case 5: case 6:
      swap(obj.fb, 0, 1, 2, 3, (i - 1) % 3); break;
    case 7: case 8: case 9:
      swap(obj.ud, 4, 5, 6, 7, (i - 1) % 3); break;
    case 10:
      swap(obj.rl, 4, 5, 6, 7, 1); break;
    case 11: case 12: case 13:
      swap(obj.fb, 4, 5, 6, 7, (i + 1) % 3); break;
    case 14:
      swap(obj.ud, 0, 1, 2, 3, 1);
      swap(obj.rl, 0, 5, 4, 1, 1);
      swap(obj.fb, 0, 5, 4, 1, 1); break;
    case 15:
      swap(obj.rl, 0, 1, 2, 3, 1);
      swap(obj.fb, 1, 4, 7, 2, 1);
      swap(obj.ud, 1, 6, 5, 2, 1); break;
    case 16:
      swap(obj.fb, 0, 1, 2, 3, 1);
      swap(obj.ud, 3, 2, 5, 4, 1);
      swap(obj.rl, 0, 3, 6, 5, 1); break;
    case 17:
      swap(obj.ud, 4, 5, 6, 7, 1);
      swap(obj.rl, 3, 2, 7, 6, 1);
      swap(obj.fb, 3, 2, 7, 6, 1); break;
    case 18:
      swap(obj.rl, 4, 5, 6, 7, 1);
      swap(obj.fb, 0, 3, 6, 5, 1);
      swap(obj.ud, 0, 3, 4, 7, 1); break;
    case 19:
      swap(obj.fb, 4, 5, 6, 7, 1);
      swap(obj.ud, 0, 7, 6, 1, 1);
      swap(obj.rl, 1, 4, 7, 2, 1); break;
  }
}

function $set_3(obj: any, c: any, eXc_parity: number): void {
  const parity = ((c.ct[0] % 3 > c.ct[8] % 3) !== (c.ct[8] % 3 > c.ct[16] % 3)) !== (c.ct[0] % 3 > c.ct[16] % 3) ? 0 : 1;
  for (let i = 0; i < 8; ++i) {
    obj.ud[i] = (~~(c.ct[i] / 3)) ^ 1;
    obj.fb[i] = (~~(c.ct[i + 8] / 3)) ^ 1;
    obj.rl[i] = ((~~(c.ct[i + 16] / 3)) ^ 1) ^ parity;
  }
  obj.parity = parity ^ eXc_parity;
}

function $setct_0(obj: any, idx: number): void {
  obj.parity = idx & 1;
  idx >>>= 1;
  let idxrl = rl2std[idx % 12];
  idx = ~~(idx / 12);
  let r = 4;
  for (let i = 7; i >= 0; --i) {
    obj.rl[i] = 0;
    if (idxrl >= Cnk[i][r]) { idxrl -= Cnk[i][r--]; obj.rl[i] = 1; }
  }
  let idxfb = idx % 35;
  idx = ~~(idx / 35);
  r = 4;
  obj.fb[7] = 0;
  for (let i = 6; i >= 0; --i) {
    if (idxfb >= Cnk[i][r]) { idxfb -= Cnk[i][r--]; obj.fb[i] = 1; }
    else obj.fb[i] = 0;
  }
  r = 4;
  obj.ud[7] = 0;
  for (let i = 6; i >= 0; --i) {
    if (idx >= Cnk[i][r]) { idx -= Cnk[i][r--]; obj.ud[i] = 1; }
    else obj.ud[i] = 0;
  }
}

function Center3(this: any): any {
  this.ud = createArray(8);
  this.rl = createArray(8);
  this.fb = createArray(8);
  this.parity = 0;
}

(Center3.prototype as any).copy = function (obj: any): void {
  for (let i = 0; i < 8; i++) {
    this.ud[i] = obj.ud[i];
    this.rl[i] = obj.rl[i];
    this.fb[i] = obj.fb[i];
  }
  this.parity = obj.parity;
};

function initCenter3(): void {
  for (let i = 0; i < 12; ++i) std2rl[rl2std[i]] = i;
  const c: any = new (Center3 as any)();
  const d: any = new (Center3 as any)();
  for (let i = 0; i < 29400; ++i) {
    $setct_0(c, i);
    for (let m = 0; m < 20; ++m) {
      d.copy(c);
      doMoveCenter3(d, m);
      ctmove[i][m] = $getct_0(d);
    }
  }
  fill_0(prun_0);
  prun_0[0] = 0;
  let depth = 0;
  let done = 1;
  while (done !== 29400) {
    for (let i = 0; i < 29400; ++i) {
      if (prun_0[i] !== depth) continue;
      for (let m = 0; m < 17; ++m) {
        if (prun_0[ctmove[i][m]] === -1) {
          prun_0[ctmove[i][m]] = depth + 1;
          ++done;
        }
      }
    }
    ++depth;
  }
}

// ============================================================================
// CenterCube
// ============================================================================

function $copy_1(obj: any, c: any): void {
  for (let i = 0; i < 24; ++i) obj.ct[i] = c.ct[i];
}

function doMoveCenterCube(obj: any, m: number): void {
  const key = m % 3;
  m = ~~(m / 3);
  // See doMoveEdge for the fallthrough rationale: m=6..11 are slice moves
  // that additionally do the corresponding outer-layer move (m=0..5).
  if (m >= 6) {
    switch (m) {
      case 6:
        swap(obj.ct, 8, 20, 12, 16, key);
        swap(obj.ct, 9, 21, 13, 17, key);
        break;
      case 7:
        swap(obj.ct, 1, 15, 5, 9, key);
        swap(obj.ct, 2, 12, 6, 10, key);
        break;
      case 8:
        swap(obj.ct, 2, 19, 4, 21, key);
        swap(obj.ct, 3, 16, 5, 22, key);
        break;
      case 9:
        swap(obj.ct, 10, 18, 14, 22, key);
        swap(obj.ct, 11, 19, 15, 23, key);
        break;
      case 10:
        swap(obj.ct, 0, 8, 4, 14, key);
        swap(obj.ct, 3, 11, 7, 13, key);
        break;
      case 11:
        swap(obj.ct, 1, 20, 7, 18, key);
        swap(obj.ct, 0, 23, 6, 17, key);
        break;
    }
  }
  switch (m % 6) {
    case 0: swap(obj.ct, 0, 1, 2, 3, key); break;
    case 1: swap(obj.ct, 16, 17, 18, 19, key); break;
    case 2: swap(obj.ct, 8, 9, 10, 11, key); break;
    case 3: swap(obj.ct, 4, 5, 6, 7, key); break;
    case 4: swap(obj.ct, 20, 21, 22, 23, key); break;
    case 5: swap(obj.ct, 12, 13, 14, 15, key); break;
  }
}

function CenterCube(this: any): any {
  this.ct = [];
  for (let i = 0; i < 24; ++i) this.ct[i] = centerFacelet[i] >> 4;
}

// ============================================================================
// CornerCube
// ============================================================================

let CornerMoveCube: any[];
let clinitCornerCubeDone = false;
function $clinit_CornerCube(): void {
  if (clinitCornerCubeDone) return;
  clinitCornerCubeDone = true;
  CornerMoveCube = createArray(18);
  initMove_0();
}

function $$init_2(obj: any): void {
  obj.cp = [0, 1, 2, 3, 4, 5, 6, 7];
  obj.co = [0, 0, 0, 0, 0, 0, 0, 0];
}

function $copy_2(obj: any, c: any): void {
  for (let i = 0; i < 8; ++i) {
    obj.cp[i] = c.cp[i];
    obj.co[i] = c.co[i];
  }
}

function $move_3(obj: any, idx: number): void {
  if (!obj.temps) obj.temps = new (CornerCube_0 as any)();
  CornMult_0(obj, CornerMoveCube[idx], obj.temps);
  $copy_2(obj, obj.temps);
}

function $setTwist_0(obj: any, idx: number): void {
  let twst = 0;
  for (let i = 6; i >= 0; --i) {
    twst += (obj.co[i] = idx % 3);
    idx = ~~(idx / 3);
  }
  obj.co[7] = (15 - twst) % 3;
}

function CornMult_0(a: any, b: any, prod: any): void {
  for (let corn = 0; corn < 8; ++corn) {
    prod.cp[corn] = a.cp[b.cp[corn]];
    const oriA = a.co[b.cp[corn]];
    const oriB = b.co[corn];
    let ori = oriA;
    ori = ori + (oriA < 3 ? oriB : 6 - oriB);
    ori = ori % 3;
    if ((oriA >= 3) !== (oriB >= 3)) ori = ori + 3;
    prod.co[corn] = ori;
  }
}

function CornerCube_0(this: any): any {
  $$init_2(this);
}

function CornerCube_1(this: any, cperm: number, twist: number): any {
  $$init_2(this);
  mathlib_setNPerm(this.cp, cperm, 8);
  $setTwist_0(this, twist);
}

function initMove_0(): void {
  CornerMoveCube[0] = new (CornerCube_1 as any)(15120, 0);
  CornerMoveCube[3] = new (CornerCube_1 as any)(21021, 1494);
  CornerMoveCube[6] = new (CornerCube_1 as any)(8064, 1236);
  CornerMoveCube[9] = new (CornerCube_1 as any)(9, 0);
  CornerMoveCube[12] = new (CornerCube_1 as any)(1230, 412);
  CornerMoveCube[15] = new (CornerCube_1 as any)(224, 137);
  for (let a = 0; a < 18; a += 3) {
    for (let p = 0; p < 2; ++p) {
      CornerMoveCube[a + p + 1] = new (CornerCube_0 as any)();
      CornMult_0(CornerMoveCube[a + p], CornerMoveCube[a], CornerMoveCube[a + p + 1]);
    }
  }
}

// Map prototype methods (defineClass equivalent — but TS can't redirect prototypes easily,
// so we just make sure both share same temp slot via shared prototype).
(CornerCube_1.prototype as any).temps = null;
(CornerCube_0.prototype as any).temps = null;

// ============================================================================
// Edge3
// ============================================================================

let prunValues: number[];
let Edge3Prun: Int32Array;
let Edge3Sym2Raw: any[];
let Edge3Sym2Mask: any[];
let symstate: any[];
let Edge3Raw2Sym: any[];
let syminv_0: number[];
let mvrot: any[];
let mvroto: any[];
let factX: number[];
let FullEdgeMap: number[];

let clinitEdge3Done = false;
function $clinit_Edge3(): void {
  if (clinitEdge3Done) return;
  clinitEdge3Done = true;
  prunValues = [1, 4, 16, 55, 324, 1922, 12275, 77640, 485359, 2778197, 11742425, 27492416, 31002941, 31006080];
  void prunValues;
  Edge3Prun = new Int32Array(1937880);
  Edge3Sym2Raw = createArray(1538);
  Edge3Sym2Mask = createArray(1538);
  symstate = createArray(1538);
  Edge3Raw2Sym = createArray(11880);
  syminv_0 = [0, 1, 6, 3, 4, 5, 2, 7];
  mvrot = createArray(168, 12);
  mvroto = createArray(168, 12);
  factX = [1, 1, 1, 3, 12, 60, 360, 2520, 20160, 181440, 1814400, 19958400, 239500800];
  FullEdgeMap = [0, 2, 4, 6, 1, 3, 7, 5, 8, 9, 10, 11];
}

function $circlex(obj: any, a: number, b: number, c: number, d: number): void {
  const temp = obj.edgeo[d];
  obj.edgeo[d] = obj.edge[c];
  obj.edge[c] = obj.edgeo[b];
  obj.edgeo[b] = obj.edge[a];
  obj.edge[a] = temp;
}

function $get_2(obj: any, end: number, returnMask?: boolean): number {
  if (!obj.isStd) $std(obj);
  return get12Perm(obj.edge, end, returnMask);
}

function get12Perm(arr: number[], end: number, returnMask?: boolean): number {
  let idx = 0;
  let mask = 0;
  for (let i = 0; i < end; i++) {
    const val = arr[i];
    idx = idx * (12 - i) + val - mathlib_bitCount(mask & ((1 << val) - 1));
    mask |= 1 << val;
  }
  return returnMask ? mask : idx;
}

function $getsym_0(obj: any): number {
  if (!obj.isStd) $std(obj);
  return getMvSym(obj.edge, 20) >> 3;
}

function $move_4(obj: any, i: number): void {
  obj.isStd = false;
  switch (i) {
    case 0: circleArr(obj.edge, 0, 4, 1, 5); circleArr(obj.edgeo, 0, 4, 1, 5); break;
    case 1: $swap_0(obj.edge, 0, 4, 1, 5); $swap_0(obj.edgeo, 0, 4, 1, 5); break;
    case 2: circleArr(obj.edge, 0, 5, 1, 4); circleArr(obj.edgeo, 0, 5, 1, 4); break;
    case 3: $swap_0(obj.edge, 5, 10, 6, 11); $swap_0(obj.edgeo, 5, 10, 6, 11); break;
    case 4: circleArr(obj.edge, 0, 11, 3, 8); circleArr(obj.edgeo, 0, 11, 3, 8); break;
    case 5: $swap_0(obj.edge, 0, 11, 3, 8); $swap_0(obj.edgeo, 0, 11, 3, 8); break;
    case 6: circleArr(obj.edge, 0, 8, 3, 11); circleArr(obj.edgeo, 0, 8, 3, 11); break;
    case 7: circleArr(obj.edge, 2, 7, 3, 6); circleArr(obj.edgeo, 2, 7, 3, 6); break;
    case 8: $swap_0(obj.edge, 2, 7, 3, 6); $swap_0(obj.edgeo, 2, 7, 3, 6); break;
    case 9: circleArr(obj.edge, 2, 6, 3, 7); circleArr(obj.edgeo, 2, 6, 3, 7); break;
    case 10: $swap_0(obj.edge, 4, 8, 7, 9); $swap_0(obj.edgeo, 4, 8, 7, 9); break;
    case 11: circleArr(obj.edge, 1, 9, 2, 10); circleArr(obj.edgeo, 1, 9, 2, 10); break;
    case 12: $swap_0(obj.edge, 1, 9, 2, 10); $swap_0(obj.edgeo, 1, 9, 2, 10); break;
    case 13: circleArr(obj.edge, 1, 10, 2, 9); circleArr(obj.edgeo, 1, 10, 2, 9); break;
    case 14:
      $swap_0(obj.edge, 0, 4, 1, 5); $swap_0(obj.edgeo, 0, 4, 1, 5);
      circleArr(obj.edge, 9, 11); circleArr(obj.edgeo, 8, 10); break;
    case 15:
      $swap_0(obj.edge, 5, 10, 6, 11); $swap_0(obj.edgeo, 5, 10, 6, 11);
      circleArr(obj.edge, 1, 3); circleArr(obj.edgeo, 0, 2); break;
    case 16:
      $swap_0(obj.edge, 0, 11, 3, 8); $swap_0(obj.edgeo, 0, 11, 3, 8);
      circleArr(obj.edge, 5, 7); circleArr(obj.edgeo, 4, 6); break;
    case 17:
      $swap_0(obj.edge, 2, 7, 3, 6); $swap_0(obj.edgeo, 2, 7, 3, 6);
      circleArr(obj.edge, 8, 10); circleArr(obj.edgeo, 9, 11); break;
    case 18:
      $swap_0(obj.edge, 4, 8, 7, 9); $swap_0(obj.edgeo, 4, 8, 7, 9);
      circleArr(obj.edge, 0, 2); circleArr(obj.edgeo, 1, 3); break;
    case 19:
      $swap_0(obj.edge, 1, 9, 2, 10); $swap_0(obj.edgeo, 1, 9, 2, 10);
      circleArr(obj.edge, 4, 6); circleArr(obj.edgeo, 5, 7); break;
  }
}

function $rot_1(obj: any, r: number): void {
  obj.isStd = false;
  switch (r) {
    case 0:
      $move_4(obj, 14);
      $move_4(obj, 17);
      break;
    case 1:
      $circlex(obj, 11, 5, 10, 6);
      $circlex(obj, 5, 10, 6, 11);
      $circlex(obj, 1, 2, 3, 0);
      $circlex(obj, 4, 9, 7, 8);
      $circlex(obj, 8, 4, 9, 7);
      $circlex(obj, 0, 1, 2, 3);
      break;
    case 2:
      $swapx(obj, 4, 5);
      $swapx(obj, 5, 4);
      $swapx(obj, 11, 8);
      $swapx(obj, 8, 11);
      $swapx(obj, 7, 6);
      $swapx(obj, 6, 7);
      $swapx(obj, 9, 10);
      $swapx(obj, 10, 9);
      $swapx(obj, 1, 1);
      $swapx(obj, 0, 0);
      $swapx(obj, 3, 3);
      $swapx(obj, 2, 2);
  }
}

function $rotate_0(obj: any, r: number): void {
  while (r >= 2) {
    r -= 2;
    $rot_1(obj, 1);
    $rot_1(obj, 2);
  }
  if (r !== 0) $rot_1(obj, 0);
}

function $set_4(obj: any, idx: number): void {
  let vall = 0x76543210;
  let valh = 0xba98;
  let parity = 0;
  for (let i = 0; i < 11; ++i) {
    const p = factX[11 - i];
    const vi = ~~(idx / p);
    idx = idx % p;
    parity ^= vi;
    let v = vi << 2;
    if (v >= 32) {
      v = v - 32;
      obj.edge[i] = (valh >> v) & 15;
      const m = (1 << v) - 1;
      valh = (valh & m) + ((valh >> 4) & ~m);
    } else {
      obj.edge[i] = (vall >> v) & 15;
      const m = (1 << v) - 1;
      vall = (vall & m) + ((vall >>> 4) & ~m) + (valh << 28);
      valh = valh >> 4;
    }
  }
  if ((parity & 1) === 0) {
    obj.edge[11] = vall;
  } else {
    obj.edge[11] = obj.edge[10];
    obj.edge[10] = vall;
  }
  for (let i = 0; i < 12; ++i) obj.edgeo[i] = i;
  obj.isStd = true;
}

function $set_5(obj: any, e: any): void {
  for (let i = 0; i < 12; ++i) {
    obj.edge[i] = e.edge[i];
    obj.edgeo[i] = e.edgeo[i];
  }
  obj.isStd = e.isStd;
}

function $set_6(obj: any, c: any): number {
  if (obj.temp == null) obj.temp = createArray(12);
  for (let i = 0; i < 12; ++i) {
    obj.temp[i] = i;
    obj.edge[i] = c.ep[FullEdgeMap[i] + 12] % 12;
  }
  let parity = 1;
  for (let i = 0; i < 12; ++i) {
    while (obj.edge[i] !== i) {
      const t = obj.edge[i];
      obj.edge[i] = obj.edge[t];
      obj.edge[t] = t;
      const s = obj.temp[i];
      obj.temp[i] = obj.temp[t];
      obj.temp[t] = s;
      parity ^= 1;
    }
  }
  for (let i = 0; i < 12; ++i) {
    obj.edge[i] = obj.temp[c.ep[FullEdgeMap[i]] % 12];
  }
  return parity;
}

function $std(obj: any): void {
  if (obj.temp == null) obj.temp = createArray(12);
  for (let i = 0; i < 12; ++i) obj.temp[obj.edgeo[i]] = i;
  for (let i = 0; i < 12; ++i) {
    obj.edge[i] = obj.temp[obj.edge[i]];
    obj.edgeo[i] = i;
  }
  obj.isStd = true;
}

function $swap_0(arr: any[], a: number, b: number, c: number, d: number): void {
  let temp = arr[a]; arr[a] = arr[c]; arr[c] = temp;
  temp = arr[b]; arr[b] = arr[d]; arr[d] = temp;
}

function $swapx(obj: any, x: number, y: number): void {
  const temp = obj.edge[x];
  obj.edge[x] = obj.edgeo[y];
  obj.edgeo[y] = temp;
}

function Edge3_0(this: any): any {
  this.edge = createArray(12);
  this.edgeo = createArray(12);
  this.isStd = true;
  this.temp = null;
}

function initEdge3Prun(): void {
  const e: any = new (Edge3_0 as any)();
  const f: any = new (Edge3_0 as any)();
  const g: any = new (Edge3_0 as any)();
  // initialize prun bits to 3 ("unset")
  for (let i = 0; i < Edge3Prun.length; i++) Edge3Prun[i] = -1;

  let depth = 0;
  let done = 1;
  setPruning(Edge3Prun as any, 0, 0);
  const bfsMoves = [1, 0, 2, 3, 5, 4, 6, 8, 7, 9, 10, 12, 11, 13, 14, 15, 16];
  const start = nowMs();
  while (done !== 31006080) {
    const inv = depth > 9;
    const depm3 = depth % 3;
    const dep1m3 = (depth + 1) % 3;
    const dep2m3 = (depth + 2) % 3;
    const find_0 = inv ? 3 : depm3;
    const chk = inv ? depm3 : 3;
    const find_mask = find_0 * 0x55555555;
    if (depth >= EDGE3_MAX_PRUN - 1) break;
    for (let i_ = 0; i_ < 31006080; i_ += 16) {
      let val = Edge3Prun[i_ >> 4];
      const chkmask = val ^ find_mask;
      if ((!inv && val === -1) || (((chkmask - 0x55555555) & ~chkmask & 0xaaaaaaaa) === 0)) continue;
      for (let i = i_, end = i_ + 16; i < end; ++i, val >>= 2) {
        if ((val & 3) !== find_0) continue;
        const symcord1 = ~~(i / 20160);
        const cord1 = Edge3Sym2Raw[symcord1];
        const cord2 = i % 20160;
        $set_4(e, cord1 * 20160 + cord2);
        for (let mi = 0; mi < 17; ++mi) {
          const m = bfsMoves[mi];
          const idxFull = getMvSym(e.edge, m, Edge3SymMove[m][symcord1]);
          const symx = idxFull & 7;
          const idx = idxFull >> 3;
          const prun = getPruning_0(Edge3Prun as any, idx);
          if (prun !== chk) {
            if (prun === dep2m3 || (prun === depm3 && idx < i)) {
              mi = skipAxis3[m];
            }
            continue;
          }
          setPruning(Edge3Prun as any, inv ? i : idx, dep1m3);
          ++done;
          if (inv) break;
          const symcord1x = ~~(idx / 20160);
          let symState = symstate[symcord1x];
          if (symState === 1) continue;
          $set_5(f, e);
          $move_4(f, m);
          $rotate_0(f, symx);
          for (let j = 1; (symState = symState >> 1) !== 0; ++j) {
            if ((symState & 1) !== 1) continue;
            $set_5(g, f);
            $rotate_0(g, j);
            const idxx = symcord1x * 20160 + ($get_2(g, 10) % 20160);
            if (getPruning_0(Edge3Prun as any, idxx) === chk) {
              setPruning(Edge3Prun as any, idxx, dep1m3);
              ++done;
            }
          }
        }
      }
    }
    ++depth;
    if (DEBUG) console.log('[scramble 444] edge3 pruning ', depth, done, nowMs() - start);
  }
}

function getMvSym(ep: number[], mv: number, assumeIdx?: number): number {
  let mrIdx = mv << 3;
  let movo, mov;
  let idx = 0;
  let mask = 0;
  if (assumeIdx !== undefined && move3std[mv] % 3 === 1) {
    mrIdx |= assumeIdx & 0x7;
    idx = assumeIdx >> 3;
  } else {
    movo = mvroto[mrIdx];
    mov = mvrot[mrIdx];
    for (let i = 0; i < 4; i++) {
      const val = movo[ep[mov[i]]];
      idx = idx * (12 - i) + val - mathlib_bitCount(mask & ((1 << val) - 1));
      mask |= 1 << val;
    }
    idx = Edge3Raw2Sym[idx];
    mrIdx |= idx & 7;
    idx >>= 3;
  }
  movo = mvroto[mrIdx];
  mov = mvrot[mrIdx];
  mask = Edge3Sym2Mask[idx];
  for (let i = 4; i < 10; i++) {
    const val = movo[ep[mov[i]]];
    idx = idx * (12 - i) + val - mathlib_bitCount(mask & ((1 << val) - 1));
    mask |= 1 << val;
  }
  return (idx << 3) | (mrIdx & 0x7);
}

const EDGE3_MAX_PRUN = 10;

function getprun(edge: number): number {
  const e: any = new (Edge3_0 as any)();
  let depth = 0;
  let depm3 = getPruning_0(Edge3Prun as any, edge);
  if (depm3 === 3) return EDGE3_MAX_PRUN;
  while (edge !== 0) {
    depm3 = (depm3 + 2) % 3;
    const symcord1 = ~~(edge / 20160);
    const cord1 = Edge3Sym2Raw[symcord1];
    const cord2 = edge % 20160;
    $set_4(e, cord1 * 20160 + cord2);
    for (let m = 0; m < 17; ++m) {
      const idx = getMvSym(e.edge, m) >> 3;
      if (getPruning_0(Edge3Prun as any, idx) === depm3) {
        ++depth;
        edge = idx;
        break;
      }
    }
  }
  return depth;
}

function getprun_0(edge: number, prun: number): number {
  const depm3 = getPruning_0(Edge3Prun as any, edge);
  if (depm3 === 3) return EDGE3_MAX_PRUN;
  return (((0x49249249 << depm3) >> prun) & 3) + prun - 1;
}

function initEdge3MvRot(): void {
  const e: any = new (Edge3_0 as any)();
  for (let m = 0; m < 21; ++m) {
    for (let r = 0; r < 8; ++r) {
      $set_4(e, 0);
      $move_4(e, m);
      $rotate_0(e, r);
      for (let i = 0; i < 12; ++i) mvrot[(m << 3) | r][i] = e.edge[i];
      $std(e);
      for (let i = 0; i < 12; ++i) mvroto[(m << 3) | r][i] = e.temp[i];
    }
  }
}

const Edge3SymMove: any[] = [];

function initEdge3Sym2Raw(): void {
  const e: any = new (Edge3_0 as any)();
  const occ: number[] = createArray(1485);
  for (let i = 0; i < 1485; i++) occ[i] = 0;
  let count = 0;
  for (let i = 0; i < 11880; ++i) {
    if ((occ[i >>> 3] & (1 << (i & 7))) === 0) {
      $set_4(e, i * factX[8]);
      Edge3Sym2Raw[count] = i;
      Edge3Sym2Mask[count] = $get_2(e, 4, true);
      for (let j = 0; j < 8; ++j) {
        const idx = $get_2(e, 4);
        if (idx === i) symstate[count] = symstate[count] | (1 << j);
        occ[idx >> 3] |= 1 << (idx & 7);
        Edge3Raw2Sym[idx] = (count << 3) | syminv_0[j];
        $rot_1(e, 0);
        if (j % 2 === 1) {
          $rot_1(e, 1);
          $rot_1(e, 2);
        }
      }
      count++;
    }
  }
  for (let m = 0; m < 20; m++) Edge3SymMove[m] = [];
  for (let i = 0; i < 1538; i++) {
    $set_4(e, Edge3Sym2Raw[i] * factX[8]);
    for (let m = 0; m < 20; ++m) {
      if (move3std[m] % 3 !== 1) continue;
      const idx = getMvSym(e.edge, m);
      Edge3SymMove[m][i] = (~~((idx >> 3) / 20160) << 3) | (idx & 0x7);
    }
  }
}

function checkPhase2Edge(epInv: number[], moves: number[], length: number): boolean {
  let parity = 0;
  for (let i = 0; i < 12; i++) {
    let e = epInv[i];
    let eo = epInv[i + 12];
    for (let j = 0; j < length; j++) {
      const moveMap = epMoveMap[moves[j]];
      e = moveMap[e];
      eo = moveMap[eo];
    }
    if ((e < 12) !== (eo >= 12)) return false;
    parity ^= e >= 12 ? 1 : 0;
  }
  return parity === 0;
}

// ============================================================================
// EdgeCube
// ============================================================================

function $copy_3(obj: any, c: any): void {
  for (let i = 0; i < 24; ++i) obj.ep[i] = c.ep[i];
}

function doMoveEdge(obj: any, m: number): void {
  const key = m % 3;
  m = ~~(m / 3);
  // cstimer source uses switch fallthrough where m=6..11 are slice moves that
  // additionally do the corresponding outer-layer move (m=0..5). TS strict
  // mode rejects fallthrough comments here, so we hoist the slice-only swap
  // and then run the outer-layer case selected by m%6.
  if (m >= 6) {
    switch (m) {
      case 6:  swap(obj.ep, 9, 22, 11, 20, key); break;
      case 7:  swap(obj.ep, 2, 16, 6, 12, key); break;
      case 8:  swap(obj.ep, 3, 19, 5, 13, key); break;
      case 9:  swap(obj.ep, 8, 23, 10, 21, key); break;
      case 10: swap(obj.ep, 14, 0, 18, 4, key); break;
      case 11: swap(obj.ep, 7, 15, 1, 17, key); break;
    }
  }
  switch (m % 6) {
    case 0:
      swap(obj.ep, 0, 1, 2, 3, key);
      swap(obj.ep, 12, 13, 14, 15, key);
      break;
    case 1:
      swap(obj.ep, 11, 15, 10, 19, key);
      swap(obj.ep, 23, 3, 22, 7, key);
      break;
    case 2:
      swap(obj.ep, 0, 11, 6, 8, key);
      swap(obj.ep, 12, 23, 18, 20, key);
      break;
    case 3:
      swap(obj.ep, 4, 5, 6, 7, key);
      swap(obj.ep, 16, 17, 18, 19, key);
      break;
    case 4:
      swap(obj.ep, 1, 20, 5, 21, key);
      swap(obj.ep, 13, 8, 17, 9, key);
      break;
    case 5:
      swap(obj.ep, 2, 9, 4, 10, key);
      swap(obj.ep, 14, 21, 16, 22, key);
      break;
  }
}

function EdgeCube(this: any): any {
  this.ep = [];
  for (let i = 0; i < 24; ++i) this.ep[i] = i;
}

// ============================================================================
// FullCube
// ============================================================================

let move2rot: number[];
let clinitFullCubeDone = false;
function $clinit_FullCube_0(): void {
  if (clinitFullCubeDone) return;
  clinitFullCubeDone = true;
  move2rot = [35, 1, 34, 2, 4, 6, 22, 5, 19];
}

function $$init_3(obj: any): void {
  obj.moveBuffer = createArray(60);
}

function $copy_4(obj: any, c: any): void {
  $copy_3(obj.edge, c.edge);
  $copy_1(obj.center, c.center);
  $copy_2(obj.corner, c.corner);
  obj.value = c.value;
  obj.add1 = c.add1;
  obj.length1 = c.length1;
  obj.length2 = c.length2;
  obj.length3 = c.length3;
  obj.sym = c.sym;
  for (let i = 0; i < 60; ++i) obj.moveBuffer[i] = c.moveBuffer[i];
  obj.moveLength = c.moveLength;
  obj.edgeAvail = c.edgeAvail;
  obj.centerAvail = c.centerAvail;
  obj.cornerAvail = c.cornerAvail;
}

const centerFacelet = [5, 6, 10, 9, 53, 54, 58, 57, 37, 38, 42, 41, 85, 86, 90, 89, 21, 22, 26, 25, 69, 70, 74, 73];
const cornerFacelet = [[15, 16, 35], [12, 32, 67], [0, 64, 83], [3, 80, 19], [51, 47, 28], [48, 79, 44], [60, 95, 76], [63, 31, 92]];
const edgeFacelet = [[13, 33], [4, 65], [2, 81], [11, 17], [61, 94], [52, 78], [50, 46], [59, 30], [75, 40], [68, 87], [27, 88], [20, 39], [34, 14], [66, 8], [82, 1], [18, 7], [93, 62], [77, 56], [45, 49], [29, 55], [36, 71], [91, 72], [84, 23], [43, 24]];

function $fromFacelet(obj: any, f: number[]): number {
  let ctMask = 0;
  let edMask = 0;
  let cpMask = 0;
  let coSum = 0;
  for (let i = 0; i < 24; i++) {
    obj.center.ct[i] = f[centerFacelet[i]];
    ctMask += 1 << (f[centerFacelet[i]] * 4);
  }
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 24; j++) {
      if (f[edgeFacelet[i][0]] === (edgeFacelet[j][0] >> 4) && f[edgeFacelet[i][1]] === (edgeFacelet[j][1] >> 4)) {
        obj.edge.ep[i] = j;
        edMask |= 1 << j;
      }
    }
  }
  let col1: number, col2: number, ori: number;
  for (let i = 0; i < 8; i++) {
    ori = 0;
    for (ori = 0; ori < 3; ori++) {
      if (f[cornerFacelet[i][ori]] === 0 || f[cornerFacelet[i][ori]] === 3) break;
    }
    col1 = f[cornerFacelet[i][(ori + 1) % 3]];
    col2 = f[cornerFacelet[i][(ori + 2) % 3]];
    for (let j = 0; j < 8; j++) {
      if (col1 === (cornerFacelet[j][1] >> 4) && col2 === (cornerFacelet[j][2] >> 4)) {
        obj.corner.cp[i] = j;
        obj.corner.co[i] = ori % 3;
        cpMask |= 1 << j;
        coSum += ori % 3;
        break;
      }
    }
  }
  return (cpMask !== 0xff ? 1 : 0) + (coSum % 3 !== 0 ? 2 : 0) + (ctMask !== 0x444444 ? 4 : 0) + (edMask !== 0xffffff ? 8 : 0);
}

function toFacelet(obj: any): number[] {
  getCenter(obj);
  $getCorner(obj);
  $getEdge(obj);
  const f: number[] = [];
  for (let i = 0; i < 24; i++) f[centerFacelet[i]] = obj.center.ct[i];
  for (let i = 0; i < 24; i++) {
    f[edgeFacelet[i][0]] = edgeFacelet[obj.edge.ep[i]][0] >> 4;
    f[edgeFacelet[i][1]] = edgeFacelet[obj.edge.ep[i]][1] >> 4;
  }
  for (let c = 0; c < 8; c++) {
    const j = obj.corner.cp[c];
    const ori = obj.corner.co[c];
    for (let n = 0; n < 3; n++) {
      f[cornerFacelet[c][(n + ori) % 3]] = cornerFacelet[j][n] >> 4;
    }
  }
  return f;
}

function to333Facelet(obj: any): number[] | null {
  const f = toFacelet(obj);
  const chks = [[1, 2], [4, 8], [7, 11], [13, 14], [5, 6, 9, 10]];
  const map4to3 = [0, 1, 3, 4, 5, 7, 12, 13, 15];
  const f3: number[] = [];
  for (let fidx = 0; fidx < 6; fidx++) {
    for (let i = 0; i < chks.length; i++) {
      const cmp = f[(fidx << 4) | chks[i][0]];
      for (let j = 1; j < chks[i].length; j++) {
        if (cmp !== f[(fidx << 4) | chks[i][j]]) {
          if (DEBUG) console.log('reduction error', chks[i][j], chks[i][0]);
          return null;
        }
      }
    }
    for (let i = 0; i < map4to3.length; i++) {
      f3[fidx * 9 + i] = f[(fidx << 4) | map4to3[i]];
    }
  }
  return f3;
}

function getCenter(obj: any): any {
  while (obj.centerAvail < obj.moveLength) {
    doMoveCenterCube(obj.center, obj.moveBuffer[obj.centerAvail++]);
  }
  return obj.center;
}

function $getCorner(obj: any): any {
  while (obj.cornerAvail < obj.moveLength) {
    $move_3(obj.corner, obj.moveBuffer[obj.cornerAvail++] % 18);
  }
  return obj.corner;
}

function $getEdge(obj: any): any {
  while (obj.edgeAvail < obj.moveLength) {
    doMoveEdge(obj.edge, obj.moveBuffer[obj.edgeAvail++]);
  }
  return obj.edge;
}

function getMoveString(obj: any): string {
  const fixedMoves = new Array<number>(obj.moveLength - (obj.add1 ? 2 : 0));
  let idx = 0;
  for (let i = 0; i < obj.length1; ++i) fixedMoves[idx++] = obj.moveBuffer[i];
  let sym = obj.sym;
  for (let i = obj.length1 + (obj.add1 ? 2 : 0); i < obj.moveLength; ++i) {
    if (SymMove[sym][obj.moveBuffer[i]] >= 27) {
      fixedMoves[idx++] = SymMove[sym][obj.moveBuffer[i]] - 9;
      const rot = move2rot[SymMove[sym][obj.moveBuffer[i]] - 27];
      sym = SymMult[sym][rot];
    } else {
      fixedMoves[idx++] = SymMove[sym][obj.moveBuffer[i]];
    }
  }
  const finishSym = SymMult[SymInv[sym]][getSolvedSym(getCenter(obj))];
  const ret: any[] = [];
  sym = finishSym;
  for (let i = idx - 1; i >= 0; --i) {
    let move = fixedMoves[i];
    move = ~~(move / 3) * 3 + (2 - (move % 3));
    if (SymMove[sym][move] >= 27) {
      ret.push(SymMove[sym][move] - 9);
      const rot = move2rot[SymMove[sym][move] - 27];
      sym = SymMult[sym][rot];
    } else {
      ret.push(SymMove[sym][move]);
    }
  }
  let axis = -1;
  let outIdx = 0;
  const pows = [0, 0, 0];
  for (let i = 0; i < ret.length; ++i) {
    const move = ret[i];
    if (axis !== ~~(move / 3) % 3) {
      for (let i_1 = 0; i_1 < 3; i_1++) {
        if (pows[i_1] % 4) {
          ret[outIdx++] = move2str_1[i_1 * 9 + axis * 3 + pows[i_1] - 1] + ' ';
          pows[i_1] = 0;
        }
      }
      axis = ~~(move / 3) % 3;
    }
    pows[~~(move / 9)] += (move % 3) + 1;
  }
  for (let i_1 = 0; i_1 < 3; i_1++) {
    if (pows[i_1] % 4) {
      ret[outIdx++] = move2str_1[i_1 * 9 + axis * 3 + pows[i_1] - 1] + ' ';
      pows[i_1] = 0;
    }
  }
  return ret.slice(0, outIdx).join('');
}

function $move_6(obj: any, m: number): void {
  obj.moveBuffer[obj.moveLength++] = m;
}

function FullCube_3(this: any): any {
  $$init_3(this);
  this.edge = new (EdgeCube as any)();
  this.center = new (CenterCube as any)();
  this.corner = new (CornerCube_0 as any)();
  this.add1 = false;
  this.centerAvail = 0;
  this.cornerAvail = 0;
  this.edgeAvail = 0;
  this.length1 = 0;
  this.length2 = 0;
  this.length3 = 0;
  this.moveLength = 0;
  this.sym = 0;
  this.value = 0;
}

function FullCube_4(this: any, c: any): any {
  (FullCube_3 as any).call(this);
  $copy_4(this, c);
}

// ============================================================================
// Moves table init
// ============================================================================

let ckmv: any[], ckmv2_0: any[], ckmv3: any[];
let move2std: number[], move2str_1: string[], move3std: number[];
let std2move: number[], std3move: number[];
let skipAxis: number[], skipAxis2: number[], skipAxis3: number[];
let epMoveMap: number[][];

let clinitMovesDone = false;
function $clinit_Moves(): void {
  if (clinitMovesDone) return;
  clinitMovesDone = true;
  move2str_1 = ['U  ', 'U2 ', "U' ", 'R  ', 'R2 ', "R' ", 'F  ', 'F2 ', "F' ", 'D  ', 'D2 ', "D' ", 'L  ', 'L2 ', "L' ", 'B  ', 'B2 ', "B' ", 'Uw ', 'Uw2', "Uw'", 'Rw ', 'Rw2', "Rw'", 'Fw ', 'Fw2', "Fw'", 'Dw ', 'Dw2', "Dw'", 'Lw ', 'Lw2', "Lw'", 'Bw ', 'Bw2', "Bw'"];
  move2std = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 21, 22, 23, 25, 28, 30, 31, 32, 34, 36];
  move3std = [0, 1, 2, 4, 6, 7, 8, 9, 10, 11, 13, 15, 16, 17, 19, 22, 25, 28, 31, 34, 36];
  std2move = createArray(37);
  std3move = createArray(37);
  ckmv = createArray(37, 36);
  ckmv2_0 = createArray(29, 28);
  ckmv3 = createArray(21, 20);
  skipAxis = createArray(36);
  skipAxis2 = createArray(28);
  skipAxis3 = createArray(20);
  epMoveMap = createArray(36, 24);
  for (let i = 0; i < 29; ++i) std2move[move2std[i]] = i;
  for (let i = 0; i < 21; ++i) std3move[move3std[i]] = i;
  for (let i = 0; i < 36; ++i) {
    for (let j = 0; j < 36; ++j) {
      ckmv[i][j] = (~~(i / 3) === ~~(j / 3)) || ((~~(i / 3) % 3 === ~~(j / 3) % 3) && i > j);
    }
    ckmv[36][i] = false;
  }
  for (let i = 0; i < 29; ++i) {
    for (let j = 0; j < 28; ++j) {
      ckmv2_0[i][j] = ckmv[move2std[i]][move2std[j]];
    }
  }
  for (let i = 0; i < 21; ++i) {
    for (let j = 0; j < 20; ++j) {
      ckmv3[i][j] = ckmv[move3std[i]][move3std[j]];
    }
  }
  for (let i = 0; i < 36; ++i) {
    skipAxis[i] = 36;
    for (let j = i; j < 36; ++j) {
      if (!ckmv[i][j]) { skipAxis[i] = j - 1; break; }
    }
  }
  for (let i = 0; i < 28; ++i) {
    skipAxis2[i] = 28;
    for (let j = i; j < 28; ++j) {
      if (!ckmv2_0[i][j]) { skipAxis2[i] = j - 1; break; }
    }
  }
  for (let i = 0; i < 20; ++i) {
    skipAxis3[i] = 20;
    for (let j = i; j < 20; ++j) {
      if (!ckmv3[i][j]) { skipAxis3[i] = j - 1; break; }
    }
  }
  for (let i = 0; i < 36; ++i) {
    const edge: any = new (EdgeCube as any)();
    doMoveEdge(edge, i);
    for (let j = 0; j < 24; j++) {
      epMoveMap[i][edge.ep[j]] = j;
    }
  }
}

// ============================================================================
// Search
// ============================================================================

const PHASE1_SOLS = 10000;
const PHASE2_ATTS = 500;
const PHASE2_SOLS = 100;
const MAX_SEARCH_DEPTH = 60;

function $compare_0(c1: any, c2: any): number {
  return c2.value - c1.value;
}

function $add_0(obj: any, o: any): boolean {
  obj.array[obj.size++] = o;
  return true;
}

function $get_4(obj: any, index: number): any {
  return obj.array[index];
}

function $remove_0(obj: any, index: number): any {
  const previous = obj.array[index];
  obj.array.splice(index, 1);
  --obj.size;
  return previous;
}

function $set_7(obj: any, index: number, o: any): any {
  const previous = obj.array[index];
  obj.array[index] = o;
  return previous;
}

function PriorityQueue_0(this: any): any {
  this.array = [];
  this.array.length = PHASE2_ATTS;
  this.size = 0;
}

function $clear(obj: any): void {
  obj.array = [];
  obj.size = 0;
}

function $mergeHeaps(obj: any, node: number): void {
  const heapSize = obj.size;
  const value = $get_4(obj, node);
  while (node * 2 + 1 < heapSize) {
    const leftChild = 2 * node + 1;
    const rightChild = leftChild + 1;
    let smallestChild_0 = leftChild;
    if (rightChild < heapSize && $compare_0($get_4(obj, rightChild), $get_4(obj, leftChild)) < 0) {
      smallestChild_0 = rightChild;
    }
    const smallestChild = smallestChild_0;
    if ($compare_0(value, $get_4(obj, smallestChild)) < 0) break;
    $set_7(obj, node, $get_4(obj, smallestChild));
    node = smallestChild;
  }
  $set_7(obj, node, value);
}

function $offer(obj: any, e: any): boolean {
  let node = obj.size;
  $add_0(obj, e);
  while (node > 0) {
    const childNode = node;
    node = (node - 1) >> 1;
    if ($compare_0($get_4(obj, node), e) <= 0) {
      $set_7(obj, childNode, e);
      return true;
    }
    $set_7(obj, childNode, $get_4(obj, node));
  }
  $set_7(obj, node, e);
  return true;
}

function $add(obj: any, o: any): boolean {
  return $offer(obj, o);
}

function $poll(obj: any): any {
  if (obj.size === 0) return null;
  const value = $get_4(obj, 0);
  $removeAtIndex(obj);
  return value;
}

function $removeAtIndex(obj: any): void {
  const lastValue = $remove_0(obj, obj.size - 1);
  if (obj.size > 0) {
    $set_7(obj, 0, lastValue);
    $mergeHeaps(obj, 0);
  }
}

function $init2_0(obj: any, sym: number): boolean {
  let next: any;
  $copy_4(obj.c1, obj.c);
  for (let i = 0; i < obj.length1; ++i) $move_6(obj.c1, obj.move1[i]);
  switch (finish_0[sym]) {
    case 0:
      $move_6(obj.c1, 24);
      $move_6(obj.c1, 35);
      obj.move1[obj.length1] = 24;
      obj.move1[obj.length1 + 1] = 35;
      obj.add1 = true;
      sym = 19;
      break;
    case 12869:
      $move_6(obj.c1, 18);
      $move_6(obj.c1, 29);
      obj.move1[obj.length1] = 18;
      obj.move1[obj.length1 + 1] = 29;
      obj.add1 = true;
      sym = 34;
      break;
    case 735470:
      obj.add1 = false;
      sym = 0;
      break;
  }
  $set_2(obj.ct2, getCenter(obj.c1), parity_0($getEdge(obj.c1).ep));
  const s2ct = $getct(obj.ct2);
  const s2rl = $getrl(obj.ct2);
  const ctp = ctprun[s2ct * 70 + s2rl];
  obj.c1.value = ctp + obj.length1;
  obj.c1.length1 = obj.length1;
  obj.c1.add1 = obj.add1;
  obj.c1.sym = sym;
  ++obj.p1SolsCnt;
  if (obj.p1sols.size < PHASE2_ATTS) {
    next = new (FullCube_4 as any)(obj.c1);
  } else {
    next = $poll(obj.p1sols);
    if (next.value > obj.c1.value) $copy_4(next, obj.c1);
  }
  $add(obj.p1sols, next);
  return obj.p1SolsCnt === PHASE1_SOLS;
}

function $init3(obj: any): boolean {
  if (!checkPhase2Edge(obj.epInv, obj.move2, obj.length2)) return false;
  $copy_4(obj.c2, obj.c1);
  for (let i = 0; i < obj.length2; ++i) $move_6(obj.c2, obj.move2[i]);
  const eparity = $set_6(obj.e12, $getEdge(obj.c2));
  $set_3(obj.ct3, getCenter(obj.c2), eparity ^ parity_0($getCorner(obj.c2).cp));
  const ct = $getct_0(obj.ct3);
  $get_2(obj.e12, 10);
  const prun = getprun($getsym_0(obj.e12));
  if (!obj.arr2[obj.arr2idx]) obj.arr2[obj.arr2idx] = new (FullCube_4 as any)(obj.c2);
  else $copy_4(obj.arr2[obj.arr2idx], obj.c2);
  obj.arr2[obj.arr2idx].value = obj.length1 + obj.length2 + Math.max(prun, prun_0[ct]);
  obj.arr2[obj.arr2idx].length2 = obj.length2;
  ++obj.arr2idx;
  return obj.arr2idx === obj.arr2.length;
}

function phase1Search(obj: any, ct: number, sym: number, maxl: number, lm: number, depth: number): boolean {
  if (ct === 0) return maxl === 0 && $init2_0(obj, sym);
  for (let axis = 0; axis < 27; axis += 3) {
    if (axis === lm || axis === lm - 9 || axis === lm - 18) continue;
    for (let power = 0; power < 3; ++power) {
      const m = axis + power;
      const ctx_full = Center1SymMove[ct][SymMove[sym][m]];
      const prun = Center1SymPrun[ctx_full >>> 6];
      if (prun >= maxl) {
        if (prun > maxl) break;
        continue;
      }
      const symx = SymMult[sym][ctx_full & 63];
      const ctx = ctx_full >>> 6;
      obj.move1[depth] = m;
      if (phase1Search(obj, ctx, symx, maxl - 1, axis, depth + 1)) return true;
    }
  }
  return false;
}

function phase2Search(obj: any, ct: number, rl: number, maxl: number, lm: number, depth: number): boolean {
  if (ct === 0 && ctprun[rl] === 0 && maxl < 5) return maxl === 0 && $init3(obj);
  for (let m = 0; m < 23; ++m) {
    if (ckmv2_0[lm][m]) {
      m = skipAxis2[m];
      continue;
    }
    const ctx = ctmv[ct][m];
    const rlx = rlmv[rl][m];
    const prun = ctprun[ctx * 70 + rlx];
    if (prun >= maxl) {
      if (prun > maxl) m = skipAxis2[m];
      continue;
    }
    obj.move2[depth] = move2std[m];
    if (phase2Search(obj, ctx, rlx, maxl - 1, m, depth + 1)) return true;
  }
  return false;
}

function phase3Search(obj: any, eplast: number[], ct: number, prun: number, maxl: number, lm: number, depth: number): boolean {
  if (maxl === 0) return true;
  const ep = obj.tempep[depth];
  if (lm !== 20) {
    const movo = mvroto[lm << 3];
    const mov = mvrot[lm << 3];
    for (let i = 0; i < 12; i++) ep[i] = movo[eplast[mov[i]]];
  }
  for (let m = 0; m < 17; m++) {
    if (ckmv3[lm][m]) {
      m = skipAxis3[m];
      continue;
    }
    const ctx = ctmove[ct][m];
    const prun1 = prun_0[ctx];
    if (prun1 >= maxl) {
      if (prun1 > maxl && m < 14) m = skipAxis3[m];
      continue;
    }
    const prunx = getprun_0(getMvSym(ep, m) >> 3, prun);
    if (prunx >= maxl) {
      if (prunx > maxl && m < 14) m = skipAxis3[m];
      continue;
    }
    if (phase3Search(obj, ep, ctx, prunx, maxl - 1, m, depth + 1)) {
      obj.move3[depth] = m;
      return true;
    }
  }
  return false;
}

function $doSearch(obj: any): any {
  obj.solution = '';
  const tt = nowMs();
  const ud = $getsym(new (Center1 as any)().fromCube(getCenter(obj.c), 0));
  const fb = $getsym(new (Center1 as any)().fromCube(getCenter(obj.c), 1));
  const rl = $getsym(new (Center1 as any)().fromCube(getCenter(obj.c), 2));
  const udprun = Center1SymPrun[ud >> 6];
  const fbprun = Center1SymPrun[fb >> 6];
  const rlprun = Center1SymPrun[rl >> 6];
  obj.p1SolsCnt = 0;
  obj.arr2idx = 0;
  $clear(obj.p1sols);
  for (obj.length1 = Math.min(udprun, fbprun, rlprun); obj.length1 < MAX_SEARCH_DEPTH; ++obj.length1) {
    if ((rlprun <= obj.length1 && phase1Search(obj, rl >>> 6, rl & 63, obj.length1, -1, 0))
      || (udprun <= obj.length1 && phase1Search(obj, ud >>> 6, ud & 63, obj.length1, -1, 0))
      || (fbprun <= obj.length1 && phase1Search(obj, fb >>> 6, fb & 63, obj.length1, -1, 0))) {
      break;
    }
  }
  const p1SolsArr: any[] = obj.p1sols.array.slice();
  const tt1 = nowMs() - tt;
  if (DEBUG) console.log('[scramble 444] Phase 1 Done in', nowMs() - tt);
  p1SolsArr.sort((a, b) => a.value - b.value);
  let MAX_LENGTH2 = 9;
  let length12 = 0;
  do {
    OUT: for (length12 = p1SolsArr[0].value; length12 < MAX_SEARCH_DEPTH; ++length12) {
      for (let i = 0; i < p1SolsArr.length; ++i) {
        const cc = p1SolsArr[i];
        if (cc.value > length12) break;
        if (length12 - cc.length1 > MAX_LENGTH2) continue;
        $copy_4(obj.c1, cc);
        const ep = $getEdge(obj.c1).ep;
        $set_2(obj.ct2, getCenter(obj.c1), parity_0(ep));
        const s2ct = $getct(obj.ct2);
        const s2rl = $getrl(obj.ct2);
        obj.length1 = cc.length1;
        obj.length2 = length12 - cc.length1;
        obj.epInv = [];
        for (let e = 0; e < 24; e++) obj.epInv[ep[e]] = e;
        if (phase2Search(obj, s2ct, s2rl, obj.length2, 28, 0)) {
          break OUT;
        }
      }
    }
    ++MAX_LENGTH2;
  } while (length12 === MAX_SEARCH_DEPTH);
  obj.arr2.sort((a: any, b: any) => a.value - b.value);
  if (DEBUG) console.log('[scramble 444] Phase 2 Done in', nowMs() - tt);
  const tt2 = nowMs() - tt - tt1;
  let index = 0;
  let MAX_LENGTH3 = 13;
  let length123 = 0;
  do {
    OUT2: for (length123 = obj.arr2[0].value; length123 < MAX_SEARCH_DEPTH; ++length123) {
      for (let i = 0; i < Math.min(obj.arr2idx, PHASE2_SOLS); ++i) {
        if (obj.arr2[i].value > length123) break;
        obj.arr2[i].length3 = length123 - obj.arr2[i].length1 - obj.arr2[i].length2;
        if (obj.arr2[i].length3 > MAX_LENGTH3) continue;
        const eparity = $set_6(obj.e12, $getEdge(obj.arr2[i]));
        $set_3(obj.ct3, getCenter(obj.arr2[i]), eparity ^ parity_0($getCorner(obj.arr2[i]).cp));
        const ct = $getct_0(obj.ct3);
        $get_2(obj.e12, 10);
        for (let j = 0; j < 12; j++) obj.tempep[0][j] = obj.e12.edge[j];
        const prun = getprun($getsym_0(obj.e12));
        if (prun <= obj.arr2[i].length3
          && phase3Search(obj, obj.tempep[0], ct, prun, obj.arr2[i].length3, 20, 0)) {
          index = i;
          break OUT2;
        }
      }
    }
    ++MAX_LENGTH3;
  } while (length123 === MAX_SEARCH_DEPTH);
  if (DEBUG) console.log('[scramble 444] Phase 3 Done in', nowMs() - tt);
  const tt3 = nowMs() - tt - tt1 - tt2;

  const solcube: any = new (FullCube_4 as any)(obj.arr2[index]);
  obj.length1 = solcube.length1;
  obj.length2 = solcube.length2;
  obj.length3 = solcube.length3;
  for (let i = 0; i < obj.length3; ++i) {
    $move_6(solcube, move3std[obj.move3[i]]);
  }
  // 3x3 reduction step using kociemba two-phase solver
  const f3raw = to333Facelet(solcube);
  if (!f3raw) {
    if (DEBUG) console.log('[scramble 444] Reduction Error!', toFacelet(solcube));
    throw new Error('scramble_444_rs: 3x3 reduction failed');
  }
  // The cstimer cube state may be rotated relative to canonical URFDLB (centers on
  // their canonical faces). We re-canonicalize using each face's center color before
  // converting to a Kociemba CubieCube.
  const colorMap: number[] = new Array(6).fill(-1);
  for (let face = 0; face < 6; face++) {
    colorMap[f3raw[face * 9 + 4]] = face;
  }
  const f3 = f3raw.map((c) => colorMap[c]);
  const ccKociemba = faceletsToCubieCube(f3);
  if (DEBUG) console.log('[scramble 444] cubie:', JSON.stringify(ccKociemba));
  // Append the solution moves directly to solcube — getMoveString will invert the
  // whole sequence at the end to produce the scramble string.
  const sol333 = solveCube(ccKociemba, k_mt!, k_pt!, {
    maxTotalLen: 30, targetLen: 22, timeoutMs: 5000, phase1MaxDepth: 14, phase2MaxDepth: 22,
  });
  // sol333 is in 0..17 indices (face*3 + power). The cstimer 4x4 face indexing for
  // single-layer moves is also URFDLB packed as face*3 + power-1 with 1=normal, 2=double, 3=prime.
  // cstimer's move buffer index space: 0..17 for outer-layer URFDLB (matching kociemba).
  let length333 = 0;
  for (let mi = 0; mi < sol333.length; mi++) {
    const m = sol333[mi];
    // m = face * 3 + power (0=normal,1=double,2=prime). cstimer move id also face*3 + powerCode
    // where powerCode has same convention (0=1,1=2,2=3 turns). That matches.
    $move_6(solcube, m);
    length333++;
  }
  void length333;
  obj.solution = getMoveString(solcube);
  if (DEBUG) console.log('[scramble 444] 3x3x3 Done in', nowMs() - tt);
  if (DEBUG) console.log('[scramble 444] Phase depths: ', [obj.length1, obj.length2, obj.length3, length333, tt1, tt2, tt3]);
  return [obj.length1, obj.length2, obj.length3, length333, tt1, tt2, tt3];
}

// Convert a length-54 URFDLB facelet array (color indices 0..5 = U R F D L B)
// to a CubieCube that the kociemba module understands. The kociemba module's
// CubieCube uses Kociemba's canonical cubie indexing.
function faceletsToCubieCube(f: number[]): CubieCube {
  // Indexing matches kociemba module: U=0..8, R=9..17, F=18..26, D=27..35, L=36..44, B=45..53.
  // cstimer's to333Facelet packs 9 facelets per face row-major in URFDLB order — matches.
  // Build CubieCube from facelets using the kociemba conventions (mirror of fromFacelet).
  // We re-implement the standard facelet→cubie mapping in-line.

  // Corner facelet positions (Kociemba's canonical mapping):
  //   URF: U8, R0, F2 ; UFL: U6, F0, L2 ; ULB: U0, L0, B2 ; UBR: U2, B0, R2 ;
  //   DFR: D2, F8, R6 ; DLF: D0, L8, F6 ; DBL: D6, B8, L6 ; DRB: D8, R8, B6
  const cornerFL = [
    [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
    [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51],
  ];
  // Edge facelet positions (Kociemba canonical):
  //   UR: U5, R1 ; UF: U7, F1 ; UL: U3, L1 ; UB: U1, B1 ;
  //   DR: D5, R7 ; DF: D1, F7 ; DL: D3, L7 ; DB: D7, B7 ;
  //   FR: F5, R3 ; FL: F3, L5 ; BL: B5, L3 ; BR: B3, R5
  const edgeFL = [
    [5, 10], [7, 19], [3, 37], [1, 46],
    [32, 16], [28, 25], [30, 43], [34, 52],
    [23, 12], [21, 41], [50, 39], [48, 14],
  ];
  // Reference colors per slot (which face each slot belongs to in solved state).
  const cornerColor = [
    [0, 1, 2], [0, 2, 4], [0, 4, 5], [0, 5, 1],
    [3, 2, 1], [3, 4, 2], [3, 5, 4], [3, 1, 5],
  ];
  const edgeColor = [
    [0, 1], [0, 2], [0, 4], [0, 5],
    [3, 1], [3, 2], [3, 4], [3, 5],
    [2, 1], [2, 4], [5, 4], [5, 1],
  ];

  const cp: number[] = new Array(8);
  const co: number[] = new Array(8);
  const ep: number[] = new Array(12);
  const eo: number[] = new Array(12);

  for (let i = 0; i < 8; i++) {
    // Find U or D face on this corner → that's the orientation reference.
    let ori = 0;
    for (ori = 0; ori < 3; ori++) {
      if (f[cornerFL[i][ori]] === 0 || f[cornerFL[i][ori]] === 3) break;
    }
    const col1 = f[cornerFL[i][(ori + 1) % 3]];
    const col2 = f[cornerFL[i][(ori + 2) % 3]];
    let found = -1;
    for (let j = 0; j < 8; j++) {
      if (col1 === cornerColor[j][1] && col2 === cornerColor[j][2]) { found = j; break; }
    }
    if (found === -1) throw new Error('faceletsToCubieCube: corner not found at ' + i);
    cp[i] = found;
    co[i] = ori;
  }

  for (let i = 0; i < 12; i++) {
    const a = f[edgeFL[i][0]];
    const b = f[edgeFL[i][1]];
    let found = -1;
    let oriE = 0;
    for (let j = 0; j < 12; j++) {
      if (a === edgeColor[j][0] && b === edgeColor[j][1]) { found = j; oriE = 0; break; }
      if (a === edgeColor[j][1] && b === edgeColor[j][0]) { found = j; oriE = 1; break; }
    }
    if (found === -1) throw new Error('faceletsToCubieCube: edge not found at ' + i);
    ep[i] = found;
    eo[i] = oriE;
  }

  return { cp, co, ep, eo };
}

function Search_4(this: any): any {
  this.p1sols = new (PriorityQueue_0 as any)();
  this.move1 = createArray(15);
  this.move2 = createArray(20);
  this.move3 = createArray(20);
  this.c1 = new (FullCube_3 as any)();
  this.c2 = new (FullCube_3 as any)();
  this.ct2 = new (Center2 as any)();
  this.ct3 = new (Center3 as any)();
  this.e12 = new (Edge3_0 as any)();
  this.tempep = createArray(20);
  this.arr2 = createArray(PHASE2_SOLS);
  for (let i = 0; i < 20; ++i) this.tempep[i] = [];
  this.add1 = false;
  this.arr2idx = 0;
  this.c = null;
  this.length1 = 0;
  this.length2 = 0;
  this.p1SolsCnt = 0;
  this.solution = '';
}

// ============================================================================
// Random state generation (cstimer partialSolvedState with full mask)
// ============================================================================

function rndPerm(rng: () => number, n: number, isEven?: boolean): number[] {
  let p = 0;
  const arr: number[] = [];
  for (let i = 0; i < n; i++) arr[i] = i;
  for (let i = 0; i < n - 1; i++) {
    const k = ~~(rng() * (n - i));
    if (k !== 0) { const t = arr[i]; arr[i] = arr[i + k]; arr[i + k] = t; p ^= 1; }
  }
  if (isEven && p) {
    const t = arr[0]; arr[0] = arr[1]; arr[1] = t;
  }
  return arr;
}

function partialSolvedStateFull(rng: () => number): string {
  // Full random state: ctMask=0xffffff, edMask=0xffffff, cnMask=0xff, neut=0
  let solved = true;
  let facelet = '';
  for (let _ = 0; solved && _ < 100; _++) {
    const cc: any = new (FullCube_3 as any)();
    const ctSwaps: number[] = [];
    const edSwaps: number[] = [];
    const cnSwaps: number[] = [];
    for (let i = 0; i < 24; i++) {
      ctSwaps.push(i);
      edSwaps.push(i);
      if (i < 8) cnSwaps.push(i);
    }
    const ctPerm = rndPerm(rng, ctSwaps.length);
    for (let i = 0; i < ctSwaps.length; i++) {
      cc.center.ct[ctSwaps[i]] = centerFacelet[ctSwaps[ctPerm[i]]] >> 4;
    }
    const edPerm = rndPerm(rng, edSwaps.length);
    for (let i = 0; i < edSwaps.length; i++) {
      cc.edge.ep[edSwaps[i]] = edSwaps[edPerm[i]];
    }
    const cnPerm = rndPerm(rng, cnSwaps.length);
    let coSum = 24;
    for (let i = 0; i < cnSwaps.length; i++) {
      const co = ~~(rng() * 3);
      cc.corner.co[cnSwaps[i]] = co;
      cc.corner.cp[cnSwaps[i]] = cnSwaps[cnPerm[i]];
      coSum -= co;
    }
    if (coSum % 3 !== 0) {
      cc.corner.co[cnSwaps[0]] = (cc.corner.co[cnSwaps[0]] + coSum) % 3;
    }
    const fac = toFacelet(cc);
    const out: string[] = [];
    solved = true;
    for (let i = 0; i < 96; i++) {
      out.push('URFDLB'.charAt(fac[i]));
      if (out[i] !== out[i >> 4 << 4]) solved = false;
    }
    facelet = out.join('');
  }
  return facelet;
}

// ============================================================================
// Public API
// ============================================================================

let initialized = false;
let searcher: any = null;
let k_mt: MoveTables | null = null;
let k_pt: PruneTables | null = null;

function ensureInit(): void {
  if (initialized) return;
  const t0 = nowMs();
  if (DEBUG) console.log('[scramble 444] init start');
  $clinit_Moves();
  $clinit_Center1();
  $clinit_Center2();
  $clinit_Center3();
  $clinit_Edge3();
  $clinit_CornerCube();
  $clinit_FullCube_0();

  initSymMeta();
  if (DEBUG) console.log('[scramble 444] initSymMeta', nowMs() - t0);
  Center1Raw2Sym = createArray(735471);
  initCenter1Sym2Raw();
  if (DEBUG) console.log('[scramble 444] initCenter1Sym2Raw', nowMs() - t0);
  initCenter1MoveTable();
  if (DEBUG) console.log('[scramble 444] initCenter1MoveTable', nowMs() - t0);
  Center1Raw2Sym = null;
  initCenter1Prun();
  if (DEBUG) console.log('[scramble 444] initCenter1Prun', nowMs() - t0);

  initCenter2();
  if (DEBUG) console.log('[scramble 444] initCenter2', nowMs() - t0);
  initCenter3();
  if (DEBUG) console.log('[scramble 444] initCenter3', nowMs() - t0);
  initEdge3MvRot();
  if (DEBUG) console.log('[scramble 444] initEdge3MvRot', nowMs() - t0);
  initEdge3Sym2Raw();
  if (DEBUG) console.log('[scramble 444] initEdge3Sym2Raw', nowMs() - t0);
  initEdge3Prun();
  if (DEBUG) console.log('[scramble 444] initEdge3Prun', nowMs() - t0);
  searcher = new (Search_4 as any)();

  // 3x3 reduction tables
  k_mt = buildMoveTables();
  k_pt = buildPruneTables(k_mt);
  if (DEBUG) console.log('[scramble 444] kociemba tables ready', nowMs() - t0);

  initialized = true;
}

function genFacelet(facelet: string): string {
  ensureInit();
  const fl: number[] = [];
  for (let i = 0; i < 96; i++) fl[i] = 'URFDLB'.indexOf(facelet[i]);
  searcher.c = new (FullCube_3 as any)();
  const chk = $fromFacelet(searcher.c, fl);
  if (chk !== 0) {
    if (DEBUG) console.log('[scramble 444] State Check Error!', chk, fl);
  }
  $doSearch(searcher);
  return searcher.solution.replace(/\s+/g, ' ').trim();
}

/**
 * Generate a 4x4 random-state scramble in WCA notation. First call builds
 * tables (~5-15s); subsequent calls take ~50-500ms.
 */
export function scramble444RandomState(rng: () => number = Math.random): string {
  ensureInit();
  return genFacelet(partialSolvedStateFull(rng));
}

/** Internal: warm up tables. */
export function warmup444(): void {
  ensureInit();
}
