'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { LangCtx, L, type Lang } from '../_intro/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './katex_intro.css';
import i18n from '@/i18n/i18n-client';

function TeX({ src }: { src: string }) {
  const html = useMemo(
    () => katex.renderToString(src, { throwOnError: false, output: 'html', strict: 'ignore' }),
    [src],
  );
  return <span className="kx-tex" dangerouslySetInnerHTML={{ __html: html }} />;
}
function TeXBlock({ src }: { src: string }) {
  const html = useMemo(
    () => katex.renderToString(src, { throwOnError: false, output: 'html', strict: 'ignore', displayMode: true }),
    [src],
  );
  return <div className="kx-tex-block" dangerouslySetInnerHTML={{ __html: html }} />;
}

const KATEX_LOGO_SVG = (
  <svg viewBox="0 0 256 256">
    <defs>
      <linearGradient id="kx-shield" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#48E0C8" />
        <stop offset="55%" stopColor="#2BB39A" />
        <stop offset="100%" stopColor="#14644F" />
      </linearGradient>
      <linearGradient id="kx-inner" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#2BB39A" />
        <stop offset="100%" stopColor="#0A2E26" />
      </linearGradient>
    </defs>
    <rect x="16" y="16" width="224" height="224" rx="36" fill="url(#kx-shield)" />
    <rect x="32" y="32" width="192" height="192" rx="26" fill="url(#kx-inner)" opacity=".55" />
    <g fill="#fff" fontFamily="'Cascadia Code', monospace" fontWeight="700">
      <text x="128" y="146" textAnchor="middle" fontSize="72" letterSpacing="-2">KaTeX</text>
      <text x="128" y="196" textAnchor="middle" fontSize="22" letterSpacing="6" fillOpacity=".7">{'\\sum \\int \\frac'}</text>
    </g>
  </svg>
);

interface HistoryItem {
  year: ReactNode;
  highlight?: boolean;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
}

const HISTORY: HistoryItem[] = [
  {
    year: <>1977<small>~1985</small></>,
    zh: { title: <>TeX → LaTeX — KaTeX 的祖先</>, desc: <>Donald Knuth 1977 写 <strong>TeX</strong>, Leslie Lamport 1985 在 TeX 上做 <strong>LaTeX</strong> 宏包。KaTeX 实现的<em>正是 LaTeX 数学子集</em>的语法。完整故事见 <a href="/code/language/latex">/code/language/latex</a>。</> },
    en: { title: <>TeX → LaTeX — KaTeX's ancestors</>, desc: <>Donald Knuth wrote <strong>TeX</strong> in 1977; Leslie Lamport built <strong>LaTeX</strong> as macros on top in 1985. KaTeX implements <em>exactly the LaTeX math subset</em>. The full story lives at <a href="/code/language/latex">/code/language/latex</a>.</> },
  },
  {
    year: '2003',
    zh: { title: <>jsMath — 第一个浏览器里的 TeX</>, desc: <>Davide Cervone (Union College) 写 <strong>jsMath</strong>: 第一个认真把 LaTeX 数学搬进浏览器的尝试。<em>用 GIF 图片当 fallback、字体下载靠 Adobe AFM 转 TrueType</em>——慢、丑, 但<strong>开了"浏览器里渲数学"的路</strong>。</> },
    en: { title: <>jsMath — the first browser TeX</>, desc: <>Davide Cervone (Union College) writes <strong>jsMath</strong> — the first serious attempt to put LaTeX math in the browser. <em>GIF fallbacks, Adobe AFM fonts converted to TrueType</em> — slow and ugly, but it <strong>opens the road for "math in the browser"</strong>.</> },
  },
  {
    year: <>2009<small>·08</small></>,
    zh: { title: <>MathJax 1.0 — 浏览器数学的金标</>, desc: <>Davide Cervone 联合 <strong>AMS / Design Science / SIAM</strong>, 推出 MathJax。<em>JS 全平台、HTML+CSS / SVG / MathML 三套输出、字体自动加载</em>。从此 7 年, 学术 web 上每条公式几乎都是它渲的。<strong>重</strong>: 默认包 ~1.6MB, 解析 + 渲染异步, 长页面布局抖动。</> },
    en: { title: <>MathJax 1.0 — the gold standard</>, desc: <>Davide Cervone teams up with <strong>AMS / Design Science / SIAM</strong> and ships MathJax. <em>Pure-JS, cross-browser, HTML+CSS / SVG / MathML output, auto font loading</em>. For seven years almost every equation on the academic web is MathJax. But <strong>heavy</strong>: ~1.6MB default bundle, async parse + render, layout shift on long pages.</> },
  },
  {
    year: '2010',
    zh: { title: <>Khan Academy 起飞 — 数学视频 web 化</>, desc: <>Sal Khan 在 YouTube 录的<em>数千道数学题</em>开始进 web app。早期 KA 用<strong>预渲染图片 or MathJax</strong>展示公式——一张练习页可能加载上百条等式, <em>MathJax 渲染时间 = 学生等待时间</em>。性能 pain 在这里埋下。</> },
    en: { title: <>Khan Academy takes off — math video on the web</>, desc: <>Sal Khan's <em>thousands of math problems</em> from YouTube migrate into a web app. Early KA renders math via <strong>pre-rendered images or MathJax</strong> — a single practice page can carry hundreds of equations, and <em>MathJax render time becomes student wait time</em>. The pain that begets KaTeX gets buried here.</> },
  },
  {
    year: <>2013<small>·09</small></>, highlight: true,
    zh: { title: <>KaTeX 在 Khan Academy 内部诞生</>, desc: <><strong>Emily Eisenberg + Sophie Alpert</strong> (Sophie 后来去 Facebook 进 React core 团队) 在 KA 内部立项。目标毫不掩饰: <em>"render math 100× faster than MathJax"</em>。关键洞察: <strong>把字体度量预计算并打包</strong>, 不在 runtime 测量。</> },
    en: { title: <>KaTeX is born inside Khan Academy</>, desc: <><strong>Emily Eisenberg + Sophie Alpert</strong> (Sophie later joined Facebook's React core team) start it inside KA. The stated goal is blunt: <em>"render math 100× faster than MathJax"</em>. The key insight: <strong>precompute font metrics at build time</strong>, never measure at runtime.</> },
  },
  {
    year: <>2014<small>·09</small></>, highlight: true,
    zh: { title: <>开源发布 + Pre-Stash 技术</>, desc: <>KaTeX 在 GitHub 上以 <strong>MIT 许可证</strong>开源。"<em>Pre-Stash</em>" 一词成了核心工程隐喻——字体度量 ~30KB JSON 嵌在 bundle, <strong>同步渲染、~1ms / 公式、无 FOUC 无 layout shift</strong>。第一次有"快到能在长页面上爽快用"的数学渲染器。</> },
    en: { title: <>Open-sourced + the Pre-Stash technique</>, desc: <>KaTeX hits GitHub under <strong>MIT</strong>. "<em>Pre-Stash</em>" becomes the project's engineering shorthand — a ~30KB font-metric JSON ships inside the bundle so rendering is <strong>synchronous, ~1ms per equation, no FOUC, no layout shift</strong>. The first math renderer fast enough to be enjoyable on a long page.</> },
  },
  {
    year: '2014',
    zh: { title: <>Stack Exchange Math 试用</>, desc: <>StackExchange 的<strong>数学站</strong>开始评估 KaTeX 作为 MathJax 的替代。最终方案是<em>两者并存</em>: KaTeX 渲简单公式, 失败 fallback 到 MathJax。这套 hybrid 模式在 2014~2018 被多家学术站借鉴。</> },
    en: { title: <>Stack Exchange Math evaluates it</>, desc: <>The <strong>Mathematics</strong> Stack Exchange starts looking at KaTeX as a MathJax replacement. The eventual answer is <em>both</em>: KaTeX for simple expressions, MathJax fallback when KaTeX can't parse it. A hybrid pattern that several academic sites copy through 2014–2018.</> },
  },
  {
    year: '2015',
    zh: { title: <>0.5 — 矩阵 / aligned / 颜色落地</>, desc: <>KaTeX 0.5 加 <code>\begin{'{'}aligned{'}'}</code>、<code>\begin{'{'}pmatrix{'}'}</code>、<code>\color</code>。<em>真实"科研论文里的公式"覆盖率从 ~60% 跳到 ~80%</em>; 之后每一版都在补足 LaTeX 数学子集。</> },
    en: { title: <>0.5 — matrices, aligned, colour</>, desc: <>KaTeX 0.5 lands <code>\begin{'{'}aligned{'}'}</code>, <code>\begin{'{'}pmatrix{'}'}</code>, <code>\color</code>. <em>Real-world coverage of "equations you'd see in a paper" jumps from ~60% to ~80%</em>; every release after that fills out more of the LaTeX math subset.</> },
  },
  {
    year: '2016',
    zh: { title: <>Discourse 默认渲染器</>, desc: <>Jeff Atwood 的 <strong>Discourse</strong> (现代论坛软件) 把 KaTeX 设为默认数学渲染器, 弃 MathJax。Discourse 是<em>论坛 / 社区</em>赛道, 一旦切换, <strong>整个开源知识库的公式都吃 KaTeX 速度</strong>。</> },
    en: { title: <>Discourse adopts KaTeX as default</>, desc: <>Jeff Atwood's <strong>Discourse</strong> (the modern forum platform) switches its default math renderer to KaTeX from MathJax. Discourse owns the <em>forum / community</em> niche; once it flips, <strong>every open-source knowledge base on Discourse inherits KaTeX's speed</strong>.</> },
  },
  {
    year: '2017',
    zh: { title: <>GitHub 数学支持 → KaTeX</>, desc: <>GitHub 在 issue / PR / README 引入数学渲染。<em>初版用 MathJax, 后切到 KaTeX</em> (性能 + bundle 双优势)。从此<strong>开发者写 README 时, <code>{'$\\int$'}</code> 直接出公式</strong>——这一条改变了大量项目的文档习惯。</> },
    en: { title: <>GitHub adds math → switches to KaTeX</>, desc: <>GitHub adds math rendering to issues / PRs / READMEs. <em>The first cut uses MathJax; GitHub later switches to KaTeX</em> for both perf and bundle. From that point <strong>developers writing READMEs can drop <code>{'$\\int$'}</code> and get a real equation</strong> — a doc-habit shift across thousands of repos.</> },
  },
  {
    year: '2017',
    zh: { title: <>0.9 — auto-render 扩展</>, desc: <>新增<code>renderMathInElement()</code>: 扫描 DOM 文本节点, 自动找<code>$...$</code>、<code>$$...$$</code>、<code>{'\\(...\\)'}</code> 分隔符并就地替换。<em>"老 markdown 站接 KaTeX 一行代码"</em>从这里开始。</> },
    en: { title: <>0.9 — the auto-render extension</>, desc: <>Adds <code>renderMathInElement()</code>: scan DOM text nodes, find <code>$...$</code>, <code>$$...$$</code>, <code>{'\\(...\\)'}</code> delimiters and replace in place. <em>"Add KaTeX to your existing markdown site in one line"</em> starts here.</> },
  },
  {
    year: '2018',
    zh: { title: <>0.10 — mhchem / copy-tex / MathML</>, desc: <>三件大事一起落地: <strong>mhchem 扩展</strong> (化学方程式 <code>{'\\ce{H_2O}'}</code>), <strong>copy-tex</strong> (从渲染好的公式右键复制回 LaTeX 源), <strong>MathML 输出模式</strong> (给屏幕阅读器走 a11y 通道)。<em>从此 KaTeX 在"科普 / 教学"场景全面够用</em>。</> },
    en: { title: <>0.10 — mhchem / copy-tex / MathML</>, desc: <>Three big additions in one cut: <strong>mhchem</strong> (chemistry like <code>{'\\ce{H_2O}'}</code>), <strong>copy-tex</strong> (right-click a rendered equation, copy back the LaTeX source), and a <strong>MathML output mode</strong> for screen readers and accessibility. <em>From here KaTeX is "good enough" for almost any teaching / explainer use case</em>.</> },
  },
  {
    year: '2019',
    zh: { title: <>0.11 — 全 Unicode 数学模式</>, desc: <>能直接 parse <code>α</code>、<code>∑</code>、<code>∫</code> 之类 Unicode 数学符号 (而不必先写 <code>{'\\alpha'}</code>)。<em>跟 Notion / Substack / Quora 这些"用户直接输 Unicode"的场景接得上</em>。</> },
    en: { title: <>0.11 — full Unicode math mode</>, desc: <>Direct parsing of Unicode math like <code>α</code>, <code>∑</code>, <code>∫</code> (no need to type <code>{'\\alpha'}</code> first). <em>Aligns KaTeX with consumer apps like Notion / Substack / Quora where users paste Unicode directly</em>.</> },
  },
  {
    year: <>2020<small>~22</small></>, highlight: true,
    zh: { title: <>Notion / Substack / Quora 全切 KaTeX</>, desc: <>三家分别在不同月份切换。<em>消费端"浏览器数学"战争至此结束</em>: <strong>速度优先 = KaTeX, 学术 a11y 优先 = MathJax</strong>。两者从此互不威胁, 各自吃自己的市场。Hashnode、Roam、Logseq 同期跟进。</> },
    en: { title: <>Notion / Substack / Quora all flip to KaTeX</>, desc: <>Three big consumer platforms move within months of each other. The <em>consumer-side "browser math" war is over</em>: <strong>speed-first picks KaTeX, accessibility-first sticks with MathJax</strong>. They stop competing and each owns its lane. Hashnode, Roam, Logseq follow in the same window.</> },
  },
  {
    year: '2022',
    zh: { title: <>GitHub-Flavored Markdown 数学支持落地</>, desc: <>GFM 规范明确<strong><code>$inline$</code></strong> 和 <strong><code>$$display$$</code></strong> 是数学语法; <em>渲染器就是 KaTeX</em>。<strong>"写 README 顺手放公式"</strong>从社区习惯变成规范, 影响范围 = 整个开源生态。</> },
    en: { title: <>GitHub-Flavored Markdown specs math</>, desc: <>GFM spells out <strong><code>$inline$</code></strong> and <strong><code>$$display$$</code></strong> as math syntax; <em>the renderer is KaTeX</em>. <strong>"Drop an equation into your README"</strong> shifts from convention to spec — reach: every open-source project on GitHub.</> },
  },
  {
    year: '2023',
    zh: { title: <>0.16 — ESM + 性能 refactor</>, desc: <>整个 codebase 转 <strong>TypeScript</strong>, 切到 <strong>ESM modules</strong>, parser 内部重构, 渲染再快一档。<em>"已经够快"的项目还在挤性能</em>——这是项目<strong>成熟期</strong>而非衰退期的标志。</> },
    en: { title: <>0.16 — ESM + perf refactor</>, desc: <>Codebase moves to <strong>TypeScript</strong>, switches to <strong>ESM modules</strong>, parser is rewritten, render goes another notch faster. <em>"Already fast enough" projects still squeezing perf</em> — a sign of <strong>maturity</strong>, not decline.</> },
  },
  {
    year: '2024',
    zh: { title: <>Obsidian / Logseq / 所有笔记 app</>, desc: <>本地笔记软件全面拥抱 KaTeX: <strong>Obsidian、Logseq、Anytype、Tana、Reflect</strong>。一条公式从笔记本到博客到 GitHub README 全程<em>同一渲染器</em>——<strong>LaTeX 数学的"浏览器侧 lingua franca"</strong>。</> },
    en: { title: <>Obsidian / Logseq / every note app</>, desc: <>Note-taking apps fully embrace KaTeX: <strong>Obsidian, Logseq, Anytype, Tana, Reflect</strong>. The same equation travels from notebook to blog to GitHub README rendered by <em>the same engine</em> — <strong>KaTeX is the browser-side lingua franca of LaTeX math</strong>.</> },
  },
  {
    year: '2025',
    zh: { title: <>稳态维护 + 用量爆炸</>, desc: <>KaTeX 0.16.x 进入<strong>稳态维护</strong>: 偶尔补 bug、加边缘 LaTeX 命令, <em>不再做大动作</em>。但用量在涨——LLM 输出 LaTeX, 浏览器侧用 KaTeX 渲, <strong>AI 聊天 UI 把它推到了历史新高</strong>。</> },
    en: { title: <>Maintenance mode + usage explosion</>, desc: <>KaTeX 0.16.x is in <strong>steady maintenance</strong>: occasional bug fixes, occasional edge LaTeX commands; <em>no more big swings</em>. Usage keeps climbing though — LLMs emit LaTeX, the browser renders it via KaTeX, <strong>AI chat UIs push KaTeX to all-time highs</strong>.</> },
  },
  {
    year: '2026', highlight: true,
    zh: { title: <>KaTeX 的现状 — 浏览器数学的默认值</>, desc: <>2026: <strong>KaTeX 是浏览器数学的<em>默认</em>渲染器</strong>, MathJax 仍活, 但只占 a11y / 完整 LaTeX 包的市场。<em>本页就用它渲</em>——见上面那个 <TeX src={'\\sum_{n=1}^{\\infty}\\frac{1}{n^2}=\\frac{\\pi^2}{6}'} />。</> },
    en: { title: <>KaTeX in 2026 — the default browser math</>, desc: <>2026: <strong>KaTeX is the <em>default</em> browser math renderer</strong>. MathJax is alive but holds only the a11y / full-LaTeX market. <em>This very page renders with it</em> — see <TeX src={'\\sum_{n=1}^{\\infty}\\frac{1}{n^2}=\\frac{\\pi^2}{6}'} /> in the hero.</> },
  },
];

interface OptCard {
  year: ReactNode;
  tag: string;
  zhDesc: ReactNode;
  enDesc: ReactNode;
}

const OPTIONS_CARDS: OptCard[] = [
  { year: 'core', tag: 'displayMode: true', zhDesc: <><strong>显示模式</strong> (居中、大字号) vs 行内模式。最常调的一个 boolean。</>, enDesc: <><strong>Display mode</strong> (centred, large) vs inline. The single boolean you tweak most often.</> },
  { year: 'core', tag: 'throwOnError: false', zhDesc: <>解析失败<em>不抛异常</em>, 渲染为红色 fallback 文本。<strong>生产页必开</strong>。</>, enDesc: <>Parse errors <em>don't throw</em>, render as red fallback text. <strong>Always on in production</strong>.</> },
  { year: 'core', tag: 'errorColor: "#cc0000"', zhDesc: <>fallback 文本颜色。深色主题改 <code>#FF8E72</code> 之类。</>, enDesc: <>Fallback text colour. Pick something like <code>#FF8E72</code> for dark themes.</> },
  { year: 'macros', tag: 'macros: { "\\RR": "\\mathbb{R}" }', zhDesc: <><strong>自定义宏</strong>。等价 LaTeX 里 <code>{'\\newcommand'}</code>; 但是<em>不会从 .tex 文件自动来</em>, 必须显式传。</>, enDesc: <><strong>Custom macros</strong>. Equivalent to <code>{'\\newcommand'}</code> in LaTeX, but it <em>doesn't auto-load from .tex files</em> — pass them explicitly.</> },
  { year: 'strict', tag: "strict: 'ignore'", zhDesc: <>对非标准 LaTeX 的态度: <code>'error'</code> / <code>'warn'</code> / <code>'ignore'</code>。<strong>ignore</strong> 对消费端兼容最好。</>, enDesc: <>How to treat non-standard LaTeX: <code>'error'</code> / <code>'warn'</code> / <code>'ignore'</code>. <strong>ignore</strong> maximises consumer-input compatibility.</> },
  { year: 'security', tag: 'trust: true', zhDesc: <>允许 <code>{'\\href'}</code>、<code>{'\\includegraphics'}</code>。<em>用户输入</em>千万别开——XSS 入口。</>, enDesc: <>Allows <code>{'\\href'}</code>, <code>{'\\includegraphics'}</code>. <em>Never enable on user input</em> — XSS surface.</> },
  { year: 'output', tag: "output: 'htmlAndMathml'", zhDesc: <>视觉走 HTML+CSS, <strong>同时</strong>嵌 MathML 给屏幕阅读器。<em>a11y 默认推荐</em>。</>, enDesc: <>Visuals via HTML+CSS, <strong>plus</strong> embedded MathML for screen readers. <em>The a11y-friendly default</em>.</> },
  { year: 'output', tag: 'fleqn: true', zhDesc: <>显示公式<strong>左对齐</strong>而非居中。复刻部分期刊样式。</>, enDesc: <>Display equations <strong>flush-left</strong> instead of centred. Mirrors certain journal styles.</> },
  { year: 'i18n', tag: 'minRuleThickness: 0.05', zhDesc: <>分数线最小厚度 (em)。<em>Retina 屏上避免发丝线</em>。</>, enDesc: <>Minimum fraction-bar thickness (em). <em>Stops hairlines on Retina screens</em>.</> },
  { year: 'i18n', tag: 'maxSize: Infinity', zhDesc: <>限制 <code>{'\\rule'}</code>、<code>{'\\hspace'}</code> 最大尺寸。防恶意输入撑爆布局。</>, enDesc: <>Cap on <code>{'\\rule'}</code> / <code>{'\\hspace'}</code> sizes. Guards against malicious input blowing up the layout.</> },
  { year: 'macros', tag: 'maxExpand: 1000', zhDesc: <>宏展开上限。<em>防 <code>{'\\def\\x{\\x\\x}'}</code> 之类递归炸服务器</em>。</>, enDesc: <>Macro expansion limit. <em>Stops bombs like <code>{'\\def\\x{\\x\\x}'}</code> from blowing up your server</em>.</> },
  { year: 'core', tag: 'globalGroup: true', zhDesc: <>用 <code>katex.renderToString</code> 多次调用时, 宏定义跨调用<strong>共享</strong>。SSR 批量渲染常用。</>, enDesc: <>Across multiple <code>katex.renderToString</code> calls, macro definitions <strong>persist</strong>. Common in SSR batch rendering.</> },
];

interface CoverageRow {
  ok: boolean;
  zhName: ReactNode;
  enName: ReactNode;
  sample?: string;
  zhNote?: ReactNode;
  enNote?: ReactNode;
}

const COVERAGE_OK: CoverageRow[] = [
  { ok: true, zhName: <>分数 <code>{'\\frac'}</code></>, enName: <>Fractions <code>{'\\frac'}</code></>, sample: '\\frac{a+b}{c-d}' },
  { ok: true, zhName: <>求和 <code>{'\\sum'}</code> / 积分 <code>{'\\int'}</code></>, enName: <>Sums <code>{'\\sum'}</code> / integrals <code>{'\\int'}</code></>, sample: '\\sum_{i=1}^{n} \\int_0^1 f(x)\\,dx' },
  { ok: true, zhName: <>矩阵 <code>pmatrix</code> / <code>bmatrix</code></>, enName: <>Matrices <code>pmatrix</code> / <code>bmatrix</code></>, sample: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
  { ok: true, zhName: <>对齐 <code>aligned</code> / <code>cases</code></>, enName: <>Alignment <code>aligned</code> / <code>cases</code></>, sample: 'f(x)=\\begin{cases} 0 & x<0 \\\\ x & x\\ge 0 \\end{cases}' },
  { ok: true, zhName: <>所有希腊字母</>, enName: <>All Greek letters</>, sample: '\\alpha\\,\\beta\\,\\gamma\\,\\Pi\\,\\Omega\\,\\varepsilon' },
  { ok: true, zhName: <>黑板粗体 <code>{'\\mathbb'}</code></>, enName: <>Blackboard bold <code>{'\\mathbb'}</code></>, sample: '\\mathbb{R}\\,\\mathbb{C}\\,\\mathbb{Z}\\,\\mathbb{N}' },
  { ok: true, zhName: <>花体 / fraktur <code>{'\\mathcal'}</code> <code>{'\\mathfrak'}</code></>, enName: <>Cal / fraktur <code>{'\\mathcal'}</code> <code>{'\\mathfrak'}</code></>, sample: '\\mathcal{L}\\,\\mathfrak{g}\\,\\mathfrak{sl}_n' },
  { ok: true, zhName: <>二项 <code>{'\\binom'}</code> / 根号 <code>{'\\sqrt'}</code></>, enName: <>Binom <code>{'\\binom'}</code> / root <code>{'\\sqrt'}</code></>, sample: '\\binom{n}{k} = \\sqrt[3]{\\frac{n!}{k!(n-k)!}}' },
  { ok: true, zhName: <>大括号 / 装饰 <code>{'\\overbrace'}</code></>, enName: <>Braces / decorations <code>{'\\overbrace'}</code></>, sample: '\\overbrace{a+b+\\cdots+z}^{26}' },
  { ok: true, zhName: <>箭头 <code>{'\\xrightarrow'}</code></>, enName: <>Labelled arrows <code>{'\\xrightarrow'}</code></>, sample: 'A \\xrightarrow{f} B \\xrightarrow{g} C' },
  { ok: true, zhName: <>颜色 / 字号</>, enName: <>Colour / size</>, sample: '{\\color{red} R} \\Large{X} \\small{y}' },
  { ok: true, zhName: <>通用数组 <code>{'\\begin{array}'}</code></>, enName: <>Generic <code>{'\\begin{array}'}</code></>, sample: '\\begin{array}{c|c} a & b \\\\ \\hline c & d \\end{array}' },
  { ok: true, zhName: <>AMS 符号大全</>, enName: <>Full AMS symbols</>, sample: '\\therefore\\,\\because\\,\\nexists\\,\\subseteq\\,\\models' },
  { ok: true, zhName: <>化学方程 mhchem <code>{'\\ce'}</code></>, enName: <>Chemistry mhchem <code>{'\\ce'}</code></>, sample: '\\ce{2H2 + O2 -> 2H2O}' },
  { ok: true, zhName: <>自定义宏 <code>macros</code></>, enName: <>Custom <code>macros</code> option</>, sample: '\\RR^n \\to \\RR' },
  { ok: true, zhName: <>Unicode 数学输入</>, enName: <>Unicode math input</>, sample: '∑_{i=1}^n αᵢ ∈ ℝ' },
];

const COVERAGE_NO: CoverageRow[] = [
  { ok: false, zhName: <>TikZ / PGF 图</>, enName: <>TikZ / PGF diagrams</>, zhNote: <>需要完整 Lua / TeX 引擎</>, enNote: <>Needs a full Lua / TeX engine</> },
  { ok: false, zhName: <>Asymptote 图</>, enName: <>Asymptote graphics</>, zhNote: <>独立 C++ 工具链, 不可能进 250KB</>, enNote: <>Separate C++ toolchain — won't fit in 250KB</> },
  { ok: false, zhName: <><code>{'\\documentclass'}</code> / 页面结构</>, enName: <><code>{'\\documentclass'}</code> / page setup</>, zhNote: <>KaTeX 只渲数学, 不渲文档</>, enNote: <>KaTeX renders math, not documents</> },
  { ok: false, zhName: <><code>{'\\section'}</code> / <code>{'\\chapter'}</code></>, enName: <><code>{'\\section'}</code> / <code>{'\\chapter'}</code></>, zhNote: <>用 HTML <code>&lt;h1&gt;</code>~<code>&lt;h6&gt;</code></>, enNote: <>Use HTML <code>&lt;h1&gt;</code>–<code>&lt;h6&gt;</code></> },
  { ok: false, zhName: <>BibTeX 引用 / 参考文献</>, enName: <>BibTeX citations / bibliography</>, zhNote: <>非数学领域, 不在范围</>, enNote: <>Outside math scope</> },
  { ok: false, zhName: <>页面布局 / 浮动 figure</>, enName: <>Page layout / floats</>, zhNote: <>CSS 的活, 不是 KaTeX 的</>, enNote: <>That's CSS's job, not KaTeX's</> },
  { ok: false, zhName: <>preamble <code>{'\\newcommand'}</code> 自动读</>, enName: <>preamble <code>{'\\newcommand'}</code> auto-load</>, zhNote: <>有 macros, 但必须显式传</>, enNote: <>macros exist, but must be passed explicitly</> },
  { ok: false, zhName: <><code>eqnarray</code></>, enName: <><code>eqnarray</code></>, zhNote: <>本来就 deprecated, 用 <code>aligned</code></>, enNote: <>Long deprecated anyway, use <code>aligned</code></> },
  { ok: false, zhName: <>任意字体替换</>, enName: <>Arbitrary font substitution</>, zhNote: <>锁死 KaTeX_* 自带字体</>, enNote: <>Locked to the bundled KaTeX_* fonts</> },
  { ok: false, zhName: <>实时 LaTeX 编译错误</>, enName: <>Live LaTeX compile errors</>, zhNote: <>有 throwOnError, 但<em>不是</em>完整 LaTeX 错误模型</>, enNote: <>throwOnError exists but <em>isn't</em> a full LaTeX error model</> },
];

interface BenchRow {
  zh: ReactNode;
  en: ReactNode;
  segs: { cls: string; pct: number; label: string }[];
}

const BENCH_TIME: BenchRow[] = [
  { zh: <>KaTeX 0.16</>, en: <>KaTeX 0.16</>, segs: [{ cls: 'ka', pct: 2, label: '~1ms' }] },
  { zh: <>MathJax v3 (HTML)</>, en: <>MathJax v3 (HTML)</>, segs: [{ cls: 'mj3', pct: 14, label: '~7ms' }] },
  { zh: <>MathJax v3 (SVG)</>, en: <>MathJax v3 (SVG)</>, segs: [{ cls: 'mj3', pct: 22, label: '~11ms' }] },
  { zh: <>MathJax v2 (legacy)</>, en: <>MathJax v2 (legacy)</>, segs: [{ cls: 'mj', pct: 60, label: '~30ms' }] },
  { zh: <>jsMath (2003)</>, en: <>jsMath (2003)</>, segs: [{ cls: 'ot', pct: 90, label: '~45ms' }] },
];

const BENCH_BYTES: BenchRow[] = [
  { zh: <>KaTeX (CSS + fonts)</>, en: <>KaTeX (CSS + fonts)</>, segs: [{ cls: 'ka', pct: 16, label: '~250KB' }] },
  { zh: <>KaTeX (JS only)</>, en: <>KaTeX (JS only)</>, segs: [{ cls: 'ka', pct: 5, label: '~75KB' }] },
  { zh: <>MathJax v3 (full)</>, en: <>MathJax v3 (full)</>, segs: [{ cls: 'mj3', pct: 100, label: '~1.6MB' }] },
  { zh: <>MathJax v3 (lazy / core)</>, en: <>MathJax v3 (lazy / core)</>, segs: [{ cls: 'mj3', pct: 35, label: '~560KB' }] },
  { zh: <>MathJax v2 (full)</>, en: <>MathJax v2 (full)</>, segs: [{ cls: 'mj', pct: 130, label: '~2.1MB' }] },
];

interface Surface {
  tag: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const SURFACE_CARDS: Surface[] = [
  {
    tag: 'A',
    zh: { title: <><code>katex.renderToString()</code></>, desc: <><strong>同步</strong>返回 HTML 字符串。<em>服务端 SSR / 静态生成</em>首选——把渲染结果烤进 HTML, 客户端零 JS。</> },
    en: { title: <><code>katex.renderToString()</code></>, desc: <><strong>Synchronous</strong>, returns an HTML string. <em>Top pick for SSR / static generation</em> — bake the output into HTML, ship zero JS to the client.</> },
    code: (
      <code>
        <span className="cl-k">import</span> katex <span className="cl-k">from</span> <span className="cl-s">'katex'</span>;{'\n\n'}
        <span className="cl-k">const</span> html = katex.<span className="cl-fn">renderToString</span>({'\n'}
        {'  '}<span className="cl-s">{"'\\\\sum_{i=1}^n i^2'"}</span>,{'\n'}
        {'  '}{'{ '}<span className="cl-attr">displayMode</span>: <span className="cl-k">true</span> {'}'}{'\n'}
        );{'\n'}
        <span className="cl-c">{'// → <span class="katex-display">...</span>'}</span>
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <><code>katex.render()</code></>, desc: <>客户端: 直接<strong>突变 DOM 节点</strong>。无返回值, 副作用渲染。<em>跟手写 React effect / 框架 directive 配套</em>。</> },
    en: { title: <><code>katex.render()</code></>, desc: <>Client-side: <strong>mutates a DOM node in place</strong>. No return value, side-effect rendering. <em>Pairs with React effects / framework directives</em>.</> },
    code: (
      <code>
        <span className="cl-k">const</span> el = document.<span className="cl-fn">getElementById</span>(<span className="cl-s">'eq'</span>);{'\n'}
        katex.<span className="cl-fn">render</span>(<span className="cl-s">{"'E = mc^2'"}</span>, el, {'{'}{'\n'}
        {'  '}<span className="cl-attr">throwOnError</span>: <span className="cl-k">false</span>,{'\n'}
        {'  '}<span className="cl-attr">errorColor</span>: <span className="cl-s">'#FF8E72'</span>{'\n'}
        {'}'});
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <>auto-render extension</>, desc: <>给老 markdown / blog 站<strong>一行接入</strong>。扫描 DOM 找 <code>$...$</code>、<code>$$...$$</code>, 就地替换。</> },
    en: { title: <>The auto-render extension</>, desc: <><strong>One-line integration</strong> for legacy markdown / blog sites. Scans the DOM for <code>$...$</code>, <code>$$...$$</code> and replaces in place.</> },
    code: (
      <code>
        <span className="cl-k">import</span> renderMathInElement <span className="cl-k">from</span>{'\n'}
        {'  '}<span className="cl-s">'katex/contrib/auto-render'</span>;{'\n\n'}
        <span className="cl-fn">renderMathInElement</span>(document.body, {'{'}{'\n'}
        {'  '}<span className="cl-attr">delimiters</span>: [{'\n'}
        {'    '}{'{ '}<span className="cl-attr">left</span>: <span className="cl-s">'$$'</span>, <span className="cl-attr">right</span>: <span className="cl-s">'$$'</span>, <span className="cl-attr">display</span>: <span className="cl-k">true</span> {'}'},{'\n'}
        {'    '}{'{ '}<span className="cl-attr">left</span>: <span className="cl-s">'$'</span>,  <span className="cl-attr">right</span>: <span className="cl-s">'$'</span>,  <span className="cl-attr">display</span>: <span className="cl-k">false</span> {'}'}{'\n'}
        {'  '}]{'\n'}
        {'}'});
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <>React wrapper</>, desc: <><code>react-katex</code>: <code>&lt;BlockMath&gt;</code> / <code>&lt;InlineMath&gt;</code>。<em>本页用的是直接 useMemo + dangerouslySetInnerHTML</em>, 不依赖额外包。</> },
    en: { title: <>React wrapper</>, desc: <><code>react-katex</code>: <code>&lt;BlockMath&gt;</code> / <code>&lt;InlineMath&gt;</code>. <em>This page uses useMemo + dangerouslySetInnerHTML directly</em> — no extra dependency.</> },
    code: (
      <code>
        <span className="cl-k">import</span> {'{'} BlockMath {'}'} <span className="cl-k">from</span> <span className="cl-s">'react-katex'</span>;{'\n\n'}
        <span className="cl-tag">&lt;BlockMath</span>{'\n'}
        {'  '}<span className="cl-attr">math</span>={'{'}<span className="cl-s">{"'\\\\int_0^1 x^2\\\\,dx'"}</span>{'}'}{'\n'}
        <span className="cl-tag">/&gt;</span>
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <>mhchem 化学方程</>, desc: <>对接 <code>{'\\ce{...}'}</code> 语法。<em>教学 / 化学站</em>必备扩展。</> },
    en: { title: <>mhchem chemistry</>, desc: <>Speaks the <code>{'\\ce{...}'}</code> syntax. <em>Required for teaching / chemistry sites</em>.</> },
    code: (
      <code>
        <span className="cl-k">import</span> <span className="cl-s">'katex/contrib/mhchem'</span>;{'\n\n'}
        katex.<span className="cl-fn">renderToString</span>({'\n'}
        {'  '}<span className="cl-s">{"'\\\\ce{2H2 + O2 -> 2H2O}'"}</span>{'\n'}
        );
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <>copy-tex</>, desc: <>渲染好的公式右键复制时, <em>剪贴板里是 LaTeX 源</em>而不是渲染后的 HTML。学术 / 笔记场景必备。</> },
    en: { title: <>copy-tex</>, desc: <>Right-click and copy a rendered equation and <em>your clipboard holds the LaTeX source</em>, not the rendered HTML. Essential for academic / note workflows.</> },
    code: (
      <code>
        <span className="cl-k">import</span> <span className="cl-s">'katex/contrib/copy-tex'</span>;{'\n'}
        <span className="cl-c">{"// ↑ that's it. side-effect import."}</span>
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <>SSR 流水线</>, desc: <>SSG / SSR: 构建时 <code>renderToString</code> → 把 HTML + <code>katex.min.css</code> 烤进页面 → <em>客户端不加载 KaTeX JS</em>。本站 prediction 长文页就这样跑。</> },
    en: { title: <>SSR pipeline</>, desc: <>SSG / SSR: call <code>renderToString</code> at build time → bake the HTML + <code>katex.min.css</code> into the page → <em>client never loads KaTeX JS</em>. This site's prediction long-form pages run exactly this way.</> },
    code: (
      <code>
        <span className="cl-c">{'// build.ts'}</span>{'\n'}
        <span className="cl-k">const</span> body = mdAst.<span className="cl-fn">walk</span>((eq) =&gt;{'\n'}
        {'  '}katex.<span className="cl-fn">renderToString</span>(eq.src){'\n'}
        );{'\n'}
        <span className="cl-fn">writeFile</span>(<span className="cl-s">'out.html'</span>, body);
      </code>
    ),
  },
  {
    tag: 'H',
    zh: { title: <>错误处理</>, desc: <><code>throwOnError: false</code> + <code>errorColor</code> = <em>挂错的公式变红色 fallback</em>, 不挂整页。生产页第一条规则。</> },
    en: { title: <>Error handling</>, desc: <><code>throwOnError: false</code> + <code>errorColor</code> = <em>broken equations turn into red fallback text</em> instead of crashing the page. Rule one for production.</> },
    code: (
      <code>
        katex.<span className="cl-fn">renderToString</span>(input, {'{'}{'\n'}
        {'  '}<span className="cl-attr">throwOnError</span>: <span className="cl-k">false</span>,{'\n'}
        {'  '}<span className="cl-attr">errorColor</span>: <span className="cl-s">'#FF8E72'</span>,{'\n'}
        {'  '}<span className="cl-attr">strict</span>: <span className="cl-s">'ignore'</span>{'\n'}
        {'}'});
      </code>
    ),
  },
];

interface WhyCard {
  icon: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const WHY_CARDS: WhyCard[] = [
  {
    icon: '∑',
    zh: { title: <>同步渲染 = 零 layout shift</>, desc: <><code>renderToString</code> 返回的就是完成的 HTML。<em>不像 MathJax 异步测字体</em>, 长论文页打开<strong>不会跳来跳去</strong>。CLS 分数直接拉满。</> },
    en: { title: <>Synchronous render = zero layout shift</>, desc: <><code>renderToString</code> returns finished HTML. <em>Unlike MathJax's async font measurement</em>, long math-heavy pages <strong>don't jump around</strong>. CLS score goes straight to perfect.</> },
    code: <>katex.<span className="cl-fn">renderToString</span>(src) <span className="cl-c">// → instant string</span>{'\n'}<span className="cl-c">// MathJax v2 was async, layout shifts when fonts arrive</span></>,
  },
  {
    icon: '∂',
    zh: { title: <>~250KB, 缓存一次</>, desc: <>JS + CSS + KaTeX_* 字体合计 ~250KB gzipped, <strong>跨页缓存</strong>。MathJax v3 全包 ~1.6MB, 是 KaTeX 的 6 倍多——<em>移动端 web 首屏 LCP 直接差一档</em>。</> },
    en: { title: <>~250KB, cached once</>, desc: <>JS + CSS + KaTeX_* fonts together come to ~250KB gzipped, <strong>cached across pages</strong>. MathJax v3's full bundle is ~1.6MB — over 6× larger. <em>An entire LCP tier on mobile</em>.</> },
    code: <><span className="cl-c">{"// katex.min.css ≈ 23KB gzip"}</span>{'\n'}<span className="cl-c">{"// katex.min.js  ≈ 72KB gzip"}</span>{'\n'}<span className="cl-c">{"// fonts/*       ≈ 150KB gzip (woff2)"}</span></>,
  },
  {
    icon: '∫',
    zh: { title: <>TypeScript + ESM + MIT</>, desc: <>0.16 后<strong>整个 codebase TS</strong>, 自带类型, 走 ESM modules。许可证 <strong>MIT</strong>——商业 / 教学 / 闭源全无摩擦。<em>2026 年的"现代工程语境"全合规</em>。</> },
    en: { title: <>TypeScript + ESM + MIT</>, desc: <>Post-0.16 the <strong>whole codebase is TS</strong>, with types shipped, ESM modules. License is <strong>MIT</strong> — commercial, teaching, closed-source: zero friction. <em>Hits every 2026 "modern engineering" checkbox</em>.</> },
    code: <><span className="cl-k">import</span> katex, {'{'} KatexOptions {'}'} <span className="cl-k">from</span> <span className="cl-s">'katex'</span>;{'\n'}<span className="cl-c">{"// types ship with the package, no @types/* needed for opts"}</span></>,
  },
  {
    icon: 'π',
    zh: { title: <>"恰好够用"的 90%</>, desc: <>不做 TikZ、不做 BibTeX、不做页面布局——<em>专心做 LaTeX 数学</em>。结果是<strong>实战中 90%+ 的公式都能 parse</strong>, 剩下的 10% 大多用 mhchem / macros 补齐。<em>scope 收得越紧, 工程越好做</em>。</> },
    en: { title: <>The "just enough" 90%</>, desc: <>No TikZ, no BibTeX, no page layout — <em>focus on LaTeX math, full stop</em>. The result: <strong>90%+ of real-world equations parse out of the box</strong>, the remaining 10% mostly covered by mhchem / macros. <em>Tight scope, easier engineering</em>.</> },
    code: <><span className="cl-c">{"// scope = math mode + AMS + a few envs"}</span>{'\n'}<span className="cl-c">{"// not   = a whole TeX engine in JS"}</span></>,
  },
  {
    icon: '⟨⟩',
    zh: { title: <>SSR 一等公民</>, desc: <><code>renderToString</code> 第一天就是<strong>同步</strong>的——意味着<em>静态生成 / 服务端渲染天然支持</em>: 构建时烤 HTML, 客户端零 KaTeX JS, 只剩 ~23KB CSS。</> },
    en: { title: <>SSR as a first-class citizen</>, desc: <><code>renderToString</code> was <strong>synchronous from day one</strong> — meaning <em>SSG / SSR work without contortions</em>: bake HTML at build, ship zero KaTeX JS to the client, only ~23KB of CSS.</> },
    code: <><span className="cl-c">{"// build step:"}</span>{'\n'}html.<span className="cl-fn">replace</span>(MATH_RE, (s) =&gt;{'\n'}
{'  '}katex.<span className="cl-fn">renderToString</span>(s){'\n'});</>,
  },
  {
    icon: '∞',
    zh: { title: <>本页就是证据</>, desc: <>你正在读的这一页所有公式都是 <strong>KaTeX 实时渲染</strong>。<em>没有截图, 没有 SVG, 没有 MathJax</em>。这条 <TeX src={'\\Vert v \\Vert = \\sqrt{\\sum_i v_i^2}'} /> 就是。<strong>它就是这么轻量、这么自然</strong>。</> },
    en: { title: <>This page itself is proof</>, desc: <>Every equation on the page you are reading is rendered by <strong>KaTeX live</strong>. <em>No screenshots, no SVG, no MathJax</em>. This <TeX src={'\\Vert v \\Vert = \\sqrt{\\sum_i v_i^2}'} /> right here. <strong>That is how light and natural it feels</strong>.</> },
    code: <><span className="cl-tag">&lt;TeX</span> <span className="cl-attr">src</span>={'{'}<span className="cl-s">{"'\\\\Vert v \\\\Vert = ...'"}</span>{'}'} <span className="cl-tag">/&gt;</span>{'\n'}<span className="cl-c">{"// 5 lines, no library, just useMemo + dangerouslySetInnerHTML"}</span></>,
  },
];

interface Project {
  href: string;
  zhName: string;
  enName: string;
  zhNote: string;
  enNote: string;
  highlight?: boolean;
  svg: ReactNode;
}

const PROJECTS: Project[] = [
  {
    href: 'https://katex.org/', highlight: true,
    zhName: 'katex.org', enName: 'katex.org',
    zhNote: '官方文档 + demo', enNote: 'Official docs + demo',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0E1B2A"/><text x="50" y="62" textAnchor="middle" fill="#48E0C8" fontSize="20" fontWeight="700" fontFamily="serif">KaTeX</text></svg>,
  },
  {
    href: 'https://github.com/KaTeX/KaTeX', highlight: true,
    zhName: 'KaTeX/KaTeX', enName: 'KaTeX/KaTeX',
    zhNote: '源码 / issues / releases', enNote: 'Source / issues / releases',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#161B22"/><path d="M50 18 C32 18 18 32 18 50 C18 64 27 76 40 80 C42 80 43 79 43 77 V70 C32 72 30 65 30 65 C28 60 26 59 26 59 C22 56 26 56 26 56 C30 56 32 60 32 60 C36 66 42 64 44 63 C44 60 46 58 47 57 C36 56 26 52 26 36 C26 32 28 28 32 25 C32 24 30 21 32 16 C32 16 36 16 43 21 C46 20 51 20 56 21 C63 16 67 16 67 16 C69 21 67 24 67 25 C71 28 73 32 73 36 C73 52 63 56 52 57 C54 58 56 61 56 65 V77 C56 79 57 80 59 80 C72 76 81 64 81 50 C81 32 67 18 50 18 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://www.mathjax.org/', highlight: true,
    zhName: 'MathJax', enName: 'MathJax',
    zhNote: '对手 · a11y 优先', enNote: 'Rival · a11y-first',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0E0703"/><text x="50" y="62" textAnchor="middle" fill="#E66000" fontSize="22" fontWeight="700" fontFamily="serif">MJ</text></svg>,
  },
  {
    href: 'https://www.khanacademy.org/',
    zhName: 'Khan Academy', enName: 'Khan Academy',
    zhNote: 'KaTeX 的发源地', enNote: 'Where KaTeX was born',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#14644F"/><text x="50" y="64" textAnchor="middle" fill="#fff" fontSize="32" fontWeight="700">KA</text></svg>,
  },
  {
    href: 'https://github.com/talyssonoc/react-katex',
    zhName: 'react-katex', enName: 'react-katex',
    zhNote: 'React wrapper', enNote: 'React wrapper',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0E1B2A"/><circle cx="50" cy="50" r="8" fill="#48E0C8"/><ellipse cx="50" cy="50" rx="26" ry="10" stroke="#48E0C8" strokeWidth="2" fill="none"/><ellipse cx="50" cy="50" rx="26" ry="10" stroke="#48E0C8" strokeWidth="2" fill="none" transform="rotate(60 50 50)"/><ellipse cx="50" cy="50" rx="26" ry="10" stroke="#48E0C8" strokeWidth="2" fill="none" transform="rotate(120 50 50)"/></svg>,
  },
  {
    href: 'https://github.com/mhchem/MathJax-mhchem',
    zhName: 'mhchem', enName: 'mhchem',
    zhNote: '化学方程扩展', enNote: 'Chemistry extension',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0E1B2A"/><circle cx="36" cy="50" r="14" fill="none" stroke="#48E0C8" strokeWidth="3"/><circle cx="64" cy="50" r="14" fill="none" stroke="#48E0C8" strokeWidth="3"/><text x="36" y="56" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">H</text><text x="64" y="56" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">O</text></svg>,
  },
  {
    href: 'https://github.com/Khan/KaTeX/blob/main/contrib/copy-tex/README.md',
    zhName: 'copy-tex', enName: 'copy-tex',
    zhNote: '复制回 LaTeX 源', enNote: 'Copy back the source',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0E1B2A"/><rect x="28" y="20" width="40" height="50" rx="4" stroke="#48E0C8" strokeWidth="3" fill="none"/><rect x="38" y="34" width="40" height="50" rx="4" stroke="#48E0C8" strokeWidth="3" fill="#0E1B2A"/></svg>,
  },
  {
    href: 'https://github.com/KaTeX/KaTeX/blob/main/contrib/auto-render/README.md',
    zhName: 'auto-render', enName: 'auto-render',
    zhNote: '$...$ DOM 扫描器', enNote: '$...$ DOM scanner',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0E1B2A"/><text x="50" y="60" textAnchor="middle" fill="#48E0C8" fontSize="34" fontWeight="700" fontFamily="monospace">$</text></svg>,
  },
  {
    href: 'https://github.com/jgm/pandoc',
    zhName: 'pandoc', enName: 'pandoc',
    zhNote: 'md → HTML 走 KaTeX', enNote: 'md → HTML via KaTeX',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0E1B2A"/><path d="M22 70 L36 22 L50 60 L64 22 L78 70" stroke="#48E0C8" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    href: 'https://github.com/remarkjs/remark-math',
    zhName: 'remark-math', enName: 'remark-math',
    zhNote: 'markdown 数学 plugin', enNote: 'markdown math plugin',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0E1B2A"/><text x="50" y="56" textAnchor="middle" fill="#48E0C8" fontSize="14" fontWeight="700" fontFamily="monospace">md→</text><text x="50" y="76" textAnchor="middle" fill="#48E0C8" fontSize="22" fontWeight="700" fontFamily="serif">∑</text></svg>,
  },
  {
    href: 'https://obsidian.md/',
    zhName: 'Obsidian', enName: 'Obsidian',
    zhNote: '笔记 app · 内置 KaTeX', enNote: 'Notes app · KaTeX built-in',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0E1B2A"/><path d="M50 18 L80 36 L80 64 L50 82 L20 64 L20 36 Z" stroke="#7B7BFF" strokeWidth="3" fill="rgba(123,123,255,0.18)" strokeLinejoin="round"/></svg>,
  },
  {
    href: 'https://www.latex-project.org/',
    zhName: 'LaTeX project', enName: 'LaTeX project',
    zhNote: '上游 LaTeX · 见 /code/language/latex', enNote: 'Upstream LaTeX · see /code/language/latex',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0E0703"/><text x="50" y="62" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="700" fontFamily="serif">LaTeX</text></svg>,
  },
];

interface FutureCard {
  tag: ReactNode;
  hot?: boolean;
  big?: boolean;
  zh: { title: ReactNode; body: ReactNode };
  en: { title: ReactNode; body: ReactNode };
}

const FUTURE_CARDS: FutureCard[] = [
  {
    tag: <>HOT · 2024+</>, hot: true, big: true,
    zh: {
      title: <>LLM 输出 LaTeX → KaTeX 渲 — 静默的 KaTeX 复兴</>,
      body: (<>
        <p>2026 年最大的 KaTeX 用户是<strong>所有 AI 聊天 UI</strong>: ChatGPT、Claude、Gemini、Perplexity, 它们的回复里几乎每次有数学就出 <code>$...$</code>。<em>底层渲染基本都是 KaTeX</em>——速度快、bundle 小、错误 fallback 优雅。</p>
        <p><strong>用户从不知道这件事</strong>: 他们只看到"AI 回答里数学很漂亮"。但 KaTeX 的下载量、CDN hit 数在这 2 年涨了一个数量级, <em>它进了 AI 时代的关键路径</em>。</p>
      </>),
    },
    en: {
      title: <>LLM outputs LaTeX → KaTeX renders — the quiet KaTeX renaissance</>,
      body: (<>
        <p>KaTeX's biggest 2026 customer is <strong>every AI chat UI</strong>: ChatGPT, Claude, Gemini, Perplexity. Their replies routinely contain <code>$...$</code> for math. <em>The renderer underneath is almost always KaTeX</em> — fast, tiny bundle, graceful error fallback.</p>
        <p><strong>Users never notice</strong>: they only see "AI math looks great." But KaTeX's download counts and CDN hits have grown an order of magnitude over two years. <em>It is now on the critical path of the AI era</em>.</p>
      </>),
    },
  },
  {
    tag: 'MATHML CORE',
    zh: { title: <>MathML Core (W3C 2023) — 威胁?</>, body: <><p>MathML Core 在 2023 W3C 定稿, Chromium 109+ 原生支持。理论上<em>浏览器能直接渲数学公式, 不需 KaTeX</em>。但实践: <strong>跨浏览器视觉差异巨大</strong>, Firefox / Safari / Chrome 的 MathML 输出对不齐。<em>KaTeX 用 HTML+CSS 反而像素一致</em>——这条 moat 5 年内不会塌。</p></> },
    en: { title: <>MathML Core (W3C 2023) — a threat?</>, body: <><p>MathML Core finalised in W3C 2023; Chromium 109+ ships native support. In theory <em>browsers can render math directly, no KaTeX needed</em>. In practice: <strong>cross-browser visual inconsistency remains huge</strong> — Firefox / Safari / Chrome's MathML output simply doesn't match. <em>KaTeX's HTML+CSS path is pixel-identical everywhere</em> — that moat is good for at least five more years.</p></> },
  },
  {
    tag: 'WASM TEX',
    zh: { title: <>SwiftLaTeX / texlive.js — 不同赛道</>, body: <><p>2020+ 出现 <strong>WebAssembly TeX 引擎</strong> (SwiftLaTeX、tectonic-wasm), <em>能在浏览器跑完整 LaTeX</em>: TikZ、BibTeX、pdf 输出全有。但 bundle 20MB+, 启动几秒——<em>跟 KaTeX 不在同一个使用场景</em>: 论文预览 vs 网页公式。两者各干各的, 不会互相吃。</p></> },
    en: { title: <>SwiftLaTeX / texlive.js — different lane</>, body: <><p>Since 2020 <strong>WebAssembly TeX engines</strong> (SwiftLaTeX, tectonic-wasm) <em>run full LaTeX in the browser</em>: TikZ, BibTeX, PDF output, all of it. But the bundles are 20MB+, multi-second cold start — <em>they live in a different use case from KaTeX</em>: paper preview vs inline web math. The two don't compete.</p></> },
  },
  {
    tag: 'STEADY',
    zh: { title: <>稳态维护 — 不是衰退</>, body: <><p>KaTeX 不再每月发版, 不再追新功能, 但<em>"成功的项目长这样"</em>: 范围收紧、bug 少、用户不抱怨。<strong>SQLite / curl / KaTeX</strong> 是这一类项目的代表。<em>稳态不是死, 是<strong>该做的都做完了</strong></em>。</p></> },
    en: { title: <>Steady maintenance — not decline</>, body: <><p>KaTeX no longer ships monthly, no longer chases new features. But <em>"successful projects look like this"</em>: tight scope, low bug count, no complaints. <strong>SQLite / curl / KaTeX</strong> all belong to this category. <em>Steady state isn't death — it's <strong>"the work is done"</strong></em>.</p></> },
  },
];

interface FootgunCard {
  zh: { title: ReactNode; body: ReactNode };
  en: { title: ReactNode; body: ReactNode };
}

const FOOTGUNS: FootgunCard[] = [
  {
    zh: { title: <>JS 字符串里的反斜杠</>, body: <><p>LaTeX 里 <code>{'\\frac'}</code> 在 JS 字符串里要写 <code>{"'\\\\frac'"}</code> (双反斜杠转义一个)。<em>这是 KaTeX 错误榜第一名</em>: 用户复制 LaTeX 源贴进 JS, 公式渲不出, 一看是 <code>'frac'</code> 被吃掉了反斜杠。</p><p>解法: <strong>模板字符串 + 反引号</strong>不解决问题 (反斜杠还是要转义); 真要少烦, 把 LaTeX 字符串放<em>外部 .tex / .md 文件</em>读取。</p></> },
    en: { title: <>Backslash escaping in JS strings</>, body: <><p>LaTeX's <code>{'\\frac'}</code> must be written <code>{"'\\\\frac'"}</code> in a JS string (double backslash to produce one). <em>This is the #1 KaTeX bug</em>: users paste a LaTeX source into JS, the equation doesn't render, and the backslash got eaten.</p><p>Fix: <strong>template literals + backticks</strong> don't help (backslash still needs escaping). For real relief, keep LaTeX strings in <em>external .tex / .md files</em> and read them in.</p></> },
  },
  {
    zh: { title: <><code>{'\\newcommand'}</code> 不会自动加载</>, body: <><p>你 .tex 文件里写的 <code>{'\\newcommand{\\RR}{\\mathbb{R}}'}</code> <em>KaTeX 不知道</em>——它没有 preamble 这个概念。必须显式传 <code>macros</code> 选项。</p><p>解法: 项目级<strong>统一 macros 对象</strong>, 每次 render 都 spread 进去; 或上层包装一个 <code>renderWithMacros(src)</code>。</p></> },
    en: { title: <><code>{'\\newcommand'}</code> doesn't auto-load</>, body: <><p>The <code>{'\\newcommand{\\RR}{\\mathbb{R}}'}</code> in your .tex preamble means <em>nothing to KaTeX</em> — there's no preamble concept. You must pass them via the <code>macros</code> option.</p><p>Fix: keep a <strong>project-level macros object</strong>, spread it into every render call, or wrap with a <code>renderWithMacros(src)</code> helper.</p></> },
  },
  {
    zh: { title: <>auto-render 分隔符冲突</>, body: <><p>auto-render 默认认 <code>$...$</code> 是行内数学。但<em>"$100, $200"</em>这种价格列表会被解析成 <code>$1$00, $2$00</code>。</p><p>解法: <strong>禁用 <code>$</code> 单美元分隔符</strong>, 只留 <code>$$...$$</code> 和 <code>{'\\(...\\)'}</code>; 或者价格用<code>{'\\$100'}</code> 转义。</p></> },
    en: { title: <>auto-render delimiter collisions</>, body: <><p>auto-render defaults to <code>$...$</code> for inline math. But <em>"$100, $200"</em> in a price list parses as <code>$1$00, $2$00</code>.</p><p>Fix: <strong>disable the single <code>$</code> delimiter</strong>, keep only <code>$$...$$</code> and <code>{'\\(...\\)'}</code>; or escape prices as <code>{'\\$100'}</code>.</p></> },
  },
  {
    zh: { title: <>CSS 只 import 一次</>, body: <><p><code>import 'katex/dist/katex.min.css'</code> 在<strong>顶层入口</strong>一次即可。每个组件 import 一次, bundle 重复, dev mode 还会闪样式。</p><p>SSR / 静态生成: <strong>把 katex.min.css 直接 link 进 HTML head</strong>, 客户端可以完全不 import 这条。本站 prediction 页就这么做。</p></> },
    en: { title: <>Import katex.min.css exactly once</>, body: <><p><code>import 'katex/dist/katex.min.css'</code> belongs in your <strong>top-level entry</strong>. Importing it per component duplicates it in the bundle and flashes styles in dev.</p><p>For SSR / static generation: <strong>link katex.min.css straight from the HTML head</strong>; the client can skip the import entirely. The prediction pages on this site work that way.</p></> },
  },
];

export default function KatexIntroPage() {
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  const rootRef = useRef<HTMLDivElement>(null);

  const [playgroundSrc, setPlaygroundSrc] = useState<string>(
    '\\sum_{n=1}^{\\infty}\\frac{1}{n^2}=\\frac{\\pi^2}{6}',
  );

  const PRESETS: { label: string; src: string }[] = [
    { label: 'Basel', src: '\\sum_{n=1}^{\\infty}\\frac{1}{n^2}=\\frac{\\pi^2}{6}' },
    { label: 'Maxwell', src: '\\nabla \\times \\mathbf{B} - \\frac{1}{c}\\frac{\\partial \\mathbf{E}}{\\partial t} = \\frac{4\\pi}{c}\\mathbf{j}' },
    { label: 'Schrödinger', src: 'i\\hbar\\frac{\\partial}{\\partial t}\\Psi(\\mathbf{r},t) = \\hat{H}\\Psi(\\mathbf{r},t)' },
    { label: 'Euler', src: 'e^{i\\pi} + 1 = 0' },
    { label: 'Matrix', src: '\\begin{pmatrix} 1 & 2 & 3 \\\\ 4 & 5 & 6 \\\\ 7 & 8 & 9 \\end{pmatrix}' },
    { label: 'Cases', src: '|x| = \\begin{cases} \\;\\;x & \\text{if } x \\ge 0 \\\\ -x & \\text{if } x < 0 \\end{cases}' },
    { label: 'Integral', src: '\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}' },
    { label: 'Chemistry', src: '\\ce{CO2 + C ->T[\\Delta] 2 CO}' },
  ];

  useDocumentTitle(
    'KaTeX : 浏览器里 100× 速度的 LaTeX 数学渲染 — 2013→2026',
    'KaTeX : LaTeX math in the browser at 100× MathJax speed — 2013→2026',
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

    const targets = root.querySelectorAll<HTMLElement>(
      '.tl-item, .why-card, .def-card, .logo-card, .future-card, .compare-col, .cmp-table tr, .ts-card, .tag-card, .live-demo-col, .bwars-row, .spotlight, .ai-takeaway, .quote-block, .coverage-col, .coverage-row',
    );
    targets.forEach((el) => { el.classList.add('fade-up'); io.observe(el); });

    root.querySelectorAll<HTMLElement>('.tl-item').forEach((el, i) => { el.style.transitionDelay = `${Math.min(i * 50, 400)}ms`; });
    root.querySelectorAll<HTMLElement>('.why-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 80}ms`; });
    root.querySelectorAll<HTMLElement>('.logo-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 6) * 60}ms`; });
    root.querySelectorAll<HTMLElement>('.ts-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; });
    root.querySelectorAll<HTMLElement>('.tag-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 50}ms`; });
    root.querySelectorAll<HTMLElement>('.bwars-row').forEach((el, i) => { el.style.transitionDelay = `${i * 80}ms`; });
    root.querySelectorAll<HTMLElement>('.coverage-row').forEach((el, i) => { el.style.transitionDelay = `${(i % 8) * 40}ms`; });

    const floats = root.querySelectorAll<HTMLElement>('.float');
    let mx = 0, my = 0, tx = 0, ty = 0;
    const onMouse = (e: MouseEvent) => {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouse);
    let raf = 0;
    const loop = () => {
      tx += (mx - tx) * 0.06;
      ty += (my - ty) * 0.06;
      floats.forEach((el, i) => {
        const depth = (i % 3 + 1) * 6;
        el.style.translate = `${tx * depth}px ${ty * depth}px`;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const navLinks = root.querySelectorAll<HTMLAnchorElement>('.nav-links a');
    const sections = Array.from(root.querySelectorAll<HTMLElement>('section[id]'));
    const setActive = () => {
      const y = window.scrollY + 120;
      let cur = sections[0]?.id;
      for (const s of sections) if (s.offsetTop <= y) cur = s.id;
      navLinks.forEach((a) => {
        a.style.color = a.getAttribute('href') === '#' + cur ? 'var(--katex-bright)' : '';
      });
    };
    window.addEventListener('scroll', setActive, { passive: true });
    setActive();

    const onAnchorClick = (e: Event) => {
      const a = e.currentTarget as HTMLAnchorElement;
      const href = a.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      const id = href.slice(1);
      const target = id === 'top' ? root : root.querySelector('#' + id);
      if (target) {
        e.preventDefault();
        const top = (target as HTMLElement).getBoundingClientRect().top + window.scrollY - 60;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    };
    const anchors = root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]');
    anchors.forEach((a) => a.addEventListener('click', onAnchorClick));

    return () => {
      io.disconnect();
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('scroll', setActive);
      cancelAnimationFrame(raf);
      anchors.forEach((a) => a.removeEventListener('click', onAnchorClick));
    };
  }, []);

  return (
    <LangCtx.Provider value={lang}>
      <div ref={rootRef} className="katex-intro-root">
        <div className="grid-bg" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            <svg viewBox="0 0 256 256" width="28" height="28">
              <defs>
                <linearGradient id="kx-nav" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#48E0C8" />
                  <stop offset="100%" stopColor="#14644F" />
                </linearGradient>
              </defs>
              <rect x="16" y="16" width="224" height="224" rx="36" fill="url(#kx-nav)" />
              <text x="128" y="156" textAnchor="middle" fontSize="72" fontWeight="700" fontFamily="'Cascadia Code', monospace" fill="#fff">K</text>
            </svg>
            <span>KaTeX</span>
            <span className="nav-tag"><L zh=": math in the browser, fast" en=": math in the browser, fast" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#prestash"><L zh="Pre-Stash" en="Pre-Stash" /></a></li>
            <li><a href="#playground"><L zh="试玩" en="Playground" /></a></li>
            <li><a href="#coverage"><L zh="覆盖度" en="Coverage" /></a></li>
            <li><a href="#perf"><L zh="性能" en="Perf" /></a></li>
            <li><a href="#api"><L zh="API" en="API" /></a></li>
            <li><a href="#options"><L zh="选项" en="Options" /></a></li>
            <li><a href="#projects"><L zh="生态" en="Ecosystem" /></a></li>
            <li><a href="#vs"><L zh="对比 MathJax" en="vs MathJax" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#footguns"><L zh="陷阱" en="Footguns" /></a></li>
            <li><a href="#future"><L zh="前景" en="Outlook" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 2013 — 2026 · Khan Academy · Emily Eisenberg + Sophie Alpert · MIT · math in the browser at 100× MathJax speed</div>
            <h1 className="hero-title">
              <span className="hero-name">KaTeX</span>
              <span className="hero-colon">:</span>
              <span className="hero-type">{'<math/>'}</span>
            </h1>
            <p className="hero-sub">
              <L
                zh={<><strong>KaTeX = 浏览器里 100× MathJax 速度的 LaTeX 数学渲染器</strong>。Khan Academy 2013 立项, 2014 开源, <em>同步</em>返回 HTML 字符串, 1ms 渲一条公式, 250KB 一次缓存。<strong>本页所有公式</strong> (包括下面这条) 都是 KaTeX 实时渲——见 <a href="/code/language/latex">/code/language/latex</a> 看它实现的 LaTeX 子集来自哪里。</>}
                en={<><strong>KaTeX is a LaTeX math renderer for the browser at 100× MathJax speed</strong>. Started inside Khan Academy in 2013, open-sourced in 2014. Returns an HTML string <em>synchronously</em>, renders an equation in ~1ms, caches a 250KB bundle once. <strong>Every equation on this page</strong> (the one below included) is live KaTeX — see <a href="/code/language/latex">/code/language/latex</a> for the LaTeX it implements a subset of.</>}
              />
            </p>
            <div className="hero-eq">
              <TeXBlock src={'\\sum_{n=1}^{\\infty}\\frac{1}{n^2}=\\frac{\\pi^2}{6}\\qquad\\text{(Basel, 1734)}'} />
            </div>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">2013<small></small></span>
                <span className="stat-label"><L zh={<>Khan Academy 立项<br /><em>Emily Eisenberg + Sophie Alpert</em></>} en={<>Born inside Khan Academy<br /><em>Emily Eisenberg + Sophie Alpert</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">~1ms<small></small></span>
                <span className="stat-label"><L zh={<>典型公式渲染<br /><em>同步, 无 layout shift</em></>} en={<>per equation render<br /><em>synchronous, no layout shift</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">90%<small>+</small></span>
                <span className="stat-label"><L zh={<>LaTeX 数学覆盖率<br /><em>真实"论文里的公式"</em></>} en={<>LaTeX math coverage<br /><em>"equations you see in papers"</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">~250KB<small></small></span>
                <span className="stat-label"><L zh={<>gzip 总大小<br /><em>vs MathJax ~1.6MB</em></>} en={<>gzipped total<br /><em>vs MathJax ~1.6MB</em></>} /></span>
              </div>
            </div>
            <div className="hero-cube">
              {KATEX_LOGO_SVG}
            </div>
            <div className="hero-floats">
              <span className="float f1">{'\\frac{a}{b}'}</span>
              <span className="float f2">{'\\sum_{i=1}^n'}</span>
              <span className="float f3">renderToString</span>
              <span className="float f4">displayMode</span>
              <span className="float f5">auto-render</span>
              <span className="float f6">{'\\mathbb{R}'}</span>
              <span className="float f7">Khan Academy</span>
              <span className="float f8">Emily Eisenberg</span>
              <span className="float f9">Pre-Stash</span>
              <span className="float f10">no MathML deps</span>
              <span className="float f11">{'\\int_0^1'}</span>
              <span className="float f12">{'\\ce{H2O}'}</span>
            </div>
            <div className="scroll-cue">
              <span>scroll</span>
              <svg viewBox="0 0 12 24" width="12" height="24"><path d="M6 0v22M2 18l4 4 4-4" stroke="currentColor" fill="none" strokeWidth="1.5" /></svg>
            </div>
          </section>

          {/* 01 What */}
          <section className="section" id="what">
            <header className="sec-head">
              <span className="sec-num">01</span>
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>KaTeX</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>KaTeX = <strong>Khan Academy 出的浏览器侧 LaTeX 数学渲染器</strong>, MIT 许可, TypeScript 写。<em>不是</em>完整 LaTeX 引擎——只渲数学模式: 没有 <code>\documentclass</code>, 没有 TikZ, 没有页面布局。但它 <em>覆盖 90%+ 真实论文里出现的数学</em>, 而且<strong>同步返回 HTML, 没 FOUC, 没 layout shift</strong>。</>}
                  en={<>KaTeX = <strong>a browser-side LaTeX math renderer from Khan Academy</strong>, MIT-licensed, written in TypeScript. <em>Not</em> a full LaTeX engine — math mode only: no <code>\documentclass</code>, no TikZ, no page layout. But it <em>covers 90%+ of the math that shows up in real papers</em>, and <strong>returns HTML synchronously — no FOUC, no layout shift</strong>.</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="不是完整 LaTeX 引擎" en="Not a full LaTeX engine" />, tag: 'math-only', p: <L zh={<>只渲<strong>数学模式</strong>。没有 <code>\documentclass</code>、TikZ、BibTeX、页面布局。<em>这是设计选择, 不是缺陷</em>——scope 收紧才能 250KB 进浏览器。完整 LaTeX 见 <a href="/code/language/latex">/code/language/latex</a>。</>} en={<>Math mode only. No <code>\documentclass</code>, TikZ, BibTeX, or page layout. <em>A design choice, not a defect</em> — tight scope is the only way you get 250KB in the browser. For the full LaTeX story see <a href="/code/language/latex">/code/language/latex</a>.</>} /> },
                { h: <L zh="同步, 一次性, 返字符串" en="Sync, one-shot, returns a string" />, tag: 'sync', p: <L zh={<><code>renderToString(src)</code> 立刻返 HTML 字符串。<strong>无 async, 无 promise, 无 font-load 回调</strong>。SSG / SSR 一等公民; 客户端不闪。<em>跟 MathJax 异步异世界</em>。</>} en={<><code>renderToString(src)</code> returns an HTML string immediately. <strong>No async, no promise, no font-load callback</strong>. First-class SSG / SSR citizen; no client-side flash. <em>A different world from MathJax's async-everything model</em>.</>} /> },
                { h: <L zh="输出 HTML+CSS, 非 MathML / SVG" en="Outputs HTML+CSS, not MathML / SVG" />, tag: 'output', p: <L zh={<>默认走 <strong>HTML 元素 + CSS 定位</strong>, 浏览器复用文字渲染管线。可选叠 MathML (<code>output: 'htmlAndMathml'</code>) 给 a11y。<em>跟 MathJax 默认 SVG 路径不一样</em>——这是速度根源之一。</>} en={<>Default path is <strong>HTML elements + CSS positioning</strong>; the browser reuses its text rendering pipeline. Optional MathML overlay (<code>output: 'htmlAndMathml'</code>) for a11y. <em>Different from MathJax's default SVG path</em> — one of the reasons it's fast.</>} /> },
                { h: <L zh="无 MathML 依赖" en="No MathML dependency" />, tag: 'render', p: <L zh={<>不要求浏览器原生支持 MathML——<em>所以 Chrome / Safari / Firefox 上像素一致</em>。MathML Core 2023 才定稿, 跨引擎差异巨大; KaTeX 自己掌控渲染 = <strong>到处长一样</strong>。</>} en={<>Doesn't require native MathML support — <em>so Chrome / Safari / Firefox render pixel-identically</em>. MathML Core only stabilised in 2023 and cross-engine differences remain large; KaTeX owns its rendering = <strong>looks the same everywhere</strong>.</>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">mathjax.html</span><span className="lang-tag js">async</span></div>
                <pre className="code"><code>
                  <span className="cl-tag">&lt;script </span><span className="cl-attr">src</span>=<span className="cl-s">"mathjax.js"</span><span className="cl-tag">&gt;&lt;/script&gt;</span>{'\n'}
                  <span className="cl-tag">&lt;p&gt;</span>$\sum_{'{i=1}'}^n i$<span className="cl-tag">&lt;/p&gt;</span>{'\n\n'}
                  <span className="cl-c"><L zh="// 加载: 1.6MB" en="// load: 1.6MB" /></span>{'\n'}
                  <span className="cl-c"><L zh="// 解析 + 渲染: async" en="// parse + render: async" /></span>{'\n'}
                  <span className="cl-c"><L zh="// 字体测量: async" en="// font measurement: async" /></span>{'\n'}
                  <span className="cl-c"><L zh="// 结果: 公式后到, 页面跳" en="// result: equation arrives late, page jumps" /></span>{'\n\n'}
                  <span className="cl-c"><L zh="// ~30ms / 公式 (v2)" en="// ~30ms / equation (v2)" /></span>{'\n'}
                  <span className="cl-c"><L zh="// ~7-15ms / 公式 (v3)" en="// ~7–15ms / equation (v3)" /></span>
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">katex.html</span><span className="lang-tag ts">sync</span></div>
                <pre className="code"><code>
                  <span className="cl-tag">&lt;link </span><span className="cl-attr">rel</span>=<span className="cl-s">"stylesheet"</span> <span className="cl-attr">href</span>=<span className="cl-s">"katex.min.css"</span><span className="cl-tag">&gt;</span>{'\n'}
                  <span className="cl-tag">&lt;script&gt;</span>{'\n'}
                  {'  '}<span className="cl-k">const</span> html = katex.<span className="cl-fn">renderToString</span>({'\n'}
                  {'    '}<span className="cl-s">{"'\\\\sum_{i=1}^n i'"}</span>{'\n'}
                  {'  '});  <span className="cl-c"><L zh="// 立刻返字符串" en="// returns string instantly" /></span>{'\n'}
                  <span className="cl-tag">&lt;/script&gt;</span>{'\n\n'}
                  <span className="cl-c"><L zh="// 加载: 250KB (一次缓存)" en="// load: 250KB (cached once)" /></span>{'\n'}
                  <span className="cl-c"><L zh="// 渲染: ~1ms, 同步" en="// render: ~1ms, sync" /></span>{'\n'}
                  <span className="cl-c"><L zh="// 结果: 公式跟 HTML 同时出, 无跳" en="// result: equation lands with HTML, zero jump" /></span>
                </code></pre>
              </div>
            </div>
          </section>

          {/* 02 History */}
          <section className="section" id="history">
            <header className="sec-head">
              <span className="sec-num">02</span>
              <h2 className="sec-title"><L zh="来路" en="History" /> <code>: 1977 → 2026</code></h2>
              <p className="sec-desc"><L
                zh={<>KaTeX 的故事可分 4 段: <strong>祖先 TeX/LaTeX</strong> (1977-2003) → <strong>jsMath / MathJax 时代</strong> (2003-2013) → <strong>Khan Academy 立项 + 开源</strong> (2013-2018) → <strong>主流落地 + AI 时代</strong> (2019-2026)。上游 LaTeX 故事完整版见 <a href="/code/language/latex">/code/language/latex</a>。</>}
                en={<>KaTeX's arc breaks into four phases: <strong>the TeX/LaTeX ancestors</strong> (1977–2003) → <strong>the jsMath / MathJax era</strong> (2003–2013) → <strong>Khan Academy starts it + open-sources it</strong> (2013–2018) → <strong>mainstream adoption + the AI era</strong> (2019–2026). The full upstream LaTeX story is at <a href="/code/language/latex">/code/language/latex</a>.</>}
              /></p>
            </header>

            <ol className="timeline">
              {HISTORY.map((it, i) => (
                <li className={`tl-item${it.highlight ? ' highlight' : ''}`} key={i}>
                  <div className="tl-year">{it.year}</div>
                  <div className="tl-card">
                    <h3>{lang === 'zh' ? it.zh.title : it.en.title}</h3>
                    <p>{lang === 'zh' ? it.zh.desc : it.en.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* 03 Pre-Stash */}
          <section className="section" id="prestash">
            <header className="sec-head">
              <span className="sec-num">03</span>
              <h2 className="sec-title"><L zh="Pre-Stash 技术" en="The Pre-Stash Technique" /> <code>: Why100x</code></h2>
              <p className="sec-desc"><L
                zh={<>KaTeX 比 MathJax 快 10~100 倍, <strong>不是因为算法巧</strong>, 而是因为<em>一条工程决策</em>: 字体度量在<strong>构建时</strong>预计算, 不在 runtime 测量。这个决策有名字: "Pre-Stash"。</>}
                en={<>KaTeX outruns MathJax by 10–100×, <strong>not from a clever algorithm</strong>, but from <em>a single engineering call</em>: precompute font metrics at <strong>build time</strong>, never measure them at runtime. The decision has a name: "Pre-Stash."</>}
              /></p>
            </header>

            <div className="spotlight">
              <span className="spotlight-tag">PRE-STASH</span>
              <div className="spotlight-grid">
                <div>
                  <h3><L zh="为什么 MathJax 慢" en="Why MathJax is slow" /> <span className="spotlight-meta"><L zh="字体测量 = 性能瓶颈" en="font measurement = bottleneck" /></span></h3>
                  <p><L
                    zh={<>渲一个公式要知道<strong>每个字形的宽 / 高 / 上下侧空隙</strong>——分数线放哪、上下标对齐谁、根号画多大, 都靠这些数。</>}
                    en={<>Rendering an equation requires knowing the <strong>width / height / side-bearings of every glyph</strong> — where to put the fraction bar, what to line super/subscripts against, how big to draw the root sign all depend on these numbers.</>}
                  /></p>
                  <p><L
                    zh={<>MathJax 的做法: <strong>runtime 把字符塞进隐藏 div, 用 <code>getBoundingClientRect()</code> 测</strong>。每次测量都是<em>真实 layout</em>, 触发 reflow。一个长公式上百次, 一页上千次——<strong>异步, 慢, 抖</strong>。</>}
                    en={<>MathJax's approach: <strong>at runtime, drop the character into a hidden div and read <code>getBoundingClientRect()</code></strong>. Every measurement triggers <em>real layout</em>, forcing reflow. A long equation does it hundreds of times, a page thousands — <strong>async, slow, jittery</strong>.</>}
                  /></p>
                  <ul className="spotlight-list">
                    <li><L zh={<>每条公式 ~30ms (v2) / ~7-15ms (v3)</>} en={<>~30ms per equation (v2) / ~7-15ms (v3)</>} /></li>
                    <li><L zh={<>异步: 公式后到, 页面跳</>} en={<>Async: equations arrive late, page jumps</>} /></li>
                    <li><L zh={<>字体未到前显示 <code>$ raw $</code></>} en={<>Shows <code>$ raw $</code> until fonts arrive</>} /></li>
                  </ul>
                </div>
                <div>
                  <h3><L zh="KaTeX 的解法" en="KaTeX's answer" /> <span className="spotlight-meta">precomputed JSON</span></h3>
                  <p><L
                    zh={<><strong>构建时</strong>把所有字形的度量从 TeX <code>.tfm</code> 文件抽出来, 序列化成 <code>fontMetricsData.js</code> (~30KB), <em>直接打包进 bundle</em>。</>}
                    en={<>At <strong>build time</strong> KaTeX extracts every glyph metric out of the TeX <code>.tfm</code> files, serialises it into <code>fontMetricsData.js</code> (~30KB) and <em>bundles it directly</em>.</>}
                  /></p>
                  <p><L
                    zh={<>Runtime 渲染时, <strong>查 JSON, 不测 DOM</strong>。没有 reflow, 没有 async font load, 没有 <code>getBoundingClientRect</code>。<em>纯计算, 输出 HTML 字符串</em>。1ms / 公式。</>}
                    en={<>At runtime KaTeX <strong>looks up the JSON</strong>, never the DOM. No reflow, no async font load, no <code>getBoundingClientRect</code>. <em>Pure computation, output is an HTML string</em>. 1ms per equation.</>}
                  /></p>
                  <ul className="spotlight-list">
                    <li><L zh={<>~1ms / 公式 — 100× MathJax v2, 10× v3</>} en={<>~1ms per equation — 100× MathJax v2, 10× v3</>} /></li>
                    <li><L zh={<>同步: 公式跟 HTML 同时出, 0 layout shift</>} en={<>Sync: equation lands with HTML, zero layout shift</>} /></li>
                    <li><L zh={<>权衡: 锁死 KaTeX 自带字体, 不能换</>} en={<>Trade-off: locked to the bundled KaTeX fonts, no swap</>} /></li>
                  </ul>
                </div>
              </div>
              <div className="spotlight-code">
                <pre className="code"><code>
                  <span className="cl-c"><L zh="// build-time (KaTeX 源码内部)" en="// build-time (inside KaTeX source)" /></span>{'\n'}
                  <span className="cl-k">import</span> {'{'} parseTfm {'}'} <span className="cl-k">from</span> <span className="cl-s">'./tfm-parser'</span>;{'\n'}
                  <span className="cl-k">const</span> metrics = {'{'}{'\n'}
                  {'  '}<span className="cl-attr">"Main-Regular"</span>: <span className="cl-fn">parseTfm</span>(<span className="cl-s">'cmr10.tfm'</span>),{'\n'}
                  {'  '}<span className="cl-attr">"Math-Italic"</span>: <span className="cl-fn">parseTfm</span>(<span className="cl-s">'cmmi10.tfm'</span>),{'\n'}
                  {'  '}<span className="cl-c"><L zh="// ... 16 个 KaTeX_* 字体, 每个上千字形" en="// ... 16 KaTeX_* fonts, thousands of glyphs each" /></span>{'\n'}
                  {'}'};{'\n'}
                  <span className="cl-fn">writeFileSync</span>(<span className="cl-s">'fontMetricsData.js'</span>, <span className="cl-s">{'`export default ${JSON.stringify(metrics)}`'}</span>);{'\n\n'}
                  <span className="cl-c"><L zh="// runtime (浏览器里)" en="// runtime (in the browser)" /></span>{'\n'}
                  <span className="cl-k">import</span> metrics <span className="cl-k">from</span> <span className="cl-s">'./fontMetricsData'</span>;  <span className="cl-c"><L zh="// 立刻可查" en="// instantly available" /></span>{'\n'}
                  <span className="cl-k">function</span> <span className="cl-fn">getCharMetric</span>(font, ch) {'{'}{'\n'}
                  {'  '}<span className="cl-k">return</span> metrics[font][ch.<span className="cl-fn">charCodeAt</span>(<span className="cl-n">0</span>)];{'\n'}
                  {'}'}{'\n'}
                  <span className="cl-c"><L zh="// 不碰 DOM, 不触发 reflow, 不 await font" en="// no DOM, no reflow, no font await" /></span>
                </code></pre>
              </div>
            </div>

            <div className="ai-takeaway">
              <p><strong><L zh="一句话总结: " en="In one line: " /></strong><L
                zh={<>Pre-Stash 不是算法巧, 是<strong>把异步搬到构建期</strong>。<em>"在用户的浏览器里测字体"</em>变成<em>"我们打包前已经测好"</em>——同一个工作, 换了时间点, 就<strong>从 30ms 异步变 1ms 同步</strong>。这是工程 trade-off 的教科书案例。</>}
                en={<>Pre-Stash is not algorithmic cleverness — it's <strong>moving the asynchrony into the build step</strong>. <em>"Measure fonts in the user's browser"</em> becomes <em>"we already measured them before shipping"</em>. Same work, different point in time, and you go <strong>from 30ms async to 1ms sync</strong>. A textbook engineering trade-off.</>}
              /></p>
            </div>
          </section>

          {/* 04 Playground */}
          <section className="section" id="playground">
            <header className="sec-head">
              <span className="sec-num">04</span>
              <h2 className="sec-title"><L zh="试玩" en="Live Playground" /> <code>: KaTeXLive</code></h2>
              <p className="sec-desc"><L
                zh={<>左边输入 LaTeX, 右边是 <strong>KaTeX 实时渲染</strong> (本页同款引擎)。<em>输什么渲什么, 同步, 没 await</em>。点上面的 preset 试经典公式。</>}
                en={<>Type LaTeX on the left and see <strong>live KaTeX rendering</strong> on the right (same engine as the rest of this page). <em>What you type is what you render, synchronous, no await</em>. Click a preset above for a classic.</>}
              /></p>
            </header>

            <div className="live-demo">
              <div className="live-demo-col">
                <div className="live-demo-h">
                  <span className="dot dot-ok" />
                  <span><L zh="LaTeX 源 → KaTeX 渲染" en="LaTeX source → KaTeX render" /></span>
                  <em><L zh="实时同步" en="live sync" /></em>
                </div>
                <div className="kx-playground">
                  <div className="kx-playground-input">
                    <div className="kx-presets">
                      {PRESETS.map((p) => (
                        <button key={p.label} onClick={() => setPlaygroundSrc(p.src)} type="button">{p.label}</button>
                      ))}
                    </div>
                    <textarea
                      value={playgroundSrc}
                      onChange={(e) => setPlaygroundSrc(e.target.value)}
                      spellCheck={false}
                    />
                    <div className="kx-output-label"><L zh="提示" en="Tip" />: <L zh="JS 字符串里反斜杠要写两次, textarea 不用" en="backslashes need doubling in a JS string; not here in the textarea" /></div>
                  </div>
                  <div className="kx-playground-output">
                    <div className="kx-output-label"><L zh="显示模式 (TeXBlock)" en="display mode (TeXBlock)" /></div>
                    <div className="kx-output-display">
                      <TeXBlock src={playgroundSrc} />
                    </div>
                    <div className="kx-output-label"><L zh="行内模式 (TeX)" en="inline mode (TeX)" /></div>
                    <div className="kx-output-inline">
                      <L zh={<>嵌入文本里就是 <TeX src={playgroundSrc} /> 这样, 跟句子排在一起。</>} en={<>Sits inside a sentence like <TeX src={playgroundSrc} /> and flows with surrounding text.</>} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 05 Coverage matrix */}
          <section className="section" id="coverage">
            <header className="sec-head">
              <span className="sec-num">05</span>
              <h2 className="sec-title"><L zh="LaTeX 覆盖度" en="LaTeX Coverage Matrix" /> <code>: Whatsupported</code></h2>
              <p className="sec-desc"><L
                zh={<>KaTeX 实现的是 LaTeX 数学模式的 <strong>90%+ 子集</strong>。左边是<em>支持</em>(并附实时渲染示例), 右边是<em>不支持</em>(并解释为什么)。<strong>所有左侧示例都是真 KaTeX 在跑</strong>。</>}
                en={<>KaTeX implements <strong>90%+ of LaTeX math mode</strong>. The left column is <em>supported</em> (with live rendered samples); the right is <em>not supported</em> (with the reason why). <strong>Every left-side sample is real live KaTeX</strong>.</>}
              /></p>
            </header>

            <div className="coverage-grid">
              <div className="coverage-col col-ok">
                <div className="coverage-h">
                  <span><L zh="支持" en="Supported" /></span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-faint)' }}>{COVERAGE_OK.length}</span>
                </div>
                {COVERAGE_OK.map((r, i) => (
                  <div className="coverage-row" key={i}>
                    <span className="coverage-mark">{'✓'}</span>
                    <span className="coverage-name">{lang === 'zh' ? r.zhName : r.enName}</span>
                    <span className="coverage-sample">{r.sample ? <TeX src={r.sample} /> : null}</span>
                  </div>
                ))}
              </div>
              <div className="coverage-col col-no">
                <div className="coverage-h">
                  <span><L zh="不支持" en="Not supported" /></span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-faint)' }}>{COVERAGE_NO.length}</span>
                </div>
                {COVERAGE_NO.map((r, i) => (
                  <div className="coverage-row" key={i}>
                    <span className="coverage-mark">{'✗'}</span>
                    <span className="coverage-name">{lang === 'zh' ? r.zhName : r.enName}</span>
                    <span className="coverage-sample">{lang === 'zh' ? r.zhNote : r.enNote}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 06 Perf benchmarks */}
          <section className="section section-ai" id="perf">
            <header className="sec-head">
              <span className="sec-num ai-num">06</span>
              <h2 className="sec-title"><L zh="性能对比" en="Performance vs MathJax" /> <code>: Numbers</code></h2>
              <p className="sec-desc"><L
                zh={<>两个维度: <strong>单条公式渲染时间</strong> 和 <strong>bundle 大小</strong>。数据综合 KaTeX 自带 benchmark / MathJax 官方 benchmark / 多家博客测试 (2024-2025); 设备 = 普通笔记本 Chrome 主线程。<em>测出来的差距是数量级</em>, 不是几倍。</>}
                en={<>Two axes: <strong>per-equation render time</strong> and <strong>bundle size</strong>. Numbers composite KaTeX's own benchmark, MathJax's official benchmark, and multiple 2024–25 blog measurements; device = mid-range laptop Chrome main thread. <em>The gap is orders of magnitude</em>, not factors.</>}
              /></p>
            </header>

            <div className="bwars">
              <h3 className="bwars-h"><L zh="单条公式渲染时间 (越短越好)" en="Per-equation render time (lower is better)" /></h3>
              <p className="bwars-sub"><L zh="横轴对齐到最大值 ~50ms · 数据综合公开 benchmark" en="x-axis normalised against ~50ms max · sourced from public benchmarks" /></p>
              {BENCH_TIME.map((row, i) => (
                <div className="bwars-row" key={i}>
                  <div className="bwars-yr">{(i18n.language.startsWith('zh') ? row.zh : row.en)}</div>
                  <div className="bwars-bar">
                    {row.segs.map((s, j) => (
                      <div
                        key={j}
                        className={`bwars-seg ${s.cls}`}
                        style={{ width: `${s.pct}%` }}
                        title={s.label}
                      >
                        {s.label}
                      </div>
                    ))}
                  </div>
                  <div className="bwars-tot">{row.segs[0].label}</div>
                </div>
              ))}
              <div className="bwars-legend">
                <span><i style={{ background: '#48E0C8' }}></i> KaTeX</span>
                <span><i style={{ background: '#E67550' }}></i> MathJax v3</span>
                <span><i style={{ background: '#C2452A' }}></i> MathJax v2 (legacy)</span>
                <span><i style={{ background: '#677B89' }}></i> jsMath (historical)</span>
              </div>
            </div>

            <div className="bwars">
              <h3 className="bwars-h"><L zh="Bundle 大小 (越小越好)" en="Bundle size (lower is better)" /></h3>
              <p className="bwars-sub"><L zh="gzip 后总大小 · 横轴 100% = ~1.6MB MathJax 默认包" en="gzipped total · x-axis 100% = ~1.6MB MathJax default bundle" /></p>
              {BENCH_BYTES.map((row, i) => (
                <div className="bwars-row" key={i}>
                  <div className="bwars-yr">{(i18n.language.startsWith('zh') ? row.zh : row.en)}</div>
                  <div className="bwars-bar">
                    {row.segs.map((s, j) => (
                      <div
                        key={j}
                        className={`bwars-seg ${s.cls}`}
                        style={{ width: `${Math.min(s.pct, 100)}%` }}
                        title={s.label}
                      >
                        {s.label}
                      </div>
                    ))}
                  </div>
                  <div className="bwars-tot">{row.segs[0].label}</div>
                </div>
              ))}
              <div className="bwars-legend">
                <span><i style={{ background: '#48E0C8' }}></i> KaTeX</span>
                <span><i style={{ background: '#E67550' }}></i> MathJax v3</span>
                <span><i style={{ background: '#C2452A' }}></i> MathJax v2</span>
              </div>
            </div>

            <blockquote className="quote-block">
              <div className="quote-mark">"</div>
              <p className="quote-text"><L
                zh={<>KaTeX 的目标是<strong>快</strong>。每个设计决策都向"<em>用户能在长页上一眼看到所有公式</em>"靠拢: 同步, 没字体加载, 没 reflow。<strong>fast math, not all math</strong>。</>}
                en={<>KaTeX's goal is <strong>fast</strong>. Every design decision is bent toward <em>"the user sees every equation on a long page instantly"</em>: synchronous, no font loading, no reflow. <strong>Fast math, not all math.</strong></>}
              /></p>
              <footer className="quote-footer">
                <span className="quote-author">— Emily Eisenberg <L zh="(KaTeX 联合作者, Khan Academy)" en="(KaTeX co-author, Khan Academy)" /></span>
                <span className="quote-context"><L zh="2014 KaTeX 发布博客综合 / GitHub README · 措辞精炼" en="composite from the 2014 launch blog + GitHub README · paraphrased" /></span>
              </footer>
            </blockquote>

            <div className="ai-takeaway">
              <p><strong><L zh="一句话总结: " en="In one line: " /></strong><L
                zh={<>KaTeX 不是"算法上比 MathJax 快"——而是<strong>选择了不做某些事</strong> (不测字体、不异步、不渲非数学)。这种<em>"少做"换来的速度</em>是真摩擦力, 不是技巧。10× 不是奇迹, 是<strong>scope 决定的</strong>。</>}
                en={<>KaTeX isn't algorithmically faster than MathJax — it <strong>chose not to do certain things</strong> (don't measure fonts, don't go async, don't render non-math). The speed comes from <em>doing less</em>, not from a trick. 10× isn't magic — it's <strong>determined by scope</strong>.</>}
              /></p>
            </div>
          </section>

          {/* 07 API surface */}
          <section className="section" id="api">
            <header className="sec-head">
              <span className="sec-num">07</span>
              <h2 className="sec-title"><L zh="API 表面积" en="API Surface" /> <code>: TheCallSites</code></h2>
              <p className="sec-desc"><L
                zh={<>KaTeX 的 API <strong>小到可以一眼看完</strong>: 主入口两个 (<code>renderToString</code> / <code>render</code>), 加 4 个 contrib 扩展 (auto-render / mhchem / copy-tex / etc.) + 一些 wrapper 库。下面 8 张卡覆盖 95% 的真实用法。</>}
                en={<>KaTeX's API is <strong>small enough to read in one glance</strong>: two main entries (<code>renderToString</code> / <code>render</code>), plus four contrib extensions (auto-render / mhchem / copy-tex / etc.) and a few wrapper libraries. The eight cards below cover 95% of real usage.</>}
              /></p>
            </header>

            <div className="ts-grid">
              {SURFACE_CARDS.map((c, i) => (
                <div className="ts-card" key={i}>
                  <div className="ts-tag">{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="ts-code">{c.code}</pre>
                </div>
              ))}
              <div className="ts-card ts-callout">
                <div className="ts-tag ts-tag-soft">∞</div>
                <h3><L zh={<>SSR 最佳实践</>} en={<>SSR best practice</>} /></h3>
                <p><L
                  zh={<>构建时<strong>渲完所有公式 → 烤进 HTML</strong>, 客户端只需 link <code>katex.min.css</code> (~23KB)。<em>KaTeX JS 完全不必上客户端</em>——本站 prediction 长文章页是这么做的, 首屏 LCP 直接好。</>}
                  en={<>At build time <strong>render all equations and bake them into the HTML</strong>; the client only needs to link <code>katex.min.css</code> (~23KB). <em>The KaTeX JS never has to ship to the client</em> — that's exactly how the prediction long-form pages on this site work, and LCP benefits directly.</>}
                /></p>
                <p className="ts-callout-quote">"<em><L
                  zh={<>客户端最好的 JS 是<em>不发的</em> JS。— Alex Russell (一句被反复引用)</>}
                  en={<>The best client-side JS is <em>JS you never ship</em>. — Alex Russell (frequently quoted)</>}
                /></em>"</p>
              </div>
            </div>
          </section>

          {/* 08 Options cookbook */}
          <section className="section" id="options">
            <header className="sec-head">
              <span className="sec-num">08</span>
              <h2 className="sec-title"><L zh="KatexOptions 食谱" en="KatexOptions Cookbook" /> <code>: Recipes</code></h2>
              <p className="sec-desc"><L
                zh={<>每次 <code>render</code> / <code>renderToString</code> 接 <code>KatexOptions</code> 对象。下面 12 个是<strong>真实项目里最常调</strong>的选项, 按用途分类。</>}
                en={<>Every <code>render</code> / <code>renderToString</code> call takes a <code>KatexOptions</code> object. The 12 below are <strong>the ones real projects actually tweak</strong>, grouped by purpose.</>}
              /></p>
            </header>

            <div className="tags-grid">
              {OPTIONS_CARDS.map((t, i) => (
                <div className="tag-card" key={i}>
                  <div className="tag-card-yr">{t.year}</div>
                  <div className="tag-card-tag">option</div>
                  <code>{t.tag}</code>
                  <p>{lang === 'zh' ? t.zhDesc : t.enDesc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 09 Ecosystem */}
          <section className="section" id="projects">
            <header className="sec-head">
              <span className="sec-num">09</span>
              <h2 className="sec-title"><L zh="生态 / 用户 / 工具" en="Ecosystem / Users / Tools" /> <code>: Ecosystem</code></h2>
              <p className="sec-desc"><L
                zh={<>2026 用 KaTeX 的产品名单: <strong>GitHub、Notion、Discourse、Stack Exchange、Obsidian、Substack、Khan Academy、Quora、Logseq、Hashnode、Roam Research、几乎所有静态站生成器</strong> (Hugo / Astro / Eleventy / Docusaurus / VitePress)。下面是工具 / wrapper / 上下游核心节点。上游 LaTeX 见 <a href="/code/language/latex">/code/language/latex</a>。</>}
                en={<>2026 KaTeX users in production: <strong>GitHub, Notion, Discourse, Stack Exchange, Obsidian, Substack, Khan Academy, Quora, Logseq, Hashnode, Roam Research, every modern static-site generator</strong> (Hugo / Astro / Eleventy / Docusaurus / VitePress). The 12 cards below cover tools, wrappers and upstream / downstream anchors. Upstream LaTeX at <a href="/code/language/latex">/code/language/latex</a>.</>}
              /></p>
            </header>

            <div className="logo-grid">
              {PROJECTS.map((p, i) => (
                <a key={i} className={`logo-card${p.highlight ? ' highlight' : ''}`} href={p.href} target="_blank" rel="noopener">
                  {p.svg}
                  <div className="logo-name">{lang === 'zh' ? p.zhName : p.enName}</div>
                  <div className="logo-note">{lang === 'zh' ? p.zhNote : p.enNote}</div>
                </a>
              ))}
            </div>
          </section>

          {/* 10 vs MathJax */}
          <section className="section" id="vs">
            <header className="sec-head">
              <span className="sec-num">10</span>
              <h2 className="sec-title"><L zh="对比 MathJax" en="vs MathJax" /> <code>: TheRivalry</code></h2>
              <p className="sec-desc"><L
                zh={<>KaTeX 和 MathJax <strong>不是同一个东西</strong>: 一个追速度, 一个追 LaTeX 完整度 + a11y。2020 后<em>两者各占一片</em>, 不再正面竞争。下面是诚实对比, 不是 KaTeX 的胜利演讲。</>}
                en={<>KaTeX and MathJax <strong>aren't the same product</strong>: one chases speed, the other chases full LaTeX + accessibility. Since 2020 <em>they each own a lane</em> and stopped competing head-on. The table below is honest, not a KaTeX victory lap.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-ts">KaTeX</th>
                  <th className="th-js">MathJax v3</th>
                  <th className="th-sw"><L zh="评注" en="Note" /></th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="速度 (单条)" en="Speed (per eq)" />,
                    ts: <L zh={<><strong>~1ms</strong> 同步</>} en={<><strong>~1ms</strong> sync</>} />,
                    js: <L zh="~7-15ms 异步可选同步" en="~7-15ms async, sync optional" />,
                    sw: <L zh="KaTeX 10×" en="KaTeX 10×" /> },
                  { k: <L zh="Bundle 大小" en="Bundle size" />,
                    ts: <L zh={<><strong>~250KB</strong> gzip</>} en={<><strong>~250KB</strong> gzipped</>} />,
                    js: <L zh="~1.6MB / ~560KB lazy" en="~1.6MB / ~560KB lazy" />,
                    sw: <L zh="KaTeX 6×" en="KaTeX 6×" /> },
                  { k: <L zh="LaTeX 覆盖度" en="LaTeX coverage" />,
                    ts: <L zh={<>~90% 数学子集</>} en={<>~90% of the math subset</>} />,
                    js: <L zh={<><strong>近乎完整 LaTeX 数学 + 包</strong></>} en={<><strong>Near-complete LaTeX math + packages</strong></>} />,
                    sw: <L zh="MathJax 胜" en="MathJax wins" /> },
                  { k: <L zh="可访问性 (a11y)" en="Accessibility" />,
                    ts: <L zh={<>HTML+CSS / MathML 可选</>} en={<>HTML+CSS / optional MathML</>} />,
                    js: <L zh={<><strong>原生 MathML, 屏读完美</strong></>} en={<><strong>Native MathML, perfect SR support</strong></>} />,
                    sw: <L zh="MathJax 胜" en="MathJax wins" /> },
                  { k: <L zh="渲染输出" en="Output format" />,
                    ts: <L zh="HTML+CSS (默认)" en="HTML+CSS (default)" />,
                    js: <L zh="SVG / MathML / HTML+CSS" en="SVG / MathML / HTML+CSS" />,
                    sw: <L zh="MathJax 选择多" en="MathJax: more outputs" /> },
                  { k: <L zh="SSR" en="SSR" />,
                    ts: <L zh={<><strong>第一天就 sync</strong></>} en={<><strong>Sync from day one</strong></>} />,
                    js: <L zh="v3 才补齐 sync API" en="Only v3 added sync API" />,
                    sw: <L zh="KaTeX 胜" en="KaTeX wins" /> },
                  { k: <L zh="字体" en="Fonts" />,
                    ts: <L zh={<>锁死 KaTeX_* (Pre-Stash)</>} en={<>Locked to KaTeX_* (Pre-Stash)</>} />,
                    js: <L zh={<><strong>任意字体可换</strong></>} en={<><strong>Any font, swappable</strong></>} />,
                    sw: <L zh="MathJax 灵活" en="MathJax: flexible" /> },
                  { k: <L zh="跨浏览器一致" en="Cross-browser identical" />,
                    ts: <L zh={<><strong>像素级一致</strong></>} en={<><strong>Pixel-identical</strong></>} />,
                    js: <L zh="原生 MathML 模式差异大" en="Differs in native MathML mode" />,
                    sw: <L zh="KaTeX 胜" en="KaTeX wins" /> },
                  { k: <L zh="许可证" en="License" />,
                    ts: <L zh="MIT" en="MIT" />,
                    js: <L zh="Apache 2.0" en="Apache 2.0" />,
                    sw: <L zh="两者都商用友好" en="Both commercial-friendly" /> },
                  { k: <L zh="维护节奏" en="Release cadence" />,
                    ts: <L zh="稳态 (年级别)" en="Maintenance (yearly)" />,
                    js: <L zh="积极开发 (季级别)" en="Active (quarterly)" />,
                    sw: <L zh="MathJax 团队更大" en="MathJax: bigger team" /> },
                  { k: <L zh="主要用户" en="Primary users" />,
                    ts: <L zh={<><strong>消费端</strong>: GitHub / Notion / Substack / 笔记 app / AI chat</>} en={<><strong>Consumer</strong>: GitHub / Notion / Substack / note apps / AI chat</>} />,
                    js: <L zh={<><strong>学术</strong>: arXiv / 出版社 / 期刊 / a11y-first</>} en={<><strong>Academic</strong>: arXiv / publishers / journals / a11y-first</>} />,
                    sw: <L zh="不同生态位" en="Different niches" /> },
                  { k: <L zh="2026 趋势" en="2026 direction" />,
                    ts: <L zh="AI chat UI 标配 · 稳态" en="AI chat UI default · steady" />,
                    js: <L zh="学术 / a11y 守土" en="Holding academia / a11y" />,
                    sw: <L zh="不再正面竞争" en="No longer competing" /> },
                ].map((row, i) => (
                  <tr key={i}>
                    <td>{row.k}</td>
                    <td>{row.ts}</td>
                    <td>{row.js}</td>
                    <td>{row.sw}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* 11 Why */}
          <section className="section" id="why">
            <header className="sec-head">
              <span className="sec-num">11</span>
              <h2 className="sec-title"><L zh="2026 为何选 KaTeX" en="Why KaTeX in 2026" /> <code>: PickKaTeX</code></h2>
              <p className="sec-desc"><L
                zh={<>"老技术"是 KaTeX 最大的误解——<strong>它在 2024-2026 因为 AI 聊天 UI 经历了用量爆炸</strong>。6 张卡讲清楚 2026 仍然该选它的理由。</>}
                en={<>"Legacy tech" is the standard KaTeX misconception — <strong>2024–2026 it had a usage explosion driven by AI chat UIs</strong>. Six cards on why it's still the right pick in 2026.</>}
              /></p>
            </header>

            <div className="why-grid">
              {WHY_CARDS.map((c, i) => (
                <div className="why-card" key={i}>
                  <div className="why-icon">{c.icon}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="why-code"><code>{c.code}</code></pre>
                </div>
              ))}
            </div>
          </section>

          {/* 12 Footguns */}
          <section className="section" id="footguns">
            <header className="sec-head">
              <span className="sec-num">12</span>
              <h2 className="sec-title"><L zh="陷阱" en="Footguns" /> <code>: Pitfalls</code></h2>
              <p className="sec-desc"><L
                zh={<>KaTeX 用起来比 MathJax 简单, 但<strong>4 个坑</strong>反复出现在 issue / Stack Overflow 上。提前知道, 少踩两次。</>}
                en={<>KaTeX is simpler than MathJax, but <strong>four pitfalls</strong> show up over and over in issues / Stack Overflow. Know them once, save yourself the repeat.</>}
              /></p>
            </header>

            <div className="future-grid">
              {FOOTGUNS.map((c, i) => (
                <div className={`future-card${i === 0 ? ' big' : ''}`} key={i}>
                  <div className="future-tag">PITFALL · {String(i + 1).padStart(2, '0')}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  {lang === 'zh' ? c.zh.body : c.en.body}
                </div>
              ))}
            </div>
          </section>

          {/* 13 Outlook */}
          <section className="section" id="future">
            <header className="sec-head">
              <span className="sec-num">13</span>
              <h2 className="sec-title"><L zh="前景" en="Outlook" /> <code>: TheNext5Years</code></h2>
              <p className="sec-desc"><L
                zh={<>2026 的 KaTeX 进入"<strong>稳态成功</strong>"——不再追新功能, 但用量随 AI / LLM 输出 LaTeX 的潮水<em>静悄悄上涨</em>。下面 4 张是接下来 3-5 年的判断。</>}
                en={<>KaTeX in 2026 has entered "<strong>stable success</strong>" — feature work has slowed, but usage <em>quietly climbs</em> on the wave of LLMs emitting LaTeX. Four cards on what to expect over the next 3–5 years.</>}
              /></p>
            </header>

            <div className="future-grid">
              {FUTURE_CARDS.map((c, i) => (
                <div className={`future-card${c.big ? ' big' : ''}`} key={i}>
                  <div className={`future-tag${c.hot ? ' tag-hot' : ''}`}>{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  {lang === 'zh' ? c.zh.body : c.en.body}
                </div>
              ))}
            </div>
          </section>
        </main>

        <footer className="footer">
          <div className="footer-grid">
            <div className="footer-col">
              <h4><L zh="官方资源" en="Official" /></h4>
              <ul>
                <li><a href="https://katex.org/" target="_blank" rel="noopener">katex.org</a></li>
                <li><a href="https://katex.org/docs/api.html" target="_blank" rel="noopener">katex.org/docs/api</a></li>
                <li><a href="https://katex.org/docs/supported.html" target="_blank" rel="noopener">supported functions</a></li>
                <li><a href="https://github.com/KaTeX/KaTeX" target="_blank" rel="noopener">github.com/KaTeX/KaTeX</a></li>
                <li><a href="https://github.com/KaTeX/KaTeX/releases" target="_blank" rel="noopener">releases / changelog</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="关键阅读" en="Key reading" /></h4>
              <ul>
                <li><a href="https://blog.khanacademy.org/" target="_blank" rel="noopener"><L zh="Khan Academy 工程博客" en="Khan Academy eng blog" /></a></li>
                <li><a href="https://www.mathjax.org/" target="_blank" rel="noopener">mathjax.org <L zh="(对手)" en="(rival)" /></a></li>
                <li><a href="https://docs.mathjax.org/" target="_blank" rel="noopener">MathJax v3 docs</a></li>
                <li><a href="https://www.w3.org/TR/mathml-core/" target="_blank" rel="noopener">MathML Core (W3C)</a></li>
                <li><a href="https://swiftlatex.github.io/" target="_blank" rel="noopener">SwiftLaTeX <L zh="(WASM TeX)" en="(WASM TeX)" /></a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="工具 / wrappers" en="Tools / wrappers" /></h4>
              <ul>
                <li><a href="https://github.com/talyssonoc/react-katex" target="_blank" rel="noopener">react-katex</a></li>
                <li><a href="https://github.com/remarkjs/remark-math" target="_blank" rel="noopener">remark-math</a></li>
                <li><a href="https://github.com/rehypejs/rehype-katex" target="_blank" rel="noopener">rehype-katex</a></li>
                <li><a href="https://github.com/jgm/pandoc" target="_blank" rel="noopener">pandoc --katex</a></li>
                <li><a href="https://github.com/KaTeX/KaTeX/tree/main/contrib" target="_blank" rel="noopener">contrib/ <L zh="扩展" en="extensions" /></a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="同站交叉" en="Cross-links" /></h4>
              <ul>
                <li><a href="/code/language/latex"><L zh="LaTeX — 上游语言" en="LaTeX — the upstream" /></a></li>
                <li><a href="/code/language/html"><L zh="HTML — 渲染目标" en="HTML — the render target" /></a></li>
                <li><a href="/code/language/css"><L zh="CSS — KaTeX 的姊妹层" en="CSS — KaTeX's sibling layer" /></a></li>
                <li><a href="/code/language/javascript"><L zh="JavaScript — KaTeX 的宿主" en="JavaScript — KaTeX's host" /></a></li>
                <li><a href="/code/language"><L zh="返回语言索引" en="Back to language index" /></a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo">{KATEX_LOGO_SVG}</div>
              <p className="footer-line"><L zh="单页中文 / English 双语 · 资料截至 2026-05" en="Single-page guide · zh / en · last updated 2026-05" /></p>
              <p className="footer-line dim"><code>{'katex.renderToString(src) // returns string, instantly'}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
