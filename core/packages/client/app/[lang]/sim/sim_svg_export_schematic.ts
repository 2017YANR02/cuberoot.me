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
 *
 * sr 的两个表现力扩展同样移植:
 *  - 逐色描边:sticker 的 `userData.schematicStroke` 覆盖该面的描边色,缺省黑
 *    (对应 sr svg.ts 的 `color.stroke || "#000000"`);
 *  - arrows 箭头层:`opts.arrows` 的世界坐标线段随相机投影,画在所有小面之上、
 *    不被凸包裁剪(对应 sr renderArrows + createMarkers)。
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
  /** 箭头标注层(抄 sr 的 arrows:画在所有小面之上,不被凸包裁剪)。 */
  arrows?: SchematicArrow[];
}

/** 教学标注箭头:世界坐标线段,p1 → p2(箭头指向 p2),随引擎相机投影。 */
export interface SchematicArrow {
  p1: [number, number, number];
  p2: [number, number, number];
  /** 线 + 箭头色;默认黑。 */
  color?: string;
  /** 线宽(SVG px);默认取 strokeWidth(strokeWidth 为 0 时 8)。 */
  width?: number;
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

  interface Facelet { pts: number[]; fill: string; stroke: string; z: number }
  const facelets: Facelet[] = [];
  const v = new THREE.Vector3();
  const v4 = new THREE.Vector4();

  /** 世界坐标单点 → 屏幕坐标;点在近平面之后返回 null。 */
  const project = (x: number, y: number, z: number): [number, number] | null => {
    const p = v.set(x, y, z).applyMatrix4(viewMat);
    if (p.z > -near) return null;
    v4.set(p.x, p.y, p.z, 1).applyMatrix4(projMat);
    const inv = 1 / v4.w;
    return [(v4.x * inv * 0.5 + 0.5) * W, (0.5 - v4.y * inv * 0.5) * H];
  };

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
    // 逐色描边(抄 sr svg.ts 的 `color.stroke || "#000000"`):贴纸可经 userData
    // 覆盖自己的描边色(遮罩灰化 / 强调等),缺省统一黑。
    const strokeColor = (obj.userData.schematicStroke as string | undefined) ?? '#000000';

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
    facelets.push({ pts, fill, stroke: strokeColor, z: zSum / view.length });
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
  const strokeAttrOf = (color: string): string =>
    strokeW > 0 ? ` stroke="${color}" stroke-width="${fmt(strokeW)}" stroke-linejoin="round"` : '';
  const paths = facelets.map((f) => `<path d="${dOf(f.pts)}" fill="${f.fill}"${strokeAttrOf(f.stroke)}/>`).join('');

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
        + `<path d="${hullD}" fill="none"${strokeAttrOf('#000000')}/>`;
    }
  }

  // arrows 箭头层(抄 sr renderArrows:所有多边形画完后单独一遍,盖在最上层,
  // 不参与凸包裁剪 —— 教学标注允许伸出轮廓)。箭头 marker 按色去重生成;
  // markerUnits 默认 strokeWidth → 箭头三角随线宽缩放(sr createMarkers 同款)。
  let defs = '';
  let arrowsOut = '';
  const arrowPads: { x: number; y: number; pad: number }[] = [];
  if (opts.arrows?.length) {
    const markerIds = new Map<string, string>();
    for (const a of opts.arrows) {
      const s1 = project(a.p1[0], a.p1[1], a.p1[2]);
      const s2 = project(a.p2[0], a.p2[1], a.p2[2]);
      if (!s1 || !s2) continue;
      const color = a.color ?? '#000000';
      const aw = a.width ?? (strokeW > 0 ? strokeW : 8);
      let id = markerIds.get(color);
      if (!id) {
        id = `ah${markerIds.size}`;
        markerIds.set(color, id);
        defs += `<marker id="${id}" markerWidth="4" markerHeight="4" refX="3.2" refY="2" orient="auto">`
          + `<path d="M0 0L4 2L0 4Z" fill="${color}"/></marker>`;
      }
      arrowsOut += `<line x1="${fmt(s1[0])}" y1="${fmt(s1[1])}" x2="${fmt(s2[0])}" y2="${fmt(s2[1])}"`
        + ` stroke="${color}" stroke-width="${fmt(aw)}" stroke-linecap="round" marker-end="url(#${id})"/>`;
      // 箭头三角伸出线端 ~0.8×线宽、侧向 ±2×线宽 → 取景留 2.5×线宽余量
      for (const s of [s1, s2]) arrowPads.push({ x: s[0], y: s[1], pad: aw * 2.5 });
    }
    if (defs) defs = `<defs>${defs}</defs>`;
  }

  // viewBox 贴着拼图裁(抄 sr 的紧凑取景):包围盒 + 描边半宽(外框线外沿)+ 1px。
  // 不裁的话导整张画布,拼图缩在中间、四周大片空边。箭头端点(含自身余量)也
  // 计入包围盒,标注伸出轮廓时视窗跟着扩。
  let bx = 0, by = 0, bw = W, bh = H;
  if (facelets.length > 0 || arrowPads.length > 0) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const f of facelets) {
      for (let i = 0; i < f.pts.length; i += 2) {
        if (f.pts[i] < x0) x0 = f.pts[i]; if (f.pts[i] > x1) x1 = f.pts[i];
        if (f.pts[i + 1] < y0) y0 = f.pts[i + 1]; if (f.pts[i + 1] > y1) y1 = f.pts[i + 1];
      }
    }
    for (const p of arrowPads) {
      if (p.x - p.pad < x0) x0 = p.x - p.pad; if (p.x + p.pad > x1) x1 = p.x + p.pad;
      if (p.y - p.pad < y0) y0 = p.y - p.pad; if (p.y + p.pad > y1) y1 = p.y + p.pad;
    }
    const pad = strokeW / 2 + 1;
    bx = x0 - pad; by = y0 - pad; bw = x1 - x0 + pad * 2; bh = y1 - y0 + pad * 2;
  }

  const bg = opts.background
    ? `<rect x="${fmt(bx)}" y="${fmt(by)}" width="${fmt(bw)}" height="${fmt(bh)}" fill="${opts.background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(1, Math.round(bw))}" height="${Math.max(1, Math.round(bh))}" viewBox="${fmt(bx)} ${fmt(by)} ${fmt(bw)} ${fmt(bh)}">${bg}${defs}${content}${arrowsOut}</svg>`;
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
