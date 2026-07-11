/**
 * @4 融合前臂守卫(SMPL-X 前臂在转换期缝进 MANO 手 —— 单一网格,无独立前臂
 * 件;资产为授权数据、gitignored、逐机转换,文件不存在时整组 skip)。
 * 覆盖:26 骨 + forearm 骨装配/驱动、闭合流形(UV 缝焊回后无边界边 —— 腕环
 * 桥接 + 肘端封盖的核心不变量)、左右镜像(骨骼位 + 包围盒)。
 */
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { buildManoHand, type ManoHandData } from '@/app/[lang]/sim/engine/hands/handModelMano';

const FILES = {
  right: fileURLToPath(new URL('../public/sim/hands/mano/right.mano.json', import.meta.url)),
  left: fileURLToPath(new URL('../public/sim/hands/mano/left.mano.json', import.meta.url)),
};
const HAVE = existsSync(FILES.right) && existsSync(FILES.left);

async function load(name: 'right' | 'left'): Promise<ManoHandData> {
  return JSON.parse(await readFile(FILES[name], 'utf8')) as ManoHandData;
}

function f32(b64: string): Float32Array {
  const buf = Buffer.from(b64, 'base64');
  return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}
function u32(b64: string): Uint32Array {
  const buf = Buffer.from(b64, 'base64');
  return new Uint32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

describe.skipIf(!HAVE)('mano @4 fused forearm', () => {
  it.each([
    ['right', -1],
    ['left', 1],
  ] as const)('%s: forearm bone assembled and drives only the arm', async (name, side) => {
    const data = await load(name);
    expect(data.format).toBe('cuberoot-mano-hand@4');
    expect(data.bones.length).toBe(26);
    expect(data.bones[25].name).toBe('forearm');
    // forearm 骨轴心 = 腕关节(绕腕摆)
    expect(data.bones[25].pos).toEqual(data.bones[0].pos);
    const m = buildManoHand(data, side, new THREE.MeshStandardMaterial(), name);
    expect(m.forearm).toBeTruthy();
    expect(m.forearm!.bone.name).toBe('forearm');
    // 绑定臂伸向(手局部腕→肘)≈ −x:臂是手轴的反向延长
    expect(m.forearm!.bindDir.x).toBeLessThan(-0.9);
    // 转 forearm 骨 → 臂段顶点动、手本体不动(蒙皮列正确切分)
    const mesh = m.meshes[0] as THREE.SkinnedMesh;
    const pos = mesh.geometry.getAttribute('position');
    m.group.updateMatrixWorld(true);
    const before: THREE.Vector3[] = [];
    for (let i = 0; i < pos.count; i += 17) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      mesh.applyBoneTransform(i, v);
      before.push(v);
    }
    m.forearm!.bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.3));
    m.group.updateMatrixWorld(true);
    let moved = 0;
    let k = 0;
    for (let i = 0; i < pos.count; i += 17) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      mesh.applyBoneTransform(i, v);
      if (v.distanceTo(before[k++]) > 1e-4) moved++; // 资产米制:0.1mm 阈
    }
    expect(moved, '臂段应随 forearm 骨动').toBeGreaterThan(20);
    expect(moved, '手本体不应整体漂移').toBeLessThan(k * 0.75);
  });

  it.each([
    ['right'],
    ['left'],
  ] as const)('%s: closed manifold after welding UV-seam duplicates', async (name) => {
    const data = await load(name);
    const pos = f32(data.position);
    const idx = u32(data.index);
    // UV 图集接缝顶点是复制的 —— 按位置量化焊回,再验闭合流形:
    // 每无向边恰 2 面。腕环桥接漏三角 / 肘盖缺口 / 非流形都会在此现形。
    const weld = new Map<string, number>();
    const remap = new Int32Array(pos.length / 3);
    for (let i = 0; i < pos.length / 3; i++) {
      const key = `${Math.round(pos[i * 3] * 1e6)},${Math.round(pos[i * 3 + 1] * 1e6)},${Math.round(pos[i * 3 + 2] * 1e6)}`;
      let id = weld.get(key);
      if (id === undefined) {
        id = weld.size;
        weld.set(key, id);
      }
      remap[i] = id;
    }
    const edges = new Map<string, number>();
    for (let t = 0; t < idx.length; t += 3) {
      for (let e = 0; e < 3; e++) {
        const a = remap[idx[t + e]];
        const b = remap[idx[t + ((e + 1) % 3)]];
        if (a === b) continue; // 缝焊回可能产生退化边,跳过
        const key = a < b ? `${a},${b}` : `${b},${a}`;
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    let open = 0;
    let multi = 0;
    for (const c of edges.values()) {
      if (c === 1) open++;
      else if (c > 2) multi++;
    }
    expect(open, '边界边(洞)').toBe(0);
    expect(multi, '非流形边').toBe(0);
  });

  it('left mirrors right (bones + bbox + forearmDir)', async () => {
    const r = await load('right');
    const l = await load('left');
    expect(l.counts.verts).toBe(r.counts.verts);
    expect(l.counts.faces).toBe(r.counts.faces);
    // 骨骼位:x 反号,y/z 相同(转换器在管线前镜像模板,J 精确镜像)
    for (let i = 0; i < 26; i++) {
      expect(l.bones[i].name).toBe(r.bones[i].name);
      expect(l.bones[i].pos[0]).toBeCloseTo(-r.bones[i].pos[0], 10);
      expect(l.bones[i].pos[1]).toBeCloseTo(r.bones[i].pos[1], 10);
      expect(l.bones[i].pos[2]).toBeCloseTo(r.bones[i].pos[2], 10);
    }
    expect(l.forearmDir[0]).toBeCloseTo(-r.forearmDir[0], 10);
    expect(l.forearmDir[1]).toBeCloseTo(r.forearmDir[1], 10);
    expect(l.forearmDir[2]).toBeCloseTo(r.forearmDir[2], 10);
    // 包围盒镜像(UV 缝复制顺序左右可不同,逐顶点比对不成立 —— box_unwrap
    // 岛划分随法线 x 分量反号而变)
    const rp = f32(r.position);
    const lp = f32(l.position);
    const bbox = (p: Float32Array): number[] => {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < p.length; i += 3) {
        x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]);
        y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]);
        z0 = Math.min(z0, p[i + 2]); z1 = Math.max(z1, p[i + 2]);
      }
      return [x0, x1, y0, y1, z0, z1];
    };
    const rb = bbox(rp);
    const lb = bbox(lp);
    expect(lb[0]).toBeCloseTo(-rb[1], 6);
    expect(lb[1]).toBeCloseTo(-rb[0], 6);
    expect(lb[2]).toBeCloseTo(rb[2], 6);
    expect(lb[3]).toBeCloseTo(rb[3], 6);
    expect(lb[4]).toBeCloseTo(rb[4], 6);
    expect(lb[5]).toBeCloseTo(rb[5], 6);
  });
});
