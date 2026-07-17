import type { StackTool } from '../_lib/stack_tool_types';
import { k, v, s, n, c } from '../_lib/stack_tool_types';

// ─── nginx ──────────────────────────────────────────────────────────────────

export const NGINX: StackTool = {
  slug: 'nginx',
  name: 'nginx',
  version: 'mainline 1.31',
  since: '2004-10',
  group: 'edge',
  accent: '#009639',
  bright: '#4FB572',
  glyph: 'n',
  floats: ['server', 'location', 'proxy_pass', 'try_files', 'upstream', 'epoll', 'sendfile', 'gzip', 'map', 'add_header', 'proxy_cache', 'reload'],
  zh: {
    tagline: '事件驱动 web 服务器 + 反向代理',
    role: '所有流量的第一跳。SPA / API / WASM COI / blog 静态归档全靠这一个进程分发。',
    heroSub: <>Igor Sysoev 2002 年起在自己电脑上慢慢写, 2004-10-04 第一次公开发布, 直接冲着 c10k 问题去 —— 一台机器同时挂上万长连接, Apache 跪了, nginx 平了。二十二年后, 这一棵事件循环 + 单一配置文件的树仍然是公网超过 34% 站点的边缘进程。</>,
    whatDesc: <>nginx 是个 <strong>web 服务器</strong>, 顺手是反向代理、负载均衡、TLS 终止、HTTP 缓存。它的设计前提是"一台机器同时处理几万条长连接", 所以是事件驱动 + 非阻塞 I/O, 不像 Apache 那样 per-connection 一个进程 / 线程。配置一种 DSL, 一份文件描述完整路由 / 缓存 / header 注入逻辑。</>,
    historyDesc: <>从 Rambler.ru 内部上线、到 2008 年坐稳全球第 2、到 2019 被 F5 以 6.7 亿美元收购、到 2024 年 Maxim Dounin 因为安全披露分歧 fork 出 freenginx —— nginx 的故事是"一个人写出来 + 一家公司接管 + 内部分裂 + OSS 继续走"的完整范本。</>,
    conceptsTitle: '指令树 + 事件循环',
    conceptsDesc: <>nginx 配置是一棵嵌套块的树:<code>http</code> → <code>server</code> → <code>location</code>。每个块加几行指令, reload 时 worker 重读, 客户端连接不掉。</>,
    whyDesc: <>2026 年还选 nginx 不是因为它"最快", Caddy / HAProxy / envoy 在某些点都更亮。但是 <strong>它的 DSL 表达力 + 调试可见度 + 生态文档</strong> 仍是没人能复刻的组合, 出问题贴 <code>nginx -t</code> 输出就能定位。</>,
    adoptersTitle: '谁在用',
    adoptersDesc: <>Netcraft 2026 年数据:nginx + 其分支 (OpenResty / Tengine / Angie / freenginx) 加起来占公网 top 1M 站点的 34% 以上, Cloudflare 早期边缘、Netflix CDN、Wikipedia、GitHub、Dropbox 全都跑或跑过 nginx。</>,
    outlookTitle: '当下与前景',
    outlookDesc: <>mainline 1.31 + stable 1.30 同日发布, 加 HTTP/3 polish、ngx_http_tunnel_module、least_time 上游策略。freenginx 走了另一条更社区化的路线, 两条线并行。短期内 web 边缘格局不会变。</>,
  },
  en: {
    tagline: 'Event-driven web server + reverse proxy',
    role: 'First hop for every request. SPA / API / WASM COI / blog archive all dispatched by one process.',
    heroSub: <>Igor Sysoev wrote nginx privately starting 2002 and made the first public release on 2004-10-04, targeting the c10k problem head-on — one machine, tens of thousands of long-lived connections, Apache collapsed and nginx held flat. Twenty-two years later, this single event-loop + single-config-file tree is still the edge process for more than 34% of public sites.</>,
    whatDesc: <>nginx is a <strong>web server</strong> first, with reverse proxy / load balancing / TLS termination / HTTP cache as side effects. It was designed around "one box handles tens of thousands of long connections," so it is event-driven and non-blocking — unlike Apache, which forks a process or thread per connection. One DSL, one config file describes the full routing / caching / header-injection topology.</>,
    historyDesc: <>From the Rambler.ru deployment in the early 2000s, to becoming the global #2 web server by 2008, to the F5 acquisition for ~$670M in 2019, to Maxim Dounin's freenginx fork in 2024 — nginx's story is the complete arc of "one person writes it, one company buys it, internal disagreement forks it, OSS keeps shipping."</>,
    conceptsTitle: 'Directive tree + event loop',
    conceptsDesc: <>An nginx config is a nested tree of blocks: <code>http</code> → <code>server</code> → <code>location</code>. Each block carries a handful of directives; <code>reload</code> swaps in new workers without dropping connections.</>,
    whyDesc: <>Picking nginx in 2026 isn't because it's the fastest — Caddy / HAProxy / envoy each win some sub-benchmark. It's because the combination of <strong>DSL expressiveness + debuggability + ecosystem docs</strong> is still uncopied. When something is wrong, paste the <code>nginx -t</code> output and you're 80% to the fix.</>,
    adoptersTitle: 'Who uses it',
    adoptersDesc: <>Netcraft 2026: nginx + forks (OpenResty / Tengine / Angie / freenginx) serve over 34% of the public top-1M sites. Cloudflare's early edge, Netflix CDN, Wikipedia, GitHub, Dropbox have all run nginx or still do.</>,
    outlookTitle: 'Now and next',
    outlookDesc: <>Mainline 1.31 + stable 1.30 shipped on the same day with HTTP/3 polish, ngx_http_tunnel_module, and a least_time upstream strategy. freenginx is walking a more community-oriented path in parallel. The web-edge landscape is not going to swing in the short term.</>,
  },
  heroStats: [
    { num: '34', unit: '%', zh: <>公网 top 1M 站点 <em>Netcraft 2026-04</em></>, en: <>of the public top-1M sites <em>Netcraft 2026-04</em></>
    },
    { num: '22', unit: 'y', zh: <>从 2004 至今 <em>边缘第一选择</em></>, en: <>since 2004 <em>still the edge default</em></>
    },
    { num: '1.31', zh: <>当前 mainline <em>2026-05-13 ships</em></>, en: <>current mainline <em>2026-05-13 release</em></>
    },
    { num: '670', unit: 'M$', zh: <>F5 收购金额 <em>2019-03</em></>, en: <>F5 acquisition <em>2019-03</em></>
    },
  ],
  intro: {
    zh: (
      <>
        <p>nginx 是 Igor Sysoev 2002 年在俄罗斯写的一个 web 服务器, 一开始是给 Rambler.ru (当时俄罗斯最大的门户) 解决<strong>c10k 问题</strong> —— 一台机器同时挂上万条长连接, Apache 那种 "每连接一个进程 / 线程" 的模型直接 OOM, Sysoev 用 event loop + 非阻塞 I/O (Linux epoll / FreeBSD kqueue) 把这件事变成了"一个 worker 处理几万条几乎不耗内存"。</p>
        <p>2004-10-04 第一次公开发布 0.1.0。从那时起十年内, nginx 一边在俄语世界里被各大门户站普及, 一边以"配置文件最直观、性能曲线最平"的口碑在英文圈滚雪球。2008 年坐稳全球第 2 大 web 服务器, 2011 年 Sysoev 在旧金山注册 Nginx Inc.、OSS 保持自由, 商业产品 NGINX Plus 独立线。2019 年 F5 Networks 以 ~6.7 亿美元收购, 2024 年长期核心维护者 Maxim Dounin 因为<strong>安全披露策略</strong>分歧 fork 出 freenginx, 两条线一直并行到今天。</p>
        <p>2026 年 5 月 13 日 mainline 1.31.0 + stable 1.30.1 同日发布, 一起带来 <code>ngx_http_tunnel_module</code>、上游 <code>least_time</code> 平衡策略、以及 6 个 CVE 修复。这一年 HTTP/3 在 1.25 mainline 之后基本稳了, njs / dynamic modules / quic 抛光仍在迭代, 但 nginx 的本体设计十二年没动 —— 这是它能在 Caddy / Traefik / envoy 一起卷的时代仍然 keep going 的原因。</p>
      </>
    ),
    en: (
      <>
        <p>nginx is a web server Igor Sysoev started writing privately in Russia in 2002, originally to fix the <strong>c10k problem</strong> at Rambler.ru (then the largest Russian portal). Apache's "one process or thread per connection" model OOM'd under tens of thousands of concurrent long connections; Sysoev's event-loop + non-blocking I/O (epoll on Linux, kqueue on FreeBSD) turned the same workload into "one worker holds tens of thousands of mostly-idle sockets flat."</p>
        <p>Public release 0.1.0 landed on 2004-10-04. Over the next decade, nginx spread inside the Russian-language web first, then snowballed through the English ecosystem on the back of two reputations: "the most readable config DSL" and "the flattest performance curve under load." By 2008 it was the #2 web server globally. Igor incorporated Nginx Inc. in San Francisco in 2011 — OSS stayed free, with NGINX Plus on a separate commercial line. F5 Networks bought the company for ~$670M in 2019; in 2024, longtime core maintainer Maxim Dounin forked <strong>freenginx</strong> over a security-disclosure policy disagreement, and the two lines have run in parallel since.</p>
        <p>On 2026-05-13, mainline 1.31.0 + stable 1.30.1 shipped the same day with <code>ngx_http_tunnel_module</code>, the <code>least_time</code> upstream balancing strategy, and 6 CVE fixes. HTTP/3 has been mainlined since 1.25 (2023-05) and is mostly settled now; njs / dynamic modules / QUIC polish continues. But the core architecture has not been redesigned in twelve years — and that stability is exactly why nginx keeps shipping alongside Caddy / Traefik / envoy.</p>
      </>
    ),
  },
  history: [
    { year: '2002', zh: { title: <>Sysoev 私下立项</>, desc: <>Igor Sysoev 在 Rambler.ru 内部开始写, 名字一度叫 "engine x"。设计前提:一个 worker 用事件循环挂几万长连接, 不每连接 fork 进程。</> }, en: { title: <>Sysoev starts privately</>, desc: <>Igor Sysoev begins development inside Rambler.ru. Codename "engine x." Design premise: one worker holds tens of thousands of connections on an event loop, no per-connection process.</> } },
    { year: '2004·10', zh: { title: <>0.1.0 公开发布</>, desc: <>10 月 4 日 0.1.0 第一次公开 release。直接对标 Apache 在 c10k 场景下的瓶颈, 在俄语圈先普及。</> }, en: { title: <>0.1.0 goes public</>, desc: <>2004-10-04: first public release 0.1.0. Targets Apache's c10k bottleneck directly. Adoption starts in the Russian-language web.</> } },
    { year: '2008', zh: { title: <>全球第 2 大 web 服务器</>, desc: <>Netcraft 数据上 nginx 越过 Microsoft IIS 坐稳全球第 2, 仅次于 Apache。WordPress / Disqus / Pinterest 早期都已迁移。</> }, en: { title: <>#2 web server globally</>, desc: <>Netcraft confirms nginx has overtaken Microsoft IIS to become the #2 web server worldwide, behind only Apache. WordPress / Disqus / Pinterest have already migrated.</> } },
    { year: '2011', zh: { title: <>Nginx Inc. 成立</>, desc: <>Sysoev 在旧金山注册 Nginx Inc., OSS 保持免费, 商业产品 NGINX Plus (active health check / advanced load balance / 商业支持) 独立产品线。</> }, en: { title: <>Nginx Inc. founded</>, desc: <>Sysoev incorporates Nginx Inc. in San Francisco. OSS stays free; NGINX Plus (active health checks / advanced load balancing / commercial support) is a separate product line.</> } },
    { year: '2017·09', zh: { title: <>HTTP/2 stable + 模块化</>, desc: <>1.13 把 HTTP/2 推到 stable, 同期核心做模块化重写, 给后面的 dynamic modules / njs 铺路。</> }, en: { title: <>HTTP/2 stable + modular core</>, desc: <>1.13 ships HTTP/2 as stable. The core is modularized in parallel, paving the way for dynamic modules and njs.</> } },
    { year: '2019·03', zh: { title: <>F5 收购</>, desc: <>F5 Networks 以 ~6.7 亿美元收购 Nginx Inc.。OSS 项目继续, 但社区开始警惕"商业母公司决定 OSS 策略"。</> }, en: { title: <>F5 acquires</>, desc: <>F5 Networks acquires Nginx Inc. for ~$670M. The OSS project keeps shipping, but the community starts watching "commercial parent dictates OSS policy" carefully.</> } },
    { year: '2023·05', zh: { title: <>HTTP/3 + QUIC</>, desc: <>mainline 1.25 把 HTTP/3 + QUIC 推上 production-ready, 配合 BoringSSL 跑通。延迟敏感站点开始切。</> }, en: { title: <>HTTP/3 + QUIC</>, desc: <>Mainline 1.25 ships HTTP/3 + QUIC as production-ready against BoringSSL. Latency-sensitive sites start switching.</> } },
    { year: '2024·02', highlight: true, zh: { title: <>freenginx fork</>, desc: <>长期核心维护者 Maxim Dounin 因为 F5 的安全披露策略分歧, fork 出 freenginx, 走更社区化的路线。两条线并行至今。</> }, en: { title: <>freenginx fork</>, desc: <>Longtime core maintainer Maxim Dounin forks freenginx over a security-disclosure policy disagreement with F5, taking a more community-oriented path. Two parallel lines continue to ship.</> } },
    { year: '2024·11', zh: { title: <>1.27 + njs polish</>, desc: <>njs (nginx 内嵌 JS 子集) 走向 1.0, 配置里直接写脚本不再需要 Lua / OpenResty。HTTP/3 继续打磨。</> }, en: { title: <>1.27 + njs polish</>, desc: <>njs (nginx's embedded JS subset) approaches 1.0; you can script directly in config without Lua / OpenResty. HTTP/3 polish continues.</> } },
    { year: '2025·09', zh: { title: <>stable 1.28 / mainline 1.29</>, desc: <>常规 release cadence。dynamic modules 生态成熟 (modsecurity / brotli / vts 等), 加模块不用重编主程序。</> }, en: { title: <>stable 1.28 / mainline 1.29</>, desc: <>Regular release cadence. The dynamic-modules ecosystem (modsecurity / brotli / vts) matures; adding modules no longer requires recompiling the main binary.</> } },
    { year: '2026·05', highlight: true, zh: { title: <>mainline 1.31.0 + stable 1.30.1</>, desc: <>5 月 13 日同日 release, 一起带来 <code>ngx_http_tunnel_module</code>、<code>least_time</code> 上游策略、6 个 CVE 修复。</> }, en: { title: <>mainline 1.31.0 + stable 1.30.1</>, desc: <>Same-day release on 2026-05-13: <code>ngx_http_tunnel_module</code>, <code>least_time</code> upstream strategy, and 6 CVE fixes.</> } },
  ],
  concepts: [
    { tag: 'A', zh: { title: <>事件循环 worker</>, desc: <>每个 worker 用 epoll / kqueue 挂几万 fd, 非阻塞读写, 无 per-connection 进程 / 线程。<code>worker_processes auto</code> 跟 CPU 核数对齐。</> }, en: { title: <>Event-loop worker</>, desc: <>Each worker holds tens of thousands of fds via epoll / kqueue, non-blocking I/O, no per-connection process or thread. <code>worker_processes auto</code> matches CPU count.</> }, code: <code>{v('worker_processes')} {k('auto')};{'\n'}{v('events')} {'{'}{'\n'}  {v('worker_connections')} {n('10240')};{'\n'}  {v('use')} {k('epoll')};{'\n'}{'}'}</code> },
    { tag: 'B', zh: { title: <>server / location 树</>, desc: <>一台机器 host 多个 vhost, 每个 vhost 一棵 location 子树。匹配按"最长前缀 / 正则"双轨, 内部还能嵌 location。</> }, en: { title: <>server / location tree</>, desc: <>One box hosts many vhosts; each vhost has a location subtree. Matching runs on a longest-prefix + regex dual track; nested locations are allowed.</> }, code: <code>{v('server')} {'{'}{'\n'}  {v('listen')} {n('443')} {k('ssl')};{'\n'}  {v('server_name')} {s('cuberoot.me')};{'\n\n'}  {v('location')} / {'{'}{'\n'}    {v('try_files')} $uri /index.html;{'\n'}  {'}'}{'\n'}{'}'}</code> },
    { tag: 'C', zh: { title: <>proxy_pass + upstream</>, desc: <>反向代理一行搞定。<code>upstream</code> 块支持 round-robin / least_conn / least_time / hash, 失败自动剔除。</> }, en: { title: <>proxy_pass + upstream</>, desc: <>Reverse proxying takes one line. The <code>upstream</code> block supports round-robin / least_conn / least_time / hash, with automatic failure ejection.</> }, code: <code>{v('upstream')} api {'{'}{'\n'}  {v('least_conn')};{'\n'}  {v('server')} {n('127.0.0.1')}:{n('3001')};{'\n'}{'}'}{'\n\n'}{v('location')} /v1/ {'{'}{'\n'}  {v('proxy_pass')} {s('http://api')};{'\n'}{'}'}</code> },
    { tag: 'D', zh: { title: <>proxy_cache + stale</>, desc: <>反代结果落盘缓存, 还能在上游挂掉时吐<strong>过期但可用</strong>的响应, 撑过短时故障。</> }, en: { title: <>proxy_cache + stale</>, desc: <>Cache reverse-proxy responses to disk and serve <strong>stale-but-usable</strong> content when the upstream fails, riding through short outages.</> }, code: <code>{v('proxy_cache')} api_cache;{'\n'}{v('proxy_cache_valid')} {n('200')} {n('24')}h;{'\n'}{v('proxy_cache_use_stale')} error timeout updating;</code> },
    { tag: 'E', zh: { title: <>try_files SPA 兜底</>, desc: <>React Router 这种 client-side route 没有真实文件, 必须让 nginx 在文件不存在时回 <code>/index.html</code> 让 JS 接管。</> }, en: { title: <>try_files SPA fallback</>, desc: <>Client-side routes (React Router) have no backing file. nginx must fall back to <code>/index.html</code> when a path doesn't exist so the JS router can take over.</> }, code: <code>{v('location')} / {'{'}{'\n'}  {v('try_files')} $uri $uri/ /index.html;{'\n'}{'}'}</code> },
    { tag: 'F', zh: { title: <>map + add_header 注入</>, desc: <>用 <code>map</code> 根据 URI 动态算变量, 配合 <code>add_header</code> 只在特定路径下发 COOP / COEP, 别处保持干净。cuberoot.me 的 SAB 隔离就这么搞。</> }, en: { title: <>map + add_header injection</>, desc: <>Use <code>map</code> to derive a variable from URI, then <code>add_header</code> conditionally to inject COOP / COEP only on selected paths. That's how cuberoot.me isolates SAB pages.</> }, code: <code>{v('map')} $request_uri $coi {'{'}{'\n'}  {s('"~^/scramble/(solver|analyzer)"')} {s('"require-corp"')};{'\n'}  {k('default')} {s('""')};{'\n'}{'}'}{'\n\n'}{v('add_header')} Cross-Origin-Embedder-Policy $coi {k('always')};</code> },
    { tag: 'G', zh: { title: <>gzip / brotli / sendfile</>, desc: <>静态资源压缩 + 零拷贝 sendfile + open_file_cache 让 SPA assets 直接吐到 socket。Vite 8 build 出来的 hashed chunk 可以 immutable 缓存一年。</> }, en: { title: <>gzip / brotli / sendfile</>, desc: <>Compress static assets, send them with zero-copy sendfile, and use open_file_cache so SPA assets land in the socket immediately. Vite 8's hashed chunks can be cached immutable for a year.</> }, code: <code>{v('gzip')} {k('on')};{'\n'}{v('gzip_types')} text/css application/javascript;{'\n'}{v('sendfile')} {k('on')};{'\n'}{v('open_file_cache')} {k('max')}={n('1000')};</code> },
    { tag: 'H', zh: { title: <>nginx -t + 热 reload</>, desc: <>改完配置 <code>nginx -t</code> 先验语法 (会指到 line:col), 通过后 <code>nginx -s reload</code> 起新 worker, 老 worker 处理完连接再退, 用户感知零中断。</> }, en: { title: <>nginx -t + hot reload</>, desc: <>After editing, <code>nginx -t</code> validates syntax (points to line:col); on success, <code>nginx -s reload</code> spawns new workers and lets old ones drain. Zero user-visible interruption.</> }, code: <code>$ nginx -t{'\n'}nginx: configuration file ok{'\n'}$ nginx -s reload</code> },
  ],
  whyCards: [
    { icon: '⚙', zh: { title: <>事件循环吃下 c10k</>, desc: <>Apache 的 prefork / worker 模型在几万长连接下 OOM, nginx 的 epoll worker 几乎平的内存曲线。WebSocket / SSE / 长 polling 直接受益。</> }, en: { title: <>Event loop swallows c10k</>, desc: <>Apache's prefork / worker model OOMs under tens of thousands of long-lived connections; nginx's epoll worker holds memory nearly flat. WebSocket / SSE / long-poll all benefit directly.</> }, code: <>{v('worker_connections')} {n('10240')};</> },
    { icon: '⌬', zh: { title: <>配置就是部署单位</>, desc: <>一份文件描述完整路由 / 缓存 / TLS / header 注入。没有"控制台点两下"的隐性状态, 整份配置进 git 就可重放。cuberoot.me 的 vhost 全在 <code>ops/nginx/</code>。</> }, en: { title: <>Config is the deploy unit</>, desc: <>One file describes routing / cache / TLS / header injection completely. No "click twice in a dashboard" hidden state; commit the config to git and it replays. cuberoot.me keeps every vhost in <code>ops/nginx/</code>.</> }, code: <>{c('# git push triggers')}{'\n'}{c('# scp + nginx -t + reload')}</> },
    { icon: '⎇', zh: { title: <>反代 + 静态同进程</>, desc: <>同一个 nginx 同时服静态文件、反代 API、终止 TLS, 不需要再叠一层 HAProxy 或 Caddy。Hono 服务 :3001 是它身后唯一的 origin。</> }, en: { title: <>Reverse proxy + static together</>, desc: <>The same nginx serves static files, reverse-proxies the API, and terminates TLS. No HAProxy or Caddy stacked in front. The Hono service on :3001 is the only origin behind it.</> }, code: <>{v('proxy_pass')} {s('http://127.0.0.1:3001')};</> },
    { icon: '⌁', zh: { title: <>proxy_cache 兜过期</>, desc: <>上游挂时不直接把 502 抛给用户, 而是吐缓存里<strong>过期但可用</strong>的响应。/v1/wca/* 这种 24h 不变的端点贴这套很省事。</> }, en: { title: <>proxy_cache + stale</>, desc: <>When the upstream falls over, instead of forwarding 502 we serve the cached-but-expired body. Endpoints like /v1/wca/* that change at most daily benefit a lot.</> }, code: <>{v('proxy_cache_use_stale')} error timeout;</> },
    { icon: '⌖', zh: { title: <>条件 header 注入</>, desc: <>cuberoot.me 只有 <code>/scramble/(solver|analyzer)</code> 两条路径需要 COOP/COEP 进 SAB 上下文, 其它 24 张卡全保持干净 —— map + add_header 一行解决。</> }, en: { title: <>Conditional header injection</>, desc: <>Only <code>/scramble/(solver|analyzer)</code> needs COOP/COEP for the SAB context on cuberoot.me; the other 24 tools must stay clean. map + add_header does this in one block.</> }, code: <>{v('add_header')} Cross-Origin-Opener-Policy $coop;</> },
    { icon: '⌗', zh: { title: <>零中断 reload</>, desc: <>改完 <code>nginx -s reload</code> 起新 worker, 老 worker 处理完手里的连接才退, 上层用户完全感觉不到。CI 失败自动 <code>cp .bak</code> 回滚。</> }, en: { title: <>Zero-downtime reload</>, desc: <><code>nginx -s reload</code> spawns new workers; old workers drain their connections before exiting. Users see nothing. On CI failure we <code>cp .bak</code> rollback automatically.</> }, code: <>$ nginx -s reload</> },
    { icon: '⏚', zh: { title: <>错误日志就是文档</>, desc: <>access_log + error_log 两份, 行格式自由组合 <code>$status $request_time $upstream_response_time</code> 之类。半夜出问题贴日志就能定位, 不用挂 APM。</> }, en: { title: <>The error log IS the docs</>, desc: <>access_log + error_log, with row formats freely composed from <code>$status $request_time $upstream_response_time</code> etc. When something fails at 3am, the log is enough — no APM stack needed.</> }, code: <>{v('log_format')} main {s('"$status $request_time"')};</> },
    { icon: '⛯', zh: { title: <>22 年 API 几乎没坏过</>, desc: <>2004 写的 <code>server / location / proxy_pass</code> 配置 2026 直接能跑。少有 OSS 项目能保住这种向后兼容曲线。</> }, en: { title: <>22 years of near-zero breakage</>, desc: <>A <code>server / location / proxy_pass</code> config written in 2004 still runs in 2026 untouched. Very few OSS projects keep that backwards-compatibility curve.</> }, code: <>{c('# config from 2008')}{'\n'}{c('# still parses cleanly')}</> },
    { icon: '⚐', zh: { title: <>分支生态分散风险</>, desc: <>OpenResty (+ Lua) / Tengine (阿里) / Angie / freenginx 各走一条路, 上游政策变了也有替代品可换。Caddy / Traefik 没这种社区分散。</> }, en: { title: <>Forks spread risk</>, desc: <>OpenResty (+ Lua) / Tengine (Alibaba) / Angie / freenginx all walk their own paths. If upstream policy goes sideways, alternates exist. Caddy / Traefik have no such community spread.</> }, code: <>{c('# pick a flavor:')}{'\n'}{c('# nginx / freenginx / openresty')}</> },
  ],
  adopters: [
    { name: 'Netflix', highlight: true, zhNote: 'CDN 边缘跑深度定制 nginx (Netflix-OSS), 长视频流首选', enNote: 'CDN edge runs a deep-custom nginx (Netflix-OSS) — first choice for long-form video' },
    { name: 'Cloudflare', highlight: true, href: 'https://blog.cloudflare.com', zhNote: '早期边缘大量基于 nginx (后转 Pingora, 但启示来源在这里)', enNote: 'Early edge heavily built on nginx (later moved to Pingora, but the lineage starts here)' },
    { name: 'Wikipedia / Wikimedia', highlight: true, href: 'https://wikitech.wikimedia.org', zhNote: '所有流量经 Varnish + nginx 前后端', enNote: 'All traffic passes through a Varnish + nginx front + backend' },
    { name: 'GitHub', href: 'https://github.com', zhNote: 'GitHub.com 边缘长期 nginx, 静态资源 + Git Smart HTTP', enNote: 'GitHub.com edge has long run on nginx — static assets + Git Smart HTTP' },
    { name: 'Dropbox', href: 'https://dropbox.tech', zhNote: '边缘 + 上传通道反代', enNote: 'Edge + upload-channel reverse proxy' },
    { name: 'Airbnb', href: 'https://airbnb.com', zhNote: '全球边缘 + 内部服务 mesh 入口', enNote: 'Global edge + internal service-mesh ingress' },
    { name: 'WordPress.com', href: 'https://wordpress.com', zhNote: 'Automattic 多年标准前端', enNote: "Automattic's standard frontend for years" },
    { name: 'OpenResty', href: 'https://openresty.org', zhNote: 'nginx + Lua bundle, 自成生态', enNote: 'nginx + Lua bundle, its own ecosystem' },
    { name: 'Tengine', href: 'https://tengine.taobao.org', zhNote: '阿里淘宝出的分支, 大流量场景定制', enNote: "Alibaba/Taobao's fork, tuned for hyperscale traffic" },
    { name: 'freenginx', href: 'https://freenginx.org', zhNote: 'Maxim Dounin 2024 fork, 社区路线', enNote: 'Maxim Dounin\'s 2024 fork on a community track' },
    { name: 'Angie', href: 'https://angie.software', zhNote: '前 nginx 团队另起的分支', enNote: 'Another fork from former nginx team members' },
    { name: 'cuberoot.me', highlight: true, zhNote: '本站边缘进程, 同时干 SPA + API + WASM COI + blog 四件事', enNote: 'This site\'s edge process — SPA + API + WASM COI + blog, all in one' },
  ],
  outlook: [
    { tag: <>HOT · 2026-05</>, hot: true, big: true, zh: { title: <>mainline 1.31 + stable 1.30 同日</>, body: <><p>5 月 13 日 mainline 1.31.0 + stable 1.30.1 一起发布, 加上 <code>ngx_http_tunnel_module</code> (原生支持双向 tunnel)、上游 <code>least_time</code> 平衡策略、6 个 CVE 修复。</p><p>同日 release 两条线说明 F5 在 freenginx 出现之后没有打算放弃 stable 线 —— 这是一个明确信号:OSS 投入仍然在, 不只是商业 NGINX Plus 的副产品。</p></> }, en: { title: <>mainline 1.31 + stable 1.30 same day</>, body: <><p>On 2026-05-13, mainline 1.31.0 + stable 1.30.1 shipped together with <code>ngx_http_tunnel_module</code> (native bidirectional tunnel), the <code>least_time</code> upstream balancing strategy, and 6 CVE fixes.</p><p>Shipping both lines the same day is the clearest signal F5 has given since freenginx appeared: the stable line is not being abandoned, and OSS investment is not a side effect of NGINX Plus.</p></> } },
    { tag: 'HTTP/3', zh: { title: <>QUIC 抛光收官</>, body: <><p>1.25 把 HTTP/3 推 production 后, 之后两年都在抛光:0-RTT、连接迁移、丢包处理。2026 配合 nginx 的延迟数字基本跟 Caddy / envoy 持平。延迟敏感站点 (流媒体 / 实时应用) 直接 HTTP/3 over UDP/443。</p></> }, en: { title: <>QUIC polish nearing done</>, body: <><p>Since 1.25 mainlined HTTP/3 production, the last two years have been pure polish — 0-RTT, connection migration, packet-loss handling. By 2026 the latency numbers match Caddy / envoy. Latency-sensitive sites (media / real-time) can go HTTP/3 over UDP/443 directly.</p></> } },
    { tag: 'FORK', zh: { title: <>freenginx 走出自己的路</>, body: <><p>Maxim Dounin 的 freenginx fork 一年多以后已经有自己 release 节奏, 走的是<strong>更快披露 / 更小 PR 周期</strong>的社区路线。对运维者来说这是好事:出问题可以二选一。</p></> }, en: { title: <>freenginx finds its own footing</>, body: <><p>A year and change after the fork, freenginx has its own release cadence, leaning into <strong>faster disclosure / shorter PR cycles</strong> as a community-first project. For operators, this is good news: when one line stalls, the other is a viable bridge.</p></> } },
    { tag: 'WASM', zh: { title: <>njs + WASM filter</>, body: <><p>njs (nginx 嵌入式 JS) 已经稳定, 配置里直接写"在每个 request 上跑这段 JS"; 实验性 WASM filter chain 在 envoy 那条路上被验证, nginx 侧也在试 ngx_http_js_module 升级。Lua / OpenResty 长期的"嵌入脚本"位置开始被原生方案分担。</p></> }, en: { title: <>njs + WASM filters</>, body: <><p>njs (nginx's embedded JS) has stabilized — you can just write "run this JS on every request" in config. Experimental WASM filter chains have been validated on envoy; the nginx side is iterating on ngx_http_js_module. The role Lua / OpenResty long owned (embedded scripting) is starting to be shared.</p></> } },
    { tag: <>DATA</>, zh: { title: <>34% 公网仍跑 nginx 系</>, body: <><p>Netcraft 2026 数据:nginx + OpenResty / Tengine / Angie / freenginx 加起来仍占公网 top 1M 站点的 34%+。Apache 已稳定下行, Caddy 在小站点和 homelab 涨, 但 nginx 系在大流量边缘的位置没动。</p></> }, en: { title: <>34% of the public web on nginx-line</>, body: <><p>Netcraft 2026: nginx + OpenResty / Tengine / Angie / freenginx serve over 34% of the public top-1M sites. Apache trends down steadily; Caddy gains in small sites and homelabs; but the nginx family's position at high-traffic edges hasn't shifted.</p></> } },
  ],
  cuberoot: {
    zh: (
      <>
        <p>cuberoot.me 的入口是<strong>一台机器上的一个 nginx 进程</strong>。所有公网流量 (apex + www + api + blog 子域) 先到这里, 然后被同一份 <code>ops/nginx/www.cuberoot.me.conf</code> 分发出去。这份 vhost 文件进 git, 改的时候触发 <code>deploy_nginx.yml</code> 工作流:scp 上去 → <code>nginx -t</code> 验语法 → reload, 失败就 <code>cp .bak</code> 自动回滚, 整个过程零中断。</p>
        <p>它同时承担四件事。第一是 SPA 静态服务:apex 301 跳到 www, <code>/</code> 下用 <code>try_files $uri $uri/ /index.html</code> 兜 React Router 的所有 client-side 路由, hashed chunks 直接 <code>Cache-Control: immutable, max-age=1y</code>。第二是 API 反代:<code>api.cuberoot.me</code> 整域反代到 127.0.0.1:3001 的 Hono 服务, 在 <code>/v1/wca/*</code> 这种只读端点上挂 24h <code>proxy_cache</code> 并开 <code>proxy_cache_use_stale</code>, 上游短时挂了用户也照样能看到数据。</p>
        <p>第三是 WASM COI 隔离:cubeopt-wasm 在 <code>/scramble/solver</code> 和 <code>/scramble/analyzer</code> 两条路径下需要 cross-origin isolated context 才能用 SharedArrayBuffer, 所以用一个 <code>map $request_uri</code> 算出 <code>$coop $coep</code> 两个变量, 配合 <code>add_header</code> 只在这两条路径下发 COOP=same-origin + COEP=require-corp, 其它 24 张工具卡完全干净。新增需要 SAB 的页面就在 map regex 里加一条。</p>
        <p>第四是 blog 静态归档:<code>cuberoot.me/blog/</code> alias 到本地静态目录 (WordPress 静态化后的产物), 同时 <code>blog.cuberoot.me</code> 是独立 vhost 走另一份 root。SPA 的 SW 还会兜底处理一批旧 WP slug, 让历史链接不死。一个 nginx 进程同时承担 SPA + API + WASM COI + blog 四种角色, 配置 ~300 行, reload 时间 &lt; 100ms。</p>
      </>
    ),
    en: (
      <>
        <p>The cuberoot.me edge is <strong>a single nginx process on a single VM</strong>. All public traffic (apex + www + api + blog subdomain) lands here first and is dispatched by one <code>ops/nginx/www.cuberoot.me.conf</code>. The vhost file lives in git; pushing it triggers <code>deploy_nginx.yml</code>: scp up → <code>nginx -t</code> validate → reload, with automatic <code>cp .bak</code> rollback on failure. Zero downtime.</p>
        <p>It does four jobs simultaneously. First, SPA static: apex 301s to www; <code>/</code> uses <code>try_files $uri $uri/ /index.html</code> to fall back to the SPA shell for every client-side React Router path; hashed chunks ship with <code>Cache-Control: immutable, max-age=1y</code>. Second, API reverse proxy: the entire <code>api.cuberoot.me</code> zone proxies to the Hono service on 127.0.0.1:3001, with a 24h <code>proxy_cache</code> layer on read-only endpoints like <code>/v1/wca/*</code> and <code>proxy_cache_use_stale</code> on top — short upstream outages stay invisible to users.</p>
        <p>Third, WASM COI isolation: cubeopt-wasm needs a cross-origin isolated context on <code>/scramble/solver</code> and <code>/scramble/analyzer</code> only, so a <code>map $request_uri</code> derives <code>$coop $coep</code>, and <code>add_header</code> ships COOP=same-origin + COEP=require-corp only on those two paths. The other 24 tools stay completely clean. To add a new SAB page, add one regex line to the map.</p>
        <p>Fourth, the blog archive: <code>cuberoot.me/blog/</code> aliases to a local static directory (the post-WordPress static export), while <code>blog.cuberoot.me</code> is a separate vhost pointing at another root. The SPA's service worker also catches a list of legacy WP slugs so old inbound links don't die. One nginx process plays SPA + API + WASM COI + blog at the same time — config ~300 lines, reload &lt; 100ms.</p>
      </>
    ),
  },
  links: [
    { label: 'nginx.org', href: 'https://nginx.org' },
    { label: 'Documentation', href: 'https://nginx.org/en/docs/' },
    { label: 'freenginx.org', href: 'https://freenginx.org' },
    { label: 'GitHub mirror', href: 'https://github.com/nginx/nginx' },
  ],
};

export default NGINX;
