'use client';

import { Suspense, useEffect, useState } from 'react';
import { useQueryStates, parseAsString } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { CubingBrandLabel } from '@/components/CubingBrandLabel';
import PersonLink from '@/components/PersonLink';
import { SearchInput } from '@/components/SearchInput';
import { WcaRelationColumnHeader } from '@/components/WcaRelationColumnHeader';
import { wcaTeamSelectItems } from '@/components/wca-team-select-items';
import Paginator from '@/components/wca-stats/Paginator';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import AppLink from '@/components/AppLink';
import { apiUrl } from '@/lib/api-base';
import { wcaTeamBrand } from '@/lib/wca-team-brands';
import { formatWcaResult } from '@/lib/wca-format-result';
import { tr } from '@/i18n/tr';
import '../_wca_stats_extra.css';
import './teams.css';

interface Team { id: number; name: string; count: number }
interface Directory {
  teams: Team[];
  members: Array<{ wcaId: string; name: string; teamId: number; teamName: string; bestAverage: number | null }>;
  total: number;
}

function TeamsDirectory() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [query, setQuery] = useQueryStates({ team: parseAsString, q: parseAsString, page: parseAsString }, { history: 'replace', scroll: false });
  const team = query.team ?? '';
  const search = query.q ?? '';
  const page = Math.max(1, Number(query.page) || 1);
  const [draft, setDraft] = useState(search);
  const [data, setData] = useState<Directory | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, retry] = useState(0);
  useEffect(() => { setDraft(search); }, [search]);
  useEffect(() => {
    if (draft === search) return;
    const timer = setTimeout(() => { void setQuery({ q: draft || null, page: null }); }, 250);
    return () => clearTimeout(timer);
  }, [draft, search, setQuery]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setFailed(false);
    const qs = new URLSearchParams({ directory: '1', team, q: search, page: String(page), size: '50', v: '2' });
    fetch(apiUrl('/v1/wca/teams?' + qs), { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error(String(response.status));
      const result = await response.json();
      if (!Array.isArray(result.members)) throw new Error('Directory unavailable');
      if (!controller.signal.aborted) setData(result);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [team, search, page, revision]);
  const chooseTeam = (value: string) => { void setQuery({ team: value || null, page: null }); };
  const groups = new Map<string, Team[]>();
  for (const item of data?.teams ?? []) {
    const brand = wcaTeamBrand(item.name);
    groups.set(brand, [...(groups.get(brand) ?? []), item]);
  }
  return <main className="wca-teams-page">
    <header className="wca-teams-header"><h1>{tr({ zh: '厂商与战队', en: 'Brands & Teams' })}</h1>
      <AppLink href="/wca/results" prefetch={false}>{tr({ zh: '排名', en: 'Rankings' })}</AppLink>
    </header>
    <div className="wca-team-groups">
      {[...groups].map(([brand, teams]) => <section key={brand} className="wca-team-group">
        <button type="button" className="wca-team-choice wca-team-brand-button" aria-pressed={team === (brand === '魔域' ? 'moyu' : String(teams[0].id))}
          onClick={() => chooseTeam(brand === '魔域' ? 'moyu' : String(teams[0].id))}>
          <CubingBrandLabel name={brand} logoOnly fallbackToName /><span>{teams.reduce((sum, item) => sum + item.count, 0)}</span>
        </button>
        {teams.length > 1 && <div className="wca-team-children">{teams.map(item => <button type="button" className="wca-team-choice" key={item.id} aria-pressed={team === String(item.id)} onClick={() => chooseTeam(String(item.id))}>
          <CubingBrandLabel name={item.name} logoOnly fallbackToName /><span>{item.count}</span>
        </button>)}</div>}
      </section>)}
    </div>
    <div className="wca-teams-toolbar"><SearchInput value={draft} onChange={setDraft} placeholder={tr({ zh: '姓名或 WCA ID', en: 'Name or WCA ID' })} />
      {data && <span>{tr({ zh: `${data.total} 人`, en: `${data.total} members` })}</span>}
    </div>
    {loading ? <LoadingIndicator /> : failed ? <button type="button" onClick={() => retry(value => value + 1)}>{tr({ zh: '加载失败，重试', en: 'Failed to load. Retry' })}</button> : null}
    <div className="wse-table-wrapper"><table className="wse-table sticky-thead">
      <thead><tr><th>{tr({ zh: '选手', en: 'Person' })}</th>
        <WcaRelationColumnHeader label={tr({ zh: '战队', en: 'Team' })} filter={{ value: team, onChange: chooseTeam, items: wcaTeamSelectItems(data?.teams ?? [], 'filter') }} />
        <th>{tr({ zh: '三阶平均', en: '3×3 average' })}</th></tr></thead>
      <tbody>{!loading && !failed && data?.members.map(member => <tr key={member.wcaId}>
        <td><PersonLink wcaId={member.wcaId} name={member.name} isZh={isZh} showTeam={false} /></td>
        <td><CubingBrandLabel name={member.teamName} logoOnly fallbackToName /></td>
        <td>{member.bestAverage === null ? '—' : formatWcaResult(member.bestAverage, '333', 'average')}</td>
      </tr>)}
      {!loading && !failed && data?.total === 0 && <tr><td colSpan={3}>{tr({ zh: '没有匹配的选手', en: 'No matching members' })}</td></tr>}
      </tbody></table></div>
    {data && data.total > 50 && <Paginator page={page} totalPages={Math.ceil(data.total / 50)} size={50} pageSizeOptions={[50]} isZh={isZh}
      onPageChange={page => { void setQuery({ page: String(page) }); }} onSizeChange={() => {}} />}
  </main>;
}

export default function Page() { return <Suspense fallback={<LoadingIndicator />}><TeamsDirectory /></Suspense>; }
