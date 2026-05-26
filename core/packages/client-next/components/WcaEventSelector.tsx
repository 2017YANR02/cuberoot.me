'use client';

// Ported from packages/client/src/components/WcaEventSelector.tsx.

import { useMemo, useState } from 'react';
import { ALL_EVENT_IDS, EVENT_ZH, EVENT_EN } from '@/lib/event-constants';
import { eventDisplayName } from '@/lib/wca-events';
import { CubingIcon } from './EventIcon/EventIcon';
import './WcaEventSelector.css';

interface WcaEventSelectorProps {
  availableEvents: Set<string>;
  isZh: boolean;
  allowAll?: boolean;
  selectedEvent?: string;
  onSelect?: (id: string) => void;
  selectedEvents?: ReadonlySet<string>;
  onToggle?: (id: string) => void;
  badges?: Record<string, string | number>;
  topBadges?: Record<string, string | number>;
  onlyAvailable?: boolean;
  onRemove?: (id: string) => void;
  appendEvents?: ReadonlyArray<{ id: string; iconClass: string; label?: string; textLabel?: string }>;
  collapsibleAppend?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export default function WcaEventSelector({
  availableEvents, selectedEvent, onSelect, isZh, allowAll,
  selectedEvents, onToggle, badges, topBadges, onlyAvailable, onRemove, appendEvents,
  collapsibleAppend, onExpandedChange,
}: WcaEventSelectorProps) {
  const isMulti = !!(selectedEvents && onToggle);
  const renderedIds = onlyAvailable
    ? ALL_EVENT_IDS.filter(id => availableEvents.has(id))
    : ALL_EVENT_IDS;
  const renderedAppend = useMemo(() => (appendEvents
    ? (onlyAvailable ? appendEvents.filter(e => availableEvents.has(e.id)) : appendEvents)
    : []), [appendEvents, onlyAvailable, availableEvents]);

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
            {topBadges?.[id] !== undefined && !(isMulti && isActive && onRemove) && (
              <span className="event-btn-badge event-btn-badge-top">{topBadges[id]}</span>
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
            {topBadges?.[id] !== undefined && !(isMulti && isActive && onRemove) && (
              <span className="event-btn-badge event-btn-badge-top">{topBadges[id]}</span>
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
