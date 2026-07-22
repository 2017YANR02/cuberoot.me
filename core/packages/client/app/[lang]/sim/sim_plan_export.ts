// 引擎驱动的 NxN 俯视图(plan)导出器 —— 退役对照表 §2b「视图 plan」。visualcube 的 plan
// 是略透视 3D 俯视 + R/F/L/B 顶排侧带(renderOLLStickers);引擎路取等价**平面** OLL 图:
// 中央 U 面 N×N + 四侧「U 相邻排」(顶层侧贴纸)折出,更干净、同信息量(OLL/PLL 识别)。
//
// 颜色全走已核验的 netIndexOf(vcStageMask):任一 facelet (face,x,y,z) 的色 =
// serialize()[block(face)·N² + netIndexOf(x,y,z)](serialize 定义即此)。侧带按物理折出
// 对齐 U 各边(F 下 / B 上 / L 左 / R 右),朝向经 Playwright 对 visualcube plan 核验。
//
// 布局单位 = 格;viewBox 含 U(N×N)+ 四侧各 1 排 + 间隙。sizeEngineSvg 再钉图片尺寸。
import { FACE } from './engine/define';
import { netIndexOf } from './engine/nxn/vcStageMask';
import { NET_STROKE_W, type NetFaceLetter } from './sim_net_export';

// 引擎 FACE → serialize() 的 URFDLB 块序(U0 R1 F2 D3 L4 B5)。
const FACE_TO_BLOCK: Record<number, number> = {
  [FACE.U]: 0, [FACE.R]: 1, [FACE.F]: 2, [FACE.D]: 3, [FACE.L]: 4, [FACE.B]: 5,
};

const PLAN_GAP = 0.14; // U 与侧带间隙(格单位)

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

/**
 * NxN 俯视 OLL 图 → 纯字符串 SVG。中央 U 面 + F(下)/B(上)/L(左)/R(右)顶排侧带。
 */
export function exportSimPlanSvg(opts: SimPlanExportOptions): string {
  const N = Math.max(1, Math.round(opts.order));
  const max = N - 1;
  const s = opts.serialized;
  const fc = opts.faceColors;
  const stroke = opts.strokeColor ?? '#000';
  const sw = opts.strokeWidth ?? NET_STROKE_W;

  /** facelet (face,x,y,z) → 面色(经 netIndexOf 定位 serialize 块内 index)。 */
  const colorAt = (face: number, x: number, y: number, z: number): string => {
    const ch = s[FACE_TO_BLOCK[face] * N * N + netIndexOf(x, y, z, face, max, N)] ?? '';
    return ch === 'U' || ch === 'R' || ch === 'F' || ch === 'D' || ch === 'L' || ch === 'B'
      ? fc[ch] : '#444';
  };

  const off = 1 + PLAN_GAP;      // U 左上角偏移(留出上/左侧带 1 格 + 间隙)
  const farU = off + N + PLAN_GAP; // 下/右侧带的坐标
  const dim = off + N + PLAN_GAP + 1; // viewBox 边长

  let cells = '';
  const rect = (cx: number, cy: number, fill: string): void => {
    cells += `<rect x="${fmt(cx)}" y="${fmt(cy)}" width="1" height="1"`
      + ` fill="${fill}" stroke="${stroke}" stroke-width="${fmt(sw)}"/>`;
  };

  // 中央 U 面:cell (x,z) → 屏 (col=x, row=z);z=0=后(顶)、z=max=前(底),x 右增。
  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) rect(off + x, off + z, colorAt(FACE.U, x, max, z));
  }
  // 侧带(顶层 y=max 的侧贴纸,折出对齐 U 各边)。
  for (let x = 0; x < N; x++) {
    rect(off + x, 0,    colorAt(FACE.B, x, max, 0));   // B 上(后)
    rect(off + x, farU, colorAt(FACE.F, x, max, max)); // F 下(前)
  }
  for (let z = 0; z < N; z++) {
    rect(0,    off + z, colorAt(FACE.L, 0, max, z));   // L 左
    rect(farU, off + z, colorAt(FACE.R, max, max, z)); // R 右
  }

  const bg = opts.background
    ? `<rect x="0" y="0" width="${fmt(dim)}" height="${fmt(dim)}" fill="${opts.background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(dim)}" height="${fmt(dim)}"`
    + ` viewBox="0 0 ${fmt(dim)} ${fmt(dim)}">${bg}${cells}</svg>`;
}
