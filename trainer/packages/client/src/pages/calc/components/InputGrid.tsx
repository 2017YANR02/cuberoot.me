// NOTE: 输入网格组件 — 从 input_grid.js 迁移
// 每行 = checkbox + 5(或3)个成绩输入框 + targetAvg 框 + Me 按钮
// 功能：zigzag 跳格、WR badge、排名标签、Target Avg emoji 状态

import { useCallback, useRef } from 'react';
import { useCalcStore, isMbfForEvent } from '../stores/calc_store';
import {
  DNF_VALUE,
  formatTime, textToTime, textToMbfScore,
  CalcEngine,
} from '../engine/calc_engine';
import { isWR } from '../engine/wr_data';

// NOTE: 排名颜色 — 1(绿) → 5(红)
const RANK_COLORS = ['#2e7d32', '#558b2f', '#9e9e9e', '#e65100', '#c62828'];

export function InputGrid() {
  const state = useCalcStore();
  const sc = state.solveCount();
  const isMbf = isMbfForEvent(state.event);
  const isMove = state.event === '333fm';

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
      nextP = 1 - p; // 先跳到另一选手
      if (nextP <= p) nextT++; // 如果回到第一个选手，列号+1
      if (nextT >= sc) return; // 已到末尾

      // NOTE: 跳过未启用的选手
      if (!state.playerEnabled[nextP]) {
        nextP = 1 - nextP;
        if (p === 0) nextT++; // 如果原来是 A，跳过 B 后要到下一列的 A
      }
      if (nextT >= sc) return;

      const ref = inputRefs.current[nextP]?.[nextT];
      if (ref) {
        ref.focus();
        ref.select();
      }
    }
  }, [state, handleBlur, sc]);

  // NOTE: 获取显示值 — centiseconds → 格式化字符串
  const getDisplayValue = useCallback((val: number): string => {
    if (val === 0) return '';
    if (val >= DNF_VALUE) return 'DNF';
    return formatTime(val, false, isMove);
  }, [isMove]);

  // NOTE: ghost bar 状态（用于 emoji 显示）
  const getGhostEmoji = useCallback((p: number): string => {
    const tavg = state.getTargetAvg(state.seedOn);
    if (!tavg || tavg <= 0) return '';
    const row = state.times[state.seedOn + p];
    const ghost = CalcEngine.getGhostBar(row, tavg);
    if (!ghost) return '';
    switch (ghost.type) {
      case 'safe': return '🎯';
      case 'conditional': return '🎲';
      case 'impossible': return '💀';
      case 'any': return '🔒';
      default: return '';
    }
  }, [state]);

  return (
    <div className="input-grid">
      {[0, 1].map(p => {
        if (!state.playerEnabled[p] && p === 1) return null;
        const absIdx = state.seedOn + p;
        const playerClass = p === 0 ? 'player-a' : 'player-b';

        // NOTE: 当前选手的成绩排名
        const row = state.times[absIdx];
        const validVals = row.slice(0, sc).filter(v => v > 0 && v < DNF_VALUE);
        const sortedVals = [...validVals].sort((a, b) => isMbf ? b - a : a - b);

        return (
          <div key={p} className={`input-row ${playerClass}`}>
            {/* 选手启用 checkbox */}
            {p === 1 && (
              <input
                type="checkbox"
                className="player-toggle"
                checked={state.playerEnabled[1]}
                onChange={() => state.togglePlayer(1)}
              />
            )}
            {p === 0 && <div style={{ width: 20 }} />}

            {/* 成绩输入框 */}
            {Array.from({ length: sc }, (_, t) => {
              const val = row[t];
              const rank = val > 0 && val < DNF_VALUE ? sortedVals.indexOf(val) : -1;
              const wrSingle = val > 0 && val < DNF_VALUE && isWR(state.event, 'single', val);

              return (
                <div key={t} className="time-cell-wrapper">
                  {/* 排名标签 */}
                  {rank >= 0 && (
                    <span
                      className="sort-rank"
                      data-rank={rank + 1}
                      style={{ color: RANK_COLORS[Math.min(rank, RANK_COLORS.length - 1)] }}
                    >
                      {rank + 1}
                    </span>
                  )}
                  {/* WR badge */}
                  {wrSingle && <span className="wr-badge">WR</span>}
                  <input
                    ref={el => {
                      if (!inputRefs.current[p]) inputRefs.current[p] = [];
                      inputRefs.current[p][t] = el;
                    }}
                    className="time-cell"
                    type="text"
                    inputMode="decimal"
                    defaultValue={getDisplayValue(val)}
                    key={`${absIdx}_${t}_${val}`}
                    placeholder={t < sc ? String(t + 1) : ''}
                    onBlur={(e) => {
                      handleBlur(p, t, e.target.value);
                    }}
                    onKeyDown={(e) => handleKeyDown(e, p, t)}
                  />
                </div>
              );
            })}

            {/* Target Avg 输入框 */}
            <div className="time-cell-wrapper">
              <span className="tavg-emoji">{getGhostEmoji(p)}</span>
              <input
                className="time-cell tavg-cell"
                type="text"
                inputMode="decimal"
                placeholder="Avg"
                defaultValue={(() => {
                  const ta = state.getTargetAvg(state.seedOn);
                  return ta > 0 ? formatTime(ta, false, isMove, true) : '';
                })()}
                key={`tavg_${state.seedOn}_${state.getTargetAvg(state.seedOn)}`}
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  if (raw === '') {
                    state.setTargetAvg(state.seedOn, 0);
                  } else {
                    state.setTargetAvg(state.seedOn, textToTime(raw));
                  }
                  state.saveToUrl();
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default InputGrid;
