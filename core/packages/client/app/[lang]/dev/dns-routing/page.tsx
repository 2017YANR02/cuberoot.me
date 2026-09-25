'use client';

import Image from 'next/image';
import { ArrowDown, ArrowRight, ArrowUpRight, Globe2, MapPin, Server } from 'lucide-react';
import AppLink from '@/components/AppLink';
import HeaderToggles from '@/components/HeaderToggles';
import JsonLd, { articleJsonLd } from '@/components/JsonLd';
import { useT } from '@/hooks/useT';
import { tr, useLang } from '@/i18n/tr';
import { PAGE_META } from '@/lib/page-meta';
import './dns-routing.css';

const SOURCES = [
  { href: 'https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/', zh: 'Cloudflare：完整接入与 NS', en: 'Cloudflare: full setup and nameservers' },
  { href: 'https://developers.cloudflare.com/dns/zone-setups/partial-setup/', zh: 'Cloudflare：保留外部 DNS 的部分接入', en: 'Cloudflare: partial setup with external DNS' },
  { href: 'https://developers.cloudflare.com/pages/configuration/custom-domains/', zh: 'Cloudflare Pages：子域名与裸域', en: 'Cloudflare Pages: subdomains and apex domains' },
  { href: 'https://www.alibabacloud.com/help/en/dns/pubz-intelligent-parsing-related-faq', zh: '阿里云：智能解析的来源判断', en: 'Alibaba Cloud: how geo DNS determines location' },
  { href: 'https://www.alibabacloud.com/help/en/dns/pubz-faq-related-to-domain-name-resolution-resolution-records', zh: '阿里云：URL 转发与 HTTPS 限制', en: 'Alibaba Cloud: URL forwarding and HTTPS' },
  { href: 'https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/', zh: 'Cloudflare Workers：Next.js 部署', en: 'Cloudflare Workers: Next.js deployment' },
  { href: 'https://developers.cloudflare.com/workers/platform/limits/', zh: 'Cloudflare Workers：套餐与静态资产限制', en: 'Cloudflare Workers: plan and asset limits' },
  { href: 'https://developers.cloudflare.com/china-network/get-started/', zh: 'Cloudflare：中国网络的订阅条件', en: 'Cloudflare: China Network requirements' },
  { href: 'https://ynca.miit.gov.cn/zwgk/zcwj/flfg/art/2024/art_2e96227c42924af9b49b7f13b81fd124.html', zh: '工信部：非经营性互联网信息服务备案管理办法', en: 'MIIT: ICP filing rules' },
  { href: 'https://www.cac.gov.cn/2024-03/22/c_1712776611775634.htm', zh: '国家网信办：促进和规范数据跨境流动规定', en: 'CAC: cross-border data flow rules' },
] as const;

export default function DnsRoutingPage() {
  const t = useT();
  const lang = useLang();
  const meta = PAGE_META['dev/dns-routing'];
  const url = 'https://cuberoot.me/' + (lang === 'zh' ? 'zh/' : '') + 'dev/dns-routing';
  const toc = [
    ['request', t('打开网页时发生什么', 'How a page opens')],
    ['current', t('本站现在怎么走', 'The current routes')],
    ['nameservers', t('NS 到底是什么', 'What NS means')],
    ['redirect', t('分流与跳转', 'Routing versus redirects')],
    ['cloudflare', t('CF 免费版能做到什么', 'What CF Free allows')],
    ['operations', t('迁移和合规', 'Migration and compliance')],
  ];

  return (
    <main className="dns-page">
      <JsonLd data={articleJsonLd({
        headline: tr(meta.title),
        description: tr(meta.description!),
        url,
        lang,
        partOfName: 'CubeRoot Dev',
        partOfUrl: 'https://cuberoot.me/' + (lang === 'zh' ? 'zh/' : '') + 'dev',
      })} />
      <div className="dns-wrap">
        <header className="dns-topbar">
          <AppLink href="/dev" prefetch={false} className="dns-brand">CubeRoot <span>/ dev / DNS</span></AppLink>
          <HeaderToggles />
        </header>

        <article>
          <header className="dns-hero">
            <p className="dns-series">{t('网络基础 · 第 01 篇', 'NETWORK BASICS · 01')}</p>
            <h1>{t('同一个网址，为什么会打开不同的服务器？', 'Why can one URL reach different servers?')}</h1>
            <p className="dns-deck">{t('以 cuberoot.me 为例，说明浏览器怎样找到网站、国内外为何会走不同线路、301 为何会改网址；最后回答：Cloudflare 免费版能否让国内走阿里云、国外走 CF，同时保持 cuberoot.me 不变。', 'Using cuberoot.me, this guide explains how a browser finds the site, why China and overseas traffic can take different routes, and why a 301 changes the URL. It then asks whether Cloudflare Free can serve the overseas route while China stays on Alibaba and the URL remains cuberoot.me.')}</p>
            <div className="dns-hero-rule"><span>cuberoot.me</span><span>{t('访问路径说明 · 2026 年 9 月 25 日快照', 'Request routing · snapshot from 25 Sep 2026')}</span></div>
            <figure className="dns-cover">
              <Image src="/assets/dev/dns-routing/route-map.svg?v=2" alt={t('示意图：同一个网址先经过 DNS 查询，然后国内和海外连接分别到达阿里云服务器与 Vercel', 'Diagram: the same URL is resolved by DNS, then China and overseas connections reach Alibaba Cloud and Vercel respectively')} width={1200} height={560} priority unoptimized />
              <figcaption>{t('这是一张访问过程示意图。线路由 DNS 查询来源决定，不表示精确地理位置。', 'A process illustration. DNS query origin influences the route; positions are not geographic coordinates.')}</figcaption>
            </figure>
          </header>

          <nav className="dns-toc" aria-label={t('文章目录', 'Contents')}>
            {toc.map(([id, label], index) => <a href={'#' + id} key={id}><span>{String(index + 1).padStart(2, '0')}</span>{label}</a>)}
          </nav>

          <section className="dns-section dns-intro" id="request">
            <SectionTitle number="01" label={t('先从一次访问说起', 'START WITH A PAGE VISIT')} title={t('输入网址后，浏览器做了四件事', 'Four steps between a URL and a page')} />
            <p className="dns-prose">{t('“网址”和“服务器地址”不是一回事。浏览器认识 cuberoot.me 这个名字，但建立连接需要 IP 地址。因此，打开页面时先有 DNS 查询，之后才有 HTTPS 请求。', 'A domain name and a server address are different things. The browser knows the name cuberoot.me, but needs an IP address to connect. DNS resolution happens before the HTTPS request.')}</p>
            <ol className="dns-steps">
              <li><span>1</span><div><h3>{t('输入网址', 'Enter the URL')}</h3><p>{t('地址栏是 https://cuberoot.me。此时还没有联系网站服务器。', 'The address bar contains https://cuberoot.me. No site server has been contacted yet.')}</p></div></li>
              <li><span>2</span><div><h3>{t('查询 DNS', 'Resolve the domain')}</h3><p>{t('浏览器通过递归 DNS 找到这个域名的权威名称服务器，再得到一个可连接的地址。', 'A recursive resolver finds the authoritative nameservers and obtains a connectable address.')}</p></div></li>
              <li><span>3</span><div><h3>{t('建立 HTTPS 连接', 'Connect with HTTPS')}</h3><p>{t('浏览器连接 DNS 给出的目标，并验证服务器证书是否覆盖 cuberoot.me。', 'The browser connects to the returned destination and checks that its certificate covers cuberoot.me.')}</p></div></li>
              <li><span>4</span><div><h3>{t('取得页面', 'Receive the page')}</h3><p>{t('服务器返回 HTML、脚本、图片和数据。只有服务器另发 301/302，浏览器才会改写地址栏。', 'The server returns HTML, scripts, images and data. The address bar changes only if the server sends a redirect such as 301 or 302.')}</p></div></li>
            </ol>
          </section>

          <section className="dns-section" id="current">
            <SectionTitle number="02" label={t('本站的实际配置', 'THE SITE TODAY')} title={t('国内与海外，网址相同，目标不同', 'The URL stays the same; the destination differs')} />
            <p className="dns-prose">{t('截至 2026 年 9 月 25 日，cuberoot.me 的权威 NS 是阿里云的 dns3.hichina.com 与 dns4.hichina.com。阿里云 DNS 为主域配置了分线路解析。国内查询得到 47.97.30.181，进入自有服务器的 nginx 和 Next.js；海外查询得到 216.198.79.1，进入 Vercel。', 'On 25 September 2026, the authoritative NS for cuberoot.me were Alibaba’s dns3.hichina.com and dns4.hichina.com. AliDNS returned 47.97.30.181 for the China line, reaching the self-hosted nginx and Next.js server, and 216.198.79.1 for the overseas line, reaching Vercel.')}</p>
            <figure className="dns-flow">
              <div className="dns-flow-visitor"><Globe2 size={20} /><span>https://cuberoot.me</span></div>
              <div className="dns-flow-arrow"><ArrowDown size={17} /><small>{t('查询 DNS', 'DNS query')}</small></div>
              <div className="dns-flow-resolver"><strong>{t('阿里云权威 DNS', 'Alibaba authoritative DNS')}</strong><small>dns3.hichina.com · dns4.hichina.com</small></div>
              <div className="dns-flow-branches">
                <div className="dns-flow-branch">
                  <MapPin size={20} />
                  <span>{t('国内解析线路', 'China DNS line')}</span>
                  <strong>47.97.30.181</strong>
                  <small>{t('阿里云服务器 → nginx → Next.js', 'Alibaba server → nginx → Next.js')}</small>
                  <div className="dns-address">🔒 cuberoot.me</div>
                </div>
                <div className="dns-flow-branch">
                  <Globe2 size={20} />
                  <span>{t('海外解析线路', 'Overseas DNS line')}</span>
                  <strong>216.198.79.1</strong>
                  <small>Vercel → Next.js</small>
                  <div className="dns-address">🔒 cuberoot.me</div>
                </div>
              </div>
              <figcaption>{t('图中省略独立的 API、静态资源、博客等域名。IP 是当日使用国内与海外客户端子网查询所得，后续调整 DNS 时会变化。', 'Independent API, static and blog hosts are omitted. IPs came from China and overseas client-subnet queries on the stated date and may change.')}</figcaption>
            </figure>
            <div className="dns-aside"><strong>{t('为什么写“解析线路”，不直接写“国内用户”？', 'Why say “DNS line” rather than “visitor location”?')}</strong><p>{t('阿里云智能解析主要依据递归 DNS 的出口 IP 判断来源。有些解析器还会传客户端子网。使用海外 DNS、VPN 或某些运营商网络时，实际用户所在地与命中的线路可能不一致。因此，这是一种访问优化机制，不是严格的地域隔离。', 'AliDNS mainly determines location from the recursive resolver’s egress IP; some resolvers also pass a client subnet. An overseas resolver, VPN or network configuration can make the selected line differ from the visitor’s physical location. It is a routing optimization, not a strict geographic boundary.')}</p></div>
          </section>

          <section className="dns-section" id="nameservers">
            <SectionTitle number="03" label={t('名词解释', 'THE FIRST TERM')} title={t('NS 是“由谁回答 DNS”的指定', 'NS specifies who answers DNS queries')} />
            <p className="dns-prose">{t('NS 是 Name Server 的缩写，中文常称“名称服务器”。域名注册商和权威 DNS 可以是不同服务商：域名继续在阿里云注册，同时把 NS 改成 Cloudflare，并不矛盾。但主域一旦改用 Cloudflare 的 NS，公开查询将由 Cloudflare 的权威 DNS 回答，原先在阿里云 DNS 控制台设置的主域分线路规则便不再控制访问。', 'NS stands for Name Server. The registrar and authoritative DNS provider can be different: a domain can remain registered at Alibaba while its NS points to Cloudflare. Once the apex uses Cloudflare NS, public queries are answered by Cloudflare authoritative DNS, not by the main-domain regional rules in the AliDNS console.')}</p>
            <div className="dns-definition">
              <div><span>{t('注册商', 'REGISTRAR')}</span><strong>{t('域名登记在哪里', 'Where the domain is registered')}</strong><p>{t('管理域名所有权、续费和 NS 指向。', 'Manages ownership, renewal and the NS delegation.')}</p></div>
              <ArrowRight size={21} />
              <div><span>{t('权威 NS', 'AUTHORITATIVE NS')}</span><strong>{t('谁回答解析请求', 'Who answers DNS queries')}</strong><p>{t('阿里云或 Cloudflare 等服务商。', 'Alibaba, Cloudflare or another DNS provider.')}</p></div>
              <ArrowRight size={21} />
              <div><span>{t('解析记录', 'DNS RECORD')}</span><strong>{t('回答哪个目标', 'Which target is returned')}</strong><p>{t('可以按线路返回不同地址。', 'Different lines can return different addresses.')}</p></div>
            </div>
            <p className="dns-caption">{t('“域名在阿里”只说明注册位置时，并不能推断 DNS 也由阿里负责；要看实际 NS 记录。', '“Registered at Alibaba” alone does not establish where DNS is hosted; check the actual NS records.')}</p>
          </section>

          <section className="dns-section" id="redirect">
            <SectionTitle number="04" label={t('两种完全不同的动作', 'TWO DIFFERENT MECHANISMS')} title={t('DNS 分流不改网址；301 会改网址', 'DNS routing keeps the URL; a 301 changes it')} />
            <p className="dns-prose">{t('DNS 分流发生在建立 HTTPS 连接之前。它只给出目标地址，浏览器仍请求 cuberoot.me。301 是服务器返回的 HTTP 响应，包含另一个 URL；浏览器接到后会访问新地址。把海外线路的服务写成 301 到 global.cuberoot.me，最后显示的就是 global.cuberoot.me。', 'DNS routing happens before the HTTPS connection and returns a destination for the same hostname. A 301 is an HTTP response containing another URL. If the overseas server redirects to global.cuberoot.me, that is the address ultimately displayed.')}</p>
            <div className="dns-browser-pair">
              <div><span>{t('DNS 分线路', 'DNS ROUTING')}</span><div className="dns-bar">🔒 cuberoot.me <ArrowRight size={15} /> <strong>🔒 cuberoot.me</strong></div><p>{t('服务器可变，地址栏不变。', 'The server may change while the address bar stays the same.')}</p></div>
              <div><span>{t('HTTP 301 跳转', 'HTTP 301 REDIRECT')}</span><div className="dns-bar">🔒 cuberoot.me <ArrowRight size={15} /> <strong>🔒 global.cuberoot.me</strong></div><p>{t('跳转后是另一个主机名；自动跳转也仍是两个网址。', 'The destination has another hostname; automatic navigation does not make the URLs identical.')}</p></div>
            </div>
            <p className="dns-caption">{t('301 不能“跳到自己”：如果每次请求 cuberoot.me 都返回指向 cuberoot.me 的 301，浏览器会陷入循环。阿里云 DNS 自带的 URL 转发不支持 HTTPS 来源，不能直接为 https://cuberoot.me 完成这个动作。', 'A self-redirect can loop indefinitely. AliDNS built-in URL forwarding also does not support HTTPS source URLs, so it cannot directly redirect https://cuberoot.me.')}</p>
          </section>

          <section className="dns-section" id="cloudflare">
            <SectionTitle number="05" label={t('方案逐一核对', 'CLOUDFLARE OPTIONS')} title={t('“用 CF，而且免费”有哪些含义', 'What “use CF for free” can mean')} />
            <p className="dns-prose">{t('这里把“国内继续用阿里云”理解为国内请求直达现有服务器，不先经过 Cloudflare；把“网址完全相同”理解为国内外地址栏都只显示 cuberoot.me。按照这两个条件比较，结果如下。', 'For this comparison, “China remains on Alibaba” means a direct path to the existing server without first passing through Cloudflare. “Exactly the same URL” means both address bars show cuberoot.me.')}</p>
            <div className="dns-options">
              <Option letter="A" title={t('阿里 DNS 保持分流，海外跳到 CF 子域名', 'Keep AliDNS routing; redirect overseas to a CF subdomain')} body={t('CF Pages 可以在外部 DNS 下绑定 global.cuberoot.me：先在 Pages 项目中添加该自定义域名，再在阿里 DNS 写 CNAME。海外线路还需要一个真正接收 HTTPS 请求的服务，负责返回 301/302。DNS 记录本身不会发 301。完整 Next.js 站点仍需另做 Workers 适配。', 'CF Pages can attach global.cuberoot.me while DNS remains external: add the custom domain in Pages, then create its CNAME in AliDNS. The overseas line still needs an HTTPS service to return the 301/302; a DNS record cannot do that. The full Next.js app still needs Workers adaptation.')} china={t('直达阿里云', 'Direct to Alibaba')} abroad="global.cuberoot.me" url={t('不同', 'Different')} cost={t('CF 子域名可免费试用', 'CF subdomain can be tried on Free')} />
              <Option letter="B" title={t('主域 NS 交给 CF 免费版', 'Move the apex NS to CF Free')} body={t('Cloudflare Free/Pro 的常规接入是把权威 NS 改到 CF。cuberoot.me 可以继续显示在地址栏，阿里云也可作为回源服务器；但原来阿里 DNS 的国内外规则不再回答主域查询。若国内请求由 CF 代理，再转回阿里服务器，就不再是国内直达。', 'Cloudflare Free/Pro normally use full setup with CF authoritative NS. cuberoot.me can remain visible and Alibaba can be an origin, but AliDNS regional rules no longer answer apex queries. If CF proxies China requests to Alibaba, the China path is no longer direct.')} china={t('路径改变', 'Path changes')} abroad="cuberoot.me" url={t('相同', 'Same')} cost={t('CF 可免费开始', 'CF can start on Free')} />
              <Option letter="C" title={t('阿里继续做权威 DNS，海外主域接 CF', 'Keep Alibaba DNS; put the overseas apex on CF')} body={t('最接近目标的是 Cloudflare 的 CNAME/partial setup，但官方仅向 Business/Enterprise 开放。cuberoot.me 又是裸域，不能直接放普通 CNAME；还需核对阿里 DNS 的 CNAME Flattening/ALIAS 支持、套餐和分线路能力。它不能被当作已验证的免费方案。', 'Cloudflare CNAME/partial setup is closest to the requested design, but is available only on Business/Enterprise. The apex cuberoot.me cannot use an ordinary CNAME; Alibaba DNS flattening/ALIAS support, plan and regional records also need checking. This is not a verified Free path.')} china={t('目标是直达', 'Intended direct path')} abroad="cuberoot.me" url={t('目标是相同', 'Intended same URL')} cost={t('付费且需核对', 'Paid; needs verification')} />
            </div>
            <div className="dns-answer"><span>{t('回答最初的问题', 'ANSWER TO THE ORIGINAL QUESTION')}</span><p>{t('要求“同一个 cuberoot.me、国内直达阿里云、海外直达 CF 整站、阿里 DNS 继续分线路、CF 免费”同时成立：按目前官方提供的接入方式，答案是否。免费方案 A 改变海外网址；免费方案 B 改变权威 DNS 和国内访问路径；方案 C 不免费，还需核对裸域能否按现有配置接入。', 'The combination of one cuberoot.me URL, direct China delivery from Alibaba, direct overseas delivery from a CF-hosted full site, AliDNS regional routing and CF Free is not available through the currently documented setups. Free option A changes the overseas URL; Free option B changes authoritative DNS and the China path; option C is paid and still needs apex validation.')}</p></div>
          </section>

          <section className="dns-section" id="operations">
            <SectionTitle number="06" label={t('落地前还要检查', 'BEFORE A CUTOVER')} title={t('DNS 配好，不代表网站已经迁好', 'Working DNS does not complete a migration')} />
            <div className="dns-operations">
              <div><Server size={22} /><h3>{t('应用适配', 'Application compatibility')}</h3><p>{t('CubeRoot 是含服务端路由的 Next.js 网站。Cloudflare 的完整 Next.js 交付走 Workers，需要逐页验证。仓库中存在 node:fs 路由、按 VERCEL 环境分支的逻辑和静态站回退；ffmpeg-core.wasm 约 31.2 MiB，超过 Workers 单个静态资产 25 MiB 的限制。应明确改由哪里交付这些资源。', 'CubeRoot has server-side Next.js routes. Full delivery on Cloudflare uses Workers and requires route-by-route validation. The repository contains node:fs routes, VERCEL-specific behavior and static-host fallbacks. ffmpeg-core.wasm is about 31.2 MiB, above the Workers 25 MiB per-asset limit; its delivery path must be decided.')}</p></div>
              <div><Globe2 size={22} /><h3>{t('备案与数据流', 'Filing and data flow')}</h3><p>{t('换 DNS 不会自动改变或消除备案、接入服务商信息和个人信息处理责任。若国内流量经过海外代理，或账号、IP 等信息进入境外 Worker，应画出实际数据流，再核对备案信息、隐私告知与适用的数据出境规则。Cloudflare 中国网络是另外的 Enterprise 订阅，免费版不能视作中国境内节点。这里列出审查事项，不对现状作违法判断。', 'Changing DNS does not remove filing, access-provider or personal-data obligations. If China traffic crosses an overseas proxy, or account and IP data reach an overseas Worker, map the actual flow and review filing details, privacy notices and applicable cross-border rules. Cloudflare China Network is a separate Enterprise subscription; Free is not a China edge service. These are review items, not a finding that the current site violates a rule.')}</p></div>
            </div>
            <div className="dns-next"><h3>{t('如何决定下一步', 'How to choose a path')}</h3><ol><li>{t('若必须免费且网址相同：研究 CF NS + Workers，但需接受国内访问路径改变，并先做完整应用适配。', 'If Free and one URL are essential, assess CF NS + Workers, accepting a changed China path and completing app compatibility work first.')}</li><li>{t('若必须免费且保留阿里分流：可试 CF 子域名，但海外最终显示另一个网址。', 'If Free and AliDNS routing are essential, a CF subdomain is possible, but the overseas URL changes.')}</li><li>{t('若四项都必须保留：评估付费 partial setup 与裸域接入，不能按免费迁移承诺。', 'If every requirement is fixed, assess paid partial setup and apex support; do not plan it as a Free migration.')}</li></ol></div>
          </section>

          <footer className="dns-sources">
            <SectionTitle number="07" label={t('延伸阅读', 'REFERENCES')} title={t('依据与时间边界', 'Sources and date of this guide')} />
            <p>{t('产品套餐和本站 DNS 配置都可能改变。以下是文中涉及的官方资料；当前路径与 IP 记录于 2026 年 9 月 25 日，实际切换前需要重新查询。', 'Plans and site DNS configuration can change. The official references below support the product details. Current routes and IPs were observed on 25 September 2026 and must be checked again before a cutover.')}</p>
            <div className="dns-source-list">{SOURCES.map((source, index) => <a key={source.href} href={source.href} target="_blank" rel="noreferrer"><span>{String(index + 1).padStart(2, '0')}</span>{t(source.zh, source.en)}<ArrowUpRight size={15} /></a>)}</div>
            <div className="dns-footer-nav"><AppLink href="/dev/architecture/flow" prefetch={false}>{t('查看整站请求拓扑', 'Full request map')} <ArrowRight size={16} /></AppLink><AppLink href="/dev" prefetch={false}>{t('返回开发目录', 'Dev index')} <ArrowRight size={16} /></AppLink></div>
          </footer>
        </article>
      </div>
    </main>
  );
}

function SectionTitle({ number, label, title }: { number: string; label: string; title: string }) {
  return <div className="dns-section-heading"><span>{number} / {label}</span><h2>{title}</h2></div>;
}

function Option({ letter, title, body, china, abroad, url, cost }: {
  letter: string; title: string; body: string; china: string; abroad: string; url: string; cost: string;
}) {
  const t = useT();
  return <section className="dns-option"><div className="dns-option-index">{letter}</div><div><h3>{title}</h3><p>{body}</p><dl><div><dt>{t('国内访问', 'China')}</dt><dd>{china}</dd></div><div><dt>{t('海外结果', 'Overseas')}</dt><dd>{abroad}</dd></div><div><dt>{t('同一网址', 'Same URL')}</dt><dd>{url}</dd></div><div><dt>{t('费用', 'Cost')}</dt><dd>{cost}</dd></div></dl></div></section>;
}
