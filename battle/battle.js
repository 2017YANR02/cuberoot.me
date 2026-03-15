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
    // 当前打乱
    scramble: null,
    // 是否正在加载打乱
    scrambleLoading: false,
    // 赢家标识：-2=未决 -1=平局 0=下方 1=上方
    winner: -2,
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
        // 累积比分
        points: parseInt(localStorage.getItem(LS_PREFIX + "p" + id)) || 0,
        // 此玩家绑定的 pointerId（多点触控隔离）
        pointerId: null,
        // requestAnimationFrame ID
        rafId: null,
    };
}

// ===== DOM 引用 =====

const dom = {
    areas: [null, null],       // 两个玩家触摸区域
    times: [null, null],       // 计时显示
    scrambles: [null, null],   // 打乱文字
    scrambleImgs: [null, null],// 打乱图（csTimer SVG）
    penalties: [null, null],   // 罚时按钮组
    scores: [null, null],      // 比分数字
    settingsOverlay: null,
    puzzleGrid: null,
    toggleImage: null,
};

// ===== 初始化 =====

document.addEventListener("DOMContentLoaded", init);

function init() {
    // 获取 DOM 元素
    dom.areas[0] = document.getElementById("player-bottom");
    dom.areas[1] = document.getElementById("player-top");
    dom.times[0] = document.getElementById("time-0");
    dom.times[1] = document.getElementById("time-1");
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

    // 渲染初始状态
    renderScores();
    updatePenaltyButtons(0);
    updatePenaltyButtons(1);

    // 加载第一个打乱
    loadNewScramble();

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
            renderTime(playerId);
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
        // --- 松手开始计时 ---
        p.canStart = false;
        p.isTiming = true;
        p.isReady = false;
        p.startTime = performance.now();
        p.penalty = PENALTY.OK;
        renderArea(playerId);
        startTimerAnimation(playerId);
        checkBothTiming();
    } else if (p.isReady && !p.isTiming && !p.hasFinished) {
        // NOTE: 对方未就绪时松手 → 恢复 idle（黑色），与上游行为一致
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
        // 双方都按住了 → 允许开始（变绿）
        p0.canStart = true;
        p1.canStart = true;
        renderArea(0);
        renderArea(1);
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
        loadNewScramble();
    }
}

/**
 * NOTE: 重置上一轮状态，为新一轮做准备
 * 在 playerDown() 开头调用，确保用户有时间查看上轮成绩/选罚时
 */
function resetForNextRound() {
    for (let i = 0; i < 2; i++) {
        const p = state.players[i];
        p.isReady = false;
        p.canStart = false;
        p.isTiming = false;
        p.hasFinished = false;
        p.time = 0;
        p.penalty = PENALTY.OK;
        p.pointerId = null;
        renderArea(i);
        renderTime(i);
        updatePenaltyButtons(i);
    }
    state.winner = -2;
}

// ===== 计时动画 =====

function startTimerAnimation(playerId) {
    const p = state.players[playerId];

    function tick() {
        if (!p.isTiming) return;
        const elapsed = performance.now() - p.startTime;
        dom.times[playerId].innerHTML = state.showTime
            ? formatTime(elapsed)
            : "⏱️";
        p.rafId = requestAnimationFrame(tick);
    }
    p.rafId = requestAnimationFrame(tick);
}

// ===== 胜负判定 =====

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
    renderTime(playerId);
    updatePenaltyButtons(playerId);

    // 重新判定胜负
    removeLastWinner();
    computeWinner();
}

// ===== 设置操作 =====

function deleteLast() {
    if (!state.players[0].hasFinished || !state.players[1].hasFinished) return;

    removeLastWinner();
    for (let i = 0; i < 2; i++) {
        state.players[i].time = 0;
        state.players[i].hasFinished = false;
        state.players[i].penalty = PENALTY.OK;
        renderTime(i);
        updatePenaltyButtons(i);
    }
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
        cancelAnimationFrame(p.rafId);
        renderArea(i);
        renderTime(i);
        updatePenaltyButtons(i);
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

    el.classList.remove("state-ready", "state-can-start");
    if (p.canStart) {
        el.classList.add("state-can-start");
    } else if (p.isReady) {
        el.classList.add("state-ready");
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

    // 赢家高亮
    if (state.winner === playerId || (state.winner === -1 && p.hasFinished)) {
        el.classList.add("winner");
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

function savePoints() {
    for (let i = 0; i < 2; i++) {
        localStorage.setItem(LS_PREFIX + "p" + i, state.players[i].points);
    }
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
