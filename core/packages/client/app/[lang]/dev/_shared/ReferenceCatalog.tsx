'use client';

import { useId, type ReactNode } from 'react';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { ArrowLeft } from '@app-foundation/icons/lucide';
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
}

/** Shared browsing; each reference registry owns its content and filters. */
export default function ReferenceCatalog<E extends ReferenceEntry>({ entries, categories, searchText, children, directoryLabel,
  searchPlaceholder, facets = [], categoryParam = 'category', entryParam = 'entry', sortCategory,
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
  const category = categories.some(cat => cat.id === state.category) ? state.category : '';
  const categoryTotal = category ? entries.filter(entry => entry.category === category).length : entries.length;
  const terms = state.q.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const orderedEntries = category
    ? entries.filter(entry => entry.category === category).sort(sortCategory ?? ((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base', numeric: true })))
    : categories.flatMap(cat => entries.filter(entry => entry.category === cat.id));
  const matches = orderedEntries.filter(entry => {
    const haystack = `${entry.name} ${entry.zh} ${entry.en} ${searchText(entry)}`.toLocaleLowerCase();
    return terms.every(term => haystack.includes(term)) && facets.every(facet => {
      const value = facetValues[facet.key];
      return !facet.options.some(option => option.value === value) || facet.value(entry) === value;
    });
  });
  const size = [20, 50, 100].includes(state.size) ? state.size : 20;
  const totalPages = Math.max(1, Math.ceil(matches.length / size));
  const selectedIndex = matches.findIndex(entry => entry.name === state.entry);
  const page = selectedIndex >= 0 ? Math.floor(selectedIndex / size) + 1 : Math.max(1, Math.min(totalPages, state.page));
  const visible = matches.slice((page - 1) * size, page * size);
  const selected = matches[selectedIndex] ?? visible[0];
  const pagination = matches.length > 0 && <Paginator page={page} totalPages={totalPages} size={size}
    pageSizeOptions={[20, 50, 100]} isZh={false} className="dev-reference-pagination"
    onPageChange={page => void setState({ page, entry: null })} onSizeChange={size => void setState({ size, page: 1, entry: null })} />;

  return <div className="dev-reference dev-reference--workspace" data-detail={selectedIndex >= 0 || undefined}>
    <div className="dev-reference-controls">
      <SearchInput value={state.q} onChange={q => void setState({ q, page: 1, entry: null })}
        placeholder={searchPlaceholder ?? t('搜索名称、用途或导入路径', 'Search names, purposes or import paths')} className="dev-reference-search" />
      <label className="dev-reference-category"><span>{t('分类', 'Category')}</span>
        <select className="dev-reference-select" aria-label={t('分类', 'Category')} value={category} onChange={event => void setState({ category: event.target.value, page: 1, entry: null })}>
          <option value="">{t('全部分类', 'All categories')}</option>
          {categories.map(cat => <option key={cat.id} value={cat.id}>{tr(cat)}</option>)}
        </select>
      </label>
      {facets.map(facet => <label key={facet.key} className="dev-reference-category"><span>{facet.label}</span>
        <select className="dev-reference-select" aria-label={facet.label} value={facet.options.some(option => option.value === facetValues[facet.key]) ? facetValues[facet.key] : ''}
          onChange={event => {
            void setFacetValues({ [facet.key]: event.target.value || null });
            void setState({ page: 1, entry: null });
          }}>
          <option value="">{t('全部', 'All')}</option>
          {facet.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>)}
      <span className="dev-reference-total">{t(`共 ${categoryTotal} 项`, `${categoryTotal} entries`)}</span>
    </div>
    {visible.length === 0 && <p className="dev-reference-empty" role="status">
      {t('没有匹配项。', 'No matches.')}
      <button className="dev-reference-clear" type="button" onClick={() => {
        void setState({ q: null, category: null, page: null, entry: null });
        void setFacetValues(null);
      }}>{t('清除筛选', 'Clear filters')}</button>
    </p>}
    {selected && <div className="dev-reference-workspace">
      <div className="dev-reference-sidebar">
        <nav className="dev-reference-directory" aria-label={directoryLabel}>
          {visible.map(entry => <button className="dev-reference-entry" key={entry.name} type="button" aria-current={entry.name === selected.name ? 'true' : undefined}
            aria-controls={`${prefix}-detail`} onClick={() => void setState({ entry: entry.name, page })}>
            <strong className="dev-reference-name">{entry.name}</strong><span>{tr(entry)}</span>
          </button>)}
        </nav>
        {pagination}
      </div>
      <section key={selected.name} id={`${prefix}-detail`} className="dev-reference-selected" aria-labelledby={`${prefix}-title`} tabIndex={0}>
        <header className="dev-reference-selected-heading" data-site-surface="heading">
          <button type="button" className="dev-reference-back" onClick={() => void setState({ entry: null, page })}><ArrowLeft size={18} aria-hidden />{directoryLabel}</button>
          <h2 id={`${prefix}-title`} className="dev-reference-name">{selected.name}</h2>
        </header>
        <div className="dev-reference-detail"><p className="dev-reference-purpose">{tr(selected)}</p>{children(selected)}</div>
      </section>
    </div>}
  </div>;
}
