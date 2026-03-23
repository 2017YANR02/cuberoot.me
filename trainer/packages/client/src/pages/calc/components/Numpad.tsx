// NOTE: 数字键盘组件 — 从 input_grid.js 的 numpad 部分迁移
// iOS 风格计算器键盘 + drum 滚筒微调
// 功能：数字输入、小数点、退格/清空、DNF、Rand、Enter 确认

import { useCallback, useRef, useState, useEffect } from 'react';
import { useCalcStore, isMbfForEvent } from '../stores/calc_store';
import {
  DNF_VALUE, formatTime, textToTime, textToMbfScore,
} from '../engine/calc_engine';
import { sampleKDE } from '../engine/wr_data';
import { Drum } from './Drum';

export function Numpad() {
  const state = useCalcStore();
  const [display, setDisplay] = useState('');
  const [label, setLabel] = useState('');
  // NOTE: 当前编辑目标 [playerIdx, solveIdx]，-1 表示无目标
  const [target, setTarget] = useState<[number, number]>([-1, -1]);

  const isLongPress = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [clearMode, setClearMode] = useState(false);

  const isMbf = isMbfForEvent(state.event);
  const isMove = state.event === '333fm';

  // NOTE: 聚焦到 numpad 对应的输入格（来自 InputGrid 的 focus 事件触发）
  const updateTarget = useCallback(() => {
    const [p, t] = state.getFirstUnfilledTime(false);
    if (p >= 0 && t >= 0) {
      setTarget([p, t]);
      const val = state.times[state.seedOn + p][t];
      setDisplay(val > 0 ? formatTime(val, false, isMove) : '');
      const name = state.names[state.seedOn + p] || '';
      setLabel(`${name} #${t + 1}`);
    } else {
      // NOTE: 全满时 target=[-1,-1] — Rand 需要此标志判断全量覆盖
      setTarget([-1, -1]);
      setDisplay('');
      setLabel('');
    }
  }, [state, isMove]);

  // NOTE: 初始化 + times 变更时更新目标
  useEffect(() => {
    updateTarget();
  }, [state.times, state.seedOn, state.playerEnabled, updateTarget]);

  // NOTE: 数字键点击
  const pressDigit = useCallback((digit: string) => {
    setDisplay(prev => {
      // NOTE: 限长 — 最多 7 位（如 "1:23.45"）
      if (prev.replace(/\D/g, '').length >= 7) return prev;
      return prev + digit;
    });
  }, []);

  // NOTE: 小数点
  const pressDot = useCallback(() => {
    setDisplay(prev => prev.includes('.') ? prev : prev + '.');
  }, []);

  // NOTE: 退格 / 清空
  const pressBackspace = useCallback(() => {
    if (clearMode) {
      // NOTE: 长按触发的 Clear All
      setDisplay('');
      setClearMode(false);
      return;
    }
    setDisplay(prev => prev.slice(0, -1));
  }, [clearMode]);

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
    // NOTE: 短按时不在 clearMode，直接退格
    if (clearMode) {
      pressBackspace();
    }
  }, [pressBackspace, clearMode]);

  // NOTE: DNF
  const pressDnf = useCallback(() => {
    if (target[0] < 0) return;
    const absIdx = state.seedOn + target[0];
    state.updateTime(absIdx, target[1], DNF_VALUE);
    state.saveToUrl();
    setDisplay('DNF');
    // NOTE: 自动跳到下一格
    setTimeout(updateTarget, 50);
  }, [state, target, updateTarget]);

  // NOTE: Rand — 全量 KDE 采样填充（原版 app.js#227-260）
  // 有空格时只填空格子；全满时覆盖所有已启用行
  const pressRand = useCallback(() => {
    const sc = state.solveCount();
    // NOTE: 先判断已启用行是否全满
    let allFilled = true;
    for (let p = 0; p < 2; p++) {
      if (!state.playerEnabled[p]) continue;
      for (let t = 0; t < sc; t++) {
        if (!state.times[state.seedOn + p][t]) { allFilled = false; break; }
      }
      if (!allFilled) break;
    }
    // NOTE: 全量填充/覆盖
    for (let p = 0; p < 2; p++) {
      if (!state.playerEnabled[p]) continue;
      for (let t = 0; t < sc; t++) {
        // 有空格时跳过已填格子
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

  // NOTE: Enter — 确认输入
  const pressEnter = useCallback(() => {
    if (target[0] < 0 || display.trim() === '') return;
    const absIdx = state.seedOn + target[0];
    let val: number;
    if (isMbf) {
      val = textToMbfScore(display);
    } else {
      val = textToTime(display);
    }
    state.updateTime(absIdx, target[1], val);
    state.saveToUrl();
    setDisplay('');
    setTimeout(updateTarget, 50);
  }, [state, target, display, isMbf, updateTarget]);

  // NOTE: 按钮配置 — 与原版 index.html#128-149 布局一致
  // 行1: 1 2 3 ⌫   行2: 4 5 6 Rand   行3: 7 8 9 ↵   行4: ·: 0 DNF
  const buttons = [
    { text: '1', action: () => pressDigit('1'), cls: 'np-digit' },
    { text: '2', action: () => pressDigit('2'), cls: 'np-digit' },
    { text: '3', action: () => pressDigit('3'), cls: 'np-digit' },
    { text: '⌫', action: () => {}, cls: `np-op${clearMode ? ' np-clear-mode' : ''}`, isBackspace: true },
    { text: '4', action: () => pressDigit('4'), cls: 'np-digit' },
    { text: '5', action: () => pressDigit('5'), cls: 'np-digit' },
    { text: '6', action: () => pressDigit('6'), cls: 'np-digit' },
    { text: 'Rand', action: pressRand, cls: 'np-op' },
    { text: '7', action: () => pressDigit('7'), cls: 'np-digit' },
    { text: '8', action: () => pressDigit('8'), cls: 'np-digit' },
    { text: '9', action: () => pressDigit('9'), cls: 'np-digit' },
    { text: '⏎', action: pressEnter, cls: 'np-action np-enter' },
    { text: '·:', action: pressDot, cls: 'np-digit' },
    { text: '0', action: () => pressDigit('0'), cls: 'np-digit' },
    { text: 'DNF', action: pressDnf, cls: 'np-op' },
  ];

  return (
    <div id="numpad">
      {/* 显示区 */}
      <div id="numpad-display">
        <span id="numpad-label">{label}</span>
        {display || '\u00A0'}
      </div>

      {/* 按钮区 */}
      <div id="numpad-body">
        {/* iOS 滚筒精调 */}
        <Drum activeCell={target} />

        <div id="numpad-grid">
          {buttons.map((btn, i) => (
            <button
              key={i}
              className={`np-btn ${btn.cls}`}
              onClick={btn.isBackspace ? undefined : btn.action}
              onPointerDown={btn.isBackspace ? startLongPress : undefined}
              onPointerUp={btn.isBackspace ? endLongPress : undefined}
              onPointerLeave={btn.isBackspace ? () => {
                if (longPressTimer.current) {
                  clearTimeout(longPressTimer.current);
                  longPressTimer.current = null;
                }
                setClearMode(false);
              } : undefined}
            >
              {btn.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Numpad;
