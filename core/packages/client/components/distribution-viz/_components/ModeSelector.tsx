'use client';
// NOTE: 数据模式选择器 — 17 种模式下拉
// Singles + Rolling Stats(Mo3/Ao5/Ao12/Ao25/Ao50/Ao100)+ Round Metrics(Avg/BAo5/WAo5/Mo5/BPA/WPA/Median/BestC/WorstC/Worst)

import { useVizStore } from '../_stores/viz_store';
import type { DataMode } from '../_engine/data_fetch';
import { CompactSelect } from '@/components/CompactSelect';
import { useT } from '@/hooks/useT';
import { WCA_RESULT_METRIC_OPTIONS } from '@/lib/wca-result-metrics';

export default function ModeSelector() {
  const dataMode = useVizStore(s => s.dataMode);
  const setDataMode = useVizStore(s => s.setDataMode);
  const t = useT();
  const items = WCA_RESULT_METRIC_OPTIONS.map(option => ({
    value: option.key,
    label: t(option.zh, option.en),
  }));
  const selected = items.find(item => item.value === dataMode) ?? items[0];

  return (
    <div className="mode-switcher">
      <CompactSelect<DataMode>
        label={selected.label}
        items={items}
        value={dataMode}
        onChange={setDataMode}
        ariaLabel={t('统计类型', 'Statistic type')}
        variant="plain"
      />
    </div>
  );
}
