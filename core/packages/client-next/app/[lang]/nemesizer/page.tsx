'use client';

import { Suspense } from 'react';
import Link from '@/components/AppLink';
import { useQueryState, parseAsStringEnum } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { HelpCircle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import NemesizerBrand from './_components/NemesizerBrand';
import StandardMode from './_modes/StandardMode';
import H2HMode from './_modes/H2HMode';
import WhatIfMode from './_modes/WhatIfMode';
import StatsMode from './_modes/StatsMode';
import './nemesizer.css';
import { tr } from '@/i18n/tr';

type Mode = 'standard' | 'h2h' | 'whatif' | 'stats';
const MODES: Mode[] = ['standard', 'h2h', 'whatif', 'stats'];

function NemesizerInner() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('宿敌', 'Nemesizer', "宿敵");

  // mode 是导航态(在 4 个视图间切换)→ push 进历史,后退能返回上一视图
  const [mode, setMode] = useQueryState(
    'mode',
    parseAsStringEnum<Mode>(MODES).withDefault('standard').withOptions({ history: 'push', scroll: false }),
  );

  return (
    <div className="nemesizer-page">
      <div className="nemesizer-brand-row">
        <NemesizerBrand isZh={isZh} />
        <Link
          href="/nemesizer-about"
          className="nemesizer-title-help"
          title={tr({ zh: '这页是干啥的?', en: 'What is this page?',
              zhHant: "這頁是幹啥的?"
        })}
          aria-label={tr({ zh: '查看说明', en: 'About this page',
              zhHant: "檢視說明"
        })}
        >
          <HelpCircle size={18} strokeWidth={1.75} />
        </Link>
      </div>

      <div className="nemesizer-tabs">
        <TabBtn active={mode === 'standard'} onClick={() => setMode('standard')}>{tr({ zh: '宿敌', en: 'Nemeses',
            zhHant: "宿敵"
        })}</TabBtn>
        <TabBtn active={mode === 'h2h'} onClick={() => setMode('h2h')}>{tr({ zh: '对决', en: 'Head to head',
            zhHant: "對決"
        })}</TabBtn>
        <TabBtn active={mode === 'whatif'} onClick={() => setMode('whatif')}>{tr({ zh: '假设', en: 'What if',
            zhHant: "假設"
        })}</TabBtn>
        <TabBtn active={mode === 'stats'} onClick={() => setMode('stats')}>{tr({ zh: '统计', en: 'Statistics',
            zhHant: "統計"
        })}</TabBtn>
      </div>

      {mode === 'standard' && <StandardMode isZh={isZh} />}
      {mode === 'h2h' && <H2HMode isZh={isZh} />}
      {mode === 'whatif' && <WhatIfMode isZh={isZh} />}
      {mode === 'stats' && <StatsMode isZh={isZh} />}
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
