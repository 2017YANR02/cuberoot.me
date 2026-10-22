'use client';

import { ChevronLeft, ArrowRight, ScrollText } from '@app-foundation/icons/lucide';
import Link from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { CORE_ARTICLES, EVENT_ARTICLES, regArticleHref, type RegArticle } from '../_data/articles';
import { useRegText } from '../_components/reg-text';
import '../regulation.css';

function ChapterCard({ a }: { a: RegArticle }) {
  const { badge, title, tagline } = useRegText();
  const Icon = a.Icon;
  return (
    <Link href={regArticleHref(a)} className="reg-hub-card">
      <span className="reg-hub-card-icon"><Icon size={26} /></span>
      <span className="reg-hub-card-badge">{badge(a)}</span>
      <span className="reg-hub-card-title">{title(a)}</span>
      <span className="reg-hub-card-tag">{tagline(a)}</span>
    </Link>
  );
}

export default function RegulationDirectory() {
  const t = useT();
  return (
    <div className="reg-page">
      <div className="reg-wrap">
        <Link href="/regulation" className="back-home" aria-label={t('返回规则首页', 'Back to overview')}>
          <ChevronLeft size={16} aria-hidden="true" />
        </Link>
        <header className="reg-hero">
          <h1 className="reg-title">WCA <span className="reg-code">{t('规则', 'Regulations')}</span></h1>
        </header>
        <Link href="/regulation/full" className="reg-hub-news">
          <span className="reg-hub-news-icon"><ScrollText size={22} /></span>
          <span className="reg-hub-news-body"><span className="reg-hub-news-title">{t('官方条文', 'Official text')}</span></span>
          <ArrowRight size={20} className="reg-hub-news-arrow" />
        </Link>
        <section className="reg-hub-group">
          <h2 className="reg-hub-group-title">{t('核心条款', 'Core articles')}</h2>
          <div className="reg-hub-grid">
            {CORE_ARTICLES.map((a) => <ChapterCard key={a.slug} a={a} />)}
          </div>
        </section>

        <section className="reg-hub-group">
          <h2 className="reg-hub-group-title">{t('项目附则', 'Event-specific articles')}</h2>
          <div className="reg-hub-grid">
            {EVENT_ARTICLES.map((a) => <ChapterCard key={a.slug} a={a} />)}
          </div>
        </section>

      </div>
    </div>
  );
}
