/**
 * /sim 手部模型 — MANO 加载层(MPI MANO,用户自持授权;资产不入公开 repo,
 * 由 scripts/convert-mano.py 逐机转换到 public/sim/hands/mano/,gitignored)。
 *
 * 思路:转换器已把 MANO 的 16 关节 + 合成关节(四指掌骨 / 五指尖)排成
 * **WebXR 25 关节同名骨骼** + 蒙皮网格 —— 这里只负责把 JSON 解码回
 * THREE.Bone/SkinnedMesh(平铺层级,同 generic-hand GLB 风格),然后整包交给
 * `adaptGltfHand` 走与 generic-hand 完全相同的适配(手系对齐 / 等比缩放 /
 * 代理关节 / meta 掌骨 / 立体甲片 / 顶点血色)。rig、姿态通道、求解探针全部
 * 零分叉复用;逐资产差异只剩两个标定值(拇指绑定滚转 / 甲宽比例表)。
 *
 * MANO vs generic-hand 的真实差异(为什么值得做):参数化人手扫描模型,
 * 拇指 CMC 是腕上独立真关节、掌型比例解剖准确 —— r11 在 generic-hand 上
 * 证明「真 CMC 沉 D 层」超出该资产可行域,MANO 是下一个自由度上限。
 * 注意:MANO 无作者 UV;转换器 @2 起生成盒式投影无重叠 UV 图集(接缝顶点
 * 复制 + 显式平滑法线),bakeHandTextures(UV 光栅化 + 3D 域特征求值,对
 * 图集布局无要求、只要求单射)与 generic 同路径烘焙,MANO 同享皮肤贴图。
 */
import * as THREE from "three";
import { SIZE } from "../define";
import { adaptGltfHand } from "./handModelGltf";
import { HAND_SCALE, type FingerName, type HandModel } from "./handModel";

/** scripts/convert-mano.py 的输出格式(@2:盒式投影无重叠 UV 图集 + 接缝顶点
 *  复制 + 显式平滑法线 —— 供 bakeHandTextures 走与 generic 相同的烘焙路径)。 */
export interface ManoHandData {
  format: string;
  hand: "right" | "left";
  counts: { verts: number; faces: number };
  bones: { name: string; pos: [number, number, number] }[];
  position: string; // b64 float32 (n,3)
  normal: string;   // b64 float32 (n,3) — 接缝复制前算的平滑法线(复制后再算会有硬缝)
  index: string;    // b64 uint32 (f,3)
  uv: string;       // b64 float32 (n,2) — 无重叠图集(烘焙贴图要求单射)
  skinIndex: string; // b64 uint8 (n,4) — 25 骨列表内的索引
  skinWeight: string; // b64 float32 (n,4) 已归一
  /** 姿态修正 blendshape(int8,(n,3,135) C 序;系数 k=(j−1)·9+a·3+b 对应
   *  MANO 关节 j 局部旋转 (R−I)_ab)。 */
  posedirs: string;
  posedirsScale: string; // b64 float32 (135,) 逐系数反量化尺度
}

/** 拇指弯曲平面 roll(rad,MANO 绑定解剖系)。generic-hand 是 2.074;MANO
 *  模板拇指的旋前角不同,此值 = 资产到位后按「甲片落在拇指背脊线上 +
 *  curl 朝掌心收」目测/探针标定。初值 0.9 ≈ 平摊模板拇指外旋 ~50° 的解剖
 *  经验值,标定后更新(改它必须重跑 MANO home 求解)。 */
export const MANO_THUMB_ROLL = 0.9;

/** MANO 甲宽比例表(K = 背侧指尖满宽 ÷ 末节长)。2026-07-11 探针
 *  MEASURE_NAILK=1 MODEL=mano 实测(真实解剖比例,远窄于 generic-hand 胖低模;
 *  重跑转换器后需复测)。 */
export const MANO_NAIL_HALFW_K: Partial<Record<FingerName, number>> = {
  thumb: 0.227, index: 0.267, middle: 0.272, ring: 0.26, pinky: 0.274,
};

function b64ToArrayBuffer(s: string): ArrayBuffer {
  if (typeof atob === "function") {
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  // Node(vitest 探针路径)
  const buf = Buffer.from(s, "base64");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/** 纯构建步(无 fetch):转换 JSON → HandModel。探针/测试用 fs 读文件直喂。 */
export function buildManoHand(data: ManoHandData, side: 1 | -1, skinMat: THREE.Material, label = "mano"): HandModel {
  if (data.format !== "cuberoot-mano-hand@3") {
    throw new Error(`mano hand ${label}: unknown format ${data.format} — re-run scripts/convert-mano.py`);
  }
  if ((side === -1 && data.hand !== "right") || (side === 1 && data.hand !== "left")) {
    throw new Error(`mano hand ${label}: side/hand mismatch (side ${side}, file ${data.hand})`);
  }
  const pos = new Float32Array(b64ToArrayBuffer(data.position));
  const nrm = new Float32Array(b64ToArrayBuffer(data.normal));
  const idx = new Uint32Array(b64ToArrayBuffer(data.index));
  const uv = new Float32Array(b64ToArrayBuffer(data.uv));
  const skinIndex = new Uint8Array(b64ToArrayBuffer(data.skinIndex));
  const skinWeight = new Float32Array(b64ToArrayBuffer(data.skinWeight));
  const n = data.counts.verts;
  if (pos.length !== n * 3 || nrm.length !== n * 3 || skinIndex.length !== n * 4 || skinWeight.length !== n * 4) {
    throw new Error(`mano hand ${label}: buffer size mismatch`);
  }

  // 平铺骨骼(同 generic-hand GLB 的 WebXR 追踪风格):全部 Bone 挂同一根,
  // 局部位置 = 绑定位;adaptGltfHand 会按代理关节链 attach() 重组。
  const src = new THREE.Group();
  src.name = `mano-${data.hand}`;
  const bones: THREE.Bone[] = [];
  for (const b of data.bones) {
    const bone = new THREE.Bone();
    bone.name = b.name;
    bone.position.set(b.pos[0], b.pos[1], b.pos[2]);
    src.add(bone);
    bones.push(bone);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  // 法线用转换器给的(接缝复制前的平滑法线)—— computeVertexNormals 会沿
  // UV 岛边界(顶点已复制)算出硬缝。
  geo.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(Array.from(skinIndex), 4));
  geo.setAttribute("skinWeight", new THREE.BufferAttribute(skinWeight, 4));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));

  const mesh = new THREE.SkinnedMesh(geo, skinMat);
  mesh.name = `mano-${data.hand}-skin`;
  src.add(mesh);
  src.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones), mesh.matrixWorld);

  const model = adaptGltfHand(src, side, skinMat, label, {
    thumbRoll: MANO_THUMB_ROLL,
    nailHalfWK: MANO_NAIL_HALFW_K,
  });
  model.poseCorrective = makePoseCorrective(model, geo, data, n);
  return model;
}

/** MANO 关节 id(1..15,标准 kintree 序)→ WebXR 骨名;parent[j] 见 MANO
 *  kintree(四指近节的父 = 腕,MANO 无掌骨关节 —— 合成 meta 的旋转会并入
 *  近节相对腕的局部旋转,posedirs 语义正确)。 */
const MANO_JOINT_BONES: string[] = [
  "wrist",
  "index-finger-phalanx-proximal", "index-finger-phalanx-intermediate", "index-finger-phalanx-distal",
  "middle-finger-phalanx-proximal", "middle-finger-phalanx-intermediate", "middle-finger-phalanx-distal",
  "pinky-finger-phalanx-proximal", "pinky-finger-phalanx-intermediate", "pinky-finger-phalanx-distal",
  "ring-finger-phalanx-proximal", "ring-finger-phalanx-intermediate", "ring-finger-phalanx-distal",
  "thumb-metacarpal", "thumb-phalanx-proximal", "thumb-phalanx-distal",
];
const MANO_JOINT_PARENT = [-1, 0, 1, 2, 0, 4, 5, 0, 7, 8, 0, 10, 11, 0, 13, 14];

/**
 * posedirs 姿态修正闭包:系数 = 各关节「相对父骨的局部旋转」(R−I) 展平。
 * 关键化简:绑定时全骨世界四元数 = align(inner 对齐变换,attach 保世界),故
 * 模板系局部旋转 = qp_world⁻¹·qj_world 直接可得(align 共轭恰好抵消),手根
 * 世界位姿也在共轭里抵消 —— 待机呼吸(只动手根)系数不变,早退零开销。
 * 位移在模板(资产)空间施加于 geometry.position(蒙皮之前的绑定几何),
 * 法线不重算(毫米级鼓包,着色误差不可见)。
 */
function makePoseCorrective(model: HandModel, geo: THREE.BufferGeometry, data: ManoHandData, n: number): () => void {
  const q8 = new Int8Array(b64ToArrayBuffer(data.posedirs));         // (n,3,135)
  const scale = new Float32Array(b64ToArrayBuffer(data.posedirsScale)); // (135,)
  if (q8.length !== n * 3 * 135 || scale.length !== 135) {
    throw new Error(`mano posedirs: buffer size mismatch (${q8.length}, ${scale.length})`);
  }
  // 反量化并转置为 (135, n*3):逐系数累加时内层连续。
  const pd = new Float32Array(135 * n * 3);
  for (let i = 0; i < n * 3; i++) {
    for (let k = 0; k < 135; k++) pd[k * n * 3 + i] = q8[i * 135 + k] * scale[k];
  }
  const base = new Float32Array((geo.getAttribute("position") as THREE.BufferAttribute).array as Float32Array);
  const bones = MANO_JOINT_BONES.map((name) => {
    const b = model.group.getObjectByName(name);
    if (!b) throw new Error(`mano posedirs: bone ${name} missing`);
    return b;
  });
  const cLast = new Float32Array(135).fill(NaN);
  const c = new Float32Array(135);
  const qj = new THREE.Quaternion(), qp = new THREE.Quaternion(), qr = new THREE.Quaternion();
  const mR = new THREE.Matrix4();
  return () => {
    for (let j = 1; j <= 15; j++) {
      bones[j].getWorldQuaternion(qj);
      bones[MANO_JOINT_PARENT[j]].getWorldQuaternion(qp);
      qr.copy(qp).invert().multiply(qj);
      mR.makeRotationFromQuaternion(qr);
      const e = mR.elements; // 列主序
      const o = (j - 1) * 9;
      c[o] = e[0] - 1; c[o + 1] = e[4]; c[o + 2] = e[8];
      c[o + 3] = e[1]; c[o + 4] = e[5] - 1; c[o + 5] = e[9];
      c[o + 6] = e[2]; c[o + 7] = e[6]; c[o + 8] = e[10] - 1;
    }
    let dirty = false;
    for (let k = 0; k < 135; k++) {
      if (!(Math.abs(c[k] - cLast[k]) < 1e-3)) { dirty = true; break; }
    }
    if (!dirty) return;
    cLast.set(c);
    const attr = geo.getAttribute("position") as THREE.BufferAttribute;
    const out = attr.array as Float32Array;
    out.set(base);
    for (let k = 0; k < 135; k++) {
      const ck = c[k];
      if (Math.abs(ck) < 0.01) continue; // int8 量化底噪以下,跳过
      const row = k * n * 3;
      for (let i = 0; i < n * 3; i++) out[i] += ck * pd[row + i];
    }
    attr.needsUpdate = true;
  };
}

/** 浏览器加载入口(同 loadGltfHand 语义:side=-1 → 右手)。资产 gitignored,
 *  未部署/未转换时 fetch 404 → 上抛,由 rig 侧回退 generic-hand 并告警。 */
export async function loadManoHand(side: 1 | -1, skinMat: THREE.Material): Promise<HandModel> {
  const name = side === -1 ? "right" : "left";
  const url = `/sim/hands/mano/${name}.mano.json?v=3`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`mano hand asset missing (${res.status} ${url}) — run scripts/convert-mano.py`);
  const data = (await res.json()) as ManoHandData;
  return buildManoHand(data, side, skinMat, `${name}.mano.json`);
}

// ---------------------------------------------------------------- SMPL-X 前臂

/** scripts/convert-mano.py 附带产出的 SMPL-X 真前臂切段(右臂;左臂运行时
 *  y 镜像 —— 尺骨头在小指侧,真前臂不对称,禁两臂共享同一几何)。刚体件,
 *  无蒙皮:rig 把整个 group 当一节前臂摆位(契约同 handModel.buildForearm)。 */
export interface SmplxForearmData {
  format: string;
  hand: "right";
  counts: { verts: number; faces: number };
  position: string; // b64 float32 (n,3) 米制,前臂件局部系(origin=腕,+x=肘→腕,+z=掌法向)
  normal: string;   // b64 float32 (n,3) 接缝复制前的平滑法线
  index: string;    // b64 uint32 (f,3)
  uv: string;       // b64 float32 (n,2) 盒式投影无重叠图集(bakeLimbTextures 要求单射)
  wristHalfY: number; // 腕环 y 半宽(米)—— 运行时按程序化前臂同款 34.5U 定缩放
}

const U = (SIZE / 64) * HAND_SCALE; // 与 handModel.ts 同基准
/** 程序化前臂腕端 y 半宽(buildForearm 34.5U)= 手模残端标定宽,真前臂对齐它。 */
const FOREARM_WRIST_HALF_Y_U = 34.5;

const noRaycast = (): void => { /* 手不可拾取 — 拖拽/点击穿透到魔方 */ };

/** 手模腕接驳环实测(rig 侧量当前手模,喂给 buildSmplxForearm 定宽):
 *  hy/hz = 腕环 y/z 半宽,cy/cz = 环心偏移(手局部系,rig 单位)。
 *  mode:'cover' = 盖住开口残端(generic GLB 残端是敞口斜切,臂必须略胖包住);
 *  'tuck' = 塞进闭合腕帽内(MANO 手网格封腕,臂必须略瘦藏进去 —— 胖了会把
 *  探进段顶穿手皮外露成台阶,2026-07-11 用户抓的)。 */
export interface ForearmFit {
  hy: number;
  hz: number;
  cy: number;
  cz: number;
  mode: "cover" | "tuck";
}

/** SMPL-X 真前臂件:契约同 buildForearm({group, meshes[0]=臂肤 meshes[1]=袖口},
 *  origin=贴腕,几何伸向 −x 肘端)。几何解码后缩放到 rig 单位(烘焙噪声频率按
 *  U 标定,必须先缩放再烘);缩放/对中按 fit(当前手模腕环实测)自适应,缺省
 *  回退 34.5U(程序化前臂同款标定);袖口按真臂在遮盖区的实测截面贴身生成。 */
export function buildSmplxForearm(
  data: SmplxForearmData,
  side: 1 | -1,
  skinMat: THREE.Material,
  cuffMat: THREE.Material,
  fit?: ForearmFit,
): { group: THREE.Group; meshes: THREE.Mesh[] } {
  if (data.format !== "cuberoot-smplx-forearm@1") {
    throw new Error(`smplx forearm: unknown format ${data.format} — re-run scripts/convert-mano.py`);
  }
  const n = data.counts.verts;
  const pos = new Float32Array(b64ToArrayBuffer(data.position));
  const nrm = new Float32Array(b64ToArrayBuffer(data.normal));
  const idx = new Uint32Array(b64ToArrayBuffer(data.index));
  const uv = new Float32Array(b64ToArrayBuffer(data.uv));
  if (pos.length !== n * 3 || nrm.length !== n * 3 || uv.length !== n * 2) {
    throw new Error("smplx forearm: buffer size mismatch");
  }
  if (side === 1) {
    // 左臂 = y 镜像(rig 前臂系 yF=z×dir,左右手世界镜像下局部 y 反号)+ 翻绕向
    for (let i = 1; i < pos.length; i += 3) {
      pos[i] *= -1;
      nrm[i] *= -1;
    }
    for (let t = 0; t < idx.length; t += 3) {
      const tmp = idx[t + 1];
      idx[t + 1] = idx[t + 2];
      idx[t + 2] = tmp;
    }
  }
  // 腕环实测(资产米制,镜像后):定缩放与对中的基准截面
  let ayMin = Infinity, ayMax = -Infinity, azMin = Infinity, azMax = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    if (Math.abs(pos[i]) > 0.005) continue;
    ayMin = Math.min(ayMin, pos[i + 1]); ayMax = Math.max(ayMax, pos[i + 1]);
    azMin = Math.min(azMin, pos[i + 2]); azMax = Math.max(azMax, pos[i + 2]);
  }
  const aHy = (ayMax - ayMin) / 2, aHz = (azMax - azMin) / 2;
  const aCy = (ayMax + ayMin) / 2, aCz = (azMax + azMin) / 2;
  // cover:两轴都够盖(取大比 +2%);tuck:两轴都藏得进(取小比 −5%)
  const s = fit
    ? (fit.mode === "cover"
      ? Math.max(fit.hy / aHy, fit.hz / aHz) * 1.02
      : Math.min(fit.hy / aHy, fit.hz / aHz) * 0.95)
    : (FOREARM_WRIST_HALF_Y_U * U) / data.wristHalfY;
  const dy = fit ? fit.cy - aCy * s : 0;
  const dz = fit ? fit.cz - aCz * s : 0;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i] * s;
    let y = pos[i + 1] * s + dy;
    let z = pos[i + 2] * s + dz;
    // tuck 模式探进段(x>0,SMPL-X 自己的掌根外扩区)向环心渐收:手模掌根
    // 轮廓与 SMPL-X 不同,不收窄会在腕后再顶穿一次
    if (fit?.mode === "tuck" && x > 0) {
      const k = Math.max(0.72, 1 - 0.012 * (x / U));
      y = fit.cy + (y - fit.cy) * k;
      z = fit.cz + (z - fit.cz) * k;
    }
    pos[i] = x; pos[i + 1] = y; pos[i + 2] = z;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  // skinMat vertexColors:true — 全白(基础肤色走烘焙 albedo,不再叠顶点色调)
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));

  const group = new THREE.Group();
  const meshes: THREE.Mesh[] = [];
  const arm = new THREE.Mesh(geo, skinMat);
  arm.name = `smplx-forearm-${side === -1 ? "right" : "left"}`;
  arm.raycast = noRaycast;
  group.add(arm);
  meshes.push(arm);

  // 袖口贴真臂截面:锚在实际肘端断口(xMin,fit 缩放后臂长会变,禁写死),
  // 长 64U 盖住断口 + 露出腕侧一段裸臂;两端 band 实测 y/z 包络 +2U 呼吸余量,
  // 椭圆度取实测 z/y 比。
  let xMin = Infinity;
  for (let i = 0; i < pos.length; i += 3) xMin = Math.min(xMin, pos[i]);
  const cuffX0 = xMin - 2 * U;            // 袖筒肘端(断口整段埋进袖内)
  const cuffLen = 64 * U;
  const measure = (x0: number, x1: number): { hy: number; hz: number; cy: number; cz: number } => {
    let yMin = Infinity, yMax = -Infinity, zMin = Infinity, zMax = -Infinity;
    for (let i = 0; i < pos.length; i += 3) {
      if (pos[i] < x0 || pos[i] > x1) continue;
      yMin = Math.min(yMin, pos[i + 1]); yMax = Math.max(yMax, pos[i + 1]);
      zMin = Math.min(zMin, pos[i + 2]); zMax = Math.max(zMax, pos[i + 2]);
    }
    if (!Number.isFinite(yMin)) return { hy: 36 * U, hz: 25 * U, cy: 0, cz: 0 };
    return { hy: (yMax - yMin) / 2, hz: (zMax - zMin) / 2, cy: (yMax + yMin) / 2, cz: (zMax + zMin) / 2 };
  };
  const wristSide = measure(cuffX0 + cuffLen - 12 * U, cuffX0 + cuffLen + 4 * U);
  const elbowSide = measure(xMin, xMin + 20 * U);
  const rTop = wristSide.hy + 2 * U;
  const rBot = elbowSide.hy + 2 * U;
  const zRatio = (Math.max(wristSide.hz, elbowSide.hz) + 2 * U) / Math.max(rTop, rBot);
  const cuffGeo = new THREE.CylinderGeometry(rTop, rBot, cuffLen, 22)
    .rotateZ(-Math.PI / 2)
    .scale(1, 1, zRatio);
  const cuff = new THREE.Mesh(cuffGeo, cuffMat);
  cuff.position.set(cuffX0 + cuffLen / 2, (wristSide.cy + elbowSide.cy) / 2, (wristSide.cz + elbowSide.cz) / 2);
  cuff.raycast = noRaycast;
  group.add(cuff);
  meshes.push(cuff);
  return { group, meshes };
}

/** SMPL-X 前臂资产加载(单文件右臂,两侧共用同一份数据各自 build)。缺失
 *  (未转换/未部署)fetch 404 → 上抛,rig 侧回退程序化前臂,不告警刷屏。 */
export async function loadSmplxForearmData(): Promise<SmplxForearmData> {
  const url = "/sim/hands/smplx/forearm.smplx.json?v=1";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`smplx forearm asset missing (${res.status} ${url}) — run scripts/convert-mano.py`);
  return (await res.json()) as SmplxForearmData;
}
