/**
 * sim_svg_export_schematic — 示意图导出器(SR 范式 × 引擎相机)。
 *
 * 与 BSP 导出器(实模投影)的分工:示意图只画彩色小面(facelet),不画块身 /
 * 核 / 倒角。魔方静止形态是凸体,可见小面互不遮挡 —— 不需要隐面消除,更不需要
 * BSP。渲染范式抄 sr-puzzlegen(vendor-sr-puzzlegen/src/rendering):
 *
 *   每个小面 = 一条独立 <path>(严格多边形)+ 各自的黑描边。相邻小面共享的棱
 *   在建模层就是同一组世界坐标(引擎割平面求交,跨块误差 ~1e-9,远低于输出
 *   0.01px 量化)→ 两侧描边逐比特重合成一条干净黑线。这是 sr“严丝合缝”观感
 *   的来源;BSP 的共享边相消 + 切分正好破坏它,所以示意图不走 BSP。
 *
 * 相机 / 状态直接取引擎 world → 任意视角精确跟随左侧 3D(sr 的 SR_ANGLE_BASE
 * 手工标定层在此路线不存在)。
 *
 * 小面来源:sticker mesh 的 `userData.schematicPoly`(扁平 xyz 轮廓,局部坐标,
 * 绕向朝外法向;含反烘 PIECE_SHRINK,经 matrixWorld 后落在未收缩的晶格位置,
 * 与邻块严格共点)。多边形按顶点序原样输出 —— 五边形 / 梯形小面同样一条 path,
 * 不会出现三角化内对角线。
 */
import * as THREE from 'three';
import type World from './engine/world';
import { clipPolyByPlane, hexOf, fmt } from './sim_svg_export';

export interface SchematicSvgExportOptions {
  world: Pick<World, 'scene' | 'camera' | 'width' | 'height'>;
  /** 小面黑描边宽(SVG 坐标 px;显示端随 SVG 整体缩放)。0 = 不描边。默认 8。 */
  strokeWidth?: number;
  /** 背景色;默认 null = 透明。 */
  background?: string | null;
}

/** 场景是否含示意小面(伴图据此在示意 / 实模 BSP 两条导出路径间切换)。 */
export function hasSchematicFacelets(scene: THREE.Object3D): boolean {
  let found = false;
  scene.traverse((o) => { if (o.userData.schematicPoly) found = true; });
  return found;
}

export function exportSimSvgSchematic(opts: SchematicSvgExportOptions): string {
  const { world } = opts;
  const scene = world.scene as THREE.Scene;
  const camera = world.camera as THREE.PerspectiveCamera;
  const W = Math.max(1, Math.round(world.width));
  const H = Math.max(1, Math.round(world.height));
  const strokeW = opts.strokeWidth ?? 8;

  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const viewMat = new THREE.Matrix4().copy(camera.matrixWorld).invert();
  const projMat = camera.projectionMatrix;
  const near = camera.near;
  const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);

  interface Facelet { pts: number[]; fill: string; z: number }
  const facelets: Facelet[] = [];
  const v = new THREE.Vector3();
  const v4 = new THREE.Vector4();

  scene.traverseVisible((obj) => {
    const poly = obj.userData.schematicPoly as number[] | undefined;
    if (!poly || poly.length < 9) return;
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    // 材质色:sticker mesh 是 [capMat, wallMat],取 cap(彩色)那层;平色无光照。
    const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as { color?: THREE.Color; visible?: boolean };
    if (mat.visible === false) return;
    const c = mat.color;
    const fill = c ? hexOf(c.r, c.g, c.b, false) : '#000000';

    // 局部轮廓 → 世界坐标
    const worldPts: THREE.Vector3[] = [];
    for (let i = 0; i < poly.length; i += 3) {
      worldPts.push(v.set(poly[i], poly[i + 1], poly[i + 2]).clone().applyMatrix4(mesh.matrixWorld));
    }
    // 背面剔除:绕向朝外 → 法向背向相机的小面不可见(静止凸体,足够)
    const n = new THREE.Vector3().subVectors(worldPts[1], worldPts[0])
      .cross(new THREE.Vector3().subVectors(worldPts[2], worldPts[0]));
    const len = n.length();
    if (len < 1e-12) return;
    n.divideScalar(len);
    const d = n.dot(worldPts[0]);
    if (n.dot(camPos) - d <= 0) return;

    // 视空间 + 近平面裁剪(常规相机距不会触发,保护性)
    let view = worldPts.map((p) => p.clone().applyMatrix4(viewMat));
    for (const p of view) {
      if (p.z > -near) { view = clipPolyByPlane(view, 0, 0, -1, -near); break; }
    }
    if (view.length < 3) return;

    const pts: number[] = [];
    let zSum = 0;
    for (const p of view) {
      v4.set(p.x, p.y, p.z, 1).applyMatrix4(projMat);
      const inv = 1 / v4.w;
      pts.push((v4.x * inv * 0.5 + 0.5) * W, (0.5 - v4.y * inv * 0.5) * H);
      zSum += p.z;
    }
    facelets.push({ pts, fill, z: zSum / view.length });
  });

  // 远 → 近(凸体下可见面互不重叠,排序只是对轻微非凸的保护)
  facelets.sort((a, b) => a.z - b.z);

  const dOf = (pts: number[]): string => {
    let s = `M${fmt(pts[0])} ${fmt(pts[1])}`;
    for (let i = 2; i < pts.length; i += 2) s += `L${fmt(pts[i])} ${fmt(pts[i + 1])}`;
    return s + 'Z';
  };

  // join=round 照抄 sr(svg.ts):透视压扁的小面投影角可以极尖,miter 会沿角
  // 平分线拉出长针(内部结点偶有盖不住的露出来 = "刺");round 的圆帽半径只有
  // 半描边宽,黑压黑不可见。外缘的圆帽由凸包裁剪 + 外框线兜住,不上轮廓。
  const stroke = strokeW > 0 ? ` stroke="#000000" stroke-width="${fmt(strokeW)}" stroke-linejoin="round"` : '';
  const paths = facelets.map((f) => `<path d="${dOf(f.pts)}" fill="${f.fill}"${stroke}/>`).join('');

  // 外轮廓 = 可见小面投影的凸包(静止魔方是凸体)。小面描边在外缘晶格点的
  // miter 尖会伸出轮廓线(内部同类尖被邻面描边盖住,轮廓上无遮盖 → "毛刺"),
  // 用凸包 clipPath 裁掉出界部分,再沿凸包描一条外框 → 外缘是数学直线。
  let content = paths;
  if (strokeW > 0 && facelets.length > 0) {
    const hull = convexHull2D(facelets.flatMap((f) => {
      const out: [number, number][] = [];
      for (let i = 0; i < f.pts.length; i += 2) out.push([f.pts[i], f.pts[i + 1]]);
      return out;
    }));
    if (hull.length >= 3) {
      const hullD = dOf(hull.flat());
      content = `<clipPath id="sil"><path d="${hullD}"/></clipPath>`
        + `<g clip-path="url(#sil)">${paths}</g>`
        + `<path d="${hullD}" fill="none"${stroke}/>`;
    }
  }

  const bg = opts.background ? `<rect width="100%" height="100%" fill="${opts.background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${bg}${content}</svg>`;
}

/** 2D 凸包(Andrew monotone chain),返回逆时针顶点;共线点剔除。 */
function convexHull2D(pts: [number, number][]): [number, number][] {
  const uniq = [...new Map(pts.map((p) => [`${p[0]},${p[1]}`, p])).values()]
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (uniq.length < 3) return uniq;
  const cross = (o: [number, number], a: [number, number], b: [number, number]): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: [number, number][]): [number, number][] => {
    const out: [number, number][] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(uniq), ...half([...uniq].reverse())];
}
