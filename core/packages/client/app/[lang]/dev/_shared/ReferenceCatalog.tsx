'use client';

import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { ArrowLeft, BookOpen, ChevronRight } from '@app-foundation/icons/lucide';
import { ResizeDivider } from '@app-foundation/navigation-ui/resize-divider';
import '@app-foundation/navigation-ui/resize-divider.css';
import { SearchInput } from '@/components/SearchInput';
import Paginator from '@/components/wca-stats/Paginator';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';
import './reference-catalog.css';

interface ReferenceEntry { name: string; category: string; zh: string; en: string }
interface Category { id: string; zh: string; en: string }
interface Facet<E> {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  value: (entry: E) => string;
  defaultValue?: string;
}

interface Topics<E> {
  sections: { zh: string; en: string; categories: readonly string[] }[];
  overviewLabel: string;
  overview: (open: (entry: E) => void) => ReactNode;
}

const OVERVIEW = 'overview';
const ALL = 'all';

/** Shared browsing; each reference registry owns its content and filters. */
export default function ReferenceCatalog<E extends ReferenceEntry>({ entries, categories, searchText, children, directoryLabel,
  searchPlaceholder, facets = [], categoryParam = 'category', entryParam = 'entry', sortCategory, topics,
}: {
  entries: E[];
  categories: Category[];
  searchText: (entry: E) => string;
  children: (entry: E) => ReactNode;
  directoryLabel: string;
  searchPlaceholder?: string;
  facets?: Facet<E>[];
  categoryParam?: string;
  entryParam?: string;
  sortCategory?: (a: E, b: E) => number;
  topics?: Topics<E>;
}) {
  const t = useT();
  const prefix = useId();
  const [state, setState] = useQueryStates({
    q: parseAsString.withDefault(''), category: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1), size: parseAsInteger.withDefault(20),
    entry: parseAsString.withDefault(''),
  }, { urlKeys: { category: categoryParam, entry: entryParam } });
  const [facetValues, setFacetValues] = useQueryStates(Object.fromEntries(
    facets.map(facet => [facet.key, parseAsString.withDefault('')]),
  ));
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const overviewButton = useRef<HTMLButtonElement>(null);
  const directory = useRef<HTMLElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const sidebar = useRef<HTMLDivElement>(null);
  const focusNext = useRef<'detail' | 'directory' | null>(null);
  const linkedEntry = state.entry && entries.find(entry => entry.name === state.entry);
  const activeFacets = Object.fromEntries(facets.map(facet => {
    const value = facetValues[facet.key];
    if (facet.options.some(option => option.value === value) || (facet.defaultValue && value === ALL)) return [facet.key, value];
    // Preserve links to restricted endpoints generated before the public filter became the default.
    const fallback = linkedEntry && facet.defaultValue && facet.value(linkedEntry) !== facet.defaultValue ? ALL : facet.defaultValue;
    return [facet.key, fallback ?? ''];
  }));
  const category = categories.some(cat => cat.id === state.category) ? state.category
    : topics && !state.q.trim() && linkedEntry ? linkedEntry.category : '';
  const categoryTotal = category ? entries.filter(entry => entry.category === category).length : entries.length;
  const terms = state.q.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matchesByCategory = new Map(categories.map(cat => [cat.id, [] as E[]]));
  for (const entry of entries) {
    if (!topics && category && entry.category !== category) continue;
    const haystack = `${entry.name} ${entry.zh} ${entry.en} ${searchText(entry)}`.toLocaleLowerCase();
    if (terms.every(term => haystack.includes(term)) && facets.every(facet => {
      const value = activeFacets[facet.key];
      return !value || value === ALL || facet.value(entry) === value;
    })) matchesByCategory.get(entry.category)?.push(entry);
  }
  const matches = category
    ? (matchesByCategory.get(category) ?? []).sort(sortCategory ?? ((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base', numeric: true })))
    : [...matchesByCategory.values()].flat();
  const size = [20, 50, 100].includes(state.size) ? state.size : 20;
  const totalPages = Math.max(1, Math.ceil(matches.length / size));
  const selectedIndex = matches.findIndex(entry => entry.name === state.entry);
  const page = selectedIndex >= 0 ? Math.floor(selectedIndex / size) + 1 : Math.max(1, Math.min(totalPages, state.page));
  const visible = matches.slice((page - 1) * size, page * size);
  const selected = matches[selectedIndex] ?? (!topics || terms.length ? visible[0] : undefined);
  const showOverview = !!topics && state.entry === OVERVIEW;
  const hasDetail = selectedIndex >= 0 || showOverview;
  useEffect(() => {
    if (focusNext.current === 'detail') detailHeading.current?.focus();
    if (focusNext.current === 'directory') {
      const target = directory.current?.querySelector<HTMLElement>('[aria-expanded="true"], .dev-reference-entry[aria-current]') ?? overviewButton.current;
      target?.focus();
    }
    focusNext.current = null;
  }, [state.entry]);
  function navigate(update: Parameters<typeof setState>[0]) {
    const implicitAll = facets.filter(facet => facet.defaultValue && !facetValues[facet.key] && activeFacets[facet.key] === ALL);
    if (implicitAll.length) void setFacetValues(Object.fromEntries(implicitAll.map(facet => [facet.key, ALL])));
    void setState(update);
  }
  const pagination = (topics ? totalPages > 1 : matches.length > 0) && <Paginator page={page} totalPages={totalPages} size={size}
    pageSizeOptions={[20, 50, 100]} isZh={false} className="dev-reference-pagination"
    onPageChange={page => navigate({ page, entry: null, category })} onSizeChange={size => navigate({ size, page: 1, entry: null, category })} />;

  function openEntry(entry: E) {
    if (topics && state.entry !== entry.name) focusNext.current = 'detail';
    navigate({ entry: entry.name, page, category });
  }
  function openOverview() {
    if (!showOverview) focusNext.current = 'detail';
    navigate({ entry: OVERVIEW, category: null, q: null, page: 1 });
  }
  function backToDirectory() {
    if (topics) focusNext.current = 'directory';
    navigate({ entry: null, category, page });
  }
  const renderEntry = (entry: E) => <button className="dev-reference-entry" key={entry.name} type="button"
    aria-current={entry.name === selected?.name ? 'true' : undefined} aria-controls={`${prefix}-detail`}
    onClick={() => openEntry(entry)}>
    {topics ? <><strong>{tr(entry)}</strong><code className="dev-reference-name">{entry.name}</code></>
      : <><strong className="dev-reference-name">{entry.name}</strong><span>{tr(entry)}</span></>}
  </button>;
  const renderDetail = (key: string, label: string, content: ReactNode, ref?: RefObject<HTMLHeadingElement | null>) =>
    <section key={key} id={`${prefix}-detail`} className="dev-reference-selected" aria-labelledby={`${prefix}-title`} tabIndex={0}>
      <header className="dev-reference-selected-heading" data-site-surface={topics ? undefined : 'heading'}>
        <button type="button" className="dev-reference-back" onClick={backToDirectory}><ArrowLeft size={18} aria-hidden />{directoryLabel}</button>
        <h2 id={`${prefix}-title`} className={topics ? undefined : 'dev-reference-name'} ref={ref} tabIndex={topics ? -1 : undefined}>{label}</h2>
      </header>
      <div className="dev-reference-detail">{content}</div>
    </section>;
  const empty = <p className="dev-reference-empty" role="status">
    {t('没有匹配项。', 'No matches.')}
    <button className="dev-reference-clear" type="button" onClick={() => {
      void setState({ q: null, category: null, page: null, entry: null });
      void setFacetValues(null);
    }}>{t('清除筛选', 'Clear filters')}</button>
  </p>;

  return <div className="dev-reference dev-reference--workspace" data-topics={!!topics || undefined} data-detail={hasDetail || undefined}>
    <div className="dev-reference-controls">
      <SearchInput value={state.q} onChange={q => navigate({ q, page: 1, entry: null, ...(topics && { category: null }) })}
        placeholder={searchPlaceholder ?? t('搜索名称、用途或导入路径', 'Search names, purposes or import paths')} className="dev-reference-search" />
      {!topics && <label className="dev-reference-category"><span>{t('分类', 'Category')}</span>
        <select className="dev-reference-select" aria-label={t('分类', 'Category')} value={category} onChange={event => void setState({ category: event.target.value, page: 1, entry: null })}>
          <option value="">{t('全部分类', 'All categories')}</option>
          {categories.map(cat => <option key={cat.id} value={cat.id}>{tr(cat)}</option>)}
        </select>
      </label>}
      {facets.map(facet => <label key={facet.key} className="dev-reference-category"><span>{facet.label}</span>
        <select className="dev-reference-select" aria-label={facet.label} value={activeFacets[facet.key]}
          onChange={event => {
            const value = event.target.value;
            void setFacetValues({ [facet.key]: value === (facet.defaultValue ?? '') ? null : value });
            void setState({ page: 1, entry: null, category });
          }}>
          {!facet.defaultValue && <option value="">{t('全部', 'All')}</option>}
          {facet.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          {facet.defaultValue && <option value={ALL}>{t('全部', 'All')}</option>}
        </select>
      </label>)}
      {!topics && <span className="dev-reference-total">{t(`共 ${categoryTotal} 项`, `${categoryTotal} entries`)}</span>}
    </div>
    {!topics && visible.length === 0 && empty}
    {(topics || selected) && <div className="dev-reference-workspace" ref={workspace}>
      <div className="dev-reference-sidebar" id={`${prefix}-sidebar`} ref={sidebar}>
        <nav className="dev-reference-directory" aria-label={directoryLabel} ref={directory}>
          {topics && <button type="button" className="dev-reference-topic dev-reference-overview" ref={overviewButton}
            aria-current={!selected && !category && !terms.length ? 'true' : undefined} onClick={openOverview}>
            <BookOpen size={17} aria-hidden />{topics.overviewLabel}
          </button>}
          {topics && terms.length === 0 ? topics.sections.map(section => {
            const available = section.categories.filter(id => (matchesByCategory.get(id)?.length ?? 0) > 0);
            if (!available.length) return null;
            return <div className="dev-reference-topic-section" key={section.en}>
              <h2>{tr(section)}</h2>
              {available.map(id => {
                const topic = categories.find(item => item.id === id)!;
                const expanded = id === category;
                return <div key={id}>
                  <button className="dev-reference-topic" type="button" aria-expanded={expanded} aria-controls={`${prefix}-${id}`}
                    onClick={() => navigate({ category: expanded ? null : id, page: 1, entry: null })}>
                    <ChevronRight size={16} aria-hidden />
                    <strong>{tr(topic)}</strong><small>{matchesByCategory.get(id)?.length}</small>
                  </button>
                  <div className="dev-reference-topic-entries" id={`${prefix}-${id}`} hidden={!expanded}>
                    {expanded && <>{visible.map(renderEntry)}{pagination}</>}
                  </div>
                </div>;
              })}
            </div>;
          }) : <>
            {topics && <h2 className="dev-reference-search-count" aria-live="polite">{t(`${matches.length} 条搜索结果`, `${matches.length} search results`)}</h2>}
            {visible.map(renderEntry)}
          </>}
          {topics && !visible.length && empty}
        </nav>
        {(!topics || terms.length > 0) && pagination}
      </div>
      {topics && <ResizeDivider
        className="dev-reference-divider"
        label={t('调整侧栏宽度', 'Resize sidebar')}
        aria-controls={`${prefix}-sidebar`}
        getSize={() => sidebar.current?.getBoundingClientRect().width ?? 0}
        onResize={(_, requested) => {
          if (!workspace.current || !sidebar.current) return;
          const width = Math.round(requested);
          const style = workspace.current.style;
          style.setProperty('--dev-reference-sidebar-width', `${width}px`);
          const applied = Math.round(sidebar.current.getBoundingClientRect().width);
          if (applied !== width) style.setProperty('--dev-reference-sidebar-width', `${applied}px`);
          return applied;
        }}
      />}
      {selected ? renderDetail(selected.name,
        topics ? tr(selected) : selected.name,
        <>{topics
          ? <p className="dev-reference-purpose"><code className="dev-reference-name">{selected.name}</code></p>
          : <p className="dev-reference-purpose">{tr(selected)}</p>}{children(selected)}</>,
        topics ? detailHeading : undefined,
      ) : topics && renderDetail(OVERVIEW, topics.overviewLabel, topics.overview(entry => {
        void setFacetValues(null);
        if (state.entry !== entry.name) focusNext.current = 'detail';
        void setState({ entry: entry.name, category: entry.category, q: null, page: 1 });
      }), detailHeading)}
    </div>}
  </div>;
}
