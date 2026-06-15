'use client';

import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import HomeLink from '@/components/HomeLink';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './code_index.css';
import i18n from '@/i18n/i18n-client';
import { tr } from '@/i18n/tr';

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
    href: '/code/llm',
    glyph: '✦',
    accent: '#D97757',
    zh: {
      title: '大模型',
      sub: 'Large Language Models',
      tagline: '驱动 CubeRoot 日常开发的大语言模型:对话/工具/代码 LLM Claude、官方 CLI agent Claude Code,以及 Anthropic 最强的 Claude Fable 5',
      meta: 'Claude · Claude Code · Fable 5',
    },
    en: {
      title: 'LLMs',
      sub: 'Large Language Models',
      tagline: 'The large language models behind CubeRoot’s day-to-day development: Claude, the official CLI agent Claude Code, and Anthropic’s most capable Claude Fable 5',
      meta: 'Claude · Claude Code · Fable 5',
    },
  },
  {
    href: '/code/components',
    glyph: '⊞',
    accent: '#4FC3DC',
    zh: {
      title: '组件库',
      sub: 'Component Library',
      tagline: 'cuberoot.me 自有可复用 UI 组件的集中查阅页:开关、按钮、选择器、徽章、图标,能独立演示的带实时预览加照抄即用的 import',
      meta: '实时预览 · 一处登记 · 持续增补',
    },
    en: {
      title: 'Components',
      sub: 'Component Library',
      tagline: 'A browsable catalog of cuberoot.me’s own reusable UI components: toggles, buttons, pickers, badges, icons — with live previews and copy-paste imports for the self-contained ones',
      meta: 'Live previews · one registry · always growing',
    },
  },
  {
    href: '/code/tokens',
    glyph: '◐',
    accent: '#E0B341',
    zh: {
      title: '设计令牌',
      sub: 'Design Tokens',
      tagline: '全站配色的单一来源:背景 / 文字 / 品牌 / 状态 / 边框令牌,每个亮暗双主题并排,衍生色一律 color-mix。写 CSS 取色照着来,禁硬码灰阶',
      meta: '17 令牌 · 亮 / 暗并排 · color-mix',
    },
    en: {
      title: 'Tokens',
      sub: 'Design Tokens',
      tagline: 'The single source for every color on the site: surface, text, brand, signal and border tokens shown side by side in light and dark, with color-mix derivation. Pick from here — never hardcode greys',
      meta: '17 tokens · light / dark · color-mix',
    },
  },
  {
    href: '/code/fonts',
    glyph: 'Aa',
    accent: '#C58AF0',
    zh: {
      title: '字体',
      sub: 'Typography',
      tagline: '全站用到的每一款字体的集中速查:正文 Inter、等宽 Roboto Mono、衬线 Fraunces、计时器七段、打乱表 PDF 还原三件套。每款带真渲染样张、字重、用途、文件与许可',
      meta: '7 款自托管 · 全部样张 · 设计令牌',
    },
    en: {
      title: 'Fonts',
      sub: 'Typography',
      tagline: 'A quick reference for every font on the site: Inter for body, Roboto Mono for mono, Fraunces serif, the seven-segment timer face, and the three-font scramble-PDF parity set. Each with a live specimen, weights, usage, files and license',
      meta: '7 self-hosted · live specimens · design tokens',
    },
  },
  {
    href: '/code/utils',
    glyph: 'ƒ',
    accent: '#67C18E',
    zh: {
      title: '速查',
      sub: 'Hooks & Utils',
      tagline: 'cuberoot.me 自己的 6 个 React Hook 与一批 canonical 工具函数集中速查:i18n 文案、API 地址、WCA 成绩格式化、项目归一、配色常量。写新代码前先翻,别重复造轮子',
      meta: '6 Hooks · ~17 工具 · 一处登记',
    },
    en: {
      title: 'Utils',
      sub: 'Hooks & Utils',
      tagline: 'A quick-reference for cuberoot.me’s own 6 React hooks and canonical utility functions: i18n text, API URLs, WCA result formatting, event normalization, color constants. Skim before writing new code',
      meta: '6 hooks · ~17 utils · one registry',
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
  {
    href: '/code/wca-export',
    glyph: '⛁',
    accent: '#5BA8FF',
    zh: {
      title: 'WST 数据导出',
      sub: 'WCA Developer Export',
      tagline: 'WCA 每天发布的完整数据库快照:1982 年至今全部比赛/选手/成绩/轮次配置/打乱。站内所有 WCA 统计都从它离线构建',
      meta: '每日 · 22 表 · 离线管道源',
    },
    en: {
      title: 'WST Export',
      sub: 'WCA Developer Export',
      tagline: 'The full WCA database snapshot published daily: every comp / person / result / round config / scramble since 1982. Every WCA stat here is built offline from it',
      meta: 'Daily · 22 tables · pipeline source',
    },
  },
  {
    href: '/code/wcif',
    glyph: '◇',
    accent: '#4A90D9',
    zh: {
      title: 'WCIF',
      sub: 'WCA 比赛数据格式',
      tagline: 'WCA 比赛交换格式速查:两个端点、Competition/Person/Event/Round 对象、AttemptResult 编码,以及 CubeRoot 怎么用它',
      meta: '官方 spec v1.1 · 开发 / AI 速查',
    },
    en: {
      title: 'WCIF',
      sub: 'WCA Competition Format',
      tagline: 'Quick reference for the WCA Competition Interchange Format: endpoints, Competition/Person/Event/Round objects, AttemptResult encoding, how CubeRoot uses it',
      meta: 'Official spec v1.1 · dev / AI reference',
    },
  },
];

export default function CodeIndexPage() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = (i18n.language.startsWith('zh') ? 'zh' : 'en');

  useDocumentTitle('代码', 'Code');

  return (
    <div className="code-index">
      <div className="code-index-bg" />

      <header className="code-index-head">
        <div className="code-index-topbar">
          <HomeLink className="code-index-back">
            ← {tr({ zh: '回首页', en: 'Home'
            })}
          </HomeLink>
        </div>
        <h1 className="code-index-title">
          <span className="code-index-prefix">/</span>code
          <span className="code-index-cursor">_</span>
        </h1>
        <p className="code-index-sub">
          {tr({ zh: '代码相关的两条线:CubeRoot 这个站点本身是怎么搭的,以及一些写给爱好者看的编程语言长篇导览。', en: 'Two threads about code: how this site itself is built, and long-form guides to programming languages.'
        })}
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
