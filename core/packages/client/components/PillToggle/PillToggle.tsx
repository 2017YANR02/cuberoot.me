'use client';

// Internal switch primitive for BoolToggle and rows with a separate label.
// Two-choice controls use native select menus.
// 既能点击切换,也能拖动滑钮(圆形)横向滑过中点切换 —— 指针落点 > 容器中线 = on。
import { useRef } from 'react';
import './PillToggle.css';

interface Props {
  value: boolean;
  onChange: (v: boolean) => void;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}

export default function PillToggle({ value, onChange, ariaLabel, className, disabled }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  // startX 记起手点;moved=true 表示这次是拖动(松手时不再当 tap 翻转)。
  const drag = useRef<{ startX: number; moved: boolean; next?: boolean } | null>(null);

  // 指针 X 落在容器哪半边 → 目标值(右半 = on)。
  const valueFromX = (clientX: number): boolean => {
    const el = ref.current;
    if (!el) return value;
    const r = el.getBoundingClientRect();
    return clientX - r.left > r.width / 2;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    drag.current = { startX: e.clientX, moved: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.startX) > 3) d.moved = true;
    if (d.moved) {
      d.next = valueFromX(e.clientX);
    }
  };
  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    // 保留手势到 click 再提交，避免关闭浮层后兼容 click 落到下层链接。
  };
  const onPointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    drag.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      disabled={disabled}
      aria-checked={value}
      aria-label={ariaLabel}
      className={`pill-toggle pill-toggle--switch${value ? ' is-on' : ''}${className ? ` ${className}` : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={(e) => {
        const d = drag.current;
        drag.current = null;
        if (e.detail !== 0 && !d) return;
        const next = e.detail !== 0 && d?.moved ? d.next ?? value : !value;
        if (next !== value) onChange(next);
      }}
    >
      <span className="pill-toggle-dot" />
    </button>
  );
}
