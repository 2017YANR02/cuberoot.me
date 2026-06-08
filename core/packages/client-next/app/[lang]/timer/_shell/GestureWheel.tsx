'use client';

/**
 * GestureWheel — cstimer-style radial gesture dial.
 *
 * Shown while the user presses-and-drags on the timing surface (touch only,
 * idle/stopped phase). Eight direction labels sit on a ring around the touch
 * point; the one nearest the drag angle highlights, and releasing fires it.
 *
 * Driven imperatively (show/update/hide via ref) so dragging mutates the DOM
 * directly without re-rendering the (large) SoloView every pointermove —
 * mirroring how cstimer's `astouch` overlay works.
 *
 * Direction order matches the angle index used by the host: 0=right and going
 * counter-clockwise (1=up-right, 2=up, … 7=down-right).
 */

import { forwardRef, useImperativeHandle, useRef } from 'react';
import i18n from "@/i18n/i18n-client";

export interface GestureWheelHandle {
  /** Reveal the wheel centred at (x,y) viewport px; `enabled[i]` greys out
   *  directions whose action is a no-op (e.g. no solve yet). */
  show(x: number, y: number, enabled: boolean[]): void;
  /** Highlight direction `hit` (-1 = dead-zone / none); `opacity` 0..1 fades
   *  the ring in as the drag leaves the dead-zone. */
  update(hit: number, opacity: number): void;
  hide(): void;
}

/** Ring radius in em (scaled by the root font-size set in CSS). */
const R = 5.2;

const LABELS_ZH = ['下一个', 'OK', '+2', 'DNF', '上一个', '注释', '删除', '复制'];
const LABELS_ZH__Hant = ['下一個', 'OK', '+2', 'DNF', '上一個', '註釋', '刪除', '複製'];
const LABELS_EN = ['Next', 'OK', '+2', 'DNF', 'Prev', 'Note', 'Del', 'Copy'];

const GestureWheel = forwardRef<GestureWheelHandle, { isZh: boolean }>(function GestureWheel({ isZh }, ref) {
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
      for (let i = 0; i < itemRefs.current.length; i++) {
        const el = itemRefs.current[i];
        if (!el) continue;
        el.classList.toggle('disabled', !enabled[i]);
        el.classList.remove('hit');
      }
    },
    update(hit, opacity) {
      const root = rootRef.current;
      if (!root) return;
      root.style.setProperty('--wheel-op', String(opacity));
      for (let i = 0; i < itemRefs.current.length; i++) {
        const el = itemRefs.current[i];
        // Don't highlight a disabled direction (its action is a no-op).
        if (el) el.classList.toggle('hit', i === hit && !el.classList.contains('disabled'));
      }
    },
    hide() {
      const root = rootRef.current;
      if (!root) return;
      root.classList.remove('is-visible');
      for (const el of itemRefs.current) el?.classList.remove('hit');
    },
  }), []);

  const labels = i18n.language === 'zh-Hant' ? LABELS_ZH__Hant : (isZh ? LABELS_ZH : LABELS_EN);

  return (
    <div ref={rootRef} className="gesture-wheel" aria-hidden="true">
      <span className="gesture-wheel-dot" />
      {labels.map((label, i) => {
        const ang = (i * Math.PI) / 4;
        const isDelete = i === 6; // delete slot → × icon (matches ClearButton)
        return (
          <span
            key={i}
            ref={(el) => { itemRefs.current[i] = el; }}
            className={`gesture-wheel-item${isDelete ? ' gesture-wheel-item--icon' : ''}`}
            style={{ left: `${R * Math.cos(ang)}em`, top: `${-R * Math.sin(ang)}em` }}
          >
            {isDelete ? (
              <svg className="gesture-wheel-x" viewBox="0 0 10 10" aria-hidden="true">
                <path d="M2.6 2.6 L7.4 7.4 M7.4 2.6 L2.6 7.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
              </svg>
            ) : label}
          </span>
        );
      })}
    </div>
  );
});

export default GestureWheel;
