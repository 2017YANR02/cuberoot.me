'use client';

import { useId, useMemo } from 'react';

export interface HistSeries {
  name: string;
  // NOTE: fillColors = 用于竖向渐变的色序（WCA 颜色自上而下）。长度 1 时退化为单色带描边
  fillColors: string[];
  stroke?: string;
  counts: Record<string, number>;
  // NOTE: 设置后图例可点击，用于循环切换颜色（single/dual/quad 模式）
  onLegendClick?: () => void;
  legendHint?: string;
}

export interface LegendMode {
  key: string;
  label: string;
}

interface Props {
  series: HistSeries[];
  isZh?: boolean;
  yMode?: 'count' | 'percent';
  chartMode?: 'pdf' | 'cdf';
  // NOTE: 模式切换 pills 画在图例上方；每个 pill 独立可点。不传则不渲染
  modes?: LegendMode[];
  activeMode?: string;
  onModeChange?: (key: string) => void;
  // NOTE: 稀有 bin (极端步数) 可点击查看具体 scramble；当前选中的 bin 会被高亮
  clickableBins?: number[];
  selectedBin?: number | null;
  onBarClick?: (bin: number) => void;
  // NOTE: PDF/CDF 切换 & Y 轴 %/count 切换（挪进图例右上区的两个小按钮）
  onChartModeToggle?: () => void;
  onYModeToggle?: () => void;
  yModeLabel?: string;
  // NOTE: 图例最顶的 Set 下拉（通常只有 WCA 一项，留着给未来多打乱集）
  setOptions?: { value: string; label: string }[];
  activeSet?: string;
  onSetChange?: (v: string) => void;
}

const W = 760, H = 400;
// NOTE: 图例放在图表左上空白区（0..low-count 的柱子永远很矮），不再占右边 pad
const PAD = { l: 56, r: 20, t: 40, b: 44 };
const chartW = W - PAD.l - PAD.r;
const chartH = H - PAD.t - PAD.b;

export default function DiscreteHistogram({ series, isZh: _isZh, yMode = 'percent', chartMode = 'pdf', modes, activeMode, onModeChange, clickableBins, selectedBin, onBarClick, onChartModeToggle, onYModeToggle, yModeLabel, setOptions, activeSet, onSetChange }: Props) {
  const clickableSet = useMemo(() => new Set(clickableBins ?? []), [clickableBins]);
  // NOTE: svg 内 <linearGradient> id 必须全局唯一，用 React 的 useId 前缀
  const gradPrefix = useId().replace(/:/g, '_');

  const { xMin, xMax, yMax, totals, values } = useMemo(() => {
    let mn = Infinity, mx = -Infinity;
    const totals: number[] = [];
    for (const s of series) {
      let tot = 0;
      for (const k of Object.keys(s.counts)) {
        const v = Number(k);
        const c = s.counts[k];
        tot += c;
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
      totals.push(tot);
    }
    if (!Number.isFinite(mn)) { mn = 0; mx = 0; }
    const values = series.map((s, i) => {
      const tot = totals[i] || 1;
      const out: Record<number, number> = {};
      let cum = 0;
      for (let v = mn; v <= mx; v++) {
        const raw = s.counts[String(v)] ?? 0;
        const pdf = yMode === 'percent' ? raw / tot : raw;
        cum += pdf;
        out[v] = chartMode === 'cdf' ? cum : pdf;
      }
      return out;
    });
    let ymx = 0;
    if (chartMode === 'cdf') {
      ymx = yMode === 'percent' ? 1 : Math.max(...totals, 1);
    } else {
      for (let v = mn; v <= mx; v++) {
        for (const n of values) if ((n[v] ?? 0) > ymx) ymx = n[v] ?? 0;
      }
    }
    return { xMin: mn, xMax: mx, yMax: ymx || 1, totals, values };
  }, [series, yMode, chartMode]);

  if (series.length === 0 || !Number.isFinite(xMin)) {
    return <div className="scramble-hist-empty">No data</div>;
  }

  const nBins = xMax - xMin + 1;
  const slotW = chartW / nBins;
  const groupPad = 0.15;
  const slotInnerW = slotW * (1 - groupPad);
  const slotPadL = (slotW - slotInnerW) / 2;
  const barW = slotInnerW / series.length;

  const yTicks: number[] = [];
  const yStep = niceStep(yMax, 5);
  for (let v = 0; v <= yMax * 1.01; v += yStep) yTicks.push(v);

  const fmtY = (v: number) =>
    yMode === 'percent'
      ? `${(v * 100).toFixed(v < 0.01 ? 2 : v < 0.1 ? 1 : 0)}%`
      : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v));

  const fmtCount = (n: number) => n.toLocaleString();
  const fmtPct = (p: number) => {
    if (p === 0) return '0%';
    if (p < 0.001) return `${(p * 100).toFixed(2)}%`;
    if (p < 0.01) return `${(p * 100).toFixed(1)}%`;
    return `${(p * 100).toFixed(1)}%`;
  };

  const showLabels = series.length === 1;

  const gradIdFor = (i: number) => `${gradPrefix}grad${i}`;

  return (
    <div className="scramble-hist-wrapper">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        className="scramble-hist"
      >
        <defs>
          {series.map((s, i) => (
            <linearGradient key={`gr${i}`} id={gradIdFor(i)} x1="0" y1="0" x2="0" y2="1">
              {gradientStops(s.fillColors)}
            </linearGradient>
          ))}
        </defs>
        {/* Y grid + ticks */}
        {yTicks.map((v, i) => {
          const y = PAD.t + chartH - (v / yMax) * chartH;
          return (
            <g key={`y${i}`}>
              <line x1={PAD.l} x2={PAD.l + chartW} y1={y} y2={y} style={{ stroke: 'var(--border)' }} strokeDasharray="2,3" />
              <text x={PAD.l - 8} y={y + 4} textAnchor="end" fontSize="11" style={{ fill: 'var(--text-sub)' }}>{fmtY(v)}</text>
            </g>
          );
        })}
        {/* X ticks */}
        {Array.from({ length: nBins }, (_, i) => xMin + i).map((v, i) => {
          const x = PAD.l + i * slotW + slotW / 2;
          return (
            <g key={`x${v}`}>
              <line x1={x} x2={x} y1={PAD.t + chartH} y2={PAD.t + chartH + 4} style={{ stroke: 'var(--border-strong)' }} />
              <text x={x} y={PAD.t + chartH + 18} textAnchor="middle" fontSize="12" style={{ fill: 'var(--text)' }}>{v}</text>
            </g>
          );
        })}
        {/* X/Y 轴线 */}
        <line x1={PAD.l} x2={PAD.l + chartW} y1={PAD.t + chartH} y2={PAD.t + chartH} style={{ stroke: 'var(--border-strong)' }} />
        <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + chartH} style={{ stroke: 'var(--border-strong)' }} />
        {/* Bars */}
        {series.map((s, si) => (
          <g key={`s${si}`}>
            {Array.from({ length: nBins }, (_, i) => xMin + i).map((v, bi) => {
              const yVal = values[si][v] ?? 0;
              if (yVal <= 0) return null;
              const h = (yVal / yMax) * chartH;
              const x = PAD.l + bi * slotW + slotPadL + si * barW;
              const fill = `url(#${gradIdFor(si)})`;
              const isClickable = clickableSet.has(v);
              const isSelected = selectedBin === v;
              const defaultStroke = s.stroke ?? (needsStroke(s.fillColors) ? '#d4d4d4' : undefined);
              const stroke = isSelected ? '#C15F3C' : defaultStroke;
              const strokeW = isSelected ? 2 : (defaultStroke ? 1 : 0);
              const rectW = Math.max(barW - 1, 0.5);
              return (
                <rect
                  key={`b${si}_${v}`}
                  x={x}
                  y={PAD.t + chartH - h}
                  width={rectW}
                  height={h}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeW}
                  opacity={series.length > 1 ? 0.82 : 0.92}
                  className={isClickable ? 'scramble-hist-bar-clickable' : undefined}
                  style={isClickable && onBarClick ? { cursor: 'pointer' } : undefined}
                  onClick={isClickable && onBarClick ? () => onBarClick(v) : undefined}
                />
              );
            })}
          </g>
        ))}
        {/* 稀有 bin 的透明 hit-rect，覆盖柱子及下方 x 轴，避免点 0 步极矮柱子难点 */}
        {onBarClick && clickableBins && series.length === 1 && Array.from({ length: nBins }, (_, i) => xMin + i).map((v, bi) => {
          if (!clickableSet.has(v)) return null;
          return (
            <rect
              key={`hit${v}`}
              x={PAD.l + bi * slotW + slotPadL}
              y={PAD.t}
              width={slotW - slotPadL * 2}
              height={chartH + 18}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={() => onBarClick(v)}
            />
          );
        })}
        {/* 柱上方标签（单 series）。PDF: 计数 + 百分比；CDF: 累积计数 + 累积百分比 */}
        {showLabels && Array.from({ length: nBins }, (_, i) => xMin + i).map((v, bi) => {
          const s = series[0];
          const yVal = values[0][v] ?? 0;
          if (yVal <= 0) return null;
          const h = (yVal / yMax) * chartH;
          const cx = PAD.l + bi * slotW + slotW / 2;
          const topY = PAD.t + chartH - h - 6;
          const tot = totals[0] || 1;
          let countDisp: number;
          let pctDisp: number;
          if (chartMode === 'cdf') {
            countDisp = Math.round(yMode === 'percent' ? yVal * tot : yVal);
            pctDisp = yMode === 'percent' ? yVal : yVal / tot;
          } else {
            countDisp = s.counts[String(v)] ?? 0;
            pctDisp = countDisp / tot;
          }
          return (
            <g key={`lb${v}`}>
              <text x={cx} y={topY - 12} textAnchor="middle" fontSize="10" style={{ fill: 'var(--text)' }}>{fmtCount(countDisp)}</text>
              <text x={cx} y={topY} textAnchor="middle" fontSize="10" style={{ fill: 'var(--text-sub)' }}>{fmtPct(pctDisp)}</text>
            </g>
          );
        })}
      </svg>
      {/* Legend 作为独立 HTML 叠在 SVG 左上；不放进 SVG 避免 viewBox 缩放导致字号变小 */}
      <div className="scramble-hist-legend">
        {setOptions && setOptions.length > 0 && (
          <select
            className="scramble-hist-legend-select"
            value={activeSet}
            onChange={(e) => onSetChange?.(e.target.value)}
          >
            {setOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
        {modes && modes.length > 0 && (
          <select
            className="scramble-hist-legend-select scramble-hist-legend-select-mode"
            value={activeMode}
            onChange={(e) => onModeChange?.(e.target.value)}
          >
            {modes.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        )}
        {series.map((s, i) => {
          const chips = s.fillColors.length > 0 ? s.fillColors : ['#8B7D72'];
          const clickable = !!s.onLegendClick;
          return (
            <div
              key={`lg${i}`}
              className={`scramble-hist-legend-chips${clickable ? ' clickable' : ''}`}
              onClick={s.onLegendClick}
              title={clickable ? s.legendHint : undefined}
            >
              {chips.map((c, ci) => (
                <span
                  key={`chip${ci}`}
                  className={`scramble-hist-legend-chip${needsStroke([c]) ? ' with-stroke' : ''}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          );
        })}
        {(onChartModeToggle || onYModeToggle) && (
          <div className="scramble-hist-legend-toggles">
            {onChartModeToggle && (
              <button
                className="scramble-hist-legend-btn"
                onClick={onChartModeToggle}
                title={`Switch to ${chartMode === 'pdf' ? 'CDF' : 'PDF'}`}
              >
                {chartMode === 'pdf' ? 'PDF' : 'CDF'}
              </button>
            )}
            {onYModeToggle && (
              <button
                className="scramble-hist-legend-btn"
                onClick={onYModeToggle}
                title={`Switch to ${yMode === 'percent' ? 'count' : '%'}`}
              >
                {yModeLabel ?? (yMode === 'percent' ? '%' : 'count')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// NOTE: 渐变 stops —— 单色 → 一个 stop；多色 → 均分分布
function gradientStops(colors: string[]) {
  if (colors.length === 0) return <stop offset="0%" stopColor="#8B7D72" />;
  if (colors.length === 1) {
    return <stop offset="0%" stopColor={colors[0]} />;
  }
  return colors.map((c, i) => {
    const offset = (i / (colors.length - 1)) * 100;
    return <stop key={i} offset={`${offset}%`} stopColor={c} />;
  });
}

// NOTE: 白色/极浅色填充在 cream 背景上需要灰描边
function needsStroke(colors: string[]): boolean {
  return colors.some((c) => c.toUpperCase() === '#FFFFFF' || c.toUpperCase() === '#FEFE00');
}

function niceStep(max: number, target: number): number {
  if (max <= 0) return 1;
  const raw = max / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const r = raw / mag;
  if (r <= 1.5) return mag;
  if (r <= 3.5) return 2 * mag;
  if (r <= 7.5) return 5 * mag;
  return 10 * mag;
}
