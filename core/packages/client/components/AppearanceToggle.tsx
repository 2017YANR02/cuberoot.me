'use client';

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
import { Sun, Moon, Check } from 'lucide-react';
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
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';

const HOVER_CLOSE_DELAY_MS = 120;

function Swatch({ color }: { color: string }) {
  return (
    <span className="palette-swatch" aria-hidden="true">
      <i style={{ background: color, width: 14, height: 14 }} />
    </span>
  );
}

export default function AppearanceToggle({ className, showLabel = false, menuContent }: { className?: string; showLabel?: boolean; menuContent?: ReactNode }) {
  const t = useT();
  const L = {
    title: t('外观', 'Appearance'),
    light: t('浅色', 'Light'),
    dark: t('深色', 'Dark'),
    lowContrast: t('低对比度', 'Low contrast'),
    more: t('比较全部', 'Compare all'),
  };

  const [mounted, setMounted] = useState(false);
  const [palette, setPalette] = useState<PaletteId | null>(null);
  const [contrast, setContrast] = useState<ContrastLevel>('normal');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const previewingRef = useRef(false);
  const hoverCloseTimerRef = useRef<number | null>(null);
  const eff = useEffectiveTheme();

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
    if (pointerType === 'touch') return;
    cancelHoverClose();
    hoverCloseTimerRef.current = window.setTimeout(() => {
      hoverCloseTimerRef.current = null;
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
    setOpen(false);
    persistItem(THEME_KEY, choice);
    applyTheme(choice, true, true);
    window.dispatchEvent(new Event('theme-change'));
  };

  // 选配色:覆盖明暗(applyPalette 内部已 dispatch theme-change)。
  const pickPalette = (id: PaletteId) => {
    previewingRef.current = false;
    endAppearancePreview();
    setOpen(false);
    applyPalette(id, true);
  };

  // 低对比度正交于明暗 / 配色,切换时菜单不关。
  const pickContrast = (level: ContrastLevel) => {
    previewingRef.current = false;
    setContrast(level);
    applyContrast(level);
  };

  const cls = ['theme-toggle-inline', className].filter(Boolean).join(' ');

  if (!mounted) {
    return (
      <button type="button" className={cls} aria-label="Appearance" suppressHydrationWarning>
        <span style={{ display: 'inline-block', width: 14, height: 14 }} />
      </button>
    );
  }

  const onScheme = palette === null; // 当前在经典明暗(无配色)
  const ButtonIcon = eff === 'dark' ? Moon : Sun;

  return (
    <div className="lang-toggle-wrap" ref={ref}>
      <button
        type="button"
        className={cls}
        onPointerEnter={(event) => {
          if (event.pointerType !== 'touch') {
            cancelHoverClose();
            beginAppearancePreview();
            setOpen(true);
          }
        }}
        onPointerLeave={(event) => scheduleHoverClose(event.pointerType)}
        onClick={(event) => {
          // Mouse hover already opens the menu; its following click must keep it open.
          if (open && event.detail === 0) closeMenu();
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
        <ButtonIcon size={14} />
        {showLabel && <span className="toolbar-label">{L.title}</span>}
      </button>
      {open && (
        <div
          className="lang-menu palette-menu appearance-menu"
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
            <div className="appearance-schemes" style={{ display: 'flex', flexFlow: 'row nowrap', gap: 0 }}>
              {(['dark', 'light'] as const).map((choice) => {
                const Icon = choice === 'light' ? Sun : Moon;
                const active = onScheme && eff === choice;
                return (
                  <button
                    key={choice}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    aria-label={L[choice]}
                    title={L[choice]}
                    className={`lang-menu-item appearance-scheme${active ? ' is-active' : ''}`}
                    style={{ flex: '0 0 32px', width: 32, padding: 0, justifyContent: 'center' }}
                    onPointerEnter={() => showThemePreview(choice)}
                    onFocus={() => showThemePreview(choice)}
                    onClick={() => pickTheme(choice)}
                  >
                    <Icon size={18} aria-hidden="true" />
                  </button>
                );
              })}
            </div>

            {PALETTES.map((p) => {
              const on = p.id === palette;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  className={`lang-menu-item${on ? ' is-active' : ''}`}
                  onPointerEnter={() => showPalettePreview(p.id)}
                  onFocus={() => showPalettePreview(p.id)}
                  onClick={() => pickPalette(p.id)}
                >
                  <span className="lang-menu-check">{on && <Check size={13} />}</span>
                  <Swatch color={p.swatch[1]} />
                  <span>{tr(p)}</span>
                </button>
              );
            })}

            <div className="appearance-sec-label appearance-sec-div">
              <BoolToggle
                value={contrast === 'soft'}
                onChange={(enabled) => pickContrast(enabled ? 'soft' : 'normal')}
                label={L.lowContrast}
              />
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
          ><SiteBackgroundControl onDiagnosticsOpen={closeMenu} />{menuContent}</div>}
        </div>
      )}
    </div>
  );
}
