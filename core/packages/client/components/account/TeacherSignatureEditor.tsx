'use client';

import { useEffect, useId, useState } from 'react';
import { formatTeacherSignature, parseTeacherSignature, type TeacherSignature } from '@cuberoot/shared/account';
import { CompactSelect } from '@/components/CompactSelect';
import { fetchTeacherSignature, updateTeacherSignature } from '@/lib/account-api';
import { displayCuberName } from '@/lib/cuber-name-display';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';

/** Mounted with an account key so drafts never cross account switches. */
export default function TeacherSignatureEditor({ uid, name }: { uid: number; name: string }) {
  const t = useT();
  const lang = useLang();
  const id = useId();
  const [draft, setDraft] = useState<TeacherSignature | null>(null);
  const [savedValue, setSavedValue] = useState<TeacherSignature | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    fetchTeacherSignature(controller.signal).then(value => {
      if (!controller.signal.aborted) { setDraft(value); setSavedValue(value); }
    }).catch(() => {
      if (!controller.signal.aborted) setError(t('暂时无法读取署名设置，请重试。', 'Could not load your signature. Try again.'));
    });
    return () => controller.abort();
  }, [uid, retry, t]);
  const update = (value: TeacherSignature) => { setDraft(value); setSaved(false); setError(''); };
  const save = async () => {
    const signature = parseTeacherSignature(draft);
    if (!signature) { setError(t('机构简称最多 40 个字，不能包含换行。', 'Use up to 40 characters without line breaks.')); return; }
    setSaving(true); setError(''); setSaved(false);
    try {
      const result = await updateTeacherSignature(signature, uid);
      setDraft(result.teacherSignature); setSavedValue(result.teacherSignature); setSaved(true);
    } catch { setError(t('署名保存失败，请重试。', 'Could not save your signature. Try again.')); }
    finally { setSaving(false); }
  };
  const changed = draft?.mode !== savedValue?.mode || draft?.organization !== savedValue?.organization;
  return <form className="account-basic-profile account-signature-form" onSubmit={event => { event.preventDefault(); void save(); }}>
    <h3 className="account-creds-title">{t('教师署名', 'Teacher display name')}</h3>
    <p className="auth-hint">{t('你作为老师时，在师生关系中显示的名称。', 'The name shown for you as a teacher in teacher–student relationships.')}</p>
    {!draft && !error && <p className="auth-hint">{t('加载中…', 'Loading…')}</p>}
    {draft && <>
      <div className="account-signature-controls">
      <CompactSelect label={{ name: t('仅姓名', 'Name only'), organization: t('仅机构名', 'Organization only'), both: t('姓名＋机构', 'Name + organization') }[draft.mode]} ariaLabel={t('署名方式', 'Signature format')} value={draft.mode} disabled={saving}
        onChange={value => update({ ...draft, mode: value as TeacherSignature['mode'] })}
        items={[
          { value: 'name', label: t('仅姓名', 'Name only') },
          { value: 'organization', label: t('仅机构名', 'Organization only') },
          { value: 'both', label: t('姓名＋机构', 'Name + organization') },
        ]} />
      <button type="submit" className="auth-primary account-basic-profile-save" disabled={saving || !changed}>{saving ? t('保存中…', 'Saving…') : t('保存', 'Save')}</button>
      </div>
      {draft.mode !== 'name' && <div className="account-basic-profile-field">
        <label className="auth-label" htmlFor={id}>{t('机构简称', 'Organization short name')}</label>
        <input id={id} className="auth-input" value={draft.organization} maxLength={40} disabled={saving}
          onChange={event => update({ ...draft, organization: event.target.value })} />
      </div>}
      <p className="auth-hint">{t('显示预览：', 'Preview: ')}{formatTeacherSignature(displayCuberName(name, lang === 'zh'), draft)}</p>
      {saved && <p className="auth-hint" role="status">{t('已保存', 'Saved')}</p>}
    </>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    {!draft && error && <button type="button" className="auth-primary account-basic-profile-save" onClick={() => setRetry(value => value + 1)}>{t('重试', 'Retry')}</button>}
  </form>;
}
