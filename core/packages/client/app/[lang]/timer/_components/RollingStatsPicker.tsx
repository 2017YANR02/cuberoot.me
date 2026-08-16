'use client';

import { useState } from 'react';
import { ClearButton } from '@/components/ClearButton';
import { CompactSelect } from '@/components/CompactSelect';
import { tr } from '@/i18n/tr';
import { updateSettings, useSettings } from '../_lib/settings';
import {
  MAX_AO_WINDOW,
  MIN_AO_WINDOW,
  replaceRollingStatColumn,
  rollingStatReplacementOptions,
  sanitizeRollingStatColumns,
  type RollingStatKey,
} from '../_lib/rolling_stats';

interface Props {
  className?: string;
  triggerColumns: RollingStatKey[];
  variant?: 'header' | 'row';
}

export default function RollingStatsPicker({
  className,
  triggerColumns,
  variant = 'header',
}: Props) {
  const settings = useSettings();
  const columns = sanitizeRollingStatColumns(settings.statsRollingColumns);
  const [customDraft, setCustomDraft] = useState('');

  const replaceColumn = (current: RollingStatKey, replacement: RollingStatKey) => {
    updateSettings({
      statsRollingColumns: replaceRollingStatColumn(columns, current, replacement),
    });
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
            ariaLabel={tr({
              zh: `更改统计列，当前 ${current}`,
              en: `Change stats column, currently ${current}`,
            })}
            footer={close => (
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
                    onKeyDown={event => {
                      if (event.key !== 'Enter' || customDisabled) return;
                      replaceColumn(current, customKey);
                      close();
                    }}
                  />
                  {customDraft && <ClearButton onClick={() => setCustomDraft('')} preserveFocus />}
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
                  {tr({ zh: '替换', en: 'Replace' })}
                </button>
              </div>
            )}
          />
        );
      })}
    </div>
  );
}
