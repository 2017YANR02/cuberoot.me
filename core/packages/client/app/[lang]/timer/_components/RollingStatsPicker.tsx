'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Columns3 } from 'lucide-react';
import { ClearButton } from '@/components/ClearButton';
import { tr } from '@/i18n/tr';
import { updateSettings, useSettings } from '../_lib/settings';
import {
  MAX_AO_WINDOW,
  MAX_ROLLING_STAT_COLUMNS,
  MIN_AO_WINDOW,
  ROLLING_STAT_PRESETS,
  replaceRollingStatColumn,
  rollingStatReplacementOptions,
  sanitizeRollingStatColumns,
  type RollingStatKey,
} from '../_lib/rolling_stats';

interface Props {
  className?: string;
  triggerColumns?: RollingStatKey[];
}

export default function RollingStatsPicker({ className, triggerColumns }: Props) {
  const settings = useSettings();
  const columns = sanitizeRollingStatColumns(settings.statsRollingColumns);
  const columnsKey = columns.join(',');
  const [open, setOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<RollingStatKey | null>(null);
  const [customDraft, setCustomDraft] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const trigger = anchorRef.current ?? wrapRef.current;
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
  }, [open, columnsKey, editingColumn]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!wrapRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
        setEditingColumn(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setEditingColumn(null);
      }
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
  const closePicker = () => {
    setOpen(false);
    setEditingColumn(null);
  };
  const openColumnPicker = (key: RollingStatKey, anchor: HTMLElement) => {
    if (open && editingColumn === key) {
      closePicker();
      return;
    }
    anchorRef.current = anchor;
    setEditingColumn(key);
    setCustomDraft('');
    setOpen(true);
  };
  const toggleColumn = (key: RollingStatKey) => {
    if (columns.includes(key)) {
      setColumns(columns.filter(column => column !== key));
      return;
    }
    if (!atMax) setColumns([...columns, key]);
  };
  const selectColumn = (key: RollingStatKey) => {
    if (!editingColumn) {
      toggleColumn(key);
      return;
    }
    setColumns(replaceRollingStatColumn(columns, editingColumn, key));
    closePicker();
  };
  const addCustom = () => {
    if (atMax && !editingColumn) return;
    const size = Math.floor(Number(customDraft.trim()));
    if (!Number.isFinite(size) || size < MIN_AO_WINDOW || size > MAX_AO_WINDOW) return;
    const key: RollingStatKey = `ao${size}`;
    if (columns.includes(key)) return;
    setColumns(editingColumn
      ? replaceRollingStatColumn(columns, editingColumn, key)
      : [...columns, key]);
    setCustomDraft('');
    if (editingColumn) closePicker();
  };

  const label = tr({ zh: '统计列', en: 'Stats columns' });
  const isColumnTrigger = Boolean(triggerColumns?.length);
  const menuOptions = editingColumn
    ? rollingStatReplacementOptions(columns)
    : [
      ...ROLLING_STAT_PRESETS,
      ...columns.filter(key => !ROLLING_STAT_PRESETS.includes(key)),
    ];
  const customDisabled = atMax && !editingColumn;

  return (
    <div
      className={[
        'rolling-stats-picker',
        isColumnTrigger && 'rolling-stats-column-pickers',
        className,
      ].filter(Boolean).join(' ')}
      ref={wrapRef}
      style={isColumnTrigger ? {
        gridColumn: `span ${triggerColumns!.length}`,
        gridTemplateColumns: `repeat(${triggerColumns!.length}, minmax(0, 1fr))`,
      } : undefined}
    >
      {isColumnTrigger ? triggerColumns!.map(key => (
        <button
          type="button"
          className="hao-head rolling-stats-column-trigger"
          key={key}
          onClick={event => openColumnPicker(key, event.currentTarget)}
          aria-expanded={open && editingColumn === key}
          aria-haspopup="dialog"
          aria-label={tr({
            zh: `更改统计列，当前 ${key}`,
            en: `Change stats columns, currently ${key}`,
          })}
        >
          {key}
        </button>
      )) : (
        <button
          type="button"
          className="rolling-stats-trigger"
          onClick={event => {
            anchorRef.current = event.currentTarget;
            setEditingColumn(null);
            setOpen(value => !value);
          }}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <Columns3 size={13} />
          {label}
        </button>
      )}
      {open && createPortal(
        <div
          ref={panelRef}
          className="rolling-stats-pop"
          role="dialog"
          aria-label={label}
        >
          <div className="rolling-stats-options">
            {menuOptions.map(key => {
              const active = !editingColumn && columns.includes(key);
              return (
                <button
                  type="button"
                  key={key}
                  className={`rolling-stats-option${active ? ' active' : ''}`}
                  onClick={() => selectColumn(key)}
                  disabled={!editingColumn && !active && atMax}
                  aria-pressed={editingColumn ? undefined : active}
                >
                  {!editingColumn && (
                    <span className="rolling-stats-option-mark">
                      {active && <Check size={14} aria-hidden="true" />}
                    </span>
                  )}
                  <span>{key}</span>
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
                disabled={customDisabled}
              />
              {customDraft && <ClearButton onClick={() => setCustomDraft('')} preserveFocus />}
            </label>
            <button type="button" className="rolling-stats-custom-add" onClick={addCustom} disabled={customDisabled}>
              {editingColumn
                ? tr({ zh: '替换', en: 'Replace' })
                : tr({ zh: '添加', en: 'Add' })}
            </button>
          </div>
          {atMax && !editingColumn && (
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
