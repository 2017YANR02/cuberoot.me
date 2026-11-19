'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import MoreToggle from '@/components/MoreToggle';
import './section-navigation.css';

/** Mobile section picker shared by tutorial footers. */
export default function SectionMenu({ label, children }: { label: string; children: ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const popover = useRef<HTMLDivElement>(null);
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
  return <details className="tutorial-section-menu" ref={menu} onToggle={event => {
    const panel = popover.current;
    if (!event.currentTarget.open || !panel?.clientHeight) return;
    const selected = panel.querySelector('[aria-current="page"]');
    if (!selected) return;
    const item = selected.getBoundingClientRect();
    const top = panel.getBoundingClientRect().top + panel.clientTop;
    const height = panel.clientHeight;
    if (item.top < top || item.bottom > top + height) {
      panel.scrollTo({ top: panel.scrollTop + item.top - top + (item.height - height) / 2, behavior: 'instant' });
    }
  }}>
    <MoreToggle as="summary" animate={false}><span>{label}</span></MoreToggle>
    {/* allow-static-onclick: Delegates dismissal from native section buttons. */}
    <div ref={popover} className="tutorial-section-popover" data-site-surface="popover" onClick={event => {
      if (event.target instanceof Element && event.target.closest('button') && menu.current) {
        menu.current.open = false;
        menu.current.querySelector('summary')?.focus();
      }
    }}>{children}</div>
  </details>;
}
