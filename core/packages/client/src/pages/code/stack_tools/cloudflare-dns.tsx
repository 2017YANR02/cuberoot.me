import type { StackTool } from '../stack_tool_types';
import { s, n, c, t } from '../stack_tool_types';

// ─── Cloudflare DNS ─────────────────────────────────────────────────────────

export const CLOUDFLARE_DNS: StackTool = {
  slug: 'cloudflare-dns',
  name: 'Cloudflare DNS',
  version: 'authoritative',
  since: '2009-09',
  group: 'edge',
  accent: '#F38020',
  bright: '#F8A85B',
  glyph: 'CF',
  floats: ['anycast', 'NS', 'A', 'AAAA', 'CNAME', 'TXT', 'CAA', 'DNSSEC', 'grey-cloud', 'apex-flatten', 'DoH', 'Terraform'],
  zh: {
    tagline: '权威 DNS + 全球 anycast 网络',
    role: '托管整个 cuberoot.me zone, 仅做权威 DNS, 不走 proxy。每条记录灰云。',
    heroSub: <>Cloudflare 2009 年 9 月在 TechCrunch Disrupt 上线时, 主打的就是 anycast DNS + 反代两件事。十六年后, 它的权威 DNS 端是 330+ PoP 的 anycast 网络, 公共递归 <code>1.1.1.1</code> 每天回 ~4.3 万亿次查询。重要前提:两者是<strong>两个不同产品</strong>, 别混。</>,
    whatDesc: <>这里说的是 <strong>权威 DNS</strong> (zone hosting), 不是 <code>1.1.1.1</code> 公共递归。权威 DNS 的工作是:当全网询问"cuberoot.me 的 A 记录是什么", Cloudflare 的 330+ PoP 同时能用 anycast 答。免费、不限 zone 数、API 完整、DNSSEC 一键开。</>,
    historyDesc: <>2009 创立, 2010 anycast 铺开, 2014 Universal SSL 让"全网 HTTPS" 一夜变成默认, 2018-04-01 推 <code>1.1.1.1</code> 公共递归 (跟 APNIC 合作), 2019 NYSE 上市 (NET), 2024 免费 zone 加 200 条记录上限。十六年时间, 公网域名超过 20% 经过它的 DNS 或反代。</>,
    conceptsTitle: 'Zone + 记录类型 + anycast',
    conceptsDesc: <>DNS 的工作就是把"域名 → IP / 文本 / 邮件路由" 这张表 host 起来, anycast 让全球任何位置查询都落到最近的 PoP。Cloudflare 这一段免费, 不限 zone 数, API 一行加记录。</>,
    whyDesc: <>选 Cloudflare DNS 不是因为 "顺手过 Cloudflare CDN" —— 这里只用它的<strong>权威 DNS</strong>。zero cost + anycast + REST API + DNSSEC, 还能<strong>灰云</strong>跳过它的 WAF / cache 完全不暴露源站给它的边缘。</>,
    adoptersTitle: '谁在用',
    adoptersDesc: <>~20%+ 的公网站点跟 Cloudflare DNS 或反代有接触。Discord / Shopify / Stack Overflow / Medium / Coinbase / Vimeo / 大量大学和 npm 的 npmjs.com 都在它的 DNS 上。</>,
    cuberootDesc: <>cuberoot.me 整个 zone 都 host 在 Cloudflare DNS, 但<strong>每一条记录都灰云</strong> —— A / AAAA / MX / TXT / CAA 全部 authoritative-only, 不走它的边缘反代。真实流量永远直连 cuberoot.me 的服务器, Cloudflare 在证书链里的唯一角色是 acme.sh dns_cf 插件用 API 写一次 <code>_acme-challenge</code> TXT 记录。</>,
    outlookTitle: '当下与前景',
    outlookDesc: <>330+ PoP 网络, anycast DNS + 1.1.1.1 + Workers + R2 + D1 整个生态在 2026 继续扩。免费 DNS 的位置应该不会变, Cloudflare 也明说权威 DNS 永远免费。变数在 1.1.1.1 端 (隐私 / 监管 / DoH default-on)。</>,
  },
  en: {
    tagline: 'Authoritative DNS + global anycast network',
    role: 'Hosts the entire cuberoot.me zone. Authoritative only, grey-cloud on every record.',
    heroSub: <>Cloudflare launched at TechCrunch Disrupt in September 2009 with anycast DNS + reverse proxy as its two core products. Sixteen years later, the authoritative DNS side runs on a 330+ PoP anycast network, and the public recursive <code>1.1.1.1</code> answers ~4.3 trillion queries a day. Critical premise: these are <strong>two different products</strong>, don't conflate them.</>,
    whatDesc: <>This page is about <strong>authoritative DNS</strong> (zone hosting), not the <code>1.1.1.1</code> public recursive resolver. The authoritative DNS job is: when the world asks "what's the A record for cuberoot.me," Cloudflare's 330+ PoPs all answer via anycast. Free, unlimited zones, full REST API, one-click DNSSEC.</>,
    historyDesc: <>Founded 2009, anycast rolled out by 2010, Universal SSL in 2014 turned "HTTPS for everyone" into the overnight default, <code>1.1.1.1</code> public recursive launched 2018-04-01 with APNIC, 2019 IPO on NYSE (NET), 2024 capped free zones at 200 records. In sixteen years, more than 20% of public domains touch its DNS or proxy at some point.</>,
    conceptsTitle: 'Zone + record types + anycast',
    conceptsDesc: <>The DNS job is to host the "name → IP / text / mail-routing" table; anycast routes every query, from anywhere on earth, to the nearest PoP. Cloudflare's slice of this is free, unlimited zones, one-line REST add.</>,
    whyDesc: <>Picking Cloudflare DNS isn't a "may as well front Cloudflare CDN" decision — this site uses <strong>only</strong> the authoritative DNS. Zero cost + anycast + REST API + DNSSEC, plus <strong>grey-cloud</strong> means we bypass their WAF / cache entirely and never expose the origin to their edge.</>,
    adoptersTitle: 'Who uses it',
    adoptersDesc: <>More than 20% of public sites touch Cloudflare DNS or proxy at some point. Discord / Shopify / Stack Overflow / Medium / Coinbase / Vimeo / many universities and npm's npmjs.com all sit on their DNS.</>,
    cuberootDesc: <>The full cuberoot.me zone is hosted on Cloudflare DNS, but <strong>every record is grey-cloud</strong> — A / AAAA / MX / TXT / CAA all authoritative-only, no edge proxy. Real traffic always flows direct to the cuberoot.me server. Cloudflare's only role in the certificate chain is acme.sh's dns_cf plugin writing one <code>_acme-challenge</code> TXT record via API.</>,
    outlookTitle: 'Now and next',
    outlookDesc: <>330+ PoPs, anycast DNS + 1.1.1.1 + Workers + R2 + D1 — the whole stack keeps expanding into 2026. The free-DNS position is unlikely to change; Cloudflare has stated authoritative DNS is permanently free. The drama, if any, sits on the 1.1.1.1 side (privacy / regulation / DoH default-on).</>,
  },
  heroStats: [
    { num: '330', unit: '+', zh: <>全球 anycast PoP <em>2026-05 公告</em></>, en: <>anycast PoPs worldwide <em>2026-05 disclosure</em></> },
    { num: '4.3', unit: 'T', zh: <>1.1.1.1 日查询 <em>2025 reports</em></>, en: <>1.1.1.1 daily queries <em>2025 reports</em></> },
    { num: '20', unit: '%+', zh: <>公网站点接触 CF <em>DNS / proxy</em></>, en: <>of public sites touch CF <em>DNS / proxy</em></> },
    { num: '17', unit: 'y', zh: <>权威 DNS 自 2009 <em>核心产品</em></>, en: <>auth DNS since 2009 <em>core product</em></> },
  ],
  intro: {
    zh: (
      <>
        <p>Cloudflare 2009 年 9 月在 TechCrunch Disrupt 上公开 demo, 创始人是 Matthew Prince、Lee Holloway、Michelle Zatlyn。它一开始就是两件事:一个 anycast 全球网, 一个反向代理 / DNS 入口。先免费拿用户、再用流量数据反过来卖企业产品 (WAF / DDoS 防护 / 速度优化), 这套商业模式跑通了 —— 2019 年 NYSE 上市, 股票代码 NET。</p>
        <p>本页讲的是它的 <strong>权威 DNS hosting</strong> (zone 托管), 不是同名容易混淆的 <code>1.1.1.1</code> 公共递归解析器。两个是不同产品: 权威 DNS 是"当外面问 cuberoot.me 的 IP 时, 由 Cloudflare 来答"; 1.1.1.1 是"你的 PC / 手机问别人的域名 IP 时, 走 Cloudflare 帮你查"。1.1.1.1 是 2018-04-01 才跟 APNIC 合作上线的, 权威 DNS 端从 2009 就是核心产品。</p>
        <p>选它的原因很简单:Route 53 按 zone + 按查询收费, 业余项目挂个域名得月付几刀;自己跑 BIND 在 VPS 上违背"DNS 必须比 origin 长命"的本质;注册商自带 DNS (GoDaddy / Namecheap 一类) anycast 弱、没像样的 API。Cloudflare 给的组合是 anycast + REST API + DNSSEC + 不限 zone 数 + 永久免费, 而且 <strong>可以灰云只用 DNS 不进它的边缘反代</strong> —— cuberoot.me 就是这么用的。</p>
      </>
    ),
    en: (
      <>
        <p>Cloudflare debuted at TechCrunch Disrupt in September 2009. Founders: Matthew Prince, Lee Holloway, Michelle Zatlyn. From day one it was two products: a global anycast network and a reverse-proxy / DNS entry point. Free-tier first to harvest users and traffic data, then enterprise products (WAF / DDoS protection / speed optimization) on top — the model worked. NYSE IPO in 2019, ticker NET.</p>
        <p>This page is about the <strong>authoritative DNS hosting</strong> (zone hosting), not the easily-confused <code>1.1.1.1</code> public recursive resolver. They are different products: authoritative DNS is "Cloudflare answers when the world asks for cuberoot.me's IP"; 1.1.1.1 is "your PC / phone asks Cloudflare to look up someone else's domain on your behalf." 1.1.1.1 only launched 2018-04-01 in partnership with APNIC; the authoritative DNS side has been a core product since 2009.</p>
        <p>The picking logic is simple. Route 53 charges per zone + per query — a hobby domain costs a few dollars a month. Self-hosted BIND on your own VPS violates the fundamental "DNS must outlive the origin." Registrar-bundled DNS (GoDaddy / Namecheap and friends) has weak anycast and no real API. Cloudflare gives the combination of anycast + REST API + DNSSEC + unlimited zones + permanent free — and crucially, <strong>you can stay grey-cloud and never let traffic enter their edge proxy</strong>. That's exactly how cuberoot.me uses it.</p>
      </>
    ),
  },
  history: [
    { year: '2009·09', zh: { title: <>TechCrunch Disrupt 公开</>, desc: <>Matthew Prince、Lee Holloway、Michelle Zatlyn 三人在 Disrupt 上线 Cloudflare, 同时推出反向代理 + DNS。免费层从第一天就有。</> }, en: { title: <>Debut at TechCrunch Disrupt</>, desc: <>Matthew Prince, Lee Holloway, Michelle Zatlyn launch Cloudflare at Disrupt with reverse proxy + DNS together. The free tier exists from day one.</> } },
    { year: '2010', zh: { title: <>Anycast 网络铺开</>, desc: <>从最初几个 PoP 扩到几十个, 同一 IP 在全球被宣告, 用户的 BGP 把请求路由到最近的 PoP。后面所有 Cloudflare 产品的物理基础都在这里。</> }, en: { title: <>Anycast network rollout</>, desc: <>From a handful of PoPs to dozens. The same IPs are announced globally; the user's BGP routes the request to the nearest PoP. The physical foundation of every later Cloudflare product is built here.</> } },
    { year: '2014·09', zh: { title: <>Universal SSL</>, desc: <>免费给所有 Cloudflare 客户在边缘开 TLS。这一举动一年里让全球 HTTPS 比例上了一大跳, 是 HTTPS 普及曲线上单点最大的推手之一。</> }, en: { title: <>Universal SSL</>, desc: <>Free TLS at the edge for every Cloudflare customer. Within a year it bumped global HTTPS adoption by a noticeable amount — one of the single biggest pushes on that curve.</> } },
    { year: '2018·04', zh: { title: <>1.1.1.1 公共递归</>, desc: <>4 月 1 日跟 APNIC 合作上线 <code>1.1.1.1</code> 公共递归解析器, 主打隐私 + 速度 + DoH / DoT。<strong>跟权威 DNS 是两个不同产品</strong>。</> }, en: { title: <>1.1.1.1 public recursive</>, desc: <>April 1: <code>1.1.1.1</code> public recursive resolver launches in partnership with APNIC. Pitched on privacy + speed + DoH / DoT. <strong>A different product from authoritative DNS.</strong></> } },
    { year: '2019·09', zh: { title: <>NYSE 上市 (NET)</>, desc: <>IPO 上市, 股票代码 NET。资金加速 anycast 网络扩张, 之后每年加几十个 PoP。</> }, en: { title: <>NYSE IPO (NET)</>, desc: <>IPO on NYSE, ticker NET. Capital accelerates anycast buildout — dozens of new PoPs land each year afterwards.</> } },
    { year: '2021·12', zh: { title: <>DNSSEC 一键 + Terraform</>, desc: <>DNSSEC 在 dashboard 上变成"打开开关 + 把 DS 复制到 registrar"。Terraform provider 成熟, zone as code 走向主流。</> }, en: { title: <>DNSSEC one-click + Terraform</>, desc: <>DNSSEC becomes "toggle + copy DS to your registrar" in the dashboard. The Terraform provider matures; zone-as-code goes mainstream.</> } },
    { year: '2023·05', zh: { title: <>Workers 成旗舰</>, desc: <>边缘计算 Workers + R2 (S3 兼容存储) + D1 (SQLite 边缘) 加固生态。DNS API 保持免费 + 不限速。</> }, en: { title: <>Workers becomes flagship</>, desc: <>Edge compute Workers + R2 (S3-compatible storage) + D1 (SQLite at the edge) reinforce the ecosystem. The DNS API stays free and unmetered.</> } },
    { year: '2024·09', zh: { title: <>免费 zone 200 条记录上限</>, desc: <>新建的免费 zone 上限 200 条 DNS 记录 (legacy zones 仍然是 1000)。zone 总数不限, 单 zone 不能再当无限纸塞数据。</> }, en: { title: <>Free-tier 200-record cap</>, desc: <>New free zones are capped at 200 DNS records (legacy zones keep the 1000 limit). Zone count is still unlimited, but a single zone can no longer be used as an infinite scratch pad.</> } },
    { year: '2025·07', zh: { title: <>4T queries / day 数字</>, desc: <>1.1.1.1 公共递归报到每天 ~4 万亿次查询。权威 DNS 端的 anycast 网络规模也跟着扩。</> }, en: { title: <>~4T queries / day</>, desc: <>1.1.1.1 public recursive reports about 4T queries a day. The authoritative DNS side's anycast network scales alongside.</> } },
    { year: '2026·05', highlight: true, zh: { title: <>330+ PoP / 4.3T 日查询</>, desc: <>2026-05 网络规模 330+ PoP, 1.1.1.1 ~4.3T queries / day。权威 DNS API 仍然免费 + 不限速, 新建免费 zone 200 条记录上限不变。</> }, en: { title: <>330+ PoPs / 4.3T daily queries</>, desc: <>2026-05: network at 330+ PoPs, 1.1.1.1 at ~4.3T queries / day. The authoritative DNS API stays free and unmetered; the 200-record cap on new free zones is unchanged.</> } },
  ],
  concepts: [
    { tag: 'A', zh: { title: <>权威 NS</>, desc: <>注册商把域名指到 Cloudflare 的两个 NS (典型 <code>xxx.ns.cloudflare.com</code>), 从此 cuberoot.me 的所有查询都由 Cloudflare 答。</> }, en: { title: <>Authoritative NS</>, desc: <>The registrar delegates the domain to two Cloudflare NSs (typically <code>xxx.ns.cloudflare.com</code>). From there on, every query for cuberoot.me is answered by Cloudflare.</> }, code: <code>cuberoot.me. {n('86400')} {t('IN NS')} ada.ns.cloudflare.com.{'\n'}cuberoot.me. {n('86400')} {t('IN NS')} bart.ns.cloudflare.com.</code> },
    { tag: 'B', zh: { title: <>A / AAAA</>, desc: <>把名字指到 IPv4 / IPv6。cuberoot.me 的 apex / api / blog 三个 A 全部直接指源站, 没有中间层。</> }, en: { title: <>A / AAAA</>, desc: <>Maps a name to IPv4 / IPv6. The apex / api / blog A records all point straight at the origin VM — no intermediate layer.</> }, code: <code>cuberoot.me. {n('300')} {t('IN A')}     203.0.113.5{'\n'}api.cuberoot.me. {n('300')} {t('IN A')} 203.0.113.5</code> },
    { tag: 'C', zh: { title: <>CNAME + apex flatten</>, desc: <>子域可以 CNAME 到别处。Cloudflare 允许 apex (根域) 也写 CNAME, 后台自动 flatten 成 A —— 这是它相对其它 DNS 的一个独特能力。</> }, en: { title: <>CNAME + apex flatten</>, desc: <>Subdomains can CNAME to elsewhere. Cloudflare uniquely allows CNAME at the apex (root) and silently flattens it to A — a feature most other DNS providers don't offer.</> }, code: <code>www.cuberoot.me. {n('300')} {t('IN CNAME')} cuberoot.me.</code> },
    { tag: 'D', zh: { title: <>TXT + CAA + MX</>, desc: <>SPF / DKIM / DMARC 走 TXT, CAA 限定哪些 CA 能签证书 (cuberoot.me 锁 Let's Encrypt), MX 走 MX 记录。每种类型都有专用编辑器。</> }, en: { title: <>TXT + CAA + MX</>, desc: <>SPF / DKIM / DMARC go through TXT; CAA restricts which CAs can issue certs (cuberoot.me locks Let's Encrypt); mail routes via MX. Each type has its own editor in the dashboard.</> }, code: <code>cuberoot.me. {t('IN TXT')}  {s('"v=spf1 -all"')}{'\n'}cuberoot.me. {t('IN CAA')}  {n('0')} issue {s('"letsencrypt.org"')}</code> },
    { tag: 'E', zh: { title: <>DNSSEC</>, desc: <>dashboard 上一键开, 拿到一段 DS, 复制到 registrar 完成信任链。开了之后任何途中篡改 DNS 响应都会被解析器拒掉。</> }, en: { title: <>DNSSEC</>, desc: <>Toggle on in the dashboard, copy the DS record into your registrar to complete the chain of trust. Once enabled, any in-flight tampering with the DNS response is rejected by resolvers.</> }, code: <code>cuberoot.me. {t('IN DS')} {n('12345')} {n('13')} {n('2')} A3B4...{'\n'}{c('# copy DS into the registrar')}</code> },
    { tag: 'F', zh: { title: <>灰云 vs 橘云</>, desc: <>Cloudflare 每条记录可以选灰云 (DNS only, 直连源站) 或橘云 (流量穿 CF 边缘反代)。cuberoot.me 的每一条都灰云, 不进它的 WAF / cache / 边缘。</> }, en: { title: <>Grey-cloud vs orange-cloud</>, desc: <>Each Cloudflare record can be grey-cloud (DNS only, direct to origin) or orange-cloud (traffic transits the CF edge proxy). Every cuberoot.me record is grey-cloud — never enters their WAF / cache / edge.</> }, code: <code>{c('# grey-cloud = authoritative only')}{'\n'}{c('# orange-cloud = proxy + WAF + cache')}</code> },
    { tag: 'G', zh: { title: <>REST API + Terraform</>, desc: <>整个 zone 都能用 REST API 管理。Terraform provider 让"zone as code" 进 git。acme.sh 的 dns_cf 插件就是吃这个 API 一次性写 challenge TXT。</> }, en: { title: <>REST API + Terraform</>, desc: <>The full zone is API-manageable. The Terraform provider puts "zone as code" into git. acme.sh's dns_cf plugin uses this API to write the challenge TXT one-shot.</> }, code: <code>$ curl -X POST {s('"$BASE/zones/$ZID/dns_records"')} \\{'\n'}    -H {s('"Authorization: Bearer $TOKEN"')} \\{'\n'}    --data {s('\'{"type":"TXT","name":"_acme-challenge","content":"xxx","ttl":120}\'')}</code> },
    { tag: 'H', zh: { title: <>DoH / DoT</>, desc: <>1.1.1.1 这一端公共递归支持 DoH (HTTPS) / DoT (TLS), 浏览器 / 系统级 DNS 加密走它。<strong>仍然跟权威 DNS 是两件事</strong>。</> }, en: { title: <>DoH / DoT</>, desc: <>The 1.1.1.1 public recursive supports DoH (over HTTPS) / DoT (over TLS) for encrypted browser / OS-level DNS. <strong>Still a different product from authoritative DNS.</strong></> }, code: <code>https://cloudflare-dns.com/dns-query?{'\n'}  name=cuberoot.me{'\n'}  type=A</code> },
  ],
  whyCards: [
    { icon: '⚙', zh: { title: <>Anycast 全球免费</>, desc: <>330+ PoP 同一组 NS IP 同时被宣告, 用户的 BGP 路由到最近 PoP。<strong>不要钱</strong>。Route 53 / DNSMadeEasy 给同等 anycast 至少十几刀起步。</> }, en: { title: <>Anycast for free, globally</>, desc: <>330+ PoPs announce the same NS IPs simultaneously; the user's BGP routes them to the nearest PoP. <strong>Free.</strong> Route 53 / DNSMadeEasy charge at least double digits a month for the same anycast.</> }, code: <>{c('# 330+ PoP from one IP')}</> },
    { icon: '⌬', zh: { title: <>API + Terraform 完整</>, desc: <>不用 dashboard 也能管完整 zone。<code>acme.sh --dns dns_cf</code> 这种自动化只需要一个 token 就跑通。</> }, en: { title: <>Complete API + Terraform</>, desc: <>You can manage an entire zone without the dashboard. Automation like <code>acme.sh --dns dns_cf</code> works with just one API token.</> }, code: <>$ acme.sh --issue --dns dns_cf -d cuberoot.me</> },
    { icon: '⎇', zh: { title: <>灰云保住隐私</>, desc: <>灰云 (DNS only) 让 Cloudflare 完全不看流量, 只答 DNS。这对不想让边缘看到 TLS 内容、不想被 WAF 误杀的站点是关键。</> }, en: { title: <>Grey-cloud preserves privacy</>, desc: <>Grey-cloud (DNS only) means Cloudflare never sees the traffic — they only answer DNS. Critical for sites that don't want the edge inspecting TLS or being WAF'd by mistake.</> }, code: <>{c('# proxied = false (grey)')}</> },
    { icon: '⌁', zh: { title: <>apex CNAME flatten</>, desc: <>大多数 DNS 不允许 apex 写 CNAME (DNS spec 不允许)。Cloudflare 后台 flatten 成 A, 让 apex 可以指向第三方 CDN / 托管服务。</> }, en: { title: <>apex CNAME flatten</>, desc: <>Most DNS providers ban apex CNAMEs (the DNS spec forbids it). Cloudflare silently flattens them to A under the hood, so the apex can point at a third-party CDN / managed service.</> }, code: <>cuberoot.me. CNAME other.example.com.</> },
    { icon: '⌖', zh: { title: <>DNSSEC 一键</>, desc: <>开关一切, 出来一段 DS, 贴到 registrar 完成信任链。中间篡改全失败。Route 53 也支持但配起来要 6 步, 这里 2 步。</> }, en: { title: <>One-click DNSSEC</>, desc: <>Toggle, copy the DS, paste into the registrar — chain complete. Any in-flight tampering breaks. Route 53 also supports it but takes 6 steps; this is 2.</> }, code: <>{c('# 1. toggle in dashboard')}{'\n'}{c('# 2. paste DS at registrar')}</> },
    { icon: '⌗', zh: { title: <>不限 zone 数</>, desc: <>多个域名一起管? 一个账号挂十几个 zone 全免费。Route 53 是 $0.50/zone/月, 十个 zone 一年就 60 刀。</> }, en: { title: <>Unlimited zones</>, desc: <>Multiple domains on one account? A dozen zones all free. Route 53 is $0.50/zone/month — ten zones is $60 a year.</> }, code: <>{c('# all free, unlimited zones')}</> },
    { icon: '⏚', zh: { title: <>1.1.1.1 顺手得</>, desc: <>非权威端的 <code>1.1.1.1</code> 公共递归免费 + 隐私承诺 + DoH / DoT, 大量 OS / 路由器默认配。<strong>但跟权威 DNS 是两个产品。</strong></> }, en: { title: <>1.1.1.1 as a bonus</>, desc: <>The non-authoritative side: the <code>1.1.1.1</code> public recursive is free + privacy-promised + DoH / DoT, the default in many OS / routers. <strong>Still a separate product from authoritative DNS.</strong></> }, code: <>nameserver 1.1.1.1</> },
    { icon: '⛯', zh: { title: <>DNS 必须比 origin 长命</>, desc: <>源服务器挂了一周, 但 DNS 还能正常解析, 用户至少看到正确错误页 / 维护页。自己跑 BIND 在 origin VM 上违背这一条。</> }, en: { title: <>DNS must outlive the origin</>, desc: <>If the origin server is down for a week, DNS still resolves and users at least see the right error / maintenance page. Self-hosted BIND on the origin VM violates that.</> }, code: <>{c('# origin down ≠ DNS down')}</> },
    { icon: '⚐', zh: { title: <>16 年 OSS / 开放生态</>, desc: <>Cloudflare API 文档 / Terraform / acme 集成 / 中间件全生态都开放, 改 provider 不像被某些黑盒 DNS 绑死。</> }, en: { title: <>16 years of an open ecosystem</>, desc: <>Cloudflare API docs / Terraform / acme integrations / middleware ecosystem are all open. Switching providers isn't the lock-in nightmare some black-box DNS shops impose.</> }, code: <>{c('# docs at developers.cloudflare.com')}</> },
  ],
  adopters: [
    { name: 'Discord', highlight: true, href: 'https://discord.com', zhNote: 'discord.com / discordapp.com zones on Cloudflare', enNote: 'discord.com / discordapp.com zones on Cloudflare' },
    { name: 'Shopify', highlight: true, href: 'https://shopify.com', zhNote: '商家自定义域 + 边缘 + DNS', enNote: 'Merchant custom domains + edge + DNS' },
    { name: 'Stack Overflow', highlight: true, href: 'https://stackoverflow.com', zhNote: '整个 Stack Exchange 网络都跑 CF', enNote: 'The whole Stack Exchange network runs on CF' },
    { name: 'Medium', href: 'https://medium.com', zhNote: '主站 DNS + 边缘', enNote: 'Primary DNS + edge' },
    { name: 'Coinbase', href: 'https://coinbase.com', zhNote: '加密交易所边缘 + DNS', enNote: 'Crypto exchange edge + DNS' },
    { name: 'Vimeo', href: 'https://vimeo.com', zhNote: '视频站 + DNS 全套', enNote: 'Video site + DNS full stack' },
    { name: 'Crunchyroll', href: 'https://crunchyroll.com', zhNote: '流媒体 + DNS', enNote: 'Streaming + DNS' },
    { name: 'npm (npmjs.com)', href: 'https://npmjs.com', zhNote: 'JS 包注册中心权威 DNS 走 Cloudflare', enNote: 'Authoritative DNS for the JS package registry' },
    { name: 'OkCupid', href: 'https://okcupid.com', zhNote: '老牌 DNS + 边缘客户', enNote: 'Long-time DNS + edge customer' },
    { name: 'Many universities (.edu)', zhNote: '一大批美国大学的 zone 在 Cloudflare', enNote: 'A large cohort of US universities host zones on Cloudflare' },
    { name: 'TechCrunch / Disrupt', href: 'https://techcrunch.com', zhNote: '当年发布舞台, 自己也在跑', enNote: 'The launch stage; now runs on it themselves' },
    { name: 'cuberoot.me', highlight: true, zhNote: '本站权威 DNS, 每条记录灰云, 不走边缘反代', enNote: 'This site\'s authoritative DNS — every record grey-cloud, no edge proxy' },
  ],
  outlook: [
    { tag: <>HOT · 2026</>, hot: true, big: true, zh: { title: <>330+ PoP / 4.3T 日查询</>, body: <><p>到 2026-05 anycast 网络扩到 330+ PoP, 1.1.1.1 公共递归每天 ~4.3 万亿次查询。绝对规模和延迟数字都没竞品能匹配。</p><p>权威 DNS 端的 API <strong>明确承诺永远免费 + 不限速</strong>, 不限 zone 数。这是 Cloudflare 在 DNS 这一段维持市场份额最关键的一个承诺, 短期内不会变。</p></> }, en: { title: <>330+ PoPs / 4.3T daily queries</>, body: <><p>By 2026-05 the anycast network spans 330+ PoPs, with the 1.1.1.1 public recursive answering ~4.3T queries a day. Neither absolute scale nor latency numbers have a real competitor.</p><p>On the authoritative side, the API <strong>is explicitly promised permanently free + unmetered</strong>, with unlimited zones. This is the single most important commitment for keeping Cloudflare's DNS market share, and it's not going to change short-term.</p></> } },
    { tag: 'API', zh: { title: <>Terraform / GitOps 成熟</>, body: <><p>Cloudflare Terraform provider 在 2025 升 v5, zone as code 完全可生产, drift detection 工作正常。"DNS 改动走 PR, merge 自动 apply" 是中型团队的默认。</p></> }, en: { title: <>Terraform / GitOps matures</>, body: <><p>The Cloudflare Terraform provider hit v5 in 2025; zone-as-code is fully production with working drift detection. "DNS changes go through PRs, merge auto-applies" is the default for medium-sized teams.</p></> } },
    { tag: 'DNSSEC', zh: { title: <>多算法 + KSK 轮转</>, body: <><p>2025 起 ECDSA P-256 (algorithm 13) 全面默认, 配合 dashboard 一键 KSK rotation。"DNSSEC 难配置" 这个十几年的劝退原因被 Cloudflare 这一段砍掉。</p></> }, en: { title: <>Multi-algorithm + KSK rotation</>, body: <><p>ECDSA P-256 (algorithm 13) is now default since 2025, paired with one-click KSK rotation in the dashboard. The decade-long "DNSSEC is too hard to configure" deterrent is gone, at least on Cloudflare's side.</p></> } },
    { tag: <>FREE-CAP</>, zh: { title: <>免费层 200 条上限</>, body: <><p>2024-09 起新建免费 zone 上限 200 条 DNS 记录 (legacy zones 仍然是 1000)。zone 总数仍不限, 单 zone 不能再当无限纸塞 wildcard subdomain。对 cuberoot.me 这种正常 zone 完全够用 (10 条不到)。</p></> }, en: { title: <>Free-tier 200-record cap</>, body: <><p>Since 2024-09, new free zones are capped at 200 records (legacy zones keep the 1000 limit). Zone count is still unlimited, but a single zone can no longer be the infinite wildcard-subdomain dumping ground. For normal zones like cuberoot.me (fewer than 10 records), the cap is irrelevant.</p></> } },
    { tag: <>1.1.1.1</>, zh: { title: <>公共递归与监管</>, body: <><p>1.1.1.1 公共递归在隐私 / 监管 / DoH default-on 各方向都有压力。但这跟权威 DNS 是不同战场 —— 1.1.1.1 出事不影响 cuberoot.me 的 zone 解析正确性, 因为 cuberoot.me 的查询是别人的递归解析器去问 Cloudflare 权威 NS, 不经过 1.1.1.1。</p></> }, en: { title: <>Public recursive and regulation</>, body: <><p>The 1.1.1.1 public recursive faces pressure on multiple fronts: privacy, regulation, browser-default DoH. But it's a different battlefield from authoritative DNS — incidents on 1.1.1.1 don't affect cuberoot.me's zone resolution, because queries for cuberoot.me go from someone else's recursive resolver straight to Cloudflare's authoritative NSes and never touch 1.1.1.1.</p></> } },
  ],
  cuberoot: {
    zh: (
      <>
        <p>cuberoot.me 整个 zone 都<strong>权威 host</strong> 在 Cloudflare DNS 上。registrar 那边把 NS 指到 <code>ada.ns.cloudflare.com</code> / <code>bart.ns.cloudflare.com</code> 这种两条记录, 完事。zone 里的所有记录现在都在 Cloudflare dashboard / API 上管, 想加子域加一条 A 就行, anycast 330+ PoP 一分钟内全球生效。</p>
        <p>关键决策是<strong>每一条记录都灰云</strong>。apex <code>A cuberoot.me</code> 指源 IP, <code>api.cuberoot.me</code> 指同一个 IP, <code>blog.cuberoot.me</code> 同, MX / TXT / CAA 各自该写啥就写啥。一条 orange-cloud 都没有 —— 所有流量直连 cuberoot.me 的服务器, Cloudflare 完全不进 TLS 链路, 不看请求内容, 不挂 WAF, 不缓存。它对 cuberoot.me 来说就是一张可编辑的 DNS 表 + 一个 anycast 网。</p>
        <p>Cloudflare 在证书链里的唯一角色是:Let's Encrypt 用 DNS-01 challenge 验证域名所有权时, acme.sh 用 <code>dns_cf</code> 插件吃 Cloudflare API token 在 <code>_acme-challenge.cuberoot.me</code> 下临时写一条 TXT, 验证完删掉。这一次 API 调用是 Cloudflare 唯一参与到 cuberoot.me 流量里的瞬间, 之后证书一签下来直接装到 nginx 上, 跟 Cloudflare 再无关系。</p>
        <p>这种用法的核心好处:DNS 比 origin 长命。源服务器挂了一周, NS 仍然 anycast 330+ PoP 答 cuberoot.me 的 A, 用户访问会看到正确的"无法连接源", 不是 "DNS 查不到"。同时 Cloudflare 不知道任何用户访问 cuberoot.me 的内容 —— 它只知道 "有人在问 cuberoot.me 的 IP", 仅此而已。</p>
      </>
    ),
    en: (
      <>
        <p>The full cuberoot.me zone is <strong>authoritative-hosted</strong> on Cloudflare DNS. The registrar delegates NS to two records like <code>ada.ns.cloudflare.com</code> / <code>bart.ns.cloudflare.com</code>, end of story. From there, every record in the zone is managed via the Cloudflare dashboard / API: adding a subdomain is one A record, and the 330+ PoP anycast network propagates within a minute.</p>
        <p>The key decision is that <strong>every record is grey-cloud</strong>. <code>A cuberoot.me</code> at the apex points at the origin IP; <code>api.cuberoot.me</code> at the same IP; <code>blog.cuberoot.me</code> the same; MX / TXT / CAA written as needed. Not one orange-cloud — all traffic goes direct to the cuberoot.me server. Cloudflare does not terminate TLS, never inspects request bodies, runs no WAF, caches nothing. For cuberoot.me, Cloudflare is just an editable DNS table behind a global anycast network.</p>
        <p>Cloudflare's only role in the certificate chain is this: when Let's Encrypt does a DNS-01 challenge to prove domain ownership, acme.sh's <code>dns_cf</code> plugin uses a Cloudflare API token to write a temporary TXT at <code>_acme-challenge.cuberoot.me</code>, then deletes it after validation. That one API call is the only moment Cloudflare touches any cuberoot.me traffic. Once the cert is signed it ships straight to nginx and has no further dependency on Cloudflare.</p>
        <p>The core benefit of this setup: DNS outlives the origin. If the origin VM is down for a week, the NSes still anycast-answer the A record for cuberoot.me from 330+ PoPs, so users see the correct "cannot connect to origin" error instead of a "DNS lookup failed" mystery. At the same time, Cloudflare has zero visibility into what any user reads on cuberoot.me — they only know "someone asked for the IP of cuberoot.me," and nothing more.</p>
      </>
    ),
  },
  links: [
    { label: 'cloudflare.com', href: 'https://www.cloudflare.com' },
    { label: 'DNS docs', href: 'https://developers.cloudflare.com/dns/' },
    { label: '1.1.1.1 (different product!)', href: 'https://1.1.1.1' },
    { label: 'API reference', href: 'https://developers.cloudflare.com/api/' },
  ],
};

export default CLOUDFLARE_DNS;
