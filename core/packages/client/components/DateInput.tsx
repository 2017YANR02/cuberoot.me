'use client';

import { useState, type InputHTMLAttributes } from 'react';
import { Calendar } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { ClearButton } from '@/components/ClearButton';
import './date-input.css';

export interface DateInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'children' | 'className' | 'defaultValue' | 'onChange' | 'size' | 'type' | 'value'
> {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
  size?: 'default' | 'compact';
  clearable?: boolean;
  clearAriaLabel?: string;
}

export function DateInput({
  value,
  defaultValue = '',
  onChange,
  className,
  placeholder = 'yyyy-mm-dd',
  size = 'default',
  clearable = true,
  clearAriaLabel,
  disabled,
  readOnly,
  ...inputProps
}: DateInputProps) {
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const currentValue = controlled ? value : internalValue;
  const setValue = (nextValue: string) => {
    if (!controlled) setInternalValue(nextValue);
    onChange?.(nextValue);
  };
  const canClear = clearable && Boolean(currentValue) && !disabled && !readOnly;

  return (
    <span
      className={[
        'date-input',
        `date-input--${size}`,
        canClear ? 'date-input--clearable' : '',
        className,
      ].filter(Boolean).join(' ')}
      data-disabled={disabled ? '' : undefined}
      data-readonly={readOnly ? '' : undefined}
    >
      <span className="date-input__display" aria-hidden="true">
        <Calendar className="date-input__icon" size={15} strokeWidth={1.8} />
        <span className={currentValue ? 'date-input__value' : 'date-input__placeholder'}>
          {currentValue || placeholder}
        </span>
      </span>
      <input
        {...inputProps}
        className="date-input__native"
        type="date"
        value={currentValue}
        disabled={disabled}
        readOnly={readOnly}
        onChange={(event) => setValue(event.target.value)}
      />
      {canClear && (
        <ClearButton
          className="date-input__clear"
          ariaLabel={clearAriaLabel ?? tr({ zh: '清除日期', en: 'Clear date' })}
          preserveFocus
          onClick={() => setValue('')}
        />
      )}
    </span>
  );
}
