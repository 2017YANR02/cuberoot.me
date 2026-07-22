/**
 * sim_svg_export_schematic — 示意图导出器(visualcube inset 范式 × 引擎相机)。
 *
 * 与 BSP 导出器(实模投影)的分工:示意图只画彩色小面(facelet),不画块身 /
 * 核 / 倒角。魔方静止形态是凸体,可见小面互不遮挡 —— 不需要隐面消除,更不需要
 * BSP。
 *
 * 网格模型**照搬 visualcube**(vendor visualcube/src/cube/drawing.ts):
 *
 *   每个「面」= 一整块壳色面板(renderCubeOutline)+ N² 张内缩贴纸画在面板上
 *   (renderFaceStickers,格内向心缩 1−inset)。贴纸缝隙里透出的面板 = 黑网格。
 *   缝宽是小面尺寸的固定比例 —— 阶数再高小面再小,网格永远等比,不会像绝对 px
 *   描边那样在高阶把贴纸吞成一片黑(40 阶实测教训)。
 *
 *   面板从小面**按世界平面分组**得来:同面小面必共面(引擎割平面求交,跨块误差
 *   ~1e-9),每组投影顶点的凸包 = 该面的精确外形(现有示意路径拼图的面全是凸的:
 *   方 / 三角 / 五边形)。vc 结构下**面板内部没有任何转角与接缝** —— 早前逐小面
 *   衬底的三轮症状(错位 / 半透明叠加 / 格点圆角缺口连成波浪,2026-07-22 用户
 *   连抓三次)在此结构性不存在。
 *
 *   面板「朝投影中心等比缩 + 同色 round-join 描边」(照抄 vc renderCubeOutline 的
 *   ×0.94 + stroke 0.1 round):墨迹外缘落回真实轮廓附近(封住面与面棱上的抗锯齿
 *   细缝),面的外角被磨成圆角 —— 角块不是数学尖角(见 cornerRound)。等比缩的
 *   拉入量与角的锐钝无关,掠射角的尖角面板不会塌角(等距偏移会,2026-07-22 实测)。
 *   圆角只发生在轮廓上,与 vc 一致。
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

/** 凸包(Andrew 单调链),入参/出参均为扁平 xy。共线点剔除:eps 取 1e-3(px² 量纲;
 *  晶格点共线的叉积误差 ~1e-6,真转角的叉积按面积量级为百千 —— 中间隔 6 个数量级)。 */
function convexHull(flat: number[]): number[] {
  const P: [number, number][] = [];
  for (let i = 0; i < flat.length; i += 2) P.push([flat[i], flat[i + 1]]);
  P.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const dedup: [number, number][] = [];
  for (const p of P) {
    const q = dedup[dedup.length - 1];
    if (!q || Math.abs(q[0] - p[0]) > 1e-9 || Math.abs(q[1] - p[1]) > 1e-9) dedup.push(p);
  }
  if (dedup.length < 3) return flat;
  const EPS = 1e-3;
  const half = (pts: [number, number][]): [number, number][] => {
    const h: [number, number][] = [];
    for (const p of pts) {
      while (h.length >= 2) {
        const a = h[h.length - 2], b = h[h.length - 1];
        if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) <= EPS) h.pop();
        else break;
      }
      h.push(p);
    }
    return h;
  };
  const lo = half(dedup), hi = half([...dedup].reverse());
  const hull = [...lo.slice(0, -1), ...hi.slice(0, -1)];
  const out: number[] = [];
  for (const p of hull) out.push(p[0], p[1]);
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
  /** 外轮廓圆角量 = 面板 round-join 描边宽占整体包围盒长边的比例(圆角半径 = 其半;
   *  面板先朝投影中心等比缩同样的量,墨迹落回轮廓 —— 见实现处注释)。visualcube 的
   *  外框走 `renderCubeOutline` ×0.94 + 分组 `stroke-width=0.1 stroke-linejoin=round`,
   *  那条圆角接合就是它角块不锐利的来源。默认 0.0661 = vc 的 0.05 ÷ 它默认视角下的
   *  包围盒半长边 0.7568。0 = 退回 1px 封缝描边,纯锐角。 */
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

  interface Facelet { pts: number[]; fill: string; body: string; z: number; hidden: boolean; plane: number }
  const facelets: Facelet[] = [];
  // 世界平面代表(面板分组用):plane 字段 = 此表下标。
  const planeReps: { nx: number; ny: number; nz: number; d: number }[] = [];
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
    // 世界平面归组:同一面的小面共面(法向 + 距离一致到建模精度)。**不能用 toFixed
    // 量化当 key** —— 两个只差 2e-5 的距离若骑在舍入格线两侧就会被拆进两组,整面
    // 面板碎成 8+1(2026-07-22 用户抓的 L/B/D 面波浪残留)。改为对代表平面做真比较:
    // 法向点积 > 1−1e-6(夹角 < 0.08°,相邻面夹角至少 60° 量级,余量 3 个数量级)、
    // 距离差 < 0.01 世界单位(小面尺寸 ~30,平行的对面相距 ~100,同样余量悬殊)。
    let plane = -1;
    for (let i = 0; i < planeReps.length; i++) {
      const r = planeReps[i];
      if (n.x * r.nx + n.y * r.ny + n.z * r.nz > 1 - 1e-6 && Math.abs(d - r.d) < 0.01) { plane = i; break; }
    }
    if (plane < 0) { plane = planeReps.length; planeReps.push({ nx: n.x, ny: n.y, nz: n.z, d }); }

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
    facelets.push({ pts, fill, body, z: zSum / view.length, hidden, plane });
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

  // ── 面板(vc renderCubeOutline):小面按世界平面分组,组投影顶点的凸包 = 整面 ──
  // 外轮廓圆角:面板朝投影中心等比缩(见 plateCore)再描 roundW(round-join)——
  // 墨迹外缘落回真实轮廓附近(封面与面棱上的抗锯齿缝),面的外角被磨成半径
  // roundW/2 的圆弧。圆角只存在于面板外角(= 拼图轮廓),面板内部没有转角 ——
  // 逐小面衬底时代的格点圆角缺口(波浪)在此结构性不存在。
  const roundW = Math.max(1, (opts.cornerRound ?? 0.0661) * span);
  interface Plate { pts: number[]; body: string; z: number; solo: Facelet[] | null }
  const plateGroups = new Map<string, Facelet[]>();
  for (const f of facelets) {
    const k = `${f.plane}|${f.hidden ? 1 : 0}`;
    const list = plateGroups.get(k);
    if (list) list.push(f); else plateGroups.set(k, [f]);
  }
  const polyArea = (pts: number[]): number => {
    let s = 0;
    for (let i = 0; i < pts.length; i += 2) {
      const j = (i + 2) % pts.length;
      s += pts[i] * pts[j + 1] - pts[j] * pts[i + 1];
    }
    return Math.abs(s) / 2;
  };
  const makePlates = (hidden: boolean): Plate[] => {
    const out: Plate[] = [];
    for (const [k, list] of plateGroups) {
      if (k.endsWith(hidden ? '|1' : '|0')) {
        const z = list.reduce((a, f) => a + f.z, 0) / list.length;
        const flat: number[] = [];
        let tileArea = 0;
        for (const f of list) { flat.push(...f.pts); tileArea += polyArea(f.pts); }
        const hull = convexHull(flat);
        // 面板成立的两个前提,任一不满足即退回逐小面 1px 衬底(锐角但不出错):
        //  ① 同面单一壳色(schematicStroke 逐面覆盖是扩展口,混色时凸包会吞掉覆盖);
        //  ② 小面铺满凸包(投影保关联:共面铺满 → 投影铺满,面积相加 = 凸包面积)。
        //    共面但**不连通**的小面(凸包会架桥盖住中间空当)在此被面积差检出。
        const mixed = list.some((f) => f.body !== list[0].body);
        const tiles = polyArea(hull) <= tileArea * 1.02 + 1;
        out.push(mixed || !tiles
          ? { pts: [], body: list[0].body, z, solo: list }
          : { pts: hull, body: list[0].body, z, solo: null });
      }
    }
    return out.sort((a, b) => a.z - b.z); // 远 → 近,与小面同序
  };
  // 面板内缩 = **朝全局投影中心等比缩放**(照抄 vc renderCubeOutline 的 ×0.94):
  // 拉入量 = (w/2)·R/Rglobal ≤ w/2,与角的锐钝无关。**不能用等距偏移**:等距偏移在
  // 锐角上的拉入量是 d/sin(θ/2),掠射角投影的面板角非常尖,会被拉进十几 px,描边
  // 半径补不回来 → 角上缺一大块墨迹,背面贴纸从缺口裸露 / 正面贴纸尖角戳出轮廓
  // (2026-07-22 用户抓的右上角)。缩放中心 = 整体包围盒中心(vc 的 viewbox 原点即
  // 它的投影中心,同物);面板逐「面」而贴纸不缩 —— 与 vc 完全同构。
  //
  // 系数必须**全图唯一**(vc 给所有面的都是同一个 0.94):相邻两面共享轮廓顶点,
  // 若各按自己面的 rmax 归一,系数不同 → 共享顶点缩到两个不同的位置 → 描边圆弧
  // 圆心错开 → 角上叠出双弧黑凸起(2026-07-22 用户抓的 normal 视图 UFL/DFR)。
  const gcx = (fx0 + fx1) / 2, gcy = (fy0 + fy1) / 2;
  let rGlobal = 0;
  for (const f of facelets) {
    for (let i = 0; i < f.pts.length; i += 2) {
      rGlobal = Math.max(rGlobal, Math.hypot(f.pts[i] - gcx, f.pts[i + 1] - gcy));
    }
  }
  const kGlobal = rGlobal > roundW ? 1 - (roundW / 2) / rGlobal : 0; // 0 = 图太小,退 1px 锐角
  const plateCore = (hull: number[]): number[] | null => {
    if (kGlobal <= 0) return null;
    const out: number[] = [];
    for (let i = 0; i < hull.length; i += 2) {
      out.push(gcx + (hull[i] - gcx) * kGlobal, gcy + (hull[i + 1] - gcy) * kGlobal);
    }
    return out;
  };
  // 面板墨迹的精确包围盒(顶点 ± 描边半宽):r < Rglobal 的轮廓顶点拉入量不足 w/2,
  // 圆弧会探出小面包围盒最多 (w/2)·(1−r/R) —— 掠射角下可接近 w/2,取景必须按实际
  // 墨迹算,不能再假设「胖 0.5px」。
  let ix0 = Infinity, iy0 = Infinity, ix1 = -Infinity, iy1 = -Infinity;
  const inkPts = (pts: number[], half: number): void => {
    for (let i = 0; i < pts.length; i += 2) {
      if (pts[i] - half < ix0) ix0 = pts[i] - half; if (pts[i] + half > ix1) ix1 = pts[i] + half;
      if (pts[i + 1] - half < iy0) iy0 = pts[i + 1] - half; if (pts[i + 1] + half > iy1) iy1 = pts[i + 1] + half;
    }
  };
  const plateOf = (p: Plate): string => {
    if (p.solo) {
      return p.solo.map((f) => {
        inkPts(f.pts, 0.5);
        return `<path d="${dOf(f.pts)}" fill="${f.body}" stroke="${f.body}" stroke-width="1" stroke-linejoin="round"/>`;
      }).join('');
    }
    const core = roundW > 1 ? plateCore(p.pts) : null;
    inkPts(core ?? p.pts, (core ? roundW : 1) / 2);
    return `<path d="${dOf(core ?? p.pts)}" fill="${p.body}" stroke="${p.body}"`
      + ` stroke-width="${fmt(core ? roundW : 1)}" stroke-linejoin="round"/>`;
  };
  const stickerOf = (f: Facelet): string =>
    `<path d="${dOf(inset > 0 ? insetPts(f.pts) : f.pts)}" fill="${f.fill}"/>`;

  // 半透明层**必须整遍套一个 <g opacity>,不能逐 path 挂**:SVG 的 opacity 是逐元素
  // 合成的,两片 50% 银叠一起就是 75%、三片 87.5%。X 光(showHidden)下正反两面
  // 在投影上大量重叠,逐 path 挂 = 角块附近一堆深浅不一的银方块(2026-07-22 用户
  // 抓的「贴片」)。套组则先把组内容拍平再整体乘 alpha,叠多少层都还是一档。
  //
  // 分组与顺序照搬 visualcube drawing.ts:隐藏面贴纸 → 隐藏面板 → 可见面板 →
  // 可见面贴纸。面板铺满整面(只有贴纸内缩),所以可见面那遍面板天然把背面贴纸
  // 蒙上一层,X 光的前后层次就是这么来的。
  const g = (inner: string, op: number): string =>
    inner && op < 100 ? `<g opacity="${fmt(op / 100)}">${inner}</g>` : inner;
  const hid = facelets.filter((f) => f.hidden);
  const vis = facelets.filter((f) => !f.hidden);
  const join = (list: Facelet[], f: (x: Facelet) => string): string => list.map(f).join('');

  const content =
    g(join(hid, stickerOf), stickerOp)
    + (inset > 0 ? g(makePlates(true).map(plateOf).join(''), bodyOp) : '')
    + (inset > 0 ? g(makePlates(false).map(plateOf).join(''), bodyOp) : '')
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

  // viewBox 贴着拼图裁(抄 sr 的紧凑取景):小面包围盒 ∪ 面板墨迹包围盒(inkPts,
  // 圆弧探出量已含) ∪ 箭头端点余量,再加 1.5px。不裁的话导整张画布,拼图缩在中间、
  // 四周大片空边;裁太狠则掠射角下圆弧被切平。
  let bx = 0, by = 0, bw = W, bh = H;
  if (facelets.length > 0 || arrowPads.length > 0) {
    let x0 = fx0, y0 = fy0, x1 = fx1, y1 = fy1;
    if (ix0 < x0) x0 = ix0; if (ix1 > x1) x1 = ix1;
    if (iy0 < y0) y0 = iy0; if (iy1 > y1) y1 = iy1;
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
