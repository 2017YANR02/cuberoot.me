'use client';

import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { LangCtx, L } from '../../_lib/Lang';
import type { Lang } from '../../_lib/Lang';
import ArchNav from '../_components/ArchNav';
import HistoryJourney from '../_components/HistoryJourney';
import '../architecture.css';
import './history.css';

export default function ArchHistoryPage() {
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');

  return (
    <LangCtx.Provider value={lang}>
      <div className="arch-page history-page">
        <ArchNav />

        <HistoryJourney />

        <footer className="arch-foot">
          <div className="arch-foot-line">
            <Link href="/dev/architecture"><L zh="概览" en="Overview" /></Link>
            <span className="arch-meta-sep">·</span>
            <Link href="/dev/architecture/flow"><L zh="请求流程" en="Flow" /></Link>
            <span className="arch-meta-sep">·</span>
            <Link href="/dev/architecture/decisions"><L zh="技术决策" en="Decisions" /></Link>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
