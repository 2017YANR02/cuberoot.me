'use client';
import './settings-typography.css';

// 统一的「外观」菜单 — 合并原 ThemeToggle(明暗)+ PaletteToggle(配色)成单一单选。
// 明暗(浅色 / 深色)和配色(中国色)在同一份列表里互斥单选:
//   选明暗 → 清掉配色回经典明暗;选配色 → 覆盖明暗。
// 彻底消除「两个控件偷偷打架、点了没反应 / 悄悄被踢出」的困惑。
// 入口挂 HeaderToggles(桌宠工具栏 = 全站外观入口);切换走 lib/theme 的
// applyTheme / applyPalette(View Transitions 淡出 + localStorage 持久化)。
//
// 没有单独的「经典 / 跟随系统」项:明暗区本身就是经典(无 palette),浅 / 深两项
// 通过太阳 / 月亮图标选择,选中态跟随当前实际明暗。

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Sun, Moon, Settings, Check } from '@app-foundation/icons/lucide';
import { persistItem } from '@/lib/safe-storage';
import {
  THEME_KEY,
  applyTheme,
  applyPalette,
  applyContrast,
  beginAppearancePreview,
  endAppearancePreview,
  previewTheme,
  previewPalette,
  restorePersistedAppearance,
  readContrast,
  readPalette,
  useEffectiveTheme,
  type ContrastLevel,
} from '@/lib/theme';
import { PALETTES, type PaletteId } from '@/lib/palettes';
import { SiteBackgroundControl } from '@/components/SiteBackground';
import AppLink from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import LangToggle from '@/components/LangToggle';
import AccentColorSelect from '@/components/AccentColorSelect';
import { CompactSelect } from '@/components/CompactSelect';
import { useDeskPetVisible } from '@/hooks/useDeskPetVisible';
import { useHomeBackgroundChoice } from '@/hooks/useHomeBackgroundChoice';
import { usePanelClamp } from '@/hooks/usePanelClamp';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';

const HOVER_CLOSE_DELAY_MS = 120;

export default function AppearanceToggle({ className, triggerClassName, triggerLabel, labelClassName = 'toolbar-label', showLabel = false, menuContent, column = false, open: controlledOpen, onOpenChange }: { className?: string; triggerClassName?: string; triggerLabel?: string; labelClassName?: string; showLabel?: boolean; menuContent?: ReactNode; column?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const t = useT();
  const L = {
    title: triggerLabel ?? t('设置', 'Settings'),
    light: t('浅色', 'Light'),
    dark: t('深色', 'Dark'),
    lowContrast: t('低对比度', 'Low contrast'),
    more: t('比较全部', 'Compare all'),
  };

  const [mounted, setMounted] = useState(false);
  const [palette, setPalette] = useState<PaletteId | null>(null);
  const [contrast, setContrast] = useState<ContrastLevel>('normal');
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => { setInternalOpen(next); onOpenChange?.(next); };
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  usePanelClamp(open && !column, panelRef);
  const previewingRef = useRef(false);
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

  const endPreview = () => {
    if (!previewingRef.current) return;
    previewingRef.current = false;
    restorePersistedAppearance();
  };

  const closeMenu = () => {
    cancelHoverClose();
    endPreview();
    endAppearancePreview(true);
    setOpen(false);
  };

  const scheduleHoverClose = (pointerType: string) => {
    if (column || pointerType === 'touch') return;
    cancelHoverClose();
    hoverCloseTimerRef.current = window.setTimeout(() => {
      hoverCloseTimerRef.current = null;
      if (document.querySelector('.accent-color-menu')) return;
      closeMenu();
    }, HOVER_CLOSE_DELAY_MS);
  };

  const showThemePreview = (choice: 'light' | 'dark') => {
    previewingRef.current = true;
    previewTheme(choice);
  };

  const showPalettePreview = (id: PaletteId) => {
    previewingRef.current = true;
    previewPalette(id);
  };

  useEffect(() => {
    const readState = () => {
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
    if (!open) return;
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
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => () => {
    cancelHoverClose();
    if (previewingRef.current) restorePersistedAppearance();
    endAppearancePreview(true);
  }, []);

  // 选明暗:清掉配色回经典明暗(在同一次淡出里清),并持久化 theme。
  const pickTheme = (choice: 'light' | 'dark') => {
    previewingRef.current = false;
    endAppearancePreview();
    if (!column) setOpen(false);
    persistItem(THEME_KEY, choice);
    applyTheme(choice, true, true);
    window.dispatchEvent(new Event('theme-change'));
  };

  // 选配色:覆盖明暗(applyPalette 内部已 dispatch theme-change)。
  const pickPalette = (id: PaletteId) => {
    previewingRef.current = false;
    endAppearancePreview();
    if (!column) setOpen(false);
    applyPalette(id, true);
  };

  // 低对比度正交于明暗 / 配色,切换时菜单不关。
  const pickContrast = (level: ContrastLevel) => {
    previewingRef.current = false;
    setContrast(level);
    applyContrast(level);
  };

  const cls = triggerClassName ?? ['theme-toggle-inline', className].filter(Boolean).join(' ');

  if (!mounted) {
    return (
      <button type="button" className={cls} aria-label={L.title} suppressHydrationWarning>
        <span style={{ display: 'inline-block', width: 14, height: 14 }} />
      </button>
    );
  }

  const appearanceOptions = [
    { value: 'dark', label: <span className="accent-color-label"><Moon size={18} />{L.dark}</span> },
    { value: 'light', label: <span className="accent-color-label"><Sun size={18} />{L.light}</span> },
    ...PALETTES.map(p => ({ value: p.id, label: <span className="accent-color-label">
      <i className="accent-color-select-swatch" style={{ background: p.swatch[1] }} aria-hidden="true" />{tr(p)}
    </span> })),
  ];
  const appearanceValue = palette ?? eff;
  const appearanceLabel = appearanceOptions.find(option => option.value === appearanceValue)?.label;

  return (
    <div className="lang-toggle-wrap" ref={ref}>
      <button
        type="button"
        className={cls}
        onPointerEnter={(event) => {
          if (!column && event.pointerType !== 'touch') {
            cancelHoverClose();
            beginAppearancePreview();
            setOpen(true);
          }
        }}
        onPointerLeave={(event) => scheduleHoverClose(event.pointerType)}
        onPointerDown={(event) => { pointerTypeRef.current = event.pointerType; }}
        onClick={(event) => {
          // Mouse hover already opens the menu; touch and keyboard toggle it.
          if (open && (column || event.detail === 0 || pointerTypeRef.current !== 'mouse')) closeMenu();
          else {
            beginAppearancePreview();
            setOpen(true);
          }
        }}
        title={L.title}
        aria-label={L.title}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Settings size={14} />
        {showLabel && <span className={labelClassName}>{L.title}</span>}
      </button>
      {open && (
        <div
          className={`lang-menu palette-menu appearance-menu settings-typography${column ? ' af-nav-panel' : ''}`}
          ref={panelRef}
          data-backgrounds={showBackgrounds}
          role="menu"
          onPointerEnter={cancelHoverClose}
          onPointerLeave={(event) => {
            endPreview();
            scheduleHoverClose(event.pointerType);
          }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) endPreview();
          }}
          >
          <div className="appearance-settings">
            <div className="appearance-sec-label appearance-setting-rows">
              <LangToggle variant="menu" showLabel />
              <div className="accent-color-select">
                <span>{t('外观', 'Appearance')}</span>
                <CompactSelect className="accent-color-select-value" popupClassName="settings-typography accent-color-menu"
                  ariaLabel={t('外观', 'Appearance')} value={appearanceValue} label={appearanceLabel}
                  items={appearanceOptions.map(option => ({ value: option.value, label: <span className="accent-color-option">
                    <Check className="accent-color-check" aria-hidden="true" />{option.label}
                  </span> }))}
                  onPreview={value => {
                    if (value === null) endPreview();
                    else if (value === 'light' || value === 'dark') showThemePreview(value);
                    else showPalettePreview(value as PaletteId);
                  }}
                  onOpenChange={open => { if (!open) endPreview(); }}
                  onChange={value => {
                    if (value === 'light' || value === 'dark') pickTheme(value);
                    else pickPalette(value as PaletteId);
                  }} />
              </div>
              <AccentColorSelect />
              <BoolToggle
                value={petVisible}
                onChange={setPetVisible}
                label={t('桌宠', 'Desk pet')}
              />
              <label className="appearance-background-row">
                <span>{t('底图', 'Backdrop')}</span>
                <select
                  className="appearance-background-select"
                  value={showBackgrounds ? 'image' : 'solid'}
                  onChange={(event) => setBackgroundEnabled(event.target.value === 'image')}
                >
                  <option value="solid">{t('纯色', 'Solid color')}</option>
                  <option value="image">{t('背景', 'Image')}</option>
                </select>
              </label>
              <BoolToggle
                value={contrast === 'soft'}
                onChange={(enabled) => pickContrast(enabled ? 'soft' : 'normal')}
                label={L.lowContrast}
              />
              <button type="button" role="menuitem" className="lang-menu-item"
                onClick={() => {
                  closeMenu();
                  void import('@/components/ScrollDiagnostics').then(({ openScrollDiagnostics }) => openScrollDiagnostics())
                    .catch(() => alert(t('诊断工具加载失败，请重试。', 'Could not load diagnostics. Please try again.')));
                }}>
                {t('滚动诊断', 'Scroll diagnostics')}
              </button>
            </div>
          </div>

          <AppLink
            href="/appearance"
            className="palette-menu-more"
            onPointerEnter={endPreview}
            onFocus={endPreview}
            onClick={closeMenu}
          >
            {L.more} →
          </AppLink>

          {<div
            className="appearance-extra"
            onPointerEnter={endPreview}
            onFocus={endPreview}
          >{showBackgrounds && <SiteBackgroundControl />}{menuContent}</div>}
        </div>
      )}
    </div>
  );
}
