'use client';
import { useWcaTeams } from '@/hooks/useWcaTeams';
export { useWcaTeams } from '@/hooks/useWcaTeams';

import { useState } from 'react';
import { WcaTeacherCell, type WcaTeacherDirectory } from '@/components/WcaTeacherCell';
import { ListSelect } from '@/components/ListSelect';
import { wcaTeamSelectItems } from '@/components/wca-team-select-items';
import { SearchInput } from '@/components/SearchInput';
import { tr } from '@/i18n/tr';
import '@/components/wca-teacher-cell.css';
import './wca-team-cell.css';


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
  const teamItems = wcaTeamSelectItems(teamDirectory.teams, "edit", selectedValue);
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
                ...teamItems,
                { value: 'custom', label: tr({ zh: '添加战队…', en: 'Add team…' }) },
              ]}
            />
          </div>
          {selectedValue === 'custom' && <SearchInput value={custom} onChange={setCustom} maxLength={80} disabled={saving} autoFocus placeholder={tr({ zh: '战队名称', en: 'Team name' })} ariaLabel={tr({ zh: '战队名称', en: 'Team name' })} />}
          {teamDirectory.failed && <button type="button" className="wca-teacher-action" onClick={teamDirectory.retry}>{tr({ zh: '加载失败，重试', en: 'Load failed, retry' })}</button>}
        </div>,
      } : undefined}
    /></td>
  </>;
}
