// NOTE: 应用入口 — 导入所有模块，初始化和编排

import { state, onChange, addSeedPair, updateTime, resetAll, notify, getFirstUnfilledTime, resizeTimes, solveCount } from './state.js';
import { formatTime } from './calc_engine.js';
import * as inputGrid from './input_grid.js';
import * as chart from './chart.js';
import * as calcTable from './calc_table.js';
import { getTargetAvg, setTargetAvg, clearTargetAvgs } from './calc_table.js';
import * as urlSync from './url_sync.js';
import * as eventSelector from './event_selector.js';
import * as wrData from './wr_data.js';

// ── 秒表状态 ──

var animFrameId = null; // requestAnimationFrame ID

document.addEventListener('DOMContentLoaded', () => {
    // NOTE: 语言检测逻辑 — 与 i18n/i18n.js init() 保持一致
    // 优先级：URL ?lang= > localStorage > navigator.language > 默认 en
    var langParams = new URLSearchParams(window.location.search);
    var urlLang = langParams.get('lang');
    var curLang;
    if (urlLang === 'en' || urlLang === 'zh') {
        curLang = urlLang;
        localStorage.setItem('i18n_locale', urlLang);
    } else {
        var saved = localStorage.getItem('i18n_locale');
        if (saved === 'en' || saved === 'zh') {
            curLang = saved;
        } else if (navigator.language && navigator.language.startsWith('zh')) {
            curLang = 'zh';
        } else {
            curLang = 'en';
        }
        // NOTE: URL 没有 ?lang= 时自动追加（与 i18n.js 同策略）
        var url = new URL(window.location.href);
        url.searchParams.set('lang', curLang);
        history.replaceState(null, '', url.toString());
    }

    // NOTE: 语言切换按钮初始化
    var langLabel = document.querySelector('#lang-toggle .lang-label');
    langLabel.textContent = curLang === 'en' ? '中文' : 'EN';
    document.getElementById('lang-toggle').addEventListener('click', function () {
        var targetLang = curLang === 'en' ? 'zh' : 'en';
        var url = new URL(window.location.href);
        url.searchParams.set('lang', targetLang);
        window.location.href = url.toString();
    });

    // 初始化各模块
    chart.init(document.getElementById('chart-container'));
    inputGrid.init(document.getElementById('input-grid-container'));
    calcTable.init();
    wrData.load().then(function () {
        initTargetDefaults(); // NOTE: WR 数据加载后填充空的 Target 格
        notify();
    });

    // NOTE: 初始化项目选择器
    eventSelector.init(document.getElementById('event-selector-container'), function (eventId) {
        state.event = eventId;
        // NOTE: 项目切换时调整 times 数组长度并清零，重新随机填充
        var n = solveCount();
        resizeTimes(n);
        for (var p = 0; p < state.times.length; p++) {
            for (var t = 0; t < n; t++) state.times[p][t] = 0;
        }
        inputGrid.updateVisibleCells();
        clearTargetAvgs();
        initTargetDefaults();
        document.getElementById('rand-fill').click(); // NOTE: 用新项目的 KDE 分布重新采样
    });

    // NOTE: 注册秒表回调（空格键触发）
    inputGrid.onStopwatch(toggleStopwatch);

    // 恢复 URL 状态（必须在 init 之后、首次 render 之前）
    urlSync.load();

    // NOTE: URL 恢复后同步选择器高亮
    eventSelector.setEvent(state.event);

    // 注册观察者 — 数据变更时更新所有 UI
    onChange(() => {
        chart.render();
        inputGrid.refresh();
        calcTable.render();
        urlSync.save();
        updateSeedControls();
    });

    // ── Seeds 控制 ──
    document.getElementById('seed-prev').addEventListener('click', () => {
        if (state.seedOn >= 2) {
            state.seedOn -= 2;
            notify();
        }
    });
    document.getElementById('seed-next').addEventListener('click', () => {
        state.seedOn += 2;
        if (state.seedOn >= state.names.length) {
            addSeedPair();
        } else {
            notify();
        }
    });

    // ── 一键清空 ──
    document.getElementById('clear-all').addEventListener('click', () => {
        resetAll();
        clearTargetAvgs(); // NOTE: 清空 calc_table 的 targetAvgs
        initTargetDefaults(); // NOTE: 清空后重填 WR 默认值
        history.replaceState(null, '', window.location.pathname);
        // NOTE: 清空后自动激活第一个输入格
        inputGrid.navigateTo(0, 0);
    });

    // ── 随机填充 ──
    // NOTE: 只填充空格子；全满时才全覆盖
    document.getElementById('rand-fill').addEventListener('click', () => {
        // NOTE: 先同步界面到 state — 用户可能清空了格子但未触发 blur/保存
        inputGrid.flushToState();
        var n = solveCount();

        // 判断当前 seed pair 是否全满
        var allFilled = true;
        for (var p0 = 0; p0 < 2; p0++) {
            for (var t0 = 0; t0 < n; t0++) {
                if (!state.times[state.seedOn + p0][t0]) { allFilled = false; break; }
            }
            if (!allFilled) break;
        }

        for (var p = 0; p < 2; p++) {
            for (var t = 0; t < n; t++) {
                // 有空格时跳过已填格子
                if (!allFilled && state.times[state.seedOn + p][t]) continue;

                // NOTE: 优先 KDE 采样（真实成绩 + Silverman 高斯扰动），零模型假设
                var cs = wrData.sampleKDE(state.event, p);

                if (cs === null) {
                    // NOTE: 回退方案 — 对数正态分布（基于 Ao100 WR 或 average WR）
                    var ao100 = wrData.getAo100(state.event);
                    var muLn;
                    if (ao100) {
                        muLn = Math.log(ao100[p] / 100);
                    } else {
                        var avgWr = wrData.getWR(state.event, 'average');
                        muLn = avgWr ? Math.log(avgWr / 100) : 1.48;
                    }
                    var u1 = Math.random(), u2 = Math.random();
                    var z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
                    cs = Math.max(1, Math.round(Math.exp(muLn + 0.12 * z) * 100));
                }

                // NOTE: FMC 单次成绩为整数步数，取整到 100 的倍数（如 2500 = 25 步）
                if (state.event === '333fm') {
                    cs = Math.round(cs / 100) * 100;
                }

                updateTime(state.seedOn + p, t, cs);
            }
        }
    });

    // 首次渲染
    chart.render();
    inputGrid.refresh();
    calcTable.render();
    updateSeedControls();

    // NOTE: URL 无数据时自动随机填充，避免空白页面
    if (!window.location.search.includes('t0=')) {
        document.getElementById('rand-fill').click();
    }
    // NOTE: 默认激活第一个输入格
    inputGrid.navigateTo(0, 0);

    console.log('HTH Grapher v2 initialized');
});

// ── Target 默认值 ──

// NOTE: 当 Target 格为空时，用 WR Average #1/#2 填充默认值
// 用户手动设置过的 Target 不会被覆盖
function initTargetDefaults() {
    var wr12 = wrData.getAvgWR12(state.event);
    if (!wr12) return;
    for (var p = 0; p < 2; p++) {
        if (getTargetAvg(state.seedOn + p) === 0) {
            setTargetAvg(state.seedOn + p, wr12[p]);
        }
    }
}

// ── Seeds 控制 ──

function updateSeedControls() {
    document.getElementById('seed-prev').disabled = (state.seedOn < 2);
    document.getElementById('seed-label').textContent =
        'Seeds ' + (state.seedOn + 1) + '-' + (state.seedOn + 2);
}

// ── 秒表 ──

// NOTE: 空格键切换秒表 — 开始/停止
function toggleStopwatch() {
    if (state.timeLiveStart >= 0) {
        stopStopwatch();
    } else {
        startStopwatch();
    }
}

function startStopwatch() {
    // 找到第一个未填的格子
    var target = getFirstUnfilledTime(true);
    if (target[0] < 0) return; // 所有格都已填满

    state.timeLive = [target[0], target[1]];
    state.timeLiveStart = performance.now();

    // 开始动画循环
    tickStopwatch();
}

function stopStopwatch() {
    var elapsed = performance.now() - state.timeLiveStart;
    var cs = Math.round(elapsed / 10); // 转为 centiseconds
    var p = state.timeLive[0];
    var t = state.timeLive[1];

    // 停止动画
    if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }

    // 重置秒表状态
    state.timeLive = [-1, -1];
    state.timeLiveStart = -1;

    // 保存结果
    updateTime(state.seedOn + p, t, cs);
}

// NOTE: 每帧更新秒表显示和柱状图
function tickStopwatch() {
    if (state.timeLiveStart < 0) return;

    var elapsed = performance.now() - state.timeLiveStart;
    var cs = Math.round(elapsed / 10);
    var p = state.timeLive[0];
    var t = state.timeLive[1];

    // 临时写入 state 以便图表渲染（不触发 notify 避免递归）
    state.times[state.seedOn + p][t] = cs;

    // 更新 input 显示
    inputGrid.setCellDisplay(p, t, formatTime(cs));

    // 重绘图表（仅图表，不触发完整 onChange）
    chart.render();

    animFrameId = requestAnimationFrame(tickStopwatch);
}
