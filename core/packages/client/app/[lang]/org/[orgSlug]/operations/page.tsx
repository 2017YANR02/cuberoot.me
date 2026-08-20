'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { TeachingOperationsOverview } from '@cuberoot/shared/teaching';
import { useT } from '@/hooks/useT';
import { getTeachingOperationsOverview } from '@/lib/teaching-saas-api';
import OrgWorkspace from '../../_components/OrgWorkspace';
import { teachingErrorMessage } from '../../_components/OrgUi';

function MetricRow({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="org-row">
      <div className="org-row-main">
        <strong className="org-row-title">{label}</strong>
        {detail ? <span className="org-row-meta">{detail}</span> : null}
      </div>
      <strong>{value}</strong>
    </div>
  );
}

export default function OrganizationOperationsPage() {
  const params = useParams<{ orgSlug: string }>();
  return (
    <OrgWorkspace orgSlug={params.orgSlug}>
      {() => <OperationsContent orgSlug={params.orgSlug} />}
    </OrgWorkspace>
  );
}

function OperationsContent({ orgSlug }: { orgSlug: string }) {
  const t = useT();
  const [overview, setOverview] = useState<TeachingOperationsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setOverview(null);
    setError('');
    setLoading(true);
    void getTeachingOperationsOverview(orgSlug).then((result) => {
      if (!cancelled) setOverview(result);
    }).catch((reason: unknown) => {
      if (!cancelled) setError(teachingErrorMessage(reason, t));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [orgSlug, t]);

  if (loading) return <p aria-busy="true">{t('正在加载…', 'Loading…')}</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!overview) return <p role="alert">{t('经营概览暂不可用。', 'The operations overview is unavailable.')}</p>;

  return (
    <>
      <h2>{t('经营概览', 'Operations overview')}</h2>
      <p className="org-lead">
        {overview.range.fromDate} – {overview.range.throughDate} ({overview.range.timezone})
      </p>

      <section className="org-section">
        <h2>{t('课次', 'Sessions')}</h2>
        <div className="org-list">
          <MetricRow label={t('待上课', 'Scheduled')} value={overview.sessions.scheduled} />
          <MetricRow label={t('进行中', 'In progress')} value={overview.sessions.inProgress} />
          <MetricRow label={t('已完成', 'Completed')} value={overview.sessions.completed} />
          <MetricRow label={t('已取消', 'Cancelled')} value={overview.sessions.cancelled} />
          <MetricRow label={t('总计', 'Total')} value={overview.sessions.total} />
        </div>
      </section>

      <section className="org-section">
        <h2>{t('出勤', 'Attendance')}</h2>
        <div className="org-list">
          <MetricRow label={t('待确认', 'Expected')} value={overview.attendance.expected} />
          <MetricRow label={t('出席', 'Present')} value={overview.attendance.present} />
          <MetricRow label={t('迟到', 'Late')} value={overview.attendance.late} />
          <MetricRow label={t('缺席', 'Absent')} value={overview.attendance.absent} />
          <MetricRow label={t('请假', 'Excused')} value={overview.attendance.excused} />
          <MetricRow label={t('总计', 'Total')} value={overview.attendance.total} />
        </div>
      </section>

      <section className="org-section">
        <h2>{t('课时消耗', 'Credit consumption')}</h2>
        {overview.creditConsumption.length === 0 ? (
          <p className="org-empty">{t('该时间范围内没有课时消耗。', 'No credits were consumed in this range.')}</p>
        ) : (
          <div className="org-list">
            {overview.creditConsumption.map((credit) => (
              <MetricRow
                key={`${credit.creditUnit}:${credit.creditType}`}
                label={credit.creditUnit === 'lesson' ? t('课次', 'Lessons') : t('分钟', 'Minutes')}
                detail={credit.creditType}
                value={credit.amount}
              />
            ))}
          </div>
        )}
      </section>

      <section className="org-section">
        <h2>{t('学员课包', 'Student packages')}</h2>
        <div className="org-list">
          <MetricRow label={t('有效课包', 'Active packages')} value={overview.packages.active} />
          <MetricRow label={t('余额偏低', 'Low balance')} value={overview.packages.lowBalance} />
          <MetricRow label={t('即将到期', 'Expiring soon')} value={overview.packages.expiringSoon} />
        </div>
      </section>

      <section className="org-section">
        <h2>{t('训练任务', 'Training assignments')}</h2>
        <div className="org-list">
          <MetricRow label={t('任务数', 'Assignments')} value={overview.training.assignments} />
          <MetricRow label={t('学员目标数', 'Student targets')} value={overview.training.studentTargets} />
          <MetricRow label={t('已有训练记录', 'Targets with evidence')} value={overview.training.targetsWithEvidence} />
        </div>
      </section>

      <section className="org-section">
        <h2>{t('教师课次负载', 'Teacher session load')}</h2>
        {overview.teacherLoad.length === 0 ? (
          <p className="org-empty">{t('该时间范围内没有教师课次。', 'No teacher sessions were found in this range.')}</p>
        ) : (
          <div className="org-list">
            {overview.teacherLoad.map((teacher) => (
              <MetricRow
                key={teacher.displayName}
                label={teacher.displayName}
                detail={t(`其中完成 ${teacher.completedSessionCount} 节`, `${teacher.completedSessionCount} completed`)}
                value={teacher.sessionCount}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
