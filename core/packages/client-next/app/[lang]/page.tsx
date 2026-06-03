'use client';

/**
 * Site entrypoint — Landing page.
 * Ported from packages/client/src/pages/LandingPage.tsx.
 * NOTE: particle-canvas code dropped — SHOW_PARTICLES was already false upstream.
 */
import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import LandingCubeHero from '../_components/LandingCubeHero';
import { TEXTS, SECTIONS } from '@/lib/landing-sections';

// Below-the-fold widgets — dynamic to defer client hydrate / chunk fetch.
// Min-height placeholders match approximate rendered sizes to avoid layout
// shift on first paint.
const OngoingComps = dynamic(() => import('@/components/OngoingComps'), {
  loading: () => <div style={{ minHeight: 56 }} aria-hidden="true" />,
});
const DailyGod = dynamic(() => import('@/components/DailyGod'), {
  loading: () => <div style={{ minHeight: 40 }} aria-hidden="true" />,
});
import { useEffectiveTheme } from '@/lib/theme';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../landing.css';

export default function LandingPage() {
  // Landing tab title is just the brand, no page suffix — matches Vite's
  // static `<title>CubeRoot</title>` in index.html. Empty string args make
  // the hook short-circuit to BRAND only.
  useDocumentTitle('', '');
  const { i18n } = useTranslation();
  const effectiveTheme = useEffectiveTheme();
  // `mounted` flips on client after hydration; gates anything that differs
  // between SSR and CSR (theme-dependent logo src, hostname-based beian)
  // to avoid React #418 hydration mismatches.
  const [mounted, setMounted] = useState(false);
  const [showBeian, setShowBeian] = useState(false);

  useEffect(() => {
    setMounted(true);
    const h = window.location.hostname;
    setShowBeian(/(^|\.)cuberoot\.me$/i.test(h) || h === 'localhost' || h === '127.0.0.1');
  }, []);

  const lang: 'zh' | 'en' = i18n.language.startsWith('zh') ? 'zh' : 'en';

  const t = useCallback((key: keyof typeof TEXTS) => {
    return TEXTS[key][lang];
  }, [lang]);

  return (
    <div className="landing-page">
      <div className="brand-line">
        <img src={mounted && effectiveTheme === 'dark' ? '/icons/CubeRoot-dark.png' : '/icons/CubeRoot.png'} alt="" className="brand-logo" />
        <span className="brand-name">{t('brand')}</span>
      </div>
      <h1 className="landing-tagline">{t('tagline')}</h1>

      <DailyGod lang={lang} />
      <OngoingComps lang={lang} />

      {/* WCA full-width hero — top-level entry, not in any section */}
      <Link href="/wca" className="wca-hero" prefetch={false}>
        <img src="/icons/wca.svg" alt="WCA" className="wca-hero-logo" />
        <div className="wca-hero-meta">
          <div className="wca-hero-title">{lang === 'zh' ? 'WCA 统计' : 'WCA Statistics'}</div>
          <div className="wca-hero-sub">{lang === 'zh' ? '魔方世界所有数据切片 · 80+ 自动生成排名 · 周更' : 'Every slice of the cubing world · 80+ auto-generated rankings · updated weekly'}</div>
        </div>
        <div className="wca-hero-arrow" aria-hidden="true">→</div>
      </Link>

      <div className="cards-sections">
        {SECTIONS.map((sec) => (
          <section key={sec.id} id={`section-${sec.id}`} className="cards-section">
            <div className="section-header">
              <div className="section-eyebrow">{lang === 'zh' ? sec.eyebrow.zh : sec.eyebrow.en}</div>
              <h2 className="section-title-serif">{lang === 'zh' ? sec.title.zh : sec.title.en}</h2>
              <div className="section-sub">{lang === 'zh' ? sec.sub.zh : sec.sub.en}</div>
            </div>
            <div className="cards-container">
              {sec.cards.map((card) => {
                const iconSize = card.tier === 'hero-side' ? 36
                  : card.tier === 'medium' ? 34
                  : card.tier === 'utility' ? 22
                  : 30;
                const content = (
                  <>
                    <div className="card-icon">
                      {card.tier === 'hero'
                        ? <LandingCubeHero />
                        : card.iconImg
                          ? <img src={card.iconImg} alt={`${t(card.nameKey)} Logo`} className="cstimer-logo" />
                          : card.Icon
                            ? <card.Icon size={iconSize} strokeWidth={1.5} />
                            : null}
                    </div>
                    <div className="card-name">{t(card.nameKey)}</div>
                  </>
                );
                const className = `card tier-${card.tier}${card.comingSoon ? ' is-disabled' : ''}`;
                if (card.comingSoon) {
                  return (
                    <div key={card.id} className={className} id={`card-${card.id}`}
                      title={t('comingSoon')} aria-disabled="true" role="link">
                      {content}
                      <span className="coming-soon-badge">{t('comingSoon')}</span>
                    </div>
                  );
                }
                if (card.internal) {
                  return (
                    <Link key={card.id} href={card.href} className={className} id={`card-${card.id}`} prefetch={false}>
                      {content}
                    </Link>
                  );
                }
                return (
                  <a key={card.id} href={card.href} className={className} id={`card-${card.id}`}
                    target="_blank" rel="noopener noreferrer">
                    {content}
                  </a>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="footer">
        <Link href="/about" className="footer-about" prefetch={false}>{lang === 'zh' ? '关于' : 'About'}</Link>
        <a
          href="https://github.com/RuiminYan/cuberoot.me"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-github"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
          </svg>
          <span>GitHub</span>
        </a>
      </div>

      {showBeian && (
        <div className="beian">
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
            沪ICP备2025130431号
          </a>
          <span className="beian-sep">|</span>
          <a
            href="https://beian.mps.gov.cn/#/query/webSearch?code=31010902100930"
            target="_blank"
            rel="noopener noreferrer"
            className="beian-mps"
          >
            <img src="/beian-badge.png" alt="" width="14" height="14" />
            沪公网安备31010902100930号
          </a>
        </div>
      )}
    </div>
  );
}
