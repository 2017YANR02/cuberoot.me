/**
 * 纯前端自绘的魔方「俯视示意图」(无依赖、无 hooks、RSC 安全)。
 *
 * 画一个代表性的二维俯视盘:正中是 U 面的 3x3 贴纸,四周各贴一排相邻面的顶层棱角贴纸,
 * 形成熟悉的「OLL / PLL 俯视图」轮廓。
 *
 * 注意:这不是从 notation 反解的真实还原状态(那超出本组件范围),而是一张
 * 按 category 区分配色的体面示意图;也支持传 stickers 显式指定 9 格 U 面颜色。
 */

import type { ReactElement } from "react";

/** WCA 标准色板(魔方面色),示意盘从中取色。 */
const PALETTE = {
  white: "#F8FAFC",
  yellow: "#FBBF24",
  red: "#EF4444",
  orange: "#F97316",
  blue: "#2A5DF4",
  green: "#22C55E",
  gray: "#CBD5E1", // 未确定 / 占位
  dark: "#1F2937",
} as const;

type FaceColor = keyof typeof PALETTE;

/** U 面 9 格颜色键(从左上到右下,行优先);未传时按 category 走预设示意。 */
export type AlgStickers = [
  FaceColor, FaceColor, FaceColor,
  FaceColor, FaceColor, FaceColor,
  FaceColor, FaceColor, FaceColor,
];

/** 不同 category 给一套体面的示意配色(U 面 9 格 + 四周边),让卡片一眼区分类型。 */
function presetForCategory(category?: string): {
  u: AlgStickers;
  edges: { top: FaceColor[]; right: FaceColor[]; bottom: FaceColor[]; left: FaceColor[] };
  accent: FaceColor;
} {
  const cat = (category ?? "").toUpperCase();

  // PLL:顶面已全黄(OLL 已完成),靠四周相邻面的换位示意「排列」阶段。
  if (cat.includes("PLL")) {
    return {
      u: ["yellow", "yellow", "yellow", "yellow", "yellow", "yellow", "yellow", "yellow", "yellow"],
      edges: {
        top: ["red", "blue", "red"],
        right: ["green", "red", "green"],
        bottom: ["orange", "green", "orange"],
        left: ["blue", "orange", "blue"],
      },
      accent: "yellow",
    };
  }
  // OLL:顶面黄/灰交错(待翻朝向),四周中性,强调「顶面朝向」阶段。
  if (cat.includes("OLL")) {
    return {
      u: ["gray", "yellow", "gray", "yellow", "yellow", "yellow", "gray", "yellow", "gray"],
      edges: {
        top: ["gray", "yellow", "gray"],
        right: ["gray", "yellow", "gray"],
        bottom: ["gray", "yellow", "gray"],
        left: ["gray", "yellow", "gray"],
      },
      accent: "yellow",
    };
  }
  // F2L:做前两层,顶面留白(未还原),四周下半已成对的色块。
  if (cat.includes("F2L")) {
    return {
      u: ["gray", "gray", "gray", "gray", "white", "gray", "gray", "gray", "gray"],
      edges: {
        top: ["blue", "blue", "blue"],
        right: ["red", "red", "red"],
        bottom: ["green", "green", "green"],
        left: ["orange", "orange", "orange"],
      },
      accent: "blue",
    };
  }
  // 其它(CMLL / 盲拧 / 自定义):中性示意。
  return {
    u: ["white", "white", "white", "white", "white", "white", "white", "white", "white"],
    edges: {
      top: ["blue", "blue", "blue"],
      right: ["red", "red", "red"],
      bottom: ["green", "green", "green"],
      left: ["orange", "orange", "orange"],
    },
    accent: "blue",
  };
}

type Props = {
  /** 按 category 选示意配色(stickers 缺省时生效)。 */
  category?: string;
  /** 显式指定 U 面 9 格颜色,覆盖 category 预设。 */
  stickers?: AlgStickers;
  /** 像素边长,默认 96。 */
  size?: number;
  /** 是否画四周相邻面边贴纸,默认 true。 */
  withEdges?: boolean;
  className?: string;
};

/**
 * 魔方俯视示意盘。SVG 内联、纯函数、可在 Server Component 直接渲染。
 */
export function AlgBoard({
  category,
  stickers,
  size = 96,
  withEdges = true,
  className,
}: Props): ReactElement {
  const preset = presetForCategory(category);
  const u = stickers ?? preset.u;

  // 视图坐标系:总 100x100。U 面占中央 60x60(从 20,20 起),四周各留 18 宽的边带。
  const VB = 100;
  const edge = withEdges ? 18 : 4;
  const start = edge + 2; // U 面左上角
  const span = VB - start * 2; // U 面边长
  const cell = span / 3;
  const gap = cell * 0.08;

  const rounded = (n: number) => Number(n.toFixed(2));

  const uCells: ReactElement[] = [];
  for (let i = 0; i < 9; i++) {
    const r = Math.floor(i / 3);
    const c = i % 3;
    const x = start + c * cell + gap / 2;
    const y = start + r * cell + gap / 2;
    const s = cell - gap;
    uCells.push(
      <rect
        key={`u-${i}`}
        x={rounded(x)}
        y={rounded(y)}
        width={rounded(s)}
        height={rounded(s)}
        rx={rounded(s * 0.16)}
        fill={PALETTE[u[i]]}
        stroke={PALETTE.dark}
        strokeWidth={1.1}
      />,
    );
  }

  const edgeCells: ReactElement[] = [];
  if (withEdges) {
    const t = preset.edges.top;
    const r = preset.edges.right;
    const b = preset.edges.bottom;
    const l = preset.edges.left;
    const bw = cell - gap; // 沿主轴的块宽
    const bh = edge - gap; // 边带厚度
    for (let i = 0; i < 3; i++) {
      const along = start + i * cell + gap / 2;
      // 上
      edgeCells.push(
        <rect key={`t-${i}`} x={rounded(along)} y={rounded(2)} width={rounded(bw)} height={rounded(bh)} rx={2} fill={PALETTE[t[i]]} stroke={PALETTE.dark} strokeWidth={0.9} opacity={0.92} />,
      );
      // 下
      edgeCells.push(
        <rect key={`b-${i}`} x={rounded(along)} y={rounded(VB - 2 - bh)} width={rounded(bw)} height={rounded(bh)} rx={2} fill={PALETTE[b[i]]} stroke={PALETTE.dark} strokeWidth={0.9} opacity={0.92} />,
      );
      // 左
      edgeCells.push(
        <rect key={`l-${i}`} x={rounded(2)} y={rounded(along)} width={rounded(bh)} height={rounded(bw)} rx={2} fill={PALETTE[l[i]]} stroke={PALETTE.dark} strokeWidth={0.9} opacity={0.92} />,
      );
      // 右
      edgeCells.push(
        <rect key={`r-${i}`} x={rounded(VB - 2 - bh)} y={rounded(along)} width={rounded(bh)} height={rounded(bw)} rx={2} fill={PALETTE[r[i]]} stroke={PALETTE.dark} strokeWidth={0.9} opacity={0.92} />,
      );
    }
  }

  return (
    <svg
      viewBox={`0 0 ${VB} ${VB}`}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={category ? `${category} 魔方俯视示意` : "魔方俯视示意"}
    >
      <rect
        x={start - 1.5}
        y={start - 1.5}
        width={span + 3}
        height={span + 3}
        rx={4}
        fill={PALETTE.dark}
      />
      {uCells}
      {edgeCells}
    </svg>
  );
}
