'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Globe, Link2, LockKeyhole, Settings, Trash2, UserRound, Users } from '@app-foundation/icons/lucide';
import BoolToggle from '@/components/BoolToggle';
import { ClearButton } from '@/components/ClearButton';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { T, tr } from '@/i18n/tr';
import {
  addDocumentMember, removeDocumentMember, searchDocumentPeople, updateDocumentMember,
  updateDocumentSharing, DEFAULT_DOCUMENT_SHARING,
  type DocumentDetails, type DocumentPerson, type DocumentRole, type DocumentSharing,
} from '@/lib/document-api';
import './collaborative-share.css';

type MemberRole = Exclude<DocumentRole, 'owner'>;
function RoleOptions() {
  return <><option value="viewer">{tr({ zh: '查看者', en: 'Viewer' })}</option><option value="commenter">{tr({ zh: '评论者', en: 'Commenter' })}</option><option value="editor">{tr({ zh: '编辑者', en: 'Editor' })}</option></>;
}

export function CollaborativeSharePanel({ id, kind, details, reload, close }: {
  id: string; kind: 'document' | 'spreadsheet'; details: DocumentDetails;
  reload: () => Promise<void>; close: () => void;
}) {
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<DocumentPerson[]>([]);
  const [person, setPerson] = useState<DocumentPerson | null>(null);
  const [role, setRole] = useState<MemberRole>('editor');
  const [sharing, setSharing] = useState<DocumentSharing>(details.sharing ?? DEFAULT_DOCUMENT_SHARING);
  const [settings, setSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const backdrop = useModalDismiss(close);
  const owner = details.document.role === 'owner';
  const dirty = JSON.stringify(sharing) !== JSON.stringify(details.sharing ?? DEFAULT_DOCUMENT_SHARING);
  useEffect(() => {
    if (query.trim().length < 2 || person) { setPeople([]); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      void searchDocumentPeople(query.trim()).then(result => { if (active) setPeople(result); })
        .catch(cause => { if (active) setError((cause as Error).message); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, person]);
  const mutate = async (action: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await action(); await reload(); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };
  const finish = async () => {
    if (!dirty) { close(); return; }
    setBusy(true); setError('');
    try { await updateDocumentSharing(id, sharing); await reload(); close(); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };
  const copyLink = async () => {
    try {
      const url = new URL(window.location.href);
      url.pathname = url.pathname.replace(/\/(docs|sheets)\/edit$/, `/${kind === 'document' ? 'docs' : 'sheets'}/edit`);
      url.search = new URLSearchParams({ id }).toString(); url.hash = '';
      await navigator.clipboard.writeText(url.href);
      setNotice(tr({ zh: '链接已复制', en: 'Link copied' }));
    } catch { setError(tr({ zh: '复制失败，请复制浏览器地址栏中的链接', en: 'Copy failed. Copy the link from your address bar.' })); }
  };
  const AccessIcon = sharing.access === 'anyone' ? Globe : sharing.access === 'admins' ? Users : LockKeyhole;
  return <div className="collab-share-backdrop" role="presentation" {...backdrop}>
    <section className="collab-share" data-site-surface="popover" role="dialog" aria-modal="true" aria-labelledby="collab-share-title" aria-busy={busy}>
      <div className="collab-share-head">
        {settings && <button className="collab-icon-button" type="button" onClick={() => setSettings(false)} aria-label={tr({ zh: '返回共享', en: 'Back to sharing' })}><ArrowLeft size={20} /></button>}
        <h2 id="collab-share-title">{settings ? tr({ zh: `“${details.document.title}”的设置`, en: `Settings for “${details.document.title}”` }) : tr({ zh: `共享“${details.document.title}”`, en: `Share “${details.document.title}”` })}</h2>
        {owner && !settings && <button className="collab-icon-button" type="button" onClick={() => setSettings(true)} aria-label={tr({ zh: '共享设置', en: 'Sharing settings' })}><Settings size={20} /></button>}
        <ClearButton variant="standalone" ariaLabel={tr({ zh: '关闭', en: 'Close' })} onClick={close} />
      </div>
      {settings ? <div className="collab-settings">
        <h3><T zh="访问" en="Access" /></h3>
        <BoolToggle value={sharing.editorsCanShare} disabled={busy} onChange={value => setSharing({ ...sharing, editorsCanShare: value })} label={tr({ zh: '允许编辑者更改权限和共享内容', en: 'Allow editors to change permissions and share' })} />
        <h3><T zh="可以下载、复制和打印的人员" en="People who can download, copy and print" /></h3>
        <BoolToggle value={sharing.editorsCanExport} disabled={busy} onChange={value => setSharing({ ...sharing, editorsCanExport: value })} label={tr({ zh: '编辑者', en: 'Editors' })} />
        <BoolToggle value={sharing.viewersCanExport} disabled={busy} onChange={value => setSharing({ ...sharing, viewersCanExport: value })} label={tr({ zh: '评论者和查看者', en: 'Commenters and viewers' })} />
      </div> : <>
        {details.canManage && <>
          <div className="collab-invite-row">
            <label className="collab-search-wrap"><span className="sr-only"><T zh="添加人员" en="Add people" /></span><input className="collab-search-input" value={person?.name ?? query} readOnly={!!person} disabled={busy} onChange={event => setQuery(event.target.value)} placeholder={tr({ zh: '添加人员：姓名或 WCA ID', en: 'Add people by name or WCA ID' })} />{(query || person) && <ClearButton onClick={() => { setQuery(''); setPerson(null); }} preserveFocus />}</label>
            {person && <select className="collab-role-select" value={role} disabled={busy} onChange={event => setRole(event.target.value as MemberRole)} aria-label={tr({ zh: '邀请权限', en: 'Invite role' })}><RoleOptions /></select>}
          </div>
          {person ? <div className="collab-invite-actions"><button className="collab-button collab-primary" type="button" disabled={busy} onClick={() => void mutate(async () => { await addDocumentMember(id, person.key, role); setPerson(null); setQuery(''); })}><T zh="添加" en="Add" /></button></div>
            : people.length > 0 && <div className="collab-people-results">{people.map(item => <button className="collab-person-option" key={item.key} type="button" onClick={() => setPerson(item)} disabled={busy}><UserRound size={18} /><span>{item.name}</span>{item.wcaId && <small>{item.wcaId}</small>}</button>)}</div>}
        </>}
        <h3><T zh="有访问权限的人" en="People with access" /></h3>
        <div className="collab-member-list">{details.members.map(member => <div className="collab-member" key={member.key}>
          <span className="collab-avatar">{member.avatar ? <img src={member.avatar} alt="" /> : <UserRound size={20} />}</span>
          <span className="collab-member-name">{member.name}</span>
          {member.role === 'owner' ? <span className="collab-member-role"><T zh="所有者" en="Owner" /></span> : <>
            <select className="collab-role-select" value={member.role} disabled={busy || !details.canManage} onChange={event => void mutate(() => updateDocumentMember(id, member.key, event.target.value as MemberRole))} aria-label={tr({ zh: `${member.name} 的权限`, en: `Role for ${member.name}` })}><RoleOptions /></select>
            {details.canManage && <button className="collab-icon-button collab-remove" type="button" disabled={busy} onClick={() => void mutate(() => removeDocumentMember(id, member.key))} aria-label={tr({ zh: `移除 ${member.name}`, en: `Remove ${member.name}` })}><Trash2 size={16} /></button>}
          </>}
        </div>)}</div>
        <h3><T zh="常规访问权限" en="General access" /></h3>
        <div className="collab-access-row">
          <span className="collab-avatar"><AccessIcon size={22} /></span>
          <div className="collab-access-description">
            <select className="collab-access-select" value={sharing.access} disabled={busy || !details.canManage} onChange={event => setSharing({ ...sharing, access: event.target.value as DocumentSharing['access'] })} aria-label={tr({ zh: '常规访问权限', en: 'General access' })}>
              <option value="restricted">{tr({ zh: '受限', en: 'Restricted' })}</option><option value="admins">{tr({ zh: '所有管理员', en: 'All administrators' })}</option><option value="anyone">{tr({ zh: '知道链接的任何人', en: 'Anyone with the link' })}</option>
            </select>
            <p>{sharing.access === 'restricted' ? tr({ zh: '只有已添加的人员可以访问', en: 'Only people with access can open this file' }) : sharing.access === 'admins' ? tr({ zh: '本站所有管理员均可访问', en: 'All site administrators can access this file' }) : tr({ zh: '知道链接的任何人均可访问，无需登录', en: 'Anyone with the link can access this file without signing in' })}</p>
          </div>
          {sharing.access !== 'restricted' && <select className="collab-role-select" value={sharing.role} disabled={busy || !details.canManage} onChange={event => setSharing({ ...sharing, role: event.target.value as MemberRole })} aria-label={tr({ zh: '常规访问角色', en: 'General access role' })}><RoleOptions /></select>}
        </div>
      </>}
      {error && <p className="collab-error" role="alert">{error}</p>}
      {notice && <p className="collab-member-role" role="status">{notice}</p>}
      <div className="collab-share-footer">
        <button className="collab-button" type="button" onClick={() => void copyLink()}><Link2 size={17} /><T zh="复制链接" en="Copy link" /></button>
        <button className="collab-button collab-primary" type="button" disabled={busy} onClick={() => void finish()}>{busy ? tr({ zh: '正在保存…', en: 'Saving…' }) : dirty ? tr({ zh: '保存', en: 'Save' }) : tr({ zh: '完成', en: 'Done' })}</button>
      </div>
    </section>
  </div>;
}
