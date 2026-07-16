'use client';

/**
 * /icon — 魔方图标库 / Cube icon gallery.
 *
 * Browsable view of every cube icon the site ships, straight from the shared
 * SVG_BY_KEY source (see _catalog.ts). Mirrors https://icons.cubing.net but is
 * display-first: monochrome (currentColor, theme-adaptive), each cell a real
 * download link so left-click OR right-click → "Save link as" saves the
 * original SVG.
 */

import { useMemo } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { Search, ExternalLink } from 'lucide-react';
import BackHome from '@/components/BackHome';
import { SearchInput } from '@/components/SearchInput';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useLang, tr } from '@/i18n/tr';
import { eventDisplayName } from '@/lib/wca-events';
import {
  ICON_GROUPS, CATEGORY_LABEL, svgHref,
  type IconEntry, type IconCategory,
} from './_catalog';
import './icon.css';

function friendlyName(entry: IconEntry, isZh: boolean): string {
  if (entry.category === 'event') return eventDisplayName(entry.slug, isZh);
  return entry.slug.replace(/_/g, ' ');
}

function IconCell({ entry, isZh }: { entry: IconEntry; isZh: boolean }) {
  const name = friendlyName(entry, isZh);

  return (
    <a
      className="icon-cell"
      href={svgHref(entry.svg)}
      download={`${entry.slug}.svg`}
      aria-label={tr({ zh: `下载 ${name} 图标 SVG`, en: `Download ${name} icon SVG` })}
      title={tr({ zh: '点击 / 右键 保存 SVG', en: 'Click / right-click to save SVG' })}
    >
      <span className="icon-cell-glyph" aria-hidden="true" dangerouslySetInnerHTML={{ __html: entry.svg }} />
      <span className="icon-cell-name">{name}</span>
    </a>
  );
}

export default function IconGalleryPage() {
  const lang = useLang();
  const isZh = lang === 'zh';
  useDocumentTitle('图标', 'Icons');

  const [query, setQuery] = useQueryState('q', parseAsString.withDefault(''));

  const q = query.trim().toLowerCase();
  const groups = useMemo(() => {
    if (!q) return ICON_GROUPS;
    return ICON_GROUPS
      .map((g) => ({
        ...g,
        entries: g.entries.filter(
          (e) =>
            e.key.toLowerCase().includes(q) ||
            e.slug.toLowerCase().includes(q) ||
            friendlyName(e, isZh).toLowerCase().includes(q) ||
            friendlyName(e, !isZh).toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.entries.length > 0);
  }, [q, isZh]);

  const shown = groups.reduce((n, g) => n + g.entries.length, 0);

  return (
    <div className="icon-page">
      <BackHome />

      <header className="icon-header">
        <h1>{tr({ zh: '魔方图标库', en: 'Cube Icons' })}</h1>
        <a className="icon-credit" href="https://github.com/cubing/icons" target="_blank" rel="noopener noreferrer">
          <ExternalLink size={13} aria-hidden="true" />
          <span>cubing/icons</span>
        </a>
      </header>

      <div className="icon-toolbar">
        <div className="icon-search">
          <Search size={16} aria-hidden="true" />
          <SearchInput
            value={query}
            onChange={(v) => setQuery(v || null)}
            placeholder={tr({ zh: '搜索项目 / 类名', en: 'Search event / class' })}
            ariaLabel={tr({ zh: '搜索图标', en: 'Search icons' })}
            className="icon-search-field"
            inputClassName="icon-search-input"
          />
        </div>
        {q && (
          <span className="icon-count">
            {tr({ zh: `${shown} 个结果`, en: `${shown} result${shown === 1 ? '' : 's'}` })}
          </span>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="icon-empty">{tr({ zh: '没有匹配的图标', en: 'No matching icons' })}</div>
      ) : (
        groups.map((g) => (
          <section key={g.category} className="icon-section">
            <h2 className="icon-section-title">
              {tr(CATEGORY_LABEL[g.category as IconCategory])}
              <span className="icon-section-count">{g.entries.length}</span>
            </h2>
            <div className="icon-grid">
              {g.entries.map((e) => (
                <IconCell key={e.key} entry={e} isZh={isZh} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
