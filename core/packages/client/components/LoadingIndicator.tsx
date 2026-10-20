'use client';

import type { ReactNode } from 'react';
import { Spinner } from '@/components/Spinner/Spinner';
import { tr } from '@/i18n/tr';
import './loading-indicator.css';

/** Inline feedback for pending content; the surrounding page owns spacing and geometry. */
export function LoadingIndicator({ children }: { children?: ReactNode }) {
  return (
    <span className="loading-indicator" role="status" aria-live="polite">
      <Spinner size={16} />
      <span>{children ?? tr({ zh: '加载中…', en: 'Loading…' })}</span>
    </span>
  );
}
