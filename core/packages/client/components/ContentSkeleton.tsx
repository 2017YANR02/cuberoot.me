'use client';

import type { CSSProperties } from 'react';
import { useT } from '@/hooks/useT';
import './content-skeleton.css';

export function SkeletonBlock({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <span className={`skeleton-block ${className}`} style={style} aria-hidden="true" />;
}

type SkeletonVariant = 'text' | 'list' | 'feed' | 'table' | 'cards' | 'profile' | 'article' | 'schedule';

/** Content geometry is chosen by the caller; actions keep their own pending feedback. */
export function ContentSkeleton({ variant = 'list', rows, columns, media = false, aspectRatio = '16 / 10', label, className = '' }: {
  variant?: SkeletonVariant; rows?: number; columns?: number; media?: boolean;
  aspectRatio?: string; label?: string; className?: string;
}) {
  const t = useT();
  const count = rows ?? (variant === 'table' ? 6 : variant === 'cards' ? 6 : 3);
  const cols = columns ?? (variant === 'table' || variant === 'profile' ? 5 : variant === 'cards' || variant === 'schedule' ? 3 : 1);
  const lines = <div className="content-skeleton-lines"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div>;
  const table = <div className="content-skeleton-table">{Array.from({ length: count }, (_, row) =>
    <div className="content-skeleton-table-row" key={row}>{Array.from({ length: cols }, (_, col) => <SkeletonBlock key={col} />)}</div>)}</div>;
  return <div className={`content-skeleton content-skeleton--${variant} ${className}`} role="status" aria-busy="true"
    aria-label={label ?? t('加载中…', 'Loading…')}
    style={{ '--skeleton-columns': cols, '--skeleton-aspect': aspectRatio } as CSSProperties}>
    <div className="content-skeleton-layout" aria-hidden="true">
      {variant === 'table' ? table
        : variant === 'profile' ? <><div className="content-skeleton-profile"><SkeletonBlock className="content-skeleton-avatar" />{lines}</div>{table}</>
        : variant === 'article' ? <><SkeletonBlock className="content-skeleton-heading" />{media && <SkeletonBlock className="content-skeleton-media" />}{Array.from({ length: count }, (_, i) => <div className="content-skeleton-paragraph" key={i}>{lines}</div>)}</>
        : variant === 'text' ? lines
        : Array.from({ length: count }, (_, i) => <div className="content-skeleton-item" key={i}>
          {(variant === 'feed' || variant === 'list') && <SkeletonBlock className="content-skeleton-avatar" />}
          {variant === 'cards' && media && <SkeletonBlock className="content-skeleton-media" />}
          {lines}
          {variant === 'feed' && <div className="content-skeleton-body">{lines}</div>}
          {variant === 'schedule' && <><SkeletonBlock className="content-skeleton-slot" /><SkeletonBlock className="content-skeleton-slot" /></>}
        </div>)}
    </div>
  </div>;
}
