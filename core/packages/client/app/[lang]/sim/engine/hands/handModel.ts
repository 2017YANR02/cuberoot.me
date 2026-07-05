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
 *
 * 质感层(2026-07-04 二轮):皮肤材质开 vertexColors,指段两端烘顶点血色
 * (关节微红);共享一张程序值噪声 CanvasTexture 作 bump + roughness(毛孔/
 * 肤质颗粒)。掌体加大加厚、手背用压扁椭球拱(旧 RoundedBox 凸台在手背印出
 * 方形高台);指甲从扁圆角盒改半沉扁椭球(旧盒中段沉皮下只露两翼,远看成
 * V 形凹陷)。
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
  index: { segs: [50, 32, 26], r: 13, y: 36 },
  middle: { segs: [55, 36, 28], r: 13.6, y: 12 },
  ring: { segs: [50, 33, 26], r: 12.5, y: -12 },
  pinky: { segs: [38, 25, 21], r: 11, y: -36 },
};
const THUMB_DIMS = { segs: [42, 38, 30] as [number, number, number], r: 15.6 };

/** 逐段半径衰减 — 指根粗、指尖细,轮廓自然。 */
const SEG_TAPER = [1.0, 0.9, 0.82];

const noRaycast = (): void => { /* 手不可拾取 — 拖拽/点击穿透到魔方 */ };

/** 给几何烘顶点色(皮肤材质 vertexColors:true,所有肤色网格必须带 color 属性,
 *  否则 shader 读到未定义)。tint 不传 = 全白(不改基色)。 */
function paintVerts(
  geo: THREE.BufferGeometry,
  tint?: (p: THREE.Vector3, out: THREE.Color) => void,
): THREE.BufferGeometry {
  const pos = geo.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.setRGB(1, 1, 1);
    if (tint) {
      v.fromBufferAttribute(pos, i);
      tint(v, c);
    }
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** 指段两端(关节处)微红 — 真手指节血色。len = 关节距(网格 x 跨 ±len/2)。 */
function jointTint(len: number): (p: THREE.Vector3, out: THREE.Color) => void {
  const half = len / 2;
  return (p, c) => {
    const f = Math.min(1, Math.max(0, (Math.abs(p.x) - half * 0.45) / (half * 0.85)));
    c.setRGB(1, 1 - 0.1 * f, 1 - 0.15 * f);
  };
}

function capsuleAlongX(r: number, len: number): THREE.CapsuleGeometry {
  // CapsuleGeometry 默认沿 Y;旋到 X。len = 关节距,圆帽在两端各溢出 r,
  // 相邻段圆帽在关节处互相嵌套 → 无缝圆润指节(参考站的断裂方块感就输在这)。
  const g = new THREE.CapsuleGeometry(r, len, 10, 28);
  g.rotateZ(-Math.PI / 2);
  paintVerts(g, jointTint(len));
  return g;
}

/** 程序皮肤细节纹理(平铺值噪声,3 倍频:大尺度肤色斑驳 + 细颗粒毛孔)。
 *  同一张灰度图给 skinMat 作 bumpMap + roughnessMap —— 打光后有微表面起伏,
 *  高光散成肤质而非塑料。 */
export function makeSkinDetailTexture(): THREE.CanvasTexture {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  // 单倍频:cell 整除 S + 格点取模 → 四边无缝平铺。
  const octave = (cell: number): Float32Array => {
    const n = S / cell;
    const grid = new Float32Array(n * n);
    for (let i = 0; i < grid.length; i++) grid[i] = Math.random();
    const out = new Float32Array(S * S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const gx = x / cell;
        const gy = y / cell;
        const x0 = Math.floor(gx) % n;
        const y0 = Math.floor(gy) % n;
        const x1 = (x0 + 1) % n;
        const y1 = (y0 + 1) % n;
        const fx = gx - Math.floor(gx);
        const fy = gy - Math.floor(gy);
        const sx = fx * fx * (3 - 2 * fx);
        const sy = fy * fy * (3 - 2 * fy);
        const a = grid[y0 * n + x0];
        const b = grid[y0 * n + x1];
        const cc = grid[y1 * n + x0];
        const d = grid[y1 * n + x1];
        out[y * S + x] = (a + (b - a) * sx) * (1 - sy) + (cc + (d - cc) * sx) * sy;
      }
    }
    return out;
  };
  const o1 = octave(64);
  const o2 = octave(16);
  const o3 = octave(4);
  for (let i = 0; i < S * S; i++) {
    const v = 0.66 + (o1[i] - 0.5) * 0.18 + (o2[i] - 0.5) * 0.14 + (o3[i] - 0.5) * 0.1;
    const g = Math.round(Math.min(1, Math.max(0, v)) * 255);
    img.data[i * 4] = g;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = g;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** 指甲:半沉扁椭球贴末节背侧(-z),曲面与指尖圆弧相贴 —— 露出部分是光滑
 *  凸圆片,随指尖肩部弧度前倾、前缘略探过指尖。
 *  ⚠️ 别用扁盒:旧 RoundedBox 版中段沉进胶囊皮下、只露两翼 + 盒尖,远看成
 *  指尖上一道 V 形「凹陷」(2026-07-04 用户报障)。 */
function addNail(tipJoint: THREE.Group, segLen: number, r: number, nailMat: THREE.Material, meshes: THREE.Mesh[]): void {
  const nail = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), nailMat);
  nail.scale.set(r * 0.8, r * 0.72, r * 0.4);
  nail.position.set(segLen * 0.8, 0, -r * 0.66);
  nail.rotation.y = 0.32; // 正向 = 根部沉进「甲床」、弧形游离缘鼓向指尖;负角方向反(圆弧鼓向指根,2026-07-05 用户报障)
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

/** 掌体 + 肉垫 + 指节鼓包 + 腕臂 — 手根 Group 下的静态部分。
 *  加大原则(2026-07-04「手掌太小」报障):指根挂点(x=46)与指尖接触点都
 *  不能动,掌体只朝腕侧(-x)加长、y/z 向加厚;掌心侧鼓包顶点必须留在
 *  cube 面(local z ≤ 40,即 home pos 136−96;掌心与面之间刻意留空腔)之内。 */
function buildPalm(
  hand: THREE.Group,
  side: 1 | -1,
  skinMat: THREE.Material,
  meshes: THREE.Mesh[],
): void {
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): void => {
    const m = new THREE.Mesh(paintVerts(geo), mat);
    m.position.set(x * U, y * U * side, z * U);
    m.scale.set(sx, sy, sz);
    m.raycast = noRaycast;
    hand.add(m);
    meshes.push(m);
  };

  // 主掌体:大圆角盒(圆角 16 → 侧缘饱满不见棱),向腕侧加长 + 加厚。
  add(new RoundedBoxGeometry(114 * U, 98 * U, 42 * U, 5, 16 * U), skinMat, -9, 0, 0);
  // 手背拱:压扁椭球平滑鼓起(旧 RoundedBox 凸台在手背印出方形高台)。
  add(new THREE.SphereGeometry(44 * U, 24, 18), skinMat, -4, 0, -7, 1.15, 0.95, 0.36);
  // 掌心肉垫层(握持面中央微鼓)。
  add(new THREE.SphereGeometry(40 * U, 24, 18), skinMat, -12, 0, 8, 1.1, 0.95, 0.4);
  // 大鱼际(拇指根肉垫)/ 小鱼际(小指侧肉垫):压扁球,掌心侧饱满。
  // y 向必须收在掌宽(±49)内侧 ≤2U:椭球超出掌缘会在手轮廓上鼓出独立圆球
  // (2026-07-04 三轮实拍,上下缘各一颗「球」的真凶)。
  add(new THREE.SphereGeometry(30 * U, 20, 16), skinMat, -14, 30, 7, 1.15, 0.7, 0.55);
  add(new THREE.SphereGeometry(26 * U, 20, 16), skinMat, -18, -32, 6, 1.2, 0.7, 0.58);
  // 四个指节鼓包(MCP 背侧):压扁贴掌沿,只留隐约起伏 —— 球太凸手背会
  // 结成一串「葡萄」(2026-07-04 二轮实拍)。
  for (const f of ["index", "middle", "ring", "pinky"] as const) {
    const d = FINGER_DIMS[f];
    add(new THREE.SphereGeometry(d.r * 1.05 * U, 18, 14), skinMat, 45, d.y, -13, 1, 1, 0.55);
  }
  // 腕(短段,随手转)。前臂不在这里 —— 它是 rig 里的独立件,每帧从固定
  // 肘锚点 IK 指向手腕(腕转/回位时肘不跟着绕魔方公转,见 handsRig)。
  // z 压扁到掌厚以内,别在手背再冒一个球帽。
  add(new THREE.CapsuleGeometry(29 * U, 42 * U, 8, 20).rotateZ(-Math.PI / 2), skinMat, -76, -1, 0, 1, 1, 0.72);
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
  const LEN = 152 * U;
  const arm = new THREE.Mesh(paintVerts(new THREE.CapsuleGeometry(31 * U, LEN, 8, 20).rotateZ(-Math.PI / 2)), skinMat);
  arm.position.x = -LEN / 2 + 10 * U; // +x 圆帽稍微探进腕里,接缝圆润
  arm.raycast = noRaycast;
  group.add(arm);
  meshes.push(arm);
  const cuffGeo = new THREE.CylinderGeometry(36 * U, 38 * U, 26 * U, 22).rotateZ(-Math.PI / 2);
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
