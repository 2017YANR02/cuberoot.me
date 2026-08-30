'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, Clock3, ShieldCheck } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { ClearButton } from '@/components/ClearButton';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { tr } from '@/i18n/tr';
import {
  cancelSponsorClaim, createSponsorClaim, listSponsorClaims, reviewSponsorClaim,
  SponsorClaimError, unclaimSponsor, type Sponsor, type SponsorClaim,
  type SponsorClaimStatus,
} from '@/lib/sponsors-api';

function statusText(status: SponsorClaimStatus): string {
  const labels: Record<SponsorClaimStatus, string> = {
    pending: tr({ zh: '审核中', en: 'Pending review' }),
    approved: tr({ zh: '已认领', en: 'Claimed' }),
    rejected: tr({ zh: '未通过', en: 'Declined' }),
    cancelled: tr({ zh: '已撤销', en: 'Cancelled' }),
    revoked: tr({ zh: '已解除', en: 'Revoked' }),
  };
  return labels[status];
}

export function ClaimStatusMark({ claim }: { claim?: SponsorClaim }) {
  if (!claim || !['pending', 'rejected', 'revoked'].includes(claim.status)) return null;
  return (
    <span className={`sponsor-claim-state sponsor-claim-state-${claim.status}`}>
      {claim.status === 'pending' ? <Clock3 size={11} /> : null}
      {statusText(claim.status)}
    </span>
  );
}

export function SponsorClaimDialog({ sponsor, claim, onClose, onChanged }: {
  sponsor: Sponsor; claim?: SponsorClaim; onClose: () => void; onChanged: () => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const pending = claim?.status === 'pending';
  useModalDismiss(onClose, busy);

  async function submit() {
    setBusy(true); setError(null); setProfileIncomplete(false);
    try {
      await createSponsorClaim(sponsor.id, note);
      await onChanged();
      onClose();
    } catch (e) {
      if (e instanceof SponsorClaimError && e.code === 'profile_incomplete') {
        setProfileIncomplete(true);
        setError(tr({ zh: '请先补全出生日期、性别和国籍。', en: 'Complete your date of birth, gender, and nationality first.' }));
      } else if (e instanceof SponsorClaimError && e.code === 'proof_required') {
        setError(tr({ zh: '请填写至少 4 个字的付款线索。', en: 'Enter at least 4 characters of payment details.' }));
      } else if (e instanceof SponsorClaimError && ['already_claimed', 'active_claim'].includes(e.code || '')) {
        setError(tr({ zh: '这条赞助已有认领或待审核申请，请刷新后再试。', en: 'This supporter entry already has a claim or pending request. Refresh and try again.' }));
      } else {
        setError(tr({ zh: '提交失败，请稍后重试。', en: 'Submission failed. Please try again.' }));
      }
    } finally { setBusy(false); }
  }

  async function cancel() {
    if (!claim) return;
    setBusy(true); setError(null);
    try {
      await cancelSponsorClaim(claim.id);
      await onChanged();
      onClose();
    } catch {
      setError(tr({ zh: '撤销失败，请刷新后重试。', en: 'Could not cancel the claim. Refresh and try again.' }));
    } finally { setBusy(false); }
  }

  return (
    <div className="sponsor-editor-backdrop sponsor-claim-backdrop" onClick={onClose}
      role="dialog" aria-modal="true" aria-labelledby="sponsor-claim-title">
      <div className="sponsor-editor sponsor-claim-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="sponsor-editor-head">
          <div>
            <h2 id="sponsor-claim-title">{tr({ zh: '认领赞助', en: 'Claim support' })}</h2>
            <span className="sponsor-claim-subtitle">{sponsor.name}</span>
          </div>
          <ClearButton variant="standalone" ariaLabel={tr({ zh: '关闭', en: 'Close' })} onClick={onClose} />
        </div>
        {pending ? (
          <div className="sponsor-editor-body">
            <div className="sponsor-claim-result">
              <Clock3 size={18} />
              <div>
                <strong>{tr({ zh: '申请正在审核', en: 'Your claim is under review' })}</strong>
                <p>{tr({ zh: '审核结果会通过站内通知和邮件发送给你。', en: 'You will receive the result by in-app notification and email.' })}</p>
              </div>
            </div>
            {claim.claimantNote ? <p className="sponsor-claim-note">{claim.claimantNote}</p> : null}
            {error ? <div className="sponsor-editor-err">{error}</div> : null}
            <div className="sponsor-claim-actions">
              <button className="sponsor-editor-cancel" disabled={busy} onClick={cancel}>{tr({ zh: '撤销申请', en: 'Cancel claim' })}</button>
            </div>
          </div>
        ) : (
          <div className="sponsor-editor-body">
            <div className="sponsor-claim-guide">
              <ShieldCheck size={19} />
              <p>{tr({
                zh: '若这条记录的 WCA ID 与你的账号完全一致，将立即通过；否则由管理员核对。',
                en: 'An exact WCA ID match is approved immediately; otherwise an administrator reviews the claim.',
              })}</p>
            </div>
            {claim && ['rejected', 'revoked'].includes(claim.status) ? (
              <div className="sponsor-claim-previous"><strong>{statusText(claim.status)}</strong>
                {(claim.status === 'revoked' ? claim.revocationNote : claim.reviewNote) ? (
                  <p>{claim.status === 'revoked' ? claim.revocationNote : claim.reviewNote}</p>
                ) : null}
              </div>
            ) : null}
            <label className="sponsor-editor-row">
              <span>{tr({ zh: '付款线索', en: 'Payment details' })}</span>
              <textarea className="sponsor-editor-textarea" rows={4} maxLength={500} value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={tr({
                  zh: '例如付款方式、日期、订单号末几位或当时的留言',
                  en: 'For example: payment method, date, last digits of the order, or your message',
                })} />
            </label>
            <p className="sponsor-editor-hint">{tr({
              zh: '不要填写完整订单号、银行卡号或其他敏感付款信息。管理员只会看到账号姓名、WCA ID 和国籍，这些资料不会公开。',
              en: 'Do not enter a full order or card number. Administrators only see your account name, WCA ID, and nationality; none is made public.',
            })}</p>
            {error ? <div className="sponsor-editor-err">{error}</div> : null}
            {profileIncomplete ? (
              <AppLink href="/account?view=signin&next=%2Fsupport" className="sponsor-claim-profile-link">
                {tr({ zh: '去补全基本资料', en: 'Complete basic profile' })}
              </AppLink>
            ) : null}
            <div className="sponsor-claim-actions">
              <button className="sponsor-editor-cancel" disabled={busy} onClick={onClose}>{tr({ zh: '取消', en: 'Cancel' })}</button>
              <button className="sponsor-editor-save" disabled={busy} onClick={submit}>
                {busy ? tr({ zh: '提交中…', en: 'Submitting…' }) : tr({ zh: '提交认领', en: 'Submit claim' })}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SponsorClaimAdminDialog({ onClose, onChanged }: { onClose: () => void; onChanged: () => Promise<void> }) {
  const [claims, setClaims] = useState<SponsorClaim[] | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  useModalDismiss(onClose, busyId !== null);

  async function reload() {
    setError(null);
    try { setClaims(await listSponsorClaims()); }
    catch { setError(tr({ zh: '认领记录加载失败。', en: 'Failed to load claim records.' })); }
  }
  useEffect(() => { void reload(); }, []);

  async function review(claim: SponsorClaim, decision: 'approve' | 'reject') {
    setBusyId(claim.id); setError(null);
    try {
      await reviewSponsorClaim(claim.id, decision, notes[claim.id] || '');
      await Promise.all([reload(), onChanged()]);
    } catch {
      setError(decision === 'reject' && !(notes[claim.id] || '').trim()
        ? tr({ zh: '驳回时必须填写至少 4 个字的原因。', en: 'Add a reason of at least 4 characters when declining.' })
        : tr({ zh: '审核操作失败，请刷新后重试。', en: 'Review action failed. Refresh and try again.' }));
    } finally { setBusyId(null); }
  }

  async function revoke(claim: SponsorClaim) {
    setBusyId(claim.id); setError(null);
    try {
      await unclaimSponsor(claim.sponsorId, notes[claim.id] || '');
      await Promise.all([reload(), onChanged()]);
    } catch {
      setError(!(notes[claim.id] || '').trim()
        ? tr({ zh: '解除认领时必须填写至少 4 个字的原因。', en: 'Add a reason of at least 4 characters when revoking.' })
        : tr({ zh: '解除认领失败，请刷新后重试。', en: 'Could not revoke this claim. Refresh and try again.' }));
    } finally { setBusyId(null); }
  }

  return (
    <div className="sponsor-editor-backdrop sponsor-claim-backdrop" onClick={onClose}
      role="dialog" aria-modal="true" aria-labelledby="sponsor-claim-admin-title">
      <div className="sponsor-editor sponsor-claim-admin" onClick={(e) => e.stopPropagation()}>
        <div className="sponsor-editor-head">
          <div>
            <h2 id="sponsor-claim-admin-title">{tr({ zh: '赞助认领审核', en: 'Supporter claim review' })}</h2>
            <span className="sponsor-claim-subtitle">{tr({ zh: '资料与付款线索仅供管理员核验', en: 'Profile and payment details are private to administrators' })}</span>
          </div>
          <ClearButton variant="standalone" ariaLabel={tr({ zh: '关闭', en: 'Close' })} onClick={onClose} />
        </div>
        <div className="sponsor-claim-admin-body">
          {error ? <div className="sponsor-editor-err">{error}</div> : null}
          {!claims ? <div className="support-empty">{tr({ zh: '加载中…', en: 'Loading…' })}</div> : null}
          {claims?.length === 0 ? <div className="support-empty">{tr({ zh: '暂无认领记录', en: 'No claim records' })}</div> : null}
          {claims?.map((claim) => {
            const profile = claim.profileSnapshot;
            const actionable = claim.status === 'pending' || claim.status === 'approved';
            return (
              <section className="sponsor-claim-review" key={claim.id}>
                <div className="sponsor-claim-review-head"><strong>{claim.sponsor.name}</strong><span className={`sponsor-claim-state sponsor-claim-state-${claim.status}`}>{statusText(claim.status)}</span></div>
                <div className="sponsor-claim-review-profile">
                  <span>{profile.displayName || '—'}</span><span>{profile.wcaId || tr({ zh: '无 WCA ID', en: 'No WCA ID' })}</span>
                  <span>{profile.countryIso2 || '—'}</span>
                </div>
                {claim.claimantNote ? <p className="sponsor-claim-note">{claim.claimantNote}</p> : null}
                {claim.reviewNote && claim.status !== 'pending' ? <p className="sponsor-claim-review-note">{claim.reviewNote}</p> : null}
                {claim.revocationNote ? <p className="sponsor-claim-review-note">{claim.revocationNote}</p> : null}
                <span className="sponsor-claim-date">{claim.createdAt.slice(0, 10)}</span>
                {actionable ? (
                  <div className="sponsor-claim-review-actions">
                    <textarea className="sponsor-editor-textarea" rows={2} maxLength={500} value={notes[claim.id] || ''}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [claim.id]: e.target.value }))}
                      placeholder={claim.status === 'pending'
                        ? tr({ zh: '审核备注；驳回时必填', en: 'Review note; required when declining' })
                        : tr({ zh: '解除原因，必填', en: 'Revocation reason, required' })} />
                    {claim.status === 'pending' ? (
                      <><button disabled={busyId === claim.id} onClick={() => review(claim, 'approve')}><BadgeCheck size={14} /> {tr({ zh: '通过', en: 'Approve' })}</button>
                        <button className="sponsor-claim-danger" disabled={busyId === claim.id} onClick={() => review(claim, 'reject')}>{tr({ zh: '驳回', en: 'Decline' })}</button></>
                    ) : (
                      <button className="sponsor-claim-danger" disabled={busyId === claim.id} onClick={() => revoke(claim)}>{tr({ zh: '解除认领', en: 'Revoke claim' })}</button>
                    )}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
