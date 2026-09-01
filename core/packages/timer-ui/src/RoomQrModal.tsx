import { Check, Copy, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { renderSVG } from 'uqr';

import './room-qr-modal.css';

export interface RoomQrModalLabels {
  close: string;
  copied: string;
  copyFailed: string;
  copyInvite: string;
  scanToJoin: string;
}

export interface RoomQrModalProps {
  code: string;
  labels: RoomQrModalLabels;
  onClose(): void;
  url: string;
  writeClipboardText(text: string): Promise<void>;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Runtime-shared invite modal used by Web and every installed React host. */
export function RoomQrModal({ code, labels, onClose, url, writeClipboardText }: RoomQrModalProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const onCloseRef = useRef(onClose);
  const resetRef = useRef<number | null>(null);
  const titleId = useId();
  onCloseRef.current = onClose;
  const svg = useMemo(
    () => renderSVG(url, { border: 2, ecc: 'M', blackColor: '#111', whiteColor: '#fff' }),
    [url],
  );

  useEffect(() => {
    mountedRef.current = true;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusableElements = () => Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
    ).filter((element) => element.tabIndex >= 0 && element.getAttribute('aria-hidden') !== 'true');
    const focusFirst = () => (focusableElements()[0] ?? dialogRef.current)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      const focusable = focusableElements();
      if (!dialog || focusable.length === 0) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      const dialog = dialogRef.current;
      if (dialog && event.target instanceof Node && !dialog.contains(event.target)) focusFirst();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    closeRef.current?.focus();
    return () => {
      mountedRef.current = false;
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
      if (resetRef.current !== null) window.clearTimeout(resetRef.current);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="room-qr-backdrop" onClick={() => onCloseRef.current()}>
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="room-qr-modal"
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <button
          aria-label={labels.close}
          className="room-qr-close"
          onClick={() => onCloseRef.current()}
          ref={closeRef}
          type="button"
        >
          <X size={18} />
        </button>
        <h2 id={titleId}>{labels.scanToJoin}</h2>
        <div className="room-qr-code" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="room-qr-code-text">{code}</div>
        <button
          className="room-qr-link"
          onClick={() => {
            void writeClipboardText(url).then(() => {
              if (!mountedRef.current) return;
              setCopyStatus('copied');
              if (resetRef.current !== null) window.clearTimeout(resetRef.current);
              resetRef.current = window.setTimeout(() => setCopyStatus('idle'), 1_200);
            }).catch(() => {
              if (!mountedRef.current) return;
              setCopyStatus('failed');
              if (resetRef.current !== null) window.clearTimeout(resetRef.current);
              resetRef.current = window.setTimeout(() => setCopyStatus('idle'), 1_200);
            });
          }}
          title={labels.copyInvite}
          type="button"
        >
          {copyStatus === 'copied' ? <Check size={13} /> : <Copy size={13} />}
          <span aria-live="polite" className="room-qr-link-text">
            {copyStatus === 'copied'
              ? labels.copied
              : copyStatus === 'failed' ? labels.copyFailed : url}
          </span>
        </button>
      </div>
    </div>,
    document.body,
  );
}
