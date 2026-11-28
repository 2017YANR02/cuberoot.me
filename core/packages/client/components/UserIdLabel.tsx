'use client';

import { useCopy } from '@/hooks/useCopy';
import { CopySuccessIcon } from '@/components/CopySuccessIcon';
import { Copy } from '@app-foundation/icons/lucide';
import { type ReactNode } from 'react';
import AppLink from '@/components/AppLink';
import { useAuthUser } from '@/lib/auth-store';
import { tr } from '@/i18n/tr';
import './user-id-label.css';

/** Reuse the existing friend search and relationship actions for site identities. */
export function UserContactLink({ userId, children, className, label }: {
  userId?: number | null;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const ownId = useAuthUser()?.uid;
  if (!Number.isSafeInteger(userId) || (userId ?? 0) <= 0) return <span className={className}>{children}</span>;
  return <AppLink href={userId === ownId ? '/account' : `/friends?q=${userId}`}
    className={className} aria-label={label} prefetch={false}>{children}</AppLink>;
}

export function UserIdLabel({
  userId,
  full = false,
  copyable = false,
  contact = false,
  className,
}: {
  userId: number | null | undefined;
  full?: boolean;
  copyable?: boolean;
  contact?: boolean;
  className?: string;
}) {
  const { copied, copy } = useCopy();
  if (!Number.isSafeInteger(userId) || (userId ?? 0) <= 0) return null;

  const text = `${full ? 'CubeRoot ID' : 'ID'} ${userId}`;
  const classes = `user-id-label${className ? ` ${className}` : ''}`;
  if (!copyable) return contact
    ? <UserContactLink userId={userId} className={classes}>{text}</UserContactLink>
    : <span className={classes}>{text}</span>;

  const copyId = () => copy(String(userId));

  return (
    <button
      type="button"
      className={`${classes} is-copyable`}
      onClick={copyId}
      title={copied
        ? tr({ zh: '已复制', en: 'Copied' })
        : tr({ zh: '复制账号 ID', en: 'Copy account ID' })}
    >
      <span>{text}</span>
      {copied ? <CopySuccessIcon size={12} /> : <Copy size={12} aria-hidden="true" />}
    </button>
  );
}
