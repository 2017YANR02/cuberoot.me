'use client';
/**
 * 纪录选择器 — 可编辑 combobox:格子内直接键入过滤,静止时显示彩色 RecordBadge。
 * 提交值始终限定为列表中的选项(键入自由文本若不匹配则回退,不会被采纳)。
 * Ported from packages/client-vite/src/components/RecordSelect/RecordSelect.tsx.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import type { ReconOfficial } from '@cuberoot/shared';
import { RECORD_OPTIONS, isRecordCodeAllowedFor } from '@/lib/recon-utils';
import { tr } from '@/i18n/tr';
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
  /**
   * WCA solves only ever get official R-suffixed codes (WR/NR/…); non-WCA
   * comps and practice solves can't hold an official record, only the
   * unofficial B-suffixed "best" counterpart (WB/NB/…) — so scope the
   * option list accordingly. Omit when `records` is passed (already scoped).
   */
  official?: ReconOfficial;
}

export function RecordSelect({ value, onChange, className, records, placeholder, personIso2, official }: RecordSelectProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const items: { code: string; count?: number }[] = records
    ?? RECORD_OPTIONS
      .filter(c => isRecordCodeAllowedFor(c, personIso2))
      .filter(c => !official || (official === 'wca' ? c.endsWith('R') : c.endsWith('B')))
      .map(c => ({ code: c }));
  const current = records?.find(r => r.code === value);
  const emptyLabel = placeholder ?? '';

  const q = editing ? text.trim().toLowerCase() : '';
  const filtered = useMemo(
    () => (q ? items.filter(it => it.code.toLowerCase().includes(q)) : items),
    [q, items],
  );

  /**
   * 归一键入文本:① 列表里的精确码;② 合法码 + 末尾排名数字(PR2 / FWR2 / NR3)。
   * 返回 '' 表示清空、null 表示非法(保留原值)、否则为规范化后的码。
   */
  const canonicalize = (raw: string): string | null => {
    const t = raw.trim();
    if (t === '') return '';
    const exact = items.find(it => it.code.toLowerCase() === t.toLowerCase());
    if (exact) return exact.code;
    const m = /^(.*?)(\d+)$/.exec(t);
    if (m) {
      const baseMatch = items.find(it => it.code.toLowerCase() === m[1].toLowerCase());
      if (baseMatch) return baseMatch.code + m[2];
    }
    return null;
  };

  /** Validate typed text against the option list (+ trailing rank number); commit only valid values. */
  const commit = () => {
    const c = canonicalize(text);
    if (c === '') { if (value) onChange(''); }
    else if (c != null) onChange(c);
    // else: not a valid code → keep the previous value (revert)
    setEditing(false);
    setOpen(false);
  };

  const select = (next: string) => {
    onChange(next);
    setText(next);
    setEditing(false);
    setOpen(false);
    inputRef.current?.blur();
  };

  // 键入「合法码 + 排名数字」(列表里没有的)时,把它作为合成选项摆进下拉,给出可选反馈。
  const typedExtra = (() => {
    if (!q) return null;
    const c = canonicalize(text);
    if (!c || filtered.some(it => it.code.toLowerCase() === c.toLowerCase())) return null;
    return c;
  })();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // commit current text on outside click
        const c = canonicalize(text);
        if (c === '') { if (value) onChange(''); }
        else if (c != null) onChange(c);
        setEditing(false);
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, text, value, items, onChange]);

  return (
    <div ref={ref} className={`record-select ${className ?? ''}`.trim()}>
      <div className="record-select-box">
        <input
          ref={inputRef}
          type="text"
          className="record-select-input"
          value={editing ? text : ''}
          placeholder={!editing && value ? '' : emptyLabel}
          autoComplete="off"
          spellCheck={false}
          onFocus={e => {
            setEditing(true);
            setText(value || '');
            setOpen(true);
            const el = e.currentTarget;
            requestAnimationFrame(() => el.select());
          }}
          onChange={e => { setText(e.target.value); setOpen(true); }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (filtered.length > 0) select(filtered[0].code);
              else commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setText(value || '');
              setEditing(false);
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          onBlur={commit}
        />
        {!editing && value && (
          <span className="record-select-overlay">
            <RecordBadge record={value} />
            {current?.count != null && <span className="record-select-count">({current.count})</span>}
          </span>
        )}
        {value && (
          <span
            className="record-select-clear"
            role="button"
            aria-label="clear"
            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onChange(''); setText(''); }}
          >
            <X size={14} />
          </span>
        )}
        <ChevronDown size={14} className="record-select-chevron" />
      </div>
      {open && (
        <div className="record-select-popup">
          {typedExtra && (
            <button
              key="__typed"
              type="button"
              className="record-select-item"
              onMouseDown={e => { e.preventDefault(); select(typedExtra); }}
            >
              <RecordBadge record={typedExtra} />
            </button>
          )}
          {filtered.map(({ code, count }) => (
            <button
              key={code}
              type="button"
              className={`record-select-item${value === code ? ' record-select-item--active' : ''}`}
              onMouseDown={e => { e.preventDefault(); select(code); }}
            >
              <RecordBadge record={code} />
              {count != null && <span className="record-select-count">({count})</span>}
            </button>
          ))}
          {filtered.length === 0 && !typedExtra && (
            <div className="record-select-noresult">{tr({ zh: '无匹配', en: 'no match' })}</div>
          )}
        </div>
      )}
    </div>
  );
}
