/**
 * /predict 题板高亮框的几何断言(五魔方 / 金字塔 / 斜转 / 枫叶共用一份)。
 *
 * 框是「沿贴纸轮廓等距内缩一圈」的环。会悄悄坏掉的是**框宽**:一旦内缘退回成「按质心缩
 * 一个比例」,框宽就随该方向的半径走 —— 枫叶花瓣又长又尖,尖端糊成一片、透镜那侧几乎没
 * 有框(用户报的就是这个)。所以这里逐顶点量它到贴纸轮廓的距离,盯上界。
 */
import { expect } from 'vitest';
import * as THREE from 'three';
import type { StickerOutline, V2 } from '@/app/[lang]/sim/engine/stickerGeom';
import { attachStickerFrame, frameOutline, frameWidth } from '@/app/[lang]/predict/_components/solidOutline';

/** 点到闭合折线的距离。 */
function distToOutline(pts: readonly V2[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return best;
}

/** 一张贴纸挂上框之后:框在贴纸正面那张面上,且框宽处处相等。 */
export function expectEvenFrame(mesh: THREE.Mesh, label: string): void {
  const spec = mesh.geometry.userData.simStickerOutline as StickerOutline | undefined;
  expect(spec, `${label}:贴纸没记轮廓,框无从画起`).toBeTruthy();

  const frame = attachStickerFrame(mesh, new THREE.MeshBasicMaterial());
  expect(frame, `${label}:框没挂上`).toBeTruthy();

  // 框必须落在**正面**那张面上(挂反面就被贴纸挡住;挤出体两端差一个 depth)。
  const n = (mesh.userData.simStickerNormal as THREE.Vector3).clone().normalize();
  const own = mesh.geometry.getAttribute('position');
  const p = new THREE.Vector3();
  let cap = -Infinity;
  for (let i = 0; i < own.count; i++) cap = Math.max(cap, p.fromBufferAttribute(own, i).dot(n));

  // 框宽与轮廓都从 solidOutline 取(它按最紧那段圆弧钳过标称宽,五魔方靠这个才不糊)——
  // 这里再抄一份公式,只会在钳生效的拼图上和实现对不上。
  const pts = frameOutline(spec!.pts);
  let per = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    per += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  const width = frameWidth(pts);

  const inv = spec!.matrix.clone().invert();
  const ring = frame!.geometry.getAttribute('position');
  const inner: number[] = [];
  for (let i = 0; i < ring.count; i++) {
    p.fromBufferAttribute(ring, i);
    expect(Math.abs(p.dot(n) - cap), `${label}:框没贴在贴纸正面`).toBeLessThan(1e-3);
    const q = p.clone().applyMatrix4(inv);
    const d = distToOutline(pts, q.x, q.y);
    if (d > width * 0.05) inner.push(d); // 环的顶点非外缘(贴着轮廓)即内缘
  }
  expect(inner.length, `${label}:环没有内缘`).toBeGreaterThan(2);

  const spread = `${Math.min(...inner).toFixed(2)}~${Math.max(...inner).toFixed(2)},标称 ${width.toFixed(2)}`;
  // 上界是这条测试的正主:框宽一旦跟着半径走(质心缩放),长条形贴纸的一端立刻超标。
  expect(Math.max(...inner), `${label}:框比标称宽(${spread})`).toBeLessThan(width * 1.06);
  // 下界只管「绝大多数」:锐角 / 尖端(枫叶花瓣顶那个尖是两段弧的真尖点)处内缩必然收窄,
  // offsetInward 还会钳 miter —— 引擎自己的沟槽也是这样,那几点放过。
  const wide = inner.filter((d) => d > width * 0.5).length / inner.length;
  expect(wide, `${label}:框在多处细得不成样(${spread})`).toBeGreaterThan(0.8);
  const median = inner.slice().sort((a, b) => a - b)[inner.length >> 1];
  expect(median, `${label}:框宽整体不齐(${spread})`).toBeGreaterThan(width * 0.9);

  // 画出来的面积必须是**一条带子**。内缘一自交,three 的三角化会把整个洞丢掉,框糊成一片
  // 实心色 —— 那时顶点位置全对,只有面积会暴涨(枫叶花瓣曾经就是 3 倍)。
  // 参照量按 Steiner 公式:带宽 w 的一圈 = 周长×w − πw²(w 小到不自交时对任意简单闭曲线成立)。
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const idx = frame!.geometry.getIndex();
  const tri = idx ? idx.count : ring.count;
  let drawn = 0;
  for (let i = 0; i < tri; i += 3) {
    const [i0, i1, i2] = idx ? [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)] : [i, i + 1, i + 2];
    a.fromBufferAttribute(ring, i0).applyMatrix4(inv);
    b.fromBufferAttribute(ring, i1).applyMatrix4(inv);
    c.fromBufferAttribute(ring, i2).applyMatrix4(inv);
    drawn += Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
  }
  const band = per * width - Math.PI * width * width;
  expect(drawn / band, `${label}:框不是一条带子(画了 ${drawn.toFixed(4)},带子该是 ${band.toFixed(4)})`)
    .toBeLessThan(1.1);
}
