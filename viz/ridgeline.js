/**
 * ridgeline.js — 脊线图 (Ridgeline / Joy Division Plot)
 *
 * 按比赛分组，每场比赛独立计算 KDE，纵向堆叠展示分布演变。
 * 复用 viz.js 中的 KDE 计算函数（gaussianKernel, silvermanBandwidth 等）。
 *
 * 策略：62 场比赛太密，做智能合并——
 * 相邻比赛中 solve 数太少的（<15）合并到下一场，确保每条 KDE 至少 15 个数据点。
 */

// ─── 常量 ───
const RIDGE_KDE_POINTS = 150;   // 每条曲线的采样点数
// NOTE: X 轴范围复用 viz.js 的全局变量 xMin/xMax
const RIDGE_MARGIN = { top: 30, right: 40, bottom: 45, left: 180 };
const ROW_HEIGHT = 32;          // 每行基础高度
const OVERLAP_RATIO = 0.6;      // 曲线向上溢出比例（山脊重叠效果）

// ─── 数据结构 ───
// { label: string, times: number[], startIdx: number, endIdx: number }
let ridgeGroups = [];
let ridgeKDEs = [];             // 每组的 KDE 曲线
let ridgeMaxDensity = 0;        // 全局最大密度（用于统一缩放）

// Canvas
let rCanvas, rCtx;
let rcw, rch;                   // 逻辑尺寸

// 高亮行索引（Phase 3 联动用）
let highlightRow = -1;

// ─── 初始化 ───
function initRidgeline() {
  rCanvas = document.getElementById('ridgelineCanvas');
  if (!rCanvas) return;

  // 按比赛分组数据
  buildGroups();
  // 计算所有组的 KDE
  computeAllKDEs();
  // 设置 Canvas
  setupRidgeCanvas();
  // 绘制
  drawRidgeline();

  // 点击交互：点击某行 → KDE 跳转到该比赛对应位置
  rCanvas.addEventListener('click', onRidgeClick);
}

/**
 * 脊线图点击 → KDE 跳转（双向联动）
 * 根据点击 Y 坐标确定行索引，将 KDE 窗口移到该比赛中间
 */
function onRidgeClick(e) {
  const rect = rCanvas.getBoundingClientRect();
  const y = e.clientY - rect.top;

  // 根据 Y 坐标计算行索引
  const rowIdx = Math.floor((y - RIDGE_MARGIN.top) / ROW_HEIGHT);
  if (rowIdx < 0 || rowIdx >= ridgeGroups.length) return;

  const group = ridgeGroups[rowIdx];
  // 将 KDE 窗口移到该比赛的中间位置
  const targetFrame = Math.max(0, Math.min(
    group.startIdx - Math.floor(windowSize / 2),
    maxFrame
  ));

  // 暂停动画，跳转到目标帧
  if (typeof pause === 'function') pause();
  currentFrame = targetFrame;
  drawFrame();
}

/**
 * 按比赛分组数据
 * 合并策略：每组至少 10 个有效数据，否则与下一场合并
 * NOTE: 统一使用 channelData（已根据 dataMode 构建）
 */
function buildGroups() {
  ridgeGroups = [];
  const minSolves = 10;

  let currentGroup = null;

  for (let i = 0; i < channelData.length; i++) {
    const compIdx = channelData[i][1];
    const compName = competitions[compIdx];

    if (!currentGroup || currentGroup.compIdx !== compIdx) {
      if (currentGroup) {
        if (currentGroup.validCount >= minSolves) {
          ridgeGroups.push(currentGroup);
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
          validCount: 0
        };
      }
    }

    currentGroup.endIdx = i;
    currentGroup.compIdx = compIdx;

    // channelData 中非 singles 模式的值已全部有效（buildChannelData 过滤过）
    if (channelData[i][0] > 0) {
      currentGroup.times.push(channelData[i][0] / 100);
      currentGroup.validCount++;
    }
  }

  if (currentGroup && currentGroup.validCount >= 3) {
    ridgeGroups.push(currentGroup);
  }
}

function computeAllKDEs() {
  ridgeKDEs = [];
  ridgeMaxDensity = 0;

  const step = (xMax - xMin) / (RIDGE_KDE_POINTS - 1);

  for (const group of ridgeGroups) {
    if (group.times.length < 3) {
      ridgeKDEs.push(null);
      continue;
    }

    let h = silvermanBandwidth(group.times);
    if (h <= 0) {
      ridgeKDEs.push(null);
      continue;
    }
    // 应用最低带宽（Ao100 模式避免尖刺）
    if (minBandwidth > 0 && h < minBandwidth) h = minBandwidth;

    const n = group.times.length;
    const points = new Array(RIDGE_KDE_POINTS);

    for (let i = 0; i < RIDGE_KDE_POINTS; i++) {
      const x = xMin + i * step;
      let density = 0;
      for (let j = 0; j < n; j++) {
        density += gaussianKernel((x - group.times[j]) / h);
      }
      points[i] = { x, y: density / (n * h) };
      if (points[i].y > ridgeMaxDensity) {
        ridgeMaxDensity = points[i].y;
      }
    }

    ridgeKDEs.push(points);
  }
}

function setupRidgeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const wrapper = rCanvas.parentElement;
  const w = wrapper.clientWidth;

  // 高度取决于行数
  const rows = ridgeGroups.length;
  const h = RIDGE_MARGIN.top + RIDGE_MARGIN.bottom + rows * ROW_HEIGHT;

  rCanvas.style.width = w + 'px';
  rCanvas.style.height = h + 'px';
  rCanvas.width = w * dpr;
  rCanvas.height = h * dpr;

  rCtx = rCanvas.getContext('2d');
  rCtx.scale(dpr, dpr);

  rcw = w;
  rch = h;
}

// ═══════════════════════════════════════
// 绘制
// ═══════════════════════════════════════

function drawRidgeline() {
  const { top: mt, right: mr, bottom: mb, left: ml } = RIDGE_MARGIN;
  const pw = rcw - ml - mr;
  const rows = ridgeGroups.length;

  // 清空
  rCtx.fillStyle = '#0c0c18';
  rCtx.fillRect(0, 0, rcw, rch);

  // X 缩放函数
  const sx = x => ml + ((x - xMin) / (xMax - xMin)) * pw;

  // 曲线高度缩放：每条曲线的最大高度 = ROW_HEIGHT * (1 + OVERLAP_RATIO)
  const curveMaxH = ROW_HEIGHT * (1 + OVERLAP_RATIO);

  // NOTE: X 轴刻度间距 — 与主图相同的 niceStep 算法
  const rRange = xMax - xMin;
  const rRawStep = rRange / 6;
  const rMag = Math.pow(10, Math.floor(Math.log10(rRawStep)));
  const rRes = rRawStep / rMag;
  const rNiceStep = rRes <= 1.5 ? rMag : rRes <= 3.5 ? 2 * rMag : rRes <= 7.5 ? 5 * rMag : 10 * rMag;
  const rGridStart = Math.ceil(xMin / rNiceStep) * rNiceStep;

  // X 轴网格
  rCtx.strokeStyle = 'rgba(255,255,255,0.04)';
  rCtx.lineWidth = 1;
  for (let x = rGridStart; x <= xMax; x += rNiceStep) {
    const px = Math.round(sx(x)) + 0.5;
    rCtx.beginPath();
    rCtx.moveTo(px, mt - 10);
    rCtx.lineTo(px, rch - mb);
    rCtx.stroke();
  }

  // X 轴标签
  rCtx.fillStyle = 'rgba(255,255,255,0.35)';
  rCtx.font = '11px "JetBrains Mono", monospace';
  rCtx.textAlign = 'center';
  rCtx.textBaseline = 'top';
  for (let x = rGridStart; x <= xMax; x += rNiceStep) {
    const label = rNiceStep >= 1 ? Math.round(x) + 's' : x.toFixed(1) + 's';
    rCtx.fillText(label, sx(x), rch - mb + 8);
  }

  // 从底部向上绘制（最早的在顶部，最新的在底部）
  for (let i = rows - 1; i >= 0; i--) {
    const kde = ridgeKDEs[i];
    if (!kde) continue;

    const group = ridgeGroups[i];
    // 每行的基线 Y 坐标
    const baseY = mt + i * ROW_HEIGHT + ROW_HEIGHT;

    // 颜色：从暖色（顶部/早期）到冷色（底部/近期）
    const t = rows > 1 ? i / (rows - 1) : 0;
    const hue = lerp(25, 200, t);       // 橙色 → 青色
    const sat = lerp(80, 90, t);
    const light = lerp(55, 60, t);

    const isHighlighted = (i === highlightRow);
    const alpha = isHighlighted ? 0.45 : 0.2;
    const strokeAlpha = isHighlighted ? 0.95 : 0.6;
    const fillColor = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
    const strokeColor = `hsla(${hue}, ${sat}%, ${light}%, ${strokeAlpha})`;

    // 绘制填充区域
    rCtx.beginPath();
    rCtx.moveTo(sx(kde[0].x), baseY);
    for (const p of kde) {
      const h = (p.y / ridgeMaxDensity) * curveMaxH;
      rCtx.lineTo(sx(p.x), baseY - h);
    }
    rCtx.lineTo(sx(kde[kde.length - 1].x), baseY);
    rCtx.closePath();

    rCtx.fillStyle = fillColor;
    rCtx.fill();

    // 绘制描边
    rCtx.beginPath();
    rCtx.moveTo(sx(kde[0].x), baseY - (kde[0].y / ridgeMaxDensity) * curveMaxH);
    for (let j = 1; j < kde.length; j++) {
      const h = (kde[j].y / ridgeMaxDensity) * curveMaxH;
      rCtx.lineTo(sx(kde[j].x), baseY - h);
    }
    rCtx.strokeStyle = strokeColor;
    rCtx.lineWidth = isHighlighted ? 2 : 1.2;
    rCtx.stroke();

    // 左侧标签
    const labelText = formatRidgeLabel(group.label);
    rCtx.fillStyle = isHighlighted
      ? 'rgba(255,255,255,0.95)'
      : 'rgba(255,255,255,0.45)';
    rCtx.font = isHighlighted
      ? '500 11px Inter, sans-serif'
      : '11px Inter, sans-serif';
    rCtx.textAlign = 'right';
    rCtx.textBaseline = 'middle';
    rCtx.fillText(labelText, ml - 10, baseY - ROW_HEIGHT * 0.3);
  }
}

// ─── 工具 ───
function lerp(a, b, t) {
  return a + (b - a) * t;
}

function formatRidgeLabel(name) {
  // CamelCase → 短标签，截断过长的名字
  const formatted = name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/(\D)(\d{4})/g, '$1 \'$2')
    .replace(/'20/g, "'")
    .trim();

  // 截断到最大字符数
  return formatted.length > 25 ? formatted.slice(0, 24) + '…' : formatted;
}

/**
 * 外部调用：高亮指定比赛行（Phase 3 联动）
 * @param {number} solveIndex - 当前 solve 序号
 */
function highlightRidgeRow(solveIndex) {
  // 找到该 solve 所在的 ridge 组
  let newRow = -1;
  for (let i = 0; i < ridgeGroups.length; i++) {
    if (solveIndex >= ridgeGroups[i].startIdx &&
        solveIndex <= ridgeGroups[i].endIdx) {
      newRow = i;
      break;
    }
  }

  if (newRow !== highlightRow) {
    highlightRow = newRow;
    drawRidgeline();

    // 自动滚动容器，让高亮行可见
    if (newRow >= 0 && rCanvas) {
      const wrapper = rCanvas.parentElement;
      const rowY = RIDGE_MARGIN.top + newRow * ROW_HEIGHT;
      const wrapperH = wrapper.clientHeight;
      // 将高亮行居中显示
      const targetScroll = rowY - wrapperH / 2 + ROW_HEIGHT;
      wrapper.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
  }
}

// ─── 响应窗口大小 ───
window.addEventListener('resize', () => {
  if (!rCanvas) return;
  // NOTE: 使用 viz.js 中已有的 debounce 机制，这里简单延迟
  setTimeout(() => {
    setupRidgeCanvas();
    drawRidgeline();
  }, 120);
});

// ─── 启动 ───
// 通过 viz.js 提供的回调机制，在数据加载完成后初始化
onDataReady(initRidgeline);

