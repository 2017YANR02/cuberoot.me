/**
 * SMPL-X 单网格全身傀儡层(onepiece@1,「一体根治」2026-07-12)。
 *
 * 资产 = convert-mano.py 的 onepiece.smplx.json:SMPL-X 全身在双腕平面切掉
 * 自带低模手,zip 缝进两只 MANO 手(左 = 镜像右)再整体 Loop 细分一步 ——
 * 肘/臂/腕/手是**同一块水密网格、一条蒙皮**。旧 bodyrig@2 两件套(体切臂 +
 * 手管中前臂对接)的沙漏台阶 = 手管 k 缩放 × 双重细分环缩 × 1.5mm 防穿内缩
 * 三重直径失配,参数不可救;「接缝」这个问题类别只能构造性消灭(与 @4 手资产
 * 腕缝根治同一配方,推广到全身;2026-07-12 用户抓的)。
 *
 * 驱动 = 傀儡:活手资产(姿态通道 / 求解探针 / 甲片 / 皮肤烘焙,27 轮打磨)
 * 照常运转但皮肤网格隐藏;本网格 2×16 根手骨(腕 + 15 指关节)每帧解析写
 * 世界矩阵:
 *     H_j = (MP·BMI_p)⁻¹ · (ML·BMI_l) · G_j · K_j
 *     K_j = GI_j · BM_l · T · BM_p⁻¹ · HI_j⁻¹        (常量,构造期一次预算)
 * 其中 MP/ML = 傀儡/活手 mesh.matrixWorld,BM 与 BMI = bindMatrix 及其逆,
 * G/H = 活/傀儡骨 matrixWorld,GI/HI = boneInverses,T = 体空间 → 活手资产
 * 空间的相似映射
 * (x_asset = k·M·(x_body − wj) + wA,转换器导出)。把 H_j 代回 three 蒙皮方程
 * meshWorld·BMI·Σw(boneWorld·boneInv)·BM·x 即得:**傀儡手区表面与活手表面在
 * 世界系逐点重合** —— MANO 零位与 SMPL-X 集成手的绑定姿态差(实测 19~29mm)、
 * 比例差 k 全部被常量吸收,零标定零漂移。手骨平铺挂 identity holder(骨间
 * 无层级),直接写 bone.matrix 即世界矩阵,免逐骨分解。
 *
 * 体侧沿用 bodyrig 时代的运动模型:躯干/头/腿静态站姿(T-pose 即站立 + 颈/头
 * 低头常量),place() home 姿一次落位,每帧 updateArm 解析焊臂(推导见该方法
 * 注释)。腕骨被活手接管后,前臂扭转由蒙皮在肘↔腕权重间自然分布 —— 比旧版
 * 「腕骨恒等、残段随肘刚体」更接近真前臂旋前。
 *
 * posedirs(对掌鱼际隆起 / 关节鼓包)在手区同源移植(转换器已把位移场映到体
 * 空间,系数仍由活手骨局部旋转驱动);顶点血色 / 掌背明暗同源(β 沿臂淡出);
 * 全身贴图 bakeTextures() 异步烘(基肤噪声在右手系全局单场求值 —— 全网格
 * 连续无拼接线;双手皱纹各在其手系域求值),烘完热替换材质,烘前平色可用。
 *
 * 缩放:共用手资产 unitScale(HandModel.unitScale 教训:各自拟合比例会
 * 手/臂/体粗细失配)。
 */
import * as THREE from "three";
import { staticUrl } from "@/lib/stats-base";
import { SIZE } from "../define";
import { HAND_SCALE, WRIST_LOCAL, type HandModel } from "./handModel";
import { MANO_JOINT_BONES, manoPoseCoeffs } from "./handModelMano";
import { boneBloodScore } from "./handModelGltf";
import { bakeBodyTextures, type HandBakedMaps, type WrinkleJoint } from "./bakeHandTexture";

const U = (SIZE / 64) * HAND_SCALE;

interface OnePieceHandMeta {
  /** 体空间 → 该侧活手资产空间:x_asset = k·M·(x_body − wristBody) + wristAsset
   *  (M 行主序 3×3 = Rm·Xᵀ,纯旋转)。 */
  map: { M: number[][]; k: number; wristBody: number[]; wristAsset: number[] };
  /** 55 骨列表内该侧手骨下标,MANO kintree 序 = MANO_JOINT_BONES 同序
   *  ([腕, index1..3, middle1..3, pinky1..3, ring1..3, thumb1..3])。 */
  jointIdx: number[];
  /** 稀疏姿态修正:idx = 非零行(uv 复制后顶点域),q int8 (m,3,135),scale 逐系数。 */
  posedirs: { idx: string; q: string; scale: string; count: number };
}

export interface SmplxOnePieceData {
  format: string;
  counts: { verts: number; faces: number; joints: number };
  position: string;   // b64 float32 (n,3) 米(体空间)
  normal: string;
  uv: string;         // b64 float32 (n,2) box_unwrap 无重叠图集
  index: string;      // b64 uint32 (f,3)
  joints: string;     // b64 float32 (55,3) SMPL-X 原生绑定位
  parents: number[];
  skinIndex: string;  // b64 uint8 (n,4)
  skinWeight: string; // b64 float32 (n,4)
  named: Record<string, number>;
  hands: { right: OnePieceHandMeta; left: OnePieceHandMeta };
  heightM: number;
}

function b64ToArrayBuffer(s: string): ArrayBuffer {
  if (typeof atob === "function") {
    const bin = atob(s);
    const buf = new ArrayBuffer(bin.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
    return buf;
  }
  // Node(_body_probe 探针路径)
  const buf = Buffer.from(s, "base64");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

export async function loadSmplxOnePiece(): Promise<SmplxOnePieceData> {
  const url = staticUrl("/sim/hands/smplx/onepiece.smplx.json") + "?v=1";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`smplx onepiece asset missing (${res.status} ${url}) — run scripts/convert-mano.py`);
  const data = (await res.json()) as SmplxOnePieceData;
  if (data.format !== "cuberoot-smplx-onepiece@1") {
    throw new Error(`smplx onepiece: unknown format ${data.format} — re-run scripts/convert-mano.py`);
  }
  return data;
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _m3 = new THREE.Matrix4();
/** 体组朝向 Ry(π)(π 旋转自逆,同时充当其逆)。 */
const _RY_PI = new THREE.Quaternion(0, 1, 0, 0);

const sstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

interface SideSync {
  live: HandModel;
  liveMesh: THREE.SkinnedMesh;
  liveBones: THREE.Object3D[];   // 16,MANO_JOINT_BONES 序
  K: THREE.Matrix4[];            // 16 常量
  bones: THREE.Bone[];           // 16 傀儡骨(holder 平铺)
  // 稀疏姿态修正
  pdIdx: Uint32Array;
  pdT: Float32Array;             // (135, m·3) 反量化转置
  base: Float32Array;            // (m·3) 绑定位快照
  tmp: Float32Array;
  c: Float32Array;               // 135 系数
  cLast: Float32Array;
}

export class SmplxBody extends THREE.Group {
  readonly mat: THREE.MeshStandardMaterial;
  readonly mesh: THREE.SkinnedMesh;
  private readonly bones: THREE.Bone[] = [];
  private readonly named: Record<string, number>;
  private readonly k: number;                // 米 → rig(= 手资产 unitScale)
  /** 每侧臂绑定量(米/体局部),语义同 bodyrig 时代(见 updateArm)。 */
  private readonly arm: Record<"R" | "L", {
    shoulder: THREE.Bone; elbow: THREE.Bone;
    l1: number; l2: number; d0Up: THREE.Vector3;
    Js: THREE.Vector3; wOff: THREE.Vector3; qXInv: THREE.Quaternion;
  }>;
  private readonly sync: Record<"R" | "L", SideSync>;
  /** 体空间 → 各侧手系(= relLive·T;顶点血色 + 全身烘焙共用)。 */
  private readonly toFrame: Record<"R" | "L", THREE.Matrix4>;
  private baked: HandBakedMaps | null = null;
  private baking = false;

  constructor(data: SmplxOnePieceData, hands: { R: HandModel; L: HandModel }, skin?: THREE.Material) {
    super();
    this.k = hands.R.unitScale;
    this.named = data.named;
    const n = data.counts.verts;
    const pos = new Float32Array(b64ToArrayBuffer(data.position));
    const nrm = new Float32Array(b64ToArrayBuffer(data.normal));
    const uv = new Float32Array(b64ToArrayBuffer(data.uv));
    const idx = new Uint32Array(b64ToArrayBuffer(data.index));
    const si = new Uint8Array(b64ToArrayBuffer(data.skinIndex));
    const sw = new Float32Array(b64ToArrayBuffer(data.skinWeight));
    const J = new Float32Array(b64ToArrayBuffer(data.joints));
    if (pos.length !== n * 3 || uv.length !== n * 2 || si.length !== n * 4 || sw.length !== n * 4) {
      throw new Error("smplx onepiece: buffer size mismatch");
    }

    // 骨架:体骨 = 层级链(局部位 = J[i]−J[parent],绑定旋转恒等 —— tick 的
    // 姿态代数依赖这一点);手骨 = identity holder 平铺 + matrixAutoUpdate
    // 关闭,bone.matrix 即「mesh 局部系世界矩阵」,syncHands 直写免分解。
    const metaBySide = { R: data.hands.right, L: data.hands.left };
    const handSet = new Set<number>([...metaBySide.R.jointIdx, ...metaBySide.L.jointIdx]);
    const holder = new THREE.Group();
    holder.name = "onepiece-hand-bones";
    for (let i = 0; i < data.counts.joints; i++) {
      const b = new THREE.Bone();
      const p = data.parents[i];
      if (handSet.has(i)) {
        b.matrixAutoUpdate = false;
        b.matrix.makeTranslation(J[i * 3], J[i * 3 + 1], J[i * 3 + 2]);
        holder.add(b);
      } else {
        b.position.set(
          J[i * 3] - (p >= 0 ? J[p * 3] : 0),
          J[i * 3 + 1] - (p >= 0 ? J[p * 3 + 1] : 0),
          J[i * 3 + 2] - (p >= 0 ? J[p * 3 + 2] : 0),
        );
        if (p >= 0 && !handSet.has(p)) this.bones[p].add(b);
      }
      this.bones.push(b);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(Array.from(si), 4));
    geo.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));

    // 材质:克隆手部平色皮肤材质(肤色/sheen 标量同源)。onepiece 带 UV 图集
    // 与顶点色(下方烘),vertexColors 保留;贴图先剥(噪声细节图纹素密度对
    // 不上图集),bakeTextures() 烘完全身三图后热替换。
    if (skin) {
      const m = skin.clone() as THREE.MeshStandardMaterial;
      m.map = m.bumpMap = m.roughnessMap = m.normalMap = null;
      m.vertexColors = true;
      m.roughness = 0.6; // skinMat 0.85 是 roughnessMap 乘数(实效 ~0.56),无贴图侧手动对齐
      this.mat = m;
    } else {
      this.mat = new THREE.MeshPhysicalMaterial({ color: 0xd9af94, roughness: 0.75, metalness: 0, vertexColors: true });
    }
    this.mat.transparent = false;
    this.mat.opacity = 1;
    const mesh = new THREE.SkinnedMesh(geo, this.mat);
    mesh.raycast = () => { /* 不可拾取 */ };
    mesh.frustumCulled = false; // 蒙皮包围球不含姿态,大网格禁剔除防闪没
    mesh.add(this.bones[0]);
    mesh.add(holder);
    this.mesh = mesh;
    this.add(mesh);
    this.scale.setScalar(this.k); // 几何/骨保持米制,组级缩放进 rig 单位
    // 面向:资产 T-pose 面朝 +z,这套握姿是第一人称 → 身体站镜头侧、背对镜头
    // 面向魔方(Ry(π));近景 = 过肩第一人称,拉远 = 看到完整的人。
    this.quaternion.setFromAxisAngle(_v1.set(0, 1, 0), Math.PI);
    // 绑定必须在骨世界矩阵刷新之后(Skeleton 用 bone.matrixWorld 求 boneInverses)
    this.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(this.bones));
    // 真·绑定矩阵快照(K_j 常量用)。注意 three 的 attached 蒙皮模式下
    // bindMatrixInverse 每帧被重写成「当前 matrixWorld⁻¹」(网格自身变换在
    // 蒙皮链里自消),只有 bindMatrix 保持绑定期值 —— 快照必须取自后者。
    const bindMatrixPInv = mesh.bindMatrix.clone().invert();
    const handBindWorld = new Map<number, THREE.Matrix4>();
    for (const i of handSet) handBindWorld.set(i, this.bones[i].matrixWorld.clone());

    const jv = (i: number, out: THREE.Vector3): THREE.Vector3 =>
      out.set(J[i * 3], J[i * 3 + 1], J[i * 3 + 2]);
    const N = this.named;
    const mk = (side: "R" | "L") => {
      const s = side === "R" ? "right" : "left";
      const sIdx = N[`${s}_shoulder`], eIdx = N[`${s}_elbow`], wIdx = N[`${s}_wrist`];
      const S = jv(sIdx, new THREE.Vector3()), E = jv(eIdx, new THREE.Vector3()), W = jv(wIdx, new THREE.Vector3());
      // 前臂绑定基 X(与转换器 fuse/onepiece 同 recipe):x=肘→腕,z=掌法向
      // (index1/pinky1 叉积,左侧换序保右手系)。关节位用 SMPL-X 原生绑定位
      // (转换器导出的就是原生 Jx),与转换期构造 M = Rm·Xᵀ 的 X 逐位一致。
      const x0 = W.clone().sub(E).normalize();
      const I = jv(N[`${s}_index1`], new THREE.Vector3()).sub(W);
      const P = jv(N[`${s}_pinky1`], new THREE.Vector3()).sub(W);
      const z0 = side === "R" ? I.clone().cross(P) : P.clone().cross(I);
      z0.addScaledVector(x0, -z0.dot(x0)).normalize();
      const y0 = z0.clone().cross(x0);
      const qXInv = new THREE.Quaternion()
        .setFromRotationMatrix(_m1.makeBasis(x0, y0, z0))
        .invert();
      return {
        shoulder: this.bones[sIdx], elbow: this.bones[eIdx],
        l1: E.distanceTo(S), l2: W.distanceTo(E),
        d0Up: E.clone().sub(S).normalize(),
        Js: S.clone(), wOff: W.clone().sub(E), qXInv,
      };
    };
    this.arm = { R: mk("R"), L: mk("L") };

    // 颈/头:低头看魔方的常量(体局部系;+ 才是低头,− 是仰头实测)。
    this.bones[N.neck]?.quaternion.setFromAxisAngle(_v1.set(1, 0, 0), 0.3);
    this.bones[N.head]?.quaternion.setFromAxisAngle(_v1.set(1, 0, 0), 0.15);

    // ---- 傀儡同步预算(每侧 16 骨常量 K_j + 稀疏 posedirs 解码) ----
    const mkSync = (side: "R" | "L"): SideSync => {
      const meta = metaBySide[side];
      const live = hands[side];
      const liveMesh = live.meshes[0] as THREE.SkinnedMesh;
      if (!liveMesh.isSkinnedMesh) throw new Error("smplx onepiece: live hand mesh is not skinned");
      const liveBones = MANO_JOINT_BONES.map((nm) => {
        const o = live.group.getObjectByName(nm);
        if (!o) throw new Error(`smplx onepiece: live bone ${nm} missing`);
        return o;
      });
      // T:体空间 → 活手资产空间(x_asset = k·M·(x_body − wj) + wA)
      const mm = meta.map;
      const kM = mm.M;
      const kk = mm.k;
      const T = new THREE.Matrix4();
      const tx = mm.wristAsset[0] - kk * (kM[0][0] * mm.wristBody[0] + kM[0][1] * mm.wristBody[1] + kM[0][2] * mm.wristBody[2]);
      const ty = mm.wristAsset[1] - kk * (kM[1][0] * mm.wristBody[0] + kM[1][1] * mm.wristBody[1] + kM[1][2] * mm.wristBody[2]);
      const tz = mm.wristAsset[2] - kk * (kM[2][0] * mm.wristBody[0] + kM[2][1] * mm.wristBody[1] + kM[2][2] * mm.wristBody[2]);
      T.set(
        kk * kM[0][0], kk * kM[0][1], kk * kM[0][2], tx,
        kk * kM[1][0], kk * kM[1][1], kk * kM[1][2], ty,
        kk * kM[2][0], kk * kM[2][1], kk * kM[2][2], tz,
        0, 0, 0, 1,
      );
      // K_j = GI_j·BM_l·T·BM_p⁻¹·HI_j⁻¹
      const K: THREE.Matrix4[] = [];
      const bones16: THREE.Bone[] = [];
      for (let j = 0; j < 16; j++) {
        const lb = liveBones[j] as THREE.Bone;
        const bi = liveMesh.skeleton.bones.indexOf(lb);
        if (bi < 0) throw new Error(`smplx onepiece: live bone ${MANO_JOINT_BONES[j]} not in skeleton`);
        const gi = liveMesh.skeleton.boneInverses[bi];
        const hiInv = handBindWorld.get(meta.jointIdx[j]);
        if (!hiInv) throw new Error("smplx onepiece: hand bind world missing");
        K.push(new THREE.Matrix4().copy(gi).multiply(liveMesh.bindMatrix).multiply(T).multiply(bindMatrixPInv).multiply(hiInv));
        bones16.push(this.bones[meta.jointIdx[j]]);
      }
      // 稀疏 posedirs(体空间位移场;系数由活手骨局部旋转驱动,与活手同源)
      const pdIdx = new Uint32Array(b64ToArrayBuffer(meta.posedirs.idx));
      const q8 = new Int8Array(b64ToArrayBuffer(meta.posedirs.q));
      const scale = new Float32Array(b64ToArrayBuffer(meta.posedirs.scale));
      const m = meta.posedirs.count;
      if (pdIdx.length !== m || q8.length !== m * 3 * 135 || scale.length !== 135) {
        throw new Error("smplx onepiece: posedirs buffer mismatch");
      }
      const m3 = m * 3;
      const pdT = new Float32Array(135 * m3);
      for (let i = 0; i < m3; i++) {
        for (let c = 0; c < 135; c++) pdT[c * m3 + i] = q8[i * 135 + c] * scale[c];
      }
      const base = new Float32Array(m3);
      for (let vi = 0; vi < m; vi++) {
        base[vi * 3] = pos[pdIdx[vi] * 3];
        base[vi * 3 + 1] = pos[pdIdx[vi] * 3 + 1];
        base[vi * 3 + 2] = pos[pdIdx[vi] * 3 + 2];
      }
      return {
        live, liveMesh, liveBones, K, bones: bones16,
        pdIdx, pdT, base, tmp: new Float32Array(m3),
        c: new Float32Array(135), cLast: new Float32Array(135).fill(NaN),
      };
    };
    this.sync = { R: mkSync("R"), L: mkSync("L") };

    // 体空间 → 手系(relLive = 活手组⁻¹·活手网格,静态相对变换,与当前摆姿
    // 无关):顶点血色的掌背分区 + 全身烘焙的特征域映射共用。
    const mkFrame = (side: "R" | "L"): THREE.Matrix4 => {
      const live = hands[side];
      live.group.updateMatrixWorld(true);
      const liveMesh = live.meshes[0];
      const rel = live.group.matrixWorld.clone().invert().multiply(liveMesh.matrixWorld);
      // T 已在 mkSync 里建过 — 重建一次(构造期一次性,避免存中间量)
      const mm = metaBySide[side].map;
      const kM = mm.M;
      const kk2 = mm.k;
      const T2 = new THREE.Matrix4().set(
        kk2 * kM[0][0], kk2 * kM[0][1], kk2 * kM[0][2], mm.wristAsset[0] - kk2 * (kM[0][0] * mm.wristBody[0] + kM[0][1] * mm.wristBody[1] + kM[0][2] * mm.wristBody[2]),
        kk2 * kM[1][0], kk2 * kM[1][1], kk2 * kM[1][2], mm.wristAsset[1] - kk2 * (kM[1][0] * mm.wristBody[0] + kM[1][1] * mm.wristBody[1] + kM[1][2] * mm.wristBody[2]),
        kk2 * kM[2][0], kk2 * kM[2][1], kk2 * kM[2][2], mm.wristAsset[2] - kk2 * (kM[2][0] * mm.wristBody[0] + kM[2][1] * mm.wristBody[1] + kM[2][2] * mm.wristBody[2]),
        0, 0, 0, 1,
      );
      return rel.multiply(T2);
    };
    this.toFrame = { R: mkFrame("R"), L: mkFrame("L") };

    // ---- 顶点血色 / 掌背明暗(活手 bakeVertexTint 同源;β 沿臂向肘淡出到
    //      中性,躯干 = 中性 —— 权重与几何都连续,不存在色阶线) ----
    {
      const scores = new Float32Array(data.counts.joints);
      for (const side of ["R", "L"] as const) {
        metaBySide[side].jointIdx.forEach((ji, i2) => { scores[ji] = boneBloodScore(MANO_JOINT_BONES[i2]); });
      }
      const wR = metaBySide.R.map.wristBody;
      const wL = metaBySide.L.map.wristBody;
      const colors = new Float32Array(n * 3);
      const bx0 = WRIST_LOCAL.x - 46 * U;
      const bx1 = WRIST_LOCAL.x - 10 * U;
      const p = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        let f = 0;
        for (let c = 0; c < 4; c++) f += scores[si[i * 4 + c]] * sw[i * 4 + c];
        f = Math.min(1, f * 1.2);
        const dR = (pos[i * 3] - wR[0]) ** 2 + (pos[i * 3 + 1] - wR[1]) ** 2 + (pos[i * 3 + 2] - wR[2]) ** 2;
        const dL = (pos[i * 3] - wL[0]) ** 2 + (pos[i * 3 + 1] - wL[1]) ** 2 + (pos[i * 3 + 2] - wL[2]) ** 2;
        p.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(this.toFrame[dR <= dL ? "R" : "L"]);
        const beta = sstep(bx0, bx1, p.x);
        const palm = Math.min(1, Math.max(0, p.z / (12 * U) + 0.5));
        const palmB = 0.5 + (palm - 0.5) * beta;
        const base = 0.94 + 0.06 * palmB;
        colors[i * 3] = Math.min(1, base + 0.06);
        colors[i * 3 + 1] = base * (1 - 0.09 * f);
        colors[i * 3 + 2] = base * (1 - 0.14 * f);
      }
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    }
  }

  /** 身体前臂全长(rig 单位)—— place 的肘目标 = 腕 + 臂轴向 × 此值。 */
  foreLen(side: "R" | "L"): number {
    return this.arm[side].l2 * this.k;
  }

  /** home 姿一次放置:给定两侧肘目标(rig 局部),肩取肘「上 + 镜头侧(+z,
   *  身体在肘后方背对镜头)」30° 落位 —— 魔方落在人的胸口高度;反推组平移。 */
  place(elbowR: THREE.Vector3, elbowL: THREE.Vector3): void {
    const a = Math.PI * (30 / 180);
    const off = _v1.set(0, Math.sin(a), Math.cos(a));
    const p = _v2.set(0, 0, 0);
    for (const [side, e] of [["R", elbowR], ["L", elbowL]] as const) {
      const arm = this.arm[side];
      const S = _v3.copy(e).addScaledVector(off, arm.l1 * this.k); // 期望肩位(rig)
      // P = S − Ry(π)·J_shoulder·k
      S.x += arm.Js.x * this.k;
      S.y -= arm.Js.y * this.k;
      S.z += arm.Js.z * this.k;
      p.addScaledVector(S, 0.5);
    }
    this.position.copy(p);
    this.updateMatrixWorld(true);
  }

  /** 每帧焊臂(解析精确,bodyrig 时代推导原样沿用):geoQuat = gq·dq·frameQuat
   *  (rig 空间,handsRig 提供),体前臂目标世界旋转 R_body = geoQuat·qX⁻¹;
   *  肘骨局部位按「体腕点 = 手腕点」反解(上臂骨位微伸缩),肘骨旋转 =
   *  Qs⁻¹·(Ryπ⁻¹·R_body)。肩只管观感,瞄向实际肘位。onepiece 下腕骨随后被
   *  syncHands 精确接管,前臂扭转由蒙皮肘↔腕权重自然过渡。 */
  updateArm(side: "R" | "L", wrist: THREE.Vector3, geoQuat: THREE.Quaternion): void {
    const arm = this.arm[side];
    const Qt = _q1.copy(_RY_PI).multiply(geoQuat).multiply(arm.qXInv); // 体局部总旋转
    // 体腕点(rig → 体局部):减组平移、Ryπ⁻¹(x/z 取反)、÷k
    const wb = _v1.copy(wrist).sub(this.position);
    wb.x = -wb.x;
    wb.z = -wb.z;
    wb.divideScalar(this.k);
    const eb = wb.sub(_v2.copy(arm.wOff).applyQuaternion(Qt)); // 肘位 = 腕 − Qt·(J_w−J_e)
    const dS = _v2.copy(eb).sub(arm.Js);
    if (dS.lengthSq() < 1e-8) return;
    const qs = arm.shoulder.quaternion.setFromUnitVectors(arm.d0Up, _v3.copy(dS).normalize());
    const qsInv = _q2.copy(qs).invert();
    arm.elbow.position.copy(dS).applyQuaternion(qsInv);
    arm.elbow.quaternion.copy(qsInv).multiply(Qt);
  }

  /** 每帧傀儡同步(两手摆姿 + poseCorrective 之后调):
   *  ① 手骨世界矩阵 H_j = Lfac·G_j·K_j 直写 —— 傀儡手区表面与活手表面逐点
   *     重合。Lfac = (MP·BMI_p)⁻¹·(ML·BMI_l),两侧 BMI 都取 three 的**当前**
   *     bindMatrixInverse:attached 蒙皮模式下它每帧被刷成 matrixWorld⁻¹
   *     (网格自身变换在蒙皮链里自消),故 Lfac 数值 ≈ I;取绑定期快照会多出
   *     一个 T(−p) 平移 —— 首版 _body_probe 抓的整手错位 1770 单位,实测教训。
   *  ② 稀疏 posedirs:系数取活手骨局部旋转(manoPoseCoeffs 同源),不变早退。 */
  syncHands(): void {
    const mpInv = _m3.copy(this.mesh.matrixWorld).invert();
    for (const side of ["R", "L"] as const) {
      const s = this.sync[side];
      s.live.group.updateMatrixWorld(true);
      _m1.copy(this.mesh.matrixWorld).multiply(this.mesh.bindMatrixInverse).invert()
        .multiply(s.liveMesh.matrixWorld).multiply(s.liveMesh.bindMatrixInverse);
      for (let j = 0; j < 16; j++) {
        _m2.copy(_m1).multiply(s.liveBones[j].matrixWorld).multiply(s.K[j]);
        const b = s.bones[j];
        b.matrix.copy(mpInv).multiply(_m2);
        b.matrixWorldNeedsUpdate = true;
      }
      // 姿态修正(对掌鱼际 / 关节鼓包):系数不变时零开销早退(待机呼吸只动手根)
      manoPoseCoeffs(s.liveBones, s.c);
      let dirty = false;
      for (let c = 0; c < 135; c++) {
        if (!(Math.abs(s.c[c] - s.cLast[c]) < 1e-3)) { dirty = true; break; }
      }
      if (!dirty) continue;
      s.cLast.set(s.c);
      const m3 = s.tmp.length;
      s.tmp.set(s.base);
      for (let c = 0; c < 135; c++) {
        const ck = s.c[c];
        if (Math.abs(ck) < 0.01) continue;
        const row = c * m3;
        for (let i = 0; i < m3; i++) s.tmp[i] += ck * s.pdT[row + i];
      }
      const attr = this.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
      const out = attr.array as Float32Array;
      for (let vi = 0; vi < s.pdIdx.length; vi++) {
        const o = s.pdIdx[vi] * 3;
        out[o] = s.tmp[vi * 3];
        out[o + 1] = s.tmp[vi * 3 + 1];
        out[o + 2] = s.tmp[vi * 3 + 2];
      }
      attr.needsUpdate = true;
    }
  }

  /** 全身贴图异步烘焙(浏览器专用;探针/Node 不调用)。基肤在右手系全局单场
   *  求值(全网格连续),双手皱纹各在其手系域(bind 缓存列表);烘完热替换为
   *  与手部 mkBakedMat 同语义的贴图材质(roughnessMap 画物理值)。 */
  async bakeTextures(): Promise<void> {
    if (this.baked || this.baking) return;
    this.baking = true;
    try {
      const geo = this.mesh.geometry;
      const maps = await bakeBodyTextures({
        position: (geo.getAttribute("position") as THREE.BufferAttribute).array as Float32Array,
        normal: (geo.getAttribute("normal") as THREE.BufferAttribute).array as Float32Array,
        uv: (geo.getAttribute("uv") as THREE.BufferAttribute).array as Float32Array,
        index: (geo.getIndex() as THREE.BufferAttribute).array as Uint32Array,
        toFrame: this.toFrame,
        wrinkles: {
          R: (this.sync.R.live.bakeWrinkles ?? []) as WrinkleJoint[],
          L: (this.sync.L.live.bakeWrinkles ?? []) as WrinkleJoint[],
        },
      });
      this.baked = maps;
      this.mat.map = maps.albedo;
      this.mat.bumpMap = maps.bump;
      this.mat.bumpScale = 0.7;
      this.mat.roughnessMap = maps.rough;
      this.mat.roughness = 1.0; // roughnessMap 画的是物理值(同手部 mkBakedMat)
      this.mat.color.set(0xffffff); // 基础肤色已画进 albedo,别再乘一层
      this.mat.needsUpdate = true;
    } finally {
      this.baking = false;
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    if (this.baked) {
      this.baked.albedo.dispose();
      this.baked.bump.dispose();
      this.baked.rough.dispose();
    }
    this.mat.dispose();
  }
}
