/**
 * /sim 手部模型 — 参数化程序生成(纯 three 原生几何,无外部模型资产)。
 * side=±1 是几何手性参数:所有横向坐标与横向旋转 ×side 镜像构建,
 * 不用 scale=-1(那会翻三角绕序、坏背面剔除)。
 * 注意:魔方右侧的手用 side=-1、左侧用 side=+1(家位指位规格对手性有硬约束,
 * 见 handsRig 构造注释);拇指刻意造在小指侧(艺术自由,参考站同款 —— 换来
 * 拇指压 F 面时不被掌体遮挡)。
 *
 * 局部坐标系(单手作者系,side=+1 时):
 *   +x = 腕 → 指尖方向
 *   +z = 掌心朝向(握持面法向)
 *   +y = 食指侧(side=-1 时食指在 -y)
 * 手指弯曲(curl)= 关节 rotation.y 负向(指尖朝 +z 掌心卷,两种 side 同向);
 * 张开(splay)= 指根 rotation.z(×side 由 rig 处理)。
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { SIZE } from "../define";

export type FingerName = "thumb" | "index" | "middle" | "ring" | "pinky";
export const FINGER_NAMES: FingerName[] = ["thumb", "index", "middle", "ring", "pinky"];

/** 一根手指的三段关节链。root=掌指关节(拇指为腕掌基),mid/tip=远端两关节。
 *  rig 每帧写各关节 rotation 摆姿态;本模块只建几何与层级。 */
export interface FingerJoints {
  root: THREE.Group;
  mid: THREE.Group;
  tip: THREE.Group;
  /** 三段骨长(关节到关节),供 rig 需要时估算指尖位置。 */
  segLens: [number, number, number];
  /** 指根基座朝向(四指=identity,拇指=对掌位)。rig 摆姿态时必须
   *  `root.quaternion = rootBase ∘ R(curl/splay)` 叠加,禁止直接写
   *  rotation(会抹掉拇指基座 —— v1 实测踩过)。 */
  rootBase: THREE.Quaternion;
}

export interface HandModel {
  group: THREE.Group;
  side: 1 | -1;
  fingers: Record<FingerName, FingerJoints>;
  /** 全部蒙皮网格(肤 + 甲 + 袖口),供 rig 统一开层/透明度/禁 raycast。 */
  meshes: THREE.Mesh[];
}

/** 设计基准:常量按 SIZE=64(3x3 棱长 192)标定,U 做整体缩放钩子。 */
const U = SIZE / 64;

/** 手指几何参数:三段骨长 + 根部半径。中指最长,小指明显短。 */
const FINGER_DIMS: Record<Exclude<FingerName, "thumb">, { segs: [number, number, number]; r: number; y: number }> = {
  index: { segs: [50, 32, 26], r: 12.5, y: 36 },
  middle: { segs: [55, 36, 28], r: 13, y: 12 },
  ring: { segs: [50, 33, 26], r: 12, y: -12 },
  pinky: { segs: [38, 25, 21], r: 10.5, y: -36 },
};
const THUMB_DIMS = { segs: [42, 38, 30] as [number, number, number], r: 15 };

/** 逐段半径衰减 — 指根粗、指尖细,轮廓自然。 */
const SEG_TAPER = [1.0, 0.9, 0.82];

const noRaycast = (): void => { /* 手不可拾取 — 拖拽/点击穿透到魔方 */ };

function capsuleAlongX(r: number, len: number): THREE.CapsuleGeometry {
  // CapsuleGeometry 默认沿 Y;旋到 X。len = 关节距,圆帽在两端各溢出 r,
  // 相邻段圆帽在关节处互相嵌套 → 无缝圆润指节(参考站的断裂方块感就输在这)。
  const g = new THREE.CapsuleGeometry(r, len, 8, 22);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** 建一段指骨:骨段网格挂在 parent(当前关节)自己的坐标系里跨 [0,len],
 *  返回位于 x=len 的下一关节挂点 Group。
 *  ⚠️ 网格必须挂 parent 而非返回的下一关节组 —— v1 把网格塞进下一关节组
 *  (它再被挪到 x=len),骨段实际渲染在 [len,1.5len]:掌指关节到第一节之间
 *  一段真空(「手指与手心断开」),前两节骨挤进指尖区(碎块感)。关节链
 *  数学一直正确,只有网格错位,故指尖接触点从未露馅(2026-07-04 定位)。 */
function buildSegment(
  parent: THREE.Object3D,
  len: number,
  r: number,
  mat: THREE.Material,
  meshes: THREE.Mesh[],
): THREE.Group {
  const mesh = new THREE.Mesh(capsuleAlongX(r, len), mat);
  mesh.position.x = len / 2;
  mesh.raycast = noRaycast;
  parent.add(mesh);
  meshes.push(mesh);
  const joint = new THREE.Group();
  joint.position.x = len;
  parent.add(joint);
  return joint;
}

/** 指甲:扁圆角片贴在末节背侧(-z),色浅一档 — 便宜但辨识度极高的精致感来源。 */
function addNail(tipJoint: THREE.Group, segLen: number, r: number, nailMat: THREE.Material, meshes: THREE.Mesh[]): void {
  const nail = new THREE.Mesh(new RoundedBoxGeometry(r * 1.5 * U, r * 1.3 * U, 4 * U, 3, 1.8 * U), nailMat);
  nail.position.set(segLen * 0.62, 0, -r * 0.78);
  nail.rotation.y = 0.16; // 顺指尖弧度微倾
  nail.raycast = noRaycast;
  tipJoint.add(nail);
  meshes.push(nail);
}

function buildFinger(
  hand: THREE.Group,
  side: 1 | -1,
  dims: { segs: [number, number, number]; r: number; y: number },
  skinMat: THREE.Material,
  nailMat: THREE.Material,
  meshes: THREE.Mesh[],
): FingerJoints {
  const [l1, l2, l3] = dims.segs.map((v) => v * U) as [number, number, number];
  const root = new THREE.Group();
  root.position.set(46 * U, dims.y * U * side, -3 * U);
  hand.add(root);
  const r1 = dims.r * U * SEG_TAPER[0];
  const r2 = dims.r * U * SEG_TAPER[1];
  const r3 = dims.r * U * SEG_TAPER[2];
  // root 组本身是 MCP 关节;段网格挂它下面,mid/tip 链式挂接(挂点位置由
  // buildSegment 设定,勿在外面再挪 —— 见其头注的错位坑)。
  const seg1End = buildSegment(root, l1, r1, skinMat, meshes);
  const seg2End = buildSegment(seg1End, l2, r2, skinMat, meshes);
  // 末节:胶囊即指尖(圆帽自然收尾)。
  const tipMesh = new THREE.Mesh(capsuleAlongX(r3, l3), skinMat);
  tipMesh.position.x = l3 / 2;
  tipMesh.raycast = noRaycast;
  seg2End.add(tipMesh);
  meshes.push(tipMesh);
  addNail(seg2End, l3, r3, nailMat, meshes);
  return { root, mid: seg1End, tip: seg2End, segLens: [l1, l2, l3], rootBase: new THREE.Quaternion() };
}

function buildThumb(
  hand: THREE.Group,
  side: 1 | -1,
  skinMat: THREE.Material,
  nailMat: THREE.Material,
  meshes: THREE.Mesh[],
): FingerJoints {
  const [l1, l2, l3] = THUMB_DIMS.segs.map((v) => v * U) as [number, number, number];
  const root = new THREE.Group();
  root.position.set(-38 * U, -20 * U * side, 14 * U);
  // 拇指基座朝向:Rz(α)·Ry(β)·Rx(γ)(α,γ 随镜像取反:M_y·Rz·Ry·Rx·M_y =
  // Rz(-α)·Ry(β)·Rx(-γ))。数值由浏览器内求解器对魔方右侧手(side=-1)标定:
  // 掌骨从掌根前下折回,末节沿 F 面朝左上、指腹压 FR 棱 F 面;γ 是绕掌骨的
  // 滚转,决定指腹(而非侧面)贴向面。
  // 基座存 rootBase,由 rig 与 curl/splay 叠加(直接写 rotation 会抹掉基座)。
  const base = new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(0, 0, 1), 2.38 * -side)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.55))
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.71 * -side));
  root.quaternion.copy(base);
  hand.add(root);

  const r1 = THUMB_DIMS.r * U;
  const r2 = THUMB_DIMS.r * U * 0.9;
  const r3 = THUMB_DIMS.r * U * 0.82;
  const seg1End = buildSegment(root, l1, r1, skinMat, meshes);
  const seg2End = buildSegment(seg1End, l2, r2, skinMat, meshes);
  const tipMesh = new THREE.Mesh(capsuleAlongX(r3, l3), skinMat);
  tipMesh.position.x = l3 / 2;
  tipMesh.raycast = noRaycast;
  seg2End.add(tipMesh);
  meshes.push(tipMesh);
  addNail(seg2End, l3, r3, nailMat, meshes);
  return { root, mid: seg1End, tip: seg2End, segLens: [l1, l2, l3], rootBase: base };
}

/** 掌体 + 肉垫 + 指节鼓包 + 腕臂 + 袖口 — 手根 Group 下的静态部分。 */
function buildPalm(
  hand: THREE.Group,
  side: 1 | -1,
  skinMat: THREE.Material,
  meshes: THREE.Mesh[],
): void {
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): void => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x * U, y * U * side, z * U);
    m.scale.set(sx, sy, sz);
    m.raycast = noRaycast;
    hand.add(m);
    meshes.push(m);
  };

  // 主掌体:大圆角盒(圆角 15 → 侧缘饱满不见棱)。
  add(new RoundedBoxGeometry(94 * U, 96 * U, 34 * U, 5, 15 * U), skinMat, 0, 0, 0);
  // 手背微拱(背侧 -z 鼓一点,打光后有骨面起伏)。
  add(new RoundedBoxGeometry(72 * U, 80 * U, 28 * U, 4, 13 * U), skinMat, 2, 0, -6);
  // 大鱼际(拇指根肉垫)/ 小鱼际(小指侧肉垫):压扁球,掌心侧饱满。
  add(new THREE.SphereGeometry(26 * U, 20, 16), skinMat, -6, 34, 8, 1.05, 0.85, 0.62);
  add(new THREE.SphereGeometry(22 * U, 20, 16), skinMat, -10, -36, 6, 1.15, 0.75, 0.58);
  // 四个指节鼓包(MCP 背侧),把掌沿与指根圆滑接起来。
  for (const f of ["index", "middle", "ring", "pinky"] as const) {
    const d = FINGER_DIMS[f];
    add(new THREE.SphereGeometry(d.r * 1.12 * U, 18, 14), skinMat, 45, d.y, -5, 1, 1, 0.8);
  }
  // 腕(短段,随手转)。前臂不在这里 —— 它是 rig 里的独立件,每帧从固定
  // 肘锚点 IK 指向手腕(腕转/回位时肘不跟着绕魔方公转,见 handsRig)。
  add(new THREE.CapsuleGeometry(27 * U, 46 * U, 6, 18).rotateZ(-Math.PI / 2), skinMat, -66, -1, -2, 1, 1, 0.92);
}

/** 前臂与手腕的接驳点(手局部坐标)。rig 每帧把它变换到世界系,作为前臂 IK 的
 *  手端端点。 */
export const WRIST_LOCAL = new THREE.Vector3(-84 * U, -1 * U, -3 * U);

/** 独立前臂件:胶囊体 + 袖口,+x 端点在原点(= 贴腕处)。rig 每帧
 *  `position=腕点, quaternion=setFromUnitVectors(+x, 腕点-肘锚)`。 */
export function buildForearm(
  skinMat: THREE.Material,
  cuffMat: THREE.Material,
): { group: THREE.Group; meshes: THREE.Mesh[] } {
  const group = new THREE.Group();
  const meshes: THREE.Mesh[] = [];
  const LEN = 150 * U;
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(30 * U, LEN, 6, 18).rotateZ(-Math.PI / 2), skinMat);
  arm.position.x = -LEN / 2 + 10 * U; // +x 圆帽稍微探进腕里,接缝圆润
  arm.raycast = noRaycast;
  group.add(arm);
  meshes.push(arm);
  const cuffGeo = new THREE.CylinderGeometry(35 * U, 37 * U, 26 * U, 22).rotateZ(-Math.PI / 2);
  const cuff = new THREE.Mesh(cuffGeo, cuffMat);
  cuff.position.x = -LEN + 18 * U;
  cuff.raycast = noRaycast;
  group.add(cuff);
  meshes.push(cuff);
  return { group, meshes };
}

export function buildHand(
  side: 1 | -1,
  skinMat: THREE.Material,
  nailMat: THREE.Material,
): HandModel {
  const group = new THREE.Group();
  const meshes: THREE.Mesh[] = [];
  buildPalm(group, side, skinMat, meshes);
  const fingers = {
    thumb: buildThumb(group, side, skinMat, nailMat, meshes),
    index: buildFinger(group, side, FINGER_DIMS.index, skinMat, nailMat, meshes),
    middle: buildFinger(group, side, FINGER_DIMS.middle, skinMat, nailMat, meshes),
    ring: buildFinger(group, side, FINGER_DIMS.ring, skinMat, nailMat, meshes),
    pinky: buildFinger(group, side, FINGER_DIMS.pinky, skinMat, nailMat, meshes),
  };
  return { group, side, fingers, meshes };
}
