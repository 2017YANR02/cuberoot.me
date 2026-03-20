/**
 * viz.js — 通用 3x3 成绩分布演变可视化
 *
 * 核心流程：
 * 1. 通过 WCA API 加载选手数据
 * 2. 计算滚动统计（singles/mo3/ao12/ao25/ao50/ao100）
 * 3. 滑窗 KDE + Canvas 动画
 */

// ─── 常量和动态参数 ───
const KDE_POINTS = 200;    // 密度曲线采样点数
const MARGIN = { top: 50, right: 40, bottom: 55, left: 65 };

// NOTE: 这些参数根据 dataMode 动态设置，见 recalcModeParams()
let windowSize = 100;      // 滑动窗口大小
let xMin = 2.5;            // X 轴左边界（秒）
let xMax = 9.5;            // X 轴右边界（秒）
let minBandwidth = 0;      // KDE 带宽下限（滚动统计需要）

// ─── 全局状态 ───
let solveData = [];        // [[centiseconds, compIndex], ...]
let competitions = [];     // [compName, ...]
let playerInfo = {};
let currentWcaId = '';     // 当前加载的选手 WCA ID
let currentEventId = '333'; // 当前项目

// NOTE: 滚动统计结果（由 RollingStats.compute 生成）
let statsData = null;
// NOTE: solveEntries: 扁平 solve 列表，每项含元数据（用于 CSV 导出）
let solveEntries = [];

// NOTE: 6 种数据模式
let dataMode = 'singles';  // 'singles' | 'mo3' | 'ao12' | 'ao25' | 'ao50' | 'ao100'
// NOTE: 当前模式的通道数据（convertToChannelData 生成）
// channelData[i] = [value_cs, compIndex]，仅含有效值
let channelData = [];

let currentFrame = 0;      // 窗口起始位置
let maxFrame = 0;          // 最大帧
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
const _dataReadyCallbacks = [];
function onDataReady(fn) { _dataReadyCallbacks.push(fn); }

async function init() {
  canvas = document.getElementById('kdeCanvas');
  setupCanvas();
  setupControls();
  setupModeSwitcher();

  // ── 搜索框（inline 模式，嵌入 toolbar）──
  var vizPicker = WcaPersonPicker.create(
    document.getElementById('personPickerContainer'),
    {
      mode: 'inline',
      placeholder: '搜索选手...',
      onSelect: async function (person) {
        if (person && person.wcaId) {
          await loadPlayer(person.wcaId, currentEventId);
        }
      }
    }
  );

  // ── 项目选择器 ──
  document.getElementById('eventSelect').addEventListener('change', async function () {
    await loadPlayer(currentWcaId, this.value);
  });

  // ── CSV 下载 ──
  document.getElementById('csvDownload').addEventListener('click', function () {
    if (!statsData || !solveEntries.length) return;
    CsvExport.download({
      wcaId: currentWcaId,
      eventId: currentEventId,
      solveEntries: solveEntries,
      stats: statsData
    });
  });

  // 默认加载耿暄一
  await loadPlayer('2023GENG02', '333');
}

/**
 * NOTE: 加载指定选手的数据（公开接口，切换选手时调用）
 * @param {string} wcaId - WCA ID
 * @param {string} eventId - 项目 ID
 */
async function loadPlayer(wcaId, eventId) {
  currentWcaId = wcaId;
  currentEventId = eventId;

  // 显示 loading
  const loadingEl = document.getElementById('loadingOverlay');
  if (loadingEl) loadingEl.style.display = 'flex';

  // 暂停动画
  pause();

  try {
    // 并行获取成绩和比赛列表
    const [results, comps] = await Promise.all([
      WcaSearch.fetchResults(wcaId),
      WcaSearch.fetchCompetitions(wcaId)
    ]);

    if (!results || !comps) {
      alert('Failed to load data for ' + wcaId);
      return;
    }

    // 构建 compId → {name, start_date} 映射
    const compMap = {};
    for (const c of comps) {
      compMap[c.id] = { name: c.name, date: c.start_date };
    }

    // NOTE: 轮次排序权重
    const ROUND_ORDER = { '1': 0, 'd': 1, '2': 2, 'b': 3, '3': 4, 'c': 5, 'f': 6 };

    // 过滤指定项目的成绩，按 start_date + 轮次排序
    const eventResults = results
      .filter(r => r.event_id === eventId && compMap[r.competition_id])
      .sort((a, b) => {
        const da = compMap[a.competition_id].date;
        const db = compMap[b.competition_id].date;
        if (da !== db) return da < db ? -1 : 1;
        return (ROUND_ORDER[a.round_type_id] || 0) - (ROUND_ORDER[b.round_type_id] || 0);
      });

    // 展开 attempts 为扁平 singles 数组
    competitions = [];
    const compNameSet = new Map(); // compName → index
    solveData = [];
    solveEntries = [];

    for (const r of eventResults) {
      const compName = compMap[r.competition_id].name;
      if (!compNameSet.has(compName)) {
        compNameSet.set(compName, competitions.length);
        competitions.push(compName);
      }
      const compIdx = compNameSet.get(compName);

      const attempts = r.attempts || [];
      for (let a = 0; a < attempts.length; a++) {
        const cs = attempts[a];
        if (cs === 0) continue; // 未参加的 attempt 跳过
        solveData.push([cs, compIdx]);
        solveEntries.push({
          cs: cs,
          compName: compName,
          roundType: r.round_type_id,
          attemptIdx: a
        });
      }
    }

    // 提取 singles 数组用于滚动统计
    const singlesCs = solveEntries.map(e => e.cs);
    statsData = RollingStats.compute(singlesCs);

    // 选手信息
    const firstResult = eventResults[0];
    const personName = firstResult ? firstResult.name : wcaId;
    // NOTE: 从 "Xuanyi Geng (耿暄一)" 中提取中文名
    const zhMatch = personName.match(/\((.+?)\)/);
    playerInfo = {
      name: personName.replace(/\s*\(.+?\)/, ''),
      nameZh: zhMatch ? zhMatch[1] : personName.replace(/\s*\(.+?\)/, ''),
      wcaId: wcaId
    };

    // 更新标题
    document.getElementById('playerName').textContent =
      `${playerInfo.nameZh} ${eventId === '333' ? '3×3' : eventId} 分布演变`;
    document.getElementById('playerMeta').textContent =
      `${playerInfo.name} · ${wcaId} · ${solveData.length} solves`;

    // 默认 singles 模式
    dataMode = 'singles';
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector('.mode-btn[data-mode="singles"]');
    if (activeBtn) activeBtn.classList.add('active');

    // 构建通道数据并初始化参数
    buildChannelData();
    recalcModeParams();
    drawFrame();

    // 通知所有等待数据的模块
    _dataReadyCallbacks.forEach(fn => fn());

  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

/**
 * NOTE: 根据 dataMode 从 statsData 构建 channelData
 * channelData = [[value_cs, compIndex], ...] 仅含有效值（非 null/DNF）
 */
function buildChannelData() {
  channelData = [];
  if (dataMode === 'singles') {
    // singles: 直接用 solveData（含 DNF, getWindowTimes 会跳过）
    channelData = solveData;
    return;
  }
  // 滚动统计模式：筛选有效值
  const arr = statsData[dataMode];
  if (!arr) { channelData = []; return; }
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] !== null) {
      channelData.push([arr[i], solveData[i][1]]);
    }
  }
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

  let h = silvermanBandwidth(times);
  if (h <= 0) return null;
  // Ao100 数据高度自相关，Silverman 会给出极小带宽，强制下限
  if (minBandwidth > 0 && h < minBandwidth) h = minBandwidth;

  const n = times.length;
  const step = (xMax - xMin) / (KDE_POINTS - 1);
  const points = new Array(KDE_POINTS);

  for (let i = 0; i < KDE_POINTS; i++) {
    const x = xMin + i * step;
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
  // 统一从 channelData 提取窗口数据
  const end = Math.min(frame + windowSize, channelData.length);
  const times = [];
  for (let i = frame; i < end; i++) {
    const v = channelData[i][0];
    // singles 模式需要排除 DNF/DNS（<= 0），统计模式数据已过滤
    if (v > 0) times.push(v / 100);
  }
  return times;
}

/**
 * 获取当前帧最后一个数据点对应的比赛名和序号范围
 */
function getFrameCompInfo(frame) {
  const lastIdx = Math.min(frame + windowSize - 1, channelData.length - 1);
  return {
    compName: competitions[channelData[lastIdx][1]],
    solveStart: frame + 1,
    solveEnd: frame + windowSize
  };
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
  const sx = x => ml + ((x - xMin) / (xMax - xMin)) * pw;
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
  const grad = ctx.createLinearGradient(sx(xMin), 0, sx(xMax), 0);
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

  // 8. 联动脊线图高亮
  if (typeof highlightRidgeRow === 'function') {
    const lastIdx = Math.min(currentFrame + windowSize - 1, channelData.length - 1);
    highlightRidgeRow(lastIdx);
  }
}

function drawGrid(sx, sy, ml, mt, pw, ph) {
  ctx.save();

  // NOTE: 动态刻度间距 — 目标 5~8 个刻度
  const range = xMax - xMin;
  const rawStep = range / 6;
  // niceStep: 从 [1, 2, 5, 10, 20, 50, ...] 中选最近的
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / mag;
  const niceStep = residual <= 1.5 ? mag : residual <= 3.5 ? 2 * mag : residual <= 7.5 ? 5 * mag : 10 * mag;

  const gridStart = Math.ceil(xMin / niceStep) * niceStep;

  // X 轴网格线
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = gridStart; x <= xMax; x += niceStep) {
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

  for (let x = gridStart; x <= xMax; x += niceStep) {
    // NOTE: 大数值用整数，小数值保留小数
    const label = niceStep >= 1 ? Math.round(x) + 's' : x.toFixed(1) + 's';
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
  const info = getFrameCompInfo(currentFrame);

  document.getElementById('statMean').textContent = currentMean.toFixed(2) + 's';
  document.getElementById('statStd').textContent = 'σ ' + s.toFixed(2) + 's';
  document.getElementById('statComp').textContent = formatCompName(info.compName);
  document.getElementById('statWindow').textContent =
    `#${info.solveStart}–#${info.solveEnd}`;

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
  // NOTE: progress.max 由 recalcModeParams() 统一设置

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
    // NOTE: 焦点在 input/textarea 时不拦截键盘事件
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
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

// ═══════════════════════════════════════
// 模式切换（Singles / Ao100）
// ═══════════════════════════════════════

/**
 * 根据当前 dataMode 重新计算 maxFrame、ghostKDE、ghostMean、globalMaxY
 * 并重置进度条
 */
function recalcModeParams() {
  // NOTE: 所有模式统一从 channelData 自适应 X 轴范围
  // 高极端值用 P97 百分位截断（早期异常慢成绩不应拉大横轴），低极端值保留
  const vals = [];
  for (const d of channelData) {
    const v = d[0] / 100;
    if (v > 0) vals.push(v);
  }
  vals.sort((a, b) => a - b);
  const lo = vals[0] || 0;
  // NOTE: xMax 用 P97 而非最大值，滤除高位离群点
  const p97Idx = Math.min(Math.floor(vals.length * 0.97), vals.length - 1);
  const hi = vals[p97Idx] || lo + 1;
  // 留 ~15% 两侧边距（最少 0.5s）
  const margin = Math.max(0.5, (hi - lo) * 0.15);
  xMin = Math.floor((lo - margin) * 2) / 2;
  xMax = Math.ceil((hi + margin) * 2) / 2;
  if (xMin < 0) xMin = 0;

  if (dataMode === 'singles') {
    windowSize = 100;
    minBandwidth = 0;
  } else {
    // NOTE: 滚动统计模式：大窗口 + 带宽下限
    windowSize = 400;
    minBandwidth = Math.max(0.15, (hi - lo) * 0.03); // 带宽按数据范围缩放
  }

  maxFrame = channelData.length - windowSize;
  if (maxFrame < 0) maxFrame = 0;

  // 重置帧位置
  currentFrame = 0;

  // 预计算初始和最终分布
  const initTimes = getWindowTimes(0);
  const finalTimes = getWindowTimes(maxFrame);
  ghostKDE = computeKDE(initTimes);
  ghostMean = initTimes.length > 0 ? mean(initTimes) : 0;
  const finalKDE = computeKDE(finalTimes);

  globalMaxY = Math.max(
    maxOfKDE(ghostKDE),
    maxOfKDE(finalKDE)
  ) * 1.2;

  // 更新进度条范围
  const progress = document.getElementById('progress');
  progress.max = maxFrame;
  progress.value = 0;
  document.getElementById('progressFill').style.width = '0%';
}

function setupModeSwitcher() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const newMode = e.target.dataset.mode;
      if (newMode === dataMode) return;

      pause();
      dataMode = newMode;
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');

      // 重建通道数据并重算参数
      buildChannelData();
      recalcModeParams();
      drawFrame();

      if (typeof initRidgeline === 'function') {
        initRidgeline();
      }
    });
  });
}
