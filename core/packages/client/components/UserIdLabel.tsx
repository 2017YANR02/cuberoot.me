'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { tr } from '@/i18n/tr';
import './user-id-label.css';

export function UserIdLabel({
  userId,
  full = false,
  copyable = false,
  className,
}: {
  userId: number | null | undefined;
  full?: boolean;
  copyable?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  if (!Number.isSafeInteger(userId) || (userId ?? 0) <= 0) return null;

  const text = `${full ? 'CubeRoot ID' : 'ID'} ${userId}`;
  const classes = `user-id-label${className ? ` ${className}` : ''}`;
  if (!copyable) return <span className={classes}>{text}</span>;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(userId));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable in restricted browser contexts.
    }
  };

  return (
    <button
      type="button"
      className={`${classes} is-copyable`}
      onClick={copy}
      title={copied
        ? tr({ zh: '已复制', en: 'Copied' })
        : tr({ zh: '复制账号 ID', en: 'Copy account ID' })}
    >
      <span>{text}</span>
      {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
    </button>
  );
}
