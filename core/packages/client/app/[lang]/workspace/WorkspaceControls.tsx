'use client';
/** @module Workspace action buttons and modal editing, adapted to site primitives. */
import { useEffect, useId, useRef, useState } from 'react';
import { Plus, Check, Pencil, Trash2, X, RefreshCw, Search, Copy, Settings2, ChevronLeft, ChevronRight, Send } from '@app-foundation/icons/lucide';
import type { WorkspaceButtonProps, WorkspaceDialogProps, WorkspaceMemberPickerProps } from '@app-foundation/workspace-ui';
import { Tooltip } from '@/components/Tooltip';
import { SearchInput } from '@/components/SearchInput';
import { useModalBackdrop } from '@/hooks/useModalDismiss';
import { useT } from '@/hooks/useT';

const icons = { add: Plus, save: Check, edit: Pencil, delete: Trash2, cancel: X, reload: RefreshCw, filter: Search, copy: Copy, settings: Settings2, previous: ChevronLeft, next: ChevronRight, send: Send };
export function WorkspaceButton({ action, iconOnly = true, variant, size, children, className = '', ...props }: WorkspaceButtonProps) {
  const Icon = action && icons[action];
  const label = props['aria-label'] ?? (typeof children === 'string' ? children : undefined);
  const compact = Boolean(Icon && iconOnly && label);
  const button = (tip = {}) => <button type="button" {...tip} {...props} aria-label={compact ? label : props['aria-label']} className={`btn ${compact ? 'workspace-icon-action' : variant === 'secondary' ? 'btn-secondary' : 'btn-primary'} workspace-action ${className}`} data-emphasis={variant === 'secondary' ? 'quiet' : 'accent'} data-size={size}>
    {Icon && <Icon size={20} aria-hidden="true" />}{!compact && children}
  </button>;
  return compact ? <Tooltip content={label!}>{tip => button(tip)}</Tooltip> : button();
}

export function WorkspaceMemberPicker({ name, label, members, defaultValue }: WorkspaceMemberPickerProps) {
  const t = useT();
  const [selected, setSelected] = useState(() => [...new Set(defaultValue)]);
  const [query, setQuery] = useState('');
  const options = [...members, ...defaultValue.filter(id => !members.some(member => member.id === id)).map(id => ({ id, name: `${t('成员', 'Member')} #${id}`, active: false }))];
  const visible = options.filter(member => `${member.name} ${member.id}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <fieldset className="workspace-member-picker">
    <legend>{label}</legend>
    <div className="workspace-member-picker-toolbar">{/* allow-manual-search: Filtering is live via onChange; Enter only prevents accidental project-form submission. */}<SearchInput value={query} onChange={setQuery} inputClassName="staff-input" placeholder={t('搜索成员', 'Search members')} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} /><span className="staff-muted" role="status">{t('已选', 'Selected')}: {selected.length}</span></div>
    {selected.map(id => <input key={id} type="hidden" name={name} value={id} />)}
    <div className="workspace-member-options">
      {visible.map(member => <label className="workspace-member-option" key={member.id}>
        {/* allow-checkbox: Select project members, not an immediate settings toggle. */}
        <input className="workspace-member-checkbox" type="checkbox" checked={selected.includes(member.id)} onChange={event => setSelected(ids => event.target.checked ? [...ids, member.id] : ids.filter(id => id !== member.id))} />
        <span>{member.name}</span>{!member.active && <small>{t('已停用', 'Inactive')}</small>}
      </label>)}
      {!visible.length && <p className="staff-muted">{query ? t('未找到成员', 'No matching members') : t('暂无成员', 'No members')}</p>}
    </div>
  </fieldset>;
}

export function WorkspaceDialog({ title, children, onClose, wide }: WorkspaceDialogProps) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const initialValues = useRef<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [busy, setBusy] = useState(false);
  const formValues = () => JSON.stringify([...ref.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('.workspace-dialog-body [name]') ?? []].map(input => [input.name, input instanceof HTMLSelectElement && input.multiple ? [...input.selectedOptions].map(option => option.value) : input.value]));
  const requestClose = () => {
    if (ref.current?.querySelector('[aria-busy="true"]')) return;
    if (dirty || (initialValues.current !== null && initialValues.current !== formValues())) setConfirmClose(true); else onClose();
  };
  const backdrop = useModalBackdrop(requestClose, busy);
  useEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement as HTMLElement | null;
    dialog.showModal();
    dialog.querySelector<HTMLElement>('input:not([disabled]):not([readonly]), textarea:not([disabled]), select:not([disabled])')?.focus();
    const frame = requestAnimationFrame(() => { initialValues.current = formValues(); });
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const observer = new MutationObserver(() => setBusy(Boolean(dialog.querySelector('[aria-busy="true"]'))));
    observer.observe(dialog, { subtree: true, attributes: true, attributeFilter: ['aria-busy'] });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); dialog.close(); document.body.style.overflow = previous; if (trigger?.isConnected) trigger.focus(); };
  }, []);
  return <dialog ref={ref} {...backdrop} className={`staff-workspace workspace-dialog${wide ? ' workspace-dialog-wide' : ''}`} aria-labelledby={heading} onCancel={event => { event.preventDefault(); requestClose(); }} onKeyDownCapture={event => { if (event.key === 'Escape' && ref.current?.querySelector('[role="dialog"]')) event.preventDefault(); }} onInputCapture={() => setDirty(true)} onChangeCapture={() => setDirty(true)}>
    <div className="workspace-dialog-surface" data-site-surface="popover">
      <header className="workspace-dialog-heading"><h2 id={heading}>{title}</h2><WorkspaceButton action="cancel" variant="secondary" disabled={busy} onClick={requestClose}>{t('关闭', 'Close')}</WorkspaceButton></header>
      {confirmClose && <div className="workspace-discard" role="alert"><p>{t('放弃未保存的更改？', 'Discard unsaved changes?')}</p><div className="staff-actions"><WorkspaceButton variant="secondary" disabled={busy} onClick={() => setConfirmClose(false)}>{t('继续编辑', 'Keep editing')}</WorkspaceButton><WorkspaceButton disabled={busy} onClick={() => { if (!ref.current?.querySelector('[aria-busy="true"]')) onClose(); }}>{t('放弃更改', 'Discard changes')}</WorkspaceButton></div></div>}
      <div className="workspace-dialog-body">{children}</div>
    </div>
  </dialog>;
}
