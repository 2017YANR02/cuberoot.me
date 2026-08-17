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

interface WorkLink {
  href: string;
  label: Bi;
}

interface WorkGroup {
  title: Bi;
  detail: Bi;
  items: WorkLink[];
}

interface EngineStep {
  label: Bi;
  detail: Bi;
}

const solverLink = (event: string, zh: string, en: string): WorkLink => ({
  href: `/scramble/solver?event=${event}`,
  label: { zh, en },
});

const simLink = (puzzle: string, zh: string, en: string): WorkLink => ({
  href: `/sim?puzzle=${puzzle}`,
  label: { zh, en },
});

const PROOF_CHAIN: { label: Bi; detail: Bi }[] = [
  { label: { zh: '状态', en: 'State' }, detail: { zh: '描述魔方', en: 'Model it' } },
  { label: { zh: '搜索', en: 'Search' }, detail: { zh: '穿过空间', en: 'Explore it' } },
  { label: { zh: '证明', en: 'Prove' }, detail: { zh: '锁定最优', en: 'Prove optimality' } },
  { label: { zh: '交互', en: 'Interact' }, detail: { zh: '交到手上', en: 'Put it in hand' } },
];

const SOLVER_STEPS: EngineStep[] = [
  {
    label: { zh: '状态建模', en: 'State model' },
    detail: { zh: '排列、朝向、形状、轨道、奇偶与合法转动分别编码', en: 'Encode permutation, orientation, shape, orbits, parity and legal moves' },
  },
  {
    label: { zh: '搜索设计', en: 'Search design' },
    detail: { zh: '按空间规模选择 BFS、IDA*、PDB、两阶段或构造法', en: 'Choose BFS, IDA*, PDBs, two-phase search or constructive reduction by scale' },
  },
  {
    label: { zh: '质量证明', en: 'Quality proof' },
    detail: { zh: '严格区分可证最优、近最优与有界解', en: 'Distinguish provably optimal, near-optimal and bounded solutions' },
  },
  {
    label: { zh: '产品交付', en: 'Product delivery' },
    detail: { zh: '打乱输入、涂色输入、二维预览、进度与中止全部接通', en: 'Ship scramble input, state painting, 2D previews, progress and cancellation' },
  },
];

const SOLVER_GROUPS: WorkGroup[] = [
  {
    title: { zh: 'WCA 与经典项目', en: 'WCA and classic puzzles' },
    detail: { zh: '把常见项目统一进同一入口，同时保留各自的状态规则与求解保证。', en: 'A single entry point that preserves each puzzle’s state rules and solution guarantees.' },
    items: [
      solverLink('333', '三阶', '3×3'),
      solverLink('222', '二阶', '2×2'),
      solverLink('sq1', 'Square-1', 'Square-1'),
      solverLink('clock', '魔表', 'Clock'),
      solverLink('skewb', '斜转', 'Skewb'),
      solverLink('pyram', '金字塔', 'Pyraminx'),
    ],
  },
  {
    title: { zh: '全枚举与精确表', en: 'Full enumeration and exact tables' },
    detail: { zh: '从 192 态到数百万态，完整遍历或离线精确表直接给出最短解。', en: 'From 192 states to millions, exhaustive traversal or offline exact tables return shortest solutions.' },
    items: [
      solverLink('ivy', '枫叶', 'Ivy'),
      solverLink('133', '1×3×3 Floppy', '1×3×3 Floppy'),
      solverLink('sfl', 'Super Floppy', 'Super Floppy'),
      solverLink('ufo', 'UFO', 'UFO'),
      solverLink('cm2', 'Cmetrick Mini', 'Cmetrick Mini'),
      solverLink('dmd', 'Skewb Diamond', 'Skewb Diamond'),
      solverLink('gear', '齿轮魔方', 'Gear Cube'),
      solverLink('8p', '八数码', '8-puzzle'),
      solverLink('15p', '十五数码', '15-puzzle'),
      solverLink('bic', 'Bicube', 'Bicube'),
      solverLink('sia222', '连体二阶', 'Siamese 2×2×2'),
    ],
  },
  {
    title: { zh: '长方体与耦合结构', en: 'Cuboids and coupled structures' },
    detail: { zh: '单独处理转动集合、形变阶段、轨道限制与连体块耦合。', en: 'Handle restricted move sets, shape-changing phases, piece orbits and coupled blocks explicitly.' },
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
    detail: { zh: '无法整表装下的空间改用分阶段、启发式数据库与构造归约，并公开解的边界。', en: 'Spaces too large for full tables use staged search, pattern databases and constructive reduction with explicit bounds.' },
    items: [
      solverLink('sq2', 'Square-2', 'Square-2'),
      solverLink('ssq1', 'Super Square-1', 'Super Square-1'),
      solverLink('bsq', 'Bandaged Square-1', 'Bandaged Square-1'),
      solverLink('cm3', 'Cmetrick', 'Cmetrick'),
      solverLink('heli', '直升机魔方', 'Helicopter Cube'),
      solverLink('helicv', '曲面直升机', 'Curvy Copter'),
      solverLink('ctico', 'Icosamate', 'Icosamate'),
      solverLink('mpyrso', '大金字塔', 'Master Pyraminx'),
      solverLink('dino', '恐龙魔方', 'Dino Cube'),
      solverLink('crz3a', 'Crazy 3×3', 'Crazy 3×3'),
    ],
  },
];

const SIMULATOR_STEPS: EngineStep[] = [
  {
    label: { zh: '几何生成', en: 'Geometry' },
    detail: { zh: '立方体、正多面体、曲面与任意多重切割从参数生成', en: 'Generate cubes, polyhedra, curved cuts and combined cuts from parameters' },
  },
  {
    label: { zh: '状态与动画', en: 'State and motion' },
    detail: { zh: '状态推进和转层动画使用同一套合法转动语义', en: 'State transitions and layer animation share the same legal-move semantics' },
  },
  {
    label: { zh: '真实交互', en: 'Interaction' },
    detail: { zh: '鼠标拖拽、触控、键盘、公式播放与视角控制全部可用', en: 'Support drag, touch, keyboard, algorithm playback and camera control' },
  },
  {
    label: { zh: '渲染工具链', en: 'Rendering tools' },
    detail: { zh: '贴片、内部结构、透明度、阶段遮罩、截图和矢量导出接入同一模型', en: 'Connect stickers, internals, opacity, stage masks, screenshots and vector export to one model' },
  },
];

const SIMULATOR_GROUPS: WorkGroup[] = [
  {
    title: { zh: '16 类主引擎入口', en: '16 first-class engine entries' },
    detail: { zh: '自研 Three.js、专用二维引擎与通用多面体渲染在一个模拟器中协作。', en: 'Custom Three.js, dedicated 2D and general polyhedral renderers work together in one simulator.' },
    items: [
      simLink('3', 'NxN 魔方', 'NxN Cube'),
      simLink('custom', '自定义切割', 'Puzzle Cuts'),
      simLink('sq1', 'Square-1', 'Square-1'),
      simLink('ivy', '枫叶', 'Ivy'),
      simLink('pyraminx', '金字塔', 'Pyraminx'),
      simLink('skewb', '斜转', 'Skewb'),
      simLink('megaminx', '五魔方', 'Megaminx'),
      simLink('clock', '魔表', 'Clock'),
      simLink('fto', 'FTO', 'FTO'),
      simLink('dino', '恐龙魔方', 'Dino Cube'),
      simLink('redi', 'Redi Cube', 'Redi Cube'),
      simLink('rex', 'Rex Cube', 'Rex Cube'),
      simLink('heli', '直升机魔方', 'Helicopter Cube'),
      simLink('gear', '齿轮魔方', 'Gear Cube'),
      simLink('mirror', '三阶镜面', 'Mirror 3×3'),
      simLink('mirror2', '二阶镜面', 'Mirror 2×2'),
    ],
  },
  {
    title: { zh: '立方体切割预设', en: 'Cubic cut presets' },
    detail: { zh: '棱切、角切和多层角切由同一个几何描述系统生成。', en: 'Edge cuts, vertex cuts and layered vertex cuts come from one geometry description system.' },
    items: [
      simLink('littlechop', '小切', 'Little Chop'),
      simLink('curvycopter', '曲面直升机', 'Curvy Copter'),
      simLink('compycube', 'Compy Cube', 'Compy Cube'),
      simLink('masterskewb', '大斜转', 'Master Skewb'),
      simLink('professorskewb', '教授斜转', 'Professor Skewb'),
    ],
  },
  {
    title: { zh: '四面体与八面体系列', en: 'Tetrahedral and octahedral families' },
    detail: { zh: '从魔金到帝王金字塔，从 Master FTO 到 Octastar，切割层级可持续扩展。', en: 'From Pyramorphix to Emperor Pyraminx, and Master FTO to Octastar, cut layers scale continuously.' },
    items: [
      simLink('pyramorphix', '魔金', 'Pyramorphix'),
      simLink('mastermorphix', '大魔金', 'Mastermorphix'),
      simLink('masterpyramorphix', 'Master Pyramorphix', 'Master Pyramorphix'),
      simLink('tetraminx', 'Tetraminx', 'Tetraminx'),
      simLink('masterpyraminx', '大金字塔', 'Master Pyraminx'),
      simLink('mastertetraminx', 'Master Tetraminx', 'Master Tetraminx'),
      simLink('professorpyraminx', '教授金字塔', 'Professor Pyraminx'),
      simLink('professortetraminx', 'Professor Tetraminx', 'Professor Tetraminx'),
      simLink('royalpyraminx', '皇家金字塔', 'Royal Pyraminx'),
      simLink('royaltetraminx', 'Royal Tetraminx', 'Royal Tetraminx'),
      simLink('emperorpyraminx', '帝王金字塔', 'Emperor Pyraminx'),
      simLink('emperortetraminx', 'Emperor Tetraminx', 'Emperor Tetraminx'),
      simLink('jingpyraminx', 'Jing Pyraminx', 'Jing Pyraminx'),
      simLink('masterfto', 'Master FTO', 'Master FTO'),
      simLink('skewbdiamond', 'Skewb Diamond', 'Skewb Diamond'),
      simLink('christophersjewel', "Christopher's Jewel", "Christopher's Jewel"),
      simLink('octastar', 'Octastar', 'Octastar'),
      simLink('trajbersoctahedron', 'Trajber 八面体', "Trajber's Octahedron"),
    ],
  },
  {
    title: { zh: '十二面体系列', en: 'Dodecahedral family' },
    detail: { zh: '从 Gigaminx 一直生成到 Yottaminx，并覆盖 Pentultimate、Starminx 与复合切割。', en: 'Generate the family from Gigaminx through Yottaminx, plus Pentultimate, Starminx and related cuts.' },
    items: [
      simLink('gigaminx', 'Gigaminx', 'Gigaminx'),
      simLink('teraminx', 'Teraminx', 'Teraminx'),
      simLink('petaminx', 'Petaminx', 'Petaminx'),
      simLink('examinx', 'Examinx', 'Examinx'),
      simLink('zetaminx', 'Zetaminx', 'Zetaminx'),
      simLink('yottaminx', 'Yottaminx', 'Yottaminx'),
      simLink('pentultimate', 'Pentultimate', 'Pentultimate'),
      simLink('masterpentultimate', 'Master Pentultimate', 'Master Pentultimate'),
      simLink('elitepentultimate', 'Elite Pentultimate', 'Elite Pentultimate'),
      simLink('starminx', 'Starminx', 'Starminx'),
      simLink('starminx2', 'Starminx 2', 'Starminx 2'),
      simLink('pyraminxcrystal', 'Pyraminx Crystal', 'Pyraminx Crystal'),
      simLink('chopasaurus', 'Chopasaurus', 'Chopasaurus'),
      simLink('bigchop', '大切', 'Big Chop'),
    ],
  },
  {
    title: { zh: '二十面体系列', en: 'Icosahedral family' },
    detail: { zh: '把二十面体的面切、角切与组合切割做成可拖动、可播放的模型。', en: 'Turn face, vertex and combined icosahedral cuts into draggable, playable models.' },
    items: [
      simLink('radiochop', 'Radio Chop', 'Radio Chop'),
      simLink('icosamate', 'Icosamate', 'Icosamate'),
      simLink('astrominx', 'Astrominx', 'Astrominx'),
      simLink('astrominxbigchop', 'Astrominx + Big Chop', 'Astrominx + Big Chop'),
      simLink('redicosahedron', 'Redicosahedron', 'Redicosahedron'),
      simLink('redicosahedroncenters', 'Redicosahedron + 中心', 'Redicosahedron + Centers'),
      simLink('icosaminx', 'Icosaminx', 'Icosaminx'),
      simLink('eitansstar', "Eitan's Star", "Eitan's Star"),
    ],
  },
  {
    title: { zh: '多切割组合', en: 'Combined cut systems' },
    detail: { zh: '不同切割规则可以叠加，不必为每个新异形重写整套渲染器。', en: 'Different cut systems compose without rebuilding an entire renderer for every new shape mod.' },
    items: [
      simLink('cube2dino', '2×2 + Dino', '2×2 + Dino'),
      simLink('cube2littlechop', '2×2 + 小切', '2×2 + Little Chop'),
      simLink('dinolittlechop', 'Dino + 小切', 'Dino + Little Chop'),
      simLink('cube2dinolittlechop', '2×2 + Dino + 小切', '2×2 + Dino + Little Chop'),
      simLink('megaminxchopasaurus', 'Megaminx + Chopasaurus', 'Megaminx + Chopasaurus'),
      simLink('starminxcombo', 'Starminx Combo', 'Starminx Combo'),
    ],
  },
];

const ACHIEVEMENTS: Achievement[] = [
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

function FeaturedSystem({
  id,
  Icon,
  number,
  eyebrow,
  metric,
  metricLabel,
  title,
  intro,
  steps,
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
  steps: EngineStep[];
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

      <div className="featured-engine-map">
        {steps.map((step, index) => (
          <div className="featured-engine-step" key={step.label.en}>
            <span>0{index + 1}</span>
            <strong>{tr(step.label)}</strong>
            <p>{tr(step.detail)}</p>
          </div>
        ))}
      </div>

      <div className="featured-work-groups">
        {groups.map((group) => (
          <section className="featured-work-group" key={group.title.en}>
            <div>
              <h3>{tr(group.title)}</h3>
              <p>{tr(group.detail)}</p>
            </div>
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

      <div className="featured-systems">
        <FeaturedSystem
          id="solver-achievements"
          Icon={Binary}
          number="01"
          eyebrow={{ zh: '求解器系统', en: 'SOLVER SYSTEMS' }}
          metric="34"
          metricLabel={{ zh: '个在线求解入口', en: 'live solver entries' }}
          title={{
            zh: '从 192 态到 10³³ 量级：为不同魔方造不同求解器',
            en: 'From 192 states to 10³³-scale spaces: a solver built for each puzzle',
          }}
          intro={{
            zh: '统一入口已经覆盖 34 个项目。这不是给 34 个页面套同一个外壳：每个项目都有自己的状态编码、合法性检查、搜索策略、质量标注与二维预览。能证明最短的写“最优”；做不到全局证明的，明确写“近最优”或“有界”。',
            en: 'The unified solver now covers 34 puzzles. These are not 34 skins around one routine: each has its own state encoding, legality checks, search strategy, quality label and 2D preview. A result is called optimal only when it can be proved; otherwise it is explicitly marked near-optimal or bounded.',
          }}
          steps={SOLVER_STEPS}
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
          metricLabel={{ zh: '个可直接打开的模型', en: 'directly playable models' }}
          title={{
            zh: '从一颗贴片到 67 个模型：自研可交互模拟引擎',
            en: 'From one sticker to 67 models: an interactive simulation system built in-house',
          }}
          intro={{
            zh: '模拟器选择器现有 16 类主入口和 51 个多面体切割预设。背后不只是“显示一个 3D 魔方”，而是几何生成、状态推进、转层动画、拖拽判定、公式回放、触控适配与图像导出的一整套引擎。',
            en: 'The simulator picker contains 16 first-class entries and 51 polyhedral cut presets. Behind them is more than a 3D display: geometry generation, state transitions, layer animation, drag recognition, algorithm playback, touch support and image export form one integrated engine.',
          }}
          steps={SIMULATOR_STEPS}
          groups={SIMULATOR_GROUPS}
          actions={[
            { href: '/sim', label: { zh: '打开交互模拟器', en: 'Open the interactive simulator' } },
            { href: '/sim/stages', label: { zh: '查看阶段与遮罩演示', en: 'Explore stages and masks' } },
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
