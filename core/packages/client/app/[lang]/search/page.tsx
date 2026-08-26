'use client';

import { parseAsString, useQueryState } from 'nuqs';
import { isAdminWcaId } from '@cuberoot/shared/admin';
import BackHome from '@/components/BackHome';
import LandingSearch from '@/components/LandingSearch';
import { tr, useLang } from '@/i18n/tr';
import { useAuthUser } from '@/lib/auth-store';
import { SEARCH_CARDS, isLandingSearchCardVisible } from '@/lib/landing-sections';
import './search.css';

export default function SearchPage() {
  const lang = useLang() === 'en' ? 'en' : 'zh';
  const user = useAuthUser();
  const [query, setQuery] = useQueryState('q', parseAsString.withDefault(''));
  const cards = SEARCH_CARDS.filter((card) => (
    isLandingSearchCardVisible(card, isAdminWcaId(user?.wcaId))
  ));

  return (
    <main className="site-search-page">
      <div className="site-search-back-row"><BackHome /></div>
      <header className="site-search-header">
        <h1>{tr({ zh: '全站搜索', en: 'Site search' })}</h1>
        <p>{tr({
          zh: '搜索页面、工具、比赛、选手、统计、复盘、术语和公式库。',
          en: 'Search pages, tools, competitions, persons, statistics, reconstructions, glossary entries, and algorithm sets.',
        })}</p>
      </header>
      <LandingSearch
        cards={cards}
        lang={lang}
        query={query}
        onQueryChange={(value) => { void setQuery(value || null); }}
        persistentResults
        autoFocus
      />
    </main>
  );
}
