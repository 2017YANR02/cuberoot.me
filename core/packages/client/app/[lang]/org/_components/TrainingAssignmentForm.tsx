'use client';

import { useMemo, useState, type FormEvent } from 'react';
import type {
  TeachingGroup,
  TeachingTrainingAssignmentDetail,
  TeachingTrainingAssignmentGoalInput,
  TeachingTrainingTemplateVersion,
} from '@cuberoot/shared/teaching';
import { useT } from '@/hooks/useT';
import {
  createTeachingTrainingAssignment,
  reviseTeachingTrainingAssignment,
  type TeachingStudent,
} from '@/lib/teaching-saas-api';
import { MutationMessage, teachingErrorMessage, useOperationKey } from './OrgUi';

interface Props {
  orgSlug: string;
  versions: TeachingTrainingTemplateVersion[];
  groups: TeachingGroup[];
  students: TeachingStudent[];
  initial?: TeachingTrainingAssignmentDetail;
  initialGroupIds?: string[];
  initialStudentIds?: string[];
  onSaved?: (detail: TeachingTrainingAssignmentDetail) => void;
}

function localDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function selectedValues(data: FormData, name: string): string[] {
  return Array.from(new Set(data.getAll(name).map(String).filter(Boolean))).sort();
}

export default function TrainingAssignmentForm({
  orgSlug,
  versions,
  groups,
  students,
  initial,
  initialGroupIds = [],
  initialStudentIds = [],
  onSaved,
}: Props) {
  const t = useT();
  const operationKey = useOperationKey();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === initial?.assignment.templateVersionId) ?? versions[0],
    [initial, versions],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const templateVersionId = String(data.get('templateVersionId') ?? '');
    const title = String(data.get('title') ?? '').trim();
    const instructions = String(data.get('instructions') ?? '').trim();
    const expectedCount = Number(data.get('expectedCount'));
    const startsAtRaw = String(data.get('startsAt') ?? '');
    const endsAtRaw = String(data.get('endsAt') ?? '');
    const groupIds = selectedValues(data, 'groupIds');
    const studentIds = selectedValues(data, 'studentIds');
    const goals: TeachingTrainingAssignmentGoalInput[] = [];
    const evidenceCount = Number(data.get('evidenceCount'));
    const durationMinutes = Number(data.get('durationMinutes'));
    const successCount = Number(data.get('successCount'));
    const bestResultSeconds = Number(data.get('bestResultSeconds'));
    if (Number.isSafeInteger(evidenceCount) && evidenceCount > 0) goals.push({ metricKey: 'evidence_count', operator: 'gte', targetValue: evidenceCount });
    if (Number.isSafeInteger(durationMinutes) && durationMinutes > 0) goals.push({ metricKey: 'duration_ms', operator: 'gte', targetValue: durationMinutes * 60_000 });
    if (Number.isSafeInteger(successCount) && successCount > 0) goals.push({ metricKey: 'success_count', operator: 'gte', targetValue: successCount });
    const version = versions.find((item) => item.id === templateVersionId);
    if (version?.source === 'timer' && Number.isFinite(bestResultSeconds) && bestResultSeconds > 0) {
      goals.push({ metricKey: 'best_result_ms', operator: 'lte', targetValue: Math.round(bestResultSeconds * 1_000) });
    }
    if (!version || !title || !instructions || !Number.isSafeInteger(expectedCount) || expectedCount < 1 || expectedCount > 1_000) {
      setError(t('请完整填写任务信息。', 'Complete the assignment details.'));
      return;
    }
    if (!startsAtRaw || (endsAtRaw && Date.parse(endsAtRaw) <= Date.parse(startsAtRaw))) {
      setError(t('结束时间必须晚于开始时间。', 'The end time must be after the start time.'));
      return;
    }
    if (groupIds.length + studentIds.length < 1 || groupIds.length + studentIds.length > 100) {
      setError(t('请选择 1 至 100 个班级或学员目标。', 'Choose between 1 and 100 class or student targets.'));
      return;
    }
    setSubmitting(true);
    setMessage('');
    setError('');
    try {
      const input = {
        templateVersionId,
        title,
        instructions,
        scheduleKind: data.get('scheduleKind') === 'daily' ? 'daily' as const : 'once' as const,
        expectedCount,
        startsAt: new Date(startsAtRaw).toISOString(),
        endsAt: endsAtRaw ? new Date(endsAtRaw).toISOString() : null,
        groupIds,
        studentIds,
        goals,
      };
      const detail = initial
        ? await reviseTeachingTrainingAssignment(orgSlug, initial.assignment.id, input, operationKey.get())
        : await createTeachingTrainingAssignment(orgSlug, input, operationKey.get());
      operationKey.reset();
      setMessage(initial ? t('草稿已更新。', 'Draft updated.') : t('训练任务已创建。', 'Training assignment created.'));
      onSaved?.(detail);
      if (!initial) form.reset();
    } catch (reason) {
      setError(teachingErrorMessage(reason, t));
    } finally {
      setSubmitting(false);
    }
  }

  const goal = (metricKey: TeachingTrainingAssignmentGoalInput['metricKey']) => initial?.goals.find((item) => item.metricKey === metricKey)?.targetValue;

  return (
    <form className="org-form" onSubmit={submit} onChange={() => { operationKey.reset(); setMessage(''); }}>
      <fieldset disabled={submitting || versions.length === 0}>
        <label>{t('模板版本', 'Template version')}
          <select className="org-form-control" name="templateVersionId" defaultValue={selectedVersion?.id ?? ''} required>
            {versions.map((version) => <option key={version.id} value={version.id}>v{version.versionNumber} {version.title}</option>)}
          </select>
        </label>
        <label>{t('任务标题', 'Assignment title')}<input className="org-form-control" name="title" required maxLength={160} defaultValue={initial?.assignment.title ?? ''} /></label>
        <label className="org-field-wide">{t('任务说明', 'Instructions')}<textarea className="org-form-control org-form-textarea" name="instructions" required maxLength={8_000} defaultValue={initial?.assignment.instructions ?? ''} /></label>
        <label>{t('频率', 'Schedule')}
          <select className="org-form-control" name="scheduleKind" defaultValue={initial?.assignment.scheduleKind ?? 'once'}>
            <option value="once">{t('一次性', 'Once')}</option>
            <option value="daily">{t('每天', 'Daily')}</option>
          </select>
        </label>
        <label>{t('期望次数', 'Expected count')}<input className="org-form-control" name="expectedCount" type="number" min={1} max={1_000} step={1} required defaultValue={initial?.assignment.expectedCount ?? 1} /></label>
        <label>{t('开始时间', 'Starts at')}<input className="org-form-control" name="startsAt" type="datetime-local" required defaultValue={localDateTime(initial?.assignment.startsAt)} /></label>
        <label>{t('结束时间（可留空）', 'Ends at (optional)')}<input className="org-form-control" name="endsAt" type="datetime-local" defaultValue={localDateTime(initial?.assignment.endsAt)} /></label>
        <label>{t('班级目标（可多选）', 'Class targets (multiple)')}
          <select className="org-form-control" name="groupIds" multiple size={Math.min(6, Math.max(3, groups.length))} defaultValue={initialGroupIds}>
            {groups.filter((group) => group.status === 'active').map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </label>
        <label>{t('个别学员（可多选）', 'Individual students (multiple)')}
          <select className="org-form-control" name="studentIds" multiple size={Math.min(6, Math.max(3, students.length))} defaultValue={initialStudentIds}>
            {students.filter((student) => student.status === 'active').map((student) => <option key={student.id} value={student.id}>{student.displayName}</option>)}
          </select>
        </label>
        <p className="org-help org-field-wide">{t('Windows 按 Ctrl、多选设备按系统手势选择多个目标。班级发布时会按当时有效学员生成快照。', 'Use Ctrl on Windows or the system multi-select gesture. Publishing snapshots the active students in each class.')}</p>
        <label>{t('证据条数目标（可留空）', 'Evidence goal (optional)')}<input className="org-form-control" name="evidenceCount" type="number" min={1} step={1} defaultValue={goal('evidence_count') ?? ''} /></label>
        <label>{t('训练分钟目标（可留空）', 'Minutes goal (optional)')}<input className="org-form-control" name="durationMinutes" type="number" min={1} step={1} defaultValue={goal('duration_ms') ? Math.round(goal('duration_ms')! / 60_000) : ''} /></label>
        <label>{t('成功次数目标（可留空）', 'Success goal (optional)')}<input className="org-form-control" name="successCount" type="number" min={1} step={1} defaultValue={goal('success_count') ?? ''} /></label>
        <label>{t('最佳成绩秒数（仅计时器）', 'Best seconds (timer only)')}<input className="org-form-control" name="bestResultSeconds" type="number" min="0.001" step="0.001" defaultValue={goal('best_result_ms') ? goal('best_result_ms')! / 1_000 : ''} /></label>
        <div className="org-form-actions"><button className="org-form-button" type="submit">{submitting ? t('保存中…', 'Saving…') : initial ? t('保存草稿', 'Save draft') : t('创建任务', 'Create assignment')}</button></div>
      </fieldset>
      {!versions.length && <p className="org-help org-field-wide">{t('请先创建模板版本。', 'Create a template version first.')}</p>}
      <MutationMessage message={error || message} error={!!error} />
    </form>
  );
}
