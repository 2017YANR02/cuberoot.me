'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LangCtx, L, type Lang } from '../_intro/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './wasm_intro.css';

const WASM_LOGO_SVG = (
  <svg viewBox="0 0 256 256">
    <rect width="256" height="256" rx="28" fill="#0E0A1C" />
    <path
      fill="#654FF0"
      d="M48 80h32l8 56 12-56h32l12 56 8-56h32l-20 96h-36l-12-56-12 56h-36z"
    />
    <rect x="40" y="184" width="176" height="6" rx="3" fill="#8B7BFF" />
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
    year: <>2011<small>·08</small></>,
    zh: { title: <>Emscripten 出场</>, desc: <>Mozilla 的 Alon Zakai 发布 <strong>Emscripten</strong>——把 LLVM IR 编成 JavaScript 子集（后来叫 asm.js）。这是"把 C/C++ 跑在浏览器里"第一次工程化落地，也是 WebAssembly 真正的起点。</> },
    en: { title: <>Emscripten arrives</>, desc: <>Mozilla's Alon Zakai releases <strong>Emscripten</strong> — an LLVM IR-to-JavaScript backend (the JS subset later named asm.js). This is the first engineered "compile C/C++ to run in the browser" pipeline, and the true origin point of WebAssembly.</> },
  },
  {
    year: '2013',
    zh: { title: <>asm.js 正式公开</>, desc: <>Mozilla 正式公开 asm.js 规范——一个<strong>类型化的 JS 子集</strong>，引擎能 AOT 编译。在 SpiderMonkey 里跑出"native 50%"的速度，证明了"浏览器跑 native 代码"路线可行。但 V8 / WebKit 嫌它太丑，不愿意上。</> },
    en: { title: <>asm.js goes public</>, desc: <>Mozilla publishes the asm.js spec — a <strong>typed subset of JS</strong> that engines can AOT-compile. SpiderMonkey hits "~50% of native" speed, proving "browser as a native-code platform" is viable. But V8 and WebKit find asm.js too ugly to commit to.</> },
  },
  {
    year: <>2015<small>·04</small></>,
    zh: { title: <>W3C 社区组成立</>, desc: <>4 月，W3C 正式成立 <strong>WebAssembly Community Group</strong>。四大引擎（V8 / SpiderMonkey / JSC / Chakra）的人坐到一张桌子上，目标是设计一个能被四家一起实现的二进制格式——不再是 Mozilla 一家硬推。</> },
    en: { title: <>W3C Community Group formed</>, desc: <>April: the <strong>W3C WebAssembly Community Group</strong> is chartered. Engineers from all four browser engines (V8, SpiderMonkey, JSC, Chakra) sit at one table to design a binary format that all four can implement — no longer Mozilla pushing alone.</> },
  },
  {
    year: <>2015<small>·06</small></>,
    zh: { title: <>四家公开背书</>, desc: <>Brendan Eich 在博客上公开宣布"四家浏览器一起做 WebAssembly"，配合 Mozilla / Google / Microsoft / Apple 的同步声明。<strong>这是 Web 平台史上第一次四家在同一个新格式上达成共识</strong>。</> },
    en: { title: <>All four vendors endorse</>, desc: <>Brendan Eich blogs the public announcement: all four browsers are committing to WebAssembly, paired with simultaneous statements from Mozilla, Google, Microsoft, and Apple. <strong>The first time in Web-platform history that all four vendors agreed on a new format up front.</strong></> },
  },
  {
    year: <>2017<small>·03</small></>,
    zh: { title: <>MVP 1.0 — 同月四家齐发</>, desc: <>3 月 Firefox 52 首发 wasm 默认开启；几个月内 Chrome 57、Safari 11、Edge 16 全部跟上。<strong>四个引擎在同一年发布同一规范实现</strong>——Web 历史上没有先例。</> },
    en: { title: <>1.0 MVP — all four ship in months</>, desc: <>March: Firefox 52 ships wasm on by default. Within months Chrome 57, Safari 11, and Edge 16 all follow. <strong>Four engines shipping the same spec in the same year</strong> — unprecedented in Web history.</> },
  },
  {
    year: <>2018<small>·03</small></>,
    zh: { title: <>WASI · Solomon Hykes 那条推</>, desc: <>Mozilla 的 Lin Clark + Till Schneidereit 公开 <strong>WASI</strong>（WebAssembly System Interface）——把 wasm 抽出浏览器、在任何主机上跑。Docker 创始人 <strong>Solomon Hykes</strong> 当天发推："如果 2008 年 WASI + WASM 存在，我们就不需要 Docker。" 这条推让 wasm 第一次进入 server 圈子的视野。</> },
    en: { title: <>WASI · Solomon Hykes's tweet</>, desc: <>Mozilla's Lin Clark and Till Schneidereit announce <strong>WASI</strong> (WebAssembly System Interface) — extracting wasm from the browser to run on any host. The same day, Docker founder <strong>Solomon Hykes</strong> tweeted "If WASM+WASI existed in 2008 we wouldn't have needed to create Docker." That single tweet pulled wasm into server-side awareness for the first time.</> },
  },
  {
    year: <>2019<small>·11</small></>,
    zh: { title: <>Bytecode Alliance 成立</>, desc: <>Mozilla / Fastly / Intel / Red Hat 联合成立 <strong>Bytecode Alliance</strong>——非营利组织，托管 <code>wasmtime</code>、<code>wasm-tools</code>、WASI 等核心项目。Wasm 第一次有了"机构化中立托管"，不再只是 W3C 规范 + 各家自己造轮子。</> },
    en: { title: <>Bytecode Alliance founded</>, desc: <>Mozilla, Fastly, Intel, and Red Hat jointly form the <strong>Bytecode Alliance</strong> — a non-profit hosting <code>wasmtime</code>, <code>wasm-tools</code>, and WASI. Wasm gains its first institutionally-neutral home, instead of being only a W3C spec with every vendor reinventing tooling.</> },
  },
  {
    year: <>2019<small>·12</small></>,
    zh: { title: <>W3C Recommendation</>, desc: <>12 月 5 日 WebAssembly Core Spec 1.0 正式成为 <strong>W3C Recommendation</strong>——和 HTML / CSS / DOM 平级的 Web 标准。从 2015 的 CG 到这一刻，刚好 4.5 年。</> },
    en: { title: <>W3C Recommendation</>, desc: <>December 5: WebAssembly Core Spec 1.0 is published as a <strong>W3C Recommendation</strong>, putting it on par with HTML, CSS, and the DOM. Exactly 4.5 years from the 2015 CG charter.</> },
  },
  {
    year: '2021',
    zh: { title: <>wasmtime + Compute@Edge</>, desc: <>Bytecode Alliance 的 <code>wasmtime</code> 1.0 稳定，Fastly <strong>Compute@Edge</strong> 正式 GA——第一次有主流 edge 平台把 wasm 作为唯一 runtime 暴露给客户。"在边缘节点跑用户代码"这件事，wasm 成了默认答案。</> },
    en: { title: <>wasmtime + Compute@Edge GA</>, desc: <>Bytecode Alliance's <code>wasmtime</code> 1.0 stabilizes; Fastly <strong>Compute@Edge</strong> reaches GA — the first mainstream edge platform to expose wasm as the only customer-facing runtime. "Run user code at the edge" now has wasm as the default answer.</> },
  },
  {
    year: '2022',
    zh: { title: <>SIMD / bulk-mem / refs 全部入主线</>, desc: <>这一年 <strong>SIMD 128</strong>、<strong>bulk memory</strong>、<strong>reference types</strong>、<strong>multi-value</strong> 全部进入所有主流引擎稳定通道。WASI Preview 1 同年宣告稳定——wasm 第一次具备"能写真业务系统"的能力面。</> },
    en: { title: <>SIMD / bulk-mem / refs land everywhere</>, desc: <>This year <strong>SIMD 128</strong>, <strong>bulk memory</strong>, <strong>reference types</strong>, and <strong>multi-value</strong> all hit stable in every mainstream engine. WASI Preview 1 is declared stable the same year — wasm's first real "you can write a serious business system" surface.</> },
  },
  {
    year: '2023',
    zh: { title: <>Component Model 设计落地</>, desc: <>多年讨论的 <strong>Component Model</strong>（用 WIT 接口类型把 wasm 模块组合在一起）完成第一版可实现的设计。同年 <strong>Shopify Functions</strong> 把结账 / 折扣插件全部切到 wasm——电商核心路径上跑用户写的 wasm。</> },
    en: { title: <>Component Model design lands</>, desc: <>The long-debated <strong>Component Model</strong> (composing wasm modules via typed WIT interfaces) reaches its first implementable design. The same year, <strong>Shopify Functions</strong> moves checkout and discount extensions entirely to wasm — user-authored wasm now runs on e-commerce critical paths.</> },
  },
  {
    year: '2024',
    zh: { title: <>GC proposal 上船</>, desc: <>V8 / SpiderMonkey 都发布了 <strong>WasmGC</strong>——wasm 第一次原生支持 GC 类型。这一下 <strong>Kotlin/Wasm、Dart/Wasm、OCaml/Wasm、Java teleport</strong> 全部从 PoC 变成了可生产路线。GC 语言不再需要在 wasm 里塞一个完整的运行时。</> },
    en: { title: <>GC proposal ships</>, desc: <>V8 and SpiderMonkey both ship <strong>WasmGC</strong> — wasm gets native GC types for the first time. Overnight <strong>Kotlin/Wasm, Dart/Wasm, OCaml/Wasm, and the Java teleport-VM</strong> shift from proof-of-concept to production-credible. GC languages no longer need to bundle a full runtime into the bytecode.</> },
  },
  {
    year: <>2024<small>·12</small></>,
    zh: { title: <>WASI Preview 2 + Component Model</>, desc: <>12 月 <strong>WASI Preview 2</strong> 正式发布——基于 Component Model，所有系统接口（IO / 文件 / HTTP / sockets / clocks）改用 WIT 描述。从此 wasm 模块之间、模块和宿主之间，<strong>都有了第一份正式的类型化接口标准</strong>。</> },
    en: { title: <>WASI Preview 2 + Component Model</>, desc: <>December: <strong>WASI Preview 2</strong> ships, built on the Component Model — every system interface (IO, files, HTTP, sockets, clocks) is now described in WIT. For the first time wasm modules talk to each other and to the host through <strong>a real typed interface standard</strong>.</> },
  },
  {
    year: '2025', highlight: true,
    zh: { title: <>Component Model 1.0 稳定</>, desc: <><strong>Component Model 1.0</strong> 正式稳定。Figma / Photoshop Web / Google Earth Web 全部完整跑在 wasm 上；Cloudflare Workers 平台对外公布跑着 <strong>300 万+ 个 wasm 应用</strong>。这一年 wasm 不再是"未来"，而是"已经在你打开的几乎每个 Web 应用底下"。</> },
    en: { title: <>Component Model 1.0 stabilizes</>, desc: <><strong>Component Model 1.0</strong> goes stable. Figma, Photoshop Web, and Google Earth (web) are all running entirely on wasm; Cloudflare Workers publicly reports <strong>3M+ wasm applications</strong> on its platform. This year wasm stops being "the future" — it's underneath nearly every web app you open.</> },
  },
  {
    year: <>2026<small>·05</small></>, highlight: true,
    zh: { title: <>WASI Preview 3 · async + io</>, desc: <>2026 上半年 <strong>WASI Preview 3</strong> 推进中——把 async / 结构化 IO 直接进规范层（Promise-like、取消、超时全部标准化）。同期 Component Model 2.0 草案讨论开始：让 wasm 模块像真正的<strong>类型化软件组件</strong>那样被发布、版本管理、组合。</> },
    en: { title: <>WASI Preview 3 · async + io</>, desc: <>First half of 2026: <strong>WASI Preview 3</strong> is in flight — pulling async and structured IO directly into the spec layer (Promise-like, cancellation, timeouts standardized). At the same time, Component Model 2.0 drafts begin: wasm modules will be published, versioned, and composed as <strong>real typed software components</strong>.</> },
  },
];

interface WasmCard {
  tag: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const WASM_CARDS: WasmCard[] = [
  {
    tag: 'A',
    zh: { title: <>Module / Instance</>, desc: <>一份 <code>.wasm</code> 二进制是 <strong>module</strong>——只描述代码和类型，不持有内存。<strong>instance</strong> 是 module + 内存 + 表 + 导入的活体。同一个 module 可以低成本实例化多份。</> },
    en: { title: <>Module / Instance</>, desc: <>A <code>.wasm</code> binary is a <strong>module</strong> — it describes code and types only, holding no memory. An <strong>instance</strong> is module + memory + tables + imports, alive. One module can be instantiated many times cheaply.</> },
    code: (
      <code>
        (<span className="cl-k">module</span>{'\n'}
        {'  '}(<span className="cl-k">func</span> <span className="cl-fn">$add</span>{'\n'}
        {'    '}(<span className="cl-k">param</span> <span className="cl-type">i32</span> <span className="cl-type">i32</span>){'\n'}
        {'    '}(<span className="cl-k">result</span> <span className="cl-type">i32</span>){'\n'}
        {'    '}<span className="cl-fn">local.get</span> <span className="cl-n">0</span>{'\n'}
        {'    '}<span className="cl-fn">local.get</span> <span className="cl-n">1</span>{'\n'}
        {'    '}<span className="cl-fn">i32.add</span>){'\n'}
        {'  '}(<span className="cl-k">export</span> <span className="cl-s">"add"</span>{'\n'}
        {'    '}(<span className="cl-k">func</span> <span className="cl-fn">$add</span>))){'\n'}
        <span className="cl-c">;; the entire WAT for an `add` export</span>
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <>线性内存</>, desc: <>每个 instance 拿到一段<strong>单一连续字节数组</strong>——按 64 KB 一页申请，宿主和 wasm 都直接索引这段裸内存。<code>(memory 1 256)</code>：初始 1 页，最多 256 页（16 MB）。</> },
    en: { title: <>Linear memory</>, desc: <>Each instance holds a single <strong>contiguous byte array</strong>, grown in 64 KB pages — host and wasm both index this raw memory directly. <code>(memory 1 256)</code> declares 1 page initial, 256 pages max (16 MB).</> },
    code: (
      <code>
        (<span className="cl-k">memory</span> <span className="cl-n">1</span> <span className="cl-n">256</span>){'\n'}
        (<span className="cl-k">export</span> <span className="cl-s">"mem"</span> (<span className="cl-k">memory</span> <span className="cl-n">0</span>)){'\n\n'}
        <span className="cl-c">;; JS side:</span>{'\n'}
        <span className="cl-k">const</span> <span className="cl-v">u8</span> = <span className="cl-k">new</span> <span className="cl-fn">Uint8Array</span>({'\n'}
        {'  '}<span className="cl-v">instance</span>.<span className="cl-prop">exports</span>.<span className="cl-prop">mem</span>.<span className="cl-prop">buffer</span>{'\n'}
        );
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <>Table + refs</>, desc: <>函数指针不直接走内存，而是放在 <strong>table</strong> 里——typed index 表查。<code>funcref</code> / <code>externref</code> 是 wasm 自己的引用类型，宿主对象进 wasm 也走它。</> },
    en: { title: <>Table + reference types</>, desc: <>Function pointers don't live in memory — they live in a <strong>table</strong>, indexed by typed handles. <code>funcref</code> / <code>externref</code> are wasm's own reference types, and host objects cross into wasm through them.</> },
    code: (
      <code>
        (<span className="cl-k">table</span> <span className="cl-n">2</span> <span className="cl-type">funcref</span>){'\n'}
        (<span className="cl-k">elem</span> (<span className="cl-fn">i32.const</span> <span className="cl-n">0</span>){'\n'}
        {'  '}<span className="cl-fn">$add</span> <span className="cl-fn">$sub</span>){'\n\n'}
        (<span className="cl-k">func</span> (<span className="cl-k">param</span> <span className="cl-type">i32</span>){'\n'}
        {'  '}<span className="cl-fn">local.get</span> <span className="cl-n">0</span>{'\n'}
        {'  '}(<span className="cl-fn">call_indirect</span> (<span className="cl-k">type</span> <span className="cl-n">$bin</span>)))
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <>Imports / Exports</>, desc: <>Wasm 模块对外界<strong>一无所知</strong>。要调宿主函数（<code>console.log</code> / <code>fetch</code> / 文件 IO）必须声明 <code>import</code>；宿主拿到的也只有 <code>export</code> 表里那一份。胶水代码就是一句 <code>WebAssembly.instantiate</code>。</> },
    en: { title: <>Imports / Exports</>, desc: <>A wasm module <strong>knows nothing about the world</strong>. To call a host function (<code>console.log</code>, <code>fetch</code>, file IO) it must declare an <code>import</code>; the host only sees what's in the <code>export</code> table. The glue is one line of <code>WebAssembly.instantiate</code>.</> },
    code: (
      <code>
        <span className="cl-k">const</span> {'{ '}<span className="cl-v">instance</span> {'} '}={'\n'}
        {'  '}<span className="cl-k">await</span> <span className="cl-fn">WebAssembly</span>.<span className="cl-fn">instantiate</span>({'\n'}
        {'    '}<span className="cl-v">bytes</span>,{'\n'}
        {'    '}{'{ '}<span className="cl-prop">env</span>: {'{ '}<span className="cl-prop">log</span>: <span className="cl-v">console</span>.<span className="cl-fn">log</span> {'} } '});{'\n\n'}
        <span className="cl-v">instance</span>.<span className="cl-prop">exports</span>.<span className="cl-fn">add</span>(<span className="cl-n">2</span>, <span className="cl-n">3</span>);{'\n'}
        <span className="cl-c">// → 5</span>
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <>验证 / 沙箱</>, desc: <>每份 <code>.wasm</code> 在执行前都被引擎<strong>静态验证</strong>：栈类型可证明、跳转目标在范围内、内存访问只碰自己的线性内存。<strong>没有 import 就没有 syscall</strong>。这是 Web 见过的最强沙箱。</> },
    en: { title: <>Validation / sandbox</>, desc: <>Every <code>.wasm</code> is <strong>statically validated</strong> before it runs: stack types proven, branch targets in range, memory access bounded to its own linear memory. <strong>No imports means no syscalls</strong>. The strongest sandbox the web has ever had.</> },
    code: (
      <code>
        <span className="cl-c">// what wasm cannot do without imports:</span>{'\n'}
        <span className="cl-c">//   - read a file</span>{'\n'}
        <span className="cl-c">//   - open a socket</span>{'\n'}
        <span className="cl-c">//   - access process / env / clock</span>{'\n'}
        <span className="cl-c">//   - touch any memory but its own</span>{'\n\n'}
        <span className="cl-c">// every dangerous capability must</span>{'\n'}
        <span className="cl-c">// be handed in as an import — explicit.</span>
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <>仅四种数值类型</>, desc: <>核心 wasm 只有 <code>i32</code> / <code>i64</code> / <code>f32</code> / <code>f64</code>（加 SIMD 的 <code>v128</code>）。<strong>没有字符串、没有结构体</strong>——所有高级类型都"和宿主约定一段内存布局"。GC proposal 在改这件事，但默认仍然是这样。</> },
    en: { title: <>Numeric types only</>, desc: <>Core wasm has only <code>i32</code> / <code>i64</code> / <code>f32</code> / <code>f64</code> (plus SIMD's <code>v128</code>). <strong>No strings, no structs</strong> — every high-level type is "an agreed memory layout between you and the host." The GC proposal is changing that, but the default is still this.</> },
    code: (
      <code>
        <span className="cl-c">;; pass a string from JS:</span>{'\n'}
        <span className="cl-c">;; — write UTF-8 bytes into wasm memory</span>{'\n'}
        <span className="cl-c">;; — pass (ptr, len) as two i32 params</span>{'\n\n'}
        (<span className="cl-k">func</span> <span className="cl-fn">$greet</span>{'\n'}
        {'  '}(<span className="cl-k">param</span> <span className="cl-fn">$ptr</span> <span className="cl-type">i32</span>){'\n'}
        {'  '}(<span className="cl-k">param</span> <span className="cl-fn">$len</span> <span className="cl-type">i32</span>){'\n'}
        {'  '}<span className="cl-c">;; read from memory[ptr..ptr+len]</span>{'\n'}
        ){' '}
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <>WAT 文本格式</>, desc: <>S 表达式 1:1 对应二进制——一段 wasm 总有等价的<strong>可读 WAT</strong>。<code>wabt</code> 工具链：<code>wat2wasm</code> 文本→二进制、<code>wasm2wat</code> 反过来。读 wasm bug 必看 WAT。</> },
    en: { title: <>WAT text format</>, desc: <>An S-expression format that maps 1:1 to the binary — every wasm module has an equivalent <strong>readable WAT</strong>. The <code>wabt</code> toolchain: <code>wat2wasm</code> text→binary, <code>wasm2wat</code> the other way. Debugging wasm starts in WAT.</> },
    code: (
      <code>
        $ wat2wasm hello.wat -o hello.wasm{'\n'}
        $ wasm2wat hello.wasm{'\n\n'}
        (<span className="cl-k">module</span>{'\n'}
        {'  '}(<span className="cl-k">func</span> (<span className="cl-k">export</span> <span className="cl-s">"hi"</span>){'\n'}
        {'    '}(<span className="cl-k">result</span> <span className="cl-type">i32</span>){'\n'}
        {'    '}<span className="cl-fn">i32.const</span> <span className="cl-n">42</span>))
      </code>
    ),
  },
  {
    tag: 'H',
    zh: { title: <>Component Model + WIT</>, desc: <>用 <strong>WIT</strong>（WebAssembly Interface Types）把模块之间的接口写成<strong>类型化合约</strong>——string / list / record / variant / option / result 全部有定义。WASI Preview 2 起，宿主接口也用 WIT 表达。Wasm 终于"像真正的软件组件"。</> },
    en: { title: <>Component Model + WIT</>, desc: <>Use <strong>WIT</strong> (WebAssembly Interface Types) to describe inter-module contracts as <strong>typed interfaces</strong> — string, list, record, variant, option, result are all defined. From WASI Preview 2 onward, host interfaces are also WIT-described. Wasm finally behaves like a real software component.</> },
    code: (
      <code>
        <span className="cl-c">// greet.wit</span>{'\n'}
        <span className="cl-k">package</span> <span className="cl-v">cuberoot</span>:<span className="cl-v">demo</span>;{'\n\n'}
        <span className="cl-k">interface</span> <span className="cl-fn">greet</span> {'{'}{'\n'}
        {'  '}<span className="cl-fn">hello</span>: <span className="cl-k">func</span>({'\n'}
        {'    '}<span className="cl-v">name</span>: <span className="cl-type">string</span>{'\n'}
        {'  '}) -&gt; <span className="cl-type">string</span>;{'\n'}
        {'}'}
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
    zh: { title: <>同一份 <code>.wasm</code> 跑遍全平台</>, desc: <>浏览器 / 边缘 / serverless / 插件宿主 / 数据库扩展——同一份 <strong>二进制</strong> 不动一字节，到处都能跑。这是 wasm 最原始的承诺，也是它真正兑现的承诺。</> },
    en: { title: <>One <code>.wasm</code>, every platform</>, desc: <>Browsers, edge runtimes, serverless, plugin hosts, database extensions — the same <strong>binary</strong>, byte-for-byte, runs everywhere. The original wasm promise, and the one it actually delivers.</> },
    code: <><span className="cl-c">// same .wasm in:</span>{'\n'}<span className="cl-c">//   chrome / firefox / safari</span>{'\n'}<span className="cl-c">//   wasmtime / wasmer / wasm3</span>{'\n'}<span className="cl-c">//   cloudflare / fastly / shopify</span></>,
  },
  {
    icon: '⎇',
    zh: { title: <>最强 Web 沙箱</>, desc: <>没有 FS / 没有网络 / 没有系统调用 / 没法越界访问 — 除非宿主<strong>显式 import 进来</strong>。这是 Web 平台第一次让"跑陌生人的二进制"成为安全默认。</> },
    en: { title: <>The strongest web sandbox</>, desc: <>No filesystem, no network, no syscalls, no out-of-bounds memory — unless the host <strong>explicitly imports them</strong>. The first time the web platform makes "run a stranger's binary" the safe default.</> },
    code: <><span className="cl-c">// no imports → no I/O at all</span>{'\n'}<span className="cl-fn">WebAssembly</span>.<span className="cl-fn">instantiate</span>(<span className="cl-v">bytes</span>, {'{}'}){';'}{'\n'}<span className="cl-c">// pure, deterministic compute</span></>,
  },
  {
    icon: '⛯',
    zh: { title: <>接近原生的执行速度</>, desc: <>二进制本身就是<strong>静态校验过的低层格式</strong>——引擎可以直接 AOT 编译。V8 用 Liftoff（快编译）+ TurboFan（深度优化）双层；wasmtime 走 Cranelift。常见 workload 是原生 90 %+。</> },
    en: { title: <>Near-native speed</>, desc: <>The binary is itself a <strong>statically validated low-level format</strong>, so engines AOT-compile it directly. V8 uses a Liftoff / TurboFan tiering pair; wasmtime uses Cranelift. Typical workloads land at 90%+ of native.</> },
    code: <><span className="cl-c">// V8 path:</span>{'\n'}<span className="cl-c">//   liftoff   (~ms compile, ~2x slower)</span>{'\n'}<span className="cl-c">//   turbofan  (slow compile, ~native)</span></>,
  },
  {
    icon: '⚙',
    zh: { title: <>真正的多语言地基</>, desc: <>Rust / C / C++ / Go / Zig / Swift / Kotlin / .NET / Java / Dart / OCaml / Python（Pyodide）——<strong>一打主流语言都能编到 wasm</strong>。这是历史上语言互操作最厚的一层公共底座。</> },
    en: { title: <>Genuine polyglot substrate</>, desc: <>Rust, C, C++, Go, Zig, Swift, Kotlin, .NET, Java, Dart, OCaml, Python (Pyodide) — <strong>over a dozen mainstream languages compile to wasm</strong>. The thickest shared substrate for language interop the industry has ever had.</> },
    code: <><span className="cl-c">// rust:   cargo build --target wasm32-...</span>{'\n'}<span className="cl-c">// c/c++:  emcc / clang --target=wasm32</span>{'\n'}<span className="cl-c">// go:     GOOS=js GOARCH=wasm go build</span></>,
  },
  {
    icon: '⌬',
    zh: { title: <>流式编译</>, desc: <>浏览器拿到 <code>.wasm</code> 流的第一个字节就开始编译——<strong>下载和编译并行</strong>。<code>WebAssembly.instantiateStreaming(fetch(...))</code> 一行直接吃 fetch 响应，不需要先 <code>arrayBuffer()</code>。</> },
    en: { title: <>Streaming compilation</>, desc: <>The browser starts compiling on the first byte of the <code>.wasm</code> stream — <strong>download and compile happen in parallel</strong>. One line of <code>WebAssembly.instantiateStreaming(fetch(...))</code> consumes a fetch response directly; no <code>arrayBuffer()</code> staging.</> },
    code: <><span className="cl-k">await</span> <span className="cl-fn">WebAssembly</span>.<span className="cl-fn">instantiateStreaming</span>({'\n'}{'  '}<span className="cl-fn">fetch</span>(<span className="cl-s">"app.wasm"</span>),{'\n'}{'  '}<span className="cl-v">imports</span>{'\n'}){';'}</>,
  },
  {
    icon: '⌖',
    zh: { title: <>体积极小</>, desc: <>Rust 写一个 hello-world，<code>wasm-opt -Oz</code> 之后大约 <strong>3 KB</strong>——比同等功能的 minified JS 还小。冷启动延迟在毫秒级。</> },
    en: { title: <>Tiny binaries</>, desc: <>A Rust hello-world wasm comes in around <strong>3 KB</strong> after <code>wasm-opt -Oz</code> — smaller than the minified-JS equivalent. Cold-start latency measured in milliseconds.</> },
    code: <>$ wasm-opt -Oz app.wasm -o app.opt.wasm{'\n'}$ ls -la app.opt.wasm{'\n'}{'  '}<span className="cl-c">// 3.1 KB</span></>,
  },
  {
    icon: '⌗',
    zh: { title: <>天生的插件底座</>, desc: <>Shopify Functions、Figma 插件、Envoy filter、eBPF 风格扩展、Postgres 扩展、数据库 UDF——只要需要"<strong>跑用户代码 + 不能信任</strong>"，wasm 就是答案。</> },
    en: { title: <>The natural plugin substrate</>, desc: <>Shopify Functions, Figma plugins, Envoy filters, eBPF-style extensions, Postgres extensions, database UDFs — anywhere you need "<strong>run user code, do not trust it</strong>," wasm is the answer.</> },
    code: <><span className="cl-c">// Shopify Function · Rust → wasm</span>{'\n'}<span className="cl-k">fn</span> <span className="cl-fn">discount</span>(<span className="cl-v">cart</span>: <span className="cl-type">Cart</span>) {'->'} <span className="cl-type">Discount</span> {'{ ... }'}</>,
  },
  {
    icon: '⏚',
    zh: { title: <>一套规范，许多 runtime</>, desc: <>V8 / SpiderMonkey / JSC / <code>wasmtime</code> / <code>wasmer</code> / <code>wasm3</code> / <code>WAMR</code> / <code>WasmEdge</code>——都读同一份 <code>.wasm</code>。没有任何一个语言生态有这么多<strong>独立可互换的实现</strong>。</> },
    en: { title: <>One spec, many runtimes</>, desc: <>V8, SpiderMonkey, JSC, <code>wasmtime</code>, <code>wasmer</code>, <code>wasm3</code>, <code>WAMR</code>, <code>WasmEdge</code> — they all read the same <code>.wasm</code>. No language ecosystem has this many <strong>independent, interchangeable implementations</strong>.</> },
    code: <><span className="cl-c">// pick the runtime that fits:</span>{'\n'}<span className="cl-c">//   wasm3   — interpreter, ~64 KB</span>{'\n'}<span className="cl-c">//   wasmtime — full JIT + WASI</span>{'\n'}<span className="cl-c">//   browsers — same binary</span></>,
  },
  {
    icon: '⚐',
    zh: { title: <>四家共同设计</>, desc: <>WebAssembly 不是单一厂商的"开源给你用"，是四个浏览器引擎 + W3C 一起从 2015 年开始公开设计。<strong>没有一个 owner 能单方面改死它</strong>——这是 wasm 长期可信的根。</> },
    en: { title: <>Designed by four vendors together</>, desc: <>WebAssembly isn't a single-vendor "we open-sourced it for you" project. It's been co-designed in the open by four browser engines + W3C since 2015. <strong>No single owner can unilaterally break it</strong> — the root of wasm's long-term trustworthiness.</> },
    code: <><span className="cl-c">// W3C WG members shipping wasm:</span>{'\n'}<span className="cl-c">//   Google (V8) · Mozilla (SM)</span>{'\n'}<span className="cl-c">//   Apple (JSC) · Microsoft</span></>,
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
    href: 'https://www.figma.com', highlight: true,
    zhName: 'Figma', enName: 'Figma',
    zhNote: 'C++ 设计画布 · 全 wasm', enNote: 'C++ design canvas · all wasm',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="35" cy="20" r="12" fill="#F24E1E"/><circle cx="65" cy="20" r="12" fill="#FF7262"/><circle cx="35" cy="50" r="12" fill="#A259FF"/><circle cx="65" cy="50" r="12" fill="#1ABCFE"/><circle cx="35" cy="80" r="12" fill="#0ACF83"/></svg>,
  },
  {
    href: 'https://photoshop.adobe.com', highlight: true,
    zhName: 'Photoshop Web', enName: 'Photoshop Web',
    zhNote: 'Adobe 把整套 PS 编到 wasm', enNote: 'Adobe ported full PS to wasm',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="10" y="10" width="80" height="80" rx="14" fill="#001E36"/><text x="50" y="68" fontFamily="Arial Black, sans-serif" fontSize="46" fontWeight="900" textAnchor="middle" fill="#31A8FF">Ps</text></svg>,
  },
  {
    href: 'https://workers.cloudflare.com', highlight: true,
    zhName: 'Cloudflare Workers', enName: 'Cloudflare Workers',
    zhNote: '边缘 wasm · 3M+ apps', enNote: 'Edge wasm · 3M+ apps',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M20 60 Q20 40 40 38 Q42 25 58 25 Q78 25 82 45 Q92 47 92 60 Z" fill="#F38020"/><path d="M22 62 L88 62 L84 70 L26 70 Z" fill="#FAAD3F"/></svg>,
  },
  {
    href: 'https://www.fastly.com/products/edge-compute',
    zhName: 'Fastly Compute', enName: 'Fastly Compute',
    zhNote: 'wasmtime 跑边缘代码', enNote: 'wasmtime at the edge',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="40" fill="#FF282D"/><path d="M50 18 V50 L72 64" stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round"/></svg>,
  },
  {
    href: 'https://shopify.dev/docs/api/functions',
    zhName: 'Shopify Functions', enName: 'Shopify Functions',
    zhNote: '结账 / 折扣插件用 wasm', enNote: 'Checkout / discount via wasm',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M28 22 L60 18 L70 26 L72 82 L26 86 Z" fill="#95BF47"/><path d="M50 38 Q50 30 56 30 Q60 30 60 36" stroke="#fff" strokeWidth="3" fill="none"/><text x="48" y="68" fontFamily="Arial Black, sans-serif" fontSize="28" fontWeight="900" textAnchor="middle" fill="#fff">S</text></svg>,
  },
  {
    href: 'https://earth.google.com',
    zhName: 'Google Earth Web', enName: 'Google Earth Web',
    zhNote: '原 C++ 客户端 · 编到 wasm', enNote: 'C++ client ported to wasm',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="40" fill="#1A73E8"/><path d="M22 50 Q40 30 50 50 Q60 70 78 50" stroke="#34A853" strokeWidth="6" fill="none"/><path d="M30 60 Q50 80 70 60" stroke="#FBBC04" strokeWidth="4" fill="none"/></svg>,
  },
  {
    href: 'https://web.autocad.com',
    zhName: 'AutoCAD Web', enName: 'AutoCAD Web',
    zhNote: 'Autodesk C++ → wasm', enNote: 'Autodesk C++ → wasm',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="10" y="14" width="80" height="72" rx="8" fill="#E50000"/><text x="50" y="62" fontFamily="Arial Black, sans-serif" fontSize="32" fontWeight="900" textAnchor="middle" fill="#fff">ACAD</text></svg>,
  },
  {
    href: 'https://1password.com',
    zhName: '1Password', enName: '1Password',
    zhNote: 'wasm 共享核心 · 跨端', enNote: 'wasm shared core · cross-platform',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="40" fill="#0572EC"/><circle cx="50" cy="50" r="22" stroke="#fff" strokeWidth="6" fill="none"/><circle cx="50" cy="50" r="6" fill="#fff"/><rect x="48" y="50" width="4" height="20" fill="#fff"/></svg>,
  },
  {
    href: 'https://disneyplus.com',
    zhName: 'Disney+', enName: 'Disney+',
    zhNote: '客户端视频管线用 wasm', enNote: 'Client video pipeline · wasm',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="10" y="20" width="80" height="60" rx="10" fill="#0E1F5C"/><text x="50" y="58" fontFamily="Georgia, serif" fontSize="24" fontStyle="italic" fontWeight="700" textAnchor="middle" fill="#fff">D+</text></svg>,
  },
  {
    href: 'https://bytecodealliance.org',
    zhName: 'Bytecode Alliance', enName: 'Bytecode Alliance',
    zhNote: 'wasmtime · WASI 托管方', enNote: 'wasmtime · WASI host',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><polygon points="50,10 90,32 90,68 50,90 10,68 10,32" fill="#654FF0"/><polygon points="50,28 72,40 72,60 50,72 28,60 28,40" fill="#fff"/></svg>,
  },
  {
    href: 'https://wasmedge.org',
    zhName: 'WasmEdge', enName: 'WasmEdge',
    zhNote: 'CNCF · 沙箱 runtime', enNote: 'CNCF · sandbox runtime',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="40" fill="#1F1F26"/><path d="M28 40 L40 60 L50 44 L60 60 L72 40" stroke="#8B7BFF" strokeWidth="5" fill="none" strokeLinejoin="round"/></svg>,
  },
  {
    href: 'https://fermyon.com',
    zhName: 'Spin (Fermyon)', enName: 'Spin (Fermyon)',
    zhNote: 'wasm 微服务运行时', enNote: 'wasm microservice runtime',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="40" fill="#0D9488"/><path d="M30 50 Q50 20 70 50 Q50 80 30 50 Z" fill="#fff"/><circle cx="50" cy="50" r="6" fill="#0D9488"/></svg>,
  },
  {
    href: 'https://www.envoyproxy.io',
    zhName: 'Envoy', enName: 'Envoy',
    zhNote: 'wasm filter ABI', enNote: 'wasm filter ABI',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="40" fill="#AC6199"/><path d="M30 35 L50 65 L70 35 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://pyodide.org',
    zhName: 'Pyodide', enName: 'Pyodide',
    zhNote: 'CPython 完整跑在 wasm', enNote: 'Full CPython in wasm',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M30 22 H58 Q72 22 72 36 V52 H42 Q28 52 28 66 V78 H50 Q36 78 36 64 H72 V44 Q72 30 58 30 H30 Z" fill="#3776AB"/><circle cx="40" cy="32" r="3" fill="#fff"/><circle cx="60" cy="68" r="3" fill="#FFD43B"/></svg>,
  },
  {
    href: 'https://dotnet.microsoft.com/apps/aspnet/web-apps/blazor', highlight: true,
    zhName: 'Blazor', enName: 'Blazor',
    zhNote: '.NET 浏览器内运行 · wasm', enNote: '.NET in the browser · wasm',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="40" fill="#512BD4"/><path d="M30 70 L40 30 H50 L60 70 H50 L48 60 H42 L40 70 Z M44 50 H46 L45 42 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://github.com/cs0x7f/cubeopt', highlight: true,
    zhName: 'cubeopt-wasm', enName: 'cubeopt-wasm',
    zhNote: '本站 /scramble/solver · cs0x7f', enNote: 'Used in /scramble/solver · cs0x7f',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="14" y="14" width="22" height="22" fill="#FFFFFF" stroke="#0E0A1C" strokeWidth="2"/><rect x="38" y="14" width="22" height="22" fill="#654FF0" stroke="#0E0A1C" strokeWidth="2"/><rect x="62" y="14" width="22" height="22" fill="#8B7BFF" stroke="#0E0A1C" strokeWidth="2"/><rect x="14" y="38" width="22" height="22" fill="#8B7BFF" stroke="#0E0A1C" strokeWidth="2"/><rect x="38" y="38" width="22" height="22" fill="#FFFFFF" stroke="#0E0A1C" strokeWidth="2"/><rect x="62" y="38" width="22" height="22" fill="#654FF0" stroke="#0E0A1C" strokeWidth="2"/><rect x="14" y="62" width="22" height="22" fill="#654FF0" stroke="#0E0A1C" strokeWidth="2"/><rect x="38" y="62" width="22" height="22" fill="#8B7BFF" stroke="#0E0A1C" strokeWidth="2"/><rect x="62" y="62" width="22" height="22" fill="#FFFFFF" stroke="#0E0A1C" strokeWidth="2"/></svg>,
  },
];

interface NotableUser { name: string; zhDesc: string; enDesc: string }
const NOTABLE_USERS: NotableUser[] = [
  { name: 'Figma',           zhDesc: 'C++ 设计画布 · 浏览器全 wasm', enDesc: 'C++ design canvas · all-wasm in-browser' },
  { name: 'Photoshop Web',   zhDesc: 'Adobe 全栈移植 · 2021', enDesc: 'Full Adobe port · 2021' },
  { name: 'Google Earth',    zhDesc: 'C++ 客户端 · 编到 wasm', enDesc: 'C++ client compiled to wasm' },
  { name: 'AutoCAD Web',     zhDesc: 'Autodesk · 工程级 CAD', enDesc: 'Autodesk · production CAD' },
  { name: '1Password',       zhDesc: 'wasm 共享核心 · 跨端', enDesc: 'wasm core shared cross-platform' },
  { name: 'Cloudflare',      zhDesc: '边缘 · 3M+ Workers', enDesc: 'Edge · 3M+ Workers apps' },
  { name: 'Fastly',          zhDesc: 'wasmtime 跑生产边缘', enDesc: 'wasmtime in production edge' },
  { name: 'Shopify',         zhDesc: '结账插件全 wasm', enDesc: 'Checkout extensions · wasm' },
  { name: 'Disney+',         zhDesc: '视频客户端管线', enDesc: 'Video client pipeline' },
  { name: 'Adobe Express',   zhDesc: 'wasm imaging 核心', enDesc: 'wasm imaging core' },
  { name: 'WasmEdge',        zhDesc: 'CNCF sandbox runtime', enDesc: 'CNCF sandbox runtime' },
  { name: 'Spin (Fermyon)',  zhDesc: 'wasm 微服务', enDesc: 'wasm microservices' },
  { name: 'Envoy',           zhDesc: 'wasm filter ABI', enDesc: 'wasm filter ABI' },
  { name: 'Pyodide',         zhDesc: 'CPython 完整 wasm', enDesc: 'Full CPython in wasm' },
  { name: 'Blazor',          zhDesc: '.NET → wasm 浏览器', enDesc: '.NET → wasm in browser' },
  { name: 'cubeopt-wasm',    zhDesc: '本站 /scramble/solver 引擎', enDesc: 'Engine behind /scramble/solver' },
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
    tag: <>HOT · 2026</>, hot: true, big: true,
    zh: {
      title: <>Component Model 1.0 + WASI Preview 3</>,
      body: (<>
        <p>2025 <strong>Component Model 1.0</strong> 稳定，2026 上半年 <strong>WASI Preview 3</strong> 推进中——把 async / 结构化 IO（Promise-like、取消、超时）直接进规范层。从此 wasm 模块不只是"代码片段"，而是<strong>带类型签名的真正的软件组件</strong>。</p>
        <p>对比 1.0 MVP（2017）只有 4 个数值类型加线性内存——9 年后 wasm 拿到了 string / list / record / variant / option / result + async/IO。<strong>从字节码走到组件平台</strong>，9 年没浪费一年。</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">MVP 1.0 → Component 1.0</span><span className="bar-val">9 yrs</span></div>
          <div className="bar bar-new"><span className="bar-label">Browser ship-day → today</span><span className="bar-val">9 yrs</span></div>
        </div>
      </>),
    },
    en: {
      title: <>Component Model 1.0 + WASI Preview 3</>,
      body: (<>
        <p>2025 stabilized <strong>Component Model 1.0</strong>; the first half of 2026 brings <strong>WASI Preview 3</strong> — async and structured IO (Promise-like, cancellation, timeouts) landing in the spec itself. Wasm modules stop being "snippets of code" and become <strong>real software components with typed signatures</strong>.</p>
        <p>The 1.0 MVP in 2017 had only four numeric types plus linear memory. Nine years later, wasm has string / list / record / variant / option / result, plus async and IO. <strong>From bytecode to a component platform</strong>, and not one of the nine years was wasted.</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">MVP 1.0 → Component 1.0</span><span className="bar-val">9 yrs</span></div>
          <div className="bar bar-new"><span className="bar-label">Browser ship-day → today</span><span className="bar-val">9 yrs</span></div>
        </div>
      </>),
    },
  },
  {
    tag: 'GC',
    zh: { title: <>GC 语言全员上船</>, body: <><p>2024 V8 / SpiderMonkey 都发了 <strong>WasmGC</strong>——wasm 第一次有原生 GC 类型。<strong>Kotlin / Dart / OCaml / Java teleport</strong> 现在可以编到 wasm 且不带自己的 GC 进来。这是动态语言 / 函数式语言进入 wasm 主战场的转折点。</p></> },
    en: { title: <>GC languages move in</>, body: <><p>2024: V8 and SpiderMonkey both ship <strong>WasmGC</strong>, giving wasm native GC types. <strong>Kotlin, Dart, OCaml, and the Java teleport-VM</strong> can now compile to wasm without bundling their own GC. The pivot moment for dynamic and functional languages on wasm.</p></> },
  },
  {
    tag: 'EDGE',
    zh: { title: <>边缘统一基底</>, body: <><p>Cloudflare / Fastly / Akamai / Vercel——每一家边缘平台都把 wasm 选成<strong>多租户计算的隔离单元</strong>。一个 v8 isolate 跑几千个客户的 wasm，冷启动毫秒级、隔离能挡住越权。这件事 wasm 已经赢了，不再有竞品。</p></> },
    en: { title: <>Edge consolidates</>, body: <><p>Cloudflare, Fastly, Akamai, Vercel — every major edge platform has picked wasm as <strong>the unit of multi-tenant compute isolation</strong>. One v8 isolate runs thousands of customers' wasm at millisecond cold-start with rock-solid isolation. The race is over; wasm won.</p></> },
  },
  {
    tag: 'PLUGINS',
    zh: { title: <>插件生态爆发</>, body: <><p>Shopify Functions（结账逻辑）、Figma 插件（设计自动化）、Envoy filter（流量改写）、Postgres 扩展、Hugging Face Transformers 插件、浏览器扩展——<strong>"在我家跑用户写的代码"</strong> 的需求全都流向 wasm。</p></> },
    en: { title: <>Plugin ecosystems explode</>, body: <><p>Shopify Functions (checkout logic), Figma plugins (design automation), Envoy filters (traffic rewriting), Postgres extensions, Hugging Face Transformers plugins, browser extensions — every <strong>"run user-authored code on my platform"</strong> need is converging on wasm.</p></> },
  },
  {
    tag: 'AI',
    zh: { title: <>端侧 AI 推理</>, body: <><p><strong>Transformers.js</strong>、<strong>llama.cpp wasm</strong>、<strong>Whisper wasm</strong>——把 LLM / 语音模型直接编到 wasm 跑在浏览器和移动端，无需 server。SIMD + 多线程 + GPU（WebGPU）三件套让端侧 AI 第一次有了真实生产路径。</p></> },
    en: { title: <>On-device AI inference</>, body: <><p><strong>Transformers.js</strong>, <strong>llama.cpp wasm</strong>, <strong>Whisper wasm</strong> — LLM and speech models compiled to wasm to run in-browser and on mobile, no server required. SIMD + threads + GPU (via WebGPU) finally make on-device AI a real production path.</p></> },
  },
  {
    tag: 'TOOLING',
    zh: { title: <>工具链成熟</>, body: <><p><code>wabt</code>（wat2wasm / wasm2wat / wasm-objdump）、<code>wasm-tools</code>（component cli）、<code>wasm-opt</code>（binaryen 优化）、<code>cargo-component</code>、<code>wit-bindgen</code>——<strong>调试 wasm 现在和调 native binary 一个体验</strong>。10 年前要靠 printf。</p></> },
    en: { title: <>Toolchain comes of age</>, body: <><p><code>wabt</code> (wat2wasm / wasm2wat / wasm-objdump), <code>wasm-tools</code> (component CLI), <code>wasm-opt</code> (binaryen optimizer), <code>cargo-component</code>, <code>wit-bindgen</code> — <strong>debugging wasm now feels like debugging a native binary</strong>. Ten years ago it was printf.</p></> },
  },
];

export default function WasmIntroPage() {
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  const rootRef = useRef<HTMLDivElement>(null);

  useDocumentTitle('WebAssembly — Web 的通用字节码', 'WebAssembly — A Universal Bytecode for the Web');

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
        a.style.color = a.getAttribute('href') === '#' + cur ? 'var(--wasm-bright)' : '';
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
      <div ref={rootRef} className="wasm-intro-root">
        <div className="grid-bg" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            <svg viewBox="0 0 256 256" width="28" height="28">
              <rect width="256" height="256" rx="28" fill="#0E0A1C" />
              <path fill="#654FF0" d="M48 80h32l8 56 12-56h32l12 56 8-56h32l-20 96h-36l-12-56-12 56h-36z" />
              <rect x="40" y="184" width="176" height="6" rx="3" fill="#8B7BFF" />
            </svg>
            <span>WebAssembly</span>
            <span className="nav-tag"><L zh=": 中文导览" en=": Guide" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#system"><L zh="精要" en="Essentials" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#projects"><L zh="谁用" en="Adopters" /></a></li>
            <li><a href="#ai"><L zh="生产" en="In Prod" /></a></li>
            <li><a href="#vs"><L zh="对比" en="vs JS/Native" /></a></li>
            <li><a href="#future"><L zh="前景" en="Outlook" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 2015 — 2026 · W3C Community Group · Bytecode Alliance</div>
            <h1 className="hero-title">
              <span className="hero-name">WebAssembly</span>
              <span className="hero-colon">:</span>
              <span className="hero-type">Web</span>
            </h1>
            <p className="hero-sub">
              <L
                zh={<>Web 的通用<strong>字节码</strong>。从 2015 年 W3C 社区组立项，到 2025 年 Component Model 1.0——一份 <code>.wasm</code> 二进制在浏览器、边缘、serverless、插件宿主里跑同一段代码。Figma / Photoshop / Cloudflare / Shopify 都在它上面。</>}
                en={<>A universal <strong>bytecode</strong> for the web. From the 2015 W3C Community Group to Component Model 1.0 in 2025 — one <code>.wasm</code> binary runs the same code across browsers, edge, serverless, and plugin hosts. Figma, Photoshop, Cloudflare, and Shopify all stand on it.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">2017<small></small></span>
                <span className="stat-label"><L zh={<>1.0 MVP 发布<br /><em>四家浏览器同年齐发</em></>} en={<>1.0 MVP shipped<br /><em>all four browsers in months</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">4<small></small></span>
                <span className="stat-label"><L zh={<>引擎首发数<br /><em>V8 · SpiderMonkey · JSC · Chakra</em></>} en={<>engines on day-one<br /><em>V8 · SpiderMonkey · JSC · Chakra</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">CM<small> 1.0</small></span>
                <span className="stat-label"><L zh={<>Component Model 稳定<br /><em>2025 · 类型化模块组合</em></>} en={<>Component Model stable<br /><em>2025 · typed module composition</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">0<small></small></span>
                <span className="stat-label"><L zh={<>未声明的能力<br /><em>没 import 就没 syscall</em></>} en={<>undeclared capabilities<br /><em>no import → no syscall</em></>} /></span>
              </div>
            </div>
            <div className="hero-cube">
              <div className="hero-cube-face f-front">{WASM_LOGO_SVG}</div>
            </div>
            <div className="hero-floats">
              <span className="float f1">module</span>
              <span className="float f2">memory</span>
              <span className="float f3">table</span>
              <span className="float f4">i32</span>
              <span className="float f5">func</span>
              <span className="float f6">import</span>
              <span className="float f7">export</span>
              <span className="float f8">WAT</span>
              <span className="float f9">wasm-pack</span>
              <span className="float f10">wasi</span>
              <span className="float f11">simd128</span>
              <span className="float f12">component</span>
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
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>WebAssembly</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>WebAssembly（缩写 <code>wasm</code>）是一种<strong>可移植的低层二进制格式</strong>——既不是语言，也不是 runtime，而是一份 W3C 标准定义的字节码 + 一个静态可验证的执行模型。一份 <code>.wasm</code> 在浏览器、边缘节点、serverless、插件宿主里跑<strong>同一段字节</strong>；validation 保证它<strong>没有 import 就什么都做不了</strong>。</>}
                  en={<>WebAssembly (<code>wasm</code> for short) is a <strong>portable low-level binary format</strong> — not a language, not a runtime, but a W3C-standardized bytecode plus a statically verifiable execution model. The same <code>.wasm</code> bytes run unchanged in browsers, edge nodes, serverless, and plugin hosts; validation guarantees it <strong>can do nothing at all without explicit imports</strong>.</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="字节码" en="Bytecode" />, tag: 'binary', p: <L zh={<>一种<strong>紧凑可校验</strong>的二进制格式——不是源语言，也不是 IR。引擎拿到就能直接 AOT 编。</>} en={<>A <strong>compact, verifiable</strong> binary format — not a source language, not an IR. Engines AOT-compile it on the spot.</>} /> },
                { h: <L zh="沙箱" en="Sandbox" />, tag: 'no-syscall', p: <L zh={<>静态验证 + 线性内存隔离。<strong>没有 import 就没有任何能力</strong>——Web 平台最强沙箱。</>} en={<>Static validation plus linear-memory isolation. <strong>No imports → no capabilities at all</strong>. The web's strongest sandbox.</>} /> },
                { h: <L zh="多语言" en="Polyglot" />, tag: '12+ langs', p: <L zh={<>Rust / C / C++ / Go / Zig / Swift / Kotlin / .NET / Java / Dart / OCaml / Python——<strong>一打主流语言</strong>都能编进来。</>} en={<>Rust / C / C++ / Go / Zig / Swift / Kotlin / .NET / Java / Dart / OCaml / Python — <strong>over a dozen mainstream languages</strong> all compile in.</>} /> },
                { h: <L zh="可组合" en="Composable" />, tag: 'components', p: <L zh={<>Component Model + <code>WIT</code> 让 wasm 模块互相<strong>带类型签名地组合</strong>。模块第一次像"真正的软件组件"。</>} en={<>Component Model + <code>WIT</code> lets wasm modules <strong>compose with typed interfaces</strong>. Modules finally behave like real software components.</>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">add.js</span><span className="lang-tag js">JS</span></div>
                <pre className="code"><code>
                  <span className="cl-c"><L zh="// 纯 JS 实现：解释执行 / JIT 起跳慢" en="// pure JS: interpreted, slow JIT warmup" /></span>{'\n'}
                  <span className="cl-k">export function</span> <span className="cl-fn">add</span>({'\n'}
                  {'  '}<span className="cl-v">a</span>, <span className="cl-v">b</span>{'\n'}
                  ) {'{'}{'\n'}
                  {'  '}<span className="cl-c"><L zh="// 类型不定" en="// types unknown" /></span>{'\n'}
                  {'  '}<span className="cl-c"><L zh="// 可能触发 V8 deopt" en="// possible V8 deopt" /></span>{'\n'}
                  {'  '}<span className="cl-k">return</span> <span className="cl-v">a</span> + <span className="cl-v">b</span>;{'\n'}
                  {'}'}{'\n\n'}
                  <span className="cl-c"><L zh="// 调用方拿到的能力 = 任意 JS 能力" en="// caller surface = anything JS can do" /></span>
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">add.wat</span><span className="lang-tag wat">WAT</span></div>
                <pre className="code"><code>
                  (<span className="cl-k">module</span>{'\n'}
                  {'  '}(<span className="cl-k">func</span> <span className="cl-fn">$add</span>{'\n'}
                  {'    '}(<span className="cl-k">param</span> <span className="cl-type">i32</span> <span className="cl-type">i32</span>){'\n'}
                  {'    '}(<span className="cl-k">result</span> <span className="cl-type">i32</span>){'\n'}
                  {'    '}<span className="cl-fn">local.get</span> <span className="cl-n">0</span>{'\n'}
                  {'    '}<span className="cl-fn">local.get</span> <span className="cl-n">1</span>{'\n'}
                  {'    '}<span className="cl-fn">i32.add</span>){'\n'}
                  {'  '}(<span className="cl-k">export</span> <span className="cl-s">"add"</span>{'\n'}
                  {'    '}(<span className="cl-k">func</span> <span className="cl-fn">$add</span>))){'\n\n'}
                  <span className="cl-c">;; <L zh="静态类型 · AOT 编译 · 无 import = 0 能力" en="static types · AOT-compiled · no imports = 0 capabilities" /></span>
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
                zh={<>从 2011 年 Emscripten 把 C 编成 JS 子集，到 2017 年四家浏览器同年齐发 1.0，再到 2025 年 Component Model 稳定——15 年走完"<strong>从黑科技到 Web 一等公民</strong>"的全程。</>}
                en={<>From Emscripten compiling C to a JS subset in 2011, through four browsers shipping 1.0 in the same year (2017), to Component Model stabilizing in 2025 — fifteen years from "fringe hack" to "first-class web citizen."</>}
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

          {/* 03 Essentials */}
          <section className="section" id="system">
            <header className="sec-head">
              <span className="sec-num">03</span>
              <h2 className="sec-title"><L zh="精要" en="Essentials" /> <code>: WasmAlphabet</code></h2>
              <p className="sec-desc"><L
                zh={<>整个 wasm 平台站在下面八件套上——module / 线性内存 / table / imports / 验证 / 数值类型 / WAT / Component Model。简单到一晚上看完，但每一件都贯穿到生产。</>}
                en={<>The whole wasm platform stands on these eight primitives — module, linear memory, table, imports, validation, numeric types, WAT, and the Component Model. Simple enough to read in one evening; every one of them carries all the way to production.</>}
              /></p>
            </header>

            <div className="ts-grid">
              {WASM_CARDS.map((c, i) => (
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
                  zh={<>核心 wasm 只有四种数值类型 + 线性内存 + 表 + 函数。整本核心规范一晚上看完。但<strong>它撑得起整个 Web 平台</strong>——Figma 的设计画布、Photoshop 的 PS 引擎、Cloudflare 的 3M+ workers 都跑在这八件套上。</>}
                  en={<>Core wasm has only four numeric types plus linear memory, tables, and functions. You can read the full core spec in one evening. Yet <strong>it carries the whole modern web</strong> — Figma's design canvas, Photoshop's engine, Cloudflare's 3M+ workers all run on these eight primitives.</>}
                /></p>
                <p className="ts-callout-quote">"<em><L
                  zh={<>WebAssembly 不是又一个跑得快的运行时，它是一份"<strong>所有人都能验证的二进制契约</strong>"。</>}
                  en={<>WebAssembly isn't another fast runtime. It's a binary contract that <strong>anyone can verify</strong>.</>}
                /></em>" — Lin Clark, Mozilla</p>
              </div>
            </div>
          </section>

          {/* 04 Why */}
          <section className="section" id="why">
            <header className="sec-head">
              <span className="sec-num">04</span>
              <h2 className="sec-title"><L zh="为何要用" en="Why Wasm" /> <code>: WhyWasm</code></h2>
              <p className="sec-desc"><L
                zh={<>Wasm 不是"更快的 JS"，也不是"浏览器里的 Java applet"——它是 Web 第一次拥有的<strong>语言无关、能力可控、跑得动 native 工作负载</strong>的字节码。下面九条，是它真正赢下来的东西。</>}
                en={<>Wasm is not "faster JS" or "Java applets in the browser." It is the first time the web has had a <strong>language-neutral, capability-controlled, native-workload-capable</strong> bytecode. The nine cards below are what wasm has actually won.</>}
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
                zh={<>2025 年 wasm 已经在你<strong>打开的几乎每个 Web 应用底下</strong>。Figma 的设计画布、Photoshop 的 PS 引擎、Google Earth 的 C++ 客户端、AutoCAD 的工程级 CAD——还有本站 <code>/scramble/solver</code> 跑的 cs0x7f 的 cubeopt。</>}
                en={<>By 2025, wasm runs <strong>underneath nearly every web app you open</strong>. Figma's design canvas, Photoshop's engine, Google Earth's C++ client, AutoCAD's production CAD — and this site's <code>/scramble/solver</code> on cs0x7f's cubeopt.</>}
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

          {/* 06 Wasm in Production */}
          <section className="section section-ai" id="ai">
            <header className="sec-head">
              <span className="sec-num ai-num">06</span>
              <h2 className="sec-title"><L zh="cuberoot.me 里的 wasm" en="Wasm inside cuberoot.me" /> <code>: <L zh="本站实战" en="In our stack" /></code></h2>
              <p className="sec-desc"><L
                zh={<>说一段 Web 平台史很空。直接看：本站 <code>/scramble/solver</code> 和 <code>/scramble/analyzer</code> 两张卡片下面，跑着真正的 wasm——而且<strong>把 wasm 各种坑都踩过一遍</strong>：SharedArrayBuffer / COOP+COEP / 多模块全局污染 / iOS Safari 内存上限。下面是真实记录。</>}
                en={<>Telling the wasm story in the abstract is boring. Look at the receipts: this site's <code>/scramble/solver</code> and <code>/scramble/analyzer</code> both run real wasm — and we've already <strong>stepped on every wasm pitfall</strong>: SharedArrayBuffer, COOP+COEP, multi-module global pollution, the iOS Safari memory ceiling. The notes below are real.</>}
              /></p>
            </header>

            <blockquote className="quote-block">
              <div className="quote-mark">"</div>
              <p className="quote-text"><L
                zh={<>WebAssembly 给 Web 平台带来了两件以前不可能同时存在的东西：<strong>跑得动 native 工作负载</strong>，并且<strong>对宿主完全可证明的能力边界</strong>。在它之前，每次想跑陌生代码都得在"性能"和"安全"里二选一。</>}
                en={<>WebAssembly gave the web two things that used to be mutually exclusive: <strong>the ability to run native workloads</strong>, and <strong>a provable capability boundary against the host</strong>. Before wasm, running someone else's code always meant choosing between performance and safety.</>}
              /></p>
              <footer className="quote-footer">
                <span className="quote-author">— Lin Clark</span>
                <span className="quote-context"><L zh="WebAssembly / WASI 共同设计者 · 多次公开演讲整理" en="WebAssembly / WASI co-designer · paraphrased from talks" /></span>
              </footer>
            </blockquote>

            <div className="ai-stats">
              <div className="ai-stat">
                <div className="ai-stat-num">2<small></small></div>
                <div className="ai-stat-h"><L zh="跑 wasm 的页面" en="Pages that run wasm" /></div>
                <p><L
                  zh={<>本站只有 <code>/scramble/solver</code> 和 <code>/scramble/analyzer</code> 两张卡片跑 wasm，<strong>剩下 24 张完全干净</strong>——COOP/COEP 只在 nginx <code>map $request_uri</code> 这个 regex 命中时发，登录回调 <code>/me</code> 不受影响。</>}
                  en={<>Only <code>/scramble/solver</code> and <code>/scramble/analyzer</code> run wasm; <strong>the other 24 cards stay completely clean</strong>. COOP/COEP headers are emitted only when an nginx <code>map $request_uri</code> regex matches — the login callback <code>/me</code> is untouched.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">4<small></small></div>
                <div className="ai-stat-h"><L zh="同 worker 里的 wasm 模块" en="wasm modules per worker" /></div>
                <p><L
                  zh={<><code>/scramble/analyzer</code> 在<strong>同一个 worker 里</strong>顺序加载 <code>crossSolver</code> / <code>pseudoCrossSolver</code> / <code>EOCrossSolver</code> / <code>F2L_PairingSolver</code> 四个 emscripten 模块。它们都<strong>覆盖 Module / HEAPU8 / wasmExports / _malloc 这些全局</strong>——只能每次调用前手动 delete 重置，否则状态串台。</>}
                  en={<><code>/scramble/analyzer</code> loads four emscripten modules in a row <strong>inside the same worker</strong>: <code>crossSolver</code>, <code>pseudoCrossSolver</code>, <code>EOCrossSolver</code>, <code>F2L_PairingSolver</code>. Each one <strong>monkey-patches the globals Module / HEAPU8 / wasmExports / _malloc</strong>, so the worker has to <code>delete</code> them between calls or state leaks between modules.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">1<small> GB</small></div>
                <div className="ai-stat-h"><L zh="iOS Safari wasm 内存上限" en="iOS Safari wasm memory ceiling" /></div>
                <p><L
                  zh={<>iOS Safari 给 wasm 线性内存的硬上限大约 1 GB——超了直接 OOM 闪退。<strong>移动 UA 默认走 <code>cube48opt1</code></strong>（最小的 prune table），桌面才上 <code>cube48opt2</code> / 完整 cubeopt。这一条没有任何官方文档，只有翻车后回来打补丁。</>}
                  en={<>iOS Safari caps wasm linear memory at roughly 1 GB — exceed it and the page OOM-crashes. <strong>Mobile UA defaults to <code>cube48opt1</code></strong> (the smallest prune table); desktop gets <code>cube48opt2</code> or full cubeopt. No vendor doc says this — only post-mortem patches do.</>}
                /></p>
              </div>
            </div>

            <div className="spotlight">
              <div className="spotlight-tag">SPOTLIGHT</div>
              <div className="spotlight-grid">
                <div>
                  <h3>cubeopt-wasm <span className="spotlight-meta">— <L zh="cs0x7f 的多线程 3x3 最优解" en="cs0x7f's multithreaded 3x3 optimal solver" /></span></h3>
                  <p><L
                    zh={<>本站 <code>/scramble/solver</code> 跑的是 <strong>cs0x7f</strong>（csTimer 作者）写的 <code>cubeopt-wasm</code>——纯 C 写的 3x3 最优解算器编到 wasm，配 <code>public/cubeopt/wasm-worker.js</code> 在 worker 里跑。<strong>多线程 · 需要 SharedArrayBuffer</strong>。</>}
                    en={<>The engine behind <code>/scramble/solver</code> is <strong>cs0x7f</strong>'s (author of csTimer) <code>cubeopt-wasm</code> — a 3x3 optimal solver written in C, compiled to wasm, driven by <code>public/cubeopt/wasm-worker.js</code> in a worker. <strong>Multithreaded; requires SharedArrayBuffer.</strong></>}
                  /></p>
                  <ul className="spotlight-list">
                    <li><strong>SAB</strong> <L zh="需要 cross-origin isolated context" en="needs cross-origin isolated context" /></li>
                    <li><strong>COOP</strong> <L zh="same-origin · 主框架隔离" en="same-origin · main-frame isolation" /></li>
                    <li><strong>COEP</strong> <L zh="require-corp · 拒绝跨源资源" en="require-corp · refuses cross-origin assets" /></li>
                    <li><strong>map $request_uri</strong> <L zh="只对 solver/analyzer 发头" en="only emits headers on solver/analyzer" /></li>
                  </ul>
                  <p><L
                    zh={<>真正的工程坑不是 wasm 本身，而是<strong>整站只能让两张卡片进 cross-origin isolated context</strong>，其它不能受影响。解法：nginx 用 <code>map $request_uri ~ ^/scramble/(solver|analyzer)</code> 控制 COOP+COEP 发送，<strong>SW 不再注入这两个 header</strong>。</>}
                    en={<>The real engineering hurdle isn't wasm itself — it's that <strong>only two cards on the whole site should enter cross-origin isolated context</strong>; everything else has to stay unaffected. Solution: nginx uses <code>map $request_uri ~ ^/scramble/(solver|analyzer)</code> to gate the COOP+COEP emissions, and <strong>the service worker no longer injects those headers</strong>.</>}
                  /></p>
                </div>
                <div className="spotlight-code">
                  <pre className="code"><code>
                    <span className="cl-c"><L zh="# nginx · COOP/COEP 只发给 solver/analyzer" en="# nginx · COOP/COEP only for solver/analyzer" /></span>{'\n'}
                    <span className="cl-k">map</span> <span className="cl-v">$request_uri</span> <span className="cl-v">$coop</span> {'{'}{'\n'}
                    {'  '}<span className="cl-s">~^/scramble/(solver|analyzer)</span>{'\n'}
                    {'    '}<span className="cl-s">"same-origin"</span>;{'\n'}
                    {'  '}<span className="cl-k">default</span> <span className="cl-s">""</span>;{'\n'}
                    {'}'}{'\n\n'}
                    <span className="cl-k">map</span> <span className="cl-v">$request_uri</span> <span className="cl-v">$coep</span> {'{'}{'\n'}
                    {'  '}<span className="cl-s">~^/scramble/(solver|analyzer)</span>{'\n'}
                    {'    '}<span className="cl-s">"require-corp"</span>;{'\n'}
                    {'  '}<span className="cl-k">default</span> <span className="cl-s">""</span>;{'\n'}
                    {'}'}{'\n\n'}
                    <span className="cl-fn">add_header</span> Cross-Origin-Opener-Policy <span className="cl-v">$coop</span>;{'\n'}
                    <span className="cl-fn">add_header</span> Cross-Origin-Embedder-Policy <span className="cl-v">$coep</span>;{'\n\n'}
                    <span className="cl-c"><L zh="# /me · 登录回调 · 完全不动" en="# /me · login callback · untouched" /></span>
                  </code></pre>
                </div>
              </div>
            </div>

            <div className="ai-tools">
              <h3 className="ai-tools-h"><L zh="生产里跑 wasm 的家伙（一打+）" en="Wasm in production today" /></h3>
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
                <h3><L zh="analyzer · 同 worker 四模块" en="analyzer · four modules, one worker" /></h3>
                <p><L
                  zh={<><code>/scramble/analyzer</code> 在<strong>同一个 worker</strong>里要顺序加载四个 emscripten 编译的 wasm 模块——cross / pseudo-cross / EOCross / F2L Pairing。这是 wasm 工程上最常见的坑之一：每个模块都<strong>用 emscripten 默认 glue</strong>，要在全局挂 <code>Module</code> / <code>HEAPU8</code> / <code>wasmExports</code> / <code>_malloc</code>。同一个 worker 里第二个模块加载时直接覆盖前一个的全局。</>}
                  en={<><code>/scramble/analyzer</code> loads four emscripten-built wasm modules in a row <strong>inside the same worker</strong> — cross / pseudo-cross / EOCross / F2L-Pairing. This is one of the most common wasm engineering pitfalls: each module ships with <strong>emscripten's default glue</strong> that hangs <code>Module</code> / <code>HEAPU8</code> / <code>wasmExports</code> / <code>_malloc</code> on the global object. The second module to load simply overwrites the first.</>}
                /></p>
                <p><L
                  zh={<>解法朴素但有效：worker 在<strong>调用前后</strong>手动 <code>delete</code> 这些全局，等于每次都从干净状态进入。一个不显式的"模块卸载"约定，wasm 模块之间互不串台。Component Model 想解决的就是这件事——但 emscripten glue 还没全面转过去。</>}
                  en={<>The fix is unglamorous but effective: the worker manually <code>delete</code>s those globals around every call, so each module enters from a clean slate. An implicit "module unload" convention keeps them from cross-contaminating. The Component Model is meant to solve exactly this — but emscripten glue hasn't fully adopted it yet.</>}
                /></p>
                <p><L
                  zh={<>这就是 wasm 工程的真相：标准很美，<strong>glue 一团乱</strong>；正在统一，但没统一完。</>}
                  en={<>That's the truth about wasm engineering: the spec is beautiful, <strong>the glue is a mess</strong>, and unification is happening but is not yet done.</>}
                /></p>
              </div>
              <div className="ai-reverse-code">
                <pre className="code"><code>
                  <span className="cl-c">// <L zh="analyzer worker · 全局清扫" en="analyzer worker · global cleanup" /></span>{'\n'}
                  <span className="cl-k">async function</span> <span className="cl-fn">callModule</span>({'\n'}
                  {'  '}<span className="cl-v">url</span>: <span className="cl-type">string</span>,{'\n'}
                  {'  '}<span className="cl-v">scramble</span>: <span className="cl-type">string</span>,{'\n'}
                  ) {'{'}{'\n'}
                  {'  '}<span className="cl-k">delete</span> (<span className="cl-v">self</span> <span className="cl-k">as</span> <span className="cl-type">any</span>).<span className="cl-prop">Module</span>;{'\n'}
                  {'  '}<span className="cl-k">delete</span> (<span className="cl-v">self</span> <span className="cl-k">as</span> <span className="cl-type">any</span>).<span className="cl-prop">HEAPU8</span>;{'\n'}
                  {'  '}<span className="cl-k">delete</span> (<span className="cl-v">self</span> <span className="cl-k">as</span> <span className="cl-type">any</span>).<span className="cl-prop">wasmExports</span>;{'\n'}
                  {'  '}<span className="cl-k">delete</span> (<span className="cl-v">self</span> <span className="cl-k">as</span> <span className="cl-type">any</span>).<span className="cl-prop">_malloc</span>;{'\n\n'}
                  {'  '}<span className="cl-fn">importScripts</span>(<span className="cl-v">url</span>);{'\n'}
                  {'  '}<span className="cl-k">await</span> (<span className="cl-v">self</span> <span className="cl-k">as</span> <span className="cl-type">any</span>).<span className="cl-fn">Module</span>();{'\n'}
                  {'  '}<span className="cl-k">return</span> (<span className="cl-v">self</span> <span className="cl-k">as</span> <span className="cl-type">any</span>).<span className="cl-fn">solve</span>(<span className="cl-v">scramble</span>);{'\n'}
                  {'}'}{'\n\n'}
                  <span className="cl-c">// <L zh="emscripten 默认 glue 的代价" en="// the cost of emscripten's default glue" /></span>
                </code></pre>
              </div>
            </div>

            <div className="ai-takeaway">
              <p><strong><L zh="一句话:" en="In one line: " /></strong><L
                zh={<>WebAssembly 不是 Web 的"下一代",它<strong>已经是 Web 的当代</strong>——Figma / Photoshop / Cloudflare / 本站 solver 都在它上面跑。剩下的只是把工具链 / Component Model / Glue 收拾干净。</>}
                en={<>WebAssembly isn't the web's "next generation" — it's the <strong>web's current generation</strong>. Figma, Photoshop, Cloudflare, and this site's solver all run on it. The rest is just cleaning up the toolchain, the Component Model, and the glue.</>}
              /></p>
            </div>
          </section>

          {/* 07 vs */}
          <section className="section" id="vs">
            <header className="sec-head">
              <span className="sec-num">07</span>
              <h2 className="sec-title"><L zh="对比" en="vs JS / Native" /> <code>: Wasm vs JS vs Native</code></h2>
              <p className="sec-desc"><L
                zh={<>三种"在 Web 上跑代码"的方式，三种世界观。JS 押宝<strong>动态 + 普及度</strong>；native（asm.js / NaCl / 插件）押宝<strong>极致性能</strong>；wasm 押宝<strong>跨厂商 + 静态可验证</strong>——同一份字节哪里都能跑、且<strong>能力边界可证明</strong>。</>}
                en={<>Three ways to run code on the web, three worldviews. JS bets on <strong>dynamism + ubiquity</strong>; native paths (asm.js, NaCl, plugins) bet on <strong>raw performance</strong>; wasm bets on <strong>multi-vendor + statically verifiable</strong> — one binary runs everywhere with a <strong>provable capability boundary</strong>.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-js">JavaScript</th>
                  <th className="th-native"><L zh="Native (asm.js / NaCl)" en="Native (asm.js / NaCl)" /></th>
                  <th className="th-wasm">WebAssembly</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="格式" en="Format" />,
                    js:     <L zh="源码文本 · 动态" en="Source text · dynamic" />,
                    native: <L zh="JS 子集 / 私有插件" en="JS subset / proprietary plugin" />,
                    wasm:   <L zh="二进制 · 静态可证明" en="Binary · statically verifiable" /> },
                  { k: <L zh="解析速度" en="Parse speed" />,
                    js:     <L zh="文本解析 + 类型推断" en="Text parse + type inference" />,
                    native: <L zh="文本解析（asm.js）" en="Text parse (asm.js)" />,
                    wasm:   <L zh={<><strong>二进制 + 流式</strong></>} en={<><strong>Binary + streaming</strong></>} /> },
                  { k: <L zh="启动时延" en="Startup latency" />,
                    js:     <L zh="JIT 起跳 · 热路径慢" en="JIT warmup · slow hot path" />,
                    native: <L zh="原生 · 但要安装" en="Native · but requires install" />,
                    wasm:   <L zh="毫秒级 · AOT" en="Milliseconds · AOT" /> },
                  { k: <L zh="执行速度" en="Execution speed" />,
                    js:     <L zh="~50% native（顺风）" en="~50% native (best case)" />,
                    native: <L zh="100%" en="100%" />,
                    wasm:   <L zh="80–95% native" en="80–95% native" /> },
                  { k: <L zh="沙箱模型" en="Sandbox" />,
                    js:     <L zh="同源 + DOM 全开" en="Same-origin + full DOM" />,
                    native: <L zh="NaCl SFI / asm.js 跟 JS 一致" en="NaCl SFI / asm.js = JS" />,
                    wasm:   <L zh={<><strong>验证 + 线性内存 + 无 import 无能力</strong></>} en={<><strong>Validation + linear mem + no-import-no-cap</strong></>} /> },
                  { k: <L zh="支持厂商" en="Vendor support" />,
                    js:     <L zh="四家 · 但语言层各家方言" en="All four · but dialect drift" />,
                    native: <L zh="NaCl 只 Chrome · 已弃" en="NaCl Chrome-only · deprecated" />,
                    wasm:   <L zh={<><strong>四家从规范阶段共同设计</strong></>} en={<><strong>All four since spec-design phase</strong></>} /> },
                  { k: <L zh="可移植性" en="Portability" />,
                    js:     <L zh="浏览器 + Node + 边缘" en="Browser + Node + edge" />,
                    native: <L zh="平台绑定 · 重发布" en="Platform-bound · repackage" />,
                    wasm:   <L zh="浏览器 + 边缘 + 插件 · 同一字节" en="Browser + edge + plugin · same bytes" /> },
                  { k: <L zh="语言来源" en="Source languages" />,
                    js:     <L zh="JS / TS（编出来还是 JS）" en="JS / TS (still JS)" />,
                    native: <L zh="C/C++ 经 emscripten" en="C/C++ via emscripten" />,
                    wasm:   <L zh="Rust/C/C++/Go/Zig/Swift/.NET/...（12+）" en="Rust/C/C++/Go/Zig/Swift/.NET/... (12+)" /> },
                  { k: <L zh="GC 支持" en="GC support" />,
                    js:     <L zh="原生" en="Native" />,
                    native: <L zh="自带 runtime" en="Bundle your own runtime" />,
                    wasm:   <L zh="WasmGC（2024）" en="WasmGC (2024)" /> },
                  { k: <L zh="组件化" en="Componentization" />,
                    js:     <L zh="ES modules" en="ES modules" />,
                    native: <L zh="—" en="—" />,
                    wasm:   <L zh="Component Model 1.0（2025）" en="Component Model 1.0 (2025)" /> },
                  { k: <L zh="是否要安装" en="Install needed" />,
                    js:     <L zh="否" en="No" />,
                    native: <L zh={<>NaCl / 插件 <strong>要</strong></>} en={<>NaCl / plugin <strong>yes</strong></>} />,
                    wasm:   <L zh="否" en="No" /> },
                  { k: <L zh="工具链体验" en="Tooling UX" />,
                    js:     <L zh="顶级 · 30 年" en="Best-in-class · 30 yrs" />,
                    native: <L zh="C 工具链" en="C toolchain" />,
                    wasm:   <L zh="wabt / wasm-tools / wasm-opt · 成熟" en="wabt / wasm-tools / wasm-opt · mature" /> },
                ].map((row, i) => (
                  <tr key={i}>
                    <td>{row.k}</td>
                    <td>{row.js}</td>
                    <td>{row.native}</td>
                    <td>{row.wasm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* 08 Future */}
          <section className="section" id="future">
            <header className="sec-head">
              <span className="sec-num">08</span>
              <h2 className="sec-title"><L zh="前景" en="Outlook" /> <code>: TheNext9Years</code></h2>
              <p className="sec-desc"><L
                zh={<>2017 MVP 到 2025 Component Model 1.0 走了 9 年——从 4 个数值类型走到带类型签名的软件组件平台。下一个 9 年的题目已经摆好：async 入规范、GC 语言全员入场、边缘统一、端侧 AI 落地。</>}
                en={<>From the 2017 MVP to Component Model 1.0 in 2025: nine years from four numeric types to a typed component platform. The next nine years' agenda is already drawn — async lands in the spec, GC languages move in for real, edge consolidates, on-device AI ships.</>}
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
                <li><a href="https://webassembly.org" target="_blank" rel="noopener">webassembly.org</a></li>
                <li><a href="https://webassembly.org/roadmap/" target="_blank" rel="noopener"><L zh="特性路线图" en="Feature Roadmap" /></a></li>
                <li><a href="https://github.com/WebAssembly/spec" target="_blank" rel="noopener">spec on GitHub</a></li>
                <li><a href="https://github.com/WebAssembly/proposals" target="_blank" rel="noopener">All proposals</a></li>
                <li><a href="https://webassembly.github.io/spec/core/" target="_blank" rel="noopener">Core Spec</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="Bytecode Alliance" en="Bytecode Alliance" /></h4>
              <ul>
                <li><a href="https://bytecodealliance.org" target="_blank" rel="noopener">bytecodealliance.org</a></li>
                <li><a href="https://wasmtime.dev" target="_blank" rel="noopener">wasmtime</a></li>
                <li><a href="https://github.com/bytecodealliance/wasm-tools" target="_blank" rel="noopener">wasm-tools</a></li>
                <li><a href="https://component-model.bytecodealliance.org" target="_blank" rel="noopener">Component Model docs</a></li>
                <li><a href="https://wasi.dev" target="_blank" rel="noopener">wasi.dev</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="工具链" en="Toolchain" /></h4>
              <ul>
                <li><a href="https://github.com/WebAssembly/wabt" target="_blank" rel="noopener">wabt · wat2wasm</a></li>
                <li><a href="https://github.com/WebAssembly/binaryen" target="_blank" rel="noopener">binaryen · wasm-opt</a></li>
                <li><a href="https://emscripten.org" target="_blank" rel="noopener">Emscripten</a></li>
                <li><a href="https://rustwasm.github.io/wasm-pack/" target="_blank" rel="noopener">wasm-pack</a></li>
                <li><a href="https://github.com/bytecodealliance/wit-bindgen" target="_blank" rel="noopener">wit-bindgen</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="生产实测" en="In Production" /></h4>
              <ul>
                <li><a href="https://madebyevan.com/figma/building-a-professional-design-tool-on-the-web/" target="_blank" rel="noopener">Figma · Evan Wallace</a></li>
                <li><a href="https://web.dev/articles/ps-on-the-web" target="_blank" rel="noopener">Photoshop on the Web</a></li>
                <li><a href="https://blog.cloudflare.com/tag/webassembly/" target="_blank" rel="noopener">Cloudflare · wasm blog</a></li>
                <li><a href="https://shopify.dev/docs/api/functions" target="_blank" rel="noopener">Shopify Functions</a></li>
                <li><a href="https://v8.dev/blog/tags/webassembly" target="_blank" rel="noopener">V8 blog · wasm</a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo">{WASM_LOGO_SVG}</div>
              <p className="footer-line"><L zh="单页中文 / English 双语 · 资料截至 2026-05" en="Single-page guide · zh / en · last updated 2026-05" /></p>
              <p className="footer-line dim"><code>{`(module (export "future" (func $next9yrs)))`}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
