// NOTE: SVG 图表渲染 — 柱状图、Y 轴、网格线、统计曲线、菱形标签
// 使用 viewBox 保持内部坐标系，浏览器自动处理缩放

import {
    DNF_VALUE, UNFINISHED_VALUE,
    formatTime, getAverage, getBestSingle, rankify, CalcEngine
} from './calc_engine.js';
import {
    state, getRankOf, getValidsCount, solveCount, isMo3, isMbf
} from './state.js';
import { isWR } from './wr_data.js';
import { getTargetAvg } from './calc_table.js';

// ── 布局常量（与原 canvas 1600×900 坐标系对齐） ──

const BAR_W = 90;          // 柱宽
const STRIDE = 105;        // 组间距
const BAR_START = 390;     // 第一组 x 起点
const CHART_H = 500;       // 绘图区高度（同时用于 viewBox 保底）

// NOTE: 动态计算 — 根据当前项目的 solveCount 调整图表结束位置
function chartEnd() { return BAR_START + solveCount() * STRIDE - (STRIDE - BAR_W); }
function chartCenter() { return (BAR_START + chartEnd()) / 2; }
function chartIX() {
    var ce = chartEnd();
    return [ce, ce + 100, ce, ce + 350, 30];
}

const COLORS = {
    playerA: 'rgba(255,128,0,1.0)',
    playerB: 'rgba(50,130,255,1.0)',
    tie: 'rgba(190,190,190,1.0)',
};
const SHADES = [COLORS.playerA, COLORS.playerB, COLORS.tie];

// ── SVG 命名空间 ──

const SVG_NS = 'http://www.w3.org/2000/svg';

// ── 模块状态 ──

var svgEl = null;           // 根 SVG 元素
var gridGroup = null;       // 网格线 <g>
var barGroup = null;        // 柱子 <g>
var statsGroup = null;      // 统计/扇形 <g>
var avgGroup = null;        // 菱形标签 <g>
var topTextGroup = null;    // NOTE: 最顶层文字（渲染在菱形之上，避免被色块遮挡）
var tooltipEl = null;       // HTML tooltip div（badge 指标说明）
var chartContainer = null;  // 图表容器 DOM
var lastConfettiKey = '';    // NOTE: 防止 confetti 重复触发（记录上次触发时的状态 key）

// 图表参数缓存（等价于原代码的 g 对象）
var gp = {};

// ── 初始化 ──

export function init(container) {
    svgEl = createSvgElement('svg', {
        class: 'hth-chart',
        viewBox: '200 0 1200 850',
        preserveAspectRatio: 'xMidYMid meet',
    });

    gridGroup = createSvgElement('g', { class: 'chart-grid' });
    barGroup = createSvgElement('g', { class: 'chart-bars' });
    statsGroup = createSvgElement('g', { class: 'chart-stats' });
    avgGroup = createSvgElement('g', { class: 'chart-avgs' });
    topTextGroup = createSvgElement('g', { class: 'chart-top-text' });

    // NOTE: 定义 SVG 滤镜 — 柱顶标签的柔和白色阴影
    var defs = createSvgElement('defs', {});
    var filter = createSvgElement('filter', {
        id: 'barLabelShadow', x: '-20%', y: '-20%', width: '140%', height: '140%',
    });
    // 多层白色模糊阴影，模拟柔和光晕
    var shadow = createSvgElement('feDropShadow', {
        dx: 0, dy: 0, stdDeviation: 2, 'flood-color': '#fff', 'flood-opacity': 0.9,
    });
    filter.appendChild(shadow);
    defs.appendChild(filter);
    svgEl.appendChild(defs);

    svgEl.appendChild(gridGroup);
    svgEl.appendChild(barGroup);
    svgEl.appendChild(statsGroup);
    svgEl.appendChild(avgGroup);
    svgEl.appendChild(topTextGroup);

    container.appendChild(svgEl);
    chartContainer = container;

    // NOTE: HTML tooltip div — 用于 badge 指标的悬浮提示
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'chart-badge-tip';
    tooltipEl.style.cssText = 'position:absolute;background:rgba(0,0,0,0.88);color:#fff;' +
        'padding:6px 10px;border-radius:6px;font-size:12px;line-height:1.4;' +
        'max-width:260px;pointer-events:none;opacity:0;transition:opacity 0.2s;z-index:200;' +
        'white-space:normal;font-family:Helvetica,sans-serif;';
    container.style.position = 'relative'; // 确保 tooltip 定位参考
    container.appendChild(tooltipEl);
}

// ── 主渲染入口 ──

export function render(opts) {
    if (!svgEl) return;

    // 计算图表参数
    computeGridParams();

    // 清空并重绘（barGroup 由 drawBars 自行管理复用）
    clearGroup(gridGroup);
    clearGroup(statsGroup);
    clearGroup(avgGroup);
    clearGroup(topTextGroup);

    drawGridLines();
    drawBars();
    drawGhostBars();
    drawTargetAvgLines();
    drawStats();
    drawAverages();

    // NOTE: 拖动中跳过 viewBox 重算，防止 bbox 微变导致图表水平晃动
    if (!opts || !opts.skipViewBox) {
        updateViewBox();
    }

    // NOTE: WR avg 庆祝特效 — 第 5 把填完且 avg 达成 WR 时触发 confetti
    checkWRConfetti();
}

// NOTE: WR 庆祝特效检测 — 单次 WR 或 avg WR 时喷射 confetti
var suppressConfetti = false; // NOTE: rand-fill / 项目切换时抑制
export function setSuppressConfetti(flag) { suppressConfetti = flag; }
var confettiTimers = []; // NOTE: 保存 setTimeout ID，切换项目时可清除

// NOTE: 外部调用 — 切换项目时清除残留 confetti 动画和 key
export function clearPendingConfetti() {
    for (var i = 0; i < confettiTimers.length; i++) clearTimeout(confettiTimers[i]);
    confettiTimers = [];
    lastConfettiKey = '';
    confettiActive = false;
}

function checkWRConfetti() {
    if (typeof confetti !== 'function') return;
    if (suppressConfetti) return;
    // NOTE: 多盲得分不支持 WR 检测（WR 数据是 WCA 编码格式，与 score×100 不兼容）
    if (isMbf()) return;

    for (var p = 0; p < 2; p++) {
        if (!state.playerEnabled[p]) continue;
        var times = state.times[state.seedOn + p];
        var filled = times.filter(function (t) { return t > 0 && t < DNF_VALUE; });

        // 检测单次 WR — 任何一把 ≤ WR single
        for (var si = 0; si < filled.length; si++) {
            var t = times[si];
            if (t > 0 && t < DNF_VALUE && isWR(state.event, 'single', t)) {
                var sKey = 'single-' + state.seedOn + '-' + state.event + '-' + p + '-' + si + '-' + t;
                if (sKey !== lastConfettiKey) {
                    lastConfettiKey = sKey;
                    fireConfetti();
                    return;
                }
            }
        }

        // 检测 avg WR — 5 把全部填完
        if (filled.length < 5) continue;
        var avg = getAverage(times, false);
        if (!avg || avg <= 0 || avg >= DNF_VALUE) continue;
        if (!isWR(state.event, 'average', avg)) continue;

        var aKey = 'avg-' + state.seedOn + '-' + state.event + '-' + p + '-' + avg;
        if (aKey === lastConfettiKey) continue;
        lastConfettiKey = aKey;
        fireConfetti();
        return;
    }
}

// NOTE: confetti 喷射 — 连发 3 波，期间吞掉新触发
var confettiActive = false;
function fireConfetti() {
    if (confettiActive) return; // NOTE: 上一轮还没结束，直接跳过
    confettiActive = true;
    for (var i = 0; i < 3; i++) {
        var tid = setTimeout(function () {
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
        confettiTimers.push(tid);
    }
    // NOTE: 最后一波发出后约 3s 动画结束，解锁
    var unlockTid = setTimeout(function() { confettiActive = false; }, 500 + 3000);
    confettiTimers.push(unlockTid);
}

// NOTE: 动态 viewBox — 宽度按内容适配，高度固定避免数据变化导致跳动
function updateViewBox() {
    var bbox = svgEl.getBBox();
    // 宽度动态适配内容
    var w = Math.max(bbox.width, 1000);
    // NOTE: 高度固定 — 使用 CHART_H 加上上下边距，不随数据内容变化
    // NOTE: 高度固定 — 使用 CHART_H 加上上下边距
    var FIXED_H = CHART_H + 60;
    var cx = bbox.x + bbox.width / 2;
    var padX = w * 0.03;
    // NOTE: 顶部起始 Y（Placed 文字已移除，无需额外留白）
    var topY = 20;
    svgEl.setAttribute('viewBox',
        (cx - w / 2 - padX) + ' ' + topY + ' ' +
        (w + padX * 2) + ' ' + FIXED_H);
}

// ── 图表参数计算（等价于原 setGridParameters） ──

function computeGridParams() {
    // 图表绘制区域
    gp.x = 340;
    gp.y = 40;
    gp.w = 1600;
    gp.h = CHART_H;

    gp.min = DNF_VALUE;
    gp.max = -DNF_VALUE;
    gp.viewcount = 0;

    for (var p = 0; p < 2; p++) {
        if (!state.playerEnabled[p]) continue;
        for (var t = 0; t < solveCount(); t++) {
            var val = state.times[state.seedOn + p][t];
            if (val !== 0) {
                addToViewingWindow(val);
            }
        }
    }

    var topAvg = getAverage(state.times[state.sortedCache[0]], false);
    if (topAvg >= 0 && topAvg !== DNF_VALUE && topAvg !== UNFINISHED_VALUE) {
        addToViewingWindow(topAvg);
    }

    // NOTE: 幽灵柱值纳入 viewing window，避免柱子超出图表
    for (var p = 0; p < 2; p++) {
        if (!state.playerEnabled[p]) continue;
        var tavg = getTargetAvg(state.seedOn + p);
        var ghost = CalcEngine.getGhostBar(state.times[state.seedOn + p], tavg);
        if (ghost && ghost.value > 0 && ghost.value < DNF_VALUE) {
            addToViewingWindow(ghost.value);
        }
    }

    if (gp.viewcount <= 2) addToViewingWindow(12);

    var MIN_SPAN = 26;
    gp.mid = (gp.min + gp.max) / 2.0;
    gp.span = Math.max(MIN_SPAN, (gp.max - gp.min) * 1.35);
    gp.min = gp.mid - gp.span / 2;
    gp.max = gp.mid + gp.span / 2;
    gp.unit = getUnit(gp.span);
    gp.lmin = Math.max(0, Math.ceil(gp.min / gp.unit) * gp.unit);
    gp.lmax = Math.max(0, Math.floor(gp.max / gp.unit) * gp.unit);
}

function addToViewingWindow(val) {
    if (val !== DNF_VALUE) {
        gp.min = Math.min(gp.min, val);
        gp.max = Math.max(gp.max, val);
    }
    gp.viewcount += 1;
}

function getUnit(s) {
    // NOTE: 多盲得分模式 — 得分范围通常 1~60，内部值 100~6000，需要更小的步进
    if (isMbf()) {
        var mbfUnits = [100, 200, 500, 1000, 2000, 5000, 10000, DNF_VALUE];
        var mu = 0;
        while (mbfUnits[mu] < s / 9) mu++;
        return mbfUnits[mu];
    }
    // NOTE: 最小间距 50cs（0.5 秒），刻度十分位只出现 0 或 5
    var units = [50, 100, 200, 500, 1000, 2000, 3000, 6000, 12000, 30000, 60000, 120000, 180000, 360000, 720000, 1080000, 2160000, 4320000, 8640000, DNF_VALUE];
    var u = 0;
    while (units[u] < s / 9) u++;
    return units[u];
}

// ── 坐标转换 ──

function valToY(val) {
    return gp.y + gp.h * (1 - (val - gp.min) / gp.span);
}

function valToYCap(val) {
    return Math.min(Math.max(valToY(val), gp.y), gp.y + gp.h);
}

// ── 网格线和 Y 轴标签 ──

function drawGridLines() {
    for (var yLine = gp.lmin; yLine <= gp.lmax; yLine += gp.unit) {
        var appY = valToY(yLine);
        // 水平参考线
        gridGroup.appendChild(createSvgElement('line', {
            x1: BAR_START, y1: appY, x2: chartEnd(), y2: appY,
            stroke: 'rgba(0,0,0,0.08)', 'stroke-width': 1,
        }));
        // Y 轴标签
        var label = createSvgElement('text', {
            x: BAR_START - 8, y: appY + 7,
            'text-anchor': 'end', 'font-size': '22px', 'font-family': 'Helvetica',
            fill: '#000',
        });
        // NOTE: Y 轴标签 — formatTime 内部自动处理多盲得分模式
        label.textContent = formatTime(yLine, true);
        gridGroup.appendChild(label);
    }
}

// ── Target Avg 横线 ──

// NOTE: 在柱状图区域画 Target Avg 水平虚线（每个选手一条，颜色与柱子一致）
function drawTargetAvgLines() {
    for (var p = 0; p < 2; p++) {
        if (!state.playerEnabled[p]) continue;
        var tavg = getTargetAvg(state.seedOn + p);
        if (tavg <= 0 || tavg >= DNF_VALUE) continue;

        var y = valToYCap(tavg);
        var x1 = BAR_START - 10;
        var x2 = chartEnd() + 10;
        var col = darken(SHADES[p], 0.7);

        // 虚线
        gridGroup.appendChild(createSvgElement('line', {
            x1: x1, y1: y, x2: x2, y2: y,
            stroke: col, 'stroke-width': 2.5,
            'stroke-dasharray': '10,6',
            opacity: 0.7,
        }));

        // NOTE: 左侧标注文字 — 与 Y 轴刻度标签对齐
        var label = createSvgElement('text', {
            x: BAR_START - 8, y: y + 6,
            'text-anchor': 'end',
            'font-size': '20px', 'font-family': 'Helvetica',
            'font-weight': 'bold',
            fill: col, opacity: 0.8,
        });
        label.textContent = formatTime(tavg);
        gridGroup.appendChild(label);
    }
}

// ── 幽灵柱（阈值可视化） ──

// NOTE: 在空柱位画半透明幽灵柱，显示下一把成绩的上限
function drawGhostBars() {
    if (isMo3()) return; // Mo3 无 BPA/WPA

    var GHOST_COLORS = {
        safe: 'rgba(76,175,80,0.25)',         // 绿色半透明 — WPA 稳
        conditional: 'rgba(255,193,7,0.30)',   // 黄色半透明 — BPA 有条件
        any: 'rgba(76,175,80,0.18)',           // 浅绿 — 无上限
        impossible: 'rgba(244,67,54,0.20)',    // 红色半透明
    };
    var GHOST_BORDERS = {
        safe: 'rgba(76,175,80,0.7)',
        conditional: 'rgba(255,193,7,0.8)',
        any: 'rgba(76,175,80,0.5)',
        impossible: 'rgba(244,67,54,0.6)',
    };
    var GHOST_TEXT_COLORS = {
        safe: '#388E3C',
        conditional: '#F57F17',
        any: '#388E3C',
        impossible: '#D32F2F',
    };

    var bm = 7;

    for (var p = 0; p < 2; p++) {
        if (!state.playerEnabled[p]) continue;
        var tavg = getTargetAvg(state.seedOn + p);
        var ghost = CalcEngine.getGhostBar(state.times[state.seedOn + p], tavg);
        if (!ghost) continue;

        var barX = BAR_START + ghost.slotIndex * STRIDE;
        var fullW = BAR_W - 2 * bm;
        // Both 模式下缩窄内层
        var isInner = (state.playerEnabled[0] && state.playerEnabled[1] && p === 1);
        var bw = isInner ? fullW * 0.55 : fullW;
        var bx = barX + bm + (fullW - bw) / 2;

        if (ghost.type === 'impossible') {
            // 💀 标签（带 tooltip）
            var labelY = valToYCap(tavg);
            var skullGroup = createSvgElement('g', { cursor: 'help' });
            (function () {
                skullGroup.addEventListener('mouseenter', function (e) {
                    tooltipEl.textContent = 'Mathematically impossible to hit target avg — no matter what you solve';
                    var rect = chartContainer.getBoundingClientRect();
                    tooltipEl.style.left = (e.clientX - rect.left + 10) + 'px';
                    tooltipEl.style.top = (e.clientY - rect.top - 40) + 'px';
                    tooltipEl.style.opacity = '1';
                });
                skullGroup.addEventListener('mouseleave', function () {
                    tooltipEl.style.opacity = '0';
                });
            })();
            // NOTE: 红底 + skull.png — 提升图表中的对比度
            var skullSize = 36;
            var cx = bx + bw / 2, cy = labelY;
            skullGroup.appendChild(createSvgElement('circle', {
                cx: cx, cy: cy, r: skullSize / 2 + 7,
                fill: '#D32F2F',
            }));
            skullGroup.appendChild(createSvgElement('image', {
                href: '/assets/images/skull.png',
                x: cx - skullSize / 2,
                y: cy - skullSize / 2,
                width: skullSize, height: skullSize,
            }));
            topTextGroup.appendChild(skullGroup);
            continue;
        }

        // 幽灵柱高度
        var ghostValue = ghost.value;
        var isAny = (ghost.type === 'any' || ghostValue >= DNF_VALUE);
        // ANY 时柱高到图表顶部
        var topY = isAny ? gp.y + 5 : valToYCap(ghostValue);
        var bottomY = valToYCap(0);
        // NOTE: 与 drawBars 对齐 — 截断模式下底部减去 2*bm 内边距
        if (valToY(0) > bottomY) bottomY -= bm * 2;
        var barHeight = Math.max(0, bottomY - topY);

        // 半透明填充矩形
        barGroup.appendChild(createSvgElement('rect', {
            x: bx, y: topY, width: bw, height: barHeight,
            fill: GHOST_COLORS[ghost.type],
            rx: 2,
        }));
        // 虚线描边矩形
        barGroup.appendChild(createSvgElement('rect', {
            x: bx, y: topY, width: bw, height: barHeight,
            fill: 'none',
            stroke: GHOST_BORDERS[ghost.type],
            'stroke-width': 2,
            'stroke-dasharray': '6,4',
            rx: 2,
        }));

        // NOTE: 幽灵柱内部居中 emoji — 🔒 safe / 🎲 conditional
        var emoji = ghost.type === 'safe' ? '🔒' : '🎲';
        var emojiY = topY + barHeight / 2 + 10; // 垂直居中
        addText(barGroup, bx + bw / 2, emojiY, emoji, GHOST_TEXT_COLORS[ghost.type], 28, 'center');

        // 顶部标签（纯文字，不含 emoji）
        var labelText = isAny ? 'ANY ✓' : 'Need ≤ ' + formatTime(ghostValue);
        var labelColor = GHOST_TEXT_COLORS[ghost.type];
        addText(topTextGroup, bx + bw / 2, topY - 8, labelText, labelColor, 18, 'center');
    }

    // NOTE: 已填柱位的阈值 badge 标签 — 彩色圆角矩形 + 左箭头
    var BADGE_COLORS = {
        t4wpa: '#1976D2',       // 蓝色 — WPA（最差情况）
        t4bpa: '#388E3C',       // 绿色 — BPA（最好情况）
        t5: '#D32F2F',       // 红色 — 第 5 把
    };

    for (var p = 0; p < 2; p++) {
        if (!state.playerEnabled[p]) continue;
        var tavg = getTargetAvg(state.seedOn + p);
        if (!tavg || tavg <= 0 || tavg >= DNF_VALUE) continue;

        var times = state.times[state.seedOn + p];
        var filled = times.filter(t => t > 0 && t < DNF_VALUE);
        if (filled.length < 4) continue;

        var th = CalcEngine.computeThresholds(times, tavg);
        if (!th) continue;

        // 收集要显示的 badge — 统一 2 行格式: "Need Nth" + "≤ X"
        var badges = [];
        // NOTE: t#4 WPA 和 BPA — 当一个是 ANY ✓ 另一个有数值时，只显示有数值的
        var hasWpa = th.t4wpa !== undefined && th.t4wpa !== null;
        var hasBpa = th.t4bpa !== undefined && th.t4bpa !== null;
        var wpaIsAny = hasWpa && th.t4wpa >= DNF_VALUE;
        var bpaIsAny = hasBpa && th.t4bpa >= DNF_VALUE;

        // 两个都存在且一个是 ANY → 只显示有数值的那个
        var showWpa = hasWpa && !(wpaIsAny && hasBpa && !bpaIsAny);
        var showBpa = hasBpa && !(bpaIsAny && hasWpa && !wpaIsAny);

        if (showWpa) {
            var v = th.t4wpa >= DNF_VALUE ? 'ANY ✓' : '≤ ' + formatTime(th.t4wpa);
            badges.push({
                line1: 'Need 4th', line2: v, color: BADGE_COLORS.t4wpa,
                tip: 'Worst case: even if 5th solve = DNF, 4th must be ≤ this to hit target avg',
                y: th.t4wpa < DNF_VALUE ? valToYCap(th.t4wpa) : valToYCap(tavg) - 40
            });
        }
        if (showBpa) {
            var v = th.t4bpa >= DNF_VALUE ? 'ANY ✓' : '≤ ' + formatTime(th.t4bpa);
            badges.push({
                line1: 'Need 4th', line2: v, color: BADGE_COLORS.t4bpa,
                tip: 'Best case: if 5th solve is great, 4th must be ≤ this to hit target avg',
                y: th.t4bpa < DNF_VALUE ? valToYCap(th.t4bpa) : valToYCap(tavg) + 20
            });
        }
        // t#4 impossible — WPA 和 BPA 都是 null
        if (th.t4wpa === null && th.t4bpa === null) {
            badges.push({
                line1: '4th ☠', line2: 'Impossible', color: '#D32F2F',
                tip: 'Mathematically impossible to hit target avg — no matter what you solve',
                y: valToYCap(tavg)
            });
        }
        // t#5（仅当填了 5 把时）
        if (filled.length >= 5 && th.t5 !== undefined) {
            if (th.t5 !== null) {
                var v = th.t5 >= DNF_VALUE ? 'ANY ✓' : '≤ ' + formatTime(th.t5);
                badges.push({
                    line1: 'Need 5th', line2: v, color: BADGE_COLORS.t5,
                    tip: '5th solve must be ≤ this to hit target avg',
                    y: th.t5 < DNF_VALUE ? valToYCap(th.t5) : valToYCap(tavg) + 60
                });
            } else {
                // t#5 impossible
                badges.push({
                    line1: '5th ☠', line2: 'Impossible', color: '#D32F2F',
                    tip: 'Mathematically impossible to hit target avg — no matter what you solve',
                    y: valToYCap(tavg) + 40
                });
            }
        }

        if (badges.length === 0) continue;

        // 排斥重叠
        var badgeH = 38, badgeGap = 6;
        var badgeItems = badges.map(function (b) { return { origY: b.y, y: b.y, h: badgeH }; });
        if (badgeItems.length > 1) resolveOverlaps(badgeItems, badgeGap);
        for (var bi = 0; bi < badges.length; bi++) badges[bi].y = badgeItems[bi].y;

        // 绘制每个 badge — 放在图表左侧（Y 轴标签左边），右箭头指向图表
        var bw = 72, bh = 38, br = 6, arrowW = 8;
        // badge 右边缘（箭头尖端）紧贴 Y 轴标签区左侧
        var badgeRight = BAR_START - 65;
        var badgeLeft = badgeRight - arrowW - bw - br;

        for (var bi = 0; bi < badges.length; bi++) {
            var b = badges[bi];
            var by = b.y - bh / 2;

            // NOTE: 用 <g> 包裹整个 badge，事件驱动 HTML tooltip
            var badgeGroup = createSvgElement('g', { cursor: 'help' });

            // JS 事件驱动 tooltip
            (function (tip) {
                badgeGroup.addEventListener('mouseenter', function (e) {
                    tooltipEl.textContent = tip;
                    var rect = chartContainer.getBoundingClientRect();
                    tooltipEl.style.left = (e.clientX - rect.left + 10) + 'px';
                    tooltipEl.style.top = (e.clientY - rect.top - 40) + 'px';
                    tooltipEl.style.opacity = '1';
                });
                badgeGroup.addEventListener('mouseleave', function () {
                    tooltipEl.style.opacity = '0';
                });
            })(b.tip);

            // 圆角矩形 + 右箭头背景
            var lx = badgeLeft;
            var d = 'M' + lx + ',' + (by + br) +
                ' Q' + lx + ',' + by + ' ' + (lx + br) + ',' + by +
                ' L' + (badgeRight - arrowW) + ',' + by +
                ' L' + badgeRight + ',' + b.y +
                ' L' + (badgeRight - arrowW) + ',' + (by + bh) +
                ' L' + (lx + br) + ',' + (by + bh) +
                ' Q' + lx + ',' + (by + bh) + ' ' + lx + ',' + (by + bh - br) +
                ' Z';
            badgeGroup.appendChild(createSvgElement('path', {
                d: d, fill: b.color, opacity: 0.9,
            }));

            // 2 行白色文字
            var tx = lx + (bw + br) / 2;
            var textEl1 = createSvgElement('text', {
                x: tx, y: by + 15, fill: '#fff', 'font-size': '12px',
                'font-family': 'Helvetica', 'font-weight': 'bold', 'text-anchor': 'middle',
            });
            textEl1.textContent = b.line1;
            badgeGroup.appendChild(textEl1);

            var textEl2 = createSvgElement('text', {
                x: tx, y: by + 32, fill: '#fff', 'font-size': '15px',
                'font-family': 'Helvetica', 'font-weight': 'bold', 'text-anchor': 'middle',
            });
            textEl2.textContent = b.line2;
            badgeGroup.appendChild(textEl2);

            topTextGroup.appendChild(badgeGroup);
        }
    }
}

// ── 柱状图 ──

function drawBars() {
    var bm = 7; // 柱内边距
    var usedKeys = {}; // NOTE: 追踪本轮使用的 rect，用于清理多余元素

    for (var t = 0; t < solveCount(); t++) {
        var minYs = [0, 0];
        for (var p = 0; p < 2; p++) {
            minYs[p] = (state.times[state.seedOn + p][t] !== 0)
                ? valToYCap(state.times[state.seedOn + p][t]) : 999999;
        }
        // 较高柱子（minY 越小）先画（底层全宽）
        var pOrder = (minYs[0] < minYs[1]) ? [0, 1] : [1, 0];

        for (var i = 0; i < 2; i++) {
            var p = pOrder[i];
            if (!state.playerEnabled[p]) continue;
            if (state.times[state.seedOn + p][t] === 0) continue;

            var barX = BAR_START + t * STRIDE;
            var minY = minYs[p];
            var maxY = valToYCap(0);
            var uncappedMaxY = valToY(0);

            // 较矮柱子居中缩窄（仅 Both 模式下两柱重叠时）
            var isTop = (state.playerEnabled[0] && state.playerEnabled[1] && i === 1 && minYs[0] !== 999999 && minYs[1] !== 999999);
            var fullW = BAR_W - 2 * bm;
            var bw = isTop ? fullW * 0.55 : fullW;
            var bx = barX + bm + (fullW - bw) / 2;

            var barHeight = (uncappedMaxY > maxY)
                ? maxY - bm * 2 - minY  // 有截断
                : maxY - minY;

            var key = p + '-' + t;
            usedKeys[key] = true;

            // NOTE: 复用已有 rect 元素；宽度/位置变化时用 Web Animations API 做过渡
            // appendChild 会将已有元素移到末尾，保证 pOrder 决定 SVG z-order
            var existing = barGroup.querySelector('.chart-bar[data-player="' + p + '"][data-slot="' + t + '"]');
            if (existing) {
                var oldW = parseFloat(existing.getAttribute('width'));
                var oldX = parseFloat(existing.getAttribute('x'));
                existing.setAttribute('y', minY);
                existing.setAttribute('height', Math.max(0, barHeight));
                existing.setAttribute('x', bx);
                existing.setAttribute('width', bw);
                barGroup.appendChild(existing); // NOTE: 移到末尾维持正确 z-order

                // NOTE: 宽度或 X 变化时播放过渡动画（内外翻转）
                if (Math.abs(oldW - bw) > 0.5 || Math.abs(oldX - bx) > 0.5) {
                    existing.animate([
                        { width: oldW + 'px', x: oldX + 'px' },
                        { width: bw + 'px', x: bx + 'px' }
                    ], { duration: 150, easing: 'ease' });
                }
            } else {
                barGroup.appendChild(createSvgElement('rect', {
                    x: bx, y: minY, width: bw, height: Math.max(0, barHeight),
                    fill: SHADES[p], rx: 2,
                    class: 'chart-bar',
                    'data-player': p, 'data-slot': t,
                }));
            }
        }
    }

    // NOTE: 清理本轮不再需要的旧 rect（如选手被禁用）
    var allBars = barGroup.querySelectorAll('.chart-bar');
    for (var j = 0; j < allBars.length; j++) {
        var el = allBars[j];
        var k = el.getAttribute('data-player') + '-' + el.getAttribute('data-slot');
        if (!usedKeys[k]) el.remove();
    }

    // NOTE: 柱顶成绩标签 — 在每根柱子上方显示对应成绩
    var LABEL_FONT = 24;
    var LABEL_H = 28;       // 标签占用高度（用于排斥计算）
    var LABEL_OFFSET = 8;   // 标签底部到柱顶的间距

    for (var t = 0; t < solveCount(); t++) {
        var colLabels = []; // 当前列的标签池

        for (var p = 0; p < 2; p++) {
            if (!state.playerEnabled[p]) continue;
            var val = state.times[state.seedOn + p][t];
            if (val === 0) continue;

            var barX = BAR_START + t * STRIDE;
            var cx = barX + BAR_W / 2; // 柱子水平中心
            var topY = valToYCap(val);
            var labelY = topY - LABEL_OFFSET;

            colLabels.push({
                origY: labelY,
                y: labelY,
                h: LABEL_H,
                x: cx,
                text: formatTime(val),
                col: darken(SHADES[p], 0.7),
                player: p, slot: t, // NOTE: 拖动模块用 — 关联标签到柱子
            });
        }

        // 同列两个标签排斥
        if (colLabels.length > 1) {
            resolveOverlaps(colLabels, 4);
        }

        // NOTE: 渲染标签 — 使用 feDropShadow 滤镜提供柔和白色阴影，在柱子上也清晰可读
        for (var li = 0; li < colLabels.length; li++) {
            var lb = colLabels[li];
            var el = createSvgElement('text', {
                x: lb.x, y: lb.y, fill: lb.col,
                'font-size': LABEL_FONT + 'px', 'font-family': 'Helvetica',
                'font-weight': 'bold', 'text-anchor': 'middle',
                filter: 'url(#barLabelShadow)',
                class: 'chart-bar-label',
                'data-player': lb.player, 'data-slot': lb.slot,
            });
            el.textContent = lb.text;
            topTextGroup.appendChild(el);
        }
    }
}

// ── 统计可视化（扇形曲线 + 连接线 + 排名文字） ──

// NOTE: 计算第 5 把的可能平均和排名范围
function getPA(t, p) {
    var _times = structuredClone(t);
    _times.pop();
    _times.sort((a, b) => a - b);
    // results: [best单次, worst单次, 阈值, BPA, WPA, 阈值avg, bestRank, worstRank]
    var results = [_times[0], _times[3], UNFINISHED_VALUE, 0, 0, UNFINISHED_VALUE, UNFINISHED_VALUE, UNFINISHED_VALUE];
    _times.unshift(0);
    results[3] = getAverage(_times, true);
    _times.shift();
    _times.push(DNF_VALUE);
    results[4] = getAverage(_times, true);
    _times.pop();

    var pr = getPossibleRank(_times, p);
    results[2] = pr[0];
    if (pr[1] === pr[2]) results[2] = DNF_VALUE; // 排名已确定
    _times.push(results[2]);
    results[5] = getAverage(_times, true);
    results[6] = pr[1];
    results[7] = pr[2];
    results[8] = pr[3] + 1;
    _times.pop();
    return results;
}

function getPossibleRank(selfTimes, p) {
    var averagesSeen = 0;
    var validsCount = getValidsCount();
    var results = [0, 0, 0, validsCount];
    for (var rank = 0; rank < state.times.length; rank++) {
        if (state.sortedCache[rank] === p) continue;
        var rt = state.times[state.sortedCache[rank]];
        var rankAverage = getAverage(rt, false);
        if (rankAverage >= 0 && rankAverage !== DNF_VALUE && rankAverage !== UNFINISHED_VALUE) {
            var otherSorted = [...structuredClone(rt)].sort((a, b) => a - b);
            var selfSorted = [...structuredClone(selfTimes)].sort((a, b) => a - b);
            var toWin = DNF_VALUE;
            if (otherSorted[3] >= DNF_VALUE) {
                if (selfSorted[0] < otherSorted[0]) toWin = DNF_VALUE;
            } else {
                var delta = selfSorted[0] < otherSorted[0] ? 1 : -2;
                toWin = (rankAverage * 3 + delta) - selfSorted[1] - selfSorted[2];
            }
            if (toWin >= selfSorted[3]) {
                results[1] = Math.min(averagesSeen, results[1]);
                results[2] = Math.min(averagesSeen, results[2]);
            } else if (toWin >= selfSorted[0]) {
                if (results[0] === 0) { results[0] = toWin; results[1] = averagesSeen; }
                results[2] = Math.max(averagesSeen + 1, results[2]);
            } else {
                results[1] = Math.max(averagesSeen + 1, results[1]);
                results[2] = Math.max(averagesSeen + 1, results[2]);
            }
            averagesSeen += 1;
        }
    }
    return results;
}

function drawStats() {
    var m = 5;

    // NOTE: 收集两个选手的标签数据，用于统一排斥计算
    var labelSets = [];  // [{labels, paVals, paY, ax, col, darkCol, filleds, p, shouldDrawMiddle}, ...]

    for (var p = 0; p < 2; p++) {
        var filleds = 0;
        for (var t = 0; t < solveCount(); t++) {
            if (state.times[state.seedOn + p][t] !== 0) filleds++;
        }
        if (filleds < solveCount() - 1) continue;
        if (!state.playerEnabled[p]) continue;

        if (isMo3()) {
            // NOTE: Mo3 不需要 PA 计算和扇形，只收集 Placed 所需数据
            var IX = chartIX();
            var diamondTip = IX[1] + IX[4];
            var ax = [diamondTip - 120, diamondTip - 40];
            var col = SHADES[p];
            var darkCol = darken(col, 0.7);
            labelSets.push({ paVals: null, paY: null, ax, col, darkCol, filleds, p, shouldDrawMiddle: false });
        } else {
            var paVals = getPA(state.times[state.seedOn + p], state.seedOn + p);
            var paY = paVals.map(v => valToYCap(v));

            var IX = chartIX();
            var diamondTip = IX[1] + IX[4];
            var ax = [diamondTip - 120, diamondTip - 40];

            var col = SHADES[p];
            var darkCol = darken(col, 0.7);
            var shouldDrawMiddle = (paVals[7] > paVals[6] && (filleds === 4 || state.timeLive[0] === p));

            // NOTE: BPA→WPA 竖直柱 — 替代扇形曲线，直观展示 avg 可能范围
            var barCx = (ax[0] + ax[1]) / 2; // 柱子水平中心
            var paBarW = 40; // 柱宽
            var paTopY = paY[4]; // WPA（较差 = 较高位置 = 较小 Y）
            var paBotY = paY[3]; // BPA（较好 = 较低位置 = 较大 Y）
            var paBarH = Math.max(3, paBotY - paTopY); // 至少 3px 高度
            var fadedCol = fade(col, 0.25);

            // NOTE: 用 <g> 包裹竖柱，添加 hover tooltip 说明上下端含义
            var paBarGroup = createSvgElement('g', {});
            paBarGroup.appendChild(createSvgElement('rect', {
                x: barCx - paBarW / 2, y: paTopY, width: paBarW, height: paBarH,
                fill: fadedCol, stroke: darkCol, 'stroke-width': 2, rx: 3,
                class: 'chart-pa-bar',
                'data-player': p, 'data-pa-cx': barCx, 'data-pa-w': paBarW,
                'data-wpa-y': paTopY, 'data-bpa-y': paBotY,
            }));
            statsGroup.appendChild(paBarGroup);

            labelSets.push({ paVals, paY, ax, col, darkCol, filleds, p, shouldDrawMiddle, barCx });
        }
    }

    // NOTE: 收集所有右侧标签供统一排斥
    var rightLabels = [];

    for (var si = 0; si < labelSets.length; si++) {
        var s = labelSets[si];
        var tx0 = s.ax[0] - m;
        var tx1 = s.ax[1] + m;

        // NOTE: Mo3 模式下不画 BPA/WPA 扇形和标签
        if (isMo3()) {
            if (s.filleds === solveCount()) {
                // Mo3 全部完成 — 绘制连接线

                // 连接线
                var avg = getAverage(state.times[state.seedOn + s.p], true);
                var ys = [valToYCap(state.times[state.seedOn + s.p][solveCount() - 1]), valToYCap(avg)];
                var outerX = s.ax[0] - 5;
                var innerIX = chartIX();
                var innerX = innerIX[1] + innerIX[4] + 2;
                var arrowX = innerX - 18;
                drawCurvedLine([s.ax[0], s.ax[1], outerX, innerX, arrowX], ys, s.darkCol);
            }
            continue; // NOTE: Mo3 不绘制 BPA/WPA 右侧标签
        }

        if (s.filleds === 4 || state.timeLive[0] === s.p) {
            // NOTE: 数值标签居中在竖柱正上方/下方（不再显示 BPA/WPA 标题）
            var labelCx = s.barCx;

            // ── BPA 数值（柱子下方） ──
            rightLabels.push({
                origY: s.paY[3] + 10, y: s.paY[3] + 10, h: 35, texts: [
                    { dy: 0, text: formatTime(s.paVals[3]), size: 28 },
                ], x: labelCx, col: s.darkCol, anchor: 'center',
                wrMetric: 'bpa', wrValue: s.paVals[3]
            });
            // ── WPA 数值（柱子上方） ──
            rightLabels.push({
                origY: s.paY[4] - 24, y: s.paY[4] - 24, h: 35, texts: [
                    { dy: 0, text: formatTime(s.paVals[4]), size: 28 },
                ], x: labelCx, col: s.darkCol, anchor: 'center',
                wrMetric: 'wpa', wrValue: s.paVals[4]
            });


        } else if (s.filleds === 5) {
            // ── 5 把完成：数值标签居中在柱子上下 ──
            var labelCx = s.barCx;
            rightLabels.push({
                origY: s.paY[3] + 24, y: s.paY[3] + 24, h: 35, texts: [
                    { dy: 0, text: formatTime(s.paVals[3]), size: 30 },
                ], x: labelCx, col: s.darkCol, anchor: 'center',
                wrMetric: 'bpa', wrValue: s.paVals[3]
            });
            rightLabels.push({
                origY: s.paY[4] - 4, y: s.paY[4] - 4, h: 35, texts: [
                    { dy: 0, text: formatTime(s.paVals[4]), size: 30 },
                ], x: labelCx, col: s.darkCol, anchor: 'center',
                wrMetric: 'wpa', wrValue: s.paVals[4]
            });




        }
    }

    // NOTE: 统一排斥右侧标签，防止不同选手的 BPA/WPA 互相重叠
    if (rightLabels.length > 1) {
        resolveOverlaps(rightLabels, 8);
    }

    // 渲染排斥后的右侧标签
    for (var li = 0; li < rightLabels.length; li++) {
        var lb = rightLabels[li];
        for (var ti = 0; ti < lb.texts.length; ti++) {
            addText(topTextGroup, lb.x, lb.y + lb.texts[ti].dy, lb.texts[ti].text, lb.col, lb.texts[ti].size, lb.anchor);
        }
        // NOTE: WR 徽章 — BPA/WPA 值 ≤ WR 时显示
        if (lb.wrMetric && lb.wrValue > 0 && lb.wrValue !== DNF_VALUE && isWR(state.event, lb.wrMetric, lb.wrValue)) {
            // 在最后一行文字右侧画 WR 徽章
            var lastText = lb.texts[lb.texts.length - 1];
            var approxW = lastText.text.length * lastText.size * 0.55;
            // NOTE: anchor=center 时文字从 lb.x 居中，badge 放在右端
            var badgeX = (lb.anchor === 'center')
                ? lb.x + approxW / 2 - 8
                : lb.x + approxW - 8;
            drawWRBadge(topTextGroup, badgeX, lb.y + lastText.dy - lastText.size / 2 - 6);
        }
        // NOTE: 标签被推离原位时画引线（leader line）
        var shift = Math.abs(lb.y - lb.origY);
        if (shift > 5) {
            topTextGroup.appendChild(createSvgElement('line', {
                x1: lb.x, y1: lb.origY, x2: lb.x, y2: lb.y - 3,
                stroke: lb.col, 'stroke-width': 1, 'stroke-dasharray': '4,3',
                opacity: 0.5,
            }));
        }
    }
}

// NOTE: 扇形曲线（余弦插值填充区域）
function drawCurvedSegment(x, y, col, drawMiddle) {
    var fadedCol = fade(col, 0.25);
    var darkCol = darken(col, 0.7);
    var PIECES = 15;
    var d_fill = '', d_top = '', d_bot = '', d_mid = '';

    for (var i = 0; i < PIECES; i++) {
        var p1 = i / PIECES, p2 = (i + 1) / PIECES;
        var x1 = lerp(x[0], x[1], p1), x2 = lerp(x[0], x[1], p2);
        var yt1 = coslerp(y[0], y[3], p1), yt2 = coslerp(y[0], y[3], p2);
        var yb1 = coslerp(y[1], y[4], p1), yb2 = coslerp(y[1], y[4], p2);

        // 填充四边形
        d_fill += 'M' + x1 + ',' + yt1 + ' L' + x2 + ',' + yt2 + ' L' + x2 + ',' + yb2 + ' L' + x1 + ',' + yb1 + 'Z ';
        // 上下边线
        d_top += (i === 0 ? 'M' : 'L') + x1 + ',' + yt1 + ' ';
        d_bot += (i === 0 ? 'M' : 'L') + x1 + ',' + yb1 + ' ';

        if (drawMiddle && y[2] !== y[1] && y[2] !== y[0]) {
            var ym1 = coslerp(y[2], y[5], p1), ym2 = coslerp(y[2], y[5], p2);
            d_mid += (i === 0 ? 'M' : 'L') + x1 + ',' + ym1 + ' ';
            if (i === PIECES - 1) d_mid += 'L' + x2 + ',' + ym2;
        }
        if (i === PIECES - 1) {
            d_top += 'L' + x2 + ',' + yt2;
            d_bot += 'L' + x2 + ',' + yb2;
        }
    }

    statsGroup.appendChild(createSvgElement('path', { d: d_fill, fill: fadedCol }));
    statsGroup.appendChild(createSvgElement('path', { d: d_top, fill: 'none', stroke: darkCol, 'stroke-width': 3 }));
    statsGroup.appendChild(createSvgElement('path', { d: d_bot, fill: 'none', stroke: darkCol, 'stroke-width': 3 }));
    if (d_mid) statsGroup.appendChild(createSvgElement('path', { d: d_mid, fill: 'none', stroke: darkCol, 'stroke-width': 3 }));
}

// NOTE: 连接线（余弦插值曲线 + 箭头）
function drawCurvedLine(x, y, col) {
    var PIECES = 10;
    var d = '';
    for (var i = 0; i <= PIECES; i++) {
        var prog = i / PIECES;
        var px = lerp(x[0], x[1], prog);
        var py = coslerp(y[0], y[1], prog);
        d += (i === 0 ? 'M' : 'L') + px + ',' + py + ' ';
    }
    statsGroup.appendChild(createSvgElement('path', { d: d, fill: 'none', stroke: col, 'stroke-width': 3 }));
    // 水平延伸线
    statsGroup.appendChild(createSvgElement('line', { x1: x[0], y1: y[0], x2: x[2], y2: y[0], stroke: col, 'stroke-width': 3 }));
    statsGroup.appendChild(createSvgElement('line', { x1: x[1], y1: y[1], x2: x[3], y2: y[1], stroke: col, 'stroke-width': 3 }));
    // 箭头
    statsGroup.appendChild(createSvgElement('line', { x1: x[3], y1: y[1], x2: x[4], y2: y[1] + 18, stroke: col, 'stroke-width': 3 }));
    statsGroup.appendChild(createSvgElement('line', { x1: x[3], y1: y[1], x2: x[4], y2: y[1] - 18, stroke: col, 'stroke-width': 3 }));
}

// NOTE: 快捷创建 SVG 文字（带 text halo 防止被线条遮挡）
function addText(parent, x, y, text, fill, size, anchor) {
    // NOTE: SVG text-anchor 合法值是 start|middle|end，兼容调用方传入的 'center'
    var svgAnchor = (anchor === 'center') ? 'middle' : anchor;
    var el = createSvgElement('text', {
        x: x, y: y, fill: fill,
        'font-size': size + 'px', 'font-family': 'Helvetica',
        'text-anchor': svgAnchor,
        // NOTE: paint-order:stroke 让描边画在填充下面，形成背景色光晕
        'stroke': '#E7DFD5', 'stroke-width': 5, 'paint-order': 'stroke',
    });
    el.textContent = text;
    parent.appendChild(el);
}

// ── 平均菱形标签 ──

function drawAverages() {
    var IX = chartIX();
    var im = IX[4]; // 菱形内边距
    var m = [3, 13, 18]; // 标签半高
    var offsetY = [0, 7.5, 0]; // NOTE: type 2 用 0 配合 dominant-baseline:central 居中
    var jm = 50; // 左尖到文字的水平距离
    var maxSkew = 60;
    var cursor = 9999;
    var typePrev = 0;

    for (var rank = 0; rank < state.times.length; rank++) {
        var p = state.sortedCache[rank];
        var average = getAverage(state.times[p], false);
        var type = (p === state.seedOn || p === state.seedOn + 1) ? 2 : (rank < 3 ? 1 : 0);

        var pIdx = p - state.seedOn;
        var showDiamond = (type < 2) || (pIdx >= 0 && pIdx <= 1 && state.playerEnabled[pIdx]);

        if (average !== UNFINISHED_VALUE && type >= 1 && showDiamond) {
            var y = valToYCap(average);
            var yWings = valToY(average);
            var cy = Math.max(y, 80);
            cursor = Math.min(cursor - (m[typePrev] + 3 + m[type]), cy);
            var ay = Math.min(Math.max(yWings, cursor - maxSkew), cursor + maxSkew);

            // NOTE: 菱形颜色与柱子/名字格一致，不做 darken
            var fillColor = '#000';
            if (p === state.seedOn || p === state.seedOn + 1) {
                fillColor = SHADES[p - state.seedOn];
            }

            // NOTE: 只显示成绩（颜色已代表选手身份）
            var labelText = formatTime(average);
            var fontSize = (type === 2) ? 30 : 22;

            // 测量文字宽度（近似）
            var tw = labelText.length * fontSize * 0.55 + 20;
            // NOTE: 菱形左尖对齐 BPA-WPA 竖柱右边缘
            var lx = chartIX()[1] + im - 60;
            var rx = lx + jm + tw;

            // 菱形路径（左尖右方）
            var d = 'M' + lx + ',' + ay +
                ' L' + (lx + jm) + ',' + (cursor - m[type]) +
                ' L' + rx + ',' + (cursor - m[type]) +
                ' L' + rx + ',' + (cursor + m[type]) +
                ' L' + (lx + jm) + ',' + (cursor + m[type]) + ' Z';

            // NOTE: type=2 的菱形标签用 <g> 包裹，添加 class 和 data 属性供拖动系统检测
            var avgBadgeGroup = (type === 2) ? createSvgElement('g', {
                class: 'chart-avg-badge',
                'data-player': pIdx,
                'data-avg-y': cursor, // SVG Y 坐标（用于拖动偏移计算）
                cursor: 'ns-resize',
            }) : null;

            var pathTarget = avgBadgeGroup || avgGroup;
            pathTarget.appendChild(createSvgElement('path', {
                d: d, fill: fillColor,
            }));

            // 白色文字
            if (type >= 1) {
                var text = createSvgElement('text', {
                    x: lx + jm + 5, y: cursor + offsetY[type],
                    'font-size': fontSize + 'px', 'font-family': 'Helvetica',
                    fill: '#fff', 'text-anchor': 'start',
                    'dominant-baseline': 'central',
                });
                text.textContent = labelText;
                (avgBadgeGroup || avgGroup).appendChild(text);

                // NOTE: WR 徽章 — 平均值 ≤ WR 时显示红色 "WR"
                if (type === 2 && average > 0 && average !== DNF_VALUE && isWR(state.event, 'average', average)) {
                    drawWRBadge(topTextGroup, rx - 18, cursor - fontSize / 2 - 4);
                }
                // NOTE: PR 徽章 — 平均值打破 Target Avg 时显示蓝色 "PR"（WR 已显示时跳过）
                else if (type === 2 && average > 0 && average !== DNF_VALUE) {
                    var target = getTargetAvg(p);
                    // 普通项目 avg <= target（越小越好），mbf avg >= target（越大越好）
                    if (target > 0 && (isMbf() ? (average >= target) : (average <= target))) {
                        drawPRBadge(topTextGroup, rx - 14, cursor - fontSize / 2 - 4);
                    }
                }

                // NOTE: 🏆 标记 — 两个选手都有 avg 时，赢家旁显示奖杯
                if (type === 2 && pIdx >= 0 && pIdx <= 1) {
                    var otherP = pIdx === 0 ? 1 : 0;
                    if (state.playerEnabled[otherP]) {
                        var otherAvg = getAverage(state.times[state.seedOn + otherP], false);
                        // NOTE: 两人都有有效 avg 且当前选手更好（普通项目越小越好，mbf 越大越好）
                        var iWin = otherAvg !== UNFINISHED_VALUE &&
                            (isMbf() ? average > otherAvg : average < otherAvg);
                        if (iWin) {
                            var trophy = createSvgElement('text', {
                                x: rx + 8, y: cursor,
                                'font-size': '22px',
                                'dominant-baseline': 'central',
                            });
                            trophy.textContent = '🏆';
                            avgGroup.appendChild(trophy);
                        }
                    }
                }
            }

            // NOTE: 将包裹的 group 加入 avgGroup
            if (avgBadgeGroup) avgGroup.appendChild(avgBadgeGroup);

            typePrev = type;
        }
    }
}

// ── 工具函数 ──

// NOTE: 渲染红色 WR 徽章（缩小版，定位在文字右上角）
function drawWRBadge(parent, x, y) {
    var bw = 28, bh = 14, br = 3;
    parent.appendChild(createSvgElement('rect', {
        x: x, y: y - bh / 2, width: bw, height: bh, rx: br,
        fill: '#e03030',
    }));
    var text = createSvgElement('text', {
        x: x + bw / 2, y: y,
        'font-size': '10px', 'font-family': 'Helvetica', 'font-weight': 'bold',
        fill: '#fff', 'text-anchor': 'middle', 'dominant-baseline': 'central',
    });
    text.textContent = 'WR';
    parent.appendChild(text);
}

// NOTE: 渲染蓝色 PR 徽章（缩小版，定位在文字右上角）
function drawPRBadge(parent, x, y) {
    var bw = 24, bh = 14, br = 3;
    parent.appendChild(createSvgElement('rect', {
        x: x, y: y - bh / 2, width: bw, height: bh, rx: br,
        fill: '#3478f6',
    }));
    var text = createSvgElement('text', {
        x: x + bw / 2, y: y,
        'font-size': '10px', 'font-family': 'Helvetica', 'font-weight': 'bold',
        fill: '#fff', 'text-anchor': 'middle', 'dominant-baseline': 'central',
    });
    text.textContent = 'PR';
    parent.appendChild(text);
}

// NOTE: 标签排斥算法 — 防止重叠的标签互相挤压
// labels: [{y, h, origY, ...}] — y 为当前位置，h 为标签高度
// minGap: 标签之间的最小间距（像素）
function resolveOverlaps(labels, minGap) {
    labels.sort(function (a, b) { return a.y - b.y; });
    // 多轮迭代直到无碰撞（最多 10 轮防无限循环）
    for (var iter = 0; iter < 10; iter++) {
        var moved = false;
        for (var i = 1; i < labels.length; i++) {
            var overlap = (labels[i - 1].y + labels[i - 1].h + minGap) - labels[i].y;
            if (overlap > 0) {
                // 各推一半
                labels[i - 1].y -= overlap / 2;
                labels[i].y += overlap / 2;
                moved = true;
            }
        }
        if (!moved) break;
    }
}

function getLastName(name) {
    var arr = name.split(' ');
    var last = arr[arr.length - 1];
    return last.length >= 6 ? last.substring(0, 6) : last;
}

function darken(col, fac) {
    var a = col.indexOf('(') + 1;
    var b = col.indexOf(')');
    var parts = col.substring(a, b).split(',');
    var newParts = parts.map((v, i) => i < 3 ? (fac * parseFloat(v)) : v);
    return col.substring(0, a) + newParts.join(',') + col.substring(b);
}

function fade(col, fac) {
    return col.substring(0, col.length - 4) + fac + ')';
}

// NOTE: 余弦插值
function coslerp(a, b, x) {
    var x2 = 0.5 - 0.5 * Math.cos(x * Math.PI);
    return a + (b - a) * x2;
}

function lerp(a, b, x) {
    return a + (b - a) * x;
}

// ── SVG DOM 工具 ──

function createSvgElement(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    for (var key in attrs) {
        el.setAttribute(key, attrs[key]);
    }
    return el;
}

function clearGroup(g) {
    while (g.firstChild) g.removeChild(g.firstChild);
}

// ── 拖动模块需要的导出 ──

// NOTE: Y 坐标反算为 centiseconds 值（valToY 的逆函数）
export function yToVal(y) {
    return gp.min + (1 - (y - gp.y) / gp.h) * gp.span;
}

export function getSvgEl() { return svgEl; }
export function getChartContainer() { return chartContainer; }
export { valToY, valToYCap, BAR_START, BAR_W, STRIDE, SHADES };
export function getGp() { return gp; }

