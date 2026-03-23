// NOTE: 命令式 SVG 渲染引擎 — 从 chart.js 1:1 迁移
// 采用 ref-based 命令式方式操作 SVG DOM（D3/ECharts 标准做法）
// React 组件通过 useEffect 驱动 render()

import { useCalcStore } from '../stores/calc_store';
import { solveCountForEvent, isMo3ForEvent, isMbfForEvent } from '../stores/calc_store';
import {
  DNF_VALUE,
  formatTime, CalcEngine,
} from '../engine/calc_engine';
import { isWR, getAvgWR12 } from '../engine/wr_data';

// ── SVG 常量 ──

const SVG_NS = 'http://www.w3.org/2000/svg';

// NOTE: 选手颜色 — 原版 chart.js#29-34，每个选手统一纯色
export const SHADES: string[] = [
  'rgba(255,128,0,1.0)',    // Player A (橙色)
  'rgba(50,130,255,1.0)',   // Player B (蓝色)
  'rgba(190,190,190,1.0)',  // tie (灰色)
];

// NOTE: 图表布局参数（坐标系单位，映射到 viewBox）
export const BAR_START = 48;   // Y 轴标签占用的左侧空间
const BAR_GAP = 3;             // 柱间距（同一 slot 内 margin）
const STRIDE_GAP = 15;         // slot 间距（原版 STRIDE - BAR_W = 15）
const Y_MARGIN_TOP = 25;      // 顶部留白
const Y_MARGIN_BOTTOM = 30;   // 底部留白（放选手名标签）
const GRID_LINE_COUNT = 6;    // 网格线数量
// NOTE: 重叠模式下 inner bar 的宽度缩放比（原版 chart.js#707 = 0.55）
const INNER_BAR_RATIO = 0.55;
const LABEL_FONT = 11;        // 标签字号

// NOTE: 动画控制
const ANIM_MS = 250;          // 柱子高度动画时长

// ── 渲染状态 ──

// NOTE: 图表参数缓存 — 由 calcViewBox() 计算
export interface GraphParams {
  vbW: number;      // viewBox 宽度
  vbH: number;      // viewBox 高度
  barW: number;     // 单个柱子宽度
  yMin: number;     // 可见最小值（centiseconds）
  yMax: number;     // 可见最大值
  yRange: number;   // = yMax - yMin
  chartH: number;   // 绘图区高度（= vbH - margins）
  chartTop: number; // 绘图区顶部 Y 坐标
}

// NOTE: 模块级渲染状态 — Chart 组件挂载时初始化
let svgEl: SVGSVGElement | null = null;
let chartContainer: HTMLDivElement | null = null;
let gBars: SVGGElement | null = null;
let gGrid: SVGGElement | null = null;
let gLabels: SVGGElement | null = null;
let gStats: SVGGElement | null = null;
let gAvg: SVGGElement | null = null;
let gOverlay: HTMLDivElement | null = null;
let gp: GraphParams = { vbW: 800, vbH: 350, barW: 40, yMin: 0, yMax: 100, yRange: 100, chartH: 295, chartTop: Y_MARGIN_TOP };

// NOTE: 上一帧柱子高度 — 用于 WAAPI 动画 from→to
const prevBarHeights: Map<string, number> = new Map();

// ── 导出访问器 ──

export function getSvgEl(): SVGSVGElement | null { return svgEl; }
export function getChartContainer(): HTMLDivElement | null { return chartContainer; }
export function getGp(): GraphParams { return gp; }

// ── SVG 工具 ──

function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, String(v));
    }
  }
  return el;
}

// ── 坐标映射 ──

/** centiseconds → SVG Y 坐标 */
export function valToY(val: number): number {
  if (gp.yRange === 0) return gp.chartTop + gp.chartH / 2;
  return gp.chartTop + gp.chartH * (1 - (val - gp.yMin) / gp.yRange);
}

/** centiseconds → SVG Y 坐标（clamped to chart bounds） */
export function valToYCap(val: number): number {
  return Math.max(gp.chartTop, Math.min(gp.chartTop + gp.chartH, valToY(val)));
}

/** SVG Y 坐标 → centiseconds */
export function yToVal(y: number): number {
  return gp.yMin + (1 - (y - gp.chartTop) / gp.chartH) * gp.yRange;
}

// ── 初始化 ──

/** NOTE: 绑定 DOM 引用，创建 SVG 骨架 */
export function initChart(container: HTMLDivElement): void {
  chartContainer = container;

  // 创建 SVG 元素
  svgEl = createSvgElement('svg', { class: 'hth-chart' });
  container.appendChild(svgEl);

  // NOTE: 分层 group — 控制渲染顺序，后创建的在上层
  gGrid = createSvgElement('g', { class: 'chart-grid' });
  gBars = createSvgElement('g', { class: 'chart-bars' });
  gStats = createSvgElement('g', { class: 'chart-stats' });
  gLabels = createSvgElement('g', { class: 'chart-labels' });
  gAvg = createSvgElement('g', { class: 'chart-avg' });

  svgEl.appendChild(gGrid);
  svgEl.appendChild(gBars);
  svgEl.appendChild(gStats);
  svgEl.appendChild(gLabels);
  svgEl.appendChild(gAvg);

  // NOTE: overlay div — 用于 confetti 和 drag handle（在 SVG 上层）
  gOverlay = document.createElement('div');
  gOverlay.style.cssText = 'position:relative;pointer-events:none;';
  container.appendChild(gOverlay);
}

/** NOTE: 清理 DOM 引用 */
export function destroyChart(): void {
  if (svgEl && chartContainer) {
    chartContainer.removeChild(svgEl);
  }
  if (gOverlay && chartContainer) {
    chartContainer.removeChild(gOverlay);
  }
  svgEl = gBars = gGrid = gLabels = gStats = gAvg = null;
  chartContainer = gOverlay = null;
  prevBarHeights.clear();
}

// ── viewBox 计算 ──

interface RenderOptions {
  skipViewBox?: boolean;
}

function calcViewBox(): void {
  const state = useCalcStore.getState();
  const sc = solveCountForEvent(state.event);
  // NOTE: 原版重叠模式 — 柱宽和 stride 不随选手数变化（chart.js#16-17）
  const barW = 50;
  const stride = barW + STRIDE_GAP;

  const vbW = BAR_START + stride * sc + 20;

  // NOTE: 数据范围计算 — 遍历当前 seed 对的所有值
  let minVal = Infinity;
  let maxVal = -Infinity;
  let hasData = false;

  for (let p = 0; p < 2; p++) {
    if (!state.playerEnabled[p]) continue;
    const row = state.times[state.seedOn + p];
    for (let t = 0; t < sc; t++) {
      const v = row[t];
      if (v > 0 && v < DNF_VALUE) {
        minVal = Math.min(minVal, v);
        maxVal = Math.max(maxVal, v);
        hasData = true;
      }
    }
  }

  // NOTE: 包含 Target Avg 虚线在可见范围内
  const tavg = state.getTargetAvg(state.seedOn);
  if (tavg > 0 && tavg < DNF_VALUE) {
    minVal = Math.min(minVal, tavg);
    maxVal = Math.max(maxVal, tavg);
    hasData = true;
  }

  // NOTE: 如果没数据，使用默认范围
  if (!hasData) {
    minVal = 0;
    maxVal = 1000;
  }

  // NOTE: 上下留 15% 的空间
  const range = maxVal - minVal || 100;
  const padding = range * 0.15;
  const yMin = Math.max(0, minVal - padding);
  const yMax = maxVal + padding;
  const vbH = 350;
  const chartH = vbH - Y_MARGIN_TOP - Y_MARGIN_BOTTOM;

  gp = { vbW, vbH, barW, yMin, yMax, yRange: yMax - yMin, chartH, chartTop: Y_MARGIN_TOP };

  if (svgEl) {
    svgEl.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);
  }
}

// ── 渲染入口 ──

export function render(opts?: RenderOptions): void {
  if (!svgEl || !gBars || !gGrid || !gLabels || !gStats || !gAvg) return;

  if (!opts?.skipViewBox) {
    calcViewBox();
  }

  // 清空所有分层 group
  gGrid.innerHTML = '';
  gBars.innerHTML = '';
  gLabels.innerHTML = '';
  gStats.innerHTML = '';
  gAvg.innerHTML = '';

  drawGrid();
  drawBars();
  drawBarLabels();
  drawStats();
  drawAverages();

  // NOTE: 每次 render 完成后调用注册的回调（如 reapplySelection）
  for (const cb of postRenderCallbacks) cb();
}

// ── 网格线 ──

function drawGrid(): void {
  if (!gGrid) return;
  const state = useCalcStore.getState();
  const isMove = state.event === '333fm';
  // TODO: MBF 赛事的 Y 轴标签和格式化待实现（需要 isMbfForEvent）

  // NOTE: 水平网格线 + Y 轴标签
  for (let i = 0; i <= GRID_LINE_COUNT; i++) {
    const frac = i / GRID_LINE_COUNT;
    const y = gp.chartTop + gp.chartH * frac;
    const val = gp.yMax - gp.yRange * frac;

    // 网格线
    const line = createSvgElement('line', {
      x1: BAR_START - 5, y1: y, x2: gp.vbW, y2: y,
      stroke: '#ccc', 'stroke-width': 0.5,
    });
    gGrid.appendChild(line);

    // Y 轴标签
    const labelText = formatTime(val, true, isMove);
    const label = createSvgElement('text', {
      x: BAR_START - 8, y: y + 3,
      'text-anchor': 'end', fill: '#888',
      'font-size': LABEL_FONT, 'font-family': 'Helvetica, Arial, sans-serif',
    });
    label.textContent = labelText;
    gGrid.appendChild(label);
  }

  // NOTE: Target Avg 虚线
  const tavg = state.getTargetAvg(state.seedOn);
  if (tavg > 0 && tavg < DNF_VALUE) {
    const ty = valToYCap(tavg);
    const dash = createSvgElement('line', {
      x1: BAR_START, y1: ty, x2: gp.vbW, y2: ty,
      stroke: '#E91E63', 'stroke-width': 1.5,
      'stroke-dasharray': '6,3',
      opacity: '0.7',
    });
    gGrid.appendChild(dash);

    // 标签
    const tLabel = createSvgElement('text', {
      x: gp.vbW - 2, y: ty - 4,
      'text-anchor': 'end', fill: '#E91E63',
      'font-size': 10, 'font-weight': '600',
    });
    tLabel.textContent = 'Target: ' + formatTime(tavg, false, false, true);
    gGrid.appendChild(tLabel);
  }

  // NOTE: WR Avg 虚线（#1 和 #2）
  const avgWR = getAvgWR12(state.event);
  if (avgWR) {
    const wrColors = ['rgba(255,128,0,0.4)', 'rgba(50,130,255,0.4)'];
    for (let i = 0; i < 2; i++) {
      if (avgWR[i] > 0 && avgWR[i] < DNF_VALUE) {
        const wy = valToYCap(avgWR[i]);
        if (wy > gp.chartTop && wy < gp.chartTop + gp.chartH) {
          const wline = createSvgElement('line', {
            x1: BAR_START, y1: wy, x2: gp.vbW, y2: wy,
            stroke: wrColors[i], 'stroke-width': 1,
            'stroke-dasharray': '4,4', opacity: '0.6',
          });
          gGrid.appendChild(wline);
        }
      }
    }
  }
}

// ── 柱状图 ──

/** NOTE: 获取柱子 stride — 原版重叠模式下不随选手数变化 */
export function getStride(): number {
  return gp.barW + STRIDE_GAP;
}

/** NOTE: 获取某柱子左边缘的 X 坐标
 *  原版重叠模式 — 所有选手在同一 x 位置（chart.js#699）
 *  _pSlot 不影响 x 位置（保留参数以兼容 drag handler） */
export function getBarX(solveIdx: number, _pSlot: number): number {
  const stride = getStride();
  return BAR_START + stride * solveIdx;
}

function drawBars(): void {
  if (!gBars) return;
  const state = useCalcStore.getState();
  const sc = solveCountForEvent(state.event);
  const isMbf = isMbfForEvent(state.event);
  const bothEnabled = state.playerEnabled[0] && state.playerEnabled[1];
  const bm = BAR_GAP; // bar margin

  // NOTE: 准备排序数据（用于色阶 shading）
  const sortedVals: number[][] = [];
  for (let p = 0; p < 2; p++) {
    const row = state.times[state.seedOn + p];
    const sv = [...row.slice(0, sc)].filter(v => v > 0 && v < DNF_VALUE).sort((a, b) => a - b);
    if (isMbf) sv.reverse();
    sortedVals.push(sv);
  }

  // NOTE: 原版重叠逻辑 — 逐 slot 绘制，较高柱子先画（底层全宽），较矮柱子后画（缩窄居中）
  // chart.js#688-760
  for (let t = 0; t < sc; t++) {
    // NOTE: 确定两个选手在此 slot 的 Y 值（越小 = 柱子越高）
    const minYs: [number, number] = [999999, 999999];
    for (let p = 0; p < 2; p++) {
      if (!state.playerEnabled[p]) continue;
      const val = state.times[state.seedOn + p][t];
      if (val > 0 && val < DNF_VALUE) {
        minYs[p] = valToYCap(val);
      }
    }

    // NOTE: 较高柱子（minY 越小）先画 → 底层，较矮柱子后画 → 上层
    const pOrder: number[] = (minYs[0] < minYs[1]) ? [0, 1] : [1, 0];

    for (let i = 0; i < 2; i++) {
      const p = pOrder[i];
      if (!state.playerEnabled[p]) continue;
      const val = state.times[state.seedOn + p][t];
      if (val <= 0 || val >= DNF_VALUE) continue;

      const barX = getBarX(t, 0);
      const y = valToYCap(val);
      const baseY = gp.chartTop + gp.chartH;
      const barH = baseY - y;

      // NOTE: 原版重叠宽度逻辑 — 较矮柱子（后画的 i===1）在 Both 模式下缩窄 55% 居中
      const fullW = gp.barW - 2 * bm;
      const isTop = bothEnabled && i === 1 && minYs[0] !== 999999 && minYs[1] !== 999999;
      const bw = isTop ? fullW * INNER_BAR_RATIO : fullW;
      const bx = barX + bm + (fullW - bw) / 2;

      const bar = createSvgElement('rect', {
        x: bx, y, width: bw, height: Math.max(0, barH),
        rx: 3, fill: SHADES[p] || SHADES[0],
        class: 'chart-bar',
        'data-player': p,
        'data-slot': t,
      });

      // NOTE: WAAPI 柱子高度动画
      const key = `${p}_${t}`;
      const prevH = prevBarHeights.get(key) ?? 0;
      if (Math.abs(prevH - barH) > 1) {
        try {
          bar.animate(
            [
              { height: prevH + 'px', y: (baseY - prevH) + 'px' },
              { height: barH + 'px', y: y + 'px' },
            ],
            { duration: ANIM_MS, easing: 'ease-out', fill: 'none' },
          );
        } catch {
          // NOTE: WAAPI 在某些浏览器不支持 SVG 动画，静默降级
        }
      }
      prevBarHeights.set(key, barH);

      gBars.appendChild(bar);
    }
  }

  // NOTE: ghost bar（Target Avg 幽灵柱）
  drawGhostBars();
}

function drawGhostBars(): void {
  if (!gBars) return;
  const state = useCalcStore.getState();
  const tavg = state.getTargetAvg(state.seedOn);

  let pSlot = 0;
  for (let p = 0; p < 2; p++) {
    if (!state.playerEnabled[p]) continue;
    const row = state.times[state.seedOn + p];
    const ghost = CalcEngine.getGhostBar(row, tavg);
    if (ghost && ghost.value > 0 && ghost.value < DNF_VALUE) {
      const x = getBarX(ghost.slotIndex, pSlot);
      const y = valToYCap(ghost.value);
      const baseY = gp.chartTop + gp.chartH;
      const barH = baseY - y;

      // NOTE: ghost 颜色 — safe(绿)/conditional(黄)/impossible(红)
      const colors: Record<string, string> = {
        safe: '#4CAF50', conditional: '#FFC107', impossible: '#F44336', any: '#4CAF50',
      };
      const color = colors[ghost.type] || '#999';

      const ghostRect = createSvgElement('rect', {
        x, y, width: gp.barW, height: Math.max(0, barH),
        rx: 3, fill: 'none',
        stroke: color, 'stroke-width': 2,
        'stroke-dasharray': '5,3',
        opacity: '0.7',
        class: 'chart-ghost',
        'data-player': p,
        'data-slot': ghost.slotIndex,
        'data-ghost-type': ghost.type,
      });

      // NOTE: 幽灵柱渐入动画
      ghostRect.classList.add('chart-ghost-anim');
      gBars.appendChild(ghostRect);
    }
    pSlot++;
  }
}

// ── 柱顶标签 ──

function drawBarLabels(): void {
  if (!gLabels) return;
  const state = useCalcStore.getState();
  const sc = solveCountForEvent(state.event);
  const isMove = state.event === '333fm';

  let pSlot = 0;
  for (let p = 0; p < 2; p++) {
    if (!state.playerEnabled[p]) continue;
    const row = state.times[state.seedOn + p];

    for (let t = 0; t < sc; t++) {
      const val = row[t];
      if (val <= 0) continue;

      const x = getBarX(t, pSlot) + gp.barW / 2;

      if (val >= DNF_VALUE) {
        // DNF 标签 — 在基线上方显示
        const label = createSvgElement('text', {
          x, y: gp.chartTop + gp.chartH - 5,
          'text-anchor': 'middle', fill: '#c62828',
          'font-size': 10, 'font-weight': '700',
        });
        label.textContent = 'DNF';
        gLabels.appendChild(label);
        continue;
      }

      // NOTE: 柱顶值标签
      const y = valToYCap(val) - 5;
      const labelText = formatTime(val, false, isMove);
      const label = createSvgElement('text', {
        x, y: Math.max(Y_MARGIN_TOP, y),
        'text-anchor': 'middle', fill: '#333',
        'font-size': 10, 'font-weight': '600',
      });
      label.textContent = labelText;
      gLabels.appendChild(label);

      // NOTE: WR badge
      if (isWR(state.event, 'single', val)) {
        const badge = createSvgElement('text', {
          x, y: Math.max(Y_MARGIN_TOP, y) - 10,
          'text-anchor': 'middle', fill: '#D32F2F',
          'font-size': 9, 'font-weight': '700',
        });
        badge.textContent = 'WR!';
        gLabels.appendChild(badge);
      }
    }
    pSlot++;
  }

  // NOTE: ghost bar 标签
  drawGhostLabels();

  // NOTE: 底部选手名标签
  drawPlayerLabels();
}

function drawGhostLabels(): void {
  if (!gLabels) return;
  const state = useCalcStore.getState();
  const tavg = state.getTargetAvg(state.seedOn);

  let pSlot = 0;
  for (let p = 0; p < 2; p++) {
    if (!state.playerEnabled[p]) continue;
    const row = state.times[state.seedOn + p];
    const ghost = CalcEngine.getGhostBar(row, tavg);
    if (ghost && ghost.value > 0 && ghost.value < DNF_VALUE) {
      const x = getBarX(ghost.slotIndex, pSlot) + gp.barW / 2;
      const y = valToYCap(ghost.value) - 5;
      const label = createSvgElement('text', {
        x, y: Math.max(Y_MARGIN_TOP, y),
        'text-anchor': 'middle', fill: '#999',
        'font-size': 9, 'font-style': 'italic',
      });
      label.textContent = formatTime(ghost.value);
      gLabels.appendChild(label);
    }
    pSlot++;
  }
}

function drawPlayerLabels(): void {
  if (!gLabels) return;
  const state = useCalcStore.getState();
  const sc = solveCountForEvent(state.event);

  let pSlot = 0;
  for (let p = 0; p < 2; p++) {
    if (!state.playerEnabled[p]) continue;

    // NOTE: 选手名标签放在柱群下方居中位置
    const midSolve = (sc - 1) / 2;
    const x = getBarX(Math.floor(midSolve), pSlot) + gp.barW / 2;
    const y = gp.chartTop + gp.chartH + 15;

    const label = createSvgElement('text', {
      x, y,
      'text-anchor': 'middle',
      fill: SHADES[p] || SHADES[0],
      'font-size': 11, 'font-weight': '600',
    });
    label.textContent = state.names[state.seedOn + p] || '';
    gLabels.appendChild(label);
    pSlot++;
  }
}

// ── 统计指标可视化（BPA/WPA 横线） ──

function drawStats(): void {
  if (!gStats) return;
  const state = useCalcStore.getState();
  const mo3 = isMo3ForEvent(state.event);

  let pSlot = 0;
  for (let p = 0; p < 2; p++) {
    if (!state.playerEnabled[p]) continue;
    const row = state.times[state.seedOn + p];
    const result = CalcEngine.compute(row, mo3);

    if (result && result.complete && result.avg !== undefined && result.avg < DNF_VALUE) {
      // NOTE: BPA 横线（虚线）
      if (!mo3 && result.bpa !== null && result.bpa !== undefined && result.bpa < DNF_VALUE) {
        const by = valToYCap(result.bpa);
        drawStatLine(by, pSlot, 'bpa', p);
      }
      // NOTE: WPA 横线（虚线）
      if (!mo3 && result.wpa !== null && result.wpa !== undefined && result.wpa < DNF_VALUE) {
        const wy = valToYCap(result.wpa);
        drawStatLine(wy, pSlot, 'wpa', p);
      }
    }
    pSlot++;
  }
}

function drawStatLine(y: number, pSlot: number, type: string, _playerIdx: number): void {
  if (!gStats) return;
  const state = useCalcStore.getState();
  const sc = solveCountForEvent(state.event);

  const x1 = getBarX(0, pSlot);
  const x2 = getBarX(sc - 1, pSlot) + gp.barW;
  const color = type === 'bpa' ? '#4CAF50' : '#FF5722';

  const line = createSvgElement('line', {
    x1, y1: y, x2, y2: y,
    stroke: color, 'stroke-width': 1,
    'stroke-dasharray': '3,2',
    opacity: '0.5',
  });
  gStats.appendChild(line);
}

// ── 平均值和菱形标记 ──

function drawAverages(): void {
  if (!gAvg) return;
  const state = useCalcStore.getState();
  const sc = solveCountForEvent(state.event);
  const mo3 = isMo3ForEvent(state.event);
  const isMove = state.event === '333fm';

  let pSlot = 0;
  for (let p = 0; p < 2; p++) {
    if (!state.playerEnabled[p]) continue;
    const row = state.times[state.seedOn + p];
    const result = CalcEngine.compute(row, mo3);

    if (result && result.complete && result.avg !== undefined && result.avg < DNF_VALUE) {
      const avgY = valToYCap(result.avg);
      const lastBarX = getBarX(sc - 1, pSlot) + gp.barW + 8;

      // NOTE: 菱形标记
      const size = 5;
      const diamond = createSvgElement('polygon', {
        points: `${lastBarX},${avgY - size} ${lastBarX + size},${avgY} ${lastBarX},${avgY + size} ${lastBarX - size},${avgY}`,
        fill: SHADES[p] || SHADES[0],
        class: 'chart-avg-diamond',
        'data-player': p,
      });
      gAvg.appendChild(diamond);

      // NOTE: 平均值标签
      const avgLabel = createSvgElement('text', {
        x: lastBarX + size + 4, y: avgY + 3,
        fill: SHADES[p] || SHADES[0],
        'font-size': 10, 'font-weight': '700',
      });
      const avgText = (mo3 ? 'Mo3: ' : 'Ao5: ') + formatTime(result.avg, false, isMove, true);
      avgLabel.textContent = avgText;
      gAvg.appendChild(avgLabel);

      // NOTE: Avg WR badge
      if (isWR(state.event, 'average', result.avg)) {
        const wrLabel = createSvgElement('text', {
          x: lastBarX + size + 4, y: avgY - 7,
          fill: '#D32F2F', 'font-size': 9, 'font-weight': '700',
        });
        wrLabel.textContent = 'WR!';
        gAvg.appendChild(wrLabel);
      }
    } else if (result && result.complete && result.avg !== undefined && result.avg >= DNF_VALUE) {
      // DNF average
      const lastBarX = getBarX(sc - 1, pSlot) + gp.barW + 8;
      const avgY = gp.chartTop + gp.chartH / 2;
      const avgLabel = createSvgElement('text', {
        x: lastBarX + 8, y: avgY + 3,
        fill: '#c62828', 'font-size': 10, 'font-weight': '700',
      });
      avgLabel.textContent = (mo3 ? 'Mo3: ' : 'Ao5: ') + 'DNF';
      gAvg.appendChild(avgLabel);
    }
    pSlot++;
  }
}

// ── confetti（WR 庆祝）— 原版 chart.js#192-215 ──

// NOTE: 连发 3 波，期间吞掉新触发
let confettiActive = false;

export function showConfetti(): void {
  if (confettiActive) return;
  confettiActive = true;

  import('canvas-confetti').then(({ default: confetti }) => {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { x: 0.5, y: 0.4 },
          angle: 90,
          colors: ['#FFD700', '#FF6B35', '#FF0000', '#00FF00', '#00BFFF', '#FF69B4'],
          gravity: 1.2,
          ticks: 200,
          disableForReducedMotion: true,
        });
      }, i * 250);
    }
    // NOTE: 最后一波发出后约 3s 动画结束，解锁
    setTimeout(() => { confettiActive = false; }, 500 + 3000);
  });
}

/** NOTE: overlay div 引用 — 供 ChartDrag 创建 drag handle 使用 */
export function getOverlay(): HTMLDivElement | null { return gOverlay; }

/** NOTE: 获取当前 bar 的宽度（供 ChartDrag 定位 handle） */
export function getBarW(): number { return gp.barW; }

// NOTE: post-render 回调注册 — chartRender 重建 DOM 后重新标记选中柱子等
const postRenderCallbacks: (() => void)[] = [];
export function registerPostRenderCallback(cb: () => void): void {
  postRenderCallbacks.push(cb);
}
