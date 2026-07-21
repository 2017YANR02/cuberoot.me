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
import {
  buildCornerMesh, buildCenterMesh, buildCore as buildSkewbCore, H as SKEWB_H,
} from '@/app/[lang]/sim/engine/skewb/skewbGeometry';
import {
  buildCornerPiece, buildEdgePiece, buildCenterPiece, buildCore as buildMegaCore, R_IN as MEGA_R,
} from '@/app/[lang]/sim/engine/mega/megaGeometry';
import { FACE_NORMAL as MEGA_FACE_NORMAL } from '@/app/[lang]/sim/engine/mega/megaState';
import { buildFtoPieces, R_IN as FTO_R } from '@/app/[lang]/sim/engine/fto/ftoGeometry';
import { FACE_NORMAL as FTO_FACE_NORMAL } from '@/app/[lang]/sim/engine/fto/ftoState';
import {
  buildPieceMesh, buildMiddlePair, placementForSlot, isCornerPiece,
  HALF_MID, W as SQ1_W, SQ1_COLORS,
} from '@/app/[lang]/sim/engine/sq1/sq1Geometry';
import { solvedSq1 } from '@/app/[lang]/sim/engine/sq1/sq1State';
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

/** 任意方向 face-on 相机(俯视 / 仰视时换 up 轴避免 lookAt 退化)。 */
function worldFor(scene: THREE.Scene, dir: THREE.Vector3, dist: number): { scene: THREE.Scene; camera: THREE.PerspectiveCamera; width: number; height: number } {
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 10000);
  const n = dir.clone().normalize();
  if (Math.abs(n.y) > 0.99) camera.up.set(1, 0, 0);
  camera.position.copy(n).multiplyScalar(dist);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  return { scene, camera, width: 400, height: 400 };
}

/** 小面 path 的全部输出顶点(解析为数值)。 */
function faceletVerts(svg: string): [number, number][] {
  const out: [number, number][] = [];
  for (const d of faceletDs(svg)) {
    for (const m of d.matchAll(/[ML](-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)) {
      out.push([Number(m[1]), Number(m[2])]);
    }
  }
  return out;
}

/** 把顶点按 eps 聚成簇(0.01px 量化孪生并簇),返回簇代表。代表数 = 真实晶格
 *  点数;若两个"应当同点"的顶点错位 > eps,代表数会膨胀 → 共点断言失败。 */
function clusterReps(verts: [number, number][], eps = 0.05): [number, number][] {
  const reps: [number, number][] = [];
  for (const v of verts) {
    if (!reps.some((r) => Math.hypot(r[0] - v[0], r[1] - v[1]) < eps)) reps.push(v);
  }
  return reps;
}

/** 簇代表间最小距离:> 阈值 = 不存在亚像素错位的"伪共点"。 */
function minGap(reps: [number, number][]): number {
  let d = Infinity;
  for (let i = 0; i < reps.length; i++) for (let j = i + 1; j < reps.length; j++) {
    d = Math.min(d, Math.hypot(reps[i][0] - reps[j][0], reps[i][1] - reps[j][1]));
  }
  return d;
}

/** path 顶点数直方图:d 中 L 命令数 → 条数(严格多边形断言用)。 */
function lCounts(svg: string): Map<number, number> {
  const m = new Map<number, number>();
  for (const d of faceletDs(svg)) {
    const l = d.match(/L/g)?.length ?? 0;
    m.set(l, (m.get(l) ?? 0) + 1);
  }
  return m;
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

  it('非凸守卫:小面铺不满凸包(两个分离三角)→ 跳过凸包裁剪 + 外框,描边仍在', () => {
    const scene = new THREE.Scene();
    for (const x of [-150, 100]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
      m.userData.schematicPoly = [x, 0, 0, x + 50, 0, 0, x, 50, 0]; // 朝 +z 的三角
      scene.add(m);
    }
    const svg = exportSimSvgSchematic({ world: makeWorld(scene as never as ReturnType<typeof buildPyraScene>), strokeWidth: 8 });
    expect(faceletDs(svg).length).toBe(2);
    expect(svg).not.toContain('clipPath'); // 凸包线会横跨两三角间的空隙 → 禁用
    expect(svg.match(/stroke="#000000"/g)?.length).toBe(2); // 小面描边保留,无外框
  });
});

describe('exportSimSvgSchematic — skewb', () => {
  function buildSkewbScene(): THREE.Scene {
    const scene = new THREE.Scene();
    scene.add(buildSkewbCore());
    for (let i = 0; i < 8; i++) scene.add(buildCornerMesh(i).pivot);
    for (let i = 0; i < 6; i++) scene.add(buildCenterMesh(i).pivot);
    return scene;
  }

  it('F face-on:4 角三角 + 1 中心菱形,晶格去重 8 点(4 角 + 4 棱中点)', () => {
    const world = worldFor(buildSkewbScene(), new THREE.Vector3(0, 0, 1), SKEWB_H * 4);
    const svg = exportSimSvgSchematic({ world });
    const l = lCounts(svg);
    expect(l.get(2)).toBe(4); // 三角
    expect(l.get(3)).toBe(1); // 菱形
    expect(faceletDs(svg).length).toBe(5);
    const reps = clusterReps(faceletVerts(svg));
    expect(reps.length).toBe(8);
    expect(minGap(reps)).toBeGreaterThan(2); // 无亚像素伪共点
    expect(svg).toContain('clipPath'); // 凸体 → 凸包外框启用
  });
});

describe('exportSimSvgSchematic — megaminx', () => {
  function buildMegaScene(): THREE.Scene {
    const scene = new THREE.Scene();
    scene.add(buildMegaCore());
    for (let f = 0; f < 12; f++) scene.add(buildCenterPiece(f).pivot);
    for (let i = 0; i < 20; i++) scene.add(buildCornerPiece(i).pivot);
    for (let i = 0; i < 30; i++) scene.add(buildEdgePiece(i).pivot);
    return scene;
  }

  it('face-on:正面 + 5 邻面可见 = 66 小面(6 五边形中心 + 60 四边形),共点无错位', () => {
    const scene = buildMegaScene();
    const [nx, ny, nz] = MEGA_FACE_NORMAL[0];
    const world = worldFor(scene, new THREE.Vector3(nx, ny, nz), MEGA_R * 4);
    const svg = exportSimSvgSchematic({ world });
    const l = lCounts(svg);
    expect(l.get(4)).toBe(6);  // 中心五边形
    expect(l.get(3)).toBe(60); // 角 + 棱四边形
    expect(faceletDs(svg).length).toBe(66);
    const verts = faceletVerts(svg);
    const reps = clusterReps(verts);
    expect(reps.length).toBeLessThan(verts.length / 2); // 强共享:晶格点被多面引用
    expect(minGap(reps)).toBeGreaterThan(2);
    expect(svg).toContain('clipPath');
  });
});

describe('exportSimSvgSchematic — fto', () => {
  function buildFtoScene(): THREE.Scene {
    const scene = new THREE.Scene();
    for (const p of buildFtoPieces()) scene.add(p.pivot);
    return scene;
  }

  it('face-on:正面 + 3 侧面 = 36 三角小面,晶格去重 28 点(4×10 − 3 棱×4 共享)', () => {
    const scene = buildFtoScene();
    const [nx, ny, nz] = FTO_FACE_NORMAL[0];
    const world = worldFor(scene, new THREE.Vector3(nx, ny, nz), FTO_R * 4);
    const svg = exportSimSvgSchematic({ world });
    expect(lCounts(svg).get(2)).toBe(36); // 全部严格三角
    expect(faceletDs(svg).length).toBe(36);
    const reps = clusterReps(faceletVerts(svg));
    expect(reps.length).toBe(28);
    expect(minGap(reps)).toBeGreaterThan(2);
    expect(svg).toContain('clipPath');
  });
});

describe('exportSimSvgSchematic — sq1', () => {
  const hexOfInt = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

  /** solved 摆位(复刻 Sq1Cube.applyStateInstant,不 import Cube 类 —— 它的
   *  import 链会在模块级起 rAF 循环,Node 下没有)。 */
  function buildSq1Scene(): THREE.Scene {
    const scene = new THREE.Scene();
    const state = solvedSq1();
    const pieceSlot = new Map<number, number>();
    for (let s = 0; s < 24; s++) if (!pieceSlot.has(state.pieces[s])) pieceSlot.set(state.pieces[s], s);
    for (let piece = 0; piece <= 15; piece++) {
      const isTop = piece <= 7;
      const { pivot } = buildPieceMesh(piece, isTop);
      const { angleRad } = placementForSlot(pieceSlot.get(piece)!, isCornerPiece(piece));
      pivot.position.set(0, isTop ? HALF_MID : -HALF_MID, 0);
      pivot.rotation.set(0, angleRad, 0);
      scene.add(pivot);
    }
    const { big, small } = buildMiddlePair();
    scene.add(big);
    scene.add(small);
    return scene;
  }

  it('solved 俯视:顶层 8 小面(4 风筝 + 4 楔形),去重 13 点(心 1 + 割 8 + 角 4)', () => {
    const scene = buildSq1Scene();
    const world = worldFor(scene, new THREE.Vector3(0, 1, 0), SQ1_W * 4);
    const svg = exportSimSvgSchematic({ world });
    const l = lCounts(svg);
    expect(l.get(3)).toBe(4); // 角块风筝
    expect(l.get(2)).toBe(4); // 楔块三角
    expect(faceletDs(svg).length).toBe(8);
    expect(svg.toLowerCase()).toContain(hexOfInt(SQ1_COLORS.U));
    const reps = clusterReps(faceletVerts(svg));
    expect(reps.length).toBe(13);
    expect(minGap(reps)).toBeGreaterThan(2);
    expect(svg).toContain('clipPath'); // solved = 正方体,凸 → 外框启用
  });

  it('仰视:底层 pivot scale.y=−1(det<0)绕向翻转被兜住,8 小面可见且为 D 色', () => {
    const scene = buildSq1Scene();
    const world = worldFor(scene, new THREE.Vector3(0, -1, 0), SQ1_W * 4);
    const svg = exportSimSvgSchematic({ world });
    expect(faceletDs(svg).length).toBe(8); // det 翻转缺失时这里会被整层背剔成 0
    expect(svg.toLowerCase()).toContain(hexOfInt(SQ1_COLORS.D));
  });

  it('斜视:顶 + 两侧墙 + 中层墙同时可见,墙面小面与顶面小面在立方棱上共点', () => {
    const scene = buildSq1Scene();
    const world = worldFor(scene, new THREE.Vector3(1, 0.8, 1), SQ1_W * 4.5);
    const svg = exportSimSvgSchematic({ world });
    // 可见集非空且包含侧墙色(F/R 至少其一)与 U 色
    expect(faceletDs(svg).length).toBeGreaterThan(10);
    expect(svg.toLowerCase()).toContain(hexOfInt(SQ1_COLORS.U));
    const reps = clusterReps(faceletVerts(svg));
    expect(minGap(reps)).toBeGreaterThan(2); // 顶/墙/中层三方交界处无亚像素错位
  });
});
