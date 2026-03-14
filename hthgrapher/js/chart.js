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
        viewBox: '0 0 1600 850',
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
            if (state.viewMode !== 0 && state.viewMode !== p + 1) continue;
            if (state.times[state.seedOn + p][t] === 0) continue;

            var barX = BAR_START + t * STRIDE;
            var minY = minYs[p];
            var maxY = valToYCap(0);
            var uncappedMaxY = valToY(0);

            // 较矮柱子居中缩窄（仅 Both 模式下两柱重叠时）
            var isTop = (state.viewMode === 0 && i === 1 && minYs[0] !== 999999 && minYs[1] !== 999999);
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

            // DNF 锯齿（顶部）
            if (state.times[state.seedOn + p][t] === DNF_VALUE) {
                drawZigs(barGroup, bx, minY, bw, -1, 3);
            }

            // 截断锯齿（底部）
            if (uncappedMaxY > maxY) {
                drawZigs(barGroup, bx, maxY - bm * 2, bw, 1, 3);
            }
        }
    }
}

// NOTE: 锯齿底边/顶边
function drawZigs(parent, x, y, w, ysign, pieces) {
    var bpw = w / pieces / 2;
    for (var pe = 0; pe < pieces * 2; pe++) {
        var x1 = x + pe * bpw;
        var x2 = x + (pe + 1) * bpw;
        var x3 = x + (pe + pe % 2) * bpw;
        parent.appendChild(createSvgElement('polygon', {
            points: x1 + ',' + y + ' ' + x2 + ',' + y + ' ' + x3 + ',' + (y + bpw * ysign),
            fill: 'inherit',
        }));
    }
}

// ── 平均菱形标签 ──

function drawAverages() {
    var im = IX[4]; // 菱形内边距
    var m = [3, 13, 18]; // 标签半高
    var offsetY = [0, 7.5, 10]; // 文字垂直偏移
    var jm = 50; // 左尖到文字的水平距离
    var maxSkew = 60;
    var cursor = 9999;
    var typePrev = 0;

    for (var rank = 0; rank < state.times.length; rank++) {
        var p = state.sortedCache[rank];
        var average = getAverage(state.times[p], false);
        var type = (p === state.seedOn || p === state.seedOn + 1) ? 2 : (rank < 3 ? 1 : 0);

        var pIdx = p - state.seedOn;
        var showDiamond = (type < 2) || (state.viewMode === 0 || state.viewMode === pIdx + 1);

        if (average !== UNFINISHED_VALUE && type >= 1 && showDiamond) {
            var y = valToYCap(average);
            var yWings = valToY(average);
            var cy = Math.max(y, 80);
            cursor = Math.min(cursor - (m[typePrev] + 3 + m[type]), cy);
            var ay = Math.min(Math.max(yWings, cursor - maxSkew), cursor + maxSkew);

            var fillColor = '#000';
            if (p === state.seedOn || p === state.seedOn + 1) {
                fillColor = darken(SHADES[p - state.seedOn], 0.7);
            }

            // 标签文字
            var lastName = getLastName(state.names[p]);
            var labelText = lastName + ': ' + formatTime(average);
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

// ── 导出供 Phase 4 使用 ──
export { valToY, valToYCap, coslerp, lerp, fade, darken, createSvgElement, SHADES, BAR_START, STRIDE, BAR_W, CHART_END, CHART_CENTER, IX, gp };
