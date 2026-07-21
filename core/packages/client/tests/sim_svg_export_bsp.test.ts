/**
 * sim_svg_export_bsp 单测 — BSP 解析隐面消除的纯数学部分。
 *
 * 核心 oracle `expectValidPainterOrder`:paint 序中任意两个屏幕空间重叠的面片,
 * 后画的在重叠区内部点必须不更远(1/viewZ 在屏幕空间是仿射函数,由顶点拟合后
 * 在重叠质心处精确比较)。互穿 / 循环遮挡场景靠它验证 —— 质心 painter 无法
 * 通过,BSP 必须通过。
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { exportSimSvgBsp, exportSimSvgBspWithDebug, type OrderedScreenPoly } from '@/app/[lang]/sim/sim_svg_export_bsp';

const W = 200;
const H = 200;

function makeWorld(): { scene: THREE.Scene; camera: THREE.PerspectiveCamera; width: number; height: number } {
  const scene = new THREE.Scene();
  // fov 90° / z=100 → z=0 平面上可视半宽恰 100(便于手算屏幕坐标)
  const camera = new THREE.PerspectiveCamera(90, 1, 1, 10000);
  camera.position.set(0, 0, 100);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  return { scene, camera, width: W, height: H };
}

function pathNumbers(svg: string): number[] {
  const d = [...svg.matchAll(/d="([^"]+)"/g)].map((m) => m[1]).join(' ');
  return [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
}

// ── painter 序 oracle ───────────────────────────────────────────────────────

type Pt2 = [number, number];

/** 凸多边形 ∩ 凸多边形(Sutherland–Hodgman,subject 依次被 clip 各边裁)。 */
function intersectConvex(subject: Pt2[], clip: Pt2[]): Pt2[] {
  // clip 绕向不定:按符号面积统一为逆时针(y 向下坐标系里取 area>0 一侧)
  let ca = 0;
  for (let i = 0; i < clip.length; i++) {
    const j = (i + 1) % clip.length;
    ca += clip[i][0] * clip[j][1] - clip[j][0] * clip[i][1];
  }
  const cl = ca >= 0 ? clip : [...clip].reverse();
  let out = subject;
  for (let i = 0; i < cl.length && out.length; i++) {
    const j = (i + 1) % cl.length;
    const [x1, y1] = cl[i];
    const [x2, y2] = cl[j];
    const inSide = (p: Pt2): boolean => (x2 - x1) * (p[1] - y1) - (y2 - y1) * (p[0] - x1) >= 0;
    const next: Pt2[] = [];
    for (let k = 0; k < out.length; k++) {
      const a = out[k];
      const b = out[(k + 1) % out.length];
      const ia = inSide(a);
      const ib = inSide(b);
      if (ia) next.push(a);
      if (ia !== ib) {
        const da = (x2 - x1) * (a[1] - y1) - (y2 - y1) * (a[0] - x1);
        const db = (x2 - x1) * (b[1] - y1) - (y2 - y1) * (b[0] - x1);
        const t = da / (da - db);
        next.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    out = next;
  }
  return out;
}

function area(pts: Pt2[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
  }
  return Math.abs(a) / 2;
}

/** 平面面片的 1/viewZ 在屏幕空间是仿射函数:取三个张成面积最大的顶点解系数。 */
function invZAffine(p: OrderedScreenPoly): (x: number, y: number) => number {
  const n = p.pts.length / 3;
  let bi = 0, bj = 1, bk = 2, bestA = -1;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const a = Math.abs(
          (p.pts[j * 3] - p.pts[i * 3]) * (p.pts[k * 3 + 1] - p.pts[i * 3 + 1])
          - (p.pts[k * 3] - p.pts[i * 3]) * (p.pts[j * 3 + 1] - p.pts[i * 3 + 1]),
        );
        if (a > bestA) { bestA = a; bi = i; bj = j; bk = k; }
      }
    }
  }
  const x0 = p.pts[bi * 3], y0 = p.pts[bi * 3 + 1], w0 = 1 / p.pts[bi * 3 + 2];
  const x1 = p.pts[bj * 3], y1 = p.pts[bj * 3 + 1], w1 = 1 / p.pts[bj * 3 + 2];
  const x2 = p.pts[bk * 3], y2 = p.pts[bk * 3 + 1], w2 = 1 / p.pts[bk * 3 + 2];
  const det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (Math.abs(det) < 1e-9) return () => w0; // 近退化:常数近似
  const gx = ((w1 - w0) * (y2 - y0) - (w2 - w0) * (y1 - y0)) / det;
  const gy = ((w2 - w0) * (x1 - x0) - (w1 - w0) * (x2 - x0)) / det;
  return (x, y) => w0 + gx * (x - x0) + gy * (y - y0);
}

/** 对 paint 序做逐对验证:重叠面积 > minArea 的对,后画者在重叠质心处 viewZ
 *  不得更远(容差 tol,世界单位)。同 node(共面并档)豁免。返回违规列表。 */
function painterViolations(order: OrderedScreenPoly[], minArea = 0.5, tol = 0.05): string[] {
  const polys = order.map((o) => {
    const pts2: Pt2[] = [];
    for (let i = 0; i < o.pts.length; i += 3) pts2.push([o.pts[i], o.pts[i + 1]]);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts2) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return { o, pts2, bb: [x0, y0, x1, y1] as const, invZ: invZAffine(o) };
  });
  const bad: string[] = [];
  for (let i = 0; i < polys.length; i++) {
    for (let j = i + 1; j < polys.length; j++) {
      const a = polys[i], b = polys[j];
      if (a.o.nodeId === b.o.nodeId) continue;
      if (a.bb[2] < b.bb[0] || b.bb[2] < a.bb[0] || a.bb[3] < b.bb[1] || b.bb[3] < a.bb[1]) continue;
      const inter = intersectConvex(a.pts2, b.pts2);
      if (inter.length < 3 || area(inter) < minArea) continue;
      let cx = 0, cy = 0;
      for (const [x, y] of inter) { cx += x; cy += y; }
      cx /= inter.length; cy /= inter.length;
      const za = 1 / a.invZ(cx, cy);
      const zb = 1 / b.invZ(cx, cy);
      // viewZ 均为负,更近 = 更大。j 后画,必须 zb ≥ za - tol。
      if (zb < za - tol) {
        bad.push(`order[${j}](${b.o.fill}, z=${zb.toFixed(3)}) painted after order[${i}](${a.o.fill}, z=${za.toFixed(3)}) but farther at (${cx.toFixed(1)},${cy.toFixed(1)})`);
      }
    }
  }
  return bad;
}

function expectValidPainterOrder(order: OrderedScreenPoly[]): void {
  const bad = painterViolations(order);
  expect(bad, bad.join('\n')).toEqual([]);
}

// ── 用例 ───────────────────────────────────────────────────────────────────

describe('exportSimSvgBsp', () => {
  it('正对相机的平面:两三角合并为单环 path,屏幕坐标正确,无细分', () => {
    const world = makeWorld();
    world.scene.add(new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0, 0) }),
    ));
    const { svg, order, inputTris, pieces } = exportSimSvgBspWithDebug({ world });
    expect(svg).toContain('#ff0000');
    expect(inputTris).toBe(2);
    expect(pieces).toBe(2); // 无分裂
    expect(order.length).toBe(2);
    // 共享对角线相消 → 单环(一个 M),单 path
    expect((svg.match(/<path/g) ?? []).length).toBe(1);
    expect((svg.match(/M/g) ?? []).length).toBe(1);
    const nums = pathNumbers(svg);
    expect(Math.min(...nums)).toBeCloseTo(50, 0);
    expect(Math.max(...nums)).toBeCloseTo(150, 0);
  });

  it('高细分平面(200 三角)仍合并为单环单 path', () => {
    const world = makeWorld();
    world.scene.add(new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100, 10, 10),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 1, 0) }),
    ));
    const { svg, inputTris } = exportSimSvgBspWithDebug({ world });
    expect(inputTris).toBe(200);
    expect((svg.match(/<path/g) ?? []).length).toBe(1);
    expect((svg.match(/M/g) ?? []).length).toBe(1);
  });

  it('painter 排序:近的画在后面', () => {
    const world = makeWorld();
    const far = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0, 0) }));
    const nearP = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 1) }));
    nearP.position.z = 50;
    world.scene.add(far, nearP);
    const { svg, order } = exportSimSvgBspWithDebug({ world });
    expect(svg.indexOf('#0000ff')).toBeGreaterThan(svg.indexOf('#ff0000'));
    expectValidPainterOrder(order);
  });

  it('平行近共面层(贴纸 0.1 抬升):不分裂,近层后画', () => {
    const world = makeWorld();
    const plastic = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) }));
    const sticker = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 0) }));
    sticker.position.z = 0.1;
    world.scene.add(plastic, sticker);
    const { svg, order, inputTris, pieces } = exportSimSvgBspWithDebug({ world });
    expect(pieces).toBe(inputTris); // 平行平面不产生分裂
    expect(svg.indexOf('#ffff00')).toBeGreaterThan(svg.indexOf('#000000'));
    expectValidPainterOrder(order);
  });

  it('互穿几何:两平面十字相交,双方被解析切开且序对', () => {
    const world = makeWorld();
    const a = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0, 0), side: THREE.DoubleSide }));
    a.rotation.y = Math.PI / 4;
    const b = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 1), side: THREE.DoubleSide }));
    b.rotation.y = -Math.PI / 4;
    world.scene.add(a, b);
    const { svg, order, inputTris, pieces } = exportSimSvgBspWithDebug({ world });
    expect(svg).toContain('#ff0000');
    expect(svg).toContain('#0000ff');
    expect(pieces).toBeGreaterThan(inputTris); // 确实发生了分裂
    expectValidPainterOrder(order);
  });

  it('循环遮挡(风车三板):质心 painter 不可解,BSP 序仍逐对正确', () => {
    const world = makeWorld();
    // 三块长板绕 Z 每 120° 一块,沿各自长轴倾斜:A 压 B、B 压 C、C 压 A
    const colors = [0xff0000, 0x00cc00, 0x0000ff];
    for (let k = 0; k < 3; k++) {
      const geo = new THREE.PlaneGeometry(70, 14, 1, 1);
      // 长轴 = 本地 x;沿 x 方向抬升 z 造成倾斜(x=+35 端朝相机)
      const pos = geo.getAttribute('position');
      for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getX(i) * 0.35);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(colors[k]), side: THREE.DoubleSide }));
      m.position.set(Math.cos((k * 2 * Math.PI) / 3) * 18, Math.sin((k * 2 * Math.PI) / 3) * 18, 0);
      m.rotation.z = (k * 2 * Math.PI) / 3 + Math.PI / 2;
      world.scene.add(m);
    }
    const { order, inputTris, pieces } = exportSimSvgBspWithDebug({ world });
    expect(pieces).toBeGreaterThan(inputTris);
    expectValidPainterOrder(order);
  });

  it('严格共面:GL「先画先赢」语义(先采集的后画)', () => {
    const world = makeWorld();
    const first = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0, 0) }));
    const second = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 1) }));
    second.position.x = 20; // 同 z=0 平面,部分重叠
    world.scene.add(first, second);
    const svg = exportSimSvgBsp({ world });
    // GL: first 先画,重叠区 depth 相等 second 画不上 → first 赢。
    // painter: 后画才赢 → first 必须排在 second 之后。
    expect(svg.indexOf('#ff0000')).toBeGreaterThan(svg.indexOf('#0000ff'));
  });

  it('FrontSide 背对剔除;DoubleSide 保留', () => {
    const world = makeWorld();
    const geo = new THREE.PlaneGeometry(100, 100);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 1, 0) }));
    m.rotation.y = Math.PI;
    world.scene.add(m);
    expect(exportSimSvgBsp({ world })).not.toContain('<path');
    (m.material as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
    expect(exportSimSvgBsp({ world })).toContain('#00ff00');
  });

  it('Lambert 光照:ambient intensity π = 全亮,π/2 = 线性 0.5', () => {
    const world = makeWorld();
    world.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshLambertMaterial({ color: new THREE.Color(1, 1, 1) })));
    const amb = new THREE.AmbientLight(0xffffff, Math.PI);
    world.scene.add(amb);
    expect(exportSimSvgBsp({ world })).toContain('#ffffff');
    amb.intensity = Math.PI / 2;
    const expected = `#${new THREE.Color(0.5, 0.5, 0.5).getHexString()}`;
    expect(exportSimSvgBsp({ world })).toContain(expected);
  });

  it('InstancedMesh:零缩放实例跳过,instanceColor 调色', () => {
    const world = makeWorld();
    const inst = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1) }),
      2,
    );
    inst.setMatrixAt(0, new THREE.Matrix4().makeTranslation(-30, 0, 0));
    inst.setMatrixAt(1, new THREE.Matrix4().makeScale(0, 0, 0));
    inst.setColorAt(0, new THREE.Color(1, 0, 0));
    inst.setColorAt(1, new THREE.Color(0, 1, 0));
    world.scene.add(inst);
    const svg = exportSimSvgBsp({ world });
    expect(svg).toContain('#ff0000');
    expect(svg).not.toContain('#00ff00');
  });

  it('透明材质输出 fill-opacity 无描边;不透明面片带同色描边', () => {
    const world = makeWorld();
    const solid = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0, 0) }));
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 1), transparent: true, opacity: 0.5 }));
    glass.position.z = 50;
    world.scene.add(solid, glass);
    const svg = exportSimSvgBsp({ world });
    expect(svg).toMatch(/fill="#ff0000" stroke="#ff0000"/);
    expect(svg).toMatch(/fill="#0000ff" fill-opacity="0.5"/);
    expect(svg).not.toMatch(/fill="#0000ff" fill-opacity="0.5" stroke/);
  });

  it('超上限抛 SVG_TOO_COMPLEX', () => {
    const world = makeWorld();
    world.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(100, 100, 4, 4), new THREE.MeshBasicMaterial()));
    expect(() => exportSimSvgBsp({ world, maxTriangles: 8 })).toThrow(/SVG_TOO_COMPLEX/);
  });

  it('背景参数输出底色矩形;默认透明无矩形', () => {
    const world = makeWorld();
    expect(exportSimSvgBsp({ world })).not.toContain('<rect');
    expect(exportSimSvgBsp({ world, background: '#123456' })).toContain('<rect width="100%" height="100%" fill="#123456"/>');
  });

  it('立方体自遮挡:12 三角输入,背面剔除后仅可见面输出,序对', () => {
    const world = makeWorld();
    const box = new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.5, 0) }));
    box.rotation.set(0.5, 0.6, 0);
    world.scene.add(box);
    const { order, inputTris } = exportSimSvgBspWithDebug({ world });
    // 旋转视角下可见面 = 3 面 × 2 三角
    expect(inputTris).toBe(6);
    expect(order.length).toBe(6);
    expectValidPainterOrder(order);
  });
});
