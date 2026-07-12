/**
 * SMPL-X 全身 rig(「完整人还原魔方」,2026-07-11)。
 *
 * 资产 = convert-mano.py 的 bodyrig.smplx.json(@1):T-pose 站姿本体(米制,
 * y-up 面朝 +z)+ 55 关节骨架 + top-4 稀疏蒙皮。双臂在「腕内 150mm」半空间已于
 * 转换期切除 —— 腕部以下(手 + 155mm 前臂)由 @4 融合手资产接管,身体的前臂残
 * 段与其套接重叠(半径差 ~2%,小管套大管,开口藏在管内不可见)。
 *
 * 运动模型(省钱切法,用户拍板「不付高昂代价」):躯干/头/腿静态(T-pose 即
 * 站姿,颈部烘一个低头看魔方的常量),**每帧只算双肩/双肘各一次 setFromUnitVectors**
 * —— 肩骨把肘瞄到「手资产前臂轴的延长点」,肘骨把身体腕瞄到手资产腕点,身体
 * 前臂残段与手前臂共线。身体放置(place)在 home 姿一次解定:肘目标沿臂轴定,
 * 肩取肘上后方 55° 自然落位,反推盆骨平移 —— 之后 tick 只转肩/肘,不再移体。
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
  const url = "/sim/hands/smplx/bodyrig.smplx.json?v=1";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`smplx bodyrig asset missing (${res.status} ${url}) — run scripts/convert-mano.py`);
  const data = (await res.json()) as SmplxBodyRigData;
  if (data.format !== "cuberoot-smplx-bodyrig@1") {
    throw new Error(`smplx bodyrig: unknown format ${data.format} — re-run scripts/convert-mano.py`);
  }
  return data;
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();

export class SmplxBody extends THREE.Group {
  readonly mat: THREE.MeshPhysicalMaterial;
  readonly mesh: THREE.SkinnedMesh;
  private readonly bones: THREE.Bone[] = [];
  private readonly J: Float32Array;          // (55,3) 绑定关节位,米
  private readonly named: Record<string, number>;
  private readonly k: number;                // 米 → rig(= 手资产 unitScale)
  /** 每侧上/前臂骨长(米)与绑定段方向(体局部,T-pose 下即世界向)。 */
  private readonly arm: Record<"R" | "L", {
    shoulder: THREE.Bone; elbow: THREE.Bone; sIdx: number;
    l1: number; l2: number; d0Up: THREE.Vector3; d0Fore: THREE.Vector3;
  }>;

  constructor(data: SmplxBodyRigData, unitScale: number) {
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
    this.J = J;

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

    // 平色皮肤(同调试全身的近似肤色;体表无 UV,不走手部烘焙管线)。透明度
    // 由 rig 的 fade 驱动(fadeMats 计入本材质)。
    this.mat = new THREE.MeshPhysicalMaterial({ color: 0xd9af94, roughness: 0.75, metalness: 0 });
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
      return {
        shoulder: this.bones[sIdx], elbow: this.bones[eIdx], sIdx,
        l1: E.distanceTo(S), l2: W.distanceTo(E),
        d0Up: E.clone().sub(S).normalize(), d0Fore: W.clone().sub(E).normalize(),
      };
    };
    this.arm = { R: mk("R"), L: mk("L") };

    // 颈/头:低头看魔方的常量(体局部系;首版符号反了,实测下巴朝天,+ 才是低头)。
    this.bones[N.neck]?.quaternion.setFromAxisAngle(_v1.set(1, 0, 0), 0.3);
    this.bones[N.head]?.quaternion.setFromAxisAngle(_v1.set(1, 0, 0), 0.15);
  }

  /** rig 局部向量 → 体局部(组只有 Ry(π) 旋转:x/z 取反)。 */
  private toLocal(v: THREE.Vector3): THREE.Vector3 {
    v.x = -v.x;
    v.z = -v.z;
    return v;
  }

  /** 身体前臂全长(rig 单位)—— 肘目标 = 腕 + 臂轴向 × 此值。 */
  foreLen(side: "R" | "L"): number {
    return this.arm[side].l2 * this.k;
  }

  /** 肩的 rig 局部位(组平移 + Ry(π)·绑定位×k;肩父链恒等,不随姿态移动)。 */
  private shoulderPos(side: "R" | "L", out: THREE.Vector3): THREE.Vector3 {
    const i = this.arm[side].sIdx;
    return out.set(
      this.position.x - this.J[i * 3] * this.k,
      this.position.y + this.J[i * 3 + 1] * this.k,
      this.position.z - this.J[i * 3 + 2] * this.k,
    );
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
      S.x += this.J[arm.sIdx * 3] * this.k;
      S.y -= this.J[arm.sIdx * 3 + 1] * this.k;
      S.z += this.J[arm.sIdx * 3 + 2] * this.k;
      p.addScaledVector(S, 0.5);
    }
    this.position.copy(p);
    this.updateMatrixWorld(true);
  }

  /** 每帧:肩瞄肘目标方向、肘瞄手资产腕点 —— 身体前臂残段与手前臂共线(place
   *  解定的 home 姿下精确共线;换握/弹指的小幅腕移下臂长差转成微小肩角,套接
   *  重叠区吸收)。wrist/elbowTarget 均为 rig 局部坐标;骨四元数在体局部系解
   *  读(父链恒等 + 组 Ry(π)),方向过 toLocal 变换。 */
  updateArm(side: "R" | "L", wrist: THREE.Vector3, elbowTarget: THREE.Vector3): void {
    const arm = this.arm[side];
    const S = this.shoulderPos(side, _v1);
    const d1 = _v2.copy(elbowTarget).sub(S).normalize();
    const E = _v1.addScaledVector(d1, arm.l1 * this.k); // 实际肘位(S 已用完,原地复用)
    const qs = arm.shoulder.quaternion.setFromUnitVectors(arm.d0Up, this.toLocal(d1));
    const d1f = this.toLocal(_v3.copy(wrist).sub(E).normalize());
    _q1.setFromUnitVectors(arm.d0Fore, d1f);
    arm.elbow.quaternion.copy(qs).invert().multiply(_q1);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
