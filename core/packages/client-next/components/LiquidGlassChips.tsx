'use client';

/**
 * 通用 iOS UISegmentedControl 风胶囊:容器 frosted glass,active chip 后面
 * 一块 liquid-glass-react 渲染的 thumb 跟着滑。手指按下后横滑过 chip 边界
 * 即切换 (不用抬手)。Safari / iOS 退一档 CSS frosted thumb。
 */
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import LiquidGlass from 'liquid-glass-react';
import './LiquidGlassChips.css';

/** Safari (desktop + iOS,任何 iOS 浏览器都是 WebKit) 不能正确合成 SVG
 *  `feDisplacementMap` 跟 `backdrop-filter` 这一对,liquid-glass-react 只特判
 *  了 Firefox,Safari 上 thumb 会渲染成不透明黑块。检测到 → 退一档 CSS
 *  frosted thumb,iOS 26 native 那一档放弃但至少不丑。 */
const needsCssGlassFallback = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  return /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua);
};

interface Props<T extends string | number> {
  items: readonly T[];
  value: T;
  onChange: (v: T) => void;
  getLabel: (item: T) => string;
  /** 额外加在 root 上的 class,用于宿主页面控制布局/响应式。 */
  className?: string;
  ariaLabel?: string;
}

export default function LiquidGlassChips<T extends string | number>({
  items, value, onChange, getLabel, className, ariaLabel,
}: Props<T>) {
  const [useFallback] = useState<boolean>(() => needsCssGlassFallback());
  const containerRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const draggingRef = useRef(false);
  const [chipBox, setChipBox] = useState<{ centerX: number; centerY: number; w: number; h: number }>(
    { centerX: 0, centerY: 0, w: 0, h: 0 },
  );

  const syncBox = () => {
    const idx = items.indexOf(value);
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
  useLayoutEffect(syncBox, [value, items, getLabel]);
  useEffect(() => {
    const onResize = () => syncBox();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const idxAtX = (clientX: number): number => {
    const rects = chipRefs.current.map((el) => el?.getBoundingClientRect() ?? null);
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (r && clientX >= r.left && clientX <= r.right) return i;
    }
    if (rects[0] && clientX < rects[0].left) return 0;
    return rects.length - 1;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const next = items[idxAtX(e.clientX)];
    if (next !== value) onChange(next);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const next = items[idxAtX(e.clientX)];
    if (next !== value) onChange(next);
  };
  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  return (
    <div
      ref={containerRef}
      className={`lg-chips${className ? ` ${className}` : ''}`}
      role="tablist"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <div className="lg-chips-thumb-layer">
        {chipBox.w > 0 && (useFallback ? (
          <div
            className="lg-chips-thumb-fallback"
            aria-hidden="true"
            style={{
              top: chipBox.centerY,
              left: chipBox.centerX,
              width: chipBox.w,
              height: chipBox.h,
            }}
          />
        ) : (
          <LiquidGlass
            mouseContainer={containerRef}
            padding="0"
            cornerRadius={999}
            style={{
              position: 'absolute',
              top: chipBox.centerY,
              left: chipBox.centerX,
            }}
          >
            <div style={{ width: chipBox.w, height: chipBox.h }} aria-hidden="true" />
          </LiquidGlass>
        ))}
      </div>
      {items.map((item, i) => (
        <button
          key={String(item)}
          ref={(el) => { chipRefs.current[i] = el; }}
          type="button"
          role="tab"
          aria-selected={item === value}
          className={`lg-chips-chip${item === value ? ' is-active' : ''}`}
          onClick={() => onChange(item)}
        >
          {getLabel(item)}
        </button>
      ))}
    </div>
  );
}
