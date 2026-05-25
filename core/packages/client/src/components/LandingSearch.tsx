// 落地页全站搜索 — Hero 下拉浮层
// 匹配逻辑统一在 utils/site_search.ts;这里只管下拉浮层的 UI 壳。
import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Trophy, BarChart3, Medal, UserRound, Tent, Globe2, Pin,
  CalendarDays, LayoutGrid, Wrench, ArrowRight, Search, Clipboard, Film,
  ScanSearch, BookA, BookOpen, Library, Code as CodeIcon, Mic, type LucideIcon,
} from 'lucide-react';
import { getLangQuery } from '../i18n';
import { ClearButton } from './ClearButton';
import { Flag } from '../utils/flag';
import { displayCuberName } from '../utils/name_utils';
import { localizeCompName } from '../utils/comp_localize';
import { compLinkProps } from '../utils/comp_link';
import { localizeCity } from '../utils/city_localize';
import { formatDateRangeIso } from '../utils/date_range';
import {
  useSiteSearch,
  METRIC_LABEL_OVERRIDE,
  INITIAL_RENDER_CAP,
  type SiteSearchCard,
} from '../utils/site_search';
// EventIcon 内联了所有 WCA 项目 SVG (~68KB gzip),只在搜索下拉的 recon 结果里用 — 首屏 lazy。
const EventIcon = lazy(() =>
  import('./EventIcon/EventIcon').then(m => ({ default: m.EventIcon })),
);
import { useSpeechToText } from '../utils/useSpeechToText';
import { detectPasteIntent } from '../utils/smart_paste';
import { setPendingVideo } from '../utils/pending_video';
import './landing_search.css';

const ICON_MAP: Record<string, LucideIcon> = {
  Trophy, BarChart3, Medal, UserRound, Tent, Globe2, Pin,
};

export type LandingSearchCard = SiteSearchCard;

const RECON_INITIAL_CAP = 10;
const COMP_INITIAL_CAP = 10;

// 每天轮换的搜索框 placeholder。按本地日期取 day-of-year mod N,同一天稳定不变。
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

// 共享:section header 右侧 "+N →"。to 给定则是导航链接,否则是 expand 按钮。
function HeaderMore({ overflow, title, to, onClick }: {
  overflow: number;
  title: string;
  to?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      +{overflow}
      <ArrowRight size={12} strokeWidth={1.75} />
    </>
  );
  if (to) {
    return (
      <Link to={to} className="landing-search-header-more" onClick={onClick} title={title}>
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
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { supported: micSupported, listening, start: micStart, stop: micStop } = useSpeechToText({
    lang: isZh ? 'zh-CN' : 'en-US',
    onResult: (text) => { setQuery(text); setOpen(true); },
  });
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedPersons, setExpandedPersons] = useState(false);
  const [expandedRecons, setExpandedRecons] = useState(false);
  const [expandedGlossary, setExpandedGlossary] = useState(false);
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);

  const {
    q, xSearchEnabled, xLoaded,
    cardMatches, toolMatches, lookupMatches, statMatches,
    personMatches, compMatches,
    reconMatches, glossaryMatches, aboutMatches, stackMatches, algSetMatches,
    totalCount,
  } = useSiteSearch(query, 'eager', { cards });

  // NOTE: 切 query → 折回默认页(展示 cap + "显示更多" 按钮)。比赛走跳转 /wca/calendar 不需要 expand state。
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
  const langQuery = getLangQuery();

  const closeAfter = () => { setOpen(false); setQuery(''); };
  const goCard = (c: LandingSearchCard) => {
    closeAfter();
    if (c.internal) navigate(c.href);
    else window.location.href = c.href;
  };

  /** Smart paste — 读剪贴板,识别 WCA URL / 打乱 / cubing.com 等并跳转;识别不出就当搜索词。 */
  const onSmartPaste = async () => {
    setPlusMenuOpen(false);
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch { /* 权限拒绝 / 无 API */ }
    if (!text) {
      wrapRef.current?.querySelector('input')?.focus();
      return;
    }
    const intent = detectPasteIntent(text);
    if (intent) {
      closeAfter();
      navigate(intent.route);
    } else {
      setQuery(text);
      setOpen(true);
    }
  };

  /** 选/拖视频 → /frame-count 自动加载 */
  const onVideoFile = (file: File | null | undefined) => {
    if (!file || !file.type.startsWith('video/')) return;
    setPendingVideo(file);
    closeAfter();
    setPlusMenuOpen(false);
    navigate('/frame-count');
  };

  // 关掉菜单 — 点外部
  useEffect(() => {
    if (!plusMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setPlusMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [plusMenuOpen]);

  return (
    <div className="landing-search" ref={wrapRef}>
      <div
        className={`landing-search-input${dragging ? ' is-drag-over' : ''}`}
        onDragOver={e => {
          if (e.dataTransfer?.types.includes('Files')) {
            e.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          onVideoFile(e.dataTransfer.files[0]);
        }}
      >
        <button
          type="button"
          className="landing-search-plus"
          onClick={() => setPlusMenuOpen(v => !v)}
          title={isZh ? '智能粘贴 / 上传视频' : 'Smart paste / upload video'}
          aria-label={isZh ? '添加' : 'Add'}
          aria-expanded={plusMenuOpen}
        >
          <Plus size={18} strokeWidth={1.75} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          style={{ display: 'none' }}
          onChange={e => onVideoFile(e.target.files?.[0])}
        />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              setOpen(false);
              (e.target as HTMLInputElement).blur();
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
            <button type="button" role="menuitem" onClick={() => fileInputRef.current?.click()}>
              <Film size={14} strokeWidth={1.75} />
              <div className="landing-search-plus-menu-text">
                <span className="landing-search-plus-menu-title">{isZh ? '上传视频数帧' : 'Upload video'}</span>
                <span className="landing-search-plus-menu-sub">{isZh ? '逐帧计时,记录 split' : 'Per-frame timing & splits'}</span>
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
                    to={`${it.path}${langQuery}`}
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
                {lookupMatches.map(it => {
                  const to = it.extraQuery ? `${it.path}${langQuery}&${it.extraQuery}` : `${it.path}${langQuery}`;
                  return (
                    <Link
                      key={`${it.path}|${it.extraQuery ?? ''}`}
                      to={to}
                      className="landing-search-item"
                      onClick={closeAfter}
                    >
                      <span className="landing-search-item-name">{isZh ? it.zh : it.en}</span>
                    </Link>
                  );
                })}
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
                          to={`/wca/${s.id}${langQuery}`}
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
                        to={`/wca/${parent.id}${langQuery}#metric=${metric.id}`}
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
                    to={`/wca/about/${a.id}${langQuery}`}
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
                    to={`/code/stack/${s.slug}${langQuery}`}
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
                    to={`/wiki${langQuery}#${g.slug}`}
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
                    to={`/alg/${a.puzzle}/${a.setSlug}${langQuery}`}
                    className="landing-search-item"
                    onClick={closeAfter}
                  >
                    <span className="landing-search-item-name">{a.puzzle} · {a.setSlug}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {personMatches.length > 0 && (
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
                    to={`/wca/persons/${p.wcaId}${langQuery}`}
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
          )}

          {compMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <CalendarDays size={14} strokeWidth={1.75} />
                <h3>{isZh ? '比赛' : 'Competitions'}</h3>
                {compMatches.length > COMP_INITIAL_CAP && (
                  <HeaderMore
                    overflow={compMatches.length - COMP_INITIAL_CAP}
                    title={isZh ? `查看全部 ${compMatches.length} 场` : `View all ${compMatches.length}`}
                    to={`/wca/calendar${langQuery}&view=list&q=${encodeURIComponent(q)}`}
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
                      {...compLinkProps(c.id)}
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
                    to={`/recon/${r.id}${langQuery}`}
                    className="landing-search-item landing-search-item--rich"
                    onClick={closeAfter}
                  >
                    {r.personIso2 && <Flag iso2={r.personIso2} className="country-flag" />}
                    <Suspense fallback={<span className="landing-search-event-icon" />}>
                      <EventIcon event={r.event} className="landing-search-event-icon" />
                    </Suspense>
                    <span className="landing-search-item-main">
                      <span className="landing-search-item-name">
                        {displayCuberName(r.person, isZh)} · {r.valueStr}
                        {r.recordTag ? ` · ${r.recordTag}` : ''}
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

          {totalCount === 0 && (xLoaded || !xSearchEnabled) && (
            <div className="landing-search-empty">
              {isZh ? '未找到匹配项' : 'No matches found.'}
            </div>
          )}
          {totalCount === 0 && xSearchEnabled && !xLoaded && (
            <div className="landing-search-empty">
              {isZh ? '搜索中…' : 'Searching…'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
