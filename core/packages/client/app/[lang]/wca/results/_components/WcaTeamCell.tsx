'use client';

import { useEffect, useState } from 'react';
import { isAdminWcaId } from '@cuberoot/shared/admin';
import { useAuthUser } from '@/lib/auth-store';
import type { WcaTeamsResponse } from '@/lib/wca-teams-api';
import { fetchWcaTeamDirectory, saveWcaPersonTeam } from '@/lib/wca-team-directory';
import { WcaTeacherCell, type WcaTeacherDirectory } from '@/components/WcaTeacherCell';
import { ListSelect } from '@/components/ListSelect';
import { CubingBrandLabel } from '@/components/CubingBrandLabel';
import { SearchInput } from '@/components/SearchInput';
import { tr } from '@/i18n/tr';
import '@/components/wca-teacher-cell.css';
import './wca-team-cell.css';

export function useWcaTeams(wcaIds: string[]) {
  const user = useAuthUser();
  const key = [...new Set(wcaIds)].sort().join(',');
  const [data, setData] = useState<WcaTeamsResponse>({ teams: [], assignments: [] });
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setResolvedKey(null);
    if (!key) {
      setData({ teams: [], assignments: [] });
      setResolvedKey(key);
      return;
    }
    const ids = key.split(',');
    const requests = [];
    for (let i = 0; i < ids.length; i += 100) requests.push(fetchWcaTeamDirectory(ids.slice(i, i + 100)));
    Promise.all(requests).then(groups => {
      if (cancelled) return;
      setData({ teams: groups[0].teams, assignments: groups.flatMap(group => group.assignments) });
      setResolvedKey(key);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [key, revision]);
  return {
    ...data,
    ready: resolvedKey === key && !failed,
    failed,
    isAdmin: isAdminWcaId(user?.wcaId),
    retry: () => setRevision(value => value + 1),
    save: async (wcaId: string, name: string) => {
      const { team } = await saveWcaPersonTeam(wcaId, name);
      setData(current => ({
        teams: team && !current.teams.some(item => item.id === team.id) ? [...current.teams, team] : current.teams,
        assignments: [
          ...current.assignments.filter(item => item.wcaId !== wcaId),
          ...(team ? [{ wcaId, teamId: team.id }] : []),
        ],
      }));
    },
  };
}

export function WcaPersonRelationCells({ wcaId, eventIds, teacherDirectory, teamDirectory, isZh, visibleTeacherWcaId }: {
  wcaId: string;
  eventIds: readonly string[];
  teacherDirectory: WcaTeacherDirectory;
  teamDirectory: ReturnType<typeof useWcaTeams>;
  isZh: boolean;
  visibleTeacherWcaId?: string;
}) {
  const [selected, setSelected] = useState('');
  const [custom, setCustom] = useState('');
  const [teamChanged, setTeamChanged] = useState(false);
  const teamId = teamDirectory.assignments.find(item => item.wcaId === wcaId)?.teamId;
  const team = teamDirectory.teams.find(item => item.id === teamId);
  const selectedValue = teamChanged ? selected : team ? String(team.id) : '';
  const name = selectedValue === 'custom' ? custom.trim() : teamDirectory.teams.find(item => String(item.id) === selectedValue)?.name ?? '';
  return <>
    <td><WcaTeacherCell studentWcaId={wcaId} eventIds={eventIds} directory={teacherDirectory} isZh={isZh} visibleTeacherWcaId={visibleTeacherWcaId}
      additionalEditor={teamDirectory.isAdmin ? {
        title: tr({ zh: '编辑老师、培训机构和战队', en: 'Edit teacher, institution and team' }),
        onOpen: () => { setSelected(team ? String(team.id) : ''); setCustom(''); setTeamChanged(false); },
        canSave: teamDirectory.ready && (selectedValue !== 'custom' || !!name),
        save: async () => { if (teamChanged && name !== (team?.name ?? '')) await teamDirectory.save(wcaId, name); },
        render: saving => <div className="wca-teacher-mode-picker">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{tr({ zh: '战队', en: 'Team' })}</span>
            <ListSelect
              className="wca-team-select"
              ariaLabel={tr({ zh: '战队', en: 'Team' })}
              allLabel={tr({ zh: '未设置', en: 'Not set' })}
              clearable={false}
              value={selectedValue}
              disabled={saving || !teamDirectory.ready}
              onChange={value => { setSelected(value); setTeamChanged(true); }}
              items={[
                { value: '', label: tr({ zh: '未设置', en: 'Not set' }) },
                ...teamDirectory.teams.map(item => ({ value: String(item.id), label: item.name, icon: <CubingBrandLabel name={item.name} logoOnly /> })),
                { value: 'custom', label: tr({ zh: '添加战队…', en: 'Add team…' }) },
              ]}
            />
          </div>
          {selectedValue === 'custom' && <SearchInput value={custom} onChange={setCustom} maxLength={80} disabled={saving} autoFocus placeholder={tr({ zh: '战队名称', en: 'Team name' })} ariaLabel={tr({ zh: '战队名称', en: 'Team name' })} />}
          {teamDirectory.failed && <button type="button" className="wca-teacher-action" onClick={teamDirectory.retry}>{tr({ zh: '加载失败，重试', en: 'Load failed, retry' })}</button>}
        </div>,
      } : undefined}
    /></td>
    <td><div className="wca-teacher-cell"><span className="wca-teacher-value" title={teamDirectory.ready ? team?.name : undefined}>
      {teamDirectory.failed ? <button type="button" className="wca-teacher-action" onClick={teamDirectory.retry}>{tr({ zh: '加载失败，重试', en: 'Load failed, retry' })}</button> : teamDirectory.ready ? team ? <CubingBrandLabel name={team.name} logoOnly fallbackToName /> : '—' : '…'}
    </span></div></td>
  </>;
}
