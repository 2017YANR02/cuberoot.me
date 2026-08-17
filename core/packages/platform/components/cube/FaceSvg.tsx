// 轻量装饰用 2D 魔方面 SVG:纯色块网格,不做真实还原模拟,仅给计时器页 / 卡片点缀。
// 颜色是魔方贴纸的物理配色(非主题色),作为装饰素材直接写入,不走 @theme token。

type FaceColor = "white" | "yellow" | "red" | "orange" | "green" | "blue";

const STICKER: Record<FaceColor, string> = {
  white: "#F4F6F8",
  yellow: "#FFD500",
  red: "#E5392F",
  orange: "#FF6A00",
  green: "#10B65A",
  blue: "#2A5DF4",
};

// 一个 n×n 的单面:可传入贴纸配色矩阵,不传则随机一组(确定性可控用 seed)。
function pickColors(n: number, seed: number): FaceColor[] {
  const palette: FaceColor[] = [
    "white",
    "yellow",
    "red",
    "orange",
    "green",
    "blue",
  ];
  const out: FaceColor[] = [];
  let s = seed || 1;
  for (let i = 0; i < n * n; i++) {
    // 简单 LCG,保证 SSR / CSR 一致(无随机源)
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out.push(palette[s % palette.length]);
  }
  return out;
}

export function FaceSvg({
  n = 3,
  size = 72,
  seed = 7,
  colors,
  className = "",
  rounded = true,
}: {
  n?: number;
  size?: number;
  seed?: number;
  colors?: FaceColor[];
  className?: string;
  rounded?: boolean;
}) {
  const cells = colors ?? pickColors(n, seed);
  const gap = size * 0.04;
  const pad = size * 0.06;
  const inner = size - pad * 2;
  const cell = (inner - gap * (n - 1)) / n;
  const r = rounded ? cell * 0.18 : 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label={`${n} 阶魔方面装饰`}
    >
      <rect
        x={0}
        y={0}
        width={size}
        height={size}
        rx={size * 0.14}
        fill="#161B22"
      />
      {cells.map((c, i) => {
        const row = Math.floor(i / n);
        const col = i % n;
        const x = pad + col * (cell + gap);
        const y = pad + row * (cell + gap);
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={cell}
            height={cell}
            rx={r}
            fill={STICKER[c]}
          />
        );
      })}
    </svg>
  );
}

// 一个简易"展开十字"魔方装饰(U 在上,L F R 一排,D 在下),纯装饰。
export function CubeNetSvg({
  unit = 40,
  className = "",
}: {
  unit?: number;
  className?: string;
}) {
  const w = unit * 4;
  const h = unit * 3;
  // 6 个面各给一个 seed,色块不同更生动
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      role="img"
      aria-label="魔方展开图装饰"
    >
      <g transform={`translate(${unit},0)`}>
        <FaceFaceInline x={0} y={0} unit={unit} seed={3} />
      </g>
      <g transform={`translate(0,${unit})`}>
        <FaceFaceInline x={0} y={0} unit={unit} seed={11} />
      </g>
      <g transform={`translate(${unit},${unit})`}>
        <FaceFaceInline x={0} y={0} unit={unit} seed={19} />
      </g>
      <g transform={`translate(${unit * 2},${unit})`}>
        <FaceFaceInline x={0} y={0} unit={unit} seed={29} />
      </g>
      <g transform={`translate(${unit * 3},${unit})`}>
        <FaceFaceInline x={0} y={0} unit={unit} seed={41} />
      </g>
      <g transform={`translate(${unit},${unit * 2})`}>
        <FaceFaceInline x={0} y={0} unit={unit} seed={53} />
      </g>
    </svg>
  );
}

// 内联画一个 3x3 面(供 CubeNetSvg 用),避免嵌套 svg。
function FaceFaceInline({
  x,
  y,
  unit,
  seed,
}: {
  x: number;
  y: number;
  unit: number;
  seed: number;
}) {
  const n = 3;
  const cells = pickColors(n, seed);
  const gap = unit * 0.05;
  const pad = unit * 0.08;
  const inner = unit - pad * 2;
  const cell = (inner - gap * (n - 1)) / n;
  return (
    <>
      <rect x={x} y={y} width={unit} height={unit} fill="#161B22" />
      {cells.map((c, i) => {
        const row = Math.floor(i / n);
        const col = i % n;
        return (
          <rect
            key={i}
            x={x + pad + col * (cell + gap)}
            y={y + pad + row * (cell + gap)}
            width={cell}
            height={cell}
            rx={cell * 0.16}
            fill={STICKER[c]}
          />
        );
      })}
    </>
  );
}
