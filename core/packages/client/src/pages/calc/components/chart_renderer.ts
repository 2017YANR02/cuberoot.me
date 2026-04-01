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

// NOTE: PA 柱位置缓存 — 每次 drawStats 后更新，供 drag handler 创建 overlay handle
export interface PaBarInfo {
  playerIdx: number;
  cx: number;      // SVG X 中心
  w: number;       // 宽度
  wpaY: number;    // WPA 端 SVG Y
  bpaY: number;    // BPA 端 SVG Y
  bpa: number;     // BPA centiseconds
  wpa: number;     // WPA centiseconds
}
let paBarInfos: PaBarInfo[] = [];
export function getPaBarData(): PaBarInfo[] { return paBarInfos; }

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

  // NOTE: 右侧留白 80 — 给 PA 竖柱 + 菱形标签 + Ao5 文字留空间
  const vbW = BAR_START + stride * sc + 80;

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

  // 清空所有分层 group（gBars 除外 — drawBars 内部复用 rect 以支持过渡动画）
  gGrid.innerHTML = '';
  gLabels.innerHTML = '';
  gStats.innerHTML = '';
  gAvg.innerHTML = '';

  drawGrid();
  drawBars();
  drawBarLabels();
  drawStats();
  drawNeedBadges();
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
      x: BAR_START - 2, y: ty - 4,
      'text-anchor': 'end', fill: '#E91E63',
      'font-size': 10, 'font-weight': '600',
    });
    tLabel.textContent = formatTime(tavg, false, false, true);
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
  const usedKeys: Record<string, boolean> = {}; // NOTE: 追踪本轮使用的 rect key

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

      const key = `${p}_${t}`;
      usedKeys[key] = true;

      // NOTE: 复用已有 rect — appendChild 移到末尾维持 pOrder 决定的 z-order
      let bar = gBars.querySelector(`.chart-bar[data-player="${p}"][data-slot="${t}"]`) as SVGRectElement | null;
      if (bar) {
        const oldX = parseFloat(bar.getAttribute('x') || '0');
        const oldY = parseFloat(bar.getAttribute('y') || '0');
        const oldW = parseFloat(bar.getAttribute('width') || '0');
        const oldH = parseFloat(bar.getAttribute('height') || '0');
        bar.setAttribute('x', String(bx));
        bar.setAttribute('y', String(y));
        bar.setAttribute('width', String(bw));
        bar.setAttribute('height', String(Math.max(0, barH)));
        gBars.appendChild(bar); // 移到末尾维持 z-order

        // NOTE: 属性变化时用 WAAPI 播放过渡动画（原版 chart.js#731-741）
        const wxChanged = Math.abs(oldW - bw) > 0.5 || Math.abs(oldX - bx) > 0.5;
        const yhChanged = Math.abs(oldY - y) > 0.5 || Math.abs(oldH - barH) > 0.5;
        if (wxChanged || yhChanged) {
          try {
            bar.animate(
              [
                { x: oldX + 'px', y: oldY + 'px', width: oldW + 'px', height: oldH + 'px' },
                { x: bx + 'px', y: y + 'px', width: bw + 'px', height: Math.max(0, barH) + 'px' },
              ],
              { duration: ANIM_MS, easing: 'ease', fill: 'none' },
            );
          } catch {
            // NOTE: WAAPI 在某些浏览器不支持 SVG 动画，静默降级
          }
        }
      } else {
        bar = createSvgElement('rect', {
          x: bx, y, width: bw, height: Math.max(0, barH),
          rx: 3, fill: SHADES[p] || SHADES[0],
          class: 'chart-bar',
          'data-player': p,
          'data-slot': t,
        }) as unknown as SVGRectElement;
        gBars.appendChild(bar);
      }
    }
  }

  // NOTE: 清理本轮不再需要的旧 rect（如选手被禁用或值被清空）
  gBars.querySelectorAll('.chart-bar').forEach(el => {
    const k = el.getAttribute('data-player') + '_' + el.getAttribute('data-slot');
    if (!usedKeys[k]) el.remove();
  });
  // NOTE: 幽灵柱每次重建，先清理旧的
  gBars.querySelectorAll('.chart-ghost').forEach(el => el.remove());

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
          'font-size': 16, 'font-weight': '700',
          class: 'chart-bar-label',
          'data-player': String(p), 'data-solve': String(t),
        });
        label.textContent = 'DNF';
        gLabels.appendChild(label);
        continue;
      }

      // NOTE: 柱顶值标签 — 颜色跟随柱子
      const y = valToYCap(val) - 5;
      const labelText = formatTime(val, false, isMove);
      const labelCol = darken(SHADES[p] || SHADES[0], 0.7);
      const label = createSvgElement('text', {
        x, y: Math.max(Y_MARGIN_TOP, y),
        'text-anchor': 'middle', fill: labelCol,
        'font-size': 16, 'font-weight': '600',
        class: 'chart-bar-label',
        'data-player': String(p), 'data-solve': String(t),
      });
      label.textContent = labelText;
      gLabels.appendChild(label);

      // NOTE: WR badge — 白字红底圆角框
      if (isWR(state.event, 'single', val)) {
        const wrY = Math.max(Y_MARGIN_TOP, y) - 14;
        const wrW = 22, wrH = 12, wrR = 3;
        gLabels.appendChild(createSvgElement('rect', {
          x: x - wrW / 2, y: wrY - wrH / 2,
          width: wrW, height: wrH, rx: wrR,
          fill: '#D32F2F',
        }));
        const badge = createSvgElement('text', {
          x, y: wrY + 3.5,
          'text-anchor': 'middle', fill: '#fff',
          'font-size': 8, 'font-weight': '700',
        });
        badge.textContent = 'WR';
        gLabels.appendChild(badge);
      }
    }
    pSlot++;
  }

  // NOTE: ghost bar 标签
  drawGhostLabels();
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

// ── 统计指标可视化（BPA/WPA 横线 + PA 竖柱 + 数值标签） ──

/** NOTE: 颜色变暗工具 — 原版 chart.js 的 darken() */
function darken(rgba: string, factor: number): string {
  const m = rgba.match(/[\d.]+/g);
  if (!m || m.length < 3) return rgba;
  const r = Math.round(parseFloat(m[0]) * factor);
  const g = Math.round(parseFloat(m[1]) * factor);
  const b = Math.round(parseFloat(m[2]) * factor);
  const a = m.length >= 4 ? parseFloat(m[3]) : 1;
  return `rgba(${r},${g},${b},${a})`;
}

/** NOTE: 颜色降透明工具 — 原版 chart.js 的 fade() */
function fade(rgba: string, alpha: number): string {
  const m = rgba.match(/[\d.]+/g);
  if (!m || m.length < 3) return rgba;
  return `rgba(${m[0]},${m[1]},${m[2]},${alpha})`;
}

function drawStats(): void {
  if (!gStats) return;
  const state = useCalcStore.getState();
  const sc = solveCountForEvent(state.event);
  const mo3 = isMo3ForEvent(state.event);

  // NOTE: 清空上一帧的 PA 柱位置缓存
  paBarInfos = [];

  let pSlot = 0;
  for (let p = 0; p < 2; p++) {
    if (!state.playerEnabled[p]) continue;
    const row = state.times[state.seedOn + p];

    // NOTE: PA 竖柱 — 填了 4+ 把时内联计算 BPA/WPA（原版 chart.js#936-957）
    // 不依赖 result.complete，4 把时就显示
    if (!mo3) {
      const filled = row.filter((t: number) => t > 0 && t < DNF_VALUE);
      const filledCount = filled.length;
      if (filledCount >= 4) {
        // NOTE: 内联计算 BPA/WPA — 假设第 5 把 = 0（最好）和 = DNF（最差）
        const sorted4 = [...filled.slice(0, 4)].sort((a: number, b: number) => a - b);
        const bpaArr = [...sorted4, 0].sort((a: number, b: number) => a - b);
        const wpaArr = [...sorted4, DNF_VALUE].sort((a: number, b: number) => a - b);
        const bpa = Math.round((bpaArr[1] + bpaArr[2] + bpaArr[3]) / 3);
        const wpaDnf = wpaArr.filter((t: number) => t >= DNF_VALUE).length;
        const wpa = wpaDnf >= 2 ? DNF_VALUE : Math.round((wpaArr[1] + wpaArr[2] + wpaArr[3]) / 3);

        if (bpa < DNF_VALUE && wpa < DNF_VALUE) {
          const col = SHADES[p] || SHADES[0];
          const darkCol = darken(col, 0.7);
          const fadedCol = fade(col, 0.25);

          const barCx = getBarX(sc - 1, pSlot) + gp.barW + 30;
          const paBarW = 20;
          const paTopY = valToYCap(wpa);
          const paBotY = valToYCap(bpa);
          const paBarH = Math.max(3, paBotY - paTopY);

          const paRect = createSvgElement('rect', {
            x: barCx - paBarW / 2, y: paTopY,
            width: paBarW, height: paBarH,
            fill: fadedCol, stroke: darkCol,
            'stroke-width': 1.5, rx: 3,
            class: 'chart-pa-bar',
            'data-player': p,
            'data-pa-cx': barCx, 'data-pa-w': paBarW,
            'data-wpa-y': paTopY, 'data-bpa-y': paBotY,
            cursor: 'ns-resize', 'pointer-events': 'all',
          });
          gStats.appendChild(paRect);

          paBarInfos.push({
            playerIdx: p, cx: barCx, w: paBarW,
            wpaY: paTopY, bpaY: paBotY, bpa, wpa,
          });

          // WPA 数值标签（竖柱上方）
          const wpaLabel = createSvgElement('text', {
            x: barCx, y: paTopY - 5,
            'text-anchor': 'middle', fill: darkCol,
            'font-size': 16, 'font-weight': '600',
            'font-family': 'Helvetica, Arial, sans-serif',
          });
          wpaLabel.textContent = formatTime(wpa);
          gStats.appendChild(wpaLabel);

          // BPA 数值标签（竖柱下方）
          const bpaLabel = createSvgElement('text', {
            x: barCx, y: paBotY + 12,
            'text-anchor': 'middle', fill: darkCol,
            'font-size': 16, 'font-weight': '600',
            'font-family': 'Helvetica, Arial, sans-serif',
          });
          bpaLabel.textContent = formatTime(bpa);
          gStats.appendChild(bpaLabel);
        }
      }
    }
    pSlot++;
  }
}



// ── Need Badge（阈值指示标签）── 原版 chart.js#516-676 ──

/** NOTE: 重叠排斥算法 — 推开相互重叠的标签 */
function resolveOverlaps(items: { origY: number; y: number; h: number }[], gap: number): void {
  items.sort((a, b) => a.y - b.y);
  for (let pass = 0; pass < 10; pass++) {
    let moved = false;
    for (let i = 1; i < items.length; i++) {
      const overlap = items[i - 1].y + items[i - 1].h + gap - items[i].y;
      if (overlap > 0) {
        items[i - 1].y -= overlap / 2;
        items[i].y += overlap / 2;
        moved = true;
      }
    }
    if (!moved) break;
  }
}

function drawNeedBadges(): void {
  if (!gStats) return;
  const state = useCalcStore.getState();
  const mo3 = isMo3ForEvent(state.event);
  if (mo3) return; // Mo3 无 Need Badge

  for (let p = 0; p < 2; p++) {
    if (!state.playerEnabled[p]) continue;
    const tavg = state.getTargetAvg(state.seedOn);
    if (!tavg || tavg <= 0 || tavg >= DNF_VALUE) continue;

    const times = state.times[state.seedOn + p];
    const filled = times.filter((t: number) => t > 0 && t < DNF_VALUE);
    if (filled.length < 4) continue;

    const th = CalcEngine.computeThresholds(times, tavg);
    if (!th) continue;

    // NOTE: 收集要显示的 badge
    const BADGE_COLORS = {
      t4wpa: '#1976D2',   // 蓝色 — WPA
      t4bpa: '#388E3C',   // 绿色 — BPA
      t5: '#D32F2F',      // 红色 — 第 5 把
    };

    interface Badge {
      line1: string;
      line2: string;
      color: string;
      y: number;
      skull?: boolean;
    }
    const badges: Badge[] = [];

    // NOTE: t#4 WPA 和 BPA
    const hasWpa = th.t4wpa !== undefined && th.t4wpa !== null;
    const hasBpa = th.t4bpa !== undefined && th.t4bpa !== null;
    const wpaIsAny = hasWpa && th.t4wpa! >= DNF_VALUE;
    const bpaIsAny = hasBpa && th.t4bpa! >= DNF_VALUE;
    const showWpa = hasWpa && !(wpaIsAny && hasBpa && !bpaIsAny);
    const showBpa = hasBpa && !(bpaIsAny && hasWpa && !wpaIsAny);

    if (showWpa) {
      const v = th.t4wpa! >= DNF_VALUE ? 'ANY ✓' : '≤ ' + formatTime(th.t4wpa!);
      badges.push({
        line1: 'Need 4th', line2: v, color: BADGE_COLORS.t4wpa,
        y: th.t4wpa! < DNF_VALUE ? valToYCap(th.t4wpa!) : valToYCap(tavg) - 20
      });
    }
    if (showBpa) {
      const v = th.t4bpa! >= DNF_VALUE ? 'ANY ✓' : '≤ ' + formatTime(th.t4bpa!);
      badges.push({
        line1: 'Need 4th', line2: v, color: BADGE_COLORS.t4bpa,
        y: th.t4bpa! < DNF_VALUE ? valToYCap(th.t4bpa!) : valToYCap(tavg) + 10
      });
    }
    // t#4 impossible
    if (th.t4wpa === null && th.t4bpa === null) {
      badges.push({
        line1: '4th', line2: '💀', color: '#D32F2F', skull: true,
        y: valToYCap(tavg)
      });
    }
    // t#5（仅当填了 5 把时）
    if (filled.length >= 5 && th.t5 !== undefined) {
      if (th.t5 !== null) {
        const v = th.t5 >= DNF_VALUE ? 'ANY ✓' : '≤ ' + formatTime(th.t5);
        badges.push({
          line1: 'Need 5th', line2: v, color: BADGE_COLORS.t5,
          y: th.t5 < DNF_VALUE ? valToYCap(th.t5) : valToYCap(tavg) + 30
        });
      } else {
        badges.push({
          line1: '5th', line2: '💀', color: '#D32F2F', skull: true,
          y: valToYCap(tavg) + 20
        });
      }
    }

    if (badges.length === 0) continue;

    // 排斥重叠
    const badgeH = 22;
    const badgeItems = badges.map(b => ({ origY: b.y, y: b.y, h: badgeH }));
    if (badgeItems.length > 1) resolveOverlaps(badgeItems, 4);
    for (let bi = 0; bi < badges.length; bi++) badges[bi].y = badgeItems[bi].y;

    // NOTE: 绘制 badge — 图表左侧，带右箭头的圆角矩形
    const bw = 42, bh = 22, br = 4, arrowW = 5;
    const badgeRight = BAR_START - 6;
    const badgeLeft = badgeRight - arrowW - bw;

    for (let bi = 0; bi < badges.length; bi++) {
      const b = badges[bi];
      const by = b.y - bh / 2;

      // 圆角矩形 + 右箭头 path
      const lx = badgeLeft;
      const d = `M${lx},${by + br}` +
        ` Q${lx},${by} ${lx + br},${by}` +
        ` L${badgeRight - arrowW},${by}` +
        ` L${badgeRight},${b.y}` +
        ` L${badgeRight - arrowW},${by + bh}` +
        ` L${lx + br},${by + bh}` +
        ` Q${lx},${by + bh} ${lx},${by + bh - br}` +
        ` Z`;
      const pathEl = createSvgElement('path', {
        d, fill: b.color, opacity: '0.9',
      });
      gStats.appendChild(pathEl);

      // 文字内容
      const tx = lx + (bw + br) / 2;
      const text1 = createSvgElement('text', {
        x: tx, y: by + 9, fill: '#fff',
        'font-size': 7, 'font-weight': 'bold',
        'font-family': 'Helvetica, Arial, sans-serif',
        'text-anchor': 'middle',
      });
      text1.textContent = b.line1;
      gStats.appendChild(text1);

      const text2 = createSvgElement('text', {
        x: tx, y: by + 19, fill: '#fff',
        'font-size': 8, 'font-weight': 'bold',
        'font-family': 'Helvetica, Arial, sans-serif',
        'text-anchor': 'middle',
      });
      text2.textContent = b.line2;
      gStats.appendChild(text2);
    }
  }
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
      const col = SHADES[p] || SHADES[0];

      // NOTE: 菱形 badge 参数 — 原版 chart.js#1173-1178 的左尖右方形状
      const labelText = formatTime(result.avg, false, isMove, true);
      const fontSize = 16;
      const tw = labelText.length * fontSize * 0.55 + 12; // 文字宽度近似
      const m = 10;       // 菱形半高
      const jm = 14;      // 左尖到文字区的水平距离

      // NOTE: 左尖 X = PA 竖柱右边缘（barCx=+30, paBarW=20, 右边缘=+40）
      const lx = getBarX(sc - 1, pSlot) + gp.barW + 40;
      const rx = lx + jm + tw;
      const cy = avgY; // 菱形垂直中心 = avg Y 坐标

      // 菱形路径（左尖右方）— 原版 chart.js#1174-1178
      const d = `M${lx},${cy}` +
        ` L${lx + jm},${cy - m}` +
        ` L${rx},${cy - m}` +
        ` L${rx},${cy + m}` +
        ` L${lx + jm},${cy + m} Z`;

      // NOTE: 用 <g> 包裹，添加 class 供拖动系统检测
      const avgBadgeGroup = createSvgElement('g', {
        class: 'chart-avg-badge',
        'data-player': p,
        'data-avg-y': cy,
        cursor: 'ns-resize',
      });

      // 菱形背景
      avgBadgeGroup.appendChild(createSvgElement('path', {
        d, fill: col,
      }));

      // 白色文字
      const text = createSvgElement('text', {
        x: lx + jm + 3, y: cy,
        'font-size': fontSize, 'font-family': 'Helvetica, Arial, sans-serif',
        fill: '#fff', 'text-anchor': 'start',
        'dominant-baseline': 'central',
        'font-weight': '700',
      });
      text.textContent = labelText;
      avgBadgeGroup.appendChild(text);

      gAvg.appendChild(avgBadgeGroup);

      // NOTE: WR badge — 白字红底圆角框
      if (isWR(state.event, 'average', result.avg)) {
        const wrX = rx - 12, wrY = cy - fontSize / 2 - 4;
        const wrW = 22, wrH = 12, wrR = 3;
        gAvg.appendChild(createSvgElement('rect', {
          x: wrX, y: wrY - wrH / 2,
          width: wrW, height: wrH, rx: wrR,
          fill: '#D32F2F',
        }));
        const wrLabel = createSvgElement('text', {
          x: wrX + wrW / 2, y: wrY + 3.5,
          'text-anchor': 'middle', fill: '#fff',
          'font-size': 8, 'font-weight': '700',
        });
        wrLabel.textContent = 'WR';
        gAvg.appendChild(wrLabel);
      }
    } else if (result && result.complete && result.avg !== undefined && result.avg >= DNF_VALUE) {
      // DNF average — 纯文字
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
