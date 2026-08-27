'use client';

import { tr } from '@/i18n/tr';
import { ClearButton } from '@/components/ClearButton';
import { DateInput } from '@/components/DateInput';

export interface DateRangeInputProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  min?: string;
  max?: string;
  fromLabel?: string;
  toLabel?: string;
  ariaLabel?: string;
  className?: string;
  size?: 'default' | 'compact';
  clearable?: boolean;
  disabled?: boolean;
}

export function DateRangeInput({
  from,
  to,
  onChange,
  min,
  max,
  fromLabel,
  toLabel,
  ariaLabel = tr({ zh: '日期范围', en: 'Date range' }),
  className,
  size = 'default',
  clearable = true,
  disabled,
}: DateRangeInputProps) {
  const fromAriaLabel = fromLabel ?? tr({ zh: '开始日期', en: 'Start date' });
  const toAriaLabel = toLabel ?? tr({ zh: '结束日期', en: 'End date' });
  const fromInput = (
    <DateInput
      value={from}
      onChange={(nextFrom) => onChange(nextFrom, to)}
      min={min}
      max={to || max}
      size={size}
      clearable={false}
      disabled={disabled}
      aria-label={fromAriaLabel}
    />
  );
  const toInput = (
    <DateInput
      value={to}
      onChange={(nextTo) => onChange(from, nextTo)}
      min={from || min}
      max={max}
      size={size}
      clearable={false}
      disabled={disabled}
      aria-label={toAriaLabel}
    />
  );

  return (
    <span
      className={['date-range-input', `date-range-input--${size}`, className].filter(Boolean).join(' ')}
      role="group"
      aria-label={ariaLabel}
    >
      {fromLabel ? (
        <label className="date-range-input__field">
          <span className="date-range-input__label">{fromLabel}</span>
          {fromInput}
        </label>
      ) : fromInput}
      <span className="date-range-input__separator" aria-hidden="true">~</span>
      {toLabel ? (
        <label className="date-range-input__field">
          <span className="date-range-input__label">{toLabel}</span>
          {toInput}
        </label>
      ) : toInput}
      {clearable && (from || to) && !disabled && (
        <ClearButton
          className="date-range-input__clear"
          ariaLabel={tr({ zh: '清除日期范围', en: 'Clear date range' })}
          preserveFocus
          onClick={() => onChange('', '')}
        />
      )}
    </span>
  );
}
