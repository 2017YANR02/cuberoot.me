'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { EnterpriseVerificationState, EnterpriseVerificationStatus } from '@cuberoot/shared/teaching';
import { ShieldCheck, ArrowRight, Check } from '@app-foundation/icons/lucide';
import BoolToggle from '@/components/BoolToggle';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { hasAdminAccess, useAuthUser } from '@/lib/auth-store';
import { applyEnterpriseVerification, EnterpriseVerificationError, getEnterpriseVerification, submitEnterpriseTransfer } from '@/lib/enterprise-verification-api';
import { MutationMessage, useOperationKey } from './OrgUi';
import { LoadingIndicator } from '@/components/LoadingIndicator';

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
  const user = useAuthUser();
  const [state, setState] = useState<EnterpriseVerificationState | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [declared, setDeclared] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(0);
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
  const needsApplication = !application || ['rejected', 'expired', 'revoked'].includes(application.status);
  const waitingForOpening = !!state && !state.available && needsApplication;
  const step = !state || waitingForOpening ? 0 : needsApplication ? 1 : application.status === 'awaiting_transfer' ? 2 : application.status === 'pending_review' ? 3 : 4;
  const steps = [t('提交企业资料', 'Submit enterprise details'), t('通过银行对公转账', 'Transfer through your bank'), t('平台核对并审核', 'Platform reviews documents and receipt'), t('查看结果与退款', 'View result and refund')];
  useEffect(() => {
    if (previousStep.current > 0 && previousStep.current !== step) {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
    previousStep.current = step;
  }, [step]);
  async function refresh() {
    setRefreshing(true); setError('');
    try { await load(); }
    catch (reason) { setError(verificationError(reason, t)); }
    finally { setRefreshing(false); }
  }
  return <section id="enterprise-verification" className="org-section enterprise-verification org-verification-intro">
    <div className="org-verification-heading"><span className="org-feature-icon"><ShieldCheck size={26} aria-hidden="true" /></span><div><p className="org-eyebrow">{t('企业身份', 'Enterprise identity')}</p><h2 ref={heading} tabIndex={-1}>{t('企业认证', 'Enterprise verification')}</h2></div>{state && <span className="org-verification-badge">{application ? verificationStatus(application.status, t) : state.available ? t('待提交资料', 'Details needed') : t('尚未开放', 'Not open yet')}</span>}</div>
    <p className="org-lead">{t('按以下顺序核实企业身份和对公账户。企业已创建，无需重复创建。', 'Follow these steps to verify your enterprise and corporate account. Your enterprise already exists; no need to create it again.')}</p>
    <ol className="org-verification-steps" aria-label={t('企业认证步骤', 'Enterprise verification steps')}>
      {steps.map((label, index) => <li key={index} data-complete={step > index + 1 || undefined} aria-current={step === index + 1 ? 'step' : undefined}><span aria-hidden="true">{step > index + 1 ? <Check size={16} /> : index + 1}</span><strong>{label}</strong>{step === index + 1 && <small>{t('当前步骤', 'Current step')}</small>}</li>)}
    </ol>
    <MutationMessage message={error} error />
    {!state && !error && <p aria-busy="true"><LoadingIndicator>{t('正在加载…', 'Loading…')}</LoadingIndicator></p>}
    {waitingForOpening && <div className="org-verification-next" data-site-surface="panel">
      <h3>{t('尚未开始：等待平台开放认证', 'Not started: waiting for the platform to open verification')}</h3>
      <p>{t('现在不用打款。开放后，提交企业资料即可获取本次申请的打款金额、收款账户和附言。', 'No transfer is needed now. Once verification opens, submit your details to get the amount, recipient account and reference for your application.')}</p>
      {hasAdminAccess(user) ? <>
        <p>{t('你同时是平台管理员。下一步请检查平台收款设置，页面会列出尚未完成的准备工作。', 'You are also a platform administrator. Next, check platform receiving settings for the remaining setup steps.')}</p>
        <AppLink className="org-primary-link" href="/org#enterprise-admin" prefetch={false}>{t('下一步：检查并配置平台收款', 'Next: check and configure platform receiving account')}<ArrowRight size={18} aria-hidden="true" /></AppLink>
      </> : <p>{t('下一步由平台管理员处理，你可以先使用下方的教学管理功能。', 'The platform administrator handles the next step. You can use the teaching tools below while waiting.')}</p>}
    </div>}
    {application && <div>
      <p className="org-help">{t('本次认证企业：', 'Enterprise in this application: ')}{application.legalName}</p>
      {application.reviewNote && <p>{t('平台审核说明：', 'Platform review note: ')}{application.reviewNote}</p>}
      {application.refundedAt && <p>{t('验证款已记录退款。', 'A refund of the verification transfer has been recorded.')}</p>}
      {application.status === 'pending_review' && <div className="org-verification-next" data-site-surface="panel"><h3>{t('第 3 步：等待平台审核', 'Step 3: Wait for platform review')}</h3><p>{t('你已通知平台完成打款。平台还需核对银行实际到账和企业材料；现在无需再次打款或提交资料。', 'You have notified the platform of your transfer. The platform must still check the actual bank receipt and enterprise documents. Do not transfer or submit documents again.')}</p></div>}
      {application.status === 'verified' && <div className="org-verification-next" data-site-surface="panel"><h3>{t('第 4 步：认证已通过', 'Step 4: Enterprise verified')}</h3><p>{application.refundedAt ? t('本次认证已完成，平台已登记验证款退款。', 'Verification is complete and the platform has recorded the refund.') : t('无需再次申请或打款。平台将按本次申请的退款说明原路退回验证款，退款登记后会在这里显示。', 'No further application or transfer is needed. The platform will return the verification transfer according to this application’s refund notice and record it here.')}</p></div>}
      {application.status === 'awaiting_transfer' && application.recipient && <>
        <h3>{t('第 2 步：打开企业网银，按下列信息转账', 'Step 2: Open corporate banking and transfer using these details')}</h3>
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
        <p>{t('完成银行转账后，再点击下方按钮通知平台。按钮不会扣款，也不代表认证通过；已转账请勿重复支付。', 'After completing the bank transfer, notify the platform below. This button does not debit your account or grant verification. Do not pay twice.')}</p>
        <div className="org-form"><button type="button" className="org-form-button" disabled={busy || refreshing} onClick={() => void submitTransfer()}>{busy ? t('正在通知平台…', 'Notifying the platform…') : t('我已完成银行转账，通知平台审核', 'I have transferred through my bank — notify the platform')}</button></div>
      </>}
      {application.status === 'awaiting_transfer' && !application.recipient && <p role="alert">{t('暂时无法读取本次申请的收款信息。请先不要打款，联系平台恢复后再查询。', 'Receiving details for this application are temporarily unavailable. Do not transfer yet; contact the platform and check again after recovery.')}</p>}
      {application.status === 'expired' && <p>{t('请勿继续向这笔申请打款。如已转账，请联系平台核对，不要重复打款。', 'Do not transfer for this expired application. If you already paid, contact support before transferring again.')}</p>}
      {['rejected', 'revoked'].includes(application.status) && <p>{t('请先查看平台审核说明，处理问题后再重新申请。如已打款但尚未退款，请联系平台核对，勿重复支付。', 'Read the review note and resolve the issue before applying again. If you already paid and have not been refunded, contact the platform before paying again.')}</p>}
    </div>}
    {canApply && <>
      <h3>{application ? t('第 1 步：核对资料，重新申请', 'Step 1: Check your details and apply again') : t('第 1 步：提交企业资料，获取打款指引', 'Step 1: Submit enterprise details to get transfer instructions')}</h3>
      <p>{t('准备营业执照、经办人信息及本企业的付款对公账户。下方企业全称已带入，请与营业执照核对一致。此步骤不扣款。', 'Prepare your business license, contact details and your enterprise’s payer account. Check the prefilled legal name against your license. This step does not debit your account.')}</p>
      <form className="org-form" onSubmit={apply}>
      <fieldset disabled={busy || refreshing}>
        <label>{t('企业全称', 'Legal enterprise name')}<input className="org-form-control" name="legalName" defaultValue={name} maxLength={160} required /></label>
        <label>{t('统一社会信用代码', 'Unified social credit code')}<input className="org-form-control" name="creditCode" minLength={18} maxLength={18} required autoCapitalize="characters" /></label>
        <label>{t('法定代表人', 'Legal representative')}<input className="org-form-control" name="representative" maxLength={100} required /></label>
        <label>{t('经办人姓名', 'Contact name')}<input className="org-form-control" name="contactName" maxLength={100} required /></label>
        <label>{t('联系电话', 'Contact phone')}<input className="org-form-control" name="contactPhone" type="tel" maxLength={40} required /></label>
        <label>{t('本企业的付款对公账号', 'Your enterprise’s payer account')}<input className="org-form-control" name="payerAccount" inputMode="numeric" maxLength={40} required /></label>
        <label>{t('本企业的付款开户行', 'Your enterprise’s payer bank')}<input className="org-form-control" name="payerBank" maxLength={160} required /></label>
        <label>{t('营业执照（JPG / PNG，最多 2 MB）', 'Business license (JPG / PNG, up to 2 MB)')}<input className="org-form-control" name="license" type="file" accept="image/png,image/jpeg" required /></label>
        <div className="org-field-wide"><BoolToggle value={declared} onChange={setDeclared} label={t('我有权代表该企业申请认证，所填资料真实，并同意用于企业核验。', 'I am authorized to apply for this enterprise, confirm the information is accurate, and consent to its use for verification.')} /></div>
        <p className="org-field-wide">{t('执照、联系方式和付款账号仅用于审核，不会公开展示。', 'Your license, contact details and payer account are used for review and are not publicly displayed.')}</p>
        <div className="org-form-actions"><button className="org-form-button" disabled={!declared || busy}>{busy ? t('正在提交…', 'Submitting…') : t('提交资料，获取打款金额和收款账户', 'Submit details to get the transfer amount and recipient account')}</button></div>
      </fieldset>
    </form></>}
    {(state || error) && <button type="button" className="org-secondary-button" disabled={busy || refreshing} onClick={() => void refresh()}>{refreshing ? t('正在查询…', 'Checking…') : !state ? t('重新加载认证信息', 'Reload verification details') : waitingForOpening ? t('重新检查是否已开放', 'Check whether verification has opened') : t('查询最新认证及退款进度', 'Check verification and refund progress')}</button>}
    <p className="org-help">{t('企业认证用于核实企业身份及对公账户，品牌授权和学生归属需另外确认。', 'Enterprise verification checks identity and the corporate account. Brand rights and student affiliations are confirmed separately.')}</p>
  </section>;
}
