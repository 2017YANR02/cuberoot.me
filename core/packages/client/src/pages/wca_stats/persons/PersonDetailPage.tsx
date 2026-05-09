// /wca-stats/persons/:wcaId — WCA 选手详情页.
// Hero(头像 + 名字 + 信息条) + PR 表(当前/历史最佳排名) + 5 tabs(成绩/赛事/项目统计/里程碑/点亮城市).
//
// UI 灵感来自 cubing.pro/wca/player/* (GPL-3.0,致谢见 README + LandingPage credits).
// 数据层与组件均为本仓库原生实现:WCA 公开 REST API + 本仓库 historical_ranks_snapshot.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import {
  fetchWcaPerson, fetchWcaPersonResults, fetchWcaPersonCompetitions,
  type WcaPersonProfile, type WcaResultRow, type WcaCompetition,
} from './wca_api';
import { loadFlagData } from '../../../utils/country_flags';
import LangToggle from '../../../components/LangToggle';
import PersonHero from './sections/PersonHero';
import PersonPRTable from './sections/PersonPRTable';
import PersonTabs from './sections/PersonTabs';
import './persons.css';

export default function PersonDetailPage() {
  const { wcaId = '' } = useParams<{ wcaId: string }>();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const [profile, setProfile] = useState<WcaPersonProfile | null>(null);
  const [results, setResults] = useState<WcaResultRow[] | null>(null);
  const [comps, setComps] = useState<WcaCompetition[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProfile(null); setResults(null); setComps(null); setError(null);
    if (!wcaId) { setError('Missing WCA ID'); return; }
    let cancelled = false;
    // localizeCompName 依赖 comp_names_zh.json 提前加载;不 await 也无所谓,只是 ensure.
    loadFlagData().catch(() => { /* fallback to en */ });
    fetchWcaPerson(wcaId)
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); });
    fetchWcaPersonResults(wcaId)
      .then((r) => { if (!cancelled) setResults(r); })
      .catch(() => { /* keep degraded UI */ });
    fetchWcaPersonCompetitions(wcaId)
      .then((c) => { if (!cancelled) setComps(c); })
      .catch(() => { /* keep degraded UI */ });
    return () => { cancelled = true; };
  }, [wcaId]);

  // tab title
  useEffect(() => {
    if (profile?.person?.name) {
      document.title = `${profile.person.name} · WCA · cuberoot`;
    }
  }, [profile]);

  if (error) {
    return (
      <div className="wp-page">
        <PageHeader t={t} />
        <main className="wp-main">
          <div className="wp-error">{t('加载失败', 'Failed to load')}: {error}</div>
        </main>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="wp-page">
        <PageHeader t={t} />
        <main className="wp-main">
          <div className="wp-loading">{t('加载中…', 'Loading…')}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="wp-page">
      <PageHeader t={t} wcaId={profile.person.wca_id} />
      <main className="wp-main">
        <PersonHero profile={profile} results={results} isZh={isZh} />
        <PersonPRTable profile={profile} results={results} isZh={isZh} />
        <PersonTabs profile={profile} results={results} comps={comps} isZh={isZh} />
      </main>
    </div>
  );
}

function PageHeader({ t, wcaId }: { t: (zh: string, en: string) => string; wcaId?: string }) {
  return (
    <header className="wp-header">
      <Link to="/wca-stats/persons" className="wp-back">
        <ChevronLeft size={16} />
        <span>{t('选手搜索', 'Search')}</span>
      </Link>
      <div className="wp-header-right">
        <LangToggle />
        {wcaId && (
          <a
            href={`https://www.worldcubeassociation.org/persons/${wcaId}`}
            target="_blank" rel="noopener noreferrer"
            className="wp-source-link"
          >WCA</a>
        )}
      </div>
    </header>
  );
}
