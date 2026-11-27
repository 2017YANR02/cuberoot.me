'use client';

/**
 * 通用 iOS UISegmentedControl 风胶囊:容器 frosted glass,active chip 后面
 * 一块共享玻璃材质的 thumb 跟着滑。手指按下后横滑过 chip 边界
 * 即切换 (不用抬手)。Safari / iOS 退一档 CSS frosted thumb。
 */
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import './LiquidGlassChips.css';

interface Props<T extends string | number> {
  items: readonly T[];
  value: T;
  onChange: (v: T) => void;
  getLabel: (item: T) => string;
  /** 额外加在 root 上的 class,用于宿主页面控制布局/响应式。 */
  className?: string;
  ariaLabel?: string;
  role?: 'tablist' | 'listbox';
  /** A completed click, tap or keyboard choice, after drag previews have settled. */
  onCommit?: () => void;
}

export default function LiquidGlassChips<T extends string | number>({
  items, value, onChange, getLabel, className, ariaLabel, role = 'tablist', onCommit,
}: Props<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const draggingRef = useRef(false);
  // Optimistic local selection: drives the thumb + active chip immediately on
  // drag, instead of waiting for `value` to round-trip back from the parent.
  // Next.js routes selection through `router.replace` (async App Router
  // transition), so the controlled `value` lags by hundreds of ms and the thumb
  // never follows the finger. Mirror `value` into local state and re-sync
  // whenever the parent's value changes.
  const [localValue, setLocalValue] = useState<T>(value);
  useEffect(() => { setLocalValue(value); }, [value]);
  const select = (next: T) => {
    setLocalValue(next);
    onChange(next);
  };
  const [chipBox, setChipBox] = useState<{ centerX: number; centerY: number; w: number; h: number }>(
    { centerX: 0, centerY: 0, w: 0, h: 0 },
  );

  const syncBox = () => {
    const idx = items.indexOf(localValue);
    const chip = chipRefs.current[idx];
    if (!chip) return;
    setChipBox({
      centerX: chip.offsetLeft + chip.offsetWidth / 2,
      centerY: chip.offsetTop + chip.offsetHeight / 2,
      w: chip.offsetWidth,
      h: chip.offsetHeight,
    });
  };
  // value / items / 文本变化都可能改 chip 宽 → 重测
  useLayoutEffect(syncBox, [localValue, items, getLabel]);
  useEffect(() => {
    const onResize = () => syncBox();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localValue]);

  const idxAtX = (clientX: number): number => {
    const rects = chipRefs.current.map((el) => el?.getBoundingClientRect() ?? null);
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (r && clientX >= r.left && clientX <= r.right) return i;
    }
    if (rects[0] && clientX < rects[0].left) return 0;
    return items.length - 1;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const next = items[idxAtX(e.clientX)];
    if (next !== localValue) select(next);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const next = items[idxAtX(e.clientX)];
    if (next !== localValue) select(next);
  };
  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  return (
    <div
      ref={containerRef}
      className={`lg-chips af-glass-surface${className ? ` ${className}` : ''}`}
      role={role}
      aria-orientation="horizontal"
      onClick={onCommit}
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <div className="lg-chips-thumb-layer">
        {chipBox.w > 0 && (
          <div
            className="lg-chips-thumb-fallback af-glass-surface"
            data-af-glass-role="popover"
            aria-hidden="true"
            style={{
              top: chipBox.centerY,
              left: chipBox.centerX,
              width: chipBox.w,
              height: chipBox.h,
            }}
          />
        )}
      </div>
      {items.map((item, i) => (
        <button
          key={String(item)}
          ref={(el) => { chipRefs.current[i] = el; }}
          type="button"
          role={role === 'listbox' ? 'option' : 'tab'}
          aria-selected={item === localValue}
          className={`lg-chips-chip${item === localValue ? ' is-active' : ''}`}
          onClick={() => select(item)}
        >
          {getLabel(item)}
        </button>
      ))}
    </div>
  );
}
