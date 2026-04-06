// NOTE: 数字键盘组件 — 从 input_grid.js 的 numpad 部分迁移
// iOS 风格计算器键盘 + drum 滚筒微调
// 功能：数字输入、小数点、退格/清空、DNF、Rand、Enter 确认

import { useCallback, useRef, useState, useEffect } from 'react';
import { useCalcStore, isMbfForEvent } from '../stores/calc_store';
import {
  DNF_VALUE, textToTime, textToMbfScore,
} from '../engine/calc_engine';
import { sampleKDE } from '../engine/wr_data';
import { Drum } from './Drum';

export function Numpad() {
  const state = useCalcStore();
  // NOTE: 当前编辑目标 [playerIdx, solveIdx]，-1 表示无目标
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
    // NOTE: fallback — 用 store.focusedCell 找对应的 DOM input
    const [fp, ft] = useCalcStore.getState().focusedCell;
    if (fp >= 0 && ft >= 0) {
      const cells = document.querySelectorAll<HTMLInputElement>('.input-row .time-cell:not(.tavg-cell)');
      const sc = useCalcStore.getState().solveCount();
      const idx = fp * sc + ft;
      if (cells[idx]) {
        cells[idx].focus();
        return cells[idx];
      }
    }
    return null;
  }, []);

  // NOTE: 聚焦到 numpad 对应的输入格
  const updateTarget = useCallback(() => {
    const [p, t] = state.getFirstUnfilledTime(false);
    if (p >= 0 && t >= 0) {
      setTarget([p, t]);
    } else {
      setTarget([-1, -1]);
    }
  }, [state]);

  // NOTE: 初始化 + times 变更时更新目标
  useEffect(() => {
    updateTarget();
  }, [state.times, state.seedOn, state.playerEnabled, updateTarget]);

  // NOTE: 数字键点击 — 直接写入 DOM input
  const pressDigit = useCallback((digit: string) => {
    const input = getFocusedInput();
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    if (input.value.replace(/\D/g, '').length >= 7 && start === end) return;
    input.value = input.value.slice(0, start) + digit + input.value.slice(end);
    input.selectionStart = input.selectionEnd = start + 1;
  }, [getFocusedInput]);

  // NOTE: 小数点
  const pressDot = useCallback(() => {
    const input = getFocusedInput();
    if (!input || input.value.includes('.')) return;
    const pos = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, pos) + '.' + input.value.slice(end);
    input.selectionStart = input.selectionEnd = pos + 1;
  }, [getFocusedInput]);

  // NOTE: 退格 / 清空
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
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    if (start !== end) {
      input.value = input.value.slice(0, start) + input.value.slice(end);
      input.selectionStart = input.selectionEnd = start;
    } else if (start > 0) {
      input.value = input.value.slice(0, start - 1) + input.value.slice(start);
      input.selectionStart = input.selectionEnd = start - 1;
    }
  }, [clearMode, getFocusedInput]);

  // NOTE: 长按 ⌫ → Clear 模式
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

  // NOTE: DNF
  const pressDnf = useCallback(() => {
    const [fp, ft] = useCalcStore.getState().focusedCell;
    const p = fp >= 0 ? fp : target[0];
    const t = ft >= 0 ? ft : target[1];
    if (p < 0) return;
    const absIdx = state.seedOn + p;
    state.updateTime(absIdx, t, DNF_VALUE);
    state.saveToUrl();
    const input = getFocusedInput();
    if (input) input.value = 'DNF';
    setTimeout(updateTarget, 50);
  }, [state, target, updateTarget, getFocusedInput]);

  // NOTE: Rand — KDE 采样填充
  const pressRand = useCallback(() => {
    const sc = state.solveCount();
    let allFilled = true;
    for (let p = 0; p < 2; p++) {
      if (!state.playerEnabled[p]) continue;
      for (let t = 0; t < sc; t++) {
        if (!state.times[state.seedOn + p][t]) { allFilled = false; break; }
      }
      if (!allFilled) break;
    }
    for (let p = 0; p < 2; p++) {
      if (!state.playerEnabled[p]) continue;
      for (let t = 0; t < sc; t++) {
        if (!allFilled && state.times[state.seedOn + p][t]) continue;
        const val = sampleKDE(state.event, p);
        if (val && val > 0) {
          state.updateTime(state.seedOn + p, t, val);
        }
      }
    }
    state.saveToUrl();
    setTimeout(updateTarget, 50);
  }, [state, updateTarget]);

  // NOTE: Enter — 确认输入并跳到下一格
  const pressEnter = useCallback(() => {
    const input = getFocusedInput();
    if (!input) return;
    const raw = input.value.trim();
    const [fp, ft] = useCalcStore.getState().focusedCell;
    const p = fp >= 0 ? fp : target[0];
    const t = ft >= 0 ? ft : target[1];
    if (p < 0) return;
    const absIdx = state.seedOn + p;
    if (raw === '' || raw === '-') {
      state.updateTime(absIdx, t, 0);
    } else if (raw.toUpperCase() === 'DNF') {
      state.updateTime(absIdx, t, DNF_VALUE);
    } else if (isMbf) {
      state.updateTime(absIdx, t, textToMbfScore(raw));
    } else {
      state.updateTime(absIdx, t, textToTime(raw));
    }
    state.saveToUrl();
    // NOTE: zigzag 跳到下一格
    const sc = state.solveCount();
    let nextP = 1 - p;
    let nextT = t;
    if (nextP <= p) nextT++;
    if (!state.playerEnabled[nextP]) {
      nextP = 1 - nextP;
      if (p === 0) nextT++;
    }
    if (nextT < sc) {
      const cells = document.querySelectorAll<HTMLInputElement>('.input-row .time-cell:not(.tavg-cell)');
      const idx = nextP * sc + nextT;
      if (cells[idx]) {
        cells[idx].focus();
        cells[idx].select();
      }
    }
    setTimeout(updateTarget, 50);
  }, [state, target, isMbf, updateTarget, getFocusedInput]);

  // NOTE: 防止按钮点击抢走 input 焦点
  const preventFocusSteal = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // NOTE: backspace SVG
  const backspaceIcon = (
    <svg viewBox="0 0 33 22" width="33" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 1h19a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H11L1 11z"/>
      <line x1="17" y1="7" x2="25" y2="15"/>
      <line x1="25" y1="7" x2="17" y2="15"/>
    </svg>
  );

  // NOTE: enter SVG
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
    { content: 'Rand', action: pressRand, cls: 'np-op' },
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
        {/* iOS 滚筒精调 */}
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

export default Numpad;
