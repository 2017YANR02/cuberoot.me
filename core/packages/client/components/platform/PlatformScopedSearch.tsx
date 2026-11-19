'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from '@app-foundation/icons/lucide';
import { SearchInput } from '@/components/SearchInput';
import { useT } from '@/hooks/useT';
import { useEntryRouter } from '@/hooks/useEntryRouter';
import type { PlatformSearchBinding, PlatformSearchScope } from '@/lib/platform-navigation-context';
import { PlatformSearchFilter } from './PlatformSearchFilter';
import '../landing_search.css';

/** Match the masthead search's visual shell without loading the Agent or site search. */
export function PlatformScopedSearch({ lang, scope, binding }: { lang: 'zh' | 'en'; scope: PlatformSearchScope; binding: PlatformSearchBinding | null }) {
  const t = useT();
  const router = useEntryRouter();
  const minimumLength = scope === 'forum' ? 2 : 1;
  const resultPath = scope === 'forum' ? '/platform/community/search' : `/platform/${scope}`;
  const submitBoundQuery = binding?.submit;
  const committedQuery = submitBoundQuery ? binding?.query : undefined;
  const [draft, setDraft] = useState(committedQuery ?? '');
  const wasBound = useRef(false);
  useEffect(() => {
    if (committedQuery !== undefined) {
      wasBound.current = true;
      setDraft(committedQuery);
    } else if (wasBound.current) {
      wasBound.current = false;
      setDraft('');
    }
  }, [committedQuery]);

  const submit = (value: string) => {
    const query = value.trim();
    setDraft(value);
    if (submitBoundQuery) { submitBoundQuery(query); return; }
    if (query.length < minimumLength) return;
    router.push(`${lang === 'zh' ? '/zh' : ''}${resultPath}?${new URLSearchParams({ q: query })}`, { scroll: false });
  };
  const placeholder = scope === 'forum' ? t('搜索标题和帖子内容', 'Search titles and post content')
    : scope === 'paths' ? t('搜索学习路径', 'Search learning paths')
    : scope === 'events' ? t('搜索活动', 'Search events')
    : scope === 'news' ? t('搜索资讯', 'Search news')
    : t('搜索课程、讲师或学习内容', 'Search courses, instructors or topics');
  return <div className="landing-search">
    <div className="landing-search-controls">
      <form className="landing-search-input platform-scoped-search" data-search-scope={scope} role="search" aria-label={placeholder}
        onSubmit={event => { event.preventDefault(); submit(String(new FormData(event.currentTarget).get('q') ?? '')); }}>
        <span className="landing-search-plus platform-scoped-search-icon" aria-hidden="true"><Search size={18} strokeWidth={1.75} /></span>
        <SearchInput value={draft} name="q" className="platform-scoped-search-field" inputClassName="landing-search-field"
          placeholder={placeholder} ariaLabel={placeholder} debounceMs={submitBoundQuery && scope !== 'courses' ? 300 : 0}
          onChange={value => { setDraft(value); submitBoundQuery?.(value); }}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); submit(event.currentTarget.value); } }} />
        {binding?.filters && <PlatformSearchFilter key={binding.routeId} filters={binding.filters} />}
        <button type="submit" className="landing-search-mic landing-search-send landing-search-auth-send"
          disabled={!submitBoundQuery && draft.trim().length < minimumLength}>{t('搜索', 'Search')}</button>
      </form>
    </div>
  </div>;
}
