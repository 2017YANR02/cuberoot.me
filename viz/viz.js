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
const MAX_PLAYERS = 4;     // 最大对比选手数

// NOTE: 4 色方案 — HSL 基色，用于 KDE 曲线、均值线、chip 标签
const PLAYER_COLORS = [
  { h: 190, s: 90, l: 55, label: '青' },   // 青色（主色调，延续原风格）
  { h: 25,  s: 90, l: 55, label: '橙' },   // 橙色
  { h: 280, s: 70, l: 60, label: '紫' },   // 紫色
  { h: 130, s: 70, l: 50, label: '绿' },   // 绿色
];

// NOTE: 这些参数根据 dataMode 动态设置，见 recalcModeParams()
let windowSize = 100;      // 滑动窗口大小
let xMin = 2.5;            // X 轴左边界（秒）
let xMax = 9.5;            // X 轴右边界（秒）
let minBandwidth = 0;      // KDE 带宽下限（滚动统计需要）

// ─── 多选手数据 ───
// NOTE: players[i] = { wcaId, name, nameZh, color, solveData, channelData,
//   competitions, statsData, solveEntries, ghostKDE, ghostMean }
let players = [];
let activePlayerIdx = 0;   // 主选手索引（统计面板 + 脊线图跟随）
let currentEventId = '333';

// NOTE: 7 种数据模式
let dataMode = 'singles';

// NOTE: 全局日期时间线 — 所有选手比赛日期的并集，排序后作为帧序列
// currentFrame 映射到 dateTimeline[currentFrame]
let dateTimeline = [];

let currentFrame = 0;      // 窗口起始位置
let maxFrame = 0;          // 最大帧
let isPlaying = false;
let playSpeed = 0.3;
let frameAccum = 0;  // NOTE: 小数速度累加器
let animationId = null;

// NOTE: globalMaxY 需要在所有选手中取最大
let globalMaxY = 0;

// Canvas 相关
let canvas, ctx;
let cw, ch;

// ─── 初始化 ───
const _dataReadyCallbacks = [];
function onDataReady(fn) { _dataReadyCallbacks.push(fn); }

async function init() {
  canvas = document.getElementById('kdeCanvas');
  setupCanvas();
  setupControls();
  setupModeSwitcher();

  // ── 搜索框（inline 模式，嵌入 toolbar）──
  WcaPersonPicker.create(
    document.getElementById('personPickerContainer'),
    {
      mode: 'inline',
      placeholder: '搜索选手...',
      onSelect: async function (person) {
        if (person && person.wcaId) {
          await addPlayer(person.wcaId, currentEventId);
        }
      }
    }
  );

  // ── 项目选择器 ──
  document.getElementById('eventSelect').addEventListener('change', async function () {
    await reloadAllPlayers(this.value);
  });

  // ── CSV 下载（多选手时弹出选择）──
  document.getElementById('csvDownload').addEventListener('click', function () {
    if (players.length === 0) return;
    if (players.length === 1) {
      downloadCsvForPlayer(0);
    } else {
      showCsvPlayerMenu();
    }
  });

  // 默认加载耿暄一
  await addPlayer('2023GENG02', '333');
}

/**
 * NOTE: 导出指定选手的 CSV
 */
function downloadCsvForPlayer(idx) {
  const p = players[idx];
  if (!p || !p.statsData || !p.solveEntries.length) return;
  CsvExport.download({
    wcaId: p.wcaId,
    eventId: currentEventId,
    solveEntries: p.solveEntries,
    stats: p.statsData
  });
}

/**
 * NOTE: 多选手时弹出菜单让用户选择下载谁
 */
function showCsvPlayerMenu() {
  // 移除已有菜单
  const old = document.getElementById('csvPlayerMenu');
  if (old) old.remove();

  const menu = document.createElement('div');
  menu.id = 'csvPlayerMenu';
  menu.className = 'csv-player-menu';

  players.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'csv-menu-item';
    // 颜色圆点 + 名字
    item.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${playerHSL(i)};margin-right:6px;"></span>` +
      escapeHtml(p.nameZh || p.name) + ` (${p.wcaId})`;
    item.addEventListener('click', () => {
      menu.remove();
      downloadCsvForPlayer(i);
    });
    menu.appendChild(item);
  });

  // 定位在 CSV 按钮附近
  const csvBtn = document.getElementById('csvDownload');
  csvBtn.parentElement.style.position = 'relative';
  csvBtn.parentElement.appendChild(menu);

  // 点击外部关闭
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 0);
}

/**
 * NOTE: 颜色工具 — 从 PLAYER_COLORS 构造 CSS 颜色字符串
 */
function playerHSL(idx, a) {
  const c = PLAYER_COLORS[idx % PLAYER_COLORS.length];
  if (a !== undefined) return `hsla(${c.h}, ${c.s}%, ${c.l}%, ${a})`;
  return `hsl(${c.h}, ${c.s}%, ${c.l}%)`;
}

/**
 * NOTE: 添加一位选手到对比列表
 * 如果已存在相同 wcaId，跳过；如果超过 MAX_PLAYERS，提示并跳过
 */
async function addPlayer(wcaId, eventId) {
  // 防重复
  if (players.find(p => p.wcaId === wcaId)) return;
  if (players.length >= MAX_PLAYERS) {
    alert('最多同时对比 ' + MAX_PLAYERS + ' 位选手');
    return;
  }

  currentEventId = eventId;
  const loadingEl = document.getElementById('loadingOverlay');
  if (loadingEl) loadingEl.style.display = 'flex';
  pause();

  try {
    const playerData = await fetchPlayerData(wcaId, eventId);
    if (!playerData) return;

    playerData.colorIdx = players.length;
    players.push(playerData);
    activePlayerIdx = players.length - 1;

    // 重建 UI
    updatePlayerChips();
    updateTitle();
    rebuildAllChannels();

  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

/**
 * NOTE: 移除一位选手
 */
function removePlayer(idx) {
  if (idx < 0 || idx >= players.length) return;
  players.splice(idx, 1);
  // 重新分配颜色索引
  players.forEach((p, i) => { p.colorIdx = i; });
  if (activePlayerIdx >= players.length) activePlayerIdx = Math.max(0, players.length - 1);

  pause();
  updatePlayerChips();
  updateTitle();

  if (players.length === 0) {
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, cw, ch);
    return;
  }
  rebuildAllChannels();
}

/**
 * NOTE: 切换项目时，重新加载所有选手的数据
 */
async function reloadAllPlayers(eventId) {
  currentEventId = eventId;
  const wcaIds = players.map(p => p.wcaId);
  players = [];

  const loadingEl = document.getElementById('loadingOverlay');
  if (loadingEl) loadingEl.style.display = 'flex';
  pause();

  try {
    for (const id of wcaIds) {
      const data = await fetchPlayerData(id, eventId);
      if (data) {
        data.colorIdx = players.length;
        players.push(data);
      }
    }
    activePlayerIdx = 0;
    updatePlayerChips();
    updateTitle();
    rebuildAllChannels();
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

/**
 * NOTE: 从 WCA API 获取并解析选手数据，返回 player 对象
 */
async function fetchPlayerData(wcaId, eventId) {
  const [results, comps] = await Promise.all([
    WcaSearch.fetchResults(wcaId),
    WcaSearch.fetchCompetitions(wcaId)
  ]);
  if (!results || !comps) {
    alert('Failed to load data for ' + wcaId);
    return null;
  }

  const compMap = {};
  for (const c of comps) {
    compMap[c.id] = { name: c.name, date: c.start_date };
  }

  const ROUND_ORDER = { '1': 0, 'd': 1, '2': 2, 'b': 3, '3': 4, 'c': 5, 'f': 6 };
  const eventResults = results
    .filter(r => r.event_id === eventId && compMap[r.competition_id])
    .sort((a, b) => {
      const da = compMap[a.competition_id].date;
      const db = compMap[b.competition_id].date;
      if (da !== db) return da < db ? -1 : 1;
      return (ROUND_ORDER[a.round_type_id] || 0) - (ROUND_ORDER[b.round_type_id] || 0);
    });

  const competitions = [];
  const compDates = [];       // NOTE: compDates[i] = 日期字符串，与 competitions[i] 平行
  const compNameSet = new Map();
  const solveData = [];
  const solveEntries = [];

  for (const r of eventResults) {
    const compName = compMap[r.competition_id].name;
    const compDate = compMap[r.competition_id].date;
    if (!compNameSet.has(compName)) {
      compNameSet.set(compName, competitions.length);
      competitions.push(compName);
      compDates.push(compDate);
    }
    const compIdx = compNameSet.get(compName);
    const attempts = r.attempts || [];
    for (let a = 0; a < attempts.length; a++) {
      const cs = attempts[a];
      if (cs === 0) continue;
      solveData.push([cs, compIdx]);
      solveEntries.push({ cs, compName, compDate: compMap[r.competition_id].date, roundType: r.round_type_id, attemptIdx: a });
    }
  }

  const singlesCs = solveEntries.map(e => e.cs);
  const statsData = RollingStats.compute(singlesCs);

  const firstResult = eventResults[0];
  const personName = firstResult ? firstResult.name : wcaId;
  const zhMatch = personName.match(/\((.+?)\)/);

  return {
    wcaId,
    name: personName.replace(/\s*\(.+?\)/, ''),
    nameZh: zhMatch ? zhMatch[1] : personName.replace(/\s*\(.+?\)/, ''),
    solveData,
    channelData: [],
    competitions,
    compDates,
    statsData,
    solveEntries,
    ghostKDE: null,
    ghostMean: 0,
    colorIdx: 0
  };
}

/**
 * NOTE: 重建所有选手的 channelData + 日期时间线 + 重算参数 + 绘帧
 */
function rebuildAllChannels() {
  dataMode = dataMode || 'singles';
  for (const p of players) {
    buildChannelDataForPlayer(p);
  }
  buildDateTimeline();
  recalcModeParams();
  drawFrame();
  _dataReadyCallbacks.forEach(fn => fn());
}

/**
 * NOTE: 根据 dataMode 从某个 player 的数据构建 channelData
 */
function buildChannelDataForPlayer(player) {
  player.channelData = [];
  if (dataMode === 'singles') {
    player.channelData = player.solveData;
    return;
  }
  const arr = player.statsData[dataMode];
  if (!arr) return;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] !== null) {
      player.channelData.push([arr[i], player.solveData[i][1]]);
    }
  }
}

/**
 * NOTE: 构建全局日期时间线
 * 从所有选手的 channelData 中收集比赛日期，去重排序
 */
function buildDateTimeline() {
  const dateSet = new Set();
  for (const p of players) {
    for (const d of p.channelData) {
      const compIdx = d[1];
      dateSet.add(p.compDates[compIdx]);
    }
  }
  dateTimeline = Array.from(dateSet).sort();
}

/**
 * NOTE: 给定一个日期，返回该选手在此日期（含）之前最后一个 solve 的索引
 * 返回 -1 表示该日期之前没有数据
 */
function solveIdxAtDate(playerIdx, targetDate) {
  const p = players[playerIdx];
  if (!p) return -1;
  const cd = p.channelData;
  let lastIdx = -1;
  for (let i = 0; i < cd.length; i++) {
    // channelData 已按日期排序，可以提前退出
    if (p.compDates[cd[i][1]] <= targetDate) {
      lastIdx = i;
    } else {
      break;
    }
  }
  return lastIdx;
}

/**
 * NOTE: 更新标题区显示
 */
function updateTitle() {
  const evLabel = currentEventId === '333' ? '3×3' : currentEventId;
  if (players.length === 0) {
    document.getElementById('playerName').textContent = 'Distribution Evolution';
    document.getElementById('playerMeta').textContent = '';
    return;
  }
  if (players.length === 1) {
    const p = players[0];
    document.getElementById('playerName').textContent = `${p.nameZh} ${evLabel} 分布演变`;
    document.getElementById('playerMeta').textContent = `${p.name} · ${p.wcaId} · ${p.solveData.length} solves`;
  } else {
    const names = players.map(p => p.nameZh).join(' vs ');
    document.getElementById('playerName').textContent = `${names} ${evLabel} 分布对比`;
    const meta = players.map(p => `${p.name}(${p.solveData.length})`).join(' · ');
    document.getElementById('playerMeta').textContent = meta;
  }
}

/**
 * NOTE: 更新选手 chip 标签（toolbar 内的彩色标签条）
 */
function updatePlayerChips() {
  let container = document.getElementById('playerChips');
  if (!container) {
    // 首次创建，插入到 toolbar 搜索框后面
    container = document.createElement('div');
    container.id = 'playerChips';
    container.className = 'player-chips';
    const toolbar = document.querySelector('.toolbar');
    const searchEl = document.getElementById('personPickerContainer');
    toolbar.insertBefore(container, searchEl.nextSibling);
  }
  container.innerHTML = '';
  players.forEach((p, i) => {
    const chip = document.createElement('span');
    chip.className = 'player-chip';
    chip.style.borderColor = playerHSL(i, 0.6);
    chip.style.background = playerHSL(i, 0.1);
    // 国旗 + 名字
    const flag = p.iso2 ? `<span class="fi fi-${p.iso2}"></span> ` : '';
    chip.innerHTML = flag + escapeHtml(p.nameZh || p.name) +
      ' <span class="chip-remove" data-idx="' + i + '">✕</span>';
    // 点击 chip body → 设为主选手
    chip.addEventListener('click', function (e) {
      if (e.target.classList.contains('chip-remove')) return;
      activePlayerIdx = i;
      updatePlayerChips();
      drawFrame();
      if (typeof initRidgeline === 'function') initRidgeline();
    });
    // 点击 ✕ → 移除
    chip.querySelector('.chip-remove').addEventListener('click', function () {
      removePlayer(i);
    });
    // 主选手高亮
    if (i === activePlayerIdx) {
      chip.classList.add('active');
      chip.style.background = playerHSL(i, 0.2);
    }
    container.appendChild(chip);
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
// NOTE: 支持多选手 — playerIdx 参数指定选手索引
function getWindowTimes(playerIdx, frame) {
  const p = players[playerIdx];
  if (!p) return [];
  const cd = p.channelData;
  const end = Math.min(frame + windowSize, cd.length);
  const times = [];
  for (let i = frame; i < end; i++) {
    const v = cd[i][0];
    if (v > 0) times.push(v / 100);
  }
  return times;
}

function getFrameCompInfo(playerIdx, frame) {
  const p = players[playerIdx];
  if (!p) return { compName: '', solveStart: 0, solveEnd: 0 };
  const cd = p.channelData;
  const lastIdx = Math.min(frame + windowSize - 1, cd.length - 1);
  return {
    compName: p.competitions[cd[lastIdx][1]],
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
  if (players.length === 0 || dateTimeline.length === 0) return;
  const { top: mt, right: mr, bottom: mb, left: ml } = MARGIN;
  const pw = cw - ml - mr;
  const ph = ch - mt - mb;

  ctx.fillStyle = '#0c0c18';
  ctx.fillRect(0, 0, cw, ch);

  const sx = x => ml + ((x - xMin) / (xMax - xMin)) * pw;
  const sy = y => mt + ph - (y / globalMaxY) * ph;

  // NOTE: 当前帧对应的日期
  const currentDate = dateTimeline[Math.min(currentFrame, dateTimeline.length - 1)];

  // 1. 网格和坐标轴
  drawGrid(sx, sy, ml, mt, pw, ph);

  // 2. 循环绘制每位选手的 KDE 曲线
  const meanPositions = [];
  for (let pi = 0; pi < players.length; pi++) {
    const p = players[pi];
    // NOTE: 按日期找该选手窗口末尾的 solve index
    const endIdx = solveIdxAtDate(pi, currentDate);
    if (endIdx < 0) continue;  // 该日期之前该选手还没有数据

    // 窗口起始位置：从 endIdx 往前取 windowSize 个
    const pFrame = Math.max(0, endIdx - windowSize + 1);

    // 幽灵残影（只在前进过程中显示）
    if (p.ghostKDE && currentFrame > 0) {
      drawCurve(p.ghostKDE, sx, sy, {
        fill: playerHSL(pi, 0.03),
        stroke: playerHSL(pi, 0.12),
        lineWidth: 1
      });
      drawMeanLine(sx, sy, mt, ph, p.ghostMean, playerHSL(pi, 0.12), true);
    }

    const times = getWindowTimes(pi, pFrame);
    const kde = computeKDE(times);
    if (!kde) continue;
    const currentMean = mean(times);
    meanPositions.push({ pi, mean: currentMean, name: p.nameZh || p.name });

    drawCurve(kde, sx, sy, {
      fill: playerHSL(pi, 0.15),
      stroke: playerHSL(pi, 0.85),
      lineWidth: pi === activePlayerIdx ? 2.5 : 1.8,
      glow: pi === activePlayerIdx
    });

    drawMeanLine(sx, sy, mt, ph, currentMean, playerHSL(pi, 0.5), false);
  }

  // 3. 均值标签
  drawMeanLabelsOnCanvas(sx, mt, meanPositions);

  // 4. 更新主选手的 DOM 统计面板
  const ap = players[activePlayerIdx];
  if (ap) {
    const apEndIdx = solveIdxAtDate(activePlayerIdx, currentDate);
    if (apEndIdx >= 0) {
      const apFrame = Math.max(0, apEndIdx - windowSize + 1);
      const apTimes = getWindowTimes(activePlayerIdx, apFrame);
      if (apTimes.length > 0) {
        updateStats(apTimes, mean(apTimes), currentDate);
      }
    }
  }

  // 5. 隐藏旧 DOM 均值标签
  const oldLabel = document.getElementById('meanLabel');
  if (oldLabel) oldLabel.style.display = 'none';
  const oldGhost = document.getElementById('ghostMeanLabel');
  if (oldGhost) oldGhost.style.display = 'none';

  // 6. 进度条
  updateProgressUI();

  // 7. 脊线图联动（主选手）
  if (typeof highlightRidgeRow === 'function' && ap) {
    const apEndIdx = solveIdxAtDate(activePlayerIdx, currentDate);
    if (apEndIdx >= 0) highlightRidgeRow(apEndIdx);
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
function updateStats(times, currentMean, currentDate) {
  const ap = players[activePlayerIdx];
  if (!ap) return;
  const s = stddev(times);
  const delta = currentMean - ap.ghostMean;
  // NOTE: 按日期找主选手的当前比赛名
  const endIdx = solveIdxAtDate(activePlayerIdx, currentDate);
  const compIdx = endIdx >= 0 ? ap.channelData[endIdx][1] : 0;
  const compName = ap.competitions[compIdx] || '';

  document.getElementById('statMean').textContent = currentMean.toFixed(2) + 's';
  document.getElementById('statStd').textContent = 'σ ' + s.toFixed(2) + 's';
  // NOTE: 比赛名 + 日期
  document.getElementById('statComp').textContent =
    formatCompName(compName) + (currentDate ? ' (' + currentDate + ')' : '');
  document.getElementById('statWindow').textContent = `#${endIdx - windowSize + 2}–#${endIdx + 1}`;

  const deltaEl = document.getElementById('statDelta');
  deltaEl.textContent = (delta >= 0 ? '+' : '') + delta.toFixed(2) + 's';
  deltaEl.classList.toggle('improving', delta < 0);
}

/**
 * NOTE: 多选手均值标签 — 直接在 Canvas 上绘制，不用 DOM
 */
function drawMeanLabelsOnCanvas(sx, mt, meanPositions) {
  ctx.save();
  ctx.textBaseline = 'bottom';
  ctx.font = '600 12px "JetBrains Mono", monospace';
  for (const mp of meanPositions) {
    const px = sx(mp.mean);
    const label = mp.mean.toFixed(2) + 's';
    ctx.fillStyle = playerHSL(mp.pi, 0.9);
    // NOTE: 多选手时显示名字缩写 + 均值
    const text = players.length > 1 ? mp.name.slice(0, 3) + ' ' + label : '● ' + label;
    ctx.textAlign = px > cw / 2 ? 'right' : 'left';
    const offset = px > cw / 2 ? -6 : 6;
    ctx.fillText(text, px + offset, mt - 4 - mp.pi * 16);
  }
  ctx.restore();
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
      playSpeed = parseFloat(e.target.dataset.speed);
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

  // NOTE: 累加器模式支持小数 playSpeed（0.3 = 每 3-4 帧前进 1 个日期）
  frameAccum += playSpeed;
  if (frameAccum >= 1) {
    const step = Math.floor(frameAccum);
    frameAccum -= step;
    currentFrame += step;
  }

  if (currentFrame >= maxFrame) {
    currentFrame = maxFrame;
    frameAccum = 0;
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
  // NOTE: 联合所有选手的 channelData 自适应 X 轴范围
  const vals = [];
  for (const p of players) {
    for (const d of p.channelData) {
      const v = d[0] / 100;
      if (v > 0) vals.push(v);
    }
  }
  if (vals.length === 0) return;
  vals.sort((a, b) => a - b);
  const lo = vals[0] || 0;
  const p97Idx = Math.min(Math.floor(vals.length * 0.97), vals.length - 1);
  const hi = vals[p97Idx] || lo + 1;
  const margin = Math.max(0.5, (hi - lo) * 0.15);
  xMin = Math.floor((lo - margin) * 2) / 2;
  xMax = Math.ceil((hi + margin) * 2) / 2;
  if (xMin < 0) xMin = 0;

  if (dataMode === 'singles') {
    windowSize = 100;
    minBandwidth = 0;
  } else {
    windowSize = 400;
    minBandwidth = Math.max(0.15, (hi - lo) * 0.03);
  }

  // NOTE: maxFrame = 日期时间线长度 - 1
  maxFrame = Math.max(0, dateTimeline.length - 1);
  currentFrame = 0;

  // NOTE: 为每位选手预计算 ghostKDE + ghostMean（用时间线首尾日期）
  globalMaxY = 0;
  const firstDate = dateTimeline[0];
  const lastDate = dateTimeline[dateTimeline.length - 1];
  for (let pi = 0; pi < players.length; pi++) {
    const p = players[pi];
    // 初始分布：第一个日期时的窗口
    const initEndIdx = solveIdxAtDate(pi, firstDate);
    const initFrame = Math.max(0, initEndIdx - windowSize + 1);
    const initTimes = initEndIdx >= 0 ? getWindowTimes(pi, initFrame) : [];
    // 最终分布：最后一个日期时的窗口
    const finalEndIdx = solveIdxAtDate(pi, lastDate);
    const finalFrame = Math.max(0, finalEndIdx - windowSize + 1);
    const finalTimes = finalEndIdx >= 0 ? getWindowTimes(pi, finalFrame) : [];

    p.ghostKDE = computeKDE(initTimes);
    p.ghostMean = initTimes.length > 0 ? mean(initTimes) : 0;
    const finalKDE = computeKDE(finalTimes);
    const localMax = Math.max(maxOfKDE(p.ghostKDE), maxOfKDE(finalKDE));
    if (localMax > globalMaxY) globalMaxY = localMax;
  }
  globalMaxY *= 1.2;

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

      // NOTE: 重建所有选手的通道数据
      rebuildAllChannels();

      if (typeof initRidgeline === 'function') {
        initRidgeline();
      }
    });
  });
}
