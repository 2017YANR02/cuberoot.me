'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import MoreToggle from '@/components/MoreToggle';
import './section-navigation.css';

/** Mobile section picker shared by tutorial footers. */
export default function SectionMenu({ label, children }: { label: string; children: ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && menu.current && !menu.current.contains(event.target)) menu.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  useEffect(() => { if (menu.current) menu.current.open = false; }, [label]);
  return <details className="tutorial-section-menu" ref={menu}>
    <MoreToggle as="summary" animate={false}><span>{label}</span></MoreToggle>
    {/* allow-static-onclick: Delegates dismissal from native section buttons. */}
    <div className="tutorial-section-popover" data-site-surface="popover" onClick={event => {
      if (event.target instanceof Element && event.target.closest('button') && menu.current) {
        menu.current.open = false;
        menu.current.querySelector('summary')?.focus();
      }
    }}>{children}</div>
  </details>;
}
