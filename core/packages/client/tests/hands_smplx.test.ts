/**
 * SMPL-X 真前臂件守卫(资产为授权数据、gitignored、逐机转换 —— 文件不存在时
 * 整组 skip)。覆盖:格式解码 → buildSmplxForearm 缩放/镜像/袖口 → 图集烘焙。
 */
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { buildSmplxForearm, type SmplxForearmData } from '@/app/[lang]/sim/engine/hands/handModelMano';
import { computeLimbMaps } from '@/app/[lang]/sim/engine/hands/bakeHandTexture';
import { HAND_SCALE } from '@/app/[lang]/sim/engine/hands/handModel';
import { SIZE } from '@/app/[lang]/sim/engine/define';

const FILE = fileURLToPath(new URL('../public/sim/hands/smplx/forearm.smplx.json', import.meta.url));
const U = (SIZE / 64) * HAND_SCALE;

async function load(): Promise<SmplxForearmData> {
  return JSON.parse(await readFile(FILE, 'utf8')) as SmplxForearmData;
}

describe.skipIf(!existsSync(FILE))('smplx forearm piece', () => {
  it('right: rig-frame calibration (wrist width, reach, overlap)', async () => {
    const mat = new THREE.MeshStandardMaterial();
    const { group, meshes } = buildSmplxForearm(await load(), -1, mat, mat);
    expect(meshes.length).toBe(2); // [臂肤, 袖口] — rig 烘焙契约取 meshes[0]
    const pos = (meshes[0].geometry as THREE.BufferGeometry).getAttribute('position');
    expect(pos.count).toBeGreaterThan(2000);
    let xMin = Infinity, xMax = -Infinity, hy = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      xMin = Math.min(xMin, x); xMax = Math.max(xMax, x);
      if (Math.abs(x) < 3 * U) hy = Math.max(hy, Math.abs(pos.getY(i)));
    }
    // 腕环半宽对齐程序化前臂 34.5U(±6U:环带中心可偏移),伸向 −x 肘端,
    // +x 端探进手模内腔(遮腕缝)
    expect(hy).toBeGreaterThan(28.5 * U);
    expect(hy).toBeLessThan(40.5 * U);
    expect(xMin).toBeLessThan(-150 * U);
    expect(xMin).toBeGreaterThan(-220 * U);
    expect(xMax).toBeGreaterThan(8 * U);
    // UV 图集在 [0,1]²(烘焙光栅化契约)
    const uv = (meshes[0].geometry as THREE.BufferGeometry).getAttribute('uv');
    for (let i = 0; i < uv.count; i += 13) {
      expect(uv.getX(i)).toBeGreaterThanOrEqual(-1e-4);
      expect(uv.getX(i)).toBeLessThanOrEqual(1.0001);
      expect(uv.getY(i)).toBeGreaterThanOrEqual(-1e-4);
      expect(uv.getY(i)).toBeLessThanOrEqual(1.0001);
    }
    expect(group.children.length).toBe(2);
  });

  it('left mirrors right across y (real forearm is asymmetric)', async () => {
    const mat = new THREE.MeshStandardMaterial();
    const data = await load();
    const r = buildSmplxForearm(data, -1, mat, mat).meshes[0].geometry as THREE.BufferGeometry;
    const l = buildSmplxForearm(data, 1, mat, mat).meshes[0].geometry as THREE.BufferGeometry;
    const rp = r.getAttribute('position'), lp = l.getAttribute('position');
    expect(lp.count).toBe(rp.count);
    let dMax = 0;
    for (let i = 0; i < rp.count; i += 7) {
      dMax = Math.max(
        dMax,
        Math.abs(lp.getX(i) - rp.getX(i)),
        Math.abs(lp.getY(i) + rp.getY(i)),
        Math.abs(lp.getZ(i) - rp.getZ(i)),
      );
    }
    expect(dMax).toBeLessThan(1e-4);
    // 镜像必须翻绕向,否则正面剔除下渲成 inside-out
    const ri = r.getIndex()!, li = l.getIndex()!;
    expect(li.getX(1)).toBe(ri.getX(2));
    expect(li.getX(2)).toBe(ri.getX(1));
  });

  it('limb maps bake on the atlas with no holes', async () => {
    const mat = new THREE.MeshStandardMaterial();
    const geo = buildSmplxForearm(await load(), -1, mat, mat).meshes[0].geometry as THREE.BufferGeometry;
    const maps = computeLimbMaps(geo, 128);
    let holes = 0;
    for (let i = 3; i < maps.albedo.length; i += 4) if (maps.albedo[i] !== 255) holes++;
    expect(holes).toBe(0); // 外扩 flood fill 后不留未初始化像素
  });
});
