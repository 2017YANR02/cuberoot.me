'use client';

import { useState } from 'react';
import { isAdminWcaId } from '@cuberoot/shared/admin';
import { useAuthUser } from '@/lib/auth-store';
import { deleteAdminUser, type SessionUser } from '@/lib/account-api';
import { useT } from '@/hooks/useT';

export default function AdminAccountDelete({ profile, onDeleted }: { profile: SessionUser; onDeleted: () => void }) {
  const t = useT();
  const actor = useAuthUser();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!actor || !isAdminWcaId(actor.wcaId) || actor.uid === profile.uid || isAdminWcaId(profile.wcaId)) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || confirmation !== String(profile.uid)) return;
    setBusy(true);
    setError('');
    try {
      await deleteAdminUser(profile.uid, confirmation);
      onDeleted();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      setError(message.includes('transfer organization ownership')
        ? t('请先转移该账号的机构所有权。', 'Transfer this account’s organization ownership first.')
        : message.includes('cancel automatic renewal')
          ? t('请先取消该账号的自动续费合约。', 'Cancel this account’s automatic renewal contracts first.')
          : t('未能确认删除成功，请刷新核对账号状态后再试。', 'Deletion could not be confirmed. Refresh to check the account status before trying again.'));
    } finally {
      setBusy(false);
    }
  }

  return <section className="account-admin-delete">
    {!open ? <button type="button" className="auth-textbtn" onClick={() => setOpen(true)}>{t('删除账号', 'Delete account')}</button> : (
      <form onSubmit={submit}>
        <h2 className="account-creds-title">{t('删除账号', 'Delete account')}</h2>
        <p className="auth-hint">{t(`永久删除“${profile.name}”（UID ${profile.uid}）及私有数据，包括双方好友聊天记录。公开内容匿名保留。此操作无法撤销。`, `Permanently delete “${profile.name}” (UID ${profile.uid}) and private data, including friend conversations for both participants. Public content remains anonymized. This cannot be undone.`)}</p>
        <label className="auth-label" htmlFor="admin-delete-confirm">{t('输入该用户的 ID 确认删除', 'Enter this user’s ID to confirm deletion')}</label>
        <input id="admin-delete-confirm" className="auth-input" inputMode="numeric" autoComplete="off" value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <div className="account-admin-delete-actions">
          <button type="submit" className="auth-danger" disabled={busy || confirmation !== String(profile.uid)}>{busy ? t('删除中…', 'Deleting…') : t('永久删除账号', 'Permanently delete account')}</button>
          <button type="button" className="auth-textbtn" disabled={busy} onClick={() => { setOpen(false); setConfirmation(''); setError(''); }}>{t('取消', 'Cancel')}</button>
        </div>
      </form>
    )}
  </section>;
}
