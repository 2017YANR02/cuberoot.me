'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { parseAsInteger, useQueryState } from 'nuqs';
import { hasTeachingPermission, type TeachingGroup, type TeachingOrganizationRole, type TeachingTrainingTemplateVersion } from '@cuberoot/shared/teaching';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import {
  createTeachingTrainingTemplate,
  listTeachingGroups,
  listTeachingStudents,
  listTeachingTrainingAssignments,
  listTeachingTrainingTemplates,
  listTeachingTrainingTemplateVersions,
  type TeachingStudent,
} from '@/lib/teaching-saas-api';
import TrainingAssignmentForm from '../../_components/TrainingAssignmentForm';
import OrgWorkspace from '../../_components/OrgWorkspace';
import { entityStatusLabel, MutationMessage, TeachingPagination, teachingErrorMessage, useOperationKey, useTeachingPage } from '../../_components/OrgUi';

const PAGE_SIZE = 25;
const OPTION_LIMIT = 100;

export default function OrganizationTrainingPage() {
  const params = useParams<{ orgSlug: string }>();
  const [rawPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const page = Math.max(1, rawPage);
  return <OrgWorkspace orgSlug={params.orgSlug}>{(organization) => <TrainingContent orgSlug={params.orgSlug} page={page} role={organization.role} />}</OrgWorkspace>;
}

function TrainingContent({ orgSlug, page, role }: { orgSlug: string; page: number; role: TeachingOrganizationRole }) {
  const t = useT();
  const assignmentLoader = useCallback(() => listTeachingTrainingAssignments(orgSlug, page, PAGE_SIZE), [orgSlug, page]);
  const templateLoader = useCallback(() => listTeachingTrainingTemplates(orgSlug, 1, OPTION_LIMIT), [orgSlug]);
  const assignments = useTeachingPage(assignmentLoader);
  const templates = useTeachingPage(templateLoader);
  const canManageTemplates = hasTeachingPermission(role, 'training:template:manage');
  const canManageAssignments = hasTeachingPermission(role, 'training:assignment:manage');
  const [versions, setVersions] = useState<TeachingTrainingTemplateVersion[]>([]);
  const [groups, setGroups] = useState<TeachingGroup[]>([]);
  const [students, setStudents] = useState<TeachingStudent[]>([]);
  const [optionsError, setOptionsError] = useState('');

  useEffect(() => {
    if (!canManageAssignments || !templates.result) return;
    let cancelled = false;
    const activeTemplates = templates.result.items.filter((item) => item.status === 'active');
    void Promise.all([
      Promise.all(activeTemplates.map((item) => listTeachingTrainingTemplateVersions(orgSlug, item.id, 1, OPTION_LIMIT))).then((pages) => pages.flatMap((item) => item.items)),
      listTeachingGroups(orgSlug, 1, OPTION_LIMIT).then((result) => result.items),
      listTeachingStudents(orgSlug, 1, OPTION_LIMIT).then((result) => result.items),
    ]).then(([nextVersions, nextGroups, nextStudents]) => {
      if (!cancelled) {
        setVersions(nextVersions);
        setGroups(nextGroups);
        setStudents(nextStudents);
      }
    }).catch((reason: unknown) => {
      if (!cancelled) setOptionsError(teachingErrorMessage(reason, t));
    });
    return () => { cancelled = true; };
  }, [canManageAssignments, orgSlug, t, templates.result]);

  return (
    <>
      <h2>{t('训练任务', 'Training assignments')}</h2>
      <p className="org-lead">{t('训练工具继续使用主站已有的计时器、预判训练和公式训练；这里仅安排任务、查看证据和批改。', 'Existing main-site timer, prediction, and algorithm tools remain canonical. This workspace only assigns work, reviews evidence, and gives feedback.')}</p>
      {assignments.loading ? <p aria-busy="true">{t('正在加载…', 'Loading…')}</p> : assignments.error ? <MutationMessage message={assignments.error} error /> : !assignments.result?.items.length ? (
        <p className="org-empty">{t('还没有可见训练任务。', 'No training assignments are visible yet.')}</p>
      ) : (
        <div className="org-list">
          {assignments.result.items.map((assignment) => (
            <AppLink className="org-row org-row-link" href={`/org/${orgSlug}/training/assignments/${assignment.id}`} prefetch={false} key={assignment.id}>
              <div className="org-row-main">
                <div className="org-row-title">{assignment.title}</div>
                <div className="org-row-meta">{new Date(assignment.startsAt).toLocaleString()} / {t(`期望 ${assignment.expectedCount} 次`, `${assignment.expectedCount} expected`)}</div>
              </div>
              <span className="org-status">{entityStatusLabel(assignment.status, t)}</span>
            </AppLink>
          ))}
        </div>
      )}
      {assignments.result && <TeachingPagination page={assignments.result.page} pageSize={assignments.result.pageSize} total={assignments.result.total} baseHref={`/org/${orgSlug}/training`} />}

      <section className="org-section">
        <h2>{t('训练模板', 'Training templates')}</h2>
        {templates.loading ? <p aria-busy="true">{t('正在加载…', 'Loading…')}</p> : templates.error ? <MutationMessage message={templates.error} error /> : !templates.result?.items.length ? (
          <p className="org-empty">{t('还没有训练模板。', 'No training templates yet.')}</p>
        ) : (
          <div className="org-list">
            {templates.result.items.map((template) => (
              <AppLink className="org-row org-row-link" href={`/org/${orgSlug}/training/templates/${template.id}`} prefetch={false} key={template.id}>
                <div className="org-row-main"><div className="org-row-title">{template.name}</div><div className="org-row-meta">{template.description || t('暂无说明', 'No description')} / {template.latestVersionNumber ? `v${template.latestVersionNumber}` : t('尚无版本', 'No version')}</div></div>
                <span className="org-status">{entityStatusLabel(template.status, t)}</span>
              </AppLink>
            ))}
          </div>
        )}
        {canManageTemplates && <CreateTemplateForm orgSlug={orgSlug} onCreated={templates.reload} />}
      </section>

      {canManageAssignments && (
        <section className="org-section">
          <h2>{t('创建训练任务', 'Create training assignment')}</h2>
          {optionsError && <MutationMessage message={optionsError} error />}
          <TrainingAssignmentForm orgSlug={orgSlug} versions={versions} groups={groups} students={students} onSaved={assignments.reload} />
          {(groups.length >= OPTION_LIMIT || students.length >= OPTION_LIMIT) && <p className="org-help">{t('目标选择器最多载入前 100 个可见班级和学员。', 'Target selectors load at most the first 100 visible classes and students.')}</p>}
        </section>
      )}
    </>
  );
}

function CreateTemplateForm({ orgSlug, onCreated }: { orgSlug: string; onCreated: () => void }) {
  const t = useT();
  const operationKey = useOperationKey();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const description = String(data.get('description') ?? '').trim();
    if (!name) { setError(t('请填写模板名称。', 'Enter a template name.')); return; }
    setSubmitting(true); setMessage(''); setError('');
    try {
      await createTeachingTrainingTemplate(orgSlug, { name, description }, operationKey.get());
      form.reset(); operationKey.reset(); onCreated(); setMessage(t('模板已创建。', 'Template created.'));
    } catch (reason) { setError(teachingErrorMessage(reason, t)); } finally { setSubmitting(false); }
  }
  return (
    <form className="org-form org-subsection" onSubmit={submit} onChange={() => { operationKey.reset(); setMessage(''); }}>
      <fieldset disabled={submitting}>
        <label>{t('模板名称', 'Template name')}<input className="org-form-control" name="name" required maxLength={160} /></label>
        <label className="org-field-wide">{t('说明', 'Description')}<textarea className="org-form-control org-form-textarea" name="description" maxLength={2_000} /></label>
        <div className="org-form-actions"><button className="org-form-button" type="submit">{submitting ? t('创建中…', 'Creating…') : t('创建模板', 'Create template')}</button></div>
      </fieldset>
      <MutationMessage message={error || message} error={!!error} />
    </form>
  );
}
