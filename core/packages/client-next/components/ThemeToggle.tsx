'use client';

// Ported from packages/client/src/components/ThemeToggle.tsx.

import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { THEME_KEY, applyTheme, type Theme } from '@/lib/theme';

const ORDER: Theme[] = ['system', 'light', 'dark'];

export default function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    return (localStorage.getItem(THEME_KEY) as Theme) || 'system';
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    localStorage.setItem(THEME_KEY, next);
    setTheme(next);
    window.dispatchEvent(new Event('theme-change'));
  };

  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const label = theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System';
  const cls = ['theme-toggle-inline', className].filter(Boolean).join(' ');

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
