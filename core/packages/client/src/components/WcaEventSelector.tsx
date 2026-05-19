// WCA 项目选择器 — 21 个图标按钮行。单选默认,传 selectedEvents+onToggle 切多选。
// 跨页共用:wca-stats 各 tab + /scramble/gen QuickMode/TNoodleMode

import { ALL_EVENT_IDS, EVENT_ZH, EVENT_EN } from '../pages/wca_stats/event_constants';
import { eventDisplayName } from '../utils/wca_events';
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
  /** 给已选中的图标右上角加 × 直接移除。multi-select 才生效;不传不显示。 */
  onRemove?: (id: string) => void;
  /**
   * 追加在 WCA 21 项之后的额外项目(非 WCA / 自定义),同一个容器 flex-wrap。
   * 必须自带 iconClass(`unofficial-fto` / 等),WcaEventSelector 不知道这些 id
   * 对应的字体类名,由 caller 提供。
   * tooltip 用 `eventDisplayName(id, isZh)` 兜底,不传 label。
   */
  appendEvents?: ReadonlyArray<{ id: string; iconClass: string; label?: string }>;
}

export default function WcaEventSelector({
  availableEvents, selectedEvent, onSelect, isZh, allowAll,
  selectedEvents, onToggle, badges, onlyAvailable, onRemove, appendEvents,
}: WcaEventSelectorProps) {
  const isMulti = !!(selectedEvents && onToggle);
  const renderedIds = onlyAvailable
    ? ALL_EVENT_IDS.filter(id => availableEvents.has(id))
    : ALL_EVENT_IDS;
  const renderedAppend = appendEvents
    ? (onlyAvailable ? appendEvents.filter(e => availableEvents.has(e.id)) : appendEvents)
    : [];
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
            {isMulti && isActive && onRemove && (
              <span
                className="event-btn-remove"
                role="button"
                aria-label={isZh ? '移除' : 'Remove'}
                onClick={(e) => { e.stopPropagation(); onRemove(id); }}
              >×</span>
            )}
          </button>
        );
      })}
      {renderedAppend.map(({ id, iconClass, label }) => {
        const isActive = isMulti ? selectedEvents!.has(id) : id === selectedEvent;
        const tooltip = label ?? eventDisplayName(id, isZh);
        return (
          <button
            key={id}
            className={`event-btn${isActive ? ' active' : ''}`}
            data-tooltip={tooltip}
            data-event={id}
            onClick={() => (isMulti ? onToggle!(id) : onSelect?.(id))}
          >
            <span className={`cubing-icon ${iconClass}`} />
            {badges?.[id] !== undefined && (
              <span className="event-btn-badge">{badges[id]}</span>
            )}
            {isMulti && isActive && onRemove && (
              <span
                className="event-btn-remove"
                role="button"
                aria-label={isZh ? '移除' : 'Remove'}
                onClick={(e) => { e.stopPropagation(); onRemove(id); }}
              >×</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
