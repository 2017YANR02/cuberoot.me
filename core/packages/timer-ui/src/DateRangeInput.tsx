'use client';

import { ClearButton } from './ClearButton';
import { DateInput, type DateInputLabels } from './DateInput';

export interface DateRangeInputLabels {
  dateInput: DateInputLabels;
  dateRange: string;
  startDate: string;
  endDate: string;
  clearDateRange: string;
}

export interface DateRangeInputProps {
  labels: DateRangeInputLabels;
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
  labels,
  from,
  to,
  onChange,
  min,
  max,
  fromLabel,
  toLabel,
  ariaLabel = labels.dateRange,
  className,
  size = 'default',
  clearable = true,
  disabled,
}: DateRangeInputProps) {
  const fromAriaLabel = fromLabel ?? labels.startDate;
  const toAriaLabel = toLabel ?? labels.endDate;
  const fromInput = (
    <DateInput
      labels={labels.dateInput}
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
      labels={labels.dateInput}
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
          ariaLabel={labels.clearDateRange}
          preserveFocus
          onClick={() => onChange('', '')}
        />
      )}
    </span>
  );
}
