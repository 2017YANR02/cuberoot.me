import { useEffect, useContext, createContext, useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LangToggle from '../../components/LangToggle';
import COMMITS_DATA from './timeline_commits.json';
import MonthGrid from '../../components/MonthGrid';
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

// ─── SVG 5: Dev HMR 双入口推导 ───────────────────
function HmrDualEntrySVG() {
  return (
    <svg viewBox="0 0 920 600" className="diagram-svg" role="img" aria-label="Dev HMR dual entry">
      {/* 顶部:两个 page 入口 */}
      <g className="d-box d-box-user">
        <rect x="40" y="14" width="340" height="82" rx="10" />
        <text x="210" y="40" className="d-title">Laptop</text>
        <text x="210" y="60" className="d-sub d-mono">http://localhost:5173/</text>
        <text x="210" y="80" className="d-sub">URL.port = "5173"  ·  protocol = http</text>
      </g>

      <g className="d-box d-box-user">
        <rect x="540" y="14" width="340" height="82" rx="10" />
        <text x="710" y="40" className="d-title">Phone</text>
        <text x="710" y="60" className="d-sub d-mono">https://alienware.tail171d80.ts.net/</text>
        <text x="710" y="80" className="d-sub">URL.port = ""  ·  protocol = https</text>
      </g>

      {/* 两条箭头下来 */}
      <g className="d-arrow">
        <line x1="210" y1="96" x2="210" y2="138" />
        <polygon points="210,138 205,130 215,130" />
      </g>
      <g className="d-arrow">
        <line x1="710" y1="96" x2="710" y2="138" />
        <polygon points="710,138 705,130 715,130" />
      </g>

      {/* 中间:共享的 /@vite/client */}
      <g className="d-pkg d-pkg-shared">
        <rect x="60" y="138" width="800" height="140" rx="10" />
        <text x="460" y="166" className="d-title">/@vite/client — 同一份 JS, 两边都拉这一份</text>
        <text x="460" y="194" className="d-code">
          socketProtocol = <tspan className="d-code-fall">null</tspan> || (protocol === "https:" ? "wss" : "ws")
        </text>
        <text x="460" y="218" className="d-code">
          hmrPort = <tspan className="d-code-fall">null</tspan>
        </text>
        <text x="460" y="242" className="d-code">
          socketHost = hostname + ":" + (hmrPort || URL.port) + "/"
        </text>
        <text x="460" y="266" className="d-sub">短路求值:null 为假 → fallback 到 page URL 自身的值</text>
      </g>

      {/* 两条分叉箭头 */}
      <g className="d-arrow">
        <line x1="380" y1="278" x2="220" y2="320" />
        <polygon points="220,320 226,313 230,321" />
      </g>
      <g className="d-arrow">
        <line x1="540" y1="278" x2="700" y2="320" />
        <polygon points="700,320 690,321 694,313" />
      </g>

      {/* 推导出来的 ws URL */}
      <g>
        <rect x="40" y="320" width="340" height="90" rx="10" fill="#ECF1EC" stroke="#B5CAB5" strokeWidth="1.5" />
        <text x="210" y="346" className="d-title">→ Laptop 推导出</text>
        <text x="210" y="376" className="d-code d-code-strong">ws://localhost:5173/</text>
        <text x="210" y="398" className="d-sub">page port "5173" 直接代入</text>
      </g>

      <g>
        <rect x="540" y="320" width="340" height="90" rx="10" fill="#ECF1EC" stroke="#B5CAB5" strokeWidth="1.5" />
        <text x="710" y="346" className="d-title">→ Phone 推导出</text>
        <text x="710" y="376" className="d-code d-code-strong">wss://alienware.tail171d80.ts.net:/</text>
        <text x="710" y="398" className="d-sub">尾巴的孤零零 ":" 被浏览器规范化, 走 wss 默认 443</text>
      </g>

      {/* 两条到最终 server 的箭头 */}
      <g className="d-arrow d-arrow-hot">
        <line x1="210" y1="410" x2="400" y2="540" />
        <polygon points="400,540 390,536 393,529" />
        <text x="260" y="470" className="d-label">direct TCP</text>
      </g>

      {/* Funnel 中继 */}
      <g>
        <rect x="540" y="436" width="340" height="48" rx="6" fill="#F4ECEA" stroke="#DDBCB1" strokeWidth="1.5" strokeDasharray="4 3" />
        <text x="710" y="456" className="d-title">Tailscale Funnel</text>
        <text x="710" y="474" className="d-sub d-mono">edge :443 (TLS) → 127.0.0.1:5173 (plain)</text>
      </g>
      <g className="d-arrow d-arrow-hot">
        <line x1="710" y1="410" x2="710" y2="436" />
        <polygon points="710,436 705,428 715,428" />
      </g>
      <g className="d-arrow d-arrow-hot">
        <line x1="710" y1="484" x2="520" y2="540" />
        <polygon points="520,540 530,536 528,529" />
      </g>

      {/* 最终的 Vite WS server */}
      <g className="d-box d-box-server">
        <rect x="310" y="540" width="300" height="50" rx="10" />
        <text x="460" y="562" className="d-title d-title-lg">Vite HTTP + WS</text>
        <text x="460" y="580" className="d-sub d-mono">127.0.0.1:5173  ·  单端口共享</text>
      </g>
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

// ─── Section 10 数据:请求追踪 ─────────────────────

type StageId = 'browser' | 'edge' | 'spa' | 'fetch' | 'api' | 'hono' | 'pg';

interface Stage { id: StageId; zh: string; en: string; sub: string; }
const TRACER_STAGES: Stage[] = [
  { id: 'browser', zh: '浏览器',           en: 'Browser',           sub: 'fetch / nav' },
  { id: 'edge',    zh: 'cuberoot.me nginx', en: 'cuberoot.me nginx', sub: 'static + try_files' },
  { id: 'spa',     zh: 'SPA 启动',          en: 'SPA boot',          sub: 'React + Router' },
  { id: 'fetch',   zh: 'apiUrl() fetch',    en: 'apiUrl() fetch',    sub: 'utils/api_base.ts' },
  { id: 'api',     zh: 'api.cuberoot.me nginx', en: 'api.cuberoot.me nginx', sub: 'proxy_cache 24h' },
  { id: 'hono',    zh: 'Hono server',       en: 'Hono server',       sub: 'pm2 · :3001' },
  { id: 'pg',      zh: 'PostgreSQL',        en: 'PostgreSQL',        sub: ':5432' },
];

interface Pattern {
  id: string;
  zh: { label: string; detail: string };
  en: { label: string; detail: string };
  route: string;
  lit: StageId[];
  cacheHit: boolean;
  eta: string;
}
const TRACER_PATTERNS: Pattern[] = [
  {
    id: 'home',
    route: '/',
    lit: ['browser', 'edge', 'spa'],
    cacheHit: false,
    eta: '~200ms 首次  ·  完全不打 API',
    zh: { label: '打开首页', detail: '纯 SPA 加载:nginx try_files 返回 index.html, 浏览器跑 SPA, React Router 渲染 LandingPage。一个 API 都不调。' },
    en: { label: 'Open home', detail: 'Pure SPA load: nginx try_files returns index.html, browser runs SPA, React Router renders LandingPage. Zero API calls.' },
  },
  {
    id: 'recon-fresh',
    route: '/recon/abc',
    lit: ['browser', 'edge', 'spa', 'fetch', 'api', 'hono', 'pg'],
    cacheHit: false,
    eta: '~40ms (API 部分)',
    zh: { label: '首次打开复盘', detail: 'SPA 启动后调 apiUrl("/v1/recon/abc")。/v1/recon/* 不在 24h cache 白名单, 整条管道穿透:Hono 查 PG, 反序列化, 返回 JSON。' },
    en: { label: 'First-time recon view', detail: 'After SPA boots, fetch apiUrl("/v1/recon/abc"). /v1/recon/* is not in the 24h proxy_cache allowlist, so the request flows through to Hono → PG, deserializes, returns JSON.' },
  },
  {
    id: 'wca-cached',
    route: '/wca-stats/historical',
    lit: ['browser', 'edge', 'spa', 'fetch', 'api'],
    cacheHit: true,
    eta: '< 10ms (cache hit)',
    zh: { label: '回访 WCA 统计', detail: '24h 内重复访问 stat 数据。nginx proxy_cache 在 :api 这一层 hit, 直接吐 JSON, 不打 Hono、不打 PG。每天首次访问才真正穿透。' },
    en: { label: 'Revisit WCA stat', detail: 'Repeat visit within 24h. nginx proxy_cache hits at the :api stage, returns JSON directly — Hono and PG untouched. Only the first request each day pierces the cache.' },
  },
  {
    id: 'iframe-fork',
    route: '/tools/cstimer/index.html',
    lit: ['browser', 'edge'],
    cacheHit: false,
    eta: '< 10ms (静态)',
    zh: { label: '打开 fork 内部页', detail: 'fork 项目的内部页面 (iframe src)。nginx 直接服 /tools/cstimer/ 静态 HTML, 没 SPA, 没 API。从 React 路由 /cstimer 进来时再加一层 SPA + iframe 套娃。' },
    en: { label: 'Fork inner page', detail: 'Inside-iframe page of a forked project. nginx serves /tools/cstimer/ static HTML directly — no SPA, no API. From the React route /cstimer, you wrap an extra SPA + iframe around this.' },
  },
];

// ─── Section 11 数据:时间线 ──────────────────────

interface TLEntry {
  date: string;
  tag: 'migration' | 'dx' | 'feature' | 'infra';
  zh: { title: string; body: string; expand: string };
  en: { title: string; body: string; expand: string };
}
const TIMELINE: TLEntry[] = [
  {
    date: '2026-05-12',
    tag: 'dx',
    zh: {
      title: 'HMR 双入口修复 + /code/architecture 重写图文长版',
      body: 'PC localhost 和手机 Funnel 同时能 HMR。这页 (/code/architecture) 也从纯文字改成现在的图文长版, 一边写一边在两端实时验证。',
      expand: '本页第 09 节有完整推导:写死 clientPort 等于全员遵守一个入口。删掉让 client 跟着 page URL 自己算 — page URL 是 http:5173 就用 ws, 是 https:443 就用 wss, 浏览器自己规范化空端口。',
    },
    en: {
      title: 'HMR dual-entry fix + /code/architecture rewrite',
      body: 'PC localhost and phone Funnel now hot-reload together. This page (/code/architecture) was rewritten from plain prose into the illustrated long-form you\'re reading, validated live on both entries.',
      expand: 'Section 09 has the breakdown — a hardcoded clientPort forces every visitor through one entry. Delete it, let the client derive from its own page URL: http:5173 → ws, https:443 → wss, browser normalizes the empty port itself.',
    },
  },
  {
    date: '2026-05-08~09',
    tag: 'feature',
    zh: {
      title: 'WCA Stats 大扩张',
      body: '一周内加了 7 张 cubing.pro 风格的统计页 (大满贯 / 全部成绩 / 当年 / 届别 / 成功率 / 全达成 / 名次和), 加上 /scramble/gen 的 tnoodle PDF 导出。',
      expand: '同期重构了 /persons/:wcaId 详情页 (hero + PR + 5 tabs + 月级 rank 图), /all-results 用派生表 + late join 优化深分页。后端 historical_ranks 走 build → scp → PG → Hono → nginx 24h cache 五层管道。',
    },
    en: {
      title: 'WCA Stats build-out',
      body: 'In one week: 7 new cubing.pro-style stat pages (grand slam / all results / year / cohort / success rate / all events done / sum of ranks) plus tnoodle-style PDF export under /scramble/gen.',
      expand: 'Same wave: rebuilt /persons/:wcaId (hero + PR + 5 tabs + monthly rank chart), refactored /all-results with derived-table + late-join for deep pagination. historical_ranks now flows through build → scp → PG → Hono → nginx 24h cache.',
    },
  },
  {
    date: '2026-05-06',
    tag: 'migration',
    zh: {
      title: '"大重构日":三件大事一起做',
      body: '同一天完成:MariaDB → PG 13 整体迁移 / 41 个 alg JSON 进 PG / 宝塔 + PHP + WP 全卸。云服务器只剩 nginx + Node + PG。',
      expand: 'PG 迁移用 jsonb / window function / partial index 让 recon / alg / stats 代码全简化一档。pg_dump systemd timer 每天 03:00 UTC 备份留 30 天。Alg 网页可直接编辑 (X-Admin-Key 或 OAuth), 不用 commit + redeploy。Blog 从 WordPress 迁 Hugo 静态。',
    },
    en: {
      title: 'The "Great Refactor" day: three big migrations together',
      body: 'Same day: MariaDB → PG 13 / 41 alg JSONs into PG / wipe baota + PHP + WP. The VM now runs only nginx + Node + PG.',
      expand: 'The PG move uses jsonb / window functions / partial indexes to simplify recon / alg / stats across the board. pg_dump on a systemd timer at 03:00 UTC, 30-day retention. Algs now editable directly in the browser (X-Admin-Key or OAuth) — no commit + redeploy. Blog migrated from WordPress to static Hugo.',
    },
  },
  {
    date: '2026-05-03',
    tag: 'infra',
    zh: {
      title: 'VisualCube 服务化',
      body: '魔方贴纸图改走服务端渲染:esbuild 打包 + Node server 渲染 SVG + service worker 拦 /v1/visualcube.svg 走干净 URL + 零网络。',
      expand: '之前每张 NxN 状态图都让浏览器现场跑 visualcube 算面位置, 现在统一在云服务器渲完缓存。同期把 sq1/megaminx/pyraminx/skewb 也接 sr-puzzlegen, 手写魔方 SVG 一律禁。',
    },
    en: {
      title: 'VisualCube turned into a service',
      body: 'Cube sticker images moved to server-side rendering: esbuild bundle + Node renders SVG + service worker intercepts /v1/visualcube.svg for clean URLs and zero network.',
      expand: 'Previously every NxN state image had to run visualcube live in the browser; now everything renders on the VM and gets cached. sq1/megaminx/pyraminx/skewb also wired up via sr-puzzlegen — no more hand-written cube SVG.',
    },
  },
  {
    date: '2026-04-23 ~ 28',
    tag: 'feature',
    zh: {
      title: '第二轮工具迁入:Mosaic / Alg 库 Phase 1 / Scramble Stats',
      body: 'Mosaic port from Roman-/mosaic, alg 库走 docx → SPA 数据 (Phase 1), scramble-stats 把 D:\\cube\\solver C++ 分析器产出的 CSV 转成可视化分布。',
      expand: 'alg 库 Phase 1 还没进 DB, 当时跑的是 docx 解析出的 JSON。两周后 (2026-05-06) 才整体进 PG。同期 top10 history 视频导出也是这阶段加的。',
    },
    en: {
      title: 'Second wave of tools: Mosaic / Alg DB Phase 1 / Scramble Stats',
      body: 'Mosaic ported from Roman-/mosaic, alg library Phase 1 (docx → SPA data), scramble-stats turning D:\\cube\\solver C++ analyzer CSVs into visual distributions.',
      expand: 'Phase 1 alg library was still JSON parsed from docx — only two weeks later (2026-05-06) did it move into PG. The top-10 history video export shipped in this period too.',
    },
  },
  {
    date: '2026-04',
    tag: 'dx',
    zh: {
      title: 'typecheck 切到 tsc -b',
      body: '之前 references-only 根 tsconfig 让 tsc --noEmit 静默空跑, typo 永远过。',
      expand: '验证手段:故意写个不存在的标识符, 跑 typecheck 看会不会报。现在 typecheck 12s 增量、CI 用 --force 清缓存全量。',
    },
    en: {
      title: 'typecheck switched to tsc -b',
      body: 'Previously the references-only root tsconfig made tsc --noEmit silently no-op — typos passed forever.',
      expand: 'Detection: insert a fake identifier and run typecheck. Now incremental ~12s; CI uses --force to clear cache and re-check fully.',
    },
  },
  {
    date: '2026-03-24',
    tag: 'migration',
    zh: {
      title: 'Fastify → Hono (24 小时内换)',
      body: '前一天 (-03-23) 刚把 Fastify 接好, 第二天就整体换成 Hono, 22 个端点全转。',
      expand: '换 Hono 是因为 TS-first + 路由声明式 + 依赖 ~5MB (比 Fastify/Express 一个量级干净)。跑在 pm2 下, nginx 反代到 :3001。半个月时间里后端栈换了三次:Firestore → PHP/MariaDB (3-04) → Fastify (3-23) → Hono (3-24)。',
    },
    en: {
      title: 'Fastify → Hono (within 24h)',
      body: 'Fastify was wired up on -03-23; replaced wholesale by Hono the next day, all 22 endpoints converted.',
      expand: 'Hono chosen for TS-first + declarative routing + ~5MB deps (an order cleaner than Fastify/Express). Runs under pm2, nginx reverse-proxies to :3001. The backend stack changed three times in two weeks: Firestore → PHP/MariaDB (3-04) → Fastify (3-23) → Hono (3-24).',
    },
  },
  {
    date: '2026-03-23',
    tag: 'migration',
    zh: {
      title: 'React + TS monorepo 上线 + cubing.js',
      body: '从一堆 jQuery / 静态 HTML 工具整体迁到 React 19 + Vite + pnpm/Turbo monorepo。同一天接 cubing.js TwistyPlayer。',
      expand: '初始 4 个包:client + server + shared + stats-build。client 一开始迁了 12 个工具页 (calc / recon / viz / battle 等), 后续半年涨到 24+。cubing.js 落地后所有 PLL / OLL / scramble 动画统一走 TwistyPlayer, 手写魔方 SVG 全废。这是项目结构最大的一次跃变。',
    },
    en: {
      title: 'React + TS monorepo lands + cubing.js',
      body: 'Migrated a pile of jQuery / static-HTML tools onto a React 19 + Vite + pnpm/Turbo monorepo. cubing.js TwistyPlayer adopted the same day.',
      expand: 'Initial four packages: client + server + shared + stats-build. Client launched with 12 tool pages (calc / recon / viz / battle ...), grew to 24+ over six months. Once cubing.js landed, all PLL / OLL / scramble animations standardized on TwistyPlayer; hand-written cube SVG was retired. The single biggest structural leap in the project.',
    },
  },
  {
    date: '2026-03-12 ~ 15',
    tag: 'feature',
    zh: {
      title: '第一轮工具集成:HTH Calc / Alg-Trainers / csTimer / 1v1 Battle',
      body: '4 天内集成 4 个 fork / port:HTH Calc (carykh/hthgrapher), Alg-Trainers (mihlefeld), csTimer (cs0x7f, GPL-3.0 self-hosted), 1v1 Battle (MatteoColombo/cube_challenge_timer)。',
      expand: 'csTimer 是 self-hosted (整个项目 vendor 进 /cstimer/) 不是 iframe; 其它 3 个当时还是静态嵌入。后来 (2026-03-23 monorepo 上线后) Calc / Battle 被重写成 React, Alg-Trainers 保留 fork 形态。',
    },
    en: {
      title: 'First wave of integrations: HTH Calc / Alg-Trainers / csTimer / 1v1 Battle',
      body: 'Four forks / ports in four days: HTH Calc (carykh/hthgrapher), Alg-Trainers (mihlefeld), csTimer (cs0x7f, GPL-3.0 self-hosted), 1v1 Battle (MatteoColombo/cube_challenge_timer).',
      expand: 'csTimer is self-hosted (the whole upstream vendored into /cstimer/), not iframed; the other three were embedded statically at the time. After the monorepo landed (2026-03-23) Calc and Battle were rewritten in React; Alg-Trainers stayed in fork form.',
    },
  },
  {
    date: '2026-03-04',
    tag: 'migration',
    zh: {
      title: 'Firestore → PHP + MariaDB (自有云服务器)',
      body: '上线没几天的 Firestore 后端就被换成自有云服务器上自建的 PHP + MariaDB。第一次"自己运维一台机器"。',
      expand: 'Firestore 跨境延迟太高 + 配额太复杂, 不适合主战场在国内的站点。这台云服务器后来也是现役那台的雏形 (2026-05 才把宝塔 panel 和 PHP 一起拆掉)。',
    },
    en: {
      title: 'Firestore → PHP + MariaDB (self-hosted VM)',
      body: 'Firestore — adopted only days earlier — was replaced with self-hosted PHP + MariaDB on a cloud VM. The first "run my own machine" moment.',
      expand: 'Firestore had cross-border latency issues plus complicated quotas — wrong fit for a site whose audience is mostly in China. This VM later evolved into the current cloud-server (2026-05 finally stripped out baota panel + PHP together).',
    },
  },
  {
    date: '2026-02-27',
    tag: 'feature',
    zh: {
      title: 'Recon page Phase 1 + WCA OAuth',
      body: '/recon 上线:csv → JSON 复盘库 2017 条, 89 个选手。同一天接 WCA OAuth 登录 + Firestore 社区复盘存储。',
      expand: '一开始用 implicit grant 绕 CORS。Phase 1 的成绩库是 CSV 静态文件, 后来 (2026-03-04) 才进 MariaDB, (2026-05-06) 又进 PG。Recon 是项目第一个有"登录 + 写入"的功能, 把站点从展示性质拉到协作性质。',
    },
    en: {
      title: 'Recon page Phase 1 + WCA OAuth',
      body: '/recon launches: a CSV-to-JSON solve library with 2017 solves from 89 cubers. Same day: WCA OAuth login + Firestore community storage.',
      expand: 'Initially used the implicit grant to bypass CORS. Phase 1 stored data in static CSV; later went into MariaDB (2026-03-04), then PG (2026-05-06). Recon was the first feature with "login + write", which pulled the site from a showcase into a collaborative tool.',
    },
  },
  {
    date: '2026-02-18',
    tag: 'feature',
    zh: {
      title: '第一个 Landing 页 — Solver + WCA Stats 双卡',
      body: '从单页 index.html 变成有真正"首页"的站点。Solver 和 WCA Stats 两张入口卡, 配 i18n (en/zh)。',
      expand: '同期把 Solver (or18/RubiksSolverDemo fork) 的 UI 文字也翻译成中文。这是站点开始有"产品形态"的起点。',
    },
    en: {
      title: 'First landing page — Solver + WCA Stats',
      body: 'The site evolved from a single index.html into one with a real homepage. Two entry cards (Solver / WCA Stats), plus i18n (en/zh).',
      expand: 'Solver (forked from or18/RubiksSolverDemo) had its UI translated to Chinese the same day. This is when the site started to feel like a product.',
    },
  },
  {
    date: '2026-02-17',
    tag: 'infra',
    zh: {
      title: 'WCA Statistics 数据管道 (CI 周更)',
      body: 'GitHub Actions 每周从 WCA 公开 dump 拉数据, 跑统计脚本, 产物入仓。第一次"自动化数据流水线"。',
      expand: '当时是 Python 脚本, 后来 (2026-03-23 monorepo) 整体重写为 TS 跑在 stats-build 包里。原项目灵感来自 jonatanklosko/wca_statistics, 后来扩到 80+ 张统计页。',
    },
    en: {
      title: 'WCA Statistics data pipeline (weekly CI)',
      body: 'GitHub Actions pulls the WCA public dump weekly, runs statistics scripts, commits the artifacts. The site\'s first automated data pipeline.',
      expand: 'Originally a set of Python scripts, later rewritten in TypeScript inside the stats-build package (2026-03-23 monorepo). Inspired by jonatanklosko/wca_statistics; grew into 80+ stat pages.',
    },
  },
  {
    date: '2025-12-13',
    tag: 'infra',
    zh: {
      title: '项目诞生 — 一个 index.html',
      body: 'GitHub Pages 上的一个 ruiminyan.github.io repo, 一个空的 index.html, 一份 README。完。',
      expand: '初次 push 那天没有任何工具 / 后端 / 数据, 就是个壳。后两个月里慢慢往里塞 fork 的工具页 (Solver / Alg-Trainers 等)。整站第一个有数据的功能要等到 2026-02-17 的 WCA Statistics 才出现 — 也就是说前 65 天基本只在排版。',
    },
    en: {
      title: 'Day zero — one index.html',
      body: 'A ruiminyan.github.io repo on GitHub Pages, an empty index.html, a README. That\'s it.',
      expand: 'The day-one push had no tools, no backend, no data — just a shell. Over the next two months it slowly accumulated forked tool pages (Solver, Alg-Trainers, etc.). The first feature with real data didn\'t arrive until 2026-02-17 (WCA Statistics), meaning the first 65 days were essentially layout work.',
    },
  },
];

// ─── 交互组件:请求追踪 ──────────────────────────

function RequestTracer() {
  const lang = useLang();
  const [pid, setPid] = useState<string>(TRACER_PATTERNS[0].id);
  const p = TRACER_PATTERNS.find(x => x.id === pid)!;
  const lit = new Set<StageId>(p.lit);
  const txt = lang === 'zh' ? p.zh : p.en;
  return (
    <div className="tracer">
      <div className="tracer-tabs" role="tablist">
        {TRACER_PATTERNS.map((pat) => {
          const t = lang === 'zh' ? pat.zh : pat.en;
          const active = pid === pat.id;
          return (
            <button
              key={pat.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`tracer-tab${active ? ' active' : ''}`}
              onClick={() => setPid(pat.id)}
            >
              <span className="tracer-tab-label">{t.label}</span>
              <span className="tracer-tab-route">{pat.route}</span>
            </button>
          );
        })}
      </div>
      <ol className="tracer-flow">
        {TRACER_STAGES.map((s, i) => {
          const isLit = lit.has(s.id);
          const isHit = p.cacheHit && s.id === 'api';
          const litList = p.lit;
          const isFinal = isLit && s.id === litList[litList.length - 1];
          const st = lang === 'zh' ? s.zh : s.en;
          return (
            <li key={s.id} className={`tracer-stage${isLit ? ' lit' : ''}${isHit ? ' hit' : ''}${isFinal ? ' final' : ''}`}>
              <div className="tracer-stage-num">{String(i + 1).padStart(2, '0')}</div>
              <div className="tracer-stage-name">{st}</div>
              <div className="tracer-stage-sub">{s.sub}</div>
              {isHit && <div className="tracer-stage-badge">CACHE HIT</div>}
              {isFinal && !isHit && <div className="tracer-stage-badge tracer-stage-badge-end">RETURN</div>}
            </li>
          );
        })}
      </ol>
      <div className="tracer-meta">
        <span className="tracer-eta">{p.eta}</span>
      </div>
      <p className="tracer-detail">{txt.detail}</p>
    </div>
  );
}

// ─── 交互组件:时间线 ───────────────────────────

function Timeline() {
  const lang = useLang();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <ol className="timeline">
      {TIMELINE.map((e, i) => {
        const t = lang === 'zh' ? e.zh : e.en;
        const isOpen = open === i;
        return (
          <li key={i} className={`tl-entry tl-${e.tag}${isOpen ? ' open' : ''}`}>
            <button
              type="button"
              className="tl-trigger"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              <div className="tl-date">{e.date}</div>
              <div className="tl-body">
                <div className="tl-head-line">
                  <span className={`tl-tag tl-tag-${e.tag}`}>{e.tag}</span>
                  <h4 className="tl-title">{t.title}</h4>
                  <span className={`tl-chev${isOpen ? ' open' : ''}`} aria-hidden>▸</span>
                </div>
                <p className="tl-summary">{t.body}</p>
                {isOpen && <p className="tl-expand">{t.expand}</p>}
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// ─── 交互组件:每日日历视图 ───────────────────────

interface CommitEntry { sha: string; date: string; msg: string; tag: string; }
const COMMITS = COMMITS_DATA as CommitEntry[];
const REPO_URL = 'https://github.com/ruiminyan/ruiminyan.github.io';

// 项目寿命:2025-12-13 诞生 → 现在。6 个月铺满。
const CAL_MONTHS = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];

function CommitsCalendar() {
  const lang = useLang();
  const [selected, setSelected] = useState<CommitEntry | null>(null);
  const byDate = useMemo(() => {
    const m: Record<string, CommitEntry[]> = {};
    for (const c of COMMITS) (m[c.date] ||= []).push(c);
    return m;
  }, []);
  const tagCounts = useMemo(() => {
    const t: Record<string, number> = {};
    for (const c of COMMITS) t[c.tag] = (t[c.tag] || 0) + 1;
    return t;
  }, []);
  return (
    <div className="cal-stack">
      <div className="cal-legend">
        <span className={`cal-chip cal-chip-feat cal-legend-item`}>feat · {tagCounts.feat ?? 0}</span>
        <span className={`cal-chip cal-chip-refactor cal-legend-item`}>refactor · {tagCounts.refactor ?? 0}</span>
        <span className={`cal-chip cal-chip-perf cal-legend-item`}>perf · {tagCounts.perf ?? 0}</span>
        <span className={`cal-chip cal-chip-i18n cal-legend-item`}>i18n · {tagCounts.i18n ?? 0}</span>
        <span className={`cal-chip cal-chip-birth cal-legend-item`}>birth · {tagCounts.birth ?? 0}</span>
        <span className="cal-legend-note">
          {lang === 'zh'
            ? '每天最多展示 3 条;点任意一条看完整 commit msg + GitHub 链接;空格 = 那天没"重要"提交'
            : 'Up to 3 per day; click any chip to see the full commit message + GitHub link; blank = no substantive commit that day'}
        </span>
      </div>
      {CAL_MONTHS.map((ym) => (
        <CalMonth key={ym} ym={ym} byDate={byDate} lang={lang} onChipClick={setSelected} />
      ))}
      {selected && <CommitModal commit={selected} onClose={() => setSelected(null)} lang={lang} />}
    </div>
  );
}

function CalMonth({ ym, byDate, lang, onChipClick }: {
  ym: string;
  byDate: Record<string, CommitEntry[]>;
  lang: Lang;
  onChipClick: (c: CommitEntry) => void;
}) {
  const [y, m] = ym.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();

  let activeDays = 0;
  let totalCommits = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const list = byDate[date];
    if (list && list.length > 0) {
      activeDays++;
      totalCommits += list.length;
    }
  }

  const monthLabel = lang === 'zh' ? `${y} 年 ${m} 月` : `${y}-${String(m).padStart(2, '0')}`;
  const dows = lang === 'zh' ? ['一','二','三','四','五','六','日'] : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  return (
    <div className="cal-month">
      <header className="cal-month-head">
        <h3 className="cal-month-title">{monthLabel}</h3>
        <span className="cal-month-stat">
          {lang === 'zh' ? `${activeDays} 天有提交  ·  ${totalCommits} 次` : `${activeDays} active days  ·  ${totalCommits} commits`}
        </span>
      </header>
      <MonthGrid
        year={y}
        month={m}
        weekdays={dows}
        className="cal-grid"
        renderDay={(day, { inView }) => {
          if (!inView) return null;
          const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
          const commits = byDate[date] || [];
          return (
            <>
              <div className="cal-day">{day.getDate()}</div>
              {commits.map((cm) => (
                <button
                  key={cm.sha}
                  type="button"
                  className={`cal-chip cal-chip-${cm.tag}`}
                  title={cm.msg}
                  onClick={() => onChipClick(cm)}
                >
                  {cm.msg}
                </button>
              ))}
            </>
          );
        }}
      />
    </div>
  );
}

function CommitModal({ commit, onClose, lang }: { commit: CommitEntry; onClose: () => void; lang: Lang }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);
  const url = `${REPO_URL}/commit/${commit.sha}`;
  return (
    <div className="commit-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="commit-modal" onClick={(e) => e.stopPropagation()}>
        <header className="commit-modal-head">
          <span className={`cal-chip cal-chip-${commit.tag} commit-modal-tag`}>{commit.tag}</span>
          <span className="commit-modal-date">{commit.date}</span>
          <code className="commit-modal-sha">{commit.sha}</code>
          <button type="button" className="commit-modal-close" onClick={onClose} aria-label={lang === 'zh' ? '关闭' : 'Close'}>×</button>
        </header>
        <p className="commit-modal-msg">{commit.msg}</p>
        <a href={url} target="_blank" rel="noreferrer" className="commit-modal-link">
          {lang === 'zh' ? '在 GitHub 查看这条提交  →' : 'View on GitHub  →'}
        </a>
      </div>
    </div>
  );
}

// ─── 交互组件:列表 vs 日历切换 ───────────────────

function HistoryView() {
  const lang = useLang();
  const [mode, setMode] = useState<'list' | 'calendar'>('list');
  return (
    <>
      <div className="history-tabs" role="tablist">
        <button
          type="button"
          className={`history-tab${mode === 'list' ? ' active' : ''}`}
          onClick={() => setMode('list')}
          aria-selected={mode === 'list'}
        >
          {lang === 'zh' ? `列表  ·  ${TIMELINE.length} 件重大` : `List  ·  ${TIMELINE.length} majors`}
        </button>
        <button
          type="button"
          className={`history-tab${mode === 'calendar' ? ' active' : ''}`}
          onClick={() => setMode('calendar')}
          aria-selected={mode === 'calendar'}
        >
          {lang === 'zh' ? `日历  ·  每天都看 (${COMMITS.length} 条)` : `Calendar  ·  every commit (${COMMITS.length})`}
        </button>
      </div>
      {mode === 'list' ? <Timeline /> : <CommitsCalendar />}
    </>
  );
}

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

        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">09</span>
            <h2 className="arch-sec-title"><L zh="Dev HMR:一份 JS, 两个入口都能热更" en="Dev HMR: one JS, two entries, both hot-reload" /></h2>
          </div>
          <p className="arch-sec-lede">
            <L
              zh={<>开发时 PC 走 <code>http://localhost:5173/</code> (本机直连, 飞快, 无 TLS), 手机走 <code>https://alienware.tail171d80.ts.net/</code> (Tailscale Funnel 公网可达)。两个入口共用同一份 <code>/@vite/client</code> JS, 却要分别拉 <code>ws</code> / <code>wss</code>、不同端口才能连到同一个 HMR server。Vite 是怎么"一份 JS 满足两边"的。</>}
              en={<>In dev, the PC visits <code>http://localhost:5173/</code> (direct, fast, plain HTTP) and the phone visits <code>https://alienware.tail171d80.ts.net/</code> (public via Tailscale Funnel). Both entries pull the same <code>/@vite/client</code> JS, yet each needs a different scheme (<code>ws</code>/<code>wss</code>) and port to reach the same HMR server. Here's how Vite makes one JS satisfy both.</>}
            />
          </p>
          <div className="arch-diagram">
            <HmrDualEntrySVG />
          </div>
          <pre className="arch-code">{`// ❌ BEFORE  — vite.config.ts 写了:  hmr: { clientPort: 443, protocol: 'wss' }
//    Vite 把字面量烤进 /@vite/client, 两端都被强制走 wss://...:443/
const socketProtocol = "wss" || (importMetaUrl.protocol === "https:" ? "wss" : "ws");
const hmrPort = 443;
const socketHost = \`\${importMetaUrl.hostname}:\${hmrPort || importMetaUrl.port}/\`;
// localhost 拿到:  wss://localhost:443/        ← 本机 443 没监听, HMR 死

// ✅ AFTER  — 删掉整段 hmr 配置
//    Vite 注入 null, 客户端 || 短路回退到 page URL 自身的值
const socketProtocol = null || (importMetaUrl.protocol === "https:" ? "wss" : "ws");
const hmrPort = null;
const socketHost = \`\${importMetaUrl.hostname}:\${hmrPort || importMetaUrl.port}/\`;
// localhost 拿到:  ws://localhost:5173/        ← page 是 http:5173, ws 也是 ws:5173
// Funnel   拿到:  wss://alienware...ts.net:/  ← URL 末尾的孤 ":" 被规范化, 走 wss 默认 443`}</pre>
          <div className="arch-details">
            <article className="arch-detail">
              <h3 className="arch-detail-title"><L zh="坑:写死 clientPort 等于「全员遵守一个入口」" en="The trap: a hardcoded clientPort enforces one entry on everyone" /></h3>
              <p className="arch-detail-body">
                <L
                  zh={<>Vite 在 dev server 启动时把 HMR 配置烤成 <code>/@vite/client</code> 里的字面量 — 一次烤好, 之后所有浏览器拿到的是同一份。所以 <code>clientPort: 443</code> 让 Funnel 入口通的同时, 也让 localhost 入口去连不存在的 <code>wss://localhost:443</code>, 一起踩坑。</>}
                  en={<>Vite bakes the HMR config into <code>/@vite/client</code> at dev-server startup — once baked, every browser receives the same file. So <code>clientPort: 443</code> made the Funnel entry work AND made the localhost entry try a non-existent <code>wss://localhost:443</code>. Same trap for everyone.</>}
                />
              </p>
            </article>
            <article className="arch-detail">
              <h3 className="arch-detail-title"><L zh="解法:删 override, 让 page URL 自己说话" en="The fix: delete the override, let the page URL speak" /></h3>
              <p className="arch-detail-body">
                <L
                  zh={<>删掉 <code>hmr</code> 整段, Vite 把客户端里的 <code>__HMR_PORT__</code> / <code>__HMR_PROTOCOL__</code> 注成 <code>null</code>。客户端用 <code>null || X</code> 短路 fallback 到 <code>importMetaUrl.port</code> / <code>protocol</code> — 浏览器加载这份 JS 时的 URL 就是事实。两端各自拿到自己该用的值, 不需要服务端任何条件分发。</>}
                  en={<>After deleting the <code>hmr</code> block, Vite injects <code>__HMR_PORT__</code> / <code>__HMR_PROTOCOL__</code> as <code>null</code>. The client falls through <code>null || X</code> to <code>importMetaUrl.port</code> / <code>protocol</code> — the URL of the JS itself. Each entry computes its own correct values, no server-side conditional needed.</>}
                />
              </p>
            </article>
            <article className="arch-detail">
              <h3 className="arch-detail-title"><L zh="关键巧合:URL.port 对默认端口返回空串" en="The hidden trick: URL.port returns '' for default ports" /></h3>
              <p className="arch-detail-body">
                <L
                  zh={<>这是 URL 规范的细节:对 <code>https://host/</code>, <code>new URL(...).port</code> 返回 <strong>空串</strong>, 不是 <code>"443"</code>。所以手机端拼出来的 ws URL 长这样:<code>wss://host:/</code> — 末尾一个孤零零的 <code>":"</code>。浏览器规范化这种 URL 时直接把 <code>":"</code> 去掉, 端口回退到 scheme 默认 443 — 也正好是 Funnel 暴露的公开端口。两边天然对齐。</>}
                  en={<>This is a quiet URL-spec detail: for <code>https://host/</code>, <code>new URL(...).port</code> returns <strong>an empty string</strong>, not <code>"443"</code>. So the phone derives <code>wss://host:/</code> — a stray trailing <code>":"</code> and nothing after. Browsers normalize that away and fall back to the scheme default 443 — which happens to be exactly Funnel's public port. Things line up for free.</>}
                />
              </p>
            </article>
            <article className="arch-detail">
              <h3 className="arch-detail-title"><L zh="为什么 Funnel 单端口能同时跑 HTTP + WS" en="Why Funnel's single port carries HTTP and WS together" /></h3>
              <p className="arch-detail-body">
                <L
                  zh={<>Vite dev server 是一个 <code>http.Server</code>, 在 5173 上同时接 HTTP 请求和 <code>Upgrade: websocket</code> 升级。所以 Funnel 那条 <code>:443 → :5173</code> 单一映射, 既转 HTML/JS 静态请求也转 WS upgrade, 一个端口够用。HMR 不需要单独再开一条 Funnel 规则。</>}
                  en={<>Vite's dev server is one <code>http.Server</code> handling both regular HTTP requests and <code>Upgrade: websocket</code> on port 5173. So Funnel's single <code>:443 → :5173</code> mapping carries both the static HTML/JS and the WS upgrade — one port is enough. HMR doesn't need its own Funnel rule.</>}
                />
              </p>
            </article>
          </div>
        </section>

        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">10</span>
            <h2 className="arch-sec-title"><L zh="一次请求穿越几层:点 tab 看高亮" en="A request walks the stack: click a tab to highlight" /></h2>
          </div>
          <p className="arch-sec-lede">
            <L
              zh={<>第 03 节给了"理想读请求"的时间轴, 但实际不是所有 URL 都走全程。点下面 4 个 tab, 看每种请求各点亮哪些层 — 有的连 SPA 都不启动, 有的在 nginx 那层就 hit cache 返回, 有的整条管道穿透。</>}
              en={<>Section 03 sketches the "ideal read" timeline, but real URLs don't all walk the full path. Click the four tabs below to see which stages each pattern lights up — some never boot the SPA, some hit cache at nginx, some pierce all the way through.</>}
            />
          </p>
          <div className="arch-diagram tracer-frame">
            <RequestTracer />
          </div>
        </section>

        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">11</span>
            <h2 className="arch-sec-title"><L zh="时间线:近一年的关键改动" en="Timeline: the past year's key changes" /></h2>
          </div>
          <p className="arch-sec-lede">
            <L
              zh={<>项目 2025-12-13 诞生 (一个空的 index.html), 到现在 5 个月、2300+ 提交。<strong>列表视图</strong>只挑 14 件重大改动讲清楚因果; <strong>日历视图</strong>把每天的"非琐碎"提交全列出来 (feat/refactor/perf/i18n, 每天最多 3 条), 看哪些天密集打代码、哪些天在排版。</>}
              en={<>The project was born on 2025-12-13 — a single empty index.html. Five months and 2300+ commits later: the <strong>list view</strong> tells the story through 14 major changes; the <strong>calendar view</strong> shows every "non-trivial" commit by date (feat/refactor/perf/i18n, capped at 3 per day) so you can see which days were heads-down coding and which were just polish.</>}
            />
          </p>
          <HistoryView />
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
