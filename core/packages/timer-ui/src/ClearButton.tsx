'use client';

import type { JSX } from 'react';

export interface ClearButtonProps {
  onClick: () => void;
  variant?: 'inline' | 'standalone';
  preserveFocus?: boolean;
  className?: string;
  ariaLabel: string;
  title?: string;
}

export function ClearButton({
  onClick,
  variant = 'inline',
  preserveFocus,
  className,
  ariaLabel,
  title,
}: ClearButtonProps): JSX.Element {
  const classNames = [
    'clear-btn',
    variant === 'standalone' ? 'clear-btn--standalone' : '',
    className ?? '',
  ].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      className={classNames}
      onMouseDown={preserveFocus ? (event) => event.preventDefault() : undefined}
      onClick={onClick}
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
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
