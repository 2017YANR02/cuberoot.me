/**
 * /sim 手部程序化皮肤贴图烘焙 — albedo / bump / roughness 三张图,运行时
 * canvas 生成零下载。做法:UV 空间光栅化 GLB 网格三角形,逐像素重心插值出
 * **手系 3D 位置 + 法线**,在 3D 域求值程序化特征 —— 值噪声在 3D 连续,
 * 对碎片化 UV 岛(实测单指末节横跨半张图)天然无缝;岛外空隙 BFS 泛洪外扩,
 * mipmap 缩级不吃黑边。左右手 UV 布局不一致(实测 max diff 0.042),两手各烘。
 *
 * 特征清单:
 *  - albedo:基础肤色(0xd9af94 同前臂平色,接缝连续)+ 双频斑驳 + 关节微暗;
 *  - bump:毛孔颗粒 + 指背关节皱纹环带(横纹×高斯包络)+ 掌侧屈痕线(凹陷);
 *  - roughness:直接画物理值(材质 roughness=1 不再乘系数),皮肤 ~0.6。
 *  血色 / 掌背明暗仍走顶点色(低频,与贴图相乘复合,见 handModelGltf
 *  bakeVertexTint),贴图只管中高频。
 *
 * 指甲不画进贴图:立体甲片(handModelGltf 蒙皮薄壳)是唯一指甲 —— 画甲与
 * 甲片曾叠成「一指三甲」(2026-07-08 用户抓的),贴图侧整体移除。
 *
 * 契约:必须在 adaptGltfHand 之后、模型入场景 / 摆 home 姿态之前调用
 * (group 无父级 = matrixWorld 即手系;骨骼在绑定姿态,关节世界位可信)。
 */
import * as THREE from "three";
import { SIZE } from "../define";
import { HAND_SCALE, type FingerName, type HandModel } from "./handModel";
import { JOINT_CHAINS } from "./handModelGltf";

const U = (SIZE / 64) * HAND_SCALE;
const FINGERS: FingerName[] = ["thumb", "index", "middle", "ring", "pinky"];

// ---------- 确定性值噪声(imul 哈希,无随机状态 —— 跨运行可复现,测试锁死) ----------

function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function vnoise3(x: number, y: number, z: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const fx = x - x0, fy = y - y0, fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
  const c00 = hash3(x0, y0, z0) + (hash3(x0 + 1, y0, z0) - hash3(x0, y0, z0)) * sx;
  const c10 = hash3(x0, y0 + 1, z0) + (hash3(x0 + 1, y0 + 1, z0) - hash3(x0, y0 + 1, z0)) * sx;
  const c01 = hash3(x0, y0, z0 + 1) + (hash3(x0 + 1, y0, z0 + 1) - hash3(x0, y0, z0 + 1)) * sx;
  const c11 = hash3(x0, y0 + 1, z0 + 1) + (hash3(x0 + 1, y0 + 1, z0 + 1) - hash3(x0, y0 + 1, z0 + 1)) * sx;
  return (c00 + (c10 - c00) * sy) * (1 - sz) + (c01 + (c11 - c01) * sy) * sz;
}

/** 双倍频值噪声,均值 ~0.5。f = 基频(1/世界单位)。 */
function fbm2(x: number, y: number, z: number, f: number): number {
  return vnoise3(x * f, y * f, z * f) * 0.65 +
    vnoise3(x * f * 2.13 + 17.7, y * f * 2.13 + 9.1, z * f * 2.13 + 31.4) * 0.35;
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

// ---------- 特征定义(烘焙前从骨骼/蒙皮一次性推导) ----------

/** 关节皱纹环带:指背横纹(cos×高斯包络)+ 可选掌侧屈痕线。 */
interface WrinkleJoint {
  px: number; py: number; pz: number;
  ax: number; ay: number; az: number; // 皱纹排布轴 ≈ 该关节处指轴
  w: number;      // 轴向包络半宽
  period: number; // 横纹周期
  amp: number;
  rad: number;    // 径向包络(限制到本指圆柱,防串到邻指)
  volar: number[]; // 掌侧屈痕线的轴向偏移(空 = 无)
  reach2: number;
}

export interface HandMapsData {
  size: number;
  albedo: Uint8ClampedArray<ArrayBuffer>; // RGBA(sRGB)
  bump: Uint8ClampedArray<ArrayBuffer>;   // RGBA 灰度
  rough: Uint8ClampedArray<ArrayBuffer>;  // RGBA 灰度(物理值)
  /** 光栅化直接覆盖的像素占比(外扩前)—— 测试判据。 */
  coverage: number;
}

/**
 * 纯计算核(Node 可测,不碰 DOM):光栅化 + 逐像素特征求值 + BFS 外扩。
 * yieldEveryTris > 0 时每 N 个三角形让出一次事件循环(浏览器主线程防长任务)。
 */
export async function computeHandMaps(model: HandModel, size: number, yieldEveryTris = 0): Promise<HandMapsData> {
  const mesh = model.meshes[0] as THREE.SkinnedMesh;
  if (!mesh.isSkinnedMesh) throw new Error("hand bake: meshes[0] is not a skinned mesh");
  model.group.updateMatrixWorld(true);
  const geo = mesh.geometry;
  const posA = geo.getAttribute("position");
  const nrmA = geo.getAttribute("normal");
  const uvA = geo.getAttribute("uv");
  const skinIndex = geo.getAttribute("skinIndex");
  const skinWeight = geo.getAttribute("skinWeight");
  const nVert = posA.count;

  // 顶点 → 手系(mesh 在 inner 对齐变换下,matrixWorld 即手系;同 bakeVertexTint)
  const toHand = mesh.matrixWorld;
  const nrmMat = new THREE.Matrix3().getNormalMatrix(toHand);
  const P = new Float32Array(nVert * 3);
  const NN = new Float32Array(nVert * 3);
  {
    const v = new THREE.Vector3();
    for (let i = 0; i < nVert; i++) {
      v.fromBufferAttribute(posA, i).applyMatrix4(toHand);
      P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
      v.fromBufferAttribute(nrmA as THREE.BufferAttribute, i).applyMatrix3(nrmMat).normalize();
      NN[i * 3] = v.x; NN[i * 3 + 1] = v.y; NN[i * 3 + 2] = v.z;
    }
  }

  // 逐顶点 dominant 骨(半径估计 / 甲背提纯用)
  const boneNames = mesh.skeleton.bones.map((b) => b.name);
  const domBone = new Int32Array(nVert);
  for (let i = 0; i < nVert; i++) {
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) {
      const w = skinWeight.getComponent(i, k);
      if (w > bw) { bw = w; best = skinIndex.getComponent(i, k); }
    }
    domBone[i] = best;
  }
  const domName = (i: number): string => boneNames[domBone[i]] ?? "";

  const jointPos = (name: string): THREE.Vector3 => {
    const o = model.group.getObjectByName(name);
    if (!o) throw new Error(`hand bake: bone ${name} missing`);
    return o.getWorldPosition(new THREE.Vector3());
  };

  /** 某骨 dominant 顶点到骨段轴的平均径向距离(手指圆柱半径估计)。 */
  const boneRadius = (bone: string, a: THREE.Vector3, b: THREE.Vector3): number => {
    const ax = b.clone().sub(a);
    const len = ax.length();
    ax.normalize();
    let sum = 0, n = 0;
    const v = new THREE.Vector3();
    for (let i = 0; i < nVert; i++) {
      if (domName(i) !== bone) continue;
      v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).sub(a);
      const s = THREE.MathUtils.clamp(v.dot(ax), 0, len);
      sum += Math.sqrt(Math.max(0, v.lengthSq() - s * s));
      n++;
    }
    return n > 0 ? sum / n : 7 * U;
  };

  // ---- 皱纹环带定义 ----
  const wrinkles: WrinkleJoint[] = [];
  const mkWrinkle = (
    p: THREE.Vector3, axis: THREE.Vector3, w: number, period: number, amp: number, rad: number, volar: number[],
  ): WrinkleJoint => {
    const reach = Math.max(2.2 * w, 3 * rad);
    return { px: p.x, py: p.y, pz: p.z, ax: axis.x, ay: axis.y, az: axis.z, w, period, amp, rad, volar, reach2: reach * reach };
  };

  for (const name of FINGERS) {
    const chain = JOINT_CHAINS[name];
    const p1 = jointPos(chain.drive[0]);
    const p2 = jointPos(chain.drive[1]);
    const p3 = jointPos(chain.drive[2]);
    const p4 = jointPos(chain.end);
    const rMid = boneRadius(chain.drive[1], p2, p3);
    const rDist = boneRadius(chain.drive[2], p3, p4);

    if (name === "thumb") {
      // 拇指链 = 掌骨/近节/末节:可见皱纹在 MCP(p2)与 IP(p3);CMC 埋在掌里。
      wrinkles.push(mkWrinkle(p2, p3.clone().sub(p1).normalize(), 5.5 * U, 2.4 * U, 0.9, rMid * 1.45, [0]));
      wrinkles.push(mkWrinkle(p3, p4.clone().sub(p2).normalize(), 4 * U, 2 * U, 0.8, rDist * 1.5, [0]));
    } else {
      const rProx = boneRadius(chain.drive[0], p1, p2);
      // MCP 指背大关节(握拳突出),PIP 双屈痕,DIP 单屈痕。
      wrinkles.push(mkWrinkle(p1, p2.clone().sub(p1).normalize(), 6.5 * U, 2.7 * U, 1.0, rProx * 1.35, []));
      wrinkles.push(mkWrinkle(p2, p3.clone().sub(p1).normalize(), 5 * U, 2.2 * U, 1.0, rMid * 1.4, [-1.2 * U, 1.2 * U]));
      wrinkles.push(mkWrinkle(p3, p4.clone().sub(p2).normalize(), 3.6 * U, 1.9 * U, 0.75, rDist * 1.5, [0]));
    }

  }

  // ---- 光栅化 ----
  const S = size;
  const albedo = new Uint8ClampedArray(S * S * 4);
  const bump = new Uint8ClampedArray(S * S * 4);
  const rough = new Uint8ClampedArray(S * S * 4);
  const mask = new Uint8Array(S * S);

  const fPore = 1 / (1.7 * U);
  const fMottle = 1 / (9.5 * U);
  const fMottle2 = 1 / (4.8 * U);

  const index = geo.getIndex();
  const triCount = (index ? index.count : nVert) / 3;
  const vIdx = (t: number, k: number): number => (index ? index.getX(t * 3 + k) : t * 3 + k);

  for (let t = 0; t < triCount; t++) {
    if (yieldEveryTris > 0 && t > 0 && t % yieldEveryTris === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
    const ia = vIdx(t, 0), ib = vIdx(t, 1), ic = vIdx(t, 2);
    // UV → 像素(GLB 约定 v=0 顶行;CanvasTexture 侧配 flipY=false 对齐)
    const xa = uvA.getX(ia) * S, ya = uvA.getY(ia) * S;
    const xb = uvA.getX(ib) * S, yb = uvA.getY(ib) * S;
    const xc = uvA.getX(ic) * S, yc = uvA.getY(ic) * S;
    const area = (xb - xa) * (yc - ya) - (xc - xa) * (yb - ya);
    if (Math.abs(area) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(xa, xb, xc)));
    const x1 = Math.min(S - 1, Math.ceil(Math.max(xa, xb, xc)));
    const y0 = Math.max(0, Math.floor(Math.min(ya, yb, yc)));
    const y1 = Math.min(S - 1, Math.ceil(Math.max(ya, yb, yc)));
    const inv = 1 / area;

    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const cx = px + 0.5, cy = py + 0.5;
        let w0 = ((xb - cx) * (yc - cy) - (xc - cx) * (yb - cy)) * inv;
        let w1 = ((xc - cx) * (ya - cy) - (xa - cx) * (yc - cy)) * inv;
        let w2 = 1 - w0 - w1;
        // 边缘余量:轻微负重心也收(细长三角形像素中心采样漏点,外扩兜底但
        // 岛内缝隙外扩不到,放宽 3% 直接堵上)
        if (w0 < -0.03 || w1 < -0.03 || w2 < -0.03) continue;
        w0 = clamp01(w0); w1 = clamp01(w1); w2 = clamp01(w2);
        const wsum = w0 + w1 + w2;
        w0 /= wsum; w1 /= wsum; w2 /= wsum;

        const hx = P[ia * 3] * w0 + P[ib * 3] * w1 + P[ic * 3] * w2;
        const hy = P[ia * 3 + 1] * w0 + P[ib * 3 + 1] * w1 + P[ic * 3 + 1] * w2;
        const hz = P[ia * 3 + 2] * w0 + P[ib * 3 + 2] * w1 + P[ic * 3 + 2] * w2;
        let nx = NN[ia * 3] * w0 + NN[ib * 3] * w1 + NN[ic * 3] * w2;
        let ny = NN[ia * 3 + 1] * w0 + NN[ib * 3 + 1] * w1 + NN[ic * 3 + 1] * w2;
        let nz = NN[ia * 3 + 2] * w0 + NN[ib * 3 + 2] * w1 + NN[ic * 3 + 2] * w2;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;

        // ===== 逐像素特征求值(全部 3D 域) =====
        const pores = fbm2(hx, hy, hz, fPore);
        const mottle = fbm2(hx, hy, hz, fMottle);
        const mott2 = vnoise3(hx * fMottle2 + 71.3, hy * fMottle2 + 13.9, hz * fMottle2 + 47.1);

        // 基础肤色(sRGB;0xd9af94 = (0.851,0.686,0.580),同前臂平色接缝连续)
        const mv = 1 + (mottle - 0.5) * 0.11;
        let r = 0.851 * mv * (1 + (mott2 - 0.5) * 0.03);
        let g = 0.686 * mv * (1 - (mott2 - 0.5) * 0.06);
        let b = 0.580 * mv * (1 - (mott2 - 0.5) * 0.10);
        let bmp = 0.5 + (pores - 0.5) * 0.22;
        let rgh = 0.585 + (pores - 0.5) * 0.13 + (mottle - 0.5) * 0.07;

        const dm = clamp01((-nz - 0.15) / 0.5); // 指背/手背
        const pm = clamp01((nz - 0.15) / 0.5);  // 掌侧

        // ---- 关节皱纹环带 + 掌侧屈痕 ----
        for (const wj of wrinkles) {
          const dwx = hx - wj.px, dwy = hy - wj.py, dwz = hz - wj.pz;
          const d2 = dwx * dwx + dwy * dwy + dwz * dwz;
          if (d2 > wj.reach2) continue;
          const s = dwx * wj.ax + dwy * wj.ay + dwz * wj.az;
          const rad2 = Math.max(0, d2 - s * s);
          const radFall = Math.exp(-rad2 / (wj.rad * wj.rad * 1.8));
          if (radFall < 0.02) continue;
          if (dm > 0) {
            const axFall = Math.exp(-(s * s) / (wj.w * wj.w));
            if (axFall > 0.02) {
              const wr = Math.cos((s * Math.PI * 2) / wj.period + (pores - 0.5) * 2.5) * axFall * radFall * dm * wj.amp;
              bmp += wr * 0.09;
              const dk = Math.max(0, -wr) * 0.045;
              r *= 1 - dk; g *= 1 - dk * 1.3; b *= 1 - dk * 1.4;
              rgh += Math.abs(wr) * 0.05;
              // 关节区整体微暗微糙(皮肤增厚)
              rgh += axFall * radFall * dm * 0.04;
              g *= 1 - axFall * radFall * dm * 0.02;
            }
          }
          if (pm > 0 && wj.volar.length > 0) {
            for (const ofs of wj.volar) {
              const ds = s - ofs;
              const line = Math.exp(-(ds * ds) / (0.6 * U * 0.6 * U)) * radFall * pm;
              if (line < 0.02) continue;
              bmp -= line * 0.16;
              r *= 1 - line * 0.05; g *= 1 - line * 0.11; b *= 1 - line * 0.13;
              rgh += line * 0.06;
            }
          }
        }

        const o = (py * S + px) * 4;
        albedo[o] = clamp01(r) * 255; albedo[o + 1] = clamp01(g) * 255; albedo[o + 2] = clamp01(b) * 255; albedo[o + 3] = 255;
        const bb = clamp01(bmp) * 255;
        bump[o] = bb; bump[o + 1] = bb; bump[o + 2] = bb; bump[o + 3] = 255;
        const rr = clamp01(rgh) * 255;
        rough[o] = rr; rough[o + 1] = rr; rough[o + 2] = rr; rough[o + 3] = 255;
        mask[py * S + px] = 1;
      }
    }
  }

  const coverage = floodFillMaps(S, mask, [albedo, bump, rough]);

  return { size: S, albedo, bump, rough, coverage };
}

/** BFS 泛洪外扩:空像素从最近的已覆盖像素复制(多源 BFS ≈ 最近传播),填满
 *  全图 —— mipmap 任意缩级都采不到黑边。返回外扩前覆盖率。 */
function floodFillMaps(S: number, mask: Uint8Array, arrs: Uint8ClampedArray[]): number {
  let seedCount = 0;
  const queue = new Int32Array(S * S);
  let head = 0, tail = 0;
  for (let i = 0; i < S * S; i++) {
    if (mask[i]) { queue[tail++] = i; seedCount++; }
  }
  while (head < tail) {
    const cur = queue[head++];
    const cx = cur % S, cy = (cur / S) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const qx = cx + dx, qy = cy + dy;
        if (qx < 0 || qx >= S || qy < 0 || qy >= S) continue;
        const ni = qy * S + qx;
        if (mask[ni]) continue;
        mask[ni] = 1;
        const src = cur * 4, dst = ni * 4;
        for (const arr of arrs) {
          for (let k = 0; k < 4; k++) arr[dst + k] = arr[src + k];
        }
        queue[tail++] = ni;
      }
    }
  }
  return seedCount / (S * S);
}

/** 非蒙皮肢体件(前臂)皮肤烘焙纯计算核:同款基础肤色 / 斑驳 / 毛孔公式在
 *  几何局部系求值(无皱纹 / 指甲特征)。几何与手同按 U 建模,噪声频率一致,
 *  腕缝两侧肤质颗粒 / 色斑统计连续。 */
export function computeLimbMaps(geo: THREE.BufferGeometry, size: number): {
  albedo: Uint8ClampedArray<ArrayBuffer>;
  bump: Uint8ClampedArray<ArrayBuffer>;
  rough: Uint8ClampedArray<ArrayBuffer>;
} {
  const posA = geo.getAttribute("position");
  const uvA = geo.getAttribute("uv");
  const S = size;
  const albedo = new Uint8ClampedArray(S * S * 4);
  const bump = new Uint8ClampedArray(S * S * 4);
  const rough = new Uint8ClampedArray(S * S * 4);
  const mask = new Uint8Array(S * S);

  const fPore = 1 / (1.7 * U);
  const fMottle = 1 / (9.5 * U);
  const fMottle2 = 1 / (4.8 * U);

  const index = geo.getIndex();
  const triCount = (index ? index.count : posA.count) / 3;
  const vIdx = (t: number, k: number): number => (index ? index.getX(t * 3 + k) : t * 3 + k);

  for (let t = 0; t < triCount; t++) {
    const ia = vIdx(t, 0), ib = vIdx(t, 1), ic = vIdx(t, 2);
    const xa = uvA.getX(ia) * S, ya = uvA.getY(ia) * S;
    const xb = uvA.getX(ib) * S, yb = uvA.getY(ib) * S;
    const xc = uvA.getX(ic) * S, yc = uvA.getY(ic) * S;
    const area = (xb - xa) * (yc - ya) - (xc - xa) * (yb - ya);
    if (Math.abs(area) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(xa, xb, xc)));
    const x1 = Math.min(S - 1, Math.ceil(Math.max(xa, xb, xc)));
    const y0 = Math.max(0, Math.floor(Math.min(ya, yb, yc)));
    const y1 = Math.min(S - 1, Math.ceil(Math.max(ya, yb, yc)));
    const inv = 1 / area;

    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const cx = px + 0.5, cy = py + 0.5;
        let w0 = ((xb - cx) * (yc - cy) - (xc - cx) * (yb - cy)) * inv;
        let w1 = ((xc - cx) * (ya - cy) - (xa - cx) * (yc - cy)) * inv;
        let w2 = 1 - w0 - w1;
        if (w0 < -0.03 || w1 < -0.03 || w2 < -0.03) continue;
        w0 = clamp01(w0); w1 = clamp01(w1); w2 = clamp01(w2);
        const wsum = w0 + w1 + w2;
        w0 /= wsum; w1 /= wsum; w2 /= wsum;

        const hx = posA.getX(ia) * w0 + posA.getX(ib) * w1 + posA.getX(ic) * w2;
        const hy = posA.getY(ia) * w0 + posA.getY(ib) * w1 + posA.getY(ic) * w2;
        const hz = posA.getZ(ia) * w0 + posA.getZ(ib) * w1 + posA.getZ(ic) * w2;

        const pores = fbm2(hx, hy, hz, fPore);
        const mottle = fbm2(hx, hy, hz, fMottle);
        const mott2 = vnoise3(hx * fMottle2 + 71.3, hy * fMottle2 + 13.9, hz * fMottle2 + 47.1);

        const mv = 1 + (mottle - 0.5) * 0.11;
        const r = 0.851 * mv * (1 + (mott2 - 0.5) * 0.03);
        const g = 0.686 * mv * (1 - (mott2 - 0.5) * 0.06);
        const b = 0.580 * mv * (1 - (mott2 - 0.5) * 0.10);
        const bmp = 0.5 + (pores - 0.5) * 0.22;
        const rgh = 0.585 + (pores - 0.5) * 0.13 + (mottle - 0.5) * 0.07;

        const o = (py * S + px) * 4;
        albedo[o] = clamp01(r) * 255; albedo[o + 1] = clamp01(g) * 255; albedo[o + 2] = clamp01(b) * 255; albedo[o + 3] = 255;
        const bb = clamp01(bmp) * 255;
        bump[o] = bb; bump[o + 1] = bb; bump[o + 2] = bb; bump[o + 3] = 255;
        const rr = clamp01(rgh) * 255;
        rough[o] = rr; rough[o + 1] = rr; rough[o + 2] = rr; rough[o + 3] = 255;
        mask[py * S + px] = 1;
      }
    }
  }

  floodFillMaps(S, mask, [albedo, bump, rough]);
  return { albedo, bump, rough };
}

export interface HandBakedMaps {
  albedo: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
  rough: THREE.CanvasTexture;
}

function dataToTexture(arr: Uint8ClampedArray<ArrayBuffer>, size: number, srgb: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("hand bake: 2d context unavailable");
  ctx.putImageData(new ImageData(arr, size, size), 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 浏览器包装:计算 → canvas → CanvasTexture(flipY=false 对齐 GLB UV 约定)。 */
export async function bakeHandTextures(model: HandModel, size = 1024): Promise<HandBakedMaps> {
  // 实测 1024² 全手 ~0.9s:120 tris/片 ≈ 45ms,让出事件循环不卡长任务。
  const data = await computeHandMaps(model, size, 120);
  return { albedo: dataToTexture(data.albedo, size, true), bump: dataToTexture(data.bump, size, false), rough: dataToTexture(data.rough, size, false) };
}

/** 前臂浏览器包装:几何轻(lathe 48 tris)特征轻(无皱纹/甲),同步烘完。 */
export function bakeLimbTextures(geo: THREE.BufferGeometry, size = 512): HandBakedMaps {
  const data = computeLimbMaps(geo, size);
  return { albedo: dataToTexture(data.albedo, size, true), bump: dataToTexture(data.bump, size, false), rough: dataToTexture(data.rough, size, false) };
}
