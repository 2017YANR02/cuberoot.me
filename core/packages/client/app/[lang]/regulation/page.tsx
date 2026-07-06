'use client';

// /regulation — overview hub for the WCA Regulations. Hero + a card grid of all
// chapters (core articles + event-specific appendices). Each card links to its
// own chapter page at /regulation/<slug>. Chapter content lives in
// <slug>/page.tsx; shared scaffolding is in _components/ and _data/.

import { useTranslation } from 'react-i18next';
import { Newspaper, ArrowRight, ScrollText } from 'lucide-react';
import Link from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import { useT } from '../../../hooks/useT';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { CORE_ARTICLES, EVENT_ARTICLES, type RegArticle } from './_data/articles';
import { useRegText } from './_components/reg-text';
import './regulation.css';

function ChapterCard({ a }: { a: RegArticle }) {
  const { badge, title, tagline } = useRegText();
  const Icon = a.Icon;
  return (
    <Link href={`/regulation/${a.slug}`} className="reg-hub-card">
      <span className="reg-hub-card-icon"><Icon size={26} /></span>
      <span className="reg-hub-card-badge">{badge(a)}</span>
      <span className="reg-hub-card-title">{title(a)}</span>
      <span className="reg-hub-card-tag">{tagline(a)}</span>
    </Link>
  );
}

export default function RegulationHub() {
  useTranslation();
  const t = useT();
  useDocumentTitle('WCA 竞赛规则 · 图解', 'WCA Regulations · Illustrated');

  return (
    <div className="reg-page">
      <div className="reg-wrap">
        <BackHome />
        <header className="reg-hero">
          <div className="reg-eyebrow">
            <img src="/icons/wca.svg" alt="WCA" />
            {t('WCA 竞赛规则 · 图解', 'WCA Regulations · Illustrated')}
          </div>
          <h1 className="reg-title">
            {t('WCA ', 'WCA ')}
            <span className="reg-code">{t('竞赛规则', 'Regulations')}</span>
          </h1>
          <p className="reg-subtitle">
            {t(
              '官方规则的逐章图解 —— 把每条规定配上图、动画和案例,让人和裁判都能一眼看懂',
              'The official regulations, chapter by chapter — every rule paired with diagrams, animations and real cases'
            )}
          </p>
          <p className="reg-lede">
            {t(
              '这里覆盖 WCA《竞赛规则》的全部 10 个核心章节与 6 个项目专属附则。转动表示法用 3D 动画逐步演示;打乱、判定、魔方故障用图示和真实案例讲透。选一章开始,或用顶部链接对照官方原文。',
              'This covers all 10 core articles of the WCA Regulations plus the 6 event-specific articles (A–I). Notation is shown move by move in 3D; scrambling, judging and puzzle defects are made concrete with diagrams and real cases. Pick a chapter to start, or cross-check the official text via the links above.'
            )}
          </p>
        </header>

        <Link href="/regulation/news" className="reg-hub-news">
          <span className="reg-hub-news-icon"><Newspaper size={22} /></span>
          <span className="reg-hub-news-body">
            <span className="reg-hub-news-eyebrow">
              <span className="reg-hub-news-dot" />
              {t('最新动态', "What’s New")}
            </span>
            <span className="reg-hub-news-title">
              {t(
                'FTO 成为新项目、魔表退役,安静锦标赛与资格起始日期',
                'FTO added & Clock retired · Quiet Championships & qualification start dates',
              )}
            </span>
            <span className="reg-hub-news-sub">
              {t(
                'WCA 官方对项目列表与竞赛要求政策的近期调整(2026 年 5–6 月)',
                'Recent WCA changes to the events list and Competition Requirements Policy (May–Jun 2026)',
              )}
            </span>
          </span>
          <ArrowRight size={20} className="reg-hub-news-arrow" />
        </Link>

        <Link href="/regulation/full" className="reg-hub-news">
          <span className="reg-hub-news-icon"><ScrollText size={22} /></span>
          <span className="reg-hub-news-body">
            <span className="reg-hub-news-title">
              {t('规则全文 · 中英对照', 'Full regulations text')}
            </span>
            <span className="reg-hub-news-sub">
              {t(
                'WCA《竞赛规则》官方全文的本站镜像 —— 762 条逐条可锚点,交叉引用就近跳转,不必跳出到官网',
                'A verbatim mirror of the complete WCA Regulations — every clause anchored, every cross-reference resolved in-page',
              )}
            </span>
          </span>
          <ArrowRight size={20} className="reg-hub-news-arrow" />
        </Link>

        <section className="reg-hub-group">
          <h2 className="reg-hub-group-title">{t('核心条款', 'Core articles')}</h2>
          <div className="reg-hub-grid">
            {CORE_ARTICLES.map((a) => <ChapterCard key={a.slug} a={a} />)}
          </div>
        </section>

        <section className="reg-hub-group">
          <h2 className="reg-hub-group-title">{t('项目专属规程', 'Event-specific articles')}</h2>
          <div className="reg-hub-grid">
            {EVENT_ARTICLES.map((a) => <ChapterCard key={a.slug} a={a} />)}
          </div>
        </section>

        <footer className="reg-footer">
          <p>
            <Link href="/regulation/full">{t('本站规则全文', 'Full text on this site')}</Link>
          </p>
          <p style={{ marginTop: 12 }}>
            {t(
              '本站内容整理自 WCA 官方《竞赛规则与指南》,为图文介绍与翻译,仅供学习参考;一切判定以官方现行版本为准。',
              'Compiled from the official WCA Regulations & Guidelines as an illustrated guide and translation, for educational reference only. Judging always follows the current official version.'
            )}
          </p>
        </footer>
      </div>
    </div>
  );
}
