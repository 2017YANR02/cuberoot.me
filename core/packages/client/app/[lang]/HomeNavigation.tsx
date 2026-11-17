'use client';

import { useState, type ReactNode } from 'react';
import { NavigationMenu } from '@app-foundation/navigation-ui';
import { Menu } from '@app-foundation/icons/lucide';
import SettingsDialog from '@/components/SettingsDialog';
import CubeRootLogo from '@/components/CubeRootLogo';
import { tr } from '@/i18n/tr';
import type { Section } from '@/lib/landing-sections';
import '@app-foundation/navigation-ui/navigation.css';

/** Home sections deliberately keep the current URL, as requested by the maintainer. */
export default function HomeNavigation({ selected, onSelect, isAdmin, sections, brand, actions }: {
  selected: string;
  onSelect: (section: string) => void;
  isAdmin: boolean;
  sections: readonly Section[];
  brand: ReactNode;
  actions: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const label = tr({ zh: '网站导航', en: 'Site navigation' });
  const items = [
    { id: 'home', label: tr({ zh: '首页', en: 'Home' }) },
    ...sections.map(section => ({ id: section.id, label: tr(section.title) })),
    ...(isAdmin ? [{ id: 'admin', label: tr({ zh: '管理', en: 'Admin' }) }] : []),
  ].map(item => ({ ...item, href: item.id, active: selected === item.id, icon: null }));
  const menu = (close?: () => void) => <NavigationMenu items={items} collapsed={false} label={label}
    renderLink={({ href, className, children, 'aria-current': current, 'aria-label': itemLabel }) => <button className={className} aria-current={current} aria-label={itemLabel} type="button"
      data-home-section={href} data-tour={href === 'other' ? 'forum' : undefined} onClick={() => { onSelect(href); close?.(); }}>{children}</button>} />;

  return <header className="home-navigation" data-admin={isAdmin || undefined}>
    <button type="button" className="home-navigation-toggle" aria-label={label} aria-expanded={open}
      aria-haspopup="dialog" onClick={() => setOpen(true)}><Menu size={22} aria-hidden="true" /></button>
    <button type="button" className="home-navigation-brand" aria-label={tr({ zh: '首页', en: 'Home' })}
      onClick={() => onSelect('home')}>{brand}</button>
    <div className="home-navigation-desktop">{menu()}</div>
    {!open && actions}
    {open && <SettingsDialog drawer label={label} heading={<CubeRootLogo className="home-navigation-drawer-logo" height={48} />} panelClassName="home-navigation-drawer" onClose={() => setOpen(false)}>
      {close => <>{menu(close)}<div className="home-navigation-drawer-actions"
        onClickCapture={event => { if ((event.target as Element).closest('a, button')) close(); }}>
        {actions}
      </div></>}
    </SettingsDialog>}
  </header>;
}
