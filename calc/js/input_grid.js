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
        // NOTE: touchstart preventDefault 后 click 不触发，需用 touchend 补偿
        numpadGrid.addEventListener('touchend', onNumpadClick);
        numpadGrid.addEventListener('click', onNumpadClick);
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
}

// ── 保存与导航 ──

// NOTE: 保存单元格值到 state
function saveCell(p, t) {
    var input = cells[p][t];
    var val = textToTime(input.value);
    updateTime(state.seedOn + p, t, val);
    // 回显格式化后的值
    var rawVal = state.times[state.seedOn + p][t];
    input.value = (rawVal > 0 && rawVal < DNF_VALUE) ? formatTime(rawVal) : (rawVal >= DNF_VALUE ? 'DNF' : '');
}

// NOTE: 导航到指定单元格
function navigateTo(p, t) {
    if (p < 0 || p > 1 || t < 0 || t > 4) return;

    // 先保存当前格
    if (activeCell[0] >= 0 && activeCell[1] >= 0) {
        saveCell(activeCell[0], activeCell[1]);
    }

    activeCell = [p, t];
    cells[p][t].focus();
    cells[p][t].select();
}

// ── 键盘处理 ──

function onKeyDown(e) {
    var p = activeCell[0];
    var t = activeCell[1];

    if (e.key === 'Enter') {
        if (p < 0) return;
        e.preventDefault();
        // 跳到同选手下一格
        if (t < 4) {
            navigateTo(p, t + 1);
        } else {
            saveCell(p, t);
            cells[p][t].blur();
            activeCell = [-1, -1];
        }
    } else if (e.key === 'Tab') {
        if (p < 0) return;
        e.preventDefault();
        // NOTE: A→B 同一把；B→A 下一把
        if (p === 0) {
            navigateTo(1, t);
        } else if (t < 4) {
            navigateTo(0, t + 1);
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
        // NOTE: 当前格为空时跨单元格向前删
        if (v.value.length === 0 && t > 0) {
            e.preventDefault();
            // 先修改上一格 state（navigateTo 会触发 refresh 覆盖 DOM）
            var prevVal = state.times[state.seedOn + p][t - 1];
            if (prevVal > 0 && prevVal < DNF_VALUE) {
                var prevText = formatTime(prevVal);
                var trimmed = prevText.slice(0, -1);
                var newVal = textToTime(trimmed);
                updateTime(state.seedOn + p, t - 1, newVal);
            }
            navigateTo(p, t - 1);
        }
    } else if (e.key === 'Delete') {
        if (p < 0) return;
        // NOTE: 跳到后一格清空
        if (t < 4) {
            e.preventDefault();
            saveCell(p, t);
            navigateTo(p, t + 1);
            cells[p][t + 1].value = '';
            syncNumpadDisplay();
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
        if (t < 4) {
            navigateTo(p, t + 1);
        } else {
            saveCell(p, t);
            v.blur();
            activeCell = [-1, -1];
        }
    } else if (key === 'tab') {
        if (p === 0) {
            navigateTo(1, t);
        } else if (t < 4) {
            navigateTo(0, t + 1);
        } else {
            saveCell(p, t);
            v.blur();
            activeCell = [-1, -1];
        }
    } else if (key === 'dnf') {
        v.value = 'DNF';
        syncNumpadDisplay();
        // 自动跳到下一格
        if (t < 4) {
            navigateTo(p, t + 1);
        } else {
            saveCell(p, t);
            v.blur();
            activeCell = [-1, -1];
        }
    } else if (key === 'backspace') {
        if (v.value.length > 0) {
            v.value = v.value.slice(0, -1);
            syncNumpadDisplay();
        } else if (t > 0) {
            // NOTE: 先修改上一格的显示值 → 写回 state，再 navigateTo
            // navigateTo 内部的 saveCell→notify→refresh 会重置所有 cell.value，
            // 所以必须在 navigateTo 之前就把上一格的新值写入 state
            var prevVal = state.times[state.seedOn + p][t - 1];
            if (prevVal > 0 && prevVal < DNF_VALUE) {
                var prevText = formatTime(prevVal);
                var trimmed = prevText.slice(0, -1);
                var newVal = textToTime(trimmed);
                updateTime(state.seedOn + p, t - 1, newVal);
            }
            navigateTo(p, t - 1);
        }
    } else if (key === 'dotcolon') {
        // NOTE: .: 按钮 — 末尾是 . 则替换为 :，否则追加 .
        if (v.value.length > 0 && v.value[v.value.length - 1] === '.') {
            v.value = v.value.slice(0, -1) + ':';
        } else {
            v.value += '.';
        }
        syncNumpadDisplay();
    } else {
        // 数字键 0-9
        v.value += key;
        syncNumpadDisplay();
    }

    v.focus();
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
