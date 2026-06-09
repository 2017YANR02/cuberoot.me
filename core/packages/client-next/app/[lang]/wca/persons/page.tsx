'use client';
// /wca/persons — 选手搜索落地页(无 wcaId 时的索引路由).
// 详情页是 [wcaId]/ 动态壳(next.config rewrite 到 "_" sentinel),此处是搜索入口:
// 之前缺这个 page.tsx → /wca/persons 直接 404(选手详情页左上角"选手搜索"返回键命中).
// 复用既有 .wp-search-* 样式(persons.css)+ 全站 WcaPersonPicker。

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, UserSearch } from 'lucide-react';
import { WcaPersonPicker } from '@/components/WcaPersonPicker';
import type { WcaPersonLite } from '@/lib/wca-api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '@/components/persons/persons.css';

const EXAMPLES = ['2009ZEMD01', '2017GARR05', '2007YUNQ01'];

export default function PersonSearchPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en);
  useDocumentTitle('选手搜索', 'Person Search');
  const router = useRouter();
  const [picked, setPicked] = useState<WcaPersonLite | null>(null);

  const go = (id: string) => router.push(`${isZh ? '/zh' : ''}/wca/persons/${encodeURIComponent(id)}`);
  const onPick = (c: WcaPersonLite | null) => { setPicked(c); if (c) go(c.id); };

  return (
    <div className="wp-page">
      <header className="wp-header">
        <Link href="/wca" className="wp-back">
          <ChevronLeft size={16} />
          <span>WCA</span>
        </Link>
      </header>
      <main className="wp-main">
        <div className="wp-search-card">
          <div className="wp-search-icon"><UserSearch size={28} /></div>
          <h1 className="wp-search-title">{t('选手搜索', 'Person Search', '選手搜尋')}</h1>
          <p className="wp-search-hint">{t('输入选手名或 WCA ID', 'Search by name or WCA ID', '輸入選手名或 WCA ID')}</p>
          <div className="wp-search-picker">
            <WcaPersonPicker
              value={picked}
              onChange={onPick}
              isZh={isZh}
              placeholder={t('搜索选手名 / WCA ID', 'Search name / WCA ID', '搜尋選手名 / WCA ID')}
            />
          </div>
          <div className="wp-search-examples">
            <span className="wp-search-examples-label">{t('试试', 'Try', '試試')}</span>
            {EXAMPLES.map((id) => (
              <button key={id} type="button" className="wp-search-example" onClick={() => go(id)}>{id}</button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
