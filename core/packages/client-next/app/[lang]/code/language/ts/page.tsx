'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LangCtx, L, type Lang } from '../_intro/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './ts_intro.css';
import i18n from '@/i18n/i18n-client';

const TS_LOGO_SVG = (
  <svg viewBox="0 0 256 256">
    <rect width="256" height="256" rx="28" fill="#3178C6" />
    <path
      fill="#fff"
      d="M56 116v12h28v82h14v-82h28v-12zm120 76c-9 0-16-3-21-9l11-7c3 4 8 6 12 6s9-2 9-7c0-4-3-6-10-9-13-5-19-11-19-22 0-13 10-21 23-21 9 0 16 3 21 10l-10 7c-3-4-7-6-11-6-5 0-8 3-8 6 0 4 3 6 11 9 12 4 19 11 19 21 0 14-11 22-27 22z"
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
    year: '2010',
    zh: { title: <>内部立项</>, desc: <>Anders Hejlsberg（Turbo Pascal、Delphi、C# 之父）在微软启动一个秘密项目：给 JavaScript 加上能撑起大型应用的类型系统。代号长期保密，团队最初只有少数几人。</> },
    en: { title: <>Internal kick-off</>, desc: <>Anders Hejlsberg — father of Turbo Pascal, Delphi and C# — started a quiet project at Microsoft: give JavaScript a type system strong enough to carry large applications. The codename stayed secret for years; the original team was a handful of people.</> },
  },
  {
    year: <>2012<small>·10</small></>,
    zh: { title: <>0.8 公开发布</>, desc: <>10 月 1 日，TypeScript 在 GitHub 开源。第一个版本主打可选静态类型 + 类 + 模块。当时大多数 JS 圈对"强类型 JS"冷眼相待，只有 Java / C# 背景的工程师如获至宝。</> },
    en: { title: <>0.8 goes public</>, desc: <>October 1st: TypeScript ships on GitHub. The first release pitched optional static types, classes, and modules. Most of the JS community shrugged at "JS with types"; only the Java/C# crowd was thrilled.</> },
  },
  {
    year: <>2013<small>·06</small></>,
    zh: { title: <>0.9 — 引入泛型</>, desc: <>6 月 18 日。<code>&lt;T&gt;</code> 进入 TS。泛型补全后，TS 才真正开始能描述容器类（<code>Array&lt;T&gt;</code>、<code>Map&lt;K, V&gt;</code>）和函数库的复杂签名。</> },
    en: { title: <>0.9 — generics arrive</>, desc: <>June 18th. <code>&lt;T&gt;</code> lands in TS. Once generics existed, TS could finally describe container types (<code>Array&lt;T&gt;</code>, <code>Map&lt;K, V&gt;</code>) and the rich signatures of real libraries.</> },
  },
  {
    year: <>2014<small>·04</small></>,
    zh: { title: <>1.0 稳定版 + Angular 站队</>, desc: <>4 月 12 日 Build 大会发布 TS 1.0。同年 Google 决定把 Angular 2 用 TS 重写——这是 TS 第一次拿到顶级框架的生死背书。从此 TS 不再是"微软自己玩"。</> },
    en: { title: <>1.0 stable + Angular bet</>, desc: <>April 12th, at Microsoft Build, TS 1.0 ships. The same year Google decided to rewrite Angular 2 in TypeScript — TS's first major framework endorsement. After this it stopped being "a Microsoft thing."</> },
  },
  {
    year: <>2016<small>·09</small></>,
    zh: { title: <>2.0 — strict null checks</>, desc: <>9 月 22 日。<code>--strictNullChecks</code> 把 <code>null</code> 和 <code>undefined</code> 从所有类型里剥离出来——号称"消灭 Tony Hoare 那个十亿美元的错误"。这一刻起 TS 才真正"类型严肃"。</> },
    en: { title: <>2.0 — strict null checks</>, desc: <>September 22nd. <code>--strictNullChecks</code> removed <code>null</code> and <code>undefined</code> from all types — the team's pitch was killing Tony Hoare's "billion-dollar mistake." This is when TS started being type-serious.</> },
  },
  {
    year: '2018',
    zh: { title: <>Vue 3 用 TS 重写 + 3.0 元组扩展</>, desc: <>9 月，Evan You 宣布 Vue 3 全面 TS 重写。同年 7 月 TS 3.0 发布，引入可变元组类型，函数库的类型表达力跨过了一个台阶。React 阵营同期也在大量切 TS。</> },
    en: { title: <>Vue 3 rewritten in TS + tuples</>, desc: <>September: Evan You announces Vue 3 will be rewritten in TypeScript. That July, TS 3.0 shipped variadic tuples — a leap in expressive power for libraries. The React crowd was migrating en masse around the same time.</> },
  },
  {
    year: <>2020<small>·05</small></>,
    zh: { title: <>Deno 1.0 — TS 一等公民</>, desc: <>Node.js 之父 Ryan Dahl 推出 Deno，把 TypeScript 直接做成运行时一等公民，无需独立 <code>tsc</code> 编译步骤。同年 8 月 TS 4.0 发布。</> },
    en: { title: <>Deno 1.0 — TS as a first-class citizen</>, desc: <>Node's creator Ryan Dahl ships Deno, with TypeScript baked into the runtime — no separate <code>tsc</code> step. TS 4.0 followed in August.</> },
  },
  {
    year: <>2022<small>·11</small></>,
    zh: { title: <>4.9 — <code>satisfies</code> 操作符</>, desc: <>解决一个老问题：既要让对象字面量被某个类型约束，又不想丢掉它的精确字面量类型。<code>satisfies</code> 几乎一夜成为社区最爱用的关键字。</> },
    en: { title: <>4.9 — the <code>satisfies</code> operator</>, desc: <>Solves an old wart: how to constrain an object literal by a type without losing its precise literal inference. <code>satisfies</code> became the community's new favorite keyword almost overnight.</> },
  },
  {
    year: <>2023<small>·03</small></>,
    zh: { title: <>5.0 — 现代装饰器</>, desc: <>3 月 16 日。落地 Stage 3 的 ECMAScript 装饰器，告别用了 7 年的 <code>--experimentalDecorators</code>。这一年 TS 也已是 npm 上下载量最高的开发依赖之一。</> },
    en: { title: <>5.0 — modern decorators</>, desc: <>March 16th. Stage-3 ECMAScript decorators land, retiring 7 years of <code>--experimentalDecorators</code>. By this point, TS is already one of the highest-downloaded dev dependencies on npm.</> },
  },
  {
    year: '2024',
    zh: { title: <>State of JS：78% 开发者已采用</>, desc: <>State of JS 2024 调研：约 78% 受访者使用 TS；其中过半"主要写 TS、几乎不再写纯 JS"。这是连续 5 年增长。同年 Node.js 22+ 内置实验性 type-stripping。</> },
    en: { title: <>State of JS: 78% of devs adopted</>, desc: <>State of JS 2024: ~78% of respondents use TypeScript; over half write mostly TS, almost no plain JS. Five years of straight growth. The same year, Node.js 22+ shipped experimental type-stripping.</> },
  },
  {
    year: <>2025<small>·03</small></>, highlight: true,
    zh: { title: <>Project Corsa — Go 重写编译器</>, desc: <>Anders 亲自宣布把 <code>tsc</code> 用 <strong>Go</strong> 重写。VS Code 这 150 万行 TS 的编译时间从 78 秒降到 7.5 秒——10.4×。Native 版即未来的 <strong>TypeScript 7.0</strong>。</> },
    en: { title: <>Project Corsa — compiler rewrite in Go</>, desc: <>Anders himself announces a <strong>Go</strong> port of <code>tsc</code>. The 1.5M-line VS Code codebase type-checks in 7.5s instead of 78s — a 10.4× win. The native build will ship as <strong>TypeScript 7.0</strong>.</> },
  },
  {
    year: '2025', highlight: true,
    zh: { title: <>GitHub 第一语言</>, desc: <>GitHub Octoverse 2025：TypeScript 首次成为 GitHub 上贡献者最多的语言，<strong>超越 JavaScript 和 Python</strong>。年度新增 TS 贡献者超过 100 万，同比增长 66%。AI 时代的代码生成工具几乎一边倒选择了 TS 作为输出语言。</> },
    en: { title: <>GitHub's #1 language</>, desc: <>GitHub Octoverse 2025: TypeScript becomes GitHub's #1 language by contributors for the first time, <strong>past JavaScript and Python</strong>. Over a million new TS contributors that year, +66% YoY. Code-gen tools of the AI era almost unanimously emit TS.</> },
  },
];

interface TsCard {
  tag: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const TS_CARDS: TsCard[] = [
  {
    tag: 'A',
    zh: { title: <>类型推断</>, desc: <>赋值的形状决定类型。绝大多数变量你<strong>不用写</strong>类型。</> },
    en: { title: <>Type inference</>, desc: <>Assignment shape dictates type. For most variables you simply <strong>don't write</strong> types.</> },
    code: (
      <code>
        <span className="cl-k">const</span> <span className="cl-v">name</span> = <span className="cl-s">"Anders"</span>;{'\n'}
        <span className="cl-c">// hover ▸ const name: string</span>{'\n\n'}
        <span className="cl-k">const</span> <span className="cl-v">user</span> = {'{ '}<span className="cl-prop">name</span>: <span className="cl-s">"A"</span>, <span className="cl-prop">age</span>: <span className="cl-n">64</span>{' }'};{'\n'}
        <span className="cl-c">{'// { name: string; age: number; }'}</span>{'\n\n'}
        <span className="cl-k">const</span> <span className="cl-v">tags</span> = [<span className="cl-s">"ts"</span>, <span className="cl-s">"js"</span>] <span className="cl-k">as const</span>;{'\n'}
        <span className="cl-c">{'// readonly ["ts", "js"]'}</span>
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <>联合 + 类型守卫</>, desc: <><code>|</code> 把多种可能合在一起，<code>typeof</code> / <code>in</code> / 字段判别让分支收窄。</> },
    en: { title: <>Unions + type guards</>, desc: <><code>|</code> joins alternatives; <code>typeof</code> / <code>in</code> / discriminant fields narrow each branch.</> },
    code: (
      <code>
        <span className="cl-k">type</span> <span className="cl-type">Shape</span> ={'\n'}
        {'  | { '}<span className="cl-prop">kind</span>: <span className="cl-s">"circle"</span>; <span className="cl-prop">r</span>: <span className="cl-type">number</span>{' }'}{'\n'}
        {'  | { '}<span className="cl-prop">kind</span>: <span className="cl-s">"square"</span>; <span className="cl-prop">side</span>: <span className="cl-type">number</span>{' };'}{'\n\n'}
        <span className="cl-k">function</span> <span className="cl-fn">area</span>(<span className="cl-v">s</span>: <span className="cl-type">Shape</span>) {'{'}{'\n'}
        {'  '}<span className="cl-k">if</span> (<span className="cl-v">s</span>.<span className="cl-prop">kind</span> === <span className="cl-s">"circle"</span>){'\n'}
        {'    '}<span className="cl-k">return</span> <span className="cl-fn">Math</span>.<span className="cl-prop">PI</span> * <span className="cl-v">s</span>.<span className="cl-prop">r</span> ** <span className="cl-n">2</span>;{'\n'}
        {'  '}<span className="cl-k">return</span> <span className="cl-v">s</span>.<span className="cl-prop">side</span> ** <span className="cl-n">2</span>;{'\n'}
        {'}'}
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <>泛型</>, desc: <>函数 / 类 / 类型对类型变量的参数化。让一份代码给所有类型用。</> },
    en: { title: <>Generics</>, desc: <>Functions, classes and types parameterized over type variables. One implementation, all types.</> },
    code: (
      <code>
        <span className="cl-k">function</span> <span className="cl-fn">last</span>&lt;<span className="cl-type">T</span>&gt;(<span className="cl-v">arr</span>: <span className="cl-type">T</span>[]): <span className="cl-type">T</span> | <span className="cl-k">undefined</span> {'{'}{'\n'}
        {'  '}<span className="cl-k">return</span> <span className="cl-v">arr</span>[<span className="cl-v">arr</span>.<span className="cl-prop">length</span> - <span className="cl-n">1</span>];{'\n'}
        {'}'}{'\n\n'}
        <span className="cl-fn">last</span>([<span className="cl-n">1</span>, <span className="cl-n">2</span>, <span className="cl-n">3</span>]);     <span className="cl-c">// T = number</span>{'\n'}
        <span className="cl-fn">last</span>([<span className="cl-s">"a"</span>, <span className="cl-s">"b"</span>]);     <span className="cl-c">// T = string</span>
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <>Utility 类型</>, desc: <>内置一打"现成的类型变换"。改一处类型，一片代码自动跟随。</> },
    en: { title: <>Utility types</>, desc: <>A toolbox of built-in type transforms. Change one source type and a slew of derived types track it.</> },
    code: (
      <code>
        <span className="cl-k">type</span> <span className="cl-type">User</span> = {'{ '}<span className="cl-prop">name</span>: <span className="cl-type">string</span>; <span className="cl-prop">age</span>: <span className="cl-type">number</span>{' };'}{'\n\n'}
        <span className="cl-type">Partial</span>&lt;<span className="cl-type">User</span>&gt;        <span className="cl-c">// all optional</span>{'\n'}
        <span className="cl-type">Required</span>&lt;<span className="cl-type">User</span>&gt;       <span className="cl-c">// all required</span>{'\n'}
        <span className="cl-type">Pick</span>&lt;<span className="cl-type">User</span>, <span className="cl-s">"name"</span>&gt;   <span className="cl-c">// just name</span>{'\n'}
        <span className="cl-type">Omit</span>&lt;<span className="cl-type">User</span>, <span className="cl-s">"age"</span>&gt;    <span className="cl-c">// without age</span>{'\n'}
        <span className="cl-type">Readonly</span>&lt;<span className="cl-type">User</span>&gt;       <span className="cl-c">// all readonly</span>{'\n'}
        <span className="cl-type">Record</span>&lt;<span className="cl-type">string</span>, <span className="cl-type">User</span>&gt; <span className="cl-c">// dictionary</span>
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <>条件类型 + <code>infer</code></>, desc: <>类型层面的 if-else。<code>infer</code> 让你在条件里反取类型片段。</> },
    en: { title: <>Conditional types + <code>infer</code></>, desc: <>If-else at the type level. <code>infer</code> extracts a piece of type from a pattern match.</> },
    code: (
      <code>
        <span className="cl-k">type</span> <span className="cl-type">IsArray</span>&lt;<span className="cl-type">T</span>&gt; ={'\n'}
        {'  '}<span className="cl-type">T</span> <span className="cl-k">extends</span> <span className="cl-k">any</span>[] ? <span className="cl-k">true</span> : <span className="cl-k">false</span>;{'\n\n'}
        <span className="cl-type">IsArray</span>&lt;<span className="cl-type">number</span>[]&gt;     <span className="cl-c">// true</span>{'\n'}
        <span className="cl-type">IsArray</span>&lt;<span className="cl-type">string</span>&gt;       <span className="cl-c">// false</span>{'\n\n'}
        <span className="cl-k">type</span> <span className="cl-type">ReturnType</span>&lt;<span className="cl-type">F</span>&gt; ={'\n'}
        {'  '}<span className="cl-type">F</span> <span className="cl-k">extends</span> (...<span className="cl-v">a</span>: <span className="cl-k">any</span>) =&gt; <span className="cl-k">infer</span> <span className="cl-type">R</span> ? <span className="cl-type">R</span> : <span className="cl-k">never</span>;
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <>模板字面量类型</>, desc: <>把字符串拼接搬到类型层。可以做出"路径自动补全"那种 IDE 体验。</> },
    en: { title: <>Template literal types</>, desc: <>String interpolation, but at the type level. Powers IDE features like full-string-path autocomplete.</> },
    code: (
      <code>
        <span className="cl-k">type</span> <span className="cl-type">Greet</span>&lt;<span className="cl-type">N</span> <span className="cl-k">extends</span> <span className="cl-type">string</span>&gt; ={'\n'}
        {'  '}<span className="cl-s">{'`Hello, ${N}!`'}</span>;{'\n\n'}
        <span className="cl-k">type</span> <span className="cl-type">X</span> = <span className="cl-type">Greet</span>&lt;<span className="cl-s">"World"</span>&gt;;{'\n'}
        <span className="cl-c">{'// "Hello, World!"'}</span>{'\n\n'}
        <span className="cl-k">type</span> <span className="cl-type">Path</span> = <span className="cl-s">{'`/api/${"users" | "posts"}/:id`'}</span>;
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <>映射类型</>, desc: <>遍历一个类型的所有属性、改造它们。Utility 类型本身就是用它写出来的。</> },
    en: { title: <>Mapped types</>, desc: <>Walk every property of a type and transform it. Utility types themselves are built this way.</> },
    code: (
      <code>
        <span className="cl-k">type</span> <span className="cl-type">Stringify</span>&lt;<span className="cl-type">T</span>&gt; = {'{'}{'\n'}
        {'  '}[<span className="cl-type">K</span> <span className="cl-k">in</span> <span className="cl-k">keyof</span> <span className="cl-type">T</span>]: <span className="cl-type">string</span>{'\n'}
        {'};'}{'\n\n'}
        <span className="cl-k">type</span> <span className="cl-type">S</span> = <span className="cl-type">Stringify</span>&lt;<span className="cl-type">User</span>&gt;;{'\n'}
        <span className="cl-c">{'// { name: string; age: string; }'}</span>
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
    zh: { title: <>类型推断不啰嗦</>, desc: <>大多数变量你不用写类型，编译器从上下文自己推。你写的是 JS 的样子，拿到的是 TS 的保护——成本小、收益大。</> },
    en: { title: <>Inference, not ceremony</>, desc: <>Most variables don't need annotations; the compiler infers from context. You write code that looks like JS and get the protection of TS — small cost, big payoff.</> },
    code: <><span className="cl-k">const</span> <span className="cl-v">name</span> = <span className="cl-s">"Anders"</span>;{'\n'}<span className="cl-c">// hover: const name: string</span></>,
  },
  {
    icon: '⎇',
    zh: { title: <>IDE 智能直接拉满</>, desc: <>跳定义、找用法、改名重构、自动补全方法——这些在 JS 里靠玄学的功能，在 TS 里靠类型。VS Code 自身就是用 TS 写的，IDE 与语言同源。</> },
    en: { title: <>Editor superpowers</>, desc: <>Go-to-definition, find-references, rename refactors, method autocompletes — the things that are semi-magic in JS work concretely in TS, driven by types. VS Code itself is written in TS.</> },
    code: <><span className="cl-v">user</span>.<span className="cl-prop">|</span>{'\n'}<span className="cl-c">┌─ name : string</span>{'\n'}<span className="cl-c">├─ age  : number</span>{'\n'}<span className="cl-c">└─ email?: string</span></>,
  },
  {
    icon: '⛯',
    zh: { title: <>大型项目可维护</>, desc: <>Airbnb 在 2019 年的复盘说：<strong>38%</strong> 的线上 bug 本可被类型系统挡住。VS Code（150 万行 TS）、Slack、Asana 走的都是这条路。</> },
    en: { title: <>Sane at scale</>, desc: <>Airbnb's 2019 retrospective: <strong>38%</strong> of production bugs would have been caught by types. VS Code (1.5M lines of TS), Slack and Asana all walk this road.</> },
    code: <><span className="cl-c">{'// Change one prop, IDE'}</span>{'\n'}<span className="cl-c">{'// flags all 47 call sites'}</span></>,
  },
  {
    icon: '⚙',
    zh: { title: <>渐进迁移不破坏现状</>, desc: <>从 <code>// @ts-check</code> 注释到 <code>.ts</code> 文件再到 <code>strict</code> 模式，可以一文件一文件慢慢推进。Airbnb / Slack 走的就是这条路。</> },
    en: { title: <>Gradual migration</>, desc: <>From a <code>// @ts-check</code> comment to a <code>.ts</code> file to <code>strict</code> mode — adopt file by file, no big-bang rewrite. Airbnb and Slack went exactly this way.</> },
    code: <><span className="cl-c">// @ts-check</span>{'\n'}<span className="cl-c">{'// One line, JSDoc starts working'}</span></>,
  },
  {
    icon: '⌬',
    zh: { title: <>生态完整无死角</>, desc: <>DefinitelyTyped 仓库里有 9000+ 个 <code>@types/*</code> 包，覆盖几乎所有主流 JS 库。npm 上 85% 的 top-1000 包自带或带类型。</> },
    en: { title: <>No ecosystem holes</>, desc: <>The DefinitelyTyped repo carries 9,000+ <code>@types/*</code> packages — coverage for nearly every popular JS library. 85% of the npm top-1000 ship or have community types.</> },
    code: <>npm i -D @types/node{'\n'}<span className="cl-c">{'// Most libs need just one line'}</span></>,
  },
  {
    icon: '⌖',
    zh: { title: <>类型即文档</>, desc: <>函数签名告诉调用者要传什么、能拿什么。再多注释都不如一行 <code>(input: User) =&gt; Promise&lt;Order[]&gt;</code> 来得清楚。</> },
    en: { title: <>Types as docs</>, desc: <>A signature tells callers exactly what to pass and what they get back. Comments can never beat a line like <code>(input: User) =&gt; Promise&lt;Order[]&gt;</code>.</> },
    code: <><span className="cl-k">function</span> <span className="cl-fn">fetchOrders</span>({'\n'}{'  '}<span className="cl-v">user</span>: <span className="cl-type">User</span>{'\n'}): <span className="cl-type">Promise</span>&lt;<span className="cl-type">Order</span>[]&gt;</>,
  },
  {
    icon: '⌗',
    zh: { title: <>对 LLM 也友好</>, desc: <>2025 一项研究指出：<strong>94%</strong> 的 LLM 编译错误是 type-check 失败——TS 在 AI 失误成为线上事故前就把它挡住。Anders 自己的话："静态类型是 AI 时代的护栏。"</> },
    en: { title: <>LLM-friendly</>, desc: <>A 2025 study: <strong>94%</strong> of LLM compilation failures are type-check errors — TS catches AI mistakes before they ship. Anders himself: "Static typing is the AI era's guardrail."</> },
    code: <><span className="cl-c">{'// LLM emitted: User.naem'}</span>{'\n'}<span className="cl-c">{'// tsc errors instantly'}</span>{'\n'}<span className="cl-c">{'// agent self-corrects on feedback'}</span></>,
  },
  {
    icon: '⏚',
    zh: { title: <>编译产物干净</>, desc: <>类型在 <code>tsc</code> 输出后被擦除。运行时<strong>零额外开销</strong>，不像 Java 那样要带个虚拟机或 runtime reflection。生产环境跑的还是 JS。</> },
    en: { title: <>Clean output</>, desc: <>Types disappear after <code>tsc</code>. <strong>Zero runtime cost</strong> — no VM, no runtime reflection. Production still runs plain JavaScript.</> },
    code: <><span className="cl-c">{'// input  user.ts'}</span>{'\n'}<span className="cl-k">const</span> <span className="cl-v">x</span>: <span className="cl-type">number</span> = <span className="cl-n">42</span>;{'\n\n'}<span className="cl-c">{'// output user.js'}</span>{'\n'}<span className="cl-k">const</span> <span className="cl-v">x</span> = <span className="cl-n">42</span>;</>,
  },
  {
    icon: '⚐',
    zh: { title: <>跨端一份类型</>, desc: <>前后端共享 schema、tRPC 端到端类型推导、Next.js / Nuxt server function 直接拿到响应类型。再也不用前后端各写一份接口文档对来对去。</> },
    en: { title: <>One contract, every layer</>, desc: <>Shared schemas across backend / frontend / mobile. tRPC's end-to-end inference, Next.js / Nuxt server functions returning typed responses — no more drifting interface docs.</> },
    code: <><span className="cl-c">// shared/types.ts</span>{'\n'}<span className="cl-k">export type</span> <span className="cl-type">Order</span> = {'{ ... };'}{'\n\n'}<span className="cl-c">{'// frontend / backend / mobile'}</span>{'\n'}<span className="cl-c">{'// import the same type'}</span></>,
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
    href: 'https://code.visualstudio.com',
    zhName: 'VS Code', enName: 'VS Code',
    zhNote: '编辑器本体 1.5M 行 TS', enNote: 'Editor itself: 1.5M lines TS',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M75 5 L40 40 L20 25 L10 30 L25 50 L10 70 L20 75 L40 60 L75 95 L90 88 V12 Z" fill="#0098FF"/></svg>,
  },
  {
    href: 'https://github.com/anthropics/claude-code', highlight: true,
    zhName: 'Claude Code', enName: 'Claude Code',
    zhNote: '512K 行 TS · React+Ink+Bun', enNote: '512K lines TS · React+Ink+Bun',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#D97757"/><path d="M28 65 L42 30 H50 L36 65 Z M50 30 H58 L72 65 H64 Z M44 52 H56 L52 42 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://cursor.com', highlight: true,
    zhName: 'Cursor', enName: 'Cursor',
    zhNote: 'AI IDE · TS / Electron', enNote: 'AI IDE · TS / Electron',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M20 25 L50 10 L80 25 V75 L50 90 L20 75 Z" fill="#000" stroke="#444" strokeWidth="1"/><path d="M50 10 V90 M20 25 L80 75 M80 25 L20 75" stroke="#666" strokeWidth="2" fill="none"/></svg>,
  },
  {
    href: 'https://sdk.vercel.ai', highlight: true,
    zhName: 'Vercel AI SDK', enName: 'Vercel AI SDK',
    zhNote: '20M+ 月下载 · TS-only', enNote: '20M+ monthly · TS-only',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#000"/><path d="M25 70 L50 25 L75 70 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://angular.dev',
    zhName: 'Angular', enName: 'Angular',
    zhNote: '2014 起 TS-only', enNote: 'TS-only since 2014',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M50 5 L92 20 L85 78 L50 95 L15 78 L8 20 Z" fill="#DD0031"/><path d="M50 5 L92 20 L85 78 L50 95 V5" fill="#C3002F"/><path d="M50 22 L72 70 H64 L60 60 H40 L36 70 H28 Z M50 38 L43 53 H57 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://deno.com',
    zhName: 'Deno', enName: 'Deno',
    zhNote: '运行时一等公民', enNote: 'Runtime first-class citizen',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#fff"/><circle cx="62" cy="46" r="6" fill="#000"/><path d="M28 60 Q50 75 78 55" stroke="#000" strokeWidth="3" fill="none"/></svg>,
  },
  {
    href: 'https://nextjs.org',
    zhName: 'Next.js', enName: 'Next.js',
    zhNote: 'v11 起默认 TS', enNote: 'TS by default since v11',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#000"/><path d="M30 30 H40 L70 75 H60 Z M62 30 H70 V70 H62 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://vuejs.org',
    zhName: 'Vue 3', enName: 'Vue 3',
    zhNote: '2018 全面 TS 重写', enNote: 'Rewritten in TS in 2018',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M10 15 H30 L50 50 L70 15 H90 L50 85 Z" fill="#42B883"/><path d="M30 15 H45 L50 25 L55 15 H70 L50 50 Z" fill="#35495E"/></svg>,
  },
  {
    href: 'https://slack.com',
    zhName: 'Slack', enName: 'Slack',
    zhNote: '桌面端 TS 化', enNote: 'Desktop migrated to TS',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="38" y="8" width="14" height="40" rx="7" fill="#36C5F0"/><rect x="8" y="38" width="40" height="14" rx="7" fill="#2EB67D"/><rect x="48" y="52" width="14" height="40" rx="7" fill="#ECB22E"/><rect x="52" y="48" width="40" height="14" rx="7" fill="#E01E5A"/></svg>,
  },
  {
    href: 'https://airbnb.com',
    zhName: 'Airbnb', enName: 'Airbnb',
    zhNote: '38% bug 可被类型预防', enNote: '38% of bugs preventable by types',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M50 12 C30 12 12 50 28 75 C36 88 50 90 50 75 C50 60 38 55 38 45 C38 35 43 28 50 28 C57 28 62 35 62 45 C62 55 50 60 50 75 C50 90 64 88 72 75 C88 50 70 12 50 12 Z" fill="#FF5A5F"/></svg>,
  },
  {
    href: 'https://github.com/microsoft/TypeScript',
    zhName: 'GitHub', enName: 'GitHub',
    zhNote: '大量内部服务用 TS', enNote: 'Many internal services in TS',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#181717"/><path d="M50 18 C32 18 18 32 18 50 C18 64 27 76 40 80 V73 C32 75 30 70 30 70 C28 66 26 65 26 65 C23 63 26 63 26 63 C29 63 31 66 31 66 C34 71 39 70 41 69 C42 67 43 65 44 64 C36 63 28 60 28 47 C28 43 29 40 31 38 C31 37 30 33 32 28 C32 28 35 27 41 31 C44 30 47 30 50 30 C53 30 56 30 59 31 C65 27 68 28 68 28 C70 33 69 37 69 38 C71 40 72 43 72 47 C72 60 64 63 56 64 C58 65 59 67 59 70 V80 C72 76 82 64 82 50 C82 32 68 18 50 18 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://nestjs.com',
    zhName: 'NestJS', enName: 'NestJS',
    zhNote: '企业 Node 框架 · TS-only', enNote: 'Enterprise Node framework · TS-only',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M30 18 L70 18 L82 50 L70 82 L30 82 L18 50 Z" fill="#E0234E"/><path d="M40 40 L60 40 L65 50 L60 60 L40 60 L35 50 Z" fill="#fff"/></svg>,
  },
];

interface AiTool { name: string; zhDesc: string; enDesc: string }
const AI_TOOLS: AiTool[] = [
  { name: 'Claude Code',     zhDesc: 'Anthropic 终端 agent · TS', enDesc: 'Anthropic terminal agent · TS' },
  { name: 'Cursor',          zhDesc: 'AI 优先 IDE · TS / Electron', enDesc: 'AI-first IDE · TS / Electron' },
  { name: 'Continue',        zhDesc: 'VS Code AI 插件 · TS', enDesc: 'VS Code AI extension · TS' },
  { name: 'Aider',           zhDesc: 'CLI 编程助手 · 部分 TS', enDesc: 'CLI coding assistant · partly TS' },
  { name: 'v0',              zhDesc: 'Vercel UI 生成 · TS', enDesc: 'Vercel UI generator · TS' },
  { name: 'Bolt.new',        zhDesc: '浏览器内 AI IDE · TS', enDesc: 'In-browser AI IDE · TS' },
  { name: 'Vercel AI SDK',   zhDesc: 'AI 应用框架 · TS-only', enDesc: 'AI app framework · TS-only' },
  { name: 'LangChain.js',    zhDesc: 'LangChain TS 版', enDesc: 'LangChain, TS port' },
  { name: 'Mastra',          zhDesc: 'Agent / workflow · TS', enDesc: 'Agent / workflow · TS' },
  { name: 'Genkit',          zhDesc: 'Google AI 框架 · TS', enDesc: 'Google AI framework · TS' },
  { name: 'TypeChat',        zhDesc: '微软 · TS 类型当 prompt schema', enDesc: 'Microsoft · TS types as prompt schema' },
  { name: 'Zod',             zhDesc: '运行时 schema 校验 · TS-first', enDesc: 'Runtime schema validation · TS-first' },
  { name: '@anthropic-ai/sdk', zhDesc: 'Anthropic 官方 TS SDK', enDesc: 'Official Anthropic TS SDK' },
  { name: '@google/genai',   zhDesc: 'Gemini 官方 TS SDK', enDesc: 'Official Gemini TS SDK' },
  { name: 'openai (npm)',    zhDesc: 'OpenAI 官方 TS SDK', enDesc: 'Official OpenAI TS SDK' },
  { name: 'MCP TypeScript SDK', zhDesc: 'Model Context Protocol · TS', enDesc: 'Model Context Protocol · TS' },
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
    tag: <>HOT · 2025-03</>, hot: true, big: true,
    zh: {
      title: <>Project Corsa / TypeScript 7</>,
      body: (<>
        <p>Anders Hejlsberg 团队把整个 <code>tsc</code> 用 Go 重写。VS Code 仓库的 type-check 时间：<strong>78 秒 → 7.5 秒</strong>。靠的是 Go 原生编译 + 跨模块并行类型检查。Microsoft 称之为 <em>tsgo</em>，发布时即 TypeScript 7.0。</p>
        <p>更深的意义：JS 的开发工具链长期被"JS 自举"绑架，编译器自己用 JS 写、自己编译自己。换 Go 之后启动慢、内存高的老问题一并解决。</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">tsc (TS 5.x)</span><span className="bar-val">78s</span></div>
          <div className="bar bar-new"><span className="bar-label">tsgo (TS 7)</span><span className="bar-val">7.5s</span></div>
        </div>
      </>),
    },
    en: {
      title: <>Project Corsa / TypeScript 7</>,
      body: (<>
        <p>Anders Hejlsberg's team rewrites <code>tsc</code> in Go. The VS Code repo's type-check goes from <strong>78s → 7.5s</strong> — Go's native compilation plus cross-module parallel type-checking. Microsoft calls it <em>tsgo</em>; it ships as TypeScript 7.0.</p>
        <p>The deeper point: JS tooling has been bottlenecked by self-bootstrapping for years — the compiler written in JS, compiling itself. Switching to Go fixes the cold-start and memory issues in one stroke.</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">tsc (TS 5.x)</span><span className="bar-val">78s</span></div>
          <div className="bar bar-new"><span className="bar-label">tsgo (TS 7)</span><span className="bar-val">7.5s</span></div>
        </div>
      </>),
    },
  },
  {
    tag: 'TC39',
    zh: { title: <>Type Annotations 提案</>, body: <><p>给 JS 引擎加一条规则：把类型注解当注释忽略掉。这样浏览器和 Node 能直接吞 TS 风格代码。</p><p>现状：Stage <strong>1</strong>（共四阶段），进展缓慢，社区分歧大。短期内不会落地。</p></> },
    en: { title: <>Type Annotations proposal</>, body: <><p>Add a rule to JS engines: treat type annotations as comments. Browsers and Node could then directly run TS-flavored code.</p><p>Status: Stage <strong>1</strong> of 4. Slow, contested, unlikely to land soon.</p></> },
  },
  {
    tag: 'RUNTIME',
    zh: { title: <>运行时直接吃 TS</>, body: <><p>不等 TC39 也已经能跑：<strong>Deno</strong> 一等公民、<strong>Bun</strong> 原生支持、<strong>Node.js 22+</strong> 内置 <code>--experimental-strip-types</code>。这条路走通后 <code>tsc</code> 编译这一步可以省掉。</p></> },
    en: { title: <>Runtimes that eat TS</>, body: <><p>Even without TC39, the major runtimes already work: <strong>Deno</strong> as first-class, <strong>Bun</strong> natively, <strong>Node.js 22+</strong> with <code>--experimental-strip-types</code>. Once mainstream, the separate <code>tsc</code> step disappears.</p></> },
  },
  {
    tag: 'DATA',
    zh: { title: <>78% 开发者已采用</>, body: <><p>State of JS 2024：约 <strong>78%</strong> 的受访者使用 TypeScript；其中过半"主要写 TS、几乎不再写纯 JS"。这是连续 5 年增长。</p></> },
    en: { title: <>78% of devs adopted</>, body: <><p>State of JS 2024: ~<strong>78%</strong> of respondents use TypeScript, more than half of them writing mostly TS rather than plain JS. Five years of straight growth.</p></> },
  },
  {
    tag: 'FRAMEWORK',
    zh: { title: <>新框架默认 TS</>, body: <><p>Next.js / Nuxt / SvelteKit / SolidStart / Astro / Remix 的 <code>create</code> 模板默认就是 <code>.ts</code>。NestJS 完全 TS-only。生态层面已经几乎不存在"新项目要不要用 TS"的讨论。</p></> },
    en: { title: <>New frameworks default to TS</>, body: <><p>Next.js, Nuxt, SvelteKit, SolidStart, Astro, Remix — every <code>create</code> template defaults to <code>.ts</code>. NestJS is TS-only. The "should we use TS for new projects?" debate is over.</p></> },
  },
  {
    tag: 'AI',
    zh: { title: <>AI 时代的反向收益</>, body: <><p>过去 TS 的"类型成本"主要由人来付。AI 写代码后这个成本很大程度由 AI 承担——人类工作转向"审 / 验 / 纠"。这反而<strong>放大了类型系统的价值</strong>：它给了人类一个机器可读的护栏。</p></> },
    en: { title: <>AI era's inverse payoff</>, body: <><p>The "cost of types" used to fall on humans. With AI generating code, that cost shifts to the model — and humans move into reviewing / verifying / correcting. This <strong>amplifies the value</strong> of the type system: it gives humans a machine-readable guardrail.</p></> },
  },
];

export default function TsIntroPage() {
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  const rootRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(
    'TypeScript : JavaScript — AI 时代的事实标准',
    'TypeScript : JavaScript — De Facto Language of the AI Era'
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
        a.style.color = a.getAttribute('href') === '#' + cur ? 'var(--ts-bright)' : '';
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
      <div ref={rootRef} className="ts-intro-root">
        <div className="grid-bg" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            <svg viewBox="0 0 256 256" width="28" height="28">
              <rect width="256" height="256" rx="28" fill="#3178C6" />
              <path fill="#fff" d="M56 116v12h28v82h14v-82h28v-12zm120 76c-9 0-16-3-21-9l11-7c3 4 8 6 12 6s9-2 9-7c0-4-3-6-10-9-13-5-19-11-19-22 0-13 10-21 23-21 9 0 16 3 21 10l-10 7c-3-4-7-6-11-6-5 0-8 3-8 6 0 4 3 6 11 9 12 4 19 11 19 21 0 14-11 22-27 22z" />
            </svg>
            <span>TypeScript</span>
            <span className="nav-tag"><L zh=": 中文导览" en=": Guide" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#system"><L zh="类型" en="Types" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#projects"><L zh="谁用" en="Adopters" /></a></li>
            <li><a href="#ai"><L zh="AI 时代" en="AI Era" /></a></li>
            <li><a href="#vs"><L zh="对比" en="vs JS" /></a></li>
            <li><a href="#future"><L zh="前景" en="Outlook" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 2010 — 2026 · Microsoft · Anders Hejlsberg</div>
            <h1 className="hero-title">
              <span className="hero-name">TypeScript</span>
              <span className="hero-colon">:</span>
              <span className="hero-type">JavaScript</span>
            </h1>
            <p className="hero-sub">
              <L
                zh={<>给 JavaScript 加一层<strong>静态类型</strong>，让千行万行的应用在编译期就把错误抓住——这事曾被嘲笑为"工程师式繁文缛节"。十四年后，它成了 GitHub 上贡献者最多的语言、Claude Code / Cursor / VS Code 这一代 AI 工具的母语。</>}
                en={<>A layer of <strong>static types</strong> over JavaScript that catches errors at compile time. Once dismissed as engineering ceremony — fourteen years later it is GitHub's #1 language by contributors and the native tongue of the Claude Code / Cursor / VS Code generation of AI tools.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">#1<small></small></span>
                <span className="stat-label"><L zh={<>2025 GitHub 第一语言<br /><em>超越 JS / Python · Octoverse</em></>} en={<>GitHub's top language 2025<br /><em>past JS / Python · Octoverse</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">78<small>%</small></span>
                <span className="stat-label"><L zh={<>开发者已采用<br /><em>State of JS 2024</em></>} en={<>of devs use TS<br /><em>State of JS 2024</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">10<small>×</small></span>
                <span className="stat-label"><L zh={<>编译速度提升<br /><em>2025 Go 原生重写</em></>} en={<>compiler speed-up<br /><em>2025 Go-native rewrite</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">94<small>%</small></span>
                <span className="stat-label"><L zh={<>LLM 编译错误是类型错<br /><em>2025 学术研究</em></>} en={<>of LLM compile errors are type errors<br /><em>2025 academic study</em></>} /></span>
              </div>
            </div>
            <div className="hero-cube">
              <div className="hero-cube-face f-front">{TS_LOGO_SVG}</div>
            </div>
            <div className="hero-floats">
              <span className="float f1">: string</span>
              <span className="float f2">: number</span>
              <span className="float f3">: ReactNode</span>
              <span className="float f4">type Era</span>
              <span className="float f5">readonly</span>
              <span className="float f6">infer T</span>
              <span className="float f7">satisfies</span>
              <span className="float f8">as const</span>
              <span className="float f9">extends</span>
              <span className="float f10">keyof</span>
              <span className="float f11">{'Promise<T>'}</span>
              <span className="float f12">{'Partial<T>'}</span>
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
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>TypeScript</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>TypeScript 是 JavaScript 的<strong>超集</strong>。任何合法 JS 都是合法 TS；TS 在 JS 之上叠加了一套可选的、可被擦除的类型语法。它把类型检查从"运行时撞了墙才发现"提前到了"敲完字 IDE 就喊停"。</>}
                  en={<>TypeScript is a <strong>superset</strong> of JavaScript. Any valid JS is valid TS; TS layers on optional, erasable type syntax. It moves type errors from "found in production at 3am" to "underlined the moment you save the file."</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="超集" en="Superset" />, tag: 'superset', p: <L zh={<>所有 JS 代码无修改即合法 TS。学习成本可以渐进 —— 从一个文件到整个仓库，按节奏推进。</>} en={<>All JS is valid TS, unchanged. Adoption is gradual — file by file, repo by repo.</>} /> },
                { h: <L zh="类型擦除" en="Erasable" />, tag: 'erasable', p: <L zh={<>类型只在编译期存在。<code>tsc</code> 输出的是干净的 JS，浏览器和 Node 拿到的产物里看不到任何类型信息，运行时<strong>零开销</strong>。</>} en={<>Types only exist at compile time. <code>tsc</code> emits plain JS — browsers and Node never see them. <strong>Zero runtime overhead</strong>.</>} /> },
                { h: <L zh="结构化类型" en="Structural" />, tag: 'structural', p: <L zh={<>"长得像鸭子"就是鸭子。两个类型的形状对得上即类型相容，不靠 <code>extends</code> 继承链 —— 比 Java 的名义类型灵活得多。</>} en={<>Duck typing made formal. Two types are compatible if their shapes match — no inheritance required. Far more flexible than Java's nominal model.</>} /> },
                { h: <L zh="类型推断" en="Inference" />, tag: 'inference', p: <L zh={<>大多数时候不用手写类型。编译器从赋值、返回值、调用上下文反推。你写的是 JS 的样子，得到的是 TS 的保护。</>} en={<>You rarely write types yourself. The compiler infers from assignments, return values, call context. JS-shaped code, TS-grade safety.</>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">user.js</span><span className="lang-tag js">JavaScript</span></div>
                <pre className="code"><code>
                  <span className="cl-k">const</span> <span className="cl-v">user</span> = {'{ '}<span className="cl-prop">name</span>: <span className="cl-s">"Anders"</span>, <span className="cl-prop">age</span>: <span className="cl-n">64</span>{' };'}{'\n\n'}
                  <span className="cl-c"><L zh="// 拼写错了一个字母" en="// One typo" /></span>{'\n'}
                  <span className="cl-fn">console</span>.<span className="cl-fn">log</span>(<span className="cl-v">user</span>.<span className="cl-prop">naem</span>.<span className="cl-fn">toUpperCase</span>());{'\n\n'}
                  <span className="cl-c">{'// → undefined'}</span>{'\n'}
                  <span className="cl-c">{'// → TypeError: Cannot read properties'}</span>{'\n'}
                  <span className="cl-c">{"//   of undefined (reading 'toUpperCase')"}</span>{'\n'}
                  <span className="cl-c"><L zh="// 上线 3 小时后报警才发现" en="// Discovered 3 hours into prod" /></span>
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">user.ts</span><span className="lang-tag ts">TypeScript</span></div>
                <pre className="code"><code>
                  <span className="cl-k">const</span> <span className="cl-v">user</span> = {'{ '}<span className="cl-prop">name</span>: <span className="cl-s">"Anders"</span>, <span className="cl-prop">age</span>: <span className="cl-n">64</span>{' };'}{'\n\n'}
                  <span className="cl-c"><L zh="// 拼写错了一个字母" en="// One typo" /></span>{'\n'}
                  <span className="cl-fn">console</span>.<span className="cl-fn">log</span>(<span className="cl-v">user</span>.<span className="cl-err">naem</span>.<span className="cl-fn">toUpperCase</span>());{'\n'}
                  <span className="cl-squiggle">                ~~~~</span>{'\n\n'}
                  <span className="cl-c">{"// ✘ Property 'naem' does not exist"}</span>{'\n'}
                  <span className="cl-c">{"//   on type '{ name: string; age: number; }'."}</span>{'\n'}
                  <span className="cl-c">{"//   Did you mean 'name'?"}</span>{'\n'}
                  <span className="cl-c"><L zh="// 在你保存文件那一秒 IDE 就喊停" en="// IDE stops you the moment you save" /></span>
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
                zh={<>从微软内部一个面向 Java / C# 工程师的"给 JS 戴笼头"项目，到 14 年后吞下大半 JS 生态、再到 2025 年用 Go 把自己重写一遍。</>}
                en={<>From an internal Microsoft project pitched to Java / C# engineers, to swallowing half of the JavaScript ecosystem, to a 2025 Go rewrite of its own compiler.</>}
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

          {/* 03 Type System */}
          <section className="section" id="system">
            <header className="sec-head">
              <span className="sec-num">03</span>
              <h2 className="sec-title"><L zh="类型系统精要" en="Type System Essentials" /> <code>: TypeAlphabet</code></h2>
              <p className="sec-desc"><L
                zh={<>TS 的类型系统是图灵完备的——你可以用它写出"在编译期解 SQL 查询"或"在编译期算斐波那契"那种邪术。但日常 90% 用得到的，就是下面这七件套。</>}
                en={<>The type system is Turing-complete — you can solve SQL queries or compute Fibonacci at compile time, if you must. But 90% of day-to-day work uses the seven primitives below.</>}
              /></p>
            </header>

            <div className="ts-grid">
              {TS_CARDS.map((c, i) => (
                <div className="ts-card" key={i}>
                  <div className="ts-tag">{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="ts-code">{c.code}</pre>
                </div>
              ))}
              <div className="ts-card ts-callout">
                <div className="ts-tag ts-tag-soft">∞</div>
                <h3><L zh="类型即 DSL" en="Types as a DSL" /></h3>
                <p><L
                  zh={<>这七件套组合起来，能在 IDE 里给你"参数全自动补全 + 联合穷尽检查 + 字段重命名一波带走"的体验。</>}
                  en={<>Composed together, these seven give you full-arg autocomplete, exhaustive union checking, and one-shot field rename — right in the editor.</>}
                /></p>
                <p className="ts-callout-quote">"<em><L
                  zh={<>大型项目可维护"不是一句口号，是一行行类型签名垒出来的契约。</>}
                  en={<>Maintainable at scale" isn't a slogan — it's a contract laid down one type signature at a time.</>}
                /></em>"</p>
              </div>
            </div>
          </section>

          {/* 04 Why */}
          <section className="section" id="why">
            <header className="sec-head">
              <span className="sec-num">04</span>
              <h2 className="sec-title"><L zh="为何要用" en="Why TS" /> <code>: WhyTS</code></h2>
              <p className="sec-desc"><L
                zh={<>类型不是束缚，是工具。它让你在写代码的同时就跟未来的自己签合同。</>}
                en={<>Types aren't a cage — they're a tool. You sign a contract with your future self the moment you write the code.</>}
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
                zh={<>从 IDE 到框架，从大厂业务代码到当下风口最猛的 AI 工具——TS 是当今 JS 世界的事实标准。下面这 12 个项目，撑起了开发者每天打开的半数工具。</>}
                en={<>IDEs, frameworks, enterprise codebases, and the hottest AI tools — TS is the de-facto JS-world standard. The 12 below carry roughly half the apps a developer opens on a given day.</>}
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
              <h2 className="sec-title"><L zh="AI 时代的" en="TypeScript in the" /> <code>: <L zh="TypeScript" en="AI Era" /></code></h2>
              <p className="sec-desc"><L
                zh={<>2010 年代写 TS 经常被嘲为"为了一点类型噪音放弃了 JS 的轻盈"。AI 时代风向逆转——大模型生成代码的伙伴需要类型系统当护栏。这一章讲为什么 TypeScript 成了 AI 工具链的母语。</>}
                en={<>In the 2010s, writing TS was often mocked as trading JavaScript's nimbleness for type noise. The AI era flipped the wind — code-generating LLMs need a type system as a guardrail. This chapter is why TypeScript became the AI tool chain's native tongue.</>}
              /></p>
            </header>

            <blockquote className="quote-block">
              <div className="quote-mark">"</div>
              <p className="quote-text"><L
                zh={<>AI 模型本质上是<strong>对见过的东西做大规模复读</strong>，再加一点外推。某门语言公开代码里越多，AI 写得越好。强类型系统、可靠重构、精确语义模型，是允许 AI 输出被审核 / 验证 / 修正的<strong>护栏</strong>——而不是把 AI 写出来的东西无条件信任。静态类型在 AI 失误变成线上事故前就把它挡住了。</>}
                en={<>An AI model is fundamentally <strong>a regurgitator at scale</strong>, with a bit of extrapolation. The more public code in a language, the better AI writes it. Strong type systems, reliable refactoring, accurate semantic models — these are the <strong>guardrails</strong> that let AI output be reviewed, verified and corrected, instead of trusted blindly. Static typing catches AI mistakes before they become production problems.</>}
              /></p>
              <footer className="quote-footer">
                <span className="quote-author">— Anders Hejlsberg</span>
                <span className="quote-context"><L zh="TypeScript 首席架构师 · GitHub Blog · 2025" en="Lead Architect, TypeScript · GitHub Blog · 2025" /></span>
              </footer>
            </blockquote>

            <div className="ai-stats">
              <div className="ai-stat">
                <div className="ai-stat-num">#1</div>
                <div className="ai-stat-h"><L zh="2025 GitHub 第一语言" en="GitHub's #1 language, 2025" /></div>
                <p><L
                  zh={<>GitHub Octoverse 2025：TypeScript 首次成为 GitHub 上贡献者最多的语言，<strong>超越 JavaScript 和 Python</strong>。年新增 TS 贡献者超 100 万，YoY <strong>+66%</strong>。</>}
                  en={<>GitHub Octoverse 2025: TS becomes GitHub's #1 language by contributors for the first time, <strong>past JavaScript and Python</strong>. Over a million new TS contributors that year, <strong>+66%</strong> YoY.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">94<small>%</small></div>
                <div className="ai-stat-h"><L zh="LLM 编译错误是类型错" en="of LLM compile errors are type errors" /></div>
                <p><L
                  zh={<>2025 一项学术研究：LLM 生成代码后编译失败的，绝大多数都是 type-check 失败。也就是说——TS 是 LLM 输出的<strong>最后一道关卡</strong>。</>}
                  en={<>A 2025 academic study: when LLM-generated code fails to compile, the overwhelming majority of failures are type-check errors. Translation — TS is the <strong>last guardrail</strong> on LLM output.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">20M<small>+</small></div>
                <div className="ai-stat-h"><L zh="Vercel AI SDK 月下载" en="Vercel AI SDK monthly downloads" /></div>
                <p><L
                  zh={<>provider-agnostic 的 TS AI 工具包，统一接入 OpenAI / Anthropic / Google / xAI，月下载已超 20M。NPM 上 AI 应用层的事实标准。</>}
                  en={<>Provider-agnostic TS toolkit unifying OpenAI / Anthropic / Google / xAI behind one API. Over 20M monthly downloads — the de-facto standard at the AI application layer on npm.</>}
                /></p>
              </div>
            </div>

            <div className="spotlight">
              <div className="spotlight-tag">SPOTLIGHT</div>
              <div className="spotlight-grid">
                <div>
                  <h3>Claude Code <span className="spotlight-meta">— <L zh="Anthropic 官方 CLI" en="Anthropic's official CLI" /></span></h3>
                  <p><L
                    zh={<>住在终端里的 agentic 编码助手，用自然语言执行 git / 编辑 / 调试任务。它本身的源码 2026-03 被一位安全研究员通过未删除的 source map 还原 —— <strong>~512,000 行 TypeScript</strong>，技术栈：</>}
                    en={<>An agentic coding assistant that lives in your terminal, taking natural-language commands across git / editing / debug. Its source was reconstructed in March 2026 from a leaked source map — <strong>~512,000 lines of TypeScript</strong>. Stack:</>}
                  /></p>
                  <ul className="spotlight-list">
                    <li><strong>React + Ink</strong> — <L zh="用 React 声明式语法画终端 UI" en="React's declarative syntax, but for terminal UI" /></li>
                    <li><strong>Bun</strong> — <L zh="运行时。比 Node 启动快、原生吞 TS" en="Runtime — faster cold start than Node, eats TS natively" /></li>
                    <li><strong>main.tsx / commands.ts / tools.ts / Tool.ts / QueryEngine.ts</strong> — <L zh="模块化 agent 架构" en="Modular agent architecture" /></li>
                  </ul>
                  <p><L
                    zh={<>换句话说，<strong>这个网站的页面是 TypeScript 写的，写它的助手也是 TypeScript 写的</strong>。</>}
                    en={<>In other words: <strong>this page is written in TypeScript, and so is the assistant that wrote it</strong>.</>}
                  /></p>
                </div>
                <div className="spotlight-code">
                  <pre className="code"><code>
                    <span className="cl-c"><L zh="// Claude Code 的 Tool 定义大致长这样" en="// Claude Code's Tool definition, roughly" /></span>{'\n'}
                    <span className="cl-k">interface</span> <span className="cl-type">Tool</span>&lt;<span className="cl-type">Input</span>, <span className="cl-type">Output</span>&gt; {'{'}{'\n'}
                    {'  '}<span className="cl-prop">name</span>: <span className="cl-type">string</span>;{'\n'}
                    {'  '}<span className="cl-prop">description</span>: <span className="cl-type">string</span>;{'\n'}
                    {'  '}<span className="cl-prop">inputSchema</span>: <span className="cl-type">JsonSchema</span>&lt;<span className="cl-type">Input</span>&gt;;{'\n'}
                    {'  '}<span className="cl-fn">handler</span>: (<span className="cl-v">input</span>: <span className="cl-type">Input</span>) =&gt; <span className="cl-type">Promise</span>&lt;<span className="cl-type">Output</span>&gt;;{'\n'}
                    {'}'}{'\n\n'}
                    <span className="cl-c"><L zh="// 类型完整描述了 LLM 可调用的工具" en="// Types fully describe a tool the LLM can call" /></span>{'\n'}
                    <span className="cl-c"><L zh="// schema 给模型, handler 给运行时" en="// schema to the model, handler to the runtime" /></span>{'\n'}
                    <span className="cl-c"><L zh="// TS 让两端永远同步" en="// TS keeps both sides in sync, always" /></span>
                  </code></pre>
                </div>
              </div>
            </div>

            <div className="ai-tools">
              <h3 className="ai-tools-h"><L zh="AI 工具链 · 几乎一边倒地选了 TS" en="AI tool chain · overwhelmingly TS" /></h3>
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
                <div className="ai-reverse-tag">REVERSE</div>
                <h3><L zh="TS 类型 ↔ AI 接口" en="TS types ↔ AI interface" /></h3>
                <p><L
                  zh={<>AI 工具用 TS 写只是表层。更深一层：<strong>TS 类型本身正成为一种 AI 接口语言</strong>。</>}
                  en={<>AI tools being written in TS is only the surface. Deeper: <strong>TS types are becoming an AI interface language in their own right</strong>.</>}
                /></p>
                <p><L
                  zh={<>OpenAI / Anthropic 的"function calling"、Google 的"structured output"、MCP 协议的工具定义——背后都需要 schema 描述。把 schema 写成 TS interface，由 <code>zod</code> / <code>arktype</code> 在运行时校验、由 <code>zod-to-json-schema</code> 转给 LLM——一份类型同时给编译器、运行时、模型用。</>}
                  en={<>OpenAI / Anthropic "function calling," Google "structured output," MCP tool definitions — all need a schema. Write that schema as a TS interface, validate at runtime with <code>zod</code> / <code>arktype</code>, hand it to LLMs via <code>zod-to-json-schema</code>. One type, three consumers: compiler, runtime, model.</>}
                /></p>
                <p><L
                  zh={<>微软的 <strong>TypeChat</strong> 走得更激进：直接把 TS interface 塞进 prompt 当模板，让模型按这个形状输出，违反就让模型重写。一种"自然语言 → 类型化 JSON"的端到端管线。</>}
                  en={<>Microsoft's <strong>TypeChat</strong> goes further: drop a TS interface into the prompt as a template, force the model to output that shape, retry on violation. An end-to-end pipeline from natural language to typed JSON.</>}
                /></p>
              </div>
              <div className="ai-reverse-code">
                <pre className="code"><code>
                  <span className="cl-c"><L zh="// 1. 用 TS 描述想要的输出" en="// 1. Describe the desired output in TS" /></span>{'\n'}
                  <span className="cl-k">const</span> <span className="cl-type">Order</span> = <span className="cl-fn">z</span>.<span className="cl-fn">object</span>({'{'}{'\n'}
                  {'  '}<span className="cl-prop">customer</span>: <span className="cl-fn">z</span>.<span className="cl-fn">string</span>(),{'\n'}
                  {'  '}<span className="cl-prop">items</span>: <span className="cl-fn">z</span>.<span className="cl-fn">array</span>(<span className="cl-fn">z</span>.<span className="cl-fn">object</span>({'{'}{'\n'}
                  {'    '}<span className="cl-prop">sku</span>: <span className="cl-fn">z</span>.<span className="cl-fn">string</span>(),{'\n'}
                  {'    '}<span className="cl-prop">qty</span>: <span className="cl-fn">z</span>.<span className="cl-fn">number</span>().<span className="cl-fn">int</span>().<span className="cl-fn">positive</span>(){'\n'}
                  {'  })),'}{'\n'}
                  {'  '}<span className="cl-prop">total</span>: <span className="cl-fn">z</span>.<span className="cl-fn">number</span>(){'\n'}
                  {'});'}{'\n\n'}
                  <span className="cl-c"><L zh="// 2. 调 LLM 时把 schema 塞过去" en="// 2. Pass schema to the LLM" /></span>{'\n'}
                  <span className="cl-k">const</span> <span className="cl-v">order</span> = <span className="cl-k">await</span> <span className="cl-fn">generateObject</span>({'{'}{'\n'}
                  {'  '}<span className="cl-prop">model</span>: <span className="cl-fn">anthropic</span>(<span className="cl-s">"claude-opus-4-7"</span>),{'\n'}
                  {'  '}<span className="cl-prop">schema</span>: <span className="cl-type">Order</span>,{'\n'}
                  {'  '}<span className="cl-prop">prompt</span>: <span className="cl-s"><L zh={`"用户说: 给我两瓶可乐和一份汉堡"`} en={`"User said: two cokes and a burger, please"`} /></span>{'\n'}
                  {'});'}{'\n\n'}
                  <span className="cl-c"><L zh={`// 3. order 直接是 z.infer<typeof Order>`} en={`// 3. order is z.infer<typeof Order>`} /></span>{'\n'}
                  <span className="cl-c"><L zh="// 类型完整, 字段不对会自动重试" en="// Fully typed; auto-retry on schema violation" /></span>
                </code></pre>
              </div>
            </div>

            <div className="ai-takeaway">
              <p><strong><L zh="用一句话总结：" en="Summary, one line: " /></strong><L
                zh={<>AI 不是 TypeScript 的对手，是它有史以来最强的盟友。LLM 越普及，对"机器可读的代码契约"需求就越深；TS 在 2010 年代多写的那点类型，到 2025 年成了和 AI 协作的密钥。</>}
                en={<>AI isn't TypeScript's competitor — it's the strongest ally TS has ever had. The more pervasive LLMs become, the more the world needs machine-readable code contracts. The "extra typing" TS asked for in the 2010s turned out to be the key to working with AI in the 2020s.</>}
              /></p>
            </div>
          </section>

          {/* 07 vs */}
          <section className="section" id="vs">
            <header className="sec-head">
              <span className="sec-num">07</span>
              <h2 className="sec-title"><L zh="对比" en="vs JavaScript" /> <code>: JS vs TS</code></h2>
              <p className="sec-desc"><L
                zh={<>不是替代关系，是<strong>叠加</strong>关系。但叠加之后能做的事差出量级。</>}
                en={<>Not replacement — <strong>superposition</strong>. But the things you can do after stacking types on top differ by orders of magnitude.</>}
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
                  { k: <L zh="类型检查" en="Type checking" />,            js: <L zh="运行时才知道" en="Runtime only" />,             ts: <L zh="编译期 / IDE 实时" en="Compile-time / live in IDE" /> },
                  { k: <><code>null</code> / <code>undefined</code></>,    js: <L zh="到处可能炸" en="Bombs anywhere" />,            ts: <L zh={<><code>strict</code> 下从类型里剥离</>} en={<>Stripped from types under <code>strict</code></>} /> },
                  { k: <L zh="重构" en="Refactoring" />,                    js: <L zh="全文搜索 + 祈祷" en="Grep + prayer" />,         ts: <L zh="类型驱动，IDE 一键改名" en="Type-driven, one-click rename" /> },
                  { k: <L zh="枚举 / 联合类型" en="Enums / unions" />,      js: <L zh="字符串常量靠纪律" en="String constants on the honor system" />, ts: <><code>enum</code> / <code>'a' | 'b' | 'c'</code></> },
                  { k: <L zh="泛型" en="Generics" />,                       js: <L zh="没有" en="None" />,                            ts: <L zh={<><code>&lt;T&gt;</code>，可约束、可推断</>} en={<><code>&lt;T&gt;</code>, with constraints and inference</>} /> },
                  { k: <L zh="第三方库类型" en="3rd-party types" />,         js: <L zh="查文档 / 试出来" en="Read docs / guess" />,    ts: <L zh={<><code>@types/*</code> 或库内置 <code>.d.ts</code></>} en={<><code>@types/*</code> or built-in <code>.d.ts</code></>} /> },
                  { k: <L zh="编译产物" en="Build output" />,                js: <L zh="就是源码" en="Source itself" />,                ts: <L zh="编译后是干净的 JS，零运行时开销" en="Plain JS after compile, zero runtime cost" /> },
                  { k: <L zh="学习曲线" en="Learning curve" />,              js: <L zh="几乎为零" en="Effectively zero" />,             ts: <L zh={<>可渐进，先 <code>any</code> 再收紧</>} en={<>Gradual — start with <code>any</code>, tighten later</>} /> },
                  { k: <L zh="大型项目人月成本" en="Cost at scale" />,        js: <L zh="线性增长 + bug 滚雪球" en="Linear + snowballing bugs" />, ts: <L zh="前期略高、后期显著低" en="Slightly higher up front, far lower after" /> },
                  { k: <L zh="AI 协作" en="AI collaboration" />,             js: <L zh="LLM 生成易出错、难校验" en="Hard to verify LLM output" />, ts: <L zh="类型即护栏，LLM 错误 94% 是类型错" en="Types as guardrails; 94% of LLM errors are type errors" /> },
                  { k: <L zh="跨端契约" en="Cross-platform contracts" />,    js: <L zh="各端各写一份接口文档" en="Separate interface docs per platform" />, ts: <L zh={<>一份 <code>.d.ts</code> 共享给前后端</>} en={<>One <code>.d.ts</code> shared across platforms</>} /> },
                  { k: <L zh="IDE 体验" en="IDE experience" />,              js: <L zh="靠 JSDoc 补足，半残" en="JSDoc-patched, half-broken" />, ts: <L zh="跳转 / 补全 / 重命名，全套" en="Go-to / autocomplete / rename — the full set" /> },
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
                zh={<>编译器自身在 Go 化、运行时在原生吞 TS、TC39 在尝试把类型语法搬进 JS 标准——三条路径同时在走。</>}
                en={<>The compiler is going Go-native, runtimes are eating TS directly, and TC39 is trying to drag the syntax into the JS standard — three paths in motion at once.</>}
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
                <li><a href="https://www.typescriptlang.org" target="_blank" rel="noopener">typescriptlang.org</a></li>
                <li><a href="https://www.typescriptlang.org/play" target="_blank" rel="noopener"><L zh="在线 Playground" en="Playground" /></a></li>
                <li><a href="https://www.typescriptlang.org/docs/handbook/intro.html" target="_blank" rel="noopener"><L zh="官方 Handbook" en="Handbook" /></a></li>
                <li><a href="https://github.com/microsoft/TypeScript" target="_blank" rel="noopener">GitHub Repo</a></li>
                <li><a href="https://devblogs.microsoft.com/typescript/" target="_blank" rel="noopener"><L zh="官方博客" en="DevBlog" /></a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="关键阅读" en="Key Reading" /></h4>
              <ul>
                <li><a href="https://devblogs.microsoft.com/typescript/typescript-native-port/" target="_blank" rel="noopener">A 10× Faster TypeScript</a></li>
                <li><a href="https://github.blog/developer-skills/programming-languages-and-frameworks/typescripts-rise-in-the-ai-era-insights-from-lead-architect-anders-hejlsberg/" target="_blank" rel="noopener">Anders · TS in the AI Era</a></li>
                <li><a href="https://github.com/tc39/proposal-type-annotations" target="_blank" rel="noopener">TC39 Type Annotations</a></li>
                <li><a href="https://microsoft.github.io/TypeChat/" target="_blank" rel="noopener">Microsoft TypeChat</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="生态 / 数据" en="Ecosystem / Data" /></h4>
              <ul>
                <li><a href="https://2024.stateofjs.com" target="_blank" rel="noopener">State of JS 2024</a></li>
                <li><a href="https://github.blog/news-insights/octoverse/" target="_blank" rel="noopener">GitHub Octoverse</a></li>
                <li><a href="https://npmtrends.com/typescript" target="_blank" rel="noopener">npm trends · typescript</a></li>
                <li><a href="https://github.com/DefinitelyTyped/DefinitelyTyped" target="_blank" rel="noopener">DefinitelyTyped</a></li>
                <li><a href="https://github.com/type-challenges/type-challenges" target="_blank" rel="noopener">Type Challenges</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="AI 工具链" en="AI Tooling" /></h4>
              <ul>
                <li><a href="https://github.com/anthropics/claude-code" target="_blank" rel="noopener">Claude Code</a></li>
                <li><a href="https://sdk.vercel.ai" target="_blank" rel="noopener">Vercel AI SDK</a></li>
                <li><a href="https://github.com/vercel/ai" target="_blank" rel="noopener">vercel/ai</a></li>
                <li><a href="https://js.langchain.com" target="_blank" rel="noopener">LangChain.js</a></li>
                <li><a href="https://modelcontextprotocol.io" target="_blank" rel="noopener">Model Context Protocol</a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo">{TS_LOGO_SVG}</div>
              <p className="footer-line"><L zh="单页中文 / English 双语 · 资料截至 2026-05" en="Single-page guide · zh / en · last updated 2026-05" /></p>
              <p className="footer-line dim"><code>{`const future: Promise<Typed> = await ecosystem;`}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
