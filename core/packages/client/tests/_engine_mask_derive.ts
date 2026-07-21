/**
 * Engine mask map derivation — canonical sticker id → /sim engine sticker BUILD
 * KEY (`userData.stickerKey`), the "mask 直映" table that replaces SR_INDEX_MAP
 * on the engine render path (PLAN-sr-retirement §2b / Phase 3).
 *
 * Same φ-by-conjugation machinery as the sr map (`deriveSrMap` in
 * `_puzzle_mask_derive.ts`); nothing is hand-typed. The engine side permutations
 * are read off the BUILT 3D scene geometrically: every facelet has a lattice
 * centroid (mean of its `schematicPoly` through `matrixWorld`); a move rotates
 * the in-layer centroids about the move axis, and each lands exactly on the
 * centroid of the slot it now occupies — that matching IS the permutation.
 * Handedness is not assumed: both global signs are tried, the mirror candidate
 * cannot conjugate a clockwise turn to a clockwise turn and dies in the solver,
 * exactly one must survive (asserted).
 */
import * as THREE from 'three';
import {
  buildPyraPiece, buildCore, EDGE_PAIRS, vertexAxis, PYRA_A,
} from '@/app/[lang]/sim/engine/pyra/pyraGeometry';
import { deriveSrMap, pyraPerms, type Perm, type SrPerms } from './_puzzle_mask_derive';

interface EngineSticker {
  key: string;
  /** 复原帧晶格质心(世界系)。 */
  centroid: THREE.Vector3;
  faceM: number;
  piece: { kind: 'tip' | 'corner' | 'edge'; a: number; b: number };
}

const KEY_RE = /^(tip|corner|edge)(\d)(?:-(\d))?:(\d)$/;

/** 建复原态 pyra 场景,收集全部贴纸(key + 晶格质心),face-major 稳定排序。 */
export function collectPyraStickers(): EngineSticker[] {
  const scene = new THREE.Scene();
  scene.add(buildCore());
  for (let k = 0; k < 4; k++) {
    scene.add(buildPyraPiece('tip', k).pivot);
    scene.add(buildPyraPiece('corner', k).pivot);
  }
  for (const [a, b] of EDGE_PAIRS) scene.add(buildPyraPiece('edge', a, b).pivot);
  scene.updateMatrixWorld(true);

  const out: EngineSticker[] = [];
  const v = new THREE.Vector3();
  scene.traverse((o) => {
    const key = o.userData.stickerKey as string | undefined;
    const poly = o.userData.schematicPoly as number[] | undefined;
    if (!key || !poly) return;
    const m = KEY_RE.exec(key);
    if (!m) throw new Error(`[engine-mask] bad stickerKey "${key}"`);
    // schematicPoly 反烘了 PIECE_SHRINK,乘 matrixWorld(含 group 收缩变换)后
    // 落回未收缩晶格位置 —— 质心即晶格质心,与邻块严格共点的同一坐标系。
    const c = new THREE.Vector3();
    for (let i = 0; i < poly.length; i += 3) {
      c.add(v.set(poly[i], poly[i + 1], poly[i + 2]).applyMatrix4((o as THREE.Mesh).matrixWorld));
    }
    c.multiplyScalar(3 / poly.length);
    out.push({
      key, centroid: c, faceM: Number(m[4]),
      piece: { kind: m[1] as EngineSticker['piece']['kind'], a: Number(m[2]), b: m[3] !== undefined ? Number(m[3]) : -1 },
    });
  });
  // face-major 稳定序(flat index = face 段内序),SrPerms 适配层直接用
  out.sort((x, y) => x.faceM - y.faceM || (x.key < y.key ? -1 : 1));
  return out;
}

/** 贴纸是否在 vertex k 的转动层(tipOnly = 小写 tip 转)。 */
function inLayer(s: EngineSticker, k: number, tipOnly: boolean): boolean {
  if (tipOnly) return s.piece.kind === 'tip' && s.piece.a === k;
  if (s.piece.kind === 'edge') return s.piece.a === k || s.piece.b === k;
  return s.piece.a === k; // tip / corner
}

/** 几何求某转动的贴纸置换:π[p] = 转后坐在位置 p 的原贴纸(与 canonical 同约定)。 */
function permOf(stickers: EngineSticker[], k: number, sign: 1 | -1, tipOnly: boolean): Perm {
  const R = new THREE.Matrix4().makeRotationAxis(vertexAxis(k), sign * 2 * Math.PI / 3);
  const EPS = PYRA_A * 1e-4;
  const perm: Perm = stickers.map((_, i) => i);
  for (let i = 0; i < stickers.length; i++) {
    if (!inLayer(stickers[i], k, tipOnly)) continue;
    const p = stickers[i].centroid.clone().applyMatrix4(R);
    const hits = stickers.map((s, j) => [s.centroid.distanceTo(p), j] as const)
      .filter(([d]) => d < EPS);
    if (hits.length !== 1) {
      throw new Error(`[engine-mask] rotated centroid of ${stickers[i].key} matched ${hits.length} slots (want 1)`);
    }
    perm[hits[0][1]] = i;
  }
  return perm;
}

/** 引擎侧包成 SrPerms 形状(slot = [`m${face}`, 段内序])喂 deriveSrMap。 */
function pyraEngineAsSr(stickers: EngineSticker[], sign: 1 | -1): SrPerms {
  const gens: Record<string, Perm> = {};
  // 引擎顶点字母:V0=U V1=L V2=R V3=B(pyraGeometry 的 FACE_COLOR 注释:面 m 对顶点
  // m,D↔U / R↔L / L↔R / F↔B)。与 canonical 生成元同名对映,由共轭解唯一性验证。
  const NAMES = ['U', 'L', 'R', 'B'];
  for (let k = 0; k < 4; k++) {
    gens[NAMES[k]] = permOf(stickers, k, sign, false);
    gens[NAMES[k].toLowerCase()] = permOf(stickers, k, sign, true);
  }
  const perFace = stickers.length / 4;
  return {
    n: stickers.length,
    slot: (i) => [`m${stickers[i].faceM}`, i % perFace],
    gens,
  };
}

export interface EngineMapResult {
  /** canonical sid → engine stickerKey */
  map: Record<string, string>;
  /** canonical face → engine face tag(`m0`..)*/
  faceMap: Record<string, string>;
  /** 存活的全局手性符号 */
  sign: 1 | -1;
}

export function derivePyraEngineMap(): EngineMapResult {
  const stickers = collectPyraStickers();
  const c = pyraPerms();
  const genMap = { U: 'U', L: 'L', R: 'R', B: 'B', u: 'u', l: 'l', r: 'r', b: 'b' };
  const results: EngineMapResult[] = [];
  for (const sign of [1, -1] as const) {
    const r = deriveSrMap(c, pyraEngineAsSr(stickers, sign), genMap);
    if (!r) continue;
    if (r.solutions !== 1) throw new Error(`[engine-mask] pyra sign ${sign}: ${r.solutions} solutions (want 1)`);
    const perFace = stickers.length / 4;
    const map: Record<string, string> = {};
    for (const [sid, [face, idx]] of Object.entries(r.map)) {
      map[sid] = stickers[Number(face.slice(1)) * perFace + idx].key;
    }
    results.push({ map, faceMap: r.faceMap, sign });
  }
  if (results.length !== 1) {
    throw new Error(`[engine-mask] pyra: ${results.length} surviving handedness candidates (want exactly 1)`);
  }
  return results[0];
}
