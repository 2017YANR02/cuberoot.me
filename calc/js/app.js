// NOTE: 应用入口 — 导入所有模块，初始化和编排

import { state, onChange, updateTime, resetAll, notify, getFirstUnfilledTime, resizeTimes, solveCount, isMbf, isMo3 } from './state.js';
import { formatTime, setMoveCntMode, setMbfMode, getAverage, clampValue, setCurrentEvent } from './calc_engine.js';
import * as inputGrid from './input_grid.js';
import * as chart from './chart.js';
import { clearPendingConfetti, setSuppressConfetti } from './chart.js';
import * as chartDrag from './chart_drag.js';
import * as calcTable from './calc_table.js';
import { getTargetAvg, setTargetAvg, clearTargetAvgs } from './calc_table.js';
import * as urlSync from './url_sync.js';
import * as eventSelector from './event_selector.js';
import * as wrData from './wr_data.js';

// ── 秒表状态 ──

var animFrameId = null; // requestAnimationFrame ID

// NOTE: Screen Wake Lock — 防止手机端息屏（含低电量模式）
var wakeLock = null;
async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', function () { wakeLock = null; });
    } catch (e) {
        // NOTE: 用户拒绝或系统不支持时静默失败
        console.log('Wake Lock request failed:', e.message);
    }
}

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
    // NOTE: 拖动模块初始化 — 必须在 chart.init 之后（SVG 已创建）
    chartDrag.initDrag();
    inputGrid.init(document.getElementById('input-grid-container'));
    calcTable.init();
    wrData.load().then(function () {
        initTargetDefaults(); // NOTE: WR 数据加载后填充空的 Target 格
        // NOTE: WR 数据就绪后初始化进步滑杆的基线值
        updateProgressInfo(0, 0);
        updateProgressInfo(1, 0);
        notify();
    });

    // NOTE: 初始化项目选择器
    eventSelector.init(document.getElementById('event-selector-container'), function (eventId) {
        state.event = eventId;
        setCurrentEvent(eventId);
        // NOTE: 先清零旧数据，再 resize，避免 resizeTimes 触发的 notify
        // 用旧数据 + 新项目 WR 基准误判 confetti（如 2 阶 0.96s 被判为 3 阶 WR）
        clearPendingConfetti(); // NOTE: 清除残留 confetti 动画
        for (var p = 0; p < state.times.length; p++) {
            for (var t = 0; t < state.times[p].length; t++) state.times[p][t] = 0;
        }
        var n = solveCount();
        resizeTimes(n);
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
        chartDrag.onAfterRender(); // NOTE: 全量重绘后恢复拖动选中态
        inputGrid.syncDrum(); // NOTE: 同步 iOS 滚筒显示
        inputGrid.refresh();
        calcTable.render();
        urlSync.save();
    });


    // ── 一键清空（由 numpad ⌫ 长按触发） ──
    document.addEventListener('clearAll', () => {
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
        // NOTE: rand-fill 期间抑制 confetti — KDE 采样的中间状态可能误触发 WR
        setSuppressConfetti(true);
        // NOTE: 先同步界面到 state — 用户可能清空了格子但未触发 blur/保存
        inputGrid.flushToState();
        // NOTE: 清除 activeCell — 移动端点按钮不触发 blur，残留的 activeCell
        // 会导致 refresh() 跳过该格，使 Rand 填充的值不显示
        inputGrid.deactivate();
        var n = solveCount();

        // NOTE: 只检查已启用行是否全满，未启用行不参与判断
        var allFilled = true;
        for (var p0 = 0; p0 < 2; p0++) {
            if (!state.playerEnabled[p0]) continue; // 跳过未打勾的行
            for (var t0 = 0; t0 < n; t0++) {
                if (!state.times[state.seedOn + p0][t0]) { allFilled = false; break; }
            }
            if (!allFilled) break;
        }

        for (var p = 0; p < 2; p++) {
            if (!state.playerEnabled[p]) continue; // NOTE: 只填充打勾行
            for (var t = 0; t < n; t++) {
                // 有空格时跳过已填格子
                if (!allFilled && state.times[state.seedOn + p][t]) continue;

                // NOTE: 复用 sampleOneSolve — 含 KDE 采样 + 进步幅度缩放
                var cs = sampleOneSolve(p);
                updateTime(state.seedOn + p, t, cs);
            }
        }
        // NOTE: rand-fill 结束后恢复 confetti 检测，用最终数据重新检查
        setSuppressConfetti(false);
    });

    // NOTE: 首次渲染前同步 FMC 步数模式和多盲得分模式
    setCurrentEvent(state.event);
    setMoveCntMode(state.event === '333fm');
    setMbfMode(state.event === '333mbf' || state.event === '333mbo');

    // 首次渲染
    chart.render();
    inputGrid.refresh();
    calcTable.render();

    // NOTE: URL 无数据时自动随机填充，避免空白页面
    if (!window.location.search.includes('t0=')) {
        document.getElementById('rand-fill').click();
    }
    // NOTE: 默认激活第一个输入格
    inputGrid.navigateTo(0, 0);
    // ── 模拟按钮 ──
    document.getElementById('sim-a').addEventListener('click', () => simulateForPlayer(0));
    document.getElementById('sim-b').addEventListener('click', () => simulateForPlayer(1));
    document.getElementById('sim-race').addEventListener('click', simulateRace);

    // ── 进步幅度滑杆 ──
    document.getElementById('progress-slider-a').addEventListener('input', function() {
        updateProgressInfo(0, this.value);
    });
    document.getElementById('progress-slider-b').addEventListener('input', function() {
        updateProgressInfo(1, this.value);
    });
    // NOTE: ⓘ tooltip 触屏支持 — tap toggle，点击外部关闭
    // 移动端注入 --tip-top CSS 变量，配合 position:fixed 避免 tooltip 溢出屏幕边界
    document.querySelectorAll('.rand-info').forEach(function(el) {
        el.addEventListener('click', function(e) {
            e.stopPropagation();
            var wasActive = el.classList.contains('active');
            document.querySelectorAll('.rand-info.active').forEach(function(a) { a.classList.remove('active'); });
            if (!wasActive) {
                // NOTE: 计算按钮底部坐标，tooltip 紧贴按钮下方显示
                var rect = el.getBoundingClientRect();
                el.style.setProperty('--tip-top', (rect.bottom + 8) + 'px');
                el.classList.add('active');
            }
        });
    });
    document.addEventListener('click', function() {
        document.querySelectorAll('.rand-info.active').forEach(function(a) { a.classList.remove('active'); });
    });

    // NOTE: 防止手机端息屏 — 使用 Screen Wake Lock API
    // 低电量等系统节能策略也会被绕过，保持屏幕常亮
    requestWakeLock();
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') requestWakeLock();
    });

    console.log('HTH Grapher v2 initialized');
});

// ── Target 默认值 ──

// NOTE: 当 Target 格为空时，用 WR Average #1/#2 填充默认值
// 用户手动设置过的 Target 不会被覆盖
function initTargetDefaults() {
    // NOTE: 多盲得分模式下 WR 数据不兼容，跳过默认 Target
    if (isMbf()) return;
    var wr12 = wrData.getAvgWR12(state.event);
    if (!wr12) return;
    for (var p = 0; p < 2; p++) {
        if (getTargetAvg(state.seedOn + p) === 0) {
            setTargetAvg(state.seedOn + p, wr12[p]);
        }
    }
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
    // NOTE: 多盲得分不是时间，秒表无意义
    if (isMbf()) return;
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

// ── 模拟 Rand ──

var SIM_MAX = 1000000; // 单轮最大模拟次数
var SIM_ROUNDS = 100;  // 多轮取中位数，消除几何分布的高方差波动
// NOTE: 选手进步幅度 — 滑杆值 0~150，代表百分比
var playerProgress = [0, 0];

// NOTE: 获取 μ_kde（KDE 分布期望值）— 优先 wr.json 的 ao100，fallback 到 times 均值
function getMuKde() {
    return wrData.getAo100(state.event) || wrData.getKdeMean(state.event);
}

// NOTE: 计算 Target 锚定缩放因子
// α = 1 − (progress/100) × (1 − T/μ_kde)
// μ_kde = Ao100 trimmed mean（选手日常水平，高于 WR average = best Ao5）
// progress=0 → α=1（不变），progress=100 → α=T/μ_kde（avg≈T）
function getScaleFactor(p) {
    var progress = playerProgress[p] / 100;
    if (progress === 0) return 1;
    var target = getTargetAvg(state.seedOn + p);
    var muArr = getMuKde();
    if (!muArr || !target || target <= 0) return 1;
    var muKde = muArr[p]; // centiseconds
    if (muKde <= 0) return 1;
    return 1 - progress * (1 - target / muKde);
}

// NOTE: 更新滑杆旁的 info 标签（百分比 + 预估 avg）
function updateProgressInfo(p, val) {
    playerProgress[p] = parseInt(val);
    var pct = playerProgress[p];
    var infoEl = document.getElementById(p === 0 ? 'progress-info-a' : 'progress-info-b');
    var muArr = getMuKde();
    if (pct === 0) {
        // NOTE: 0% 时显示当前基线（ao100 均值）
        if (muArr) {
            infoEl.textContent = '0% (' + (muArr[p] / 100).toFixed(2) + 's)';
        } else {
            infoEl.textContent = '0%';
        }
        infoEl.style.color = '';
        return;
    }
    var alpha = getScaleFactor(p);
    if (muArr) {
        var estAvg = muArr[p] * alpha / 100;
        // NOTE: ↓ 箭头表示成绩降低（进步）
        infoEl.textContent = '+' + pct + '% (↓' + estAvg.toFixed(2) + 's)';
        // NOTE: 预估 avg 低于 Target 时变绿（代表能赢）
        var target = getTargetAvg(state.seedOn + p);
        infoEl.style.color = (target && estAvg * 100 < target) ? '#2e7d32' : '';
    } else {
        infoEl.textContent = '+' + pct + '%';
        infoEl.style.color = '';
    }
}

// NOTE: 采样单次成绩 — 复用 rand-fill 的 KDE + log-normal 回退逻辑
// 应用 Target 锚定缩放：x_new = x × α
function sampleOneSolve(p) {
    var cs = wrData.sampleKDE(state.event, p);
    if (cs === null) {
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
        cs = clampValue(Math.round(Math.exp(muLn + 0.12 * z) * 100));
    }
    if (state.event === '333fm') cs = Math.round(cs / 100) * 100;
    if (isMbf()) cs = (Math.floor(Math.random() * 50) + 10) * 100;

    // NOTE: 应用进步幅度缩放（非 mbf 时）
    if (!isMbf() && playerProgress[p] > 0) {
        var alpha = getScaleFactor(p);
        cs = clampValue(Math.round(cs * alpha));
    }
    return cs;
}

// NOTE: 模拟一组成绩（n 个 solve），返回 [solves[], avg]
function simulateOnce(p) {
    var n = solveCount();
    var solves = new Array(n);
    for (var i = 0; i < n; i++) solves[i] = sampleOneSolve(p);
    var avg = getAverage(solves, true);
    return { solves: solves, avg: avg };
}

// NOTE: 判断 avg 是否击败 target
// 普通项目：avg <= target（越小越好）；mbf：avg >= target（越大越好）
function isBeat(avg, target) {
    if (avg <= 0 || avg >= 999999) return false; // DNF / UNFINISHED 不算
    return isMbf() ? (avg >= target) : (avg <= target);
}

// NOTE: 显示计数徽章
function showCount(id, count, winner) {
    var el = document.getElementById(id);
    el.textContent = '×' + count.toLocaleString();
    el.className = 'sim-count visible';
    if (winner !== undefined) {
        el.style.color = winner ? '#006400' : '#999';
    } else {
        el.style.color = '#555';
    }
}

// NOTE: 隐藏计数徽章
function hideCount(id) {
    var el = document.getElementById(id);
    el.textContent = '';
    el.className = 'sim-count';
    el.style.color = '';
}

// NOTE: 单选手模拟 — 100 轮取中位数，消除几何分布的高方差
function simulateForPlayer(p) {
    var target = getTargetAvg(state.seedOn + p);
    if (target <= 0) {
        alert('Please set a Target Avg first.');
        return;
    }

    if (!state.playerEnabled[p]) return;

    hideCount('sim-count-a');
    hideCount('sim-count-b');
    hideCount('sim-count-race');

    // NOTE: 收集每轮的 { count, solves } 用于取中位数
    var rounds = [];
    for (var r = 0; r < SIM_ROUNDS; r++) {
        var count = 0;
        var result = null;
        for (count = 1; count <= SIM_MAX; count++) {
            result = simulateOnce(p);
            if (isBeat(result.avg, target)) break;
        }
        if (count > SIM_MAX) {
            // NOTE: 某一轮超限则跳过（不计入中位数样本）
            continue;
        }
        rounds.push({ count: count, solves: result.solves });
    }

    if (rounds.length === 0) {
        alert('Gave up after ' + SIM_ROUNDS + ' × ' + SIM_MAX.toLocaleString() + ' tries. Target too hard!');
        return;
    }

    // NOTE: 按 count 排序，取中位数那一轮的 solves 写入 state
    rounds.sort(function(a, b) { return a.count - b.count; });
    var median = rounds[Math.floor(rounds.length / 2)];

    setSuppressConfetti(true);
    var n = solveCount();
    for (var t = 0; t < n; t++) {
        updateTime(state.seedOn + p, t, median.solves[t]);
    }
    setSuppressConfetti(false);

    showCount(p === 0 ? 'sim-count-a' : 'sim-count-b', median.count);
}

// NOTE: Race 模式 — 100 轮取中位数，两选手交替模拟
function simulateRace() {
    var targetA = getTargetAvg(state.seedOn + 0);
    var targetB = getTargetAvg(state.seedOn + 1);
    if (targetA <= 0 || targetB <= 0) {
        alert('Both players need a Target Avg.');
        return;
    }
    if (!state.playerEnabled[0] || !state.playerEnabled[1]) {
        alert('Both players must be enabled.');
        return;
    }

    hideCount('sim-count-a');
    hideCount('sim-count-b');
    hideCount('sim-count-race');

    // NOTE: 收集每轮的 { countA, countB, solvesA, solvesB, winner } 用于取中位数
    var rounds = [];
    for (var r = 0; r < SIM_ROUNDS; r++) {
        var cA = 0, cB = 0;
        var rA = null, rB = null;
        var dA = false, dB = false;

        for (var step = 1; step <= SIM_MAX; step++) {
            if (!dA) {
                cA++;
                rA = simulateOnce(0);
                if (isBeat(rA.avg, targetA)) dA = true;
            }
            if (!dB) {
                cB++;
                rB = simulateOnce(1);
                if (isBeat(rB.avg, targetB)) dB = true;
            }
            if (dA || dB) break;
        }

        if (!dA && !dB) continue; // 超限轮次跳过

        // NOTE: 未达标方继续模拟直到达标（与原逻辑一致）
        if (dA && !dB) {
            for (var extra = 1; extra <= SIM_MAX; extra++) {
                cB++;
                rB = simulateOnce(1);
                if (isBeat(rB.avg, targetB)) { dB = true; break; }
            }
        } else if (dB && !dA) {
            for (var extra2 = 1; extra2 <= SIM_MAX; extra2++) {
                cA++;
                rA = simulateOnce(0);
                if (isBeat(rA.avg, targetA)) { dA = true; break; }
            }
        }

        // NOTE: 用 max(cA, cB) 作为排序键 — Race 关注整体结束时间
        rounds.push({
            countA: cA, countB: cB,
            solvesA: rA ? rA.solves : null,
            solvesB: rB ? rB.solves : null,
            maxCount: Math.max(cA, cB)
        });
    }

    if (rounds.length === 0) {
        alert('Neither player beat their target within ' + SIM_ROUNDS + ' × ' + SIM_MAX.toLocaleString() + ' tries!');
        return;
    }

    // NOTE: 按 maxCount 排序取中位数
    rounds.sort(function(a, b) { return a.maxCount - b.maxCount; });
    var med = rounds[Math.floor(rounds.length / 2)];

    setSuppressConfetti(true);
    var n = solveCount();
    for (var t = 0; t < n; t++) {
        if (med.solvesA) updateTime(state.seedOn + 0, t, med.solvesA[t]);
        if (med.solvesB) updateTime(state.seedOn + 1, t, med.solvesB[t]);
    }
    setSuppressConfetti(false);

    // NOTE: 显示各自尝试次数，胜方绿色
    var winner = med.countA <= med.countB ? 0 : 1;
    showCount('sim-count-a', med.countA, winner === 0);
    showCount('sim-count-b', med.countB, winner === 1);
    showCount('sim-count-race', med.maxCount);
}
