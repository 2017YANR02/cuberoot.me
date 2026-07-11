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
import { adaptGltfHand } from "./handModelGltf";
import { type FingerName, type HandModel } from "./handModel";

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
  /** @4:融合前臂的绑定臂伸向(腕→肘,资产空间单位向量;左手已镜像)。 */
  forearmDir: [number, number, number];
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
  if (data.format !== "cuberoot-mano-hand@4") {
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
    forearmDirAsset: data.forearmDir,
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

/** 浏览器加载入口(side=-1 → 右手)。资产 gitignored,
 *  未部署/未转换时 fetch 404 → 上抛,由 rig 侧回退 generic-hand 并告警。 */
export async function loadManoHand(side: 1 | -1, skinMat: THREE.Material): Promise<HandModel> {
  const name = side === -1 ? "right" : "left";
  const url = `/sim/hands/mano/${name}.mano.json?v=4`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`mano hand asset missing (${res.status} ${url}) — run scripts/convert-mano.py`);
  const data = (await res.json()) as ManoHandData;
  return buildManoHand(data, side, skinMat, `${name}.mano.json`);
}

// ---------------------------------------------------------------- SMPL-X 全身(调试查看)

/** convert-mano.py 附带导出的 SMPL-X neutral 全身(米制 T-pose 原样,零变形;
 *  y-up 面朝 +z)。调试开关「SMPL-X 全身」专用 —— 手/前臂比例的上游真值参照。 */
interface SmplxFullBodyData {
  format: string;
  counts: { verts: number; faces: number };
  position: string; // b64 float32 (n,3) 米
  normal: string;   // b64 float32 (n,3)
  index: string;    // b64 uint32 (f,3)
  heightM: number;  // 全身高(米)—— world 侧按它定等比缩放
}

/** 全身资产加载 + 组装几何(米制;缩放由调用方决定)。缺失 404 → 上抛。 */
export async function loadSmplxFullBody(): Promise<{ geometry: THREE.BufferGeometry; heightM: number }> {
  const url = "/sim/hands/smplx/fullbody.smplx.json?v=1";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`smplx fullbody asset missing (${res.status} ${url}) — run scripts/convert-mano.py`);
  const data = (await res.json()) as SmplxFullBodyData;
  if (data.format !== "cuberoot-smplx-fullbody@1") {
    throw new Error(`smplx fullbody: unknown format ${data.format} — re-run scripts/convert-mano.py`);
  }
  const n = data.counts.verts;
  const pos = new Float32Array(b64ToArrayBuffer(data.position));
  const nrm = new Float32Array(b64ToArrayBuffer(data.normal));
  const idx = new Uint32Array(b64ToArrayBuffer(data.index));
  if (pos.length !== n * 3 || nrm.length !== n * 3) throw new Error("smplx fullbody: buffer size mismatch");
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return { geometry: geo, heightM: data.heightM };
}
