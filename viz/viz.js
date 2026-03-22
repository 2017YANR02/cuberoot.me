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

// NOTE: WCA 轮次类型 ID → 英文/中文名称，供 tooltip 和 CSV 导出共用
const ROUND_NAMES = {
  '1': 'Round 1', 'd': 'Combined R1',
  '2': 'Round 2', 'b': 'Combined R2',
  '3': 'Semi Final', 'c': 'Combined Final', 'f': 'Final'
};
const ROUND_ZH = {
  '1': '初赛', 'd': '初赛(联合)',
  '2': '复赛', 'b': '复赛(联合)',
  '3': '半决赛', 'c': '决赛(联合)', 'f': '决赛'
};

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

// NOTE: 用户缩放/平移覆盖（null 表示使用自动范围）
let userXMin = null;
let userXMax = null;
// NOTE: 折线图 X 轴可见范围（solve 序号，1-based；null = 全量）
let lineXStart = null;
let lineXEnd = null;

// ─── 多选手数据 ───
// NOTE: players[i] = { wcaId, name, nameZh, color, solveData, channelData,
//   competitions, statsData, solveEntries, ghostKDE, ghostMean }
let players = [];
let activePlayerIdx = 0;   // 主选手索引（统计面板 + 脊线图跟随）
let currentEventId = '333';

// NOTE: 7 种数据模式
let dataMode = 'singles';
let viewMode = 'kde';  // NOTE: 'kde' | 'histogram' | 'line' | 'cumHist'

// NOTE: FMC 成绩是步数（整数），非厘秒
function isFMC() { return currentEventId === '333fm'; }
function isMBLD() { return currentEventId === '333mbf'; }
// NOTE: MBLD 得分越高越好（和时间/步数相反）
function isHigherBetter() { return isMBLD(); }

// NOTE: 原始值 → 显示值
function rawToVal(v) {
  if (isFMC()) return v;
  if (isMBLD()) {
    // 编码: 0DDTTTTTMM → score = 99 - DD
    const s = String(v).padStart(10, '0');
    const dd = parseInt(s.slice(1, 3), 10);
    const mm = parseInt(s.slice(8, 10), 10);
    const diff = 99 - dd;
    const solved = diff + mm;
    return solved - mm;  // = diff = 99 - DD
  }
  return v / 100;
}
// NOTE: 格式化显示值
function fmtVal(v) {
  if (isFMC()) return Math.round(v) + ' moves';
  if (isMBLD()) return Math.round(v) + ' pts';
  return v.toFixed(2) + 's';
}

// NOTE: 全局日期时间线 — 所有选手比赛日期的并集，排序后作为帧序列
// currentFrame 映射到 dateTimeline[currentFrame]
let dateTimeline = [];

let currentFrame = 0;      // 窗口起始位置
let maxFrame = 0;          // 最大帧
let isPlaying = false;
let playSpeed = 3;
let animationId = null;
let driverIdx = 0;  // NOTE: 帧驱动选手索引（channelData 最长者，自动选择）
let syncMode = 'solve';  // NOTE: 'solve' = 按把数比例，'date' = 按日期同步

// NOTE: 图层显隐控制（药丸开关）
// NOTE: 默认隐藏当前值和均值竖线，减少视觉噪音
const showLayers = { currentVal: false, meanLine: false, ghost: true, trail: true, bimodal: true, followMean: false };

// NOTE: 折线图 hover 状态（像素坐标，null 表示鼠标不在画布上）
let _lineHoverX = null;
let _lineHoverY = null;

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
  // NOTE: 后台预加载比赛国家数据，updateStats 中国旗展示依赖此缓存
  WcaCompData.load();

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
        // NOTE: viz 用 chip 展示选手，不需要 picker 的名片卡
        // 隐藏名片、清空并显示输入框，方便继续搜索下一位
        const container = document.getElementById('personPickerContainer');
        const selected = container.querySelector('.wca-pp-selected');
        const pickerInput = container.querySelector('.wca-pp-input');
        if (selected) selected.style.display = 'none';
        if (pickerInput) {
          pickerInput.value = '';
          pickerInput.style.display = '';
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
    stats: p.statsData,
    roundMetrics: p.roundMetrics
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
 * NOTE: 单选手变色 — 根据当前均值与初始均值的差异插值 hue
 * 改善（delta<0）→ 绿色(hue=130)，退步（delta>0）→ 红色(hue=0)
 * 仅单选手 + colorShift 开启时生效
 */
function getShiftedHSL(pi, alpha, currentMean) {
  const p = players[pi];
  if (players.length > 1 || !p.ghostMean || p.ghostMean <= 0) {
    return playerHSL(pi, alpha);
  }
  const c = PLAYER_COLORS[pi % PLAYER_COLORS.length];
  // delta 占初始均值的比例，clamp 到 [-0.3, 0.3]
  let ratio = Math.max(-0.3, Math.min(0.3, (currentMean - p.ghostMean) / p.ghostMean));
  // NOTE: MBLD 得分越高越好，ratio 反转使正方向=绿色
  if (isHigherBetter()) ratio = -ratio;
  // ratio < 0 → 改善 → hue 往绿(130)偏；ratio > 0 → 退步 → hue 往红(0)偏
  const t = ratio / 0.3;  // [-1, 1]
  let targetHue;
  if (t <= 0) {
    targetHue = c.h + (-t) * (130 - c.h);  // 基色→绿
  } else {
    targetHue = c.h + t * (c.h - 0);        // 基色→红（减小 hue）
    targetHue = c.h * (1 - t);              // 简化：线性插值到 0
  }
  if (alpha !== undefined) return `hsla(${Math.round(targetHue)}, ${c.s}%, ${c.l}%, ${alpha})`;
  return `hsl(${Math.round(targetHue)}, ${c.s}%, ${c.l}%)`;
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
    // NOTE: WCA 官方 average（厘秒），仅填入轮次第一把，供 CSV 导出使用
    const roundAvg = (r.average && r.average > 0) ? r.average : null;
    let isFirstAttempt = true;  // 轮内第一个有效 attempt
    for (let a = 0; a < attempts.length; a++) {
      const cs = attempts[a];
      if (cs === 0) continue;
      solveData.push([cs, compIdx]);
      solveEntries.push({
        cs, compName, compDate: compMap[r.competition_id].date,
        roundType: r.round_type_id, attemptIdx: a,
        average: isFirstAttempt ? roundAvg : null
      });
      isFirstAttempt = false;
    }
  }

  const singlesCs = solveEntries.map(e => e.cs);
  const statsData = RollingStats.compute(singlesCs);
  // NOTE: 轮次衍生指标（BAo5/WAo5 等），供 CSV 导出和折线图使用
  const roundMetricsData = RoundMetrics.compute(solveEntries);

  // NOTE: 构建 WCA 官方 avg 数组（从 solveEntries.average 取，轮次第一把有值）
  const avgArr = new Array(solveEntries.length).fill(null);
  const avgPb = new Array(solveEntries.length).fill(false);
  let bestAvgVal = Infinity;
  for (let i = 0; i < solveEntries.length; i++) {
    const av = solveEntries[i].average;
    if (av !== null && av !== undefined && av > 0) {
      avgArr[i] = av;
      if (av < bestAvgVal) {
        bestAvgVal = av;
        avgPb[i] = true;
      }
    }
  }
  roundMetricsData.avg = avgArr;
  roundMetricsData.pbFlags.avg = avgPb;

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
    roundMetrics: roundMetricsData,
    solveEntries,
    ghostKDE: null,
    ghostMean: 0,
    colorIdx: 0,
    meanTrail: []   // NOTE: 均值轨迹拖尾 [{ x: meanVal, frame: frameIdx }]
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
 * channelData[j] = [value, compDateIndex, originalSolveIndex(1-based)]
 * 第三个元素仅 AoN 模式有，用于 tooltip 显示正确的把数序号
 */
function buildChannelDataForPlayer(player) {
  player.channelData = [];
  if (dataMode === 'singles') {
    player.channelData = player.solveData;
    return;
  }
  // NOTE: Round Metrics 的 key 从 roundMetrics 取，Rolling Stats 从 statsData 取
  const isRound = player.roundMetrics && player.roundMetrics[dataMode] !== undefined;
  const arr = isRound ? player.roundMetrics[dataMode] : player.statsData[dataMode];
  if (!arr) return;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] !== null) {
      player.channelData.push([arr[i], player.solveData[i][1], i + 1]);
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
 * NOTE: 日期间线性插值版本 — 让非 driver 选手在两场比赛之间平滑过渡
 * 返回插值后的 endIdx（可能是小数，外部需 Math.round）
 */
function interpolatedSolveIdx(playerIdx, targetDate) {
  const p = players[playerIdx];
  if (!p) return -1;
  const cd = p.channelData;

  // 阶梯版定位
  const prevIdx = solveIdxAtDate(playerIdx, targetDate);
  if (prevIdx < 0) return -1;
  if (prevIdx >= cd.length - 1) return prevIdx;  // 已到末尾

  const prevDate = p.compDates[cd[prevIdx][1]];

  // 找下一个不同日期的首个 solve
  let nextIdx = -1;
  let nextDate = null;
  for (let i = prevIdx + 1; i < cd.length; i++) {
    const d = p.compDates[cd[i][1]];
    if (d > prevDate) {
      nextIdx = i;
      nextDate = d;
      break;
    }
  }

  // 没有下一个日期，或 targetDate 正好在 prevDate 上 → 不插值
  if (nextIdx < 0 || targetDate <= prevDate) return prevIdx;

  // NOTE: 日期 → 数值，做线性插值
  const tNum = dateToNum(targetDate);
  const pNum = dateToNum(prevDate);
  const nNum = dateToNum(nextDate);
  if (nNum <= pNum) return prevIdx;

  const ratio = Math.min(1, (tNum - pNum) / (nNum - pNum));
  return Math.round(prevIdx + ratio * (nextIdx - prevIdx));
}

/**
 * NOTE: YYYY-MM-DD → 可比较数值（无需 Date 对象，高性能）
 */
function dateToNum(d) {
  const parts = d.split('-');
  return parts[0] * 10000 + parts[1] * 100 + parts[2] * 1;
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

  // NOTE: 多选手时显示同步模式切换按钮
  const syncGroup = document.getElementById('syncGroup');
  if (syncGroup) syncGroup.style.display = players.length > 1 ? 'flex' : 'none';
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
    if (v > 0) times.push(rawToVal(v));
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

/**
 * NOTE: 自适应刻度步长选择
 * 从 [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, ...] 序列中
 * 选择最接近 rawStep 的"美观"步长
 */
function pickNiceStep(rawStep) {
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const r = rawStep / mag;  // r 在 [1, 10) 区间
  const nice = r <= 1.5 ? 1 : r <= 3.5 ? 2 : r <= 7.5 ? 5 : 10;
  return nice * mag;
}

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
// 同步模式下的帧定位
// ═══════════════════════════════════════

/**
 * NOTE: 根据 syncMode 计算某选手在当前 progress 下的窗口起始帧
 * 'solve' 模式：纯比例（把数对应）
 * 'date'  模式：连续时间映射（日期同步，丝滑版）
 */
function computePlayerFrame(pi, progress) {
  const p = players[pi];
  const pMax = Math.max(0, p.channelData.length - windowSize);
  if (pMax === 0) return 0;

  if (syncMode === 'solve' || players.length <= 1) {
    return Math.round(progress * pMax);
  }

  // ─── date 模式：全局日期范围映射 ───
  // NOTE: 用所有选手的最早/最晚日期作为全局时间轴，
  //       避免某选手参赛时间跨度远大于 driver 时被跳过
  let globalFirst = Infinity, globalLast = -Infinity;
  for (const pl of players) {
    const f = dateToNum(pl.compDates[pl.channelData[0][1]]);
    const l = dateToNum(pl.compDates[pl.channelData[pl.channelData.length - 1][1]]);
    if (f < globalFirst) globalFirst = f;
    if (l > globalLast) globalLast = l;
  }
  if (globalLast <= globalFirst) return Math.round(progress * pMax);

  // 当前连续日期数值（线性插值全局起止日期）
  const currentDateNum = globalFirst + progress * (globalLast - globalFirst);

  // 该选手的时间跨度
  const pFirst = dateToNum(p.compDates[p.channelData[0][1]]);
  const pLast = dateToNum(p.compDates[p.channelData[p.channelData.length - 1][1]]);
  if (pLast <= pFirst) return Math.round(progress * pMax);

  // 映射全局日期到该选手的时间跨度
  const pProgress = (currentDateNum - pFirst) / (pLast - pFirst);
  return Math.round(Math.max(0, Math.min(1, pProgress)) * pMax);
}

// ═══════════════════════════════════════
// 双峰检测
// ═══════════════════════════════════════

/**
 * NOTE: 扫描 KDE 曲线找出显著的局部极大值（峰）
 * 返回 [{ x, y }]，过滤掉低于最高峰 15% 的噪声
 */
function detectPeaks(kde) {
  if (!kde || kde.length < 3) return [];
  const raw = [];
  for (let i = 1; i < kde.length - 1; i++) {
    if (kde[i].y > kde[i - 1].y && kde[i].y > kde[i + 1].y) {
      raw.push({ x: kde[i].x, y: kde[i].y });
    }
  }
  if (raw.length === 0) return [];
  const maxY = Math.max(...raw.map(p => p.y));
  return raw.filter(p => p.y >= maxY * 0.15);
}

// ═══════════════════════════════════════
// 直方图
// ═══════════════════════════════════════

/**
 * NOTE: Freedman-Diaconis 规则计算直方图 bins
 * 返回 [{ xStart, xEnd, count, density }]
 * density = count / (n × binWidth)，用于和 KDE 叠加时共享 Y 轴
 */
function computeHistogram(times, viewRange) {
  if (!times || times.length < 2) return [];
  const sorted = [...times].sort((a, b) => a - b);
  const n = sorted.length;
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;

  // Freedman-Diaconis bin 宽度，兜底 5~30 bins
  let binWidth = 2 * iqr * Math.pow(n, -1 / 3);
  const range = sorted[n - 1] - sorted[0];
  if (binWidth <= 0 || range / binWidth > 30) binWidth = range / 30;
  if (range / binWidth < 5) binWidth = range / 5;
  if (binWidth <= 0) binWidth = 0.1;

  // NOTE: 放大时基于可见范围缩小 bin 宽度（目标 ~20 个可见 bin）
  if (viewRange && viewRange > 0 && viewRange < range) {
    const zoomedBinWidth = viewRange / 20;
    // 选择美观步长（对齐到 0.05, 0.1, 0.2, 0.5 等）
    binWidth = pickNiceStep(zoomedBinWidth);
  }

  const bins = [];
  const start = sorted[0] - binWidth * 0.5;
  const numBins = Math.ceil((sorted[n - 1] - start) / binWidth) + 1;
  for (let i = 0; i < numBins; i++) {
    bins.push({ xStart: start + i * binWidth, xEnd: start + (i + 1) * binWidth, count: 0, density: 0 });
  }
  for (const t of times) {
    const idx = Math.min(Math.floor((t - start) / binWidth), bins.length - 1);
    if (idx >= 0) bins[idx].count++;
  }
  // 归一化为密度（和 KDE 兼容）
  for (const b of bins) {
    b.density = b.count / (n * binWidth);
  }
  return bins;
}

/**
 * NOTE: 绘制直方图柱
 * useDensity: true → Y 轴为概率密度（叠加模式），false → Y 轴为频次
 */
function drawHistogram(bins, sx, sy, pi, useDensity) {
  if (!bins || bins.length === 0) return;
  ctx.save();
  const fillColor = getShiftedHSL(pi, 0.25, (bins[0].xStart + bins[bins.length - 1].xEnd) / 2);
  const strokeColor = getShiftedHSL(pi, 0.5, (bins[0].xStart + bins[bins.length - 1].xEnd) / 2);
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
      ctx.fillStyle = getShiftedHSL(pi, 0.8, (b.xStart + b.xEnd) / 2);
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.count, (x1 + x2) / 2, top - 3);
      ctx.restore();
    }
  }
  ctx.restore();
}

// ═══════════════════════════════════════
// 折线图
// ═══════════════════════════════════════

/**
 * NOTE: 折线图专用网格 — X=把数，Y=成绩值
 * 和 drawGrid 不同：X 轴是离散把数，Y 轴是成绩（而非密度）
 */
function drawLineGrid(lsx, lsy, ml, mt, pw, ph, yMin, yMax, totalSolves) {
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
    const label = isFMC() || isMBLD()
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

  // X 轴标签（把数）— 使用 totalSolves 而非 windowSize
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  // NOTE: 根据可见范围动态调整刻度间距
  const visStart = arguments[9] || 1;
  const visEnd = arguments[10] || totalSolves || windowSize;
  const visRange = visEnd - visStart;
  const xRawStep = visRange / 8;
  const xMag = Math.pow(10, Math.floor(Math.log10(Math.max(1, xRawStep))));
  const xRes = xRawStep / xMag;
  const xStep = xRes <= 1.5 ? xMag : xRes <= 3.5 ? 2 * xMag : xRes <= 7.5 ? 5 * xMag : 10 * xMag;
  const xTickStart = Math.ceil(visStart / xStep) * xStep;
  for (let x = xTickStart; x <= visEnd; x += xStep) {
    ctx.fillText(Math.round(x) + '', lsx(x), mt + ph + 10);
  }

  // 轴标签
  ctx.save();
  ctx.translate(16, mt + ph / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isFMC() ? 'Moves' : isMBLD() ? 'Score (pts)' : 'Solve time (s)', 0, 0);
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Solve #', ml + pw / 2, mt + ph + 35);

  ctx.restore();
}

/**
 * NOTE: 折线图绘制 — 每位选手一条折线
 * times: 成绩数组（已转秒，可含 null 表示 DNF），lsx/lsy: 坐标映射
 * totalSolves: X 轴总把数（用于计算填充底部）
 */
/**
 * NOTE: cutoff >= 0 时分两段绘制：[0, cutoff] 亮色，(cutoff, end] 淡色
 * cutoff < 0 表示全量高亮（未在播放或已播完）
 */
function drawLineChart(times, lsx, lsy, pi, totalSolves, cutoff) {
  if (!times || times.length < 2) return;
  ctx.save();

  const validTimes = times.filter(t => t !== null);
  if (validTimes.length === 0) { ctx.restore(); return; }
  const m = mean(validTimes);
  const color = getShiftedHSL(pi, 0.85, m);
  const dimColor = getShiftedHSL(pi, 0.2, m);
  const fillColor = getShiftedHSL(pi, 0.08, m);
  // NOTE: cutoff < 0 表示全量高亮
  const effectiveCutoff = cutoff >= 0 ? cutoff : times.length;

  // 半透明填充区域（只填充到 cutoff）
  const { top: _mt, bottom: _mb } = MARGIN;
  const _ph = ch - _mt - _mb;
  const bottomPy = _mt + _ph;
  ctx.beginPath();
  let started = false;
  const fillEnd = Math.min(effectiveCutoff, times.length);
  for (let i = 0; i < fillEnd; i++) {
    if (times[i] === null) continue;
    const px = lsx(i + 1);
    const py = lsy(times[i]);
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
    const py = lsy(times[i]);
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
    // 从 cutoff 开始继续（不断开）
    for (let i = Math.max(0, effectiveCutoff - 1); i < times.length; i++) {
      if (times[i] === null) continue;
      const px = lsx(i + 1);
      const py = lsy(times[i]);
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

// ═══════════════════════════════════════
// 折线图帧渲染（独立路径）
// ═══════════════════════════════════════

/**
 * NOTE: 折线图的完整渲染 — 展示全量成绩（非滑窗）
 * X 轴: 全部把数 (1 ~ n)
 * Y 轴: 成绩值 (xMin ~ xMax)
 * 进度条位置用竖线高亮标记
 */
function drawFrameLine(mt, mr, mb, ml, pw, ph) {
  // NOTE: 播放进度映射到数据索引（-1 表示全量高亮）
  const ap = players[activePlayerIdx];
  const totalSolves = ap ? ap.channelData.length : 100;
  const progressIdx = maxFrame > 0
    ? Math.round((currentFrame / maxFrame) * (totalSolves - 1))
    : -1;

  // NOTE: Y 轴范围 — 复用 xMin/xMax（成绩范围），支持用户缩放
  let viewYMin = userXMin !== null ? userXMin : xMin;
  let viewYMax = userXMax !== null ? userXMax : xMax;

  // NOTE: X 轴可见范围（支持横向缩放/平移）
  const visStart = lineXStart !== null ? lineXStart : 1;
  const visEnd = lineXEnd !== null ? lineXEnd : totalSolves;

  // NOTE: 横向缩放时 Y 轴自适应可见数据范围（用户未手动设置 Y 时才启用）
  if (userXMin === null && lineXStart !== null) {
    let dataMin = Infinity, dataMax = -Infinity;
    for (let pi = 0; pi < players.length; pi++) {
      const data = players[pi].channelData;
      for (let i = 0; i < data.length; i++) {
        const solveNo = i + 1;
        if (solveNo < visStart - 1 || solveNo > visEnd + 1) continue;
        const v = rawToVal(data[i][0]);
        if (v > 0) { dataMin = Math.min(dataMin, v); dataMax = Math.max(dataMax, v); }
      }
    }
    if (dataMin < dataMax) {
      const pad = (dataMax - dataMin) * 0.05;
      viewYMin = dataMin - pad;
      viewYMax = dataMax + pad;
    }
  }

  // 坐标映射：X=可见范围(visStart~visEnd)，Y=成绩值
  const lsx = n => ml + ((n - visStart) / Math.max(1, visEnd - visStart)) * pw;
  const lsy = v => mt + ph - ((v - viewYMin) / (viewYMax - viewYMin)) * ph;

  // 1. 网格（传入可见范围用于 X 轴刻度）
  drawLineGrid(lsx, lsy, ml, mt, pw, ph, viewYMin, viewYMax, totalSolves, visStart, visEnd);

  // 2. 绘制每位选手的全量折线
  const allPlayerTimes = [];  // NOTE: [{ times, indices, pbFlags, entries }]
  const meanPositions = [];
  for (let pi = 0; pi < players.length; pi++) {
    const p = players[pi];
    // NOTE: 提取全量有效成绩 + 原始 solve 序号
    const fullTimes = [];
    const origIndices = [];
    for (let i = 0; i < p.channelData.length; i++) {
      const v = rawToVal(p.channelData[i][0]);
      if (v > 0) fullTimes.push(v);
      else fullTimes.push(null);  // DNF 等无效值
      // 第三个元素是原始索引（AoN 模式），Singles 模式用 i+1
      origIndices.push(p.channelData[i][2] || (i + 1));
    }
    // NOTE: PB 标记 — 根据 dataMode 从对应数据源获取
    //   singles → statsData.pbFlags.singles
    //   mo3/ao5/ao12/ao25/ao50/ao100 → statsData.pbFlags[dataMode]
    //   bao5/wao5 等轮次指标 → roundMetrics.pbFlags[dataMode]
    let pbArr = null;
    if (dataMode === 'singles' && p.statsData && p.statsData.pbFlags) {
      pbArr = p.statsData.pbFlags.singles;
    } else if (p.statsData && p.statsData.pbFlags && p.statsData.pbFlags[dataMode]) {
      pbArr = p.statsData.pbFlags[dataMode];
    } else if (p.roundMetrics && p.roundMetrics.pbFlags && p.roundMetrics.pbFlags[dataMode]) {
      pbArr = p.roundMetrics.pbFlags[dataMode];
    }
    allPlayerTimes.push({ times: fullTimes, indices: origIndices, pbFlags: pbArr, entries: p.solveEntries });

    // 绘制折线
    drawLineChart(fullTimes, lsx, lsy, pi, totalSolves, progressIdx);

    // 均值水平线（用全量数据的均值）
    const validTimes = fullTimes.filter(t => t !== null);
    if (validTimes.length > 0) {
      const currentMean = mean(validTimes);
      meanPositions.push({ pi, mean: currentMean, name: p.nameZh || p.name });

      if (showLayers.meanLine) {
        const meanPy = lsy(currentMean);
        ctx.save();
        ctx.strokeStyle = getShiftedHSL(pi, 0.4, currentMean);
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(ml, meanPy);
        ctx.lineTo(ml + pw, meanPy);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // NOTE: 播放进度竖线
  if (progressIdx >= 0) {
    const curPx = lsx(progressIdx + 1);
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(curPx, mt);
    ctx.lineTo(curPx, mt + ph);
    ctx.stroke();
    ctx.restore();
  }

  // 3. 均值标签（右侧）
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.font = '600 11px "JetBrains Mono", monospace';
  for (const mp of meanPositions) {
    const py = lsy(mp.mean);
    const namePrefix = players.length > 1 ? mp.name.slice(0, 3) + ' ' : '';
    ctx.fillStyle = playerHSL(mp.pi, 0.8);
    ctx.textAlign = 'left';
    ctx.fillText(namePrefix + fmtVal(mp.mean), ml + pw + 4, py);
  }
  ctx.restore();

  // 4.5 PB 红色标记点 — 主选手所有模式
  {
    const apData = allPlayerTimes[activePlayerIdx];
    if (apData && apData.pbFlags) {
      ctx.save();
      for (let i = 0; i < apData.times.length; i++) {
        if (apData.times[i] === null) continue;
        // NOTE: origIndices 保存了 1-based 原始索引，pbFlags 基于原始数组
        const origI = apData.indices[i] - 1;
        if (!apData.pbFlags[origI]) continue;
        const px = lsx(i + 1);
        const py = lsy(apData.times[i]);
        // NOTE: 可见范围外的点跳过
        if (px < ml - 5 || px > ml + pw + 5) continue;
        // NOTE: progressIdx 之后（未到达）的 PB 点显示为淡色
        const isFuture = progressIdx >= 0 && i > progressIdx;
        ctx.fillStyle = isFuture ? 'rgba(230, 50, 50, 0.22)' : 'rgba(230, 50, 50, 0.85)';
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // 5. hover tooltip — 卡片式（比赛名+轮次、单次/平均+进步百分比）
  if (_lineHoverX !== null && allPlayerTimes.length > 0) {
    // 像素 → 把数索引（考虑可见范围）
    const solveIdx = Math.round(visStart + (_lineHoverX - ml) / pw * (visEnd - visStart)) - 1;
    if (solveIdx >= 0 && solveIdx < totalSolves) {
      const tooltipX = lsx(solveIdx + 1);
      // 十字线（竖线）
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tooltipX, mt);
      ctx.lineTo(tooltipX, mt + ph);
      ctx.stroke();
      ctx.restore();

      // 高亮各选手在该把数的数据点
      for (let pi = 0; pi < allPlayerTimes.length; pi++) {
        const { times: ft } = allPlayerTimes[pi];
        if (solveIdx < ft.length && ft[solveIdx] !== null) {
          const dotY = lsy(ft[solveIdx]);
          ctx.save();
          ctx.fillStyle = playerHSL(pi, 0.9);
          ctx.beginPath();
          ctx.arc(tooltipX, dotY, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // NOTE: 构建卡片内容行
      const cardLines = [];  // [{ text, color, bold }]
      for (let pi = 0; pi < allPlayerTimes.length; pi++) {
        const { times: ft, indices: origIdx, entries } = allPlayerTimes[pi];
        if (solveIdx >= ft.length || ft[solveIdx] === null) continue;
        const val = ft[solveIdx];
        const dispIdx = origIdx[solveIdx];

        // NOTE: 比赛名 + 轮次（从 solveEntries 获取，用原始索引映射）
        const origSolveI = dispIdx - 1;  // origIndices 是 1-based
        const entry = entries ? entries[origSolveI] : null;
        if (entry) {
          const roundLabel = ROUND_ZH[entry.roundType] || ROUND_NAMES[entry.roundType] || entry.roundType;
          // NOTE: 多选手时在比赛名前加选手名
          const prefix = players.length > 1 ? (players[pi].nameZh || players[pi].name) + ' — ' : '';
          cardLines.push({ text: prefix + entry.compName + ' | ' + roundLabel, color: 'rgba(255,255,255,0.7)', bold: false });
        }

        // NOTE: 成绩 + 进步百分比
        let progressStr = '';
        // 查找前一个有效成绩来计算进步百分比
        for (let prev = solveIdx - 1; prev >= 0; prev--) {
          if (ft[prev] !== null) {
            const delta = (ft[prev] - val) / ft[prev] * 100;
            if (isMBLD()) {
              // 得分高更好
              const d2 = (val - ft[prev]) / ft[prev] * 100;
              progressStr = d2 > 0
                ? `（进步 ${d2.toFixed(1)}%）`
                : d2 < 0 ? `（退步 ${(-d2).toFixed(1)}%）` : '';
            } else {
              progressStr = delta > 0
                ? `（进步 ${delta.toFixed(1)}%）`
                : delta < 0 ? `（退步 ${(-delta).toFixed(1)}%）` : '';
            }
            break;
          }
        }
        // NOTE: PB 判断用原始索引映射（非 singles 时 channelData 跳过了 null）
        const pbOrigI = dispIdx - 1;
        const isPB = allPlayerTimes[pi].pbFlags && allPlayerTimes[pi].pbFlags[pbOrigI];
        const pbTag = isPB ? ' 🏆' : '';
        const modeLabel = dataMode === 'singles' ? '单次' : dataMode.toUpperCase();
        cardLines.push({
          text: `● ${modeLabel}: ${fmtVal(val)}${pbTag}  ${progressStr}`,
          color: playerHSL(pi, 0.95),
          bold: true
        });
      }

      // NOTE: 卡片绘制 — 半透明深色背景 + 圆角
      if (cardLines.length > 0) {
        ctx.save();
        const lineH = 18;  // 行高
        const padX = 10, padY = 8;
        ctx.font = '600 11px "JetBrains Mono", Inter, sans-serif';
        // 计算卡片宽度（取最长行）
        let maxW = 0;
        for (const ln of cardLines) {
          const w = ctx.measureText(ln.text).width;
          if (w > maxW) maxW = w;
        }
        const cardW = maxW + padX * 2;
        const cardH = cardLines.length * lineH + padY * 2;
        // 卡片位置（在竖线旁边，避免超出画布）
        let cx = tooltipX + 12;
        if (cx + cardW > ml + pw) cx = tooltipX - cardW - 12;
        let cy = _lineHoverY - cardH / 2;
        if (cy < mt) cy = mt;
        if (cy + cardH > mt + ph) cy = mt + ph - cardH;

        // 圆角背景
        const r = 6;
        ctx.fillStyle = 'rgba(12, 12, 30, 0.88)';
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + r, cy);
        ctx.lineTo(cx + cardW - r, cy);
        ctx.arcTo(cx + cardW, cy, cx + cardW, cy + r, r);
        ctx.lineTo(cx + cardW, cy + cardH - r);
        ctx.arcTo(cx + cardW, cy + cardH, cx + cardW - r, cy + cardH, r);
        ctx.lineTo(cx + r, cy + cardH);
        ctx.arcTo(cx, cy + cardH, cx, cy + cardH - r, r);
        ctx.lineTo(cx, cy + r);
        ctx.arcTo(cx, cy, cx + r, cy, r);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 文字行
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        for (let li = 0; li < cardLines.length; li++) {
          const ln = cardLines[li];
          ctx.font = ln.bold ? '600 11px "JetBrains Mono", Inter, sans-serif' : '11px Inter, sans-serif';
          ctx.fillStyle = ln.color;
          ctx.fillText(ln.text, cx + padX, cy + padY + li * lineH);
        }
        ctx.restore();
      }
    }
  }

  // 6. 更新 DOM 统计面板（仍用滑窗数据）
  // NOTE: progress 必须在此声明 — drawFrame 的 progress 变量在 return 之后，不在此作用域
  const progress = maxFrame > 0 ? currentFrame / maxFrame : 0;
  if (ap) {
    const apFrame = computePlayerFrame(activePlayerIdx, progress);
    const apTimes = getWindowTimes(activePlayerIdx, apFrame);
    if (apTimes.length > 0) {
      const apEndIdx = Math.min(apFrame + windowSize - 1, ap.channelData.length - 1);
      const apDate = ap.compDates[ap.channelData[apEndIdx][1]];
      updateStats(apTimes, mean(apTimes), apDate, apFrame);
    }
  }

  // 7. 进度条
  updateProgressUI();

  // 8. 脊线图联动
  if (typeof highlightRidgeRow === 'function' && ap) {
    const apFrame = computePlayerFrame(activePlayerIdx, progress);
    const apEndIdx = Math.min(apFrame + windowSize - 1, ap.channelData.length - 1);
    highlightRidgeRow(apEndIdx);
  }
}

/**
 * NOTE: 累积直方图模式（支持多选手）
 * 从第 1 把到当前进度位置的全部成绩一起累积到直方图中。
 * 播放时柱子不断增高，最终显示全部成绩的完整分布。
 */
function drawFrameCumHist(mt, mr, mb, ml, pw, ph) {
  if (players.length === 0) return;

  const progress = maxFrame > 0 ? currentFrame / maxFrame : 1;
  // 可见 X 范围（支持用户缩放）
  let viewXMin = userXMin !== null ? userXMin : xMin;
  let viewXMax = userXMax !== null ? userXMax : xMax;
  const viewRange = viewXMax - viewXMin;

  // NOTE: 预计算所有选手的累积数据，确定全局 Y 轴最大值
  const allCumData = [];
  let globalMaxDensity = 0;
  for (let pi = 0; pi < players.length; pi++) {
    const p = players[pi];
    const totalSolves = p.channelData.length;
    const endIdx = Math.max(Math.min(Math.round(progress * totalSolves), totalSolves), 1);

    const cumTimes = [];
    for (let i = 0; i < endIdx; i++) {
      const v = rawToVal(p.channelData[i][0]);
      if (v > 0) cumTimes.push(v);
    }
    if (cumTimes.length < 2) { allCumData.push(null); continue; }

    const bins = computeHistogram(cumTimes, viewRange);
    for (const b of bins) {
      if (b.density > globalMaxDensity) globalMaxDensity = b.density;
    }
    allCumData.push({ cumTimes, bins, endIdx });
  }
  globalMaxDensity = Math.max(globalMaxDensity, 0.01) * 1.15;

  // 坐标映射（Y 轴用 density，多选手共享比例）
  const sx = x => ml + ((x - viewXMin) / (viewXMax - viewXMin)) * pw;
  const sy = y => mt + ph - (y / globalMaxDensity) * ph;

  // 1. 网格
  drawGrid(sx, sy, ml, mt, pw, ph, viewXMin, viewXMax);

  // 2. 循环所有选手：绘制直方图 + KDE
  const meanPositions = [];
  for (let pi = 0; pi < players.length; pi++) {
    const d = allCumData[pi];
    if (!d) continue;
    const { cumTimes, bins, endIdx } = d;
    const cumMean = mean(cumTimes);
    meanPositions.push({ pi, mean: cumMean, currentVal: null, name: players[pi].nameZh || players[pi].name });

    // 直方图柱子（用 density）
    ctx.save();
    const midVal = (bins[0].xStart + bins[bins.length - 1].xEnd) / 2;
    ctx.fillStyle = getShiftedHSL(pi, 0.25, midVal);
    ctx.strokeStyle = getShiftedHSL(pi, 0.5, midVal);
    ctx.lineWidth = 1;
    const baseline = sy(0);
    for (const b of bins) {
      if (b.count === 0) continue;
      const x1 = sx(b.xStart);
      const x2 = sx(b.xEnd);
      const yTop = sy(b.density);
      if (x2 < ml || x1 > ml + pw) continue;
      ctx.fillRect(x1, yTop, x2 - x1, baseline - yTop);
      ctx.strokeRect(x1, yTop, x2 - x1, baseline - yTop);

      // 柱子顶部显示计数（仅单选手或主选手时显示，避免多选手文字重叠）
      const barW = x2 - x1;
      if (barW > 12 && b.count > 0 && (players.length === 1 || pi === activePlayerIdx)) {
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(b.count, (x1 + x2) / 2, yTop - 3);
        ctx.restore();
      }
    }
    ctx.restore();

    // KDE 叠加
    const kde = computeKDE(cumTimes);
    if (kde && kde.length > 0) {
      drawCurve(kde, sx, sy, {
        fill: getShiftedHSL(pi, 0.08, cumMean),
        stroke: getShiftedHSL(pi, 0.7, cumMean),
        lineWidth: pi === activePlayerIdx ? 2.5 : 1.8
      });
    }

  }

  // 3. 均值标签
  drawMeanLabelsOnCanvas(sx, mt, meanPositions);

  // 5. Y 轴标签改为 "Count"
  ctx.save();
  ctx.translate(16, mt + ph / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Count', 0, 0);
  ctx.restore();

  // 6. 统计面板 — 显示主选手累积统计
  const apData = allCumData[activePlayerIdx];
  if (apData) {
    const ap = players[activePlayerIdx];
    const lastCompIdx = ap.channelData[apData.endIdx - 1][1];
    const lastDate = ap.compDates[lastCompIdx];
    updateStats(apData.cumTimes, mean(apData.cumTimes), lastDate, 0);
    // NOTE: 覆盖把数显示为 "1~N"
    const syncEl = document.getElementById('statSync');
    if (syncEl) syncEl.textContent = `#1-#${apData.endIdx}`;
  }

  // 7. 隐藏旧 DOM 均值标签
  const oldLabel = document.getElementById('meanLabel');
  if (oldLabel) oldLabel.style.display = 'none';
  const oldGhost = document.getElementById('ghostMeanLabel');
  if (oldGhost) oldGhost.style.display = 'none';

  // 8. 进度条
  updateProgressUI();
}

// ═══════════════════════════════════════
// 绘制引擎
// ═══════════════════════════════════════

function drawFrame() {
  if (players.length === 0) return;
  const { top: mt, right: mr, bottom: mb, left: ml } = MARGIN;
  const pw = cw - ml - mr;
  const ph = ch - mt - mb;

  ctx.fillStyle = '#0c0c18';
  ctx.fillRect(0, 0, cw, ch);

  // NOTE: 累积直方图模式 — 从第 1 把到当前进度位置的全部数据
  if (viewMode === 'cumHist') {
    drawFrameCumHist(mt, mr, mb, ml, pw, ph);
    return;
  }

  // NOTE: 折线图模式走独立渲染路径
  if (viewMode === 'line') {
    drawFrameLine(mt, mr, mb, ml, pw, ph);
    return;
  }

  // NOTE: 用户缩放/平移覆盖自动范围
  let viewXMin = userXMin !== null ? userXMin : xMin;
  let viewXMax = userXMax !== null ? userXMax : xMax;

  // NOTE: 动态 Y 轴上限 — 直方图/叠加模式需要考虑 histogram density
  let frameMaxY = globalMaxY;
  if (viewMode === 'histogram') {
    const progress0 = maxFrame > 0 ? currentFrame / maxFrame : 0;
    for (let pi = 0; pi < players.length; pi++) {
      const pf = computePlayerFrame(pi, progress0);
      const t = getWindowTimes(pi, pf);
      if (t.length < 2) continue;
      const bins = computeHistogram(t, viewXMax - viewXMin);
      for (const b of bins) {
        if (b.density > frameMaxY) frameMaxY = b.density;
      }
    }
    frameMaxY *= 1.1;
  }

  let sx = x => ml + ((x - viewXMin) / (viewXMax - viewXMin)) * pw;
  const sy = y => mt + ph - (y / frameMaxY) * ph;

  // 1. 网格和坐标轴
  drawGrid(sx, sy, ml, mt, pw, ph, viewXMin, viewXMax);

  // 2. 循环绘制每位选手
  const meanPositions = [];
  const progress = maxFrame > 0 ? currentFrame / maxFrame : 0;

  // NOTE: 均值居中模式 — 先算主选手均值，再调整 X 轴范围
  if (showLayers.followMean && players.length > 0) {
    const apf = computePlayerFrame(activePlayerIdx, progress);
    const at = getWindowTimes(activePlayerIdx, apf);
    if (at.length > 0) {
      const activeMean = mean(at);
      const halfRange = (viewXMax - viewXMin) / 2;
      viewXMin = activeMean - halfRange;
      viewXMax = activeMean + halfRange;
      sx = x => ml + ((x - viewXMin) / (viewXMax - viewXMin)) * pw;
      // 重绘网格以反映新范围
      ctx.fillStyle = '#0c0c18';
      ctx.fillRect(0, 0, cw, ch);
      drawGrid(sx, sy, ml, mt, pw, ph, viewXMin, viewXMax);
    }
  }
  for (let pi = 0; pi < players.length; pi++) {
    const p = players[pi];
    const pFrame = computePlayerFrame(pi, progress);

    // NOTE: 幽灵残影仅在 KDE 相关视图中显示，纯直方图无对应 ghost 柱子会显得突兀
    if (showLayers.ghost && p.ghostKDE && currentFrame > 0 && viewMode !== 'histogram') {
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

    // NOTE: 非 singles 模式下获取当前 average 值
    let currentVal = null;
    if (dataMode !== 'singles') {
      const endIdx = Math.min(pFrame + windowSize - 1, p.channelData.length - 1);
      const v = rawToVal(p.channelData[endIdx][0]);
      if (v > 0) currentVal = v;
    }
    meanPositions.push({ pi, mean: currentMean, currentVal, name: p.nameZh || p.name });

    // NOTE: 轨迹拖尾 — 记录 + 绘制
    if (showLayers.trail) {
      while (p.meanTrail.length > 0 && p.meanTrail[p.meanTrail.length - 1].frame >= currentFrame) {
        p.meanTrail.pop();
      }
      if (currentFrame > 0) {
        p.meanTrail.push({ x: currentMean, frame: currentFrame });
      }
      const MAX_TRAIL = 600;
      if (p.meanTrail.length > MAX_TRAIL) p.meanTrail.splice(0, p.meanTrail.length - MAX_TRAIL);
      const trailLen = p.meanTrail.length;
      if (trailLen > 1) {
        for (let ti = 0; ti < trailLen; ti++) {
          const age = (trailLen - 1 - ti) / trailLen;
          const alpha = 0.6 * (1 - age * age);
          const r = 1.5 + 1.5 * (1 - age);
          ctx.fillStyle = getShiftedHSL(pi, alpha, p.meanTrail[ti].x);
          ctx.beginPath();
          ctx.arc(sx(p.meanTrail[ti].x), sy(0) - 3, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // NOTE: 根据 viewMode 绘制直方图和/或 KDE
    if (viewMode === 'histogram') {
      const bins = computeHistogram(times, viewXMax - viewXMin);
      // 叠加模式用 density（和 KDE 共享 Y 轴），纯直方图也用 density
      drawHistogram(bins, sx, sy, pi, true);
    }
    if (viewMode === 'kde' || viewMode === 'histogram') {
      drawCurve(kde, sx, sy, {
        fill: getShiftedHSL(pi, 0.15, currentMean),
        stroke: getShiftedHSL(pi, 0.85, currentMean),
        lineWidth: pi === activePlayerIdx ? 2.5 : 1.8,
        glow: pi === activePlayerIdx
      });
    }

    // NOTE: 双峰检测
    if (showLayers.bimodal) {
      const peaks = detectPeaks(kde);
      if (peaks.length >= 2) {
        const midX = (peaks[0].x + peaks[1].x) / 2;
        const midPx = sx(midX);
        ctx.save();
        ctx.font = '28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡', midPx, mt + 30 + pi * 32);
        ctx.restore();
      }
    }

    // 均值线（半透明，可关闭）
    if (showLayers.meanLine) {
      drawMeanLine(sx, sy, mt, ph, currentMean, getShiftedHSL(pi, 0.5, currentMean), false);
    }

    // 当前值线（亮色，可关闭）
    if (showLayers.currentVal && currentVal !== null) {
      drawMeanLine(sx, sy, mt, ph, currentVal, getShiftedHSL(pi, 0.9, currentMean), false);
    }
  }

  // 3. 均值标签
  drawMeanLabelsOnCanvas(sx, mt, meanPositions);

  // 4. 更新主选手的 DOM 统计面板
  const ap = players[activePlayerIdx];
  if (ap) {
    const apFrame = computePlayerFrame(activePlayerIdx, progress);
    const apTimes = getWindowTimes(activePlayerIdx, apFrame);
    if (apTimes.length > 0) {
      const apEndIdx = Math.min(apFrame + windowSize - 1, ap.channelData.length - 1);
      const apDate = ap.compDates[ap.channelData[apEndIdx][1]];
      updateStats(apTimes, mean(apTimes), apDate, apFrame);
    }
  }

  // 5. 隐藏旧 DOM 均值标签
  const oldLabel = document.getElementById('meanLabel');
  if (oldLabel) oldLabel.style.display = 'none';
  const oldGhost = document.getElementById('ghostMeanLabel');
  if (oldGhost) oldGhost.style.display = 'none';

  // 6. 进度条
  updateProgressUI();

  // 7. 脊线图联动
  if (typeof highlightRidgeRow === 'function' && ap) {
    const apFrame = computePlayerFrame(activePlayerIdx, progress);
    const apEndIdx = Math.min(apFrame + windowSize - 1, ap.channelData.length - 1);
    highlightRidgeRow(apEndIdx);
  }
}

function drawGrid(sx, sy, ml, mt, pw, ph, viewXMin, viewXMax) {
  ctx.save();

  // NOTE: 基于可见范围（用户缩放后）计算刻度步长，使放大时刻度加密
  const vMin = viewXMin !== undefined ? viewXMin : xMin;
  const vMax = viewXMax !== undefined ? viewXMax : xMax;
  const range = vMax - vMin;
  const rawStep = range / 8;
  const niceStep = pickNiceStep(rawStep);

  const gridStart = Math.ceil(vMin / niceStep) * niceStep;

  // X 轴网格线
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = gridStart; x <= vMax; x += niceStep) {
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
  for (let x = gridStart; x <= vMax; x += niceStep) {
    const label = isFMC() || isMBLD()
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
  ctx.fillText(isFMC() ? 'Moves' : isMBLD() ? 'Score (pts)' : 'Solve time (s)', ml + pw / 2, mt + ph + 35);

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
function updateStats(times, currentMean, currentDate, apFrame) {
  const ap = players[activePlayerIdx];
  if (!ap) return;
  const s = stddev(times);
  // NOTE: 和 10 帧前比较，避免逐帧噪声
  if (!updateStats._history) updateStats._history = [];
  updateStats._history.push(currentMean);
  const DELTA_LAG = 30;
  const prevMean = updateStats._history.length > DELTA_LAG
    ? updateStats._history[updateStats._history.length - 1 - DELTA_LAG]
    : updateStats._history[0];
  const delta = currentMean - prevMean;
  const endIdx = Math.min(apFrame + windowSize - 1, ap.channelData.length - 1);
  const compIdx = ap.channelData[endIdx][1];
  const compName = ap.competitions[compIdx] || '';

  document.getElementById('statMean').textContent = fmtVal(currentMean);
  document.getElementById('statStd').textContent = isFMC() || isMBLD()
    ? 'σ ' + s.toFixed(1)
    : 'σ ' + s.toFixed(2) + 's';

  // NOTE: 把数/日期列根据 syncMode 动态切换
  const syncLabel = document.getElementById('statSyncLabel');
  const syncValue = document.getElementById('statSync');
  if (syncMode === 'solve') {
    syncLabel.textContent = '把数';
    syncValue.textContent = `#${apFrame + 1}–#${endIdx + 1}`;
  } else {
    syncLabel.textContent = '日期';
    syncValue.textContent = currentDate || '--';
  }
  // NOTE: 国旗需要 innerHTML；WcaCompData.getCountry 同步读缓存，首次加载前为空字符串（无国旗，降级为纯文本）
  const compEl = document.getElementById('statComp');
  const iso2 = WcaCompData.isLoaded() ? WcaCompData.getCountry(compName) : '';
  compEl.innerHTML = (iso2 ? '<span class="fi fi-' + iso2 + '"></span> ' : '') + formatCompName(compName);

  const deltaEl = document.getElementById('statDelta');
  deltaEl.textContent = isFMC() || isMBLD()
    ? Math.round(Math.abs(delta)) + (isMBLD() ? ' pts' : ' moves')
    : Math.abs(delta).toFixed(2) + 's';
  // NOTE: MBLD 得分越高越好，其他项目越低越好
  const improved = isHigherBetter() ? delta > 0 : delta < 0;
  const regressed = isHigherBetter() ? delta < 0 : delta > 0;
  deltaEl.classList.toggle('improving', improved);
  deltaEl.classList.toggle('regressing', regressed);
  // NOTE: 成绩变小 = 进步，变大 = 退步（MBLD 反转）
  const deltaLabel = deltaEl.closest('.stat-item')?.querySelector('.stat-label');
  if (deltaLabel) {
    deltaLabel.textContent = improved ? '进步' : (regressed ? '退步' : '进步');
    deltaLabel.title = '与 30 帧前的窗口均值相比';
  }
}

/**
 * NOTE: 多选手均值标签 — 直接在 Canvas 上绘制，不用 DOM
 */
function drawMeanLabelsOnCanvas(sx, mt, meanPositions) {
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
      const meanLabel = namePrefix + fmtVal(mp.mean);
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
      const valLabel = namePrefix + fmtVal(mp.currentVal);
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

  // NOTE: 同步模式切换（按把数 / 按日期）
  document.querySelectorAll('.sync-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      document.querySelectorAll('.sync-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      syncMode = e.target.dataset.sync;
      drawFrame();
    });
  });

  // NOTE: 视图模式切换（KDE / 直方图 / 叠加 / 折线）
  // NOTE: 排除 resetRangeBtn，它没有 data-view 属性
  document.querySelectorAll('.view-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', e => {
      document.querySelectorAll('.view-btn[data-view]').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      viewMode = e.target.dataset.view;
      // NOTE: 折线模式下隐藏分布全景（ridgeline 对折线无意义）
      var ridgeSection = document.querySelector('.section-divider');
      var ridgeTitle = document.querySelector('.section-title');
      var ridgeWrapper = document.querySelector('.ridgeline-wrapper');
      var hidden = viewMode === 'line' ? 'none' : '';
      if (ridgeSection) ridgeSection.style.display = hidden;
      if (ridgeTitle) ridgeTitle.style.display = hidden;
      if (ridgeWrapper) ridgeWrapper.style.display = hidden;
      drawFrame();
    });
  });

  // NOTE: 一键重置缩放/平移范围 — 四种视图均使用 userXMin/userXMax，统一清空
  const resetBtn = document.getElementById('resetRangeBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      userXMin = null;
      userXMax = null;
      lineXStart = null;
      lineXEnd = null;
      drawFrame();
    });
  }

  // NOTE: 图例说明 ⓘ 按钮 + 药丸开关
  const legendBtn = document.getElementById('legendInfoBtn');
  const legendTip = document.getElementById('legendTooltip');
  if (legendBtn && legendTip) {
    legendBtn.addEventListener('click', e => {
      e.stopPropagation();
      legendTip.classList.toggle('visible');
    });
    document.addEventListener('click', () => legendTip.classList.remove('visible'));
    legendTip.addEventListener('click', e => e.stopPropagation());
    // 药丸开关控制图层显隐
    legendTip.querySelectorAll('input[data-layer]').forEach(cb => {
      cb.addEventListener('change', () => {
        showLayers[cb.dataset.layer] = cb.checked;
        drawFrame();
      });
    });
  }

  // NOTE: 手机端折叠/展开第二行模式按钮
  const modeExpandBtn = document.getElementById('modeExpandBtn');
  const modeRowRound = document.getElementById('modeRowRound');
  if (modeExpandBtn && modeRowRound) {
    modeExpandBtn.addEventListener('click', () => {
      const expanded = modeRowRound.classList.toggle('expanded');
      modeExpandBtn.textContent = expanded ? '▴ 收起' : '▾ 更多';
    });
    // NOTE: 当 round 模式按钮被激活时，自动展开第二行
    modeRowRound.querySelectorAll('.mode-btn-round').forEach(btn => {
      btn.addEventListener('click', () => {
        modeRowRound.classList.add('expanded');
        modeExpandBtn.textContent = '▴ 收起';
      });
    });
  }

  // NOTE: 全屏按钮 — 对 canvas-wrapper 使用 Fullscreen API
  const fsBtn = document.getElementById('fullscreenBtn');
  const canvasWrap = document.querySelector('.canvas-wrapper');
  if (fsBtn && canvasWrap) {
    fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        canvasWrap.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen();
      }
    });
    document.addEventListener('fullscreenchange', () => {
      // NOTE: 全屏后需要重新计算 canvas 尺寸并重绘
      setupCanvas();
      drawFrame();
    });
  }

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

  // ═══════════════════════════════════════
  // 轴缩放/平移
  // ═══════════════════════════════════════

  // NOTE: 像素 → 数据值的辅助函数（KDE/直方图模式：X 轴，折线图模式：Y 轴）
  function pxToVal(px) {
    const { left: ml, right: mr } = MARGIN;
    const pw = cw - ml - mr;
    const vMin = userXMin !== null ? userXMin : xMin;
    const vMax = userXMax !== null ? userXMax : xMax;
    return vMin + ((px - ml) / pw) * (vMax - vMin);
  }
  // NOTE: 折线图专用 — Y 像素 → 成绩值
  function pyToVal(py) {
    const { top: mt, bottom: mb } = MARGIN;
    const ph = ch - mt - mb;
    const vMin = userXMin !== null ? userXMin : xMin;
    const vMax = userXMax !== null ? userXMax : xMax;
    // Y 轴反向：顶部=vMax，底部=vMin
    return vMax - ((py - mt) / ph) * (vMax - vMin);
  }

  // 滚轮缩放（以鼠标位置为锚点）
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const ratio = canvas.width / rect.width;  // DPR 校正
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;

    if (viewMode === 'line') {
      // NOTE: 折线图 — 默认缩放 X 轴，Shift 缩放 Y 轴
      if (e.shiftKey) {
        // Y 轴缩放
        const vMin = userXMin !== null ? userXMin : xMin;
        const vMax = userXMax !== null ? userXMax : xMax;
        const py = (e.clientY - rect.top) * ratio;
        const anchor = pyToVal(py);
        userXMin = anchor - (anchor - vMin) * factor;
        userXMax = anchor + (vMax - anchor) * factor;
        if (userXMax - userXMin < 0.5) {
          const mid = (userXMin + userXMax) / 2;
          userXMin = mid - 0.25;
          userXMax = mid + 0.25;
        }
      } else {
        // X 轴缩放（以鼠标 X 位置对应的 solve 序号为锚点）
        const ap = players[activePlayerIdx];
        const total = ap ? ap.channelData.length : 100;
        const vs = lineXStart !== null ? lineXStart : 1;
        const ve = lineXEnd !== null ? lineXEnd : total;
        const { left: ml2 } = MARGIN;
        const pw2 = cw - ml2 - MARGIN.right;
        const px = (e.clientX - rect.left) * ratio;
        const anchor = vs + ((px - ml2) / pw2) * (ve - vs);
        let newStart = anchor - (anchor - vs) * factor;
        let newEnd = anchor + (ve - anchor) * factor;
        // 最小范围限制（至少 10 把）
        if (newEnd - newStart < 10) {
          const mid = (newStart + newEnd) / 2;
          newStart = mid - 5;
          newEnd = mid + 5;
        }
        lineXStart = newStart;
        lineXEnd = newEnd;
      }
    } else {
      // KDE/直方图 — X 轴缩放
      const vMin = userXMin !== null ? userXMin : xMin;
      const vMax = userXMax !== null ? userXMax : xMax;
      const px = (e.clientX - rect.left) * ratio;
      const anchor = pxToVal(px);
      userXMin = anchor - (anchor - vMin) * factor;
      userXMax = anchor + (vMax - anchor) * factor;
      if (userXMax - userXMin < 0.5) {
        const mid = (userXMin + userXMax) / 2;
        userXMin = mid - 0.25;
        userXMax = mid + 0.25;
      }
    }
    drawFrame();
  }, { passive: false });

  // 拖拽平移（KDE/直方图模式：左右平移 X 轴，折线图模式：上下平移 Y 轴）
  let dragState = null;
  canvas.addEventListener('mousedown', e => {
    const rect = canvas.getBoundingClientRect();
    const ratio = canvas.width / rect.width;
    const ap = players[activePlayerIdx];
    const total = ap ? ap.channelData.length : 100;
    dragState = {
      startPx: (e.clientX - rect.left) * ratio,
      startPy: (e.clientY - rect.top) * ratio,
      startXMin: userXMin !== null ? userXMin : xMin,
      startXMax: userXMax !== null ? userXMax : xMax,
      // NOTE: 折线图 X 轴拖拽支持
      startLineXS: lineXStart !== null ? lineXStart : 1,
      startLineXE: lineXEnd !== null ? lineXEnd : total
    };
  });
  window.addEventListener('mousemove', e => {
    if (!dragState) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = canvas.width / rect.width;

    if (viewMode === 'line') {
      // NOTE: 折线图 — 仅水平平移 X 轴，Y 轴自适应可见数据范围
      const { left: ml, right: mr } = MARGIN;
      const pw = cw - ml - mr;
      // X 轴平移
      const dx = ((e.clientX - rect.left) * ratio - dragState.startPx);
      const xRange = dragState.startLineXE - dragState.startLineXS;
      const dxVal = -(dx / pw) * xRange;
      lineXStart = dragState.startLineXS + dxVal;
      lineXEnd = dragState.startLineXE + dxVal;
    } else {
      // NOTE: 其他模式 — 水平方向拖拽平移 X 轴
      const dx = ((e.clientX - rect.left) * ratio - dragState.startPx);
      const { left: ml, right: mr } = MARGIN;
      const pw = cw - ml - mr;
      const range = dragState.startXMax - dragState.startXMin;
      const dVal = -(dx / pw) * range;
      userXMin = dragState.startXMin + dVal;
      userXMax = dragState.startXMax + dVal;
    }
    drawFrame();
  });
  window.addEventListener('mouseup', () => { dragState = null; });

  // 双击重置
  canvas.addEventListener('dblclick', () => {
    userXMin = null;
    userXMax = null;
    lineXStart = null;
    lineXEnd = null;
    drawFrame();
  });

  // 触摸：单指拖拽平移 + 双指 pinch 缩放
  let pinchState = null;
  let touchDrag = null;
  canvas.addEventListener('touchstart', e => {
    const ap = players[activePlayerIdx];
    const total = ap ? ap.channelData.length : 100;
    if (e.touches.length === 2) {
      e.preventDefault();
      touchDrag = null;
      const rect = canvas.getBoundingClientRect();
      const ratio = canvas.width / rect.width;
      const t0 = (e.touches[0].clientX - rect.left) * ratio;
      const t1 = (e.touches[1].clientX - rect.left) * ratio;
      if (viewMode === 'line') {
        // NOTE: 折线图双指 — X 轴缩放
        const { left: ml2 } = MARGIN;
        const pw2 = cw - ml2 - MARGIN.right;
        const vs = lineXStart !== null ? lineXStart : 1;
        const ve = lineXEnd !== null ? lineXEnd : total;
        pinchState = {
          dist: Math.abs(t1 - t0),
          mid: vs + (((t0 + t1) / 2 - ml2) / pw2) * (ve - vs),
          lineXS: vs, lineXE: ve, isLine: true
        };
      } else {
        pinchState = {
          dist: Math.abs(t1 - t0),
          mid: pxToVal((t0 + t1) / 2),
          xMin: userXMin !== null ? userXMin : xMin,
          xMax: userXMax !== null ? userXMax : xMax
        };
      }
    } else if (e.touches.length === 1) {
      pinchState = null;
      const rect = canvas.getBoundingClientRect();
      const ratio = canvas.width / rect.width;
      touchDrag = {
        startPx: (e.touches[0].clientX - rect.left) * ratio,
        startPy: (e.touches[0].clientY - rect.top) * ratio,
        startXMin: userXMin !== null ? userXMin : xMin,
        startXMax: userXMax !== null ? userXMax : xMax,
        startLineXS: lineXStart !== null ? lineXStart : 1,
        startLineXE: lineXEnd !== null ? lineXEnd : total
      };
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    if (pinchState && e.touches.length === 2) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const ratio = canvas.width / rect.width;
      const t0 = (e.touches[0].clientX - rect.left) * ratio;
      const t1 = (e.touches[1].clientX - rect.left) * ratio;
      const dist = Math.abs(t1 - t0);
      const scale = pinchState.dist / dist;
      if (pinchState.isLine) {
        // NOTE: 折线图双指 — X 轴缩放
        lineXStart = pinchState.mid - (pinchState.mid - pinchState.lineXS) * scale;
        lineXEnd = pinchState.mid + (pinchState.lineXE - pinchState.mid) * scale;
      } else {
        userXMin = pinchState.mid - (pinchState.mid - pinchState.xMin) * scale;
        userXMax = pinchState.mid + (pinchState.xMax - pinchState.mid) * scale;
      }
      drawFrame();
    } else if (touchDrag && e.touches.length === 1) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const ratio = canvas.width / rect.width;
      if (viewMode === 'line') {
        // NOTE: 折线图单指 — X 轴平移
        const dx = ((e.touches[0].clientX - rect.left) * ratio - touchDrag.startPx);
        const { left: ml, right: mr } = MARGIN;
        const pw = cw - ml - mr;
        const xRange = touchDrag.startLineXE - touchDrag.startLineXS;
        const dxVal = -(dx / pw) * xRange;
        lineXStart = touchDrag.startLineXS + dxVal;
        lineXEnd = touchDrag.startLineXE + dxVal;
      } else {
        const dx = ((e.touches[0].clientX - rect.left) * ratio - touchDrag.startPx);
        const { left: ml, right: mr } = MARGIN;
        const pw = cw - ml - mr;
        const range = touchDrag.startXMax - touchDrag.startXMin;
        const dVal = -(dx / pw) * range;
        userXMin = touchDrag.startXMin + dVal;
        userXMax = touchDrag.startXMax + dVal;
      }
      drawFrame();
    }
  }, { passive: false });
  canvas.addEventListener('touchend', () => { pinchState = null; touchDrag = null; });

  // NOTE: 折线图 hover — 追踪鼠标位置触发 tooltip 刷新
  canvas.addEventListener('mousemove', e => {
    if (viewMode !== 'line') {
      if (_lineHoverX !== null) { _lineHoverX = null; _lineHoverY = null; }
      return;
    }
    // NOTE: 拖拽中不显示 hover（避免干扰）
    if (dragState) return;
    const rect = canvas.getBoundingClientRect();
    // NOTE: 不乘 DPR ratio — 绘制坐标系经 ctx.scale(dpr) 后用 CSS 像素
    _lineHoverX = e.clientX - rect.left;
    _lineHoverY = e.clientY - rect.top;
    drawFrame();
  });
  canvas.addEventListener('mouseleave', () => {
    if (_lineHoverX !== null) {
      _lineHoverX = null;
      _lineHoverY = null;
      if (viewMode === 'line') drawFrame();
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
  const vals = [];
  for (const p of players) {
    for (const d of p.channelData) {
      const v = rawToVal(d[0]);
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
  // NOTE: 切换模式时重置用户缩放
  userXMin = null;
  userXMax = null;
  lineXStart = null;
  lineXEnd = null;

  // NOTE: Round Metrics 的 key 集合（用于判断窗口大小）
  var ROUND_KEYS = { avg:1, bao5:1, wao5:1, mo5:1, bpa:1, wpa:1, median:1, bestc:1, worstc:1, worst:1 };

  if (dataMode === 'singles') {
    windowSize = 100;
    minBandwidth = 0;
  } else if (ROUND_KEYS[dataMode]) {
    // NOTE: Round Metrics 数据点稀疏（~200 点），窗口调小
    windowSize = 50;
    minBandwidth = Math.max(0.15, (hi - lo) * 0.03);
  } else {
    windowSize = 400;
    minBandwidth = Math.max(0.15, (hi - lo) * 0.03);
  }

  // NOTE: 自动选择 channelData 最长的选手作为帧驱动者
  driverIdx = 0;
  let maxLen = 0;
  for (let i = 0; i < players.length; i++) {
    if (players[i].channelData.length > maxLen) {
      maxLen = players[i].channelData.length;
      driverIdx = i;
    }
  }

  // NOTE: maxFrame 基于 driver 的 solve 数（大量帧 = 丝滑）
  maxFrame = Math.max(0, maxLen - windowSize);
  // NOTE: 默认显示最新成绩（拉到末尾）
  currentFrame = maxFrame;

  // 为每位选手预计算 ghostKDE + ghostMean
  globalMaxY = 0;
  for (let pi = 0; pi < players.length; pi++) {
    const p = players[pi];
    const initTimes = getWindowTimes(pi, 0);
    const pMax = Math.max(0, p.channelData.length - windowSize);
    const finalTimes = getWindowTimes(pi, pMax);
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
