// @vitest-environment jsdom
//
// 枫叶魔方:/predict 出题模型与 `/sim` 引擎的逐格对拍。
//
// 单开一个文件是因为 `IvyCube` 的贴纸轮廓走 three 的 `SVGLoader`(真圆弧路径),
// 需要 `DOMParser` —— 全集默认的 `node` 环境没有,建构当场炸。其余三种拼图的对拍
// 在 tests/predict_puzzles.test.ts(纯 node),那条 headless 判据不受影响。
//
// 枫叶只有 18 枚贴纸,`lib/puzzle-image` 的两张派生表(块分组 / 引擎贴纸直映)都没给它
// 做,所以 canonical ↔ 引擎的对应在这里现推:面靠贴纸法向认,可转角靠角的轴向认,
// 各自都断言「恰好一个候选」——推错了当场炸,不会悄悄错位。
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import IvyCube from '@/app/[lang]/sim/engine/ivy/IvyCube';
import { parseIvyMoves } from '@/app/[lang]/sim/engine/ivy/IvyTwister';
import { MOVE_CENTERS } from '@/lib/ivy-solver';
import { getPuzzle, identityPerm, stickerCount } from '@/app/[lang]/predict/_lib/puzzles';
import { ivyLensIndex, ivyPetalIndex } from '@/app/[lang]/predict/_lib/puzzles/ivy';
import { collectStickerMeshes } from '@/app/[lang]/predict/_components/engineSlotMap';

/** canonical 面法向,面序 U R F B L D(= lib/ivy-solver 的 `centers` 下标)。 */
const FACE_NORMAL: readonly THREE.Vector3[] = [
  new THREE.Vector3(0, 1, 0),  // U
  new THREE.Vector3(1, 0, 0),  // R
  new THREE.Vector3(0, 0, 1),  // F
  new THREE.Vector3(0, 0, -1), // B
  new THREE.Vector3(-1, 0, 0), // L
  new THREE.Vector3(0, -1, 0), // D
];

function faceOfNormal(nrm: THREE.Vector3): number {
  const unit = nrm.clone().normalize();
  const hits = FACE_NORMAL.flatMap((v, f) => (v.dot(unit) > 0.99 ? [f] : []));
  expect(hits.length, `法向 ${unit.toArray().join(',')} 匹配到 ${hits.length} 个面`).toBe(1);
  return hits[0];
}

/**
 * 每个「格」的代表点,**只由格的几何决定,与贴纸自己的形状无关**:
 *   透镜(面 f)= 2·N(f);花瓣(面 f, 角 a)= 2·N(f) + V(a)
 * 其中 V(a) 是角 a 的顶点方向。绕角 a 转 120° 时 V(a) 不动、a 那三个面互换,于是
 * 代表点恰好落到它真正去的那个格上 —— 换过形状的贴纸(透镜和花瓣外形不同)也能对上。
 *
 * (试过用贴纸自己的质心:透镜和两片花瓣都横跨整张面,包围球心全在面心,认成同一格;
 * 顶点均值又因为形状不同、两个格的均值对不齐,一个都匹配不上。)
 */
function slotPoint(face: number, axis: number | null): THREE.Vector3 {
  const p = FACE_NORMAL[face].clone().multiplyScalar(2);
  if (axis === null) return p;
  const v = new THREE.Vector3();
  for (const f of MOVE_CENTERS[axis]) v.add(FACE_NORMAL[f]);
  return p.add(v.normalize());
}

/** 引擎可转角序号 → canonical 轴序号。canonical 轴 m 的顶点方向 = 它那三个面的法向之和。 */
function axisMapOf(cube: IvyCube): number[] {
  const canonDir = MOVE_CENTERS.map((tri) => {
    const v = new THREE.Vector3();
    for (const f of tri) v.add(FACE_NORMAL[f]);
    return v.normalize();
  });
  return Array.from({ length: 4 }, (_, e) => {
    const dir = cube.cornerAxisVec(e).normalize();
    const hits = canonDir.flatMap((d, c) => (d.dot(dir) > 0.99 ? [c] : []));
    expect(hits.length, `引擎角轴 ${e} 匹配到 ${hits.length} 个 canonical 轴`).toBe(1);
    return hits[0];
  });
}

interface Slot {
  index: number;
  home: THREE.Vector3;
  mesh: THREE.Mesh;
  /** 还原帧的世界矩阵之逆 —— 转完拿 `M1 · M0⁻¹` 就是这枚贴纸受到的刚体运动。 */
  inv0: THREE.Matrix4;
}

/** 建一个还原态的枫叶,把 18 枚贴纸按 canonical 下标排好。 */
function buildSlots(cube: IvyCube): Slot[] {
  const axisMap = axisMapOf(cube);
  cube.updateMatrixWorld(true);
  const out: Slot[] = [];
  cube.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.simRole !== 'sticker') return;
    const nrm = mesh.userData.simStickerNormal as THREE.Vector3 | undefined;
    expect(nrm, '贴纸没有 simStickerNormal').toBeTruthy();
    const face = faceOfNormal(nrm!);
    const engineAxis = mesh.userData.ivyCornerAxis as number | undefined;
    const axis = engineAxis === undefined ? null : axisMap[engineAxis];
    // 花瓣挂在可转角的 pivot 上、透镜挂在中心块的 pivot 上;还原帧下贴纸就贴在它的本位面。
    const index = axis === null ? ivyLensIndex(face) : ivyPetalIndex(face, axis);
    out.push({
      index,
      home: slotPoint(face, axis),
      mesh,
      inv0: mesh.matrixWorld.clone().invert(),
    });
  });
  expect(out.length, '引擎贴纸数').toBe(18);
  out.sort((a, b) => a.index - b.index);
  out.forEach((s, i) => expect(s.index, `第 ${i} 格`).toBe(i));
  return out;
}

describe('/predict 枫叶模型 ≡ /sim 引擎', () => {
  it('每个 token 的贴纸置换逐格相同', () => {
    const puzzle = getPuzzle('ivy');
    const n = stickerCount(puzzle);
    for (const token of ['R', "R'", 'L', "L'", 'D', "D'", 'B', "B'"]) {
      const cube = new IvyCube();
      const slots = buildSlots(cube);
      cube.applyMoveSilent(parseIvyMoves(token)[0]);
      cube.updateMatrixWorld(true);

      const enginePerm = new Array<number>(n).fill(-1);
      const motion = new THREE.Matrix4();
      for (const s of slots) {
        // 这枚贴纸受到的刚体运动作用在它自己格的代表点上 = 它现在坐在哪个格。
        const now = s.home.clone().applyMatrix4(motion.multiplyMatrices(s.mesh.matrixWorld, s.inv0));
        const hits = slots.flatMap((t, j) => (t.home.distanceTo(now) < 1e-6 ? [j] : []));
        expect(hits.length, `${token}:贴纸 ${s.index} 转后匹配到 ${hits.length} 个格`).toBe(1);
        enginePerm[hits[0]] = s.index;
      }
      expect(puzzle.apply(identityPerm(n), [token]), `token ${token}`).toEqual(enginePerm);
    }
  });

  // 上面那条锁的是「模型的置换 = 引擎的几何置换」,用的是这里按法向 + 角轴排的 mesh。
  // 题板画色 / 点击命中走的是 `collectStickerMeshes`(同一套推法,但那是产品代码那一份),
  // 两者必须逐格相同 —— 差一格,题板会把高亮画在别的贴纸上,盘面看上去照样自洽。
  it('题板的 collectStickerMeshes 与几何验过的那份排法逐格相同', () => {
    const cube = new IvyCube();
    const slots = buildSlots(cube);
    expect(collectStickerMeshes(getPuzzle('ivy'), cube)).toEqual(slots.map((s) => s.mesh));
  });
});
