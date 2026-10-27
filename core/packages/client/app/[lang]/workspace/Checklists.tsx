'use client';
/** @module Named team checklists, using the workspace host and forms. */
import { useEffect, useRef, useState } from 'react';
import { parseAsInteger, parseAsStringEnum, useQueryState } from 'nuqs';
import { ErrorNotice, Field, Form, EditorDialog, useResource, useWorkspace, value, type ProjectList } from '@app-foundation/workspace-ui';
import { orderChecklistItems, type Checklist, type ChecklistItem } from '@cuberoot/shared/workspace-planning';
import { useT } from '@/hooks/useT';
import { Tooltip } from '@/components/Tooltip';
import { Archive, ArchiveRestore, ChevronsDown, ChevronsUp, ChevronRight, Folder, FolderOpen } from '@app-foundation/icons/lucide';

function groupChecklistItems(items: ChecklistItem[]) {
  const groups = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const path = item.text.trim().match(/^\/[a-z0-9][a-z0-9_-]*(?=\/|\s|$)/i)?.[0] ?? '';
    const group = groups.get(path);
    if (group) group.push(item);
    else groups.set(path, [item]);
  }
  return [...groups].map(([path, rows]) => ({ path, items: orderChecklistItems(rows), completed: rows.filter(item => item.done).length }));
}

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

function ChecklistPanel({ list, itemStatus, archiveSupported, reload, edit, onSaved, onDeleted }: { itemStatus: 'active' | 'archived' | 'all'; archiveSupported: boolean; list: Checklist; reload: () => void; edit: () => void; onSaved: (list: Checklist) => void; onDeleted: () => void }) {
  const t = useT();
  const { api, Button } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<Error>();
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [text, setText] = useState('');
  const editable = list.canEdit && list.active;
  async function save(items: ChecklistItem[]) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(undefined);
    try { const saved = await api<{ version: number }>('checklist', { ...list, items }); onSaved({ ...list, items, version: saved.version }); }
    catch (cause) { setError(cause instanceof Error ? cause : new Error(t('保存失败', 'Save failed'))); throw cause; }
    finally { lock.current = false; setBusy(false); }
  }
  async function remove() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(undefined);
    try { await api('checklist-delete', { id: list.id, version: list.version }); onDeleted(); }
    catch (cause) { setError(cause instanceof Error ? cause : new Error(t('删除失败', 'Delete failed'))); throw cause; }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="staff-panel workspace-checklist" aria-busy={busy}>
    <div className="workspace-list-heading"><h2>{list.name}</h2>{(list.projectName || !list.active) && <span className="staff-muted">{list.projectName}{!list.active && `${list.projectName ? ' · ' : ''}${t('已归档', 'Archived')}`}</span>}{list.canEdit && <div className="staff-toolbar-actions"><Button action="edit" variant="secondary" disabled={busy} onClick={edit}>{t('编辑', 'Edit')}</Button><Button action="delete" variant="secondary" disabled={busy} aria-label={`${t('删除清单', 'Delete checklist')}: ${list.name}`} onClick={() => setDeleting(true)}>{t('删除清单', 'Delete checklist')}</Button></div>}</div>
    <ErrorNotice error={error} retry={reload} />
    <div className="workspace-check-tree">{groupChecklistItems(list.items.filter(item => itemStatus === 'all' || (itemStatus === 'archived' ? item.archived : !item.archived))).map(group => <details key={group.path} className="workspace-check-folder">
      <summary>
        <ChevronRight className="workspace-check-chevron" size={16} aria-hidden="true" />
        <Folder className="workspace-check-folder-closed" size={20} aria-hidden="true" />
        <FolderOpen className="workspace-check-folder-open" size={20} aria-hidden="true" />
        <span className="workspace-check-folder-name">{group.path || t('其他', 'Other')}</span>
        <span className="workspace-check-count" aria-label={`${t('已完成', 'Completed')}: ${group.completed} / ${group.items.length}`}>{group.completed}/{group.items.length}</span>
      </summary>
      <ul className="workspace-check-items">{group.items.map(item => <li key={item.id} className={item.done ? 'workspace-check-item is-done' : 'workspace-check-item'}>
      {/* allow-checkbox: Checklist completion is a task checkbox, not a settings switch. */}
      <input type="checkbox" checked={item.done} disabled={!editable || busy || !!item.archived} aria-label={`${t('完成', 'Complete')}: ${item.text}`} onChange={() => { void save(list.items.map(row => row.id === item.id ? { ...row, done: !row.done } : row)).catch(() => {}); }} />
      <span className="workspace-check-text">{item.text.trim().slice(group.path.length).trim() || item.text}</span>{editable && !item.archived && <Button action="edit" variant="secondary" disabled={busy} onClick={() => setEditing(item.id)}>{t('编辑', 'Edit')}</Button>}
      {editable && archiveSupported && (item.done || item.archived) && <Tooltip content={item.archived ? t('恢复事项', 'Restore task') : t('归档事项', 'Archive task')}>{tip => <button {...tip} type="button" className="btn workspace-icon-action workspace-action" data-emphasis="quiet" disabled={busy} aria-label={`${item.archived ? t('恢复事项', 'Restore task') : t('归档事项', 'Archive task')}: ${item.text}`} onClick={() => { void save(list.items.map(row => row.id === item.id ? { ...row, archived: !item.archived } : row)).catch(() => {}); }}>{item.archived ? <ArchiveRestore size={20} aria-hidden="true" /> : <Archive size={20} aria-hidden="true" />}</button>}</Tooltip>}
      </li>)}</ul>
    </details>)}</div>
    {editable && <Form submit={async () => { if (!text.trim()) return; await save([...list.items, { id: crypto.randomUUID(), text: text.trim(), done: false }]); setText(''); }}><div className="workspace-add-item"><input className="workspace-add-input" aria-label={t('新增事项', 'New task')} placeholder={t('新增事项…', 'Add a task…')} value={text} onChange={event => setText(event.target.value)} required maxLength={160} /><Button action="add" type="submit" disabled={!text.trim() || busy || list.items.length >= 200}>{t('添加', 'Add')}</Button></div></Form>}
    {editing && editable && <EditorDialog title={t('编辑事项', 'Edit task')} onClose={() => setEditing(null)}><Form submit={async data => { await save(list.items.map(row => row.id === editing ? { ...row, text: value(data, 'text') } : row)); setEditing(null); }}><Field label={t('事项', 'Task')}><input name="text" required maxLength={160} defaultValue={list.items.find(item => item.id === editing)?.text} /></Field><div className="staff-actions staff-form-actions"><Button action="save" type="submit" disabled={busy}>{t('保存', 'Save')}</Button></div></Form></EditorDialog>}
    {deleting && list.canEdit && <EditorDialog title={t('删除清单', 'Delete checklist')} onClose={() => setDeleting(false)}><Form submit={remove}>
      <p><strong>{list.name}</strong><span className="staff-muted"> · {list.items.length} {t('项', 'tasks')}</span></p>
      <p>{t('清单及其中全部事项将被删除，无法恢复。', 'This checklist and all its tasks will be permanently deleted.')}</p>
      <div className="staff-actions staff-form-actions"><Button variant="secondary" onClick={() => setDeleting(false)} disabled={busy}>{t('取消', 'Cancel')}</Button><Button action="delete" iconOnly={false} className="workspace-danger-action" type="submit" disabled={busy}>{t('删除清单', 'Delete checklist')}</Button></div>
    </Form></EditorDialog>}
  </section>;
}
