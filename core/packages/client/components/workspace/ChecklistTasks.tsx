'use client';
/** Explicit checklist sections. Text, completion and classification are independent. */
import { useEffect, useRef, useState } from 'react';
import { ErrorNotice, Field, Form, EditorDialog, useWorkspace } from '@app-foundation/workspace-ui';
import { orderChecklistItems, type Checklist, type ChecklistCategory } from '@cuberoot/shared/workspace-planning';
import { MoreHorizontal } from '@app-foundation/icons/lucide';
import MoreToggle, { MoreTogglePanel } from '@/components/MoreToggle';
import { CompactSelect } from '@/components/CompactSelect';
import { useT } from '@/hooks/useT';
import type { ChecklistPanelProps } from './ChecklistPanel';

type Action = { label: string; run: () => void; disabled?: boolean; danger?: boolean };
export function ChecklistMenu({ label, actions, disabled }: { label: string; actions: Action[]; disabled?: boolean }) {
  return <CompactSelect ariaLabel={label} label={<MoreHorizontal size={20} aria-hidden="true" />} disabled={disabled}
    popupClassName="workspace-check-menu-panel" unstyledTrigger triggerClassName="btn workspace-icon-action workspace-action workspace-check-menu" items={actions.map((action, index) => ({
      value: index, disabled: action.disabled, label: <span className={action.danger ? 'workspace-danger-action' : undefined}>{action.label}</span>,
    }))} onChange={index => actions[index].run()} />;
}

function InlineName({ initial = '', label, maxLength = 80, save, cancel, continuous = false, onDraft }: {
  initial?: string; label: string; maxLength?: number; save: (text: string) => Promise<void>; cancel: () => void; continuous?: boolean; onDraft?: (text: string) => void;
}) {
  const { Button } = useWorkspace();
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  return <div className="workspace-inline-form"><Form submit={async () => {
    if (busy || !text.trim()) return;
    setBusy(true);
    try { await save(text.trim()); if (continuous) { setText(''); onDraft?.(''); requestAnimationFrame(() => ref.current?.focus()); } }
    finally { setBusy(false); }
  }}><div className="workspace-add-item">
    <input ref={ref} name="text" autoFocus aria-label={label} placeholder={label} value={text} required maxLength={maxLength} readOnly={busy}
      onChange={event => { setText(event.target.value); onDraft?.(event.target.value); }} onKeyDown={event => {
        if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) { if (event.key === 'Enter') event.preventDefault(); return; }
        if (event.key === 'Escape' && !busy) { event.preventDefault(); event.stopPropagation(); cancel(); }
      }} />
    <Button action="save" type="submit" disabled={busy || !text.trim()}>{t('保存', 'Save')}</Button>
    <Button action="cancel" variant="secondary" disabled={busy} onClick={cancel}>{t('取消', 'Cancel')}</Button>
  </div></Form></div>;
}

function MoveTasks({ list, itemIds, saved, close }: { list: Checklist; itemIds: string[]; saved: (lists: Checklist[]) => void; close: () => void }) {
  const { api, Button } = useWorkspace();
  const t = useT();
  const [lists, setLists] = useState<Checklist[]>([]);
  const [targetId, setTargetId] = useState(list.id);
  const [categoryId, setCategoryId] = useState('');
  const [error, setError] = useState<Error>();
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(undefined);
    void (async () => {
      const found: Checklist[] = [];
      for (let page = 1; page <= 10000; page++) {
        const data = await api<{ checklists: Checklist[]; hasMore: boolean }>(`checklists?page=${page}`);
        if (cancelled) return;
        found.push(...data.checklists.filter(row => row.active && row.canEdit));
        if (!data.hasMore) { setLists(found); setLoading(false); return; }
      }
      throw new Error(t('清单过多，请重试', 'Too many checklists; retry'));
    })().catch(cause => { if (!cancelled) { setError(cause); setLoading(false); } });
    return () => { cancelled = true; };
  }, [api, revision, t]);
  const target = lists.find(row => row.id === targetId);
  return <EditorDialog title={t('移动事项', 'Move tasks')} onClose={close}>
    <ErrorNotice error={error} retry={() => setRevision(previous => previous + 1)} />
    {loading && <p role="status">{t('正在加载…', 'Loading…')}</p>}
    <Form submit={async () => {
      if (!target || loading || error) return;
      const result = await api<{ checklists: Checklist[] }>('checklist-move', {
        id: list.id, version: list.version, targetId, targetVersion: target.id === list.id ? list.version : target.version,
        itemIds, categoryId: categoryId || undefined,
      });
      saved(result.checklists); close();
    }}>
      <Field label={t('清单', 'Checklist')}><select value={targetId} disabled={loading} onChange={event => { setTargetId(event.target.value); setCategoryId(''); }}>
        {lists.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select></Field>
      <Field label={t('分类', 'Category')}><select value={categoryId} disabled={!target || loading} onChange={event => setCategoryId(event.target.value)}>
        <option value="">{t('未分类', 'Uncategorized')}</option>
        {(target?.categories ?? []).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
      </select></Field>
      <div className="staff-actions staff-form-actions"><Button type="submit" disabled={!target || loading || !!error}>{t('移动', 'Move')}</Button></div>
    </Form>
  </EditorDialog>;
}

export default function ChecklistTasks({ list, itemStatus, completionStatus = 'all', archiveSupported, reload, onSaved, onDeleted, onMoved, expansion }: ChecklistPanelProps) {
  const { api, Button } = useWorkspace();
  const t = useT();
  const categories = list.categories ?? [];
  const editable = list.canEdit && list.active;
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<Error>();
  const [editing, setEditing] = useState<{ kind: 'list' | 'category' | 'item'; id: string } | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [addingItem, setAddingItem] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<{ name: string; ids: string[]; categoryId?: string; wholeList?: boolean } | null>(null);
  const [moving, setMoving] = useState<string[] | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const storageKey = `workspace-checklist-expanded:${list.id}`;
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}'); if (saved && typeof saved === 'object' && !Array.isArray(saved)) setExpanded(saved); } catch { /* Storage is optional. */ }
  }, [storageKey]);
  const storeExpanded = (next: Record<string, boolean>) => {
    setExpanded(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Storage is optional. */ }
  };
  useEffect(() => {
    if (expansion) storeExpanded(Object.fromEntries(['list', '', ...categories.map(category => category.id)].map(id => [id, expansion.open])));
    // Apply only the explicit toolbar command, not every save or refresh.
  }, [expansion]);
  const visible = list.items.filter(item => (itemStatus === 'all' || (itemStatus === 'archived' ? item.archived : !item.archived))
    && (completionStatus === 'all' || item.done === (completionStatus === 'done')));
  const visibleIds = new Set(visible.map(item => item.id));
  const selectedIds = selected.filter(id => visibleIds.has(id));
  // Hidden rows never remain selected for a later bulk action.
  useEffect(() => { setSelected([]); }, [itemStatus, completionStatus]);
  async function perform(action: () => Promise<void>) {
    if (lock.current) throw new Error(t('正在保存，请稍候', 'Saving; please wait'));
    lock.current = true; setBusy(true); setError(undefined);
    try { await action(); }
    catch (cause) { const failure = cause instanceof Error ? cause : new Error(String(cause)); setError(failure); throw failure; }
    finally { lock.current = false; setBusy(false); }
  }
  async function save(patch: Partial<Pick<Checklist, 'items' | 'categories' | 'name' | 'active'>>) {
    await perform(async () => {
      const next = { ...list, categories, ...patch };
      const result = await api<{ version: number }>('checklist', next);
      onSaved({ ...next, version: result.version });
    });
  }
  const run = (action: () => Promise<void>) => { void action().catch(() => {}); };
  const clearSelection = () => { setSelected([]); setSelecting(false); };
  const removeItems = async (ids: string[], categoryId?: string) => {
    await save({ items: list.items.filter(item => !ids.includes(item.id)), categories: categories.filter(category => category.id !== categoryId) });
    clearSelection();
  };
  const archiveItems = (ids: string[], archived: boolean) => run(async () => {
    await save({ items: list.items.map(item => ids.includes(item.id) ? { ...item, archived } : item) }); clearSelection();
  });
  const newCategory = () => { setAddingCategory(true); storeExpanded({ ...expanded, list: true }); };
  const groups: ChecklistCategory[] = [...categories];
  if (!categories.length || list.items.some(item => !item.categoryId)) groups.push({ id: '', name: t('未分类', 'Uncategorized') });
  const listOpen = expanded.list ?? true;
  return <section className="staff-panel workspace-checklist workspace-task-list" aria-busy={busy}>
    <div className="workspace-list-heading">
      {editing?.kind === 'list' ? <InlineName initial={list.name} label={t('清单名称', 'Checklist name')} cancel={() => setEditing(null)} save={async name => { await save({ name }); setEditing(null); }} /> :
        <MoreToggle expanded={listOpen} onClick={() => storeExpanded({ ...expanded, list: !listOpen })}><h2>{list.name}</h2></MoreToggle>}
      {!list.active && <span className="staff-muted">{t('已归档', 'Archived')}</span>}
      {list.canEdit && <ChecklistMenu label={`${t('清单操作', 'Checklist actions')}: ${list.name}`} disabled={busy} actions={[
        { label: t('重命名', 'Rename'), disabled: !!editing, run: () => setEditing({ kind: 'list', id: list.id }) },
        ...(editable ? [
          { label: t('新建分类', 'New category'), run: newCategory, disabled: categories.length >= 100 },
          { label: t('选择事项', 'Select tasks'), run: () => { setSelecting(true); storeExpanded(Object.fromEntries(['list', ...groups.map(group => group.id)].map(id => [id, true]))); }, disabled: !visible.length },
        ] : []),
        { label: list.active ? t('归档清单', 'Archive checklist') : t('恢复清单', 'Restore checklist'), run: () => run(() => save({ active: !list.active })) },
        ...(onDeleted ? [{ label: t('删除清单', 'Delete checklist'), danger: true, run: () => setDeleting({ name: list.name, ids: list.items.map(item => item.id), wholeList: true }) }] : []),
      ]} />}
    </div>
    <ErrorNotice error={error} retry={reload} />
    <MoreTogglePanel expanded={listOpen}>
      {addingCategory && <InlineName label={t('分类名称', 'Category name')} cancel={() => setAddingCategory(false)} save={async name => {
        const id = crypto.randomUUID(); await save({ categories: [...categories, { id, name }] }); setAddingCategory(false); setAddingItem(id); storeExpanded({ ...expanded, list: true, [id]: true });
      }} />}
      {selecting && <div className="workspace-check-bulk" role="toolbar" aria-label={t('批量操作', 'Bulk actions')}>
        <span>{t('已选择', 'Selected')} {selectedIds.length}</span>
        <Button variant="secondary" onClick={() => setSelected(selectedIds.length === visible.length ? [] : visible.map(item => item.id))}>{selectedIds.length === visible.length ? t('取消全选', 'Deselect all') : t('全选', 'Select all')}</Button>
        <Button variant="secondary" disabled={busy || !selectedIds.length} onClick={() => setMoving(selectedIds)}>{t('移动', 'Move')}</Button>
        {archiveSupported && <ChecklistMenu label={t('归档操作', 'Archive actions')} disabled={busy || !selectedIds.length} actions={[
          { label: t('归档', 'Archive'), run: () => archiveItems(selectedIds, true) }, { label: t('恢复', 'Restore'), run: () => archiveItems(selectedIds, false) },
        ]} />}
        <Button action="delete" disabled={busy || !selectedIds.length} onClick={() => setDeleting({ name: t('所选事项', 'Selected tasks'), ids: selectedIds })}>{t('删除所选事项', 'Delete selected tasks')}</Button>
        <Button action="cancel" variant="secondary" disabled={busy} onClick={clearSelection}>{t('结束选择', 'Finish selection')}</Button>
      </div>}
      <div className="workspace-check-tree">{groups.map((group, index) => {
        const allItems = list.items.filter(item => (item.categoryId ?? '') === group.id);
        const items = orderChecklistItems(visible.filter(item => (item.categoryId ?? '') === group.id));
        const open = expanded[group.id] ?? groups.length === 1;
        return <section key={group.id} className="workspace-check-category">
          <div className="workspace-category-heading">
            {editing?.kind === 'category' && editing.id === group.id ? <InlineName initial={group.name} label={t('分类名称', 'Category name')} cancel={() => setEditing(null)} save={async name => {
              await save({ categories: categories.map(category => category.id === group.id ? { ...category, name } : category) }); setEditing(null);
            }} /> : <MoreToggle expanded={open} onClick={() => storeExpanded({ ...expanded, [group.id]: !open })}>
              <span className="workspace-check-folder-name">{group.name}</span>
              <span className="workspace-check-count" aria-label={`${t('已完成', 'Completed')}: ${allItems.filter(item => item.done).length} / ${allItems.length}`}>{allItems.filter(item => item.done).length}/{allItems.length}</span>
            </MoreToggle>}
            {editable && group.id && <ChecklistMenu label={`${t('分类操作', 'Category actions')}: ${group.name}`} disabled={busy} actions={[
              { label: t('重命名', 'Rename'), disabled: !!editing, run: () => setEditing({ kind: 'category', id: group.id }) },
              ...([-1, 1] as const).map(direction => ({ label: direction < 0 ? t('上移', 'Move up') : t('下移', 'Move down'), disabled: index + direction < 0 || index + direction >= categories.length, run: () => run(async () => {
                const next = [...categories]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; await save({ categories: next });
              }) })),
              { label: t('删除分类', 'Delete category'), danger: true, run: () => {
                const ids = allItems.map(item => item.id);
                if (!ids.length) run(() => removeItems([], group.id)); else setDeleting({ name: group.name, ids, categoryId: group.id });
              } },
            ]} />}
          </div>
          <MoreTogglePanel expanded={open}>
            <ul className="workspace-check-items">{items.map(item => <li key={item.id} className={`workspace-check-item${item.done ? ' is-done' : ''}`}>
              {/* allow-checkbox: Selection and task completion are list actions, not settings switches. */}
              <input type="checkbox" checked={selecting ? selectedIds.includes(item.id) : item.done} disabled={busy || !editable || (!selecting && !!item.archived)}
                aria-label={`${selecting ? t('选择', 'Select') : t('完成', 'Complete')}: ${item.text}`} onChange={() => {
                  if (selecting) setSelected(previous => previous.includes(item.id) ? previous.filter(id => id !== item.id) : [...previous, item.id]);
                  else run(() => save({ items: list.items.map(row => row.id === item.id ? { ...row, done: !row.done } : row) }));
                }} />
              {editing?.kind === 'item' && editing.id === item.id ? <InlineName initial={item.text} label={t('事项', 'Task')} maxLength={160} cancel={() => setEditing(null)} save={async text => {
                await save({ items: list.items.map(row => row.id === item.id ? { ...row, text } : row) }); setEditing(null);
              }} /> : <button type="button" className="workspace-check-text workspace-task-text" disabled={!editable || busy || !!item.archived || !!editing} onClick={() => setEditing({ kind: 'item', id: item.id })}>{item.text}</button>}
              {item.archived && <span className="staff-muted">{t('已归档', 'Archived')}</span>}
              {editable && !selecting && <ChecklistMenu label={`${t('事项操作', 'Task actions')}: ${item.text}`} disabled={busy} actions={[
                { label: t('编辑', 'Edit'), disabled: !!item.archived || !!editing, run: () => setEditing({ kind: 'item', id: item.id }) },
                { label: t('移动到…', 'Move to…'), run: () => setMoving([item.id]) },
                ...(archiveSupported ? [{ label: item.archived ? t('恢复', 'Restore') : t('归档', 'Archive'), run: () => archiveItems([item.id], !item.archived) }] : []),
                { label: t('删除事项', 'Delete task'), danger: true, run: () => run(() => removeItems([item.id])) },
              ]} />}
            </li>)}</ul>
            {!items.length && allItems.length > 0 && <p className="staff-muted">{t('没有符合筛选条件的事项', 'No matching tasks')}</p>}
            {editable && itemStatus !== 'archived' && completionStatus !== 'done' && (addingItem === group.id ? <InlineName initial={drafts[group.id] ?? ''} onDraft={text => setDrafts(previous => ({ ...previous, [group.id]: text }))} label={t('新增事项', 'New task')} maxLength={160} continuous cancel={() => setAddingItem(null)} save={async text => {
              if (list.items.length >= 200) throw new Error(t('清单最多包含 200 个事项', 'A checklist can contain up to 200 tasks'));
              await save({ items: [...list.items, { id: crypto.randomUUID(), text, done: false, ...(group.id ? { categoryId: group.id } : {}) }] });
            }} /> : <button type="button" className="workspace-add-task" disabled={busy || list.items.length >= 200} onClick={() => setAddingItem(group.id)}>{t('＋ 添加事项', '+ Add task')}</button>)}
          </MoreTogglePanel>
        </section>;
      })}</div>
    </MoreTogglePanel>
    {moving && <MoveTasks list={list} itemIds={moving} close={() => setMoving(null)} saved={rows => { rows.forEach(onSaved); onMoved?.(rows); clearSelection(); }} />}
    {deleting && <EditorDialog title={deleting.wholeList ? t('删除清单', 'Delete checklist') : deleting.categoryId ? t('删除分类', 'Delete category') : t('删除事项', 'Delete tasks')} onClose={() => setDeleting(null)}>
      <Form submit={async () => {
        if (deleting.wholeList) await perform(async () => { await api('checklist-delete', { id: list.id, version: list.version }); onDeleted?.(); });
        else await removeItems(deleting.ids, deleting.categoryId);
        setDeleting(null);
      }}>
        <p><strong>{deleting.name}</strong> · {deleting.ids.length} {t('个事项', 'tasks')}</p>
        <p>{t('将永久删除，包含已完成和已归档的事项。', 'Permanently deletes these tasks, including completed and archived tasks.')}</p>
        <div className="staff-actions staff-form-actions"><Button variant="secondary" onClick={() => setDeleting(null)} disabled={busy}>{t('取消', 'Cancel')}</Button><Button action="delete" iconOnly={false} className="workspace-danger-action" type="submit" disabled={busy}>{t('全部删除', 'Delete all')}</Button></div>
      </Form>
    </EditorDialog>}
  </section>;
}
