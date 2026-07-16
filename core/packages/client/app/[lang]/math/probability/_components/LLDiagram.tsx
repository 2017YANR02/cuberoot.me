'use client';

/**
 * 顶层状态示意图(俯视,经典 PLL 识别图):3×3 黄顶 + 四周 12 张侧贴纸。
 * 视角约定:黄顶绿前 —— N(后)=蓝 E(右)=橙 S(前)=绿 W(左)=红。
 * 侧贴纸颜色由「块从哪来」推出:角块从 home p 转到位置 q(转 k 格),
 * 它在可见方向 d 上露出的贴纸 = home 上朝向 (d − k) 的那张 → faceColor[(d−k)%4]。
 * 只用于**纯置换**状态(co=eo=0,PLL 轨道展示);带朝向的状态不喂给它。
 */
import { CUBE_FILL } from '@/lib/cube-colors';
import type { LLState } from './ll_math';

// dir: 0=N 1=E 2=S 3=W。黄顶绿前 ⟹ 右面是橙(L 色值)、左面是红(R 色值)。
const DIR_COLOR = [CUBE_FILL.B, CUBE_FILL.L, CUBE_FILL.F, CUBE_FILL.R];
const TOP = CUBE_FILL.D;

/** 角位置 q 的两个可见侧方向:NW→[N,W] NE→[N,E] SE→[S,E] SW→[S,W] */
const CORNER_DIRS: ReadonlyArray<readonly [number, number]> = [[0, 3], [0, 1], [2, 1], [2, 3]];

function cornerSideColor(s: LLState, q: number, dir: number): string {
  const p = s.cp[q];
  const k = (q - p + 4) % 4;
  return DIR_COLOR[(dir - k + 4) % 4];
}

function edgeSideColor(s: LLState, q: number): string {
  return DIR_COLOR[s.ep[q]];
}

/** (row, col) of each corner/edge position in the 3×3 top grid. */
const CORNER_CELL: ReadonlyArray<readonly [number, number]> = [[0, 0], [0, 2], [2, 2], [2, 0]];
const EDGE_CELL: ReadonlyArray<readonly [number, number]> = [[0, 1], [1, 2], [2, 1], [1, 0]];

export default function LLDiagram({ state, size = 72, highlight }: {
  state: LLState;
  size?: number;
  /** 外框颜色(轨道分组用);不传就用默认细框 */
  highlight?: string;
}) {
  const S = 100;          // viewBox
  const strip = 9;        // 侧贴纸厚度
  const gap = 2.5;
  const cell = (S - 2 * (strip + gap) - 2 * gap) / 3;   // 3 格顶面
  const orig = strip + gap;                              // 顶面起点
  const at = (i: number) => orig + i * (cell + gap);

  const rects: React.ReactNode[] = [];
  // 顶面 9 格全黄(纯置换态顶面必黄)
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    rects.push(<rect key={`t${r}${c}`} x={at(c)} y={at(r)} width={cell} height={cell} rx={2} fill={TOP} />);
  }
  // 角与棱的侧贴纸
  const sideRect = (dir: number, slot: number, color: string, key: string) => {
    // dir 上的第 slot(0..2)张,slot 顺着可视方向从左到右 / 从上到下
    const along = at(slot);
    if (dir === 0) rects.push(<rect key={key} x={along} y={0} width={cell} height={strip} rx={2} fill={color} />);
    if (dir === 2) rects.push(<rect key={key} x={along} y={S - strip} width={cell} height={strip} rx={2} fill={color} />);
    if (dir === 3) rects.push(<rect key={key} x={0} y={along} width={strip} height={cell} rx={2} fill={color} />);
    if (dir === 1) rects.push(<rect key={key} x={S - strip} y={along} width={strip} height={cell} rx={2} fill={color} />);
  };
  for (let q = 0; q < 4; q++) {
    const [r, c] = CORNER_CELL[q];
    for (const dir of CORNER_DIRS[q]) {
      const slot = dir === 0 || dir === 2 ? c : r;
      sideRect(dir, slot, cornerSideColor(state, q, dir), `c${q}d${dir}`);
    }
    const [er, ec] = EDGE_CELL[q];
    const eDir = q; // 棱位置编号即其侧方向
    const eSlot = eDir === 0 || eDir === 2 ? ec : er;
    sideRect(eDir, eSlot, edgeSideColor(state, q), `e${q}`);
  }

  return (
    <svg
      viewBox={`-2 -2 ${S + 4} ${S + 4}`}
      width={size}
      height={size}
      style={{ display: 'block' }}
      aria-hidden
    >
      {highlight && (
        <rect x={-2} y={-2} width={S + 4} height={S + 4} rx={6} fill="none" stroke={highlight} strokeWidth={3} />
      )}
      {rects}
    </svg>
  );
}
