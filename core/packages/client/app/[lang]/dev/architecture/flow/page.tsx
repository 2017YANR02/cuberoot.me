'use client';

import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { LangCtx, L } from '../../_lib/Lang';
import type { Lang } from '../../_lib/Lang';
import ArchNav from '../_components/ArchNav';
import { RequestLifecycleSVG, StatsPipelineSVG } from '../_components/ArchSvgs';
import RequestTracer from '../_components/RequestTracer';
import PageLoadFlow from '../_components/PageLoadFlow';
import '../architecture.css';

export default function ArchFlowPage() {
  const { i18n } = useTranslation();
  const lang: Lang = (['en', 'zh'] as const)[Number(i18n.language.startsWith('zh'))];

  return (
    <LangCtx.Provider value={lang}>
      <div className="arch-page">
        <ArchNav />

        <header className="arch-subhero">
          <div className="arch-subhero-num">
            <L zh="架构 / 请求流程" en="Architecture / Request Flow" />
          </div>
          <h1 className="arch-subhero-title">
            <L zh="从点击到 DOM 更新" en="From click to DOM" />
          </h1>
          <p className="arch-subhero-lede">
            <L
              zh={<>一次请求在交付入口、Web 前端、Hono 和 PostgreSQL 之间经历了什么，以及缓存命中后会在哪一层提前返回。</>}
              en={<>What a request goes through across delivery, the web frontend, Hono, and PostgreSQL, including where a cache hit can return early.</>}
            />
          </p>
        </header>

        {/* Section: Page load flow */}
        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">→</span>
            <h2 className="arch-sec-title"><L zh="网页加载全流程" en="Full page-load flow" /></h2>
          </div>
          <p className="arch-sec-lede">
            <L
              zh={<>从浏览器输入 URL 到页面可交互，交付路径可以不同，但最终都会进入同一套页面和数据契约。</>}
              en={<>From URL input to an interactive page, delivery paths can differ while converging on the same page and data contracts.</>}
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
              zh={<>典型读请求从事件处理开始，经过统一 API 入口、缓存、Hono 和数据库，再把 JSON 更新到页面。缓存命中时会提前返回。</>}
              en={<>A typical read starts in an event handler, crosses the shared API entry, cache, Hono, and the database, then updates the page from JSON. A cache hit returns earlier.</>}
            />
          </p>
          <div className="arch-diagram">
            <RequestLifecycleSVG />
          </div>
          <pre className="arch-code">{`Browser
  → delivery entry
  → Next App Router
  → server-rendered HTML
  → React hydration
  → apiUrl('/v1/...')
  → HTTP cache
  → Hono route
  → PostgreSQL
  → JSON → state → DOM`}</pre>
        </section>

        {/* 05 WCA stats pipeline */}
        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">05</span>
            <h2 className="arch-sec-title"><L zh="WCA 统计:独立数据管道" en="WCA stats: a separate data pipeline" /></h2>
          </div>
          <p className="arch-sec-lede">
            <L
              zh={<>统计任务在在线请求之外处理 WCA 公开数据，生成 JSON 和 TSV，再发布到 PostgreSQL 与静态数据入口。Web 和 API 只读取产物。</>}
              en={<>Statistics jobs process the public WCA data outside request handling, generate JSON and TSV artifacts, and publish them to PostgreSQL and the static data origin. The web and API only consume those outputs.</>}
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
              zh={<>不同 URL 不一定走完整路径。选择下面的请求类型，可以看到它会经过哪些层，以及在哪一层提前返回。</>}
              en={<>Different URLs do not always follow the full path. Choose a request type below to see which layers it crosses and where it can return early.</>}
            />
          </p>
          <div className="arch-diagram tracer-frame">
            <RequestTracer />
          </div>
        </section>

        <footer className="arch-foot">
          <div className="arch-foot-line">
            <Link href="/dev/architecture"><L zh="概览" en="Overview" /></Link>
            <span className="arch-meta-sep">/</span>
            <Link href="/dev/architecture/decisions"><L zh="技术决策" en="Decisions" /></Link>
            <span className="arch-meta-sep">/</span>
            <Link href="/dev/architecture/history"><L zh="历程" en="History" /></Link>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
