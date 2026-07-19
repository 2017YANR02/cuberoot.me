'use client';

// 共享页头 for the /wca/{success-rate,cohort-ranks,all-events-done,grand-slam}
// 统计表页 —— 这 4 页原本各抄一份字节相同的「返回 + 标题 + ?说明 + 副标题」页头。
// 只有 slug(说明页 /wca/about/<slug>)、标题、副标题按页不同,抽成 props。
// 返回链接、说明图标(HelpCircle)、class 名与原实现保持一致。

import Link from '@/components/AppLink';
import { ChevronLeft, HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { tr } from '@/i18n/tr';

interface Props {
  /** 说明页 slug → href `/wca/about/<slug>` */
  slug: string;
  title: { zh: string; en: string };
  subtitle: { zh: string; en: string };
}

export function WcaStatsPageHeader({ slug, title, subtitle }: Props) {
  const { i18n } = useTranslation();
  return (
    <header className="wse-header">
      <div className="wse-header-row">
        <Link href={`/wca?lang=${i18n.language}`} className="wse-back"><ChevronLeft size={16} /> {tr({ zh: '返回', en: 'Back' })}</Link>
      </div>
      <h1 className="wse-title-row">
        {tr(title)}
        <Link
          href={`/wca/about/${slug}`}
          className="wse-title-help"
          title={tr({ zh: '这页是干啥的?', en: 'What is this page?' })}
          aria-label={tr({ zh: '查看说明', en: 'About this page' })}
        >
          <HelpCircle size={18} strokeWidth={1.75} />
        </Link>
      </h1>
      <p className="wse-subtitle">{tr(subtitle)}</p>
    </header>
  );
}

export default WcaStatsPageHeader;
