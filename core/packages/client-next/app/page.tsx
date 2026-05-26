'use client';

/**
 * Site entrypoint — Landing page.
 * Ported from packages/client/src/pages/LandingPage.tsx.
 * NOTE: particle-canvas code dropped — SHOW_PARTICLES was already false upstream.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import {
  Film, ScanSearch,
  Swords, BookOpen,
  Shuffle, Library, BookMarked, BookA, Compass, Grid2x2, Heart, Trophy, Timer as TimerIcon,
  ImagePlus,
  Code as CodeIcon, Brain, Box,
  Sigma,
  type LucideIcon,
} from 'lucide-react';
import LandingCubeHero from './_components/LandingCubeHero';
import DonateModal from './_components/DonateModal';
import WcaAuth from '@/components/WcaAuth';
import ThemeToggle from '@/components/ThemeToggle';
import LangToggle from '@/components/LangToggle';
import LandingSearch, { type LandingSearchCard } from '@/components/LandingSearch';
import OngoingComps from '@/components/OngoingComps';
import RecentRecords from '@/components/RecentRecords';
import { useEffectiveTheme } from '@/lib/theme';
import './landing.css';

// i18n text map — bilingual mirror of the Vite original's TEXTS table.
const TEXTS: Record<string, { en: string; zh: string }> = {
  brand:           { en: 'CubeRoot', zh: 'CubeRoot' },
  tagline:         { en: 'Solve. Train. Analyze.', zh: '解法 · 训练 · 分析' },
  solver:          { en: 'or18 Solver', zh: 'or18 求解器' },
  wcaStats:        { en: 'WCA', zh: 'WCA' },
  recon:           { en: 'Recon', zh: '复盘' },
  algTrainer:      { en: 'mihlefeld Trainer', zh: 'mihlefeld 训练器' },
  cuberootTrainer: { en: 'Trainer', zh: '训练器' },
  hthGrapher:      { en: 'Calculator', zh: '计算器' },
  battle:          { en: 'Battle', zh: '对战' },
  viz:             { en: 'Distribution', zh: '分布' },
  upcoming:        { en: 'Calendar', zh: '日历' },
  globe:           { en: 'Globe', zh: '地球' },
  cstimer:         { en: 'csTimer', zh: 'csTimer' },
  timer:           { en: 'Timer', zh: '计时器' },
  frameCount:      { en: 'Frame Count', zh: '数帧' },
  scramble:        { en: 'Scramble', zh: '打乱' },
  alg:             { en: 'Tutorial',   zh: '教程' },
  algdb:           { en: 'Algorithms', zh: '公式' },
  wiki:            { en: 'Wiki', zh: 'Wiki' },
  sitesDirectory:  { en: 'Web', zh: '网站' },
  mosaic:          { en: 'Mosaic', zh: '马赛克' },
  worldBests:      { en: 'World Bests', zh: '非官方纪录' },
  blog:            { en: 'Blog', zh: '博客' },
  prediction:      { en: 'Prediction', zh: '预测' },
  visualcubeEditor:{ en: 'VisualCube', zh: '魔方可视化' },
  analyze:         { en: 'Analyzer', zh: '打乱分析' },
  gen:             { en: 'Scrambles', zh: '生成打乱' },
  memo:            { en: 'Memo', zh: '记忆' },
  code:            { en: 'Code', zh: '编程' },
  sim:             { en: 'Sim', zh: '模拟' },
  comp:            { en: 'Comp', zh: '比赛' },
  theoryGroup:     { en: 'Math', zh: '数学' },
  comingSoon:      { en: 'Coming soon', zh: '即将上线' },
  creditsPrefix:   { en: 'Inspired by', zh: '致谢' },
};

type Tier = 'hero' | 'hero-side' | 'medium' | 'standard' | 'utility';

interface CardConfig {
  id: string;
  href: string;
  internal: boolean;
  tier: Tier;
  Icon?: LucideIcon;
  iconImg?: string;
  nameKey: keyof typeof TEXTS;
  comingSoon?: boolean;
}

type I18n = { en: string; zh: string };
interface Section {
  id: string;
  eyebrow: I18n;
  title: I18n;
  sub: I18n;
  cards: CardConfig[];
}

const SECTIONS: Section[] = [
  {
    id: 'train',
    eyebrow: { en: 'TRAIN · 训练', zh: 'TRAIN · 训练' },
    title:   { en: 'Drill, time, refine.', zh: '练习、计时、复盘。' },
    sub:     { en: 'Drill algorithms, race the clock, battle head-to-head, recall image pairs.', zh: '背公式、计时、对战、记忆 — 把每一步打磨到肌肉记忆。' },
    cards: [
      { id: 'cuberoot', href: '/trainer',      internal: true, tier: 'hero',     nameKey: 'cuberootTrainer' },
      { id: 'timer',    href: '/timer',        internal: true, tier: 'standard', Icon: TimerIcon, nameKey: 'timer', comingSoon: true },
      { id: 'battle',   href: '/battle',       internal: true, tier: 'standard', Icon: Swords,    nameKey: 'battle' },
      { id: 'memo',     href: '/memo',         internal: true, tier: 'standard', Icon: Brain,     nameKey: 'memo' },
      { id: 'trainer',  href: '/alg-trainers', internal: true, tier: 'standard', iconImg: '/icons/upstream/algtrainer.png', nameKey: 'algTrainer' },
      { id: 'cstimer',  href: '/cstimer',      internal: true, tier: 'utility',  nameKey: 'cstimer', iconImg: '/cstimer_logo.png' },
    ],
  },
  {
    id: 'learn',
    eyebrow: { en: 'LEARN · 学习', zh: 'LEARN · 学习' },
    title:   { en: 'Methods and algorithms.', zh: '方法与公式。' },
    sub:     { en: 'CFOP tutorials and the full algorithm library — beginner method to ZBLL.', zh: 'CFOP 教程 + 多阶公式库 — 从入门法到 ZBLL 全套查阅。' },
    cards: [
      { id: 'alg',      href: '/tutorial', internal: true, tier: 'medium', Icon: Library,    nameKey: 'alg', comingSoon: true },
      { id: 'algdb',    href: '/alg',      internal: true, tier: 'medium', Icon: BookMarked, nameKey: 'algdb' },
      { id: 'wiki',     href: '/wiki',     internal: true, tier: 'medium', Icon: BookA,      nameKey: 'wiki' },
      { id: 'math-hub', href: '/math', internal: true, tier: 'medium', Icon: Sigma, nameKey: 'theoryGroup' },
    ],
  },
  {
    id: 'tool',
    eyebrow: { en: 'TOOL · 工具', zh: 'TOOL · 工具' },
    title:   { en: 'From scramble to solution.', zh: '从打乱到解法。' },
    sub:     { en: 'Recon, frame-count, visualizers, solvers — a tool for every step of the solve.', zh: '复盘、数帧、可视化、求解 — 每个解法环节都有专门工具。' },
    cards: [
      { id: 'recon',       href: '/recon',       internal: true, tier: 'medium', Icon: ScanSearch, nameKey: 'recon' },
      { id: 'frame-count', href: '/frame-count', internal: true, tier: 'medium', Icon: Film,       nameKey: 'frameCount' },
      { id: 'visualcube',  href: '/visualcube',  internal: true, tier: 'medium', Icon: ImagePlus,  nameKey: 'visualcubeEditor' },
      { id: 'scramble',    href: '/scramble',    internal: true, tier: 'medium', Icon: Shuffle,    nameKey: 'scramble' },
      { id: 'solver',      href: '/solver',      internal: true, tier: 'medium', iconImg: '/icons/upstream/solver.png', nameKey: 'solver' },
      { id: 'mosaic',      href: '/mosaic',      internal: true, tier: 'medium', Icon: Grid2x2,    nameKey: 'mosaic' },
      { id: 'sim',         href: '/sim',         internal: true, tier: 'medium', Icon: Box,        nameKey: 'sim' },
    ],
  },
  {
    id: 'other',
    eyebrow: { en: 'OTHER · 其他', zh: 'OTHER · 其他' },
    title:   { en: 'Read, code, explore.', zh: '阅读、编程、探索。' },
    sub:     { en: 'Code notes, blog, link directory, unofficial world records.', zh: '代码笔记、博客、链接导航、非官方纪录。' },
    cards: [
      { id: 'code', href: '/code',  internal: true,  tier: 'medium', Icon: CodeIcon, nameKey: 'code' },
      { id: 'blog', href: '/blog/', internal: false, tier: 'medium', Icon: BookOpen, nameKey: 'blog' },
      { id: 'site', href: '/site',  internal: true,  tier: 'medium', Icon: Compass,  nameKey: 'sitesDirectory' },
      { id: 'wb',   href: '/wb',    internal: true,  tier: 'medium', Icon: Trophy,   nameKey: 'worldBests' },
    ],
  },
];

// All cards (incl. WCA hero, sans coming-soon) flattened for LandingSearch.
const SEARCH_CARDS: LandingSearchCard[] = [
  { id: 'stats', href: '/wca', internal: true, nameEn: 'WCA', nameZh: 'WCA', sectionTitleEn: 'WCA', sectionTitleZh: 'WCA' },
  ...SECTIONS.flatMap(sec =>
    sec.cards
      .filter(c => !c.comingSoon)
      .map(c => ({
        id: c.id,
        href: c.href,
        internal: c.internal,
        nameEn: TEXTS[c.nameKey].en,
        nameZh: TEXTS[c.nameKey].zh,
        sectionTitleEn: sec.eyebrow.en,
        sectionTitleZh: sec.eyebrow.zh,
      })),
  ),
];

export default function LandingPage() {
  const { i18n } = useTranslation();
  const [donateOpen, setDonateOpen] = useState(false);
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

      <LandingSearch cards={SEARCH_CARDS} lang={lang} />
      <OngoingComps lang={lang} />
      <RecentRecords lang={lang} />

      {/* WCA full-width hero — top-level entry, not in any section */}
      <Link href="/wca" className="wca-hero">
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
                const iconSize = card.tier === 'hero-side' ? 32
                  : card.tier === 'medium' ? 28
                  : card.tier === 'utility' ? 20
                  : 24;
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
                    <Link key={card.id} href={card.href} className={className} id={`card-${card.id}`}>
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
        <Link href="/about" className="footer-about">{lang === 'zh' ? '关于' : 'About'}</Link>
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

        <button
          className="footer-donate"
          onClick={() => setDonateOpen(true)}
          title={lang === 'zh' ? '赞助' : 'Donate'}
        >
          <Heart size={14} strokeWidth={1.8} />
          <span>{lang === 'zh' ? '赞助' : 'Donate'}</span>
        </button>

        <WcaAuth />
        <LangToggle />
        <ThemeToggle />
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

      {donateOpen && <DonateModal lang={lang} onClose={() => setDonateOpen(false)} />}
    </div>
  );
}
