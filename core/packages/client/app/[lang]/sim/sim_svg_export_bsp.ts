/**
 * sim_svg_export_bsp — BSP 解析隐面消除矢量导出(伴图 / 服务端缩略图管线)。
 *
 * 与 sim_svg_export(截图路径)的本质区别:排序不再依赖 GPU 深度图逐像素采样
 * + 递归细分(遮挡边界是 ~3px² 像素阶梯 = 毛刺),而是把场景三角形建成 BSP 树,
 * 依相机位置 back-to-front 遍历得到**精确** painter 序;跨越分割面的面片被解析
 * 切开(Sutherland–Hodgman),遮挡边界 = 平面求交直线,任意放大无锯齿。全程
 * 纯数学、不需要 WebGL,可在 Node 运行(服务端缩略图的前置条件)。
 *
 * 覆盖范围(伴图 / 缩略图 / 「截图 SVG」按钮默认路径):Mesh + InstancedMesh
 * (instanceColor / 零缩放隐藏实例 / 材质组 / 顶点色 / Lambert 光照 / 透明 /
 * emissive)。跳过:SkinnedMesh(手)、Sprite(方位字母)、贴图(logo)、原核
 * 分色 —— 截图按钮检测到这些特性在场时回退 exportSimSvg 的 GPU depth-map 路径
 * (SimCaptureGroup 的 gpuOnly 检测)。
 *
 * 输出阶段:paint 序中连续、同平面同色的面片做「共享边相消」边界重建,合并成
 * 单条 <path>(贴纸 / 面板恢复为一个多边形轮廓,path 数回到贴纸量级);重建
 * 失败(T 交点 / 精度)降级为逐面片输出,画面仍正确只是 path 变多。不透明
 * path 带同色描边盖抗锯齿细缝(与截图路径同策略);描边宽随碎片面积收缩、
 * join 全直线段(无 round),防亚像素碎片被描边吹成圆角"黑点"。
 */
import * as THREE from 'three';
import type World from './engine/world';
import { clipPolyByPlane, hexOf, fmt } from './sim_svg_export';

export interface BspSvgExportOptions {
  world: Pick<World, 'scene' | 'camera' | 'width' | 'height'>;
  /** 背景色;默认 null = 透明。 */
  background?: string | null;
  /** 材质色已是 sRGB 域(cubing.js 场景)时 true,跳过线性→sRGB 输出转换。 */
  srgbColors?: boolean;
  /** 面片总数上限(输入 + BSP 分裂产物),超出抛 SVG_TOO_COMPLEX。 */
  maxTriangles?: number;
}

const DEFAULT_MAX_TRIS = 400_000;
/** 屏幕面积(shoelace ×2)低于此值的面片丢弃。 */
const MIN_AREA2 = 0.04;
/** 共面判定容差与场景尺度挂钩(camDist):引擎场景 1248 → 0.0125(贴纸抬升
 *  0.1 的 1/8,分得开);twisty 场景 6 → 6e-5(贴纸与黑底严格共面,归并同档)。 */
const EPS_RATIO = 1e-5;
/** 边界重建的顶点 key 量化(px)。低于此距离的顶点视为同点;bevel 扇面顶点更密
 *  时链条断裂 → 自动降级逐面片,不影响正确性。 */
const MERGE_QUANT = 1 / 8;

/** 流水线面片:世界坐标顶点 + 所在平面 + 已算好的填充。 */
interface BspPoly {
  /** 扁平 (x,y,z) 世界坐标;绕向统一为面向相机(背面材质已翻转)。 */
  pts: number[];
  nx: number; ny: number; nz: number; d: number; // 平面 n·p = d,n 朝相机侧
  fill: string;
  opacity: number;
  ro: number;
  seq: number;
}

interface BspNode {
  nx: number; ny: number; nz: number; d: number;
  polys: BspPoly[];
  id: number;
  front: BspNode | null;
  back: BspNode | null;
}

/** paint 序中的投影面片(调试 / 测试 oracle 用)。pts = (x, y, viewZ) 三元组。 */
export interface OrderedScreenPoly {
  pts: number[];
  fill: string;
  opacity: number;
  nodeId: number;
}

const ON = 0, FRONT = 1, BACK = 2, SPAN = 3;

function classifyPoly(pts: number[], nx: number, ny: number, nz: number, d: number, eps: number, dists: number[]): number {
  let f = 0, b = 0;
  const n = pts.length / 3;
  for (let i = 0; i < n; i++) {
    const dist = pts[i * 3] * nx + pts[i * 3 + 1] * ny + pts[i * 3 + 2] * nz - d;
    dists[i] = dist;
    if (dist > eps) f++;
    else if (dist < -eps) b++;
  }
  if (f > 0 && b > 0) return SPAN;
  if (f > 0) return FRONT;
  if (b > 0) return BACK;
  return ON;
}

/** SPAN 面片按平面切成前后两片(共享切线上的精确交点;dists 来自 classifyPoly
 *  的同一次计算)。任一侧退化(<3 点)时整片落到另一侧。 */
function splitPoly(p: BspPoly, eps: number, dists: number[], frontOut: BspPoly[], backOut: BspPoly[]): void {
  const pts = p.pts;
  const n = pts.length / 3;
  const fPts: number[] = [];
  const bPts: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const da = dists[i];
    const db = dists[j];
    const ca = da > eps ? FRONT : da < -eps ? BACK : ON;
    const cb = db > eps ? FRONT : db < -eps ? BACK : ON;
    const ax = pts[i * 3], ay = pts[i * 3 + 1], az = pts[i * 3 + 2];
    if (ca !== BACK) fPts.push(ax, ay, az);
    if (ca !== FRONT) bPts.push(ax, ay, az);
    if ((ca === FRONT && cb === BACK) || (ca === BACK && cb === FRONT)) {
      const t = da / (da - db);
      const ix = ax + (pts[j * 3] - ax) * t;
      const iy = ay + (pts[j * 3 + 1] - ay) * t;
      const iz = az + (pts[j * 3 + 2] - az) * t;
      fPts.push(ix, iy, iz);
      bPts.push(ix, iy, iz);
    }
  }
  const fOk = fPts.length >= 9;
  const bOk = bPts.length >= 9;
  if (fOk && bOk) {
    frontOut.push({ ...p, pts: fPts });
    backOut.push({ ...p, pts: bPts });
  } else if (fOk) {
    frontOut.push({ ...p, pts: fPts });
  } else if (bOk) {
    backOut.push({ ...p, pts: bPts });
  }
}

interface BuildCtx { eps: number; pieces: number; maxPieces: number; nextId: number; dists: number[]; }

/** 分割面选择:候选取列表等距抽样,代价 = 跨越数×8 + 前后失衡,取最小。
 *  拼图场景的平面高度复用(面 / 贴纸 / 倒角族),跨越基本可避免。 */
function pickSplitter(polys: BspPoly[], ctx: BuildCtx): BspPoly {
  const nCand = Math.min(8, polys.length);
  const candStride = Math.max(1, Math.floor(polys.length / nCand));
  const nEval = Math.min(128, polys.length);
  const evalStride = Math.max(1, Math.floor(polys.length / nEval));
  let best: BspPoly = polys[0];
  let bestCost = Infinity;
  for (let c = 0; c < nCand; c++) {
    const cand = polys[c * candStride];
    let span = 0, front = 0, back = 0;
    for (let i = 0; i < polys.length; i += evalStride) {
      const cls = classifyPoly(polys[i].pts, cand.nx, cand.ny, cand.nz, cand.d, ctx.eps, ctx.dists);
      if (cls === SPAN) span++;
      else if (cls === FRONT) front++;
      else if (cls === BACK) back++;
    }
    const cost = span * 8 + Math.abs(front - back);
    if (cost < bestCost) { bestCost = cost; best = cand; }
    if (bestCost === 0) break;
  }
  return best;
}

function buildBsp(polys: BspPoly[], ctx: BuildCtx): BspNode | null {
  if (polys.length === 0) return null;
  const sp = pickSplitter(polys, ctx);
  const node: BspNode = { nx: sp.nx, ny: sp.ny, nz: sp.nz, d: sp.d, polys: [], id: ctx.nextId++, front: null, back: null };
  const frontList: BspPoly[] = [];
  const backList: BspPoly[] = [];
  for (const p of polys) {
    const cls = classifyPoly(p.pts, node.nx, node.ny, node.nz, node.d, ctx.eps, ctx.dists);
    if (cls === ON) node.polys.push(p);
    else if (cls === FRONT) frontList.push(p);
    else if (cls === BACK) backList.push(p);
    else {
      ctx.pieces++;
      if (ctx.pieces > ctx.maxPieces) throw new Error(`SVG_TOO_COMPLEX:${ctx.pieces}`);
      splitPoly(p, ctx.eps, ctx.dists, frontList, backList);
    }
  }
  // 共面并档内:renderOrder 小的先画;同档按采集序倒序(painter 后画才赢,
  // 倒序 = GL「先画先赢」语义,与截图路径一致)。
  node.polys.sort((a, b) => (a.ro !== b.ro ? a.ro - b.ro : b.seq - a.seq));
  node.front = buildBsp(frontList, ctx);
  node.back = buildBsp(backList, ctx);
  return node;
}

function paintOrderOf(node: BspNode | null, cx: number, cy: number, cz: number, out: { poly: BspPoly; nodeId: number }[]): void {
  if (!node) return;
  const s = node.nx * cx + node.ny * cy + node.nz * cz - node.d;
  const first = s >= 0 ? node.back : node.front;
  const second = s >= 0 ? node.front : node.back;
  paintOrderOf(first, cx, cy, cz, out);
  for (const poly of node.polys) out.push({ poly, nodeId: node.id });
  paintOrderOf(second, cx, cy, cz, out);
}

interface SceneLightAmb { mask: number; r: number; g: number; b: number; }
interface SceneLightDir extends SceneLightAmb { dx: number; dy: number; dz: number; }

interface MaterialLike {
  visible?: boolean;
  color?: THREE.Color;
  opacity?: number;
  transparent?: boolean;
  side?: THREE.Side;
  vertexColors?: boolean;
  emissive?: THREE.Color;
  isMeshBasicMaterial?: boolean;
  map?: unknown;
}

/** 场景特性审计 — 调用方据此决定是否用本管线:
 *  - losesDetail:含 BSP 画不出的元素(手 SkinnedMesh / 方位字母 Sprite / logo
 *    贴图),导出仍正确但缺这些元素。「截图 SVG」按钮(全保真诉求)据此回退
 *    GPU depth-map 路径;伴图(镜像诉求)可忽略。
 *  - miscolors:含 BSP 会**画错色**的特性(原核分色 aRaw:着色在 shader 里,
 *    CPU 读 material.color 只能得底色)。任何调用方都应回退。 */
export function bspSceneAudit(scene: THREE.Object3D): { losesDetail: boolean; miscolors: boolean } {
  let losesDetail = false;
  let miscolors = false;
  scene.traverseVisible((o) => {
    const any = o as unknown as { isSkinnedMesh?: boolean; isSprite?: boolean; isMesh?: boolean };
    if (any.isSkinnedMesh || any.isSprite) { losesDetail = true; return; }
    if (!any.isMesh) return;
    const m = o as THREE.Mesh;
    if ((m.geometry as THREE.BufferGeometry).getAttribute('aRaw')) { miscolors = true; return; }
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      if ((mat as MaterialLike).map) { losesDetail = true; return; }
    }
  });
  return { losesDetail, miscolors };
}

/** 共享边相消 + 链化:同平面同色面片簇 → 边界环(含洞,绕向天然相反,nonzero
 *  填充规则自动处理)。链化失败返回 null(降级逐面片)。 */
function mergeRunToLoops(run: number[][]): number[][] | null {
  const key = (x: number, y: number): string => `${Math.round(x / MERGE_QUANT)},${Math.round(y / MERGE_QUANT)}`;
  // 输出坐标吸附到量化格点:相邻碎片的"同一个"顶点原始浮点可差 0~1/8px,直接
  // 输出会在边界链上留下亚像素微锯齿(描边 join 处成毛刺);吸附后严格同点,
  // 误差 ≤1/16px 不可见。
  const snap = (v: number): number => Math.round(v / MERGE_QUANT) * MERGE_QUANT;
  const edges = new Map<string, [number, number, number, number]>();
  for (const pts of run) {
    const n = pts.length / 3;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = pts[i * 3], ay = pts[i * 3 + 1];
      const bx = pts[j * 3], by = pts[j * 3 + 1];
      const ka = key(ax, ay);
      const kb = key(bx, by);
      if (ka === kb) continue; // 量化后退化边
      const rk = `${kb}|${ka}`;
      if (edges.has(rk)) edges.delete(rk);
      else {
        const fk = `${ka}|${kb}`;
        if (edges.has(fk)) return null; // 重边(翼形/自叠),放弃合并
        edges.set(fk, [snap(ax), snap(ay), snap(bx), snap(by)]);
      }
    }
  }
  if (edges.size === 0) return null;
  // 起点 key → 边 key 列表
  const outAt = new Map<string, string[]>();
  for (const k of edges.keys()) {
    const from = k.slice(0, k.indexOf('|'));
    const arr = outAt.get(from);
    if (arr) arr.push(k); else outAt.set(from, [k]);
  }
  const loops: number[][] = [];
  const used = new Set<string>();
  for (const startKey of edges.keys()) {
    if (used.has(startKey)) continue;
    const loop: number[] = [];
    let ek: string | undefined = startKey;
    const loopStart = startKey.slice(0, startKey.indexOf('|'));
    let guard = edges.size + 1;
    while (ek !== undefined) {
      if (used.has(ek)) return null; // 撞上已用边 = 结构异常
      used.add(ek);
      const e = edges.get(ek)!;
      loop.push(e[0], e[1]);
      const toKey = ek.slice(ek.indexOf('|') + 1);
      if (toKey === loopStart) { ek = undefined; break; } // 闭合
      const nexts = outAt.get(toKey);
      let next: string | undefined;
      if (nexts) {
        for (const cand of nexts) {
          if (!used.has(cand)) { next = cand; break; }
        }
      }
      if (next === undefined) return null; // 断链
      ek = next;
      if (--guard <= 0) return null;
    }
    if (loop.length < 6) return null;
    loops.push(loop);
  }
  return loops;
}

/** 导出 + paint 序调试信息(测试 oracle / 浏览器诊断共用)。 */
export function exportSimSvgBspWithDebug(opts: BspSvgExportOptions): { svg: string; order: OrderedScreenPoly[]; inputTris: number; pieces: number } {
  const { world } = opts;
  const scene = world.scene as THREE.Scene;
  const camera = world.camera as THREE.PerspectiveCamera;
  const W = Math.max(1, Math.round(world.width));
  const H = Math.max(1, Math.round(world.height));
  const maxTris = opts.maxTriangles ?? DEFAULT_MAX_TRIS;
  const srgbOut = opts.srgbColors === true;

  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const viewMat = new THREE.Matrix4().copy(camera.matrixWorld).invert();
  const projMat = camera.projectionMatrix;
  const near = camera.near;
  const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
  const camDist = Math.max(1e-6, camPos.length());
  const eps = Math.max(1e-9, camDist * EPS_RATIO);

  // ── 收集光源 + 网格 ──────────────────────────────────────────────────────
  const ambients: SceneLightAmb[] = [];
  const dirLights: SceneLightDir[] = [];
  const meshes: THREE.Mesh[] = [];
  scene.traverseVisible((obj) => {
    const any = obj as unknown as { isAmbientLight?: boolean; isDirectionalLight?: boolean; isMesh?: boolean; isSkinnedMesh?: boolean; isSprite?: boolean };
    if (any.isAmbientLight) {
      const l = obj as THREE.AmbientLight;
      ambients.push({ mask: obj.layers.mask, r: (l.color.r * l.intensity) / Math.PI, g: (l.color.g * l.intensity) / Math.PI, b: (l.color.b * l.intensity) / Math.PI });
    } else if (any.isDirectionalLight) {
      const l = obj as THREE.DirectionalLight;
      const dir = new THREE.Vector3().setFromMatrixPosition(l.matrixWorld)
        .sub(new THREE.Vector3().setFromMatrixPosition(l.target.matrixWorld))
        .normalize();
      dirLights.push({ mask: obj.layers.mask, dx: dir.x, dy: dir.y, dz: dir.z, r: (l.color.r * l.intensity) / Math.PI, g: (l.color.g * l.intensity) / Math.PI, b: (l.color.b * l.intensity) / Math.PI });
    } else if (any.isMesh && !any.isSkinnedMesh) {
      meshes.push(obj as THREE.Mesh);
    }
    // SkinnedMesh / Sprite:截图路径专属,此管线跳过(见文件头)。
  });

  function lightFactor(nx: number, ny: number, nz: number, mask: number): [number, number, number] {
    let r = 0, g = 0, b = 0;
    for (const a of ambients) {
      if (a.mask & mask) { r += a.r; g += a.g; b += a.b; }
    }
    for (const dl of dirLights) {
      if (!(dl.mask & mask)) continue;
      const nl = nx * dl.dx + ny * dl.dy + nz * dl.dz;
      if (nl > 0) { r += dl.r * nl; g += dl.g * nl; b += dl.b * nl; }
    }
    return [r, g, b];
  }

  // ── 收集面片(世界坐标 + 已算填充色;背面剔除 / 背面材质翻转向相机) ─────
  const polys: BspPoly[] = [];
  const instLocal = new THREE.Matrix4();
  const instWorld = new THREE.Matrix4();
  const normalMat = new THREE.Matrix3();
  const va = new THREE.Vector3(); const vb = new THREE.Vector3(); const vc = new THREE.Vector3();
  const e1 = new THREE.Vector3(); const e2 = new THREE.Vector3();
  const ln = new THREE.Vector3(); const tmpN = new THREE.Vector3();

  for (const mesh of meshes) {
    const geom = mesh.geometry as THREE.BufferGeometry;
    const posAttr = geom.getAttribute('position');
    if (!posAttr) continue;
    const normAttr = geom.getAttribute('normal') ?? null;
    const colAttr = geom.getAttribute('color') ?? null;
    const index = geom.getIndex();
    const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as MaterialLike[];
    const inst = (mesh as THREE.InstancedMesh).isInstancedMesh ? (mesh as THREE.InstancedMesh) : null;
    const instCount = inst ? inst.count : 1;
    const ro = mesh.renderOrder || 0;
    const mask = mesh.layers.mask;

    const vertTotal = index ? index.count : posAttr.count;
    if (vertTotal < 3) continue;

    const ranges: { start: number; count: number; mat: MaterialLike }[] = [];
    if (mats.length > 1 && geom.groups.length > 0) {
      for (const gp of geom.groups) {
        const mat = mats[gp.materialIndex ?? 0];
        if (!mat) continue;
        const count = Math.min(gp.count, vertTotal - gp.start);
        if (count > 0) ranges.push({ start: gp.start, count, mat });
      }
    } else {
      ranges.push({ start: 0, count: vertTotal, mat: mats[0] });
    }

    for (let i = 0; i < instCount; i++) {
      let instR = 1, instG = 1, instB = 1;
      if (inst) {
        instLocal.fromArray(inst.instanceMatrix.array as ArrayLike<number>, i * 16);
        const el = instLocal.elements;
        if (el[0] * el[0] + el[1] * el[1] + el[2] * el[2] < 1e-12) continue; // 零缩放 = 隐藏
        instWorld.multiplyMatrices(mesh.matrixWorld, instLocal);
        if (inst.instanceColor) {
          instR = inst.instanceColor.getX(i);
          instG = inst.instanceColor.getY(i);
          instB = inst.instanceColor.getZ(i);
        }
      } else {
        instWorld.copy(mesh.matrixWorld);
      }
      normalMat.getNormalMatrix(instWorld);

      for (const range of ranges) {
        const mat = range.mat;
        if (mat.visible === false) continue;
        if (mat.map) continue; // 贴图材质(logo 贴片):画成实心色块必错,直接不画
        const opacity = mat.transparent ? (mat.opacity ?? 1) : 1;
        if (opacity <= 0.01) continue;
        const side = mat.side ?? THREE.FrontSide;
        const unlit = mat.isMeshBasicMaterial === true;
        const matR = mat.color?.r ?? 1, matG = mat.color?.g ?? 1, matB = mat.color?.b ?? 1;
        const emR = mat.emissive?.r ?? 0, emG = mat.emissive?.g ?? 0, emB = mat.emissive?.b ?? 0;

        const triStart = Math.floor(range.start / 3);
        const triEnd = Math.floor((range.start + range.count) / 3);
        for (let t = triStart; t < triEnd; t++) {
          const i0 = index ? index.getX(t * 3) : t * 3;
          const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
          const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;
          va.fromBufferAttribute(posAttr, i0).applyMatrix4(instWorld);
          vb.fromBufferAttribute(posAttr, i1).applyMatrix4(instWorld);
          vc.fromBufferAttribute(posAttr, i2).applyMatrix4(instWorld);
          e1.subVectors(vb, va);
          e2.subVectors(vc, va);
          ln.crossVectors(e1, e2);
          const len = ln.length();
          if (len < 1e-12) continue; // 退化
          let nx = ln.x / len, ny = ln.y / len, nz = ln.z / len;
          let d = nx * va.x + ny * va.y + nz * va.z;
          const facing = nx * camPos.x + ny * camPos.y + nz * camPos.z - d > 0;
          if (side === THREE.FrontSide && !facing) continue;
          if (side === THREE.BackSide && facing) continue;
          let pts: number[];
          if (facing) {
            pts = [va.x, va.y, va.z, vb.x, vb.y, vb.z, vc.x, vc.y, vc.z];
          } else {
            // 背对的可见面(BackSide / DoubleSide)翻转:统一绕向,合并相消才成立
            pts = [va.x, va.y, va.z, vc.x, vc.y, vc.z, vb.x, vb.y, vb.z];
            nx = -nx; ny = -ny; nz = -nz; d = -d;
          }

          let lr = 1, lg = 1, lb = 1;
          if (!unlit) {
            if (normAttr) {
              ln.fromBufferAttribute(normAttr, i0);
              ln.add(tmpN.fromBufferAttribute(normAttr, i1));
              ln.add(tmpN.fromBufferAttribute(normAttr, i2));
              ln.applyMatrix3(normalMat).normalize();
              if (!facing) ln.negate();
              [lr, lg, lb] = lightFactor(ln.x, ln.y, ln.z, mask);
            } else {
              [lr, lg, lb] = lightFactor(nx, ny, nz, mask);
            }
          }
          let r = matR * instR, g = matG * instG, b = matB * instB;
          if (colAttr && mat.vertexColors) {
            r *= (colAttr.getX(i0) + colAttr.getX(i1) + colAttr.getX(i2)) / 3;
            g *= (colAttr.getY(i0) + colAttr.getY(i1) + colAttr.getY(i2)) / 3;
            b *= (colAttr.getZ(i0) + colAttr.getZ(i1) + colAttr.getZ(i2)) / 3;
          }
          const fill = hexOf(r * lr + emR, g * lg + emG, b * lb + emB, srgbOut);
          if (polys.length >= maxTris) throw new Error(`SVG_TOO_COMPLEX:${polys.length}`);
          polys.push({ pts, nx, ny, nz, d, fill, opacity, ro, seq: polys.length });
        }
      }
    }
  }

  const inputTris = polys.length;

  // ── BSP 构建 + back-to-front 遍历 ────────────────────────────────────────
  const ctx: BuildCtx = { eps, pieces: inputTris, maxPieces: maxTris, nextId: 0, dists: [] };
  const root = buildBsp(polys, ctx);
  const painted: { poly: BspPoly; nodeId: number }[] = [];
  paintOrderOf(root, camPos.x, camPos.y, camPos.z, painted);

  // ── 投影(近裁剪 + 透视 + 屏幕剔除;不做任何细分) ───────────────────────
  const v4 = new THREE.Vector4();
  const order: OrderedScreenPoly[] = [];
  for (const { poly, nodeId } of painted) {
    const n = poly.pts.length / 3;
    let view: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      view.push(new THREE.Vector3(poly.pts[i * 3], poly.pts[i * 3 + 1], poly.pts[i * 3 + 2]).applyMatrix4(viewMat));
    }
    for (const p of view) {
      if (p.z > -near) { view = clipPolyByPlane(view, 0, 0, -1, -near); break; }
    }
    if (view.length < 3) continue;
    const pts: number[] = [];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of view) {
      v4.set(p.x, p.y, p.z, 1).applyMatrix4(projMat);
      const inv = 1 / v4.w;
      const x = (v4.x * inv * 0.5 + 0.5) * W;
      const y = (0.5 - v4.y * inv * 0.5) * H;
      pts.push(x, y, p.z);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    if (maxX < 0 || minX > W || maxY < 0 || minY > H) continue;
    let area2 = 0;
    for (let i = 0, m = view.length; i < m; i++) {
      const j = (i + 1) % m;
      area2 += pts[i * 3] * pts[j * 3 + 1] - pts[j * 3] * pts[i * 3 + 1];
    }
    if (Math.abs(area2) < MIN_AREA2) continue;
    order.push({ pts, fill: poly.fill, opacity: poly.opacity, nodeId });
  }

  // ── 输出:同 (node, fill, opacity) 连续段先边界重建合并,再同色接续拼 path ──
  /** solo = 描边宽自适应的小碎片,独立成 path;false = 可并进同色 run(1.2)。 */
  interface EmitItem { fill: string; opacity: number; d: string; solo: boolean; strokeW: number; }
  const items: EmitItem[] = [];

  const dOf = (loop: number[], stride: number): string => {
    let s = `M${fmt(loop[0])} ${fmt(loop[1])}`;
    for (let i = stride; i < loop.length; i += stride) s += `L${fmt(loop[i])} ${fmt(loop[i + 1])}`;
    return s + 'Z';
  };

  const emitSingle = (pts: number[], fill: string, opacity: number): void => {
    // 描边宽 = min(1.2, 自身平均宽):大面统一 1.2 盖 AA 缝;小碎片(纤条 / 孤立
    // 小片)随面积收缩 —— 否则同色描边会把亚像素几何吹成数倍大的"黑点"。不足
    // 1.2 的单独成 path(并进同色大 run 会被 run 的 1.2 覆盖)。
    let area2 = 0, perim = 0;
    const n = pts.length / 3;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area2 += pts[i * 3] * pts[j * 3 + 1] - pts[j * 3] * pts[i * 3 + 1];
      perim += Math.hypot(pts[j * 3] - pts[i * 3], pts[j * 3 + 1] - pts[i * 3 + 1]);
    }
    const w = Math.min(1.2, Math.max(0.25, 0.5 * Math.abs(area2) / Math.max(1e-6, perim)));
    items.push({ fill, opacity, d: dOf(pts, 3), solo: w < 1.2, strokeW: w });
  };

  let runStart = 0;
  const flushRun = (end: number): void => {
    const count = end - runStart;
    if (count <= 0) return;
    const first = order[runStart];
    if (count === 1) {
      emitSingle(first.pts, first.fill, first.opacity);
    } else {
      const loops = mergeRunToLoops(order.slice(runStart, end).map((o) => o.pts));
      if (loops) {
        items.push({ fill: first.fill, opacity: first.opacity, d: loops.map((l) => dOf(l, 2)).join(''), solo: false, strokeW: 1.2 });
      } else {
        for (let i = runStart; i < end; i++) emitSingle(order[i].pts, order[i].fill, order[i].opacity);
      }
    }
    runStart = end;
  };
  for (let i = 1; i <= order.length; i++) {
    if (i === order.length
      || order[i].nodeId !== order[runStart].nodeId
      || order[i].fill !== order[runStart].fill
      || order[i].opacity !== order[runStart].opacity) flushRun(i);
  }

  // 相邻同色项继续拼进一条 <path>(跨平面,painter 序不变)
  const body: string[] = [];
  let curFill = '';
  let curOp = -1;
  let curD: string[] = [];
  // join 用 bevel(每个转角一刀直切):round 把小碎片描成圆团"黑点",miter 在
  // 边界微锯齿顶点长出针刺(miterlimit 只截到 4×宽)。bevel 零外延、无圆弧、
  // 无针刺,是唯一既保直线段又不放大顶点噪声的 join。
  const flush = (): void => {
    if (curD.length === 0) return;
    const attrs = curOp < 1
      ? ` fill-opacity="${fmt(curOp)}"`
      : ` stroke="${curFill}" stroke-width="1.2" stroke-linejoin="bevel"`;
    body.push(`<path d="${curD.join('')}" fill="${curFill}"${attrs}/>`);
    curD = [];
  };
  for (const it of items) {
    if (it.solo) {
      flush();
      const op = it.opacity < 1 ? ` fill-opacity="${fmt(it.opacity)}"` : '';
      const st = it.opacity < 1 ? '' : ` stroke="${it.fill}" stroke-width="${fmt(it.strokeW)}" stroke-linejoin="bevel"`;
      body.push(`<path d="${it.d}" fill="${it.fill}"${op}${st}/>`);
      continue;
    }
    if (it.fill !== curFill || it.opacity !== curOp) {
      flush();
      curFill = it.fill;
      curOp = it.opacity;
    }
    curD.push(it.d);
  }
  flush();

  const bg = opts.background ? `<rect width="100%" height="100%" fill="${opts.background}"/>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${bg}${body.join('')}</svg>`;
  return { svg, order, inputTris, pieces: ctx.pieces };
}

export function exportSimSvgBsp(opts: BspSvgExportOptions): string {
  return exportSimSvgBspWithDebug(opts).svg;
}
