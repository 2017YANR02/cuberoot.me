// NOTE: 应用入口 — 导入所有模块，初始化和编排

import { state, onChange, addSeedPair, updateTime, resetAll, notify, getFirstUnfilledTime } from './state.js';
import { formatTime } from './calc_engine.js';
import * as inputGrid from './input_grid.js';
import * as chart from './chart.js';
import * as calcTable from './calc_table.js';
import * as urlSync from './url_sync.js';
import * as eventSelector from './event_selector.js';

// ── 秒表状态 ──

var animFrameId = null; // requestAnimationFrame ID

document.addEventListener('DOMContentLoaded', () => {
    // 初始化各模块
    chart.init(document.getElementById('chart-container'));
    inputGrid.init(document.getElementById('input-grid-container'));
    calcTable.init();

    // NOTE: 初始化项目选择器
    eventSelector.init(document.getElementById('event-selector-container'), function (eventId) {
        state.event = eventId;
        notify();
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
        history.replaceState(null, '', window.location.pathname);
    });

    // ── 随机填充（测试用） ──
    document.getElementById('rand-fill').addEventListener('click', () => {
        // NOTE: 对数正态分布 — 更真实地模拟魔方成绩的右偏特征
        // ln(time) ~ N(μ_ln, σ_ln)，参数由 Ao100 实际数据拟合
        // μ_ln ≈ 1.48（对应中位数 ≈ 4.40s），σ_ln ≈ 0.12
        var MU_LN = 1.48, SIGMA_LN = 0.12;
        for (var p = 0; p < 2; p++) {
            for (var t = 0; t < 5; t++) {
                var u1 = Math.random(), u2 = Math.random();
                var z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
                var timeSec = Math.exp(MU_LN + SIGMA_LN * z);
                var cs = Math.round(timeSec * 100);
                cs = Math.max(200, Math.min(999, cs));
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
