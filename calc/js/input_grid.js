// NOTE: 输入网格 + 键盘导航 + 数字键盘
// 替代原 canvas overlay hack，使用原生 <input> 元素

import {
    DNF_VALUE, MAX_TIME_VALUE, formatTime, textToTime
} from './calc_engine.js';
import {
    state, updateTime, notify, solveCount
} from './state.js';
import * as drumPicker from './drum_picker.js';
import { getTargetAvg, setTargetAvg } from './calc_table.js';
import { isWR } from './wr_data.js';

// NOTE: 当前聚焦的单元格 [player, solve]，-1 表示无聚焦
var activeCell = [-1, -1];
// NOTE: 秒表回调（由 app.js 注册，避免循环依赖）
var stopwatchCallback = null;
// NOTE: 撤销栈 — 每条记录 {playerIdx, solveIdx, oldValue}
var undoStack = [];
var UNDO_MAX = 50;
// NOTE: 滚轮撤销 debounce — 连续滚动合并为一条撤销记录
var wheelUndoTimer = null;
var wheelUndoBase = null; // 滚动序列开始前的原始值
// NOTE: 程序化导航时抑制滚筒弹出（Enter/Tab/自动跳格）
var suppressDrumOnFocus = false;

// NOTE: 根据文字长度自适应缩小字号，防止长时间格式（如 1:10.10）溢出
function fitFont(input) {
    var len = input.value.length;
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
// 比赛名输入框引用
var compNameInput = null;
// NOTE: WR 徽章 DOM 引用 — wrBadges[p][t] 对应 player p 的第 t 个时间格的 WR badge
var wrBadges = [[], []];

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
        }

        // NOTE: 第 6 列 — Target Avg，复用 createTimeCell 逻辑
        var tavgWrapper = createTimeCell(p, TAVG_T);
        row.appendChild(tavgWrapper);
        tavgCells[p] = tavgWrapper.querySelector('input');

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

    // NOTE: 初始化滚筒选择器
    drumPicker.init();
}

// ── 创建输入元素 ──

// NOTE: 自动跳格 — 输入满足条件时自动保存并跳到下一格
// 仅限三阶(333)，其他项目成绩范围不同
// 由 input 事件和 numpad 数字键共享调用
function tryAutoAdvance(rawVal) {
    if (state.event !== '333') return;
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
        activeCell = [p, t];
        input.select();
        syncNumpadDisplay();
        // NOTE: 聚焦已有值的 cell 时显示滚筒选择器
        // 程序化导航（Enter/Tab/自动跳格）时不弹滚筒，只有用户主动点击才弹
        if (suppressDrumOnFocus) {
            suppressDrumOnFocus = false;
            drumPicker.hide();
        } else {
            var rawVal = getCellVal(p, t);
            if (rawVal > 0 && rawVal < DNF_VALUE) {
                drumPicker.show(rawVal, input, function(newVal) {
                    // 滚筒值变更回调 — 更新 state 和 cell 显示
                    recordAndUpdate(state.seedOn + p, t, newVal);
                    getCellEl(p, t).value = formatTime(newVal);
                    syncNumpadDisplay();
                }, function() {
                    // NOTE: 滚筒确认回调 — 点击高亮区域后跳到下一格
                    saveCell(p, t);
                    var nxt = nextCell(p, t);
                    if (nxt) {
                        navigateTo(nxt[0], nxt[1]);
                    } else {
                        getCellEl(p, t).blur();
                        activeCell = [-1, -1];
                    }
                });
            } else {
                drumPicker.hide();
            }
        }
    });
    input.addEventListener('blur', () => {
        // NOTE: 延迟检测 — 如果焦点转移到另一个格子则不触发保存（由导航逻辑处理）
        setTimeout(() => {
            if (activeCell[0] === p && activeCell[1] === t) {
                saveCell(p, t);
                activeCell = [-1, -1];
                syncNumpadDisplay();
                drumPicker.hide();
            }
        }, 50);
    });
    input.addEventListener('input', () => {
        syncNumpadDisplay();
        // NOTE: tavg 格不自动跳格
        if (!isTavg(t)) tryAutoAdvance(input.value);
        // NOTE: 用户开始键入时隐藏滚筒，避免遮挡
        drumPicker.hide();
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
    if (state.event === '333fm') {
        step = 100; // FMC: 1步 = 100cs
    } else if (e.ctrlKey) {
        step = 100; // 1.00s
    } else if (e.shiftKey) {
        step = 10;  // 0.10s
    }

    var dir = e.deltaY < 0 ? 1 : -1;
    var newVal = Math.max(1, rawVal + dir * step);
    if (newVal > MAX_TIME_VALUE) newVal = MAX_TIME_VALUE;
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

// NOTE: 勾选框切换 — 启用/禁用该行所有时间格
function onTogglePlayer(e) {
    var p = parseInt(e.target.dataset.player);
    var disabled = !e.target.checked;
    state.playerEnabled[p] = e.target.checked;
    var n = solveCount();
    for (var t = 0; t < n; t++) {
        cells[p][t].disabled = disabled;
        cells[p][t].style.opacity = disabled ? '0.3' : '1';
    }
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
    var val = textToTime(input.value);
    recordAndUpdate(state.seedOn + p, t, val);
    // 回显格式化后的值
    var rawVal = getCellVal(p, t);
    input.value = (rawVal > 0 && rawVal < DNF_VALUE) ? formatTime(rawVal) : (rawVal >= DNF_VALUE ? 'DNF' : '');
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

    // NOTE: 程序化导航时抑制滚筒弹出
    suppressDrumOnFocus = true;
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
        drumPicker.hide();
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
        drumPicker.hide();
        if (isFullySelected(v)) {
            // NOTE: 全选状态下一键清空 — 必须同时写 state，否则 refresh 会还原
            recordAndUpdate(state.seedOn + p, t, 0);
            v.value = '';
            syncNumpadDisplay();
            drumPicker.hide();
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
        drumPicker.hide();
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
        drumPicker.hide();
        if (isFullySelected(v)) v.value = '';
        v.value += key;
        syncNumpadDisplay();
        // NOTE: numpad 数字键也触发自动跳格
        tryAutoAdvance(v.value);
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
    var n = solveCount();
    for (var p = 0; p < 2; p++) {
        for (var t = 0; t < 5; t++) {
            if (t < n) {
                var rawVal = state.times[state.seedOn + p][t];
                cells[p][t].value = (rawVal > 0 && rawVal < DNF_VALUE)
                    ? formatTime(rawVal)
                    : (rawVal >= DNF_VALUE ? 'DNF' : '');
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
        tavgCells[p].value = tavg > 0 ? formatTime(tavg) : '';
        fitFont(tavgCells[p]);
    }
    syncNumpadDisplay();
    // NOTE: 检测单次 WR — 显示/隐藏 WR badge
    for (var p2 = 0; p2 < 2; p2++) {
        for (var t2 = 0; t2 < 5; t2++) {
            if (wrBadges[p2][t2]) {
                var val = state.times[state.seedOn + p2][t2];
                var show = val > 0 && val < DNF_VALUE && isWR(state.event, 'single', val);
                wrBadges[p2][t2].style.display = show ? '' : 'none';
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
            state.times[state.seedOn + p][t] = textToTime(cells[p][t].value);
        }
        // Target Avg 也同步
        setTargetAvg(state.seedOn + p, textToTime(tavgCells[p].value));
    }
}
