// 简易 SVG 折线 / 柱状图组件 — 自给自足,无第三方
import { useMemo, useState, useEffect } from 'react';

export interface Series {
  name: string;
  color: string;
  data: { x: number; y: number | null }[];
  dashed?: boolean;
  width?: number;
}

/** 预测带 (bootstrap CI 或 GEV envelope) */
export interface Band {
  name: string;
  color: string;
  opacity?: number;
  data: { x: number; lo: number; hi: number }[];
}

/** 水平参考线 (物理下界, ZBLL floor 等) */
export interface RefLine {
  y: number;
  label: string;
  color?: string;
  dashed?: boolean;
}

interface LineChartProps {
  series: Series[];
  bands?: Band[];
  refLines?: RefLine[];
  width?: number;
  height?: number;
  yLabel?: string;
  xLabel?: string;
  yFormat?: (v: number) => string;
  xFormat?: (v: number) => string;
  yMin?: number;
  yMax?: number;
  yLog?: boolean;
  annotations?: { x: number; label: string; color?: string }[];
  highlights?: { x: number; y: number; label: string }[];
  showLegend?: boolean;
}

export function LineChart({
  series,
  bands = [],
  refLines = [],
  width = 760,
  height = 360,
  yLabel,
  xLabel,
  yFormat = (v) => v.toFixed(1),
  xFormat = (v) => Math.round(v).toString(),
  yMin,
  yMax,
  yLog = false,
  annotations = [],
  highlights = [],
  showLegend = true,
}: LineChartProps) {
  // 移动端窄屏适配 — 左侧标签紧缩, 字号略小
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 600px)');
    const sync = () => setIsNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const PAD = isNarrow
    ? { l: 46, r: 10, t: 10, b: 30 }
    : { l: 56, r: 16, t: 12, b: 36 };
  const cw = width - PAD.l - PAD.r;
  const ch = height - PAD.t - PAD.b;

  const allPoints = series.flatMap((s) => s.data.filter((p) => p.y !== null));
  const bandPts = bands.flatMap((b) => b.data.flatMap((d) => [d.lo, d.hi]));
  const refYs = refLines.map((r) => r.y);
  const xVals = allPoints.map((p) => p.x).concat(bands.flatMap((b) => b.data.map((d) => d.x)));
  const yValsRaw = allPoints.map((p) => p.y!).concat(bandPts).concat(refYs);
  const xMin = Math.min(...xVals);
  const xMax = Math.max(...xVals);
  const yLo = yMin ?? Math.min(...yValsRaw);
  const yHi = yMax ?? Math.max(...yValsRaw);

  const yScale = (v: number) => {
    if (yLog) {
      const lo = Math.log(Math.max(yLo, 1e-6));
      const hi = Math.log(Math.max(yHi, 1e-6));
      return PAD.t + ch - ((Math.log(Math.max(v, 1e-6)) - lo) / (hi - lo)) * ch;
    }
    return PAD.t + ch - ((v - yLo) / (yHi - yLo)) * ch;
  };
  const xScale = (v: number) => PAD.l + ((v - xMin) / Math.max(1, xMax - xMin)) * cw;

  // y ticks
  const yTicks = useMemo(() => {
    if (yLog) {
      const ticks: number[] = [];
      const lo = Math.floor(Math.log10(Math.max(yLo, 1e-6)));
      const hi = Math.ceil(Math.log10(Math.max(yHi, 1e-6)));
      for (let p = lo; p <= hi; p++) ticks.push(Math.pow(10, p));
      return ticks;
    }
    const range = yHi - yLo;
    const niceStep = (() => {
      const step = range / 6;
      const mag = Math.pow(10, Math.floor(Math.log10(step)));
      const r = step / mag;
      if (r <= 1.5) return mag;
      if (r <= 3.5) return 2 * mag;
      if (r <= 7.5) return 5 * mag;
      return 10 * mag;
    })();
    const ticks = [];
    const start = Math.ceil(yLo / niceStep) * niceStep;
    for (let v = start; v <= yHi; v += niceStep) ticks.push(v);
    return ticks;
  }, [yLo, yHi, yLog]);

  const xTicks = useMemo(() => {
    const range = xMax - xMin;
    const step = range > 30 ? 5 : range > 15 ? 2 : 1;
    const ticks: number[] = [];
    for (let v = Math.ceil(xMin / step) * step; v <= xMax; v += step) ticks.push(v);
    return ticks;
  }, [xMin, xMax]);

  const [hover, setHover] = useState<{ x: number; year: number } | null>(null);

  function pathOf(s: Series): string {
    let d = '';
    let pen = false;
    for (const p of s.data) {
      if (p.y === null || !isFinite(p.y)) { pen = false; continue; }
      const X = xScale(p.x);
      const Y = yScale(p.y);
      d += pen ? ` L${X.toFixed(1)},${Y.toFixed(1)}` : `M${X.toFixed(1)},${Y.toFixed(1)}`;
      pen = true;
    }
    return d;
  }

  return (
    <div className="pred-chart">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const sx = (e.clientX - rect.left) * (width / rect.width);
          const yr = xMin + ((sx - PAD.l) / cw) * (xMax - xMin);
          if (sx >= PAD.l && sx <= PAD.l + cw) {
            setHover({ x: sx, year: Math.round(yr) });
          } else setHover(null);
        }}
        onMouseLeave={() => setHover(null)}
      >
        {/* y grid */}
        {yTicks.map((v) => (
          <g key={`yt-${v}`}>
            <line
              x1={PAD.l}
              x2={PAD.l + cw}
              y1={yScale(v)}
              y2={yScale(v)}
              stroke="var(--border-default)"
              strokeWidth={1}
            />
            <text
              x={PAD.l - 8}
              y={yScale(v)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={11}
              fill="var(--muted-foreground)"
            >
              {yFormat(v)}
            </text>
          </g>
        ))}
        {/* x ticks */}
        {xTicks.map((v) => (
          <g key={`xt-${v}`}>
            <line
              x1={xScale(v)}
              x2={xScale(v)}
              y1={PAD.t + ch}
              y2={PAD.t + ch + 4}
              stroke="var(--faint-foreground)"
              strokeWidth={1}
            />
            <text
              x={xScale(v)}
              y={PAD.t + ch + 18}
              textAnchor="middle"
              fontSize={11}
              fill="var(--muted-foreground)"
            >
              {xFormat(v)}
            </text>
          </g>
        ))}
        {/* axes */}
        <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + ch} stroke="var(--faint-foreground)" />
        <line x1={PAD.l} x2={PAD.l + cw} y1={PAD.t + ch} y2={PAD.t + ch} stroke="var(--faint-foreground)" />
        {/* prediction bands (drawn first so lines + dots overlap nicely) */}
        {bands.map((band, bi) => {
          const segments: Array<typeof band.data> = [];
          let cur: typeof band.data = [];
          for (const d of band.data) {
            if (isFinite(d.lo) && isFinite(d.hi)) cur.push(d);
            else if (cur.length) { segments.push(cur); cur = []; }
          }
          if (cur.length) segments.push(cur);
          return segments.map((seg, si) => {
            let d = '';
            seg.forEach((p, i) => {
              const X = xScale(p.x);
              const Y = yScale(p.hi);
              d += i === 0 ? `M${X.toFixed(1)},${Y.toFixed(1)}` : ` L${X.toFixed(1)},${Y.toFixed(1)}`;
            });
            for (let i = seg.length - 1; i >= 0; i--) {
              const X = xScale(seg[i].x);
              const Y = yScale(seg[i].lo);
              d += ` L${X.toFixed(1)},${Y.toFixed(1)}`;
            }
            d += ' Z';
            return (
              <path
                key={`band-${bi}-${si}`}
                d={d}
                fill={band.color}
                fillOpacity={band.opacity ?? 0.14}
                stroke="none"
              />
            );
          });
        })}
        {/* horizontal reference lines (physical floor, etc.) */}
        {refLines.map((r, i) => (
          <g key={`rl-${i}`}>
            <line
              x1={PAD.l}
              x2={PAD.l + cw}
              y1={yScale(r.y)}
              y2={yScale(r.y)}
              stroke={r.color || 'var(--signal-success)'}
              strokeWidth={1.2}
              strokeDasharray={r.dashed === false ? undefined : '5 3'}
              opacity={0.8}
            />
            <text
              x={PAD.l + cw - 4}
              y={yScale(r.y) - 4}
              textAnchor="end"
              fontSize={10.5}
              fill={r.color || 'var(--signal-success)'}
              fontWeight={600}
              style={{ paintOrder: 'stroke', stroke: 'var(--card)', strokeWidth: 3, strokeLinejoin: 'round' }}
            >
              {r.label}
            </text>
          </g>
        ))}
        {/* annotations: vertical lines */}
        {annotations.map((a) => (
          <g key={`ann-${a.x}`}>
            <line
              x1={xScale(a.x)}
              x2={xScale(a.x)}
              y1={PAD.t}
              y2={PAD.t + ch}
              stroke={a.color || 'var(--accent)'}
              strokeDasharray="2 3"
              strokeWidth={1}
              opacity={0.6}
            />
            <text
              x={xScale(a.x) + 3}
              y={PAD.t + 11}
              fontSize={9.5}
              fill={a.color || 'var(--accent)'}
              opacity={0.85}
              style={{ paintOrder: 'stroke', stroke: 'var(--card)', strokeWidth: 3, strokeLinejoin: 'round' }}
            >
              {a.label}
            </text>
          </g>
        ))}
        {/* highlight points */}
        {highlights.map((h, i) => (
          <g key={`hl-${i}`}>
            <circle cx={xScale(h.x)} cy={yScale(h.y)} r={4} fill="var(--accent)" />
            <text
              x={xScale(h.x)}
              y={yScale(h.y) - 8}
              textAnchor="middle"
              fontSize={10}
              fill="var(--accent)"
              fontWeight={600}
            >
              {h.label}
            </text>
          </g>
        ))}
        {/* lines */}
        {series.map((s) => (
          <path
            key={s.name}
            d={pathOf(s)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.width ?? 2}
            strokeDasharray={s.dashed ? '6 4' : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {/* dots on raw data */}
        {series.filter((s) => !s.dashed).map((s) =>
          s.data.map((p, i) =>
            p.y !== null && isFinite(p.y) ? (
              <circle
                key={`${s.name}-${i}`}
                cx={xScale(p.x)}
                cy={yScale(p.y)}
                r={2.5}
                fill={s.color}
              />
            ) : null,
          ),
        )}
        {/* hover crosshair */}
        {hover && (
          <line
            x1={hover.x}
            x2={hover.x}
            y1={PAD.t}
            y2={PAD.t + ch}
            stroke="var(--faint-foreground)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
        {/* axis labels */}
        {yLabel && (
          <text
            transform={`rotate(-90, 14, ${PAD.t + ch / 2})`}
            x={14}
            y={PAD.t + ch / 2}
            textAnchor="middle"
            fontSize={11}
            fill="var(--muted-foreground)"
          >
            {yLabel}
          </text>
        )}
        {xLabel && (
          <text
            x={PAD.l + cw / 2}
            y={height - 4}
            textAnchor="middle"
            fontSize={11}
            fill="var(--muted-foreground)"
          >
            {xLabel}
          </text>
        )}
      </svg>
      {/* tooltip */}
      {hover && (
        <div className="pred-tooltip" style={{ left: hover.x }}>
          <div className="pred-tt-year">{hover.year}</div>
          {series.map((s) => {
            const p = s.data.find((d) => d.x === hover.year);
            if (!p || p.y === null) return null;
            return (
              <div key={s.name} className="pred-tt-row">
                <span className="pred-tt-dot" style={{ background: s.color }} />
                <span className="pred-tt-name">{s.name}</span>
                <span className="pred-tt-val">{yFormat(p.y)}</span>
              </div>
            );
          })}
        </div>
      )}
      {showLegend && (
        <div className="pred-legend">
          {series.map((s) => (
            <span key={s.name} className="pred-legend-item">
              <span
                className="pred-legend-line"
                style={{
                  background: s.color,
                  opacity: s.dashed ? 0.6 : 1,
                }}
              />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
