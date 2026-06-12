'use client';

// 中国色「配色主题」picker。挂在 HeaderToggles 里(桌宠工具栏 = 全站主题入口)。
// 第一项「经典」= 清掉 palette 回到原赭陶 light/dark;其余是中国传统色主题。
// 切换走 lib/theme.ts 的 applyPalette(View Transitions 淡出 + localStorage 持久化)。
// 像 ThemeToggle 一样用 mounted 守卫,首屏渲染稳定占位避免 hydration mismatch。

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Palette, Check } from 'lucide-react';
import { applyPalette, readPalette } from '@/lib/theme';
import { PALETTES, type PaletteId } from '@/lib/palettes';
import AppLink from '@/components/AppLink';
import { tr } from '@/i18n/tr';

const CLASSIC_SWATCH: [string, string, string] = ['#fafafa', '#c15f3c', '#171717'];

function Swatch({ colors }: { colors: [string, string, string] }) {
  return (
    <span className="palette-swatch" aria-hidden="true">
      {colors.map((c, i) => (
        <i key={i} style={{ background: c }} />
      ))}
    </span>
  );
}

export default function PaletteToggle({ className }: { className?: string }) {
  const { i18n } = useTranslation();
  const lang = i18n.language || 'en';
  const isHant = lang.startsWith('zh-Hant');
  const isZh = lang.startsWith('zh');
  const label = {
    classic: tr({ zh: '经典', en: 'Classic',
        zhHant: "經典"
    }),
    title: tr({ zh: '配色主题', en: 'Color theme',
        zhHant: "配色主題"
    }),
  };
  const nameOf = (p: (typeof PALETTES)[number]) => (isHant ? p.zhHant : isZh ? p.zh : p.en);
  const [mounted, setMounted] = useState(false);
  const [current, setCurrent] = useState<PaletteId | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrent(readPalette() as PaletteId | null);
    setMounted(true);
    const refresh = () => setCurrent(readPalette() as PaletteId | null);
    window.addEventListener('theme-change', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('theme-change', refresh);
      window.removeEventListener('storage', refresh);
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

  const pick = (id: PaletteId | null) => {
    setOpen(false);
    setCurrent(id);
    applyPalette(id, true);
  };

  const cls = ['theme-toggle-inline', className].filter(Boolean).join(' ');

  if (!mounted) {
    return (
      <button type="button" className={cls} aria-label="Color theme" suppressHydrationWarning>
        <span style={{ display: 'inline-block', width: 14, height: 14 }} />
      </button>
    );
  }

  return (
    <div className="lang-toggle-wrap" ref={ref}>
      <button
        type="button"
        className={cls}
        onClick={() => setOpen((v) => !v)}
        title={label.title}
        aria-label={label.title}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Palette size={14} />
      </button>
      {open && (
        <div className="lang-menu palette-menu" role="menu">
          <button
            type="button"
            role="menuitemradio"
            aria-checked={current === null}
            className={`lang-menu-item${current === null ? ' is-active' : ''}`}
            onClick={() => pick(null)}
          >
            <span className="lang-menu-check">{current === null && <Check size={13} />}</span>
            <Swatch colors={CLASSIC_SWATCH} />
            <span>{label.classic}</span>
          </button>
          {PALETTES.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitemradio"
              aria-checked={p.id === current}
              className={`lang-menu-item${p.id === current ? ' is-active' : ''}`}
              onClick={() => pick(p.id)}
            >
              <span className="lang-menu-check">{p.id === current && <Check size={13} />}</span>
              <Swatch colors={p.swatch} />
              <span>{nameOf(p)}</span>
            </button>
          ))}
          <AppLink
            href="/appearance"
            className="palette-menu-more"
            onClick={() => setOpen(false)}
          >
            {tr({ zh: '比较全部 →', en: 'Compare all →',
                zhHant: "比較全部 →"
            })}
          </AppLink>
        </div>
      )}
    </div>
  );
}
