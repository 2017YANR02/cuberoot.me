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
 *   旧描边模型的凸包裁剪 + 外框 hack。衬底「等距内缩 + 同色 round-join 描边」:墨迹
 *   外缘仍只比轮廓胖 0.5px(封住相邻多边形间的抗锯齿细缝,经典 SVG 邻接缝补法),
 *   转角却被磨成圆角 —— 角块不是数学尖角(对应 visualcube renderCubeOutline,
 *   见 cornerRound)。
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

/**
 * 凸多边形等距内缩 d(扁平 xy)—— 逐边沿**内法向**平移 d,再求相邻偏移边的交点。
 * 内法向按「指向质心」判定(小面均为凸形,质心必在内部),与顶点绕向无关。
 * 缩到自交 / 边近乎平行 / 面积翻号即返回 null,由调用方退回不缩的路径。
 *
 * 不用「朝质心等比缩」:那对长条小面的窄边缩得不够、宽边缩过头,做不到"墨迹正好
 * 落回原轮廓"这个前提。
 */
function offsetInward(pts: number[], d: number): number[] | null {
  const n = pts.length / 2;
  if (n < 3 || !(d > 0)) return null;
  let cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i += 2) { cx += pts[i]; cy += pts[i + 1]; }
  cx /= n; cy /= n;

  // 每条边偏移后的一点 + 方向。
  const lines: { px: number; py: number; dx: number; dy: number }[] = [];
  for (let i = 0; i < n; i++) {
    const ax = pts[i * 2], ay = pts[i * 2 + 1];
    const bx = pts[((i + 1) % n) * 2], by = pts[((i + 1) % n) * 2 + 1];
    let ex = bx - ax, ey = by - ay;
    const len = Math.hypot(ex, ey);
    if (!(len > 1e-9)) return null;
    ex /= len; ey /= len;
    let nx = -ey, ny = ex;                                   // 一侧法向
    if (nx * (cx - ax) + ny * (cy - ay) < 0) { nx = -nx; ny = -ny; } // 翻到朝内那侧
    lines.push({ px: ax + nx * d, py: ay + ny * d, dx: ex, dy: ey });
  }

  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = lines[(i + n - 1) % n], b = lines[i];          // 顶点 i = 前一条边 ∩ 本条边
    const det = a.dx * b.dy - a.dy * b.dx;
    if (Math.abs(det) < 1e-9) return null;                   // 近乎平行,交点不可靠
    const t = ((b.px - a.px) * b.dy - (b.py - a.py) * b.dx) / det;
    out.push(a.px + a.dx * t, a.py + a.dy * t);
  }

  // 缩过头会自交:面积符号翻转或塌缩即判失败。
  const area2 = (p: number[]): number => {
    let s = 0;
    for (let i = 0; i < p.length; i += 2) {
      const j = (i + 2) % p.length;
      s += p[i] * p[j + 1] - p[j] * p[i + 1];
    }
    return s;
  };
  const a0 = area2(pts), a1 = area2(out);
  if (!(a0 * a1 > 0) || Math.abs(a1) < Math.abs(a0) * 0.05) return null;
  return out;
}

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
  /** 外轮廓圆角量 = 衬底 round-join 描边宽占小面包围盒长边的比例(圆角半径 = 其半;
   *  衬底先等距内缩同样的量,墨迹范围不变 —— 见实现处注释)。visualcube 的外框走
   *  `renderCubeOutline` + 分组 `stroke-width=0.1 stroke-linejoin=round`,那条圆角
   *  接合就是它角块不锐利的来源。默认 0.0661 = vc 的 0.05 ÷ 它默认视角下的包围盒
   *  半长边 0.7568。0 = 退回 1px 封缝描边,纯锐角。 */
  cornerRound?: number;
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
  /** X 光(visualcube view=trans):跳过背面剔除,连背面小面一起画。已有的 z 排序
   *  (远→近)+ 壳体半透明(bodyOpacity)让背面透过前壳可见。默认 false(只画正面)。 */
  showHidden?: boolean;
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

  interface Facelet { pts: number[]; fill: string; body: string; z: number; hidden: boolean }
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
  const cull = !opts.showHidden; // X 光时不剔除背面(仍跳退化/隐藏槽位)
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
    const hidden = n.dot(camPos) - d <= 0; // 法向背向相机 = 这一面朝里
    if (cull && hidden) return;

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
    facelets.push({ pts, fill, body, z: zSum / view.length, hidden });
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
      // 自由 facelet 遮罩:每实例 HOME sid ∈ mask.keys → 灰(instanced.ts 建槽位键;
      // 键 HOME 位置 = 灰随物理块走)。无键(高阶/镜面回退)则整体不 mask。
      const ikeys = opts.mask
        ? (obj.userData.schematicInstanceKeys as string[] | undefined)
        : undefined;
      for (let i = 0; i < im.count; i++) {
        im.getMatrixAt(i, imat);
        wmat.multiplyMatrices(im.matrixWorld, imat);
        let fill = '#000000';
        if (ikeys && opts.mask!.keys.has(ikeys[i])) fill = opts.mask!.color;
        else if (im.instanceColor) { im.getColorAt(i, ic); fill = hexOf(ic.r, ic.g, ic.b, false); }
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

  // 小面投影包围盒 —— 圆角描边宽按它的长边取,取景余量也按它算。
  let fx0 = Infinity, fy0 = Infinity, fx1 = -Infinity, fy1 = -Infinity;
  for (const f of facelets) {
    for (let i = 0; i < f.pts.length; i += 2) {
      if (f.pts[i] < fx0) fx0 = f.pts[i]; if (f.pts[i] > fx1) fx1 = f.pts[i];
      if (f.pts[i + 1] < fy0) fy0 = f.pts[i + 1]; if (f.pts[i + 1] > fy1) fy1 = f.pts[i + 1];
    }
  }
  const span = facelets.length > 0 ? Math.max(fx1 - fx0, fy1 - fy0) : 0;

  // 外轮廓圆角(对应 visualcube renderCubeOutline 的 round-join 粗描边)。
  //
  // 关键是**墨迹不许越界**。直接给衬底加粗描边会向外胀 roundW/2:胀过邻居贴纸的
  // 内缩余量就啃掉贴纸边缘;即使没啃到,两片衬底的描边在每条小面交界处也互相重叠
  // —— 壳体半透明时那圈重叠二次叠加(0.5 叠 0.5 = 0.75),网格线中间比两侧深一档,
  // 角块交接处一片脏(2026-07-22 用户两次抓到)。
  //
  // 正解是先把多边形**等距内缩** (roundW−1)/2 再描 roundW:描边外缘正好落回原轮廓
  // 外 0.5px —— 与原来那条 1px 封缝描边的墨迹范围逐像素相同(既封住抗锯齿细缝,
  // 又不多占邻居一分),而转角被 round 接头磨成半径 roundW/2 的圆弧。画序、不透明
  // 度、相邻关系全都不动,trans 与 normal 自然同款圆角。
  //
  // 内缩用真正的等距偏移(逐边沿内法向平移后求交),不是朝质心等比缩 —— 等比缩对
  // 长条小面的窄边缩得不够、宽边缩过头,墨迹照样越界。
  const roundW = Math.max(1, (opts.cornerRound ?? 0.0661) * span);

  const backingOf = (f: Facelet): string => {
    // 偏移失败(小面太小 / 退化)→ 该片退回 1px 封缝描边,只是不圆角,不出错。
    const core = roundW > 1 ? offsetInward(f.pts, (roundW - 1) / 2) : null;
    return `<path d="${dOf(core ?? f.pts)}" fill="${f.body}" stroke="${f.body}"`
      + ` stroke-width="${fmt(core ? roundW : 1)}" stroke-linejoin="round"/>`;
  };
  const stickerOf = (f: Facelet): string =>
    `<path d="${dOf(inset > 0 ? insetPts(f.pts) : f.pts)}" fill="${f.fill}"/>`;

  // 半透明层**必须整遍套一个 <g opacity>,不能逐 path 挂**:SVG 的 opacity 是逐元素
  // 合成的,两片 50% 银叠一起就是 75%、三片 87.5%。X 光(showHidden)下正反两面的
  // 小面在投影上大量重叠,逐 path 挂 = 角块附近一堆深浅不一的银方块(2026-07-22
  // 用户抓的「贴片」)。套组则先把组内容拍平再整体乘 alpha,叠多少层都还是一档。
  //
  // 分组与顺序照搬 visualcube drawing.ts:隐藏面贴纸 → 隐藏面壳 → 可见面壳 →
  // 可见面贴纸。壳铺满整面(只有贴纸内缩),所以可见面那遍壳天然把背面贴纸蒙上
  // 一层,X 光的前后层次就是这么来的。
  const g = (inner: string, op: number): string =>
    inner && op < 100 ? `<g opacity="${fmt(op / 100)}">${inner}</g>` : inner;
  const hid = facelets.filter((f) => f.hidden);
  const vis = facelets.filter((f) => !f.hidden);
  const join = (list: Facelet[], f: (x: Facelet) => string): string => list.map(f).join('');

  const content =
    g(join(hid, stickerOf), stickerOp)
    + (inset > 0 ? g(join(hid, backingOf), bodyOp) : '')
    + (inset > 0 ? g(join(vis, backingOf), bodyOp) : '')
    + g(join(vis, stickerOf), stickerOp);

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

  // viewBox 贴着拼图裁(抄 sr 的紧凑取景):小面包围盒 + 衬底描边半宽 + 1px。
  // 衬底缩 0.94 后再描边 roundW,外轮廓落在小面包围盒外 (0.94−1)·半跨 + roundW/2
  // 处 —— 圆角越大这圈越宽,余量跟着算,别把圆角裁掉。不裁的话导整张画布,拼图
  // 缩在中间、四周大片空边。箭头端点(含自身余量)也计入包围盒。
  let bx = 0, by = 0, bw = W, bh = H;
  if (facelets.length > 0 || arrowPads.length > 0) {
    let x0 = fx0, y0 = fy0, x1 = fx1, y1 = fy1;
    for (const p of arrowPads) {
      if (p.x - p.pad < x0) x0 = p.x - p.pad; if (p.x + p.pad > x1) x1 = p.x + p.pad;
      if (p.y - p.pad < y0) y0 = p.y - p.pad; if (p.y + p.pad > y1) y1 = p.y + p.pad;
    }
    // 圆角是「内缩再描边」,墨迹外缘仍只比轮廓胖 0.5px —— 余量不随圆角变。
    const pad = 1.5;
    bx = x0 - pad; by = y0 - pad; bw = x1 - x0 + pad * 2; bh = y1 - y0 + pad * 2;
  }

  const bg = opts.background
    ? `<rect x="${fmt(bx)}" y="${fmt(by)}" width="${fmt(bw)}" height="${fmt(bh)}" fill="${opts.background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(1, Math.round(bw))}" height="${Math.max(1, Math.round(bh))}" viewBox="${fmt(bx)} ${fmt(by)} ${fmt(bw)} ${fmt(bh)}">${bg}${defs}${content}${arrowsOut}</svg>`;
}
