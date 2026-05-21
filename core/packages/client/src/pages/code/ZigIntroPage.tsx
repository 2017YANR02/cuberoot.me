import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LangCtx, L, type Lang } from './_intro/Lang';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import './zig_intro.css';

const ZIG_LOGO_SVG = (
  <svg viewBox="0 0 256 256">
    <rect width="256" height="256" rx="28" fill="#121212" />
    <path
      fill="#F7A41D"
      d="M40 70h60v22l-32 50h32v22H32v-22l32-50H40zm68 0h22v94h-22zm30 0h60v22h-32l32 50v22h-60v-22h32l-32-50z"
    />
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
    year: <>2015<small>·12</small></>,
    zh: { title: <>Andrew Kelley 立项</>, desc: <>12 月，Andrew Kelley 在 GitHub 上提交了 Zig 的第一个 commit。当时他还在写嵌入式音频引擎 GenesisDAW，被 C 的 undefined behavior、宏预处理和 build system 折磨够了，决定动手做一门"配得上 C 的位置"的语言。</> },
    en: { title: <>Andrew Kelley starts Zig</>, desc: <>December: Andrew Kelley pushes the first commit of Zig to GitHub. He was building an embedded audio engine called GenesisDAW at the time and had grown tired of C's undefined behavior, the C preprocessor, and the build system tax — so he set out to design a language "worthy of replacing C."</> },
  },
  {
    year: <>2016<small>·02</small></>,
    zh: { title: <>第一次公开亮相</>, desc: <>Andrew 在 hackaday 类小型聚会上首次公开 Zig 的设计：<strong>no hidden control flow</strong>（没有 RAII、没有异常、没有运算符重载里偷偷分配内存）+ <code>comptime</code>（编译期任意 Zig 代码作元编程）。社区第一反应是"这不就是 better C 吗"——他答："对，就是要做 better C。"</> },
    en: { title: <>First public unveiling</>, desc: <>Andrew first presents Zig at small hackaday-style meetups: <strong>no hidden control flow</strong> (no RAII, no exceptions, no operator-overloaded silent allocations) plus <code>comptime</code> (arbitrary Zig code at compile time as metaprogramming). The room's reaction: "isn't this just better C?" — his answer: "Yes. That's exactly the point."</> },
  },
  {
    year: <>2017<small>·08</small></>,
    zh: { title: <>0.1.0 — 自举编译器</>, desc: <>8 月发布 0.1.0。Zig 编译器最早是 C++ 写的，到这版本基本能"自己编译自己"。同年 Andrew 开始全职做 Zig，靠 Patreon 个人赞助。</> },
    en: { title: <>0.1.0 — self-hosting begins</>, desc: <>0.1.0 ships in August. The Zig compiler started in C++; by this point it could mostly bootstrap itself. The same year Andrew starts working on Zig full-time, funded by Patreon donations from individuals.</> },
  },
  {
    year: <>2019<small>·09</small></>,
    zh: { title: <><code>zig cc</code> 出场</>, desc: <>0.5.0 把 LLVM 的 clang 直接打包进了 <code>zig</code> 二进制里：一句 <code>zig cc</code> 就是一个跨平台 C 编译器，<strong>同时还是个交叉编译工具链</strong>——能从 macOS 一行命令编出 Linux ARM64 二进制。这一招让一大批"我只是想编 C"的人入坑 Zig。</> },
    en: { title: <><code>zig cc</code> arrives</>, desc: <>0.5.0 bundles LLVM clang directly into the <code>zig</code> binary: <code>zig cc</code> is a drop-in cross-platform C compiler — <strong>and a cross-compilation toolchain by default</strong>. One command on macOS produces a Linux ARM64 binary. This single trick recruited a wave of "I just need to compile some C" users to Zig.</> },
  },
  {
    year: <>2020<small>·06</small></>,
    zh: { title: <>ZSF 成立</>, desc: <>Zig Software Foundation 注册为 501(c)(3) 非营利组织。Andrew 出任主席。从此"Zig"不再只是一个 GitHub 仓库——它有银行账户、有理事会、能接受捐款做工资。</> },
    en: { title: <>ZSF founded</>, desc: <>The Zig Software Foundation registers as a US 501(c)(3) non-profit. Andrew becomes its chair. Zig stops being "just a GitHub repo" — it now has a bank account, a board, and the ability to take grants and pay engineers.</> },
  },
  {
    year: '2021',
    zh: { title: <>Bun 启动 — Zig 写 JS runtime</>, desc: <>Stripe 工程师 Jarred Sumner 决定用 Zig 写一个比 Node 更快的 JS runtime——Bun。当时 Zig 还在 0.8 版本号。Jarred 的赌注是："Zig 的 comptime + 与 JavaScriptCore 的 C++ 互操作能力，足以让我两个人写出一个能打 V8/Node 的东西。"</> },
    en: { title: <>Bun begins — a JS runtime in Zig</>, desc: <>Stripe engineer Jarred Sumner decides to write a faster Node.js alternative in Zig: Bun. Zig was at 0.8 then. His bet: "Zig's comptime plus easy C++ interop with JavaScriptCore lets a two-person team build something that competes with V8/Node."</> },
  },
  {
    year: <>2022<small>·07</small></>,
    zh: { title: <>Bun 公开 + TigerBeetle 站台</>, desc: <>7 月 Bun 0.1 公开发布——Twitter 上"<strong>用 Zig 写的 Node 替代品，启动快 3 倍</strong>"瞬间炸开。同年 TigerBeetle（金融级分布式 OLTP 数据库）公开宣布全栈用 Zig。两件事一起，把"Zig 是不是玩具"的疑问按下去了一半。</> },
    en: { title: <>Bun goes public + TigerBeetle endorsement</>, desc: <>July: Bun 0.1 ships publicly — "<strong>a Node alternative written in Zig, 3× faster cold start</strong>" goes viral on Twitter. The same year TigerBeetle (financial-grade distributed OLTP database) announces it's full-stack Zig. Together these silenced half of the "is Zig a toy?" debates.</> },
  },
  {
    year: <>2023<small>·08</small></>,
    zh: { title: <>0.11 — async 暂时拿掉</>, desc: <>0.11 决定把 <code>async</code> / <code>await</code> 关键字从语言里<strong>暂时移除</strong>——团队承认上一版的 stackless coroutine 设计有问题，宁可砍掉也不带病发 1.0。这个决定在社区引发巨大讨论："一个语言敢公开承认设计错了"。</> },
    en: { title: <>0.11 — async temporarily removed</>, desc: <>0.11 <strong>removes</strong> the <code>async</code> / <code>await</code> keywords from the language: the team admits the previous stackless-coroutine design was flawed and would rather cut it than ship it broken to 1.0. The community split — but admiration won out: "a language willing to publicly say its own design was wrong."</> },
  },
  {
    year: <>2024<small>·09</small></>,
    zh: { title: <>Ghostty 1.0 公开</>, desc: <>Mitchell Hashimoto（HashiCorp / Terraform 创始人）公开他用 Zig 默默写了三年的终端模拟器 <strong>Ghostty</strong>。原生 macOS / Linux GUI、GPU 加速、配置即代码。HN 一夜热搜。Mitchell 的话："Zig 让我可以在 macOS 用 Apple framework，同时在 Linux 用 GTK，同一个核心。"</> },
    en: { title: <>Ghostty 1.0 made public</>, desc: <>Mitchell Hashimoto (founder of HashiCorp / Terraform) reveals <strong>Ghostty</strong>, a terminal emulator he had quietly built in Zig over three years. Native macOS / Linux GUI, GPU-accelerated, config-as-code. The HN front page exploded. Mitchell: "Zig lets me share one core between Apple frameworks on macOS and GTK on Linux."</> },
  },
  {
    year: <>2025<small>·10</small></>,
    zh: { title: <>Synadia + TigerBeetle 捐 $512K</>, desc: <>Synadia（NATS 背后的公司）和 TigerBeetle 联手向 Zig Software Foundation 承诺两年 $512,000 资助。这是 ZSF 最大的一笔产业捐款——意味着 Zig 不再靠"几个人 Patreon 续命"，而是有了能撑起核心团队工资的现金流。</> },
    en: { title: <>Synadia + TigerBeetle pledge $512K</>, desc: <>Synadia (the company behind NATS) and TigerBeetle jointly pledge $512,000 to the Zig Software Foundation over two years. The largest industry donation ZSF has ever received — signaling Zig isn't surviving on individual Patreon any more; it has cash flow to pay a real core team.</> },
  },
  {
    year: <>2025<small>·11</small></>, highlight: true,
    zh: { title: <>Bun 被 Anthropic 收购</>, desc: <>Anthropic 收购 Bun。Jarred Sumner 加入 Anthropic，Bun 在 Claude Code 这条线里继续投入。这是 Zig 写出来的项目第一次成为大型 AI 公司的核心基础设施。</> },
    en: { title: <>Anthropic acquires Bun</>, desc: <>Anthropic acquires Bun. Jarred Sumner joins Anthropic; Bun continues development as part of the Claude Code stack. The first time a Zig-built project becomes core infrastructure inside a major AI company.</> },
  },
  {
    year: <>2026<small>·04</small></>, highlight: true,
    zh: { title: <>0.16 发布 · 仍未 1.0</>, desc: <>4 月 14 日发布 0.16.0。Zig 仍处于 pre-1.0：依然每个版本都允许 breaking change，但语言核心已经趋稳。1.0 路线图明确：先把新 IO 模型 / async 重做 / 包管理器 / self-hosted backend 这几件大事做完——团队宁可慢，也不要带病发 1.0。</> },
    en: { title: <>0.16 ships — still pre-1.0</>, desc: <>April 14: 0.16.0 ships. Zig remains pre-1.0: breaking changes allowed every release, but the core language has stabilized. The 1.0 roadmap is now explicit — finish the new IO model, the async rework, the package manager, and the self-hosted backend first. The team would rather be late than ship a flawed 1.0.</> },
  },
];

interface ZigCard {
  tag: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const ZIG_CARDS: ZigCard[] = [
  {
    tag: 'A',
    zh: { title: <><code>comptime</code> 元编程</>, desc: <>编译期可以跑<strong>任意 Zig 代码</strong>。泛型 / 反射 / 模板，全部用同一份语法表达——没有第二套元语言。</> },
    en: { title: <><code>comptime</code> metaprogramming</>, desc: <>Run <strong>arbitrary Zig code at compile time</strong>. Generics, reflection, templates — all expressed in one syntax. No second meta-language.</> },
    code: (
      <code>
        <span className="cl-k">fn</span> <span className="cl-fn">List</span>(<span className="cl-k">comptime</span> <span className="cl-v">T</span>: <span className="cl-type">type</span>) <span className="cl-type">type</span> {'{'}{'\n'}
        {'  '}<span className="cl-k">return</span> <span className="cl-k">struct</span> {'{'}{'\n'}
        {'    '}<span className="cl-prop">items</span>: []<span className="cl-v">T</span>,{'\n'}
        {'    '}<span className="cl-prop">len</span>: <span className="cl-type">usize</span>,{'\n'}
        {'  '}{'};'}{'\n'}
        {'}'}{'\n\n'}
        <span className="cl-k">const</span> <span className="cl-v">L</span> = <span className="cl-fn">List</span>(<span className="cl-type">u32</span>);{'\n'}
        <span className="cl-c">// L is a struct type, generated at compile time</span>
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <>错误联合 <code>!T</code></>, desc: <>错误是<strong>类型系统的一部分</strong>，没有异常、没有零成本陷阱。每个可能失败的函数返回 <code>!T</code>。</> },
    en: { title: <>Error union <code>!T</code></>, desc: <>Errors are <strong>part of the type system</strong>. No exceptions, no hidden traps. Any fallible function returns <code>!T</code>.</> },
    code: (
      <code>
        <span className="cl-k">fn</span> <span className="cl-fn">parseInt</span>(<span className="cl-v">s</span>: []<span className="cl-k">const</span> <span className="cl-type">u8</span>) <span className="cl-err">!</span><span className="cl-type">u32</span> {'{'}{'\n'}
        {'  '}<span className="cl-k">if</span> (<span className="cl-v">s</span>.<span className="cl-prop">len</span> == <span className="cl-n">0</span>) <span className="cl-k">return</span> <span className="cl-err">error</span>.<span className="cl-type">Empty</span>;{'\n'}
        {'  '}<span className="cl-k">return</span> <span className="cl-fn">@intFromString</span>(<span className="cl-v">s</span>);{'\n'}
        {'}'}{'\n\n'}
        <span className="cl-k">const</span> <span className="cl-v">n</span> = <span className="cl-k">try</span> <span className="cl-fn">parseInt</span>(<span className="cl-s">"42"</span>);{'\n'}
        <span className="cl-c">// `try` unwraps or propagates the error</span>
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <><code>defer</code> / <code>errdefer</code></>, desc: <>不靠析构函数。资源清理在调用点显式声明。<code>errdefer</code> 只在<strong>错误路径</strong>跑——优雅处理"半构造"。</> },
    en: { title: <><code>defer</code> / <code>errdefer</code></>, desc: <>No destructors. Cleanup is declared explicitly at the call site. <code>errdefer</code> runs <strong>only on the error path</strong> — graceful "half-constructed" handling.</> },
    code: (
      <code>
        <span className="cl-k">const</span> <span className="cl-v">file</span> = <span className="cl-k">try</span> <span className="cl-fn">open</span>(<span className="cl-s">"x.txt"</span>);{'\n'}
        <span className="cl-k">defer</span> <span className="cl-v">file</span>.<span className="cl-fn">close</span>();{'\n\n'}
        <span className="cl-k">const</span> <span className="cl-v">buf</span> = <span className="cl-k">try</span> <span className="cl-v">alloc</span>.<span className="cl-fn">alloc</span>(<span className="cl-type">u8</span>, <span className="cl-n">1024</span>);{'\n'}
        <span className="cl-k">errdefer</span> <span className="cl-v">alloc</span>.<span className="cl-fn">free</span>(<span className="cl-v">buf</span>);{'\n'}
        <span className="cl-c">// freed only if the rest fails</span>
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <>显式分配器</>, desc: <>没有"内置堆"。<strong>每个会分配的函数都接 <code>Allocator</code> 参数</strong>——arena / GP / page / fixed buffer 任你选，谁分配谁负责。</> },
    en: { title: <>Explicit allocators</>, desc: <>No built-in heap. <strong>Every allocating function takes an <code>Allocator</code> parameter</strong> — arena / GP / page / fixed-buffer, your call. The caller owns the policy.</> },
    code: (
      <code>
        <span className="cl-k">var</span> <span className="cl-v">gpa</span> = <span className="cl-fn">std</span>.<span className="cl-fn">heap</span>.<span className="cl-type">GeneralPurposeAllocator</span>(.{'{}'}){'{}'};{'\n'}
        <span className="cl-k">defer</span> _ = <span className="cl-v">gpa</span>.<span className="cl-fn">deinit</span>();{'\n'}
        <span className="cl-k">const</span> <span className="cl-v">alloc</span> = <span className="cl-v">gpa</span>.<span className="cl-fn">allocator</span>();{'\n\n'}
        <span className="cl-k">const</span> <span className="cl-v">list</span> = <span className="cl-k">try</span> <span className="cl-fn">std</span>.<span className="cl-fn">ArrayList</span>(<span className="cl-type">u32</span>).<span className="cl-fn">init</span>(<span className="cl-v">alloc</span>);{'\n'}
        <span className="cl-c">// allocator is a value, not a global</span>
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <>无隐藏控制流</>, desc: <>看到一个调用就是一个调用——<strong>没有析构、没有异常、没有运算符重载</strong>。读源码所见即所得。</> },
    en: { title: <>No hidden control flow</>, desc: <>A call is a call — <strong>no destructors, no exceptions, no operator overloads</strong>. What you read is what runs.</> },
    code: (
      <code>
        <span className="cl-c">// Zig: a + b is integer add. Period.</span>{'\n'}
        <span className="cl-k">const</span> <span className="cl-v">c</span> = <span className="cl-v">a</span> + <span className="cl-v">b</span>;{'\n\n'}
        <span className="cl-c">// C++: a + b might call op+ which</span>{'\n'}
        <span className="cl-c">// might allocate, throw, log, or worse.</span>{'\n\n'}
        <span className="cl-c">// Zig allocations are always literally:</span>{'\n'}
        <span className="cl-k">try</span> <span className="cl-v">alloc</span>.<span className="cl-fn">create</span>(<span className="cl-type">T</span>)
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <><code>@cImport</code> + <code>zig cc</code></>, desc: <>Zig 直接吃 C 头文件。<code>zig cc</code> 还顺手是个跨平台 C 工具链——<strong>一行命令把 macOS 上的代码编成 Linux ARM64</strong>。</> },
    en: { title: <><code>@cImport</code> + <code>zig cc</code></>, desc: <>Zig consumes C headers directly. <code>zig cc</code> is also a cross-platform C toolchain — <strong>compile a macOS source to Linux ARM64 in one command</strong>.</> },
    code: (
      <code>
        <span className="cl-k">const</span> <span className="cl-v">c</span> = <span className="cl-fn">@cImport</span>({'{'}{'\n'}
        {'  '}<span className="cl-fn">@cInclude</span>(<span className="cl-s">"sqlite3.h"</span>);{'\n'}
        {'}'});{'\n\n'}
        <span className="cl-k">var</span> <span className="cl-v">db</span>: ?*<span className="cl-v">c</span>.<span className="cl-type">sqlite3</span> = <span className="cl-k">null</span>;{'\n'}
        _ = <span className="cl-v">c</span>.<span className="cl-fn">sqlite3_open</span>(<span className="cl-s">"x.db"</span>, &<span className="cl-v">db</span>);{'\n\n'}
        <span className="cl-c">// shell:</span>{'\n'}
        <span className="cl-c">// zig build-exe x.zig -target aarch64-linux</span>
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <><code>packed struct</code> + bit-fields</>, desc: <>没有 C 那种"实现定义对齐"。<code>packed struct</code> 给你<strong>位精确的内存布局</strong>，写网络协议 / 硬件寄存器再合适不过。</> },
    en: { title: <><code>packed struct</code> + bit fields</>, desc: <>No C-style "implementation-defined" alignment. <code>packed struct</code> gives you <strong>bit-exact memory layout</strong> — perfect for network protocols and hardware registers.</> },
    code: (
      <code>
        <span className="cl-k">const</span> <span className="cl-type">RGB</span> = <span className="cl-k">packed struct</span> {'{'}{'\n'}
        {'  '}<span className="cl-prop">r</span>: <span className="cl-type">u5</span>,{'\n'}
        {'  '}<span className="cl-prop">g</span>: <span className="cl-type">u6</span>,{'\n'}
        {'  '}<span className="cl-prop">b</span>: <span className="cl-type">u5</span>,{'\n'}
        {'};'}  <span className="cl-c">// exactly 16 bits</span>{'\n\n'}
        <span className="cl-k">const</span> <span className="cl-v">px</span> = <span className="cl-type">RGB</span>{'{ '}.<span className="cl-prop">r</span> = <span className="cl-n">31</span>, .<span className="cl-prop">g</span> = <span className="cl-n">0</span>, .<span className="cl-prop">b</span> = <span className="cl-n">0</span> {'};'}
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
    icon: '⌁',
    zh: { title: <>没有隐藏分配</>, desc: <>看一行代码就知道它会不会分配内存。任何分配都通过显式 <code>Allocator</code> 走——<strong>性能事故没有藏身之处</strong>。</> },
    en: { title: <>No hidden allocations</>, desc: <>Read one line and you know if it allocates. All allocations route through an explicit <code>Allocator</code> — <strong>perf incidents have nowhere to hide</strong>.</> },
    code: <><span className="cl-k">const</span> <span className="cl-v">x</span> = <span className="cl-k">try</span> <span className="cl-v">alloc</span>.<span className="cl-fn">create</span>(<span className="cl-type">T</span>);{'\n'}<span className="cl-c">// allocations are always visible</span></>,
  },
  {
    icon: '⎇',
    zh: { title: <>读得懂的源码</>, desc: <>没有析构 / 没有异常 / 没有运算符重载 / 没有预处理器。一段 Zig 代码在你眼里跑的路径，就是 CPU 实际跑的路径。</> },
    en: { title: <>Source you can actually read</>, desc: <>No destructors, no exceptions, no operator overloading, no preprocessor. The control flow you read is the control flow the CPU executes.</> },
    code: <><span className="cl-c">// what you see = what runs</span>{'\n'}<span className="cl-k">defer</span> <span className="cl-v">file</span>.<span className="cl-fn">close</span>();{'\n'}<span className="cl-c">// no surprise hooks</span></>,
  },
  {
    icon: '⛯',
    zh: { title: <><code>comptime</code> 一统泛型 + 反射</>, desc: <>不需要"模板语法"或"trait"两套元语言。<code>comptime</code> 时跑普通 Zig 代码就生成类型 / 校验形状 / 内联表。元编程从未这么直白。</> },
    en: { title: <><code>comptime</code> unifies generics + reflection</>, desc: <>No second meta-language for templates or traits. <code>comptime</code> just runs ordinary Zig code to generate types, validate shapes, build tables. Metaprogramming has never been this readable.</> },
    code: <><span className="cl-k">comptime</span> <span className="cl-k">var</span> <span className="cl-v">i</span>: <span className="cl-type">u8</span> = <span className="cl-n">0</span>;{'\n'}<span className="cl-k">inline</span> <span className="cl-k">while</span> (<span className="cl-v">i</span> &lt; <span className="cl-n">8</span>) : (<span className="cl-v">i</span> += <span className="cl-n">1</span>) {'{ ... }'}</>,
  },
  {
    icon: '⚙',
    zh: { title: <>跨编译开箱即用</>, desc: <><code>zig build-exe x.zig -target aarch64-linux</code>。Zig 把 LLVM + libc 都打包了——<strong>不需要装 sysroot、不需要装交叉链工具</strong>。Bun 部署 docker 镜像就靠这个。</> },
    en: { title: <>Cross-compilation out of the box</>, desc: <><code>zig build-exe x.zig -target aarch64-linux</code>. Zig bundles LLVM and libc — <strong>no sysroot, no cross-toolchain install</strong>. Bun ships its docker images this way.</> },
    code: <>$ zig build-exe app.zig{'\n'}{'  '}<span className="cl-c">--target=aarch64-linux</span>{'\n'}<span className="cl-c">// done. zero extra setup</span></>,
  },
  {
    icon: '⌬',
    zh: { title: <>错误是值，不是异常</>, desc: <><code>!T</code> 把"可能失败"标在签名里。调用者要么 <code>try</code> 传播，要么 <code>catch</code> 处理——<strong>编译器不会让你忘记</strong>。</> },
    en: { title: <>Errors are values, not exceptions</>, desc: <><code>!T</code> marks fallibility in the signature. The caller either <code>try</code>s to propagate or <code>catch</code>es to handle — <strong>the compiler won't let you forget</strong>.</> },
    code: <><span className="cl-k">const</span> <span className="cl-v">v</span> = <span className="cl-fn">parse</span>(<span className="cl-v">s</span>) <span className="cl-k">catch</span> <span className="cl-n">0</span>;{'\n'}<span className="cl-c">// or `try parse(s)` to propagate</span></>,
  },
  {
    icon: '⌖',
    zh: { title: <>对 C 的尊重</>, desc: <>Zig 设计目标是"C 的位置"，不是"C 的批判"。<code>@cImport</code> 直吃 C 头文件、<code>zig cc</code> 比 GCC 还省心。<strong>Zig 是 C 的盟友，不是敌人</strong>。</> },
    en: { title: <>Respect for C</>, desc: <>Zig aims to fill C's role, not preach against it. <code>@cImport</code> reads C headers natively; <code>zig cc</code> beats GCC on UX. <strong>Zig is C's ally, not its rival.</strong></> },
    code: <><span className="cl-k">const</span> <span className="cl-v">c</span> = <span className="cl-fn">@cImport</span>({'{'}{'\n'}{'  '}<span className="cl-fn">@cInclude</span>(<span className="cl-s">"png.h"</span>);{'\n'}{'}'});{'\n'}<span className="cl-c">// C headers, zero glue</span></>,
  },
  {
    icon: '⌗',
    zh: { title: <>适合写关键路径</>, desc: <>TigerBeetle 把金融级 OLTP 数据库赌在 Zig 上、Bun 把 100k+ 用户的 JS runtime 赌在 Zig 上、Ghostty 把跨平台 GUI 终端赌在 Zig 上。<strong>都没翻车</strong>。</> },
    en: { title: <>Built for critical paths</>, desc: <>TigerBeetle bet a financial-grade OLTP DB on Zig. Bun bet a 100k+-user JS runtime on Zig. Ghostty bet a cross-platform GUI terminal on Zig. <strong>None of them blew up</strong>.</> },
    code: <><span className="cl-c">// TigerBeetle: 100% Zig</span>{'\n'}<span className="cl-c">// Bun: ~770k LoC Zig</span>{'\n'}<span className="cl-c">// Ghostty: ~140k LoC Zig</span></>,
  },
  {
    icon: '⏚',
    zh: { title: <>构建系统也是 Zig</>, desc: <><code>build.zig</code> 不是 Make / CMake / Bazel——<strong>就是 Zig 代码</strong>。同一种语法、同一种类型系统，从源码到 build graph 没有第二套语言。</> },
    en: { title: <>Build system is also Zig</>, desc: <><code>build.zig</code> is not Make, CMake, or Bazel — <strong>it's just Zig code</strong>. One syntax, one type system, source to build graph with no second language.</> },
    code: <><span className="cl-c">// build.zig</span>{'\n'}<span className="cl-k">pub fn</span> <span className="cl-fn">build</span>(<span className="cl-v">b</span>: *<span className="cl-fn">std</span>.<span className="cl-type">Build</span>) <span className="cl-k">void</span> {'{ ... }'}</>,
  },
  {
    icon: '⚐',
    zh: { title: <>没有 1.0 也撑起了生态</>, desc: <>Zig 还在 0.16，还允许每个版本 breaking change。即使如此，Bun / TigerBeetle / Ghostty / Roc / pg_turso / mach 等一打项目跑在生产里。<strong>稳定性靠的是工程纪律，不是版本号</strong>。</> },
    en: { title: <>An ecosystem before 1.0</>, desc: <>Zig is at 0.16, still allowing breaking changes per release. Yet Bun / TigerBeetle / Ghostty / Roc / pg_turso / mach run in production today. <strong>Stability comes from engineering discipline, not a version label.</strong></> },
    code: <><span className="cl-c">// 0.16 (2026-04)</span>{'\n'}<span className="cl-c">// 1.0 — when it's ready, not before</span></>,
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
    href: 'https://bun.com', highlight: true,
    zhName: 'Bun', enName: 'Bun',
    zhNote: 'JS runtime · 全 Zig · Anthropic', enNote: 'JS runtime · all Zig · Anthropic',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#FBF0DF"/><ellipse cx="50" cy="58" rx="32" ry="28" fill="#F9E5C0"/><circle cx="40" cy="48" r="3" fill="#000"/><circle cx="60" cy="48" r="3" fill="#000"/><path d="M40 62 Q50 70 60 62" stroke="#000" strokeWidth="2" fill="none"/></svg>,
  },
  {
    href: 'https://tigerbeetle.com', highlight: true,
    zhName: 'TigerBeetle', enName: 'TigerBeetle',
    zhNote: '金融级 OLTP DB · 全 Zig', enNote: 'Financial OLTP DB · all Zig',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="10" y="20" width="80" height="60" rx="6" fill="#F7A41D"/><path d="M20 30 L30 30 M40 30 L60 30 M70 30 L80 30 M20 50 L80 50 M20 70 L40 70 M50 70 L80 70" stroke="#000" strokeWidth="3"/></svg>,
  },
  {
    href: 'https://ghostty.org', highlight: true,
    zhName: 'Ghostty', enName: 'Ghostty',
    zhNote: '跨平台终端 · Mitchell Hashimoto', enNote: 'Cross-platform terminal · M. Hashimoto',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M20 20 H80 V70 L70 80 L60 70 L50 80 L40 70 L30 80 L20 70 Z" fill="#fff"/><circle cx="40" cy="42" r="4" fill="#000"/><circle cx="60" cy="42" r="4" fill="#000"/></svg>,
  },
  {
    href: 'https://github.com/roc-lang/roc',
    zhName: 'Roc', enName: 'Roc',
    zhNote: '函数式语言 · 编译器用 Zig', enNote: 'Functional lang · compiler in Zig',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="40" fill="#7C59DC"/><path d="M30 70 Q50 30 70 70 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://github.com/hexops/mach',
    zhName: 'mach', enName: 'mach',
    zhNote: 'Zig 游戏引擎 + GPU 框架', enNote: 'Zig game engine + GPU framework',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><polygon points="50,10 85,30 85,70 50,90 15,70 15,30" fill="#247EE8"/><polygon points="50,28 70,40 70,60 50,72 30,60 30,40" fill="#fff"/></svg>,
  },
  {
    href: 'https://github.com/oven-sh/bun',
    zhName: 'Claude Code', enName: 'Claude Code',
    zhNote: 'Bun runtime 是它的下层', enNote: 'Runs on Bun (Zig) underneath',
    highlight: true,
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#D97757"/><path d="M28 65 L42 30 H50 L36 65 Z M50 30 H58 L72 65 H64 Z M44 52 H56 L52 42 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://github.com/tursodatabase/limbo',
    zhName: 'Turso / Limbo', enName: 'Turso / Limbo',
    zhNote: 'SQLite 兼容 DB · Rust+Zig', enNote: 'SQLite-compat DB · Rust+Zig',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="40" fill="#1ABC9C"/><path d="M30 50 Q50 30 70 50 Q50 70 30 50 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://uber.com',
    zhName: 'Uber', enName: 'Uber',
    zhNote: '内部用 zig cc 替代 GCC', enNote: 'Uses zig cc to replace GCC internally',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="10" y="10" width="80" height="80" rx="6" fill="#000"/><path d="M30 40 H70 V60 H30 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://www.synadia.com',
    zhName: 'Synadia / NATS', enName: 'Synadia / NATS',
    zhNote: '消息系统 · ZSF 大金主', enNote: 'Messaging · top ZSF donor',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="40" fill="#27AAE1"/><circle cx="50" cy="50" r="20" fill="#fff"/><circle cx="50" cy="50" r="6" fill="#27AAE1"/></svg>,
  },
  {
    href: 'https://ziglang.org',
    zhName: 'Zig (self-host)', enName: 'Zig (self-host)',
    zhNote: 'Zig 编译器 · Zig 写的', enNote: 'The Zig compiler, in Zig',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="12" fill="#121212"/><path d="M18 28h26v8l-14 22h14v8H14v-8l14-22h-10zm30 0h10v40h-10zm14 0h26v8h-14l14 22v8H62v-8h14l-14-22z" fill="#F7A41D"/></svg>,
  },
  {
    href: 'https://github.com/karlseguin/http.zig',
    zhName: 'http.zig', enName: 'http.zig',
    zhNote: 'Zig 生态高性能 HTTP 框架', enNote: 'High-perf HTTP framework in Zig',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="40" fill="#F7A41D"/><text x="50" y="58" fontFamily="monospace" fontSize="22" fontWeight="700" textAnchor="middle" fill="#121212">http</text></svg>,
  },
  {
    href: 'https://ziglang.org/zsf/',
    zhName: 'ZSF', enName: 'ZSF',
    zhNote: 'Zig Software Foundation', enNote: 'Zig Software Foundation',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="10" y="20" width="80" height="60" rx="8" fill="#121212"/><text x="50" y="60" fontFamily="monospace" fontSize="22" fontWeight="700" textAnchor="middle" fill="#F7A41D">ZSF</text></svg>,
  },
];

interface NotableUser { name: string; zhDesc: string; enDesc: string }
const NOTABLE_USERS: NotableUser[] = [
  { name: 'Bun',            zhDesc: 'JS/TS runtime · ~770k 行 Zig', enDesc: 'JS/TS runtime · ~770k LoC Zig' },
  { name: 'TigerBeetle',    zhDesc: '金融 OLTP DB · 全 Zig', enDesc: 'Financial OLTP DB · 100% Zig' },
  { name: 'Ghostty',        zhDesc: 'Mitchell H. 终端模拟器', enDesc: 'M. Hashimoto terminal emulator' },
  { name: 'Roc',            zhDesc: '函数式语言 · 编译器 Zig', enDesc: 'Functional lang · compiler in Zig' },
  { name: 'mach',           zhDesc: 'Zig 游戏 / GPU 框架', enDesc: 'Zig game / GPU framework' },
  { name: 'Limbo (Turso)',  zhDesc: 'SQLite 兼容引擎重写', enDesc: 'SQLite-compatible rewrite' },
  { name: 'pg_turso',       zhDesc: 'Postgres extension · Zig', enDesc: 'Postgres extension · Zig' },
  { name: 'http.zig',       zhDesc: '社区高性能 HTTP 库', enDesc: 'High-perf community HTTP lib' },
  { name: 'zls',            zhDesc: 'Zig Language Server', enDesc: 'Zig Language Server' },
  { name: 'Uber',           zhDesc: '用 zig cc 替代 GCC 跨编', enDesc: 'Uses zig cc as cross-toolchain' },
  { name: 'River',          zhDesc: 'Wayland tile compositor · Zig', enDesc: 'Wayland tile compositor · Zig' },
  { name: 'Buzz',           zhDesc: '动态语言 · VM 用 Zig', enDesc: 'Dynamic lang · VM in Zig' },
  { name: 'Capy',           zhDesc: 'Zig 跨平台 GUI 库', enDesc: 'Zig cross-platform GUI lib' },
  { name: 'zigly',          zhDesc: 'Fastly Compute@Edge SDK', enDesc: 'Fastly Compute@Edge SDK' },
  { name: 'TLS in Zig',     zhDesc: 'Bun 自实现 TLS 栈', enDesc: 'Bun rolls its own TLS stack' },
  { name: 'libghostty',     zhDesc: '从 Ghostty 抽出的复用模块', enDesc: 'Reusable Ghostty terminal core' },
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
    tag: <>HOT · 2026-04</>, hot: true, big: true,
    zh: {
      title: <>0.16 后的 1.0 路线</>,
      body: (<>
        <p>2026-04 发布的 0.16 是 Andrew 公开承诺"奔 1.0"的版本。剩下的硬骨头：<strong>新 IO 模型</strong>（统一 sync / async）、<strong>self-hosted backend</strong>（甩开 LLVM 强依赖）、<strong>包管理器收尾</strong>。团队的话："1.0 不是抢时间，是兑现承诺。"</p>
        <p>对比 Rust 当年从 0.x 到 1.0 用了 5 年，Zig 已经走了 11 年。但代价是 Zig 1.0 那一刻，<strong>所有"能碰生产"的设计都已经被生产打过补丁</strong>——而不是发布后再追着改。</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">Zig 0.1 → 0.16</span><span className="bar-val">11 yrs</span></div>
          <div className="bar bar-new"><span className="bar-label">Rust 0.1 → 1.0</span><span className="bar-val">5 yrs</span></div>
        </div>
      </>),
    },
    en: {
      title: <>The road from 0.16 to 1.0</>,
      body: (<>
        <p>0.16 (April 2026) is the version where Andrew publicly committed to driving toward 1.0. Remaining hard problems: a <strong>new unified IO model</strong> (sync / async on one substrate), a <strong>self-hosted backend</strong> (kicking the hard LLVM dependency), and <strong>finishing the package manager</strong>. The team's line: "1.0 isn't about hitting a deadline, it's about delivering a promise."</p>
        <p>Rust took 5 years from 0.x to 1.0; Zig has spent 11. The trade-off is that by the moment Zig hits 1.0, <strong>every production-touching design has already been beaten on by production</strong> — not patched after the fact.</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">Zig 0.1 → 0.16</span><span className="bar-val">11 yrs</span></div>
          <div className="bar bar-new"><span className="bar-label">Rust 0.1 → 1.0</span><span className="bar-val">5 yrs</span></div>
        </div>
      </>),
    },
  },
  {
    tag: 'IO',
    zh: { title: <>新 IO 模型</>, body: <><p>2024 砍掉 <code>async</code> 后团队回炉重造。新方案：把 IO 抽象成"<strong>每个函数都接 Io 参数</strong>"，类似 Allocator 那一套——同一份业务代码可以跑在阻塞 / 非阻塞 / 协程任意调度上。激进，但思路一致。</p></> },
    en: { title: <>The new IO model</>, body: <><p>After cutting <code>async</code> in 2024, the team went back to the drawing board. The new design: every function takes an <strong>Io parameter</strong> — exactly like Allocator. The same business logic runs on blocking, non-blocking, or coroutine schedulers, picked at the call site. Radical, but consistent with the language's grain.</p></> },
  },
  {
    tag: 'BACKEND',
    zh: { title: <>self-hosted backend</>, body: <><p>当前 Zig release-mode 还得过 LLVM。团队在写自己的 x86_64 / aarch64 backend——目标是 debug build 不依赖 LLVM，<strong>编译速度比 LLVM 路径快一个数量级</strong>。开发体验直接拉满。</p></> },
    en: { title: <>Self-hosted backend</>, body: <><p>Today release-mode Zig still goes through LLVM. The team is writing native x86_64 / aarch64 backends — debug builds will skip LLVM entirely and compile <strong>an order of magnitude faster</strong>. A massive dev-loop win.</p></> },
  },
  {
    tag: 'BUN',
    zh: { title: <>Bun · Anthropic 之后</>, body: <><p>2025-11 Bun 被 Anthropic 收购。Jarred Sumner 加入。Bun 在 Claude Code 这条线上继续投入——也就是说，<strong>Anthropic 的 AI 工具栈底层跑的是 Zig</strong>。同时 Bun 团队公开了一份 Zig→Rust 实验性 port，但 Jarred 的话："还远没决定，我们只是在试。"</p></> },
    en: { title: <>Bun · post-Anthropic</>, body: <><p>November 2025: Anthropic acquires Bun. Jarred Sumner joins. Bun keeps shipping inside Claude Code's stack — meaning <strong>Anthropic's AI tool chain has Zig in the basement</strong>. The Bun team also pushed an experimental Zig→Rust port; Jarred's line: "we haven't decided. We're just trying."</p></> },
  },
  {
    tag: 'FUNDING',
    zh: { title: <>$512K + ZSF 工资单</>, body: <><p>2025-10 Synadia + TigerBeetle 联合捐 $512K。叠加之前 Bun / 个人 Patreon 的稳定流入，ZSF 现在能<strong>独立支付一支核心团队的工资</strong>，不再靠"Andrew 一个人撑场"。语言治理第一次真正机构化。</p></> },
    en: { title: <>$512K + the ZSF payroll</>, body: <><p>October 2025: Synadia + TigerBeetle pledge $512K. Stacked on top of Bun and Patreon, ZSF now <strong>pays a real core team</strong> rather than relying on "Andrew alone." Governance has crossed into institutional territory.</p></> },
  },
  {
    tag: 'AI',
    zh: { title: <>AI 时代的"读得懂"</>, body: <><p>LLM 写代码的时代，Zig 的"无隐藏控制流"反而成了优势：模型读 Zig 不用脑补"这里其实析构了"或"这里其实抛了"。生成的代码<strong>更接近真正会跑的代码</strong>。Andrew 没把这件事拿去营销，但社区在传：Zig 是 LLM-friendly 的系统语言。</p></> },
    en: { title: <>"Readable" in the AI era</>, body: <><p>In the era of LLM-written code, Zig's "no hidden control flow" turns out to be an asset: a model reading Zig doesn't have to imagine "this implicitly destructs" or "this might throw." The code <strong>looks like what runs</strong>. Andrew hasn't marketed this; the community has — Zig as an LLM-friendly systems language.</p></> },
  },
];

export default function ZigIntroPage() {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const rootRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(
    'Zig : C — 给系统编程换个零隐藏的地基',
    'Zig : C — A No-Hidden-Control-Flow Foundation for Systems',
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
      '.tl-item, .why-card, .def-card, .logo-card, .future-card, .bar, .compare-col, .cmp-table tr, .ts-card, .ai-stat, .ai-tool, .spotlight, .ai-reverse, .ai-takeaway, .quote-block'
    );
    targets.forEach((el) => { el.classList.add('fade-up'); io.observe(el); });

    root.querySelectorAll<HTMLElement>('.tl-item').forEach((el, i) => { el.style.transitionDelay = `${Math.min(i * 60, 400)}ms`; });
    root.querySelectorAll<HTMLElement>('.why-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 80}ms`; });
    root.querySelectorAll<HTMLElement>('.logo-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 6) * 60}ms`; });
    root.querySelectorAll<HTMLElement>('.ts-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; });
    root.querySelectorAll<HTMLElement>('.ai-tool').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 50}ms`; });

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
        a.style.color = a.getAttribute('href') === '#' + cur ? 'var(--zig-bright)' : '';
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
      <div ref={rootRef} className="zig-intro-root">
        <div className="grid-bg" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            <svg viewBox="0 0 256 256" width="28" height="28">
              <rect width="256" height="256" rx="28" fill="#121212" />
              <path fill="#F7A41D" d="M40 70h60v22l-32 50h32v22H32v-22l32-50H40zm68 0h22v94h-22zm30 0h60v22h-32l32 50v22h-60v-22h32l-32-50z" />
            </svg>
            <span>Zig</span>
            <span className="nav-tag"><L zh=": 中文导览" en=": Guide" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#system"><L zh="精要" en="Essentials" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#projects"><L zh="谁用" en="Adopters" /></a></li>
            <li><a href="#ai"><L zh="Bun 时代" en="Bun Era" /></a></li>
            <li><a href="#vs"><L zh="对比" en="vs Rust/C" /></a></li>
            <li><a href="#future"><L zh="前景" en="Outlook" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 2015 — 2026 · Andrew Kelley · Zig Software Foundation</div>
            <h1 className="hero-title">
              <span className="hero-name">Zig</span>
              <span className="hero-colon">:</span>
              <span className="hero-type">C</span>
            </h1>
            <p className="hero-sub">
              <L
                zh={<>给"系统编程"换一块没有<strong>隐藏控制流</strong>的地基。没有析构、没有异常、没有运算符重载、没有预处理器——你看见什么，CPU 就跑什么。十一年没到 1.0，却已经撑起 Bun / TigerBeetle / Ghostty。</>}
                en={<>A new foundation for systems programming with <strong>no hidden control flow</strong>. No destructors, no exceptions, no operator overloads, no preprocessor — what you read is what the CPU runs. Eleven years and still pre-1.0, yet it already carries Bun, TigerBeetle, Ghostty.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">0.16<small></small></span>
                <span className="stat-label"><L zh={<>2026-04 最新版<br /><em>仍未 1.0 · 发布即承诺</em></>} en={<>latest, April 2026<br /><em>still pre-1.0 · ship-when-ready</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">100k<small>+</small></span>
                <span className="stat-label"><L zh={<>Bun GitHub stars<br /><em>JS runtime · 全 Zig 写</em></>} en={<>Bun GitHub stars<br /><em>JS runtime · written in Zig</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">$512K<small></small></span>
                <span className="stat-label"><L zh={<>Synadia + TigerBeetle<br /><em>对 ZSF 两年捐款 · 2025-10</em></>} en={<>Synadia + TigerBeetle<br /><em>2-year ZSF pledge · 2025-10</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">0<small></small></span>
                <span className="stat-label"><L zh={<>隐藏的内存分配<br /><em>每次 alloc 都看得见</em></>} en={<>hidden allocations<br /><em>every alloc is visible</em></>} /></span>
              </div>
            </div>
            <div className="hero-cube">
              <div className="hero-cube-face f-front">{ZIG_LOGO_SVG}</div>
            </div>
            <div className="hero-floats">
              <span className="float f1">comptime</span>
              <span className="float f2">!T</span>
              <span className="float f3">defer</span>
              <span className="float f4">errdefer</span>
              <span className="float f5">@cImport</span>
              <span className="float f6">try</span>
              <span className="float f7">packed</span>
              <span className="float f8">Allocator</span>
              <span className="float f9">zig cc</span>
              <span className="float f10">no hidden</span>
              <span className="float f11">@TypeOf</span>
              <span className="float f12">build.zig</span>
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
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>Zig</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>Zig 是一门"和 C 一个量级、但拒绝 C 一切坑"的系统编程语言。它不试图做"安全的 Rust"，也不做"友好的 C++"——它的目标是<strong>读源码所见即所得</strong>：没有析构、没有异常、没有运算符重载、没有宏。每一次内存分配都显式经过 <code>Allocator</code>。</>}
                  en={<>Zig is a systems language meant to share C's role while refusing C's traps. It is not a "safe Rust" or a "friendly C++" — its design goal is that <strong>reading the source tells you exactly what runs</strong>: no destructors, no exceptions, no operator overloading, no macros. Every allocation routes through an explicit <code>Allocator</code>.</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="低层" en="Low-level" />, tag: 'systems', p: <L zh={<>和 C 同一个层级。手动管内存、可读机器码、能写内核 / 嵌入式 / 数据库底层。</>} en={<>Same tier as C. Manual memory, readable assembly, fits kernel / embedded / DB-internals work.</>} /> },
                { h: <L zh="无隐藏" en="No hidden flow" />, tag: 'no-hidden', p: <L zh={<>没有析构、没有异常、没有 RAII、没有运算符重载。一行代码的语义就是它字面写的语义——<strong>Zig 最重要的设计哲学</strong>。</>} en={<>No destructors, exceptions, RAII, or operator overloading. The semantics of a line are exactly what's written — <strong>Zig's central design tenet</strong>.</>} /> },
                { h: <L zh="comptime" en="comptime" />, tag: 'metaprog', p: <L zh={<>编译期可以跑任意 Zig 代码。泛型 / 反射 / 元编程不分两套语言——<code>comptime</code> 一统所有。</>} en={<>Run arbitrary Zig at compile time. Generics, reflection, metaprogramming are not separate languages — <code>comptime</code> covers all of it.</>} /> },
                { h: <L zh="C 互操作" en="C interop" />, tag: 'with-C', p: <L zh={<><code>@cImport</code> 直吃 C 头文件；<code>zig cc</code> 是个跨平台 C 编译器和交叉链——比 GCC / Clang 标配更易用。</>} en={<><code>@cImport</code> consumes C headers natively; <code>zig cc</code> is a cross-platform C compiler and toolchain — more ergonomic than stock GCC / Clang.</>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">file.c</span><span className="lang-tag c">C</span></div>
                <pre className="code"><code>
                  <span className="cl-c"><L zh="// 经典 C 错误：忘了释放" en="// Classic C bug: forgot to free" /></span>{'\n'}
                  <span className="cl-type">char</span>* <span className="cl-fn">read_file</span>(<span className="cl-k">const</span> <span className="cl-type">char</span>* <span className="cl-v">path</span>) {'{'}{'\n'}
                  {'  '}<span className="cl-type">FILE</span>* <span className="cl-v">f</span> = <span className="cl-fn">fopen</span>(<span className="cl-v">path</span>, <span className="cl-s">"r"</span>);{'\n'}
                  {'  '}<span className="cl-k">if</span> (!<span className="cl-v">f</span>) <span className="cl-k">return</span> <span className="cl-k">NULL</span>;{'\n'}
                  {'  '}<span className="cl-type">char</span>* <span className="cl-v">buf</span> = <span className="cl-fn">malloc</span>(<span className="cl-n">1024</span>);{'\n'}
                  {'  '}<span className="cl-k">if</span> (<span className="cl-fn">fread</span>(<span className="cl-v">buf</span>, <span className="cl-n">1</span>, <span className="cl-n">1024</span>, <span className="cl-v">f</span>) &lt; <span className="cl-n">0</span>){'\n'}
                  {'    '}<span className="cl-k">return</span> <span className="cl-k">NULL</span>; <span className="cl-c"><L zh="// 漏 free!" en="// leaks buf and f!" /></span>{'\n'}
                  {'  '}<span className="cl-fn">fclose</span>(<span className="cl-v">f</span>);{'\n'}
                  {'  '}<span className="cl-k">return</span> <span className="cl-v">buf</span>;{'\n'}
                  {'}'}
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">file.zig</span><span className="lang-tag zig">Zig</span></div>
                <pre className="code"><code>
                  <span className="cl-k">fn</span> <span className="cl-fn">readFile</span>(<span className="cl-v">a</span>: <span className="cl-fn">std</span>.<span className="cl-fn">mem</span>.<span className="cl-type">Allocator</span>, <span className="cl-v">path</span>: []<span className="cl-k">const</span> <span className="cl-type">u8</span>) <span className="cl-err">!</span>[]<span className="cl-type">u8</span> {'{'}{'\n'}
                  {'  '}<span className="cl-k">const</span> <span className="cl-v">f</span> = <span className="cl-k">try</span> <span className="cl-fn">std</span>.<span className="cl-fn">fs</span>.<span className="cl-fn">cwd</span>().<span className="cl-fn">openFile</span>(<span className="cl-v">path</span>, .{'{}'});{'\n'}
                  {'  '}<span className="cl-k">defer</span> <span className="cl-v">f</span>.<span className="cl-fn">close</span>();   <span className="cl-c"><L zh="// 出函数前一定关闭" en="// closes on every exit" /></span>{'\n\n'}
                  {'  '}<span className="cl-k">const</span> <span className="cl-v">buf</span> = <span className="cl-k">try</span> <span className="cl-v">a</span>.<span className="cl-fn">alloc</span>(<span className="cl-type">u8</span>, <span className="cl-n">1024</span>);{'\n'}
                  {'  '}<span className="cl-k">errdefer</span> <span className="cl-v">a</span>.<span className="cl-fn">free</span>(<span className="cl-v">buf</span>); <span className="cl-c"><L zh="// 仅出错才释放" en="// only on error path" /></span>{'\n\n'}
                  {'  '}_ = <span className="cl-k">try</span> <span className="cl-v">f</span>.<span className="cl-fn">readAll</span>(<span className="cl-v">buf</span>);{'\n'}
                  {'  '}<span className="cl-k">return</span> <span className="cl-v">buf</span>;{'\n'}
                  {'}'}
                </code></pre>
              </div>
            </div>
          </section>

          {/* 02 History */}
          <section className="section" id="history">
            <header className="sec-head">
              <span className="sec-num">02</span>
              <h2 className="sec-title"><L zh="来路" en="History" /> <code>: Timeline</code></h2>
              <p className="sec-desc"><L
                zh={<>Andrew Kelley 一个人 2015 年开始的副业，到 2026 年 0.16 仍未 1.0——但已经让 Bun / TigerBeetle / Ghostty 把核心系统赌上去。这个 11 年是怎么走出来的。</>}
                en={<>What started in 2015 as Andrew Kelley's side project and is still pre-1.0 by 0.16 in 2026 — yet Bun, TigerBeetle and Ghostty have all bet core systems on it. Eleven years, traced.</>}
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

          {/* 03 Language Essentials */}
          <section className="section" id="system">
            <header className="sec-head">
              <span className="sec-num">03</span>
              <h2 className="sec-title"><L zh="语言精要" en="Language Essentials" /> <code>: ZigAlphabet</code></h2>
              <p className="sec-desc"><L
                zh={<>Zig 没有"高级特性大杂烩"。整个语言的地基就是下面这八件套——其中 <code>comptime</code> 一个就替代了别的语言"模板 / 泛型 / 反射 / 宏"四套机制。</>}
                en={<>Zig isn't a kitchen sink. The whole language stands on the eight primitives below — and <code>comptime</code> alone replaces what other languages call templates, generics, reflection, and macros.</>}
              /></p>
            </header>

            <div className="ts-grid">
              {ZIG_CARDS.map((c, i) => (
                <div className="ts-card" key={i}>
                  <div className="ts-tag">{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="ts-code">{c.code}</pre>
                </div>
              ))}
              <div className="ts-card ts-callout">
                <div className="ts-tag ts-tag-soft">∞</div>
                <h3><L zh="少即是多" en="Less is more" /></h3>
                <p><L
                  zh={<>Zig 的关键字加起来不到 50 个。整本语言手册一晚上看完。但每一个机制——分配器 / 错误联合 / comptime / packed——都<strong>能贯穿到生产</strong>。</>}
                  en={<>Zig has fewer than 50 keywords. You can read the full language reference in one evening. Yet each primitive — allocators, error unions, comptime, packed structs — <strong>scales all the way to production code</strong>.</>}
                /></p>
                <p className="ts-callout-quote">"<em><L
                  zh={<>Zig 的目标不是成为最强大的语言，而是成为最值得信赖的语言。</>}
                  en={<>Zig's goal isn't to be the most powerful language — it's to be the one you can trust the most.</>}
                /></em>" — Andrew Kelley</p>
              </div>
            </div>
          </section>

          {/* 04 Why */}
          <section className="section" id="why">
            <header className="sec-head">
              <span className="sec-num">04</span>
              <h2 className="sec-title"><L zh="为何要用" en="Why Zig" /> <code>: WhyZig</code></h2>
              <p className="sec-desc"><L
                zh={<>Zig 不是给"想写更安全 Rust"的人用的，是给"想写读得懂的系统代码"的人用的。简单不等于易，但简单一定让你能盯着源码说"我知道它在干什么"。</>}
                en={<>Zig is not for people who want a "safer Rust." It is for people who want systems code that they can actually read. Simple isn't easy — but simple lets you stare at the source and say "I know exactly what this does."</>}
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

          {/* 05 Projects */}
          <section className="section" id="projects">
            <header className="sec-head">
              <span className="sec-num">05</span>
              <h2 className="sec-title"><L zh="谁在用" en="Who's Using" /> <code>: Production</code></h2>
              <p className="sec-desc"><L
                zh={<>Zig 还没 1.0，但已经有这一打项目把核心系统赌在它身上。Bun（JS runtime）、TigerBeetle（金融 OLTP DB）、Ghostty（跨平台终端）—— 每一个都不是玩具。</>}
                en={<>Zig isn't 1.0 yet — but the projects below have already bet core systems on it. Bun (JS runtime), TigerBeetle (financial OLTP DB), Ghostty (cross-platform terminal) — none of these are toys.</>}
              /></p>
            </header>

            <div className="logo-grid logo-grid-12">
              {PROJECTS.map((p, i) => (
                <a key={i} className={`logo-card${p.highlight ? ' highlight' : ''}`} href={p.href} target="_blank" rel="noopener">
                  {p.svg}
                  <div className="logo-name">{lang === 'zh' ? p.zhName : p.enName}</div>
                  <div className="logo-note">{lang === 'zh' ? p.zhNote : p.enNote}</div>
                </a>
              ))}
            </div>
          </section>

          {/* 06 Bun Era */}
          <section className="section section-ai" id="ai">
            <header className="sec-head">
              <span className="sec-num ai-num">06</span>
              <h2 className="sec-title"><L zh="Bun / TigerBeetle / Ghostty 时代" en="The Bun · TigerBeetle · Ghostty Era" /> <code>: <L zh="Zig 在生产" en="Zig in Prod" /></code></h2>
              <p className="sec-desc"><L
                zh={<>2010 年代说"Zig"是 Hacker News 上小众极客的玩具。2025 年风向反过来：Anthropic 收购 Bun、TigerBeetle 撑住金融数据、Ghostty 一夜成为开发者最爱终端——<strong>Zig 写出来的项目第一次进入 AI 公司的核心栈</strong>。</>}
                en={<>In the 2010s "Zig" was something only HN fringe nerds wrote. The wind flipped in 2025: Anthropic bought Bun, TigerBeetle is running financial data, Ghostty became developers' favorite terminal overnight — <strong>Zig-built projects entered the core stack of an AI company for the first time</strong>.</>}
              /></p>
            </header>

            <blockquote className="quote-block">
              <div className="quote-mark">"</div>
              <p className="quote-text"><L
                zh={<>Zig 让我可以盯着 5000 行代码说"我知道它在干什么"。这件事在 C++ 里做不到，因为运算符重载、构造析构、template instantiation 把<strong>真实的控制流藏在源码看不见的地方</strong>。Zig 拒绝藏。代价是写起来啰嗦一点，收益是一年后我还能维护它。</>}
                en={<>Zig lets me look at 5,000 lines and say "I know exactly what this does." That's not possible in C++, where operator overloads, constructors / destructors and template instantiation <strong>hide the real control flow somewhere off the page</strong>. Zig refuses to hide. The cost is a bit of verbosity; the payoff is that a year later I can still maintain it.</>}
              /></p>
              <footer className="quote-footer">
                <span className="quote-author">— Andrew Kelley</span>
                <span className="quote-context"><L zh="Zig 创始人 / ZSF 主席 · 多次公开访谈" en="Creator of Zig / Chair of ZSF · paraphrased from interviews" /></span>
              </footer>
            </blockquote>

            <div className="ai-stats">
              <div className="ai-stat">
                <div className="ai-stat-num">770<small>k</small></div>
                <div className="ai-stat-h"><L zh="Bun 仓库的 Zig 行数" en="Lines of Zig in Bun's repo" /></div>
                <p><L
                  zh={<>2026 年 Bun 团队在公开 Zig→Rust 实验性 port 时披露：仓库里大约 <strong>77 万行 Zig + 1600 个文件</strong>。这是当今 Zig 生态最大的单一代码库。</>}
                  en={<>In 2026 when the Bun team posted their experimental Zig→Rust port plan, they disclosed roughly <strong>770,000 lines of Zig across 1,600 files</strong>. The single largest Zig codebase in production today.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">100<small>%</small></div>
                <div className="ai-stat-h"><L zh="TigerBeetle 全栈 Zig" en="TigerBeetle: 100% Zig" /></div>
                <p><L
                  zh={<>TigerBeetle 是金融级分布式 OLTP 数据库，每秒上百万笔账目。从存储引擎到 raft 共识到客户端协议——<strong>全栈 Zig</strong>。2025-10 联合 Synadia 给 ZSF 捐了 $512K。</>}
                  en={<>TigerBeetle is a financial-grade distributed OLTP DB doing millions of accounting ops per second. Storage engine, raft consensus, client wire protocol — <strong>all Zig</strong>. October 2025 they jointly pledged $512K to ZSF with Synadia.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">$512<small>K</small></div>
                <div className="ai-stat-h"><L zh="Synadia + TigerBeetle 捐款" en="Synadia + TigerBeetle pledge" /></div>
                <p><L
                  zh={<>Zig Software Foundation 历史最大单笔产业捐款。两年期 $512,000，让 ZSF 第一次<strong>能稳定支付一支核心团队</strong>，不用全靠 Andrew 个人 Patreon 续命。</>}
                  en={<>The largest industry donation ZSF has ever received. Two-year, $512,000 pledge — for the first time the foundation <strong>can pay a real core team</strong> rather than running on Andrew's personal Patreon.</>}
                /></p>
              </div>
            </div>

            <div className="spotlight">
              <div className="spotlight-tag">SPOTLIGHT</div>
              <div className="spotlight-grid">
                <div>
                  <h3>Bun <span className="spotlight-meta">— <L zh="Zig 写的 JS 运行时" en="A JavaScript runtime in Zig" /></span></h3>
                  <p><L
                    zh={<>Stripe 工程师 <strong>Jarred Sumner</strong> 2021 年开始一人写——选 Zig 的理由是"comptime + 与 JavaScriptCore 的 C++ 互操作能力"。2025-11 被 <strong>Anthropic</strong> 收购。今天 Bun 是 Cursor / Midjourney / Claude Code 这一带 AI 工具的 runtime 之一。</>}
                    en={<>Stripe engineer <strong>Jarred Sumner</strong> started Bun as a one-person project in 2021 — picking Zig for "comptime plus C++ interop with JavaScriptCore." Acquired by <strong>Anthropic</strong> in November 2025. Today Bun powers parts of the Cursor / Midjourney / Claude Code generation of AI tools.</>}
                  /></p>
                  <ul className="spotlight-list">
                    <li><strong>~770k</strong> <L zh="行 Zig · 1600 个文件" en="lines of Zig · 1,600 files" /></li>
                    <li><strong>3×</strong> <L zh="Node 启动速度 · 自实现 TLS / DNS / HTTP" en="Node's cold-start · custom TLS / DNS / HTTP" /></li>
                    <li><strong>89k+</strong> <L zh="GitHub stars · npm 上 Node 替代品的事实标准" en="GitHub stars · de-facto Node alternative on npm" /></li>
                  </ul>
                  <p><L
                    zh={<>有趣的脚注：2026 Bun 团队公开了一份 Zig→Rust 的实验性 port 计划。Jarred 自己说："还远没决定，我们只是在试。<strong>这一段代码大概率全部丢掉</strong>。"</>}
                    en={<>Footnote: in 2026 the Bun team published an experimental Zig→Rust port plan. Jarred's own line: "we haven't decided. We're just trying. <strong>There's a very high chance all this code gets thrown out completely.</strong>"</>}
                  /></p>
                </div>
                <div className="spotlight-code">
                  <pre className="code"><code>
                    <span className="cl-c"><L zh="// Bun 的某个 hot path 大致是这种形态" en="// A Bun hot-path looks roughly like this" /></span>{'\n'}
                    <span className="cl-k">pub fn</span> <span className="cl-fn">readBody</span>({'\n'}
                    {'  '}<span className="cl-v">self</span>: *<span className="cl-type">Request</span>,{'\n'}
                    {'  '}<span className="cl-v">a</span>: <span className="cl-fn">std</span>.<span className="cl-fn">mem</span>.<span className="cl-type">Allocator</span>,{'\n'}
                    ) <span className="cl-err">!</span>[]<span className="cl-type">u8</span> {'{'}{'\n'}
                    {'  '}<span className="cl-k">const</span> <span className="cl-v">len</span> = <span className="cl-v">self</span>.<span className="cl-prop">contentLength</span> <span className="cl-k">orelse</span>{'\n'}
                    {'    '}<span className="cl-k">return</span> <span className="cl-err">error</span>.<span className="cl-type">NoLength</span>;{'\n'}
                    {'  '}<span className="cl-k">const</span> <span className="cl-v">buf</span> = <span className="cl-k">try</span> <span className="cl-v">a</span>.<span className="cl-fn">alloc</span>(<span className="cl-type">u8</span>, <span className="cl-v">len</span>);{'\n'}
                    {'  '}<span className="cl-k">errdefer</span> <span className="cl-v">a</span>.<span className="cl-fn">free</span>(<span className="cl-v">buf</span>);{'\n'}
                    {'  '}_ = <span className="cl-k">try</span> <span className="cl-v">self</span>.<span className="cl-fn">socket</span>().<span className="cl-fn">readAll</span>(<span className="cl-v">buf</span>);{'\n'}
                    {'  '}<span className="cl-k">return</span> <span className="cl-v">buf</span>;{'\n'}
                    {'}'}{'\n\n'}
                    <span className="cl-c"><L zh="// 显式 allocator + try + errdefer" en="// explicit allocator + try + errdefer" /></span>{'\n'}
                    <span className="cl-c"><L zh="// 这就是 Bun 五千行核心的同一形状" en="// the same shape across 5,000 core lines" /></span>
                  </code></pre>
                </div>
              </div>
            </div>

            <div className="ai-tools">
              <h3 className="ai-tools-h"><L zh="Zig 已经撑起的项目（一打）" en="Projects already running on Zig" /></h3>
              <div className="ai-tools-grid">
                {NOTABLE_USERS.map((t, i) => (
                  <div className="ai-tool" key={i}>
                    <div className="ai-tool-name">{t.name}</div>
                    <div className="ai-tool-desc">{lang === 'zh' ? t.zhDesc : t.enDesc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="ai-reverse">
              <div className="ai-reverse-text">
                <div className="ai-reverse-tag">SPOTLIGHT 2</div>
                <h3><L zh="Ghostty · Mitchell Hashimoto" en="Ghostty · Mitchell Hashimoto" /></h3>
                <p><L
                  zh={<>HashiCorp / Terraform 创始人 Mitchell Hashimoto 默默用 Zig 写了三年的<strong>跨平台 GPU 加速终端模拟器</strong>，2024 公开后一夜霸榜 HN。Ghostty 选 Zig 的理由是："我需要一份核心代码同时跑 macOS 的 AppKit 和 Linux 的 GTK——Zig 的 C 互操作让这件事变可能。"</>}
                  en={<>HashiCorp / Terraform founder Mitchell Hashimoto quietly built a <strong>cross-platform, GPU-accelerated terminal emulator</strong> in Zig over three years; the 2024 unveiling owned HN's front page. Mitchell on picking Zig: "I needed one core to drive both macOS AppKit and Linux GTK — Zig's C interop made that possible."</>}
                /></p>
                <p><L
                  zh={<>2025 Ghostty 转型为非营利组织，<strong>libghostty</strong> 抽出来作为独立 Zig 模块对外开源——已经有几十个项目（包括商业项目）在用。一个"作者一个人"的玩具，长成了基础设施。</>}
                  en={<>In 2025 Ghostty became a non-profit, and <strong>libghostty</strong> was extracted as a standalone open Zig module — dozens of projects, commercial ones included, now depend on it. What started as one author's side project grew into infrastructure.</>}
                /></p>
                <p><L
                  zh={<>Mitchell 的另一句话："Zig 不会让我每天惊喜，但它<strong>每天都不让我惊吓</strong>。这对系统软件就够了。"</>}
                  en={<>Mitchell again: "Zig doesn't surprise me with delight every day. But it <strong>never surprises me with horror either</strong>. For systems software, that's the correct trade."</>}
                /></p>
              </div>
              <div className="ai-reverse-code">
                <pre className="code"><code>
                  <span className="cl-c"><L zh="// Ghostty: 单一 Zig 核心驱动两套 GUI" en="// Ghostty: one Zig core driving two GUI stacks" /></span>{'\n'}
                  <span className="cl-k">const</span> <span className="cl-type">Surface</span> = <span className="cl-k">switch</span> (<span className="cl-fn">builtin</span>.<span className="cl-prop">os</span>.<span className="cl-prop">tag</span>) {'{'}{'\n'}
                  {'  '}.<span className="cl-prop">macos</span> =&gt; <span className="cl-fn">@import</span>(<span className="cl-s">"apple/Surface.zig"</span>),{'\n'}
                  {'  '}.<span className="cl-prop">linux</span> =&gt; <span className="cl-fn">@import</span>(<span className="cl-s">"gtk/Surface.zig"</span>),{'\n'}
                  {'  '}<span className="cl-k">else</span>     =&gt; <span className="cl-fn">@compileError</span>(<span className="cl-s">"unsupported"</span>),{'\n'}
                  {'};'}{'\n\n'}
                  <span className="cl-k">pub fn</span> <span className="cl-fn">draw</span>(<span className="cl-v">s</span>: *<span className="cl-type">Surface</span>) <span className="cl-err">!</span><span className="cl-k">void</span> {'{'}{'\n'}
                  {'  '}<span className="cl-c"><L zh="// 同一份业务逻辑" en="// same logic across platforms" /></span>{'\n'}
                  {'  '}<span className="cl-k">try</span> <span className="cl-v">s</span>.<span className="cl-fn">renderer</span>().<span className="cl-fn">flush</span>();{'\n'}
                  {'}'}{'\n\n'}
                  <span className="cl-c"><L zh="// comptime switch · 0 运行时开销" en="// comptime switch · zero runtime cost" /></span>
                </code></pre>
              </div>
            </div>

            <div className="ai-takeaway">
              <p><strong><L zh="一句话：" en="In one line: " /></strong><L
                zh={<>Zig 现在的地位不是"未来某天可能取代 C"，而是"<strong>已经在生产的关键路径上跑了</strong>"——只是它谦虚到自己还没敢叫 1.0。</>}
                en={<>Zig's current position isn't "may one day replace C." It is "<strong>already running on production critical paths</strong>" — the language is just modest enough not to call itself 1.0 yet.</>}
              /></p>
            </div>
          </section>

          {/* 07 vs */}
          <section className="section" id="vs">
            <header className="sec-head">
              <span className="sec-num">07</span>
              <h2 className="sec-title"><L zh="对比" en="vs Rust / C" /> <code>: Zig vs Rust vs C</code></h2>
              <p className="sec-desc"><L
                zh={<>三门"系统级"语言，三套世界观。Rust 押宝在<strong>类型系统强制内存安全</strong>，C 押宝在<strong>给程序员极致自由</strong>，Zig 押宝在<strong>没有隐藏的控制流</strong>。下面这张表看一遍就知道为什么 Zig 不是 Rust 的对手——它们想做的根本不是同一件事。</>}
                en={<>Three "systems" languages, three worldviews. Rust bets on <strong>memory safety enforced by the type system</strong>, C bets on <strong>maximum freedom for the programmer</strong>, Zig bets on <strong>no hidden control flow</strong>. The table below makes it clear that Zig isn't competing with Rust — they're not actually trying to do the same thing.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-c">C</th>
                  <th className="th-rust">Rust</th>
                  <th className="th-zig">Zig</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="内存安全" en="Memory safety" />,
                    c:    <L zh="完全靠程序员自觉" en="Programmer discipline only" />,
                    rust: <L zh="借用检查器静态保证" en="Borrow checker, statically guaranteed" />,
                    zig:  <L zh="显式 alloc + ReleaseSafe sanitizer" en="Explicit alloc + ReleaseSafe sanitizers" /> },
                  { k: <L zh="错误处理" en="Error handling" />,
                    c:    <L zh="errno / 返回码 / 文档" en="errno / return codes / docs" />,
                    rust: <code>{'Result<T, E>'}</code>,
                    zig:  <code>!T</code> },
                  { k: <L zh="泛型 / 元编程" en="Generics / metaprog" />,
                    c:    <L zh="宏 + void* + 祈祷" en="Macros + void* + prayer" />,
                    rust: <L zh={<>traits + <code>const fn</code> + macros</>} en={<>traits + <code>const fn</code> + macros</>} />,
                    zig:  <L zh={<><code>comptime</code> 一统</>} en={<><code>comptime</code> handles all of it</>} /> },
                  { k: <L zh="隐藏控制流" en="Hidden control flow" />,
                    c:    <L zh="setjmp / signals" en="setjmp / signals" />,
                    rust: <L zh="Drop / panic / Deref" en="Drop / panic / Deref impls" />,
                    zig:  <L zh="无（核心承诺）" en="None (core promise)" /> },
                  { k: <L zh="编译期分配" en="Compile-time alloc" />,
                    c:    <L zh="无" en="None" />,
                    rust: <L zh={<><code>const fn</code>，受限</>} en={<><code>const fn</code>, restricted</>} />,
                    zig:  <L zh={<><code>comptime</code> 跑全语言</>} en={<><code>comptime</code> runs the full language</>} /> },
                  { k: <L zh="C 互操作" en="C interop" />,
                    c:    <L zh="自己" en="It is C" />,
                    rust: <L zh="bindgen + unsafe + cargo build.rs" en="bindgen + unsafe + cargo build.rs" />,
                    zig:  <L zh={<><code>@cImport</code> 直吃头文件</>} en={<><code>@cImport</code> reads C headers natively</>} /> },
                  { k: <L zh="跨编译" en="Cross compile" />,
                    c:    <L zh="装一打 sysroot + toolchain" en="Install a pile of sysroots + toolchains" />,
                    rust: <code>cargo --target</code>,
                    zig:  <L zh={<><code>zig build-exe -target ...</code> 开箱即用</>} en={<><code>zig build-exe -target ...</code> works out of the box</>} /> },
                  { k: <L zh="构建系统" en="Build system" />,
                    c:    <L zh="Make / CMake / Autotools / ..." en="Make / CMake / Autotools / ..." />,
                    rust: <L zh="Cargo（一统）" en="Cargo (universal)" />,
                    zig:  <L zh={<><code>build.zig</code>，本身就是 Zig 代码</>} en={<><code>build.zig</code> — itself just Zig code</>} /> },
                  { k: <L zh="生态成熟度" en="Ecosystem maturity" />,
                    c:    <L zh="50 年" en="50 years" />,
                    rust: <L zh="2015 起飞" en="Took off in 2015" />,
                    zig:  <L zh="还没 1.0" en="Pre-1.0" /> },
                  { k: <L zh="LLM 友好度" en="LLM-friendliness" />,
                    c:    <L zh="坑多 · 模型容易出 UB" en="UB-prone · models easily slip" />,
                    rust: <L zh="编译器严但提示丰富" en="Strict compiler, rich diagnostics" />,
                    zig:  <L zh="无隐藏 → 模型读得懂" en="No hidden flow → models read it cleanly" /> },
                  { k: <L zh="学习曲线" en="Learning curve" />,
                    c:    <L zh="一周入门 · 一辈子踩坑" en="A week to start, a lifetime of footguns" />,
                    rust: <L zh="陡 · 一两个月" en="Steep, a month or two" />,
                    zig:  <L zh="平缓 · 一晚上看完手册" en="Gentle — read the reference in one evening" /> },
                  { k: <L zh="设计哲学" en="Design philosophy" />,
                    c:    <L zh="给程序员极致自由" en="Maximum freedom" />,
                    rust: <L zh="类型系统当护栏" en="Type system as guardrail" />,
                    zig:  <L zh="读源码所见即所得" en="What you read is what runs" /> },
                ].map((row, i) => (
                  <tr key={i}>
                    <td>{row.k}</td>
                    <td>{row.c}</td>
                    <td>{row.rust}</td>
                    <td>{row.zig}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* 08 Future */}
          <section className="section" id="future">
            <header className="sec-head">
              <span className="sec-num">08</span>
              <h2 className="sec-title"><L zh="前景" en="Outlook" /> <code>: TheRoadToOne</code></h2>
              <p className="sec-desc"><L
                zh={<>11 年还没 1.0，是 Zig 最常被嘲笑的点。但同样这 11 年——已经有公司把金融数据库 / JS runtime / 跨平台终端赌在它身上跑生产。1.0 不是营销节点，是承诺兑现的那一刻。</>}
                en={<>"Eleven years and still not 1.0" is Zig's most-mocked stat. Yet across those eleven years, companies have bet financial databases, a JS runtime, and a cross-platform terminal on it in production. 1.0 isn't a marketing milestone — it's the moment promises are paid in full.</>}
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
                <li><a href="https://ziglang.org" target="_blank" rel="noopener">ziglang.org</a></li>
                <li><a href="https://ziglang.org/learn/" target="_blank" rel="noopener"><L zh="官方学习路径" en="Learn Zig" /></a></li>
                <li><a href="https://ziglang.org/documentation/master/" target="_blank" rel="noopener"><L zh="语言手册" en="Language Reference" /></a></li>
                <li><a href="https://ziglang.org/devlog/2026/" target="_blank" rel="noopener"><L zh="2026 Devlog" en="2026 Devlog" /></a></li>
                <li><a href="https://codeberg.org/ziglang/zig" target="_blank" rel="noopener">Source · Codeberg</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="关键阅读" en="Key Reading" /></h4>
              <ul>
                <li><a href="https://ziglang.org/news/0.16.0-release-notes/" target="_blank" rel="noopener">Zig 0.16 Release Notes</a></li>
                <li><a href="https://kristoff.it/" target="_blank" rel="noopener">kristoff.it · Loris on Zig</a></li>
                <li><a href="https://www.openmymind.net/learning_zig/" target="_blank" rel="noopener">Karl Seguin · Learning Zig</a></li>
                <li><a href="https://zig.guide/" target="_blank" rel="noopener">zig.guide</a></li>
                <li><a href="https://ziglearn.org" target="_blank" rel="noopener">Ziglearn</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="生产用户" en="In Production" /></h4>
              <ul>
                <li><a href="https://bun.com" target="_blank" rel="noopener">Bun (Anthropic)</a></li>
                <li><a href="https://tigerbeetle.com" target="_blank" rel="noopener">TigerBeetle</a></li>
                <li><a href="https://ghostty.org" target="_blank" rel="noopener">Ghostty</a></li>
                <li><a href="https://github.com/hexops/mach" target="_blank" rel="noopener">mach engine</a></li>
                <li><a href="https://github.com/roc-lang/roc" target="_blank" rel="noopener">Roc</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="基金会 / 社区" en="Foundation / Community" /></h4>
              <ul>
                <li><a href="https://ziglang.org/zsf/" target="_blank" rel="noopener">Zig Software Foundation</a></li>
                <li><a href="https://tigerbeetle.com/blog/2025-10-25-synadia-and-tigerbeetle-pledge-512k-to-the-zig-software-foundation/" target="_blank" rel="noopener">$512K Pledge announcement</a></li>
                <li><a href="https://github.com/zigtools/zls" target="_blank" rel="noopener">zls (Language Server)</a></li>
                <li><a href="https://discord.gg/zig" target="_blank" rel="noopener">Discord</a></li>
                <li><a href="https://ziggit.dev" target="_blank" rel="noopener">Ziggit Forum</a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo">{ZIG_LOGO_SVG}</div>
              <p className="footer-line"><L zh="单页中文 / English 双语 · 资料截至 2026-05" en="Single-page guide · zh / en · last updated 2026-05" /></p>
              <p className="footer-line dim"><code>{`const future: !Stable = try roadmap.toOne();`}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
