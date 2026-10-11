'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { EnterpriseVerificationState, EnterpriseVerificationStatus } from '@cuberoot/shared/teaching';
import BoolToggle from '@/components/BoolToggle';
import { useT } from '@/hooks/useT';
import { applyEnterpriseVerification, EnterpriseVerificationError, getEnterpriseVerification, submitEnterpriseTransfer } from '@/lib/enterprise-verification-api';
import { MutationMessage, useOperationKey } from './OrgUi';

export function verificationStatus(status: EnterpriseVerificationStatus, t: ReturnType<typeof useT>) {
  const labels: Record<EnterpriseVerificationStatus, string> = {
    awaiting_transfer: t('待对公打款', 'Awaiting bank transfer'), pending_review: t('待审核', 'Under review'),
    verified: t('企业已认证', 'Verified enterprise'), rejected: t('未通过', 'Rejected'),
    expired: t('已过期', 'Expired'), revoked: t('认证已撤销', 'Certification revoked'),
  };
  return labels[status];
}
export function verificationError(error: unknown, t: ReturnType<typeof useT>) {
  const status = error instanceof EnterpriseVerificationError ? error.status : 0;
  if (status === 400) return t('请检查信用代码、材料格式及到账信息是否正确，并完成所有必要确认。', 'Check the credit code, documents and receipt details, and complete the required confirmations.');
  if (status === 401) return t('请重新登录。', 'Please sign in again.');
  if (status === 403) return t('你没有操作权限；申请人及本企业成员不能审核自己的申请。', 'Access denied. Applicants and organization members cannot review their own application.');
  if (status === 409) return t('申请状态已变化，或该企业、银行流水已被使用。请刷新核对；认领已有企业请联系平台。', 'The application changed, or the enterprise or transaction is already in use. Refresh to check; contact support to claim an existing enterprise.');
  if (status === 503 || status === 404) return t('企业认证暂未开放，请稍后再试。', 'Enterprise verification is not available yet.');
  if (status === 429) return t('操作过于频繁，请稍后再试。', 'Too many requests. Please try again later.');
  return t('操作失败，请稍后重试。', 'Request failed. Please try again.');
}

export default function EnterpriseVerification({ orgSlug, name }: { orgSlug: string; name: string }) {
  const t = useT();
  const [state, setState] = useState<EnterpriseVerificationState | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [declared, setDeclared] = useState(false);
  const operation = useOperationKey();
  const load = useCallback(async () => setState(await getEnterpriseVerification(orgSlug)), [orgSlug]);
  useEffect(() => { let active = true; void getEnterpriseVerification(orgSlug).then(value => { if (active) setState(value); }).catch(reason => { if (active) setError(verificationError(reason, t)); }); return () => { active = false; }; }, [orgSlug, t]);
  // Update the displayed deadline without treating an already-submitted application as expired.
  useEffect(() => {
    if (state?.application?.status !== 'awaiting_transfer') return;
    const timer = window.setInterval(() => { if (Date.parse(state.application!.expiresAt) <= Date.now()) void load().catch(() => {}); }, 30_000);
    return () => window.clearInterval(timer);
  }, [state, load]);
  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get('license');
    if (!(file instanceof File) || !['image/png','image/jpeg'].includes(file.type) || file.size > 2 * 1024 * 1024 || file.size === 0) {
      setError(t('请上传不超过 2 MB 的 JPG 或 PNG 营业执照。', 'Upload a JPG or PNG business license up to 2 MB.')); return;
    }
    setBusy(true); setError('');
    try {
      const licenseDataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      const value = (field: string) => String(data.get(field) ?? '').trim();
      const draft = { legalName: value('legalName'), creditCode: value('creditCode'), representative: value('representative'), contactName: value('contactName'), contactPhone: value('contactPhone'), payerAccount: value('payerAccount'), payerBank: value('payerBank'), licenseDataUrl, declaration: true as const };
      const result = await applyEnterpriseVerification(orgSlug, draft, operation.get(JSON.stringify(draft)));
      setState(current => ({ available: current?.available ?? true, application: result.application }));
      operation.reset();
    } catch (reason) { setError(verificationError(reason, t)); }
    finally { setBusy(false); }
  }
  async function submitTransfer() {
    if (!state?.application) return;
    setBusy(true); setError('');
    try { await submitEnterpriseTransfer(orgSlug, state.application.id); await load(); }
    catch (reason) { setError(verificationError(reason, t)); }
    finally { setBusy(false); }
  }
  const application = state?.application;
  const canApply = state?.available && (!application || ['rejected','expired','revoked'].includes(application.status));
  return <section className="org-section enterprise-verification">
    <h2>{t('企业认证', 'Enterprise verification')}</h2>
    <p>{t('核实企业主体及对公账户。品牌授权和学生归属需另外确认。', 'Verify the enterprise and its corporate account. Brand rights and student affiliations require separate confirmation.')}</p>
    <MutationMessage message={error} error />
    {!state && !error && <p aria-busy="true">{t('正在加载…', 'Loading…')}</p>}
    {state && !state.available && !application && <p>{t('对公账户验证暂未开放，企业资料和教学管理仍可正常使用。', 'Corporate account verification is not open yet. Enterprise profiles and teaching tools remain available.')}</p>}
    {application && <div>
      <p><strong>{verificationStatus(application.status, t)}</strong> · {application.legalName}</p>
      {application.reviewNote && <p>{application.reviewNote}</p>}
      {application.refundedAt && <p>{t('验证款已记录退款。', 'A refund of the verification transfer has been recorded.')}</p>}
      {application.status === 'pending_review' && <p>{t('已收到你的打款申报，正在等待核对实际到账和企业材料。', 'Your transfer declaration was submitted. Actual bank receipt and enterprise documents still need to be reviewed.')}</p>}
      {application.status === 'awaiting_transfer' && application.recipient && <>
        <p>{t('请从申请企业的对公账户汇款，付款户名必须与企业全称一致。', 'Transfer from the applying enterprise’s corporate account. The payer name must exactly match its legal name.')}</p>
        <dl>
          <dt>{t('收款户名', 'Recipient name')}</dt><dd>{application.recipient.accountName}</dd>
          <dt>{t('开户行', 'Recipient bank')}</dt><dd>{application.recipient.bankName}</dd>
          <dt>{t('收款账号', 'Recipient account')}</dt><dd style={{ overflowWrap: 'anywhere' }}>{application.recipient.accountNumber}</dd>
          <dt>{t('准确金额', 'Exact amount')}</dt><dd>¥ {(application.amountMinor / 100).toFixed(2)}</dd>
          <dt>{t('转账附言（请完整填写）', 'Transfer reference (copy in full)')}</dt><dd style={{ overflowWrap: 'anywhere' }}>{application.transferReference}</dd>
          <dt>{t('截止时间', 'Deadline')}</dt><dd>{new Date(application.expiresAt).toLocaleString()}</dd>
        </dl>
        <p>{application.recipient.refundNotice}</p>
        <div className="org-form"><button type="button" className="org-form-button" disabled={busy} onClick={() => void submitTransfer()}>{t('我已打款，提交审核', 'I have transferred — submit for review')}</button></div>
      </>}
      {application.status === 'expired' && <p>{t('请勿继续向这笔申请打款。如已转账，请联系平台核对，不要重复打款。', 'Do not transfer for this expired application. If you already paid, contact support before transferring again.')}</p>}
    </div>}
    {canApply && <form className="org-form" onSubmit={apply}>
      <fieldset disabled={busy}>
        <label>{t('企业全称', 'Legal enterprise name')}<input className="org-form-control" name="legalName" defaultValue={name} maxLength={160} required /></label>
        <label>{t('统一社会信用代码', 'Unified social credit code')}<input className="org-form-control" name="creditCode" minLength={18} maxLength={18} required autoCapitalize="characters" /></label>
        <label>{t('法定代表人', 'Legal representative')}<input className="org-form-control" name="representative" maxLength={100} required /></label>
        <label>{t('经办人姓名', 'Contact name')}<input className="org-form-control" name="contactName" maxLength={100} required /></label>
        <label>{t('联系电话', 'Contact phone')}<input className="org-form-control" name="contactPhone" type="tel" maxLength={40} required /></label>
        <label>{t('付款对公账号', 'Payer corporate account')}<input className="org-form-control" name="payerAccount" inputMode="numeric" maxLength={40} required /></label>
        <label>{t('付款开户行', 'Payer bank')}<input className="org-form-control" name="payerBank" maxLength={160} required /></label>
        <label>{t('营业执照（JPG / PNG，最多 2 MB）', 'Business license (JPG / PNG, up to 2 MB)')}<input className="org-form-control" name="license" type="file" accept="image/png,image/jpeg" required /></label>
        <div className="org-field-wide"><BoolToggle value={declared} onChange={setDeclared} label={t('我有权代表该企业申请认证，所填资料真实，并同意用于企业核验。', 'I am authorized to apply for this enterprise, confirm the information is accurate, and consent to its use for verification.')} /></div>
        <p className="org-field-wide">{t('执照、联系方式和付款账号仅用于审核，不会公开展示。', 'Your license, contact details and payer account are used for review and are not publicly displayed.')}</p>
        <div className="org-form-actions"><button className="org-form-button" disabled={!declared || busy}>{busy ? t('正在提交…', 'Submitting…') : t('申请对公账户验证', 'Apply for corporate account verification')}</button></div>
      </fieldset>
    </form>}
    {state && <div className="org-form"><button type="button" className="org-form-button" disabled={busy} onClick={() => { setError(''); void load().catch(reason => setError(verificationError(reason, t))); }}>{t('刷新认证状态', 'Refresh verification status')}</button></div>}
  </section>;
}
