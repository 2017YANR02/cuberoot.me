'use client';

// Minimal shared UI for the de-MUI Roux trainer port.
// Replaces MUI <Dialog>/<DialogTitle>/<DialogContent>/<DialogActions>.
//
// NOTE(reuse): the repo's DonateModal is a self-contained, content-specific modal
// (its own CSS, hard-coded body) — not a generic reusable overlay. There is no
// shared <Modal> primitive in components/, so we ship a small local one here that
// mirrors the DonateModal overlay/escape/body-scroll-lock conventions. Styles live
// in ../roux.css (.roux-modal-*).

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal(props: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  /** when true, clicking the backdrop does NOT close (mirrors MUI disableEscapeKeyDown dialogs) */
  disableBackdropClose?: boolean;
  maxWidth?: number | string;
}) {
  const { open, onClose, title, children, actions, disableBackdropClose, maxWidth } = props;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="roux-modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={disableBackdropClose ? undefined : onClose}
    >
      <div
        className="roux-modal"
        style={maxWidth != null ? { maxWidth } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="roux-modal-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        {title != null && <div className="roux-modal-title">{title}</div>}
        <div className="roux-modal-body">{children}</div>
        {actions != null && <div className="roux-modal-actions">{actions}</div>}
      </div>
    </div>
  );
}

// A plain field label (replaces MUI <FormLabel component="legend">).
export function FieldLabel(props: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`roux-field-label${props.className ? ' ' + props.className : ''}`}>
      {props.children}
    </div>
  );
}
