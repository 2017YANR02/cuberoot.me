'use client';

import { useState } from 'react';
import { ErrorNotice, Field, Form, useResource, useWorkspace, value } from '@app-foundation/workspace-ui';
import { PROJECT_MAX_CENTS, type ProjectAssignee, type ProjectTask, type ProjectTaskList } from '@cuberoot/shared/workspace-planning';
import { DateInput } from '@/components/DateInput';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { WorkspaceButton as Button, WorkspaceDialog } from './WorkspaceControls';
import { formatCnyCents, parseCnyCents } from './workspace-money';

type EditTarget = { id: string; task?: ProjectTask };

export default function ProjectTasks({ onAccepted }: { onAccepted?: () => void }) {
  const t = useT();
  const lang = useLang();
  const { api, formatName = name => name } = useWorkspace();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const { data, loading, reload, error } = useResource<ProjectTaskList>(`project-tasks?page=${page}`);
  const labels = {
    proposed: t('待员工确认', 'Awaiting employee confirmation'),
    in_progress: t('进行中', 'In progress'),
    submitted: t('待验收', 'Awaiting review'),
    accepted: t('已验收', 'Accepted'),
  };
  return <section className="staff-panel">
    <div className="staff-actions">
      <h2>{t('项目任务', 'Project tasks')}</h2>
      {data?.canManage && !error && <Button action="add" iconOnly={false} onClick={() => setEditing({ id: crypto.randomUUID() })}>
        {t('新建项目任务', 'New project task')}
      </Button>}
    </div>
    <ErrorNotice error={error} retry={reload} />
    {loading && <p role="status">{t('正在加载…', 'Loading…')}</p>}
    {!loading && !error && data?.tasks.length === 0 && <p className="staff-empty">{t('暂无项目任务', 'No project tasks')}</p>}
    {!error && <div className="staff-feed">
      {data?.tasks.map(task => {
        const own = task.userId === data.viewerUserId;
        const canEdit = data.canManage && (task.status === 'proposed' || task.status === 'in_progress');
        const canReview = data.canManage && task.status === 'submitted';
        const canSubmit = own && task.status === 'in_progress';
        const canAgree = own && task.status === 'proposed';
        return <article key={task.id} className="staff-panel">
          <h3>{task.title}</h3>
          <p className="staff-muted">{data.canManage && <>{formatName(task.assignee)} · </>}{labels[task.status]}</p>
          <div className="staff-actions">
            <span>{t('预计交付日期', 'Expected delivery')} {task.dueDate}</span>
            <span>{t('项目金额', 'Project fee')} {formatCnyCents(task.amountCents, lang)}</span>
            {task.bonusCents > 0 && <span>{task.status === 'accepted' ? t('已确认奖金', 'Confirmed bonus') : t('验收奖金', 'Acceptance bonus')} {formatCnyCents(task.bonusCents, lang)}</span>}
          </div>
          <strong>{t('验收标准', 'Acceptance criteria')}</strong>
          <p className="staff-preserve">{task.criteria}</p>
          {(canAgree || canSubmit || canReview) && <Form key={task.version} submit={async (_, decision) => {
            await api('project-task-status', { id: task.id, version: task.version, decision });
            if (decision === 'accept') onAccepted?.();
            reload();
          }}>
            <div className="staff-actions">
              {canAgree && <Button type="submit" value="agree" disabled={loading}>{t('确认项目约定', 'Agree to project terms')}</Button>}
              {canSubmit && <Button type="submit" value="submit" disabled={loading}>{t('提交验收', 'Submit for review')}</Button>}
              {canReview && <>
                <Button type="submit" value="accept" disabled={loading}>
                  {task.bonusCents > 0 ? t('通过验收并确认奖金', 'Accept and confirm bonus') : t('通过验收', 'Accept delivery')}
                </Button>
                <Button type="submit" value="return" variant="secondary" disabled={loading}>{t('退回修改', 'Request changes')}</Button>
              </>}
            </div>
          </Form>}
          {canEdit && <Button action="edit" iconOnly={false} variant="secondary" disabled={loading} onClick={() => setEditing({ id: task.id, task })}>
            {t('编辑任务', 'Edit task')}
          </Button>}
        </article>;
      })}
    </div>}
    {!error && data && (page > 1 || data.hasMore) && <div className="staff-pagination">
      <Button action="previous" variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>{t('上一页', 'Previous')}</Button>
      <span>{page}</span>
      <Button action="next" variant="secondary" disabled={!data.hasMore || loading} onClick={() => setPage(page + 1)}>{t('下一页', 'Next')}</Button>
    </div>}
    {editing && data?.canManage && !error && <ProjectTaskEditor target={editing} assignees={data.assignees}
      onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
  </section>;
}

function ProjectTaskEditor({ target, assignees, onClose, onSaved }: {
  target: EditTarget;
  assignees: ProjectAssignee[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const { api, formatName = name => name } = useWorkspace();
  const { id, task } = target;
  const moneyInput = (name: string, cents: number | undefined, required = false) => <input name={name}
    inputMode="decimal" pattern="[0-9]+(?:[.][0-9]{1,2})?" maxLength={10} required={required}
    defaultValue={cents === undefined ? '' : String(cents / 100)} />;
  return <WorkspaceDialog wide title={task ? t('编辑项目任务', 'Edit project task') : t('新建项目任务', 'New project task')} onClose={onClose}>
    <Form submit={async data => {
      const amountCents = parseCnyCents(value(data, 'amount').trim());
      const bonusCents = parseCnyCents(value(data, 'bonus').trim());
      if (!Number.isInteger(amountCents) || !Number.isInteger(bonusCents) ||
          amountCents <= 0 || amountCents > PROJECT_MAX_CENTS || bonusCents < 0 || bonusCents > PROJECT_MAX_CENTS) {
        throw new Error(t('请填写有效金额，精确到分。每笔金额最高 100 万元。', 'Enter valid amounts with up to two decimal places and a maximum of CNY 1 million each.'));
      }
      await api('project-task', {
        id, version: task?.version ?? 0, userId: task?.userId ?? Number(value(data, 'userId')),
        title: value(data, 'title'), dueDate: value(data, 'dueDate'), criteria: value(data, 'criteria'), amountCents, bonusCents,
      });
      onSaved();
    }}>
      <Field label={t('项目名称', 'Project name')}><input name="title" required maxLength={120} defaultValue={task?.title} /></Field>
      <div className="staff-form-row">
        <Field label={t('员工', 'Employee')}>{task
          ? <input value={formatName(task.assignee)} readOnly />
          : <select name="userId" required defaultValue="">
            <option value="" disabled>{t('选择员工', 'Select employee')}</option>
            {assignees.map(row => <option key={row.userId} value={row.userId}>{formatName(row.name)}</option>)}
          </select>}</Field>
        <Field label={t('预计交付日期', 'Expected delivery')} width="date">
          <DateInput name="dueDate" required defaultValue={task?.dueDate} />
        </Field>
      </div>
      <div className="staff-form-row">
        <Field label={t('项目金额（元）', 'Project fee (CNY)')}>{moneyInput('amount', task?.amountCents, true)}</Field>
        <Field label={t('验收奖金（元，选填）', 'Acceptance bonus (CNY, optional)')}>{moneyInput('bonus', task?.bonusCents)}</Field>
      </div>
      <Field label={t('验收标准', 'Acceptance criteria')} width="wide">
        <textarea name="criteria" required maxLength={3000} rows={4} defaultValue={task?.criteria} />
      </Field>
      <div className="staff-actions staff-form-actions">
        <Button type="submit">{task ? t('保存', 'Save') : t('发给员工确认', 'Send for employee confirmation')}</Button>
      </div>
    </Form>
  </WorkspaceDialog>;
}
