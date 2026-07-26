'use client';

import { useId, useMemo } from 'react';
import { tr } from '@/i18n/tr';
import './DiscreteHistogram.css';

export interface HistSeries {
  name: string;
  // NOTE: fillColors = 用于竖向渐变的色序（WCA 颜色自上而下）。长度 1 时退化为单色带描边
  fillColors: string[];
  stroke?: string;
  counts: Record<string, number>;
  // NOTE: 设置后图例可点击，用于循环切换颜色（single/dual/quad 模式）
  onLegendClick?: () => void;
  legendHint?: string;
  // ── 精确穷举分布专用（见 _data/exact_dist.ts）─────────────────────────
  // 那批数据的计数超 Number.MAX_SAFE_INTEGER 三个数量级（双色底 XCross d=7 是
  // 25,284,688,565,714,070,184），counts 里只能放丢了精度的近似值 —— 仅用于定 x 轴范围。
  // 真正的比例/标签/总数走下面三个字段，全部在数据层用 BigInt 算好再传进来。
  ratios?: Record<string, number>;   // 归一化占比（0..1），有它就不再 raw/total
  exactLabel?: Record<string, string>; // 柱顶计数文字（已带千分位）
  exactTotal?: string;                 // 图例「共 N」
  // NOTE: 画成虚线描边而非实心柱，且不参与并排分槽 —— 用于把理论分布套在真题实心柱外面，
  // 两者重合时一眼可见。设了它的 series 不计入 barW 的等分。
  outline?: boolean;
}

interface Props {
  series: HistSeries[];
  isZh?: boolean;
  yMode?: 'count' | 'percent';
  chartMode?: 'pdf' | 'cdf';
  // NOTE: 稀有 bin (极端步数) 可点击查看具体 scramble；当前选中的 bin 会被高亮
  clickableBins?: number[];
  selectedBin?: number | null;
  onBarClick?: (bin: number) => void;
  // NOTE: PDF/CDF 切换(图例右上小按钮)。%/count 切换挪到 y 轴刻度区点击(见下 onYModeToggle)。
  onChartModeToggle?: () => void;
  // NOTE: 点击 y 轴区域(刻度标签 + 轴线那条竖带)触发 %/计数 切换 —— 无独立按钮,靠 hover 提亮提示可点。
  onYModeToggle?: () => void;
  // NOTE: 图例最顶的 Set 下拉(通常只有 WCA 一项,留着给未来多打乱集)
  setOptions?: { value: string; label: string }[];
  activeSet?: string;
  onSetChange?: (v: string) => void;
  // NOTE: 隐藏图例里的颜色 chip(外部已有底色 picker 时避免重复)
  hideLegendColors?: boolean;
  // NOTE: 自定义 x 轴刻度文案(默认 String(v));用于把折叠的尾部 bin 标成 "N+" 等
  formatBin?: (v: number) => string;
  // NOTE: 强制开/关柱顶 计数+百分比 标签(默认仅单 series 时显示);bin 很多时关掉避免横向重叠
  showBarLabels?: boolean;
  // NOTE: 稀疏整数轴(中间有空档 bin)。开启后 x 标签只标有数据的 bin(抽稀)、命中区填满空档。
  gapAware?: boolean;
  // NOTE: 图内均值 / 中位数标注(竖虚线 + 底部文字),替代外部单独的「摘要统计」卡片。
  meanValue?: number;
  meanLabel?: string;
  medianValue?: number;
  medianLabel?: string;
  // NOTE: 图内样本总数(图例区,PDF 钮下),替代外部单独的「N 条样本」文字行。总数由 series 自身
  // 求和得出(与柱子同源,永不失配),多 series 时语义不明 → 只在单 series 时出。
  showTotal?: boolean;
  // NOTE: 总数的量词 —— 「共 N」里的 N 到底数的是什么。同一页里不同图的分母口径可能不同
  // (全空间状态 / 子问题的子状态 / 某个子集),光秃秃一个「共 378」会被读成 378 个魔方状态。
  // 不传则退回中性的「共 N」。
  totalUnit?: { zh: string; en: string };
  // NOTE: 对数 y 轴。精确穷举分布跨 10 个数量级(51% ↔ 4.7e-9%),线性轴下两端的极小档
  // 柱高不足 1px,整条尾巴看不见。仅在能定出有效对数区间时生效(全零/单点自动退回线性)。
  logY?: boolean;
}

const W = 760, H = 400;

export default function DiscreteHistogram({ series, yMode = 'percent', chartMode = 'pdf', clickableBins, selectedBin, onBarClick, onChartModeToggle, onYModeToggle, setOptions, activeSet, onSetChange, hideLegendColors, formatBin, showBarLabels, gapAware, meanValue, meanLabel, medianValue, medianLabel, showTotal = true, totalUnit, logY }: Props) {
  const clickableSet = useMemo(() => new Set(clickableBins ?? []), [clickableBins]);
  // NOTE: 图例放在图表左上空白区（0..low-count 的柱子永远很矮），不再占右边 pad
  // 均值/中位数标注需要底部多留一行,两者都传时再加宽 b。
  const hasAnnRow2 = meanValue != null && medianValue != null;
  const PAD = { l: 56, r: 20, t: 40, b: meanValue != null || medianValue != null ? (hasAnnRow2 ? 58 : 44) : 44 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
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
        // ratios 优先(精确穷举分布):比例已在数据层用 BigInt 算好,不能再走 raw/tot ——
        // 那条路上的 raw 是丢了精度的近似值。count 模式无精确口径,退回近似 raw 仅作视觉。
        const pdf = yMode === 'percent'
          ? (s.ratios ? (s.ratios[String(v)] ?? 0) : raw / tot)
          : raw;
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
  // 描边 series(理论分布)套在实心柱外面,不占并排槽位 —— 只有实心的参与等分。
  const solidIdx = series.map((s, i) => (s.outline ? -1 : i)).filter((i) => i >= 0);
  const barW = slotInnerW / Math.max(solidIdx.length, 1);

  // 对数 y 轴的区间。取所有 series 的最小正值到峰值,跨度不足一个数量级就退回线性 ——
  // 否则 log 轴反而把差异压平。
  const logDomain = (() => {
    if (!logY) return null;
    let mn = Infinity;
    for (const vs of values) {
      for (const k of Object.keys(vs)) {
        const v = vs[Number(k)];
        if (v > 0 && v < mn) mn = v;
      }
    }
    if (!Number.isFinite(mn) || mn <= 0 || yMax <= 0) return null;
    const lo = Math.floor(Math.log10(mn)), hi = Math.ceil(Math.log10(yMax));
    return hi - lo >= 1 ? { lo, hi } : null;
  })();
  /** 值 → 0..1 的高度比例。线性即 v/yMax;对数走 log10 区间归一。 */
  const yFrac = (v: number) => {
    if (v <= 0) return 0;
    if (!logDomain) return v / yMax;
    return Math.max(0, (Math.log10(v) - logDomain.lo) / (logDomain.hi - logDomain.lo));
  };

  // gapAware:稀疏整数轴(如姓名「字符长度」,中间有空档长度无人)。
  //   ① x 轴只标有数据的 bin(贪心 ~24px 间距抽稀),不标空档(否则标了点不动);
  //   ② 命中区按相邻有数据 bin 的中点扩展,填满空档,稀疏柱也好点。
  // 非 gapAware(打乱页):每个 bin 都标,命中区=单格宽 —— 原行为不变。
  const xLabelSet = new Set<number>();
  const hitSpans = new Map<number, { x: number; w: number }>();
  if (gapAware) {
    const popIdx: number[] = [];
    for (let i = 0; i < nBins; i++) {
      const v = xMin + i;
      if (series.some((s) => (s.counts[String(v)] ?? 0) > 0)) popIdx.push(i);
    }
    let lastLabelX = -Infinity;
    for (let p = 0; p < popIdx.length; p++) {
      const i = popIdx[p];
      const cx = PAD.l + i * slotW + slotW / 2;
      if (cx - lastLabelX >= 24) { xLabelSet.add(xMin + i); lastLabelX = cx; }
      // 命中区:左右各扩到与相邻有数据 bin 的中点(端点用自身格边)
      const left = p > 0 ? PAD.l + ((popIdx[p - 1] + i) / 2 + 0.5) * slotW : PAD.l + i * slotW;
      const right = p < popIdx.length - 1 ? PAD.l + ((i + popIdx[p + 1]) / 2 + 0.5) * slotW : PAD.l + (i + 1) * slotW;
      hitSpans.set(xMin + i, { x: left, w: right - left });
    }
  }

  const yTicks: number[] = [];
  if (logDomain) {
    for (let e = logDomain.lo; e <= logDomain.hi; e++) yTicks.push(Math.pow(10, e));
  } else {
    const yStep = niceStep(yMax, 5);
    for (let v = 0; v <= yMax * 1.01; v += yStep) yTicks.push(v);
  }

  const fmtY = (v: number) => {
    if (yMode !== 'percent') return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v));
    const p = v * 100;
    // 对数轴上刻度是 10 的幂,小到 1e-7% —— 定宽小数位会全印成 0%
    if (logDomain && p > 0 && p < 0.01) return `${p.toExponential(0)}%`;
    return `${p.toFixed(v < 0.01 ? 2 : v < 0.1 ? 1 : 0)}%`;
  };

  // 柱顶计数:千万级以上改紧凑写法,否则 15 位数字(魔表全空间精确计数)会横向撞成一片。
  const fmtCount = (n: number) => (n >= 1e7 ? compactNum(n) : n.toLocaleString());
  const fmtPct = (p: number) => {
    if (p === 0) return '0%';
    // 概率 < 1% 时改写成 1/N 频率(分子恒为 1),取 2 位有效数字避免长尾噪声;
    // 分母用紧凑写法(960,000 → 960k)避免窄柱上标签横向重叠。
    if (p < 0.01) {
      const n = 1 / p;
      const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) - 1));
      const denom = Math.round(n / mag) * mag;
      return `1/${compactNum(denom)}`;
    }
    return `${(p * 100).toFixed(1)}%`;
  };

  // 叠加对照(实心真题 + 描边理论)算「单条」—— 标签仍描述实心那条,不该因为多套了个轮廓就消失。
  const showLabels = showBarLabels ?? (solidIdx.length === 1);
  // 柱多→格窄,标签字号自适应缩小,避免相邻 1/N 标签横向撞在一起。
  const labelFont = slotW < 22 ? 7.5 : slotW < 28 ? 8.5 : slotW < 36 ? 9.5 : 10;

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
          const y = PAD.t + chartH - yFrac(v) * chartH;
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
              {(!gapAware || xLabelSet.has(v)) && (
                <text x={x} y={PAD.t + chartH + 18} textAnchor="middle" fontSize="12" style={{ fill: 'var(--text)' }}>{formatBin ? formatBin(v) : v}</text>
              )}
            </g>
          );
        })}
        {/* X/Y 轴线 */}
        <line x1={PAD.l} x2={PAD.l + chartW} y1={PAD.t + chartH} y2={PAD.t + chartH} style={{ stroke: 'var(--border-strong)' }} />
        <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + chartH} style={{ stroke: 'var(--border-strong)' }} />
        {/* y 轴可点竖带(刻度标签 + 轴线):点它切换 %/计数 —— 放在标签之上以接住点击 */}
        {onYModeToggle && (
          <rect
            className="scramble-hist-yaxis-hit"
            x={0}
            y={PAD.t}
            width={PAD.l}
            height={chartH}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onClick={onYModeToggle}
          >
            <title>{yMode === 'percent' ? tr({ zh: '点击切换数量', en: 'Click to switch to count' }) : tr({ zh: '点击切换百分比', en: 'Click to switch to percent' })}</title>
          </rect>
        )}
        {/* Bars */}
        {series.map((s, si) => (
          <g key={`s${si}`}>
            {Array.from({ length: nBins }, (_, i) => xMin + i).map((v, bi) => {
              const yVal = values[si][v] ?? 0;
              if (yVal <= 0) return null;
              const h = yFrac(yVal) * chartH;
              // 描边 series 铺满整格内宽(套住下方所有实心柱);实心 series 按自己的槽位并排。
              const slotOrder = solidIdx.indexOf(si);
              const x = s.outline ? PAD.l + bi * slotW + slotPadL : PAD.l + bi * slotW + slotPadL + slotOrder * barW;
              const fill = s.outline ? 'none' : `url(#${gradIdFor(si)})`;
              const isClickable = clickableSet.has(v);
              const isSelected = selectedBin === v;
              const defaultStroke = s.stroke ?? (needsStroke(s.fillColors) ? '#d4d4d4' : undefined);
              const stroke = s.outline ? (s.stroke ?? 'var(--accent)') : (isSelected ? '#C15F3C' : defaultStroke);
              const strokeW = s.outline ? 1.6 : (isSelected ? 2 : (defaultStroke ? 1 : 0));
              const rectW = s.outline ? slotInnerW : Math.max(barW - 1, 0.5);
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
                  strokeDasharray={s.outline ? '3,2.5' : undefined}
                  opacity={s.outline ? 1 : (solidIdx.length > 1 ? 0.82 : 0.92)}
                  className={isClickable && !s.outline ? 'scramble-hist-bar-clickable' : undefined}
                  style={isClickable && onBarClick && !s.outline ? { cursor: 'pointer' } : undefined}
                  onClick={isClickable && onBarClick && !s.outline ? () => onBarClick(v) : undefined}
                  pointerEvents={s.outline ? 'none' : undefined}
                />
              );
            })}
          </g>
        ))}
        {/* 均值标注:竖虚线 + 底部文字(避开顶部柱状标签),替代外部单独卡片 */}
        {meanValue != null && meanValue >= xMin && meanValue <= xMax && (
          <g style={{ pointerEvents: 'none' }}>
            <line
              x1={PAD.l + (meanValue - xMin + 0.5) * slotW}
              x2={PAD.l + (meanValue - xMin + 0.5) * slotW}
              y1={PAD.t}
              y2={PAD.t + chartH}
              style={{ stroke: 'var(--accent)' }}
              strokeWidth={1.5}
              strokeDasharray="4,3"
            />
            <text
              x={PAD.l + (meanValue - xMin + 0.5) * slotW}
              y={PAD.t + chartH + (hasAnnRow2 ? 48 : 34)}
              textAnchor="middle"
              fontSize="10.5"
              fontWeight={600}
              style={{ fill: 'var(--accent)' }}
            >
              {meanLabel ?? `${tr({ zh: '平均', en: 'mean' })} ${meanValue.toFixed(2)}`}
            </text>
          </g>
        )}
        {/* 中位数标注:与均值同款,放上面一行(离图更近);离散整数轴上中位数必是某个已标数字的 bin,
            横轴刻度已经标过这个数,默认文案不再重复(除非调用方传 medianLabel 自定义,如组平均口径换算)。 */}
        {medianValue != null && medianValue >= xMin && medianValue <= xMax && (
          <g style={{ pointerEvents: 'none' }}>
            <line
              x1={PAD.l + (medianValue - xMin + 0.5) * slotW}
              x2={PAD.l + (medianValue - xMin + 0.5) * slotW}
              y1={PAD.t}
              y2={PAD.t + chartH}
              style={{ stroke: 'var(--signal-info)' }}
              strokeWidth={1.5}
              strokeDasharray="2,2"
            />
            <text
              x={PAD.l + (medianValue - xMin + 0.5) * slotW}
              y={PAD.t + chartH + 34}
              textAnchor="middle"
              fontSize="10.5"
              fontWeight={600}
              style={{ fill: 'var(--signal-info)' }}
            >
              {medianLabel ?? tr({ zh: '中位数', en: 'median' })}
            </text>
          </g>
        )}
        {/* 整列透明 hit-rect：边到边铺满整格(slotW，无列间间隙),覆盖柱子及下方 x 轴标签,
            点该列任意位置都能选中该 bin —— 跟「点 0~7 数字所在列」一致,不留死区。 */}
        {onBarClick && clickableBins && solidIdx.length === 1 && Array.from({ length: nBins }, (_, i) => xMin + i).map((v, bi) => {
          if (!clickableSet.has(v)) return null;
          // gapAware 时命中区扩到相邻有数据 bin 的中点(填满空档);否则单格宽。
          const span = gapAware ? hitSpans.get(v) : undefined;
          return (
            <rect
              key={`hit${v}`}
              x={span ? span.x : PAD.l + bi * slotW}
              y={PAD.t}
              width={span ? span.w : slotW}
              height={chartH + 18}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={() => onBarClick(v)}
            />
          );
        })}
        {/* 柱上方标签（单 series）。PDF: 计数 + 百分比；CDF: 累积计数 + 累积百分比 */}
        {showLabels && Array.from({ length: nBins }, (_, i) => xMin + i).map((v, bi) => {
          // 标签描述的是实心那条(描边 series 只是套在外面的理论轮廓,不另标数字)。
          const si0 = solidIdx[0] ?? 0;
          const s = series[si0];
          const yVal = values[si0][v] ?? 0;
          if (yVal <= 0) return null;
          const h = yFrac(yVal) * chartH;
          const cx = PAD.l + bi * slotW + slotW / 2;
          const topY = PAD.t + chartH - h - 6;
          const tot = totals[si0] || 1;
          let countText: string;
          let pctDisp: number;
          if (chartMode === 'cdf') {
            countText = fmtCount(Math.round(yMode === 'percent' ? yVal * tot : yVal));
            pctDisp = yMode === 'percent' ? yVal : yVal / tot;
          } else {
            const raw = s.counts[String(v)] ?? 0;
            // 精确穷举分布:计数超 Number 安全区,只能用数据层传来的字符串;比例同理走 ratios。
            countText = s.exactLabel?.[String(v)] ?? fmtCount(raw);
            pctDisp = s.ratios ? (s.ratios[String(v)] ?? 0) : raw / tot;
          }
          return (
            // pointer-events:none 让点到数字标签时穿透到下方整列 hit-rect,不挡选中。
            <g key={`lb${v}`} style={{ pointerEvents: 'none' }}>
              <text x={cx} y={topY - 12} textAnchor="middle" fontSize={labelFont} style={{ fill: 'var(--text)' }}>{countText}</text>
              <text x={cx} y={topY} textAnchor="middle" fontSize={labelFont} style={{ fill: 'var(--text-sub)' }}>{fmtPct(pctDisp)}</text>
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
        {!hideLegendColors && series.map((s, i) => {
          const chips = s.fillColors.length > 0 ? s.fillColors : ['#8B7D72'];
          const clickable = !!s.onLegendClick;
          return (
            <div
              key={`lg${i}`}
              className={`scramble-hist-legend-chips${clickable ? ' clickable' : ''}${chips.length === 4 ? ' is-quad' : ''}`}
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
        {onChartModeToggle && (
          <div className="scramble-hist-legend-toggles">
            <button
              className="scramble-hist-legend-btn"
              onClick={onChartModeToggle}
              title={`Switch to ${chartMode === 'pdf' ? 'CDF' : 'PDF'}`}
            >
              {chartMode === 'pdf' ? 'PDF' : 'CDF'}
            </button>
          </div>
        )}
        {showTotal && solidIdx.length === 1 && (
          <span className="scramble-hist-total">
            {(() => {
              // 分母认 exactTotal 那条,而不是"第一条实心" —— 叠加对照时实心柱是真题样本、
              // 描边才是理论分布,分母该报理论的状态空间(真题样本量在这个语境下不是分母)。
              // 精确穷举的状态空间超 Number 安全区,只能用数据层传来的字符串。
              const withExact = series.find((s) => s.exactTotal);
              const si0 = solidIdx[0] ?? 0;
              const n = withExact?.exactTotal ?? (totals[si0] ?? 0).toLocaleString();
              if (!totalUnit) return tr({ zh: `共 ${n}`, en: `${n} in total` });
              return tr({ zh: `共 ${n} ${totalUnit.zh}`, en: `${n} ${totalUnit.en}` });
            })()}
          </span>
        )}
      </div>
    </div>
  );
}

// NOTE: 渐变 stops —— 单色 → 一个 stop；多色 → 均分分布
// stop-color 走 style 而非属性,这样 colors 可传 CSS 变量(如 'var(--accent)');
// 属性形式的 stop-color 不解析 var(),style 形式(CSS 属性)才解析。
function gradientStops(colors: string[]) {
  if (colors.length === 0) return <stop offset="0%" style={{ stopColor: '#8B7D72' }} />;
  if (colors.length === 1) {
    return <stop offset="0%" style={{ stopColor: colors[0] }} />;
  }
  return colors.map((c, i) => {
    const offset = (i / (colors.length - 1)) * 100;
    return <stop key={i} offset={`${offset}%`} style={{ stopColor: c }} />;
  });
}

// NOTE: 白色/极浅色填充在 cream 背景上需要灰描边
function needsStroke(colors: string[]): boolean {
  return colors.some((c) => c.toUpperCase() === '#FFFFFF' || c.toUpperCase() === '#FEFE00');
}

// 紧凑数字:1000→1k、960000→960k、1500000→1.5M,用于窄柱上的 1/N 标签。
// 必须一路带到 P(10^15):魔表的分布是**全空间精确计数**(12^14 ≈ 1.28e15),只到 M 会写出
// 「1/1300000000000M」这种东西。
// [进位, 后缀, 取整阈值](阈值沿用原来的 k/M 口径,不动既有页面的写法)
const COMPACT_UNITS: readonly [number, string, number][] = [
  [1e15, 'P', 10], [1e12, 'T', 10], [1e9, 'B', 10], [1e6, 'M', 10], [1e3, 'k', 100],
];
function compactNum(n: number): string {
  for (const [scale, suffix, roundAt] of COMPACT_UNITS) {
    if (n >= scale) {
      const v = n / scale;
      return `${v >= roundAt ? Math.round(v) : v.toFixed(1).replace(/\.0$/, '')}${suffix}`;
    }
  }
  return n.toLocaleString();
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
