/**
 * viz.js — 耿暄一 3x3 成绩分布演变可视化 (Phase 1: 动态 KDE)
 *
 * 核心流程：
 * 1. 加载 JSON 数据（1048 个成绩 × 62 场比赛）
 * 2. 滑动窗口（100 个 solve）计算 KDE
 * 3. Canvas 动画绘制曲线变形过程
 */

// ─── 常量 ───
const WINDOW_SIZE = 100;
const KDE_POINTS = 200;    // 密度曲线采样点数
const X_MIN = 2.5;         // 秒，曲线左边界
const X_MAX = 9.5;         // 秒，曲线右边界
const MARGIN = { top: 50, right: 40, bottom: 55, left: 65 };

// ─── 全局状态 ───
let solveData = [];        // [[centiseconds, compIndex], ...]
let competitions = [];     // [compName, ...]
let playerInfo = {};

let currentFrame = 0;      // 窗口起始位置
let maxFrame = 0;          // 最大帧（solveData.length - WINDOW_SIZE）
let isPlaying = false;
let playSpeed = 3;         // 每帧前进的 solve 数
let animationId = null;

// NOTE: 预计算的固定参考线,避免 Y 轴在动画中跳动
let ghostKDE = null;       // 初始分布（幽灵残影）
let ghostMean = 0;         // 初始均值
let globalMaxY = 0;        // 全局 Y 轴最大密度

// Canvas 相关
let canvas, ctx;
let cw, ch;                // Canvas 逻辑尺寸（CSS 像素）

// ─── 初始化 ───
// NOTE: 其他模块（如 ridgeline.js）可通过 onDataReady() 注册回调
const _dataReadyCallbacks = [];
function onDataReady(fn) { _dataReadyCallbacks.push(fn); }

async function init() {
  canvas = document.getElementById('kdeCanvas');

  // 加载数据
  const data = await fetch('data/geng02.json').then(r => r.json());
  playerInfo = data.player;
  competitions = data.competitions;
  solveData = data.solves;
  maxFrame = solveData.length - WINDOW_SIZE;

  // 更新页面标题
  document.getElementById('playerName').textContent =
    `${playerInfo.nameZh} 3×3 分布演变`;
  document.getElementById('playerMeta').textContent =
    `${playerInfo.name} · ${playerInfo.wcaId} · ${solveData.length} solves`;

  // 预计算初始和最终分布，确定全局 Y 轴范围
  const initTimes = getWindowTimes(0);
  const finalTimes = getWindowTimes(maxFrame);
  ghostKDE = computeKDE(initTimes);
  ghostMean = mean(initTimes);
  const finalKDE = computeKDE(finalTimes);

  globalMaxY = Math.max(
    maxOfKDE(ghostKDE),
    maxOfKDE(finalKDE)
  ) * 1.2;

  // 设置 Canvas 尺寸
  setupCanvas();
  // 绑定控制事件
  setupControls();
  // 绘制初始帧
  drawFrame();

  // 通知所有等待数据的模块
  _dataReadyCallbacks.forEach(fn => fn());
}

// ─── Canvas DPI 适配 ───
function setupCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const wrapper = canvas.parentElement;
  const w = wrapper.clientWidth;
  // 宽高比 ~16:8，最大高度 480px
  const h = Math.min(Math.round(w * 0.5), 480);

  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = w * dpr;
  canvas.height = h * dpr;

  ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  cw = w;
  ch = h;
}

// ═══════════════════════════════════════
// KDE 计算引擎
// ═══════════════════════════════════════

function gaussianKernel(u) {
  return Math.exp(-0.5 * u * u) * 0.3989422804; // 1/sqrt(2π)
}

/**
 * Silverman 法则估计带宽
 * h = 0.9 * min(σ, IQR/1.34) * n^(-1/5)
 */
function silvermanBandwidth(data) {
  const n = data.length;
  if (n < 2) return 0.3;

  const m = mean(data);
  const s = Math.sqrt(data.reduce((a, v) => a + (v - m) ** 2, 0) / (n - 1));
  const sorted = [...data].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;

  const spread = Math.min(s, iqr / 1.34);
  // 退化保护：如果数据几乎无变化，使用标准差
  return 0.9 * (spread > 0 ? spread : s) * Math.pow(n, -0.2);
}

function computeKDE(times) {
  if (times.length < 3) return null;

  const h = silvermanBandwidth(times);
  if (h <= 0) return null;

  const n = times.length;
  const step = (X_MAX - X_MIN) / (KDE_POINTS - 1);
  const points = new Array(KDE_POINTS);

  for (let i = 0; i < KDE_POINTS; i++) {
    const x = X_MIN + i * step;
    let density = 0;
    for (let j = 0; j < n; j++) {
      density += gaussianKernel((x - times[j]) / h);
    }
    points[i] = { x, y: density / (n * h) };
  }
  return points;
}

// ─── 数据提取 ───
function getWindowTimes(frame) {
  // 提取窗口内有效成绩（排除 DNF/DNS），转换为秒
  const end = Math.min(frame + WINDOW_SIZE, solveData.length);
  const times = [];
  for (let i = frame; i < end; i++) {
    if (solveData[i][0] > 0) {
      times.push(solveData[i][0] / 100);
    }
  }
  return times;
}

// ─── 工具函数 ───
function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, v) => a + (v - m) ** 2, 0) / (arr.length - 1));
}

function maxOfKDE(kde) {
  if (!kde) return 0;
  let max = 0;
  for (const p of kde) {
    if (p.y > max) max = p.y;
  }
  return max;
}

// ═══════════════════════════════════════
// 绘制引擎
// ═══════════════════════════════════════

function drawFrame() {
  const { top: mt, right: mr, bottom: mb, left: ml } = MARGIN;
  const pw = cw - ml - mr;  // 绘图区宽度
  const ph = ch - mt - mb;  // 绘图区高度

  // 清空画布
  ctx.fillStyle = '#0c0c18';
  ctx.fillRect(0, 0, cw, ch);

  // 当前窗口数据
  const times = getWindowTimes(currentFrame);
  const kde = computeKDE(times);
  if (!kde) return;

  const currentMean = mean(times);

  // 缩放函数：数据坐标 → Canvas 像素
  const sx = x => ml + ((x - X_MIN) / (X_MAX - X_MIN)) * pw;
  const sy = y => mt + ph - (y / globalMaxY) * ph;

  // 1. 网格和坐标轴
  drawGrid(sx, sy, ml, mt, pw, ph);

  // 2. 幽灵残影（初始分布）
  if (ghostKDE && currentFrame > 0) {
    drawCurve(ghostKDE, sx, sy, {
      fill: 'rgba(255,255,255,0.04)',
      stroke: 'rgba(255,255,255,0.12)',
      lineWidth: 1
    });
    // 幽灵均值线
    drawMeanLine(sx, sy, mt, ph, ghostMean, 'rgba(255,255,255,0.12)', true);
  }

  // 3. 当前 KDE 曲线
  const grad = ctx.createLinearGradient(sx(X_MIN), 0, sx(X_MAX), 0);
  grad.addColorStop(0, 'rgba(0, 230, 255, 0.22)');
  grad.addColorStop(0.4, 'rgba(80, 120, 255, 0.22)');
  grad.addColorStop(1, 'rgba(180, 60, 255, 0.22)');

  drawCurve(kde, sx, sy, {
    fill: grad,
    stroke: 'rgba(0, 230, 255, 0.85)',
    lineWidth: 2.5,
    glow: true
  });

  // 4. 当前均值线
  drawMeanLine(sx, sy, mt, ph, currentMean, 'rgba(0, 230, 255, 0.5)', false);

  // 5. 更新 DOM 统计面板
  updateStats(times, currentMean);

  // 6. 更新均值标签位置
  updateMeanLabels(sx, currentMean);

  // 7. 更新进度条
  updateProgressUI();
}

function drawGrid(sx, sy, ml, mt, pw, ph) {
  ctx.save();

  // X 轴网格线
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;

  for (let x = 3; x <= 9; x += 1) {
    const px = Math.round(sx(x)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(px, mt);
    ctx.lineTo(px, mt + ph);
    ctx.stroke();
  }

  // X 轴标签
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  for (let x = 3; x <= 9; x += 1) {
    ctx.fillText(x + 's', sx(x), mt + ph + 10);
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
  ctx.fillText('Solve time', ml + pw / 2, mt + ph + 35);

  ctx.restore();
}

function drawCurve(points, sx, sy, opts) {
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
      ctx.shadowColor = 'rgba(0, 230, 255, 0.4)';
      ctx.shadowBlur = 12;
    }

    ctx.strokeStyle = opts.stroke;
    ctx.lineWidth = opts.lineWidth || 1;
    ctx.stroke();
  }

  ctx.restore();
}

function drawMeanLine(sx, sy, mt, ph, meanVal, color, dashed) {
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

// ─── DOM 更新 ───
function updateStats(times, currentMean) {
  const s = stddev(times);
  const delta = currentMean - ghostMean;

  // 当前窗口最后一个 solve 的比赛
  const lastIdx = Math.min(currentFrame + WINDOW_SIZE - 1, solveData.length - 1);
  const compName = competitions[solveData[lastIdx][1]];

  document.getElementById('statMean').textContent = currentMean.toFixed(2) + 's';
  document.getElementById('statStd').textContent = 'σ ' + s.toFixed(2) + 's';
  document.getElementById('statComp').textContent = formatCompName(compName);
  document.getElementById('statWindow').textContent =
    `#${currentFrame + 1}–#${currentFrame + WINDOW_SIZE}`;

  const deltaEl = document.getElementById('statDelta');
  deltaEl.textContent = (delta >= 0 ? '+' : '') + delta.toFixed(2) + 's';
  deltaEl.classList.toggle('improving', delta < 0);
}

function updateMeanLabels(sx, currentMean) {
  // 当前均值标签
  const label = document.getElementById('meanLabel');
  const text = document.getElementById('meanText');
  label.style.display = 'flex';
  label.style.left = sx(currentMean) + 'px';
  text.textContent = currentMean.toFixed(2) + 's';

  // 幽灵均值标签
  if (currentFrame > 0) {
    const gLabel = document.getElementById('ghostMeanLabel');
    const gText = document.getElementById('ghostMeanText');
    gLabel.style.display = 'flex';
    gLabel.style.left = sx(ghostMean) + 'px';
    gText.textContent = ghostMean.toFixed(2) + 's';
  }
}

function formatCompName(name) {
  // CamelCase → 空格分隔，年份前加空格
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/(\D)(\d{4})/g, '$1 $2')
    .trim();
}

function updateProgressUI() {
  const progress = document.getElementById('progress');
  progress.value = currentFrame;
  // 更新填充条宽度
  const pct = maxFrame > 0 ? (currentFrame / maxFrame) * 100 : 0;
  document.getElementById('progressFill').style.width = pct + '%';
}

// ═══════════════════════════════════════
// 动画控制
// ═══════════════════════════════════════

function setupControls() {
  const progress = document.getElementById('progress');
  progress.max = maxFrame;

  // 播放按钮
  document.getElementById('playBtn').addEventListener('click', togglePlay);

  // 进度条拖拽
  progress.addEventListener('input', e => {
    currentFrame = parseInt(e.target.value);
    drawFrame();
  });

  // 速度按钮
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      playSpeed = parseInt(e.target.dataset.speed);
    });
  });

  // 键盘快捷键
  document.addEventListener('keydown', e => {
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      stepForward(e.shiftKey ? 20 : 1);
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      stepBackward(e.shiftKey ? 20 : 1);
    }
  });

  // 响应窗口大小变化
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      setupCanvas();
      drawFrame();
    }, 100);
  });
}

function togglePlay() {
  isPlaying ? pause() : play();
}

function play() {
  // 如果已到末尾，从头开始
  if (currentFrame >= maxFrame) currentFrame = 0;
  isPlaying = true;
  document.getElementById('iconPlay').style.display = 'none';
  document.getElementById('iconPause').style.display = 'block';
  animate();
}

function pause() {
  isPlaying = false;
  document.getElementById('iconPlay').style.display = 'block';
  document.getElementById('iconPause').style.display = 'none';
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

function animate() {
  if (!isPlaying) return;

  currentFrame += playSpeed;
  if (currentFrame >= maxFrame) {
    currentFrame = maxFrame;
    drawFrame();
    pause();
    return;
  }

  drawFrame();
  animationId = requestAnimationFrame(animate);
}

function stepForward(n) {
  currentFrame = Math.min(currentFrame + n, maxFrame);
  drawFrame();
}

function stepBackward(n) {
  currentFrame = Math.max(currentFrame - n, 0);
  drawFrame();
}

// ─── 启动 ───
document.addEventListener('DOMContentLoaded', init);
