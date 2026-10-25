'use client';
/** @module Reusable schedules with grouped tasks, milestones and shifted copies. */
import { useEffect, useRef, useState } from 'react';
import { parseAsInteger, parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import { ErrorNotice, Field, Form, EditorDialog, useResource, useWorkspace, value, today, type ProjectList, type StaffActor } from '@app-foundation/workspace-ui';
import { copyScheduleTasks, planningDate, scheduleRange, type Schedule, type ScheduleTask } from '@cuberoot/shared/workspace-planning';
import { useT } from '@/hooks/useT';
import { DateInput } from '@/components/DateInput';
import ScheduleTimeline from './ScheduleTimeline';

export default function Schedules({ actor }: { actor: StaffActor }) {
  const t = useT();
  const { api, Button } = useWorkspace();
  const [selected, setSelected] = useQueryState('schedule', parseAsString.withDefault(''));
  const [page, setPage] = useQueryState('schedulePage', parseAsInteger.withDefault(1));
  const [scale, setScale] = useQueryState('scale', parseAsStringEnum(['fit', 'day', 'week', 'month']).withDefault('fit'));
  const [status, setStatus] = useState('active');
  const resource = useResource<{ schedules: Schedule[]; selected: Schedule | null; hasMore: boolean }>(`schedules?${new URLSearchParams({ page: String(page), archived: String(status === 'all'), id: selected })}`);
  const projects = useResource<ProjectList>('projects');
  const [editing, setEditing] = useState<'new' | 'settings' | 'copy' | null>(null);
  const [removing, setRemoving] = useState(false);
  const [deletedIds, setDeletedIds] = useState(() => new Set<string>());
  const [task, setTask] = useState<ScheduleTask | null>(null);
  const [editorScope, setEditorScope] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const operation = useRef(0);
  const live = useRef(false);
  useEffect(() => { live.current = true; return () => { live.current = false; operation.current++; }; }, []);
  useEffect(() => { operation.current++; setTask(null); setEditing(null); setRemoving(false); }, [selected]);
  const newId = useRef('');
  const manager = actor.kind === 'admin' || actor.role === 'manager';
  const schedules = (resource.data?.schedules ?? []).filter(row => !deletedIds.has(row.id));
  const selectedSchedule = resource.data?.selected;
  const schedule = (selectedSchedule && !deletedIds.has(selectedSchedule.id) ? selectedSchedule : undefined) ?? schedules.find(row => row.id === selected) ?? schedules[0];
  const choices = schedule && !schedules.some(row => row.id === schedule.id) ? [schedule, ...schedules] : schedules;
  const editable = Boolean(schedule?.canEdit && schedule.active);
  const groups = [...new Set(schedule?.tasks.map(row => row.group) ?? [])];
  const range = scheduleRange(schedule?.tasks ?? []);
  async function mutate(body: unknown, done: (saved: { id: string }) => void, action: 'schedule' | 'schedule-delete' = 'schedule') {
    const token = operation.current;
    setBusy(true);
    try {
      const saved = await api<{ id: string }>(action, body);
      if (live.current && action === 'schedule-delete') setDeletedIds(ids => new Set([...ids, saved.id]));
      if (live.current && token === operation.current) { done(saved); resource.reload(); }
      else if (live.current && action === 'schedule-delete') resource.reload();
    } finally { if (live.current) setBusy(false); }
  }
  async function saveTasks(tasks: ScheduleTask[]) {
    if (!schedule) return;
    if ((scheduleRange(tasks)?.days ?? 0) > 732) throw new Error(t('单份排期最多跨两年', 'A schedule can span up to two years'));
    await mutate({ ...schedule, tasks }, () => setTask(null));
  }
  function begin(mode: 'new' | 'settings' | 'copy') { operation.current++; setEditorScope(schedule?.id ?? null); newId.current = crypto.randomUUID(); setEditing(mode); setRemoving(false); setTask(null); }
  function editTask(next: ScheduleTask) { operation.current++; setEditorScope(schedule?.id ?? null); setEditing(null); setTask(next); }
  return <fieldset disabled={busy} className="workspace-controls workspace-schedules" aria-busy={busy}>
    <div className="staff-actions workspace-toolbar">
      <Field label={t('排期', 'Schedule')}><select className="workspace-toolbar-select" value={schedule?.id ?? ''} onChange={event => { void setSelected(event.target.value); setEditing(null); setTask(null); }}><option value="" disabled>{t('选择排期', 'Select schedule')}</option>{choices.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
      <Field label={t('视图', 'View')}><select className="workspace-toolbar-select" value={scale} onChange={event => void setScale(event.target.value as typeof scale)}><option value="fit">{t('总览', 'Overview')}</option><option value="day">{t('日', 'Day')}</option><option value="week">{t('周', 'Week')}</option><option value="month">{t('月', 'Month')}</option></select></Field>
      <Field label={t('状态', 'Status')}><select className="workspace-toolbar-select" value={status} onChange={event => { setStatus(event.target.value); setEditing(null); setTask(null); }}><option value="active">{t('进行中', 'Active')}</option><option value="all">{t('含已归档', 'Include archived')}</option></select></Field>
      {manager && <Button className="workspace-text-action" action="add" iconOnly={false} variant="secondary" onClick={() => begin('new')}>{t('新建排期', 'New schedule')}</Button>}
      <div className="staff-toolbar-actions"><Button action="reload" variant="secondary" onClick={() => { setEditing(null); setTask(null); resource.reload(); }}>{t('重新加载', 'Reload')}</Button>
        {schedule?.canEdit && <Button action="settings" variant="secondary" onClick={() => begin('settings')}>{t('设置', 'Settings')}</Button>}
        {schedule && manager && <Button action="copy" variant="secondary" onClick={() => begin('copy')}>{t('复制排期', 'Copy schedule')}</Button>}
      </div>
    </div>
    <ErrorNotice error={resource.error} retry={resource.reload} />
    <ErrorNotice error={projects.error} retry={projects.reload} />
    {resource.loading && <p role="status">{t('正在加载…', 'Loading…')}</p>}
    {editing && editorScope === (schedule?.id ?? null) && <EditorDialog title={editing === 'new' ? t('新建排期', 'New schedule') : editing === 'copy' ? t('复制排期', 'Copy schedule') : t('排期设置', 'Schedule settings')} onClose={() => setEditing(null)}>
      <Form key={`${editing}:${schedule?.id ?? ''}`} submit={async (data, action) => {
        if (action === 'remove') {
          if (!removing || editing !== 'settings' || !schedule?.canEdit) return;
          await mutate({ id: schedule.id, version: schedule.version }, () => {
            setEditing(null); setRemoving(false); void setSelected('');
            if (schedules.length === 1 && page > 1) void setPage(page - 1);
          }, 'schedule-delete');
          return;
        }
        if (!projects.data || !resource.data) throw new Error(t('请先加载排期和项目', 'Load schedules and projects first'));
        const current = editing === 'settings' ? schedule : undefined;
        const tasks = editing === 'copy' && schedule ? copyScheduleTasks(schedule.tasks, value(data, 'start'), () => crypto.randomUUID()) : current?.tasks ?? [];
        await mutate({ id: current?.id ?? newId.current, version: current?.version ?? 0, name: value(data, 'name'), projectId: current ? current.projectId : value(data, 'projectId') || null, active: value(data, 'active') === 'true', tasks }, saved => { void setSelected(saved.id); setEditing(null); });
      }}>
        <Field label={t('名称', 'Name')}><input name="name" required maxLength={80} defaultValue={editing === 'settings' ? schedule?.name : editing === 'copy' ? `${schedule?.name ?? ''} ${t('副本', 'copy')}`.slice(0, 80) : ''} /></Field>
        <div className="staff-form-row">
          <Field label={t('共享范围', 'Shared with')}><select name="projectId" disabled={editing === 'settings' || !projects.data} defaultValue={editing === 'new' ? '' : schedule?.projectId ?? ''}><option value="">{t('公司全员', 'All employees')}</option>{projects.data?.projects.filter(project => project.active || project.id === schedule?.projectId).map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></Field>
          <Field label={t('状态', 'Status')}><select name="active" defaultValue={String(editing === 'settings' ? schedule?.active : true)}><option value="true">{t('进行中', 'Active')}</option><option value="false">{t('已归档', 'Archived')}</option></select></Field>
        </div>
        {editing === 'copy' && !!schedule?.tasks.length && <Field width="date" label={t('新的开始日期', 'New start date')}><DateInput name="start" required defaultValue={planningDate(scheduleRange(schedule.tasks)!.start)} /></Field>}
        {removing && schedule && <p role="alert"><strong>{schedule.name}</strong> · {t('任务数', 'Tasks')}: {schedule.tasks.length}<br />{t('排期及其中全部任务、里程碑将被删除，无法恢复。', 'This schedule and all its tasks and milestones will be permanently deleted.')}</p>}
        <div className="staff-actions staff-form-actions">{editing === 'settings' && schedule?.canEdit && (removing ? <><Button variant="secondary" disabled={busy} onClick={() => setRemoving(false)}>{t('取消删除', 'Cancel deletion')}</Button><Button action="delete" iconOnly={false} className="workspace-danger-action" type="submit" value="remove" formNoValidate disabled={busy}>{t('确认删除', 'Confirm deletion')}</Button></> : <Button action="delete" iconOnly={false} className="workspace-danger-action" disabled={busy} onClick={() => setRemoving(true)}>{t('删除当前排期', 'Delete current schedule')}</Button>)}{!removing && <Button action="save" type="submit">{t('保存', 'Save')}</Button>}</div>
      </Form>
    </EditorDialog>}
    {schedule && <>
      <div className="workspace-list-heading workspace-schedule-heading"><span className="staff-muted">{schedule.projectName ?? t('公司全员', 'All employees')}{!schedule.active && ` · ${t('已归档', 'Archived')}`}</span>
        {range && <span className="staff-muted">{planningDate(range.start)} – {planningDate(range.end)}</span>}
        {editable && <div className="staff-toolbar-actions"><Button className="workspace-text-action" action="add" iconOnly={false} variant="secondary" onClick={() => editTask({ id: crypto.randomUUID(), name: '', group: groups[0] ?? t('默认分组', 'General'), owner: '', start: today(), end: today(), kind: 'task', progress: 0 })}>{t('新增任务', 'New task')}</Button></div>}
      </div>
      {task && editable && editorScope === schedule.id && <TaskEditor key={`${schedule.id}:${task.id}`} task={task} groups={groups} existing={schedule.tasks.some(row => row.id === task.id)} onCancel={() => setTask(null)} onSave={async next => {
        const tasks = next === null ? schedule.tasks.filter(row => row.id !== task.id) : schedule.tasks.some(row => row.id === next.id) ? schedule.tasks.map(row => row.id === next.id ? next : row) : [...schedule.tasks, next];
        await saveTasks(tasks);
      }} />}
      <ScheduleTimeline key={schedule.id} tasks={schedule.tasks} scale={scale} editable={editable} onEdit={editTask} />
    </>}
    {resource.data && !schedule && !editing && <p className="staff-empty">{t('暂无排期', 'No schedules')}</p>}
    {resource.data && (page > 1 || resource.data.hasMore) && <div className="staff-pagination"><Button action="previous" variant="secondary" disabled={page <= 1} onClick={() => { void setSelected(''); void setPage(page - 1); }}>{t('上一页', 'Previous')}</Button><span>{page}</span><Button action="next" variant="secondary" disabled={!resource.data.hasMore} onClick={() => { void setSelected(''); void setPage(page + 1); }}>{t('下一页', 'Next')}</Button></div>}
  </fieldset>;
}

function TaskEditor({ task, groups, existing, onSave, onCancel }: { task: ScheduleTask; groups: string[]; existing: boolean; onSave: (task: ScheduleTask | null) => Promise<void>; onCancel: () => void }) {
  const t = useT();
  const { Button } = useWorkspace();
  const [kind, setKind] = useState(task.kind);
  const [start, setStart] = useState(task.start);
  const [removing, setRemoving] = useState(false);
  return <EditorDialog title={existing ? t('编辑任务', 'Edit task') : t('新增任务', 'New task')} onClose={onCancel}><Form submit={async (data, action) => {
    if (action === 'remove') { await onSave(null); return; }
    const end = kind === 'milestone' ? start : value(data, 'end');
    if (start > end) throw new Error(t('结束日期须不早于开始日期', 'End date must not precede start date'));
    await onSave({ id: task.id, name: value(data, 'name'), group: value(data, 'group'), owner: value(data, 'owner'), start, end, kind, progress: Number(value(data, 'progress')) });
  }}>
    <Field label={t('名称', 'Name')}><input name="name" required maxLength={120} defaultValue={task.name} /></Field>
    <div className="staff-form-row"><Field label={t('分组', 'Group')}><input name="group" required maxLength={60} defaultValue={task.group} list="workspace-schedule-groups" /><datalist id="workspace-schedule-groups">{groups.map(group => <option key={group} value={group} />)}</datalist></Field><Field label={t('负责人（选填）', 'Owner (optional)')}><input name="owner" maxLength={60} defaultValue={task.owner} /></Field></div>
    <div className="staff-form-row"><Field label={t('类型', 'Type')}><select value={kind} onChange={event => setKind(event.target.value as ScheduleTask['kind'])}><option value="task">{t('任务', 'Task')}</option><option value="milestone">{t('里程碑', 'Milestone')}</option></select></Field><Field width="short" label={t('进度 %', 'Progress %')}><input name="progress" type="number" min={0} max={100} step={1} required defaultValue={task.progress} /></Field></div>
    <div className="staff-form-row"><Field width="date" label={t('开始日期', 'Start date')}><DateInput name="start" required value={start} onChange={setStart} /></Field>{kind === 'task' && <Field width="date" label={t('结束日期', 'End date')}><DateInput name="end" required min={start} defaultValue={task.end} /></Field>}</div>
    {removing && <p role="alert">{t('移除这个任务？保存后将不再显示在排期中。', 'Remove this task from the schedule?')}</p>}
    <div className="staff-actions staff-form-actions">{existing && (removing ? <><Button variant="secondary" onClick={() => setRemoving(false)}>{t('保留任务', 'Keep task')}</Button><Button action="delete" iconOnly={false} type="submit" variant="secondary" value="remove" formNoValidate>{t('确认移除', 'Remove task')}</Button></> : <Button action="delete" variant="secondary" onClick={() => setRemoving(true)}>{t('移除任务', 'Remove task')}</Button>)}<Button action="save" type="submit">{t('保存', 'Save')}</Button></div>
  </Form></EditorDialog>;
}
