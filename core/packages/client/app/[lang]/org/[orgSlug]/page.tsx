'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AppLink from '@/components/AppLink';
import { ArrowUpRight, Users, GraduationCap, Timer, Eye, BookOpen, Box } from '@app-foundation/icons/lucide';
import { useT } from '@/hooks/useT';
import { getTeachingOrganizationSummary, type TeachingOrganizationSummary, type TeachingOrganizationAccess } from '@/lib/teaching-saas-api';
import { hasTeachingPermission } from '@cuberoot/shared/teaching';
import EnterpriseVerification from '../_components/EnterpriseVerification';
import OrgWorkspace from '../_components/OrgWorkspace';
import { MutationMessage, teachingErrorMessage } from '../_components/OrgUi';

export default function OrganizationOverviewPage() {
  const params = useParams<{ orgSlug: string }>();
  const orgSlug = params.orgSlug;
  return <OrgWorkspace orgSlug={orgSlug}>{organization => <>{['owner', 'admin'].includes(organization.role) && <EnterpriseVerification key={orgSlug} orgSlug={orgSlug} name={organization.name} />}<OrganizationOverviewContent orgSlug={orgSlug} role={organization.role} /></>}</OrgWorkspace>;
}

function OrganizationOverviewContent({ orgSlug, role }: { orgSlug: string; role: TeachingOrganizationAccess['role'] }) {
  const t = useT();
  const [summary, setSummary] = useState<TeachingOrganizationSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void getTeachingOrganizationSummary(orgSlug).then((value) => {
      if (!cancelled) setSummary(value);
    }).catch((reason: unknown) => {
      if (!cancelled) setError(teachingErrorMessage(reason, t));
    });
    return () => { cancelled = true; };
  }, [orgSlug, t]);

  const tools = [
    { href: '/timer', label: t('计时器', 'Timer'), description: t('开始计时，记录每一次练习。', 'Time your solves and record each practice.'), Icon: Timer },
    { href: '/predict', label: t('预测训练', 'Prediction trainer'), description: t('练习观察与预测下一步。', 'Practice observation and predict the next step.'), Icon: Eye },
    { href: '/alg', label: t('公式库与训练', 'Algorithms and training'), description: t('查找公式，进行专项练习。', 'Find algorithms and practice specific cases.'), Icon: BookOpen },
    { href: '/sim', label: t('模拟器', 'Simulator'), description: t('用虚拟魔方演示与探索。', 'Demonstrate and explore with a virtual cube.'), Icon: Box },
  ] as const;

  return (
    <>
      <section className="org-section org-overview-section">
        <div className="org-section-heading"><div><p className="org-eyebrow">{t('日常管理', 'Day-to-day management')}</p><h2>{t('学员与团队', 'Students and team')}</h2></div></div>
        {error ? <MutationMessage message={error} error /> : (
          <div className="org-dashboard-grid" aria-busy={!summary}>
            {hasTeachingPermission(role, 'student:read') && <AppLink className="org-dashboard-card" data-site-surface="panel" href={`/org/${orgSlug}/students`} prefetch={false}><GraduationCap className="org-card-icon" size={24} aria-hidden="true" /><span className="org-card-stat">{summary?.studentCount ?? '—'}</span><h3>{t('学员', 'Students')}</h3><p>{summary?.studentCount === 0 ? t('还没有学员，从建立第一份学员档案开始。', 'Start by creating your first student profile.') : t('查看学员档案、课程与学习记录。', 'View student profiles, courses and learning records.')}</p><span className="org-card-action">{t('打开学员管理', 'Open student management')}<ArrowUpRight size={18} aria-hidden="true" /></span></AppLink>}
            {hasTeachingPermission(role, 'member:read') && <AppLink className="org-dashboard-card" data-site-surface="panel" href={`/org/${orgSlug}/members`} prefetch={false}><Users className="org-card-icon" size={24} aria-hidden="true" /><span className="org-card-stat">{summary?.memberCount ?? '—'}</span><h3>{t('团队成员', 'Team members')}</h3><p>{t('查看老师、管理员和其他协作成员。', 'View teachers, administrators and collaborators.')}</p><span className="org-card-action">{t('打开成员管理', 'Open team management')}<ArrowUpRight size={18} aria-hidden="true" /></span></AppLink>}
          </div>
        )}
      </section>

        <section className="org-section org-overview-section">
          <div className="org-section-heading"><div><p className="org-eyebrow">{t('课堂与练习', 'Classroom and practice')}</p><h2>{t('训练工具', 'Training tools')}</h2></div></div>
          <div className="org-tool-grid">
            {tools.map(({ href, label, description, Icon }) => <AppLink className="org-dashboard-card org-training-card" data-site-surface="panel" href={href} key={href} prefetch={false}><Icon className="org-card-icon" size={24} aria-hidden="true" /><h3>{label}</h3><p>{description}</p><span className="org-card-action">{t('打开工具', 'Open tool')}<ArrowUpRight size={18} aria-hidden="true" /></span></AppLink>)}
          </div>
        </section>
    </>
  );
}
