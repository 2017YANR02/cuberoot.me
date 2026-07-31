/**
 * 「引擎的这张贴纸是第几格」—— 非 NxN 题板的唯一一份寻址。
 *
 * 金字塔 / 斜转有现成的派生表:`lib/puzzle-image` 的 `ENGINE_SID_MAP` 把 canonical sid
 * (`F3` / `U0`)映到引擎建构时烙在 mesh 上的 `userData.stickerKey`,而 canonical sid 的
 * 面序 + 格序**恰好就是** `_lib/puzzles` 的贴纸下标空间,于是一次查表就完。
 *
 * 枫叶只有 18 枚贴纸,那张表没给它做,所以现推 —— 但推的也是身份而不是坐标:
 *   · 面:贴纸建构时烙的外法向 `simStickerNormal`,与 canonical 面法向比对;
 *   · 可转角:引擎的角轴向量,与「canonical 轴那三个面的法向之和」比对。
 * 两处都要求**恰好一个**候选,推歪了当场抛,不会悄悄错位。
 * (tests/predict_ivy_engine.test.ts 再拿引擎几何把整张映射逐格对一遍。)
 */
import type * as THREE from 'three';
import { ENGINE_SID_MAP } from '@/lib/puzzle-image/puzzle-mask';
import { MOVE_CENTERS } from '@/lib/ivy-solver';
import { ivyLensIndex, ivyPetalIndex } from '../_lib/puzzles/ivy';
import type { PredictPuzzle } from '../_lib/puzzles';

/** canonical 面法向,面序 U R F B L D(= lib/ivy-solver 的 `centers` 下标)。 */
const IVY_FACE_NORMAL: readonly [number, number, number][] = [
  [0, 1, 0],  // U
  [1, 0, 0],  // R
  [0, 0, 1],  // F
  [0, 0, -1], // B
  [-1, 0, 0], // L
  [0, -1, 0], // D
];

const dot3 = (a: readonly number[], b: readonly number[]): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function unique(hits: number[], what: string): number {
  if (hits.length !== 1) throw new Error(`[predict] ${what} 匹配到 ${hits.length} 个候选(要 1 个)`);
  return hits[0];
}

/** 引擎带的最小接口 —— 只要能问出可转角的轴向就够,不必把 IvyCube 整个类型拉进来。 */
interface IvyLike { cornerAxisVec(axis: number): THREE.Vector3 }

function ivySlotOf(cube: THREE.Object3D): (mesh: THREE.Mesh) => number {
  // canonical 轴 m 的顶点方向 = 它那三个面的法向之和。
  const canonAxis = MOVE_CENTERS.map((tri) => {
    const v: [number, number, number] = [0, 0, 0];
    for (const f of tri) for (let k = 0; k < 3; k++) v[k] += IVY_FACE_NORMAL[f][k];
    const len = Math.hypot(...v);
    return v.map((x) => x / len);
  });
  const axisOf = new Map<number, number>();
  for (let e = 0; e < 4; e++) {
    const dir = (cube as unknown as IvyLike).cornerAxisVec(e);
    const d = [dir.x, dir.y, dir.z];
    const len = Math.hypot(...d);
    const unit = d.map((x) => x / len);
    axisOf.set(e, unique(canonAxis.flatMap((c, i) => (dot3(c, unit) > 0.99 ? [i] : [])), `枫叶引擎角轴 ${e}`));
  }

  const faceOf = (n: THREE.Vector3): number => {
    const len = Math.hypot(n.x, n.y, n.z);
    const unit = [n.x / len, n.y / len, n.z / len];
    return unique(
      IVY_FACE_NORMAL.flatMap((f, i) => (dot3(f, unit) > 0.99 ? [i] : [])),
      `枫叶贴纸法向 ${unit.join(',')}`,
    );
  };

  return (mesh) => {
    const nrm = mesh.userData.simStickerNormal as THREE.Vector3 | undefined;
    if (!nrm) return -1;
    const face = faceOf(nrm);
    const engineAxis = mesh.userData.ivyCornerAxis as number | undefined;
    return engineAxis === undefined ? ivyLensIndex(face) : ivyPetalIndex(face, axisOf.get(engineAxis)!);
  };
}

/** stickerKey → 贴纸下标(派生表 `ENGINE_SID_MAP` 的逆)。 */
function tableSlotOf(puzzle: PredictPuzzle, table: Record<string, string>): (mesh: THREE.Mesh) => number {
  const byKey = new Map<string, number>();
  for (const [sid, key] of Object.entries(table)) {
    const m = /^([A-Za-z]+)(\d+)$/.exec(sid);
    if (!m) continue;
    const f = puzzle.faces.indexOf(m[1]);
    const i = Number(m[2]);
    if (f < 0 || i >= puzzle.perFace) continue;
    byKey.set(key, f * puzzle.perFace + i);
  }
  return (mesh) => byKey.get(String(mesh.userData.stickerKey)) ?? -1;
}

/**
 * 收齐一个非 NxN 引擎拼图的贴纸 mesh,按贴纸下标排好(下标 → mesh)。
 * 数量对不上就抛 —— 少一张贴纸意味着映射有洞,题板会悄悄画错一格。
 */
export function collectStickerMeshes(puzzle: PredictPuzzle, cube: THREE.Object3D): THREE.Mesh[] {
  const table = ENGINE_SID_MAP[puzzle.id];
  const slotOf = table ? tableSlotOf(puzzle, table) : ivySlotOf(cube);
  const total = puzzle.faces.length * puzzle.perFace;
  const out = new Array<THREE.Mesh | null>(total).fill(null);
  cube.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.simRole !== 'sticker') return;
    const slot = slotOf(mesh);
    if (slot < 0 || slot >= total) return;
    out[slot] = mesh;
  });
  const missing = out.findIndex((m) => m === null);
  if (missing >= 0) throw new Error(`[predict] ${puzzle.id} 第 ${missing} 格没找到贴纸 mesh`);
  return out as THREE.Mesh[];
}
