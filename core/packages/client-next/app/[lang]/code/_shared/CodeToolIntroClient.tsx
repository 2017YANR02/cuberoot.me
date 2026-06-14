'use client';

// Ported from packages/client/src/pages/code/StackToolPage.tsx
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import Link from '@/components/AppLink';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { STACK_TOOLS_META } from '../stack/_lib/stack_meta';
import { loadStackTool } from '../stack/_lib/stack_data';
import type { StackTool } from '../stack/_lib/stack_tool_types';
import { LangCtx, L, type Lang } from '../stack/_lib/Lang';
import { LLM_TOOLS_META } from '../llm/_lib/llm_meta';
import { loadLlmTool } from '../llm/_lib/llm_data';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../stack/ts_intro.css';
import '../stack/stack_intro.css';
import i18n from '@/i18n/i18n-client';
import { tr } from '@/i18n/tr';

// One shell, two sections: /code/stack and /code/llm share this intro renderer.
const SECTIONS = {
  stack: { base: '/code/stack', meta: STACK_TOOLS_META, load: loadStackTool },
  llm: { base: '/code/llm', meta: LLM_TOOLS_META, load: loadLlmTool },
} as const;
export type ToolSection = keyof typeof SECTIONS;

export default function CodeToolIntroClient({ section = 'stack' }: { section?: ToolSection }) {
  const { base, meta: META, load } = SECTIONS[section];
  const params = useParams<{ slug: string | string[] }>();
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;
  const router = useRouter();
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  const rootRef = useRef<HTMLDivElement>(null);

  const meta = META.find((t) => t.slug === slug);
  const idx = meta ? META.findIndex((t) => t.slug === slug) : -1;
  const prev = idx > 0 ? META[idx - 1] : null;
  const next = idx >= 0 && idx < META.length - 1 ? META[idx + 1] : null;

  const [detail, setDetail] = useState<StackTool | null>(null);

  useEffect(() => {
    if (!slug || !meta) return;
    setDetail(null);
    let cancelled = false;
    load(slug).then((d) => { if (!cancelled) setDetail(d); });
    return () => { cancelled = true; };
  }, [slug, meta]);

  useDocumentTitle(meta?.name ?? '', meta?.name ?? '');

  useEffect(() => {
    if (!meta) router.replace(base);
  }, [meta, router, base]);

  useEffect(() => {
    if (!detail) return;
    const root = rootRef.current;
    if (!root) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    const targets = root.querySelectorAll<HTMLElement>(
      '.tl-item, .why-card, .def-card, .future-card, .ts-card, .adopter-card, .hero-stats .stat'
    );
    targets.forEach((el) => { el.classList.add('fade-up'); io.observe(el); });

    root.querySelectorAll<HTMLElement>('.tl-item').forEach((el, i) => { el.style.transitionDelay = `${Math.min(i * 50, 400)}ms`; });
    root.querySelectorAll<HTMLElement>('.why-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 70}ms`; });
    root.querySelectorAll<HTMLElement>('.ts-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 60}ms`; });
    root.querySelectorAll<HTMLElement>('.adopter-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 50}ms`; });

    const floats = root.querySelectorAll<HTMLElement>('.float');
    let mx = 0, my = 0, tx = 0, ty = 0;
    const onMouse = (e: MouseEvent) => {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouse);
    let raf = 0;
    const loop = () => {
      tx += (mx - tx) * 0.06;
      ty += (my - ty) * 0.06;
      floats.forEach((el, i) => {
        const depth = (i % 3 + 1) * 6;
        el.style.translate = `${tx * depth}px ${ty * depth}px`;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const navLinks = root.querySelectorAll<HTMLAnchorElement>('.nav-links a');
    const sections = Array.from(root.querySelectorAll<HTMLElement>('section[id]'));
    const setActive = () => {
      const y = window.scrollY + 120;
      let cur = sections[0]?.id;
      for (const sec of sections) if (sec.offsetTop <= y) cur = sec.id;
      navLinks.forEach((a) => {
        a.style.color = a.getAttribute('href') === '#' + cur ? 'var(--ts-bright)' : '';
      });
    };
    window.addEventListener('scroll', setActive, { passive: true });
    setActive();

    const onAnchorClick = (e: Event) => {
      const a = e.currentTarget as HTMLAnchorElement;
      const href = a.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      const id = href.slice(1);
      const target = id === 'top' ? root : root.querySelector('#' + id);
      if (target) {
        e.preventDefault();
        const top = (target as HTMLElement).getBoundingClientRect().top + window.scrollY - 60;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    };
    const anchors = root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]');
    anchors.forEach((a) => a.addEventListener('click', onAnchorClick));

    return () => {
      io.disconnect();
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('scroll', setActive);
      cancelAnimationFrame(raf);
      anchors.forEach((a) => a.removeEventListener('click', onAnchorClick));
    };
  }, [detail]);

  if (!meta) return null;

  const mt = meta[lang];
  const t = detail ? detail[lang] : null;

  const themeVars: CSSProperties = {
    ['--ts' as string]: meta.accent,
    ['--ts-bright' as string]: meta.bright,
    ['--ts-soft' as string]: `${meta.accent}33`,
    ['--ts-glow' as string]: `${meta.bright}73`,
  };

  return (
    <LangCtx.Provider value={lang}>
      <div ref={rootRef} className="ts-intro-root stack-tool-root" style={themeVars}>
        <div className="grid-bg" />
        <div className="glow glow-tl" style={{ background: `radial-gradient(circle, ${meta.accent}66 0%, transparent 70%)` }} />
        <div className="glow glow-br" style={{ background: `radial-gradient(circle, ${meta.accent}55 0%, transparent 70%)`, opacity: 0.25 }} />

        <nav className="nav">
          <Link className="nav-logo" href={base}>
            <span className="stack-nav-glyph" style={{ background: meta.accent }}>{meta.glyph}</span>
            <span>{meta.name}</span>
            <span className="nav-tag">: {mt.tagline}</span>
          </Link>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#concepts"><L zh="核心" en="Concepts" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#adopters"><L zh="谁用" en="Adopters" /></a></li>
            <li><a href="#cuberoot"><L zh="本站" en="Here" /></a></li>
            <li><a href="#outlook"><L zh="前景" en="Outlook" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero — META alone is enough for instant render */}
          <section className="hero">
            <div className="hero-tag">// {meta.group} · {tr({ zh: '诞生', en: 'born'
            })} {meta.since} · v{meta.version}</div>
            <h1 className="hero-title">
              <span className="hero-name">{meta.name}</span>
              <span className="hero-colon">:</span>
              <span className="hero-type">{mt.tagline}</span>
            </h1>
            {detail && t ? (
              <>
                <p className="hero-sub">{t.heroSub}</p>
                <div className="hero-stats">
                  {detail.heroStats.map((stat, i) => (
                    <div className="stat" key={i}>
                      <span className="stat-num">{stat.num}<small>{stat.unit ?? ''}</small></span>
                      <span className="stat-label">{((i18n.language.startsWith('zh') ? stat.zh : stat.en))}</span>
                    </div>
                  ))}
                </div>
                <div className="hero-floats">
                  {detail.floats.map((f, i) => (
                    <span className={`float f${i + 1}`} key={i}>{f}</span>
                  ))}
                </div>
              </>
            ) : (
              <p className="hero-sub" style={{ opacity: 0.5 }}>{mt.role}</p>
            )}
            <div className="hero-cube">
              <div className="hero-cube-face f-front stack-hero-face" style={{ background: meta.accent }}>
                <span className="stack-hero-glyph">{meta.glyph}</span>
              </div>
            </div>
            <a className="scroll-cue" href="#what">
              <span>scroll</span>
              <svg viewBox="0 0 12 24" width="12" height="24"><path d="M6 0v22M2 18l4 4 4-4" stroke="currentColor" fill="none" strokeWidth="1.5" /></svg>
            </a>
          </section>

          {detail && t ? (
            <>
              {/* 01 What */}
              <section className="section" id="what">
                <header className="sec-head">
                  <span className="sec-num">01</span>
                  <h2 className="sec-title"><L zh="何为" en="What is" /> <code>{meta.name}</code></h2>
                  <p className="sec-desc">{t.whatDesc}</p>
                </header>
                <div className="stack-intro-prose stack-prose-wide">
                  {(i18n.language.startsWith('zh') ? detail.intro.zh : detail.intro.en)}
                </div>
              </section>

              {/* 02 History */}
              <section className="section" id="history">
                <header className="sec-head">
                  <span className="sec-num">02</span>
                  <h2 className="sec-title"><L zh="来路" en="History" /> <code>: Timeline</code></h2>
                  <p className="sec-desc">{t.historyDesc}</p>
                </header>
                <ol className="timeline">
                  {detail.history.map((it, i) => (
                    <li className={`tl-item${it.highlight ? ' highlight' : ''}`} key={i}>
                      <div className="tl-year">{it.year}</div>
                      <div className="tl-card">
                        <h3>{it[lang].title}</h3>
                        <p>{it[lang].desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              {/* 03 Concepts */}
              <section className="section" id="concepts">
                <header className="sec-head">
                  <span className="sec-num">03</span>
                  <h2 className="sec-title">{t.conceptsTitle} <code>: Atoms</code></h2>
                  <p className="sec-desc">{t.conceptsDesc}</p>
                </header>
                <div className="ts-grid stack-concept-grid">
                  {detail.concepts.map((card, i) => (
                    <div className="ts-card" key={i}>
                      <div className="ts-tag">{card.tag}</div>
                      <h3>{card[lang].title}</h3>
                      <p>{card[lang].desc}</p>
                      {card.code && <pre className="ts-code"><code>{card.code}</code></pre>}
                    </div>
                  ))}
                </div>
              </section>

              {/* 04 Why */}
              <section className="section" id="why">
                <header className="sec-head">
                  <span className="sec-num">04</span>
                  <h2 className="sec-title"><L zh="为何要选" en="Why pick" /> <code>{meta.name}</code></h2>
                  <p className="sec-desc">{t.whyDesc}</p>
                </header>
                <div className="why-grid">
                  {detail.whyCards.map((w, i) => (
                    <div className="why-card" key={i}>
                      <div className="why-icon">{w.icon}</div>
                      <h3>{w[lang].title}</h3>
                      <p>{w[lang].desc}</p>
                      {w.code && <pre className="ts-code why-code"><code>{w.code}</code></pre>}
                    </div>
                  ))}
                </div>
              </section>

              {/* 05 Adopters */}
              <section className="section" id="adopters">
                <header className="sec-head">
                  <span className="sec-num">05</span>
                  <h2 className="sec-title">{t.adoptersTitle} <code>: WhoUses</code></h2>
                  <p className="sec-desc">{t.adoptersDesc}</p>
                </header>
                <div className="adopter-grid">
                  {detail.adopters.map((a, i) => {
                    const inner = (
                      <>
                        <div className="adopter-name">{a.name}</div>
                        <div className="adopter-note">{lang === 'zh' ? a.zhNote : a.enNote}</div>
                      </>
                    );
                    return a.href ? (
                      <a key={i} href={a.href} target="_blank" rel="noopener noreferrer" className={`adopter-card${a.highlight ? ' is-highlight' : ''}`}>
                        {inner}
                      </a>
                    ) : (
                      <div key={i} className={`adopter-card${a.highlight ? ' is-highlight' : ''}`}>{inner}</div>
                    );
                  })}
                </div>
              </section>

              {/* 06 Cuberoot */}
              <section className="section" id="cuberoot">
                <header className="sec-head">
                  <span className="sec-num">06</span>
                  <h2 className="sec-title"><L zh="它在 cuberoot.me 上做什么" en="What it does on cuberoot.me" /></h2>
                  <p className="sec-desc">{t.role}</p>
                </header>
                <div className="stack-intro-prose stack-prose-wide stack-prose-quote">
                  {(i18n.language.startsWith('zh') ? detail.cuberoot.zh : detail.cuberoot.en)}
                </div>
              </section>

              {/* 07 Outlook */}
              <section className="section" id="outlook">
                <header className="sec-head">
                  <span className="sec-num">07</span>
                  <h2 className="sec-title">{t.outlookTitle} <code>: TheRoadAhead</code></h2>
                  <p className="sec-desc">{t.outlookDesc}</p>
                </header>
                <div className="future-grid">
                  {detail.outlook.map((card, i) => (
                    <article className={`future-card${card.hot ? ' hot' : ''}${card.big ? ' big' : ''}`} key={i}>
                      <div className="future-tag">{card.tag}</div>
                      <h3 className="future-title">{card[lang].title}</h3>
                      <div className="future-body">{card[lang].body}</div>
                    </article>
                  ))}
                </div>
              </section>

              {detail.links.length > 0 && (
                <section className="section stack-links-section">
                  <header className="sec-head">
                    <span className="sec-num">08</span>
                    <h2 className="sec-title"><L zh="链接" en="Links" /></h2>
                  </header>
                  <ul className="stack-links-list">
                    {detail.links.map((l) => (
                      <li key={l.href}>
                        <a href={l.href} target="_blank" rel="noopener noreferrer">
                          <span>{l.label}</span>
                          <span className="stack-link-host">{(() => {
                            try { return new URL(l.href).host; } catch { return ''; }
                          })()}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          ) : (
            <section className="section" style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--mono)', fontSize: 13, letterSpacing: '.15em' }}>LOADING…</span>
            </section>
          )}
        </main>

        <nav className="stack-pager">
          {prev ? (
            <Link href={`${base}/${prev.slug}`} className="stack-pager-link prev">
              <span className="stack-pager-dir">← {tr({ zh: '上一件', en: 'prev' })}</span>
              <span className="stack-pager-name">{prev.name}</span>
            </Link>
          ) : <span />}
          {next ? (
            <Link href={`${base}/${next.slug}`} className="stack-pager-link next">
              <span className="stack-pager-dir">{tr({ zh: '下一件', en: 'next' })} →</span>
              <span className="stack-pager-name">{next.name}</span>
            </Link>
          ) : <span />}
        </nav>

        <footer className="stack-foot">
          <Link href={base}>{base}</Link>
          <span>·</span>
          <Link href="/code">/code</Link>
          <span>·</span>
          <Link href="/">CubeRoot</Link>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
