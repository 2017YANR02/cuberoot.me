'use client';

import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import SkewbImage from './SkewbImage';
import { transftoWCA } from '../_lib/scramble';
import { tr } from '@/i18n/tr';

interface Props {
  open: boolean;
  onClose: () => void;
  id: string;
  setup: string;
  solutions: string[];
  isZh: boolean;
}

export default function HintModal({ open, onClose, id, setup, solutions, isZh }: Props) {
  const titleId = useId();
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) closeBtnRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="sk-modal-overlay" onClick={onClose}>
      <div
        className="sk-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sk-modal-header">
          <h2 id={titleId} className="sk-modal-title">{id}</h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="sk-modal-close"
            onClick={onClose}
            aria-label={tr({ zh: '关闭', en: 'Close'
            })}
          >
            <X size={18} />
          </button>
        </div>

        <div className="sk-modal-image">
          <SkewbImage scramble={transftoWCA(setup)} />
        </div>

        <div className="sk-modal-footer">
          <div className="sk-modal-label">{tr({ zh: '解法', en: 'Solutions' })}</div>
          <ul className="sk-modal-solutions">
            {solutions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
