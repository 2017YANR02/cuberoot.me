import type { StackTool } from '../_lib/stack_tool_types';
import { k, v, s, n, f, c } from '../_lib/stack_tool_types';

// ─── Tailscale ──────────────────────────────────────────────────────────────

export const TAILSCALE: StackTool = {
  slug: 'tailscale',
  name: 'Tailscale',
  version: '1.96.5',
  since: '2019-04',
  group: 'dev',
  accent: '#5F5FFF',
  bright: '#8A8AFF',
  glyph: '◇',
  floats: ['WireGuard', 'mesh', 'MagicDNS', 'ACL', 'Funnel', 'Serve', 'tsnet', 'Headscale', 'NAT traversal', 'DERP', 'tailnet', 'ts.net'],
  zh: {
    tagline: '基于 WireGuard 的 mesh VPN',
    role: '把开发机、手机、笔记本拉进同一张私有网络, dev server 不用开公网也能跨设备访问。',
    heroSub: <>把 WireGuard 的内核态加密塞进一张<strong>每对节点直连</strong>的网格, 上面再叠一层协调服务管 key / ACL / DNS。装上客户端登录一下, 你的所有设备就互相能 ping。不用开端口、不用配证书、不用记 IP。</>,
    whatDesc: <>Tailscale 是一张<strong>身份化的 mesh 网络</strong>。WireGuard 负责数据面 (内核态加密 + 直连), Tailscale 自己写的 coordination server 负责控制面 (key 分发 + ACL + MagicDNS)。NAT 穿透打不通时落到 DERP 中继。终端用户的体感是:登录、看见设备列表、互相能通。</>,
    historyDesc: <>2019 年 4 月由 Avery Pennarun 等几个前 Google / LiveJournal 工程师创立。WireGuard 那时刚要进 Linux 5.6 内核, 他们抓住这个时间点把"难用的 VPN"重做一遍。2022 年 Accel 领投 $100M Series B, 2024 年 11 月 Insight Partners 领 $160M Series C, 估值 $1.5B。</>,
    conceptsTitle: '核心概念',
    conceptsDesc: <>tailnet (你的私有网) 是一切的容器。设备登录后拿到 100.x.y.z 的 CGNAT 段地址, 通过 MagicDNS 还能直接用 hostname。ACL / Funnel / Serve / tsnet 几个动词是上面长出来的能力。</>,
    whyDesc: <>选 Tailscale 不是因为它"最快的 VPN", 而是因为它把"两台机器互联"这件事变成了<strong>不用思考</strong>的操作。装、登录、能 ping。剩下的认证 / 路由 / 续 cert 全在它后台跑。</>,
    adoptersTitle: '谁在用',
    adoptersDesc: <>从一人开发到中大型团队都覆盖。免费版 100 节点的额度对个人 / 小工作室基本无压力。Headscale 给重度 self-host 党留了一条逃生通道, 协议兼容客户端。</>,
    cuberootDesc: <>cuberoot.me 的开发流程依赖 Tailscale 在多设备之间共享 dev server, 不在公网暴露任何端口。</>,
    outlookTitle: '当下与前景',
    outlookDesc: <>2026 年方向已经清晰:tsnet 让任意 Go / Rust 程序"自带 mesh 网卡"; Funnel 把局域网服务暴成 HTTPS 公网 URL; Tailscale SSH 干掉证书 / 跳板机这一层。整体在从"VPN 替代品"扩到"私有应用 fabric"。</>,
  },
  en: {
    tagline: 'WireGuard-based mesh VPN',
    role: 'Pulls dev machine, phone, laptop onto one private network — dev servers reachable across devices without ever opening a public port.',
    heroSub: <>Take WireGuard's in-kernel encryption, run it in a <strong>peer-to-peer mesh</strong>, and add a thin coordination layer that handles key / ACL / DNS. Install the client, log in once, and all your devices can ping each other. No ports to open, no certs to manage, no IPs to remember.</>,
    whatDesc: <>Tailscale is an <strong>identity-aware mesh network</strong>. WireGuard owns the data plane (kernel-level encryption + direct peer connection); Tailscale's own coordination server owns the control plane (key exchange + ACLs + MagicDNS). When NAT traversal fails, traffic falls back to a DERP relay. The user experience: log in, see the device list, everything talks to everything.</>,
    historyDesc: <>Founded April 2019 by Avery Pennarun and other ex-Google / LiveJournal engineers. WireGuard was just landing in Linux 5.6 — perfect timing to redo "the painful VPN." Accel led a $100M Series B in 2022, Insight Partners led a $160M Series C in November 2024, valuing the company at $1.5B.</>,
    conceptsTitle: 'Core concepts',
    conceptsDesc: <>The tailnet (your private network) contains everything. A device that logs in gets a 100.x.y.z CGNAT address and a MagicDNS hostname. ACLs / Funnel / Serve / tsnet are verbs layered on top of that primitive.</>,
    whyDesc: <>You pick Tailscale not because it's the "fastest VPN" but because it makes "two machines talking to each other" a <strong>no-think</strong> operation. Install, log in, ping. Auth / routing / cert renewal all run silently in the background.</>,
    adoptersTitle: 'Who uses it',
    adoptersDesc: <>Covers everything from solo devs to mid-sized teams. The free tier's 100 nodes is roughly unlimited for individuals / small shops. Headscale gives the heavy self-host camp a compatible escape hatch — the same clients work against it.</>,
    cuberootDesc: <>cuberoot.me's development workflow uses Tailscale to share the dev server across multiple devices without exposing any public port.</>,
    outlookTitle: 'Now and next',
    outlookDesc: <>The 2026 direction is set: tsnet gives any Go / Rust program a "mesh NIC" of its own; Funnel turns a LAN service into a public HTTPS URL; Tailscale SSH removes the cert / bastion layer entirely. The company is moving from "VPN replacement" to "private application fabric."</>,
  },
  heroStats: [
    { num: '100', unit: 'free', zh: <>免费版每 tailnet 节点上限 <em>个人 / 小团队基本够</em></>, en: <>nodes per tailnet on the free plan <em>plenty for solo / small teams</em></> },
    { num: '$1.5', unit: 'B', zh: <>2024-11 Series C 估值 <em>Insight $160M 领投</em></>, en: <>valuation at 2024-11 Series C <em>Insight led $160M</em></> },
    { num: '7', unit: 'y', zh: <>从 2019 至今 <em>WireGuard 落地内核同年起步</em></>, en: <>since 2019 <em>started the year WireGuard hit kernel</em></> },
    { num: '1', unit: '.96', zh: <>当前稳定版 <em>2026-04 · 1.96.5</em></>, en: <>current stable <em>2026-04 · 1.96.5</em></> },
  ],
  intro: {
    zh: (
      <>
        <p>Tailscale 2019 年由 Avery Pennarun (前 Google, 现 CEO)、Brad Fitzpatrick (LiveJournal 创始人, Go 团队元老)、David Crawshaw、David Carney 几个人创立。问题源头是他们对"传统企业 VPN"的耐心见底 —— hub-and-spoke 拓扑、单点故障、配 IPsec 配到吐血、给新员工开权限要走工单。WireGuard 那时正进 Linux 5.6 内核, 协议本身只有几千行代码、加密原语干净。他们押的注是:把 WireGuard 当成数据面, 上面叠一层<strong>身份化的协调层</strong>, 用户登录一次就拿到一张持续在线的私有 mesh。</p>
        <p>技术核心是<strong>每对节点尽量直连</strong>。客户端通过 STUN / 端口侧探测打 NAT, 90% 以上场景能打通点对点; 打不通就落到 DERP 中继 (Tailscale 自己运营的 relay 节点)。控制面只走 key 协商 + ACL 下发, 不经手用户数据。这让流量路径短, 延迟接近原生 LAN, 同时密钥定期轮换、撤销立即生效。</p>
        <p>2022 年 Accel $100M Series B, 2024-11 Insight $160M Series C 估值 $1.5B。免费版 100 节点的额度在 2026 年仍然是行业里最大方的一档, 个人开发者基本不会撞上限。Headscale 是社区写的开源 coordination server, 协议兼容官方客户端 —— 给那些"不想把控制面交给第三方"的用户一条出路。</p>
      </>
    ),
    en: (
      <>
        <p>Tailscale was founded in 2019 by Avery Pennarun (ex-Google, CEO), Brad Fitzpatrick (LiveJournal founder, Go team veteran), David Crawshaw, and David Carney. The trigger was their exhaustion with traditional enterprise VPNs — hub-and-spoke topology, single points of failure, IPsec configs that take a week, opening permissions for a new hire via a ticket. WireGuard had just landed in Linux 5.6: a few thousand lines of code, clean crypto primitives. Their bet was to use WireGuard as the data plane and add an <strong>identity-aware coordination layer</strong> above it, so users log in once and stay on a persistent private mesh.</p>
        <p>The core technical move is <strong>peer-to-peer direct connection wherever possible</strong>. Clients punch NAT via STUN / port-side probing — over 90% of the time it works, and the path is direct. When it fails, traffic falls back to DERP relays (Tailscale-operated). The control plane only handles key exchange and ACL distribution; it never sees user payloads. The result: paths are short, latency is near-LAN, key rotation is automatic, and revocation takes effect immediately.</p>
        <p>Accel led a $100M Series B in 2022; Insight led a $160M Series C in November 2024 at a $1.5B valuation. The 100-node free tier remains the most generous in the category as of 2026 — solo devs essentially never hit it. Headscale is a community-built open-source coordination server that speaks the same protocol — an exit for anyone who wants to self-host the control plane.</p>
      </>
    ),
  },
  history: [
    { year: '2019·04', zh: { title: <>公司成立</>, desc: <>Avery Pennarun 等几个前 Google / LiveJournal 工程师在多伦多创立。WireGuard 那时正要进 Linux 5.6 内核, 时机踩得极准。</> }, en: { title: <>Company founded</>, desc: <>Avery Pennarun and other ex-Google / LiveJournal engineers start the company in Toronto, exactly as WireGuard is landing in Linux 5.6.</> } },
    { year: '2020·04', zh: { title: <>1.0 公开发布</>, desc: <>客户端覆盖 macOS / Linux / Windows / iOS / Android, 协议栈跑 WireGuard + 自研 coordination。</> }, en: { title: <>1.0 public release</>, desc: <>Clients cover macOS / Linux / Windows / iOS / Android. Stack is WireGuard + in-house coordination.</> } },
    { year: '2020·11', zh: { title: <>MagicDNS</>, desc: <>把设备 hostname 自动当作 DNS 名, 100.x.y.z 的数字 IP 几乎不用记。Tailscale 的"无感"体验从这里起步。</> }, en: { title: <>MagicDNS</>, desc: <>Device hostnames become DNS names automatically — you almost never need to remember a 100.x.y.z address. The signature "invisible" experience starts here.</> } },
    { year: '2021·08', zh: { title: <>Series A</>, desc: <>Accel + CRV 领 $13M Series A。同期 ACL 可视化、subnet router、exit node 几个企业向能力陆续落地。</> }, en: { title: <>Series A</>, desc: <>$13M Series A led by Accel + CRV. ACL visualizer, subnet routers, and exit nodes ship in parallel — the enterprise feature pillar.</> } },
    { year: '2022·05', zh: { title: <>Series B</>, desc: <>Accel 领 $100M Series B, 估值 $300M+。开始大规模招聘, 客户端跨平台覆盖收尾。</> }, en: { title: <>Series B</>, desc: <>Accel leads a $100M Series B at a $300M+ valuation. Hiring scales up; cross-platform client coverage rounds out.</> } },
    { year: '2022·06', zh: { title: <>Tailscale SSH</>, desc: <>把 ssh 认证接到 tailnet identity, 不再需要分发 SSH key。"在某台机器上对某个用户开 shell" 变成一行 ACL。</> }, en: { title: <>Tailscale SSH</>, desc: <>SSH authentication is wired to tailnet identity — no SSH key distribution. "Allow user X on machine Y" becomes one ACL line.</> } },
    { year: '2023·02', zh: { title: <>Funnel</>, desc: <>把 tailnet 内的服务暴成公网 HTTPS URL, 自动签 cert。给"本机 dev server 给同事 demo 一下"这种场景一个 5 秒方案。</> }, en: { title: <>Funnel</>, desc: <>Expose a tailnet service as a public HTTPS URL with auto-issued certs. Five-second answer to "share my local dev server with a colleague."</> } },
    { year: '2023·07', zh: { title: <>Serve</>, desc: <>Funnel 的内网孪生:把本机 server 在 tailnet 内分享给其它设备, 带自动 cert。手机直接 https 访问开发机 dev server 走的就是这条。</> }, en: { title: <>Serve</>, desc: <>The intranet sibling of Funnel: share a local server inside the tailnet with auto-issued certs. Phones reaching a dev server via HTTPS go through this.</> } },
    { year: '2024·03', zh: { title: <>tsnet GA</>, desc: <>Go 库, 让任意程序"自带 mesh 网卡"。一行 import 就能让你的 Hono / Express server 只在 tailnet 内可达。</> }, en: { title: <>tsnet GA</>, desc: <>A Go library that gives any program "its own mesh NIC." One import and your Hono / Express server lives only inside the tailnet.</> } },
    { year: '2024·11', zh: { title: <>Series C</>, desc: <>Insight 领 $160M Series C, 估值 $1.5B。同期开始把企业向能力 (SCIM / SSO / DLP) 全套化。</> }, en: { title: <>Series C</>, desc: <>Insight leads a $160M Series C at a $1.5B valuation. Enterprise stack (SCIM / SSO / DLP) starts filling out in parallel.</> } },
    { year: '2025·06', zh: { title: <>Tailscale Kubernetes Operator GA</>, desc: <>把 K8s 集群里的 Service 直接发布到 tailnet, 不用配 Ingress / LB。云原生圈这一年正式接纳。</> }, en: { title: <>Tailscale Kubernetes Operator GA</>, desc: <>Publishes K8s Services directly into a tailnet — no Ingress / LB plumbing. The cloud-native community formally adopts it this year.</> } },
    { year: '2026·04', highlight: true, zh: { title: <>1.96.5 / 当前稳定</>, desc: <>macOS 客户端引入新的窗口化界面, Taildrop / ping 工具直接挂在 menu bar。tssentinelId 命令注入漏洞 (TS-2026-001) 当月修掉。</> }, en: { title: <>1.96.5 / current stable</>, desc: <>macOS client gains a windowed UI exposing Taildrop / ping directly in the menu bar. Command-injection in tssentinelId (TS-2026-001) patched the same month.</> } },
  ],
  concepts: [
    { tag: 'A', zh: { title: <>tailnet</>, desc: <>你的私有 mesh。一个账号一张 tailnet, 里面所有设备互通。免费版上限 100 节点。</> }, en: { title: <>tailnet</>, desc: <>Your private mesh. One account, one tailnet, all devices mutually reachable. Free-tier cap: 100 nodes.</> }, code: <code>$ tailscale up{'\n'}{c('# 浏览器弹登录, 完事')}{'\n'}{c('# logged in, that is it')}</code> },
    { tag: 'B', zh: { title: <>100.x.y.z + MagicDNS</>, desc: <>每个节点拿一个 CGNAT 段地址, 同时 hostname 自动注册为 DNS 名。两边都能用。</> }, en: { title: <>100.x.y.z + MagicDNS</>, desc: <>Every node gets a CGNAT-range address; its hostname is auto-registered in DNS. Both work for the same target.</> }, code: <code>$ ping {v('alienware')}{'\n'}{c('# 等价于')} ping {n('100.64.1.7')}</code> },
    { tag: 'C', zh: { title: <>ACL (tailnet policy)</>, desc: <>HuJSON 写的"谁能访问谁"。group / tag 抽象出角色, 一行声明就能给一组设备开一组端口。</> }, en: { title: <>ACL (tailnet policy)</>, desc: <>HuJSON describing "who can reach whom." Groups / tags abstract roles; one declaration opens a port set for a device set.</> }, code: <code>{'{'}{'\n'}  {s('"acls"')}: [{'\n'}    {'{ '}{s('"action"')}: {s('"accept"')},{'\n'}      {s('"src"')}: [{s('"group:dev"')}],{'\n'}      {s('"dst"')}: [{s('"tag:server:80,443"')}] {'}'}{'\n'}  ]{'\n'}{'}'}</code> },
    { tag: 'D', zh: { title: <>Subnet router</>, desc: <>把一台节点当成网关, 让 tailnet 反过来访问它身后的整个子网。打通办公室 / 家庭网段时常用。</> }, en: { title: <>Subnet router</>, desc: <>Promote a node to a gateway so the tailnet can reach the LAN behind it. Standard tool for connecting office / home subnets.</> }, code: <code>$ tailscale up \\{'\n'}  --advertise-routes={n('192.168.1.0/24')}</code> },
    { tag: 'E', zh: { title: <>Exit node</>, desc: <>把整条出站流量走某个节点出 —— 在不可信网络上把"流量出口"固定到家里这台机。</> }, en: { title: <>Exit node</>, desc: <>Route all egress through a chosen node — pin "where my traffic exits the internet" to your home machine when on untrusted networks.</> }, code: <code>$ tailscale up \\{'\n'}  --exit-node={v('home-server')}</code> },
    { tag: 'F', zh: { title: <>MagicDNS + ts.net 域</>, desc: <>每张 tailnet 都拿一个 <code>*.tail&lt;hex&gt;.ts.net</code> 子域, 自动签 Let's Encrypt cert。https 直接可用。</> }, en: { title: <>MagicDNS + ts.net domain</>, desc: <>Every tailnet gets a <code>*.tail&lt;hex&gt;.ts.net</code> subdomain with auto-issued Let's Encrypt certs. HTTPS works out of the box.</> }, code: <code>{c('// 浏览器输入')}{'\n'}https://{v('alienware')}.tail{v('171d80')}.ts.net/</code> },
    { tag: 'G', zh: { title: <>Funnel</>, desc: <>把 tailnet 服务暴成公网 HTTPS URL。给同事 demo 本机 dev server 5 秒搞定, 不开端口、不配 cert。</> }, en: { title: <>Funnel</>, desc: <>Expose a tailnet service as a public HTTPS URL. Five-second demo flow — no port forwarding, no cert work.</> }, code: <code>$ tailscale funnel {n('5173')}</code> },
    { tag: 'H', zh: { title: <>tsnet</>, desc: <>Go 库, 让任意程序自带一张 tailnet 网卡。Hono / net.http server 一行 import 就只能从 tailnet 内访问。</> }, en: { title: <>tsnet</>, desc: <>Go library that gives any program a tailnet NIC. One import and your Hono / net.http server only listens inside the tailnet.</> }, code: <code>{k('import')} {s('"tailscale.com/tsnet"')}{'\n\n'}{v('srv')} := &{v('tsnet')}.{f('Server')}{'{}'}{'\n'}{v('ln')}, _ := {v('srv')}.{f('Listen')}({s('"tcp"')}, {s('":80"')})</code> },
  ],
  whyCards: [
    { icon: '⚙', zh: { title: <>装完就能用</>, desc: <>装客户端、登录、列表里看到自己设备 —— 完成。不开端口、不配证书、不记 IP。这种"零配置感"是它和传统 VPN 体感上最大的差。</> }, en: { title: <>Install and it works</>, desc: <>Install client, log in, see your device in the list — done. No port forwarding, no certs, no IPs. That zero-config feel is the gap between Tailscale and a traditional VPN.</> }, code: <code>$ tailscale up{'\n'}{c('# 60 秒到能 ping')}{'\n'}{c('# 60 seconds to first ping')}</code> },
    { icon: '⌬', zh: { title: <>点对点直连</>, desc: <>WireGuard 数据面 + NAT 穿透, 90% 以上场景路径是 P2P, 不绕中继。延迟接近原生 LAN, 不是传统 VPN 那种"全走一个数据中心"的拖累。</> }, en: { title: <>Peer-to-peer paths</>, desc: <>WireGuard data plane + NAT traversal: over 90% of the time the path is direct P2P, not relayed. Latency is near-LAN, not the "all traffic via one datacenter" drag of legacy VPNs.</> }, code: <code>$ tailscale ping {v('alienware')}{'\n'}{c('# direct, 8ms')}</code> },
    { icon: '⎇', zh: { title: <>身份化 ACL</>, desc: <>权限的主语不是 IP 是 user / group / tag。员工入职给账号自动进对应 group, 不写网络配置。撤销立即生效。</> }, en: { title: <>Identity-aware ACLs</>, desc: <>The subject of a permission is a user / group / tag — never an IP. Onboarding adds a member to a group; no network config touched. Revocation is instant.</> }, code: <code>{s('"src"')}: [{s('"group:dev"')}],{'\n'}{s('"dst"')}: [{s('"tag:server:*"')}]</code> },
    { icon: '⌁', zh: { title: <>HTTPS + 公网域名免费送</>, desc: <>tail&lt;hex&gt;.ts.net 子域 + Let's Encrypt cert 自动签 / 续。<code>tailscale cert</code> 一行命令拿到能用的 fullchain.pem。dev 环境本地 https 不再痛苦。</> }, en: { title: <>HTTPS + public hostname for free</>, desc: <>tail&lt;hex&gt;.ts.net subdomain + Let's Encrypt cert auto-issued and renewed. One <code>tailscale cert</code> call yields a usable fullchain.pem. Local HTTPS in dev stops hurting.</> }, code: <code>$ tailscale cert {v('alienware')}.tail{v('171d80')}.ts.net</code> },
    { icon: '⌖', zh: { title: <>跨平台覆盖完整</>, desc: <>macOS / Linux / Windows / iOS / Android / FreeBSD / OpenWrt 一齐有, 协议是同一份。手机 / 工作机 / 家庭路由器一锅炖。</> }, en: { title: <>Full cross-platform coverage</>, desc: <>macOS / Linux / Windows / iOS / Android / FreeBSD / OpenWrt — same protocol on all. Phone / work machine / home router on one mesh.</> }, code: <code>{c('// one binary, six OS targets')}</code> },
    { icon: '⌗', zh: { title: <>免费 100 节点</>, desc: <>个人 plan 给 3 user + 100 device, 工作流里基本撞不上。开发者口口相传的入口就是这个额度。</> }, en: { title: <>Free 100-node tier</>, desc: <>Personal plan: 3 users + 100 devices. Solo workflows essentially never hit it. This generous tier is the developer word-of-mouth engine.</> }, code: <code>{c('// $0/mo for up to 100 nodes')}</code> },
    { icon: '⏚', zh: { title: <>Headscale 逃生通道</>, desc: <>不想把控制面交给第三方? Headscale 是社区写的开源 coordination server, 协议兼容官方客户端。任何时候可以 self-host。</> }, en: { title: <>Headscale as exit</>, desc: <>Don't want a third party owning the control plane? Headscale is a community-built OSS coordination server that speaks the same protocol. Self-host whenever you want.</> }, code: <code>$ headscale serve{'\n'}{c('// 同一个 client 连过来')}{'\n'}{c('// same client connects')}</code> },
    { icon: '⛯', zh: { title: <>WireGuard 在内核</>, desc: <>数据面跑在 Linux 内核 WireGuard 模块, 不经用户态拷贝。吞吐和 CPU 占用直接拉满, 比 OpenVPN / IPsec 一档差距。</> }, en: { title: <>WireGuard in kernel</>, desc: <>The data plane is the Linux kernel WireGuard module — no userspace copies. Throughput / CPU cost is a generation ahead of OpenVPN / IPsec.</> }, code: <code>{c('// In-kernel: no userspace copy')}</code> },
    { icon: '⚐', zh: { title: <>ts.net 域 = 浏览器友好</>, desc: <>因为有公网可解析的 ts.net 域名 + 真 cert, 移动端浏览器 / WCA OAuth / WebAuthn 这些"要求 https + 真域名"的东西在 dev 时也能跑通。</> }, en: { title: <>ts.net = browser-friendly</>, desc: <>Because ts.net hostnames resolve publicly and ship real certs, mobile browsers / OAuth flows / WebAuthn (all of which demand HTTPS + a real domain) work straight from dev.</> }, code: <code>{c('// WCA OAuth callback works')}{'\n'}{c('// from a dev box')}</code> },
  ],
  adopters: [
    { name: 'Fly.io', href: 'https://fly.io', highlight: true, zhNote: '内部基础设施大量走 Tailscale 串联', enNote: 'Internal infrastructure stitched together over Tailscale' },
    { name: 'Hugging Face', href: 'https://huggingface.co', zhNote: '研究 / 训练机器间的私网走 Tailscale', enNote: 'Research / training machines wired via Tailscale' },
    { name: 'Anthropic', href: 'https://anthropic.com', zhNote: '公开 talk 里提过用 Tailscale 串内部工具', enNote: 'Public talks mention Tailscale for internal tooling' },
    { name: 'Headscale (OSS)', href: 'https://github.com/juanfont/headscale', zhNote: '社区版 coordination server, 协议兼容', enNote: 'Community coordination server, protocol-compatible' },
    { name: 'Mercury', zhNote: '远程团队走 Tailscale 接内部服务', enNote: 'Remote team uses Tailscale to reach internal services' },
    { name: 'GitHub engineers', href: 'https://github.com', zhNote: '不少员工在个人 / 远程 setup 上用', enNote: 'Many engineers use it in personal / remote setups' },
    { name: 'Cloudflare engineers', zhNote: '内部开发流程里常见', enNote: 'Common in internal dev workflows' },
    { name: '一人公司 / indie hackers', href: 'https://tailscale.com', zhNote: '免费 100 节点对个人开发者就是无限', enNote: '100-node free tier is effectively unlimited for solos' },
    { name: '远程 / 全分布团队', zhNote: '替代 OpenVPN / Cisco AnyConnect 的标准答案', enNote: 'The default replacement for OpenVPN / Cisco AnyConnect' },
    { name: 'NAS / homelab 圈', zhNote: 'Synology / TrueNAS / OpenWrt 都打包了客户端', enNote: 'Synology / TrueNAS / OpenWrt all ship the client' },
    { name: 'cuberoot.me', highlight: true, zhNote: '本站 dev server 跨设备共享靠它', enNote: 'This site — used for cross-device dev server sharing' },
  ],
  outlook: [
    { tag: <>HOT · 2026</>, hot: true, big: true, zh: { title: <>tsnet 把 mesh 嵌进进程</>, body: <><p>tsnet 是 Tailscale 写的 Go 库, 一行 import 就让你的 server 自带一张 tailnet 网卡。Hono / net.http 程序绑到 tsnet listener 上之后, 它只在 tailnet 内可达, 公网完全看不到。</p><p>这是一个比 "在主机上跑 tailscaled" 更精细的形态:服务自带身份, 不依赖宿主机的网络栈。给 sidecar / serverless / 临时容器场景特别合适。Rust binding 也在路上。</p></> }, en: { title: <>tsnet embeds the mesh in your process</>, body: <><p>tsnet is Tailscale's Go library — one import gives your server its own tailnet NIC. Bind a Hono / net.http server to a tsnet listener and it's reachable only inside the tailnet; the public internet never sees it.</p><p>This is finer-grained than "run tailscaled on the host": the service carries its own identity, independent of the host's network stack. A natural fit for sidecars / serverless / ephemeral containers. Rust bindings are on the way.</p></> } },
    { tag: 'SSH', zh: { title: <>Tailscale SSH 干掉 key 分发</>, body: <><p>把 SSH 认证接到 tailnet identity, 不再分发 SSH key。"给 user X 在 host Y 开 shell" 变成一行 ACL。审计日志、撤销、MFA 全自动走 SSO。</p></> }, en: { title: <>Tailscale SSH kills key distribution</>, body: <><p>SSH auth is wired to tailnet identity — no more SSH key distribution. "Give user X a shell on host Y" becomes one ACL line. Audit logs, revocation, and MFA all flow through SSO automatically.</p></> } },
    { tag: 'FUNNEL', zh: { title: <>本地服务 1 条命令变公网 HTTPS</>, body: <><p>Funnel 把 tailnet 内服务暴成公网 HTTPS URL, 自动 cert。"给同事 demo 本机 dev server" 这种场景从 ngrok / cloudflared 切到 Funnel 的迁移正在发生。</p></> }, en: { title: <>Local service to public HTTPS in one command</>, body: <><p>Funnel exposes a tailnet service as a public HTTPS URL with auto-issued certs. The "share my local dev server" migration from ngrok / cloudflared to Funnel is in progress.</p></> } },
    { tag: <>K8S</>, zh: { title: <>Kubernetes Operator GA</>, body: <><p>把 K8s Service 直接发布到 tailnet, 不再配 Ingress / LB / cert-manager。这块是 2025-2026 主推方向, 跟 sidecar 模型对接极顺。</p></> }, en: { title: <>Kubernetes Operator GA</>, body: <><p>Publishes K8s Services straight into a tailnet — no Ingress / LB / cert-manager plumbing. The big 2025-2026 push, dovetailing with the sidecar model.</p></> } },
    { tag: <>DATA</>, zh: { title: <>免费 100 节点仍然在</>, body: <><p>2026 年免费 plan 还是 3 user + 100 device。竞品 (ZeroTier / Twingate / Cloudflare Tunnel) 在免费档上至今没追上这个额度, 这是开发者社群里口口相传的核心引力。</p></> }, en: { title: <>The 100-node free tier still stands</>, body: <><p>In 2026 the free plan is still 3 users + 100 devices. No competitor (ZeroTier / Twingate / Cloudflare Tunnel) has matched that on the free tier, and that's the central word-of-mouth pull in the dev community.</p></> } },
  ],
  cuberoot: {
    zh: (
      <>
        <p>cuberoot.me 用 Tailscale 的姿势只有一个:<strong>跨设备共享本地 dev server</strong>。开发机跑 Vite (<code>http://127.0.0.1:5173/</code>), 加入 tailnet 之后, 在同 WiFi 下手机 / 平板直接打开 <code>https://alienware.tail171d80.ts.net/</code> 就能看实时 dev 页面 —— 真域名 + 真 cert, 不是局域网 IP 那种"浏览器一直警告"的状态。</p>
        <p>因为是真 https + 公网可解析的域名, WCA OAuth 也愿意把它当合法 callback。dev 流程里 3 个 callback 都已登记:<code>localhost</code> (PC 本机) / ts.net 子域 (同 WiFi 下手机) / <code>dev.cuberoot.me</code> (蜂窝网或 ts.net 不通时的备路, DNS A 记录另解析)。三条路覆盖了"我在哪都能登录 dev 实例"。</p>
        <p>这里踩过一个坑值得记:<strong>切 dev / prod API base 的判断永远走 <code>import.meta.env.DEV</code>, 不能用 <code>hostname === 'localhost'</code></strong>。因为 ts.net 子域 / <code>dev.cuberoot.me</code> 的 hostname 不是 localhost, 用 hostname 检测会被骗到 prod API base 上, 然后跨域被 CORS 拦死。<code>shared/</code> 包同理直接读 <code>(import.meta as {'{ env? }'}).env?.DEV</code>, 不能依赖任何 hostname。</p>
        <p>生产环境不在 tailnet 里 —— 部署是 nginx + 公网域名, Tailscale 只参与开发链路。整个站没有任何运行时依赖 tailnet (符合"自成一体"原则), 它纯粹是开发体验的放大器。</p>
      </>
    ),
    en: (
      <>
        <p>cuberoot.me uses Tailscale for exactly one thing: <strong>sharing a local dev server across devices</strong>. The dev box runs Vite at <code>http://127.0.0.1:5173/</code>; once it joins the tailnet, the phone or tablet on the same WiFi opens <code>https://alienware.tail171d80.ts.net/</code> directly and sees the live dev page — real hostname, real cert, none of the "browser keeps warning you about a LAN IP" pain.</p>
        <p>Because it's real HTTPS on a publicly resolvable hostname, WCA OAuth happily accepts it as a valid callback. Three callbacks are registered: <code>localhost</code> (PC), the ts.net subdomain (phone on the same WiFi), and <code>dev.cuberoot.me</code> (cellular fallback when ts.net isn't reachable, resolved via DNS A record). Three paths cover "log into the dev instance from anywhere."</p>
        <p>One gotcha worth recording: <strong>switch dev / prod API base via <code>import.meta.env.DEV</code>, never via <code>hostname === 'localhost'</code></strong>. The ts.net subdomain and <code>dev.cuberoot.me</code> aren't "localhost," so hostname checks point dev at the prod API base and get killed by CORS. The <code>shared/</code> package follows the same rule with <code>(import.meta as {'{ env? }'}).env?.DEV</code> — never branch on hostname.</p>
        <p>Production lives outside the tailnet — deployment is nginx + a public domain. Tailscale participates only in the development loop. The site has zero runtime dependency on the tailnet (in line with the "self-contained" principle); it is purely a developer-experience amplifier.</p>
      </>
    ),
  },
  links: [
    { label: 'tailscale.com', href: 'https://tailscale.com' },
    { label: 'GitHub · tailscale/tailscale', href: 'https://github.com/tailscale/tailscale' },
    { label: 'Changelog', href: 'https://tailscale.com/changelog' },
    { label: 'Headscale (OSS)', href: 'https://github.com/juanfont/headscale' },
  ],
};

export default TAILSCALE;
