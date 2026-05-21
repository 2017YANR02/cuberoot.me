// WCA 项目选择器 — 21 个图标按钮行。单选默认,传 selectedEvents+onToggle 切多选。
// 跨页共用:wca-stats 各 tab + /scramble/gen QuickMode/TNoodleMode

import { useMemo, useState } from 'react';
import { ALL_EVENT_IDS, EVENT_ZH, EVENT_EN } from '../pages/wca_stats/event_constants';
import { eventDisplayName } from '../utils/wca_events';
import { CubingIcon } from './EventIcon/EventIcon';
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
   * 优先用 iconClass 渲染图标(`unofficial-*` 来自 cubing-icons 字体);若 iconClass
   * 为空字符串则 fallback 渲染 textLabel 当作文字按钮(用于 cstimer 系列中没有图标的
   * 罕见 puzzle)。tooltip 走 `label ?? eventDisplayName(id, isZh)`。
   */
  appendEvents?: ReadonlyArray<{ id: string; iconClass: string; label?: string; textLabel?: string }>;
  /**
   * appendEvents 多到塞满 3-4 行时启用。默认折起,用户点 "其他 ▾" chip 展开。
   * 如果当前 selectedEvent(s) 命中 appendEvents 里任意一项,会自动展开(否则
   * 用户选了 Pyramorphix 再 reload 看不到自己选了什么)。
   */
  collapsibleAppend?: boolean;
  /** "其他" 展开/收起时触发;父组件可借此联动隐藏 / 显示其它非 WCA 配置入口
   *  (例如 QuickMode 的 8-50 高阶 NxN 输入框)。 */
  onExpandedChange?: (expanded: boolean) => void;
}

export default function WcaEventSelector({
  availableEvents, selectedEvent, onSelect, isZh, allowAll,
  selectedEvents, onToggle, badges, onlyAvailable, onRemove, appendEvents,
  collapsibleAppend, onExpandedChange,
}: WcaEventSelectorProps) {
  const isMulti = !!(selectedEvents && onToggle);
  const renderedIds = onlyAvailable
    ? ALL_EVENT_IDS.filter(id => availableEvents.has(id))
    : ALL_EVENT_IDS;
  const renderedAppend = useMemo(() => (appendEvents
    ? (onlyAvailable ? appendEvents.filter(e => availableEvents.has(e.id)) : appendEvents)
    : []), [appendEvents, onlyAvailable, availableEvents]);

  // 任何 append 项目被选中 → 强制展开,避免选了但 UI 看不到。
  const hasSelectedAppend = useMemo(() => {
    if (!collapsibleAppend || renderedAppend.length === 0) return false;
    const selSet: ReadonlySet<string> = isMulti
      ? selectedEvents!
      : selectedEvent
        ? new Set([selectedEvent])
        : new Set();
    return renderedAppend.some(e => selSet.has(e.id));
  }, [collapsibleAppend, renderedAppend, isMulti, selectedEvents, selectedEvent]);

  const [userExpanded, setUserExpanded] = useState(false);
  const showAppend = !collapsibleAppend || userExpanded || hasSelectedAppend;
  const showToggle = collapsibleAppend && renderedAppend.length > 0 && !hasSelectedAppend;

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
            <CubingIcon icon={`event-${id}`} />
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
      {showToggle && (
        <button
          type="button"
          className={`event-btn event-btn-more${userExpanded ? ' active' : ''}`}
          data-tooltip={isZh ? '其他 (非 WCA 项目)' : 'Other (non-WCA puzzles)'}
          onClick={() => {
            const next = !userExpanded;
            setUserExpanded(next);
            onExpandedChange?.(next);
          }}
        >
          <span className="event-more-arrow">{userExpanded ? '▴' : '▾'}</span>
        </button>
      )}
      {showAppend && renderedAppend.map(({ id, iconClass, label, textLabel }) => {
        const isActive = isMulti ? selectedEvents!.has(id) : id === selectedEvent;
        const tooltip = label ?? eventDisplayName(id, isZh);
        return (
          <button
            key={id}
            className={`event-btn${isActive ? ' active' : ''}${iconClass ? '' : ' event-btn-text'}`}
            data-tooltip={tooltip}
            data-event={id}
            onClick={() => (isMulti ? onToggle!(id) : onSelect?.(id))}
          >
            {iconClass
              ? <CubingIcon icon={iconClass} />
              : <span className="event-text-label">{textLabel ?? id}</span>}
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
