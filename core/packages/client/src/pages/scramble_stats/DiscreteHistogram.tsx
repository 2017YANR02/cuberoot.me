import { useMemo } from 'react';

export interface HistSeries {
  name: string;
  color: string;
  stroke?: string;
  counts: Record<string, number>;
}

interface Props {
  series: HistSeries[];
  isZh?: boolean;
  yMode?: 'count' | 'percent';
  chartMode?: 'pdf' | 'cdf';
}

const W = 760, H = 400;
const PAD = { l: 56, r: 180, t: 40, b: 44 };
const chartW = W - PAD.l - PAD.r;
const chartH = H - PAD.t - PAD.b;

export default function DiscreteHistogram({ series, isZh: _isZh, yMode = 'percent', chartMode = 'pdf' }: Props) {
  const { xMin, xMax, yMax, totals, values, means, perMin, perMax } = useMemo(() => {
    let mn = Infinity, mx = -Infinity;
    const totals: number[] = [];
    const means: number[] = [];
    const perMin: number[] = [];
    const perMax: number[] = [];
    for (const s of series) {
      let tot = 0;
      let sum = 0;
      let smn = Infinity, smx = -Infinity;
      for (const k of Object.keys(s.counts)) {
        const v = Number(k);
        const c = s.counts[k];
        tot += c;
        sum += v * c;
        if (v < mn) mn = v;
        if (v > mx) mx = v;
        if (v < smn) smn = v;
        if (v > smx) smx = v;
      }
      totals.push(tot);
      means.push(tot > 0 ? sum / tot : 0);
      perMin.push(Number.isFinite(smn) ? smn : 0);
      perMax.push(Number.isFinite(smx) ? smx : 0);
    }
    if (!Number.isFinite(mn)) { mn = 0; mx = 0; }
    // values[si][v] = PDF 值 or CDF 值，按 yMode(percent/count) 输出原始尺度
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
    return { xMin: mn, xMax: mx, yMax: ymx || 1, totals, values, means, perMin, perMax };
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

  return (
    <div className="scramble-hist-wrapper">
      <svg width={W} height={H} className="scramble-hist">
        {/* Y grid + ticks */}
        {yTicks.map((v, i) => {
          const y = PAD.t + chartH - (v / yMax) * chartH;
          return (
            <g key={`y${i}`}>
              <line x1={PAD.l} x2={PAD.l + chartW} y1={y} y2={y} stroke="#E5E4DF" strokeDasharray="2,3" />
              <text x={PAD.l - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#6F6E6B">{fmtY(v)}</text>
            </g>
          );
        })}
        {/* X ticks */}
        {Array.from({ length: nBins }, (_, i) => xMin + i).map((v, i) => {
          const x = PAD.l + i * slotW + slotW / 2;
          return (
            <g key={`x${v}`}>
              <line x1={x} x2={x} y1={PAD.t + chartH} y2={PAD.t + chartH + 4} stroke="#CCCAC2" />
              <text x={x} y={PAD.t + chartH + 18} textAnchor="middle" fontSize="12" fill="#181716">{v}</text>
            </g>
          );
        })}
        {/* X/Y 轴线 */}
        <line x1={PAD.l} x2={PAD.l + chartW} y1={PAD.t + chartH} y2={PAD.t + chartH} stroke="#CCCAC2" />
        <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + chartH} stroke="#CCCAC2" />
        {/* Bars (PDF 或 CDF 都用 rect — CDF 就是单调递增的 "楼梯" ) */}
        {series.map((s, si) => (
          <g key={`s${si}`}>
            {Array.from({ length: nBins }, (_, i) => xMin + i).map((v, bi) => {
              const yVal = values[si][v] ?? 0;
              if (yVal <= 0) return null;
              const h = (yVal / yMax) * chartH;
              const x = PAD.l + bi * slotW + slotPadL + si * barW;
              return (
                <rect
                  key={`b${si}_${v}`}
                  x={x}
                  y={PAD.t + chartH - h}
                  width={Math.max(barW - 1, 0.5)}
                  height={h}
                  fill={s.color}
                  stroke={s.stroke}
                  strokeWidth={s.stroke ? 1 : 0}
                  opacity={series.length > 1 ? 0.82 : 0.92}
                />
              );
            })}
          </g>
        ))}
        {/* 柱上方标签（单 series）。PDF: 计数 + 百分比；CDF: 累积计数 + 累积百分比 */}
        {showLabels && Array.from({ length: nBins }, (_, i) => xMin + i).map((v, bi) => {
          const s = series[0];
          const yVal = values[0][v] ?? 0;
          if (yVal <= 0) return null;
          const h = (yVal / yMax) * chartH;
          const cx = PAD.l + bi * slotW + slotW / 2;
          const topY = PAD.t + chartH - h - 6;
          const tot = totals[0] || 1;
          // PDF: 这一格的 count / 这一格占比
          // CDF: 累积 count / 累积占比
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
              <text x={cx} y={topY - 12} textAnchor="middle" fontSize="10" fill="#181716">{fmtCount(countDisp)}</text>
              <text x={cx} y={topY} textAnchor="middle" fontSize="10" fill="#6F6E6B">{fmtPct(pctDisp)}</text>
            </g>
          );
        })}
        {/* Legend — name + avg / min / max */}
        {series.map((s, i) => {
          const rowH = 32;
          const y0 = PAD.t + 4 + i * rowH;
          return (
            <g key={`lg${i}`}>
              <rect x={PAD.l + chartW + 16} y={y0} width={12} height={12} fill={s.color} stroke={s.stroke} strokeWidth={s.stroke ? 1 : 0} />
              <text x={PAD.l + chartW + 32} y={y0 + 10} fontSize="12" fill="#181716">{s.name}</text>
              <text x={PAD.l + chartW + 32} y={y0 + 24} fontSize="11" fill="#6F6E6B">
                avg {means[i].toFixed(2)} · min {perMin[i]} · max {perMax[i]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
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
