// 按阶段展示色块(twizzle edit 的 Stickering 下拉,issue #27)。
// 阶段定义逐条翻译自 cubing.js src/cubing/puzzles/stickerings/cube-like-stickerings.ts
// 的集合代数,坐标系换成引擎的 initial 索引(initial = x + y·N + z·N²;y=N-1 为 U,
// z=N-1 为 F,x=N-1 为 R)。语义与 cubing.js 相同:mask 定义在 SOLVED 帧的
// (initial, face) 上,渲染层按 slot 改色 → 颜色随块走,打乱后依然标注同一批块。
import { FACE } from "../define";

/** facelet 级遮罩码(渲染层消费):0 原色 / 1 变暗 / 2 忽略灰 / 3 EO 青 / 4 第二定向黄 /
 *  5 原色 + 描边。0-4 逐条对着 cubing.js 的 PieceStickering;5 是站内加的 —— 不换色,
 *  沿贴纸边缘描一圈高亮色(engine/nxn/stickerOutline.ts),给「就是要盯这一枚」的场合。 */
export type FaceletMask = 0 | 1 | 2 | 3 | 4 | 5;
export const FM_REGULAR = 0 as const;
export const FM_DIM = 1 as const;
export const FM_IGNORED = 2 as const;
export const FM_ORIENTED = 3 as const;
export const FM_ORIENTED2 = 4 as const;
export const FM_OUTLINE = 5 as const;

export type StickeringMaskFn = (initial: number, face: number) => FaceletMask;

/** piece 级语义(cubing.js PieceStickering),展开成 [主贴纸, 次贴纸] 两个 facelet 码。
 *  主贴纸 = kpuzzle facelets[0]:有 U/D 贴纸取 U/D,否则取 F/B(E 层棱),再否则 L/R。 */
type PieceStickering =
  | "Regular" | "Dim" | "Ignored"
  | "IgnoreNonPrimary"   // OLL:主贴纸原色,其余忽略
  | "PermuteNonPrimary"  // PLL:主贴纸变暗,其余原色
  | "Ignoriented"        // 主贴纸变暗,其余忽略
  | "OWP"                // OrientationWithoutPermutation:主贴纸 EO 青,其余忽略
  | "OWP2";              // 第二种定向标注(L6EO / G1),主贴纸黄,其余忽略

const EXPAND: Record<PieceStickering, readonly [FaceletMask, FaceletMask]> = {
  Regular: [FM_REGULAR, FM_REGULAR],
  Dim: [FM_DIM, FM_DIM],
  Ignored: [FM_IGNORED, FM_IGNORED],
  IgnoreNonPrimary: [FM_REGULAR, FM_IGNORED],
  PermuteNonPrimary: [FM_DIM, FM_REGULAR],
  Ignoriented: [FM_DIM, FM_IGNORED],
  OWP: [FM_ORIENTED, FM_IGNORED],
  OWP2: [FM_ORIENTED2, FM_IGNORED],
};

interface Piece { x: number; y: number; z: number }
type Pred = (p: Piece) => boolean;
/** 有序规则表,后写的覆盖先写的(同 cubing.js 里连续 puzzleStickering.set 的语义)。 */
type Rule = readonly [Pred, PieceStickering];

/** 阶段名 → 规则表。未知阶段返回 null(调用方回退 full)。 */
function rulesFor(order: number, name: string): Rule[] | null {
  const max = order - 1;
  // 单层集合(= cubing.js m.move("U") 等:外层转动影响的块,含中心)
  const U: Pred = (p) => p.y === max;
  const D: Pred = (p) => p.y === 0;
  const R: Pred = (p) => p.x === max;
  const L: Pred = (p) => p.x === 0;
  const F: Pred = (p) => p.z === max;
  const B: Pred = (p) => p.z === 0;
  // 中层(3 阶时即 M/E/S slice;高阶推广为全部内层,与 m.not(orLR()) 一致)
  const M: Pred = (p) => p.x !== 0 && p.x !== max;
  const E: Pred = (p) => p.y !== 0 && p.y !== max;
  const S: Pred = (p) => p.z !== 0 && p.z !== max;
  // 块类型按贴纸数(=坐标处于边界的个数):1 中心 / 2 棱 / 3 角
  const boundaries = (p: Piece): number =>
    ((p.x === 0 || p.x === max) ? 1 : 0)
    + ((p.y === 0 || p.y === max) ? 1 : 0)
    + ((p.z === 0 || p.z === max) ? 1 : 0);
  const CENTERS: Pred = (p) => boundaries(p) === 1;
  const EDGES: Pred = (p) => boundaries(p) === 2;
  const CORNERS: Pred = (p) => boundaries(p) === 3;

  const all: Pred = () => true;
  const and = (...ps: Pred[]): Pred => (p) => ps.every((f) => f(p));
  const or = (...ps: Pred[]): Pred => (p) => ps.some((f) => f(p));
  const not = (f: Pred): Pred => (p) => !f(p);

  const LL = U;                       // 顶层
  const F2L = not(LL);
  const centerLL = and(LL, CENTERS);
  const L6E = or(M, and(LL, EDGES));  // Roux 最后六棱
  const edgeFR = and(F, R, EDGES);
  const cornerDFR = and(F, R, CORNERS, not(LL));
  const slotFR = or(cornerDFR, edgeFR);
  const orUD = or(U, D);

  // 复合小节(cubing.js 的 dimF2L / setOLL / setPLL / dimOLL helper)
  const dimF2L: Rule = [F2L, "Dim"];
  const setOLL: Rule[] = [[LL, "IgnoreNonPrimary"], [centerLL, "Regular"]];
  const setPLL: Rule[] = [[LL, "PermuteNonPrimary"], [centerLL, "Dim"]];
  const dimOLL: Rule[] = [[LL, "Ignoriented"], [centerLL, "Dim"]];

  switch (name) {
    case "full": return [];
    // —— Last Layer ——
    case "OLL": return [dimF2L, ...setOLL];
    case "PLL": return [dimF2L, ...setPLL];
    case "LL": return [dimF2L];
    case "EOLL": return [dimF2L, ...setOLL, [and(LL, CORNERS), "Ignored"]];
    case "COLL": return [dimF2L, [and(LL, EDGES), "Ignoriented"], [and(LL, CENTERS), "Dim"], [and(LL, CORNERS), "Regular"]];
    case "OCLL": return [dimF2L, ...dimOLL, [and(LL, CORNERS), "IgnoreNonPrimary"]];
    case "CPLL": return [dimF2L, [and(CORNERS, LL), "PermuteNonPrimary"], [and(not(CORNERS), LL), "Dim"]];
    case "CLL": return [dimF2L, [not(and(CORNERS, LL)), "Dim"]];
    case "EPLL": return [dimF2L, [LL, "Dim"], [and(LL, EDGES), "PermuteNonPrimary"]];
    case "ELL": return [dimF2L, [LL, "Dim"], [and(LL, EDGES), "Regular"]];
    case "ZBLL": return [dimF2L, [LL, "PermuteNonPrimary"], [centerLL, "Dim"], [and(LL, CORNERS), "Regular"]];
    // —— Last Slot ——
    case "LS": return [dimF2L, [slotFR, "Regular"], [LL, "Ignored"], [centerLL, "Dim"]];
    case "LSOLL": return [dimF2L, ...setOLL, [slotFR, "Regular"]];
    case "LSOCLL": return [dimF2L, ...dimOLL, [and(LL, CORNERS), "IgnoreNonPrimary"], [slotFR, "Regular"]];
    case "ELS": return [dimF2L, ...setOLL, [and(LL, CORNERS), "Ignored"], [edgeFR, "Regular"], [cornerDFR, "Ignored"]];
    case "CLS": return [dimF2L, [cornerDFR, "Regular"], [LL, "Ignoriented"], [and(LL, CENTERS), "Dim"], [and(LL, CORNERS), "IgnoreNonPrimary"]];
    case "ZBLS": return [dimF2L, [slotFR, "Regular"], ...setOLL, [and(LL, CORNERS), "Ignored"]];
    case "VLS": return [dimF2L, [slotFR, "Regular"], ...setOLL];
    case "WVLS": return [dimF2L, [slotFR, "Regular"], [and(LL, EDGES), "Ignoriented"], [and(LL, CENTERS), "Dim"], [and(LL, CORNERS), "IgnoreNonPrimary"]];
    // —— CFOP ——
    case "F2L": return [[LL, "Ignored"]];
    case "Daisy": return [[all, "Ignored"], [CENTERS, "Dim"], [and(D, CENTERS), "Regular"], [and(U, EDGES), "IgnoreNonPrimary"]];
    case "Cross": return [[all, "Ignored"], [CENTERS, "Dim"], [and(D, CENTERS), "Regular"], [and(D, EDGES), "Regular"]];
    // —— ZZ ——
    case "EO": return [[CORNERS, "Ignored"], [EDGES, "OWP"]];
    case "EOline": return [[CORNERS, "Ignored"], [EDGES, "OWP"], [and(D, M), "Regular"]];
    case "EOcross": return [[EDGES, "OWP"], [D, "Regular"], [CORNERS, "Ignored"]];
    // —— Roux ——
    case "FirstBlock": return [[not(and(L, not(LL))), "Ignored"], [and(R, CENTERS), "Dim"]];
    case "SecondBlock": return [[not(and(L, not(LL))), "Ignored"], [and(L, not(LL)), "Dim"], [and(R, not(LL)), "Regular"]];
    case "CMLL": return [[F2L, "Dim"], [L6E, "Ignored"], [and(LL, CORNERS), "Regular"]];
    case "L10P": return [[not(L6E), "Dim"], [and(CORNERS, LL), "Regular"]];
    case "L6E": return [[not(L6E), "Dim"]];
    case "L6EO": return [[not(L6E), "Dim"], [L6E, "OWP2"], [and(CENTERS, orUD), "OWP2"], [and(M, E), "Ignored"]];
    // —— Petrus ——
    // cubing.js 原式灰掉 or(U,F,R),亮出的块落在 DBL;站内整套阶段都锚在 D 层 FR 侧
    // (Cross / XCross / F2L 首槽 / SQ_DFR),故改灰 or(U,L,B) → 块在 DFR,与 visualcube
    // '2x2x2' 位串同形(两边同形,谁被去重掉都一样)。换角落靠拿方朝向 24 档转过去。
    case "2x2x2": return [[or(U, L, B), "Ignored"], [and(or(U, L, B), CENTERS), "Dim"]];
    // 223 = 那个 222 沿 x 往左延一格(D 层前两排整条),与 visualcube '2x2x3' 位串同形;
    // Regular 标的是相对 222 新增的那 2x2(在 L 面上)。
    case "2x2x3": return [[all, "Dim"], [or(U, B), "Ignored"], [and(or(U, B), CENTERS), "Dim"], [and(L, not(or(U, B))), "Regular"]];
    // —— Nautilus ——
    case "EODF": return [
      [F2L, "Dim"],
      [or(cornerDFR, and(LL, CORNERS)), "Ignored"],
      [or(and(LL, EDGES), edgeFR), "OWP"],
      [and(D, F, EDGES), "Regular"],
      [and(F, CENTERS), "Regular"],
    ];
    // —— FMC ——
    case "G1": return [[all, "OWP2"], [E, "OWP"], [and(E, S), "Ignored"]];
    // —— 2x2 ——
    case "OBL": return [[orUD, "IgnoreNonPrimary"]];
    case "PBL": return [[all, "Ignored"], [orUD, "PermuteNonPrimary"]];
    // —— 降阶(4 阶+)——
    case "L2C": return [[or(L, R, B, D), "Dim"], [not(CENTERS), "Ignored"]];
    case "opposite-centers": return [[not(and(CENTERS, orUD)), "Ignored"]];
    // —— 其它 ——
    case "centers-only": return [[not(CENTERS), "Ignored"]];
    default: return null;
  }
}

/** 主贴纸所在面:U/D 优先,其次 F/B(E 层棱),最后 L/R(与 kpuzzle Reid 序的
 *  facelets[0] 一致:UF→U、FR→F、UFR→U、DRF→D、中心即唯一贴纸)。 */
function primaryFace(p: Piece, max: number): number {
  if (p.y === max) return FACE.U;
  if (p.y === 0) return FACE.D;
  if (p.z === max) return FACE.F;
  if (p.z === 0) return FACE.B;
  if (p.x === max) return FACE.R;
  return FACE.L;
}

// —— 拿方朝向:整体旋转共轭 ——
// 规则表固定写在标准坐标系(十字=D、LL=U、F2L 首槽=FR);要换个朝向看,就把物理
// (坐标, 面) 先转回该坐标系再查规则。朝向 = 一个整体转前缀(lib/cube-orientation 的
// 24 档,csTimer `preScr` 同款):前缀 P 表示「魔方被转成什么样」,故遮罩坐标 = P⁻¹(物理)。
// 一档朝向同时管两件事:哪个面当底(六色)+ 绕底面转到第几格(四档)。所以 XCross
// 这类「同一形状换个槽」的遮罩只需留一个,其余靠转体到位,不必逐槽列成四条。

/** 物理坐标 → 遮罩坐标 的整体旋转(det=+1)+ 面置换(下标物理面 → 遮罩面)。
 *  FACE 编码 L0 R1 D2 U3 B4 F5。 */
export type StageXform = {
  map: (x: number, y: number, z: number, max: number) => readonly [number, number, number];
  facePerm: readonly FACE[];
};

// 3×3 整数旋转矩阵(row-major),坐标轴 x→R y→U z→F,与整体转记号同向:
// x: F→U(+z→+y);y: R→F(+x→+z);z: U→R(+y→+x)。
type Mat3 = readonly number[];
const MAT: Record<'x' | 'y' | 'z', Mat3> = {
  x: [1, 0, 0, 0, 0, 1, 0, -1, 0],
  y: [0, 0, -1, 0, 1, 0, 1, 0, 0],
  z: [0, 1, 0, -1, 0, 0, 0, 0, 1],
};
const ID3: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const mul = (a: Mat3, b: Mat3): Mat3 => {
  const out: number[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    out.push(a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]);
  }
  return out;
};
/** 面法向(x,y,z),下标 = FACE。 */
const FACE_NORMAL: readonly (readonly [number, number, number])[] = [
  [-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1],
];
const faceOfNormal = (n: readonly number[]): FACE => {
  for (let f = 0; f < 6; f++) {
    const g = FACE_NORMAL[f];
    if (g[0] === n[0] && g[1] === n[1] && g[2] === n[2]) return f as FACE;
  }
  return FACE.U; // 不可达(矩阵是有符号置换阵)
};

const IDENTITY_XFORM: StageXform = { map: (x, y, z) => [x, y, z], facePerm: [0, 1, 2, 3, 4, 5] };
const XFORM_CACHE = new Map<string, StageXform>([['', IDENTITY_XFORM]]);

/**
 * 拿方朝向前缀(''、'y'、"z2 y'" …)→ 物理坐标/面 到遮罩坐标系的整体旋转(共轭)。
 * 前缀 P 把标准朝向转成手上这个朝向,故这里用它的逆。非法 token 静默跳过。
 * visualcube 阶段遮罩(vcStageMask.ts)复用同一旋转。
 */
export function orientationXform(prefix?: string): StageXform {
  const key = (prefix ?? '').trim();
  const hit = XFORM_CACHE.get(key);
  if (hit) return hit;
  let p: Mat3 = ID3;
  for (const token of key.split(/\s+/).filter(Boolean)) {
    const m = /^([xyz])(2|')?$/.exec(token);
    if (!m) continue;
    const base = MAT[m[1] as 'x' | 'y' | 'z'];
    const times = m[2] === '2' ? 2 : m[2] === "'" ? 3 : 1;
    for (let i = 0; i < times; i++) p = mul(base, p); // 后转的叠在外层
  }
  const r = [p[0], p[3], p[6], p[1], p[4], p[7], p[2], p[5], p[8]]; // 转置 = 逆(正交阵)
  const xform: StageXform = {
    map: (x, y, z, max) => {
      const h = max / 2, cx = x - h, cy = y - h, cz = z - h;
      return [
        r[0] * cx + r[1] * cy + r[2] * cz + h,
        r[3] * cx + r[4] * cy + r[5] * cz + h,
        r[6] * cx + r[7] * cy + r[8] * cz + h,
      ] as const;
    },
    facePerm: FACE_NORMAL.map((n) => faceOfNormal([
      r[0] * n[0] + r[1] * n[1] + r[2] * n[2],
      r[3] * n[0] + r[4] * n[1] + r[5] * n[2],
      r[6] * n[0] + r[7] * n[1] + r[8] * n[2],
    ])),
  };
  XFORM_CACHE.set(key, xform);
  return xform;
}

/** 阶段名 → (initial, face) 遮罩函数;full / 未知阶段返回 null(= 全原色)。
 *  orientation:拿方朝向前缀,''(UF)= 恒等。 */
export function stickeringMaskFn(order: number, name: string, orientation?: string): StickeringMaskFn | null {
  if (order < 2 || !name || name === "full") return null;
  const rules = rulesFor(order, name);
  if (!rules || rules.length === 0) return null;
  const max = order - 1;
  const N2 = order * order;
  const xf = orientationXform(orientation);
  return (initial, face) => {
    const [x, y, z] = xf.map(initial % order, ((initial / order) | 0) % order, (initial / N2) | 0, max);
    const p: Piece = { x, y, z };
    let ps: PieceStickering = "Regular";
    for (let i = rules.length - 1; i >= 0; i--) {
      if (rules[i][0](p)) { ps = rules[i][1]; break; }
    }
    return EXPAND[ps][primaryFace(p, max) === (xf.facePerm[face] ?? face) ? 0 : 1];
  };
}

export interface StickeringGroup { group: string; items: string[] }

const LL_GROUP = ["OLL", "PLL", "LL", "EOLL", "COLL", "OCLL", "CPLL", "CLL", "EPLL", "ELL", "ZBLL"];
const LS_GROUP = ["LS", "LSOLL", "LSOCLL", "ELS", "CLS", "ZBLS", "VLS", "WVLS"];

/** 每个阶数的下拉清单(分组与 twizzle 相同;group 名是英文 key,UI 层再本地化)。
 *  空数组 = 该拼图不支持(隐藏下拉)。 */
export function stickeringGroupsFor(order: number): StickeringGroup[] {
  if (order === 2) {
    return [
      { group: "Stickering", items: ["full", "custom"] },
      { group: "General", items: ["OBL"] },
      { group: "Ortega", items: ["PBL"] },
      { group: "Last Layer", items: ["OLL", "PLL", "CLL"] },
    ];
  }
  if (order === 3) {
    return [
      { group: "Stickering", items: ["full", "custom"] },
      { group: "Last Layer", items: LL_GROUP },
      { group: "Last Slot", items: LS_GROUP },
      { group: "CFOP", items: ["F2L", "Daisy", "Cross"] },
      { group: "ZZ", items: ["EO", "EOline", "EOcross"] },
      { group: "Roux", items: ["FirstBlock", "SecondBlock", "CMLL", "L10P", "L6E", "L6EO"] },
      { group: "Petrus", items: ["2x2x2", "2x2x3"] },
      { group: "Nautilus", items: ["EODF"] },
      { group: "FMC", items: ["G1"] },
      { group: "Miscellaneous", items: ["centers-only"] },
    ];
  }
  if (order >= 4) {
    // twizzle 对 4 阶+ 只给 full;这里保留能按层直接推广的常用阶段(与 visualcube
    // 的高阶 stage mask 同精神),外加 cubing.js 的降阶两项。
    return [
      { group: "Stickering", items: ["full", "custom"] },
      { group: "Reduction", items: ["L2C", "opposite-centers"] },
      { group: "CFOP", items: ["Cross", "F2L"] },
      { group: "Last Layer", items: ["OLL", "PLL", "LL"] },
      { group: "Miscellaneous", items: ["centers-only"] },
    ];
  }
  return [];
}
