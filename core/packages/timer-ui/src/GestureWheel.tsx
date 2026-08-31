'use client';

/**
 * GestureWheel — cstimer-style radial gesture dial shared by timer surfaces.
 *
 * Driven imperatively so pointer movement does not re-render the host. Direction
 * order is 0=right, then counter-clockwise through 7=down-right; it is the same
 * order as the runtime-neutral contract in @cuberoot/shared/timer.
 */

import { timerGestureActionLabels } from '@cuberoot/shared/timer';
import { forwardRef, useImperativeHandle, useRef } from 'react';

export interface GestureWheelHandle {
  /** Reveal the wheel at viewport coordinates and disable no-op directions. */
  show(x: number, y: number, enabled: boolean[]): void;
  /** Highlight one direction (-1 for the dead zone) and fade in the ring. */
  update(hit: number, opacity: number): void;
  hide(): void;
}

export interface GestureWheelProps {
  isZh: boolean;
  /** Optional eight labels. Empty text hides a slot unless it is the icon slot. */
  labels?: string[];
  /** Slot rendered as the delete × icon instead of text. */
  iconSlot?: number;
}

/** Ring radius in em, scaled by the root font size in gesture-wheel.css. */
const RING_RADIUS_EM = 5.2;

export const GestureWheel = forwardRef<GestureWheelHandle, GestureWheelProps>(
  function GestureWheel({ isZh, labels, iconSlot = 6 }, ref) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const itemRefs = useRef<Array<HTMLSpanElement | null>>([]);

    useImperativeHandle(ref, () => ({
      show(x, y, enabled) {
        const root = rootRef.current;
        if (!root) return;
        root.style.left = `${x}px`;
        root.style.top = `${y}px`;
        root.style.setProperty('--wheel-op', '0');
        root.classList.add('is-visible');
        for (let i = 0; i < itemRefs.current.length; i += 1) {
          const item = itemRefs.current[i];
          if (!item) continue;
          item.classList.toggle('disabled', !enabled[i]);
          item.classList.remove('hit');
        }
      },
      update(hit, opacity) {
        const root = rootRef.current;
        if (!root) return;
        root.style.setProperty('--wheel-op', String(opacity));
        for (let i = 0; i < itemRefs.current.length; i += 1) {
          const item = itemRefs.current[i];
          if (!item) continue;
          item.classList.toggle(
            'hit',
            i === hit && !item.classList.contains('disabled'),
          );
        }
      },
      hide() {
        const root = rootRef.current;
        if (!root) return;
        root.classList.remove('is-visible');
        for (const item of itemRefs.current) item?.classList.remove('hit');
      },
    }), []);

    const resolvedLabels = labels ?? timerGestureActionLabels(isZh);

    return (
      <div ref={rootRef} className="gesture-wheel" aria-hidden="true">
        <span className="gesture-wheel-dot" />
        {resolvedLabels.map((label, direction) => {
          const isIcon = direction === iconSlot;
          if (!isIcon && !label) {
            itemRefs.current[direction] = null;
            return null;
          }
          const angle = (direction * Math.PI) / 4;
          return (
            <span
              key={direction}
              ref={(item) => { itemRefs.current[direction] = item; }}
              className={`gesture-wheel-item${isIcon ? ' gesture-wheel-item--icon' : ''}`}
              style={{
                left: `${RING_RADIUS_EM * Math.cos(angle)}em`,
                top: `${-RING_RADIUS_EM * Math.sin(angle)}em`,
              }}
            >
              {isIcon ? (
                <svg className="gesture-wheel-x" viewBox="0 0 10 10" aria-hidden="true">
                  <path
                    d="M2.6 2.6 L7.4 7.4 M7.4 2.6 L2.6 7.4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              ) : label}
            </span>
          );
        })}
      </div>
    );
  },
);

export default GestureWheel;
