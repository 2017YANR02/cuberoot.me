/**
 * Square-1 random-state scrambler — faithful port of cstimer's
 * `scramble_sq1_new.js` (CSP / Cube Shape + Permutation approach).
 *
 *   1. Pick a random valid Sq1 cube shape uniformly (3678 shapes).
 *   2. Fill edges + corner halves randomly into the shape.
 *   3. Run cstimer's two-phase IDA* solver (phase 1: shape, phase 2: perm).
 *   4. Output the inverse of the solve as the scramble (cstimer's
 *      `Search_move2string` already inverts by walking moves backwards).
 *
 * Tables built lazily on first call:
 *   Shape_ShapeIdx  — 3678 valid shape patterns
 *   Shape_TopMove / BottomMove / TwistMove — 7536 entries each
 *   ShapePrun       — 7536-entry pruning table (BFS from solved shapes)
 *   Square_TopMove / BottomMove / TwistMove — 40320 entries each
 *   SquarePrun      — 80640-entry pruning table (BFS from solved perm)
 *
 * Cold-start build is ~hundreds of ms (BFS over 80640 states); subsequent
 * calls reuse the tables and finish in single-digit ms.
 */

// ---- Inlined mathlib helpers (port of cstimer setNPerm/getNPerm/circle) ----

function setNPerm(arr: number[], idx: number, n: number): void {
  // cstimer's "n < 16" fast path; n is at most 8 here so we always take it.
  let vall = 0x76543210;
  let valh = 0xfedcba98;
  // Precomputed factorials for n up to 8.
  const fact = [1, 1, 2, 6, 24, 120, 720, 5040, 40320];
  for (let i = 0; i < n - 1; i++) {
    const p = fact[n - 1 - i];
    let v = Math.floor(idx / p);
    idx = idx % p;
    v <<= 2;
    if (v >= 32) {
      v = v - 32;
      arr[i] = (valh >>> v) & 0xf;
      const m = (1 << v) - 1;
      valh = (valh & m) + ((valh >>> 4) & ~m);
    } else {
      arr[i] = (vall >>> v) & 0xf;
      const m = (1 << v) - 1;
      // JS quirk in cstimer: lower 32-bit shift mixes vall/valh; replicate.
      vall = (vall & m) + (((vall >>> 4) & ~m) >>> 0) + ((valh << 28) >>> 0);
      valh = valh >>> 4;
    }
  }
  arr[n - 1] = vall & 0xf;
}

function getNPerm(arr: number[], n: number): number {
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
  return idx;
}

/** circle(arr, a, b, c, d) shifts arr[a]<-arr[d]<-arr[c]<-arr[b]<-old arr[a]. */
function circle(arr: number[], ...indices: number[]): void {
  const len = indices.length;
  const temp = arr[indices[len - 1]];
  for (let i = len - 1; i > 0; i--) {
    arr[indices[i]] = arr[indices[i - 1]];
  }
  arr[indices[0]] = temp;
}

function bitCount(x: number): number {
  x -= (x >>> 1) & 0x55555555;
  x = ((x >>> 2) & 0x33333333) + (x & 0x33333333);
  x = ((x >>> 4) + x) & 0x0f0f0f0f;
  x += x >>> 8;
  x += x >>> 16;
  return x & 63;
}

function binarySearch(sortedArray: number[], key: number): number {
  let low = 0;
  let high = sortedArray.length - 1;
  while (low <= high) {
    const mid = low + ((high - low) >>> 1);
    const midVal = sortedArray[mid];
    if (midVal < key) low = mid + 1;
    else if (midVal > key) high = mid - 1;
    else return mid;
  }
  return -low - 1;
}

// ---- SqCubie (port of cstimer SqCubie) ----

class SqCubie {
  ul = 0x011233;
  ur = 0x455677;
  dl = 0x998bba;
  dr = 0xddcffe;
  ml = 0;

  pieceAt(idx: number): number {
    let ret: number;
    if (idx < 6) ret = this.ul >>> ((5 - idx) << 2);
    else if (idx < 12) ret = this.ur >>> ((11 - idx) << 2);
    else if (idx < 18) ret = this.dl >>> ((17 - idx) << 2);
    else ret = this.dr >>> ((23 - idx) << 2);
    return ret & 0xf;
  }

  setPiece(idx: number, value: number): void {
    if (idx < 6) {
      this.ul &= ~(0xf << ((5 - idx) << 2));
      this.ul |= value << ((5 - idx) << 2);
    } else if (idx < 12) {
      this.ur &= ~(0xf << ((11 - idx) << 2));
      this.ur |= value << ((11 - idx) << 2);
    } else if (idx < 18) {
      this.dl &= ~(0xf << ((17 - idx) << 2));
      this.dl |= value << ((17 - idx) << 2);
    } else {
      this.dr &= ~(0xf << ((23 - idx) << 2));
      this.dr |= value << ((23 - idx) << 2);
    }
  }

  copy(c: SqCubie): void {
    this.ul = c.ul;
    this.ur = c.ur;
    this.dl = c.dl;
    this.dr = c.dr;
    this.ml = c.ml;
  }

  doMove(move: number): void {
    let temp: number;
    move <<= 2;
    if (move > 24) {
      move = 48 - move;
      temp = this.ul;
      this.ul = ((this.ul >>> move) | (this.ur << (24 - move))) & 0xffffff;
      this.ur = ((this.ur >>> move) | (temp << (24 - move))) & 0xffffff;
    } else if (move > 0) {
      temp = this.ul;
      this.ul = ((this.ul << move) | (this.ur >>> (24 - move))) & 0xffffff;
      this.ur = ((this.ur << move) | (temp >>> (24 - move))) & 0xffffff;
    } else if (move === 0) {
      temp = this.ur;
      this.ur = this.dl;
      this.dl = temp;
      this.ml = 1 - this.ml;
    } else if (move >= -24) {
      move = -move;
      temp = this.dl;
      this.dl = ((this.dl << move) | (this.dr >>> (24 - move))) & 0xffffff;
      this.dr = ((this.dr << move) | (temp >>> (24 - move))) & 0xffffff;
    } else if (move < -24) {
      move = 48 + move;
      temp = this.dl;
      this.dl = ((this.dl >>> move) | (this.dr << (24 - move))) & 0xffffff;
      this.dr = ((this.dr >>> move) | (temp << (24 - move))) & 0xffffff;
    }
  }
}

interface SqSquare {
  cornperm: number;
  edgeperm: number;
  topEdgeFirst: boolean;
  botEdgeFirst: boolean;
  ml: number;
}

function fullCube_getParity(obj: SqCubie): number {
  let cnt = 0;
  const arr: number[] = [obj.pieceAt(0)];
  for (let i = 1; i < 24; ++i) {
    if (obj.pieceAt(i) !== arr[cnt]) arr[++cnt] = obj.pieceAt(i);
  }
  let p = 0;
  for (let a = 0; a < 16; ++a) {
    for (let b = a + 1; b < 16; ++b) {
      if (arr[a] > arr[b]) p ^= 1;
    }
  }
  return p;
}

function fullCube_getShapeIdx(obj: SqCubie): number {
  let dlx = obj.dl & 0x111111;
  dlx |= dlx >>> 3;
  dlx |= dlx >>> 6;
  dlx = (dlx & 15) | ((dlx >>> 12) & 48);
  let drx = obj.dr & 0x111111;
  drx |= drx >>> 3;
  drx |= drx >>> 6;
  drx = (drx & 15) | ((drx >>> 12) & 48);
  let ulx = obj.ul & 0x111111;
  ulx |= ulx >>> 3;
  ulx |= ulx >>> 6;
  ulx = (ulx & 15) | ((ulx >>> 12) & 48);
  let urx = obj.ur & 0x111111;
  urx |= urx >>> 3;
  urx |= urx >>> 6;
  urx = (urx & 15) | ((urx >>> 12) & 48);
  return shape_getShape2Idx(
    (fullCube_getParity(obj) << 24) | (ulx << 18) | (urx << 12) | (dlx << 6) | drx,
  );
}

function fullCube_getSquare(obj: SqCubie, sq: SqSquare): void {
  const prm: number[] = [];
  let a: number, b: number;
  for (a = 0; a < 8; ++a) prm[a] = obj.pieceAt(a * 3 + 1) >>> 1;
  sq.cornperm = getNPerm(prm, 8);
  sq.topEdgeFirst = obj.pieceAt(0) === obj.pieceAt(1);
  a = sq.topEdgeFirst ? 2 : 0;
  for (b = 0; b < 4; a += 3, ++b) prm[b] = obj.pieceAt(a) >>> 1;
  sq.botEdgeFirst = obj.pieceAt(12) === obj.pieceAt(13);
  a = sq.botEdgeFirst ? 14 : 12;
  for (; b < 8; a += 3, ++b) prm[b] = obj.pieceAt(a) >>> 1;
  sq.edgeperm = getNPerm(prm, 8);
  sq.ml = obj.ml;
}

// ---- Shape tables ----

let Shape_ShapeIdx: number[] = [];
let Shape_TopMove: number[] = [];
let Shape_BottomMove: number[] = [];
let Shape_TwistMove: number[] = [];
let ShapePrun: number[] = [];
let shapeInited = false;

const Shape_halflayer = [0, 3, 6, 12, 15, 24, 27, 30, 48, 51, 54, 60, 63];

interface ShapeState {
  top: number;
  bottom: number;
  parity: number;
}

function shape_setIdx(s: ShapeState, idx: number): void {
  s.parity = idx & 1;
  let top = Shape_ShapeIdx[idx >>> 1];
  s.bottom = top & 4095;
  top >>>= 12;
  s.top = top;
}

function shape_getIdx(s: ShapeState): number {
  return (binarySearch(Shape_ShapeIdx, (s.top << 12) | s.bottom) << 1) | s.parity;
}

function shape_getShape2Idx(shp: number): number {
  return (binarySearch(Shape_ShapeIdx, shp & 0xffffff) << 1) | (shp >>> 24);
}

function shape_topMove(s: ShapeState): number {
  let move = 0;
  let moveParity = 0;
  do {
    if ((s.top & 2048) === 0) {
      move += 1;
      s.top = s.top << 1;
    } else {
      move += 2;
      s.top = (s.top << 2) ^ 12291;
    }
    moveParity = 1 - moveParity;
  } while ((bitCount(s.top & 63) & 1) !== 0);
  if ((bitCount(s.top) & 2) === 0) s.parity ^= moveParity;
  return move;
}

function shape_bottomMove(s: ShapeState): number {
  let move = 0;
  let moveParity = 0;
  do {
    if ((s.bottom & 2048) === 0) {
      move += 1;
      s.bottom = s.bottom << 1;
    } else {
      move += 2;
      s.bottom = (s.bottom << 2) ^ 12291;
    }
    moveParity = 1 - moveParity;
  } while ((bitCount(s.bottom & 63) & 1) !== 0);
  if ((bitCount(s.bottom) & 2) === 0) s.parity ^= moveParity;
  return move;
}

function shape_init(): void {
  Shape_ShapeIdx = [];
  Shape_TopMove = [];
  Shape_BottomMove = [];
  Shape_TwistMove = [];
  ShapePrun = [];
  let count = 0;
  for (let i = 0; i < 28561; ++i) {
    const dr = Shape_halflayer[i % 13];
    const dl = Shape_halflayer[Math.floor(i / 13) % 13];
    const ur = Shape_halflayer[Math.floor(Math.floor(i / 13) / 13) % 13];
    const ul = Shape_halflayer[Math.floor(Math.floor(Math.floor(i / 13) / 13) / 13)];
    const value = (ul << 18) | (ur << 12) | (dl << 6) | dr;
    if (bitCount(value) === 16) Shape_ShapeIdx[count++] = value;
  }
  const s: ShapeState = { top: 0, bottom: 0, parity: 0 };
  for (let i = 0; i < 7356; ++i) {
    shape_setIdx(s, i);
    Shape_TopMove[i] = shape_topMove(s);
    Shape_TopMove[i] |= shape_getIdx(s) << 4;
    shape_setIdx(s, i);
    Shape_BottomMove[i] = shape_bottomMove(s);
    Shape_BottomMove[i] |= shape_getIdx(s) << 4;
    shape_setIdx(s, i);
    const temp = s.top & 63;
    const p1 = bitCount(temp);
    const p3 = bitCount(s.bottom & 4032);
    s.parity ^= 1 & ((p1 & p3) >>> 1);
    s.top = (s.top & 4032) | ((s.bottom >>> 6) & 63);
    s.bottom = (s.bottom & 63) | (temp << 6);
    Shape_TwistMove[i] = shape_getIdx(s);
  }
  for (let i = 0; i < 7536; ++i) ShapePrun[i] = -1;
  ShapePrun[shape_getShape2Idx(14378715)] = 0;
  ShapePrun[shape_getShape2Idx(31157686)] = 0;
  ShapePrun[shape_getShape2Idx(23967451)] = 0;
  ShapePrun[shape_getShape2Idx(7191990)] = 0;
  let done = 4;
  let done0 = 0;
  let depth = -1;
  while (done !== done0) {
    done0 = done;
    ++depth;
    for (let i = 0; i < 7536; ++i) {
      if (ShapePrun[i] === depth) {
        let m = 0;
        let idx = i;
        do {
          idx = Shape_TopMove[idx];
          m += idx & 15;
          idx >>>= 4;
          if (ShapePrun[idx] === -1) {
            ++done;
            ShapePrun[idx] = depth + 1;
          }
        } while (m !== 12);
        m = 0;
        idx = i;
        do {
          idx = Shape_BottomMove[idx];
          m += idx & 15;
          idx >>>= 4;
          if (ShapePrun[idx] === -1) {
            ++done;
            ShapePrun[idx] = depth + 1;
          }
        } while (m !== 12);
        idx = Shape_TwistMove[i];
        if (ShapePrun[idx] === -1) {
          ++done;
          ShapePrun[idx] = depth + 1;
        }
      }
    }
  }
}

// ---- Square (perm) tables ----

let Square_TwistMove: number[] = [];
let Square_TopMove: number[] = [];
let Square_BottomMove: number[] = [];
let SquarePrun: number[] = [];
let squareInited = false;

function square_init(): void {
  Square_TwistMove = new Array(40320);
  Square_TopMove = new Array(40320);
  Square_BottomMove = new Array(40320);
  SquarePrun = new Array(80640);
  const pos: number[] = [];
  for (let i = 0; i < 40320; ++i) {
    setNPerm(pos, i, 8);
    circle(pos, 2, 4);
    circle(pos, 3, 5);
    Square_TwistMove[i] = getNPerm(pos, 8);
    setNPerm(pos, i, 8);
    circle(pos, 0, 3, 2, 1);
    Square_TopMove[i] = getNPerm(pos, 8);
    setNPerm(pos, i, 8);
    circle(pos, 4, 7, 6, 5);
    Square_BottomMove[i] = getNPerm(pos, 8);
  }
  for (let i = 0; i < 80640; ++i) SquarePrun[i] = -1;
  SquarePrun[0] = 0;
  let depth = 0;
  let done = 1;
  while (done < 80640) {
    const inv = depth >= 11;
    const find = inv ? -1 : depth;
    const check = inv ? depth : -1;
    ++depth;
    OUT: for (let i = 0; i < 80640; ++i) {
      if (SquarePrun[i] === find) {
        const idx = i >>> 1;
        const ml = i & 1;
        let idxx = (Square_TwistMove[idx] << 1) | (1 - ml);
        if (SquarePrun[idxx] === check) {
          ++done;
          SquarePrun[inv ? i : idxx] = depth;
          if (inv) continue OUT;
        }
        idxx = idx;
        for (let m = 0; m < 4; ++m) {
          idxx = Square_TopMove[idxx];
          if (SquarePrun[(idxx << 1) | ml] === check) {
            ++done;
            SquarePrun[inv ? i : (idxx << 1) | ml] = depth;
            if (inv) continue OUT;
          }
        }
        for (let m = 0; m < 4; ++m) {
          idxx = Square_BottomMove[idxx];
          if (SquarePrun[(idxx << 1) | ml] === check) {
            ++done;
            SquarePrun[inv ? i : (idxx << 1) | ml] = depth;
            if (inv) continue OUT;
          }
        }
      }
    }
  }
}

// ---- Search (port of cstimer Search_*) ----

interface SearchObj {
  Search_c: SqCubie;
  Search_d: SqCubie;
  Search_sq: SqSquare;
  Search_move: number[];
  Search_length1: number;
  Search_maxlen2: number;
  Search_sol_string: string | null;
}

function newSearch(): SearchObj {
  return {
    Search_c: new SqCubie(),
    Search_d: new SqCubie(),
    Search_sq: { cornperm: 0, edgeperm: 0, topEdgeFirst: false, botEdgeFirst: false, ml: 0 },
    Search_move: [],
    Search_length1: 0,
    Search_maxlen2: 0,
    Search_sol_string: null,
  };
}

function search_phase1(
  obj: SearchObj,
  shape: number,
  prunvalue: number,
  maxl: number,
  depth: number,
  lm: number,
): boolean {
  if (prunvalue === 0 && maxl < 4) {
    return maxl === 0 && search_init2(obj);
  }
  if (lm !== 0) {
    const shapex = Shape_TwistMove[shape];
    const prunx = ShapePrun[shapex];
    if (prunx < maxl) {
      obj.Search_move[depth] = 0;
      if (search_phase1(obj, shapex, prunx, maxl - 1, depth + 1, 0)) return true;
    }
  }
  let shapex = shape;
  if (lm <= 0) {
    let m = 0;
    while (true) {
      m += Shape_TopMove[shapex];
      shapex = m >>> 4;
      m &= 15;
      if (m >= 12) break;
      const prunx = ShapePrun[shapex];
      if (prunx > maxl) break;
      else if (prunx < maxl) {
        obj.Search_move[depth] = m;
        if (search_phase1(obj, shapex, prunx, maxl - 1, depth + 1, 1)) return true;
      }
    }
  }
  shapex = shape;
  if (lm <= 1) {
    let m = 0;
    while (true) {
      m += Shape_BottomMove[shapex];
      shapex = m >>> 4;
      m &= 15;
      if (m >= 6) break;
      const prunx = ShapePrun[shapex];
      if (prunx > maxl) break;
      else if (prunx < maxl) {
        obj.Search_move[depth] = -m;
        if (search_phase1(obj, shapex, prunx, maxl - 1, depth + 1, 2)) return true;
      }
    }
  }
  return false;
}

function search_phase2(
  obj: SearchObj,
  edge: number,
  corner: number,
  topEdgeFirst: boolean,
  botEdgeFirst: boolean,
  ml: number,
  maxl: number,
  depth: number,
  lm: number,
): boolean {
  if (maxl === 0 && !topEdgeFirst && botEdgeFirst) return true;
  if (lm !== 0 && topEdgeFirst === botEdgeFirst) {
    const edgex = Square_TwistMove[edge];
    const cornerx = Square_TwistMove[corner];
    if (
      SquarePrun[(edgex << 1) | (1 - ml)] < maxl &&
      SquarePrun[(cornerx << 1) | (1 - ml)] < maxl
    ) {
      obj.Search_move[depth] = 0;
      if (search_phase2(obj, edgex, cornerx, topEdgeFirst, botEdgeFirst, 1 - ml, maxl - 1, depth + 1, 0))
        return true;
    }
  }
  if (lm <= 0) {
    let topEdgeFirstx = !topEdgeFirst;
    let edgex = topEdgeFirstx ? Square_TopMove[edge] : edge;
    let cornerx = topEdgeFirstx ? corner : Square_TopMove[corner];
    let m = topEdgeFirstx ? 1 : 2;
    let prun1 = SquarePrun[(edgex << 1) | ml];
    let prun2 = SquarePrun[(cornerx << 1) | ml];
    while (m < 12 && prun1 <= maxl && prun1 <= maxl) {
      if (prun1 < maxl && prun2 < maxl) {
        obj.Search_move[depth] = m;
        if (search_phase2(obj, edgex, cornerx, topEdgeFirstx, botEdgeFirst, ml, maxl - 1, depth + 1, 1))
          return true;
      }
      topEdgeFirstx = !topEdgeFirstx;
      if (topEdgeFirstx) {
        edgex = Square_TopMove[edgex];
        prun1 = SquarePrun[(edgex << 1) | ml];
        m += 1;
      } else {
        cornerx = Square_TopMove[cornerx];
        prun2 = SquarePrun[(cornerx << 1) | ml];
        m += 2;
      }
    }
  }
  if (lm <= 1) {
    let botEdgeFirstx = !botEdgeFirst;
    let edgex = botEdgeFirstx ? Square_BottomMove[edge] : edge;
    let cornerx = botEdgeFirstx ? corner : Square_BottomMove[corner];
    let m = botEdgeFirstx ? 1 : 2;
    let prun1 = SquarePrun[(edgex << 1) | ml];
    let prun2 = SquarePrun[(cornerx << 1) | ml];
    while (m < (maxl > 6 ? 6 : 12) && prun1 <= maxl && prun1 <= maxl) {
      if (prun1 < maxl && prun2 < maxl) {
        obj.Search_move[depth] = -m;
        if (search_phase2(obj, edgex, cornerx, topEdgeFirst, botEdgeFirstx, ml, maxl - 1, depth + 1, 2))
          return true;
      }
      botEdgeFirstx = !botEdgeFirstx;
      if (botEdgeFirstx) {
        edgex = Square_BottomMove[edgex];
        prun1 = SquarePrun[(edgex << 1) | ml];
        m += 1;
      } else {
        cornerx = Square_BottomMove[cornerx];
        prun2 = SquarePrun[(cornerx << 1) | ml];
        m += 2;
      }
    }
  }
  return false;
}

function search_init2(obj: SearchObj): boolean {
  obj.Search_d.copy(obj.Search_c);
  for (let i = 0; i < obj.Search_length1; ++i) {
    obj.Search_d.doMove(obj.Search_move[i]);
  }
  fullCube_getSquare(obj.Search_d, obj.Search_sq);
  const edge = obj.Search_sq.edgeperm;
  const corner = obj.Search_sq.cornperm;
  const ml = obj.Search_sq.ml;
  const prun = Math.max(
    SquarePrun[(obj.Search_sq.edgeperm << 1) | ml],
    SquarePrun[(obj.Search_sq.cornperm << 1) | ml],
  );
  for (let i = prun; i < obj.Search_maxlen2; ++i) {
    if (
      search_phase2(
        obj,
        edge,
        corner,
        obj.Search_sq.topEdgeFirst,
        obj.Search_sq.botEdgeFirst,
        ml,
        i,
        obj.Search_length1,
        0,
      )
    ) {
      obj.Search_sol_string = search_move2string(obj, i + obj.Search_length1);
      return true;
    }
  }
  return false;
}

function search_move2string(obj: SearchObj, len: number): string {
  let s = '';
  let top = 0;
  let bottom = 0;
  for (let i = len - 1; i >= 0; i--) {
    let val = obj.Search_move[i];
    if (val > 0) {
      val = 12 - val;
      top = val > 6 ? val - 12 : val;
    } else if (val < 0) {
      val = 12 + val;
      bottom = val > 6 ? val - 12 : val;
    } else {
      const twst = '/';
      if (top === 0 && bottom === 0) {
        s += twst;
      } else {
        s += ' (' + top + ',' + bottom + ')' + twst;
      }
      top = bottom = 0;
    }
  }
  if (top !== 0 || bottom !== 0) {
    s += ' (' + top + ',' + bottom + ') ';
  }
  return s;
}

function search_solution(obj: SearchObj, c: SqCubie): string {
  obj.Search_c = c;
  const shape = fullCube_getShapeIdx(c);
  for (
    obj.Search_length1 = ShapePrun[shape];
    obj.Search_length1 < 100;
    ++obj.Search_length1
  ) {
    obj.Search_maxlen2 = Math.min(32 - obj.Search_length1, 17);
    if (search_phase1(obj, shape, ShapePrun[shape], obj.Search_length1, 0, -1)) break;
  }
  return obj.Search_sol_string ?? '';
}

// ---- Random state ----

function fullCube_randomCube(rng: () => number, indice?: number): SqCubie {
  if (indice === undefined) {
    indice = Math.floor(rng() * 3678);
  }
  const f = new SqCubie();
  const shape = Shape_ShapeIdx[indice];
  let corner = (0x01234567 << 1) | 0x11111111;
  let edge = 0x01234567 << 1;
  let n_corner = 8;
  let n_edge = 8;
  for (let i = 0; i < 24; i++) {
    if (((shape >>> i) & 1) === 0) {
      // edge
      const rnd = Math.floor(rng() * n_edge) << 2;
      f.setPiece(23 - i, (edge >>> rnd) & 0xf);
      const m = (1 << rnd) - 1;
      edge = (edge & m) + ((edge >>> 4) & ~m);
      --n_edge;
    } else {
      // corner pair
      const rnd = Math.floor(rng() * n_corner) << 2;
      f.setPiece(23 - i, (corner >>> rnd) & 0xf);
      f.setPiece(22 - i, (corner >>> rnd) & 0xf);
      const m = (1 << rnd) - 1;
      corner = (corner & m) + ((corner >>> 4) & ~m);
      --n_corner;
      ++i;
    }
  }
  f.ml = Math.floor(rng() * 2);
  return f;
}

// ---- Public entry ----

function ensureInited(): void {
  if (!shapeInited) {
    shape_init();
    shapeInited = true;
  }
  if (!squareInited) {
    square_init();
    squareInited = true;
  }
}

/** Generate a random-state Sq1 scramble. */
export function scrambleSq1RandomState(rng: () => number): string {
  ensureInited();
  const search = newSearch();
  const cube = fullCube_randomCube(rng);
  const raw = search_solution(search, cube);
  return raw.trim().replace(/\s+/g, ' ');
}
