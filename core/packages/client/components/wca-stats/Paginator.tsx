'use client';

// Ported from packages/client/src/pages/wca_stats/Paginator.tsx.
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { tr } from '@/i18n/tr';

interface Props {
  page: number;
  totalPages: number;
  size: number;
  pageSizeOptions: number[];
  isZh: boolean;
  className?: string;
  onPageChange: (p: number) => void;
  onSizeChange: (s: number) => void;
}

export default function Paginator({
  page, totalPages, size, pageSizeOptions, isZh,
  className = 'wse-pagination', onPageChange, onSizeChange,
}: Props) {
  const [draft, setDraft] = useState(String(page));
  useEffect(() => { setDraft(String(page)); }, [page]);

  const commit = () => {
    const n = parseInt(draft, 10);
    if (!Number.isFinite(n)) { setDraft(String(page)); return; }
    const clamped = Math.max(1, Math.min(totalPages, n));
    if (clamped !== page) onPageChange(clamped);
    else setDraft(String(page));
  };

  return (
    <div className={className}>
      <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft size={14} />
      </button>
      <span className="paginator-text">
        {tr({ zh: '第', en: 'Page' })}{' '}
        <input
          type="number"
          className="paginator-input"
          value={draft}
          min={1}
          max={totalPages}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
          aria-label={tr({ zh: '页码', en: 'Page number'
        })}
        />
        {' / ' + totalPages}
      </span>
      <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        <ChevronRight size={14} />
      </button>
      <select value={size} onChange={e => onSizeChange(parseInt(e.target.value, 10))}>
        {pageSizeOptions.map(s => <option key={s} value={s}>{s}/{tr({ zh: '页', en: 'pg'
        })}</option>)}
      </select>
    </div>
  );
}
