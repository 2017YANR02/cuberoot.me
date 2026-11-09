'use client';
import SortableList, { replaceSortableItems } from '@/components/SortableList';
import SortableCard from '@/components/SortableCard';
import MoreToggle from '@/components/MoreToggle';
import { useRef, useState } from 'react';
import { ErrorNotice, Field, Form, EditorDialog, useWorkspace, value } from '@app-foundation/workspace-ui';
import { orderChecklistItems, type Checklist, type ChecklistItem } from '@cuberoot/shared/workspace-planning';
import { useCopy } from '@/hooks/useCopy';
import { useT } from '@/hooks/useT';
import { Tooltip } from '@/components/Tooltip';
import { Archive, ArchiveRestore, Folder, FolderOpen, ArrowLeftRight } from '@app-foundation/icons/lucide';

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

export default function ChecklistPanel({ list, presentation = 'tasks', defaultExpanded = false, allowItemDelete = false, itemStatus, archiveSupported, reload, edit, onSaved, onDeleted }: { presentation?: 'tasks' | 'software'; allowItemDelete?: boolean; defaultExpanded?: boolean; itemStatus: 'active' | 'archived' | 'all'; archiveSupported: boolean; list: Checklist; reload: () => void; edit?: () => void; onSaved: (list: Checklist) => void; onDeleted?: () => void }) {
  const t = useT();
  const { api, Button } = useWorkspace();
  const { copy, copiedKey } = useCopy();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<Error>();
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [text, setText] = useState('');
  const editable = list.canEdit && list.active;
  async function save(items: ChecklistItem[], name = list.name) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(undefined);
    try { const saved = await api<{ version: number }>('checklist', { ...list, items, name }); onSaved({ ...list, items, name, version: saved.version }); }
    catch (cause) { setError(cause instanceof Error ? cause : new Error(t('保存失败', 'Save failed'))); throw cause; }
    finally { lock.current = false; setBusy(false); }
  }
  async function remove() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(undefined);
    try { await api('checklist-delete', { id: list.id, version: list.version }); onDeleted?.(); }
    catch (cause) { setError(cause instanceof Error ? cause : new Error(t('删除失败', 'Delete failed'))); throw cause; }
    finally { lock.current = false; setBusy(false); }
  }
  const visibleItems = list.items.filter(item => itemStatus === 'all' || (itemStatus === 'archived' ? item.archived : !item.archived));
  function completion(item: ChecklistItem) {
    return <>
      {/* allow-checkbox: Checklist completion is a task checkbox, not a settings switch. */}
      <input type="checkbox" checked={item.done} disabled={!editable || busy || !!item.archived} aria-label={`${t('完成', 'Complete')}: ${item.text}`} onChange={() => { void save(list.items.map(row => row.id === item.id ? { ...row, done: !row.done } : row)).catch(() => {}); }} />
    </>;
  }
  function actions(item: ChecklistItem) {
    return <>
{editable && !item.archived && <Button action="edit" variant="secondary" disabled={busy} onClick={() => setEditing(item.id)}>{t('编辑', 'Edit')}</Button>}
      {editable && allowItemDelete && <Button action="delete" variant="secondary" disabled={busy} aria-label={`${t('删除事项', 'Delete task')}: ${item.text}`} onClick={() => { void save(list.items.filter(row => row.id !== item.id)).catch(() => {}); }}>{t('删除', 'Delete')}</Button>}
      {editable && archiveSupported && (item.done || item.archived) && <Tooltip content={item.archived ? t('恢复事项', 'Restore task') : t('归档事项', 'Archive task')}>{tip => <button {...tip} type="button" className="btn workspace-icon-action workspace-action" data-emphasis="quiet" disabled={busy} aria-label={`${item.archived ? t('恢复事项', 'Restore task') : t('归档事项', 'Archive task')}: ${item.text}`} onClick={() => { void save(list.items.map(row => row.id === item.id ? { ...row, archived: !item.archived } : row)).catch(() => {}); }}>{item.archived ? <ArchiveRestore size={20} aria-hidden="true" /> : <Archive size={20} aria-hidden="true" />}</button>}</Tooltip>}    </>;
  }
  const isOptional = (item: ChecklistItem) => /可选|按需|optional/i.test(item.text);
  function switchSoftware(item: ChecklistItem) {
    const text = isOptional(item)
      ? item.text.replace(/[，,]?\s*(可选|按需|optional)/gi, '').trim()
      : `${item.text}，${t('可选', 'optional')}`;
    void save([...list.items.filter(row => row.id !== item.id), { ...item, text }]).catch(() => {});
  }
  const softwareGroups = [
    { key: 'required', title: t('必装', 'Required'), optional: false },
    { key: 'optional', title: t('可选', 'Optional'), optional: true },
  ];
  return <section className="staff-panel workspace-checklist" aria-busy={busy}>
    <div className="workspace-list-heading"><h2>{list.name}</h2>{presentation === 'software' && list.canEdit && <Button action="edit" variant="secondary" disabled={busy} aria-label={t('修改清单名称', 'Rename checklist')} onClick={() => setRenaming(true)}>{t('修改清单名称', 'Rename checklist')}</Button>}{(list.projectName || !list.active) && <span className="staff-muted">{list.projectName}{!list.active && `${list.projectName ? ' · ' : ''}${t('已归档', 'Archived')}`}</span>}{list.canEdit && edit && onDeleted && <div className="staff-toolbar-actions"><Button action="edit" variant="secondary" disabled={busy} onClick={edit}>{t('编辑', 'Edit')}</Button><Button action="delete" variant="secondary" disabled={busy} aria-label={`${t('删除清单', 'Delete checklist')}: ${list.name}`} onClick={() => setDeleting(true)}>{t('删除清单', 'Delete checklist')}</Button></div>}</div>
    {presentation === 'software' && <div className="staff-actions"><Button variant="secondary" onClick={() => copy([
      t('按以下清单配置软件。先检查系统与已有安装，只补缺少项，保留配置。标注仅 Windows 的不装到 Mac；可选项按实际用途安装。版本以项目要求为准，从官方渠道核对兼容性并下载。', 'Set up software from this list. Check the OS and existing apps, install only missing items and preserve settings. Skip Windows-only items on Mac; install optional items only as needed. Use project versions and official sources to verify compatibility and download.'),
      ...softwareGroups.map(group => `${group.title}\n${list.items.filter(item => isOptional(item) === group.optional).map(item => item.text).join('\n')}`),
      t('登录和系统授权由本人完成。UU远程验证启动，不自动开启无人值守或分享访问密码；输入法验证切换和输入；ShareX 验证截图，不自动上传。最后报告已完成和未完成项。', 'I handle sign-in and system permissions. Verify UU Remote launches without enabling unattended access or sharing passwords; check input switching and typing; check ShareX capture without automatic uploads. Report completed and unfinished items.'),
    ].join('\n\n'), 'software-install')}>{copiedKey === 'software-install' ? t('已复制', 'Copied') : t('复制安装指令', 'Copy installation prompt')}</Button></div>}
    <ErrorNotice error={error} retry={reload} />
    {presentation === 'software' ? <div className="workspace-software-groups">{softwareGroups.map(group => {
      const rows = visibleItems.filter(item => isOptional(item) === group.optional);
      return <section key={group.key} className="workspace-software-group" aria-label={group.title}>
        <h3>{group.title}</h3>
        <SortableList items={rows} disabled={!editable || busy} onReorder={reordered => { void save(replaceSortableItems(list.items, reordered)).catch(() => {}); }}>
        <table className="workspace-software-table">
          <thead><tr><th scope="col"><span className="sr-only">{t('排序', 'Reorder')}</span></th><th scope="col">{t('软件', 'Software')}</th><th scope="col">{t('简介', 'Description')}</th><th scope="col"><span className="sr-only">{t('操作', 'Actions')}</span></th></tr></thead>
          <tbody>{rows.map(item => {
            const separator = item.text.search(/[:：]/);
            const name = separator < 0 ? item.text : item.text.slice(0, separator);
            const description = separator < 0 ? '' : item.text.slice(separator + 1).replace(/[，,]\s*(可选|按需|optional)/gi, '').trim();
            return <SortableCard as="tr" key={item.id} id={item.id} draggable={editable} disabled={busy} stretch={false} dragLabel={`${t('拖动调整顺序', 'Drag to reorder')}: ${name}`}>
              <td><span className="workspace-software-name">{name}</span></td>
              <td className="workspace-software-description">{description}</td>
              <td><div className="workspace-software-actions">
                {editable && <>
                  {[
                    { label: group.optional ? t('移到必装', 'Move to required') : t('移到可选', 'Move to optional'), icon: <ArrowLeftRight size={18} aria-hidden="true" />, disabled: false, run: () => switchSoftware(item) },
                  ].map(({ label, icon, disabled, run }) => <Tooltip key={label} content={label}>{tip => <button {...tip} type="button" className="btn workspace-icon-action workspace-action" data-emphasis="quiet" aria-label={`${label}: ${name}`} disabled={busy || disabled} onClick={run}>{icon}</button>}</Tooltip>)}
                </>}
                {actions(item)}</div></td>
            </SortableCard>;
          })}</tbody>
        </table>
        </SortableList>
        {!rows.length && <p className="staff-muted">{t('暂无软件', 'No software')}</p>}
      </section>;
    })}</div> : <div className="workspace-check-tree">{groupChecklistItems(visibleItems).map(group => <details key={group.path} className="workspace-check-folder" open={defaultExpanded}>
      <MoreToggle as="summary">

        <Folder className="workspace-check-folder-closed" size={20} aria-hidden="true" />
        <FolderOpen className="workspace-check-folder-open" size={20} aria-hidden="true" />
        <span className="workspace-check-folder-name">{group.path || t('其他', 'Other')}</span>
        <span className="workspace-check-count" aria-label={`${t('已完成', 'Completed')}: ${group.completed} / ${group.items.length}`}>{group.completed}/{group.items.length}</span>
      </MoreToggle>
      <ul className="workspace-check-items">{group.items.map(item => <li key={item.id} className={item.done ? 'workspace-check-item is-done' : 'workspace-check-item'}>
      {completion(item)}
      <span className="workspace-check-text">{item.text.trim().slice(group.path.length).trim() || item.text}</span>{actions(item)}
      </li>)}</ul>
    </details>)}</div>}
    {editable && <Form submit={async () => { if (!text.trim()) return; await save([...list.items, { id: crypto.randomUUID(), text: text.trim(), done: false }]); setText(''); }}><div className="workspace-add-item"><input className="workspace-add-input" aria-label={t('新增事项', 'New task')} placeholder={t('新增事项…', 'Add a task…')} value={text} onChange={event => setText(event.target.value)} required maxLength={160} /><Button action="add" type="submit" disabled={!text.trim() || busy || list.items.length >= 200}>{t('添加', 'Add')}</Button></div></Form>}
    {renaming && list.canEdit && <EditorDialog title={t('修改清单名称', 'Rename checklist')} onClose={() => setRenaming(false)}>
      <Form submit={async data => { await save(list.items, value(data, 'name').trim()); setRenaming(false); }}>
        <Field label={t('名称', 'Name')}><input name="name" required maxLength={80} defaultValue={list.name} /></Field>
        <div className="staff-actions staff-form-actions"><Button action="save" type="submit" disabled={busy}>{t('保存', 'Save')}</Button></div>
      </Form>
    </EditorDialog>}
    {editing && editable && <EditorDialog title={t('编辑事项', 'Edit task')} onClose={() => setEditing(null)}><Form submit={async data => { await save(list.items.map(row => row.id === editing ? { ...row, text: value(data, 'text') } : row)); setEditing(null); }}><Field label={t('事项', 'Task')}><input name="text" required maxLength={160} defaultValue={list.items.find(item => item.id === editing)?.text} /></Field><div className="staff-actions staff-form-actions"><Button action="save" type="submit" disabled={busy}>{t('保存', 'Save')}</Button></div></Form></EditorDialog>}
    {deleting && list.canEdit && <EditorDialog title={t('删除清单', 'Delete checklist')} onClose={() => setDeleting(false)}><Form submit={remove}>
      <p><strong>{list.name}</strong><span className="staff-muted"> · {list.items.length} {t('项', 'tasks')}</span></p>
      <p>{t('清单及其中全部事项将被删除，无法恢复。', 'This checklist and all its tasks will be permanently deleted.')}</p>
      <div className="staff-actions staff-form-actions"><Button variant="secondary" onClick={() => setDeleting(false)} disabled={busy}>{t('取消', 'Cancel')}</Button><Button action="delete" iconOnly={false} className="workspace-danger-action" type="submit" disabled={busy}>{t('删除清单', 'Delete checklist')}</Button></div>
    </Form></EditorDialog>}
  </section>;
}
