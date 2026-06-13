'use client';

// Shared shell for every WCA Regulations chapter page (/regulation/<slug>).
// Provides: breadcrumb back to the hub, the chapter hero (badge + title +
// tagline from the registry), the chapter body (children), prev/next chapter
// navigation, and the shared source-credit footer.
//
// A chapter page is therefore just:
//   <RegArticleLayout slug="scrambling"> ...sections... </RegArticleLayout>

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, LibraryBig } from 'lucide-react';
import Link from '@/components/AppLink';
import { useT } from '../../../../hooks/useT';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { articleBySlug, regNav, type RegArticle } from '../_data/articles';
import { useRegText } from './reg-text';
import '../regulation.css';

const WCA_REG_FULL = 'https://www.worldcubeassociation.org/regulations/full/';
const WCA_REG_ZH = 'https://www.worldcubeassociation.org/regulations/translations/chinese/';

function PrevNextCard({ a, dir }: { a: RegArticle; dir: 'prev' | 'next' }) {
  const t = useT();
  const { badge, title } = useRegText();
  return (
    <Link href={`/regulation/${a.slug}`} className={`reg-pn reg-pn-${dir}`}>
      <span className="reg-pn-dir">
        {dir === 'prev' ? <ArrowLeft size={15} /> : null}
        {t(dir === 'prev' ? '上一章' : '下一章', dir === 'prev' ? 'Previous' : 'Next')}
        {dir === 'next' ? <ArrowRight size={15} /> : null}
      </span>
      <span className="reg-pn-label">{badge(a)}</span>
      <span className="reg-pn-title">{title(a)}</span>
    </Link>
  );
}

export default function RegArticleLayout({ slug, children }: { slug: string; children: ReactNode }) {
  useTranslation(); // subscribe to language toggle so tr()/t() re-evaluate
  const t = useT();
  const { badge, title, tagline } = useRegText();
  const a = articleBySlug(slug);
  const { prev, next } = regNav(slug);

  // Hooks must run unconditionally — compute title strings with a fallback.
  useDocumentTitle(
    a ? `${a.title.zh} · WCA 规则` : 'WCA 规则',
    a ? `${a.title.en} · WCA Regulations` : 'WCA Regulations',
  );

  if (!a) return null;
  const Icon = a.Icon;

  return (
    <div className="reg-page reg-article">
      <div className="reg-wrap">
        <div className="reg-crumb">
          <Link href="/regulation" className="reg-crumb-link">
            <ArrowLeft size={15} />
            {t('全部规则', 'All regulations', "全部規則")}
          </Link>
        </div>

        <header className="reg-hero reg-article-hero">
          <div className="reg-eyebrow">
            <Icon size={18} />
            {badge(a)}
          </div>
          <h1 className="reg-title">{title(a)}</h1>
          <p className="reg-subtitle">{tagline(a)}</p>
        </header>

        {children}

        {/* Prev / next chapter */}
        <nav className="reg-prevnext" aria-label={t('章节导航', 'Chapter navigation', "章節導航")}>
          {prev ? <PrevNextCard a={prev} dir="prev" /> : <span className="reg-pn reg-pn-empty" />}
          {next ? <PrevNextCard a={next} dir="next" /> : <span className="reg-pn reg-pn-empty" />}
        </nav>

        {/* Source credit */}
        <footer className="reg-footer">
          <p>
            {t(
              '本页是对 WCA 官方《竞赛规则与指南》对应章节的图文介绍与翻译,内容为本站整理,仅供学习参考;一切判定以官方现行版本为准。',
              'This page is an illustrated guide to and translation of the corresponding chapter of the official WCA Regulations & Guidelines, compiled by this site for educational reference only. Judging always follows the current official version.', "本頁是對 WCA 官方《競賽規則與指南》對應章節的圖文介紹與翻譯,內容為本站整理,僅供學習參考;一切判定以官方現行版本為準。"
            )}
          </p>
          <p style={{ marginTop: 12 }}>
            <Link href="/regulation">{t('← 返回规则总览', '← Back to overview', "← 返回規則總覽")}</Link>
            {' · '}
            <a href={WCA_REG_FULL} target="_blank" rel="noopener noreferrer">{t('官方规则全文', 'Official Regulations (full)', "官方規則全文")}</a>
            {' · '}
            <a href={WCA_REG_ZH} target="_blank" rel="noopener noreferrer">{t('官方中文翻译', 'Official Chinese translation', "官方中文翻譯")}</a>
          </p>
        </footer>

        {/* Floating jump-to-overview on long chapters */}
        <Link href="/regulation" className="reg-fab" aria-label={t('返回规则总览', 'Back to overview', "返回規則總覽")}>
          <LibraryBig size={20} />
        </Link>
      </div>
    </div>
  );
}
