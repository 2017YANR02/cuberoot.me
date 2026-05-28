'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { LangCtx, L } from '../../_lib/Lang';
import type { Lang } from '../../_lib/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import ArchNav from '../_components/ArchNav';
import HistoryView from '../_components/HistoryView';
import { TIMELINE } from '../_lib/arch-data';
import '../architecture.css';

export default function ArchHistoryPage() {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language.startsWith('zh') ? 'zh' : 'en';

  useDocumentTitle('历程', 'History');

  return (
    <LangCtx.Provider value={lang}>
      <div className="arch-page">
        <ArchNav />

        <header className="arch-subhero">
          <div className="arch-subhero-num">
            <L zh="架构 · 历程" en="Architecture · History" />
          </div>
          <h1 className="arch-subhero-title">
            <L zh="近一年的关键改动" en="The past year's key changes" />
          </h1>
          <p className="arch-subhero-lede">
            <L
              zh={<>项目 2025-12-13 诞生 (一个空的 index.html), 到现在 5 个月、2300+ 提交。列表视图只挑 <strong>{TIMELINE.length} 件</strong>重大改动讲清楚因果; 日历视图把每天的"非琐碎"提交全列出来, 看哪些天密集打代码。</>}
              en={<>The project was born 2025-12-13 — a single empty index.html. Five months and 2300+ commits later: the list view covers <strong>{TIMELINE.length} major changes</strong>; the calendar view shows every non-trivial commit by date so you can see which days were heads-down coding.</>}
            />
          </p>
        </header>

        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">11</span>
            <h2 className="arch-sec-title"><L zh="时间线" en="Timeline" /></h2>
          </div>
          <HistoryView />
        </section>

        <footer className="arch-foot">
          <div className="arch-foot-line">
            <Link href="/code/architecture"><L zh="概览" en="Overview" /></Link>
            <span className="arch-meta-sep">·</span>
            <Link href="/code/architecture/flow"><L zh="请求流程" en="Flow" /></Link>
            <span className="arch-meta-sep">·</span>
            <Link href="/code/architecture/decisions"><L zh="技术决策" en="Decisions" /></Link>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
