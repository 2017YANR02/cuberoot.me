'use client';

import { Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { HelpCircle } from 'lucide-react';
import LangToggle from '@/components/LangToggle';
import ThemeToggle from '@/components/ThemeToggle';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import NemesizerBrand from './_components/NemesizerBrand';
import StandardMode from './_modes/StandardMode';
import H2HMode from './_modes/H2HMode';
import WhatIfMode from './_modes/WhatIfMode';
import StatsMode from './_modes/StatsMode';
import './nemesizer.css';

type Mode = 'standard' | 'h2h' | 'whatif' | 'stats';

function NemesizerInner() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('苦主', 'Nemesizer');

  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const mode = (params.get('mode') as Mode) || 'standard';

  const setMode = useCallback((m: Mode) => {
    const next = new URLSearchParams();
    const lang = params.get('lang');
    if (lang) next.set('lang', lang);
    next.set('mode', m);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }, [params, router, pathname]);

  return (
    <div className="nemesizer-page">
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <ThemeToggle />
        <LangToggle />
      </div>

      <div className="nemesizer-brand-row">
        <NemesizerBrand isZh={isZh} />
        <Link
          href="/nemesizer-about"
          className="nemesizer-title-help"
          title={isZh ? '这页是干啥的?' : 'What is this page?'}
          aria-label={isZh ? '查看说明' : 'About this page'}
        >
          <HelpCircle size={18} strokeWidth={1.75} />
        </Link>
      </div>

      <div className="nemesizer-tabs">
        <TabBtn active={mode === 'standard'} onClick={() => setMode('standard')}>{isZh ? '宿敌' : 'Nemeses'}</TabBtn>
        <TabBtn active={mode === 'h2h'} onClick={() => setMode('h2h')}>{isZh ? '对决' : 'Head to head'}</TabBtn>
        <TabBtn active={mode === 'whatif'} onClick={() => setMode('whatif')}>{isZh ? '假设' : 'What if'}</TabBtn>
        <TabBtn active={mode === 'stats'} onClick={() => setMode('stats')}>{isZh ? '统计' : 'Statistics'}</TabBtn>
      </div>

      {mode === 'standard' && <StandardMode isZh={isZh} />}
      {mode === 'h2h' && <H2HMode isZh={isZh} />}
      {mode === 'whatif' && <WhatIfMode isZh={isZh} />}
      {mode === 'stats' && <StatsMode isZh={isZh} />}

      <footer className="nemesizer-footer">
        {isZh ? (
          <>
            算法参考{' '}
            <a href="https://github.com/huizhiLLL/WCA-Nemesizer-API" target="_blank" rel="noreferrer">huizhiLLL/WCA-Nemesizer-API</a>
            ；UI 借鉴 <a href="https://nemesizer.com" target="_blank" rel="noreferrer">nemesizer.com</a>。
            数据基于最近的 WCA developer dump，每周自动更新。
          </>
        ) : (
          <>
            Algorithm based on{' '}
            <a href="https://github.com/huizhiLLL/WCA-Nemesizer-API" target="_blank" rel="noreferrer">huizhiLLL/WCA-Nemesizer-API</a>
            ; UI inspired by <a href="https://nemesizer.com" target="_blank" rel="noreferrer">nemesizer.com</a>.
            Data refreshed weekly from the WCA developer dump.
          </>
        )}
      </footer>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className={`nemesizer-tab${active ? ' active' : ''}`} onClick={onClick}>{children}</button>;
}

export default function NemesizerPage() {
  return (
    <Suspense fallback={<div className="nemesizer-page"><div className="nemesizer-loading">Loading…</div></div>}>
      <NemesizerInner />
    </Suspense>
  );
}
