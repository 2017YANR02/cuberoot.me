'use client';
/**
 * 纪录选择器 — 自定义下拉,选项渲染为彩色 RecordBadge。
 * Ported from packages/client-vite/src/components/RecordSelect/RecordSelect.tsx.
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { RECORD_OPTIONS, isRecordCodeAllowedFor } from '@/lib/recon-utils';
import { RecordBadge } from '../RecordBadge';
import './record_select.css';

interface RecordSelectProps {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  /** Limit options + show counts (used by ReconListPage). */
  records?: { code: string; count: number }[];
  placeholder?: string;
  /** Solver iso2 — used to filter out continent codes outside that continent. */
  personIso2?: string | null;
}

export function RecordSelect({ value, onChange, className, records, placeholder, personIso2 }: RecordSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const select = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const items: { code: string; count?: number }[] = records
    ?? RECORD_OPTIONS
      .filter(c => isRecordCodeAllowedFor(c, personIso2))
      .map(c => ({ code: c }));
  const current = records?.find(r => r.code === value);
  const emptyLabel = placeholder ?? '-';

  return (
    <div ref={ref} className={`record-select ${className ?? ''}`.trim()}>
      <button
        type="button"
        className="record-select-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="record-select-current">
          {value ? (
            <>
              <RecordBadge record={value} />
              {current?.count != null && <span className="record-select-count">({current.count})</span>}
            </>
          ) : (
            <span className="record-select-empty">{emptyLabel}</span>
          )}
        </span>
        {records && value && (
          <span
            className="record-select-clear"
            role="button"
            aria-label="clear"
            onClick={e => { e.stopPropagation(); onChange(''); }}
          >
            <X size={14} />
          </span>
        )}
        <ChevronDown size={14} className="record-select-chevron" />
      </button>
      {open && (
        <div className="record-select-popup">
          {!records && (
            <button
              type="button"
              className={`record-select-item${value === '' ? ' record-select-item--active' : ''}`}
              onClick={() => select('')}
            >
              <span className="record-select-empty">{emptyLabel}</span>
            </button>
          )}
          {items.map(({ code, count }) => (
            <button
              key={code}
              type="button"
              className={`record-select-item${value === code ? ' record-select-item--active' : ''}`}
              onClick={() => select(code)}
            >
              <RecordBadge record={code} />
              {count != null && <span className="record-select-count">({count})</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
