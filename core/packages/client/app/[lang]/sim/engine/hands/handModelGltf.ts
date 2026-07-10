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

/** 甲片格网行列数(轮廓 = 甲缘超椭圆本身,行数定侧缘圆滑度)。 */
const NAIL_NR = 33, NAIL_NC = 21;
/** 甲片半宽 = K × 末节长。K 标定 = 实测「背侧指尖皮肤半宽」÷ 末节长 —— 即甲片建模
 *  到指尖背侧满宽,再由 EDGE_TUCK 陡崖把最外 ~16% 收进甲沟,可见甲板 ≈ 0.84×满宽
 *  (解剖比 75~85%,两侧余窄条 = 甲沟)。实测(tests 探针:甲域 t∈[T0,T1] 背侧半球
 *  h≥0 顶点对 uC 居中横偏 p90,单位 U)拇指 9.8 / 食 10.2 / 中 10.4 / 环 10.1 / 小 7.4
 *  → K×len 得甲半宽 9.9/10.3/10.5/10.0/7.6U ≈ 满宽。
 *  仍禁「运行时」从蒙皮顶点推宽度:这套低模末节径向半径(rDist)高估 ~2x + 每指背侧
 *  样本仅 5~14 个(环指常漏采最宽点),逐载入 p90 会抖出忽宽忽窄的 blob(旧坑);故把
 *  实测锚点烘成确定性比例表(跨左右手一致),而非运行时采样。旧表(0.34/0.30/0.30/
 *  0.29/0.26)甲宽仅指尖的 ~45%,用户报「指甲太小」。改末节长 / 换资产须重跑探针重标。 */
const NAIL_HALFW_K: Record<FingerName, number> = { thumb: 0.50, index: 0.67, middle: 0.65, ring: 0.63, pinky: 0.48 };
/** 甲片轴向覆盖(末节段分数)+ 厚度 —— 几何层与放置层(覆盖余量)共用。
 *  蒙皮实测(tests 曾 dump 环状剖面):皮管过 tip 骨(t=1)后收**半球帽**
 *  (半径 ≈ 背侧脊高 rBase),皮尖 t≈1.3。
 *  T0=0.32(2026-07-09,用户报「指甲太小」)：甲根前移到 DIP 折痕附近,甲板铺满
 *  末节背面 ~2/3;最根一行由 BASE_SINK 崖埋进近端甲襞。
 *  前缘 2026-07-10 第 5 轮重做(用户第 4 轮抓「没有游离缘 + 棉花糖坨」):
 *  r3 直线外伸停在帽前(尖端裸肉)、r4 沿帽球滚降 capK 又成裹球壳(甲永远
 *  贴皮,无游离缘,侧影圆坨)—— 现改**悬出板**:贴背段(t≤1)照旧贴甲床,
 *  过 tip 骨后甲板脱离皮面、微下弧切线伸出(见 ridge 的 DIP 抛物段),前缘
 *  终点 t1 = 1 + REACH·rCap/len。帽面同高处的皮在 s≈len+0.83·rCap 已结束,
 *  甲缘悬出肉外 ≈0.3·rCap,侧看有真实游离缘剪影。REACH>1:轴向越过肉尖。 */
const NAIL_T0 = 0.32, NAIL_REACH = 1.15;
/** 悬出段下弧深度(前缘高 = (1-DIP)×脊高):太小=平板翘出,太大=又贴回帽面。 */
const NAIL_TIP_DIP = 0.45;
const NAIL_TH = 0.55 * U;

/**
 * 立体甲片薄壳(2026-07-08 用户规格:指甲要有薄薄的厚度、是立体结构):
 * 超椭圆轮廓双层格网(甲面/甲底)+ 周缘侧壁。甲底贴解析甲床高度场
 * (adaptGltfHand 拟合:轴向二次脊线 × 横向定锥圆柱,已含覆盖余量):
 * 侧缘额外下收进皮(甲沟)、甲根藏进近端甲襞、游离缘微翘露出厚度。
 * 甲片是唯一指甲 —— 贴图画甲已移除(曾三层叠影:壳姿态漂移裂成两团 +
 * 画甲外露读成第三片,2026-07-08 用户抓的)。
 * 纯 BufferGeometry(hands_model 测试在 Node 跑 adaptGltfHand,禁 DOM)。
 */
function buildNailGeometry(args: {
  p3: THREE.Vector3; axis: THREE.Vector3; dorsal: THREE.Vector3; lat: THREE.Vector3;
  len: number;
  /** 甲片半宽(s = 沿末节轴绝对距离)—— 解析收锥,禁跟逐点噪声(会抖成
   *  不规则 blob,踩过);等宽甲片前段侧缘会悬伸出指侧(细白条,踩过)。 */
  halfWAt: (s: number) => number;
  /** 解析甲床高度场(dorsal 向投影;s 同上,u = 侧向绝对偏移)。 */
  surf: (s: number, u: number) => number;
  /** 甲片横向中心(lat 向偏移):nailFrame 的 lat 原点可偏离指管中轴(拇指
   *  ~-4U,dorsal 滚转所致),不对中会一缘埋皮一缘悬空(歪甲/缺口,踩过)。 */
  uCenter: number;
  /** 甲板前缘终点(末节段分数,每指动态 = 1 + WRAP·rCap/len,见 NAIL_WRAP)。 */
  t1: number;
}): THREE.BufferGeometry {
  const { p3, axis, dorsal, lat, len } = args;
  const T0 = NAIL_T0, T1 = args.t1;
  const TH = NAIL_TH;           // 甲片厚度(薄;游离缘侧壁可见即可)
  const EDGE_TUCK = 3.0 * U;    // 侧缘陡崖式下收进皮(甲沟):可见轮廓 = 皮∩甲交线,
                                // 缓坡交线随粗皮网格大面片横移读成折线(踩过);做成近垂直
                                // 崖后交线钉在甲缘超椭圆本身(皮高微变几乎不移交点)→ 轮廓圆滑
  // 崖只收最外 ~16%(0.84→0.99):甲片已建到指尖背侧满宽(halfW≈皮肤半宽),中段
  // 平铺可见 = 甲板,外沿这一小段陡收进甲沟 → 可见甲板 ≈ 0.84×满宽(解剖比)。旧
  // ramp 0.68→0.90 收掉外 ~30%,把加宽的甲片大半埋回皮里(拇指加宽后完全不可见,踩过)。
  const TUCK_S = 0.84, TUCK_E = 0.99;
  const BASE_SINK = 2.2 * U;    // 甲根陡崖藏进近端甲襞(同侧缘,缓坡会让甲根轮廓折线化)
  const NR = NAIL_NR, NC = NAIL_NC;
  const tc = (T0 + T1) / 2, th = (T1 - T0) / 2;
  // t=1(tip 骨)对应的 q:悬出段(q>qTip)侧缘崖淡出 —— 那里皮面已收帽,
  // 没有甲沟可埋,继续压 3U 会把游离缘两角卷成下垂唇(可见);淡出后游离缘
  // 天然比贴背段略宽,正是真甲从甲襞里探出的观感。颜色白化同锚此处。
  const qTip = (1 - tc) / th;

  const pos: number[] = [];
  const col: number[] = [];
  const P = new THREE.Vector3();
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i < NR; i++) {
      const q = -0.97 + (1.94 * i) / (NR - 1);
      const sAbs = (tc + th * q) * len;
      // 方圆甲轮廓:|q|^2.7 让中段近等宽、只在两端圆角收窄。旧 (1-q²)^(1/2.2)
      // 从中点就开始收,两端尖 → 读成水滴/血滴(2026-07-10 用户抓的)。
      const w2 = Math.pow(1 - Math.pow(Math.abs(q), 2.7), 1 / 2.4);
      const free = sstep(qTip - 0.15, qTip + 0.45, q);
      const lun = sstep(-0.55, -0.9, q) * 0.5; // 半月对比调淡(强白斑读成大理石纹)
      for (let j = 0; j < NC; j++) {
        const w = -1 + (2 * j) / (NC - 1);
        const u = args.uCenter + w * w2 * args.halfWAt(sAbs);
        // 埋皮 ramp 只留窄边(侧缘最外一列 / 甲根最后两行):可见轮廓 =
        // 「皮 ∩ 甲」交线,宽软坡会让交线随皮面噪声大幅横移,读成锯齿 blob(踩过)
        const hu = args.surf(sAbs, u)
          - BASE_SINK * sstep(-0.74, -0.94, q)
          - EDGE_TUCK * sstep(TUCK_S, TUCK_E, Math.abs(w)) * (1 - sstep(qTip - 0.05, qTip + 0.4, q));
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

  // ---- 立体甲片:每指一块薄壳刚挂 tip 代理(随末节弯曲)。甲底贴解析甲床
  //      (轴向二次脊线 × 横向定锥圆柱,见下方拟合段)—— 旧版 1D 轴向 max 桶
  //      轮廓 + SINK 沉皮裂成两团「假甲」(踩过);再旧版逐点跟 IDW 噪声场,
  //      甲片抖成不规则 blob + 浮空缝隙(2026-07-09 用户抓的)。
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
      // 解析甲床(2026-07-09 重做,用户抓的「粗糙白斑甲 + 浮空缝隙」)。
      // 这套 GLB 蒙皮很粗:每指末节/端点骨主导顶点仅 ~40-70 个,甲域背侧
      // 样本 13-28 个,呈稀疏「环」状(轴向每 ~0.4·len 一圈)—— 任何逐点/
      // 分箱拟合(e^{κh} 软最大 IDW 场、bin-max 二次脊线)都被稀疏噪声抖成
      // 不规则 blob,还把甲冠系统性抬出皮面(缝隙)或压到皮峰下(皮戳穿甲
      // 面成月牙缺口),踩过两版。实测剖面是规则圆拱(R≈1.25×脊高),轴向
      // 几乎不收锥(≤8%),但横向中心可偏离 lat 原点(拇指 ~-4U)。
      // 故数据只取三个鲁棒标量,其余全解析:
      //   uC    = 皮面高度加权 u 质心(横向对中,治「歪甲/单侧缺口」);
      //   rBase = 甲域中带皮高上包络(实顶点,非插值 —— 锚高了缝隙锚低了戳穿);
      //   need  = 面内皮样本对甲床的最大超出(覆盖余量,皮峰最多戳进甲厚 45%)。
      let uwSum = 0, uhSum = 0;
      for (const p of smp) {
        const t = p.s / nf.len;
        if (t < 0.35 || t > 1.3) continue; // 皮尖 ≈1.3(帽点低权重,纳入无害)
        const w = Math.max(0, p.h);
        uwSum += w; uhSum += w * p.u;
      }
      const uC = THREE.MathUtils.clamp(uwSum > 1e-6 ? uhSum / uwSum : 0, -6 * U, 6 * U);
      let rBase = 0;
      for (const p of smp) {
        const t = p.s / nf.len;
        if (t < 0.35 || t > 1.3 || Math.abs(p.u - uC) > 0.45 * rDist) continue;
        rBase = Math.max(rBase, p.h);
      }
      rBase = THREE.MathUtils.clamp(rBase > 0 ? rBase : 0.55 * rDist, 4.5 * U, 11 * U);
      // 甲板前缘终点(NAIL_REACH 注释):帽半径 ≈ 背侧脊高。悬出段脊线 =
      // 微下弧抛物板(不贴帽面):前缘高 (1-DIP)×脊高,始终在帽圆之上 →
      // 甲缘悬出肉外(帽同高处的皮 s≈len+0.83·rCap 就没了);贴背段照旧。
      const rCap = rBase;
      const t1 = 1 + (NAIL_REACH * rCap) / nf.len;
      const rTipRidge = rBase * (1 - 0.08); // 贴背段末端(t=1)脊高,悬出段起点
      const ridge = (sq: number): number => {
        if (sq <= nf.len) return rBase * (1 - 0.08 * sstep(0.50, 1, sq / nf.len));
        const x = Math.min(1, (sq - nf.len) / (NAIL_REACH * rCap));
        return rTipRidge * (1 - NAIL_TIP_DIP * x * x);
      };
      const halfW = NAIL_HALFW_K[name] * nf.len;
      const rSide = Math.max(1.25 * rBase, 1.1 * halfW); // 横向曲率半径(实测拱 ≈1.25×脊高)
      const bed0 = (sq: number, uq: number): number => {
        const du = Math.min(Math.abs(uq - uC), rSide);
        return ridge(sq) - (rSide - Math.sqrt(Math.max(0, rSide * rSide - du * du)));
      };
      const halfWAt = (): number => halfW;
      // 覆盖余量:甲域**贴背段**面内(避开埋皮侧缘)按真实样本(非平滑场)校验;
      // 悬出段皮面本就该在甲板之下(游离缘),不参与抬升。
      let need = 0;
      for (const p of smp) {
        const t = p.s / nf.len;
        if (t < NAIL_T0 || t > Math.min(t1, 1.02)) continue;
        if (Math.abs(p.u - uC) > 0.85 * halfW) continue;
        need = Math.max(need, p.h - bed0(p.s, p.u));
      }
      const lift = Math.min(Math.max(0, need - 0.45 * NAIL_TH), 1.2 * U);
      const bed = (sq: number, uq: number): number => bed0(sq, uq) + lift;
      const geo = buildNailGeometry({ p3: q3, axis: nf.axis, dorsal: nf.dorsal, lat: nf.lat, len: nf.len, halfWAt, surf: bed, uCenter: uC, t1 });
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
