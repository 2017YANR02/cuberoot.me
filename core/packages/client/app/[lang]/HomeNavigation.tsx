'use client';

import { Children, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { NavigationMenu } from '@app-foundation/navigation-ui';
import { ChevronLeft, ChevronRight } from '@app-foundation/icons/lucide';
import SettingsDialog from '@/components/SettingsDialog';
import { tr } from '@/i18n/tr';
import type { Section } from '@/lib/landing-sections';
import '@app-foundation/navigation-ui/navigation.css';
import '@/components/menu-toggle-icon.css';

// Keep this complementary to the mobile breakpoint in home-navigation.css.
const DESKTOP_NAV_QUERY = '(width > 900px)';

/** Home sections deliberately keep the current URL, as requested by the maintainer. */
export default function HomeNavigation({ selected, onSelect, isAdmin, sections, brand, actions, flyouts }: {
  selected: string;
  onSelect: (section: string) => void;
  isAdmin: boolean;
  sections: readonly Section[];
  brand: ReactNode;
  actions: ReactNode;
  flyouts: Record<string, ReactNode>;
}) {
  const [open, setOpen] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState({ top: 0, left: 0, right: 0 });
  const [drawerSection, setDrawerSection] = useState<string | null>(null);
  const [drawerDirection, setDrawerDirection] = useState<'forward' | 'back' | null>(null);
  const drawerDialogRef = useRef<{ close: () => void }>(null);
  const drawerExit = useRef<Animation | null>(null);
  // Keep the last content mounted while the panel and curtain finish closing.
  const [flyout, setFlyout] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [geometry, setGeometry] = useState({ top: 0, height: 0 });
  const drawerContentRef = useRef<HTMLDivElement>(null);
  const drawerFocusTarget = useRef<string | null>(null);
  useEffect(() => () => {
    drawerExit.current?.cancel();
    drawerExit.current = null;
  }, [open]);
  const switchDrawerSection = async (section: string | null) => {
    if (drawerExit.current) return;
    const direction = section ? 'forward' : 'back';
    const page = drawerContentRef.current?.firstElementChild;
    if (page instanceof HTMLElement && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const animation = page.animate([
        { opacity: 1, transform: 'translateX(0)' },
        { opacity: 0, transform: `translateX(${section ? -16 : 16}px)` },
      ], { duration: 180, easing: 'ease-in', fill: 'forwards' });
      drawerExit.current = animation;
      try { await animation.finished; } catch { return; }
      if (drawerExit.current !== animation) return;
      drawerExit.current = null;
    }
    drawerFocusTarget.current = section ? 'button' : `#home-drawer-${drawerSection}`;
    setDrawerDirection(direction);
    setDrawerSection(section);
  };
  useEffect(() => {
    if (!open || !drawerFocusTarget.current) return;
    drawerContentRef.current?.querySelector<HTMLElement>(drawerFocusTarget.current)?.focus();
    drawerContentRef.current?.closest('.settings-dialog-panel')?.scrollTo({ top: 0 });
    drawerFocusTarget.current = null;
  }, [open, drawerSection]);
  const headerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusFrame = useRef<number | null>(null);
  const cancelLeave = useCallback(() => {
    if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  }, []);
  const closeFlyout = useCallback(() => { cancelLeave(); setExpanded(false); }, [cancelLeave]);
  const scheduleClose = () => {
    cancelLeave();
    leaveTimer.current = setTimeout(closeFlyout, 120);
  };
  const allowedFlyout = flyout && (flyout !== 'admin' || isAdmin) && Children.count(flyouts[flyout]) > 0 ? flyout : null;
  const shown = expanded && !!allowedFlyout && !open;
  const showFlyout = (id: string) => {
    cancelLeave();
    if (!window.matchMedia(DESKTOP_NAV_QUERY).matches || !Children.count(flyouts[id])) {
      closeFlyout();
      return;
    }
    setFlyout(id);
    setExpanded(true);
  };
  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP_NAV_QUERY);
    const onDesktopChange = (event: MediaQueryListEvent) => {
      if (event.matches) drawerDialogRef.current?.close();
    };
    const onScroll = (event: Event) => {
      if (!(event.target instanceof Node) || !contentRef.current?.parentElement?.contains(event.target)) closeFlyout();
    };
    desktop.addEventListener('change', onDesktopChange);
    window.addEventListener('resize', closeFlyout);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      cancelLeave();
      if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
      desktop.removeEventListener('change', onDesktopChange);
      window.removeEventListener('resize', closeFlyout);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [cancelLeave, closeFlyout]);
  useLayoutEffect(() => {
    if (!shown || !headerRef.current || !contentRef.current) return;
    const header = headerRef.current;
    const content = contentRef.current;
    if (content.parentElement) content.parentElement.scrollTop = 0;
    const measure = () => {
      const top = header.getBoundingClientRect().bottom;
      const height = content.scrollHeight;
      setGeometry(previous => previous.top === top && previous.height === height ? previous : { top, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [shown, allowedFlyout]);
  const label = tr({ zh: '网站导航', en: 'Site navigation' });
  const items = [
    ...sections.map(section => ({ id: section.id, label: tr(section.title) })),
    ...(isAdmin ? [{ id: 'admin', label: tr({ zh: '管理', en: 'Admin' }) }] : []),
  ].map(item => ({ ...item, href: item.id, active: selected === item.id, icon: null }));
  const menu = (close?: () => void) => <NavigationMenu items={items} collapsed={false} label={label}
    renderLink={({ href, className, children, 'aria-current': current, 'aria-label': itemLabel }) => {
      if (close) return <button id={`home-drawer-${href}`} className={className}
        style={{ '--home-menu-index': items.findIndex(item => item.id === href) } as CSSProperties}
        aria-current={current} aria-label={itemLabel} type="button" data-home-section={href}
        onClick={() => { void switchDrawerSection(href); }}>
        {children}<ChevronRight className="home-navigation-next" size={28} strokeWidth={1.5} aria-hidden="true" />
      </button>;
      return <button className={className} aria-current={current} aria-label={itemLabel} type="button"
      id={`home-nav-${href}`}
      aria-expanded={shown && allowedFlyout === href}
      aria-controls="home-navigation-flyout"
      data-home-section={href} data-tour={href === 'other' ? 'forum' : undefined}
      onPointerEnter={event => { if (event.pointerType === 'mouse') showFlyout(href); }}
      onFocus={() => { if (shown) showFlyout(href); }}
      onKeyDown={event => {
        if (event.key !== 'ArrowDown') return;
        event.preventDefault();
        showFlyout(href);
        if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
        focusFrame.current = requestAnimationFrame(() => contentRef.current?.querySelector<HTMLAnchorElement>('a')?.focus());
      }}
      onClick={() => { onSelect(href); closeFlyout(); }}>{children}</button>;
    }} />;

  return <header ref={headerRef} className="home-navigation" data-admin={isAdmin || undefined}
    data-drawer-open={open || undefined} data-drawer-closing={open && drawerClosing || undefined} inert={open}
    data-flyout-open={shown || undefined}
    style={{ '--home-nav-bottom': `${geometry.top}px`, '--home-flyout-height': `${geometry.height}px` } as CSSProperties}
    onPointerEnter={cancelLeave} onPointerLeave={scheduleClose}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) closeFlyout(); }}
    onKeyDown={event => {
      if (event.key !== 'Escape' || !shown) return;
      event.preventDefault();
      headerRef.current?.querySelector<HTMLButtonElement>(`#home-nav-${allowedFlyout}`)?.focus();
      closeFlyout();
    }}>
    <button type="button" className="home-navigation-brand" aria-label={tr({ zh: '首页', en: 'Home' })}
      onPointerEnter={closeFlyout} onClick={() => { closeFlyout(); onSelect('home'); }}>{brand}</button>
    <div className="home-navigation-desktop">{menu()}</div>
    {actions}
    <button type="button" className="home-navigation-toggle menu-toggle-icon" aria-label={label} aria-expanded={open}
      data-menu-closing={open && drawerClosing || undefined}
      aria-haspopup="dialog" onClick={event => {
        const rect = event.currentTarget.getBoundingClientRect();
        setMenuAnchor({ top: rect.top, left: rect.left, right: document.documentElement.clientWidth - rect.right });
        closeFlyout(); setDrawerSection(null); setDrawerDirection(null); setDrawerClosing(false); setOpen(true);
      }} />
    <div className="home-navigation-curtain" aria-hidden="true" onPointerEnter={scheduleClose} onClick={closeFlyout} />
    <div id="home-navigation-flyout" className="home-navigation-flyout" role="region"
      aria-labelledby={allowedFlyout ? `home-nav-${allowedFlyout}` : undefined} aria-hidden={!shown} inert={!shown}
      onPointerEnter={cancelLeave}>
      <div ref={contentRef} className="home-navigation-flyout-content">
        <div key={allowedFlyout} className="home-navigation-flyout-grid" onClickCapture={event => {
          if ((event.target as Element).closest('a')) closeFlyout();
        }}>{allowedFlyout ? flyouts[allowedFlyout] : null}</div>
      </div>
    </div>
    {open && <SettingsDialog ref={drawerDialogRef} curtain motionDuration={650} portalContainer={headerRef.current?.parentElement}
      renderCloseButton={(close, closing) => <button type="button" className="home-navigation-close"
        style={{ top: menuAnchor.top, left: menuAnchor.left }}
        aria-label={tr({ zh: '关闭', en: 'Close' })} aria-disabled={closing || undefined} onClick={close} />}
      label={label} heading={drawerSection ?
      <button type="button" className="home-navigation-back" aria-label={tr({ zh: '返回主菜单', en: 'Back to main menu' })}
        onClick={() => { void switchDrawerSection(null); }}>
        <ChevronLeft size={22} strokeWidth={1.5} aria-hidden="true" />
      </button> : <span />}
      panelClassName="home-navigation-drawer" onCloseStart={() => setDrawerClosing(true)} onClose={() => setOpen(false)}>
      {close => <>
        <div ref={drawerContentRef} className="home-navigation-drawer-content" style={{ paddingInlineEnd: menuAnchor.right + 10 }}>
          <div key={drawerSection ?? 'main'} className="home-navigation-drawer-page" data-level={drawerSection ? 'submenu' : 'main'} data-direction={drawerDirection ?? undefined}>
            {drawerSection ? <nav className="home-navigation-submenu" aria-label={items.find(item => item.id === drawerSection)?.label}>
              <div className="home-navigation-submenu-links" onClickCapture={event => {
                if ((event.target as Element).closest('a')) close();
              }}>
                <button type="button" className="home-navigation-card" onClick={() => { onSelect(drawerSection); close(); }}>
                  <span className="landing-card-name">{tr({ zh: '总览', en: 'Overview' })}</span>
                </button>
                {flyouts[drawerSection]}
              </div>
            </nav> : menu(close)}
          </div>
        </div>
        {!drawerSection && <div className="home-navigation-drawer-actions"
          onClickCapture={event => { if ((event.target as Element).closest('a, button')) close(); }}>
          {actions}
        </div>}
      </>}
    </SettingsDialog>}
  </header>;
}
