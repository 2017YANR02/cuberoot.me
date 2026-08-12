'use client';

/**
 * Site entrypoint — Landing page.
 * Ported from packages/client-vite/src/pages/LandingPage.tsx.
 * NOTE: particle-canvas code dropped — SHOW_PARTICLES was already false upstream.
 */
import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { Heart, Radio, Trophy, ListOrdered, LogIn, User, type LucideIcon } from 'lucide-react';
import Link from '@/components/AppLink';
import LangToggle from '@/components/LangToggle';
import { useTranslation } from 'react-i18next';
import { useAuthUser, nextQuery } from '@/lib/auth-store';
import LandingSearch from '@/components/LandingSearch';
import { TEXTS, SECTIONS, PRIMARY_CARDS, SEARCH_CARDS } from '@/lib/landing-sections';

// Below-the-fold widgets — dynamic to defer client hydrate / chunk fetch.
// Min-height placeholders match approximate rendered sizes to avoid layout
// shift on first paint.
const OngoingComps = dynamic(() => import('@/components/OngoingComps'), {
  loading: () => <div style={{ minHeight: 56 }} aria-hidden="true" />,
});
const RecentScrambles = dynamic(() => import('@/components/RecentScrambles'), {
  loading: () => <div style={{ minHeight: 40 }} aria-hidden="true" />,
});
const TodayRecon = dynamic(() => import('@/components/TodayRecon'), {
  loading: () => <div style={{ minHeight: 40 }} aria-hidden="true" />,
});
import { useEffectiveTheme } from '@/lib/theme';
import '../landing.css';
import { tr } from '@/i18n/tr';

// 原单张「WCA 统计」hero 拆成四张直达卡;统计卡保留 WCA 标志作品牌锚点,其余用 lucide 图标。
const WCA_ENTRIES: { href: string; zh: string; en: string; Icon?: LucideIcon; img?: string }[] = [
  { href: '/wca/comp',        zh: '比赛', en: 'Competitions', Icon: Radio },
  { href: '/wca/records',     zh: '纪录', en: 'Records',      Icon: Trophy },
  { href: '/wca/results',     zh: '排名', en: 'Rankings',     Icon: ListOrdered },
  { href: '/wca',             zh: '统计', en: 'Statistics',   img: '/icons/wca.svg' },
];

export default function LandingPage() {
  // Title is owned by page.tsx's generateMetadata (lib/page-meta.ts, key '').
  // The useDocumentTitle('', '') call that used to live here forced the tab back
  // to the bare brand after hydration, which would now overwrite that title.
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

  const lang: 'zh' | 'en' = (i18n.language.startsWith('zh') ? 'zh' : 'en');

  const t = useCallback((key: keyof typeof TEXTS) => TEXTS[key][lang], [lang]);

  // 右上角 登录 / 我的 入口,两态都是真链接、都指 /account(全站无登录弹层)。useAuthUser
  // 是 hydration-safe(SSG 首帧按未登录渲染,挂载后才切到已登录),避免 SSG/CSR 错配。
  const user = useAuthUser();
  const pathname = usePathname();
  // 已登录时右上角只保留头像(去掉名字);无头像退回 User 图标。
  const authInner = user && (
    user.avatar
      ? <img src={user.avatar} alt="" className="landing-auth-avatar" />
      : <User size={16} aria-hidden />
  );

  return (
    <div className="landing-page">
      <div className="landing-auth">
        <LangToggle />
        {!user ? (
          <Link href={`/account${nextQuery(pathname)}`} className="landing-auth-btn is-login" prefetch={false}>
            <LogIn size={16} aria-hidden />
            <span>{tr({ zh: '登录', en: 'Log in' })}</span>
          </Link>
        ) : (
          <Link
            href="/account"
            className="landing-auth-btn is-avatar"
            prefetch={false}
          >
            {authInner}
          </Link>
        )}
      </div>

      <div className="brand-line">
        <img src={mounted && effectiveTheme === 'dark' ? '/icons/CubeRoot-dark.png' : '/icons/CubeRoot.png'} alt="" className="brand-logo" />
        <span className="brand-name">{t('brand')}</span>
      </div>
      <LandingSearch cards={SEARCH_CARDS} lang={lang} />

      {/* 两行 hero 的共同外壳。桌面是 5 + 4 两个独立网格;手机端外壳自己变成 3 列网格、
          两个子网格 display:contents,9 张卡直接排成 3 行 3 个(见 landing.css)。 */}
      <div className="hero-grids">
        {/* 主入口 — 标语正下方,五张最常用直达卡(计时器 / 公式 / 模拟 / 复盘 / 打乱) */}
        <div className="primary-hero-grid">
          {PRIMARY_CARDS.map((c) => (
            <Link key={c.id} href={c.href} className="hero-card" id={`card-${c.id}`} prefetch={false}>
              <div className="hero-card-icon">
                {c.Icon ? <c.Icon size={30} strokeWidth={1.5} /> : null}
              </div>
              <div className="hero-card-name">{t(c.nameKey)}</div>
            </Link>
          ))}
        </div>

        {/* WCA 入口 — 紧接主入口,原单张「WCA 统计」hero 拆成四张直达卡:比赛 / 纪录 / 排名 / 统计 */}
        <div className="wca-hero-grid">
          {WCA_ENTRIES.map((e) => (
            <Link key={e.href} href={e.href} className="hero-card" prefetch={false}>
              <div className="hero-card-icon">
                {e.img
                  ? <img src={e.img} alt="WCA" className="hero-card-logo" />
                  : e.Icon
                    ? <e.Icon size={30} strokeWidth={1.5} />
                    : null}
              </div>
              <div className="hero-card-name">{tr({ zh: e.zh, en: e.en })}</div>
            </Link>
          ))}
        </div>
      </div>

      <RecentScrambles lang={lang} />
      <TodayRecon lang={lang} />

      <OngoingComps lang={lang} />

      <div className="cards-sections">
        {SECTIONS.map((sec) => (
          <section key={sec.id} id={`section-${sec.id}`} className="cards-section">
            <div className="section-header">
              <div className="section-eyebrow">{tr(sec.eyebrow)}</div>
              <h2 className="section-title-serif">{tr(sec.title)}</h2>
              <div className="section-sub">{tr(sec.sub)}</div>
            </div>
            <div className="cards-container">
              {sec.cards.map((card) => {
                const iconSize = card.tier === 'medium' ? 28
                  : card.tier === 'utility' ? 20
                  : 26;
                const content = (
                  <>
                    {(card.iconImg || card.Icon) && (
                      <div className="card-icon">
                        {card.iconImg
                          ? <img src={card.iconImg} alt={`${t(card.nameKey)} Logo`} className="card-logo" />
                          : card.Icon
                            ? <card.Icon size={iconSize} strokeWidth={1.5} />
                            : null}
                      </div>
                    )}
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
        <Link href="/about" className="footer-about" prefetch={false}>{tr({ zh: '关于', en: 'About'
        })}</Link>
        <Link href="/support" className="footer-credits" prefetch={false}>
          <Heart size={12} aria-hidden="true" />
          <span>{tr({ zh: '致谢', en: 'Acknowledgments'
        })}</span>
        </Link>
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
