import type { AccentColor } from '@cuberoot/shared/appearance';

// Self-contained so the pre-paint bootstrap and hydrated UI use exactly the same writer.
export function setAccentRoot(root: HTMLElement, color: AccentColor | null) {
  if (color) {
    if (root.getAttribute('data-accent') !== color.id) root.setAttribute('data-accent', color.id);
  } else if (root.hasAttribute('data-accent')) {
    root.removeAttribute('data-accent');
  }
  const foregroundToken = '--user-accent-custom-foreground';
  if (color?.foreground) {
    if (root.style.getPropertyValue(foregroundToken) !== color.foreground) root.style.setProperty(foregroundToken, color.foreground);
  } else if (root.style.getPropertyValue(foregroundToken)) root.style.removeProperty(foregroundToken);
  for (const scheme of ['light', 'dark'] as const) {
    const token = `--user-accent-${scheme}`;
    const value = color?.[scheme] ?? '';
    if (root.style.getPropertyValue(token) === value) continue;
    if (value) root.style.setProperty(token, value);
    else root.style.removeProperty(token);
  }
}
