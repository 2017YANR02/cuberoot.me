// NOTE: 应用入口 — 导入所有模块，初始化和编排

import { state, onChange, addSeedPair, updateTime, resetAll, notify, getFirstUnfilledTime } from './state.js';
import { formatTime } from './calc_engine.js';
import * as inputGrid from './input_grid.js';
import * as chart from './chart.js';
import * as calcTable from './calc_table.js';
import * as urlSync from './url_sync.js';

// ── 秒表状态 ──

var animFrameId = null; // requestAnimationFrame ID

document.addEventListener('DOMContentLoaded', () => {
    // 初始化各模块
    chart.init(document.getElementById('chart-container'));
    inputGrid.init(document.getElementById('input-grid-container'));
    calcTable.init();

    // NOTE: 注册秒表回调（空格键触发）
    inputGrid.onStopwatch(toggleStopwatch);

    // 恢复 URL 状态（必须在 init 之后、首次 render 之前）
    urlSync.load();

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

    // 首次渲染
    chart.render();
    inputGrid.refresh();
    calcTable.render();
    updateSeedControls();

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
