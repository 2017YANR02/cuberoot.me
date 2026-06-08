'use client';

import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import HomeLink from '@/components/HomeLink';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
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
    href: '/code/stack',
    glyph: '◴',
    accent: '#7BD389',
    zh: {
      title: '技术栈',
      sub: 'The Stack',
      tagline: 'cuberoot.me 真正在用的 28 件软件, 一件一篇',
      meta: '28 件软件 · 前端 · 后端 · 边缘 · 开发',
    },
    en: {
      title: 'Stack',
      sub: 'The Stack',
      tagline: '28 pieces of software cuberoot.me actually uses, one page each',
      meta: '28 pieces · frontend · backend · edge · dev',
    },
  },
  {
    href: '/code/language',
    glyph: '{ }',
    accent: '#5BA8FF',
    zh: {
      title: '语言',
      sub: 'Programming Languages',
      tagline: '17 门编程语言的长篇导览。一门一篇深度, 含历史、特性、生态、当下处境',
      meta: '17 门语言 · 2 篇横向对比',
    },
    en: {
      title: 'Languages',
      sub: 'Long-form guides',
      tagline: 'Long-form guides to 17 programming languages — history, features, ecosystem, current state, one page each',
      meta: '17 languages · 2 cross-comparisons',
    },
  },
  {
    href: '/code/algorithms',
    glyph: 'Σ',
    accent: '#E879A6',
    zh: {
      title: '算法',
      sub: 'Algorithms',
      tagline: 'CubeRoot 站内真正在跑的核心算法:IDA* + 剪枝表、Kociemba 二阶段、min2phase、自研 CFOP 多阶段求解器,带数学建模和大样本统计',
      meta: '4 篇深度 · 状态空间搜索 · 240 万样本',
    },
    en: {
      title: 'Algorithms',
      sub: 'Core algorithms',
      tagline: 'The algorithms actually running inside CubeRoot: IDA* with pruning tables, Kociemba two-phase, min2phase, and a self-built CFOP multi-stage solver — with full math modeling and 2.4M-sample statistics',
      meta: '4 deep dives · state-space search · 2.4M samples',
    },
  },
  {
    href: '/code/solvers',
    glyph: '◈',
    accent: '#2DD4BF',
    zh: {
      title: '求解器',
      sub: 'Solver Fleet',
      tagline: '魔方分阶段求解器舰队:本机原生分析器与浏览器 WASM 的回填进度、吞吐、内存占用',
      meta: '7 原生分析器 / ~34GB 表 / 静态快照',
    },
    en: {
      title: 'Solvers',
      sub: 'Solver Fleet',
      tagline: 'The staged cube-solver fleet: native analyzers and browser WASM — backfill coverage, throughput, memory',
      meta: '7 native analyzers / ~34GB tables / snapshot',
    },
  },
  {
    href: '/code/traffic',
    glyph: '↗',
    accent: '#F0A04B',
    zh: {
      title: '流量',
      sub: 'Site Traffic',
      tagline: '站内访问统计:PV/UV 时间线、热门路径、来源、国家分布。数据自己采,无第三方追踪',
      meta: 'PV/UV · 4 维度 · 90 天滚存',
    },
    en: {
      title: 'Traffic',
      sub: 'Self-hosted Analytics',
      tagline: 'Site traffic: PV/UV timeline, top paths, referrers, country breakdown. Collected in-house, no 3rd-party tracking',
      meta: 'PV/UV · 4 metrics · 90-day rolling',
    },
  },
  {
    href: '/code/ops',
    glyph: '~$',
    accent: '#A78BFA',
    zh: {
      title: '运维',
      sub: 'Ops Runbook',
      tagline: '日常维护命令的实战手册:DB 刷新、构建、部署、备份。每条命令带前置条件、耗时、踩坑',
      meta: '可复制 · 带 context · 持续增补',
    },
    en: {
      title: 'Ops',
      sub: 'Runbook',
      tagline: 'Hands-on commands for routine maintenance: DB refresh, builds, deploys, backups. Each with prereqs, runtime, gotchas',
      meta: 'Copyable · with context · always growing',
    },
  },
];

export default function CodeIndexPage() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = i18n.language.startsWith('zh') ? 'zh' : 'en';

  useDocumentTitle('代码', 'Code');

  return (
    <div className="code-index">
      <div className="code-index-bg" />

      <header className="code-index-head">
        <div className="code-index-topbar">
          <HomeLink className="code-index-back">
            ← {lang === 'zh' ? '回首页' : 'Home'}
          </HomeLink>
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
              href={c.href}
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
          <Link href="/">CubeRoot</Link>
        </div>
      </footer>
    </div>
  );
}
