'use client';

import { TriangleAlert } from 'lucide-react';
import type { ReconSolve } from '@cuberoot/shared';
import { tr } from '@/i18n/tr';
import './recon-completion-badge.css';

export function ReconCompletionBadge({
  status,
  className,
}: {
  status?: ReconSolve['completionStatus'];
  className?: string;
}) {
  if (status !== 'unsolved') return null;
  const label = tr({ zh: '未还原', en: 'Unsolved' });
  return (
    <span
      className={`recon-completion-badge${className ? ` ${className}` : ''}`}
      title={tr({
        zh: '应用打乱和解法后，魔方仍未还原',
        en: 'The puzzle is still unsolved after applying the scramble and solution',
      })}
    >
      <TriangleAlert size={12} strokeWidth={2} aria-hidden />
      {label}
    </span>
  );
}
