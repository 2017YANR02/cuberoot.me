'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import {
  TRAINING_EVIDENCE_SOURCES,
  TRAINING_SOURCE_ACTIVITIES,
  hasTeachingPermission,
  type TeachingOrganizationRole,
  type TeachingTrainingTemplate,
  type TrainingEvidenceActivity,
  type TrainingEvidenceSource,
} from '@cuberoot/shared/teaching';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import {
  archiveTeachingTrainingTemplate,
  createTeachingTrainingTemplateVersion,
  getTeachingTrainingTemplate,
  listTeachingTrainingTemplateVersions,
} from '@/lib/teaching-saas-api';
import { trainingSourceLabel } from '@/lib/teaching-training';
import OrgWorkspace from '../../../../_components/OrgWorkspace';
import { entityStatusLabel, MutationMessage, teachingErrorMessage, useOperationKey, useTeachingPage } from '../../../../_components/OrgUi';

const PAGE_SIZE = 100;

export default function TrainingTemplatePage() {
  const params = useParams<{ lang: string; orgSlug: string; templateId: string }>();
  const language = params.lang === 'zh' ? 'zh' : 'en';
  return (
    <OrgWorkspace orgSlug={params.orgSlug}>
      {(organization) => <TemplateContent orgSlug={params.orgSlug} templateId={params.templateId} role={organization.role} language={language} />}
    </OrgWorkspace>
  );
}

function TemplateContent({ orgSlug, templateId, role, language }: { orgSlug: string; templateId: string; role: TeachingOrganizationRole; language: 'zh' | 'en' }) {
  const t = useT();
  const [template, setTemplate] = useState<TeachingTrainingTemplate | null>(null);
  const [loadError, setLoadError] = useState('');
  const loader = useCallback(() => listTeachingTrainingTemplateVersions(orgSlug, templateId, 1, PAGE_SIZE), [orgSlug, templateId]);
  const versions = useTeachingPage(loader);
  const canManage = hasTeachingPermission(role, 'training:template:manage');

  const loadTemplate = useCallback(async () => {
    try {
      setTemplate(await getTeachingTrainingTemplate(orgSlug, templateId));
      setLoadError('');
    } catch (reason) {
      setLoadError(teachingErrorMessage(reason, t));
    }
  }, [orgSlug, t, templateId]);

  useEffect(() => { void loadTemplate(); }, [loadTemplate]);

  if (loadError) return <MutationMessage message={loadError} error />;
  if (!template) return <p aria-busy="true">{t('正在加载模板…', 'Loading template…')}</p>;

  return (
    <>
      <AppLink href={`/org/${orgSlug}/training`} prefetch={false}>{t('训练任务', 'Training assignments')}</AppLink>
      <div className="org-heading-row"><h2>{template.name}</h2><span className="org-status">{entityStatusLabel(template.status, t)}</span></div>
      <p className="org-lead">{template.description || t('暂无模板说明。', 'No template description.')}</p>

      <section className="org-section">
        <h2>{t('模板版本', 'Template versions')}</h2>
        {versions.loading ? <p aria-busy="true">{t('正在加载…', 'Loading…')}</p> : versions.error ? <MutationMessage message={versions.error} error /> : !versions.result?.items.length ? (
          <p className="org-empty">{t('还没有可用于布置任务的版本。', 'No version is available for assignments yet.')}</p>
        ) : (
          <div className="org-list">
            {versions.result.items.map((version) => (
              <div className="org-row" key={version.id}>
                <div className="org-row-main">
                  <div className="org-row-title">v{version.versionNumber} {version.title}</div>
                  <div className="org-row-meta">{trainingSourceLabel(version.source, language)} / {version.activity} / {new Date(version.publishedAt).toLocaleString()}</div>
                  <p>{version.instructions}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {canManage && template.status === 'active' && (
        <section className="org-section">
          <h2>{t('发布新版本', 'Publish a new version')}</h2>
          <CreateVersionForm orgSlug={orgSlug} templateId={templateId} language={language} onCreated={versions.reload} />
          <ArchiveTemplateButton orgSlug={orgSlug} template={template} onArchived={(next) => setTemplate(next)} />
        </section>
      )}
    </>
  );
}

function CreateVersionForm({ orgSlug, templateId, language, onCreated }: { orgSlug: string; templateId: string; language: 'zh' | 'en'; onCreated: () => void }) {
  const t = useT();
  const operationKey = useOperationKey();
  const [source, setSource] = useState<TrainingEvidenceSource>('timer');
  const activities = useMemo(() => TRAINING_SOURCE_ACTIVITIES[source] as readonly TrainingEvidenceActivity[], [source]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get('title') ?? '').trim();
    const instructions = String(data.get('instructions') ?? '').trim();
    const activity = String(data.get('activity') ?? '') as TrainingEvidenceActivity;
    if (!title || !instructions || !activities.includes(activity)) {
      setError(t('请完整填写版本信息。', 'Complete the version details.'));
      return;
    }
    setSubmitting(true); setMessage(''); setError('');
    try {
      await createTeachingTrainingTemplateVersion(orgSlug, templateId, {
        title,
        instructions,
        source,
        activity,
        toolConfig: { schemaVersion: 1 },
      }, operationKey.get());
      form.reset(); operationKey.reset(); onCreated(); setMessage(t('新版本已发布。', 'New version published.'));
    } catch (reason) {
      setError(teachingErrorMessage(reason, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="org-form" onSubmit={submit} onChange={() => { operationKey.reset(); setMessage(''); }}>
      <fieldset disabled={submitting}>
        <label>{t('版本标题', 'Version title')}<input name="title" required maxLength={160} /></label>
        <label>{t('主站工具', 'Main-site tool')}
          <select name="source" value={source} onChange={(event) => { setSource(event.target.value as TrainingEvidenceSource); operationKey.reset(); }}>
            {TRAINING_EVIDENCE_SOURCES.map((item) => <option value={item} key={item}>{trainingSourceLabel(item, language)}</option>)}
          </select>
        </label>
        <label>{t('训练活动', 'Activity')}
          <select name="activity" key={source}>{activities.map((activity) => <option value={activity} key={activity}>{activity}</option>)}</select>
        </label>
        <label className="org-field-wide">{t('训练说明', 'Instructions')}<textarea name="instructions" required maxLength={8_000} /></label>
        <p className="org-help org-field-wide">{t('这里仅保存教学说明和主站工具类型，不复制计时器或训练器。', 'This stores teaching instructions and the canonical tool type; it does not duplicate a timer or trainer.')}</p>
        <div className="org-form-actions"><button type="submit">{submitting ? t('发布中…', 'Publishing…') : t('发布版本', 'Publish version')}</button></div>
      </fieldset>
      <MutationMessage message={error || message} error={!!error} />
    </form>
  );
}

function ArchiveTemplateButton({ orgSlug, template, onArchived }: { orgSlug: string; template: TeachingTrainingTemplate; onArchived: (template: TeachingTrainingTemplate) => void }) {
  const t = useT();
  const operationKey = useOperationKey();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  async function archive() {
    setSubmitting(true); setError('');
    try {
      onArchived(await archiveTeachingTrainingTemplate(orgSlug, template.id, operationKey.get()));
      operationKey.reset();
    } catch (reason) {
      setError(teachingErrorMessage(reason, t));
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div className="org-subsection">
      <p className="org-help">{t('归档后不能再创建版本，已有任务和历史仍保留。', 'Archiving stops new versions while preserving assignments and history.')}</p>
      <button type="button" className="org-secondary-button" disabled={submitting} onClick={() => { void archive(); }}>{submitting ? t('归档中…', 'Archiving…') : t('归档模板', 'Archive template')}</button>
      <MutationMessage message={error} error />
    </div>
  );
}
