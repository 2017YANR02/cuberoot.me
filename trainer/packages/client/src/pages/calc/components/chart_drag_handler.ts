// NOTE: 柱子拖动交互处理器 — 从 chart_drag.js 1:1 迁移
// 命令式事件处理，通过 React useEffect 挂载/卸载
// 主要功能：tap 选中柱子、drag 调整值、PA 柱联动、avg 菱形拖动、hover、wheel、keyboard

import { useCalcStore } from '../stores/calc_store';
import { solveCountForEvent, isMbfForEvent } from '../stores/calc_store';
import {
  DNF_VALUE, clampValue, getAverage, reverseAvgToTime,
} from '../engine/calc_engine';
import {
  getSvgEl, getGp, valToYCap, yToVal,
  getBarX, getOverlay, getBarW,
  render as chartRender,
  registerPostRenderCallback,
  getPaBarData,
} from './chart_renderer';

// ── 拖动状态 ──

interface SelectedBar {
  playerIdx: number;
  solveIdx: number;
}

let selected: SelectedBar | null = null;
let isDragging = false;
let isPointerDown = false;  // NOTE: 防止松手后 pointermove 误触发拖拽
let wasAlreadySelected = false; // NOTE: 区分"再次 tap 已选中柱子"和"首次选中"
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

  // NOTE: 注册 post-render 回调 — chartRender 重建 DOM 后自动重新标记选中柱子
  registerPostRenderCallback(reapplySelection);

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

  // NOTE: 订阅 focusedCell — InputGrid 单元格被选中时联动高亮对应柱子
  let prevFocused = useCalcStore.getState().focusedCell;
  const unsubFocus = useCalcStore.subscribe((state) => {
    const [p, t] = state.focusedCell;
    if (p === prevFocused[0] && t === prevFocused[1]) return;
    prevFocused = state.focusedCell;

    const seedOn = state.seedOn;
    if (p >= 0 && t >= 0) {
      const relP = p - seedOn;
      if (relP >= 0) {
        deselect();
        selectBar({ playerIdx: relP, solveIdx: t });
      }
    } else {
      deselect();
    }
  });

  return () => {
    svgEl.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    svgEl.removeEventListener('wheel', onWheel);
    window.removeEventListener('keydown', onKeyDown);
    svgEl.removeEventListener('pointermove', handleHover);
    unsubFocus();
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

/** NOTE: 原版使用 SVG DOM 事件委托（e.target.closest('.chart-bar')）
 *  但这里无法直接用 DOM 事件（因为 pointerdown 监听器在 SVG 上），
 *  所以用坐标计算 + 重叠 Y 消歧来模拟 */
function hitTestBar(svgX: number, svgY: number): SelectedBar | null {
  const state = useCalcStore.getState();
  const sc = solveCountForEvent(state.event);
  const gp = getGp();

  // NOTE: 检查点击位置在绘图区域内
  if (svgY < gp.chartTop || svgY > gp.chartTop + gp.chartH) return null;

  // NOTE: 1. 先通过 x 坐标确定 solveIdx（slot）
  let solveIdx = -1;
  for (let t = 0; t < sc; t++) {
    const x = getBarX(t, 0);
    if (svgX >= x && svgX <= x + gp.barW) {
      solveIdx = t;
      break;
    }
  }
  if (solveIdx < 0) return null;

  // NOTE: 2. 找出此 slot 中有值的选手
  const candidates: { p: number; val: number }[] = [];
  for (let p = 0; p < 2; p++) {
    if (!state.playerEnabled[p]) continue;
    const val = state.times[state.seedOn + p][solveIdx];
    if (val > 0) candidates.push({ p, val });
  }
  if (candidates.length === 0) return null;
  if (candidates.length === 1) {
    return { playerIdx: candidates[0].p, solveIdx };
  }

  // NOTE: 3. 两个选手都有值 → 重叠 Y 消歧（原版 resolveBarAtY）
  // 较矮柱子（值较小/较好）在上层，如果点击 Y 在较矮柱顶以下 → 命中较矮柱
  const valA = state.times[state.seedOn + 0][solveIdx];
  const valB = state.times[state.seedOn + 1][solveIdx];
  const isMbf = isMbfForEvent(state.event);
  // NOTE: 在多盲模式下 higher=better（柱子更高），普通模式下 lower=better（柱子更矮）
  const shorterP = isMbf ? (valA < valB ? 0 : 1) : (valA < valB ? 0 : 1);
  const tallerP = 1 - shorterP;
  const shorterVal = state.times[state.seedOn + shorterP][solveIdx];
  const shorterTop = valToYCap(shorterVal);

  // NOTE: 如果点击 Y 在较矮柱顶以下（加 5px 容差）→ 命中较矮（上层）柱子
  if (svgY >= shorterTop - 3) {
    return { playerIdx: shorterP, solveIdx };
  }
  // NOTE: 否则命中较高（底层）柱子
  return { playerIdx: tallerP, solveIdx };
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

  // NOTE: 联动 Drum — 通过 store.focusedCell 通知滚筒显示对应格子的值
  useCalcStore.getState().setFocusedCell(bar.playerIdx, bar.solveIdx);
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

/** NOTE: chartRender 重建 DOM 后重新标记选中柱子（bar-active + bar-selected） */
function reapplySelection(): void {
  if (!selected) return;
  const svgEl = getSvgEl();
  if (!svgEl) return;
  svgEl.classList.add('bar-selected');
  svgEl.querySelectorAll('.chart-bar').forEach(el => {
    const dp = parseInt(el.getAttribute('data-player') || '-1');
    const ds = parseInt(el.getAttribute('data-slot') || '-1');
    if (dp === selected!.playerIdx && ds === selected!.solveIdx) {
      el.classList.add('bar-active');
    }
  });
}

// ── drag handle ──

function createHandle(bar: SelectedBar): void {
  removeHandle();
  const overlay = getOverlay();
  if (!overlay) return;

  handleEl = document.createElement('div');
  handleEl.className = 'bar-drag-handle' + (bar.playerIdx === 1 ? ' player-b' : '');
  handleEl.style.pointerEvents = 'auto';
  handleEl.style.cursor = 'ns-resize';
  overlay.appendChild(handleEl);

  // NOTE: handle 上独立注册 pointerdown — 原版 chart_drag.js 的核心交互入口
  // setPointerCapture 确保指针离开元素后仍跟踪，实现流畅拖动
  handleEl.addEventListener('pointerdown', (e: PointerEvent) => {
    if (!selected) return;
    e.preventDefault();
    e.stopPropagation(); // 阻止冒泡到 SVG pointerdown 引起重复选中

    const state = useCalcStore.getState();
    dragStartY = e.clientY;
    dragStartVal = state.times[state.seedOn + selected.playerIdx][selected.solveIdx];
    isPointerDown = true;
    isDragging = true;

    // NOTE: 捕获 pointer — 指针离开 handle 后仍跟踪（原版关键机制）
    handleEl!.setPointerCapture(e.pointerId);
  });

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

  const barW = getBarW();

  // NOTE: SVG 坐标 → 屏幕坐标 → overlay 相对坐标
  const x = getBarX(selected.solveIdx, 0) + barW / 2;
  const y = valToYCap(val);

  const ctm = svgEl.getScreenCTM();
  if (!ctm) return;
  const overlay = getOverlay();
  if (!overlay) return;
  const overlayRect = overlay.getBoundingClientRect();

  const screenX = x * ctm.a + ctm.e - overlayRect.left;
  const screenY = y * ctm.d + ctm.f - overlayRect.top;

  // NOTE: Both 模式下内侧柱子宽度缩窄为 barW * 0.55，handle 跟随
  const pe = state.playerEnabled;
  const bothOn = pe[state.seedOn] && pe[state.seedOn + 1];
  let effectiveW = barW;
  if (bothOn) {
    // NOTE: 检查另一选手对应 slot 是否也有值 — 有值才是重叠模式
    const otherP = selected.playerIdx === 0 ? 1 : 0;
    const otherVal = state.times[state.seedOn + otherP]?.[selected.solveIdx] ?? 0;
    if (otherVal > 0 && otherVal < DNF_VALUE) {
      // NOTE: 较矮柱子（值更小 = 更矮）用缩窄宽度
      if (val < otherVal) {
        effectiveW = barW * 0.55;
      }
    }
  }

  handleEl.style.left = screenX + 'px';
  handleEl.style.top = screenY + 'px';
  handleEl.style.display = '';
  handleEl.style.width = Math.max(effectiveW * ctm.a, 24) + 'px';
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
  // NOTE: 先检测是否点击了 PA 柱或 Avg 菱形 badge（DOM 事件委托）
  const target = e.target as Element;

  // PA 柱点击 → 创建 overlay pill handle + 启动 PA 拖动
  const paBarEl = target.closest('.chart-pa-bar') as SVGRectElement | null;
  if (paBarEl) {
    e.preventDefault();
    const p = parseInt(paBarEl.getAttribute('data-player') || '0');
    // 判断点击靠近 WPA 端还是 BPA 端
    const svgPt = screenToSvg(e.clientX, e.clientY);
    const wpaY = parseFloat(paBarEl.getAttribute('data-wpa-y') || '0');
    const bpaY = parseFloat(paBarEl.getAttribute('data-bpa-y') || '0');
    const paEnd = Math.abs(svgPt.y - wpaY) < Math.abs(svgPt.y - bpaY) ? 'wpa' : 'bpa';
    startPaDrag(e, p, paEnd);
    return;
  }

  // Avg 菱形 badge 点击 → 启动 Avg 拖动
  const avgBadgeEl = target.closest('.chart-avg-badge') as SVGGElement | null;
  if (avgBadgeEl) {
    e.preventDefault();
    const p = parseInt(avgBadgeEl.getAttribute('data-player') || '0');
    startAvgDrag(e, p, avgBadgeEl);
    return;
  }

  const svgPt = screenToSvg(e.clientX, e.clientY);
  const hit = hitTestBar(svgPt.x, svgPt.y);

  tapStartTime = Date.now();
  tapStartPos = { x: e.clientX, y: e.clientY };
  isPointerDown = true;

  if (hit) {
    e.preventDefault();
    const state = useCalcStore.getState();
    const val = state.times[state.seedOn + hit.playerIdx][hit.solveIdx];

    if (selected && selected.playerIdx === hit.playerIdx && selected.solveIdx === hit.solveIdx) {
      // NOTE: 再次按下已选中柱子 → 准备拖拽消歧，deselect 延迟到 pointerup
      wasAlreadySelected = true;
      isDragging = false;
      dragStartY = e.clientY;
      dragStartVal = val;
    } else {
      // NOTE: 选中新柱子 + 准备拖拽消歧
      wasAlreadySelected = false;
      deselect();
      selectBar(hit);
      isDragging = false;
      dragStartY = e.clientY;
      dragStartVal = val;
    }
  }
}

function handlePointerMove(e: PointerEvent): void {
  if (!selected || !isPointerDown) return;

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
    reapplySelection();
    positionHandle();
  }
}

function handlePointerUp(_e: PointerEvent): void {
  isPointerDown = false;
  if (!selected) return;

  if (isDragging) {
    // NOTE: drag 结束后重算 viewBox（可能范围已变）
    chartRender();
    reapplySelection();
    positionHandle();

    // NOTE: 同步到 URL
    useCalcStore.getState().saveToUrl();

    // NOTE: 拖拽完成后取消选中
    deselect();
  } else if (wasAlreadySelected) {
    // NOTE: 对已选中柱子的快速单击（tap）→ toggle 取消选中
    deselect();
  }
  // NOTE: 首次选中柱子的 tap → 保持选中（不做任何事）

  isDragging = false;
  wasAlreadySelected = false;
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

// ── PA 柱拖动 — 拖动 PA 端反向推算第 4 把 ──
// NOTE: 原版 chart_drag.js#746-846

function startPaDrag(e: PointerEvent, p: number, paEnd: string): void {
  deselect();
  const state = useCalcStore.getState();
  const sc = solveCountForEvent(state.event);
  const times = state.times[state.seedOn + p];

  // NOTE: 从缓存获取 PA 柱位置数据
  const paInfo = getPaBarData().find(info => info.playerIdx === p);
  if (!paInfo) return;

  // NOTE: 找到空缺 slot（未填的那一把）— PA 拖动仅在有空缺时生效
  let emptyIdx = -1;
  for (let i = 0; i < sc; i++) {
    if (times[i] === 0) { emptyIdx = i; break; }
  }
  if (emptyIdx < 0) return; // 5 把全填完 → 不可 PA 拖动，应使用 Avg badge 拖动
  const targetSlot = emptyIdx - 1;
  const targetOrigVal = times[targetSlot];
  if (targetOrigVal <= 0 || targetOrigVal >= DNF_VALUE) return;

  const fixed: number[] = [];
  for (let i = 0; i < sc; i++) {
    if (i !== targetSlot && i !== emptyIdx && times[i] > 0 && times[i] < DNF_VALUE) {
      fixed.push(times[i]);
    }
  }
  if (fixed.length < 3) return;
  fixed.sort((a, b) => a - b);

  const fixedSum = paEnd === 'wpa' ? fixed[1] + fixed[2] : fixed[0] + fixed[1];

  // NOTE: 创建 overlay pill handle（复用 bar-drag-handle 样式）
  const overlay = getOverlay();
  if (!overlay) return;
  const paHandle = document.createElement('div');
  paHandle.className = 'bar-drag-handle' + (p === 1 ? ' player-b' : '');
  paHandle.style.pointerEvents = 'auto';
  paHandle.style.cursor = 'ns-resize';
  overlay.appendChild(paHandle);

  // NOTE: 定位 handle 到 PA 端点
  const svgEl = getSvgEl();
  if (!svgEl) { paHandle.remove(); return; }
  const ctm = svgEl.getScreenCTM();
  if (!ctm) { paHandle.remove(); return; }
  const overlayRect = overlay.getBoundingClientRect();
  const endY = paEnd === 'wpa' ? paInfo.wpaY : paInfo.bpaY;
  const screenX = paInfo.cx * ctm.a + ctm.e - overlayRect.left;
  const screenY = endY * ctm.d + ctm.f - overlayRect.top;
  paHandle.style.left = screenX + 'px';
  paHandle.style.top = screenY + 'px';
  paHandle.style.display = '';
  paHandle.style.width = Math.max(paInfo.w * ctm.a, 24) + 'px';
  paHandle.style.height = '16px';
  paHandle.style.borderRadius = '8px';
  paHandle.style.transform = 'translate(-50%, -50%)';

  document.body.style.userSelect = 'none';

  // NOTE: 注册拖动事件
  const startSvgY = screenToSvg(e.clientX, e.clientY).y;
  const dragOffsetY = startSvgY - endY;

  const onMove = (em: PointerEvent) => {
    em.preventDefault();
    const pt = screenToSvg(em.clientX, em.clientY);
    const adjustedY = pt.y - dragOffsetY;
    const targetPA = Math.round(yToVal(adjustedY));
    const x = 3 * targetPA - fixedSum;
    if (x <= 0) return;
    const clamped = clampValue(Math.round(x));

    state.times[state.seedOn + p][targetSlot] = clamped;
    chartRender({ skipViewBox: true });

    // NOTE: 更新 handle 位置
    const newPaInfo = getPaBarData().find(info => info.playerIdx === p);
    if (newPaInfo && svgEl) {
      const newCtm = svgEl.getScreenCTM();
      if (newCtm) {
        const newOverlayRect = overlay.getBoundingClientRect();
        const newEndY = paEnd === 'wpa' ? newPaInfo.wpaY : newPaInfo.bpaY;
        paHandle.style.top = (newEndY * newCtm.d + newCtm.f - newOverlayRect.top) + 'px';
      }
    }
  };

  const onUp = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.body.style.userSelect = '';
    paHandle.remove();

    const currentVal = state.times[state.seedOn + p][targetSlot];
    if (currentVal !== targetOrigVal && currentVal > 0) {
      state.updateTime(state.seedOn + p, targetSlot, currentVal);
    }
    chartRender();
    state.saveToUrl();
  };

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

// ── Avg 菱形 badge 拖动 — 反向推算 #5 ──
// NOTE: 原版 chart_drag.js#852-944

function startAvgDrag(e: PointerEvent, p: number, avgBadgeEl: SVGGElement): void {
  deselect();
  const state = useCalcStore.getState();
  const sc = solveCountForEvent(state.event);
  const times = state.times[state.seedOn + p];

  // NOTE: 目标 slot = 最后一把（#5, index=sc-1）
  const targetSlot = sc - 1;
  const targetOrigVal = times[targetSlot];

  // NOTE: 收集前 sc-1 个值
  const filled: number[] = [];
  for (let i = 0; i < sc - 1; i++) {
    if (times[i] > 0 && times[i] < DNF_VALUE) filled.push(times[i]);
  }
  if (filled.length < sc - 1) return;
  filled.sort((a, b) => a - b);

  // NOTE: 计算 BPA/WPA 范围限制
  const bpa = getAverage([...filled, 0], true);
  const wpa = getAverage([...filled, DNF_VALUE], true);
  if (bpa >= DNF_VALUE || wpa >= DNF_VALUE) return;

  const badgeAvgY = parseFloat(avgBadgeEl.getAttribute('data-avg-y') || '0');
  const svgPt = screenToSvg(e.clientX, e.clientY);
  const dragOffsetY = svgPt.y - badgeAvgY;
  document.body.style.userSelect = 'none';

  const onMove = (em: PointerEvent) => {
    em.preventDefault();
    const pt = screenToSvg(em.clientX, em.clientY);
    const adjustedY = pt.y - dragOffsetY;

    // NOTE: Y → 目标 avg → clamp 到 BPA~WPA 范围
    let targetAvg = Math.round(yToVal(adjustedY));
    const lo = Math.min(bpa, wpa);
    const hi = Math.max(bpa, wpa);
    targetAvg = Math.max(lo, Math.min(hi, targetAvg));

    // NOTE: 反向推算 #5
    const x = reverseAvgToTime(filled, targetAvg);
    if (x === null || x <= 0) return;

    state.times[state.seedOn + p][targetSlot] = x;
    chartRender({ skipViewBox: true });
  };

  const onUp = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.body.style.userSelect = '';

    const currentVal = state.times[state.seedOn + p][targetSlot];
    if (currentVal !== targetOrigVal && currentVal > 0) {
      state.updateTime(state.seedOn + p, targetSlot, currentVal);
    }
    chartRender();
    state.saveToUrl();
  };

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}
