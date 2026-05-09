// NOTE: WCA 项目选择器组件 — 21 个图标按钮行
// 对标 Legacy event_selector.ts 的 createSelector()

import { ALL_EVENT_IDS, EVENT_ZH, EVENT_EN } from './event_constants';
import './WcaEventSelector.css';

interface WcaEventSelectorProps {
  availableEvents: Set<string>;   // 有数据的项目 ID 集合
  selectedEvent: string;           // 当前选中的项目 ID
  onSelect: (id: string) => void;  // 选中回调
  isZh: boolean;                    // 中英文切换
}

export default function WcaEventSelector({
  availableEvents, selectedEvent, onSelect, isZh
}: WcaEventSelectorProps) {
  return (
    <div className="wca-stats-event-selector">
      {ALL_EVENT_IDS.map(id => {
        const isDisabled = !availableEvents.has(id);
        const isActive = id === selectedEvent;
        const tooltip = isZh ? (EVENT_ZH[id] || id) : (EVENT_EN[id] || id);

        return (
          <button
            key={id}
            className={`event-btn${isActive ? ' active' : ''}${isDisabled ? ' disabled' : ''}`}
            data-tooltip={tooltip}
            data-event={id}
            onClick={isDisabled ? undefined : () => onSelect(id)}
          >
            <span className={`cubing-icon event-${id}`} />
          </button>
        );
      })}
    </div>
  );
}
