'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { EnterpriseBankRecipient, EnterpriseVerificationApplication, EnterpriseVerificationReviewDetails, EnterpriseVerificationReview } from '@cuberoot/shared/teaching';
import BoolToggle from '@/components/BoolToggle';
import { useT } from '@/hooks/useT';
import { getEnterpriseBankSettings, saveEnterpriseBankSettings, listEnterpriseApplications, getEnterpriseApplicationMaterials, reviewEnterpriseApplication, recordEnterpriseRefund, recordEnterpriseReceipt, revokeEnterpriseVerification } from '@/lib/enterprise-verification-api';
import { verificationError, verificationStatus } from './EnterpriseVerification';
import { MutationMessage } from './OrgUi';

export default function EnterpriseVerificationAdmin() {
  const t = useT();
  const [opened, setOpened] = useState(false);
  return <section className="org-section enterprise-verification">
    <div className="org-form"><button type="button" className="org-form-button" aria-expanded={opened} onClick={() => setOpened(!opened)}>{t('企业认证审核与收款设置', 'Enterprise verification review and bank settings')}</button></div>
    {opened && <AdminContent />}
  </section>;
}
function AdminContent() {
  const t = useT();
  const [settings, setSettings] = useState<EnterpriseBankRecipient | null>(null);
  const [keyReady, setKeyReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [rows, setRows] = useState<EnterpriseVerificationApplication[]>([]);
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [selected, setSelected] = useState<{ application: EnterpriseVerificationApplication; details: EnterpriseVerificationReviewDetails } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const loadRows = useCallback(async () => { const result = await listEnterpriseApplications(offset); setRows(result.applications); setMore(result.hasMore); }, [offset]);
  useEffect(() => { let active = true; void getEnterpriseBankSettings().then(result => { if (!active) return; setSettings(result.settings); setEnabled(result.settings?.enabled ?? false); setKeyReady(result.keyReady); setLoaded(true); }).catch(reason => { if (active) setError(verificationError(reason, t)); }); return () => { active = false; }; }, [t]);
  useEffect(() => { let active = true; void listEnterpriseApplications(offset).then(result => { if (active) { setRows(result.applications); setMore(result.hasMore); } }).catch(reason => { if (active) setError(verificationError(reason, t)); }); return () => { active = false; }; }, [offset, t]);
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(''); setMessage('');
    try { await action(); setMessage(success); await loadRows(); }
    catch (reason) { setError(verificationError(reason, t)); }
    finally { setBusy(false); }
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? '').trim();
    void run(() => saveEnterpriseBankSettings({ enabled, accountName: value('accountName'), bankName: value('bankName'), accountNumber: value('accountNumber'), refundNotice: value('refundNotice') }), t('收款设置已保存；已生成的申请继续使用原收款信息。', 'Bank settings saved. Existing applications retain their original recipient details.'));
  }
  return <>
    <h2>{t('平台企业认证管理', 'Platform enterprise verification')}</h2>
    <MutationMessage message={error || message} error={!!error} />
    {loaded && !keyReady && <p>{t('尚未配置企业材料加密密钥，认证不能开放。请由运维配置后再保存收款信息。', 'The document encryption key is not configured. Verification cannot open until operations configures it.')}</p>}
    {loaded && <form className="org-form" onSubmit={save}>
      <fieldset disabled={busy || !keyReady}>
        <label>{t('收款企业全称', 'Recipient legal name')}<input className="org-form-control" name="accountName" defaultValue={settings?.accountName ?? '上海魔方根科技有限公司'} required maxLength={160} /></label>
        <label>{t('开户行（含支行）', 'Bank and branch')}<input className="org-form-control" name="bankName" defaultValue={settings?.bankName ?? ''} placeholder={t('招商银行具体支行名称', 'China Merchants Bank branch name')} required maxLength={160} /></label>
        <label>{t('对公收款账号', 'Corporate recipient account')}<input className="org-form-control" name="accountNumber" defaultValue={settings?.accountNumber ?? ''} inputMode="numeric" required maxLength={40} /></label>
        <label className="org-field-wide">{t('退款说明（向申请人展示，说明处理时限）', 'Refund notice (visible to applicants, include processing time)')}<textarea className="org-form-control org-form-textarea" name="refundNotice" defaultValue={settings?.refundNotice ?? ''} required maxLength={1000} /></label>
        <div className="org-field-wide"><BoolToggle value={enabled} onChange={setEnabled} label={t('开放新的对公验证申请', 'Accept new corporate verification applications')} /></div>
        <div className="org-form-actions"><button className="org-form-button">{t('保存收款设置', 'Save bank settings')}</button></div>
      </fieldset>
    </form>}
    <h3>{t('认证申请', 'Applications')}</h3>
    <div className="org-form"><button type="button" className="org-form-button" disabled={busy} onClick={() => void run(loadRows, '')}>{t('刷新申请', 'Refresh applications')}</button></div>
    <div className="org-table-wrap"><table className="org-table">
      <thead><tr><th>{t('企业', 'Enterprise')}</th><th>{t('认证状态', 'Verification')}</th><th>{t('验证款', 'Transfer')}</th><th>{t('操作', 'Action')}</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id}><td>{row.legalName}</td><td>{verificationStatus(row.status, t)}</td><td>{row.refundedAt ? t('已退款', 'Refund recorded') : row.receivedAt ? t('已核实到账，待退款', 'Received; refund pending') : t('未核实到账', 'Receipt not confirmed')}</td><td><button type="button" className="org-table-control" disabled={busy} onClick={() => { setSelected(null); void run(async () => setSelected(await getEnterpriseApplicationMaterials(row.id)), ''); }}>{t('查看材料', 'Review materials')}</button></td></tr>)}</tbody>
    </table></div>
    <div className="org-form"><div className="org-form-actions">
      <button type="button" className="org-form-button" disabled={offset === 0 || busy} onClick={() => { setSelected(null); setOffset(Math.max(0, offset - 50)); }}>{t('上一页', 'Previous')}</button>
      <button type="button" className="org-form-button" disabled={!more || busy} onClick={() => { setSelected(null); setOffset(offset + 50); }}>{t('下一页', 'Next')}</button>
    </div></div>
    {selected && <ReviewApplication key={selected.application.id} value={selected} busy={busy} run={run} refresh={async () => setSelected(await getEnterpriseApplicationMaterials(selected.application.id))} />}
  </>;
}
function ReviewApplication({ value, busy, run, refresh }: {
  value: { application: EnterpriseVerificationApplication; details: EnterpriseVerificationReviewDetails };
  busy: boolean; run: (action: () => Promise<unknown>, success: string) => Promise<void>; refresh: () => Promise<void>;
}) {
  const t = useT();
  const { application: a, details: d } = value;
  const [registry, setRegistry] = useState(false);
  const [license, setLicense] = useState(false);
  const [authorization, setAuthorization] = useState(false);
  const [original, setOriginal] = useState(false);
  const [decision, setDecision] = useState<'verify' | 'reject'>('verify');
  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? '').trim();
    const review: EnterpriseVerificationReview = {
      decision, note: text('note'), registryChecked: registry, licenseChecked: license, authorizationChecked: authorization,
    };
    void run(async () => { await reviewEnterpriseApplication(a.id, review); await refresh(); }, t('审核结果已保存。', 'Review saved.'));
  }
  return <section className="org-section enterprise-verification">
    <h3>{a.legalName} · {verificationStatus(a.status, t)}</h3>
    <dl>
      <dt>{t('信用代码', 'Credit code')}</dt><dd>{a.creditCode}</dd>
      <dt>{t('法定代表人', 'Legal representative')}</dt><dd>{d.representative}</dd>
      <dt>{t('经办人 / 电话', 'Contact / phone')}</dt><dd>{d.contactName} / {d.contactPhone}</dd>
      <dt>{t('申报的付款开户行 / 账号', 'Declared payer bank / account')}</dt><dd style={{ overflowWrap: 'anywhere' }}>{d.payerBank} / {d.payerAccount}</dd>
      <dt>{t('本申请收款账户', 'Recipient for this application')}</dt><dd style={{ overflowWrap: 'anywhere' }}>{d.recipient.accountName} / {d.recipient.bankName} / {d.recipient.accountNumber}</dd>
      <dt>{t('应到账金额 / 附言', 'Expected amount / reference')}</dt><dd style={{ overflowWrap: 'anywhere' }}>¥ {(a.amountMinor / 100).toFixed(2)} / {a.transferReference}</dd>
    </dl>
    {/* Private, authenticated image data; never upload to public assets or image optimization. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={d.licenseDataUrl} alt={t('申请人提交的营业执照', 'Business license submitted by the applicant')} style={{ maxWidth: '100%', maxHeight: 480, objectFit: 'contain' }} />
    {!a.receivedAt && <form className="org-form" onSubmit={event => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      const text = (name: string) => String(data.get(name) ?? '').trim();
      const receipt = { transactionId: text('transactionId'), payerName: text('payerName'), payerAccount: text('payerAccount'), reference: text('reference'), amountMinor: Math.round(Number(text('amount')) * 100), receivedAt: new Date(text('receivedAt')).toISOString() };
      void run(async () => { await recordEnterpriseReceipt(a.id, receipt); await refresh(); }, t('到账记录已保存，尚未通过企业认证。', 'Receipt saved. Enterprise certification has not been granted.'));
    }}>
      <fieldset disabled={busy}>
        <p className="org-field-wide">{t('登记银行实际到账信息。金额、户名或附言不符及过期来款也可登记后退款，但不能通过认证。请仔细核对，保存后不能覆盖银行流水。', 'Record the actual bank receipt. Mismatched or late transfers can be recorded and refunded, but cannot verify the enterprise. Check carefully; saved receipts cannot be overwritten.')}</p>
        <label>{t('银行到账流水号', 'Bank transaction ID')}<input className="org-form-control" name="transactionId" maxLength={160} required /></label>
        <label>{t('银行显示的付款户名', 'Payer name shown by the bank')}<input className="org-form-control" name="payerName" maxLength={160} required /></label>
        <label>{t('银行显示的付款账号', 'Payer account shown by the bank')}<input className="org-form-control" name="payerAccount" maxLength={40} required /></label>
        <label>{t('实收金额（元，保留两位小数）', 'Received CNY amount (two decimal places)')}<input className="org-form-control" name="amount" inputMode="decimal" pattern="[0-9]+[.][0-9]{2}" required /></label>
        <label>{t('实际到账时间', 'Received at')}<input className="org-form-control" name="receivedAt" type="datetime-local" required /></label>
        <label>{t('银行记录的附言', 'Reference shown by the bank')}<input className="org-form-control" name="reference" maxLength={40} required /></label>
        <div className="org-form-actions"><button className="org-form-button">{t('登记银行到账', 'Record bank receipt')}</button></div>
      </fieldset>
    </form>}
    {['awaiting_transfer','pending_review'].includes(a.status) && <form className="org-form" onSubmit={review}>
      <fieldset disabled={busy}>
        <p className="org-field-wide">{t('请从银行后台或银行对账单核对真实到账。不得以申请人截图替代银行记录；材料核验结论请注明查询来源。', 'Confirm actual receipt from the bank portal or statement. Applicant screenshots do not replace bank records. Record the source of registry and document checks.')}</p>
        <label>{t('审核结果', 'Decision')}<select className="org-form-control" value={decision} onChange={event => setDecision(event.target.value as 'verify' | 'reject')}><option value="verify">{t('通过认证', 'Verify enterprise')}</option><option value="reject">{t('不通过', 'Reject')}</option></select></label>
        <div className="org-field-wide" style={{ display: 'grid', gap: 12 }}>
          <BoolToggle value={registry} onChange={setRegistry} label={t('已核对工商登记：名称、信用代码、法定代表人及经营状态', 'Registry checked: legal name, code, representative and operating status')} />
          <BoolToggle value={license} onChange={setLicense} label={t('营业执照与登记信息一致', 'Business license matches registry information')} />
          <BoolToggle value={authorization} onChange={setAuthorization} label={t('已核实经办人有权代表企业申请', 'Applicant authorization has been confirmed')} />
        </div>
        <label className="org-field-wide">{t('核验来源、授权依据或未通过原因（申请人可见）', 'Verification sources, authorization evidence or rejection reason (visible to applicant)')}<textarea className="org-form-control org-form-textarea" name="note" required maxLength={1000} /></label>
        <div className="org-form-actions"><button className="org-form-button" disabled={busy || (decision === 'verify' && (!registry || !license || !authorization || !a.receivedAt || a.status !== 'pending_review'))}>{t('保存审核结果', 'Save review')}</button></div>
      </fieldset>
    </form>}
    {d.receipt && <p style={{ overflowWrap: 'anywhere' }}>{t('实际到账：', 'Actual receipt: ')}{d.receipt.payerName} / {d.receipt.payerAccount} / ¥ {(d.receipt.amountMinor / 100).toFixed(2)} / {d.receipt.reference} / {d.receipt.transactionId}</p>}
    {a.receivedAt && !a.refundedAt && <form className="org-form" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); void run(async () => { await recordEnterpriseRefund(a.id, String(data.get('reference'))); await refresh(); }, t('退款记录已保存。', 'Refund recorded.')); }}>
      <fieldset disabled={busy}>
        <p className="org-field-wide">{t('先在银行完成原路退款，再登记流水号。此操作只记录退款，不会发起转账。', 'Return the funds to the original account through your bank, then record the transaction. This action does not send money.')}</p>
        <label>{t('退款银行流水号', 'Bank refund transaction ID')}<input className="org-form-control" name="reference" required maxLength={160} /></label>
        <div className="org-field-wide"><BoolToggle value={original} onChange={setOriginal} label={t('已实际退回原付款账户', 'Funds have been returned to the original payer account')} /></div>
        <div className="org-form-actions"><button className="org-form-button" disabled={busy || !original}>{t('登记已退款', 'Record completed refund')}</button></div>
      </fieldset>
    </form>}
    {d.reviewEvidence && <p>{t('原始审核依据：', 'Original review evidence: ')}{d.reviewEvidence.note}</p>}
    {a.refundedAt && <p>{t('已退款，银行流水号：', 'Refund recorded, bank transaction: ')}{d.refundReference}</p>}
    {a.status === 'verified' && <form className="org-form" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); void run(async () => { await revokeEnterpriseVerification(a.id, String(data.get('note'))); await refresh(); }, t('企业认证已撤销。', 'Enterprise certification revoked.')); }}>
      <fieldset disabled={busy}>
        <label>{t('撤销原因（申请人可见）', 'Revocation reason (visible to applicant)')}<input className="org-form-control" name="note" required maxLength={1000} /></label>
        <div className="org-form-actions"><button className="org-form-button">{t('撤销企业认证', 'Revoke certification')}</button></div>
      </fieldset>
    </form>}
  </section>;
}
