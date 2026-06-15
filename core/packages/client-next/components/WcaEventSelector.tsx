'use client';

// Ported from packages/client/src/components/WcaEventSelector.tsx.

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { ALL_EVENT_IDS, CANCELLED_EVENT_IDS, EVENT_ZH, EVENT_EN } from '@/lib/event-constants';
import { eventDisplayName } from '@/lib/wca-events';
import { CubingIcon } from './EventIcon/EventIcon';
import './WcaEventSelector.css';
import { tr } from '@/i18n/tr';

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

type AppendItem = { id: string; iconClass: string; label?: string; textLabel?: string };

export default function WcaEventSelector({
  availableEvents, selectedEvent, onSelect, isZh, allowAll,
  selectedEvents, onToggle, badges, topBadges, onlyAvailable, onRemove, appendEvents,
  collapsibleAppend, onExpandedChange,
}: WcaEventSelectorProps) {
  const isMulti = !!(selectedEvents && onToggle);
  const renderedIds = onlyAvailable
    ? ALL_EVENT_IDS.filter(id => availableEvents.has(id))
    : ALL_EVENT_IDS;
  const officialIds = renderedIds.filter(id => !CANCELLED_EVENT_IDS.has(id));
  const cancelledIds = renderedIds.filter(id => CANCELLED_EVENT_IDS.has(id));
  const renderedAppend = useMemo(() => (appendEvents
    ? (onlyAvailable ? appendEvents.filter(e => availableEvents.has(e.id)) : appendEvents)
    : []), [appendEvents, onlyAvailable, availableEvents]);

  const selSet: ReadonlySet<string> = useMemo(() => (isMulti
    ? selectedEvents!
    : selectedEvent ? new Set([selectedEvent]) : new Set<string>()
  ), [isMulti, selectedEvents, selectedEvent]);

  // 折叠在三角形后的「额外项」:废止项(脚拧/八板/十二板/旧多盲)始终折叠;非 WCA 追加项仅
  // collapsibleAppend 时折叠。两者都折叠时合并到同一个三角,避免并排两个三角。
  const appendCollapsible = !!collapsibleAppend && renderedAppend.length > 0;
  const inlineAppend: ReadonlyArray<AppendItem> = collapsibleAppend ? [] : renderedAppend;
  const hiddenAppend: ReadonlyArray<AppendItem> = appendCollapsible ? renderedAppend : [];
  const hasHiddenContent = cancelledIds.length > 0 || appendCollapsible;

  // 选中了折叠组里的任一项 → 强制展开并隐藏三角(否则会把当前选择藏掉)。
  const hasSelectedHidden = cancelledIds.some(id => selSet.has(id))
    || hiddenAppend.some(e => selSet.has(e.id));
  const [expanded, setExpanded] = useState(false);
  const showHidden = expanded || hasSelectedHidden;
  const showToggle = hasHiddenContent && !hasSelectedHidden;

  const toggleTip = (cancelledIds.length > 0 && appendCollapsible)
    ? tr({ zh: '其他项目', en: 'Other events'
          })
    : appendCollapsible
      ? tr({ zh: '其他 (非 WCA 项目)', en: 'Other (non-WCA puzzles)'
              })
      : tr({ zh: '已废止项目', en: 'Former events'
              });

  const removeBtn = (id: string, isActive: boolean) => (isMulti && isActive && onRemove ? (
    <span
      className="event-btn-remove"
      role="button"
      aria-label={tr({ zh: '移除', en: 'Remove' })}
      onClick={(e) => { e.stopPropagation(); onRemove(id); }}
    ><X size={10} strokeWidth={3} /></span>
  ) : null);

  const eventBadges = (id: string, isActive: boolean) => (
    <>
      {badges?.[id] !== undefined && (
        <span className="event-btn-badge">{badges[id]}</span>
      )}
      {topBadges?.[id] !== undefined && !(isMulti && isActive && onRemove) && (
        <span className="event-btn-badge event-btn-badge-top">{topBadges[id]}</span>
      )}
    </>
  );

  const renderWcaButton = (id: string) => {
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
        {eventBadges(id, isActive)}
        {removeBtn(id, isActive)}
      </button>
    );
  };

  const renderAppendButton = ({ id, iconClass, label, textLabel }: AppendItem) => {
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
        {eventBadges(id, isActive)}
        {removeBtn(id, isActive)}
      </button>
    );
  };

  return (
    <div className="wca-stats-event-selector">
      {allowAll && !isMulti && (
        <button
          className={`event-btn event-btn-all${selectedEvent === '' ? ' active' : ''}`}
          data-tooltip={tr({ zh: '全部', en: 'All' })}
          onClick={() => onSelect?.('')}
        >
          <span className="event-all-label">{tr({ zh: '全部', en: 'All' })}</span>
        </button>
      )}
      {officialIds.map(renderWcaButton)}
      {showToggle && (
        <button
          type="button"
          className={`event-btn event-btn-more${expanded ? ' active' : ''}`}
          data-tooltip={toggleTip}
          onClick={() => {
            const next = !expanded;
            setExpanded(next);
            onExpandedChange?.(next);
          }}
        >
          <span className="event-more-arrow">{expanded ? '▴' : '▾'}</span>
        </button>
      )}
      {showHidden && cancelledIds.map(renderWcaButton)}
      {showHidden && hiddenAppend.map(renderAppendButton)}
      {inlineAppend.map(renderAppendButton)}
    </div>
  );
}
