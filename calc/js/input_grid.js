// NOTE: 输入网格 + 键盘导航 + 数字键盘
// 替代原 canvas overlay hack，使用原生 <input> 元素

import {
    DNF_VALUE, formatTime, textToTime, textToMbfScore, CalcEngine, clampValue
} from './calc_engine.js';
import {
    state, updateTime, notify, solveCount
} from './state.js';
import { isMbf } from './state.js';

import { getTargetAvg, setTargetAvg } from './calc_table.js';
import { isWR } from './wr_data.js';
import { adjustSelectedBar, hasSelection, getSelectedValue, getSelectedInfo } from './chart_drag.js';

// NOTE: 当前聚焦的单元格 [player, solve]，-1 表示无聚焦
var activeCell = [-1, -1];
// NOTE: 移动端柱子选中后标记 — 首次 numpad 输入应替换旧值而非追加
var barSelectPending = false;
// NOTE: 秒表回调（由 app.js 注册，避免循环依赖）
var stopwatchCallback = null;
// NOTE: 撤销栈 — 每条记录 {playerIdx, solveIdx, oldValue}
var undoStack = [];
var UNDO_MAX = 50;
// NOTE: 滚轮撤销 debounce — 连续滚动合并为一条撤销记录
var wheelUndoTimer = null;
var wheelUndoBase = null; // 滚动序列开始前的原始值


// NOTE: 根据文字长度自适应缩小字号，防止长时间格式（如 1:10.10）溢出
function fitFont(input) {
    // NOTE: 去掉括号计算长度，避免 Ao5 括号标注影响字号
    var len = input.value.replace(/[()]/g, '').length;
    // 5 字符及以下用默认字号（CSS 控制），6+ 字符逐级缩小
    if (len <= 5) {
        input.style.fontSize = '';
    } else if (len === 6) {
        input.style.fontSize = '20px';
    } else {
        input.style.fontSize = '17px';
    }
}

// NOTE: 检测 input 文本是否处于全选状态
function isFullySelected(input) {
    return input.selectionStart === 0 && input.selectionEnd === input.value.length && input.value.length > 0;
}

// 输入框 DOM 引用缓存 — cells[p][t] 对应 player p 的第 t 个时间格
var cells = [[], []];
// Target Avg 输入框引用
var tavgCells = [null, null];
var tavgEmojis = [null, null]; // NOTE: Target Avg 单元格状态 emoji 引用
// 比赛名输入框引用
var compNameInput = null;
// NOTE: WR 徽章 DOM 引用 — wrBadges[p][t] 对应 player p 的第 t 个时间格的 WR badge
var wrBadges = [[], []];
// NOTE: 排名标签 DOM 引用 — rankLabels[p][t]
var rankLabels = [[], []];

// NOTE: Target Avg 的固定 DOM 列索引（始终在第 6 列，不随 solveCount 变化）
var TAVG_T = 5;
function isTavg(t) { return t === TAVG_T; }
// 统一获取 cell DOM 元素
function getCellEl(p, t) { return isTavg(t) ? tavgCells[p] : cells[p][t]; }
// 统一读取 cell 值（centiseconds）
function getCellVal(p, t) {
    if (isTavg(t)) return getTargetAvg(state.seedOn + p);
    return state.times[state.seedOn + p][t];
}
// 统一写入 cell 值
function setCellVal(p, t, val) {
    if (isTavg(t)) { setTargetAvg(state.seedOn + p, val); }
    else { updateTime(state.seedOn + p, t, val); }
}

// ── 初始化 ──

export function init(gridContainer) {
    compNameInput = document.getElementById('comp-name');
    compNameInput.value = state.compName;
    compNameInput.addEventListener('change', () => {
        state.compName = compNameInput.value;
        notify();
    });

    // 创建输入网格：2 行 × (5 时间格 + 1 Target Avg 格 + 1 勾选)
    for (var p = 0; p < 2; p++) {
        var row = document.createElement('div');
        row.className = 'input-row player-' + (p === 0 ? 'a' : 'b');

        for (var t = 0; t < 5; t++) {
            var wrapper = createTimeCell(p, t);
            row.appendChild(wrapper);
            // NOTE: input 在 wrapper 的第一个子元素
            cells[p][t] = wrapper.querySelector('input');
            wrBadges[p][t] = wrapper.querySelector('.wr-badge');
            rankLabels[p][t] = wrapper.querySelector('.sort-rank');
        }

        // NOTE: 第 6 列 — Target Avg，复用 createTimeCell 逻辑
        var tavgWrapper = createTimeCell(p, TAVG_T);
        row.appendChild(tavgWrapper);
        tavgCells[p] = tavgWrapper.querySelector('input');
        tavgEmojis[p] = tavgWrapper.querySelector('.tavg-emoji');

        // NOTE: 勾选框 — 控制是否启用该选手的时间输入
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = (p === 0); // NOTE: 默认只有 Player A 勾选
        cb.className = 'player-toggle';
        cb.dataset.player = p;
        cb.addEventListener('change', onTogglePlayer);
        row.appendChild(cb);

        gridContainer.appendChild(row);
    }

    // NOTE: Player B 默认不勾选，初始化时禁用所有 Player B 格子
    var initN = solveCount();
    for (var t = 0; t < initN; t++) {
        cells[1][t].disabled = true;
        cells[1][t].style.opacity = '0.3';
    }
    tavgCells[1].disabled = true;
    tavgCells[1].style.opacity = '0.3';

    // NOTE: 全局键盘监听（Enter/Tab/Escape/Backspace/Delete/Space）
    window.addEventListener('keydown', onKeyDown);

    // NOTE: 数字键盘事件委托
    var numpadGrid = document.getElementById('numpad-grid');
    if (numpadGrid) {
        // 阻止 numpad 按钮夺走 input 焦点（mousedown=桌面, touchstart=移动端）
        numpadGrid.addEventListener('mousedown', (e) => e.preventDefault());
        numpadGrid.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
        // NOTE: 防抖 — touchend 和 click 可能双触发，用标记阻止第二次
        var numpadBusy = false;
        var guardedHandler = function (e) {
            if (numpadBusy) return;
            numpadBusy = true;
            setTimeout(() => { numpadBusy = false; }, 100);
            onNumpadClick(e);
        };
        numpadGrid.addEventListener('touchend', guardedHandler);
        numpadGrid.addEventListener('click', guardedHandler);
    }

    // NOTE: 长按 ⌫ = Clear All — 500ms 后按钮变红提示，松手执行清空
    var bkspBtn = document.querySelector('[data-key="backspace"]');
    if (bkspBtn) {
        var longPressTimer = null;
        var isClearMode = false;
        var origHTML = bkspBtn.innerHTML;

        function startLongPress(e) {
            isClearMode = false;
            longPressTimer = setTimeout(function () {
                isClearMode = true;
                bkspBtn.style.background = '#c62828';
                bkspBtn.innerHTML = '<span style="font-size:14px;color:#fff">Clear</span>';
            }, 500);
        }

        function endLongPress(e) {
            clearTimeout(longPressTimer);
            if (isClearMode) {
                // NOTE: 恢复按钮外观后 dispatch clearAll 事件
                bkspBtn.style.background = '';
                bkspBtn.innerHTML = origHTML;
                document.dispatchEvent(new CustomEvent('clearAll'));
                isClearMode = false;
                e.preventDefault();
                e.stopPropagation();
            }
        }

        function cancelLongPress() {
            clearTimeout(longPressTimer);
            if (isClearMode) {
                bkspBtn.style.background = '';
                bkspBtn.innerHTML = origHTML;
                isClearMode = false;
            }
        }

        bkspBtn.addEventListener('mousedown', startLongPress);
        bkspBtn.addEventListener('mouseup', endLongPress);
        bkspBtn.addEventListener('mouseleave', cancelLongPress);
        bkspBtn.addEventListener('touchstart', startLongPress, { passive: true });
        bkspBtn.addEventListener('touchend', endLongPress);
        bkspBtn.addEventListener('touchcancel', cancelLongPress);
    }

    // NOTE: iOS 滚筒 — 精调选中柱子/聚焦格子的值
    initDrum();

}

// ── 创建输入元素 ──

// NOTE: 自动跳格 — 输入满足条件时自动保存并跳到下一格
// 仅限三阶(333)，其他项目成绩范围不同
// 由 input 事件和 numpad 数字键共享调用
function tryAutoAdvance(rawVal) {
    if (state.event !== '333') return;
    // NOTE: 多盲得分模式下禁用自动跳格（得分通常 1~2 位数）
    if (isMbf()) return;
    var val = rawVal.trim();
    var shouldAdvance = false;

    // 规则 1: 小数点后已输入 2 位数字（如 "4.42"、"12.35"）
    var dotIdx = val.indexOf('.');
    if (dotIdx >= 0) {
        var afterDot = val.substring(dotIdx + 1);
        if (afterDot.length >= 2 && /^\d{2}$/.test(afterDot)) {
            shouldAdvance = true;
        }
    }

    // 规则 2: 首位 ≥ 3 的 3 位纯数字（如 "354"、"999"，代表 3.54s、9.99s）
    if (!shouldAdvance && /^\d{3}$/.test(val) && parseInt(val[0], 10) >= 3) {
        shouldAdvance = true;
    }

    // 规则 3: 4 位纯数字 1000~2959（代表 10.00s~29.59s）
    if (!shouldAdvance && /^\d{4}$/.test(val)) {
        var num = parseInt(val, 10);
        if (num >= 1000 && num <= 2959) shouldAdvance = true;
    }

    if (shouldAdvance) {
        var p = activeCell[0], t = activeCell[1];
        if (p < 0) return;
        saveCell(p, t);
        var nxt = nextCell(p, t);
        if (nxt) {
            navigateTo(nxt[0], nxt[1]);
        } else {
            cells[p][t].blur();
            activeCell = [-1, -1];
        }
    }
}

function createTimeCell(p, t) {
    var input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'none'; // 抑制移动端系统键盘
    input.autocomplete = 'off';
    input.dataset.player = p;
    input.dataset.solve = t;

    // NOTE: tavg cell 使用 name-cell 样式 + 绿色背景，普通 cell 使用 time-cell
    if (isTavg(t)) {
        input.className = 'time-cell tavg-cell';
        input.placeholder = 'Target';
    } else {
        input.className = 'time-cell';
        input.placeholder = '#' + (t + 1);
    }

    input.addEventListener('focus', () => {
        // NOTE: 先保存上一个 activeCell — 防止逐字符清空后直接点击其他格子时
        // 旧格子的 blur(50ms 延迟) 因 activeCell 已更新而跳过 saveCell，导致旧值复活
        if (activeCell[0] >= 0 && activeCell[1] >= 0) {
            saveCell(activeCell[0], activeCell[1]);
        }
        activeCell = [p, t];
        input.select();
        syncNumpadDisplay();

        // NOTE: 通知柱子轻高亮对应 bar
        document.dispatchEvent(new CustomEvent('cell-focus', { detail: { player: p, slot: t } }));
    });
    input.addEventListener('blur', () => {
        // NOTE: 延迟检测 — 如果焦点转移到另一个格子则不触发保存（由导航逻辑处理）
        setTimeout(() => {
            if (activeCell[0] === p && activeCell[1] === t) {
                saveCell(p, t);
                activeCell = [-1, -1];
                syncNumpadDisplay();

                // NOTE: 清除柱子高亮
                document.dispatchEvent(new CustomEvent('cell-focus', { detail: null }));
            }
        }, 50);
    });
    input.addEventListener('input', () => {
        syncNumpadDisplay();
        // NOTE: tavg 格不自动跳格
        if (!isTavg(t)) tryAutoAdvance(input.value);

    });
    // NOTE: 滚轮微调成绩 — 仅聚焦时生效
    input.addEventListener('wheel', (e) => onWheel(e, p, t), { passive: false });

    // NOTE: 用 wrapper div 包裹 input + WR badge（input 不支持子元素）
    var wrapper = document.createElement('div');
    wrapper.className = 'time-cell-wrapper';
    wrapper.appendChild(input);

    // NOTE: WR badge — 初始隐藏，refresh 时检测是否显示
    if (!isTavg(t)) {
        var badge = document.createElement('span');
        badge.className = 'wr-badge';
        badge.textContent = 'WR';
        badge.style.display = 'none';
        wrapper.appendChild(badge);

        // NOTE: 排名标签 — 左上角显示从快到慢的排序序号
        var rankEl = document.createElement('span');
        rankEl.className = 'sort-rank';
        wrapper.appendChild(rankEl);
    } else {
        // NOTE: Target Avg 状态 emoji — 左上角显示 🎯/🔒/🎲/💀
        var emojiEl = document.createElement('span');
        emojiEl.className = 'tavg-emoji';
        emojiEl.textContent = '🎯';
        wrapper.appendChild(emojiEl);
    }

    return wrapper;
}

// ── 滚轮微调 ──

// NOTE: 滚轮调整成绩 — 仅在聚焦的 cell 上生效
// 默认 ±0.01s(1cs)，Shift ±0.10s(10cs)，Ctrl ±1.00s(100cs)
// FMC 步数模式：固定 ±1步(100cs)
function onWheel(e, p, t) {
    // 空格或 DNF 不响应滚轮
    var rawVal = getCellVal(p, t);
    if (rawVal <= 0 || rawVal >= DNF_VALUE) return;

    e.preventDefault(); // 阻止页面滚动

    // 步进粒度
    var step = 1;
    if (state.event === '333fm' || isMbf()) {
        step = 100; // FMC: 1步 = 100cs; 多盲: 1分 = 100
    } else if (e.ctrlKey) {
        step = 100; // 1.00s
    } else if (e.shiftKey) {
        step = 10;  // 0.10s
    }

    var dir = e.deltaY < 0 ? 1 : -1;
    var newVal = clampValue(rawVal + dir * step);
    if (newVal === rawVal) return;

    // NOTE: debounce 撤销 — 300ms 内连续滚动只记录一条
    // 首次滚动记录 oldValue 作为 base，后续滚动复用这个 base
    if (wheelUndoTimer) {
        clearTimeout(wheelUndoTimer);
        // 弹出上一次滚动的撤销记录（会被合并）
        if (undoStack.length > 0) undoStack.pop();
    } else {
        wheelUndoBase = rawVal;
    }
    // 推入以 base 为 oldValue 的撤销记录
    undoStack.push({ playerIdx: state.seedOn + p, solveIdx: t, oldValue: wheelUndoBase, seedOn: state.seedOn });
    if (undoStack.length > UNDO_MAX) undoStack.shift();

    // 直接写入 state（绕过 recordAndUpdate 以免重复撤销记录）
    setCellVal(p, t, newVal);

    // 刷新显示
    getCellEl(p, t).value = formatTime(newVal);
    syncNumpadDisplay();

    // 300ms 无新滚动则结束本轮 debounce
    wheelUndoTimer = setTimeout(() => {
        wheelUndoTimer = null;
        wheelUndoBase = null;
    }, 300);
}

// ── 选手启用/禁用 ──

// NOTE: 勾选框切换 — 启用/禁用该行所有时间格（含 Target Avg 格）
function onTogglePlayer(e) {
    var p = parseInt(e.target.dataset.player);
    // NOTE: 不允许两行都不选 — 至少保留一个
    if (!e.target.checked) {
        var enabledCount = state.playerEnabled.filter(function (v) { return v; }).length;
        if (enabledCount <= 1) {
            e.target.checked = true; // 还原勾选
            return;
        }
    }
    var disabled = !e.target.checked;
    state.playerEnabled[p] = e.target.checked;
    var n = solveCount();
    for (var t = 0; t < n; t++) {
        cells[p][t].disabled = disabled;
        cells[p][t].style.opacity = disabled ? '0.3' : '1';
    }
    // NOTE: Target Avg 格跟随选手启用状态灰掉
    tavgCells[p].disabled = disabled;
    tavgCells[p].style.opacity = disabled ? '0.3' : '1';
    // NOTE: 触发图表重绘以隐藏/显示对应柱子
    notify();
}

// ── 保存与导航 ──

// NOTE: 带撤销记录的 updateTime 包装 — 自动在修改前记录旧值
function recordAndUpdate(playerIdx, solveIdx, value) {
    // NOTE: tavg 不走 state.times，用 p 推导
    var p = playerIdx - state.seedOn;
    if (isTavg(solveIdx)) {
        var oldValue = getTargetAvg(playerIdx);
        if (oldValue === value) return;
        undoStack.push({ playerIdx: playerIdx, solveIdx: solveIdx, oldValue: oldValue, seedOn: state.seedOn });
        if (undoStack.length > UNDO_MAX) undoStack.shift();
        setTargetAvg(playerIdx, value);
    } else {
        var oldValue = state.times[playerIdx][solveIdx];
        if (oldValue === value) return;
        undoStack.push({ playerIdx: playerIdx, solveIdx: solveIdx, oldValue: oldValue, seedOn: state.seedOn });
        if (undoStack.length > UNDO_MAX) undoStack.shift();
        updateTime(playerIdx, solveIdx, value);
    }
}

// NOTE: 保存单元格值到 state
function saveCell(p, t) {
    var input = getCellEl(p, t);
    // NOTE: 多盲得分模式用专用解析函数
    var val = isMbf() ? textToMbfScore(input.value) : textToTime(input.value);
    recordAndUpdate(state.seedOn + p, t, val);
    // NOTE: 回显由 notify → refresh() 统一处理（含 Ao5 括号标注）
}

// NOTE: 导航到指定单元格
export function navigateTo(p, t) {
    // 合法范围：0~solveCount()-1（时间格）或 TAVG_T（target 格）
    if (p < 0 || p > 1) return;
    if (t < 0 || (t > solveCount() - 1 && !isTavg(t))) return;

    // 先保存当前格
    if (activeCell[0] >= 0 && activeCell[1] >= 0) {
        saveCell(activeCell[0], activeCell[1]);
    }


    activeCell = [p, t];
    var el = getCellEl(p, t);
    el.focus();
    el.select();
}

// NOTE: 计算下一个单元格 — 双选手启用时按列 zigzag（A0→B0→A1→B1→...→A(tavg)→B(tavg)）
// 返回 [p, t] 或 null（已到末尾）
function nextCell(p, t) {
    var maxT = solveCount() - 1;
    var bothEnabled = state.playerEnabled[0] && state.playerEnabled[1];
    if (isTavg(t)) {
        // tavg 列：A→B，B→null
        if (bothEnabled && p === 0) return [1, TAVG_T];
        return null;
    }
    if (bothEnabled) {
        if (p === 0) return [1, t];
        // B 行最后一个 solve → A 行下一列（或跳到 tavg）
        if (t < maxT) return [0, t + 1];
        return [0, TAVG_T]; // 跳到 tavg
    }
    // 单选手：同行右移
    if (t < maxT) return [p, t + 1];
    return [p, TAVG_T]; // 跳到 tavg
}

// NOTE: 计算上一个单元格 — 反向 zigzag
// 返回 [p, t] 或 null（已到开头）
function prevCell(p, t) {
    var maxT = solveCount() - 1;
    var bothEnabled = state.playerEnabled[0] && state.playerEnabled[1];
    if (isTavg(t)) {
        // tavg 列前一格：回到最后一个 solve
        if (bothEnabled && p === 1) return [0, TAVG_T];
        if (bothEnabled) return [1, maxT];
        return [p, maxT];
    }
    if (bothEnabled) {
        if (p === 1) return [0, t];
        if (t > 0) return [1, t - 1];
        return null;
    }
    if (t > 0) return [p, t - 1];
    return null;
}

// ── 键盘处理 ──

function onKeyDown(e) {
    var p = activeCell[0];
    var t = activeCell[1];

    if (e.key === 'Enter') {
        if (p < 0) return;
        e.preventDefault();
        // NOTE: zigzag 前进（双选手时按列，单选手时同行）
        var nxt = nextCell(p, t);
        if (nxt) {
            navigateTo(nxt[0], nxt[1]);
        } else {
            saveCell(p, t);
            getCellEl(p, t).blur();
            activeCell = [-1, -1];
        }
    } else if (e.key === 'Tab') {
        if (p < 0) return;
        e.preventDefault();
        // NOTE: Tab 始终按列 zigzag（不受单选手影响），包含 tavg 列
        if (p === 0 && state.playerEnabled[1]) {
            navigateTo(1, t);
        } else if (!isTavg(t) && t < solveCount() - 1) {
            navigateTo(state.playerEnabled[0] ? 0 : 1, t + 1);
        } else if (!isTavg(t)) {
            navigateTo(state.playerEnabled[0] ? 0 : 1, TAVG_T);
        } else {
            saveCell(p, t);
            getCellEl(p, t).blur();
            activeCell = [-1, -1];
        }
    } else if (e.key === 'Escape') {
        if (p < 0) return;
        // 取消编辑，恢复原值
        var rawVal = getCellVal(p, t);
        getCellEl(p, t).value = (rawVal > 0 && rawVal < DNF_VALUE) ? formatTime(rawVal) : (rawVal >= DNF_VALUE ? 'DNF' : '');
        getCellEl(p, t).blur();
        activeCell = [-1, -1];
        syncNumpadDisplay();
    } else if (e.key === 'Backspace') {
        if (p < 0) return;
        var v = getCellEl(p, t);
        // NOTE: 当前格为空时，反向 zigzag 跳到上一格并清空
        if (v.value.length === 0) {
            var prv = prevCell(p, t);
            if (prv) {
                e.preventDefault();
                recordAndUpdate(state.seedOn + prv[0], prv[1], 0);
                navigateTo(prv[0], prv[1]);
            }
        }
    } else if (e.key === 'Delete') {
        if (p < 0) return;
        // NOTE: zigzag 前进到下一格并清空
        var del = nextCell(p, t);
        if (del) {
            e.preventDefault();
            saveCell(p, t);
            navigateTo(del[0], del[1]);
            getCellEl(del[0], del[1]).value = '';
            syncNumpadDisplay();
        }
    } else if (e.key === 'ArrowDown') {
        if (p < 0) return;
        e.preventDefault();
        // NOTE: A行 → B行同列
        if (p === 0) navigateTo(1, t);
    } else if (e.key === 'ArrowUp') {
        if (p < 0) return;
        e.preventDefault();
        // NOTE: B行 → A行同列
        if (p === 1) navigateTo(0, t);
    } else if (e.key === 'ArrowLeft') {
        if (p < 0) return;
        e.preventDefault();
        // NOTE: 同行向左一格（tavg → 最后一个 solve）
        if (isTavg(t)) navigateTo(p, solveCount() - 1);
        else if (t > 0) navigateTo(p, t - 1);
    } else if (e.key === 'ArrowRight') {
        if (p < 0) return;
        e.preventDefault();
        // NOTE: 同行向右一格（最后一个 solve → tavg）
        if (t < solveCount() - 1) navigateTo(p, t + 1);
        else if (!isTavg(t)) navigateTo(p, TAVG_T);
    } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        // NOTE: Ctrl+Z 撤销上一次单元格修改并跳回该格
        e.preventDefault();
        if (undoStack.length === 0) return;
        var undo = undoStack.pop();
        // NOTE: tavg 撤销走 setTargetAvg，普通 solve 走 updateTime
        if (isTavg(undo.solveIdx)) {
            setTargetAvg(undo.playerIdx, undo.oldValue);
        } else {
            updateTime(undo.playerIdx, undo.solveIdx, undo.oldValue);
        }
        // 刷新所有输入框显示
        refresh();
        // NOTE: 跳回被撤销的单元格（仅当仍在同一 seed 页时）
        var displayP = undo.playerIdx - undo.seedOn;
        if (undo.seedOn === state.seedOn && displayP >= 0 && displayP <= 1) {
            activeCell = [displayP, undo.solveIdx];
            var el = getCellEl(displayP, undo.solveIdx);
            el.focus();
            el.select();
        }
    } else if (e.key === ' ') {
        // NOTE: 空格键触发秒表（逻辑在 app.js 中注册）
        e.preventDefault();
        if (stopwatchCallback) stopwatchCallback();
    }
}

// ── 数字键盘 ──

function onNumpadClick(e) {
    var btn = e.target.closest('[data-key]');
    if (!btn) return;
    var key = btn.dataset.key;
    if (navigator.vibrate) navigator.vibrate(10);
    numpadPress(key);
}

function numpadPress(key) {
    // NOTE: 箭头键由滚筒处理，此处跳过
    if (key === 'arrow-up' || key === 'arrow-down') return;

    var p = activeCell[0];
    var t = activeCell[1];

    // 如果没有活跃单元格，聚焦第一个空格
    if (p < 0 || t < 0) {
        // 找到第一个空格
        var n = solveCount();
        for (var ti = 0; ti < n; ti++) {
            for (var pi = 0; pi < 2; pi++) {
                if (state.times[state.seedOn + pi][ti] === 0) {
                    navigateTo(pi, ti);
                    p = pi; t = ti;
                    break;
                }
            }
            if (p >= 0) break;
        }
        if (p < 0) return; // 所有格都已填满
    }

    var v = getCellEl(p, t);

    if (key === 'enter') {
        // NOTE: zigzag 前进
        var nxt = nextCell(p, t);
        if (nxt) {
            navigateTo(nxt[0], nxt[1]);
        } else {
            saveCell(p, t);
            v.blur();
            activeCell = [-1, -1];
        }
    } else if (key === 'tab') {
        // NOTE: Tab 始终按列 zigzag，包含 tavg
        if (p === 0 && state.playerEnabled[1]) {
            navigateTo(1, t);
        } else if (!isTavg(t) && t < solveCount() - 1) {
            navigateTo(state.playerEnabled[0] ? 0 : 1, t + 1);
        } else if (!isTavg(t)) {
            navigateTo(state.playerEnabled[0] ? 0 : 1, TAVG_T);
        } else {
            saveCell(p, t);
            v.blur();
            activeCell = [-1, -1];
        }
    } else if (key === 'dnf') {

        barSelectPending = false;
        v.value = 'DNF';
        syncNumpadDisplay();
        // NOTE: 自动 zigzag 跳到下一格
        var dnfNxt = nextCell(p, t);
        if (dnfNxt) {
            navigateTo(dnfNxt[0], dnfNxt[1]);
        } else {
            saveCell(p, t);
            v.blur();
            activeCell = [-1, -1];
        }
    } else if (key === 'backspace') {
        if (isFullySelected(v) || barSelectPending) {
            barSelectPending = false;
            // NOTE: 全选状态下一键清空 — 必须同时写 state，否则 refresh 会还原
            recordAndUpdate(state.seedOn + p, t, 0);
            v.value = '';
            syncNumpadDisplay();
        } else if (v.value.length > 0) {
            v.value = v.value.slice(0, -1);
            syncNumpadDisplay();
        } else {
            // NOTE: 当前格为空时，反向 zigzag 跳到上一格并清空
            var prv = prevCell(p, t);
            if (prv) {
                recordAndUpdate(state.seedOn + prv[0], prv[1], 0);
                navigateTo(prv[0], prv[1]);
            }
        }
    } else if (key === 'dotcolon') {

        // NOTE: 全选状态下先清空
        if (isFullySelected(v) || barSelectPending) { v.value = ''; barSelectPending = false; }
        // NOTE: .: 按钮 — 末尾是 . 则替换为 :，否则追加 .
        if (v.value.length > 0 && v.value[v.value.length - 1] === '.') {
            v.value = v.value.slice(0, -1) + ':';
        } else {
            v.value += '.';
        }
        syncNumpadDisplay();
    } else {
        // 数字键 0-9 — 全选时替换而非追加

        if (isFullySelected(v) || barSelectPending) { v.value = ''; barSelectPending = false; }
        v.value += key;
        syncNumpadDisplay();
        // NOTE: numpad 数字键也触发自动跳格
        tryAutoAdvance(v.value);
    }

    // NOTE: 仅当未跳转（activeCell 未变）时才 refocus 原格
    // NOTE: 移动端 numpad 通过 activeCell 驱动，不需要真实 focus；
    // 调 v.focus() 会触发 focus handler 里的 select() 导致刚输入的字符被全选
    if (activeCell[0] === p && activeCell[1] === t && !('ontouchstart' in window)) {
        v.focus();
    }
}

// ── 数字键盘显示同步 ──

function syncNumpadDisplay() {
    // NOTE: 滚筒同步必须在前面，不受 display bar 是否存在的影响
    syncDrum();

    var label = document.getElementById('numpad-label');
    var value = document.getElementById('numpad-value');
    if (!label || !value) return;

    var p = activeCell[0];
    var t = activeCell[1];

    if (p >= 0 && t >= 0) {
        var pName = state.names[state.seedOn + p] || ('Player ' + p);
        label.textContent = pName + ' #' + (t + 1);
        value.textContent = cells[p][t] ? cells[p][t].value : '';
    } else {
        label.textContent = '';
        value.textContent = '';
    }
}

// ── 外部接口 ──

// NOTE: 当 seed 切换时，刷新所有输入框的值
export function refresh() {
    compNameInput.value = state.compName;
    var n = solveCount();
    // NOTE: Ao5 括号标注 — 标记最好/最坏成绩的索引
    var mo3 = (n === 3);

    for (var p = 0; p < 2; p++) {
        // NOTE: 找到 Ao5 的 best/worst 索引（仅当 5 把全部有效时标注）
        var bestIdx = -1, worstIdx = -1;
        if (!mo3) {
            var allFilled = true;
            for (var c = 0; c < n; c++) {
                if (state.times[state.seedOn + p][c] <= 0) { allFilled = false; break; }
            }
            if (allFilled) {
                var bestVal = Infinity, worstVal = -1;
                for (var c2 = 0; c2 < n; c2++) {
                    var v = state.times[state.seedOn + p][c2];
                    if (v < bestVal) { bestVal = v; bestIdx = c2; }
                    if (v > worstVal) { worstVal = v; worstIdx = c2; }
                }
            }
        }

        for (var t = 0; t < 5; t++) {
            if (t < n) {
                // NOTE: 跳过当前正在编辑的 activeCell — 防止中间 refresh
                // 用 state 旧值覆盖用户编辑内容（如清空操作被还原）
                if (activeCell[0] === p && activeCell[1] === t) {
                    continue;
                }
                var rawVal = state.times[state.seedOn + p][t];
                var display = (rawVal > 0 && rawVal < DNF_VALUE)
                    ? formatTime(rawVal)
                    : (rawVal >= DNF_VALUE ? 'DNF' : '');
                // NOTE: Ao5 括号标注 — 最好和最坏成绩加括号（WCA 惯例）
                if (display && (t === bestIdx || t === worstIdx)) {
                    display = '(' + display + ')';
                }
                cells[p][t].value = display;
                fitFont(cells[p][t]);
                cells[p][t].style.display = '';
            } else {
                cells[p][t].value = '';
                cells[p][t].style.fontSize = '';
                cells[p][t].style.display = 'none';
            }
        }
        // Target Avg 格始终可见
        var tavg = getTargetAvg(state.seedOn + p);
        tavgCells[p].value = tavg > 0 ? formatTime(tavg, false, false, true) : '';
        fitFont(tavgCells[p]);

        // NOTE: 更新 Target Avg 状态 emoji
        if (tavgEmojis[p]) {
            var ghost = (tavg > 0 && tavg < DNF_VALUE)
                ? CalcEngine.getGhostBar(state.times[state.seedOn + p], tavg)
                : null;
            if (!ghost) {
                tavgEmojis[p].textContent = '🎯'; // 默认：数据不足
            } else if (ghost.type === 'safe' || ghost.type === 'any') {
                tavgEmojis[p].textContent = '🔒';
            } else if (ghost.type === 'conditional') {
                tavgEmojis[p].textContent = '🎲';
            } else {
                tavgEmojis[p].innerHTML = '<img src="/assets/images/skull.png" alt="skull" style="width:1em;height:1em;vertical-align:middle">';
            }
        }
    }
    syncNumpadDisplay();
    // NOTE: 检测单次 WR — 显示/隐藏 WR badge + 更新排名标签
    for (var p2 = 0; p2 < 2; p2++) {
        // NOTE: 收集有效成绩的索引和值，按值排序后分配排名 1~n
        var ranked = [];
        for (var t2 = 0; t2 < n; t2++) {
            var val = state.times[state.seedOn + p2][t2];
            if (wrBadges[p2][t2]) {
                var show = val > 0 && val < DNF_VALUE && isWR(state.event, 'single', val);
                wrBadges[p2][t2].style.display = show ? '' : 'none';
            }
            if (val > 0) ranked.push({ idx: t2, val: val });
        }
        // NOTE: DNF 值排最后
        ranked.sort(function (a, b) { return a.val - b.val; });
        for (var t3 = 0; t3 < 5; t3++) {
            if (!rankLabels[p2][t3]) continue;
            var pos = ranked.findIndex(function (r) { return r.idx === t3; });
            if (pos >= 0) {
                rankLabels[p2][t3].textContent = pos + 1;
                rankLabels[p2][t3].dataset.rank = pos + 1;
                rankLabels[p2][t3].dataset.total = ranked.length;
                rankLabels[p2][t3].style.display = '';
            } else {
                rankLabels[p2][t3].textContent = '';
                rankLabels[p2][t3].style.display = 'none';
            }
        }
    }
}

// NOTE: 项目切换时更新可见输入格数量（tavg 始终可见）
export function updateVisibleCells() {
    var n = solveCount();
    for (var p = 0; p < 2; p++) {
        for (var t = 0; t < 5; t++) {
            cells[p][t].style.display = (t < n) ? '' : 'none';
        }
        // tavg 始终可见
        tavgCells[p].style.display = '';
    }
}

// NOTE: 获取当前活跃单元格
export function getActiveCell() {
    return activeCell;
}

// NOTE: 注册秒表回调（由 app.js 调用）
export function onStopwatch(fn) {
    stopwatchCallback = fn;
}

// NOTE: 更新指定单元格的显示内容（秒表实时更新用）
export function setCellDisplay(p, t, text) {
    if (cells[p] && cells[p][t]) {
        cells[p][t].value = text;
        fitFont(cells[p][t]);
    }
}

// NOTE: 静默同步 — 将所有可见格子的 input.value 直接写入 state.times
// 不触发 notify/undo/refresh，避免级联刷新 bug（供 Rand 等外部操作使用）
export function flushToState() {
    var n = solveCount();
    for (var p = 0; p < 2; p++) {
        for (var t = 0; t < n; t++) {
            // NOTE: 多盲得分模式用专用解析
            state.times[state.seedOn + p][t] = isMbf()
                ? textToMbfScore(cells[p][t].value)
                : textToTime(cells[p][t].value);
        }
        // Target Avg 也同步
        setTargetAvg(state.seedOn + p, isMbf()
            ? textToMbfScore(tavgCells[p].value)
            : textToTime(tavgCells[p].value));
    }
}

// ── iOS 滚筒精调 ──

// NOTE: 滚筒状态
var drumEl = null;          // #np-drum
var drumList = null;        // #np-drum-list（灰色底层）
var drumListWhite = null;   // 白色裁剪层（clip-path 到高亮条）
var drumValue = 0;          // 当前显示的 centisecond 值
var drumItemH = 30;         // 每项高度（px）
var DRUM_SLOTS = 9;         // DOM slot 数（7 可见 + 上下各 1 缓冲）
var drumStep = 1;           // 步进粒度（centiseconds）
var drumSlots = [];         // 灰色层 DOM 元素引用
var drumSlotsWhite = [];    // 白色层 DOM 元素引用
var drumAnimTimer = null;   // 滑动动画定时器
var drumIsDragging = false; // 是否正在拖动中

// NOTE: Web Audio tick 音效 — 模拟 iOS picker 滴答声
var drumAudioCtx = null;

function drumTick() {
    // 震动反馈（移动端）
    if (navigator.vibrate) navigator.vibrate(3);

    // 音效反馈
    try {
        if (!drumAudioCtx) {
            drumAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        // NOTE: 浏览器 autoplay policy 要求在用户手势中 resume()
        // 已 running 时 resume() 是 no-op，无开销
        if (drumAudioCtx.state === 'suspended') drumAudioCtx.resume();
        var ctx = drumAudioCtx;
        // 极短正弦波脉冲（1200Hz，持续 8ms）
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 1200;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.008);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.01);
    } catch (e) {
        // HACK: 部分浏览器限制 AudioContext，静默忽略
    }
}

// NOTE: 同步滚筒显示 — 根据当前选中柱子/聚焦 input 格更新
export function syncDrum() {
    if (!drumEl) return;

    var val = 0;
    var p = activeCell[0], t = activeCell[1];

    // 优先检查聚焦的 input 格
    if (p >= 0 && t >= 0) {
        val = getCellVal(p, t);
    } else if (hasSelection()) {
        val = getSelectedValue(); // NOTE: 读取选中柱/PA/Avg 的实际值
    }

    // 空值或 DNF → 滚筒置灰
    if (val <= 0 || val >= DNF_VALUE) {
        drumEl.classList.add('empty');
        fillDrumSlots(0);
        return;
    }

    drumEl.classList.remove('empty');
    drumValue = val;
    drumStep = (state.event === '333fm' || isMbf()) ? 100 : 1;
    fillDrumSlots(val);
}

// NOTE: 创建 DOM slots（只执行一次）
function createDrumSlots() {
    drumList.innerHTML = '';
    drumListWhite.innerHTML = '';
    drumSlots = [];
    drumSlotsWhite = [];
    for (var i = 0; i < DRUM_SLOTS; i++) {
        // 灰色层
        var item = document.createElement('div');
        item.className = 'np-drum-item';
        drumList.appendChild(item);
        drumSlots.push(item);
        // 白色层（完全相同的结构）
        var itemW = document.createElement('div');
        itemW.className = 'np-drum-item';
        drumListWhite.appendChild(itemW);
        drumSlotsWhite.push(itemW);
    }
}

// NOTE: 更新所有 slot 的文本（两层同步）
function fillDrumSlots(centerVal) {
    var centerIdx = Math.floor(DRUM_SLOTS / 2);
    for (var i = 0; i < DRUM_SLOTS; i++) {
        var v = centerVal + (i - centerIdx) * drumStep;
        var text = (v > 0 && v < DNF_VALUE && centerVal > 0) ? formatTime(v) : '';
        drumSlots[i].textContent = text;
        drumSlotsWhite[i].textContent = text;
    }
    // 非拖动状态下重置位置
    if (!drumIsDragging) {
        setDrumStyle('transition', 'none');
        setDrumStyle('transform', 'translateY(0px)');
    }
    updateDrumTransforms(0);
}

// NOTE: 同步两层样式的辅助函数（DRY）
function setDrumStyle(prop, val) {
    drumList.style[prop] = val;
    if (drumListWhite) drumListWhite.style[prop] = val;
}

// NOTE: 动态计算每项的 rotateX/scale — 基于像素偏移实现连续平滑 3D 圆柱
// scrollOffset: 当前列表的 translateY 像素偏移（正 = 向上偏移）
var MAX_DEG = 55; // 最大旋转角（最外层）

function updateDrumTransforms(scrollOffset) {
    if (!scrollOffset) scrollOffset = 0;
    var centerIdx = Math.floor(DRUM_SLOTS / 2);
    // NOTE: 每次都用最新 drumItemH 计算（initDrum 后可能变化）
    var degPerPx = drumItemH > 0 ? (15 / drumItemH) : 0.5;
    for (var i = 0; i < DRUM_SLOTS; i++) {
        var offsetPx = (i - centerIdx) * drumItemH + scrollOffset;
        var deg = offsetPx * degPerPx;
        deg = Math.max(-MAX_DEG, Math.min(MAX_DEG, deg));
        // 缩放：中心=1，边缘=0.85（减小幅度避免视觉跳动）
        var absDeg = Math.abs(deg);
        var s = 1 - (absDeg / MAX_DEG) * 0.15;
        var tf = 'scale(' + s.toFixed(3) + ') rotateX(' + deg.toFixed(1) + 'deg)';
        drumSlots[i].style.transform = tf;
        if (drumSlotsWhite[i]) drumSlotsWhite[i].style.transform = tf;
    }
}

// NOTE: 带滑动动画的单步调整（用于滚轮/键盘/惯性）
function drumAnimateStep(dir) {
    if (drumAnimTimer) { clearTimeout(drumAnimTimer); drumAnimTimer = null; }

    // 1. 先更新内容到新值（确保 .center 文字始终与高亮条对齐）
    fillDrumSlots(drumValue);

    // 2. 从偏移位置开始（模拟旧值还在中间的视觉）
    var startOffset = dir * drumItemH;
    setDrumStyle('transition', 'none');
    setDrumStyle('transform', 'translateY(' + startOffset + 'px)');
    updateDrumTransforms(startOffset);

    // 3. 强制重排确保起始位置生效
    void drumList.offsetHeight;

    // 4. 动画滑入居中（新值从偏移方向滑入高亮条）
    setDrumStyle('transition', 'transform 0.12s cubic-bezier(0.22, 1, 0.36, 1)');
    setDrumStyle('transform', 'translateY(0px)');
}

// NOTE: 滚筒滑动触发值调整
function drumAdjust(dir, animate) {
    var p = activeCell[0], t = activeCell[1];

    // 优先调整聚焦的 input 格
    if (p >= 0 && t >= 0) {
        var rawVal = getCellVal(p, t);
        if (rawVal <= 0 || rawVal >= DNF_VALUE) return;
        var newVal = clampValue(rawVal + dir * drumStep);
        if (newVal === rawVal) return;
        setCellVal(p, t, newVal);
        getCellEl(p, t).value = formatTime(newVal);
        drumValue = newVal;
        drumTick();
        if (animate) {
            // NOTE: 先更新数据，动画结束后才 fillDrumSlots
            drumAnimateStep(dir);
        } else {
            fillDrumSlots(newVal);
        }
        // syncNumpadDisplay 会调 syncDrum，但我们已经手动管理了
        // 只同步 numpad label（如果有的话）
        var label = document.getElementById('numpad-label');
        var value = document.getElementById('numpad-value');
        if (label && value) {
            var pName = state.names[state.seedOn + p] || ('Player ' + p);
            label.textContent = pName + ' #' + (t + 1);
            value.textContent = cells[p][t] ? cells[p][t].value : '';
        }
        return;
    }

    // 其次调整选中的柱子
    if (hasSelection()) {
        adjustSelectedBar(dir, drumStep);
        // NOTE: adjustSelectedBar 触发 notify → onChange → syncDrum 自动更新
    }
}

function initDrum() {
    drumEl = document.getElementById('np-drum');
    drumList = document.getElementById('np-drum-list');
    if (!drumEl || !drumList) return;

    // NOTE: 创建静态裁剪窗口 — clip-path 在不动的窗口上，列表在内滑动
    var drumWhiteWindow = document.createElement('div');
    drumWhiteWindow.className = 'np-drum-white-window';
    drumEl.appendChild(drumWhiteWindow);

    drumListWhite = document.createElement('div');
    drumListWhite.id = 'np-drum-list-white';
    drumListWhite.className = 'np-drum-list-white';
    drumWhiteWindow.appendChild(drumListWhite);

    // 预创建 DOM slots（两层同步）
    createDrumSlots();
    drumEl.classList.add('empty');
    fillDrumSlots(0);

    // 刷新项高
    drumItemH = 30;
    if (drumSlots[0] && drumSlots[0].offsetHeight > 0) drumItemH = drumSlots[0].offsetHeight;

    // NOTE: 选中柱子时同步聚焦对应单元格（蓝底 + 全选）
    // NOTE: 移动端触摸 SVG 后浏览器会在 touchend 阶段重置非直接触摸元素的选区，
    // 导致 focus+select 一闪而过。移动端仅依赖 .cell-synced 视觉高亮，
    // 但必须设置 activeCell 保证 numpad 输入到正确格子
    document.addEventListener('bar-select-cell', function (e) {
        if (!e.detail) return;
        var p = e.detail.player, t = e.detail.slot;
        var el = getCellEl(p, t);
        if (!el) return;
        if ('ontouchstart' in window) {
            // NOTE: 移动端不 focus（避免选区一闪而过），但设置 activeCell
            // 保证 numpad/滚筒输入目标正确
            activeCell = [p, t];
            barSelectPending = true;
            syncNumpadDisplay();
        } else {
            el.focus();
            el.select();
        }
    });

    // NOTE: 监听柱子选中/拖动事件 → 同步滚筒 + 单元格
    document.addEventListener('drum-sync', function (e) {
        // 拖动过程中 detail 携带 player/slot/value → 实时更新单元格
        if (e.detail && e.detail.value !== undefined) {
            var d = e.detail;
            var el = getCellEl(d.player, d.slot);
            if (el) el.value = formatTime(d.value);
        }
        syncDrum();

        // NOTE: 选中普通柱时高亮对应单元格
        var prevSynced = document.querySelector('.cell-synced');
        if (prevSynced) prevSynced.classList.remove('cell-synced');
        var info = getSelectedInfo();
        if (info && !info.pa) {
            var cellEl = getCellEl(info.player, info.slot);
            if (cellEl) cellEl.classList.add('cell-synced');
        }
    });

    var dragStartY = 0;
    var dragStartVal = 0;   // 拖动起始时的值快照
    var isDragging = false;
    var lastMoveTime = 0;
    var lastMoveY = 0;
    var velocity = 0;       // px/ms（惯性用）
    var inertiaRaf = null;
    var lastBarStepIdx = 0; // 柱子模式用——上次步进位置

    function onStart(e) {
        e.preventDefault();
        if (inertiaRaf) { cancelAnimationFrame(inertiaRaf); inertiaRaf = null; }
        if (drumAnimTimer) { clearTimeout(drumAnimTimer); drumAnimTimer = null; }
        isDragging = true;
        drumIsDragging = true;
        velocity = 0;
        var pt = e.touches ? e.touches[0] : e;
        dragStartY = pt.clientY;
        dragStartVal = drumValue; // NOTE: 快照当前值作为基准
        lastBarStepIdx = 0;       // NOTE: 柱子模式步进计数器归零
        lastMoveY = pt.clientY;
        lastMoveTime = Date.now();
        setDrumStyle('transition', 'none');

        if (drumSlots[0] && drumSlots[0].offsetHeight > 0) {
            drumItemH = drumSlots[0].offsetHeight;
        }
    }

    function onMove(e) {
        if (!isDragging) return;
        e.preventDefault();
        var pt = e.touches ? e.touches[0] : e;

        // 速度追踪（惯性用）
        var now = Date.now();
        var dt = now - lastMoveTime;
        if (dt > 0) velocity = (pt.clientY - lastMoveY) / dt;
        lastMoveY = pt.clientY;
        lastMoveTime = now;

        var p = activeCell[0], t = activeCell[1];

        // NOTE: 连续追踪（输入格 / 柱子共用）
        var totalDy = pt.clientY - dragStartY;
        var scrollPos = -totalDy;
        var stepIdx = Math.round(scrollPos / drumItemH);

        if (p >= 0 && t >= 0) {
            // ── 输入格模式：直接设值 ──
            var newVal = clampValue(dragStartVal + stepIdx * drumStep);
            if (newVal !== drumValue) {
                drumValue = newVal;
                setCellVal(p, t, newVal);
                getCellEl(p, t).value = formatTime(newVal);
                drumTick();
            }
            fillDrumSlots(newVal);
        } else {
            // ── 柱子模式：增量调用 adjustSelectedBar ──
            if (stepIdx !== lastBarStepIdx) {
                var delta = stepIdx - lastBarStepIdx;
                for (var s = 0; s < Math.abs(delta); s++) {
                    drumAdjust(delta > 0 ? 1 : -1, false);
                }
                lastBarStepIdx = stepIdx;
                drumTick();
            }
        }

        // NOTE: sub-pixel 偏移 → 像素级丝滑（两种模式共用）
        var snappedPos = stepIdx * drumItemH;
        var fractional = scrollPos - snappedPos;
        setDrumStyle('transform', 'translateY(' + (-fractional) + 'px)');
        updateDrumTransforms(-fractional);
    }

    function onEnd(e) {
        if (!isDragging) return;
        isDragging = false;
        drumIsDragging = false;

        // NOTE: 回弹归位动画（cubic-bezier 缓出 = iOS 弹性手感）
        setDrumStyle('transition', 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)');
        setDrumStyle('transform', 'translateY(0px)');
        updateDrumTransforms(0);

        // 惯性滚动
        if (Math.abs(velocity) > 0.3) {
            startInertia(velocity);
        }
    }

    function startInertia(v) {
        var FRICTION = 0.93;
        var accum = 0;

        function tick() {
            v *= FRICTION;
            if (Math.abs(v) < 0.03) return;

            accum += v * 16;
            var steps = Math.round(-accum / drumItemH);
            if (steps !== 0) {
                for (var s = 0; s < Math.abs(steps); s++) {
                    drumAdjust(steps > 0 ? 1 : -1, true);
                }
                accum = 0;
            }

            inertiaRaf = requestAnimationFrame(tick);
        }
        inertiaRaf = requestAnimationFrame(tick);
    }

    // 注册事件
    drumEl.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    drumEl.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);

    // NOTE: 鼠标滚轮 — 带动画的单步微调
    drumEl.addEventListener('wheel', function (e) {
        e.preventDefault();
        var dir = e.deltaY < 0 ? 1 : -1;
        drumAdjust(dir, true);
    }, { passive: false });
}

