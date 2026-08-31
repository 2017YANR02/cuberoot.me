'use client';

import {
  MAX_AO_WINDOW,
  MIN_AO_WINDOW,
  replaceRollingStatColumn,
  rollingStatReplacementOptions,
  sanitizeRollingStatColumns,
  type RollingStatKey,
} from '@cuberoot/shared/timer';
import { useState } from 'react';

import { ClearButton } from './ClearButton';
import { CompactSelect } from './CompactSelect';

export interface TimerRollingStatsPickerLabels {
  changeColumn: (current: RollingStatKey) => string;
  clear: string;
  customPlaceholder: string;
  customSize: string;
  replace: string;
}

export interface TimerRollingStatsPickerProps {
  className?: string;
  columns: readonly RollingStatKey[];
  labels: TimerRollingStatsPickerLabels;
  onColumnsChange: (columns: RollingStatKey[]) => void;
  triggerColumns: readonly RollingStatKey[];
  variant?: 'header' | 'row';
  viewportBottomInset?: number;
}

/** Web/Mobile shared rolling-stat column picker and custom aoN editor. */
export function TimerRollingStatsPicker({
  className,
  columns: rawColumns,
  labels,
  onColumnsChange,
  triggerColumns,
  variant = 'header',
  viewportBottomInset = 0,
}: TimerRollingStatsPickerProps) {
  const columns = sanitizeRollingStatColumns(rawColumns);
  const [customDraft, setCustomDraft] = useState('');

  const replaceColumn = (current: RollingStatKey, replacement: RollingStatKey) => {
    onColumnsChange(replaceRollingStatColumn(columns, current, replacement));
    setCustomDraft('');
  };

  return (
    <div
      className={[
        'rolling-stats-column-pickers',
        `rolling-stats-column-pickers--${variant}`,
        className,
      ].filter(Boolean).join(' ')}
      style={variant === 'header' ? {
        gridColumn: `span ${triggerColumns.length}`,
        gridTemplateColumns: `repeat(${triggerColumns.length}, minmax(0, 1fr))`,
      } : undefined}
    >
      {triggerColumns.map(current => {
        const customSize = Math.floor(Number(customDraft.trim()));
        const customKey: RollingStatKey = `ao${customSize}`;
        const customDisabled = !Number.isFinite(customSize)
          || customSize < MIN_AO_WINDOW
          || customSize > MAX_AO_WINDOW
          || columns.includes(customKey);

        return (
          <CompactSelect
            key={current}
            className="rolling-stats-column-select"
            triggerClassName={variant === 'header' ? 'hao-head' : undefined}
            popupClassName="rolling-stats-menu"
            variant="plain"
            label={current}
            items={rollingStatReplacementOptions(columns).map(key => ({ value: key, label: key }))}
            onChange={replacement => replaceColumn(current, replacement)}
            ariaLabel={labels.changeColumn(current)}
            viewportBottomInset={viewportBottomInset}
            footer={close => (
              <div className="rolling-stats-custom">
                <label className="rolling-stats-custom-input-wrap">
                  <span className="sr-only">{labels.customSize}</span>
                  <input
                    className="rolling-stats-custom-input"
                    type="number"
                    inputMode="numeric"
                    min={MIN_AO_WINDOW}
                    max={MAX_AO_WINDOW}
                    value={customDraft}
                    placeholder={labels.customPlaceholder}
                    onChange={event => setCustomDraft(event.target.value)}
                    onKeyDown={event => {
                      if (event.key !== 'Enter' || customDisabled) return;
                      replaceColumn(current, customKey);
                      close();
                    }}
                  />
                  {customDraft && (
                    <ClearButton
                      ariaLabel={labels.clear}
                      onClick={() => setCustomDraft('')}
                      preserveFocus
                    />
                  )}
                </label>
                <button
                  type="button"
                  className="rolling-stats-custom-add"
                  disabled={customDisabled}
                  onClick={() => {
                    replaceColumn(current, customKey);
                    close();
                  }}
                >
                  {labels.replace}
                </button>
              </div>
            )}
          />
        );
      })}
    </div>
  );
}
