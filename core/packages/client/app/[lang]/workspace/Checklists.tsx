'use client';
/** @module Named team checklists, using the workspace host and forms. */
import ChecklistPanel from '@/components/workspace/ChecklistPanel';
import { useEffect, useRef, useState } from 'react';
import { parseAsInteger, parseAsStringEnum, useQueryState } from 'nuqs';
import { ErrorNotice, Field, Form, EditorDialog, useResource, useWorkspace, value, type ProjectList } from '@app-foundation/workspace-ui';
import { type Checklist } from '@cuberoot/shared/workspace-planning';
import { useT } from '@/hooks/useT';
import { Tooltip } from '@/components/Tooltip';
import { ChevronsDown, ChevronsUp } from '@app-foundation/icons/lucide';

export default function Checklists() {
  const t = useT();
  const { api, Button } = useWorkspace();
  const [page, setPage] = useQueryState('checkPage', parseAsInteger.withDefault(1));
  const [status, setStatus] = useQueryState('checkStatus', parseAsStringEnum(['active', 'all']).withDefault('active'));
  const [itemStatus, setItemStatus] = useState<'active' | 'archived' | 'all'>('active');
  const path = `checklists?${new URLSearchParams({ page: String(page), archived: String(status === 'all') })}`;
  const resource = useResource<{ checklists: Checklist[]; hasMore: boolean; itemArchiveSupported?: boolean }>(path);
  const projects = useResource<ProjectList>('projects');
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const listsRef = useRef<HTMLDivElement>(null);
  const [allExpanded, setAllExpanded] = useState(false);
  const deletedIds = useRef(new Set<string>());
  const [loadedPath, setLoadedPath] = useState('');
  useEffect(() => {
    if (!resource.data) return;
    setChecklists(previous => resource.data!.checklists.filter(incoming => !deletedIds.current.has(incoming.id)).map(incoming => {
      const saved = previous.find(row => row.id === incoming.id);
      // A delayed refresh may predate a successful local write. Fresh access flags still win.
      return saved && saved.version > incoming.version ? { ...saved, canEdit: incoming.canEdit, projectName: incoming.projectName, projectActive: incoming.projectActive } : incoming;
    }));
    setLoadedPath(path);
  }, [resource.data, path]);
  const [editing, setEditing] = useState<Checklist | 'new' | null>(null);
  const newId = useRef('');
  const current = editing && editing !== 'new' ? editing : undefined;
  const lists = resource.error || loadedPath !== path ? [] : checklists;
  useEffect(() => {
    const container = listsRef.current;
    if (!container) return;
    const sync = () => {
      const folders = container.querySelectorAll<HTMLDetailsElement>('.workspace-check-folder');
      setAllExpanded(folders.length > 0 && Array.from(folders).every(folder => folder.open));
    };
    sync();
    container.addEventListener('toggle', sync, true);
    return () => container.removeEventListener('toggle', sync, true);
  }, [lists, itemStatus]);
  return <>
    <div className="staff-actions workspace-toolbar">
      <Field label={t('清单状态', 'Checklist status')}><select className="workspace-toolbar-select" value={status} onChange={event => { void setStatus(event.target.value as typeof status); void setPage(1); setEditing(null); }}><option value="active">{t('进行中', 'Active')}</option><option value="all">{t('含已归档', 'Include archived')}</option></select></Field>
      <Field label={t('事项状态', 'Task status')}><select className="workspace-toolbar-select" value={itemStatus} onChange={event => setItemStatus(event.target.value as typeof itemStatus)}><option value="active">{t('未归档', 'Not archived')}</option><option value="archived">{t('已归档', 'Archived')}</option><option value="all">{t('全部', 'All')}</option></select></Field>
      <div className="staff-toolbar-actions"><Tooltip content={allExpanded ? t('收起所有文件夹', 'Collapse all folders') : t('展开所有文件夹', 'Expand all folders')}>{tip => <button {...tip} type="button" className="btn workspace-icon-action workspace-action" data-emphasis="quiet" disabled={lists.length === 0} aria-label={allExpanded ? t('收起所有文件夹', 'Collapse all folders') : t('展开所有文件夹', 'Expand all folders')} onClick={() => { const folders = listsRef.current?.querySelectorAll<HTMLDetailsElement>('.workspace-check-folder'); if (!folders?.length) return; const open = !Array.from(folders).every(folder => folder.open); folders.forEach(folder => { folder.open = open; }); setAllExpanded(open); }}>{allExpanded ? <ChevronsUp size={20} aria-hidden="true" /> : <ChevronsDown size={20} aria-hidden="true" />}</button>}</Tooltip><Button action="add" onClick={() => { newId.current = crypto.randomUUID(); setEditing('new'); }}>{t('新建清单', 'New checklist')}</Button></div>
    </div>
    <ErrorNotice error={resource.error} retry={resource.reload} />
    <ErrorNotice error={projects.error} retry={projects.reload} />
    {resource.loading && <p role="status">{t('正在加载…', 'Loading…')}</p>}
    {editing && <EditorDialog title={current ? t('编辑清单', 'Edit checklist') : t('新建清单', 'New checklist')} onClose={() => setEditing(null)}>
      <Form key={current?.id ?? 'new'} submit={async data => {
        if (!projects.data) throw new Error(t('请先加载项目', 'Load projects first'));
        await api('checklist', { id: current?.id ?? newId.current, version: current?.version ?? 0, projectId: current?.projectId ?? (value(data, 'projectId') || null), name: value(data, 'name'), active: value(data, 'active') === 'true', items: current?.items ?? [] });
        setEditing(null); resource.reload();
      }}>
        <Field label={t('名称', 'Name')}><input name="name" required maxLength={80} defaultValue={current?.name} /></Field>
        <div className="staff-form-row">
          <Field label={t('共享范围', 'Shared with')}><select name="projectId" disabled={!!current || !projects.data} defaultValue={current?.projectId ?? ''}><option value="">{t('公司全员', 'All employees')}</option>{projects.data?.projects.filter(project => project.active || project.id === current?.projectId).map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></Field>
          <Field label={t('状态', 'Status')}><select name="active" defaultValue={String(current?.active ?? true)}><option value="true">{t('进行中', 'Active')}</option><option value="false">{t('已归档', 'Archived')}</option></select></Field>
        </div>
        <div className="staff-actions staff-form-actions"><Button action="save" type="submit">{t('保存', 'Save')}</Button></div>
      </Form>
    </EditorDialog>}
    {!resource.loading && resource.data && lists.length === 0 && <p className="staff-empty">{t('暂无清单', 'No checklists')}</p>}
    <div ref={listsRef}>{lists.map(list => <ChecklistPanel key={list.id} itemStatus={itemStatus} archiveSupported={resource.data?.itemArchiveSupported === true} list={list} reload={resource.reload} edit={() => setEditing(list)} onSaved={saved => setChecklists(rows => rows.map(row => row.id === saved.id ? saved : row))} onDeleted={() => {
      deletedIds.current.add(list.id);
      setChecklists(rows => rows.filter(row => row.id !== list.id));
      if (lists.length === 1 && page > 1) void setPage(page - 1); else resource.reload();
    }} />)}</div>
    {resource.data && (page > 1 || resource.data.hasMore) && <div className="staff-pagination"><Button action="previous" variant="secondary" disabled={page <= 1} onClick={() => { setEditing(null); void setPage(page - 1); }}>{t('上一页', 'Previous')}</Button><span>{page}</span><Button action="next" variant="secondary" disabled={!resource.data.hasMore} onClick={() => { setEditing(null); void setPage(page + 1); }}>{t('下一页', 'Next')}</Button></div>}
  </>;
}
