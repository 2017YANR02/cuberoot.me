// NOTE: 共用绘图工具函数
// 从 viz/viz.js 中提取的 Canvas 绘图函数，1:1 翻译为 TypeScript
// 所有函数接收 ctx 和参数，不读取全局变量

import type { KDEPoint, HistogramBin } from '../engine/kde';
import { pickNiceStep } from '../engine/kde';
import type { PlayerData } from '../engine/data_fetch';
import {
  playerHSL, getShiftedHSL, isFMC, isMBLD, fmtVal,
} from '../engine/data_fetch';

// ─── 类型 ───

export interface CurveOpts {
  fill?: string;
  stroke?: string;
  lineWidth?: number;
  glow?: boolean;
}

export interface MeanPosition {
  pi: number;
  mean: number;
  currentVal: number | null;
  name: string;
}

// ─── 网格绘制 ───

/**
 * NOTE: KDE/直方图模式的网格（X=成绩值，Y=密度）
 * 1:1 翻译自 viz.js drawGrid()
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  sx: (x: number) => number,
  sy: (y: number) => number,
  ml: number, mt: number, pw: number, ph: number,
  viewXMin: number, viewXMax: number,
  eventId: string,
): void {
  ctx.save();

  // NOTE: 基于可见范围（用户缩放后）计算刻度步长
  const range = viewXMax - viewXMin;
  const rawStep = range / 8;
  const niceStep = pickNiceStep(rawStep);

  const gridStart = Math.ceil(viewXMin / niceStep) * niceStep;

  // X 轴网格线
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = gridStart; x <= viewXMax; x += niceStep) {
    const px = Math.round(sx(x)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(px, mt);
    ctx.lineTo(px, mt + ph);
    ctx.stroke();
  }

  // X 轴标签（纯数字，单位放在轴标题）
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // NOTE: 根据步长决定小数位数
  const decimals = niceStep < 0.1 ? 2 : niceStep < 1 ? 1 : 0;
  for (let x = gridStart; x <= viewXMax; x += niceStep) {
    const label = isFMC(eventId) || isMBLD(eventId)
      ? Math.round(x) + ''
      : (decimals === 0 ? Math.round(x) + '' : x.toFixed(decimals));
    ctx.fillText(label, sx(x), mt + ph + 10);
  }

  // X 轴底线
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.moveTo(ml, mt + ph + 0.5);
  ctx.lineTo(ml + pw, mt + ph + 0.5);
  ctx.stroke();

  // "Density" 标签（Y 轴）
  ctx.save();
  ctx.translate(16, mt + ph / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Density', 0, 0);
  ctx.restore();

  // "Solve time" 标签（X 轴）
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    isFMC(eventId) ? 'Moves' : isMBLD(eventId) ? 'Score (pts)' : 'Solve time (s)',
    ml + pw / 2, mt + ph + 35,
  );

  ctx.restore();
}

/**
 * NOTE: 折线图专用网格 — X=把数，Y=成绩值
 * 1:1 翻译自 viz.js drawLineGrid()
 * 原版使用 arguments[9]/[10] 隐式参数，这里改为显式参数 visStart/visEnd
 */
export function drawLineGrid(
  ctx: CanvasRenderingContext2D,
  lsx: (x: number) => number,
  lsy: (y: number) => number,
  ml: number, mt: number, pw: number, ph: number,
  yMin: number, yMax: number,
  totalSolves: number,
  eventId: string,
  visStart: number,
  visEnd: number,
): void {
  ctx.save();

  // Y 轴网格线（成绩刻度）
  const yRange = yMax - yMin;
  const yRawStep = yRange / 6;
  const yMag = Math.pow(10, Math.floor(Math.log10(yRawStep)));
  const yRes = yRawStep / yMag;
  const yStep = yRes <= 1.5 ? yMag : yRes <= 3.5 ? 2 * yMag : yRes <= 7.5 ? 5 * yMag : 10 * yMag;
  const yStart = Math.ceil(yMin / yStep) * yStep;

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let y = yStart; y <= yMax; y += yStep) {
    const py = Math.round(lsy(y)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(ml, py);
    ctx.lineTo(ml + pw, py);
    ctx.stroke();
  }

  // Y 轴标签
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let y = yStart; y <= yMax; y += yStep) {
    const label = isFMC(eventId) || isMBLD(eventId)
      ? Math.round(y) + ''
      : (yStep >= 1 ? Math.round(y) + '' : y.toFixed(1));
    ctx.fillText(label, ml - 6, lsy(y));
  }

  // X 轴底线
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.moveTo(ml, mt + ph + 0.5);
  ctx.lineTo(ml + pw, mt + ph + 0.5);
  ctx.stroke();

  // X 轴标签（把数）
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  // NOTE: 根据可见范围动态调整刻度间距
  const vs = visStart || 1;
  const ve = visEnd || totalSolves;
  const visRange = ve - vs;
  const xRawStep = visRange / 8;
  const xMag = Math.pow(10, Math.floor(Math.log10(Math.max(1, xRawStep))));
  const xRes = xRawStep / xMag;
  const xStep = xRes <= 1.5 ? xMag : xRes <= 3.5 ? 2 * xMag : xRes <= 7.5 ? 5 * xMag : 10 * xMag;
  const xTickStart = Math.ceil(vs / xStep) * xStep;
  for (let x = xTickStart; x <= ve; x += xStep) {
    ctx.fillText(Math.round(x) + '', lsx(x), mt + ph + 10);
  }

  // 轴标签
  ctx.save();
  ctx.translate(16, mt + ph / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isFMC(eventId) ? 'Moves' : isMBLD(eventId) ? 'Score (pts)' : 'Solve time (s)', 0, 0);
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Solve #', ml + pw / 2, mt + ph + 35);

  ctx.restore();
}

// ─── KDE 曲线 ───

/**
 * NOTE: 绘制 KDE 曲线（填充 + 描边 + 可选 glow）
 * 1:1 翻译自 viz.js drawCurve()
 */
export function drawCurve(
  ctx: CanvasRenderingContext2D,
  points: KDEPoint[],
  sx: (x: number) => number,
  sy: (y: number) => number,
  opts: CurveOpts,
): void {
  ctx.save();

  // 填充区域
  ctx.beginPath();
  ctx.moveTo(sx(points[0].x), sy(0));
  for (const p of points) {
    ctx.lineTo(sx(p.x), sy(p.y));
  }
  ctx.lineTo(sx(points[points.length - 1].x), sy(0));
  ctx.closePath();

  if (opts.fill) {
    ctx.fillStyle = opts.fill;
    ctx.fill();
  }

  // 描边（只画曲线部分，不含底部连线）
  if (opts.stroke) {
    ctx.beginPath();
    ctx.moveTo(sx(points[0].x), sy(points[0].y));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(sx(points[i].x), sy(points[i].y));
    }

    if (opts.glow) {
      // NOTE: glow 颜色跟随 stroke，多选手时各自颜色
      ctx.shadowColor = opts.stroke;
      ctx.shadowBlur = 12;
    }

    ctx.strokeStyle = opts.stroke;
    ctx.lineWidth = opts.lineWidth || 1;
    ctx.stroke();
  }

  ctx.restore();
}

// ─── 均值线 ───

/**
 * NOTE: 绘制垂直均值线
 * 1:1 翻译自 viz.js drawMeanLine()
 */
export function drawMeanLine(
  ctx: CanvasRenderingContext2D,
  sx: (x: number) => number,
  mt: number, ph: number,
  meanVal: number,
  color: string,
  dashed: boolean,
): void {
  const px = sx(meanVal);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  if (dashed) ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(px, mt);
  ctx.lineTo(px, mt + ph);
  ctx.stroke();
  ctx.restore();
}

// ─── 直方图柱 ───

/**
 * NOTE: 绘制直方图柱
 * 1:1 翻译自 viz.js drawHistogram()
 */
export function drawHistogramBars(
  ctx: CanvasRenderingContext2D,
  bins: HistogramBin[],
  sx: (x: number) => number,
  sy: (y: number) => number,
  pi: number,
  useDensity: boolean,
  players: PlayerData[],
  eventId: string,
): void {
  if (!bins || bins.length === 0) return;
  ctx.save();
  const midX = (bins[0].xStart + bins[bins.length - 1].xEnd) / 2;
  const fillColor = getShiftedHSL(pi, 0.25, midX, players, eventId);
  const strokeColor = getShiftedHSL(pi, 0.5, midX, players, eventId);
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1;

  const baseline = sy(0);
  for (const b of bins) {
    if (b.count === 0) continue;
    const val = useDensity ? b.density : b.count;
    const x1 = sx(b.xStart);
    const x2 = sx(b.xEnd);
    const top = sy(val);
    const w = x2 - x1;
    const h = baseline - top;
    ctx.fillRect(x1, top, w, h);
    ctx.strokeRect(x1, top, w, h);

    // 频次标注（仅足够宽的柱子）
    if (w > 16 && b.count >= 2) {
      ctx.save();
      ctx.fillStyle = getShiftedHSL(pi, 0.8, (b.xStart + b.xEnd) / 2, players, eventId);
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(b.count), (x1 + x2) / 2, top - 3);
      ctx.restore();
    }
  }
  ctx.restore();
}

// ─── 折线图绘制 ───

/**
 * NOTE: 折线图绘制 — 每位选手一条折线
 * 1:1 翻译自 viz.js drawLineChart()
 */
export function drawLineChart(
  ctx: CanvasRenderingContext2D,
  times: (number | null)[],
  lsx: (x: number) => number,
  lsy: (y: number) => number,
  pi: number,
  activePlayerIdx: number,
  cutoff: number,
  ch: number,
  players: PlayerData[],
  eventId: string,
): void {
  if (!times || times.length < 2) return;
  ctx.save();

  const validTimes = times.filter(t => t !== null) as number[];
  if (validTimes.length === 0) { ctx.restore(); return; }
  const m = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
  const color = getShiftedHSL(pi, 0.85, m, players, eventId);
  const dimColor = getShiftedHSL(pi, 0.2, m, players, eventId);
  const fillColor = getShiftedHSL(pi, 0.08, m, players, eventId);
  // NOTE: cutoff < 0 表示全量高亮
  const effectiveCutoff = cutoff >= 0 ? cutoff : times.length;

  // 半透明填充区域（只填充到 cutoff）
  const MARGIN = { top: 50, right: 40, bottom: 55, left: 65 };
  const _mt = MARGIN.top;
  const _ph = ch - _mt - MARGIN.bottom;
  const bottomPy = _mt + _ph;
  ctx.beginPath();
  let started = false;
  const fillEnd = Math.min(effectiveCutoff, times.length);
  for (let i = 0; i < fillEnd; i++) {
    if (times[i] === null) continue;
    const px = lsx(i + 1);
    const py = lsy(times[i]!);
    if (!started) { ctx.moveTo(px, py); started = true; }
    else ctx.lineTo(px, py);
  }
  if (started) {
    let lastValid = -1, firstValid = -1;
    for (let i = fillEnd - 1; i >= 0; i--) { if (times[i] !== null) { lastValid = i; break; } }
    for (let i = 0; i < fillEnd; i++) { if (times[i] !== null) { firstValid = i; break; } }
    ctx.lineTo(lsx(lastValid + 1), bottomPy);
    ctx.lineTo(lsx(firstValid + 1), bottomPy);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
  }

  // 前段折线（亮色）
  ctx.beginPath();
  started = false;
  for (let i = 0; i < fillEnd; i++) {
    if (times[i] === null) continue;
    const px = lsx(i + 1);
    const py = lsy(times[i]!);
    if (!started) { ctx.moveTo(px, py); started = true; }
    else ctx.lineTo(px, py);
  }
  if (pi === activePlayerIdx) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = pi === activePlayerIdx ? 1.8 : 1.2;
  ctx.stroke();

  // 后段折线（淡色，只在播放中且有未播放数据时绘制）
  if (cutoff >= 0 && effectiveCutoff < times.length) {
    ctx.beginPath();
    started = false;
    for (let i = Math.max(0, effectiveCutoff - 1); i < times.length; i++) {
      if (times[i] === null) continue;
      const px = lsx(i + 1);
      const py = lsy(times[i]!);
      if (!started) { ctx.moveTo(px, py); started = true; }
      else ctx.lineTo(px, py);
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.strokeStyle = dimColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}

// ─── 均值标签 ───

/**
 * NOTE: 多选手均值标签 — 直接在 Canvas 上绘制
 * 1:1 翻译自 viz.js drawMeanLabelsOnCanvas()
 */
export function drawMeanLabelsOnCanvas(
  ctx: CanvasRenderingContext2D,
  sx: (x: number) => number,
  mt: number,
  meanPositions: MeanPosition[],
  players: PlayerData[],
  showLayers: { currentVal: boolean; meanLine: boolean },
  eventId: string,
): void {
  ctx.save();
  ctx.textBaseline = 'bottom';
  ctx.font = '600 12px "JetBrains Mono", monospace';

  for (const mp of meanPositions) {
    const namePrefix = players.length > 1 ? mp.name.slice(0, 3) + ' ' : '';
    // NOTE: 行偏移避免多选手重叠
    const row = mp.pi * 16;

    // 1. 均值线标签 —— 圆形贴在均值线顶端
    if (showLayers.meanLine) {
      const meanPx = sx(mp.mean);
      const meanLabel = namePrefix + fmtVal(mp.mean, eventId);
      const meanY = mt - 10 - row;
      ctx.fillStyle = playerHSL(mp.pi, 0.7);
      ctx.beginPath();
      ctx.arc(meanPx, meanY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.fillText(meanLabel, meanPx + 8, meanY + 4);
    }

    // 2. 当前值标签 —— 菱形贴在当前值线顶端
    if (showLayers.currentVal && mp.currentVal !== null && mp.currentVal !== undefined) {
      const valPx = sx(mp.currentVal);
      const valLabel = namePrefix + fmtVal(mp.currentVal, eventId);
      const valY = mt - 26 - row;
      ctx.fillStyle = playerHSL(mp.pi, 0.95);
      ctx.beginPath();
      ctx.moveTo(valPx, valY - 5);
      ctx.lineTo(valPx + 4, valY);
      ctx.lineTo(valPx, valY + 5);
      ctx.lineTo(valPx - 4, valY);
      ctx.closePath();
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.fillText(valLabel, valPx + 8, valY + 4);
    }
  }
  ctx.restore();
}
