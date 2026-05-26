'use client';

/**
 * Number input that lets the user clear the field and type freely. Commits the
 * parsed + clamped value to the parent only on blur / Enter, not on every
 * keystroke. Solves the classic React controlled-input UX bug where
 * `Math.max(1, Number(e.target.value) || 1)` snaps an empty field back to 1
 * before the user can finish typing.
 *
 * Empty / invalid input on blur ⇒ revert to the last committed value.
 */
import { useEffect, useState, type InputHTMLAttributes } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'onBlur' | 'min' | 'max' | 'type'> {
  value: number;
  min: number;
  max: number;
  onCommit: (n: number) => void;
}

export default function NumberCommitInput({
  value, min, max, onCommit, onKeyDown, onFocus, ...rest
}: Props) {
  const [text, setText] = useState<string>(String(value));
  // 外部 value 变化(如别处 setState、reset)→ 同步内部缓冲
  useEffect(() => { setText(String(value)); }, [value]);

  const commit = () => {
    const n = parseInt(text, 10);
    if (isFinite(n)) {
      const clamped = Math.max(min, Math.min(max, n));
      if (clamped !== value) onCommit(clamped);
      if (String(clamped) !== text) setText(String(clamped));
    } else {
      // 清空 / 非数字 → 恢复
      setText(String(value));
    }
  };

  return (
    <input
      {...rest}
      type="number"
      min={min}
      max={max}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onFocus={(e) => {
        // 激活时全选 — 用户点进来直接打新数字就替换,不用先 Ctrl+A
        e.currentTarget.select();
        onFocus?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
        onKeyDown?.(e);
      }}
    />
  );
}
