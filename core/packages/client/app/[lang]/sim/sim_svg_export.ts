/**
 * sim_svg_export — 当前 /sim 场景静止帧 → 矢量 SVG(「截图」的矢量版,全拼图通用)。
 *
 * 做法: 遍历 world.scene 收集可见面片(Mesh / InstancedMesh / SkinnedMesh / Sprite),
 * 世界坐标 → 视空间 → 近平面裁剪 → 透视投影 → 屏幕空间按绕向剔除背面,painter's
 * algorithm 按视深(远→近)排序输出;相邻同色面片合并成一条 <path> 并以同色细描边
 * 盖住抗锯齿细缝(与 three SVGRenderer 同策略)。
 *
 *  - 光照: Lambert 近似 = albedo × (Σ ambient + Σ directional·max(0,N·L)),intensity/π
 *    对齐 r155+ 物理光照数值;per-light layers 过滤(手部补光 layer 1 只照手)。
 *    Phong/Standard 同按 Lambert 处理(忽略高光,哑光场景视觉等价)。
 *  - InstancedMesh: 零缩放矩阵 = 隐藏实例,列向量长度≈0 直接跳;instanceColor 参与调色。
 *  - SkinnedMesh: applyBoneTransform 逐顶点烘焙当前姿态(手指 / 全身人物)。
 *  - 原核(rawCore): CPU 复算 shader 的「localPos·法向最大的可见面取色」,并按 argmax
 *    分割平面切开三角形 —— 棱块对角双色 / 角块三色分割线与 GPU 渲染一致。
 *  - 贴图: 小网格(U 面 logo 贴片)逐三角 clipPath + <image> 仿射贴图保字形;大网格
 *    (手部皮肤)质心 UV 采样成纯色。Sprite(方位字母)整张输出为屏幕对齐 <image>。
 *
 * 已知近似: painter 排序对互穿几何可能排错(与 three SVGRenderer 同级);贴图不做
 * 逐像素光照;背景与 PNG 截图一致导出为透明。
 */
import * as THREE from 'three';
import type World from './engine/world';
import { getRawCoreBorder } from './engine/nxn/rawCore';
import { STICKER_INNER, STICKER_CORNER_RADIUS } from './engine/define';

export interface SimSvgExportOptions {
  world: Pick<World, 'scene' | 'camera' | 'width' | 'height'>;
  /** live WebGL renderer(可选)。给了就先渲一张 GPU 深度图做隐藏面剔除:
   *  被遮住的面片(贴纸下的塑料 / 内填充 / 背面块)直接不进 SVG —— painter
   *  排序只处理真可见面片,穿插错排基本消失,文件也小一半以上。 */
  renderer?: THREE.WebGLRenderer | null;
  /** 背景色(CSS color);默认 null = 透明,与 PNG 截图一致。 */
  background?: string | null;
  /** 材质/顶点色已是 sRGB 域(cubing.js 旧版 three 无色彩管理,颜色按字节直存)。
   *  true = 跳过输出端 线性→sRGB 转换,防双重转换偏亮。引擎场景(色彩管理开,
   *  线性域)保持默认 false。 */
  srgbColors?: boolean;
  /** 输出面片总数上限(超高阶 NxN 防炸内存/冻页面),超出抛错。 */
  maxTriangles?: number;
}

const DEFAULT_MAX_TRIS = 400_000;
/** 贴图网格 ≤ 此三角形数时走逐三角仿射 <image>(logo 平面 = 2),更大走质心采样。 */
const AFFINE_TEX_TRI_LIMIT = 128;
/** 屏幕面积(shoelace ×2)低于此值的面片丢弃(隐藏实例/侧棱退化片)。 */
const MIN_AREA2 = 0.04;
/** 大面片细分阈值(屏幕像素面积):质心 painter 对「大三角形叠小三角形」会排错
 * (frame 凹槽底面大三角质心可能比其上贴纸更近 → 黑对角半边盖贴纸),把大面片
 * 递归对半切到面积 ≤ 此值,质心比较退化为局部比较,排序恢复正确。 */
const SUBDIV_AREA_PX = 220;
const SUBDIV_MAX_DEPTH = 6;
/** 混合可见性细分的终止面积(shoelace ×2,≈3px²)与递归上限。 */
const VIS_SPLIT_MIN_AREA2 = 6;
const VIS_SPLIT_MAX_DEPTH = 8;

/** pts = 扁平 (x, y, viewZ) 三元组序列;viewZ 供深度图遮挡测试。
 *  seq = 采集顺序(≈ GL 提交顺序);plane = 世界平面签名:同一平面的面片共享
 *  代表深度并按 seq 倒序画 —— 模拟 GL「共面先画先赢」。近共面分层两处都靠它:
 *  cubing.js PG3D 贴纸与黑底严格共面(无深度图,排序全靠平面组);引擎近共面
 *  堆叠(平贴纸 0.1 / logo 0.9)落在遮挡带宽内整块保留,同样只有按平面组才
 *  排得对(倾斜面上碎片质心 z 摆动远大于 0.1 抬升)。 */
/** soft = 纯软遮蔽碎片(全部采样点被近层盖住,见 OCCL_BAND):不剔除,painter
 *  深度整体压后 occlBand 先画,由其上方图层的精确矢量轮廓覆盖。 */
interface PolyPrim { kind: 0; z: number; ro: number; seq: number; pts: number[]; fill: string; opacity: number; plane?: string; pz?: number; soft?: boolean; }
interface ImgPrim { kind: 1; z: number; ro: number; seq: number; markup: string; clipPts?: number[]; plane?: string; pz?: number; }
type Prim = PolyPrim | ImgPrim;

/** 深度相关常量,按相机距离缩放(场景尺度无关:引擎场景 cubelet=64、相机距
 *  ≈1248;twisty(cubing.js)整体半径 ≈1.5、相机距 ≈6),比例分母取引擎标定值。
 *
 *  采样点三档判定(修贴纸/黑框接缝锯齿的核心,两套阈值缺一不可):
 *  - 严格可见:落后 ≤ 逐像素容差 tol = TOL_BASE + 邻域深度梯度 × TOL_GRAD(cap
 *    TOL_CAP)。采样点最多偏半像素,插值误差正比局部坡度;平坦区收紧(齿轮贴纸
 *    抬升 0.5 下的塑料也判得出被盖),陡坡自动放宽,CAP 防轮廓边缘梯度→∞。
 *  - 软遮蔽:落后 ≤ OCCL_BAND 带宽 —— 被「同一表面堆叠」的近层盖住(黑框上的
 *    平贴纸 0.1 / 齿轮贴纸 0.5 / logo 0.9 / 立体贴片顶面 ≈3.1)。**不剔除**:纯软
 *    碎片深度压后先画,被上层的精确矢量轮廓盖住 —— 接缝因此是上层几何自身的
 *    轮廓(任意放大不锯齿),而不是逐像素剔除边界。严格/软混合碎片仍细分
 *    (切口藏在上层轮廓之下);曲面(齿轮/枕形)无平面簇可依,若把软碎片整块
 *    保留在原深度,质心 z 排序在 0.5 抬升尺度上是抛硬币 → 必须压后。
 *  - 硬遮挡:落后 > 带宽,真被挡(剔除;真遮挡轮廓的细分边界仍是像素级)。 */
const TOL_BASE_RATIO = 0.15 / 1248;
const TOL_CAP_RATIO = 2.4 / 1248;
/** ×3:凹谷(曲面枕形贴纸裙边)两侧斜率反号,采样点误差 ≈ 两侧斜率之和 ×
 *  对角亚像素偏移,单侧梯度 ×1.5 不够 → 贴纸面上沿三角边成片缺牙。 */
const TOL_GRAD_MULT = 3.0;
const OCCL_BAND_RATIO = 4.0 / 1248;
const Z_QUANT_RATIO = 0.05 / 1248;

/** GPU 深度图:MeshDepthMaterial(RGBADepthPacking)渲到 RenderTarget 读回,解包成
 *  per-pixel viewZ(负值,越大越近)。透明材质 / BackSide 材质 / Sprite 不写深度
 *  (透明贴片会在深度图上凿洞;近侧 BackSide 提示贴片在 GL 里根本不可见,但
 *  override 材质是 FrontSide 会把它错误画进深度图挡住整个魔方)。失败返回 null
 *  (导出降级为纯 painter,无剔除)。 */
function buildDepthMap(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  W: number,
  H: number,
  tolBase: number,
  tolCap: number,
): { depth: Float32Array; tol: Float32Array } | null {
  const hidden: THREE.Object3D[] = [];
  const prevOverride = scene.overrideMaterial;
  const prevTarget = renderer.getRenderTarget();
  const prevClearColor = new THREE.Color();
  renderer.getClearColor(prevClearColor);
  const prevClearAlpha = renderer.getClearAlpha();
  const target = new THREE.WebGLRenderTarget(W, H, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
  });
  // DoubleSide:齿轮等几何有绕向反的可见面(靠 DoubleSide 材质显形),override
  // 材质默认 FrontSide 会把它们漏出深度图 → 深度读到内部件,遮挡剔除失效。
  const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  try {
    scene.traverseVisible((o) => {
      if ((o as THREE.Sprite).isSprite) { hidden.push(o); return; }
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        if (mats.some((mm) => mm && ((mm as THREE.Material).transparent === true || (mm as THREE.Material).side === THREE.BackSide))) {
          hidden.push(o);
        }
      }
    });
    for (const o of hidden) o.visible = false;
    scene.overrideMaterial = depthMat;
    renderer.setRenderTarget(target);
    renderer.setClearColor(0xffffff, 1);
    renderer.clear();
    renderer.render(scene, camera);
    const buf = new Uint8Array(W * H * 4);
    renderer.readRenderTargetPixels(target, 0, 0, W, H, buf);
    const out = new Float32Array(W * H);
    const near = camera.near;
    const far = camera.far;
    for (let i = 0; i < W * H; i++) {
      const o = i * 4;
      // three r162+ packDepthToRGBA: R 最高有效字节(modf 链),A 最低
      const d = buf[o] / 256 + buf[o + 1] / 65536 + buf[o + 2] / 16777216 + buf[o + 3] / 4294967296;
      // perspectiveDepthToViewZ(负值;d=0 → −near, d=1 → −far)
      out[i] = (near * far) / ((far - near) * d - far);
    }
    // 逐像素严格容差 = 基底 + 4 邻域最大深度差 × GRAD(见 RATIO 注释)
    const tol = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const z = out[i];
        let g = 0;
        if (x > 0) g = Math.max(g, Math.abs(z - out[i - 1]));
        if (x < W - 1) g = Math.max(g, Math.abs(z - out[i + 1]));
        if (y > 0) g = Math.max(g, Math.abs(z - out[i - W]));
        if (y < H - 1) g = Math.max(g, Math.abs(z - out[i + W]));
        tol[i] = Math.min(tolCap, tolBase + g * TOL_GRAD_MULT);
      }
    }
    return { depth: out, tol };
  } catch {
    return null;
  } finally {
    scene.overrideMaterial = prevOverride;
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevClearColor, prevClearAlpha);
    for (const o of hidden) o.visible = true;
    target.dispose();
    depthMat.dispose();
  }
}

interface SceneLightAmb { mask: number; r: number; g: number; b: number; }
interface SceneLightDir extends SceneLightAmb { dir: THREE.Vector3; }

interface RawSlot { n: THREE.Vector3; r: number; g: number; b: number; }

/** 贴图 → dataURL / 像素缓存(单次导出内按 Texture 缓存)。 */
interface TexEntry { url: string; w: number; h: number; pixels: Uint8ClampedArray | null; }

function textureEntry(tex: THREE.Texture, cache: Map<THREE.Texture, TexEntry | null>): TexEntry | null {
  const hit = cache.get(tex);
  if (hit !== undefined) return hit;
  let entry: TexEntry | null = null;
  try {
    const img = tex.image as CanvasImageSource & { width?: number; height?: number } | undefined;
    const w = (img?.width as number) | 0;
    const h = (img?.height as number) | 0;
    if (img && w > 0 && h > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        entry = {
          url: canvas.toDataURL('image/png'),
          w, h,
          pixels: ctx.getImageData(0, 0, w, h).data,
        };
      }
    }
  } catch { /* 跨域/异常贴图 → 降级为无贴图 */ }
  cache.set(tex, entry);
  return entry;
}

/** Sutherland–Hodgman: 保留 n·p + d ≥ 0 的一侧。返回新数组(顶点为新建 Vector3)。 */
function clipPolyByPlane(pts: THREE.Vector3[], nx: number, ny: number, nz: number, d: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const da = a.x * nx + a.y * ny + a.z * nz + d;
    const db = b.x * nx + b.y * ny + b.z * nz + d;
    if (da >= 0) {
      out.push(a);
      if (db < 0) out.push(new THREE.Vector3().lerpVectors(a, b, da / (da - db)));
    } else if (db >= 0) {
      out.push(new THREE.Vector3().lerpVectors(a, b, da / (da - db)));
    }
  }
  return out;
}

/** 原核 argmax 分色:把三角形按「哪个 slot 的 dot(p,N) 最大」切成 ≤slots.length 片。 */
function splitByRawSlots(tri: THREE.Vector3[], slots: RawSlot[]): { pts: THREE.Vector3[]; slot: RawSlot }[] {
  if (slots.length === 1) return [{ pts: tri, slot: slots[0] }];
  const out: { pts: THREE.Vector3[]; slot: RawSlot }[] = [];
  for (let i = 0; i < slots.length; i++) {
    let poly = tri;
    for (let j = 0; j < slots.length && poly.length >= 3; j++) {
      if (j === i) continue;
      const ni = slots[i].n;
      const nj = slots[j].n;
      poly = clipPolyByPlane(poly, ni.x - nj.x, ni.y - nj.y, ni.z - nj.z, 0);
    }
    if (poly.length >= 3) out.push({ pts: poly, slot: slots[i] });
  }
  return out.length ? out : [{ pts: tri, slot: slots[0] }];
}

/** 镜面缝(uCoreBorder=1)CPU 复算参数:与 rawCore shader 的 SDF 同源(半宽 =
 *  STICKER_INNER/2,圆角 = STICKER_CORNER_RADIUS)。圆角用 45° 切角平面近似
 *  (弦切误差 ≈ 0.08r,亚像素)。 */
const RAW_SH = STICKER_INNER / 2;
const RAW_CHAMFER = 2 * RAW_SH - STICKER_CORNER_RADIUS * (2 - Math.SQRT2);

/** 把多边形按「贴片圆角矩形棱柱」(沿 slot 法向)分成内(贴片色)/ 外(内核色)。
 *  轴向法向 ⇒ 面内轴 = 其余两坐标轴;侧壁点的面内坐标必超半宽,自动落外侧,
 *  与 shader 对 vRawPos 去法向分量后做 SDF 的语义一致。 */
function splitByStickerBorder(poly: THREE.Vector3[], n: THREE.Vector3): { inside: THREE.Vector3[] | null; outside: THREE.Vector3[][] } {
  const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
  let eu: [number, number, number], ev: [number, number, number];
  if (ax >= ay && ax >= az) { eu = [0, 1, 0]; ev = [0, 0, 1]; }
  else if (ay >= az) { eu = [1, 0, 0]; ev = [0, 0, 1]; }
  else { eu = [1, 0, 0]; ev = [0, 1, 0]; }
  const planes: [number, number, number, number][] = [
    [-eu[0], -eu[1], -eu[2], RAW_SH], [eu[0], eu[1], eu[2], RAW_SH],
    [-ev[0], -ev[1], -ev[2], RAW_SH], [ev[0], ev[1], ev[2], RAW_SH],
  ];
  for (const su of [1, -1]) {
    for (const sv of [1, -1]) {
      planes.push([-(su * eu[0] + sv * ev[0]), -(su * eu[1] + sv * ev[1]), -(su * eu[2] + sv * ev[2]), RAW_CHAMFER]);
    }
  }
  const outside: THREE.Vector3[][] = [];
  let cur: THREE.Vector3[] | null = poly;
  for (const [px, py, pz, pd] of planes) {
    if (!cur || cur.length < 3) { cur = null; break; }
    const out = clipPolyByPlane(cur, -px, -py, -pz, -pd); // 该平面负侧 = 必在区域外
    if (out.length >= 3) outside.push(out);
    cur = clipPolyByPlane(cur, px, py, pz, pd);
  }
  return { inside: cur && cur.length >= 3 ? cur : null, outside };
}

const _c = new THREE.Color();
function hexOf(r: number, g: number, b: number, srgb: boolean): string {
  if (srgb) {
    // 输入已是 sRGB 域(cubing.js 场景):字节直出
    const to = (v: number): string => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
    return `#${to(r)}${to(g)}${to(b)}`;
  }
  _c.setRGB(Math.min(1, Math.max(0, r)), Math.min(1, Math.max(0, g)), Math.min(1, Math.max(0, b)));
  // 组件是线性域(材质色/instanceColor/光照均线性),getHexString 默认转 sRGB 输出。
  return `#${_c.getHexString()}`;
}

function fmt(v: number): number {
  return Math.round(v * 100) / 100;
}

/** 2×3 仿射解:src 三点 → dst 三点。返回 SVG matrix(a b c d e f);退化返回 null。 */
function solveAffine(
  sx0: number, sy0: number, sx1: number, sy1: number, sx2: number, sy2: number,
  dx0: number, dy0: number, dx1: number, dy1: number, dx2: number, dy2: number,
): [number, number, number, number, number, number] | null {
  const m00 = sx1 - sx0, m01 = sx2 - sx0;
  const m10 = sy1 - sy0, m11 = sy2 - sy0;
  const det = m00 * m11 - m01 * m10;
  if (Math.abs(det) < 1e-8) return null;
  const i00 = m11 / det, i01 = -m01 / det, i10 = -m10 / det, i11 = m00 / det;
  const u0 = dx1 - dx0, u1 = dx2 - dx0;
  const v0 = dy1 - dy0, v1 = dy2 - dy0;
  const a = u0 * i00 + u1 * i10;
  const c = u0 * i01 + u1 * i11;
  const b = v0 * i00 + v1 * i10;
  const d = v0 * i01 + v1 * i11;
  const e = dx0 - (a * sx0 + c * sy0);
  const f = dy0 - (b * sx0 + d * sy0);
  return [a, b, c, d, e, f];
}

interface MaterialLike {
  visible?: boolean;
  color?: THREE.Color;
  opacity?: number;
  transparent?: boolean;
  side?: THREE.Side;
  vertexColors?: boolean;
  map?: THREE.Texture | null;
  emissive?: THREE.Color;
  isMeshBasicMaterial?: boolean;
  isSpriteMaterial?: boolean;
}

export function exportSimSvg(opts: SimSvgExportOptions): string {
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
  // 场景尺度自适应的深度常量(见 RATIO 注释)
  const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
  const camDist = Math.max(1e-6, camPos.length());
  const zQuant = camDist * Z_QUANT_RATIO;
  // 镜面缝门控(setRawCore 每次刷新;非 raw 场景无 aRaw 属性,读到什么都无影响)
  const rawBorder = getRawCoreBorder();
  /** planeKey → 相机点面距离(平行平面精确排序用)。 */
  const planeDist = new Map<string, number>();

  // GPU 深度图(有 renderer 才有;失败/缺失 = 纯 painter 降级)
  const depthMap = opts.renderer
    ? buildDepthMap(opts.renderer, scene, camera, W, H, camDist * TOL_BASE_RATIO, camDist * TOL_CAP_RATIO)
    : null;
  // 调试:window.__SIM_SVG_DEBUG = true 时暴露深度图供 devtools 检视(dev only)
  if (typeof window !== 'undefined' && (window as unknown as { __SIM_SVG_DEBUG?: boolean }).__SIM_SVG_DEBUG) {
    (window as unknown as { __depthDbg?: unknown }).__depthDbg = { W, H, depthMap, near, far: camera.far };
  }

  /** 深度图单点测试(sprite / logo 用):可见 or 软遮蔽(落后 ≤ 带宽)。 */
  const occlBand = camDist * OCCL_BAND_RATIO;
  function depthPass(x: number, y: number, z: number): boolean {
    const px = Math.min(W - 1, Math.max(0, Math.floor(x)));
    const py = Math.min(H - 1, Math.max(0, Math.floor(y)));
    const i = (H - 1 - py) * W + px;
    return z >= depthMap!.depth[i] - occlBand;
  }

  /** 单点三档:2 = 严格可见(≤ 逐像素 tol),1 = 软遮蔽(≤ 带宽),0 = 硬遮挡。 */
  function depthClass(x: number, y: number, z: number): number {
    const px = Math.min(W - 1, Math.max(0, Math.floor(x)));
    const py = Math.min(H - 1, Math.max(0, Math.floor(y)));
    const i = (H - 1 - py) * W + px;
    const d = depthMap!.depth[i];
    if (z >= d - depthMap!.tol[i]) return 2;
    return z >= d - occlBand ? 1 : 0;
  }

  /** 采样分档计数:质心 + 各顶点向质心收 30%。返回 [严格数, 软数, 总数]。 */
  function sampleVisibility(pts: number[]): [number, number, number] {
    const n = pts.length / 3;
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < n; i++) { cx += pts[i * 3]; cy += pts[i * 3 + 1]; cz += pts[i * 3 + 2]; }
    cx /= n; cy /= n; cz /= n;
    let strict = 0, soft = 0;
    const c0 = depthClass(cx, cy, cz);
    if (c0 === 2) strict++; else if (c0 === 1) soft++;
    for (let i = 0; i < n; i++) {
      const c = depthClass(pts[i * 3] * 0.7 + cx * 0.3, pts[i * 3 + 1] * 0.7 + cy * 0.3, pts[i * 3 + 2] * 0.7 + cz * 0.3);
      if (c === 2) strict++; else if (c === 1) soft++;
    }
    return [strict, soft, n + 1];
  }

  /** 面片遮挡测试(整片版,logo 贴图三角用):任一采样非硬遮挡即保留。 */
  function pieceVisible(pts: number[]): boolean {
    if (!depthMap) return true;
    const [strict, soft] = sampleVisibility(pts);
    return strict + soft > 0;
  }

  /** 混合可见性面片的定向细分:全硬遮挡剔除,档位纯净直接收(纯软碎片标 soft
   *  = painter 压后先画,由上层精确轮廓覆盖),混档递归对半切(屏幕空间中点 +
   *  z 线性插值,此尺度误差可忽略)。严格/软切口藏在上层轮廓之下;硬遮挡边界
   *  (真轮廓)裁掉后 painter 排序不再有大面积重叠。 */
  function pushVisiblePieces(pts: number[], ro: number, fill: string, opacity: number, depth: number, plane?: string): void {
    const n = pts.length / 3;
    let z = 0;
    for (let i = 0; i < n; i++) z += pts[i * 3 + 2];
    z /= n;
    if (!depthMap) {
      if (++triCount > maxTris) throw new Error(`SVG_TOO_COMPLEX:${triCount}`);
      prims.push({ kind: 0, z, ro, seq: prims.length, pts, fill, opacity, plane });
      return;
    }
    const [strict, soft, total] = sampleVisibility(pts);
    if (strict + soft === 0) return;
    let area2 = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area2 += pts[i * 3] * pts[j * 3 + 1] - pts[j * 3] * pts[i * 3 + 1];
    }
    area2 = Math.abs(area2);
    if (area2 < MIN_AREA2) return;
    const pure = strict === total || soft === total;
    if (pure || depth >= VIS_SPLIT_MAX_DEPTH || area2 <= VIS_SPLIT_MIN_AREA2) {
      // 细分到底仍是混档的残片:多数采样硬遮挡 = 大概率是压在贴纸边上的
      // 塑料坡面碎屑,剔除保边缘干净(缝隙由同色描边兜底)。
      if ((total - strict - soft) * 2 > total) return;
      if (++triCount > maxTris) throw new Error(`SVG_TOO_COMPLEX:${triCount}`);
      // 无严格采样 = 整片被近层盖住 → soft(压后);有严格采样保原深度。
      prims.push({ kind: 0, z, ro, seq: prims.length, pts, fill, opacity, plane, soft: strict === 0 });
      return;
    }
    if (n > 3) {
      for (let i = 1; i < n - 1; i++) {
        pushVisiblePieces(
          [pts[0], pts[1], pts[2], pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2], pts[i * 3 + 3], pts[i * 3 + 4], pts[i * 3 + 5]],
          ro, fill, opacity, depth, plane,
        );
      }
      return;
    }
    const d01 = (pts[0] - pts[3]) ** 2 + (pts[1] - pts[4]) ** 2;
    const d12 = (pts[3] - pts[6]) ** 2 + (pts[4] - pts[7]) ** 2;
    const d20 = (pts[6] - pts[0]) ** 2 + (pts[7] - pts[1]) ** 2;
    let ia: number, ib: number, ic: number;
    if (d01 >= d12 && d01 >= d20) { ia = 0; ib = 1; ic = 2; }
    else if (d12 >= d20) { ia = 1; ib = 2; ic = 0; }
    else { ia = 2; ib = 0; ic = 1; }
    const ax = pts[ia * 3], ay = pts[ia * 3 + 1], az = pts[ia * 3 + 2];
    const bx = pts[ib * 3], by = pts[ib * 3 + 1], bz = pts[ib * 3 + 2];
    const cx = pts[ic * 3], cy = pts[ic * 3 + 1], cz = pts[ic * 3 + 2];
    const mx = (ax + bx) / 2, my = (ay + by) / 2, mz = (az + bz) / 2;
    pushVisiblePieces([ax, ay, az, mx, my, mz, cx, cy, cz], ro, fill, opacity, depth + 1, plane);
    pushVisiblePieces([mx, my, mz, bx, by, bz, cx, cy, cz], ro, fill, opacity, depth + 1, plane);
  }

  // ── 收集光源 + 可渲染对象(一次 traverseVisible) ──────────────────────────
  const ambients: SceneLightAmb[] = [];
  const dirLights: SceneLightDir[] = [];
  const meshes: THREE.Mesh[] = [];
  const sprites: THREE.Sprite[] = [];
  scene.traverseVisible((obj) => {
    const any = obj as unknown as { isAmbientLight?: boolean; isDirectionalLight?: boolean; isMesh?: boolean; isSprite?: boolean };
    if (any.isAmbientLight) {
      const l = obj as THREE.AmbientLight;
      ambients.push({ mask: obj.layers.mask, r: (l.color.r * l.intensity) / Math.PI, g: (l.color.g * l.intensity) / Math.PI, b: (l.color.b * l.intensity) / Math.PI });
    } else if (any.isDirectionalLight) {
      const l = obj as THREE.DirectionalLight;
      const dir = new THREE.Vector3().setFromMatrixPosition(l.matrixWorld)
        .sub(new THREE.Vector3().setFromMatrixPosition(l.target.matrixWorld))
        .normalize();
      dirLights.push({ mask: obj.layers.mask, dir, r: (l.color.r * l.intensity) / Math.PI, g: (l.color.g * l.intensity) / Math.PI, b: (l.color.b * l.intensity) / Math.PI });
    } else if (any.isMesh) {
      meshes.push(obj as THREE.Mesh);
    } else if (any.isSprite) {
      sprites.push(obj as THREE.Sprite);
    }
  });

  const prims: Prim[] = [];
  const texCache = new Map<THREE.Texture, TexEntry | null>();
  let triCount = 0;

  // 复用临时对象(单线程同步导出)
  const mv = new THREE.Matrix4();          // view × world × instance
  const instLocal = new THREE.Matrix4();
  const instWorld = new THREE.Matrix4();
  const normalMat = new THREE.Matrix3();
  const va = new THREE.Vector3(); const vb = new THREE.Vector3(); const vc = new THREE.Vector3();
  const e1 = new THREE.Vector3(); const e2 = new THREE.Vector3();
  const ln = new THREE.Vector3(); const tmpN = new THREE.Vector3();
  const pn = new THREE.Vector3();
  const v4 = new THREE.Vector4();

  interface ProjPiece { pts: number[]; z: number; }

  /** 视空间多边形 → 近裁剪 + 投影 + 背面剔除;大面片按屏幕面积递归对半细分
   *  (质心 painter 的排序精度随面片尺寸收敛)。不通过返回 null。 */
  function projectPoly(viewPts: THREE.Vector3[], side: THREE.Side, noSubdiv: boolean): { pieces: ProjPiece[]; front: boolean } | null {
    let poly = viewPts;
    // 近平面裁剪: 保 z ≤ −near
    for (const p of poly) {
      if (p.z > -near) { poly = clipPolyByPlane(poly, 0, 0, -1, -near); break; }
    }
    if (poly.length < 3) return null;
    const pts: number[] = [];
    let zSum = 0;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of poly) {
      v4.set(p.x, p.y, p.z, 1).applyMatrix4(projMat);
      const inv = 1 / v4.w;
      const x = (v4.x * inv * 0.5 + 0.5) * W;
      const y = (0.5 - v4.y * inv * 0.5) * H;
      pts.push(x, y, p.z);
      zSum += p.z;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    if (maxX < 0 || minX > W || maxY < 0 || minY > H) return null; // 全出画
    // shoelace ×2(屏幕 y 向下):NDC 逆时针(正面)→ 负值
    let area2 = 0;
    for (let i = 0, n = poly.length; i < n; i++) {
      const j = (i + 1) % n;
      area2 += pts[i * 3] * pts[j * 3 + 1] - pts[j * 3] * pts[i * 3 + 1];
    }
    if (Math.abs(area2) < MIN_AREA2) return null;
    const front = area2 < 0;
    if (side === THREE.FrontSide && !front) return null;
    if (side === THREE.BackSide && front) return null;
    if (noSubdiv || Math.abs(area2) <= SUBDIV_AREA_PX * 2) {
      return { pieces: [{ pts, z: zSum / poly.length }], front };
    }
    // 扇形拆三角 + 递归对半切(沿最长屏幕边取视空间中点重投影,透视正确)
    const pieces: ProjPiece[] = [];
    const emitTri = (
      a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3,
      ax: number, ay: number, bx: number, by: number, cx: number, cy: number,
      depth: number,
    ): void => {
      const lo = Math.min(ax, bx, cx), hi = Math.max(ax, bx, cx);
      const lo2 = Math.min(ay, by, cy), hi2 = Math.max(ay, by, cy);
      if (hi < 0 || lo > W || hi2 < 0 || lo2 > H) return;
      const a2 = Math.abs(ax * by - bx * ay + bx * cy - cx * by + cx * ay - ax * cy);
      if (a2 < MIN_AREA2) return;
      if (depth >= SUBDIV_MAX_DEPTH || a2 <= SUBDIV_AREA_PX * 2) {
        pieces.push({ pts: [ax, ay, a.z, bx, by, b.z, cx, cy, c.z], z: (a.z + b.z + c.z) / 3 });
        return;
      }
      const dab = (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
      const dbc = (bx - cx) * (bx - cx) + (by - cy) * (by - cy);
      const dca = (cx - ax) * (cx - ax) + (cy - ay) * (cy - ay);
      const m = new THREE.Vector3();
      if (dab >= dbc && dab >= dca) {
        m.addVectors(a, b).multiplyScalar(0.5);
        v4.set(m.x, m.y, m.z, 1).applyMatrix4(projMat);
        const inv = 1 / v4.w;
        const mx = (v4.x * inv * 0.5 + 0.5) * W;
        const my = (0.5 - v4.y * inv * 0.5) * H;
        emitTri(a, m, c, ax, ay, mx, my, cx, cy, depth + 1);
        emitTri(m, b, c, mx, my, bx, by, cx, cy, depth + 1);
      } else if (dbc >= dca) {
        m.addVectors(b, c).multiplyScalar(0.5);
        v4.set(m.x, m.y, m.z, 1).applyMatrix4(projMat);
        const inv = 1 / v4.w;
        const mx = (v4.x * inv * 0.5 + 0.5) * W;
        const my = (0.5 - v4.y * inv * 0.5) * H;
        emitTri(a, b, m, ax, ay, bx, by, mx, my, depth + 1);
        emitTri(a, m, c, ax, ay, mx, my, cx, cy, depth + 1);
      } else {
        m.addVectors(c, a).multiplyScalar(0.5);
        v4.set(m.x, m.y, m.z, 1).applyMatrix4(projMat);
        const inv = 1 / v4.w;
        const mx = (v4.x * inv * 0.5 + 0.5) * W;
        const my = (0.5 - v4.y * inv * 0.5) * H;
        emitTri(a, b, m, ax, ay, bx, by, mx, my, depth + 1);
        emitTri(m, b, c, mx, my, bx, by, cx, cy, depth + 1);
      }
    };
    for (let i = 1; i < poly.length - 1; i++) {
      emitTri(
        poly[0], poly[i], poly[i + 1],
        pts[0], pts[1], pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 3], pts[i * 3 + 4],
        0,
      );
    }
    return pieces.length ? { pieces, front } : null;
  }

  /** 光照系数(线性域)。unlit 传 null normal。 */
  function lightFactor(normal: THREE.Vector3 | null, mask: number): [number, number, number] {
    if (!normal) return [1, 1, 1];
    let r = 0, g = 0, b = 0;
    for (const a of ambients) {
      if (a.mask & mask) { r += a.r; g += a.g; b += a.b; }
    }
    for (const d of dirLights) {
      if (!(d.mask & mask)) continue;
      const nl = normal.dot(d.dir);
      if (nl > 0) { r += d.r * nl; g += d.g * nl; b += d.b * nl; }
    }
    return [r, g, b];
  }

  function addMesh(mesh: THREE.Mesh): void {
    const geom = mesh.geometry as THREE.BufferGeometry;
    const posAttr = geom.getAttribute('position');
    if (!posAttr) return;
    const normAttr = geom.getAttribute('normal') ?? null;
    const uvAttr = geom.getAttribute('uv') ?? null;
    const colAttr = geom.getAttribute('color') ?? null;
    const index = geom.getIndex();
    const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as MaterialLike[];
    const inst = (mesh as THREE.InstancedMesh).isInstancedMesh ? (mesh as THREE.InstancedMesh) : null;
    const instCount = inst ? inst.count : 1;
    const skinned = (mesh as THREE.SkinnedMesh).isSkinnedMesh ? (mesh as THREE.SkinnedMesh) : null;
    const ro = mesh.renderOrder || 0;
    const mask = mesh.layers.mask;

    const vertTotal = index ? index.count : posAttr.count;
    const triTotal = Math.floor(vertTotal / 3);
    if (triTotal === 0) return;

    // SkinnedMesh: 逐顶点烘焙当前姿态(local 蒙皮空间,后接 matrixWorld)。
    let baked: Float32Array | null = null;
    if (skinned) {
      skinned.skeleton.update();
      baked = new Float32Array(posAttr.count * 3);
      const v = new THREE.Vector3();
      for (let i = 0; i < posAttr.count; i++) {
        v.fromBufferAttribute(posAttr, i);
        skinned.applyBoneTransform(i, v);
        baked[i * 3] = v.x; baked[i * 3 + 1] = v.y; baked[i * 3 + 2] = v.z;
      }
    }

    // 材质分组(sticker 侧壁 [capMat, wallMat] 等);无 groups = 整段用 mats[0]。
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

    // 原核 per-instance 可见面属性(≤3 slots)
    const rawN = [geom.getAttribute('aRawN0'), geom.getAttribute('aRawN1'), geom.getAttribute('aRawN2')];
    const rawC = [geom.getAttribute('aRawC0'), geom.getAttribute('aRawC1'), geom.getAttribute('aRawC2')];
    const hasRaw = !!(inst && rawN[0] && rawC[0]);

    const localA = new THREE.Vector3(); const localB = new THREE.Vector3(); const localC = new THREE.Vector3();

    for (let i = 0; i < instCount; i++) {
      let instR = 1, instG = 1, instB = 1;
      if (inst) {
        instLocal.fromArray(inst.instanceMatrix.array as ArrayLike<number>, i * 16);
        const el = instLocal.elements;
        if (el[0] * el[0] + el[1] * el[1] + el[2] * el[2] < 1e-12) continue; // 零缩放 = 隐藏实例
        instWorld.multiplyMatrices(mesh.matrixWorld, instLocal);
        if (inst.instanceColor) {
          instR = inst.instanceColor.getX(i);
          instG = inst.instanceColor.getY(i);
          instB = inst.instanceColor.getZ(i);
        }
      } else {
        instWorld.copy(mesh.matrixWorld);
      }
      mv.multiplyMatrices(viewMat, instWorld);
      normalMat.getNormalMatrix(instWorld);

      let rawSlots: RawSlot[] | null = null;
      if (hasRaw) {
        rawSlots = [];
        for (let s = 0; s < 3; s++) {
          const na = rawN[s]; const ca = rawC[s];
          if (!na || !ca) continue;
          const nx = na.getX(i), ny = na.getY(i), nz = na.getZ(i);
          if (nx * nx + ny * ny + nz * nz > 0.25) {
            rawSlots.push({ n: new THREE.Vector3(nx, ny, nz), r: ca.getX(i), g: ca.getY(i), b: ca.getZ(i) });
          }
        }
      }

      for (const range of ranges) {
        const mat = range.mat;
        if (mat.visible === false) continue;
        const opacity = mat.transparent ? (mat.opacity ?? 1) : 1;
        if (opacity <= 0.01) continue;
        const side = mat.side ?? THREE.FrontSide;
        const unlit = mat.isMeshBasicMaterial === true;
        const matR = mat.color?.r ?? 1, matG = mat.color?.g ?? 1, matB = mat.color?.b ?? 1;
        const emR = mat.emissive?.r ?? 0, emG = mat.emissive?.g ?? 0, emB = mat.emissive?.b ?? 0;
        const tex = mat.map ? textureEntry(mat.map, texCache) : null;
        const affineTex = !!(tex && uvAttr && triTotal <= AFFINE_TEX_TRI_LIMIT);
        const sampleTex = !!(tex && tex.pixels && uvAttr && !affineTex);
        const flipY = mat.map ? mat.map.flipY : true;

        const triStart = range.start / 3;
        const triEnd = (range.start + range.count) / 3;
        for (let t = Math.floor(triStart); t < Math.floor(triEnd); t++) {
          const i0 = index ? index.getX(t * 3) : t * 3;
          const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
          const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;

          if (baked) {
            localA.set(baked[i0 * 3], baked[i0 * 3 + 1], baked[i0 * 3 + 2]);
            localB.set(baked[i1 * 3], baked[i1 * 3 + 1], baked[i1 * 3 + 2]);
            localC.set(baked[i2 * 3], baked[i2 * 3 + 1], baked[i2 * 3 + 2]);
          } else {
            localA.fromBufferAttribute(posAttr, i0);
            localB.fromBufferAttribute(posAttr, i1);
            localC.fromBufferAttribute(posAttr, i2);
          }

          // 世界平面签名(法向 + 平面距,符号归一 + 量化),同平面面片进同一
          // painter 组(见 PolyPrim.plane 注释)。蒙皮网格(手/全身)是有机曲面,
          // 无共面分层问题,跳过省逐三角开销。
          let planeKey: string | undefined;
          if (!skinned) {
            va.copy(localA).applyMatrix4(instWorld);
            vb.copy(localB).applyMatrix4(instWorld);
            vc.copy(localC).applyMatrix4(instWorld);
            e1.subVectors(vb, va);
            e2.subVectors(vc, va);
            pn.crossVectors(e1, e2);
            const len = pn.length();
            if (len > 1e-12) {
              pn.multiplyScalar(1 / len);
              let nx = pn.x, ny = pn.y, nz = pn.z;
              let pd = nx * va.x + ny * va.y + nz * va.z;
              if (nx < -1e-6 || (nx <= 1e-6 && (ny < -1e-6 || (ny <= 1e-6 && nz < 0)))) {
                nx = -nx; ny = -ny; nz = -nz; pd = -pd;
              }
              planeKey = `${Math.round(nx * 500)},${Math.round(ny * 500)},${Math.round(nz * 500)},${Math.round((pd / camDist) * 20000)}`;
              if (!planeDist.has(planeKey)) {
                // 相机到平面的点面距离 —— 平行平面族内的精确前后序
                planeDist.set(planeKey, Math.abs(nx * camPos.x + ny * camPos.y + nz * camPos.z - pd));
              }
            }
          }

          // 原核 argmax 分色须在 cubelet 本地空间做(shader 用的 vRawPos = position)
          let pieces: { pts: THREE.Vector3[]; slot: RawSlot | null }[];
          if (rawSlots && rawSlots.length > 0) {
            pieces = splitByRawSlots([localA.clone(), localB.clone(), localC.clone()], rawSlots);
            if (rawBorder) {
              // 镜面缝:slot 片再按贴片圆角矩形棱柱内外分割,外侧落材质色(内核色)
              const bordered: { pts: THREE.Vector3[]; slot: RawSlot | null }[] = [];
              for (const pc of pieces) {
                if (!pc.slot) { bordered.push(pc); continue; }
                const { inside, outside } = splitByStickerBorder(pc.pts, pc.slot.n);
                if (inside) bordered.push({ pts: inside, slot: pc.slot });
                for (const o of outside) bordered.push({ pts: o, slot: null });
              }
              pieces = bordered;
            }
          } else {
            pieces = [{ pts: [localA.clone(), localB.clone(), localC.clone()], slot: null }];
          }

          // 光照法向(实例世界域;flat per-triangle,顶点法向平均 ≈ 质心光照)
          let lit: [number, number, number] | null = null;
          const computeLit = (front: boolean): [number, number, number] => {
            if (unlit) return [1, 1, 1];
            if (lit && side !== THREE.DoubleSide) return lit;
            if (normAttr && !skinned) {
              ln.fromBufferAttribute(normAttr, i0);
              ln.add(tmpN.fromBufferAttribute(normAttr, i1));
              ln.add(tmpN.fromBufferAttribute(normAttr, i2));
              ln.applyMatrix3(normalMat).normalize();
            } else {
              va.copy(localA).applyMatrix4(instWorld);
              vb.copy(localB).applyMatrix4(instWorld);
              vc.copy(localC).applyMatrix4(instWorld);
              e1.subVectors(vb, va);
              e2.subVectors(vc, va);
              ln.crossVectors(e1, e2).normalize();
            }
            if (!front) ln.negate();
            lit = lightFactor(ln, mask);
            return lit;
          };

          for (const piece of pieces) {
            const viewPts = piece.pts.map((p) => p.clone().applyMatrix4(mv));
            const wantAffine = affineTex && !!tex && !!uvAttr && piece.pts.length === 3;
            const proj = projectPoly(viewPts, side, wantAffine);
            if (!proj) continue;

            // 仿射贴图路径(logo):贴图原样贴到屏幕三角形,不做光照(Basic 贴片)。
            if (wantAffine && tex && uvAttr && proj.pieces.length === 1 && proj.pieces[0].pts.length === 9) {
              const sp = proj.pieces[0];
              if (!pieceVisible(sp.pts)) continue;
              if (++triCount > maxTris) throw new Error(`SVG_TOO_COMPLEX:${triCount}`);
              const su0 = uvAttr.getX(i0) * tex.w, sv0 = (flipY ? 1 - uvAttr.getY(i0) : uvAttr.getY(i0)) * tex.h;
              const su1 = uvAttr.getX(i1) * tex.w, sv1 = (flipY ? 1 - uvAttr.getY(i1) : uvAttr.getY(i1)) * tex.h;
              const su2 = uvAttr.getX(i2) * tex.w, sv2 = (flipY ? 1 - uvAttr.getY(i2) : uvAttr.getY(i2)) * tex.h;
              const m = solveAffine(su0, sv0, su1, sv1, su2, sv2,
                sp.pts[0], sp.pts[1], sp.pts[3], sp.pts[4], sp.pts[6], sp.pts[7]);
              if (m) {
                const op = opacity < 1 ? ` opacity="${fmt(opacity)}"` : '';
                prims.push({
                  kind: 1, z: sp.z, ro, seq: prims.length,
                  clipPts: sp.pts, plane: planeKey,
                  markup: `<image href="${tex.url}" width="${tex.w}" height="${tex.h}" preserveAspectRatio="none" transform="matrix(${m.map(fmt).join(' ')})"${op}/>`,
                });
                continue;
              }
            }

            const [lr, lg, lb] = computeLit(proj.front);
            let r: number, g: number, b: number;
            let alpha = opacity;
            if (piece.slot) {
              // 原核: diffuse 被 slot 色整体替换(shader 语义)
              r = piece.slot.r; g = piece.slot.g; b = piece.slot.b;
            } else {
              r = matR * instR; g = matG * instG; b = matB * instB;
              if (colAttr && mat.vertexColors) {
                const cr = (colAttr.getX(i0) + colAttr.getX(i1) + colAttr.getX(i2)) / 3;
                const cg = (colAttr.getY(i0) + colAttr.getY(i1) + colAttr.getY(i2)) / 3;
                const cb = (colAttr.getZ(i0) + colAttr.getZ(i1) + colAttr.getZ(i2)) / 3;
                r *= cr; g *= cg; b *= cb;
              }
              if (sampleTex && tex && tex.pixels && uvAttr) {
                // 质心 UV 最近邻采样(sRGB 字节 → 线性)
                let u = (uvAttr.getX(i0) + uvAttr.getX(i1) + uvAttr.getX(i2)) / 3;
                let v = (uvAttr.getY(i0) + uvAttr.getY(i1) + uvAttr.getY(i2)) / 3;
                if (flipY) v = 1 - v;
                u = Math.min(1, Math.max(0, u)); v = Math.min(1, Math.max(0, v));
                const px = Math.min(tex.w - 1, Math.floor(u * tex.w));
                const py = Math.min(tex.h - 1, Math.floor(v * tex.h));
                const o = (py * tex.w + px) * 4;
                _c.setRGB(tex.pixels[o] / 255, tex.pixels[o + 1] / 255, tex.pixels[o + 2] / 255).convertSRGBToLinear();
                r *= _c.r; g *= _c.g; b *= _c.b;
                alpha *= tex.pixels[o + 3] / 255;
                if (alpha <= 0.01) continue;
              }
            }
            const fill = hexOf(r * lr + emR, g * lg + emG, b * lb + emB, srgbOut);
            for (const sp of proj.pieces) {
              pushVisiblePieces(sp.pts, ro, fill, alpha, 0, planeKey);
            }
          }
        }
      }
    }
  }

  function addSprite(sprite: THREE.Sprite): void {
    const mat = sprite.material as MaterialLike & { map?: THREE.Texture | null; rotation?: number };
    if (mat.visible === false || !mat.map) return;
    const opacity = mat.transparent ? (mat.opacity ?? 1) : 1;
    if (opacity <= 0.02) return;
    const tex = textureEntry(mat.map, texCache);
    if (!tex) return;
    const el = sprite.matrixWorld.elements;
    const sx = Math.hypot(el[0], el[1], el[2]);
    const sy = Math.hypot(el[4], el[5], el[6]);
    const center = new THREE.Vector3().setFromMatrixPosition(sprite.matrixWorld).applyMatrix4(viewMat);
    if (center.z > -near) return;
    // billboard 四角在视空间与相机平面对齐
    const corner = (dx: number, dy: number): [number, number] => {
      v4.set(center.x + dx, center.y + dy, center.z, 1).applyMatrix4(projMat);
      const inv = 1 / v4.w;
      return [(v4.x * inv * 0.5 + 0.5) * W, (0.5 - v4.y * inv * 0.5) * H];
    };
    const [x0, y1] = corner(-sx / 2, -sy / 2);
    const [x1, y0] = corner(sx / 2, sy / 2);
    if (x1 < 0 || x0 > W || y1 < 0 || y0 > H) return;
    if (++triCount > maxTris) throw new Error(`SVG_TOO_COMPLEX:${triCount}`);
    // GL 里 sprite 是透明 pass 收尾画、逐像素深度测试:字母浮在面前方 = 可见。
    // painter 里贴纸平面组共享的均值深度可能比 sprite 的局部 z 更近而错误盖字 ——
    // 深度图判 sprite 中心可见就强制排最后(pz=−near);被挡的保持 z,照旧被
    // 更近几何覆盖(背面字母只露出轮廓外的部分)。
    let pz: number | undefined;
    if (depthMap) {
      const [cx, cy] = corner(0, 0);
      if (depthPass(cx, cy, center.z)) pz = -near;
    }
    prims.push({
      kind: 1, z: center.z, pz, ro: sprite.renderOrder || 0, seq: prims.length,
      markup: `<image href="${tex.url}" x="${fmt(x0)}" y="${fmt(y0)}" width="${fmt(x1 - x0)}" height="${fmt(y1 - y0)}" preserveAspectRatio="none" opacity="${fmt(opacity)}"/>`,
    });
  }

  for (const m of meshes) addMesh(m);
  for (const s of sprites) addSprite(s);

  // 平面组代表深度(组内 painter 深度差只是斜面上的横向位移,不代表遮挡关系)。
  // 两种模式范围不同:
  //  - 无深度图(twisty):全场景同平面共享均值,平行平面族(法向量化后相同)
  //    再按相机点面距离重排代表深度 —— 掠射角下贴纸面与内缩黑底的均值深度被
  //    足迹差淹没,点面距离才是精确前后序。cubing.js 贴纸与黑底严格共面全靠它。
  //  - 有深度图(引擎):遮挡剔除已砍掉真被挡的面,幸存重叠只剩容差内的近共面
  //    平行层(平贴纸 0.1 / logo 抬升 0.9 等)。只对「同法向 + 点面距差 ≤
  //    clusterEps」的平面簇共享均值 + 按面距排名逐档偏置;其余保留逐碎片 z ——
  //    全局共享会把恰好同量化平面、空间不相连的曲面碎片(齿轮齿面等)强行
  //    共档,大片错排。
  const acc = new Map<string, { sum: number; n: number }>();
  for (const p of prims) {
    if (p.plane) {
      const a = acc.get(p.plane) ?? { sum: 0, n: 0 };
      a.sum += p.z;
      a.n++;
      acc.set(p.plane, a);
    }
  }
  const families = new Map<string, string[]>();
  for (const key of acc.keys()) {
    const fam = key.slice(0, key.lastIndexOf(','));
    const arr = families.get(fam);
    if (arr) arr.push(key); else families.set(fam, [key]);
  }
  const pzOf = new Map<string, number>();
  if (!depthMap) {
    for (const [key, a] of acc) pzOf.set(key, a.sum / a.n);
    // 族内重排:成员按点面距离降序,均值深度按升序(远→近)重新指派,
    // 保持全局深度多重集不变(排序仍传递)而族内顺序精确。
    for (const members of families.values()) {
      if (members.length < 2) continue;
      const byDist = [...members].sort((x, y) => (planeDist.get(y) ?? 0) - (planeDist.get(x) ?? 0));
      const pzAsc = members.map((k) => pzOf.get(k)!).sort((x, y) => x - y);
      byDist.forEach((k, i) => { pzOf.set(k, pzAsc[i]); });
    }
  } else {
    const clusterEps = camDist * (3.0 / 1248);
    for (const members of families.values()) {
      if (members.length < 2) continue;
      const byDist = [...members].sort((x, y) => (planeDist.get(y) ?? 0) - (planeDist.get(x) ?? 0)); // 远→近
      let start = 0;
      for (let i = 1; i <= byDist.length; i++) {
        const gap = i < byDist.length
          ? (planeDist.get(byDist[i - 1]) ?? 0) - (planeDist.get(byDist[i]) ?? 0)
          : Infinity;
        if (gap > clusterEps) {
          if (i - start >= 2) {
            let sum = 0, n = 0;
            for (let j = start; j < i; j++) { const a = acc.get(byDist[j])!; sum += a.sum; n += a.n; }
            const base = sum / n;
            // rank 0 = 最远;+rank×zQuant 恰好逐档进位,簇内远→近严格有序
            for (let j = start; j < i; j++) pzOf.set(byDist[j], base + (j - start) * zQuant);
          }
          start = i;
        }
      }
    }
  }
  for (const p of prims) {
    if (p.plane) {
      const v = pzOf.get(p.plane);
      if (v !== undefined) { p.pz = v; continue; }
    }
    // 纯软碎片且无平面簇可依(曲面):painter 深度压后一个带宽,保证先画、
    // 被盖住 —— 否则与其上近层的质心 z 排序在亚带宽尺度上是抛硬币。
    if (p.kind === 0 && p.soft) p.pz = p.z - occlBand;
  }

  // painter: 远(z 更负)→ 近;深度并档内 renderOrder 小的先画(logo 压贴纸),
  // 再按采集序倒序 —— GL 里共面「先画先赢」,painter 里后画才赢,故倒序。
  prims.sort((a, b) => {
    const za = Math.round((a.pz ?? a.z) / zQuant);
    const zb = Math.round((b.pz ?? b.z) / zQuant);
    if (za !== zb) return za - zb;
    if (a.ro !== b.ro) return a.ro - b.ro;
    return b.seq - a.seq;
  });
  if (typeof window !== 'undefined' && (window as unknown as { __SIM_SVG_DEBUG?: boolean }).__SIM_SVG_DEBUG) {
    (window as unknown as { __svgPrims?: unknown }).__svgPrims = prims.map((p, order) => {
      let bb: number[] | undefined;
      if (p.kind === 0) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let i = 0; i < p.pts.length; i += 3) {
          if (p.pts[i] < x0) x0 = p.pts[i]; if (p.pts[i] > x1) x1 = p.pts[i];
          if (p.pts[i + 1] < y0) y0 = p.pts[i + 1]; if (p.pts[i + 1] > y1) y1 = p.pts[i + 1];
        }
        bb = [x0, y0, x1, y1];
      }
      return { order, kind: p.kind, z: p.z, pz: p.pz, plane: p.plane, seq: p.seq, fill: p.kind === 0 ? p.fill : 'img', bb, pts: p.kind === 0 ? p.pts : undefined };
    });
  }

  // ── 输出:相邻同色 poly 合并为一条 <path>(同色描边盖 AA 缝) ─────────────
  const body: string[] = [];
  const defs: string[] = [];
  let curFill = '';
  let curOp = -1;
  let curD: string[] = [];
  let clipId = 0;

  const flush = (): void => {
    if (curD.length === 0) return;
    const opAttr = curOp < 1 ? ` fill-opacity="${fmt(curOp)}"` : ` stroke="${curFill}" stroke-width="1.2" stroke-linejoin="round"`;
    body.push(`<path d="${curD.join('')}" fill="${curFill}"${opAttr}/>`);
    curD = [];
  };

  for (const p of prims) {
    if (p.kind === 0) {
      // 纤条状碎片(面积 < 周长 ⇔ 平均宽 < 0.5px,如近侧视的贴纸侧壁)单独输出,
      // 描边宽自适应 ≈ 自身平均宽:封住相邻纤条间的 AA 发丝缝(1:1 不可见,高倍
      // 放大成品红虚线),又不像统一 1.2px 那样把镜面沟槽暗线整条吹胖。
      let area2 = 0, perim = 0;
      const n = p.pts.length / 3;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area2 += p.pts[i * 3] * p.pts[j * 3 + 1] - p.pts[j * 3] * p.pts[i * 3 + 1];
        perim += Math.hypot(p.pts[j * 3] - p.pts[i * 3], p.pts[j * 3 + 1] - p.pts[i * 3 + 1]);
      }
      let d = `M${fmt(p.pts[0])} ${fmt(p.pts[1])}`;
      for (let i = 3; i < p.pts.length; i += 3) d += `L${fmt(p.pts[i])} ${fmt(p.pts[i + 1])}`;
      d += 'Z';
      if (Math.abs(area2) < perim) {
        flush();
        const op = p.opacity < 1 ? ` fill-opacity="${fmt(p.opacity)}"` : '';
        const sw = Math.min(0.8, Math.max(0.25, 0.5 * Math.abs(area2) / Math.max(1e-6, perim)));
        const st = p.opacity < 1 ? '' : ` stroke="${p.fill}" stroke-width="${fmt(sw)}" stroke-linejoin="round"`;
        body.push(`<path d="${d}" fill="${p.fill}"${op}${st}/>`);
        continue;
      }
      if (p.fill !== curFill || p.opacity !== curOp) {
        flush();
        curFill = p.fill;
        curOp = p.opacity;
      }
      curD.push(d);
    } else {
      flush();
      if (p.clipPts) {
        const id = `sc${clipId++}`;
        let d = `M${fmt(p.clipPts[0])} ${fmt(p.clipPts[1])}`;
        for (let i = 3; i < p.clipPts.length; i += 3) d += `L${fmt(p.clipPts[i])} ${fmt(p.clipPts[i + 1])}`;
        defs.push(`<clipPath id="${id}"><path d="${d}Z"/></clipPath>`);
        body.push(`<g clip-path="url(#${id})">${p.markup}</g>`);
      } else {
        body.push(p.markup);
      }
    }
  }
  flush();

  const bg = opts.background ? `<rect width="100%" height="100%" fill="${opts.background}"/>` : '';
  const defsStr = defs.length ? `<defs>${defs.join('')}</defs>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${bg}${defsStr}${body.join('')}</svg>`;
}
