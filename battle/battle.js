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
    hide_time:  { en: "👀 Hide time", zh: "👀 隐藏时间" },
    show_time:  { en: "👀 Show time", zh: "👀 显示时间" },
    generating: { en: "Generating scramble...",    zh: "正在生成打乱..." },
    // NOTE: WCA 观察倒计时状态文字
    inspecting: { en: "Inspecting",                zh: "观察中" },
};

// NOTE: 是否为 Solo 模式的快捷判断
function isSolo() { return state.mode === 'solo'; }
// NOTE: 是否为盲拧项目（3BLD/4BLD/5BLD）— 自动启用 memo 分段
function isBLD() { return ['333bf', '444bf', '555bf'].includes(state.puzzleId); }

// ===== 状态 =====

const state = {
    // NOTE: Solo/1v1 模式（'solo' 或 '1v1'）
    mode: localStorage.getItem(LS_PREFIX + "mode") || "1v1",
    // 当前项目 ID
    puzzleId: localStorage.getItem(LS_PREFIX + "puzzle") || "333",
    // 是否显示计时中的时间
    showTime: localStorage.getItem(LS_PREFIX + "showTime") !== "false",
    // 是否显示打乱图
    showImage: localStorage.getItem(LS_PREFIX + "showImage") !== "false",
    // WCA 观察倒计时时长（秒）：0=OFF, 8, 15(WCA), 9999=∞
    inspectionTime: parseInt(localStorage.getItem(LS_PREFIX + "inspectionTime")) || 0,
    // 观察语音提示（8s/12s）
    voice: localStorage.getItem(LS_PREFIX + "voice") !== "false",
    // NOTE: 多阶段计时（1=正常, 2=BLD-style, 4=CFOP）
    phases: parseInt(localStorage.getItem(LS_PREFIX + "phases")) || 1,
    // 当前打乱图字号缩放比例
    scrambleScale: parseFloat(localStorage.getItem(LS_PREFIX + "scrambleScale")) || 1.0,
    // NOTE: 背景不透明度（0.1~1.0）
    bgOpacity: parseFloat(localStorage.getItem(LS_PREFIX + "bgOpacity")) || 1.0,
    // NOTE: 计时器精确度（小数位数：0=秒, 1=0.1s, 2=0.01s, 3=0.001s）
    timerPrecision: (() => { const v = localStorage.getItem(LS_PREFIX + 'timerPrecision'); return v !== null ? parseInt(v) : 3; })(),
    // NOTE: 启动延时（ms），按住多久后才能开始计时
    startDelay: (() => { const v = localStorage.getItem(LS_PREFIX + 'startDelay'); return v !== null ? parseInt(v) : 300; })(),
    // NOTE: 用户选择显示的 Average 类型
    enabledAverages: JSON.parse(localStorage.getItem(LS_PREFIX + 'enabledAverages') || '[5, 12]'),
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
    // NOTE: 撤销栈 — 存储被删除的 {index, entry} 供 undo
    undoStack: [],
    // NOTE: Session 管理
    sessionId: localStorage.getItem(LS_PREFIX + 'sessionId') || '1',
    sessions: JSON.parse(localStorage.getItem(LS_PREFIX + 'sessions') || '[{"id":"1","name":"Session 1"}]'),
};

function createPlayer(id) {
    return {
        id,
        isReady: false,
        canStart: false,
        isTiming: false,
        hasFinished: false,
        // NOTE: WCA 观察状态（Solo 模式）
        isInspecting: false,
        inspectionStart: 0,
        inspectionTimer: null,   // setInterval ID
        inspectionPenalty: null, // null, '+2', 'dnf'
        penalty: PENALTY.OK,
        // NOTE: 以 ms 为单位的解题时间
        time: 0,
        // performance.now() 时间戳（单调时钟，更精确）
        startTime: 0,
        // NOTE: 多阶段计时 — phaseSplits 存储每次分段的时间戳
        phaseSplits: [],
        // 累积比分（刷新即清零）
        points: 0,
        // 此玩家绑定的 pointerId（多点触控隔离）
        pointerId: null,
        // requestAnimationFrame ID
        rafId: null,
        // NOTE: 成绩历史 — 对象数组 {time, penalty, scramble, date}
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
    modeSeg: null,             // Solo/1v1 模式分段选择器
    selectInspection: null,    // 观察时间下拉
    toggleVoice: null,         // 语音提示开关
    sizeSlider: null,
    // NOTE: 历史面板
    historyOverlay: null,
    historyList: null,
    historyStats: null,
    // NOTE: 背景自定义控件（每个玩家各一组）
    bgColors: [null, null],    // color input
    bgImages: [null, null],    // file input
    bgResets: [null, null],    // reset button
    bgError: null,             // 错误提示
    bgOpacitySlider: null,     // 不透明度滑块
    // NOTE: 打乱文字颜色自定义控件（每个玩家独立）
    scrambleColors: [null, null],       // 打乱文字颜色选择器
    scrambleColorResets: [null, null],  // 打乱颜色重置按鈕
    selectSession: null,       // Session 下拉
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
    dom.modeSeg = document.getElementById("mode-seg");
    dom.selectInspection = document.getElementById("select-inspection");
    dom.toggleVoice = document.getElementById("toggle-voice");
    dom.selectSession = document.getElementById("select-session");
    dom.sizeSlider = document.getElementById("scramble-size-slider");
    // NOTE: 历史面板引用
    dom.historyOverlay = document.getElementById("history-overlay");
    dom.historyList = document.getElementById("history-list");
    dom.historyStats = document.getElementById("history-stats");
    // NOTE: 背景自定义控件引用
    for (let i = 0; i < 2; i++) {
        dom.bgColors[i] = document.getElementById(`bg-color-${i}`);
        dom.bgImages[i] = document.getElementById(`bg-image-${i}`);
        dom.bgResets[i] = document.getElementById(`bg-reset-${i}`);
        dom.scrambleColors[i] = document.getElementById(`scramble-color-${i}`);
        dom.scrambleColorResets[i] = document.getElementById(`scramble-color-reset-${i}`);
    }
    dom.bgError = document.getElementById('bg-error');
    dom.bgOpacitySlider = document.getElementById('bg-opacity-slider');

    // 绑定触摸事件
    for (let i = 0; i < 2; i++) {
        // NOTE: 使用 pointer 事件支持多点触控隔离
        dom.areas[i].addEventListener("pointerdown", (e) => handlePointerDown(i, e));
        dom.areas[i].addEventListener("pointerup", (e) => handlePointerUp(i, e));
        dom.areas[i].addEventListener("pointercancel", (e) => handlePointerCancel(i, e));

        // 绑定罚时下拉（触发按钮 + 选项，阻止事件冒泡到 player area）
        const trigger = dom.penalties[i].querySelector(".penalty-trigger");
        const options = dom.penalties[i].querySelectorAll(".penalty-option");

        trigger.addEventListener("pointerdown", (e) => e.stopPropagation());
        trigger.addEventListener("pointerup", (e) => e.stopPropagation());
        trigger.addEventListener("click", (e) => {
            e.stopPropagation();
            // NOTE: disabled 时不处理
            if (trigger.disabled) return;
            // 切换 open 状态，同时关闭另一个
            const isOpen = dom.penalties[i].classList.contains("open");
            closeAllDropdowns();
            if (!isOpen) dom.penalties[i].classList.add("open");
        });

        options.forEach(opt => {
            opt.addEventListener("pointerdown", (e) => e.stopPropagation());
            opt.addEventListener("pointerup", (e) => e.stopPropagation());
            opt.addEventListener("click", (e) => {
                e.stopPropagation();
                handlePenalty(i, opt.dataset.penalty);
                closeAllDropdowns();
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

    // NOTE: 底部导航栏 tab 切换（Solo 模式）
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // NOTE: 点击页面其他区域时关闭已打开的罚时下拉
    document.addEventListener("click", () => closeAllDropdowns());

    // NOTE: Solo/1v1 模式分段选择器
    dom.modeSeg.querySelectorAll('.mode-seg-btn').forEach(btn => {
        if (btn.dataset.mode === state.mode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
        btn.addEventListener('click', () => {
            state.mode = btn.dataset.mode;
            localStorage.setItem(LS_PREFIX + 'mode', state.mode);
            // 更新 active 状态
            dom.modeSeg.querySelectorAll('.mode-seg-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.mode === state.mode);
            });
            applyMode();
        });
    });

    // NOTE: 语言分段选择器
    const langSeg = document.getElementById('lang-seg');
    const curLang = getLocale();
    langSeg.querySelectorAll('.mode-seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === curLang);
        btn.addEventListener('click', () => {
            if (typeof I18n !== 'undefined') {
                I18n.setLocale(btn.dataset.lang);
            }
            langSeg.querySelectorAll('.mode-seg-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.lang === btn.dataset.lang);
            });
        });
    });

    // NOTE: 计时器精确度选择
    const selPrecision = document.getElementById("select-precision");
    selPrecision.value = state.timerPrecision.toString();
    selPrecision.addEventListener("change", (e) => {
        state.timerPrecision = parseInt(e.target.value);
        localStorage.setItem(LS_PREFIX + 'timerPrecision', state.timerPrecision);
    });

    // NOTE: 启动延时滑块
    const delaySlider = document.getElementById("start-delay-slider");
    const delayLabel = document.getElementById("start-delay-value");
    delaySlider.value = state.startDelay;
    delayLabel.textContent = (state.startDelay / 1000).toFixed(2) + ' s';
    delaySlider.addEventListener("input", (e) => {
        state.startDelay = parseInt(e.target.value);
        localStorage.setItem(LS_PREFIX + 'startDelay', state.startDelay);
        delayLabel.textContent = (state.startDelay / 1000).toFixed(2) + ' s';
    });

    // NOTE: WCA Inspection 时长选择
    dom.selectInspection.value = state.inspectionTime.toString();
    dom.selectInspection.addEventListener("change", (e) => {
        state.inspectionTime = parseInt(e.target.value);
        localStorage.setItem(LS_PREFIX + 'inspectionTime', state.inspectionTime);
    });

    // NOTE: 观察语音提示开关
    dom.toggleVoice.checked = state.voice;
    dom.toggleVoice.addEventListener("change", (e) => {
        state.voice = e.target.checked;
        localStorage.setItem(LS_PREFIX + 'voice', state.voice);
    });

    // NOTE: 多阶段计时选择
    const selPhases = document.getElementById("select-phases");
    selPhases.value = state.phases.toString();
    selPhases.addEventListener("change", (e) => {
        state.phases = parseInt(e.target.value);
        localStorage.setItem(LS_PREFIX + 'phases', state.phases);
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

    // NOTE: 历史面板事件
    document.getElementById("btn-history").addEventListener("click", openHistory);
    document.getElementById("history-close").addEventListener("click", closeHistory);
    document.getElementById("history-undo").addEventListener("click", undoDelete);
    document.getElementById("history-export").addEventListener("click", exportCSV);
    dom.historyOverlay.addEventListener("click", (e) => {
        if (e.target === dom.historyOverlay) closeHistory();
    });

    // NOTE: Session 管理事件
    dom.selectSession.addEventListener("change", (e) => switchSession(e.target.value));
    document.getElementById("btn-session-new").addEventListener("click", newSession);
    document.getElementById("btn-session-rename").addEventListener("click", renameSession);
    document.getElementById("btn-session-delete").addEventListener("click", deleteSession);
    renderSessionList();

    // NOTE: WCA 登录事件绑定
    document.getElementById("btn-wca-login").addEventListener("click", () => WcaAuth.login());
    document.getElementById("btn-wca-logout").addEventListener("click", () => {
        WcaAuth.logout();
        updateWcaAuthUI();
    });
    document.getElementById("btn-wca-sync").addEventListener("click", () => syncAllSessions());
    updateWcaAuthUI();

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

    // NOTE: 背景不透明度滑块
    dom.bgOpacitySlider.value = state.bgOpacity;
    dom.bgOpacitySlider.addEventListener('input', (e) => {
        state.bgOpacity = parseFloat(e.target.value);
        localStorage.setItem(LS_PREFIX + 'bgOpacity', state.bgOpacity);
        applyBg(0);
        applyBg(1);
    });

    // NOTE: 从 localStorage 恢复成绩历史
    loadSolveHistory();

    // NOTE: 应用初始模式布局
    applyMode();

    // NOTE: 已登录时自动从云端拉取成绩
    if (typeof WcaAuth !== 'undefined' && WcaAuth.isLoggedIn()) {
        pullFromCloud();
    }

    // 尝试锁定竖屏
    tryLockOrientation();

    // NOTE: 启用 Tab 滑动手势（Solo 模式下左右滑动切换 tab）
    initSwipeGesture();
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
    // NOTE: Solo 模式只处理 player 0
    if (isSolo() && playerId !== 0) return false;

    const p = state.players[playerId];

    if (isSolo()) {
        // === Solo 模式状态机 ===
        if (p.hasFinished) {
            // 上一轮已完成 → 重置进入下一轮
            resetForNextRound();
        }
        if (p.isInspecting) {
            // NOTE: 观察中按下 → 进入准备状态
            p.isReady = true;
            renderArea(playerId);
            checkBothReady();
            return true;
        }
        if (p.isTiming) {
            // 计时中按下
            const elapsed = performance.now() - p.startTime;
            if (elapsed > MIN_SOLVE_TIME) {
                // NOTE: 多阶段计时 — 获取有效阶段数（BLD 强制 2 阶段）
                const numPhases = isBLD() ? 2 : state.phases;
                if (numPhases > 1 && p.phaseSplits.length < numPhases - 1) {
                    // 记录分段时间（不停表）
                    p.phaseSplits.push(elapsed);
                    return true;
                }
                p.time = elapsed;
                p.hasFinished = true;
                p.isTiming = false;
                cancelAnimationFrame(p.rafId);
                // NOTE: 应用观察罚时（如果有）
                if (p.inspectionPenalty === '+2') {
                    p.penalty = PENALTY.PLUS2;
                } else if (p.inspectionPenalty === 'dnf') {
                    p.penalty = PENALTY.DNF;
                }
                renderTime(playerId);
                checkBothFinished();
            }
            return true;
        }
        if (!p.hasFinished && !p.canStart && state.scramble) {
            // 空闲状态按下 → 准备
            p.isReady = true;
            renderArea(playerId);
            checkBothReady();
            return true;
        }
        return false;
    }

    // === 1v1 模式原有逻辑 ===
    // NOTE: 上一轮双方都已完成 → 任意按键触发重置，进入下一轮
    const [p0, p1] = state.players;
    if (p0.hasFinished && p1.hasFinished) {
        resetForNextRound();
    }

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
    // NOTE: Solo 模式只处理 player 0
    if (isSolo() && playerId !== 0) return;

    const p = state.players[playerId];

    if (isSolo()) {
        // === Solo 模式 ===
        if (p.canStart) {
            // NOTE: inspection 开启时，松手开始观察倒计时
            if (state.inspectionTime > 0 && !p.isInspecting && !p.isTiming) {
                p.canStart = false;
                p.isReady = false;
                startInspection(playerId);
                return;
            }
            // 松手开始计时
            p.canStart = false;
            p.isTiming = true;
            p.isReady = false;
            p.startTime = performance.now();
            p.time = 0;
            // NOTE: 清空分段计时
            p.phaseSplits = [];
            if (!p.inspectionPenalty) p.penalty = PENALTY.OK;
            // NOTE: 清除观察状态
            clearInspection(playerId);
            renderArea(playerId);
            renderTime(playerId);
            updatePenaltyButtons(playerId);
            startTimerAnimation(playerId);
            return;
        }
        if (p.isReady && !p.isTiming && !p.hasFinished) {
            cancelReadyTimer();
            p.isReady = false;
            renderArea(playerId);
        }
        return;
    }

    // === 1v1 模式原有逻辑 ===
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
 * NOTE: 移动端浏览器接管手势时会触发 pointercancel（而非 pointerup），
 * 必须清除 pointerId 并调用 playerUp，否则 canStart 状态会卡死
 * （spec: pointercancel 后不会再触发 pointerup）
 */
function handlePointerCancel(playerId, e) {
    const p = state.players[playerId];
    if (p.pointerId !== e.pointerId) return;
    p.pointerId = null;
    playerUp(playerId);
}

// ===== 键盘事件处理（桌面端） =====

// NOTE: 跟踪按键是否已按下，防止 keydown 事件重复触发（系统按键重复）
const keyPressed = {};

function handleKeyDown(e) {
    // NOTE: 设置面板或历史面板打开时不响应键盘
    if (dom.settingsOverlay.classList.contains("visible")) return;
    if (dom.historyOverlay.classList.contains("visible")) return;

    const playerId = KEY_MAP[e.key];
    if (playerId === undefined) return;

    // NOTE: Solo 模式只响应空格键（player 0）
    if (isSolo() && playerId !== 0) return;

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
    if (isSolo()) {
        // NOTE: Solo 模式——只检查 player 0
        const p0 = state.players[0];
        if (p0.isReady && !p0.canStart) {
            state.readyTimer = setTimeout(() => {
                state.readyTimer = null;
                if (p0.isReady) {
                    p0.canStart = true;
                    renderArea(0);
                }
            }, state.startDelay);
        }
        return;
    }
    // === 1v1 原有逻辑 ===
    const [p0, p1] = state.players;
    if (p0.isReady && !p0.canStart && p1.isReady && !p1.canStart) {
        // NOTE: 双方都按住 → 红灯亮 0.2s 后变绿灯（canStart）
        state.readyTimer = setTimeout(() => {
            state.readyTimer = null;
            // NOTE: 再次确认双方仍在按住（防止极端时序竞争）
            if (p0.isReady && p1.isReady) {
                p0.canStart = true;
                p1.canStart = true;
                renderArea(0);
                renderArea(1);
            }
        }, state.startDelay);
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
    if (isSolo()) {
        // NOTE: Solo 模式——单人完成即记录
        const p = state.players[0];
        if (p.hasFinished) {
            const entry = {
                time: p.time,
                penalty: p.penalty === PENALTY.DNF ? 'dnf' : (p.penalty === PENALTY.PLUS2 ? '+2' : 'ok'),
                scramble: state.scramble || '',
                date: new Date().toISOString(),
            };
            // NOTE: 多阶段分段记录
            if (p.phaseSplits.length > 0) entry.phases = [...p.phaseSplits, p.time];
            p.solveHistory.push(entry);
            saveSolveHistory();
            // NOTE: 里程碑检测 + 疲劳预警
            checkMilestone();
            checkFatigue();
            // NOTE: 普通停表触觉反馈（非 PB 时的轻微震动）
            if (navigator.vibrate) navigator.vibrate(30);
            renderTime(0);
            renderSoloStats(0);
            updatePenaltyButtons(0);
            loadNewScramble();
        }
        return;
    }
    // === 1v1 原有逻辑 ===
    const [p0, p1] = state.players;
    if (p0.hasFinished && p1.hasFinished) {
        computeWinner();
        // NOTE: 首次完成时记录成绩到历史
        for (let i = 0; i < 2; i++) {
            state.players[i].solveHistory.push({
                time: state.players[i].time,
                penalty: state.players[i].penalty === PENALTY.DNF ? 'dnf' : (state.players[i].penalty === PENALTY.PLUS2 ? '+2' : 'ok'),
                scramble: state.scramble || '',
                date: new Date().toISOString(),
            });
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
    if (isSolo()) {
        // NOTE: Solo 模式只重置 player 0
        const p = state.players[0];
        p.isReady = false;
        p.canStart = false;
        p.isTiming = false;
        p.hasFinished = false;
        p.inspectionPenalty = null;
        clearInspection(0);
        // NOTE: 不清除 pointerId — 当前触摸可能还在进行中，由 pointer 事件自行管理
        renderArea(0);
        return;
    }
    // === 1v1 原有逻辑 ===
    for (let i = 0; i < 2; i++) {
        const p = state.players[i];
        p.isReady = false;
        p.canStart = false;
        p.isTiming = false;
        p.hasFinished = false;
        // NOTE: 保留 p.time 和 p.penalty，让上一把成绩继续显示
        // NOTE: 不清除 pointerId — 当前触摸可能还在进行中
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

/**
 * NOTE: 关闭所有罚时下拉菜单（点击外部或选择后调用）
 */
function closeAllDropdowns() {
    document.querySelectorAll(".penalty-dropdown.open").forEach(el => {
        el.classList.remove("open");
    });
}

function handlePenalty(playerId, penaltyType) {
    const p = state.players[playerId];
    // NOTE: 只有已完成且不在计时中才能改罚时
    if (!p.hasFinished || p.isTiming) return;

    p.penalty = penaltyType;

    if (isSolo()) {
        // NOTE: Solo 模式——更新历史中最后一条记录的 penalty 字段
        const h = p.solveHistory;
        if (h.length > 0) {
            h[h.length - 1].penalty = penaltyType === PENALTY.DNF ? 'dnf' : (penaltyType === PENALTY.PLUS2 ? '+2' : 'ok');
        }
        saveSolveHistory();
        updatePenaltyButtons(playerId);
        renderTime(playerId);
        renderSoloStats(playerId);
        return;
    }

    // === 1v1 原有逻辑 ===
    // NOTE: 罚时变更后重新实时判断奖杯
    updateLiveWinner();
    updatePenaltyButtons(playerId);

    // NOTE: 更新历史中最后一条记录的 penalty
    for (let i = 0; i < 2; i++) {
        var h = state.players[i].solveHistory;
        if (h.length > 0) {
            h[h.length - 1].penalty = state.players[i].penalty === PENALTY.DNF ? 'dnf' : (state.players[i].penalty === PENALTY.PLUS2 ? '+2' : 'ok');
        }
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
    if (isSolo()) {
        // NOTE: Solo 模式——删除最后一条成绩
        const p = state.players[0];
        if (p.solveHistory.length === 0) return;
        p.solveHistory.pop();
        p.time = 0;
        p.hasFinished = false;
        p.penalty = PENALTY.OK;
        saveSolveHistory();
        renderTime(0);
        updatePenaltyButtons(0);
        renderSoloStats(0);
        closeSettings();
        return;
    }
    // === 1v1 原有逻辑 ===
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
        p.inspectionPenalty = null;
        clearInspection(i);
        // NOTE: 清空成绩历史
        p.solveHistory = [];
        cancelAnimationFrame(p.rafId);
        renderArea(i);
        renderTime(i);
        updatePenaltyButtons(i);
        renderAo5(i);
        renderOpponent(i, '');
    }
    // NOTE: 清理持久化数据
    if (isSolo()) {
        saveSolveHistory();
        renderSoloStats(0);
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
    // NOTE: Solo 模式切换项目时，先保存当前项目的历史
    if (isSolo()) saveSolveHistory();
    state.puzzleId = puzzleId;
    localStorage.setItem(LS_PREFIX + "puzzle", puzzleId);
    // NOTE: 重置状态（包括清空当前内存中的历史）
    resetAll();
    // NOTE: Solo 模式下加载新项目的历史
    if (isSolo()) {
        loadSolveHistory();
        renderSoloStats(0);
    }
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
        // NOTE: +2 "+" 后缀，WCA 标准记法（如 2.632+）
        // NOTE: +2 suffix 用 span 单独设字体，避免 Segment7Standard 字体没有标准 + 字形
        const suffix = p.penalty === PENALTY.PLUS2 ? '<span class="plus-suffix">+</span>' : '';
        el.innerHTML = formatTime(displayTime) + suffix;
        if (p.penalty === PENALTY.PLUS2) {
            el.classList.add("penalty-plus2");
        }
    }

    // NOTE: 多阶段完成后显示分段时间
    if (isSolo() && p.hasFinished && p.phaseSplits.length > 0) {
        // 计算每段的增量时间
        const allPhases = [...p.phaseSplits, p.time];
        const parts = allPhases.map((t, i) => {
            const delta = i === 0 ? t : t - allPhases[i - 1];
            const label = isBLD() && i === 0 ? 'memo' : `P${i + 1}`;
            return `${label}: ${formatTimePlain(delta)}`;
        });
        el.innerHTML += `<div class="memo-display">${parts.join(' │ ')}</div>`;
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
 * NOTE: 从历史记录对象提取有效时间（含罚时计算）
 * 兼容新格式 {time, penalty, scramble, date} 和旧格式（纯 ms 数字）
 */
function getEffectiveTimeFromEntry(entry) {
    if (typeof entry === 'number') return entry; // 兼容旧格式
    if (entry.penalty === 'dnf') return Infinity;
    if (entry.penalty === '+2') return entry.time + 2000;
    return entry.time;
}

/**
 * NOTE: 计算 Ao5 — 取最近 5 条成绩，排序去最好最差，取中间 3 条均值
 * 返回 ms 值，DNF 返回 Infinity，不足 5 条返回 null
 */
function computeAo5(history) {
    if (history.length < 5) return null;
    var last5 = history.slice(-5).map(getEffectiveTimeFromEntry);
    var sorted = [...last5].sort((a, b) => a - b);
    // NOTE: 2+ 个 DNF（Infinity）→ 整个 Ao5 = DNF
    var dnfCount = sorted.filter(t => t === Infinity).length;
    if (dnfCount >= 2) return Infinity;
    // 去掉最好（sorted[0]）和最差（sorted[4]），取中间 3 条均值
    return Math.round((sorted[1] + sorted[2] + sorted[3]) / 3);
}

/**
 * NOTE: 通用 Average（Ao12/Ao100）— 参考 DCTimer Stats.java averageOf 算法
 * n ≤ 20: 去掉最好最差各 1 个
 * n > 20: 去掉最好最差各 ceil(n/20) 个（WCA 标准 5% trim）
 */
function computeAverage(history, n) {
    if (history.length < n) return null;
    var lastN = history.slice(-n).map(getEffectiveTimeFromEntry);
    var trim = Math.ceil(n / 20);
    var sorted = [...lastN].sort((a, b) => a - b);
    var dnfCount = sorted.filter(t => t === Infinity).length;
    if (dnfCount > trim) return Infinity; // DNF 超过 trim 数量 → 整个 average = DNF
    // 去掉前 trim 个最好和后 trim 个最差
    var middle = sorted.slice(trim, n - trim);
    var sum = middle.reduce((a, b) => a + b, 0);
    return Math.round(sum / middle.length);
}

// ===== 高级统计函数 =====

/**
 * NOTE: Streak 追踪 — 连续低于阈值的成绩次数
 * @param {number[]} times - 有效时间数组（ms）
 * @param {number} threshold - 阈值（ms），默认为 session mean
 * @returns {{ current: number, best: number }}
 */
function computeStreak(times, threshold) {
    var current = 0, best = 0, streak = 0;
    for (var i = 0; i < times.length; i++) {
        if (times[i] !== Infinity && times[i] < threshold) {
            streak++;
            if (streak > best) best = streak;
        } else {
            streak = 0;
        }
    }
    current = streak;
    return { current: current, best: best };
}

/**
 * NOTE: 百分位表 — 计算低于各阈值的成绩占比
 * 自动生成 3~5 个有意义的阈值（基于 mean ± σ 向下取整到整秒/0.5秒）
 * @param {number[]} validTimes - 有效时间数组（ms，不含 DNF Infinity）
 * @returns {Array<{label: string, pct: number}>}
 */
function computeSubXBreakdown(validTimes) {
    if (validTimes.length < 5) return [];
    var mean = validTimes.reduce(function(a, b) { return a + b; }, 0) / validTimes.length;
    var variance = validTimes.reduce(function(s, t) { return s + (t - mean) * (t - mean); }, 0) / validTimes.length;
    var sd = Math.sqrt(variance);

    // NOTE: 生成阈值候选：mean-σ, mean-0.5σ, mean, mean+0.5σ, mean+σ
    var candidates = [mean - sd, mean - sd * 0.5, mean, mean + sd * 0.5, mean + sd];
    // 取整到最近的 "nice number"（基于数量级）
    var thresholds = [];
    var seen = {};
    for (var i = 0; i < candidates.length; i++) {
        var c = candidates[i];
        if (c <= 0) continue;
        // NOTE: 根据数量级选择取整精度
        var nice;
        if (c >= 60000) {
            nice = Math.round(c / 10000) * 10000; // 10s 精度（分钟级）
        } else if (c >= 10000) {
            nice = Math.round(c / 5000) * 5000; // 5s 精度
        } else if (c >= 5000) {
            nice = Math.round(c / 1000) * 1000; // 1s 精度
        } else {
            nice = Math.round(c / 500) * 500; // 0.5s 精度
        }
        if (nice <= 0) continue;
        var key = '' + nice;
        if (seen[key]) continue;
        seen[key] = true;
        var count = validTimes.filter(function(t) { return t < nice; }).length;
        var pct = Math.round(count / validTimes.length * 100);
        // NOTE: 只保留有区分度的阈值（0% < pct < 100%）
        if (pct > 0 && pct < 100) {
            thresholds.push({ threshold: nice, label: 'sub-' + formatTimePlain(nice), pct: pct });
        }
    }

    // 去重后取最多 4 个
    thresholds.sort(function(a, b) { return a.threshold - b.threshold; });
    return thresholds.slice(0, 4);
}

/**
 * NOTE: 检测第 index 条成绩是否为"截至当时"的 session best single
 * 用于历史列表中标记 PB
 */
function isPBSingleAt(history, index) {
    var effTime = getEffectiveTimeFromEntry(history[index]);
    if (effTime === Infinity) return false;
    for (var i = 0; i < index; i++) {
        var t = getEffectiveTimeFromEntry(history[i]);
        if (t <= effTime) return false;
    }
    return true;
}

/**
 * NOTE: 格式化相对日期（今天/昨天/具体日期）
 * @param {string} isoDate - ISO 8601 日期字符串
 * @returns {string}
 */
function formatRelativeDate(isoDate) {
    if (!isoDate) return '';
    var d = new Date(isoDate);
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var diff = Math.round((today - target) / 86400000);

    var timeStr = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');

    if (diff === 0) return timeStr;
    if (diff === 1) {
        var lang = getLocale();
        return (lang === 'zh' ? '昨天 ' : 'Yesterday ') + timeStr;
    }
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + timeStr;
}

function renderAo5(playerId) {
    var ao5 = computeAo5(state.players[playerId].solveHistory);
    var el = dom.ao5s[playerId];
    if (ao5 === null) {
        el.textContent = '';
    } else if (ao5 === Infinity) {
        el.textContent = 'ao5: DNF';
    } else {
        el.innerHTML = 'ao5: ' + formatTime(ao5);
    }
}

function renderScramble() {
    const lang = getLocale();
    const text = state.scrambleLoading
        ? `<span class="loading">${I18N_TEXT.generating[lang]}</span>`
        : (state.scramble || "");

    for (let i = 0; i < 2; i++) {
        dom.scrambles[i].innerHTML = text;
        const isTiming = state.players[i].isTiming;
        // NOTE: 计时中隐藏打乱文字和打乱图（JS 显式控制，不依赖 CSS 兄弟选择器）
        dom.scrambles[i].classList.toggle('hidden', isTiming);
        dom.scrambleImgs[i].classList.toggle('hidden', isTiming);
    }

    // NOTE: 打乱过长时自动缩小字号，防止与计时器/打乱图重叠
    autoFitScrambleSize();
}

/**
 * NOTE: 检测打乱文字是否过长导致遮挡计时器/打乱图，若过长则强制缩小字号
 * 策略：打乱文字最多占玩家区域高度的 40%，超出时逐步缩小 font-size
 * 通过 element.style.fontSize 直接设置，不修改 CSS 变量（不影响用户偏好）
 */
function autoFitScrambleSize() {
    for (let i = 0; i < 2; i++) {
        const el = dom.scrambles[i];
        // 先清除之前的强制字号，恢复为 CSS 变量控制的默认大小
        el.style.fontSize = '';

        // 隐藏状态或无内容时跳过
        if (el.classList.contains('hidden') || !state.scramble) continue;

        // NOTE: 打乱区域最多占玩家区域高度的 40%（留出计时器+统计行空间）
        const areaHeight = dom.areas[i].clientHeight;
        const maxHeight = areaHeight * 0.4;

        // 获取 CSS 计算出的基准字号（含用户 --scramble-scale 缩放）
        const baseFontSize = parseFloat(getComputedStyle(el).fontSize);
        let currentSize = baseFontSize;
        // NOTE: 最小缩到基准的 30%，避免完全不可读
        const minSize = baseFontSize * 0.3;

        // 逐步缩小直到文字高度 <= 允许的最大高度
        while (el.scrollHeight > maxHeight && currentSize > minSize) {
            currentSize *= 0.9;  // 每次减 10%
            el.style.fontSize = currentSize + 'px';
        }
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

    const trigger = dom.penalties[playerId].querySelector(".penalty-trigger");
    const label = trigger.querySelector(".penalty-label");
    const opts = dom.penalties[playerId].querySelectorAll(".penalty-option");

    // 更新触发按钮状态
    trigger.disabled = !enabled;
    // NOTE: 显示当前罚时类型，DNF 全大写区分
    label.textContent = p.penalty.toUpperCase();

    // 更新选项高亮
    opts.forEach(opt => {
        opt.classList.toggle("active", opt.dataset.penalty === p.penalty);
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
    if (isSolo()) {
        document.getElementById("btn-delete-last").disabled = state.players[0].solveHistory.length === 0;
    } else {
        const canDelete = state.players[0].hasFinished && state.players[1].hasFinished;
        document.getElementById("btn-delete-last").disabled = !canDelete;
    }
}

function closeSettings() {
    dom.settingsOverlay.classList.remove("visible");
}

/**
 * NOTE: 底部导航栏 tab 切换（仅 Solo 模式生效）
 * 通过 body[data-tab] 控制 CSS 显示/隐藏对应面板
 */
function switchTab(tabName) {
    // NOTE: 1v1 模式下不使用 tab 导航
    if (!isSolo()) return;

    document.body.dataset.tab = tabName;

    // 更新 active 状态
    document.querySelectorAll('.nav-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabName);
    });

    // NOTE: 切换到成绩 tab 时刷新数据
    if (tabName === 'results') {
        renderHistory();
        renderTrendChart();
        renderDistributionChart();
    }

    // NOTE: 切换到设置 tab 时同步按钮状态
    if (tabName === 'settings') {
        const lang = getLocale();
        const key = state.showTime ? 'hide_time' : 'show_time';
        document.getElementById('btn-toggle-time').textContent = I18N_TEXT[key][lang];
        document.getElementById('btn-delete-last').disabled = state.players[0].solveHistory.length === 0;
    }
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
    // p = 精确度（小数位数）
    const p = state.timerPrecision;
    if (ms <= 0) return p > 0 ? `0.${'0'.repeat(p)}` : '0';

    const totalMs = Math.floor(ms);
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const millis = totalMs % 1000;

    // NOTE: 根据精确度截取小数部分
    const millisStr = millis.toString().padStart(3, '0').slice(0, p);
    const frac = p > 0 ? `.${millisStr}` : '';

    if (minutes > 0) {
        return `${minutes}<span class="colon">:</span>${seconds.toString().padStart(2, '0')}${frac}`;
    }
    return `${seconds}${frac}`;
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

    // NOTE: 通过 CSS 变量传给 ::before 伪元素，使 opacity 只影响背景层
    if (img) {
        area.style.setProperty('--bg-image', `url(${img})`);
        area.style.setProperty('--bg-color', '');
    } else if (color && color !== '#000000') {
        area.style.setProperty('--bg-image', 'none');
        area.style.setProperty('--bg-color', color);
    } else {
        area.style.setProperty('--bg-image', 'none');
        area.style.setProperty('--bg-color', '');
    }

    // NOTE: 通过 CSS 变量控制背景不透明度（伪元素渲染，不影响前景文字）
    area.style.setProperty('--bg-opacity', state.bgOpacity);

    // NOTE: 根据背景亮度自动切换文字颜色（W3C 感知亮度）；图片背景取颜色选择器值作为代表色
    const repColor = color || '#000000';
    const lum = perceivedLuminance(repColor);
    // NOTE: 0.4 阈值（实测在浅灰 #a0a0a0 附近）：亮则黑字，暗则白/灰字
    area.style.setProperty('--player-text-color', lum > 0.4 ? '#111' : '');

    // NOTE: 同步更新中间栏渐变 — 左侧=P2(上方)色，右侧=P1(下方)色，中间混合暗色
    updateBarGradient();
}

/**
 * NOTE: 应用玩家的打乱文字自定义颜色
 * 有自定义值则设 --scramble-color，否则清空（退回 CSS 的 --player-text-color 自动计算）
 * 同时更新 A 按钮 label 的下划线颜色（--scramble-underline-color）给用户视觉反馈
 */
function applyScrambleColor(playerId) {
    const area = dom.areas[playerId];
    const saved = localStorage.getItem(`${LS_PREFIX}scramble_color_${playerId}`);
    if (saved) {
        area.style.setProperty('--scramble-color', saved);
    } else {
        area.style.removeProperty('--scramble-color');
    }
    // NOTE: 同步 A 按钮的下划线颜色（无自定义时用默认 #ccc）
    const label = document.getElementById(`scramble-color-label-${playerId}`);
    if (label) label.style.setProperty('--scramble-underline-color', saved || '#ccc');
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

        // NOTE: 打乱文字颜色 — 和背景控件共用同一循环（DRY）
        const savedScrambleColor = localStorage.getItem(`${LS_PREFIX}scramble_color_${i}`);
        if (savedScrambleColor) dom.scrambleColors[i].value = savedScrambleColor;
        applyScrambleColor(i);

        dom.scrambleColors[i].addEventListener('change', (e) => {
            localStorage.setItem(`${LS_PREFIX}scramble_color_${i}`, e.target.value);
            applyScrambleColor(i);
        });

        dom.scrambleColorResets[i].addEventListener('click', () => {
            localStorage.removeItem(`${LS_PREFIX}scramble_color_${i}`);
            dom.scrambleColors[i].value = '#cccccc';
            applyScrambleColor(i);
        });
    }
}

// ===== Solo 模式 =====

/**
 * NOTE: 应用模式布局 — body.solo class 控制 CSS 显隐
 * 切换模式时重置所有玩家状态
 */
function applyMode() {
    document.body.classList.toggle('solo', isSolo());
    // NOTE: 切换模式时重置到计时 tab
    switchTab('timer');
    // 重置玩家状态（但不清空历史）
    for (let i = 0; i < 2; i++) {
        const p = state.players[i];
        p.isReady = false;
        p.canStart = false;
        p.isTiming = false;
        p.hasFinished = false;
        p.inspectionPenalty = null;
        clearInspection(i);
        cancelAnimationFrame(p.rafId);
        p.pointerId = null;
        renderArea(i);
    }
    cancelReadyTimer();
    state.winner = -2;

    if (isSolo()) {
        // NOTE: Solo 模式 — 只显示 player 0 的统计
        renderSoloStats(0);
        // 隐藏 1v1 专属 UI
        const oppo0 = document.getElementById('opponent-0');
        if (oppo0) oppo0.textContent = '';
    } else {
        // NOTE: 1v1 模式 — 恢复 Ao5 显示
        renderAo5(0);
        renderAo5(1);
        renderScores();
    }
}

// ===== WCA Inspection 观察倒计时 =====

/**
 * NOTE: 参考 DCTimer DCTTimer.java L74-140
 * 可配置观察时长（8s/15s/∞），超时自动 +2/DNF
 * 语音提示在 8s 和 12s 时播报（如果 state.voice 开启）
 */
function startInspection(playerId) {
    const p = state.players[playerId];
    const limit = state.inspectionTime; // 秒
    p.isInspecting = true;
    p.inspectionStart = performance.now();
    p.inspectionPenalty = null;

    // NOTE: 语音播报标记，防止重复触发
    let voiced8 = false;
    let voiced12 = false;

    // NOTE: 添加观察状态 CSS class
    dom.areas[playerId].classList.add('state-inspecting');

    // NOTE: 每 100ms 更新倒计时显示
    p.inspectionTimer = setInterval(() => {
        const elapsed = (performance.now() - p.inspectionStart) / 1000;

        // NOTE: 语音提示（8s 和 12s 时）
        if (state.voice && elapsed >= 8 && !voiced8) {
            voiced8 = true;
            speakAlert('8 seconds');
        }
        if (state.voice && elapsed >= 12 && !voiced12) {
            voiced12 = true;
            speakAlert('12 seconds');
        }

        if (limit < 9999) {
            // NOTE: 有限时间模式（8s / 15s）— 上行计数显示已用秒数
            if (elapsed >= limit + 2) {
                // >limit+2s → 自动 DNF
                p.inspectionPenalty = 'dnf';
                dom.times[playerId].textContent = 'DNF';
                clearInspection(playerId);
                p.isInspecting = false;
                p.isReady = false;
                p.canStart = false;
                p.isTiming = false;
                p.hasFinished = true;
                p.time = 0;
                p.penalty = PENALTY.DNF;
                renderArea(playerId);
                checkBothFinished();
            } else if (elapsed >= limit) {
                // limit ~ limit+2s → +2 罚时标记
                p.inspectionPenalty = '+2';
                dom.times[playerId].textContent = '+2';
            } else {
                // NOTE: 从 0 开始上行计数（WCA 标准）
                dom.times[playerId].textContent = Math.floor(elapsed).toString();
            }
        } else {
            // NOTE: 无限模式 — 同样上行计数
            dom.times[playerId].textContent = Math.floor(elapsed).toString();
        }
    }, 100);
}

/**
 * NOTE: Web Speech API 语音播报（零依赖）
 * 根据页面语言自动切换中文/英文
 */
function speakAlert(text) {
    try {
        if ('speechSynthesis' in window) {
            const isZh = getLocale() === 'zh';
            // NOTE: 中文模式下翻译语音文本
            const zhMap = { '8 seconds': '八秒', '12 seconds': '十二秒' };
            const u = new SpeechSynthesisUtterance(isZh ? (zhMap[text] || text) : text);
            u.lang = isZh ? 'zh-CN' : 'en-US';
            u.rate = 1.2;
            u.volume = 0.8;
            speechSynthesis.speak(u);
        }
    } catch (_) {
        // NOTE: 不支持时静默失败
    }
}

/**
 * NOTE: 清除观察计时器和 CSS class
 */
function clearInspection(playerId) {
    const p = state.players[playerId];
    if (p.inspectionTimer) {
        clearInterval(p.inspectionTimer);
        p.inspectionTimer = null;
    }
    p.isInspecting = false;
    dom.areas[playerId].classList.remove('state-inspecting');
}

// ===== Solo 统计渲染 =====

/**
 * NOTE: Mo3 — 最近 3 次 Mean（不去最好最差，含 DNF 则 DNF）
 */
function computeMo3(history) {
    if (history.length < 3) return null;
    var last3 = history.slice(-3).map(getEffectiveTimeFromEntry);
    if (last3.some(t => t === Infinity)) return Infinity;
    return Math.round((last3[0] + last3[1] + last3[2]) / 3);
}

/**
 * NOTE: 遍历所有历史，找出 session best average/ao5（最小非 null 非 Infinity 值）
 * @param {Array} history - 完整历史
 * @param {Function} computeFn - computeAo5 或 (h) => computeAverage(h, n)
 * @returns {number|null} 最佳值，或 null
 */
function findBestAverage(history, computeFn) {
    let best = null;
    for (let i = computeFn === computeAo5 ? 5 : 12; i <= history.length; i++) {
        const val = computeFn(history.slice(0, i));
        if (val !== null && val !== Infinity) {
            if (best === null || val < best) best = val;
        }
    }
    return best;
}

/**
 * NOTE: Solo 模式下替代 renderAo5 — 在 ao5-display 位置显示更丰富的统计
 * 参考 DCTimer Stats.java sessionMean + sessionAvg + PB 标记
 */
function renderSoloStats(playerId) {
    const el = dom.ao5s[playerId];
    const h = state.players[playerId].solveHistory;

    if (h.length === 0) {
        el.textContent = '';
        return;
    }

    // NOTE: 计算各项统计
    const times = h.map(getEffectiveTimeFromEntry);
    const validTimes = times.filter(t => t !== Infinity);
    const solveCount = h.length;
    const dnfCount = times.filter(t => t === Infinity).length;

    // Best / Worst
    const best = validTimes.length > 0 ? Math.min(...validTimes) : null;

    // Session Mean（不含 DNF）
    const mean = validTimes.length > 0
        ? Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length)
        : null;

    // 标准差 σ 和 变异系数 CV
    let sdStr = '', cvStr = '';
    if (validTimes.length > 1 && mean !== null) {
        const variance = validTimes.reduce((s, t) => s + (t - mean) * (t - mean), 0) / validTimes.length;
        const sd = Math.sqrt(variance) / 1000;
        sdStr = `σ=${sd.toFixed(2)}`;
        // NOTE: CV = σ/μ × 100%，衡量一致性（消除了 mean 差异的影响）
        const cv = (Math.sqrt(variance) / mean * 100).toFixed(0);
        cvStr = `cv=${cv}%`;
    }

    // NOTE: Streak 追踪 — 连续低于 mean 的次数
    let streakStr = '';
    if (mean !== null && validTimes.length >= 5) {
        const streak = computeStreak(times, mean);
        if (streak.best > 1) {
            streakStr = `🔥${streak.current}/${streak.best}`;
        }
    }

    // NOTE: BLD 成功率追踪
    let bldStr = '';
    if (isBLD()) {
        const successCount = validTimes.length;
        const totalCount = solveCount;
        const pct = Math.round(successCount / totalCount * 100);
        bldStr = `✓${successCount}/${totalCount}(${pct}%)`;
    }

    // NOTE: 动态计算用户启用的所有 Average
    const mo3 = computeMo3(h);

    // NOTE: 构建统计文本 — 第一行（Averages）
    const parts = [];
    if (mo3 !== null) parts.push(`<span class="stat-item">mo3: ${mo3 === Infinity ? 'DNF' : formatTimePlain(mo3)}</span>`);

    for (const n of state.enabledAverages) {
        const aoFn = n === 5 ? computeAo5 : (sub) => computeAverage(sub, n);
        const val = n === 5 ? computeAo5(h) : computeAverage(h, n);
        if (val === null) continue;
        // NOTE: 只对 ao5/ao12 显示 PB 标记（更大的 Ao 计算 best 太慢）
        let pbMark = '';
        if (n <= 12) {
            const bestVal = findBestAverage(h, aoFn);
            if (val !== Infinity && bestVal !== null && val <= bestVal) pbMark = ' \u{1F3C5}';
        }
        // NOTE: 包装成可点击的 span，data-ao 属性用于弹窗
        parts.push(`<span class="stat-item stat-ao" data-ao="${n}">ao${n}: ${val === Infinity ? 'DNF' : formatTimePlain(val)}${pbMark}</span>`);
    }

    const line1 = parts.join(' <span class="stat-sep">│</span> ');

    // NOTE: 第二行（统计概览）
    const line2Parts = [];
    if (best !== null) line2Parts.push(`best: ${formatTimePlain(best)}`);
    if (mean !== null) line2Parts.push(`mean: ${formatTimePlain(mean)}`);
    if (sdStr) line2Parts.push(sdStr);
    if (cvStr) line2Parts.push(cvStr);
    if (streakStr) line2Parts.push(streakStr);
    if (bldStr) line2Parts.push(bldStr);
    line2Parts.push(`${solveCount - dnfCount}/${solveCount}`);

    const line2 = line2Parts.join(' │ ');
    el.innerHTML = `<div class="solo-stats-display">${line1}${line1 ? '<br>' : ''}${line2}</div>`;

    // NOTE: 为 ao 统计项绑定点击事件 → 弹出详情
    el.querySelectorAll('.stat-ao').forEach(span => {
        span.style.cursor = 'pointer';
        span.addEventListener('click', (e) => {
            e.stopPropagation();
            const aoN = parseInt(span.dataset.ao);
            showAoDetail(aoN);
        });
    });
}

/**
 * NOTE: 纯文本时间格式化（不含 HTML span，用于统计显示）
 */
function formatTimePlain(ms) {
    const p = state.timerPrecision;
    if (ms <= 0) return p > 0 ? `0.${'0'.repeat(p)}` : '0';
    if (ms === Infinity) return 'DNF';
    const totalMs = Math.floor(ms);
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const millis = totalMs % 1000;
    const millisStr = millis.toString().padStart(3, '0').slice(0, p);
    const frac = p > 0 ? `.${millisStr}` : '';
    if (minutes > 0) {
        return `${minutes}:${seconds.toString().padStart(2, '0')}${frac}`;
    }
    return `${seconds}${frac}`;
}

// ===== Solo 数据持久化 =====

/**
 * NOTE: 以 puzzleId 为 key 保存/恢复 Solo 模式成绩历史
 * 每个项目独立存储，最多保存 1000 条（超出删除最早的）
 */
function saveSolveHistory() {
    const key = `${LS_PREFIX}solo_history_${state.sessionId}_${state.puzzleId}`;
    const h = state.players[0].solveHistory;
    // NOTE: 限制最多 1000 条
    const toSave = h.length > 1000 ? h.slice(-1000) : h;
    try {
        localStorage.setItem(key, JSON.stringify(toSave));
    } catch (e) {
        console.warn('Failed to save solve history:', e);
    }
    // NOTE: 已登录时自动推送云端（debounce 2 秒）
    debouncePushCloud();
}

function loadSolveHistory() {
    if (!isSolo()) return;
    const key = `${LS_PREFIX}solo_history_${state.sessionId}_${state.puzzleId}`;
    try {
        const data = localStorage.getItem(key);
        if (data) {
            state.players[0].solveHistory = JSON.parse(data);
        }
    } catch (e) {
        console.warn('Failed to load solve history:', e);
    }
}

// ===== 成绩历史面板 =====

function openHistory() {
    if (isAnyActive()) return;
    renderHistory();
    renderTrendChart();
    renderDistributionChart();
    dom.historyOverlay.classList.add('visible');
}

function closeHistory() {
    dom.historyOverlay.classList.remove('visible');
}

/**
 * NOTE: 渲染成绩历史列表（最新在上）
 * 每条带 🗑️ 删除按钮，盲拧条目显示 memo 时间
 */
function renderHistory() {
    const h = state.players[0].solveHistory;
    const listEl = dom.historyList;
    const statsEl = dom.historyStats;

    // NOTE: Undo 按钮显隐
    document.getElementById('history-undo').style.display = state.undoStack.length > 0 ? '' : 'none';

    if (h.length === 0) {
        listEl.innerHTML = '<div class="history-empty">No solves yet</div>';
        statsEl.textContent = '';
        return;
    }

    // NOTE: 统计摘要
    const times = h.map(getEffectiveTimeFromEntry);
    const validTimes = times.filter(t => t !== Infinity);
    const best = validTimes.length > 0 ? Math.min(...validTimes) : null;
    const worst = validTimes.length > 0 ? Math.max(...validTimes) : null;
    const bestIdx = best !== null ? times.indexOf(best) : -1;
    const worstIdx = worst !== null ? times.lastIndexOf(worst) : -1;

    statsEl.textContent = `${h.length} solves`;

    // NOTE: 百分位 chip 栏（sub-X %）
    const subXData = computeSubXBreakdown(validTimes);
    let subXHtml = '';
    if (subXData.length > 0) {
        subXHtml = '<div class="subx-chip-bar">';
        subXData.forEach(function(d) {
            subXHtml += `<span class="subx-chip">${d.label}: ${d.pct}%</span>`;
        });
        subXHtml += '</div>';
    }

    // NOTE: 生成列表 HTML（最新在上）
    let html = subXHtml;
    for (let i = h.length - 1; i >= 0; i--) {
        const entry = h[i];
        const effTime = getEffectiveTimeFromEntry(entry);
        const timeStr = effTime === Infinity ? 'DNF' : formatTimePlain(effTime);

        // CSS class 标记
        let timeClass = 'h-time';
        if (i === bestIdx) timeClass += ' h-best';
        else if (i === worstIdx) timeClass += ' h-worst';
        if (entry.penalty === '+2') timeClass += ' h-plus2';
        else if (entry.penalty === 'dnf') timeClass += ' h-dnf';

        // NOTE: PB 标记 — 截至当时的 session best
        let pbMark = '';
        if (isPBSingleAt(h, i)) {
            pbMark = ' <span class="h-pb" title="PB">🏆</span>';
        }

        // 滚动 Ao5
        const ao5 = i >= 4 ? computeAo5(h.slice(0, i + 1)) : null;
        const ao5Str = ao5 === null ? '' : (ao5 === Infinity ? 'DNF' : formatTimePlain(ao5));

        const scramble = typeof entry === 'object' ? (entry.scramble || '') : '';
        // NOTE: 日期显示
        const dateStr = typeof entry === 'object' && entry.date ? formatRelativeDate(entry.date) : '';

        // NOTE: 多阶段分段显示
        let phaseStr = '';
        if (entry.phases && entry.phases.length > 1) {
            const labels = entry.phases.map((t, j) => {
                const delta = j === 0 ? t : t - entry.phases[j - 1];
                const label = isBLD() && j === 0 ? 'memo' : `P${j + 1}`;
                return `${label}:${formatTimePlain(delta)}`;
            });
            phaseStr = ` <span class="h-memo">[${labels.join(' ')}]</span>`;
        } else if (entry.memo && entry.memo > 0) {
            // NOTE: 兼容旧数据格式
            phaseStr = ` <span class="h-memo">[memo: ${formatTimePlain(entry.memo)}]</span>`;
        }

        html += `<div class="history-item" data-idx="${i}">
            <span class="h-idx">${i + 1}.</span>
            <span class="${timeClass}">${timeStr}${phaseStr}${pbMark}</span>
            <span class="h-ao5">${ao5Str}</span>
            <span class="h-date">${dateStr}</span>
            <button class="h-delete" data-delidx="${i}" title="Delete">🗑️</button>
            <span class="h-scramble">${scramble}</span>
        </div>`;
    }
    listEl.innerHTML = html;

    // NOTE: 点击展开/收起打乱
    listEl.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // 不在删除按钮上才 toggle
            if (e.target.closest('.h-delete')) return;
            item.classList.toggle('expanded');
        });
    });

    // NOTE: 删除按钮事件
    listEl.querySelectorAll('.h-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.delidx);
            deleteSolve(idx);
        });
    });
}

/**
 * NOTE: 删除指定索引的成绩，保存到 undoStack
 */
function deleteSolve(idx) {
    const h = state.players[0].solveHistory;
    if (idx < 0 || idx >= h.length) return;
    const entry = h.splice(idx, 1)[0];
    state.undoStack.push({ index: idx, entry });
    saveSolveHistory();
    renderSoloStats(0);
    renderHistory();
}

/**
 * NOTE: 撤销最近一次删除
 */
function undoDelete() {
    if (state.undoStack.length === 0) return;
    const { index, entry } = state.undoStack.pop();
    const h = state.players[0].solveHistory;
    // NOTE: 插回原位（如果索引超范围则追加到末尾）
    h.splice(Math.min(index, h.length), 0, entry);
    saveSolveHistory();
    renderSoloStats(0);
    renderHistory();
}

/**
 * NOTE: 导出成绩为 CSV 文件下载
 * 列：#, Time, Penalty, Ao5, Scramble, Date, Memo(BLD)
 */
function exportCSV() {
    const h = state.players[0].solveHistory;
    if (h.length === 0) return;

    const header = '#,Time(ms),Penalty,Ao5,Scramble,Date,Memo(ms)';
    const rows = h.map((entry, i) => {
        const effTime = getEffectiveTimeFromEntry(entry);
        const timeStr = effTime === Infinity ? 'DNF' : formatTimePlain(effTime);
        const ao5 = i >= 4 ? computeAo5(h.slice(0, i + 1)) : null;
        const ao5Str = ao5 === null ? '' : (ao5 === Infinity ? 'DNF' : formatTimePlain(ao5));
        const scramble = typeof entry === 'object' ? (entry.scramble || '').replace(/,/g, ';') : '';
        const date = typeof entry === 'object' ? (entry.date || '') : '';
        const memo = entry.memo ? formatTimePlain(entry.memo) : '';
        const penalty = typeof entry === 'object' ? (entry.penalty || 'ok') : 'ok';
        return `${i + 1},${timeStr},${penalty},${ao5Str},"${scramble}",${date},${memo}`;
    });

    const csv = header + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solves_${state.puzzleId}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ===== Session 管理 =====

function saveSessions() {
    localStorage.setItem(LS_PREFIX + 'sessions', JSON.stringify(state.sessions));
    localStorage.setItem(LS_PREFIX + 'sessionId', state.sessionId);
}

function renderSessionList() {
    const sel = dom.selectSession;
    sel.innerHTML = '';
    for (const s of state.sessions) {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        if (s.id === state.sessionId) opt.selected = true;
        sel.appendChild(opt);
    }
}

function switchSession(newId) {
    if (newId === state.sessionId) return;
    // NOTE: 保存当前 session 的历史
    saveSolveHistory();
    state.sessionId = newId;
    saveSessions();
    // 清空内存中的历史并加载新 session
    state.players[0].solveHistory = [];
    state.undoStack = [];
    loadSolveHistory();
    renderSoloStats(0);
    renderSessionList();
}

function newSession() {
    // NOTE: 自增 ID（取现有最大 ID + 1）
    const maxId = Math.max(...state.sessions.map(s => parseInt(s.id) || 0));
    const newId = (maxId + 1).toString();
    const name = prompt('Session name:', `Session ${newId}`);
    if (!name) return;
    state.sessions.push({ id: newId, name });
    // 切换到新 session
    saveSolveHistory(); // 保存当前
    state.sessionId = newId;
    state.players[0].solveHistory = [];
    state.undoStack = [];
    saveSessions();
    renderSoloStats(0);
    renderSessionList();
}

function renameSession() {
    const current = state.sessions.find(s => s.id === state.sessionId);
    if (!current) return;
    const name = prompt('Rename session:', current.name);
    if (!name) return;
    current.name = name;
    saveSessions();
    renderSessionList();
}

function deleteSession() {
    if (state.sessions.length <= 1) {
        alert('Cannot delete the last session');
        return;
    }
    const current = state.sessions.find(s => s.id === state.sessionId);
    if (!confirm(`Delete "${current.name}" and all its data?`)) return;

    // NOTE: 清理此 session 在所有 puzzle 下的 localStorage 数据
    for (const puz of PUZZLES) {
        localStorage.removeItem(`${LS_PREFIX}solo_history_${state.sessionId}_${puz.id}`);
    }

    state.sessions = state.sessions.filter(s => s.id !== state.sessionId);
    state.sessionId = state.sessions[0].id;
    state.players[0].solveHistory = [];
    state.undoStack = [];
    loadSolveHistory();
    saveSessions();
    renderSoloStats(0);
    renderSessionList();
}

// ===== 趋势图表 =====

/**
 * NOTE: 纯 SVG 折线图（零依赖），在历史面板顶部显示
 * X轴=序号，Y轴=时间(ms)，叠加 Ao5 线
 * Best 点绿色，worst 点红色
 */
function renderTrendChart() {
    const h = state.players[0].solveHistory;
    const existing = document.getElementById('trend-chart-container');
    if (existing) existing.remove();

    if (h.length < 2) return; // 至少 2 条才画图

    const times = h.map(getEffectiveTimeFromEntry);
    // NOTE: DNF 不画点（过滤 Infinity）
    const validPairs = [];
    times.forEach((t, i) => { if (t !== Infinity) validPairs.push({ i, t }); });
    if (validPairs.length < 2) return;

    // NOTE: 趋势图宽高（viewBox 自适应，实际通过 CSS max-width 缩放）
    const W = 600, H = 200, PAD = 24;
    const minT = Math.min(...validPairs.map(p => p.t));
    const maxT = Math.max(...validPairs.map(p => p.t));
    const rangeT = maxT - minT || 1;
    const n = h.length;

    // 坐标转换
    const x = (idx) => PAD + (idx / (n - 1)) * (W - 2 * PAD);
    const y = (t) => PAD + (1 - (t - minT) / rangeT) * (H - 2 * PAD);

    // 折线路径
    let pathD = '';
    validPairs.forEach((p, j) => {
        pathD += `${j === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.t).toFixed(1)} `;
    });

    // NOTE: 各 Ao 类型的颜色映射
    const AO_COLORS = { 5: '#ff9800', 12: '#e040fb', 50: '#00e5ff', 100: '#76ff03', 1000: '#ffeb3b', 10000: '#ff5252' };
    const AO_DASH   = { 5: '4,2',     12: '6,3',     50: '2,2',     100: '8,4',     1000: '3,5',     10000: '1,3' };

    // NOTE: 为每个启用的 Ao 类型计算趋势线路径
    let aoSvgPaths = '';
    for (const aoN of state.enabledAverages) {
        let aoPath = '';
        for (let i = aoN - 1; i < h.length; i++) {
            const sub = h.slice(0, i + 1);
            const val = aoN === 5 ? computeAo5(sub) : computeAverage(sub, aoN);
            if (val !== null && val !== Infinity) {
                aoPath += `${aoPath ? 'L' : 'M'}${x(i).toFixed(1)},${y(val).toFixed(1)} `;
            }
        }
        if (aoPath) {
            const color = AO_COLORS[aoN] || '#ff9800';
            const dash = AO_DASH[aoN] || '4,2';
            aoSvgPaths += `<path d="${aoPath}" fill="none" stroke="${color}" stroke-width="1" stroke-dasharray="${dash}"/>`;
        }
    }

    // Best/Worst 点
    const bestT = Math.min(...validPairs.map(p => p.t));
    const worstT = Math.max(...validPairs.map(p => p.t));
    const bestPt = validPairs.find(p => p.t === bestT);
    const worstPt = validPairs.find(p => p.t === worstT);

    let svg = `<svg viewBox="0 0 ${W} ${H}" class="trend-svg">
        <path d="${pathD}" fill="none" stroke="#4fc3f7" stroke-width="1.5"/>
        ${aoSvgPaths}
        ${bestPt ? `<circle cx="${x(bestPt.i)}" cy="${y(bestPt.t)}" r="3" fill="#4caf50"/>` : ''}
        ${worstPt ? `<circle cx="${x(worstPt.i)}" cy="${y(worstPt.t)}" r="3" fill="#f44336"/>` : ''}
    </svg>`;

    // NOTE: Ao 选择器（chip 按钮）
    const ALL_AO_CHART = [5, 12, 50, 100, 1000, 10000];
    let chipHtml = '<div class="ao-chip-bar">';
    for (const n of ALL_AO_CHART) {
        const active = state.enabledAverages.includes(n);
        const color = AO_COLORS[n] || '#ff9800';
        chipHtml += `<button class="ao-chip${active ? ' active' : ''}" data-ao="${n}" style="--chip-color:${color}">ao${n}</button>`;
    }
    chipHtml += '</div>';

    // NOTE: 动态图例（只显示启用的 Ao 线）
    let legendHtml = '<div class="trend-legend">';
    legendHtml += '<span><svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="#4fc3f7" stroke-width="1.5"/></svg> Single</span>';
    for (const n of state.enabledAverages) {
        const color = AO_COLORS[n] || '#ff9800';
        const dash = AO_DASH[n] || '4,2';
        legendHtml += `<span><svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="${color}" stroke-width="1" stroke-dasharray="${dash}"/></svg> Ao${n}</span>`;
    }
    legendHtml += '<span><svg width="8" height="8"><circle cx="4" cy="4" r="3" fill="#4caf50"/></svg> Best</span>';
    legendHtml += '<span><svg width="8" height="8"><circle cx="4" cy="4" r="3" fill="#f44336"/></svg> Worst</span>';
    legendHtml += '</div>';

    const container = document.createElement('div');
    container.id = 'trend-chart-container';
    container.className = 'trend-chart';
    container.innerHTML = chipHtml + svg + legendHtml;

    // NOTE: Ao chip 点击事件
    container.querySelectorAll('.ao-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const aoN = parseInt(chip.dataset.ao);
            const idx = state.enabledAverages.indexOf(aoN);
            if (idx >= 0) {
                state.enabledAverages.splice(idx, 1);
            } else {
                state.enabledAverages.push(aoN);
                state.enabledAverages.sort((a, b) => a - b);
            }
            localStorage.setItem(LS_PREFIX + 'enabledAverages', JSON.stringify(state.enabledAverages));
            renderHistory();
        });
    });

    dom.historyList.parentNode.insertBefore(container, dom.historyList);
}

// ===== 分布图（直方图 + KDE） =====

// ===== Ao 详情弹窗 =====

/**
 * NOTE: 显示 AoN 详情弹窗 — 展示构成该 Average 的 N 条成绩
 * 标记被去掉的最好（↓ trim）和最差（↑ trim）条目
 */
function showAoDetail(aoN) {
    const h = state.players[0].solveHistory;
    if (h.length < aoN) return;

    const lastN = h.slice(-aoN);
    const effTimes = lastN.map(getEffectiveTimeFromEntry);
    const sorted = [...effTimes].sort((a, b) => a - b);
    const trim = Math.ceil(aoN / 20); // NOTE: 与 computeAverage 保持一致

    // NOTE: 标记哪些条目被 trim 了
    const trimmedLow = []; // 被去掉的最好条目索引
    const trimmedHigh = []; // 被去掉的最差条目索引
    const sortedCopy = [...sorted];
    // 找低端 trim
    for (let t = 0; t < trim; t++) {
        const idx = effTimes.indexOf(sortedCopy[t]);
        // 避免重复标记同一索引
        if (!trimmedLow.includes(idx)) trimmedLow.push(idx);
    }
    // 找高端 trim
    for (let t = 0; t < trim; t++) {
        const val = sortedCopy[sortedCopy.length - 1 - t];
        for (let k = effTimes.length - 1; k >= 0; k--) {
            if (effTimes[k] === val && !trimmedHigh.includes(k) && !trimmedLow.includes(k)) {
                trimmedHigh.push(k);
                break;
            }
        }
    }

    // 计算 Average 值
    const aoVal = aoN === 5 ? computeAo5(h) : computeAverage(h, aoN);
    const aoStr = aoVal === null ? '-' : (aoVal === Infinity ? 'DNF' : formatTimePlain(aoVal));

    let html = `<div class="ao-detail-overlay">
        <div class="ao-detail-panel">
            <div class="ao-detail-header">
                <h3>Ao${aoN}: ${aoStr}</h3>
                <button class="ao-detail-close">✕</button>
            </div>
            <div class="ao-detail-list">`;

    for (let i = 0; i < lastN.length; i++) {
        const entry = lastN[i];
        const effTime = effTimes[i];
        const timeStr = effTime === Infinity ? 'DNF' : formatTimePlain(effTime);
        let marker = '', cls = '';
        if (trimmedLow.includes(i)) {
            marker = ' ↓';  // NOTE: 被去掉的最好
            cls = ' ao-trimmed-best';
        } else if (trimmedHigh.includes(i)) {
            marker = ' ↑';  // NOTE: 被去掉的最差
            cls = ' ao-trimmed-worst';
        }
        const globalIdx = h.length - aoN + i;
        html += `<div class="ao-detail-item${cls}">
            <span class="ao-detail-idx">${globalIdx + 1}.</span>
            <span class="ao-detail-time">${timeStr}${marker}</span>
        </div>`;
    }

    html += '</div></div></div>';

    // NOTE: 插入到 body 顶层
    const container = document.createElement('div');
    container.innerHTML = html;
    const overlay = container.firstElementChild;
    document.body.appendChild(overlay);

    // 关闭按钮 + 遮罩点击关闭
    overlay.querySelector('.ao-detail-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

// ===== 里程碑庆祝系统 =====

/**
 * NOTE: 在成绩保存后调用，检测 PB / 里程碑 / sub-X 突破
 * 触发 confetti + 提示文字
 */
function checkMilestone() {
    const h = state.players[0].solveHistory;
    if (h.length === 0) return;

    const lastEntry = h[h.length - 1];
    const effTime = getEffectiveTimeFromEntry(lastEntry);
    const messages = [];

    // NOTE: PB single 检测
    if (effTime !== Infinity && isPBSingleAt(h, h.length - 1)) {
        messages.push('🏆 New PB!');
    }

    // NOTE: PB ao5 检测
    if (h.length >= 5) {
        const ao5 = computeAo5(h);
        if (ao5 !== null && ao5 !== Infinity) {
            const bestAo5 = findBestAverage(h, computeAo5);
            if (bestAo5 !== null && ao5 <= bestAo5) {
                messages.push('🥇 New PB Ao5!');
            }
        }
    }

    // NOTE: PB ao12 检测
    if (h.length >= 12) {
        const ao12 = computeAverage(h, 12);
        if (ao12 !== null && ao12 !== Infinity) {
            const bestAo12 = findBestAverage(h, (sub) => computeAverage(sub, 12));
            if (bestAo12 !== null && ao12 <= bestAo12) {
                messages.push('🥇 New PB Ao12!');
            }
        }
    }

    // NOTE: 整数里程碑（100, 200, 500, 1000...）
    const count = h.length;
    if (count === 100 || count === 200 || count === 500 || count === 1000 ||
        count === 2000 || count === 5000 || count === 10000) {
        messages.push(`🎯 ${count} solves!`);
    }

    if (messages.length > 0) {
        // 触发 confetti 特效
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 80,
                spread: 70,
                origin: { y: 0.6 },
            });
        }
        // NOTE: 触觉反馈（PB 专用节奏：短-短-长）
        if (navigator.vibrate) {
            navigator.vibrate([50, 50, 100]);
        }
        // 显示提示文字
        showMilestoneToast(messages.join(' '));
    }
}

/**
 * NOTE: 临时 toast 提示（3 秒后自动消失）
 */
function showMilestoneToast(text) {
    const toast = document.createElement('div');
    toast.className = 'milestone-toast';
    toast.textContent = text;
    document.body.appendChild(toast);
    // 触发入场动画
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== 疲劳预警 =====

/**
 * NOTE: 检测最近 10 把是否呈上升趋势（疲劳信号）
 * 连续 5 把滚动均值递增 → 温和提示休息
 */
function checkFatigue() {
    const h = state.players[0].solveHistory;
    if (h.length < 15) return; // 至少 15 把才有分析意义

    const times = h.slice(-10).map(getEffectiveTimeFromEntry).filter(t => t !== Infinity);
    if (times.length < 8) return; // 太多 DNF 不分析

    // NOTE: 计算 5 把滑动均值
    let rising = 0;
    for (let i = 0; i <= times.length - 5; i++) {
        const avg = (times[i] + times[i+1] + times[i+2] + times[i+3] + times[i+4]) / 5;
        if (i > 0) {
            const prevAvg = (times[i-1] + times[i] + times[i+1] + times[i+2] + times[i+3]) / 5;
            if (avg > prevAvg) rising++;
        }
    }

    // NOTE: 连续上升趋势超过阈值 → 提示休息
    if (rising >= 4) {
        const lang = getLocale();
        showMilestoneToast(lang === 'zh' ? '建议休息一下 🍵' : 'Take a break? 🍵');
    }
}

function renderDistributionChart() {
    // NOTE: DistributionChart 由 distribution_chart.js 暴露的全局 API
    if (typeof DistributionChart === 'undefined') return;

    // 销毁旧实例
    if (_distChartInstance) {
        _distChartInstance.destroy();
        _distChartInstance = null;
    }

    const h = state.players[0].solveHistory;
    // NOTE: 过滤 DNF，转 ms→秒
    const validTimes = h
        .map(getEffectiveTimeFromEntry)
        .filter(t => t !== Infinity)
        .map(t => t / 1000);

    // NOTE: 至少 5 条有效成绩才渲染（太少画不出有意义的分布）
    if (validTimes.length < 5) return;

    // 找到插入点：趋势图容器之后，成绩列表之前
    var anchor = document.getElementById('trend-chart-container');
    var insertTarget = anchor ? anchor.nextSibling : dom.historyList;

    // 创建容器
    var container = document.createElement('div');
    container.id = 'dist-chart-wrapper';
    dom.historyList.parentNode.insertBefore(container, insertTarget);

    // NOTE: 构建数据集 — 单人模式，只有一个数据集
    var puzzleName = PUZZLES.find(p => p.id === state.puzzleId);
    var label = puzzleName ? (getLocale() === 'zh' ? puzzleName.name.zh : puzzleName.name.en) : state.puzzleId;

    _distChartInstance = DistributionChart.create(container, [{
        name: label,
        times: validTimes,
        color: '#00d2ff'
    }]);
}

// ===== WCA 登录 UI + 云同步 =====

/** NOTE: 更新设置面板中的 WCA 登录状态显示 */
function updateWcaAuthUI() {
    if (typeof WcaAuth === 'undefined') return;
    const user = WcaAuth.getUser();
    const loginRow = document.getElementById('wca-login-row');
    const userRow = document.getElementById('wca-user-row');
    if (user) {
        loginRow.style.display = 'none';
        userRow.style.display = 'flex';
        document.getElementById('wca-avatar').src = user.avatar || '';
        document.getElementById('wca-name').textContent = user.name || user.wcaId;
    } else {
        loginRow.style.display = '';
        userRow.style.display = 'none';
    }
}

// NOTE: Debounce 定时器，避免每次 save 都立即 push
let _pushTimer = null;
function debouncePushCloud() {
    if (typeof WcaAuth === 'undefined' || !WcaAuth.isLoggedIn()) return;
    clearTimeout(_pushTimer);
    _pushTimer = setTimeout(() => pushToCloud(), 2000);
}

/**
 * NOTE: 构建 API 基地址
 * localhost 时直接用 toolkit.cuberoot.me（PHP API 不在本地）
 */
function getApiBase() {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        return 'https://toolkit.cuberoot.me/recon/api/';
    }
    return '/recon/api/';
}

/** NOTE: 推送当前 session + puzzle 的成绩到云端 */
function pushToCloud() {
    if (typeof WcaAuth === 'undefined' || !WcaAuth.isLoggedIn()) return;
    if (!isSolo()) return;
    const token = WcaAuth.getAccessToken();
    if (!token) return;

    const h = state.players[0].solveHistory;
    fetch(getApiBase() + '?action=timerSync', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
            sessionId: state.sessionId,
            puzzleId: state.puzzleId,
            solves: h
        })
    }).then(r => {
        if (!r.ok) console.warn('Cloud push failed:', r.status);
    }).catch(e => console.warn('Cloud push error:', e));
}

/** NOTE: 从云端拉取所有 session 的成绩并合并到 localStorage */
function pullFromCloud() {
    if (typeof WcaAuth === 'undefined' || !WcaAuth.isLoggedIn()) return;
    const token = WcaAuth.getAccessToken();
    if (!token) return;

    fetch(getApiBase() + '?action=timerSync', {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    })
    .then(data => {
        if (!Array.isArray(data)) return;
        // NOTE: 云端数据覆盖 localStorage（服务端为 source of truth）
        data.forEach(item => {
            const key = `${LS_PREFIX}solo_history_${item.sessionId}_${item.puzzleId}`;
            if (Array.isArray(item.solves)) {
                localStorage.setItem(key, JSON.stringify(item.solves));
            }
        });
        // NOTE: 刷新当前显示的历史
        loadSolveHistory();
        renderSoloStats(0);
    })
    .catch(e => console.warn('Cloud pull error:', e));
}

/** NOTE: 手动同步 — 推送所有 session 的成绩到云端 */
function syncAllSessions() {
    if (typeof WcaAuth === 'undefined' || !WcaAuth.isLoggedIn()) return;
    const token = WcaAuth.getAccessToken();
    if (!token) return;

    // NOTE: 遍历 localStorage 找到所有 solo_history_ 开头的 key
    const prefix = LS_PREFIX + 'solo_history_';
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith(prefix)) keys.push(k);
    }

    // NOTE: 逐个推送（串行避免并发过多）
    let chain = Promise.resolve();
    keys.forEach(k => {
        // key 格式: battle_solo_history_{sessionId}_{puzzleId}
        const rest = k.substring(prefix.length);
        const lastUnderscore = rest.lastIndexOf('_');
        if (lastUnderscore < 0) return;
        const sessId = rest.substring(0, lastUnderscore);
        const puzzId = rest.substring(lastUnderscore + 1);
        const solves = JSON.parse(localStorage.getItem(k) || '[]');

        chain = chain.then(() =>
            fetch(getApiBase() + '?action=timerSync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ sessionId: sessId, puzzleId: puzzId, solves })
            }).catch(e => console.warn('Sync push error:', e))
        );
    });

    chain.then(() => {
        // NOTE: 同步完成后也拉取一下（双向同步）
        pullFromCloud();
    });
}

// ===== Sprint 3: Tab 左右滑动切换 =====

/**
 * NOTE: 监听触摸手势实现 Tab 滑动切换（Solo 模式，非计时状态）
 * 水平滑动 > 50px 切换相邻 tab
 */
function initSwipeGesture() {
    const TAB_ORDER = ['timer', 'results', 'settings'];
    let startX = 0, startY = 0;

    document.body.addEventListener('touchstart', function(e) {
        if (!isSolo() || isAnyActive()) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, { passive: true });

    document.body.addEventListener('touchend', function(e) {
        if (!isSolo() || isAnyActive()) return;
        // NOTE: 历史 overlay 打开时不处理
        if (dom.historyOverlay.classList.contains('visible')) return;

        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;

        // NOTE: 水平距离 > 50px 且角度足够水平（避免和垂直滚动冲突）
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            const curTab = document.body.dataset.tab || 'timer';
            const curIdx = TAB_ORDER.indexOf(curTab);
            const nextIdx = dx < 0 ? curIdx + 1 : curIdx - 1; // 左滑 → 下一个 tab
            if (nextIdx >= 0 && nextIdx < TAB_ORDER.length) {
                switchTab(TAB_ORDER[nextIdx]);
            }
        }
    }, { passive: true });
}

// ===== Sprint 3: 手动输入成绩 =====

/**
 * NOTE: 弹出手动输入成绩的对话框
 * 支持格式：ss.xxx, mm:ss.xxx, 纯数字（毫秒）
 */
function showManualInputDialog() {
    const lang = getLocale();
    const overlay = document.createElement('div');
    overlay.className = 'ao-detail-overlay';
    overlay.innerHTML = `
        <div class="ao-detail-panel">
            <div class="ao-detail-header">
                <h3>${lang === 'zh' ? '手动输入成绩' : 'Manual Input'}</h3>
                <button class="ao-detail-close">✕</button>
            </div>
            <div style="padding: 8px 0;">
                <input type="text" id="manual-time-input" placeholder="${lang === 'zh' ? '输入时间 (如 8.55 或 1:23.456)' : 'Enter time (e.g. 8.55 or 1:23.456)'}"
                    style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #4a6785; background: #0a1628; color: #fff; font-size: 16px; box-sizing: border-box;" autofocus>
                <div style="margin-top: 8px; display: flex; gap: 8px;">
                    <select id="manual-penalty" style="padding: 8px; border-radius: 6px; border: 1px solid #4a6785; background: #0a1628; color: #8ab4f8;">
                        <option value="ok">OK</option>
                        <option value="+2">+2</option>
                        <option value="dnf">DNF</option>
                    </select>
                    <button id="manual-submit" class="segmented-btn active" style="flex: 1; border-radius: 6px;">
                        ${lang === 'zh' ? '添加' : 'Add'}
                    </button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('.ao-detail-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const input = overlay.querySelector('#manual-time-input');
    const submit = overlay.querySelector('#manual-submit');

    // NOTE: 解析时间字符串 → 毫秒
    function parseTimeInput(str) {
        str = str.trim();
        if (!str) return null;
        // mm:ss.xxx
        const matchMS = str.match(/^(\d+):(\d+\.?\d*)$/);
        if (matchMS) {
            return Math.round((parseInt(matchMS[1]) * 60 + parseFloat(matchMS[2])) * 1000);
        }
        // ss.xxx
        const num = parseFloat(str);
        if (!isNaN(num) && num > 0) {
            // 如果值 > 100，视为毫秒；否则视为秒
            return num > 100 ? Math.round(num) : Math.round(num * 1000);
        }
        return null;
    }

    function doSubmit() {
        const ms = parseTimeInput(input.value);
        if (ms === null || ms <= 0) {
            input.style.borderColor = '#ef5350';
            return;
        }
        const penalty = overlay.querySelector('#manual-penalty').value;
        const entry = {
            time: ms,
            penalty: penalty,
            scramble: '',
            date: new Date().toISOString(),
        };
        state.players[0].solveHistory.push(entry);
        saveSolveHistory();
        renderSoloStats(0);
        overlay.remove();
    }

    submit.addEventListener('click', doSubmit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSubmit(); });
}

// ===== Sprint 4: csTimer 导入 =====

/**
 * NOTE: 导入 csTimer JSON 导出数据
 * 格式: { "session1": [[penalty, time, comment, unixTimestamp], ...], ... }
 * penalty: 0=ok, 2000=+2, -1=DNF
 */
function importFromCsTimer(jsonText) {
    try {
        const data = JSON.parse(jsonText);
        let imported = 0;

        // NOTE: 尝试找每个 session 并导入
        for (const key in data) {
            if (!Array.isArray(data[key])) continue;
            for (const record of data[key]) {
                if (!Array.isArray(record) || record.length < 2) continue;
                const [penalty, rawTime, comment, timestamp] = record;

                // NOTE: csTimer 时间格式：[seconds, milliseconds] 或纯数字毫秒
                let timeMs;
                if (Array.isArray(rawTime)) {
                    timeMs = rawTime[0] * 1000 + rawTime[1]; // [sec, ms]
                } else {
                    timeMs = Math.round(rawTime * 10); // csTimer 用 centi-seconds * 10?
                    // HACK: csTimer 有时存储为 centiseconds
                    if (timeMs > 360000000) timeMs = Math.round(rawTime); // > 100 hours? 应该是毫秒
                }

                let penaltyStr = 'ok';
                if (penalty === -1) penaltyStr = 'dnf';
                else if (penalty === 2000) penaltyStr = '+2';

                const entry = {
                    time: timeMs,
                    penalty: penaltyStr,
                    scramble: typeof comment === 'string' ? comment : '',
                    date: timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
                };
                state.players[0].solveHistory.push(entry);
                imported++;
            }
        }

        saveSolveHistory();
        renderSoloStats(0);
        const lang = getLocale();
        showMilestoneToast(lang === 'zh' ? `已导入 ${imported} 条` : `Imported ${imported} solves`);
    } catch (e) {
        console.error('csTimer import error:', e);
        showMilestoneToast('Import failed: ' + e.message);
    }
}

/**
 * NOTE: 弹出 csTimer 导入文件选择器
 */
function showCsTimerImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.txt';
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => importFromCsTimer(reader.result);
        reader.readAsText(file);
    });
    input.click();
}

// ===== Sprint 4: Session 概览 =====

/**
 * NOTE: 弹窗显示所有 session 的统计概览
 */
function showSessionOverview() {
    const lang = getLocale();
    let html = `<div class="ao-detail-overlay">
        <div class="ao-detail-panel" style="min-width: 340px; max-width: 95vw;">
            <div class="ao-detail-header">
                <h3>${lang === 'zh' ? 'Session 概览' : 'Session Overview'}</h3>
                <button class="ao-detail-close">✕</button>
            </div>
            <table class="session-overview-table">
                <tr><th>Session</th><th>Count</th><th>Best</th><th>Ao5</th><th>Ao12</th><th>Mean</th></tr>`;

    for (const sess of state.sessions) {
        // NOTE: 遍历所有项目的成绩
        const key = `${LS_PREFIX}solo_history_${sess.id}_${state.puzzleId}`;
        let solves;
        try { solves = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { solves = []; }
        if (solves.length === 0) continue;

        const times = solves.map(getEffectiveTimeFromEntry);
        const valid = times.filter(t => t !== Infinity);
        const best = valid.length > 0 ? formatTimePlain(Math.min(...valid)) : '-';
        const ao5 = solves.length >= 5 ? computeAo5(solves) : null;
        const ao12 = solves.length >= 12 ? computeAverage(solves, 12) : null;
        const mean = valid.length > 0 ? formatTimePlain(Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)) : '-';

        html += `<tr>
            <td>${sess.name}</td>
            <td>${solves.length}</td>
            <td>${best}</td>
            <td>${ao5 === null ? '-' : (ao5 === Infinity ? 'DNF' : formatTimePlain(ao5))}</td>
            <td>${ao12 === null ? '-' : (ao12 === Infinity ? 'DNF' : formatTimePlain(ao12))}</td>
            <td>${mean}</td>
        </tr>`;
    }

    html += '</table></div></div>';

    const container = document.createElement('div');
    container.innerHTML = html;
    const overlay = container.firstElementChild;
    document.body.appendChild(overlay);

    overlay.querySelector('.ao-detail-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// ===== Sprint 5: Warmup 自动检测 =====

/**
 * NOTE: 检测 warmup 期（session 开头 σ 明显偏高的段落）
 * 返回 warmup 结束的索引（0 表示无明显 warmup）
 * @param {number[]} validTimes - 有效时间序列（ms）
 */
function detectWarmup(validTimes) {
    if (validTimes.length < 10) return 0;

    // NOTE: 简单启发式：比较前 5 把和后续的均值差异
    const first5mean = validTimes.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const rest = validTimes.slice(5);
    const restMean = rest.reduce((a, b) => a + b, 0) / rest.length;

    // NOTE: 前 5 把均值比后续高 15% 以上 → 判定为 warmup
    if (first5mean > restMean * 1.15) {
        return 5;
    }
    return 0;
}

// ===== Sprint 5: WCA 模拟赛 (Monte Carlo) =====

/**
 * NOTE: 从当前分布中 Bootstrap 抽样模拟 Ao5 比赛结果
 * @param {number[]} validTimes - 有效时间池（ms）
 * @param {number} iterations - 模拟次数
 * @returns {{ p50: number, p75: number, p95: number }}
 */
function simulateCompetition(validTimes, iterations) {
    if (validTimes.length < 5) return null;
    iterations = iterations || 1000;

    const results = [];
    for (let i = 0; i < iterations; i++) {
        // 随机抽 5 把
        const sample = [];
        for (let j = 0; j < 5; j++) {
            sample.push(validTimes[Math.floor(Math.random() * validTimes.length)]);
        }
        sample.sort((a, b) => a - b);
        // Ao5 = 去最好最差取中间 3 个均值
        const ao5 = Math.round((sample[1] + sample[2] + sample[3]) / 3);
        results.push(ao5);
    }

    results.sort((a, b) => a - b);
    return {
        p50: results[Math.floor(iterations * 0.5)],
        p75: results[Math.floor(iterations * 0.75)],
        p95: results[Math.floor(iterations * 0.95)],
    };
}

/**
 * NOTE: 显示模拟赛结果弹窗
 */
function showSimulationResult() {
    const h = state.players[0].solveHistory;
    const validTimes = h.map(getEffectiveTimeFromEntry).filter(t => t !== Infinity);
    if (validTimes.length < 5) {
        showMilestoneToast(getLocale() === 'zh' ? '至少需要 5 条成绩' : 'Need at least 5 solves');
        return;
    }

    const result = simulateCompetition(validTimes, 1000);
    const lang = getLocale();

    const overlay = document.createElement('div');
    overlay.className = 'ao-detail-overlay';
    overlay.innerHTML = `
        <div class="ao-detail-panel">
            <div class="ao-detail-header">
                <h3>${lang === 'zh' ? '🎲 模拟赛结果 (1000次)' : '🎲 Competition Simulation (1000x)'}</h3>
                <button class="ao-detail-close">✕</button>
            </div>
            <div class="sim-results">
                <div class="sim-row">
                    <span class="sim-label">${lang === 'zh' ? '50% 概率 ≤' : '50th percentile'}</span>
                    <span class="sim-value">${formatTimePlain(result.p50)}</span>
                </div>
                <div class="sim-row">
                    <span class="sim-label">${lang === 'zh' ? '75% 概率 ≤' : '75th percentile'}</span>
                    <span class="sim-value">${formatTimePlain(result.p75)}</span>
                </div>
                <div class="sim-row">
                    <span class="sim-label">${lang === 'zh' ? '95% 概率 ≤' : '95th percentile'}</span>
                    <span class="sim-value">${formatTimePlain(result.p95)}</span>
                </div>
            </div>
            <p style="color: #6b7a8d; font-size: 12px; margin-top: 12px;">
                ${lang === 'zh' ? '基于当前成绩分布 Bootstrap 随机抽样 Ao5' : 'Ao5 bootstrap sampled from your current times distribution'}
            </p>
        </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.ao-detail-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// ===== Sprint 6: 热力图日历 =====

/**
 * NOTE: 生成 GitHub 风格热力图日历
 * 按天聚合练习量，颜色深浅 = 当日成绩数
 * @returns {string} SVG HTML 字符串
 */
function renderHeatmapCalendar() {
    const h = state.players[0].solveHistory;
    if (h.length === 0) return '';

    // NOTE: 按日期聚合
    const dayMap = {};
    h.forEach(entry => {
        if (!entry.date) return;
        const d = new Date(entry.date);
        const key = d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0');
        dayMap[key] = (dayMap[key] || 0) + 1;
    });

    const cellSize = 10, gap = 2;
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 364); // 最近 1 年

    // NOTE: 找到起始日是周几（0=Sun, 1=Mon, ...）
    const startDow = startDate.getDay();
    const totalDays = 365;
    const cols = Math.ceil((totalDays + startDow) / 7);
    const W = cols * (cellSize + gap) + 30;
    const H = 7 * (cellSize + gap) + 20;

    // 颜色等级
    const maxCount = Math.max(1, ...Object.values(dayMap));
    function getColor(count) {
        if (count === 0) return '#161b22';
        const level = Math.ceil((count / maxCount) * 4);
        return ['', '#0e4429', '#006d32', '#26a641', '#39d353'][Math.min(level, 4)];
    }

    let svgContent = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="max-width: 100%; display: block; margin: 0 auto;">`;

    let current = new Date(startDate);
    for (let day = 0; day < totalDays; day++) {
        const col = Math.floor((day + startDow) / 7);
        const row = (day + startDow) % 7;
        const key = current.getFullYear() + '-' + (current.getMonth() + 1).toString().padStart(2, '0') + '-' + current.getDate().toString().padStart(2, '0');
        const count = dayMap[key] || 0;
        const x = col * (cellSize + gap);
        const y = row * (cellSize + gap);

        svgContent += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" fill="${getColor(count)}">
            <title>${key}: ${count} solves</title>
        </rect>`;

        current.setDate(current.getDate() + 1);
    }

    svgContent += '</svg>';

    return `<div class="heatmap-container">
        <div class="heatmap-title">${getLocale() === 'zh' ? '练习日历' : 'Practice Calendar'}</div>
        ${svgContent}
    </div>`;
}

// ===== Sprint 6: 分享成绩卡片 =====

/**
 * NOTE: 生成成绩分享卡片（Canvas → PNG 下载或 Web Share API）
 */
function shareResultCard() {
    const h = state.players[0].solveHistory;
    if (h.length < 5) {
        showMilestoneToast(getLocale() === 'zh' ? '至少需要 5 条成绩' : 'Need at least 5 solves');
        return;
    }

    const times = h.map(getEffectiveTimeFromEntry);
    const validTimes = times.filter(t => t !== Infinity);
    const best = Math.min(...validTimes);
    const mean = Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length);
    const ao5 = computeAo5(h);
    const ao12 = h.length >= 12 ? computeAverage(h, 12) : null;

    const puzzle = PUZZLES.find(p => p.id === state.puzzleId);
    const puzzleName = puzzle ? puzzle.name[getLocale()] || puzzle.name.en : state.puzzleId;

    // NOTE: 创建 Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');

    // 背景
    const grad = ctx.createLinearGradient(0, 0, 400, 500);
    grad.addColorStop(0, '#0a1628');
    grad.addColorStop(1, '#1a2332');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 400, 500);

    // 标题
    ctx.fillStyle = '#8ab4f8';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(puzzleName, 200, 50);

    // 统计
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';
    const stats = [
        ['Best', formatTimePlain(best)],
        ['Mean', formatTimePlain(mean)],
        ['Ao5', ao5 === null ? '-' : (ao5 === Infinity ? 'DNF' : formatTimePlain(ao5))],
        ['Ao12', ao12 === null ? '-' : (ao12 === Infinity ? 'DNF' : formatTimePlain(ao12))],
        ['Solves', h.length.toString()],
    ];
    let yPos = 100;
    for (const [label, value] of stats) {
        ctx.fillStyle = '#6b7a8d';
        ctx.fillText(label, 60, yPos);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(value, 200, yPos);
        ctx.font = '16px sans-serif';
        yPos += 40;
    }

    // 迷你折线图（最近 50 把）
    const recentValid = [];
    const last50 = h.slice(-50);
    last50.forEach((e, i) => {
        const t = getEffectiveTimeFromEntry(e);
        if (t !== Infinity) recentValid.push({ i, t });
    });
    if (recentValid.length >= 2) {
        const chartTop = 340, chartH = 100, chartLeft = 40, chartRight = 360;
        const minT = Math.min(...recentValid.map(p => p.t));
        const maxT = Math.max(...recentValid.map(p => p.t));
        const range = maxT - minT || 1;

        ctx.strokeStyle = '#4fc3f7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        recentValid.forEach((p, j) => {
            const px = chartLeft + (p.i / (last50.length - 1)) * (chartRight - chartLeft);
            const py = chartTop + (1 - (p.t - minT) / range) * chartH;
            if (j === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
        ctx.stroke();
    }

    // 水印
    ctx.fillStyle = '#4a5568';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('cuberoot.me/battle', 200, 480);

    // 下载或分享
    canvas.toBlob(function(blob) {
        if (navigator.share && navigator.canShare) {
            const file = new File([blob], 'cube-stats.png', { type: 'image/png' });
            navigator.share({ files: [file], title: puzzleName + ' Stats' }).catch(() => {});
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'cube-stats.png';
            a.click();
            URL.revokeObjectURL(url);
        }
    }, 'image/png');
}

// ===== Sprint 6: 国际化修复 =====

// NOTE: 设置页面硬编码英文文本的双语映射
const I18N_SETTINGS = {
    voice_alert: { en: 'Voice Alert (8s / 12s)', zh: '语音提示 (8s / 12s)' },
    phases: { en: 'Phases', zh: '阶段' },
    inspection_time: { en: 'Inspection Time', zh: '观察时间' },
    off: { en: 'OFF', zh: '关' },
    timer_precision: { en: 'Timer Precision', zh: '计时精度' },
    start_delay: { en: 'Start Delay', zh: '启动延时' },
    scramble_size: { en: 'Scramble Size', zh: '打乱字号' },
    show_scramble_image: { en: 'Show Scramble Image', zh: '显示打乱图' },
    history: { en: 'History', zh: '历史' },
    no_solves: { en: 'No solves yet', zh: '暂无成绩' },
    solves_unit: { en: 'solves', zh: '次' },
    manual_input: { en: '➕ Manual', zh: '➕ 手动' },
    import_cstimer: { en: 'Import csTimer', zh: '导入 csTimer' },
    session_overview: { en: '📊 Overview', zh: '📊 概览' },
    simulate: { en: '🎲 Simulate', zh: '🎲 模拟赛' },
    share: { en: '📤 Share', zh: '📤 分享' },
};

