'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, Search } from '@app-foundation/icons/lucide';
import type { CalendarMeta } from '@cuberoot/shared/calendar';
import { SearchInput } from '@/components/SearchInput';
import { DateRangeInput } from '@/components/DateRangeInput';
import { ListSelect } from '@/components/ListSelect';
import { useModalBackdrop } from '@/hooks/useModalDismiss';
import { tr } from '@/i18n/tr';
import { EMPTY_SEARCH_FILTERS, type SearchFilters } from '../_lib/search';

interface Props {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  query: string;
  onQuery: (query: string) => void;
  filters: SearchFilters;
  onApply: (query: string, filters: SearchFilters) => void;
  calendars: CalendarMeta[];
  defaultFrom: string;
  defaultTo: string;
}

export default function CalendarSearch(props: Props) {
  const [advanced, setAdvanced] = useState(false);
  const [draft, setDraft] = useState(EMPTY_SEARCH_FILTERS);
  const [keywords, setKeywords] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const optionsButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const closeOptions = () => { setAdvanced(false); optionsButton.current?.focus(); };
  const backdrop = useModalBackdrop(closeOptions);
  useEffect(() => {
    if (!props.open && wasOpen.current) trigger.current?.focus();
    wasOpen.current = props.open;
  }, [props.open]);
  const openOptions = () => {
    setDraft({ ...props.filters, from: props.filters.from || props.defaultFrom, to: props.filters.to || props.defaultTo });
    setKeywords(props.query);
    setAdvanced(true);
  };
  const field = (key: 'participant' | 'location' | 'exclude', label: string, placeholder: string) => <div className="cal-search-option">
    <span>{label}</span>
    <SearchInput className="cal-search-option-input" ariaLabel={label} value={draft[key]} placeholder={placeholder} onChange={value => setDraft({ ...draft, [key]: value })} />
  </div>;

  // allow-manual-search: Opens the live search input; does not submit a query.
  if (!props.open) return <button ref={trigger} type="button" className="cal-icon-btn cal-search-trigger" aria-label={tr({ zh: '搜索日程', en: 'Search events' })} onClick={props.onOpen}><Search size={22} aria-hidden /></button>;
  return <div className="cal-search-expanded" onKeyDown={e => {
    if (!e.defaultPrevented && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (advanced) closeOptions(); else props.onClose(); }
  }}>
    {/* allow-manual-search: Closes the live search interface without submitting. */}
    <button type="button" className="cal-icon-btn" aria-label={tr({ zh: '关闭搜索', en: 'Close search' })} onClick={() => { setAdvanced(false); props.onClose(); }}><ChevronLeft size={22} aria-hidden /></button>
    <div className={`cal-search-box${advanced ? ' is-expanded' : ''}`}>
      <div className="cal-search-bar">
        <Search size={22} aria-hidden />
        <SearchInput autoFocus className="cal-search-live" inputClassName="cal-search-field" type="search" value={props.query} debounceMs={300} placeholder={tr({ zh: '搜索', en: 'Search' })} ariaLabel={tr({ zh: '搜索日程', en: 'Search events' })} onChange={value => { props.onQuery(value); if (advanced) setKeywords(value); }} />
        {/* allow-manual-search: Toggles advanced options; the main input searches live. */}
        <button ref={optionsButton} type="button" className="cal-icon-btn" aria-label={tr({ zh: '搜索选项', en: 'Search options' })} aria-expanded={advanced} aria-controls="cal-search-options" onClick={() => advanced ? closeOptions() : openOptions()}><ChevronDown size={20} aria-hidden /></button>
      </div>
      {advanced && <>
        <div className="cal-search-backdrop" {...backdrop} />
        {/* allow-manual-search: Commit a draft of combined advanced filters; the main search remains live. */}
        <form id="cal-search-options" className="cal-search-options" data-site-surface="popover" aria-label={tr({ zh: '搜索选项', en: 'Search options' })} onSubmit={e => { e.preventDefault(); props.onApply(keywords, draft); closeOptions(); }}>
          <div className="cal-search-option"><span>{tr({ zh: '搜索范围', en: 'Search in' })}</span><ListSelect portal ariaLabel={tr({ zh: '搜索范围', en: 'Search in' })} value={draft.calendar} onChange={calendar => setDraft({ ...draft, calendar })} clearable={false} allLabel="" items={[
            { value: 'enabled', label: tr({ zh: '启用的日历', en: 'Enabled calendars' }) },
            { value: 'all', label: tr({ zh: '全部日历', en: 'All calendars' }) },
            ...props.calendars.map(c => ({ value: String(c.id), label: c.name })),
          ]} /></div>
          <div className="cal-search-option"><span>{tr({ zh: '搜索内容', en: 'Contains' })}</span><SearchInput className="cal-search-option-input" ariaLabel={tr({ zh: '搜索内容', en: 'Contains' })} value={keywords} placeholder={tr({ zh: '活动中包含关键字', en: 'Words in the event' })} onChange={setKeywords} /></div>
          {field('participant', tr({ zh: '参与者', en: 'Participant' }), tr({ zh: '输入参与者姓名或 WCA ID', en: 'Participant name or WCA ID' }))}
          {field('location', tr({ zh: '地点', en: 'Location' }), tr({ zh: '输入地点或会议室', en: 'Place or meeting room' }))}
          {field('exclude', tr({ zh: '不包含', en: 'Does not contain' }), tr({ zh: '活动中不包含关键字', en: 'Words to exclude' }))}
          <div className="cal-search-option"><span>{tr({ zh: '日期', en: 'Dates' })}</span><DateRangeInput from={draft.from} to={draft.to} clearable={false} onChange={(from, to) => setDraft({ ...draft, from, to })} /></div>
          <div className="cal-search-option-actions">
            <button type="button" className="cal-link-btn" onClick={() => { setDraft({ ...EMPTY_SEARCH_FILTERS, from: props.defaultFrom, to: props.defaultTo }); setKeywords(''); }}>{tr({ zh: '重置', en: 'Reset' })}</button>
            {/* allow-manual-search: Apply combined advanced filters; main keyword search is live. */}
            <button type="submit" className="cal-link-btn">{tr({ zh: '搜索', en: 'Search' })}</button>
          </div>
        </form>
      </>}
    </div>
  </div>;
}
