// NOTE: SVG 图表渲染 — 柱状图、Y 轴、网格线、统计曲线、菱形标签
// 使用 viewBox 保持内部坐标系，浏览器自动处理缩放

import {
    DNF_VALUE, UNFINISHED_VALUE,
    formatTime, getAverage, getBestSingle, rankify
} from './calc_engine.js';
import {
    state, getRankOf, getValidsCount, solveCount, isMo3
} from './state.js';
import { isWR } from './wr_data.js';

// ── 布局常量（与原 canvas 1600×900 坐标系对齐） ──

const BAR_W = 90;          // 柱宽
const STRIDE = 105;        // 组间距
const BAR_START = 390;     // 第一组 x 起点

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
}

// ── 主渲染入口 ──

export function render() {
    if (!svgEl) return;

    // 计算图表参数
    computeGridParams();

    // 清空并重绘
    clearGroup(gridGroup);
    clearGroup(barGroup);
    clearGroup(statsGroup);
    clearGroup(avgGroup);
    clearGroup(topTextGroup);

    drawGridLines();
    drawBars();
    drawStats();
    drawAverages();
}

// ── 图表参数计算（等价于原 setGridParameters） ──

function computeGridParams() {
    // 图表绘制区域
    gp.x = 340;
    gp.y = 40;
    gp.w = 1600;
    gp.h = 700;

    gp.min = DNF_VALUE;
    gp.max = -DNF_VALUE;
    gp.viewcount = 0;

    for (var p = 0; p < 2; p++) {
        if (!state.playerEnabled[p]) continue;
        for (var t = 0; t < solveCount(); t++) {
            var val = state.times[state.seedOn + p][t];
            if (val !== 0) {
                addToViewingWindow(val);
                if (val !== DNF_VALUE && val !== UNFINISHED_VALUE) {
                    addToViewingWindow(val * 0.8);
                }
            }
        }
    }

    var topAvg = getAverage(state.times[state.sortedCache[0]], false);
    if (topAvg >= 0 && topAvg !== DNF_VALUE && topAvg !== UNFINISHED_VALUE) {
        addToViewingWindow(topAvg);
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
    var units = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 3000, 6000, 12000, 30000, 60000, 120000, 180000, 360000, 720000, 1080000, 2160000, 4320000, 8640000, DNF_VALUE];
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
            stroke: 'rgba(0,0,0,0.3)', 'stroke-width': 2,
        }));
        // Y 轴标签
        var label = createSvgElement('text', {
            x: BAR_START - 8, y: appY + 7,
            'text-anchor': 'end', 'font-size': '22px', 'font-family': 'Helvetica',
            fill: '#000',
        });
        label.textContent = formatTime(yLine, true);
        gridGroup.appendChild(label);
    }
}

// ── 柱状图 ──

function drawBars() {
    var bm = 7; // 柱内边距

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

            // 柱子矩形
            barGroup.appendChild(createSvgElement('rect', {
                x: bx, y: minY, width: bw, height: Math.max(0, barHeight),
                fill: SHADES[p], rx: 2,
            }));
        }
    }

    // NOTE: 柱顶成绩标签 — 在每根柱子上方显示对应成绩
    var LABEL_FONT = 18;
    var LABEL_H = 22;       // 标签占用高度（用于排斥计算）
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

            // 绘制扇形曲线（不受排斥影响）
            drawCurvedSegment(ax, paY, col, shouldDrawMiddle);

            labelSets.push({ paVals, paY, ax, col, darkCol, filleds, p, shouldDrawMiddle });
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
                // Mo3 全部完成 — 只显示 Placed 排名
                var placedX = s.p === 0 ? BAR_START + 200 : chartEnd() - 200;
                var ty = valToYCap(DNF_VALUE);
                addText(topTextGroup, placedX, ty - 4, 'Placed', s.darkCol, 22, 'center');
                addText(topTextGroup, placedX, ty + 26, rankify(getRankOf(state.seedOn + s.p)) + ' / ' + getValidsCount(), s.darkCol, 30, 'center');

                // 连接线
                var avg = getAverage(state.times[state.seedOn + s.p], true);
                var ys = [valToYCap(state.times[state.seedOn + s.p][solveCount() - 1]), valToYCap(avg)];
                var outerX = s.ax[0] - 5;
                var innerIX = chartIX();
                var innerX = innerIX[1] + innerIX[4] + 2;
                var arrowX = innerX - 18;
                drawCurvedLine([s.ax[0], s.ax[1], outerX, innerX, arrowX], ys, '#000');
            }
            continue; // NOTE: Mo3 不绘制 BPA/WPA 右侧标签
        }

        if (s.filleds === 4 || state.timeLive[0] === s.p) {
            // ── 左侧文字（best/worst 单次、阈值） ──
            var ay0 = s.paY[0], ay1 = s.paY[1];
            if (s.filleds === 4 && s.paVals[2] !== DNF_VALUE) {
                ay1 = Math.min(ay1, s.paY[2] - 40);
                ay0 = Math.max(ay0, s.paY[2] + 45);
            }
            addText(topTextGroup, tx0, ay0 + 7, formatTime(s.paVals[0]), s.darkCol, 30, 'end');
            addText(topTextGroup, tx0, ay1 + 7, formatTime(s.paVals[1]), s.darkCol, 30, 'end');

            if (s.paVals[7] > s.paVals[6]) {
                addText(topTextGroup, tx0, s.paY[2] - 3, formatTime(s.paVals[2]), s.darkCol, 30, 'end');
                addText(topTextGroup, tx0, s.paY[2] + 20, 'for ' + rankify(s.paVals[6]) + ' / ' + s.paVals[8], s.darkCol, 22, 'end');
                var ty = valToYCap(DNF_VALUE);
                addText(topTextGroup, tx0, ty - 4, 'Can place', s.darkCol, 22, 'end');
                addText(topTextGroup, tx0, ty + 26, rankify(s.paVals[6]) + ' to ' + rankify(s.paVals[7]), s.darkCol, 30, 'end');
            } else {
                addText(topTextGroup, tx0, s.paY[2] - 7, 'Guaranteed', s.darkCol, 22, 'end');
                addText(topTextGroup, tx0, s.paY[2] + 21, rankify(s.paVals[6]) + ' / ' + s.paVals[8], s.darkCol, 30, 'end');
            }

            // ── 右侧 BPA/WPA（收集进统一排斥池） ──
            var bpaY = s.paY[3] + 7, wpaY = s.paY[4] - 21;
            // 先做自身 gap 保证
            var gap = bpaY - wpaY;
            if (gap <= 30) { bpaY += (24 - gap) / 2; wpaY -= (24 - gap) / 2; }

            // NOTE: 每个 BPA/WPA 块占两行（标题22px + 数值30px），总高约 55px
            rightLabels.push({ origY: s.paY[3] + 7, y: bpaY, h: 55, texts: [
                { dy: 0, text: 'BPA', size: 22 },
                { dy: 28, text: formatTime(s.paVals[3]), size: 30 },
            ], x: tx1, col: s.darkCol, anchor: 'start',
                wrMetric: 'bpa', wrValue: s.paVals[3] });
            rightLabels.push({ origY: s.paY[4] - 21, y: wpaY, h: 55, texts: [
                { dy: 0, text: 'WPA', size: 22 },
                { dy: 28, text: formatTime(s.paVals[4]), size: 30 },
            ], x: tx1, col: s.darkCol, anchor: 'start',
                wrMetric: 'wpa', wrValue: s.paVals[4] });

            // NOTE: 计时第 5 把时，实时画黑色连接线
            if (s.filleds === 5 && state.timeLive[0] === s.p) {
                var avg = getAverage(state.times[state.seedOn + s.p], true);
                var ys = [valToYCap(state.times[state.seedOn + s.p][4]), valToYCap(avg)];
                var outerX = s.ax[0] - 5;
                var innerX = chartIX()[1] + chartIX()[4] + 2;
                var arrowX = innerX - 18;
                drawCurvedLine([s.ax[0], s.ax[1], outerX, innerX, arrowX], ys, '#000');
            }
        } else if (s.filleds === 5) {
            // ── 5 把完成：只有数值标签 ──
            rightLabels.push({ origY: s.paY[3] + 24, y: s.paY[3] + 24, h: 35, texts: [
                { dy: 0, text: formatTime(s.paVals[3]), size: 30 },
            ], x: tx1, col: s.darkCol, anchor: 'start',
                wrMetric: 'bpa', wrValue: s.paVals[3] });
            rightLabels.push({ origY: s.paY[4] - 4, y: s.paY[4] - 4, h: 35, texts: [
                { dy: 0, text: formatTime(s.paVals[4]), size: 30 },
            ], x: tx1, col: s.darkCol, anchor: 'start',
                wrMetric: 'wpa', wrValue: s.paVals[4] });

            // 连接线（扇形到柱子区域）
            var avg = getAverage(state.times[state.seedOn + s.p], true);
            var ys = [valToYCap(state.times[state.seedOn + s.p][4]), valToYCap(avg)];
            var outerX = s.ax[0] - 5;
            var innerX = chartIX()[1] + chartIX()[4] + 2;
            var arrowX = innerX - 18;
            drawCurvedLine([s.ax[0], s.ax[1], outerX, innerX, arrowX], ys, '#000');

            // Placed 文字
            var placedX = s.p === 0 ? BAR_START + 200 : chartEnd() - 200;
            var ty = valToYCap(DNF_VALUE);
            addText(topTextGroup, placedX, ty - 4, 'Placed', s.darkCol, 22, 'center');
            addText(topTextGroup, placedX, ty + 26, rankify(getRankOf(state.seedOn + s.p)) + ' / ' + getValidsCount(), s.darkCol, 30, 'center');
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
            drawWRBadge(topTextGroup, lb.x + approxW + 2, lb.y + lastText.dy - 10);
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
    var el = createSvgElement('text', {
        x: x, y: y, fill: fill,
        'font-size': size + 'px', 'font-family': 'Helvetica',
        'text-anchor': anchor,
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
            var lx = chartIX()[1] + im;
            var rx = lx + jm + tw;

            // 菱形路径（左尖右方）
            var d = 'M' + lx + ',' + ay +
                ' L' + (lx + jm) + ',' + (cursor - m[type]) +
                ' L' + rx + ',' + (cursor - m[type]) +
                ' L' + rx + ',' + (cursor + m[type]) +
                ' L' + (lx + jm) + ',' + (cursor + m[type]) + ' Z';
            avgGroup.appendChild(createSvgElement('path', {
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
                avgGroup.appendChild(text);

                // NOTE: WR 徽章 — 平均值 ≤ WR 时显示红色 "WR"
                if (type === 2 && average > 0 && average !== DNF_VALUE && isWR(state.event, 'average', average)) {
                    drawWRBadge(avgGroup, rx + 5, cursor);
                }
            }

            typePrev = type;
        }
    }
}

// ── 工具函数 ──

// NOTE: 渲染红色 WR 徽章（圆角矩形 + 白色 "WR" 文字）
function drawWRBadge(parent, x, y) {
    var bw = 42, bh = 22, br = 4;
    parent.appendChild(createSvgElement('rect', {
        x: x, y: y - bh / 2, width: bw, height: bh, rx: br,
        fill: '#e03030',
    }));
    var text = createSvgElement('text', {
        x: x + bw / 2, y: y,
        'font-size': '16px', 'font-family': 'Helvetica', 'font-weight': 'bold',
        fill: '#fff', 'text-anchor': 'middle', 'dominant-baseline': 'central',
    });
    text.textContent = 'WR';
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

