'use client';

import PageHeading from '@/components/PageHeading';
import HeaderToggles from '@/components/HeaderToggles';
import RecentScrambles from '@/components/RecentScrambles';
import { PAGE_META } from '@/lib/page-meta';
import { tr, useLang } from '@/i18n/tr';
import './recent.css';

export default function RecentScramblesPage() {
  const lang = useLang();
  return (
    <div className="recent-scrambles-page">
      <header className="recent-scrambles-page-header">
        <PageHeading>{tr(PAGE_META['scramble/recent'].title)}</PageHeading>
        <HeaderToggles />
      </header>
      <RecentScrambles lang={lang} standalone />
    </div>
  );
}
