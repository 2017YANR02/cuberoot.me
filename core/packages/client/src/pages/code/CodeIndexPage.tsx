import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LangToggle from '../../components/LangToggle';
import './code_index.css';

interface Card {
  href: string;
  glyph: string;
  accent: string;
  zh: { title: string; sub: string; tagline: string; meta: string };
  en: { title: string; sub: string; tagline: string; meta: string };
}

const CARDS: Card[] = [
  {
    href: '/code/architecture',
    glyph: '⛯',
    accent: '#76B900',
    zh: {
      title: '架构',
      sub: 'Architecture',
      tagline: 'CubeRoot 这个站点是怎么搭起来的:React SPA + Hono API + PostgreSQL,加一条独立的 WCA 统计管道',
      meta: '5 包 · 14 模块 · 80+ 统计页',
    },
    en: {
      title: 'Architecture',
      sub: 'How it’s built',
      tagline: 'How CubeRoot is put together: React SPA + Hono API + PostgreSQL, plus a standalone WCA stats pipeline',
      meta: '5 packages · 14 modules · 80+ stat pages',
    },
  },
  {
    href: '/code/language',
    glyph: '{ }',
    accent: '#5BA8FF',
    zh: {
      title: '语言',
      sub: 'Programming Languages',
      tagline: '12 门编程语言的长篇导览。一门一篇深度,含历史、特性、生态、当下处境',
      meta: '12 门语言 · 2 篇横向对比',
    },
    en: {
      title: 'Languages',
      sub: 'Long-form guides',
      tagline: 'Long-form guides to 12 programming languages — history, features, ecosystem, current state, one page each',
      meta: '12 languages · 2 cross-comparisons',
    },
  },
];

export default function CodeIndexPage() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = i18n.language.startsWith('zh') ? 'zh' : 'en';

  useEffect(() => {
    document.title = lang === 'zh' ? '代码 — CubeRoot' : 'Code — CubeRoot';
  }, [lang]);

  return (
    <div className="code-index">
      <div className="code-index-bg" />

      <header className="code-index-head">
        <div className="code-index-topbar">
          <Link to="/" className="code-index-back">
            ← {lang === 'zh' ? '回首页' : 'Home'}
          </Link>
          <LangToggle variant="inline" />
        </div>
        <h1 className="code-index-title">
          <span className="code-index-prefix">/</span>code
          <span className="code-index-cursor">_</span>
        </h1>
        <p className="code-index-sub">
          {lang === 'zh'
            ? '代码相关的两条线:CubeRoot 这个站点本身是怎么搭的,以及一些写给爱好者看的编程语言长篇导览。'
            : 'Two threads about code: how this site itself is built, and long-form guides to programming languages.'}
        </p>
      </header>

      <main className="code-index-grid">
        {CARDS.map((c) => {
          const t = c[lang];
          return (
            <Link
              key={c.href}
              to={c.href}
              className="code-index-card"
              style={{ ['--accent' as string]: c.accent }}
            >
              <div className="code-index-card-top">
                <div className="code-index-card-glyph">{c.glyph}</div>
                <div className="code-index-card-route">{c.href}</div>
              </div>
              <div className="code-index-card-title">{t.title}</div>
              <div className="code-index-card-sub">{t.sub}</div>
              <p className="code-index-card-tagline">{t.tagline}</p>
              <div className="code-index-card-foot">
                <span className="code-index-card-meta">{t.meta}</span>
                <span className="code-index-card-arrow">→</span>
              </div>
            </Link>
          );
        })}
      </main>

      <footer className="code-index-foot">
        <div className="code-index-foot-line">
          <Link to="/">CubeRoot</Link>
        </div>
      </footer>
    </div>
  );
}
