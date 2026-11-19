'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, Search, SlidersHorizontal, X } from '@app-foundation/icons/lucide';
import { SearchInput } from '@/components/SearchInput';
import { usePopoverDismiss } from '@/hooks/usePopoverDismiss';
import { usePanelClamp } from '@/hooks/usePanelClamp';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useT } from '@/hooks/useT';
import type { PlatformFilterGroup, PlatformSearchFilters } from '@/lib/platform-navigation-context';

type Values = Record<string, string>;

function availableOptions(group: PlatformFilterGroup, values: Values) {
  return group.options.filter(option => !option.dependsOn || !values[option.dependsOn.group]
    || option.dependsOn.values.includes(values[option.dependsOn.group]));
}

function defaults(groups: readonly PlatformFilterGroup[]) {
  return Object.fromEntries(groups.map(group => [group.id, group.defaultValue]));
}

function FilterGroup({ group, values, onSelect }: { group: PlatformFilterGroup; values: Values; onSelect: (value: string) => void }) {
  const t = useT();
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase();
  const options = availableOptions(group, values).filter(option => !query
    || `${option.label} ${option.value} ${option.searchText ?? ''}`.toLocaleLowerCase().includes(query));
  return <fieldset className="platform-filter-group">
    <legend>{group.label}</legend>
    {group.searchPlaceholder && <div className="platform-filter-search-wrap">
      <Search size={16} aria-hidden="true" />
      <SearchInput value={search} onChange={setSearch} placeholder={group.searchPlaceholder}
        ariaLabel={group.searchPlaceholder} className="platform-filter-search" inputClassName="platform-search-input" />
    </div>}
    <div className={`platform-filter-options${group.presentation === 'chips' ? ' platform-filter-chips' : ''}${group.searchPlaceholder ? ' platform-filter-scroll' : ''}`}>
      {options.map(option => {
        const selected = values[group.id] === option.value;
        return <button type="button" key={option.value} className="platform-filter-option"
          aria-pressed={selected} onClick={() => onSelect(option.value)}>
          {group.presentation !== 'chips' && <span className="platform-filter-radio" aria-hidden="true">{selected && <Check size={12} strokeWidth={2.5} />}</span>}
          <span>{option.label}</span>
          {group.presentation === 'chips' && selected && <Check size={14} aria-hidden="true" />}
        </button>;
      })}
      {!options.length && <p className="platform-filter-empty">{t('没有匹配选项', 'No matching options')}</p>}
    </div>
  </fieldset>;
}

/** Shared masthead filter: local draft until Apply, with page-owned URL state. */
export function PlatformSearchFilter({ filters }: { filters: PlatformSearchFilters }) {
  const t = useT();
  const mobile = useIsMobile(600);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Values>({});
  const [resetVersion, setResetVersion] = useState(0);
  const committed = Object.fromEntries(filters.groups.map(group => [group.id, group.value]));
  const values = { ...committed, ...draft };
  const count = filters.groups.filter(group => group.value !== group.defaultValue).length;
  const close = () => { setOpen(false); setDraft({}); };
  const closeAndFocus = () => { close(); trigger.current?.focus(); };
  usePopoverDismiss(open, close, panel, trigger);
  usePanelClamp(open && !mobile, panel, trigger);
  useEffect(() => { if (open) panel.current?.focus(); }, [open]);

  const choose = (groupId: string, value: string) => {
    const next = { ...values, [groupId]: value };
    for (const group of filters.groups) {
      if (group.options.some(option => option.dependsOn?.group === groupId)
        && !availableOptions(group, next).some(option => option.value === next[group.id])) {
        next[group.id] = group.defaultValue;
      }
    }
    setDraft(next);
  };
  return <div className="platform-filter-control">
    <button ref={trigger} type="button" className="platform-filter-trigger" aria-label={t('筛选', 'Filters') + (count ? ` · ${count}` : '')}
      aria-expanded={open} aria-controls={open ? id : undefined} aria-haspopup="dialog"
      data-active={count > 0 || undefined} onClick={() => { if (open) close(); else { setDraft({}); setOpen(true); } }}>
      <SlidersHorizontal size={18} strokeWidth={1.75} aria-hidden="true" />
      <span className="platform-filter-trigger-label">{t('筛选', 'Filters')}</span>
      {count > 0 && <span className="platform-filter-count" aria-hidden="true">{count}</span>}
    </button>
    {open && <>
      <div className="platform-filter-backdrop" aria-hidden="true" />
      <div ref={panel} id={id} role="dialog" aria-modal={mobile || undefined} aria-label={filters.title} tabIndex={-1} className="platform-filter-panel" data-site-surface="popover"
        onKeyDown={event => {
          if (event.key === 'Enter' && event.target instanceof HTMLInputElement) { event.preventDefault(); return; }
          // The desktop popover and mobile sheet keep keyboard focus inside
          // until dismissed or applied.
          if (event.key !== 'Tab') return;
          const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')];
          const first = controls[0], last = controls.at(-1);
          if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
            event.preventDefault(); last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); first?.focus();
          }
        }}>
        <div className="platform-filter-heading">
          <strong>{filters.title}</strong>
          <button type="button" className="platform-filter-reset" onClick={() => { setDraft(defaults(filters.groups)); setResetVersion(version => version + 1); }}>{t('重置', 'Reset')}</button>
          <button type="button" className="platform-filter-close" aria-label={t('关闭', 'Close')} onClick={closeAndFocus}><X size={18} /></button>
        </div>
        <div className="platform-filter-body">
          {filters.groups.map(group => <FilterGroup key={`${group.id}:${resetVersion}`} group={group} values={values} onSelect={value => choose(group.id, value)} />)}
        </div>
        <div className="platform-filter-footer">
          <button type="button" className="platform-button platform-button-primary" onClick={() => { filters.apply(values); closeAndFocus(); }}>{t('应用筛选', 'Apply filters')}</button>
        </div>
      </div>
    </>}
  </div>;
}
