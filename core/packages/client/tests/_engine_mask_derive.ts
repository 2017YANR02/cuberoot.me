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
 *
 * 生成元对映(genMap)按拼图各取最省的可靠办法:
 *  - pyraminx:顶点字母同名对映(V0=U…),双全局手性试解,镜像死在求解器;
 *  - skewb:canonical 生成元在中心贴纸上诱导一个面 3-循环,与「绕角轴 ±120° 对
 *    面法向的 3-循环」逐一匹配 → 轴 + 手性一次钉死,再共轭验证;
 *  - megaminx:面名两库不同,复用 deriveMegaGenMap(U/F 锚 + 十二面体邻接图),
 *    镜像候选共轭不通被拒,双全局手性试解。
 * 所有路线最终都断言:恰好 1 个候选存活、φ 唯一。
 */
import * as THREE from 'three';
import {
  buildPyraPiece, buildCore as buildPyraCore, EDGE_PAIRS, vertexAxis, PYRA_A,
} from '@/app/[lang]/sim/engine/pyra/pyraGeometry';
import {
  buildCornerMesh, buildCenterMesh, buildCore as buildSkewbCore, H as SKEWB_H,
} from '@/app/[lang]/sim/engine/skewb/skewbGeometry';
import { CORNER_AXIS, CENTER_AXIS } from '@/app/[lang]/sim/engine/skewb/skewbState';
import {
  buildCornerPiece, buildEdgePiece, buildCenterPiece, R_IN as MEGA_R,
} from '@/app/[lang]/sim/engine/mega/megaGeometry';
import { FACE_NORMAL as MEGA_FACE_NORMAL, FACE_NAME as MEGA_ENGINE_FACE_NAME, CORNER_FACES, EDGE_FACES } from '@/app/[lang]/sim/engine/mega/megaState';
import {
  deriveSrMap, deriveMegaGenMap, pyraPerms, skewbPerms, megaPerms,
  type Perm, type PuzzlePerms, type SrPerms,
} from './_puzzle_mask_derive';

// ─── 通用件 ──────────────────────────────────────────────────────────────

interface EngineSticker {
  key: string;
  /** 复原帧晶格质心(世界系,schematicPoly 均值经 matrixWorld)。 */
  centroid: THREE.Vector3;
  /** 面标签(与该拼图引擎 gens 的 face 记号同空间)。 */
  faceTag: string;
  /** 本贴纸是否在某转动层(genTag → bool),由建构标识符号判定。 */
  inLayer: (genTag: string) => boolean;
}

/** 从建好的场景收集贴纸(key + 晶格质心),faceTag-major 稳定排序。 */
function collectStickers(
  scene: THREE.Scene,
  describe: (key: string) => { faceTag: string; inLayer: (genTag: string) => boolean },
): EngineSticker[] {
  scene.updateMatrixWorld(true);
  const out: EngineSticker[] = [];
  const v = new THREE.Vector3();
  scene.traverse((o) => {
    const key = o.userData.stickerKey as string | undefined;
    const poly = o.userData.schematicPoly as number[] | undefined;
    if (!key || !poly) return;
    const c = new THREE.Vector3();
    for (let i = 0; i < poly.length; i += 3) {
      c.add(v.set(poly[i], poly[i + 1], poly[i + 2]).applyMatrix4((o as THREE.Mesh).matrixWorld));
    }
    c.multiplyScalar(3 / poly.length);
    out.push({ key, centroid: c, ...describe(key) });
  });
  out.sort((x, y) => (x.faceTag < y.faceTag ? -1 : x.faceTag > y.faceTag ? 1 : x.key < y.key ? -1 : 1));
  return out;
}

/** 几何求一个转动的贴纸置换:π[p] = 转后坐在位置 p 的原贴纸(与 canonical 同约定)。 */
function permOf(stickers: EngineSticker[], genTag: string, rot: THREE.Matrix4, eps: number): Perm {
  const perm: Perm = stickers.map((_, i) => i);
  for (let i = 0; i < stickers.length; i++) {
    if (!stickers[i].inLayer(genTag)) continue;
    const p = stickers[i].centroid.clone().applyMatrix4(rot);
    const hits: number[] = [];
    for (let j = 0; j < stickers.length; j++) if (stickers[j].centroid.distanceTo(p) < eps) hits.push(j);
    if (hits.length !== 1) {
      throw new Error(`[engine-mask] rotated centroid of ${stickers[i].key} matched ${hits.length} slots (want 1)`);
    }
    perm[hits[0]] = i;
  }
  return perm;
}

/** 引擎侧包成 SrPerms 形状(slot = [faceTag, 段内序])喂 deriveSrMap。要求各面贴纸数相等。 */
function engineAsSr(stickers: EngineSticker[], gens: Record<string, Perm>): SrPerms {
  const faces = [...new Set(stickers.map((s) => s.faceTag))];
  const perFace = stickers.length / faces.length;
  if (!Number.isInteger(perFace)) throw new Error('[engine-mask] uneven stickers per face');
  return { n: stickers.length, slot: (i) => [stickers[i].faceTag, i % perFace], gens };
}

export interface EngineMapResult {
  /** canonical sid → engine stickerKey */
  map: Record<string, string>;
  /** canonical face → engine faceTag */
  faceMap: Record<string, string>;
  /** 存活的全局手性符号 */
  sign: 1 | -1;
}

/** 跑一批 (sign, genMap) 候选,断言恰好 1 个存活,把 sr-slot 结果翻译回 stickerKey。 */
function solveUnique(
  c: PuzzlePerms,
  candidates: { sign: 1 | -1; genMap: Record<string, string>; stickers: EngineSticker[]; gens: Record<string, Perm> }[],
  label: string,
): EngineMapResult {
  const results: EngineMapResult[] = [];
  for (const cand of candidates) {
    const r = deriveSrMap(c, engineAsSr(cand.stickers, cand.gens), cand.genMap);
    if (!r) continue;
    if (r.solutions !== 1) throw new Error(`[engine-mask] ${label}: ${r.solutions} solutions (want 1)`);
    const faces = [...new Set(cand.stickers.map((s) => s.faceTag))];
    const perFace = cand.stickers.length / faces.length;
    const map: Record<string, string> = {};
    for (const [sid, [face, idx]] of Object.entries(r.map)) {
      map[sid] = cand.stickers[faces.indexOf(face) * perFace + idx].key;
    }
    results.push({ map, faceMap: r.faceMap, sign: cand.sign });
  }
  if (results.length !== 1) {
    throw new Error(`[engine-mask] ${label}: ${results.length} surviving candidates (want exactly 1)`);
  }
  return results[0];
}

// ─── pyraminx ────────────────────────────────────────────────────────────

const PYRA_KEY_RE = /^(tip|corner|edge)(\d)(?:-(\d))?:(\d)$/;

export function collectPyraStickers(): EngineSticker[] {
  const scene = new THREE.Scene();
  scene.add(buildPyraCore());
  for (let k = 0; k < 4; k++) {
    scene.add(buildPyraPiece('tip', k).pivot);
    scene.add(buildPyraPiece('corner', k).pivot);
  }
  for (const [a, b] of EDGE_PAIRS) scene.add(buildPyraPiece('edge', a, b).pivot);
  return collectStickers(scene, (key) => {
    const m = PYRA_KEY_RE.exec(key);
    if (!m) throw new Error(`[engine-mask] bad pyra stickerKey "${key}"`);
    const kind = m[1]; const a = Number(m[2]); const b = m[3] !== undefined ? Number(m[3]) : -1;
    return {
      faceTag: `m${m[4]}`,
      // genTag = 顶点序号 + 是否 tip-only(`t0` = 小写 tip 转,`v0` = 大写整层)
      inLayer: (g) => {
        const k = Number(g.slice(1));
        if (g[0] === 't') return kind === 'tip' && a === k;
        if (kind === 'edge') return a === k || b === k;
        return a === k;
      },
    };
  });
}

export function derivePyraEngineMap(): EngineMapResult {
  const stickers = collectPyraStickers();
  const c = pyraPerms();
  // 引擎顶点字母:V0=U V1=L V2=R V3=B(pyraGeometry 的 FACE_COLOR 注释:面 m 对顶点
  // m,D↔U / R↔L / L↔R / F↔B)。与 canonical 生成元同名对映,由共轭解唯一性验证。
  const NAMES = ['U', 'L', 'R', 'B'];
  const genMap: Record<string, string> = {};
  for (let k = 0; k < 4; k++) { genMap[NAMES[k]] = `v${k}`; genMap[NAMES[k].toLowerCase()] = `t${k}`; }
  const eps = PYRA_A * 1e-4;
  const candidates = ([1, -1] as const).map((sign) => {
    const gens: Record<string, Perm> = {};
    for (let k = 0; k < 4; k++) {
      const rot = new THREE.Matrix4().makeRotationAxis(vertexAxis(k), sign * 2 * Math.PI / 3);
      gens[`v${k}`] = permOf(stickers, `v${k}`, rot, eps);
      gens[`t${k}`] = permOf(stickers, `t${k}`, rot, eps);
    }
    return { sign, genMap, stickers, gens };
  });
  return solveUnique(c, candidates, 'pyraminx');
}

// ─── skewb ───────────────────────────────────────────────────────────────

const SKEWB_KEY_RE = /^(corner|center)(\d):([UDFBRL])$/;
const SKEWB_FACE_N: Record<string, THREE.Vector3> = {
  U: new THREE.Vector3(0, 1, 0), D: new THREE.Vector3(0, -1, 0),
  R: new THREE.Vector3(1, 0, 0), L: new THREE.Vector3(-1, 0, 0),
  F: new THREE.Vector3(0, 0, 1), B: new THREE.Vector3(0, 0, -1),
};

export function collectSkewbStickers(): EngineSticker[] {
  const scene = new THREE.Scene();
  scene.add(buildSkewbCore());
  for (let i = 0; i < 8; i++) scene.add(buildCornerMesh(i).pivot);
  for (let i = 0; i < 6; i++) scene.add(buildCenterMesh(i).pivot);
  return collectStickers(scene, (key) => {
    const m = SKEWB_KEY_RE.exec(key);
    if (!m) throw new Error(`[engine-mask] bad skewb stickerKey "${key}"`);
    const rep = m[1] === 'corner'
      ? new THREE.Vector3(...CORNER_AXIS[Number(m[2])])
      : new THREE.Vector3(...CENTER_AXIS[Number(m[2])]);
    return {
      faceTag: m[3],
      // genTag = `g{槽位}{p|n}`(轴 + 手性);深切过心 → 动侧 = rep·axis > 0
      inLayer: (g) => rep.dot(new THREE.Vector3(...CORNER_AXIS[parseInt(g.slice(1), 10)])) > 0,
    };
  });
}

/** canonical 生成元在中心贴纸上诱导的面循环(A→B:面 A 的中心搬到了面 B)。
 *  canonical skewb id 空间:每面 5 槽,槽 0 = 中心(mask-core 头注)。 */
function canonicalCenterCycle(c: PuzzlePerms, gen: string): Map<string, string> {
  const perm = c.gens[gen];
  const out = new Map<string, string>();
  for (let pos = 0; pos < c.n; pos++) {
    if (pos % 5 !== 0) continue; // 中心槽
    const from = perm[pos];
    if (from === pos) continue;
    if (from % 5 !== 0) throw new Error(`[engine-mask] skewb gen ${gen}: center slot fed by non-center`);
    out.set(c.face(from), c.face(pos));
  }
  return out;
}

/** 绕角轴旋转对面法向的循环(X→Y:R·n_X = n_Y)。 */
function skewbAxisFaceCycle(slot: number, sign: 1 | -1): Map<string, string> {
  const rot = new THREE.Matrix4().makeRotationAxis(
    new THREE.Vector3(...CORNER_AXIS[slot]).normalize(), sign * 2 * Math.PI / 3,
  );
  const out = new Map<string, string>();
  for (const [X, n] of Object.entries(SKEWB_FACE_N)) {
    const r = n.clone().applyMatrix4(rot);
    const Y = Object.entries(SKEWB_FACE_N).find(([, m]) => m.distanceTo(r) < 1e-9)?.[0];
    if (!Y) throw new Error('[engine-mask] skewb face normal did not map to a face');
    if (Y !== X) out.set(X, Y);
  }
  return out;
}

export function deriveSkewbEngineMap(): EngineMapResult {
  const stickers = collectSkewbStickers();
  const c = skewbPerms();
  // genMap:canonical 生成元只搬动侧 3 个中心(面 3-循环);而 120° 体对角旋转
  // 置换全部 6 个面法向(两个 3-循环)。匹配准则:canonical 循环 ⊆ 轴旋转循环,
  // 且这 3 面在轴正侧(= 动侧 —— 另一侧表示的是「转另一半」,差一个整体旋转,
  // 贴纸置换不同,共轭必败)。轴 + 逐 gen 手性一次钉死,面字母两侧同为 WCA
  // U/D/F/B/R/L,由最终共轭验证。
  const genMap: Record<string, string> = {};
  for (const g of Object.keys(c.gens)) {
    const want = canonicalCenterCycle(c, g);
    const hits: { slot: number; s: 1 | -1 }[] = [];
    for (let slot = 0; slot < 8; slot++) {
      const axis = new THREE.Vector3(...CORNER_AXIS[slot]);
      if (![...want.keys()].every((X) => SKEWB_FACE_N[X].dot(axis) > 0)) continue;
      for (const s of [1, -1] as const) {
        const cycle = skewbAxisFaceCycle(slot, s);
        if ([...want].every(([k, v]) => cycle.get(k) === v)) hits.push({ slot, s });
      }
    }
    if (hits.length !== 1) throw new Error(`[engine-mask] skewb gen ${g}: ${hits.length} axis matches (want 1)`);
    genMap[g] = `g${hits[0].slot}${hits[0].s === 1 ? 'p' : 'n'}`;
  }
  const eps = SKEWB_H * 1e-4;
  const gens: Record<string, Perm> = {};
  for (const tag of new Set(Object.values(genMap))) {
    const slot = parseInt(tag.slice(1), 10);
    const s = tag.endsWith('p') ? 1 : -1;
    const rot = new THREE.Matrix4().makeRotationAxis(
      new THREE.Vector3(...CORNER_AXIS[slot]).normalize(), s * 2 * Math.PI / 3,
    );
    gens[tag] = permOf(stickers, tag, rot, eps);
  }
  return solveUnique(c, [{ sign: 1, genMap, stickers, gens }], 'skewb');
}

// ─── megaminx ────────────────────────────────────────────────────────────

const MEGA_KEY_RE = /^(corner|edge|center)(\d+):(\d+)$/;

export function collectMegaStickers(): EngineSticker[] {
  const scene = new THREE.Scene();
  for (let f = 0; f < 12; f++) scene.add(buildCenterPiece(f).pivot);
  for (let i = 0; i < 20; i++) scene.add(buildCornerPiece(i).pivot);
  for (let i = 0; i < 30; i++) scene.add(buildEdgePiece(i).pivot);
  return collectStickers(scene, (key) => {
    const m = MEGA_KEY_RE.exec(key);
    if (!m) throw new Error(`[engine-mask] bad mega stickerKey "${key}"`);
    const id = Number(m[2]);
    const capFaces: readonly number[] = m[1] === 'corner' ? CORNER_FACES[id]
      : m[1] === 'edge' ? EDGE_FACES[id] : [id];
    return {
      faceTag: MEGA_ENGINE_FACE_NAME[Number(m[3])],
      // genTag = 引擎面名;绕面 f 的转动搬 capFaces ∋ f 的块(f 自己的中心原地转)
      inLayer: (g) => capFaces.includes(MEGA_ENGINE_FACE_NAME.indexOf(g as typeof MEGA_ENGINE_FACE_NAME[number])),
    };
  });
}

export function deriveMegaEngineMap(): EngineMapResult {
  const stickers = collectMegaStickers();
  const c = megaPerms();
  const eps = MEGA_R * 1e-4;
  const candidates: { sign: 1 | -1; genMap: Record<string, string>; stickers: EngineSticker[]; gens: Record<string, Perm> }[] = [];
  for (const sign of [1, -1] as const) {
    const gens: Record<string, Perm> = {};
    for (let f = 0; f < 12; f++) {
      const rot = new THREE.Matrix4().makeRotationAxis(
        new THREE.Vector3(...MEGA_FACE_NORMAL[f]).normalize(), sign * 2 * Math.PI / 5,
      );
      gens[MEGA_ENGINE_FACE_NAME[f]] = permOf(stickers, MEGA_ENGINE_FACE_NAME[f], rot, eps);
    }
    // 面名两库不同(tnoodle U BL BR… / 引擎 PG U F L BL…):U/F 锚 + 邻接图推候选
    // genMap(与 sr 版同一套 deriveMegaGenMap)。第三锚 R='R' 破镜像:U/F 锚下
    // 十二面体只剩旋转与镜像两解,而这里双全局手性都试 —— 镜像配反手性在群层
    // 面也能共轭(sr 版手性固定所以不用),必须用「R 都是 WCA 右面」几何锚排除。
    for (const genMap of deriveMegaGenMap(c, engineAsSr(stickers, gens))) {
      if (genMap.R !== 'R') continue;
      candidates.push({ sign, genMap, stickers, gens });
    }
  }
  return solveUnique(c, candidates, 'megaminx');
}
