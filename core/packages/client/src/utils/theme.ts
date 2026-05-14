import { useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';
export type EffectiveTheme = 'light' | 'dark';
export const THEME_KEY = 'theme';

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export function bootstrapTheme() {
  const saved = (localStorage.getItem(THEME_KEY) as Theme | null) || 'system';
  applyTheme(saved);
}

function readEffective(): EffectiveTheme {
  const saved = (localStorage.getItem(THEME_KEY) as Theme | null) || 'system';
  if (saved === 'light' || saved === 'dark') return saved;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** 解析当前实际生效的主题 (light / dark)。订阅 localStorage 变化 + OS pref 变化。 */
export function useEffectiveTheme(): EffectiveTheme {
  const [t, setT] = useState<EffectiveTheme>(readEffective);
  useEffect(() => {
    const refresh = () => setT(readEffective());
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', refresh);
    window.addEventListener('storage', refresh);
    // 同一 tab 切 theme 不触发 storage 事件,自己 dispatch 一个
    window.addEventListener('theme-change', refresh);
    return () => {
      mq.removeEventListener('change', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('theme-change', refresh);
    };
  }, []);
  return t;
}
