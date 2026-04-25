import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ExternalLink, Trophy, Medal, Award } from 'lucide-react';
import { Flag } from '../../../utils/flag';
import { displayCuberName } from '../../../utils/name_utils';
import { ALL_EVENT_IDS, EVENT_ZH, EVENT_EN } from '../event_constants';
import { fetchWcaPerson, fetchWcaPersonResults, fetchWcaPersonCompetitions, type WcaPersonProfile, type WcaResultRow, type WcaCompetition } from './wca_api';
import { formatResult } from './format_result';
import './persons.css';

const WCA_PROFILE_URL = (id: string) => `https://www.worldcubeassociation.org/persons/${id}`;

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
    let cancelled = false;
    fetchWcaPerson(wcaId)
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); });
    // Kick off secondary fetches in parallel — they're not blocking the header render
    fetchWcaPersonCompetitions(wcaId)
      .then((c) => { if (!cancelled) setComps(c); })
      .catch(() => {});
    fetchWcaPersonResults(wcaId)
      .then((r) => { if (!cancelled) setResults(r); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [wcaId]);

  const eventName = (id: string) => (isZh ? (EVENT_ZH[id] ?? id) : (EVENT_EN[id] ?? id));

  // Group results by competition for the recent-competitions view
  const recentComps = useMemo(() => {
    if (!results || !comps) return null;
    const byComp = new Map<string, WcaResultRow[]>();
    for (const r of results) {
      if (!byComp.has(r.competition_id)) byComp.set(r.competition_id, []);
      byComp.get(r.competition_id)!.push(r);
    }
    const sorted = comps.slice().sort((a, b) => b.start_date.localeCompare(a.start_date));
    return sorted.slice(0, 12).map((c) => ({
      comp: c,
      results: byComp.get(c.id) ?? [],
    }));
  }, [results, comps]);

  if (error) {
    return (
      <div className="wca-persons-page">
        <header className="wca-persons-header">
          <Link to="/wca-stats/persons" className="wca-persons-back">
            <ChevronLeft size={18} />
            <span>{t('返回搜索', 'Back to search')}</span>
          </Link>
        </header>
        <div className="wca-persons-error">{t('加载失败', 'Failed to load')}: {error}</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="wca-persons-page">
        <header className="wca-persons-header">
          <Link to="/wca-stats/persons" className="wca-persons-back">
            <ChevronLeft size={18} />
            <span>{t('返回搜索', 'Back to search')}</span>
          </Link>
        </header>
        <div className="wca-persons-loading">{t('加载中…', 'Loading…')}</div>
      </div>
    );
  }

  const p = profile.person;
  const displayName = displayCuberName(p.name, isZh);
  const avatarUrl = p.avatar?.thumb_url || p.avatar?.url;
  // Show events the person actually has PRs for, ordered by ALL_EVENT_IDS
  const prEventIds = ALL_EVENT_IDS.filter((id) => profile.personal_records[id]);

  return (
    <div className="wca-persons-page">
      <header className="wca-persons-header">
        <Link to="/wca-stats/persons" className="wca-persons-back">
          <ChevronLeft size={18} />
          <span>{t('返回搜索', 'Back to search')}</span>
        </Link>
        <a href={WCA_PROFILE_URL(p.wca_id)} target="_blank" rel="noopener noreferrer" className="wca-persons-source">
          <ExternalLink size={14} />
          <span>WCA</span>
        </a>
      </header>

      <main className="wca-persons-main">
        <section className="wca-person-hero">
          <div className="wca-person-avatar">
            {avatarUrl
              ? <img src={avatarUrl} alt={displayName} />
              : <div className="wca-person-avatar-fallback">{(displayName[0] ?? '?').toUpperCase()}</div>}
          </div>
          <div className="wca-person-info">
            <h1 className="wca-person-name">{displayName}</h1>
            <div className="wca-person-meta">
              <span className="wca-person-id">{p.wca_id}</span>
              {p.country_iso2 && (
                <span className="wca-person-country">
                  <Flag iso2={p.country_iso2} className="wca-person-flag" />
                  <span>{p.country_iso2.toUpperCase()}</span>
                </span>
              )}
              <span className="wca-person-comps">
                {profile.competition_count} {t('场比赛', profile.competition_count === 1 ? 'comp' : 'comps')}
              </span>
            </div>
            <div className="wca-person-badges">
              <BadgeRow icon={<Medal size={14} />} label={t('奖牌', 'Medals')} entries={[
                { label: t('金', 'G'), n: profile.medals.gold,   tone: 'gold'   },
                { label: t('银', 'S'), n: profile.medals.silver, tone: 'silver' },
                { label: t('铜', 'B'), n: profile.medals.bronze, tone: 'bronze' },
              ]} />
              <BadgeRow icon={<Trophy size={14} />} label={t('记录', 'Records')} entries={[
                { label: t('世', 'WR'), n: profile.records.world,        tone: 'wr' },
                { label: t('洲', 'CR'), n: profile.records.continental,  tone: 'cr' },
                { label: t('国', 'NR'), n: profile.records.national,     tone: 'nr' },
              ]} />
            </div>
          </div>
        </section>

        <section className="wca-person-pr">
          <h2 className="wca-section-title"><Award size={16} />{t('个人纪录', 'Personal Records')}</h2>
          {prEventIds.length === 0 ? (
            <div className="wca-persons-empty">{t('暂无成绩', 'No results yet')}</div>
          ) : (
            <table className="wca-pr-table">
              <thead>
                <tr>
                  <th>{t('项目', 'Event')}</th>
                  <th>{t('单次', 'Single')}</th>
                  <th>{t('排名', 'Rank')}</th>
                  <th>{t('平均', 'Average')}</th>
                  <th>{t('排名', 'Rank')}</th>
                </tr>
              </thead>
              <tbody>
                {prEventIds.map((eid) => {
                  const pr = profile.personal_records[eid];
                  return (
                    <tr key={eid}>
                      <th scope="row">{eventName(eid)}</th>
                      <td className="wca-pr-result">{pr.single ? formatResult(pr.single.best, eid, 'single') : ''}</td>
                      <td className="wca-pr-rank">{pr.single ? <RankCell r={pr.single} t={t} /> : ''}</td>
                      <td className="wca-pr-result">{pr.average ? formatResult(pr.average.best, eid, 'average') : ''}</td>
                      <td className="wca-pr-rank">{pr.average ? <RankCell r={pr.average} t={t} /> : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="wca-person-comps-section">
          <h2 className="wca-section-title"><Trophy size={16} />{t('近期比赛', 'Recent Competitions')}</h2>
          {!recentComps && <div className="wca-persons-loading">{t('加载比赛历史…', 'Loading competitions…')}</div>}
          {recentComps && recentComps.length === 0 && (
            <div className="wca-persons-empty">{t('暂无比赛记录', 'No competitions')}</div>
          )}
          {recentComps && recentComps.length > 0 && (
            <ul className="wca-comp-list">
              {recentComps.map(({ comp, results }) => (
                <li key={comp.id} className="wca-comp">
                  <div className="wca-comp-header">
                    <Flag iso2={comp.country_iso2} className="wca-comp-flag" />
                    <a
                      href={`https://www.worldcubeassociation.org/competitions/${comp.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="wca-comp-name"
                    >
                      {comp.name}
                    </a>
                    <span className="wca-comp-date">{comp.start_date}</span>
                  </div>
                  {results.length > 0 && (
                    <div className="wca-comp-results">
                      {dedupeFinalResults(results).map((r) => (
                        <span key={r.event_id} className="wca-comp-result-chip">
                          <span className="wca-comp-event">{eventName(r.event_id)}</span>
                          <span className="wca-comp-best">{formatResult(r.best, r.event_id, 'single')}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {comps && comps.length > 12 && (
            <div className="wca-comps-more">
              {t(`仅显示最近 12 场,共 ${comps.length} 场`, `Showing 12 most recent of ${comps.length}`)}
              {' · '}
              <a href={WCA_PROFILE_URL(p.wca_id)} target="_blank" rel="noopener noreferrer">
                {t('在 WCA 官网查看全部', 'See all on WCA')}
              </a>
            </div>
          )}
        </section>

        <footer className="wca-person-footer">
          {t('数据来自', 'Data from')} <a href={WCA_PROFILE_URL(p.wca_id)} target="_blank" rel="noopener noreferrer">worldcubeassociation.org</a>
          {' · '}
          {t('本地缓存 24 小时', 'Cached locally for 24h')}
        </footer>
      </main>
    </div>
  );
}

function RankCell({ r, t }: { r: { world_rank: number | null; continent_rank: number | null; country_rank: number | null }; t: (zh: string, en: string) => string }) {
  return (
    <span className="wca-rank-cell">
      <span className="wca-rank wca-rank-w" title={t('世界', 'World')}>{r.world_rank ?? '–'}</span>
      <span className="wca-rank wca-rank-c" title={t('洲', 'Continent')}>{r.continent_rank ?? '–'}</span>
      <span className="wca-rank wca-rank-n" title={t('国家', 'Country')}>{r.country_rank ?? '–'}</span>
    </span>
  );
}

function BadgeRow({ icon, label, entries }: {
  icon: React.ReactNode;
  label: string;
  entries: { label: string; n: number; tone: string }[];
}) {
  if (entries.every((e) => e.n === 0)) return null;
  return (
    <div className="wca-badge-row">
      <span className="wca-badge-label">{icon}{label}</span>
      {entries.map((e) => (
        e.n > 0 ? (
          <span key={e.label} className={`wca-badge wca-badge-${e.tone}`}>
            <span className="wca-badge-tag">{e.label}</span>
            <span className="wca-badge-n">{e.n}</span>
          </span>
        ) : null
      ))}
    </div>
  );
}

// Per competition, keep one row per event (the best one — typically final round).
function dedupeFinalResults(rows: WcaResultRow[]): WcaResultRow[] {
  const byEvent = new Map<string, WcaResultRow>();
  for (const r of rows) {
    const cur = byEvent.get(r.event_id);
    if (!cur || (r.best > 0 && (cur.best <= 0 || r.best < cur.best))) byEvent.set(r.event_id, r);
  }
  return [...byEvent.values()];
}
