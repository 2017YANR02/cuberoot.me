'use client';

import { createContext, useState, type Dispatch, type SetStateAction, type ReactNode } from 'react';
import { NavigationShell, type NavigationItem, type NavigationGroup, type NavigationLinkProps } from '@app-foundation/navigation-ui';
import { BookOpen } from '@app-foundation/icons/lucide';
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
  const navGroups: NavigationGroup[] = groups.map(group => ({ ...group, icon: <BookOpen size={18} />, defaultOpen: true, items: sectionItems(group.items) }));
  const label = tr({ zh: '本章小节', en: 'Chapter sections' });
  return <TutorialSectionsContext.Provider value={setRegistered}>
    <NavigationShell className={'tutorial-navigation-shell ' + className} contentAs="div"
      header={() => null} mobileLayout="rail" items={sectionItems(items)} groups={navGroups}
      labels={{ navigation: label,
        show: tr({ zh: '展开小节导航', en: 'Expand section navigation' }),
        hide: tr({ zh: '收起小节导航', en: 'Collapse section navigation' }),
        openMobile: label, closeMobile: tr({ zh: '关闭小节导航', en: 'Close section navigation' }) }}
      renderLink={sectionLink(all)}>{children}</NavigationShell>
  </TutorialSectionsContext.Provider>;
}
