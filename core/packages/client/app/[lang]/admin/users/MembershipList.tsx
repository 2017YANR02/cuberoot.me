'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { displayCuberName } from '@/lib/cuber-name-display';
import { fmtDate } from '@/lib/membership-format';
import { adminList, adminRevoke, publicMemberBadgeKind, type Membership, type MembershipPlan } from '@/lib/membership-api';

function periodLabel(member: Membership, plan: MembershipPlan | undefined, t: ReturnType<typeof useT>): string {
  if (member.lifetime || plan?.period === 'lifetime') return t('非年度 · 永久', 'Non-annual · Lifetime');
  if (!plan) return t('周期未记录', 'Period not recorded');
  const count = plan.periodCount;
  switch (plan.period) {
    case 'year': return t(`年度 · ${count} 年`, `Annual · ${count} year(s)`);
    case 'month': return t(`非年度 · ${count} 个月`, `Non-annual · ${count} month(s)`);
    case 'week': return t(`非年度 · ${count} 周`, `Non-annual · ${count} week(s)`);
    case 'day': return t(`非年度 · ${count} 天`, `Non-annual · ${count} day(s)`);
    default: return t('周期未记录', 'Period not recorded');
  }
}

export default function MembershipList({ onChanged }: { onChanged: () => void }) {
  const t = useT();
  const isZh = useLang() === 'zh';
  const [data, setData] = useState<Awaited<ReturnType<typeof adminList>> | null>(null);
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
    } catch (error) {
      setRevokeError(error instanceof Error ? error.message : String(error));
    } finally {
      setRevoking(null);
    }
  }

  return <section aria-labelledby="admin-membership-list-title">
    <div className="admin-users-list-heading">
      <h2 id="admin-membership-list-title">{t('订阅会员', 'Membership records')}</h2>
      <button type="button" className="admin-users-page-button" onClick={reload}>{t('刷新', 'Refresh')}</button>
    </div>
    {failed && <p className="admin-users-error" role="alert">{t('会员列表加载失败，请重试。', 'Could not load memberships. Please retry.')}</p>}
    {revokeError && <p className="admin-users-error" role="alert">{revokeError}</p>}
    {!data && !failed && <p role="status">{t('正在加载会员…', 'Loading memberships…')}</p>}
    {data && <div className="admin-users-table-scroll sticky-scroll">
      <table className="admin-users-table sticky-thead">
        <thead><tr>
          <th>{t('会员', 'Member')}</th><th>{t('类型', 'Type')}</th>
          <th>{t('周期', 'Period')}</th><th>{t('套餐', 'Plan')}</th>
          <th>{t('到期日期', 'Expires')}</th><th>{t('状态', 'Status')}</th><th>{t('操作', 'Actions')}</th>
        </tr></thead>
        <tbody>{data.members.map(member => {
          const plan = data.plans?.find(item => item.slug === member.planSlug);
          const kind = publicMemberBadgeKind(member);
          return <tr key={member.wcaId}>
            <td><strong>{displayCuberName(member.name, isZh)}</strong><span className="admin-users-id">{[member.vipId, member.wcaId].filter(Boolean).join(' / ')}</span></td>
            <td>{kind === 'enterpriseMember' ? t('企业', 'Enterprise') : kind === 'personalMember' ? t('个人', 'Individual') : t('类型未记录', 'Type not recorded')}</td>
            <td>{periodLabel(member, plan, t)}</td>
            <td>{plan ? t(plan.nameZh, plan.nameEn) : member.planSlug || '—'}</td>
            <td>{member.lifetime ? t('永久', 'Lifetime') : fmtDate(member.expiresAt) || '—'}</td>
            <td>{member.active ? t('有效', 'Active') : t('已失效', 'Inactive')}</td>
            <td>{member.active && <button type="button" className="admin-users-page-button" disabled={revoking !== null} onClick={() => void revoke(member)}>
              {revoking === member.wcaId ? t('正在撤销…', 'Revoking…') : t('撤销会员', 'Revoke membership')}
            </button>}</td>
          </tr>;
        })}</tbody>
      </table>
      {data.members.length === 0 && <p className="admin-users-status">{t('暂无会员', 'No memberships yet')}</p>}
    </div>}
  </section>;
}
