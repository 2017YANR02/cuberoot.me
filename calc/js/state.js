// NOTE: 集中状态管理 + 观察者模式
// 所有组件通过 onChange 订阅数据变更，实现单向数据流

import {
    DNF_VALUE, UNFINISHED_VALUE,
    getAverage, getSortedIndices, getBestSingle,
    setMoveCntMode
} from './calc_engine.js';

// NOTE: Mo3 项目 — 一轮 3 把，算术均值（不去掉任何成绩）
const MO3_EVENTS = new Set(['666', '777', '444bf', '555bf', '333fm', '333mbf', '333mbo']);
export function solveCount() { return MO3_EVENTS.has(state.event) ? 3 : 5; }
export function isMo3() { return MO3_EVENTS.has(state.event); }

// ── 应用状态 ──

export const state = {
    times: [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]],
    names: ['Name A', 'Name B'],
    compName: 'Competition',
    seedOn: 0,          // 当前显示的 seed 偏移量（0=Seeds 1-2, 2=Seeds 3-4...）
    timeLive: [-1, -1], // 秒表激活的 [player, solve]，-1 表示未激活
    timeLiveStart: -1,  // 秒表开始时间戳
    sortedCache: [],    // 按平均值排序的选手索引
    targetAvgs: {},     // 每个 seed 的目标平均值
    playerEnabled: [true, true], // NOTE: checkbox 控制的选手启用状态
    event: '333',       // NOTE: 当前选中的 WCA 项目 ID
};

// ── 观察者模式 ──

const listeners = [];

export function onChange(fn) {
    listeners.push(fn);
}

export function notify() {
    // NOTE: 每次通知前同步 FMC 步数模式标志
    setMoveCntMode(state.event === '333fm');
    for (var i = 0; i < listeners.length; i++) {
        listeners[i]();
    }
}

// ── 状态变更操作 ──

// NOTE: 更新单个成绩值并重新排序
export function updateTime(playerIdx, solveIdx, value) {
    state.times[playerIdx][solveIdx] = value;
    updateSort();
}

// NOTE: 重新计算排序缓存并通知所有监听者
export function updateSort() {
    var avgs = new Array(state.times.length);
    var singles = new Array(state.times.length);
    for (var p = 0; p < state.times.length; p++) {
        avgs[p] = getAverage(state.times[p], false);
        singles[p] = getBestSingle(state.times[p]);
    }
    state.sortedCache = getSortedIndices(avgs, singles);
    notify();
}

// NOTE: 添加新的 seed 对（2 名选手）
export function addSeedPair() {
    var idx = state.names.length;
    state.names.push('Name ' + String.fromCharCode(65 + idx));
    state.names.push('Name ' + String.fromCharCode(66 + idx));
    var n = solveCount();
    state.times.push(new Array(n).fill(0));
    state.times.push(new Array(n).fill(0));
    updateSort();
}

// NOTE: 判断当前 seed 对的所有时间是否已填满
export function areTimesFullyFilled() {
    var n = solveCount();
    for (var p = 0; p < 2; p++) {
        for (var t = 0; t < n; t++) {
            var val = state.times[state.seedOn + p][t];
            if (val === 0 || val === UNFINISHED_VALUE) return false;
        }
    }
    return true;
}

// NOTE: 找到第一个未填的时间格
export function getFirstUnfilledTime(countLiveTime) {
    var n = solveCount();
    for (var t = 0; t < n; t++) {
        for (var p = 0; p < 2; p++) {
            // NOTE: 跳过被 checkbox 禁用的选手
            if (!state.playerEnabled[p]) continue;
            var isFilled = state.times[state.seedOn + p][t] !== 0;
            var isLive = countLiveTime && state.timeLive[0] === p && state.timeLive[1] === t;
            if (!isFilled || isLive) {
                return [p, t];
            }
        }
    }
    return [-1, -1];
}

// NOTE: 获取选手在排序中的排名
export function getRankOf(p) {
    for (var rank = 0; rank < state.sortedCache.length; rank++) {
        if (state.sortedCache[rank] === p) return rank;
    }
    return -1;
}

// NOTE: 获取有效平均成绩的选手数量
export function getValidsCount() {
    var n = solveCount();
    var count = 0;
    for (var i = 0; i < state.times.length; i++) {
        var allFilled = true;
        for (var t = 0; t < n; t++) {
            if (state.times[i][t] === 0 || state.times[i][t] === UNFINISHED_VALUE) {
                allFilled = false;
                break;
            }
        }
        if (allFilled) count++;
    }
    return count;
}

// NOTE: 重置所有数据
export function resetAll() {
    var n = solveCount();
    state.times = [new Array(n).fill(0), new Array(n).fill(0)];
    state.names = ['Name A', 'Name B'];
    state.compName = 'Competition';
    state.seedOn = 0;
    state.timeLive = [-1, -1];
    state.timeLiveStart = -1;
    updateSort();
}

// NOTE: 项目切换时调整 times 数组长度（截断或补零）
export function resizeTimes(newLen) {
    for (var i = 0; i < state.times.length; i++) {
        var arr = state.times[i];
        if (arr.length < newLen) {
            while (arr.length < newLen) arr.push(0);
        } else if (arr.length > newLen) {
            state.times[i] = arr.slice(0, newLen);
        }
    }
    updateSort();
}

// 初始排序
updateSort();
