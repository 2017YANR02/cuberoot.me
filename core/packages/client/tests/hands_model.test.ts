/**
 * /sim GLTF 手模适配层回归(adaptGltfHand,fs 读 GLB + GLTFLoader.parse 直喂)。
 * 锁死加载层与 rig 的契约:
 *  ① WebXR 平铺骨骼重建为 FK 链 —— 驱动骨挂进 root/mid/tip 代理组,且绑定
 *    世界位置不被破坏(v1 曾把绑定位快照放在 inner 变换之后 → 代理支点被
 *    toHand 双重变换,弯指绕垃圾支点转出蒙皮拉丝);
 *  ② 腕对齐 WRIST_LOCAL、中指链长归一 115U(整体缩放锚点);
 *  ③ mid/tip 代理 rest 局部旋转 = identity(rig 直写 rotation.set(0,-c,0)
 *    的前提,骨链自然弯度必须留在位置偏移里);
 *  ④ 蒙皮网格带顶点色(skinMat vertexColors:true 契约)+ 换上传入材质;
 *  ⑤ 左右手为真镜像资产:食指侧 y 符号相反。
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { adaptGltfHand } from '@/app/[lang]/sim/engine/hands/handModelGltf';
import { WRIST_LOCAL, HAND_SCALE, type HandModel, type FingerName } from '@/app/[lang]/sim/engine/hands/handModel';
import { SIZE } from '@/app/[lang]/sim/engine/define';

const U = (SIZE / 64) * HAND_SCALE;
const FINGERS: FingerName[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
/** 各指链的驱动骨/端点骨名(与 handModelGltf.JOINT_CHAINS 同步)。 */
const CHAIN: Record<FingerName, { drive: [string, string, string]; end: string }> = {
  thumb: { drive: ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal'], end: 'thumb-tip' },
  index: { drive: ['index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal'], end: 'index-finger-tip' },
  middle: { drive: ['middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal'], end: 'middle-finger-tip' },
  ring: { drive: ['ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal'], end: 'ring-finger-tip' },
  pinky: { drive: ['pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal'], end: 'pinky-finger-tip' },
};

async function loadModel(file: 'right.glb' | 'left.glb', side: 1 | -1, mat: THREE.Material): Promise<HandModel> {
  const p = fileURLToPath(new URL(`../public/sim/hands/${file}`, import.meta.url));
  const buf = await readFile(p);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const gltf = await new Promise<GLTF>((resolve, reject) => {
    new GLTFLoader().parse(ab, '', resolve, reject);
  });
  return adaptGltfHand(gltf.scene, side, mat, file);
}

const worldOf = (o: THREE.Object3D): THREE.Vector3 => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
const boneByName = (m: HandModel, name: string): THREE.Object3D => {
  const b = m.group.getObjectByName(name);
  if (!b) throw new Error(`bone ${name} not found`);
  return b;
};

describe('adaptGltfHand GLTF 手模适配', () => {
  const skinR = new THREE.MeshStandardMaterial();
  const skinL = new THREE.MeshStandardMaterial();
  let right: HandModel; // side=-1,魔方右侧 = 解剖学右手
  let left: HandModel;

  beforeAll(async () => {
    [right, left] = await Promise.all([
      loadModel('right.glb', -1, skinR),
      loadModel('left.glb', 1, skinL),
    ]);
    right.group.updateMatrixWorld(true);
    left.group.updateMatrixWorld(true);
  });

  it('腕骨对齐 WRIST_LOCAL,中指链长归一 115U', () => {
    for (const m of [right, left]) {
      expect(worldOf(boneByName(m, 'wrist')).distanceTo(WRIST_LOCAL)).toBeLessThan(1e-3);
      const mid = m.fingers.middle.segLens;
      expect(Math.abs(mid[0] + mid[1] + mid[2] - 115 * U)).toBeLessThan(1e-3);
    }
  });

  it('mid/tip 代理 rest 局部旋转为 identity,链内偏移长度 = segLens', () => {
    const ident = new THREE.Quaternion();
    for (const m of [right, left]) {
      for (const name of FINGERS) {
        const f = m.fingers[name];
        expect(f.mid.quaternion.angleTo(ident)).toBeLessThan(1e-6);
        expect(f.tip.quaternion.angleTo(ident)).toBeLessThan(1e-6);
        expect(Math.abs(f.mid.position.length() - f.segLens[0])).toBeLessThan(1e-4);
        expect(Math.abs(f.tip.position.length() - f.segLens[1])).toBeLessThan(1e-4);
        // 骨链自然弯度小,偏移应以指轴 +x 为主
        expect(f.mid.position.x).toBeGreaterThan(f.segLens[0] * 0.9);
        for (const l of f.segLens) expect(l).toBeGreaterThan(0);
      }
    }
  });

  it('驱动骨挂进对应代理组,且绑定世界位置与代理原点重合(双重变换回归)', () => {
    for (const m of [right, left]) {
      for (const name of FINGERS) {
        const f = m.fingers[name];
        const [j1, j2, j3] = CHAIN[name].drive;
        expect(boneByName(m, j1).parent).toBe(f.root);
        expect(boneByName(m, j2).parent).toBe(f.mid);
        expect(boneByName(m, j3).parent).toBe(f.tip);
        expect(boneByName(m, CHAIN[name].end).parent).toBe(f.tip);
        // 代理支点 = 骨绑定位:错一点弯指就绕垃圾支点转(蒙皮拉丝)
        expect(worldOf(boneByName(m, j1)).distanceTo(worldOf(f.root))).toBeLessThan(1e-3);
        expect(worldOf(boneByName(m, j2)).distanceTo(worldOf(f.mid))).toBeLessThan(1e-3);
        expect(worldOf(boneByName(m, j3)).distanceTo(worldOf(f.tip))).toBeLessThan(1e-3);
      }
    }
  });

  it('FK:mid 弯曲带动末端骨绕 mid 支点转(距离不变、位置变化)', () => {
    for (const m of [right, left]) {
      const f = m.fingers.index;
      const end = boneByName(m, CHAIN.index.end);
      const before = worldOf(end);
      const pivot = worldOf(f.mid);
      const r0 = before.distanceTo(pivot);
      f.mid.rotation.set(0, -0.8, 0);
      m.group.updateMatrixWorld(true);
      const after = worldOf(end);
      expect(after.distanceTo(before)).toBeGreaterThan(f.segLens[1] * 0.3); // 真的动了
      expect(Math.abs(after.distanceTo(pivot) - r0)).toBeLessThan(1e-3); // 绕支点刚体转
      f.mid.rotation.set(0, 0, 0);
      m.group.updateMatrixWorld(true);
    }
  });

  it('蒙皮网格换传入材质,几何带顶点色(vertexColors 契约)', () => {
    for (const [m, mat] of [[right, skinR], [left, skinL]] as const) {
      expect(m.meshes.length).toBeGreaterThan(0);
      const mesh = m.meshes[0];
      expect(mesh.material).toBe(mat);
      const geo = mesh.geometry;
      const color = geo.getAttribute('color');
      expect(color).toBeDefined();
      expect(color.count).toBe(geo.getAttribute('position').count);
    }
  });

  it('左右手为真镜像:食指根在手系 y 的符号相反', () => {
    const yR = worldOf(boneByName(right, 'index-finger-phalanx-proximal')).y;
    const yL = worldOf(boneByName(left, 'index-finger-phalanx-proximal')).y;
    expect(yR).toBeLessThan(0); // side=-1:食指在 -y
    expect(yL).toBeGreaterThan(0);
    expect(Math.abs(yR + yL)).toBeLessThan(4 * U); // 镜像资产,量值接近(雕刻件有 ~2U 不对称)
  });
});
