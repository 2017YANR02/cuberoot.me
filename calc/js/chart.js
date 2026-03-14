// NOTE: SVG 图表渲染 — 柱状图、Y 轴、网格线、统计曲线、菱形标签
// 使用 viewBox 保持内部坐标系，浏览器自动处理缩放

import {
    DNF_VALUE, UNFINISHED_VALUE,
    formatTime, getAverage, getBestSingle, rankify
} from './calc_engine.js';
import {
    state, getRankOf, getValidsCount
} from './state.js';

// ── 布局常量（与原 canvas 1600×900 坐标系对齐） ──

const BAR_W = 90;          // 柱宽
const STRIDE = 105;        // 组间距
const BAR_START = 390;     // 第一组 x 起点
const CHART_END = BAR_START + 5 * STRIDE - (STRIDE - BAR_W);
const CHART_CENTER = (BAR_START + CHART_END) / 2;

// NOTE: 统计区域入口参数（与原 setGridParameters 的 ix 参数对齐）
const IX = [CHART_END, CHART_END + 100, CHART_END, CHART_END + 350, 30];

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

    svgEl.appendChild(gridGroup);
    svgEl.appendChild(barGroup);
    svgEl.appendChild(statsGroup);
    svgEl.appendChild(avgGroup);

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
        for (var t = 0; t < 5; t++) {
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
            x1: BAR_START, y1: appY, x2: CHART_END, y2: appY,
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

    for (var t = 0; t < 5; t++) {
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
    for (var p = 0; p < 2; p++) {
        var filleds = 0;
        for (var t = 0; t < 5; t++) {
            if (state.times[state.seedOn + p][t] !== 0) filleds++;
        }
        if (filleds < 4) continue;

        if (!state.playerEnabled[p]) continue;

        var paVals = getPA(state.times[state.seedOn + p], state.seedOn + p);
        var paY = paVals.map(v => valToYCap(v));

        // 扇形 x 坐标（紧贴菱形左尖前方）
        var diamondTip = IX[1] + IX[4];
        var ax = [diamondTip - 120, diamondTip - 40];

        var col = SHADES[p];
        var darkCol = darken(col, 0.7);
        var shouldDrawMiddle = (paVals[7] > paVals[6] && (filleds === 4 || state.timeLive[0] === p));

        // 绘制扇形曲线
        drawCurvedSegment(ax, paY, col, shouldDrawMiddle);

        // ── 左侧文字（best/worst 单次、阈值） ──
        var tx0 = ax[0] - m;
        if (filleds === 4 || state.timeLive[0] === p) {
            var ay0 = paY[0], ay1 = paY[1];
            if (filleds === 4 && paVals[2] !== DNF_VALUE) {
                ay1 = Math.min(ay1, paY[2] - 40);
                ay0 = Math.max(ay0, paY[2] + 45);
            }
            addText(statsGroup, tx0, ay0 + 7, formatTime(paVals[0]), darkCol, 30, 'end');
            addText(statsGroup, tx0, ay1 + 7, formatTime(paVals[1]), darkCol, 30, 'end');

            if (paVals[7] > paVals[6]) {
                addText(statsGroup, tx0, paY[2] - 3, formatTime(paVals[2]), darkCol, 30, 'end');
                addText(statsGroup, tx0, paY[2] + 20, 'for ' + rankify(paVals[6]) + ' / ' + paVals[8], darkCol, 22, 'end');
                var ty = valToYCap(DNF_VALUE);
                addText(statsGroup, tx0, ty - 4, 'Can place', darkCol, 22, 'end');
                addText(statsGroup, tx0, ty + 26, rankify(paVals[6]) + ' to ' + rankify(paVals[7]), darkCol, 30, 'end');
            } else {
                addText(statsGroup, tx0, paY[2] - 7, 'Guaranteed', darkCol, 22, 'end');
                addText(statsGroup, tx0, paY[2] + 21, rankify(paVals[6]) + ' / ' + paVals[8], darkCol, 30, 'end');
            }

            // ── 右侧文字（BPA/WPA） ──
            var tx1 = ax[1] + m;
            var bpaY = paY[3] + 7, wpaY = paY[4] - 21;
            var gap = bpaY - wpaY;
            if (gap <= 30) { bpaY += (24 - gap) / 2; wpaY -= (24 - gap) / 2; }
            addText(statsGroup, tx1, bpaY, 'BPA', darkCol, 22, 'start');
            addText(statsGroup, tx1, bpaY + 28, formatTime(paVals[3]), darkCol, 30, 'start');
            addText(statsGroup, tx1, wpaY, 'WPA', darkCol, 22, 'start');
            addText(statsGroup, tx1, wpaY + 28, formatTime(paVals[4]), darkCol, 30, 'start');

            // NOTE: 计时第 5 把时，实时画黑色连接线
            if (filleds === 5 && state.timeLive[0] === p) {
                var avg = getAverage(state.times[state.seedOn + p], true);
                var ys = [valToYCap(state.times[state.seedOn + p][4]), valToYCap(avg)];
                var outerX = ax[0] - 5;
                var innerX = IX[1] + IX[4] + 2;
                var arrowX = innerX - 18;
                drawCurvedLine([ax[0], ax[1], outerX, innerX, arrowX], ys, '#000');
            }
        } else if (filleds === 5) {
            // ── 5 把完成：BPA/WPA + 连接线 + Placed ──
            var tx1 = ax[1] + m;
            addText(statsGroup, tx1, paY[3] + 24, formatTime(paVals[3]), darkCol, 30, 'start');
            addText(statsGroup, tx1, paY[4] - 4, formatTime(paVals[4]), darkCol, 30, 'start');

            // 连接线（扇形到柱子区域）
            var avg = getAverage(state.times[state.seedOn + p], true);
            var ys = [valToYCap(state.times[state.seedOn + p][4]), valToYCap(avg)];
            var outerX = ax[0] - 5;
            var innerX = IX[1] + IX[4] + 2;
            var arrowX = innerX - 18;
            drawCurvedLine([ax[0], ax[1], outerX, innerX, arrowX], ys, '#000');

            // Placed 文字
            var placedX = p === 0 ? BAR_START + 200 : CHART_END - 200;
            var ty = valToYCap(DNF_VALUE);
            addText(statsGroup, placedX, ty - 4, 'Placed', darkCol, 22, 'center');
            addText(statsGroup, placedX, ty + 26, rankify(getRankOf(state.seedOn + p)) + ' / ' + getValidsCount(), darkCol, 30, 'center');
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

// NOTE: 快捷创建 SVG 文字
function addText(parent, x, y, text, fill, size, anchor) {
    var el = createSvgElement('text', {
        x: x, y: y, fill: fill,
        'font-size': size + 'px', 'font-family': 'Helvetica',
        'text-anchor': anchor,
    });
    el.textContent = text;
    parent.appendChild(el);
}

// ── 平均菱形标签 ──

function drawAverages() {
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
            var lx = IX[1] + im;
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
            }

            typePrev = type;
        }
    }
}

// ── 工具函数 ──

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

