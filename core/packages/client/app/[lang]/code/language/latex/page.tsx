'use client';

import { useEffect, useRef, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { LangCtx, L, type Lang } from '../_intro/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './latex_intro.css';
import { tr } from '@/i18n/tr';

function TeX({ src }: { src: string }) {
  const html = useMemo(() => katex.renderToString(src, { throwOnError: false, output: 'html', strict: 'ignore' }), [src]);
  return <span className="lx-tex" dangerouslySetInnerHTML={{ __html: html }} />;
}
function TeXBlock({ src }: { src: string }) {
  const html = useMemo(() => katex.renderToString(src, { throwOnError: false, output: 'html', strict: 'ignore', displayMode: true }), [src]);
  return <div className="lx-tex-block" dangerouslySetInnerHTML={{ __html: html }} />;
}

const LATEX_LOGO_SVG = (
  <svg viewBox="0 0 256 256">
    <defs>
      <linearGradient id="lx-bg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#2AB5A8" />
        <stop offset="55%" stopColor="#008080" />
        <stop offset="100%" stopColor="#004D4D" />
      </linearGradient>
    </defs>
    <rect x="16" y="16" width="224" height="224" rx="20" fill="url(#lx-bg)" />
    <g fill="#F5EDD8" fontFamily="'Latin Modern Roman', Georgia, serif" fontWeight="700">
      <text x="36" y="156" fontSize="98" fontStyle="italic">L</text>
      <text x="84" y="118" fontSize="62" fontStyle="italic">A</text>
      <text x="128" y="156" fontSize="98" fontStyle="italic">T</text>
      <text x="170" y="186" fontSize="62" fontStyle="italic">E</text>
      <text x="200" y="156" fontSize="98" fontStyle="italic">X</text>
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
    year: '1968', highlight: true,
    zh: { title: <>Knuth 出版 TAOCP 第 1 卷 — 排版危机的起点</>, desc: <>Donald Knuth 出版 <strong>The Art of Computer Programming</strong> 第 1 卷。第 2 版印刷时<em>排版质量明显下降</em> (出版社换了照排系统), Knuth <strong>无法接受自己的书变丑</strong>——这件事直接触发他后来 10 年的"为程序员造一套真正的排版系统"的疯狂计划。</> },
    en: { title: <>Knuth publishes TAOCP vol 1 — the typography crisis begins</>, desc: <>Donald Knuth publishes <strong>The Art of Computer Programming</strong> vol 1. Its second printing has <em>visibly worse typography</em> (the publisher switched phototypesetting systems) and Knuth <strong>refuses to accept his book looking ugly</strong> — the moment that triggers a decade-long crusade to build "a proper typesetting system for programmers."</> },
  },
  {
    year: '1977', highlight: true,
    zh: { title: <>Knuth 开工 TeX — 估计"6 个月"</>, desc: <>Knuth 决定自己写一个排版系统, 取名 <strong>TeX</strong> (来自希腊词 τέχνη "技艺")。他对同事说<em>"大概 6 个月"</em>——实际是<strong>10 年</strong>; 顺便发明了 METAFONT 字体语言、WEB 文学编程系统、CMU 计算机现代字体家族。<em>典型的 Knuth 副产品比正产品还大</em>。</> },
    en: { title: <>Knuth starts TeX — estimated "6 months"</>, desc: <>Knuth sets out to build his own typesetting system, naming it <strong>TeX</strong> (from the Greek τέχνη, "art / craft"). He tells colleagues it'll take <em>about six months</em> — the real number turns out to be <strong>ten years</strong>; along the way he also invents METAFONT (a font-design language), the WEB literate-programming system, and the Computer Modern type family. <em>Classic Knuth: the by-products outweigh the headline</em>.</> },
  },
  {
    year: '1978',
    zh: { title: <>TeX78 首发</>, desc: <>第一版 TeX 在 Stanford 内部上线, 算法已经基本稳定: <strong>段落断行用动态规划 (Knuth-Plass), 数学公式排版规则 ~600 页</strong>。但用户写起来很底层——所有公式都是手工标记原始 TeX 命令。</> },
    en: { title: <>TeX78 — first release</>, desc: <>The first TeX ships inside Stanford. The algorithm core is already stable: <strong>paragraph line-breaking via dynamic programming (Knuth-Plass), math-typesetting rules covering ~600 pages</strong>. But the user-facing macros are bare-bones — every formula is hand-coded against raw TeX primitives.</> },
  },
  {
    year: '1982', highlight: true,
    zh: { title: <>TeX82 — 我们今天用的那一版的祖宗</>, desc: <>Knuth 重写 TeX, 这一版 <strong>奠定了之后 40 年的所有 TeX 引擎的根</strong>。同时催生了 <strong>WEB</strong> ——把代码 + 文档塞同一个文件、TANGLE 抽代码 / WEAVE 抽文档的 <em>literate programming</em> 范式; TeX 自己就是用 WEB 写的。</> },
    en: { title: <>TeX82 — the ancestor we still use</>, desc: <>Knuth rewrites TeX from scratch. This version <strong>becomes the root of every TeX engine for the next 40 years</strong>. The companion artifact is <strong>WEB</strong> — code and prose interleaved in one file, with TANGLE extracting source and WEAVE extracting docs — the <em>literate programming</em> paradigm. TeX itself is written in WEB.</> },
  },
  {
    year: '1984',
    zh: { title: <>METAFONT 84 + Computer Modern</>, desc: <>同步发布字体设计语言 <strong>METAFONT</strong> 和 <strong>Computer Modern</strong> 字体家族。一个数学系学生第一次能<em>用参数化方程定义自己的字体</em>; 之后 40 年, Computer Modern 仍是 TeX 默认字体, "<em>那种典型 LaTeX 论文的样子</em>"就来自这里。</> },
    en: { title: <>METAFONT 84 + Computer Modern</>, desc: <>Released alongside: the <strong>METAFONT</strong> font-design language and the <strong>Computer Modern</strong> type family. For the first time a maths student could <em>define a font with parametric equations</em>; for 40 years Computer Modern remains TeX's default, and the "<em>look of a typical LaTeX paper</em>" comes from these glyphs.</> },
  },
  {
    year: '1985', highlight: true,
    zh: { title: <>Lamport 发布 LaTeX — 给 TeX 套上人话宏</>, desc: <><strong>Leslie Lamport</strong> 在 SRI 工作期间写了一组宏放在 TeX 之上, 取名 <strong>LaTeX</strong> = <em>"Lamport's TeX"</em>。增加了 <code>\documentclass</code>, <code>\section</code>, <code>\cite</code>, <code>\ref</code>——把"手画一份论文" 变成"<em>声明一份论文的结构</em>"。这是 TeX 真正破圈的瞬间。</> },
    en: { title: <>Lamport releases LaTeX — human-friendly macros over TeX</>, desc: <><strong>Leslie Lamport</strong>, then at SRI, writes a macro layer on top of TeX and names it <strong>LaTeX</strong> = <em>"Lamport's TeX."</em> It introduces <code>\documentclass</code>, <code>\section</code>, <code>\cite</code>, <code>\ref</code> — turning "hand-typeset a paper" into "<em>declare the structure of a paper</em>." This is the moment TeX breaks out of pure CS into the rest of academia.</> },
  },
  {
    year: '1989',
    zh: { title: <>LaTeX 2.09 — 拿下学术界</>, desc: <>2.09 加入 <strong>article / report / book / letter</strong> 四个文档类, BibTeX 已经存在 (1985), 数学 / CS / 物理研究生院开始<em>默认要求 LaTeX 投稿</em>。同年 Knuth 写完 TAOCP 第 3 卷, 终于回去打磨他自己的 TeX。</> },
    en: { title: <>LaTeX 2.09 — academia adopts it</>, desc: <>2.09 ships the <strong>article / report / book / letter</strong> classes; BibTeX is already in place (1985) and maths / CS / physics graduate schools start <em>requiring LaTeX submissions by default</em>. The same year Knuth finishes TAOCP vol 3 and goes back to polishing TeX itself.</> },
  },
  {
    year: <>1990<small>~</small></>, highlight: true,
    zh: { title: <>TeX 被 Knuth 冻结 — 版本号收敛到 π</>, desc: <>Knuth 宣布 <strong>TeX 永远不再加功能, 只接 bug fix</strong>。版本号<em>渐近 π</em>: 3.0 → 3.1 → 3.14 → 3.141 → … → 3.141592653 (当前)。他自己 <em>"任何 TeX bug 我付 $2.56 = one hexadecimal dollar"</em>; METAFONT 类似, $327.68。<strong>支票从不被兑现, 收下当荣誉纪念</strong>。Knuth 还宣布: 他死后, TeX 版本号将一次性改为 π。</> },
    en: { title: <>Knuth freezes TeX — version number converges to π</>, desc: <>Knuth declares <strong>TeX will never gain features again, only accept bug fixes</strong>. The version number <em>asymptotes to π</em>: 3.0 → 3.1 → 3.14 → 3.141 → … → 3.141592653 today. He famously pays <em>"$2.56 = one hexadecimal dollar"</em> for any TeX bug found, $327.68 for METAFONT. <strong>The cheques are never cashed; recipients frame them</strong>. He has also announced that on his death TeX's version number will be set to π in one final release.</> },
  },
  {
    year: '1991',
    zh: { title: <>CTAN 成立 — TeX 包的中心仓</>, desc: <><strong>Comprehensive TeX Archive Network</strong> 上线, 把世界各地散落的 TeX / LaTeX / METAFONT 包统一镜像。<em>30 年后 CTAN 仍是 LaTeX 生态的中央仓</em>: 2026 年约 <strong>6000 个包, 总体积 4GB+</strong>。 <code>tlmgr</code> / MiKTeX 包管理底下都是它。</> },
    en: { title: <>CTAN founded — TeX's central package archive</>, desc: <>The <strong>Comprehensive TeX Archive Network</strong> goes live, mirroring scattered TeX / LaTeX / METAFONT packages worldwide. <em>Thirty years later CTAN is still the central archive</em>: 2026 numbers are around <strong>6000 packages, 4 GB+ total</strong>. Both <code>tlmgr</code> and MiKTeX's package manager are CTAN under the hood.</> },
  },
  {
    year: '1993',
    zh: { title: <>AMS-LaTeX 1.0 — 数学排版的官方扩展</>, desc: <>American Mathematical Society 释出 <strong>amsmath / amssymb / amsthm</strong>: 现代论文里几乎一切多行公式 (<code>align</code>, <code>aligned</code>, <code>gather</code>, <code>cases</code>) 都来自这里。"<em>不加 amsmath 的 LaTeX 数学是残的</em>"——这条今天仍然成立。</> },
    en: { title: <>AMS-LaTeX 1.0 — the official math extensions</>, desc: <>The American Mathematical Society releases <strong>amsmath / amssymb / amsthm</strong>. Virtually every multi-line environment in modern papers (<code>align</code>, <code>aligned</code>, <code>gather</code>, <code>cases</code>) comes from here. <em>"LaTeX math without amsmath is crippled"</em> — still true today.</> },
  },
  {
    year: <>1994<small>·06</small></>, highlight: true,
    zh: { title: <>LaTeX2e — 至今 (32 年) 仍是当前版本</>, desc: <>LaTeX3 项目从 1989 启动, 没法在合理时间内做完。LaTeX 团队决定先发一个<em>"过渡版"</em> <strong>LaTeX2e</strong>, 统一 LaTeX 2.09 和实验性 LaTeX3 的命名。<strong>32 年过去, LaTeX2e 仍是当前版本</strong>; <em>"LaTeX3 还有 10 年"</em>是 LaTeX 界的 in-joke。</> },
    en: { title: <>LaTeX2e — still the current version, 32 years on</>, desc: <>The LaTeX3 project began in 1989 but couldn't ship in a reasonable timeframe. The LaTeX team released a <em>"transitional"</em> <strong>LaTeX2e</strong> to unify LaTeX 2.09 and experimental LaTeX3 naming. <strong>Thirty-two years later it's still the current version</strong>. <em>"LaTeX3 in another ten years"</em> is the community in-joke.</> },
  },
  {
    year: '1994',
    zh: { title: <>TeX Live — 一站式发行版</>, desc: <>第一版 <strong>TeX Live</strong> CD-ROM 发布, 由 TUG (TeX Users Group) 维护。把引擎 + 宏包 + 字体 + 编辑器打包, <em>跨平台</em>装一次什么都有。<strong>2026 年 TeX Live 仍是 Linux/macOS 上的默认发行</strong> (~7GB)。</> },
    en: { title: <>TeX Live — the one-stop distribution</>, desc: <>The first <strong>TeX Live</strong> CD-ROM ships, maintained by TUG (TeX Users Group). It bundles engine + macro packages + fonts + editor in one <em>cross-platform</em> install. <strong>In 2026 TeX Live is still the default on Linux/macOS</strong> (~7 GB).</> },
  },
  {
    year: '1995',
    zh: { title: <>pdfTeX — 直接出 PDF</>, desc: <><strong>Hàn Thế Thành</strong> (越南留德博士生) 改造 TeX 引擎直出 <strong>PDF</strong> 而非 DVI——这条道在 2000 年代成为绝对主流。同时他的博士工作引出 2002 年的 <em>microtypography</em> (字符外推 + 字间微调), 让 LaTeX 排版的"看上去更扎实"那一档质量来源。</> },
    en: { title: <>pdfTeX — emits PDF directly</>, desc: <><strong>Hàn Thế Thành</strong>, a Vietnamese PhD student in Germany, modifies the TeX engine to emit <strong>PDF</strong> instead of DVI — by the 2000s the dominant path. His PhD work also leads to <em>microtypography</em> in 2002 (character protrusion + font expansion), the source of the "<em>just looks more solid</em>" quality you feel in well-typeset LaTeX.</> },
  },
  {
    year: '1996',
    zh: { title: <>LaTeX2HTML — 把 LaTeX 推到 web 的第一次努力</>, desc: <>Nikos Drakos 写出 <strong>LaTeX2HTML</strong>, Perl 脚本把 .tex 转 HTML + 公式图片。质量糟糕, 但<em>开了 30 年</em>"LaTeX 转网页"这一持久赛道; 后续 MathJax (2009), KaTeX (2013) 都是同一条线。</> },
    en: { title: <>LaTeX2HTML — first attempt to put LaTeX on the web</>, desc: <>Nikos Drakos writes <strong>LaTeX2HTML</strong>, a Perl script that converts .tex to HTML plus formula images. Quality is poor — but it opens the <em>30-year</em> "LaTeX-to-web" track that MathJax (2009) and KaTeX (2013) inherit.</> },
  },
  {
    year: '1998',
    zh: { title: <>TikZ / PGF — 论文里画矢量图</>, desc: <><strong>Till Tantau</strong> 写 <strong>PGF</strong> + 前端 <strong>TikZ</strong>: 用 LaTeX 语法画矢量图——节点 / 箭头 / 坐标系 / 树 / 神经网络 / 时序图全部本宽口径搞定。<em>"any diagram you can draw, you can typeset"</em>。今天大部分计算机 / 物理论文里的图都是它。</> },
    en: { title: <>TikZ / PGF — vector graphics inside papers</>, desc: <><strong>Till Tantau</strong> ships <strong>PGF</strong> with a friendlier front-end <strong>TikZ</strong>: vector graphics in LaTeX syntax — nodes, arrows, coordinate systems, trees, neural-net diagrams, sequence diagrams, all in one calculus. <em>"Any diagram you can draw, you can typeset."</em> Most figures in modern CS / physics papers come from here.</> },
  },
  {
    year: '2002',
    zh: { title: <>microtypography 学位 — pdfTeX 学会 kerning / protrusion</>, desc: <>Hàn Thế Thành 的博士论文标准化了 <em>character protrusion</em> (标点轻微伸出版心) + <em>font expansion</em> (字宽 ±2% 微调让段落更平) 写进 pdfTeX。<strong>从此 LaTeX 排版 "看起来" 比 Word/InDesign 更紧实</strong>——大部分人说不清为什么, 答案就在这两个细节。</> },
    en: { title: <>Microtypography PhD — pdfTeX learns kerning / protrusion</>, desc: <>Hàn Thế Thành's PhD standardises <em>character protrusion</em> (light punctuation hangs past the margin) + <em>font expansion</em> (glyph width nudged ±2% to level paragraphs) and lands them in pdfTeX. <strong>Why LaTeX output "looks tighter" than Word/InDesign</strong> — most readers can't put a finger on it; the answer lives in those two details.</> },
  },
  {
    year: <>2003<small></small></>, highlight: true,
    zh: { title: <>Beamer — LaTeX 杀了"难看的 PPT"</>, desc: <>Till Tantau (TikZ 作者) 再下一城: <strong>beamer</strong> 文档类, 让你<em>用 LaTeX 写演讲</em>, 输出 PDF 直接放映, 数学公式天生漂亮。<strong>从此学术界的"研究报告 ppt"几乎全部走 beamer</strong>, 不走 PowerPoint/Keynote。</> },
    en: { title: <>Beamer — LaTeX kills "ugly PowerPoint"</>, desc: <>Till Tantau (the TikZ author) strikes again with <strong>beamer</strong>, a document class for <em>writing slides in LaTeX</em>. Output is plain PDF, ready to project, with math typeset properly out of the box. <strong>From this point onward almost every academic seminar slide deck is beamer</strong>, not PowerPoint or Keynote.</> },
  },
  {
    year: '2004',
    zh: { title: <>XeTeX — Unicode + 系统字体</>, desc: <><strong>Jonathan Kew</strong> 写 <strong>XeTeX</strong>: 原生 Unicode, 通过 <code>fontspec</code> 直接用系统 OpenType 字体。<em>第一次 LaTeX 能像样地排中文 / 日文 / 阿拉伯文 / RTL</em>——之前 CJK 要靠 CJK.sty / pTeX 各种黑魔法。</> },
    en: { title: <>XeTeX — Unicode + system fonts</>, desc: <><strong>Jonathan Kew</strong> ships <strong>XeTeX</strong>: native Unicode, system OpenType fonts via <code>fontspec</code>. <em>For the first time LaTeX can typeset Chinese, Japanese, Arabic, RTL scripts properly</em> — before this, CJK relied on CJK.sty / pTeX hacks.</> },
  },
  {
    year: '2007',
    zh: { title: <>LuaTeX 0.10 — TeX 引擎里嵌 Lua</>, desc: <><strong>LuaTeX</strong> 把 Lua 解释器直接缝进 TeX, 让宏作者可以用<em>真编程语言</em> hook 引擎内部 (断行 / 行距 / 字距)。pdfTeX 的现代继承者; 也支持 OpenType + Unicode 原生。2021 起<strong>成为 <code>lualatex</code> 的默认引擎</strong>。</> },
    en: { title: <>LuaTeX 0.10 — Lua embedded in the TeX engine</>, desc: <><strong>LuaTeX</strong> embeds the Lua interpreter directly inside TeX, letting macro authors hook engine internals (line breaking, leading, kerning) in a <em>real programming language</em>. The modern successor to pdfTeX, with native OpenType + Unicode. From 2021 it is <strong>the default engine for <code>lualatex</code></strong>.</> },
  },
  {
    year: '2012',
    zh: { title: <>WriteLaTeX (后 Overleaf) — 浏览器里写 LaTeX</>, desc: <>剑桥两个研究生 (John Hammersley + John Lees-Miller) 做 <strong>WriteLaTeX</strong>, 让 LaTeX 在<em>浏览器里</em>实时编辑 + 协作。2013 改名 <strong>Overleaf</strong>。2017 跟竞争对手 ShareLaTeX 合并; 同年被 Digital Science 收购。<strong>2026 用户数 ~12M</strong>。<em>第一次有人能不装 TeX Live 就写出像样论文</em>。</> },
    en: { title: <>WriteLaTeX (later Overleaf) — LaTeX in the browser</>, desc: <>Two Cambridge grad students (John Hammersley + John Lees-Miller) build <strong>WriteLaTeX</strong>: edit and collaborate on LaTeX <em>in the browser</em> in real time. Renamed <strong>Overleaf</strong> in 2013, merged with rival ShareLaTeX in 2017, acquired by Digital Science the same year. <strong>~12 M users in 2026</strong>. <em>The first time anyone could write a real paper without installing TeX Live</em>.</> },
  },
  {
    year: '2013', highlight: true,
    zh: { title: <>KaTeX 发布 — 浏览器里 100× 快于 MathJax</>, desc: <>Khan Academy (Emily Eisenberg + Sophie Alpert) 发布 <strong>KaTeX</strong>: 只渲染 LaTeX <em>数学子集</em>, 但比 MathJax <strong>快 100 倍</strong>、同步渲染、不闪烁。今天 GitHub README、StackExchange、Notion、本页面都用它。延伸阅读: <a href="/code/language/katex">/code/language/katex</a>。</> },
    en: { title: <>KaTeX released — 100× faster than MathJax in the browser</>, desc: <>Khan Academy (Emily Eisenberg + Sophie Alpert) release <strong>KaTeX</strong>: it only renders the LaTeX <em>math subset</em>, but is <strong>100× faster than MathJax</strong>, renders synchronously, never flashes. Today it powers GitHub READMEs, StackExchange, Notion, and this very page. Deep dive: <a href="/code/language/katex">/code/language/katex</a>.</> },
  },
  {
    year: '2015',
    zh: { title: <>Tectonic — Rust 写的现代 TeX 引擎</>, desc: <><strong>Peter Williams</strong> 启动 <strong>Tectonic</strong>: Rust 语言, 单二进制 ~20MB, <em>遇到缺包自动下载</em>, 一次编译跑完所有 pass (内部维护 cache)。<em>"Cargo for LaTeX"</em>。2026 是 CI 流水线里跑 LaTeX 的首选——比安装完整 TeX Live 省一个 7GB。</> },
    en: { title: <>Tectonic — a modern TeX engine in Rust</>, desc: <><strong>Peter Williams</strong> starts <strong>Tectonic</strong>: Rust, single ~20 MB binary, <em>auto-downloads missing packages</em>, runs all the passes from a single invocation (caches them internally). <em>"Cargo for LaTeX."</em> In 2026 it's the go-to engine for LaTeX in CI pipelines — saves a 7 GB TeX Live install.</> },
  },
  {
    year: '2017',
    zh: { title: <>LaTeX 内核默认 UTF-8</>, desc: <>之前 30 年默认是 ASCII + <code>inputenc</code> 包指定; 2017 LaTeX 内核版本起 <strong><code>pdflatex</code> 默认接受 UTF-8</strong>——一行 <code>{`\\usepackage[utf8]{inputenc}`}</code> 终于不再是必备样板。<em>30 年的小烦恼终结</em>。</> },
    en: { title: <>LaTeX kernel switches to UTF-8 by default</>, desc: <>For 30 years the default was ASCII + <code>inputenc</code> to opt into others; from the 2017 kernel release <strong><code>pdflatex</code> accepts UTF-8 by default</strong> — the boilerplate <code>{`\\usepackage[utf8]{inputenc}`}</code> finally stops being required. <em>A 30-year papercut closed</em>.</> },
  },
  {
    year: '2019',
    zh: { title: <>expl3 — LaTeX3 编程层进入标准发行</>, desc: <>20 年的 LaTeX3 项目终于以另一种方式落地: <strong>expl3</strong> 编程层 (一种 <em>"功能完备的宏元语言"</em>) 从 2019 起<strong>跟着每个 LaTeX 内核分发</strong>。现代包 (siunitx 3, biblatex 3.x, l3kernel) 内部全用 expl3 写——<em>LaTeX3 没失败, 它换了一种形式胜利</em>。</> },
    en: { title: <>expl3 — the LaTeX3 programming layer ships with every install</>, desc: <>After 20 years, LaTeX3 lands in a different form: the <strong>expl3</strong> programming layer (a <em>full-featured macro metalanguage</em>) <strong>ships with every LaTeX kernel</strong> from 2019 on. Modern packages (siunitx 3, biblatex 3.x, l3kernel) are written entirely in expl3 — <em>LaTeX3 didn't fail; it won in disguise</em>.</> },
  },
  {
    year: '2021',
    zh: { title: <>TeX Live 2021 — LuaTeX 成 lualatex 默认</>, desc: <>TeX Live 2021 把 <strong>LuaTeX 设为 <code>lualatex</code> 的默认引擎</strong>, 取代过去的 LuaJITTeX。新论文模板逐步从 <code>pdflatex</code> 推 <code>lualatex</code>——OpenType 字体 + Unicode 一次到位。<em>下一代 TeX 引擎之争基本由 LuaTeX 胜出</em>。</> },
    en: { title: <>TeX Live 2021 — LuaTeX becomes the default for lualatex</>, desc: <>TeX Live 2021 makes <strong>LuaTeX the default engine for <code>lualatex</code></strong>, retiring LuaJITTeX. New paper templates gradually push from <code>pdflatex</code> toward <code>lualatex</code> — OpenType + Unicode in one shot. <em>The "next-gen TeX engine" race is largely settled in LuaTeX's favour</em>.</> },
  },
  {
    year: '2022',
    zh: { title: <>TUG 庆 40 年 — TeX 仍在运行</>, desc: <>TeX 1982 → 2022 满 40 岁。TeX Users Group 在线庆祝: <em>"a system designed in the 1970s still powering 90% of arXiv submissions in 2022"</em>。Knuth 本人录视频出席, 报告 TeX 当年 bug 收支: <strong>过去 5 年 0 个新 bug</strong>。</> },
    en: { title: <>TUG marks 40 years — TeX is still running</>, desc: <>TeX is 40 years old (1982 → 2022). The TeX Users Group celebrates online: <em>"a system designed in the 1970s still powers 90 % of arXiv submissions in 2022."</em> Knuth himself records a video, reporting that <strong>zero new bugs have been filed in the past five years</strong>.</> },
  },
  {
    year: '2023', highlight: true,
    zh: { title: <>Typst 1.0 — 第一个可信的 LaTeX 挑战者</>, desc: <>瑞士 ETH 两个学生 (Laurenz Mädje + Martin Haug) 发布 <strong>Typst</strong> 1.0: Rust 写的全新排版系统, <em>语法更接近 Markdown</em>, 编译瞬时 (~100ms 整篇), 浏览器版本同时上线。<strong>不是替代品, 但是 30 年来第一个"<em>新一代 LaTeX</em>"的可信尝试</strong>。2026 在课堂使用率快速增长, 期刊还都没接受。</> },
    en: { title: <>Typst 1.0 — the first credible LaTeX challenger</>, desc: <>Two ETH Zürich students (Laurenz Mädje + Martin Haug) release <strong>Typst 1.0</strong>: a new typesetting system in Rust, with <em>syntax closer to Markdown</em>, instant compilation (~100 ms per paper), and a browser edition. <strong>Not a replacement — but the first credible "<em>next-generation LaTeX</em>" attempt in 30 years</strong>. By 2026 classroom adoption is rising fast; journals haven't accepted it yet.</> },
  },
  {
    year: '2024',
    zh: { title: <>AI 写 LaTeX — GPT/Claude 比大多数人熟练</>, desc: <>大模型对 LaTeX 语法<em>训练充分</em> (训练语料里 arXiv 几乎全文)。<strong>2024 起新一代研究生写论文的 LaTeX 80% 是 AI 出手, 人改细节</strong>; "TikZ 帮我画图"成主流入口。AI 让 LaTeX 的<em>陡峭学习曲线</em>第一次被显著拉平。</> },
    en: { title: <>AI writes LaTeX — GPT/Claude fluent beyond most humans</>, desc: <>Large models are <em>very well-trained</em> on LaTeX (arXiv is nearly entirely in their corpus). <strong>From 2024 a new generation of grad students writes 80 % of their LaTeX via AI, hand-tuning the rest</strong>; "TikZ, draw me…" becomes the dominant graphics entry-point. AI is the first thing to meaningfully flatten LaTeX's notoriously steep learning curve.</> },
  },
  {
    year: '2026',
    zh: { title: <>现状: 仍是数学排版的事实标准</>, desc: <>2026 LaTeX 圈层稳定: <strong>arXiv 90%+, NeurIPS / ICML / CVPR / 大部分 Springer / Elsevier / IEEE / ACM 期刊 LaTeX 模板首选</strong>。Overleaf ~12M 用户, GitHub READMEs 全用 KaTeX。Typst 在课堂里抬头但<em>期刊还没动</em>。<strong>LaTeX 不会被替代, 但下一个 20 年它将是<em>"老派 vs 新派"并存</em>的状态</strong>。</> },
    en: { title: <>State of play: still the de-facto standard for math typesetting</>, desc: <>By 2026 the LaTeX ecosystem is steady: <strong>arXiv 90 %+, NeurIPS / ICML / CVPR / most Springer / Elsevier / IEEE / ACM journals still ship LaTeX-first templates</strong>. Overleaf ~12 M users, GitHub READMEs all use KaTeX. Typst is rising in classrooms but <em>journals haven't moved</em>. <strong>LaTeX isn't being replaced — but for the next 20 years it will live in a "<em>old-guard vs new-school</em>" coexistence</strong>.</> },
  },
];

interface TagThruHistory {
  year: ReactNode;
  tag: string;
  zhDesc: ReactNode;
  enDesc: ReactNode;
}
const PACKAGES: TagThruHistory[] = [
  { year: '1985', tag: 'amsmath',  zhDesc: <>AMS 出品。<code>align</code> / <code>aligned</code> / <code>cases</code> / <code>gather</code>——<strong>不加它就是残的</strong>。</>, enDesc: <>From the AMS. <code>align</code> / <code>aligned</code> / <code>cases</code> / <code>gather</code> — <strong>without it your math is crippled</strong>.</> },
  { year: '1995', tag: 'graphicx', zhDesc: <>插图标准。<code>\includegraphics</code> 配 <code>\scalebox</code> / <code>\rotatebox</code>。每篇论文都用。</>, enDesc: <>Standard figure inclusion. <code>\includegraphics</code> with <code>\scalebox</code> / <code>\rotatebox</code>. Every paper uses it.</> },
  { year: '1998', tag: 'hyperref', zhDesc: <>PDF 超链接 + 元数据 + 书签。<em>加载顺序<strong>必须放最后</strong></em>——它要 hook 几乎所有其他包。</>, enDesc: <>PDF hyperlinks, metadata, bookmarks. <em>Loading order: must be <strong>last</strong></em> — it hooks nearly everything else.</> },
  { year: '1998', tag: 'TikZ/PGF', zhDesc: <>Till Tantau 矢量图王。从 commutative diagrams 到神经网络示意图——<strong>论文里所有像样的图都来自这里</strong>。</>, enDesc: <>Till Tantau's vector-graphics monarch. From commutative diagrams to neural-net schematics — <strong>every decent figure in a paper comes from here</strong>.</> },
  { year: '2003', tag: 'beamer',   zhDesc: <>幻灯片文档类。<em>"PowerPoint with bad fonts"</em> 在学术界的官方杀手。</>, enDesc: <>The slide document class. The official killer of <em>"PowerPoint with bad fonts"</em> in academia.</> },
  { year: '2004', tag: 'fontspec', zhDesc: <>XeTeX / LuaTeX 下用系统 OpenType 字体——<strong>中文 / 日文 / 自定义字体的入口</strong>。</>, enDesc: <>The entry-point for OpenType system fonts under XeTeX / LuaTeX — <strong>where Chinese, Japanese, custom fonts come in</strong>.</> },
  { year: '2004', tag: 'microtype',zhDesc: <>Hàn Thế Thành 博士论文的产物。一行 <code>{`\\usepackage{microtype}`}</code>, <em>段落瞬间紧实漂亮</em>——你说不清为什么。</>, enDesc: <>Born from Hàn Thế Thành's PhD. One <code>{`\\usepackage{microtype}`}</code> and <em>paragraphs instantly look tighter</em> — you can't say why.</> },
  { year: '2005', tag: 'listings', zhDesc: <>代码块, <code>language=Python</code> 一行高亮。<em>10 年的老牌</em>; 新写法选 minted。</>, enDesc: <>Code blocks; <code>language=Python</code> gets syntax highlighting in one line. <em>Old-guard</em>; new work often prefers minted.</> },
  { year: '2008', tag: 'minted',   zhDesc: <>调 Pygments 做语法高亮——<em>颜色更现代</em>, 但要 <code>--shell-escape</code>。</>, enDesc: <>Pipes to Pygments for syntax highlighting — <em>modern colour</em>, but needs <code>--shell-escape</code>.</> },
  { year: '2008', tag: 'siunitx',  zhDesc: <><strong>物理 / 化学的单位排版</strong>: <code>{`\\SI{9.8}{m/s^2}`}</code> 自动正立 + 中划线 + 区间格式化。</>, enDesc: <><strong>Units for physics / chemistry</strong>: <code>{`\\SI{9.8}{m/s^2}`}</code> handles upright shape, en-dash, range formatting.</> },
  { year: '2008', tag: 'tikz-cd',  zhDesc: <>TikZ 之上的<strong>交换图</strong>子语言。范畴论 / 代数拓扑 / 同调代数论文必备。</>, enDesc: <>A TikZ DSL for <strong>commutative diagrams</strong>. Standard in category theory, algebraic topology, homological algebra.</> },
  { year: '2010', tag: 'biblatex', zhDesc: <>新一代参考文献处理 (后端 <strong>biber</strong>)。比 BibTeX 灵活 10 倍; <em>2010 后新模板首选</em>。</>, enDesc: <>The next-gen bibliography stack (backend <strong>biber</strong>). Ten times more flexible than BibTeX; <em>the default for new templates since ~2010</em>.</> },
  { year: '2011', tag: 'tcolorbox',zhDesc: <>各种<strong>方框 / 提示框 / 定理框</strong>。可以做 minted + 颜色 + 标题 + 阴影 — beamer 之外 LaTeX 视觉系最强工具。</>, enDesc: <>All kinds of <strong>boxes / callouts / theorem environments</strong>. minted + colour + title + shadow — the strongest visual tool in LaTeX outside beamer.</> },
  { year: '2012', tag: 'pgfplots', zhDesc: <>TikZ 之上的<strong>科学绘图</strong>子语言。无 matplotlib, 只用 .tex 也能画 axis / 散点 / heatmap。</>, enDesc: <>A TikZ DSL for <strong>scientific plotting</strong>. No matplotlib needed — axes, scatter plots, heatmaps from pure .tex.</> },
  { year: '2014', tag: 'chemfig',  zhDesc: <><strong>化学结构式</strong>: 苯环、酰胺键、反应箭头一行命令。化学论文标配。</>, enDesc: <><strong>Chemistry structural formulas</strong>: benzene rings, amide bonds, reaction arrows — one command. Standard in chemistry papers.</> },
  { year: '2015', tag: 'mhchem',   zhDesc: <>化学方程: <code>{'\\ce{H2SO4 -> 2 H+ + SO4^{2-}}'}</code>, 自动对齐 + 立式数字。siunitx 同作者。</>, enDesc: <>Chemical equations: <code>{'\\ce{H2SO4 -> 2 H+ + SO4^{2-}}'}</code>, auto-aligned with upright numbers. Same author as siunitx.</> },
  { year: '2016', tag: 'forest',   zhDesc: <><strong>语法树 / 句法树</strong>专用; 比 TikZ 手画快十倍。语言学 / NLP 论文常客。</>, enDesc: <>Built for <strong>syntax / parse trees</strong>; ten times faster than hand-drawing in TikZ. Common in linguistics / NLP papers.</> },
  { year: '2018', tag: 'glossaries',zhDesc: <>术语表 + 缩写表 + 符号表三位一体, 自动排序 / 链接。<em>论文 &gt; 50 页基本必备</em>。</>, enDesc: <>Glossary + acronyms + symbol list, all auto-sorted and linked. <em>Mandatory once a thesis exceeds 50 pages</em>.</> },
  { year: '2019', tag: 'algorithm2e',zhDesc: <>伪代码环境。<em>定理 / 引理 / 算法</em>那一档排版的事实标准。</>, enDesc: <>Pseudocode environment. The de-facto standard for typesetting <em>theorems / lemmas / algorithms</em>.</> },
  { year: '2020', tag: 'csquotes', zhDesc: <>"<em>会动的引号</em>"——根据语言自动切换 "" / «» / „" / 「」; biblatex 必带。</>, enDesc: <>"<em>Language-aware quotation marks</em>" — auto-switches "" / «» / „" / 「」; required by biblatex.</> },
];

interface MathDemo {
  zhLabel: ReactNode;
  enLabel: ReactNode;
  src: string;
  block?: boolean;
}

const MATH_DEMOS: MathDemo[] = [
  {
    zhLabel: <>二次公式</>,
    enLabel: <>Quadratic formula</>,
    src: 'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}',
    block: true,
  },
  {
    zhLabel: <>Basel 问题</>,
    enLabel: <>Basel problem</>,
    src: '\\sum_{n=1}^{\\infty}\\frac{1}{n^2} = \\frac{\\pi^2}{6}',
    block: true,
  },
  {
    zhLabel: <>高斯积分</>,
    enLabel: <>Gaussian integral</>,
    src: '\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}',
    block: true,
  },
  {
    zhLabel: <>多行对齐</>,
    enLabel: <>Aligned multi-line</>,
    src: '\\begin{aligned} (a+b)^2 &= a^2 + 2ab + b^2 \\\\ &= (a-b)^2 + 4ab \\end{aligned}',
    block: true,
  },
  {
    zhLabel: <>矩阵</>,
    enLabel: <>Matrix</>,
    src: 'A = \\begin{pmatrix} 1 & 2 & 3 \\\\ 4 & 5 & 6 \\\\ 7 & 8 & 9 \\end{pmatrix}',
    block: true,
  },
  {
    zhLabel: <>分段函数</>,
    enLabel: <>Cases</>,
    src: 'f(x) = \\begin{cases} x^2 & x \\geq 0 \\\\ -x & x < 0 \\end{cases}',
    block: true,
  },
  {
    zhLabel: <>谓词 + 数集</>,
    enLabel: <>Quantifiers + number sets</>,
    src: '\\forall \\epsilon > 0,\\ \\exists \\delta > 0 : |x-a|<\\delta \\Rightarrow |f(x)-f(a)|<\\epsilon \\quad (x \\in \\mathbb{R})',
    block: true,
  },
  {
    zhLabel: <>Euler 恒等式</>,
    enLabel: <>Euler's identity</>,
    src: '\\boxed{\\,e^{i\\pi}+1=0\\,}',
    block: true,
  },
  {
    zhLabel: <>Maxwell 方程组</>,
    enLabel: <>Maxwell's equations</>,
    src: '\\begin{aligned} \\nabla \\cdot \\mathbf{E} &= \\tfrac{\\rho}{\\varepsilon_0} & \\nabla \\cdot \\mathbf{B} &= 0 \\\\ \\nabla \\times \\mathbf{E} &= -\\tfrac{\\partial \\mathbf{B}}{\\partial t} & \\nabla \\times \\mathbf{B} &= \\mu_0 \\mathbf{J} + \\mu_0 \\varepsilon_0 \\tfrac{\\partial \\mathbf{E}}{\\partial t} \\end{aligned}',
    block: true,
  },
  {
    zhLabel: <>Schrödinger 方程</>,
    enLabel: <>Schrödinger equation</>,
    src: 'i\\hbar\\,\\frac{\\partial}{\\partial t}\\Psi(\\mathbf{r},t) = \\hat{H}\\,\\Psi(\\mathbf{r},t)',
    block: true,
  },
  {
    zhLabel: <>交换图箭头</>,
    enLabel: <>Commutative-style arrow</>,
    src: 'A \\xrightarrow{\\,f\\,} B \\xrightarrow{\\,g\\,} C \\quad\\Longrightarrow\\quad A \\xrightarrow{\\,g\\circ f\\,} C',
    block: true,
  },
  {
    zhLabel: <>组合数 + 求和</>,
    enLabel: <>Binomial + sum</>,
    src: '(1+x)^n = \\sum_{k=0}^{n} \\binom{n}{k} x^k',
    block: true,
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
    zh: { title: <>数学排版无人能及</>, desc: <>40 年没有第二个系统在<strong>多行公式 / 矩阵 / 积分号 / 上下标定位</strong>这件事上接近 TeX。每一份数学论文最终都被它收编, 不是因为它"好用", 是因为<em>没有替代</em>。</> },
    en: { title: <>Math typesetting that nothing else touches</>, desc: <>For 40 years no other system has come close to TeX on <strong>multi-line formulas, matrices, integral signs, super/subscript placement</strong>. Every math paper eventually surrenders to it — not because it's "easy", because <em>there's no replacement</em>.</> },
    code: <>{'$\\int_0^\\infty \\frac{x^{s-1}}{e^x-1}\\,dx = \\Gamma(s)\\,\\zeta(s)$'}</>,
  },
  {
    icon: '⌘',
    zh: { title: <>结构 / 内容 / 样式分离</>, desc: <>跟 HTML 同源的思想: <code>\section</code> 声明 "<strong>这是节标题</strong>", 字体大小由文档类决定。换 <code>\documentclass</code> 整篇换风格——<em>不动一个字</em>。</> },
    en: { title: <>Structure / content / style — separated</>, desc: <>Same philosophy as HTML: <code>\section</code> declares "<strong>this is a section heading</strong>", and the document class decides font and size. Swap the <code>\documentclass</code> and the whole paper reflows in a new style — <em>without touching a word</em>.</> },
    code: <>{'\\documentclass{article}     % vs {book}'}{'\n'}{'\\section{Introduction}      % stays the same'}</>,
  },
  {
    icon: '◇',
    zh: { title: <>纯文本源 — git 友好</>, desc: <>.tex 是<strong>纯文本</strong>: <em>git diff</em> 直接看改了哪行, code review 跟代码一样, CI 出 PDF 验证渲染。<em>跟 Word .docx 二进制对比, 一个时代的差距</em>。</> },
    en: { title: <>Plain-text source — git-friendly</>, desc: <>.tex is <strong>plain text</strong>: <em>git diff</em> shows exactly what changed, code review runs the same as for code, CI produces the PDF to verify rendering. <em>An entire era ahead of binary .docx</em>.</> },
    code: <>{'$ git diff paper.tex'}{'\n'}{'- proof omitted.'}{'\n'}{'+ See Appendix A for proof.'}</>,
  },
  {
    icon: '⧖',
    zh: { title: <>40 年向后兼容</>, desc: <><strong>1985 年的 LaTeX 文档在 2026 年仍能编译</strong>。Knuth 把 TeX 冻死, LaTeX 团队把内核当作不可破坏的契约——<em>跟 web 同一种"永远渲染"承诺</em>。</> },
    en: { title: <>40 years of backward compatibility</>, desc: <><strong>A LaTeX document from 1985 still compiles in 2026</strong>. Knuth froze TeX; the LaTeX team treats the kernel as an unbreakable contract — <em>the same "renders forever" promise the web makes</em>.</> },
    code: <>{'% lamport-1985.tex'}{'\n'}{'\\documentclass{article}'}{'\n'}{'% still compiles, byte-stable.'}</>,
  },
  {
    icon: '⊕',
    zh: { title: <>arXiv / 期刊管道的硬通货</>, desc: <>arXiv <strong>90%+ 投稿是 LaTeX</strong>; Springer / Elsevier / IEEE / ACM 都发官方 .cls 模板。<em>你想投稿, 就得用</em>——这不是建议是约定俗成。</> },
    en: { title: <>The hard currency of arXiv / journal pipelines</>, desc: <>Over <strong>90 % of arXiv submissions are LaTeX</strong>; Springer / Elsevier / IEEE / ACM all ship official .cls templates. <em>To submit, you must use it</em> — not a recommendation, a convention.</> },
    code: <>{'% IEEEtran.cls — required for IEEE submissions'}{'\n'}{'\\documentclass[conference]{IEEEtran}'}</>,
  },
  {
    icon: '∎',
    zh: { title: <>PDF 字节稳定</>, desc: <>同一份 .tex + 同一个引擎 → <strong>同一份 PDF, 跨机器 byte-stable</strong>。<em>没有"在我电脑上能跑"问题</em>; CI 缓存 / 教学评分 / 法律文档全靠这条。</> },
    en: { title: <>PDF output is byte-stable</>, desc: <>Same .tex + same engine → <strong>the same PDF, byte-for-byte across machines</strong>. <em>No "works on my laptop" problem</em>; this property anchors CI caches, automated grading, legally archived documents.</> },
    code: <>{'$ sha256sum paper.pdf'}{'\n'}{'b8e3...  paper.pdf   # identical worldwide'}</>,
  },
];

interface EngineCard {
  name: string;
  sub: ReactNode;
  rows: { k: string; zh: ReactNode; en: ReactNode; }[];
  zhPick: ReactNode;
  enPick: ReactNode;
}

const ENGINES: EngineCard[] = [
  {
    name: 'pdflatex',
    sub: <>since 1995 · 8-bit · default</>,
    rows: [
      { k: 'Speed',   zh: <>最快 (~2-5s/论文)</>, en: <>Fastest (~2-5 s per paper)</> },
      { k: 'Fonts',   zh: <>仅 8-bit Type 1 字体</>, en: <>8-bit Type 1 fonts only</> },
      { k: 'Unicode', zh: <>需 <code>inputenc</code>; CJK 难</>, en: <>Needs <code>inputenc</code>; CJK painful</> },
      { k: 'Output',  zh: <>直接 PDF</>, en: <>Direct to PDF</> },
    ],
    zhPick: <>选用: <strong>纯英文 / 数学论文</strong>; arXiv 大部分模板默认它。</>,
    enPick: <>Pick when: <strong>English / math papers</strong>; most arXiv templates default to it.</>,
  },
  {
    name: 'xelatex',
    sub: <>since 2004 · Unicode · system fonts</>,
    rows: [
      { k: 'Speed',   zh: <>中 (~5-15s/论文)</>, en: <>Mid (~5-15 s per paper)</> },
      { k: 'Fonts',   zh: <>fontspec + OpenType 系统字体</>, en: <>fontspec + OpenType system fonts</> },
      { k: 'Unicode', zh: <>原生</>, en: <>Native</> },
      { k: 'Output',  zh: <>PDF (走 xdv 中间格式)</>, en: <>PDF (via xdv intermediate)</> },
    ],
    zhPick: <>选用: <strong>中 / 日 / 韩 / 阿拉伯文</strong>, 任何要自定义字体的 design 文档。</>,
    enPick: <>Pick when: <strong>Chinese / Japanese / Korean / Arabic</strong>, or any design doc with custom fonts.</>,
  },
  {
    name: 'lualatex',
    sub: <>since 2007 · Lua scripting · default</>,
    rows: [
      { k: 'Speed',   zh: <>慢 (~10-30s/论文)</>, en: <>Slowest (~10-30 s per paper)</> },
      { k: 'Fonts',   zh: <>fontspec + OpenType</>, en: <>fontspec + OpenType</> },
      { k: 'Unicode', zh: <>原生</>, en: <>Native</> },
      { k: 'Output',  zh: <>直接 PDF + 嵌入 Lua 钩子</>, en: <>Direct PDF + embedded Lua hooks</> },
    ],
    zhPick: <>选用: <strong>2026 推荐的"未来引擎"</strong>; 复杂宏 / 包作者 / 需要程序化算字的工作。</>,
    enPick: <>Pick when: the <strong>"future engine" of 2026</strong>; complex macros / package authoring / programmatic glyph work.</>,
  },
  {
    name: 'tectonic',
    sub: <>since 2015 · Rust · auto-fetch</>,
    rows: [
      { k: 'Speed',   zh: <>快 (单 binary, cache)</>, en: <>Fast (single binary, cache)</> },
      { k: 'Fonts',   zh: <>fontspec + OpenType</>, en: <>fontspec + OpenType</> },
      { k: 'Unicode', zh: <>原生</>, en: <>Native</> },
      { k: 'Output',  zh: <>PDF · 一次跑完所有 pass</>, en: <>PDF · one-shot, all passes</> },
    ],
    zhPick: <>选用: <strong>CI 流水线 / 不想装 7GB TeX Live</strong>; 自动下缺失包, 离线打不开。</>,
    enPick: <>Pick when: <strong>CI pipelines / don't want a 7 GB TeX Live</strong>; auto-fetches missing packages, needs network.</>,
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
    href: 'https://tug.org/', highlight: true,
    zhName: 'TUG', enName: 'TUG',
    zhNote: 'TeX Users Group · 母组织', enNote: 'TeX Users Group · steward',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A1614"/><text x="50" y="62" textAnchor="middle" fill="#2AB5A8" fontSize="26" fontWeight="700" fontFamily="Georgia, serif" fontStyle="italic">TUG</text></svg>,
  },
  {
    href: 'https://ctan.org/', highlight: true,
    zhName: 'CTAN', enName: 'CTAN',
    zhNote: '~6000 个包 · 4GB', enNote: '~6000 packages · 4 GB',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A1614"/><circle cx="50" cy="50" r="22" fill="none" stroke="#2AB5A8" strokeWidth="3"/><circle cx="50" cy="50" r="6" fill="#2AB5A8"/><line x1="50" y1="20" x2="50" y2="40" stroke="#2AB5A8" strokeWidth="2"/><line x1="50" y1="60" x2="50" y2="80" stroke="#2AB5A8" strokeWidth="2"/><line x1="20" y1="50" x2="40" y2="50" stroke="#2AB5A8" strokeWidth="2"/><line x1="60" y1="50" x2="80" y2="50" stroke="#2AB5A8" strokeWidth="2"/></svg>,
  },
  {
    href: 'https://tug.org/texlive/', highlight: true,
    zhName: 'TeX Live', enName: 'TeX Live',
    zhNote: '默认全平台发行', enNote: 'Default cross-platform distro',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#004D4D"/><text x="50" y="62" textAnchor="middle" fill="#F5EDD8" fontSize="22" fontWeight="700" fontFamily="Georgia, serif" fontStyle="italic">TL</text></svg>,
  },
  {
    href: 'https://miktex.org/',
    zhName: 'MiKTeX', enName: 'MiKTeX',
    zhNote: 'Windows · 按需取包', enNote: 'Windows · on-demand packages',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A1614"/><text x="50" y="58" textAnchor="middle" fill="#C7956D" fontSize="20" fontWeight="700" fontFamily="Georgia, serif" fontStyle="italic">MiK</text><text x="50" y="78" textAnchor="middle" fill="#C7956D" fontSize="16" fontWeight="700" fontFamily="Georgia, serif" fontStyle="italic">TeX</text></svg>,
  },
  {
    href: 'https://www.overleaf.com/', highlight: true,
    zhName: 'Overleaf', enName: 'Overleaf',
    zhNote: '浏览器协作 · ~12M 用户', enNote: 'Browser collab · ~12 M users',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#138A07"/><path d="M50 22 L80 50 L50 78 L20 50 Z M50 36 L66 50 L50 64 L34 50 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://tectonic-typesetting.github.io/',
    zhName: 'Tectonic', enName: 'Tectonic',
    zhNote: 'Rust · 单 binary · auto-fetch', enNote: 'Rust · single binary · auto-fetch',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A1614"/><path d="M30 30 L70 30 L70 50 L60 50 L60 70 L40 70 L40 50 L30 50 Z" fill="none" stroke="#C7956D" strokeWidth="4" strokeLinejoin="round"/></svg>,
  },
  {
    href: '/code/language/katex', highlight: true,
    zhName: 'KaTeX', enName: 'KaTeX',
    zhNote: '浏览器数学 · 同源详解', enNote: 'In-browser math · sibling guide',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A1614"/><text x="50" y="64" textAnchor="middle" fill="#329F76" fontSize="22" fontWeight="700" fontFamily="Georgia, serif" fontStyle="italic">KaTeX</text></svg>,
  },
  {
    href: 'https://www.mathjax.org/',
    zhName: 'MathJax', enName: 'MathJax',
    zhNote: '浏览器数学 · 完整 LaTeX', enNote: 'Browser math · full LaTeX',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A1614"/><text x="50" y="64" textAnchor="middle" fill="#1E7BAA" fontSize="34" fontWeight="700" fontFamily="Georgia, serif">∫</text></svg>,
  },
  {
    href: 'https://tikz.dev/',
    zhName: 'TikZ', enName: 'TikZ',
    zhNote: '矢量图王 · Till Tantau', enNote: 'Vector-graphics king · Till Tantau',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A1614"/><circle cx="34" cy="56" r="10" fill="none" stroke="#C7956D" strokeWidth="3"/><circle cx="68" cy="38" r="10" fill="none" stroke="#C7956D" strokeWidth="3"/><line x1="42" y1="50" x2="62" y2="42" stroke="#C7956D" strokeWidth="2.5"/><circle cx="68" cy="74" r="8" fill="none" stroke="#C7956D" strokeWidth="3"/><line x1="58" y1="68" x2="44" y2="60" stroke="#C7956D" strokeWidth="2.5"/></svg>,
  },
  {
    href: 'https://ctan.org/pkg/beamer',
    zhName: 'beamer', enName: 'beamer',
    zhNote: '学术幻灯片标准', enNote: 'Academic slide standard',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A1614"/><rect x="22" y="28" width="56" height="40" rx="2" fill="none" stroke="#2AB5A8" strokeWidth="3"/><line x1="32" y1="42" x2="68" y2="42" stroke="#2AB5A8" strokeWidth="2"/><line x1="32" y1="52" x2="58" y2="52" stroke="#2AB5A8" strokeWidth="2"/><line x1="40" y1="68" x2="60" y2="68" stroke="#2AB5A8" strokeWidth="2"/><line x1="50" y1="68" x2="50" y2="76" stroke="#2AB5A8" strokeWidth="2"/></svg>,
  },
  {
    href: 'https://www.gnu.org/software/auctex/',
    zhName: 'AUCTeX', enName: 'AUCTeX',
    zhNote: 'Emacs · 老派经典编辑', enNote: 'Emacs · old-school editor',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A1614"/><circle cx="50" cy="50" r="22" fill="none" stroke="#7F5AB6" strokeWidth="3"/><text x="50" y="58" textAnchor="middle" fill="#7F5AB6" fontSize="16" fontWeight="700" fontFamily="monospace">M-x</text></svg>,
  },
  {
    href: 'https://marketplace.visualstudio.com/items?itemName=James-Yu.latex-workshop',
    zhName: 'LaTeX Workshop', enName: 'LaTeX Workshop',
    zhNote: 'VS Code · 2026 现代默认', enNote: 'VS Code · 2026 modern default',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0078D4"/><path d="M22 30 L42 50 L22 70 L36 78 L60 50 L36 22 Z M62 26 L78 26 L78 74 L62 74 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://mg.readthedocs.io/latexmk.html',
    zhName: 'latexmk', enName: 'latexmk',
    zhNote: '编译循环自动化', enNote: 'Build-loop automation',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A1614"/><path d="M30 40 A20 20 0 1 1 30 60 L42 60 L36 70 M70 60 A20 20 0 1 1 70 40 L58 40 L64 30" stroke="#2AB5A8" strokeWidth="3" fill="none" strokeLinecap="round"/></svg>,
  },
  {
    href: 'https://typst.app/',
    zhName: 'Typst', enName: 'Typst',
    zhNote: '"新一代 LaTeX" · 兴起', enNote: '"Next-gen LaTeX" · rising',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#239DAD"/><text x="50" y="68" textAnchor="middle" fill="#fff" fontSize="38" fontWeight="700" fontFamily="Georgia, serif" fontStyle="italic">t</text></svg>,
  },
  {
    href: 'https://arxiv.org/', highlight: true,
    zhName: 'arXiv', enName: 'arXiv',
    zhNote: '论文预印 · LaTeX 90%+', enNote: 'Preprints · 90 %+ LaTeX',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#B31B1B"/><text x="50" y="58" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="700" fontFamily="Georgia, serif" fontStyle="italic">arXiv</text><text x="50" y="78" textAnchor="middle" fill="#fff" fontSize="10" fontFamily="monospace">.org</text></svg>,
  },
  {
    href: 'https://tex.stackexchange.com/',
    zhName: 'tex.stackexchange', enName: 'tex.stackexchange',
    zhNote: '问答中心 · 25 万问题', enNote: 'Q&A central · 250 K questions',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A1614"/><text x="50" y="50" textAnchor="middle" fill="#C7956D" fontSize="22" fontWeight="700" fontFamily="Georgia, serif">TeX</text><text x="50" y="74" textAnchor="middle" fill="#C7956D" fontSize="14" fontFamily="monospace">·SE</text></svg>,
  },
  {
    href: 'https://www.ctan.org/pkg/biblatex',
    zhName: 'biblatex', enName: 'biblatex',
    zhNote: '参考文献 · 后端 biber', enNote: 'Bibliography · biber backend',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A1614"/><path d="M28 26 L72 26 L72 74 L50 80 L28 74 Z" fill="none" stroke="#2AB5A8" strokeWidth="3" strokeLinejoin="round"/><line x1="50" y1="26" x2="50" y2="80" stroke="#2AB5A8" strokeWidth="2"/></svg>,
  },
  {
    href: 'https://github.com/latex3/latex2e',
    zhName: 'latex3/latex2e', enName: 'latex3/latex2e',
    zhNote: 'LaTeX 内核源码', enNote: 'LaTeX kernel source',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#161B22"/><path d="M50 18 C32 18 18 32 18 50 C18 64 27 76 40 80 C42 80 43 79 43 77 V70 C32 72 30 65 30 65 C28 60 26 59 26 59 C22 56 26 56 26 56 C30 56 32 60 32 60 C36 66 42 64 44 63 C44 60 46 58 47 57 C36 56 26 52 26 36 C26 32 28 28 32 25 C32 24 30 21 32 16 C32 16 36 16 43 21 C46 20 51 20 56 21 C63 16 67 16 67 16 C69 21 67 24 67 25 C71 28 73 32 73 36 C73 52 63 56 52 57 C54 58 56 61 56 65 V77 C56 79 57 80 59 80 C72 76 81 64 81 50 C81 32 67 18 50 18 Z" fill="#fff"/></svg>,
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
      title: <>AI 写 LaTeX — 学习曲线被压平</>,
      body: (<>
        <p>LaTeX 之前最大的反对意见是<strong>学习曲线陡峭</strong>: 100+ 包记加载顺序, 错误信息看不懂, TikZ 几乎自成一门子语言。<em>大模型对 LaTeX 异常熟练</em> (训练语料 arXiv 几乎全文), 让"写公式 / 画 TikZ / 调样式" 从 30 分钟降到 30 秒。</p>
        <p>结论: 2026 年起新研究生学 LaTeX <strong>不再从命令背诵开始</strong>, 而是<em>从"让 AI 写, 我读懂改"</em>开始。LaTeX 的"高门槛护城河"被冲塌了——这反而<strong>巩固</strong>了它的统治, 而不是削弱。</p>
      </>),
    },
    en: {
      title: <>AI writes LaTeX — the learning curve flattens</>,
      body: (<>
        <p>The longest-standing complaint against LaTeX is its <strong>steep learning curve</strong>: 100+ packages with load-order rules, opaque error messages, TikZ as a language unto itself. <em>LLMs are unusually fluent in LaTeX</em> (arXiv is essentially in their training set), collapsing "write a formula / draw a TikZ / tweak the style" from 30 minutes to 30 seconds.</p>
        <p>From 2026 a new grad student no longer learns LaTeX by <strong>memorising commands</strong> — they start by <em>"have the AI write it, then read and fix it."</em> The "high barrier" moat is gone, which paradoxically <strong>cements</strong> LaTeX's dominance rather than weakening it.</p>
      </>),
    },
  },
  {
    tag: 'LATEX3 / expl3',
    zh: { title: <>expl3 — 现代 LaTeX 编程层</>, body: <><p>2019 起 <strong>expl3</strong> 跟着每个 LaTeX 内核分发, 现代包 (siunitx 3, biblatex 3.x) 内部全是它。<em>LaTeX3 没有作为"下一版"诞生, 它通过编程层渗透到了一切</em>。2026+ 包作者写新包<strong>首选 expl3, 不再写老 plain TeX 宏</strong>——这是 30 年技术债的真正还清。</p></> },
    en: { title: <>expl3 — modern LaTeX programming layer</>, body: <><p>From 2019 <strong>expl3</strong> ships with every LaTeX kernel; modern packages (siunitx 3, biblatex 3.x) are written entirely in it. <em>LaTeX3 never arrived as "the next version" — it seeped into everything via the programming layer instead</em>. From 2026 on, package authors <strong>reach for expl3 first, not plain-TeX macros</strong> — the real settlement of a 30-year tech debt.</p></> },
  },
  {
    tag: 'TYPST',
    zh: { title: <>Typst — 唯一可信的挑战者</>, body: <><p>2023 release 1.0, 2024-2026 在课堂 / 课程作业 / 短论文里增速最快: <em>语法干净 (像 Markdown)、编译 ~100ms、浏览器版无需装</em>。但<strong>期刊 .cls / 长论文 / 复杂 TikZ 依然 LaTeX-only</strong>。下一个 10 年很可能 = LaTeX 守住期刊 + Typst 拿下日常笔记 / 课件这一档<em>分层共存</em>。</p></> },
    en: { title: <>Typst — the one credible challenger</>, body: <><p>1.0 in 2023; growing fastest in classrooms, coursework, short notes through 2024-26: <em>clean syntax (Markdown-ish), ~100 ms compile, browser edition zero-install</em>. But <strong>journal .cls files, long papers, advanced TikZ still belong to LaTeX</strong>. The next decade likely looks like <em>layered coexistence</em>: LaTeX keeps journals, Typst takes notes and lecture material.</p></> },
  },
  {
    tag: 'STRUCTURED WEB',
    zh: { title: <>Web-first authoring → 编译到 LaTeX</>, body: <><p>Curvenote / Distill / MyST 等新一代<strong>"先在浏览器协作写, 再编译成 LaTeX + PDF"</strong>工具在抬头。作者层用 markdown + 数学块 + 代码块, 后端走 LaTeX 出版。<em>LaTeX 在 2030 年很可能不是用户层, 而是编译目标层</em>——像 LLVM IR 之于编程语言。</p></> },
    en: { title: <>Web-first authoring → compile to LaTeX</>, body: <><p>A wave of tools (Curvenote, Distill, MyST) push <strong>"write collaboratively in the browser, compile to LaTeX + PDF"</strong>. The author layer is markdown + math blocks + code blocks; LaTeX stays as the publishing backend. <em>By 2030 LaTeX may live below the user layer, as the compile target</em> — much like LLVM IR sits under programming languages.</p></> },
  },
];

interface Footgun {
  zh: { title: ReactNode; body: ReactNode };
  en: { title: ReactNode; body: ReactNode };
}

const FOOTGUNS: Footgun[] = [
  {
    zh: { title: <>多 pass 编译</>, body: <>交叉引用 / 目录 / 参考文献需要<strong>跑 2-3 次</strong> <code>pdflatex</code> + <code>biber</code> 才稳定。手动跑容易漏——用 <code>latexmk -pdf</code> 自动循环到不再变化为止。</> },
    en: { title: <>Multi-pass compilation</>, body: <>Cross-refs, table of contents, bibliography need <strong>2-3 runs</strong> of <code>pdflatex</code> + <code>biber</code> to stabilise. Easy to miss a pass by hand — use <code>latexmk -pdf</code> to loop until output stops changing.</> },
  },
  {
    zh: { title: <>错误信息是天书</>, body: <><code>! Undefined control sequence.</code> + <em>提示行号往往离真凶很远</em>。读 .log 比读错误窗口靠谱; <code>chktex</code> + LaTeX Workshop 的智能定位帮一些, AI 帮更多。</> },
    en: { title: <>Cryptic error messages</>, body: <><code>! Undefined control sequence.</code> + <em>the reported line is often nowhere near the real cause</em>. The .log file beats the error window; <code>chktex</code> + LaTeX Workshop's smart locator help, AI helps more.</> },
  },
  {
    zh: { title: <>包加载顺序敏感</>, body: <><strong>hyperref 几乎必须最后加载</strong> (它 hook 所有交叉引用); <code>cleveref</code> 必须在 hyperref 之后; <code>biblatex</code> 在 csquotes 之后。<em>这套口诀新人踩一年才记牢</em>。</> },
    en: { title: <>Package load order matters</>, body: <><strong>hyperref must usually be loaded last</strong> (it hooks every cross-ref mechanism); <code>cleveref</code> must come after hyperref; <code>biblatex</code> after csquotes. <em>The rules take a year of stubbed toes to internalise</em>.</> },
  },
  {
    zh: { title: <>浮动体定位</>, body: <>永恒的 <code>[h!]</code> / <code>[!t]</code> / <code>\FloatBarrier</code> 之战。LaTeX 把图 / 表当 <em>会自己找位置的浮动体</em>, 你想"放这里" 它常常拒绝。<strong>placeins 包的 <code>\FloatBarrier</code></strong> 是最实用的逃生口。</> },
    en: { title: <>Float placement</>, body: <>The eternal <code>[h!]</code> / <code>[!t]</code> / <code>\FloatBarrier</code> war. LaTeX treats figures and tables as <em>"floating elements that pick their own slot"</em>; "put it here" requests are routinely denied. The most pragmatic escape hatch is <strong><code>\FloatBarrier</code> from the placeins package</strong>.</> },
  },
  {
    zh: { title: <>BibTeX vs Biber 选择</>, body: <>老栈: <code>bibtex</code> + <code>natbib</code>; 新栈: <code>biber</code> + <code>biblatex</code>。<strong>2010 后新模板基本全是后者</strong>; 但很多老教程还停在前者, 一个 .bbl 卡住整个编译。<em>没特殊原因, 选 biber + biblatex</em>。</> },
    en: { title: <>BibTeX vs Biber</>, body: <>Legacy stack: <code>bibtex</code> + <code>natbib</code>; modern stack: <code>biber</code> + <code>biblatex</code>. <strong>Templates post-2010 are almost all the latter</strong>, but many old tutorials freeze in the former — one stale .bbl can wedge the whole build. <em>Without a specific reason, pick biber + biblatex</em>.</> },
  },
  {
    zh: { title: <>shell-escape 的双刃</>, body: <><code>minted</code> / <code>tikz-externalize</code> / <code>pdfcrop</code> 等包要 <code>--shell-escape</code> 才能跑——意味着 LaTeX 可以执行任意 shell 命令。<em>Overleaf / 期刊 sandbox 经常默认禁掉</em>; 改用 listings 是更稳的退路。</> },
    en: { title: <>shell-escape: double-edged</>, body: <><code>minted</code>, <code>tikz-externalize</code>, <code>pdfcrop</code> need <code>--shell-escape</code> to run — which lets LaTeX run arbitrary shell commands. <em>Overleaf / journal sandboxes routinely disable it by default</em>; the safer fallback is <code>listings</code>.</> },
  },
];

interface FamousDoc {
  zhName: string;
  enName: string;
  zhDesc: ReactNode;
  enDesc: ReactNode;
}

const FAMOUS: FamousDoc[] = [
  {
    zhName: 'The Art of Computer Programming',
    enName: 'The Art of Computer Programming',
    zhDesc: <>Knuth 自己的书。<strong>TeX 之所以存在</strong>就是为了排这套书; 1968 第 1 卷, 仍在写第 4 卷分册——用的依然是 plain TeX, 不是 LaTeX (作者本人坚持)。</>,
    enDesc: <>Knuth's own books. <strong>TeX exists in order to typeset this series</strong>; vol 1 in 1968, vol 4 still being written in fascicles — all in plain TeX, never LaTeX (the author insists).</>,
  },
  {
    zhName: 'Perelman, "The entropy formula for the Ricci flow…"',
    enName: 'Perelman, "The entropy formula for the Ricci flow…"',
    zhDesc: <>2002 arXiv:math/0211159 — Perelman 解决 Poincaré 猜想的三篇论文之一, 纯 LaTeX. <em>世纪难题的解答, 39 页 .tex 源</em>。</>,
    enDesc: <>2002 arXiv:math/0211159 — one of Perelman's three papers settling the Poincaré conjecture, plain LaTeX source. <em>A century's most famous problem, solved in 39 pages of .tex</em>.</>,
  },
  {
    zhName: 'The Standard Model Lagrangian (poster)',
    enName: 'The Standard Model Lagrangian (poster)',
    zhDesc: <>T.D. Gutierrez 整理的<strong>单一方程 ~3 页</strong>的 Standard Model 拉氏量海报。<em>除 LaTeX 没人写得下来</em>。</>,
    enDesc: <>T. D. Gutierrez's <strong>~3-page single-equation</strong> poster of the Standard Model Lagrangian. <em>Nothing but LaTeX can lay it out</em>.</>,
  },
  {
    zhName: 'arXiv preprints (1991→)',
    enName: 'arXiv preprints (1991→)',
    zhDesc: <>~2.5M 篇论文; <strong>90%+ 提交 LaTeX 源</strong>。arXiv 把 .tex 一并存档, 你能下回 30 年前的源码自己重编。<em>科学传播的物质底层</em>。</>,
    enDesc: <>~2.5 M papers; <strong>90 %+ submitted as LaTeX source</strong>. arXiv archives the .tex, you can re-download a 30-year-old source and recompile. <em>The physical substrate of scientific communication</em>.</>,
  },
  {
    zhName: 'NeurIPS / ICML / CVPR / SIGGRAPH proceedings',
    enName: 'NeurIPS / ICML / CVPR / SIGGRAPH proceedings',
    zhDesc: <>所有顶级 CS 会议 — <em>每篇都是 LaTeX</em>, 会议官方发模板。.cls 出错会导致 desk reject。</>,
    enDesc: <>Every top CS conference — <em>every paper is LaTeX</em>; the venue ships an official template. A broken .cls causes desk reject.</>,
  },
  {
    zhName: 'Donald Knuth — "Mathematical Writing" (1989)',
    enName: 'Donald Knuth — "Mathematical Writing" (1989)',
    zhDesc: <>Knuth 在 Stanford 开的"数学写作"课讲义。<em>讨论如何写好数学</em>——本身用 TeX 排, 是 TeX 排版美学的元教材。</>,
    enDesc: <>Knuth's Stanford lecture notes on "mathematical writing." <em>About how to write math well</em> — itself typeset in TeX, the meta-textbook of TeX aesthetics.</>,
  },
];

export default function LatexIntroPage() {
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  const rootRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(
    'LaTeX : 数学排版的事实标准 — 1978→2026',
    'LaTeX : the de-facto standard for typesetting math — 1978→2026'
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
      '.tl-item, .why-card, .def-card, .logo-card, .future-card, .compare-col, .cmp-table tr, .ts-card, .tag-card, .engine-card, .footgun-card, .preamble, .spotlight, .ai-takeaway, .quote-block, .famous-row'
    );
    targets.forEach((el) => { el.classList.add('fade-up'); io.observe(el); });

    root.querySelectorAll<HTMLElement>('.tl-item').forEach((el, i) => { el.style.transitionDelay = `${Math.min(i * 50, 400)}ms`; });
    root.querySelectorAll<HTMLElement>('.why-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 80}ms`; });
    root.querySelectorAll<HTMLElement>('.logo-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 6) * 60}ms`; });
    root.querySelectorAll<HTMLElement>('.ts-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; });
    root.querySelectorAll<HTMLElement>('.tag-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 50}ms`; });
    root.querySelectorAll<HTMLElement>('.engine-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; });
    root.querySelectorAll<HTMLElement>('.footgun-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 2) * 80}ms`; });

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
        a.style.color = a.getAttribute('href') === '#' + cur ? 'var(--latex-bright)' : '';
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
      <div ref={rootRef} className="latex-intro-root">
        <div className="grid-bg" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            <svg viewBox="0 0 256 256" width="28" height="28">
              <defs>
                <linearGradient id="lx-nav" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#2AB5A8" />
                  <stop offset="100%" stopColor="#004D4D" />
                </linearGradient>
              </defs>
              <rect x="16" y="16" width="224" height="224" rx="32" fill="url(#lx-nav)" />
              <text x="128" y="170" textAnchor="middle" fontSize="124" fontWeight="700" fontFamily="Georgia, serif" fontStyle="italic" fill="#F5EDD8">T</text>
            </svg>
            <span>LaTeX</span>
            <span className="nav-tag"><L zh=": typography for math" en=": typography for math" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#anatomy"><L zh="解剖" en="Anatomy" /></a></li>
            <li><a href="#math"><L zh="数学展示" en="Math" /></a></li>
            <li><a href="#engines"><L zh="引擎" en="Engines" /></a></li>
            <li><a href="#packages"><L zh="包生态" en="Packages" /></a></li>
            <li><a href="#vs"><L zh="对比" en="vs Others" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#footguns"><L zh="陷阱" en="Footguns" /></a></li>
            <li><a href="#famous"><L zh="名作" en="Famous" /></a></li>
            <li><a href="#projects"><L zh="生态" en="Ecosystem" /></a></li>
            <li><a href="#future"><L zh="前景" en="Outlook" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 1978 — 2026 · Donald Knuth · Leslie Lamport · LaTeX2e · TeX 3.141592653 · π</div>
            <h1 className="hero-title">
              <span className="hero-name">LaTeX</span>
              <span className="hero-colon">:</span>
              <span className="hero-type">{'\\typography{math}'}</span>
            </h1>
            <p className="hero-sub">
              <L
                zh={<><strong>LaTeX = TeX + 一套人话宏</strong>——把 Knuth 1978 年那个"<em>给数学排版用的 6 个月的小项目</em>"40 年来逐步外推, 直到它<strong>排出了世界上 90% 的数学论文</strong>。它不漂亮、不轻量、不易学; 但<em>没有替代</em>。</>}
                en={<><strong>LaTeX = TeX with human-friendly macros</strong> — taking Knuth's 1978 "<em>six-month side project for math typesetting</em>" and pushing it outward for 40 years until <strong>it sets ~90 % of the world's math papers</strong>. It isn't pretty, isn't light, isn't easy — but <em>nothing replaces it</em>.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">1978</span>
                <span className="stat-label"><L zh={<>Knuth 开工 TeX<br /><em>估"6 个月", 实际 10 年</em></>} en={<>Knuth starts TeX<br /><em>est. "6 months," took 10 yrs</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">1985</span>
                <span className="stat-label"><L zh={<>Lamport 发布 LaTeX<br /><em>TeX 之上的人话宏</em></>} en={<>Lamport ships LaTeX<br /><em>human macros over TeX</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">1994<small>·06</small></span>
                <span className="stat-label"><L zh={<>LaTeX2e<br /><em>32 年来仍是当前版本</em></>} en={<>LaTeX2e<br /><em>still current after 32 years</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">6000<small>+</small></span>
                <span className="stat-label"><L zh={<>CTAN 包数<br /><em>~4GB · 数学界的 npm</em></>} en={<>CTAN packages<br /><em>~4 GB · the math-world npm</em></>} /></span>
              </div>
            </div>
            <div className="hero-cube">
              {LATEX_LOGO_SVG}
            </div>
            <div className="hero-floats">
              <span className="float f1">{'\\frac{1}{2}'}</span>
              <span className="float f2">{'\\begin{equation}'}</span>
              <span className="float f3">TikZ</span>
              <span className="float f4">{'\\documentclass'}</span>
              <span className="float f5">beamer</span>
              <span className="float f6">bibtex</span>
              <span className="float f7">{'\\section{...}'}</span>
              <span className="float f8">{'\\usepackage{amsmath}'}</span>
              <span className="float f9">pdflatex</span>
              <span className="float f10">xelatex</span>
              <span className="float f11">lualatex</span>
              <span className="float f12">{'\\maketitle'}</span>
              <span className="float f13">{'\\cite{knuth1984}'}</span>
              <span className="float f14">tectonic</span>
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
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>LaTeX</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>LaTeX 不是<strong>另一个 TeX</strong>——它是 <strong>TeX 之上的宏包</strong>。Knuth 写 TeX 是为了排数学公式; Lamport 写 LaTeX 是<em>让普通人写 TeX</em>。今天人们说"LaTeX", 实际指的是 <strong>TeX 引擎 + LaTeX 内核 + CTAN 上 ~6000 个包 + 字体 + 编辑工具链</strong>的整个栈。</>}
                  en={<>LaTeX is not <strong>another TeX</strong> — it is <strong>a macro package on top of TeX</strong>. Knuth wrote TeX to typeset math formulas; Lamport wrote LaTeX <em>so ordinary people could write TeX</em>. When people say "LaTeX" today they mean the whole stack: <strong>TeX engine + LaTeX kernel + ~6000 CTAN packages + fonts + editor tooling</strong>.</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="语义化标记, 不是 WYSIWYG" en="Semantic markup, not WYSIWYG" />, tag: 'markup', p: <L zh={<>跟 HTML 同源思想: <code>{`\\section{Intro}`}</code> 声明 <strong>"这是节标题"</strong>, 字体大小由文档类决定, 不在源里。<em>结构 / 内容 / 样式分离</em>——换 <code>{`\\documentclass`}</code> 整篇换风格, 不动一个字。</>} en={<>Same idea as HTML: <code>{`\\section{Intro}`}</code> declares <strong>"this is a section heading"</strong>; font and size are decided by the document class, not in the source. <em>Structure / content / style separated</em> — swap the <code>{`\\documentclass`}</code> and the whole paper reflows.</>} /> },
                { h: <L zh="TeX 引擎被冻在 π" en="TeX engine frozen at π" />, tag: 'frozen', p: <L zh={<>Knuth 1990 起<strong>停止给 TeX 加功能</strong>, 只接 bug fix; 版本号<em>渐近 π</em> (当前 3.141592653)。任何 TeX bug Knuth 付 <strong>$2.56</strong> 一份支票, 几乎从不被兑现——收支票的当荣誉奖牌。</>} en={<>From 1990 Knuth <strong>stops adding features to TeX</strong>, accepts only bug fixes; the version number <em>asymptotes to π</em> (currently 3.141592653). Each TeX bug earns a <strong>$2.56 cheque</strong> from Knuth himself — almost never cashed, framed as a trophy instead.</>} /> },
                { h: <L zh="多 pass 编译模型" en="Multi-pass compile model" />, tag: 'pipeline', p: <L zh={<>.tex 走 <code>pdflatex</code> / <code>xelatex</code> / <code>lualatex</code> / <code>tectonic</code> 引擎得 .pdf。<strong>交叉引用 / TOC / 参考文献需要 2-3 次</strong>; 工具如 <code>latexmk</code> 自动循环到稳定。</>} en={<>.tex runs through <code>pdflatex</code> / <code>xelatex</code> / <code>lualatex</code> / <code>tectonic</code> to produce a .pdf. <strong>Cross-refs / TOC / bibliography need 2-3 runs</strong>; <code>latexmk</code> loops until the output stops changing.</>} /> },
                { h: <L zh="40 年向后兼容" en="40 years of compat" />, tag: 'compat', p: <L zh={<>1985 年 Lamport 写的 LaTeX 文档<strong>在 2026 LaTeX2e 里仍能编译</strong>。同源思想 跟 web 一样: 永远渲染。<em>跟 HTML 兄弟一脉</em>。延伸 <a href="/code/language/html">/code/html</a>。</>} en={<>A LaTeX document written by Lamport in 1985 <strong>still compiles under 2026 LaTeX2e</strong>. Same backbone as the web: render forever. <em>Direct sibling philosophy of HTML</em>. See <a href="/code/language/html">/code/html</a>.</>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">lamport-1985.tex</span><span className="lang-tag js">1985</span></div>
                <pre className="code"><code>
                  <span className="cl-cmd">{'\\documentclass'}</span>{'{article}'}{'\n'}
                  <span className="cl-cmd">{'\\title'}</span>{'{Distributed Algorithms}'}{'\n'}
                  <span className="cl-cmd">{'\\author'}</span>{'{L. Lamport}'}{'\n'}
                  <span className="cl-cmd">{'\\begin'}</span>{'{document}'}{'\n'}
                  <span className="cl-cmd">{'\\maketitle'}</span>{'\n'}
                  <span className="cl-cmd">{'\\section'}</span>{'{Introduction}'}{'\n'}
                  Time, clocks and the ordering of events...{'\n'}
                  <span className="cl-cmd">{'\\end'}</span>{'{document}'}{'\n\n'}
                  <span className="cl-c">{tr({ zh: '% 1985 写, 2026 仍能编译', en: '% written in 1985, still compiles in 2026'
                })}</span>
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">paper-2026.tex</span><span className="lang-tag ts">2026</span></div>
                <pre className="code"><code>
                  <span className="cl-cmd">{'\\documentclass'}</span>{'[11pt,a4paper]{article}'}{'\n'}
                  <span className="cl-cmd">{'\\usepackage'}</span>{'{lmodern,microtype}'}{'\n'}
                  <span className="cl-cmd">{'\\usepackage'}</span>{'{amsmath,amssymb,amsthm}'}{'\n'}
                  <span className="cl-cmd">{'\\usepackage'}</span>{'[backend=biber]{biblatex}'}{'\n'}
                  <span className="cl-cmd">{'\\usepackage'}</span>{'{tikz,pgfplots}'}{'\n'}
                  <span className="cl-cmd">{'\\usepackage'}</span>{'{hyperref}'}  <span className="cl-c">% last</span>{'\n'}
                  <span className="cl-cmd">{'\\title'}</span>{'{...}'} <span className="cl-cmd">{'\\author'}</span>{'{...}'}{'\n'}
                  <span className="cl-cmd">{'\\begin'}</span>{'{document}'}{'\n'}
                  <span className="cl-cmd">{'\\maketitle'}</span>{' '}<span className="cl-cmd">{'\\tableofcontents'}</span>{'\n'}
                  <span className="cl-cmd">{'\\section'}</span>{'{Introduction}'}{'\n'}
                  ...{'\n'}
                  <span className="cl-cmd">{'\\end'}</span>{'{document}'}
                </code></pre>
              </div>
            </div>
          </section>

          {/* 02 History */}
          <section className="section" id="history">
            <header className="sec-head">
              <span className="sec-num">02</span>
              <h2 className="sec-title"><L zh="来路" en="History" /> <code>: 1978 → 2026</code></h2>
              <p className="sec-desc"><L
                zh={<>LaTeX 的故事是 4 段叙事: <strong>TeX 诞生</strong> (1968-1985 · Knuth) → <strong>LaTeX 套人话 + 学术界扩散</strong> (1985-2000) → <strong>引擎多元 + Web 化</strong> (2000-2020 · XeTeX / Lua / pdfTeX / KaTeX / Overleaf) → <strong>AI 时代 + Typst 挑战</strong> (2020-2026)。</>}
                en={<>LaTeX's story breaks into four arcs: <strong>TeX is born</strong> (1968-1985 · Knuth) → <strong>LaTeX adds human macros + spreads through academia</strong> (1985-2000) → <strong>engines diversify + web era</strong> (2000-2020 · XeTeX / Lua / pdfTeX / KaTeX / Overleaf) → <strong>AI era + Typst challenge</strong> (2020-2026).</>}
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

          {/* 03 Anatomy */}
          <section className="section" id="anatomy">
            <header className="sec-head">
              <span className="sec-num">03</span>
              <h2 className="sec-title"><L zh="一份 LaTeX 文档的解剖" en="Anatomy of a LaTeX document" /> <code>: Preamble</code></h2>
              <p className="sec-desc"><L
                zh={<>下面是一份<strong>现代标准论文</strong>的 preamble: 文档类 + 字体 + 数学 + 图 + 单位 + 参考文献 + 超链接。<em>顺序很重要</em>; hyperref 几乎必须最后。</>}
                en={<>Below is the preamble of a <strong>modern, standard paper</strong>: document class + fonts + math + graphics + units + bibliography + hyperlinks. <em>Order matters</em>; hyperref must almost always come last.</>}
              /></p>
            </header>

            <div className="preamble">
              <pre className="preamble-src"><code>
                <span className="cl-cmd">{'\\documentclass'}</span>{'[11pt,a4paper]'}
                <span className="cl-arg">{'{article}'}</span>{'\n'}
                <span className="cl-cmd">{'\\usepackage'}</span>{'[T1]'}<span className="cl-arg">{'{fontenc}'}</span>{'\n'}
                <span className="cl-cmd">{'\\usepackage'}</span><span className="cl-arg">{'{lmodern,microtype}'}</span>{'\n'}
                <span className="cl-cmd">{'\\usepackage'}</span><span className="cl-arg">{'{amsmath,amssymb,amsthm}'}</span>{'\n'}
                <span className="cl-cmd">{'\\usepackage'}</span><span className="cl-arg">{'{graphicx,booktabs,siunitx}'}</span>{'\n'}
                <span className="cl-cmd">{'\\usepackage'}</span>{'[backend=biber,style=numeric]'}<span className="cl-arg">{'{biblatex}'}</span>{'\n'}
                <span className="cl-cmd">{'\\addbibresource'}</span><span className="cl-arg">{'{refs.bib}'}</span>{'\n'}
                <span className="cl-cmd">{'\\usepackage'}</span><span className="cl-arg">{'{tikz,pgfplots}'}</span>{'\n'}
                <span className="cl-cmd">{'\\usepackage'}</span><span className="cl-arg">{'{hyperref}'}</span>  <span className="cl-c">% must be last</span>{'\n'}
                {'\n'}
                <span className="cl-cmd">{'\\title'}</span><span className="cl-arg">{'{A Note on Multi-Pass Compilation}'}</span>{'\n'}
                <span className="cl-cmd">{'\\author'}</span><span className="cl-arg">{'{Jane Researcher}'}</span>{'\n'}
                <span className="cl-cmd">{'\\date'}</span><span className="cl-arg">{'{\\today}'}</span>{'\n'}
                {'\n'}
                <span className="cl-cmd">{'\\begin'}</span><span className="cl-arg">{'{document}'}</span>{'\n'}
                {'  '}<span className="cl-cmd">{'\\maketitle'}</span>{'\n'}
                {'  '}<span className="cl-cmd">{'\\tableofcontents'}</span>{'\n'}
                {'  '}<span className="cl-cmd">{'\\section'}</span><span className="cl-arg">{'{Introduction}'}</span>{'\n'}
                {'  '}LaTeX is the de-facto standard...{'\n'}
                {'  '}<span className="cl-cmd">{'\\printbibliography'}</span>{'\n'}
                <span className="cl-cmd">{'\\end'}</span><span className="cl-arg">{'{document}'}</span>
              </code></pre>
              <div className="preamble-notes">
                <div className="preamble-note"><b>\documentclass</b><L zh={<>主体类型 · 大小 · 纸张 · 列数。换成 <code>book</code>/<code>report</code>/<code>beamer</code> 整篇换风格。</>} en={<>Body type · size · paper · columns. Swap for <code>book</code>/<code>report</code>/<code>beamer</code> and the whole doc reflows.</>} /></div>
                <div className="preamble-note"><b>fontenc + lmodern</b><L zh={<>T1 字符编码 + Latin Modern 字体 (CM 现代衍生)。<em>跨语言抓 ä é è ñ 不烂</em>。</>} en={<>T1 encoding + Latin Modern font (CM-derived). <em>Multi-lingual ä é è ñ won't break</em>.</>} /></div>
                <div className="preamble-note"><b>microtype</b><L zh={<>Hàn Thế Thành 的 protrusion + expansion。<em>段落瞬间紧实</em>; 一行进口即看到。</>} en={<>Hàn Thế Thành's protrusion + expansion. <em>Paragraphs feel tighter instantly</em> — one-line import you'll see immediately.</>} /></div>
                <div className="preamble-note"><b>amsmath / amssymb / amsthm</b><L zh={<>AMS 数学扩展三件套。<code>align</code>, <code>cases</code>, <code>\mathbb</code>, 定理环境。</>} en={<>AMS math trio. <code>align</code>, <code>cases</code>, <code>\mathbb</code>, theorem environments.</>} /></div>
                <div className="preamble-note"><b>graphicx</b><L zh={<>插图: <code>\includegraphics</code>; booktabs 表格; siunitx 单位。</>} en={<>Figures: <code>\includegraphics</code>; booktabs for tables; siunitx for units.</>} /></div>
                <div className="preamble-note"><b>biblatex + biber</b><L zh={<>新栈参考文献。比 BibTeX 灵活 10 倍; <code>style=numeric</code> 决定 [1] 还是 (Knuth 1984)。</>} en={<>New-stack bibliography. 10× more flexible than BibTeX; <code>style=numeric</code> picks [1] vs (Knuth 1984).</>} /></div>
                <div className="preamble-note"><b>tikz / pgfplots</b><L zh={<>矢量图 + 科学绘图。TikZ 是 LaTeX 之上的"另一门子语言"。</>} en={<>Vector graphics + scientific plots. TikZ is essentially a sub-language inside LaTeX.</>} /></div>
                <div className="preamble-note"><b>hyperref</b><L zh={<>PDF 内部超链接 + 元数据 + 书签。<strong>必须最后加载</strong>——它要 hook 所有 \ref, \cite, \href。</>} en={<>PDF internal hyperlinks + metadata + bookmarks. <strong>Must be loaded last</strong> — it hooks every \ref, \cite, \href.</>} /></div>
              </div>
            </div>
          </section>

          {/* 04 Math showcase */}
          <section className="section" id="math">
            <header className="sec-head">
              <span className="sec-num">04</span>
              <h2 className="sec-title"><L zh="数学排版展示" en="Math Typesetting Showcase" /> <code>: LiveKaTeX</code></h2>
              <p className="sec-desc"><L
                zh={<>下面 12 个例子<strong>每张卡左边是 LaTeX 源, 右边是 KaTeX 实时渲染</strong>。这就是 LaTeX 不可替代的核心: 在 .tex 里写一行, 出来是<em>世界上最讲究的数学排版</em>——上下标的高度、积分号的弧度、矩阵的对齐, 都是 Knuth 600 页规则推出来的。</>}
                en={<>Twelve examples below — <strong>LaTeX source on the left, live KaTeX rendering on the right</strong> of each card. This is LaTeX's irreplaceable core: a single line of .tex produces <em>the most carefully typeset math in the world</em>. Super- and subscript heights, integral-sign curvature, matrix alignment — all derived from Knuth's 600 pages of rules.</>}
              /></p>
            </header>

            <div className="ts-grid">
              {MATH_DEMOS.map((d, i) => (
                <div className="ts-card" key={i}>
                  <div className="ts-tag">{String.fromCharCode(65 + (i % 26))}</div>
                  <h3>{lang === 'zh' ? d.zhLabel : d.enLabel}</h3>
                  <pre className="ts-code">{d.src}</pre>
                  <div className="ts-rendered">
                    {d.block ? <TeXBlock src={d.src} /> : <TeX src={d.src} />}
                  </div>
                </div>
              ))}
              <div className="ts-card ts-callout">
                <div className="ts-tag ts-tag-soft">∞</div>
                <h3><L zh={<>KaTeX vs MathJax — 注意区别</>} en={<>KaTeX vs MathJax — a note</>} /></h3>
                <p><L
                  zh={<>本页用的是 <strong>KaTeX</strong> ——速度极快 (~100× MathJax), 但<em>只覆盖 LaTeX 数学子集</em>: 没有 TikZ, 没有 \usepackage, 没有 chemfig。完整 LaTeX 编译需要 pdfLaTeX / XeLaTeX / LuaLaTeX 这类引擎。延伸: <a href="/code/language/katex">/code/language/katex</a>。</>}
                  en={<>This page renders with <strong>KaTeX</strong> — extremely fast (~100× MathJax), but only covers the <em>LaTeX math subset</em>: no TikZ, no \usepackage, no chemfig. Full LaTeX compilation needs pdfLaTeX / XeLaTeX / LuaLaTeX engines. Deep dive: <a href="/code/language/katex">/code/language/katex</a>.</>}
                /></p>
                <p className="ts-callout-quote">"<em><L
                  zh={<>LaTeX 不只是排版系统, 它是一种<strong>数学思考的速记法</strong>。 — Knuth, 多次访谈</>}
                  en={<>LaTeX isn't only a typesetting system — it's a <strong>shorthand for thinking in mathematics</strong>. — Knuth, paraphrased from interviews</>}
                /></em>"</p>
              </div>
            </div>
          </section>

          {/* 05 Engines */}
          <section className="section" id="engines">
            <header className="sec-head">
              <span className="sec-num">05</span>
              <h2 className="sec-title"><L zh="TeX 引擎" en="The TeX Engines" /> <code>: pdflatex / xelatex / lualatex / tectonic</code></h2>
              <p className="sec-desc"><L
                zh={<>"LaTeX" 这个词背后<strong>不只一个引擎</strong>。同一份 .tex 用 <code>pdflatex</code> 编一次, 用 <code>xelatex</code> 又编一次, 结果可能<em>字体不一样、错误不一样、跑慢一倍</em>。2026 年的"选哪个"指南如下。</>}
                en={<>"LaTeX" hides <strong>more than one engine</strong>. The same .tex through <code>pdflatex</code> vs <code>xelatex</code> can give you <em>different fonts, different errors, twice the runtime</em>. Here's the 2026 "which one" guide.</>}
              /></p>
            </header>

            <div className="engines">
              {ENGINES.map((e, i) => (
                <div className="engine-card" key={i}>
                  <div className="engine-name">{e.name}</div>
                  <div className="engine-sub">{e.sub}</div>
                  {e.rows.map((r, j) => (
                    <div className="engine-row" key={j}>
                      <b>{r.k}</b>
                      <span>{tr(r)}</span>
                    </div>
                  ))}
                  <div className="engine-pick">{lang === 'zh' ? e.zhPick : e.enPick}</div>
                </div>
              ))}
            </div>
          </section>

          {/* 06 Packages */}
          <section className="section" id="packages">
            <header className="sec-head">
              <span className="sec-num">06</span>
              <h2 className="sec-title"><L zh="包生态" en="Package Ecosystem" /> <code>: ~6000 on CTAN</code></h2>
              <p className="sec-desc"><L
                zh={<>CTAN ~6000 个包 (~4GB), 但 <strong>20 个包覆盖 80% 的论文</strong>。下面这些是<em>2026 年标准论文 preamble 必出现</em>的 — 每张卡顺手把首次出现的年份标了。</>}
                en={<>CTAN holds ~6000 packages (~4 GB), but <strong>20 packages cover 80 % of papers</strong>. Below is the set you <em>actually see in a standard 2026 preamble</em>, with first-release years annotated.</>}
              /></p>
            </header>

            <div className="tags-grid">
              {PACKAGES.map((t, i) => (
                <div className="tag-card" key={i}>
                  <div className="tag-card-yr">{t.year}</div>
                  <div className="tag-card-tag">package</div>
                  <code>{t.tag}</code>
                  <p>{lang === 'zh' ? t.zhDesc : t.enDesc}</p>
                </div>
              ))}
            </div>

            <div className="spotlight">
              <span className="spotlight-tag">DISTRIBUTIONS</span>
              <div className="spotlight-grid">
                <div>
                  <h3><L zh={<>发行版 / 编辑器</>} en={<>Distributions / editors</>} /></h3>
                  <p><L
                    zh={<>"装 LaTeX" 在 2026 大致是 4 种路径: <strong>TeX Live</strong> 全平台 (~7GB), <strong>MiKTeX</strong> Windows 按需取包, <strong>MacTeX</strong> macOS 包装, <strong>Tectonic</strong> 单 binary CI 友好。</>}
                    en={<>"Installing LaTeX" in 2026 means roughly four paths: <strong>TeX Live</strong> cross-platform (~7 GB), <strong>MiKTeX</strong> on Windows with on-demand packages, <strong>MacTeX</strong> the macOS wrapper, <strong>Tectonic</strong> single binary CI-friendly.</>}
                  /></p>
                  <ul className="spotlight-list">
                    <li><strong>TeX Live</strong> — <L zh={<>TUG 出品, Linux/macOS 默认</>} en={<>TUG-maintained, default on Linux / macOS</>} /></li>
                    <li><strong>MiKTeX</strong> — <L zh={<>Windows, 缺包自动 fetch</>} en={<>Windows, fetches missing packages on demand</>} /></li>
                    <li><strong>MacTeX</strong> — <L zh={<>TeX Live 的 macOS 包装 + GUI</>} en={<>macOS wrapper around TeX Live + GUI</>} /></li>
                    <li><strong>Tectonic</strong> — <L zh={<>Rust 单 binary, CI 首选</>} en={<>Rust single binary, the CI pick</>} /></li>
                  </ul>
                </div>
                <div>
                  <h3><L zh={<>编辑器 / 工作流</>} en={<>Editors / workflow</>} /></h3>
                  <p><L
                    zh={<>2026 现代默认: <strong>VS Code + LaTeX Workshop</strong> 插件 (内置 latexmk + PDF 预览 + 自动补全)。学术老派仍用 <strong>TeXstudio</strong> / <strong>TeXShop</strong>; Emacs 派坚守 <strong>AUCTeX</strong>; 纯浏览器派去 <strong>Overleaf</strong>。</>}
                    en={<>The 2026 modern default: <strong>VS Code + LaTeX Workshop</strong> (built-in latexmk + PDF preview + autocomplete). Old-guard academia still uses <strong>TeXstudio</strong> / <strong>TeXShop</strong>; the Emacs camp holds <strong>AUCTeX</strong>; browser-only people go <strong>Overleaf</strong>.</>}
                  /></p>
                  <ul className="spotlight-list">
                    <li><strong>VS Code + LaTeX Workshop</strong> — <L zh="2026 默认" en="2026 default" /></li>
                    <li><strong>Overleaf</strong> — <L zh="浏览器协作" en="browser collab" /></li>
                    <li><strong>TeXstudio / TeXShop</strong> — <L zh="老派 GUI" en="old-guard GUI" /></li>
                    <li><strong>Emacs + AUCTeX</strong> — <L zh="键盘党" en="keyboard tribe" /></li>
                    <li><code>latexmk</code> / <code>arara</code> — <L zh="自动编译循环" en="auto build loop" /></li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* 07 vs */}
          <section className="section" id="vs">
            <header className="sec-head">
              <span className="sec-num">07</span>
              <h2 className="sec-title"><L zh="对比" en="vs Word / Markdown / Typst" /> <code>: Alternatives</code></h2>
              <p className="sec-desc"><L
                zh={<>LaTeX 不是<strong>唯一</strong>排版选择。Word 在办公文档赢、Markdown + pandoc 在博客赢、Typst 在新一代笔记赢、MathML 在<em>本来该</em>赢的浏览器数学上输给了 KaTeX。下面是 5 个常见竞争对手的诚实对比。</>}
                en={<>LaTeX isn't the <strong>only</strong> choice. Word owns office docs, Markdown + pandoc owns blogs, Typst is taking new-generation note-taking, and MathML <em>should have</em> won browser math but lost to KaTeX. Below is an honest five-way comparison.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-ts">LaTeX</th>
                  <th className="th-js">Word</th>
                  <th className="th-md">Markdown</th>
                  <th className="th-sw">Typst</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="范畴" en="Category" />,
                    ts: <L zh="标记 + 宏 + 引擎栈" en="Markup + macros + engine stack" />,
                    js: <L zh="WYSIWYG 二进制" en="WYSIWYG binary" />,
                    md: <L zh="轻量纯文本标记" en="Lightweight plain-text markup" />,
                    sw: <L zh="现代标记 (Rust 引擎)" en="Modern markup (Rust engine)" /> },
                  { k: <L zh="数学" en="Math" />,
                    ts: <L zh={<><strong>无人能及</strong></>} en={<><strong>Unrivalled</strong></>} />,
                    js: <L zh={<>原生方程编辑器 (一般)</>} en={<>Native equation editor (mediocre)</>} />,
                    md: <L zh="可嵌 $$LaTeX$$" en="Can embed $$LaTeX$$" />,
                    sw: <L zh="一阶公民, 干净语法" en="First-class, clean syntax" /> },
                  { k: <L zh="出身" en="Origin" />,
                    ts: <L zh="Knuth 1978 + Lamport 1985" en="Knuth 1978 + Lamport 1985" />,
                    js: <L zh="Microsoft 1983" en="Microsoft 1983" />,
                    md: <L zh="Gruber 2004" en="Gruber 2004" />,
                    sw: <L zh="Mädje + Haug · ETH 2019" en="Mädje + Haug · ETH 2019" /> },
                  { k: <L zh="纯文本源?" en="Plain-text source?" />,
                    ts: <L zh={<>是 (git 友好)</>} en={<>Yes (git-friendly)</>} />,
                    js: <L zh={<>否 (.docx zip)</>} en={<>No (.docx zip)</>} />,
                    md: <L zh="是" en="Yes" />,
                    sw: <L zh="是" en="Yes" /> },
                  { k: <L zh="编译速度" en="Compile speed" />,
                    ts: <L zh="慢 (多 pass · 5-30s)" en="Slow (multi-pass · 5-30 s)" />,
                    js: <L zh="实时 (WYSIWYG)" en="Real-time (WYSIWYG)" />,
                    md: <L zh={<>实时 (pandoc 1s)</>} en={<>Real-time (pandoc ~1 s)</>} />,
                    sw: <L zh="~100ms" en="~100 ms" /> },
                  { k: <L zh="模板生态" en="Template ecosystem" />,
                    ts: <L zh={<>巨大 (期刊 / 学校 / 简历)</>} en={<>Vast (journals / universities / CVs)</>} />,
                    js: <L zh="官方 + 第三方" en="Official + third-party" />,
                    md: <L zh="无固定模板概念" en="No fixed template concept" />,
                    sw: <L zh="年轻, 增长中" en="Young, growing" /> },
                  { k: <L zh="协作" en="Collaboration" />,
                    ts: <L zh="Overleaf (browser)" en="Overleaf (browser)" />,
                    js: <L zh="Office 365 同步" en="Office 365 sync" />,
                    md: <L zh="git PR" en="git PR" />,
                    sw: <L zh="typst.app 协作" en="typst.app collab" /> },
                  { k: <L zh="期刊接受?" en="Journal acceptance?" />,
                    ts: <L zh={<><strong>默认</strong></>} en={<><strong>Default</strong></>} />,
                    js: <L zh="部分接受" en="Partial" />,
                    md: <L zh="罕见 (走 pandoc → LaTeX)" en="Rare (via pandoc → LaTeX)" />,
                    sw: <L zh={<>2026 期刊还未广泛接受</>} en={<>Not widely accepted as of 2026</>} /> },
                  { k: <L zh="学习曲线" en="Learning curve" />,
                    ts: <L zh={<>陡峭 (但 AI 大幅压平)</>} en={<>Steep (AI flattens it)</>} />,
                    js: <L zh="平 (双击即用)" en="Flat (double-click)" />,
                    md: <L zh="平" en="Flat" />,
                    sw: <L zh="缓 (Markdown 用户友好)" en="Gentle (Markdown-familiar)" /> },
                  { k: <L zh="2026 状态" en="2026 state" />,
                    ts: <L zh={<>事实标准, 不动</>} en={<>De-facto standard, immobile</>} />,
                    js: <L zh="办公 / 法律 / 行政" en="Office / legal / admin" />,
                    md: <L zh={<>博客 / README / Notion</>} en={<>Blogs / READMEs / Notion</>} />,
                    sw: <L zh={<>课堂笔记 / 短论文上升</>} en={<>Classroom notes / short papers rising</>} /> },
                ].map((row, i) => (
                  <tr key={i}>
                    <td>{row.k}</td>
                    <td>{row.ts}</td>
                    <td>{row.js}</td>
                    <td>{row.md}</td>
                    <td>{row.sw}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* 08 Why */}
          <section className="section section-ai" id="why">
            <header className="sec-head">
              <span className="sec-num ai-num">08</span>
              <h2 className="sec-title"><L zh="为何 LaTeX 在 2026" en="Why LaTeX in 2026" /> <code>: WhyLaTeX</code></h2>
              <p className="sec-desc"><L
                zh={<>"LaTeX 老土、Word 够用、Typst 在崛起"——这些都对, 但都<em>不构成换</em>。下面 6 张是 LaTeX 在 2026 年仍不可替代的真正原因, 跟"它最早"无关。</>}
                en={<>"LaTeX is old, Word is fine, Typst is rising" — all true, none of these add up to <em>actually switching</em>. The six cards below are the real reasons LaTeX remains irreplaceable in 2026, none of them "because it came first."</>}
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

            <blockquote className="quote-block">
              <div className="quote-mark">"</div>
              <p className="quote-text"><L
                zh={<>我写 TeX 是因为我<strong>不能忍受看到自己写的书排得难看</strong>。如果你的书排错, 它就背叛了里面的内容。<em>我宁愿花 10 年自己写一套排版系统</em>, 也不愿意把后面 30 卷书交给同样烂的工具。</>}
                en={<>I wrote TeX because I <strong>couldn't stand seeing my own book typeset badly</strong>. A badly typeset book betrays its content. <em>I'd rather spend ten years writing a typesetting system myself</em> than hand the next thirty volumes over to the same broken tools.</>}
              /></p>
              <footer className="quote-footer">
                <span className="quote-author">— Donald Knuth</span>
                <span className="quote-context"><L zh="Stanford · TeX / METAFONT 作者 · 1974 Turing Award · 多次访谈综合" en="Stanford · author of TeX / METAFONT · 1974 Turing Award · composite from interviews" /></span>
              </footer>
            </blockquote>

            <div className="ai-takeaway">
              <p><strong><L zh="一句话总结: " en="In one line: " /></strong><L
                zh={<>LaTeX 在 2026 不是<em>"老技术留着"</em>, 是<strong>"没有更好的"</strong>。AI 抹平了学习曲线, Typst 拿下了短文档, 但<strong>多人协作、数学公式、长论文、跨年份兼容</strong>这四件事的交集, 2026 仍只有 LaTeX 能同时满足。</>}
                en={<>LaTeX in 2026 isn't <em>"legacy that survives"</em> — it's <strong>"nothing better exists"</strong>. AI has flattened the learning curve, Typst has taken short documents, but the intersection of <strong>multi-author collaboration, formula typesetting, long-paper structure, and multi-decade compat</strong> is still satisfied by LaTeX alone.</>}
              /></p>
            </div>
          </section>

          {/* 09 Footguns */}
          <section className="section" id="footguns">
            <header className="sec-head">
              <span className="sec-num">09</span>
              <h2 className="sec-title"><L zh="陷阱" en="Footguns" /> <code>: TheDarkArts</code></h2>
              <p className="sec-desc"><L
                zh={<>LaTeX 不友好——任何写过它的人都同意。下面 6 个是<em>新人 100% 会踩</em>的陷阱; 列出来不是劝退, 是<strong>先知道, 后边遇到时知道往哪查</strong>。</>}
                en={<>LaTeX is unfriendly — anyone who's written it agrees. Six footguns below — <em>every newcomer hits all six</em>. Listed not to scare you off, but so that <strong>when you trip you know where to look</strong>.</>}
              /></p>
            </header>

            <div className="footgun-grid">
              {FOOTGUNS.map((f, i) => (
                <div className="footgun-card" key={i}>
                  <h3>{lang === 'zh' ? f.zh.title : f.en.title}</h3>
                  <p>{lang === 'zh' ? f.zh.body : f.en.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 10 Famous documents */}
          <section className="section" id="famous">
            <header className="sec-head">
              <span className="sec-num">10</span>
              <h2 className="sec-title"><L zh="名作 — 全部走 LaTeX" en="Famous documents — all LaTeX" /> <code>: TheCanon</code></h2>
              <p className="sec-desc"><L
                zh={<>下面这些<em>不是 LaTeX "也能" 排</em>—— 是<strong>世界上不会用别的排</strong>。从 Knuth 自己的 TAOCP 到 Perelman 解 Poincaré 猜想, 到 NeurIPS 全部论文。</>}
                en={<>Below are <em>not works that "could also be" set in LaTeX</em> — they are works <strong>nothing else would ever set</strong>. From Knuth's TAOCP to Perelman's Poincaré conjecture proof to every NeurIPS paper.</>}
              /></p>
            </header>

            <div className="famous-list">
              {FAMOUS.map((f, i) => (
                <div className="famous-row" key={i}>
                  <div className="famous-name">{lang === 'zh' ? f.zhName : f.enName}</div>
                  <div className="famous-desc">{lang === 'zh' ? f.zhDesc : f.enDesc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* 11 Ecosystem */}
          <section className="section" id="projects">
            <header className="sec-head">
              <span className="sec-num">11</span>
              <h2 className="sec-title"><L zh="生态 / 工具 / 引擎" en="Ecosystem / Tools / Engines" /> <code>: TheStack</code></h2>
              <p className="sec-desc"><L
                zh={<>LaTeX 是一个<strong>生态</strong>, 不是一个项目: TUG 母组织, CTAN 包仓, TeX Live / MiKTeX 发行, Overleaf / Tectonic 现代入口, KaTeX / MathJax 网页渲染, arXiv / tex.SE 社区。下面 18 个是 2026 年日常会遇到的核心节点。</>}
                en={<>LaTeX is an <strong>ecosystem</strong>, not a project: TUG as steward, CTAN as archive, TeX Live / MiKTeX as distributions, Overleaf / Tectonic as modern entry points, KaTeX / MathJax for the web, arXiv / tex.SE for community. The 18 nodes below are the daily-touch surface in 2026.</>}
              /></p>
            </header>

            <div className="logo-grid">
              {PROJECTS.map((p, i) => (
                <a key={i} className={`logo-card${p.highlight ? ' highlight' : ''}`} href={p.href} target={p.href.startsWith('/') ? undefined : '_blank'} rel="noopener">
                  {p.svg}
                  <div className="logo-name">{lang === 'zh' ? p.zhName : p.enName}</div>
                  <div className="logo-note">{lang === 'zh' ? p.zhNote : p.enNote}</div>
                </a>
              ))}
            </div>
          </section>

          {/* 12 Future */}
          <section className="section" id="future">
            <header className="sec-head">
              <span className="sec-num">12</span>
              <h2 className="sec-title"><L zh="前景" en="Outlook" /> <code>: TheNext10Years</code></h2>
              <p className="sec-desc"><L
                zh={<>LaTeX 不会被 Typst <em>替代</em>, 也不会在 2030 年消失。下一个 10 年的主线是: <strong>(1)</strong> AI 把学习曲线压平; <strong>(2)</strong> expl3 静默接管包内部; <strong>(3)</strong> Typst 在课堂笔记拿一档; <strong>(4)</strong> LaTeX 在期刊管道底下变成<em>编译目标</em>, 不再是用户层。</>}
                en={<>LaTeX won't be <em>replaced</em> by Typst, nor will it disappear by 2030. The 10-year throughlines: <strong>(1)</strong> AI flattens the learning curve; <strong>(2)</strong> expl3 silently takes over package internals; <strong>(3)</strong> Typst takes a slice of classroom notes; <strong>(4)</strong> LaTeX recedes from the user layer to a <em>compile target</em> beneath journal pipelines.</>}
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
                <li><a href="https://tug.org/" target="_blank" rel="noopener">tug.org</a></li>
                <li><a href="https://ctan.org/" target="_blank" rel="noopener">ctan.org</a></li>
                <li><a href="https://tug.org/texlive/" target="_blank" rel="noopener">TeX Live</a></li>
                <li><a href="https://miktex.org/" target="_blank" rel="noopener">miktex.org</a></li>
                <li><a href="https://www.latex-project.org/" target="_blank" rel="noopener">latex-project.org</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="关键阅读" en="Key Reading" /></h4>
              <ul>
                <li><a href="https://www-cs-faculty.stanford.edu/~knuth/abcde.html" target="_blank" rel="noopener"><L zh="Knuth 个人主页" en="Knuth's home page" /></a></li>
                <li><a href="https://www.lamport.org/" target="_blank" rel="noopener"><L zh="Lamport 个人主页" en="Lamport's home page" /></a></li>
                <li><a href="https://en.wikibooks.org/wiki/LaTeX" target="_blank" rel="noopener">Wikibooks · LaTeX</a></li>
                <li><a href="https://en.wikipedia.org/wiki/The_TeXbook" target="_blank" rel="noopener"><L zh="The TeXbook (Knuth)" en="The TeXbook (Knuth)" /></a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="工具 / 引擎" en="Tools / Engines" /></h4>
              <ul>
                <li><a href="https://www.overleaf.com/" target="_blank" rel="noopener">overleaf.com</a></li>
                <li><a href="https://tectonic-typesetting.github.io/" target="_blank" rel="noopener">tectonic</a></li>
                <li><a href="https://typst.app/" target="_blank" rel="noopener">typst.app</a></li>
                <li><a href="https://tex.stackexchange.com/" target="_blank" rel="noopener">tex.stackexchange.com</a></li>
                <li><a href="https://arxiv.org/" target="_blank" rel="noopener">arxiv.org</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="同站交叉" en="Cross-links" /></h4>
              <ul>
                <li><a href="/code/language/katex"><L zh="KaTeX — 浏览器数学渲染" en="KaTeX — browser math renderer" /></a></li>
                <li><a href="/code/language/html"><L zh="HTML — markup 的兄弟" en="HTML — markup sibling" /></a></li>
                <li><a href="/code/language/css"><L zh="CSS — 表现层" en="CSS — presentation" /></a></li>
                <li><a href="/code/language"><L zh="返回语言索引" en="Back to language index" /></a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo">{LATEX_LOGO_SVG}</div>
              <p className="footer-line"><L zh="单页中文 / English 双语 · 资料截至 2026-05" en="Single-page guide · zh / en · last updated 2026-05" /></p>
              <p className="footer-line dim"><code>{'\\documentclass{article} % typography that won\'t die'}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
