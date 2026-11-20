'use client';

import { useState } from 'react';
import type { WcaPersonLite } from '@cuberoot/shared/wca-person';
import { SearchInput } from '@/components/SearchInput';
import { WcaPersonPicker } from '@/components/WcaPersonPicker';
import { tr } from '@/i18n/tr';
import { addWcaTeamMember, type WcaTeam } from '@/lib/wca-teams-api';

export default function AddTeamMemberForm({ teams, initialTeam, isZh, onCancel, onSaved }: {
  teams: WcaTeam[];
  initialTeam: string;
  isZh: boolean;
  onCancel: () => void;
  onSaved: (teamId: string) => void;
}) {
  const [teamId, setTeamId] = useState(initialTeam);
  const [mode, setMode] = useState('wca');
  const [person, setPerson] = useState<WcaPersonLite | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const memberName = name.trim();
  const identity = mode === 'wca' ? (person && { wcaId: person.id }) : (memberName ? { name: memberName } : null);

  async function addMember() {
    if (!teamId || !identity || saving) return;
    setFailed(false);
    setSaving(true);
    try {
      await addWcaTeamMember(Number(teamId), identity);
      onSaved(teamId);
    } catch {
      setFailed(true);
      setSaving(false);
    }
  }

  return <section className="wca-team-add-form" aria-label={tr({ zh: '添加成员', en: 'Add member' })}>
    <label>
      {tr({ zh: '战队', en: 'Team' })}
      <select className="native-select" value={teamId} onChange={event => setTeamId(event.target.value)} disabled={saving}>
        <option value="">{tr({ zh: '选择战队', en: 'Select a team' })}</option>
        {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
      </select>
    </label>
    <label>
      {tr({ zh: '成员类型', en: 'Member type' })}
      <select className="native-select" value={mode} onChange={event => setMode(event.target.value)} disabled={saving}>
        <option value="wca">{tr({ zh: '有 WCA ID', en: 'Has a WCA ID' })}</option>
        <option value="name">{tr({ zh: '暂无 WCA ID', en: 'No WCA ID yet' })}</option>
      </select>
    </label>
    <div className="wca-team-add-person">
      {mode === 'wca'
        ? <WcaPersonPicker value={person} onChange={setPerson} isZh={isZh} disabled={saving}
            placeholder={tr({ zh: '姓名或 WCA ID', en: 'Name or WCA ID' })} />
        : <SearchInput value={name} onChange={setName} maxLength={80} disabled={saving}
            placeholder={tr({ zh: '成员姓名', en: 'Member name' })} ariaLabel={tr({ zh: '成员姓名', en: 'Member name' })} />}
    </div>
    <div className="wca-team-add-actions">
      <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>{tr({ zh: '取消', en: 'Cancel' })}</button>
      <button type="button" className="btn-primary" onClick={addMember} disabled={saving || !teamId || !identity}>{tr(saving
        ? { zh: '添加中…', en: 'Adding…' }
        : { zh: '确认添加', en: 'Add member' })}</button>
    </div>
    {failed && <p className="wse-state-error" role="alert">{tr({
      zh: '未能确认添加结果。请先检查成员名单，再决定是否重试。',
      en: 'Could not confirm the result. Check the roster before retrying.',
    })}</p>}
  </section>;
}
