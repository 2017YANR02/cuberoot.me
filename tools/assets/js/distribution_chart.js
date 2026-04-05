"use strict";
// NOTE: 分布图模块 — 直方图 + KDE（SVG 版）
// 两层结构：核心绘图 API（DistributionChart.create）+ Stats 页面自动初始化适配层
// SVG 优势：原生 hover tooltip、CSS transition、rx/ry 圆角无崩溃风险
(function () {
    'use strict';
    const NS = 'http://www.w3.org/2000/svg';
    // NOTE: 检测当前语言 — 从 URL ?lang= 参数读取（i18n.js 始终同步该参数）
    function isZh() {
        const params = new URLSearchParams(window.location.search);
        return params.get('lang') === 'zh';
    }
    // ── 颜色板 — 最多 10 名选手同时显示 ──
    const COLORS = [
        '#00d2ff', '#ff6b6b', '#ffd93d', '#6bcb77', '#c084fc',
        '#f97316', '#38bdf8', '#fb7185', '#a3e635', '#e879f9'
    ];
    // ── 默认配置 ──
    const DEFAULTS = {
        // NOTE: 'auto' 表示使用 Freedman-Diaconis 规则自动计算
        binWidth: 'auto',
        width: 700,
        height: 340,
        padding: { l: 50, r: 140, t: 20, b: 50 },
        bgColor: '#16213e',
        // NOTE: 最少数据条数门槛（低于此值不渲染）
        minDataPoints: 5,
        // NOTE: X 轴单位标签
        xLabelEn: 'Time (s)',
        xLabelZh: '时间 (秒)',
    };
    /**
     * NOTE: 自动计算直方图 bin 宽度（Freedman–Diaconis 规则）
     * 公式：binWidth = 2 * IQR * n^(-1/3)
     * 回退：IQR=0 时用 (max-min) / sqrt(n)
     */
    function autoBinWidth(allTimes) {
        if (allTimes.length < 2)
            return 0.2;
        const sorted = allTimes.slice().sort((a, b) => a - b);
        const n = sorted.length;
        const q1 = sorted[Math.floor(n * 0.25)];
        const q3 = sorted[Math.floor(n * 0.75)];
        const iqr = q3 - q1;
        let bw;
        if (iqr > 0) {
            bw = 2 * iqr * Math.pow(n, -1 / 3);
        }
        else {
            // NOTE: IQR=0 回退策略
            bw = (sorted[n - 1] - sorted[0]) > 0
                ? (sorted[n - 1] - sorted[0]) / Math.sqrt(n) : 0.2;
        }
        // NOTE: 限制 bin 数量在 5~50 之间（太少/太多都影响可读性）
        const range = sorted[n - 1] - sorted[0];
        if (range > 0) {
            const bins = Math.round(range / bw);
            if (bins < 5)
                bw = range / 5;
            if (bins > 50)
                bw = range / 50;
        }
        // NOTE: 取整到 "nice number"（0.1, 0.2, 0.5, 1, 2, 5, ...）
        const mag = Math.pow(10, Math.floor(Math.log10(bw)));
        const residual = bw / mag;
        if (residual <= 1.5)
            return mag;
        if (residual <= 3.5)
            return 2 * mag;
        if (residual <= 7.5)
            return 5 * mag;
        return 10 * mag;
    }
    // ═══════════════════════════════════════════
    // 核心绘图 API — DistributionChart.create()
    // ═══════════════════════════════════════════
    /**
     * 创建直方图+KDE 分布图
     */
    function createDistChart(container, datasets, options) {
        const opts = Object.assign({}, DEFAULTS);
        if (options) {
            Object.assign(opts, options);
        }
        // 合并 padding
        if (options && options.padding) {
            opts.padding = Object.assign(Object.assign({}, DEFAULTS.padding), options.padding);
        }
        const W = opts.width, H = opts.height;
        const PAD = opts.padding;
        const chartW = W - PAD.l - PAD.r, chartH = H - PAD.t - PAD.b;
        // NOTE: 延迟计算 binWidth（需要数据才能 auto）
        let BIN_WIDTH = typeof opts.binWidth === 'number' ? opts.binWidth : 0;
        // 分配颜色
        datasets.forEach((ds, i) => {
            if (!ds.color)
                ds.color = COLORS[i % COLORS.length];
        });
        // 过滤无效数据集
        let validSets = datasets.filter(ds => ds.times && ds.times.length >= opts.minDataPoints);
        if (validSets.length === 0)
            return null;
        // ── 创建 DOM ──
        const wrapper = document.createElement('div');
        wrapper.className = 'dist-chart-container';
        wrapper.style.cssText = 'margin: 16px 0 32px; text-align: center; position: relative;';
        // 切换按钮（直方图 / KDE / 箱线图）
        const toggleWrap = document.createElement('div');
        toggleWrap.style.cssText = 'margin-bottom: 8px;';
        const btnHist = createToggleBtn('Histogram', '直方图', true);
        const btnKDE = createToggleBtn('KDE', 'KDE', false);
        const btnBox = createToggleBtn('Box Plot', '箱线图', false);
        toggleWrap.appendChild(btnHist);
        toggleWrap.appendChild(btnKDE);
        toggleWrap.appendChild(btnBox);
        wrapper.appendChild(toggleWrap);
        // SVG
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('width', String(W));
        svg.setAttribute('height', String(H));
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svg.style.cssText = 'background: ' + opts.bgColor + '; border-radius: 8px; max-width: 100%; display: block; margin: 0 auto;';
        wrapper.appendChild(svg);
        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.style.cssText = 'position: absolute; background: rgba(0,0,0,0.85); color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 12px; pointer-events: none; opacity: 0; transition: opacity 0.15s; white-space: nowrap; z-index: 10; border: 1px solid rgba(255,255,255,0.15);';
        wrapper.appendChild(tooltip);
        container.appendChild(wrapper);
        // ── 状态 ──
        let currentMode = 'histogram';
        // NOTE: 当前活跃的数据集（支持外部 select/deselect）
        let activeIndices = [0];
        function setMode(mode) {
            currentMode = mode;
            btnHist.classList.toggle('active', mode === 'histogram');
            btnKDE.classList.toggle('active', mode === 'kde');
            btnBox.classList.toggle('active', mode === 'boxplot');
            draw();
        }
        btnHist.addEventListener('click', () => { setMode('histogram'); });
        btnKDE.addEventListener('click', () => { setMode('kde'); });
        btnBox.addEventListener('click', () => { setMode('boxplot'); });
        // NOTE: 监听语言切换事件，重绘图表更新 SVG 文本
        function onLocaleChange() { draw(); }
        window.addEventListener('i18n:locale-changed', onLocaleChange);
        draw();
        // ── 返回控制器 ──
        return {
            // NOTE: 用新数据重绘（Battle 每次打开历史面板时调用）
            update: function (newDatasets) {
                validSets = (newDatasets || []).filter((ds, i) => {
                    if (!ds.color)
                        ds.color = COLORS[i % COLORS.length];
                    return ds.times && ds.times.length >= opts.minDataPoints;
                });
                if (validSets.length === 0) {
                    svg.innerHTML = '';
                    return;
                }
                activeIndices = [0];
                draw();
            },
            destroy: function () {
                window.removeEventListener('i18n:locale-changed', onLocaleChange);
                if (wrapper.parentNode)
                    wrapper.parentNode.removeChild(wrapper);
            },
            // NOTE: 暴露内部 draw，供 checkbox 变化等外部联动调用
            setActive: function (indices) {
                activeIndices = indices;
                draw();
            },
            draw: draw
        };
        // ══════════════════════════════════════════
        // 绘制
        // ══════════════════════════════════════════
        function draw() {
            svg.innerHTML = '';
            let selected = activeIndices.map(i => validSets[i]).filter(Boolean);
            if (selected.length === 0 && validSets.length > 0) {
                selected = [validSets[0]];
            }
            if (selected.length === 0) {
                svgEl('text', { x: String(W / 2), y: String(H / 2), fill: '#666', 'font-size': '16',
                    'text-anchor': 'middle' }, svg).textContent = isZh() ? '数据不足' : 'Not enough data';
                return;
            }
            // 全局范围
            let allTimes = [];
            selected.forEach(p => { allTimes = allTimes.concat(p.times); });
            // NOTE: 自动 binWidth — 用所有数据点计算
            if (opts.binWidth === 'auto') {
                BIN_WIDTH = autoBinWidth(allTimes);
            }
            const gMin = Math.floor(Math.min(...allTimes) / BIN_WIDTH) * BIN_WIDTH;
            const gMax = Math.ceil(Math.max(...allTimes) / BIN_WIDTH) * BIN_WIDTH;
            if (currentMode === 'histogram') {
                drawHistogram(selected, gMin, gMax);
            }
            else if (currentMode === 'kde') {
                drawKDE(selected, gMin, gMax);
            }
            else {
                drawBoxPlot(selected, gMin, gMax);
            }
            drawLegend(selected);
        }
        // ── 直方图 ──
        function drawHistogram(selected, gMin, gMax) {
            const binCount = Math.round((gMax - gMin) / BIN_WIDTH);
            if (binCount <= 0)
                return;
            const barW = chartW / binCount;
            const nP = selected.length;
            const subBarW = Math.max(1, (barW - 2) / nP);
            // 统计各选手的 bins
            const allBins = selected.map(p => {
                const bins = new Array(binCount).fill(0);
                p.times.forEach(t => {
                    const idx = Math.min(Math.floor((t - gMin) / BIN_WIDTH), binCount - 1);
                    bins[idx]++;
                });
                return bins;
            });
            let maxCount = 0;
            allBins.forEach(bins => {
                bins.forEach(c => { if (c > maxCount)
                    maxCount = c; });
            });
            if (maxCount === 0)
                return;
            // 网格 + Y 轴
            const step = maxCount <= 10 ? 2 : (maxCount <= 20 ? 4 : 5);
            for (let g = 0; g <= maxCount; g += step) {
                const gy = PAD.t + chartH - (g / maxCount) * chartH;
                svgEl('line', { x1: String(PAD.l), y1: String(gy), x2: String(PAD.l + chartW), y2: String(gy),
                    stroke: 'rgba(255,255,255,0.08)', 'stroke-width': '1' }, svg);
                svgEl('text', { x: String(PAD.l - 6), y: String(gy + 4), fill: '#aaa', 'font-size': '12',
                    'text-anchor': 'end' }, svg).textContent = String(g);
            }
            // 柱子
            for (let si = 0; si < nP; si++) {
                const bins = allBins[si];
                for (let b = 0; b < binCount; b++) {
                    if (bins[b] === 0)
                        continue;
                    const x = PAD.l + b * barW + 1 + si * subBarW;
                    const barH = (bins[b] / maxCount) * chartH;
                    const y = PAD.t + chartH - barH;
                    const binStart = (gMin + b * BIN_WIDTH).toFixed(1);
                    const binEnd = (gMin + (b + 1) * BIN_WIDTH).toFixed(1);
                    const rect = svgEl('rect', {
                        x: String(x), y: String(y), width: String(Math.max(1, subBarW - (nP > 1 ? 1 : 0))), height: String(barH),
                        fill: selected[si].color, 'fill-opacity': nP > 1 ? '0.7' : '0.85',
                        rx: nP === 1 ? '3' : '1',
                        style: 'cursor: pointer; transition: opacity 0.2s;',
                        'data-info': selected[si].name + ' | ' + binStart + 's–' + binEnd + 's: ' + bins[b] + (isZh() ? ' 次' : '')
                    }, svg);
                    rect.addEventListener('mouseenter', function (e) {
                        tooltip.textContent = e.target.getAttribute('data-info');
                        tooltip.style.opacity = '1';
                    });
                    rect.addEventListener('mousemove', function (e) {
                        const cr = wrapper.getBoundingClientRect();
                        tooltip.style.left = (e.clientX - cr.left + 12) + 'px';
                        tooltip.style.top = (e.clientY - cr.top - 30) + 'px';
                    });
                    rect.addEventListener('mouseleave', function () { tooltip.style.opacity = '0'; });
                    // 柱顶标签（柱子宽度够 + 频次够才显示）
                    if (subBarW > 8 && (bins[b] >= 3 || nP === 1)) {
                        svgEl('text', { x: String(x + subBarW / 2), y: String(y - 3), fill: '#fff',
                            'font-size': '10', 'text-anchor': 'middle' }, svg).textContent = String(bins[b]);
                    }
                }
            }
            // X 轴标签 — nice ticks（均匀间距，对齐到整数倍）
            const range = gMax - gMin;
            // NOTE: 根据数据范围选择合适的刻度间距，保证 5~12 个刻度
            const tickStep = range > 5 ? 1.0 : 0.5;
            const tickStart = Math.ceil(gMin / tickStep) * tickStep;
            for (let tv = tickStart; tv <= gMax + 0.001; tv += tickStep) {
                const tx = PAD.l + ((tv - gMin) / (gMax - gMin)) * chartW;
                svgEl('text', { x: String(tx), y: String(PAD.t + chartH + 18),
                    fill: '#aaa', 'font-size': '12', 'text-anchor': 'middle' }, svg).textContent = tv.toFixed(1);
            }
            // 轴标题
            axisLabels('Count', '次数');
            // 均值线
            selected.forEach(p => {
                const m = p.times.reduce((a, b) => a + b, 0) / p.times.length;
                const mx = PAD.l + ((m - gMin) / (gMax - gMin)) * chartW;
                svgEl('line', { x1: String(mx), y1: String(PAD.t), x2: String(mx), y2: String(PAD.t + chartH),
                    stroke: p.color, 'stroke-width': '1.5', 'stroke-dasharray': '4,3', opacity: '0.6' }, svg);
            });
        }
        // ── KDE ──
        function drawKDE(selected, gMin, gMax) {
            const plotMin = gMin - 0.3, plotMax = gMax + 0.3;
            const STEPS = 200;
            // 网格
            for (let g = 0; g <= 5; g++) {
                const gy = PAD.t + chartH - (g / 5) * chartH;
                svgEl('line', { x1: String(PAD.l), y1: String(gy), x2: String(PAD.l + chartW), y2: String(gy),
                    stroke: 'rgba(255,255,255,0.08)', 'stroke-width': '1' }, svg);
            }
            // 计算所有选手密度
            const curves = selected.map(p => {
                const m = p.times.reduce((a, b) => a + b, 0) / p.times.length;
                const std = Math.sqrt(p.times.reduce((s, v) => s + (v - m) * (v - m), 0) / p.times.length);
                const h = 1.06 * std * Math.pow(p.times.length, -0.2);
                const ys = [];
                for (let s = 0; s <= STEPS; s++) {
                    const x = plotMin + (plotMax - plotMin) * s / STEPS;
                    let density = 0;
                    for (let i = 0; i < p.times.length; i++) {
                        const u = (x - p.times[i]) / h;
                        density += Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);
                    }
                    ys.push(density / (p.times.length * h));
                }
                return ys;
            });
            let maxD = 0;
            curves.forEach(ys => {
                ys.forEach(d => { if (d > maxD)
                    maxD = d; });
            });
            if (maxD === 0)
                return;
            // 绘制曲线
            selected.forEach((p, si) => {
                const ys = curves[si];
                // 填充
                let pathD = 'M ' + PAD.l + ' ' + (PAD.t + chartH);
                for (let s = 0; s <= STEPS; s++) {
                    const px = PAD.l + (s / STEPS) * chartW;
                    const py = PAD.t + chartH - (ys[s] / maxD) * chartH;
                    pathD += ' L ' + px.toFixed(1) + ' ' + py.toFixed(1);
                }
                pathD += ' L ' + (PAD.l + chartW) + ' ' + (PAD.t + chartH) + ' Z';
                svgEl('path', { d: pathD, fill: p.color, 'fill-opacity': '0.12', stroke: 'none' }, svg);
                // 描边
                let lineD = '';
                for (let s = 0; s <= STEPS; s++) {
                    const px = PAD.l + (s / STEPS) * chartW;
                    const py = PAD.t + chartH - (ys[s] / maxD) * chartH;
                    lineD += (s === 0 ? 'M ' : ' L ') + px.toFixed(1) + ' ' + py.toFixed(1);
                }
                svgEl('path', { d: lineD, fill: 'none', stroke: p.color, 'stroke-width': '2.5' }, svg);
            });
            // X 轴标签 — nice ticks（与 histogram 一致）
            const kdeRange = plotMax - plotMin;
            const kdeTickStep = kdeRange > 5 ? 1.0 : 0.5;
            const kdeTickStart = Math.ceil(plotMin / kdeTickStep) * kdeTickStep;
            for (let tv = kdeTickStart; tv <= plotMax + 0.001; tv += kdeTickStep) {
                const lx = PAD.l + ((tv - plotMin) / (plotMax - plotMin)) * chartW;
                svgEl('text', { x: String(lx), y: String(PAD.t + chartH + 18), fill: '#aaa', 'font-size': '12',
                    'text-anchor': 'middle' }, svg).textContent = tv.toFixed(1);
            }
            axisLabels('Density', '密度');
            // 均值线
            selected.forEach(p => {
                const m = p.times.reduce((a, b) => a + b, 0) / p.times.length;
                const mx = PAD.l + ((m - plotMin) / (plotMax - plotMin)) * chartW;
                svgEl('line', { x1: String(mx), y1: String(PAD.t), x2: String(mx), y2: String(PAD.t + chartH),
                    stroke: p.color, 'stroke-width': '1.5', 'stroke-dasharray': '4,3', opacity: '0.6' }, svg);
            });
        }
        // ── 箱线图 ──
        function drawBoxPlot(selected, gMin, gMax) {
            // NOTE: Box Plot — 五数概括（min, Q1, median, Q3, max）+ 离群点
            const nP = selected.length;
            const boxHeight = Math.max(20, Math.min(60, (chartH - 20) / nP));
            const gap = 10;
            // X 轴范围
            const xScale = (v) => {
                return PAD.l + ((v - gMin) / (gMax - gMin)) * chartW;
            };
            // X 网格线 + 标签
            const xTicks = niceAxisTicks(gMin, gMax, 8);
            xTicks.forEach(val => {
                const x = xScale(val);
                svgEl('line', { x1: String(x), y1: String(PAD.t), x2: String(x), y2: String(PAD.t + chartH),
                    stroke: 'rgba(255,255,255,0.08)', 'stroke-width': '1' }, svg);
                svgEl('text', { x: String(x), y: String(PAD.t + chartH + 16), fill: '#aaa', 'font-size': '11',
                    'text-anchor': 'middle' }, svg).textContent = val.toFixed(1);
            });
            for (let si = 0; si < nP; si++) {
                const times = selected[si].times.slice().sort((a, b) => a - b);
                const n = times.length;
                if (n < 5)
                    continue;
                // NOTE: 五数概括
                const q1 = times[Math.floor(n * 0.25)];
                const median = times[Math.floor(n * 0.5)];
                const q3 = times[Math.floor(n * 0.75)];
                const iqr = q3 - q1;
                const whiskerLow = q1 - 1.5 * iqr;
                const whiskerHigh = q3 + 1.5 * iqr;
                // NOTE: 真实须线边界（数据范围内）
                const wLow = times.find(t => t >= whiskerLow) || times[0];
                let wHigh = times[n - 1];
                for (let j = n - 1; j >= 0; j--) {
                    if (times[j] <= whiskerHigh) {
                        wHigh = times[j];
                        break;
                    }
                }
                const cy = PAD.t + si * (boxHeight + gap) + boxHeight / 2 + 10;
                // 须线（左右横线）
                svgEl('line', { x1: String(xScale(wLow)), y1: String(cy), x2: String(xScale(wHigh)), y2: String(cy),
                    stroke: selected[si].color, 'stroke-width': '1.5' }, svg);
                // 左端竖线
                svgEl('line', { x1: String(xScale(wLow)), y1: String(cy - boxHeight * 0.3), x2: String(xScale(wLow)), y2: String(cy + boxHeight * 0.3),
                    stroke: selected[si].color, 'stroke-width': '1.5' }, svg);
                // 右端竖线
                svgEl('line', { x1: String(xScale(wHigh)), y1: String(cy - boxHeight * 0.3), x2: String(xScale(wHigh)), y2: String(cy + boxHeight * 0.3),
                    stroke: selected[si].color, 'stroke-width': '1.5' }, svg);
                // 箱体（Q1 ~ Q3）
                svgEl('rect', {
                    x: String(xScale(q1)), y: String(cy - boxHeight * 0.35),
                    width: String(Math.max(1, xScale(q3) - xScale(q1))),
                    height: String(boxHeight * 0.7),
                    fill: selected[si].color, 'fill-opacity': '0.25',
                    stroke: selected[si].color, 'stroke-width': '1.5',
                    rx: '3'
                }, svg);
                // 中位线
                svgEl('line', {
                    x1: String(xScale(median)), y1: String(cy - boxHeight * 0.35),
                    x2: String(xScale(median)), y2: String(cy + boxHeight * 0.35),
                    stroke: '#fff', 'stroke-width': '2'
                }, svg);
                // NOTE: 离群点（IQR 1.5 倍外）
                times.forEach(t => {
                    if (t < whiskerLow || t > whiskerHigh) {
                        svgEl('circle', {
                            cx: String(xScale(t)), cy: String(cy), r: '3',
                            fill: 'none', stroke: selected[si].color,
                            'stroke-width': '1.5', opacity: '0.7'
                        }, svg);
                    }
                });
            }
            // X 轴线
            svgEl('line', { x1: String(PAD.l), y1: String(PAD.t + chartH), x2: String(PAD.l + chartW), y2: String(PAD.t + chartH),
                stroke: '#555', 'stroke-width': '1' }, svg);
            const zh = isZh();
            svgEl('text', { x: String(PAD.l + chartW / 2), y: String(H - 6), fill: '#aaa', 'font-size': '13',
                'text-anchor': 'middle' }, svg).textContent = zh ? opts.xLabelZh : opts.xLabelEn;
        }
        /**
         * NOTE: 生成 "nice" 刻度值用于轴标签
         */
        function niceAxisTicks(min, max, targetCount) {
            const range = max - min;
            if (range <= 0)
                return [min];
            const rawStep = range / targetCount;
            const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
            const res = rawStep / mag;
            let step;
            if (res <= 1.5)
                step = mag;
            else if (res <= 3.5)
                step = 2 * mag;
            else if (res <= 7.5)
                step = 5 * mag;
            else
                step = 10 * mag;
            const ticks = [];
            const start = Math.ceil(min / step) * step;
            for (let v = start; v <= max; v += step) {
                ticks.push(Math.round(v * 1000) / 1000); // 避免浮点误差
            }
            return ticks;
        }
        // ── 图例 + 统计信息 ──
        function drawLegend(selected) {
            // NOTE: 每名选手占 3 行（名字、均值、标准差），行高 16px
            const ROW_H = 16;
            for (let i = 0; i < selected.length; i++) {
                const p = selected[i];
                const lx = W - PAD.r + 10;
                const ly = PAD.t + 10 + i * (ROW_H * 3 + 6);
                // 色块 + 名字
                svgEl('rect', { x: String(lx), y: String(ly), width: '12', height: '12', fill: p.color, rx: '2' }, svg);
                // NOTE: 优先使用 nameGetter（动态读取 DOM），否则用静态 name
                let label = (typeof p.nameGetter === 'function') ? p.nameGetter() : p.name;
                if (label.length > 10)
                    label = label.substring(0, 9) + '…';
                svgEl('text', { x: String(lx + 16), y: String(ly + 10), fill: '#ccc', 'font-size': '12',
                    'text-anchor': 'start', 'font-weight': 'bold' }, svg).textContent = label;
                // 均值
                const mean = p.times.reduce((a, b) => a + b, 0) / p.times.length;
                svgEl('text', { x: String(lx + 2), y: String(ly + 10 + ROW_H), fill: '#aaa', 'font-size': '11',
                    'text-anchor': 'start' }, svg).textContent = 'μ = ' + mean.toFixed(2) + 's';
                // 标准差
                const variance = p.times.reduce((s, v) => s + (v - mean) * (v - mean), 0) / p.times.length;
                const std = Math.sqrt(variance);
                svgEl('text', { x: String(lx + 2), y: String(ly + 10 + ROW_H * 2), fill: '#aaa', 'font-size': '11',
                    'text-anchor': 'start' }, svg).textContent = 'σ = ' + std.toFixed(2) + 's';
            }
        }
        // ── 轴标题 ──
        function axisLabels(yLabelEn, yLabelZh) {
            svgEl('text', { x: String(PAD.l + chartW / 2), y: String(H - 5), fill: '#888', 'font-size': '13',
                'text-anchor': 'middle' }, svg).textContent = isZh() ? opts.xLabelZh : opts.xLabelEn;
            const yl = svgEl('text', { x: '0', y: '0', fill: '#888', 'font-size': '13', 'text-anchor': 'middle',
                transform: 'translate(14,' + (PAD.t + chartH / 2) + ') rotate(-90)' }, svg);
            yl.textContent = isZh() ? yLabelZh : yLabelEn;
        }
    }
    // ═══════════════════════════════════════════
    // Stats 页面自动初始化适配层（保持 100% 向后兼容）
    // ═══════════════════════════════════════════
    // NOTE: 用 setTimeout(0) 延后执行，确保 event_selector.js 已隐藏非活跃事件
    document.addEventListener('DOMContentLoaded', function () {
        setTimeout(scanAndInit, 0);
    });
    function scanAndInit() {
        // NOTE: 从 stat-panel ID 识别 metric（如 ao100-ranking）
        const aoPattern = /\b(ao25|ao50|ao100)-ranking\b/;
        document.querySelectorAll('.stat-panel').forEach(function (panel) {
            const m = panel.id && panel.id.match(aoPattern);
            if (!m)
                return;
            if (!isVisible(panel))
                return;
            const table = panel.querySelector('table');
            if (!table)
                return;
            const label = m[1].replace('ao', 'Ao');
            try {
                initStatsDistChart(table, label);
            }
            catch (e) {
                console.error('[DistChart] Error:', e);
            }
        });
    }
    // NOTE: 检查元素及其祖先链是否全部可见
    function isVisible(el) {
        while (el && el !== document.body) {
            if (el.style && el.style.display === 'none')
                return false;
            el = el.parentElement;
        }
        return true;
    }
    // ── Stats 页面：初始化单个表格的分布图（保持原有行为） ──
    function initStatsDistChart(table, aoLabel) {
        const players = [];
        const rows = table.querySelectorAll('tr');
        rows.forEach(function (tr, rowIdx) {
            const cells = tr.querySelectorAll('td, th');
            if (cells.length < 3)
                return;
            // 表头行：插入 checkbox 列头
            if (rowIdx === 0) {
                const th = document.createElement('th');
                th.textContent = '📊';
                th.style.cssText = 'text-align: center; cursor: pointer; width: 34px;';
                th.title = '全选/取消';
                tr.insertBefore(th, cells[0]);
                return;
            }
            // 数据行：从 data-solves 属性读取成绩
            const details = tr.querySelector('details[data-solves]');
            if (!details)
                return;
            const name = cells[1].textContent.trim();
            const times = details.getAttribute('data-solves').split(',').map(parseFloat).filter(v => !isNaN(v) && v > 0);
            if (times.length < 10)
                return;
            // 插入 checkbox
            const td = document.createElement('td');
            td.style.textAlign = 'center';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.style.cssText = 'cursor: pointer; width: 16px; height: 16px;';
            if (players.length === 0)
                cb.checked = true;
            td.appendChild(cb);
            tr.insertBefore(td, cells[0]);
            players.push({
                name: name,
                nameCell: cells[1],
                times: times,
                checkbox: cb,
                color: COLORS[players.length % COLORS.length]
            });
        });
        if (players.length === 0)
            return;
        // 创建图表容器
        const container = document.createElement('div');
        table.parentNode.insertBefore(container, table.nextSibling);
        // 构建数据集（带动态名字 getter）
        const datasets = players.map(p => ({
            name: p.name,
            times: p.times,
            color: p.color,
            // NOTE: 从表格单元格动态读取名字（语言切换后 i18n 会更新 <a> 文本）
            nameGetter: function () {
                return p.nameCell ? p.nameCell.textContent.trim() : p.name;
            }
        }));
        // 创建图表实例
        const chart = createDistChart(container, datasets);
        if (!chart)
            return;
        // ── checkbox 联动 ──
        function getActiveIndices() {
            const indices = [];
            players.forEach(function (p, i) {
                if (p.checkbox.checked)
                    indices.push(i);
            });
            return indices;
        }
        players.forEach(function (p) {
            p.checkbox.addEventListener('change', function () {
                // NOTE: 至少保留一个选中
                const checkedCount = players.filter(q => q.checkbox.checked).length;
                if (checkedCount === 0) {
                    p.checkbox.checked = true;
                    return;
                }
                chart.setActive(getActiveIndices());
            });
        });
        // 全选/取消
        const selectAllTh = table.querySelector('tr:first-child th');
        if (selectAllTh) {
            selectAllTh.addEventListener('click', function () {
                const checkedCount = players.filter(p => p.checkbox.checked).length;
                if (checkedCount === players.length) {
                    // NOTE: 全选状态 → 只保留第一个
                    players.forEach(function (p, i) { p.checkbox.checked = (i === 0); });
                }
                else {
                    // 部分选中 → 全选
                    players.forEach(function (p) { p.checkbox.checked = true; });
                }
                chart.setActive(getActiveIndices());
            });
        }
    }
    // ── 全局工具函数 ──
    function svgEl(tag, attrs, parent) {
        const e = document.createElementNS(NS, tag);
        for (const k in attrs)
            e.setAttribute(k, attrs[k]);
        if (parent)
            parent.appendChild(e);
        return e;
    }
    function createToggleBtn(enText, zhText, active) {
        const btn = document.createElement('button');
        btn.className = 'segmented-btn' + (active ? ' active' : '');
        // NOTE: 紧贴排列，无间距
        btn.style.cssText = 'margin: 0; padding: 4px 14px; font-size: 13px; cursor: pointer;';
        // NOTE: 双语支持，i18n.js 的 apply() 会根据 data-i18n-en/zh 切换
        const span = document.createElement('span');
        span.setAttribute('data-i18n-en', enText);
        span.setAttribute('data-i18n-zh', zhText);
        const lang = document.documentElement.getAttribute('data-lang') || 'en';
        span.textContent = lang === 'zh' ? zhText : enText;
        btn.appendChild(span);
        return btn;
    }
    // ── 暴露公共 API ──
    window.DistributionChart = {
        create: createDistChart
    };
})();
// NOTE: 成绩解析函数——供 initStatsDistChart 内部使用
// 在 IIFE 外声明以满足 TypeScript 作用域（实际运行时在 IIFE 内部）
