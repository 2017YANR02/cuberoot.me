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
    ['evidence', t('从证据到判断', 'Reading the evidence')],
    ['numbers', t('读懂这些数字', 'Understanding the numbers')],
    ['timeline', t('处置时间线', 'Response timeline')],
    ['defense', t('防护如何工作', 'How protection works')],
    ['lessons', t('留下的功课', 'What remains')],
  ];

  return (
    <main className="incident-page">
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Article', headline: tr(meta.title), description: tr(meta.description!), inLanguage: lang === 'zh' ? 'zh-Hans' : 'en', author: { '@type': 'Organization', name: 'CubeRoot' }, image: `https://cuberoot.me${ASSETS}vercel-analytics-sep22-v1.png`, about: { '@type': 'Thing', name: 'CubeRoot September 2026 traffic incident' } }} />
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
              <h1>{t('当流量突然涌来', 'When traffic comes flooding in')}</h1>
              <p className="incident-deck">{t('一座魔方工具站的流量事件：从一条陡升的曲线，到暂停、排查，再到让服务器学会自动停站。', 'A traffic incident at a cubing toolkit: from a sudden spike to pauses, investigation, and a server that can switch itself into maintenance.')}</p>
              <p className="incident-byline">{t('CubeRoot 工程记录 · 面向读者与开发者', 'A CubeRoot engineering account · for readers and developers')}</p>
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

          <div className="incident-snapshot-note"><FileText size={17} aria-hidden="true" /><p>{t('这是一份历史复盘。数据截至 2026-09-25，截图在当天重新取证；页面不表示网站当前的开放或防护状态。', 'This is a historical review, with evidence through September 25, 2026 and screenshots captured that day. It is not a live service-status page.')}</p></div>

          <nav className="incident-toc" aria-label={t('文章目录', 'Article contents')}>{toc.map(([id, label], index) => <a key={id} href={`#${id}`}><span>0{index + 1}</span>{label}<ArrowDown size={14} aria-hidden="true" /></a>)}</nav>

          <section id="story" className="incident-section">
            <div className="incident-section-heading"><span>01 / {t('经过', 'THE STORY')}</span><h2>{t('网站还在，访问却要先停一停。', 'The site was still there. Access had to pause.')}</h2></div>
            <div className="incident-prose"><p>{t('9 月 22 日，成绩计算器的访问曲线明显抬升。比赛、选手、轮次不断变化，一批请求沿着网站上的链接快速展开。抽样中出现了声明为无头浏览器的客户端：它像浏览器一样读取网页，却不需要有人逐次点击。', 'On September 22, traffic to the score calculator rose sharply. Requests rapidly varied competition, competitor and round parameters, following the site’s link structure. A sampled client declared itself a headless browser: software that can read pages without someone clicking each one.')}</p><p>{t('随后几天，我们为高成本路径增加限制，暂停过生产访问，也在保留防护的情况下重新开放。对普通读者而言，这意味着验证页面、暂时打不开的计算器，以及一段时间的维护提示。为此带来的不便，我们在这里说明原因和处置经过。', 'Over the following days, we restricted costly routes, paused production access and reopened with protections in place. For readers, this meant verification screens, an unavailable calculator and periods of maintenance. This account explains those disruptions and the decisions behind them.')}</p></div>
            <div className="incident-facts" data-site-surface="panel">
              <div><span>{t('已观察到', 'OBSERVED')}</span><strong>{t('自动化遍历的明显迹象', 'Strong signs of automated traversal')}</strong><p>{t('快速变换参数、连续访问、大量计算器链接，以及无头浏览器声明。', 'Rapid parameter changes, repeated calculator links and a headless-browser claim.')}</p></div>
              <div><span>{t('仍然未知', 'NOT ESTABLISHED')}</span><strong>{t('谁在操作，以及为什么', 'Who was operating it, and why')}</strong><p>{t('现有证据不能确定操作者、恶意比例或全站去重人数，也没有建立数据泄露结论。', 'The evidence does not establish the operator, malicious share, site-wide unique people or a data breach.')}</p></div>
            </div>
          </section>

          <section id="evidence" className="incident-section">
            <div className="incident-section-heading"><span>02 / {t('证据', 'THE EVIDENCE')}</span><h2>{t('曲线是起点，结论还要往下查。', 'A curve starts the investigation.')}</h2></div>
            <div className="incident-metrics">{[
              ['9,268', t('Analytics 访客标识', 'Analytics visitors')], ['9,531', t('页面浏览事件', 'Page-view events')], ['95%', t('跳出率', 'Bounce rate')],
            ].map(([value, label]) => <div key={value}><strong>{value}</strong><span>{label}</span></div>)}</div>
            <p className="incident-caption">{t('仅 /zh/calc · 2026-09-22 全天 · 仪表盘 PDT（UTC−7）。访客标识不等于已核验的自然人。', '/zh/calc only · September 22, 2026 · dashboard PDT (UTC−7). Visitor identifiers are not verified people.')}</p>
            <figure className="incident-evidence">
              <a href={`${ASSETS}vercel-analytics-sep22-v1.png`} target="_blank" rel="noreferrer" aria-label={t('打开 Vercel 历史曲线原图', 'Open the original Vercel historical chart')}><Image src={`${ASSETS}vercel-analytics-sep22-v1.png`} alt={t('Vercel 历史报表：9 月 22 日筛选 /zh/calc，9,268 Visitors、9,531 Page Views、95% Bounce Rate，下午开始明显上升', 'Vercel historical report for /zh/calc on September 22: 9,268 visitors, 9,531 page views, 95% bounce rate, rising sharply in the afternoon')} width={1088} height={580} unoptimized /></a>
              <figcaption><span>E1</span><div>{t('真实控制台截图。2026-09-25 09:37 UTC 重新打开历史窗口截取，未改动报表数据。点击查看原图。', 'Actual dashboard capture. The historical window was reopened on September 25 at 09:37 UTC; chart data is unchanged. Open the image for full size.')}<br />{t('Analytics 是浏览器上报事件，自有服务器线路也可能上报；不能直接当作 Vercel 页面请求总量。', 'Analytics consists of browser-reported events, which can also come from the self-hosted site. It is not the total number of requests served by Vercel.')}</div></figcaption>
            </figure>
            <div className="incident-evidence-grid">
              <div className="incident-evidence-note"><ScanLine size={23} aria-hidden="true" /><h3>{t('支持自动化判断的样本', 'A sample supporting automation')}</h3><p>{t('9 月 22 日晚的 15 条连续计算器样本都带比赛及选手参数，其中 1 条声明 Lightpanda/1.0。这个声明与快速系统性遍历一起，支持自动化判断；15 条样本不能代表全部访客。', 'All 15 consecutive calculator samples from the evening of September 22 carried competition and competitor parameters; one declared Lightpanda/1.0. That claim and rapid systematic traversal support automation, but the sample cannot represent all visitors.')}</p><a href={`${REPO}docs/traffic-incident-2026-09-22.md`} target="_blank" rel="noreferrer">{t('查看原始调查记录', 'Read the original investigation')} <ArrowUpRight size={14} /></a></div>
              <div className="incident-correction" data-site-surface="panel"><CircleHelp size={23} aria-hidden="true" /><h3>{t('一次必须保留的判断纠正', 'A correction worth preserving')}</h3><p>{t('9 月 24 日晚，部分预测章节与公式页日志挤在同一秒。详情却显示 Prefetch: Yes，并含 _rsc 参数。网页预取可以解释这一批请求；仅凭“太密集”就判定新攻击，证据不足。', 'On September 24, some prediction chapters and algorithm pages appeared in dense log bursts. Details showed Prefetch: Yes and _rsc parameters. Page prefetching explained that sequence; density alone did not prove another attack.')}</p><a href="https://nextjs.org/docs/app/guides/prefetching" target="_blank" rel="noreferrer">{t('Next.js 官方预取说明', 'Next.js prefetching documentation')} <ArrowUpRight size={14} /></a></div>
            </div>
          </section>

          <section id="numbers" className="incident-section">
            <div className="incident-section-heading"><span>03 / {t('口径', 'MEASUREMENT')}</span><h2>{t('请求、页面、人数，是三回事。', 'Requests, pages and people are different.')}</h2></div>
            <p className="incident-prose">{t('打开一个页面，可能同时加载脚本、图片、接口数据，再预取几个链接。一个人因此留下许多请求。多人可以共用一个出口 IP，一个人也能更换 IP。没有完整日志与统一窗口，15,000 次请求无法换算成确定的人数，“400 个 IP”也不能被直接当成全站去重结果。', 'Opening one page may load scripts, images and API data, then prefetch several links. One person can generate many requests. Several people can share an IP, and one person can change IPs. Without complete logs and a consistent window, 15,000 requests cannot yield a reliable people count, nor can “400 IPs” establish a site-wide deduplicated total.')}</p>
            <figure className="incident-fanout" data-site-surface="panel">
              <div className="incident-fanout-start"><span>1</span><strong>{t('打开页面', 'Open a page')}</strong></div>
              <svg viewBox="0 0 140 220" aria-hidden="true"><path d="M0 110 H35 Q55 110 55 30 H140 M35 110 H140 M55 110 V190 H140" fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="5 5" /></svg>
              <div className="incident-fanout-ends"><div><strong>HTML + CSS + JS</strong><span>{t('页面和脚本', 'Document and scripts')}</span></div><div><strong>{t('图片与 API', 'Images & API')}</strong><span>{t('内容和数据', 'Content and data')}</span></div><div><strong>Prefetch</strong><span>{t('提前加载链接内容', 'Load linked content ahead')}</span></div></div>
              <figcaption>{t('请求放大示意。实际请求数量随页面、缓存和操作而变。', 'Illustration of request fan-out. Actual counts vary with page, cache and actions.')}</figcaption>
            </figure>
            <div className="incident-observation" data-site-surface="panel">
              <div className="incident-donut" role="img" aria-label={t('主站 nginx 1,503 次请求：静态资源 1,125 次，占 74.9%；其他 378 次', 'Of 1,503 main-site nginx requests, 1,125 were static assets (74.9%) and 378 were other requests')}><div><strong>74.9<span>%</span></strong><small>/_next/</small></div></div>
              <div><p className="incident-eyebrow">09.25 · 08:34–08:44 UTC</p><h3>{t('恢复窗口里，多数请求是静态资源。', 'Most requests in the reopening window were static assets.')}</h3><p>{t('自有主站共 1,503 次请求：1,125 次访问 /_next/，其余 378 次。“其余”仍不等于页面浏览。同窗口独立 API 有 1,541 次请求，没有 429 或 5xx；它们可能来自同一批读者，不能相加当人数。', 'The self-hosted main site recorded 1,503 requests: 1,125 to /_next/ and 378 others. “Others” still does not mean page views. The independent API recorded 1,541 requests with no 429 or 5xx; these may serve the same readers and cannot be added as people.')}</p><p className="incident-caption">{t('短窗口观测；不代表全天，也不能解释 Vercel 独立线路。', 'A short observation window, not a full day or an explanation of Vercel-only traffic.')}</p></div>
            </div>
            <h3 className="incident-chart-title">{t('Vercel：两份独立的十分钟快照', 'Vercel: two separate ten-minute snapshots')}</h3>
            <div className="incident-bar-panels">{FIREWALL_SNAPSHOTS.map(snapshot => <figure key={snapshot.window} className="incident-bar-panel" data-site-surface="panel"><figcaption>{snapshot.window}</figcaption>{([
              ['allowed', t('放行', 'Allowed'), snapshot.allowed], ['denied', t('拒绝', 'Denied'), snapshot.denied], ['challenged', t('验证', 'Challenged'), snapshot.challenged],
            ] as const).map(([key, label, count]) => <div className="incident-bar-row" key={key}><div><span>{label}</span><strong>{snapshot.approximate ? '≈ ' : ''}{count.toLocaleString('en-US')}</strong></div><div className="incident-bar-track"><span className={`incident-bar-${key}`} style={{ width: `${count / 8300 * 100}%` }} /></div></div>)}</figure>)}</div>
            <p className="incident-caption">{t('相同线性尺度，最大 8,300。数据来自处置时保存的记录，均为请求／规则动作。窗口、流量构成不同，不能计算“防护降低了多少”；Challenged 也不等于成功阻断。', 'Same linear scale, maximum 8,300. These request/action counts come from incident notes. Different windows and traffic composition prevent a causal “reduction” claim. Challenged does not mean successfully blocked.')}</p>
          </section>

          <section id="timeline" className="incident-section">
            <div className="incident-section-heading"><span>04 / {t('行动', 'THE RESPONSE')}</span><h2>{t('暂停、验证，然后再打开。', 'Pause, verify, then reopen.')}</h2><p>{t('以下时间统一为 PDT（UTC−7）。这是处置记录，不是连续流量曲线。', 'All times below are PDT (UTC−7). This is a response history, not a continuous traffic series.')}</p></div>
            <ol className="incident-timeline">{TIMELINE.map((event, index) => <li key={`${event.date}-${event.time}`}><div className="incident-timeline-date"><strong>{event.date}</strong><span>{event.time}</span></div><div className="incident-timeline-node">{index === TIMELINE.length - 1 ? <Check size={13} /> : <span />}</div><div className="incident-timeline-copy"><h3>{tr(event)}</h3><p>{tr(event.detail)}</p></div></li>)}</ol>
          </section>

          <section id="defense" className="incident-section">
            <div className="incident-section-heading"><span>05 / {t('设计', 'THE DESIGN')}</span><h2>{t('两条线路，需要两套守门机制。', 'Two delivery routes need their own protection.')}</h2></div>
            <p className="incident-prose">{t('网站由 Vercel 和阿里云自有服务器分线路服务，独立 API 又有自己的入口。Vercel 的规则不会自动保护自有服务器；服务器日志也看不到只经过 Vercel 的请求。防护和监控都必须标清覆盖范围。', 'The website uses both Vercel and a self-hosted Alibaba Cloud server, with a separate API entrance. Vercel rules do not automatically protect the server, and server logs do not see Vercel-only requests. Both protection and monitoring need explicit coverage.')}</p>
            <figure className="incident-routing">
              <div className="incident-routing-origin"><Globe2 size={22} /><strong>{t('访问 cuberoot.me', 'Visit cuberoot.me')}</strong><span>{t('DNS 分线路', 'DNS routes traffic')}</span></div>
              <div className="incident-route-lanes">
                <div className="incident-lane" data-site-surface="panel"><div className="incident-lane-title"><ShieldCheck size={22} /><h3>Vercel</h3></div><div className="incident-route-node">{t('平台 DDoS 缓解 + WAF', 'Platform DDoS mitigation + WAF')}</div><ArrowDown size={18} /><div className="incident-route-node">{t('挑战 / 拒绝 / 单 IP 限流', 'Challenge / deny / per-IP limits')}</div><ArrowDown size={18} /><div className="incident-route-node">{t('生产页面', 'Production pages')}</div><p>{t('Firewall 观测 · 独立费用预算暂停', 'Firewall observations · separate spend pause')}</p></div>
                <div className="incident-lane" data-site-surface="panel"><div className="incident-lane-title"><Server size={22} /><h3>{t('阿里云自有服务器', 'Self-hosted server')}</h3></div><div className="incident-route-node">{t('nginx：主站 / next / API', 'nginx: main / next / API')}</div><ArrowDown size={18} /><div className="incident-route-node">{t('单 IP + 总量 + 并发限制', 'Per-IP + aggregate + concurrency limits')}</div><ArrowDown size={18} /><div className="incident-route-node">{t('Next.js / 独立 Hono API', 'Next.js / independent Hono API')}</div><p>{t('本地日志 → 分钟检查 → 维护 / 503', 'Local logs → minute checks → maintenance / 503')}</p></div>
              </div><figcaption>{t('覆盖示意：API 也可直接访问；上图省略 static 与开发预览等独立入口，不能把两条主站线路当作完整网络拓扑。', 'Coverage illustration: the API can also be accessed directly. Static assets and development previews are omitted; these two routes are not the complete network topology.')}</figcaption>
            </figure>
            <figure className="incident-evidence"><a href={`${ASSETS}vercel-firewall-rules-sep25-v1.png`} target="_blank" rel="noreferrer" aria-label={t('打开 Vercel 防护规则原图', 'Open the original Vercel firewall rules screenshot')}><Image src={`${ASSETS}vercel-firewall-rules-sep25-v1.png`} alt={t('Vercel 规则截图：计算器拒绝、计算器和比赛 API 限流、详情页验证、Bot Protection Challenge、AI Bots Deny', 'Vercel rules: calculator deny, calculator and competition API rate limits, detail-page challenge, Bot Protection Challenge, and AI Bots Deny')} width={1088} height={730} loading="lazy" unoptimized /></a><figcaption><span>E3</span><div>{t('2026-09-25 09:38 UTC 的真实规则状态截图。已避开账户与来源 IP；配置启用不等于已经证明拦截效果，之后状态可能变化。', 'Actual rule configuration at September 25, 09:38 UTC. Account details and source IPs are outside the capture. Enabled configuration does not establish effectiveness, and can change later.')}</div></figcaption></figure>

            <div className="incident-guard" data-site-surface="panel"><div className="incident-guard-title"><Activity size={24} /><div><p className="incident-eyebrow">{t('服务器自动守护', 'LOCAL AUTOMATIC GUARD')}</p><h3>{t('每分钟看一次，超阈值就停。', 'Check each minute. Stop at emergency thresholds.')}</h3></div></div><ol className="incident-guard-steps">{[
              [t('读日志', 'Read'), t('最近两个完整分钟', 'Last two complete minutes')],
              [t('作判断', 'Evaluate'), t('极高单分钟 / 持续两分钟', 'Extreme minute / sustained pair')],
              [t('切维护', 'Switch'), t('主站、next 与 API', 'Main site, next and API')],
              [t('通知人', 'Notify'), t('尝试推送，人工决定恢复', 'Attempt alert; reopen manually')],
            ].map(([title, detail], index) => <li key={title}><span>0{index + 1}</span><strong>{title}</strong><p>{detail}</p></li>)}</ol><p className="incident-guard-boundary">{t('明确边界：本地自动停站看不到 Vercel-only 请求；按分钟检查也不等于瞬时响应。定时器已实跑，生产超阈值停站与通知送达仍待专门演练。', 'Coverage boundary: this local stop cannot see Vercel-only requests, and minute checks are not instantaneous. The timer has run; a production threshold trip and alert delivery still need a dedicated drill.')}</p></div>

            <div className="incident-details">
              <details><summary>{t('给开发者：哪些改动真正减少负担？', 'For developers: what reduces the work?')}</summary><div><p>{t('为比赛代理拒绝未知、重复或畸形参数；让缓存键只保留有效参数与版本号；复用缓存及相同回源合并；限制单来源之外的总量与并发；公开 next 别名复用限制，避免换入口绕过。robots 只约束合作爬虫。', 'Reject unknown, repeated or malformed competition-proxy parameters; keep effective parameters and version in cache keys; reuse caching and request coalescing; limit aggregate work and concurrency; protect the public next alias too. Robots directives only guide cooperative crawlers.')}</p><p>{t('初始阈值来自短期观测，需要调整。代码扫描每份日志尾部最多 32 MiB，本地机器故障也会影响守护；目前不应宣称覆盖所有异常。', 'Initial thresholds came from short observations and need tuning. The guard reads at most 32 MiB from each log tail, and local machine failures affect it too. It cannot claim to catch every anomaly.')}</p><a href={`${REPO}core/scripts/traffic-guard.ts`} target="_blank" rel="noreferrer">{t('阅读守护程序源码', 'Read the guard source')} ↗</a></div></details>
              <details><summary>{t('验证码能挡住所有机器人吗？', 'Can a challenge stop every bot?')}</summary><div><p>{t('不能。挑战增加自动化访问的成本，也会打扰正常读者。Vercel Attack Mode 会放行其已验证的部分机器人；访问成本仍要靠缓存、接口限额和总量保护控制。不能把 Challenged 计数当作成功拦截人数。', 'No. Challenges raise the cost of automation but also add friction for readers. Vercel Attack Mode allows recognized verified bots; caching, API limits and aggregate protection must still control cost. A Challenged counter is not a count of people successfully blocked.')}</p><a href="https://vercel.com/docs/vercel-firewall/attack-mode" target="_blank" rel="noreferrer">{t('Vercel 官方说明', 'Vercel documentation')} ↗</a></div></details>
              <details><summary>{t('免费自动监控，究竟免费在哪？', 'What does free automatic monitoring mean here?')}</summary><div><p>{t('复用已有服务器、日志、定时器与通知渠道，没有购买新监控服务。原服务器、固定套餐和放行请求的消耗仍然存在。Vercel 的额外用量预算暂停有检查延迟，也不能保证每一笔费用精确封顶。', 'It reuses the existing server, logs, timer and alert channel without buying a monitoring product. Server costs, subscriptions and allowed-request usage still exist. Vercel spend checks have delay and do not provide an exact hard cap on every charge.')}</p><a href="https://vercel.com/docs/spend-management" target="_blank" rel="noreferrer">{t('费用保护的官方边界', 'Spend-management limits')} ↗</a></div></details>
              <details><summary>{t('bingbot/2.0 和其他网站给了什么启发？', 'What about bingbot/2.0 and other websites?')}</summary><div><p>{t('bingbot/2.0 是 User-Agent 中的身份声明；字符串可以伪造，要用 Bing 官方工具或 DNS 验证。真实爬虫也可能产生很大负担，应按访问行为与资源成本控制。', 'bingbot/2.0 is a User-Agent identity claim and can be forged. Verify it using Bing’s tools or DNS. Authentic crawlers can still create substantial load, so control behavior and resource cost.')}</p><p>{t('本次对照研究中，WCA 公开源码展示了 robots、API 限流和缓存，数据文档提供批量导出。cubing.com 的线上响应与旧公开仓库技术栈不同；公开源码不足以证明它当前用了什么验证码或 WAF 阈值。', 'Our comparison found robots rules, API throttling and caching in WCA’s public code, plus bulk exports in its data documentation. cubing.com’s live responses differed from its older public stack; public code does not establish its current challenge or WAF settings.')}</p><a href="https://www.bing.com/webmasters/help/how-to-verify-bingbot-3905dc26" target="_blank" rel="noreferrer">{t('验证 Bingbot', 'Verify Bingbot')} ↗</a><a href={`${REPO}docs/traffic-defense.md`} target="_blank" rel="noreferrer">{t('对照研究与来源', 'Comparison notes and sources')} ↗</a></div></details>
            </div>
          </section>

          <section id="lessons" className="incident-section">
            <div className="incident-section-heading"><span>06 / {t('复盘', 'THE LESSONS')}</span><h2>{t('把不确定的事，也写进日志。', 'Keep the uncertainties in the record.')}</h2></div>
            <div className="incident-lessons">{[
              [t('密集，不等于恶意', 'Dense does not establish malice'), t('先核对路径、预取、来源与错误，再判断。浏览器声明、IP 国家和指纹都不能单独证明身份或动机。', 'Check paths, prefetching, sources and errors. Browser claims, IP countries and fingerprints alone do not prove identity or intent.')],
              [t('发布完成，还要验证生效', 'Verify behavior after deployment'), t('nginx 旧 worker、Vercel 被暂停阻止的构建，都提醒我们：绿色 CI、已写入配置与真实线上行为要分别验收。', 'Old nginx workers and builds blocked by a paused Vercel project showed why green CI, stored configuration and live behavior need separate verification.')],
              [t('保护，也有可用性的代价', 'Protection affects availability'), t('正常访问会遇到挑战和停站，真实热门流量也可能触发阈值。应观察误拦截，再逐步调整限制。', 'Real readers face challenges and downtime; legitimate popularity can also cross thresholds. Observe false positives and refine the controls.')],
            ].map(([title, body], index) => <div key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{body}</p></div>)}</div>
            <div className="incident-open-items" data-site-surface="panel"><h3>{t('后续工作，仍然打开着', 'Work that remains open')}</h3><ul><li>{t('复核正常用户长窗口、挑战通过率和阈值误伤。', 'Review longer windows, challenge completion and false positives.')}</li><li>{t('补足 Vercel 独立线路的自动观测与止损，同时遵守不新增收费项的约束。', 'Close the Vercel telemetry and automatic-stop gap without adding paid services.')}</li><li>{t('专门演练超阈值后的实际停站、告警送达与恢复。', 'Run a dedicated drill for the threshold trip, actual maintenance response, alert delivery and recovery.')}</li><li>{t('继续审计开发预览入口和其他高成本接口，降低计算器自动取数的负担。', 'Audit development previews and other costly endpoints, and reduce automatic calculator data fetching.')}</li></ul></div>
          </section>

          <footer className="incident-sources"><p className="incident-eyebrow">{t('证据与维护记录', 'EVIDENCE & MAINTENANCE')}</p><h2>{t('这篇日志可以继续被核对。', 'A record you can inspect.')}</h2><p>{t('图表只使用标明窗口的历史数据。矢量示意图由手工绘制；Vercel 截图来自真实控制台，未用生成图替代证据。完整来源、部署记录与恢复步骤保存在仓库。', 'Charts use historical data with explicit windows. Diagrams are hand-drawn vectors; Vercel screenshots are actual dashboard captures. Sources, release evidence and recovery steps live in the repository.')}</p><div className="incident-source-links">{[
            ['docs/traffic-incident-2026-09-22-25.md', t('本次事件完整 MD', 'Full incident Markdown')], ['docs/traffic-incident-2026-09-22.md', t('最初调查', 'Initial investigation')], ['docs/traffic-defense.md', t('处置与发布记录', 'Mitigation and releases')], ['docs/traffic-monitor.md', t('监控与恢复手册', 'Monitoring and recovery')],
          ].map(([path, label]) => <a key={path} href={`${REPO}${path}`} target="_blank" rel="noreferrer"><FileText size={16} />{label}<ArrowUpRight size={15} /></a>)}</div><p className="incident-colophon">CubeRoot · {t('2026 年 9 月事件档案 · 首版', 'September 2026 incident archive · first edition')}</p></footer>
        </article>
      </div>
    </main>
  );
}
