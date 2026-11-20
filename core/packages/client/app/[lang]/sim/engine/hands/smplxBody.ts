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
 * 两侧腕目标共同决定身体平移，然后肩—肘—腕按绑定骨长做解析 IK。
 * 腕骨由活手驱动，体前臂保留沿肘腕轴的扭转。
 *
 * posedirs(对掌鱼际隆起 / 关节鼓包)在手区同源移植(转换器已把位移场映到体
 * 空间,系数仍由活手骨局部旋转驱动);顶点血色 / 掌背明暗同源(β 沿臂淡出);
 * 全身贴图 bakeTextures() 异步烘(基肤噪声在右手系全局单场求值 —— 全网格
 * 连续无拼接线;双手皱纹各在其手系域求值),烘完热替换材质,烘前平色可用。
 *
 * 缩放:共用手资产 unitScale(HandModel.unitScale 教训:各自拟合比例会
 * 手/臂/体粗细失配)。
 */
import { ArmKinematics, ELBOW_FLEX_MAX, ForearmRotation, WRIST_BEND_MAX, WRIST_RADIAL_SIN, WRIST_ULNAR_SIN } from './armKinematics';
import * as THREE from "three";
import { staticUrl } from "@/lib/stats-base";
import { SIZE } from "../define";
import { HAND_SCALE, WRIST_LOCAL, type HandModel } from "./handModel";
import { MANO_JOINT_BONES, createPoseNormalUpdater, manoPoseCoeffs } from "./handModelMano";
import { boneBloodScore } from "./handModelGltf";
import { applyBakedSkinMaps, bakeBodyTextures, type HandBakedMaps, type WrinkleJoint } from "./bakeHandTexture";

import { BodyAppearance } from "./bodyAppearance";

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

export async function loadSmplxOnePiece(signal?: AbortSignal): Promise<SmplxOnePieceData> {
  const url = staticUrl("/sim/hands/smplx/onepiece.smplx.json") + "?v=1";
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`smplx onepiece asset missing (${res.status} ${url}) — run scripts/convert-mano.py`);
  const data = (await res.json()) as SmplxOnePieceData;
  signal?.throwIfAborted();
  if (data.format !== "cuberoot-smplx-onepiece@1") {
    throw new Error(`smplx onepiece: unknown format ${data.format} — re-run scripts/convert-mano.py`);
  }
  return data;
}

const COLLAR_LIMIT = 35 * Math.PI / 180;
const GRIP_ELBOW_FOLLOW = 1.6; // Neutral forearm follow per forearm length of wrist travel.
const WRIST_FOLLOW_TARGET = 38 * Math.PI / 180;
const HALF_ELBOW_RESERVE = THREE.MathUtils.degToRad(4);
const TURN_WRIST_TARGET = THREE.MathUtils.degToRad(63);
const HALF_GRIP_WRIST_BEND = 44 * Math.PI / 180;
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
  liveBones: THREE.Object3D[];   // MANO joints first, followed by palm supports
  K: THREE.Matrix4[];            // per-follower bind transforms
  bones: THREE.Bone[];           // flat holder bones
  // 稀疏姿态修正
  pdIdx: Uint32Array;
  pdT: Float32Array;             // (135, m·3) 反量化转置
  base: Float32Array;            // (m·3) 绑定位快照
  tmp: Float32Array;
  c: Float32Array;               // 135 系数
  cLast: Float32Array;
  liveOffsets: Int32Array;
  assetToBody: THREE.Matrix4;
  correctedVersion: number;
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
    wrist: {neutral: THREE.Vector3; radial: THREE.Vector3; minForward?: number};
    hasTarget: boolean; holdPose: boolean; carryForearm: boolean; gripTravel: number; wristTarget: THREE.Vector3; geoTarget: THREE.Quaternion; center: THREE.Vector3;
    wristRelief: number;
    roll: ForearmRotation; radialBind: THREE.Vector3; forearmAngle: number; requestedRoll: number;
    halfMinForward: number; turnBendLimit: number; elbowFlexTarget: number;
    halfSupport: number; halfAim: number;
    collar: THREE.Bone; collarOrigin: THREE.Vector3; collarAxis: THREE.Vector3;
    lastFore: THREE.Vector3; pole: THREE.Vector3;
    collarCandidates: THREE.Quaternion[]; collarPreferred: THREE.Quaternion; bestCollar: THREE.Quaternion; collarStep: THREE.Quaternion;
    origin: THREE.Vector3; Js: THREE.Vector3; wOff: THREE.Vector3; qXInv: THREE.Quaternion;
  }>;
  private readonly armSolver = new ArmKinematics();
  private readonly foreAxis = new THREE.Vector3();
  private readonly selectedFore = new THREE.Vector3();
  private readonly transitionFore = new THREE.Vector3();
  private readonly previousCollar = new THREE.Quaternion();
  private readonly reachablePlacement = new THREE.Vector3();
  private readonly projectedPlacement = new THREE.Vector3();
  private readonly reachAxis = new THREE.Vector3();
  private readonly reachCenter = new THREE.Vector3();
  private readonly reachRadius = new THREE.Vector3();
  private readonly framePlacement = new THREE.Vector3();
  private readonly restPlacement = new THREE.Vector3();
  private readonly sync: Record<"R" | "L", SideSync>;
  /** 体空间 → 各侧手系(= relLive·T;顶点血色 + 全身烘焙共用)。 */
  private readonly toFrame: Record<"R" | "L", THREE.Matrix4>;
  private baked: HandBakedMaps | null = null;
  private baking = false;
  private disposed = false;
  private readonly appearance: BodyAppearance;
  private readonly updatePoseNormals: () => void;

  setAvatar(src: string, x = 0, y = 0, scale = 1): void { this.appearance.setAvatar(src, x, y, scale); }
  getHeadView(position: THREE.Vector3, direction: THREE.Vector3): boolean {
    const head = this.bones[this.named.head];
    head.getWorldPosition(position);
    direction.set(0, 0, 1).applyQuaternion(this.getWorldQuaternion(new THREE.Quaternion()));
    return true;
  }

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

    // Allocate the palm followers before binding so their GPU matrices and
    // inverse bind transforms are part of the one-piece skeleton as well.
    const palmIndices = (side: 'R' | 'L') => (hands[side].palmSupports ?? []).map(({ bone }) => {
      const follower = new THREE.Bone();
      follower.name = side + '-' + bone.name;
      follower.matrixAutoUpdate = false;
      holder.add(follower);
      return this.bones.push(follower) - 1;
    });
    const palmBySide = { R: palmIndices('R'), L: palmIndices('L') };

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(Array.from(si), 4));
    geo.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    this.updatePoseNormals = createPoseNormalUpdater(geo);

    // 材质:克隆手部平色皮肤材质(肤色/反射参数同源)。onepiece 带 UV 图集
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
    for (const i of [...handSet, ...palmBySide.R, ...palmBySide.L]) handBindWorld.set(i, this.bones[i].matrixWorld.clone());

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
      const collarAxis = this.bones[sIdx].position.clone().normalize();
      const up = new THREE.Vector3(0, 1, 0).addScaledVector(collarAxis, -collarAxis.y).normalize();
      const forward = new THREE.Vector3().crossVectors(collarAxis, up);
      const collarCandidates: THREE.Quaternion[] = [];
      for (const swing of [COLLAR_LIMIT / 2, COLLAR_LIMIT]) {
        for (let j = 0; j < 32; j++) {
          const azimuth = j * Math.PI / 16;
          const direction = collarAxis.clone().multiplyScalar(Math.cos(swing))
            .addScaledVector(up, Math.sin(swing) * Math.cos(azimuth))
            .addScaledVector(forward, Math.sin(swing) * Math.sin(azimuth));
          collarCandidates.push(new THREE.Quaternion().setFromUnitVectors(collarAxis, direction));
        }
      }
      return {
        shoulder: this.bones[sIdx], elbow: this.bones[eIdx],
        roll: new ForearmRotation(), forearmAngle: 0, requestedRoll: 0,
        radialBind: I.clone().sub(P).normalize(),
        l1: E.distanceTo(S), l2: W.distanceTo(E),
        d0Up: E.clone().sub(S).normalize(),
        wrist: {neutral: new THREE.Vector3(), radial: new THREE.Vector3()},
        hasTarget: false, holdPose: false, carryForearm: false, gripTravel: 0, wristTarget: new THREE.Vector3(), geoTarget: new THREE.Quaternion(), center: new THREE.Vector3(), wristRelief: 0, halfSupport: 0, halfAim: 0, halfMinForward: Math.cos(WRIST_BEND_MAX), turnBendLimit: WRIST_BEND_MAX, elbowFlexTarget: ELBOW_FLEX_MAX,
        collar: this.bones[data.parents[sIdx]], collarOrigin: S.clone().sub(this.bones[sIdx].position),
        lastFore: new THREE.Vector3(), pole: new THREE.Vector3(), collarAxis, collarCandidates, collarPreferred: new THREE.Quaternion(), bestCollar: new THREE.Quaternion(), collarStep: new THREE.Quaternion(), origin: S.clone(), Js: S.clone(), wOff: W.clone().sub(E), qXInv,
      };
    };
    this.arm = { R: mk("R"), L: mk("L") };
    for (const side of ["R", "L"] as const) {
      const { radialAxis, forearm } = hands[side];
      const arm = this.arm[side];
      if (radialAxis && forearm?.frameQuat) {
        arm.radialBind.copy(radialAxis).applyQuaternion(_q1.copy(forearm.frameQuat).multiply(arm.qXInv).invert());
      }
    }

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
      const followers: THREE.Bone[] = [];
      const jointIndices = [...meta.jointIdx, ...palmBySide[side]];
      liveBones.push(...(live.palmSupports ?? []).map(support => support.bone));
      const liveToBody = new Map<number, number>();
      for (let j = 0; j < liveBones.length; j++) {
        const lb = liveBones[j] as THREE.Bone;
        const bi = liveMesh.skeleton.bones.indexOf(lb);
        if (bi < 0) throw new Error(`smplx onepiece: live bone ${MANO_JOINT_BONES[j]} not in skeleton`);
        const gi = liveMesh.skeleton.boneInverses[bi];
        const hiInv = handBindWorld.get(jointIndices[j]);
        if (!hiInv) throw new Error("smplx onepiece: hand bind world missing");
        K.push(new THREE.Matrix4().copy(gi).multiply(liveMesh.bindMatrix).multiply(T).multiply(bindMatrixPInv).multiply(hiInv));
        followers.push(this.bones[jointIndices[j]]);
        liveToBody.set(bi, jointIndices[j]);
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
      // Both assets use the same subdivided MANO hand with different UV seams.
      // Pair coincident material vertices once. The separately welded wrist
      // ring falls back to the body's original pose correctives.
      const liveOffsets = new Int32Array(m).fill(-1);
      if (live.bindSurface) {
        const material = new Map<string, number>();
        const key = (x: number, y: number, z: number) =>
          Math.round(x * 1e4) + '/' + Math.round(y * 1e4) + '/' + Math.round(z * 1e4);
        const source = live.bindSurface;
        for (let j = 0; j < source.length; j += 3)
          material.set(key(source[j], source[j+1], source[j+2]), j);
        for (let j = 0; j < m; j++) {
          _v1.fromArray(pos, pdIdx[j] * 3).applyMatrix4(T);
          const offset = material.get(key(_v1.x, _v1.y, _v1.z));
          if (offset !== undefined && _v2.fromArray(source, offset).distanceToSquared(_v1) < 1e-12)
            liveOffsets[j] = offset;
        }
      }
      // Transfer only material vertices driven by a palm support. Seam and
      // forearm vertices keep their independently authored whole-body weights.
      const liveIds = liveMesh.geometry.getAttribute('skinIndex'), liveWeights = liveMesh.geometry.getAttribute('skinWeight');
      const bodyIds = geo.getAttribute('skinIndex'), bodyWeights = geo.getAttribute('skinWeight');
      const palmIds = new Set(palmBySide[side]);
      for (let i = 0; i < m; i++) {
        if (liveOffsets[i] < 0) continue;
        const v = liveOffsets[i] / 3;
        const ids = [0, 1, 2, 3].map(k => liveToBody.get(liveIds.getComponent(v, k)));
        if (!ids.some(id => id !== undefined && palmIds.has(id))) continue;
        if (ids.some((id, k) => id === undefined && liveWeights.getComponent(v, k) > 0)) continue;
        for (let k = 0; k < 4; k++) {
          bodyIds.setComponent(pdIdx[i], k, ids[k] ?? 0);
          bodyWeights.setComponent(pdIdx[i], k, liveWeights.getComponent(v, k));
        }
      }
      return {
        live, liveMesh, liveBones, K, bones: followers,
        liveOffsets, assetToBody: T.clone().invert(), correctedVersion: -1,
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
    this.appearance = new BodyAppearance(mesh, this.bones[N.head], new THREE.Vector3().fromArray(J, N.head * 3));
  }

  /** Locate the cube in front of the chest, with flexed elbows and reserve
   * reach in both directions. Placing the shoulders behind the resting elbows
   * put the arms close to full extension before the first turn. */
  placeFromWrists(right: THREE.Vector3, left: THREE.Vector3): void {
    this.restPlacement.set(0, 0, 0);
    for (const side of ["R", "L"] as const) {
      const arm = this.arm[side], reach = (arm.l1 + arm.l2) * this.k;
      const shoulder = _v1.copy(side === "R" ? right : left);
      shoulder.y += .17 * reach;
      shoulder.z += .38 * reach;
      shoulder.addScaledVector(_v2.copy(arm.Js).applyQuaternion(_RY_PI), -this.k);
      this.restPlacement.addScaledVector(shoulder, .5);
    }
    this.resetPlacement();
    this.updateMatrixWorld(true);
  }

  resetPlacement(): void {
    this.position.copy(this.restPlacement);
    for (const arm of Object.values(this.arm)) {
      arm.lastFore.set(0, 0, 0);
      arm.roll.reset();
      arm.collar.quaternion.identity();
    }
  }

  /** Collect both wrists before solving so a forward reach moves the torso
   * once for both shoulders. All input transforms are rig-local. */
  updateArm(side: "R" | "L", wrist: THREE.Vector3, geoQuat: THREE.Quaternion, wristRelief: number, lowerGripSupport = 0, fixedSupport = false, carryForearm = false, halfSupport = 0, halfAim = 0, turnShare = 0): void {
    const arm = this.arm[side];
    // Imported rest quaternions have rounded components. Compare directions
    // independently of their lengths during a slide.
    const dot = arm.geoTarget.dot(geoQuat);
    const sameOrientation = arm.hasTarget && arm.lastFore.lengthSq() > 0
      && (arm.geoTarget.equals(geoQuat) || (fixedSupport || carryForearm)
        && dot * dot >= (1 - 1e-12) * arm.geoTarget.lengthSq() * geoQuat.lengthSq());
    const stationary = arm.wristTarget.distanceToSquared(wrist) < 1e-12;
    arm.holdPose = !arm.roll.settling && (fixedSupport || carryForearm) && sameOrientation && stationary;
    arm.carryForearm = carryForearm && sameOrientation && !stationary;
    arm.gripTravel = carryForearm && !sameOrientation && arm.lastFore.lengthSq() > 0
      ? arm.wristTarget.distanceTo(wrist) / (arm.l2 * this.k) : 0;
    arm.hasTarget = true;
    arm.wristTarget.copy(wrist);
    arm.geoTarget.copy(geoQuat);
    arm.wristRelief = wristRelief;
    // Bring the clavicle and elbow into the half grip before the wrist
    // reaches its hard limit. Both windings use the same comfort envelope.
    arm.halfSupport = halfSupport;
    arm.halfAim = halfAim;
    const halfReduction = halfSupport * (1 - halfAim) * (WRIST_BEND_MAX - HALF_GRIP_WRIST_BEND);
    arm.turnBendLimit = THREE.MathUtils.lerp(WRIST_BEND_MAX, TURN_WRIST_TARGET, turnShare);
    arm.halfMinForward = Math.cos(Math.min(arm.turnBendLimit, WRIST_BEND_MAX - halfReduction));
    const supportLimit = lowerGripSupport ? WRIST_BEND_MAX - Math.max(lowerGripSupport * Math.PI / 18, halfReduction) : WRIST_BEND_MAX;
    // Treat the approaching half grip as a comfort target until the seated
    // forearm direction takes over. A hard 44° stop here can switch elbows
    // abruptly during an otherwise continuous outer-layer turn.
    arm.wrist.minForward = lowerGripSupport || turnShare ? Math.cos(Math.min(arm.turnBendLimit, supportLimit)) : undefined;
  }

  private solveArms(dtMs: number): void {
    const { R, L } = this.arm;
    if (!R.hasTarget || !L.hasTarget) return;
    this.framePlacement.copy(this.position);
    // Start from the preceding feasible placement. Ease back only after the
    // support releases so a short reach cannot snap the torso home next frame.
    if (!R.halfAim && !L.halfAim && !R.holdPose && !L.holdPose) {
      this.position.lerp(this.restPlacement, -Math.expm1(-dtMs / 240));
    }
    for (const side of ["R", "L"] as const) {
      if (this.arm[side].holdPose) { this.arm[side].pole.copy(this.arm[side].lastFore); continue; }
      const model = this.sync[side].live, wrist = this.arm[side].wrist;
      if (!model.forearm || !model.radialAxis) return;
      const rotation = _q1.copy(_RY_PI).multiply(model.group.quaternion).normalize();
      wrist.neutral.copy(model.forearm.bindDir).applyQuaternion(rotation).normalize();
      wrist.radial.copy(model.radialAxis).applyQuaternion(rotation).normalize();
      const arm = this.arm[side];
      arm.elbowFlexTarget = ELBOW_FLEX_MAX - HALF_ELBOW_RESERVE * arm.halfAim;
      if (arm.halfAim > 0) {
        // Narrow the feasible elbow cone toward the displayed hand's target.
        // Its angular radius stays inside the anatomical bend envelope.
        arm.pole.copy(arm.wOff).applyQuaternion(arm.qXInv).applyQuaternion(arm.geoTarget).applyQuaternion(_RY_PI).normalize();
        const back = _v2.copy(arm.pole).negate();
        const tilt = wrist.neutral.angleTo(back);
        const limit = arm.turnBendLimit;
        const tiltWeight = .84 * arm.halfAim;
        wrist.neutral.applyQuaternion(_q1.setFromUnitVectors(wrist.neutral, back).slerp(_q2.identity(), 1 - tiltWeight));
        wrist.minForward = Math.cos(Math.max(0, limit - tilt * tiltWeight));
        if (arm.lastFore.lengthSq())
          arm.pole.lerp(arm.lastFore, Math.exp(-dtMs / 90)).normalize();
        this.placeCollar(side, dtMs);
        continue;
      }
      if (arm.carryForearm && this.placeShoulderForForearm(side)) continue;
      // Let the elbow follow the travelling hand from its previous direction;
      // distance-based relief also works on slow playback and paused frames.
      if (arm.gripTravel > 0) {
        const neutralFore = _v2.copy(wrist.neutral).negate();
        arm.pole.copy(arm.lastFore).lerp(neutralFore, -Math.expm1(-GRIP_ELBOW_FOLLOW * arm.gripTravel)).normalize();
        if (this.placeShoulderForForearm(side, arm.pole) || this.solveArm(side, false)) continue;
      }
      arm.pole.set(side === "R" ? .85 : -.85, .5, .20).normalize();
      // Steer the target before applying temporal follow. Applying a second
      // correction to the previous elbow made long frames overshoot it.
      if (arm.wristRelief > 0) {
        const neutral = _v2.copy(wrist.neutral).negate();
        const bend = arm.pole.angleTo(neutral);
        if (bend > WRIST_FOLLOW_TARGET) {
          const amount = arm.wristRelief * (1 - WRIST_FOLLOW_TARGET / bend);
          arm.pole.applyQuaternion(_q1.setFromUnitVectors(arm.pole, neutral).slerp(_q2.identity(), 1 - amount));
        }
      }
      if (arm.lastFore.lengthSq()) arm.pole.lerp(arm.lastFore, Math.exp(-dtMs / 90)).normalize();
      if (!this.placeCollar(side, dtMs) && wrist.minForward !== undefined && wrist.minForward > arm.halfMinForward) {
        // Ease the preferred wrist envelope before moving the torso. Keep
        // the half-grip envelope when the fixed shoulder cannot reach the pad.
        const minForward = arm.halfMinForward;
        const preferred = wrist.minForward;
        for (const fraction of [.5, .25, 0]) {
          wrist.minForward = minForward + (preferred - minForward) * fraction;
          if (this.placeCollar(side, dtMs)) break;
        }
      }
    }
    // Half-grip preparation narrows the elbow cone as a preference. If the
    // other hand is anchored, try the available anatomical wrist envelope
    // before displacing its shoulder. The hand and its contacts stay fixed.
    for (const side of ["R", "L"] as const) {
      const arm = this.arm[side];
      if (arm.holdPose || arm.wrist.minForward === undefined || this.solveArm(side, false)) continue;
      const model = this.sync[side].live;
      const natural = _v1.copy(model.forearm!.bindDir).applyQuaternion(_q1.copy(_RY_PI).multiply(model.group.quaternion));
      const tilt = natural.angleTo(arm.wrist.neutral);
      const radius = Math.acos(arm.wrist.minForward);
      arm.wrist.minForward = Math.cos(THREE.MathUtils.lerp(radius, Math.max(radius, arm.turnBendLimit - tilt), 1 - arm.halfAim));
      if (this.placeCollar(side, dtMs) || !arm.halfAim) continue;
      // Keep the wrist within its turn budget as a seated support changes
      // winding. Open the aiming cone a little before translating both shoulders.
      const ease = Math.min(tilt, THREE.MathUtils.degToRad(8));
      const handBack = _v1.copy(model.forearm!.bindDir).applyQuaternion(_q1.copy(_RY_PI).multiply(model.group.quaternion)).normalize();
      if (tilt > 0) arm.wrist.neutral.applyQuaternion(_q1.setFromUnitVectors(arm.wrist.neutral, handBack).slerp(_q2.identity(), 1 - ease / tilt));
      arm.wrist.minForward = Math.cos(Math.max(0, arm.turnBendLimit - tilt + ease));
      this.placeCollar(side, dtMs);
    }
    if ((!R.holdPose && !this.solveArm("R", false)) || (!L.holdPose && !this.solveArm("L", false))) this.placeTorso();
    const moved = this.position.distanceToSquared(this.framePlacement) > 1e-12;
    if (moved) {
      for (const side of ["R", "L"] as const) {
        const arm = this.arm[side];
        if (arm.holdPose && arm.lastFore.lengthSq()) {
          arm.pole.copy(arm.lastFore);
          this.placeShoulderForForearm(side);
        }
      }
    }
    for (const side of ["R", "L"] as const) {
      const arm = this.arm[side];
      if (arm.holdPose && !moved) continue;
      if (dtMs > 0 && arm.lastFore.lengthSq() && this.solveArm(side, false)) {
        const goal = this.selectedFore.copy(this.armSolver.fore).normalize();
        const angle = goal.angleTo(arm.lastFore);
        const step = THREE.MathUtils.degToRad(.20) * dtMs;
        if (angle > step) {
          // If the wrist cone splits the elbow circle into separate arcs,
          // use the clavicle to bridge them before accepting an elbow jump.
          for (const fraction of [step / angle, .35, .65]) {
            this.transitionFore.lerpVectors(arm.lastFore, goal, fraction).normalize();
            if (this.placeShoulderForForearm(side, this.transitionFore)) break;
          }
        }
      }
      this.solveArm(side, true, dtMs);
    }
    this.updateMatrixWorld(true);
  }

  /** A pair outside clavicle reach may require trunk translation. Start at
   * the chest reference and move only as far as both arm chains require. */
  private placeTorso(): void {
    const { R, L } = this.arm;
    // Re-seat the shoulder at each small projection. A clavicle picked for
    // the old torso can otherwise require crossing to the far side of the
    // two-arm reach circle as soon as the opposite elbow reaches 150°.
    for (let i = 0; i < 8; i++) {
      for (const side of ["R", "L"] as const) {
        if (this.solveArm(side, false) || this.placeCollar(side, 0)) continue;
        this.projectShoulder(side);
      }
      if (this.solveArm("R", false) && this.solveArm("L", false)) return;
    }
    // Preserve the nearby torso branch before resorting to the two-arm
    // reach circle. Deep flexion is available when the preferred reserve
    // would otherwise displace a supporting shoulder across the body.
    if (R.elbowFlexTarget < ELBOW_FLEX_MAX || L.elbowFlexTarget < ELBOW_FLEX_MAX) {
      for (const arm of [R, L]) arm.elbowFlexTarget = ELBOW_FLEX_MAX;
      for (const side of ["R", "L"] as const) this.placeCollar(side, 0);
      if (this.solveArm("R", false) && this.solveArm("L", false)) return;
    }
    for (const arm of [R, L]) {
      const fore = _v1.copy(arm.wOff).applyQuaternion(arm.qXInv).applyQuaternion(arm.geoTarget);
      arm.center.copy(arm.origin).applyQuaternion(_RY_PI).add(fore).multiplyScalar(-this.k).add(arm.wristTarget);
    }
    const r = R.l1 * this.k, l = L.l1 * this.k;
    const axis = this.reachAxis.subVectors(L.center, R.center);
    const distance = axis.length();
    if (distance < 1e-8) axis.set(1, 0, 0);
    else axis.divideScalar(distance);
    const along = distance < 1e-8 ? 0 : THREE.MathUtils.clamp((r*r - l*l + distance*distance) / (2*distance), -r, r);
    const center = this.reachCenter.copy(R.center).addScaledVector(axis, along);
    const offset = this.reachRadius.subVectors(this.restPlacement, center);
    offset.addScaledVector(axis, -offset.dot(axis));
    if (offset.lengthSq() < 1e-8) {
      offset.set(0, 1, 0).addScaledVector(axis, -axis.y);
      if (offset.lengthSq() < 1e-8) offset.set(0, 0, 1).addScaledVector(axis, -axis.z);
    }
    offset.normalize().multiplyScalar(Math.sqrt(Math.max(0, r*r - along*along)));
    this.reachablePlacement.copy(center).add(offset);
    if (distance > r + l) this.reachablePlacement.copy(R.center).lerp(L.center, r / (r + l));
    for (let i = 0; i < 10; i++) {
      const rightFits = this.projectShoulder("R");
      const leftFits = this.projectShoulder("L");
      if (rightFits && leftFits) break;
    }
    if (!this.solveArm("R", false) || !this.solveArm("L", false)) {
      this.projectedPlacement.copy(this.position);
      // The nearest point on the two shoulder spheres can fold one elbow
      // beyond its stop. Search the shared circle for a feasible endpoint
      // before bisecting toward it; an infeasible endpoint breaks closure.
      this.position.copy(this.reachablePlacement);
      if (!this.solveArm("R", false) || !this.solveArm("L", false)) {
        let found = false;
        for (let i = 1; i <= 72 && !found; i++) {
          for (const sign of [-1, 1]) {
            this.position.copy(offset).applyAxisAngle(axis, sign * i * Math.PI / 72).add(center);
            if (this.solveArm("R", false) && this.solveArm("L", false)) {
              this.reachablePlacement.copy(this.position);
              found = true;
              break;
            }
          }
        }
        if (!found) {
          this.position.copy(this.projectedPlacement);
          for (let i = 0; i < 6; i++) {
            this.placeCollar("R", 0);
            this.placeCollar("L", 0);
            const rightFits = this.projectShoulder("R");
            const leftFits = this.projectShoulder("L");
            if (rightFits && leftFits) break;
          }
          return;
        }
      }
      let low = 0, high = 1;
      for (let i = 0; i < 12; i++) {
        const mid = (low + high) / 2;
        this.position.lerpVectors(this.projectedPlacement, this.reachablePlacement, mid);
        if (this.solveArm("R", false) && this.solveArm("L", false)) high = mid;
        else low = mid;
      }
      this.position.lerpVectors(this.projectedPlacement, this.reachablePlacement, high);
    }
  }

  /** Place the clavicle and upper arm around the requested forearm direction.
   * The rigid slide uses the previous direction to keep the wrist angle fixed. */
  private placeShoulderForForearm(side: "R" | "L", forearm = this.arm[side].lastFore): boolean {
    const arm = this.arm[side];
    const backRadial = -forearm.dot(arm.wrist.radial);
    if (-forearm.dot(arm.wrist.neutral) < (arm.wrist.minForward ?? Math.cos(WRIST_BEND_MAX)) - 1e-7
      || backRadial < -WRIST_RADIAL_SIN - 1e-7 || backRadial > WRIST_ULNAR_SIN + 1e-7) return false;
    const elbow = _v1.copy(arm.wristTarget).sub(this.position).applyQuaternion(_RY_PI)
      .divideScalar(this.k).addScaledVector(forearm, -arm.l2).sub(arm.collarOrigin);
    const upper = _v2.copy(elbow).add(arm.collarOrigin).sub(arm.origin);
    if (!this.armSolver.solve(elbow, upper, arm.shoulder.position.length(), arm.l1, side, undefined, false)) return false;
    if (this.armSolver.fore.dot(forearm) < arm.l1 * Math.cos(arm.elbowFlexTarget)) return false;
    const collar = this.armSolver.upper.normalize();
    if (collar.dot(arm.collarAxis) < Math.cos(COLLAR_LIMIT)) return false;
    arm.collar.quaternion.setFromUnitVectors(arm.collarAxis, collar);
    arm.origin.copy(arm.shoulder.position).applyQuaternion(arm.collar.quaternion).add(arm.collarOrigin);
    arm.pole.copy(forearm);
    return true;
  }

  /** Use the clavicle's rotation about its chest attachment before asking
   * the torso to move. The shoulder remains exactly one bind offset away.
   * A seek resets both the preferred shoulder and the previous elbow plane. */
  private placeCollar(side: "R" | "L", dtMs: number): boolean {
    const arm = this.arm[side];
    this.previousCollar.copy(arm.collar.quaternion);
    const preferred = arm.collarPreferred.copy(arm.collar.quaternion).slerp(_q2.identity(), -Math.expm1(-dtMs / 300));
    let best = Infinity, feasible = false;
    const assess = (q: THREE.Quaternion) => {
      arm.origin.copy(arm.shoulder.position).applyQuaternion(q).add(arm.collarOrigin);
      const fits = this.solveArm(side, false);
      if (feasible && !fits) return;
      const fore = this.armSolver.fore;
      const swing = 1 - THREE.MathUtils.clamp(fore.dot(arm.pole) / arm.l2, -1, 1);
      const shoulder = 1 - Math.abs(q.dot(preferred));
      const elbowOut = (side === "L" ? 1 : -1) * (arm.origin.x + this.armSolver.upper.x);
      const crossing = Math.max(0, Math.abs(arm.Js.x) - elbowOut) / arm.l1;
      const continuity = arm.lastFore.lengthSq()
        ? 1 - THREE.MathUtils.clamp(fore.dot(arm.lastFore) / arm.l2, -1, 1) : 0;
      const shrug = Math.max(0, arm.origin.y - arm.Js.y) / arm.shoulder.position.length();
      const elbowFlex = this.armSolver.upper.angleTo(fore);
      const endRange = Math.max(0, elbowFlex - THREE.MathUtils.degToRad(135));
      const extremeRoll = Math.max(0, Math.abs(arm.requestedRoll) - THREE.MathUtils.degToRad(70));
      const wristBend = Math.acos(THREE.MathUtils.clamp(-fore.dot(arm.wrist.neutral) / arm.l2, -1, 1));
      const wristExcess = Math.max(0, wristBend - Math.acos(arm.halfMinForward) + .12);
      let cost = 1.8 * wristExcess ** 2 + .15 * extremeRoll ** 2 + .20 * shrug ** 2 + .25 * endRange ** 2 + swing + (.45 + 1.5 * arm.wristRelief) * shoulder
        + (.75 + .65 * arm.wristRelief) * continuity + 5 * crossing ** 2 + .12 * (1 - Math.abs(q.w));
      if (!fits) {
        const fromWrist = _v1.subVectors(this.position, arm.wristTarget).applyQuaternion(_RY_PI)
          .divideScalar(this.k).add(arm.origin);
        this.armSolver.shoulderCorrection(fromWrist, arm.l1, arm.l2, arm.wrist, _v2, arm.elbowFlexTarget);
        cost = _v2.length() + .0001 * cost;
      }
      if ((fits && !feasible) || cost < best) {
        best = cost;
        feasible = fits;
        arm.bestCollar.copy(q);
      }
    };
    assess(preferred);
    if (!feasible || best > .0005) {
      for (const q of arm.collarCandidates) assess(q);
      // Refine around the best sampled shoulder without crossing its swing
      // envelope. Nearby wrists then select nearby elbows and collar poses.
      for (const step of [.12, .05, .02, .008]) {
        arm.collar.quaternion.copy(arm.bestCollar);
        const base = _v3.copy(arm.collarAxis).applyQuaternion(arm.collar.quaternion);
        for (const y of [-step, 0, step]) for (const z of [-step, 0, step]) {
          if (!y && !z) continue;
          const direction = _v1.copy(base);
          direction.y += y; direction.z += z; direction.normalize();
          arm.collarStep.setFromUnitVectors(arm.collarAxis, direction);
          const angle = direction.angleTo(arm.collarAxis);
          if (angle > COLLAR_LIMIT) arm.collarStep.slerp(_q2.identity(), 1 - COLLAR_LIMIT / angle);
          assess(arm.collarStep);
        }
      }
    }
    if (feasible && dtMs > 0 && arm.lastFore.lengthSq()) {
      const previous = this.previousCollar;
      const angle = previous.angleTo(arm.bestCollar);
      const fraction = angle > 0 ? Math.min(1, THREE.MathUtils.degToRad(.18) * dtMs / angle) : 1;
      if (fraction < 1) {
        arm.collarStep.slerpQuaternions(previous, arm.bestCollar, fraction);
        arm.origin.copy(arm.shoulder.position).applyQuaternion(arm.collarStep).add(arm.collarOrigin);
        if (this.solveArm(side, false)) arm.bestCollar.copy(arm.collarStep);
        else {
          let low = fraction, high = 1;
          for (let i = 0; i < 8; i++) {
            const t = (low + high) / 2;
            arm.collarStep.slerpQuaternions(previous, arm.bestCollar, t);
            arm.origin.copy(arm.shoulder.position).applyQuaternion(arm.collarStep).add(arm.collarOrigin);
            if (this.solveArm(side, false)) high = t;
            else low = t;
          }
          arm.bestCollar.copy(arm.collarStep.slerpQuaternions(previous, arm.bestCollar, high));
        }
      }
    }
    arm.collar.quaternion.copy(arm.bestCollar);
    arm.origin.copy(arm.shoulder.position).applyQuaternion(arm.collar.quaternion).add(arm.collarOrigin);
    return feasible;
  }

  private projectShoulder(side: "R" | "L"): boolean {
    if (this.solveArm(side, false)) return true;
    const arm = this.arm[side];
    const fromWrist = _v1.subVectors(this.position, arm.wristTarget).applyQuaternion(_RY_PI)
      .divideScalar(this.k).add(arm.origin);
    this.armSolver.shoulderCorrection(fromWrist, arm.l1, arm.l2, arm.wrist, _v2, arm.elbowFlexTarget);
    this.position.addScaledVector(_v2.applyQuaternion(_RY_PI), this.k);
    return false;
  }

  private solveArm(side: "R" | "L", apply: boolean, dtMs = 0): boolean {
    const arm = this.arm[side];
    const target = _v1.copy(arm.wristTarget).sub(this.position).applyQuaternion(_RY_PI).divideScalar(this.k).sub(arm.origin);
    const desired = _q1.copy(_RY_PI).multiply(arm.geoTarget).multiply(arm.qXInv);
    const preferred = _v2.copy(arm.wOff).applyQuaternion(desired).normalize();
    const feasible = this.armSolver.solve(target, arm.pole, arm.l1, arm.l2, side, arm.wrist, arm.elbowFlexTarget);
    const fore = this.foreAxis.copy(this.armSolver.fore).normalize();
    desired.premultiply(_q2.setFromUnitVectors(preferred, fore));
    const thumb = _v2.copy(arm.radialBind).applyQuaternion(desired);
    const towardShoulder = _v1.copy(this.armSolver.upper).negate();
    arm.requestedRoll = arm.roll.angle(fore, towardShoulder, thumb, side);
    if (apply) {
      arm.lastFore.copy(fore);
      const qs = arm.shoulder.quaternion.setFromUnitVectors(arm.d0Up, this.armSolver.upper.normalize());
      arm.forearmAngle = arm.roll.apply(desired, fore, arm.requestedRoll, side, dtMs);
      arm.elbow.quaternion.copy(qs).invert().multiply(desired);
      qs.premultiply(_q2.copy(arm.collar.quaternion).invert());
    }
    return feasible;
  }

  /** Displayed arm landmarks in world space, after the clavicle/elbow solve. */
  measureArm(side: "R" | "L") {
    const arm = this.arm[side];
    return {
      shoulder: arm.shoulder.getWorldPosition(new THREE.Vector3()).toArray(),
      elbow: arm.elbow.getWorldPosition(new THREE.Vector3()).toArray(),
      shoulderQuaternion: arm.shoulder.getWorldQuaternion(new THREE.Quaternion()).toArray(),
      forearmQuaternion: arm.elbow.getWorldQuaternion(new THREE.Quaternion()).toArray(),
      forearmTwist: arm.forearmAngle,
    };
  }

  /** 每帧傀儡同步(两手摆姿 + poseCorrective 之后调):
   *  ① 手骨世界矩阵 H_j = Lfac·G_j·K_j 直写 —— 傀儡手区表面与活手表面逐点
   *     重合。Lfac = (MP·BMI_p)⁻¹·(ML·BMI_l),两侧 BMI 都取 three 的**当前**
   *     bindMatrixInverse:attached 蒙皮模式下它每帧被刷成 matrixWorld⁻¹
   *     (网格自身变换在蒙皮链里自消),故 Lfac 数值 ≈ I;取绑定期快照会多出
   *     一个 T(−p) 平移 —— 首版 _body_probe 抓的整手错位 1770 单位,实测教训。
   *  ② 稀疏 posedirs:系数取活手骨局部旋转(manoPoseCoeffs 同源),不变早退。 */
  syncHands(dtMs = 0): void {
    this.solveArms(dtMs);
    const mpInv = _m3.copy(this.mesh.matrixWorld).invert();
    let normalsDirty = false;
    for (const side of ["R", "L"] as const) {
      const s = this.sync[side];
      s.live.group.updateMatrixWorld(true);
      _m1.copy(this.mesh.matrixWorld).multiply(this.mesh.bindMatrixInverse).invert()
        .multiply(s.liveMesh.matrixWorld).multiply(s.liveMesh.bindMatrixInverse);
      for (let j = 0; j < s.bones.length; j++) {
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
      const livePosition = s.liveMesh.geometry.getAttribute("position") as THREE.BufferAttribute;
      const wholeHand = this.arm[side].halfSupport > 1e-8;
      const patch = s.live.surfacePatch;
      const version = wholeHand || patch?.active ? livePosition.version : -1;
      if (!dirty && version === s.correctedVersion) continue;
      s.correctedVersion = version;
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
        if (version >= 0 && s.liveOffsets[vi] >= 0 && (wholeHand || (patch && (patch.vertices[s.liveOffsets[vi] / 3] & patch.active)))) {
          _v1.fromArray(livePosition.array, s.liveOffsets[vi]).applyMatrix4(s.assetToBody).toArray(out, o);
          continue;
        }
        out[o] = s.tmp[vi * 3];
        out[o + 1] = s.tmp[vi * 3 + 1];
        out[o + 2] = s.tmp[vi * 3 + 2];
      }
      attr.needsUpdate = true;
      normalsDirty = true;
    }
    if (normalsDirty) this.updatePoseNormals();
  }

  /** 全身贴图异步烘焙(浏览器专用;探针/Node 不调用)。基肤在右手系全局单场
   *  求值(全网格连续),双手皱纹各在其手系域(bind 缓存列表);烘完热替换为
   *  与手部共用 applyBakedSkinMaps(roughnessMap 画物理值)。 */
  async bakeTextures(signal?: AbortSignal): Promise<void> {
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
      }, 2048, signal);
      if (this.disposed) {
        maps.albedo.dispose(); maps.bump.dispose(); maps.rough.dispose();
        return;
      }
      this.baked = maps;
      applyBakedSkinMaps(this.mat, maps);
    } finally {
      this.baking = false;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.appearance.dispose();
    this.mesh.skeleton.dispose();
    this.mesh.geometry.dispose();
    if (this.baked) {
      this.baked.albedo.dispose();
      this.baked.bump.dispose();
      this.baked.rough.dispose();
    }
    this.mat.dispose();
  }
}
