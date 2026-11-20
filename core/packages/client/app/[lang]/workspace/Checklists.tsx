'use client';
/** @module Named team checklists, using the workspace host and forms. */
import ChecklistPanel from '@/components/workspace/ChecklistPanel';
import { CompactSelect } from '@/components/CompactSelect';
import LiquidGlassChips from '@/components/LiquidGlassChips';
import { useEffect, useRef, useState } from 'react';
import { parseAsInteger, parseAsStringEnum, useQueryState } from 'nuqs';
import { ErrorNotice, Field, Form, EditorDialog, useResource, useWorkspace, value } from '@app-foundation/workspace-ui';
import { type Checklist } from '@cuberoot/shared/workspace-planning';
import { useT } from '@/hooks/useT';

export default function Checklists() {
  const t = useT();
  const { api, Button } = useWorkspace();
  const [page, setPage] = useQueryState('checkPage', parseAsInteger.withDefault(1));
  const [status, setStatus] = useQueryState('checkStatus', parseAsStringEnum(['active', 'all']).withDefault('active'));
  const [itemStatus, setItemStatus] = useState<'active' | 'archived' | 'all'>('active');
  const path = `checklists?${new URLSearchParams({ page: String(page), archived: String(status === 'all') })}`;
  const resource = useResource<{ checklists: Checklist[]; hasMore: boolean; itemArchiveSupported?: boolean }>(path);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [completionStatus, setCompletionStatus] = useState<'all' | 'todo' | 'done'>('all');
  const deletedIds = useRef(new Set<string>());
  const [loadedPath, setLoadedPath] = useState('');
  useEffect(() => {
    if (!resource.data) return;
    setChecklists(previous => resource.data!.checklists.filter(incoming => !deletedIds.current.has(incoming.id)).map(incoming => {
      const saved = previous.find(row => row.id === incoming.id);
      // A delayed refresh may predate a successful local write. Fresh access flags still win.
      return saved && saved.version > incoming.version ? { ...saved, canEdit: incoming.canEdit } : incoming;
    }));
    setLoadedPath(path);
  }, [resource.data, path]);
  const [editing, setEditing] = useState(false);
  const newId = useRef('');
  const lists = resource.error || loadedPath !== path ? [] : checklists.filter(list => status === 'all' || list.active);
  return <>
    <div className="staff-actions workspace-toolbar">
      <CompactSelect ariaLabel={t('筛选', 'Filters')} label={status !== 'active' || itemStatus !== 'active' || completionStatus !== 'all' ? t('筛选 · 已启用', 'Filters · Active') : t('筛选', 'Filters')} items={[]} onChange={() => {}} panelContent={<div className="workspace-check-filters">
        <div className="workspace-check-filter-group"><span>{t('清单', 'Checklists')}</span><LiquidGlassChips ariaLabel={t('清单', 'Checklists')} items={['active', 'all'] as const} value={status} onChange={next => { void setStatus(next); void setPage(1); setEditing(false); }} getLabel={item => item === 'active' ? t('未归档', 'Not archived') : t('含已归档', 'Include archived')} /></div>
        <div className="workspace-check-filter-group"><span>{t('事项归档', 'Task archive')}</span><LiquidGlassChips ariaLabel={t('事项归档', 'Task archive')} items={['active', 'archived', 'all'] as const} value={itemStatus} onChange={setItemStatus} getLabel={item => item === 'active' ? t('未归档', 'Not archived') : item === 'archived' ? t('已归档', 'Archived') : t('全部', 'All')} /></div>
        <div className="workspace-check-filter-group"><span>{t('完成状态', 'Completion')}</span><LiquidGlassChips ariaLabel={t('完成状态', 'Completion')} items={['all', 'todo', 'done'] as const} value={completionStatus} onChange={setCompletionStatus} getLabel={item => item === 'all' ? t('全部', 'All') : item === 'todo' ? t('未完成', 'Incomplete') : t('已完成', 'Completed')} /></div>
        <Button variant="secondary" onClick={() => { void setStatus('active'); void setPage(1); setItemStatus('active'); setCompletionStatus('all'); }}>{t('重置筛选', 'Reset filters')}</Button>
      </div>} />
      <Button action="add" variant="secondary" onClick={() => { newId.current = crypto.randomUUID(); setEditing(true); }}>{t('新建清单', 'New checklist')}</Button>
    </div>
    <ErrorNotice error={resource.error} retry={resource.reload} />
    {resource.loading && <p role="status">{t('正在加载…', 'Loading…')}</p>}
    {editing && <EditorDialog title={t('新建清单', 'New checklist')} onClose={() => setEditing(false)}>
      <Form submit={async data => {
        await api('checklist', { id: newId.current, version: 0, name: value(data, 'name'), active: true, items: [], categories: [] });
        setEditing(false); resource.reload();
      }}>
        <Field label={t('名称', 'Name')}><input name="name" required maxLength={80} /></Field>
        <div className="staff-actions staff-form-actions"><Button action="save" type="submit">{t('保存', 'Save')}</Button></div>
      </Form>
    </EditorDialog>}
    {!resource.loading && resource.data && lists.length === 0 && <p className="staff-empty">{t('暂无清单', 'No checklists')}</p>}
    <div>{lists.map(list => <ChecklistPanel key={list.id} itemStatus={itemStatus} completionStatus={completionStatus} archiveSupported={resource.data?.itemArchiveSupported === true} list={list} reload={resource.reload} onSaved={saved => setChecklists(rows => rows.map(row => row.id === saved.id ? saved : row))} onMoved={resource.reload} onDeleted={() => {
      deletedIds.current.add(list.id);
      setChecklists(rows => rows.filter(row => row.id !== list.id));
      if (lists.length === 1 && page > 1) void setPage(page - 1); else resource.reload();
    }} />)}</div>
    {resource.data && (page > 1 || resource.data.hasMore) && <div className="staff-pagination"><Button action="previous" variant="secondary" disabled={page <= 1} onClick={() => { setEditing(false); void setPage(page - 1); }}>{t('上一页', 'Previous')}</Button><span>{page}</span><Button action="next" variant="secondary" disabled={!resource.data.hasMore} onClick={() => { setEditing(false); void setPage(page + 1); }}>{t('下一页', 'Next')}</Button></div>}
  </>;
}
