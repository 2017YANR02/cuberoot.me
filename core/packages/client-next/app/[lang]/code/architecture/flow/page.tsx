'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { LangCtx, L } from '../../_lib/Lang';
import type { Lang } from '../../_lib/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import ArchNav from '../_components/ArchNav';
import { RequestLifecycleSVG, StatsPipelineSVG } from '../_components/ArchSvgs';
import RequestTracer from '../_components/RequestTracer';
import PageLoadFlow from '../_components/PageLoadFlow';
import '../architecture.css';

export default function ArchFlowPage() {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language.startsWith('zh') ? 'zh' : 'en';

  useDocumentTitle('请求流程', 'Request Flow');

  return (
    <LangCtx.Provider value={lang}>
      <div className="arch-page">
        <ArchNav />

        <header className="arch-subhero">
          <div className="arch-subhero-num">
            <L zh="架构 · 请求流程" en="Architecture · Request Flow" />
          </div>
          <h1 className="arch-subhero-title">
            <L zh="从点击到 DOM 更新" en="From click to DOM" />
          </h1>
          <p className="arch-subhero-lede">
            <L
              zh={<>一次请求在 nginx、Next.js、Hono、PostgreSQL 之间经历了什么 — 时序、缓存命中路径、以及用户加载整页的完整旅程。</>}
              en={<>What a request goes through between nginx, Next.js, Hono, and PostgreSQL — timings, cache-hit paths, and the full page-load journey from the user's perspective.</>}
            />
          </p>
        </header>

        {/* Section: Page load flow (NEW) */}
        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">→</span>
            <h2 className="arch-sec-title"><L zh="网页加载全流程" en="Full page-load flow" /></h2>
          </div>
          <p className="arch-sec-lede">
            <L
              zh={<>从浏览器输入 URL 到页面可交互, DNS 分线路后走两条不同路径。方案 A 是并排对比, 方案 B 是带时序的泳道图。</>}
              en={<>From URL input to interactive page — after the DNS split, two distinct paths. Option A shows the fork side-by-side; Option B lays events on a timing swimlane.</>}
            />
          </p>
          <PageLoadFlow />
        </section>

        {/* 03 Request lifecycle */}
        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">03</span>
            <h2 className="arch-sec-title"><L zh="一次点击到 DOM 更新" en="From click to DOM" /></h2>
          </div>
          <p className="arch-sec-lede">
            <L
              zh={<>典型的读请求 (比如打开 /recon/abc), 端到端在 50ms 以内。nginx <code>proxy_cache</code> 命中时降到 10ms 以下。这里把每一跳的时间标出来。</>}
              en={<>A typical read (say, opening /recon/abc) runs end-to-end in under 50ms. With an nginx <code>proxy_cache</code> hit it drops below 10ms. Each hop's latency is plotted below.</>}
            />
          </p>
          <div className="arch-diagram">
            <RequestLifecycleSVG />
          </div>
          <pre className="arch-code">{`Browser
  │  GET cuberoot.me/recon/abc
  ▼
nginx :443    →  proxy_pass :3002  (一条线路:systemd Next standalone)
  │            ↘  Vercel edge      (另一条线路:同份 Next 代码)
  ▼
Next App Router  →  SSR shell stream → 客户端 hydrate
  │
  ▼
client  →  fetch(apiUrl('/v1/recon/abc'))
                          │
                          ▼
                nginx :443 (api.cuberoot.me)
                  │  proxy_cache /v1/wca/* (24h)
                  ▼
                Hono :3001    →  pg pool  →  PostgreSQL :5432
                  │
                  ▼
                JSON  →  React state  →  DOM`}</pre>
        </section>

        {/* 05 WCA stats pipeline */}
        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">05</span>
            <h2 className="arch-sec-title"><L zh="WCA 统计:一条独立的周更管道" en="WCA stats: a separate weekly pipeline" /></h2>
          </div>
          <p className="arch-sec-lede">
            <L
              zh={<>统计数据跟主站完全解耦。GitHub Actions 每周从 WCA 公开 dump 拉数据, 在 runner 上跑 80+ 个 SQL-driven 统计, 产出 JSON + TSV, scp 到云服务器, <code>\copy</code> 进 PG, Hono 读出来, nginx 再缓存 24 小时。</>}
              en={<>Stats data is fully decoupled from the main site. GitHub Actions pulls the WCA public dump weekly, runs 80+ SQL-driven statistics on the runner, produces JSON + TSVs, scp's them to the VM, <code>\copy</code>s them into PG, Hono reads them out, and nginx caches 24h on top.</>}
            />
          </p>
          <div className="arch-diagram">
            <StatsPipelineSVG />
          </div>
        </section>

        {/* 09 Request tracer */}
        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">09</span>
            <h2 className="arch-sec-title"><L zh="一次请求穿越几层:点 tab 看高亮" en="A request walks the stack: click a tab to highlight" /></h2>
          </div>
          <p className="arch-sec-lede">
            <L
              zh={<>第 03 节给了"理想读请求"的时间轴, 但实际不是所有 URL 都走全程。点下面 4 个 tab, 看每种请求各点亮哪些层 — 有的连 Next 都不启动, 有的在 nginx 那层就 hit cache 返回, 有的整条管道穿透。</>}
              en={<>Section 03 sketches the "ideal read" timeline, but real URLs don't all walk the full path. Click the four tabs below to see which stages each pattern lights up — some never boot Next, some hit cache at nginx, some pierce all the way through.</>}
            />
          </p>
          <div className="arch-diagram tracer-frame">
            <RequestTracer />
          </div>
        </section>

        <footer className="arch-foot">
          <div className="arch-foot-line">
            <Link href="/code/architecture"><L zh="概览" en="Overview" /></Link>
            <span className="arch-meta-sep">·</span>
            <Link href="/code/architecture/decisions"><L zh="技术决策" en="Decisions" /></Link>
            <span className="arch-meta-sep">·</span>
            <Link href="/code/architecture/history"><L zh="历程" en="History" /></Link>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
