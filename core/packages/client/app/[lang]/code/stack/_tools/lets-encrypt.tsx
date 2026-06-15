import type { StackTool } from '../_lib/stack_tool_types';
import { k, v, s, n, f, p, c, t } from '../_lib/stack_tool_types';

// ─── Let's Encrypt ──────────────────────────────────────────────────────────

export const LETSENCRYPT: StackTool = {
  slug: 'lets-encrypt',
  name: 'Let’s Encrypt',
  version: 'ACME v2',
  since: '2015-12',
  group: 'edge',
  accent: '#3777BE',
  bright: '#5FA0D9',
  glyph: 'LE',
  floats: ['ACME', 'RFC 8555', 'HTTP-01', 'DNS-01', 'TLS-ALPN-01', '90 day', '45 day', 'ARI', 'wildcard', 'staging', 'X1', 'X2'],
  zh: {
    tagline: '免费 + 全自动 + 全世界默认信任的 CA',
    role: '签 cuberoot.me / api.cuberoot.me / blog.cuberoot.me 三本证书,acme.sh + DNS-01 + systemd timer 全自动续。',
    heroSub: <>2015 年公开 beta,把 "HTTPS 要花钱、要手动续" 这两件事一次性<strong>从公网删掉</strong>。ISRG 这家非营利把协议 (ACME)、根证书 (ISRG Root X1 / X2)、运营、CA/Browser Forum 席位全部自己扛下来。十年后的 2026 年,它一天签 ~1000 万张证书,占公网新签发的 54%。</>,
    whatDesc: <>Let’s Encrypt 是一家<strong>公益 CA</strong>,由 ISRG (Internet Security Research Group) 运营,创立金主是 Mozilla / EFF / 密歇根大学 / Akamai / Cisco。它只签 DV (域名验证) 证书,不签 OV / EV;签发过程<strong>必须经由 ACME 协议自动化</strong>,没有人工申请通道。这种限制反过来逼整个生态把 "申证书 / 续证书" 当成跟 DNS 解析一样的基础设施层任务,而不是运维人手工活。</>,
    historyDesc: <>从 2014 年 ISRG 成立、2015 年 12 月公开 beta 起步,几个关键拐点:2018 年 ACME v2 + 通配符 (DNS-01);2019 年 RFC 8555 标准化;2020 年累计 10 亿张;2024 年 ARI (续期时机提示) 上线;2025 年 6 天短寿命证书 + IP-SAN 试点;2025 年 12 月十周年,宣布默认证书寿命 90 → 45 天的 roadmap。</>,
    conceptsTitle: 'ACME 协议核心',
    conceptsDesc: <>ACME v2 (RFC 8555) 就是一套 HTTP+JSON 的状态机:申请账号 → 下订单 → 完成 challenge → finalize → 拿证书。Challenge 有三种 (HTTP-01 / DNS-01 / TLS-ALPN-01),分别证明 "你控制这个 80 端口 / 这个域名的 DNS / 这个 443 端口"。</>,
    whyDesc: <>2026 年还要在<strong>付费 CA / ZeroSSL / 自签</strong>之间选,基本不用想 —— Let’s Encrypt 是唯一一个 <strong>免费 + 自动化 + 全世界默认信任 + 1000 万张/天验证过</strong>的组合。其它选项每条都缺一格。</>,
    adoptersTitle: '谁在用',
    adoptersDesc: <>不需要列名单,因为公网超过一半的 HTTPS 流量背后是 Let’s Encrypt 证书。Caddy / Traefik 默认就替你申,Cloudflare / Vercel / Netlify / Fly.io / GitHub Pages 给客户域名自动签 —— 用户根本不知道证书 issuer 是谁,只看到 https:// 那把锁。</>,
    cuberootDesc: <>cuberoot.me 三本证书全靠 acme.sh + DNS-01 (Cloudflare API) 自动签:<code>cuberoot.me</code> / <code>api.cuberoot.me</code> / <code>blog.cuberoot.me</code> 各一本 single-SAN,systemd timer 每天扫一次,30 天内到期就续 + reload nginx。</>,
    outlookTitle: '当下与前景',
    outlookDesc: <>未来五年 Let’s Encrypt 的方向其实很明确:寿命继续缩短 (90 → 45 → 最终目标 6 天)、IP 证书铺开、OCSP 替换成 CRL、ARI 让客户端续期时机分散得更均匀。它在把"证书"这个概念从"年度大事"变成"每周自动事件"。</>,
  },
  en: {
    tagline: 'Free, automated, universally trusted CA',
    role: 'Signs the three certs (cuberoot.me / api.cuberoot.me / blog.cuberoot.me) used across this site; acme.sh + DNS-01 + a systemd timer renews them with zero hand-holding.',
    heroSub: <>The 2015 public beta took two things off the public web in one shot: <strong>paying for HTTPS</strong> and <strong>renewing it by hand</strong>. ISRG, a nonprofit, runs the protocol (ACME), the roots (ISRG Root X1 / X2), the ops, and a seat at the CA/Browser Forum. Ten years in, 2026 throughput is roughly 10 million certs a day — about 54% of all new certs on the public web.</>,
    whatDesc: <>Let’s Encrypt is a <strong>nonprofit CA</strong> operated by ISRG (Internet Security Research Group). Founding sponsors: Mozilla, EFF, University of Michigan, Akamai, Cisco. It issues only DV (domain-validated) certs — no OV, no EV — and the entire issuance flow <strong>must run over ACME</strong>, with no human application channel. That restriction is what forced the ecosystem to treat "get / renew a cert" as infrastructure on the same plane as DNS lookup, rather than a sysadmin chore.</>,
    historyDesc: <>From the 2014 ISRG founding and the 2015-12 public beta, the pivots line up like this: ACME v2 + wildcards via DNS-01 (2018), RFC 8555 (2019), 1 billion certs cumulative (2020), ARI for renewal-timing hints (2024), 6-day short-lived certs + IP SANs to early adopters (2025), and the 10-year anniversary in 2025-12 — which announced the default cert lifetime moving from 90 to 45 days.</>,
    conceptsTitle: 'ACME protocol core',
    conceptsDesc: <>ACME v2 (RFC 8555) is a small HTTP+JSON state machine: new account → new order → complete challenge → finalize → fetch cert. Three challenge types (HTTP-01 / DNS-01 / TLS-ALPN-01) prove control over port 80, the DNS zone, or port 443 respectively.</>,
    whyDesc: <>In 2026, picking between <strong>paid CAs / ZeroSSL / self-signed</strong> is basically a non-decision — Let’s Encrypt is the only option that is <strong>free + automated + universally trusted + proven at 10M certs/day</strong>. Every alternative misses at least one of those.</>,
    adoptersTitle: 'Who uses it',
    adoptersDesc: <>You don’t list adopters when the answer is "more than half of all HTTPS on the public web." Caddy / Traefik issue automatically out of the box; Cloudflare / Vercel / Netlify / Fly.io / GitHub Pages sign per-customer-domain certs invisibly — end users only see the lock icon, never the issuer.</>,
    cuberootDesc: <>cuberoot.me’s three certs are signed via acme.sh + DNS-01 against the Cloudflare API: <code>cuberoot.me</code> / <code>api.cuberoot.me</code> / <code>blog.cuberoot.me</code>, each single-SAN. A systemd timer checks daily; anything inside the 30-day window gets renewed and nginx reloaded.</>,
    outlookTitle: 'Now and next',
    outlookDesc: <>The five-year direction is clear: shorter and shorter lifetimes (90 → 45 → an eventual 6-day target), IP-address certs going GA, OCSP being phased out in favor of CRLs, and ARI smoothing the global renewal stampede. Let’s Encrypt is moving "certificate" from a yearly event to a weekly automatic one.</>,
  },
  heroStats: [
    { num: '~10', unit: 'M', zh: <>每天签发证书数 <em>2026 Q1 · CT log</em></>, en: <>certs issued per day <em>2026 Q1 · CT log</em></>
    },
    { num: '54', unit: '%', zh: <>公网新签发占比 <em>2026 Q1</em></>, en: <>of new public-web issuance <em>2026 Q1</em></>
    },
    { num: '90', unit: 'd', zh: <>当前默认寿命 <em>2026 → 45d roadmap</em></>, en: <>current default lifetime <em>2026 → 45d roadmap</em></>
    },
    { num: '10', unit: 'y', zh: <>公开运营满 10 年 <em>2015-12 起</em></>, en: <>since the 2015-12 public beta <em>10 years</em></>
    },
  ],
  intro: {
    zh: (
      <>
        <p>2014 年之前,HTTPS 是个奢侈品 —— 一张证书 50 到 200 刀一年,买完还得手动塞进 nginx / Apache,过期前再手动续。<strong>大多数小网站根本不上 HTTPS。</strong> Mozilla 看不下去,联合 EFF、密歇根大学、Akamai、Cisco 成立了 ISRG (Internet Security Research Group),目标只有一个:把 HTTPS 的金钱成本和操作成本一次性按到地板上。</p>
        <p>2015-12-03 公开 beta 当天就签出了第一张公开信任证书。2016-04-12 GA。2018 年 ACME v2 上线,带来通配符证书 + DNS-01 挑战,这是 cuberoot.me 这种"主域加几个子域"的部署能用一条 DNS 记录搞定全部续签的关键。2019 年 RFC 8555 把 ACME v2 标准化,从此 ACME 不只是 Let’s Encrypt 的事 —— ZeroSSL / Buypass / Sectigo 也都按这个协议玩。</p>
        <p>2026 年的 Let’s Encrypt 已经是公网最大 CA:Q1 CT log 占比 54.4%, 一天签 ~1000 万张证书。2025 年 12 月十周年发布会上,ISRG 宣布默认寿命要从 90 天降到 45 天 (短期目标),长期目标是 6 天 (已经在试点),配合 ARI (ACME Renewal Information) 让全球客户端续期时间分布更均匀,避免雪崩。</p>
      </>
    ),
    en: (
      <>
        <p>Before 2014, HTTPS was a luxury — a cert ran $50–$200/year, you slotted it into nginx / Apache by hand, and you renewed it by hand before it expired. <strong>Most small sites simply ran on plaintext HTTP.</strong> Mozilla, EFF, the University of Michigan, Akamai, and Cisco co-founded ISRG (Internet Security Research Group) with one goal: collapse both the money cost and the operational cost of HTTPS to the floor, permanently.</p>
        <p>The 2015-12-03 public beta signed its first publicly-trusted cert on day one. GA followed on 2016-04-12. ACME v2 in 2018 brought wildcards via DNS-01 — which is exactly what makes "apex + a few subdomains" deployments like cuberoot.me’s renewable from one DNS record. RFC 8555 in 2019 standardized ACME v2, so ACME is no longer a Let’s Encrypt-only thing — ZeroSSL, Buypass, Sectigo all speak the same protocol now.</p>
        <p>In 2026, Let’s Encrypt is the largest CA on the public web: 54.4% of Q1 CT-log issuance, ~10M certs/day. At the 2025-12 ten-year anniversary, ISRG announced the default lifetime dropping from 90 to 45 days (near-term), with a 6-day long-term target already in pilot — alongside ARI (ACME Renewal Information) to smooth the global renewal stampede.</p>
      </>
    ),
  },
  history: [
    { year: '2014', zh: { title: <>ISRG 成立</>, desc: <>Mozilla / EFF / 密歇根大学 / Akamai / Cisco 联合出资成立 ISRG,目标:做一个免费、自动化、全公网信任的 CA。Josh Aas 任执行董事。</> }, en: { title: <>ISRG founded</>, desc: <>Mozilla, EFF, University of Michigan, Akamai, and Cisco co-fund ISRG with the goal of a free, automated, universally-trusted CA. Josh Aas as founding ED.</> } },
    { year: '2015·12', zh: { title: <>公开 beta</>, desc: <>12-03 第一张公开信任证书签出。最早的客户端 letsencrypt-auto (后来叫 certbot) 同期开源。</> }, en: { title: <>Public beta</>, desc: <>First publicly-trusted cert issued on 12-03. The original client (letsencrypt-auto, later certbot) is open-sourced in parallel.</> } },
    { year: '2016·04', zh: { title: <>GA</>, desc: <>04-12 正式 GA。Caddy 同年发布,默认配置就是自动申 Let’s Encrypt,把"开机即 HTTPS"这件事推到了消费级。</> }, en: { title: <>GA</>, desc: <>04-12 general availability. Caddy ships the same year with auto-issue on by default, taking "HTTPS on boot" mainstream.</> } },
    { year: '2018·03', zh: { title: <>ACME v2 + 通配符</>, desc: <>ACME v2 + DNS-01 挑战上线,通配符证书 (<code>*.example.com</code>) 第一次免费可申。从此一个 DNS 记录覆盖整个子域树。</> }, en: { title: <>ACME v2 + wildcards</>, desc: <>ACME v2 + DNS-01 challenge ships. Wildcard certs (<code>*.example.com</code>) become free for the first time. One DNS record now covers a whole subdomain tree.</> } },
    { year: '2019·03', zh: { title: <>RFC 8555</>, desc: <>ACME v2 标准化成 RFC 8555。其它 CA (ZeroSSL / Buypass / Sectigo) 跟进实现,ACME 从"一家的事"变成行业协议。</> }, en: { title: <>RFC 8555</>, desc: <>ACME v2 standardized as RFC 8555. Other CAs (ZeroSSL / Buypass / Sectigo) implement it; ACME becomes an industry protocol rather than one CA’s API.</> } },
    { year: '2020·02', zh: { title: <>累计 10 亿张</>, desc: <>GA 不到 4 年累计签发 10 亿张证书。HTTPS 在公网占比从 2015 年的 ~40% 涨到这年的 ~80%, 一半推力归 Let’s Encrypt。</> }, en: { title: <>1 billion certs cumulative</>, desc: <>Under 4 years post-GA, 1 billion certs issued cumulatively. Public HTTPS adoption climbs from ~40% in 2015 to ~80% in 2020 — half of that lift traces directly to Let’s Encrypt.</> } },
    { year: '2021·09', zh: { title: <>DST Root CA X3 过期</>, desc: <>原 cross-sign 根证书 DST Root CA X3 到期。老 Android / 老 OpenSSL 设备开始报 cert invalid,ISRG Root X1 接班。这是 Let’s Encrypt 历史上唯一一次大规模兼容事故。</> }, en: { title: <>DST Root CA X3 expires</>, desc: <>The original cross-sign root (DST Root CA X3) expires. Old Android / old OpenSSL devices start failing — ISRG Root X1 takes over. Let’s Encrypt’s one and only large-scale compatibility incident.</> } },
    { year: '2022·09', zh: { title: <>ISRG Root X2 + ECDSA</>, desc: <>X2 是 ECDSA 根证书,签发更小、握手更快的 P-384 证书。RSA 默认仍是 X1, 但 modern 客户端可以全程走 ECDSA。</> }, en: { title: <>ISRG Root X2 + ECDSA</>, desc: <>X2 is the ECDSA root, signing smaller, faster-handshake P-384 certs. RSA still defaults via X1; modern clients can run end-to-end ECDSA.</> } },
    { year: '2024·11', zh: { title: <>累计 30 亿 + ARI</>, desc: <>累计签发突破 30 亿。ARI (ACME Renewal Information) 让客户端在 CA 给的建议时间窗口续期,而不是固定到期前 30 天,避免全网客户端在同一刻挤兑。</> }, en: { title: <>3 billion cumulative + ARI</>, desc: <>Cumulative issuance crosses 3 billion. ARI (ACME Renewal Information) lets clients renew inside a CA-suggested window instead of a fixed T-30 days — smoothing what would otherwise be a global stampede.</> } },
    { year: '2025·01', zh: { title: <>6 天短寿命 + IP-SAN 试点</>, desc: <>01-16 推出 6 天短寿命证书 profile + IP 地址 SAN profile,先给早期采用者试。短寿命的核心 idea:吊销机制 (CRL/OCSP) 都靠不住,缩短寿命才是真兜底。</> }, en: { title: <>6-day short-lived + IP-SAN pilot</>, desc: <>01-16 ships a 6-day short-lived profile + IP-address SAN profile to early adopters. The thesis: revocation (CRL/OCSP) is never reliable; short lifetimes are the real fail-safe.</> } },
    { year: '2025·12', highlight: true, zh: { title: <>10 周年 + 寿命 45d roadmap</>, desc: <>公开 beta 满 10 年。同期发布会宣布默认寿命从 90 → 45 天 (近期),6 天 profile 走向 GA。Q1 2026 数据:占公网新签 54.4%, 每天 ~1000 万张。</> }, en: { title: <>10-year anniversary + 45-day roadmap</>, desc: <>10 years since the public beta. The anniversary keynote announces the default lifetime moving 90 → 45 days near-term, with the 6-day profile heading toward GA. Q1 2026 data: 54.4% of public-web issuance, ~10M certs/day.</> } },
    { year: '2026·05', highlight: true, zh: { title: <>当前状态</>, desc: <>每天 ~1000 万张, 公网默认信任最大 CA。ACME v2 / RFC 8555 是事实标准。寿命缩短 + 自动化 + ARI 三件事正在把 "证书运维" 这个职能从工程师日常里彻底删掉。</> }, en: { title: <>Current state</>, desc: <>~10M certs/day, the largest universally-trusted CA on the web. ACME v2 / RFC 8555 is the de facto standard. Shorter lifetimes + automation + ARI together are erasing "certificate ops" from the engineer’s daily list.</> } },
  ],
  concepts: [
    { tag: 'A', zh: { title: <>ACME v2 状态机</>, desc: <>申账号 → 下订单 → 完成挑战 → finalize → 取证。每一步都是 HTTP POST + JWS 签名的 JSON。</> }, en: { title: <>ACME v2 state machine</>, desc: <>new-account → new-order → complete challenge → finalize → download cert. Every step is JWS-signed JSON over HTTP POST.</> }, code: <code>{c('# 1. new account (JWS signed)')}{'\n'}{k('POST')} /acme/new-acct{'\n'}{c('# 2. new order')}{'\n'}{k('POST')} /acme/new-order{'\n'}  {p('identifiers')}: [{'{'}{p('type')}:{s('"dns"')},{p('value')}:{s('"cuberoot.me"')}{'}'}]{'\n'}{c('# 3. finalize → 4. cert URL')}{'\n'}{k('POST')} /acme/finalize/&lt;order&gt;</code> },
    { tag: 'B', zh: { title: <>HTTP-01 挑战</>, desc: <>最简单的一种:CA 给你一个 token, 你在 <code>http://你的域名/.well-known/acme-challenge/&lt;token&gt;</code> 路径返回它。证明你能控制 80 端口。</> }, en: { title: <>HTTP-01 challenge</>, desc: <>The simplest one. The CA gives you a token; you serve it at <code>http://your-domain/.well-known/acme-challenge/&lt;token&gt;</code>. Proves you control port 80.</> }, code: <code>{c('# CA fetches:')}{'\n'}{k('GET')} http://cuberoot.me/.well-known/{'\n'}    acme-challenge/{v('TOKEN')}{'\n\n'}{c('# Expected body:')}{'\n'}{v('TOKEN')}.{v('thumbprint')}</code> },
    { tag: 'C', zh: { title: <>DNS-01 挑战</>, desc: <>CA 给你一个 token, 你把它放进 <code>_acme-challenge.&lt;domain&gt;</code> 的 TXT 记录。<strong>这是申通配符 / IP 隔离环境唯一可用的方式</strong>。cuberoot.me 走这条。</> }, en: { title: <>DNS-01 challenge</>, desc: <>The CA gives you a token; you put it in a <code>_acme-challenge.&lt;domain&gt;</code> TXT record. <strong>The only path for wildcards and for hosts behind a firewall.</strong> cuberoot.me uses this.</> }, code: <code>{c('# Add TXT record:')}{'\n'}_acme-challenge.cuberoot.me{'\n'}  IN TXT {s('"<base64url token>"')}{'\n\n'}{c('# CA queries authoritative DNS')}{'\n'}{c('# (Cloudflare API for cuberoot.me)')}</code> },
    { tag: 'D', zh: { title: <>TLS-ALPN-01 挑战</>, desc: <>第三种,主要给只有 443 端口可暴露的边缘服务用 (Caddy / Traefik 内部用得多)。客户端在 443 上回一个特殊的 ALPN <code>acme-tls/1</code> handshake。</> }, en: { title: <>TLS-ALPN-01 challenge</>, desc: <>Used by edge proxies that only expose 443 (Caddy / Traefik use it internally). Client responds with a special <code>acme-tls/1</code> ALPN handshake on 443.</> }, code: <code>{c('// ALPN protocol:')}{'\n'}acme-tls/1{'\n\n'}{c('// Cert SAN includes:')}{'\n'}id-pe-acmeIdentifier{'\n'}  = SHA-256({v('keyAuthorization')})</code> },
    { tag: 'E', zh: { title: <>90 天默认寿命</>, desc: <>故意短。理由:CRL/OCSP 吊销机制延迟大、客户端兼容差,短寿命是更可靠的兜底。2026 年 roadmap 把这个默认值降到 45 天。</> }, en: { title: <>90-day default lifetime</>, desc: <>Deliberately short. Reasoning: CRL/OCSP revocation is laggy and clients don’t honor it reliably — short lifetimes are the more dependable fail-safe. The 2026 roadmap drops this default to 45 days.</> }, code: <code>{c('# openssl check')}{'\n'}{k('openssl')} x509 -in cert.pem \\{'\n'}  -noout -dates{'\n\n'}{t('notBefore')}=May 18 ...{'\n'}{t('notAfter')} ={v('Aug')} {n('16')} ... {c('# +90d')}</code> },
    { tag: 'F', zh: { title: <>ARI 续期提示</>, desc: <>ACME Renewal Information。客户端问 CA "什么时候续合适", CA 返回一个时间窗口 (比如 "提前 25-29 天")。把全网客户端的续期时间打散, 避免雪崩。</> }, en: { title: <>ARI renewal hints</>, desc: <>ACME Renewal Information. The client asks the CA "when should I renew?" and gets back a window (e.g. "T-25 to T-29 days"). Spreads renewals globally — no stampede.</> }, code: <code>{k('GET')} /acme/renewalInfo/{v('certId')}{'\n\n'}{'{'}{'\n'}  {p('suggestedWindow')}: {'{'}{'\n'}    {p('start')}: {s('"2026-07-22T..."')},{'\n'}    {p('end')}:   {s('"2026-07-26T..."')}{'\n'}  {'}'}{'\n'}{'}'}</code> },
    { tag: 'G', zh: { title: <>Staging 环境</>, desc: <>同一套 API,根证书<strong>不被信任</strong>,但 rate limit 宽松得多。所有自动化脚本第一次上线先在 staging 跑通再切 prod, 否则触发 rate limit 一周不能再签。</> }, en: { title: <>Staging environment</>, desc: <>Same API, root <strong>not trusted</strong>, but rate limits are far looser. Run every new automation against staging first; otherwise you hit the rate limit and can’t reissue for a week.</> }, code: <code>{c('# acme.sh --staging flag')}{'\n'}{k('acme.sh')} --issue --staging \\{'\n'}  -d cuberoot.me \\{'\n'}  --dns dns_cf{'\n\n'}{c('# directory URL:')}{'\n'}{c('# acme-staging-v02.api.le.org')}</code> },
    { tag: 'H', zh: { title: <>Rate limits</>, desc: <>关键几条:<strong>50 张 / 注册域 / 周</strong> (主域 = eTLD+1)、5 张完全重复 / 周、300 pending authorization / 账号。触发 rate limit 一律 7 天后才解。</> }, en: { title: <>Rate limits</>, desc: <>Key thresholds: <strong>50 certs per registered domain per week</strong> (eTLD+1), 5 duplicate certs per week, 300 pending authorizations per account. Any trip = wait 7 days.</> }, code: <code>{c('// hit the limit?')}{'\n'}{c('// → urn:ietf:params:acme:')}{'\n'}{c('//   error:rateLimited')}{'\n\n'}{k('curl')} -s https://crt.sh/?q=cuberoot.me \\{'\n'}  | {f('grep')} -c {s('"Let"')}</code> },
  ],
  whyCards: [
    { icon: '¤', zh: { title: <>免费</>, desc: <>付费 CA 50-200 刀/年/张,Let’s Encrypt 0 刀且无张数限制 (rate limit 内)。十年下来给公网省下的真实 TCO 是天文数字。</> }, en: { title: <>Free</>, desc: <>Paid CAs run $50–$200/year/cert; Let’s Encrypt is $0 with no count cap (within rate limits). The aggregate TCO saved across the public web in a decade is astronomical.</> }, code: <>{c('# paid CA: $99/yr')}{'\n'}{c('# LE: $0, unlimited within RL')}</> },
    { icon: '⚡', zh: { title: <>全自动 = 零运维</>, desc: <>certbot / acme.sh / Caddy 都能开机即跑。systemd timer 每天扫一次,到期前 30 天自动续 + reload。运维侧"证书"这件事可以从待办列表删掉。</> }, en: { title: <>Fully automated = zero ops</>, desc: <>certbot / acme.sh / Caddy run on boot. A systemd timer scans daily and renews + reloads within the 30-day window. "Certificates" gets removed from the ops to-do list.</> }, code: <>{k('systemctl')} list-timers acme.sh{'\n'}{c('# Daily at 03:00 UTC, automatic')}</> },
    { icon: '✓', zh: { title: <>全平台默认信任</>, desc: <>ISRG Root X1 (RSA) + X2 (ECDSA) 在所有 modern OS 的 trust store 里。Chrome / Safari / Firefox / curl / Node / Python 全部默认信任 —— 这是付费 CA 也做到的事, 但 LE 把它做到了 0 刀。</> }, en: { title: <>Universal default trust</>, desc: <>ISRG Root X1 (RSA) + X2 (ECDSA) ship in every modern OS trust store. Chrome / Safari / Firefox / curl / Node / Python all trust them by default — same as paid CAs, but at zero dollars.</> }, code: <>{k('curl')} https://cuberoot.me/{'\n'}{c('# Works without -k anywhere')}</> },
    { icon: '⌗', zh: { title: <>通配符 + 多 SAN 自由组合</>, desc: <>一张证书能同时挂主域 + 通配符 + 一堆子域 SAN。cuberoot.me 出于 SAN 简洁性故意拆三张,但拆不拆完全是自己选。</> }, en: { title: <>Wildcards + multi-SAN, your call</>, desc: <>One cert can carry the apex + a wildcard + a list of SAN subdomains. cuberoot.me deliberately splits into three single-SAN certs for clarity — but you can collapse them into one freely.</> }, code: <>{c('// one cert, many names')}{'\n'}SAN: cuberoot.me, *.cuberoot.me</> },
    { icon: '➜', zh: { title: <>ACME 是标准, 不锁厂</>, desc: <>同一套 acme.sh / certbot 客户端切到 ZeroSSL / Buypass 几乎是改一个 --server URL 的事。不像付费 CA 的 API 各自一套。</> }, en: { title: <>ACME is a standard, no vendor lock-in</>, desc: <>The same acme.sh / certbot client switches to ZeroSSL / Buypass by changing one --server URL. Unlike paid CAs, whose APIs are each their own snowflake.</> }, code: <>{k('acme.sh')} --set-default-ca \\{'\n'}  --server {s('"zerossl"')}</> },
    { icon: '∇', zh: { title: <>短寿命 = 强韧</>, desc: <>90 天默认 (45 天 roadmap), 6 天 profile 已经在试点。短寿命让"证书泄露"这件事的窗口从一年压到几天,远比依赖 CRL/OCSP 吊销可靠。</> }, en: { title: <>Short-lived = robust</>, desc: <>90 days default (45 in the roadmap), 6-day profile in pilot. Short lifetimes shrink the post-leak exposure window from a year to days — vastly more reliable than depending on CRL/OCSP revocation.</> }, code: <>{c('// 6-day pilot profile:')}{'\n'}{c('// expires before you notice the leak')}</> },
    { icon: '⛓', zh: { title: <>透明 + CT log 强制</>, desc: <>每张签发的证书都上 CT (Certificate Transparency) log。任何人可在 crt.sh 查到自己域名上所有签出过的证书 —— 这是付费 CA 上下其手时第一个露马脚的地方。</> }, en: { title: <>Transparent + CT-log required</>, desc: <>Every issued cert lands in a CT (Certificate Transparency) log. Anyone can audit all certs ever issued against their domain via crt.sh — usually the first place a paid CA misissuance shows up.</> }, code: <>{k('curl')} {s('"https://crt.sh/?q=cuberoot.me"')}{'\n'}{c('# All certs ever issued, public')}</> },
    { icon: '⚵', zh: { title: <>实战量级</>, desc: <>1000 万张/天,占公网新签 54%。任何 edge case 都被踩过了 —— 这一点付费 CA 没法比 (它们一年都没这么多张)。</> }, en: { title: <>Battle-tested at scale</>, desc: <>10M certs/day, 54% of public-web issuance. Every edge case has been hit and patched — something paid CAs can’t match (their annual volume doesn’t reach this).</> }, code: <>{c('// Q1 2026: ~10M/day')}{'\n'}{c('// Q1 2026: 54.4% share')}</> },
    { icon: '☢', zh: { title: <>非营利, 不会被收购</>, desc: <>ISRG 是 501(c)(3) 非营利。资金靠 Mozilla / EFF / Akamai / Cisco / Google / AWS 等赞助 + 个人捐款。结构上无法被收购,运营方向不会突然变。</> }, en: { title: <>Nonprofit, can’t be acquired</>, desc: <>ISRG is a 501(c)(3) nonprofit. Funded by Mozilla / EFF / Akamai / Cisco / Google / AWS sponsorships + individual donors. Structurally not acquirable; the mission can’t pivot under M&A pressure.</> }, code: <>{c('// 501(c)(3) — not for sale')}</> },
  ],
  adopters: [
    { name: 'Caddy', href: 'https://caddyserver.com', highlight: true, zhNote: '默认配置自动申 + 自动续, 把 HTTPS 推到消费级', enNote: 'Default config auto-issues + auto-renews, took HTTPS mainstream' },
    { name: 'Traefik', href: 'https://traefik.io', highlight: true, zhNote: 'k8s 流量入口标配, 一行 annotation 自动签', enNote: 'Standard ingress in k8s; one annotation = auto-issue' },
    { name: 'Cloudflare', href: 'https://cloudflare.com', highlight: true, zhNote: '边缘 TLS / Universal SSL 背后大量 LE 证书', enNote: 'Edge TLS / Universal SSL is heavily backed by LE certs' },
    { name: 'Vercel', href: 'https://vercel.com', zhNote: '客户域名挂上来后自动签发 + 续', enNote: 'Customer custom domains: auto-issue + auto-renew' },
    { name: 'Netlify', href: 'https://netlify.com', zhNote: '同 Vercel, 域名挂上来自动签', enNote: 'Same as Vercel: domain hookup = cert issued' },
    { name: 'Fly.io', href: 'https://fly.io', zhNote: '每个 app 子域自动签, 用户感知不到', enNote: 'Auto-signs every app subdomain transparently' },
    { name: 'GitHub Pages', href: 'https://pages.github.com', zhNote: '自定义域名的 HTTPS 全部走 LE', enNote: 'HTTPS for custom domains is 100% LE' },
    { name: 'Shopify', href: 'https://shopify.com', zhNote: '百万家店铺 storefront 证书签发', enNote: 'Storefront certs across millions of merchants' },
    { name: 'WordPress.com', href: 'https://wordpress.com', zhNote: '所有自定义域博客的 HTTPS', enNote: 'HTTPS for every custom-domain blog' },
    { name: 'Apache HTTP + certbot', href: 'https://certbot.eff.org', zhNote: 'EFF 维护的官方客户端, Apache / nginx 都覆盖', enNote: 'EFF-maintained reference client; covers Apache + nginx' },
    { name: 'acme.sh', href: 'https://acme.sh', zhNote: '纯 shell 实现, dns_* 插件覆盖 150+ DNS 服务商', enNote: 'Pure-shell implementation; dns_* plugins for 150+ DNS providers' },
    { name: 'cuberoot.me', highlight: true, zhNote: 'cuberoot.me / api.cuberoot.me / blog.cuberoot.me 三本证书, acme.sh + DNS-01 自动续', enNote: 'Three certs (cuberoot.me / api.cuberoot.me / blog.cuberoot.me), acme.sh + DNS-01 auto-renewed' },
  ],
  outlook: [
    { tag: <>HOT · 2025-12</>, hot: true, big: true, zh: { title: <>默认寿命 90 → 45 天</>, body: <><p>十周年发布会上 ISRG 宣布:近期目标默认寿命从 90 天降到 45 天。意义不是"少几天",而是"逼整个生态把自动化做扎实"—— 90 天还能勉强手动续, 45 天基本逼到必须 ACME 全自动。</p><p>这一脚同时把整个 CA 行业的 baseline 拉高:CA/Browser Forum 2025 年已经在讨论行业最高寿命从 398 天往下压, Let’s Encrypt 这一步是行业方向的先行指标。</p></> }, en: { title: <>Default lifetime 90 → 45 days</>, body: <><p>At the 10-year keynote, ISRG announced the near-term default dropping from 90 to 45 days. The point isn’t "a few fewer days" — it’s forcing the ecosystem to take automation seriously. 90 days could be limped through manually; 45 cannot.</p><p>The move also drags the industry baseline. CA/Browser Forum is already debating tightening the industry-wide cap below 398 days in 2025 — Let’s Encrypt is the leading indicator.</p></> } },
    { tag: <>SHORT</>, hot: true, zh: { title: <>6 天短寿命 + IP 证书</>, body: <><p>2025-01 推出的 6 天 short-lived profile 已经在早期采用者跑了一年, 准备走向 GA。逻辑很直接:寿命短到 6 天, 证书泄露 = 5 天内自动作废。CRL / OCSP 这套 revocation 基础设施直接绕过。</p><p>同期 IP 地址 SAN profile 也铺开 —— 给 edge service / 没有 DNS 的内部网关签 IP 证书, 不用再绕一层域名。</p></> }, en: { title: <>6-day short-lived + IP certs</>, body: <><p>The 6-day profile from 2025-01 has been in early-adopter production for a year and is heading to GA. The logic is direct: shrink the lifetime to 6 days and "cert leak" auto-resolves inside five days. The whole CRL / OCSP revocation stack gets sidestepped.</p><p>The IP-address SAN profile is rolling alongside — edge services and internal gateways without DNS can finally get certs without inventing a domain.</p></> } },
    { tag: <>OCSP</>, zh: { title: <>OCSP 退役, 转 CRL</>, body: <><p>2025 年起 Let’s Encrypt 开始关掉 OCSP responder, 转用 CRL (Certificate Revocation List)。理由:OCSP 每次 TLS 握手要打一个外部请求, 隐私 + 延迟 + 单点故障都不行;CRL 是浏览器侧拉一份大列表本地查, 浏览器厂商已经在做 (CRLite / OneCRL)。</p></> }, en: { title: <>OCSP retired in favor of CRL</>, body: <><p>From 2025, Let’s Encrypt is winding down OCSP responders in favor of CRLs (Certificate Revocation Lists). Reasoning: OCSP requires an external request per TLS handshake — bad for privacy, latency, and single point of failure. CRLs are pulled and queried locally; browsers (Mozilla CRLite, Chrome OneCRL) already do this.</p></> } },
    { tag: <>ARI</>, zh: { title: <>ARI 让续期"打散"</>, body: <><p>没 ARI 之前,所有客户端默认在"到期前 30 天"续,签发量越大越像 DDoS。ARI 让 CA 主动给每个客户端一个 4 天的随机化窗口, 全球续期负载平摊到每天均匀流量。2026 年这是默认行为。</p></> }, en: { title: <>ARI smooths the renewal curve</>, body: <><p>Pre-ARI, every client defaulted to "renew at T-30 days," and at LE scale that looks like a DDoS against the issuance API. ARI gives each client a personalized 4-day window, so global renewals smear into steady daily traffic. As of 2026, it’s the default.</p></> } },
    { tag: <>POST-Q</>, zh: { title: <>后量子签名实验</>, body: <><p>ISRG 在 IETF / NIST PQC 工作组里牵头推进 post-quantum 证书签名 (ML-DSA / Falcon)。还很早期 —— 公钥几 KB 一张, TLS 握手会胖一圈, 但量子破 RSA 真发生那天, CA 系统迁过去要十年准备, 现在就得开始。</p></> }, en: { title: <>Post-quantum signature pilots</>, body: <><p>ISRG is leading the post-quantum certificate signing work (ML-DSA / Falcon) in IETF / NIST PQC. Still very early — keys are several KB per cert, handshakes fatten — but the day RSA falls to quantum, the CA system needs a decade of runway. It starts now.</p></> } },
  ],
  cuberoot: {
    zh: (
      <>
        <p>cuberoot.me 一共三本证书:<code>cuberoot.me</code> / <code>api.cuberoot.me</code> / <code>blog.cuberoot.me</code>, 每本 single-SAN, 故意不走通配符 —— 子域数量不多, 拆开签发让证书指纹和到期日各自独立, debug 时一眼能定位是哪本出问题。</p>
        <p>签发流程全部在云端 VM 上用 <code>acme.sh + dns_cf</code> (Cloudflare API plugin) 跑 DNS-01 挑战。选 DNS-01 的关键理由:不用暴露 80 端口给 ISRG 验证, 也不用因为 cuberoot.me 走 nginx 反代 + WordPress 静态归档 + Hono API 三块拼装而单独给 challenge 路径开口子。整套挑战在 DNS 层完成, 跟 80/443 端口配置完全解耦。</p>
        <p>续期靠 acme.sh 自带的 systemd timer (<code>acme.sh.timer</code>), 每天 03:00 UTC 跑一次 <code>--cron</code>。到期前 30 天内的证书自动 renew + 调 deploy hook reload nginx。证书文件落在 <code>~/.acme.sh/&lt;domain&gt;_ecc/</code>, nginx vhost 直接 include 那里的 fullchain.cer + key。整个流程从 2024 年到现在没人工干预过一次。</p>
        <p>2026 年后续如果 Let’s Encrypt 把默认寿命降到 45 天 (已宣布 roadmap), cuberoot.me 这边什么都不用改 —— acme.sh + ARI 会自动按 CA 建议的时间窗口续。同步看 OCSP 退役这件事, nginx 那行 <code>ssl_stapling on</code> 在 OCSP 完全关掉之前是无害的, 但年底前会改成 CRL-based 验证 / 或者直接关掉 stapling。</p>
      </>
    ),
    en: (
      <>
        <p>cuberoot.me runs three certs total: <code>cuberoot.me</code> / <code>api.cuberoot.me</code> / <code>blog.cuberoot.me</code>, each single-SAN. Wildcards were deliberately not used — the subdomain count is small, separate certs give each its own fingerprint and expiry, and a debug session can point at the failing cert immediately.</p>
        <p>Issuance runs on the cloud VM via <code>acme.sh + dns_cf</code> (Cloudflare API plugin) over DNS-01. Why DNS-01: no need to expose port 80 to ISRG for validation, and no need to poke a hole through the nginx reverse proxy + WordPress static archive + Hono API stack just for the challenge path. The whole proof happens at the DNS layer, fully decoupled from the 80/443 config.</p>
        <p>Renewal is acme.sh’s own systemd timer (<code>acme.sh.timer</code>) running <code>--cron</code> daily at 03:00 UTC. Any cert inside its 30-day window is renewed and the deploy hook reloads nginx. Cert files land in <code>~/.acme.sh/&lt;domain&gt;_ecc/</code>; the nginx vhost reads fullchain.cer + key directly from there. The flow has not been touched by hand since 2024.</p>
        <p>If Let’s Encrypt drops the default lifetime to 45 days (already on the roadmap), cuberoot.me changes nothing — acme.sh + ARI will renew on the CA-suggested cadence automatically. On the OCSP retirement: the <code>ssl_stapling on</code> line in nginx is harmless until OCSP responders disappear entirely, but will be flipped to CRL-based verification (or simply removed) before year-end.</p>
      </>
    ),
  },
  links: [
    { label: 'letsencrypt.org', href: 'https://letsencrypt.org' },
    { label: 'RFC 8555 — ACME v2', href: 'https://datatracker.ietf.org/doc/html/rfc8555' },
    { label: 'acme.sh', href: 'https://acme.sh' },
    { label: 'certbot (EFF)', href: 'https://certbot.eff.org' },
    { label: 'crt.sh — CT log search', href: 'https://crt.sh' },
  ],
};

export default LETSENCRYPT;
