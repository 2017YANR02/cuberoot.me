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
 * 注意:MANO 无贴图 UV(转换器给的是平面投影 UV,只供程序噪声 bump 平铺),
 * 皮肤走 rig 的平色 skinMat 路径,跳过 bakeHandTextures。
 */
import * as THREE from "three";
import { adaptGltfHand } from "./handModelGltf";
import type { FingerName, HandModel } from "./handModel";

/** scripts/convert-mano.py 的输出格式。 */
export interface ManoHandData {
  format: string;
  hand: "right" | "left";
  counts: { verts: number; faces: number };
  bones: { name: string; pos: [number, number, number] }[];
  position: string; // b64 float32 (n,3)
  index: string;    // b64 uint32 (f,3)
  uv: string;       // b64 float32 (n,2)
  skinIndex: string; // b64 uint8 (n,4) — 25 骨列表内的索引
  skinWeight: string; // b64 float32 (n,4) 已归一
}

/** 拇指弯曲平面 roll(rad,MANO 绑定解剖系)。generic-hand 是 2.074;MANO
 *  模板拇指的旋前角不同,此值 = 资产到位后按「甲片落在拇指背脊线上 +
 *  curl 朝掌心收」目测/探针标定。初值 0.9 ≈ 平摊模板拇指外旋 ~50° 的解剖
 *  经验值,标定后更新(改它必须重跑 MANO home 求解)。 */
export const MANO_THUMB_ROLL = 0.9;

/** MANO 甲宽比例表(K = 背侧指尖满宽 ÷ 末节长)。初值抄 generic-hand 表;
 *  资产到位后跑探针 MEASURE_NAILK=1 实测重烘(handModelGltf.NAIL_HALFW_K
 *  注释里的标定法,换资产必须重标)。 */
export const MANO_NAIL_HALFW_K: Partial<Record<FingerName, number>> = {
  thumb: 0.50, index: 0.67, middle: 0.65, ring: 0.63, pinky: 0.48,
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
  if (data.format !== "cuberoot-mano-hand@1") {
    throw new Error(`mano hand ${label}: unknown format ${data.format} — re-run scripts/convert-mano.py`);
  }
  if ((side === -1 && data.hand !== "right") || (side === 1 && data.hand !== "left")) {
    throw new Error(`mano hand ${label}: side/hand mismatch (side ${side}, file ${data.hand})`);
  }
  const pos = new Float32Array(b64ToArrayBuffer(data.position));
  const idx = new Uint32Array(b64ToArrayBuffer(data.index));
  const uv = new Float32Array(b64ToArrayBuffer(data.uv));
  const skinIndex = new Uint8Array(b64ToArrayBuffer(data.skinIndex));
  const skinWeight = new Float32Array(b64ToArrayBuffer(data.skinWeight));
  const n = data.counts.verts;
  if (pos.length !== n * 3 || skinIndex.length !== n * 4 || skinWeight.length !== n * 4) {
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
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(Array.from(skinIndex), 4));
  geo.setAttribute("skinWeight", new THREE.BufferAttribute(skinWeight, 4));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();

  const mesh = new THREE.SkinnedMesh(geo, skinMat);
  mesh.name = `mano-${data.hand}-skin`;
  src.add(mesh);
  src.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones), mesh.matrixWorld);

  return adaptGltfHand(src, side, skinMat, label, {
    thumbRoll: MANO_THUMB_ROLL,
    nailHalfWK: MANO_NAIL_HALFW_K,
  });
}

/** 浏览器加载入口(同 loadGltfHand 语义:side=-1 → 右手)。资产 gitignored,
 *  未部署/未转换时 fetch 404 → 上抛,由 rig 侧回退 generic-hand 并告警。 */
export async function loadManoHand(side: 1 | -1, skinMat: THREE.Material): Promise<HandModel> {
  const name = side === -1 ? "right" : "left";
  const url = `/sim/hands/mano/${name}.mano.json?v=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`mano hand asset missing (${res.status} ${url}) — run scripts/convert-mano.py`);
  const data = (await res.json()) as ManoHandData;
  return buildManoHand(data, side, skinMat, `${name}.mano.json`);
}
