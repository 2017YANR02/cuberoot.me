/**
 * sim_svg_export_schematic 单测 — SR 范式示意导出器。
 *
 * 直接把用户的两条硬性要求锁成断言:
 *  1. 每个小面 = 严格三角形(pyraminx:每条 path 恰 3 个坐标对,无切分碎片);
 *  2. 相邻小面共享棱的描边完全重合(共享顶点输出后逐字符串相等 → 去重后的
 *     顶点数 = 晶格顶点数,而非 3×面数)。
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { exportSimSvgSchematic, hasSchematicFacelets } from '@/app/[lang]/sim/sim_svg_export_schematic';
import { buildPyraPiece, buildCore, EDGE_PAIRS, PYRA_A } from '@/app/[lang]/sim/engine/pyra/pyraGeometry';
import { CUBE_FILL } from '@/lib/cube-colors';

function buildPyraScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.add(buildCore());
  for (let k = 0; k < 4; k++) {
    scene.add(buildPyraPiece('tip', k).pivot);
    scene.add(buildPyraPiece('corner', k).pivot);
  }
  for (const [a, b] of EDGE_PAIRS) scene.add(buildPyraPiece('edge', a, b).pivot);
  return scene;
}

/** 相机沿 +z 看原点:恰好 2 个面(m=1 红、m=2 蓝)朝向相机。 */
function makeWorld(scene: THREE.Scene): { scene: THREE.Scene; camera: THREE.PerspectiveCamera; width: number; height: number } {
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 10000);
  camera.position.set(0, 0, PYRA_A * 4);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  return { scene, camera, width: 400, height: 400 };
}

/** 小面 path 的 d(排除 clipPath 轮廓与 fill="none" 的外框线)。 */
function faceletDs(svg: string): string[] {
  return [...svg.matchAll(/<path d="([^"]+)" fill="(?!none)/g)].map((m) => m[1]);
}

describe('exportSimSvgSchematic', () => {
  it('覆盖面:pyraminx 36 张贴纸全部带 schematicPoly;hasSchematicFacelets 为真', () => {
    const scene = buildPyraScene();
    let stickers = 0, withPoly = 0;
    scene.traverse((o) => {
      if (o.userData.simRole === 'sticker') { stickers++; if (o.userData.schematicPoly) withPoly++; }
    });
    expect(stickers).toBe(36);
    expect(withPoly).toBe(36);
    expect(hasSchematicFacelets(scene)).toBe(true);
    expect(hasSchematicFacelets(new THREE.Scene())).toBe(false);
  });

  it('每个小面 = 严格三角形:2 个可见面 × 9 小面,每条 path 恰 3 个坐标对', () => {
    const world = makeWorld(buildPyraScene());
    const svg = exportSimSvgSchematic({ world });
    const ds = faceletDs(svg);
    expect(ds.length).toBe(18);
    for (const d of ds) {
      // M + 2 个 L + Z = 严格三角形,无 BSP 切分碎片
      expect(d.match(/M/g)?.length).toBe(1);
      expect(d.match(/L/g)?.length).toBe(2);
    }
  });

  it('相邻棱描边完全重合:输出顶点去重后 = 晶格顶点数(10+10−共享 4 = 16)', () => {
    const world = makeWorld(buildPyraScene());
    const svg = exportSimSvgSchematic({ world });
    const verts = new Set<string>();
    let refs = 0;
    for (const d of faceletDs(svg)) {
      for (const m of d.matchAll(/[ML](-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)) {
        verts.add(`${m[1]},${m[2]}`);
        refs++;
      }
    }
    expect(refs).toBe(54); // 18 三角 × 3
    // 每面晶格 10 顶点,两可见面共享一条棱上的 4 顶点 → 16。任何亚像素错位都会
    // 让去重数膨胀(两条"几乎同点"的顶点字符串不相等),此断言即"完全重合"。
    expect(verts.size).toBe(16);
  });

  it('平色 + 黑描边:fill=面色原值,stroke 黑,宽随参数;外缘凸包裁剪 + 外框;0 = 全无', () => {
    const world = makeWorld(buildPyraScene());
    const svg = exportSimSvgSchematic({ world, strokeWidth: 8 });
    // +z 视角可见面 m=1(红)m=2(蓝)
    expect(svg.toLowerCase()).toContain(CUBE_FILL.R.toLowerCase());
    expect(svg.toLowerCase()).toContain(CUBE_FILL.B.toLowerCase());
    // 18 小面 + 1 条凸包外框
    expect(svg.match(/stroke="#000000" stroke-width="8"/g)?.length).toBe(19);
    // 毛刺防线:小面描边被凸包 clip(外缘 miter 尖不出界),外框沿凸包重描
    expect(svg).toContain('<clipPath id="sil">');
    expect(svg).toContain('clip-path="url(#sil)"');
    expect(svg).toMatch(/<path d="[^"]+" fill="none" stroke="#000000"/);
    const bare = exportSimSvgSchematic({ world, strokeWidth: 0 });
    expect(bare).not.toContain('stroke');
    expect(bare).not.toContain('clipPath');
  });

  it('背面剔除:背对相机的面(m=0 黄 / m=3 绿)不输出', () => {
    const world = makeWorld(buildPyraScene());
    const svg = exportSimSvgSchematic({ world }).toLowerCase();
    expect(svg).not.toContain(CUBE_FILL.D.toLowerCase()); // m=0 黄
    expect(svg).not.toContain(CUBE_FILL.F.toLowerCase()); // m=3 绿
  });

  it('viewBox 贴拼图裁剪(sr 的紧凑取景),不导整张画布', () => {
    const world = makeWorld(buildPyraScene());
    const svg = exportSimSvgSchematic({ world });
    const m = svg.match(/viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/)!;
    expect(m).not.toBeNull();
    // 画布 400×400,拼图只占中间一部分 → 裁剪后视窗必须显著小于画布
    expect(Number(m[3])).toBeLessThan(400);
    expect(Number(m[4])).toBeLessThan(400);
    expect(Number(m[1])).toBeGreaterThan(0);
  });

  it('逐色描边:userData.schematicStroke 覆盖小面描边色,凸包外框仍默认黑', () => {
    const scene = buildPyraScene();
    scene.traverse((o) => { if (o.userData.schematicPoly) o.userData.schematicStroke = '#8811aa'; });
    const svg = exportSimSvgSchematic({ world: makeWorld(scene), strokeWidth: 8 });
    expect(svg.match(/stroke="#8811aa"/g)?.length).toBe(18); // 18 可见小面全部改色
    expect(svg.match(/stroke="#000000"/g)?.length).toBe(1);  // 只剩外框默认黑
  });

  it('arrows 箭头层:线段 + marker 按色去重,画在最上层不被凸包裁剪,viewBox 随箭头扩', () => {
    const world = makeWorld(buildPyraScene());
    const vb = (s: string) => s.match(/viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/)!;
    const base = exportSimSvgSchematic({ world });
    const svg = exportSimSvgSchematic({ world, arrows: [
      { p1: [-PYRA_A, 0, PYRA_A], p2: [PYRA_A, 0, PYRA_A] },
      { p1: [0, -PYRA_A, PYRA_A], p2: [0, PYRA_A, PYRA_A], color: '#ff0000', width: 4 },
    ] });
    expect(svg.match(/<line /g)?.length).toBe(2);
    expect(svg.match(/<marker /g)?.length).toBe(2); // 黑 / 红各一枚箭头 marker
    expect(svg).toContain('marker-end="url(#');
    expect(svg).toContain('stroke="#ff0000" stroke-width="4"');
    // 层序:箭头在最后(所有小面 path、凸包外框之后 → 盖在最上)
    expect(svg.lastIndexOf('<path')).toBeLessThan(svg.indexOf('<line'));
    // 不被凸包裁剪:<line> 在 clip 组 </g> 之外
    expect(svg.indexOf('</g>')).toBeLessThan(svg.indexOf('<line'));
    // 取景:箭头伸出拼图右侧时视窗宽度随之扩大
    const far = exportSimSvgSchematic({ world, arrows: [{ p1: [0, 0, PYRA_A], p2: [PYRA_A * 3, 0, PYRA_A] }] });
    expect(Number(vb(far)[3])).toBeGreaterThan(Number(vb(base)[3]));
  });

  it('相机跟随:旋转场景后输出改变(几何取自 matrixWorld,非固定标定)', () => {
    const scene = buildPyraScene();
    const world = makeWorld(scene);
    const before = exportSimSvgSchematic({ world });
    scene.rotation.y = 0.5;
    expect(exportSimSvgSchematic({ world })).not.toBe(before);
  });
});
