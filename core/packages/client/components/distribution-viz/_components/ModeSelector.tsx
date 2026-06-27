'use client';
// NOTE: 数据模式选择器 — 17 种模式下拉
// Singles + Rolling Stats(Mo3/Ao5/Ao12/Ao25/Ao50/Ao100)+ Round Metrics(Avg/BAo5/WAo5/Mo5/BPA/WPA/Median/BestC/WorstC/Worst)

import { useVizStore } from '../_stores/viz_store';
import type { DataMode } from '../_engine/data_fetch';
import { ListSelect } from '@/components/ListSelect';

// NOTE: 全部模式(顺序 = 原两行:基础 + 轮次指标)
const ALL_MODES: { key: DataMode; label: string }[] = [
  { key: 'singles', label: 'Singles' },
  { key: 'mo3', label: 'Mo3' },
  { key: 'ao5', label: 'Ao5' },
  { key: 'ao12', label: 'Ao12' },
  { key: 'ao25', label: 'Ao25' },
  { key: 'ao50', label: 'Ao50' },
  { key: 'ao100', label: 'Ao100' },
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

const ITEMS = ALL_MODES.map(m => ({ value: m.key, label: m.label }));

export default function ModeSelector() {
  const dataMode = useVizStore(s => s.dataMode);
  const setDataMode = useVizStore(s => s.setDataMode);

  return (
    <div className="mode-switcher">
      <ListSelect
        items={ITEMS}
        value={dataMode}
        onChange={v => setDataMode(v as DataMode)}
        allLabel="Singles"
        clearable={false}
      />
    </div>
  );
}
