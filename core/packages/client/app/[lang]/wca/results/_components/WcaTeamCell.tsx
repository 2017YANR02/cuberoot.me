'use client';
import { useWcaTeams } from '@/hooks/useWcaTeams';
export { useWcaTeams } from '@/hooks/useWcaTeams';

import { useState } from 'react';
import { WcaTeacherCell, type WcaTeacherDirectory } from '@/components/WcaTeacherCell';
import { ListSelect } from '@/components/ListSelect';
import { wcaTeamSelectItems } from '@/components/wca-team-select-items';
import { SearchInput } from '@/components/SearchInput';
import { ClearButton } from '@/components/ClearButton';
import { CubingBrandLabel } from '@/components/CubingBrandLabel';
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
  const [names, setNames] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const [teamChanged, setTeamChanged] = useState(false);
  const teamIds = new Set(teamDirectory.assignments.filter(item => item.wcaId === wcaId).map(item => item.teamId));
  const currentNames = teamDirectory.teams.filter(item => teamIds.has(item.id)).map(item => item.name);
  const selectedNames = teamChanged ? names : currentNames;
  const teamItems = wcaTeamSelectItems(teamDirectory.teams.filter(team => !selectedNames.includes(team.name)), 'edit');
  const customName = custom.replace(/\s+/g, ' ').trim();
  return <>
    <td><WcaTeacherCell studentWcaId={wcaId} eventIds={eventIds} directory={teacherDirectory} isZh={isZh} visibleTeacherWcaId={visibleTeacherWcaId}
      additionalEditor={teamDirectory.isAdmin ? {
        title: tr({ zh: '编辑老师、培训机构和战队', en: 'Edit teacher, institution and teams' }),
        onOpen: () => { setNames(currentNames); setSelected(''); setCustom(''); setTeamChanged(false); },
        canSave: teamDirectory.ready && (selected !== 'custom' || !!customName),
        save: async () => {
          if (teamChanged || selected === 'custom') {
            await teamDirectory.save(wcaId, selected === 'custom' ? [...selectedNames, customName] : selectedNames);
          }
        },
        render: saving => <div className="wca-teacher-mode-picker">
          {selectedNames.map(name => <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CubingBrandLabel name={name} />
            <ClearButton variant="standalone" disabled={saving || !teamDirectory.ready}
              ariaLabel={tr({ zh: `移除战队：${name}`, en: `Remove team: ${name}` })}
              onClick={() => { setNames(selectedNames.filter(item => item !== name)); setTeamChanged(true); }} />
          </div>)}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{tr({ zh: '战队', en: 'Teams' })}</span>
            <ListSelect
              className="wca-team-select"
              ariaLabel={tr({ zh: '战队', en: 'Team' })}
              allLabel={tr({ zh: '添加战队…', en: 'Add team…' })}
              clearable={false}
              value={selected}
              disabled={saving || !teamDirectory.ready}
              onChange={value => {
                if (value === 'custom') { setSelected(value); return; }
                const team = teamDirectory.teams.find(item => String(item.id) === value);
                if (team) { setNames([...selectedNames, team.name]); setTeamChanged(true); }
                setSelected(''); setCustom('');
              }}
              items={[
                ...teamItems,
                { value: 'custom', label: tr({ zh: '自定义战队…', en: 'Custom team…' }) },
              ]}
            />
          </div>
          {selected === 'custom' && <SearchInput value={custom} onChange={setCustom} maxLength={80} disabled={saving} autoFocus placeholder={tr({ zh: '战队名称', en: 'Team name' })} ariaLabel={tr({ zh: '战队名称', en: 'Team name' })} />}
          {teamDirectory.failed && <button type="button" className="wca-teacher-action" onClick={teamDirectory.retry}>{tr({ zh: '加载失败，重试', en: 'Load failed, retry' })}</button>}
        </div>,
      } : undefined}
    /></td>
  </>;
}
