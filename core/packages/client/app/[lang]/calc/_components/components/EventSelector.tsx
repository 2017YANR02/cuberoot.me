// NOTE: 项目选择器 — 从 event_selector.js 迁移
// 21 个 WCA 项目按钮(使用 cubing-icons 字体图标)
// 项目顺序 + tooltip 翻译走 utils/wca_events.ts (与 wca-event skill 一致),不重写映射

'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCalcStore, solveCountForEvent } from '../stores/calc_store';
import { setCurrentEvent } from '../engine/calc_engine';
import { eventDisplayName } from '@/lib/wca-events';
import { ALL_EVENT_IDS, CANCELLED_EVENT_IDS } from '@/lib/event-constants';
import { CubingIcon } from '@/components/EventIcon/EventIcon';
import { tr } from '@/i18n/tr';

// 项目列表走共享的 ALL_EVENT_IDS 单一源(与 CANCELLED_EVENT_IDS 同一文件),不再本地重抄。
const OFFICIAL_IDS = ALL_EVENT_IDS.filter(id => !CANCELLED_EVENT_IDS.has(id));
const CANCELLED_IDS = ALL_EVENT_IDS.filter(id => CANCELLED_EVENT_IDS.has(id));

export function EventSelector() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const event = useCalcStore(s => s.event);
  const setEvent = useCalcStore(s => s.setEvent);
  const resizeTimes = useCalcStore(s => s.resizeTimes);

  // 废止项目默认折叠在三角形后;当前已选中废止项时强制展开。
  const hasSelectedCancelled = CANCELLED_EVENT_IDS.has(event);
  const [expanded, setExpanded] = useState(false);
  const showCancelled = expanded || hasSelectedCancelled;

  const handleSelect = (id: string) => {
    if (id === event) return;
    setEvent(id);
    setCurrentEvent(id);
    // NOTE: 项目切换 → 调整 times 数组长度（Mo3=3, Ao5=5）
    resizeTimes(solveCountForEvent(id));
  };

  const renderBtn = (id: string) => (
    <button
      key={id}
      className={`event-btn calc-btn ${event === id ? 'active' : ''}`}
      data-tooltip={eventDisplayName(id, isZh)}
      onClick={() => handleSelect(id)}
    >
      <CubingIcon icon={`event-${id}`} />
    </button>
  );

  return (
    <div className="event-selector">
      {OFFICIAL_IDS.map(renderBtn)}
      {!hasSelectedCancelled && (
        <button
          type="button"
          className="event-btn event-btn-more calc-btn"
          data-tooltip={tr({ zh: '已废止项目', en: 'Former events'
        })}
          onClick={() => setExpanded(v => !v)}
        >
          <span className="event-more-arrow">{expanded ? '▴' : '▾'}</span>
        </button>
      )}
      {showCancelled && CANCELLED_IDS.map(renderBtn)}
    </div>
  );
}

export default EventSelector;
