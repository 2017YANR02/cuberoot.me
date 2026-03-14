// NOTE: 输入网格 + 键盘导航 + 数字键盘
// 替代原 canvas overlay hack，使用原生 <input> 元素

import {
    DNF_VALUE, formatTime, textToTime
} from './calc_engine.js';
import {
    state, updateTime, notify
} from './state.js';

// NOTE: 当前聚焦的单元格 [player, solve]，-1 表示无聚焦
var activeCell = [-1, -1];
// NOTE: 秒表回调（由 app.js 注册，避免循环依赖）
var stopwatchCallback = null;
// NOTE: 撤销栈 — 每条记录 {playerIdx, solveIdx, oldValue}
var undoStack = [];
var UNDO_MAX = 50;

// NOTE: 检测 input 文本是否处于全选状态
function isFullySelected(input) {
    return input.selectionStart === 0 && input.selectionEnd === input.value.length && input.value.length > 0;
}

// 输入框 DOM 引用缓存 — cells[p][t] 对应 player p 的第 t 个时间格
var cells = [[], []];
// 名字输入框引用
var nameCells = [null, null];
// 比赛名输入框引用
var compNameInput = null;

// ── 初始化 ──

export function init(gridContainer) {
    compNameInput = document.getElementById('comp-name');
    compNameInput.value = state.compName;
    compNameInput.addEventListener('change', () => {
        state.compName = compNameInput.value;
        notify();
    });

    // 创建输入网格：2 行 × (5 时间格 + 1 名字格 + 1 勾选)
    for (var p = 0; p < 2; p++) {
        var row = document.createElement('div');
        row.className = 'input-row player-' + (p === 0 ? 'a' : 'b');

        for (var t = 0; t < 5; t++) {
            var input = createTimeCell(p, t);
            row.appendChild(input);
            cells[p][t] = input;
        }

        var nameInput = createNameCell(p);
        row.appendChild(nameInput);
        nameCells[p] = nameInput;

        // NOTE: 勾选框 — 控制是否启用该选手的时间输入
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = true;
        cb.className = 'player-toggle';
        cb.dataset.player = p;
        cb.addEventListener('change', onTogglePlayer);
        row.appendChild(cb);

        gridContainer.appendChild(row);
    }

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
}

// ── 创建输入元素 ──

function createTimeCell(p, t) {
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'time-cell';
    input.inputMode = 'none'; // 抑制移动端系统键盘
    input.autocomplete = 'off';
    input.dataset.player = p;
    input.dataset.solve = t;
    input.placeholder = '#' + (t + 1);

    input.addEventListener('focus', () => {
        activeCell = [p, t];
        input.select();
        syncNumpadDisplay();
    });
    input.addEventListener('blur', () => {
        // NOTE: 延迟检测 — 如果焦点转移到另一个格子则不触发保存（由导航逻辑处理）
        setTimeout(() => {
            if (activeCell[0] === p && activeCell[1] === t) {
                saveCell(p, t);
                activeCell = [-1, -1];
                syncNumpadDisplay();
            }
        }, 50);
    });
    input.addEventListener('input', () => {
        syncNumpadDisplay();
    });

    return input;
}

function createNameCell(p) {
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'name-cell';
    input.autocomplete = 'off';
    input.value = state.names[state.seedOn + p];
    input.placeholder = 'Name ' + (p === 0 ? 'A' : 'B');

    input.addEventListener('change', () => {
        state.names[state.seedOn + p] = input.value;
        notify();
    });

    return input;
}

// ── 选手启用/禁用 ──

// NOTE: 勾选框切换 — 启用/禁用该行所有时间格
function onTogglePlayer(e) {
    var p = parseInt(e.target.dataset.player);
    var disabled = !e.target.checked;
    state.playerEnabled[p] = e.target.checked;
    for (var t = 0; t < 5; t++) {
        cells[p][t].disabled = disabled;
        cells[p][t].style.opacity = disabled ? '0.3' : '1';
    }
    // NOTE: 触发图表重绘以隐藏/显示对应柱子
    notify();
}

// ── 保存与导航 ──

// NOTE: 带撤销记录的 updateTime 包装 — 自动在修改前记录旧值
function recordAndUpdate(playerIdx, solveIdx, value) {
    var oldValue = state.times[playerIdx][solveIdx];
    if (oldValue === value) return; // 值没变，不记录
    undoStack.push({ playerIdx: playerIdx, solveIdx: solveIdx, oldValue: oldValue, seedOn: state.seedOn });
    if (undoStack.length > UNDO_MAX) undoStack.shift();
    updateTime(playerIdx, solveIdx, value);
}

// NOTE: 保存单元格值到 state
function saveCell(p, t) {
    var input = cells[p][t];
    var val = textToTime(input.value);
    recordAndUpdate(state.seedOn + p, t, val);
    // 回显格式化后的值
    var rawVal = state.times[state.seedOn + p][t];
    input.value = (rawVal > 0 && rawVal < DNF_VALUE) ? formatTime(rawVal) : (rawVal >= DNF_VALUE ? 'DNF' : '');
}

// NOTE: 导航到指定单元格
export function navigateTo(p, t) {
    if (p < 0 || p > 1 || t < 0 || t > 4) return;

    // 先保存当前格
    if (activeCell[0] >= 0 && activeCell[1] >= 0) {
        saveCell(activeCell[0], activeCell[1]);
    }

    activeCell = [p, t];
    cells[p][t].focus();
    cells[p][t].select();
}

// NOTE: 计算下一个单元格 — 双选手启用时按列 zigzag（A0→B0→A1→B1→...），单选手时同行水平
// 返回 [p, t] 或 null（已到末尾）
function nextCell(p, t) {
    var bothEnabled = state.playerEnabled[0] && state.playerEnabled[1];
    if (bothEnabled) {
        // zigzag: A→B 同列，B→A 下一列
        if (p === 0) return [1, t];
        if (t < 4) return [0, t + 1];
        return null;
    }
    // 单选手：同行右移
    if (t < 4) return [p, t + 1];
    return null;
}

// NOTE: 计算上一个单元格 — 反向 zigzag
// 返回 [p, t] 或 null（已到开头）
function prevCell(p, t) {
    var bothEnabled = state.playerEnabled[0] && state.playerEnabled[1];
    if (bothEnabled) {
        // 反向 zigzag: B→A 同列，A→B 上一列
        if (p === 1) return [0, t];
        if (t > 0) return [1, t - 1];
        return null;
    }
    // 单选手：同行左移
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
            cells[p][t].blur();
            activeCell = [-1, -1];
        }
    } else if (e.key === 'Tab') {
        if (p < 0) return;
        e.preventDefault();
        // NOTE: Tab 始终按列 zigzag（不受单选手影响）
        if (p === 0 && state.playerEnabled[1]) {
            navigateTo(1, t);
        } else if (t < 4) {
            navigateTo(state.playerEnabled[0] ? 0 : 1, t + 1);
        } else {
            saveCell(p, t);
            cells[p][t].blur();
            activeCell = [-1, -1];
        }
    } else if (e.key === 'Escape') {
        if (p < 0) return;
        // 取消编辑，恢复原值
        var rawVal = state.times[state.seedOn + p][t];
        cells[p][t].value = (rawVal > 0 && rawVal < DNF_VALUE) ? formatTime(rawVal) : (rawVal >= DNF_VALUE ? 'DNF' : '');
        cells[p][t].blur();
        activeCell = [-1, -1];
        syncNumpadDisplay();
    } else if (e.key === 'Backspace') {
        if (p < 0) return;
        var v = cells[p][t];
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
            cells[del[0]][del[1]].value = '';
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
        // NOTE: 同行向左一格
        if (t > 0) navigateTo(p, t - 1);
    } else if (e.key === 'ArrowRight') {
        if (p < 0) return;
        e.preventDefault();
        // NOTE: 同行向右一格
        if (t < 4) navigateTo(p, t + 1);
    } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        // NOTE: Ctrl+Z 撤销上一次单元格修改并跳回该格
        e.preventDefault();
        if (undoStack.length === 0) return;
        var undo = undoStack.pop();
        updateTime(undo.playerIdx, undo.solveIdx, undo.oldValue);
        // 刷新所有输入框显示
        refresh();
        // NOTE: 跳回被撤销的单元格（仅当仍在同一 seed 页时）
        var displayP = undo.playerIdx - undo.seedOn;
        if (undo.seedOn === state.seedOn && displayP >= 0 && displayP <= 1) {
            activeCell = [displayP, undo.solveIdx];
            cells[displayP][undo.solveIdx].focus();
            cells[displayP][undo.solveIdx].select();
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
    var p = activeCell[0];
    var t = activeCell[1];

    // 如果没有活跃单元格，聚焦第一个空格
    if (p < 0 || t < 0) {
        // 找到第一个空格
        for (var ti = 0; ti < 5; ti++) {
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

    var v = cells[p][t];

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
        // NOTE: Tab 始终按列 zigzag
        if (p === 0 && state.playerEnabled[1]) {
            navigateTo(1, t);
        } else if (t < 4) {
            navigateTo(state.playerEnabled[0] ? 0 : 1, t + 1);
        } else {
            saveCell(p, t);
            v.blur();
            activeCell = [-1, -1];
        }
    } else if (key === 'dnf') {
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
        if (isFullySelected(v)) {
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
        if (isFullySelected(v)) v.value = '';
        // NOTE: .: 按钮 — 末尾是 . 则替换为 :，否则追加 .
        if (v.value.length > 0 && v.value[v.value.length - 1] === '.') {
            v.value = v.value.slice(0, -1) + ':';
        } else {
            v.value += '.';
        }
        syncNumpadDisplay();
    } else {
        // 数字键 0-9 — 全选时替换而非追加
        if (isFullySelected(v)) v.value = '';
        v.value += key;
        syncNumpadDisplay();
    }

    // NOTE: 仅当未跳转（activeCell 未变）时才 refocus 原格
    if (activeCell[0] === p && activeCell[1] === t) {
        v.focus();
    }
}

// ── 数字键盘显示同步 ──

function syncNumpadDisplay() {
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
    for (var p = 0; p < 2; p++) {
        for (var t = 0; t < 5; t++) {
            var rawVal = state.times[state.seedOn + p][t];
            cells[p][t].value = (rawVal > 0 && rawVal < DNF_VALUE)
                ? formatTime(rawVal)
                : (rawVal >= DNF_VALUE ? 'DNF' : '');
        }
        nameCells[p].value = state.names[state.seedOn + p];
    }
    syncNumpadDisplay();
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
    }
}
