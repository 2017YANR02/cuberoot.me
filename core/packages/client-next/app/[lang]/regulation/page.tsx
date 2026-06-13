'use client';

// /regulation — overview hub for the WCA Regulations. Hero + a card grid of all
// chapters (core articles + event-specific appendices). Each card links to its
// own chapter page at /regulation/<slug>. Chapter content lives in
// <slug>/page.tsx; shared scaffolding is in _components/ and _data/.

import { useTranslation } from 'react-i18next';
import Link from '@/components/AppLink';
import { useT } from '../../../hooks/useT';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { CORE_ARTICLES, EVENT_ARTICLES, type RegArticle } from './_data/articles';
import { useRegText } from './_components/reg-text';
import './regulation.css';

const WCA_REG_FULL = 'https://www.worldcubeassociation.org/regulations/full/';
const WCA_REG_ZH = 'https://www.worldcubeassociation.org/regulations/translations/chinese/';

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
        <header className="reg-hero">
          <div className="reg-eyebrow">
            <img src="/icons/wca.svg" alt="WCA" />
            {t('WCA 竞赛规则 · 图解', 'WCA Regulations · Illustrated', "WCA 競賽規則 · 圖解")}
          </div>
          <h1 className="reg-title">
            {t('WCA ', 'WCA ')}
            <span className="reg-code">{t('竞赛规则', 'Regulations', "競賽規則")}</span>
          </h1>
          <p className="reg-subtitle">
            {t(
              '官方规则的逐章图解 —— 把每条规定配上图、动画和案例,让人和裁判都能一眼看懂',
              'The official regulations, chapter by chapter — every rule paired with diagrams, animations and real cases', "官方規則的逐章圖解 —— 把每條規定配上圖、動畫和案例,讓人和裁判都能一眼看懂"
            )}
          </p>
          <p className="reg-lede">
            {t(
              '这里覆盖 WCA《竞赛规则》的全部 10 个核心章节与 6 个项目专属附则。转动表示法用 3D 动画逐步演示;打乱、判定、魔方故障用图示和真实案例讲透。选一章开始,或用顶部链接对照官方原文。',
              'This covers all 10 core articles of the WCA Regulations plus the 6 event-specific articles (A–I). Notation is shown move by move in 3D; scrambling, judging and puzzle defects are made concrete with diagrams and real cases. Pick a chapter to start, or cross-check the official text via the links above.', "這裡覆蓋 WCA《競賽規則》的全部 10 個核心章節與 6 個項目專屬附則。轉動表示法用 3D 動畫逐步演示;打亂、判定、魔方故障用圖示和真實案例講透。選一章開始,或用頂部連結對照官方原文。"
            )}
          </p>
        </header>

        <section className="reg-hub-group">
          <h2 className="reg-hub-group-title">{t('核心条款', 'Core articles', "核心條款")}</h2>
          <div className="reg-hub-grid">
            {CORE_ARTICLES.map((a) => <ChapterCard key={a.slug} a={a} />)}
          </div>
        </section>

        <section className="reg-hub-group">
          <h2 className="reg-hub-group-title">{t('项目专属规程', 'Event-specific articles', "項目專屬規程")}</h2>
          <div className="reg-hub-grid">
            {EVENT_ARTICLES.map((a) => <ChapterCard key={a.slug} a={a} />)}
          </div>
        </section>

        <footer className="reg-footer">
          <p>
            {t(
              '本站内容整理自 WCA 官方《竞赛规则与指南》,为图文介绍与翻译,仅供学习参考;一切判定以官方现行版本为准。',
              'Compiled from the official WCA Regulations & Guidelines as an illustrated guide and translation, for educational reference only. Judging always follows the current official version.', "本站內容整理自 WCA 官方《競賽規則與指南》,為圖文介紹與翻譯,僅供學習參考;一切判定以官方現行版本為準。"
            )}
          </p>
          <p style={{ marginTop: 12 }}>
            <a href={WCA_REG_FULL} target="_blank" rel="noopener noreferrer">{t('官方规则全文', 'Official Regulations (full)', "官方規則全文")}</a>
            {' · '}
            <a href={WCA_REG_ZH} target="_blank" rel="noopener noreferrer">{t('官方中文翻译', 'Official Chinese translation', "官方中文翻譯")}</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
