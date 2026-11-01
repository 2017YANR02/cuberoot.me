'use client';

import { Suspense } from 'react';
import Link from '@/components/AppLink';
import { useQueryState, parseAsStringEnum } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { HelpCircle } from '@app-foundation/icons/lucide';
import PageHeading from '@/components/PageHeading';
import LiquidGlassChips from '@/components/LiquidGlassChips';
import '../wca/_wca_stats_extra.css';
import StandardMode from './_modes/StandardMode';
import H2HMode from './_modes/H2HMode';
import WhatIfMode from './_modes/WhatIfMode';
import StatsMode from './_modes/StatsMode';
import './nemesizer.css';
import { tr } from '@/i18n/tr';
import { LoadingIndicator } from '@/components/LoadingIndicator';

type Mode = 'standard' | 'h2h' | 'whatif' | 'stats';
const MODES: Mode[] = ['standard', 'h2h', 'whatif', 'stats'];

function NemesizerInner() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  // mode 是导航态(在 4 个视图间切换)→ push 进历史,后退能返回上一视图
  const [mode, setMode] = useQueryState(
    'mode',
    parseAsStringEnum<Mode>(MODES).withDefault('standard').withOptions({ history: 'push', scroll: false }),
  );

  return (
    <div className="wse-page nemesizer-page">
      <header className="wse-header">
        <PageHeading backHref="/wca"><svg className="nemesizer-brand-logo" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="6" fill="var(--accent)" /><path d="M5 23V16H11V12H17V8H23V23Z" fill="var(--accent-foreground)" /></svg>Nemesizer
        <Link
          href="/nemesizer-about"
          className="wse-title-help"
          prefetch={false}
          title={tr({ zh: '这页是干啥的?', en: 'What is this page?'
        })}
          aria-label={tr({ zh: '查看说明', en: 'About this page'
        })}
        >
          <HelpCircle size={18} strokeWidth={1.75} />
        </Link>
        </PageHeading>
      </header>

      <div className="nemesizer-tabs">
        <LiquidGlassChips items={MODES} value={mode} onChange={setMode}
          ariaLabel={tr({ zh: '模式', en: 'Mode' })}
          getLabel={item => tr({ standard: { zh: '宿敌', en: 'Nemeses' }, h2h: { zh: '对决', en: 'Head to head' }, whatif: { zh: '假设', en: 'What if' }, stats: { zh: '统计', en: 'Statistics' } }[item])} />
      </div>

      {mode === 'standard' && <StandardMode isZh={isZh} />}
      {mode === 'h2h' && <H2HMode isZh={isZh} />}
      {mode === 'whatif' && <WhatIfMode isZh={isZh} />}
      {mode === 'stats' && <StatsMode isZh={isZh} />}
    </div>
  );
}

export default function NemesizerPage() {
  return (
    <Suspense fallback={<div className="nemesizer-page"><div className="nemesizer-loading"><LoadingIndicator /></div></div>}>
      <NemesizerInner />
    </Suspense>
  );
}
