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
import * as wcaApi from './wca_api.js';

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
        initTargetDefaults();
        updateProgressInfo(0, 0);
        updateProgressInfo(1, 0);
        notify();
        // NOTE: 登录后设置用户头像 URL — 按钮显示真实头像
        if (typeof WcaAuth !== 'undefined' && WcaAuth.isLoggedIn()) {
            var user = WcaAuth.getUser();
            if (user && user.avatar) inputGrid.setMeAvatarUrl(user.avatar);
        }
    });

    // NOTE: 异步重载已登录用户的个人数据 — 切换项目后自动激活 Row A
    // 采用 fire-and-forget 模式：同步回调先用 WR 默认值填充，此函数异步获取个人数据后覆盖
    async function reloadActiveOverrides(eventId) {
        if (typeof WcaAuth === 'undefined' || !WcaAuth.isLoggedIn()) return;
        var user = WcaAuth.getUser();
        if (!user || !user.wcaId) return;

        var p = 0; // NOTE: 仅 Row A 自动激活（登录用户）
        inputGrid.setMeButtonState(p, false, '⏳');

        var data = await wcaApi.fetchUserTimes(user.wcaId, eventId);

        // NOTE: 竞态保护 — 用户在 fetch 期间又切了项目，忽略过期响应
        if (state.event !== eventId) return;

        if (!data) {
            inputGrid.setMeButtonState(p, false);
            // NOTE: 无数据时仍恢复头像（已登录但该项目无成绩）
            if (user.avatar) inputGrid.setMeAvatarUrl(user.avatar);
            return;
        }

        wrData.setPlayerOverride(p, data);
        // NOTE: 用选手官方 average PR 覆盖 WR 默认 Target
        if (data.averagePR && !isMbf()) {
            setTargetAvg(state.seedOn + p, data.averagePR);
        }
        inputGrid.setMeButtonState(p, true, null, user.avatar || '');
        updateProgressInfo(p, playerProgress[p]);
        // NOTE: 个人数据就绪后重新 rand-fill — 用个人 KDE 分布采样
        document.getElementById('rand-fill').click();
    }

    // NOTE: 初始化项目选择器
    eventSelector.init(document.getElementById('event-selector-container'), function (eventId) {
        state.event = eventId;
        setCurrentEvent(eventId);
        // NOTE: 切换项目时清除个人数据覆盖 — 不同项目的 KDE 数据不通用
        for (var pi = 0; pi < 2; pi++) {
            wrData.clearPlayerOverride(pi);
            inputGrid.setMeButtonState(pi, false);
        }
        clearPendingConfetti();
        for (var p = 0; p < state.times.length; p++) {
            for (var t = 0; t < state.times[p].length; t++) state.times[p][t] = 0;
        }
        var n = solveCount();
        resizeTimes(n);
        inputGrid.updateVisibleCells();
        clearTargetAvgs();
        initTargetDefaults();
        document.getElementById('rand-fill').click();
        // NOTE: 立即刷新进度条 info 文字 — 用新项目的 KDE μ 重算
        updateProgressInfo(0, playerProgress[0]);
        updateProgressInfo(1, playerProgress[1]);
        // NOTE: 异步重载个人数据（fire-and-forget）— 完成后覆盖 Target + 重新 rand-fill
        reloadActiveOverrides(eventId);
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
    // NOTE: ⓘ 弹窗控制 — 点击打开，点击 ×/overlay/Escape 关闭
    var infoOverlay = document.getElementById('info-modal-overlay');
    document.getElementById('info-trigger').addEventListener('click', function(e) {
        e.stopPropagation();
        infoOverlay.classList.add('visible');
    });
    document.getElementById('info-modal-close').addEventListener('click', function() {
        infoOverlay.classList.remove('visible');
    });
    infoOverlay.addEventListener('click', function(e) {
        // NOTE: 点击 overlay 背景关闭，点击弹窗内容不关闭
        if (e.target === infoOverlay) infoOverlay.classList.remove('visible');
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') infoOverlay.classList.remove('visible');
    });

    // NOTE: 防止手机端息屏 — 使用 Screen Wake Lock API
    // 低电量等系统节能策略也会被绕过，保持屏幕常亮
    requestWakeLock();
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') requestWakeLock();
    });

    console.log('HTH Grapher v2 initialized');

    // ── 选手搜索 — 使用共享 WcaPersonPicker ──

    var searchResolve = null;
    var picker = WcaPersonPicker.create(
      document.getElementById('person-search-container'),
      {
        mode: 'modal',
        onSelect: function (person) {
          if (searchResolve) {
            searchResolve({
              wcaId: person.wcaId,
              name: person.name,
              avatarUrl: person.avatarUrl || ''
            });
            searchResolve = null;
          }
        }
      }
    );

    /** NOTE: 打开搜索，返回 Promise<{wcaId, name, avatarUrl}> 或 null */
    function openPersonSearch(btnEl) {
      return new Promise(function (resolve) {
        searchResolve = resolve;
        picker.open(btnEl);
        // NOTE: 遮罩点击/Esc 关闭时要 resolve(null)
        var overlay = document.querySelector('.wca-pp-overlay');
        var onClose = function () {
          if (searchResolve) { searchResolve(null); searchResolve = null; }
          overlay.removeEventListener('click', checkOverlay);
          overlay.removeEventListener('keydown', checkEsc);
        };
        var checkOverlay = function (e) { if (e.target === overlay) onClose(); };
        var checkEsc = function (e) { if (e.key === 'Escape') onClose(); };
        overlay.addEventListener('click', checkOverlay);
        overlay.addEventListener('keydown', checkEsc);
      });
    }

    // ── 个人数据切换 ──

    document.addEventListener('player-override', async function(e) {
        var p = e.detail.player;
        var override = wrData.getPlayerOverride(p);

        if (override) {
            // NOTE: 已激活 → 切换回世界数据
            wrData.clearPlayerOverride(p);
            inputGrid.setMeButtonState(p, false);
            // NOTE: 恢复 Target 为 WR Average
            if (!isMbf()) {
                var wr12 = wrData.getAvgWR12(state.event);
                if (wr12) setTargetAvg(state.seedOn + p, wr12[p]);
            }
            updateProgressInfo(p, playerProgress[p]);
            document.getElementById('rand-fill').click();
            return;
        }

        // NOTE: 确定要查询的 WCA ID
        var wcaId = null;
        var avatarUrl = '';

        if (p === 0) {
            // NOTE: Row A — 用登录用户自己的 ID
            if (typeof WcaAuth === 'undefined' || !WcaAuth.isLoggedIn()) return;
            var user = WcaAuth.getUser();
            if (!user || !user.wcaId) return;
            wcaId = user.wcaId;
            avatarUrl = user.avatar || '';
        } else {
            // NOTE: Row B — 打开搜索模态框让用户搜索选手
            var selected = await openPersonSearch(e.detail.btnEl);
            if (!selected) return;
            wcaId = selected.wcaId;
            avatarUrl = selected.avatarUrl || '';
        }

        // NOTE: loading 状态 — 按钮显示 ⏳
        inputGrid.setMeButtonState(p, false, '⏳');

        var data = await wcaApi.fetchUserTimes(wcaId, state.event);
        if (!data) {
            inputGrid.setMeButtonState(p, false);
            alert('No data found for ' + wcaId + ' in this event.');
            return;
        }

        wrData.setPlayerOverride(p, data);
        // NOTE: 自动将 Target 设为该选手的官方 average PR
        if (data.averagePR && !isMbf()) {
            setTargetAvg(state.seedOn + p, data.averagePR);
        }
        // NOTE: 获取选手头像 — Row A 用登录头像，Row B 用搜索结果中的头像
        if (p === 1 && !avatarUrl) {
            avatarUrl = await wcaApi.fetchPersonAvatar(wcaId);
        }
        inputGrid.setMeButtonState(p, true, null, avatarUrl);
        updateProgressInfo(p, playerProgress[p]);
        document.getElementById('rand-fill').click();
    });
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

var SIM_MAX = 1000000; // 单轮最大模拟次数（fallback 用）
// NOTE: 用于蒙特卡洛估计 p = P(Ao5 ≤ target) 的采样量
// 100,000 次 × 5 solves = 500,000 次 KDE 采样，带宽缓存后 ~100ms
var SIM_ESTIMATE_N = 100000;
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

// NOTE: 显示计数徽章 — 可选显示概率 p
function showCount(id, count, winner, prob) {
    var el = document.getElementById(id);
    var text = '×' + count.toLocaleString();
    // NOTE: 概率 p 以百分比显示，根据精度自动选择小数位数
    if (prob !== undefined && prob > 0) {
        var pct = prob * 100;
        var pStr = pct >= 1 ? pct.toFixed(1) : pct.toFixed(2);
        text += ' (p=' + pStr + '%)';
    }
    el.textContent = text;
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

// NOTE: 蒙特卡洛估计 p = P(Ao5 ≤ target)
// 做 SIM_ESTIMATE_N 次独立 Ao5 采样，统计达标率
function estimateP(p, target) {
    var hits = 0;
    for (var i = 0; i < SIM_ESTIMATE_N; i++) {
        var result = simulateOnce(p);
        if (isBeat(result.avg, target)) hits++;
    }
    return hits / SIM_ESTIMATE_N;
}

// NOTE: 几何分布 Geo(p) 的中位数 = ⌈-ln(2)/ln(1-p)⌉
// 当 p→0: median ≈ ln2/p ≈ 0.693/p
// 当 p→1: median = 1
function geoMedian(p) {
    if (p <= 0) return Infinity;
    if (p >= 1) return 1;
    return Math.ceil(-Math.LN2 / Math.log(1 - p));
}

// NOTE: 单选手模拟 — 估计 p 后用公式算理论中位数
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

    // NOTE: 估计达标概率 p̂
    var prob = estimateP(p, target);
    if (prob <= 0) {
        alert('Target too hard — 0 out of ' + SIM_ESTIMATE_N.toLocaleString() + ' simulations beat the target.');
        return;
    }

    // NOTE: 理论中位数
    var median = geoMedian(prob);

    // NOTE: 生成一组达标的 solves 写入 state（用于图表显示）
    var result = null;
    for (var i = 0; i < SIM_MAX; i++) {
        result = simulateOnce(p);
        if (isBeat(result.avg, target)) break;
    }

    if (result) {
        setSuppressConfetti(true);
        var n = solveCount();
        for (var t = 0; t < n; t++) {
            updateTime(state.seedOn + p, t, result.solves[t]);
        }
        setSuppressConfetti(false);
    }

    showCount(p === 0 ? 'sim-count-a' : 'sim-count-b', median, undefined, prob);
}

// NOTE: Race 模式 — 分别估计 pA、pB，用公式算各自中位数
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

    // NOTE: 分别估计两选手的达标概率
    var probA = estimateP(0, targetA);
    var probB = estimateP(1, targetB);

    if (probA <= 0 && probB <= 0) {
        alert('Neither player can beat their target!');
        return;
    }

    var medA = geoMedian(probA);
    var medB = geoMedian(probB);

    // NOTE: 各生成一组达标 solves 写入 state
    setSuppressConfetti(true);
    var n = solveCount();
    for (var player = 0; player < 2; player++) {
        for (var i = 0; i < SIM_MAX; i++) {
            var res = simulateOnce(player);
            if (isBeat(res.avg, player === 0 ? targetA : targetB)) {
                for (var t = 0; t < n; t++) {
                    updateTime(state.seedOn + player, t, res.solves[t]);
                }
                break;
            }
        }
    }
    setSuppressConfetti(false);

    // NOTE: 中位数小 = 先达标 = 胜方
    var winner = medA <= medB ? 0 : 1;
    showCount('sim-count-a', medA, winner === 0, probA);
    showCount('sim-count-b', medB, winner === 1, probB);
    showCount('sim-count-race', Math.max(medA, medB));
}
