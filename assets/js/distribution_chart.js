// NOTE: 分布图模块 — Ao50/Ao100 成绩直方图 + KDE
// 纯前端，零后端改动。DOMContentLoaded 时自动注入 checkbox 列和 canvas 图表

(function () {
    'use strict';

    // ── 颜色板 — 最多 10 名选手同时显示 ──
    var COLORS = [
        '#00d2ff', '#ff6b6b', '#ffd93d', '#6bcb77', '#c084fc',
        '#f97316', '#38bdf8', '#fb7185', '#a3e635', '#e879f9'
    ];

    // ── 配置 ──
    var BIN_WIDTH = 0.2;  // 直方图 bin 宽度（秒）
    var CANVAS_W = 700, CANVAS_H = 360;
    var PAD = { l: 50, r: 140, t: 25, b: 55 }; // NOTE: 右侧留空给图例

    // ── 入口 ──
    document.addEventListener('DOMContentLoaded', function () {
        // NOTE: 查找所有 Ao50/Ao100 表格
        var tables = document.querySelectorAll('table');
        tables.forEach(function (table) {
            var ths = table.querySelectorAll('tr:first-child th');
            if (ths.length < 3) return;
            var header = ths[0].textContent.trim();
            // NOTE: 仅对 Ao50/Ao100 表格启用分布图
            if (header !== 'Ao50' && header !== 'Ao100') return;
            try {
                initDistChart(table, header);
            } catch (e) {
                console.error('[DistChart] Error:', e);
            }
        });
    });

    function initDistChart(table, aoLabel) {
        // ── 解析表格数据 ──
        var players = [];
        var rows = table.querySelectorAll('tr');
        rows.forEach(function (tr, rowIdx) {
            var cells = tr.querySelectorAll('td, th');
            if (cells.length < 3) return;

            // 表头行：插入 checkbox 列头
            if (rowIdx === 0) {
                var th = document.createElement('th');
                th.textContent = '📊';
                th.style.textAlign = 'center';
                th.style.cursor = 'pointer';
                th.title = '全选/取消';
                tr.insertBefore(th, cells[0]);
                return;
            }

            // 数据行：解析成绩
            var aoVal = cells[0].textContent.trim();
            // NOTE: 第二列可能是国旗+名字的混合 HTML
            var nameCell = cells[1];
            var name = nameCell.textContent.trim();
            var timesText = cells[2].textContent.trim();
            var times = timesText.split(/,\s*/).map(parseFloat).filter(function (v) {
                return !isNaN(v) && v > 0;
            });

            if (times.length < 10) return; // 数据不足，跳过

            // 插入 checkbox
            var td = document.createElement('td');
            td.style.textAlign = 'center';
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.style.cursor = 'pointer';
            cb.style.width = '16px';
            cb.style.height = '16px';
            // NOTE: 默认勾选第一个选手
            if (players.length === 0) cb.checked = true;
            td.appendChild(cb);
            tr.insertBefore(td, cells[0]);

            players.push({
                name: name,
                aoVal: aoVal,
                times: times,
                checkbox: cb,
                color: COLORS[players.length % COLORS.length]
            });
        });

        if (players.length === 0) return;

        // ── 创建图表容器 ──
        var container = document.createElement('div');
        container.style.cssText = 'margin: 16px 0 32px; text-align: center;';

        // 切换按钮
        var toggleWrap = document.createElement('div');
        toggleWrap.style.cssText = 'margin-bottom: 8px;';

        var btnHist = createToggleBtn('直方图', true);
        var btnKDE = createToggleBtn('KDE', false);

        btnHist.addEventListener('click', function () {
            btnHist.classList.add('active');
            btnKDE.classList.remove('active');
            draw('histogram');
        });
        btnKDE.addEventListener('click', function () {
            btnKDE.classList.add('active');
            btnHist.classList.remove('active');
            draw('kde');
        });
        toggleWrap.appendChild(btnHist);
        toggleWrap.appendChild(btnKDE);
        container.appendChild(toggleWrap);

        // Canvas
        var canvas = document.createElement('canvas');
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;
        canvas.style.cssText = 'background: #16213e; border-radius: 8px; max-width: 100%;';
        container.appendChild(canvas);

        // 插入到表格后面
        table.parentNode.insertBefore(container, table.nextSibling);

        // ── checkbox 变更事件 ──
        var currentMode = 'histogram';
        players.forEach(function (p) {
            p.checkbox.addEventListener('change', function () { draw(currentMode); });
        });

        // 全选/取消按钮
        var selectAllTh = table.querySelector('tr:first-child th');
        if (selectAllTh) {
            selectAllTh.addEventListener('click', function () {
                var anyChecked = players.some(function (p) { return p.checkbox.checked; });
                players.forEach(function (p) { p.checkbox.checked = !anyChecked; });
                draw(currentMode);
            });
        }

        // 首次绘制
        draw('histogram');

        // ── 绘制函数 ──
        function draw(mode) {
            currentMode = mode;
            var ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

            var selected = players.filter(function (p) { return p.checkbox.checked; });
            if (selected.length === 0) {
                ctx.fillStyle = '#666';
                ctx.font = '16px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('请勾选至少一名选手', CANVAS_W / 2, CANVAS_H / 2);
                return;
            }

            // 计算全局范围
            var allTimes = [];
            selected.forEach(function (p) { allTimes = allTimes.concat(p.times); });
            var gMin = Math.floor(Math.min.apply(null, allTimes) / BIN_WIDTH) * BIN_WIDTH;
            var gMax = Math.ceil(Math.max.apply(null, allTimes) / BIN_WIDTH) * BIN_WIDTH;

            if (mode === 'histogram') {
                drawHistogram(ctx, selected, gMin, gMax);
            } else {
                drawKDE(ctx, selected, gMin, gMax);
            }

            // 图例
            drawLegend(ctx, selected);
        }

        function drawHistogram(ctx, selected, gMin, gMax) {
            var chartW = CANVAS_W - PAD.l - PAD.r;
            var chartH = CANVAS_H - PAD.t - PAD.b;
            var binCount = Math.round((gMax - gMin) / BIN_WIDTH);
            if (binCount <= 0) return;
            var barW = chartW / binCount;

            // 计算每个选手的 bins
            var allBins = selected.map(function (p) {
                var bins = new Array(binCount).fill(0);
                p.times.forEach(function (t) {
                    var idx = Math.min(Math.floor((t - gMin) / BIN_WIDTH), binCount - 1);
                    bins[idx]++;
                });
                return bins;
            });

            // 全局最大值（用于 Y 轴缩放）
            var maxCount = 0;
            allBins.forEach(function (bins) {
                bins.forEach(function (c) { if (c > maxCount) maxCount = c; });
            });
            if (maxCount === 0) return;

            // 网格线
            drawGrid(ctx, chartW, chartH, maxCount);

            // NOTE: 多选手时柱子并排排列
            var nPlayers = selected.length;
            var subBarW = (barW - 2) / nPlayers;

            for (var si = 0; si < selected.length; si++) {
                var bins = allBins[si];
                var color = selected[si].color;
                ctx.fillStyle = hexToRGBA(color, nPlayers > 1 ? 0.7 : 0.9);

                for (var b = 0; b < binCount; b++) {
                    if (bins[b] === 0) continue;
                    var x = PAD.l + b * barW + 1 + si * subBarW;
                    var barH = (bins[b] / maxCount) * chartH;
                    var y = PAD.t + chartH - barH;

                    // NOTE: 直接用 fillRect 避免 arcTo 负半径崩溃
                    ctx.fillRect(x, y, Math.max(1, subBarW), barH);

                    // 柱顶计数（仅单选手或频次 >= 3 时显示）
                    if ((bins[b] >= 3 || nPlayers === 1) && subBarW > 8) {
                        ctx.fillStyle = '#fff';
                        ctx.font = '10px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText(bins[b], x + subBarW / 2, y - 3);
                        ctx.fillStyle = hexToRGBA(color, nPlayers > 1 ? 0.7 : 0.9);
                    }
                }
            }

            // X 轴
            drawXAxis(ctx, chartW, chartH, gMin, gMax, binCount, barW);
            // Y 轴
            drawYAxis(ctx, chartH, maxCount, '次数');
        }

        function drawKDE(ctx, selected, gMin, gMax) {
            var chartW = CANVAS_W - PAD.l - PAD.r;
            var chartH = CANVAS_H - PAD.t - PAD.b;
            var plotMin = gMin - 0.3;
            var plotMax = gMax + 0.3;
            var steps = 300;

            // 计算每个选手的密度曲线
            var curves = selected.map(function (p) {
                var stddev = calcStddev(p.times);
                // NOTE: Silverman 法则自动带宽
                var h = 1.06 * stddev * Math.pow(p.times.length, -0.2);
                var ys = [];
                for (var s = 0; s <= steps; s++) {
                    var x = plotMin + (plotMax - plotMin) * s / steps;
                    var density = 0;
                    for (var i = 0; i < p.times.length; i++) {
                        density += gaussKernel((x - p.times[i]) / h);
                    }
                    density /= (p.times.length * h);
                    ys.push(density);
                }
                return ys;
            });

            // 全局最大密度
            var maxDensity = 0;
            curves.forEach(function (ys) {
                ys.forEach(function (d) { if (d > maxDensity) maxDensity = d; });
            });
            if (maxDensity === 0) return;

            // 网格
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 1;
            for (var g = 0; g <= 5; g++) {
                var gy = PAD.t + chartH - (g / 5) * chartH;
                ctx.beginPath(); ctx.moveTo(PAD.l, gy); ctx.lineTo(PAD.l + chartW, gy); ctx.stroke();
            }

            // 绘制每条曲线
            for (var si = 0; si < selected.length; si++) {
                var ys = curves[si];
                var color = selected[si].color;

                // 填充区域
                ctx.beginPath();
                ctx.moveTo(PAD.l, PAD.t + chartH);
                for (var s = 0; s <= steps; s++) {
                    var px = PAD.l + (s / steps) * chartW;
                    var py = PAD.t + chartH - (ys[s] / maxDensity) * chartH;
                    ctx.lineTo(px, py);
                }
                ctx.lineTo(PAD.l + chartW, PAD.t + chartH);
                ctx.closePath();
                ctx.fillStyle = hexToRGBA(color, 0.15);
                ctx.fill();

                // 曲线描边
                ctx.beginPath();
                for (var s = 0; s <= steps; s++) {
                    var px = PAD.l + (s / steps) * chartW;
                    var py = PAD.t + chartH - (ys[s] / maxDensity) * chartH;
                    if (s === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.strokeStyle = color;
                ctx.lineWidth = 2.5;
                ctx.stroke();
            }

            // X 轴
            ctx.fillStyle = '#aaa'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
            for (var v = Math.ceil(plotMin * 5) / 5; v <= plotMax; v += 0.4) {
                var lx = PAD.l + ((v - plotMin) / (plotMax - plotMin)) * chartW;
                ctx.fillText(v.toFixed(1), lx, PAD.t + chartH + 18);
            }
            ctx.fillStyle = '#888'; ctx.font = '13px sans-serif';
            ctx.fillText('时间 (秒)', PAD.l + chartW / 2, CANVAS_H - 8);

            // Y 轴
            ctx.save(); ctx.translate(14, PAD.t + chartH / 2); ctx.rotate(-Math.PI / 2);
            ctx.fillStyle = '#888'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('密度', 0, 0); ctx.restore();
        }

        // ── 图例 ──
        function drawLegend(ctx, selected) {
            var x = CANVAS_W - PAD.r + 10;
            var y = PAD.t + 10;

            for (var i = 0; i < selected.length; i++) {
                // 色块
                ctx.fillStyle = selected[i].color;
                ctx.fillRect(x, y + i * 22, 12, 12);
                // 名字
                ctx.fillStyle = '#ccc';
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'left';
                var label = selected[i].name;
                // NOTE: 名字太长时截断
                if (label.length > 12) label = label.substring(0, 11) + '…';
                ctx.fillText(label, x + 16, y + i * 22 + 10);
            }
        }

        // ── 辅助函数 ──

        function drawGrid(ctx, chartW, chartH, maxCount) {
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 1;
            var step = maxCount <= 10 ? 2 : (maxCount <= 20 ? 4 : 5);
            for (var g = 0; g <= maxCount; g += step) {
                var gy = PAD.t + chartH - (g / maxCount) * chartH;
                ctx.beginPath(); ctx.moveTo(PAD.l, gy); ctx.lineTo(PAD.l + chartW, gy); ctx.stroke();
            }
        }

        function drawXAxis(ctx, chartW, chartH, gMin, gMax, binCount, barW) {
            ctx.fillStyle = '#aaa'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
            for (var b = 0; b < binCount; b++) {
                var binStart = gMin + b * BIN_WIDTH;
                if (b === 0 || b === binCount - 1 || Math.abs(binStart % 0.4) < 0.01) {
                    ctx.fillText(binStart.toFixed(1), PAD.l + b * barW + barW / 2, PAD.t + chartH + 18);
                }
            }
            ctx.fillStyle = '#888'; ctx.font = '13px sans-serif';
            ctx.fillText('时间 (秒)', PAD.l + chartW / 2, CANVAS_H - 8);
        }

        function drawYAxis(ctx, chartH, maxVal, label) {
            ctx.fillStyle = '#aaa'; ctx.font = '12px sans-serif'; ctx.textAlign = 'right';
            var step = maxVal <= 10 ? 2 : (maxVal <= 20 ? 4 : 5);
            for (var g = 0; g <= maxVal; g += step) {
                ctx.fillText(g, PAD.l - 6, PAD.t + chartH - (g / maxVal) * chartH + 4);
            }
            ctx.save(); ctx.translate(14, PAD.t + chartH / 2); ctx.rotate(-Math.PI / 2);
            ctx.fillStyle = '#888'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(label, 0, 0); ctx.restore();
        }

        // NOTE: roundedRect 已被 fillRect 替代，保留空函数以防调用
        function roundedRect(ctx, x, y, w, h, r) {
            ctx.rect(x, y, w, h);
        }
    }

    // ── 全局工具函数 ──

    function createToggleBtn(text, active) {
        var btn = document.createElement('button');
        btn.textContent = text;
        btn.className = 'segmented-btn' + (active ? ' active' : '');
        btn.style.cssText = 'margin: 0 4px; padding: 4px 14px; font-size: 13px; cursor: pointer;';
        return btn;
    }

    function gaussKernel(x) {
        return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
    }

    function calcStddev(arr) {
        var mean = arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
        var variance = arr.reduce(function (s, v) { return s + (v - mean) * (v - mean); }, 0) / arr.length;
        return Math.sqrt(variance);
    }

    function hexToRGBA(hex, alpha) {
        var r = parseInt(hex.slice(1, 3), 16);
        var g = parseInt(hex.slice(3, 5), 16);
        var b = parseInt(hex.slice(5, 7), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }
})();
