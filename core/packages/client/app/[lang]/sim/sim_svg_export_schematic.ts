/**
 * sim_svg_export_schematic — 示意图导出器(visualcube inset 范式 × 引擎相机)。
 *
 * 与 BSP 导出器(实模投影)的分工:示意图只画彩色小面(facelet),不画块身 /
 * 核 / 倒角。魔方静止形态是凸体,可见小面互不遮挡 —— 不需要隐面消除,更不需要
 * BSP。
 *
 * 网格模型抄 visualcube(vendor visualcube/src/cube/drawing.ts),不是描边:
 *
 *   每个小面 = 壳色衬底(理想晶格多边形原样)+ 贴纸(同多边形向心缩 1−inset)。
 *   贴纸四周露出的衬底 = 黑网格。缝宽是小面尺寸的固定比例 —— 阶数再高小面再小,
 *   网格永远等比,不会像绝对 px 描边那样在高阶把贴纸吞成一片黑(40 阶实测教训)。
 *   相邻衬底共享的棱在建模层就是同一组世界坐标(引擎割平面求交,跨块误差 ~1e-9,
 *   远低于输出 0.01px 量化)→ 衬底严丝合缝铺满外形,外轮廓即数学直线,不再需要
 *   旧描边模型的凸包裁剪 + 外框 hack。衬底带一条同色 1px 描边封住相邻多边形间的
 *   抗锯齿细缝(经典 SVG 邻接缝补法;同色不可见,外轮廓仅胖 0.5px)。
 *
 * 相机 / 状态直接取引擎 world → 任意视角精确跟随左侧 3D(sr 的 SR_ANGLE_BASE
 * 手工标定层在此路线不存在)。
 *
 * 小面来源:sticker mesh 的 `userData.schematicPoly`(扁平 xyz 轮廓,局部坐标,
 * 绕向朝外法向;含反烘 PIECE_SHRINK,经 matrixWorld 后落在未收缩的晶格位置,
 * 与邻块严格共点)。多边形按顶点序原样输出 —— 五边形 / 梯形小面同样一条 path,
 * 不会出现三角化内对角线。
 *
 * NxN(InstancedRenderer)走 `userData.schematicInstancedPoly`:同一块理想轮廓
 * 按 per-instance 矩阵(matrixWorld × instanceMatrix[i])展开,填色取
 * instanceColor[i];隐藏槽位(HIDE_MAT 零缩放)法向退化自动跳过。
 *
 * visualcube 参数同步移植(退役对照表 §2b):壳体色 bodyColor、壳体不透明度
 * bodyOpacity、贴纸不透明度 stickerOpacity。sr 的两个表现力扩展保留:
 *  - 逐面衬底色:sticker 的 `userData.schematicStroke` 覆盖该小面的衬底色
 *    (对应 sr svg.ts 的 `color.stroke || "#000000"`,遮罩灰化 / 强调用);
 *  - arrows 箭头层:`opts.arrows` 的世界坐标线段随相机投影,画在所有小面之上
 *    (对应 sr renderArrows + createMarkers)。
 */
import * as THREE from 'three';
import type World from './engine/world';
import { clipPolyByPlane, hexOf, fmt } from './sim_svg_export';

export interface SchematicSvgExportOptions {
  world: Pick<World, 'scene' | 'camera' | 'width' | 'height'>;
  /** 网格缝宽 = 小面向心收缩比例(0–1)。0 = 贴纸铺满无网格。默认 0.15
   *  (= visualcube 的 transScale 0.85)。 */
  inset?: number;
  /** 壳体色(衬底 / 网格色)。默认黑(= visualcube cubeColor)。 */
  bodyColor?: string;
  /** 壳体不透明度 0–100(= visualcube cubeOpacity)。默认 100。 */
  bodyOpacity?: number;
  /** 贴纸不透明度 0–100(= visualcube stickerOpacity)。默认 100。 */
  stickerOpacity?: number;
  /** 背景色;默认 null = 透明。 */
  background?: string | null;
  /** 贴纸遮罩(mask 直映):`userData.stickerKey ∈ keys` 的小面填 color(sr
   *  applyMask 的灰化语义;衬底/网格不动)。key 表见
   *  lib/puzzle-image/data/engine-sid-map.json(派生,canonical sid → key)。
   *  贴纸 mesh 跟块走 → 复原帧作标的遮罩天然随打乱携带。 */
  mask?: { keys: ReadonlySet<string>; color: string };
  /** 箭头标注层(抄 sr 的 arrows:画在所有小面之上)。 */
  arrows?: SchematicArrow[];
  /** 可见小面数上限(超高阶 NxN 的 SVG path 数防线);超限抛
   *  `SVG_TOO_COMPLEX_SCHEMATIC`,调用方回退其它渲染器。默认 20000。 */
  maxFacelets?: number;
}

/** 教学标注箭头:世界坐标线段,p1 → p2(箭头指向 p2),随引擎相机投影。 */
export interface SchematicArrow {
  p1: [number, number, number];
  p2: [number, number, number];
  /** 线 + 箭头色;默认黑。 */
  color?: string;
  /** 线宽(SVG px);默认 8。 */
  width?: number;
}

/** 场景是否含示意小面(伴图据此在示意 / 实模 BSP 两条导出路径间切换)。 */
export function hasSchematicFacelets(scene: THREE.Object3D): boolean {
  let found = false;
  scene.traverse((o) => {
    if (o.userData.schematicPoly || o.userData.schematicInstancedPoly) found = true;
  });
  return found;
}

export function exportSimSvgSchematic(opts: SchematicSvgExportOptions): string {
  const { world } = opts;
  const scene = world.scene as THREE.Scene;
  const camera = world.camera as THREE.PerspectiveCamera;
  const W = Math.max(1, Math.round(world.width));
  const H = Math.max(1, Math.round(world.height));
  const inset = Math.min(0.9, Math.max(0, opts.inset ?? 0.15));
  const bodyColor = opts.bodyColor ?? '#000000';
  const bodyOp = Math.min(100, Math.max(0, opts.bodyOpacity ?? 100));
  const stickerOp = Math.min(100, Math.max(0, opts.stickerOpacity ?? 100));

  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const viewMat = new THREE.Matrix4().copy(camera.matrixWorld).invert();
  const projMat = camera.projectionMatrix;
  const near = camera.near;
  const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);

  interface Facelet { pts: number[]; fill: string; body: string; z: number }
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

  const maxFacelets = opts.maxFacelets ?? 20_000;
  /** 一个小面:局部轮廓经 mtx 到世界 → 背面剔除 → 近平面裁剪 → 投影入列。 */
  const addPoly = (poly: number[], mtx: THREE.Matrix4, fill: string, body: string): void => {
    const worldPts: THREE.Vector3[] = [];
    for (let i = 0; i < poly.length; i += 3) {
      worldPts.push(v.set(poly[i], poly[i + 1], poly[i + 2]).clone().applyMatrix4(mtx));
    }
    // 镜像变换(sq1 底层 pivot.scale.y=−1)行列式为负会翻转绕向,倒序还原朝外
    if (mtx.determinant() < 0) worldPts.reverse();
    // 背面剔除:绕向朝外 → 法向背向相机的小面不可见(静止凸体,足够)。
    // 法向退化(HIDE_MAT 零缩放的隐藏 instance 槽位)同样在此跳过。
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
    if (facelets.length >= maxFacelets) throw new Error('SVG_TOO_COMPLEX_SCHEMATIC: facelet cap exceeded');
    facelets.push({ pts, fill, body, z: zSum / view.length });
  };

  scene.traverseVisible((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    // 材质色:sticker mesh 是 [capMat, wallMat],取 cap(彩色)那层;平色无光照。
    const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as { color?: THREE.Color; visible?: boolean };
    if (mat.visible === false) return;
    // 逐面衬底色(抄 sr svg.ts 的 `color.stroke || "#000000"`):贴纸可经 userData
    // 覆盖自己小面的衬底 / 网格色(遮罩灰化 / 强调等),缺省取全局壳体色。
    const body = (obj.userData.schematicStroke as string | undefined) ?? bodyColor;

    // NxN InstancedRenderer:同一块理想轮廓 × per-instance 矩阵,填色 instanceColor
    const ipoly = obj.userData.schematicInstancedPoly as number[] | undefined;
    const im = obj as THREE.InstancedMesh;
    if (ipoly && ipoly.length >= 9 && im.isInstancedMesh) {
      const imat = new THREE.Matrix4();
      const wmat = new THREE.Matrix4();
      const ic = new THREE.Color();
      for (let i = 0; i < im.count; i++) {
        im.getMatrixAt(i, imat);
        wmat.multiplyMatrices(im.matrixWorld, imat);
        let fill = '#000000';
        if (im.instanceColor) { im.getColorAt(i, ic); fill = hexOf(ic.r, ic.g, ic.b, false); }
        else if (mat.color) fill = hexOf(mat.color.r, mat.color.g, mat.color.b, false);
        addPoly(ipoly, wmat, fill, body);
      }
      return;
    }

    const poly = obj.userData.schematicPoly as number[] | undefined;
    if (!poly || poly.length < 9) return;
    const c = mat.color;
    const key = obj.userData.stickerKey as string | undefined;
    const fill = (opts.mask && key && opts.mask.keys.has(key))
      ? opts.mask.color
      : c ? hexOf(c.r, c.g, c.b, false) : '#000000';
    // schematicInParent(sq1):多边形挂父 frame,免疫贴纸 mesh 自身的压扁 scale
    // (立体贴片开关改 mesh.scale.z)。
    const mtx = (obj.userData.schematicInParent === true && mesh.parent)
      ? mesh.parent.matrixWorld : mesh.matrixWorld;
    addPoly(poly, mtx, fill, body);
  });

  // 远 → 近(凸体下可见面互不重叠,排序只是对轻微非凸的保护;衬底 + 贴纸按面
  // 连续输出,近面衬底可正确压住远面贴纸)
  facelets.sort((a, b) => a.z - b.z);

  const dOf = (pts: number[]): string => {
    let s = `M${fmt(pts[0])} ${fmt(pts[1])}`;
    for (let i = 2; i < pts.length; i += 2) s += `L${fmt(pts[i])} ${fmt(pts[i + 1])}`;
    return s + 'Z';
  };

  /** 投影多边形向心收缩(visualcube transScale 的 2D 版:顶点均值为心)。 */
  const insetPts = (pts: number[]): number[] => {
    let cx = 0, cy = 0;
    const n = pts.length / 2;
    for (let i = 0; i < pts.length; i += 2) { cx += pts[i]; cy += pts[i + 1]; }
    cx /= n; cy /= n;
    const k = 1 - inset;
    const out: number[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      out.push(cx + (pts[i] - cx) * k, cy + (pts[i + 1] - cy) * k);
    }
    return out;
  };

  const bodyOpAttr = bodyOp < 100 ? ` opacity="${fmt(bodyOp / 100)}"` : '';
  const stickerOpAttr = stickerOp < 100 ? ` opacity="${fmt(stickerOp / 100)}"` : '';
  let content = '';
  for (const f of facelets) {
    if (inset > 0) {
      content += `<path d="${dOf(f.pts)}" fill="${f.body}" stroke="${f.body}" stroke-width="1" stroke-linejoin="round"${bodyOpAttr}/>`;
    }
    content += `<path d="${dOf(inset > 0 ? insetPts(f.pts) : f.pts)}" fill="${f.fill}"${stickerOpAttr}/>`;
  }

  // arrows 箭头层(抄 sr renderArrows:所有多边形画完后单独一遍,盖在最上层 ——
  // 教学标注允许伸出轮廓)。箭头 marker 按色去重生成;markerUnits 默认
  // strokeWidth → 箭头三角随线宽缩放(sr createMarkers 同款)。
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
      const aw = a.width ?? 8;
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

  // viewBox 贴着拼图裁(抄 sr 的紧凑取景):包围盒 + 衬底封缝描边半宽(0.5)+ 1px。
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
    const pad = 1.5;
    bx = x0 - pad; by = y0 - pad; bw = x1 - x0 + pad * 2; bh = y1 - y0 + pad * 2;
  }

  const bg = opts.background
    ? `<rect x="${fmt(bx)}" y="${fmt(by)}" width="${fmt(bw)}" height="${fmt(bh)}" fill="${opts.background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(1, Math.round(bw))}" height="${Math.max(1, Math.round(bh))}" viewBox="${fmt(bx)} ${fmt(by)} ${fmt(bw)} ${fmt(bh)}">${bg}${defs}${content}${arrowsOut}</svg>`;
}
