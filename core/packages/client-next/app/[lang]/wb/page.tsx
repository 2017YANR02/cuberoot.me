'use client';

/**
 * /wb — non-WCA "World Bests" / Unofficial World Records.
 *
 * 1:1 port from packages/client/src/pages/wb/WbPage.tsx (Vite SPA).
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ChevronDown, ChevronRight, ExternalLink, Trophy, Play } from 'lucide-react';
import { useWbData } from './use_wb_data';
import type { WbCategory, WbEvent, WbRecord, WbTab } from './types';
import { displayCuberName } from '@/lib/cuber-name-display';
import { Flag } from '@/components/Flag';
import { ClearButton } from '@/components/ClearButton';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './wb.css';

const SOURCE_URL = 'https://www.speedsolving.com/wiki/index.php?title=List_of_Unofficial_World_Records';

export default function WbPage() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = i18n.language.startsWith('zh') ? 'zh' : 'en';
  useDocumentTitle('非官方纪录', 'World Bests');
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);

  const { data, error } = useWbData();
  const [tabId, setTabId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const activeTab: WbTab | null = useMemo(() => {
    if (!data) return null;
    const id = tabId ?? data.tabs[0]?.id;
    return data.tabs.find((t) => t.id === id) ?? data.tabs[0] ?? null;
  }, [data, tabId]);

  const q = query.trim().toLowerCase();
  const filteredCats: WbCategory[] = useMemo(() => {
    if (!activeTab) return [];
    if (!q) return activeTab.categories;
    return activeTab.categories
      .map((c) => ({
        ...c,
        events: c.events
          .map((e) => ({
            ...e,
            records: e.records.filter((r) => recordMatches(r, e.name, q)),
          }))
          .filter((e) => e.records.length > 0 || matchesText(e.name, q)),
      }))
      .filter((c) => c.events.length > 0);
  }, [activeTab, q]);

  return (
    <div className="wb-page">
      <header className="wb-header">
        <div className="wb-title">
          <Trophy size={20} className="wb-title-icon" />
          <h1>{t('非官方世界纪录', 'Unofficial World Records')}</h1>
          <span className="wb-title-sub">UWR · World Bests</span>
        </div>
        <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="wb-source">
          <ExternalLink size={14} />
          <span>{t('数据源', 'Source')}</span>
        </a>
      </header>

      <div className="wb-toolbar">
        <div className="wb-search">
          <Search size={16} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('搜索:选手 / 项目 / 国家', 'Search cuber / event / country')}
          />
          {query && <ClearButton onClick={() => setQuery('')} isZh={lang === 'zh'} preserveFocus />}
        </div>

        {data && data.tabs.length > 0 && (
          <nav className="wb-tabs" role="tablist">
            {data.tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={t.id === activeTab?.id}
                className={`wb-tab${t.id === activeTab?.id ? ' is-active' : ''}`}
                onClick={() => setTabId(t.id)}
              >
                {t.name[lang]}
                <span className="wb-tab-count">{countEvents(t)}</span>
              </button>
            ))}
          </nav>
        )}
      </div>

      <main className="wb-main">
        {error && <div className="wb-error">{t('加载失败', 'Failed to load')}: {error}</div>}
        {!data && !error && <div className="wb-loading">{t('加载中…', 'Loading…')}</div>}
        {data && filteredCats.length === 0 && (
          <div className="wb-empty">{t('没有匹配项', 'No matches')}</div>
        )}
        {filteredCats.map((cat) => {
          const key = `${activeTab?.id}/${cat.id}`;
          const isCollapsed = !!collapsed[key];
          return (
            <section key={cat.id} className="wb-category">
              <button
                className="wb-cat-header"
                onClick={() => setCollapsed((c) => ({ ...c, [key]: !c[key] }))}
                aria-expanded={!isCollapsed}
              >
                {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                <h2>{cat.name[lang]}</h2>
                <span className="wb-cat-count">{cat.events.length} {t('项', 'events')}</span>
              </button>
              {!isCollapsed && (
                <div className="wb-event-grid">
                  {cat.events.map((e) => (
                    <EventCard key={e.id + '/' + e.name} event={e} lang={lang} q={q} />
                  ))}
                </div>
              )}
            </section>
          );
        })}

        {data && (
          <footer className="wb-footer">
            {t('数据更新于', 'Updated')}: {data.scrapedAt.slice(0, 10)} ·{' '}
            <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer">speedsolving.com wiki</a>
          </footer>
        )}
      </main>
    </div>
  );
}

function EventCard({ event, lang, q }: { event: WbEvent; lang: 'zh' | 'en'; q: string }) {
  const records = q
    ? event.records.filter((r) => recordMatches(r, event.name, q))
    : event.records;
  if (records.length === 0) return null;
  return (
    <article className="wb-event">
      <header className="wb-event-header">
        <h3>{event.name}</h3>
        <span className="wb-event-count">{records.length}</span>
      </header>
      <ul className="wb-record-list">
        {records.map((r, i) => (
          <RecordRow key={i} r={r} lang={lang} />
        ))}
      </ul>
    </article>
  );
}

function RecordRow({ r, lang }: { r: WbRecord; lang: 'zh' | 'en' }) {
  const cuberName = displayCuberName(r.cuber, lang === 'zh');
  return (
    <li className="wb-record">
      <span className="wb-fmt">{r.format || '—'}</span>
      <span className="wb-result">{r.result || '—'}</span>
      <span className="wb-cuber">
        {r.iso2 && <Flag iso2={r.iso2} className="wb-flag" />}
        <span className="wb-cuber-name" title={r.cuber}>{cuberName}</span>
      </span>
      <span className="wb-date">{r.date ?? ''}</span>
      <span className="wb-extra">
        {r.video && (
          <a href={r.video} target="_blank" rel="noopener noreferrer" className="wb-video" title={r.video}>
            <Play size={12} />
          </a>
        )}
      </span>
    </li>
  );
}

function countEvents(t: WbTab): number {
  return t.categories.reduce((s, c) => s + c.events.length, 0);
}

function matchesText(s: string, q: string): boolean {
  return s.toLowerCase().includes(q);
}

function recordMatches(r: WbRecord, eventName: string, q: string): boolean {
  return (
    matchesText(eventName, q) ||
    matchesText(r.cuber, q) ||
    matchesText(r.country, q) ||
    matchesText(r.format, q)
  );
}
