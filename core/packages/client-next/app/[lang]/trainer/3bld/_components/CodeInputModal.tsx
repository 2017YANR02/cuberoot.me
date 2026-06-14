'use client';

// Reusable popup for bulk newline-separated letter-pair code input.
// Used by edge/corner/ltct/parity trainers. Esc closes; backdrop click closes.

import { useEffect, useRef, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { tr } from '@/i18n/tr';

interface SampleButton {
  label: string;
  onClick: () => void;
}

interface CodeInputModalProps {
  open: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  placeholder?: string;
  /** validation / status message shown above the buttons */
  message?: { text: string; kind?: 'error' | 'ok' };
  title?: string;
  sampleButton?: SampleButton;
}

export function CodeInputModal({
  open,
  onClose,
  value,
  onChange,
  onConfirm,
  placeholder,
  message,
  title,
  sampleButton,
}: CodeInputModalProps): JSX.Element | null {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    textareaRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const heading = title ?? (tr({ zh: '输入编码', en: 'Enter codes'
}));

  return (
    <div
      className="bld-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bld-modal" role="dialog" aria-modal="true" aria-label={heading}>
        <div className="bld-modal-header">
          <h3 className="bld-modal-title">{heading}</h3>
          <button
            type="button"
            className="bld-modal-close"
            onClick={onClose}
            aria-label={tr({ zh: '关闭', en: 'Close'
            })}
          >
            <X size={18} />
          </button>
        </div>

        <textarea
          ref={textareaRef}
          className="bld-modal-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? (tr({ zh: '每行一个编码,例如 AB', en: 'One code per line, e.g. AB'
        }))}
          spellCheck={false}
        />

        <div className={`bld-modal-msg${message?.kind === 'error' ? ' is-error' : ''}${message?.kind === 'ok' ? ' is-ok' : ''}`}>
          {message?.text ?? ''}
        </div>

        <div className="bld-modal-actions">
          {sampleButton && (
            <button
              type="button"
              className="bld-btn bld-btn-ghost bld-modal-sample"
              onClick={sampleButton.onClick}
            >
              {sampleButton.label}
            </button>
          )}
          <button
            type="button"
            className="bld-btn bld-btn-ghost"
            onClick={() => onChange('')}
          >
            {tr({ zh: '清空', en: 'Clear' })}
          </button>
          <button type="button" className="bld-btn" onClick={onClose}>
            {tr({ zh: '取消', en: 'Cancel' })}
          </button>
          <button type="button" className="bld-btn bld-btn-primary" onClick={onConfirm}>
            {tr({ zh: '确认', en: 'Confirm'
            })}
          </button>
        </div>
      </div>
    </div>
  );
}
