'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { getTeachingOrganizationSummary, type TeachingOrganizationSummary } from '@/lib/teaching-saas-api';
import OrgWorkspace from '../_components/OrgWorkspace';
import { MutationMessage, teachingErrorMessage } from '../_components/OrgUi';

export default function OrganizationOverviewPage() {
  const params = useParams<{ orgSlug: string }>();
  const orgSlug = params.orgSlug;
  return <OrgWorkspace orgSlug={orgSlug}>{() => <OrganizationOverviewContent orgSlug={orgSlug} />}</OrgWorkspace>;
}

function OrganizationOverviewContent({ orgSlug }: { orgSlug: string }) {
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
    ['/timer', t('计时器', 'Timer')],
    ['/predict', t('预测训练', 'Prediction trainer')],
    ['/alg', t('公式库与训练', 'Algorithms and training')],
    ['/sim', t('模拟器', 'Simulator')],
  ] as const;

  return (
    <>
        <h2>{t('机构概览', 'Organization overview')}</h2>
        {error ? <MutationMessage message={error} error /> : (
          <div className="org-summary" aria-busy={!summary}>
            <div><strong>{summary?.studentCount ?? '—'}</strong><span>{t('学员', 'Students')}</span></div>
            <div><strong>{summary?.memberCount ?? '—'}</strong><span>{t('成员', 'Members')}</span></div>
          </div>
        )}

        <section className="org-section">
          <h2>{t('训练工具', 'Training tools')}</h2>
          <p className="org-lead">{t('直接使用主站已有工具，教学后台只负责任务和记录。', 'Use the main site tools directly; teaching management only handles assignments and records.')}</p>
          <div className="org-tools">
            {tools.map(([href, label]) => <AppLink className="org-tool-link" href={href} key={href} prefetch={false}><span>{label}</span><span aria-hidden="true">→</span></AppLink>)}
          </div>
        </section>
    </>
  );
}
