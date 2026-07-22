// visualcube 箭头 DSL → 引擎示意导出器的世界坐标线段(退役对照表 §2b:把 /visualcube
// studio 的箭头标注「面/从/到/缩放/颜色 + DSL」搬到引擎路线;UI 与 DSL 解析照搬,只换
// 渲染后端)。
//
// 复用 @cuberoot/visualcube 的 parseArrows(不重造 DSL 解析);它给出 (s1,s2,s3) 每个
// = {face: vcFace 0-5, n: row*N+col}。visualcube renderArrow 的语义:**两端恒画在
// s1.face 单面上**(s2/s3 的 face 仅解析、不参与几何,见 drawing.ts renderArrow 用
// geometry[arrow.s1.face] 取两端)。故桥只需把 (s1.face, n) 反解成引擎 facelet 再取
// 世界中心。
//
// 反解 = netIndexOf 的逆(netIndexOf 已对真实 visualcube 位串核验,见 vcStageMask):
// n → (row,col) → 引擎 (face, x,y,z)。round-trip oracle(tests/vc_arrow_bridge.test.ts:
// netIndexOf(faceletFromNet(...)) === n 全覆盖)锁死方向,不独立猜正负。
//
// 世界中心走**解析**(cubelet 系局部中心 + HALF·面外法向,再乘示意贴纸 mesh 的
// matrixWorld)。锚 mesh 变换(3/N 缩放 + 整体旋转)而非逐 instance 矩阵 —— 箭头按
// visualcube 语义指向**固定几何位**(U0 恒是顶面某格),与逐块打乱位移无关。
//
// 分层:client-only 增强(同 vcStageMask);Phase 1 headless 抽包随 visualcube 消费方处理。
import * as THREE from 'three';
import { parseArrows } from '@cuberoot/visualcube';
import { FACE, SIZE } from '../define';
import type { SchematicArrow } from '../../sim_svg_export_schematic';

const HALF = SIZE / 2;
// visualcube renderArrow 的兜底色(arrow.color ?? defaultColor ?? Gray)。空串也算未设 ——
// 导出器的 `color ?? '#000000'` 只接 null/undefined,空串会漏成 stroke=""(隐身)。
const DEFAULT_ARROW_COLOR = '#808080';

// visualcube Face 编号(U0 R1 F2 D3 L4 B5)→ 引擎 FACE。vcStageMask 的 ENGINE_TO_VC_FACE 的逆。
const VC_TO_ENGINE_FACE: Record<number, number> = {
  0: FACE.U, 1: FACE.R, 2: FACE.F, 3: FACE.D, 4: FACE.L, 5: FACE.B,
};

// 面外法向(与 cubelet.getFace / makeStickerLocalMatrix 同源:L−x R+x D−y U+y B−z F+z)。
const FACE_NORMAL: Record<number, readonly [number, number, number]> = {
  [FACE.L]: [-1, 0, 0], [FACE.R]: [1, 0, 0],
  [FACE.D]: [0, -1, 0], [FACE.U]: [0, 1, 0],
  [FACE.B]: [0, 0, -1], [FACE.F]: [0, 0, 1],
};

/** netIndexOf 的逆:visualcube (vcFace, n=row*N+col) → 引擎 facelet (engineFace, x,y,z)。
 *  越界(n 不在该面)返回 null。公式逐面从 netIndexOf 解出(row=⌊n/N⌋ col=n%N)。 */
export function faceletFromNet(
  vcFace: number, n: number, N: number,
): { face: number; x: number; y: number; z: number } | null {
  const face = VC_TO_ENGINE_FACE[vcFace];
  if (face === undefined) return null;
  const max = N - 1;
  if (n < 0 || n >= N * N) return null;
  const row = Math.floor(n / N);
  const col = n % N;
  let x = 0, y = 0, z = 0;
  switch (face) {
    case FACE.U: z = row; x = col; y = max; break;             // netIndexOf U: z*N+x
    case FACE.D: z = max - row; x = col; y = 0; break;          // D: (max-z)*N+x
    case FACE.F: y = max - row; x = col; z = max; break;        // F: (max-y)*N+x
    case FACE.B: y = max - row; x = max - col; z = 0; break;    // B: (max-y)*N+(max-x)
    case FACE.R: y = max - row; z = max - col; x = max; break;  // R: (max-y)*N+(max-z)
    case FACE.L: y = max - row; z = col; x = 0; break;          // L: (max-y)*N+z
    default: return null;
  }
  return { face, x, y, z };
}

/** facelet (engineFace,x,y,z) → 局部贴纸中心(cubelet 系,SIZE 单位、居中):
 *  cubelet 中心 SIZE·(g−half) + HALF·面外法向(= makeStickerLocalMatrix 的表面偏移)。 */
function localStickerCenter(
  face: number, x: number, y: number, z: number, N: number, out: THREE.Vector3,
): THREE.Vector3 {
  const half = (N - 1) / 2;
  const nrm = FACE_NORMAL[face];
  return out.set(
    SIZE * (x - half) + HALF * nrm[0],
    SIZE * (y - half) + HALF * nrm[1],
    SIZE * (z - half) + HALF * nrm[2],
  );
}

/** 场景里示意贴纸 mesh 的 matrixWorld(承载 3/N 缩放 + 整体旋转,逐块打乱无关 → 固定
 *  几何位)。NxN 走 InstancedRenderer 的 schematicInstancedPoly mesh;找不到返回 null。 */
function schematicMeshWorld(scene: THREE.Object3D): THREE.Matrix4 | null {
  let m: THREE.Matrix4 | null = null;
  scene.traverse((o) => {
    if (m) return;
    if ((o as THREE.Mesh).userData?.schematicInstancedPoly) m = (o as THREE.Mesh).matrixWorld;
  });
  return m;
}

/**
 * DSL(`U0U2-red,U6U8`)→ 世界坐标线段(喂 exportSimSvgSchematic 的 opts.arrows)。
 * NxN 专属(阶数 N;示意小面几何仅 NxN 走 instanced quad)。visualcube 的 scale(向中点
 * 收缩,10 = 不缩)照搬;influence/曲线(s3)暂不支持 —— 导出器只画直线段,退化为直箭头。
 */
export function resolveEngineArrows(
  scene: THREE.Object3D, dsl: string, N: number, defaultColor?: string,
): SchematicArrow[] {
  if (!dsl || N < 2) return [];
  const meshWorld = schematicMeshWorld(scene);
  if (!meshWorld) return [];
  const parsed = parseArrows(dsl);
  if (!parsed.length) return [];
  const out: SchematicArrow[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), mid = new THREE.Vector3();
  for (const arrow of parsed) {
    // visualcube:两端都在 s1.face(s2.face 仅解析)。
    const f1 = faceletFromNet(arrow.s1.face, arrow.s1.n, N);
    const f2 = faceletFromNet(arrow.s1.face, arrow.s2.n, N);
    if (!f1 || !f2) continue;
    localStickerCenter(f1.face, f1.x, f1.y, f1.z, N, a).applyMatrix4(meshWorld);
    localStickerCenter(f2.face, f2.x, f2.y, f2.z, N, b).applyMatrix4(meshWorld);
    // scale/10 向中点收缩两端(visualcube transScale;默认 10 → 因子 1 不变)。
    const k = (arrow.scale ?? 10) / 10;
    if (k !== 1) {
      mid.addVectors(a, b).multiplyScalar(0.5);
      a.lerpVectors(mid, a, k);
      b.lerpVectors(mid, b, k);
    }
    out.push({
      p1: [a.x, a.y, a.z],
      p2: [b.x, b.y, b.z],
      // 空串(studio 默认箭头色未填)也算未设 → 兜底灰,否则导出器画成 stroke=""。
      color: arrow.color || (defaultColor && defaultColor.length ? defaultColor : DEFAULT_ARROW_COLOR),
    });
  }
  return out;
}
