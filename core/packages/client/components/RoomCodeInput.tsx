'use client';

import { useEffect, useRef, type InputHTMLAttributes, type KeyboardEvent } from 'react';
import { tr } from '@/i18n/tr';

/** 训练协同房与计时器联机房的服务端都生成 4 位数字房间码。 */
export const ROOM_CODE_LENGTH = 4;

export function normalizeRoomCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, ROOM_CODE_LENGTH);
}

interface RoomCodeInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'maxLength'
> {
  value: string;
  onValueChange: (value: string) => void;
  onComplete: (code: string) => void;
}

/** 统一房间码入口:规范化输入，填满 4 位自动加入，并阻止同一码因重渲染重复提交。 */
export function RoomCodeInput({
  value,
  onValueChange,
  onComplete,
  disabled = false,
  onKeyDown,
  placeholder,
  'aria-label': ariaLabel,
  ...inputProps
}: RoomCodeInputProps) {
  const code = normalizeRoomCode(value);
  const lastCompletedRef = useRef('');

  useEffect(() => {
    if (code.length < ROOM_CODE_LENGTH) {
      lastCompletedRef.current = '';
      return;
    }
    if (disabled || lastCompletedRef.current === code) return;
    lastCompletedRef.current = code;
    onComplete(code);
  }, [code, disabled, onComplete]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (
      event.defaultPrevented
      || event.key !== 'Enter'
      || disabled
      || code.length !== ROOM_CODE_LENGTH
      || lastCompletedRef.current === code
    ) return;
    lastCompletedRef.current = code;
    onComplete(code);
  };

  return (
    <input
      {...inputProps}
      type="text"
      value={code}
      onChange={(event) => onValueChange(normalizeRoomCode(event.target.value))}
      onKeyDown={handleKeyDown}
      maxLength={ROOM_CODE_LENGTH}
      inputMode="numeric"
      pattern="[0-9]*"
      disabled={disabled}
      placeholder={placeholder ?? tr({ zh: '房间码', en: 'Room code' })}
      aria-label={ariaLabel ?? tr({ zh: '房间码', en: 'Room code' })}
      autoComplete="off"
      spellCheck={false}
    />
  );
}
