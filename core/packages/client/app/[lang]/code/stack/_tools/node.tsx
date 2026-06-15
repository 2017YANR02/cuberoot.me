import type { StackTool } from '../_lib/stack_tool_types';
import { k, v, s, n, f, c, t } from '../_lib/stack_tool_types';

// ─── Node.js 22 LTS "Jod" ───────────────────────────────────────────────────

export const NODE: StackTool = {
  slug: 'node',
  name: 'Node.js',
  version: '22 LTS',
  since: '2009-05',
  group: 'backend',
  accent: '#5FA04E',
  bright: '#8BC97B',
  glyph: '⬢',
  floats: ['V8', 'libuv', 'event loop', 'require()', 'import', 'ESM', 'fetch', 'worker_threads', '--watch', '--test', '--run', 'AsyncLocalStorage'],
  zh: {
    tagline: 'JavaScript 服务端运行时',
    role: '后端 API、构建工具、测试 runner、脚本全部跑在它上面。',
    heroSub: <>Ryan Dahl 2009 年把 V8 + libuv 粘起来, 把 "JS 只能跑在浏览器" 这条线打破。十七年过去, Node 22 LTS 内建了 fetch / test / watch / --run / require(esm), 几乎不需要再装外部工具就能起一个 prod 服务。</>,
    whatDesc: <>Node 是个<strong>运行时</strong>, 不是框架。V8 负责执行 JavaScript, libuv 负责非阻塞 IO, 中间一层薄绑定把"读文件 / 监听 socket / 起子进程"这些 syscall 暴露给 JS。其它都是社区生态。</>,
    historyDesc: <>从 2009 年 JSConf EU 公开发布, 到 2014 年 io.js fork 危机, 2015 年合并成 LTS 模型, 再到 2024 年 Node 22 把现代特性一次性补齐。每个 LTS 用一棵树命名 (Jod / Krypton), 这条线现在是企业基础设施。</>,
    conceptsTitle: '运行时 + IO + 模块',
    conceptsDesc: <>Node 自己的 API 表面很小:event loop、模块系统 (CJS + ESM)、fs / net / http / worker_threads 几个核心模块、加上 22 这条线新内建的 --test / --watch / --run。剩下的全是 npm 上 220 万个包堆出来的。</>,
    whyDesc: <>2026 年还选 Node, 不是因为它最快 (Bun 单核更快) 或最新 (Deno 设计更现代), 而是因为它的<strong>生态成熟度</strong>、<strong>原生模块支持</strong>、<strong>2027 年才到期的支持窗口</strong>三件事 Bun / Deno 暂时给不齐。</>,
    adoptersTitle: '谁在用',
    adoptersDesc: <>"前端工程链"和"Node"已经基本同义:Vite / esbuild / Rolldown / Webpack 全跑在 Node 上, Next / Remix dev server 也是。后端这边从 Stripe 到 GitHub 都有大量 Node 服务。</>,
    cuberootDesc: <>cuberoot.me 在云 VM 上跑<strong>一个 Node 22 LTS 进程</strong>, 监听 :3001, pm2 fork 模式守住, 走 Unix socket 连本地 PostgreSQL。dev 直接用 <code>tsx</code> 跑 <code>.ts</code> 不编译, prod 走 <code>tsc</code> 出的 <code>dist/</code>。</>,
    outlookTitle: '当下与前景',
    outlookDesc: <>Node 22 把 fetch / test / watch / --run 都内建了, 把 require(esm) 也 unflag 了。Bun / Deno 给社区压力之后, Node 反而是改得最快的那个。下一个 LTS (24 "Krypton") 已经在 2025-04 发布。</>,
  },
  en: {
    tagline: 'JavaScript runtime for the server',
    role: 'Where the backend API, build tools, test runner, and scripts all run.',
    heroSub: <>Ryan Dahl glued V8 to libuv in 2009 and broke "JS only runs in the browser." Seventeen years later, Node 22 LTS ships fetch / test / watch / --run / require(esm) — you can start a production service without installing extra tools.</>,
    whatDesc: <>Node is a <strong>runtime</strong>, not a framework. V8 executes JavaScript, libuv handles non-blocking IO, and a thin C++ binding layer exposes syscalls (read a file, listen on a socket, spawn a child) to JS. Everything else is community ecosystem.</>,
    historyDesc: <>From the 2009 JSConf EU debut, through the 2014 io.js fork, the 2015 reunification with LTS branding, to Node 22 in 2024 backfilling every modern feature at once. Each LTS gets a tree codename (Jod / Krypton). This line is enterprise infrastructure now.</>,
    conceptsTitle: 'Runtime + IO + modules',
    conceptsDesc: <>Node's own API surface is small: the event loop, the module system (CJS + ESM), the core modules (fs / net / http / worker_threads), and 22's new built-ins (--test / --watch / --run). The rest is the 2.2M packages on npm.</>,
    whyDesc: <>Picking Node in 2026 isn't about peak speed (Bun is faster single-core) or design freshness (Deno is more modern). Three things still favor Node: <strong>ecosystem maturity</strong>, <strong>native module support</strong>, and a <strong>support window that runs through 2027</strong>.</>,
    adoptersTitle: 'Who uses it',
    adoptersDesc: <>"Frontend toolchain" and "Node" are roughly synonymous: Vite / esbuild / Rolldown / Webpack all run on Node, so do Next / Remix dev servers. On the backend, from Stripe to GitHub, there are Node services everywhere.</>,
    cuberootDesc: <>cuberoot.me runs <strong>one Node 22 LTS process</strong> on the cloud VM, listening on :3001, supervised by pm2 in fork mode, talking to local PostgreSQL via Unix socket. Dev uses <code>tsx</code> to run <code>.ts</code> directly; prod runs the <code>dist/</code> output from <code>tsc</code>.</>,
    outlookTitle: 'Now and next',
    outlookDesc: <>Node 22 inlined fetch / test / watch / --run and unflagged require(esm). After pressure from Bun / Deno, Node is actually the one moving fastest. The next LTS (24 "Krypton") shipped 2025-04.</>,
  },
  heroStats: [
    { num: '22', unit: '.22.3', zh: <>当前 LTS 稳定版 <em>2026-05-13 · Jod</em></>, en: <>current LTS stable <em>2026-05-13 · Jod</em></>
    },
    { num: '17', unit: 'y', zh: <>从 2009 至今 <em>JS 服务端实质标准</em></>, en: <>since 2009 <em>de facto JS server</em></>
    },
    { num: '2.2', unit: 'M', zh: <>npm 包总数 <em>npmjs.com 2026-05</em></>, en: <>packages on npm <em>npmjs.com 2026-05</em></>
    },
    { num: '2027', unit: '-04', zh: <>22 LTS 维护期截止 <em>active LTS → 2026-10</em></>, en: <>22 LTS end of maintenance <em>active LTS → 2026-10</em></>
    },
  ],
  intro: {
    zh: (
      <>
        <p>Node.js 2009 年 5 月由 Ryan Dahl 在 JSConf EU 上抛出。背景是 Dahl 试图给 Apache 写一个能 push 通知的 module, 发现 Apache 的每连接一线程模型在 C10K 问题上已经撞墙。他的设想是:用一个<strong>单线程事件循环</strong> + <strong>非阻塞 IO</strong>, 让一个进程同时管几万个 socket, 不需要线程切换的开销。把这套底层 (libuv) 配上一个已有的快 JS 引擎 (V8), 就是 Node。</p>
        <p>之后是几次大震荡:2014 年社区不满 Joyent 治理 fork 出 io.js, 2015 年合并成 Node Foundation + LTS 节奏 (偶数版本走 LTS, 奇数版本 7 个月退役)。从 4.0 起每条 LTS 用一棵树命名 —— Argon、Boron、Dubnium、Erbium、Fermium、Gallium、Hydrogen、Iron, 到 22 这条是 <strong>Jod</strong>。</p>
        <p>2024 年 Node 22 是个补齐之年:Bun 和 Deno 在过去两年用 fetch / test / watch / 类型剥离这些"现代默认"给社区上了一课, 22 把它们一次性内建了 —— <code>node --test</code>, <code>node --watch</code>, <code>node --run</code>, 实验性的 <code>--experimental-strip-types</code>, 加上 require(esm) 终于 unflag。之后 24 LTS "Krypton" 2025-04 跟上 V8 13.1 + npm 11。本站现在跑的是 <strong>22.22.3</strong>, 2026-05-13 发布, 修了 crypto null-ptr + OpenSSL 3.5.6 + NSS 3.121 根证书刷新。</p>
      </>
    ),
    en: (
      <>
        <p>Node.js debuted in May 2009, presented by Ryan Dahl at JSConf EU. Dahl had been trying to add push notifications to Apache and discovered that Apache's thread-per-connection model had hit a wall on the C10K problem. His pitch: a <strong>single-threaded event loop</strong> on top of <strong>non-blocking IO</strong>, letting one process juggle tens of thousands of sockets without thread-switch overhead. Pair that runtime (libuv) with a fast existing JS engine (V8) and you have Node.</p>
        <p>The history that followed had a few tremors: in 2014 the community forked Joyent's governance into io.js; in 2015 they reunified into the Node Foundation with the LTS cadence (even majors → LTS, odd majors retired after 7 months). From 4.0 on, each LTS gets a tree codename — Argon, Boron, Dubnium, Erbium, Fermium, Gallium, Hydrogen, Iron, and 22's is <strong>Jod</strong>.</p>
        <p>Node 22 in 2024 was the "catch up" year. Bun and Deno had spent two years showing the community what "modern defaults" should look like — fetch / test / watch / type stripping. Node 22 inlined them in one release: <code>node --test</code>, <code>node --watch</code>, <code>node --run</code>, experimental <code>--experimental-strip-types</code>, and require(esm) finally unflagged. The next LTS (24 "Krypton", 2025-04) followed with V8 13.1 + npm 11. cuberoot.me runs <strong>22.22.3</strong>, released 2026-05-13, with a crypto null-ptr fix + OpenSSL 3.5.6 + NSS 3.121 root cert refresh.</p>
      </>
    ),
  },
  history: [
    { year: '2009·05', zh: { title: <>JSConf EU 公开发布</>, desc: <>Ryan Dahl 上台演示 V8 + libuv, 用一个单线程事件循环跑 HTTP server。会场反应:有点疯, 但确实可行。</> }, en: { title: <>Unveiled at JSConf EU</>, desc: <>Ryan Dahl demos V8 + libuv on stage, running an HTTP server inside a single-threaded event loop. Crowd reaction: a bit crazy, but clearly tractable.</> } },
    { year: '2010·01', zh: { title: <>npm registry 上线</>, desc: <>Isaac Schlueter 启动 npm。Node 没自带包管理这件事被外包给了一个独立项目, 反过来成就了今天 220 万包的生态。</> }, en: { title: <>npm registry launches</>, desc: <>Isaac Schlueter starts npm. Node not having a built-in package manager got outsourced to a separate project, which seeded today's 2.2M-package ecosystem.</> } },
    { year: '2014·12', zh: { title: <>io.js fork 危机</>, desc: <>社区不满 Joyent 的发布节奏和治理结构, fork 出 io.js, 推快速迭代路线 (1.x → 3.x 半年内三个 major)。</> }, en: { title: <>io.js fork crisis</>, desc: <>The community forks io.js out of frustration with Joyent's release pace and governance. Three majors (1.x → 3.x) ship in six months on the io.js side.</> } },
    { year: '2015·09', zh: { title: <>Node 4.0 合并</>, desc: <>io.js 重新合回 Node, 首次打"LTS"标签。从此偶数版本走 LTS (30 个月支持), 奇数版本 7 个月退役。每条 LTS 用一棵树命名。</> }, en: { title: <>Node 4.0 reunifies</>, desc: <>io.js merges back into Node and "LTS" branding launches. Even majors → LTS with 30-month support; odd majors retire after 7 months. Every LTS gets a tree codename.</> } },
    { year: '2017·09', zh: { title: <>Node 8 LTS</>, desc: <>async/await 完全稳定。从这版起回调地狱终于可以用语言级语法解决, koa / fastify 这一代框架开始流行。</> }, en: { title: <>Node 8 LTS</>, desc: <>async/await is fully stable. Callback hell can finally be solved at the language level; koa / fastify start to displace older frameworks.</> } },
    { year: '2020·10', zh: { title: <>Node 15 — top-level await</>, desc: <>ESM 模块顶层可以直接 await。配合 native ESM 支持, JS 服务端模块系统第一次和浏览器对齐。</> }, en: { title: <>Node 15 — top-level await</>, desc: <>ESM modules can await at the top level. With native ESM support, server-side modules finally match the browser.</> } },
    { year: '2022·04', zh: { title: <>Node 18 LTS</>, desc: <>原生 fetch、Web Streams、基于 undici 的 <code>--test</code> runner 全部上线; node-fetch 这类老依赖开始退役。</> }, en: { title: <>Node 18 LTS</>, desc: <>Native fetch, Web Streams, and the undici-based <code>--test</code> runner all land. Older deps like node-fetch begin retiring.</> } },
    { year: '2023·04', zh: { title: <>Node 20 LTS</>, desc: <>稳定 <code>--watch</code> 模式、permission model、稳定 test runner。开发体验和 Bun / Deno 的差距开始明显收窄。</> }, en: { title: <>Node 20 LTS</>, desc: <>Stable <code>--watch</code>, permission model, stable test runner. The DX gap to Bun / Deno narrows meaningfully.</> } },
    { year: '2024·04', highlight: true, zh: { title: <>Node 22 LTS "Jod"</>, desc: <><code>node --run</code> 脚本 runner、稳定 WebSocket client、require(esm) unflag、实验 <code>--experimental-strip-types</code>。这版几乎补齐了所有 "现代默认"。</> }, en: { title: <>Node 22 LTS "Jod"</>, desc: <><code>node --run</code> script runner, stable WebSocket client, require(esm) unflagged, experimental <code>--experimental-strip-types</code>. This release closes nearly every "modern default" gap.</> } },
    { year: '2025·04', zh: { title: <>Node 24 LTS "Krypton"</>, desc: <>V8 13.1、npm 11、AsyncLocalStorage 在 undici 里成为默认。cuberoot.me 还在 22 上, 因为 22 的支持期到 2027-04。</> }, en: { title: <>Node 24 LTS "Krypton"</>, desc: <>V8 13.1, npm 11, AsyncLocalStorage default in undici. cuberoot.me stays on 22 since its support window runs through 2027-04.</> } },
    { year: '2026·05', highlight: true, zh: { title: <>22.22.3 / 当前稳定</>, desc: <>2026-05-13 发布。修 crypto null-ptr + OpenSSL 升 3.5.6 + NSS 3.121 根证书刷新。本站 prod 进程跑的就是这个版本。</> }, en: { title: <>22.22.3 / current stable</>, desc: <>Released 2026-05-13. Crypto null-ptr fix + OpenSSL bumped to 3.5.6 + NSS 3.121 root cert refresh. This is the version on cuberoot.me's prod process.</> } },
  ],
  concepts: [
    { tag: 'A', zh: { title: <>事件循环 + libuv</>, desc: <>单线程跑 JS, libuv 把 IO 都丢给内核 epoll / kqueue / IOCP, IO 完成后回调进队列。CPU 重的活儿丢 worker_threads。</> }, en: { title: <>Event loop + libuv</>, desc: <>JS runs single-threaded; libuv hands IO off to the kernel (epoll / kqueue / IOCP) and queues completion callbacks. CPU-heavy work goes to worker_threads.</> }, code: <code>{k('import')} {'{'} {v('createServer')} {'}'} {k('from')} {s('"node:http"')};{'\n\n'}{f('createServer')}(({v('req')}, {v('res')}) =&gt; {'{'}{'\n'}  {v('res')}.{f('end')}({s('"hi"')});{'\n'}{'}'}).{f('listen')}({n('3001')});</code> },
    { tag: 'B', zh: { title: <>ESM 与 CJS 互通</>, desc: <>Node 22 把 require(esm) unflag。CJS 文件第一次可以直接 require 一个 ESM 包, 不再被 ERR_REQUIRE_ESM 卡死。</> }, en: { title: <>ESM ↔ CJS interop</>, desc: <>Node 22 unflagged require(esm). A CJS file can now require an ESM package directly without the dreaded ERR_REQUIRE_ESM.</> }, code: <code>{c('// 22+ works without flags')}{'\n'}{k('const')} {'{ '}{v('Hono')} {'}'} = {f('require')}({s('"hono"')});{'\n'}{c('// hono is ESM-only')}</code> },
    { tag: 'C', zh: { title: <>--watch 模式</>, desc: <>内建文件监听 + 自动重启。dev 不再需要 nodemon / tsx --watch 包一层。配合 --test 还有 --test --watch。</> }, en: { title: <>--watch mode</>, desc: <>Built-in file watching + auto-restart. No more nodemon wrapper in dev. Combine with --test for --test --watch.</> }, code: <code>$ {f('node')} --watch dist/index.js{'\n'}$ {f('node')} --watch --test{'\n'}{c('// reruns tests on change')}</code> },
    { tag: 'D', zh: { title: <>原生 test runner</>, desc: <><code>node --test</code> 直接跑 <code>*.test.js</code>。配 <code>node:test</code> 模块写测试, 不需要 vitest / jest 也能起步。</> }, en: { title: <>Native test runner</>, desc: <><code>node --test</code> runs <code>*.test.js</code> directly. Pair it with the <code>node:test</code> module — no vitest / jest needed for a baseline.</> }, code: <code>{k('import')} {'{'} {v('test')} {'}'} {k('from')} {s('"node:test"')};{'\n'}{k('import')} {v('assert')} {k('from')} {s('"node:assert"')};{'\n\n'}{f('test')}({s('"adds"')}, () =&gt; {'{'}{'\n'}  {v('assert')}.{f('equal')}({n('1')} + {n('1')}, {n('2')});{'\n'}{'}'});</code> },
    { tag: 'E', zh: { title: <>--run 脚本 runner</>, desc: <>Node 22 加的 <code>node --run start</code> 直接跑 package.json 的 scripts, 不走 npm/pnpm shell wrapper, 启动快一档。</> }, en: { title: <>--run script runner</>, desc: <>Node 22 added <code>node --run start</code> — executes package.json scripts directly, no npm/pnpm shell wrapper, noticeably faster cold start.</> }, code: <code>$ {f('node')} --run start{'\n'}{c('// vs')}{'\n'}$ {f('pnpm')} run start</code> },
    { tag: 'F', zh: { title: <>worker_threads</>, desc: <>真线程, 不共享 V8 isolate。CPU 重活 (kociemba solver / 视频帧解码) 用它把主线程让出来。本站的 scramble analyzer 就跑在这里。</> }, en: { title: <>worker_threads</>, desc: <>Real threads, no shared V8 isolate. Use them for CPU-heavy work (kociemba solver, video frame decode) so the main thread stays responsive. This site's scramble analyzer runs in one.</> }, code: <code>{k('import')} {'{'} {v('Worker')} {'}'} {k('from')} {s('"node:worker_threads"')};{'\n\n'}{k('const')} {v('w')} = {k('new')} {f('Worker')}({s('"./solve.js"')});{'\n'}{v('w')}.{f('postMessage')}({v('scramble')});</code> },
    { tag: 'G', zh: { title: <>原生 fetch + Web Streams</>, desc: <>Node 18 起 fetch 是全局, 接口和浏览器一样。Web Streams (Readable/Writable/Transform) 也是全局, 流式响应可以直接 return Response。</> }, en: { title: <>Native fetch + Web Streams</>, desc: <>Since Node 18, fetch is global with the same interface as the browser. Web Streams (Readable/Writable/Transform) are global too — stream responses can return a Response directly.</> }, code: <code>{k('const')} {v('r')} = {k('await')} {f('fetch')}({s('"https://api.cuberoot.me/v1/health"')});{'\n'}{k('const')} {v('json')} = {k('await')} {v('r')}.{f('json')}();</code> },
    { tag: 'H', zh: { title: <>AsyncLocalStorage</>, desc: <>异步上下文 (跨 await / setTimeout 都保留) 的标准答案。请求 ID / 用户身份 / tracing span 全靠它。Node 24 起在 undici 里默认开启。</> }, en: { title: <>AsyncLocalStorage</>, desc: <>The standard answer for async context (preserved across await / setTimeout). Request IDs, user identity, tracing spans all use it. Node 24 enables it in undici by default.</> }, code: <code>{k('import')} {'{'} {v('AsyncLocalStorage')} {'}'} {k('from')} {s('"node:async_hooks"')};{'\n\n'}{k('const')} {v('als')} = {k('new')} {f('AsyncLocalStorage')}{t('<')}{t('Ctx')}{t('>')}();{'\n'}{v('als')}.{f('run')}({v('ctx')}, {v('handler')});</code> },
  ],
  whyCards: [
    { icon: '⚙', zh: { title: <>生态成熟度无对手</>, desc: <>2.2M npm 包 + 17 年沉淀, postgres / kafka / s3 / observability 客户端在 Node 上几乎都有 production-grade 实现。Bun / Deno 经常踩 native module 兼容性的坑。</> }, en: { title: <>Unmatched ecosystem maturity</>, desc: <>2.2M packages + 17 years of compounding. postgres / kafka / s3 / observability clients all have production-grade Node implementations. Bun / Deno still hit native module compat edges.</> }, code: <>{k('import')} {v('postgres')} {k('from')} {s('"postgres"')};</> },
    { icon: '⌬', zh: { title: <>22 LTS 把 "现代默认" 补齐</>, desc: <>fetch / test / watch / --run / require(esm) / --strip-types 都内建。dev 起步不再需要 ts-node + nodemon + jest 三件套, 一个 <code>node --watch --test</code> 够。</> }, en: { title: <>22 LTS closes the modern-defaults gap</>, desc: <>fetch / test / watch / --run / require(esm) / --strip-types all built in. No more ts-node + nodemon + jest combo; <code>node --watch --test</code> is enough.</> }, code: <>$ {f('node')} --watch --test</> },
    { icon: '⌁', zh: { title: <>原生模块支持</>, desc: <>node-gyp / N-API 把 C++ 模块编译成 .node 文件直接 require。pg / sharp / sqlite3 / bcrypt 都依赖这条路。Bun 兼容性还在追, Deno FFI 是另一套。</> }, en: { title: <>Native module support</>, desc: <>node-gyp / N-API compile C++ to a .node file you can require. pg / sharp / sqlite3 / bcrypt all depend on this. Bun is still catching up, Deno's FFI is its own thing.</> }, code: <>{k('const')} {v('pg')} = {f('require')}({s('"pg-native"')});</> },
    { icon: '⌖', zh: { title: <>2027 年的支持窗口</>, desc: <>22 LTS active 到 2026-10, maintenance 到 2027-04-30。给你一年时间评估 24 / 26, 不是"半年后必须升"的紧迫感。</> }, en: { title: <>Support window through 2027</>, desc: <>22 LTS is active until 2026-10 and in maintenance until 2027-04-30. That's a full year to evaluate 24 / 26 — not the "must-upgrade-in-six-months" pressure.</> }, code: <>{c('// active LTS: 2024-10 → 2026-10')}{'\n'}{c('// maintenance: → 2027-04-30')}</> },
    { icon: '⌗', zh: { title: <>TypeScript 工具链全在 Node</>, desc: <>tsc / vite / esbuild / vitest / rolldown / turbo / pnpm 全部跑在 Node 上。如果项目里有任何前端工程链, Node 已经在了, 后端再用 Node 就是零额外开销。</> }, en: { title: <>The TS toolchain is Node</>, desc: <>tsc / vite / esbuild / vitest / rolldown / turbo / pnpm all run on Node. If you have any frontend toolchain, Node is already installed — using it for the backend is zero extra cost.</> }, code: <>$ {f('pnpm')} dlx tsx watch src/index.ts</> },
    { icon: '⏚', zh: { title: <>pm2 / systemd 部署成熟</>, desc: <>pm2 cluster reload / boot 持久化 / 日志轮转是为 Node 量身做的。单机部署不上 K8s, 这一套就够。Bun / Deno 在这个生态位还在起步。</> }, en: { title: <>pm2 / systemd deploy is mature</>, desc: <>pm2's cluster reload, boot persistence, and log rotation are tailored to Node. For a single-host non-K8s deploy, that stack is sufficient. Bun / Deno are still earlier here.</> }, code: <>$ {f('pm2')} start ecosystem.config.js</> },
    { icon: '⛯', zh: { title: <>团队招聘面广</>, desc: <>能写后端 JS/TS 的工程师在市场上非常多, 候选人池子是 Bun/Deno 的几个数量级。小团队这是个隐性但重要的因素。</> }, en: { title: <>Broad hiring pool</>, desc: <>The pool of engineers who can write backend JS/TS is orders of magnitude larger than for Bun/Deno. For small teams this is a quiet but real factor.</> }, code: <>{c('// LinkedIn: "Node.js" → 800k+')}{'\n'}{c('// vs "Bun runtime" → ~3k')}</> },
    { icon: '⚐', zh: { title: <>--strip-types 让 TS 不需要 build</>, desc: <>22 起实验支持直接 <code>node --experimental-strip-types src/index.ts</code>, 把类型注释当注释跳过。dev 不再需要 tsx / ts-node。</> }, en: { title: <>--strip-types removes the build step</>, desc: <>22 ships experimental <code>node --experimental-strip-types src/index.ts</code> — type annotations are stripped at load time. No more tsx / ts-node for dev.</> }, code: <>$ {f('node')} --experimental-strip-types src/index.ts</> },
  ],
  adopters: [
    { name: 'Vercel · Next.js', href: 'https://nextjs.org', highlight: true, zhNote: 'dev / build / SSR runtime 都是 Node', enNote: 'dev / build / SSR runtime all Node' },
    { name: 'Vite · Rolldown · esbuild', href: 'https://vitejs.dev', highlight: true, zhNote: '前端工程链顶梁, 全部跑在 Node', enNote: 'Frontend toolchain backbone, all on Node' },
    { name: 'Electron', href: 'https://electronjs.org', highlight: true, zhNote: 'VS Code / Slack / Discord / Notion 桌面端', enNote: 'VS Code / Slack / Discord / Notion desktops' },
    { name: 'npm registry', href: 'https://www.npmjs.com', zhNote: 'npm 本身就是 Node 写的', enNote: 'npm itself is a Node app' },
    { name: 'Stripe', href: 'https://stripe.com', zhNote: '大量内部 Node 服务', enNote: 'Substantial internal Node services' },
    { name: 'GitHub', href: 'https://github.com', zhNote: '内部多个 Node 服务 + Octicons / Primer 前端', enNote: 'Multiple internal Node services + Octicons / Primer frontends' },
    { name: 'Hono · Express · Fastify · Koa', href: 'https://hono.dev', zhNote: 'Node 上最常见的 web 框架', enNote: 'The most common web frameworks on Node' },
    { name: 'TypeScript compiler', href: 'https://www.typescriptlang.org', zhNote: 'tsc 是个 Node 程序', enNote: 'tsc is a Node program' },
    { name: 'pnpm · Turborepo', href: 'https://pnpm.io', zhNote: '现代 monorepo 工具, 100% Node', enNote: 'Modern monorepo tooling, 100% Node' },
    { name: 'Netflix', href: 'https://netflix.com', zhNote: 'API gateway / 客户端 SSR 部分用 Node', enNote: 'API gateway / client SSR pieces on Node' },
    { name: 'Trello · Atlassian', zhNote: '早期大规模 Node 实战之一', enNote: 'One of the earliest large-scale Node deployments' },
    { name: 'cuberoot.me', highlight: true, zhNote: '本站 api.cuberoot.me Hono 服务跑在 Node 22.22.3', enNote: 'This site — api.cuberoot.me Hono server on Node 22.22.3' },
  ],
  outlook: [
    { tag: <>HOT · 22 LTS</>, hot: true, big: true, zh: { title: <>22 LTS 是当下最稳的选择</>, body: <><p>Node 22 把 fetch / test / watch / --run / require(esm) / strip-types 一次性补齐, 同时给到 active LTS 到 2026-10、maintenance 到 2027-04-30 的支持窗口。<strong>新项目起步这是默认答案</strong>。</p><p>从 18 / 20 升 22 几乎是零摩擦:V8 12.4 + libuv 1.48, API breaking 极少。本站从 20 LTS 升 22 LTS 只改了 ecosystem.config.js 里的 node interpreter 路径。</p></> }, en: { title: <>22 LTS is the most stable bet right now</>, body: <><p>Node 22 packed in fetch / test / watch / --run / require(esm) / strip-types in one release, with an active LTS until 2026-10 and maintenance until 2027-04-30. <strong>This is the default answer for new projects.</strong></p><p>Upgrading from 18 / 20 to 22 is nearly frictionless: V8 12.4 + libuv 1.48, with very few breaking changes. cuberoot.me moved from 20 LTS to 22 LTS by changing only the interpreter path in ecosystem.config.js.</p></> } },
    { tag: '24 LTS', zh: { title: <>下一条 LTS "Krypton"</>, body: <><p>2025-04 发布, V8 13.1 + npm 11 + AsyncLocalStorage 在 undici 里默认开启。性能基线 +10~15%, --strip-types 接近稳定。等 24 进 active LTS (2025-10) 后是下一个升级窗口。</p></> }, en: { title: <>The next LTS — "Krypton"</>, body: <><p>Released 2025-04 with V8 13.1, npm 11, and AsyncLocalStorage default in undici. Roughly +10–15% perf baseline and --strip-types close to stable. Once it enters active LTS (2025-10), it becomes the next reasonable upgrade window.</p></> } },
    { tag: 'COMPETITION', zh: { title: <>Bun / Deno 的压力让 Node 改得最快</>, body: <><p>Bun 提供 4–10x cold start, 自带 bundler / tester / package manager。Deno 2 把 npm 兼容做扎实了。Node 没有装死, 反而是 18 → 22 这条线吸收得最快。竞品健康, 主线也跟着健康。</p></> }, en: { title: <>Bun / Deno pressure made Node move fastest</>, body: <><p>Bun delivers 4–10x cold start with a built-in bundler / tester / package manager. Deno 2 shored up npm compatibility. Node didn't ossify — the 18 → 22 line absorbed lessons faster than anyone expected. Healthy competition, healthier mainline.</p></> } },
    { tag: <>TYPES</>, zh: { title: <>--strip-types 是 TS-on-Node 的终局</>, body: <><p>22 起的 <code>--experimental-strip-types</code> 把 TS 类型当注释跳过, 不做类型检查只剥语法 (跟 esbuild 一样)。等它稳定之后, dev 时 tsc / tsx / ts-node 这条工具链可以全删, prod 走 <code>tsc</code> 出类型 + .d.ts 做 IDE。</p></> }, en: { title: <>--strip-types is the endgame for TS on Node</>, body: <><p><code>--experimental-strip-types</code> (since 22) treats TS types as comments, stripping syntax without type-checking (the esbuild approach). Once stable, the tsc / tsx / ts-node dev toolchain can go away — prod uses <code>tsc</code> to emit types + .d.ts for IDE, and runtime loads .ts directly.</p></> } },
    { tag: <>DATA</>, zh: { title: <>npm 周下载 30 亿包</>, body: <><p>2026-05 数据:npm 周总下载 ~30 亿包, 注册包数 2.2M, 月活开发者按 GitHub Octoverse 估超过 1700 万。生态规模上其他运行时不在一个量级。</p></> }, en: { title: <>3B weekly package downloads on npm</>, body: <><p>2026-05 numbers: ~3B weekly downloads on npm, 2.2M registered packages, GitHub Octoverse estimates more than 17M monthly active developers. No other runtime is in this scale class.</p></> } },
  ],
  cuberoot: {
    zh: (
      <>
        <p>cuberoot.me 在云 VM 上跑<strong>一个 Node 22.22.3 进程</strong>, 监听 127.0.0.1:3001, nginx 反代 <code>api.cuberoot.me</code> 过来。pm2 fork 模式 (不开 cluster, 单机单 Hono 服务用不上), 进程崩了自动拉起。Node interpreter 装在 <code>/usr/local/bin/node</code>, 通过 nvm 管理多版本, 当前默认 22 LTS。</p>
        <p>dev 这边不编译:<code>tsx watch src/index.ts</code> 直接跑 <code>.ts</code>, 改一个文件就重启。其实现在等 <code>--experimental-strip-types</code> 稳定之后 tsx 这层都可以删掉, 用 <code>node --watch --experimental-strip-types src/index.ts</code> 起服务。prod 走 <code>tsc</code> 编译到 <code>dist/</code>, pm2 启动 <code>dist/index.js</code>, 类型剥得很干净 (Hono 那条 RPC 类型链全靠 <code>.d.ts</code>)。</p>
        <p>数据库连接走 porsager 的 <code>postgres</code> 包, Unix socket 连本地 PG13, 不走 TCP。这个包是纯 JS 实现, 没有 native binding, 升 Node 大版本不需要重编译。WCA OAuth / recon 缓存 / alg 库 / 训练数据这些端点的存储都在这条连接上。</p>
        <p>启动持久化:<code>pm2 startup</code> + <code>pm2 save</code> 把 pm2 写进 systemd, 服务器重启时 pm2-runtime 跟着起, 然后从 <code>~/.pm2/dump.pm2</code> 恢复 app 列表。日志走 pm2-logrotate, 单文件 10MB 滚, 保留 14 天, 落在 <code>~/.pm2/logs/cuberoot-api-{'{'}out,err{'}'}.log</code>。整套部署单台机器自给自足, 没有 K8s 没有 Docker。</p>
      </>
    ),
    en: (
      <>
        <p>cuberoot.me runs <strong>one Node 22.22.3 process</strong> on the cloud VM, bound to 127.0.0.1:3001, with nginx reverse-proxying <code>api.cuberoot.me</code> in front. pm2 fork mode (no cluster — single Hono service on a single box doesn't need it); the process gets auto-restarted on crash. Node lives at <code>/usr/local/bin/node</code>, managed by nvm, currently defaulting to 22 LTS.</p>
        <p>Dev runs without compilation: <code>tsx watch src/index.ts</code> runs <code>.ts</code> directly with restart on save. Once <code>--experimental-strip-types</code> stabilizes, the tsx layer can disappear in favor of <code>node --watch --experimental-strip-types src/index.ts</code>. Prod uses <code>tsc</code> to compile to <code>dist/</code>, and pm2 starts <code>dist/index.js</code>; the type system is fully stripped at runtime (the Hono RPC type chain lives in <code>.d.ts</code>).</p>
        <p>The database connection uses porsager's <code>postgres</code> package over a Unix socket to local PG13, never TCP. It's a pure-JS implementation with no native binding — bumping Node majors doesn't require a rebuild. WCA OAuth, recon caches, alg library, training data — every endpoint's storage rides this one connection.</p>
        <p>Boot persistence: <code>pm2 startup</code> + <code>pm2 save</code> writes pm2 into systemd; on server reboot, pm2-runtime starts via systemd and restores the app list from <code>~/.pm2/dump.pm2</code>. Logs go through pm2-logrotate, rolling at 10MB per file with 14-day retention, landing in <code>~/.pm2/logs/cuberoot-api-{'{'}out,err{'}'}.log</code>. The entire deployment is self-contained on one box — no K8s, no Docker.</p>
      </>
    ),
  },
  links: [
    { label: 'nodejs.org', href: 'https://nodejs.org' },
    { label: 'GitHub · nodejs/node', href: 'https://github.com/nodejs/node' },
    { label: 'Node 22 LTS announcement', href: 'https://nodejs.org/en/blog/announcements/v22-release-announce' },
    { label: '22.22.3 release notes', href: 'https://nodejs.org/en/blog/release/v22.22.3' },
    { label: 'LTS release schedule', href: 'https://github.com/nodejs/release#release-schedule' },
  ],
};

export default NODE;
