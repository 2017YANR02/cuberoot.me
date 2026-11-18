'use client';

import { createContext, useEffect, useRef, useState, type Dispatch, type SetStateAction, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { NavigationShell, type NavigationItem, type NavigationGroup, type NavigationLinkProps } from '@app-foundation/navigation-ui';
import { BookOpen, ChevronUp, ChevronDown } from '@app-foundation/icons/lucide';
import { tr } from '@/i18n/tr';
import '@app-foundation/navigation-ui/navigation.css';
import './tutorial-navigation-shell.css';

export type TutorialSection = Omit<NavigationItem, 'href' | 'icon'> & { icon?: ReactNode; onSelect: () => void };
export type TutorialSectionGroup = { id: string; label: string; items: TutorialSection[] };
export type TutorialSections = { items: TutorialSection[]; groups?: TutorialSectionGroup[] };
export const TutorialSectionsContext = createContext<Dispatch<SetStateAction<TutorialSections>> | null>(null);
export const sectionItems = (items: TutorialSection[]): NavigationItem[] => items.map(item => ({ ...item, href: '#' + item.id, icon: item.icon ?? <BookOpen size={18} /> }));
export function sectionLink(items: TutorialSection[]) {
  return ({ href, children, onClick, className, ...props }: NavigationLinkProps) => <button type="button" className={className}
    aria-label={props['aria-label']} aria-current={props['aria-current']}
    onClick={() => { items.find(item => '#' + item.id === href)?.onSelect(); onClick?.(); }}>{children}</button>;
}

export default function TutorialNavigationShell({ children, sections, className = '' }: {
  children: ReactNode; sections?: TutorialSections; className?: string;
}) {
  const [registered, setRegistered] = useState<TutorialSections>({ items: [] });
  const { items, groups = [] } = sections ?? registered;
  const all = [...items, ...groups.flatMap(group => group.items)];
  const anchor = useRef<HTMLSpanElement>(null);
  const viewport = useRef<HTMLElement | null>(null);
  const [sidebar, setSidebar] = useState<HTMLElement | null>(null);
  const [overflow, setOverflow] = useState(0);
  const activeKey = JSON.stringify(all.filter(item => item.active).map(item => item.id));
  useEffect(() => {
    const shell = anchor.current?.closest('.tutorial-navigation-shell');
    const side = shell?.querySelector<HTMLElement>(':scope > .af-nav-body > .af-nav-sidebar');
    const list = side?.querySelector<HTMLElement>(':scope > div');
    if (!side || !list) return;
    viewport.current = list;
    setSidebar(side);
    let frame = 0;
    const update = () => {
      frame = 0;
      const value = list.clientHeight > 0
        ? Number(list.scrollTop > 1) + 2 * Number(list.scrollHeight - list.clientHeight - list.scrollTop > 1) : 0;
      setOverflow(previous => previous === value ? previous : value);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const resize = new ResizeObserver(schedule);
    resize.observe(list);
    const observeContent = () => {
      resize.disconnect();
      resize.observe(list);
      for (const child of list.children) resize.observe(child);
      schedule();
    };
    const changes = new MutationObserver(observeContent);
    changes.observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
    observeContent();
    list.addEventListener('scroll', schedule, { passive: true });
    return () => {
      resize.disconnect(); changes.disconnect(); cancelAnimationFrame(frame);
      list.removeEventListener('scroll', schedule);
      viewport.current = null;
    };
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const list = viewport.current;
      if (!list || !list.clientHeight) return;
      const selected = list.querySelector<HTMLElement>('[aria-current="page"]');
      if (!selected) return;
      const group = selected.closest('details');
      if (group) group.open = true;
      const view = list.getBoundingClientRect();
      const item = selected.getBoundingClientRect();
      list.scrollTo({ top: list.scrollTop + item.top - view.top + (item.height - list.clientHeight) / 2,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeKey, sidebar]);
  const scroll = (direction: number) => {
    const list = viewport.current;
    list?.scrollBy({ top: direction * list.clientHeight * .7,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  const navGroups: NavigationGroup[] = groups.map(group => ({ ...group, icon: <BookOpen size={18} />, defaultOpen: true, items: sectionItems(group.items) }));
  const label = tr({ zh: '本章小节', en: 'Chapter sections' });
  return <TutorialSectionsContext.Provider value={setRegistered}>
    <NavigationShell className={'tutorial-navigation-shell ' + className} contentAs="div"
      header={() => <span hidden ref={anchor} />} mobileLayout="rail" items={sectionItems(items)} groups={navGroups}
      labels={{ navigation: label,
        show: tr({ zh: '展开小节导航', en: 'Expand section navigation' }),
        hide: tr({ zh: '收起小节导航', en: 'Collapse section navigation' }),
        openMobile: label, closeMobile: tr({ zh: '关闭小节导航', en: 'Close section navigation' }) }}
      renderLink={sectionLink(all)}>{children}</NavigationShell>
    {sidebar && createPortal(<>
      <button type="button" className="tutorial-nav-scroll-arrow" data-direction="up" hidden={!(overflow & 1)}
        aria-label={tr({ zh: '上方还有小节，向上滚动', en: 'More sections above, scroll up' })} onClick={() => scroll(-1)}><ChevronUp size={20} aria-hidden="true" /></button>
      <button type="button" className="tutorial-nav-scroll-arrow" data-direction="down" hidden={!(overflow & 2)}
        aria-label={tr({ zh: '下方还有小节，向下滚动', en: 'More sections below, scroll down' })} onClick={() => scroll(1)}><ChevronDown size={20} aria-hidden="true" /></button>
    </>, sidebar)}
  </TutorialSectionsContext.Provider>;
}
