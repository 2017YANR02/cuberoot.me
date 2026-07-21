/**
 * sim_svg_export_schematic 单测 — visualcube inset 范式示意导出器。
 *
 * 硬性要求锁成断言:
 *  1. 每个小面 = 严格多边形(pyraminx:每条贴纸 path 恰 3 个坐标对,无切分碎片);
 *  2. 相邻小面共享棱严丝合缝:衬底多边形在理想晶格位置,共享顶点输出后逐字符串
 *     相等 → 去重后的顶点数 = 晶格顶点数,而非 3×面数;
 *  3. 网格 = inset 模型(贴纸向心缩 + 壳色衬底),缝宽是小面比例而非绝对 px ——
 *     高阶不发黑的结构保证。
 */
import './_raf_stub'; // 必须最先:nxn/cube 的 import 链在模块加载期就起 rAF 循环
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import Cube from '@/app/[lang]/sim/engine/nxn/cube';
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

/** 贴纸 path 的 d(无 stroke,`fill="…"/>` 即闭合;衬底带 stroke 不命中)。
 *  注意:arrow marker 的三角 path 也无 stroke —— 组合 arrows 的用例别用本助手。 */
function faceletDs(svg: string): string[] {
  return [...svg.matchAll(/<path d="([^"]+)" fill="[^"]+"\/>/g)].map((m) => m[1]);
}

/** 衬底 path 的 d(带同色封缝 stroke 的晶格多边形)。 */
function backingDs(svg: string): string[] {
  return [...svg.matchAll(/<path d="([^"]+)" fill="[^"]+" stroke=/g)].map((m) => m[1]);
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

function vertsOf(ds: string[]): [number, number][] {
  const out: [number, number][] = [];
  for (const d of ds) {
    for (const m of d.matchAll(/[ML](-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)) {
      out.push([Number(m[1]), Number(m[2])]);
    }
  }
  return out;
}

/** 晶格共点断言用:衬底 path 的全部输出顶点(贴纸被 inset,不在晶格上)。 */
function backingVerts(svg: string): [number, number][] {
  return vertsOf(backingDs(svg));
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

/** 贴纸 path 顶点数直方图:d 中 L 命令数 → 条数(严格多边形断言用)。 */
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

  it('每个小面 = 严格三角形:2 个可见面 × 9 小面,贴纸 + 衬底各 18 条 path', () => {
    const world = makeWorld(buildPyraScene());
    const svg = exportSimSvgSchematic({ world });
    const ds = faceletDs(svg);
    expect(ds.length).toBe(18);
    expect(backingDs(svg).length).toBe(18);
    for (const d of ds) {
      // M + 2 个 L + Z = 严格三角形,无 BSP 切分碎片
      expect(d.match(/M/g)?.length).toBe(1);
      expect(d.match(/L/g)?.length).toBe(2);
    }
  });

  it('相邻棱严丝合缝:衬底顶点去重后 = 晶格顶点数(10+10−共享 4 = 16)', () => {
    const world = makeWorld(buildPyraScene());
    const svg = exportSimSvgSchematic({ world });
    const verts = new Set<string>();
    let refs = 0;
    for (const d of backingDs(svg)) {
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

  it('inset 网格:衬底黑 + 同色封缝描边;inset:0 = 无衬底、贴纸铺满回到晶格', () => {
    const world = makeWorld(buildPyraScene());
    const svg = exportSimSvgSchematic({ world, inset: 0.15 });
    // +z 视角可见面 m=1(红)m=2(蓝)
    expect(svg.toLowerCase()).toContain(CUBE_FILL.R.toLowerCase());
    expect(svg.toLowerCase()).toContain(CUBE_FILL.B.toLowerCase());
    // 18 衬底:壳体色填充 + 同色 1px 封缝描边(旧凸包裁剪 + 外框 hack 已随
    // 描边模型退役 —— 衬底铺满外形,外轮廓天然是数学直线)
    expect(svg.match(/fill="#000000" stroke="#000000" stroke-width="1"/g)?.length).toBe(18);
    expect(svg).not.toContain('clipPath');
    // 贴纸缝:inset 后贴纸顶点离开晶格 → 与衬底顶点无一重合
    const lattice = clusterReps(backingVerts(svg));
    const stickerReps = clusterReps(vertsOf(faceletDs(svg)));
    for (const s of stickerReps) {
      expect(lattice.some((l) => Math.hypot(l[0] - s[0], l[1] - s[1]) < 0.5)).toBe(false);
    }
    // inset 0:贴纸铺满,无衬底无描边,贴纸顶点回到晶格(去重 16)
    const bare = exportSimSvgSchematic({ world, inset: 0 });
    expect(bare).not.toContain('stroke');
    expect(backingDs(bare).length).toBe(0);
    expect(clusterReps(vertsOf(faceletDs(bare))).length).toBe(16);
  });

  it('visualcube 参数:bodyColor 换衬底色;body/stickerOpacity 出 opacity 属性', () => {
    const world = makeWorld(buildPyraScene());
    const svg = exportSimSvgSchematic({
      world, bodyColor: '#333333', bodyOpacity: 40, stickerOpacity: 50,
    });
    expect(svg.match(/fill="#333333" stroke="#333333" stroke-width="1"[^/]*opacity="0.4"/g)?.length).toBe(18);
    expect(svg.match(/opacity="0.5"/g)?.length).toBe(18); // 18 贴纸
    const opaque = exportSimSvgSchematic({ world });
    expect(opaque).not.toContain('opacity'); // 100% 时不冗余输出
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

  it('逐面衬底色:userData.schematicStroke 覆盖该小面衬底,其余仍默认壳体色', () => {
    const scene = buildPyraScene();
    scene.traverse((o) => { if (o.userData.schematicPoly) o.userData.schematicStroke = '#8811aa'; });
    const svg = exportSimSvgSchematic({ world: makeWorld(scene) });
    expect(svg.match(/fill="#8811aa" stroke="#8811aa"/g)?.length).toBe(18); // 全部改色
    expect(svg).not.toContain('#000000'); // 默认黑衬底一条不剩
  });

  it('arrows 箭头层:线段 + marker 按色去重,画在最上层,viewBox 随箭头扩', () => {
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
    // 层序:箭头在最后(所有小面 path 之后 → 盖在最上)
    expect(svg.lastIndexOf('<path')).toBeLessThan(svg.indexOf('<line'));
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

  it('非凸布局(两个分离三角)照常输出:inset 模型无凸包依赖', () => {
    const scene = new THREE.Scene();
    for (const x of [-150, 100]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
      m.userData.schematicPoly = [x, 0, 0, x + 50, 0, 0, x, 50, 0]; // 朝 +z 的三角
      scene.add(m);
    }
    const svg = exportSimSvgSchematic({ world: makeWorld(scene as never as ReturnType<typeof buildPyraScene>) });
    expect(faceletDs(svg).length).toBe(2);
    expect(backingDs(svg).length).toBe(2);
    expect(svg).not.toContain('clipPath');
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
    const reps = clusterReps(backingVerts(svg));
    expect(reps.length).toBe(8);
    expect(minGap(reps)).toBeGreaterThan(2); // 无亚像素伪共点
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
    const verts = backingVerts(svg);
    const reps = clusterReps(verts);
    expect(reps.length).toBeLessThan(verts.length / 2); // 强共享:晶格点被多面引用
    expect(minGap(reps)).toBeGreaterThan(2);
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
    const reps = clusterReps(backingVerts(svg));
    expect(reps.length).toBe(28);
    expect(minGap(reps)).toBeGreaterThan(2);
  });
});

describe('exportSimSvgSchematic — NxN (InstancedRenderer)', () => {
  it('3x3 F face-on:9 个整格四边形,晶格去重 16 点(4×4 网格),色取 instanceColor', () => {
    const scene = new THREE.Scene();
    scene.add(new Cube(3));
    const world = worldFor(scene, new THREE.Vector3(0, 0, 1), 400);
    const svg = exportSimSvgSchematic({ world });
    expect(lCounts(svg).get(3)).toBe(9); // 全部四边形
    expect(faceletDs(svg).length).toBe(9);
    expect(svg.toLowerCase()).toContain(CUBE_FILL.F.toLowerCase());
    expect(svg.toLowerCase()).not.toContain(CUBE_FILL.U.toLowerCase()); // 背剔
    const reps = clusterReps(backingVerts(svg));
    expect(reps.length).toBe(16);
    expect(minGap(reps)).toBeGreaterThan(2);
    expect(hasSchematicFacelets(scene)).toBe(true);
  });

  it('斜视:三面可见 27 小面,面与面在立方棱上共点无错位', () => {
    const scene = new THREE.Scene();
    scene.add(new Cube(3));
    const world = worldFor(scene, new THREE.Vector3(1, 0.9, 1), 460);
    const svg = exportSimSvgSchematic({ world });
    expect(faceletDs(svg).length).toBe(27);
    expect(minGap(clusterReps(backingVerts(svg)))).toBeGreaterThan(2);
  });

  it('镜面几何不满足晶格假设:enableMirror 摘除标记 → 回退 BSP 路径', () => {
    const scene = new THREE.Scene();
    scene.add(new Cube(3, true));
    expect(hasSchematicFacelets(scene)).toBe(false);
  });

  it('maxFacelets 上限:超限抛 SVG_TOO_COMPLEX(伴图回退旧渲染器)', () => {
    const scene = new THREE.Scene();
    scene.add(new Cube(3));
    const world = worldFor(scene, new THREE.Vector3(0, 0, 1), 400);
    expect(() => exportSimSvgSchematic({ world, maxFacelets: 4 }))
      .toThrow(/^SVG_TOO_COMPLEX/);
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
    const reps = clusterReps(backingVerts(svg));
    expect(reps.length).toBe(13);
    expect(minGap(reps)).toBeGreaterThan(2);
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
    const reps = clusterReps(backingVerts(svg));
    expect(minGap(reps)).toBeGreaterThan(2); // 顶/墙/中层三方交界处无亚像素错位
  });
});
