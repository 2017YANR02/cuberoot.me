'use client';
/** @module Workspace action buttons and modal editing, adapted to site primitives. */
import { useEffect, useId, useRef, useState } from 'react';
import { Plus, Check, Pencil, Trash2, X, RefreshCw, Search, Copy, Settings2, ChevronLeft, ChevronRight, Send } from '@app-foundation/icons/lucide';
import type { WorkspaceButtonProps, WorkspaceDialogProps } from '@app-foundation/workspace-ui';
import { Tooltip } from '@/components/Tooltip';
import { useModalBackdrop } from '@/hooks/useModalDismiss';
import { useT } from '@/hooks/useT';

const icons = { add: Plus, save: Check, edit: Pencil, delete: Trash2, cancel: X, reload: RefreshCw, filter: Search, copy: Copy, settings: Settings2, previous: ChevronLeft, next: ChevronRight, send: Send };
export function WorkspaceButton({ action, iconOnly = true, variant, size, children, className = '', ...props }: WorkspaceButtonProps) {
  const Icon = action && icons[action];
  const label = props['aria-label'] ?? (typeof children === 'string' ? children : undefined);
  const compact = Boolean(Icon && iconOnly && label);
  const button = (tip = {}) => <button type="button" {...tip} {...props} aria-label={compact ? label : props['aria-label']} className={`btn ${variant === 'secondary' ? 'btn-secondary' : 'btn-primary'} workspace-action${compact ? ' workspace-icon-action' : ''} ${className}`} data-size={size}>
    {Icon && <Icon size={20} aria-hidden="true" />}{!compact && children}
  </button>;
  return compact ? <Tooltip content={label!}>{tip => button(tip)}</Tooltip> : button();
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
