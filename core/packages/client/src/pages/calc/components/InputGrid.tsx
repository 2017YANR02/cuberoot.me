// NOTE: 输入网格组件 — 从 input_grid.js 1:1 迁移
// 每行 = checkbox + 5(或3)个成绩输入框 + targetAvg 框 + 头像按钮
// 功能：zigzag 跳格、WR badge、排名标签、Ao5 括号标注、fitFont 自适应字号

import { useCallback, useRef } from 'react';
import { useCalcStore, isMbfForEvent } from '../stores/calc_store';
import {
  DNF_VALUE,
  formatTime, textToTime, textToMbfScore,
  CalcEngine,
} from '../engine/calc_engine';
import { isWR } from '../engine/wr_data';

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

  // NOTE: 键盘导航 — Enter/Tab → zigzag 跳格
  const handleKeyDown = useCallback((e: React.KeyboardEvent, p: number, t: number) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      // NOTE: 先提交当前值
      const input = e.target as HTMLInputElement;
      handleBlur(p, t, input.value);

      // NOTE: zigzag 跳格 — 先同列另一选手，再下一列
      let nextP = p;
      let nextT = t;
      nextP = 1 - p;
      if (nextP <= p) nextT++;
      if (nextT >= sc) return;

      // NOTE: 跳过未启用的选手
      if (!state.playerEnabled[nextP]) {
        nextP = 1 - nextP;
        if (p === 0) nextT++;
      }
      if (nextT >= sc) return;

      const ref = inputRefs.current[nextP]?.[nextT];
      if (ref) {
        ref.focus();
        ref.select();
      }
    }
  }, [state, handleBlur, sc]);

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
                    onKeyDown={(e) => {
                      // NOTE: inputMode="none" 阻止了浏览器原生键盘输入，需手动处理
                      const input = e.target as HTMLInputElement;
                      if (/^[0-9]$/.test(e.key)) {
                        e.preventDefault();
                        // NOTE: 如果输入框有选中文本，替换选中内容
                        const start = input.selectionStart ?? input.value.length;
                        const end = input.selectionEnd ?? input.value.length;
                        const before = input.value.slice(0, start);
                        const after = input.value.slice(end);
                        input.value = before + e.key + after;
                        input.selectionStart = input.selectionEnd = start + 1;
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
                        const start = input.selectionStart ?? input.value.length;
                        const end = input.selectionEnd ?? input.value.length;
                        if (start !== end) {
                          input.value = input.value.slice(0, start) + input.value.slice(end);
                          input.selectionStart = input.selectionEnd = start;
                        } else if (start > 0) {
                          input.value = input.value.slice(0, start - 1) + input.value.slice(start);
                          input.selectionStart = input.selectionEnd = start - 1;
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
                        input.value = 'DNF';
                        return;
                      }
                      handleKeyDown(e, p, t);
                    }}
                  />
                </div>
              );
            })}

            {/* Target Avg 输入框 — 每行独立（原版 input_grid.js 行 103-107）*/}
            <div className="time-cell-wrapper">
              <span className="tavg-emoji">{getGhostEmoji(p)}</span>
              <input
                className="time-cell tavg-cell"
                type="text"
                inputMode="none"
                disabled={!enabled}
                placeholder="Target"
                defaultValue={(() => {
                  const ta = state.getTargetAvg(state.seedOn + p);
                  return ta > 0 ? formatTime(ta, false, isMove, true) : '';
                })()}
                key={`tavg_${absIdx}_${state.getTargetAvg(absIdx)}_${enabled}`}
                style={!enabled ? { opacity: 0.3 } : undefined}
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  if (raw === '') {
                    state.setTargetAvg(absIdx, 0);
                  } else {
                    state.setTargetAvg(absIdx, textToTime(raw));
                  }
                  state.saveToUrl();
                }}
              />
            </div>

            {/* 头像按钮 — 原版 input_grid.js#118-136 */}
            <button
              className={`me-btn${avatarState?.[p]?.active ? ' me-active' : ''}`}
              title={avatarState?.[p]?.active
                ? `Switch back to World #${p + 1}`
                : 'Search for a player'}
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
          </div>
        );
      })}
    </div>
  );
}

export default InputGrid;
