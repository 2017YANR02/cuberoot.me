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

  const stroke = strokeW > 0 ? ` stroke="#000000" stroke-width="${fmt(strokeW)}"` : '';
  const body = facelets.map((f) => {
    let dStr = `M${fmt(f.pts[0])} ${fmt(f.pts[1])}`;
    for (let i = 2; i < f.pts.length; i += 2) dStr += `L${fmt(f.pts[i])} ${fmt(f.pts[i + 1])}`;
    return `<path d="${dStr}Z" fill="${f.fill}"${stroke}/>`;
  });

  const bg = opts.background ? `<rect width="100%" height="100%" fill="${opts.background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${bg}${body.join('')}</svg>`;
}
