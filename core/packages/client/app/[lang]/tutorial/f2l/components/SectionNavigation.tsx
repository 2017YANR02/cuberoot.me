'use client';

import { useContext, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import MoreToggle from '@/components/MoreToggle';
import { StudyNavigation } from './StudyActions';

const query = '(max-width: 760px)';
const subscribe = (listener: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
};
const snapshot = () => window.matchMedia(query).matches;
const serverSnapshot = () => false;

/** Keep each lesson's actual controls, moving them into the footer on small screens. */
export default function SectionNavigation({ label, children }: { label: string; children: ReactNode }) {
  const mobile = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const { mobileMenuTarget } = useContext(StudyNavigation);
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target) && menu.current) menu.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector('summary')?.focus();
      }
    };
    if (!mobile) return;
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', escape);
    };
  }, [mobile]);
  useEffect(() => { if (menu.current) menu.current.open = false; }, [label]);
  if (!mobile || !mobileMenuTarget) return <aside className="f2l-section-nav">{children}</aside>;
  return createPortal(<details className="f2l-mobile-menu" ref={menu}>
    <MoreToggle as="summary" animate={false}><span>{label}</span></MoreToggle>
    {/* allow-static-onclick: Delegates dismissal from the existing native section buttons. */}
    <div className="f2l-section-popover" data-site-surface="popover" onClick={event => {
      if (event.target instanceof Element && event.target.closest('button.f2l-section-button') && menu.current) {
        menu.current.open = false;
        menu.current.querySelector('summary')?.focus();
      }
    }}>{children}</div>
  </details>, mobileMenuTarget);
}
