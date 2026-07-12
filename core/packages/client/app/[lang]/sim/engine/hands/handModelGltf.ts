/**
 * /sim 手部模型 — 蒙皮手资产适配层(WebXR 25 关节命名契约)。历史上服务
 * generic-hand GLB(2026-07-11 内置手模退役,GLB 资产与 loadGltfHand 已删);
 * 现由 handModelMano 喂 MANO 转换资产走同一适配:手系对齐 / 等比缩放 /
 * 代理关节 / meta 掌骨 / 立体甲片 / 顶点血色。
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
 * 左右手:两份真镜像资产,无 scale=-1 手性 hack。魔方右侧的手 = 解剖学右手
 * (掌贴 R 面、指钩 B 面、拇指压 F 面 —— 人类握法),side 参数只保留给 rig
 * 做 splay 镜像语义。
 */
import * as THREE from "three";
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
 *  再加 roll 接触被换走,oracle 实测)。改此值必须连动 handPoses 拇指 curl 重解。
 *  2026-07-10 r10.1:此常量**钉死在 bind 解剖系 2.074**(甲床贴肉背脊线、
 *  皮肤贴图甲背方向、curl 平面三者在 bind 姿下自洽)。r10 首版直接改 2.6 是
 *  错的 —— ROLL 在 attach 前进 rootBase,attach 保世界位姿,**肉不跟转**,
 *  只有甲片/弯曲平面转了 30°:甲片偏离解剖脊线、拇指侧肉压面(用户抓的
 *  「只改支架,拇指没跟着转」)。对 F 面的甲面取向改走姿态层 FingerCurl.twist
 *  (r11 全关节解锁:CMC 轴向旋前,rig 每帧 Euler x 槽,肉+甲+curl 平面
 *  经真实关节同转);r10 的挂载旋转/平移 hack(THUMB_MOUNT_ROT /
 *  THUMB_PITCH_MOUNT)随之删除 —— 挂载变换是「支架」,真关节才动肉。 */
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
  thumbRoll: number = THUMB_CURL_PLANE_ROLL,
): { axis: THREE.Vector3; dorsal: THREE.Vector3; lat: THREE.Vector3; len: number } {
  const axis = p4.clone().sub(p3);
  const len = axis.length();
  axis.normalize();
  const xf = p2.clone().sub(p1).normalize();
  const pad = new THREE.Vector3(0, 0, 1).addScaledVector(xf, -xf.z).normalize();
  if (thumb) pad.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(xf, thumbRoll * side));
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
// T0 0.32→0.40(r6):大弯姿态(↓ 握 / B 面钩)DIP 皮肤相对刚挂 tip 的甲板
// 前滑数 U,甲根越贴折痕被盖越狠(左上角皮压板波浪,静态 lift 盖不住 ——
// 再抬成白顶针)。退开折痕后板长 [0.40,~1.36] 仍长于 07-09 的 [0.32,1.15]。
const NAIL_T0 = 0.40, NAIL_REACH = 1.15;
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
  /** 甲板前缘终点(末节段分数,每指动态 = 1 + REACH·rCap/len,见 NAIL_REACH)。 */
  t1: number;
  /** 甲板抬升量(adaptGltfHand 解出):崖深随之加深,保证抬高后崖仍扎穿皮面。 */
  lift: number;
}): THREE.BufferGeometry {
  const { p3, axis, dorsal, lat, len } = args;
  const T0 = NAIL_T0, T1 = args.t1;
  const TH = NAIL_TH;           // 甲片厚度(薄;游离缘侧壁可见即可)
  // r6 终版:**删埋皮帘幕崖**。此前侧缘/甲根用 3U+lift 深崖扎进皮里 —— 板抬
  // 高(lift 保证全域高于皮面)后这些崖墙整段裸露,崖底缘 + 崖淡出坡道的折痕
  // 就是用户抓的「撕纸锯齿 + 内部皱褶」(红色诊断料实证:烂边全是甲片自身几
  // 何,皮根本没盖到板面)。现在甲片是干净闭合薄板:顶/底面 + TH 侧壁,边缘
  // 只轻微下卷 ~0.9U(貌似贴甲床),轮廓从任何角度 = 自身解析超椭圆。
  const EDGE_TUCK = 0.9 * U;
  const TUCK_S = 0.80, TUCK_E = 0.98;
  const BASE_SINK = 1.4 * U; // 甲根轻沉一点点进近端甲襞,配合肤色融接
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
      const lun = sstep(-0.45, -0.68, q) * 0.5; // 半月对比调淡(强白斑读成大理石纹)
      // 甲根带渐变融入肤色(r6):甲根埋皮后,可见白界 = 低模皮肤多边形剪影
      // 压在甲板上的折线(撕纸感,踩过)。把甲根两行的颜色 lerp 到肤色,白甲
      // 的视觉边界改为甲板自身 q 向解析渐变(平滑弧),皮∩甲折线隐进同色里。
      const rootBlend = sstep(-0.70, -0.92, q);
      for (let j = 0; j < NC; j++) {
        const w = -1 + (2 * j) / (NC - 1);
        const u = args.uCenter + w * w2 * args.halfWAt(sAbs);
        // 埋皮 ramp 只留窄边(侧缘最外一列 / 甲根最后两行):可见轮廓 =
        // 「皮 ∩ 甲」交线,宽软坡会让交线随皮面噪声大幅横移,读成锯齿 blob(踩过)
        const tuckK = sstep(TUCK_S, TUCK_E, Math.abs(w)) * (1 - sstep(qTip - 0.05, qTip + 0.4, q));
        // 甲根角部豁免:sink 与 tuck 在根角叠加会掐出台阶剪影,角上让 sink 退掉
        const sinkK = sstep(-0.74, -0.94, q) * (1 - 0.7 * sstep(0.5, 0.9, Math.abs(w)));
        const hu = args.surf(sAbs, u) - BASE_SINK * sinkK - EDGE_TUCK * tuckK;
        // 甲面=甲底+厚度(中央极轻微加厚;穹顶感主要来自甲底跟皮面圆度)
        const h = layer === 0 ? hu + TH * (0.94 + 0.06 * Math.sqrt(Math.max(0, 1 - w * w))) : hu;
        P.copy(p3).addScaledVector(axis, sAbs).addScaledVector(dorsal, h).addScaledVector(lat, u);
        pos.push(P.x, P.y, P.z);
        // 边缘轻微压暗(下卷面),甲底略暗。
        const groove = Math.max(0, 1 - 0.15 * tuckK - 0.10 * sinkK);
        const shade = (layer === 0 ? 1 : 0.9) * groove;
        let r = (0.93 + 0.05 * lun + 0.06 * free) * shade;
        let g = (0.80 + 0.08 * lun + 0.15 * free) * shade;
        let b = (0.76 + 0.08 * lun + 0.15 * free) * shade;
        // 甲根带 lerp 到肤色(bakeVertexTint 远端血色的近似值)
        r += (1.0 - r) * rootBlend;
        g += (0.84 - g) * rootBlend;
        b += (0.78 - b) * rootBlend;
        col.push(Math.min(1, r), Math.min(1, g), Math.min(1, b));
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
 *  远端加权;顶点色 = Σ 蒙皮权重 × 分数 → 指尖聚血、掌根素净。onepiece 傀儡
 *  层(smplxBody)手区顶点色同源,导出共用。 */
export function boneBloodScore(name: string): number {
  if (/-tip$/.test(name)) return 1.0;
  if (/phalanx-distal/.test(name)) return 0.85;
  if (/phalanx-intermediate/.test(name)) return 0.5;
  if (/thumb-phalanx-proximal/.test(name)) return 0.45;
  if (/phalanx-proximal/.test(name)) return 0.3;
  if (/metacarpal/.test(name)) return 0.08;
  return 0;
}

const noRaycast = (): void => { /* 手不可拾取 — 拖拽/点击穿透到魔方 */ };



/** 按资产覆盖的适配参数(MANO 等非 generic-hand 资产经 handModelMano 走同一
 *  适配层,但拇指绑定滚转 / 甲宽比例是逐资产标定值,generic 缺省)。 */
export interface AdaptGltfOpts {
  /** 拇指弯曲平面 roll(rad,绑定解剖系;generic = THUMB_CURL_PLANE_ROLL)。 */
  thumbRoll?: number;
  /** 甲片半宽比例表覆盖(K = 背侧指尖满宽 ÷ 末节长,探针实测烘定值)。 */
  nailHalfWK?: Partial<Record<FingerName, number>>;
  /** @4 融合前臂的绑定臂伸向(腕→肘,资产空间单位向量,转换器 forearmDir)。
   *  与骨名 "forearm" 同时存在才装配 HandModel.forearm。 */
  forearmDirAsset?: [number, number, number];
  /** 融合手系基 Rm(行优先 3×3,列 = fwd/ym/zm,资产模板空间,转换器
   *  handFrame;左手已镜像)。存在时装配 forearm.frameQuat = align·Rm。 */
  handFrame?: number[][];
}

/** 纯适配步(无 fetch):gltf.scene → HandModel。拆出来供测试用 fs 读 GLB +
 *  探针/测试从 fs 读转换 JSON 直喂(Node 环境无相对 URL fetch)。 */
export function adaptGltfHand(src: THREE.Object3D, side: 1 | -1, skinMat: THREE.Material, label = "hand.glb", opts?: AdaptGltfOpts): HandModel {
  const thumbRoll = opts?.thumbRoll ?? THUMB_CURL_PLANE_ROLL;
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

  // 腕骨:静止件,直接挂 group(保世界变换)。四指掌骨不再焊死 —— r11 全
  // 关节解锁,进各指 meta 代理关节(掌弓自由度,见下方指环)。
  group.attach(bone("wrist"));

  // @4 融合前臂骨:attach 进 group(手系,轴心=腕),rig 每帧绕腕摆向肘锚;
  // 绑定臂伸向 = 资产系 forearmDir 过对齐旋转(等比缩放不改方向)。
  let forearm: HandModel["forearm"];
  const armBone = bones.get("forearm");
  if (armBone && opts?.forearmDirAsset) {
    group.attach(armBone);
    const bindDir = new THREE.Vector3(...opts.forearmDirAsset).applyQuaternion(align).normalize();
    let frameQuat: THREE.Quaternion | undefined;
    if (opts.handFrame) {
      // frameQuat = align·Rm:融合手系基(资产模板空间列基 fwd/ym/zm,行优先
      // 存储)转进手组系。体 rig 焊臂的常量因子(smplxBody.updateArm)。
      const hf = opts.handFrame;
      const m = new THREE.Matrix4().makeBasis(
        new THREE.Vector3(hf[0][0], hf[1][0], hf[2][0]),
        new THREE.Vector3(hf[0][1], hf[1][1], hf[2][1]),
        new THREE.Vector3(hf[0][2], hf[1][2], hf[2][2]),
      );
      frameQuat = new THREE.Quaternion().setFromRotationMatrix(m).premultiply(align);
    }
    forearm = { bone: armBone, bindDir, bindQuat: armBone.quaternion.clone(), frameQuat };
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
      rootBase.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), thumbRoll * side));
    }
    const invBase = rootBase.clone().invert();

    // 掌骨 meta 代理(r11 全关节解锁;拇指无 —— 其 root 即掌骨):rest 局部
    // 旋转 = identity(手系对齐),root 改挂它下面 —— 缺省时 root 的局部
    // pos/quat 语义与直接挂 group 完全一致(rig 契约零改动),meta 一转,
    // 掌骨蒙皮 + 整指链 FK 随动(真人掌弓/cupping)。
    let metaJ: THREE.Group | undefined;
    let metaBase: THREE.Quaternion | undefined;
    if (chain.static) {
      const pm = toHand(bindOf(chain.static));
      metaJ = new THREE.Group();
      metaJ.position.copy(pm);
      group.add(metaJ);
      // 掌骨作者系:+x = 掌骨→指根,+z = 掌心向投影(同指作者系构造)。
      const xm = p1.clone().sub(pm).normalize();
      const zm = new THREE.Vector3(0, 0, 1).sub(xm.clone().multiplyScalar(xm.z)).normalize();
      const ym = new THREE.Vector3().crossVectors(zm, xm);
      metaBase = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xm, ym, zm));
      group.updateMatrixWorld(true);
      metaJ.attach(bone(chain.static));
    }

    const root = new THREE.Group();
    root.position.copy(metaJ ? p1.clone().sub(metaJ.position) : p1);
    root.quaternion.copy(rootBase);
    const mid = new THREE.Group();
    mid.position.copy(p2.clone().sub(p1).applyQuaternion(invBase)); // ≈ (len1,0,0)
    const tip = new THREE.Group();
    tip.position.copy(p3.clone().sub(p2).applyQuaternion(invBase));
    (metaJ ?? group).add(root);
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
      ...(metaJ && metaBase ? { meta: metaJ, metaBase } : {}),
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
      const nf = nailFrame(q1, q2, q3, q4, name === "thumb", side, thumbRoll);
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
        if (sa < -3 * U || sa > nf.len + 14 * U) continue; // 前窗放宽到皮帽外(实测皮尖用)
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
      // 甲板前缘终点 = **实测皮尖**(2026-07-11 用户规格「指甲要刚好到手指
      // 尖端」):MANO 的 tip 骨是转换器取的皮肤极值顶点(t=1 即肉尖),写死
      // REACH·rCap 悬伸会让整段甲板飘出指外(太长,用户抓的);generic 皮帽
      // 还向前伸 ~0.9·rCap,实测皮尖自动落在帽端。REACH 只作上限(异常样本
      // 兜底);悬出段 DIP 下弧仍给游离缘剪影,但不越过指尖。
      const rCap = rBase;
      let sApex = nf.len;
      for (const p of smp) {
        if (Math.abs(p.u - uC) > 0.6 * rDist) continue;
        sApex = Math.max(sApex, p.s);
      }
      const t1 = Math.min(sApex / nf.len, 1 + (NAIL_REACH * rCap) / nf.len);
      const rTipRidge = rBase * (1 - 0.08); // 贴背段末端(t=1)脊高,悬出段起点
      const ridge = (sq: number): number => {
        if (sq <= nf.len) return rBase * (1 - 0.08 * sstep(0.50, 1, sq / nf.len));
        const x = Math.min(1, (sq - nf.len) / (NAIL_REACH * rCap));
        return rTipRidge * (1 - NAIL_TIP_DIP * x * x);
      };
      // ×0.82:r6 甲板抬到皮面之上后,可见白区 = 甲板全宽(旧貌「满宽建模、
      // 只露中段」不再成立 —— 白剪影外界是板外缘 rim,收崖起点不收剪影,踩过)。
      // 满宽白剪影 = 白顶针;0.82×满宽 ≈ 背视甲板占指背 ~3/4,解剖比。
      const halfW = 0.82 * (opts?.nailHalfWK?.[name] ?? NAIL_HALFW_K[name]) * nf.len;
      // 横向曲率半径(r7,2026-07-11 用户抓「甲片平板悬空不贴指」):随形圆拱,
      // 曲率 ≈ 指管半径(rSide≈1.05×脊高,板弧 ~150° 包住指背)。r6 的放平
      // (1.7×)+高抬升是对旧 generic 粗蒙皮「皮咬板波浪」的规避 —— MANO 高
      // 密度蒙皮下皮∩甲交线本身平滑,板缘贴进甲沟是正确观感,不再放平。
      // 1.02×halfW 下界只保 sqrt 定义域(halfW 可能略超脊高)。
      const rSide = Math.max(1.05 * rBase, 1.02 * halfW);
      const bed0 = (sq: number, uq: number): number => {
        const du = Math.min(Math.abs(uq - uC), rSide);
        return ridge(sq) - (rSide - Math.sqrt(Math.max(0, rSide * rSide - du * du)));
      };
      const halfWAt = (): number => halfW;
      // 覆盖余量:甲域**贴背段**面内按真实样本(非平滑场)校验;悬出段皮面
      // 本就该在甲板之下(游离缘),不参与抬升。
      // r6(2026-07-10 用户抓「撕纸锯齿 + 肉斑」):旧版容许皮峰戳穿 45% 甲厚
      // + lift 封顶 1.2U + 弯指姿态漂移 ~1U → 皮肤在甲面上大片盖白,可见白色
      // 边界 = 皮∩甲交线扫过整个甲板(随粗皮大三角游走 = 撕纸)。改为:甲板
      // **全域必然高于皮面** —— 无戳穿容差、样本外再加 1.2U(稀疏样本插值 +
      // 姿态漂移)余量;footprint 扩到全宽 + 根前 0.05,崖深随 lift 加深兜边缘。
      // 采样窗 = **可见甲板区**(t≥0.45 避开甲根崖区、|u|≤0.8·halfW 避开侧缘
      // 崖区):崖区的皮本来就该盖住崖,把它们计入 need 会把 lift 推到上限,
      // 甲板变罩住指尖的白顶针(r6 第一版踩的)。
      // |u| 窗 0.9·halfW = 可见板面全宽(tuck 崖 0.80 起,0.9 处才降半):窗比
      // 可见面窄会漏掉边缘上方的皮 → 该处皮压板(左缘波浪咬边,踩过)。halfW
      // 已 ×0.82 收窄,0.9 窗折合原满宽 0.74,不会再采到侧翼外扬皮(白顶针)。
      let need = 0;
      for (const p of smp) {
        const t = p.s / nf.len;
        if (t < 0.45 || t > Math.min(t1, 1.02)) continue;
        if (Math.abs(p.u - uC) > 0.9 * halfW) continue;
        need = Math.max(need, p.h - bed0(p.s, p.u));
      }
      // r7:抬升收到最小(0.5U 余量 / 1.4U 顶)—— 随形拱下 need 本就小,大
      // 抬升 = 整板悬空缝隙(用户抓的)。
      const lift = Math.min(need + 0.5 * U, 1.4 * U);
      const bed = (sq: number, uq: number): number => bed0(sq, uq) + lift;
      const geo = buildNailGeometry({ p3: q3, axis: nf.axis, dorsal: nf.dorsal, lat: nf.lat, len: nf.len, halfWAt, surf: bed, uCenter: uC, t1, lift });
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

  return { group, side, unitScale: s, fingers, meshes: [mesh as THREE.Mesh, ...nailMeshes], extraMats: [nailMat], nailMeshes, forearm };
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
