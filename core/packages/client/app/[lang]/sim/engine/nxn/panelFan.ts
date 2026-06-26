/**
 * panelFan — 超高阶原核转层的「扇形彩色横截面」填充板。
 *
 * 超高阶魔方只造表面 cubelet,内层 = 只有四周一圈块的空环。转一层时缝隙会露出中空。
 * 原核(无贴纸实色块)下,该横截面应像真魔方切面那样:四周一圈表面块各自的当前外面色,
 * 从中心向各自那段边扇形铺开。打乱后这一圈块五颜六色 → 横截面五彩斑斓(而非一片单色)。
 *
 * 做法:给每个转动 inner-layer group 单独挂一片扇形几何(中心 → N 段/边,共 4N 个三角,两面),
 * 每段三角平涂「该段对应那块表面块当前外面色」。几何 bake 真实尺寸(in-plane 满宽 N*SIZE,
 * 沿轴薄 SIZE-1,两面在 ±(SIZE-1)/2),panel.scale=1。颜色每次 hold 按当前打乱态重刷。
 *
 * 全阶原核转层都用(group.hold 在 rawCore 时挂):超高阶填空壳中心、中低阶用 polygonOffset
 * 盖掉 inner box 露出的深色中心,所有 nxn 切面都是连续斜向彩色条纹。非原核才走 Cubelet._PANEL 深色盒。
 */
import * as THREE from "three";
import { FACE, COLORS, SIZE } from "../define";
import type Cube from "./cube";

/** (轴, 符号) → WCA 面(FACE enum 值)。0=x:R/L,1=y:U/D,2=z:F/B。 */
function faceFor(axis: number, sign: number): FACE {
  if (axis === 0) return (sign > 0 ? FACE.R : FACE.L) as FACE;
  if (axis === 1) return (sign > 0 ? FACE.U : FACE.D) as FACE;
  return (sign > 0 ? FACE.F : FACE.B) as FACE;
}

/** 建一片扇形横截面几何(thin 轴 = group 的 axis)。位置按真实尺寸 bake;color 属性留空待 colorPanelFan 刷。 */
export function buildPanelFan(order: number, axis: number): THREE.BufferGeometry {
  const N = order;
  const p = (axis + 1) % 3, q = (axis + 2) % 3;
  const HALF = (N * SIZE) / 2;   // in-plane 满宽半径(到外表面);扇面铺满整个切面(含周边块那一圈)
  const TH = SIZE / 2;           // 沿轴半厚 = 半个块高,扇面齐平到切面;与周边块的方形块顶共面,
                                 // 靠 _PANEL_MAT 的 polygonOffset 盖过它 → 出连续斜条纹而非方块台阶
  const mk = (aSign: number, pu: number, qu: number): [number, number, number] => {
    const v: [number, number, number] = [0, 0, 0];
    v[axis] = aSign * TH; v[p] = pu * HALF; v[q] = qu * HALF; return v;
  };
  // 四周边界点(in-plane 单位 -1..1),4N 段,CCW:
  //  edge0 q=-1(p 增) / edge1 p=+1(q 增) / edge2 q=+1(p 减) / edge3 p=-1(q 减)
  const perim: [number, number][] = [];
  for (let i = 0; i < N; i++) perim.push([-1 + (2 * i) / N, -1]);
  for (let i = 0; i < N; i++) perim.push([1, -1 + (2 * i) / N]);
  for (let i = 0; i < N; i++) perim.push([1 - (2 * i) / N, 1]);
  for (let i = 0; i < N; i++) perim.push([-1, 1 - (2 * i) / N]);
  const pos: number[] = [];
  for (const aSign of [1, -1]) {
    const c = mk(aSign, 0, 0);
    for (let j = 0; j < 4 * N; j++) {
      const a0 = perim[j], a1 = perim[(j + 1) % (4 * N)];
      const v0 = mk(aSign, a0[0], a0[1]);
      const v1 = mk(aSign, a1[0], a1[1]);
      pos.push(c[0], c[1], c[2], v0[0], v0[1], v0[2], v1[0], v1[1], v1[2]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
  return g;
}

/** 按该层四周表面块的当前外面色刷新扇形顶点色(每段一三角平涂)。每次 hold 调,跟当前打乱态。 */
export function colorPanelFan(geo: THREE.BufferGeometry, cube: Cube, axis: number, layer: number): void {
  const N = cube.order;
  const p = (axis + 1) % 3, q = (axis + 2) % 3;
  const colAttr = geo.getAttribute("color") as THREE.BufferAttribute;
  const arr = colAttr.array as Float32Array;
  const tmp = new THREE.Color();
  const coord = [0, 0, 0];
  let vi = 0;
  for (let side = 0; side < 2; side++) {
    for (let j = 0; j < 4 * N; j++) {
      const e = Math.floor(j / N), i = j % N;
      // 段 j → 四周块的 in-plane 坐标 (pc,qc) + 该段外露面(轴 fa, 符号 fs)
      let pc: number, qc: number, fa: number, fs: number;
      if (e === 0) { pc = i; qc = 0; fa = q; fs = -1; }
      else if (e === 1) { pc = N - 1; qc = i; fa = p; fs = 1; }
      else if (e === 2) { pc = N - 1 - i; qc = N - 1; fa = q; fs = 1; }
      else { pc = 0; qc = N - 1 - i; fa = p; fs = -1; }
      coord[axis] = layer; coord[p] = pc; coord[q] = qc;
      const idx = coord[2] * N * N + coord[1] * N + coord[0];
      const cub = cube.cubelets.get(idx);
      const label = cub ? cub.getColor(faceFor(fa, fs)) : "?";
      tmp.set(COLORS[label] ?? COLORS.Core);
      for (let v = 0; v < 3; v++) { const o = vi * 3; arr[o] = tmp.r; arr[o + 1] = tmp.g; arr[o + 2] = tmp.b; vi++; }
    }
  }
  colAttr.needsUpdate = true;
}
