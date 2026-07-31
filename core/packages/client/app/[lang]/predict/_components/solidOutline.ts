/**
 * 逐张 mesh 拼图(金字塔 / 斜转 / 枫叶)的「高亮框」—— NxN 那档 FM_OUTLINE 的等价实现。
 *
 * NxN 走 shader(`engine/nxn/stickerOutline.ts`):贴纸不换色,沿圆角矩形 SDF 的内圈描一
 * 圈高亮色。这几个拼图的贴纸是逐张 `ExtrudeGeometry`,形状各不相同(三角 / 菱形 / 透镜 /
 * 花瓣),没有一份能共用的 SDF,于是照着同一个语义另画一张:**贴纸本色不动,在它正面
 * 盖一圈沿轮廓内缩的环**,环就是框。
 *
 * 框宽必须处处相等,所以内缘走 `engine/stickerGeom.ts` 的 `offsetInward`(逐点沿角平分
 * 线内推定长,直线段平行、圆弧段同心)。**不能**拿轮廓按质心缩一个比例充数 —— 那是缩放
 * 不是等距内缩,框宽会随该方向的半径走:枫叶花瓣又长又尖,尖端糊成一大片、透镜那侧的
 * 弧几乎没有框。轮廓由引擎在建构时记在几何上(`simStickerOutline`),与挤出体同一批采样
 * 点,所以框的外缘与贴纸边缘严丝合缝。
 *
 * 环挂在贴纸自己身下(child),转层时跟着块跑,不必另同步(同 `engine/hintFacelets.ts`);
 * 与贴纸正面共面,z-fight 交给 polygonOffset 判胜负,不靠把环浮起来(浮起来斜视角会错位)。
 */
import * as THREE from 'three';
import { offsetInward, polyArea2, type StickerOutline, type V2 } from '@/app/[lang]/sim/engine/stickerGeom';

/** 框的颜色单一源仍在 NxN 那份(引擎的高亮品红);从这里转出去,免得 `PredictBoard`
 *  为一个色值静态 import 那个模块 —— 它带 three,会被拖进首包。 */
export { OUTLINE_DEFAULT } from '@/app/[lang]/sim/engine/nxn/stickerOutline';

/** 框宽 ÷ 贴纸的「内切半径」(2×面积 ÷ 周长:正方形、三角形恰好就是内切圆半径)。
 *  NxN 那圈是 OUTLINE_WIDTH 4.5 ÷ 贴纸半宽 28,照抄同一个比例,两条渲染路径的框一样粗。 */
const BAND_RATIO = 0.16;

export interface StickerFrame {
  /** 那圈环;`visible` 即这枚贴纸要不要框。 */
  patch: THREE.Mesh;
  material: THREE.Material;
  geometry: THREE.BufferGeometry;
}

const perimeter = (pts: readonly V2[]): number => {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    sum += Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  return sum;
};

const path = (pts: readonly V2[]): THREE.Vector2[] => pts.map(([x, y]) => new THREE.Vector2(x, y));

/** 点到闭合折线的距离。 */
function distTo(outline: readonly V2[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < outline.length; i++) {
    const [ax, ay] = outline[i];
    const [bx, by] = outline[(i + 1) % outline.length];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return best;
}

/** 射线法:点在闭合折线内部。 */
function inside(outline: readonly V2[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, yi] = outline[i];
    const [xj, yj] = outline[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/**
 * 剔掉内缘上「推过头」的点。
 *
 * `offsetInward` 是逐点沿角平分线内推一个定长,前提是这个定长没超过该处的局部厚度。贴纸
 * 上有两处会超:斜转贴纸的锐角(折出一个小环),以及枫叶花瓣两端那对又薄又尖的角 —— 那里
 * 内推会**穿过对面那条边跑到贴纸外面去**。两种都让内缘自交,而自交的洞 three 的三角化会
 * 整个丢掉,框于是糊成一整片实心色(用户看到的花瓣就是这么坏的)。
 *
 * 判据两条,缺一不可:点得在轮廓**里面**(穿出去的那批距离照样是一个框宽,光量距离看不
 * 出来),且离轮廓确实有一个框宽(折回来的那批在里面,但明显不够宽)。剔完内缘在尖端直接
 * 抹一刀过去,那一小片填成框色 —— 正是描边笔画到尖角时该有的样子。
 */
function pruneFolds(outline: readonly V2[], inner: readonly V2[], width: number): V2[] {
  const kept = inner.filter(([x, y]) => inside(outline, x, y) && distTo(outline, x, y) > width * 0.95);
  return kept.length >= 3 ? kept : [...inner];
}

/**
 * 给一张贴纸挂上高亮框。`material` 必须是这张贴纸自己那份材质的克隆(同型号才和贴纸一个
 * 受光观感),颜色由调用方刷成描边色;挂上后由本模块接管其 polygonOffset,dispose 归调用方。
 * 贴纸没记轮廓(不是引擎那几个挤出体建的)时返回 null,调用方退回不加框。
 */
export function attachStickerFrame(mesh: THREE.Mesh, material: THREE.Material): StickerFrame | null {
  const spec = mesh.geometry.userData.simStickerOutline as StickerOutline | undefined;
  if (!spec || spec.pts.length < 3) return null;

  // offsetInward 认「内部在每条有向边的左侧」,即 CCW;轮廓的绕向随建构走,这里先摆正。
  const ccw = polyArea2(spec.pts) > 0 ? spec.pts : spec.pts.slice().reverse();
  // 内切半径 = 2×面积 ÷ 周长,而 polyArea2 给的就是 2×面积,于是直接除周长。
  const width = BAND_RATIO * (Math.abs(polyArea2(ccw)) / perimeter(ccw));
  const shape = new THREE.Shape(path(ccw));
  shape.holes.push(new THREE.Path(path(pruneFolds(ccw, offsetInward(ccw, width), width)).reverse()));

  const geometry = new THREE.ShapeGeometry(shape);
  geometry.applyMatrix4(spec.matrix);

  // 与贴纸正面共面 → 深度值打平,靠 polygonOffset 把环拉到前面(贴花的标准做法)。
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -1;
  // 环是平的一张,正面朝轮廓坐标系的 +z;而枫叶有一半贴纸的建构基底法向朝内(extrudeOntoFace
  // 的 flip),那几张的 +z 就是朝里的,单面材质会被背面剔除掉 —— 整张框凭空消失。
  material.side = THREE.DoubleSide;

  const patch = new THREE.Mesh(geometry, material);
  patch.visible = false;
  patch.raycast = () => {}; // 点击命中只认本体(题板的 raycast 也只喂贴纸那一层)
  mesh.add(patch);
  return { patch, material, geometry };
}
