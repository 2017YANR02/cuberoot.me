'use client';

import { useEffect, useState } from 'react';
import { ArrowRight } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { PlatformState } from '@/components/platform/PlatformState';
import { useT } from '@/hooks/useT';
import { competitionWorkspaceHref } from '@/lib/competition-links';
import { getCompetitionHostOverview, type CompetitionHostOverview as Overview } from '@/lib/online-competition-api';

export function CompetitionHostOverview({ onManage }: { onManage?: (id?: string) => void }) {
  const t = useT();
  const [request, setRequest] = useState(0);
  const [overview, setOverview] = useState<Overview | 'error' | null>(null);

  useEffect(() => {
    let active = true;
    void getCompetitionHostOverview().then(data => {
      if (active) setOverview(data);
    }, () => {
      if (active) setOverview('error');
    });
    return () => { active = false; };
  }, [request]);

  if (!overview) return <PlatformState kind="loading" message={t('正在读取报名与收款数据。', 'Loading registration and payment data.')} />;
  if (overview === 'error') return <PlatformState kind="error"
    title={t('赛事数据暂不可用', 'Competition data is unavailable')}
    onRetry={() => { setOverview(null); setRequest(value => value + 1); }} />;

  const locale = t('zh-CN', 'en');
  const integer = new Intl.NumberFormat(locale);
  const currency = new Intl.NumberFormat(locale, { style: 'currency', currency: overview.currency });
  const money = (amount: string | null) => {
    if (amount === null) return t('待确认', 'Pending');
    const minor = BigInt(amount);
    const fraction = String(minor % 100n).padStart(2, '0');
    return currency.formatToParts(minor / 100n).map(part => part.type === 'fraction' ? fraction : part.value).join('');
  };
  const totals = overview.totals;
  const statuses: Record<string, string> = {
    draft: t('草稿', 'Draft'), pending_approval: t('待平台审核', 'Pending review'),
    rejected: t('已退回修改', 'Changes requested'), published: t('已发布', 'Published'),
    provisional_results: t('成绩公示', 'Provisional results'), completed: t('已结束', 'Completed'),
    cancelled: t('已取消', 'Cancelled'),
  };
  const stats = [
    { name: t('有效报名人次', 'Confirmed entries'), value: integer.format(totals.registered) },
    { name: t('报名净收款', 'Net entry payments'), value: money(totals.netCollectedMinor) },
    { name: t('已退款', 'Refunded'), value: money(totals.refundedMinor) },
    { name: t('主办方应收', 'Organizer proceeds'), value: money(totals.organizerAmountMinor) },
  ];

  return <div className="competition-host-overview">
    <dl className="competition-host-metrics">
      {stats.map(({ name, value }) => <div key={name} data-site-surface="panel">
        <dt>{name}</dt><dd>{value}</dd>
      </div>)}
    </dl>
    <p className="competition-host-overview-note">{t('报名按每场比赛的确认选手统计。净收款为报名支付金额扣除已退款，主办方应收按结算条款计算。', 'Entries count confirmed competitors once per competition. Net payments deduct completed refunds, and organizer proceeds follow the settlement terms.')}</p>
    <section className="competition-host-breakdown" aria-labelledby="competition-host-breakdown-heading">
      <div className="competition-host-section-heading">
        <h2 id="competition-host-breakdown-heading">{t('赛事明细', 'Competition breakdown')}</h2>
        {onManage
          ? <button type="button" className="competition-secondary" onClick={() => onManage()}>{t('赛事管理', 'Competition management')}<ArrowRight size={16} aria-hidden /></button>
          : <AppLink href={competitionWorkspaceHref('manage')} prefetch={false}>{t('赛事管理', 'Competition management')}<ArrowRight size={16} aria-hidden /></AppLink>}
      </div>
      {overview.competitions.length ? <>
        {overview.competitionCount > overview.competitions.length && <p className="competition-host-overview-note">
          {t(`显示最近更新的 ${overview.competitions.length} 场，共 ${overview.competitionCount} 场比赛。`, `Showing the ${overview.competitions.length} most recently updated of ${overview.competitionCount} competitions.`)}
        </p>}
        <div className="competition-host-table-scroll" role="region" aria-labelledby="competition-host-breakdown-heading" tabIndex={0} data-site-surface="panel">
          <table className="competition-host-table" aria-labelledby="competition-host-breakdown-heading">
            <thead><tr>
              <th scope="col">{t('比赛', 'Competition')}</th>
              <th scope="col">{t('报名人数', 'Competitors')}</th>
              <th scope="col">{stats[1].name}</th>
              <th scope="col">{stats[2].name}</th>
              <th scope="col">{stats[3].name}</th>
            </tr></thead>
            <tbody>{overview.competitions.map(row => <tr key={row.id}>
              <th scope="row">
                {onManage
                  ? <button type="button" className="competition-host-entity-button" onClick={() => onManage(row.id)}>{t(row.titleZh || row.titleEn, row.titleEn || row.titleZh)}</button>
                  : <AppLink href={competitionWorkspaceHref('manage', row.id)} prefetch={false}>{t(row.titleZh || row.titleEn, row.titleEn || row.titleZh)}</AppLink>}
                <span>{[row.organizationName, row.status ? statuses[row.status] : null].filter(Boolean).join(' · ')}</span>
              </th>
              <td>{integer.format(row.registered)}</td>
              <td>{money(row.netCollectedMinor)}</td>
              <td>{money(row.refundedMinor)}</td>
              <td>{money(row.organizerAmountMinor)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </> : <p className="competition-empty">{t('还没有可管理的赛事。创建比赛后，这里会显示报名和收款明细。', 'When you create a competition, its registration and payment details will appear here.')}</p>}
    </section>
  </div>;
}
