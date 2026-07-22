// vcArrowBridge:visualcube 箭头 DSL → 引擎 facelet 的反解 oracle。
//
// 核心判据:faceletFromNet 是 netIndexOf 的逆。netIndexOf 已对真实 visualcube 位串
// 核验(见 vcStageMask 注释),故只要 round-trip 全覆盖成立,反解的面/坐标方向就由
// 构造保证正确 —— 不靠独立猜正负(退役对照表 §2b 箭头项去风险的关键)。
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { netIndexOf } from '@/app/[lang]/sim/engine/nxn/vcStageMask';
import { faceletFromNet, resolveEngineArrows } from '@/app/[lang]/sim/engine/nxn/vcArrowBridge';
import { FACE } from '@/app/[lang]/sim/engine/define';

// 引擎 FACE → visualcube Face 编号(vcStageMask 的 ENGINE_TO_VC_FACE,此处内联对照)。
const ENGINE_TO_VC: Record<number, number> = {
  [FACE.U]: 0, [FACE.R]: 1, [FACE.F]: 2, [FACE.D]: 3, [FACE.L]: 4, [FACE.B]: 5,
};

/** 某引擎面上所有 (x,y,z) 栅格位(该面固定一个坐标为 0 或 max,另两维遍历)。 */
function* faceCells(face: number, N: number): Generator<[number, number, number]> {
  const max = N - 1;
  for (let a = 0; a < N; a++) {
    for (let b = 0; b < N; b++) {
      switch (face) {
        case FACE.U: yield [b, max, a]; break;   // x=b y=max z=a
        case FACE.D: yield [b, 0, a]; break;
        case FACE.F: yield [b, a, max]; break;   // x=b y=a z=max
        case FACE.B: yield [b, a, 0]; break;
        case FACE.R: yield [max, a, b]; break;   // x=max y=a z=b
        case FACE.L: yield [0, a, b]; break;
      }
    }
  }
}

describe('vcArrowBridge faceletFromNet', () => {
  const ORDERS = [2, 3, 4, 5, 7];
  const FACES = [FACE.U, FACE.R, FACE.F, FACE.D, FACE.L, FACE.B];

  it('round-trips netIndexOf on every facelet of every face (2..7)', () => {
    for (const N of ORDERS) {
      const max = N - 1;
      for (const face of FACES) {
        const vcFace = ENGINE_TO_VC[face];
        for (const [x, y, z] of faceCells(face, N)) {
          const n = netIndexOf(x, y, z, face, max, N);
          const back = faceletFromNet(vcFace, n, N);
          expect(back).not.toBeNull();
          expect(back).toEqual({ face, x, y, z });
        }
      }
    }
  });

  it('covers every net index 0..N²-1 on each face bijectively', () => {
    for (const N of ORDERS) {
      const max = N - 1;
      for (const face of FACES) {
        const vcFace = ENGINE_TO_VC[face];
        const seen = new Set<string>();
        for (let n = 0; n < N * N; n++) {
          const f = faceletFromNet(vcFace, n, N);
          expect(f).not.toBeNull();
          expect(f!.face).toBe(face);
          // 反解回的 (x,y,z) 经 netIndexOf 必回到同一个 n。
          expect(netIndexOf(f!.x, f!.y, f!.z, face, max, N)).toBe(n);
          seen.add(`${f!.x},${f!.y},${f!.z}`);
        }
        expect(seen.size).toBe(N * N); // 单射 → N² 个不同 facelet
      }
    }
  });

  it('rejects out-of-range indices and unknown faces', () => {
    expect(faceletFromNet(0, -1, 3)).toBeNull();
    expect(faceletFromNet(0, 9, 3)).toBeNull();  // 3² = 9 → index 9 越界
    expect(faceletFromNet(6, 0, 3)).toBeNull();  // vcFace 6 不存在
  });

  it('resolves the U-face top row corners on a 3x3 (concrete anchor)', () => {
    // U0 = 顶面 row0(netIndexOf 注释 z=0=B 侧)col0(x=0=L);U2 = 同 row col2(x=2=R)。
    expect(faceletFromNet(0, 0, 3)).toEqual({ face: FACE.U, x: 0, y: 2, z: 0 });
    expect(faceletFromNet(0, 2, 3)).toEqual({ face: FACE.U, x: 2, y: 2, z: 0 });
    // U8 = row2(z=2=F 侧)col2(x=2) → 顶面前排右角。
    expect(faceletFromNet(0, 8, 3)).toEqual({ face: FACE.U, x: 2, y: 2, z: 2 });
  });
});

describe('resolveEngineArrows 曲线(s3/influence,visualcube renderArrow 语义)', () => {
  /** 最小场景:示意 instanced mesh 锚(单位 matrixWorld → 世界 = 贴纸局部中心)。 */
  function fakeScene(): THREE.Object3D {
    const scene = new THREE.Object3D();
    const anchor = new THREE.Object3D();
    anchor.userData.schematicInstancedPoly = true;
    scene.add(anchor);
    scene.updateMatrixWorld(true);
    return scene;
  }
  const v = (p: [number, number, number]) => new THREE.Vector3(...p);

  it('s3 → p3 控制点;influence/5 从未收缩弦中点向 s3 缩放(默认 i=10 → 因子 2)', () => {
    const scene = fakeScene();
    const straight = resolveEngineArrows(scene, 'U0U8', 3)[0];
    expect(straight.p3).toBeUndefined();
    // i5 → 因子 1:控制点 = s3 贴纸中心本身(在 U 面平面上,y 与两端相同)。
    const raw = resolveEngineArrows(scene, 'U0U8U2-i5', 3)[0];
    expect(raw.p3).toBeDefined();
    expect(raw.p3![1]).toBeCloseTo(straight.p1[1], 10);
    // 默认 influence 10 → 因子 2:p3 = mid + 2·(s3 − mid)(vc transScale(center, i/5))。
    const curved = resolveEngineArrows(scene, 'U0U8U2', 3)[0];
    const mid = v(straight.p1).add(v(straight.p2)).multiplyScalar(0.5);
    const expected = mid.clone().add(v(raw.p3!).sub(mid).multiplyScalar(2));
    expect(v(curved.p3!).distanceTo(expected)).toBeLessThan(1e-9);
    // scale 收缩不动控制点(vc 同序:中点取未收缩端点)。
    const shrunk = resolveEngineArrows(scene, 'U0U8U2-s8', 3)[0];
    expect(v(shrunk.p3!).distanceTo(v(curved.p3!))).toBeLessThan(1e-9);
    expect(v(shrunk.p1).distanceTo(v(straight.p1))).toBeGreaterThan(0);
  });
});
