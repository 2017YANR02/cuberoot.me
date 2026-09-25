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
  { href: 'https://developers.cloudflare.com/dns/zone-setups/partial-setup/', zh: 'Cloudflare：不更换 DNS 时的接入方式', en: 'Cloudflare: partial setup with external DNS' },
  { href: 'https://developers.cloudflare.com/pages/configuration/custom-domains/', zh: 'Cloudflare Pages：子域名与不带前缀的域名', en: 'Cloudflare Pages: subdomains and apex domains' },
  { href: 'https://www.alibabacloud.com/help/en/dns/pubz-intelligent-parsing-related-faq', zh: '阿里云：怎样判断 DNS 查询从哪里发来', en: 'Alibaba Cloud: how geo DNS determines location' },
  { href: 'https://www.alibabacloud.com/help/en/dns/pubz-faq-related-to-domain-name-resolution-resolution-records', zh: '阿里云：URL 转发与 HTTPS 限制', en: 'Alibaba Cloud: URL forwarding and HTTPS' },
  { href: 'https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/', zh: 'Cloudflare Workers：Next.js 部署', en: 'Cloudflare Workers: Next.js deployment' },
  { href: 'https://developers.cloudflare.com/workers/platform/limits/', zh: 'Cloudflare Workers：免费额度与单个文件大小', en: 'Cloudflare Workers: plan and asset limits' },
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
    ['operations', t('切换前要检查什么', 'Checks before switching')],
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
            <p className="dns-deck">{t('以 cuberoot.me 为例，说明浏览器怎样找到网站、国内外为什么会连到不同服务器、301 为什么会改网址，以及 Cloudflare 免费版能否让国内走阿里云、国外走 CF，同时保持 cuberoot.me 不变。', 'Using cuberoot.me, this guide explains how a browser finds the site, why visitors can reach different servers, why a 301 changes the URL, and whether Cloudflare Free can serve overseas visitors while China stays on Alibaba under the same cuberoot.me address.')}</p>
            <div className="dns-hero-rule"><span>cuberoot.me</span><span>{t('访问过程 · 根据 2026 年 9 月 25 日的配置绘制', 'How a visit works · based on the configuration of 25 Sep 2026')}</span></div>
            <figure className="dns-cover">
              <Image src="/assets/dev/dns-routing/route-map.svg?v=2" alt={t('示意图：同一个网址先经过 DNS 查询，然后国内和海外连接分别到达阿里云服务器与 Vercel', 'Diagram: the same URL is resolved by DNS, then China and overseas connections reach Alibaba Cloud and Vercel respectively')} width={1200} height={560} priority unoptimized />
              <figcaption>{t('图中箭头表示访问顺序，不是地图。阿里云会根据 DNS 查询从哪里发来，决定回答哪个服务器地址。', 'Arrows show the order of a visit, not a map. Alibaba chooses which server address to return based on where the DNS query appears to come from.')}</figcaption>
            </figure>
          </header>

          <nav className="dns-toc" aria-label={t('文章目录', 'Contents')}>
            {toc.map(([id, label], index) => <a href={'#' + id} key={id}><span>{String(index + 1).padStart(2, '0')}</span>{label}</a>)}
          </nav>

          <section className="dns-section dns-intro" id="request">
            <SectionTitle number="01" label={t('先从一次访问说起', 'START WITH A PAGE VISIT')} title={t('输入网址后，浏览器做了四件事', 'Four steps between a URL and a page')} />
            <p className="dns-prose">{t('cuberoot.me 是方便记忆的网址，IP 地址是浏览器真正要连接的服务器地址。打开页面时，浏览器先查出 IP 地址，再向那台服务器发送 HTTPS 请求。', 'cuberoot.me is the memorable domain; an IP address tells the browser which server to connect to. The browser first looks up the IP, then sends an HTTPS request to that server.')}</p>
            <ol className="dns-steps">
              <li><span>1</span><div><h3>{t('输入网址', 'Enter the URL')}</h3><p>{t('地址栏是 https://cuberoot.me。此时还没有联系网站服务器。', 'The address bar contains https://cuberoot.me. No site server has been contacted yet.')}</p></div></li>
              <li><span>2</span><div><h3>{t('查询 DNS', 'Resolve the domain')}</h3><p>{t('浏览器请 DNS 查询服务代查 cuberoot.me，最后得到一个服务器 IP 地址。', 'The browser asks a DNS resolver to look up cuberoot.me and receives a server IP address.')}</p></div></li>
              <li><span>3</span><div><h3>{t('连接服务器', 'Connect to the server')}</h3><p>{t('浏览器连到查出的 IP，确认它能安全地提供 cuberoot.me 的网页。', 'The browser connects to that IP and checks that it can securely serve cuberoot.me.')}</p></div></li>
              <li><span>4</span><div><h3>{t('取得页面', 'Receive the page')}</h3><p>{t('服务器送回网页和图片。只有服务器另外发出跳转指令，地址栏才会改变。', 'The server sends the page and images. The address bar changes only if it also sends a redirect.')}</p></div></li>
            </ol>
          </section>

          <section className="dns-section" id="current">
            <SectionTitle number="02" label={t('本站现在怎么设置', 'THE SITE TODAY')} title={t('网址一样，连到的服务器可能不同', 'The same URL can reach different servers')} />
            <p className="dns-prose">{t('根据 2026 年 9 月 25 日的查询，负责回答 cuberoot.me 地址的，是阿里云的 dns3.hichina.com 和 dns4.hichina.com。阿里云对来自国内的 DNS 查询回答 47.97.30.181，浏览器随后连到本站的阿里云服务器；对来自海外的查询回答 216.198.79.1，浏览器随后连到 Vercel。两边打开的仍是 cuberoot.me。', 'Queries on 25 September 2026 showed that Alibaba’s dns3.hichina.com and dns4.hichina.com answered for cuberoot.me. For China DNS queries Alibaba returned 47.97.30.181, leading to the site’s Alibaba server. For overseas queries it returned 216.198.79.1, leading to Vercel. Both browsers still showed cuberoot.me.')}</p>
            <figure className="dns-flow">
              <div className="dns-flow-visitor"><Globe2 size={20} /><span>https://cuberoot.me</span></div>
              <div className="dns-flow-arrow"><ArrowDown size={17} /><small>{t('查询 DNS', 'DNS query')}</small></div>
              <div className="dns-flow-resolver"><strong>{t('阿里云回答 DNS 查询', 'Alibaba answers the DNS query')}</strong><small>dns3.hichina.com · dns4.hichina.com</small></div>
              <div className="dns-flow-branches">
                <div className="dns-flow-branch">
                  <MapPin size={20} />
                  <span>{t('查询从国内发来', 'Query appears to come from China')}</span>
                  <strong>47.97.30.181</strong>
                  <small>{t('阿里云服务器 → 网站页面', 'Alibaba server → site page')}</small>
                  <div className="dns-address">🔒 cuberoot.me</div>
                </div>
                <div className="dns-flow-branch">
                  <Globe2 size={20} />
                  <span>{t('查询从海外发来', 'Query appears to come from overseas')}</span>
                  <strong>216.198.79.1</strong>
                  <small>{t('Vercel → 网站页面', 'Vercel → site page')}</small>
                  <div className="dns-address">🔒 cuberoot.me</div>
                </div>
              </div>
              <figcaption>{t('图中只画主站；接口、静态文件和博客有各自的域名。两个 IP 是在上述日期模拟国内与海外网络查询所得，DNS 设置调整后可能改变。', 'The diagram shows only the main site; API, static files and the blog use separate hostnames. These IPs came from simulated China and overseas DNS queries on the stated date and may change.')}</figcaption>
            </figure>
            <div className="dns-aside"><strong>{t('人在国内，就一定连到阿里云吗？', 'Does a visitor in China always reach Alibaba?')}</strong><p>{t('不一定。浏览器通常请运营商或公共 DNS 服务代查网址。阿里云看到的往往是这个代查服务从哪里发问，而不是人的精确位置；有些代查服务会附带网络的大致位置。使用海外 DNS、VPN 或特殊网络时，国内访问也可能拿到海外地址。因此，DNS 分流不能保证把国内外访问完全隔开。', 'Not always. A browser usually asks an ISP or public DNS resolver to look up the name. Alibaba often sees where that resolver asks from, not the person’s exact location; some resolvers also include an approximate client network. An overseas resolver, VPN or unusual network may return the overseas address to someone in China. DNS routing is not a guaranteed geographic barrier.')}</p></div>
          </section>

          <section className="dns-section" id="nameservers">
            <SectionTitle number="03" label={t('NS 是什么意思', 'WHAT NS MEANS')} title={t('NS 决定向谁询问这个网址的地址', 'NS decides who answers for the domain')} />
            <p className="dns-prose">{t('NS 是 Name Server，中文叫“名称服务器”。买域名的地方，和负责回答“这个网址对应哪个 IP”的地方，可以不是同一家公司。例如，cuberoot.me 仍在阿里云注册，却可以把 NS 改成 Cloudflare。改完后，外界查询 cuberoot.me 就会去问 Cloudflare；阿里云 DNS 后台原有的国内外分流设置也就不再起作用。', 'NS means Name Server. The place where a domain is registered and the service that answers “which IP belongs to this name?” can be different. For example, cuberoot.me can remain registered at Alibaba while its NS moves to Cloudflare. Once changed, public queries go to Cloudflare, so the old AliDNS regional rules no longer answer them.')}</p>
            <div className="dns-definition">
              <div><span>{t('买域名的地方', 'REGISTRAR')}</span><strong>{t('域名登记在哪里', 'Where the domain is registered')}</strong><p>{t('管理域名所有权、续费，以及 NS 指向。', 'Manages ownership, renewal and the NS setting.')}</p></div>
              <ArrowRight size={21} />
              <div><span>{t('NS', 'NS')}</span><strong>{t('由谁回答 DNS 查询', 'Who answers DNS queries')}</strong><p>{t('可以是阿里云、Cloudflare 等服务商。', 'It can be Alibaba, Cloudflare or another provider.')}</p></div>
              <ArrowRight size={21} />
              <div><span>{t('DNS 记录', 'DNS RECORD')}</span><strong>{t('回答哪个 IP', 'Which IP is returned')}</strong><p>{t('同一个网址，可以按查询来源给出不同地址。', 'One name can return different addresses based on the query source.')}</p></div>
            </div>
            <p className="dns-caption">{t('因此，“域名在阿里云”还不够明确：可能指在阿里云购买，也可能指由阿里云回答 DNS。查看 NS 记录才能分清。', '“The domain is at Alibaba” may mean it was purchased there, or that Alibaba answers DNS queries. The NS records show which one is meant.')}</p>
          </section>

          <section className="dns-section" id="redirect">
            <SectionTitle number="04" label={t('分流与跳转', 'ROUTING AND REDIRECTS')} title={t('DNS 换服务器，不改网址；301 会改网址', 'DNS can change the server; a 301 changes the URL')} />
            <p className="dns-prose">{t('DNS 查询发生在打开网页之前。它可以让同一个 cuberoot.me 指向不同服务器，但浏览器仍然访问 cuberoot.me。301 则是服务器收到访问后，告诉浏览器“这个网页永久搬到另一个网址了”；302 表示临时跳转。如果跳到 global.cuberoot.me，地址栏最终就会显示 global.cuberoot.me。', 'DNS runs before the page opens. It can point the same cuberoot.me hostname to different servers without changing the URL. A 301 tells the browser the page has permanently moved; a 302 is a temporary redirect. If either leads to global.cuberoot.me, that is the address ultimately displayed.')}</p>
            <div className="dns-browser-pair">
              <div><span>{t('DNS 给出不同服务器地址', 'DNS RETURNS ANOTHER SERVER IP')}</span><div className="dns-bar">🔒 cuberoot.me <ArrowRight size={15} /> <strong>🔒 cuberoot.me</strong></div><p>{t('服务器可能不同，地址栏仍相同。', 'The server may differ; the address bar stays the same.')}</p></div>
              <div><span>{t('服务器发出 301 跳转', 'SERVER SENDS A 301 REDIRECT')}</span><div className="dns-bar">🔒 cuberoot.me <ArrowRight size={15} /> <strong>🔒 global.cuberoot.me</strong></div><p>{t('跳转后是另一个网址。自动跳过去，也不等于两个网址相同。', 'The browser ends up at a different URL, even when the redirect is automatic.')}</p></div>
            </div>
            <p className="dns-caption">{t('如果 cuberoot.me 每次都跳回 cuberoot.me，浏览器会反复打开同一个地址。阿里云 DNS 自带的“网址转发”只能处理从 http:// 开始的访问，处理不了本站使用的 https://cuberoot.me。', 'Redirecting cuberoot.me back to itself creates a loop. AliDNS built-in URL forwarding handles HTTP source URLs, but not the HTTPS address used by this site.')}</p>
          </section>

          <section className="dns-section" id="cloudflare">
            <SectionTitle number="05" label={t('三种做法', 'THREE OPTIONS')} title={t('Cloudflare 免费版，究竟能做到哪一步', 'What Cloudflare Free can and cannot do')} />
            <p className="dns-prose">{t('以下把要求说清楚：国内访问直接到现有阿里云服务器，不先经过 CF；国内外地址栏都只显示 cuberoot.me。三种做法分别会改变什么？', 'The requirements here are precise: China traffic reaches the existing Alibaba server directly, without passing through CF, and both address bars show cuberoot.me. Each option changes something different.')}</p>
            <div className="dns-options">
              <Option letter="A" title={t('国内保持原样，海外自动跳到 global.cuberoot.me', 'Keep China as-is; redirect overseas to global.cuberoot.me')} body={t('CF 的网站托管服务 Pages 允许在阿里云继续管理 DNS 的情况下，使用 global.cuberoot.me 这个子域名。需要先在 CF 添加该地址，再在阿里云为它设置 CNAME（把子域名指向 CF 的记录）。但海外访问 cuberoot.me 时，还要有一个能接收 HTTPS 请求的服务，负责发出 301 或 302 跳转；DNS 自己不会让浏览器跳转。把整个网站放到 CF，也需要另外改造和测试。', 'CF Pages can use global.cuberoot.me while Alibaba continues to manage DNS. Add the hostname in CF, then create a CNAME in AliDNS to point that subdomain at CF. Overseas visits to cuberoot.me still need an HTTPS service that sends a 301 or 302; DNS itself cannot redirect a browser. Moving the whole site to CF also requires separate changes and testing.')} china={t('直达阿里云', 'Direct to Alibaba')} abroad="global.cuberoot.me" url={t('不同', 'Different')} cost={t('子域名可用免费套餐测试', 'The subdomain can be tested on Free')} />
              <Option letter="B" title={t('把 cuberoot.me 的 DNS 改由 CF 管理', 'Let CF manage DNS for cuberoot.me')} body={t('CF 免费版要让 cuberoot.me 直接使用 CF，需要把 NS 改到 CF。浏览器仍可显示 cuberoot.me，CF 也能把请求转给阿里云服务器；但阿里 DNS 原来的国内外设置不会再生效。如果国内访问先到 CF、再由 CF 转给阿里云，就不再是“国内直达阿里云”。', 'To use the apex cuberoot.me directly with CF Free, move its NS to CF. The browser can still show cuberoot.me, and CF can pass requests to the Alibaba server. But the old AliDNS regional rules no longer apply. If China requests go through CF before Alibaba, they are no longer direct.')} china={t('原有的直达设置失效', 'Old direct route no longer applies')} abroad="cuberoot.me" url={t('相同', 'Same')} cost={t('可先用免费套餐测试', 'Can be tested on Free')} />
              <Option letter="C" title={t('阿里云继续回答 DNS，海外的 cuberoot.me 进入 CF', 'Keep AliDNS; route the overseas apex to CF')} body={t('CF 有一种“保留原来的 DNS，只把指定网址接入 CF”的方式，叫部分接入；官方只向 Business 和 Enterprise 套餐开放。cuberoot.me 本身不带 www 或 global 前缀，不能像子域名那样直接设置普通 CNAME。还要核对阿里云当前 DNS 套餐能否为这个地址提供合适的指向，并与国内外设置并用。因此，这条路不能按免费、现成可用来安排。', 'CF offers partial setup, which keeps the existing DNS provider and sends a selected hostname through CF, but only on Business and Enterprise. The bare cuberoot.me hostname cannot use an ordinary CNAME like a subdomain. The Alibaba plan must also support a suitable apex target together with regional records. This cannot be planned as a ready-to-use Free option.')} china={t('需要实测是否直达', 'Direct path needs verification')} abroad="cuberoot.me" url={t('配置成功后相同', 'Same if setup succeeds')} cost={t('需付费，且要核对配置', 'Paid; configuration needs checking')} />
            </div>
            <div className="dns-answer"><span>{t('结论', 'CONCLUSION')}</span><p>{t('如果要求国内直接到阿里云、国外直接到 CF 托管的整站、两边地址栏都是 cuberoot.me、阿里 DNS 继续负责国内外分流，而且 CF 必须免费：目前不能同时做到。A 会让国外地址栏变成 global.cuberoot.me；B 会让阿里 DNS 的分流设置失效，国内访问也可能先经过 CF；C 需要付费，还要核对不带前缀的 cuberoot.me 能否这样接入。', 'The full combination is not available through the currently documented setups: China directly on Alibaba, overseas directly on a CF-hosted full site, one cuberoot.me URL, AliDNS regional routing, and CF Free. A changes the overseas address bar to global.cuberoot.me; B stops the old AliDNS split and can send China traffic through CF; C is paid and still needs apex verification.')}</p></div>
          </section>

          <section className="dns-section" id="operations">
            <SectionTitle number="06" label={t('真正切换前', 'BEFORE SWITCHING')} title={t('改完 DNS，网站仍可能打不开', 'The site can still fail after DNS changes')} />
            <div className="dns-operations">
              <div><Server size={22} /><h3>{t('网站程序要能在 CF 运行', 'The site must run on CF')}</h3><p>{t('本站不只是几张静态网页：一些页面需要服务器运行程序。CF 用名为 Workers 的服务运行这类程序，所以不能只把域名指过去。当前代码有读取服务器文件的页面、专为 Vercel 写的逻辑，以及从另一台服务器取文件的安排，都要逐项检查。另有一个约 31.2 MiB 的 ffmpeg-core.wasm 文件，超过 CF Workers 单个静态文件 25 MiB 的上限，必须换一种方式提供。', 'This site is more than static pages: some pages need code running on a server. CF runs such code through a service called Workers, so pointing the domain there is not enough. File-reading pages, Vercel-specific logic and files fetched from another server all need checking. The 31.2 MiB ffmpeg-core.wasm also exceeds the Workers 25 MiB single-asset limit and needs another delivery method.')}</p></div>
              <div><Globe2 size={22} /><h3>{t('确认备案信息和用户数据会去哪里', 'Check filing details and where data goes')}</h3><p>{t('改 DNS 不会自动更新备案里填写的服务器、提供网络接入的公司等信息，也不会改变网站处理用户数据的责任。如果国内访问先经过境外服务，或者账号、IP 等信息会送到境外运行的程序，应查清数据经过哪些服务，再核对备案、隐私说明，以及个人信息送到境外是否需要额外手续。CF 的中国境内节点不是免费功能，需要 Enterprise 套餐和另外购买的中国网络服务。这些是切换前的核对事项，不是在判断现有网站违法。', 'Changing DNS does not automatically update the server and access-provider details in an ICP filing or change responsibility for user data. If China traffic crosses an overseas service, or account and IP data reach code running abroad, identify the services involved and review the filing, privacy notice and whether sending personal data abroad requires additional steps. CF China Network is not a Free feature; it requires Enterprise plus a separate subscription. These are checks before switching, not a claim that the current site violates a rule.')}</p></div>
            </div>
            <div className="dns-next"><h3>{t('可以怎样选', 'How to choose')}</h3><ol><li>{t('免费和同一个网址最重要：可研究把 DNS 与网站都迁到 CF，但国内请求的走法会变，网站程序也要先完成改造。', 'If Free and one URL matter most, assess moving DNS and the site to CF. China traffic will follow a different path, and the application must first be adapted.')}</li><li>{t('免费和阿里云继续分流最重要：可用 CF 子域名，但国外地址栏会显示 global.cuberoot.me。', 'If Free and the AliDNS split matter most, use a CF subdomain, accepting global.cuberoot.me in the overseas address bar.')}</li><li>{t('所有条件都不能变：只能继续核对 CF 付费接入及 cuberoot.me 本身能否这样配置，不能按免费方案安排。', 'If none of the requirements can change, investigate paid CF setup and whether cuberoot.me itself can be configured that way. It cannot be planned as Free.')}</li></ol></div>
          </section>

          <footer className="dns-sources">
            <SectionTitle number="07" label={t('延伸阅读', 'REFERENCES')} title={t('官方说明与记录日期', 'Official sources and observation date')} />
            <p>{t('CF 套餐、文件限制和本站的 DNS 设置都可能改变。下列链接是对应的官方说明。文中服务器地址记录于 2026 年 9 月 25 日；真正切换前，需要重新查询一次。', 'CF plans, file limits and this site’s DNS settings can change. The links below are the official references. Server addresses were recorded on 25 September 2026 and should be checked again before a switch.')}</p>
            <div className="dns-source-list">{SOURCES.map((source, index) => <a key={source.href} href={source.href} target="_blank" rel="noreferrer"><span>{String(index + 1).padStart(2, '0')}</span>{t(source.zh, source.en)}<ArrowUpRight size={15} /></a>)}</div>
            <div className="dns-footer-nav"><AppLink href="/dev/architecture/flow" prefetch={false}>{t('查看网站请求经过哪些服务', 'See which services handle site requests')} <ArrowRight size={16} /></AppLink><AppLink href="/dev" prefetch={false}>{t('返回开发目录', 'Dev index')} <ArrowRight size={16} /></AppLink></div>
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
