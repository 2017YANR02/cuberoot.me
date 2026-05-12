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

interface Stat {
  value: string;
  zh: string;
  en: string;
}
const STATS: Stat[] = [
  { value: '5', zh: '个 monorepo 包', en: 'monorepo packages' },
  { value: '14', zh: '个独立模块', en: 'modules' },
  { value: '80+', zh: '个 WCA 统计页', en: 'WCA stat pages' },
  { value: '41', zh: '套 alg 公式库', en: 'algorithm sets' },
  { value: '24+', zh: '个工具页面', en: 'tool pages' },
];

interface Layer {
  tag: string;
  accent: string;
  zh: { title: string; tech: string; desc: string };
  en: { title: string; tech: string; desc: string };
}
const LAYERS: Layer[] = [
  {
    tag: 'Frontend',
    accent: '#61DAFB',
    zh: {
      title: '客户端 SPA',
      tech: 'React 19 · Vite 8 · TypeScript',
      desc: '全部 24+ 个工具页面跑在同一个 SPA 里，React Router 切路由。Vite 8 dev 启动 < 1 秒，HMR 即时。tsc -b 增量类型检查，~12 秒首次、之后秒级。',
    },
    en: {
      title: 'Client SPA',
      tech: 'React 19 · Vite 8 · TypeScript',
      desc: 'All 24+ tool pages live in one SPA, React Router for routing. Vite 8 dev server boots in < 1s with instant HMR. Incremental typecheck via tsc -b: ~12s cold, sub-second after.',
    },
  },
  {
    tag: 'Backend',
    accent: '#5BA8FF',
    zh: {
      title: 'API 服务',
      tech: 'Hono · PostgreSQL 13 · WCA OAuth',
      desc: 'Hono 跑在 Node + pm2 上,反代到 api.cuberoot.me。PG 13 存 recon 数据、alg 公式库、WCA 统计衍生表。2026-05 从 MariaDB 整体迁过来,一刀切。',
    },
    en: {
      title: 'API service',
      tech: 'Hono · PostgreSQL 13 · WCA OAuth',
      desc: 'Hono on Node + pm2, reverse-proxied to api.cuberoot.me. PG 13 holds recon data, the alg library, and derived WCA statistics. Migrated wholesale from MariaDB in 2026-05.',
    },
  },
  {
    tag: 'Build',
    accent: '#F69220',
    zh: {
      title: '工作区与构建',
      tech: 'pnpm 10 · Turbo · GitHub Actions',
      desc: 'core/ 是 pnpm + Turbo monorepo。CI 每次只跑改动到的 package。WCA 统计管道独立运行，每周从 dump 全量重算 80+ 个 stats JSON。',
    },
    en: {
      title: 'Workspace & build',
      tech: 'pnpm 10 · Turbo · GitHub Actions',
      desc: 'core/ is a pnpm + Turbo monorepo. CI only re-runs packages that changed. The WCA stats pipeline runs on its own weekly cadence, regenerating 80+ stat JSONs from the dump.',
    },
  },
  {
    tag: 'Deploy',
    accent: '#76B900',
    zh: {
      title: '部署拓扑',
      tech: '云服务器 nginx · GH Pages 镜像 · CloudFlare DNS',
      desc: '主站 cuberoot.me 由云服务器 nginx 直接服。ruiminyan.github.io 是 GH Pages 兜底镜像，自动 301 → cuberoot.me。nginx vhost 入 git，改完 push 自动 scp + reload。',
    },
    en: {
      title: 'Deploy topology',
      tech: 'Cloud nginx · GH Pages mirror · CloudFlare DNS',
      desc: 'Primary site cuberoot.me is served by nginx on a cloud VM. ruiminyan.github.io is a GitHub Pages fallback mirror, auto-301 to cuberoot.me. nginx vhost lives in git — push triggers scp + reload.',
    },
  },
];

interface Pkg {
  name: string;
  zh: { role: string; detail: string };
  en: { role: string; detail: string };
}
const PACKAGES: Pkg[] = [
  {
    name: 'client',
    zh: { role: 'React SPA — 全部 UI', detail: 'pages/ 一页一目录,components/ 共享组件,utils/ 工具(api_base / flag / format_result 等)' },
    en: { role: 'React SPA — all UI', detail: 'pages/ one folder per page; components/ shared widgets; utils/ helpers (api_base / flag / format_result …)' },
  },
  {
    name: 'server',
    zh: { role: 'Hono API + PG', detail: 'WCA OAuth、recon CRUD、alg 公式库 CRUD、训练数据上报、跨域 allowlist' },
    en: { role: 'Hono API + PG', detail: 'WCA OAuth, recon CRUD, alg library CRUD, training-data ingest, CORS allowlist' },
  },
  {
    name: 'shared',
    zh: { role: '共享类型', detail: 'client/server 都引;不能 import client utils(纯类型 + import.meta 检测)' },
    en: { role: 'Shared types', detail: 'Imported by both client and server; must not pull in client utils (pure types + import.meta guard)' },
  },
  {
    name: 'stats-build',
    zh: { role: 'WCA 统计管道', detail: '80+ SQL-driven 统计,周更 CI;基于 jonatanklosko/wca_statistics TS 重写' },
    en: { role: 'WCA stats pipeline', detail: '80+ SQL-driven statistics, weekly CI; TS rewrite of jonatanklosko/wca_statistics' },
  },
  {
    name: 'stats-ui',
    zh: { role: '统计页 UI', detail: '为 80+ 个 stat 提供通用渲染壳;client 通过 lazy() 加载' },
    en: { role: 'Stats UI', detail: 'Generic rendering shell for the 80+ stat pages; client lazy-loads it' },
  },
];

interface ModuleRow {
  route: string;
  zhName: string;
  enName: string;
  zhDesc: string;
  enDesc: string;
  origin: 'own' | 'fork' | 'port';
  originLabel: string;
}
const MODULES: ModuleRow[] = [
  { route: '/recon', zhName: '复盘', enName: 'Recon', zhDesc: '比赛成绩复盘 + 同轮自动带入', enDesc: 'Competition result review + same-round autofill', origin: 'own', originLabel: 'own' },
  { route: '/trainer', zhName: '公式训练', enName: 'Trainer', zhDesc: '41 套公式计时训练', enDesc: '41 algorithm sets with timed drills', origin: 'own', originLabel: 'own' },
  { route: '/calc', zhName: '成绩计算', enName: 'Calc', zhDesc: 'HTH 成绩计算器', enDesc: 'HTH score calculator', origin: 'port', originLabel: 'port' },
  { route: '/battle', zhName: '1v1 对战', enName: 'Battle', zhDesc: '双人计时对战', enDesc: 'Two-player race timer', origin: 'port', originLabel: 'port' },
  { route: '/frame-count', zhName: '逐帧计时', enName: 'Frame Count', zhDesc: 'WebCodecs + mp4box.js 视频抽帧', enDesc: 'WebCodecs + mp4box.js video frame stepping', origin: 'own', originLabel: 'own' },
  { route: '/viz', zhName: '成绩分布', enName: 'Distribution', zhDesc: 'WCA 成绩分布可视化', enDesc: 'WCA result distribution viz', origin: 'own', originLabel: 'own' },
  { route: '/calendar', zhName: '比赛日历', enName: 'Calendar', zhDesc: '全球 WCA 比赛日历', enDesc: 'Global WCA competition calendar', origin: 'own', originLabel: 'own' },
  { route: '/scramble-stats', zhName: '打乱难度', enName: 'Scramble', zhDesc: 'WCA 打乱难度分布', enDesc: 'WCA scramble difficulty distribution', origin: 'own', originLabel: 'own' },
  { route: '/wca-stats', zhName: 'WCA 统计', enName: 'WCA Stats', zhDesc: '80+ 统计页,周更', enDesc: '80+ statistics pages, weekly refresh', origin: 'own', originLabel: 'own' },
  { route: '/recognize/pll', zhName: 'PLL 识别', enName: 'Recognize', zhDesc: '看图答字母训练', enDesc: 'Image-to-letter recognition drill', origin: 'own', originLabel: 'own' },
  { route: '/mosaic', zhName: '马赛克', enName: 'Mosaic', zhDesc: '魔方拼图生成器', enDesc: 'Cube mosaic generator', origin: 'port', originLabel: 'port' },
  { route: '/cstimer', zhName: 'csTimer', enName: 'csTimer', zhDesc: '集成 cs0x7f/cstimer', enDesc: 'Integrated cs0x7f/cstimer', origin: 'fork', originLabel: 'fork' },
  { route: '/solver', zhName: '复原求解器', enName: 'Solver', zhDesc: 'fork of or18/RubiksSolverDemo', enDesc: 'fork of or18/RubiksSolverDemo', origin: 'fork', originLabel: 'fork' },
  { route: '/alg-trainers', zhName: '公式训练器', enName: 'Alg Trainers', zhDesc: 'fork of mihlefeld/Alg-Trainers', enDesc: 'fork of mihlefeld/Alg-Trainers', origin: 'fork', originLabel: 'fork' },
];

interface Highlight {
  glyph: string;
  zh: { title: string; desc: string };
  en: { title: string; desc: string };
}
const HIGHLIGHTS: Highlight[] = [
  {
    glyph: '⌬',
    zh: {
      title: 'cubing.js — 一切动画与求解',
      desc: 'TwistyPlayer 渲染所有魔方动画,Cube333 / Cube444 求解器跑在主线程,SquareOne / Megaminx 用 sr-puzzlegen 出 SVG。npm 上 0.50.x,已是依赖。',
    },
    en: {
      title: 'cubing.js for animation + solving',
      desc: 'TwistyPlayer renders every cube animation; Cube333/Cube444 solvers run on the main thread; SquareOne/Megaminx use sr-puzzlegen for SVG. cubing@0.50.x, already a dependency.',
    },
  },
  {
    glyph: '⌗',
    zh: {
      title: 'visualcube — 立方体状态图',
      desc: '所有 NxN 立方体状态图(F2L/OLL/PLL/ZBLL 等)统一走 @cuberoot/visualcube。手写 SVG 是反面教材,被全数删除。',
    },
    en: {
      title: 'visualcube for cube-state images',
      desc: 'Every NxN cube-state image (F2L/OLL/PLL/ZBLL …) goes through @cuberoot/visualcube. Hand-written SVG is forbidden — the legacy MiniCube.tsx was a cautionary tale, now removed.',
    },
  },
  {
    glyph: '⌖',
    zh: {
      title: 'COOP / COEP — SharedArrayBuffer',
      desc: '/scramble/solver 和 /scramble/analyzer 跑 cubeopt-wasm,需要 SharedArrayBuffer。仅这两条 route 由 nginx 注 COOP=same-origin + COEP=require-corp,其他 24 张卡完全干净。',
    },
    en: {
      title: 'COOP / COEP for SharedArrayBuffer',
      desc: '/scramble/solver and /scramble/analyzer run cubeopt-wasm and need SharedArrayBuffer. Only those two routes get COOP=same-origin + COEP=require-corp from nginx; every other page stays clean.',
    },
  },
  {
    glyph: '⛯',
    zh: {
      title: 'WCA 统计的三段管道',
      desc: 'CI 跑 stats-build 算出 80+ 个 JSON + 月级 TSV,scp 到云服务器,服务器 \\copy 入 PG,Hono API 出口,nginx 24h 缓存。改一处必同步三处:builder / scp 清单 / load.sql。',
    },
    en: {
      title: 'WCA stats — a three-stage pipeline',
      desc: 'CI runs stats-build to produce 80+ JSON + monthly TSVs; scp to the cloud VM; \\copy into PG; Hono API exposes it; nginx caches 1 day. Change one stage and you must update all three: builder, scp manifest, load.sql.',
    },
  },
  {
    glyph: '⚙',
    zh: {
      title: 'i18n — 中英双语',
      desc: '两种模式并存:t() + JSON keys(大段文案)和 isZh ? "X" : "Y" 三元(组件内零散文案)。LangToggle 在每页头部右上角,默认跟系统语言。',
    },
    en: {
      title: 'Bilingual zh / en',
      desc: 'Two patterns coexist: t() + JSON keys for long blocks; isZh ? "X" : "Y" ternaries for inline strings. LangToggle sits top-right on every page, defaults to system locale.',
    },
  },
  {
    glyph: '⏚',
    zh: {
      title: '凡是 fetch 都走 apiUrl()',
      desc: '客户端不能硬编码 origin。utils/api_base.ts 的 apiUrl() 在 dev 时走 Vite proxy,prod 时打 api.cuberoot.me。跨域白名单在 server/src/index.ts 的 CORS 中间件。',
    },
    en: {
      title: 'Every fetch goes through apiUrl()',
      desc: 'Client never hardcodes origin. utils/api_base.ts → apiUrl() routes to Vite proxy in dev and api.cuberoot.me in prod. The CORS allowlist lives in server/src/index.ts.',
    },
  },
];

export default function CodeArchitecturePage() {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language.startsWith('zh') ? 'zh' : 'en';

  useEffect(() => {
    document.title = lang === 'zh' ? '站点架构 — CubeRoot' : 'Site Architecture — CubeRoot';
  }, [lang]);

  return (
    <LangCtx.Provider value={lang}>
      <div className="arch-root">
        <div className="arch-bg" />

        <header className="arch-head">
          <div className="arch-topbar">
            <Link to="/" className="arch-back">
              ← <L zh="回首页" en="Home" />
            </Link>
            <LangToggle variant="inline" />
          </div>
          <h1 className="arch-title">
            <span className="arch-title-prefix">/</span>code<span className="arch-title-prefix">/</span>architecture
            <span className="arch-title-cursor">_</span>
          </h1>
          <p className="arch-sub">
            <L
              zh={<>CubeRoot 是怎么搭起来的:一个 React SPA + Hono API + PostgreSQL 数据库 + nginx 入口,加上一条独立跑的 WCA 统计管道。这页讲完每一层。</>}
              en={<>How CubeRoot is put together: a React SPA, a Hono API, a PostgreSQL database, an nginx entrypoint, plus a separately-running WCA statistics pipeline. This page walks every layer.</>}
            />
          </p>
          <div className="arch-meta">
            <span><L zh="最近更新" en="Last updated" /></span>
            <span className="arch-meta-dot">·</span>
            <span>2026.05</span>
            <span className="arch-meta-dot">·</span>
            <Link to="/code/language" className="arch-meta-link">
              <L zh="看编程语言导览 →" en="Programming languages →" />
            </Link>
          </div>
        </header>

        <section className="arch-section">
          <h2 className="arch-section-title">
            <span className="arch-section-tag">// 01</span>
            <L zh="一眼看清楚" en="At a glance" />
          </h2>
          <div className="arch-stats">
            {STATS.map((s) => (
              <div key={s.value} className="arch-stat">
                <div className="arch-stat-v">{s.value}</div>
                <div className="arch-stat-l">{lang === 'zh' ? s.zh : s.en}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="arch-section">
          <h2 className="arch-section-title">
            <span className="arch-section-tag">// 02</span>
            <L zh="四层栈" en="Four-layer stack" />
          </h2>
          <div className="arch-layers">
            {LAYERS.map((l) => {
              const t = l[lang];
              return (
                <div key={l.tag} className="arch-layer" style={{ ['--accent' as string]: l.accent }}>
                  <div className="arch-layer-tag">{l.tag}</div>
                  <div className="arch-layer-title">{t.title}</div>
                  <div className="arch-layer-tech">{t.tech}</div>
                  <p className="arch-layer-desc">{t.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="arch-section">
          <h2 className="arch-section-title">
            <span className="arch-section-tag">// 03</span>
            <L zh="Monorepo 五个包" en="Five packages in the monorepo" />
          </h2>
          <div className="arch-pkgs">
            {PACKAGES.map((p) => {
              const t = p[lang];
              return (
                <div key={p.name} className="arch-pkg">
                  <div className="arch-pkg-name">@cuberoot/{p.name}</div>
                  <div className="arch-pkg-role">{t.role}</div>
                  <div className="arch-pkg-detail">{t.detail}</div>
                </div>
              );
            })}
          </div>
          <pre className="arch-tree">{`core/
├── packages/
│   ├── client/         # React 19 + Vite 8 SPA
│   ├── server/         # Hono + PG 13
│   ├── shared/         # 共享类型
│   ├── stats-build/    # WCA 统计管道
│   └── stats-ui/       # 统计页通用 UI
├── pnpm-workspace.yaml
└── turbo.json`}</pre>
        </section>

        <section className="arch-section">
          <h2 className="arch-section-title">
            <span className="arch-section-tag">// 04</span>
            <L zh="14 个模块都在哪" en="Where the 14 modules live" />
          </h2>
          <div className="arch-mods">
            {MODULES.map((m) => (
              <Link key={m.route} to={m.route} className={`arch-mod arch-mod-${m.origin}`}>
                <div className="arch-mod-route">{m.route}</div>
                <div className="arch-mod-name">{lang === 'zh' ? m.zhName : m.enName}</div>
                <div className="arch-mod-desc">{lang === 'zh' ? m.zhDesc : m.enDesc}</div>
                <div className="arch-mod-badge">{m.originLabel}</div>
              </Link>
            ))}
          </div>
          <p className="arch-section-foot">
            <L
              zh={<>own = 自己写的;port = 把别人的 React/HTML 项目重写成本仓库的一部分;fork = upstream 静态资源原样托管,只改外层包装。改 fork / port 前先核对原作者。</>}
              en={<>own = built in-house; port = someone else's React/HTML project rewritten as part of this repo; fork = upstream assets hosted as-is, only the outer wrapper is mine. Touching a fork or port? Check upstream first.</>}
            />
          </p>
        </section>

        <section className="arch-section">
          <h2 className="arch-section-title">
            <span className="arch-section-tag">// 05</span>
            <L zh="一个请求是怎么走完的" en="The path of a request" />
          </h2>
          <pre className="arch-flow">{`Browser
  │ GET cuberoot.me/recon/abc
  ▼
nginx  (云服务器 :443)
  │ root /www/wwwroot/toolkit
  │ try_files → /index.html (SPA fallback)
  ▼
React SPA  (Vite-built bundle)
  │ fetch(apiUrl('/v1/recon/abc'))
  ▼
nginx  (api.cuberoot.me :443)
  │ proxy_pass → 127.0.0.1:3001
  │ proxy_cache /v1/wca/* (24h)
  ▼
Hono  (Node + pm2)
  │ pg pool → PostgreSQL 13
  ▼
JSON  →  React state  →  DOM`}</pre>
        </section>

        <section className="arch-section">
          <h2 className="arch-section-title">
            <span className="arch-section-tag">// 06</span>
            <L zh="WCA 统计的独立管道" en="The standalone WCA stats pipeline" />
          </h2>
          <pre className="arch-flow">{`GitHub Actions  (周更, ~2h)
  │ pull 最新 WCA dump → 本地 MySQL
  │ stats-build run  (80+ SQL, 1 TS process)
  ▼
artifacts/
  ├── stats/*.json           (80+ 个,前端直读)
  └── stats/*.copy.tsv       (月级行,跑得太多不进 JSON)
  ▼
scp → 云服务器:/root/stats-staging/
  ▼
ops/bin/load.sql
  │ \\copy 进 PG (8 张表)
  ▼
Hono /v1/wca-stats/*  →  nginx 24h cache  →  /wca-stats UI`}</pre>
          <p className="arch-section-foot">
            <L
              zh={<>三处必须同步:stats-build 的 builder.ts 写 TSV,stats.yml 的 scp 清单,load.sql 的 \\copy 引用 — 漏一处则服务器表静默为空。</>}
              en={<>Three places must stay in sync: builder.ts (which writes TSVs), the scp manifest in stats.yml, and the \\copy in load.sql. Miss any one and the server table silently goes empty.</>}
            />
          </p>
        </section>

        <section className="arch-section">
          <h2 className="arch-section-title">
            <span className="arch-section-tag">// 07</span>
            <L zh="技术亮点" en="Tech highlights" />
          </h2>
          <div className="arch-hl">
            {HIGHLIGHTS.map((h, i) => {
              const t = h[lang];
              return (
                <div key={i} className="arch-hl-card">
                  <div className="arch-hl-glyph">{h.glyph}</div>
                  <div className="arch-hl-body">
                    <div className="arch-hl-title">{t.title}</div>
                    <p className="arch-hl-desc">{t.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="arch-section">
          <h2 className="arch-section-title">
            <span className="arch-section-tag">// 08</span>
            <L zh="部署故事" en="Deploy story" />
          </h2>
          <div className="arch-deploy">
            <div className="arch-deploy-item">
              <div className="arch-deploy-host">cuberoot.me</div>
              <div className="arch-deploy-role">
                <L zh="主站。云服务器 nginx 直接服。" en="Primary site. Served directly by cloud nginx." />
              </div>
            </div>
            <div className="arch-deploy-item">
              <div className="arch-deploy-host">www.cuberoot.me</div>
              <div className="arch-deploy-role">
                <L zh="apex 301 → www,反过来也常见 — 这里两条都通。" en="apex 301 → www, or the other way around — both directions work." />
              </div>
            </div>
            <div className="arch-deploy-item">
              <div className="arch-deploy-host">api.cuberoot.me</div>
              <div className="arch-deploy-role">
                <L zh="同一台云服务器,nginx 反代到 127.0.0.1:3001 的 Hono。" en="Same VM, nginx reverse-proxies to Hono at 127.0.0.1:3001." />
              </div>
            </div>
            <div className="arch-deploy-item">
              <div className="arch-deploy-host">ruiminyan.github.io</div>
              <div className="arch-deploy-role">
                <L zh="GH Pages 镜像兜底,自动 301 → cuberoot.me。" en="GitHub Pages fallback mirror, auto-301 to cuberoot.me." />
              </div>
            </div>
            <div className="arch-deploy-item">
              <div className="arch-deploy-host">cuberoot.me/blog/</div>
              <div className="arch-deploy-role">
                <L zh="静态博客,Hugo 生成,2026-05 从 WordPress 整体迁过来。" en="Static blog generated by Hugo; migrated wholesale from WordPress in 2026-05." />
              </div>
            </div>
          </div>
        </section>

        <footer className="arch-foot">
          <div className="arch-foot-line">
            <L zh="开源地址" en="Source" />
            <span className="arch-meta-dot">·</span>
            <a href="https://github.com/ruiminyan/ruiminyan.github.io" target="_blank" rel="noreferrer">
              github.com/ruiminyan/ruiminyan.github.io
            </a>
          </div>
          <p className="arch-foot-note">
            <L
              zh={<>这页是 CubeRoot 的"内部说明书"。改任何模块前,先看一眼这里;改完了,再看一眼这里。</>}
              en={<>This page is CubeRoot's "internal handbook." Read it before touching any module; read it again after.</>}
            />
          </p>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
