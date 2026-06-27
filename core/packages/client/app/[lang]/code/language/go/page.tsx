'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LangCtx, L, type Lang } from '../_intro/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './go_intro.css';

const GO_GOPHER_SVG = (
  <svg viewBox="0 0 256 256">
    <defs>
      <radialGradient id="go-gopher-grad" cx="50%" cy="40%">
        <stop offset="0%" stopColor="#A4DDEB" />
        <stop offset="100%" stopColor="#00ADD8" />
      </radialGradient>
    </defs>
    <ellipse cx="128" cy="148" rx="92" ry="92" fill="url(#go-gopher-grad)" />
    <ellipse cx="128" cy="60" rx="68" ry="46" fill="#A4DDEB" />
    <rect x="92" y="22" width="10" height="34" rx="5" fill="#A4DDEB" />
    <rect x="154" y="22" width="10" height="34" rx="5" fill="#A4DDEB" />
    <ellipse cx="108" cy="62" rx="14" ry="16" fill="#fff" />
    <ellipse cx="148" cy="62" rx="14" ry="16" fill="#fff" />
    <circle cx="111" cy="64" r="6" fill="#000" />
    <circle cx="151" cy="64" r="6" fill="#000" />
    <circle cx="113" cy="62" r="2" fill="#fff" />
    <circle cx="153" cy="62" r="2" fill="#fff" />
    <ellipse cx="128" cy="84" rx="6" ry="4" fill="#FDDD00" />
    <ellipse cx="128" cy="200" rx="20" ry="6" fill="rgba(0,0,0,.2)" />
  </svg>
);

const GO_NAV_LOGO_SVG = (
  <svg viewBox="0 0 256 256" width="28" height="28">
    <rect width="256" height="256" rx="28" fill="#00ADD8" />
    <path
      fill="#fff"
      d="M62 132c0-3 2-5 5-5h22c3 0 5 2 5 5v8c0 3-2 5-5 5H67c-3 0-5-2-5-5v-8zm-18 28c0-3 2-5 5-5h44c3 0 5 2 5 5v8c0 3-2 5-5 5H49c-3 0-5-2-5-5v-8zm22 28c0-3 2-5 5-5h22c3 0 5 2 5 5v8c0 3-2 5-5 5H71c-3 0-5-2-5-5v-8zm46-72c0-32 24-56 56-56s56 24 56 56-24 56-56 56-56-24-56-56zm66-12c0 3 2 5 5 5h2c3 0 5-2 5-5v-2c0-3-2-5-5-5h-2c-3 0-5 2-5 5v2zm-22 0c0 3 2 5 5 5h2c3 0 5-2 5-5v-2c0-3-2-5-5-5h-2c-3 0-5 2-5 5v2z"
    />
  </svg>
);

const GO_FOOTER_LOGO_SVG = (
  <svg viewBox="0 0 256 256" width="40" height="40">
    <rect width="256" height="256" rx="28" fill="#00ADD8" />
    <path
      fill="#fff"
      d="M62 132c0-3 2-5 5-5h22c3 0 5 2 5 5v8c0 3-2 5-5 5H67c-3 0-5-2-5-5v-8zm-18 28c0-3 2-5 5-5h44c3 0 5 2 5 5v8c0 3-2 5-5 5H49c-3 0-5-2-5-5v-8zm22 28c0-3 2-5 5-5h22c3 0 5 2 5 5v8c0 3-2 5-5 5H71c-3 0-5-2-5-5v-8zm46-72c0-32 24-56 56-56s56 24 56 56-24 56-56 56-56-24-56-56zm66-12c0 3 2 5 5 5h2c3 0 5-2 5-5v-2c0-3-2-5-5-5h-2c-3 0-5 2-5 5v2zm-22 0c0 3 2 5 5 5h2c3 0 5-2 5-5v-2c0-3-2-5-5-5h-2c-3 0-5 2-5 5v2z"
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
    year: <>2007<small>·09</small></>,
    zh: { title: <>白板对话</>, desc: <>Google 山景城。Rob Pike 等一个 C++ 程序编译完，跟 Robert Griesemer 抱怨；Ken Thompson 正好坐隔壁。三人决定动手做一门"能让你五分钟内开始写、五年后还想用"的新语言。代号 Go。</> },
    en: { title: <>Whiteboard conversation</>, desc: <>Google's Mountain View campus. Rob Pike, waiting on a slow C++ build, complained to Robert Griesemer; Ken Thompson happened to be in the office next door. The three decided to design a language "you can pick up in five minutes and still want to use in five years". Codename: Go.</> },
  },
  {
    year: '2008',
    zh: { title: <>Ken Thompson 写第一版编译器</>, desc: <>Ken（Unix / B / C 之父）开始写 Go 编译器，最初输出 C 代码再编译。年中设计基本定型，全员投入 runtime 与编译器实现。</> },
    en: { title: <>Ken Thompson writes the first compiler</>, desc: <>Ken (Unix / B / C) starts a Go compiler that initially emits C, then compiles that. By mid-year the design is largely settled and full work on the compiler and runtime begins.</> },
  },
  {
    year: <>2009<small>·11</small></>,
    zh: { title: <>11 月 10 日开源公开</>, desc: <>BSD 协议，最初支持 Linux 与 Mac OS。同时发布的还有 Renée French（Rob Pike 之妻）画的<strong>蓝色 Gopher 吉祥物</strong>，1994 年她为电台筹款 T-shirt 画的鼩鼱被改造成了 Go 的脸。</> },
    en: { title: <>Open-sourced, November 10</>, desc: <>BSD-licensed, initially Linux and macOS only. Released alongside <strong>the blue Gopher mascot</strong> drawn by Renée French (Rob Pike's wife): a 1994 rodent illustration she had originally made for a WFMU radio fundraiser T-shirt, repurposed as the face of Go.</> },
  },
  {
    year: <>2012<small>·03</small></>,
    zh: { title: <>1.0 + 兼容性承诺</>, desc: <>3 月 28 日发布 Go 1.0。同时发布"<strong>Go 1 Compatibility Promise</strong>"：1.x 版本写的代码，未来所有 1.x 都能继续编译运行。这条承诺 14 年没破，是 Go 在企业里站稳脚跟的关键信任票。</> },
    en: { title: <>1.0 + the compatibility promise</>, desc: <>March 28: Go 1.0 ships, along with the <strong>Go 1 Compatibility Promise</strong>: code written against any 1.x release will keep building and running on every future 1.x. Fourteen years on, that promise has held — a critical trust signal for enterprise adoption.</> },
  },
  {
    year: <>2013<small>·03</small></>,
    zh: { title: <>Docker 开源 — Go 第一张王牌</>, desc: <>3 月，Solomon Hykes 在 PyCon 演示 Docker。Docker 的整个 daemon、CLI、容器 runtime 全用 Go 写。<code>docker run</code> 能一秒启起一个隔离环境，Go 静态二进制 + 跨平台编译让分发变得像扔个文件那么简单。</> },
    en: { title: <>Docker — Go's first big break</>, desc: <>Solomon Hykes demos Docker at PyCon. Docker's daemon, CLI, and container runtime are all Go. <code>docker run</code> spinning up an isolated environment in a second, plus Go's static binaries and easy cross-compile, made software distribution trivial.</> },
  },
  {
    year: <>2014<small>·06</small></>,
    zh: { title: <>Kubernetes 第一个 commit</>, desc: <>Google 内部的 Borg 是 C++，但他们决定 K8s 用 Go 重写——理由：Go 简单、并发友好、社区年轻。<strong>K8s 第一个 commit 47,501 行 Go</strong>。云原生黄金十年由此开启。</> },
    en: { title: <>Kubernetes' first commit</>, desc: <>Google's internal Borg was C++, but the team chose Go for the open-source rewrite — citing simplicity, easy concurrency, and a younger community. <strong>The first K8s commit was 47,501 lines of Go</strong>. The cloud-native decade had begun.</> },
  },
  {
    year: <>2016<small>·08</small></>,
    zh: { title: <>1.7 — <code>context</code> 进入标准库</>, desc: <>8 月发布。<code>context.Context</code> 成为 Go 服务端代码的事实必备：跨 goroutine 传 deadline / cancel / 请求级 value。今天每一个 Go HTTP handler 第一个参数都是它。</> },
    en: { title: <>1.7 — <code>context</code> in the standard library</>, desc: <>Released in August. <code>context.Context</code> becomes the de-facto first parameter of every Go server-side function: deadlines, cancellation signals, and request-scoped values, propagated across goroutine boundaries.</> },
  },
  {
    year: <>2018<small>·08</small></>,
    zh: { title: <>1.11 — Go Modules</>, desc: <>告别七年的 <code>$GOPATH</code> 时代。<code>go mod init</code> + <code>go.mod</code> 文件让依赖管理终于正常起来：版本锁、最小版本选择、不再需要 vendor 拷代码。这是 Go 第二大架构改造，仅次于 1.5 自举。</> },
    en: { title: <>1.11 — Go Modules</>, desc: <>Goodbye to seven years of <code>$GOPATH</code> pain. <code>go mod init</code> + <code>go.mod</code> bring proper dependency management: version pins, minimum-version selection, no more vendoring third-party code by hand. The biggest architectural change after 1.5's self-hosting.</> },
  },
  {
    year: <>2022<small>·03</small></>,
    zh: { title: <>1.18 — 终于有泛型</>, desc: <>3 月 15 日。Go 用了 13 年才把泛型加进来。<code>func Map[T, U any](s []T, f func(T) U) []U</code> 终于能写了。之前社区一直在调侃"copy-paste programming"，现在标准库的 <code>slices</code> / <code>maps</code> 包已经是泛型实现。</> },
    en: { title: <>1.18 — generics, finally</>, desc: <>March 15. Go took 13 years to land generics. <code>func Map[T, U any](s []T, f func(T) U) []U</code> finally compiles. The community had been joking about "copy-paste programming"; today the standard <code>slices</code> and <code>maps</code> packages are written using the new generic types.</> },
  },
  {
    year: <>2024<small>·02</small></>,
    zh: { title: <>1.22 — <code>{`for i := range 10`}</code></>, desc: <>2 月发布。<code>range</code> 终于能直接遍历整数。同时把困扰 Go 用户多年的 loop variable capture 坑修了——<code>{`for i := range xs { go func() { use(i) }() }`}</code> 现在每个 goroutine 拿到的是不同的 <code>i</code>，不是被共享的同一个变量。</> },
    en: { title: <>1.22 — <code>{`for i := range 10`}</code></>, desc: <>February. <code>range</code> can now iterate over an integer. The same release fixes the long-standing loop-variable capture pitfall — <code>{`for i := range xs { go func() { use(i) }() }`}</code> now gives each goroutine its own <code>i</code>, not a shared one.</> },
  },
  {
    year: <>2024<small>·08</small></>,
    zh: { title: <>1.23 — range over function</>, desc: <>用户自定义迭代器进语言。<code>for v := range myIter</code> 可以让任意函数变成可遍历对象。这是 Go 在表达力上的一次明显加码——配合泛型，标准库 <code>iter</code> 包正在长出来。</> },
    en: { title: <>1.23 — range over function</>, desc: <>User-defined iterators land in the language. <code>for v := range myIter</code> turns any function into a rangeable. Combined with generics, the standard <code>iter</code> package is starting to grow.</> },
  },
  {
    year: <>2025<small>·03</small></>, highlight: true,
    zh: { title: <>Project Corsa — Microsoft 用 Go 重写 tsc</>, desc: <>Anders Hejlsberg（TypeScript 之父、当年 Turbo Pascal / C# 设计师）亲自宣布把整个 TypeScript 编译器用 <strong>Go</strong> 重写。VS Code 仓库 type-check 时间 <strong>78 秒 → 7.5 秒</strong>，10×。这可能是 Go 史上最大牌的背书：JS 圈的核心工具链从此跑在 Go 上。</> },
    en: { title: <>Project Corsa — Microsoft rewrites tsc in Go</>, desc: <>Anders Hejlsberg (creator of TypeScript and, before that, Turbo Pascal and C#) personally announces porting the entire TypeScript compiler to <strong>Go</strong>. Type-checking the VS Code repo drops from <strong>78 seconds to 7.5</strong> — a 10× speedup. Probably the biggest external endorsement Go has ever received: the JS world's core toolchain now runs on Go.</> },
  },
  {
    year: '2026', highlight: true,
    zh: { title: <>云原生 + AI 推理双战场</>, desc: <>Go 1.26 发布（2026-02）。Stack Overflow 2025 调研：Go 在专业开发者中渗透率 <strong>14.4%</strong>，TIOBE 排名稳定在 #7~#8。云原生战场基本由 Go 守住；本地 LLM 推理这边 <strong>ollama</strong>（用 Go 写）成了开发者跑大模型的事实标准 CLI。</> },
    en: { title: <>Cloud-native + AI infrastructure</>, desc: <>Go 1.26 ships (Feb 2026). The 2025 Stack Overflow survey puts Go at <strong>14.4%</strong> among professional developers; the TIOBE index has it stable at #7 to #8. Go owns cloud-native; in the AI era, <strong>ollama</strong> (also written in Go) becomes the default CLI for running local LLMs.</> },
  },
];

interface GoCard {
  tag: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const GO_CARDS: GoCard[] = [
  {
    tag: 'A',
    zh: { title: <>goroutine</>, desc: <><code>go</code> 一个关键字开一个协程。每个起步 2KB 栈，runtime 把上千个 multiplex 到几个 OS 线程上。</> },
    en: { title: <>Goroutines</>, desc: <>One keyword, <code>go</code>, spawns a goroutine. Each starts with a 2KB stack; the runtime multiplexes thousands of them onto a handful of OS threads.</> },
    code: (
      <code>
        <span className="cl-k">func</span> <span className="cl-fn">main</span>() {'{'}{'\n'}
        {'  '}<span className="cl-k">for</span> <span className="cl-v">i</span> := <span className="cl-k">range</span> <span className="cl-n">10000</span> {'{'}{'\n'}
        {'    '}<span className="cl-k">go</span> <span className="cl-fn">work</span>(<span className="cl-v">i</span>){'\n'}
        {'  }'}{'\n'}
        {'  '}<span className="cl-fn">time</span>.<span className="cl-fn">Sleep</span>(<span className="cl-fn">time</span>.<span className="cl-prop">Second</span>){'\n'}
        {'}'}{'\n'}
        <span className="cl-c"><L zh="// 1 万协程, 不到 50MB 内存" en="// 10k goroutines, < 50MB RAM" /></span>
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <>channel + select</>, desc: <>goroutine 之间用 <code>chan</code> 传消息——"<strong>通过通信来共享内存</strong>"，不要反过来。</> },
    en: { title: <>Channels + select</>, desc: <>Goroutines pass values via <code>chan</code> — <strong>"share memory by communicating"</strong>, not the other way around.</> },
    code: (
      <code>
        <span className="cl-v">jobs</span> := <span className="cl-fn">make</span>(<span className="cl-k">chan</span> <span className="cl-type">int</span>, <span className="cl-n">100</span>){'\n'}
        <span className="cl-v">done</span> := <span className="cl-fn">make</span>(<span className="cl-k">chan</span> <span className="cl-type">bool</span>){'\n\n'}
        <span className="cl-k">go</span> <span className="cl-k">func</span>() {'{'}{'\n'}
        {'  '}<span className="cl-k">for</span> <span className="cl-v">j</span> := <span className="cl-k">range</span> <span className="cl-v">jobs</span> {'{'}{'\n'}
        {'    '}<span className="cl-fn">process</span>(<span className="cl-v">j</span>){'\n'}
        {'  }'}{'\n'}
        {'  '}<span className="cl-v">done</span> {'<- '}<span className="cl-k">true</span>{'\n'}
        {'}()'}{'\n\n'}
        <span className="cl-k">for</span> <span className="cl-v">i</span> := <span className="cl-k">range</span> <span className="cl-n">10</span> {'{ '}<span className="cl-v">jobs</span> {'<- '}<span className="cl-v">i</span>{' }'}{'\n'}
        <span className="cl-fn">close</span>(<span className="cl-v">jobs</span>); {'<-'}<span className="cl-v">done</span>
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <>interface 隐式实现</>, desc: <>不用 <code>implements</code>。方法签名对得上就算实现了——<strong>结构化类型</strong>。</> },
    en: { title: <>Implicit interface satisfaction</>, desc: <>No <code>implements</code> keyword. If the method set matches, the type satisfies the interface — <strong>structural typing</strong>.</> },
    code: (
      <code>
        <span className="cl-k">type</span> <span className="cl-type">Reader</span> <span className="cl-k">interface</span> {'{'}{'\n'}
        {'  '}<span className="cl-fn">Read</span>(<span className="cl-v">p</span> []<span className="cl-type">byte</span>) (<span className="cl-type">int</span>, <span className="cl-type">error</span>){'\n'}
        {'}'}{'\n\n'}
        <span className="cl-c"><L zh="// File 没有 implements 关键字" en="// File never says 'implements'" /></span>{'\n'}
        <span className="cl-c"><L zh="// 但只要它有 Read 方法" en="// As long as it has a Read method," /></span>{'\n'}
        <span className="cl-c"><L zh="// 它就能当 Reader 用" en="// it can be used as a Reader" /></span>{'\n'}
        <span className="cl-k">var</span> <span className="cl-v">r</span> <span className="cl-type">Reader</span> = <span className="cl-fn">os</span>.<span className="cl-fn">Stdin</span>
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <><code>err != nil</code> 错误处理</>, desc: <>没有 try/catch。每个可能失败的函数返回 <code>(value, error)</code>，调用方<strong>必须显式处理</strong>。</> },
    en: { title: <>Error handling: <code>err != nil</code></>, desc: <>No try/catch. Functions that can fail return <code>(value, error)</code>; callers <strong>have to handle the error explicitly</strong>.</> },
    code: (
      <code>
        <span className="cl-v">data</span>, <span className="cl-v">err</span> := <span className="cl-fn">os</span>.<span className="cl-fn">ReadFile</span>(<span className="cl-s">"x.txt"</span>){'\n'}
        <span className="cl-k">if</span> <span className="cl-v">err</span> != <span className="cl-k">nil</span> {'{'}{'\n'}
        {'  '}<span className="cl-k">return</span> <span className="cl-fn">fmt</span>.<span className="cl-fn">Errorf</span>(<span className="cl-s">"read x: %w"</span>, <span className="cl-v">err</span>){'\n'}
        {'}'}{'\n'}
        <span className="cl-c"><L zh="// 啰嗦, 但出错路径永远在脸上" en="// Verbose, but failure paths are" /></span>{'\n'}
        <span className="cl-c"><L zh="// 不会被异常吞掉" en="// always visible — never swallowed" /></span>
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <>struct + 方法接收者</>, desc: <>没有类。<code>struct</code> 装数据，方法挂在<strong>接收者</strong>上。指针接收者修改原值，值接收者拷贝一份。</> },
    en: { title: <>Structs + method receivers</>, desc: <>No classes. <code>struct</code> holds data; methods attach to a <strong>receiver</strong>. Pointer receivers mutate the original; value receivers work on a copy.</> },
    code: (
      <code>
        <span className="cl-k">type</span> <span className="cl-type">Point</span> <span className="cl-k">struct</span> {'{ '}<span className="cl-prop">X</span>, <span className="cl-prop">Y</span> <span className="cl-type">float64</span>{' }'}{'\n\n'}
        <span className="cl-k">func</span> (<span className="cl-v">p</span> <span className="cl-type">Point</span>) <span className="cl-fn">Length</span>() <span className="cl-type">float64</span> {'{'}{'\n'}
        {'  '}<span className="cl-k">return</span> <span className="cl-fn">math</span>.<span className="cl-fn">Hypot</span>(<span className="cl-v">p</span>.<span className="cl-prop">X</span>, <span className="cl-v">p</span>.<span className="cl-prop">Y</span>){'\n'}
        {'}'}{'\n\n'}
        <span className="cl-k">func</span> (<span className="cl-v">p</span> *<span className="cl-type">Point</span>) <span className="cl-fn">Scale</span>(<span className="cl-v">f</span> <span className="cl-type">float64</span>) {'{'}{'\n'}
        {'  '}<span className="cl-v">p</span>.<span className="cl-prop">X</span> *= <span className="cl-v">f</span>; <span className="cl-v">p</span>.<span className="cl-prop">Y</span> *= <span className="cl-v">f</span>{'\n'}
        {'}'}
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <>泛型 (1.18+)</>, desc: <>2022 年才进语言，但社区用得很克制。最常见就是容器和工具函数——比如标准库的 <code>slices.Sort</code>。</> },
    en: { title: <>Generics (1.18+)</>, desc: <>Added in 2022. The community uses them sparingly — mostly containers and small utility functions. The standard <code>slices.Sort</code> is generic.</> },
    code: (
      <code>
        <span className="cl-k">func</span> <span className="cl-fn">Map</span>[<span className="cl-type">T</span>, <span className="cl-type">U</span> <span className="cl-k">any</span>]({'\n'}
        {'  '}<span className="cl-v">s</span> []<span className="cl-type">T</span>, <span className="cl-v">f</span> <span className="cl-k">func</span>(<span className="cl-type">T</span>) <span className="cl-type">U</span>,{'\n'}
        ) []<span className="cl-type">U</span> {'{'}{'\n'}
        {'  '}<span className="cl-v">r</span> := <span className="cl-fn">make</span>([]<span className="cl-type">U</span>, <span className="cl-fn">len</span>(<span className="cl-v">s</span>)){'\n'}
        {'  '}<span className="cl-k">for</span> <span className="cl-v">i</span>, <span className="cl-v">v</span> := <span className="cl-k">range</span> <span className="cl-v">s</span> {'{ '}<span className="cl-v">r</span>[<span className="cl-v">i</span>] = <span className="cl-v">f</span>(<span className="cl-v">v</span>){' }'}{'\n'}
        {'  '}<span className="cl-k">return</span> <span className="cl-v">r</span>{'\n'}
        {'}'}
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <>context.Context</>, desc: <>跨 goroutine 传<strong>截止时间 / 取消信号 / 请求级元数据</strong>。每个网络相关的 API 第一个参数都是它。</> },
    en: { title: <>context.Context</>, desc: <>Carries <strong>deadlines, cancellation signals, and request-scoped values</strong> across goroutines. Every networking API takes one as its first argument.</> },
    code: (
      <code>
        <span className="cl-v">ctx</span>, <span className="cl-v">cancel</span> := <span className="cl-fn">context</span>.<span className="cl-fn">WithTimeout</span>({'\n'}
        {'  '}<span className="cl-fn">r</span>.<span className="cl-fn">Context</span>(), <span className="cl-n">3</span>*<span className="cl-fn">time</span>.<span className="cl-prop">Second</span>,{'\n'}
        ){'\n'}
        <span className="cl-k">defer</span> <span className="cl-fn">cancel</span>(){'\n\n'}
        <span className="cl-v">resp</span>, <span className="cl-v">err</span> := <span className="cl-fn">http</span>.<span className="cl-fn">Get</span>(<span className="cl-v">ctx</span>, <span className="cl-v">url</span>){'\n'}
        <span className="cl-c"><L zh="// 3 秒到了 → 整条链路 cancel" en="// 3s deadline → whole call chain cancels" /></span>
      </code>
    ),
  },
  {
    tag: 'H',
    zh: { title: <>defer</>, desc: <>函数退出前执行。打开就 defer 关闭，加锁就 defer 解锁——<strong>资源释放永远在写它的地方旁边</strong>。</> },
    en: { title: <>defer</>, desc: <>Runs at function return. Open-then-defer-close, lock-then-defer-unlock — <strong>cleanup lives next to the thing that needs it</strong>.</> },
    code: (
      <code>
        <span className="cl-k">func</span> <span className="cl-fn">readFile</span>(<span className="cl-v">name</span> <span className="cl-type">string</span>) (<span className="cl-type">error</span>) {'{'}{'\n'}
        {'  '}<span className="cl-v">f</span>, <span className="cl-v">err</span> := <span className="cl-fn">os</span>.<span className="cl-fn">Open</span>(<span className="cl-v">name</span>){'\n'}
        {'  '}<span className="cl-k">if</span> <span className="cl-v">err</span> != <span className="cl-k">nil</span> {'{ '}<span className="cl-k">return</span> <span className="cl-v">err</span>{' }'}{'\n'}
        {'  '}<span className="cl-k">defer</span> <span className="cl-v">f</span>.<span className="cl-fn">Close</span>()  <span className="cl-c"><L zh="// 不管哪条 return," en="// Closes on every" /></span>{'\n'}
        {'                   '}<span className="cl-c"><L zh="// 都会被关掉" en="// return path" /></span>{'\n'}
        {'  ...'}{'\n'}
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
    icon: '⚡',
    zh: { title: <>编译秒级 + 启动毫秒</>, desc: <>整个项目编译几秒；运行时启动几毫秒。比 Java 启动快两个量级，比 Python 也快一个量级——<strong>FaaS / serverless 场景天然适合</strong>。</> },
    en: { title: <>Seconds to compile, ms to start</>, desc: <>Whole projects build in seconds; binaries start in milliseconds. Two orders of magnitude faster to start than Java, an order faster than Python — <strong>a natural fit for FaaS / serverless</strong>.</> },
    code: <><span className="cl-c"><L zh="// 单文件可执行" en="// Single executable" /></span>{'\n'}go build -o app .{'\n'}<span className="cl-c"><L zh="// → app  (10MB,扔哪儿都能跑)" en="// → app  (~10MB, runs anywhere)" /></span></>,
  },
  {
    icon: '⎇',
    zh: { title: <>goroutine 比线程便宜百倍</>, desc: <>OS 线程 1MB 栈起步，goroutine 2KB 起步。<strong>同一台机器跑 10 万并发连接</strong>对 Go 来说是日常，对 Java/Node 是性能瓶颈。</> },
    en: { title: <>Goroutines: ~100× cheaper than threads</>, desc: <>OS threads start at 1MB stacks; goroutines at 2KB. <strong>Holding 100,000 concurrent connections on one box</strong> is routine in Go and a tuning problem in Java/Node.</> },
    code: <><span className="cl-k">for</span> <span className="cl-v">i</span> := <span className="cl-k">range</span> <span className="cl-n">100000</span> {'{'}{'\n'}{'  '}<span className="cl-k">go</span> <span className="cl-fn">handle</span>(<span className="cl-v">i</span>){'\n'}{'}'}{'\n'}<span className="cl-c"><L zh="// runtime 自动调度到 8 核" en="// Runtime schedules onto 8 cores" /></span></>,
  },
  {
    icon: '⛯',
    zh: { title: <>静态二进制 + 跨平台编译</>, desc: <><code>GOOS=linux GOARCH=arm64 go build</code> 一行命令在 Mac 上交叉编译出 ARM Linux 二进制。Docker 镜像可以基于 <code>scratch</code>，最小 5MB。</> },
    en: { title: <>Static binaries + cross-compile</>, desc: <><code>GOOS=linux GOARCH=arm64 go build</code> — one line, ARM Linux binary on a Mac. Docker images can use <code>FROM scratch</code> and weigh ~5MB.</> },
    code: <>FROM scratch{'\n'}COPY app /app{'\n'}ENTRYPOINT [<span className="cl-s">"/app"</span>]{'\n'}<span className="cl-c"><L zh="// 5MB 镜像, 没有发行版" en="// 5MB image, no distro" /></span></>,
  },
  {
    icon: '⚙',
    zh: { title: <>标准库巨厚</>, desc: <>HTTP server、JSON、加密、正则、模板引擎、压缩——<strong>不装第三方库就能搭一整个 Web 服务</strong>。<code>net/http</code> 直接生产级用。</> },
    en: { title: <>Heavyweight standard library</>, desc: <>HTTP server, JSON, crypto, regex, templating, compression — <strong>you can ship a real web service without a single third-party dependency</strong>. <code>net/http</code> is production-grade out of the box.</> },
    code: <><span className="cl-fn">http</span>.<span className="cl-fn">HandleFunc</span>(<span className="cl-s">"/"</span>, <span className="cl-fn">hello</span>){'\n'}<span className="cl-fn">http</span>.<span className="cl-fn">ListenAndServe</span>(<span className="cl-s">":8080"</span>, <span className="cl-k">nil</span>){'\n'}<span className="cl-c"><L zh="// 一个 web server,2 行" en="// A web server in 2 lines" /></span></>,
  },
  {
    icon: '⌬',
    zh: { title: <>工具链开箱即用</>, desc: <><code>go fmt</code> 全社区一种格式、<code>go test</code> 内置、<code>go vet</code> 静态分析、<code>go mod</code> 包管理、pprof 性能分析——<strong>不用挑工具</strong>。</> },
    en: { title: <>Tooling included</>, desc: <><code>go fmt</code> for one canonical style, <code>go test</code> built in, <code>go vet</code> for static analysis, <code>go mod</code> for packages, <code>pprof</code> for profiling — <strong>no tooling decisions to make</strong>.</> },
    code: <>go fmt ./...    <span className="cl-c"><L zh="// 格式化" en="// formatter" /></span>{'\n'}go test ./...   <span className="cl-c"><L zh="// 单元 + benchmark" en="// unit + benchmarks" /></span>{'\n'}go tool pprof   <span className="cl-c"><L zh="// CPU / 内存火焰图" en="// CPU / heap flamegraphs" /></span></>,
  },
  {
    icon: '⌖',
    zh: { title: <>错误处理永远在脸上</>, desc: <>没有异常会突然把控制流劫走。<code>err != nil</code> 这条纪律虽啰嗦，但<strong>每条出错路径都被肉眼看过</strong>——大型 SRE 团队最爱这点。</> },
    en: { title: <>Failure paths are visible</>, desc: <>No exception will silently hijack your control flow. The <code>err != nil</code> discipline is verbose but <strong>every failure path has been read by a human</strong>. SRE-heavy teams love this.</> },
    code: <><span className="cl-k">if</span> <span className="cl-v">err</span> != <span className="cl-k">nil</span> {'{'}{'\n'}{'  '}<span className="cl-k">return</span> <span className="cl-fn">fmt</span>.<span className="cl-fn">Errorf</span>({'\n'}{'    '}<span className="cl-s">"fetch %s: %w"</span>, <span className="cl-v">url</span>, <span className="cl-v">err</span>){'\n'}{'}'}</>,
  },
  {
    icon: '⌗',
    zh: { title: <>团队 onboard 快</>, desc: <>规范 25 个关键字，没继承没重载没宏。<strong>从来没写过 Go 的工程师一周内能提生产 PR</strong>——这是 Google / Uber 大规模采用的关键。</> },
    en: { title: <>Onboards a team in days</>, desc: <>25 keywords, no inheritance, no overloading, no macros. <strong>An engineer who has never written Go can ship a production PR in a week</strong> — a key reason Google and Uber scaled adoption rapidly.</> },
    code: <><span className="cl-c"><L zh="// 整门语言一个周末看完" en="// Whole language in a weekend" /></span>{'\n'}<span className="cl-c"><L zh={'// "A Tour of Go" 4 小时'} en={'// "A Tour of Go" — 4 hours'} /></span>{'\n'}<span className="cl-c"><L zh={'// "Effective Go" 半天'} en={'// "Effective Go" — half a day'} /></span></>,
  },
  {
    icon: '⏚',
    zh: { title: <>GC 但低延迟</>, desc: <>Go 的 GC 是<strong>并发标记 + 短暂 STW</strong>，目标是把暂停时间压到 1ms 以下。延迟敏感服务（API 网关、推送、广告竞价）拿来就能用。</> },
    en: { title: <>GC, but low-latency</>, desc: <>Go's garbage collector is <strong>concurrent-mark with brief STW</strong>, targeting sub-millisecond pauses. Latency-sensitive services (gateways, push, ad bidding) ship as-is.</> },
    code: <><span className="cl-c"><L zh="// p99 GC 暂停: < 1ms" en="// p99 GC pause: < 1ms" /></span>{'\n'}<span className="cl-c"><L zh="// (相比之下 JVM 默认" en="// (default JVM G1 is" /></span>{'\n'}<span className="cl-c"><L zh="//  G1 是 100ms 量级)" en="//  in the 100ms range)" /></span></>,
  },
  {
    icon: '⌁',
    zh: { title: <>Go 1 兼容性承诺</>, desc: <>2012 年定下的：<strong>1.x 写的代码,所有未来 1.x 都还能编译运行</strong>。14 年没破。企业把它当 long-term bet 的最大原因。</> },
    en: { title: <>Go 1 compatibility promise</>, desc: <>Stated in 2012: <strong>code that builds against any 1.x will keep building on every future 1.x</strong>. Fourteen years and it has held — the biggest reason enterprises bet on Go long-term.</> },
    code: <><span className="cl-c"><L zh="// 2012 年的 Go 代码" en="// 2012 Go code" /></span>{'\n'}<span className="cl-c"><L zh="// 在 2026 年的 Go 1.26" en="// In Go 1.26 (2026)" /></span>{'\n'}<span className="cl-c"><L zh="// 不改一行,直接编译过" en="// Compiles unchanged" /></span></>,
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
    href: 'https://www.docker.com', highlight: true,
    zhName: 'Docker', enName: 'Docker',
    zhNote: '2013 · 容器化革命', enNote: '2013 · containerization',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="10" y="50" width="14" height="14" fill="#2496ED"/><rect x="26" y="50" width="14" height="14" fill="#2496ED"/><rect x="42" y="50" width="14" height="14" fill="#2496ED"/><rect x="58" y="50" width="14" height="14" fill="#2496ED"/><rect x="26" y="34" width="14" height="14" fill="#2496ED"/><rect x="42" y="34" width="14" height="14" fill="#2496ED"/><rect x="58" y="34" width="14" height="14" fill="#2496ED"/><rect x="42" y="18" width="14" height="14" fill="#2496ED"/><path d="M76 52 Q88 48 90 60 Q86 70 74 66" fill="#2496ED"/></svg>,
  },
  {
    href: 'https://kubernetes.io', highlight: true,
    zhName: 'Kubernetes', enName: 'Kubernetes',
    zhNote: '2014 · 容器编排标准', enNote: '2014 · orchestration',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><polygon points="50,10 85,30 85,70 50,90 15,70 15,30" fill="#326CE5"/><polygon points="50,25 72,38 72,62 50,75 28,62 28,38" fill="none" stroke="#fff" strokeWidth="2.5"/><circle cx="50" cy="50" r="6" fill="#fff"/><line x1="50" y1="25" x2="50" y2="44" stroke="#fff" strokeWidth="2"/><line x1="72" y1="38" x2="55" y2="48" stroke="#fff" strokeWidth="2"/><line x1="72" y1="62" x2="55" y2="52" stroke="#fff" strokeWidth="2"/><line x1="50" y1="75" x2="50" y2="56" stroke="#fff" strokeWidth="2"/><line x1="28" y1="62" x2="45" y2="52" stroke="#fff" strokeWidth="2"/><line x1="28" y1="38" x2="45" y2="48" stroke="#fff" strokeWidth="2"/></svg>,
  },
  {
    href: 'https://www.terraform.io', highlight: true,
    zhName: 'Terraform', enName: 'Terraform',
    zhNote: 'HashiCorp · IaC 标杆', enNote: 'HashiCorp · IaC standard',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><polygon points="20,30 50,12 50,40 20,58" fill="#7B42BC"/><polygon points="50,12 80,30 80,58 50,40" fill="#623CE4"/><polygon points="20,62 50,44 50,72 20,90" fill="#5C4EE5"/><polygon points="50,44 80,62 80,90 50,72" fill="#4040B2"/></svg>,
  },
  {
    href: 'https://ollama.com', highlight: true,
    zhName: 'Ollama', enName: 'Ollama',
    zhNote: '本地 LLM 推理事实标准', enNote: 'de-facto local LLM CLI',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="42" fill="#000"/><ellipse cx="50" cy="38" rx="18" ry="22" fill="#fff"/><ellipse cx="50" cy="64" rx="22" ry="18" fill="#fff"/><circle cx="42" cy="36" r="3" fill="#000"/><circle cx="58" cy="36" r="3" fill="#000"/><path d="M40 50 Q50 56 60 50" stroke="#000" strokeWidth="2" fill="none"/></svg>,
  },
  {
    href: 'https://prometheus.io',
    zhName: 'Prometheus', enName: 'Prometheus',
    zhNote: '监控告警 · CNCF 毕业', enNote: 'monitoring · CNCF graduated',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="55" r="38" fill="#E6522C"/><path d="M50 18 L62 32 L50 26 L38 32 Z" fill="#E6522C"/><rect x="32" y="62" width="36" height="6" fill="#fff"/><circle cx="50" cy="55" r="4" fill="#fff"/></svg>,
  },
  {
    href: 'https://grafana.com',
    zhName: 'Grafana', enName: 'Grafana',
    zhNote: '可视化面板 · Go 后端', enNote: 'dashboards · Go backend',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M50 12 L72 26 V58 L50 72 L28 58 V26 Z" fill="#F46800"/><circle cx="50" cy="42" r="14" fill="#FFA800"/><circle cx="50" cy="42" r="6" fill="#F46800"/></svg>,
  },
  {
    href: 'https://www.cockroachlabs.com',
    zhName: 'CockroachDB', enName: 'CockroachDB',
    zhNote: '分布式 SQL · Go 写', enNote: 'distributed SQL · Go',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="42" fill="#6933FF"/><path d="M30 60 Q50 30 70 60 M40 55 L40 75 M60 55 L60 75 M50 50 L50 80" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round"/></svg>,
  },
  {
    href: 'https://gohugo.io',
    zhName: 'Hugo', enName: 'Hugo',
    zhNote: '最快静态站点生成器', enNote: 'fastest static-site generator',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="42" fill="#FF4088"/><path d="M30 35 H40 V50 H50 V35 H60 V70 H50 V58 H40 V70 H30 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://caddyserver.com',
    zhName: 'Caddy', enName: 'Caddy',
    zhNote: '自动 HTTPS Web 服务器', enNote: 'automatic-HTTPS server',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="42" fill="#1F88C0"/><path d="M28 40 Q50 22 72 40 V64 Q50 78 28 64 Z" fill="#fff"/><circle cx="50" cy="52" r="6" fill="#1F88C0"/></svg>,
  },
  {
    href: 'https://etcd.io',
    zhName: 'etcd', enName: 'etcd',
    zhNote: 'K8s 状态存储 · Raft', enNote: 'K8s state store · Raft',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="42" fill="#419EDA"/><path d="M30 38 H70 V44 H30 Z M30 48 H70 V54 H30 Z M30 58 H70 V64 H30 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://tailscale.com',
    zhName: 'Tailscale', enName: 'Tailscale',
    zhNote: 'WireGuard mesh VPN', enNote: 'WireGuard mesh VPN',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="42" fill="#000"/><circle cx="32" cy="32" r="6" fill="#fff"/><circle cx="50" cy="32" r="6" fill="#666"/><circle cx="68" cy="32" r="6" fill="#fff"/><circle cx="32" cy="50" r="6" fill="#666"/><circle cx="50" cy="50" r="6" fill="#fff"/><circle cx="68" cy="50" r="6" fill="#666"/><circle cx="32" cy="68" r="6" fill="#fff"/><circle cx="50" cy="68" r="6" fill="#666"/><circle cx="68" cy="68" r="6" fill="#fff"/></svg>,
  },
  {
    href: 'https://github.com/microsoft/typescript-go',
    zhName: 'tsgo', enName: 'tsgo',
    zhNote: '2025 · TS 7 编译器 (Go)', enNote: '2025 · TS 7 compiler (Go)',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#3178C6"/><path fill="#fff" d="M22 45v5h11v32h6V50h11v-5zm46 30c-3 0-6-1-8-3l4-3c1 2 3 2 5 2s3-1 3-3c0-1-1-2-4-3-5-2-8-4-8-9 0-5 4-8 9-8 4 0 6 1 8 4l-4 3c-1-2-3-2-4-2-2 0-3 1-3 2 0 2 1 2 4 4 5 1 8 4 8 8 0 5-4 8-10 8z"/><path d="M76 70 L92 86 M88 86 H92 V82" stroke="#FDDD00" strokeWidth="3" fill="none"/></svg>,
  },
];

interface InfraTool { name: string; zhDesc: string; enDesc: string }
const INFRA_TOOLS: InfraTool[] = [
  { name: 'Docker',       zhDesc: '容器引擎 · 2013',       enDesc: 'container engine · 2013' },
  { name: 'Kubernetes',   zhDesc: '容器编排 · 2014',       enDesc: 'orchestration · 2014' },
  { name: 'Terraform',    zhDesc: 'HashiCorp · IaC',       enDesc: 'HashiCorp · IaC' },
  { name: 'Prometheus',   zhDesc: '监控告警 · CNCF',       enDesc: 'monitoring · CNCF' },
  { name: 'Grafana',      zhDesc: '可视化 · Go 后端',      enDesc: 'dashboards · Go backend' },
  { name: 'etcd',         zhDesc: 'K8s 状态存储',          enDesc: 'K8s state store' },
  { name: 'Containerd',   zhDesc: '容器 runtime',          enDesc: 'container runtime' },
  { name: 'Helm',         zhDesc: 'K8s 包管理',            enDesc: 'K8s package manager' },
  { name: 'Istio',        zhDesc: 'Service mesh',          enDesc: 'service mesh' },
  { name: 'Vault',        zhDesc: '密钥管理',              enDesc: 'secret management' },
  { name: 'Consul',       zhDesc: '服务发现',              enDesc: 'service discovery' },
  { name: 'Caddy',        zhDesc: '自动 HTTPS',            enDesc: 'automatic HTTPS' },
  { name: 'Hugo',         zhDesc: '静态站点生成',          enDesc: 'static site generator' },
  { name: 'CockroachDB',  zhDesc: '分布式 SQL',            enDesc: 'distributed SQL' },
  { name: 'InfluxDB',     zhDesc: '时序数据库',            enDesc: 'time-series DB' },
  { name: 'Tailscale',    zhDesc: 'mesh VPN',              enDesc: 'mesh VPN' },
  { name: 'Ollama',       zhDesc: '本地 LLM CLI',          enDesc: 'local LLM CLI' },
  { name: 'tsgo',         zhDesc: 'TS 7 编译器',           enDesc: 'TS 7 compiler' },
  { name: 'Traefik',      zhDesc: '云原生反向代理',        enDesc: 'cloud-native reverse proxy' },
  { name: 'MinIO',        zhDesc: 'S3 兼容对象存储',       enDesc: 'S3-compatible object store' },
  { name: 'NATS',         zhDesc: '分布式消息',            enDesc: 'distributed messaging' },
  { name: 'Argo CD',      zhDesc: 'GitOps 部署',           enDesc: 'GitOps deployments' },
  { name: 'Pulumi',       zhDesc: 'IaC (代码版)',          enDesc: 'IaC, code-flavored' },
  { name: 'Drone CI',     zhDesc: '容器原生 CI',           enDesc: 'container-native CI' },
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
        <p>Anders Hejlsberg 团队把整个 <code>tsc</code> 用 Go 重写。VS Code 仓库 type-check 时间：<strong>78 秒 → 7.5 秒</strong>。内存降 ~3×。靠的是 Go 原生编译 + goroutine 让<strong>跨模块并行 type-check</strong>变得直接。</p>
        <p>更深的意义：JS 生态长期被"语言自举"绑架——编译器自己用 JS 写、自己慢慢编译自己。换 Go 之后启动慢、内存高一并解决。同时这是 Go 在<strong>"系统编程而不是云原生"</strong>这层的一次硬证明：连写编译器它都行。</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">tsc (TS 5.x · JS)</span><span className="bar-val">78s</span></div>
          <div className="bar bar-new"><span className="bar-label">tsgo (TS 7 · Go)</span><span className="bar-val">7.5s</span></div>
        </div>
      </>),
    },
    en: {
      title: <>Project Corsa / TypeScript 7</>,
      body: (<>
        <p>The Anders Hejlsberg team rewrote <code>tsc</code> entirely in Go. Type-checking the VS Code codebase: <strong>78s → 7.5s</strong>; memory ~3× lower. Parallel cross-module type-checking via goroutines is what unlocks the gain.</p>
        <p>The bigger story: the JavaScript ecosystem's "language self-hosts its compiler" tradition was broken by a more systems-friendly language. The slow startup and high memory inherent to JS-hosted tooling are fixed in one move. Go has now proven itself <strong>not only as a cloud-native language but as a language for writing other languages' tooling</strong>.</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">tsc (TS 5.x · JS)</span><span className="bar-val">78s</span></div>
          <div className="bar bar-new"><span className="bar-label">tsgo (TS 7 · Go)</span><span className="bar-val">7.5s</span></div>
        </div>
      </>),
    },
  },
  {
    tag: 'SYNTAX',
    zh: { title: <>表达力慢慢补齐</>, body: <p>1.18 泛型、1.22 <code>range</code> over int + loop variable 修复、1.23 range over function。Go 团队在<strong>不破坏简洁性的前提下</strong>逐项加现代特性。<code>iter.Seq[T]</code> 标准库的迭代器接口正在长出来。</p> },
    en: { title: <>Expressiveness, gradually</>, body: <p>1.18 generics, 1.22 <code>range</code> over int + the loop-variable fix, 1.23 range over function. The Go team adds modern features <strong>only when they don't break the simplicity story</strong>. The standard <code>iter.Seq[T]</code> is starting to grow.</p> },
  },
  {
    tag: 'RUNTIME',
    zh: { title: <>GC 越压越短</>, body: <p>Go 的 GC 目标是<strong>亚毫秒级停顿</strong>。每个版本都在压 STW 时间，1.25/1.26 在并发标记和后台清理上又有改进。低延迟服务（广告竞价、推送、API 网关）对这点最敏感。</p> },
    en: { title: <>Shorter and shorter GC pauses</>, body: <p>Go aims for <strong>sub-millisecond pauses</strong>. Each release shaves more STW time; 1.25 / 1.26 improve concurrent marking and background sweeping. This matters most to latency-sensitive services like ad bidding, push notifications, and gateways.</p> },
  },
  {
    tag: 'ECOSYSTEM',
    zh: { title: <>本地 AI 推理新阵地</>, body: <p><strong>Ollama 用 Go 写</strong>，是当下跑本地大模型最流行的 CLI。Weaviate（向量数据库）、Argo Workflows、各家 LLM gateway 也都在 Go——<strong>AI 应用的"编排+服务"层正在被 Go 接管</strong>。</p> },
    en: { title: <>Local-AI inference, the new front</>, body: <p><strong>Ollama is written in Go</strong> and is now the most popular local-LLM CLI. Weaviate (vector database), Argo Workflows, multiple LLM gateways are all Go. <strong>The orchestration + serving layer of AI applications is being absorbed by Go</strong>.</p> },
  },
  {
    tag: 'DATA',
    zh: { title: <>14% 专业开发者使用</>, body: <p>Stack Overflow 2025：<strong>14.4%</strong> 的专业开发者在用 Go。TIOBE 2025 排名 <strong>#7~#8</strong>（历史最高）。Go 没有冲到 #1 的野心，目标一直是"<em>该用 Go 的场景大家都用 Go</em>"。</p> },
    en: { title: <>14% of professional developers</>, body: <p>Stack Overflow 2025: <strong>14.4%</strong>. TIOBE 2025: <strong>#7–#8</strong>, an all-time high. Go isn't competing for #1; the goal has always been "<em>where Go is the right tool, everyone reaches for Go</em>".</p> },
  },
  {
    tag: 'VERSION',
    zh: { title: <>Go 1.26 · 2026-02 发布</>, body: <p>2026 年 2 月发布。每个版本 6 个月一发，<strong>Go 1 兼容性承诺</strong>从 2012 年保到现在没破——你 14 年前写的 Go 代码在 1.26 里不改一行直接编译。这是企业 long-term bet 的最大底气。</p> },
    en: { title: <>Go 1.26 · February 2026</>, body: <p>Released in February 2026 on the usual six-month cycle. The <strong>Go 1 compatibility promise</strong> from 2012 still holds — your 14-year-old Go code compiles unchanged on 1.26. That's why long-term enterprise bets are comfortable with Go.</p> },
  },
];

export default function GoIntroPage() {
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  const rootRef = useRef<HTMLDivElement>(null);

  useDocumentTitle('Go — 简洁与并发', 'Go — Simplicity Meets Concurrency');

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
        a.style.color = a.getAttribute('href') === '#' + cur ? 'var(--go-bright)' : '';
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
      <div ref={rootRef} className="go-intro-root">
        <div className="grid-bg" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            {GO_NAV_LOGO_SVG}
            <span>Go</span>
            <span className="nav-tag"><L zh=": 简洁与并发" en=": a guided tour" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#system"><L zh="特性" en="Essentials" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#projects"><L zh="谁用" en="Who Uses" /></a></li>
            <li><a href="#cloud"><L zh="云原生" en="Cloud-Native" /></a></li>
            <li><a href="#vs"><L zh="对比" en="Compare" /></a></li>
            <li><a href="#future"><L zh="前景" en="Future" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 2007 — 2026 · Google · Griesemer + Pike + Thompson</div>
            <h1 className="hero-title">
              <span className="hero-name">Go</span>
              <span className="hero-colon">:</span>
              <span className="hero-type">goroutine</span>
            </h1>
            <p className="hero-sub">
              <L
                zh={<>2007 年 Google 三位老炮儿因为受不了 C++ 的编译时间，立项做了一门"<strong>能撑起十亿行代码、让人三天上手</strong>"的语言。15 年后，Docker、Kubernetes、Terraform 全用它写——云原生的地基就是 Go；2025 年 Microsoft 又用它把 TypeScript 编译器重写了一遍，10 倍加速。简洁、并发、跑得快——三件套同时拿全。</>}
                en={<>In 2007, three Google veterans, fed up with C++ build times, started a language designed to scale to <strong>billions of lines and onboard new engineers in days</strong>. Fifteen years later Docker, Kubernetes, and Terraform are all written in it — Go is the foundation of cloud-native. In 2025 Microsoft used it to rewrite the TypeScript compiler, getting a 10× speedup. Simple, concurrent, fast: a rare three-for-one.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">1.0</span>
                <span className="stat-label"><L zh={<>2012-03-28 发布<br /><em>Go 1 兼容性承诺</em></>} en={<>Released 2012-03-28<br /><em>Go 1 compatibility promise</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">10<small>k+</small></span>
                <span className="stat-label"><L zh={<>goroutine 同时跑<br /><em>vs OS 线程：百倍内存优势</em></>} en={<>Goroutines, easy<br /><em>vs OS threads: ~100× memory edge</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">#1</span>
                <span className="stat-label"><L zh={<>云原生底层语言<br /><em>Docker / K8s / Terraform</em></>} en={<>Cloud-native lingua franca<br /><em>Docker / K8s / Terraform</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">10<small>×</small></span>
                <span className="stat-label"><L zh={<>2025 重写 TS 编译器<br /><em>Project Corsa · tsgo</em></>} en={<>2025: rewrites the TS compiler<br /><em>Project Corsa · tsgo</em></>} /></span>
              </div>
            </div>
            <div className="hero-cube">
              {GO_GOPHER_SVG}
            </div>
            <div className="hero-floats">
              <span className="float f1">go func()</span>
              <span className="float f2">chan int</span>
              <span className="float f3">defer</span>
              <span className="float f4">interface{'{}'}</span>
              <span className="float f5">select</span>
              <span className="float f6">context.Ctx</span>
              <span className="float f7">err != nil</span>
              <span className="float f8">struct</span>
              <span className="float f9">[]byte</span>
              <span className="float f10">range</span>
              <span className="float f11">map[string]T</span>
              <span className="float f12">func()</span>
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
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>Go</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>Go 是 Google 2007 年立项的开源编译型语言。设计目标三句话讲完：<strong>编译要快、并发要简单、语法要少到记得住</strong>。它有意把"OOP 继承"、"泛型"（前 11 年）、"异常"全砍掉，只留下能让大团队多年维护的最小集合。</>}
                  en={<>Go is an open-source compiled language started inside Google in 2007. The design goals were stated in three sentences: <strong>compile fast, make concurrency easy, and keep the surface small enough to hold in your head</strong>. Inheritance, exceptions, and (for the first eleven years) generics were deliberately left out — only the minimum a large team needs to maintain code over a decade.</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="编译型" en="Compiled" />, tag: <L zh="compiled" en="native" />, p: <L zh={<>直接编译成单个静态链接的可执行文件。一个二进制，扔哪儿都能跑——不用装运行时、不用配 JVM、Docker 镜像可以小到 10MB。</>} en={<>Builds straight to a single statically-linked executable. One binary, drop it anywhere — no runtime to install, no JVM to configure, Docker images down to ~10MB.</>} /> },
                { h: <L zh="静态类型" en="Statically typed" />, tag: 'static', p: <L zh={<>编译期就把类型核完。但语法上比 Java 简洁得多——结构化类型 + 类型推断让你写 Go 像写脚本一样轻。</>} en={<>Types are checked at compile time, but the syntax is far lighter than Java. Structural interface satisfaction plus type inference make Go feel close to a scripting language.</>} /> },
                { h: <L zh="原生并发" en="Concurrent by design" />, tag: 'CSP', p: <L zh={<><code>go f()</code> 一个关键字开一个 goroutine，<code>chan</code> 在它们之间传值。CSP 模型——"通过通信来共享内存"——是 Go 的招牌。</>} en={<><code>go f()</code> spawns a goroutine; <code>chan</code> moves values between them. The CSP model — "share memory by communicating" — is Go's signature.</>} /> },
                { h: <L zh="极简语法" en="Tiny grammar" />, tag: '25 keywords', p: <L zh={<>规范全文 25 个保留字。没有继承、没有方法重载、没有函数式糖。语言越小，团队 onboard 越快——Google 内部从入职到提 PR 通常一周。</>} en={<>The full spec uses 25 reserved words. No inheritance, no method overloading, no functional sugar. The smaller the language, the faster a team can onboard — Google reports new hires shipping PRs within a week.</>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">Server.java</span><span className="lang-tag java"><L zh="Java + 线程" en="Java + threads" /></span></div>
                <pre className="code"><code>
                  <span className="cl-c"><L zh="// 一个连接 = 一个 OS 线程" en="// One connection = one OS thread" /></span>{'\n'}
                  <span className="cl-c"><L zh="// 每个线程默认 1MB 栈" en="// 1MB default stack each" /></span>{'\n'}
                  <span className="cl-c"><L zh="// 1 万连接 ≈ 10GB 内存" en="// 10k connections ≈ 10GB RAM" /></span>{'\n\n'}
                  <span className="cl-k">ExecutorService</span> <span className="cl-v">pool</span> ={'\n'}
                  {'  '}<span className="cl-fn">Executors</span>.<span className="cl-fn">newFixedThreadPool</span>(<span className="cl-n">200</span>);{'\n\n'}
                  <span className="cl-k">while</span> ((<span className="cl-v">conn</span> = <span className="cl-v">server</span>.<span className="cl-fn">accept</span>()) != <span className="cl-k">null</span>) {'{'}{'\n'}
                  {'  '}<span className="cl-v">pool</span>.<span className="cl-fn">submit</span>(() {'=>'} <span className="cl-fn">handle</span>(<span className="cl-v">conn</span>));{'\n'}
                  {'}'}{'\n\n'}
                  <span className="cl-c"><L zh="// 顶到 200 就排队" en="// Past 200, requests queue" /></span>{'\n'}
                  <span className="cl-c"><L zh="// 加机器解决" en="// Solution: more boxes" /></span>
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">server.go</span><span className="lang-tag go"><L zh="Go + goroutine" en="Go + goroutines" /></span></div>
                <pre className="code"><code>
                  <span className="cl-c"><L zh="// 一个连接 = 一个 goroutine" en="// One connection = one goroutine" /></span>{'\n'}
                  <span className="cl-c"><L zh="// 每个 goroutine 起步 2KB 栈" en="// 2KB starting stack each" /></span>{'\n'}
                  <span className="cl-c"><L zh="// 1 万连接 ≈ 20MB 内存" en="// 10k connections ≈ 20MB RAM" /></span>{'\n\n'}
                  <span className="cl-k">for</span> {'{'}{'\n'}
                  {'  '}<span className="cl-v">conn</span>, <span className="cl-v">err</span> := <span className="cl-v">ln</span>.<span className="cl-fn">Accept</span>(){'\n'}
                  {'  '}<span className="cl-k">if</span> <span className="cl-v">err</span> != <span className="cl-k">nil</span> {'{ '}<span className="cl-k">continue</span>{' }'}{'\n'}
                  {'  '}<span className="cl-k">go</span> <span className="cl-fn">handle</span>(<span className="cl-v">conn</span>){'\n'}
                  {'}'}{'\n\n'}
                  <span className="cl-c"><L zh="// 写起来像同步" en="// Reads like sync code" /></span>{'\n'}
                  <span className="cl-c"><L zh="// 跑起来是异步" en="// Runs async" /></span>{'\n'}
                  <span className="cl-c"><L zh="// runtime 自己 multiplex 到 OS 线程" en="// Runtime multiplexes onto OS threads" /></span>
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
                zh={<>从 Rob Pike 等 C++ 编译时受够了的午餐对话，到云原生时代成为基础设施层的"事实标准"，再到 2025 年被微软用来重写 TypeScript 编译器——15 年里 Go 一直在做一件事：让大型分布式后端写起来不那么痛苦。</>}
                en={<>From a hallway conversation about C++ build times, to becoming the de-facto infrastructure language of the cloud-native decade, to being chosen in 2025 to rewrite the TypeScript compiler — Go has been doing one thing for 15 years: making distributed backends less painful to build.</>}
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
              <h2 className="sec-title"><L zh="语言精要" en="Essentials" /> <code><L zh=": Go 8 件套" en=": the Go 8" /></code></h2>
              <p className="sec-desc"><L
                zh={<>Go 的设计哲学是"少即是多"。规范全文 25 个关键字，下面这 8 件套覆盖你每天写 Go 90% 的场景——从 <code>go func()</code> 起一个协程，到 <code>defer</code> 优雅关资源，到 <code>err != nil</code> 这条让初学者抓狂、老手离不开的错误处理纪律。</>}
                en={<>Go's design philosophy is "less is more". The full spec uses 25 keywords; the eight features below cover roughly 90% of what you write day-to-day — from <code>go func()</code> to spawn a goroutine, to <code>defer</code> for clean resource handling, to <code>err != nil</code>, the discipline that frustrates beginners and that veterans never want to give up.</>}
              /></p>
            </header>

            <div className="ts-grid">
              {GO_CARDS.map((c, i) => (
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
                  zh={<>没有继承、没有运算符重载、没有可选参数、没有宏。语法越小，编译器越快、IDE 越准、新人学完整门语言只要一个周末。</>}
                  en={<>No inheritance, no operator overloading, no optional arguments, no macros. The smaller the surface, the faster the compiler, the more accurate the tooling, the shorter the path from "first day" to "first PR".</>}
                /></p>
                <p className="ts-callout-quote">"<em><L
                  zh={<>Go 不是为研究语言学的人设计的，是为构建可读、可调、可维护大型系统的工程师设计的。</>}
                  en={<>Go was not designed for language-research enthusiasts. It was designed for engineers building readable, debuggable, maintainable systems at scale.</>}
                /></em>" — Rob Pike</p>
              </div>
            </div>
          </section>

          {/* 04 Why */}
          <section className="section" id="why">
            <header className="sec-head">
              <span className="sec-num">04</span>
              <h2 className="sec-title"><L zh="为何要用" en="Why use it" /> <code>: WhyGo</code></h2>
              <p className="sec-desc"><L
                zh={<>不是因为语法漂亮，是因为<strong>跑得快、写得省、部得简单</strong>。下面 9 条是 Go 在生产环境最常被点名的好处。</>}
                en={<>Not because the syntax is pretty — because <strong>it runs fast, it ships easy, and it's cheap to write</strong>. The nine points below are what production teams actually call out.</>}
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
              <h2 className="sec-title"><L zh="谁在用" en="Who uses it" /> <code>: ProductionUsers</code></h2>
              <p className="sec-desc"><L
                zh={<>下面这 12 个项目你每天都在间接用。它们撑起了从容器、编排、监控到 CDN、本地大模型的整条云原生 + 基础设施链——全用 Go 写。</>}
                en={<>You touch each of the projects below indirectly every day. Together they make up the entire cloud-native + infrastructure stack — containers, orchestration, IaC, monitoring, CDN, local LLMs — and they are written in Go.</>}
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

          {/* 06 Cloud-Native + AI */}
          <section className="section section-ai" id="cloud">
            <header className="sec-head">
              <span className="sec-num ai-num">06</span>
              <h2 className="sec-title"><L zh="云原生 + AI 基础设施" en="Cloud-native + AI infra" /> <code>: GoEra</code></h2>
              <p className="sec-desc"><L
                zh={<>2010 年代 Go 还经常被嘲为"语言设计上太保守"。结果一回头，整个云原生世界——容器、编排、IaC、监控、CDN、数据库——地基全是 Go 写的。2025 年微软又用 Go 重写了 TypeScript 编译器、ollama 又让 Go 进了本地 LLM 推理。<strong>Go 不是在编程语言排行榜上赢，是在"基础设施"这层赢</strong>。</>}
                en={<>In the early 2010s Go was sometimes dismissed as "too conservative". A decade later the entire cloud-native world — containers, orchestration, IaC, monitoring, CDN, distributed databases — runs on Go-written infrastructure. In 2025 Microsoft chose it to rewrite the TypeScript compiler; ollama brought it into local LLM inference. <strong>Go doesn't win the popularity contest; it wins the infrastructure layer underneath it</strong>.</>}
              /></p>
            </header>

            <blockquote className="quote-block">
              <div className="quote-mark">"</div>
              <p className="quote-text"><L
                zh={<>软件开发现在最缺的不是更多特性，是<strong>更少的特性、更清楚的语义、更可读的代码</strong>。Go 的目标从一开始就是：让一个十人团队、十年后回头看自己写的代码，还能看懂、还能改得动。如果一门语言主要靠它的高级特性卖给你，那它一定是冲着写它的人，不是冲着读它的人。</>}
                en={<>What software development needs today is not more features but <strong>fewer features, clearer semantics, and more readable code</strong>. Go was designed from the start so that a team of ten could come back to its own code ten years later and still be able to read it, debug it, and change it. A language that sells you mostly on its advanced features is, almost by definition, designed for the people writing it — not the people reading it.</>}
              /></p>
              <footer className="quote-footer">
                <span className="quote-author">— Rob Pike</span>
                <span className="quote-context"><L zh={'Go 共同设计者 · "Less is exponentially more" · 2012'} en={'co-designer of Go · "Less is exponentially more" · 2012'} /></span>
              </footer>
            </blockquote>

            <div className="ai-stats">
              <div className="ai-stat">
                <div className="ai-stat-num">#1</div>
                <div className="ai-stat-h"><L zh="云原生底层语言" en="Cloud-native lingua franca" /></div>
                <p><L
                  zh={<>Docker、Kubernetes、Terraform、Prometheus、etcd、Helm、Containerd、Istio、Vault、Consul、Caddy——<strong>CNCF 毕业项目里超过 70% 是 Go 写的</strong>。云原生这一层是 Go 的根据地。</>}
                  en={<>Docker, Kubernetes, Terraform, Prometheus, etcd, Helm, Containerd, Istio, Vault, Consul, Caddy — <strong>more than 70% of CNCF graduated projects are written in Go</strong>. Cloud-native is Go's home turf.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">10<small>×</small></div>
                <div className="ai-stat-h"><L zh="TS 7 编译器加速" en="TypeScript 7 speedup" /></div>
                <p><L
                  zh={<>2025-03，Anders Hejlsberg 宣布 Project Corsa：用 Go 重写整个 tsc。VS Code 1.5M 行 TS 代码 type-check 时间 <strong>78 秒 → 7.5 秒</strong>，内存降 3×。新编译器即将作为 TypeScript 7 发布。</>}
                  en={<>March 2025: Anders Hejlsberg announces Project Corsa, a full Go rewrite of <code>tsc</code>. Type-checking the 1.5M-line VS Code repo drops from <strong>78 seconds to 7.5</strong>; memory use is roughly 3× lower. The new compiler will ship as TypeScript 7.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">14<small>%</small></div>
                <div className="ai-stat-h"><L zh="专业开发者使用率" en="Professional developer adoption" /></div>
                <p><L
                  zh={<>Stack Overflow 2025 调研：14.4% 的专业开发者在用 Go。TIOBE 2025 排名稳定在 <strong>#7~#8</strong>，是 Go 历史最高位。增长曲线没有放缓。</>}
                  en={<>Stack Overflow 2025: 14.4% of professional developers report using Go. TIOBE 2025 ranks it stably in the <strong>#7–#8</strong> range — its highest historical position. The growth curve is not slowing.</>}
                /></p>
              </div>
            </div>

            <div className="spotlight">
              <div className="spotlight-tag">SPOTLIGHT · 2025</div>
              <div className="spotlight-grid">
                <div>
                  <h3>Project Corsa <span className="spotlight-meta">— <L zh="TypeScript 7 用 Go 重写" en="TypeScript 7 rewritten in Go" /></span></h3>
                  <p><L
                    zh={<>2025 年 3 月 11 日，Anders Hejlsberg 在微软 DevBlog 写下"<em>A 10× Faster TypeScript</em>"。这是 Go 拿到的最大牌背书——<strong>JavaScript 生态最重要的工具，被一门"对手语言"重写了</strong>。</>}
                    en={<>On 2025-03-11 Anders Hejlsberg published "<em>A 10× Faster TypeScript</em>" on the Microsoft DevBlog. This is arguably the biggest external endorsement Go has ever received: <strong>the most important tool in the JavaScript ecosystem was rewritten in a "rival" language</strong>.</>}
                  /></p>
                  <ul className="spotlight-list">
                    <li><strong><L zh="为何选 Go" en="Why Go, not Rust" /></strong> — <L
                      zh={<>不是 Rust。Anders 自己解释：Go 的<strong>语义模型最接近 TS 编译器原本的 JS 实现</strong>，移植代价远小于 Rust 改写</>}
                      en={<>Anders explains: Go's <strong>semantic model is closest to the original JS implementation of tsc</strong>; the port cost from Rust would have been much higher</>}
                    /></li>
                    <li><strong><L zh="性能" en="Performance" /></strong> — <L zh={<>VS Code 仓库 type-check <strong>78s → 7.5s</strong>，内存 ~3× 降低</>} en={<>VS Code repo type-check: <strong>78s → 7.5s</strong>; ~3× lower memory</>} /></li>
                    <li><strong><L zh="并发" en="Concurrency" /></strong> — <L
                      zh={<>Go 原生 goroutine 让<strong>跨模块并行检查</strong>变得直接，这是 JS 单线程版本根本做不到的</>}
                      en={<>native goroutines make <strong>parallel cross-module type-checking</strong> straightforward — something the JS-hosted version simply cannot do</>}
                    /></li>
                    <li><strong><L zh="发布" en="Release" /></strong> — <L
                      zh={<>预览期叫 <code>tsgo</code>，稳定后即 TypeScript 7 的官方 <code>tsc</code></>}
                      en={<>preview is called <code>tsgo</code>; once stable it becomes the official <code>tsc</code> in TypeScript 7</>}
                    /></li>
                  </ul>
                  <p><L
                    zh={<>这件事的深层意义：JS 自举的"语言用自己写编译器"传统，被一门更适合系统编程的语言打破——<strong>Go 不光适合写 K8s，也适合写编程语言本身</strong>。</>}
                    en={<>The deeper signal: the JS tradition of "language self-hosts its compiler" was broken by a more systems-friendly language — <strong>Go is good not just for K8s, but for writing the language tooling itself</strong>.</>}
                  /></p>
                </div>
                <div className="spotlight-code">
                  <pre className="code"><code>
                    <span className="cl-c"><L zh="// tsgo 用到的典型模式: 并行 type-check" en="// Pattern used in tsgo: parallel type-check" /></span>{'\n'}
                    <span className="cl-k">func</span> <span className="cl-fn">checkPackages</span>({'\n'}
                    {'  '}<span className="cl-v">ctx</span> <span className="cl-fn">context</span>.<span className="cl-type">Context</span>,{'\n'}
                    {'  '}<span className="cl-v">pkgs</span> []*<span className="cl-type">Package</span>,{'\n'}
                    ) <span className="cl-type">error</span> {'{'}{'\n'}
                    {'  '}<span className="cl-v">g</span>, <span className="cl-v">ctx</span> := <span className="cl-fn">errgroup</span>.<span className="cl-fn">WithContext</span>(<span className="cl-v">ctx</span>){'\n\n'}
                    {'  '}<span className="cl-k">for</span> _, <span className="cl-v">p</span> := <span className="cl-k">range</span> <span className="cl-v">pkgs</span> {'{'}{'\n'}
                    {'    '}<span className="cl-v">p</span> := <span className="cl-v">p</span>{'\n'}
                    {'    '}<span className="cl-v">g</span>.<span className="cl-fn">Go</span>(<span className="cl-k">func</span>() <span className="cl-type">error</span> {'{'}{'\n'}
                    {'      '}<span className="cl-k">return</span> <span className="cl-fn">checkPackage</span>(<span className="cl-v">ctx</span>, <span className="cl-v">p</span>){'\n'}
                    {'    })'}{'\n'}
                    {'  }'}{'\n'}
                    {'  '}<span className="cl-k">return</span> <span className="cl-v">g</span>.<span className="cl-fn">Wait</span>(){'\n'}
                    {'}'}{'\n\n'}
                    <span className="cl-c"><L zh="// 8 核机器: 8 个 package 真并行" en="// On an 8-core box: 8 packages, real parallel." /></span>{'\n'}
                    <span className="cl-c"><L zh="// 这是 JS 版的 tsc 永远做不到的" en="// JS-hosted tsc could never do this." /></span>
                  </code></pre>
                </div>
              </div>
            </div>

            <div className="ai-tools">
              <h3 className="ai-tools-h"><L zh="云原生 / 基础设施 · 几乎一边倒地选了 Go" en="Cloud-native and infra · almost universally Go" /></h3>
              <div className="ai-tools-grid">
                {INFRA_TOOLS.map((t, i) => (
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
                <h3><L zh="本地 LLM 时代的 Go" en="Local LLMs run on Go" /></h3>
                <p><L
                  zh={<>大模型训练这块是 Python/CUDA 的天下。但<strong>把模型跑在你电脑上、跑在生产服务器上、跑在边缘设备上</strong>——这是 Go 的舞台。</>}
                  en={<>Model training is a Python/CUDA story. But <strong>running models on your laptop, on your servers, at the edge</strong> — that's Go's stage.</>}
                /></p>
                <p><L
                  zh={<><strong>ollama</strong> 是事实标准：用 Go 写的 daemon，封装 llama.cpp，提供 OpenAI 兼容 HTTP API。<code>ollama run llama3</code> 一行命令把 LLM 跑起来——单二进制、跨平台、自动下载模型。GitHub 已超过 10 万星。</>}
                  en={<><strong>Ollama</strong> is the de-facto standard: a Go daemon wrapping llama.cpp, exposing an OpenAI-compatible HTTP API. <code>ollama run llama3</code> brings up a local LLM in one command — single binary, cross-platform, model downloads handled. Already over 100k stars on GitHub.</>}
                /></p>
                <p><L
                  zh={<>更深层：AI 应用的<strong>编排层</strong>（agent 框架、向量数据库、RAG 管道、模型 gateway）需要的是高并发 + 低延迟 + 易部署——Go 的传统优势。Weaviate、Milvus 部分组件、Qdrant 配套工具都是 Go。</>}
                  en={<>Going deeper: AI's <strong>orchestration layer</strong> (agent frameworks, vector databases, RAG pipelines, model gateways) needs high concurrency, low latency, easy deployment — Go's traditional strengths. Weaviate, parts of Milvus, Qdrant tooling: all Go.</>}
                /></p>
              </div>
              <div className="ai-reverse-code">
                <pre className="code"><code>
                  <span className="cl-c"><L zh="// ollama 提供的 OpenAI 兼容 API" en="// Ollama exposes an OpenAI-compatible API." /></span>{'\n'}
                  <span className="cl-c"><L zh="// 客户端代码长这样:" en="// A Go client looks like this:" /></span>{'\n\n'}
                  <span className="cl-v">client</span> := <span className="cl-fn">api</span>.<span className="cl-fn">NewClient</span>({'\n'}
                  {'  '}<span className="cl-v">url</span>, <span className="cl-fn">http</span>.<span className="cl-prop">DefaultClient</span>,{'\n'}
                  ){'\n\n'}
                  <span className="cl-v">req</span> := &amp;<span className="cl-fn">api</span>.<span className="cl-type">ChatRequest</span>{'{'}{'\n'}
                  {'  '}<span className="cl-prop">Model</span>: <span className="cl-s">"llama3"</span>,{'\n'}
                  {'  '}<span className="cl-prop">Messages</span>: []<span className="cl-fn">api</span>.<span className="cl-type">Message</span>{'{{'}{'\n'}
                  {'    '}<span className="cl-prop">Role</span>: <span className="cl-s">"user"</span>,{'\n'}
                  {'    '}<span className="cl-prop">Content</span>: <span className="cl-s"><L zh={`"为什么 Go 适合云原生?"`} en={`"Why is Go great for cloud-native?"`} /></span>,{'\n'}
                  {'  }},'}{'\n'}
                  {'}'}{'\n\n'}
                  <span className="cl-v">err</span> := <span className="cl-v">client</span>.<span className="cl-fn">Chat</span>(<span className="cl-v">ctx</span>, <span className="cl-v">req</span>,{'\n'}
                  {'  '}<span className="cl-k">func</span>(<span className="cl-v">r</span> <span className="cl-fn">api</span>.<span className="cl-type">ChatResponse</span>) <span className="cl-type">error</span> {'{'}{'\n'}
                  {'    '}<span className="cl-fn">fmt</span>.<span className="cl-fn">Print</span>(<span className="cl-v">r</span>.<span className="cl-prop">Message</span>.<span className="cl-prop">Content</span>){'\n'}
                  {'    '}<span className="cl-k">return</span> <span className="cl-k">nil</span>{'\n'}
                  {'  })'}{'\n\n'}
                  <span className="cl-c"><L zh="// 整个 ollama 服务也是 Go 写的" en="// The Ollama server itself is also Go." /></span>{'\n'}
                  <span className="cl-c"><L zh="// 单二进制 ~ 200MB,自带模型管理" en="// One ~200MB binary, model lifecycle included." /></span>
                </code></pre>
              </div>
            </div>

            <div className="ai-takeaway">
              <p><strong><L zh="用一句话总结：" en="Bottom line: " /></strong><L
                zh={<>Go 不是站在编程语言的舞台中央，是站在<strong>它下面那一层</strong>。你部署的每个容器、调度的每个 Pod、监控告警走的每条链路、本地跑的每个大模型——大概率背后都有一段 Go 在转。低调，但不可或缺。</>}
                en={<>Go isn't standing in the spotlight on the language stage; it's standing on <strong>the layer just below it</strong>. Every container you deploy, every Pod scheduled, every hop on the monitoring path, every local LLM you run — there is a piece of Go behind most of them. Quiet, but load-bearing.</>}
              /></p>
            </div>
          </section>

          {/* 07 vs Java vs Node */}
          <section className="section" id="vs">
            <header className="sec-head">
              <span className="sec-num">07</span>
              <h2 className="sec-title"><L zh="对比" en="Compare" /> <code>: Go vs Java vs Node</code></h2>
              <p className="sec-desc"><L
                zh={<>三门后端主力语言，定位不一样。Java 强企业生态，Node 强 JS 复用，Go 强部署 + 并发。下面这张表帮你想清楚什么场景选谁。</>}
                en={<>Three of the most common backend languages — different sweet spots. Java leans on enterprise ecosystems, Node on JS sharing, Go on deployment + concurrency. The table below helps you decide which fits where.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-go">Go</th>
                  <th className="th-java">Java</th>
                  <th className="th-node">Node.js</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="类型系统" en="Type system" />,           go: <L zh="静态 · 结构化 interface · 推断" en="Static · structural interface · inferred" />,        java: <L zh="静态 · 名义类型 · 继承" en="Static · nominal · inheritance" />,            node: <L zh="动态（TS 加静态层）" en="Dynamic (TS adds a static layer)" /> },
                  { k: <L zh="启动时间" en="Startup time" />,           go: <L zh="毫秒" en="milliseconds" />,                                            java: <L zh="秒级（GraalVM 原生镜像可降到毫秒）" en="seconds (GraalVM native-image: ms)" />, node: <L zh="百毫秒" en="~hundreds of ms" /> },
                  { k: <L zh="并发模型" en="Concurrency" />,             go: <L zh="goroutine + channel · CSP" en="goroutines + channels · CSP" />,         java: <L zh="线程 + 虚拟线程（JDK 21+）" en="threads + virtual threads (JDK 21+)" />,    node: <L zh="单线程事件循环 · 异步 I/O" en="single-threaded event loop · async I/O" /> },
                  { k: <L zh="10 万并发连接" en="100k connections" />,    go: <L zh="~ 200MB 内存（goroutine 2KB）" en="~ 200MB RAM (goroutines, 2KB)" />,         java: <L zh="~ 100GB（OS 线程 1MB / 个）" en="~ 100GB (OS threads, 1MB each)" />,        node: <L zh="事件循环不阻塞 · 但 CPU 密集卡" en="event loop fine · CPU-bound stalls" /> },
                  { k: <L zh="部署" en="Deployment" />,                  go: <L zh={<>单静态二进制 · <code>FROM scratch</code> 5MB</>} en={<>single static binary · <code>FROM scratch</code> ~5MB</>} />, java: <L zh="JAR + JVM · ~ 200MB 镜像" en="JAR + JVM · ~ 200MB image" />,                node: <L zh="node_modules + Node · ~ 300MB" en="node_modules + Node · ~ 300MB" /> },
                  { k: <L zh="泛型" en="Generics" />,                    go: <L zh="2022 才加（1.18）· 用得克制" en="since 2022 (1.18) · used sparingly" />,        java: <L zh="2004 起 · 类型擦除" en="since 2004 · type erasure" />,                     node: <L zh="TS 才有 · JS 没有" en="only in TS · not in JS itself" /> },
                  { k: <L zh="错误处理" en="Error handling" />,           go: <L zh={<>返回值 <code>err != nil</code></>} en={<>return value <code>err != nil</code></>} />,                                  java: <L zh="异常 try/catch · checked exception" en="exceptions · checked exceptions" />,  node: <L zh="异常 + Promise.catch" en="exceptions + Promise.catch" /> },
                  { k: <L zh="包管理" en="Package management" />,         go: <L zh={<><code>go mod</code> · 内置</>} en={<><code>go mod</code> · built-in</>} />,                                       java: <L zh="Maven / Gradle · 配置重" en="Maven / Gradle · heavy config" />,            node: <L zh="npm / pnpm · 生态最大但 lockfile 痛" en="npm / pnpm · biggest ecosystem, lockfile pain" /> },
                  { k: <L zh="云原生场景" en="Cloud-native" />,           go: <L zh="事实标准 · K8s / Docker / Terraform" en="de-facto standard · K8s / Docker / Terraform" />,           java: <L zh="Spring Cloud / Quarkus 强" en="Spring Cloud / Quarkus" />,                  node: <L zh="主要在边缘 / API 网关" en="edge / API gateways" /> },
                  { k: <L zh="语言规范长度" en="Spec size" />,            go: <L zh="极短 · 25 关键字" en="tiny · 25 keywords" />,                              java: <L zh="巨长 · 50+ 关键字 + JEP 持续加" en="large · 50+ keywords + ongoing JEPs" />,    node: <L zh="JS 标准本身就大" en="JS spec itself is large" /> },
                  { k: <L zh="团队 onboard" en="Onboarding" />,           go: <L zh="~ 1 周" en="~ 1 week" />,                                                java: <L zh="~ 1 月" en="~ 1 month" />,                                                  node: <L zh="~ 2 周（含 TS 学习）" en="~ 2 weeks (incl. TS)" /> },
                  { k: <L zh="成熟生态" en="Mature ecosystem" />,         go: <L zh="云原生 / DevOps / CLI 强" en="cloud-native / DevOps / CLIs" />,             java: <L zh="企业级 / 金融 / Hadoop 强" en="enterprise / finance / Hadoop" />,           node: <L zh="前后端共享 · npm 最大" en="full-stack JS · npm" /> },
                ].map((row, i) => (
                  <tr key={i}>
                    <td>{row.k}</td>
                    <td>{row.go}</td>
                    <td>{row.java}</td>
                    <td>{row.node}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* 08 Future */}
          <section className="section" id="future">
            <header className="sec-head">
              <span className="sec-num">08</span>
              <h2 className="sec-title"><L zh="前景" en="Future" /> <code>: TheRoadAhead</code></h2>
              <p className="sec-desc"><L
                zh={<>Go 的近期变化主要在三条线：语法慢慢补齐表达力、生态从云原生扩到 AI 推理、被 TS 7 这种顶级项目选中证明了它在系统编程层的位置。</>}
                en={<>Three trends are moving at once: gradually filling out the language's expressiveness, expanding the ecosystem from cloud-native into AI inference, and being chosen for top-tier projects like TS 7 — proof that Go has earned a place in systems programming, not just in cloud-native.</>}
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
                <li><a href="https://go.dev" target="_blank" rel="noopener">go.dev</a></li>
                <li><a href="https://go.dev/play/" target="_blank" rel="noopener"><L zh="在线 Playground" en="Online Playground" /></a></li>
                <li><a href="https://go.dev/tour/" target="_blank" rel="noopener">A Tour of Go</a></li>
                <li><a href="https://go.dev/doc/effective_go" target="_blank" rel="noopener">Effective Go</a></li>
                <li><a href="https://github.com/golang/go" target="_blank" rel="noopener">GitHub Repo</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="关键阅读" en="Key reading" /></h4>
              <ul>
                <li><a href="https://go.dev/talks/2012/splash.article" target="_blank" rel="noopener">Pike · "Less is exponentially more"</a></li>
                <li><a href="https://devblogs.microsoft.com/typescript/typescript-native-port/" target="_blank" rel="noopener">A 10× Faster TypeScript</a></li>
                <li><a href="https://go.dev/blog/gopher" target="_blank" rel="noopener"><L zh="Gopher 吉祥物的故事" en="The Gopher mascot story" /></a></li>
                <li><a href="https://go.dev/doc/go1compat" target="_blank" rel="noopener">Go 1 Compatibility Promise</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="生态 / 数据" en="Ecosystem / data" /></h4>
              <ul>
                <li><a href="https://survey.stackoverflow.co/2025/" target="_blank" rel="noopener">Stack Overflow 2025</a></li>
                <li><a href="https://www.tiobe.com/tiobe-index/" target="_blank" rel="noopener">TIOBE Index</a></li>
                <li><a href="https://www.cncf.io/projects/" target="_blank" rel="noopener"><L zh="CNCF 毕业项目" en="CNCF graduated projects" /></a></li>
                <li><a href="https://github.com/avelino/awesome-go" target="_blank" rel="noopener">awesome-go</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="云原生 + AI" en="Cloud-native + AI" /></h4>
              <ul>
                <li><a href="https://kubernetes.io" target="_blank" rel="noopener">Kubernetes</a></li>
                <li><a href="https://www.docker.com" target="_blank" rel="noopener">Docker</a></li>
                <li><a href="https://ollama.com" target="_blank" rel="noopener">Ollama</a></li>
                <li><a href="https://github.com/microsoft/typescript-go" target="_blank" rel="noopener">microsoft/typescript-go</a></li>
                <li><a href="https://www.terraform.io" target="_blank" rel="noopener">Terraform</a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo">{GO_FOOTER_LOGO_SVG}</div>
              <p className="footer-line"><L zh="单页中文导览 · 资料截至 2026-05" en="A single-page guided tour · current as of 2026-05" /></p>
              <p className="footer-line dim"><code>{`go func() { fmt.Println("simplicity") }()`}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
