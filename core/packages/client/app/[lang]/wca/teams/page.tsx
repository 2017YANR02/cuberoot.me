'use client';

import PageHeading from '@/components/PageHeading';
import { Plus } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { useQueryStates, parseAsString } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { CubingBrandLabel } from '@/components/CubingBrandLabel';
import { CompactSelect } from '@/components/CompactSelect';
import PersonLink from '@/components/PersonLink';
import { Flag } from '@/components/Flag';
import { WcaPersonIdentity } from '@/components/WcaPersonIdentity';
import { SearchInput } from '@/components/SearchInput';
import { Tooltip } from '@/components/Tooltip';
import { WcaRelationColumnHeader } from '@/components/WcaRelationColumnHeader';
import { wcaTeamSelectItems } from '@/components/wca-team-select-items';
import type { WcaTeam } from '@/lib/wca-teams-api';
import Paginator from '@/components/wca-stats/Paginator';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import AppLink from '@/components/AppLink';
import { apiUrl } from '@/lib/api-base';
import { useIsAdmin } from '@/lib/auth-store';
import { WCA_TEAM_BRANDS, wcaTeamBrand } from '@/lib/wca-team-brands';
import { formatWcaResult } from '@/lib/wca-format-result';
import { displayCuberName } from '@/lib/cuber-name-display';
import { PAGE_META } from '@/lib/page-meta';
import { tr } from '@/i18n/tr';
import AddTeamMemberForm from './AddTeamMemberForm';
import '../_wca_stats_extra.css';
import './teams.css';

interface Team { id: number; name: string; count: number }
interface Directory {
  teams: Team[];
  members: Array<{
    memberId: number; wcaId: string | null; name: string; iso2: string | null; teamId: number; teamName: string;
    teams?: WcaTeam[];
    bestAverage: number | null; bestSingle?: number | null; competitionCount?: number; championshipCount?: number;
    singleWorldRank?: number | null; averageWorldRank?: number | null;
  }>;
  total: number;
}

function TeamsDirectory() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const isAdmin = useIsAdmin();
  const [query, setQuery] = useQueryStates({ team: parseAsString, q: parseAsString, page: parseAsString }, { history: 'replace', scroll: false });
  const team = query.team === 'moyu' ? '' : query.team ?? '';
  useEffect(() => {
    if (query.team === 'moyu') void setQuery({ team: null, page: null });
  }, [query.team, setQuery]);
  const search = query.q ?? '';
  const page = Math.max(1, Number(query.page) || 1);
  const [draft, setDraft] = useState(search);
  const [data, setData] = useState<Directory | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, retry] = useState(0);
  const [openBrand, setOpenBrand] = useState<string | null>(null);
  const [addingMember, setAddingMember] = useState(false);
  const [memberSaved, setMemberSaved] = useState(false);
  useEffect(() => { setDraft(search); }, [search]);
  useEffect(() => {
    if (draft === search) return;
    const timer = setTimeout(() => { void setQuery({ q: draft || null, page: null }); }, 250);
    return () => clearTimeout(timer);
  }, [draft, search, setQuery]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setFailed(false);
    const qs = new URLSearchParams({ directory: '1', team, q: search, page: String(page), size: '50', v: '5' });
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
  const groups = new Map<string, Team[]>(WCA_TEAM_BRANDS.map(brand => [brand.name, []]));
  for (const item of data?.teams ?? []) {
    if (item.count === 0 && WCA_TEAM_BRANDS.some(brand => brand.name === item.name)) continue;
    const brand = wcaTeamBrand(item.name);
    groups.set(brand, [...(groups.get(brand) ?? []), item]);
  }
  const sortedGroups = [...groups]
    .filter(([, teams]) => teams.length > 0)
    .map(([brand, teams]) => ({ brand, teams, count: teams.reduce((sum, item) => sum + item.count, 0), isBrand: WCA_TEAM_BRANDS.some(item => item.name === brand) }))
    .sort((a, b) => b.count - a.count);
  const selectedTeam = data?.teams.find(item => String(item.id) === team);
  const assignableTeams = isAdmin ? data?.teams.filter(item => item.name !== '魔域' && item.name !== 'GAN') : undefined;
  const renderChoiceContent = (name: string) => <span className="wca-team-choice-logo"><CubingBrandLabel name={name} logoOnly fallbackToName nativeTitle={false} /></span>;
  const renderTeamChoice = (brand: string, teamId: string) => <button type="button" className="wca-team-choice wca-team-brand-trigger"
      aria-label={brand} aria-pressed={team === teamId}
      onClick={() => {
        setOpenBrand(null);
        chooseTeam(team === teamId ? '' : teamId);
      }}>
      {renderChoiceContent(brand)}
    </button>;
  return <main className="wca-teams-page">
    <header className="wca-teams-header"><PageHeading backHref="/wca">{tr(PAGE_META['wca/teams'].title)}</PageHeading>
      <AppLink href="/wca/results" prefetch={false}>{tr({ zh: '排名', en: 'Rankings' })}</AppLink>
    </header>
    <div className="wca-team-groups">
      {sortedGroups.map(({ brand, teams, isBrand }) => <section key={brand} className="wca-team-group" aria-label={brand}>
        {isBrand && teams.length > 1 ? <CompactSelect className="wca-team-brand-menu" unstyledTrigger
          triggerClassName={`wca-team-choice wca-team-brand-trigger${teams.some(item => team === String(item.id)) ? ' is-selected' : ''}`}
          popupClassName="wca-team-menu" label={renderChoiceContent(brand)}
          ariaLabel={tr({ zh: `${brand} 旗下战队`, en: `${brand} teams` })}
          value={team} onChange={value => chooseTeam(team === value ? '' : value)}
          open={openBrand === brand} onOpenChange={open => setOpenBrand(open ? brand : null)}
          items={[...teams].sort((a, b) => {
            const order: readonly string[] = WCA_TEAM_BRANDS.find(item => item.name === brand)?.teams ?? [];
            return order.indexOf(a.name) - order.indexOf(b.name);
          }).map(item => ({ value: String(item.id), label: renderChoiceContent(item.name) }))}
        /> : renderTeamChoice(brand, String(teams[0].id))}
      </section>)}
    </div>
    <div className="wca-teams-toolbar"><SearchInput value={draft} onChange={setDraft} placeholder={tr({ zh: '姓名或 WCA ID', en: 'Name or WCA ID' })} />
      {data && <span className="wca-teams-total">{tr({ zh: `${data.total} 人`, en: `${data.total} members` })}</span>}
      {assignableTeams?.length && !addingMember ? <button type="button" className="btn-secondary wca-team-add-trigger"
        aria-label={tr({ zh: '添加成员', en: 'Add member' })}
        onClick={() => { setMemberSaved(false); setAddingMember(true); }}><Plus size={18} aria-hidden="true" /></button> : null}
    </div>
    {addingMember && assignableTeams && <AddTeamMemberForm teams={assignableTeams}
      initialTeam={assignableTeams.some(item => String(item.id) === team) ? team : ''} isZh={isZh}
      onCancel={() => setAddingMember(false)} onSaved={teamId => {
        setAddingMember(false);
        setMemberSaved(true);
        setDraft('');
        void setQuery({ team: teamId, q: null, page: null });
        retry(value => value + 1);
      }} />}
    {isAdmin && memberSaved && <p role="status">{tr({ zh: '成员已添加。', en: 'Member added.' })}</p>}
    {loading ? <ContentSkeleton variant="list" /> : failed ? <button type="button" onClick={() => retry(value => value + 1)}>{tr({ zh: '加载失败，重试', en: 'Failed to load. Retry' })}</button> : null}
    <div className="wse-table-wrapper"><table className="wse-table wca-teams-table sticky-thead" aria-busy={loading}>
      <thead><tr><WcaRelationColumnHeader className="wca-person-column" label={tr({ zh: '选手', en: 'Person' })} filterLabel={tr({ zh: '战队', en: 'Team' })} resetLabel={tr({ zh: '不限战队', en: 'Any team' })} filter={{ value: team, onChange: chooseTeam, items: wcaTeamSelectItems(data?.teams ?? []), selectedLabel: selectedTeam?.name }} />
        <th>{tr({ zh: '三阶单次', en: '3×3 single' })}</th>
        <th>{tr({ zh: '三阶平均', en: '3×3 average' })}</th>
        <th>{tr({ zh: '参赛次数', en: 'Competitions' })}</th>
        <th><Tooltip content={tr({ zh: '全部项目累计决赛冠军次数（含加入战队前）', en: 'Career event wins in finals, including before joining the team' })}>
          {tip => <span {...tip} tabIndex={0}>{tr({ zh: '夺冠次数', en: 'Titles' })}</span>}
        </Tooltip></th></tr></thead>
      <tbody>{!loading && !failed && data?.members.map(member => <tr key={member.wcaId ?? member.memberId}>
        <td><WcaPersonIdentity teams={member.teams ?? [{ id: member.teamId, name: member.teamName }]} flag={member.iso2 && <Flag iso2={member.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}>{member.wcaId
            ? <PersonLink wcaId={member.wcaId} name={member.name} isZh={isZh} showTeam={false} />
            : <span>{displayCuberName(member.name, isZh)}</span>}
        </WcaPersonIdentity></td>
        <td>{member.bestSingle == null ? '—' : formatWcaResult(member.bestSingle, '333', 'single')}
          {member.bestSingle != null && member.singleWorldRank != null && member.singleWorldRank > 0 &&
            <span className="wca-team-world-rank">WR{member.singleWorldRank}</span>}
        </td>
        <td className="wca-team-average">{member.bestAverage === null ? '—' : formatWcaResult(member.bestAverage, '333', 'average')}
          {member.bestAverage != null && member.averageWorldRank != null && member.averageWorldRank > 0 &&
            <span className="wca-team-world-rank">WR{member.averageWorldRank}</span>}
        </td>
        <td>{member.competitionCount ?? '—'}</td>
        <td>{member.championshipCount ?? '—'}</td>
      </tr>)}
      {!loading && !failed && data?.total === 0 && <tr><td colSpan={5}>{tr({ zh: '没有匹配的选手', en: 'No matching members' })}</td></tr>}
      </tbody></table></div>
    {data && data.total > 50 && <Paginator page={page} totalPages={Math.ceil(data.total / 50)} size={50} pageSizeOptions={[50]} isZh={isZh}
      onPageChange={page => { void setQuery({ page: String(page) }); }} onSizeChange={() => {}} />}
  </main>;
}

export default function Page() { return <Suspense fallback={<ContentSkeleton variant="list" />}><TeamsDirectory /></Suspense>; }
