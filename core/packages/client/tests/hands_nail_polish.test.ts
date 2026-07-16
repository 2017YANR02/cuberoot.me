/**
 * 甲片「指甲配色」重涂回归(paintNailPolish,issue #31):
 *  ① 合成甲片(无资产依赖,CI 常跑):涂色改顶点色、渐变沿轴向 t 单调、
 *    深浅(淡向白 / 深向黑)方向正确、还原自然甲逐字节一致、非法色值兜底;
 *  ② MANO 真资产(gitignored,缺失 skip):五指甲片均带 polish 属性,
 *    真涂 / 还原全链可逆。
 */
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { paintNailPolish } from '@/app/[lang]/sim/engine/hands/handModelGltf';
import { buildManoHand, type ManoHandData } from '@/app/[lang]/sim/engine/hands/handModelMano';
import type { HandModel } from '@/app/[lang]/sim/engine/hands/handModel';

/** 最小合成甲片:3 个顶点分别落在 甲根(t=0,带融肤)/ 中段(t=0.5)/ 尖端(t=1)。 */
function makeModel(): { model: HandModel; mesh: THREE.Mesh; mat: THREE.MeshPhysicalMaterial } {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 2, 0, 0], 3));
  // 自然甲底色(近似 buildNailGeometry 的甲床粉)
  geo.setAttribute('color', new THREE.Float32BufferAttribute([0.95, 0.85, 0.8, 0.93, 0.8, 0.76, 0.99, 0.95, 0.91], 3));
  // polish = (轴向 t, 阴影乘数, 根部融肤)
  geo.setAttribute('polish', new THREE.Float32BufferAttribute([0, 1, 0.8, 0.5, 1, 0, 1, 0.9, 0], 3));
  const mesh = new THREE.Mesh(geo);
  const mat = new THREE.MeshPhysicalMaterial();
  const model = { nailMeshes: [mesh], extraMats: [mat] } as unknown as HandModel;
  return { model, mesh, mat };
}

const colors = (mesh: THREE.Mesh): Float32Array =>
  Float32Array.from((mesh.geometry.getAttribute('color') as THREE.BufferAttribute).array as Float32Array);

describe('paintNailPolish(合成甲片)', () => {
  it('纯色涂装:非融肤顶点被重涂,还原自然甲逐字节一致', () => {
    const { model, mesh } = makeModel();
    const natural = colors(mesh);
    paintNailPolish(model, { color: '#C21807', tip: '', shade: 50 });
    const painted = colors(mesh);
    // 中段 / 尖端顶点(rootBlend=0)必然变色(红甲 g/b 远低于自然甲床粉)
    expect(painted[4]).toBeLessThan(natural[4] - 0.3);
    expect(painted[7]).toBeLessThan(natural[7] - 0.3);
    paintNailPolish(model, null);
    expect(colors(mesh)).toEqual(natural);
  });

  it('渐变:红→白沿轴向 t 单调变亮;尖端阴影乘数仍生效', () => {
    const { model, mesh } = makeModel();
    paintNailPolish(model, { color: '#C21807', tip: '#F5F0EA', shade: 50 });
    const c = colors(mesh);
    // g 通道:根(融肤前的基色)< 中段 < 尖端(白 × 0.9 阴影仍远高于中段红)
    expect(c[4]).toBeGreaterThan(0);
    expect(c[7]).toBeGreaterThan(c[4]);
    // 根部融肤:t=0 顶点朝肤色(g≈0.84)拉了 0.8,应高于中段纯红
    expect(c[1]).toBeGreaterThan(c[4]);
  });

  it('深浅:淡(0)提亮、深(100)压暗,同一底色三档单调', () => {
    const { model, mesh } = makeModel();
    const g = (shade: number): number => {
      paintNailPolish(model, { color: '#C21807', tip: '', shade });
      return colors(mesh)[4]; // 中段顶点 g 通道
    };
    const light = g(0), mid = g(50), dark = g(100);
    expect(light).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(dark);
  });

  it('非法色值兜回自然甲(入口校验,不产出 NaN 垃圾色)', () => {
    const { model, mesh } = makeModel();
    const natural = colors(mesh);
    paintNailPolish(model, { color: 'red', tip: '', shade: 50 });
    expect(colors(mesh)).toEqual(natural);
    for (const v of colors(mesh)) expect(Number.isFinite(v)).toBe(true);
  });

  it('材质光泽随涂装切换并可还原', () => {
    const { model, mat } = makeModel();
    const rough0 = mat.roughness;
    paintNailPolish(model, { color: '#212121', tip: '', shade: 50 });
    expect(mat.clearcoat).toBeGreaterThan(0.12);
    paintNailPolish(model, null);
    expect(mat.roughness).toBeCloseTo(0.32);
    expect(rough0).toBeGreaterThan(0); // 哑光基线存在(构造默认非 0)
  });
});

const FILES = {
  right: fileURLToPath(new URL('../public/sim/hands/mano/right.mano.json', import.meta.url)),
  left: fileURLToPath(new URL('../public/sim/hands/mano/left.mano.json', import.meta.url)),
};
const HAVE = existsSync(FILES.right) && existsSync(FILES.left);

describe.skipIf(!HAVE)('paintNailPolish(MANO 真资产)', () => {
  it.each([
    ['right', -1],
    ['left', 1],
  ] as const)('%s: 五指甲片带 polish 属性,涂/还原可逆', async (name, side) => {
    const data = JSON.parse(await readFile(FILES[name], 'utf8')) as ManoHandData;
    const m = buildManoHand(data, side, new THREE.MeshStandardMaterial(), name);
    expect(m.nailMeshes?.length).toBe(5);
    const naturals = (m.nailMeshes ?? []).map((n) => colors(n));
    for (const n of m.nailMeshes ?? []) {
      const par = n.geometry.getAttribute('polish');
      expect(par?.count).toBe(n.geometry.getAttribute('color').count);
    }
    paintNailPolish(m, { color: '#7B1F3A', tip: '#F48FB1', shade: 60 });
    (m.nailMeshes ?? []).forEach((n, i) => {
      const c = colors(n);
      let diff = 0;
      for (let k = 0; k < c.length; k++) diff = Math.max(diff, Math.abs(c[k] - naturals[i][k]));
      expect(diff, `nail ${i} 应被重涂`).toBeGreaterThan(0.05);
      for (const v of c) expect(Number.isFinite(v)).toBe(true);
    });
    paintNailPolish(m, null);
    (m.nailMeshes ?? []).forEach((n, i) => {
      expect(colors(n), `nail ${i} 还原`).toEqual(naturals[i]);
    });
  });
});
