'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil } from 'lucide-react';
import { isAdminWcaId } from '@cuberoot/shared/admin';
import { useAuthUser } from '@/lib/auth-store';
import { listWcaTeams, saveWcaTeam, type WcaTeamsResponse } from '@/lib/wca-teams-api';
import { useModalBackdrop } from '@/hooks/useModalDismiss';
import { SearchInput } from '@/components/SearchInput';
import { tr } from '@/i18n/tr';
import '@/components/wca-teacher-cell.css';

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
    for (let i = 0; i < ids.length; i += 100) requests.push(listWcaTeams(ids.slice(i, i + 100)));
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
      const { team } = await saveWcaTeam(wcaId, name);
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

export function WcaTeamCell({ wcaId, directory }: { wcaId: string; directory: ReturnType<typeof useWcaTeams> }) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState('');
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const backdropProps = useModalBackdrop(() => setEditing(false), saving);
  const teamId = directory.assignments.find(item => item.wcaId === wcaId)?.teamId;
  const team = directory.teams.find(item => item.id === teamId);
  const name = selected === 'custom' ? custom.trim() : directory.teams.find(item => String(item.id) === selected)?.name ?? '';
  const title = tr({ zh: '编辑战队', en: 'Edit team' });
  const save = async () => {
    setSaving(true);
    setError(false);
    try {
      await directory.save(wcaId, name);
      setEditing(false);
    } catch { setError(true); }
    finally { setSaving(false); }
  };
  return <div className="wca-teacher-cell">
    <span className="wca-teacher-value" title={directory.ready ? team?.name : undefined}>
      {directory.failed ? <button type="button" className="wca-teacher-action" onClick={directory.retry}>{tr({ zh: '加载失败，重试', en: 'Load failed, retry' })}</button> : directory.ready ? team?.name ?? '—' : '…'}
    </span>
    {directory.isAdmin && directory.ready && <button type="button" className="wca-teacher-action wca-teacher-edit-action" aria-label={title} title={title} onClick={() => {
      setSelected(team ? String(team.id) : ''); setCustom(''); setError(false); setEditing(true);
    }}><Pencil size={14} aria-hidden="true" /></button>}
    {editing && createPortal(<div className="wca-teacher-dialog-layer" {...backdropProps}>
      <dialog open aria-modal="true" aria-labelledby={`team-title-${wcaId}`} className="wca-teacher-dialog" onKeyDown={event => { if (event.key === 'Escape' && !saving) setEditing(false); }}>
        <h2 id={`team-title-${wcaId}`}>{title}</h2>
        <select className="native-select" aria-label={tr({ zh: '战队', en: 'Team' })} value={selected} disabled={saving} onChange={event => setSelected(event.target.value)}>
          <option value="">{tr({ zh: '未设置', en: 'Not set' })}</option>
          {directory.teams.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          <option value="custom">{tr({ zh: '添加战队…', en: 'Add team…' })}</option>
        </select>
        {selected === 'custom' && <SearchInput value={custom} onChange={setCustom} maxLength={80} disabled={saving} autoFocus placeholder={tr({ zh: '战队名称', en: 'Team name' })} ariaLabel={tr({ zh: '战队名称', en: 'Team name' })} />}
        {error && <p role="alert" className="wca-teacher-dialog-error">{tr({ zh: '保存失败，请重试', en: 'Save failed. Please try again.' })}</p>}
        <div className="wca-teacher-dialog-actions">
          <button type="button" className="wca-teacher-dialog-action" disabled={saving || (selected === 'custom' && !name)} onClick={() => void save()}>{saving ? tr({ zh: '保存中…', en: 'Saving…' }) : tr({ zh: '保存', en: 'Save' })}</button>
          <button type="button" className="wca-teacher-dialog-action" disabled={saving} onClick={() => setEditing(false)}>{tr({ zh: '取消', en: 'Cancel' })}</button>
        </div>
      </dialog>
    </div>, document.body)}
  </div>;
}
