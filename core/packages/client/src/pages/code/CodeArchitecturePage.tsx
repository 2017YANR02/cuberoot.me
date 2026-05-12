import { useEffect, useContext, createContext } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LangToggle from '../../components/LangToggle';
import './code_architecture.css';

type Lang = 'zh' | 'en';
const LangCtx = createContext<Lang>('zh');
const useLang = () => useContext(LangCtx);

function L({ zh, en }: { zh: ReactNode; en: ReactNode }) {
  return <>{useLang() === 'zh' ? zh : en}</>;
}

// ─── SVG 1: 系统全景图 ────────────────────────────
function SystemTopoSVG() {
  return (
    <svg viewBox="0 0 880 480" className="diagram-svg" role="img" aria-label="System topology">
      <g className="d-box d-box-ext">
        <rect x="340" y="20" width="200" height="60" rx="6" />
        <text x="440" y="46" className="d-title">GitHub Actions</text>
        <text x="440" y="64" className="d-sub">CI · 周更 · deploy</text>
      </g>

      <g className="d-box d-box-ext">
        <rect x="80" y="400" width="180" height="60" rx="6" />
        <text x="170" y="426" className="d-title">WCA Public Dump</text>
        <text x="170" y="444" className="d-sub">每周 · .sql + .tsv</text>
      </g>

      <g className="d-box d-box-user">
        <rect x="20" y="200" width="180" height="80" rx="10" />
        <text x="110" y="230" className="d-title">User Browser</text>
        <text x="110" y="248" className="d-sub">Chrome / Safari / Edge</text>
        <text x="110" y="266" className="d-sub d-mono">cuberoot.me</text>
      </g>

      <g className="d-box d-box-server">
        <rect x="320" y="130" width="240" height="230" rx="10" />
        <text x="440" y="160" className="d-title d-title-lg">Cloud VM</text>
        <text x="440" y="180" className="d-sub d-mono">one box, three services</text>
        <line x1="340" y1="200" x2="540" y2="200" className="d-divider" />

        <g>
          <rect x="340" y="214" width="200" height="36" rx="4" className="d-inner d-inner-a" />
          <text x="440" y="237" className="d-inner-text">nginx <tspan className="d-port">:443</tspan></text>
        </g>
        <g>
          <rect x="340" y="258" width="200" height="36" rx="4" className="d-inner d-inner-b" />
          <text x="440" y="281" className="d-inner-text">Hono API <tspan className="d-port">:3001</tspan></text>
        </g>
        <g>
          <rect x="340" y="302" width="200" height="36" rx="4" className="d-inner d-inner-c" />
          <text x="440" y="325" className="d-inner-text">PostgreSQL 13 <tspan className="d-port">:5432</tspan></text>
        </g>
      </g>

      <g className="d-box d-box-ext">
        <rect x="680" y="200" width="180" height="80" rx="10" />
        <text x="770" y="230" className="d-title">GH Pages</text>
        <text x="770" y="248" className="d-sub">fallback mirror</text>
        <text x="770" y="266" className="d-sub d-mono">ruiminyan.github.io</text>
      </g>

      <g className="d-arrow d-arrow-hot">
        <line x1="200" y1="240" x2="320" y2="240" />
        <polygon points="320,240 312,236 312,244" />
        <text x="260" y="232" className="d-label">HTTPS</text>
      </g>

      <g className="d-arrow d-arrow-cold">
        <line x1="680" y1="240" x2="560" y2="240" />
        <polygon points="560,240 568,236 568,244" />
        <text x="620" y="232" className="d-label">301</text>
      </g>

      <g className="d-arrow d-arrow-cold">
        <line x1="440" y1="80" x2="440" y2="130" />
        <polygon points="440,130 436,122 444,122" />
        <text x="455" y="110" className="d-label">scp · ssh</text>
      </g>

      <g className="d-arrow d-arrow-cold">
        <line x1="200" y1="400" x2="380" y2="80" />
        <polygon points="380,80 372,80 376,86" />
        <text x="290" y="240" className="d-label" transform="rotate(-60 290 240)">pull weekly</text>
      </g>
    </svg>
  );
}

// ─── SVG 2: 包依赖图 ──────────────────────────────
function PackageDepsSVG() {
  return (
    <svg viewBox="0 0 760 320" className="diagram-svg" role="img" aria-label="Monorepo packages">
      <g className="d-pkg d-pkg-shared">
        <rect x="320" y="130" width="120" height="60" rx="8" />
        <text x="380" y="158" className="d-title">shared</text>
        <text x="380" y="176" className="d-sub d-mono">types only</text>
      </g>

      <g className="d-pkg d-pkg-app">
        <rect x="80" y="40" width="160" height="64" rx="8" />
        <text x="160" y="68" className="d-title">client</text>
        <text x="160" y="86" className="d-sub d-mono">React 19 + Vite</text>
      </g>

      <g className="d-pkg d-pkg-app">
        <rect x="80" y="220" width="160" height="64" rx="8" />
        <text x="160" y="248" className="d-title">server</text>
        <text x="160" y="266" className="d-sub d-mono">Hono + PG</text>
      </g>

      <g className="d-pkg d-pkg-app">
        <rect x="520" y="40" width="160" height="64" rx="8" />
        <text x="600" y="68" className="d-title">stats-ui</text>
        <text x="600" y="86" className="d-sub d-mono">consumed by client</text>
      </g>

      <g className="d-pkg d-pkg-iso">
        <rect x="520" y="220" width="160" height="64" rx="8" />
        <text x="600" y="248" className="d-title">stats-build</text>
        <text x="600" y="266" className="d-sub d-mono">CLI · 独立</text>
      </g>

      <g className="d-edge">
        <line x1="240" y1="86" x2="320" y2="146" />
        <polygon points="320,146 313,142 315,150" />
      </g>
      <g className="d-edge">
        <line x1="240" y1="240" x2="320" y2="172" />
        <polygon points="320,172 314,176 313,168" />
      </g>
      <g className="d-edge">
        <line x1="240" y1="72" x2="520" y2="72" />
        <polygon points="520,72 512,68 512,76" />
        <text x="380" y="62" className="d-edge-label">imports</text>
      </g>

      <text x="380" y="306" className="d-caption">
        client / server 都依赖 shared (纯类型) · stats-ui 被 client 引 · stats-build 独立 CLI
      </text>
    </svg>
  );
}

// ─── SVG 3: 请求生命周期 ─────────────────────────
function RequestLifecycleSVG() {
  const steps = [
    { x: 30,  label: 'click',      t: '0 ms' },
    { x: 150, label: 'JS handler', t: '~2 ms' },
    { x: 280, label: 'fetch()',    t: '~5 ms' },
    { x: 420, label: 'nginx',      t: '~15 ms' },
    { x: 540, label: 'Hono',       t: '~18 ms' },
    { x: 660, label: 'PG query',   t: '~25 ms' },
    { x: 790, label: 'JSON → DOM', t: '~40 ms' },
  ];
  return (
    <svg viewBox="0 0 880 200" className="diagram-svg" role="img" aria-label="Request lifecycle">
      <line x1="20" y1="100" x2="860" y2="100" className="d-axis" />
      <polygon points="860,100 850,95 850,105" className="d-axis-arrow" />
      {steps.map((s, i) => (
        <g key={i} className="d-step">
          <circle cx={s.x + 20} cy="100" r="7" />
          <line x1={s.x + 20} y1="100" x2={s.x + 20} y2={i % 2 === 0 ? 50 : 150} className="d-step-line" />
          <text x={s.x + 20} y={i % 2 === 0 ? 38 : 174} className="d-step-label">{s.label}</text>
          <text x={s.x + 20} y={i % 2 === 0 ? 22 : 190} className="d-step-time">{s.t}</text>
        </g>
      ))}
      <text x="20" y="194" className="d-caption">典型读请求 · 端到端 &lt; 50ms · 缓存命中 &lt; 10ms</text>
    </svg>
  );
}

// ─── SVG 4: WCA 统计管道流程 ─────────────────────
function StatsPipelineSVG() {
  const nodes = [
    { x: 20,  label: 'WCA dump',      sub: '每周公开',                tone: 'ext' },
    { x: 180, label: 'MySQL',         sub: '本机 :3306',              tone: 'work' },
    { x: 340, label: 'stats-build',   sub: '80+ SQL · 1 TS process',  tone: 'core' },
    { x: 500, label: 'JSON + TSV',    sub: 'artifacts/',              tone: 'work' },
    { x: 660, label: 'scp → VM',      sub: '~6 MB',                   tone: 'work' },
    { x: 820, label: 'PG / API / UI', sub: 'nginx cache 24h',         tone: 'ext' },
  ];
  return (
    <svg viewBox="0 0 980 200" className="diagram-svg" role="img" aria-label="Stats pipeline">
      {nodes.map((n, i) => (
        <g key={i} className={`d-pl d-pl-${n.tone}`}>
          <rect x={n.x} y="60" width="140" height="76" rx="8" />
          <text x={n.x + 70} y="88" className="d-title">{n.label}</text>
          <text x={n.x + 70} y="108" className="d-sub">{n.sub}</text>
          {i < nodes.length - 1 && (
            <g className="d-arrow d-arrow-pipeline">
              <line x1={n.x + 140} y1="98" x2={n.x + 160} y2="98" />
              <polygon points={`${n.x + 160},98 ${n.x + 152},94 ${n.x + 152},102`} />
            </g>
          )}
        </g>
      ))}
      <text x="20" y="180" className="d-caption">
        三处必须同步:builder.ts (写 TSV) · stats.yml (scp 清单) · load.sql (\copy 引)
      </text>
    </svg>
  );
}

// ─── 内容数据 ─────────────────────────────────────

interface Layer {
  num: string;
  zh: { name: string; one: string; tech: ReactNode };
  en: { name: string; one: string; tech: ReactNode };
}
const LAYERS: Layer[] = [
  {
    num: '01',
    zh: { name: '边缘',     one: 'TLS 终止 + 静态文件 + 反向代理',      tech: <>nginx · CloudFlare DNS · Let's Encrypt</> },
    en: { name: 'Edge',     one: 'TLS termination + static + reverse proxy', tech: <>nginx · CloudFlare DNS · Let's Encrypt</> },
  },
  {
    num: '02',
    zh: { name: '前端',     one: '一个 SPA, 24+ 工具页, React Router 切路由', tech: <>React 19 · Vite 8 · TypeScript · cubing.js</> },
    en: { name: 'Frontend', one: 'One SPA, 24+ tool pages, React Router',     tech: <>React 19 · Vite 8 · TypeScript · cubing.js</> },
  },
  {
    num: '03',
    zh: { name: 'API',      one: '小而轻的 Hono, 跑在 pm2 上',           tech: <>Hono · Node 22 · pm2</> },
    en: { name: 'API',      one: 'Small, light Hono, run under pm2',     tech: <>Hono · Node 22 · pm2</> },
  },
  {
    num: '04',
    zh: { name: '存储',     one: 'recon · alg 公式库 · 训练数据 · WCA stats 衍生', tech: <>PostgreSQL 13 · pg_dump nightly</> },
    en: { name: 'Storage',  one: 'recon · alg library · training data · WCA stats derivatives', tech: <>PostgreSQL 13 · pg_dump nightly</> },
  },
];

interface Pkg {
  name: string;
  size: string;
  zh: { role: string; bullet: string[] };
  en: { role: string; bullet: string[] };
}
const PACKAGES: Pkg[] = [
  {
    name: 'client', size: '~120k LOC',
    zh: { role: 'React SPA — 整个前端',     bullet: ['pages/ 一个工具一目录', 'components/ 跨页复用', 'utils/ 工具函数 (apiUrl / flag / format_result)'] },
    en: { role: 'React SPA — the whole frontend', bullet: ['pages/ — one folder per tool', 'components/ — shared widgets', 'utils/ — helpers (apiUrl / flag / format_result)'] },
  },
  {
    name: 'server', size: '~8k LOC',
    zh: { role: 'Hono API + PG 访问',       bullet: ['WCA OAuth + 会话', 'recon / alg / 训练数据 CRUD', '跨域 allowlist 白名单'] },
    en: { role: 'Hono API + PG access',     bullet: ['WCA OAuth + sessions', 'recon / alg / training-data CRUD', 'CORS allowlist'] },
  },
  {
    name: 'shared', size: '~1k LOC',
    zh: { role: '前后端共享类型',           bullet: ['纯 TypeScript 类型, 零运行时', '不能引 client utils', '改一处, 前后端同步收紧'] },
    en: { role: 'Shared types',             bullet: ['Pure TS types, zero runtime', 'Must not import client utils', 'One source for both ends'] },
  },
  {
    name: 'stats-build', size: '~5k LOC',
    zh: { role: 'WCA 统计独立管道',         bullet: ['80+ SQL-driven 统计', '周更 CI, ~2 小时跑完', '基于 jonatanklosko/wca_statistics 重写'] },
    en: { role: 'WCA stats standalone pipeline', bullet: ['80+ SQL-driven stats', 'Weekly CI, ~2h end to end', 'TS rewrite of jonatanklosko/wca_statistics'] },
  },
  {
    name: 'stats-ui', size: '~3k LOC',
    zh: { role: '统计页通用渲染壳',         bullet: ['给 80+ stat 提供一致 UI', 'client 通过 lazy() 加载', '表 + 折线 + 热图 + 分组排序'] },
    en: { role: 'Generic stats rendering shell', bullet: ['Uniform UI for 80+ stat pages', 'client lazy-loads it', 'Tables, line charts, heatmaps, grouped sort'] },
  },
];

interface Mod {
  route: string;
  zh: string;
  en: string;
  origin: 'own' | 'port' | 'fork';
  zhDesc: string;
  enDesc: string;
}
const MODULES: Mod[] = [
  { route: '/recon',          zh: '复盘',        en: 'Recon',        origin: 'own',  zhDesc: '比赛复盘 + 同轮自动带入',       enDesc: 'Result review + same-round autofill' },
  { route: '/trainer',        zh: '公式训练',    en: 'Trainer',      origin: 'own',  zhDesc: '41 套公式计时训练',              enDesc: '41 algorithm sets with timing' },
  { route: '/frame-count',    zh: '逐帧',        en: 'Frame Count',  origin: 'own',  zhDesc: 'WebCodecs + mp4box.js',          enDesc: 'WebCodecs + mp4box.js' },
  { route: '/viz',            zh: '成绩分布',    en: 'Distribution', origin: 'own',  zhDesc: '成绩分布可视化',                 enDesc: 'Result distribution viz' },
  { route: '/calendar',       zh: '比赛日历',    en: 'Calendar',     origin: 'own',  zhDesc: '全球比赛日历',                   enDesc: 'Global comp calendar' },
  { route: '/scramble-stats', zh: '打乱难度',    en: 'Scramble',     origin: 'own',  zhDesc: '打乱难度分布',                   enDesc: 'Scramble difficulty' },
  { route: '/wca-stats',      zh: 'WCA 统计',    en: 'WCA Stats',    origin: 'own',  zhDesc: '80+ 统计页, 周更',               enDesc: '80+ pages, weekly' },
  { route: '/recognize/pll',  zh: 'PLL 识别',    en: 'Recognize',    origin: 'own',  zhDesc: '看图答字母训练',                 enDesc: 'Image-to-letter drill' },
  { route: '/calc',           zh: 'HTH 计算',    en: 'HTH Calc',     origin: 'port', zhDesc: 'port: carykh/hthgrapher',        enDesc: 'port: carykh/hthgrapher' },
  { route: '/battle',         zh: '1v1',         en: 'Battle',       origin: 'port', zhDesc: 'port: MatteoColombo',            enDesc: 'port: MatteoColombo' },
  { route: '/mosaic',         zh: '马赛克',      en: 'Mosaic',       origin: 'port', zhDesc: 'port: Roman-/mosaic',            enDesc: 'port: Roman-/mosaic' },
  { route: '/cstimer',        zh: 'csTimer',     en: 'csTimer',      origin: 'fork', zhDesc: 'fork: cs0x7f/cstimer',           enDesc: 'fork: cs0x7f/cstimer' },
  { route: '/solver',         zh: '复原器',      en: 'Solver',       origin: 'fork', zhDesc: 'fork: or18/RubiksSolverDemo',    enDesc: 'fork: or18/RubiksSolverDemo' },
  { route: '/alg-trainers',   zh: '公式训练器',  en: 'Alg Trainers', origin: 'fork', zhDesc: 'fork: mihlefeld/Alg-Trainers',   enDesc: 'fork: mihlefeld/Alg-Trainers' },
];

interface Decision {
  topic: string;
  pick: string;
  alt: string;
  zh: string;
  en: string;
}
const DECISIONS: Decision[] = [
  { topic: 'Framework',   pick: 'React 19',         alt: 'Vue / Svelte',          zh: '生态最广;cubing.js / sr-puzzlegen 等魔方库的示例都是 React;团队熟。',                en: 'Widest ecosystem; cubing.js / sr-puzzlegen samples are React; team familiarity.' },
  { topic: 'Bundler',     pick: 'Vite 8',           alt: 'Webpack / Turbopack',   zh: 'Dev server 启动 < 1s;HMR 即时;ESM 原生;tsc -b 增量 12s。',                          en: 'Sub-1s dev start; instant HMR; native ESM; tsc -b 12s incremental.' },
  { topic: 'API server',  pick: 'Hono',             alt: 'Express / Fastify',     zh: 'TypeScript 一等公民;路由声明式;5 MB 依赖比 express 干净一个量级。',                en: 'TS-first; declarative routing; ~5MB deps vs Express noisy stack.' },
  { topic: 'Database',    pick: 'PostgreSQL 13',    alt: 'MariaDB / MongoDB',     zh: '2026-05 从 MariaDB 整体迁过来。jsonb / window function / partial index 比 MariaDB 强一档。', en: 'Migrated from MariaDB 2026-05. jsonb, window functions, partial indexes — a tier above MariaDB.' },
  { topic: 'Monorepo',    pick: 'pnpm + Turbo',     alt: 'npm / yarn workspaces', zh: '硬链接 node_modules 省盘;Turbo 缓存只跑改动到的 package。',                         en: 'Hard-linked node_modules saves disk; Turbo runs only changed packages.' },
  { topic: 'Static host', pick: '云服务器 nginx',   alt: 'Vercel / Netlify',      zh: '同台机 nginx + API + DB, localhost 内 hop;Vercel 这种 SaaS 跑国内打不开。',        en: 'Same VM hosts nginx + API + DB; localhost hops; Vercel SaaS is unreachable from China.' },
];

interface Detail {
  title: string;
  zh: ReactNode;
  en: ReactNode;
}
const DETAILS: Detail[] = [
  {
    title: 'SharedArrayBuffer · COOP/COEP',
    zh: <><strong>/scramble/solver</strong> 和 <strong>/scramble/analyzer</strong> 跑 cubeopt-wasm, 需要 <code>SharedArrayBuffer</code>。仅这两条 route 由 nginx 注入 <code>COOP=same-origin</code> + <code>COEP=require-corp</code> 进 cross-origin isolated。其它 24 张卡完全干净, 登录回调不受影响。</>,
    en: <><strong>/scramble/solver</strong> and <strong>/scramble/analyzer</strong> run cubeopt-wasm and require <code>SharedArrayBuffer</code>. Only those two routes get nginx-injected <code>COOP=same-origin</code> + <code>COEP=require-corp</code> for cross-origin isolation. Every other page stays clean — login callbacks unaffected.</>,
  },
  {
    title: 'apiUrl() 是唯一的 fetch 入口',
    zh: <>客户端不能硬编码 origin。<code>utils/api_base.ts</code> 的 <code>apiUrl()</code> 用 <code>import.meta.env.DEV</code> 切换:dev 走 Vite proxy, prod 打 <code>api.cuberoot.me</code>。hostname 检测会被 Tailscale / LAN IP 骗到, 绝对禁用。</>,
    en: <>Client never hardcodes origin. <code>utils/api_base.ts</code> uses <code>import.meta.env.DEV</code>: dev → Vite proxy, prod → <code>api.cuberoot.me</code>. <code>hostname</code> checks get fooled by Tailscale / LAN IP — banned.</>,
  },
  {
    title: 'cubing.js + sr-puzzlegen + visualcube 三件套',
    zh: <><strong>cubing.js</strong> 渲染动画 (TwistyPlayer)、跑 3x3 / 4x4 求解器。<strong>sr-puzzlegen</strong> 出 sq1 / megaminx / pyraminx / skewb 静态 SVG。<strong>visualcube</strong> 出 NxN 状态图 (F2L / OLL / PLL / ZBLL)。三者各管一块, <strong>禁止手写魔方 SVG</strong>。</>,
    en: <><strong>cubing.js</strong> for animation (TwistyPlayer) and 3x3/4x4 solvers. <strong>sr-puzzlegen</strong> for sq1 / megaminx / pyraminx / skewb SVGs. <strong>visualcube</strong> for NxN state images (F2L / OLL / PLL / ZBLL). Three libs, three lanes — <strong>hand-written cube SVG is banned</strong>.</>,
  },
  {
    title: 'i18n — 两种 pattern 并存',
    zh: <>大段文案走 <code>t()</code> + <code>en.json</code> / <code>zh.json</code>;组件内零散文案走 <code>isZh ? 'X' : 'Y'</code> 三元。<code>LangToggle</code> 每页右上角, 默认跟系统语言。WCA 比赛中文名独立走 <code>comp_names_zh.json</code>。</>,
    en: <>Long blocks → <code>t()</code> + <code>en.json</code>/<code>zh.json</code>; inline strings → <code>isZh ? 'X' : 'Y'</code> ternary. <code>LangToggle</code> sits top-right on every page. Chinese comp names live in a separate <code>comp_names_zh.json</code>.</>,
  },
  {
    title: 'WCA 统计的脆弱三角',
    zh: <>新增一个 stat 表要同步改三处:<code>stats-build/src/bin/*.ts</code> (写 TSV)、<code>.github/workflows/stats.yml</code> (scp 清单)、<code>ops/sql/load.sql</code> (<code>\copy</code> 引用)。漏一处, 服务器表静默为空, nginx 还缓存 24 小时。dry-run grep 三段对照是唯一保险。</>,
    en: <>Adding a stat table needs three coordinated edits: <code>stats-build/src/bin/*.ts</code> (writes TSV), <code>.github/workflows/stats.yml</code> (scp manifest), <code>ops/sql/load.sql</code> (<code>\copy</code> reference). Miss one and the server table silently empties — nginx still caches 24h. The only safety net: a 30-second grep dry-run across all three.</>,
  },
  {
    title: 'fork / port / own 三种治理',
    zh: <><strong>fork</strong> (csTimer / Solver / Alg Trainers) = upstream 静态资源原样托管, 只改外层包装。<strong>port</strong> (Calc / Battle / Mosaic) = 把别人的 React / HTML 重写一遍。<strong>own</strong> (其它 11 个) = 自己设计 + 实现。改 fork / port 前必须确认 upstream。</>,
    en: <><strong>fork</strong> (csTimer / Solver / Alg Trainers) = upstream assets hosted as-is, only the outer shell is ours. <strong>port</strong> (Calc / Battle / Mosaic) = someone else's React / HTML, rewritten in this repo. <strong>own</strong> (the other 11) = designed and built here. Touching a fork or port? Check upstream first.</>,
  },
];

// ─── 主组件 ───────────────────────────────────────

export default function CodeArchitecturePage() {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language.startsWith('zh') ? 'zh' : 'en';

  useEffect(() => {
    document.title = lang === 'zh' ? '站点架构 — CubeRoot' : 'Site Architecture — CubeRoot';
  }, [lang]);

  return (
    <LangCtx.Provider value={lang}>
      <div className="arch-page">
        <header className="arch-hero">
          <div className="arch-topbar">
            <Link to="/code" className="arch-back">← /code</Link>
            <LangToggle variant="inline" />
          </div>
          <div className="arch-hero-meta">
            <L zh="一份内部说明书" en="An internal handbook" />
            <span className="arch-meta-sep">·</span>
            <span>2026.05</span>
          </div>
          <h1 className="arch-hero-title">
            <L zh="CubeRoot 是怎么搭起来的" en="How CubeRoot is built" />
          </h1>
          <p className="arch-hero-lede">
            <L
              zh={<>一个 24+ 工具页的魔方站, 跑在一台云服务器上。前端是 React 19 SPA, 后端是 Hono + PostgreSQL, WCA 统计有一条独立的周更管道。下面这页把每一层讲清楚 — 从一个鼠标点击, 到 DOM 更新, 中间发生了什么。</>}
              en={<>A cube-tools site with 24+ tool pages, running on a single cloud VM. Frontend is a React 19 SPA, backend is Hono + PostgreSQL, and the WCA statistics pipeline runs separately on a weekly cadence. This page walks every layer — from a mouse click to a DOM update, and everything in between.</>}
            />
          </p>
          <div className="arch-hero-stats">
            <div className="arch-hs"><div className="arch-hs-v">5</div><div className="arch-hs-l"><L zh="monorepo 包" en="packages" /></div></div>
            <div className="arch-hs"><div className="arch-hs-v">14</div><div className="arch-hs-l"><L zh="模块" en="modules" /></div></div>
            <div className="arch-hs"><div className="arch-hs-v">80+</div><div className="arch-hs-l"><L zh="WCA 统计页" en="WCA stat pages" /></div></div>
            <div className="arch-hs"><div className="arch-hs-v">41</div><div className="arch-hs-l"><L zh="公式库" en="alg sets" /></div></div>
            <div className="arch-hs"><div className="arch-hs-v">1</div><div className="arch-hs-l"><L zh="台云服务器" en="cloud VM" /></div></div>
          </div>
        </header>

        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">01</span>
            <h2 className="arch-sec-title"><L zh="一图看懂整个系统" en="The whole system in one picture" /></h2>
          </div>
          <p className="arch-sec-lede">
            <L
              zh={<>站点的一切都坐在一台云服务器上。nginx 既服静态 SPA 也反代 Hono API;Hono 通过本地 socket 打 PG。GH Pages 是兜底镜像, 跑国内挂了 cuberoot.me 才会用到。</>}
              en={<>Everything sits on one cloud VM. nginx serves both the static SPA and reverse-proxies the Hono API; Hono talks to PG over a local socket. GitHub Pages is a fallback mirror — used only when cuberoot.me itself is down.</>}
            />
          </p>
          <div className="arch-diagram">
            <SystemTopoSVG />
          </div>
          <div className="arch-layers">
            {LAYERS.map((l) => {
              const t = l[lang];
              return (
                <div key={l.num} className="arch-layer">
                  <div className="arch-layer-num">{l.num}</div>
                  <div className="arch-layer-name">{t.name}</div>
                  <div className="arch-layer-one">{t.one}</div>
                  <div className="arch-layer-tech">{t.tech}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">02</span>
            <h2 className="arch-sec-title"><L zh="Monorepo:五个包" en="Monorepo: five packages" /></h2>
          </div>
          <p className="arch-sec-lede">
            <L
              zh={<><code>core/</code> 是 pnpm + Turbo monorepo, 五个包各管一摊。CI 只跑改动到的包, 缓存 hit 时秒级出结果。</>}
              en={<><code>core/</code> is a pnpm + Turbo monorepo with five packages, each owning one slice. CI only re-runs packages that actually changed — cache hits make most builds sub-second.</>}
            />
          </p>
          <div className="arch-diagram">
            <PackageDepsSVG />
          </div>
          <div className="arch-pkgs">
            {PACKAGES.map((p) => {
              const t = p[lang];
              return (
                <article key={p.name} className="arch-pkg">
                  <header className="arch-pkg-head">
                    <span className="arch-pkg-name">@cuberoot/{p.name}</span>
                    <span className="arch-pkg-size">{p.size}</span>
                  </header>
                  <div className="arch-pkg-role">{t.role}</div>
                  <ul className="arch-pkg-bullets">
                    {t.bullet.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">03</span>
            <h2 className="arch-sec-title"><L zh="一次点击到 DOM 更新" en="From click to DOM" /></h2>
          </div>
          <p className="arch-sec-lede">
            <L
              zh={<>典型的读请求 (比如打开 /recon/abc), 端到端在 50ms 以内。nginx <code>proxy_cache</code> 命中时降到 10ms 以下。这里把每一跳的时间标出来。</>}
              en={<>A typical read (say, opening /recon/abc) runs end-to-end in under 50ms. With an nginx <code>proxy_cache</code> hit it drops below 10ms. Each hop's latency is plotted below.</>}
            />
          </p>
          <div className="arch-diagram">
            <RequestLifecycleSVG />
          </div>
          <pre className="arch-code">{`Browser
  │  GET cuberoot.me/recon/abc
  ▼
nginx :443    →  try_files → index.html  (SPA fallback)
  │
  ▼
React SPA   →  fetch(apiUrl('/v1/recon/abc'))
                          │
                          ▼
                nginx :443 (api.cuberoot.me)
                  │  proxy_cache /v1/wca/* (24h)
                  ▼
                Hono :3001    →  pg pool  →  PostgreSQL :5432
                  │
                  ▼
                JSON  →  React state  →  DOM`}</pre>
        </section>

        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">04</span>
            <h2 className="arch-sec-title"><L zh="14 个模块, 三种治理" en="14 modules, three flavors" /></h2>
          </div>
          <p className="arch-sec-lede">
            <L
              zh={<>不是所有路由都是我写的。<strong>own</strong> = 自己设计 + 实现;<strong>port</strong> = 把别人的 React / HTML 重写进本仓库;<strong>fork</strong> = upstream 静态资源原样托管。点卡片去看实际模块。</>}
              en={<>Not every route was built from scratch. <strong>own</strong> = designed and built here; <strong>port</strong> = someone else's React/HTML rewritten in-repo; <strong>fork</strong> = upstream assets hosted as-is. Click a card to visit the module.</>}
            />
          </p>
          <div className="arch-mod-legend">
            <span className="arch-tag arch-tag-own">own · 8</span>
            <span className="arch-tag arch-tag-port">port · 3</span>
            <span className="arch-tag arch-tag-fork">fork · 3</span>
          </div>
          <div className="arch-mods">
            {MODULES.map((m) => (
              <Link key={m.route} to={m.route} className={`arch-mod arch-mod-${m.origin}`}>
                <div className="arch-mod-top">
                  <span className="arch-mod-route">{m.route}</span>
                  <span className={`arch-tag arch-tag-${m.origin}`}>{m.origin}</span>
                </div>
                <div className="arch-mod-name">{lang === 'zh' ? m.zh : m.en}</div>
                <div className="arch-mod-desc">{lang === 'zh' ? m.zhDesc : m.enDesc}</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">05</span>
            <h2 className="arch-sec-title"><L zh="WCA 统计:一条独立的周更管道" en="WCA stats: a separate weekly pipeline" /></h2>
          </div>
          <p className="arch-sec-lede">
            <L
              zh={<>统计数据跟主站完全解耦。GitHub Actions 每周从 WCA 公开 dump 拉数据, 在 runner 上跑 80+ 个 SQL-driven 统计, 产出 JSON + TSV, scp 到云服务器, <code>\copy</code> 进 PG, Hono 读出来, nginx 再缓存 24 小时。</>}
              en={<>Stats data is fully decoupled from the main site. GitHub Actions pulls the WCA public dump weekly, runs 80+ SQL-driven statistics on the runner, produces JSON + TSVs, scp's them to the VM, <code>\copy</code>s them into PG, Hono reads them out, and nginx caches 24h on top.</>}
            />
          </p>
          <div className="arch-diagram">
            <StatsPipelineSVG />
          </div>
        </section>

        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">06</span>
            <h2 className="arch-sec-title"><L zh="部署:五个域名, 一台机器" en="Deploy: five hosts, one machine" /></h2>
          </div>
          <table className="arch-tbl">
            <thead><tr>
              <th><L zh="域名" en="Host" /></th>
              <th><L zh="后面" en="Backed by" /></th>
              <th><L zh="作用" en="Role" /></th>
            </tr></thead>
            <tbody>
              <tr><td><code>cuberoot.me</code></td><td><L zh="云服务器 nginx" en="Cloud nginx" /></td><td><L zh="主站, SPA 入口" en="Primary site, SPA entry" /></td></tr>
              <tr><td><code>www.cuberoot.me</code></td><td><L zh="同台, 301" en="Same VM, 301" /></td><td><L zh="apex 与 www 互通" en="apex / www mutual redirect" /></td></tr>
              <tr><td><code>api.cuberoot.me</code></td><td><L zh="同台 nginx 反代 :3001" en="Same VM, nginx → :3001" /></td><td><L zh="Hono API + 24h proxy_cache" en="Hono API + 24h proxy_cache" /></td></tr>
              <tr><td><code>ruiminyan.github.io</code></td><td><L zh="GitHub Pages 镜像" en="GitHub Pages mirror" /></td><td><L zh="兜底, 301 → cuberoot.me" en="Fallback, 301 → cuberoot.me" /></td></tr>
              <tr><td><code>cuberoot.me/blog/</code></td><td><L zh="Hugo 静态" en="Hugo static" /></td><td><L zh="2026-05 从 WordPress 迁来" en="Migrated from WordPress, 2026-05" /></td></tr>
            </tbody>
          </table>
        </section>

        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">07</span>
            <h2 className="arch-sec-title"><L zh="为什么是这些选型" en="Why these picks" /></h2>
          </div>
          <p className="arch-sec-lede">
            <L
              zh={<>每个技术选型都有 alternatives。下表列出选了什么、没选什么、以及为什么。</>}
              en={<>Each pick has alternatives. The table below lists what was chosen, what wasn't, and why.</>}
            />
          </p>
          <table className="arch-tbl">
            <thead><tr>
              <th><L zh="主题" en="Topic" /></th>
              <th><L zh="选" en="Picked" /></th>
              <th><L zh="没选" en="Not picked" /></th>
              <th><L zh="为什么" en="Why" /></th>
            </tr></thead>
            <tbody>
              {DECISIONS.map((d) => (
                <tr key={d.topic}>
                  <td className="arch-tbl-topic">{d.topic}</td>
                  <td className="arch-tbl-pick">{d.pick}</td>
                  <td className="arch-tbl-alt">{d.alt}</td>
                  <td>{lang === 'zh' ? d.zh : d.en}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">08</span>
            <h2 className="arch-sec-title"><L zh="几个工程细节" en="Engineering details worth knowing" /></h2>
          </div>
          <div className="arch-details">
            {DETAILS.map((d) => (
              <article key={d.title} className="arch-detail">
                <h3 className="arch-detail-title">{d.title}</h3>
                <p className="arch-detail-body">{lang === 'zh' ? d.zh : d.en}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="arch-foot">
          <div className="arch-foot-line">
            <L zh="源码" en="Source" />
            <span className="arch-meta-sep">·</span>
            <a href="https://github.com/ruiminyan/ruiminyan.github.io" target="_blank" rel="noreferrer">
              github.com/ruiminyan/ruiminyan.github.io
            </a>
            <span className="arch-meta-sep">·</span>
            <Link to="/code">/code</Link>
          </div>
          <p className="arch-foot-note">
            <L
              zh={<>这页是 CubeRoot 的内部说明书。改任何模块前, 先看一眼这里;改完了, 再看一眼这里。</>}
              en={<>This is CubeRoot's internal handbook. Read it before touching any module; read it again after.</>}
            />
          </p>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
