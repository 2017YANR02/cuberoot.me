/**
 * /wiki — 魔方术语表。
 * 数据源:同目录 glossary.json (.tmp/docx/glossary.txt 一次性解析产物)。
 * 头一行: term + 可选 (English Expansion) + 可选 Chinese; 渲染为整体不再拆分。
 * 正文: blank-line 分段; URL 自动转链接。
 */
import { useMemo, useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Search, X } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import ThemeToggle from '../../components/ThemeToggle';
import GLOSSARY from './glossary.json';
import './wiki.css';

interface Entry { head: string; body: string }
interface Section { letter: string; entries: Entry[] }

const SECTIONS = (GLOSSARY as { sections: Section[] }).sections;

// 将 URL 拆出来变成 <a>;其余文本保留 \n 换行
function renderBody(body: string) {
  const urlRe = /(https?:\/\/[^\s)]+)/g;
  return body.split('\n').map((line, i) => {
    const parts: (string | { url: string })[] = [];
    let last = 0;
    for (const m of line.matchAll(urlRe)) {
      if (m.index! > last) parts.push(line.slice(last, m.index!));
      parts.push({ url: m[1] });
      last = m.index! + m[1].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return (
      <p key={i} className="wiki-entry-body-line">
        {parts.map((p, j) =>
          typeof p === 'string'
            ? <span key={j}>{p}</span>
            : <a key={j} href={p.url} target="_blank" rel="noopener noreferrer">{p.url}</a>
        )}
      </p>
    );
  });
}

// head 转 slug 用作 anchor (term-... format),只保留 ASCII + 中文,空格→-
function slugify(head: string) {
  return head
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export default function WikiPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  // 过滤后的 sections (空 section 不渲染)
  const filtered = useMemo(() => {
    if (!q) return SECTIONS;
    return SECTIONS
      .map(s => ({
        ...s,
        entries: s.entries.filter(e =>
          e.head.toLowerCase().includes(q) || e.body.toLowerCase().includes(q)
        ),
      }))
      .filter(s => s.entries.length > 0);
  }, [q]);

  const totalEntries = useMemo(
    () => SECTIONS.reduce((n, s) => n + s.entries.length, 0),
    []
  );
  const matchedEntries = useMemo(
    () => filtered.reduce((n, s) => n + s.entries.length, 0),
    [filtered]
  );

  // 字母跳转
  const handleJump = (letter: string) => {
    const el = document.getElementById(`wiki-section-${letter}`);
    if (el) {
      const offset = 80; // 顶部 sticky 头部 padding
      const y = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // 当前可见 letter (用于高亮 alphabet bar 活跃项)
  const [activeLetter, setActiveLetter] = useState<string>('');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (q) return; // 搜索时不跟踪
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) {
          const letter = visible.target.getAttribute('data-letter');
          if (letter) setActiveLetter(letter);
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    );
    Object.values(sectionRefs.current).forEach(el => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [q]);

  return (
    <div className="wiki-page">
      <header className="wiki-header">
        <Link to="/" className="wiki-back">
          <ChevronLeft size={16} />
          <span>{isZh ? '首页' : 'Home'}</span>
        </Link>
        <div className="wiki-header-right">
          <LangToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="wiki-main">
        <h1 className="wiki-title">{isZh ? '魔方术语' : 'Cubing Glossary'}</h1>
        <p className="wiki-lead">
          {isZh
            ? `${totalEntries} 条魔方术语,中英对照。资料汇编自 `
            : `${totalEntries} cubing terms in English / Chinese. Compiled from `}
          <a href="https://www.speedsolving.com/wiki" target="_blank" rel="noopener noreferrer">
            speedsolving.com/wiki
          </a>
          {isZh ? ' 等公开资料。' : ' and other public sources.'}
        </p>

        <div className="wiki-search-wrap">
          <Search size={16} className="wiki-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="wiki-search-input"
            placeholder={isZh ? '搜索术语 (如 CFOP / 翻棱 / sune)' : 'Search terms (e.g. CFOP / EO / sune)'}
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              className="wiki-search-clear"
              onClick={() => setQuery('')}
              aria-label={isZh ? '清除' : 'Clear'}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {q && (
          <div className="wiki-search-meta">
            {isZh
              ? `匹配 ${matchedEntries} 条`
              : `${matchedEntries} match${matchedEntries === 1 ? '' : 'es'}`}
          </div>
        )}

        {!q && (
          <nav className="wiki-alpha-bar" aria-label={isZh ? '按字母跳转' : 'Jump by letter'}>
            {SECTIONS.map(s => (
              <button
                key={s.letter}
                type="button"
                className={`wiki-alpha-btn${activeLetter === s.letter ? ' is-active' : ''}`}
                onClick={() => handleJump(s.letter)}
              >
                {s.letter}
              </button>
            ))}
          </nav>
        )}

        <div className="wiki-sections">
          {filtered.length === 0 && (
            <div className="wiki-empty">
              {isZh ? '没有匹配项。' : 'No matches.'}
            </div>
          )}
          {filtered.map(sec => (
            <section
              key={sec.letter}
              id={`wiki-section-${sec.letter}`}
              data-letter={sec.letter}
              ref={el => { sectionRefs.current[sec.letter] = el; }}
              className="wiki-section"
            >
              <h2 className="wiki-section-title">{sec.letter}</h2>
              <ul className="wiki-entries">
                {sec.entries.map((e, i) => (
                  <li
                    key={`${sec.letter}-${i}`}
                    id={slugify(e.head) || `e-${sec.letter}-${i}`}
                    className="wiki-entry"
                  >
                    <h3 className="wiki-entry-head">{e.head}</h3>
                    {e.body && <div className="wiki-entry-body">{renderBody(e.body)}</div>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
