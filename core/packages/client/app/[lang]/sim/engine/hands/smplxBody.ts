/**
 * SMPL-X 全身 rig(「完整人还原魔方」,2026-07-11)。
 *
 * 资产 = convert-mano.py 的 bodyrig.smplx.json(@2):T-pose 站姿本体(米制,
 * y-up 面朝 +z)+ 55 关节骨架 + top-4 稀疏蒙皮。双臂在「腕内 130mm」半空间已于
 * 转换期切除,套接区([130,155mm])径向内缩 1.5mm —— 腕部以下(手 + 155mm 前
 * 臂)由 @4 融合手资产接管,体残段藏进手前臂管内,锯齿切口全部落在覆盖区。
 *
 * 运动模型(省钱切法,用户拍板「不付高昂代价」):躯干/头/腿静态(T-pose 即
 * 站姿,颈部烘一个低头看魔方的常量),每帧只解双臂。**焊接是解析精确的**:
 * fuse_smplx_forearm 把 SMPL-X 前臂按 p = Xᵀ(v−wj)·k 映进手模板系再乘 Rm 回
 * 嵌,故体系→模板系 M = Rm·Xᵀ 是刚性对应;运行时体前臂的目标世界旋转
 * R_body = gq·dq·(align·Rm)·Xᵀ(gq=手组四元数,dq=融合前臂骨摆动 Δ,
 * align·Rm = 资产 frameQuat)—— 肘骨按此旋转 + 「体腕点=手腕点」反解出的精确
 * 位置落位(上臂骨位微拉伸吸收 place 的两侧平均残差),体残段表面与融合前臂
 * 表面严格重合(位置/朝向/扭转三者全对齐,2026-07-11 用户抓「手断开了」的根
 * 治)。肩仅承担观感:setFromUnitVectors 瞄向实际肘位。身体放置(place)在
 * home 姿一次解定,之后 tick 不再移体。
 *
 * 缩放:必须共用手资产的 unitScale(米 → rig;HandModel.unitScale 注释同款
 * 教训 —— 各自拟合比例会手/臂/体粗细失配)。
 */
import * as THREE from "three";

export interface SmplxBodyRigData {
  format: string;
  counts: { verts: number; faces: number; joints: number };
  position: string;   // b64 float32 (n,3) 米
  normal: string;     // b64 float32 (n,3)
  index: string;      // b64 uint32 (f,3)
  joints: string;     // b64 float32 (55,3) 米(T-pose 绑定位)
  parents: number[];  // 55,root=-1
  skinIndex: string;  // b64 uint8 (n,4)
  skinWeight: string; // b64 float32 (n,4)
  named: Record<string, number>;
  heightM: number;
}

function b64ToArrayBuffer(s: string): ArrayBuffer {
  const bin = atob(s);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

export async function loadSmplxBodyRig(): Promise<SmplxBodyRigData> {
  const url = "/sim/hands/smplx/bodyrig.smplx.json?v=2";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`smplx bodyrig asset missing (${res.status} ${url}) — run scripts/convert-mano.py`);
  const data = (await res.json()) as SmplxBodyRigData;
  if (data.format !== "cuberoot-smplx-bodyrig@2") {
    throw new Error(`smplx bodyrig: unknown format ${data.format} — re-run scripts/convert-mano.py`);
  }
  return data;
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();
/** 体组朝向 Ry(π)(π 旋转自逆,同时充当其逆)。 */
const _RY_PI = new THREE.Quaternion(0, 1, 0, 0);

export class SmplxBody extends THREE.Group {
  readonly mat: THREE.MeshStandardMaterial;
  readonly mesh: THREE.SkinnedMesh;
  private readonly bones: THREE.Bone[] = [];
  private readonly named: Record<string, number>;
  private readonly k: number;                // 米 → rig(= 手资产 unitScale)
  /** 每侧臂绑定量(米/体局部):肩位 Js、上臂长 l1 与方向 d0Up(观感瞄向)、
   *  前臂长 l2(place 的肘目标)、肘→腕偏移 wOff、前臂绑定基逆 qXInv
   *  (X = [xg,yg,zg]:xg=肘→腕,zg=掌法向 recipe 与 fuse 同款,左侧叉积换
   *  序保右手系 —— M = Rm·Xᵀ 刚性对应的体侧因子)。 */
  private readonly arm: Record<"R" | "L", {
    shoulder: THREE.Bone; elbow: THREE.Bone;
    l1: number; l2: number; d0Up: THREE.Vector3;
    Js: THREE.Vector3; wOff: THREE.Vector3; qXInv: THREE.Quaternion;
  }>;

  constructor(data: SmplxBodyRigData, unitScale: number, skin?: THREE.Material) {
    super();
    this.k = unitScale;
    this.named = data.named;
    const n = data.counts.verts;
    const pos = new Float32Array(b64ToArrayBuffer(data.position));
    const nrm = new Float32Array(b64ToArrayBuffer(data.normal));
    const idx = new Uint32Array(b64ToArrayBuffer(data.index));
    const si = new Uint8Array(b64ToArrayBuffer(data.skinIndex));
    const sw = new Float32Array(b64ToArrayBuffer(data.skinWeight));
    const J = new Float32Array(b64ToArrayBuffer(data.joints));
    if (pos.length !== n * 3 || si.length !== n * 4 || sw.length !== n * 4) {
      throw new Error("smplx bodyrig: buffer size mismatch");
    }

    // 骨架:局部位 = J[i] − J[parent](米);绑定旋转全恒等 → 骨局部四元数即
    // 「相对 T-pose 的世界旋转」(父链未转时),tick 里的姿态代数依赖这一点。
    for (let i = 0; i < data.counts.joints; i++) {
      const b = new THREE.Bone();
      const p = data.parents[i];
      b.position.set(
        J[i * 3] - (p >= 0 ? J[p * 3] : 0),
        J[i * 3 + 1] - (p >= 0 ? J[p * 3 + 1] : 0),
        J[i * 3 + 2] - (p >= 0 ? J[p * 3 + 2] : 0),
      );
      this.bones.push(b);
      if (p >= 0) this.bones[p].add(b);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(Array.from(si), 4));
    geo.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));

    // 体表材质:优先克隆手部平色皮肤材质(肤色/粗糙度/sheen 标量与手部同源,
    // 观感一致)。体几何无 UV 也无顶点色 —— 贴图与 vertexColors 必须剥掉
    // (缺省属性采 (0,0)/(0,0,0):粗糙度被单像素污染、albedo 直接乘成全黑,
    // 2026-07-12 实测全身黑人);透明度由变焦 fade 单独驱动,克隆后复位。
    if (skin) {
      const m = skin.clone() as THREE.MeshStandardMaterial;
      m.map = m.bumpMap = m.roughnessMap = m.normalMap = null;
      m.vertexColors = false;
      m.roughness = 0.6; // skinMat 0.85 是 roughnessMap 乘数(实效 ~0.56),无贴图侧手动对齐
      this.mat = m;
    } else {
      this.mat = new THREE.MeshPhysicalMaterial({ color: 0xd9af94, roughness: 0.75, metalness: 0 });
    }
    this.mat.transparent = false;
    this.mat.opacity = 1;
    const mesh = new THREE.SkinnedMesh(geo, this.mat);
    mesh.raycast = () => { /* 不可拾取 */ };
    mesh.frustumCulled = false; // 蒙皮包围球不含姿态,大网格禁剔除防闪没
    mesh.add(this.bones[0]);
    this.mesh = mesh;
    this.add(mesh);
    this.scale.setScalar(unitScale); // 几何/骨保持米制,组级缩放进 rig 单位
    // 面向:资产 T-pose 面朝 +z,但这套握姿是第一人称(拇指朝镜头压 F,前臂
    // 轴指向镜头)—— 身体必须站在镜头侧、背对镜头面向魔方(Ry(π))。近景 =
    // 过肩第一人称;拉远 / 换背面视图 = 看一个完整的人在还原魔方。
    this.quaternion.setFromAxisAngle(_v1.set(0, 1, 0), Math.PI);
    // 绑定必须在骨世界矩阵刷新之后:Skeleton() 用 bone.matrixWorld 求
    // boneInverses,identity 时刻绑定 = 蒙皮全体按链偏移涂抹(躯干消失、
    // 残臂拉成翼膜,首版实测)。
    this.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(this.bones));

    const N = this.named;
    const jv = (i: number, out: THREE.Vector3): THREE.Vector3 =>
      out.set(J[i * 3], J[i * 3 + 1], J[i * 3 + 2]);
    const mk = (side: "R" | "L") => {
      const s = side === "R" ? "right" : "left";
      const sIdx = N[`${s}_shoulder`], eIdx = N[`${s}_elbow`], wIdx = N[`${s}_wrist`];
      const S = jv(sIdx, new THREE.Vector3()), E = jv(eIdx, new THREE.Vector3()), W = jv(wIdx, new THREE.Vector3());
      // 前臂绑定基 X(与 fuse_smplx_forearm 的 xg/yg/zg 同 recipe):x=肘→腕,
      // z=掌法向(index1/pinky1 叉积;左侧换序 —— 镜像下叉积变号,换序后
      // X_L = Sx·X_R·diag(1,−1,1) 仍右手系,与转换器镜像后的 Rm_L 配对)。
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

    // 颈/头:低头看魔方的常量(体局部系;首版符号反了,实测下巴朝天,+ 才是低头)。
    this.bones[N.neck]?.quaternion.setFromAxisAngle(_v1.set(1, 0, 0), 0.3);
    this.bones[N.head]?.quaternion.setFromAxisAngle(_v1.set(1, 0, 0), 0.15);
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

  /** 每帧焊臂(解析精确,见文件头推导):geoQuat = gq·dq·frameQuat(rig 空
   *  间,handsRig 提供),体前臂目标世界旋转 R_body = geoQuat·qX⁻¹;肘骨局部
   *  位按「体腕点 = 手腕点」反解(上臂骨位微伸缩,吸收 place 两侧平均残差),
   *  肘骨旋转 = Qs⁻¹·(Ryπ⁻¹·R_body)。肩只管观感,瞄向实际肘位。体残段(肘/
   *  腕权重顶点,腕骨局部恒等 → 随肘刚体)与融合前臂表面严格重合。 */
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

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
