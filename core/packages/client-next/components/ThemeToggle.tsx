'use client';

// Ported from packages/client/src/components/ThemeToggle.tsx.

import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { THEME_KEY, applyTheme, type Theme } from '@/lib/theme';

const ORDER: Theme[] = ['system', 'light', 'dark'];

export default function ThemeToggle({ className }: { className?: string }) {
  // SSR / first-paint must render a stable placeholder — server has no
  // localStorage so it'd render 'system' (Monitor), and client reads
  // 'light' (Sun) → hydration mismatch. Defer real icon until mount.
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const t = (localStorage.getItem(THEME_KEY) as Theme) || 'system';
    setTheme(t);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) applyTheme(theme);
  }, [mounted, theme]);

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    localStorage.setItem(THEME_KEY, next);
    setTheme(next);
    window.dispatchEvent(new Event('theme-change'));
  };

  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const label = theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System';
  const cls = ['theme-toggle-inline', className].filter(Boolean).join(' ');

  if (!mounted) {
    return (
      <button
        type="button"
        className={cls}
        aria-label="Theme"
        suppressHydrationWarning
      >
        <span style={{ display: 'inline-block', width: 14, height: 14 }} />
      </button>
    );
  }

  return (
    <button
      type="button"
      className={cls}
      onClick={cycle}
      title={`Theme: ${label} (click to cycle)`}
      aria-label={`Theme: ${label}`}
    >
      <Icon size={14} />
    </button>
  );
}
