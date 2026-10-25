'use client';
/** @module Team checklists grouped by category, using the workspace host and forms. */
import { useEffect, useRef, useState } from 'react';
import { parseAsInteger, parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import { ErrorNotice, Field, Form, useResource, useWorkspace, value, type ProjectList } from '@app-foundation/workspace-ui';
import { orderChecklistItems, type Checklist, type ChecklistItem } from '@cuberoot/shared/workspace-planning';
import { useT } from '@/hooks/useT';

export default function Checklists() {
  const t = useT();
  const { api, Button } = useWorkspace();
  const [page, setPage] = useQueryState('checkPage', parseAsInteger.withDefault(1));
  const [category, setCategory] = useQueryState('checkCategory', parseAsString.withDefault(''));
  const [status, setStatus] = useQueryState('checkStatus', parseAsStringEnum(['active', 'all']).withDefault('active'));
  const path = `checklists?${new URLSearchParams({ page: String(page), category, archived: String(status === 'all') })}`;
  const resource = useResource<{ checklists: Checklist[]; categories: string[]; hasMore: boolean }>(path);
  const projects = useResource<ProjectList>('projects');
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loadedPath, setLoadedPath] = useState('');
  useEffect(() => {
    if (!resource.data) return;
    setChecklists(previous => resource.data!.checklists.map(incoming => {
      const saved = previous.find(row => row.id === incoming.id);
      // A delayed refresh may predate a successful local write. Fresh access flags still win.
      return saved && saved.version > incoming.version ? { ...saved, canEdit: incoming.canEdit, projectName: incoming.projectName, projectActive: incoming.projectActive } : incoming;
    }));
    setLoadedPath(path);
  }, [resource.data, path]);
  const [editing, setEditing] = useState<Checklist | 'new' | null>(null);
  const newId = useRef('');
  const current = editing && editing !== 'new' ? editing : undefined;
  const categories = resource.data?.categories ?? [...new Set(checklists.map(list => list.category))];
  const lists = resource.error || loadedPath !== path ? [] : checklists;
  return <>
    <div className="staff-actions workspace-toolbar">
      <Button onClick={() => { newId.current = crypto.randomUUID(); setEditing('new'); }}>{t('新建清单', 'New checklist')}</Button>
      <Button variant="secondary" onClick={() => { setEditing(null); resource.reload(); }}>{t('重新加载', 'Reload')}</Button>
      <Field label={t('分类', 'Category')}><select className="workspace-toolbar-select" value={category} onChange={event => { void setCategory(event.target.value); void setPage(1); setEditing(null); }}><option value="">{t('全部分类', 'All categories')}</option>{categories.map(name => <option key={name}>{name}</option>)}</select></Field>
      <Field label={t('状态', 'Status')}><select className="workspace-toolbar-select" value={status} onChange={event => { void setStatus(event.target.value as typeof status); void setPage(1); setEditing(null); }}><option value="active">{t('进行中', 'Active')}</option><option value="all">{t('含已归档', 'Include archived')}</option></select></Field>
    </div>
    <ErrorNotice error={resource.error} retry={resource.reload} />
    <ErrorNotice error={projects.error} retry={projects.reload} />
    {resource.loading && <p role="status">{t('正在加载…', 'Loading…')}</p>}
    {editing && <section className="staff-panel"><h2>{current ? t('编辑清单', 'Edit checklist') : t('新建清单', 'New checklist')}</h2>
      <Form key={current?.id ?? 'new'} submit={async data => {
        if (!projects.data) throw new Error(t('请先加载项目', 'Load projects first'));
        await api('checklist', { id: current?.id ?? newId.current, version: current?.version ?? 0, projectId: current?.projectId ?? (value(data, 'projectId') || null), name: value(data, 'name'), category: value(data, 'category'), active: value(data, 'active') === 'true', items: current?.items ?? [] });
        setEditing(null); resource.reload();
      }}>
        <div className="staff-form-row">
          <Field label={t('名称', 'Name')}><input name="name" required maxLength={80} defaultValue={current?.name} /></Field>
          <Field label={t('分类', 'Category')}><input name="category" required maxLength={60} defaultValue={current?.category ?? category} list="workspace-checklist-categories" /><datalist id="workspace-checklist-categories">{categories.map(name => <option key={name} value={name} />)}</datalist></Field>
        </div>
        <div className="staff-form-row">
          <Field label={t('共享范围', 'Shared with')}><select name="projectId" disabled={!!current || !projects.data} defaultValue={current?.projectId ?? ''}><option value="">{t('公司全员', 'All employees')}</option>{projects.data?.projects.filter(project => project.active || project.id === current?.projectId).map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></Field>
          <Field label={t('状态', 'Status')}><select name="active" defaultValue={String(current?.active ?? true)}><option value="true">{t('进行中', 'Active')}</option><option value="false">{t('已归档', 'Archived')}</option></select></Field>
        </div>
        <div className="staff-actions"><Button type="submit">{t('保存', 'Save')}</Button><Button variant="secondary" onClick={() => setEditing(null)}>{t('取消', 'Cancel')}</Button></div>
      </Form>
    </section>}
    {!resource.loading && resource.data && lists.length === 0 && <p className="staff-empty">{t('暂无清单', 'No checklists')}</p>}
    {categories.filter(name => lists.some(list => list.category === name)).map(name => <section key={name} className="workspace-category"><h2>{name}</h2>
      {lists.filter(list => list.category === name).map(list => <ChecklistPanel key={list.id} list={list} reload={resource.reload} edit={() => setEditing(list)} onSaved={saved => setChecklists(rows => rows.map(row => row.id === saved.id ? saved : row))} />)}
    </section>)}
    {resource.data && (page > 1 || resource.data.hasMore) && <div className="staff-pagination"><Button variant="secondary" disabled={page <= 1} onClick={() => { setEditing(null); void setPage(page - 1); }}>{t('上一页', 'Previous')}</Button><span>{page}</span><Button variant="secondary" disabled={!resource.data.hasMore} onClick={() => { setEditing(null); void setPage(page + 1); }}>{t('下一页', 'Next')}</Button></div>}
  </>;
}

function ChecklistPanel({ list, reload, edit, onSaved }: { list: Checklist; reload: () => void; edit: () => void; onSaved: (list: Checklist) => void }) {
  const t = useT();
  const { api, Button } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<Error>();
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState('');
  const editable = list.canEdit && list.active;
  async function save(items: ChecklistItem[]) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(undefined);
    try { const saved = await api<{ version: number }>('checklist', { ...list, items }); onSaved({ ...list, items, version: saved.version }); }
    catch (cause) { setError(cause instanceof Error ? cause : new Error(t('保存失败', 'Save failed'))); throw cause; }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="staff-panel workspace-checklist" aria-busy={busy}>
    <div className="workspace-list-heading"><h3>{list.name}</h3><span className="staff-muted">{list.projectName ?? t('公司全员', 'All employees')}{!list.active && ` · ${t('已归档', 'Archived')}`}</span>{list.canEdit && <Button variant="secondary" disabled={busy} onClick={edit}>{t('编辑', 'Edit')}</Button>}</div>
    <ErrorNotice error={error} retry={reload} />
    <ul className="workspace-check-items">{orderChecklistItems(list.items).map(item => <li key={item.id} className={item.done ? 'workspace-check-item is-done' : 'workspace-check-item'}>
      {/* allow-checkbox: Checklist completion is a task checkbox, not a settings switch. */}
      <input type="checkbox" checked={item.done} disabled={!editable || busy} aria-label={`${t('完成', 'Complete')}: ${item.text}`} onChange={() => { void save(list.items.map(row => row.id === item.id ? { ...row, done: !row.done } : row)).catch(() => {}); }} />
      {editing === item.id ? <Form submit={async data => { await save(list.items.map(row => row.id === item.id ? { ...row, text: value(data, 'text') } : row)); setEditing(null); }}><Field label={t('事项', 'Task')}><input name="text" required maxLength={160} defaultValue={item.text} /></Field><div className="staff-actions"><Button type="submit" disabled={busy}>{t('保存', 'Save')}</Button><Button variant="secondary" onClick={() => setEditing(null)}>{t('取消', 'Cancel')}</Button></div></Form>
        : <><span className="workspace-check-text">{item.text}</span>{editable && <Button variant="secondary" disabled={busy} onClick={() => setEditing(item.id)}>{t('编辑', 'Edit')}</Button>}</>}
    </li>)}</ul>
    {editable && <Form submit={async () => { await save([...list.items, { id: crypto.randomUUID(), text: text.trim(), done: false }]); setText(''); }}><div className="workspace-add-item"><Field label={t('新增事项', 'New task')}><input value={text} onChange={event => setText(event.target.value)} required maxLength={160} /></Field><Button type="submit" disabled={busy || list.items.length >= 200}>{t('添加', 'Add')}</Button></div></Form>}
  </section>;
}
