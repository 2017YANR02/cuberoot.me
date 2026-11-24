'use client';

import { useCallback, useEffect, useState } from 'react';
import { WCA_ID_REGEX } from '@cuberoot/shared/wca-person';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { displayCuberName } from '@/lib/cuber-name-display';
import { fmtDate, fmtPrice, fmtVipId } from '@/lib/membership-format';
import { adminList, adminRevoke, type Membership } from '@/lib/membership-api';
import MembershipAdminPanel from './MembershipAdminPanel';
import AutoRenewModal from '../../membership/AutoRenewModal';
import '../../membership/membership.css';
import type { MembershipPlan } from '@/lib/membership-api';
import { ContentSkeleton } from '@/components/ContentSkeleton';

export default function MembershipList({ onChanged }: { onChanged: () => void }) {
  const t = useT();
  const isZh = useLang() === 'zh';
  const [data, setData] = useState<Awaited<ReturnType<typeof adminList>> | null>(null);
  const [renewalPlan, setRenewalPlan] = useState<MembershipPlan | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const reload = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    adminList().then(result => { if (!cancelled) setData(result); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [revision]);

  async function revoke(member: Membership) {
    if (!window.confirm(t(`撤销 ${member.name || member.wcaId} 的会员？`, `Revoke membership for ${member.name || member.wcaId}?`))) return;
    setRevoking(member.wcaId);
    setRevokeError(null);
    try {
      await adminRevoke(member.wcaId);
      reload();
      onChanged();
    } catch {
      setRevokeError(t('撤销未确认，请刷新会员列表核对状态。', 'Revocation was not confirmed. Refresh the member list to check its status.'));
    } finally {
      setRevoking(null);
    }
  }

  return <>
    {data?.plans && <MembershipAdminPanel isZh={isZh}
      plans={data.plans.filter(plan => !['enterprise_yearly', 'enterprise_yearly_auto_renew'].includes(plan.slug))}
      onGranted={() => { reload(); onChanged(); }}
      onPlanUpdated={updated => setData(current => current && ({
        ...current, plans: current.plans?.map(plan => plan.slug === updated.slug ? updated : plan),
      }))}
      onViewRenewal={setRenewalPlan} />}
    {renewalPlan && (renewalPlan.period === 'month' || renewalPlan.period === 'year') &&
      <AutoRenewModal plan={renewalPlan} isZh={isZh} period={renewalPlan.period} planSlug={renewalPlan.slug}
        priceCents={renewalPlan.priceCents} price={fmtPrice(renewalPlan.priceCents, renewalPlan.currency)}
        onPaid={() => { reload(); onChanged(); }} onClose={() => setRenewalPlan(null)} />}
    <section aria-labelledby="admin-membership-list-title">
    <div className="admin-users-list-heading">
      <h2 id="admin-membership-list-title">{t('订阅会员', 'Membership records')}</h2>
    </div>
    {failed && <p className="admin-users-error" role="alert">{t('会员列表加载失败，请重试。', 'Could not load memberships. Please retry.')}</p>}
    {revokeError && <p className="admin-users-error" role="alert">{revokeError}</p>}
    {!data && !failed && <ContentSkeleton variant="table" rows={6} columns={6} label={t('正在加载会员…', 'Loading memberships…')} />}
    {data && <div className="admin-users-table-scroll sticky-scroll">
      <table className="admin-users-table sticky-thead">
        <thead><tr>
          <th>{t('会员', 'Member')}</th>
          <th>{t('套餐', 'Plan')}</th>
          <th>{t('最近支付方式', 'Latest payment method')}</th><th>{t('支付日', 'Payment date (UTC)')}</th><th>{t('实付金额', 'Amount paid')}</th>
          <th>{t('到期日', 'Expires')}</th><th>{t('状态', 'Status')}</th><th>{t('操作', 'Actions')}</th>
        </tr></thead>
        <tbody>{data.members.map(member => {
          const plan = data.plans?.find(item => item.slug === member.planSlug);
          const accountId = /^u([1-9]\d*)$/.exec(member.wcaId)?.[1];
          const profileHref = WCA_ID_REGEX.test(member.wcaId)
            ? `/wca/persons/${member.wcaId}`
            : accountId ? `/account?view=user&user=${accountId}` : null;
          const payment = member.payment;
          const manual = member.source === 'manual' || payment?.provider === 'manual';
          const methods: Record<string, string> = {
            alipay: t('支付宝', 'Alipay'), wechat: t('微信支付', 'WeChat Pay'),
            card_cn: t('境内银行卡', 'Domestic bank card'), card_global: t('国际银行卡', 'International bank card'),
            airwallex: 'Airwallex', xunhupay: t('虎皮椒支付', 'Xunhupay'),
            apple: 'Apple App Store', google: 'Google Play',
          };
          const channel = payment?.payChannel || payment?.provider;
          return <tr key={member.wcaId}>
            <td>
              {profileHref
                ? <AppLink href={profileHref} prefetch={false} className="admin-users-name">{displayCuberName(member.name, isZh)}</AppLink>
                : <strong>{displayCuberName(member.name, isZh)}</strong>}
              <span className="admin-users-id">{[member.vipId && fmtVipId(member.vipId), WCA_ID_REGEX.test(member.wcaId) && member.wcaId].filter(Boolean).join(' / ')}</span>
            </td>
            <td>{plan ? t(plan.nameZh, plan.nameEn) : t('未记录', 'Not recorded')}</td>
            <td>{manual ? t('手动开通', 'Manual grant') : channel ? methods[channel] || t('其他支付方式', 'Other payment method') : t('未记录', 'Not recorded')}</td>
            <td>{manual ? '—' : payment?.paidAt ? fmtDate(payment.paidAt) : t('未记录', 'Not recorded')}</td>
            <td>{manual ? t('无支付', 'No payment') : payment ? `${fmtPrice(payment.amountCents, payment.currency)} ${payment.currency}` : t('未记录', 'Not recorded')}</td>
            <td>{member.lifetime ? t('永久', 'Lifetime') : fmtDate(member.expiresAt) || '—'}</td>
            <td>{member.active ? t('有效', 'Active') : t('已失效', 'Inactive')}</td>
            <td>{member.active && <button type="button" className="admin-users-page-button" disabled={revoking !== null} onClick={() => void revoke(member)}>
              {revoking === member.wcaId ? t('正在撤销…', 'Revoking…') : t('撤销', 'Revoke')}
            </button>}</td>
          </tr>;
        })}</tbody>
      </table>
      {data.members.length === 0 && <p className="admin-users-status">{t('暂无会员', 'No memberships yet')}</p>}
    </div>}
    </section>
  </>;
}
