// NOTE: WR 历史折线图模块
// 每个 history stat-panel 只放一个 canvas，显示当前可见项目的数据
// 切换 event/metric/tab 时自动重绘
// 零后端依赖 — 纯前端 DOM 读取

(function () {
  'use strict';

  // ── 成绩解析 ─────────────────────────────────────────────
  // NOTE: 将表格中的成绩字符串解析为秒数
  // 支持: "3.84", "1:23.45", "59.99", DNF 返回 NaN
  function parseResult(s) {
    s = s.trim();
    if (!s || s === 'DNF' || s === 'DNS') return NaN;
    var m = s.match(/^(\d+):(\d+\.\d+)$/);
    if (m) return parseInt(m[1], 10) * 60 + parseFloat(m[2]);
    var v = parseFloat(s);
    return isNaN(v) ? NaN : v;
  }

  // NOTE: 日期解析 → 年份小数(用于 X 轴)
  function parseDate(s) {
    s = s.trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return NaN;
    var y = parseInt(m[1], 10);
    var mo = parseInt(m[2], 10) - 1;
    var d = parseInt(m[3], 10);
    var dt = new Date(y, mo, d);
    var start = new Date(y, 0, 1);
    var end = new Date(y + 1, 0, 1);
    return y + (dt - start) / (end - start);
  }

  // ── 从表格提取数据 ─────────────────────────────────────────
  // NOTE: 通过表头关键词自动定位 Result / Date / Person / Improvement 列
  // 也支持 Count（屠榜页 Y 轴）和 Start Date（屠榜历史日期列）
  function extractData(table) {
    var ths = table.querySelectorAll('tr:first-child th');
    var rIdx = -1, dIdx = -1, pIdx = -1, impIdx = -1;
    var isCount = false; // NOTE: 是否用 Count 而非秒数作为 Y 轴
    ths.forEach(function (th, i) {
      var t = th.textContent.trim();
      if (t === 'Result' || t === '成绩') rIdx = i;
      // NOTE: 屠榜页 Y 轴是 Count（次数），优先级低于 Result
      if ((t === 'Count' || t === '次数') && rIdx === -1) { rIdx = i; isCount = true; }
      // NOTE: 日期列：优先 Date，回退 Start Date（屠榜历史有双日期列，取第一个 Date）
      if ((t === 'Date' || t === '日期' || t === 'Start Date' || t === '开始日期') && dIdx === -1) dIdx = i;
      if (t === 'Person' || t === '选手') pIdx = i;
      if (t === 'Improvement' || t === '进步') impIdx = i;
    });
    if (rIdx === -1 || dIdx === -1) return [];

    var points = [];
    var rows = table.querySelectorAll('tr');
    for (var i = 1; i < rows.length; i++) {
      var tds = rows[i].querySelectorAll('td');
      if (tds.length <= Math.max(rIdx, dIdx)) continue;
      // NOTE: Count 列是整数，Result 列是秒数字符串
      var result = isCount
        ? parseInt(tds[rIdx].textContent.trim(), 10)
        : parseResult(tds[rIdx].textContent);
      var date = parseDate(tds[dIdx].textContent);
      if (!isNaN(result) && result > 0 && !isNaN(date)) {
        var person = pIdx >= 0 && tds[pIdx] ? tds[pIdx].textContent.trim() : '';
        var imp = impIdx >= 0 && tds[impIdx] ? tds[impIdx].textContent.trim() : '';
        var resultStr = tds[rIdx].textContent.trim();
        points.push({ x: date, y: result, person: person, imp: imp, label: resultStr });
      }
    }
    // NOTE: 表格是倒序的(最新在上), 反转为时间正序
    points.reverse();
    return points;
  }


  // ── Canvas 渲染 ─────────────────────────────────────────
  var PAD = { top: 20, right: 16, bottom: 32, left: 50 };
  // NOTE: 窄屏降低图表高度
  function getChartH() { return window.innerWidth < 600 ? 140 : 180; }

  function renderChart(canvas, points) {
    var wrap = canvas.parentElement;
    if (points.length < 2) { wrap.style.display = 'none'; return; }
    wrap.style.display = '';

    var CHART_H = getChartH();
    var dpr = window.devicePixelRatio || 1;
    var w = wrap.clientWidth;
    if (w <= 0) return; // NOTE: 面板不可见时跳过
    canvas.width = w * dpr;
    canvas.height = CHART_H * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = CHART_H + 'px';

    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var xMin = points[0].x, xMax = points[points.length - 1].x;
    var yMin = Infinity, yMax = -Infinity;
    for (var i = 0; i < points.length; i++) {
      if (points[i].y < yMin) yMin = points[i].y;
      if (points[i].y > yMax) yMax = points[i].y;
    }
    var xRange = xMax - xMin || 1;
    var yRange = yMax - yMin || 1;
    xMin -= xRange * 0.03; xMax += xRange * 0.03;
    yMin -= yRange * 0.08; yMax += yRange * 0.08;
    yMin = Math.max(0, yMin);

    var plotW = w - PAD.left - PAD.right;
    var plotH = CHART_H - PAD.top - PAD.bottom;

    function xPx(v) { return PAD.left + (v - xMin) / (xMax - xMin) * plotW; }
    function yPx(v) { return PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH; }

    // ── 网格 + 标签 ──
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    var yStep = yRange > 60 ? 20 : yRange > 20 ? 10 : yRange > 8 ? 2 : yRange > 3 ? 1 : 0.5;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'right';
    for (var v = Math.ceil(yMin / yStep) * yStep; v <= yMax; v += yStep) {
      var py = yPx(v);
      ctx.beginPath(); ctx.moveTo(PAD.left, py); ctx.lineTo(PAD.left + plotW, py); ctx.stroke();
      ctx.fillText(yStep < 1 ? v.toFixed(1) : Math.round(v).toString(), PAD.left - 5, py + 3);
    }
    var yearStart = Math.ceil(xMin);
    var yearEnd = Math.floor(xMax);
    var xStep = (yearEnd - yearStart) > 15 ? 5 : (yearEnd - yearStart) > 8 ? 2 : 1;
    ctx.textAlign = 'center';
    for (var yr = yearStart; yr <= yearEnd; yr += xStep) {
      var px = xPx(yr);
      ctx.beginPath(); ctx.moveTo(px, PAD.top); ctx.lineTo(px, PAD.top + plotH); ctx.stroke();
      ctx.fillText(yr.toString(), px, CHART_H - 4);
    }

    // ── 面积填充 ──
    ctx.beginPath();
    ctx.moveTo(xPx(points[0].x), yPx(points[0].y));
    for (var i = 1; i < points.length; i++) ctx.lineTo(xPx(points[i].x), yPx(points[i].y));
    ctx.lineTo(xPx(points[points.length - 1].x), PAD.top + plotH);
    ctx.lineTo(xPx(points[0].x), PAD.top + plotH);
    ctx.closePath();
    var grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + plotH);
    grad.addColorStop(0, 'rgba(110,231,183,0.15)');
    grad.addColorStop(1, 'rgba(110,231,183,0.01)');
    ctx.fillStyle = grad;
    ctx.fill();

    // ── 折线 ──
    ctx.strokeStyle = '#6ee7b7';
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(xPx(points[0].x), yPx(points[0].y));
    for (var i = 1; i < points.length; i++) ctx.lineTo(xPx(points[i].x), yPx(points[i].y));
    ctx.stroke();

    // ── 数据点(红色) ──
    ctx.fillStyle = '#ef4444';
    for (var i = 0; i < points.length; i++) {
      ctx.beginPath();
      ctx.arc(xPx(points[i].x), yPx(points[i].y), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Tooltip（鼠标 + 触摸） ──
    var tipEl = wrap.querySelector('.wr-chart-tooltip');

    // NOTE: 根据 X 坐标找最近的数据点并显示 tooltip
    function showTip(mx) {
      if (mx < PAD.left || mx > w - PAD.right) { tipEl.style.display = 'none'; return; }
      var best = 0, bestDist = Infinity;
      for (var i = 0; i < points.length; i++) {
        var d = Math.abs(xPx(points[i].x) - mx);
        // NOTE: 距离相同时取 Y 最大的点（屠榜页同日期多个纪录取最高）
        if (d < bestDist || (d === bestDist && points[i].y > points[best].y)) {
          bestDist = d; best = i;
        }
      }
      if (bestDist > 30) { tipEl.style.display = 'none'; return; }
      var p = points[best];
      // NOTE: 成绩 + 选手 + (↓进步%)
      var html = '<b>' + p.label + '</b>';
      if (p.person) html += ' ' + p.person;
      if (p.imp) html += ' <span style="color:#6ee7b7">↓' + p.imp + '</span>';
      tipEl.innerHTML = html;
      tipEl.style.display = 'block';
      // NOTE: tooltip 位置自适应——不超出图表边界
      var tipW = tipEl.offsetWidth || 100;
      var left = mx + 8;
      if (left + tipW > w - 4) left = mx - tipW - 8;
      tipEl.style.left = Math.max(4, left) + 'px';
      tipEl.style.top = (yPx(p.y) - 28) + 'px';
    }

    canvas.onmousemove = function (e) {
      showTip(e.clientX - canvas.getBoundingClientRect().left);
    };
    canvas.onmouseleave = function () { tipEl.style.display = 'none'; };

    // NOTE: 手机触摸支持——点击显示 tooltip，点击其他区域隐藏
    canvas.ontouchstart = function (e) {
      var touch = e.touches[0];
      showTip(touch.clientX - canvas.getBoundingClientRect().left);
      e.preventDefault();
    };
  }

  // ── 找到面板内当前可见的表格并提取数据 ─────────────────────
  function getVisibleData(panel) {
    var tables = panel.querySelectorAll('table');
    for (var i = 0; i < tables.length; i++) {
      // NOTE: event_selector 通过 display:none 隐藏不选中的 section
      if (tables[i].style.display !== 'none' && tables[i].offsetParent !== null) {
        return extractData(tables[i]);
      }
    }
    // 回退: 如果都可见(初始状态), 只取第一个
    if (tables.length > 0) return extractData(tables[0]);
    return [];
  }

  // ── 为每个 history stat-panel 创建一个图表 ─────────────────
  var chartRegistry = []; // { panel, canvas, wrap }

  function createChartForPanel(panel) {
    var wrap = document.createElement('div');
    wrap.className = 'wr-chart-wrap';
    var cvs = document.createElement('canvas');
    wrap.appendChild(cvs);
    var tip = document.createElement('div');
    tip.className = 'wr-chart-tooltip';
    wrap.appendChild(tip);

    // NOTE: 插入到面板最前面(在所有 table 之前)
    panel.insertBefore(wrap, panel.firstChild);

    var entry = { panel: panel, canvas: cvs, wrap: wrap };
    chartRegistry.push(entry);
    return entry;
  }

  // NOTE: 刷新所有已注册的图表
  function refreshAllCharts() {
    chartRegistry.forEach(function (entry) {
      // 只刷新可见面板的图表
      if (entry.panel.classList.contains('active') || entry.panel.offsetParent !== null) {
        var data = getVisibleData(entry.panel);
        renderChart(entry.canvas, data);
      }
    });
  }

  // ── 初始化 ─────────────────────────────────────────────
  function init() {
    var panels = document.querySelectorAll('.stat-panel[id$="-history"]');
    if (!panels.length) return;

    panels.forEach(function (panel) {
      createChartForPanel(panel);
    });

    // NOTE: 首次绘制（延迟等 event_selector 完成 DOM 操作）
    refreshAllCharts();

    // NOTE: 监听 hashchange — event/metric/tab 切换都会改 hash
    window.addEventListener('hashchange', function () {
      // 延迟一帧等 DOM 更新
      setTimeout(refreshAllCharts, 0);
    });

    // NOTE: 监听 click 事件 — 捕获 tab/metric/source/event 按钮点击
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.event-btn, .stat-tab, .metric-btn, .source-btn, .metric-dropdown-item');
      if (btn) {
        setTimeout(refreshAllCharts, 0);
      }
    });

    // NOTE: 窗口 resize 时重绘
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(refreshAllCharts, 200);
    });
  }

  // NOTE: 在 stats_ui.js 和 event_selector.js 初始化之后运行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(init, 0);
    });
  } else {
    setTimeout(init, 0);
  }
})();
