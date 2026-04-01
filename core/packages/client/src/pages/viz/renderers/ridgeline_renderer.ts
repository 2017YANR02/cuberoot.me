// NOTE: 脊线图渲染器
// 从 viz/ridgeline.js 全量 1:1 翻译为 TypeScript
// 改为接收参数而非读取全局变量（xMin, xMax, players 等）

import type { PlayerData } from '../engine/data_fetch';
import { rawToVal, isFMC, isMBLD } from '../engine/data_fetch';
import { silvermanBandwidth, gaussianKernel } from '../engine/kde';
import type { KDEPoint } from '../engine/kde';

// ─── 常量 ───
const RIDGE_KDE_POINTS = 150;
const RIDGE_MARGIN = { top: 30, right: 40, bottom: 45, left: 180 };
const ROW_HEIGHT = 32;
const OVERLAP_RATIO = 0.6;

// ─── 数据结构 ───
export interface RidgeGroup {
  label: string;
  compIdx: number;
  startIdx: number;
  endIdx: number;
  times: number[];
  validCount: number;
}

export interface RidgelineState {
  groups: RidgeGroup[];
  kdes: (KDEPoint[] | null)[];
  maxDensity: number;
  highlightRow: number;
}

/**
 * NOTE: 按比赛分组数据
 * 1:1 翻译自 ridgeline.js buildGroups()
 * 改进：使用 rawToVal 而非硬编码 /100
 */
export function buildGroups(
  player: PlayerData,
  eventId: string,
): RidgeGroup[] {
  const groups: RidgeGroup[] = [];
  const minSolves = 10;
  const cd = player.channelData;
  const comps = player.competitions;

  let currentGroup: RidgeGroup | null = null;

  for (let i = 0; i < cd.length; i++) {
    const compIdx = cd[i][1];
    const compName = comps[compIdx];

    if (!currentGroup || currentGroup.compIdx !== compIdx) {
      if (currentGroup) {
        if (currentGroup.validCount >= minSolves) {
          groups.push(currentGroup);
          currentGroup = null;
        }
      }

      if (!currentGroup) {
        currentGroup = {
          label: compName,
          compIdx: compIdx,
          startIdx: i,
          endIdx: i,
          times: [],
          validCount: 0,
        };
      }
    }

    currentGroup.endIdx = i;
    currentGroup.compIdx = compIdx;

    if (cd[i][0] > 0) {
      // NOTE: 使用 rawToVal 而非原版硬编码 cd[i][0] / 100
      currentGroup.times.push(rawToVal(cd[i][0], eventId));
      currentGroup.validCount++;
    }
  }

  if (currentGroup && currentGroup.validCount >= 3) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * NOTE: 计算所有组的 KDE
 * 1:1 翻译自 ridgeline.js computeAllKDEs()
 */
export function computeAllKDEs(
  groups: RidgeGroup[],
  xMinVal: number,
  xMaxVal: number,
  minBw: number,
): { kdes: (KDEPoint[] | null)[]; maxDensity: number } {
  const kdes: (KDEPoint[] | null)[] = [];
  let maxDensity = 0;

  const step = (xMaxVal - xMinVal) / (RIDGE_KDE_POINTS - 1);

  for (const group of groups) {
    if (group.times.length < 3) {
      kdes.push(null);
      continue;
    }

    let h = silvermanBandwidth(group.times);
    if (h <= 0) {
      kdes.push(null);
      continue;
    }
    if (minBw > 0 && h < minBw) h = minBw;

    const n = group.times.length;
    const points = new Array<KDEPoint>(RIDGE_KDE_POINTS);

    for (let i = 0; i < RIDGE_KDE_POINTS; i++) {
      const x = xMinVal + i * step;
      let density = 0;
      for (let j = 0; j < n; j++) {
        density += gaussianKernel((x - group.times[j]) / h);
      }
      points[i] = { x, y: density / (n * h) };
      if (points[i].y > maxDensity) {
        maxDensity = points[i].y;
      }
    }

    kdes.push(points);
  }

  return { kdes, maxDensity };
}

/**
 * NOTE: 绘制脊线图
 * 1:1 翻译自 ridgeline.js drawRidgeline()
 */
export function drawRidgeline(
  ctx: CanvasRenderingContext2D,
  rcw: number, rch: number,
  groups: RidgeGroup[],
  kdes: (KDEPoint[] | null)[],
  maxDensity: number,
  highlightRow: number,
  xMinVal: number, xMaxVal: number,
  eventId: string,
): void {
  const { top: mt, right: mr, bottom: mb, left: ml } = RIDGE_MARGIN;
  const pw = rcw - ml - mr;
  const rows = groups.length;

  // 清空
  ctx.fillStyle = '#0c0c18';
  ctx.fillRect(0, 0, rcw, rch);

  // X 缩放函数
  const sx = (x: number) => ml + ((x - xMinVal) / (xMaxVal - xMinVal)) * pw;

  // 曲线高度缩放
  const curveMaxH = ROW_HEIGHT * (1 + OVERLAP_RATIO);

  // NOTE: X 轴刻度间距
  const rRange = xMaxVal - xMinVal;
  const rRawStep = rRange / 6;
  const rMag = Math.pow(10, Math.floor(Math.log10(rRawStep)));
  const rRes = rRawStep / rMag;
  const rNiceStep = rRes <= 1.5 ? rMag : rRes <= 3.5 ? 2 * rMag : rRes <= 7.5 ? 5 * rMag : 10 * rMag;
  const rGridStart = Math.ceil(xMinVal / rNiceStep) * rNiceStep;

  // X 轴网格
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = rGridStart; x <= xMaxVal; x += rNiceStep) {
    const px = Math.round(sx(x)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(px, mt - 10);
    ctx.lineTo(px, rch - mb);
    ctx.stroke();
  }

  // X 轴标签
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let x = rGridStart; x <= xMaxVal; x += rNiceStep) {
    const unit = isFMC(eventId) ? 'm' : isMBLD(eventId) ? 'p' : 's';
    const label = rNiceStep >= 1 ? Math.round(x) + unit : x.toFixed(1) + unit;
    ctx.fillText(label, sx(x), rch - mb + 8);
  }

  // 从底部向上绘制
  for (let i = rows - 1; i >= 0; i--) {
    const kde = kdes[i];
    if (!kde) continue;

    const group = groups[i];
    const baseY = mt + i * ROW_HEIGHT + ROW_HEIGHT;

    // 颜色渐变
    const t = rows > 1 ? i / (rows - 1) : 0;
    const hue = lerp(25, 200, t);
    const sat = lerp(80, 90, t);
    const light = lerp(55, 60, t);

    const isHighlighted = (i === highlightRow);
    const alpha = isHighlighted ? 0.45 : 0.2;
    const strokeAlpha = isHighlighted ? 0.95 : 0.6;
    const fillColor = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
    const strokeColor = `hsla(${hue}, ${sat}%, ${light}%, ${strokeAlpha})`;

    // 填充
    ctx.beginPath();
    ctx.moveTo(sx(kde[0].x), baseY);
    for (const p of kde) {
      const h = (p.y / maxDensity) * curveMaxH;
      ctx.lineTo(sx(p.x), baseY - h);
    }
    ctx.lineTo(sx(kde[kde.length - 1].x), baseY);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // 描边
    ctx.beginPath();
    ctx.moveTo(sx(kde[0].x), baseY - (kde[0].y / maxDensity) * curveMaxH);
    for (let j = 1; j < kde.length; j++) {
      const h = (kde[j].y / maxDensity) * curveMaxH;
      ctx.lineTo(sx(kde[j].x), baseY - h);
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = isHighlighted ? 2 : 1.2;
    ctx.stroke();

    // 左侧标签
    const labelText = formatRidgeLabel(group.label);
    ctx.fillStyle = isHighlighted
      ? 'rgba(255,255,255,0.95)'
      : 'rgba(255,255,255,0.45)';
    ctx.font = isHighlighted
      ? '500 11px Inter, sans-serif'
      : '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, ml - 10, baseY - ROW_HEIGHT * 0.3);
  }
}

/**
 * NOTE: 计算脊线图所需的 canvas 高度
 */
export function getRidgeCanvasHeight(groupCount: number): number {
  return RIDGE_MARGIN.top + RIDGE_MARGIN.bottom + groupCount * ROW_HEIGHT;
}

/**
 * NOTE: 点击 Y 坐标 → 行索引
 */
export function getClickedRow(y: number, groupCount: number): number {
  const rowIdx = Math.floor((y - RIDGE_MARGIN.top) / ROW_HEIGHT);
  if (rowIdx < 0 || rowIdx >= groupCount) return -1;
  return rowIdx;
}

// ─── 工具 ───

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function formatRidgeLabel(name: string): string {
  const formatted = name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/(\D)(\d{4})/g, "$1 '$2")
    .replace(/'20/g, "'")
    .trim();
  return formatted.length > 25 ? formatted.slice(0, 24) + '…' : formatted;
}
