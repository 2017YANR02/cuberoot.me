// 引擎驱动的 NxN 俯视图(plan)导出器 —— 退役对照表 §2b「视图 plan」。**忠实复刻 visualcube
// 原版几何**:整方块绕 X 轴 −90° 后做透视投影(dist=5),U 面平铺于中央、R/F/L/B 顶排侧带
// 经 renderOLLStickers 沿面法向外推 0.2 → 近大远小的**斜切梯形**,四角由梯形斜边自然闭合。
// (先前版本把侧带画成平矩形、四角留空,违反「忠于原版」硬前提,已废。)
//
// 只移植 visualcube 那几十行无歧义的**投影数学**(makeStickerPosition + 中心化/缩放/X−90/透视
// project + OLL 外推),颜色仍走已核验的 netIndexOf(vcStageMask):任一 facelet (face,x,y,z) 的色
// = serialize()[block(face)·N² + netIndexOf(x,y,z)]。**不经** visualcube 内部的几何↔颜色转置
// (renderFaceStickers/renderOLLStickers 的 (row,col) 索引互为转置,手推 stickerColors 极易错位):
// 每个「颜色格」在同一循环里直接配「它自己的投影几何」,物理对齐 flat 版(已 Playwright 核验)。
//
// 投影常量与 visualcube 对齐:dist=5、viewbox=-0.9 -0.9 1.8 1.8、贴纸内缩 0.85(U)/0.94(OLL)、
// OLL 外推 0.2、OLL 描边 0.02。sizeEngineSvg 再把 width/height 钉成方形(保 viewBox + meet)。
import { FACE } from './engine/define';
import { netIndexOf } from './engine/nxn/vcStageMask';
import type { NetFaceLetter } from './sim_net_export';

const DIST = 5;            // visualcube 默认透视距离
const U_INSET = 0.85;      // U 贴纸向心内缩(renderFaceStickers)
const OLL_INSET = 0.94;    // OLL 侧带向心内缩(renderOLLStickers)
const OLL_PUSH = 0.2;      // OLL 外缘沿投影面法向外推
const OUTLINE_SCALE = 0.94;// U 面黑色衬底缩放(renderCubeOutline outlineWidth)
const OLL_STROKE = 0.02;   // OLL 描边宽

// 引擎 FACE → serialize() 的 URFDLB 块序(U0 R1 F2 D3 L4 B5)。
const FACE_TO_BLOCK: Record<number, number> = {
  [FACE.U]: 0, [FACE.R]: 1, [FACE.F]: 2, [FACE.D]: 3, [FACE.L]: 4, [FACE.B]: 5,
};

// OLL 外推方向 = 各面法向经 X−90 视口旋转后的屏幕向量 ×0.2(见文件头)。
const OLL_PUSH_VEC: Record<number, [number, number]> = {
  [FACE.R]: [OLL_PUSH, 0], [FACE.F]: [0, OLL_PUSH],
  [FACE.L]: [-OLL_PUSH, 0], [FACE.B]: [0, -OLL_PUSH],
};

type P2 = [number, number];
type P3 = [number, number, number];

export interface SimPlanExportOptions {
  serialized: string;
  order: number;
  faceColors: Record<NetFaceLetter, string>;
  background?: string | null;
  strokeColor?: string;
  strokeWidth?: number;
}

const fmt = (n: number): string => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
};

/** visualcube makeStickerPosition(face, N, a, b):晶格角 (a=row, b=col) → 3D 位置 ∈[0,N]³。 */
function stickerPos(face: number, N: number, a: number, b: number): P3 {
  switch (face) {
    case FACE.U: return [a, 0, N - b];
    case FACE.R: return [N, b, a];
    case FACE.F: return [a, b, 0];
    case FACE.D: return [a, N, b];
    case FACE.L: return [0, b, N - a];
    case FACE.B: return [N - a, b, N];
    default: return [0, 0, 0];
  }
}

/** plan 投影:中心化 → 缩放 1/N → 绕 X 转 −90°((x,y,z)→(x,−z,y)) → 沿 z 后移 dist → 透视除法。 */
function projPlan(p: P3, N: number): P2 {
  const x = (p[0] - N / 2) / N;
  const y = (p[1] - N / 2) / N;
  const z = (p[2] - N / 2) / N;
  // rotate X −90°
  const ry = -z;
  const rz = y;
  const tz = rz + DIST; // 后移
  return [(x * DIST) / tz, (ry * DIST) / tz];
}

/** 点 p 朝中心 c 缩放 s(留缝)。 */
const toward = (p: P2, c: P2, s: number): P2 => [c[0] + (p[0] - c[0]) * s, c[1] + (p[1] - c[1]) * s];
const mid = (a: P2, b: P2): P2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/**
 * NxN 俯视 OLL 图 → 纯字符串 SVG。忠实复刻 visualcube plan:中央 U 面 + R/F/L/B 顶排斜切侧带。
 */
export function exportSimPlanSvg(opts: SimPlanExportOptions): string {
  const N = Math.max(1, Math.round(opts.order));
  const max = N - 1;
  const s = opts.serialized;
  const fc = opts.faceColors;
  const stroke = opts.strokeColor ?? '#000';

  /** facelet (face,x,y,z) → 面色(经 netIndexOf 定位 serialize 块内 index)。 */
  const colorAt = (face: number, x: number, y: number, z: number): string => {
    const ch = s[FACE_TO_BLOCK[face] * N * N + netIndexOf(x, y, z, face, max, N)] ?? '';
    return ch === 'U' || ch === 'R' || ch === 'F' || ch === 'D' || ch === 'L' || ch === 'B'
      ? fc[ch] : '#444';
  };

  const poly = (pts: P2[], fill: string, sw: number): string =>
    `<polygon points="${pts.map((p) => `${fmt(p[0])},${fmt(p[1])}`).join(' ')}"`
    + ` fill="${fill}" stroke="${stroke}" stroke-width="${fmt(sw)}" stroke-linejoin="round"/>`;

  let body = '';

  // U 面黑色衬底(四角缩放 0.94)→ 贴纸 0.85 内缩后缝隙露黑,与 visualcube 同款网格。
  const uc = [
    projPlan(stickerPos(FACE.U, N, 0, 0), N), projPlan(stickerPos(FACE.U, N, N, 0), N),
    projPlan(stickerPos(FACE.U, N, N, N), N), projPlan(stickerPos(FACE.U, N, 0, N), N),
  ].map((p): P2 => [p[0] * OUTLINE_SCALE, p[1] * OUTLINE_SCALE]);
  body += poly(uc, stroke, 0);

  // U 面:引擎格 (x,z) = visualcube (row=x, col=z);4 投影角内缩 0.85,填 colorAt(U,x,max,z)。
  for (let x = 0; x < N; x++) {
    for (let z = 0; z < N; z++) {
      const c00 = projPlan(stickerPos(FACE.U, N, x, z), N);
      const c10 = projPlan(stickerPos(FACE.U, N, x + 1, z), N);
      const c11 = projPlan(stickerPos(FACE.U, N, x + 1, z + 1), N);
      const c01 = projPlan(stickerPos(FACE.U, N, x, z + 1), N);
      const ctr = mid(c00, c11);
      const q = [c00, c10, c11, c01].map((p) => toward(p, ctr, U_INSET));
      body += poly(q, colorAt(FACE.U, x, max, z), 0);
    }
  }

  // OLL 侧带:R/F/L/B 顶排(geometry row i, col 0→1),外缘 col1 沿面法向外推 → 斜切梯形。
  // 颜色配对物理格(与 flat 版一致,已核验):F→(i,max,max) R→(max,max,max-i) L→(0,max,i) B→(max-i,max,0)。
  const bandColor = (face: number, i: number): string => {
    switch (face) {
      case FACE.F: return colorAt(FACE.F, i, max, max);
      case FACE.R: return colorAt(FACE.R, max, max, max - i);
      case FACE.L: return colorAt(FACE.L, 0, max, i);
      case FACE.B: return colorAt(FACE.B, max - i, max, 0);
      default: return '#444';
    }
  };
  for (const face of [FACE.R, FACE.F, FACE.L, FACE.B]) {
    const [vx, vy] = OLL_PUSH_VEC[face];
    for (let i = 0; i < N; i++) {
      const inner0 = projPlan(stickerPos(face, N, i, 0), N);       // stickers[i][0]
      const inner1 = projPlan(stickerPos(face, N, i + 1, 0), N);   // stickers[i+1][0]
      const outer1 = projPlan(stickerPos(face, N, i + 1, 1), N);   // stickers[i+1][1]
      const outer0 = projPlan(stickerPos(face, N, i, 1), N);       // stickers[i][1]
      const ctr = mid(inner0, outer1);
      const p1 = toward(inner0, ctr, OLL_INSET);                   // 内缘(贴 U),不外推
      const p2 = toward(inner1, ctr, OLL_INSET);
      const p3t = toward(outer1, ctr, OLL_INSET); const p3: P2 = [p3t[0] + vx, p3t[1] + vy]; // 外缘外推
      const p4t = toward(outer0, ctr, OLL_INSET); const p4: P2 = [p4t[0] + vx, p4t[1] + vy];
      body += poly([p1, p2, p3, p4], bandColor(face, i), OLL_STROKE);
    }
  }

  const VB = 1.8, ORIG = -0.9; // visualcube plan 默认 viewbox
  const bg = opts.background
    ? `<rect x="${ORIG}" y="${ORIG}" width="${VB}" height="${VB}" fill="${opts.background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${VB}" height="${VB}"`
    + ` viewBox="${ORIG} ${ORIG} ${VB} ${VB}">${bg}${body}</svg>`;
}
