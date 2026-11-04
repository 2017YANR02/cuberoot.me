/**
 * MANO 手模适配层守卫(资产为授权数据、gitignored、逐机转换 —— 文件不存在时
 * 整组 skip,CI/他机零成本;本机跑过 scripts/convert-mano.py 后自动生效)。
 * 覆盖:转换格式 → buildManoHand → adaptGltfHand 全链;25 骨齐名、五指代理
 * 关节 + 四指 meta、甲片、蒙皮顶点有限性。
 */
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { buildManoHand, createPoseNormalUpdater, type ManoHandData } from '@/app/[lang]/sim/engine/hands/handModelMano';
import { JOINT_CHAINS } from '@/app/[lang]/sim/engine/hands/handModelGltf';
import { computeHandMaps } from '@/app/[lang]/sim/engine/hands/bakeHandTexture';
import type { FingerName } from '@/app/[lang]/sim/engine/hands/handModel';

const FILES = {
  right: fileURLToPath(new URL('../public/sim/hands/mano/right.mano.json', import.meta.url)),
  left: fileURLToPath(new URL('../public/sim/hands/mano/left.mano.json', import.meta.url)),
};
const HAVE = existsSync(FILES.right) && existsSync(FILES.left);
const FINGERS: FingerName[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];

describe('pose-corrected skin normals', () => {
  it('UV seam duplicates share the corrected surface normal without moving the skin', () => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      0, 0, 0, 0, 1, 0, -1, 0, 0,
    ], 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(Array(6).fill([0, 0, 1]).flat(), 3));
    geo.setIndex([0, 1, 2, 3, 4, 5]);
    const update = createPoseNormalUpdater(geo);
    const position = geo.getAttribute('position');
    position.setZ(5, 1);
    const corrected = Array.from(position.array);
    update();
    const normal = geo.getAttribute('normal');
    expect(normal.getX(0)).toBeCloseTo(1 / Math.sqrt(5), 6);
    expect(normal.getZ(0)).toBeCloseTo(2 / Math.sqrt(5), 6);
    for (const [a, b] of [[0, 3], [2, 4]]) {
      expect([normal.getX(a), normal.getY(a), normal.getZ(a)])
        .toEqual([normal.getX(b), normal.getY(b), normal.getZ(b)]);
    }
    expect(Array.from(position.array)).toEqual(corrected);
    geo.dispose();
  });
});

describe.skipIf(!HAVE)('mano hand adapter', () => {
  it.each([
    ['right', -1],
    ['left', 1],
  ] as const)('%s: builds a full HandModel', async (name, side) => {
    const data = JSON.parse(await readFile(FILES[name], 'utf8')) as ManoHandData;
    const m = buildManoHand(data, side, new THREE.MeshStandardMaterial(), name);
    expect(m.side).toBe(side);
    // 25 关节全部按 WebXR 名可寻址(adaptGltfHand 已把它们 attach 进代理链)
    for (const f of FINGERS) {
      const chain = JOINT_CHAINS[f];
      for (const bn of [...chain.drive, chain.end, ...(chain.static ? [chain.static] : [])]) {
        expect(m.group.getObjectByName(bn), bn).toBeTruthy();
      }
      const fj = m.fingers[f];
      expect(fj.root).toBeTruthy();
      for (const len of fj.segLens) expect(len).toBeGreaterThan(0);
      if (f === 'thumb') expect(fj.meta).toBeUndefined();
      else expect(fj.meta, `${f} meta`).toBeTruthy();
    }
    expect(m.group.getObjectByName('wrist')).toBeTruthy();
    // 甲片:五指各一块
    expect(m.nailMeshes?.length).toBe(5);
    // 蒙皮网格:细分后 ≥3000 顶点,绑定姿态下顶点全有限
    const mesh = m.meshes[0] as THREE.SkinnedMesh;
    const pos = mesh.geometry.getAttribute('position');
    expect(pos.count).toBeGreaterThan(770);
    m.group.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 97) {
      v.fromBufferAttribute(pos, i);
      mesh.applyBoneTransform(i, v);
      expect(Number.isFinite(v.x + v.y + v.z), `vert ${i}`).toBe(true);
    }
  });

  it.each([
    ['right', -1],
    ['left', 1],
  ] as const)('%s: posedirs corrective is pose-driven', async (name, side) => {
    const data = JSON.parse(await readFile(FILES[name], 'utf8')) as ManoHandData;
    const m = buildManoHand(data, side, new THREE.MeshStandardMaterial(), name);
    const pos = (m.meshes[0] as THREE.SkinnedMesh).geometry.getAttribute('position');
    const normal = (m.meshes[0] as THREE.SkinnedMesh).geometry.getAttribute('normal') as THREE.BufferAttribute;
    const before = Float32Array.from(pos.array as Float32Array);
    m.group.updateMatrixWorld(true);
    m.poseCorrective!();
    let dBind = 0;
    for (let i = 0; i < before.length; i++) dBind = Math.max(dBind, Math.abs((pos.array as Float32Array)[i] - before[i]));
    expect(dBind, '绑定姿系数全零,几何不动').toBeLessThan(1e-5); // 资产空间(米)
    const normalsBefore = Float32Array.from(normal.array);
    // 拇指根大旋转 → 修正场生效(鱼际隆起毫米级)
    m.fingers.thumb.root.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 1.2));
    m.group.updateMatrixWorld(true);
    m.poseCorrective!();
    let dPose = 0;
    for (let i = 0; i < before.length; i++) dPose = Math.max(dPose, Math.abs((pos.array as Float32Array)[i] - before[i]));
    expect(dPose, '大姿态下有修正位移').toBeGreaterThan(5e-4);
    expect(dPose, '修正位移毫米级,不该到厘米级爆炸').toBeLessThan(0.05);
    let normalDelta = 0;
    for (let i = 0; i < normalsBefore.length; i++) normalDelta = Math.max(normalDelta, Math.abs(normal.array[i] - normalsBefore[i]));
    expect(normalDelta, '修正后的曲面必须更新高光方向').toBeGreaterThan(1e-3);
    const normalVersion = normal.version;
    m.poseCorrective!();
    expect(normal.version, '同一姿态不重复计算法线').toBe(normalVersion);
  });

  it.each([
    ['right', -1],
    ['left', 1],
  ] as const)('%s: skin maps bake on the UV atlas', async (name, side) => {
    // 转换器 @2 的盒式投影图集契约:UV 单射、岛间留 gutters —— 烘焙光栅化
    // 覆盖率应落在「有实覆盖但非满图」区间;图集重叠/挤压会把覆盖率推向异常。
    const data = JSON.parse(await readFile(FILES[name], 'utf8')) as ManoHandData;
    const m = buildManoHand(data, side, new THREE.MeshStandardMaterial(), name);
    const maps = await computeHandMaps(m, 256);
    // 下限对齐 hands_texture.test.ts 的 generic 守卫(0.25);盒式投影固有
    // cos 损耗 + 货架打包留隙,实测 ~0.26。
    expect(maps.coverage).toBeGreaterThan(0.25);
    expect(maps.coverage).toBeLessThan(0.95);
    // 外扩后不留未初始化像素(alpha 全 255)
    let holes = 0;
    for (let i = 3; i < maps.albedo.length; i += 4) if (maps.albedo[i] !== 255) holes++;
    expect(holes).toBe(0);
  });
});
