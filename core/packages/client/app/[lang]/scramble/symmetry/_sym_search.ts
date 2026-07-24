/**
 * 对称图案搜索 —— 忠实移植 hkociemba/CubeExplorer 的 SymSearch.pas
 * (Symmetry Editor tab 的 Start Search)。
 *
 * 思路:要找"在子群 H 下不变"的状态 p,即对每个 A ∈ H 都有 A·p·A⁻¹ = p。
 * 于是只要试着放一个块,H 里其余元素就把一整条轨道上的块全部钉死;冲突就回溯。
 * 反对称元素 A 满足 A·p·A⁻¹ = p⁻¹,推导出的钉死公式不同(见 SetCorners 注释)。
 * 这让搜索空间从 4.3×10¹⁹ 掉到可枚举的规模。
 *
 * 上游逐条对应的约束:
 *  - Number of Colors:每个面上出现的颜色数必须落在勾选集合里(放块过程中用
 *    "不超过最大值"提前剪枝,放完再做精确判定)。
 *  - Permutation:整方 / 只置换棱(角归位)/ 只置换角(棱归位),各分奇偶。
 *    奇置换本身不可解,上游用交换两块贴纸的方式把它画成合法状态。
 *  - Exactly this (anti)symmetry:不允许有 H 之外的额外(反)对称。
 *  - No Selfinverse:排除 p² = 复原态 的对合状态。
 *  - Continuous:图案跨棱不断开(与 Pattern Search 同一判据)。
 *  - Allow Isomorphics:关掉则结果按 48 对称(可选连同求逆)去重。
 *
 * 纯计算、无 DOM —— 供 _sym_search.worker.ts 与 tests/symmetry_search.test.ts 共用。
 */

import { CORNER_FACELET, EDGE_FACELET } from '../solver/facelet';
import { edgeContinuous } from '../pattern/search/_pattern_core';
import {
  SYMS, SYM_INV, N_SYM, addCOri, CORNER_AXIS, EDGE_AXIS, maskToList, normalizer,
} from './_sym_core';

export type PermMode = 'all' | 'edgesEven' | 'edgesOdd' | 'cornersEven' | 'cornersOdd';

export interface SymSearchOptions {
  /** 目标对称子群 H 的 48 位掩码(必须含恒等)。 */
  symMask: bigint;
  /** 反对称陪集掩码;bit 0 = 要求自逆。 */
  asymMask: bigint;
  exactSym: boolean;
  exactAsym: boolean;
  /** 排除自逆状态(上游 No Selfinverse)。 */
  noSelfInverse: boolean;
  /** 长度 6:允许每面出现 1..6 种颜色。 */
  colorCounts: boolean[];
  permMode: PermMode;
  continuous: boolean;
  /** true = 不去重(上游 Allow Isomorphics)。 */
  allowIsomorphics: boolean;
  /** 去重时把 p 与 p⁻¹ 视为同一个。 */
  isoIncludeInverse: boolean;
  maxResults: number;
}

export interface SymSearchStats {
  nodes: number;
  found: number;
  /** true = 达到结果上限提前停止,否则搜索空间已穷尽。 */
  truncated: boolean;
}

export interface SymSearchCallbacks {
  onResult(facelet: string): void;
  onProgress?(nodes: number, found: number): void;
}

const FACE_CHARS = 'URFDLB';
const PROGRESS_MASK = (1 << 18) - 1;
/** 角朝向求逆:0↔0 1↔2 2↔1,镜射位不变(上游 invOri)。 */
const INV_ORI = [0, 2, 1, 3, 4, 5];

/** 奇置换状态的显示修正:交换两块的侧面贴纸,让画面成为合法状态。 */
const ODD_EDGE_FIX: [number, number][] = [[9, 2], [20, 4], [38, 2], [18, 1]]; // R1←F,F3←L,L3←F,F1←R
const ODD_CORNER_FIX: [number, number][] = [[12, 4], [41, 1]]; // R4←L,L6←R

export function searchSymmetric(
  opts: SymSearchOptions,
  cb: SymSearchCallbacks,
): SymSearchStats {
  const symList = new Uint8Array(N_SYM);
  const asymList = new Uint8Array(N_SYM);
  for (const s of maskToList(opts.symMask)) symList[s] = 1;
  for (const s of maskToList(opts.asymMask)) asymList[s] = 1;
  symList[0] = 1;
  /** 只需要遍历真正带约束的元素。 */
  const active: number[] = [];
  for (let j = 0; j < N_SYM; j++) if (symList[j] || asymList[j]) active.push(j);

  const cornersOnly = opts.permMode === 'cornersEven' || opts.permMode === 'cornersOdd';
  const edgesOnly = opts.permMode === 'edgesEven' || opts.permMode === 'edgesOdd';
  const wantOdd = opts.permMode === 'edgesOdd' || opts.permMode === 'cornersOdd';

  // 颜色数:bit s = 允许每面 s 种颜色
  let alCol = 0;
  let maxCol = 0;
  for (let i = 0; i < 6; i++) if (opts.colorCounts[i]) { alCol |= 1 << (i + 1); maxCol = i + 1; }
  if (alCol === 0) { alCol = 1 << 6; maxCol = 6; }

  const dedupSyms = opts.allowIsomorphics ? [] : Array.from({ length: N_SYM }, (_, i) => i);
  const normSyms = opts.allowIsomorphics ? [] : maskToList(normalizer(opts.symMask));

  const ccC = new Int8Array(8).fill(-1);
  const ccO = new Int8Array(8);
  const ecE = new Int8Array(12).fill(-1);
  const ecO = new Int8Array(12);
  const cornerUsed = new Uint8Array(8);
  const edgeUsed = new Uint8Array(12);
  const setByCorner = new Uint8Array(8);
  const setByEdge = new Uint8Array(12);
  const facelets = new Uint8Array(54);

  const seen = new Set<string>();
  const seenCorners = new Set<string>();
  const stats: SymSearchStats = { nodes: 0, found: 0, truncated: false };
  let stop = false;

  const bump = () => {
    stats.nodes++;
    if ((stats.nodes & PROGRESS_MASK) === 0) cb.onProgress?.(stats.nodes, stats.found);
  };

  //──────────────── 每面颜色数 ────────────────
  const cn = new Uint8Array(36); // [face*6 + color]
  function colourNumberOk(exact: boolean): boolean {
    cn.fill(0);
    for (let f = 0; f < 6; f++) cn[f * 6 + f] = 1; // 中心色恒在
    for (let c = 0; c < 8; c++) {
      const piece = ccC[c];
      if (piece < 0) continue;
      const o = ccO[c];
      for (let s = 0; s < 3; s++) cn[CORNER_AXIS[c][s] * 6 + CORNER_AXIS[piece][(s + 3 - o) % 3]] = 1;
    }
    for (let e = 0; e < 12; e++) {
      const piece = ecE[e];
      if (piece < 0) continue;
      const o = ecO[e];
      for (let s = 0; s < 2; s++) cn[EDGE_AXIS[e][s] * 6 + EDGE_AXIS[piece][(s + o) % 2]] = 1;
    }
    for (let f = 0; f < 6; f++) {
      let s = 0;
      for (let col = 0; col < 6; col++) s += cn[f * 6 + col];
      if (exact) { if (((alCol >> s) & 1) === 0) return false; }
      else if (s > maxCol) return false;
    }
    return true;
  }

  //──────────────── 共轭(用于 exact 判定) ────────────────
  function conjugateSelf(s: number): { cp: Int8Array; co: Int8Array; ep: Int8Array; eo: Int8Array } {
    const A = SYMS[s];
    const Ai = SYMS[SYM_INV[s]];
    const cp = new Int8Array(8);
    const co = new Int8Array(8);
    const ep = new Int8Array(12);
    const eo = new Int8Array(12);
    for (let i = 0; i < 8; i++) {
      const m = Ai.cp[i];
      const k = ccC[m];
      cp[i] = A.cp[k];
      co[i] = addCOri(addCOri(A.co[k], ccO[m]), Ai.co[i]);
    }
    for (let i = 0; i < 12; i++) {
      const m = Ai.ep[i];
      const k = ecE[m];
      ep[i] = A.ep[k];
      eo[i] = (A.eo[k] + ecO[m] + Ai.eo[i]) % 2;
    }
    return { cp, co, ep, eo };
  }

  function hasSymmetry(s: number): boolean {
    const q = conjugateSelf(s);
    for (let i = 0; i < 8; i++) if (q.cp[i] !== ccC[i] || q.co[i] !== ccO[i]) return false;
    for (let i = 0; i < 12; i++) if (q.ep[i] !== ecE[i] || q.eo[i] !== ecO[i]) return false;
    return true;
  }

  /** p · (S·p·S⁻¹) = E ⟺ S·p·S⁻¹ = p⁻¹ */
  function hasAntisymmetry(s: number): boolean {
    const q = conjugateSelf(s);
    for (let i = 0; i < 8; i++) {
      const k = q.cp[i];
      if (ccC[k] !== i) return false;
      if (addCOri(ccO[k], q.co[i]) !== 0) return false;
    }
    for (let i = 0; i < 12; i++) {
      const k = q.ep[i];
      if (ecE[k] !== i) return false;
      if ((ecO[k] + q.eo[i]) % 2 !== 0) return false;
    }
    return true;
  }

  function isSelfInverse(): boolean {
    for (let i = 0; i < 8; i++) {
      const k = ccC[i];
      if (ccC[k] !== i) return false;
      if ((ccO[k] + ccO[i]) % 3 !== 0) return false;
    }
    for (let i = 0; i < 12; i++) {
      const k = ecE[i];
      if (ecE[k] !== i) return false;
      if ((ecO[k] + ecO[i]) % 2 !== 0) return false;
    }
    return true;
  }

  //──────────────── 去重键 ────────────────
  function cornerKey(): string {
    let best: string | null = null;
    for (const s of normSyms) {
      const A = SYMS[s];
      const Ai = SYMS[SYM_INV[s]];
      let k = '';
      for (let i = 0; i < 8; i++) {
        const m = Ai.cp[i];
        const p = ccC[m];
        k += A.cp[p].toString(36) + addCOri(addCOri(A.co[p], ccO[m]), Ai.co[i]).toString(36);
      }
      if (best === null || k < best) best = k;
    }
    return best!;
  }

  function fullKey(): string {
    let best: string | null = null;
    for (const s of dedupSyms) {
      const q = conjugateSelf(s);
      const forms = opts.isoIncludeInverse ? [q, invertState(q)] : [q];
      for (const f of forms) {
        let k = '';
        for (let i = 0; i < 8; i++) k += f.cp[i].toString(36) + f.co[i].toString(36);
        for (let i = 0; i < 12; i++) k += f.ep[i].toString(36) + f.eo[i].toString(36);
        if (best === null || k < best) best = k;
      }
    }
    return best!;
  }

  function invertState(q: { cp: Int8Array; co: Int8Array; ep: Int8Array; eo: Int8Array }) {
    const cp = new Int8Array(8);
    const co = new Int8Array(8);
    const ep = new Int8Array(12);
    const eo = new Int8Array(12);
    for (let i = 0; i < 8; i++) { cp[q.cp[i]] = i; co[q.cp[i]] = (3 - q.co[i]) % 3; }
    for (let i = 0; i < 12; i++) { ep[q.ep[i]] = i; eo[q.ep[i]] = q.eo[i]; }
    return { cp, co, ep, eo };
  }

  //──────────────── 输出 ────────────────
  function buildFacelets(): void {
    for (let f = 0; f < 6; f++) for (let i = 0; i < 9; i++) facelets[f * 9 + i] = f;
    for (let c = 0; c < 8; c++) {
      const piece = ccC[c];
      const o = ccO[c];
      for (let s = 0; s < 3; s++) {
        facelets[CORNER_FACELET[c][s]] = CORNER_AXIS[piece][(s + 3 - o) % 3];
      }
    }
    for (let e = 0; e < 12; e++) {
      const piece = ecE[e];
      const o = ecO[e];
      for (let s = 0; s < 2; s++) {
        facelets[EDGE_FACELET[e][s]] = EDGE_AXIS[piece][(s + o) % 2];
      }
    }
  }

  function emit(): void {
    buildFacelets();
    // 上游顺序:先 Continuous 过滤,通过了才进同构去重表
    if (opts.continuous && opts.permMode === 'all') {
      for (let e = 0; e < 12; e++) if (!edgeContinuous(facelets, e)) return;
    }
    if (!opts.allowIsomorphics) {
      const k = fullKey();
      if (seen.has(k)) return;
      seen.add(k);
      seenCorners.add(cornerKey());
    }
    if (opts.permMode === 'edgesOdd') for (const [f, c] of ODD_EDGE_FIX) facelets[f] = c;
    else if (opts.permMode === 'cornersOdd') for (const [f, c] of ODD_CORNER_FIX) facelets[f] = c;
    let out = '';
    for (let i = 0; i < 54; i++) out += FACE_CHARS[facelets[i]];
    stats.found++;
    cb.onResult(out);
    if (stats.found >= opts.maxResults) { stats.truncated = true; stop = true; }
  }

  //──────────────── 叶子:全部块都放好 ────────────────
  function finish(): void {
    let flip = 0;
    for (let e = 0; e < 12; e++) flip += ecO[e];
    if (flip % 2 !== 0) return;

    let inv = 0;
    for (let a = 7; a >= 1; a--) for (let b = a - 1; b >= 0; b--) if (ccC[b] > ccC[a]) inv++;
    for (let a = 11; a >= 1; a--) for (let b = a - 1; b >= 0; b--) if (ecE[b] > ecE[a]) inv++;
    const isOdd = inv % 2 === 1;
    if (isOdd !== wantOdd) return;

    if (!colourNumberOk(true)) return;

    if (opts.exactSym) {
      for (let s = 0; s < N_SYM; s++) {
        if (symList[s]) continue;
        if (hasSymmetry(s)) return;
      }
    }
    if (opts.exactAsym) {
      for (let s = 0; s < N_SYM; s++) {
        if (asymList[s]) continue;
        if (hasAntisymmetry(s)) return;
      }
    }
    if (opts.noSelfInverse && isSelfInverse()) return;
    emit();
  }

  //──────────────── 放棱 ────────────────
  function setEdges(curPlace: number): void {
    if (stop) return;
    for (let e = 0; e < 12 && !stop; e++) {
      if (cornersOnly && curPlace !== e) continue;
      if (edgeUsed[e]) continue;
      edgeUsed[e] = 1;
      ecE[curPlace] = e;
      for (let i = 0; i < 2 && !stop; i++) {
        if (cornersOnly && i > 0) break;
        ecO[curPlace] = i;
        bump();
        let ok = true;
        for (const j of active) {
          const anti = asymList[j] === 1;
          const A = SYMS[j];
          const Ai = SYMS[SYM_INV[j]];
          let ePlace: number;
          let eCubie: number;
          let otest: number;
          if (anti) {
            ePlace = A.ep[ecE[curPlace]];
            eCubie = A.ep[curPlace];
            otest = (A.eo[curPlace] + ecO[curPlace] + Ai.eo[ePlace]) % 2;
          } else {
            ePlace = A.ep[curPlace];
            eCubie = A.ep[ecE[curPlace]];
            otest = (A.eo[ecE[curPlace]] + ecO[curPlace] + Ai.eo[ePlace]) % 2;
          }
          if (ecE[ePlace] < 0 && !edgeUsed[eCubie]) {
            edgeUsed[eCubie] = 1;
            setByEdge[ePlace] = 1;
            ecE[ePlace] = eCubie;
            ecO[ePlace] = otest;
          } else if (ecE[ePlace] !== eCubie || ecO[ePlace] !== otest) {
            ok = false;
            break;
          }
        }
        if (ok && colourNumberOk(false)) {
          let next = -1;
          for (let k = 0; k < 12; k++) if (ecE[k] < 0) { next = k; break; }
          if (next < 0) finish();
          else setEdges(next);
        }
        for (let k = 0; k < 12; k++) {
          if (!setByEdge[k]) continue;
          edgeUsed[ecE[k]] = 0;
          setByEdge[k] = 0;
          ecE[k] = -1;
          ecO[k] = 0;
        }
      }
      edgeUsed[e] = 0;
      ecE[curPlace] = -1;
      ecO[curPlace] = 0;
    }
  }

  //──────────────── 放角 ────────────────
  function setCorners(curPlace: number): void {
    if (stop) return;
    for (let c = 0; c < 8 && !stop; c++) {
      if (edgesOnly && curPlace !== c) continue;
      if (cornerUsed[c]) continue;
      cornerUsed[c] = 1;
      ccC[curPlace] = c;
      for (let i = 0; i < 3 && !stop; i++) {
        if (edgesOnly && i > 0) break;
        ccO[curPlace] = i;
        bump();
        let ok = true;
        for (const j of active) {
          const anti = asymList[j] === 1;
          const A = SYMS[j];
          const Ai = SYMS[SYM_INV[j]];
          let cPlace: number;
          let cCubie: number;
          let otest: number;
          if (anti) {
            cPlace = A.cp[ccC[curPlace]];
            cCubie = A.cp[curPlace];
            otest = addCOri(addCOri(A.co[curPlace], INV_ORI[ccO[curPlace]]), Ai.co[cPlace]);
          } else {
            cPlace = A.cp[curPlace];
            cCubie = A.cp[ccC[curPlace]];
            otest = addCOri(addCOri(A.co[ccC[curPlace]], ccO[curPlace]), Ai.co[cPlace]);
          }
          if (ccC[cPlace] < 0 && !cornerUsed[cCubie]) {
            cornerUsed[cCubie] = 1;
            setByCorner[cPlace] = 1;
            ccC[cPlace] = cCubie;
            ccO[cPlace] = otest;
          } else if (ccC[cPlace] !== cCubie || ccO[cPlace] !== otest) {
            ok = false;
            break;
          }
        }
        if (ok && colourNumberOk(false)) {
          let next = -1;
          for (let k = 0; k < 8; k++) if (ccC[k] < 0) { next = k; break; }
          if (next < 0) {
            let twist = 0;
            for (let k = 0; k < 8; k++) twist += ccO[k];
            if (twist % 3 === 0 && !(!opts.allowIsomorphics && seenCorners.has(cornerKey()))) {
              setEdges(0);
            }
          } else setCorners(next);
        }
        for (let k = 0; k < 8; k++) {
          if (!setByCorner[k]) continue;
          cornerUsed[ccC[k]] = 0;
          setByCorner[k] = 0;
          ccC[k] = -1;
          ccO[k] = 0;
        }
      }
      cornerUsed[c] = 0;
      ccC[curPlace] = -1;
      ccO[curPlace] = 0;
    }
  }

  setCorners(0);
  cb.onProgress?.(stats.nodes, stats.found);
  return stats;
}
