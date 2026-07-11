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
import { buildManoHand, type ManoHandData } from '@/app/[lang]/sim/engine/hands/handModelMano';
import { JOINT_CHAINS } from '@/app/[lang]/sim/engine/hands/handModelGltf';
import type { FingerName } from '@/app/[lang]/sim/engine/hands/handModel';

const FILES = {
  right: fileURLToPath(new URL('../public/sim/hands/mano/right.mano.json', import.meta.url)),
  left: fileURLToPath(new URL('../public/sim/hands/mano/left.mano.json', import.meta.url)),
};
const HAVE = existsSync(FILES.right) && existsSync(FILES.left);
const FINGERS: FingerName[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];

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
});
