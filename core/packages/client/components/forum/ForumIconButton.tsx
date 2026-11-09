'use client';

import type { LucideIcon } from '@app-foundation/icons/lucide';
import { Tooltip } from '@/components/Tooltip';

export function ForumIconButton({ icon: Icon, label, onClick, className = '', pressed }: {
  icon: LucideIcon; label: string; onClick: () => void; className?: string; pressed?: boolean;
}) {
  return <Tooltip content={label}>{tip => <button
    {...tip} type="button" className={`forum-post-action forum-icon-action ${className}`}
    onClick={onClick} aria-label={label} aria-pressed={pressed}
  ><Icon size={16} aria-hidden="true" /></button>}</Tooltip>;
}
