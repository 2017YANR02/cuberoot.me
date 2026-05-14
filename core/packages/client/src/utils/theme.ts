export type Theme = 'system' | 'light' | 'dark';
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
