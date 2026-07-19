// 项目选择器 — 薄封装共享的 <WcaEventSelector>,只保留 calc store 接线。
// 视觉走 calc.css 的 `.event-selector`/`.event-btn`(奶油纸 art-directed 皮肤);
// 传 containerClassName="event-selector" 让共享组件的 css 不渗入、calc 自带皮肤接管。
// 废止项目折叠三角 + 选中废止项强制展开的行为由共享组件内建,与原实现一致。

'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCalcStore, solveCountForEvent } from '../stores/calc_store';
import { setCurrentEvent } from '../engine/calc_engine';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import WcaEventSelector from '@/components/WcaEventSelector';

export function EventSelector() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const event = useCalcStore(s => s.event);
  const setEvent = useCalcStore(s => s.setEvent);
  const resizeTimes = useCalcStore(s => s.resizeTimes);

  // calc 里所有 WCA 项目都可选,给一个「全可用」集合。
  const availableEvents = useMemo(() => new Set(ALL_EVENT_IDS), []);

  const handleSelect = (id: string) => {
    if (id === event) return;
    setEvent(id);
    setCurrentEvent(id);
    // 项目切换 → 调整 times 数组长度(Mo3=3, Ao5=5)。
    resizeTimes(solveCountForEvent(id));
  };

  return (
    <WcaEventSelector
      containerClassName="event-selector"
      availableEvents={availableEvents}
      selectedEvent={event}
      onSelect={handleSelect}
      isZh={isZh}
    />
  );
}

export default EventSelector;
