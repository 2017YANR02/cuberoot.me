import type { StackTool } from '../_lib/stack_tool_types';
import { k, v, s, n, f, p, c } from '../_lib/stack_tool_types';

// ─── systemd 260 ────────────────────────────────────────────────────────────

export const SYSTEMD: StackTool = {
  slug: 'systemd',
  name: 'systemd',
  version: '260',
  since: '2010-03',
  group: 'backend',
  accent: '#30D475',
  bright: '#5EE89C',
  glyph: '⌬',
  floats: ['PID 1', '.service', '.timer', '.socket', '.mount', 'journald', 'logind', 'networkd', 'resolved', 'systemctl', 'journalctl', 'unit', 'cgroup'],
  zh: {
    tagline: 'PID 1 + 服务管理 + 日志 + 定时器',
    role: '云服务器上跑 cuberoot.me 整套后端: nginx、pm2、pg-dump 备份、acme.sh 续证全是 systemd unit。',
    heroSub: <>Linux 启动后第一个跑的进程, 也是几乎所有后台服务的爹。把 SysV init 那一堆 shell 脚本换成<strong>声明式 unit 文件</strong>, 顺手把日志、定时任务、网络配置、cgroup 资源限制全装进同一棵进程树。Lennart Poettering 2010 年在 Red Hat 抛出这一脚, 十六年后, 主流 Linux 发行版几乎没有不用它的。</>,
    whatDesc: <>systemd 不是单纯的 init, 而是一组共用 D-Bus / cgroup / unit 模型的系统组件:<strong>PID 1</strong> 拉服务, <strong>journald</strong> 收日志, <strong>timer</strong> 替代 cron, <strong>networkd / resolved</strong> 管网络, <strong>logind</strong> 管登录会话。统一的 unit 配置 + <code>systemctl</code> 一个命令面板, 让运维心智从"哪个脚本在哪个目录"变成"哪个 unit 处于什么状态"。</>,
    historyDesc: <>2010 年从 "Rethinking PID 1" 那篇博客起步, 2011 年 Fedora 第一个默认启用。2014 年 Debian 那场"要不要切 systemd"的辩论是 Linux 社区近十年最激烈的一次。打完之后 Debian 8、Ubuntu 15.04、RHEL 7、Arch、SUSE 全跟上。现在 "Linux 服务器" 和 "systemd" 基本是同义词。</>,
    conceptsTitle: 'Unit + systemctl 核心',
    conceptsDesc: <>所有可被 systemd 管的东西都叫 <strong>unit</strong>: service / socket / timer / mount / path / target 六种最常用。配置是 ini 风格的纯文本, <code>systemctl</code> 是统一的查询 + 控制入口。</>,
    whyDesc: <>2026 年还在用 systemd, 不是因为它"最小巧", 而是因为它把<strong>服务管理 + 日志 + 定时 + 资源隔离 + 网络</strong>五件事用同一套模型做了, 运维只学一遍, 不必再背 init.d / cron / syslog / iptables 各自的命令。</>,
    adoptersTitle: '谁在用',
    adoptersDesc: <>除了 Alpine / Void / Gentoo 这几个故意不用的, 主流 Linux 发行版几乎清一色 systemd。云厂商默认镜像、嵌入式 Linux 设备、车载 Linux 大多走这一套。</>,
    cuberootDesc: <>cuberoot.me 的云服务器整台都靠 systemd 拉起来。nginx 作为 <code>nginx.service</code> 被它看着, pm2 自己又通过 <code>pm2 startup</code> 装成一个 systemd unit 进而托管 Hono。<code>pg-dump-recon.timer</code> 每天 03:00 UTC 触发一次, 把 PG dump 落到 <code>/root/archive/</code>, 留 30 天。acme.sh 的证书续期也走 systemd timer, 不用 cron。机器一出问题, 第一个命令就是 <code>journalctl -u xxx -f</code>。</>,
    outlookTitle: '当下与前景',
    outlookDesc: <>systemd 260 刚把 SysV 兼容代码彻底删干净, kernel 最低支持上抬到 5.10。后面的路线是把更多原本散在第三方的东西 (sysext / confext / homed / portabled) 也整合进同一套 unit 抽象。container / VM 边界继续模糊, "一个 host 跑一堆轻量 namespace" 是默认范式。</>,
  },
  en: {
    tagline: 'PID 1 + service manager + journal + timers',
    role: 'Runs the whole cuberoot.me VM — nginx, pm2, the pg-dump backup, and acme.sh renewals are all systemd units.',
    heroSub: <>The first process Linux starts at boot, and the parent of nearly every background service. Replace the SysV init shell jungle with <strong>declarative unit files</strong>, then fold logging, timers, network config, and cgroup resource limits into the same process tree. Lennart Poettering shipped that idea at Red Hat in 2010; sixteen years later, nearly every mainstream Linux distro runs it.</>,
    whatDesc: <>systemd isn't just an init — it's a family of components sharing one D-Bus / cgroup / unit model: <strong>PID 1</strong> brings up services, <strong>journald</strong> captures logs, <strong>timers</strong> replace cron, <strong>networkd / resolved</strong> handle networking, <strong>logind</strong> tracks sessions. One unit file format + one <code>systemctl</code> control plane turns ops from "which script lives in which directory" into "what state is this unit in."</>,
    historyDesc: <>The story starts with the 2010 "Rethinking PID 1" blog post; Fedora was the first to default to it in 2011. Debian's 2014 init-system debate over whether to adopt systemd was the loudest Linux community fight of the decade. Once it settled, Debian 8, Ubuntu 15.04, RHEL 7, Arch, and SUSE all followed. Today "Linux server" and "systemd" are roughly synonymous.</>,
    conceptsTitle: 'Units + systemctl core',
    conceptsDesc: <>Everything systemd manages is a <strong>unit</strong>: service / socket / timer / mount / path / target are the common six. Configuration is plain ini-style text; <code>systemctl</code> is the single query + control entry point.</>,
    whyDesc: <>Still using systemd in 2026 isn't because it's "minimal" — it's because <strong>service management + logging + scheduling + resource isolation + networking</strong> all share one model. Ops learns it once instead of memorizing init.d / cron / syslog / iptables separately.</>,
    adoptersTitle: 'Who uses it',
    adoptersDesc: <>Apart from Alpine / Void / Gentoo, which deliberately opt out, mainstream Linux distros run systemd uniformly. Cloud provider default images, embedded Linux devices, and automotive Linux mostly ride the same stack.</>,
    cuberootDesc: <>The cuberoot.me VM is brought up entirely by systemd. nginx runs as <code>nginx.service</code>, and pm2 — installed via <code>pm2 startup</code> — is itself a systemd unit that in turn supervises the Hono server. <code>pg-dump-recon.timer</code> fires daily at 03:00 UTC, dumping PG into <code>/root/archive/</code> with 30-day retention. acme.sh certificate renewals also ride a systemd timer rather than cron. When anything misbehaves, the first command typed is <code>journalctl -u xxx -f</code>.</>,
    outlookTitle: 'Now and next',
    outlookDesc: <>systemd 260 just removed the last SysV compat code and raised the minimum kernel to 5.10. The roadmap keeps absorbing things that used to live in third-party tools (sysext / confext / homed / portabled) into the same unit abstraction. The container / VM boundary continues to blur; "one host runs a swarm of lightweight namespaces" is now the default pattern.</>,
  },
  heroStats: [
    { num: '260', zh: <>当前稳定版 <em>2026-03 · systemd 260</em></>, en: <>current stable <em>2026-03 · systemd 260</em></>
    },
    { num: '16', unit: 'y', zh: <>从 2010 至今 <em>主流 Linux 发行版默认 init</em></>, en: <>since 2010 <em>default init across mainstream distros</em></>
    },
    { num: '#1', zh: <>Linux init 系统市占 <em>主流发行版几乎全用</em></>, en: <>Linux init by share <em>basically every mainstream distro</em></>
    },
    { num: '6', zh: <>主流 unit 类型 <em>service / socket / timer / mount / path / target</em></>, en: <>common unit types <em>service / socket / timer / mount / path / target</em></>
    },
  ],
  intro: {
    zh: (
      <>
        <p>systemd 起源于 2010 年 4 月 Lennart Poettering 在 Red Hat 写的一篇博客 "Rethinking PID 1"。他当时已经因为 PulseAudio / Avahi 出过名, 这次想解决的是 Linux 启动那一堆 SysV init shell 脚本: 串行、依赖关系藏在脚本注释里、出错了只能 <code>cat /var/log/messages</code> 翻。设想很直接: 把 init 重写成一个能<strong>并行拉服务、用声明式配置、能跑事件循环</strong>的 PID 1, 顺手把日志和定时也接管了。</p>
        <p>2011 年 Fedora 15 第一个默认启用 systemd, 替掉了 Upstart。这之后是几年大规模社区争吵 —— 2014 年 Debian 那场"切不切 systemd"的投票是 Linux 近十年最激烈的辩论之一, 持反对意见的 Devuan 等分叉至今还活着, 但主流 Debian 8 (2015)、Ubuntu 15.04、RHEL 7、Arch、SUSE 全切了过来。</p>
        <p>Poettering 2022 年 9 月从 Red Hat 跳去 Microsoft 继续做 systemd, Kay Sievers 这边一直在维护底层组件。版本号在 2018 年前后切到纯数字 (一年一个大版本), 现在 (2026-03) 是 260, 把 SysV service 脚本兼容代码全删了 —— 16 年过去, 这层兼容终于不需要了。</p>
      </>
    ),
    en: (
      <>
        <p>systemd started as an April 2010 blog post by Lennart Poettering at Red Hat — "Rethinking PID 1." He was already known for PulseAudio and Avahi; this time the target was the SysV init shell jungle that handled Linux boot: serial execution, dependencies hidden in script comments, and "<code>cat /var/log/messages</code>" as the debugging tool. The proposal was direct: rewrite init as a PID 1 that <strong>brings services up in parallel, takes declarative config, and runs an event loop</strong>, while also subsuming logging and scheduling.</p>
        <p>Fedora 15 (2011) was the first to default to systemd, displacing Upstart. The next few years were a community brawl — Debian's 2014 vote on whether to switch was the loudest Linux argument of the decade. The Devuan fork still exists, but mainstream Debian 8 (2015), Ubuntu 15.04, RHEL 7, Arch, and SUSE all moved over.</p>
        <p>Poettering moved from Red Hat to Microsoft in September 2022 and kept working on systemd; Kay Sievers stayed on the lower-level components. The version scheme switched to plain integers around 2018 (one major a year). As of 2026-03 it's at 260, which finally removed the SysV service-script compatibility code — sixteen years on, that compat layer is no longer needed.</p>
      </>
    ),
  },
  history: [
    { year: '2010·04', zh: { title: <>"Rethinking PID 1"</>, desc: <>Lennart Poettering 在 Red Hat 发博客, 把 SysV init 串行 + shell 脚本 + 隐式依赖的问题摊开, 抛出并行 + 声明式 + 事件循环的新设计。Kay Sievers 同期参与。</> }, en: { title: <>"Rethinking PID 1"</>, desc: <>Lennart Poettering's Red Hat blog post lays out the SysV init pain — serial boot, shell scripts, implicit deps — and proposes a parallel, declarative, event-loop-driven replacement. Kay Sievers joins in parallel.</> } },
    { year: '2011·05', zh: { title: <>Fedora 15 默认启用</>, desc: <>Fedora 第一个主流发行版把 systemd 设为默认 init, 替掉 Upstart。并行启动让冷启动时间立刻降一档, 外界开始认真看待这个项目。</> }, en: { title: <>Fedora 15 ships it by default</>, desc: <>Fedora becomes the first mainstream distro to default to systemd, displacing Upstart. Parallel boot cuts cold-start time noticeably; the outside world starts taking it seriously.</> } },
    { year: '2012·09', zh: { title: <>journald 落地</>, desc: <>systemd-journald 接管系统日志, 结构化 + 索引 + 二进制存储, <code>journalctl</code> 替代翻 <code>/var/log/messages</code> 的工作流。</> }, en: { title: <>journald lands</>, desc: <>systemd-journald takes over system logging — structured, indexed, binary storage. <code>journalctl</code> replaces grepping through <code>/var/log/messages</code>.</> } },
    { year: '2014·02', zh: { title: <>Debian init 之战</>, desc: <>Debian Technical Committee 投票决定下一代默认 init。最终 systemd 8:7 险胜 Upstart。Devuan 等反对派分叉出去。</> }, en: { title: <>The Debian init war</>, desc: <>Debian's Technical Committee votes on the next default init. systemd wins 8:7 over Upstart. The Devuan fork emerges from the dissent.</> } },
    { year: '2014·12', zh: { title: <>RHEL 7 + Debian 8</>, desc: <>RHEL 7 (12 月) + 即将到来的 Debian 8 (Jessie) 都切到 systemd。企业 Linux 这条线正式定调。</> }, en: { title: <>RHEL 7 + Debian 8</>, desc: <>RHEL 7 (December) and the imminent Debian 8 (Jessie) both adopt systemd. The enterprise Linux line is set.</> } },
    { year: '2015·04', zh: { title: <>Ubuntu 15.04 切换</>, desc: <>Ubuntu 从自家 Upstart 切到 systemd。Canonical 自此把精力从 init 重新投回上层应用。</> }, en: { title: <>Ubuntu 15.04 switches</>, desc: <>Ubuntu drops its in-house Upstart for systemd. Canonical redirects effort from init back into higher layers.</> } },
    { year: '2016·07', zh: { title: <>v231 — 大版本号时代</>, desc: <>版本号简化到纯整数, 一年一个大版本。socket activation、networkd、resolved、logind 全部稳定下来。</> }, en: { title: <>v231 — plain-integer versions</>, desc: <>Version numbers simplify to plain integers, one major per year. socket activation, networkd, resolved, logind all stabilize.</> } },
    { year: '2018·06', zh: { title: <>v239 — DynamicUser</>, desc: <>DynamicUser= 让 service 跑时临时分配 UID, 跑完释放。"按需创建一次性账户"的隔离粒度开始下沉到 unit 文件里。</> }, en: { title: <>v239 — DynamicUser</>, desc: <>DynamicUser= lets a service get an ephemeral UID for the duration of its run. Per-unit ephemeral-account isolation lands.</> } },
    { year: '2020·12', zh: { title: <>v247 — homed / portabled</>, desc: <>systemd-homed 把用户家目录变成可移动的加密 image, portabled 让服务可以打成自包含 image 跨主机搬。</> }, en: { title: <>v247 — homed / portabled</>, desc: <>systemd-homed turns home directories into portable encrypted images; portabled lets services ship as self-contained images that move between hosts.</> } },
    { year: '2022·09', zh: { title: <>Poettering 跳槽 Microsoft</>, desc: <>Lennart Poettering 离开 Red Hat 加入 Microsoft, 继续做 systemd 主线开发。被 Linux 社区视为又一轮"巨头收编"事件, 但发行版没有任何变化。</> }, en: { title: <>Poettering moves to Microsoft</>, desc: <>Lennart Poettering leaves Red Hat for Microsoft, continuing as systemd's main developer. The Linux community calls it another "big-vendor capture" moment; distros change nothing.</> } },
    { year: '2024·07', zh: { title: <>v256 — run0 + 容器化</>, desc: <>v256 推出 run0 命令 (sudo 的 systemd 替代品), 容器 / VM 边界继续模糊, sysext / confext 让 immutable rootfs 上分层加扩展变成 unit。</> }, en: { title: <>v256 — run0 + containerization</>, desc: <>v256 introduces run0 (a systemd replacement for sudo). The container / VM boundary blurs further; sysext / confext make layered extensions on immutable rootfs first-class units.</> } },
    { year: '2026·03', highlight: true, zh: { title: <>v260 — SysV 兼容退场</>, desc: <>SysV init.d 兼容代码彻底删除, kernel 最低 5.10。新增 systemd-mstack OverlayFS 工具、FANCY_NAME= os-release 字段。16 年后, 这层 legacy 终于不再背。</> }, en: { title: <>v260 — SysV compat gone</>, desc: <>SysV init.d compatibility is fully removed; minimum kernel is 5.10. Adds systemd-mstack (OverlayFS) and FANCY_NAME= in os-release. Sixteen years on, that legacy layer is finally dropped.</> } },
    { year: '2026·05', highlight: true, zh: { title: <>当前: 260 仍是新基准</>, desc: <>截至今日, v260 已落到 Arch / Fedora 44 / Manjaro stable channel。Debian 13 + Ubuntu 26.04 LTS 走 v257 / 258 长期支持线, 两条节奏并行。</> }, en: { title: <>Current: 260 is the new baseline</>, desc: <>As of today, v260 ships on Arch / Fedora 44 / Manjaro stable. Debian 13 and Ubuntu 26.04 LTS stay on v257 / v258 for long-term support — the two cadences run in parallel.</> } },
  ],
  concepts: [
    { tag: 'A', zh: { title: <>.service 文件</>, desc: <>最常见的 unit 类型, 描述一个长跑进程怎么起、怎么挂、怎么重启。</> }, en: { title: <>.service files</>, desc: <>The most common unit type — describes how to start, stop, and restart a long-running process.</> }, code: <code>{c('# /etc/systemd/system/hono.service')}{'\n'}[{k('Unit')}]{'\n'}{p('Description')}={v('Hono API server')}{'\n'}{p('After')}={v('network.target')}{'\n\n'}[{k('Service')}]{'\n'}{p('ExecStart')}={v('/usr/bin/node /srv/api/index.js')}{'\n'}{p('Restart')}={v('always')}{'\n'}{p('User')}={v('hono')}{'\n\n'}[{k('Install')}]{'\n'}{p('WantedBy')}={v('multi-user.target')}</code> },
    { tag: 'B', zh: { title: <>systemctl</>, desc: <>统一的查询 + 控制入口。start / stop / restart / status / enable / disable 一套命令通吃所有 unit。</> }, en: { title: <>systemctl</>, desc: <>One control plane: start / stop / restart / status / enable / disable across every unit type.</> }, code: <code>{f('systemctl')} {v('start')} {s('nginx')}{'\n'}{f('systemctl')} {v('enable')} {s('--now')} {s('hono')}{'\n'}{f('systemctl')} {v('status')} {s('pg-dump-recon.timer')}{'\n'}{f('systemctl')} {v('restart')} {s('nginx')}</code> },
    { tag: 'C', zh: { title: <>.timer 文件</>, desc: <>cron 替代品。OnCalendar= 用人话写时间, 比 cron 表达式好读, 还能跟 service unit 配对。</> }, en: { title: <>.timer files</>, desc: <>The cron replacement. OnCalendar= reads like English, pairs naturally with a .service unit.</> }, code: <code>{c('# /etc/systemd/system/pg-dump-recon.timer')}{'\n'}[{k('Timer')}]{'\n'}{p('OnCalendar')}={v('*-*-* 03:00:00 UTC')}{'\n'}{p('Persistent')}={v('true')}{'\n'}{p('Unit')}={v('pg-dump-recon.service')}{'\n\n'}[{k('Install')}]{'\n'}{p('WantedBy')}={v('timers.target')}</code> },
    { tag: 'D', zh: { title: <>journald</>, desc: <>结构化日志收集器, 每条带 unit / pid / 优先级 / 时间戳元数据。<code>journalctl</code> 是查询入口。</> }, en: { title: <>journald</>, desc: <>Structured log collector — each record carries unit / pid / priority / timestamp metadata. <code>journalctl</code> is the query tool.</> }, code: <code>{c('# 跟踪某 service 实时日志')}{'\n'}{f('journalctl')} {s('-u')} {v('nginx')} {s('-f')}{'\n\n'}{c('# 按时间窗口 + 优先级')}{'\n'}{f('journalctl')} {s('--since')} {s('"1 hour ago"')} {s('-p')} {v('warning')}</code> },
    { tag: 'E', zh: { title: <>.socket / socket activation</>, desc: <>systemd 监听 socket, 第一次连接进来才把对应 service 拉起来。冷启动快, 资源省。</> }, en: { title: <>.socket / socket activation</>, desc: <>systemd holds the listening socket; the service is only spun up on first connection. Faster cold start, lower idle cost.</> }, code: <code>[{k('Socket')}]{'\n'}{p('ListenStream')}={n('8080')}{'\n'}{p('Accept')}={v('false')}{'\n\n'}[{k('Install')}]{'\n'}{p('WantedBy')}={v('sockets.target')}</code> },
    { tag: 'F', zh: { title: <>cgroup 资源限制</>, desc: <>每个 unit 自带 cgroup, MemoryMax= / CPUQuota= / TasksMax= 直接写在 unit 文件里, 不再需要外挂工具。</> }, en: { title: <>cgroup resource limits</>, desc: <>Every unit gets its own cgroup. MemoryMax= / CPUQuota= / TasksMax= go straight into the unit file — no external tooling needed.</> }, code: <code>[{k('Service')}]{'\n'}{p('MemoryMax')}={n('512M')}{'\n'}{p('CPUQuota')}={n('80')}%{'\n'}{p('TasksMax')}={n('200')}</code> },
    { tag: 'G', zh: { title: <>target = 一组 unit</>, desc: <>类似 SysV runlevel, 但更细粒度。multi-user.target / graphical.target / network-online.target 是常见枢纽。</> }, en: { title: <>target = a bundle of units</>, desc: <>The runlevel analogue, but finer-grained. multi-user.target / graphical.target / network-online.target are common hubs.</> }, code: <code>{f('systemctl')} {v('isolate')} {s('multi-user.target')}{'\n'}{f('systemctl')} {v('list-dependencies')} {s('graphical.target')}</code> },
    { tag: 'H', zh: { title: <>沙箱选项</>, desc: <>ProtectSystem= / PrivateTmp= / NoNewPrivileges= / DynamicUser= 等让一个普通 service 几行配置就拿到容器级别的隔离。</> }, en: { title: <>Sandbox options</>, desc: <>ProtectSystem= / PrivateTmp= / NoNewPrivileges= / DynamicUser= give a plain service container-grade isolation in a few lines.</> }, code: <code>[{k('Service')}]{'\n'}{p('ProtectSystem')}={v('strict')}{'\n'}{p('PrivateTmp')}={v('true')}{'\n'}{p('NoNewPrivileges')}={v('true')}{'\n'}{p('DynamicUser')}={v('true')}</code> },
  ],
  whyCards: [
    { icon: '⚙', zh: { title: <>声明式 unit 代替 shell</>, desc: <>SysV init 时代每个服务一个 shell 脚本, 错误处理 + 日志 + PID 文件都得手撸。unit 文件几十行 ini 替代几百行 shell, 错误码、重启策略、依赖图都标准化。</> }, en: { title: <>Declarative units replace shell</>, desc: <>SysV gave you a shell script per service — error handling, logging, PID files, all hand-rolled. A tens-of-lines ini unit replaces hundreds of lines of shell, with standardized error codes, restart policies, and dep graphs.</> }, code: <>{c('# Restart on crash, 5s back-off')}{'\n'}{p('Restart')}={v('on-failure')}{'\n'}{p('RestartSec')}={n('5')}{s('s')}</> },
    { icon: '⌬', zh: { title: <>journalctl 统一日志面</>, desc: <>所有 unit 的 stdout/stderr 自动进 journal, 一个命令按 unit / pid / 时间 / 优先级查, 不用满硬盘找 <code>/var/log/&lt;name&gt;.log</code>。</> }, en: { title: <>journalctl is one log surface</>, desc: <>Every unit's stdout/stderr flows into the journal. One command queries by unit / pid / time / priority — no more scavenging <code>/var/log/&lt;name&gt;.log</code>.</> }, code: <>{f('journalctl')} {s('-u')} {v('hono')} {s('--since today')}</> },
    { icon: '⎇', zh: { title: <>timer 替 cron</>, desc: <>cron 的痛点 (机器关机时跳过的任务、错误日志难找、依赖关系无法表达) 全在 timer + Persistent=true 上解决了。</> }, en: { title: <>Timers replace cron</>, desc: <>cron's pain points — skipped jobs when the host is off, scattered error logs, no dependency model — all dissolved by .timer units with Persistent=true.</> }, code: <>{p('Persistent')}={v('true')} {c('// catch-up on boot')}</> },
    { icon: '⌁', zh: { title: <>socket activation</>, desc: <>systemd 监听端口, 第一次连接进来才拉服务。空闲时占内存接近 0, 冷启动延迟以毫秒计。</> }, en: { title: <>Socket activation</>, desc: <>systemd holds the port; the service is only started on first connection. Idle memory is near zero; cold-start latency is in milliseconds.</> }, code: <>{p('ListenStream')}={n('443')}</> },
    { icon: '⌖', zh: { title: <>沙箱选项一行启用</>, desc: <>ProtectSystem=strict / PrivateTmp / DynamicUser / NoNewPrivileges 等让一个普通服务三行就拿到容器级别隔离, 不必上 Docker。</> }, en: { title: <>One-line sandboxing</>, desc: <>ProtectSystem=strict / PrivateTmp / DynamicUser / NoNewPrivileges give a plain service container-grade isolation in three lines — no Docker required.</> }, code: <>{p('DynamicUser')}={v('true')}</> },
    { icon: '⌗', zh: { title: <>cgroup v2 资源限制</>, desc: <>MemoryMax / CPUQuota / IOReadBandwidthMax 直接写 unit 里, 不再外挂 ulimit / nice / ionice。一个 unit 失控不会拖整台机。</> }, en: { title: <>cgroup v2 resource limits</>, desc: <>MemoryMax / CPUQuota / IOReadBandwidthMax live in the unit — no more ulimit / nice / ionice scattered around. A runaway unit can't take the whole host down.</> }, code: <>{p('MemoryMax')}={n('512')}{s('M')}</> },
    { icon: '⏚', zh: { title: <>依赖图明确</>, desc: <>After= / Requires= / Wants= 把启动顺序和强弱依赖写清楚。<code>systemd-analyze critical-chain</code> 直接画依赖瓶颈。</> }, en: { title: <>Explicit dependency graph</>, desc: <>After= / Requires= / Wants= encode order and strength. <code>systemd-analyze critical-chain</code> draws the bottleneck path directly.</> }, code: <>{p('After')}={v('network.target postgresql.service')}</> },
    { icon: '⛯', zh: { title: <>无处不在</>, desc: <>主流 Linux 发行版几乎全用, 云镜像默认就有, 嵌入式 / 车载 / 桌面共用同一套 unit 模型。运维心智一次学完到处用。</> }, en: { title: <>Everywhere</>, desc: <>Practically every mainstream Linux distro runs it, cloud images ship it by default, and embedded / automotive / desktop share the same unit model. Learn it once, use it everywhere.</> }, code: <>{c('// One mental model:')}{'\n'}{c('// Arch == Debian == RHEL')}</> },
    { icon: '⚐', zh: { title: <>容器边界继续模糊</>, desc: <>systemd-nspawn / portabled / sysext 让"轻量 container = 一组 unit"的范式成立。比 Docker 轻, 比 chroot 强。</> }, en: { title: <>The container boundary keeps blurring</>, desc: <>systemd-nspawn / portabled / sysext make "a lightweight container is a bundle of units" a real pattern. Lighter than Docker, sturdier than chroot.</> }, code: <>{f('systemd-nspawn')} {s('-D')} {v('/srv/container')}</> },
  ],
  adopters: [
    { name: 'Red Hat / RHEL / Fedora', highlight: true, zhNote: '原生父家, RHEL 7 (2014) 起默认', enNote: 'The parent — default since RHEL 7 (2014)' },
    { name: 'Debian', href: 'https://debian.org', highlight: true, zhNote: 'Debian 8 (2015) 切到 systemd, 投票之战载入史册', enNote: 'Debian 8 (2015) switched; the vote went down in history' },
    { name: 'Ubuntu', href: 'https://ubuntu.com', zhNote: 'Ubuntu 15.04 起默认, 替掉自家 Upstart', enNote: 'Default since 15.04, replaced in-house Upstart' },
    { name: 'Arch Linux', href: 'https://archlinux.org', zhNote: '滚动发行版第一个跟进', enNote: 'First rolling distro to adopt it' },
    { name: 'SUSE / openSUSE', href: 'https://suse.com', zhNote: '企业 Linux 第三方, 全套 systemd', enNote: 'Third enterprise Linux pillar, full systemd' },
    { name: 'CoreOS / Flatcar', href: 'https://flatcar.org', zhNote: '容器优先的 Linux, systemd 是核心抽象', enNote: 'Container-first Linux built around systemd as the core abstraction' },
    { name: 'Yocto / AGL (Automotive Grade Linux)', zhNote: '车载 Linux, systemd 管 IVI 服务', enNote: 'Automotive Linux — systemd runs IVI services' },
    { name: 'Tesla 车机', highlight: true, zhNote: '车内 Linux 系统底层就是 systemd 拉的', enNote: 'In-car Linux infotainment is brought up by systemd' },
    { name: 'WSL2', href: 'https://learn.microsoft.com/windows/wsl/', zhNote: 'Windows 11 上的 Linux 子系统也支持 systemd', enNote: "Windows 11's Linux subsystem now supports systemd" },
    { name: 'GNOME / KDE 桌面', zhNote: '桌面会话管理 (logind) + 用户级 unit', enNote: 'Desktop session management (logind) + user-scoped units' },
    { name: 'NixOS', href: 'https://nixos.org', zhNote: '声明式系统配置 + systemd unit 天作之合', enNote: 'Declarative system config + systemd units — natural fit' },
    { name: 'cuberoot.me', highlight: true, zhNote: '本站云服务器全套服务靠 systemd unit + timer 跑', enNote: 'This site — every VM service runs as a systemd unit, including the daily backup timer' },
  ],
  outlook: [
    { tag: <>v260</>, hot: true, big: true, zh: { title: <>systemd 260 删掉 SysV 兼容</>, body: <><p>2026 年 3 月的 260 把 SysV init.d 脚本兼容代码彻底删除, 16 年后这层 legacy 终于不再背。最低 kernel 抬到 5.10。</p><p>新增的 <code>systemd-mstack</code> 工具用 OverlayFS 把多个目录叠成一层文件系统, 给 immutable rootfs + 可变扩展这种范式准备的。<code>FANCY_NAME=</code> 也加进 os-release —— 允许含 ANSI 序列 / Unicode 字符, 给发行版做个性化欢迎屏。</p></> }, en: { title: <>systemd 260 drops SysV compat</>, body: <><p>March 2026's v260 fully removes init.d compatibility — sixteen years on, the layer is finally gone. The minimum kernel bumps to 5.10.</p><p>A new <code>systemd-mstack</code> tool stacks multiple directories into one OverlayFS layer, designed for immutable rootfs + mutable extension patterns. <code>FANCY_NAME=</code> joins os-release — ANSI sequences and Unicode allowed for personalized welcome screens.</p></> } },
    { tag: 'SECURITY', zh: { title: <>沙箱继续吃 Docker 的工作</>, body: <><p>DynamicUser / ProtectHome / ProtectKernelTunables / SystemCallFilter 这些选项一行行变得更细。"我只是想跑个 daemon, 不想搞 Docker compose" 的场景越来越多走 systemd 沙箱。</p></> }, en: { title: <>Sandbox keeps eating Docker's lunch</>, body: <><p>DynamicUser / ProtectHome / ProtectKernelTunables / SystemCallFilter keep growing finer-grained. "I just want to run a daemon, not write Docker compose" increasingly lands on systemd sandboxing.</p></> } },
    { tag: 'CONTAINER', zh: { title: <>portabled / sysext 重塑分发</>, body: <><p>把一个服务打成 raw / squashfs / dir image, 通过 sysext 叠到 immutable rootfs 上跑 —— 比 Docker 轻, 比传统 deb / rpm 更隔离。SteamOS / CarOS / Fedora Silverblue 已经走这一路。</p></> }, en: { title: <>portabled / sysext reshape distribution</>, body: <><p>Ship a service as a raw / squashfs / dir image and stack it onto an immutable rootfs via sysext — lighter than Docker, more isolated than deb / rpm. SteamOS / CarOS / Fedora Silverblue already lean on it.</p></> } },
    { tag: <>AI</>, zh: { title: <>journald 结构化日志喂给 LLM</>, body: <><p>journald 输出本身是结构化 JSON, 直接 <code>journalctl -o json</code> 就能 pipe 给本地 LLM 做故障摘要。社区已经在做 systemd 原生的 AI agent hook —— "服务挂了, AI 先读 journal 再给你结论"。</p></> }, en: { title: <>journald feeds LLMs directly</>, body: <><p>journald's output is structured JSON natively — <code>journalctl -o json</code> pipes straight into a local LLM for failure summarization. The community is already prototyping native AI-agent hooks: "service died → AI reads journal → reports cause."</p></> } },
    { tag: <>HOMED</>, zh: { title: <>homed 把家目录变可移动</>, body: <><p>systemd-homed 把用户家目录变成一个加密的可移动 image, 走到哪台机器插上就用。和云端 OAuth / passkey 配合, 是"无状态 Linux 桌面"的关键拼图。</p></> }, en: { title: <>homed makes $HOME portable</>, body: <><p>systemd-homed turns home into a portable encrypted image — plug it into any machine and log in. Combined with cloud OAuth / passkeys, it's a key piece of "stateless Linux desktop."</p></> } },
  ],
  cuberoot: {
    zh: (
      <>
        <p>cuberoot.me 这台云服务器全套服务都被 systemd 拉起来。<code>nginx.service</code> 管 web 静态 + API 反代;Hono 后端不是直接做 systemd unit, 而是走 <strong>pm2 startup</strong> —— pm2 自己装成一个 systemd unit, 由它再去拉 Hono node 进程, 这样进程崩了 pm2 在自己范围内重启, pm2 自己崩了 systemd 把它拉起来, 两层兜底。</p>
        <p>定时任务全走 timer。<code>pg-dump-recon.timer</code> 每天 03:00 UTC 触发 <code>pg-dump-recon.service</code>, 把 PostgreSQL 整库 dump 到 <code>/root/archive/</code>, 留 30 天就 rotate。<code>acme.sh</code> 的证书续期也是 systemd timer 跑, 不用 cron —— OnCalendar 比 cron 表达式好读, Persistent=true 保证机器关机错过的也会补跑。</p>
        <p>排查问题第一个命令永远是 <code>journalctl -u &lt;unit&gt; -f</code>。所有 unit 的 stdout/stderr 都在一个统一日志面里, 按时间 / 优先级 / unit 名字过滤, 不用满硬盘翻 <code>/var/log/</code>。pm2 自己也有日志, 但 journal 更适合做服务级别的状态机查询。</p>
        <p>2026-05-06 整套架构从宝塔 + PHP + MariaDB 切到 systemd 直管 + Hono + PostgreSQL 后, 全机器只剩 nginx / pm2 / pg-dump-recon.timer / acme.sh.timer 这几个 unit, 心智模型简单到一个 <code>systemctl list-units --type=service,timer</code> 就能看全。</p>
      </>
    ),
    en: (
      <>
        <p>The cuberoot.me VM is brought up end-to-end by systemd. <code>nginx.service</code> serves static web + reverse-proxies the API. The Hono backend isn't a direct systemd unit — instead, <strong>pm2 startup</strong> installs pm2 itself as a systemd unit, and pm2 in turn supervises the Hono node process. Two layers of safety: if Hono crashes, pm2 restarts it; if pm2 itself dies, systemd brings pm2 back.</p>
        <p>Scheduling is all timers. <code>pg-dump-recon.timer</code> fires daily at 03:00 UTC, triggering <code>pg-dump-recon.service</code> to dump the full PostgreSQL database into <code>/root/archive/</code> with 30-day rotation. acme.sh certificate renewal is also a systemd timer, not cron — OnCalendar reads better than cron expressions, and Persistent=true catches up on missed runs after a reboot.</p>
        <p>The first debugging command is always <code>journalctl -u &lt;unit&gt; -f</code>. Every unit's stdout/stderr is in one unified log surface, queryable by time / priority / unit name — no rummaging through <code>/var/log/</code>. pm2 keeps its own logs, but the journal is better for service-level state queries.</p>
        <p>After the 2026-05-06 migration from baota + PHP + MariaDB to systemd-managed Hono + PostgreSQL, the whole VM has just nginx / pm2 / pg-dump-recon.timer / acme.sh.timer running. A single <code>systemctl list-units --type=service,timer</code> shows the entire footprint.</p>
      </>
    ),
  },
  links: [
    { label: 'systemd.io', href: 'https://systemd.io' },
    { label: 'GitHub · systemd/systemd', href: 'https://github.com/systemd/systemd' },
    { label: 'Rethinking PID 1 (2010)', href: 'http://0pointer.de/blog/projects/systemd.html' },
    { label: 'systemd 260 release notes', href: 'https://github.com/systemd/systemd/releases/tag/v260' },
  ],
};

export default SYSTEMD;
