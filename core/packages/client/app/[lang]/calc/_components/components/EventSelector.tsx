// 项目选择器 — 薄封装共享的 <PuzzlePicker>,只保留 calc store 接线。

'use client';

import { useTranslation } from 'react-i18next';
import { useCalcStore, solveCountForEvent } from '../stores/calc_store';
import { setCurrentEvent } from '../engine/calc_engine';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import PuzzlePicker from '@/components/PuzzlePicker/PuzzlePicker';

const WCA_EVENTS = new Set(ALL_EVENT_IDS);
const NO_NON_WCA_EVENTS = new Set<string>();

export function EventSelector() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const event = useCalcStore(s => s.event);
  const setEvent = useCalcStore(s => s.setEvent);
  const resizeTimes = useCalcStore(s => s.resizeTimes);

  const handleSelect = (id: string) => {
    if (id === event) return;
    setEvent(id);
    setCurrentEvent(id);
    // 项目切换 → 调整 times 数组长度(Mo3=3, Ao5=5)。
    resizeTimes(solveCountForEvent(id));
  };

  return (
    <div className="event-selector">
      <PuzzlePicker
        wcaEvents={WCA_EVENTS}
        availableEvents={NO_NON_WCA_EVENTS}
        selectedEvent={event}
        onSelect={handleSelect}
        isZh={isZh}
      />
    </div>
  );
}

export default EventSelector;
