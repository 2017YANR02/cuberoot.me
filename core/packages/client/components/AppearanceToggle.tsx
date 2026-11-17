'use client';
import './settings-typography.css';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Settings } from '@app-foundation/icons/lucide';
import { persistItem } from '@/lib/safe-storage';
import {
  THEME_KEY,
  applyTheme,
  applyPalette,
  applyContrast,
  beginAppearancePreview,
  endAppearancePreview,
  readTheme,
  readContrast,
  readPalette,
  useEffectiveTheme,
  type ContrastLevel,
  type Theme,
} from '@/lib/theme';
import type { PaletteId } from '@/lib/palettes';
import { AppearanceThemeControl, AppearanceBackdropControls } from '@cuberoot/app-ui/appearance';
import { SiteBackgroundControl } from '@/components/SiteBackground';
import AppLink from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import LangToggle from '@/components/LangToggle';
import AccentColorSelect from '@/components/AccentColorSelect';
import { useDeskPetVisible } from '@/hooks/useDeskPetVisible';
import { useHomeBackgroundChoice } from '@/hooks/useHomeBackgroundChoice';
import { usePanelClamp } from '@/hooks/usePanelClamp';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { openInstalledAppearance, useInstalledShellNavigation } from '@/lib/installed-shell-navigation';

const HOVER_CLOSE_DELAY_MS = 120;

export default function AppearanceToggle({ className, triggerClassName, triggerLabel, labelClassName = 'toolbar-label', showLabel = false, menuContent, column = false, embedded = false, section = 'all', open: controlledOpen, onOpenChange }: { className?: string; triggerClassName?: string; triggerLabel?: string; labelClassName?: string; showLabel?: boolean; menuContent?: ReactNode; column?: boolean; embedded?: boolean; section?: 'all' | 'general' | 'appearance'; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const t = useT();
  const language = useLang();
  const shellNavigation = useInstalledShellNavigation();
  const L = {
    title: triggerLabel ?? t('设置', 'Settings'),
    more: t('比较全部', 'Compare all'),
  };

  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<Theme>('system');
  const [palette, setPalette] = useState<PaletteId | null>(null);
  const [contrast, setContrast] = useState<ContrastLevel>('normal');
  const [internalOpen, setInternalOpen] = useState(false);
  const open = !shellNavigation && (embedded || (controlledOpen ?? internalOpen));
  const setOpen = (next: boolean) => { setInternalOpen(next); onOpenChange?.(next); };
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  usePanelClamp(open && !column && !embedded, panelRef);
  const hoverCloseTimerRef = useRef<number | null>(null);
  const pointerTypeRef = useRef('mouse');
  const eff = useEffectiveTheme();
  const [petVisible, setPetVisible] = useDeskPetVisible();
  const [, , showBackgrounds, setBackgroundEnabled] = useHomeBackgroundChoice(eff);

  const cancelHoverClose = () => {
    if (hoverCloseTimerRef.current === null) return;
    window.clearTimeout(hoverCloseTimerRef.current);
    hoverCloseTimerRef.current = null;
  };

  const closeMenu = () => {
    cancelHoverClose();
    endAppearancePreview(true);
    setOpen(false);
  };

  const scheduleHoverClose = (pointerType: string) => {
    if (shellNavigation || embedded || column || pointerType === 'touch') return;
    cancelHoverClose();
    hoverCloseTimerRef.current = window.setTimeout(() => {
      hoverCloseTimerRef.current = null;
      if (document.querySelector('.accent-color-menu')) return;
      closeMenu();
    }, HOVER_CLOSE_DELAY_MS);
  };

  useEffect(() => {
    // A trusted init can arrive after a pointer has opened the Web menu.
    // Unmount its portaled controls immediately and discard that local state.
    if (shellNavigation) closeMenu();
  }, [shellNavigation]);

  useEffect(() => {
    const readState = () => {
      setTheme(readTheme());
      setPalette(readPalette() as PaletteId | null);
      setContrast(readContrast());
    };
    readState();
    setMounted(true);
    window.addEventListener('theme-change', readState);
    window.addEventListener('storage', readState);
    return () => {
      window.removeEventListener('theme-change', readState);
      window.removeEventListener('storage', readState);
    };
  }, []);

  useEffect(() => {
    if (!open || embedded) return;
    const onDown = (e: MouseEvent) => {
      // CompactSelect renders the nested color menu in a body portal.
      if (e.target instanceof Element && e.target.closest('.accent-color-menu')) return;
      // Navigation chooses the next panel on click. Do not clear the current
      // panel on mousedown first, which briefly collapses the shared column.
      if (column && e.target instanceof Element && e.target.closest('.af-nav-sidebar, .af-nav-toggle, [data-navigation-panel-toggle]')
        && ref.current?.closest('.af-navigation')?.contains(e.target)) return;
      if (ref.current && !ref.current.contains(e.target as Node)) closeMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('.accent-color-menu')) closeMenu();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, embedded]);

  useEffect(() => () => {
    cancelHoverClose();
    endAppearancePreview(true);
  }, []);

  // 选明暗:清掉配色回经典明暗(在同一次圆形过渡里清),并持久化 theme。
  const pickTheme = (choice: Theme) => {
    endAppearancePreview();
    if (!column) setOpen(false);
    persistItem(THEME_KEY, choice);
    applyTheme(choice, true, true);
    window.dispatchEvent(new Event('theme-change'));
  };

  // 选配色:覆盖明暗(applyPalette 内部已 dispatch theme-change)。
  const pickPalette = (id: PaletteId) => {
    endAppearancePreview();
    if (!column) setOpen(false);
    applyPalette(id, true);
  };

  // 低对比度正交于明暗 / 配色,切换时菜单不关。
  const pickContrast = (level: ContrastLevel) => {
    setContrast(level);
    applyContrast(level);
  };

  const cls = triggerClassName ?? ['theme-toggle-inline', className].filter(Boolean).join(' ');

  if (!mounted) {
    if (embedded) return null;
    return (
      <button type="button" className={cls} data-mobile-open-settings={shellNavigation || section !== 'general' ? 'appearance' : undefined} aria-label={L.title} suppressHydrationWarning>
        <Settings size={20} aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className="lang-toggle-wrap" ref={ref}>
      {(!embedded || shellNavigation) && <button
        type="button"
        className={cls}
        data-mobile-open-settings={shellNavigation || section !== 'general' ? 'appearance' : undefined}
        onPointerEnter={(event) => {
          if (!shellNavigation && !column && event.pointerType !== 'touch') {
            cancelHoverClose();
            beginAppearancePreview();
            setOpen(true);
          }
        }}
        onPointerLeave={(event) => scheduleHoverClose(event.pointerType)}
        onPointerDown={(event) => { pointerTypeRef.current = event.pointerType; }}
        onClick={(event) => {
          if (shellNavigation) {
            openInstalledAppearance();
            return;
          }
          // Mouse hover already opens the menu; touch and keyboard toggle it.
          if (open && (column || event.detail === 0 || pointerTypeRef.current !== 'mouse')) closeMenu();
          else {
            beginAppearancePreview();
            setOpen(true);
          }
        }}
        title={L.title}
        aria-label={L.title}
        aria-haspopup={shellNavigation ? undefined : "menu"}
        aria-expanded={shellNavigation ? undefined : open}
      >
        <Settings size={20} aria-hidden="true" />
        {showLabel && <span className={labelClassName}>{L.title}</span>}
      </button>}
      {open && (
        <div
          className={`lang-menu palette-menu appearance-menu settings-typography${column ? ' af-nav-panel' : ''}${embedded ? ' appearance-menu-embedded' : ''}`}
          ref={panelRef}
          data-site-surface={embedded ? undefined : 'popover'}
          data-backgrounds={showBackgrounds}
          role={embedded ? undefined : "menu"}
          onPointerEnter={cancelHoverClose}
          onPointerLeave={(event) => scheduleHoverClose(event.pointerType)}
          >
          <div className="appearance-settings">
            <div className="appearance-sec-label appearance-setting-rows">
              {section !== 'appearance' && <LangToggle variant={embedded ? 'row' : 'menu'} showLabel />}
              {section !== 'general' && <><AppearanceThemeControl language={language} theme={theme} palette={palette}
                onChange={patch => {
                  if (patch.theme) pickTheme(patch.theme);
                  else if (patch.palette) pickPalette(patch.palette);
                }} />
                <AccentColorSelect /></>}
              {section !== 'appearance' && <BoolToggle
                value={petVisible}
                onChange={setPetVisible}
                label={t('桌宠', 'Desk pet')}
              />}
              {section !== 'general' && <AppearanceBackdropControls language={language} enabled={showBackgrounds}
                contrast={contrast} onEnabledChange={setBackgroundEnabled} onContrastChange={pickContrast} />}
              {section !== 'appearance' && <button type="button" role={embedded ? undefined : "menuitem"} className="lang-menu-item"
                onClick={() => {
                  closeMenu();
                  void import('@/components/ScrollDiagnostics').then(({ openScrollDiagnostics }) => openScrollDiagnostics())
                    .catch(() => alert(t('诊断工具加载失败，请重试。', 'Could not load diagnostics. Please try again.')));
                }}>
                {t('滚动诊断', 'Scroll diagnostics')}
              </button>}
            </div>
          </div>

          {section !== 'general' && <AppLink
            href="/appearance"
            className="palette-menu-more"
            onClick={closeMenu}
          >
            {L.more} →
          </AppLink>}

          {<div
            className="appearance-extra"
          >{section !== 'general' && showBackgrounds && <SiteBackgroundControl />}{menuContent}</div>}
        </div>
      )}
    </div>
  );
}
