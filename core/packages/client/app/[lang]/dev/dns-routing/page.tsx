'use client';

import Image from 'next/image';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, CircleHelp, Globe2, MapPin, Server, X } from 'lucide-react';
import AppLink from '@/components/AppLink';
import HeaderToggles from '@/components/HeaderToggles';
import JsonLd, { articleJsonLd } from '@/components/JsonLd';
import { useT } from '@/hooks/useT';
import { tr, useLang } from '@/i18n/tr';
import { PAGE_META } from '@/lib/page-meta';
import './dns-routing.css';

const SOURCES = [
  { href: 'https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/', zh: 'Cloudflare：免费版的完整 DNS 接入', en: 'Cloudflare: full DNS setup on Free' },
  { href: 'https://developers.cloudflare.com/dns/zone-setups/partial-setup/', zh: 'Cloudflare：保留外部 DNS 的部分接入', en: 'Cloudflare: partial setup with external DNS' },
  { href: 'https://developers.cloudflare.com/pages/configuration/custom-domains/', zh: 'Cloudflare Pages：外部 DNS 接入子域名', en: 'Cloudflare Pages: a subdomain on external DNS' },
  { href: 'https://www.alibabacloud.com/help/en/dns/pubz-intelligent-parsing-related-faq', zh: '阿里云：智能解析如何判断来源', en: 'Alibaba Cloud: how geo routing determines location' },
  { href: 'https://www.alibabacloud.com/help/en/dns/pubz-faq-related-to-domain-name-resolution-resolution-records', zh: '阿里云：URL 转发及 HTTPS 限制', en: 'Alibaba Cloud: URL forwarding and HTTPS' },
  { href: 'https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/', zh: 'Cloudflare Workers：部署 Next.js', en: 'Cloudflare Workers: deploy Next.js' },
  { href: 'https://developers.cloudflare.com/workers/platform/limits/', zh: 'Cloudflare Workers：免费额度与资源限制', en: 'Cloudflare Workers: Free limits' },
  { href: 'https://developers.cloudflare.com/china-network/get-started/', zh: 'Cloudflare：中国网络是单独的 Enterprise 订阅', en: 'Cloudflare: China Network is a separate Enterprise subscription' },
  { href: 'https://ynca.miit.gov.cn/zwgk/zcwj/flfg/art/2024/art_2e96227c42924af9b49b7f13b81fd124.html', zh: '工信部：非经营性互联网信息服务备案管理办法', en: 'MIIT: ICP filing rules for non-commercial internet services' },
  { href: 'https://www.cac.gov.cn/2024-03/22/c_1712776611775634.htm', zh: '国家网信办：促进和规范数据跨境流动规定', en: 'CAC: rules on cross-border data flows' },
] as const;

export default function DnsRoutingPage() {
  const t = useT();
  const lang = useLang();
  const meta = PAGE_META['dev/dns-routing'];
  const toc = [
    ['answer', t('先看答案', 'The answer')],
    ['today', t('现在的真实路径', 'The current route')],
    ['words', t('NS、DNS 与 301', 'NS, DNS and 301')],
    ['options', t('三种 CF 方案', 'Three CF options')],
    ['migration', t('迁移与合规', 'Migration and compliance')],
    ['sources', t('官方资料', 'Primary sources')],
  ];

  return <main className="dns-page">
    <JsonLd data={articleJsonLd({ headline: tr(meta.title), description: tr(meta.description!), url: `https://cuberoot.me/${lang === 'zh' ? 'zh/' : ''}dev/dns-routing`, lang, partOfName: 'CubeRoot Dev', partOfUrl: `https://cuberoot.me/${lang === 'zh' ? 'zh/' : ''}dev` })} />
    <div className="dns-wrap">
      <header className="dns-topbar">
        <AppLink href="/dev" prefetch={false} className="dns-brand">CubeRoot <span>/ dev / network</span></AppLink>
        <HeaderToggles />
      </header>

      <article>
        <header className="dns-hero">
          <div className="dns-kicker"><span className="dns-pulse" /> {t('网络架构图解', 'NETWORK FIELD GUIDE')} <span>001 / 2026.09.25</span></div>
          <h1>{t('同一个网址，\n两条不同的路。', 'One address.\nTwo different paths.')}</h1>
          <p className="dns-lead">{t('打开的都是 cuberoot.me，国内和国外却可能到达不同的服务器。NS 决定谁回答“去哪儿”，DNS 分线路决定回答什么地址，301 才会改浏览器地址栏。', 'Everyone opens cuberoot.me, yet visitors in China and overseas may reach different servers. NS chooses who answers “where”; DNS routing chooses the answer; only an HTTP redirect changes the address bar.')}</p>
          <div className="dns-hero-meta"><span>{t('阅读时间约 8 分钟', 'About 8 min read')}</span><span>{t('以 2026-09-25 的配置为准', 'Configuration snapshot: 2026-09-25')}</span></div>
          <figure className="dns-hero-art">
            <Image src="/assets/dev/dns-routing/hero.png" alt={t('抽象示意：一个入口分成通往国内服务器和海外云平台的两条发光路径', 'Concept illustration: one entry divides into paths toward a domestic server and an overseas cloud')} width={1536} height={1024} priority unoptimized />
            <figcaption>{t('概念插画，不代表真实地理位置或网络拓扑。下方流程图才标出实际服务。', 'Concept art, not a geographic map or literal topology. The diagram below names the actual services.')}</figcaption>
          </figure>
        </header>

        <nav className="dns-toc" aria-label={t('本页目录', 'On this page')}>
          {toc.map(([id, label], index) => <a href={`#${id}`} key={id}><span>0{index + 1}</span>{label}<ArrowRight size={14} /></a>)}
        </nav>

        <section className="dns-section" id="answer">
          <SectionTitle number="01" eyebrow={t('一句话结论', 'THE SHORT ANSWER')} title={t('四个条件，不能同时满足', 'These four requirements do not fit together')} />
          <p className="dns-prose">{t('如果你的要求是：①地址栏始终只显示 cuberoot.me；②国内用户直达阿里云；③国外用户直达 Cloudflare 托管的整站；④Cloudflare 免费，同时让阿里云 DNS 继续管理主域的国内外分线路——答案是“不行”。卡住的不是网址写法，而是 Cloudflare 免费版对主域的接入方式。', 'If you require one visible URL (cuberoot.me), a direct Alibaba Cloud route in China, a direct Cloudflare-hosted full site overseas, Cloudflare Free, and Alibaba Cloud DNS retaining the regional split, the answer is no. The obstacle is how Cloudflare Free attaches the apex domain, not how the URL is spelled.')}</p>
          <div className="dns-verdict" data-site-surface="panel"><div className="dns-verdict-icon"><X size={31} strokeWidth={2.5} /></div><div><span>{t('你提出的完整组合', 'YOUR EXACT COMBINATION')}</span><strong>{t('否，免费方案无法原样实现', 'No, not as specified on Free')}</strong><p>{t('可以保住同一个网址，也可以保留阿里 DNS 分线路；但按官方支持的接入方式，不能再同时免费地让国外主域直接落到 CF 托管的整站。下面逐项解释。', 'You can preserve the same URL, or preserve Alibaba DNS regional routing. Officially supported setup does not provide all of those conditions together for free with the overseas apex directly on a CF-hosted full site.')}</p></div></div>
          <div className="dns-condition-grid">{[
            [t('同一网址', 'One visible URL'), 'cuberoot.me', true],
            [t('国内直达阿里云', 'Direct to Alibaba in China'), t('不经过 CF 代理', 'No CF proxy'), true],
            [t('海外直达 CF 整站', 'Direct to full CF site overseas'), t('不是跳到子域名', 'No subdomain redirect'), true],
            [t('阿里 DNS 分流 + CF 免费', 'AliDNS split + CF Free'), t('两项必须并存', 'Both at once'), false],
          ].map(([title, value, possible]) => <div key={String(title)}><span className={possible ? 'dns-good' : 'dns-bad'}>{possible ? <Check size={16} /> : <X size={16} />}</span><strong>{title}</strong><small>{value}</small></div>)}</div>
        </section>

        <section className="dns-section" id="today">
          <SectionTitle number="02" eyebrow={t('当前站点', 'CURRENT DEPLOYMENT')} title={t('现在，用户实际会看到什么', 'What visitors actually see today')} />
          <p className="dns-prose">{t('cuberoot.me 当前把域名的权威 NS 放在阿里云（dns3.hichina.com / dns4.hichina.com）。阿里 DNS 按解析来源给出不同的主站地址：国内线路指向阿里云自有服务器，海外线路指向 Vercel。浏览器没有发生 301 跳转，所以两边地址栏仍是 cuberoot.me。', 'The authoritative nameservers for cuberoot.me currently sit at Alibaba Cloud (dns3.hichina.com / dns4.hichina.com). AliDNS returns different main-site addresses by resolution source: the China route reaches the self-hosted Alibaba server, and the overseas route reaches Vercel. There is no 301 redirect, so both visitors keep cuberoot.me in the address bar.')}</p>
          <figure className="dns-flow" data-site-surface="panel">
            <div className="dns-flow-start"><Globe2 size={25} /><div><small>{t('访客输入', 'VISITOR TYPES')}</small><strong>https://cuberoot.me</strong></div></div>
            <div className="dns-flow-drop"><ArrowDown size={19} /><span>{t('查询“这个域名去哪儿？”', 'Asks “where does this name go?”')}</span></div>
            <div className="dns-flow-ns"><span>NS</span><div><strong>{t('阿里云权威 DNS', 'Alibaba authoritative DNS')}</strong><small>dns3 / dns4.hichina.com</small></div></div>
            <div className="dns-flow-fork"><span>{t('按解析来源返回不同记录', 'Different records by query source')}</span></div>
            <div className="dns-flow-lanes">
              <div className="dns-lane dns-lane-cn"><div className="dns-lane-icon"><MapPin size={21} /></div><span className="dns-lane-region">{t('中国大陆解析线路', 'CHINA DNS LINE')}</span><strong>47.97.30.181</strong><p>{t('阿里云服务器 → nginx → Next.js', 'Alibaba server → nginx → Next.js')}</p><div className="dns-browser">🔒 cuberoot.me <Check size={15} /></div></div>
              <div className="dns-lane dns-lane-world"><div className="dns-lane-icon"><Globe2 size={21} /></div><span className="dns-lane-region">{t('海外解析线路', 'OVERSEAS DNS LINE')}</span><strong>216.198.79.1</strong><p>Vercel → Next.js</p><div className="dns-browser">🔒 cuberoot.me <Check size={15} /></div></div>
            </div>
            <figcaption>{t('2026-09-25 用不同客户端子网模拟国内/海外 DNS 查询得到的地址；服务配置可变化。智能解析主要依据递归 DNS 的出口 IP（有时参考客户端子网），不能保证每个访客都命中预期线路。API、static 和博客是独立入口，图中省略。', 'Addresses observed on 2026-09-25 using China and overseas client-subnet DNS queries; configuration can change. Geo DNS mainly uses the recursive resolver’s egress IP (sometimes client-subnet information), so each visitor is not guaranteed the expected lane. Independent API, static, and blog hosts are omitted.')}</figcaption>
          </figure>
          <div className="dns-note"><CircleHelp size={20} /><p>{t('“域名在阿里”有两层含义：域名可以继续在阿里云注册，但权威 NS 指向别家；也可以注册和权威 DNS 都在阿里。真正决定谁回答解析请求的是 NS，不是注册商。', '“The domain is at Alibaba” can refer to registration or authoritative DNS. You may keep the registrar at Alibaba while pointing NS elsewhere. NS, rather than the registrar, determines who answers DNS queries.')}</p></div>
        </section>

        <section className="dns-section" id="words">
          <SectionTitle number="03" eyebrow={t('三个容易混淆的词', 'THREE DIFFERENT LAYERS')} title={t('NS、DNS 分流、301 各管一件事', 'NS, DNS routing and 301 do different jobs')} />
          <div className="dns-terms">
            <div data-site-surface="panel"><span>01 / NS</span><h3>Name Server</h3><p>{t('“谁来回答”。注册商公布 cuberoot.me 的权威名称服务器。指向阿里，阿里 DNS 规则生效；改指向 CF，阿里 DNS 的主域分线路规则就不再负责公开解析。', '“Who answers?” The registrar publishes the authoritative nameservers. Pointing them to Alibaba makes AliDNS rules authoritative. Pointing them to CF removes Alibaba’s main-domain geo rules from public resolution.')}</p></div>
            <div data-site-surface="panel"><span>02 / DNS</span><h3>{t('分线路解析', 'Regional answers')}</h3><p>{t('“回答哪个地址”。同一个 cuberoot.me 可以按解析线路返回不同目标。用户仍输入、看到相同的网址。它不读取页面，也不执行网页跳转。', '“Which destination?” The same cuberoot.me can resolve to different targets by DNS line. Visitors type and see the same URL. DNS does not load a page or issue a web redirect.')}</p></div>
            <div data-site-surface="panel"><span>03 / HTTP</span><h3>301 Redirect</h3><p>{t('“让浏览器改去另一个 URL”。服务器先收到请求，再发 301 和新地址。如果目标是 global.cuberoot.me，浏览器地址栏就会变成它；如果目标仍是原地址，就可能无限跳转。', '“Send the browser to another URL.” A server first receives the request, then sends a 301 and a new location. Redirect to global.cuberoot.me and the address bar changes; redirect back to itself and a loop can result.')}</p></div>
          </div>
          <figure className="dns-compare" data-site-surface="panel"><div><span>{t('DNS 分流：地址栏不变', 'DNS ROUTING: URL STAYS')}</span><div className="dns-mini-browser">🔒 cuberoot.me <ArrowRight size={16} /> <b>🔒 cuberoot.me</b></div><p>{t('不同用户可能连不同服务，URL 仍相同。', 'Different users can reach different services under one URL.')}</p></div><div><span>{t('301 跳转：地址栏改变', '301 REDIRECT: URL CHANGES')}</span><div className="dns-mini-browser">🔒 cuberoot.me <ArrowRight size={16} /> <b>🔒 global.cuberoot.me</b></div><p>{t('这是两个主机名。可以让用户自动过去，但不能说网址完全相同。', 'These are two hostnames. Automatic navigation does not make them the same URL.')}</p></div><figcaption>{t('DNS 回答发生在建立 HTTPS 连接之前；301 是拿到 HTTP 响应之后的动作。阿里云 DNS 自带的 URL 转发不支持 HTTPS 来源，不能直接承担 https://cuberoot.me 的跳转。', 'DNS resolution precedes the HTTPS connection; a 301 is an HTTP response. AliDNS built-in URL forwarding does not support an HTTPS source URL and cannot directly redirect https://cuberoot.me.')}</figcaption></figure>
        </section>

        <section className="dns-section" id="options">
          <SectionTitle number="04" eyebrow={t('方案对照', 'THE OPTIONS')} title={t('Cloudflare 免费，究竟能做到哪一步', 'What Cloudflare Free can actually do')} />
          <div className="dns-option-list">
            <Option n="A" status={t('免费，但网址会变', 'Free; URL changes')} title={t('阿里 DNS 保持原样，海外跳到 CF 子域名', 'Keep AliDNS; redirect overseas to a CF subdomain')} body={t('可在 CF Pages 给 global.cuberoot.me 绑定自定义子域名，并在阿里 DNS 加 CNAME。海外访客先到 cuberoot.me 的某个 HTTPS 服务，再由它返回 301/302 到 global.cuberoot.me。国内继续走阿里云。这个方案需要真正的海外 HTTPS 跳转入口，不能把 DNS 记录写成“301”。如果是完整 Next.js 站点，Pages 的子域名能力也不等于原项目已经能运行；还需适配 Workers 并逐项验收。', 'CF Pages can attach global.cuberoot.me through a CNAME in AliDNS. Overseas visitors first reach an HTTPS service for cuberoot.me, which responds with a 301/302 to global.cuberoot.me. China can keep its Alibaba route. This requires a real HTTPS redirect endpoint; DNS cannot emit a 301. A Pages custom subdomain also does not prove the full Next.js app will run without Workers adaptation and validation.')} result={t('用户最后看到 global.cuberoot.me，不符合“网址完全一样”。', 'Visitors end at global.cuberoot.me, so the URL requirement fails.')} />
            <Option n="B" status={t('免费，保留同一网址', 'Free; one URL')} title={t('把主域 NS 改到 Cloudflare', 'Move the main domain’s NS to Cloudflare')} body={t('Cloudflare Free/Pro 官方只提供完整接入：主域权威 NS 改到 CF，DNS 记录在 CF 管理。浏览器可继续显示 cuberoot.me，也可以让 CF 回源到阿里云；但是阿里 DNS 原有的国内外分线路此时不再控制主域解析。如果 CF 代理国内请求，国内访客也会先经过 CF；这已不是“国内直达阿里云”。', 'Cloudflare Free/Pro officially support full setup: move the authoritative NS to CF and manage DNS there. The browser can still show cuberoot.me, and CF can proxy to Alibaba as origin. Alibaba’s existing regional rules no longer control the apex, though; if CF proxies China traffic, those visitors pass through CF before Alibaba.')} result={t('满足同一网址；不能同时保留“阿里 DNS 分流 + 国内直达”。', 'One URL survives; the AliDNS split and direct China route do not.')} />
            <Option n="C" status={t('需要付费及主域能力核对', 'Paid; apex needs review')} title={t('保留阿里权威 DNS，只让海外主域进 CF', 'Keep Alibaba authoritative; send overseas apex to CF')} body={t('Cloudflare 的 CNAME/partial setup 允许保留外部权威 DNS，但官方仅开放给 Business/Enterprise。它通常为单独子域名配置 CNAME；对 cuberoot.me 这个裸域还需要权威 DNS 支持 CNAME Flattening/ALIAS 或其他官方支持的入口，并核查阿里当前套餐及线路记录能否配置。不能把普通 CNAME 直接放在裸域上，也不能把付费 partial setup 当成免费能力。', 'Cloudflare’s CNAME/partial setup can keep external authoritative DNS, but is limited to Business/Enterprise. It normally uses CNAMEs for individual subdomains. The apex cuberoot.me also needs supported flattening/ALIAS or another approved entry, and the available Alibaba DNS plan and line records must be checked. An ordinary apex CNAME is invalid, and partial setup is not a Free feature.')} result={t('方向上接近你的目标；需付费、核对主域接入并完成技术与合规验证。', 'Closest to the target; requires payment plus apex, technical, and compliance validation.')} />
          </div>
          <div className="dns-rule"><strong>{t('关键区别', 'THE KEY DISTINCTION')}</strong><p>{t('“阿里 DNS 里填一个 CF 地址”不等于“CF 免费托管主域”。CF Pages 文档确实允许外部 DNS 给子域名做 CNAME；它同时明确裸域作为 Pages 自定义域名要先成为该 CF 账户中的 zone。CF 对主域的部分接入又是 Business/Enterprise 功能。', 'Putting a CF target in AliDNS does not by itself make an apex domain a CF Free hosted site. Pages documentation allows an external-DNS CNAME for a subdomain, but requires the apex custom domain to be a zone in the CF account. Partial setup for the apex is a Business/Enterprise feature.')}</p></div>
        </section>

        <section className="dns-section" id="migration">
          <SectionTitle number="05" eyebrow={t('从图纸到上线', 'BEFORE A MIGRATION')} title={t('即使 DNS 可配，整站迁移还要过两关', 'DNS is only one part of a site migration')} />
          <div className="dns-migration-grid"><div data-site-surface="panel"><Server size={25} /><h3>{t('应用能否运行', 'Application compatibility')}</h3><p>{t('CubeRoot 是带服务端路由的 Next.js 站点，不是只上传静态 HTML。Cloudflare 的完整 Next.js 方案走 Workers，需要适配和测试。当前仓库还有 node:fs 路由、按 VERCEL 判断的分支、依赖静态站的回退，以及约 31.2 MiB 的 ffmpeg-core.wasm；它超过 Workers 单个静态资产 25 MiB 限制。需要逐项搬迁或改交付路径。', 'CubeRoot is a Next.js app with server routes, not just static HTML. Full Next.js on Cloudflare uses Workers and needs compatibility testing. The repository also has node:fs routes, VERCEL-gated behavior, static-host fallbacks, and an approximately 31.2 MiB ffmpeg-core.wasm, above the Workers 25 MiB per-static-asset limit. Each needs a migration or alternate delivery path.')}</p></div><div data-site-surface="panel"><Globe2 size={25} /><h3>{t('流量与数据走哪里', 'Where traffic and data go')}</h3><p>{t('国内服务器和备案信息不能因为换 DNS 就自动延续到海外处理链。若国内用户经过 CF 代理，或登录、账号、IP 等信息进入海外 Worker，应先画明数据流，核对备案接入信息、隐私告知及适用的数据出境要求。Cloudflare 中国网络是单独的 Enterprise 订阅，不能把免费版当作中国境内节点。DNS 地理判断也会有误路由，不能当作严格的境内外隔离边界。这里是实施核对项，不是对现状作违法判断。', 'Changing DNS does not automatically carry domestic hosting and filing assumptions into an overseas processing path. If China traffic traverses CF or login, account, and IP data reach an overseas Worker, map the data flow and review filing, privacy notice, and applicable cross-border requirements. Cloudflare China Network is a separate Enterprise subscription, not a Free-plan China edge. Geo DNS can misroute and is not a strict isolation boundary. These are implementation checks, not a claim that the present setup is unlawful.')}</p></div></div>
          <div className="dns-end"><div><span>{t('给 cuberoot.me 的建议', 'FOR CUBEROOT.ME')}</span><h3>{t('先确定哪个条件可以调整', 'Choose which requirement can move')}</h3></div><ol><li>{t('必须免费、必须同一个网址：可评估全站迁到 CF NS / Workers，但国内访问路径与现有分流会变。', 'Free + same URL: evaluate CF NS / Workers, knowing the China path and current split change.')}</li><li>{t('必须免费、必须保留阿里分流：可以先用 CF 子域名，但海外最终网址会变。', 'Free + AliDNS split: use a CF subdomain, accepting a changed overseas URL.')}</li><li>{t('必须四项全保留：不能按免费方案承诺，应核对付费 partial setup、裸域能力和完整迁移成本。', 'All four requirements: do not promise a Free implementation; evaluate paid partial setup, apex support, and full migration cost.')}</li></ol></div>
        </section>

        <footer className="dns-sources dns-section" id="sources"><SectionTitle number="06" eyebrow={t('可追溯的依据', 'PRIMARY SOURCES')} title={t('官方资料与更新边界', 'Official documentation and scope')} /><p>{t('产品套餐、限制与站点配置都会变化。方案判断以页面撰写时的官方文档与 2026-09-25 的 DNS 查询为依据；真正切换前需要重新核实。', 'Plans, limits, and site configuration can change. This assessment uses official documentation and DNS observations from 2026-09-25; verify again before any cutover.')}</p><div className="dns-source-list">{SOURCES.map((source, index) => <a key={source.href} href={source.href} target="_blank" rel="noreferrer"><span>{String(index + 1).padStart(2, '0')}</span>{t(source.zh, source.en)}<ArrowUpRight size={16} /></a>)}</div><div className="dns-footer-nav"><AppLink href="/dev/architecture/flow" prefetch={false}>{t('继续看整站请求拓扑', 'Explore the full request map')} <ArrowRight size={16} /></AppLink><AppLink href="/dev" prefetch={false}>{t('返回开发目录', 'Back to dev index')} <ArrowRight size={16} /></AppLink></div><small>CubeRoot · {t('DNS 与交付架构笔记', 'DNS and delivery architecture note')} · 2026.09.25</small></footer>
      </article>
    </div>
  </main>;
}

function SectionTitle({ number, eyebrow, title }: { number: string; eyebrow: string; title: string }) {
  return <div className="dns-section-heading"><span>{number} / {eyebrow}</span><h2>{title}</h2></div>;
}

function Option({ n, status, title, body, result }: { n: string; status: string; title: string; body: string; result: string }) {
  return <div className="dns-option" data-site-surface="panel"><div className="dns-option-head"><span>{n}</span><small>{status}</small></div><div><h3>{title}</h3><p>{body}</p><strong>{result}</strong></div></div>;
}
