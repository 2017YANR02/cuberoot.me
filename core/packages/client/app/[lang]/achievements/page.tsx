'use client';

import {
  ArrowRight,
  Binary,
  Box,
  ChartNoAxesColumnIncreasing,
  Database,
  GitBranch,
  ScanSearch,
  Timer,
  type LucideIcon,
} from '@app-foundation/icons/lucide';
import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { ALL_PUZZLE_TYPE_OPTIONS } from '../sim/puzzleOptions';
import { EnginePuzzleSVG } from '@/components/EnginePuzzleSVG';
import LazyVisible from '@/components/LazyVisible';
import Link from '@/components/AppLink';
import PageBackLink from '@/components/PageBackLink';
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

interface WorkLink {
  href: string;
  label: Bi;
}

interface WorkGroup {
  title: Bi;
  items: WorkLink[];
}

const solverLink = (event: string, zh: string, en: string): WorkLink => ({
  href: `/scramble/solver?event=${event}`,
  label: { zh, en },
});

const simulatorNames = new Map(ALL_PUZZLE_TYPE_OPTIONS.map(option => [
  option.value, { zh: option.labelZh, en: option.labelEn },
]));

function simLink(puzzle: string): WorkLink {
  const label = simulatorNames.get(puzzle === '3' ? 'nxn' : puzzle);
  if (!label) throw new Error(`Unknown simulator puzzle: ${puzzle}`);
  return { href: `/sim?puzzle=${puzzle}`, label };
}

const SOLVER_GROUPS: WorkGroup[] = [
  {
    title: { zh: 'WCA 与经典项目', en: 'WCA and classic puzzles' },
    items: [
      solverLink('333', '三阶', '3×3'),
      solverLink('222', '二阶', '2×2'),
      solverLink('sq1', 'SQ1', 'Square-1'),
      solverLink('clock', '魔表', 'Clock'),
      solverLink('skewb', '斜转', 'Skewb'),
      solverLink('pyram', '金字塔', 'Pyraminx'),
    ],
  },
  {
    title: { zh: '全枚举与精确表', en: 'Full enumeration and exact tables' },
    items: [
      solverLink('ivy', '枫叶', 'Ivy'),
      solverLink('133', '133', '1×3×3 Floppy'),
      solverLink('sfl', '超级133', 'Super Floppy'),
      solverLink('ufo', 'UFO', 'UFO'),
      solverLink('cm2', 'Cmetrick Mini', 'Cmetrick Mini'),
      solverLink('dmd', '钻石', 'Skewb Diamond'),
      solverLink('gear', '齿轮魔方', 'Gear Cube'),
      solverLink('8p', '八数码', '8-puzzle'),
      solverLink('15p', '十五数码', '15-puzzle'),
      solverLink('bic', 'Bicube', 'Bicube'),
      solverLink('sia222', '连体二阶', 'Siamese 2×2×2'),
    ],
  },
  {
    title: { zh: '长方体与耦合结构', en: 'Cuboids and coupled structures' },
    items: [
      solverLink('223', '2×2×3', '2×2×3'),
      solverLink('233', '2×3×3', '2×3×3'),
      solverLink('334', '3×3×4', '3×3×4'),
      solverLink('335', '3×3×5', '3×3×5'),
      solverLink('336', '3×3×6', '3×3×6'),
      solverLink('337', '3×3×7', '3×3×7'),
      solverLink('sia123', '连体 1×2×3', 'Siamese 1×2×3'),
    ],
  },
  {
    title: { zh: '异形与超大状态空间', en: 'Shape mods and vast state spaces' },
    items: [
      solverLink('sq2', 'Square-2', 'Square-2'),
      solverLink('ssq1', '四层 SSQ1', 'Super Square-1'),
      solverLink('bsq', 'Bandaged Square-1', 'Bandaged Square-1'),
      solverLink('cm3', 'Cmetrick', 'Cmetrick'),
      solverLink('heli', '直升机魔方', 'Helicopter Cube'),
      solverLink('helicv', '曲面直升机', 'Curvy Copter'),
      solverLink('ctico', 'Icosamate', 'Icosamate'),
      solverLink('mpyrso', '四阶金字塔', 'Master Pyraminx'),
      solverLink('dino', '恐龙魔方', 'Dino Cube'),
      solverLink('crz3a', '疯狂 3×3', 'Crazy 3×3'),
    ],
  },
];

const SIMULATOR_GROUPS: WorkGroup[] = [
  {
    title: { zh: '基础模型与自定义切割', en: 'Puzzle models and custom cuts' },
    items: [
      simLink('3'),
      simLink('custom'),
      simLink('sq1'),
      simLink('ivy'),
      simLink('pyraminx'),
      simLink('skewb'),
      simLink('megaminx'),
      simLink('clock'),
      { ...simLink('fto'), label: { zh: '转面八面体', en: 'FTO' } },
      simLink('dino'),
      simLink('redi'),
      simLink('rex'),
      simLink('heli'),
      simLink('gear'),
      simLink('mirror'),
      simLink('mirror2'),
    ],
  },
  {
    title: { zh: '立方体切割预设', en: 'Cubic cut presets' },
    items: [
      simLink('littlechop'),
      simLink('curvycopter'),
      simLink('masterskewb'),
      simLink('professorskewb'),
      simLink('compycube'),
    ],
  },
  {
    title: { zh: '四面体与八面体系列', en: 'Tetrahedral and octahedral families' },
    items: [
      simLink('pyramorphix'),
      simLink('mastermorphix'),
      simLink('tetraminx'),
      simLink('masterpyraminx'),
      simLink('mastertetraminx'),
      simLink('professorpyraminx'),
      simLink('professortetraminx'),
      simLink('royalpyraminx'),
      simLink('royaltetraminx'),
      simLink('emperorpyraminx'),
      simLink('emperortetraminx'),
      simLink('jingpyraminx'),
      simLink('skewbdiamond'),
      simLink('christophersjewel'),
      simLink('trajbersoctahedron'),
      simLink('masterpyramorphix'),
      { ...simLink('masterfto'), label: { zh: '四阶转面八面体', en: 'Master FTO' } },
      simLink('octastar'),
    ],
  },
  {
    title: { zh: '十二面体系列', en: 'Dodecahedral family' },
    items: [
      simLink('gigaminx'),
      simLink('teraminx'),
      simLink('petaminx'),
      simLink('examinx'),
      simLink('zetaminx'),
      simLink('yottaminx'),
      simLink('pentultimate'),
      simLink('starminx'),
      simLink('starminx2'),
      simLink('pyraminxcrystal'),
      simLink('bigchop'),
      simLink('masterpentultimate'),
      simLink('elitepentultimate'),
      simLink('chopasaurus'),
    ],
  },
  {
    title: { zh: '二十面体系列', en: 'Icosahedral family' },
    items: [
      simLink('eitansstar'),
      simLink('radiochop'),
      simLink('icosamate'),
      simLink('astrominx'),
      simLink('astrominxbigchop'),
      simLink('redicosahedron'),
      simLink('redicosahedroncenters'),
      simLink('icosaminx'),
    ],
  },
  {
    title: { zh: '组合切割', en: 'Combined cut systems' },
    items: [
      simLink('cube2dino'),
      simLink('cube2littlechop'),
      simLink('dinolittlechop'),
      simLink('cube2dinolittlechop'),
      simLink('starminxcombo'),
      simLink('megaminxchopasaurus'),
    ],
  },
];

const ACHIEVEMENTS: Achievement[] = [
  {
    Icon: GitBranch,
    eyebrow: { zh: '状态空间', en: 'STATE SPACES' },
    title: { zh: '完整展开 583,284 个 LSLL 情况', en: 'Mapping all 583,284 LSLL cases' },
    body: {
      zh: '按情况查找最后一槽与顶层的最优解，或练习两步还原。',
      en: 'Look up optimal solutions for the last slot and last layer, or practice solving them in two steps.',
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
      zh: '比较 WCA 比赛打乱的十字、F2L 等阶段难度，以及整解步数分布。',
      en: 'Compare stage difficulty and full-solve move counts across WCA competition scrambles.',
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
      zh: '逐步回放还原，对比同一打乱的不同解法和分段用时。',
      en: 'Replay a solve move by move and compare solutions and splits for the same scramble.',
    },
    links: [
      { href: '/recon', label: { zh: '进入复盘库', en: 'Enter the reconstruction archive' } },
      { href: '/recon-about', label: { zh: '了解复盘系统', en: 'How the system works' } },
    ],
  },
  {
    Icon: Database,
    eyebrow: { zh: '数据产品', en: 'DATA PRODUCTS' },
    title: { zh: '把 WCA 数据做成可以探索和判断的产品', en: 'Turning WCA data into products for exploration and decisions' },
    body: {
      zh: '查看选手成绩趋势、纪录排名和比赛晋级线。',
      en: 'Explore competitors’ results over time, records, rankings and qualification cutoffs.',
    },
    links: [
      { href: '/wca', label: { zh: '探索 WCA 数据', en: 'Explore WCA data' } },
      { href: '/wca/prediction', label: { zh: '查看比赛预测', en: 'View competition predictions' } },
    ],
  },
];

const AlgPlayer = dynamic(() => import('@/components/AlgPlayer'), { ssr: false });

const showcaseScramble = "R2 U' F L2 D B' R U2 F2 D' L B2 U R' F' L2 D2 B U2 R";
// Precomputed from the scrambled cubie state with the same solveCube used by the 3×3 solver.
const showcaseSolution = "B' D R' B R2 F2 U' L' D R U D' B2 D B2 R2 L2 D R2 B2";

function SolverShowcase() {
  return (
    <div className="achievement-showcase" data-site-surface="panel">
      <LazyVisible rootMargin="0px" minHeight={260} unmountWhenHidden>
        <AlgPlayer puzzle="3x3" set="" setup={showcaseScramble} alg={showcaseSolution} autoPlay loop
          moveDurationMs={650} size={210} controlMode="full" />
      </LazyVisible>
      <p>{tr({ zh: '打乱', en: 'Scramble' })} <code>{showcaseScramble}</code></p>
      <p>{tr({ zh: '两阶段求解器解法', en: 'Two-phase solver solution' })} <code>{showcaseSolution}</code>
      </p>
    </div>
  );
}

const showcasedModels = [
  { kind: 'sq1', alg: '(1,0)/' },
  { kind: 'pyraminx', alg: 'R U' },
  { kind: 'megaminx', alg: '' },
] as const;

function SimulatorShowcase() {
  return (
    <div className="achievement-showcase achievement-models" data-site-surface="panel">
      {showcasedModels.map(({ kind, alg }) => (
        <Link key={kind} href={`/sim?puzzle=${kind}`} prefetch={false}>
          <EnginePuzzleSVG kind={kind} alg={alg} size={144} />
          <span>{tr(simLink(kind).label)} <ArrowRight size={14} aria-hidden /></span>
        </Link>
      ))}
    </div>
  );
}

function FeaturedSystem({
  id,
  Icon,
  number,
  eyebrow,
  metric,
  metricLabel,
  title,
  intro,
  showcase,
  groups,
  actions,
}: {
  id: string;
  Icon: LucideIcon;
  number: string;
  eyebrow: Bi;
  metric: string;
  metricLabel: Bi;
  title: Bi;
  intro: Bi;
  showcase: ReactNode;
  groups: WorkGroup[];
  actions: WorkLink[];
}) {
  return (
    <section className="featured-system" aria-labelledby={id}>
      <div className="featured-system-heading">
        <div className="featured-system-label">
          <Icon size={23} strokeWidth={1.7} aria-hidden />
          <span>{number} / {tr(eyebrow)}</span>
        </div>
        <div className="featured-system-summary">
          <p className="featured-system-metric"><strong>{metric}</strong><span>{tr(metricLabel)}</span></p>
          <div>
            <h2 id={id}>{tr(title)}</h2>
            <p>{tr(intro)}</p>
          </div>
        </div>
      </div>

      {showcase}

      <div className="featured-work-groups">
        {groups.map((group) => (
          <section className="featured-work-group" key={group.title.en}>
            <h3>{tr(group.title)}</h3>
            <div className="featured-project-links">
              {group.items.map((item) => (
                <Link href={item.href} prefetch={false} key={item.href}>{tr(item.label)}</Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="achievement-links featured-system-actions">
        {actions.map((action) => (
          <Link href={action.href} prefetch={false} key={action.href}>
            {tr(action.label)}<ArrowRight size={15} aria-hidden />
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function AchievementsPage() {
  return (
    <main className="achievements-page">
      <header className="achievements-topbar">
        <PageBackLink className="achievements-home" />
        <span>{tr({ zh: '独立开发与原创研究', en: 'Independent development and original research' })}</span>
      </header>

      <section className="achievements-hero">
        <h1>{tr({ zh: '研究与开发成果', en: 'Research and development' })}</h1>
      </section>

      <div className="featured-systems">
        <FeaturedSystem
          id="solver-achievements"
          Icon={Binary}
          number="01"
          eyebrow={{ zh: '求解器系统', en: 'SOLVER SYSTEMS' }}
          metric="34"
          metricLabel={{ zh: '在线求解入口', en: 'live solver entries' }}
          title={{
            zh: '从 192 态到 10³³ 量级：为不同魔方造不同求解器',
            en: 'From 192 states to 10³³-scale spaces: a solver built for each puzzle',
          }}
          intro={{
            zh: '输入打乱或给魔方涂色，即可求解。每个项目都标明解法是最优、近最优还是有界解。',
            en: 'Enter a scramble or color the cube to solve it. Each puzzle identifies its solutions as optimal, near-optimal or bounded.',
          }}
          showcase={<SolverShowcase />}
          groups={SOLVER_GROUPS}
          actions={[
            { href: '/scramble/solver', label: { zh: '打开统一求解器', en: 'Open the unified solver' } },
            { href: '/dev/solvers', label: { zh: '查看算法与状态空间看板', en: 'Inspect algorithms and state spaces' } },
          ]}
        />

        <FeaturedSystem
          id="simulator-achievements"
          Icon={Box}
          number="02"
          eyebrow={{ zh: '模拟器系统', en: 'SIMULATOR SYSTEMS' }}
          metric="67"
          metricLabel={{ zh: '可直接打开的模型', en: 'directly playable models' }}
          title={{
            zh: '魔方模拟器：从立方体到二十面体',
            en: 'From one sticker to 67 models: an interactive simulation system built in-house',
          }}
          intro={{
            zh: '拖动模型转层、回放公式，或自定义切割。',
            en: 'Turn layers by dragging, replay algorithms or design your own cuts.',
          }}
          showcase={<SimulatorShowcase />}
          groups={SIMULATOR_GROUPS}
          actions={[
            { href: '/sim', label: { zh: '打开交互模拟器', en: 'Open the interactive simulator' } },
          ]}
        />
      </div>

      <section className="achievements-list" aria-labelledby="achievements-list-title">
        <div className="achievements-list-heading">
          <Timer size={16} aria-hidden />
          <h2 id="achievements-list-title">{tr({ zh: '更多成果', en: 'MORE WORK' })}</h2>
        </div>
        {ACHIEVEMENTS.map(({ Icon, eyebrow, title, body, links }, index) => (
          <article className="achievement-row" key={title.en}>
            <div className="achievement-row-heading">
              <Icon size={22} strokeWidth={1.7} aria-hidden />
              <span>0{index + 3} / {tr(eyebrow)}</span>
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
        <Link href="/dev/architecture" prefetch={false}>
          {tr({ zh: '阅读开发历程', en: 'Read the development history' })}<ArrowRight size={15} aria-hidden />
        </Link>
      </footer>
    </main>
  );
}
