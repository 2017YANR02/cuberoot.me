'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LangCtx, L, type Lang } from '../_intro/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './javascript_intro.css';
import i18n from '@/i18n/i18n-client';

const JS_LOGO_SVG = (
  <svg viewBox="0 0 256 256">
    <rect width="256" height="256" rx="28" fill="#F7DF1E" />
    <path
      fill="#000"
      d="M134 200c0 14 7 22 19 22 11 0 17-6 17-19v-87h21v87c0 22-13 35-35 35-20 0-32-10-39-22zm87 18 17-10c4 8 11 14 22 14 9 0 15-5 15-11 0-8-6-11-17-16l-6-3c-17-7-28-16-28-35 0-17 13-30 33-30 14 0 25 5 32 18l-17 11c-4-7-8-10-15-10-7 0-12 5-12 10 0 7 4 10 14 14l6 3c20 8 31 17 31 36 0 21-16 32-38 32-21 0-35-10-42-23z"
      transform="translate(-30 0)"
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
    year: <>1995<small>·05</small></>,
    zh: { title: <>10 天的"Mocha"</>, desc: <>Brendan Eich 在 Netscape 用 10 天写出原型，代号 Mocha，本意是给浏览器嵌 Java applet 用——结果在 Netscape 的市场策略下被推成了独立语言。原型短到几乎没设计：原型链、<code>this</code> 规则、自动类型转换的怪癖都来自这 10 天。</> },
    en: { title: <>10 days of "Mocha"</>, desc: <>Brendan Eich prototyped it in 10 days at Netscape under the codename Mocha, originally meant to embed Java applets in the browser. Marketing pushed it as a standalone language. The prototype was so rushed that the prototype chain, <code>this</code> rules, and coercion quirks all date to those 10 days.</> },
  },
  {
    year: <>1995<small>·12</small></>,
    zh: { title: <>更名 JavaScript</>, desc: <>12 月 4 日，Netscape 与 Sun 联合发布会改名为 JavaScript——纯粹的市场行为，蹭 Java 当时的热度。这个名字后来被 30 年的开发者反复抱怨："它和 Java 的关系，只是名字。"</> },
    en: { title: <>Renamed to JavaScript</>, desc: <>December 4th: Netscape and Sun co-announced the rename — pure marketing, riding Java's hype. Thirty years of developers have complained ever since: "Java is to JavaScript as ham is to hamster."</> },
  },
  {
    year: <>1996<small>·08</small></>,
    zh: { title: <>JScript / 浏览器战争</>, desc: <>微软在 IE 3.0 里塞进了反向工程的克隆——JScript。两家实现差异巨大，前端开发被迫为每个浏览器写一份代码。这是<strong>跨浏览器兼容</strong>这个词的起点。</> },
    en: { title: <>JScript / browser wars</>, desc: <>Microsoft shipped a reverse-engineered clone in IE 3.0 — JScript. The two implementations diverged wildly; web devs had to write a different code path for each browser. The phrase <strong>cross-browser compatibility</strong> was born here.</> },
  },
  {
    year: <>1997<small>·06</small></>,
    zh: { title: <>ECMA-262 第一版</>, desc: <>为了平息浏览器战争，规范交给 ECMA 标准化，正式名 <code>ECMAScript</code>。"JS" 这个名字被 Netscape 注册了，所以语言本身在标准里叫别的——这件事直到今天还让初学者迷惑。</> },
    en: { title: <>ECMA-262 1st edition</>, desc: <>To stop the browser wars, the spec moved to ECMA — standard name <code>ECMAScript</code>. "JavaScript" was a Netscape trademark, so the spec uses a different name. This still confuses newcomers thirty years later.</> },
  },
  {
    year: <>1999<small>·12</small></>,
    zh: { title: <>ES3 — 十年沉淀期</>, desc: <>正则表达式、<code>try/catch</code>、更严格的相等。ES3 之后语言进入<strong>10 年停滞</strong>——ES4 的雄心计划被否，社区在等一个能动的标准委员会。这十年语言没动，但浏览器引擎在偷偷长大。</> },
    en: { title: <>ES3 — a decade of stillness</>, desc: <>Regex, <code>try/catch</code>, stricter equality. After ES3 the language sat for <strong>ten years</strong> — ES4's ambitions were vetoed, and the spec committee deadlocked. The language froze; meanwhile, browser engines quietly grew up underneath.</> },
  },
  {
    year: <>2005<small>·02</small></>,
    zh: { title: <>"Ajax" 一词诞生</>, desc: <>Jesse James Garrett 给 Gmail / Google Maps 那种"不刷新页面也能交互"的玩法起了个名字：<strong>Ajax</strong>。前端从"渲染静态页面"突然变成了"承载完整应用"——JS 第一次被严肃对待。</> },
    en: { title: <>"Ajax" coined</>, desc: <>Jesse James Garrett named the trick that powered Gmail and Google Maps — pages that update without reloading: <strong>Ajax</strong>. The frontend suddenly stopped being static rendering and started carrying full apps. JS finally got taken seriously.</> },
  },
  {
    year: <>2006<small>·08</small></>,
    zh: { title: <>jQuery 横扫</>, desc: <>John Resig 发布 jQuery，把 IE6/7/8/9 那一堆奇形怪状的 DOM API 封装成 <code>$(...)</code>。它统治了将近 10 年，巅峰时 80% 的网站靠它跑。"先 jQuery 再说"是当年所有前端开发者的口头禅。</> },
    en: { title: <>jQuery takes over</>, desc: <>John Resig shipped jQuery, wrapping the maze of IE6/7/8/9 DOM APIs behind <code>$(...)</code>. It ruled for nearly a decade — at peak it sat on 80% of all websites. "Reach for jQuery first" was every frontend dev's reflex.</> },
  },
  {
    year: <>2008<small>·09</small></>,
    zh: { title: <>V8 + Chrome — JIT 革命</>, desc: <>Google 发布 V8 引擎和 Chrome。把 JS 从"解释器跑"变成"JIT 编译跑"，性能上了一个数量级。这一刻起，"JS 慢"不再是默认假设——它是一个可以被工程化解决的问题。</> },
    en: { title: <>V8 + Chrome — the JIT revolution</>, desc: <>Google launched V8 and Chrome. JavaScript moved from interpreter to JIT compiler — order-of-magnitude faster. From that moment "JS is slow" stopped being a default assumption and became a tractable engineering problem.</> },
  },
  {
    year: <>2009<small>·05</small></>,
    zh: { title: <>Node.js — 服务器端 JS</>, desc: <>Ryan Dahl 把 V8 抽出来塞到服务器端，加上事件循环和非阻塞 IO，就有了 Node.js。"JavaScript everywhere" 从一句口号变成了一份产品路线图。npm 这个包管理器一年后到来。</> },
    en: { title: <>Node.js — JS on the server</>, desc: <>Ryan Dahl wrapped V8 with an event loop and non-blocking IO — Node.js. "JavaScript everywhere" stopped being a slogan and became a roadmap. The npm package manager arrived a year later.</> },
  },
  {
    year: <>2009<small>·12</small></>,
    zh: { title: <>ES5 解冻</>, desc: <><code>strict mode</code>、<code>JSON.parse</code>、<code>Array</code> 上的 <code>map / filter / reduce</code>、<code>Object.keys</code>。10 年僵局打破，TC39 委员会重新动起来。这是现代 JS 的第一块地基。</> },
    en: { title: <>ES5 thaws the ice</>, desc: <><code>strict mode</code>, <code>JSON.parse</code>, <code>map / filter / reduce</code> on arrays, <code>Object.keys</code>. The decade-long deadlock broke; TC39 started moving again. This is modern JS's first foundation slab.</> },
  },
  {
    year: <>2015<small>·06</small></>, highlight: true,
    zh: { title: <>ES6 / ES2015 — 史上最大跳跃</>, desc: <><code>let / const</code>、箭头函数、<code>class</code>、<code>import / export</code>、<code>Promise</code>、生成器、解构、模板字面量、扩展运算符——一次塞进语言。<strong>这是 JS 历史上最大的一次升级</strong>，它真正让"现代 JS"和"古代 JS"分了家。</> },
    en: { title: <>ES6 / ES2015 — the biggest leap</>, desc: <><code>let / const</code>, arrow functions, <code>class</code>, <code>import / export</code>, <code>Promise</code>, generators, destructuring, template literals, the spread operator — all in one shot. <strong>The single biggest upgrade in the language's history.</strong> "Modern JS" and "ancient JS" parted ways here.</> },
  },
  {
    year: <>2017<small>·06</small></>,
    zh: { title: <>async / await</>, desc: <>ES2017 引入 <code>async / await</code>。"回调地狱"这个名词正式退役。从此异步代码读起来像同步代码，初学者第一次能轻松上手网络请求。</> },
    en: { title: <>async / await</>, desc: <>ES2017 ships <code>async / await</code>. "Callback hell" is formally retired. Async code finally reads like sync code; for the first time, a beginner can write a network request without a tutorial detour.</> },
  },
  {
    year: '2020',
    zh: { title: <>ES2020 — 现代生活质量</>, desc: <>可选链 <code>?.</code>、空值合并 <code>??</code>、动态 <code>import()</code>、<code>BigInt</code>、<code>Promise.allSettled</code>、<code>globalThis</code>。每一个都是日常用得上的小革新，叠在一起就是又一次质变。</> },
    en: { title: <>ES2020 — quality-of-life upgrades</>, desc: <>Optional chaining <code>?.</code>, nullish coalescing <code>??</code>, dynamic <code>import()</code>, <code>BigInt</code>, <code>Promise.allSettled</code>, <code>globalThis</code>. Each small, but stacked together: another step-change in everyday ergonomics.</> },
  },
  {
    year: '2024',
    zh: { title: <>TC39 年度节奏</>, desc: <>每年一发已成惯例。最近落地：迭代器 helper、<code>Set</code> 方法（<code>union / intersection / difference</code>）、<code>Promise.withResolvers</code>。Records & Tuples / Pattern Matching 还在提案队列里。语言演化进入"小步快跑"模式。</> },
    en: { title: <>TC39's yearly cadence</>, desc: <>One release a year, like clockwork. Recent landings: iterator helpers, <code>Set</code> methods (<code>union / intersection / difference</code>), <code>Promise.withResolvers</code>. Records & Tuples and Pattern Matching are still in proposal land. Language evolution is now "ship small, ship often."</> },
  },
  {
    year: '2026', highlight: true,
    zh: { title: <>仍是世界第一语言</>, desc: <>StackOverflow 调查：JavaScript 连续 13 年最常用语言。npm 仓库 <strong>2.5M+</strong> 包。每个浏览器的母语，Node / Bun / Deno 都跑它，AI 工具（Claude Code / Cursor / v0）默认输出它。"ESM vs CJS" 的旧伤基本愈合，少数包还在养。</> },
    en: { title: <>Still the world's #1 language</>, desc: <>StackOverflow Survey: JavaScript, 13 years running. npm hosts <strong>2.5M+</strong> packages. Native to every browser; Node / Bun / Deno all run it; AI tools (Claude Code / Cursor / v0) emit it by default. The "ESM vs CJS" wound has mostly healed, though a few packages still nurse it.</> },
  },
];

interface JsCard {
  tag: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const JS_CARDS: JsCard[] = [
  {
    tag: 'A',
    zh: { title: <>原型链 + <code>this</code></>, desc: <>对象指向另一个对象作为"原型"，属性查找沿链向上。<code>this</code> 不是对象的字段，是<strong>调用现场</strong>注入的。</> },
    en: { title: <>Prototypes + <code>this</code></>, desc: <>Objects point at another object as "prototype"; lookup walks the chain. <code>this</code> isn't a field on the object — it's <strong>injected by the call site</strong>.</> },
    code: (
      <code>
        <span className="cl-k">const</span> <span className="cl-v">animal</span> = {'{ '}<span className="cl-fn">speak</span>() {'{ '}<span className="cl-fn">console</span>.<span className="cl-fn">log</span>(<span className="cl-k">this</span>.<span className="cl-prop">name</span>); {'}'} {'};'}{'\n'}
        <span className="cl-k">const</span> <span className="cl-v">cat</span> = <span className="cl-fn">Object</span>.<span className="cl-fn">create</span>(<span className="cl-v">animal</span>);{'\n'}
        <span className="cl-v">cat</span>.<span className="cl-prop">name</span> = <span className="cl-s">"Mochi"</span>;{'\n'}
        <span className="cl-v">cat</span>.<span className="cl-fn">speak</span>();          <span className="cl-c">// Mochi</span>{'\n\n'}
        <span className="cl-k">const</span> <span className="cl-v">f</span> = <span className="cl-v">cat</span>.<span className="cl-prop">speak</span>;{'\n'}
        <span className="cl-fn">f</span>();                  <span className="cl-c">// undefined  ← this lost</span>
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <>一等公民 + 闭包</>, desc: <>函数是值，可以传、可以返、可以存。函数创建时<strong>抓住外层作用域</strong>，到处带着走——这就是闭包。</> },
    en: { title: <>First-class fns + closures</>, desc: <>Functions are values — pass them, return them, store them. They <strong>capture their outer scope</strong> at creation time and carry it around. That's a closure.</> },
    code: (
      <code>
        <span className="cl-k">function</span> <span className="cl-fn">counter</span>() {'{'}{'\n'}
        {'  '}<span className="cl-k">let</span> <span className="cl-v">n</span> = <span className="cl-n">0</span>;{'\n'}
        {'  '}<span className="cl-k">return</span> () =&gt; ++<span className="cl-v">n</span>;{'\n'}
        {'}'}{'\n\n'}
        <span className="cl-k">const</span> <span className="cl-v">tick</span> = <span className="cl-fn">counter</span>();{'\n'}
        <span className="cl-fn">tick</span>(); <span className="cl-fn">tick</span>(); <span className="cl-fn">tick</span>();   <span className="cl-c">// 3</span>{'\n'}
        <span className="cl-c">// n 仍活着，被闭包抓住了 / n still alive</span>
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <>动态类型 + 隐式转换</>, desc: <>变量没有类型，值才有。<code>+</code> 一旦碰到字符串就转字符串。这是 JS 又灵活又出名易踩坑的地方。</> },
    en: { title: <>Dynamic types + coercion</>, desc: <>Variables don't have types — values do. <code>+</code> coerces to string the moment a string shows up. JavaScript's most flexible — and most infamous — corner.</> },
    code: (
      <code>
        <span className="cl-n">1</span> + <span className="cl-s">"2"</span>           <span className="cl-c">// "12"  ← string</span>{'\n'}
        <span className="cl-s">"5"</span> - <span className="cl-n">1</span>           <span className="cl-c">// 4     ← number</span>{'\n'}
        [] + []           <span className="cl-c">// ""</span>{'\n'}
        [] + {'{}'}           <span className="cl-c">{"// \"[object Object]\""}</span>{'\n'}
        <span className="cl-fn">Number</span>(<span className="cl-s">""</span>)        <span className="cl-c">// 0</span>{'\n\n'}
        <span className="cl-c">// 用 === 不用 ==  / use ===, never ==</span>
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <>事件循环</>, desc: <>JS 是<strong>单线程</strong>的，但有一个调度器：宏任务、微任务、渲染。理解它，异步行为就不再玄学。</> },
    en: { title: <>The event loop</>, desc: <>JavaScript is <strong>single-threaded</strong>, but has a scheduler: macrotasks, microtasks, render. Once you grok it, async behavior stops being magic.</> },
    code: (
      <code>
        <span className="cl-fn">console</span>.<span className="cl-fn">log</span>(<span className="cl-s">"A"</span>);{'\n'}
        <span className="cl-fn">setTimeout</span>(() =&gt; <span className="cl-fn">console</span>.<span className="cl-fn">log</span>(<span className="cl-s">"B"</span>), <span className="cl-n">0</span>);{'\n'}
        <span className="cl-fn">Promise</span>.<span className="cl-fn">resolve</span>().<span className="cl-fn">then</span>(() =&gt; <span className="cl-fn">console</span>.<span className="cl-fn">log</span>(<span className="cl-s">"C"</span>));{'\n'}
        <span className="cl-fn">console</span>.<span className="cl-fn">log</span>(<span className="cl-s">"D"</span>);{'\n\n'}
        <span className="cl-c">// A D C B</span>{'\n'}
        <span className="cl-c">// 同步 → 微任务 → 宏任务</span>
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <>Promise + async / await</>, desc: <>把"未来某一刻才有"的值用对象表达。<code>async</code> 函数自动包成 Promise，<code>await</code> 让你像写同步一样写异步。</> },
    en: { title: <>Promise + async / await</>, desc: <>A value-that-will-arrive, modeled as an object. <code>async</code> functions auto-wrap into Promises; <code>await</code> lets you write async code that reads like sync.</> },
    code: (
      <code>
        <span className="cl-k">async function</span> <span className="cl-fn">load</span>() {'{'}{'\n'}
        {'  '}<span className="cl-k">const</span> <span className="cl-v">res</span> = <span className="cl-k">await</span> <span className="cl-fn">fetch</span>(<span className="cl-s">"/api/users"</span>);{'\n'}
        {'  '}<span className="cl-k">if</span> (!<span className="cl-v">res</span>.<span className="cl-prop">ok</span>) <span className="cl-k">throw</span> <span className="cl-k">new</span> <span className="cl-fn">Error</span>(<span className="cl-v">res</span>.<span className="cl-prop">statusText</span>);{'\n'}
        {'  '}<span className="cl-k">return</span> <span className="cl-v">res</span>.<span className="cl-fn">json</span>();{'\n'}
        {'}'}{'\n\n'}
        <span className="cl-k">const</span> <span className="cl-v">users</span> = <span className="cl-k">await</span> <span className="cl-fn">load</span>();
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <>解构 + 扩展</>, desc: <>对象和数组按形状拆开。配上扩展运算符 <code>...</code>，写不可变更新就一行的事。</> },
    en: { title: <>Destructuring + spread</>, desc: <>Pull objects and arrays apart by shape. Combined with <code>...</code> spread, immutable updates become one-liners.</> },
    code: (
      <code>
        <span className="cl-k">const</span> {'{ '}<span className="cl-v">name</span>, <span className="cl-v">age</span> = <span className="cl-n">18</span> {'}'} = <span className="cl-v">user</span>;{'\n'}
        <span className="cl-k">const</span> [<span className="cl-v">first</span>, ...<span className="cl-v">rest</span>] = <span className="cl-v">items</span>;{'\n\n'}
        <span className="cl-k">const</span> <span className="cl-v">next</span> = {'{ '}...<span className="cl-v">user</span>, <span className="cl-prop">age</span>: <span className="cl-v">user</span>.<span className="cl-prop">age</span> + <span className="cl-n">1</span> {'};'}{'\n'}
        <span className="cl-k">const</span> <span className="cl-v">all</span> = [...<span className="cl-v">a</span>, ...<span className="cl-v">b</span>, <span className="cl-n">42</span>];
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <>ESM 模块</>, desc: <><code>import / export</code> 静态可分析。每个文件一个作用域，不再污染全局。Node 22+、Bun、Deno、所有现代浏览器都原生支持。</> },
    en: { title: <>ESM modules</>, desc: <><code>import / export</code>, statically analyzable. Every file is its own scope — no more global pollution. Native in Node 22+, Bun, Deno, and every modern browser.</> },
    code: (
      <code>
        <span className="cl-c">// math.js</span>{'\n'}
        <span className="cl-k">export function</span> <span className="cl-fn">add</span>(<span className="cl-v">a</span>, <span className="cl-v">b</span>) {'{ '}<span className="cl-k">return</span> <span className="cl-v">a</span> + <span className="cl-v">b</span>; {'}'}{'\n'}
        <span className="cl-k">export const</span> <span className="cl-v">PI</span> = <span className="cl-n">3.14159</span>;{'\n\n'}
        <span className="cl-c">// app.js</span>{'\n'}
        <span className="cl-k">import</span> {'{ '}<span className="cl-v">add</span>, <span className="cl-v">PI</span> {'}'} <span className="cl-k">from</span> <span className="cl-s">"./math.js"</span>;
      </code>
    ),
  },
  {
    tag: 'H',
    zh: { title: <>可选链 + 空值合并</>, desc: <>ES2020 的 <code>?.</code> 和 <code>??</code>。从此 "<code>a &amp;&amp; a.b &amp;&amp; a.b.c</code>" 这种防御性写法绝迹。</> },
    en: { title: <>Optional chaining + nullish</>, desc: <>ES2020's <code>?.</code> and <code>??</code>. The defensive "<code>a &amp;&amp; a.b &amp;&amp; a.b.c</code>" pattern finally went extinct.</> },
    code: (
      <code>
        <span className="cl-k">const</span> <span className="cl-v">city</span> = <span className="cl-v">user</span>?.<span className="cl-prop">address</span>?.<span className="cl-prop">city</span>;{'\n'}
        <span className="cl-c">// undefined if any link is null</span>{'\n\n'}
        <span className="cl-k">const</span> <span className="cl-v">page</span> = <span className="cl-v">query</span>.<span className="cl-prop">page</span> ?? <span className="cl-n">1</span>;{'\n'}
        <span className="cl-c">// only fall back on null / undefined</span>{'\n'}
        <span className="cl-c">// (0 and "" stay)</span>
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
    zh: { title: <>每个浏览器的母语</>, desc: <>Chrome / Safari / Firefox / Edge——你的代码什么都不装就能跑。这是任何其他语言都没有的地基。<strong>30 亿台设备</strong>同时是它的运行时。</> },
    en: { title: <>Every browser speaks it</>, desc: <>Chrome / Safari / Firefox / Edge — your code runs with zero install. No other language has this foundation. <strong>3 billion devices</strong> are simultaneously its runtime.</> },
    code: <><span className="cl-c">{'// open devtools, anywhere'}</span>{'\n'}<span className="cl-fn">alert</span>(<span className="cl-s">"Hello"</span>);</>,
  },
  {
    icon: '⎇',
    zh: { title: <>不破旧立新</>, desc: <>1996 年那行代码 2026 年还能跑。语言永远<strong>向后兼容</strong>，从不破坏 web。这是 JS 最大的承诺，也是它必须永远带着设计黑历史的代价。</> },
    en: { title: <>Never break the web</>, desc: <>That line of code from 1996 still runs in 2026. JavaScript is <strong>backward-compatible forever</strong>, by design. The greatest promise the language ever made — and the reason it carries every old design wart with it.</> },
    code: <><span className="cl-c">{'// 1996'}</span>{'\n'}<span className="cl-k">var</span> <span className="cl-v">x</span> = <span className="cl-n">1</span>;{'\n'}<span className="cl-c">{'// 2026 — still runs'}</span></>,
  },
  {
    icon: '⛯',
    zh: { title: <>异步天然在血脉里</>, desc: <>单线程 + 事件循环——这套模型本来是为了浏览器，结果到了服务器、IoT、edge function 都通用。Node、Bun、Deno、Cloudflare Workers 都是它在不同场景的化身。</> },
    en: { title: <>Async in the genes</>, desc: <>Single-threaded plus event loop — designed for the browser, generalized to servers, IoT, edge functions. Node, Bun, Deno, Cloudflare Workers — all incarnations of the same model.</> },
    code: <><span className="cl-fn">setTimeout</span>(<span className="cl-fn">tick</span>, <span className="cl-n">0</span>);{'\n'}<span className="cl-fn">fetch</span>(<span className="cl-v">url</span>).<span className="cl-fn">then</span>(<span className="cl-fn">render</span>);{'\n'}<span className="cl-c">{'// the loop schedules everything'}</span></>,
  },
  {
    icon: '⚙',
    zh: { title: <>npm — 全宇宙最大包仓库</>, desc: <>2.5M+ 包，月下载 200B+。<code>npm install</code> 一行就能拉来一个完整 SDK。生态广度是任何一门语言都望尘莫及的。</> },
    en: { title: <>npm — the largest registry alive</>, desc: <>2.5M+ packages, 200B+ monthly downloads. One <code>npm install</code> pulls in a full SDK. The ecosystem's reach is unmatched by any other language.</> },
    code: <>npm i react vite zod{'\n'}<span className="cl-c">{'// three industries arrive in 5s'}</span></>,
  },
  {
    icon: '⌬',
    zh: { title: <>TC39 — 慢但稳</>, desc: <>提案要走完 4 个 stage 才进语言。慢，但每一条进了的特性都<strong>永久存在</strong>。社区抱怨速度，但没人愿意回到 ES4 那种"什么都想塞"的混乱。</> },
    en: { title: <>TC39 — slow but durable</>, desc: <>Every proposal goes through 4 stages. Slow — but everything that lands stays <strong>permanently</strong>. The community complains about pace, but nobody wants to return to the ES4 era of "throw everything in."</> },
    code: <><span className="cl-c">// stage 0 → 1 → 2 → 3 → 4</span>{'\n'}<span className="cl-c">// once at 4, it's in the language</span>{'\n'}<span className="cl-c">// for the next 30 years</span></>,
  },
  {
    icon: '⌖',
    zh: { title: <>"先跑起来再说"</>, desc: <>没有编译期，写完就能运行。这门语言天生鼓励<strong>原型 → 验证 → 迭代</strong>的工作流。它不是最严谨的语言，但它是最容易把一个想法变成 demo 的语言。</> },
    en: { title: <>"Just run it"</>, desc: <>No compile step. Write, run, see. The language is built around the <strong>prototype → validate → iterate</strong> loop. Not the most rigorous, but the fastest path from idea to demo.</> },
    code: <><span className="cl-c">{'// 0 boilerplate'}</span>{'\n'}<span className="cl-fn">document</span>.<span className="cl-prop">title</span> = <span className="cl-s">"hi"</span>;{'\n'}<span className="cl-c">{'// → done'}</span></>,
  },
  {
    icon: '⌗',
    zh: { title: <>AI 工具的母语</>, desc: <>Claude Code、Cursor、v0、Bolt——AI 代码生成器输出最熟练的语言就是 JS / TS。<strong>训练数据里 JS 量最大</strong>，模型对它的把握也最准。</> },
    en: { title: <>AI tooling's native tongue</>, desc: <>Claude Code, Cursor, v0, Bolt — AI code generators speak JS/TS most fluently. <strong>JS dominates the training corpus</strong>, and models are most accurate on it.</> },
    code: <><span className="cl-c">{'// "build me a todo list"'}</span>{'\n'}<span className="cl-c">{'// → 80 lines of React + JS'}</span>{'\n'}<span className="cl-c">{'// in seconds, mostly correct'}</span></>,
  },
  {
    icon: '⏚',
    zh: { title: <>跨越所有平台</>, desc: <>桌面（Electron / Tauri）、移动（React Native / Capacitor）、终端（Ink）、嵌入式（Espruino）、操作系统（KaiOS）、字体编辑器（FontForge），甚至太空船仪表盘——只要那里能跑 JS，那里就有人写 JS。</> },
    en: { title: <>Reaches every platform</>, desc: <>Desktop (Electron / Tauri), mobile (React Native / Capacitor), terminal (Ink), embedded (Espruino), an entire phone OS (KaiOS), font editors (FontForge), even spacecraft dashboards. Wherever JS can run, someone is writing JS.</> },
    code: <><span className="cl-c">{'// same language, all platforms'}</span>{'\n'}<span className="cl-c">{'// VS Code · WhatsApp Desktop'}</span>{'\n'}<span className="cl-c">{'// NASA Mars rover dashboard'}</span></>,
  },
  {
    icon: '⚐',
    zh: { title: <>从初学到资深都能用</>, desc: <>第一节课你能写 <code>alert("Hi")</code>，十年后你能用同一门语言写出 100 万行的 VS Code。<strong>学习曲线低、天花板高</strong>，是它经久不衰的核心原因。</> },
    en: { title: <>From day-1 to decade-10</>, desc: <>Lesson one: <code>alert("Hi")</code>. A decade later: a 1.5M-line VS Code in the same language. <strong>Low floor, very high ceiling</strong> — the core reason it has lasted.</> },
    code: <><span className="cl-c">{'// day 1'}</span>{'\n'}<span className="cl-fn">alert</span>(<span className="cl-s">"Hi"</span>);{'\n\n'}<span className="cl-c">{'// year 10'}</span>{'\n'}<span className="cl-c">{'// VS Code, Figma, Linear...'}</span></>,
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
    href: 'https://www.netflix.com',
    zhName: 'Netflix', enName: 'Netflix',
    zhNote: '前端 + Node 后端', enNote: 'Frontend + Node backend',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" fill="#000"/><path d="M30 12 H42 L58 60 V12 H70 V88 H58 L42 40 V88 H30 Z" fill="#E50914"/></svg>,
  },
  {
    href: 'https://www.paypal.com',
    zhName: 'PayPal', enName: 'PayPal',
    zhNote: 'Java → Node 史上最早大迁移', enNote: 'Java → Node, the original migration',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#003087"/><path d="M30 22 H56 C66 22 72 30 70 40 C68 50 60 54 50 54 H42 L38 78 H28 Z M44 32 L40 46 H50 C56 46 60 42 60 38 C60 34 56 32 52 32 Z" fill="#fff"/><path d="M40 38 H62 C72 38 78 46 76 56 C74 66 66 70 56 70 H48 L44 86 H34 Z" fill="#009CDE" opacity=".85"/></svg>,
  },
  {
    href: 'https://github.com/anthropics/claude-code', highlight: true,
    zhName: 'Claude Code', enName: 'Claude Code',
    zhNote: 'AI 终端 agent · Bun + TS', enNote: 'AI terminal agent · Bun + TS',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#D97757"/><path d="M28 65 L42 30 H50 L36 65 Z M50 30 H58 L72 65 H64 Z M44 52 H56 L52 42 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://code.visualstudio.com',
    zhName: 'VS Code', enName: 'VS Code',
    zhNote: 'Electron · 1.5M 行 JS/TS', enNote: 'Electron · 1.5M lines JS/TS',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M75 5 L40 40 L20 25 L10 30 L25 50 L10 70 L20 75 L40 60 L75 95 L90 88 V12 Z" fill="#0098FF"/></svg>,
  },
  {
    href: 'https://www.figma.com',
    zhName: 'Figma', enName: 'Figma',
    zhNote: 'WASM + JS 协奏', enNote: 'WASM + JS in concert',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="35" y="10" width="30" height="26" rx="13" fill="#F24E1E"/><rect x="35" y="36" width="30" height="26" rx="13" fill="#A259FF"/><rect x="35" y="62" width="30" height="26" rx="13" fill="#0ACF83"/><rect x="5" y="10" width="30" height="26" rx="13" fill="#FF7262"/><rect x="5" y="36" width="30" height="26" rx="13" fill="#1ABCFE"/></svg>,
  },
  {
    href: 'https://www.linkedin.com',
    zhName: 'LinkedIn', enName: 'LinkedIn',
    zhNote: '2011 早期 Node 旗手', enNote: 'Early Node adopter, 2011',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0A66C2"/><rect x="20" y="38" width="14" height="44" fill="#fff"/><circle cx="27" cy="25" r="8" fill="#fff"/><path d="M44 38 H58 V46 C62 40 68 36 76 36 C86 36 92 44 92 56 V82 H78 V60 C78 54 76 50 70 50 C64 50 58 54 58 62 V82 H44 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://discord.com',
    zhName: 'Discord', enName: 'Discord',
    zhNote: 'Electron 桌面端', enNote: 'Electron desktop app',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="20" fill="#5865F2"/><path d="M30 35 Q50 28 70 35 L80 70 Q70 78 60 78 L57 72 Q53 73 50 73 Q47 73 43 72 L40 78 Q30 78 20 70 Z M40 55 A4 5 0 1 0 40 56 Z M60 55 A4 5 0 1 0 60 56 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://www.airbnb.com',
    zhName: 'Airbnb', enName: 'Airbnb',
    zhNote: 'React + RN + Hermes 推手', enNote: 'React + RN + Hermes pioneer',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M50 12 C30 12 12 50 28 75 C36 88 50 90 50 75 C50 60 38 55 38 45 C38 35 43 28 50 28 C57 28 62 35 62 45 C62 55 50 60 50 75 C50 90 64 88 72 75 C88 50 70 12 50 12 Z" fill="#FF5A5F"/></svg>,
  },
  {
    href: 'https://nodejs.org', highlight: true,
    zhName: 'Node.js', enName: 'Node.js',
    zhNote: '"JS 上服务器"原点', enNote: 'JS-on-server, ground zero',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M50 5 L92 28 V72 L50 95 L8 72 V28 Z" fill="#539E43"/><path d="M50 5 L92 28 V72 L50 95 V5" fill="#43853D"/><path d="M40 45 H44 V62 C44 66 47 68 51 68 C55 68 58 66 58 62 V45 H62 V62 C62 70 56 73 51 73 C46 73 40 70 40 62 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://reactnative.dev',
    zhName: 'React Native', enName: 'React Native',
    zhNote: '一份 JS 跑 iOS / Android', enNote: 'One JS, both iOS and Android',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="6" fill="#61DAFB"/><ellipse cx="50" cy="50" rx="40" ry="15" fill="none" stroke="#61DAFB" strokeWidth="3"/><ellipse cx="50" cy="50" rx="40" ry="15" fill="none" stroke="#61DAFB" strokeWidth="3" transform="rotate(60 50 50)"/><ellipse cx="50" cy="50" rx="40" ry="15" fill="none" stroke="#61DAFB" strokeWidth="3" transform="rotate(120 50 50)"/></svg>,
  },
  {
    href: 'https://vercel.com', highlight: true,
    zhName: 'Vercel', enName: 'Vercel',
    zhNote: 'Next.js 母公司 · Edge JS 推手', enNote: 'Next.js maker, edge JS evangelist',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M10 80 L50 15 L90 80 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://www.npmjs.com',
    zhName: 'npm', enName: 'npm',
    zhNote: '2.5M+ 包，世界最大', enNote: '2.5M+ packages, world’s biggest',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" fill="#CB3837"/><path d="M15 35 H85 V65 H50 V40 H40 V65 H15 Z" fill="#fff"/><rect x="62" y="42" width="6" height="18" fill="#CB3837"/></svg>,
  },
];

interface AiTool { name: string; zhDesc: string; enDesc: string }
const AI_TOOLS: AiTool[] = [
  { name: 'Claude Code',     zhDesc: 'Anthropic 终端 agent · TS / Bun', enDesc: 'Anthropic terminal agent · TS / Bun' },
  { name: 'Cursor',          zhDesc: 'AI IDE · Electron / TS', enDesc: 'AI IDE · Electron / TS' },
  { name: 'GitHub Copilot',  zhDesc: 'VS Code 编辑器集成 · TS', enDesc: 'VS Code editor extension · TS' },
  { name: 'v0',              zhDesc: 'Vercel UI 生成 · 输出 React/JS', enDesc: 'Vercel UI generator · emits React/JS' },
  { name: 'Bolt.new',        zhDesc: '浏览器内 AI IDE · WebContainer', enDesc: 'In-browser AI IDE · WebContainer' },
  { name: 'Lovable',         zhDesc: '自然语言生 React 应用', enDesc: 'Natural-language to React apps' },
  { name: 'Vercel AI SDK',   zhDesc: 'AI 应用框架 · TS-only', enDesc: 'AI app framework · TS-only' },
  { name: 'LangChain.js',    zhDesc: 'LangChain 的 JS 实现', enDesc: 'LangChain, JS implementation' },
  { name: 'Mastra',          zhDesc: 'Agent / workflow · TS', enDesc: 'Agent / workflow · TS' },
  { name: 'Replit Agent',    zhDesc: '云端 AI 编码 · Node 运行', enDesc: 'Cloud AI coding · runs on Node' },
  { name: 'Continue',        zhDesc: 'VS Code 开源 AI 助手', enDesc: 'Open-source VS Code AI helper' },
  { name: 'Aider',           zhDesc: '终端 AI 编码', enDesc: 'Terminal AI pair-programmer' },
  { name: 'Zod',             zhDesc: 'Schema 校验 · 半个 AI 生态依赖它', enDesc: 'Schema validation · half of AI uses it' },
  { name: '@anthropic-ai/sdk', zhDesc: 'Anthropic 官方 JS SDK', enDesc: 'Official Anthropic JS SDK' },
  { name: 'openai (npm)',    zhDesc: 'OpenAI 官方 JS SDK', enDesc: 'Official OpenAI JS SDK' },
  { name: 'MCP TS SDK',      zhDesc: 'Model Context Protocol · TS', enDesc: 'Model Context Protocol · TS' },
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
    tag: <>HOT · POST-NODE</>, hot: true, big: true,
    zh: {
      title: <>"Post-Node" 时代的运行时</>,
      body: (<>
        <p>JS 服务端长期是 Node 的天下，2024 起势头开始转向：<strong>Bun</strong> 启动比 Node 快 4 倍、原生吞 TS / JSX、内置 SQLite；<strong>Deno</strong> 安全模型默认收紧，标准库比 Node 厚；<strong>Cloudflare Workers / Vercel Edge</strong> 把 JS 推进毫秒级冷启动的 edge 场景。</p>
        <p>这条路的尽头不是"谁取代谁"——而是 JS 一门语言、四种运行时各占场景：<em>Node 生态、Bun 性能、Deno 安全、Edge runtime 部署</em>。</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">Node 22 cold start</span><span className="bar-val">~120ms</span></div>
          <div className="bar bar-new"><span className="bar-label">Bun 1.x cold start</span><span className="bar-val">~30ms</span></div>
        </div>
      </>),
    },
    en: {
      title: <>The "post-Node" runtime era</>,
      body: (<>
        <p>The server side has been Node's territory for over a decade — but the wind shifted in 2024: <strong>Bun</strong> starts 4× faster than Node, eats TS / JSX natively, ships SQLite; <strong>Deno</strong> tightens the security model and ships a fatter standard library; <strong>Cloudflare Workers / Vercel Edge</strong> push JS into millisecond-cold-start edge territory.</p>
        <p>The endgame isn't replacement — it's one language, four runtimes, each with its niche: <em>Node for ecosystem, Bun for performance, Deno for safety, edge runtimes for deployment</em>.</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">Node 22 cold start</span><span className="bar-val">~120ms</span></div>
          <div className="bar bar-new"><span className="bar-label">Bun 1.x cold start</span><span className="bar-val">~30ms</span></div>
        </div>
      </>),
    },
  },
  {
    tag: 'TC39',
    zh: { title: <>Records & Tuples</>, body: <><p>不可变的 <code>{`#{ a: 1 }`}</code> 和 <code>#[1, 2]</code>，按值比较。一旦落地，<code>Map</code> 用对象做 key 的老问题彻底解决，函数式风格写起来终于自然。</p><p>状态：Stage <strong>2</strong>，进度卡在 <code>===</code> 语义上拉锯多年。</p></> },
    en: { title: <>Records & Tuples</>, body: <><p>Immutable <code>{`#{ a: 1 }`}</code> and <code>#[1, 2]</code>, compared by value. Once it lands, the old "<code>Map</code> with object keys" pain disappears and functional-style code finally reads naturally.</p><p>Status: Stage <strong>2</strong>, deadlocked for years on <code>===</code> semantics.</p></> },
  },
  {
    tag: 'TC39',
    zh: { title: <>类型注解作注释</>, body: <><p>把 TS 风格的类型当注释，让 JS 引擎直接吞下去——TC39 stage 1 提案。落地后，<code>tsc</code> 这一步可以省掉，"JS 跑 TS"就是它字面意思。</p></> },
    en: { title: <>Type annotations as comments</>, body: <><p>TC39 Stage 1 proposal: treat TS-style annotations as comments — JS engines simply ignore them. If it lands, the separate <code>tsc</code> step disappears and "JS that runs TS" becomes literal.</p></> },
  },
  {
    tag: 'PERF',
    zh: { title: <>WASM 是 JS 的逃生口</>, body: <><p>计算密集的部分（图像处理、压缩、SIMD、3D）由 WASM 顶上去，UI / 业务编排留给 JS。Figma 的设计算法、AutoCAD Web、Photoshop Web、Google Earth——都是 WASM + JS 这套组合的实战。</p></> },
    en: { title: <>WASM, JS's escape hatch</>, body: <><p>Compute-heavy work (image processing, compression, SIMD, 3D) goes to WASM; UI and orchestration stay in JS. Figma's design algorithms, AutoCAD Web, Photoshop Web, Google Earth — all real-world WASM + JS in production.</p></> },
  },
  {
    tag: 'AI',
    zh: { title: <>LLM 的首选输出语言</>, body: <><p>2025 多项实测：在主流 LLM 上同等 prompt 让生成代码，<strong>JS / TS 的成功率最高</strong>，单纯因为训练语料里它们的比例最大。AI 越普及，JS 的护城河越宽——它和模型形成了正反馈。</p></> },
    en: { title: <>The LLM's go-to output</>, body: <><p>2025 benchmarks: across mainstream LLMs and identical prompts, <strong>JS / TS produce the highest first-shot success rate</strong> — simply because the training corpus is dominated by them. The more AI spreads, the wider JS's moat: language and model are in a positive feedback loop.</p></> },
  },
  {
    tag: 'DATA',
    zh: { title: <>13 年最常用语言</>, body: <><p>StackOverflow 调查：JavaScript 连续 <strong>13 年</strong>蝉联"最常用语言"。GitHub 仓库数仅 2025 年被 TypeScript 反超——但 TS 也是 JS 的另一种说法。</p></> },
    en: { title: <>13 years as #1 most used</>, body: <><p>StackOverflow Survey: JavaScript has been the most-used language for <strong>13 straight years</strong>. GitHub contributor counts were only overtaken by TypeScript in 2025 — and TS is just another spelling of JS.</p></> },
  },
];

export default function JavaScriptIntroPage() {
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  const rootRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(
    'JavaScript : TheLanguageOfTheWeb — 30 年的网页语言',
    'JavaScript : TheLanguageOfTheWeb — Thirty Years of the Web'
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
        a.style.color = a.getAttribute('href') === '#' + cur ? 'var(--js-bright)' : '';
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
      <div ref={rootRef} className="js-intro-root">
        <div className="grid-bg" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            <svg viewBox="0 0 256 256" width="28" height="28">
              <rect width="256" height="256" rx="28" fill="#F7DF1E" />
              <text x="128" y="180" fontFamily="Cascadia Code, monospace" fontSize="120" fontWeight="700" textAnchor="middle" fill="#000">JS</text>
            </svg>
            <span>JavaScript</span>
            <span className="nav-tag"><L zh=": 中文导览" en=": Guide" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#system"><L zh="语法" en="Essentials" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#projects"><L zh="谁用" en="Adopters" /></a></li>
            <li><a href="#ai"><L zh="AI 时代" en="AI Era" /></a></li>
            <li><a href="#vs"><L zh="对比" en="vs TS" /></a></li>
            <li><a href="#future"><L zh="前景" en="Outlook" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 1995 — 2026 · Brendan Eich · ECMA TC39</div>
            <h1 className="hero-title">
              <span className="hero-name">JavaScript</span>
              <span className="hero-colon">:</span>
              <span className="hero-type">TheLanguageOfTheWeb</span>
            </h1>
            <p className="hero-sub">
              <L
                zh={<>1995 年 Brendan Eich 在 Netscape 用 <strong>10 天</strong>写出原型——名字是为了蹭 Java 的市场。30 年后，它跑在你打开的每一个网页里、绝大多数后端服务器上、AI 工具的源码里、甚至火星车的仪表盘上。一门最常被批评、也最难被替代的语言。</>}
                en={<>Brendan Eich prototyped it in <strong>10 days</strong> at Netscape in 1995 — the name was a marketing piggyback on Java. Thirty years later it runs in every web page you open, on most backend servers, inside AI tooling, and on Mars rover dashboards. The most criticized — and least replaceable — language alive.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">#1<small></small></span>
                <span className="stat-label"><L zh={<>13 年最常用语言<br /><em>StackOverflow Survey</em></>} en={<>most-used language, 13y<br /><em>StackOverflow Survey</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">2.5<small>M+</small></span>
                <span className="stat-label"><L zh={<>npm 包总数<br /><em>世界最大开源仓库</em></>} en={<>npm packages<br /><em>largest open registry alive</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">3<small>B+</small></span>
                <span className="stat-label"><L zh={<>设备能直接跑它<br /><em>每个浏览器的母语</em></>} en={<>devices run it natively<br /><em>every browser speaks it</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">10<small>d</small></span>
                <span className="stat-label"><L zh={<>原型设计周期<br /><em>1995 · Brendan Eich</em></>} en={<>days to prototype<br /><em>1995 · Brendan Eich</em></>} /></span>
              </div>
            </div>
            <div className="hero-cube">
              <div className="hero-cube-face f-front">{JS_LOGO_SVG}</div>
            </div>
            <div className="hero-floats">
              <span className="float f1">{'() => {}'}</span>
              <span className="float f2">async</span>
              <span className="float f3">await</span>
              <span className="float f4">Promise</span>
              <span className="float f5">{'?.??'}</span>
              <span className="float f6">{'...spread'}</span>
              <span className="float f7">{'this'}</span>
              <span className="float f8">prototype</span>
              <span className="float f9">{'== ==='}</span>
              <span className="float f10">npm i</span>
              <span className="float f11">event loop</span>
              <span className="float f12">closure</span>
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
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>JavaScript</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>JavaScript 是为浏览器写的一门<strong>动态、解释、单线程</strong>的脚本语言。在浏览器里它操纵 DOM；在服务器上它跑 HTTP；在 AI 工具里它编排 LLM 调用——一门语言，三十年，渗透到了每一层。</>}
                  en={<>JavaScript is a <strong>dynamic, interpreted, single-threaded</strong> scripting language built for the browser. In a browser it drives the DOM; on a server it speaks HTTP; in AI tooling it orchestrates LLM calls — one language, thirty years, every layer.</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="动态类型" en="Dynamic" />, tag: 'dynamic', p: <L zh={<>变量没有类型，值才有。运行时才确定一个表达式到底是什么——灵活，但出错也只能在运行时发现。</>} en={<>Variables don't carry types — values do. Types resolve at runtime, which is flexible — but errors also only surface at runtime.</>} /> },
                { h: <L zh="解释执行" en="Interpreted" />, tag: 'interpreted', p: <L zh={<>没有编译期。源码进引擎，引擎边解析边 JIT 编译边跑。"写完就能跑"是 JS 最大的开发体验红利。</>} en={<>No compile step. Source goes into the engine, gets parsed, JITed, and run on the fly. "Write and run" is the language's biggest dev-experience win.</>} /> },
                { h: <L zh="单线程" en="Single-threaded" />, tag: 'event-loop', p: <L zh={<>主线程<strong>只有一个</strong>。所有"并发"都靠事件循环+异步任务排队实现。Web Worker / Worker Thread 是有的，但默认你只有一根主线。</>} en={<>One main thread, period. All "concurrency" is the event loop plus async task queuing. Workers exist, but by default you have exactly one thread.</>} /> },
                { h: <L zh="原型继承" en="Prototypal" />, tag: 'prototype', p: <L zh={<>对象继承的不是"类"，是另一个对象。<code>class</code> 是 ES6 的语法糖，底下还是原型链。这个模型简单到诡异，强到惊人。</>} en={<>Objects inherit from other objects, not classes. ES6's <code>class</code> is sugar over the prototype chain. The model is eerily simple — and unreasonably powerful.</>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">old.js · 1996</span><span className="lang-tag js-old">ES3</span></div>
                <pre className="code"><code>
                  <span className="cl-k">var</span> <span className="cl-v">user</span> = {'{ '}<span className="cl-prop">name</span>: <span className="cl-s">"Brendan"</span>, <span className="cl-prop">age</span>: <span className="cl-n">35</span>{' };'}{'\n\n'}
                  <span className="cl-k">function</span> <span className="cl-fn">greet</span>(<span className="cl-v">u</span>) {'{'}{'\n'}
                  {'  '}<span className="cl-k">var</span> <span className="cl-v">self</span> = <span className="cl-k">this</span>;  <span className="cl-c"><L zh="// this 又跑了" en="// this rebound, again" /></span>{'\n'}
                  {'  '}<span className="cl-k">return</span> <span className="cl-s">"Hi, "</span> + <span className="cl-v">u</span>.<span className="cl-prop">name</span>;{'\n'}
                  {'}'}{'\n\n'}
                  <span className="cl-fn">setTimeout</span>(<span className="cl-k">function</span>() {'{'}{'\n'}
                  {'  '}<span className="cl-fn">callback</span>(<span className="cl-k">function</span>() {'{'}{'\n'}
                  {'    '}<span className="cl-c"><L zh="// 回调地狱..." en="// callback hell..." /></span>{'\n'}
                  {'  });'}{'\n'}
                  {'});'}
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">modern.js · 2026</span><span className="lang-tag js">ES2026</span></div>
                <pre className="code"><code>
                  <span className="cl-k">const</span> <span className="cl-v">user</span> = {'{ '}<span className="cl-prop">name</span>: <span className="cl-s">"Brendan"</span>, <span className="cl-prop">age</span>: <span className="cl-n">35</span>{' };'}{'\n\n'}
                  <span className="cl-k">const</span> <span className="cl-fn">greet</span> = (<span className="cl-v">u</span>) =&gt; <span className="cl-s">{'`Hi, ${u.name}`'}</span>;{'\n\n'}
                  <span className="cl-k">async function</span> <span className="cl-fn">load</span>() {'{'}{'\n'}
                  {'  '}<span className="cl-k">const</span> <span className="cl-v">res</span> = <span className="cl-k">await</span> <span className="cl-fn">fetch</span>(<span className="cl-s">"/api/me"</span>);{'\n'}
                  {'  '}<span className="cl-k">const</span> {'{ '}<span className="cl-v">name</span> {'}'} = <span className="cl-k">await</span> <span className="cl-v">res</span>.<span className="cl-fn">json</span>();{'\n'}
                  {'  '}<span className="cl-k">return</span> <span className="cl-v">name</span> ?? <span className="cl-s">"anon"</span>;{'\n'}
                  {'}'}{'\n\n'}
                  <span className="cl-c"><L zh="// 同一门语言，世界换了" en="// same language, different planet" /></span>
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
                zh={<>从 Netscape 一个 10 天的原型，到浏览器战争里被反向工程，到 ES6 的世纪大跳跃，再到今天的多运行时格局——这是一门没有版本号断层、只靠加法演化了 30 年的语言。</>}
                en={<>From a 10-day prototype at Netscape, through the browser wars and a decade of stillness, to the ES6 generational leap and today's multi-runtime landscape — a language that has evolved by addition, never subtraction, for 30 years.</>}
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
              <h2 className="sec-title"><L zh="语法精要" en="Language Essentials" /> <code>: JsAlphabet</code></h2>
              <p className="sec-desc"><L
                zh={<>30 年加法叠出来的语言，特性多到没人记得全。下面这八件套覆盖了 90% 日常代码——把它们吃透，剩下的查 MDN 就够。</>}
                en={<>Thirty years of additive evolution leave a language with more features than anyone remembers. The eight below cover 90% of day-to-day code — internalize them; everything else is an MDN search away.</>}
              /></p>
            </header>

            <div className="ts-grid">
              {JS_CARDS.map((c, i) => (
                <div className="ts-card" key={i}>
                  <div className="ts-tag">{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="ts-code">{c.code}</pre>
                </div>
              ))}
              <div className="ts-card ts-callout">
                <div className="ts-tag ts-tag-soft">∞</div>
                <h3><L zh="一切皆可加，不能减" en="All adds, no subtractions" /></h3>
                <p><L
                  zh={<>30 年来 TC39 几乎从不删特性。这意味着 <code>var</code>、<code>==</code>、原型链、<code>this</code> 的怪癖永远在。学 JS 不只是学最佳实践，也包括知道哪些路是雷。</>}
                  en={<>In 30 years, TC39 has almost never removed a feature. <code>var</code>, <code>==</code>, prototypes, the <code>this</code> quirks — all permanent residents. Learning JS isn't just learning best practice; it's knowing which paths to avoid.</>}
                /></p>
                <p className="ts-callout-quote">"<em><L
                  zh={<>JavaScript 不是被设计出来的，是被进化出来的。</>}
                  en={<>JavaScript wasn't designed — it evolved.</>}
                /></em>"</p>
              </div>
            </div>
          </section>

          {/* 04 Why */}
          <section className="section" id="why">
            <header className="sec-head">
              <span className="sec-num">04</span>
              <h2 className="sec-title"><L zh="为何吃下世界" en="Why JS Ate the World" /> <code>: WhyJS</code></h2>
              <p className="sec-desc"><L
                zh={<>没有一门语言是因为"设计精妙"赢的。JS 赢，是因为它在<strong>对的时间</strong>、占住了<strong>对的位置</strong>——浏览器。剩下三十年都是利息。</>}
                en={<>No language wins because it was beautifully designed. JS won because it was in the <strong>right place</strong> at the <strong>right time</strong> — the browser. The next thirty years were compound interest.</>}
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
              <h2 className="sec-title"><L zh="谁在用" en="Who's Using" /> <code>: ProductionUsers</code></h2>
              <p className="sec-desc"><L
                zh={<>从 Netflix 视频流、PayPal 支付，到 VS Code 桌面、Figma 设计、Discord 聊天——你每天打开的几乎每个软件都在跑 JS。下面 12 个只是冰山尖角。</>}
                en={<>From Netflix streaming and PayPal payments to VS Code, Figma, and Discord — almost every app you touch daily is running JS. The 12 below barely scrape the surface.</>}
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
              <h2 className="sec-title"><L zh="AI 时代的" en="JavaScript in the" /> <code>: <L zh="JavaScript" en="AI Era" /></code></h2>
              <p className="sec-desc"><L
                zh={<>AI 工具链几乎一边倒说 JS——不是因为它优雅，是因为它在公开代码语料里量最大。LLM 见过的 JS 比任何其他语言都多，输出的命中率也最高。这是<strong>数据规模决定的护城河</strong>。</>}
                en={<>AI tooling speaks JS overwhelmingly — not because it's elegant, but because it dominates the public-code corpus. LLMs have seen more JS than any other language, and their first-shot accuracy reflects it. A moat built on <strong>data scale</strong>.</>}
              /></p>
            </header>

            <blockquote className="quote-block">
              <div className="quote-mark">"</div>
              <p className="quote-text"><L
                zh={<>JavaScript 不需要是最好的语言。它只需要<strong>就在那里</strong>——每个浏览器都有它、每个学校都教它、每个公司都用它。当 AI 模型要选一种"默认输出"，它会选见过最多的那门——那就是 JS。语言生态学的第一定律：<strong>规模就是命运</strong>。</>}
                en={<>JavaScript doesn't have to be the best language. It just has to <strong>be there</strong> — in every browser, on every syllabus, in every company. When an AI model picks a default output language, it picks the one it has seen most — and that's JS. The first law of language ecology: <strong>scale is destiny</strong>.</>}
              /></p>
              <footer className="quote-footer">
                <span className="quote-author">— <L zh="开发者社区共识" en="Developer community consensus" /></span>
                <span className="quote-context"><L zh="2025 · 多家 LLM 编码评测" en="2025 · across multiple LLM coding benchmarks" /></span>
              </footer>
            </blockquote>

            <div className="ai-stats">
              <div className="ai-stat">
                <div className="ai-stat-num">#1</div>
                <div className="ai-stat-h"><L zh="LLM 输出最熟练的语言" en="LLMs' most fluent output" /></div>
                <p><L
                  zh={<>2025 多项实测：在 Claude / GPT / Gemini 上同等 prompt 让生成代码，<strong>JS / TS 的首发成功率最高</strong>。直接原因是公开训练语料里 JS 量最大。</>}
                  en={<>2025 benchmarks across Claude / GPT / Gemini, identical prompts: <strong>JS / TS produced the highest first-shot success rate</strong>. The reason is direct — the public training corpus is dominated by JavaScript.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">2.5<small>M</small></div>
                <div className="ai-stat-h"><L zh="npm 包总数" en="npm package count" /></div>
                <p><L
                  zh={<>世界最大的开源代码仓库。AI 想"调一个工具完成任务"，npm 是它最先伸手的地方。<strong>每月 200B+ 下载</strong>是这个生态的脉搏。</>}
                  en={<>The largest open-source registry alive. When AI reaches for "a library to do X," npm is the first place it looks. The ecosystem's pulse: <strong>200B+ downloads / month</strong>.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">100<small>%</small></div>
                <div className="ai-stat-h"><L zh="主流 AI IDE 用 JS/TS 写" en="of mainstream AI IDEs use JS/TS" /></div>
                <p><L
                  zh={<>Cursor / Continue / v0 / Bolt / Lovable / Claude Code——AI 编码工具<strong>无一例外</strong>用 JS 或 TS 写。Electron + React + Node 已经是 AI 工具的事实底层栈。</>}
                  en={<>Cursor / Continue / v0 / Bolt / Lovable / Claude Code — <strong>every</strong> mainstream AI coding tool is written in JS or TS. Electron + React + Node is now the de-facto AI-tool stack.</>}
                /></p>
              </div>
            </div>

            <div className="spotlight">
              <div className="spotlight-tag">SPOTLIGHT</div>
              <div className="spotlight-grid">
                <div>
                  <h3>v0 + AI SDK <span className="spotlight-meta">— <L zh="Vercel 的 AI 输出栈" en="Vercel's AI output stack" /></span></h3>
                  <p><L
                    zh={<>用户用自然语言描述"我想要一个登录页"，v0 输出一份完整的 Next.js + React + Tailwind 页面——背后是 Vercel AI SDK 调 LLM。整条管线从 prompt 到产出全是 JS：模型调用是 JS、组件生成是 JS、部署的运行时还是 JS。</>}
                    en={<>You describe "I want a login page" in plain English; v0 outputs a complete Next.js + React + Tailwind page — powered by Vercel AI SDK calling an LLM under the hood. Every step is JS: the model call, the component synthesis, even the runtime it deploys to.</>}
                  /></p>
                  <ul className="spotlight-list">
                    <li><strong>Vercel AI SDK</strong> — <L zh="20M+ 月下载，provider-agnostic" en="20M+ monthly downloads, provider-agnostic" /></li>
                    <li><strong>Next.js / React</strong> — <L zh="生成的目标框架" en="the framework v0 emits" /></li>
                    <li><strong>Edge Runtime</strong> — <L zh="JS 跑在毫秒级冷启动 worker 上" en="JS on millisecond-cold-start workers" /></li>
                  </ul>
                  <p><L
                    zh={<>一句话：<strong>JS 是 AI 编码工具从输入到输出的同一种货币</strong>。</>}
                    en={<>One line: <strong>JS is the universal currency of AI coding, from input to output.</strong></>}
                  /></p>
                </div>
                <div className="spotlight-code">
                  <pre className="code"><code>
                    <span className="cl-c"><L zh="// AI SDK · 一行调 LLM 拿结构化输出" en="// AI SDK · one call, structured output" /></span>{'\n'}
                    <span className="cl-k">import</span> {'{ '}<span className="cl-v">generateObject</span> {'}'} <span className="cl-k">from</span> <span className="cl-s">"ai"</span>;{'\n'}
                    <span className="cl-k">import</span> {'{ '}<span className="cl-v">anthropic</span> {'}'} <span className="cl-k">from</span> <span className="cl-s">"@ai-sdk/anthropic"</span>;{'\n'}
                    <span className="cl-k">import</span> {'{ '}<span className="cl-v">z</span> {'}'} <span className="cl-k">from</span> <span className="cl-s">"zod"</span>;{'\n\n'}
                    <span className="cl-k">const</span> {'{ '}<span className="cl-v">object</span> {'}'} = <span className="cl-k">await</span> <span className="cl-fn">generateObject</span>({'{'}{'\n'}
                    {'  '}<span className="cl-prop">model</span>: <span className="cl-fn">anthropic</span>(<span className="cl-s">"claude-opus-4-7"</span>),{'\n'}
                    {'  '}<span className="cl-prop">schema</span>: <span className="cl-v">z</span>.<span className="cl-fn">object</span>({'{'}{'\n'}
                    {'    '}<span className="cl-prop">title</span>: <span className="cl-v">z</span>.<span className="cl-fn">string</span>(),{'\n'}
                    {'    '}<span className="cl-prop">items</span>: <span className="cl-v">z</span>.<span className="cl-fn">array</span>(<span className="cl-v">z</span>.<span className="cl-fn">string</span>()){'\n'}
                    {'  }),'}{'\n'}
                    {'  '}<span className="cl-prop">prompt</span>: <span className="cl-s">"a todo list, 3 items"</span>{'\n'}
                    {'});'}
                  </code></pre>
                </div>
              </div>
            </div>

            <div className="ai-tools">
              <h3 className="ai-tools-h"><L zh="AI 工具链 · 几乎全用 JS / TS" en="AI tool chain · almost entirely JS / TS" /></h3>
              <div className="ai-tools-grid">
                {AI_TOOLS.map((t, i) => (
                  <div className="ai-tool" key={i}>
                    <div className="ai-tool-name">{t.name}</div>
                    <div className="ai-tool-desc">{lang === 'zh' ? t.zhDesc : t.enDesc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="ai-reverse">
              <div className="ai-reverse-text">
                <div className="ai-reverse-tag">FEEDBACK LOOP</div>
                <h3><L zh="正反馈：JS 越多 → AI 越准 → JS 更多" en="The feedback loop" /></h3>
                <p><L
                  zh={<>训练语料里 JS 量大 → LLM 写 JS 更准 → 大家用 AI 生成更多 JS → 进入下一代训练集 → 循环。</>}
                  en={<>Big JS share in the corpus → LLM is more accurate at JS → people use AI to ship more JS → that JS lands in the next training set → loop.</>}
                /></p>
                <p><L
                  zh={<>这个循环已经在跑了 3-4 年，结果是<strong>JS 在 AI 时代的护城河越变越宽</strong>。其他语言不是不能写，而是模型对它们的把握差一截、用户被迫多审一遍代码——成本累加之下，市场自然向 JS 靠。</>}
                  en={<>The loop has been running for 3-4 years now, and the result is that <strong>JS's moat keeps widening in the AI era</strong>. Other languages aren't broken — but the model is less confident in them, the user reviews more, and the cost compounds. Market forces drift toward JS.</>}
                /></p>
                <p><L
                  zh={<>反过来想：哪天 AI 工具不再用 JS 写——大概率意味着出现了一个连模型都觉得"更好"的语言。短期内不会有。</>}
                  en={<>The flip side: the day AI tools stop being written in JS, it'll mean a new language has shown up that even the models prefer. Don't hold your breath.</>}
                /></p>
              </div>
              <div className="ai-reverse-code">
                <pre className="code"><code>
                  <span className="cl-c"><L zh="// public-code 语料估算 · 2025" en="// public-code corpus estimate · 2025" /></span>{'\n'}
                  <span className="cl-k">const</span> <span className="cl-v">corpus</span> = {'{'}{'\n'}
                  {'  '}<span className="cl-prop">javascript</span>: <span className="cl-s">"~24%"</span>,{'\n'}
                  {'  '}<span className="cl-prop">python</span>:     <span className="cl-s">"~17%"</span>,{'\n'}
                  {'  '}<span className="cl-prop">typescript</span>: <span className="cl-s">"~10%"</span>,{'\n'}
                  {'  '}<span className="cl-prop">java</span>:       <span className="cl-s">" ~9%"</span>,{'\n'}
                  {'  '}<span className="cl-prop">other</span>:      <span className="cl-s">"~40%"</span>{'\n'}
                  {'};'}{'\n\n'}
                  <span className="cl-c"><L zh="// JS + TS ≈ 34% · 远超任何单一语言" en="// JS + TS ≈ 34% · more than any single rival" /></span>{'\n'}
                  <span className="cl-c"><L zh="// 模型对 JS 的把握 = 它见过的 JS 量" en="// model fluency in JS = how much JS it has seen" /></span>
                </code></pre>
              </div>
            </div>

            <div className="ai-takeaway">
              <p><strong><L zh="一句话总结：" en="Summary, one line: " /></strong><L
                zh={<>JS 不是 AI 时代的最优语言，是<strong>最不可被替代的语言</strong>——浏览器要它、生态绑它、训练数据靠它。三十年的复利，到 AI 时代变成了壁垒。</>}
                en={<>JavaScript isn't the AI era's <em>best</em> language — it's the <strong>most irreplaceable</strong> one. Browsers depend on it, the ecosystem is anchored by it, training data is dominated by it. Thirty years of compound interest hardened into a moat.</>}
              /></p>
            </div>
          </section>

          {/* 07 vs */}
          <section className="section" id="vs">
            <header className="sec-head">
              <span className="sec-num">07</span>
              <h2 className="sec-title"><L zh="对比" en="vs TypeScript" /> <code>: JS vs TS</code></h2>
              <p className="sec-desc"><L
                zh={<>JS 和 TS 不是两门语言，是<strong>同一门语言的两种姿态</strong>。JS 的灵活成就了 web，TS 的纪律支撑起企业级。这个站点的 <a href="/code/ts">/code/ts</a> 页是同一题目的另一面。</>}
                en={<>JS and TS aren't two languages — they're <strong>two postures of the same language</strong>. JS's flexibility built the web; TS's discipline carries the enterprise. This site's <a href="/code/ts">/code/ts</a> page is the other face of the same coin.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-js">JavaScript</th>
                  <th className="th-ts">TypeScript</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="编译步骤" en="Compile step" />,            js: <L zh="无，写完即跑" en="None — just run it" />,         ts: <L zh={<><code>tsc</code> / <code>esbuild</code> / Node 22+ strip</>} en={<><code>tsc</code> / <code>esbuild</code> / Node 22+ strip</>} /> },
                  { k: <L zh="类型检查" en="Type checking" />,             js: <L zh="运行时才知道" en="Runtime only" />,             ts: <L zh="编译期 / IDE 实时" en="Compile-time / live in IDE" /> },
                  { k: <L zh="启动速度" en="Startup" />,                    js: <L zh="即开即跑" en="Instant" />,                     ts: <L zh="编译有成本" en="Compile cost" /> },
                  { k: <L zh="灵活度" en="Flexibility" />,                  js: <L zh="100%——什么都允许" en="100% — anything goes" />, ts: <L zh="有约束，强迫想清楚" en="Constrained — forces you to think" /> },
                  { k: <L zh="重构" en="Refactoring" />,                   js: <L zh="全文搜索 + 祈祷" en="Grep + prayer" />,         ts: <L zh="类型驱动，IDE 一键" en="Type-driven, one-click" /> },
                  { k: <L zh="原型期开发" en="Prototyping" />,               js: <L zh="无敌" en="Unbeatable" />,                      ts: <L zh="略卡，类型常需补全" en="A touch slower; types ask for completion" /> },
                  { k: <L zh="大项目可维护" en="Maintainability at scale" />, js: <L zh="bug 雪球累加" en="Snowballing bugs" />,         ts: <L zh="类型签名 = 契约" en="Type signatures = contracts" /> },
                  { k: <L zh="第三方库" en="3rd-party libs" />,              js: <L zh="原生支持，零负担" en="Native, zero overhead" />, ts: <L zh={<>需 <code>@types/*</code> 或库自带 d.ts</>} en={<>Need <code>@types/*</code> or built-in d.ts</>} /> },
                  { k: <L zh="LLM 写代码" en="LLM coding" />,                js: <L zh="语料量最大，命中最高" en="Biggest corpus, top accuracy" />, ts: <L zh="类型当护栏，错误更早暴露" en="Types as guardrails, errors catch faster" /> },
                  { k: <L zh="AI 工具自身用" en="AI tool stacks use" />,     js: <L zh="底层运行时" en="The runtime layer" />,           ts: <L zh="应用层逻辑" en="The application layer" /> },
                  { k: <L zh="学习曲线" en="Learning curve" />,              js: <L zh="第一节课就能写" en="Lesson one" />,             ts: <L zh="JS 之上再学一层" en="JS plus one more layer" /> },
                  { k: <L zh="哲学" en="Philosophy" />,                     js: <L zh="先跑起来" en="Get it running" />,                ts: <L zh="先想清楚" en="Think it through first" /> },
                ].map((row, i) => (
                  <tr key={i}>
                    <td>{row.k}</td>
                    <td>{row.js}</td>
                    <td>{row.ts}</td>
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
                zh={<>语言层面进化已经"小步快跑"——TC39 每年一发；运行时百花齐放——Bun / Deno / Edge；和 AI 工具的耦合越来越深。三十年的护城河还在加宽。</>}
                en={<>Language evolution is now "ship small, ship often" — TC39 yearly; runtimes are blooming — Bun / Deno / Edge; the AI-tool coupling deepens. Thirty years in, the moat keeps widening.</>}
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
                <li><a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript" target="_blank" rel="noopener">MDN · JavaScript</a></li>
                <li><a href="https://tc39.es" target="_blank" rel="noopener">TC39 · ECMAScript</a></li>
                <li><a href="https://tc39.es/ecma262/" target="_blank" rel="noopener"><L zh="ECMA-262 规范" en="ECMA-262 spec" /></a></li>
                <li><a href="https://github.com/tc39/proposals" target="_blank" rel="noopener"><L zh="TC39 提案列表" en="TC39 proposals" /></a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="运行时" en="Runtimes" /></h4>
              <ul>
                <li><a href="https://nodejs.org" target="_blank" rel="noopener">Node.js</a></li>
                <li><a href="https://bun.com" target="_blank" rel="noopener">Bun</a></li>
                <li><a href="https://deno.com" target="_blank" rel="noopener">Deno</a></li>
                <li><a href="https://workers.cloudflare.com" target="_blank" rel="noopener">Cloudflare Workers</a></li>
                <li><a href="https://vercel.com/edge" target="_blank" rel="noopener">Vercel Edge</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="生态 / 数据" en="Ecosystem / Data" /></h4>
              <ul>
                <li><a href="https://www.npmjs.com" target="_blank" rel="noopener">npm Registry</a></li>
                <li><a href="https://2024.stateofjs.com" target="_blank" rel="noopener">State of JS 2024</a></li>
                <li><a href="https://survey.stackoverflow.co" target="_blank" rel="noopener">StackOverflow Survey</a></li>
                <li><a href="https://github.blog/news-insights/octoverse/" target="_blank" rel="noopener">GitHub Octoverse</a></li>
                <li><a href="https://npmtrends.com" target="_blank" rel="noopener">npm trends</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="AI 工具链" en="AI Tooling" /></h4>
              <ul>
                <li><a href="https://github.com/anthropics/claude-code" target="_blank" rel="noopener">Claude Code</a></li>
                <li><a href="https://sdk.vercel.ai" target="_blank" rel="noopener">Vercel AI SDK</a></li>
                <li><a href="https://v0.dev" target="_blank" rel="noopener">v0</a></li>
                <li><a href="https://js.langchain.com" target="_blank" rel="noopener">LangChain.js</a></li>
                <li><a href="https://modelcontextprotocol.io" target="_blank" rel="noopener">Model Context Protocol</a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo">{JS_LOGO_SVG}</div>
              <p className="footer-line"><L zh="单页中文 / English 双语 · 资料截至 2026-05" en="Single-page guide · zh / en · last updated 2026-05" /></p>
              <p className="footer-line dim"><code>{`// "Always bet on JavaScript." — Brendan Eich`}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
