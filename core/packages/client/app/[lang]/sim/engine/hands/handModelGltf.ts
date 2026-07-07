/**
 * /sim 手部模型 — GLTF 蒙皮网格加载层(WebXR generic-hand,W3C License,
 * 见 public/sim/hands/LICENSE.txt)。替代程序化拼件手:真雕刻拓扑 + 骨骼蒙皮,
 * 弯指皮肤连续形变,无拼件接缝。
 *
 * 与 rig 的契约(同 handModel.HandModel):
 *  - fingers[name].root/mid/tip 是「代理关节组」,作者系 = +x 指尖向 / +z 掌心
 *    / 弯曲绕 -y —— rig 的驱动代码零改动。
 *  - GLB 的 25 骨骼原始层级是平铺(WebXR 追踪风格,运行时逐关节写世界变换),
 *    加载时重建为 FK 链:骨骼 attach() 进代理组保持绑定姿态,代理转、骨随动、
 *    蒙皮跟着弯。
 *  - root 代理带 rootBase(绑定姿态朝向,拇指对掌位天然来自资产);mid/tip
 *    代理 rest 局部旋转 = identity(骨链自然弯度留在「位置」偏移里,rig 直写
 *    rotation 不破坏 rest)。
 *
 * 左右手:right.glb / left.glb 是两份真镜像资产,无 scale=-1 手性 hack。
 * 魔方右侧的手 = 解剖学右手(掌贴 R 面、指钩 B 面、拇指压 F 面 —— 人类握法),
 * side 参数只保留给 rig 做 splay 镜像语义。
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SIZE } from "../define";
import { HAND_SCALE, WRIST_LOCAL, type FingerName, type FingerJoints, type HandModel } from "./handModel";

const U = (SIZE / 64) * HAND_SCALE;

/** 拇指弯曲平面 roll(绕拇指根代理 +x,rad):资产绑定姿态的拇指弯曲平面偏
 *  「扫掌面」方向,压不到 F 面 —— 向掌心侧倾斜后 curl 才朝魔方收(2026-07-06
 *  浏览器内多起点坐标下降与 curl 联合解出)。左右手系镜像(y 反),绕 x 的旋转
 *  共轭反号 → ×side。导出给 bakeHandTexture 定拇指甲背方向(甲背 = 滚转后
 *  弯曲平面的 −z,与指腹压面方向相反)。
 *  2026-07-08 用户规格「指甲盖平面 ∥ F 面」:1.524 时 home 甲背·ẑ 仅 0.32
 *  (甲面斜 71°),+0.55 联合重解拇指 curl 后 ≈0.85(dorsal 扫掠圆 ⊥ 根段轴,
 *  与「贴面 2.4U + 肉 |x|≥34.5 + 接触心留在 FR 贴纸内」可行域的交点极限;
 *  再加 roll 接触被换走,oracle 实测)。改此值必须连动 handPoses 拇指 curl 重解。 */
export const THUMB_CURL_PLANE_ROLL = 2.074;

/** WebXR 25 关节命名(https://www.w3.org/TR/webxr-hand-input-1/)。
 *  四指 FK 链 = proximal/intermediate/distal(metacarpal 静止在掌内);
 *  拇指链 = metacarpal/proximal/distal(拇指的可动基节就是掌骨)。
 *  导出给 bakeHandTexture 取骨名(关节皱纹环带 / 指甲落位)。 */
export const JOINT_CHAINS: Record<FingerName, { drive: [string, string, string]; end: string; static?: string }> = {
  thumb: { drive: ["thumb-metacarpal", "thumb-phalanx-proximal", "thumb-phalanx-distal"], end: "thumb-tip" },
  index: { drive: ["index-finger-phalanx-proximal", "index-finger-phalanx-intermediate", "index-finger-phalanx-distal"], end: "index-finger-tip", static: "index-finger-metacarpal" },
  middle: { drive: ["middle-finger-phalanx-proximal", "middle-finger-phalanx-intermediate", "middle-finger-phalanx-distal"], end: "middle-finger-tip", static: "middle-finger-metacarpal" },
  ring: { drive: ["ring-finger-phalanx-proximal", "ring-finger-phalanx-intermediate", "ring-finger-phalanx-distal"], end: "ring-finger-tip", static: "ring-finger-metacarpal" },
  pinky: { drive: ["pinky-finger-phalanx-proximal", "pinky-finger-phalanx-intermediate", "pinky-finger-phalanx-distal"], end: "pinky-finger-tip", static: "pinky-finger-metacarpal" },
};

/** 甲面框架 —— 贴图指甲(bakeHandTexture)与立体甲片(本文件)共用的单一
 *  数学源,禁两处各写一份漂移。axis=末节轴(p3→p4);dorsal=甲背=功能性
 *  指腹方向的反向(rig 弯指把弯曲平面 +z′ 的指腹压向魔方,拇指含
 *  THUMB_CURL_PLANE_ROLL×side 滚转),投影到 ⊥axis;lat=侧向。 */
export function nailFrame(
  p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, p4: THREE.Vector3,
  thumb: boolean, side: 1 | -1,
): { axis: THREE.Vector3; dorsal: THREE.Vector3; lat: THREE.Vector3; len: number } {
  const axis = p4.clone().sub(p3);
  const len = axis.length();
  axis.normalize();
  const xf = p2.clone().sub(p1).normalize();
  const pad = new THREE.Vector3(0, 0, 1).addScaledVector(xf, -xf.z).normalize();
  if (thumb) pad.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(xf, THUMB_CURL_PLANE_ROLL * side));
  const dorsal = pad.clone().negate().addScaledVector(axis, pad.dot(axis)).normalize();
  const lat = new THREE.Vector3().crossVectors(axis, dorsal).normalize();
  return { axis, dorsal, lat, len };
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** 甲片格网行列数。 */
const NAIL_NR = 15, NAIL_NC = 11;

/**
 * 立体甲片薄壳(2026-07-08 用户规格:指甲要有薄薄的厚度、是立体结构):
 * 超椭圆轮廓双层格网(甲面/甲底)+ 周缘侧壁。甲底逐格贴 (轴向,侧向) 二维
 * 皮面高度场(绑定姿态蒙皮顶点高斯 IDW):横竖两向都跟住指背穹顶,侧缘
 * 额外下收进皮(甲沟)、甲根藏进近端甲襞、游离缘微翘露出厚度。
 * 甲片是唯一指甲 —— 贴图画甲已移除(曾三层叠影:壳姿态漂移裂成两团 +
 * 画甲外露读成第三片,2026-07-08 用户抓的)。
 * 纯 BufferGeometry(hands_model 测试在 Node 跑 adaptGltfHand,禁 DOM)。
 */
function buildNailGeometry(args: {
  p3: THREE.Vector3; axis: THREE.Vector3; dorsal: THREE.Vector3; lat: THREE.Vector3;
  len: number;
  /** 甲片半宽(s = 沿末节轴绝对距离)—— 随手指向尖端收锥,等宽甲片前段
   *  侧缘会悬伸出指侧(细白条,踩过)。 */
  halfWAt: (s: number) => number;
  /** 甲域皮面高度场(dorsal 向投影;s 同上,u = 侧向绝对偏移)。 */
  surf: (s: number, u: number) => number;
}): THREE.BufferGeometry {
  const { p3, axis, dorsal, lat, len } = args;
  const T0 = 0.46, T1 = 1.06;   // 末节段分数:真甲只盖末节背侧远端一半;再长
                                // 会顺高度场卷过指尖圆帽垂到指腹(「围兜」,踩过)
  const TH = 0.55 * U;          // 甲片厚度(薄;游离缘侧壁可见即可)
  const LIFT = 0.1 * U;         // 甲底抬离皮面:甲冠稳定高出 ~0.65U。曾用沉皮
                                // (甲面仅 +0.19U),IDW 场误差 ± 姿态漂移一超过
                                // 它,甲面就在皮面上下穿插,渲出大理石白斑(踩过)
  const EDGE_TUCK = 1.6 * U;    // 侧缘果断下收进皮(甲沟;圆柱模型对称下落在
                                // 皮实际更低的一侧会悬空漏缝,埋深要盖过不对称量)
  const BASE_SINK = 1.2 * U;    // 甲根藏进近端甲襞(弯指时根部皮面下沉仍要盖住)
  const FREE_LIFT = 0.25 * U;   // 游离缘微翘(过大 = 翘壳)
  const NR = NAIL_NR, NC = NAIL_NC;
  const tc = (T0 + T1) / 2, th = (T1 - T0) / 2;

  const pos: number[] = [];
  const col: number[] = [];
  const P = new THREE.Vector3();
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i < NR; i++) {
      const q = -0.97 + (1.94 * i) / (NR - 1);
      const sAbs = (tc + th * q) * len;
      const w2 = Math.pow(1 - q * q, 1 / 2.6); // 超椭圆半宽(掩码指数 2.6)
      const free = sstep(0.55, 0.92, q);
      const lun = sstep(-0.55, -0.9, q) * 0.5; // 半月对比调淡(强白斑读成大理石纹)
      for (let j = 0; j < NC; j++) {
        const w = -1 + (2 * j) / (NC - 1);
        const u = w * w2 * args.halfWAt(sAbs);
        const hu = args.surf(sAbs, u) + LIFT
          - BASE_SINK * sstep(-0.55, -0.97, q)
          + FREE_LIFT * sstep(0.55, 0.97, q)
          - EDGE_TUCK * sstep(0.55, 1.0, Math.abs(w));
        // 甲面=甲底+厚度(中央极轻微加厚;穹顶感主要来自甲底跟皮面圆度)
        const h = layer === 0 ? hu + TH * (0.94 + 0.06 * Math.sqrt(Math.max(0, 1 - w * w))) : hu;
        P.copy(p3).addScaledVector(axis, sAbs).addScaledVector(dorsal, h).addScaledVector(lat, u);
        pos.push(P.x, P.y, P.z);
        const shade = layer === 0 ? 1 : 0.9; // 甲底略暗
        col.push(
          Math.min(1, (0.93 + 0.05 * lun + 0.06 * free) * shade),
          Math.min(1, (0.80 + 0.08 * lun + 0.15 * free) * shade),
          Math.min(1, (0.76 + 0.08 * lun + 0.15 * free) * shade),
        );
      }
    }
  }
  const idx: number[] = [];
  const at = (layer: number, i: number, j: number): number => layer * NR * NC + i * NC + j;
  for (let i = 0; i < NR - 1; i++) {
    for (let j = 0; j < NC - 1; j++) {
      const a = at(0, i, j), b = at(0, i + 1, j), c = at(0, i + 1, j + 1), d = at(0, i, j + 1);
      idx.push(a, d, b, b, d, c); // 甲面朝 +dorsal
      const a2 = at(1, i, j), b2 = at(1, i + 1, j), c2 = at(1, i + 1, j + 1), d2 = at(1, i, j + 1);
      idx.push(a2, b2, d2, b2, c2, d2); // 甲底反绕
    }
  }
  // 周缘侧壁(+dorsal 视角逆时针环,外法向 = 边×dorsal)
  const ring: [number, number][] = [];
  for (let j = 0; j < NC - 1; j++) ring.push([0, j]);
  for (let i = 0; i < NR - 1; i++) ring.push([i, NC - 1]);
  for (let j = NC - 1; j > 0; j--) ring.push([NR - 1, j]);
  for (let i = NR - 1; i > 0; i--) ring.push([i, 0]);
  for (let k = 0; k < ring.length; k++) {
    const [i1, j1] = ring[k];
    const [i2, j2] = ring[(k + 1) % ring.length];
    idx.push(at(0, i1, j1), at(1, i1, j1), at(1, i2, j2), at(0, i1, j1), at(1, i2, j2), at(0, i2, j2));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}

/** 目标中指链长(MCP→PIP→DIP→TIP)= 程序化手同值(56+35+24)·U,保证指尖
 *  绕魔方的包络与旧标定同数量级(整体缩放钩子,不追单指等长)。 */
const TARGET_MIDDLE_LEN = 115 * U;

/** 每骨「血色分数」:越远端越红(皮肤薄血管近),同程序化手 boneTint 的
 *  远端加权;顶点色 = Σ 蒙皮权重 × 分数 → 指尖聚血、掌根素净。 */
function boneBloodScore(name: string): number {
  if (/-tip$/.test(name)) return 1.0;
  if (/phalanx-distal/.test(name)) return 0.85;
  if (/phalanx-intermediate/.test(name)) return 0.5;
  if (/thumb-phalanx-proximal/.test(name)) return 0.45;
  if (/phalanx-proximal/.test(name)) return 0.3;
  if (/metacarpal/.test(name)) return 0.08;
  return 0;
}

const noRaycast = (): void => { /* 手不可拾取 — 拖拽/点击穿透到魔方 */ };

let loader: GLTFLoader | null = null;

/**
 * 加载一只 GLTF 手并适配成 HandModel。side=-1 → right.glb(魔方右侧),
 * side=+1 → left.glb。失败向上抛(本地资产,失败即 bug,别静默吞)。
 */
export async function loadGltfHand(side: 1 | -1, skinMat: THREE.Material): Promise<HandModel> {
  loader ??= new GLTFLoader();
  // ?v=:proxy matcher 曾漏掉 .glb 被语言 307 劫持,老 307 会被浏览器缓存粘在
  // 裸 URL 上;带版本参数换缓存键绕开,换资产时顺手 bump。
  const url = side === -1 ? "/sim/hands/right.glb?v=1" : "/sim/hands/left.glb?v=1";
  const gltf = await loader.loadAsync(url);
  return adaptGltfHand(gltf.scene, side, skinMat, url);
}

/** 纯适配步(无 fetch):gltf.scene → HandModel。拆出来供测试用 fs 读 GLB +
 *  GLTFLoader.parse 直喂(Node 环境无相对 URL fetch)。 */
export function adaptGltfHand(src: THREE.Object3D, side: 1 | -1, skinMat: THREE.Material, label = "hand.glb"): HandModel {
  src.updateMatrixWorld(true);

  // ---- 收集骨骼与蒙皮网格(gltf.scene 世界系 = 资产系) ----
  const bones = new Map<string, THREE.Bone>();
  let skinned: THREE.SkinnedMesh | null = null;
  src.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones.set(o.name, o as THREE.Bone);
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = o as THREE.SkinnedMesh;
  });
  if (!skinned) throw new Error(`hand glb ${label}: no skinned mesh`);
  const mesh: THREE.SkinnedMesh = skinned;
  const bone = (name: string): THREE.Bone => {
    const b = bones.get(name);
    if (!b) throw new Error(`hand glb ${label}: missing bone ${name}`);
    return b;
  };
  const bindPos = (name: string): THREE.Vector3 => bone(name).getWorldPosition(new THREE.Vector3());

  // ---- 手系对齐:腕→中指根 = +x,指根横排(食指侧)= +y,掌心 = +z ----
  const W = bindPos("wrist");
  const mcpMid = bindPos("middle-finger-phalanx-proximal");
  const mcpIdx = bindPos("index-finger-phalanx-proximal");
  const mcpPky = bindPos("pinky-finger-phalanx-proximal");
  const xh = mcpMid.clone().sub(W).normalize();
  // 作者系 +y = 食指侧(side=+1);side=-1 几何(魔方右侧手)食指在 -y。
  const row = mcpIdx.clone().sub(mcpPky).multiplyScalar(side === 1 ? 1 : -1);
  const yh = row.sub(xh.clone().multiplyScalar(row.dot(xh))).normalize();
  const zh = new THREE.Vector3().crossVectors(xh, yh); // 掌心向(实拍校验,错了翻 row 号)
  const basis = new THREE.Matrix4().makeBasis(xh, yh, zh);
  const align = new THREE.Quaternion().setFromRotationMatrix(basis).invert(); // 资产系 → 手系

  const midLen =
    bindPos("middle-finger-phalanx-intermediate").distanceTo(mcpMid) +
    bindPos("middle-finger-phalanx-distal").distanceTo(bindPos("middle-finger-phalanx-intermediate")) +
    bindPos("middle-finger-tip").distanceTo(bindPos("middle-finger-phalanx-distal"));
  const s = TARGET_MIDDLE_LEN / midLen;

  // 绑定位置先全量快照(资产系)—— 下面给 inner 施加对齐变换后,骨骼世界坐标
  // 就变成手系了,再读 bindPos 会被 toHand 双重变换(踩过:代理关节支点全错,
  // 弯指绕垃圾支点转出蒙皮拉丝)。
  const bindAsset = new Map<string, THREE.Vector3>();
  for (const name of bones.keys()) bindAsset.set(name, bindPos(name));
  const bindOf = (name: string): THREE.Vector3 => {
    const p = bindAsset.get(name);
    if (!p) throw new Error(`hand glb ${label}: missing bind pos ${name}`);
    return p;
  };

  /** 资产系绑定点 → 手系(hand group 局部):腕落 WRIST_LOCAL,等比 s。 */
  const toHand = (p: THREE.Vector3): THREE.Vector3 =>
    p.clone().sub(W).applyQuaternion(align).multiplyScalar(s).add(WRIST_LOCAL);

  // ---- 组装:group ← inner(对齐变换,载 gltf.scene) + 代理关节链 ----
  const group = new THREE.Group();
  const inner = new THREE.Group();
  inner.quaternion.copy(align);
  inner.scale.setScalar(s);
  // inner 变换 p ↦ align·(s·p)+pos,要 W ↦ WRIST_LOCAL:
  inner.position.copy(WRIST_LOCAL).sub(W.clone().applyQuaternion(align).multiplyScalar(s));
  inner.add(src);
  group.add(inner);
  group.updateMatrixWorld(true);

  // 腕骨 + 四指掌骨:静止件,直接挂 group(保世界变换)。
  group.attach(bone("wrist"));
  for (const chain of Object.values(JOINT_CHAINS)) {
    if (chain.static) group.attach(bone(chain.static));
  }

  const fingers = {} as Record<FingerName, FingerJoints>;
  for (const name of Object.keys(JOINT_CHAINS) as FingerName[]) {
    const chain = JOINT_CHAINS[name];
    const [j1, j2, j3] = chain.drive;
    const p1 = toHand(bindOf(j1));
    const p2 = toHand(bindOf(j2));
    const p3 = toHand(bindOf(j3));
    const p4 = toHand(bindOf(chain.end));

    // 该指作者系:+x = 根段方向,+z = 掌心向(手系 z 投影到 ⊥x̂f)。指链自然
    // 弯度几乎全在弯曲平面内 → 三关节共用一个 ŷ(弯曲轴),弯度留在位置偏移。
    const xf = p2.clone().sub(p1).normalize();
    const zf = new THREE.Vector3(0, 0, 1).sub(xf.clone().multiplyScalar(xf.z)).normalize();
    const yf = new THREE.Vector3().crossVectors(zf, xf);
    const rootBase = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xf, yf, zf));
    if (name === "thumb") {
      rootBase.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THUMB_CURL_PLANE_ROLL * side));
    }
    const invBase = rootBase.clone().invert();

    const root = new THREE.Group();
    root.position.copy(p1);
    root.quaternion.copy(rootBase);
    const mid = new THREE.Group();
    mid.position.copy(p2.clone().sub(p1).applyQuaternion(invBase)); // ≈ (len1,0,0)
    const tip = new THREE.Group();
    tip.position.copy(p3.clone().sub(p2).applyQuaternion(invBase));
    group.add(root);
    root.add(mid);
    mid.add(tip);
    group.updateMatrixWorld(true);

    // 骨骼入链:近节→root,中节→mid,末节+指尖端点骨→tip(端点随末节转)。
    root.attach(bone(j1));
    mid.attach(bone(j2));
    tip.attach(bone(j3));
    tip.attach(bone(chain.end));

    fingers[name] = {
      root,
      mid,
      tip,
      segLens: [p1.distanceTo(p2), p2.distanceTo(p3), p3.distanceTo(p4)],
      rootBase,
    };
  }

  // ---- 立体甲片:每指一块薄壳刚挂 tip 代理(随末节弯曲)。甲底贴 (轴向,
  //      侧向) 二维高斯 IDW 皮面高度场 + 甲冠抬出皮面(LIFT)—— 旧版 1D 轴向
  //      max 桶轮廓 + SINK 沉皮把甲冠压到皮下,只剩甲根坡道和游离缘两个「岛」
  //      露出,视觉裂成两团「假甲」(2026-07-08 用户抓的三层叠影之二)。
  //      几何生成在 hand 系再转 tip 局部。材质经 extraMats 交 rig 统一
  //      fade / dispose。 ----
  mesh.updateMatrixWorld(true);
  const nailMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true, // 甲床粉 → 半月 → 游离缘白的纵向渐变烘在顶点色
    roughness: 0.32,
    metalness: 0,
    clearcoat: 0.12, // 高清漆会读成「乒乓球贴片」,压低
    clearcoatRoughness: 0.5,
  });
  const nailMeshes: THREE.Mesh[] = [];
  {
    const posA = mesh.geometry.getAttribute("position");
    const skinIndexA = mesh.geometry.getAttribute("skinIndex");
    const skinWeightA = mesh.geometry.getAttribute("skinWeight");
    const boneNames = mesh.skeleton.bones.map((b) => b.name);
    const dom = new Array<string>(posA.count);
    for (let i = 0; i < posA.count; i++) {
      let best = 0, bw = -1;
      for (let k = 0; k < 4; k++) {
        const w = skinWeightA.getComponent(i, k);
        if (w > bw) { bw = w; best = skinIndexA.getComponent(i, k); }
      }
      dom[i] = boneNames[best] ?? "";
    }
    const v = new THREE.Vector3();
    const rel = new THREE.Vector3();
    for (const name of Object.keys(JOINT_CHAINS) as FingerName[]) {
      const chain = JOINT_CHAINS[name];
      const q1 = toHand(bindOf(chain.drive[0]));
      const q2 = toHand(bindOf(chain.drive[1]));
      const q3 = toHand(bindOf(chain.drive[2]));
      const q4 = toHand(bindOf(chain.end));
      const nf = nailFrame(q1, q2, q3, q4, name === "thumb", side);
      // 候选皮肤顶点:末节/端点骨主导(高度场采样 + 骨权重抄袭都从这里取)
      const sub: number[] = [];
      const subPos: THREE.Vector3[] = [];
      for (let i = 0; i < posA.count; i++) {
        if (dom[i] !== chain.drive[2] && dom[i] !== chain.end) continue;
        sub.push(i);
        subPos.push(v.fromBufferAttribute(posA, i).applyMatrix4(mesh.matrixWorld).clone());
      }
      // 末节平均圆柱半径(同 bakeHandTexture.boneRadius 公式)
      let rSum = 0, rN = 0;
      for (let k = 0; k < sub.length; k++) {
        if (dom[sub[k]] !== chain.drive[2]) continue;
        rel.copy(subPos[k]).sub(q3);
        const sa = THREE.MathUtils.clamp(rel.dot(nf.axis), 0, nf.len);
        rSum += Math.sqrt(Math.max(0, rel.lengthSq() - sa * sa));
        rN++;
      }
      const rDist = rN > 0 ? rSum / rN : 7 * U;
      // 背侧皮面 (s,u) 二维高度样本:h>-0.5U 收进赤道附近侧壁点(编码横向
      // 圆度),指腹剔除。旧 1D 轴向 max 桶 + 抛物线宽度近似横竖都跟不住
      // 真实穹顶,甲片中段埋皮两头浮出(踩过)。
      const smp: { s: number; u: number; h: number }[] = [];
      for (let k = 0; k < sub.length; k++) {
        rel.copy(subPos[k]).sub(q3);
        const sa = rel.dot(nf.axis);
        const h = rel.dot(nf.dorsal);
        const uu = rel.dot(nf.lat);
        if (h < -0.5 * U || Math.abs(uu) > rDist * 1.4) continue;
        if (sa < -3 * U || sa > nf.len + 6 * U) continue;
        smp.push({ s: sa, u: uu, h });
      }
      // 软最大场:样本再按 e^{κh} 加权 —— 纯均值会被侧壁低样本拉低、系统性
      // 低估波峰,粗蒙皮的真实起伏(±1U)从甲片中间戳穿成碎斑(踩过)。
      const sigS = 2.2 * U, sigU = 1.6 * U, kappa = 1.5 / U;
      const surf = (sq: number, uq: number): number => {
        let wSum = 0, hSum = 0, nearest = rDist, nd = Infinity;
        for (const p of smp) {
          const ds = (p.s - sq) / sigS, du = (p.u - uq) / sigU;
          const d2 = ds * ds + du * du;
          if (d2 < nd) { nd = d2; nearest = p.h; }
          const w = Math.exp(-d2 + kappa * p.h);
          wSum += w; hSum += w * p.h;
        }
        return wSum > 1e-9 ? hSum / wSum : nearest;
      };
      // 甲片高度模型 = 轴向脊线 × 横向圆柱对称下落:直接用 surf(s,u) 会让
      // 甲片跟着局部左右不对称倾斜(一缘翘出一缘埋皮,看着「歪甲」,踩过);
      // 脊线取 ±0.5·rDist 内 5 个横向探针的最高值。宽度/曲率半径随脊高向
      // 尖端收锥(脊高 ≈ 局部背侧半径)。
      const crest = (sq: number): number => {
        let m = -Infinity;
        for (let k = -2; k <= 2; k++) m = Math.max(m, surf(sq, k * 0.25 * rDist));
        return m;
      };
      // 锥度下限 0.8·rDist:全跟 crest 会在指尖把甲片收成「方糖」(踩过)
      const rLoc = (sq: number): number => Math.max(0.8 * rDist, Math.min(crest(sq), rDist));
      const nailField = (sq: number, uq: number): number => {
        const r = rLoc(sq);
        const uc = Math.min(Math.abs(uq), r);
        return crest(sq) - (r - Math.sqrt(Math.max(0, r * r - uc * uc)));
      };
      const halfWAt = (sq: number): number => 0.62 * rLoc(sq);
      const geo = buildNailGeometry({ p3: q3, axis: nf.axis, dorsal: nf.dorsal, lat: nf.lat, len: nf.len, halfWAt, surf: nailField });
      // 刚挂 tip 代理:甲片区域(t≥0.42)皮肤 ≥97% 由末节/端点骨主导(与
      // tip 代理刚体同动),姿态漂移 ≤~1U,由 BASE_SINK/EDGE_TUCK 埋皮余量
      // 吸收。试过抄皮肤骨权重做成蒙皮甲片 —— 弯指时格网被相邻权重差撕出
      // 碎斑,不可行(2026-07-08)。
      const fj = fingers[name];
      const tipInv = new THREE.Matrix4().copy(fj.tip.matrixWorld).invert();
      geo.applyMatrix4(tipInv);
      geo.computeVertexNormals();
      const nm = new THREE.Mesh(geo, nailMat);
      nm.raycast = noRaycast;
      nm.castShadow = nm.receiveShadow = false;
      nm.userData.nail = { finger: name };
      fj.tip.add(nm);
      nailMeshes.push(nm);
    }
  }

  // ---- 顶点血色烘焙(skinMat vertexColors:true 契约:所有肤色网格必须带
  //      color 属性)+ 掌亮背深:按蒙皮权重聚血到远端,按手系 z 分掌背。 ----
  bakeVertexTint(mesh);

  mesh.frustumCulled = false; // 骨骼动到包围盒外仍要渲
  mesh.raycast = noRaycast;
  mesh.material = skinMat;
  mesh.castShadow = mesh.receiveShadow = false;

  return { group, side, fingers, meshes: [mesh as THREE.Mesh, ...nailMeshes], extraMats: [nailMat] };
}

function bakeVertexTint(mesh: THREE.SkinnedMesh): void {
  const geo = mesh.geometry;
  const pos = geo.getAttribute("position");
  const skinIndex = geo.getAttribute("skinIndex");
  const skinWeight = geo.getAttribute("skinWeight");
  const jointScores = mesh.skeleton.bones.map((b) => boneBloodScore(b.name));
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  mesh.updateMatrixWorld(true);
  for (let i = 0; i < pos.count; i++) {
    let f = 0;
    for (let k = 0; k < 4; k++) {
      f += (jointScores[skinIndex.getComponent(i, k)] ?? 0) * skinWeight.getComponent(i, k);
    }
    f = Math.min(1, f * 1.2);
    // 掌/背分区:绑定姿态顶点在手系的 z(掌心 +z 亮暖,手背 -z 沉一点)。
    // mesh 在 inner(对齐变换)之下,matrixWorld 直接给出手系坐标。
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    const palm = THREE.MathUtils.clamp(v.z / (12 * U) + 0.5, 0, 1);
    const base = 0.94 + 0.06 * palm;
    colors[i * 3] = Math.min(1, base + 0.06);
    colors[i * 3 + 1] = base * (1 - 0.09 * f);
    colors[i * 3 + 2] = base * (1 - 0.14 * f);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}
