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

/** 整手相对魔方的比例(2026-07-05 用户定真实比例:食指/中指/无名指宽 ≈0.9 个
 *  棱块 = 0.9·SIZE,即 2r̄·scale/64 ≈ 0.9 → 2.2;真人手对 57mm 三阶就是这么大)。
 *  改它必须同步:① handPoses 重标定(指根/指长全变,curl 要重解);② world/
 *  backView 手部 near/far 包络余量;③ handsRig 肘锚(×HAND_SCALE)。 */
export const HAND_SCALE = 2.2;

/** 设计基准:常量按 SIZE=64(3x3 棱长 192)标定,U 做整体缩放钩子。 */
const U = (SIZE / 64) * HAND_SCALE;

/** 手指几何参数:三段骨长(近/中/末,近节最长、~2/3 递减,末节短)+ 根部半径
 *  + 指根 y(横向排布)/ rz(横弓:中指根最靠背侧,食指/小指渐移向掌心侧)
 *  + rootX(掌指关节弓:中指根最靠指端、小指根最缩,指根连线成弓非直线)
 *  + roll(绕指轴微滚转,指列向拇指侧自然内旋 —— 打破五指克隆感;绕 x 的
 *  旋转在 y 镜像下反号,应用时 ×side)。
 *  长度序:中 > 无名 ≈ 食 > 小(小指明显短且后缩)。 */
const FINGER_DIMS: Record<Exclude<FingerName, "thumb">, { segs: [number, number, number]; r: number; y: number; rz: number; rootX: number; roll: number }> = {
  index: { segs: [50, 31, 22], r: 12.4, y: 37, rz: -5, rootX: 2, roll: 0.06 },
  middle: { segs: [56, 35, 24], r: 13.0, y: 12, rz: -8, rootX: 6, roll: 0.02 },
  ring: { segs: [49, 32, 22], r: 12.0, y: -13, rz: -4, rootX: 0, roll: -0.03 },
  pinky: { segs: [37, 24, 17], r: 10.4, y: -37, rz: 0, rootX: -9, roll: -0.1 },
};
/** 拇指:整体明显粗于四指但几乎不收锥(真拇指近节到指腹等宽、指腹宽扁),
 *  故单独一套半径表 + 更扁的截面;r 别超食指 10%(等粗肉肠 tell)。 */
const THUMB_DIMS = { segs: [44, 34, 25] as [number, number, number], r: 13.4 };
const THUMB_RADII: [number, number][] = [
  [1.0, 0.92],
  [0.95, 0.82],
  [0.88, 0.62],
];
const THUMB_FLATTEN = 0.66;

/** 整指锥度:每节 [根端, 尖端] 半径系数 × MCP 半径。后一节根端只比前一节尖端
 *  大 2~5%(隆起量小,不成串珠;跳变大了弯指时外侧现台阶环)。末节尖端收到
 *  0.62 —— 真指尖宽 ≈ 根部 70~80%,收到一半以下会成「胡萝卜爪」尖头
 *  (对抗性评审 #2);「末节短」是长度上的,不是把直径掐一半。 */
const SEG_RADII: [number, number][] = [
  [1.0, 0.86], // 近节
  [0.88, 0.74], // 中节
  [0.78, 0.62], // 末节(尖端圆帽 = 指尖)
];
/** 末节指腹微鼓系数(向尖端前的轮廓先升后收,肉垫感)。 */
const TIP_PAD_BULGE = 0.1;
/** 掌背向(局部 z)压扁系数 —— 手指截面是扁椭圆,不是正圆管。 */
const CROSS_FLATTEN = 0.72;

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

/** 锥形指骨两端(关节处)微红 — 真手指节血色。骨轴 x 跨 [0,len],两关节在
 *  x≈0 与 x≈len。 */
function boneTint(len: number): (p: THREE.Vector3, out: THREE.Color) => void {
  return (p, c) => {
    // 血色向远端集中(指尖/甲床最红,根端只留淡淡关节色)—— 均匀的关节环带
    // 是「均色蜡手」tell;远端偏红配 rim 背光 = 廉价次表面散射。
    const fTip = Math.max(0, 1 - Math.abs(p.x - len) / (len * 0.55));
    const fRoot = Math.max(0, 1 - Math.abs(p.x) / (len * 0.5));
    const f = Math.min(1, fTip * 1.35 + fRoot * 0.5);
    c.setRGB(1, 1 - 0.09 * f, 1 - 0.14 * f);
  };
}

/**
 * 扁椭圆截面的锥形指骨:沿 +x 从 rBase(根端)收到 rTip(尖端),两端圆帽。
 * 截面在掌背向(局部 z)压扁 flattenZ —— 真手指截面是扁椭圆而非正圆管,这一步
 * 是去「香肠感」的关键。相邻段在关节处让 rBase 略大于上一段 rTip → 指节轻微
 * 隆起、蒙皮连续(消除等粗圆管 + 雪人串珠两种假手 tell)。
 * lathe 绕 Y 生成后转到 X 轴,非等比缩放后重算法线保证光照正确。
 */
function taperedBoneAlongX(rBase: number, rTip: number, len: number, flattenZ: number, padBulge = 0): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const CAP = 6;
  // Vector2(radius, axisPos):根端半球(x 从 −rBase 到 0,略探进上一节接缝)
  for (let i = 0; i <= CAP; i++) {
    const a = -Math.PI / 2 + (Math.PI / 2) * (i / CAP);
    pts.push(new THREE.Vector2(rBase * Math.cos(a), rBase * Math.sin(a)));
  }
  // 末节指腹微鼓:尖端半球前插两个 profile 点,轮廓先微升再收 —— 指尖是
  // 带肉垫的扁圆,不是直线收尖的锥。
  if (padBulge > 0) {
    pts.push(new THREE.Vector2((rBase + rTip) / 2 * 1.02, len * 0.42));
    pts.push(new THREE.Vector2(rTip * (1 + padBulge), len * 0.74));
  }
  // 尖端半球(x 从 len 到 len+rTip);lathe 在 profile 点间线性连出骨干。
  for (let i = 0; i <= CAP; i++) {
    const a = (Math.PI / 2) * (i / CAP);
    pts.push(new THREE.Vector2(rTip * Math.cos(a), len + rTip * Math.sin(a)));
  }
  const geo = new THREE.LatheGeometry(pts, 24);
  geo.rotateZ(-Math.PI / 2); // lathe 轴 Y → 手指轴 X
  geo.scale(1, 1, flattenZ); // 掌背向压扁成椭圆截面
  geo.computeVertexNormals();
  paintVerts(geo, boneTint(len));
  return geo;
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
function addNail(tipJoint: THREE.Group, segLen: number, r: number, flattenZ: number, nailMat: THREE.Material, meshes: THREE.Mesh[]): void {
  const nail = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), nailMat);
  // 屋瓦形薄片:沿指长(x)拉长、宽占指宽 ~80%(y)、很薄(z,0.2r)——
  // 厚了会鼓成半球顶,配高光成「乒乓球贴片」(评审 #7);大半沉进背侧表面
  // (z≈−r·flatten·0.95),只露一层弧面。前缘几乎不翘(0.08),别探出指尖轮廓。
  nail.scale.set(segLen * 0.4, r * 0.78, r * 0.2);
  nail.position.set(segLen * 0.55, 0, -r * flattenZ * 0.95);
  nail.rotation.y = 0.08;
  nail.raycast = noRaycast;
  tipJoint.add(nail);
  meshes.push(nail);
}

function buildFinger(
  hand: THREE.Group,
  side: 1 | -1,
  dims: { segs: [number, number, number]; r: number; y: number; rz: number; rootX?: number; roll?: number },
  skinMat: THREE.Material,
  nailMat: THREE.Material,
  meshes: THREE.Mesh[],
): FingerJoints {
  const [l1, l2, l3] = dims.segs.map((v) => v * U) as [number, number, number];
  const root = new THREE.Group();
  // 掌指关节弓形:rootX 让各指根前后错落(中指最前,食/无名后缩,小指最后),
  // 指根连线成弓而非直线(直排是最典型的假手 tell)。
  root.position.set((46 + (dims.rootX ?? 0)) * U, dims.y * U * side, dims.rz * U);
  hand.add(root);
  const rM = dims.r * U;
  const rad = (i: number): [number, number] => [SEG_RADII[i][0] * rM, SEG_RADII[i][1] * rM];
  const [b1, t1] = rad(0);
  const [b2, t2] = rad(1);
  const [b3, t3] = rad(2);
  // root 组本身是 MCP 关节;段网格挂它下面,mid/tip 链式挂接(挂点位置由
  // buildSegment 设定,勿在外面再挪 —— 见其头注的错位坑)。
  const seg1End = buildSegment(root, l1, b1, t1, CROSS_FLATTEN, b2, skinMat, meshes);
  const seg2End = buildSegment(seg1End, l2, b2, t2, CROSS_FLATTEN, b3, skinMat, meshes);
  // 末节锥形骨挂 DIP 关节,带指腹微鼓,尖端圆帽即指尖。
  const tipMesh = new THREE.Mesh(taperedBoneAlongX(b3, t3, l3, CROSS_FLATTEN, TIP_PAD_BULGE), skinMat);
  tipMesh.raycast = noRaycast;
  seg2End.add(tipMesh);
  meshes.push(tipMesh);
  addNail(seg2End, l3, b3, CROSS_FLATTEN, nailMat, meshes);
  // 指轴微滚转烘进 rootBase(rig 摆姿态时叠加),绕 x 镜像反号 ×side。
  const rootBase = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (dims.roll ?? 0) * side);
  return { root, mid: seg1End, tip: seg2End, segLens: [l1, l2, l3], rootBase };
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
  rBase: number,
  rTip: number,
  flatten: number,
  nextRBase: number,
  mat: THREE.Material,
  meshes: THREE.Mesh[],
): THREE.Group {
  // 锥形骨跨 [0,len],x=0 即本关节;网格挂 parent 自身系(勿挂返回的下一关节组)。
  const mesh = new THREE.Mesh(taperedBoneAlongX(rBase, rTip, len, flatten), mat);
  mesh.raycast = noRaycast;
  parent.add(mesh);
  meshes.push(mesh);
  const joint = new THREE.Group();
  joint.position.x = len;
  parent.add(joint);
  // 关节填缝球:两节骨的端帽同心于关节点,但各自 z 压扁在自己的局部系 ——
  // 大弯(~1rad)时压扁轴错开,外侧现台阶环(评审 #6)。填一颗略圆的球
  // (flatten 取中)盖住错位楔,直伸时藏在端帽相交区内不可见,背侧微凸恰是
  // 关节鼓包。
  const filler = new THREE.Mesh(paintVerts(new THREE.SphereGeometry(nextRBase * 0.95, 18, 14)), mat);
  filler.scale.z = Math.min(1, flatten + 0.1);
  filler.raycast = noRaycast;
  joint.add(filler);
  meshes.push(filler);
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

  const rM = THUMB_DIMS.r * U;
  const rad = (i: number): [number, number] => [THUMB_RADII[i][0] * rM, THUMB_RADII[i][1] * rM];
  const [b1, t1] = rad(0);
  const [b2, t2] = rad(1);
  const [b3, t3] = rad(2);
  const seg1End = buildSegment(root, l1, b1, t1, THUMB_FLATTEN, b2, skinMat, meshes);
  const seg2End = buildSegment(seg1End, l2, b2, t2, THUMB_FLATTEN, b3, skinMat, meshes);
  const tipMesh = new THREE.Mesh(taperedBoneAlongX(b3, t3, l3, THUMB_FLATTEN, TIP_PAD_BULGE), skinMat);
  tipMesh.raycast = noRaycast;
  seg2End.add(tipMesh);
  meshes.push(tipMesh);
  addNail(seg2End, l3, b3, THUMB_FLATTEN, nailMat, meshes);
  return { root, mid: seg1End, tip: seg2End, segLens: [l1, l2, l3], rootBase: base };
}

/** 掌部静态件:单件掌体网格(buildPalmMesh)+ 大/小鱼际肉垫 + MCP 背侧骨点 +
 *  指蹼 + 腕段。加大原则(2026-07-04「手掌太小」报障):指根挂点(x≈46)与
 *  指尖接触点都不能动,掌体只朝腕侧(-x)加长、y/z 向加厚;掌心侧顶点必须留
 *  在 cube 面之内(local z 上限 = home pos.x − 96;掌心与面之间刻意留空腔)。 */
function buildPalm(
  hand: THREE.Group,
  side: 1 | -1,
  skinMat: THREE.Material,
  meshes: THREE.Mesh[],
): void {
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0): void => {
    const m = new THREE.Mesh(paintVerts(geo), mat);
    m.position.set(x * U, y * U * side, z * U);
    m.scale.set(sx, sy, sz);
    // 绕 x 的旋转在 y 镜像下反号(M_y·Rx(θ)·M_y = Rx(−θ))
    m.rotation.x = rx * side;
    m.raycast = noRaycast;
    hand.add(m);
    meshes.push(m);
  };

  // 主掌体:单件光滑网格,楔形(指端宽腕端窄)+ 真横弓(掌心中央浅槽、两缘高)
  // + 腕厚指薄 + 掌亮背深的顶点色 —— 全在 buildPalmMesh 顶点循环里。
  const body = new THREE.Mesh(buildPalmMesh(side), skinMat);
  body.raycast = noRaycast;
  hand.add(body);
  meshes.push(body);
  // 大鱼际(拇指根肉垫):沿拇指基座向腕侧拉长加大,让拇指近节前半「从肉里
  // 长出来」而非焊在掌角(评审 #1③)。y 别超掌缘太多(独立球 tell)。
  add(new THREE.SphereGeometry(22 * U, 20, 16), skinMat, -24, -23, 10, 1.6, 0.78, 0.62);
  // 小鱼际(掌根另一侧肉垫,本模型无拇指的 +y 缘):低平长条(评审 #3)。
  add(new THREE.SphereGeometry(20 * U, 20, 16), skinMat, -24, 22, 8, 1.5, 0.55, 0.5);
  // 掌指关节(MCP)背侧骨点:握拳时手背最显眼的解剖标志,缺了整只手读成
  // 充气手套(评审 #5)。挂掌体(静态),指大弯时指根自然「顶」在骨点前方。
  for (const f of ["index", "middle", "ring", "pinky"] as const) {
    const d = FINGER_DIMS[f];
    add(new THREE.SphereGeometry(d.r * 0.8 * U, 18, 14), skinMat, 46 + d.rootX + 2, d.y, d.rz - 13, 1.1, 0.9, 0.55);
  }
  // 指蹼:相邻指根之间的低软蹼 —— 分叉止于蹼而非切到掌根。沿指长拉长(x)、
  // 压浅(z)沉进掌体表面,抹平不成独立球(评审 #4)。
  const webOrder = ["index", "middle", "ring", "pinky"] as const;
  for (let i = 0; i < 3; i++) {
    const a = FINGER_DIMS[webOrder[i]];
    const b = FINGER_DIMS[webOrder[i + 1]];
    const mx = (46 + a.rootX + 46 + b.rootX) / 2 - 2;
    const my = (a.y + b.y) / 2;
    const mz = (a.rz + b.rz) / 2 + 7;
    const half = Math.abs(a.y - b.y) / 2;
    const web = new THREE.Mesh(paintVerts(new THREE.SphereGeometry(1, 16, 12)), skinMat);
    web.position.set(mx * U, my * U * side, mz * U);
    web.scale.set(13 * U, half * 0.82 * U, 3 * U);
    web.raycast = noRaycast;
    hand.add(web);
    meshes.push(web);
  }
  // 腕(短段,随手转)。前臂是 rig 独立件,每帧从固定肘锚 IK 指向手腕。
  // z 压扁到掌厚以内,别在手背再冒一个球帽。
  add(new THREE.CapsuleGeometry(27 * U, 42 * U, 8, 20).rotateZ(-Math.PI / 2), skinMat, -76, -1, 0, 1, 1, 0.72);
}

/**
 * 掌体主块几何:把高分辨率球逐顶点形变成「楔形 + 横弓」的单一光滑网格。
 * 指端(+x)宽、腕端(−x)窄 → 梯形楔;厚度腕端厚指端薄;手背(−z)拱、
 * 掌面(+z)中央浅槽两缘高(真横弓,不是凸气球 —— 评审 #3);顶点色掌侧
 * 偏亮暖、背侧偏深 —— 单件网格,无叠球拼缝。
 */
function buildPalmMesh(side: 1 | -1): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 48, 32);
  const pos = geo.getAttribute("position");
  const HALF_LEN = 56 * U; // 腕—指方向半长
  const CX = -10 * U; // 掌心中心 x(偏腕侧)
  const KNUCKLE_HW = 50 * U; // 指端半宽
  const WRIST_HW = 30 * U; // 腕端半宽
  const HALF_THICK = 19 * U; // 半厚(z)
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = (v.x + 1) / 2; // 0 腕 .. 1 指
    const tw = t * t * (3 - 2 * t); // smoothstep 楔形收宽
    const hw = WRIST_HW + (KNUCKLE_HW - WRIST_HW) * tw;
    const px = CX + v.x * HALF_LEN;
    const py = v.y * hw * side;
    // 厚度 = 半厚 × 楔(腕厚指薄)× 前后不对称:背侧鼓(1.08);掌侧中央
    // 浅槽 —— 两缘 0.84、y=0 处 0.69,横截面掌面呈浅凹(横弓)。
    const wedge = 1.06 - 0.18 * t;
    const zf = v.z < 0 ? 1.08 : 0.84 - 0.15 * (1 - v.y * v.y);
    const pz = v.z * HALF_THICK * zf * wedge;
    pos.setXYZ(i, px, py, pz);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  // 顶点色:掌侧亮暖、背侧深(真手掌心偏粉亮、手背偏深黄)。
  paintVerts(geo, (p, c) => {
    const f = Math.min(1, Math.max(0, p.z / (12 * U) + 0.5)); // 0 背 .. 1 掌
    c.setRGB(0.95 + 0.05 * f, 0.93 + 0.06 * f, 0.915 + 0.055 * f);
  });
  return geo;
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
  // 锥形前臂:腕端细(27U,与腕段同径)、肘端粗(34U),z 微扁(0.8)与腕的
  // 0.72 扁截面接顺 —— 正圆等粗管接扁腕会现一圈错位缝(评审 #10)。
  // taperedBoneAlongX 的 base 端(x=0)朝 +x,绕 z 转 π 后指向 −x 肘端。
  const arm = new THREE.Mesh(taperedBoneAlongX(27 * U, 34 * U, LEN, 0.8), skinMat);
  arm.rotation.z = Math.PI;
  arm.position.x = 11 * U; // 腕端圆帽探进腕里 ~38U,接缝圆润
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
