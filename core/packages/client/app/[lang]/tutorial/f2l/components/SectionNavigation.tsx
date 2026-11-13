'use client';

import { useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp } from '@app-foundation/icons/lucide';
import MoreToggle from '@/components/MoreToggle';
import { tr } from '@/i18n/tr';
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
  const viewport = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(0);

  useEffect(() => {
    const element = viewport.current;
    if (mobile || !element || !list.current) return;
    const update = () => {
      const above = element.scrollTop > 1;
      const below = element.scrollHeight - element.clientHeight - element.scrollTop > 1;
      setOverflow(Number(above) + 2 * Number(below));
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    observer.observe(list.current);
    element.addEventListener('scroll', update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', update);
    };
  }, [mobile]);

  useEffect(() => {
    const element = viewport.current;
    const selected = list.current?.querySelector('[aria-pressed="true"], [aria-current="true"]');
    if (mobile || !element || !selected) return;
    const view = element.getBoundingClientRect();
    const item = selected.getBoundingClientRect();
    const top = view.top + (element.scrollTop > 1 ? 28 : 0);
    const bottom = view.bottom - (element.scrollHeight - element.clientHeight - element.scrollTop > 1 ? 28 : 0);
    if (item.top < top) element.scrollTop -= top - item.top;
    else if (item.bottom > bottom) element.scrollTop += item.bottom - bottom;
  }, [label, mobile]);

  const scrollList = (direction: -1 | 1) => {
    const element = viewport.current;
    if (!element) return;
    element.scrollBy({
      top: direction * element.clientHeight * .7,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  };
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
  if (!mobile || !mobileMenuTarget) return <aside className="f2l-section-nav">
    <div className="f2l-section-scroll">
      <div className="f2l-section-viewport" ref={viewport} data-above={!!(overflow & 1)} data-below={!!(overflow & 2)}>
        <div className="f2l-section-scroll-list" ref={list}>{children}</div>
      </div>
      {!!(overflow & 1) && <button type="button" className="f2l-section-scroll-arrow" data-direction="up"
        aria-label={tr({ zh: '向上滚动小节列表', en: 'Scroll sections up' })} onClick={() => scrollList(-1)}>
        <ChevronUp size={18} aria-hidden="true" />
      </button>}
      {!!(overflow & 2) && <button type="button" className="f2l-section-scroll-arrow" data-direction="down"
        aria-label={tr({ zh: '向下滚动小节列表', en: 'Scroll sections down' })} onClick={() => scrollList(1)}>
        <ChevronDown size={18} aria-hidden="true" />
      </button>}
    </div>
  </aside>;
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
