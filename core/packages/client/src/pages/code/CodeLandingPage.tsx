import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LangToggle from '../../components/LangToggle';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import './code_landing.css';

interface Topic {
  slug: string;
  href: string;
  zh: { title: string; sub: string; tagline: string };
  en: { title: string; sub: string; tagline: string };
  accent: string;
  logo: React.ReactNode;
  available: boolean;
}

const TS_LOGO = (
  <svg viewBox="0 0 256 256" aria-hidden="true">
    <rect width="256" height="256" rx="28" fill="#3178C6" />
    <path
      fill="#fff"
      d="M56 116v12h28v82h14v-82h28v-12zm120 76c-9 0-16-3-21-9l11-7c3 4 8 6 12 6s9-2 9-7c0-4-3-6-10-9-13-5-19-11-19-22 0-13 10-21 23-21 9 0 16 3 21 10l-10 7c-3-4-7-6-11-6-5 0-8 3-8 6 0 4 3 6 11 9 12 4 19 11 19 21 0 14-11 22-27 22z"
    />
  </svg>
);

const TOPICS: Topic[] = [
  {
    slug: 'ts',
    href: '/code/language/ts',
    zh: {
      title: 'TypeScript',
      sub: 'JavaScript 的工程化升级',
      tagline: '从 2010 年立项到 2025 年成为 GitHub 第一语言、AI 工具链母语，14 年里发生了什么',
    },
    en: {
      title: 'TypeScript',
      sub: 'JavaScript, engineered',
      tagline: 'From 2010 inception to 2025: GitHub #1 language, native tongue of the AI tool chain',
    },
    accent: '#3178C6',
    logo: TS_LOGO,
    available: true,
  },
  {
    slug: 'rust',
    href: '/code/language/rust',
    zh: {
      title: 'Rust',
      sub: '系统编程的现代答卷',
      tagline: '从 2006 年 Graydon 的副业到 2025 年 Linux 内核接受 Rust 模块、AI 时代工具链被它重写一遍',
    },
    en: {
      title: 'Rust',
      sub: 'Systems, refined',
      tagline: 'From a 2006 side project by Graydon to Linux kernel modules in 2025 and a wholesale rewrite of the AI-era tool chain',
    },
    accent: '#CE422B',
    logo: <span className="topic-glyph">R</span>,
    available: true,
  },
  {
    slug: 'go',
    href: '/code/language/go',
    zh: {
      title: 'Go',
      sub: '简洁与并发',
      tagline: '从 2007 年 Google 的午饭后讨论到 Docker / K8s 撑起整个云原生底层、再到 2025 年 TypeScript 7 用它重写',
    },
    en: {
      title: 'Go',
      sub: 'Simplicity meets concurrency',
      tagline: 'From a 2007 Google lunch discussion to powering Docker / Kubernetes — and now the language Microsoft picked to rewrite TypeScript itself',
    },
    accent: '#00ADD8',
    logo: <span className="topic-glyph">Go</span>,
    available: true,
  },
  {
    slug: 'python',
    href: '/code/language/python',
    zh: {
      title: 'Python',
      sub: 'AI 时代的胶水语言',
      tagline: '1991 年 Guido 圣诞假期写的副业，35 年后是 PyTorch / Hugging Face / Jupyter 的母语，AI 研究界的事实标准',
    },
    en: {
      title: 'Python',
      sub: 'Glue of the AI era',
      tagline: 'A 1991 Christmas-break side project by Guido — 35 years on, the native tongue of PyTorch / Hugging Face / Jupyter and the AI research world',
    },
    accent: '#3776AB',
    logo: <span className="topic-glyph">Py</span>,
    available: true,
  },
  {
    slug: 'c',
    href: '/code/language/c',
    zh: {
      title: 'C',
      sub: '一切系统语言的祖宗',
      tagline: '1972 年 Bell Labs / Dennis Ritchie。Unix 的母语，Linux 内核 33M 行，AI 时代每个 GPU kernel 最终也是 C 调用',
    },
    en: {
      title: 'C',
      sub: 'Mother of all systems languages',
      tagline: 'Bell Labs / Dennis Ritchie, 1972. Unix\'s native tongue, 33M lines of Linux, and the language under every GPU kernel call in the AI era',
    },
    accent: '#03579B',
    logo: <span className="topic-glyph">C</span>,
    available: true,
  },
  {
    slug: 'cpp',
    href: '/code/language/cpp',
    zh: {
      title: 'C++',
      sub: 'AI 内核的母语',
      tagline: '1979 年 Stroustrup 的 "C with Classes"。现代 C++ 11/20/26 一路复兴。PyTorch / TensorFlow / Chrome / V8 / Unreal 全是 C++',
    },
    en: {
      title: 'C++',
      sub: 'Mother tongue of AI kernels',
      tagline: 'Stroustrup\'s "C with Classes," 1979. Modern C++ 11/20/26 keeps reviving. PyTorch / TensorFlow / Chrome / V8 / Unreal all C++ underneath',
    },
    accent: '#00599C',
    logo: <span className="topic-glyph">C++</span>,
    available: true,
  },
  {
    slug: 'zig',
    href: '/code/language/zig',
    zh: {
      title: 'Zig',
      sub: '系统编程的另一条路',
      tagline: '2016 年 Andrew Kelley 启动，0.16 仍未到 1.0。Bun / TigerBeetle / Ghostty 撑起一个新生态，2025 ZSF 拿到 $512K 史上最大产业捐款',
    },
    en: {
      title: 'Zig',
      sub: 'Another road for systems',
      tagline: 'Started by Andrew Kelley in 2016, still pre-1.0 at 0.16. Bun, TigerBeetle and Ghostty hold up a fresh ecosystem; ZSF pulled $512K — its largest industry pledge ever — in 2025',
    },
    accent: '#F7A41D',
    logo: <span className="topic-glyph">Zig</span>,
    available: true,
  },
  {
    slug: 'swift',
    href: '/code/language/swift',
    zh: {
      title: 'Swift',
      sub: 'Apple 的现代答卷',
      tagline: '2014 WWDC，Chris Lattner 主推。从替代 Objective-C 到 visionOS 钦定语言，再到 Embedded Swift / 服务端进军',
    },
    en: {
      title: 'Swift',
      sub: 'Apple\'s modern answer',
      tagline: 'WWDC 2014, led by Chris Lattner. From an Objective-C replacement to visionOS\'s anointed language, with Embedded Swift and server-side now in play',
    },
    accent: '#F05138',
    logo: <span className="topic-glyph">Sw</span>,
    available: true,
  },
  {
    slug: 'kotlin',
    href: '/code/language/kotlin',
    zh: {
      title: 'Kotlin',
      sub: 'JetBrains 的 Java 革命',
      tagline: '2010 圣彼得堡 Kotlin 岛起步，2016 1.0，2019 Android Kotlin-first，2024 Compose Multiplatform iOS 稳定 — 一份代码跑四端',
    },
    en: {
      title: 'Kotlin',
      sub: 'JetBrains\' Java revolution',
      tagline: 'Started near Kotlin Island in 2010, 1.0 in 2016, Android Kotlin-first in 2019, Compose Multiplatform stable on iOS in 2024 — one codebase, four targets',
    },
    accent: '#7F52FF',
    logo: <span className="topic-glyph">Kt</span>,
    available: true,
  },
  {
    slug: 'java',
    href: '/code/language/java',
    zh: {
      title: 'Java',
      sub: 'JVM 三十年的常青树',
      tagline: '1991 年 Sun 的 Oak 项目到 2026 仍是企业级 top 3，Java 21 虚拟线程让它在高并发服务端再次锋利',
    },
    en: {
      title: 'Java',
      sub: 'The JVM\'s evergreen',
      tagline: 'From Sun\'s 1991 Oak project to a top-3 enterprise language in 2026 — Java 21\'s virtual threads make it sharp again on high-concurrency servers',
    },
    accent: '#E76F00',
    logo: <span className="topic-glyph">Ja</span>,
    available: true,
  },
  {
    slug: 'javascript',
    href: '/code/language/javascript',
    zh: {
      title: 'JavaScript',
      sub: 'web 的母语',
      tagline: '1995 年 Brendan Eich 十天写出来的副业，30 年后是 GitHub 并列第一、AI 工具链生成最多的语言',
    },
    en: {
      title: 'JavaScript',
      sub: 'Native tongue of the web',
      tagline: 'A 10-day side project by Brendan Eich in 1995 — 30 years on, tied for #1 on GitHub and the most-generated language by AI tools',
    },
    accent: '#F7DF1E',
    logo: <span className="topic-glyph topic-glyph-dark">JS</span>,
    available: true,
  },
  {
    slug: 'mojo',
    href: '/code/language/mojo',
    zh: {
      title: 'Mojo',
      sub: 'AI 时代的 Python 加速出口',
      tagline: 'Chris Lattner 的第三门语言（LLVM → Swift → Mojo），2023 出生，2026 已是 CUDA 垄断的第一个可信挑战者',
    },
    en: {
      title: 'Mojo',
      sub: 'Python\'s acceleration off-ramp',
      tagline: 'Chris Lattner\'s third language (LLVM → Swift → Mojo). Born 2023, already the first credible challenger to the CUDA monopoly by 2026',
    },
    accent: '#FF4B00',
    logo: <span className="topic-glyph">Mo</span>,
    available: true,
  },
  {
    slug: 'csharp',
    href: '/code/language/csharp',
    zh: {
      title: 'C#',
      sub: '.NET 与 Unity 的双子语言',
      tagline: '2000 年 Anders Hejlsberg（Turbo Pascal / Delphi / 后来 TypeScript 同一人）回应 Java。从 Windows-only 到 .NET Core 开源，再到 Unity ~70% 游戏底层',
    },
    en: {
      title: 'C#',
      sub: 'Twin language of .NET and Unity',
      tagline: 'Anders Hejlsberg\'s 2000 answer to Java (same person behind Turbo Pascal, Delphi, and later TypeScript). From Windows-only to open-source .NET Core, plus ~70% of all games via Unity',
    },
    accent: '#512BD4',
    logo: <span className="topic-glyph">C#</span>,
    available: true,
  },
  {
    slug: 'ruby',
    href: '/code/language/ruby',
    zh: {
      title: 'Ruby',
      sub: '为程序员幸福而生',
      tagline: '1995 年 Matz 在日本发布，2004 年 DHH 抽出 Rails 推开 Web 2.0 黄金十年。2026 年 GitHub / Shopify / Stripe 仍跑在上面，YJIT 让它再次锋利',
    },
    en: {
      title: 'Ruby',
      sub: 'Optimised for programmer happiness',
      tagline: 'Matz released Ruby in Japan in 1995; in 2004 DHH extracted Rails and kicked off the Web 2.0 decade. GitHub / Shopify / Stripe still run on it in 2026, and YJIT has it sharp again',
    },
    accent: '#CC342D',
    logo: <span className="topic-glyph">Rb</span>,
    available: true,
  },
  {
    slug: 'php',
    href: '/code/language/php',
    zh: {
      title: 'PHP',
      sub: '半个互联网的后端',
      tagline: '1994 Rasmus 的个人主页脚本，30 年后 WordPress 占 40% 网站、Wikipedia 跑在它上面。PHP 7 性能 2 倍、8 JIT，从"fractal of bad design"翻身成熟语言',
    },
    en: {
      title: 'PHP',
      sub: 'Half the web\'s backend',
      tagline: 'Rasmus\'s 1994 personal-homepage script, 30 years later still powering ~40% of websites via WordPress plus Wikipedia. PHP 7 doubled perf, PHP 8 added a JIT — from "fractal of bad design" to mature platform',
    },
    accent: '#777BB4',
    logo: <span className="topic-glyph">Ph</span>,
    available: true,
  },
  {
    slug: 'lua',
    href: '/code/language/lua',
    zh: {
      title: 'Lua',
      sub: '嵌入语言之王',
      tagline: '1993 巴西 PUC-Rio，200KB 解释器 + 0 依赖。WoW / Roblox / Neovim / Redis / Nginx 全靠它，Mike Pall 一人撑起的 LuaJIT 性能直追 V8',
    },
    en: {
      title: 'Lua',
      sub: 'King of embedded languages',
      tagline: 'Born 1993 at PUC-Rio in Brazil. 200KB interpreter, zero dependencies. WoW / Roblox / Neovim / Redis / Nginx all run on it; Mike Pall\'s LuaJIT, written single-handed, rivals V8',
    },
    accent: '#2C2D72',
    logo: <span className="topic-glyph">Lu</span>,
    available: true,
  },
  {
    slug: 'haskell',
    href: '/code/language/haskell',
    zh: {
      title: 'Haskell',
      sub: '纯函数式的母语',
      tagline: '1987 Portland 委员会立项，monad / typeclass / lazy eval 的源头。Rust trait / Swift protocol / TS HKT 讨论都欠它一份血脉',
    },
    en: {
      title: 'Haskell',
      sub: 'Native tongue of pure FP',
      tagline: '1987 Portland committee. The wellspring of monads, type classes and lazy evaluation. Rust traits, Swift protocols, and TS HKT debates all owe Haskell a debt',
    },
    accent: '#5E5086',
    logo: <span className="topic-glyph">Hs</span>,
    available: true,
  },
  {
    slug: 'wasm',
    href: '/code/language/wasm',
    zh: {
      title: 'WebAssembly',
      sub: 'Web 的通用字节码',
      tagline: '2015 W3C 四家共建,2017 同年四浏览器齐发 MVP,2025 Component Model 1.0。Figma / Photoshop Web / Cloudflare Workers 都跑在它上面',
    },
    en: {
      title: 'WebAssembly',
      sub: 'A universal bytecode for the web',
      tagline: 'W3C four-vendor effort from 2015; MVP shipped by all four browsers in 2017; Component Model 1.0 in 2025. Figma, Photoshop on the Web, Cloudflare Workers all run on it',
    },
    accent: '#654FF0',
    logo: <span className="topic-glyph">Wa</span>,
    available: true,
  },
];

const MARKUP_TOPICS: Topic[] = [
  {
    slug: 'html',
    href: '/code/language/html',
    zh: {
      title: 'HTML',
      sub: 'web 的骨架',
      tagline: '1991 Tim Berners-Lee 在 CERN 发布第一个网站。35 年里 XHTML 试错、WHATWG vs W3C、HTML5 成 Living Standard，2024+ 持续重新吸收 JS 表面积',
    },
    en: {
      title: 'HTML',
      sub: 'Skeleton of the web',
      tagline: 'Tim Berners-Lee shipped the first website at CERN in 1991. 35 years of XHTML detours, WHATWG vs W3C, HTML5 becoming a Living Standard, and recent years quietly re-absorbing JS surface area',
    },
    accent: '#E34F26',
    logo: <span className="topic-glyph">Ht</span>,
    available: true,
  },
  {
    slug: 'css',
    href: '/code/language/css',
    zh: {
      title: 'CSS',
      sub: 'web 的造型语言',
      tagline: '1996 Håkon Wium Lie 提案。从 IE6 黑暗期到 2017 Grid 落地、2023 :has() / 容器查询。CSS-in-JS 退潮，"平台追上来了"',
    },
    en: {
      title: 'CSS',
      sub: 'Styling language of the web',
      tagline: 'Håkon Wium Lie\'s 1996 proposal. From the IE6 dark age to Grid in 2017 and :has() / container queries in 2023. CSS-in-JS receded — "the platform caught up"',
    },
    accent: '#1572B6',
    logo: <span className="topic-glyph">Cs</span>,
    available: true,
  },
];

const SCRIPT_TOPICS: Topic[] = [
  {
    slug: 'bash',
    href: '/code/language/bash',
    zh: {
      title: 'Bash',
      sub: '运维的胶水',
      tagline: '1989 Brian Fox 的 GNU "Bourne again"。35 年了仍是 CI / Dockerfile / 启动脚本的默认语言。人人讨厌、人人都写',
    },
    en: {
      title: 'Bash',
      sub: 'Glue of ops',
      tagline: 'Brian Fox\'s 1989 GNU "Bourne again". 35 years on, still the default of CI runners, Dockerfiles and bootstrap scripts. Everyone hates it; everyone writes it',
    },
    accent: '#4EAA25',
    logo: <span className="topic-glyph">$_</span>,
    available: true,
  },
  {
    slug: 'powershell',
    href: '/code/language/powershell',
    zh: {
      title: 'PowerShell',
      sub: '对象管道 · Windows 默认',
      tagline: '2006 Jeffrey Snover 在微软发布,基于 "Monad Manifesto" (2002)。管道传 .NET 对象不传文本; 2016 MIT 开源跨平台,2025 pwsh 7.5 跑在 .NET 9 上',
    },
    en: {
      title: 'PowerShell',
      sub: 'Object pipeline · Windows default',
      tagline: 'Jeffrey Snover shipped it at Microsoft in 2006, off the back of the 2002 Monad Manifesto. Pipes carry .NET objects, not text. MIT open-sourced and cross-platform in 2016; pwsh 7.5 on .NET 9 in 2025',
    },
    accent: '#5391FE',
    logo: <span className="topic-glyph">{'>_'}</span>,
    available: true,
  },
  {
    slug: 'sql',
    href: '/code/language/sql',
    zh: {
      title: 'SQL',
      sub: '数据的通用查询语',
      tagline: '1970 Codd 提关系模型，1974 IBM System R 设计 SEQUEL。50+ 年穿越 NoSQL 浪潮回归——DuckDB / ClickHouse / 分布式 SQL 在 2026 全面复兴',
    },
    en: {
      title: 'SQL',
      sub: 'Lingua franca of data',
      tagline: 'Codd\'s 1970 relational model, IBM System R\'s 1974 SEQUEL design. 50+ years through the NoSQL wave and back — DuckDB, ClickHouse and distributed SQL all surging by 2026',
    },
    accent: '#336791',
    logo: <span className="topic-glyph">Sq</span>,
    available: true,
  },
];

const TYPESET_TOPICS: Topic[] = [
  {
    slug: 'latex',
    href: '/code/language/latex',
    zh: {
      title: 'LaTeX',
      sub: '数学排版的事实标准',
      tagline: '1978 Knuth 写 TeX, 1985 Lamport 在 SRI 包装成 LaTeX。40 年里成 arXiv / 物理 / 数学 / CS 论文的母语, 2026 仍在演化 LaTeX3',
    },
    en: {
      title: 'LaTeX',
      sub: 'De-facto standard for math typesetting',
      tagline: 'Knuth wrote TeX in 1978; Leslie Lamport wrapped it as LaTeX at SRI in 1985. Forty years on it is the native tongue of arXiv and most physics / math / CS papers, with LaTeX3 still maturing in 2026',
    },
    accent: '#008080',
    logo: <span className="topic-glyph">TeX</span>,
    available: true,
  },
  {
    slug: 'katex',
    href: '/code/language/katex',
    zh: {
      title: 'KaTeX',
      sub: '浏览器里 100× 速度的 LaTeX 数学',
      tagline: '2013 Khan Academy (Emily Eisenberg + Sophie Alpert) 发布, 同步渲染 ~1ms/式。2026 GitHub / Notion / Obsidian / Discourse 全在用, 浏览器数学事实默认',
    },
    en: {
      title: 'KaTeX',
      sub: 'LaTeX math in the browser, 100× MathJax speed',
      tagline: 'Released by Khan Academy in 2013 (Emily Eisenberg + Sophie Alpert). Sync render, ~1ms per equation. By 2026 the default math renderer on GitHub, Notion, Obsidian and Discourse',
    },
    accent: '#329F73',
    logo: <span className="topic-glyph">KX</span>,
    available: true,
  },
];

const EXTRA_TOPICS: Topic[] = [...MARKUP_TOPICS, ...TYPESET_TOPICS, ...SCRIPT_TOPICS];

function renderTopicCard(t: Topic, lang: 'zh' | 'en') {
  const text = t[lang];
  const className = `topic-card${t.available ? '' : ' is-soon'}`;
  const inner = (
    <>
      <div className="topic-logo" style={{ background: t.available ? t.accent : '#222' }}>
        {t.logo}
      </div>
      <div className="topic-body">
        <div className="topic-title-row">
          <h2 className="topic-title">{text.title}</h2>
          {!t.available && (
            <span className="topic-soon">{lang === 'zh' ? '即将上线' : 'Soon'}</span>
          )}
        </div>
        <div className="topic-sub" style={{ color: t.available ? t.accent : 'var(--ts-faint, #4A5772)' }}>
          {text.sub}
        </div>
        <p className="topic-tagline">{text.tagline}</p>
      </div>
      {t.available && (
        <div className="topic-arrow" aria-hidden="true">
          →
        </div>
      )}
    </>
  );
  return t.available ? (
    <Link key={t.slug} to={t.href} className={className} style={{ ['--accent' as string]: t.accent }}>
      {inner}
    </Link>
  ) : (
    <div key={t.slug} className={className} aria-disabled="true">
      {inner}
    </div>
  );
}

export default function CodeLandingPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  useDocumentTitle('编程', 'Code');

  return (
    <div className="code-landing">
      <div className="code-landing-bg" />

      <header className="code-landing-head">
        <div className="code-landing-topbar">
          <Link to="/code" className="code-landing-back">
            ← /code
          </Link>
          <LangToggle variant="inline" />
        </div>
        <h1 className="code-landing-title">
          <span className="code-landing-prefix">/</span>language
          <span className="code-landing-cursor">_</span>
        </h1>
        <p className="code-landing-sub">
          {lang === 'zh'
            ? '编程语言 · 长篇导览。一门语言一篇深度，含历史、特性、生态、当下处境。'
            : 'Programming languages · long-form guides. One language per page — history, features, ecosystem, current state.'}
        </p>
        <div className="code-landing-meta">
          <span>{lang === 'zh' ? '最近更新' : 'Latest'}</span>
          <span className="code-landing-meta-dot">•</span>
          <span>2026.05 · TypeScript</span>
          <span className="code-landing-meta-dot">•</span>
          <Link to="/code/architecture" className="code-landing-meta-link">
            {lang === 'zh' ? '看站点架构 →' : 'Site architecture →'}
          </Link>
        </div>
      </header>

      <Link to="/code/language/compare" className="code-landing-banner">
        <div className="code-landing-banner-glyph">∑</div>
        <div className="code-landing-banner-body">
          <div className="code-landing-banner-tag">
            // {lang === 'zh' ? '横向对比' : 'Side-by-side'}
          </div>
          <h2 className="code-landing-banner-title">
            {lang === 'zh' ? '17 种语言, 一个 Ao5 算法' : 'One Ao5, seventeen languages'}
          </h2>
          <p className="code-landing-banner-sub">
            {lang === 'zh'
              ? '同一个 WCA Average-of-5 写 17 遍, 看每门语言的 DNF / Optional / 排序 / 类型系统怎么不一样'
              : 'The same WCA Average-of-5, written seventeen times — watch how each language handles DNF / Optional / sorting / type systems'}
          </p>
        </div>
        <div className="code-landing-banner-arrow">→</div>
      </Link>

      <Link to="/code/language/scramble" className="code-landing-banner">
        <div className="code-landing-banner-glyph">⟲</div>
        <div className="code-landing-banner-body">
          <div className="code-landing-banner-tag">
            // {lang === 'zh' ? '横向对比' : 'Side-by-side'}
          </div>
          <h2 className="code-landing-banner-title">
            {lang === 'zh' ? '17 种语言, 一个打乱解析器' : 'One scramble parser, seventeen languages'}
          </h2>
          <p className="code-landing-banner-sub">
            {lang === 'zh'
              ? '同一个 3x3 WCA 打乱串解析, 17 种语言写一遍, 看 sum types / Result / Optional / 异常 谁更顺手'
              : 'The same 3x3 WCA scramble parser, written seventeen times — sum types vs Result vs Optional vs exceptions, head to head'}
          </p>
        </div>
        <div className="code-landing-banner-arrow">→</div>
      </Link>

      <main className="code-landing-grid">
        {TOPICS.map((t) => renderTopicCard(t, lang))}
      </main>

      <section className="code-landing-section">
        <div className="code-landing-section-head">
          <div className="code-landing-section-tag">
            // {lang === 'zh' ? '标记 / 排版 / 脚本 / 查询' : 'Markup / typesetting / script / query'}
          </div>
          <h2 className="code-landing-section-title">
            {lang === 'zh' ? '不是编程语言,但绕不开' : 'Not programming languages — but unavoidable'}
          </h2>
          <p className="code-landing-section-sub">
            {lang === 'zh'
              ? 'HTML / CSS 是声明式标记与样式;LaTeX / KaTeX 是数学与文档排版;Bash / SQL 是脚本与查询。每天都写,但通常不在"编程语言"的清单里'
              : 'HTML / CSS are declarative markup and styling; LaTeX / KaTeX are typesetting; Bash and SQL are scripting and query. Daily tools, rarely on the "programming language" list'}
          </p>
        </div>
        <div className="code-landing-grid">
          {EXTRA_TOPICS.map((t) => renderTopicCard(t, lang))}
        </div>
      </section>

      <footer className="code-landing-foot">
        <div className="code-landing-foot-line">
          <span>{lang === 'zh' ? '更多语言陆续添加' : 'More languages coming'}</span>
          <span className="code-landing-meta-dot">·</span>
          <Link to="/">CubeRoot</Link>
        </div>
      </footer>
    </div>
  );
}
