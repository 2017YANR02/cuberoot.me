// NOTE: 分布图模块 — Ao50/Ao100 成绩直方图 + KDE（SVG 版）
// 纯前端，零后端改动。DOMContentLoaded 时自动注入 checkbox 列和 SVG 图表
// SVG 优势：原生 hover tooltip、CSS transition、rx/ry 圆角无崩溃风险

(function () {
    'use strict';

    var NS = 'http://www.w3.org/2000/svg';

    // ── 颜色板 — 最多 10 名选手同时显示 ──
    var COLORS = [
        '#00d2ff', '#ff6b6b', '#ffd93d', '#6bcb77', '#c084fc',
        '#f97316', '#38bdf8', '#fb7185', '#a3e635', '#e879f9'
    ];

    // ── 配置 ──
    var BIN_WIDTH = 0.2;
    var W = 700, H = 340;
    var PAD = { l: 50, r: 140, t: 20, b: 50 };
    var chartW = W - PAD.l - PAD.r, chartH = H - PAD.t - PAD.b;

    // ── 入口 ──
    document.addEventListener('DOMContentLoaded', function () {
        var tables = document.querySelectorAll('table');
        tables.forEach(function (table) {
            var ths = table.querySelectorAll('tr:first-child th');
            if (ths.length < 3) return;
            var header = ths[0].textContent.trim();
            if (header !== 'Ao50' && header !== 'Ao100') return;
            try {
                initDistChart(table, header);
            } catch (e) {
                console.error('[DistChart] Error:', e);
            }
        });
    });

    // ── 初始化单个表格的分布图 ──
    function initDistChart(table, aoLabel) {
        var players = [];
        var rows = table.querySelectorAll('tr');
        rows.forEach(function (tr, rowIdx) {
            var cells = tr.querySelectorAll('td, th');
            if (cells.length < 3) return;

            // 表头行：插入 checkbox 列头
            if (rowIdx === 0) {
                var th = document.createElement('th');
                th.textContent = '📊';
                th.style.cssText = 'text-align: center; cursor: pointer; width: 34px;';
                th.title = '全选/取消';
                tr.insertBefore(th, cells[0]);
                return;
            }

            // 数据行：解析成绩
            var name = cells[1].textContent.trim();
            var timesText = cells[2].textContent.trim();
            var times = timesText.split(/,\s*/).map(parseFloat).filter(function (v) {
                return !isNaN(v) && v > 0;
            });

            if (times.length < 10) return;

            // 插入 checkbox
            var td = document.createElement('td');
            td.style.textAlign = 'center';
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.style.cssText = 'cursor: pointer; width: 16px; height: 16px;';
            if (players.length === 0) cb.checked = true;
            td.appendChild(cb);
            tr.insertBefore(td, cells[0]);

            players.push({
                name: name,
                times: times,
                checkbox: cb,
                color: COLORS[players.length % COLORS.length]
            });
        });

        if (players.length === 0) return;

        // ── 创建图表容器 ──
        var container = document.createElement('div');
        container.style.cssText = 'margin: 16px 0 32px; text-align: center; position: relative;';

        // 切换按钮
        var toggleWrap = document.createElement('div');
        toggleWrap.style.cssText = 'margin-bottom: 8px;';
        var btnHist = createToggleBtn('直方图', true);
        var btnKDE = createToggleBtn('KDE', false);
        toggleWrap.appendChild(btnHist);
        toggleWrap.appendChild(btnKDE);
        container.appendChild(toggleWrap);

        // SVG
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('width', W);
        svg.setAttribute('height', H);
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svg.style.cssText = 'background: #16213e; border-radius: 8px; max-width: 100%; display: block; margin: 0 auto;';
        container.appendChild(svg);

        // Tooltip
        var tooltip = document.createElement('div');
        tooltip.style.cssText = 'position: absolute; background: rgba(0,0,0,0.85); color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 12px; pointer-events: none; opacity: 0; transition: opacity 0.15s; white-space: nowrap; z-index: 10; border: 1px solid rgba(255,255,255,0.15);';
        container.appendChild(tooltip);

        table.parentNode.insertBefore(container, table.nextSibling);

        // ── 状态 ──
        var currentMode = 'histogram';

        btnHist.addEventListener('click', function () {
            btnHist.classList.add('active');
            btnKDE.classList.remove('active');
            currentMode = 'histogram';
            draw();
        });
        btnKDE.addEventListener('click', function () {
            btnKDE.classList.add('active');
            btnHist.classList.remove('active');
            currentMode = 'kde';
            draw();
        });

        players.forEach(function (p) {
            p.checkbox.addEventListener('change', function () { draw(); });
        });

        // 全选/取消
        var selectAllTh = table.querySelector('tr:first-child th');
        if (selectAllTh) {
            selectAllTh.addEventListener('click', function () {
                var anyChecked = players.some(function (p) { return p.checkbox.checked; });
                players.forEach(function (p) { p.checkbox.checked = !anyChecked; });
                draw();
            });
        }

        draw();

        // ══════════════════════════════════════════
        // 绘制
        // ══════════════════════════════════════════
        function draw() {
            svg.innerHTML = '';
            var selected = players.filter(function (p) { return p.checkbox.checked; });

            if (selected.length === 0) {
                svgEl('text', { x: W / 2, y: H / 2, fill: '#666', 'font-size': '16',
                    'text-anchor': 'middle' }, svg).textContent = '请勾选至少一名选手';
                return;
            }

            // 全局范围
            var allTimes = [];
            selected.forEach(function (p) { allTimes = allTimes.concat(p.times); });
            var gMin = Math.floor(Math.min.apply(null, allTimes) / BIN_WIDTH) * BIN_WIDTH;
            var gMax = Math.ceil(Math.max.apply(null, allTimes) / BIN_WIDTH) * BIN_WIDTH;



            if (currentMode === 'histogram') {
                drawHistogram(selected, gMin, gMax);
            } else {
                drawKDE(selected, gMin, gMax);
            }

            drawLegend(selected);
        }

        // ── 直方图 ──
        function drawHistogram(selected, gMin, gMax) {
            var binCount = Math.round((gMax - gMin) / BIN_WIDTH);
            if (binCount <= 0) return;
            var barW = chartW / binCount;
            var nP = selected.length;
            var subBarW = Math.max(1, (barW - 2) / nP);

            // 统计各选手的 bins
            var allBins = selected.map(function (p) {
                var bins = new Array(binCount).fill(0);
                p.times.forEach(function (t) {
                    var idx = Math.min(Math.floor((t - gMin) / BIN_WIDTH), binCount - 1);
                    bins[idx]++;
                });
                return bins;
            });
            var maxCount = 0;
            allBins.forEach(function (bins) {
                bins.forEach(function (c) { if (c > maxCount) maxCount = c; });
            });
            if (maxCount === 0) return;

            // 网格 + Y 轴
            var step = maxCount <= 10 ? 2 : (maxCount <= 20 ? 4 : 5);
            for (var g = 0; g <= maxCount; g += step) {
                var gy = PAD.t + chartH - (g / maxCount) * chartH;
                svgEl('line', { x1: PAD.l, y1: gy, x2: PAD.l + chartW, y2: gy,
                    stroke: 'rgba(255,255,255,0.08)', 'stroke-width': '1' }, svg);
                svgEl('text', { x: PAD.l - 6, y: gy + 4, fill: '#aaa', 'font-size': '12',
                    'text-anchor': 'end' }, svg).textContent = g;
            }

            // 柱子
            for (var si = 0; si < nP; si++) {
                var bins = allBins[si];
                for (var b = 0; b < binCount; b++) {
                    if (bins[b] === 0) continue;
                    var x = PAD.l + b * barW + 1 + si * subBarW;
                    var barH = (bins[b] / maxCount) * chartH;
                    var y = PAD.t + chartH - barH;
                    var binStart = (gMin + b * BIN_WIDTH).toFixed(1);
                    var binEnd = (gMin + (b + 1) * BIN_WIDTH).toFixed(1);

                    var rect = svgEl('rect', {
                        x: x, y: y, width: Math.max(1, subBarW - (nP > 1 ? 1 : 0)), height: barH,
                        fill: selected[si].color, 'fill-opacity': nP > 1 ? '0.7' : '0.85',
                        rx: nP === 1 ? '3' : '1',
                        style: 'cursor: pointer; transition: opacity 0.2s;',
                        'data-info': selected[si].name + ' | ' + binStart + 's–' + binEnd + 's: ' + bins[b] + ' 次'
                    }, svg);

                    rect.addEventListener('mouseenter', function (e) {
                        tooltip.textContent = e.target.getAttribute('data-info');
                        tooltip.style.opacity = '1';
                    });
                    rect.addEventListener('mousemove', function (e) {
                        var cr = container.getBoundingClientRect();
                        tooltip.style.left = (e.clientX - cr.left + 12) + 'px';
                        tooltip.style.top = (e.clientY - cr.top - 30) + 'px';
                    });
                    rect.addEventListener('mouseleave', function () { tooltip.style.opacity = '0'; });

                    // 柱顶标签（柱子宽度够 + 频次够才显示）
                    if (subBarW > 8 && (bins[b] >= 3 || nP === 1)) {
                        svgEl('text', { x: x + subBarW / 2, y: y - 3, fill: '#fff',
                            'font-size': '10', 'text-anchor': 'middle' }, svg).textContent = bins[b];
                    }
                }
            }

            // X 轴标签
            for (var b = 0; b < binCount; b++) {
                var bs = gMin + b * BIN_WIDTH;
                if (b === 0 || b === binCount - 1 || Math.abs(bs % 0.4) < 0.01) {
                    svgEl('text', { x: PAD.l + b * barW + barW / 2, y: PAD.t + chartH + 18,
                        fill: '#aaa', 'font-size': '12', 'text-anchor': 'middle' }, svg).textContent = bs.toFixed(1);
                }
            }

            // 轴标题
            axisLabels('次数');

            // 均值线
            selected.forEach(function (p, i) {
                var m = p.times.reduce(function (a, b) { return a + b; }, 0) / p.times.length;
                var mx = PAD.l + ((m - gMin) / (gMax - gMin)) * chartW;
                svgEl('line', { x1: mx, y1: PAD.t, x2: mx, y2: PAD.t + chartH,
                    stroke: p.color, 'stroke-width': '1.5', 'stroke-dasharray': '4,3', opacity: '0.6' }, svg);
            });
        }

        // ── KDE ──
        function drawKDE(selected, gMin, gMax) {
            var plotMin = gMin - 0.3, plotMax = gMax + 0.3;
            var STEPS = 200;

            // 网格
            for (var g = 0; g <= 5; g++) {
                var gy = PAD.t + chartH - (g / 5) * chartH;
                svgEl('line', { x1: PAD.l, y1: gy, x2: PAD.l + chartW, y2: gy,
                    stroke: 'rgba(255,255,255,0.08)', 'stroke-width': '1' }, svg);
            }

            // 计算所有选手密度
            var curves = selected.map(function (p) {
                var m = p.times.reduce(function (a, b) { return a + b; }, 0) / p.times.length;
                var std = Math.sqrt(p.times.reduce(function (s, v) { return s + (v - m) * (v - m); }, 0) / p.times.length);
                var h = 1.06 * std * Math.pow(p.times.length, -0.2);
                var ys = [];
                for (var s = 0; s <= STEPS; s++) {
                    var x = plotMin + (plotMax - plotMin) * s / STEPS;
                    var density = 0;
                    for (var i = 0; i < p.times.length; i++) {
                        var u = (x - p.times[i]) / h;
                        density += Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);
                    }
                    ys.push(density / (p.times.length * h));
                }
                return ys;
            });
            var maxD = 0;
            curves.forEach(function (ys) {
                ys.forEach(function (d) { if (d > maxD) maxD = d; });
            });
            if (maxD === 0) return;

            // 绘制曲线
            selected.forEach(function (p, si) {
                var ys = curves[si];
                // 填充
                var pathD = 'M ' + PAD.l + ' ' + (PAD.t + chartH);
                for (var s = 0; s <= STEPS; s++) {
                    var px = PAD.l + (s / STEPS) * chartW;
                    var py = PAD.t + chartH - (ys[s] / maxD) * chartH;
                    pathD += ' L ' + px.toFixed(1) + ' ' + py.toFixed(1);
                }
                pathD += ' L ' + (PAD.l + chartW) + ' ' + (PAD.t + chartH) + ' Z';
                svgEl('path', { d: pathD, fill: p.color, 'fill-opacity': '0.12', stroke: 'none' }, svg);

                // 描边
                var lineD = '';
                for (var s = 0; s <= STEPS; s++) {
                    var px = PAD.l + (s / STEPS) * chartW;
                    var py = PAD.t + chartH - (ys[s] / maxD) * chartH;
                    lineD += (s === 0 ? 'M ' : ' L ') + px.toFixed(1) + ' ' + py.toFixed(1);
                }
                svgEl('path', { d: lineD, fill: 'none', stroke: p.color, 'stroke-width': '2.5' }, svg);
            });

            // X 轴标签
            for (var v = Math.ceil(plotMin * 5) / 5; v <= plotMax; v += 0.4) {
                var lx = PAD.l + ((v - plotMin) / (plotMax - plotMin)) * chartW;
                svgEl('text', { x: lx, y: PAD.t + chartH + 18, fill: '#aaa', 'font-size': '12',
                    'text-anchor': 'middle' }, svg).textContent = v.toFixed(1);
            }

            axisLabels('密度');

            // 均值线
            selected.forEach(function (p) {
                var m = p.times.reduce(function (a, b) { return a + b; }, 0) / p.times.length;
                var mx = PAD.l + ((m - plotMin) / (plotMax - plotMin)) * chartW;
                svgEl('line', { x1: mx, y1: PAD.t, x2: mx, y2: PAD.t + chartH,
                    stroke: p.color, 'stroke-width': '1.5', 'stroke-dasharray': '4,3', opacity: '0.6' }, svg);
            });
        }

        // ── 图例 ──
        function drawLegend(selected) {
            for (var i = 0; i < selected.length; i++) {
                var lx = W - PAD.r + 10, ly = PAD.t + 10 + i * 22;
                svgEl('rect', { x: lx, y: ly, width: 12, height: 12, fill: selected[i].color, rx: '2' }, svg);
                var label = selected[i].name;
                if (label.length > 12) label = label.substring(0, 11) + '…';
                svgEl('text', { x: lx + 16, y: ly + 10, fill: '#ccc', 'font-size': '12',
                    'text-anchor': 'start' }, svg).textContent = label;
            }
        }

        // ── 轴标题 ──
        function axisLabels(yLabel) {
            svgEl('text', { x: PAD.l + chartW / 2, y: H - 5, fill: '#888', 'font-size': '13',
                'text-anchor': 'middle' }, svg).textContent = '时间 (秒)';
            var yl = svgEl('text', { x: 0, y: 0, fill: '#888', 'font-size': '13', 'text-anchor': 'middle',
                transform: 'translate(14,' + (PAD.t + chartH / 2) + ') rotate(-90)' }, svg);
            yl.textContent = yLabel;
        }
    }

    // ── 全局工具函数 ──

    function svgEl(tag, attrs, parent) {
        var e = document.createElementNS(NS, tag);
        for (var k in attrs) e.setAttribute(k, attrs[k]);
        if (parent) parent.appendChild(e);
        return e;
    }

    function createToggleBtn(text, active) {
        var btn = document.createElement('button');
        btn.textContent = text;
        btn.className = 'segmented-btn' + (active ? ' active' : '');
        btn.style.cssText = 'margin: 0 4px; padding: 4px 14px; font-size: 13px; cursor: pointer;';
        return btn;
    }
})();
