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
  /** 在每个图标右下角渲染一个小角标(用于显示轮数等附加信息)。 */
  badges?: Record<string, string | number>;
  /** 只渲染 availableEvents 集合里的图标(隐藏其它,而非灰显)。 */
  onlyAvailable?: boolean;
}

export default function WcaEventSelector({
  availableEvents, selectedEvent, onSelect, isZh, allowAll,
  selectedEvents, onToggle, badges, onlyAvailable,
}: WcaEventSelectorProps) {
  const isMulti = !!(selectedEvents && onToggle);
  const renderedIds = onlyAvailable
    ? ALL_EVENT_IDS.filter(id => availableEvents.has(id))
    : ALL_EVENT_IDS;
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
      {renderedIds.map(id => {
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
            {badges?.[id] !== undefined && (
              <span className="event-btn-badge">{badges[id]}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
