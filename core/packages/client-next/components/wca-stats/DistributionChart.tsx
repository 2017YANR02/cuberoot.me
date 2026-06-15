'use client';

// NOTE: 分布图组件——直方图 / KDE / 箱型图（SVG）
// 从 legacy distribution_chart.js 移植为 React 组件
// 架构改进：数据从 props 传入（非 DOM 解析），类型安全
import React, { useState, useRef, useCallback, useMemo } from 'react';
import { tr } from '@/i18n/tr';

// ── 颜色板 — 最多 10 名选手同时显示（Claude 暖色系）──
const COLORS = [
  '#d97757', '#7eb8c4', '#e8b97a', '#6bcb8e', '#c084fc',
  '#e85d75', '#5ab8d4', '#f0a060', '#a3e635', '#e879f9',
];

export interface DistDataset {
  name: string;
  times: number[];  // NOTE: 秒数（从 formatted string parseFloat 得到）
  color?: string;
}

interface Props {
  datasets: DistDataset[];
  isZh?: boolean;
}

// ── 默认配置 ──
const W = 700, H = 340;
const PAD = { l: 50, r: 140, t: 20, b: 50 };
const chartW = W - PAD.l - PAD.r;
const chartH = H - PAD.t - PAD.b;
const MIN_DATA_POINTS = 5;

type Mode = 'histogram' | 'kde' | 'boxplot';

/**
 * NOTE: Freedman–Diaconis 自动 bin 宽度
 */
function autoBinWidth(allTimes: number[]): number {
  if (allTimes.length < 2) return 0.2;
  const sorted = allTimes.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  let bw: number;
  if (iqr > 0) {
    bw = 2 * iqr * Math.pow(n, -1 / 3);
  } else {
    bw = (sorted[n - 1] - sorted[0]) > 0
      ? (sorted[n - 1] - sorted[0]) / Math.sqrt(n) : 0.2;
  }
  const range = sorted[n - 1] - sorted[0];
  if (range > 0) {
    const bins = Math.round(range / bw);
    if (bins < 5) bw = range / 5;
    if (bins > 50) bw = range / 50;
  }
  // NOTE: Nice number rounding
  const mag = Math.pow(10, Math.floor(Math.log10(bw)));
  const residual = bw / mag;
  if (residual <= 1.5) return mag;
  if (residual <= 3.5) return 2 * mag;
  if (residual <= 7.5) return 5 * mag;
  return 10 * mag;
}

function niceAxisTicks(min: number, max: number, targetCount: number): number[] {
  const range = max - min;
  if (range <= 0) return [min];
  const rawStep = range / targetCount;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const res = rawStep / mag;
  let step: number;
  if (res <= 1.5) step = mag;
  else if (res <= 3.5) step = 2 * mag;
  else if (res <= 7.5) step = 5 * mag;
  else step = 10 * mag;
  const ticks: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let v = start; v <= max; v += step) {
    ticks.push(Math.round(v * 1000) / 1000);
  }
  return ticks;
}

export default function DistributionChart({ datasets, isZh }: Props) {
  const [mode, setMode] = useState<Mode>('histogram');
  const [tooltipInfo, setTooltipInfo] = useState<{ text: string; x: number; y: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // NOTE: 分配颜色并过滤无效数据集
  const validSets = useMemo(() =>
    datasets
      .map((ds, i) => ({ ...ds, color: ds.color || COLORS[i % COLORS.length] }))
      .filter(ds => ds.times && ds.times.length >= MIN_DATA_POINTS),
    [datasets],
  );

  // NOTE: 全局范围 + bin 宽度
  const { binWidth, gMin, gMax } = useMemo(() => {
    const all = validSets.flatMap(ds => ds.times);
    if (all.length === 0) return { allTimes: [], binWidth: 0.2, gMin: 0, gMax: 1 };
    const bw = autoBinWidth(all);
    return {
      allTimes: all,
      binWidth: bw,
      gMin: Math.floor(Math.min(...all) / bw) * bw,
      gMax: Math.ceil(Math.max(...all) / bw) * bw,
    };
  }, [validSets]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGElement>) => {
    const target = e.target as SVGElement;
    const info = target.getAttribute('data-info');
    if (!info || !wrapperRef.current) {
      setTooltipInfo(null);
      return;
    }
    const cr = wrapperRef.current.getBoundingClientRect();
    setTooltipInfo({ text: info, x: e.clientX - cr.left + 12, y: e.clientY - cr.top - 30 });
  }, []);

  const handleMouseLeave = useCallback(() => setTooltipInfo(null), []);

  if (validSets.length === 0) return null;

  // ── SVG 内容生成 ──
  const elements: React.ReactNode[] = [];

  if (mode === 'histogram') {
    const binCount = Math.max(1, Math.round((gMax - gMin) / binWidth));
    const barW = chartW / binCount;
    const nP = validSets.length;
    const subBarW = Math.max(1, (barW - 2) / nP);

    const allBins = validSets.map(p => {
      const bins = new Array(binCount).fill(0);
      p.times.forEach(t => {
        const idx = Math.min(Math.floor((t - gMin) / binWidth), binCount - 1);
        bins[idx]++;
      });
      return bins;
    });

    let maxCount = 0;
    allBins.forEach(bins => bins.forEach(c => { if (c > maxCount) maxCount = c; }));
    if (maxCount === 0) maxCount = 1;

    // Grid + Y axis
    const step = maxCount <= 10 ? 2 : (maxCount <= 20 ? 4 : 5);
    for (let g = 0; g <= maxCount; g += step) {
      const gy = PAD.t + chartH - (g / maxCount) * chartH;
      elements.push(
        <line key={`gy-${g}`} x1={PAD.l} y1={gy} x2={PAD.l + chartW} y2={gy}
          stroke="rgba(255, 255, 255,0.08)" strokeWidth={1} />,
        <text key={`gyl-${g}`} x={PAD.l - 6} y={gy + 4} fill="#aaa" fontSize={12}
          textAnchor="end">{g}</text>,
      );
    }

    // Bars
    for (let si = 0; si < nP; si++) {
      const bins = allBins[si];
      for (let b = 0; b < binCount; b++) {
        if (bins[b] === 0) continue;
        const x = PAD.l + b * barW + 1 + si * subBarW;
        const barH = (bins[b] / maxCount) * chartH;
        const y = PAD.t + chartH - barH;
        const binStart = (gMin + b * binWidth).toFixed(1);
        const binEnd = (gMin + (b + 1) * binWidth).toFixed(1);
        elements.push(
          <rect key={`bar-${si}-${b}`}
            x={x} y={y} width={Math.max(1, subBarW - (nP > 1 ? 1 : 0))} height={barH}
            fill={validSets[si].color} fillOpacity={nP > 1 ? 0.7 : 0.85}
            rx={nP === 1 ? 3 : 1}
            style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
            data-info={`${validSets[si].name} | ${binStart}s–${binEnd}s: ${bins[b]}${tr({ zh: ' 次', en: '' })}`}
          />,
        );
        if (subBarW > 8 && (bins[b] >= 3 || nP === 1)) {
          elements.push(
            <text key={`bt-${si}-${b}`} x={x + subBarW / 2} y={y - 3}
              fill="#ededed" fontSize={10} textAnchor="middle">{bins[b]}</text>,
          );
        }
      }
    }

    // X axis labels
    const range = gMax - gMin;
    const tickStep = range > 5 ? 1.0 : 0.5;
    const tickStart = Math.ceil(gMin / tickStep) * tickStep;
    for (let tv = tickStart; tv <= gMax + 0.001; tv += tickStep) {
      const tx = PAD.l + ((tv - gMin) / (gMax - gMin)) * chartW;
      elements.push(
        <text key={`xt-${tv}`} x={tx} y={PAD.t + chartH + 18}
          fill="#aaa" fontSize={12} textAnchor="middle">{tv.toFixed(1)}</text>,
      );
    }

    // Axis labels
    elements.push(
      <text key="xlabel" x={PAD.l + chartW / 2} y={H - 5}
        fill="#8a7a6a" fontSize={13} textAnchor="middle">{tr({ zh: '时间 (秒)', en: 'Time (s)'
        })}</text>,
      <text key="ylabel" x={0} y={0} fill="#8a7a6a" fontSize={13} textAnchor="middle"
        transform={`translate(14,${PAD.t + chartH / 2}) rotate(-90)`}>{tr({ zh: '次数', en: 'Count'
        })}</text>,
    );

    // Mean lines
    validSets.forEach((p, si) => {
      const m = p.times.reduce((a, b) => a + b, 0) / p.times.length;
      const mx = PAD.l + ((m - gMin) / (gMax - gMin)) * chartW;
      elements.push(
        <line key={`mean-${si}`} x1={mx} y1={PAD.t} x2={mx} y2={PAD.t + chartH}
          stroke={p.color} strokeWidth={1.5} strokeDasharray="4,3" opacity={0.6} />,
      );
    });
  } else if (mode === 'kde') {
    const plotMin = gMin - 0.3, plotMax = gMax + 0.3;
    const STEPS = 200;

    // Grid
    for (let g = 0; g <= 5; g++) {
      const gy = PAD.t + chartH - (g / 5) * chartH;
      elements.push(
        <line key={`kgy-${g}`} x1={PAD.l} y1={gy} x2={PAD.l + chartW} y2={gy}
          stroke="rgba(255, 255, 255,0.08)" strokeWidth={1} />,
      );
    }

    // KDE curves
    const curves = validSets.map(p => {
      const m = p.times.reduce((a, b) => a + b, 0) / p.times.length;
      const std = Math.sqrt(p.times.reduce((s, v) => s + (v - m) * (v - m), 0) / p.times.length);
      const h = 1.06 * std * Math.pow(p.times.length, -0.2);
      const ys: number[] = [];
      for (let s = 0; s <= STEPS; s++) {
        const x = plotMin + (plotMax - plotMin) * s / STEPS;
        let density = 0;
        for (let i = 0; i < p.times.length; i++) {
          const u = (x - p.times[i]) / h;
          density += Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);
        }
        ys.push(density / (p.times.length * h));
      }
      return ys;
    });

    let maxD = 0;
    curves.forEach(ys => ys.forEach(d => { if (d > maxD) maxD = d; }));
    if (maxD === 0) maxD = 1;

    validSets.forEach((p, si) => {
      const ys = curves[si];
      // Fill
      let pathD = `M ${PAD.l} ${PAD.t + chartH}`;
      for (let s = 0; s <= STEPS; s++) {
        const px = PAD.l + (s / STEPS) * chartW;
        const py = PAD.t + chartH - (ys[s] / maxD) * chartH;
        pathD += ` L ${px.toFixed(1)} ${py.toFixed(1)}`;
      }
      pathD += ` L ${PAD.l + chartW} ${PAD.t + chartH} Z`;
      elements.push(<path key={`kfill-${si}`} d={pathD} fill={p.color} fillOpacity={0.12} />);

      // Stroke
      let lineD = '';
      for (let s = 0; s <= STEPS; s++) {
        const px = PAD.l + (s / STEPS) * chartW;
        const py = PAD.t + chartH - (ys[s] / maxD) * chartH;
        lineD += (s === 0 ? 'M ' : ' L ') + px.toFixed(1) + ' ' + py.toFixed(1);
      }
      elements.push(
        <path key={`kline-${si}`} d={lineD} fill="none" stroke={p.color} strokeWidth={2.5} />,
      );
    });

    // X axis labels
    const kdeRange = plotMax - plotMin;
    const kdeTickStep = kdeRange > 5 ? 1.0 : 0.5;
    const kdeTickStart = Math.ceil(plotMin / kdeTickStep) * kdeTickStep;
    for (let tv = kdeTickStart; tv <= plotMax + 0.001; tv += kdeTickStep) {
      const lx = PAD.l + ((tv - plotMin) / (plotMax - plotMin)) * chartW;
      elements.push(
        <text key={`kxt-${tv}`} x={lx} y={PAD.t + chartH + 18}
          fill="#aaa" fontSize={12} textAnchor="middle">{tv.toFixed(1)}</text>,
      );
    }

    // Axis labels
    elements.push(
      <text key="kxlabel" x={PAD.l + chartW / 2} y={H - 5}
        fill="#8a7a6a" fontSize={13} textAnchor="middle">{tr({ zh: '时间 (秒)', en: 'Time (s)'
        })}</text>,
      <text key="kylabel" x={0} y={0} fill="#8a7a6a" fontSize={13} textAnchor="middle"
        transform={`translate(14,${PAD.t + chartH / 2}) rotate(-90)`}>{tr({ zh: '密度', en: 'Density' })}</text>,
    );

    // Mean lines
    validSets.forEach((p, si) => {
      const m = p.times.reduce((a, b) => a + b, 0) / p.times.length;
      const mx = PAD.l + ((m - plotMin) / (plotMax - plotMin)) * chartW;
      elements.push(
        <line key={`kmean-${si}`} x1={mx} y1={PAD.t} x2={mx} y2={PAD.t + chartH}
          stroke={p.color} strokeWidth={1.5} strokeDasharray="4,3" opacity={0.6} />,
      );
    });
  } else {
    // Box plot
    const nP = validSets.length;
    const boxHeight = Math.max(20, Math.min(60, (chartH - 20) / nP));
    const gap = 10;
    const xScale = (v: number) => PAD.l + ((v - gMin) / (gMax - gMin)) * chartW;

    // Grid
    const xTicks = niceAxisTicks(gMin, gMax, 8);
    xTicks.forEach(val => {
      const x = xScale(val);
      elements.push(
        <line key={`bxg-${val}`} x1={x} y1={PAD.t} x2={x} y2={PAD.t + chartH}
          stroke="rgba(255, 255, 255,0.08)" strokeWidth={1} />,
        <text key={`bxl-${val}`} x={x} y={PAD.t + chartH + 16}
            fill="#a3a3a3" fontSize={11} textAnchor="middle">{val.toFixed(1)}</text>,
      );
    });

    for (let si = 0; si < nP; si++) {
      const times = validSets[si].times.slice().sort((a, b) => a - b);
      const n = times.length;
      if (n < 5) continue;
      const q1 = times[Math.floor(n * 0.25)];
      const median = times[Math.floor(n * 0.5)];
      const q3 = times[Math.floor(n * 0.75)];
      const iqr = q3 - q1;
      const whiskerLow = q1 - 1.5 * iqr;
      const whiskerHigh = q3 + 1.5 * iqr;
      const wLow = times.find(t => t >= whiskerLow) || times[0];
      let wHigh = times[n - 1];
      for (let j = n - 1; j >= 0; j--) {
        if (times[j] <= whiskerHigh) { wHigh = times[j]; break; }
      }
      const cy = PAD.t + si * (boxHeight + gap) + boxHeight / 2 + 10;
      const color = validSets[si].color!;

      elements.push(
        // Whisker line
        <line key={`bw-${si}`} x1={xScale(wLow)} y1={cy} x2={xScale(wHigh)} y2={cy}
          stroke={color} strokeWidth={1.5} />,
        // Left cap
        <line key={`blc-${si}`} x1={xScale(wLow)} y1={cy - boxHeight * 0.3}
          x2={xScale(wLow)} y2={cy + boxHeight * 0.3} stroke={color} strokeWidth={1.5} />,
        // Right cap
        <line key={`brc-${si}`} x1={xScale(wHigh)} y1={cy - boxHeight * 0.3}
          x2={xScale(wHigh)} y2={cy + boxHeight * 0.3} stroke={color} strokeWidth={1.5} />,
        // Box
        <rect key={`bbox-${si}`}
          x={xScale(q1)} y={cy - boxHeight * 0.35}
          width={Math.max(1, xScale(q3) - xScale(q1))}
          height={boxHeight * 0.7}
          fill={color} fillOpacity={0.25} stroke={color} strokeWidth={1.5} rx={3} />,
        // Median
        <line key={`bmed-${si}`} x1={xScale(median)} y1={cy - boxHeight * 0.35}
          x2={xScale(median)} y2={cy + boxHeight * 0.35} stroke="#ededed" strokeWidth={2} />,
      );

      // Outliers
      times.forEach((t, ti) => {
        if (t < whiskerLow || t > whiskerHigh) {
          elements.push(
            <circle key={`bout-${si}-${ti}`} cx={xScale(t)} cy={cy} r={3}
              fill="none" stroke={color} strokeWidth={1.5} opacity={0.7} />,
          );
        }
      });
    }

    // X axis
    elements.push(
      <line key="bxaxis" x1={PAD.l} y1={PAD.t + chartH} x2={PAD.l + chartW} y2={PAD.t + chartH}
        stroke="#6e6050" strokeWidth={1} />,
      <text key="bxlabel" x={PAD.l + chartW / 2} y={H - 6}
        fill="#a3a3a3" fontSize={13} textAnchor="middle">{tr({ zh: '时间 (秒)', en: 'Time (s)'
        })}</text>,
    );
  }

  // Legend + stats
  validSets.forEach((p, i) => {
    const lx = W - PAD.r + 10;
    const ly = PAD.t + 10 + i * (16 * 3 + 6);
    const mean = p.times.reduce((a, b) => a + b, 0) / p.times.length;
    const variance = p.times.reduce((s, v) => s + (v - mean) * (v - mean), 0) / p.times.length;
    const std = Math.sqrt(variance);
    let label = p.name;
    if (label.length > 10) label = label.substring(0, 9) + '…';

    elements.push(
      <rect key={`lr-${i}`} x={lx} y={ly} width={12} height={12} fill={p.color} rx={2} />,
      <text key={`ln-${i}`} x={lx + 16} y={ly + 10} fill="#e8ddd4" fontSize={12}
        textAnchor="start" fontWeight="bold">{label}</text>,
      <text key={`lm-${i}`} x={lx + 2} y={ly + 10 + 16} fill="#a3a3a3" fontSize={11}
        textAnchor="start">μ = {mean.toFixed(2)}s</text>,
      <text key={`ls-${i}`} x={lx + 2} y={ly + 10 + 32} fill="#a3a3a3" fontSize={11}
        textAnchor="start">σ = {std.toFixed(2)}s</text>,
    );
  });

  return (
    <div ref={wrapperRef} className="dist-chart-container" style={{ margin: '16px 0 32px', textAlign: 'center', position: 'relative' }}>
      {/* Mode toggle */}
      <div style={{ marginBottom: 8 }}>
        {(['histogram', 'kde', 'boxplot'] as Mode[]).map(m => (
          <button key={m}
            className={`wca-stats-tab ${mode === m ? 'active' : ''}`}
            style={{ margin: '0 2px', padding: '4px 14px', fontSize: 13 }}
            onClick={() => setMode(m)}
          >
            {m === 'histogram' ? tr({ zh: '直方图', en: 'Histogram'
                            })
              : m === 'kde' ? 'KDE'
              : tr({ zh: '箱线图', en: 'Box Plot'
                                    })}
          </button>
        ))}
      </div>

      {/* SVG Chart */}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
        style={{ background: '#201c18', borderRadius: 8, maxWidth: '100%', display: 'block', margin: '0 auto' }}
        onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}
      >
        {elements}
      </svg>

      {/* Tooltip */}
      {tooltipInfo && (
        <div style={{
          position: 'absolute', background: 'rgba(28,25,23,0.92)', color: '#ededed',
          padding: '6px 10px', borderRadius: 6, fontSize: 12, pointerEvents: 'none',
          whiteSpace: 'nowrap', zIndex: 10, border: '1px solid rgba(255, 255, 255,0.15)',
          left: tooltipInfo.x, top: tooltipInfo.y,
        }}>
          {tooltipInfo.text}
        </div>
      )}
    </div>
  );
}
