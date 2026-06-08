'use client';

/**
 * Landing-page site search — full port of packages/client/src/components/LandingSearch.tsx.
 *
 * Data layer lives in lib/site-search.ts (cards/tools/lookups/stats/persons/comps/
 * recons/glossary/about/stack/algSets — 11 categories total). This component is
 * the dropdown UI shell.
 *
 * Next.js adaptations (vs Vite):
 *  - next/link Link href + useRouter().push instead of react-router
 *  - [lang] path prefix `/${lang}/...` in hrefs instead of ?lang= query
 *  - EventIcon lazy-loaded via next/dynamic (was React.lazy in Vite)
 *  - useSpeechToText / smart_paste removed for now (nice-to-have, defer)
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Plus, Trophy, BarChart3, Medal, UserRound, Tent, Globe2, Pin,
  CalendarDays, LayoutGrid, Wrench, ArrowRight, Search, Clipboard,
  ScanSearch, BookA, BookOpen, Library, Code as CodeIcon, Mic, Sparkles, type LucideIcon,
} from 'lucide-react';
import { ClearButton } from '@/components/ClearButton';
import { Flag } from '@/components/Flag';
import { RecordBadge } from '@/components/RecordBadge/RecordBadge';
import { displayCuberName } from '@/lib/cuber-name-display';
import { localizeCompName } from '@/lib/comp-localize';
import { compLinkProps } from '@/lib/comp-link';
import { localizeCity } from '@/lib/city-localize';
import { formatDateRangeIso } from '@/lib/wca-date';
import {
  useSiteSearch,
  METRIC_LABEL_OVERRIDE,
  INITIAL_RENDER_CAP,
  type SiteSearchCard,
} from '@/lib/site-search';
import { detectPasteIntent, type PasteIntent } from '@/lib/smart-paste';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import './landing_search.css';

// EventIcon inlines all WCA event SVGs (~68KB gzip);only used in recon hits.
const EventIcon = dynamic(
  () => import('@/components/EventIcon/EventIcon').then(m => ({ default: m.EventIcon })),
  { ssr: false },
);

const ICON_MAP: Record<string, LucideIcon> = {
  Trophy, BarChart3, Medal, UserRound, Tent, Globe2, Pin,
};

export type LandingSearchCard = SiteSearchCard;

const RECON_INITIAL_CAP = 10;
const COMP_INITIAL_CAP = 10;

const PLACEHOLDERS_ZH = [
  '今天从哪里开始?',
  '最近在参加什么比赛?',
  '想查谁的成绩?',
  '哪个项目的世界纪录?',
  '想看哪一年的统计?',
  '哪个公式还没背会?',
  '今天练 PLL 还是 OLL?',
  '上周末谁拿了冠军?',
  '想复盘哪场比赛?',
  '中国选手谁最快?',
  '哪个赛事即将开始?',
  '想学什么新方法?',
];
const PLACEHOLDERS_EN = [
  'Where to start today?',
  'Which comp are you at?',
  'Look up a cuber?',
  'Find a world record?',
  'Browse stats by year?',
  'Which alg to drill?',
  'PLL or OLL today?',
  'Who won last weekend?',
  'Recon a recent solve?',
  'Search a competition?',
  'Try a new method?',
  'Curious about an event?',
];

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

function rotatingPlaceholder(isZh: boolean): string {
  const list = isZh ? PLACEHOLDERS_ZH : PLACEHOLDERS_EN;
  return list[dayOfYear(new Date()) % list.length];
}

function HeaderMore({ overflow, title, href, onClick }: {
  overflow: number;
  title: string;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      +{overflow}
      <ArrowRight size={12} strokeWidth={1.75} />
    </>
  );
  if (href) {
    return (
      <Link href={href} className="landing-search-header-more" onClick={onClick} title={title}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className="landing-search-header-more" onClick={onClick} title={title}>
      {inner}
    </button>
  );
}

interface Props {
  cards: LandingSearchCard[];
  lang: 'zh' | 'en';
}

export default function LandingSearch({ cards, lang }: Props) {
  const isZh = lang === 'zh';
  const params = useParams<{ lang?: string }>();
  // Pattern B: English is the bare path → empty prefix; only Chinese is /zh.
  const effLang = params?.lang === 'zh' || params?.lang === 'en' ? params.lang : lang;
  const langPrefix = effLang === 'zh' ? '/zh' : '';
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { supported: micSupported, listening, start: micStart, stop: micStop } = useSpeechToText({
    lang: isZh ? 'zh-CN' : 'en-US',
    onResult: (text) => { setQuery(text); setOpen(true); },
  });
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const textInputRef = useRef<HTMLInputElement>(null);
  const [expandedPersons, setExpandedPersons] = useState(false);
  const [expandedRecons, setExpandedRecons] = useState(false);
  const [expandedGlossary, setExpandedGlossary] = useState(false);
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);

  const {
    q, xSearchEnabled, xLoaded,
    cardMatches, toolMatches, lookupMatches, statMatches,
    personMatches, compMatches,
    reconMatches, glossaryMatches, aboutMatches, stackMatches, algSetMatches,
    totalCount, yearMatch,
  } = useSiteSearch(query, 'eager', { cards });

  useEffect(() => {
    setExpandedPersons(false);
    setExpandedRecons(false); setExpandedGlossary(false);
  }, [q]);

  const visiblePersons = expandedPersons ? personMatches : personMatches.slice(0, INITIAL_RENDER_CAP);
  const visibleComps = compMatches.slice(0, COMP_INITIAL_CAP);
  const visibleRecons = expandedRecons ? reconMatches : reconMatches.slice(0, RECON_INITIAL_CAP);
  const visibleGlossary = expandedGlossary ? glossaryMatches : glossaryMatches.slice(0, INITIAL_RENDER_CAP);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const showDropdown = open && q !== '';

  // Prepend [lang] segment to internal paths. Vite uses ?lang= query;
  // Next uses /<lang>/* path prefix.
  const langHref = (path: string, extraQuery?: string): string => {
    const url = `${langPrefix}${path}`;
    return extraQuery ? `${url}?${extraQuery}` : url;
  };

  const closeAfter = () => { setOpen(false); setQuery(''); };
  const goCard = (c: LandingSearchCard) => {
    closeAfter();
    if (c.internal) router.push(c.href);
    else window.location.href = c.href;
  };

  // 直接在框里输入/粘贴 WCA URL / 打乱 / cubing.com 等 → 识别为对应工具的跳转意图
  const pasteIntent = useMemo(() => detectPasteIntent(query), [query]);
  const goPasteIntent = (intent: PasteIntent) => {
    closeAfter();
    setPlusMenuOpen(false);
    router.push(`${langPrefix}${intent.route}`);
  };

  // Enter on the search box → jump to the first result, following the same
  // top-to-bottom order the dropdown renders its sections in.
  const pushInternal = (href: string) => { closeAfter(); router.push(href); };
  const goFirstResult = () => {
    if (yearMatch) { pushInternal(langHref('/wca/comp', `year=${yearMatch}`)); return; }
    if (pasteIntent) { goPasteIntent(pasteIntent); return; }
    if (cardMatches.length > 0) { goCard(cardMatches[0]); return; }
    if (toolMatches.length > 0) { pushInternal(langHref(toolMatches[0].path)); return; }
    if (lookupMatches.length > 0) { pushInternal(langHref(lookupMatches[0].path, lookupMatches[0].extraQuery)); return; }
    if (statMatches.length > 0 && statMatches[0].items.length > 0) {
      const it = statMatches[0].items[0];
      if (it.kind === 'stat') pushInternal(langHref(`/wca/${it.stat.id}`));
      else pushInternal(`${langHref(`/wca/${it.parent.id}`)}#metric=${it.metric.id}`);
      return;
    }
    if (aboutMatches.length > 0) { pushInternal(langHref(`/wca/about/${aboutMatches[0].id}`)); return; }
    if (stackMatches.length > 0) { pushInternal(langHref(`/code/stack/${stackMatches[0].slug}`)); return; }
    if (glossaryMatches.length > 0) { pushInternal(`${langHref('/wiki')}#${glossaryMatches[0].slug}`); return; }
    if (algSetMatches.length > 0) { const a = algSetMatches[0]; pushInternal(langHref(`/alg/${a.puzzle}/${a.setSlug}`)); return; }
    if (personMatches.length > 0) { pushInternal(langHref(`/wca/persons/${personMatches[0].wcaId}`)); return; }
    if (compMatches.length > 0) {
      pushInternal(compLinkProps(compMatches[0].id, undefined, lang).href);
      return;
    }
    if (reconMatches.length > 0) { pushInternal(langHref(`/recon/${reconMatches[0].id}`)); return; }
  };

  // Smart paste — 读剪贴板,识别 WCA URL / 打乱 / cubing.com 等并跳转;识别不出就当搜索词。
  const onSmartPaste = async () => {
    setPlusMenuOpen(false);
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch { /* 权限拒绝 / 无 API */ }
    if (!text) {
      textInputRef.current?.focus();
      return;
    }
    const intent = detectPasteIntent(text);
    if (intent) {
      goPasteIntent(intent);
    } else {
      setQuery(text);
      setOpen(true);
    }
  };

  useEffect(() => {
    if (!plusMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setPlusMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [plusMenuOpen]);

  // Persons section is rendered inline normally, but pushed to the bottom for a
  // bare year query (e.g. "2026" matches every 2026-registered WCA ID prefix —
  // noise the user didn't ask for; the year-calendar shortcut takes the top).
  const personsSection = personMatches.length > 0 ? (
    <section className="landing-search-section">
      <div className="landing-search-section-header">
        <UserRound size={14} strokeWidth={1.75} />
        <h3>{isZh ? '选手' : 'Persons'}</h3>
        {!expandedPersons && personMatches.length > INITIAL_RENDER_CAP && (
          <HeaderMore
            overflow={personMatches.length - INITIAL_RENDER_CAP}
            title={isZh ? `展开全部 ${personMatches.length} 位` : `Expand all ${personMatches.length}`}
            onClick={() => setExpandedPersons(true)}
          />
        )}
      </div>
      <div className="landing-search-grid">
        {visiblePersons.map(p => (
          <Link
            key={p.wcaId}
            href={langHref(`/wca/persons/${p.wcaId}`)}
            prefetch={false}
            className="landing-search-item landing-search-item--rich"
            onClick={closeAfter}
          >
            <Flag iso2={p.iso2} className="country-flag" />
            <span className="landing-search-item-main">
              <span className="landing-search-item-name">{displayCuberName(p.name, isZh)}</span>
              <span className="landing-search-item-meta">{p.wcaId}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  ) : null;

  return (
    <div className="landing-search" ref={wrapRef}>
      <div
        className="landing-search-input"
        onMouseDown={e => {
          // 点击容器自身(上下 padding / 元素间 gap 死区)→ 聚焦输入框
          if (e.target === e.currentTarget) {
            e.preventDefault();
            textInputRef.current?.focus();
          }
        }}
      >
        <button
          type="button"
          className="landing-search-plus"
          onClick={() => setPlusMenuOpen(v => !v)}
          title={isZh ? '智能粘贴' : 'Smart paste'}
          aria-label={isZh ? '添加' : 'Add'}
          aria-expanded={plusMenuOpen}
        >
          <Plus size={18} strokeWidth={1.75} />
        </button>
        <input
          ref={textInputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onPaste={e => {
            const intent = detectPasteIntent(e.clipboardData.getData('text'));
            if (intent) { e.preventDefault(); goPasteIntent(intent); }
          }}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              setOpen(false);
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Enter') {
              goFirstResult();
            }
          }}
          placeholder={listening ? (isZh ? '请说…' : 'Listening…') : rotatingPlaceholder(isZh)}
        />
        {query !== '' && (
          <ClearButton
            onClick={() => setQuery('')}
            isZh={isZh}
            variant="standalone"
            className="landing-search-clear"
            preserveFocus
          />
        )}
        {plusMenuOpen && (
          <div className="landing-search-plus-menu" role="menu">
            <button type="button" role="menuitem" onClick={onSmartPaste}>
              <Clipboard size={14} strokeWidth={1.75} />
              <div className="landing-search-plus-menu-text">
                <span className="landing-search-plus-menu-title">{isZh ? '智能粘贴' : 'Smart paste'}</span>
                <span className="landing-search-plus-menu-sub">{isZh ? 'WCA URL / 打乱 / 公式' : 'WCA URL / scramble / alg'}</span>
              </div>
            </button>
          </div>
        )}
        {micSupported && (
          <button
            type="button"
            className={`landing-search-mic${listening ? ' is-listening' : ''}`}
            onClick={() => { if (listening) micStop(); else { setOpen(true); micStart(); } }}
            title={listening
              ? (isZh ? '停止录音' : 'Stop')
              : (isZh ? '语音输入' : 'Voice input')}
            aria-label={listening
              ? (isZh ? '停止录音' : 'Stop')
              : (isZh ? '语音输入' : 'Voice input')}
          >
            <Mic size={16} strokeWidth={1.75} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="landing-search-panel">
          {yearMatch && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <CalendarDays size={14} strokeWidth={1.75} />
                <h3>{isZh ? '年份' : 'Year'}</h3>
              </div>
              <div className="landing-search-grid">
                <Link
                  href={langHref('/wca/comp', `year=${yearMatch}`)}
                  className="landing-search-item"
                  onClick={closeAfter}
                >
                  <span className="landing-search-item-name">{isZh ? `${yearMatch} 年比赛日历` : `${yearMatch} competitions`}</span>
                  <span className="landing-search-item-meta">{isZh ? '查看该年所有比赛' : 'All competitions that year'}</span>
                </Link>
              </div>
            </section>
          )}
          {pasteIntent && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <Sparkles size={14} strokeWidth={1.75} />
                <h3>{isZh ? '智能识别' : 'Smart'}</h3>
              </div>
              <div className="landing-search-grid">
                <button
                  type="button"
                  className="landing-search-item"
                  onClick={() => goPasteIntent(pasteIntent)}
                >
                  <span className="landing-search-item-name">{isZh ? pasteIntent.labelZh : pasteIntent.labelEn}</span>
                  <span className="landing-search-item-meta">
                    {query.trim().slice(0, 60)}{query.trim().length > 60 ? '…' : ''}
                  </span>
                </button>
              </div>
            </section>
          )}

          {/* 纯年份查询只看年份相关(年份直达 + 比赛 + 选手沉底);
              抑制这些泛文本匹配类,否则 tagline/术语里碰巧含 "2026" 的会混进来 */}
          {!yearMatch && (
          <>
          {cardMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <LayoutGrid size={14} strokeWidth={1.75} />
                <h3>{isZh ? '页面' : 'Pages'}</h3>
              </div>
              <div className="landing-search-grid">
                {cardMatches.map(c => (
                  <button
                    type="button"
                    key={c.id}
                    className="landing-search-item"
                    onClick={() => goCard(c)}
                  >
                    <span className="landing-search-item-name">{isZh ? c.nameZh : c.nameEn}</span>
                    <span className="landing-search-item-meta">{isZh ? c.sectionTitleZh : c.sectionTitleEn}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {toolMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <Wrench size={14} strokeWidth={1.75} />
                <h3>{isZh ? '工具' : 'Tools'}</h3>
              </div>
              <div className="landing-search-grid">
                {toolMatches.map(it => (
                  <Link
                    key={it.path}
                    href={langHref(it.path)}
                    className="landing-search-item"
                    onClick={closeAfter}
                  >
                    <span className="landing-search-item-name">{isZh ? it.zh : it.en}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {lookupMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <Search size={14} strokeWidth={1.75} />
                <h3>{isZh ? '查询' : 'Lookup'}</h3>
              </div>
              <div className="landing-search-grid">
                {lookupMatches.map(it => (
                  <Link
                    key={`${it.path}|${it.extraQuery ?? ''}`}
                    href={langHref(it.path, it.extraQuery)}
                    className="landing-search-item"
                    onClick={closeAfter}
                  >
                    <span className="landing-search-item-name">{isZh ? it.zh : it.en}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {statMatches.map(({ cat, items }) => {
            const Icon = ICON_MAP[cat.iconName || ''];
            return (
              <section key={cat.nameEn} className="landing-search-section">
                <div className="landing-search-section-header">
                  {Icon && <Icon size={14} strokeWidth={1.75} />}
                  <h3>{isZh ? cat.nameZh : cat.nameEn}</h3>
                </div>
                <div className="landing-search-grid">
                  {items.map(it => {
                    if (it.kind === 'stat') {
                      const s = it.stat;
                      return (
                        <Link
                          key={`s:${s.id}`}
                          href={langHref(`/wca/${s.id}`)}
                          prefetch={false}
                          className="landing-search-item"
                          onClick={closeAfter}
                        >
                          <span className="landing-search-item-name">{isZh ? s.titleZh : s.titleEn}</span>
                        </Link>
                      );
                    }
                    const { parent, metric } = it;
                    const parentTitle = isZh ? parent.titleZh : parent.titleEn;
                    const metricLabel = METRIC_LABEL_OVERRIDE[metric.labelEn] ?? (isZh ? metric.labelZh : metric.labelEn);
                    return (
                      <Link
                        key={`m:${parent.id}:${metric.id}`}
                        href={`${langHref(`/wca/${parent.id}`)}#metric=${metric.id}`}
                        prefetch={false}
                        className="landing-search-item"
                        onClick={closeAfter}
                      >
                        <span className="landing-search-item-name">{parentTitle} · {metricLabel}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {aboutMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <BookOpen size={14} strokeWidth={1.75} />
                <h3>{isZh ? '算法说明' : 'About'}</h3>
              </div>
              <div className="landing-search-grid">
                {aboutMatches.map(a => (
                  <Link
                    key={a.id}
                    href={langHref(`/wca/about/${a.id}`)}
                    prefetch={false}
                    className="landing-search-item"
                    onClick={closeAfter}
                  >
                    <span className="landing-search-item-name">{isZh ? a.titleZh : a.titleEn}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {stackMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <CodeIcon size={14} strokeWidth={1.75} />
                <h3>{isZh ? '技术栈' : 'Stack'}</h3>
              </div>
              <div className="landing-search-grid">
                {stackMatches.map(s => (
                  <Link
                    key={s.slug}
                    href={langHref(`/code/stack/${s.slug}`)}
                    prefetch={false}
                    className="landing-search-item"
                    onClick={closeAfter}
                  >
                    <span className="landing-search-item-name">{s.name}</span>
                    <span className="landing-search-item-meta">{isZh ? s.zh.tagline : s.en.tagline}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {glossaryMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <BookA size={14} strokeWidth={1.75} />
                <h3>{isZh ? '术语' : 'Glossary'}</h3>
                {!expandedGlossary && glossaryMatches.length > INITIAL_RENDER_CAP && (
                  <HeaderMore
                    overflow={glossaryMatches.length - INITIAL_RENDER_CAP}
                    title={isZh ? `展开全部 ${glossaryMatches.length} 条` : `Expand all ${glossaryMatches.length}`}
                    onClick={() => setExpandedGlossary(true)}
                  />
                )}
              </div>
              <div className="landing-search-grid">
                {visibleGlossary.map(g => (
                  <Link
                    key={g.slug}
                    href={`${langHref('/wiki')}#${g.slug}`}
                    className="landing-search-item"
                    onClick={closeAfter}
                  >
                    <span className="landing-search-item-name">{g.head}</span>
                    <span className="landing-search-item-meta">{g.body.slice(0, 80)}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {algSetMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <Library size={14} strokeWidth={1.75} />
                <h3>{isZh ? '公式库' : 'Algorithms'}</h3>
              </div>
              <div className="landing-search-grid">
                {algSetMatches.map(a => (
                  <Link
                    key={`${a.puzzle}/${a.setSlug}`}
                    href={langHref(`/alg/${a.puzzle}/${a.setSlug}`)}
                    prefetch={false}
                    className="landing-search-item"
                    onClick={closeAfter}
                  >
                    <span className="landing-search-item-name">{a.puzzle} · {a.setSlug}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          </>
          )}

          {!yearMatch && personsSection}

          {compMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <CalendarDays size={14} strokeWidth={1.75} />
                <h3>{isZh ? '比赛' : 'Competitions'}</h3>
                {compMatches.length > COMP_INITIAL_CAP && (
                  <HeaderMore
                    overflow={compMatches.length - COMP_INITIAL_CAP}
                    title={isZh ? `查看全部 ${compMatches.length} 场` : `View all ${compMatches.length}`}
                    href={langHref(`/wca/comp`, `view=list&q=${encodeURIComponent(q)}`)}
                    onClick={closeAfter}
                  />
                )}
              </div>
              <div className="landing-search-grid">
                {visibleComps.map(c => {
                  const displayName = localizeCompName(c.id, c.name, isZh);
                  const cityStr = c.city ? localizeCity(c.city, isZh) : '';
                  return (
                    <Link
                      key={c.id}
                      {...compLinkProps(c.id, undefined, lang)}
                      className="landing-search-item landing-search-item--rich"
                      onClick={closeAfter}
                    >
                      <Flag iso2={c.country} className="country-flag" />
                      <span className="landing-search-item-main">
                        <span className="landing-search-item-name">{displayName}</span>
                        <span className="landing-search-item-meta">
                          {formatDateRangeIso(c.start_date, c.end_date)}
                          {cityStr ? ` · ${cityStr}` : ''}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {reconMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <ScanSearch size={14} strokeWidth={1.75} />
                <h3>{isZh ? '复盘' : 'Recons'}</h3>
                {!expandedRecons && reconMatches.length > RECON_INITIAL_CAP && (
                  <HeaderMore
                    overflow={reconMatches.length - RECON_INITIAL_CAP}
                    title={isZh ? `展开全部 ${reconMatches.length} 条` : `Expand all ${reconMatches.length}`}
                    onClick={() => setExpandedRecons(true)}
                  />
                )}
              </div>
              <div className="landing-search-grid">
                {visibleRecons.map(r => (
                  <Link
                    key={r.id}
                    href={langHref(`/recon/${r.id}`)}
                    prefetch={false}
                    className="landing-search-item landing-search-item--rich"
                    onClick={closeAfter}
                  >
                    {r.personIso2 && <Flag iso2={r.personIso2} className="country-flag" />}
                    <EventIcon event={r.event} className="landing-search-event-icon" />
                    <span className="landing-search-item-main">
                      <span className="landing-search-item-name">
                        {displayCuberName(r.person, isZh)} · {r.valueStr}
                        {r.recordTag && <RecordBadge record={r.recordTag} variant="inline" iso2={r.personIso2} />}
                        {r.aoType ? ` · ${r.aoType}` : ''}
                      </span>
                      <span className="landing-search-item-meta">
                        {r.comp ? r.comp : ''}
                        {r.comp && r.date ? ' · ' : ''}
                        {r.date ?? ''}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {yearMatch && personsSection}

          {totalCount === 0 && !pasteIntent && !yearMatch && (xLoaded || !xSearchEnabled) && (
            <div className="landing-search-empty">
              {isZh ? '未找到匹配项' : 'No matches found.'}
            </div>
          )}
          {totalCount === 0 && !pasteIntent && !yearMatch && xSearchEnabled && !xLoaded && (
            <div className="landing-search-empty">
              {isZh ? '搜索中…' : 'Searching…'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
