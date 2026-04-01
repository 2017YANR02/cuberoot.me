// NOTE: 数据模式选择器 — 17 种模式按钮组（两行）
// 第一行：Singles + Rolling Stats（Mo3/Ao5/Ao12/Ao25/Ao50/Ao100）
// 第二行：Round Metrics（Avg/BAo5/WAo5/Mo5/BPA/WPA/Median/BestC/WorstC/Worst）+ 折叠按钮
// 1:1 翻译自 viz.js setupModeSwitcher()

import { useState, useCallback } from 'react';
import { useVizStore } from '../stores/viz_store';
import type { DataMode } from '../engine/data_fetch';

// NOTE: 第一行按钮配置
const ROW1_MODES: { key: DataMode; label: string }[] = [
  { key: 'singles', label: 'Singles' },
  { key: 'mo3', label: 'Mo3' },
  { key: 'ao5', label: 'Ao5' },
  { key: 'ao12', label: 'Ao12' },
  { key: 'ao25', label: 'Ao25' },
  { key: 'ao50', label: 'Ao50' },
  { key: 'ao100', label: 'Ao100' },
];

// NOTE: 第二行按钮配置（轮次指标）
const ROW2_MODES: { key: DataMode; label: string }[] = [
  { key: 'avg', label: 'Avg' },
  { key: 'bao5', label: 'BAo5' },
  { key: 'wao5', label: 'WAo5' },
  { key: 'mo5', label: 'Mo5' },
  { key: 'bpa', label: 'BPA' },
  { key: 'wpa', label: 'WPA' },
  { key: 'median', label: 'Median' },
  { key: 'bestc', label: 'BestC' },
  { key: 'worstc', label: 'WorstC' },
  { key: 'worst', label: 'Worst' },
];

export default function ModeSelector() {
  const dataMode = useVizStore(s => s.dataMode);
  const setDataMode = useVizStore(s => s.setDataMode);
  const [expanded, setExpanded] = useState(false);

  const isRoundActive = ROW2_MODES.some(m => m.key === dataMode);

  const handleClick = useCallback((mode: DataMode) => {
    setDataMode(mode);
    // 如果点击的是第二行按钮，自动展开
    if (ROW2_MODES.some(m => m.key === mode)) {
      setExpanded(true);
    }
  }, [setDataMode]);

  return (
    <div className="mode-switcher">
      {/* 第一行：基础模式 */}
      <div className="mode-row" id="modeRowMain">
        {ROW1_MODES.map(m => (
          <button
            key={m.key}
            className={`mode-btn${dataMode === m.key ? ' active' : ''}`}
            onClick={() => handleClick(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* 第二行：轮次指标 + 折叠按钮 */}
      <div className={`mode-row-round${expanded || isRoundActive ? ' expanded' : ''}`} id="modeRowRound">
        {ROW2_MODES.map(m => (
          <button
            key={m.key}
            className={`mode-btn-round${dataMode === m.key ? ' active' : ''}`}
            onClick={() => handleClick(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <button
        className="mode-expand-btn"
        id="modeExpandBtn"
        onClick={() => setExpanded(v => !v)}
      >
        {expanded || isRoundActive ? '▴ 收起' : '▾ 更多'}
      </button>
    </div>
  );
}
