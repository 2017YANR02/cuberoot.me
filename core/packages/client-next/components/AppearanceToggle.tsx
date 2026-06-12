'use client';

// 统一的「外观」菜单 — 合并原 ThemeToggle(明暗)+ PaletteToggle(配色)成单一单选。
// 明暗(浅色 / 深色)和配色(中国色)在同一份列表里互斥单选:
//   选明暗 → 清掉配色回经典明暗;选配色 → 覆盖明暗。
// 彻底消除「两个控件偷偷打架、点了没反应 / 悄悄被踢出」的困惑。
// 入口挂 HeaderToggles(桌宠工具栏 = 全站外观入口);切换走 lib/theme 的
// applyTheme / applyPalette(View Transitions 淡出 + localStorage 持久化)。
//
// 没有单独的「经典 / 跟随系统」项:明暗区本身就是经典(无 palette),浅 / 深两项
// 直接预览经典亮 / 暗三色块,跟配色块同列对齐;勾跟随当前实际明暗。

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, Check } from 'lucide-react';
import {
  THEME_KEY,
  applyTheme,
  applyPalette,
  readPalette,
  useEffectiveTheme,
} from '@/lib/theme';
import { PALETTES, type PaletteId } from '@/lib/palettes';
import AppLink from '@/components/AppLink';

// 经典配色亮 / 暗的 [背景, 强调, 文字] —— 跟 globals.css 的 :root / [data-theme=dark] 对应。
const CLASSIC_LIGHT: [string, string, string] = ['#fafafa', '#c15f3c', '#171717'];
const CLASSIC_DARK: [string, string, string] = ['#171717', '#d97757', '#fafafa'];

function Swatch({ colors }: { colors: [string, string, string] }) {
  return (
    <span className="palette-swatch" aria-hidden="true">
      {colors.map((c, i) => (
        <i key={i} style={{ background: c }} />
      ))}
    </span>
  );
}

export default function AppearanceToggle({ className }: { className?: string }) {
  const { i18n } = useTranslation();
  const lang = i18n.language || 'en';
  const isHant = lang.startsWith('zh-Hant');
  const isZh = lang.startsWith('zh');
  const t = (zh: string, zhHant: string, en: string) => (isHant ? zhHant : isZh ? zh : en);
  const L = {
    title: t('外观', '外觀', 'Appearance'),
    scheme: t('明暗', '明暗', 'Light / Dark'),
    palette: t('配色', '配色', 'Color'),
    light: t('浅色', '淺色', 'Light'),
    dark: t('深色', '深色', 'Dark'),
    more: t('比较全部', '比較全部', 'Compare all'),
  };
  const nameOf = (p: (typeof PALETTES)[number]) => (isHant ? p.zhHant : isZh ? p.zh : p.en);

  const [mounted, setMounted] = useState(false);
  const [palette, setPalette] = useState<PaletteId | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const eff = useEffectiveTheme();

  useEffect(() => {
    const readState = () => setPalette(readPalette() as PaletteId | null);
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
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // 选明暗:清掉配色回经典明暗(在同一次淡出里清),并持久化 theme。
  const pickTheme = (choice: 'light' | 'dark') => {
    setOpen(false);
    try { localStorage.setItem(THEME_KEY, choice); } catch { /* ignore */ }
    applyTheme(choice, true, true);
    window.dispatchEvent(new Event('theme-change'));
  };

  // 选配色:覆盖明暗(applyPalette 内部已 dispatch theme-change)。
  const pickPalette = (id: PaletteId) => {
    setOpen(false);
    applyPalette(id, true);
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
        onClick={() => setOpen((v) => !v)}
        title={L.title}
        aria-label={L.title}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <ButtonIcon size={14} />
      </button>
      {open && (
        <div className="lang-menu palette-menu appearance-menu" role="menu">
          <div className="appearance-sec-label">{L.scheme}</div>

          <button
            type="button"
            role="menuitemradio"
            aria-checked={onScheme && eff === 'light'}
            className={`lang-menu-item${onScheme && eff === 'light' ? ' is-active' : ''}`}
            onClick={() => pickTheme('light')}
          >
            <span className="lang-menu-check">{onScheme && eff === 'light' && <Check size={13} />}</span>
            <Swatch colors={CLASSIC_LIGHT} />
            <span>{L.light}</span>
          </button>

          <button
            type="button"
            role="menuitemradio"
            aria-checked={onScheme && eff === 'dark'}
            className={`lang-menu-item${onScheme && eff === 'dark' ? ' is-active' : ''}`}
            onClick={() => pickTheme('dark')}
          >
            <span className="lang-menu-check">{onScheme && eff === 'dark' && <Check size={13} />}</span>
            <Swatch colors={CLASSIC_DARK} />
            <span>{L.dark}</span>
          </button>

          <div className="appearance-sec-label appearance-sec-div">{L.palette}</div>

          {PALETTES.map((p) => {
            const on = p.id === palette;
            return (
              <button
                key={p.id}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                className={`lang-menu-item${on ? ' is-active' : ''}`}
                onClick={() => pickPalette(p.id)}
              >
                <span className="lang-menu-check">{on && <Check size={13} />}</span>
                <Swatch colors={p.swatch} />
                <span>{nameOf(p)}</span>
              </button>
            );
          })}

          <AppLink href="/appearance" className="palette-menu-more" onClick={() => setOpen(false)}>
            {L.more} →
          </AppLink>
        </div>
      )}
    </div>
  );
}
