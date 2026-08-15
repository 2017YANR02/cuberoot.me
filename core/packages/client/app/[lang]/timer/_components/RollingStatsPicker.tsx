'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Columns3 } from 'lucide-react';
import { ClearButton } from '@/components/ClearButton';
import { tr } from '@/i18n/tr';
import { updateSettings, useSettings } from '../_lib/settings';
import {
  MAX_AO_WINDOW,
  MAX_ROLLING_STAT_COLUMNS,
  MIN_AO_WINDOW,
  ROLLING_STAT_PRESETS,
  sanitizeRollingStatColumns,
  type RollingStatKey,
} from '../_lib/rolling_stats';

interface Props {
  className?: string;
}

export default function RollingStatsPicker({ className }: Props) {
  const settings = useSettings();
  const columns = sanitizeRollingStatColumns(settings.statsRollingColumns);
  const [open, setOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const trigger = wrapRef.current;
    if (!panel || !trigger) return;
    const positionPanel = () => {
      const anchor = trigger.getBoundingClientRect();
      const margin = 8;
      const gap = 6;
      const maxLeft = Math.max(margin, window.innerWidth - panel.offsetWidth - margin);
      const left = Math.min(Math.max(margin, anchor.left), maxLeft);
      const below = anchor.bottom + gap;
      const top = below + panel.offsetHeight <= window.innerHeight - margin
        ? below
        : Math.max(margin, anchor.top - gap - panel.offsetHeight);
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.visibility = 'visible';
    };
    positionPanel();
    window.addEventListener('resize', positionPanel);
    window.addEventListener('scroll', positionPanel, true);
    return () => {
      window.removeEventListener('resize', positionPanel);
      window.removeEventListener('scroll', positionPanel, true);
    };
  }, [open, columns.length]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!wrapRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const atMax = columns.length >= MAX_ROLLING_STAT_COLUMNS;
  const setColumns = (next: RollingStatKey[]) => {
    updateSettings({ statsRollingColumns: sanitizeRollingStatColumns(next) });
  };
  const toggleColumn = (key: RollingStatKey) => {
    if (columns.includes(key)) {
      setColumns(columns.filter(column => column !== key));
      return;
    }
    if (!atMax) setColumns([...columns, key]);
  };
  const addCustom = () => {
    if (atMax) return;
    const size = Math.floor(Number(customDraft.trim()));
    if (!Number.isFinite(size) || size < MIN_AO_WINDOW || size > MAX_AO_WINDOW) return;
    setColumns([...columns, `ao${size}`]);
    setCustomDraft('');
  };

  const label = tr({ zh: '统计列', en: 'Stats columns' });

  return (
    <div className={['rolling-stats-picker', className].filter(Boolean).join(' ')} ref={wrapRef}>
      <button
        type="button"
        className="rolling-stats-trigger"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Columns3 size={13} />
        {label}
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          className="rolling-stats-pop"
          role="dialog"
          aria-label={label}
        >
          <div className="rolling-stats-presets">
            {ROLLING_STAT_PRESETS.map(key => {
              const active = columns.includes(key);
              return (
                <button
                  type="button"
                  key={key}
                  className={`rolling-stats-chip${active ? ' active' : ''}`}
                  onClick={() => toggleColumn(key)}
                  disabled={!active && atMax}
                  aria-pressed={active}
                >
                  {key}
                </button>
              );
            })}
          </div>
          <div className="rolling-stats-custom">
            <label className="rolling-stats-custom-input-wrap">
              <span className="sr-only">{tr({ zh: '自定义 ao 大小', en: 'Custom ao size' })}</span>
              <input
                className="rolling-stats-custom-input"
                type="number"
                inputMode="numeric"
                min={MIN_AO_WINDOW}
                max={MAX_AO_WINDOW}
                value={customDraft}
                placeholder={tr({ zh: '自定义 ao', en: 'Custom ao' })}
                onChange={event => setCustomDraft(event.target.value)}
                onKeyDown={event => { if (event.key === 'Enter') addCustom(); }}
                disabled={atMax}
              />
              {customDraft && <ClearButton onClick={() => setCustomDraft('')} preserveFocus />}
            </label>
            <button type="button" className="rolling-stats-custom-add" onClick={addCustom} disabled={atMax}>
              {tr({ zh: '添加', en: 'Add' })}
            </button>
          </div>
          {atMax && (
            <div className="rolling-stats-hint">
              {tr({
                zh: `最多 ${MAX_ROLLING_STAT_COLUMNS} 列，先取消一列`,
                en: `Up to ${MAX_ROLLING_STAT_COLUMNS} columns; deselect one first`,
              })}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
