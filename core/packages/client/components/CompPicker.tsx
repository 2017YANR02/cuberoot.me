'use client';
// Competition search input — ported from packages/client-vite/src/components/CompPicker.tsx.

import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { Flag } from './Flag';
import { loadComps, searchComps, isCancelledComp, type Comp } from '@/lib/comp-search';
import { localizeCompName } from '@/lib/comp-localize';
import { localizeCity } from '@/lib/city-localize';
import { formatDateRangeIso } from '@/lib/wca-date';
import { ClearButton } from './ClearButton';
import './comp-picker.css';

export interface CompPickerPreset {
  icon?: ReactNode;
  label: string;
  value: string;
}

/** Normalize cubing.com / WCA competition URLs to a bare WCA ID. */
export function extractWcaIdFromUrl(input: string): string | null {
  const t = input.trim().replace(/×/g, 'x');
  const cubing = t.match(/cubing\.com\/(?:live|competition)\/([A-Za-z0-9_-]+)/i);
  if (cubing) return cubing[1].replace(/-/g, '');
  const wca = t.match(/worldcubeassociation\.org\/competitions\/([A-Za-z0-9_]+)/i);
  if (wca) return wca[1];
  return null;
}

interface Props {
  value: string;
  onChange: (val: string) => void;
  onPick: (comp: Comp) => void;
  placeholder?: string;
  isZh?: boolean;
  className?: string;
  disableSuggestions?: boolean;
  presets?: CompPickerPreset[];
  onUrlPaste?: (wcaId: string) => void;
  /** Hide competitions that haven't started yet (start_date > today). For
   *  reconstructing past solves, an upcoming comp is never a valid pick. */
  hideFuture?: boolean;
}

export function CompPicker({ value, onChange, onPick, placeholder, isZh, className, disableSuggestions, presets, onUrlPaste, hideFuture }: Props) {
  const [comps, setComps] = useState<Comp[] | null>(null);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Comp[]>([]);
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const displayValue = (() => {
    if (!isZh || focused || !value) return value;
    return localizeCompName('', value, true);
  })();

  const ensureLoaded = useCallback(async () => {
    if (comps) return comps;
    const loaded = await loadComps();
    setComps(loaded);
    return loaded;
  }, [comps]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    if (!open || !value.trim()) { setResults([]); return; }
    (async () => {
      const data = await ensureLoaded();
      if (cancelled) return;
      const pool = hideFuture
        ? data.filter(c => !c.start_date || c.start_date <= new Date().toISOString().slice(0, 10))
        : data;
      setResults(searchComps(value, pool, 20));
    })();
    return () => { cancelled = true; };
  }, [value, open, ensureLoaded, hideFuture]);

  const handlePick = (c: Comp) => {
    onPick(c);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className={`comp-picker ${className ?? ''}`.trim()}>
      <input
        type="text"
        className={value ? 'comp-picker-input--with-clear' : ''}
        value={displayValue}
        onChange={e => {
          const v = e.target.value;
          if (onUrlPaste) {
            const wcaId = extractWcaIdFromUrl(v);
            if (wcaId) { onUrlPaste(wcaId); return; }
          }
          onChange(v);
          setOpen(true);
        }}
        onFocus={() => { setFocused(true); setOpen(true); if (!disableSuggestions) ensureLoaded(); }}
        onBlur={() => { setFocused(false); }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {value && (
        <ClearButton
          onClick={() => { onChange(''); setOpen(false); }}
          isZh={isZh}
          preserveFocus
        />
      )}
      {open && ((presets && presets.length > 0) || (!disableSuggestions && results.length > 0)) && (
        <div className="comp-picker-popup">
          {presets?.map((p, i) => (
            <button
              key={`preset-${i}`}
              type="button"
              className="comp-picker-item comp-picker-item--preset"
              onClick={() => { onChange(p.value); setOpen(false); }}
            >
              {p.icon && <span className="comp-picker-preset-icon">{p.icon}</span>}
              <span className="comp-picker-main">
                <span className="comp-picker-name">{p.label}</span>
              </span>
            </button>
          ))}
          {!disableSuggestions && results.map(c => {
            const displayName = localizeCompName(c.id, c.name, !!isZh);
            const cancelled = isCancelledComp(c);
            return (
              <button
                key={c.id}
                type="button"
                className={`comp-picker-item${cancelled ? ' is-cancelled' : ''}`}
                onClick={() => handlePick(c)}
              >
                <Flag iso2={c.country} />
                <span className="comp-picker-main">
                  <span className="comp-picker-name">{displayName}</span>
                  <span className="comp-picker-meta">
                    <span className="comp-picker-id">{c.id}</span>
                    {c.city ? <> · {localizeCity(c.city, !!isZh, c.country)}</> : null}
                    {' · '}{formatDateRangeIso(c.start_date, c.end_date)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
