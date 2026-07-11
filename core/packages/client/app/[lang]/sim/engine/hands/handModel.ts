/**
 * /sim 手部共享层 — 类型契约 + 缩放常量 + 程序化皮肤细节纹理 + 前臂件。
 * 手本体已换 GLTF 蒙皮网格(handModelGltf.ts,WebXR generic-hand);本文件
 * 保留 rig 与加载层共用的接口(HandModel/FingerJoints)、比例锚点
 * (HAND_SCALE/WRIST_LOCAL)与仍是程序几何的前臂(画面里只露一小段,
 * 不值得上资产)。
 *
 * 局部坐标系(单手作者系,side=+1 时):
 *   +x = 腕 → 指尖方向
 *   +z = 掌心朝向(握持面法向)
 *   +y = 食指侧(side=-1 时食指在 -y)
 * 手指弯曲(curl)= 关节 rotation.y 负向(指尖朝 +z 掌心卷,两种 side 同向);
 * 张开(splay)= 指根 rotation.z(×side 由 rig 处理)。
 */
import * as THREE from "three";
import { SIZE } from "../define";

export type FingerName = "thumb" | "index" | "middle" | "ring" | "pinky";

/** 一根手指的三段关节链。root=掌指关节(拇指为腕掌基),mid/tip=远端两关节。
 *  rig 每帧写各关节 rotation 摆姿态;几何/骨骼由加载层挂进来。 */
export interface FingerJoints {
  root: THREE.Group;
  mid: THREE.Group;
  tip: THREE.Group;
  /** 三段骨长(关节到关节),供 rig 需要时估算指尖位置。 */
  segLens: [number, number, number];
  /** 指根基座朝向(四指≈绑定姿态指向,拇指=对掌位)。rig 摆姿态时必须
   *  `root.quaternion = rootBase ∘ R(curl/splay)` 叠加,禁止直接写
   *  rotation(会抹掉拇指基座 —— v1 实测踩过)。 */
  rootBase: THREE.Quaternion;
  /** 掌骨代理关节(r11 全关节解锁;四指专有,拇指的掌骨 = root 本身)。
   *  rest 局部旋转 = identity(手系对齐),root 是它的子节点 —— rig 写
   *  `meta.quaternion = metaBase ∘ R(euler) ∘ metaBase⁻¹`(手系共轭,euler
   *  在掌骨作者系解读,rest 恒等 → 缺省姿态与旧「焊死」行为逐位一致)。 */
  meta?: THREE.Group;
  /** 掌骨作者系基(+x = 掌骨→指根方向,+z 掌心向),供上式共轭。 */
  metaBase?: THREE.Quaternion;
}

export interface HandModel {
  group: THREE.Group;
  side: 1 | -1;
  fingers: Record<FingerName, FingerJoints>;
  /** 全部蒙皮网格(肤 + 袖口),供 rig 统一开层/透明度/禁 raycast。 */
  meshes: THREE.Mesh[];
  /** 加载层自建材质(立体甲片等):rig 侧负责随手 fade / dispose。 */
  extraMats?: THREE.Material[];
  /** 立体甲片 mesh(设置「指甲」开关走 visible 显隐,不拆几何)。 */
  nailMeshes?: THREE.Mesh[];
}

/** 整手相对魔方的比例(2026-07-05 用户定真实比例:食指/中指/无名指宽 ≈0.9 个
 *  棱块 = 0.9·SIZE,即 2r̄·scale/64 ≈ 0.9 → 2.2;真人手对 57mm 三阶就是这么大)。
 *  改它必须同步:① handPoses 重标定(指根/指长全变,curl 要重解);② world/
 *  backView 手部 near/far 包络余量;③ handsRig 肘锚(×HAND_SCALE)。 */
export const HAND_SCALE = 2.2;

/** 设计基准:常量按 SIZE=64(3x3 棱长 192)标定,U 做整体缩放钩子。 */
const U = (SIZE / 64) * HAND_SCALE;

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

/** 锥形骨两端(关节处)微红 — 血色。骨轴 x 跨 [0,len],两关节在 x≈0 与 x≈len。 */
function boneTint(len: number): (p: THREE.Vector3, out: THREE.Color) => void {
  return (p, c) => {
    // 血色向远端集中 —— 均匀的关节环带是「均色蜡手」tell;远端偏红配 rim
    // 背光 = 廉价次表面散射。
    const fTip = Math.max(0, 1 - Math.abs(p.x - len) / (len * 0.55));
    const fRoot = Math.max(0, 1 - Math.abs(p.x) / (len * 0.5));
    const f = Math.min(1, fTip * 1.35 + fRoot * 0.5);
    c.setRGB(1, 1 - 0.09 * f, 1 - 0.14 * f);
  };
}

/**
 * 扁椭圆截面的锥形骨:沿 +x 从 rBase(根端)收到 rTip(尖端),两端圆帽。
 * 截面在掌背向(局部 z)压扁 flattenZ。lathe 绕 Y 生成后转到 X 轴,非等比
 * 缩放后重算法线保证光照正确。现仅前臂使用(手指几何已随 GLTF 手模退役)。
 */
function taperedBoneAlongX(rBase: number, rTip: number, len: number, flattenZ: number, padBulge = 0): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const CAP = 6;
  // Vector2(radius, axisPos):根端半球(x 从 −rBase 到 0,略探进上一节接缝)
  for (let i = 0; i <= CAP; i++) {
    const a = -Math.PI / 2 + (Math.PI / 2) * (i / CAP);
    pts.push(new THREE.Vector2(rBase * Math.cos(a), rBase * Math.sin(a)));
  }
  // 指腹微鼓:尖端半球前插两个 profile 点,轮廓先微升再收。
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
  geo.rotateZ(-Math.PI / 2); // lathe 轴 Y → 骨轴 X
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

/** 前臂与手腕的接驳点(手局部坐标)。rig 每帧把它变换到世界系,作为前臂 IK 的
 *  手端端点;GLTF 加载层把腕骨对齐到这里。 */
export const WRIST_LOCAL = new THREE.Vector3(-84 * U, -1 * U, -3 * U);

/** 独立前臂件:锥形骨 + 袖口,+x 端点在原点(= 贴腕处)。rig 每帧
 *  `position=腕点, quaternion=setFromUnitVectors(+x, 腕点-肘锚)`。 */
export function buildForearm(
  skinMat: THREE.Material,
  cuffMat: THREE.Material,
): { group: THREE.Group; meshes: THREE.Mesh[] } {
  const group = new THREE.Group();
  const meshes: THREE.Mesh[] = [];
  const LEN = 152 * U;
  // 锥形前臂:截面对齐 GLB 手模自带的前臂残端(实测:残端从腕点伸向肘 ~29U
  // 处开口斜切,断面 y 半宽 ~34U、z 半高 ~22-24U,中心 y≈+0.5 z≈-2 手系)。
  // 旧值 27U 比残端细 7U:残端边缘外挑一圈台阶,开口斜切面角度一偏直接看穿
  // 内腔(「手和手臂断了」)。腕端 34.5U/扁 0.7 略盖过开口,残端整段埋进前臂,
  // 接缝只剩同肤质浅折。taperedBoneAlongX base 端(x=0)朝 +x,绕 z 转 π 后
  // 指向 −x 肘端。
  const arm = new THREE.Mesh(taperedBoneAlongX(34.5 * U, 38 * U, LEN, 0.7), skinMat);
  arm.rotation.z = Math.PI;
  // 腕端圆帽探进腕里 ~38U 填满残端内腔;y/z 微移对中残端断面中心。
  arm.position.set(4 * U, 1.5 * U, 1 * U);
  arm.raycast = noRaycast;
  group.add(arm);
  meshes.push(arm);
  // 袖口:椭圆截面贴臂(圆环套扁臂会在 z 向留 ~15U 空隙,仰视看穿悬空环),
  // 加长盖过臂端圆帽(旧 26U 短环,肘端裸皮圆帽从袖里伸出来一截)。腕侧开口
  // 收到几乎贴臂(臂该处 y37.3/z26.1,开口 38.5/27):留缝会看进袖筒内腔,
  // 顺臂轴视角读成「靶心」环。
  const cuffGeo = new THREE.CylinderGeometry(38.5 * U, 44 * U, 64 * U, 22)
    .rotateZ(-Math.PI / 2)
    .scale(1, 1, 0.7);
  const cuff = new THREE.Mesh(cuffGeo, cuffMat);
  // 覆盖 [-188U,-124U],臂尖(≈-186U)埋进袖内;y/z 随臂同偏对中,否则贴臂
  // 开口会被偏心的臂戳穿。
  cuff.position.set(-LEN - 4 * U, 1.5 * U, 1 * U);
  cuff.raycast = noRaycast;
  group.add(cuff);
  meshes.push(cuff);
  return { group, meshes };
}
