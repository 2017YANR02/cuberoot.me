'use client';

/**
 * MoreMenu — collapsible dropdown for rarely-used toolbar actions.
 *
 * Toggles open on click, closes on outside mousedown or Escape. Panel
 * pins to the right edge of the trigger; on narrow screens it caps at
 * 240px wide and stays right-aligned so it never overflows the viewport.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { tr } from '@/i18n/tr';

export interface MoreMenuItem {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface Props {
  items: MoreMenuItem[];
  isZh: boolean;
}

export default function MoreMenu({ items }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const tip = tr({ zh: '更多', en: 'More' });

  return (
    <div className="more-menu" ref={wrapRef}>
      <button
        type="button"
        className={`tb-btn more-menu-btn ${open ? 'open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title={tip}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="more-menu-panel" role="menu">
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              className={`more-menu-item ${it.danger ? 'danger' : ''}`}
              disabled={it.disabled}
              onClick={() => {
                if (it.disabled) return;
                setOpen(false);
                it.onClick();
              }}
            >
              {it.icon && <span className="more-menu-icon">{it.icon}</span>}
              <span className="more-menu-label">{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
