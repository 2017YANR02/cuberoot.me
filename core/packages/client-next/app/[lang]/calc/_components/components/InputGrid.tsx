'use client';

// NOTE: 输入网格组件 — 从 input_grid.js 1:1 迁移
// 每行 = checkbox + 5(或3)个成绩输入框 + targetAvg 框 + 头像按钮
// 功能：zigzag 跳格、WR badge、排名标签、Ao5 括号标注、fitFont 自适应字号

import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useCalcStore, isMbfForEvent } from '../stores/calc_store';
import {
  DNF_VALUE,
  formatTime, textToTime, textToMbfScore,
  CalcEngine,
} from '../engine/calc_engine';
import { isWR } from '../engine/wr_data';
import { recordAndUpdate, nextCell, prevCell, navigateToCell, tryAutoAdvance, shouldAutoAdvance } from './Numpad';
import { tr } from '@/i18n/tr';

// NOTE: 头像按钮状态 — 由 CalcPage 管理，通过 props 传入
export interface AvatarState {
  active: boolean;       // 是否处于个人数据模式
  loading?: string;      // 加载中文字（如 '⏳'）
  avatarUrl?: string;    // 激活时的头像 URL
}

// NOTE: 默认头像 SVG（通用人像轮廓）— 原版 input_grid.js#1365
const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23ddd'/%3E%3Ccircle cx='16' cy='12' r='5' fill='%23999'/%3E%3Cpath d='M6 28c0-6 4-9 10-9s10 3 10 9' fill='%23999'/%3E%3C/svg%3E";

interface InputGridProps {
  avatarState?: AvatarState[];
  onPlayerOverride?: (playerIdx: number) => void;
}

// NOTE: 不再需要动态字号缩放 — CSS 统一用 17px 确保最长格式也能在 90px 内完整显示
function fitFontStyle(_displayVal: string): React.CSSProperties | undefined {
  return undefined;
}

export function InputGrid({ avatarState, onPlayerOverride }: InputGridProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const state = useCalcStore();
  const sc = state.solveCount();
  const isMbf = isMbfForEvent(state.event);
  const isMove = state.event === '333fm';
  const isMo3 = sc === 3;

  // NOTE: 当前聚焦的输入框 [playerIdx, solveIdx]
  const inputRefs = useRef<(HTMLInputElement | null)[][]>([[], []]);

  // NOTE: 输入框值变更处理
  const handleBlur = useCallback((p: number, t: number, rawValue: string) => {
    const absIdx = state.seedOn + p;
    if (rawValue.trim() === '' || rawValue.trim() === '-') {
      state.updateTime(absIdx, t, 0);
    } else if (isMbf) {
      state.updateTime(absIdx, t, textToMbfScore(rawValue));
    } else {
      state.updateTime(absIdx, t, textToTime(rawValue));
    }
    state.saveToUrl();
  }, [state, isMbf]);

  // NOTE: 鼠标滚轮微调 — 每步 ±1 centisecond（0.01秒）
  // 必须用原生事件（非 passive）才能阻止页面滚动，React onWheel 默认 passive
  const wheelHandlers = useRef<Map<HTMLInputElement, (e: WheelEvent) => void>>(new Map());
  const bindWheel = useCallback((el: HTMLInputElement | null, p: number, t: number) => {
    // NOTE: 清理旧监听器
    if (!el) return;
    const prev = wheelHandlers.current.get(el);
    if (prev) return; // 已绑定
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const absIdx = state.seedOn + p;
      const cur = state.times[absIdx]?.[t];
      if (!cur || cur <= 0 || cur >= DNF_VALUE) return;
      const delta = e.deltaY > 0 ? 1 : -1;
      state.updateTime(absIdx, t, Math.max(1, cur + delta));
      state.saveToUrl();
    };
    el.addEventListener('wheel', handler, { passive: false });
    wheelHandlers.current.set(el, handler);
  }, [state]);

  // NOTE: tavg 提交（无小数点也按 textToTime 解析，1234 → 12.34）
  const commitTavg = useCallback((p: number, raw: string) => {
    const absIdx = state.seedOn + p;
    const v = raw.trim();
    if (v === '' || v === '-') state.setTargetAvg(absIdx, 0);
    else state.setTargetAvg(absIdx, textToTime(v));
    state.saveToUrl();
  }, [state]);

  // NOTE: 键盘导航 — time-cell zigzag + autoAdvance；tavg-cell 写到 targetAvg、不跳格
  // inputMode="none" 不会触发原生输入，所以数字/小数点/退格/DNF 全要手动处理
  const handleKeyDown = useCallback((
    e: React.KeyboardEvent,
    p: number,
    t: number,
    kind: 'time' | 'tavg' = 'time',
  ) => {
    const input = e.target as HTMLInputElement;
    const absIdx = state.seedOn + p;
    const isTavg = kind === 'tavg';

    // tavg 走 t = -1 让 nextCell/prevCell 的 zigzag 公式直接覆盖（target_A → target_B → #1_A → ...）
    const curT = isTavg ? -1 : t;

    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (isTavg) commitTavg(p, input.value);
      else handleBlur(p, t, input.value);
      const nxt = nextCell(p, curT);
      if (nxt) navigateToCell(nxt[0], nxt[1]);
      else input.blur();
      return;
    }

    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      const isFullSel = start === 0 && end === input.value.length && input.value.length > 0;
      if (isFullSel) {
        input.value = e.key;
        input.selectionStart = input.selectionEnd = 1;
      } else {
        if (input.value.replace(/\D/g, '').length >= 7) return;
        input.value = input.value.slice(0, start) + e.key + input.value.slice(end);
        input.selectionStart = input.selectionEnd = start + 1;
      }
      if (isTavg) {
        // tavg 自动跳格 — 与 #1~#5 同样的触发规则
        if (shouldAutoAdvance(input.value)) {
          commitTavg(p, input.value);
          const nxt = nextCell(p, -1);
          if (nxt) navigateToCell(nxt[0], nxt[1]);
        }
      } else {
        tryAutoAdvance(input.value, p, t);
      }
      return;
    }

    if (e.key === '.' || e.code === 'NumpadDecimal') {
      e.preventDefault();
      if (!input.value.includes('.')) {
        const pos = input.selectionStart ?? input.value.length;
        const endPos = input.selectionEnd ?? input.value.length;
        input.value = input.value.slice(0, pos) + '.' + input.value.slice(endPos);
        input.selectionStart = input.selectionEnd = pos + 1;
      }
      return;
    }
    if (e.key === ':') {
      e.preventDefault();
      if (!input.value.includes(':')) {
        const pos = input.selectionStart ?? input.value.length;
        const endPos = input.selectionEnd ?? input.value.length;
        input.value = input.value.slice(0, pos) + ':' + input.value.slice(endPos);
        input.selectionStart = input.selectionEnd = pos + 1;
      }
      return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();
      e.stopPropagation();
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      const isFullSel = start === 0 && end === input.value.length && input.value.length > 0;
      if (isFullSel || input.value.length === 0) {
        if (isTavg) commitTavg(p, '');
        else handleBlur(p, t, '');
        const prv = prevCell(p, curT);
        if (prv) requestAnimationFrame(() => navigateToCell(prv[0], prv[1]));
      } else {
        input.value = input.value.slice(0, start > 0 ? start - 1 : 0) + input.value.slice(end);
        input.selectionStart = input.selectionEnd = Math.max(0, start - 1);
      }
      return;
    }

    if (e.key === 'Delete') {
      e.preventDefault();
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;
      if (start !== end) {
        input.value = input.value.slice(0, start) + input.value.slice(end);
      } else if (start < input.value.length) {
        input.value = input.value.slice(0, start) + input.value.slice(start + 1);
      }
      input.selectionStart = input.selectionEnd = start;
      return;
    }

    if (e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      if (isTavg) {
        state.setTargetAvg(absIdx, DNF_VALUE);
      } else {
        recordAndUpdate(absIdx, t, DNF_VALUE);
      }
      state.saveToUrl();
      input.value = 'DNF';
      const nxt = nextCell(p, curT);
      if (nxt) navigateToCell(nxt[0], nxt[1]);
      else input.blur();
      return;
    }

    // NOTE: 只允许数字 / . / : — 合法键与 d/D(DNF) 上面已 return，到这的可打印字符(字母、其它符号)一律拦掉
    // 带 Ctrl/Meta/Alt 的组合键(复制粘贴撤销等)放行给浏览器；Arrow/Escape 等多字符 key 不受影响
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      return;
    }

    // Arrow/Escape/Ctrl+Z 由 Numpad 的全局 keydown 处理
  }, [state, handleBlur, commitTavg]);

  // NOTE: 粘贴也只保留数字 / . / :，过滤掉其余字符
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const clean = (e.clipboardData.getData('text') || '').replace(/[^0-9.:]/g, '');
    const input = e.target as HTMLInputElement;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + clean + input.value.slice(end);
    input.selectionStart = input.selectionEnd = start + clean.length;
  }, []);

  // NOTE: ghost bar 状态（用于 emoji 显示）
  // 原版 input_grid.js#861-875 Target Avg 状态 emoji
  const getGhostEmoji = useCallback((p: number): string => {
    const tavg = state.getTargetAvg(state.seedOn + p);
    if (!tavg || tavg <= 0) return '🎯'; // NOTE: 默认（数据不足）
    if (tavg >= DNF_VALUE) return '🎯';
    const row = state.times[state.seedOn + p];
    const ghost = CalcEngine.getGhostBar(row, tavg);
    if (!ghost) return '🎯';
    switch (ghost.type) {
      case 'safe':
      case 'any':
        return '🔒';
      case 'conditional':
        return '🎲';
      case 'impossible':
        return '💀';
      default:
        return '🎯';
    }
  }, [state]);

  return (
    <div className="input-grid">
      {[0, 1].map(p => {
        const enabled = state.playerEnabled[p];
        const absIdx = state.seedOn + p;
        const playerClass = p === 0 ? 'player-a' : 'player-b';

        const row = state.times[absIdx];

        // NOTE: Ao5 括号标注 — 标记最好/最坏成绩的索引（仅当所有 solve 都有值时）
        // 原版 input_grid.js#810-829
        let bestIdx = -1;
        let worstIdx = -1;
        if (enabled && !isMo3) {
          let allFilled = true;
          for (let c = 0; c < sc; c++) {
            if (row[c] <= 0) { allFilled = false; break; }
          }
          if (allFilled) {
            let bestVal = Infinity;
            let worstVal = -1;
            for (let c = 0; c < sc; c++) {
              const v = row[c];
              if (v < bestVal) { bestVal = v; bestIdx = c; }
              if (v > worstVal) { worstVal = v; worstIdx = c; }
            }
          }
        }

        // NOTE: 排名计算 — 收集有效成绩按值排序后分配排名 1~n
        // 原版 input_grid.js#879-904
        const ranked: { idx: number; val: number }[] = [];
        if (enabled) {
          for (let t = 0; t < sc; t++) {
            const v = row[t];
            if (v > 0) ranked.push({ idx: t, val: v });
          }
          // NOTE: DNF 值排最后
          ranked.sort((a, b) => a.val - b.val);
        }

        return (
          <div
            key={p}
            className={`input-row ${playerClass}${!enabled ? ' disabled' : ''}`}
            style={!enabled ? { opacity: 0.3 } : undefined}
          >
            {/* 选手启用 checkbox — 原版 input_grid.js#109-116 两行都有 */}
            <input
              type="checkbox"
              className="player-toggle"
              checked={enabled}
              onChange={() => state.togglePlayer(p)}
            />

            {/* 头像按钮 — 原版 input_grid.js#118-136 */}
            <button
              className={`me-btn${avatarState?.[p]?.active ? ' me-active' : ''}`}
              title={avatarState?.[p]?.active
                ? (isZh ? `切换回世界第 ${p + 1} 名` : `Switch back to World #${p + 1}`)
                : (tr({ zh: '搜索选手', en: 'Search for a player',
                    zhHant: "搜尋選手"
                }))}
              data-loading={avatarState?.[p]?.loading && !avatarState[p].active
                ? avatarState[p].loading
                : undefined}
              onClick={() => onPlayerOverride?.(p)}
            >
              {/* NOTE: loading 时 img 隐藏，由 CSS ::after 显示 data-loading 文字 */}
              <img
                className="me-avatar"
                src={avatarState?.[p]?.active
                  ? (avatarState[p].avatarUrl || DEFAULT_AVATAR)
                  : DEFAULT_AVATAR}
                alt="avatar"
                style={avatarState?.[p]?.loading && !avatarState[p].active
                  ? { display: 'none' }
                  : undefined}
              />
            </button>

            {/* Target Avg 输入框 — 每行独立（原版 input_grid.js 行 103-107）*/}
            <div className="time-cell-wrapper">
              <span className="tavg-emoji">{getGhostEmoji(p)}</span>
              <input
                className="time-cell tavg-cell"
                type="text"
                inputMode="none"
                disabled={!enabled}
                placeholder={tr({ zh: '目标', en: 'Target',
                    zhHant: "目標"
                })}
                defaultValue={(() => {
                  const ta = state.getTargetAvg(state.seedOn + p);
                  return ta > 0 ? formatTime(ta, false, isMove, true) : '';
                })()}
                key={`tavg_${absIdx}_${state.getTargetAvg(absIdx)}_${enabled}`}
                style={!enabled ? { opacity: 0.3 } : undefined}
                onBlur={(e) => commitTavg(p, e.target.value)}
                onFocus={(e) => { state.setFocusedCell(p, -1); e.target.select(); }}
                onKeyDown={(e) => handleKeyDown(e, p, 0, 'tavg')}
                onPaste={handlePaste}
              />
            </div>

            {/* 成绩输入框 */}
            {Array.from({ length: sc }, (_, t) => {
              const val = row[t];

              // NOTE: 格式化显示值 + Ao5 括号标注
              let displayVal = '';
              if (enabled && val > 0 && val < DNF_VALUE) {
                displayVal = formatTime(val, false, isMove);
                // NOTE: Ao5 括号标注 — 最好和最坏成绩加括号（WCA 惯例）
                if (t === bestIdx || t === worstIdx) {
                  displayVal = '(' + displayVal + ')';
                }
              } else if (enabled && val >= DNF_VALUE) {
                displayVal = 'DNF';
                // NOTE: DNF 也可能是 worst
                if (t === worstIdx) {
                  displayVal = '(DNF)';
                }
              }

              // NOTE: 排名位置
              const rankPos = ranked.findIndex(r => r.idx === t);
              const wrSingle = enabled && val > 0 && val < DNF_VALUE && isWR(state.event, 'single', val);

              return (
                <div key={t} className="time-cell-wrapper">
                  {/* 排名标签 — 原版 input_grid.js#892-904 */}
                  {rankPos >= 0 && (
                    <span
                      className="sort-rank"
                      data-rank={rankPos + 1}
                      data-total={ranked.length}
                    >
                      {rankPos + 1}
                    </span>
                  )}
                  {/* WR badge */}
                  {wrSingle && <span className="wr-badge">WR</span>}
                  <input
                    ref={el => {
                      if (!inputRefs.current[p]) inputRefs.current[p] = [];
                      inputRefs.current[p][t] = el;
                      bindWheel(el, p, t);
                    }}
                    className="time-cell"
                    type="text"
                    inputMode="none"
                    disabled={!enabled}
                    defaultValue={displayVal}
                    key={`${absIdx}_${t}_${val}_${enabled}`}
                    placeholder={`#${t + 1}`}
                    style={fitFontStyle(displayVal)}
                    onBlur={(e) => {
                      handleBlur(p, t, e.target.value);
                    }}
                    onFocus={(e) => { state.setFocusedCell(p, t); e.target.select(); }}
                    onKeyDown={(e) => handleKeyDown(e, p, t)}
                    onPaste={handlePaste}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export default InputGrid;
