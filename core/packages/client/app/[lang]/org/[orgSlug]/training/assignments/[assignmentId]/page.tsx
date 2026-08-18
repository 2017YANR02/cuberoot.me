'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { parseAsInteger, useQueryState } from 'nuqs';
import {
  hasTeachingPermission,
  type TeachingGroup,
  type TeachingOrganizationRole,
  type TeachingTrainingAssignmentDetail,
  type TeachingTrainingAssignmentTarget,
} from '@cuberoot/shared/teaching';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import {
  closeTeachingTrainingAssignment,
  getTeachingTrainingAssignment,
  listTeachingGroups,
  listTeachingStudents,
  listTeachingTrainingAssignmentTargets,
  publishTeachingTrainingAssignment,
  type TeachingStudent,
} from '@/lib/teaching-saas-api';
import { formatTrainingGoal, trainingSourceLabel } from '@/lib/teaching-training';
import TrainingAssignmentForm from '../../../../_components/TrainingAssignmentForm';
import OrgWorkspace from '../../../../_components/OrgWorkspace';
import { entityStatusLabel, MutationMessage, TeachingPagination, teachingErrorMessage, useOperationKey, useTeachingPage } from '../../../../_components/OrgUi';

const PAGE_SIZE = 25;
const OPTION_LIMIT = 100;

export default function TrainingAssignmentPage() {
  const params = useParams<{ lang: string; orgSlug: string; assignmentId: string }>();
  const [rawPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const page = Math.max(1, rawPage);
  const language = params.lang === 'zh' ? 'zh' : 'en';
  return (
    <OrgWorkspace orgSlug={params.orgSlug}>
      {(organization) => (
        <AssignmentContent
          orgSlug={params.orgSlug}
          assignmentId={params.assignmentId}
          page={page}
          role={organization.role}
          language={language}
        />
      )}
    </OrgWorkspace>
  );
}

function AssignmentContent({ orgSlug, assignmentId, page, role, language }: {
  orgSlug: string;
  assignmentId: string;
  page: number;
  role: TeachingOrganizationRole;
  language: 'zh' | 'en';
}) {
  const t = useT();
  const publishOperation = useOperationKey();
  const closeOperation = useOperationKey();
  const [detail, setDetail] = useState<TeachingTrainingAssignmentDetail | null>(null);
  const [loadError, setLoadError] = useState('');
  const [groups, setGroups] = useState<TeachingGroup[]>([]);
  const [students, setStudents] = useState<TeachingStudent[]>([]);
  const [draftTargets, setDraftTargets] = useState<TeachingTrainingAssignmentTarget[]>([]);
  const [optionsError, setOptionsError] = useState('');
  const [mutating, setMutating] = useState<'publish' | 'close' | ''>('');
  const [message, setMessage] = useState('');
  const [mutationError, setMutationError] = useState('');
  const canManage = hasTeachingPermission(role, 'training:assignment:manage');
  const targetLoader = useCallback(
    () => listTeachingTrainingAssignmentTargets(orgSlug, assignmentId, page, PAGE_SIZE),
    [assignmentId, orgSlug, page],
  );
  const targets = useTeachingPage(targetLoader);

  const loadDetail = useCallback(async () => {
    try {
      setDetail(await getTeachingTrainingAssignment(orgSlug, assignmentId));
      setLoadError('');
    } catch (reason) {
      setLoadError(teachingErrorMessage(reason, t));
    }
  }, [assignmentId, orgSlug, t]);

  useEffect(() => { void loadDetail(); }, [loadDetail]);

  useEffect(() => {
    if (!canManage || detail?.assignment.status !== 'draft') return;
    let cancelled = false;
    setOptionsError('');
    void Promise.all([
      listTeachingGroups(orgSlug, 1, OPTION_LIMIT),
      listTeachingStudents(orgSlug, 1, OPTION_LIMIT),
      listTeachingTrainingAssignmentTargets(orgSlug, assignmentId, 1, OPTION_LIMIT),
    ]).then(([groupPage, studentPage, targetPage]) => {
      if (cancelled) return;
      setGroups(groupPage.items);
      setStudents(studentPage.items);
      setDraftTargets(targetPage.items);
    }).catch((reason: unknown) => {
      if (!cancelled) setOptionsError(teachingErrorMessage(reason, t));
    });
    return () => { cancelled = true; };
  }, [assignmentId, canManage, detail?.assignment.status, orgSlug, t]);

  async function transition(next: 'publish' | 'close') {
    setMutating(next);
    setMessage('');
    setMutationError('');
    try {
      const result = next === 'publish'
        ? await publishTeachingTrainingAssignment(orgSlug, assignmentId, publishOperation.get())
        : await closeTeachingTrainingAssignment(orgSlug, assignmentId, closeOperation.get());
      setDetail(result);
      if (next === 'publish') publishOperation.reset(); else closeOperation.reset();
      targets.reload();
      setMessage(next === 'publish' ? t('训练任务已发布。', 'Training assignment published.') : t('训练任务已结束。', 'Training assignment closed.'));
    } catch (reason) {
      setMutationError(teachingErrorMessage(reason, t));
    } finally {
      setMutating('');
    }
  }

  if (loadError) return <MutationMessage message={loadError} error />;
  if (!detail) return <p aria-busy="true">{t('正在加载训练任务…', 'Loading training assignment…')}</p>;

  const assignment = detail.assignment;
  const initialGroupIds = draftTargets.flatMap((target) => target.targetKind === 'group' ? [target.groupId] : []);
  const initialStudentIds = draftTargets.flatMap((target) => target.targetKind === 'student' && target.sourceGroupId === null ? [target.studentId] : []);

  return (
    <>
      <AppLink href={`/org/${orgSlug}/training`} prefetch={false}>{t('训练任务列表', 'Training assignment list')}</AppLink>
      <div className="org-heading-row"><h2>{assignment.title}</h2><span className="org-status">{entityStatusLabel(assignment.status, t)}</span></div>
      <p className="org-lead">{assignment.instructions}</p>
      <dl className="org-summary">
        <div><dt>{t('主站工具', 'Main-site tool')}</dt><dd>{trainingSourceLabel(detail.templateVersion.source, language)}</dd></div>
        <div><dt>{t('开始', 'Starts')}</dt><dd>{new Date(assignment.startsAt).toLocaleString()}</dd></div>
        <div><dt>{t('结束', 'Ends')}</dt><dd>{assignment.endsAt ? new Date(assignment.endsAt).toLocaleString() : t('不限制', 'No limit')}</dd></div>
        <div><dt>{t('期望次数', 'Expected count')}</dt><dd>{assignment.expectedCount}</dd></div>
      </dl>
      {detail.goals.length > 0 && (
        <div className="org-compact-list">
          {detail.goals.map((goal) => <span key={goal.id}>{formatTrainingGoal(goal, language)}</span>)}
        </div>
      )}

      {canManage && assignment.status === 'draft' && (
        <section className="org-section">
          <h2>{t('编辑草稿', 'Edit draft')}</h2>
          {optionsError && <MutationMessage message={optionsError} error />}
          <TrainingAssignmentForm
            orgSlug={orgSlug}
            versions={[detail.templateVersion]}
            groups={groups}
            students={students}
            initial={detail}
            initialGroupIds={initialGroupIds}
            initialStudentIds={initialStudentIds}
            onSaved={(next) => { setDetail(next); targets.reload(); }}
          />
          <div className="org-form-actions org-subsection">
            <button type="button" disabled={mutating !== '' || draftTargets.length === 0} onClick={() => { void transition('publish'); }}>
              {mutating === 'publish' ? t('发布中…', 'Publishing…') : t('发布任务', 'Publish assignment')}
            </button>
          </div>
          {draftTargets.length === 0 && <p className="org-help">{t('请先保存至少一个班级或学员目标。', 'Save at least one class or student target before publishing.')}</p>}
        </section>
      )}

      {canManage && assignment.status === 'published' && (
        <div className="org-form-actions org-section">
          <button type="button" className="org-secondary-button" disabled={mutating !== ''} onClick={() => { void transition('close'); }}>
            {mutating === 'close' ? t('结束中…', 'Closing…') : t('结束任务', 'Close assignment')}
          </button>
        </div>
      )}
      <MutationMessage message={mutationError || message} error={!!mutationError} />

      <section className="org-section">
        <h2>{t('任务目标', 'Assignment targets')}</h2>
        {targets.loading ? <p aria-busy="true">{t('正在加载…', 'Loading…')}</p> : targets.error ? <MutationMessage message={targets.error} error /> : !targets.result?.items.length ? (
          <p className="org-empty">{t('草稿还没有目标；发布后会展开班级中的有效学员。', 'The draft has no targets. Publishing expands active students in selected classes.')}</p>
        ) : (
          <div className="org-list">
            {targets.result.items.map((target) => target.targetKind === 'student' ? (
              <AppLink
                className="org-row org-row-link"
                href={`/org/${orgSlug}/training/assignments/${assignmentId}/students/${target.studentId}`}
                prefetch={false}
                key={target.id}
              >
                <div className="org-row-main">
                  <div className="org-row-title">{target.studentDisplayNameSnapshot}</div>
                  <div className="org-row-meta">{t(`证据 ${target.evidenceCount} 条，批改 ${target.latestReviewRevision} 次`, `${target.evidenceCount} evidence items, ${target.latestReviewRevision} reviews`)}</div>
                </div>
                {target.latestReviewStatus && <span className="org-status">{entityStatusLabel(target.latestReviewStatus, t)}</span>}
              </AppLink>
            ) : (
              <div className="org-row" key={target.id}>
                <div className="org-row-main"><div className="org-row-title">{target.groupNameSnapshot}</div><div className="org-row-meta">{t('班级目标', 'Class target')}</div></div>
              </div>
            ))}
          </div>
        )}
        {targets.result && <TeachingPagination page={targets.result.page} pageSize={targets.result.pageSize} total={targets.result.total} baseHref={`/org/${orgSlug}/training/assignments/${assignmentId}`} />}
      </section>
    </>
  );
}
