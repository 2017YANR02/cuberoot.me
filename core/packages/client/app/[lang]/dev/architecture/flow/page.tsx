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
          <h1 className="arch-subhero-title">
            <L zh="从点击到 DOM 更新" en="From click to DOM" />
          </h1>
        </header>

        {/* Section: Page load flow */}
        <section className="arch-sec">
          <div className="arch-sec-head">
            <h2 className="arch-sec-title"><L zh="网页加载全流程" en="Full page-load flow" /></h2>
          </div>
          <PageLoadFlow />
        </section>

        {/* 03 Request lifecycle */}
        <section className="arch-sec">
          <div className="arch-sec-head">
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
            <h2 className="arch-sec-title"><L zh="请求路径" en="Request paths" /></h2>
          </div>
          <div className="arch-diagram tracer-frame">
            <RequestTracer />
          </div>
        </section>

        <footer className="arch-foot">
          <div className="arch-foot-line">
            <Link href="/dev/architecture"><L zh="概览" en="Overview" /></Link>
            <span className="arch-meta-sep">/</span>
            <Link href="/dev/architecture#decisions"><L zh="技术决策" en="Decisions" /></Link>
            <span className="arch-meta-sep">/</span>
            <Link href="/dev/architecture/log"><L zh="日志" en="Log" /></Link>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
