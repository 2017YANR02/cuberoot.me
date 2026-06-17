'use client';

// Ported from packages/client-vite/src/components/WcaEventSelector.tsx.

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { X, Search } from 'lucide-react';
import { ALL_EVENT_IDS, CANCELLED_EVENT_IDS, EVENT_ZH, EVENT_EN } from '@/lib/event-constants';
import { eventDisplayName } from '@/lib/wca-events';
import { CubingIcon } from './EventIcon/EventIcon';
import AppLink from './AppLink';
import { ClearButton } from './ClearButton';
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
  /**
   * 显示一个搜索框,按项目名(中/英)或 id 过滤图标。项目太多时(如打乱生成器批量模式)用。
   * 搜索激活时展开折叠组、隐藏三角,只渲染命中的图标(官方 + 废止 + 非 WCA 追加项一起搜)。
   */
  searchable?: boolean;
  /**
   * 链接模式:给定事件 id 返回其跳转目标 + 是否硬导航(跨 COEP 边界用原生 <a> 整页加载)。
   * 返回 null = 该事件无链接(退回普通 button)。设置后官方事件渲染为 <a>/AppLink 而非 button,
   * 保留中键 / Ctrl 新开;供「求解」中心复用同一选择器跳页(/scramble/solver|pocket|...)。
   */
  linkFor?: (id: string) => { href: string; hard?: boolean } | null;
}

type AppendItem = { id: string; iconClass: string; label?: string; textLabel?: string };

export default function WcaEventSelector({
  availableEvents, selectedEvent, onSelect, isZh, allowAll,
  selectedEvents, onToggle, badges, topBadges, onlyAvailable, onRemove, appendEvents,
  collapsibleAppend, onExpandedChange, linkFor, searchable,
}: WcaEventSelectorProps) {
  const params = useParams();
  const prefix = params?.lang === 'zh' ? '/zh' : '';
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

  // 搜索:命中项目名(中/英)/ 显示名 / id 即保留。激活时绕过折叠逻辑,扁平渲染所有命中。
  const [query, setQuery] = useState('');
  const q = searchable ? query.trim().toLowerCase() : '';
  const searching = q.length > 0;
  const matchWca = (id: string): boolean => {
    if (!searching) return true;
    const hay = `${id} ${EVENT_ZH[id] ?? ''} ${EVENT_EN[id] ?? ''} ${eventDisplayName(id, true)} ${eventDisplayName(id, false)}`.toLowerCase();
    return hay.includes(q);
  };
  const matchAppend = (e: AppendItem): boolean => {
    if (!searching) return true;
    const hay = `${e.id} ${e.label ?? ''} ${e.textLabel ?? ''} ${eventDisplayName(e.id, true)} ${eventDisplayName(e.id, false)}`.toLowerCase();
    return hay.includes(q);
  };

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
    const cls = `event-btn${isActive ? ' active' : ''}${isDisabled ? ' disabled' : ''}`;
    const inner = (
      <>
        <CubingIcon icon={`event-${id}`} />
        {eventBadges(id, isActive)}
        {removeBtn(id, isActive)}
      </>
    );

    // 链接模式:可用事件渲染成真实 <a>/AppLink(中键/Ctrl 新开),跨 COEP 边界(进/出
    // /scramble/solver)用原生 <a> 整页加载,其余 AppLink 软导航。
    const link = !isDisabled && linkFor ? linkFor(id) : null;
    if (link) {
      const aria = isActive ? 'page' : undefined;
      return link.hard ? (
        <a key={id} href={`${prefix}${link.href}`} className={cls} data-tooltip={tooltip} data-event={id} aria-label={tooltip} aria-current={aria}>
          {inner}
        </a>
      ) : (
        <AppLink key={id} href={link.href} className={cls} data-tooltip={tooltip} data-event={id} aria-label={tooltip} aria-current={aria}>
          {inner}
        </AppLink>
      );
    }

    const handleClick = isDisabled
      ? undefined
      : () => (isMulti ? onToggle!(id) : onSelect?.(id));
    return (
      <button key={id} className={cls} data-tooltip={tooltip} data-event={id} aria-label={tooltip} onClick={handleClick}>
        {inner}
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

  const gridChildren = searching ? (
    <>
      {officialIds.filter(matchWca).map(renderWcaButton)}
      {cancelledIds.filter(matchWca).map(renderWcaButton)}
      {renderedAppend.filter(matchAppend).map(renderAppendButton)}
    </>
  ) : (
    <>
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
    </>
  );

  const grid = <div className="wca-stats-event-selector">{gridChildren}</div>;
  if (!searchable) return grid;

  const noResults = searching
    && !officialIds.some(matchWca)
    && !cancelledIds.some(matchWca)
    && !renderedAppend.some(matchAppend);

  return (
    <div className="wca-evsel-with-search">
      <div className="wca-evsel-search">
        <Search size={14} className="wca-evsel-search-icon" />
        <input
          type="text"
          className="wca-evsel-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr({ zh: '搜索项目…', en: 'Search puzzles…' })}
          aria-label={tr({ zh: '搜索项目', en: 'Search puzzles' })}
        />
        {query && (
          <ClearButton variant="inline" isZh={isZh} preserveFocus onClick={() => setQuery('')} />
        )}
      </div>
      {noResults ? (
        <div className="wca-evsel-no-results">{tr({ zh: '无匹配项目', en: 'No matching puzzles' })}</div>
      ) : grid}
    </div>
  );
}
