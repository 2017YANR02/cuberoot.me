// NOTE: 柱子拖动交互处理器 — 从 chart_drag.js 1:1 迁移
// 命令式事件处理，通过 React useEffect 挂载/卸载
// 主要功能：tap 选中柱子、drag 调整值、PA 柱联动、avg 菱形拖动、hover、wheel、keyboard

import { useCalcStore } from '../stores/calc_store';
import { solveCountForEvent, isMbfForEvent } from '../stores/calc_store';
import {
  DNF_VALUE, clampValue,
} from '../engine/calc_engine';
import {
  getSvgEl, getGp, valToYCap,
  getBarX, getOverlay, getBarW,
  render as chartRender,
} from './chart_renderer';

// ── 拖动状态 ──

interface SelectedBar {
  playerIdx: number;
  solveIdx: number;
  pSlot: number;   // 在启用选手中的序号
}

let selected: SelectedBar | null = null;
let isDragging = false;
let dragStartY = 0;
let dragStartVal = 0;
let tapStartTime = 0;
let tapStartPos = { x: 0, y: 0 };
let handleEl: HTMLDivElement | null = null;
let hoverBar: SVGRectElement | null = null;

// NOTE: tap/drag 消歧 — 超过时间或距离阈值视为 drag
const TAP_THRESHOLD_MS = 200;
const TAP_THRESHOLD_PX = 8;

// ── 初始化 ──

/** NOTE: 挂载事件监听器，返回 cleanup 函数 */
export function initDrag(): (() => void) {
  const svgEl = getSvgEl();
  if (!svgEl) return () => {};

  const onPointerDown = (e: PointerEvent) => handlePointerDown(e);
  const onPointerMove = (e: PointerEvent) => handlePointerMove(e);
  const onPointerUp = (e: PointerEvent) => handlePointerUp(e);
  const onWheel = (e: WheelEvent) => handleWheel(e);
  const onKeyDown = (e: KeyboardEvent) => handleKeyDown(e);

  svgEl.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  svgEl.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKeyDown);

  // NOTE: hover 检测
  svgEl.addEventListener('pointermove', handleHover);

  return () => {
    svgEl.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    svgEl.removeEventListener('wheel', onWheel);
    window.removeEventListener('keydown', onKeyDown);
    svgEl.removeEventListener('pointermove', handleHover);
    deselect();
  };
}

// ── 坐标转换 ──

/** NOTE: 屏幕坐标 → SVG 坐标 */
function screenToSvg(clientX: number, clientY: number): { x: number; y: number } {
  const svgEl = getSvgEl();
  if (!svgEl) return { x: 0, y: 0 };
  const ctm = svgEl.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  return {
    x: (clientX - ctm.e) / ctm.a,
    y: (clientY - ctm.f) / ctm.d,
  };
}

// ── hit test ──

/** NOTE: 通过 SVG 坐标查找对应的柱子 */
function hitTestBar(svgX: number, svgY: number): SelectedBar | null {
  const state = useCalcStore.getState();
  const sc = solveCountForEvent(state.event);
  const gp = getGp();

  // NOTE: 检查点击位置在绘图区域内
  if (svgY < gp.chartTop || svgY > gp.chartTop + gp.chartH) return null;

  let pSlot = 0;
  for (let p = 0; p < 2; p++) {
    if (!state.playerEnabled[p]) continue;
    for (let t = 0; t < sc; t++) {
      const val = state.times[state.seedOn + p][t];
      if (val <= 0) continue; // 空格不可选

      const x = getBarX(t, pSlot);
      if (svgX >= x && svgX <= x + gp.barW) {
        // NOTE: 对于有值的柱子，只要 X 在范围内就算命中（不限 Y）
        return { playerIdx: p, solveIdx: t, pSlot };
      }
    }
    pSlot++;
  }
  return null;
}

// ── 选中/取消选中 ──

function selectBar(bar: SelectedBar): void {
  const svgEl = getSvgEl();
  if (!svgEl) return;

  selected = bar;
  svgEl.classList.add('bar-selected');

  // NOTE: 高亮选中柱子
  const barEls = svgEl.querySelectorAll('.chart-bar');
  barEls.forEach(el => {
    const dp = parseInt(el.getAttribute('data-player') || '-1');
    const ds = parseInt(el.getAttribute('data-slot') || '-1');
    if (dp === bar.playerIdx && ds === bar.solveIdx) {
      el.classList.add('bar-active');
    }
  });

  // NOTE: 创建 drag handle
  createHandle(bar);

  // NOTE: 联动输入格高亮
  syncInputHighlight(bar, true);
}

function deselect(): void {
  const svgEl = getSvgEl();
  if (!svgEl) return;

  svgEl.classList.remove('bar-selected');
  svgEl.querySelectorAll('.bar-active').forEach(el => el.classList.remove('bar-active'));

  if (selected) {
    syncInputHighlight(selected, false);
  }

  removeHandle();
  selected = null;
  isDragging = false;
}

// ── drag handle ──

function createHandle(bar: SelectedBar): void {
  removeHandle();
  const overlay = getOverlay();
  if (!overlay) return;

  handleEl = document.createElement('div');
  handleEl.className = 'bar-drag-handle' + (bar.playerIdx === 1 ? ' player-b' : '');
  handleEl.style.pointerEvents = 'auto';
  overlay.appendChild(handleEl);
  positionHandle();
}

function removeHandle(): void {
  if (handleEl) {
    handleEl.remove();
    handleEl = null;
  }
}

/** NOTE: 同步 handle 位置到选中柱子顶部 */
function positionHandle(): void {
  if (!handleEl || !selected) return;
  const svgEl = getSvgEl();
  if (!svgEl) return;

  const state = useCalcStore.getState();
  const val = state.times[state.seedOn + selected.playerIdx][selected.solveIdx];
  if (val <= 0 || val >= DNF_VALUE) {
    handleEl.style.display = 'none';
    return;
  }

  const _gp = getGp();
  const barW = getBarW();

  // NOTE: SVG 坐标 → 屏幕坐标 → overlay 相对坐标
  const x = getBarX(selected.solveIdx, selected.pSlot) + barW / 2;
  const y = valToYCap(val);

  const ctm = svgEl.getScreenCTM();
  if (!ctm) return;
  const overlay = getOverlay();
  if (!overlay) return;
  const overlayRect = overlay.getBoundingClientRect();

  const screenX = x * ctm.a + ctm.e - overlayRect.left;
  const screenY = y * ctm.d + ctm.f - overlayRect.top;

  handleEl.style.left = screenX + 'px';
  handleEl.style.top = screenY + 'px';
  handleEl.style.display = '';
  handleEl.style.width = Math.max(barW * ctm.a, 24) + 'px';
  handleEl.style.height = '16px';
  handleEl.style.borderRadius = '8px';
}

// ── 输入格联动 ──

function syncInputHighlight(bar: SelectedBar, on: boolean): void {
  // NOTE: 找到对应的 input 元素并添加/移除高亮 class
  const inputs = document.querySelectorAll('.time-cell');
  const state = useCalcStore.getState();
  const sc = solveCountForEvent(state.event);
  const inputIdx = bar.playerIdx * sc + bar.solveIdx;
  if (inputs[inputIdx]) {
    inputs[inputIdx].classList.toggle('cell-synced', on);
  }
}

// ── 事件处理 ──

function handlePointerDown(e: PointerEvent): void {
  const svgPt = screenToSvg(e.clientX, e.clientY);
  const hit = hitTestBar(svgPt.x, svgPt.y);

  tapStartTime = Date.now();
  tapStartPos = { x: e.clientX, y: e.clientY };

  if (hit) {
    e.preventDefault();
    const state = useCalcStore.getState();
    const val = state.times[state.seedOn + hit.playerIdx][hit.solveIdx];

    if (selected && selected.playerIdx === hit.playerIdx && selected.solveIdx === hit.solveIdx) {
      // NOTE: 再次点击已选中的柱子 → 开始拖动
      isDragging = true;
      dragStartY = e.clientY;
      dragStartVal = val;
    } else {
      // NOTE: 选中新柱子
      deselect();
      selectBar(hit);
      isDragging = false;
      dragStartY = e.clientY;
      dragStartVal = val;
    }
  }
}

function handlePointerMove(e: PointerEvent): void {
  if (!selected) return;

  // NOTE: tap/drag 消歧
  if (!isDragging) {
    const dx = e.clientX - tapStartPos.x;
    const dy = e.clientY - tapStartPos.y;
    const dt = Date.now() - tapStartTime;
    if (Math.sqrt(dx * dx + dy * dy) > TAP_THRESHOLD_PX || dt > TAP_THRESHOLD_MS) {
      isDragging = true;
      dragStartY = tapStartPos.y;
      const state = useCalcStore.getState();
      dragStartVal = state.times[state.seedOn + selected.playerIdx][selected.solveIdx];
    } else {
      return;
    }
  }

  if (!isDragging || !selected) return;
  e.preventDefault();

  // NOTE: 屏幕 Y 偏移 → SVG Y 偏移 → centiseconds 偏移
  const svgEl = getSvgEl();
  if (!svgEl) return;
  const ctm = svgEl.getScreenCTM();
  if (!ctm) return;

  const dyScreen = e.clientY - dragStartY;
  const dySvg = dyScreen / ctm.d;
  const gp = getGp();
  // NOTE: 向上拖 = 值变大（因为 SVG Y 轴向下，但成绩 Y 轴向上）
  const dVal = -dySvg * (gp.yRange / gp.chartH);
  const newVal = clampValue(Math.round(dragStartVal + dVal));

  if (newVal > 0 && newVal < DNF_VALUE) {
    useCalcStore.getState().updateTime(
      useCalcStore.getState().seedOn + selected.playerIdx,
      selected.solveIdx,
      newVal,
    );
    // NOTE: 重新渲染图表 + 更新 handle 位置
    chartRender({ skipViewBox: true });
    positionHandle();
  }
}

function handlePointerUp(_e: PointerEvent): void {
  if (!selected) return;

  if (!isDragging) {
    // NOTE: 这是一个 tap（非 drag） — 柱子已被 selectBar 选中，无需额外操作
  }

  isDragging = false;

  // NOTE: drag 结束后重算 viewBox（可能范围已变）
  chartRender();
  positionHandle();

  // NOTE: 同步到 URL
  useCalcStore.getState().saveToUrl();
}

function handleWheel(e: WheelEvent): void {
  if (!selected) return;
  e.preventDefault();

  const state = useCalcStore.getState();
  const val = state.times[state.seedOn + selected.playerIdx][selected.solveIdx];
  if (val <= 0 || val >= DNF_VALUE) return;

  // NOTE: 每次 wheel 调整 1 centisecond
  const delta = e.deltaY > 0 ? 1 : -1;
  // NOTE: mbf/fmc 模式下上为好（反向）
  const isMbf = isMbfForEvent(state.event);
  const finalDelta = isMbf ? -delta : delta;
  const newVal = clampValue(val + finalDelta);

  if (newVal !== val) {
    state.updateTime(state.seedOn + selected.playerIdx, selected.solveIdx, newVal);
    chartRender();
    positionHandle();
    state.saveToUrl();
  }
}

function handleKeyDown(e: KeyboardEvent): void {
  if (!selected) return;

  const state = useCalcStore.getState();
  const val = state.times[state.seedOn + selected.playerIdx][selected.solveIdx];

  // NOTE: 方向键微调
  let delta = 0;
  if (e.key === 'ArrowUp') delta = -1;    // 向上 = 更快 = 值减小
  else if (e.key === 'ArrowDown') delta = 1;
  else if (e.key === 'Escape') { deselect(); return; }
  else if (e.key === 'Delete' || e.key === 'Backspace') {
    // NOTE: 删除当前值
    state.updateTime(state.seedOn + selected.playerIdx, selected.solveIdx, 0);
    chartRender();
    deselect();
    state.saveToUrl();
    return;
  }
  else return;

  e.preventDefault();

  if (val <= 0 || val >= DNF_VALUE) return;

  // NOTE: Shift 加速 × 10
  const step = e.shiftKey ? 10 : 1;
  const isMbf = isMbfForEvent(state.event);
  const finalDelta = isMbf ? -delta * step : delta * step;
  const newVal = clampValue(val + finalDelta);

  if (newVal !== val) {
    state.updateTime(state.seedOn + selected.playerIdx, selected.solveIdx, newVal);
    chartRender();
    positionHandle();
    state.saveToUrl();
  }
}

// ── hover 检测 ──

function handleHover(e: PointerEvent): void {
  if (isDragging || selected) return;
  const svgEl = getSvgEl();
  if (!svgEl) return;

  const svgPt = screenToSvg(e.clientX, e.clientY);
  const hit = hitTestBar(svgPt.x, svgPt.y);

  // NOTE: 清除上一个 hover
  if (hoverBar) {
    hoverBar.style.filter = '';
    hoverBar = null;
  }

  if (hit) {
    const barEls = svgEl.querySelectorAll('.chart-bar');
    barEls.forEach(el => {
      const dp = parseInt(el.getAttribute('data-player') || '-1');
      const ds = parseInt(el.getAttribute('data-slot') || '-1');
      if (dp === hit.playerIdx && ds === hit.solveIdx) {
        (el as SVGRectElement).style.filter = 'brightness(1.15)';
        hoverBar = el as SVGRectElement;
      }
    });
    svgEl.style.cursor = 'pointer';
  } else {
    svgEl.style.cursor = '';
  }
}

// ── 外部触发 ──

/** NOTE: 图表重绘后更新 handle 位置（供 render 后调用） */
export function onAfterRender(): void {
  if (selected) {
    positionHandle();
  }
}

/** NOTE: 获取当前选中的柱子 */
export function getSelected(): SelectedBar | null {
  return selected;
}

/** NOTE: 外部强制取消选中 */
export function forceDeselect(): void {
  deselect();
}
