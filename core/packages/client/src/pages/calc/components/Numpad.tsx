// NOTE: 数字键盘组件 — 从 input_grid.js 的 numpad 部分迁移
// iOS 风格计算器键盘 + drum 滚筒微调
// 功能：数字输入、小数点/冒号切换、退格/清空、DNF、Rand、Enter 确认
// 行为规则 1:1 还原自 D:\cube\副本\legacy\calc\js\input_grid.js

import { useCallback, useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCalcStore, isMbfForEvent } from '../stores/calc_store';
import {
  DNF_VALUE, formatTime, textToTime, textToMbfScore, clampValue,
} from '../engine/calc_engine';
import { sampleKDE } from '../engine/wr_data';
import { shouldAutoAdvance } from '../engine/auto_advance';
import { Drum } from './Drum';

// ── 撤销栈（模块级，跨渲染保持）──
interface UndoEntry {
  playerIdx: number;
  solveIdx: number;
  oldValue: number;
  seedOn: number;
}
const undoStack: UndoEntry[] = [];
const UNDO_MAX = 50;

/** 带撤销的 updateTime 包装 */
function recordAndUpdate(playerIdx: number, solveIdx: number, value: number) {
  const s = useCalcStore.getState();
  const oldValue = s.times[playerIdx]?.[solveIdx] ?? 0;
  if (oldValue === value) return;
  undoStack.push({ playerIdx, solveIdx, oldValue, seedOn: s.seedOn });
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  s.updateTime(playerIdx, solveIdx, value);
}

// ── 导航辅助 ──

/** 下一个单元格 — zigzag (A0→B0→A1→B1→...) */
function nextCell(p: number, t: number): [number, number] | null {
  const s = useCalcStore.getState();
  const maxT = s.solveCount() - 1;
  const both = s.playerEnabled[0] && s.playerEnabled[1];
  if (both) {
    if (p === 0) return [1, t];
    if (t < maxT) return [0, t + 1];
    return null;
  }
  if (t < maxT) return [p, t + 1];
  return null;
}

/** 上一个单元格 — 反向 zigzag。t = -1 表示 tavg 槽位（在 #1 左边） */
function prevCell(p: number, t: number): [number, number] | null {
  const s = useCalcStore.getState();
  const both = s.playerEnabled[0] && s.playerEnabled[1];
  if (both) {
    if (p === 1) return [0, t];
    if (t > -1) return [1, t - 1];
    return null;
  }
  if (t > -1) return [p, t - 1];
  return null;
}

/** 导航到指定单元格 DOM。t < 0 → tavg 单元格 */
function navigateToCell(p: number, t: number) {
  if (t < 0) {
    const tavgs = document.querySelectorAll<HTMLInputElement>('.input-row .tavg-cell');
    if (tavgs[p]) {
      tavgs[p].focus();
      tavgs[p].select();
    }
    return;
  }
  const s = useCalcStore.getState();
  const sc = s.solveCount();
  const cells = document.querySelectorAll<HTMLInputElement>('.input-row .time-cell:not(.tavg-cell)');
  const idx = p * sc + t;
  if (cells[idx]) {
    cells[idx].focus();
    cells[idx].select();
  }
}

// ── 自动跳格 ──
// NOTE: 原版仅限 333，用户要求扩展到所有项目
// 规则基于数字位数和格式自动判断输入完成 — 实现迁到 engine/auto_advance.ts(简易版 textarea 共用)

function tryAutoAdvance(rawVal: string, p: number, t: number) {
  const s = useCalcStore.getState();
  // NOTE: 多盲得分模式下禁用（得分通常 1~2 位数）
  if (isMbfForEvent(s.event)) return;
  if (!shouldAutoAdvance(rawVal)) return;

  const val = rawVal.trim();
  const absIdx = s.seedOn + p;
  const isMbf = isMbfForEvent(s.event);
  const parsed = isMbf ? textToMbfScore(val) : textToTime(val);
  recordAndUpdate(absIdx, t, parsed);
  s.saveToUrl();
  const nxt = nextCell(p, t);
  if (nxt) {
    navigateToCell(nxt[0], nxt[1]);
  }
}

interface NumpadProps {
  /** 按"随机"键时调用 — CalcPage 用它在没有 override 时按需加载世界 TOP 2 KDE 数据 */
  onEnsureWrTop2Loaded?: () => Promise<void>;
}

export function Numpad({ onEnsureWrTop2Loaded }: NumpadProps = {}) {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const state = useCalcStore();
  const [target, setTarget] = useState<[number, number]>([-1, -1]);

  const isLongPress = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [clearMode, setClearMode] = useState(false);

  const isMbf = isMbfForEvent(state.event);

  // NOTE: 获取当前聚焦的 time-cell input 元素
  const getFocusedInput = useCallback((): HTMLInputElement | null => {
    const el = document.activeElement;
    if (el instanceof HTMLInputElement && el.classList.contains('time-cell')) {
      return el;
    }
    // fallback — 用 store.focusedCell 找对应的 DOM input
    const [fp, ft] = useCalcStore.getState().focusedCell;
    if (fp >= 0 && ft >= 0) {
      navigateToCell(fp, ft);
      const el2 = document.activeElement;
      if (el2 instanceof HTMLInputElement) return el2;
    }
    return null;
  }, []);

  // NOTE: 从聚焦 input 获取 [p, t]。t = -1 表示 tavg-cell，也算 valid。
  const getFocusedPT = useCallback((): [number, number] => {
    const [fp, ft] = useCalcStore.getState().focusedCell;
    if (fp >= 0 && ft >= -1) return [fp, ft];
    return target;
  }, [target]);

  const updateTarget = useCallback(() => {
    const [p, t] = state.getFirstUnfilledTime(false);
    setTarget(p >= 0 && t >= 0 ? [p, t] : [-1, -1]);
  }, [state]);

  useEffect(() => {
    updateTarget();
  }, [state.times, state.seedOn, state.playerEnabled, updateTarget]);

  // ── 数字键 ──
  const pressDigit = useCallback((digit: string) => {
    const input = getFocusedInput();
    if (!input) return;
    if (navigator.vibrate) navigator.vibrate(10);
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    // 全选时替换
    const isFullSel = start === 0 && end === input.value.length && input.value.length > 0;
    if (isFullSel) {
      input.value = digit;
      input.selectionStart = input.selectionEnd = 1;
    } else {
      if (input.value.replace(/\D/g, '').length >= 7) return;
      input.value = input.value.slice(0, start) + digit + input.value.slice(end);
      input.selectionStart = input.selectionEnd = start + 1;
    }
    // NOTE: 自动跳格
    const [p, t] = getFocusedPT();
    if (p < 0) return;
    if (t < 0) {
      // tavg：与 #1~#5 同样的触发规则,提交到 targetAvg
      if (shouldAutoAdvance(input.value)) {
        const s = useCalcStore.getState();
        const isMbf2 = isMbfForEvent(s.event);
        if (isMbf2) return;
        const parsed = textToTime(input.value);
        s.setTargetAvg(s.seedOn + p, parsed);
        s.saveToUrl();
        const nxt = nextCell(p, -1);
        if (nxt) navigateToCell(nxt[0], nxt[1]);
      }
    } else {
      tryAutoAdvance(input.value, p, t);
    }
  }, [getFocusedInput, getFocusedPT]);

  // ── 小数点/冒号切换 ──
  // NOTE: ·: 按钮 — 末尾是 . 则替换为 :，否则追加 .（原版 L752-762）
  const pressDot = useCallback(() => {
    const input = getFocusedInput();
    if (!input) return;
    if (navigator.vibrate) navigator.vibrate(10);
    // 全选时先清空
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const isFullSel = start === 0 && end === input.value.length && input.value.length > 0;
    if (isFullSel) { input.value = ''; }
    // 末尾是 . → 替换为 :
    if (input.value.length > 0 && input.value[input.value.length - 1] === '.') {
      input.value = input.value.slice(0, -1) + ':';
    } else {
      input.value += '.';
    }
    input.selectionStart = input.selectionEnd = input.value.length;
  }, [getFocusedInput]);

  // ── 退格 ──
  const pressBackspace = useCallback(() => {
    if (clearMode) {
      const s = useCalcStore.getState();
      const sc = s.solveCount();
      for (let p = 0; p < 2; p++) {
        if (!s.playerEnabled[p]) continue;
        for (let t = 0; t < sc; t++) {
          s.updateTime(s.seedOn + p, t, 0);
        }
      }
      s.saveToUrl();
      setClearMode(false);
      return;
    }
    const input = getFocusedInput();
    if (!input) return;
    if (navigator.vibrate) navigator.vibrate(10);
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const isFullSel = start === 0 && end === input.value.length && input.value.length > 0;

    if (isFullSel || input.value.length === 0) {
      // NOTE: 直接保存空值到 store，延迟导航避免 React re-render 竞争
      const [p, t] = getFocusedPT();
      if (p >= 0) {
        const absIdx = state.seedOn + p;
        if (t < 0) state.setTargetAvg(absIdx, 0);
        else state.updateTime(absIdx, t, 0);
        state.saveToUrl();
        const prv = prevCell(p, t);
        if (prv) {
          requestAnimationFrame(() => navigateToCell(prv[0], prv[1]));
        }
      }
    } else {
      input.value = input.value.slice(0, -1);
    }
  }, [clearMode, getFocusedInput, getFocusedPT, state]);

  // ── 长按 ⌫ → Clear All ──
  const startLongPress = useCallback(() => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setClearMode(true);
    }, 500);
  }, []);

  const endLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!isLongPress.current) {
      pressBackspace();
    }
    if (clearMode) {
      pressBackspace();
    }
  }, [pressBackspace, clearMode]);

  // ── DNF ──
  // NOTE: DNF 后自动 zigzag 跳格（原版 L718-731）
  const pressDnf = useCallback(() => {
    const [p, t] = getFocusedPT();
    if (p < 0) return;
    if (navigator.vibrate) navigator.vibrate(10);
    const absIdx = state.seedOn + p;
    if (t < 0) state.setTargetAvg(absIdx, DNF_VALUE);
    else recordAndUpdate(absIdx, t, DNF_VALUE);
    state.saveToUrl();
    const input = getFocusedInput();
    if (input) input.value = 'DNF';
    // 自动跳格
    const nxt = nextCell(p, t);
    if (nxt) {
      navigateToCell(nxt[0], nxt[1]);
    }
    setTimeout(updateTarget, 50);
  }, [state, getFocusedPT, getFocusedInput, updateTarget]);

  // ── Rand ──
  // NOTE: 用户没指定选手时,自动 fall back 到世界 TOP 2 — 等 onEnsureWrTop2Loaded 拉数据后再采样
  const pressRand = useCallback(async () => {
    if (navigator.vibrate) navigator.vibrate(10);
    if (onEnsureWrTop2Loaded) await onEnsureWrTop2Loaded();
    // 拿最新 state — 上面 await 期间 store 可能已被 setTargetAvg 等改过
    const s = useCalcStore.getState();
    const sc = s.solveCount();
    let allFilled = true;
    for (let p = 0; p < 2; p++) {
      if (!s.playerEnabled[p]) continue;
      for (let t = 0; t < sc; t++) {
        if (!s.times[s.seedOn + p][t]) { allFilled = false; break; }
      }
      if (!allFilled) break;
    }
    for (let p = 0; p < 2; p++) {
      if (!s.playerEnabled[p]) continue;
      for (let t = 0; t < sc; t++) {
        if (!allFilled && s.times[s.seedOn + p][t]) continue;
        const val = sampleKDE(s.event, p);
        if (val && val > 0) {
          s.updateTime(s.seedOn + p, t, val);
        }
      }
    }
    s.saveToUrl();
    setTimeout(updateTarget, 50);
  }, [onEnsureWrTop2Loaded, updateTarget]);

  // ── Enter ──
  const pressEnter = useCallback(() => {
    const input = getFocusedInput();
    if (!input) return;
    if (navigator.vibrate) navigator.vibrate(10);
    const raw = input.value.trim();
    const [p, t] = getFocusedPT();
    if (p < 0) return;
    const absIdx = state.seedOn + p;
    let parsed: number;
    if (raw === '' || raw === '-') parsed = 0;
    else if (raw.toUpperCase() === 'DNF') parsed = DNF_VALUE;
    else if (isMbf) parsed = textToMbfScore(raw);
    else parsed = textToTime(raw);
    if (t < 0) state.setTargetAvg(absIdx, parsed);
    else recordAndUpdate(absIdx, t, parsed);
    state.saveToUrl();
    // zigzag 跳格
    const nxt = nextCell(p, t);
    if (nxt) {
      navigateToCell(nxt[0], nxt[1]);
    } else {
      input.blur();
    }
    setTimeout(updateTarget, 50);
  }, [state, isMbf, getFocusedInput, getFocusedPT, updateTarget]);

  // ── Ctrl+Z 撤销 ──
  const pressUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const undo = undoStack.pop()!;
    const s = useCalcStore.getState();
    s.updateTime(undo.playerIdx, undo.solveIdx, undo.oldValue);
    s.saveToUrl();
    // 跳回被撤销的格子
    const displayP = undo.playerIdx - undo.seedOn;
    if (undo.seedOn === s.seedOn && displayP >= 0 && displayP <= 1) {
      navigateToCell(displayP, undo.solveIdx);
    }
  }, []);

  // ── Escape 取消编辑 ──
  const pressEscape = useCallback(() => {
    const [p, t] = getFocusedPT();
    if (p < 0) return;
    const input = getFocusedInput();
    if (!input) return;
    const s = useCalcStore.getState();
    const rawVal = s.times[s.seedOn + p]?.[t] ?? 0;
    if (rawVal > 0 && rawVal < DNF_VALUE) {
      input.value = formatTime(rawVal);
    } else if (rawVal >= DNF_VALUE) {
      input.value = 'DNF';
    } else {
      input.value = '';
    }
    input.blur();
  }, [getFocusedPT, getFocusedInput]);

  // ── Arrow 键导航 ──
  const pressArrow = useCallback((key: string, e: KeyboardEvent) => {
    const [p, t] = getFocusedPT();
    if (p < 0) return;
    const s = useCalcStore.getState();
    const sc = s.solveCount();
    const both = s.playerEnabled[0] && s.playerEnabled[1];

    if (key === 'ArrowUp' || key === 'ArrowDown') {
      if (both) {
        // 双行模式 → 跳行
        if (key === 'ArrowDown' && p === 0) navigateToCell(1, t);
        if (key === 'ArrowUp' && p === 1) navigateToCell(0, t);
      } else {
        // 单行模式 → 精调值
        const rawVal = s.times[s.seedOn + p]?.[t] ?? 0;
        if (rawVal <= 0 || rawVal >= DNF_VALUE) return;
        let step = 1;
        if (e.ctrlKey || e.metaKey) step = 100;
        else if (e.shiftKey) step = 10;
        const dir = key === 'ArrowUp' ? 1 : -1;
        const newVal = clampValue(rawVal + dir * step);
        if (newVal !== rawVal && newVal > 0) {
          s.updateTime(s.seedOn + p, t, newVal);
          s.saveToUrl();
          const input = getFocusedInput();
          if (input) input.value = formatTime(newVal);
        }
      }
    } else if (key === 'ArrowLeft') {
      if (t > 0) navigateToCell(p, t - 1);
    } else if (key === 'ArrowRight') {
      if (t < sc - 1) navigateToCell(p, t + 1);
    }
  }, [getFocusedPT, getFocusedInput]);

  // ── 全局键盘监听 ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 文本输入框（非 time-cell）中不拦截
      if (e.target instanceof HTMLInputElement && !((e.target as HTMLInputElement).classList.contains('time-cell'))) return;
      if (e.target instanceof HTMLTextAreaElement) return;

      const { key, code } = e;

      // Ctrl+Z 撤销
      if (key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        pressUndo();
        return;
      }

      // Escape
      if (key === 'Escape') {
        e.preventDefault();
        pressEscape();
        return;
      }

      // Arrow 键
      if (key.startsWith('Arrow')) {
        e.preventDefault();
        pressArrow(key, e);
        return;
      }

      // time-cell 上的键盘输入已由 InputGrid 的 onKeyDown 处理
      if (e.target instanceof HTMLInputElement && (e.target as HTMLInputElement).classList.contains('time-cell')) {
        return;
      }

      // 以下处理焦点不在 time-cell 时的全局快捷键
      if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        pressDigit(key);
        return;
      }
      if (key === '.' || code === 'NumpadDecimal') {
        e.preventDefault();
        pressDot();
        return;
      }
      if (key === 'Backspace') {
        e.preventDefault();
        pressBackspace();
        return;
      }
      if (key === 'Enter' || code === 'NumpadEnter') {
        e.preventDefault();
        pressEnter();
        return;
      }
      if (key === 'd' || key === 'D') {
        e.preventDefault();
        pressDnf();
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pressDigit, pressDot, pressBackspace, pressEnter, pressDnf, pressUndo, pressEscape, pressArrow]);

  // ── 防止焦点抢夺 ──
  const preventFocusSteal = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // ── 按钮布局 ──
  const backspaceIcon = (
    <svg viewBox="0 0 33 22" width="33" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 1h19a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H11L1 11z"/>
      <line x1="17" y1="7" x2="25" y2="15"/>
      <line x1="25" y1="7" x2="17" y2="15"/>
    </svg>
  );

  const enterIcon = (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 10 4 15 9 20" />
      <path d="M20 4v7a4 4 0 0 1-4 4H4" />
    </svg>
  );

  const buttons = [
    { content: '1', action: () => pressDigit('1'), cls: 'np-digit' },
    { content: '2', action: () => pressDigit('2'), cls: 'np-digit' },
    { content: '3', action: () => pressDigit('3'), cls: 'np-digit' },
    { content: backspaceIcon, action: () => {}, cls: `np-op${clearMode ? ' np-clear-mode' : ''}`, isBackspace: true },
    { content: '4', action: () => pressDigit('4'), cls: 'np-digit' },
    { content: '5', action: () => pressDigit('5'), cls: 'np-digit' },
    { content: '6', action: () => pressDigit('6'), cls: 'np-digit' },
    { content: isZh ? '随机' : 'Rand', action: pressRand, cls: 'np-op' },
    { content: '7', action: () => pressDigit('7'), cls: 'np-digit' },
    { content: '8', action: () => pressDigit('8'), cls: 'np-digit' },
    { content: '9', action: () => pressDigit('9'), cls: 'np-digit' },
    { content: enterIcon, action: pressEnter, cls: 'np-action np-enter' },
    { content: '·:', action: pressDot, cls: 'np-digit' },
    { content: '0', action: () => pressDigit('0'), cls: 'np-digit' },
    { content: 'DNF', action: pressDnf, cls: 'np-op' },
  ];

  return (
    <div id="numpad">
      <div id="numpad-body">
        <Drum activeCell={target} />
        <div id="numpad-grid">
          {buttons.map((btn, i) => (
            <button
              key={i}
              className={`np-btn ${btn.cls}`}
              onMouseDown={preventFocusSteal}
              onClick={btn.isBackspace ? undefined : btn.action}
              onPointerDown={btn.isBackspace ? (e) => { e.preventDefault(); startLongPress(); } : undefined}
              onPointerUp={btn.isBackspace ? endLongPress : undefined}
              onPointerLeave={btn.isBackspace ? () => {
                if (longPressTimer.current) {
                  clearTimeout(longPressTimer.current);
                  longPressTimer.current = null;
                }
                setClearMode(false);
              } : undefined}
            >
              {btn.content}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export { undoStack, recordAndUpdate, nextCell, prevCell, navigateToCell, tryAutoAdvance, shouldAutoAdvance };
export default Numpad;
