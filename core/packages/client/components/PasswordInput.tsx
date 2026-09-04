'use client';

import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { tr } from '@/i18n/tr';
import './password-input.css';

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  wrapperClassName?: string;
  show?: boolean;
  onShowChange?: (show: boolean) => void;
}

export function PasswordInput({
  value,
  onChange,
  onEnter,
  wrapperClassName = '',
  show: controlledShow,
  onShowChange,
  className,
  onKeyDown,
  ...inputProps
}: PasswordInputProps) {
  const [ownShow, setOwnShow] = useState(false);
  const show = controlledShow ?? ownShow;
  const toggleShow = () => {
    const next = !show;
    if (controlledShow === undefined) setOwnShow(next);
    onShowChange?.(next);
  };
  return (
    <div className={`password-input ${wrapperClassName}`.trim()}>
      {/* allow-component-reimplementation: canonical PasswordInput implementation */}
      <input
        {...inputProps}
        className={`password-input__field ${className ?? ''}`.trim()}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented && event.key === 'Enter') onEnter?.();
        }}
      />
      <button
        type="button"
        className="password-input__toggle"
        tabIndex={-1}
        aria-label={tr(show ? { zh: '隐藏密码', en: 'Hide password' } : { zh: '显示密码', en: 'Show password' })}
        aria-pressed={show}
        onClick={toggleShow}
      >
        {show ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}
