import type { StackTool } from '../stack_tool_types';
import { s, n, f, p, c } from '../stack_tool_types';

// ─── PM2 7.0 ────────────────────────────────────────────────────────────────

export const PM2: StackTool = {
  slug: 'pm2',
  name: 'PM2',
  version: '7.0',
  since: '2013-06',
  group: 'backend',
  accent: '#2B96EC',
  bright: '#6FB9F2',
  glyph: 'P2',
  floats: ['cluster', 'fork', 'reload', 'restart', 'startup', 'save', 'monit', 'logrotate', 'ecosystem', 'pm2 list', 'graceful', 'PID 1'],
  zh: {
    tagline: 'Node 进程守护 + 集群 + 日志',
    role: '把 Hono API 拉起来、崩了拉回去、reboot 后自动恢复, 全靠它一个 CLI。',
    heroSub: <>Alexandre Strzelewicz 2013 年写出来, 解决一件事:Node 单进程崩了之后没人拉。十三年过去, pm2 包成了一个 cluster reload + 日志轮转 + 开机持久化 + 监控终端的全套。<strong>单机 Node 部署的事实标准。</strong></>,
    whatDesc: <>pm2 是一个<strong>进程管理器</strong>, 装在 Node 上, 围住一堆 Node 进程。它做四件事:守住进程 (崩了拉起)、零 downtime reload、日志收集 + 轮转、开机持久化 (systemd 集成)。</>,
    historyDesc: <>2013 年 npm 第一次发布时只是 "保 Node 进程活"。后来 cluster mode、ecosystem.config.js、pm2-runtime (Docker 友好 PID 1)、Keymetrics SaaS 一个个加。2025-05 的 v7.0 加上了 Bun 运行时支持, 把 pm2-axon / pm2-io-agent 内联进 monorepo, 减小供应链面。</>,
    conceptsTitle: '进程 + 配置 + 持久化',
    conceptsDesc: <>pm2 自己的 CLI 表面不大:启 / 停 / 重启 / reload / list / monit / logs / startup / save。配上 ecosystem.config.js 把 "几个 app、各自什么 env、几个 instance" 写死, 部署就是 <code>pm2 reload ecosystem.config.js --env production</code>。</>,
    whyDesc: <>2026 年单机 Node 部署还选 pm2, 不是因为它最酷, 而是因为:<strong>systemd 一个 unit 一个服务太繁琐</strong>, Docker / K8s 对单机一个 API 太重, forever 已死, foreman 偏 dev。pm2 这套刚好填中间。</>,
    adoptersTitle: '谁在用',
    adoptersDesc: <>不上 K8s 的中小 Node 服务几乎人手一份 pm2。IBM cloud / DigitalOcean 的 Node 教程默认就用它。本站的 api.cuberoot.me 也是。</>,
    cuberootDesc: <>本站 <code>api.cuberoot.me</code> Hono 服务在云 VM 上跑 <code>pm2 start ecosystem.config.js</code>, 一个 app, fork 模式, <code>pm2 startup</code> + <code>pm2 save</code> 注册到 systemd, 部署走 <code>pm2 reload cuberoot-api</code> 零 downtime。日志走 pm2-logrotate 滚 10MB / 留 14 天。</>,
    outlookTitle: '当下与前景',
    outlookDesc: <>v7.0 把 Bun 支持加进来, 内化掉 pm2-axon / pm2-io-agent 减少供应链, 修 CVE。下一阶段 systemd / OpenRC 的二级集成, 以及对 Hono / Fastify 这一代框架的 metrics 自动接入会继续推。</>,
  },
  en: {
    tagline: 'Node process manager, cluster, and logs',
    role: 'Starts the Hono API, restarts it on crash, and brings it back after reboot — one CLI.',
    heroSub: <>Alexandre Strzelewicz wrote pm2 in 2013 to solve one thing: when a single Node process crashes, nothing restarts it. Thirteen years later, pm2 wraps cluster reload + log rotation + boot persistence + a monitor TUI in one package. <strong>The de facto standard for single-host Node.</strong></>,
    whatDesc: <>pm2 is a <strong>process manager</strong> installed on top of Node, fencing in a set of Node processes. It does four things: keeps processes alive (restart on crash), zero-downtime reload, log collection + rotation, and boot persistence (systemd integration).</>,
    historyDesc: <>The 2013 first npm release just "kept Node alive." Cluster mode, ecosystem.config.js, pm2-runtime (Docker-friendly PID 1), and the Keymetrics SaaS arrived layer by layer. v7.0 in 2025-05 added Bun runtime support and inlined pm2-axon / pm2-io-agent to shrink supply-chain surface.</>,
    conceptsTitle: 'Process + config + persistence',
    conceptsDesc: <>pm2's CLI surface is small: start / stop / restart / reload / list / monit / logs / startup / save. Combine with ecosystem.config.js to declare "which apps, which env, how many instances," and deploys become <code>pm2 reload ecosystem.config.js --env production</code>.</>,
    whyDesc: <>Picking pm2 in 2026 for single-host Node isn't because it's the shiniest. It's because: <strong>writing a systemd unit per Node app is busywork</strong>, Docker / K8s is overkill for one API, forever is unmaintained, foreman is dev-oriented. pm2 fits the gap.</>,
    adoptersTitle: 'Who uses it',
    adoptersDesc: <>Almost every small-to-mid Node service that doesn't run K8s ships with pm2. IBM Cloud / DigitalOcean Node tutorials default to it. So does cuberoot.me's api.</>,
    cuberootDesc: <>cuberoot.me's <code>api.cuberoot.me</code> Hono service runs <code>pm2 start ecosystem.config.js</code> on the cloud VM — one app, fork mode, <code>pm2 startup</code> + <code>pm2 save</code> registered with systemd. Deploys run <code>pm2 reload cuberoot-api</code> for zero-downtime restart, logs go through pm2-logrotate (10MB roll / 14-day retention).</>,
    outlookTitle: 'Now and next',
    outlookDesc: <>v7.0 added Bun support, inlined pm2-axon / pm2-io-agent for a smaller supply chain, and shipped CVE fixes. The next phase is deeper systemd / OpenRC integration and auto-metrics for the Hono / Fastify generation of frameworks.</>,
  },
  heroStats: [
    { num: '7', unit: '.0.1', zh: <>当前稳定版 <em>2025-05-02 · v7.0.1</em></>, en: <>current stable <em>2025-05-02 · v7.0.1</em></> },
    { num: '13', unit: 'y', zh: <>从 2013 至今 <em>Node 守护事实标准</em></>, en: <>since 2013 <em>de facto Node supervisor</em></> },
    { num: '0', unit: 's', zh: <>graceful reload downtime <em>cluster mode</em></>, en: <>graceful reload downtime <em>cluster mode</em></> },
    { num: '40', unit: 'k★', zh: <>GitHub Unitech/pm2 <em>2026-05</em></>, en: <>GitHub Unitech/pm2 <em>2026-05</em></> },
  ],
  intro: {
    zh: (
      <>
        <p>pm2 2013-06-27 第一次发布到 npm, 作者 Alexandre Strzelewicz, 当时 Node 还在 0.10 时代。问题很具体:你在云 VM 上跑一个 <code>node app.js</code>, 它崩了就没了, 没人拉起来。社区有 forever、nodemon、supervisor 各自塞一块, 但都不太完整。Strzelewicz 把 "进程守护 + 自动重启 + 日志收集 + CLI" 一次性打包成 pm2, 起步就清楚地比对手好用。</p>
        <p>之后是一连串能力扩展。2014 cluster mode 上线 —— pm2 启动多个 Node worker, 走内置 round-robin LB, reload 时一个一个换不掉请求。2015 ecosystem.config.js 把 "几个 app、什么 env、几个 instance" 配置化, 部署变成一行 reload。2017 pm2-runtime 出来, 在容器里取代 daemon, 作为 PID 1 直接 exec (Docker 友好)。2020 年 Keymetrics 商业监控关停, OSS 继续走。</p>
        <p>2025-05 v7.0 / 7.0.1 是个比较大的 cut:Node 18+ baseline, <strong>加 Bun 运行时支持</strong>, 把 pm2-axon / pm2-io-agent 内化进 monorepo (减小供应链面 + 修一批 CVE)。本站 prod 跑的就是这版 (Node 22.22.3 + pm2 7.0.1 + ecosystem.config.js fork 单实例)。</p>
      </>
    ),
    en: (
      <>
        <p>pm2 first published to npm on 2013-06-27. Author: Alexandre Strzelewicz; Node was still at 0.10. The problem was concrete: you run <code>node app.js</code> on a cloud VM and when it crashes, nothing restarts it. The community had forever, nodemon, supervisor each covering a piece, but nothing felt complete. Strzelewicz packaged "process supervision + auto-restart + log capture + CLI" together as pm2 — meaningfully better than the alternatives from day one.</p>
        <p>What followed was a long capability ramp. 2014 added cluster mode — pm2 forks N Node workers with an internal round-robin LB, replacing them one at a time on reload without dropping requests. 2015 added ecosystem.config.js to declare "which apps, which env, which instance counts," reducing deploys to one reload command. 2017 brought pm2-runtime, which replaces the daemon fork inside containers as PID 1 (Docker-friendly). 2020 saw the Keymetrics monitoring SaaS shut down; OSS kept going.</p>
        <p>2025-05's v7.0 / 7.0.1 was a sizeable cut: Node 18+ baseline, <strong>added Bun runtime support</strong>, inlined pm2-axon / pm2-io-agent into the monorepo (smaller supply-chain surface + a wave of CVE fixes). This site's prod runs exactly this release (Node 22.22.3 + pm2 7.0.1 + an ecosystem.config.js with one fork-mode instance).</p>
      </>
    ),
  },
  history: [
    { year: '2013·06', zh: { title: <>v0.x — 首次 npm 发布</>, desc: <>Alexandre Strzelewicz 上传 pm2 0.x, 解决 "Node 进程崩了没人拉" 这一件事。CLI 起步就是 start / stop / restart / list 几个。</> }, en: { title: <>v0.x — first npm publish</>, desc: <>Alexandre Strzelewicz publishes pm2 0.x, solving the single problem of "Node crashed, nothing restarts it." Initial CLI is start / stop / restart / list.</> } },
    { year: '2014', zh: { title: <>Cluster 模式上线</>, desc: <>pm2 fork 多个 worker, 走 Node 内置 round-robin 负载均衡, reload 时一个一个换, 请求不掉。从此单机多核 Node 服务有了真正可用的方案。</> }, en: { title: <>Cluster mode lands</>, desc: <>pm2 forks N workers behind Node's built-in round-robin balancer; reload swaps workers one at a time, no dropped requests. Single-host multi-core Node services finally had a real answer.</> } },
    { year: '2014·09', zh: { title: <>Keymetrics SaaS</>, desc: <>Unitech 推出 Keymetrics, 把 pm2 进程的指标 (CPU / mem / latency) 上送到一个 web 监控面板。OSS pm2 留下钩子。</> }, en: { title: <>Keymetrics SaaS</>, desc: <>Unitech launches Keymetrics, streaming pm2 process metrics (CPU / mem / latency) to a hosted web dashboard. OSS pm2 keeps the hooks.</> } },
    { year: '2015', zh: { title: <>ecosystem.config.js</>, desc: <>声明式配置文件:把 "几个 app、各自 script、env、instance 数" 写一份, 部署就是 <code>pm2 reload ecosystem.config.js</code>。多 app 多 env 终于不靠脚本拼。</> }, en: { title: <>ecosystem.config.js</>, desc: <>Declarative config: "which apps, which scripts, which envs, how many instances" live in one file; a deploy becomes <code>pm2 reload ecosystem.config.js</code>. No more multi-app shell glue.</> } },
    { year: '2017', zh: { title: <>pm2-runtime</>, desc: <>Docker-友好版:不 fork daemon, 直接作为 PID 1 在容器里 exec Node。容器化部署的标准入口点。</> }, en: { title: <>pm2-runtime</>, desc: <>The Docker-friendly variant: no daemon fork, run as PID 1 inside the container and exec Node directly. The default entrypoint for containerized deploys.</> } },
    { year: '2020', zh: { title: <>Keymetrics 监控关停</>, desc: <>Unitech 关掉 Keymetrics 商业 SaaS, 转回 OSS 与企业自托管。CLI / 模块全部留下, 没有断供。</> }, en: { title: <>Keymetrics monitoring shuts down</>, desc: <>Unitech retires the Keymetrics SaaS, pivots to OSS and self-hosted enterprise. The CLI / modules continue uninterrupted.</> } },
    { year: '2023·04', zh: { title: <>v5.0 — 现代化内核</>, desc: <>内部代码大整, Node 16+ baseline。pm2-logrotate / pm2 monit / pm2 deploy 三个核心模块同步升级。</> }, en: { title: <>v5.0 — modernized internals</>, desc: <>Significant internal cleanup, Node 16+ baseline. pm2-logrotate / pm2 monit / pm2 deploy refreshed in lockstep.</> } },
    { year: '2024', zh: { title: <>v6.x</>, desc: <>Node 18+ baseline, pm2-logrotate 稳定性显著改善 —— 之前在高 QPS 下偶尔丢一段日志的 bug 修了。</> }, en: { title: <>v6.x</>, desc: <>Node 18+ baseline; pm2-logrotate stability meaningfully improves — a long-standing "lose a log segment under high QPS" bug finally closed.</> } },
    { year: '2025·05', highlight: true, zh: { title: <>v7.0 / 7.0.1</>, desc: <>Node 18+ baseline、<strong>加 Bun runtime 支持</strong>、内化 pm2-axon / pm2-io-agent 减小供应链面、修一批 CVE。本站 prod 就跑这版。</> }, en: { title: <>v7.0 / 7.0.1</>, desc: <>Node 18+ baseline, <strong>added Bun runtime support</strong>, inlined pm2-axon / pm2-io-agent to shrink supply-chain surface, plus a CVE-fix wave. This is what cuberoot.me's prod runs.</> } },
    { year: '2026·05', highlight: true, zh: { title: <>当前稳定 v7.0.1</>, desc: <>7.0.1 是本年最广泛部署的稳定版本。GitHub Unitech/pm2 ~40k star, npm 周下载 ~150 万。单机 Node 守护这条路上没有同量级对手。</> }, en: { title: <>Current stable v7.0.1</>, desc: <>7.0.1 is the most widely deployed stable in 2026. ~40k stars on GitHub (Unitech/pm2), ~1.5M weekly downloads on npm. No comparable competitor for single-host Node supervision.</> } },
  ],
  concepts: [
    { tag: 'A', zh: { title: <>start + 守护</>, desc: <><code>pm2 start app.js --name myapp</code> 把进程托管, 崩了自动重启 (默认无限次, 可设上限和退避)。</> }, en: { title: <>start + supervise</>, desc: <><code>pm2 start app.js --name myapp</code> hands the process to pm2; it auto-restarts on crash (infinite by default, with configurable caps and backoff).</> }, code: <code>$ {f('pm2')} start dist/index.js --name cuberoot-api{'\n'}$ {f('pm2')} list{'\n'}{c('// PID, uptime, mem, status')}</code> },
    { tag: 'B', zh: { title: <>fork vs cluster</>, desc: <>fork = 单进程, cluster = 多进程 + Node 内置 round-robin。单机单核 / IO 重的 API 用 fork 就够, 算力密集才上 cluster。</> }, en: { title: <>fork vs cluster</>, desc: <>fork = single process. cluster = N processes behind Node's round-robin balancer. IO-bound single-core APIs are fine on fork; CPU-bound services use cluster.</> }, code: <code>{'{'}{'\n'}  {p('name')}: {s('"cuberoot-api"')},{'\n'}  {p('script')}: {s('"dist/index.js"')},{'\n'}  {p('exec_mode')}: {s('"fork"')},  {c('// or "cluster"')}{'\n'}  {p('instances')}: {n('1')}{'\n'}{'}'}</code> },
    { tag: 'C', zh: { title: <>graceful reload</>, desc: <>cluster 模式下 <code>pm2 reload</code> 一个 worker 一个 worker 替换, 新 worker ready 后才杀老 worker。零 downtime 部署的标准做法。</> }, en: { title: <>Graceful reload</>, desc: <>Under cluster mode, <code>pm2 reload</code> replaces workers one at a time — a new worker takes traffic before the old one is killed. The textbook zero-downtime deploy.</> }, code: <code>$ {f('pm2')} reload cuberoot-api{'\n'}{c('// rolling restart, no dropped requests')}</code> },
    { tag: 'D', zh: { title: <>startup + save</>, desc: <><code>pm2 startup</code> 在 systemd 注册一个 unit, <code>pm2 save</code> 把当前进程表 dump 到 <code>~/.pm2/dump.pm2</code>。reboot 后 unit 拉起 pm2-runtime, 进程表全部恢复。</> }, en: { title: <>startup + save</>, desc: <><code>pm2 startup</code> registers a systemd unit; <code>pm2 save</code> dumps the current process list to <code>~/.pm2/dump.pm2</code>. After reboot, the unit starts pm2-runtime and the process list is restored.</> }, code: <code>$ {f('pm2')} startup systemd{'\n'}$ {f('pm2')} save{'\n'}{c('// systemd: pm2-root.service')}</code> },
    { tag: 'E', zh: { title: <>ecosystem.config.js</>, desc: <>声明式配置文件, 写 apps 数组。<code>pm2 reload ecosystem.config.js --env production</code> 一行命令落 prod 配置。</> }, en: { title: <>ecosystem.config.js</>, desc: <>Declarative config — an apps array. <code>pm2 reload ecosystem.config.js --env production</code> rolls out prod config in one command.</> }, code: <code>{f('module')}.{p('exports')} = {'{'}{'\n'}  {p('apps')}: [{'{'}{'\n'}    {p('name')}: {s('"cuberoot-api"')},{'\n'}    {p('script')}: {s('"dist/index.js"')},{'\n'}    {p('env_production')}: {'{ '}{p('NODE_ENV')}: {s('"production"')} {'}'}{'\n'}  {'}'}]{'\n'}{'}'};</code> },
    { tag: 'F', zh: { title: <>pm2-logrotate</>, desc: <>pm2 module, 装一次 <code>pm2 install pm2-logrotate</code> 就在每个 app 的 out/err 日志上挂滚动。本站配 10MB / 14 天 / gzip。</> }, en: { title: <>pm2-logrotate</>, desc: <>A pm2 module — <code>pm2 install pm2-logrotate</code> once and every app's out/err logs get rotated. This site uses 10MB / 14 days / gzip.</> }, code: <code>$ {f('pm2')} install pm2-logrotate{'\n'}$ {f('pm2')} set pm2-logrotate:max_size 10M{'\n'}$ {f('pm2')} set pm2-logrotate:retain {n('14')}</code> },
    { tag: 'G', zh: { title: <>pm2 monit / logs</>, desc: <><code>pm2 monit</code> 是个终端 TUI, 显示每个 app CPU / mem / latency。<code>pm2 logs cuberoot-api --lines 200</code> 拼 out + err 实时 tail。</> }, en: { title: <>pm2 monit / logs</>, desc: <><code>pm2 monit</code> is a TUI showing each app's CPU / mem / latency. <code>pm2 logs cuberoot-api --lines 200</code> tails out + err merged.</> }, code: <code>$ {f('pm2')} monit{'\n'}$ {f('pm2')} logs cuberoot-api --lines {n('200')}</code> },
    { tag: 'H', zh: { title: <>reload vs restart</>, desc: <>restart = 杀进程再起新的 (会断), reload = cluster 下一个一个换 (不断)。fork 模式下两者等价。</> }, en: { title: <>reload vs restart</>, desc: <>restart = kill + spawn (brief downtime). reload = rolling worker swap under cluster (no downtime). Under fork mode they're equivalent.</> }, code: <code>$ {f('pm2')} restart cuberoot-api  {c('// kills + respawns')}{'\n'}$ {f('pm2')} reload cuberoot-api   {c('// rolling (cluster)')}</code> },
  ],
  whyCards: [
    { icon: '⚙', zh: { title: <>systemd 一 unit 一服务太繁琐</>, desc: <>每个 Node app 写一个 .service 文件 + 日志方向 + reload 信号 + env file, 写一次还行, 三个 app 就开始翻文档。pm2 把这些拍扁成一个 CLI。</> }, en: { title: <>One systemd unit per service is busywork</>, desc: <>Per-app .service file + log direction + reload signal + env file is workable once, painful at three apps. pm2 flattens it into a single CLI.</> }, code: <>$ {f('pm2')} start ecosystem.config.js</> },
    { icon: '⌬', zh: { title: <>Docker 对单机一个 API 太重</>, desc: <>K8s / 容器编排是真的对单台 VM 跑一个 Hono 服务过头了。pm2 直接跑在主机上, 不引入额外的镜像、网络、卷层。</> }, en: { title: <>Docker is overkill for one API on one box</>, desc: <>K8s / container orchestration is genuinely too much for a single Hono service on one VM. pm2 runs straight on the host with no image / network / volume layer to manage.</> }, code: <>{c('// no Dockerfile, no compose')}{'\n'}{c('// just pm2 start')}</> },
    { icon: '⌁', zh: { title: <>cluster reload 零 downtime</>, desc: <>多 worker 一个一个替换是部署 Node 服务最低成本的零 downtime 方案。比起 nginx + 蓝绿轻得多。</> }, en: { title: <>Cluster reload is zero-downtime</>, desc: <>Rolling worker replacement is the cheapest zero-downtime deploy for a Node service. Much lighter than nginx + blue/green.</> }, code: <>$ {f('pm2')} reload cuberoot-api</> },
    { icon: '⌖', zh: { title: <>开机持久化自动化</>, desc: <><code>pm2 startup</code> + <code>pm2 save</code> 两行命令, 服务器重启后所有 app 自动回来。手写 systemd unit 要为每个 app 单独配。</> }, en: { title: <>Boot persistence in two commands</>, desc: <><code>pm2 startup</code> + <code>pm2 save</code> and reboots auto-restore every app. Hand-written systemd units require one per service.</> }, code: <>$ {f('pm2')} startup systemd{'\n'}$ {f('pm2')} save</> },
    { icon: '⌗', zh: { title: <>日志轮转开箱</>, desc: <>pm2-logrotate 是个一行装的 module, 配 max_size / retain / gzip 三个 key 就完事。logrotate.d 那一套写 conf 不需要再碰。</> }, en: { title: <>Log rotation out of the box</>, desc: <>pm2-logrotate is a one-line install. Three keys (max_size / retain / gzip) and you're done. No more logrotate.d conf files.</> }, code: <>$ {f('pm2')} install pm2-logrotate</> },
    { icon: '⏚', zh: { title: <>诊断命令直觉化</>, desc: <><code>pm2 list / monit / logs / show app</code> 是 sysadmin 最快记住的一组命令。新人接手一个 Node 服务, 半小时就能上手运维。</> }, en: { title: <>Diagnostic commands are intuitive</>, desc: <><code>pm2 list / monit / logs / show app</code> is the fastest set of sysadmin commands to memorize. A newcomer can run ops on a Node service in half an hour.</> }, code: <>$ {f('pm2')} show cuberoot-api</> },
    { icon: '⛯', zh: { title: <>v7.0 加 Bun 支持</>, desc: <>2025-05 起 pm2 能托管 Bun 进程, interpreter 写 <code>bun</code> 就行。Node → Bun 迁移路径上, pm2 不再是阻塞点。</> }, en: { title: <>v7.0 added Bun support</>, desc: <>Since 2025-05 pm2 can supervise Bun processes — set the interpreter to <code>bun</code>. pm2 is no longer a blocker on the Node → Bun migration path.</> }, code: <>{'{ '}{p('interpreter')}: {s('"bun"')} {'}'}</> },
    { icon: '⚐', zh: { title: <>--watch (dev)</>, desc: <>dev 阶段 <code>pm2 start --watch</code> 文件改动自动重启。和 Node 22 内建的 <code>--watch</code> 重叠, 但 pm2 这个能套整套 ecosystem.config.js。</> }, en: { title: <>--watch (dev)</>, desc: <>In dev, <code>pm2 start --watch</code> auto-restarts on file change. Overlaps with Node 22's built-in <code>--watch</code>, but pm2's variant covers the whole ecosystem.config.js.</> }, code: <>$ {f('pm2')} start ecosystem.config.js --watch</> },
  ],
  adopters: [
    { name: 'IBM Cloud · Node 教程', href: 'https://www.ibm.com/cloud', highlight: true, zhNote: '官方 Node 部署教程默认 pm2', enNote: 'Official Node deploy tutorials default to pm2' },
    { name: 'DigitalOcean · Node 文档', href: 'https://www.digitalocean.com', highlight: true, zhNote: 'Droplet 部署 Node 服务文档全用 pm2', enNote: 'Droplet Node deployment guides all use pm2' },
    { name: 'Strapi (Headless CMS)', href: 'https://strapi.io', zhNote: '自托管部署官方推荐 pm2', enNote: 'Self-hosted deploy officially recommends pm2' },
    { name: 'Ghost (publishing)', href: 'https://ghost.org', zhNote: '自托管节点用 pm2 / systemd 二选一', enNote: 'Self-hosted nodes use pm2 or systemd' },
    { name: 'Express / Koa / Fastify 教程', zhNote: '入门到部署章节几乎一边倒选 pm2', enNote: 'Tutorials from getting-started to deploy mostly pick pm2' },
    { name: 'Discourse 论坛迁移指引', zhNote: '非容器化 Node 部署示例', enNote: 'Reference for non-containerized Node deploys' },
    { name: 'n8n (workflow automation)', href: 'https://n8n.io', highlight: true, zhNote: '自托管模式官方文档推 pm2', enNote: 'Self-hosted docs recommend pm2' },
    { name: 'NocoDB', href: 'https://nocodb.com', zhNote: '裸金属部署示例文档', enNote: 'Bare-metal deploy reference docs' },
    { name: 'MeiliSearch Node 客户端服务', zhNote: '客户端中间层教程标配 pm2', enNote: 'Client middleware tutorials use pm2 by default' },
    { name: 'Directus', href: 'https://directus.io', zhNote: '自托管模式 prod 推荐', enNote: 'Self-hosted prod recommendation' },
    { name: 'Outline (wiki)', href: 'https://www.getoutline.com', zhNote: '非 Docker 部署路径主要靠 pm2', enNote: 'Primary non-Docker deploy uses pm2' },
    { name: 'cuberoot.me', highlight: true, zhNote: '本站 api.cuberoot.me Hono 服务 fork 模式守住', enNote: 'This site — api.cuberoot.me Hono service supervised in fork mode' },
  ],
  outlook: [
    { tag: <>HOT · v7.0</>, hot: true, big: true, zh: { title: <>v7.0 是单机 Node 部署当前的天花板</>, body: <><p>v7.0 / 7.0.1 把 Node 18+ baseline 锁死, 加 Bun runtime 支持, 内化 pm2-axon / pm2-io-agent 减小供应链面, 修一批 CVE。<strong>装这一版基本就到位了</strong>, 没有什么明显的下一步必装项。</p><p>升级摩擦低:本站从 v5 → v7 几乎只动 ecosystem.config.js 字段名 (老的 cwd / instance_var 兼容着, 但要按 v7 风格写)。配 pm2-logrotate 三个 key 就把日志运维做完。</p></> }, en: { title: <>v7.0 is the ceiling for single-host Node deploy right now</>, body: <><p>v7.0 / 7.0.1 locks the Node 18+ baseline, adds Bun runtime support, inlines pm2-axon / pm2-io-agent to shrink supply chain, and ships a CVE-fix wave. <strong>Installing this release is essentially feature-complete</strong> — no obvious next must-have.</p><p>Upgrade friction is low: this site went v5 → v7 by mostly renaming ecosystem.config.js fields (old cwd / instance_var still compatible, but v7-style is preferred). Three pm2-logrotate keys finish log ops.</p></> } },
    { tag: 'BUN', zh: { title: <>Bun runtime 支持</>, body: <><p>v7 起 pm2 可以托管 Bun 进程, ecosystem.config.js 写 <code>interpreter: "bun"</code> 就行。这是 pm2 把自己从 "Node 守护" 扩成 "JS 运行时守护" 的关键一步, 给 Bun 迁移路径留了门。</p></> }, en: { title: <>Bun runtime support</>, body: <><p>From v7 pm2 can supervise Bun processes — set <code>interpreter: "bun"</code> in ecosystem.config.js. This is pm2 evolving from "Node supervisor" to "JS runtime supervisor," keeping the door open for Bun migrations.</p></> } },
    { tag: 'COMPETITION', zh: { title: <>systemd / Docker 各占一边, pm2 守中间</>, body: <><p>对面两个方向都没死:严肃企业部署在走 K8s, 极简 OS 服务在走 systemd unit + journal。pm2 的位置是<strong>中小 Node 服务、单机自托管</strong>这一段, 在这一段它仍然是最低摩擦的选择。</p></> }, en: { title: <>systemd / Docker on each side, pm2 owns the middle</>, body: <><p>Neither side is dying: serious enterprise deploys lean on K8s, minimal-OS services lean on systemd units + journal. pm2's niche is <strong>small-to-mid Node services on a single self-hosted box</strong> — there it remains the lowest-friction option.</p></> } },
    { tag: <>SECURITY</>, zh: { title: <>供应链面在收窄</>, body: <><p>v7 把 pm2-axon / pm2-io-agent 内化进 monorepo, 单独 npm 依赖少一截, 同时把过去几年攒的 CVE 一次清掉。对 prod 部署是个明确利好。</p></> }, en: { title: <>Supply-chain surface is shrinking</>, body: <><p>v7 inlines pm2-axon / pm2-io-agent into the monorepo, cutting standalone npm deps and clearing a queue of CVEs from previous years in one pass. A clear win for prod deploys.</p></> } },
    { tag: <>DATA</>, zh: { title: <>40k★ + npm 周下载 150 万</>, body: <><p>2026-05 数据:Unitech/pm2 GitHub ~40k star, npm 周下载 ~150 万包。单机 Node 这条赛道, pm2 没有同量级竞品, 这个数字十几年一直稳。</p></> }, en: { title: <>40k★ + 1.5M weekly npm downloads</>, body: <><p>2026-05 numbers: ~40k stars on Unitech/pm2 on GitHub, ~1.5M weekly downloads on npm. On the single-host Node track, pm2 has no peer-scale competitor — and that figure has been stable for over a decade.</p></> } },
  ],
  cuberoot: {
    zh: (
      <>
        <p>cuberoot.me 在云 VM 上用 pm2 7.0.1 托管<strong>一个 app — <code>cuberoot-api</code></strong>, exec_mode 是 fork (不 cluster), instances 1。script 指向 <code>dist/index.js</code> (Hono server <code>tsc</code> 编译输出), interpreter 是 Node 22.22.3。整个进程监听 127.0.0.1:3001, nginx 反代 <code>api.cuberoot.me</code> 进来。fork 模式选择是因为 Hono + Node 22 在一颗 vCPU 上的 IO-bound 容量远远没满, 上 cluster 反而引入 worker 间状态一致性的麻烦。</p>
        <p>ecosystem.config.js 是声明式的真相源:<code>{'{'} name: "cuberoot-api", script: "dist/index.js", exec_mode: "fork", instances: 1, env_production: {'{'} NODE_ENV: "production", PORT: 3001 {'}'} {'}'}</code>。env 文件 (含 DB 密码 / WCA OAuth secret / ADMIN_API_KEY) 走 systemd EnvironmentFile, pm2 不参与 secret 处理。</p>
        <p>开机持久化走 <code>pm2 startup systemd</code> + <code>pm2 save</code>。这条命令在 <code>/etc/systemd/system/pm2-root.service</code> 写一个 unit, 上面挂 pm2-runtime。服务器 reboot 时 systemd 启动这个 unit, pm2 从 <code>~/.pm2/dump.pm2</code> 把 app 列表反序列化回来, <code>cuberoot-api</code> 自动起。这套不需要再为单个 app 写 systemd unit。</p>
        <p>部署流程:GitHub Actions build 完 scp <code>dist/</code> 到 VM, ssh 跑 <code>pm2 reload cuberoot-api --update-env</code>。fork 模式下 reload 等价 restart, 中间 200~300ms 的微 downtime nginx 兜底 5xx → retry。日志走 pm2-logrotate:max_size 10MB、retain 14、gzip 开启、轮转 cron <code>0 0 * * *</code>。日志文件路径 <code>~/.pm2/logs/cuberoot-api-{'{'}out,err{'}'}.log</code>, 调试时 <code>pm2 logs cuberoot-api --lines 500</code> 实时 tail, <code>pm2 monit</code> 看 CPU / mem 占用。</p>
      </>
    ),
    en: (
      <>
        <p>cuberoot.me uses pm2 7.0.1 on the cloud VM to supervise <strong>one app — <code>cuberoot-api</code></strong>: exec_mode fork (no cluster), instances 1. The script points at <code>dist/index.js</code> (the Hono server's <code>tsc</code> output) and the interpreter is Node 22.22.3. The process binds 127.0.0.1:3001 with nginx fronting <code>api.cuberoot.me</code>. Fork mode is intentional — Hono + Node 22 on one vCPU is nowhere near the IO-bound ceiling, and cluster would introduce cross-worker state issues for no perf win.</p>
        <p>ecosystem.config.js is the declarative source of truth: <code>{'{'} name: "cuberoot-api", script: "dist/index.js", exec_mode: "fork", instances: 1, env_production: {'{'} NODE_ENV: "production", PORT: 3001 {'}'} {'}'}</code>. The env file (DB password, WCA OAuth secret, ADMIN_API_KEY) lives in a systemd EnvironmentFile — pm2 isn't in the secret path.</p>
        <p>Boot persistence runs through <code>pm2 startup systemd</code> + <code>pm2 save</code>. That writes a unit at <code>/etc/systemd/system/pm2-root.service</code> that wraps pm2-runtime. On reboot, systemd starts the unit, pm2 deserializes the app list from <code>~/.pm2/dump.pm2</code>, and <code>cuberoot-api</code> comes back automatically — no per-app systemd unit needed.</p>
        <p>Deploy: GitHub Actions builds, scps <code>dist/</code> to the VM, then ssh runs <code>pm2 reload cuberoot-api --update-env</code>. Under fork mode reload is effectively restart, with a 200–300ms blip covered by nginx 5xx → retry. Logs go through pm2-logrotate (max_size 10MB, retain 14, gzip on, cron <code>0 0 * * *</code>). The log files live at <code>~/.pm2/logs/cuberoot-api-{'{'}out,err{'}'}.log</code>; <code>pm2 logs cuberoot-api --lines 500</code> tails them live and <code>pm2 monit</code> shows CPU / mem.</p>
      </>
    ),
  },
  links: [
    { label: 'pm2.keymetrics.io', href: 'https://pm2.keymetrics.io' },
    { label: 'GitHub · Unitech/pm2', href: 'https://github.com/Unitech/pm2' },
    { label: 'v7.0 release notes', href: 'https://github.com/Unitech/pm2/releases/tag/v7.0.0' },
    { label: 'Ecosystem file reference', href: 'https://pm2.keymetrics.io/docs/usage/application-declaration/' },
    { label: 'Startup hook (systemd)', href: 'https://pm2.keymetrics.io/docs/usage/startup/' },
  ],
};

export default PM2;
