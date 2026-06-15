// NOTE: iOS 风格滚筒 — 瘦身为 <WheelPicker> 的 thin wrapper
// 职责：订阅 calc_store 推导当前该调的格子值，事件/禁用态决定步长与空态
'use client';

import { useCallback, useMemo } from 'react';
import { useCalcStore, isMbfForEvent } from '../stores/calc_store';
import { DNF_VALUE, formatTime, clampValue } from '../engine/calc_engine';
import { WheelPicker } from '@/components/WheelPicker';
import { tr } from '@/i18n/tr';

interface DrumProps {
  /** 当前聚焦的 [playerIdx, solveIdx]，[-1,-1] 表示无聚焦 */
  activeCell: [number, number];
  /** 设置聚焦格子的值 */
  onCellValueChange?: (p: number, t: number, val: number) => void;
}

// NOTE: 与原 Drum.syncDrum 的 cell 选择逻辑一致
// 优先级：store.focusedCell → activeCell → fallback 扫出最后一个有效格子
function resolveTarget(
  focusedCell: [number, number],
  activeCell: [number, number],
  times: number[][],
  seedOn: number,
  playerEnabled: boolean[],
  solveCount: number,
): { cellP: number; cellT: number; val: number } {
  const [fp, ft] = focusedCell;
  const [ap, at] = activeCell;
  if (fp >= 0 && ft >= 0) {
    return { cellP: fp, cellT: ft, val: times[seedOn + fp]?.[ft] ?? 0 };
  }
  if (ap >= 0 && at >= 0) {
    return { cellP: ap, cellT: at, val: times[seedOn + ap]?.[at] ?? 0 };
  }
  for (let pp = 1; pp >= 0; pp--) {
    if (!playerEnabled[pp]) continue;
    for (let tt = solveCount - 1; tt >= 0; tt--) {
      const v = times[seedOn + pp]?.[tt] ?? 0;
      if (v > 0 && v < DNF_VALUE) return { cellP: pp, cellT: tt, val: v };
    }
  }
  return { cellP: -1, cellT: -1, val: 0 };
}

export function Drum({ activeCell, onCellValueChange }: DrumProps) {
  // NOTE: 订阅 store 必要片段；任何相关变化都会 re-render
  const focusedCell = useCalcStore((s) => s.focusedCell);
  const event = useCalcStore((s) => s.event);
  const times = useCalcStore((s) => s.times);
  const seedOn = useCalcStore((s) => s.seedOn);
  const playerEnabled = useCalcStore((s) => s.playerEnabled);
  const solveCount = useCalcStore((s) => s.solveCount());

  const { cellP, cellT, val } = useMemo(
    () => resolveTarget(focusedCell, activeCell, times, seedOn, playerEnabled, solveCount),
    [focusedCell, activeCell, times, seedOn, playerEnabled, solveCount],
  );

  const disabled = val <= 0 || val >= DNF_VALUE;
  const step = (event === '333fm' || isMbfForEvent(event)) ? 100 : 1;
  const isMove = event === '333fm';

  const renderSlot = useCallback((v: number) => {
    // NOTE: 空态(无成绩可调)填占位破折号，让滚筒即便没值也看得出是个轮子，而不是一片空白
    if (disabled) return '–';
    return (v > 0 && v < DNF_VALUE) ? formatTime(v, false, isMove) : '';
  }, [disabled, isMove]);

  const handleChange = useCallback((newVal: number) => {
    if (cellP < 0 || cellT < 0) return;
    const state = useCalcStore.getState();
    state.updateTime(state.seedOn + cellP, cellT, newVal);
    onCellValueChange?.(cellP, cellT, newVal);
  }, [cellP, cellT, onCellValueChange]);

  return (
    <WheelPicker
      className="calc-drum"
      value={disabled ? 0 : val}
      step={step}
      clamp={clampValue}
      disabled={disabled}
      renderSlot={renderSlot}
      onChange={handleChange}
      width={72}
      ariaLabel={tr({ zh: '成绩滚筒', en: 'Time wheel'
    })}
    />
  );
}

export default Drum;
