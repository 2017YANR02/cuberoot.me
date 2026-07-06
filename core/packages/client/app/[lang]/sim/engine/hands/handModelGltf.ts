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
 *  共轭反号 → ×side。 */
const THUMB_CURL_PLANE_ROLL = 1.524;

/** WebXR 25 关节命名(https://www.w3.org/TR/webxr-hand-input-1/)。
 *  四指 FK 链 = proximal/intermediate/distal(metacarpal 静止在掌内);
 *  拇指链 = metacarpal/proximal/distal(拇指的可动基节就是掌骨)。 */
const JOINT_CHAINS: Record<FingerName, { drive: [string, string, string]; end: string; static?: string }> = {
  thumb: { drive: ["thumb-metacarpal", "thumb-phalanx-proximal", "thumb-phalanx-distal"], end: "thumb-tip" },
  index: { drive: ["index-finger-phalanx-proximal", "index-finger-phalanx-intermediate", "index-finger-phalanx-distal"], end: "index-finger-tip", static: "index-finger-metacarpal" },
  middle: { drive: ["middle-finger-phalanx-proximal", "middle-finger-phalanx-intermediate", "middle-finger-phalanx-distal"], end: "middle-finger-tip", static: "middle-finger-metacarpal" },
  ring: { drive: ["ring-finger-phalanx-proximal", "ring-finger-phalanx-intermediate", "ring-finger-phalanx-distal"], end: "ring-finger-tip", static: "ring-finger-metacarpal" },
  pinky: { drive: ["pinky-finger-phalanx-proximal", "pinky-finger-phalanx-intermediate", "pinky-finger-phalanx-distal"], end: "pinky-finger-tip", static: "pinky-finger-metacarpal" },
};

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

  // ---- 顶点血色烘焙(skinMat vertexColors:true 契约:所有肤色网格必须带
  //      color 属性)+ 掌亮背深:按蒙皮权重聚血到远端,按手系 z 分掌背。 ----
  bakeVertexTint(mesh);

  mesh.frustumCulled = false; // 骨骼动到包围盒外仍要渲
  mesh.raycast = noRaycast;
  mesh.material = skinMat;
  mesh.castShadow = mesh.receiveShadow = false;

  return { group, side, fingers, meshes: [mesh as THREE.Mesh] };
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
