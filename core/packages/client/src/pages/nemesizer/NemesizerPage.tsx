import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getLangQuery } from '../../i18n';
import LangToggle from '../../components/LangToggle';
import NemesizerBrand from './components/NemesizerBrand';
import StandardMode from './modes/StandardMode';
import H2HMode from './modes/H2HMode';
import WhatIfMode from './modes/WhatIfMode';
import StatsMode from './modes/StatsMode';
import { loadNemesizerData, type NemesizerDataset } from './data/nemesizerData';
import './nemesizer.css';

type Mode = 'standard' | 'h2h' | 'whatif' | 'stats';

export default function NemesizerPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const [params, setParams] = useSearchParams();
  const mode = (params.get('mode') as Mode) || 'standard';
  const [ds, setDs] = useState<NemesizerDataset | null>(null);
  const [phase, setPhase] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadNemesizerData(setPhase).then(setDs).catch(e => setErr(String(e)));
  }, []);

  const setMode = (m: Mode) => {
    // Reset mode-specific params when switching
    const next = new URLSearchParams();
    const lang = params.get('lang');
    if (lang) next.set('lang', lang);
    next.set('mode', m);
    setParams(next, { replace: false });
  };

  return (
    <div className="nemesizer-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Link to={`/wca-stats${getLangQuery()}`} className="nemesizer-link-btn">
          {isZh ? '← 返回 WCA 统计' : '← Back to WCA Stats'}
        </Link>
        <LangToggle />
      </div>

      <NemesizerBrand isZh={isZh} />

      <div className="nemesizer-tabs">
        <TabBtn active={mode === 'standard'} onClick={() => setMode('standard')}>{isZh ? '宿敌' : 'Nemeses'}</TabBtn>
        <TabBtn active={mode === 'h2h'} onClick={() => setMode('h2h')}>{isZh ? '对决' : 'Head to head'}</TabBtn>
        <TabBtn active={mode === 'whatif'} onClick={() => setMode('whatif')}>{isZh ? '假设' : 'What if'}</TabBtn>
        <TabBtn active={mode === 'stats'} onClick={() => setMode('stats')}>{isZh ? '统计' : 'Statistics'}</TabBtn>
      </div>

      {err && <div className="nemesizer-loading" style={{ color: '#e87474' }}>{err}</div>}
      {!ds && !err && <div className="nemesizer-loading">{isZh ? `加载中… (${phase})` : `Loading… (${phase})`}</div>}
      {ds && mode === 'standard' && <StandardMode ds={ds} isZh={isZh} />}
      {ds && mode === 'h2h' && <H2HMode ds={ds} isZh={isZh} />}
      {ds && mode === 'whatif' && <WhatIfMode ds={ds} isZh={isZh} />}
      {ds && mode === 'stats' && <StatsMode ds={ds} isZh={isZh} />}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className={`nemesizer-tab${active ? ' active' : ''}`} onClick={onClick}>{children}</button>;
}
