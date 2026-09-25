'use client';

import Image from 'next/image';
import { ArrowDown, ArrowUpRight, Check, CircleHelp, FileText, ShieldCheck, Activity, Server, Globe2, ScanLine } from 'lucide-react';
import AppLink from '@/components/AppLink';
import HeaderToggles from '@/components/HeaderToggles';
import JsonLd from '@/components/JsonLd';
import { useT } from '@/hooks/useT';
import { tr, useLang } from '@/i18n/tr';
import { PAGE_META } from '@/lib/page-meta';
import { ASSETS, FIREWALL_SNAPSHOTS, REPO, TIMELINE } from './_data';
import './incident.css';

export default function TrafficIncidentPage() {
  const t = useT();
  const lang = useLang();
  const meta = PAGE_META['dev/traffic-incident-2026-09'];
  const toc = [
    ['story', t('发生了什么', 'What happened')],
    ['evidence', t('日志与截图', 'Logs and screenshots')],
    ['numbers', t('请求与访问量', 'Requests and visitors')],
    ['timeline', t('处置时间线', 'Response timeline')],
    ['defense', t('防护如何工作', 'How protection works')],
    ['lessons', t('问题与后续工作', 'Issues and next steps')],
  ];

  return (
    <main className="incident-page">
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Article', headline: tr(meta.title), description: tr(meta.description!), inLanguage: lang === 'zh' ? 'zh-Hans' : 'en', author: { '@type': 'Organization', name: 'CubeRoot' }, image: `https://cuberoot.me${ASSETS}vercel-analytics-sep22-v2.png`, about: { '@type': 'Thing', name: 'CubeRoot September 2026 traffic incident' } }} />
      <div className="incident-wrap">
        <header className="incident-topbar">
          <AppLink href="/dev" prefetch={false} className="incident-brand">CubeRoot <span>/ {t('开发日志', 'Engineering journal')}</span></AppLink>
          <HeaderToggles />
        </header>

        <article>
          <header className="incident-hero">
            <div className="incident-hero-copy">
              <p className="incident-eyebrow"><span /> {t('事件档案', 'INCIDENT ARCHIVE')} · 001</p>
              <p className="incident-dateline">2026.09.22 — 09.25</p>
              <h1>{t('9 月流量事件记录', 'September traffic incident')}</h1>
              <p className="incident-deck">{t('9 月 22 日，计算器访问量突增。本文记录排查依据、停站与恢复过程，以及新增的防护措施。', 'Calculator traffic spiked on September 22. This record covers the investigation, service pauses, reopening and protection changes.')}</p>
              <p className="incident-byline">{t('CubeRoot · 运维记录', 'CubeRoot · Operations log')}</p>
            </div>
            <figure className="incident-cover">
              <svg viewBox="0 0 420 350" role="img" aria-labelledby="incident-cover-title">
                <title id="incident-cover-title">{t('示意：密集请求穿过分层防护，一部分被挡住，一部分继续到达网站', 'Illustration: dense requests pass through layered protection; some stop, others reach the site')}</title>
                <defs><pattern id="incident-grid" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="var(--border-strong)" /></pattern></defs>
                <rect width="420" height="350" fill="url(#incident-grid)" />
                <circle cx="245" cy="178" r="135" className="incident-orbit" /><circle cx="245" cy="178" r="104" className="incident-orbit" />
                {[70, 105, 140, 175, 210, 245, 280].map((y, i) => <g key={y}><path d={`M 20 ${y} C 110 ${y}, 120 178, 191 178`} className="incident-stream" /><circle cx={40 + i * 11} cy={y} r={i % 2 ? 3 : 5} className="incident-packet" /></g>)}
                <path d="M245 96 L304 120 L298 194 Q285 235 245 254 Q205 235 192 194 L186 120 Z" className="incident-shield" />
                <path d="M220 174 L238 192 L270 153" fill="none" stroke="var(--signal-success)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M306 178 H390" className="incident-pass" /><circle cx="365" cy="178" r="5" fill="var(--signal-success)" />
                <path d="M154 163 V78 H203 M154 199 V276 H203" className="incident-stop" />
                <path d="M198 72 L210 84 M210 72 L198 84 M198 270 L210 282 M210 270 L198 282" className="incident-stop" />
                <text x="22" y="328">REQUEST → FILTER → SERVE</text>
              </svg>
              <figcaption>{t('分层防护示意 · 非实测流量图', 'Layered protection illustration · not traffic measurements')}</figcaption>
            </figure>
          </header>

          <div className="incident-snapshot-note"><FileText size={17} aria-hidden="true" /><p>{t('记录截至 2026-09-25。页面中的流量和配置均为当时状态。', 'Record through September 25, 2026. Traffic and configuration shown here are historical.')}</p></div>

          <nav className="incident-toc" aria-label={t('文章目录', 'Article contents')}>{toc.map(([id, label], index) => <a key={id} href={`#${id}`}><span>0{index + 1}</span>{label}<ArrowDown size={14} aria-hidden="true" /></a>)}</nav>

          <section id="story" className="incident-section">
            <div className="incident-section-heading"><span>01 / {t('经过', 'THE STORY')}</span><h2>{t('事件经过与访问影响', 'What happened and who was affected')}</h2></div>
            <div className="incident-prose"><p>{t('9 月 22 日，成绩计算器访问量突增。抽查日志发现，请求反复更换比赛、选手和轮次参数，其中一条声明使用 Lightpanda 无头浏览器。无头浏览器可以由程序控制，自动打开网页。', 'On September 22, calculator traffic spiked. Sampled requests repeatedly changed competition, competitor and round parameters. One declared Lightpanda, a headless browser that programs can use to open pages.')}</p><p>{t('9 月 24—25 日，我们限制了计算器和比赛数据请求，暂停过主站，随后恢复访问。期间，正常用户也会遇到验证页面、计算器拒绝访问和维护提示。', 'On September 24–25, we restricted calculator and competition-data requests, paused the main site and later reopened it. Legitimate users also encountered challenges, a blocked calculator and maintenance pages.')}</p></div>
            <div className="incident-facts" data-site-surface="panel">
              <div><span>{t('已观察到', 'OBSERVED')}</span><strong>{t('自动化访问迹象', 'Signs of automated access')}</strong><p>{t('快速变换参数、连续访问、大量计算器链接，以及无头浏览器声明。', 'Rapid parameter changes, repeated calculator links and a headless-browser claim.')}</p></div>
              <div><span>{t('仍然未知', 'NOT ESTABLISHED')}</span><strong>{t('谁在操作，以及为什么', 'Who was operating it, and why')}</strong><p>{t('无法确认操作者、恶意请求占比或全站独立人数。现有记录也不足以判断是否发生数据泄露。', 'The operator, malicious share and site-wide people count remain unknown. These records also do not determine whether a data breach occurred.')}</p></div>
            </div>
          </section>

          <section id="evidence" className="incident-section">
            <div className="incident-section-heading"><span>02 / {t('证据', 'THE EVIDENCE')}</span><h2>{t('计算器流量与日志样本', 'Calculator traffic and log samples')}</h2></div>
            <div className="incident-metrics">{[
              ['9,268', t('Analytics 访客标识', 'Analytics visitors')], ['9,531', t('页面浏览事件', 'Page-view events')], ['95%', t('跳出率', 'Bounce rate')],
            ].map(([value, label]) => <div key={value}><strong>{value}</strong><span>{label}</span></div>)}</div>
            <p className="incident-caption">{t('仅 /zh/calc · 2026-09-22 全天 · 仪表盘 PDT（UTC−7）。访客标识不等于已核验的自然人。', '/zh/calc only · September 22, 2026 · dashboard PDT (UTC−7). Visitor identifiers are not verified people.')}</p>
            <figure className="incident-evidence">
              <a href={`${ASSETS}vercel-analytics-sep22-v2.png`} target="_blank" rel="noreferrer" aria-label={t('打开 Vercel 历史曲线原图', 'Open the original Vercel historical chart')}><Image src={`${ASSETS}vercel-analytics-sep22-v2.png`} alt={t('Vercel 历史报表：9 月 22 日筛选 /zh/calc，9,268 Visitors、9,531 Page Views、95% Bounce Rate，下午开始明显上升', 'Vercel historical report for /zh/calc on September 22: 9,268 visitors, 9,531 page views, 95% bounce rate, rising sharply in the afternoon')} width={1372} height={858} unoptimized /></a>
              <figcaption><span>E1</span><div>{t('9 月 22 日的 Analytics 报表，截图时间为 9 月 25 日 10:01 UTC。点击可放大。侧栏状态属于截图时刻。', 'Analytics for September 22, captured on September 25 at 10:01 UTC. Open to enlarge. Sidebar status is from the capture time.')}<br />{t('Analytics 统计浏览器上报事件，可能包含阿里云线路，不能用来计算 Vercel 请求总量。', 'Analytics records browser events and may include the self-hosted route. It does not measure total Vercel requests.')}</div></figcaption>
            </figure>
            <div className="incident-evidence-grid">
              <div className="incident-evidence-note"><ScanLine size={23} aria-hidden="true" /><h3>{t('15 条请求样本', 'A sample of 15 requests')}</h3><p>{t('9 月 22 日晚抽查了 15 条连续请求，均带比赛和选手参数。其中 1 条声明 Lightpanda/1.0。参数变化和客户端声明支持自动化访问的判断，但无法据此计算机器人占比。', 'All 15 consecutive requests sampled that evening carried competition and competitor parameters. One declared Lightpanda/1.0. The parameter changes and client claim support automation, but do not establish its share of traffic.')}</p><a href={`${REPO}docs/traffic-incident-2026-09-22.md`} target="_blank" rel="noreferrer">{t('查看原始调查记录', 'Read the original investigation')} <ArrowUpRight size={14} /></a></div>
              <div className="incident-correction" data-site-surface="panel"><CircleHelp size={23} aria-hidden="true" /><h3>{t('误判：把预取当成攻击', 'Correction: prefetching mistaken for an attack')}</h3><p>{t('9 月 24 日晚，部分预测章节和公式页在同一秒出现多条请求。初步判断把它们当成异常遍历；检查详情后发现 Prefetch: Yes 和 _rsc 参数。这批请求可以由 Next.js 预取解释，不能凭时间戳密集就认定为攻击。', 'On September 24, several prediction and algorithm pages appeared within the same second. We initially treated this as suspicious traversal. Details showed Prefetch: Yes and _rsc parameters, which Next.js prefetching can explain. Dense timestamps alone did not establish an attack.')}</p><a href="https://nextjs.org/docs/app/guides/prefetching" target="_blank" rel="noreferrer">{t('Next.js 官方预取说明', 'Next.js prefetching documentation')} <ArrowUpRight size={14} /></a></div>
            </div>
          </section>

          <section id="numbers" className="incident-section">
            <div className="incident-section-heading"><span>03 / {t('口径', 'MEASUREMENT')}</span><h2>{t('请求数如何理解', 'How to read request counts')}</h2></div>
            <p className="incident-prose">{t('打开一个页面会加载脚本、图片和接口数据，还可能触发预取。因此，请求数不能直接换算成人数。多人可能共用 IP，一人也可能更换 IP。缺少同一时间段的完整日志，就无法确认 15,000 次请求对应多少人，或“400 个 IP”是否为全站去重结果。', 'One page loads scripts, images and API data, and may trigger prefetching. Requests therefore cannot be converted directly into people. People can share or change IPs. Without complete logs for one time window, neither 15,000 requests nor “400 IPs” establishes a site-wide people count.')}</p>
            <figure className="incident-fanout" data-site-surface="panel">
              <div className="incident-fanout-start"><span>1</span><strong>{t('打开页面', 'Open a page')}</strong></div>
              <svg viewBox="0 0 140 220" aria-hidden="true"><path d="M0 110 H35 Q55 110 55 30 H140 M35 110 H140 M55 110 V190 H140" fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="5 5" /></svg>
              <div className="incident-fanout-ends"><div><strong>HTML + CSS + JS</strong><span>{t('页面和脚本', 'Document and scripts')}</span></div><div><strong>{t('图片与 API', 'Images & API')}</strong><span>{t('内容和数据', 'Content and data')}</span></div><div><strong>Prefetch</strong><span>{t('提前加载链接内容', 'Load linked content ahead')}</span></div></div>
              <figcaption>{t('请求放大示意。实际请求数量随页面、缓存和操作而变。', 'Illustration of request fan-out. Actual counts vary with page, cache and actions.')}</figcaption>
            </figure>
            <div className="incident-observation" data-site-surface="panel">
              <div className="incident-donut" role="img" aria-label={t('主站 nginx 1,503 次请求：静态资源 1,125 次，占 74.9%；其他 378 次', 'Of 1,503 main-site nginx requests, 1,125 were static assets (74.9%) and 378 were other requests')}><div><strong>74.9<span>%</span></strong><small>/_next/</small></div></div>
              <div><p className="incident-eyebrow">09.25 · 08:34–08:44 UTC</p><h3>{t('主站请求中，静态资源占 74.9%', 'Static assets made up 74.9% of main-site requests')}</h3><p>{t('自有主站共 1,503 次请求：1,125 次访问 /_next/，其余 378 次。“其余”仍不等于页面浏览。同窗口独立 API 有 1,541 次请求，没有 429 或 5xx；它们可能来自同一批读者，不能相加当人数。', 'The self-hosted main site recorded 1,503 requests: 1,125 to /_next/ and 378 others. “Others” still does not mean page views. The independent API recorded 1,541 requests with no 429 or 5xx; these may serve the same readers and cannot be added as people.')}</p><p className="incident-caption">{t('短窗口观测；不代表全天，也不能解释 Vercel 独立线路。', 'A short observation window, not a full day or an explanation of Vercel-only traffic.')}</p></div>
            </div>
            <h3 className="incident-chart-title">{t('Vercel：两份独立的十分钟快照', 'Vercel: two separate ten-minute snapshots')}</h3>
            <div className="incident-bar-panels">{FIREWALL_SNAPSHOTS.map(snapshot => <figure key={snapshot.window} className="incident-bar-panel" data-site-surface="panel"><figcaption>{snapshot.window}</figcaption>{([
              ['allowed', t('放行', 'Allowed'), snapshot.allowed], ['denied', t('拒绝', 'Denied'), snapshot.denied], ['challenged', t('验证', 'Challenged'), snapshot.challenged],
            ] as const).map(([key, label, count]) => <div className="incident-bar-row" key={key}><div><span>{label}</span><strong>{snapshot.approximate ? '≈ ' : ''}{count.toLocaleString('en-US')}</strong></div><div className="incident-bar-track"><span className={`incident-bar-${key}`} style={{ width: `${count / 8300 * 100}%` }} /></div></div>)}</figure>)}</div>
            <p className="incident-caption">{t('相同线性尺度，最大 8,300。数据来自处置时保存的记录，均为请求／规则动作。窗口、流量构成不同，不能计算“防护降低了多少”；Challenged 也不等于成功阻断。', 'Same linear scale, maximum 8,300. These request/action counts come from incident notes. Different windows and traffic composition prevent a causal “reduction” claim. Challenged does not mean successfully blocked.')}</p>
          </section>

          <section id="timeline" className="incident-section">
            <div className="incident-section-heading"><span>04 / {t('行动', 'THE RESPONSE')}</span><h2>{t('暂停与恢复记录', 'Pauses and reopening')}</h2><p>{t('以下时间统一为 PDT（UTC−7）。这是处置记录，不是连续流量曲线。', 'All times below are PDT (UTC−7). This is a response history, not a continuous traffic series.')}</p></div>
            <ol className="incident-timeline">{TIMELINE.map((event, index) => <li key={`${event.date}-${event.time}`}><div className="incident-timeline-date"><strong>{event.date}</strong><span>{event.time}</span></div><div className="incident-timeline-node">{index === TIMELINE.length - 1 ? <Check size={13} /> : <span />}</div><div className="incident-timeline-copy"><h3>{tr(event)}</h3><p>{tr(event.detail)}</p></div></li>)}</ol>
          </section>

          <section id="defense" className="incident-section">
            <div className="incident-section-heading"><span>05 / {t('设计', 'THE DESIGN')}</span><h2>{t('Vercel 与阿里云分别防护', 'Protection on Vercel and the self-hosted server')}</h2></div>
            <p className="incident-prose">{t('主站由 Vercel 和阿里云分线路服务，API 有独立域名。Vercel 防火墙不覆盖阿里云；阿里云日志也看不到 Vercel 的独立请求。两边分别配置规则和监控。', 'The main site uses Vercel and a self-hosted Alibaba Cloud server; the API has its own domain. Vercel’s firewall does not cover that server, and server logs do not see Vercel-only requests. Each has separate rules and monitoring.')}</p>
            <figure className="incident-routing">
              <div className="incident-routing-origin"><Globe2 size={22} /><strong>{t('访问 cuberoot.me', 'Visit cuberoot.me')}</strong><span>{t('DNS 分线路', 'DNS routes traffic')}</span></div>
              <div className="incident-route-lanes">
                <div className="incident-lane" data-site-surface="panel"><div className="incident-lane-title"><ShieldCheck size={22} /><h3>Vercel</h3></div><div className="incident-route-node">{t('平台 DDoS 缓解 + WAF', 'Platform DDoS mitigation + WAF')}</div><ArrowDown size={18} /><div className="incident-route-node">{t('挑战 / 拒绝 / 单 IP 限流', 'Challenge / deny / per-IP limits')}</div><ArrowDown size={18} /><div className="incident-route-node">{t('生产页面', 'Production pages')}</div><p>{t('Firewall 观测 · 独立费用预算暂停', 'Firewall observations · separate spend pause')}</p></div>
                <div className="incident-lane" data-site-surface="panel"><div className="incident-lane-title"><Server size={22} /><h3>{t('阿里云自有服务器', 'Self-hosted server')}</h3></div><div className="incident-route-node">{t('nginx：主站 / next / API', 'nginx: main / next / API')}</div><ArrowDown size={18} /><div className="incident-route-node">{t('单 IP + 总量 + 并发限制', 'Per-IP + aggregate + concurrency limits')}</div><ArrowDown size={18} /><div className="incident-route-node">{t('Next.js / 独立 Hono API', 'Next.js / independent Hono API')}</div><p>{t('本地日志 → 分钟检查 → 维护 / 503', 'Local logs → minute checks → maintenance / 503')}</p></div>
              </div><figcaption>{t('覆盖示意：API 也可直接访问；上图省略 static 与开发预览等独立入口，不能把两条主站线路当作完整网络拓扑。', 'Coverage illustration: the API can also be accessed directly. Static assets and development previews are omitted; these two routes are not the complete network topology.')}</figcaption>
            </figure>
            <figure className="incident-evidence"><a href={`${ASSETS}vercel-firewall-rules-sep25-v1.png`} target="_blank" rel="noreferrer" aria-label={t('打开 Vercel 防护规则原图', 'Open the original Vercel firewall rules screenshot')}><Image src={`${ASSETS}vercel-firewall-rules-sep25-v1.png`} alt={t('Vercel 规则截图：计算器拒绝、计算器和比赛 API 限流、详情页验证、Bot Protection Challenge、AI Bots Deny', 'Vercel rules: calculator deny, calculator and competition API rate limits, detail-page challenge, Bot Protection Challenge, and AI Bots Deny')} width={1088} height={730} loading="lazy" unoptimized /></a><figcaption><span>E3</span><div>{t('Vercel 防火墙规则，截图于 9 月 25 日 09:38 UTC。截图记录配置，不代表拦截效果。', 'Vercel firewall rules captured on September 25 at 09:38 UTC. The screenshot records configuration, not effectiveness.')}</div></figcaption></figure>

            <div className="incident-guard" data-site-surface="panel"><div className="incident-guard-title"><Activity size={24} /><div><p className="incident-eyebrow">{t('服务器自动守护', 'LOCAL AUTOMATIC GUARD')}</p><h3>{t('分钟检查与自动停站', 'Minute checks and automatic maintenance')}</h3></div></div><ol className="incident-guard-steps">{[
              [t('读日志', 'Read'), t('最近两个完整分钟', 'Last two complete minutes')],
              [t('作判断', 'Evaluate'), t('极高单分钟 / 持续两分钟', 'Extreme minute / sustained pair')],
              [t('切维护', 'Switch'), t('主站、next 与 API', 'Main site, next and API')],
              [t('通知人', 'Notify'), t('尝试推送，人工决定恢复', 'Attempt alert; reopen manually')],
            ].map(([title, detail], index) => <li key={title}><span>0{index + 1}</span><strong>{title}</strong><p>{detail}</p></li>)}</ol><p className="incident-guard-boundary">{t('此程序只覆盖阿里云，检查频率为每分钟一次。定时器已运行；超阈值后的停站和告警送达尚未做生产演练。', 'This guard covers only the self-hosted server and checks once a minute. The timer has run; a production threshold trip and alert delivery have not yet been drilled.')}</p></div>

            <div className="incident-details">
              <details><summary>{t('接口与缓存改动', 'API and cache changes')}</summary><div><p>{t('为比赛代理拒绝未知、重复或畸形参数；让缓存键只保留有效参数与版本号；复用缓存及相同回源合并；限制单来源之外的总量与并发；公开 next 别名复用限制，避免换入口绕过。robots 只约束合作爬虫。', 'Reject unknown, repeated or malformed competition-proxy parameters; keep effective parameters and version in cache keys; reuse caching and request coalescing; limit aggregate work and concurrency; protect the public next alias too. Robots directives only guide cooperative crawlers.')}</p><p>{t('初始阈值来自短期观测，需要调整。代码扫描每份日志尾部最多 32 MiB，本地机器故障也会影响守护；目前不应宣称覆盖所有异常。', 'Initial thresholds came from short observations and need tuning. The guard reads at most 32 MiB from each log tail, and local machine failures affect it too. It cannot claim to catch every anomaly.')}</p><a href={`${REPO}core/scripts/traffic-guard.ts`} target="_blank" rel="noreferrer">{t('阅读守护程序源码', 'Read the guard source')} ↗</a></div></details>
              <details><summary>{t('验证码能挡住所有机器人吗？', 'Can a challenge stop every bot?')}</summary><div><p>{t('不能。挑战增加自动化访问的成本，也会打扰正常读者。Vercel Attack Mode 会放行其已验证的部分机器人；访问成本仍要靠缓存、接口限额和总量保护控制。不能把 Challenged 计数当作成功拦截人数。', 'No. Challenges raise the cost of automation but also add friction for readers. Vercel Attack Mode allows recognized verified bots; caching, API limits and aggregate protection must still control cost. A Challenged counter is not a count of people successfully blocked.')}</p><a href="https://vercel.com/docs/vercel-firewall/attack-mode" target="_blank" rel="noreferrer">{t('Vercel 官方说明', 'Vercel documentation')} ↗</a></div></details>
              <details><summary>{t('监控费用', 'Monitoring costs')}</summary><div><p>{t('复用已有服务器、日志、定时器与通知渠道，没有购买新监控服务。原服务器、固定套餐和放行请求的消耗仍然存在。Vercel 的额外用量预算暂停有检查延迟，也不能保证每一笔费用精确封顶。', 'It reuses the existing server, logs, timer and alert channel without buying a monitoring product. Server costs, subscriptions and allowed-request usage still exist. Vercel spend checks have delay and do not provide an exact hard cap on every charge.')}</p><a href="https://vercel.com/docs/spend-management" target="_blank" rel="noreferrer">{t('费用保护的官方边界', 'Spend-management limits')} ↗</a></div></details>
              <details><summary>{t('爬虫验证与其他网站的做法', 'Crawler verification and other sites')}</summary><div><p>{t('bingbot/2.0 是 User-Agent 中的身份声明；字符串可以伪造，要用 Bing 官方工具或 DNS 验证。真实爬虫也可能产生很大负担，应按访问行为与资源成本控制。', 'bingbot/2.0 is a User-Agent identity claim and can be forged. Verify it using Bing’s tools or DNS. Authentic crawlers can still create substantial load, so control behavior and resource cost.')}</p><p>{t('本次对照研究中，WCA 公开源码展示了 robots、API 限流和缓存，数据文档提供批量导出。cubing.com 的线上响应与旧公开仓库技术栈不同；公开源码不足以证明它当前用了什么验证码或 WAF 阈值。', 'Our comparison found robots rules, API throttling and caching in WCA’s public code, plus bulk exports in its data documentation. cubing.com’s live responses differed from its older public stack; public code does not establish its current challenge or WAF settings.')}</p><a href="https://www.bing.com/webmasters/help/how-to-verify-bingbot-3905dc26" target="_blank" rel="noreferrer">{t('验证 Bingbot', 'Verify Bingbot')} ↗</a><a href={`${REPO}docs/traffic-defense.md`} target="_blank" rel="noreferrer">{t('对照研究与来源', 'Comparison notes and sources')} ↗</a></div></details>
            </div>
          </section>

          <section id="lessons" className="incident-section">
            <div className="incident-section-heading"><span>06 / {t('复盘', 'THE LESSONS')}</span><h2>{t('排查中发现的问题', 'Issues found during the investigation')}</h2></div>
            <div className="incident-lessons">{[
              [t('日志判断需要上下文', 'Log analysis needs context'), t('先核对路径、预取、来源与错误，再判断。浏览器声明、IP 国家和指纹都不能单独证明身份或动机。', 'Check paths, prefetching, sources and errors. Browser claims, IP countries and fingerprints alone do not prove identity or intent.')],
              [t('部署后检查线上行为', 'Check live behavior after deployment'), t('nginx 曾在部署任务成功后继续运行旧 worker；Vercel 也曾因项目暂停阻止构建。两者都需要在发布后检查实际响应。', 'nginx kept old workers running after a successful deployment job. Vercel also blocked builds while the project was paused. Both required checking live responses after deployment.')],
              [t('检查正常用户是否被拦截', 'Check for blocked legitimate users'), t('正常访问会遇到挑战和停站，真实热门流量也可能触发阈值。应观察误拦截，再逐步调整限制。', 'Real readers face challenges and downtime; legitimate popularity can also cross thresholds. Observe false positives and refine the controls.')],
            ].map(([title, body], index) => <div key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{body}</p></div>)}</div>
            <div className="incident-open-items" data-site-surface="panel"><h3>{t('待完成', 'Remaining work')}</h3><ul><li>{t('复核正常用户长窗口、挑战通过率和阈值误伤。', 'Review longer windows, challenge completion and false positives.')}</li><li>{t('补足 Vercel 独立线路的自动观测与止损，同时遵守不新增收费项的约束。', 'Close the Vercel telemetry and automatic-stop gap without adding paid services.')}</li><li>{t('专门演练超阈值后的实际停站、告警送达与恢复。', 'Run a dedicated drill for the threshold trip, actual maintenance response, alert delivery and recovery.')}</li><li>{t('继续审计开发预览入口和其他高成本接口，降低计算器自动取数的负担。', 'Audit development previews and other costly endpoints, and reduce automatic calculator data fetching.')}</li></ul></div>
          </section>

          <footer className="incident-sources"><p className="incident-eyebrow">{t('证据与维护记录', 'EVIDENCE & MAINTENANCE')}</p><h2>{t('相关文档', 'Related documents')}</h2><p>{t('数据来源、部署记录和恢复步骤见以下文档。图表标注统计时间，示意图单独注明。', 'The documents below contain data sources, deployment records and recovery steps. Charts state their time windows; diagrams are labeled as illustrations.')}</p><div className="incident-source-links">{[
            ['docs/traffic-incident-2026-09-22-25.md', t('本次事件完整 MD', 'Full incident Markdown')], ['docs/traffic-incident-2026-09-22.md', t('最初调查', 'Initial investigation')], ['docs/traffic-defense.md', t('处置与发布记录', 'Mitigation and releases')], ['docs/traffic-monitor.md', t('监控与恢复手册', 'Monitoring and recovery')],
          ].map(([path, label]) => <a key={path} href={`${REPO}${path}`} target="_blank" rel="noreferrer"><FileText size={16} />{label}<ArrowUpRight size={15} /></a>)}</div><p className="incident-colophon">CubeRoot · {t('2026 年 9 月事件记录', 'September 2026 incident record')}</p></footer>
        </article>
      </div>
    </main>
  );
}
