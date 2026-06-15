'use client';

// Ported from packages/client/src/components/ClearButton.tsx.
import type { JSX } from 'react';
import { tr } from '@/i18n/tr';

interface ClearButtonProps {
  onClick: () => void;
  isZh?: boolean;
  variant?: 'inline' | 'standalone';
  preserveFocus?: boolean;
  className?: string;
  ariaLabel?: string;
  title?: string;
}

export function ClearButton({
  onClick,
  isZh,
  variant = 'inline',
  preserveFocus,
  className,
  ariaLabel,
  title,
}: ClearButtonProps): JSX.Element {
  const label = ariaLabel ?? tr({ zh: '清除', en: 'Clear' });
  const cls = [
    'clear-btn',
    variant === 'standalone' ? 'clear-btn--standalone' : '',
    className ?? '',
  ].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      className={cls}
      onMouseDown={preserveFocus ? (e) => e.preventDefault() : undefined}
      onClick={onClick}
      aria-label={label}
      title={title ?? label}
    >
      <svg className="clear-btn-icon" viewBox="0 0 10 10" aria-hidden="true">
        <path
          d="M2.6 2.6 L7.4 7.4 M7.4 2.6 L2.6 7.4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </button>
  );
}
