'use client';

import {
  ArrowRight,
  Binary,
  Box,
  ChartNoAxesColumnIncreasing,
  ChevronLeft,
  Database,
  GitBranch,
  ScanSearch,
  Sparkles,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import Link from '@/components/AppLink';
import HomeLink from '@/components/HomeLink';
import { tr } from '@/i18n/tr';
import './achievements.css';

type Bi = { zh: string; en: string };

interface Achievement {
  Icon: LucideIcon;
  eyebrow: Bi;
  title: Bi;
  body: Bi;
  links: { href: string; label: Bi }[];
}

const PROOF_CHAIN: { label: Bi; detail: Bi }[] = [
  { label: { zh: '状态', en: 'State' }, detail: { zh: '描述魔方', en: 'Model it' } },
  { label: { zh: '搜索', en: 'Search' }, detail: { zh: '穿过空间', en: 'Explore it' } },
  { label: { zh: '证明', en: 'Prove' }, detail: { zh: '锁定最优', en: 'Prove optimality' } },
  { label: { zh: '交互', en: 'Interact' }, detail: { zh: '交到手上', en: 'Put it in hand' } },
];

const ACHIEVEMENTS: Achievement[] = [
  {
    Icon: Binary,
    eyebrow: { zh: '求解引擎', en: 'SOLVING ENGINES' },
    title: { zh: '让 28 类魔方和异形在网页里直接求解', en: 'Solving 28 puzzles and shape mods directly in the browser' },
    body: {
      zh: '从二阶、斜转、金字塔、SQ1、魔表到长方体与异形，统一支持输入打乱或照着实物涂状态。能证明最短的就给可证最优解；空间过大的项目明确标注近最优或有界解，不把启发式结果冒充最优。',
      en: 'From 2×2, Skewb, Pyraminx, Square-1 and Clock to cuboids and shape mods, one interface accepts a scramble or a painted physical state. Results are labelled honestly: provably optimal where possible, and near-optimal or bounded where the space is larger.',
    },
    links: [
      { href: '/scramble/solver', label: { zh: '打开魔方求解器', en: 'Open the puzzle solver' } },
      { href: '/dev/solvers', label: { zh: '查看求解器舰队', en: 'Inspect the solver fleet' } },
    ],
  },
  {
    Icon: GitBranch,
    eyebrow: { zh: '状态空间', en: 'STATE SPACES' },
    title: { zh: '完整展开 583,284 个 LSLL 情况', en: 'Mapping all 583,284 LSLL cases' },
    body: {
      zh: '把“最后一槽连同顶层一起解决”从一个概念做成完整系统：严格计数、等价类归一化、58 万级局面浏览、最优长度与公式、两步路线和可持续训练。数学推导与产品界面互相校验。',
      en: 'Last slot plus last layer became a complete system: exact counting, equivalence-class canonicalization, browsing across more than half a million states, optimal lengths and solutions, two-look routes, and practical training. The derivation and the product continuously cross-check each other.',
    },
    links: [
      { href: '/alg/lsll', label: { zh: '浏览 LSLL 公式集', en: 'Explore the LSLL set' } },
      { href: '/math/lsll', label: { zh: '阅读状态计数推导', en: 'Read the counting derivation' } },
    ],
  },
  {
    Icon: ChartNoAxesColumnIncreasing,
    eyebrow: { zh: '计算实验', en: 'COMPUTATIONAL STUDIES' },
    title: { zh: '把真实比赛打乱变成难度分布', en: 'Turning real competition scrambles into difficulty distributions' },
    body: {
      zh: '不只分析一条打乱，而是用同一套求解器批量计算 WCA 真实打乱语料，得到十字、F2L、EO、DR 等阶段难度，以及多个项目的整解最优步数分布。网页上的每张分布图背后都有可重复运行的数据管道。',
      en: 'The same engines run across the WCA’s real scramble corpus, not just one selected scramble. They produce distributions for Cross, F2L, EO and DR, plus optimal whole-solve lengths across multiple events. Every chart is backed by a repeatable data pipeline.',
    },
    links: [
      { href: '/scramble/stats', label: { zh: '查看打乱统计', en: 'View scramble statistics' } },
      { href: '/scramble/analyzer', label: { zh: '分析一条打乱', en: 'Analyse a scramble' } },
    ],
  },
  {
    Icon: ScanSearch,
    eyebrow: { zh: '复盘系统', en: 'RECONSTRUCTION SYSTEM' },
    title: { zh: '把一场还原保存成可比较的数据', en: 'Making every solve a comparable piece of data' },
    body: {
      zh: '复盘不再只是视频旁的一串公式：逐步播放、分阶段用时、STM、TPS、方法拆解、同轮 Ao5、同打乱对照、另解与讨论都连接在同一个数据模型里，也能从 WCA 成绩直接进入补录流程。',
      en: 'A reconstruction is more than an algorithm beside a video: move-by-move playback, splits, STM, TPS, method breakdown, round-level Ao5, same-scramble comparisons, alternative solutions and discussion all share one data model, linked directly from WCA results.',
    },
    links: [
      { href: '/recon', label: { zh: '进入复盘库', en: 'Enter the reconstruction archive' } },
      { href: '/recon-about', label: { zh: '了解复盘系统', en: 'How the system works' } },
    ],
  },
  {
    Icon: Box,
    eyebrow: { zh: '交互工具', en: 'INTERACTIVE TOOLS' },
    title: { zh: '同一套魔方模型，从 3D 模拟走到真实计时', en: 'One puzzle model, from 3D simulation to real solves' },
    body: {
      zh: '28 类可拖拽 3D 模拟器共享状态与公式语义，并延伸到逐步动画、键盘输入、触控操作、计时器和智能魔方连接。工具之间不是孤岛，同一种状态能被展示、操控、分析和训练。',
      en: 'Twenty-eight draggable 3D simulators share state and algorithm semantics, extending into step playback, keyboard input, touch interaction, the timer and smart-cube connections. The same state can be shown, manipulated, analysed and trained across tools.',
    },
    links: [
      { href: '/sim', label: { zh: '打开 3D 模拟器', en: 'Open the 3D simulator' } },
      { href: '/timer', label: { zh: '进入计时器', en: 'Open the timer' } },
    ],
  },
  {
    Icon: Database,
    eyebrow: { zh: '数据产品', en: 'DATA PRODUCTS' },
    title: { zh: '把 WCA 数据做成可以探索和判断的产品', en: 'Turning WCA data into products for exploration and decisions' },
    body: {
      zh: '从比赛中心、选手档案、纪录与排名，到成绩趋势、晋级线和比赛预测，CubeRoot 把分散的公开数据整理为紧密连接的页面，并持续维护统计构建、增量刷新和缓存契约。',
      en: 'Competition hubs, person profiles, records, rankings, result trends, qualification lines and predictions turn dispersed public data into connected experiences, supported by maintained statistics builds, incremental refreshes and explicit caching contracts.',
    },
    links: [
      { href: '/wca', label: { zh: '探索 WCA 数据', en: 'Explore WCA data' } },
      { href: '/wca/prediction', label: { zh: '查看比赛预测', en: 'View competition predictions' } },
    ],
  },
];

export default function AchievementsPage() {
  return (
    <main className="achievements-page">
      <header className="achievements-topbar">
        <HomeLink className="achievements-home" prefetch={false}>
          <ChevronLeft size={17} aria-hidden />
          {tr({ zh: '首页', en: 'Home' })}
        </HomeLink>
        <span>{tr({ zh: '独立开发与原创研究', en: 'Independent development and original research' })}</span>
      </header>

      <section className="achievements-hero">
        <p className="achievements-kicker"><Sparkles size={15} aria-hidden />{tr({ zh: '从 0 到 1', en: 'BUILT FROM ZERO' })}</p>
        <h1>{tr({ zh: '把想法做到可以使用、验证和继续生长。', en: 'Ideas made usable, verifiable, and ready to keep growing.' })}</h1>
        <p className="achievements-intro">{tr({
          zh: 'CubeRoot 不只是一个工具集合。这里沉淀的是我围绕魔方做出的求解算法、计算实验、交互系统与数据产品。下面每项成果都可以直接打开，亲手验证。',
          en: 'CubeRoot is more than a collection of tools. It is where I build solving algorithms, computational studies, interactive systems and data products around twisty puzzles. Every achievement below opens into something you can verify yourself.',
        })}</p>

        <div className="achievements-proof-chain" aria-label={tr({ zh: '计算成果链', en: 'Computational work chain' })}>
          {PROOF_CHAIN.map((step, index) => (
            <div className="achievements-proof-step" key={step.label.en}>
              <span className="achievements-proof-index">0{index + 1}</span>
              <strong>{tr(step.label)}</strong>
              <small>{tr(step.detail)}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="achievements-list" aria-labelledby="achievements-list-title">
        <div className="achievements-list-heading">
          <Timer size={16} aria-hidden />
          <h2 id="achievements-list-title">{tr({ zh: '代表成果', en: 'SELECTED WORK' })}</h2>
        </div>
        {ACHIEVEMENTS.map(({ Icon, eyebrow, title, body, links }, index) => (
          <article className="achievement-row" key={title.en}>
            <div className="achievement-row-heading">
              <Icon size={22} strokeWidth={1.7} aria-hidden />
              <span>0{index + 1} / {tr(eyebrow)}</span>
            </div>
            <div className="achievement-row-content">
              <h3>{tr(title)}</h3>
              <p>{tr(body)}</p>
              <div className="achievement-links">
                {links.map((link) => (
                  <Link href={link.href} prefetch={false} key={link.href}>
                    {tr(link.label)}<ArrowRight size={15} aria-hidden />
                  </Link>
                ))}
              </div>
            </div>
          </article>
        ))}
      </section>

      <footer className="achievements-closing">
        <p aria-hidden>∞</p>
        <div>
          <h2>{tr({ zh: '这不是终点，而是一份仍在增长的工作记录。', en: 'Not a finish line, but a record of work still growing.' })}</h2>
          <p>{tr({ zh: '想看这些系统怎样一步步形成，可以继续阅读 CubeRoot 的开发历程。', en: 'See how these systems were built and evolved in the CubeRoot development history.' })}</p>
          <Link href="/dev/architecture" prefetch={false}>
            {tr({ zh: '阅读开发历程', en: 'Read the development history' })}<ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </footer>
    </main>
  );
}
