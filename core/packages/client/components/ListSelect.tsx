'use client';

/**
 * 通用列表筛选下拉——button + popup,支持国旗 + 搜索 + × 清除 + (空) 桶
 * Ported from packages/client-vite/src/components/ListSelect/ListSelect.tsx.
 * caller 预格式化 label / hint / country / searchTerms,组件不做本地化。
 */
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, X } from '@app-foundation/icons/lucide';
import { CompactSelect } from '@/components/CompactSelect';
import { ClearButton } from '@/components/ClearButton';
import { Flag } from '@/components/Flag';
import { usePanelClamp } from '@/hooks/usePanelClamp';
import { tr } from '@/i18n/tr';
import './ListSelect.css';
import { CountryPinButton } from '@/components/CountryPinButton';
import { usePinnedCountries } from '@/hooks/usePinnedCountries';
import { partitionPinnedCountries } from '@/lib/pinned-countries';

export interface ListSelectItem {
  /** 唯一 key,也是 onChange 回传值 */
  value: string;
  /** 已本地化的显示文本 */
  label: string;
  /** 次要文字 (如 count) — 显示在 label 后,带括号自己写好 */
  hint?: string;
  /** 用于搜索过滤的额外文本 (如中文模式下也想被英文名命中) */
  searchTerms?: string;
  /** ISO2 国家码;非空时 label 前渲染 <Flag> */
  country?: string;
  /** label 前的自定义图标 */
  icon?: ReactNode;
  /** Keep the label for search and accessibility, showing only the icon. */
  hideLabel?: boolean;
  /** 此项前显示分隔线 */
  separatorBefore?: boolean;
  /** 置灰 + 不可选 (如该项暂无条目) */
  disabled?: boolean;
  /** Optional expandable group; items in each group should be contiguous. */
  group?: { value: string; label: string; icon?: ReactNode; hideLabel?: boolean };
}

interface ListSelectProps {
  /** Escape scrolling tables using the shared viewport-positioned menu. */
  portal?: boolean;
  showArrow?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  pinCountries?: boolean;
  items: ListSelectItem[];
  value: string;
  onChange: (next: string) => void;
  allLabel: string;
  className?: string;
  /** popup 顶部加搜索框 (列表长时建议开) */
  searchable?: boolean;
  /** 是否显示 × 清除按钮. 默认 true (筛选语义). 视图切换器这种"必须选一项"的场景传 false. */
  clearable?: boolean;
  /** popup 里最多渲染几条 (超出显示「还有 N 项」提示). 列表上百条时必传, 否则一次开就是几百个 DOM 节点. */
  maxVisible?: number;
  /** 搜索框 placeholder */
  searchPlaceholder?: string;
}

export function ListSelect({ portal = false, showArrow = true, items, value, onChange, allLabel, className, searchable, clearable = true, maxVisible, searchPlaceholder, pinCountries = false, disabled = false, ariaLabel }: ListSelectProps) {
  const [pins, togglePin] = usePinnedCountries();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  usePanelClamp(open && !portal, panelRef);

  // The horizontal clamp cannot keep a menu above a phone keyboard or the bottom edge.
  // Flip toward the larger space and scroll within that space, rather than off the page.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const anchor = ref.current;
    if (portal || !open || !panel || !anchor) return;
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const bottom = top + (viewport?.height ?? window.innerHeight);
      const above = Math.max(0, rect.top - top - 12);
      const below = Math.max(0, bottom - rect.bottom - 12);
      const upwards = below < Math.min(panel.scrollHeight, 330) && above > below;
      panel.style.top = upwards ? 'auto' : 'calc(100% + 4px)';
      panel.style.bottom = upwards ? 'calc(100% + 4px)' : 'auto';
      panel.style.maxHeight = `${Math.max(0, upwards ? above : below)}px`;
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.visualViewport?.removeEventListener('resize', place);
    };
  }, [open, expandedGroups, query, portal]);

  useEffect(() => {
    if (!open || portal) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, portal]);

  useEffect(() => {
    if (open && searchable) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, searchable]);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter(i =>
      i.label.toLowerCase().includes(q) ||
      i.value.toLowerCase().includes(q) ||
      (i.searchTerms ?? '').toLowerCase().includes(q) ||
      (i.group?.label ?? '').toLowerCase().includes(q),
    );
  }, [items, query, searchable]);

  // maxVisible 未传 = 老行为(全渲染)。传了就截断,剩余数量在列表底部提示,靠继续输入收敛。
  const { pinned, others } = partitionPinnedCountries(filtered, pinCountries ? pins : [], item => item.country ?? '');
  const ordered = [...pinned, ...others];
  const shown = maxVisible && ordered.length > maxVisible ? ordered.slice(0, maxVisible) : ordered;
  const hidden = filtered.length - shown.length;

  const select = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const current = items.find(i => i.value === value);

  const searching = !!(searchable && query.trim());
  const activeGroup = shown.find(item => item.group && expandedGroups[item.group.value])?.group;
  const renderItem = (item: ListSelectItem) => {
    const button = <button type="button" disabled={item.disabled} title={item.hideLabel ? item.label : undefined}
      className={`list-select-item${item.group ? ' list-select-item--child' : ''}${value === item.value ? ' list-select-item--active' : ''}${item.disabled ? ' list-select-item--disabled' : ''}`}
      onClick={() => { if (!item.disabled) select(item.value); }}>
      {item.country && <Flag iso2={item.country} className="list-select-flag" />}
      {item.icon && <span className="list-select-icon" aria-hidden>{item.icon}</span>}
      <span className={item.hideLabel ? 'sr-only' : 'list-select-label'}>{item.label}</span>
      {item.hint && <span className="list-select-hint">{item.hint}</span>}
    </button>;
    return <Fragment key={`item:${item.value}`}>
      {item.separatorBefore && <div className="list-select-separator" aria-hidden />}
      {pinCountries && item.country && !item.disabled ? <div className="country-pin-row">{button}
        <CountryPinButton name={item.label} pinned={pins.includes(item.country.toLowerCase())} onToggle={() => togglePin(item.country!)} />
      </div> : button}
    </Fragment>;
  };
  const menuContent = <>
    {searchable && <div className="list-select-search-row">
      <input ref={inputRef} type="text" className="list-select-search" value={query} placeholder={searchPlaceholder}
        onChange={e => setQuery(e.target.value)} autoFocus />
      {query && <ClearButton onClick={() => { setQuery(''); inputRef.current?.focus(); }} />}
    </div>}
    <div className="list-select-columns">
      <div className="list-select-list">
        {shown.map((item, index) => {
          const group = item.group;
          if (!group || searching) return renderItem(item);
          if (shown.slice(0, index).some(other => other.group?.value === group.value)) return null;
          const expanded = activeGroup?.value === group.value;
          return <button key={`group:${group.value}`} type="button" className="list-select-item" aria-expanded={expanded}
            title={group.hideLabel ? group.label : undefined}
            onClick={() => setExpandedGroups(expanded ? {} : { [group.value]: true })}
            onKeyDown={event => { if (event.key === 'ArrowRight') { event.preventDefault(); setExpandedGroups({ [group.value]: true }); } }}>
            {group.icon && <span className="list-select-icon" aria-hidden>{group.icon}</span>}
            <span className={group.hideLabel ? 'sr-only' : 'list-select-label'}>{group.label}</span>
            <ChevronDown size={14} className="list-select-group-chevron" />
          </button>;
        })}
        {hidden > 0 && <div className="list-select-more">
          {tr({ zh: `还有 ${hidden} 项,继续输入以缩小范围`, en: `${hidden} more — keep typing to narrow` })}
        </div>}
      </div>
      {!searching && activeGroup && <div className="list-select-list list-select-submenu" role="group" aria-label={activeGroup.label}
        onKeyDown={event => { if (event.key === 'ArrowLeft') { event.preventDefault(); setExpandedGroups({}); } }}>
        {shown.filter(item => item.group?.value === activeGroup.value).map(renderItem)}
      </div>}
    </div>
  </>;
  if (portal) return <CompactSelect className={className} popupClassName="wca-relation-filter-popup" unstyledTrigger showArrow={showArrow}
    ariaLabel={ariaLabel ?? allLabel} label={current ? <span title={current.hideLabel ? current.label : undefined}>{current.icon}<span className={current.hideLabel ? 'sr-only' : undefined}>{current.label}</span></span> : allLabel}
    items={shown.filter(item => !item.group || expandedGroups[item.group.value] || (searchable && query.trim()))} value={value} onChange={select} disabled={disabled} open={open}
    onOpenChange={next => {
      if (next) { const group = current?.group; setExpandedGroups(group ? { [group.value]: true } : {}); }
      setOpen(next);
    }} panelContent={menuContent} />;

  return (
    <div ref={ref} className={`list-select ${className ?? ''}`.trim()}>
      <button
        type="button"
        className="list-select-trigger"
        disabled={disabled}
        aria-label={ariaLabel ?? (current?.hideLabel ? current.label : undefined)}
        title={current?.hideLabel ? current.label : undefined}
        aria-expanded={open}
        onClick={() => {
          if (!open) {
            const group = items.find(item => item.value === value)?.group;
            setExpandedGroups(group ? { [group.value]: true } : {});
          }
          setOpen(o => !o);
        }}
      >
        <span className="list-select-current">
          {current ? (
            <>
              {current.country && <Flag iso2={current.country} className="list-select-flag" />}
              {current.icon && <span className="list-select-icon" aria-hidden>{current.icon}</span>}
              <span className={current.hideLabel ? 'sr-only' : 'list-select-label'}>{current.label}</span>
              {current.hint && <span className="list-select-hint">{current.hint}</span>}
            </>
          ) : (
            <span className="list-select-label">{allLabel}</span>
          )}
        </span>
        {clearable && value && (
          <span
            className="list-select-clear"
            role="button"
            aria-label="clear"
            onClick={e => { e.stopPropagation(); onChange(''); }}
          >
            <X size={14} />
          </span>
        )}
        {showArrow && <ChevronDown size={14} className="list-select-chevron" />}
      </button>
      {open && !disabled && (
        <div ref={panelRef} className="list-select-popup" data-site-surface="popover">
          {menuContent}
        </div>
      )}
    </div>
  );
}
