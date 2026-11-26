import { useEffect, useMemo, useState, type Ref } from 'react';
import { Search } from 'lucide-react';
import { ClearButton } from '@cuberoot/timer-ui/clear-button';
import {
  SITE_DIRECTORY_GROUPS, SITE_DIRECTORY_SEARCH_CARDS, SITE_DIRECTORY_TEXTS,
  applyHomeSectionOrder, parseHomeLocks, parseHomeOrders, searchSiteCards,
  type HomeLayoutSnapshot, type SiteDirectoryEntry,
} from '@cuberoot/shared/site-directory';
import { COPY, type SupportedLanguage } from '../copy';
import './tools-home.css';

const API = 'https://api.cuberoot.me/v1/nav';
const CACHE_KEY = 'cuberoot.tools.home-layout.v1';

function readCachedLayout(): HomeLayoutSnapshot | null {
  try {
    const snapshot = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    return { locks: parseHomeLocks(snapshot), orders: parseHomeOrders(snapshot) };
  } catch {
    return null;
  }
}

async function readLayout(signal: AbortSignal): Promise<HomeLayoutSnapshot> {
  const read = async (path: string) => {
    const response = await fetch(API + path, { signal, cache: 'no-cache' });
    if (!response.ok) throw new Error('Could not load the tool directory');
    return response.json() as Promise<unknown>;
  };
  const [locks, orders] = await Promise.all([
    read('/home-locks').then(parseHomeLocks),
    read('/home-order').then(parseHomeOrders),
  ]);
  return { locks, orders };
}

interface ToolsHomeProps {
  language: SupportedLanguage;
  online: boolean;
  checking: boolean;
  refreshKey: number;
  active: boolean;
  hidden: boolean;
  searchVisible: boolean;
  searchInput: Ref<HTMLInputElement>;
  isAdmin: boolean;
  canOpen: (href: string) => boolean;
  onOpen: (href: string, internal: boolean) => void;
  bottomInset: number;
  rightInset: number;
}

export function ToolsHome({
  language, online, checking, refreshKey, active, hidden, searchVisible, searchInput, isAdmin, canOpen, onOpen, bottomInset, rightInset,
}: ToolsHomeProps) {
  const copy = COPY[language];
  const [layout, setLayout] = useState(readCachedLayout);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState('');
  const term = searchVisible ? query.trim() : '';

  useEffect(() => {
    if (!active || !online) return;
    const controller = new AbortController();
    setFailed(false);
    const timeout = window.setTimeout(() => {
      controller.abort();
      setFailed(true);
    }, 8000);
    void readLayout(controller.signal).then(next => {
      if (controller.signal.aborted) return;
      setLayout(next);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch { /* Keep this session's layout. */ }
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    }).finally(() => window.clearTimeout(timeout));
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [active, online, refresh, refreshKey]);

  const visibleGroups = useMemo(() => {
    if (!layout) return [];
    return SITE_DIRECTORY_GROUPS.map(group => {
      const entries = applyHomeSectionOrder<SiteDirectoryEntry>(group.id, group.entries, layout.orders[group.id] ?? []);
      if (group.id === 'other') entries.sort((a, b) => Number(b.id === 'forum') - Number(a.id === 'forum'));
      return {
        id: group.id,
        label: group.eyebrow[language],
        entries: entries.filter(entry => canOpen(entry.href) && (isAdmin || !(
          ('adminOnly' in entry && entry.adminOnly)
          || (layout.locks[entry.id] ?? ('lockedForNonAdmin' in entry && entry.lockedForNonAdmin))
        ))),
      };
    });
  }, [canOpen, isAdmin, language, layout]);

  const matchingIds = useMemo(() => new Set(
    searchSiteCards(SITE_DIRECTORY_SEARCH_CARDS, term).map(card => card.id),
  ), [term]);
  const groups = term ? visibleGroups.map(group => ({
    ...group,
    entries: group.entries.filter(entry => matchingIds.has(entry.id)),
  })) : visibleGroups;
  const hasResults = groups.some(group => group.entries.length > 0);
  const openSiteSearch = () => onOpen(term ? '/search?' + new URLSearchParams({ q: term }) : '/search', true);

  return (
    <section className="installed-tools-home" aria-label={copy.tools} hidden={hidden} data-no-timer
      style={{ paddingBottom: bottomInset + 24, paddingRight: rightInset }}>
      <h1>{copy.tools}</h1>
      <form hidden={!searchVisible} role="search" onSubmit={event => {
        event.preventDefault();
        if (online) openSiteSearch();
      }}>
        <div className="installed-tools-search">
          <Search size={18} aria-hidden="true" />
          <input type="search" aria-label={copy.searchTools} placeholder={copy.searchTools}
            ref={searchInput} value={query} onChange={event => setQuery(event.target.value)} />
          {query && <ClearButton variant="standalone" ariaLabel={copy.clearSearch} preserveFocus onClick={() => setQuery('')} />}
        </div>
        <button type="submit" className="secondary-action installed-tools-site-search" disabled={!online}>{copy.siteSearch}</button>
      </form>
      {!layout && (
        <div className="installed-tools-status">
          <p role="status">{!online && !checking ? copy.offline : failed ? copy.actionFailed : copy.loadingTools}</p>
          {online && failed && <button type="button" className="secondary-action" onClick={() => setRefresh(value => value + 1)}>{copy.retry}</button>}
        </div>
      )}
      {layout && !online && !checking && <p className="installed-tools-status" role="status">{copy.offline}</p>}
      {layout && term && !hasResults && <p className="installed-tools-status" role="status">{copy.noToolsFound}</p>}
      {groups.map(group => group.entries.length > 0 && (
        <section key={group.id} aria-label={group.label}>
          <h2>{group.label}</h2>
          <ul>
            {group.entries.map(entry => (
              <li key={entry.id}>
                <button type="button" onClick={() => onOpen(entry.href, entry.internal)}>{SITE_DIRECTORY_TEXTS[entry.nameKey][language]}</button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
