'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import {
  createTeachingStudentAccountBindingInvite,
  getCurrentTeachingStudentAccountBindingInvite,
  revokeTeachingStudentAccountBindingInvite,
} from '@/lib/teaching-saas-api';
import type { TeachingStudentAccountBindingInvite } from '@cuberoot/shared/teaching';
import { MutationMessage, teachingErrorMessage, useOperationKey } from './OrgUi';

export default function StudentAccountBindingManager({ orgSlug, studentId, linked }: { orgSlug: string; studentId: string; linked: boolean }) {
  const t = useT();
  const operationKey = useOperationKey();
  const [invite, setInvite] = useState<TeachingStudentAccountBindingInvite | null>(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setInvite(await getCurrentTeachingStudentAccountBindingInvite(orgSlug, studentId));
    } catch (reason) {
      setError(teachingErrorMessage(reason, t));
    } finally {
      setLoading(false);
    }
  }, [orgSlug, studentId, t]);

  useEffect(() => { void load(); }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const minutes = Number(new FormData(event.currentTarget).get('expiresInMinutes'));
    setSubmitting(true); setMessage(''); setError(''); setToken('');
    try {
      const result = await createTeachingStudentAccountBindingInvite(orgSlug, studentId, minutes);
      setInvite(result.invite);
      setToken(result.token);
      setMessage(t('绑定链接已生成。令牌只显示这一次。', 'Binding link created. The token is shown only once.'));
    } catch (reason) {
      setError(teachingErrorMessage(reason, t));
    } finally {
      setSubmitting(false);
    }
  }

  async function revoke() {
    if (!invite) return;
    setSubmitting(true); setMessage(''); setError('');
    try {
      setInvite(await revokeTeachingStudentAccountBindingInvite(orgSlug, studentId, invite.id, operationKey.get()));
      operationKey.reset();
      setToken('');
      setMessage(t('绑定邀请已撤销。', 'Binding invitation revoked.'));
    } catch (reason) {
      setError(teachingErrorMessage(reason, t));
    } finally {
      setSubmitting(false);
    }
  }

  const bindingHref = token ? `/account/student-binding#token=${encodeURIComponent(token)}&org=${encodeURIComponent(orgSlug)}` : '';
  return (
    <section className="org-section">
      <h2>{t('主站学习账号', 'Main-site learner account')}</h2>
      {linked ? (
        <><p className="org-lead">{t('该学员已绑定主站账号，可直接接收任务和回传训练证据。', 'This student is linked and can receive assignments and report training evidence.')}</p><AppLink href={`/training/${orgSlug}`} prefetch={false}>{t('打开学员训练入口', 'Open learner training')}</AppLink></>
      ) : loading ? <p aria-busy="true">{t('正在读取绑定状态…', 'Loading binding status…')}</p> : (
        <>
          {invite?.status === 'pending' && <p className="org-lead">{t(`已有待使用邀请，有效至 ${new Date(invite.expiresAt).toLocaleString()}。`, `A pending invitation expires at ${new Date(invite.expiresAt).toLocaleString()}.`)}</p>}
          <form className="org-form" onSubmit={create}>
            <fieldset disabled={submitting}>
              <label>{t('邀请有效期', 'Invitation expiry')}
                <select className="org-form-control" name="expiresInMinutes" defaultValue="1440"><option value="60">{t('1 小时', '1 hour')}</option><option value="1440">{t('1 天', '1 day')}</option><option value="10080">{t('7 天', '7 days')}</option></select>
              </label>
              <div className="org-form-actions"><button className="org-form-button" type="submit">{submitting ? t('生成中…', 'Creating…') : t('生成绑定邀请', 'Create binding invitation')}</button>{invite?.status === 'pending' && <button className="org-form-button org-secondary-button" type="button" onClick={revoke}>{t('撤销当前邀请', 'Revoke current invitation')}</button>}</div>
            </fieldset>
          </form>
          {token && <div className="org-subsection"><p className="org-help">{t('请让学员登录自己的主站账号后打开此链接并确认。不要通过日志或公开页面传递令牌。', 'Ask the student to sign in with their own main-site account, then open and confirm this link. Do not expose the token in logs or public pages.')}</p><AppLink className="org-primary-link" href={bindingHref} prefetch={false}>{t('打开一次性绑定页面', 'Open one-time binding page')}</AppLink></div>}
        </>
      )}
      <MutationMessage message={error || message} error={!!error} />
    </section>
  );
}
