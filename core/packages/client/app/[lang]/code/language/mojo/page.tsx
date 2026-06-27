'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LangCtx, L, type Lang } from '../_intro/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './mojo_intro.css';

const MOJO_LOGO_SVG = (
  <svg viewBox="0 0 256 256">
    <defs>
      <linearGradient id="mo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FF7A33" />
        <stop offset="100%" stopColor="#993000" />
      </linearGradient>
      <linearGradient id="mo-flame" x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%" stopColor="#FFD8A8" />
        <stop offset="40%" stopColor="#FF7A33" />
        <stop offset="100%" stopColor="#FF4B00" />
      </linearGradient>
    </defs>
    <rect width="256" height="256" rx="28" fill="url(#mo-grad)" />
    {/* asymmetric flame */}
    <path
      d="M138 28 C150 60 178 78 188 116 C198 156 174 196 134 212 C152 188 152 162 134 142 C140 168 124 188 100 196 C72 200 52 178 56 148 C60 124 80 108 96 86 C104 72 102 58 96 44 C112 56 122 48 122 32 C128 38 134 38 138 28 Z"
      fill="url(#mo-flame)"
    />
    <path
      d="M118 124 C124 142 124 158 114 172 C102 168 96 156 100 142 C104 132 112 128 118 124 Z"
      fill="#FFE8C8"
      opacity=".75"
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
    year: '2003',
    zh: { title: <>Chris Lattner 提交 LLVM 论文</>, desc: <>UIUC 硕士论文 <strong>"LLVM: A Compilation Framework for Lifelong Program Analysis &amp; Transformation"</strong>。这套基础设施定下了 Lattner 之后 20 年所有大动作的底——Clang、Swift、MLIR，最后都是 Mojo。<em>整条线的源头</em>。</> },
    en: { title: <>Chris Lattner submits the LLVM thesis</>, desc: <>His UIUC master's thesis: <strong>"LLVM: A Compilation Framework for Lifelong Program Analysis &amp; Transformation"</strong>. The infra it laid down became the substrate for the next two decades of Lattner's work — Clang, Swift, MLIR, and finally Mojo. <em>The origin of the whole line</em>.</> },
  },
  {
    year: <>2014<small>·06</small></>,
    zh: { title: <>WWDC: Swift 上线</>, desc: <>Lattner 在 Apple 主导的"现代替代 ObjC"项目终于公开 (<a href="/code/swift">/code/swift</a>)。Swift 后来成了 Apple 全栈语言。Lattner 留到 2017。<em>这是他第二门让世界改观的语言, 第三门是 Mojo</em>。</> },
    en: { title: <>WWDC: Swift ships</>, desc: <>The "modern Objective-C replacement" Lattner led inside Apple goes public (<a href="/code/swift">/code/swift</a>). Swift becomes Apple's full-stack language. Lattner stays through 2017. <em>It is his second language to reshape an industry; Mojo is the third</em>.</> },
  },
  {
    year: <>2017<small>·01</small></>,
    zh: { title: <>Lattner → Tesla → Google Brain</>, desc: <>1 月去 Tesla 任 Autopilot VP，半年后辞职。秋天加入 <strong>Google Brain</strong> 做 TPU 编译器基础设施——<strong>MLIR</strong> 在这里诞生。MLIR 是 Mojo 的<strong>直接技术种子</strong>: 多层 IR、可扩展方言、为异构硬件而生。</> },
    en: { title: <>Lattner → Tesla → Google Brain</>, desc: <>January: he joins Tesla as VP of Autopilot, then resigns six months later. Autumn: he lands at <strong>Google Brain</strong> on TPU compiler infrastructure — where <strong>MLIR</strong> is born. MLIR is the <strong>direct technical seed</strong> of Mojo: multi-level IR, extensible dialects, designed for heterogeneous hardware.</> },
  },
  {
    year: <>2022<small>·01</small></>, highlight: true,
    zh: { title: <>Modular 成立</>, desc: <>Lattner 与前 Google ML 编译器组 <strong>Tim Davis</strong> 共同创立 <strong>Modular</strong>。目标朴素到挑衅: <strong>"AI 不应该被 CUDA + Python 锁死"</strong>。第一批工程师全部从 Google / Apple / SiFive 编译器圈过来。</> },
    en: { title: <>Modular is founded</>, desc: <>Lattner and ex-Google ML-compiler lead <strong>Tim Davis</strong> co-found <strong>Modular</strong>. The mission is bluntly simple: <strong>"AI shouldn't be locked into CUDA + Python."</strong> Early engineers come from Google, Apple and SiFive's compiler crowd.</> },
  },
  {
    year: <>2023<small>·05·02</small></>, highlight: true,
    zh: { title: <>Mojo 在 Modular Keynote 上首次公开</>, desc: <>定位三句话讲完: <strong>Python 的语法 / C 的速度 / MLIR 作 IR</strong>。首场公开 demo 把朴素 Python 矩阵乘法在同一台机器上跑出 <strong>35,000×</strong> 加速 — 数字震到全场。AI 圈一夜知道这个名字。</> },
    en: { title: <>Mojo unveiled at Modular's keynote</>, desc: <>Three-line pitch: <strong>Python syntax, C-class speed, MLIR for the IR</strong>. The first demo runs a naive Python matmul <strong>35,000× faster</strong> on the same hardware — the number stuns the room. The AI world learns the name overnight.</> },
  },
  {
    year: <>2023<small>·09</small></>,
    zh: { title: <>Mojo SDK 0.1 — 第一次能下载</>, desc: <>9 月放出 0.1 SDK, <strong>仅 Linux</strong>, 注册排队拿 license。语言 surface 还在乱跳, 但<strong>第一次可以本机跑</strong>。早期玩家以 ML 工程师 + 编译器 hobbyist 为主。</> },
    en: { title: <>Mojo SDK 0.1 — first downloadable build</>, desc: <>The 0.1 SDK ships in September, <strong>Linux only</strong>, behind a license waitlist. The language surface is still volatile, but <strong>you can finally run it locally</strong>. The early crowd is ML engineers plus compiler hobbyists.</> },
  },
  {
    year: <>2024<small>·01</small></>,
    zh: { title: <>macOS 支持</>, desc: <>Mojo 落地 Apple Silicon。M 系列芯片是 LLVM/MLIR codegen 的甜蜜点; 苹果机器上能跑意味着<strong>开发者电脑数量瞬间翻倍</strong>。社区开始有非 Linux 的 issue 涌入。</> },
    en: { title: <>macOS support</>, desc: <>Mojo lands on Apple Silicon. M-series chips are sweet-spot targets for LLVM/MLIR codegen; "runs on a Mac" instantly <strong>doubles the developer hardware base</strong>. The first wave of non-Linux issues hits the tracker.</> },
  },
  {
    year: <>2024<small>·03·29</small></>, highlight: true,
    zh: { title: <>标准库开源 (Apache 2.0)</>, desc: <>3 月 29 日, Modular 把 <strong>stdlib 开源</strong>到 <code>modularml/mojo</code>。<em>编译器仍然闭源</em>——这条策略和早期 Swift 一样: 先把库交给社区改, 再考虑工具链。一周内 GitHub 有 ~100 个外部 PR。</> },
    en: { title: <>Standard library open-sourced (Apache 2.0)</>, desc: <>March 29: Modular open-sources the <strong>stdlib</strong> on <code>modularml/mojo</code>. <em>The compiler stays closed for now</em> — same playbook as early Swift: hand the library to the community first, decide on the toolchain later. ~100 outside PRs land within a week.</> },
  },
  {
    year: <>2024<small>·08</small></>,
    zh: { title: <>Mojo 24.4 — ownership 大改版</>, desc: <>把 Rust 风的所有权语义重做了一遍: <code>borrow</code> / <code>inout</code> / <code>owned</code> 作为参数注解, <strong>显式标注、不靠推断</strong>。同时 <code>Reference[T]</code> 类型整齐化。社区第一次感到"语言开始定型"。</> },
    en: { title: <>Mojo 24.4 — ownership overhaul</>, desc: <>The Rust-flavoured ownership story gets a thorough rework: <code>borrow</code> / <code>inout</code> / <code>owned</code> become parameter conventions, <strong>explicitly annotated rather than inferred</strong>. The <code>Reference[T]</code> type lines up at the same time. The community senses the language is "starting to set."</> },
  },
  {
    year: <>2024<small>·09</small></>, highlight: true,
    zh: { title: <>GPU kernels 上线 — H100 / A100</>, desc: <>Mojo 第一次给 NVIDIA H100 / A100 出 codegen, 路径是 <strong>MLIR → PTX</strong>。这是"<strong>不依赖 CUDA C++ 也能写 GPU 内核</strong>"的<strong>第一次真兑现</strong>; 此前的 Triton (OpenAI) 走 Python AST, 路线不同。</> },
    en: { title: <>GPU kernels land — H100 / A100</>, desc: <>The first NVIDIA H100 / A100 codegen ships, via the <strong>MLIR → PTX</strong> pipeline. This is the <strong>first real proof</strong> that you can <strong>write GPU kernels without CUDA C++</strong>. Triton (OpenAI) had been doing it via Python AST, but the route is different.</> },
  },
  {
    year: <>2025<small>·02</small></>,
    zh: { title: <>MAX 24.6 — 上生产推理</>, desc: <>Modular 自家推理引擎 <strong>MAX</strong> 把 Mojo 内核接进生产, 跑在多家 AI 创业公司的服务上 (Replit / Together AI 公开提到过)。"研究阶段语言"的标签开始撕掉。</> },
    en: { title: <>MAX 24.6 — production inference</>, desc: <>Modular's <strong>MAX</strong> inference engine wires Mojo kernels into production at multiple AI startups (Replit and Together AI have said so publicly). The "research-stage language" label starts peeling off.</> },
  },
  {
    year: <>2025<small>·09</small></>, highlight: true,
    zh: { title: <>AMD GPU — ROCm/MLIR 后端</>, desc: <>Mojo 加 AMD GPU 支持, 直接走 ROCm/MLIR codegen。意义重大: 这是<strong>自 OpenCL 以来第一次有可信的 CUDA 替代方案</strong>。同一份内核源, 跑到 NVIDIA / AMD 两家 GPU——CUDA 垄断的<strong>第一道真裂缝</strong>。</> },
    en: { title: <>AMD GPU support — via ROCm/MLIR</>, desc: <>Mojo gains AMD GPU support through a ROCm/MLIR backend. It matters: this is the <strong>first credible CUDA alternative since OpenCL</strong>. One kernel source, two vendors — the <strong>first real crack</strong> in the CUDA monopoly.</> },
  },
  {
    year: <>2025<small>·11</small></>,
    zh: { title: <>逼近 1.0 — package manager + stdlib 稳态</>, desc: <>新包管理器 <code>magic</code>、stdlib API 进入 <strong>"破坏性变更需要 RFC"</strong> 阶段、文档生成器站起。"还在剧烈翻修"的早期感淡去, 1.0 已经在视野里。</> },
    en: { title: <>Approaching 1.0 — package manager + stable stdlib</>, desc: <>The new <code>magic</code> package manager ships; the stdlib enters its <strong>"breaking changes need an RFC"</strong> phase; the doc generator lands. The "still being torn up" feel fades; 1.0 is in sight.</> },
  },
  {
    year: '2026',
    zh: { title: <>3 岁, 已在前沿实验室生产推理</>, desc: <>2026 年 Mojo 的现状: <strong>前沿 AI 实验室在用 MAX + Mojo 做生产推理</strong>; "Python 慢"那道墙立得住——Mojo 的官方矩阵乘法 / softmax 数据可重现; 生态规模仍远小于 PyTorch 原生。<strong>异构硬件 AI 内核</strong>是 2026 年真正的战场, Mojo / Triton / CUDA / JAX-XLA 同台竞争。</> },
    en: { title: <>Three years in — production inference at frontier labs</>, desc: <>Mojo in 2026: <strong>frontier AI labs use MAX + Mojo for production inference</strong>; the "Python is slow" pitch holds — Modular's matmul / softmax numbers are reproducible; the ecosystem is still tiny next to PyTorch-native. <strong>Hardware-portable AI kernels</strong> are the real 2026 battleground, with Mojo / Triton / CUDA / JAX-XLA all competing.</> },
  },
];

interface MoCard {
  tag: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const MO_CARDS: MoCard[] = [
  {
    tag: 'A',
    zh: { title: <><code>def</code> vs <code>fn</code></>, desc: <>Mojo <strong>同时</strong>有 Python 风的 <code>def</code> 和严格类型的 <code>fn</code>。同一个文件可以混: 原型用 <code>def</code> 像 Python, 热路径切 <code>fn</code> 拿编译期检查。</> },
    en: { title: <><code>def</code> vs <code>fn</code></>, desc: <>Mojo carries <strong>both</strong> Python-loose <code>def</code> and strict typed <code>fn</code>. One file can mix: prototype with <code>def</code> like Python, then switch the hot path to <code>fn</code> for compile-time checks.</> },
    code: (
      <code>
        <span className="cl-k">def</span> <span className="cl-fn">loose</span>(x):{'\n'}
        {'    '}<span className="cl-k">return</span> x * <span className="cl-n">2</span>{'\n\n'}
        <span className="cl-k">fn</span> <span className="cl-fn">strict</span>(x: <span className="cl-type">Int</span>) -&gt; <span className="cl-type">Int</span>:{'\n'}
        {'    '}<span className="cl-k">return</span> x * <span className="cl-n">2</span>
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <><code>borrow</code> / <code>inout</code> / <code>owned</code></>, desc: <>Rust 风所有权, 但<strong>显式注解</strong>: 默认 <code>borrow</code> (只读引用), <code>inout</code> 可变借, <code>owned</code> 转移所有权。<em>无生命周期标注的痛</em>, 但语义清楚。</> },
    en: { title: <><code>borrow</code> / <code>inout</code> / <code>owned</code></>, desc: <>Rust-flavoured ownership, but <strong>explicitly annotated</strong>: default is <code>borrow</code> (read-only ref), <code>inout</code> for mutable borrows, <code>owned</code> for transfer. <em>None of Rust's lifetime annotation pain</em>, but the semantics stay clear.</> },
    code: (
      <code>
        <span className="cl-k">fn</span> <span className="cl-fn">peek</span>(<span className="cl-k">borrow</span> s: <span className="cl-type">String</span>):{'\n'}
        {'    '}<span className="cl-fn">print</span>(s){'\n\n'}
        <span className="cl-k">fn</span> <span className="cl-fn">grow</span>(<span className="cl-k">inout</span> s: <span className="cl-type">String</span>):{'\n'}
        {'    '}s += <span className="cl-s">"!"</span>{'\n\n'}
        <span className="cl-k">fn</span> <span className="cl-fn">eat</span>(<span className="cl-k">owned</span> s: <span className="cl-type">String</span>): ...
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <><code>@parameter</code> — 编译期编程</>, desc: <><strong>泛型、条件编译、循环展开</strong>共用一套 <code>@parameter</code> 标记。运行期与编译期写起来语法一致, IR 由 MLIR 决定何时具化。</> },
    en: { title: <><code>@parameter</code> — compile-time programming</>, desc: <>One <code>@parameter</code> annotation covers <strong>generics, conditional compilation, and loop unrolling</strong>. Runtime and compile-time code read the same; MLIR decides when to specialise.</> },
    code: (
      <code>
        <span className="cl-k">fn</span> <span className="cl-fn">repeat</span>[<span className="cl-k">@parameter</span> n: <span className="cl-type">Int</span>](){'\n'}
        {'    '}<span className="cl-k">@parameter</span>{'\n'}
        {'    '}<span className="cl-k">for</span> i <span className="cl-k">in</span> <span className="cl-fn">range</span>(n):{'\n'}
        {'        '}<span className="cl-fn">print</span>(i)  <span className="cl-c"># unrolled at compile time</span>
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <><code>SIMD[T, n]</code> — 一等公民</>, desc: <>SIMD 是<strong>类型, 不是 intrinsic</strong>。<code>SIMD[DType.float32, 8]</code> 是参数化向量, 算术运算自动并行——<strong>写起来像标量, 跑起来是 AVX/NEON</strong>。</> },
    en: { title: <><code>SIMD[T, n]</code> as a first-class type</>, desc: <>SIMD is a <strong>type, not an intrinsic</strong>. <code>SIMD[DType.float32, 8]</code> is a parametric vector; arithmetic auto-parallelises — <strong>reads like scalar, runs as AVX/NEON</strong>.</> },
    code: (
      <code>
        <span className="cl-k">var</span> a = <span className="cl-type">SIMD</span>[<span className="cl-type">DType</span>.float32, <span className="cl-n">8</span>](<span className="cl-n">1.0</span>){'\n'}
        <span className="cl-k">var</span> b = <span className="cl-type">SIMD</span>[<span className="cl-type">DType</span>.float32, <span className="cl-n">8</span>](<span className="cl-n">2.0</span>){'\n'}
        <span className="cl-k">var</span> c = a * b + a   <span className="cl-c"># 8-wide FMA</span>
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <><code>@value</code> — 自动派生</>, desc: <>给 struct 加 <code>@value</code>, <strong>copy / move / init / del 自动生成</strong>。等价于 Rust 的 <code>derive(Copy, Clone)</code>, 一行省 30 行样板。</> },
    en: { title: <><code>@value</code> — auto-derived methods</>, desc: <>Tag a struct with <code>@value</code> and <strong>copy / move / init / del are generated for you</strong>. The equivalent of Rust's <code>derive(Copy, Clone)</code> — one line saves 30 of boilerplate.</> },
    code: (
      <code>
        <span className="cl-k">@value</span>{'\n'}
        <span className="cl-k">struct</span> <span className="cl-type">Point</span>:{'\n'}
        {'    '}<span className="cl-k">var</span> x: <span className="cl-type">Float64</span>{'\n'}
        {'    '}<span className="cl-k">var</span> y: <span className="cl-type">Float64</span>{'\n\n'}
        <span className="cl-c"># __init__ / __copyinit__ / __moveinit__ all derived</span>
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <><code>struct</code> vs <code>class</code></>, desc: <>Mojo <strong>偏向 struct (值类型)</strong>: 栈上、有 ownership。<code>class</code> (引用类型, GC 语义) <strong>暂未稳定</strong>——这是有意识的取舍, 先把数值/系统编程做稳。</> },
    en: { title: <><code>struct</code> vs <code>class</code></>, desc: <>Mojo <strong>prefers struct (value types)</strong>: stack-allocated, ownership-aware. <code>class</code> (reference type, GC-flavoured) is <strong>deferred for now</strong> — a deliberate trade: nail numeric / systems code first.</> },
    code: (
      <code>
        <span className="cl-k">struct</span> <span className="cl-type">Vec3</span>:{'\n'}
        {'    '}<span className="cl-k">var</span> x: <span className="cl-type">Float32</span>{'\n'}
        {'    '}<span className="cl-k">var</span> y: <span className="cl-type">Float32</span>{'\n'}
        {'    '}<span className="cl-k">var</span> z: <span className="cl-type">Float32</span>{'\n\n'}
        <span className="cl-c">{'# class { ... }  # not stable yet, on roadmap'}</span>
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <><code>alias</code> — 编译期常量</>, desc: <>一个关键字管所有<strong>编译期定值</strong>。C++ 里 <code>#define</code> / <code>const</code> / <code>constexpr</code> 三件事在 Mojo 里全是 <code>alias</code>。</> },
    en: { title: <><code>alias</code> — compile-time constants</>, desc: <>One keyword for every <strong>compile-time bound value</strong>. The three things C++ splits across <code>#define</code>, <code>const</code> and <code>constexpr</code> are all just <code>alias</code> here.</> },
    code: (
      <code>
        <span className="cl-k">alias</span> WIDTH: <span className="cl-type">Int</span> = <span className="cl-n">8</span>{'\n'}
        <span className="cl-k">alias</span> <span className="cl-type">F32x8</span> = <span className="cl-type">SIMD</span>[<span className="cl-type">DType</span>.float32, WIDTH]{'\n\n'}
        <span className="cl-k">var</span> v: <span className="cl-type">F32x8</span> = <span className="cl-n">0</span>
      </code>
    ),
  },
  {
    tag: 'H',
    zh: { title: <><code>@always_inline</code> 与 perf 注解</>, desc: <>Mojo <strong>不靠 LLVM 启发式赌</strong>, 而是给程序员显式的旋钮: <code>@always_inline</code>、<code>@noinline</code>、<code>@register_passable</code>。<em>性能可预测, 不再"换编译器版本性能掉了"</em>。</> },
    en: { title: <><code>@always_inline</code> and friends</>, desc: <>Mojo <strong>doesn't gamble on LLVM heuristics</strong>; it gives programmers explicit knobs: <code>@always_inline</code>, <code>@noinline</code>, <code>@register_passable</code>. <em>Performance becomes predictable — no more "regressed when the compiler upgraded"</em>.</> },
    code: (
      <code>
        <span className="cl-k">@always_inline</span>{'\n'}
        <span className="cl-k">fn</span> <span className="cl-fn">dot</span>(a: <span className="cl-type">F32x8</span>, b: <span className="cl-type">F32x8</span>) -&gt; <span className="cl-type">Float32</span>:{'\n'}
        {'    '}<span className="cl-k">return</span> (a * b).<span className="cl-fn">reduce_add</span>()
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
    icon: '⊹',
    zh: { title: <>不再需要 pybind11</>, desc: <>过去把 Python 提速要写 C/C++ 扩展、绑 pybind11、算 GIL——三种语言、三套构建。Mojo 直接 <strong>import 任意 Python 包</strong>, 同一文件里写 <code>fn</code> 加速热路径。<strong>FFI 礼仪一笔勾销</strong>。</> },
    en: { title: <>No more pybind11</>, desc: <>Speeding up Python used to mean C/C++ extensions, pybind11 wrangling, and GIL accounting — three languages and three build systems. Mojo just <strong>imports any Python package</strong> and lets you write <code>fn</code> hot paths in the same file. <strong>The FFI ceremony is gone</strong>.</> },
    code: <><span className="cl-k">from python import</span> <span className="cl-type">Python</span>{'\n'}<span className="cl-k">var</span> np = <span className="cl-type">Python</span>.<span className="cl-fn">import_module</span>(<span className="cl-s">"numpy"</span>){'\n'}<span className="cl-k">var</span> arr = np.<span className="cl-fn">array</span>([<span className="cl-n">1</span>,<span className="cl-n">2</span>,<span className="cl-n">3</span>])</>,
  },
  {
    icon: '⌬',
    zh: { title: <>MLIR 是地基, 不是补丁</>, desc: <>多数语言把"AI 加速"补在工具链上 (TorchScript、JAX trace、TF graph)。Mojo 反过来——<strong>MLIR 是 IR 本身</strong>。多层方言、可扩展, 同一份程序能 lower 到 CPU / GPU / TPU 任何后端而不动语言层。</> },
    en: { title: <>MLIR-native, not bolted on</>, desc: <>Most languages bolt "AI acceleration" onto the toolchain (TorchScript, JAX trace, TF graph). Mojo inverts that — <strong>MLIR is the IR itself</strong>. Multi-level dialects, extensible, the same program lowers to CPU / GPU / TPU back ends without language-level changes.</> },
    code: <><span className="cl-c"># Mojo source → MLIR → LLVM IR → CPU</span>{'\n'}<span className="cl-c">#                  → PTX     → NVIDIA</span>{'\n'}<span className="cl-c">#                  → ROCm    → AMD</span></>,
  },
  {
    icon: '⌖',
    zh: { title: <>硬件可移植 — 一份内核, 多家芯片</>, desc: <><strong>同一份 Mojo 内核, codegen 到 CPU / NVIDIA / AMD GPU / Apple Silicon</strong>。CUDA 那种"内核绑死一家"的世界正在松动。这是 2026 年 AI 基础设施<strong>最大的争夺点</strong>。</> },
    en: { title: <>Hardware-portable — one kernel, many chips</>, desc: <><strong>The same Mojo kernel codegens to CPU, NVIDIA, AMD GPU, and Apple Silicon</strong>. The CUDA-era world of "one kernel, one vendor" is loosening. This is the <strong>biggest contested ground</strong> in 2026's AI infrastructure.</> },
    code: <><span className="cl-c"># mojo build matmul.mojo --target=cuda</span>{'\n'}<span className="cl-c"># mojo build matmul.mojo --target=rocm</span>{'\n'}<span className="cl-c"># mojo build matmul.mojo --target=cpu</span></>,
  },
  {
    icon: '⌘',
    zh: { title: <>Lattner 履历 — 每一步都进基础设施</>, desc: <>2003 LLVM → 2007 Clang → 2014 Swift → 2017 MLIR → 2023 Mojo。Lattner 拿出来过的<strong>每一项都成了行业基础设施</strong>。Mojo 是不是, 时间会答; 但<strong>履历是开发者愿意下注的最强信号</strong>。</> },
    en: { title: <>Lattner's track record</>, desc: <>2003 LLVM → 2007 Clang → 2014 Swift → 2017 MLIR → 2023 Mojo. <strong>Every project Lattner has shipped became industry infrastructure</strong>. Whether Mojo joins them, time will tell — but <strong>the resume is the strongest signal developers bet on</strong>.</> },
    code: <><span className="cl-c"># LLVM     · 2003 — every modern compiler</span>{'\n'}<span className="cl-c"># Clang    · 2007 — C/C++/ObjC frontend</span>{'\n'}<span className="cl-c"># Swift    · 2014 — Apple full stack</span>{'\n'}<span className="cl-c"># MLIR     · 2017 — AI compiler IR</span>{'\n'}<span className="cl-c"># Mojo     · 2023 — ?</span></>,
  },
  {
    icon: '⚛',
    zh: { title: <>CUDA 垄断的第一道裂缝</>, desc: <>过去 15 年 GPU 编程 = CUDA C++。Mojo + ROCm 后端是 OpenCL 之后<strong>第一个有可信进展的 CUDA 替代</strong>: 开源内核、开源 IR、开放竞争。<em>不是"打败 CUDA", 而是"<strong>给替代者一个真路径</strong>"</em>。</> },
    en: { title: <>The first credible crack in CUDA's monopoly</>, desc: <>For 15 years, GPU programming meant CUDA C++. Mojo plus its ROCm back end is the <strong>first credible CUDA challenger since OpenCL</strong>: open kernels, open IR, open competition. <em>Not "kill CUDA," but "<strong>finally give an alternative a real path</strong>"</em>.</> },
    code: <><span className="cl-c"># single kernel source · NVIDIA + AMD</span>{'\n'}<span className="cl-c"># open IR · open stdlib · Apache 2.0</span></>,
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
    href: 'https://www.modular.com', highlight: true,
    zhName: 'Modular MAX', enName: 'Modular MAX',
    zhNote: '自家推理引擎 · Mojo 的家', enNote: 'In-house inference engine · home of Mojo',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0A0A0A"/><path d="M22 70 V30 L36 56 L50 30 L64 56 L78 30 V70" stroke="#FF4B00" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    href: 'https://replit.com', highlight: true,
    zhName: 'Replit', enName: 'Replit',
    zhNote: '代码执行 + AI 推理', enNote: 'Code execution + AI inference',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#F26207"/><path d="M30 28 H50 V48 H30 Z M50 48 H70 V68 H50 Z M30 68 H50 V88 H30 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://www.together.ai', highlight: true,
    zhName: 'Together AI', enName: 'Together AI',
    zhNote: '推理云 · 用 Mojo 写内核', enNote: 'Inference cloud · Mojo-written kernels',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0F2A3D"/><circle cx="38" cy="50" r="14" fill="none" stroke="#5DDCAA" strokeWidth="5"/><circle cx="62" cy="50" r="14" fill="none" stroke="#FFB347" strokeWidth="5"/></svg>,
  },
  {
    href: 'https://github.com/modular/max',
    zhName: 'MAX Kernels', enName: 'MAX Kernels',
    zhNote: 'matmul / softmax / attention', enNote: 'matmul / softmax / attention',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A0E0C"/><text x="50" y="58" textAnchor="middle" fill="#FF7A33" fontSize="18" fontWeight="700" fontFamily="monospace">MAX</text></svg>,
  },
  {
    href: 'https://www.modular.com/blog',
    zhName: 'AI Robotics', enName: 'AI Robotics',
    zhNote: '边缘推理 · 实时控制', enNote: 'Edge inference · realtime control',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#10080A"/><rect x="30" y="34" width="40" height="32" rx="6" fill="none" stroke="#FF7A33" strokeWidth="4"/><circle cx="42" cy="48" r="3" fill="#FF7A33"/><circle cx="58" cy="48" r="3" fill="#FF7A33"/><line x1="44" y1="58" x2="56" y2="58" stroke="#FF7A33" strokeWidth="3" strokeLinecap="round"/><line x1="50" y1="34" x2="50" y2="22" stroke="#FF7A33" strokeWidth="3"/></svg>,
  },
  {
    href: 'https://www.modular.com/blog',
    zhName: 'Quant Finance', enName: 'Quant Finance',
    zhNote: '低延迟数值内核', enNote: 'Low-latency numeric kernels',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0F0F0F"/><polyline points="20,72 35,52 50,62 65,38 80,46" stroke="#FF7A33" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round"/><line x1="20" y1="80" x2="80" y2="80" stroke="#666" strokeWidth="2"/></svg>,
  },
  {
    href: 'https://www.modular.com/blog',
    zhName: 'Drug Discovery', enName: 'Drug Discovery',
    zhNote: '分子模拟 · GPU 后端', enNote: 'Molecular simulation · GPU backend',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#10080A"/><circle cx="35" cy="42" r="8" fill="#FF7A33"/><circle cx="62" cy="38" r="8" fill="#5DDCAA"/><circle cx="50" cy="68" r="8" fill="#FFB347"/><line x1="35" y1="42" x2="62" y2="38" stroke="#fff" strokeWidth="2"/><line x1="62" y1="38" x2="50" y2="68" stroke="#fff" strokeWidth="2"/><line x1="50" y1="68" x2="35" y2="42" stroke="#fff" strokeWidth="2"/></svg>,
  },
  {
    href: 'https://github.com/modular/mojo',
    zhName: 'Open stdlib', enName: 'Open stdlib',
    zhNote: 'Apache 2.0 · 社区贡献', enNote: 'Apache 2.0 · community PRs',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#161B22"/><path d="M50 18 C32 18 18 32 18 50 C18 64 27 76 40 80 C42 80 43 79 43 77 V70 C32 72 30 65 30 65 C28 60 26 59 26 59 C22 56 26 56 26 56 C30 56 32 60 32 60 C36 66 42 64 44 63 C44 60 46 58 47 57 C36 56 26 52 26 36 C26 32 28 28 32 25 C32 24 30 21 32 16 C32 16 36 16 43 21 C46 20 51 20 56 21 C63 16 67 16 67 16 C69 21 67 24 67 25 C71 28 73 32 73 36 C73 52 63 56 52 57 C54 58 56 61 56 65 V77 C56 79 57 80 59 80 C72 76 81 64 81 50 C81 32 67 18 50 18 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://www.modular.com/blog',
    zhName: 'Edge Inference', enName: 'Edge Inference',
    zhNote: 'IoT / 移动端推理', enNote: 'IoT / mobile inference',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#10080A"/><rect x="36" y="22" width="28" height="56" rx="4" fill="none" stroke="#FF7A33" strokeWidth="3"/><circle cx="50" cy="68" r="3" fill="#FF7A33"/><line x1="44" y1="32" x2="56" y2="32" stroke="#FF7A33" strokeWidth="2"/></svg>,
  },
  {
    href: 'https://www.modular.com/blog',
    zhName: 'Research Labs', enName: 'Research Labs',
    zhNote: '编译器 / ML 系统组', enNote: 'Compiler / ML-systems groups',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#101820"/><path d="M30 24 H44 V44 L60 76 H40 L24 76 Z M56 24 H70 V44 L86 76 H66" fill="none" stroke="#5DDCAA" strokeWidth="3" strokeLinejoin="round"/></svg>,
  },
];

interface AdoptItem { name: string; zhDesc: string; enDesc: string }
const ADOPT_TOOLS: AdoptItem[] = [
  { name: 'MAX Engine',     zhDesc: 'Modular 推理 runtime',          enDesc: 'Modular inference runtime' },
  { name: 'Mojo stdlib',    zhDesc: '开源 Apache 2.0',                enDesc: 'Open source · Apache 2.0' },
  { name: 'magic',          zhDesc: '官方包管理器',                   enDesc: 'Official package manager' },
  { name: 'MLIR',           zhDesc: '底层 IR · LLVM 生态',            enDesc: 'Underlying IR · LLVM family' },
  { name: 'Mojo Playground',zhDesc: '浏览器内试用',                   enDesc: 'In-browser sandbox' },
  { name: 'CUDA backend',   zhDesc: 'NVIDIA H100 / A100',             enDesc: 'NVIDIA H100 / A100' },
  { name: 'ROCm backend',   zhDesc: 'AMD GPU · 2025-09',              enDesc: 'AMD GPU · 2025-09' },
  { name: 'Apple Silicon',  zhDesc: 'M 系列 codegen',                 enDesc: 'M-series codegen' },
  { name: 'Python interop', zhDesc: 'import 任意 PyPI 包',            enDesc: 'Import any PyPI package' },
  { name: 'PyTorch bridge', zhDesc: 'tensor 互操作',                  enDesc: 'Tensor interop' },
  { name: 'NumPy bridge',   zhDesc: 'array buffer 共享',              enDesc: 'Shared array buffers' },
  { name: 'Triton (cmp)',   zhDesc: 'OpenAI · GPU 内核竞品',          enDesc: 'OpenAI · GPU-kernel rival' },
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
    tag: <>HOT · 2026+</>, hot: true, big: true,
    zh: {
      title: <>编译器开源 — 1.0 路上的最后一道门</>,
      body: (<>
        <p>2024 年标准库已开源, <strong>编译器仍闭源</strong>。社区给的压力一直在: 想 fork、想嵌、想审 codegen。Modular 公开承诺<strong>"在 1.0 之前完成开源"</strong>, 节奏跟早年 Swift 几乎一致。</p>
        <p>意义: 这是 Mojo 从"<em>有趣的 Modular 产品</em>"变成"<strong>真正的工业语言</strong>"的最后一关。开源后才会有第三方编译器、教学发行版、跨厂商 RFC 体系——Rust 那种。</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label"><L zh="编译器闭源 (2026 当下)" en="Compiler closed (today, 2026)" /></span><span className="bar-val">~1%</span></div>
          <div className="bar bar-new"><span className="bar-label"><L zh="编译器开源 (1.0 后)" en="Compiler open (post-1.0)" /></span><span className="bar-val">100%</span></div>
        </div>
      </>),
    },
    en: {
      title: <>Open-sourcing the compiler — the last gate on the way to 1.0</>,
      body: (<>
        <p>The stdlib opened in 2024; <strong>the compiler is still closed</strong>. Community pressure to fork, embed and audit codegen has been steady. Modular has publicly committed to <strong>"open it before 1.0"</strong> — the cadence mirrors early Swift's exactly.</p>
        <p>What it unlocks: this is the final gate between "<em>an interesting Modular product</em>" and "<strong>a real industrial language</strong>." Only after open-source do you get third-party compilers, teaching distros, and a cross-vendor RFC process — the Rust pattern.</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">Compiler closed (today, 2026)</span><span className="bar-val">~1%</span></div>
          <div className="bar bar-new"><span className="bar-label">Compiler open (post-1.0)</span><span className="bar-val">100%</span></div>
        </div>
      </>),
    },
  },
  {
    tag: 'INTEROP',
    zh: { title: <>NumPy / PyTorch ABI 深度</>, body: <><p>当前 Mojo 与 Python 互通靠<strong>Python.import_module</strong>跨 GIL, 数据要 round-trip。下一步是<strong>共享 buffer / 零拷贝 tensor</strong>——把 PyTorch <code>Tensor</code> 直接当 Mojo struct 操作, 数据不动。这是从"快但隔" 走向"快且无缝"的一步。</p></> },
    en: { title: <>Deeper NumPy / PyTorch ABI</>, body: <><p>Today's Python interop crosses the GIL via <strong>Python.import_module</strong>; data has to round-trip. The next step is <strong>shared buffers / zero-copy tensors</strong> — operating on a PyTorch <code>Tensor</code> as a Mojo struct without moving the bytes. The path from "fast but isolated" to "fast and seamless."</p></> },
  },
  {
    tag: 'MLX',
    zh: { title: <>Apple MLX — 同生态位的对手</>, body: <><p>Apple 自己 2023 年放出 <strong>MLX</strong>: 也是 NumPy 风、也针对 Apple Silicon、也 LLVM/MLIR 风格。Mojo 在 macOS 上等于和"亲生的"竞争。<em>Lattner 当年走的, 苹果用 MLX 接上了——这条线他比谁都清楚</em>。</p></> },
    en: { title: <>Apple MLX — direct competition</>, body: <><p>Apple shipped <strong>MLX</strong> in 2023: NumPy-style, Apple-Silicon-tuned, LLVM/MLIR-flavoured. On macOS, Mojo competes with Apple's first-party stack. <em>The very line Lattner walked away from, Apple has now picked up — he sees this competitor more clearly than anyone</em>.</p></> },
  },
  {
    tag: 'GENERAL',
    zh: { title: <>通用系统语言 ?</>, body: <><p>2026 的 Mojo <strong>定位是 AI</strong>, 但语言本身够通用——struct + ownership + SIMD + MLIR 没有什么"AI-only"的设计。它能不能跳出 AI、和 Rust 抢通用系统编程的地盘? <em>取决于 1.0 后社区把它推向哪里</em>。<strong>这是开放问题, 不是路线图</strong>。</p></> },
    en: { title: <>A general-purpose systems language?</>, body: <><p>Mojo in 2026 is <strong>positioned for AI</strong>, but the language itself is general — struct + ownership + SIMD + MLIR has no "AI-only" baked in. Can it leave the AI niche and challenge Rust for general systems work? <em>Depends on where the post-1.0 community pushes it</em>. <strong>An open question, not a roadmap item</strong>.</p></> },
  },
];

export default function MojoIntroPage() {
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  const rootRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(
    'Mojo : Python 语法 · C 速度 · MLIR IR — Lattner 的第三门语言',
    'Mojo : Python syntax, C-class speed, MLIR IR — Lattner\'s third language'
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
        a.style.color = a.getAttribute('href') === '#' + cur ? 'var(--mojo-bright)' : '';
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
      <div ref={rootRef} className="mojo-intro-root">
        <div className="grid-bg" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            <svg viewBox="0 0 256 256" width="28" height="28">
              <defs>
                <linearGradient id="mo-nav" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FF7A33" />
                  <stop offset="100%" stopColor="#993000" />
                </linearGradient>
                <linearGradient id="mo-nav-flame" x1="50%" y1="0%" x2="50%" y2="100%">
                  <stop offset="0%" stopColor="#FFD8A8" />
                  <stop offset="100%" stopColor="#FF4B00" />
                </linearGradient>
              </defs>
              <rect width="256" height="256" rx="28" fill="url(#mo-nav)" />
              <path
                d="M138 28 C150 60 178 78 188 116 C198 156 174 196 134 212 C152 188 152 162 134 142 C140 168 124 188 100 196 C72 200 52 178 56 148 C60 124 80 108 96 86 C104 72 102 58 96 44 C112 56 122 48 122 32 C128 38 134 38 138 28 Z"
                fill="url(#mo-nav-flame)"
              />
            </svg>
            <span>Mojo</span>
            <span className="nav-tag"><L zh=": 中文导览" en=": Guide" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#system"><L zh="语言" en="Language" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#projects"><L zh="谁用" en="Adopters" /></a></li>
            <li><a href="#ai"><L zh="AI 时代" en="AI Era" /></a></li>
            <li><a href="#vs"><L zh="对比" en="vs Python" /></a></li>
            <li><a href="#future"><L zh="前景" en="Outlook" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 2023 — 2026 · Modular · Chris Lattner · Python syntax / C speed / MLIR IR</div>
            <h1 className="hero-title">
              <span className="hero-name">Mojo</span>
              <span className="hero-colon">:</span>
              <span className="hero-type">AIKernel</span>
            </h1>
            <p className="hero-sub">
              <L
                zh={<>用 <strong>Python 的语法</strong>写, 用 <strong>C 的速度</strong>跑, 编译器底下接 <strong>MLIR</strong>——这是 Chris Lattner 2023 年立下的目标。三年后 Mojo 已在前沿 AI 实验室做生产推理, 一份内核 codegen 到 NVIDIA / AMD / Apple Silicon, 是<strong>OpenCL 之后第一个有可信进展的 CUDA 替代</strong>。</>}
                en={<>Write <strong>Python's syntax</strong>, run at <strong>C's speed</strong>, with <strong>MLIR</strong> under the hood — the goal Chris Lattner set in 2023. Three years on, Mojo runs production inference at frontier AI labs, codegens one kernel to NVIDIA / AMD / Apple Silicon, and is the <strong>first credible CUDA challenger since OpenCL</strong>.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">2023<small></small></span>
                <span className="stat-label"><L zh={<>5 月 2 日 公开发布<br /><em>Modular Keynote</em></>} en={<>Unveiled May 2<br /><em>Modular Keynote</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">35k<small>×</small></span>
                <span className="stat-label"><L zh={<>matmul vs Python<br /><em>首场 demo · 同硬件</em></>} en={<>matmul vs Python<br /><em>launch demo · same hw</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">3<small> arch</small></span>
                <span className="stat-label"><L zh={<>NVIDIA / AMD / Apple<br /><em>同源内核 · MLIR codegen</em></>} en={<>NVIDIA / AMD / Apple<br /><em>one kernel · MLIR codegen</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">→1.0<small></small></span>
                <span className="stat-label"><L zh={<>编译器开源前夜<br /><em>magic · stable stdlib</em></>} en={<>Pre-1.0 · pre-open<br /><em>magic · stable stdlib</em></>} /></span>
              </div>
            </div>
            <div className="hero-cube">
              <div className="hero-cube-face f-front">{MOJO_LOGO_SVG}</div>
            </div>
            <div className="hero-floats">
              <span className="float f1">fn matmul</span>
              <span className="float f2">{'SIMD[f32, 8]'}</span>
              <span className="float f3">@parameter</span>
              <span className="float f4">borrow / inout</span>
              <span className="float f5">@value</span>
              <span className="float f6">alias N = 1024</span>
              <span className="float f7">MLIR</span>
              <span className="float f8">def vs fn</span>
              <span className="float f9">@always_inline</span>
              <span className="float f10">struct Tensor</span>
              <span className="float f11">PTX · ROCm</span>
              <span className="float f12">from python import</span>
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
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>Mojo</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>Mojo 是 <strong>2023 年由 Modular (Chris Lattner) 发布的 AI 系统编程语言</strong>。设计目标干脆: 把 <strong>Python 的语法亲和度</strong> 和 <strong>C / Rust 级别的性能</strong> 焊在一起, 编译器底下走 <strong>MLIR</strong>——这是 Lattner 自己 2017 年在 Google 主导的 AI 编译器 IR。</>}
                  en={<>Mojo is an <strong>AI systems language released in 2023 by Modular (Chris Lattner)</strong>. The design goal is blunt: weld <strong>Python-grade syntax</strong> onto <strong>C/Rust-grade performance</strong>, with <strong>MLIR</strong> under the hood — the same AI compiler IR Lattner led at Google in 2017.</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="Python 超集 (目标)" en="Python superset (goal)" />, tag: 'syntax', p: <L zh={<>语法层面 Mojo <strong>朝 Python 超集靠</strong>: <code>def</code>、缩进、<code>import</code> 几乎一致。<em>"超集"是路线目标, 不是当下完整状态</em>——少数 Python 边角今天还跑不了。</>} en={<>Syntactically Mojo <strong>aims to be a Python superset</strong>: <code>def</code>, indentation, <code>import</code> are nearly identical. <em>"Superset" is the roadmap, not today's exact state</em> — a few Python corner cases still don't run.</>} /> },
                { h: <L zh="MLIR 原生" en="MLIR native" />, tag: 'compiler', p: <L zh={<>编译器底层 IR 直接是 <strong>MLIR</strong>, 不是 LLVM IR。多层方言、可扩展, 同一份程序 lower 到 CPU / GPU / TPU。这是 Mojo 跟其它"加速 Python"项目最大的结构差。</>} en={<>The compiler's IR is <strong>MLIR</strong> directly — not LLVM IR. Multi-level dialects, extensible, the same program lowers to CPU / GPU / TPU. This is the deepest structural gap between Mojo and every other "speed up Python" project.</>} /> },
                { h: <L zh="所有权 + GC 缺席" en="Ownership · no GC" />, tag: 'memory', p: <L zh={<><strong>borrow / inout / owned</strong> 三种参数语义, 没有 GC, struct 默认走值类型。Rust 的内存模型, 但<strong>不要写生命周期标注</strong>——靠注解 + 推断。</>} en={<>Three parameter conventions — <strong>borrow / inout / owned</strong> — no GC, structs default to value types. Rust's memory model <strong>without writing lifetime annotations</strong> — annotations plus inference do the work.</>} /> },
                { h: <L zh="SIMD / GPU 一等" en="SIMD / GPU first-class" />, tag: 'parallel', p: <L zh={<><strong>SIMD 是类型</strong>而不是 intrinsic; GPU codegen 通过 MLIR → PTX (NVIDIA) / ROCm (AMD)。<em>没有"用 Mojo 调 CUDA"——你写的就是内核</em>。</>} en={<><strong>SIMD is a type</strong>, not an intrinsic; GPU codegen flows through MLIR → PTX (NVIDIA) / ROCm (AMD). <em>You don't "call CUDA from Mojo" — what you write IS the kernel</em>.</>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">matmul.py</span><span className="lang-tag js">Pure Python</span></div>
                <pre className="code"><code>
                  <span className="cl-k">def</span> <span className="cl-fn">matmul</span>(a, b, c, n):{'\n'}
                  {'    '}<span className="cl-k">for</span> i <span className="cl-k">in</span> <span className="cl-fn">range</span>(n):{'\n'}
                  {'        '}<span className="cl-k">for</span> j <span className="cl-k">in</span> <span className="cl-fn">range</span>(n):{'\n'}
                  {'            '}<span className="cl-k">for</span> k <span className="cl-k">in</span> <span className="cl-fn">range</span>(n):{'\n'}
                  {'                '}c[i][j] += a[i][k] * b[k][j]{'\n\n'}
                  <span className="cl-c"><L zh="# 1024×1024 矩阵 ≈ 几分钟级别" en="# 1024×1024 matrix · minutes-class runtime" /></span>{'\n'}
                  <span className="cl-c"><L zh="# 解释执行 + 引用计数 + 全部走对象路径" en="# interpreted + refcounted + everything boxed" /></span>
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">matmul.mojo</span><span className="lang-tag ts">Mojo</span></div>
                <pre className="code"><code>
                  <span className="cl-k">fn</span> <span className="cl-fn">matmul</span>(<span className="cl-k">inout</span> c: <span className="cl-type">Matrix</span>,{'\n'}
                  {'           '}a: <span className="cl-type">Matrix</span>, b: <span className="cl-type">Matrix</span>):{'\n'}
                  {'    '}<span className="cl-k">alias</span> nelts = <span className="cl-fn">simdwidthof</span>[<span className="cl-type">DType</span>.float32](){'\n'}
                  {'    '}<span className="cl-k">for</span> i <span className="cl-k">in</span> <span className="cl-fn">range</span>(c.rows):{'\n'}
                  {'        '}<span className="cl-k">for</span> k <span className="cl-k">in</span> <span className="cl-fn">range</span>(a.cols):{'\n'}
                  {'            '}<span className="cl-k">@parameter</span>{'\n'}
                  {'            '}<span className="cl-k">fn</span> <span className="cl-fn">v</span>[w: <span className="cl-type">Int</span>](j: <span className="cl-type">Int</span>):{'\n'}
                  {'                '}c.<span className="cl-fn">store</span>[w](i, j,{'\n'}
                  {'                  '}c.<span className="cl-fn">load</span>[w](i, j){'\n'}
                  {'                  '}+ a[i,k] * b.<span className="cl-fn">load</span>[w](k, j)){'\n'}
                  {'            '}<span className="cl-fn">vectorize</span>[v, nelts](c.cols){'\n\n'}
                  <span className="cl-c"><L zh="# Modular 公布: 同硬件 ~35,000× Python 解释执行" en="# Modular's number: ~35,000× over interpreted Python" /></span>
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
                zh={<>Mojo 不是 2023 年凭空冒出来的——它是 Lattner 从 2003 LLVM 论文一路走来的<strong>第三门语言</strong>。这条线穿过 LLVM、Clang、Swift (<a href="/code/swift">/code/swift</a>)、Tesla、Google Brain 的 MLIR, 最后在 Modular 落地。</>}
                en={<>Mojo didn't appear from nowhere in 2023 — it is Lattner's <strong>third language</strong>, on a line that runs from his 2003 LLVM thesis through LLVM, Clang, Swift (<a href="/code/swift">/code/swift</a>), Tesla, Google Brain's MLIR, and finally lands at Modular.</>}
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
              <h2 className="sec-title"><L zh="语言精要" en="Language Essentials" /> <code>: MojoAlphabet</code></h2>
              <p className="sec-desc"><L
                zh={<>下面 8 张卡是 Mojo 跟其它 11 门语言<strong>最不一样的地方</strong>: <code>def</code> vs <code>fn</code>、ownership 注解、<code>@parameter</code>、SIMD 类型、<code>@value</code>、struct vs class、<code>alias</code>、perf 注解。第 9 张是 Python 超集的现状。</>}
                en={<>The eight cards below are where Mojo <strong>differs hardest</strong> from the other 11 languages on this site: <code>def</code> vs <code>fn</code>, ownership annotations, <code>@parameter</code>, SIMD types, <code>@value</code>, struct vs class, <code>alias</code>, perf annotations. The ninth covers the Python-superset story today.</>}
              /></p>
            </header>

            <div className="ts-grid">
              {MO_CARDS.map((c, i) => (
                <div className="ts-card" key={i}>
                  <div className="ts-tag">{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="ts-code">{c.code}</pre>
                </div>
              ))}
              <div className="ts-card ts-callout">
                <div className="ts-tag ts-tag-soft">∞</div>
                <h3><L zh={<>Python 超集 — 当下做到了多少</>} en={<>Python superset — how far it actually goes today</>} /></h3>
                <p><L
                  zh={<>"Python 超集"是 Modular 公开口号, 但<strong>2026 年的现状是: 大部分 Python 跑得动, 角落跑不动</strong>。能跑: <code>def</code>、列表 / 字典字面量、缩进、<code>import</code> 第三方包 (跨 GIL)。不能跑: 元类全套、<code>exec</code> / <code>eval</code> 动态字节码、部分 dunder 协议。<em>"用 Mojo 当 Python 用"基本可行, 但别期望 100%。</em></>}
                  en={<>"Python superset" is Modular's public slogan, but <strong>in 2026 the reality is: most Python runs, corners don't</strong>. Working: <code>def</code>, list/dict literals, indentation, <code>import</code> for third-party packages (over the GIL). Not working: full metaclass machinery, <code>exec</code> / <code>eval</code> dynamic bytecode, parts of the dunder protocol. <em>"Use Mojo as Python" largely works — just don't expect 100%</em>.</>}
                /></p>
                <p className="ts-callout-quote">"<em><L
                  zh={<>Python 兼容是路线, 不是当下的完整状态——Modular 自己也说得很清楚。</>}
                  en={<>Python compatibility is a roadmap, not a finished checklist — Modular itself is explicit about this.</>}
                /></em>"</p>
              </div>
            </div>
          </section>

          {/* 04 Why */}
          <section className="section" id="why">
            <header className="sec-head">
              <span className="sec-num">04</span>
              <h2 className="sec-title"><L zh="为何要用" en="Why Mojo" /> <code>: WhyMojo</code></h2>
              <p className="sec-desc"><L
                zh={<>Mojo 不试图替代 Python 写脚本, 也不试图替代 Rust 写 OS——它瞄准的是<strong>过去 15 年没人正面解决的那个空隙</strong>: AI 内核要又快又便携, 又不想让算法工程师下沉到 CUDA C++。</>}
                en={<>Mojo isn't out to replace Python for scripting, or Rust for OS work. It targets <strong>the gap nobody filled in the last 15 years</strong>: AI kernels that are both fast and portable, without forcing ML engineers to drop down into CUDA C++.</>}
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

          {/* 05 Adopters */}
          <section className="section" id="projects">
            <header className="sec-head">
              <span className="sec-num">05</span>
              <h2 className="sec-title"><L zh="谁在用" en="Who's Using" /> <code>: ProductionUsers</code></h2>
              <p className="sec-desc"><L
                zh={<>Mojo 还年轻, 名单远比 Python 短——但<strong>每一个都是真用户, 没编</strong>。Modular 自家 MAX 是最大用户; Replit、Together AI 是公开点过名的 AI 平台; 剩下是 Modular 博客提到的机器人、量化金融、药物发现领域的几家。</>}
                en={<>Mojo is young; the list is far shorter than Python's — but <strong>every entry is a real user, none invented</strong>. Modular's own MAX is the biggest; Replit and Together AI are publicly named AI platforms; the rest are robotics / quant-finance / drug-discovery shops Modular has called out on its blog.</>}
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

          {/* 06 AI Era */}
          <section className="section section-ai" id="ai">
            <header className="sec-head">
              <span className="sec-num ai-num">06</span>
              <h2 className="sec-title"><L zh="AI 时代" en="The AI Era" /> <code>: <L zh="为 AI 而生" en="Built For AI" /></code></h2>
              <p className="sec-desc"><L
                zh={<>这是这一页的<strong>核心</strong>: Mojo 是少数<strong>从第一天就为 AI 时代设计</strong>的语言, 不是把 AI 塞进既有语言。<strong>PyTorch / vLLM / TensorRT-LLM</strong> 是上层框架, Mojo 站在它们<strong>旁边</strong> (内核层), 不是替代它们。</>}
                en={<>This is the <strong>heart</strong> of the page: Mojo is one of the very few languages <strong>designed for the AI era from day one</strong>, rather than retrofitted. <strong>PyTorch / vLLM / TensorRT-LLM</strong> are upper-layer frameworks; Mojo stands <strong>beside</strong> them at the kernel layer, not as a replacement.</>}
              /></p>
            </header>

            <blockquote className="quote-block">
              <div className="quote-mark">"</div>
              <p className="quote-text"><L
                zh={<>过去 15 年, AI 整个堆栈被 <strong>"Python 调 CUDA C++"</strong> 这一根线绑死。算法工程师写 Python, 性能工程师写 CUDA, 中间隔一道墙。我们做 Mojo 不是要让 Python 变快——是想让<strong>同一个人, 同一份语言</strong>, 把算法和内核都写完。</>}
                en={<>For fifteen years the AI stack has been pinned to a single thread: <strong>Python calling CUDA C++</strong>. Algorithm engineers write Python, performance engineers write CUDA, with a wall between them. We're not building Mojo to make Python faster — we want <strong>the same person, in the same language</strong>, to write both the algorithm and the kernel.</>}
              /></p>
              <footer className="quote-footer">
                <span className="quote-author">— Chris Lattner</span>
                <span className="quote-context"><L zh="Modular CEO · LLVM / Swift / MLIR / Mojo · 多次访谈与 keynote" en="Modular CEO · LLVM / Swift / MLIR / Mojo · paraphrased from interviews + keynotes" /></span>
              </footer>
            </blockquote>

            <div className="ai-stats">
              <div className="ai-stat">
                <div className="ai-stat-num">35k<small>×</small></div>
                <div className="ai-stat-h"><L zh="matmul vs Python · 同硬件" en="matmul vs Python · same hardware" /></div>
                <p><L
                  zh={<>Modular 首场 demo 公布的数字: <strong>1024×1024 float32 矩阵乘法</strong>, Mojo SIMD + tile + parallelize 写的内核 vs 朴素 Python 三层 for, 跑在同一台 Intel Xeon 上 ~<strong>35,000×</strong>。<em>narrowly defined: 单个内核 / 同硬件 / 解释 Python 基线</em>——这是它真实的范围。</>}
                  en={<>Modular's launch-demo number: a <strong>1024×1024 float32 matmul</strong>, Mojo with SIMD + tiling + parallelize vs three nested Python <code>for</code> loops, on the same Intel Xeon ≈ <strong>35,000×</strong>. <em>Narrowly defined: one kernel, same hardware, interpreted Python baseline</em> — those are the real bounds.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">~7<small>×</small></div>
                <div className="ai-stat-h"><L zh="softmax vs PyTorch CUDA" en="softmax vs PyTorch CUDA" /></div>
                <p><L
                  zh={<>更接近真实生产的对比: Modular 公布的 <strong>fused softmax</strong> 在 H100 上比 PyTorch eager 快约 7×, 跟 Triton (OpenAI) 同档。换 kernel 换 hardware 数字会变, 但<strong>"跟手写 CUDA 同档"</strong>这条结论稳定。</>}
                  en={<>A more realistic comparison: Modular's <strong>fused softmax</strong> on H100 is roughly 7× faster than PyTorch eager and on par with Triton (OpenAI). Numbers shift across kernels and hardware, but the conclusion <strong>"on par with hand-written CUDA"</strong> is stable.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">3<small> targets</small></div>
                <div className="ai-stat-h"><L zh="同源内核, 多家芯片" en="One kernel, multiple vendors" /></div>
                <p><L
                  zh={<>同一份 <code>.mojo</code>: <strong>NVIDIA (PTX)</strong>、<strong>AMD (ROCm)</strong>、<strong>Apple Silicon</strong>。<em>OpenCL 之后第一次有可信路径</em>。CUDA 垄断不是被打破, 是<strong>第一次被开口子</strong>——从这里开始的事情值得长期关注。</>}
                  en={<>One <code>.mojo</code> file targets <strong>NVIDIA (PTX)</strong>, <strong>AMD (ROCm)</strong>, <strong>Apple Silicon</strong>. <em>The first credible path since OpenCL</em>. CUDA's monopoly isn't broken — it's <strong>cracked for the first time</strong>, and what grows from here is worth tracking.</>}
                /></p>
              </div>
            </div>

            <div className="spotlight">
              <div className="spotlight-tag">SPOTLIGHT</div>
              <div className="spotlight-grid">
                <div>
                  <h3>SIMD + GPU <span className="spotlight-meta">— <L zh="一份内核 跑在每片硅上" en="one kernel, every silicon target" /></span></h3>
                  <p><L
                    zh={<>Mojo 的内核长什么样: <strong>SIMD 是类型, GPU 是后端</strong>。代码里你写 <code>SIMD[DType.float32, 8]</code>, 编译器对着目标平台决定具化成 AVX-512 / NEON / PTX 还是 ROCm。<em>同源, 不抽象, 不丢性能</em>。</>}
                    en={<>What a Mojo kernel looks like: <strong>SIMD is a type, GPU is a back end</strong>. You write <code>SIMD[DType.float32, 8]</code>; the compiler, given a target, lowers it to AVX-512 / NEON / PTX / ROCm. <em>One source, no abstraction tax, no performance lost</em>.</>}
                  /></p>
                  <ul className="spotlight-list">
                    <li><strong>SIMD type</strong> — <L zh="参数化向量, 算术自动并行" en="parametric vector, arithmetic auto-parallel" /></li>
                    <li><strong>GPU codegen</strong> — <L zh="MLIR → PTX (NVIDIA) / ROCm (AMD)" en="MLIR → PTX (NVIDIA) / ROCm (AMD)" /></li>
                    <li><strong>Apple Silicon</strong> — <L zh="M 系列 NEON + Metal compute" en="M-series NEON + Metal compute" /></li>
                    <li><strong>No CUDA C++</strong> — <L zh="不写第三种语言, 不切 build system" en="No third language, no second build system" /></li>
                  </ul>
                  <p><L
                    zh={<>对比 Triton (OpenAI): Triton 走 Python AST + JIT, 受限在 GPU; Mojo 是<strong>独立语言</strong>, 同时覆盖 CPU / GPU / 边缘。两者并存, 不是替代关系。</>}
                    en={<>Compared with Triton (OpenAI): Triton uses a Python AST + JIT, GPU-only; Mojo is a <strong>standalone language</strong> covering CPU / GPU / edge. The two coexist; they don't substitute.</>}
                  /></p>
                </div>
                <div className="spotlight-code">
                  <pre className="code"><code>
                    <span className="cl-c"><L zh="# 一份内核 · 编译到 NVIDIA / AMD / CPU" en="# one kernel · NVIDIA / AMD / CPU" /></span>{'\n'}
                    <span className="cl-k">from</span> tensor <span className="cl-k">import</span> <span className="cl-type">Tensor</span>{'\n'}
                    <span className="cl-k">from</span> algorithm <span className="cl-k">import</span> <span className="cl-fn">vectorize</span>, <span className="cl-fn">parallelize</span>{'\n\n'}
                    <span className="cl-k">fn</span> <span className="cl-fn">softmax</span>(<span className="cl-k">inout</span> x: <span className="cl-type">Tensor</span>[<span className="cl-type">DType</span>.float32]):{'\n'}
                    {'    '}<span className="cl-k">alias</span> nelts = <span className="cl-fn">simdwidthof</span>[<span className="cl-type">DType</span>.float32](){'\n\n'}
                    {'    '}<span className="cl-k">@parameter</span>{'\n'}
                    {'    '}<span className="cl-k">fn</span> <span className="cl-fn">row</span>(i: <span className="cl-type">Int</span>):{'\n'}
                    {'        '}<span className="cl-k">var</span> m = x.<span className="cl-fn">row_max</span>(i){'\n'}
                    {'        '}<span className="cl-k">var</span> s: <span className="cl-type">Float32</span> = <span className="cl-n">0</span>{'\n'}
                    {'        '}<span className="cl-k">@parameter</span>{'\n'}
                    {'        '}<span className="cl-k">fn</span> <span className="cl-fn">v</span>[w: <span className="cl-type">Int</span>](j: <span className="cl-type">Int</span>):{'\n'}
                    {'            '}<span className="cl-k">var</span> e = <span className="cl-fn">exp</span>(x.<span className="cl-fn">load</span>[w](i,j) - m){'\n'}
                    {'            '}x.<span className="cl-fn">store</span>[w](i, j, e){'\n'}
                    {'            '}s += e.<span className="cl-fn">reduce_add</span>(){'\n'}
                    {'        '}<span className="cl-fn">vectorize</span>[v, nelts](x.cols){'\n'}
                    {'        '}<span className="cl-fn">scale_row</span>(x, i, <span className="cl-n">1</span>/s){'\n\n'}
                    {'    '}<span className="cl-fn">parallelize</span>[row](x.rows){'\n\n'}
                    <span className="cl-c"><L zh="# 编译: mojo build softmax.mojo --target=cuda" en="# build: mojo build softmax.mojo --target=cuda" /></span>{'\n'}
                    <span className="cl-c"><L zh="#       mojo build softmax.mojo --target=rocm" en="#        mojo build softmax.mojo --target=rocm" /></span>
                  </code></pre>
                </div>
              </div>
            </div>

            <div className="ai-tools">
              <h3 className="ai-tools-h"><L zh="2026 工具链 / 后端 / 周边" en="2026 toolchain / backends / surroundings" /></h3>
              <div className="ai-tools-grid">
                {ADOPT_TOOLS.map((t, i) => (
                  <div className="ai-tool" key={i}>
                    <div className="ai-tool-name">{t.name}</div>
                    <div className="ai-tool-desc">{lang === 'zh' ? t.zhDesc : t.enDesc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="ai-reverse">
              <div className="ai-reverse-text">
                <div className="ai-reverse-tag">AI ERA</div>
                <h3><L zh="反直觉: AI 写 Mojo 会更难" en="Counter-intuitive: AIs write Mojo worse than older languages" /></h3>
                <p><L
                  zh={<>这是 Mojo 一个有趣的悖论: <strong>它是一门 AI 时代的语言, 但 AI 写它出错率高于 Python / Java / Rust</strong>。原因简单——<strong>训练语料少</strong>。GitHub 公开 Mojo 代码 2026 年量级仍是几千个仓库, 比 Java 少 4 个数量级。</>}
                  en={<>An interesting paradox: <strong>Mojo is an AI-era language, yet LLMs write it less reliably than Python / Java / Rust</strong>. The cause is simple — <strong>less training data</strong>. Public Mojo on GitHub in 2026 is still a few thousand repos, four orders of magnitude below Java.</>}
                /></p>
                <p><L
                  zh={<>实际工作流: <strong>"AI 写 Python 原型 → 人手翻译成 Mojo 内核"</strong>仍然是主流。Modular 自家也在做"AI 辅助 Mojo 写作"工具, 把官方 stdlib + 文档喂给模型, 但<strong>2026 年还远没到"<em>让 AI 自动写内核</em>"</strong>的程度。</>}
                  en={<>Actual workflow: <strong>"AI writes the Python prototype → human translates to a Mojo kernel"</strong> is still dominant. Modular ships its own "AI-assisted Mojo authoring" tooling — feeding the model the stdlib + docs — but in 2026 we're still far from <strong>"let the AI write kernels for you"</strong>.</>}
                /></p>
                <p><L
                  zh={<>讽刺但合理: <strong>所有新语言都要付一次"<em>AI 训练数据冷启动</em>"的税</strong>。Rust 早期遭过, Zig 现在还在遭, Mojo 也躲不过。每个早期 PR / blog / 公开内核都在帮模型学这门语言。</>}
                  en={<>Ironic but expected: <strong>every new language pays a "<em>training-data cold-start tax</em>"</strong>. Rust paid it early; Zig still pays it; Mojo can't dodge it either. Every early PR, blog post and public kernel is teaching the models this language.</>}
                /></p>
              </div>
              <div className="ai-reverse-code">
                <pre className="code"><code>
                  <span className="cl-c"><L zh="# AI 现状: Python prototype → 人手翻 Mojo" en="# Status today: AI writes Python prototype → human ports to Mojo" /></span>{'\n\n'}
                  <span className="cl-c"><L zh="# Python (AI 友好)" en="# Python (AI-friendly)" /></span>{'\n'}
                  <span className="cl-k">def</span> <span className="cl-fn">attention</span>(q, k, v):{'\n'}
                  {'    '}scores = q @ k.<span className="cl-fn">T</span> / <span className="cl-fn">sqrt</span>(dim){'\n'}
                  {'    '}<span className="cl-k">return</span> <span className="cl-fn">softmax</span>(scores) @ v{'\n\n'}
                  <span className="cl-c"><L zh="# Mojo (人手翻 · 拿到内核级速度)" en="# Mojo (human-translated · kernel-class speed)" /></span>{'\n'}
                  <span className="cl-k">fn</span> <span className="cl-fn">attention</span>(<span className="cl-k">borrow</span> q: <span className="cl-type">Tensor</span>,{'\n'}
                  {'              '}<span className="cl-k">borrow</span> k: <span className="cl-type">Tensor</span>,{'\n'}
                  {'              '}<span className="cl-k">borrow</span> v: <span className="cl-type">Tensor</span>) -&gt; <span className="cl-type">Tensor</span>:{'\n'}
                  {'    '}<span className="cl-c"># SIMD-packed matmul + fused softmax</span>{'\n'}
                  {'    '}<span className="cl-c"># vectorize / parallelize / tile</span>{'\n'}
                  {'    '}...
                </code></pre>
              </div>
            </div>

            <div className="ai-takeaway">
              <p><strong><L zh="一句话总结: " en="In one line: " /></strong><L
                zh={<>Mojo 不是"加速 Python"的胶水, 也不是"替代 CUDA"的口号——它是<strong>第一门把算法和 GPU 内核放在同一个语言里的真语言</strong>。2026 年还年轻、生态还小、AI 还不熟, 但<strong>架构是对的</strong>: MLIR + Lattner 履历 + 真生产用户。</>}
                en={<>Mojo isn't "Python glue" and isn't a "CUDA replacement" slogan — it's the <strong>first real language that puts the algorithm and the GPU kernel in one place</strong>. In 2026 it's young, the ecosystem is small, and the AIs still struggle with it — but the <strong>architecture is right</strong>: MLIR + Lattner's track record + real production users.</>}
              /></p>
            </div>
          </section>

          {/* 07 vs Python / Swift */}
          <section className="section" id="vs">
            <header className="sec-head">
              <span className="sec-num">07</span>
              <h2 className="sec-title"><L zh="对比" en="vs Python / Swift" /> <code>: Mojo vs Python vs Swift</code></h2>
              <p className="sec-desc"><L
                zh={<>跟 <strong>Python</strong> 比: Mojo 是 Python 的"<strong>加速出口</strong>", 不是替代。跨链 <a href="/code/python">/code/python</a>。跟 <strong>Swift</strong> 比 (<a href="/code/swift">/code/swift</a>): 同一个设计师 Chris Lattner, 但 Swift 给 app 开发者、Mojo 给 ML 编译器工程师——<em>同人, 两个完全不同的受众</em>。</>}
                en={<>Versus <strong>Python</strong>: Mojo is Python's <strong>acceleration off-ramp</strong>, not a replacement. Cross-link <a href="/code/python">/code/python</a>. Versus <strong>Swift</strong> (<a href="/code/swift">/code/swift</a>): same designer (Chris Lattner), but Swift targets app developers and Mojo targets ML compiler engineers — <em>one person, two completely different audiences</em>.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-js">Python</th>
                  <th className="th-ts">Mojo</th>
                  <th className="th-sw">Swift</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="出身" en="Origin" />,
                    js: <>Guido · 1991</>,
                    ts: <>Modular · 2023</>,
                    sw: <>Apple · 2014</> },
                  { k: <L zh="设计师" en="Designer" />,
                    js: <>Guido van Rossum</>,
                    ts: <>Chris Lattner</>,
                    sw: <>Chris Lattner</> },
                  { k: <L zh="主要受众" en="Primary audience" />,
                    js: <L zh="脚本 / 数据 / AI 算法" en="Scripts · data · AI algorithms" />,
                    ts: <L zh="AI 内核 / 编译器工程师" en="AI kernels · compiler engineers" />,
                    sw: <L zh="iOS/macOS app 开发者" en="iOS/macOS app developers" /> },
                  { k: <L zh="语法" en="Syntax" />,
                    js: <L zh="Python 本尊" en="Python itself" />,
                    ts: <L zh={<>Python 超集 (路线)</>} en={<>Python superset (in progress)</>} />,
                    sw: <L zh="独立语法 · ML 风" en="Own syntax · ML-flavoured" /> },
                  { k: <L zh="性能" en="Performance" />,
                    js: <L zh="解释执行 (CPython)" en="Interpreted (CPython)" />,
                    ts: <L zh={<>C / Rust 级 · MLIR codegen</>} en={<>C / Rust class · MLIR codegen</>} />,
                    sw: <L zh="C 级 · LLVM" en="C-class · LLVM" /> },
                  { k: <L zh="内存模型" en="Memory model" />,
                    js: <L zh="GC + 引用计数" en="GC + refcount" />,
                    ts: <L zh={<><strong>borrow / inout / owned</strong></>} en={<><strong>borrow / inout / owned</strong></>} />,
                    sw: <L zh="ARC + value 类型" en="ARC + value types" /> },
                  { k: <L zh="GPU" en="GPU" />,
                    js: <L zh={<>调 CUDA C++ 走 PyTorch</>} en={<>CUDA C++ via PyTorch</>} />,
                    ts: <L zh={<><strong>原生</strong> · NVIDIA + AMD + Apple</>} en={<><strong>Native</strong> · NVIDIA + AMD + Apple</>} />,
                    sw: <L zh="Metal · 仅 Apple GPU" en="Metal · Apple GPU only" /> },
                  { k: <L zh="SIMD" en="SIMD" />,
                    js: <L zh={<>NumPy 抽象, 不在语言层</>} en={<>NumPy abstraction, outside the language</>} />,
                    ts: <><code>SIMD[T, n]</code> <L zh="一等类型" en="first-class type" /></>,
                    sw: <><code>SIMD[N]</code> · <L zh="标准库" en="stdlib" /></> },
                  { k: <L zh="编译期编程" en="Compile-time programming" />,
                    js: <L zh={<>无 (动态语言)</>} en={<>None (dynamic language)</>} />,
                    ts: <><code>@parameter</code> · <L zh="泛型与条件编译共用" en="shared with generics" /></>,
                    sw: <L zh={<>有 (associated types / macros)</>} en={<>Yes (associated types / macros)</>} /> },
                  { k: <L zh="互操作" en="Interop" />,
                    js: <L zh={<>万物 · pip 生态</>} en={<>Everything · pip ecosystem</>} />,
                    ts: <L zh={<>原生 import Python · GIL 跨界</>} en={<>Native Python import · across GIL</>} />,
                    sw: <L zh="C 直接 · ObjC 桥" en="C direct · ObjC bridge" /> },
                  { k: <L zh="生态成熟度" en="Ecosystem maturity" />,
                    js: <L zh="35 年 · 全语言最大" en="35 years · the largest of all" />,
                    ts: <L zh={<>3 年 · 早期 (~10³ 仓库)</>} en={<>3 years · early (~10³ public repos)</>} />,
                    sw: <L zh="11 年 · 苹果生态饱和" en="11 years · Apple-saturated" /> },
                  { k: <L zh="开源" en="Open source" />,
                    js: <L zh="完全 · PSF" en="Fully · PSF" />,
                    ts: <L zh={<>stdlib 是 · <strong>编译器闭源</strong> (1.0 前开)</>} en={<>stdlib yes · <strong>compiler closed</strong> (open before 1.0)</>} />,
                    sw: <L zh="完全 · Apache 2.0" en="Fully · Apache 2.0" /> },
                ].map((row, i) => (
                  <tr key={i}>
                    <td>{row.k}</td>
                    <td>{row.js}</td>
                    <td>{row.ts}</td>
                    <td>{row.sw}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* 08 Future */}
          <section className="section" id="future">
            <header className="sec-head">
              <span className="sec-num">08</span>
              <h2 className="sec-title"><L zh="前景" en="Outlook" /> <code>: TheRoadAhead</code></h2>
              <p className="sec-desc"><L
                zh={<>2026 年的 Mojo 在 1.0 前夜——编译器开源是最后一道大门。NumPy / PyTorch ABI 深度互操作在路上, Apple 自家 MLX 是同生态位的对手。<strong>能不能跳出 AI 当通用系统语言, 是开放问题</strong>。</>}
                en={<>Mojo in 2026 sits on the eve of 1.0 — open-sourcing the compiler is the final big gate. Deeper NumPy / PyTorch ABI interop is on the way; Apple's own MLX is a same-niche competitor. <strong>Whether Mojo escapes AI to become a general systems language is an open question</strong>.</>}
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
                <li><a href="https://www.modular.com/mojo" target="_blank" rel="noopener">modular.com/mojo</a></li>
                <li><a href="https://docs.modular.com/mojo/" target="_blank" rel="noopener"><L zh="官方文档" en="Documentation" /></a></li>
                <li><a href="https://github.com/modular/mojo" target="_blank" rel="noopener">GitHub · modular/mojo</a></li>
                <li><a href="https://www.modular.com/blog" target="_blank" rel="noopener"><L zh="官方博客" en="Modular blog" /></a></li>
                <li><a href="https://docs.modular.com/mojo/playground/" target="_blank" rel="noopener">Mojo Playground</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="关键阅读" en="Key Reading" /></h4>
              <ul>
                <li><a href="https://mlir.llvm.org/" target="_blank" rel="noopener">MLIR</a></li>
                <li><a href="https://llvm.org/" target="_blank" rel="noopener">LLVM</a></li>
                <li><a href="https://www.modular.com/blog/an-easy-introduction-to-mojo-for-python-programmers" target="_blank" rel="noopener"><L zh="Python 程序员入门" en="Intro for Python devs" /></a></li>
                <li><a href="https://www.modular.com/max" target="_blank" rel="noopener">MAX Engine</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="生态 / 工具" en="Ecosystem / Tools" /></h4>
              <ul>
                <li><a href="https://github.com/modular/max" target="_blank" rel="noopener">MAX kernels</a></li>
                <li><a href="https://docs.modular.com/magic/" target="_blank" rel="noopener"><code>magic</code> package mgr</a></li>
                <li><a href="https://github.com/openai/triton" target="_blank" rel="noopener">Triton (cmp)</a></li>
                <li><a href="https://github.com/ml-explore/mlx" target="_blank" rel="noopener">Apple MLX (cmp)</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="同站交叉" en="Cross-links" /></h4>
              <ul>
                <li><a href="/code/swift"><L zh="Swift — Lattner 的第二门语言" en="Swift — Lattner's second language" /></a></li>
                <li><a href="/code/python"><L zh="Python — Mojo 想加速的目标" en="Python — what Mojo accelerates" /></a></li>
                <li><a href="/code/rust"><L zh="Rust — 同样的所有权血脉" en="Rust — same ownership lineage" /></a></li>
                <li><a href="/code/c"><L zh="C — 性能的对照基线" en="C — the perf baseline" /></a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo">{MOJO_LOGO_SVG}</div>
              <p className="footer-line"><L zh="单页中文 / English 双语 · 资料截至 2026-05" en="Single-page guide · zh / en · last updated 2026-05" /></p>
              <p className="footer-line dim"><code>{`fn main(): print("Mojo, the third one")`}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
