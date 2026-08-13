'use client';

import { useEffect, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { ClearButton } from '@/components/ClearButton';
import { T, tr } from '@/i18n/tr';
import {
  addDocumentMember, removeDocumentMember, searchDocumentPeople, updateDocumentMember,
  type DocumentDetails, type DocumentPerson, type DocumentRole,
} from '@/lib/document-api';
import './collaborative-share.css';

function roleLabel(role: DocumentRole) {
  if (role === 'owner') return tr({ zh: '所有者', en: 'Owner' });
  if (role === 'editor') return tr({ zh: '可编辑', en: 'Editor' });
  return tr({ zh: '只读', en: 'Viewer' });
}

export function CollaborativeSharePanel({ id, kind, details, reload, close }: {
  id: string;
  kind: 'document' | 'spreadsheet';
  details: DocumentDetails;
  reload: () => Promise<void>;
  close: () => void;
}) {
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<DocumentPerson[]>([]);
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (query.trim().length < 2) { setPeople([]); return; }
    const timer = window.setTimeout(() => searchDocumentPeople(query.trim()).then(setPeople).catch((cause) => setError((cause as Error).message)), 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  const add = async (person: DocumentPerson) => {
    setBusy(person.key); setError('');
    try { await addDocumentMember(id, person.key, role); setQuery(''); setPeople([]); await reload(); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(''); }
  };
  const changeRole = async (key: string, nextRole: 'editor' | 'viewer') => {
    setBusy(key); setError('');
    try { await updateDocumentMember(id, key, nextRole); await reload(); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(''); }
  };
  const remove = async (key: string) => {
    setBusy(key); setError('');
    try { await removeDocumentMember(id, key); await reload(); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(''); }
  };
  const title = kind === 'spreadsheet' ? tr({ zh: '共享表格', en: 'Share spreadsheet' }) : tr({ zh: '共享文档', en: 'Share document' });
  return <div className="collab-share-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className="collab-share" role="dialog" aria-modal="true" aria-labelledby="collab-share-title">
      <div className="collab-share-head"><h2 id="collab-share-title">{title}</h2><ClearButton variant="standalone" ariaLabel={tr({ zh: '关闭', en: 'Close' })} onClick={close} /></div>
      <div className="collab-invite-row">
        <label className="collab-search-wrap"><span className="sr-only"><T zh="搜索用户" en="Search people" /></span><input className="collab-search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr({ zh: '姓名或 WCA ID', en: 'Name or WCA ID' })} autoFocus />{query && <ClearButton onClick={() => setQuery('')} preserveFocus />}</label>
        <select className="collab-role-select" value={role} onChange={(event) => setRole(event.target.value as 'editor' | 'viewer')} aria-label={tr({ zh: '邀请权限', en: 'Invite role' })}><option value="editor">{tr({ zh: '可编辑', en: 'Editor' })}</option><option value="viewer">{tr({ zh: '只读', en: 'Viewer' })}</option></select>
      </div>
      {people.length > 0 && <div className="collab-people-results">{people.map((person) => <button className="collab-person-option" key={person.key} type="button" onClick={() => void add(person)} disabled={busy === person.key}><UserPlus size={16} /><span>{person.name}</span>{person.wcaId && <small>{person.wcaId}</small>}</button>)}</div>}
      {error && <p className="collab-error" role="alert">{error}</p>}
      <h3><T zh="已有成员" en="People with access" /></h3>
      <div className="collab-member-list">{details.members.map((member) => <div className="collab-member" key={member.key}><span className="collab-member-name">{member.name}</span>{member.role === 'owner' ? <span className="collab-member-role">{roleLabel(member.role)}</span> : <><select className="collab-role-select" value={member.role} disabled={busy === member.key} onChange={(event) => void changeRole(member.key, event.target.value as 'editor' | 'viewer')} aria-label={tr({ zh: `${member.name} 的权限`, en: `Role for ${member.name}` })}><option value="editor">{tr({ zh: '可编辑', en: 'Editor' })}</option><option value="viewer">{tr({ zh: '只读', en: 'Viewer' })}</option></select><button type="button" className="collab-remove" onClick={() => void remove(member.key)} disabled={busy === member.key} aria-label={tr({ zh: `移除 ${member.name}`, en: `Remove ${member.name}` })}><Trash2 size={16} /></button></>}</div>)}</div>
    </section>
  </div>;
}
