// WCA 项目选择器 — 21 个图标按钮行。单选默认,传 selectedEvents+onToggle 切多选。
// 跨页共用:wca-stats 各 tab + /scramble/gen QuickMode/TNoodleMode

import { ALL_EVENT_IDS, EVENT_ZH, EVENT_EN } from '../pages/wca_stats/event_constants';
import './WcaEventSelector.css';

interface WcaEventSelectorProps {
  availableEvents: Set<string>;            // 有数据的项目 ID 集合
  isZh: boolean;
  allowAll?: boolean;                      // 单选时在最前加"全部"按钮(selectedEvent === '')
  // 单选 API
  selectedEvent?: string;
  onSelect?: (id: string) => void;
  // 多选 API(同时传 selectedEvents+onToggle 即进入多选)
  selectedEvents?: ReadonlySet<string>;
  onToggle?: (id: string) => void;
}

export default function WcaEventSelector({
  availableEvents, selectedEvent, onSelect, isZh, allowAll,
  selectedEvents, onToggle,
}: WcaEventSelectorProps) {
  const isMulti = !!(selectedEvents && onToggle);
  return (
    <div className="wca-stats-event-selector">
      {allowAll && !isMulti && (
        <button
          className={`event-btn event-btn-all${selectedEvent === '' ? ' active' : ''}`}
          data-tooltip={isZh ? '全部' : 'All'}
          onClick={() => onSelect?.('')}
        >
          <span className="event-all-label">{isZh ? '全部' : 'All'}</span>
        </button>
      )}
      {ALL_EVENT_IDS.map(id => {
        const isDisabled = !availableEvents.has(id);
        const isActive = isMulti ? selectedEvents!.has(id) : id === selectedEvent;
        const tooltip = isZh ? (EVENT_ZH[id] || id) : (EVENT_EN[id] || id);
        const handleClick = isDisabled
          ? undefined
          : () => (isMulti ? onToggle!(id) : onSelect?.(id));

        return (
          <button
            key={id}
            className={`event-btn${isActive ? ' active' : ''}${isDisabled ? ' disabled' : ''}`}
            data-tooltip={tooltip}
            data-event={id}
            onClick={handleClick}
          >
            <span className={`cubing-icon event-${id}`} />
          </button>
        );
      })}
    </div>
  );
}
