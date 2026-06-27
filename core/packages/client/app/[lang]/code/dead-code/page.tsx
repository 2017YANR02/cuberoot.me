'use client';

// /code/dead-code — 介绍 knip + 本站三层死代码守卫。自包含静态内容,跟 /code 系其他页独立设计(art-directed dark)。

import { useState } from 'react';
import Link from '@/components/AppLink';
import { Check, Copy, FileX2, PackageX, FunctionSquare, Terminal, ShieldCheck, Layers } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './dead-code.css';
import { tr, useLang } from '@/i18n/tr';

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="dc-code">
      {label && <div className="dc-code-label">{label}</div>}
      <button type="button" className="dc-code-copy" onClick={onCopy} aria-label={copied ? 'Copied' : 'Copy'}>
        {copied ? <Check size={13} /> : <Copy size={13} />}
        <span>{copied ? 'copied' : 'copy'}</span>
      </button>
      <pre className="dc-code-pre"><code>{code}</code></pre>
    </div>
  );
}

interface DetectCard {
  Icon: typeof FileX2;
  tag: string;
  zh: { title: string; desc: string };
  en: { title: string; desc: string };
  guarded: boolean;
}

const DETECTS: DetectCard[] = [
  {
    Icon: FileX2, tag: 'files', guarded: true,
    zh: { title: '没人 import 的文件', desc: '整个文件没有任何入口能到达 —— 最值钱的一类,直接删。' },
    en: { title: 'Unreachable files', desc: 'Whole modules no entry point can reach. The highest-value category — just delete.' },
  },
  {
    Icon: PackageX, tag: 'dependencies', guarded: true,
    zh: { title: '装了没用的依赖', desc: 'package.json 里声明、代码里却没人用的包。拖慢 install、撑大 lockfile。' },
    en: { title: 'Unused dependencies', desc: 'Packages declared in package.json that nothing imports. Slows install, bloats the lockfile.' },
  },
  {
    Icon: PackageX, tag: 'unlisted', guarded: true,
    zh: { title: '用了没声明的依赖', desc: '代码 import 了、package.json 里却没列的包。靠传递依赖侥幸能跑,迟早炸。' },
    en: { title: 'Unlisted dependencies', desc: 'Packages the code imports but package.json never declares. Works by transitive luck until it breaks.' },
  },
  {
    Icon: Terminal, tag: 'binaries', guarded: true,
    zh: { title: '脚本里调的幽灵命令', desc: 'package.json scripts 调了、却没作为依赖装的命令行工具。' },
    en: { title: 'Phantom binaries', desc: 'CLI tools invoked in package.json scripts but never installed as a dependency.' },
  },
  {
    Icon: FunctionSquare, tag: 'exports', guarded: false,
    zh: { title: '没人用的 export', desc: '导出了却无人 import 的函数 / 类型 / 常量。本站存量大(过度导出),暂不卡 CI,留待逐步收敛。' },
    en: { title: 'Unused exports', desc: 'Functions / types / consts exported but never imported. Large backlog here (over-export) — not gated in CI yet.' },
  },
];

interface LayerCard {
  n: string;
  Icon: typeof Layers;
  status: 'on' | 'skip';
  zh: { title: string; when: string; desc: string };
  en: { title: string; when: string; desc: string };
}

const LAYERS: LayerCard[] = [
  {
    n: '0', Icon: ShieldCheck, status: 'on',
    zh: { title: 'tsconfig 编译期', when: '写入 / typecheck 即拦', desc: 'noUnusedLocals + noUnusedParameters。未用的 import / 局部变量 / 参数在 CI typecheck(tsgo)直接红,最便宜的一层。' },
    en: { title: 'tsconfig compile-time', when: 'caught at typecheck', desc: 'noUnusedLocals + noUnusedParameters. Unused imports / locals / params turn CI typecheck (tsgo) red. The cheapest layer.' },
  },
  {
    n: '1', Icon: Layers, status: 'skip',
    zh: { title: 'eslint unused-imports', when: '评估后跳过', desc: 'Layer 0 开了之后高度冗余 —— 未用 import / 变量已被编译期拦死。唯一增量是 eslint --fix 自动删,不值得为此再挂一套 lint。' },
    en: { title: 'eslint unused-imports', when: 'evaluated, skipped', desc: 'Highly redundant once Layer 0 is on — unused imports / locals are already caught at compile-time. Only upside is auto-fix; not worth a whole lint pass.' },
  },
  {
    n: '2', Icon: ShieldCheck, status: 'on',
    zh: { title: 'knip CI 棘轮', when: 'commit / CI 兜底', desc: '跨文件的死文件 / 依赖 / 幽灵命令编译期看不见,交给 knip 在 CI 卡。已清零的四类用硬门槛锁住,新债直接红。' },
    en: { title: 'knip CI ratchet', when: 'caught in CI', desc: 'Cross-file dead files / deps / phantom binaries are invisible to the compiler — knip gates them in CI. The four cleared categories are hard-locked; new debt turns red.' },
  },
];

const KNIP_JSON = `{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "ignore": ["cube555-daemon/**", "**/pkg/*_bg.wasm.d.ts"],
  "ignoreBinaries": ["netstat", "wasm-pack"],
  "ignoreDependencies": ["tsx"],
  "workspaces": {
    "packages/client": {
      "entry": [
        "app/**/{page,layout,route,...}.{ts,tsx}",
        "scripts/**/*.{mjs,cjs,mts,ts}",
        "tests/**/*.{ts,tsx,cjs,mjs}"
      ],
      "ignore": ["public/**", "**/sim/**"]
    }
    // ...server / *-build 各包入口
  }
}`;

const CI_GUARD = `# .github/workflows/test.yml — 只卡已清零的四类,
# 不卡 unused exports/types(过度导出噪声,另行收敛)
pnpm exec knip \\
  --include files,dependencies,unlisted,binaries \\
  --no-config-hints`;

const RUN_LOCAL = `# 本地全量扫(含 exports/types 噪声)
pnpm exec knip

# 只看 CI 卡的四类(应为空)
pnpm exec knip --include files,dependencies,unlisted,binaries`;

export default function DeadCodePage() {
  const lang = useLang();

  useDocumentTitle('死代码守卫', 'Dead Code Guard');

  const results = [
    { num: '27', zh: '个死文件清除', en: 'dead files removed' },
    { num: '3', zh: '个未用依赖', en: 'unused deps' },
    { num: '11', zh: '个未用符号', en: 'unused symbols' },
    { num: '0', zh: '现存逃逸', en: 'offenders now' },
  ];

  return (
    <div className="dc-page">
      <div className="dc-bg" aria-hidden="true" />
      <div className="dc-bg-glow" aria-hidden="true" />

      <div className="dc-shell">
        <div className="dc-topbar">
          <Link href="/code" className="dc-back">← /code</Link>
        </div>

        <header className="dc-hero">
          <div className="dc-hero-tag">// {tr({ zh: '死代码防治', en: 'dead-code prevention' })} · knip 6.21</div>
          <h1 className="dc-hero-title">
            dead-code<span className="dc-hero-cursor">_</span>
          </h1>
          <p className="dc-hero-sub">
            {tr({
              zh: '没人调用的文件、装了不用的依赖、导出却无人 import 的函数 —— 多 AI 并行开发下,死代码堆得飞快。这页讲我们怎么用 knip 把它扫干净,再用三层守卫把它挡在门外。',
              en: 'Files nobody calls, dependencies nobody uses, exports nobody imports — under multi-AI parallel development, dead code piles up fast. Here is how we sweep it with knip, then keep it out with a three-layer guard.',
            })}
          </p>
          <div className="dc-hero-stats">
            {results.map((r) => (
              <div className="dc-stat" key={r.num}>
                <span className="dc-stat-num">{r.num}</span>
                <span className="dc-stat-label">{tr(r)}</span>
              </div>
            ))}
          </div>
        </header>

        {/* 01 — why knip */}
        <section className="dc-section">
          <header className="dc-sec-head">
            <span className="dc-sec-num">01</span>
            <h2 className="dc-sec-title">{tr({ zh: '为什么是 knip', en: 'Why knip' })}</h2>
          </header>
          <div className="dc-prose">
            <p>
              {tr({
                zh: 'knip 是 JS/TS 单仓(monorepo)死代码检测的事实标准:从你声明的入口出发做可达性分析,一次报出没人用的文件、导出、依赖、以及脚本里调的幽灵命令。它看的是「整个项目」的依赖图,这正是单文件 linter 看不到的盲区。',
                en: 'knip is the de-facto standard for dead-code detection in JS/TS monorepos: starting from the entry points you declare, it does reachability analysis and reports unused files, exports, dependencies, and phantom binaries in one pass. It sees the whole-project dependency graph — exactly the blind spot a per-file linter has.',
              })}
            </p>
            <p>
              {tr({
                zh: '到 2026 年它仍是首选:老牌的 ts-prune 早已归档停更;Biome、oxlint 很快但本质是 linter,管不了「跨文件没人 import 的整个文件 / 依赖」这类全局问题。knip 名场面是 Vercel 用它一口气删掉约 30 万行死代码。',
                en: 'In 2026 it is still the first pick: the older ts-prune is long archived; Biome and oxlint are fast but are linters at heart — they cannot answer whole-project questions like "this entire file / dependency is imported by nobody". knip is famous for letting Vercel delete ~300k lines of dead code in one sweep.',
              })}
            </p>
          </div>
        </section>

        {/* 02 — what it detects */}
        <section className="dc-section">
          <header className="dc-sec-head">
            <span className="dc-sec-num">02</span>
            <h2 className="dc-sec-title">{tr({ zh: 'knip 抓什么', en: 'What knip detects' })}</h2>
            <p className="dc-sec-desc">
              {tr({ zh: '带 CI 标的四类已在本站 CI 卡死;exports 暂不卡(存量大,另行收敛)。', en: 'The four CI-tagged categories are gated here; exports is not gated yet (large backlog, converging separately).' })}
            </p>
          </header>
          <div className="dc-detect-grid">
            {DETECTS.map((d) => {
              const t = d[lang];
              const Icon = d.Icon;
              return (
                <div className={`dc-detect-card${d.guarded ? ' is-guarded' : ''}`} key={d.tag}>
                  <div className="dc-detect-head">
                    <Icon size={16} strokeWidth={2} />
                    <span className="dc-detect-tag">{d.tag}</span>
                    {d.guarded
                      ? <span className="dc-detect-badge on">CI</span>
                      : <span className="dc-detect-badge off">{tr({ zh: '暂缓', en: 'later' })}</span>}
                  </div>
                  <h3 className="dc-detect-title">{t.title}</h3>
                  <p className="dc-detect-desc">{t.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 03 — three layer guard */}
        <section className="dc-section">
          <header className="dc-sec-head">
            <span className="dc-sec-num">03</span>
            <h2 className="dc-sec-title">{tr({ zh: '三层守卫', en: 'Three-layer guard' })}</h2>
            <p className="dc-sec-desc">
              {tr({ zh: '立约束先问「最早能卡在哪」:编译期 + CI 多层一起铺,别只做事后那层。', en: 'When setting a constraint, ask "what is the earliest gate": stack compile-time + CI together, not just the after-the-fact layer.' })}
            </p>
          </header>
          <div className="dc-layer-list">
            {LAYERS.map((l) => {
              const t = l[lang];
              const Icon = l.Icon;
              return (
                <div className={`dc-layer-card status-${l.status}`} key={l.n}>
                  <div className="dc-layer-n">{l.n}</div>
                  <div className="dc-layer-body">
                    <div className="dc-layer-head">
                      <Icon size={15} strokeWidth={2} />
                      <h3 className="dc-layer-title">{t.title}</h3>
                      <span className={`dc-layer-when ${l.status}`}>{t.when}</span>
                    </div>
                    <p className="dc-layer-desc">{t.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 04 — config + commands */}
        <section className="dc-section">
          <header className="dc-sec-head">
            <span className="dc-sec-num">04</span>
            <h2 className="dc-sec-title">{tr({ zh: '配置与命令', en: 'Config & commands' })}</h2>
            <p className="dc-sec-desc">
              {tr({ zh: '配置在 core/knip.json:显式列出 Next App Router 入口,忽略 public/ 运行时资产与活跃改动目录。', en: 'Config lives in core/knip.json: entry points are listed explicitly, public/ runtime assets and actively-edited dirs are ignored.' })}
            </p>
          </header>
          <CodeBlock code={KNIP_JSON} label="core/knip.json" />
          <CodeBlock code={CI_GUARD} label={tr({ zh: 'CI 守卫', en: 'CI guard' })} />
          <CodeBlock code={RUN_LOCAL} label={tr({ zh: '本地跑', en: 'run locally' })} />
        </section>

        <footer className="dc-foot">
          <span className="dc-foot-text">{tr({ zh: '清零后用硬门槛锁,新债直接红', en: 'cleared to zero, then hard-locked — new debt turns red' })}</span>
          <Link href="/code" className="dc-foot-link">/code</Link>
        </footer>
      </div>
    </div>
  );
}
