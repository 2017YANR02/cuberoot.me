import { useEffect } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LangToggle from '../../components/LangToggle';
import { STACK_TOOLS } from './stack_data';
import './stack_intro.css';

export default function StackToolPage() {
  const { slug } = useParams<{ slug: string }>();
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const tool = STACK_TOOLS.find((t) => t.slug === slug);
  const idx = tool ? STACK_TOOLS.findIndex((t) => t.slug === slug) : -1;
  const prev = idx > 0 ? STACK_TOOLS[idx - 1] : null;
  const next = idx >= 0 && idx < STACK_TOOLS.length - 1 ? STACK_TOOLS[idx + 1] : null;

  useEffect(() => {
    if (tool) {
      document.title = lang === 'zh' ? `${tool.name} — CubeRoot` : `${tool.name} — CubeRoot`;
    }
  }, [tool, lang]);

  if (!tool) {
    return <Navigate to="/code/stack" replace />;
  }

  const t = tool[lang];

  return (
    <div className="stack-intro" style={{ ['--accent' as string]: tool.accent }}>
      <div className="stack-intro-bg" />

      <header className="stack-intro-head">
        <div className="stack-intro-topbar">
          <Link to="/code/stack" className="stack-intro-back">
            ← /code/stack
          </Link>
          <LangToggle variant="inline" />
        </div>

        <div className="stack-intro-hero">
          <div className="stack-intro-hero-glyph">{tool.glyph}</div>
          <div className="stack-intro-hero-body">
            <div className="stack-intro-hero-tag">
              // {tool.group} · {lang === 'zh' ? '诞生' : 'born'} {tool.since}
            </div>
            <h1 className="stack-intro-hero-title">
              {tool.name}
              <span className="stack-intro-hero-version">{tool.version}</span>
            </h1>
            <p className="stack-intro-hero-tagline">{t.tagline}</p>
            <p className="stack-intro-hero-role">{t.role}</p>
          </div>
        </div>
      </header>

      <main className="stack-intro-main">

        <section className="stack-intro-section">
          <div className="stack-intro-section-tag">// {lang === 'zh' ? '它是什么' : 'What it is'}</div>
          <div className="stack-intro-prose">{t.intro}</div>
        </section>

        <section className="stack-intro-section">
          <div className="stack-intro-section-tag">// {lang === 'zh' ? '简史' : 'Mini history'}</div>
          <ol className="stack-intro-timeline">
            {tool.history.map((h, i) => (
              <li key={i} className={`stack-intro-timeline-item${h.highlight ? ' is-highlight' : ''}`}>
                <span className="stack-intro-timeline-year">{h.year}</span>
                <div className="stack-intro-timeline-body">
                  <div className="stack-intro-timeline-title">{h[lang].title}</div>
                  <p className="stack-intro-timeline-desc">{h[lang].desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="stack-intro-section">
          <div className="stack-intro-section-tag">// {lang === 'zh' ? '它强在哪' : 'What makes it good'}</div>
          <div className="stack-intro-features">
            {tool.features.map((f, i) => (
              <div key={i} className="stack-intro-feature">
                <div className="stack-intro-feature-num">0{i + 1}</div>
                <div className="stack-intro-feature-title">{f[lang].title}</div>
                <p className="stack-intro-feature-desc">{f[lang].desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="stack-intro-section stack-intro-why">
          <div className="stack-intro-section-tag">// {lang === 'zh' ? '为什么挑它' : 'Why we picked it'}</div>
          <div className="stack-intro-prose">{t.why}</div>
        </section>

        <section className="stack-intro-section">
          <div className="stack-intro-section-tag">
            // {lang === 'zh' ? '在 cuberoot.me 上做什么' : 'What it does on cuberoot.me'}
          </div>
          <div className="stack-intro-prose">{t.cuberoot}</div>
        </section>

        {tool.snippet && (
          <section className="stack-intro-section">
            <div className="stack-intro-section-tag">// {lang === 'zh' ? '一段真实片段' : 'A real snippet'}</div>
            <pre className="stack-intro-snippet" data-lang={tool.snippet.lang}>
              <code>{tool.snippet.code}</code>
            </pre>
          </section>
        )}

        {tool.links.length > 0 && (
          <section className="stack-intro-section">
            <div className="stack-intro-section-tag">// {lang === 'zh' ? '链接' : 'Links'}</div>
            <ul className="stack-intro-links">
              {tool.links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} target="_blank" rel="noopener noreferrer">
                    {l.label}
                    <span className="stack-intro-link-host">{(() => {
                      try {
                        return new URL(l.href).host;
                      } catch {
                        return '';
                      }
                    })()}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <nav className="stack-intro-pager">
        {prev ? (
          <Link to={`/code/stack/${prev.slug}`} className="stack-intro-pager-link prev">
            <span className="stack-intro-pager-dir">← {lang === 'zh' ? '上一件' : 'prev'}</span>
            <span className="stack-intro-pager-name">{prev.name}</span>
          </Link>
        ) : <span />}
        {next ? (
          <Link to={`/code/stack/${next.slug}`} className="stack-intro-pager-link next">
            <span className="stack-intro-pager-dir">{lang === 'zh' ? '下一件' : 'next'} →</span>
            <span className="stack-intro-pager-name">{next.name}</span>
          </Link>
        ) : <span />}
      </nav>

      <footer className="stack-intro-foot">
        <div className="stack-intro-foot-line">
          <Link to="/code/stack">/code/stack</Link>
          <span className="stack-intro-foot-dot">·</span>
          <Link to="/code">/code</Link>
          <span className="stack-intro-foot-dot">·</span>
          <Link to="/">CubeRoot</Link>
        </div>
      </footer>
    </div>
  );
}
