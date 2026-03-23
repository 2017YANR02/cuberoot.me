// NOTE: 数字键盘组件 — 从 input_grid.js 的 numpad 部分迁移
// iOS 风格计算器键盘 + drum 滚筒微调
// 功能：数字输入、小数点、退格/清空、DNF、Rand、Enter 确认

import { useCallback, useRef, useState, useEffect } from 'react';
import { useCalcStore, isMbfForEvent } from '../stores/calc_store';
import {
  DNF_VALUE, formatTime, textToTime, textToMbfScore,
} from '../engine/calc_engine';
import { sampleKDE } from '../engine/wr_data';

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

  // NOTE: Rand — KDE 采样随机填充
  const pressRand = useCallback(() => {
    if (target[0] < 0) return;
    const val = sampleKDE(state.event, target[0]);
    if (val && val > 0) {
      const absIdx = state.seedOn + target[0];
      state.updateTime(absIdx, target[1], val);
      state.saveToUrl();
      setDisplay(formatTime(val, false, isMove));
      setTimeout(updateTarget, 50);
    }
  }, [state, target, updateTarget, isMove]);

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

  // NOTE: 按钮配置
  const buttons = [
    { text: '7', action: () => pressDigit('7'), cls: 'np-digit' },
    { text: '8', action: () => pressDigit('8'), cls: 'np-digit' },
    { text: '9', action: () => pressDigit('9'), cls: 'np-digit' },
    { text: 'DNF', action: pressDnf, cls: 'np-action' },
    { text: '4', action: () => pressDigit('4'), cls: 'np-digit' },
    { text: '5', action: () => pressDigit('5'), cls: 'np-digit' },
    { text: '6', action: () => pressDigit('6'), cls: 'np-digit' },
    { text: 'Rand', action: pressRand, cls: 'np-action' },
    { text: '1', action: () => pressDigit('1'), cls: 'np-digit' },
    { text: '2', action: () => pressDigit('2'), cls: 'np-digit' },
    { text: '3', action: () => pressDigit('3'), cls: 'np-digit' },
    { text: '⏎', action: pressEnter, cls: 'np-action np-enter' },
    { text: '0', action: () => pressDigit('0'), cls: 'np-digit' },
    { text: '.', action: pressDot, cls: 'np-op' },
    { text: '⌫', action: () => {}, cls: `np-action${clearMode ? ' np-clear-mode' : ''}`, isBackspace: true },
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
