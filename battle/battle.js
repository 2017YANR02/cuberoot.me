/**
 * 1v1 Battle Timer — 魔方对战计时器核心逻辑
 *
 * 移植自 MatteoColombo/cube_challenge_timer (Flutter/Dart → JS)
 * 状态机：idle → ready(黄) → canStart(绿) → timing → finished
 */

// NOTE: 打乱生成由本地 csTimer scramble module 提供（scramble_module.js, GPL-3.0 from cs0x7f）
// scrMgr 全局对象由 scramble_module.js 暴露，包含 scramblers[type](type, len, state) API

// NOTE: cubing.js event ID → [csTimer scrambler type, 默认步数] 映射
// 步数来源：csTimer 的 scrdata 定义（WCA 标准值）
const EVENT_TO_CSTIMER = {
    '222':      ['222so',  0],   // 2x2 random-state（步数由求解器决定）
    '333':      ['333',    0],   // 3x3 random-state (Kociemba)
    '444':      ['444wca', 40],  // 4x4 WCA random-state, 40 步
    '555':      ['555wca', 60],  // 5x5 WCA, 60 步
    '666':      ['666wca', 80],  // 6x6 WCA, 80 步
    '777':      ['777wca', 100], // 7x7 WCA, 100 步
    '333oh':    ['333',    0],   // OH 用 3x3 打乱
    '333bf':    ['333',    0],   // 3BLD 用 3x3 打乱
    '444bf':    ['444wca', 40],  // 4BLD 用 4x4 打乱
    '555bf':    ['555wca', 60],  // 5BLD 用 5x5 打乱
    '333mbf':   ['333',    0],   // MBLD 用 3x3 打乱
    'clock':    ['clkwca', 0],   // Clock WCA
    'minx':     ['mgmp',   70],  // Megaminx WCA (Pochmann), 70 步
    'pyram':    ['pyrso',  0],   // Pyraminx random-state
    'skewb':    ['skbso',  0],   // Skewb random-state
    'sq1':      ['sqrs',   0],   // Square-1 random-state
    'fto':      ['ftoso',  0],   // FTO random-state
    'kilominx': ['klmso',  0],   // Kilominx random-state
};

// ===== 常量 =====

// NOTE: 所有 WCA 官方项目 + 显示名
const PUZZLES = [
    // WCA 速拧
    { id: "222",   name: { en: "2×2",       zh: "二阶" } },
    { id: "333",   name: { en: "3×3",       zh: "三阶" } },
    { id: "444",   name: { en: "4×4",       zh: "四阶" } },
    { id: "555",   name: { en: "5×5",       zh: "五阶" } },
    { id: "666",   name: { en: "6×6",       zh: "六阶" } },
    { id: "777",   name: { en: "7×7",       zh: "七阶" } },
    { id: "333oh", name: { en: "OH",        zh: "单手" } },
    // WCA 盲拧
    { id: "333bf", name: { en: "3BLD",      zh: "三盲" } },
    { id: "444bf", name: { en: "4BLD",      zh: "四盲" } },
    { id: "555bf", name: { en: "5BLD",      zh: "五盲" } },
    { id: "333mbf",name: { en: "MBLD",      zh: "多盲" } },
    // WCA 异形
    { id: "clock", name: { en: "Clock",     zh: "魔表" } },
    { id: "minx",  name: { en: "Megaminx",  zh: "五魔方" } },
    { id: "pyram", name: { en: "Pyraminx",  zh: "金字塔" } },
    { id: "skewb", name: { en: "Skewb",     zh: "斜转" } },
    { id: "sq1",   name: { en: "SQ1",       zh: "SQ1" } },
    // 非 WCA（cubing.js 支持）
    { id: "fto",              name: { en: "FTO",       zh: "FTO" } },
    { id: "kilominx",         name: { en: "Kilominx",  zh: "二阶五魔" } },
];

const PENALTY = { OK: "ok", PLUS2: "+2", DNF: "dnf" };

// NOTE: 防止误触停止的最短计时时间（ms），与 Flutter 版一致
const MIN_SOLVE_TIME = 100;

// localStorage 键名前缀，避免和其他页面冲突
const LS_PREFIX = "battle_";

// NOTE: 桌面端键盘映射 — Player 1(下方)=空格, Player 2(上方)=Enter
const KEY_MAP = {
    " ": 0,       // Space → Player 1 (bottom)
    "Enter": 1,   // Enter → Player 2 (top)
};

/**
 * NOTE: 从 URL ?lang= 参数获取当前语言（lessons.md 教训：不要假设 data-lang 属性存在）
 */
function getLocale() {
    return new URLSearchParams(window.location.search).get('lang') || 'en';
}

// NOTE: 双语文本映射（JS 动态设置的文本，无法用 data-i18n 属性）
const I18N_TEXT = {
    hide_time:  { en: "🙈 Hide time when solving", zh: "🙈 计时时隐藏时间" },
    show_time:  { en: "👁️ Show time when solving", zh: "👁️ 计时时显示时间" },
    generating: { en: "Generating scramble...",    zh: "正在生成打乱..." },
};

// ===== 状态 =====

const state = {
    // 当前项目 ID
    puzzleId: localStorage.getItem(LS_PREFIX + "puzzle") || "333",
    // 是否显示计时中的时间
    showTime: localStorage.getItem(LS_PREFIX + "showTime") !== "false",
    // 是否显示打乱图
    showImage: localStorage.getItem(LS_PREFIX + "showImage") !== "false", // 默认显示图形
    // 当前打乱图字号缩放比例
    scrambleScale: parseFloat(localStorage.getItem(LS_PREFIX + "scrambleScale")) || 1.0,
    // 当前打乱
    scramble: null,
    // 是否正在加载打乱
    scrambleLoading: false,
    // 赢家标识：-2=未决 -1=平局 0=下方 1=上方
    winner: -2,
    // NOTE: 红灯→绿灯的延时计时器 ID
    readyTimer: null,
    // 两个玩家状态
    players: [createPlayer(0), createPlayer(1)],
};

function createPlayer(id) {
    return {
        id,
        isReady: false,
        canStart: false,
        isTiming: false,
        hasFinished: false,
        penalty: PENALTY.OK,
        // NOTE: 以 ms 为单位的解题时间
        time: 0,
        // performance.now() 时间戳（单调时钟，更精确）
        startTime: 0,
        // 累积比分（刷新即清零）
        points: 0,
        // 此玩家绑定的 pointerId（多点触控隔离）
        pointerId: null,
        // requestAnimationFrame ID
        rafId: null,
        // NOTE: 成绩历史（ms 值，DNF 存 Infinity）— 用于 Ao5 统计
        solveHistory: [],
    };
}

// ===== DOM 引用 =====

const dom = {
    areas: [null, null],       // 两个玩家触摸区域
    times: [null, null],       // 计时显示
    ao5s: [null, null],        // Ao5 统计显示
    opponents: [null, null],   // 对手成绩显示
    scrambles: [null, null],   // 打乱文字
    scrambleImgs: [null, null],// 打乱图（csTimer SVG）
    penalties: [null, null],   // 罚时按钮组
    scores: [null, null],      // 比分数字
    settingsOverlay: null,
    puzzleGrid: null,
    toggleImage: null,
    sizeSlider: null,
    // NOTE: 背景自定义控件（每个玩家各一组）
    bgColors: [null, null],    // color input
    bgImages: [null, null],    // file input
    bgResets: [null, null],    // reset button
    bgError: null,             // 错误提示
};

// ===== 初始化 =====

document.addEventListener("DOMContentLoaded", init);

function init() {
    // 获取 DOM 元素
    dom.areas[0] = document.getElementById("player-bottom");
    dom.areas[1] = document.getElementById("player-top");
    dom.times[0] = document.getElementById("time-0");
    dom.times[1] = document.getElementById("time-1");
    dom.ao5s[0] = document.getElementById("ao5-0");
    dom.ao5s[1] = document.getElementById("ao5-1");
    dom.opponents[0] = document.getElementById("opponent-0");
    dom.opponents[1] = document.getElementById("opponent-1");
    dom.scrambles[0] = document.getElementById("scramble-0");
    dom.scrambles[1] = document.getElementById("scramble-1");
    dom.scrambleImgs[0] = document.getElementById("scramble-img-0");
    dom.scrambleImgs[1] = document.getElementById("scramble-img-1");
    dom.penalties[0] = document.getElementById("penalties-0");
    dom.penalties[1] = document.getElementById("penalties-1");
    dom.scores[0] = document.getElementById("score-0");
    dom.scores[1] = document.getElementById("score-1");
    dom.settingsOverlay = document.getElementById("settings-overlay");
    dom.puzzleGrid = document.getElementById("puzzle-grid");
    dom.toggleImage = document.getElementById("toggle-image");
    dom.sizeSlider = document.getElementById("scramble-size-slider");
    // NOTE: 背景自定义控件引用
    for (let i = 0; i < 2; i++) {
        dom.bgColors[i] = document.getElementById(`bg-color-${i}`);
        dom.bgImages[i] = document.getElementById(`bg-image-${i}`);
        dom.bgResets[i] = document.getElementById(`bg-reset-${i}`);
    }
    dom.bgError = document.getElementById('bg-error');

    // 绑定触摸事件
    for (let i = 0; i < 2; i++) {
        // NOTE: 使用 pointer 事件支持多点触控隔离
        dom.areas[i].addEventListener("pointerdown", (e) => handlePointerDown(i, e));
        dom.areas[i].addEventListener("pointerup", (e) => handlePointerUp(i, e));
        dom.areas[i].addEventListener("pointercancel", (e) => handlePointerCancel(i, e));

        // 绑定罚时按钮（阻止事件冒泡到 player area）
        const penBtns = dom.penalties[i].querySelectorAll(".penalty-btn");
        penBtns.forEach(btn => {
            btn.addEventListener("pointerdown", (e) => e.stopPropagation());
            btn.addEventListener("pointerup", (e) => e.stopPropagation());
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                handlePenalty(i, btn.dataset.penalty);
            });
        });
    }

    // NOTE: 桌面端键盘控制 — 空格键(Player 1) / Enter键(Player 2)
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    // 设置菜单
    buildPuzzleGrid();
    document.getElementById("btn-settings").addEventListener("click", openSettings);
    document.getElementById("btn-fullscreen").addEventListener("click", toggleFullscreen);
    document.getElementById("settings-close").addEventListener("click", closeSettings);
    document.getElementById("btn-delete-last").addEventListener("click", deleteLast);
    document.getElementById("btn-toggle-time").addEventListener("click", toggleShowTime);
    document.getElementById("btn-reset").addEventListener("click", resetAll);

    // 点击 overlay 背景关闭
    dom.settingsOverlay.addEventListener("click", (e) => {
        if (e.target === dom.settingsOverlay) closeSettings();
    });

    // 初始化 Show Image 开关状态和事件
    dom.toggleImage.checked = state.showImage;
    dom.toggleImage.addEventListener("change", (e) => {
        state.showImage = e.target.checked;
        localStorage.setItem(LS_PREFIX + "showImage", state.showImage);
        renderScrambleImage();
    });

    // 初始化字号滑块
    dom.sizeSlider.value = state.scrambleScale;
    document.documentElement.style.setProperty('--scramble-scale', state.scrambleScale);
    dom.sizeSlider.addEventListener("input", (e) => {
        state.scrambleScale = e.target.value;
        document.documentElement.style.setProperty('--scramble-scale', state.scrambleScale);
        localStorage.setItem(LS_PREFIX + "scrambleScale", state.scrambleScale);
    });

    // 渲染初始状态
    renderScores();
    updatePenaltyButtons(0);
    updatePenaltyButtons(1);
    renderAo5(0);
    renderAo5(1);

    // 加载第一个打乱
    loadNewScramble();

    // 初始化背景自定义控件
    initBgControls();

    // 尝试锁定竖屏
    tryLockOrientation();
}

// ===== 打乱生成 =====

/**
 * NOTE: 使用本地 csTimer scramble module 生成打乱（纯 JS，无 WASM，瞬间完成）
 * csTimer 的 scrMgr.scramblers[type](type, len, state) 同步返回打乱字符串
 */
function loadNewScramble() {
    state.scramble = null;
    state.scrambleLoading = true;
    renderScramble();

    try {
        const mapping = EVENT_TO_CSTIMER[state.puzzleId] || ['333', 0];
        const [csType, defaultLen] = mapping;
        // NOTE: scrMgr.scramblers[type] 同步返回 HTML 格式字符串，toTxt() 转为纯文本
        const rawScramble = scrMgr.scramblers[csType](csType, defaultLen);
        state.scramble = scrMgr.toTxt(rawScramble);
    } catch (err) {
        console.error('Scramble generation failed:', err);
        state.scramble = '⚠️ Scramble error';
    }
    state.scrambleLoading = false;
    renderScramble();
    renderScrambleImage(); // NOTE: 打乱文字更新后同步生成 SVG 图像
}

/**
 * NOTE: 调用 csTimer image.js 的 renderSVG 生成打乱图（纯客户端 SVG，不需要网络）
 * 直接调用 image 对象的内部方法，避免重复实现图像生成逻辑（DRY）
 */
function renderScrambleImage() {
    for (let i = 0; i < 2; i++) {
        dom.scrambleImgs[i].innerHTML = '';
        dom.scrambleImgs[i].style.display = state.showImage ? 'flex' : 'none';
    }
    if (!state.showImage || !state.scramble || state.scrambleLoading || state.scramble.startsWith('⚠️')) {
        return;
    }
    try {
        const mapping = EVENT_TO_CSTIMER[state.puzzleId] || ['333', 0];
        const [csType] = mapping;
        // NOTE: image.draw([type, scrambleText, 0]) 返回 $.svg 对象，.render() 得到 SVG 字符串
        const svg = image.draw([csType, state.scramble, 0]);
        if (!svg) return; // 不支持图像的项目
        const svgStr = svg.render();
        const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
        for (let i = 0; i < 2; i++) {
            const img = document.createElement('img');
            img.src = dataUrl;
            img.className = 'scramble-svg-img';
            dom.scrambleImgs[i].appendChild(img);
        }
    } catch (err) {
        // NOTE: 图像生成失败不影响打乱文字，静默处理
        console.warn('Scramble image failed:', err);
    }
}

// ===== 状态机核心（通用逻辑，触摸和键盘共用） =====

/**
 * 玩家按下（触摸/键盘）时的通用状态转换
 * @returns {boolean} 是否成功处理
 */
function playerDown(playerId) {
    // NOTE: 上一轮双方都已完成 → 任意按键触发重置，进入下一轮
    const [p0, p1] = state.players;
    if (p0.hasFinished && p1.hasFinished) {
        resetForNextRound();
    }

    const p = state.players[playerId];

    if (p.isTiming) {
        // --- 按下停止计时 ---
        const elapsed = performance.now() - p.startTime;
        // NOTE: 防误触：太短的时间不算
        if (elapsed > MIN_SOLVE_TIME) {
            p.time = elapsed;
            p.hasFinished = true;
            p.isTiming = false;
            cancelAnimationFrame(p.rafId);
            // NOTE: 立即更新奖杯显示（对方还在计时时用 Infinity 代替）
            updateLiveWinner();
            // NOTE: 停表后在对方区域显示此选手的成绩（让对手从正面看到）
            var myTime = effectiveTime(p);
            var label = myTime === Infinity ? 'DNF' : formatTime(myTime);
            renderOpponent(1 - playerId, '⚔️ ' + label);
            // NOTE: 第一个完成的选手 — 立即喷射 confetti（不等对手）
            const other = state.players[1 - playerId];
            if (other.isTiming) {
                fireWinnerConfetti(playerId);
                if (navigator.vibrate) navigator.vibrate(200);
            }
            checkBothFinished();
        }
        return true;
    } else if (!p.hasFinished && !p.canStart && state.scramble) {
        // --- 按下准备 ---
        p.isReady = true;
        renderArea(playerId);
        checkBothReady();
        return true;
    }
    return false;
}

/**
 * 玩家松开（触摸/键盘）时的通用状态转换
 */
function playerUp(playerId) {
    const p = state.players[playerId];

    if (p.canStart) {
        // --- 第一名玩家松手触发，强制双方同时开始计时 ---
        const startTime = performance.now();
        for (let i = 0; i < 2; i++) {
            const player = state.players[i];
            if (player.canStart) {
                player.canStart = false;
                player.isTiming = true;
                player.isReady = false;
                player.startTime = startTime;
                // NOTE: 此时才清除上一把成绩（用户要求保留到计时开始）
                player.time = 0;
                player.penalty = PENALTY.OK;
                renderArea(i);
                // NOTE: 必须调用 renderTime 清除上一把的 .winner 绿色 class
                renderTime(i);
                updatePenaltyButtons(i);
                renderOpponent(i, '');
                startTimerAnimation(i);
            }
        }
        checkBothTiming();
    } else if (p.isReady && !p.isTiming && !p.hasFinished) {
        // NOTE: 对方未就绪时松手 → 恢复 idle（黑色），取消红灯延时
        cancelReadyTimer();
        p.isReady = false;
        renderArea(playerId);
    }
}

// ===== 触摸事件处理 =====

function handlePointerDown(playerId, e) {
    const p = state.players[playerId];

    // NOTE: 如果此区域已经有一个 pointerId 绑定，忽略
    if (p.pointerId !== null) return;

    // 捕获此 pointer，确保后续事件不丢失
    dom.areas[playerId].setPointerCapture(e.pointerId);
    p.pointerId = e.pointerId;

    playerDown(playerId);
}

function handlePointerUp(playerId, e) {
    const p = state.players[playerId];

    // NOTE: 只响应匹配的 pointerId
    if (p.pointerId !== e.pointerId) return;
    p.pointerId = null;

    playerUp(playerId);
}

/**
 * NOTE: 移动端浏览器接管手势时会触发 pointercancel，
 * 必须清除 pointerId，否则该区域永远无法再接收新触摸
 */
function handlePointerCancel(playerId, e) {
    const p = state.players[playerId];
    if (p.pointerId !== e.pointerId) return;
    p.pointerId = null;
}

// ===== 键盘事件处理（桌面端） =====

// NOTE: 跟踪按键是否已按下，防止 keydown 事件重复触发（系统按键重复）
const keyPressed = {};

function handleKeyDown(e) {
    // NOTE: 设置面板打开时不响应键盘
    if (dom.settingsOverlay.classList.contains("visible")) return;

    const playerId = KEY_MAP[e.key];
    if (playerId === undefined) return;

    e.preventDefault();

    // NOTE: 防止系统按键重复（长按时会连续触发 keydown）
    if (keyPressed[e.key]) return;
    keyPressed[e.key] = true;

    playerDown(playerId);
}

function handleKeyUp(e) {
    const playerId = KEY_MAP[e.key];
    if (playerId === undefined) return;

    e.preventDefault();
    keyPressed[e.key] = false;

    playerUp(playerId);
}

function checkBothReady() {
    const [p0, p1] = state.players;
    if (p0.isReady && !p0.canStart && p1.isReady && !p1.canStart) {
        // NOTE: 双方都按住 → 红灯亮 0.2s 后变绿灯（canStart）
        // 期间任一方松手会在 playerUp 中调用 cancelReadyTimer() 取消
        state.readyTimer = setTimeout(() => {
            state.readyTimer = null;
            // NOTE: 再次确认双方仍在按住（防止极端时序竞争）
            if (p0.isReady && p1.isReady) {
                p0.canStart = true;
                p1.canStart = true;
                renderArea(0);
                renderArea(1);
            }
        }, 200);
    }
}

/**
 * NOTE: 取消红灯→绿灯的延时计时器（在松手时调用）
 */
function cancelReadyTimer() {
    if (state.readyTimer) {
        clearTimeout(state.readyTimer);
        state.readyTimer = null;
    }
}

function checkBothTiming() {
    const [p0, p1] = state.players;
    if (p0.isTiming && p1.isTiming) {
        p0.isReady = false;
        p1.isReady = false;
    }
}

function checkBothFinished() {
    const [p0, p1] = state.players;
    if (p0.hasFinished && p1.hasFinished) {
        computeWinner();
        // NOTE: 首次完成时记录成绩到历史（放在此处而非 computeWinner，避免罚时重判时重复 push）
        for (let i = 0; i < 2; i++) {
            state.players[i].solveHistory.push(effectiveTime(state.players[i]));
        }
        savePoints();
        renderAo5(0);
        renderAo5(1);
        loadNewScramble();
    }
}

/**
 * NOTE: 重置上一轮状态，为新一轮做准备
 * 在 playerDown() 开头调用，确保用户有时间查看上轮成绩/选罚时
 * NOTE: 不清除时间显示 — 上一把成绩保留到下一把计时开始才清零
 */
function resetForNextRound() {
    for (let i = 0; i < 2; i++) {
        const p = state.players[i];
        p.isReady = false;
        p.canStart = false;
        p.isTiming = false;
        p.hasFinished = false;
        // NOTE: 保留 p.time 和 p.penalty，让上一把成绩继续显示
        p.pointerId = null;
        renderArea(i);
        // 不调用 renderTime / updatePenaltyButtons — 保留上一把显示
    }
    state.winner = -2;
}

// ===== 计时动画 =====

function startTimerAnimation(playerId) {
    const p = state.players[playerId];
    const oppId = 1 - playerId;

    function tick() {
        if (!p.isTiming) return;
        const elapsed = performance.now() - p.startTime;
        var timeStr = state.showTime ? formatTime(elapsed) : "⏱️";
        dom.times[playerId].innerHTML = timeStr;
        // NOTE: 对手已停表时，在对手区域实时显示此玩家还在跑的时间
        if (state.players[oppId].hasFinished) {
            dom.opponents[oppId].innerHTML = '⚔️ ' + timeStr;
        }
        p.rafId = requestAnimationFrame(tick);
    }
    p.rafId = requestAnimationFrame(tick);
}

// ===== 胜负判定 =====

/**
 * NOTE: 实时更新奖杯显示 — 不加积分，只计算当前谁领先
 * 对方若还在计时，用 Infinity 代表"未完成（必输）"
 * 停表后和罚时变更后都调用此函数
 */
function updateLiveWinner() {
    const [p0, p1] = state.players;
    const t0 = p0.hasFinished ? effectiveTime(p0) : Infinity;
    const t1 = p1.hasFinished ? effectiveTime(p1) : Infinity;

    if (t0 === Infinity && t1 === Infinity) {
        state.winner = -2;
    } else if (t0 < t1) {
        state.winner = 0;
    } else if (t1 < t0) {
        state.winner = 1;
    } else {
        state.winner = -1;
    }

    // NOTE: 只更新 UI，积分由 computeWinner 在双方完成后统一计算
    renderTime(0);
    renderTime(1);
}

function computeWinner() {
    const [p0, p1] = state.players;

    // NOTE: 运算时间（考虑罚时），DNF 用 Infinity 表示必输
    const t0 = effectiveTime(p0);
    const t1 = effectiveTime(p1);

    if (t0 === Infinity && t1 === Infinity) {
        // 双 DNF，无赢家
        state.winner = -2;
    } else if (t0 < t1) {
        state.winner = 0;
        p0.points++;
    } else if (t1 < t0) {
        state.winner = 1;
        p1.points++;
    } else {
        // 平局
        state.winner = -1;
        p0.points++;
        p1.points++;
    }

    savePoints();
    renderScores();
    renderTime(0);
    renderTime(1);
    updatePenaltyButtons(0);
    updatePenaltyButtons(1);
    renderAo5(0);
    renderAo5(1);

    // NOTE: 在每个选手区域显示对手成绩（让双方能从正面看到对方时间）
    for (let i = 0; i < 2; i++) {
        var opp = state.players[1 - i];
        var oppTime = effectiveTime(opp);
        var label = oppTime === Infinity ? 'DNF' : formatTime(oppTime);
        renderOpponent(i, '⚔️ ' + label);
    }
}

/**
 * NOTE: 显示对手成绩 — 让每个选手从自己的半屏正面看到对方时间
 */
function renderOpponent(playerId, text) {
    dom.opponents[playerId].innerHTML = text;
}

/**
 * NOTE: 赢家 confetti 特效 — 从赢家半屏区域中心喷射彩纸
 * Player 0（下方）：从屏幕 75% 高度向上喷
 * Player 1（上方）：从屏幕 25% 高度向下喷
 */
function fireWinnerConfetti(playerId) {
    if (typeof confetti !== 'function') return;

    // 喷射角度和位置按玩家区域位置调整
    var isBottom = (playerId === 0);
    var originY = isBottom ? 0.75 : 0.25;
    // NOTE: 下方玩家向上喷（90°），上方玩家向下喷（270°）
    var angle = isBottom ? 90 : 270;

    // 连发 3 波，营造持续的庆祝感
    for (var i = 0; i < 3; i++) {
        setTimeout(function () {
            confetti({
                particleCount: 80,
                spread: 70,
                origin: { x: 0.5, y: originY },
                angle: angle,
                colors: ['#ff0', '#0f0', '#f00', '#00f', '#f90', '#fff'],
                gravity: isBottom ? 1 : -1,
                ticks: 150,
                disableForReducedMotion: true,
            });
        }, i * 200);
    }
}

function effectiveTime(player) {
    if (player.penalty === PENALTY.DNF) return Infinity;
    if (player.penalty === PENALTY.PLUS2) return player.time + 2000;
    return player.time;
}

// ===== 罚时 =====

function handlePenalty(playerId, penaltyType) {
    const p = state.players[playerId];
    // NOTE: 只有已完成且不在计时中才能改罚时
    if (!p.hasFinished || p.isTiming) return;

    p.penalty = penaltyType;
    // NOTE: 罚时变更后重新实时判断奖杯（双方都完成则 computeWinner 负责积分）
    updateLiveWinner();
    updatePenaltyButtons(playerId);

    // NOTE: 更新历史中最后一条记录（罚时变更影响有效时间）
    for (let i = 0; i < 2; i++) {
        var h = state.players[i].solveHistory;
        if (h.length > 0) h[h.length - 1] = effectiveTime(state.players[i]);
    }

    // NOTE: 双方完成后才重算积分
    if (state.players[0].hasFinished && state.players[1].hasFinished) {
        removeLastWinner();
        computeWinner();
    }
}

// ===== 设置操作 =====

// NOTE: 任何玩家处于 ready/timing 状态时返回 true — 用于禁止中间栏操作
function isAnyActive() {
    return state.players.some(p => p.isReady || p.isTiming);
}

function deleteLast() {
    if (!state.players[0].hasFinished || !state.players[1].hasFinished) return;

    removeLastWinner();
    for (let i = 0; i < 2; i++) {
        state.players[i].time = 0;
        state.players[i].hasFinished = false;
        state.players[i].penalty = PENALTY.OK;
        // NOTE: 同步回退历史记录
        state.players[i].solveHistory.pop();
        renderTime(i);
        updatePenaltyButtons(i);
        renderAo5(i);
    }
    savePoints();
    renderScores();
    closeSettings();
}

function toggleShowTime() {
    state.showTime = !state.showTime;
    localStorage.setItem(LS_PREFIX + "showTime", state.showTime);
    // NOTE: 更新按钮文字（根据当前语言）
    const lang = getLocale();
    const key = state.showTime ? 'hide_time' : 'show_time';
    document.getElementById("btn-toggle-time").textContent = I18N_TEXT[key][lang];
    closeSettings();
}

function resetAll() {
    state.winner = -2;
    for (let i = 0; i < 2; i++) {
        const p = state.players[i];
        p.isReady = false;
        p.canStart = false;
        p.isTiming = false;
        p.hasFinished = false;
        p.penalty = PENALTY.OK;
        p.time = 0;
        p.points = 0;
        // NOTE: 清空成绩历史
        p.solveHistory = [];
        cancelAnimationFrame(p.rafId);
        renderArea(i);
        renderTime(i);
        updatePenaltyButtons(i);
        renderAo5(i);
        renderOpponent(i, '');
    }
    savePoints();
    renderScores();
    loadNewScramble();
    closeSettings();
}

function removeLastWinner() {
    const [p0, p1] = state.players;
    if (state.winner === 0) {
        p0.points--;
    } else if (state.winner === 1) {
        p1.points--;
    } else if (state.winner === -1) {
        p0.points--;
        p1.points--;
    }
    state.winner = -2;
    savePoints();
}

function changePuzzle(puzzleId) {
    if (puzzleId === state.puzzleId) return;
    state.puzzleId = puzzleId;
    localStorage.setItem(LS_PREFIX + "puzzle", puzzleId);
    resetAll();
    // 更新选中状态
    document.querySelectorAll(".puzzle-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.puzzle === puzzleId);
    });
}

// ===== 渲染函数 =====

function renderArea(playerId) {
    const p = state.players[playerId];
    const el = dom.areas[playerId];

    el.classList.remove("state-ready", "state-can-start", "is-timing");
    if (p.canStart) {
        el.classList.add("state-can-start");
    } else if (p.isReady) {
        el.classList.add("state-ready");
    } else if (p.isTiming) {
        el.classList.add("is-timing");
    }
}

function renderTime(playerId) {
    const p = state.players[playerId];
    const el = dom.times[playerId];

    el.classList.remove("penalty-plus2", "penalty-dnf", "winner");

    if (p.time === 0 && !p.isTiming) {
        el.textContent = "0.000";
    } else if (p.penalty === PENALTY.DNF) {
        el.textContent = "DNF";
        el.classList.add("penalty-dnf");
    } else {
        const displayTime = p.penalty === PENALTY.PLUS2
            ? p.time + 2000
            : p.time;
        el.innerHTML = formatTime(displayTime);
        if (p.penalty === PENALTY.PLUS2) {
            el.classList.add("penalty-plus2");
        }
    }

    // NOTE: 赢家高亮 + 🏆（平局不加奖杯）
    if (state.winner === playerId) {
        el.classList.add('winner');
        el.innerHTML += ' <span class="trophy-icon">🏆</span>';
    } else if (state.winner === -1 && p.hasFinished) {
        // 平局：高亮但不加奖杯
        el.classList.add('winner');
    }
}

/**
 * NOTE: 计算 Ao5 — 取最近 5 条成绩，排序去最好最差，取中间 3 条均值
 * 返回 ms 值，DNF 返回 Infinity，不足 5 条返回 null
 */
function computeAo5(history) {
    if (history.length < 5) return null;
    var last5 = history.slice(-5);
    var sorted = [...last5].sort((a, b) => a - b);
    // NOTE: 2+ 个 DNF（Infinity）→ 整个 Ao5 = DNF
    var dnfCount = sorted.filter(t => t === Infinity).length;
    if (dnfCount >= 2) return Infinity;
    // 去掉最好（sorted[0]）和最差（sorted[4]），取中间 3 条均值
    return Math.round((sorted[1] + sorted[2] + sorted[3]) / 3);
}

function renderAo5(playerId) {
    var ao5 = computeAo5(state.players[playerId].solveHistory);
    var el = dom.ao5s[playerId];
    if (ao5 === null) {
        el.textContent = '';
    } else if (ao5 === Infinity) {
        el.textContent = 'ao5: DNF';
    } else {
        el.textContent = 'ao5: ' + formatTime(ao5);
    }
}

function renderScramble() {
    const lang = getLocale();
    const text = state.scrambleLoading
        ? `<span class="loading">${I18N_TEXT.generating[lang]}</span>`
        : (state.scramble || "");

    for (let i = 0; i < 2; i++) {
        dom.scrambles[i].innerHTML = text;
        // NOTE: 计时中隐藏打乱文字
        dom.scrambles[i].classList.toggle("hidden",
            state.players[i].isTiming);
    }
}

function renderScores() {
    for (let i = 0; i < 2; i++) {
        dom.scores[i].textContent = state.players[i].points;
    }
}

function updatePenaltyButtons(playerId) {
    const p = state.players[playerId];
    // NOTE: 只有完成后且不在计时中才可操作罚时
    const enabled = p.hasFinished && !p.isTiming && p.time > 0;
    const btns = dom.penalties[playerId].querySelectorAll(".penalty-btn");

    btns.forEach(btn => {
        const pen = btn.dataset.penalty;
        btn.disabled = !enabled || pen === p.penalty;
        btn.classList.toggle("active", pen === p.penalty && enabled);
    });
}

// ===== 设置面板 =====

function buildPuzzleGrid() {
    const grid = dom.puzzleGrid;
    const lang = getLocale();
    grid.innerHTML = "";
    for (const puz of PUZZLES) {
        const btn = document.createElement("button");
        btn.className = "puzzle-btn" + (puz.id === state.puzzleId ? " active" : "");
        btn.dataset.puzzle = puz.id;
        btn.textContent = puz.name[lang] || puz.name.en;
        btn.addEventListener("click", () => changePuzzle(puz.id));
        grid.appendChild(btn);
    }
}

function openSettings() {
    if (isAnyActive()) return;
    dom.settingsOverlay.classList.add("visible");
    // NOTE: 更新按钮文字（根据当前语言）
    const lang = getLocale();
    const key = state.showTime ? 'hide_time' : 'show_time';
    document.getElementById("btn-toggle-time").textContent = I18N_TEXT[key][lang];
    // 更新 delete last 按钮状态
    const canDelete = state.players[0].hasFinished && state.players[1].hasFinished;
    document.getElementById("btn-delete-last").disabled = !canDelete;
}

function closeSettings() {
    dom.settingsOverlay.classList.remove("visible");
}

// ===== 全屏 =====

function toggleFullscreen() {
    if (isAnyActive()) return;
    const btn = document.getElementById("btn-fullscreen");
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => {
            btn.classList.add("fullscreen-active");
        }).catch(() => {
            // NOTE: iOS Safari 不支持 Fullscreen API
        });
    } else {
        document.exitFullscreen();
        btn.classList.remove("fullscreen-active");
    }
}

function tryLockOrientation() {
    try {
        screen.orientation.lock("portrait").catch(() => {
            // NOTE: 大部分桌面浏览器不支持，静默失败
        });
    } catch (_) {}
}

// ===== 持久化 =====

// NOTE: 比分和历史仅存在内存中 — 刷新页面即清零（用户要求）
function savePoints() {
    // 不持久化，F5 刷新回归原始状态
}

// ===== 时间格式化 =====

/**
 * 将毫秒格式化为 M:SS.mmm 或 SS.mmm
 * 例如: 65432 → "1:05.432"，7890 → "7.890"
 */
function formatTime(ms) {
    if (ms <= 0) return "0.000";

    const totalMs = Math.floor(ms);
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const millis = totalMs % 1000;

    const millisStr = millis.toString().padStart(3, "0");

    if (minutes > 0) {
        return `${minutes}<span class="colon">:</span>${seconds.toString().padStart(2, "0")}.${millisStr}`;
    }
    return `${seconds}.${millisStr}`;
}

// ===== 背景自定义 =====

const BG_MAX_BYTES = 4 * 1024 * 1024; // NOTE: 4MB 上限

/**
 * NOTE: W3C 相对亮度（WCAG）公式：先线性化 sRGB，再加权求和
 * 返回 0（纯黑）到 1（纯白），> 0.4 视为"亮色"
 * @param {string} hex - 如 "#a0c0e0"
 * @returns {number}
 */
function perceivedLuminance(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const lin = (c) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function applyBg(playerId) {
    const area = dom.areas[playerId];
    const img = localStorage.getItem(`${LS_PREFIX}bg_img_${playerId}`);
    const color = localStorage.getItem(`${LS_PREFIX}bg_color_${playerId}`);
    if (img) {
        area.style.backgroundImage = `url(${img})`;
        area.style.backgroundSize = 'cover';
        area.style.backgroundPosition = 'center';
        area.style.backgroundColor = '';
    } else if (color && color !== '#000000') {
        area.style.backgroundImage = '';
        area.style.backgroundColor = color;
    } else {
        area.style.backgroundImage = '';
        area.style.backgroundColor = '';
    }

    // NOTE: 根据背景亮度自动切换文字颜色（W3C 感知亮度）；图片背景取颜色选择器值作为代表色
    const repColor = color || '#000000';
    const lum = perceivedLuminance(repColor);
    // NOTE: 0.4 阈值（实测在浅灰 #a0a0a0 附近）：亮则黑字，暗则白/灰字
    area.style.setProperty('--player-text-color', lum > 0.4 ? '#111' : '');

    // NOTE: 同步更新中间栏渐变 — 左侧=P2(上方)色，右侧=P1(下方)色，中间混合暗色
    updateBarGradient();
}

/**
 * NOTE: 更新中间栏渐变 — 将两个玩家的背景色混入中间条
 * 左侧(P2)色 → 中间暗色 → 右侧(P1)色
 * 如果玩家用了图片背景，提取其颜色选择器的值作为代表色
 */
function updateBarGradient() {
    const bar = document.querySelector('.middle-bar');
    if (!bar) return;
    // NOTE: 取颜色（图片背景时仍用颜色选择器的值作为代表色）
    const c0 = localStorage.getItem(`${LS_PREFIX}bg_color_0`) || '#000000';
    const c1 = localStorage.getItem(`${LS_PREFIX}bg_color_1`) || '#000000';
    bar.style.setProperty('--bar-color-left', c1);
    bar.style.setProperty('--bar-color-right', c0);
    // NOTE: 取两端亮度平均值决定中间栏文字颜色，> 0.4 则用黑字
    const avgLum = (perceivedLuminance(c0) + perceivedLuminance(c1)) / 2;
    bar.style.setProperty('--bar-text-color', avgLum > 0.4 ? '#111' : '#ccc');
}

function showBgError(msg) {
    dom.bgError.textContent = msg;
    dom.bgError.style.display = 'block';
    clearTimeout(dom.bgError._timer);
    dom.bgError._timer = setTimeout(() => { dom.bgError.style.display = 'none'; }, 3000);
}

function initBgControls() {
    for (let i = 0; i < 2; i++) {
        const savedColor = localStorage.getItem(`${LS_PREFIX}bg_color_${i}`);
        if (savedColor) dom.bgColors[i].value = savedColor;
        applyBg(i);

        dom.bgColors[i].addEventListener('change', (e) => {
            localStorage.setItem(`${LS_PREFIX}bg_color_${i}`, e.target.value);
            localStorage.removeItem(`${LS_PREFIX}bg_img_${i}`);
            applyBg(i);
        });

        dom.bgImages[i].addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > BG_MAX_BYTES) {
                showBgError(`图片太大（${(file.size / 1024 / 1024).toFixed(1)} MB），请上传 4MB 以内的图片`);
                e.target.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    localStorage.setItem(`${LS_PREFIX}bg_img_${i}`, ev.target.result);
                    applyBg(i);
                } catch (_) {
                    showBgError('存储空间不足，请重置后再上传较小的图片');
                }
            };
            reader.readAsDataURL(file);
        });

        dom.bgResets[i].addEventListener('click', () => {
            localStorage.removeItem(`${LS_PREFIX}bg_color_${i}`);
            localStorage.removeItem(`${LS_PREFIX}bg_img_${i}`);
            dom.bgColors[i].value = '#000000';
            dom.bgImages[i].value = '';
            applyBg(i);
        });
    }
}
