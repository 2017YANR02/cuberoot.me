/**
 * 纯 SVG 折线 / 柱状图 —— 零依赖(不引 recharts / chart.js)。
 *
 * server component 安全:无 hooks、无浏览器 API,直接在 RSC 里渲染。
 * 悬浮提示走原生 <title>(每个点 / 柱一个),响应式靠 viewBox + preserveAspectRatio。
 *
 * - 折线:多 series 叠加,自动配色,点带 hover <title>
 * - 柱状:单 series,适合 GMV / 单指标日趋势
 * - SvgFunnel:横向条形漏斗,每层一根条 + 转化率标注
 */

export type ChartSeries = {
  name: string;
  values: number[];
  color?: string;
};

const SERIES_COLORS = ["#2A5DF4", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444"];

// 内部坐标系(viewBox)。响应式由外层容器宽度 + viewBox 缩放保证。
const VB_W = 720;
const PAD_L = 44;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 28;

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / pow;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * pow;
}

function fmtTick(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(v % 10000 === 0 ? 0 : 1)}w`;
  if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return String(v);
}

// x 轴标签抽稀:点多时只显示若干个,避免重叠
function tickIndices(n: number, max = 8): Set<number> {
  if (n <= max) return new Set(Array.from({ length: n }, (_, i) => i));
  const step = Math.ceil(n / max);
  const out = new Set<number>();
  for (let i = 0; i < n; i += step) out.add(i);
  out.add(n - 1);
  return out;
}

type LineProps = {
  series: ChartSeries[];
  labels: string[];
  height?: number;
  variant?: "line";
  unit?: string;
};

type BarProps = {
  series: [ChartSeries]; // 柱状只取第一条
  labels: string[];
  height?: number;
  variant: "bar";
  unit?: string;
};

export function SvgLineChart(props: LineProps | BarProps) {
  const { series, labels, height = 220, unit = "" } = props;
  const variant = props.variant ?? "line";
  const n = labels.length;

  const allValues = series.flatMap((s) => s.values);
  const rawMax = allValues.length ? Math.max(...allValues, 0) : 0;
  const maxY = niceMax(rawMax);
  const innerW = VB_W - PAD_L - PAD_R;
  const innerH = height - PAD_T - PAD_B;

  const xAt = (i: number) =>
    n <= 1 ? PAD_L + innerW / 2 : PAD_L + (innerW * i) / (n - 1);
  const yAt = (v: number) => PAD_T + innerH - (innerH * v) / maxY;

  const gridLines = 4;
  const xTicks = tickIndices(n);

  const empty = allValues.every((v) => v === 0);

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      role="img"
    >
      {/* 水平网格 + y 轴刻度 */}
      {Array.from({ length: gridLines + 1 }, (_, i) => {
        const v = (maxY * i) / gridLines;
        const y = yAt(v);
        return (
          <g key={`g${i}`}>
            <line
              x1={PAD_L}
              x2={VB_W - PAD_R}
              y1={y}
              y2={y}
              stroke="#EEF1F6"
              strokeWidth={1}
            />
            <text
              x={PAD_L - 6}
              y={y + 3}
              textAnchor="end"
              fontSize={10}
              fill="#6B7280"
            >
              {fmtTick(v)}
            </text>
          </g>
        );
      })}

      {/* x 轴标签 */}
      {labels.map((lb, i) =>
        xTicks.has(i) ? (
          <text
            key={`x${i}`}
            x={xAt(i)}
            y={height - 8}
            textAnchor="middle"
            fontSize={10}
            fill="#6B7280"
          >
            {lb}
          </text>
        ) : null,
      )}

      {empty ? (
        <text
          x={VB_W / 2}
          y={PAD_T + innerH / 2}
          textAnchor="middle"
          fontSize={12}
          fill="#9CA3AF"
        >
          暂无数据
        </text>
      ) : variant === "bar" ? (
        // ── 柱状 ──
        (() => {
          const s = series[0];
          const color = s.color ?? SERIES_COLORS[0];
          const slot = innerW / Math.max(1, n);
          const bw = Math.max(2, Math.min(28, slot * 0.62));
          return s.values.map((v, i) => {
            const x = xAt(i) - bw / 2;
            const y = yAt(v);
            const h = PAD_T + innerH - y;
            return (
              <rect
                key={`b${i}`}
                x={x}
                y={y}
                width={bw}
                height={Math.max(0, h)}
                rx={2}
                fill={color}
                opacity={0.88}
              >
                <title>{`${labels[i]}: ${v}${unit}`}</title>
              </rect>
            );
          });
        })()
      ) : (
        // ── 折线 ──
        series.map((s, si) => {
          const color = s.color ?? SERIES_COLORS[si % SERIES_COLORS.length];
          const d = s.values
            .map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(v)}`)
            .join(" ");
          return (
            <g key={`s${si}`}>
              <path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {s.values.map((v, i) => (
                <circle
                  key={`p${si}-${i}`}
                  cx={xAt(i)}
                  cy={yAt(v)}
                  r={n > 30 ? 1.6 : 2.6}
                  fill="#fff"
                  stroke={color}
                  strokeWidth={1.6}
                >
                  <title>{`${s.name} ${labels[i]}: ${v}${unit}`}</title>
                </circle>
              ))}
            </g>
          );
        })
      )}
    </svg>
  );
}

// 多 series 折线时的图例(色块 + 名称)
export function ChartLegend({ series }: { series: ChartSeries[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {series.map((s, i) => (
        <span key={s.name} className="inline-flex items-center gap-1.5 text-[12px] text-ink-3">
          <span
            className="inline-block h-2.5 w-2.5 rounded-[3px]"
            style={{ background: s.color ?? SERIES_COLORS[i % SERIES_COLORS.length] }}
          />
          {s.name}
        </span>
      ))}
    </div>
  );
}

export type FunnelRow = {
  label: string;
  count: number;
  stepRate: number; // 相对上一层
  overallRate: number; // 相对顶层
};

// 横向条形漏斗:每层一根条,宽度 = 相对顶层比例,条上标计数 + 整体转化率,
// 第二层起在右侧标「环比上一层」转化率。纯 div,响应式天然适配窄屏。
export function SvgFunnel({ stages }: { stages: FunnelRow[] }) {
  const top = stages[0]?.count ?? 0;
  return (
    <div className="flex flex-col gap-2.5">
      {stages.map((s, i) => {
        const widthPct = top > 0 ? Math.max(s.count > 0 ? 4 : 0, (s.count / top) * 100) : 0;
        const color = SERIES_COLORS[i % SERIES_COLORS.length];
        return (
          <div key={s.label}>
            <div className="flex items-baseline justify-between text-[12px] mb-1">
              <span className="text-ink font-medium">
                {s.label}
                <span className="ml-2 text-ink-3 font-normal">{s.count.toLocaleString()}</span>
              </span>
              <span className="text-ink-3 tabular-nums">
                {i === 0
                  ? "起点"
                  : `环比 ${(s.stepRate * 100).toFixed(1)}% · 整体 ${(s.overallRate * 100).toFixed(1)}%`}
              </span>
            </div>
            <div className="h-7 w-full rounded-[6px] bg-bg-soft overflow-hidden">
              <div
                className="h-full rounded-[6px] transition-[width]"
                style={{ width: `${widthPct}%`, background: color, opacity: 0.9 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
