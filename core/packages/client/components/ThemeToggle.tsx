'use client';

// Ported from packages/client-vite/src/components/ThemeToggle.tsx.
// Two-state toggle: Light ⇄ Dark. No explicit "system" option — an unvisited
// user still follows the OS (data-theme stays unset), but the button only ever
// flips between the two concrete themes.

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { THEME_KEY, applyTheme, readEffective, type EffectiveTheme } from '@/lib/theme';

export default function ThemeToggle({ className }: { className?: string }) {
  // SSR / first-paint must render a stable placeholder — the real theme isn't
  // known until we can read localStorage / matchMedia on the client.
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<EffectiveTheme>('light');
  // Whether the user has made an explicit choice (vs. still following the OS).
  const [explicit, setExplicit] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored);
      setExplicit(true);
    } else {
      setTheme(readEffective());
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    // Only force the DOM when the user has chosen — otherwise leave the
    // bootstrap's OS-following state (unset data-theme) intact.
    if (mounted && explicit) applyTheme(theme);
  }, [mounted, explicit, theme]);

  const cycle = () => {
    const next: EffectiveTheme = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    setTheme(next);
    setExplicit(true);
    // 点 light/dark 开关 = 想要经典明暗,顺手退出配色主题(在同一次淡出里清掉)。
    applyTheme(next, true, true);
    window.dispatchEvent(new Event('theme-change'));
  };

  const Icon = theme === 'dark' ? Moon : Sun;
  const label = theme === 'dark' ? 'Dark' : 'Light';
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
      title={`Theme: ${label} (click to toggle)`}
      aria-label={`Theme: ${label}`}
    >
      <Icon size={14} />
    </button>
  );
}
