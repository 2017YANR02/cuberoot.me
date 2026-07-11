/**
 * /sim 手部皮肤贴图烘焙回归(computeHandMaps 纯计算核,Node 直烘 MANO 右手;
 * 资产 gitignored 缺失时整组 skip —— 内置 generic-hand GLB 已退役)。
 * 特征以 U(世界单位)定义,与分辨率无关 —— 用小图快测。锁:
 *  ① UV 光栅化覆盖率合理 + BFS 外扩后全图无空洞(mipmap 黑边回归);
 *  ② 肤色基调 r>g>b 且在肤色带内(别烘出灰紫手);
 *  ③ 无画甲:指甲只有立体甲片(handModelGltf 蒙皮薄壳),贴图里不许再出现
 *    低粗糙甲面区(画甲回归 = 一指三甲,2026-07-08 用户抓的);
 *  ④ bump 有中高频结构(毛孔/皱纹,不是平灰);
 *  ⑤ 确定性:imul 哈希噪声无随机状态,两次烘焙逐字节一致(刷新不换脸)。
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { buildManoHand, type ManoHandData } from '@/app/[lang]/sim/engine/hands/handModelMano';
import { computeHandMaps, type HandMapsData } from '@/app/[lang]/sim/engine/hands/bakeHandTexture';
import type { HandModel } from '@/app/[lang]/sim/engine/hands/handModel';

const S = 192;

const RIGHT = fileURLToPath(new URL('../public/sim/hands/mano/right.mano.json', import.meta.url));

async function loadRight(): Promise<HandModel> {
  const data = JSON.parse(await readFile(RIGHT, 'utf8')) as ManoHandData;
  return buildManoHand(data, -1, new THREE.MeshStandardMaterial(), 'right.mano.json');
}

describe.skipIf(!existsSync(RIGHT))('computeHandMaps 皮肤贴图烘焙', () => {
  let model: HandModel;
  let maps: HandMapsData;

  beforeAll(async () => {
    model = await loadRight();
    maps = await computeHandMaps(model, S);
  });

  it('光栅化覆盖率合理,外扩后全图无空洞', () => {
    expect(maps.coverage).toBeGreaterThan(0.25);
    expect(maps.coverage).toBeLessThan(0.95);
    for (const arr of [maps.albedo, maps.bump, maps.rough]) {
      for (let i = 0; i < S * S; i++) {
        if (arr[i * 4 + 3] !== 255) throw new Error(`pixel ${i} 未被填充(alpha=${arr[i * 4 + 3]})`);
      }
    }
  });

  it('肤色基调:r>g>b,均值在肤色带内', () => {
    let r = 0, g = 0, b = 0;
    const n = S * S;
    for (let i = 0; i < n; i++) {
      r += maps.albedo[i * 4];
      g += maps.albedo[i * 4 + 1];
      b += maps.albedo[i * 4 + 2];
    }
    r /= n * 255; g /= n * 255; b /= n * 255;
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    expect(r).toBeGreaterThan(0.6);
    expect(g / r).toBeGreaterThan(0.65);
    expect(g / r).toBeLessThan(0.92);
    expect(b / r).toBeGreaterThan(0.5);
    expect(b / r).toBeLessThan(0.85);
  });

  it('无画甲:贴图中不存在低粗糙甲面区', () => {
    // 皮肤 roughness ~0.585±小扰动;画甲(~0.32)一旦回归立刻掉进 <0.45 桶。
    let glossy = 0;
    for (let i = 0; i < S * S; i++) {
      if (maps.rough[i * 4] < 0.45 * 255) glossy++;
    }
    expect(glossy).toBe(0);
  });

  it('bump 有结构(非平灰)', () => {
    let sum = 0, sum2 = 0;
    const n = S * S;
    for (let i = 0; i < n; i++) {
      const v = maps.bump[i * 4];
      sum += v; sum2 += v * v;
    }
    const mean = sum / n;
    const std = Math.sqrt(sum2 / n - mean * mean);
    expect(mean).toBeGreaterThan(80);
    expect(mean).toBeLessThan(180);
    expect(std).toBeGreaterThan(4);
  });

  it('确定性:两次烘焙逐字节一致', async () => {
    const again = await computeHandMaps(model, 96);
    const ref = await computeHandMaps(model, 96);
    expect(again.coverage).toBe(ref.coverage);
    expect(Buffer.from(again.albedo).equals(Buffer.from(ref.albedo))).toBe(true);
    expect(Buffer.from(again.bump).equals(Buffer.from(ref.bump))).toBe(true);
    expect(Buffer.from(again.rough).equals(Buffer.from(ref.rough))).toBe(true);
  });
});
