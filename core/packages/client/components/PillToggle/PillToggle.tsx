'use client';

// Ported from packages/client-vite/src/components/PillToggle/PillToggle.tsx.
// 既能点击切换,也能拖动滑钮(圆形)横向滑过中点切换 —— 指针落点 > 容器中线 = on。
import { useRef } from 'react';
import './PillToggle.css';

interface Props {
  value: boolean;
  onChange: (v: boolean) => void;
  /** 不传 on/off 标签 = 纯 iOS 风格无文字开关(滑轨 + 滑钮)。 */
  onLabel?: string;
  offLabel?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}

export default function PillToggle({ value, onChange, onLabel, offLabel, ariaLabel, className, disabled }: Props) {
  const isSwitch = !onLabel && !offLabel;
  const ref = useRef<HTMLButtonElement>(null);
  // startX 记起手点;moved=true 表示这次是拖动(松手时不再当 tap 翻转)。
  const drag = useRef<{ startX: number; moved: boolean } | null>(null);

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
      const next = valueFromX(e.clientX);
      if (next !== value) onChange(next);
    }
  };
  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    // 未拖动 = 普通点击/触摸 → 翻转;拖动过的值已在 move 里实时设好,这里不再动。
    if (d && !d.moved) onChange(!value);
  };

  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      disabled={disabled}
      aria-checked={value}
      aria-label={ariaLabel}
      className={`pill-toggle${isSwitch ? ' pill-toggle--switch' : ''}${value ? ' is-on' : ''}${className ? ` ${className}` : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => {
        // 鼠标/触摸的 click 已由 pointerup 处理;只接键盘(Enter/Space)触发的 click(detail===0)。
        if (e.detail === 0) onChange(!value);
      }}
    >
      {!isSwitch && <span className="pill-toggle-label">{value ? onLabel : offLabel}</span>}
      <span className="pill-toggle-dot" />
    </button>
  );
}
