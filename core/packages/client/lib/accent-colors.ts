export const ACCENT_KEY = 'accent-color';

// Menu swatches sampled from the supplied reference; text accents retain accessible theme variants.
// Dark surfaces use brighter variants; light surfaces keep accent text readable.
export const ACCENT_COLORS = [
  { id: 'blue', swatch: '#3266EE', zh: '蓝色', en: 'Blue', light: '#2457D6', dark: '#7EA2FF' },
  { id: 'cyan', swatch: '#00B1FD', zh: '青色', en: 'Cyan', light: '#007E9F', dark: '#46CDED' },
  { id: 'green', swatch: '#06BAA1', zh: '绿色', en: 'Green', light: '#087D63', dark: '#43D5AC' },
  { id: 'lime', swatch: '#B5D70E', zh: '青柠绿', en: 'Lime', light: '#527B00', dark: '#B4DB42' },
  { id: 'yellow', swatch: '#FDCB36', zh: '黄色', en: 'Yellow', light: '#916A00', dark: '#F4CE46' },
  { id: 'orange', swatch: '#FE8067', zh: '橙色', en: 'Orange', light: '#B64B18', dark: '#FF9A70' },
  { id: 'pink', swatch: '#FD49AC', zh: '粉色', en: 'Pink', light: '#BB1675', dark: '#F884C5' },
  { id: 'magenta', swatch: '#DC6ADC', zh: '洋红色', en: 'Magenta', light: '#9F2DB8', dark: '#DE8CEC' },
  { id: 'purple', swatch: '#A25BFF', zh: '紫色', en: 'Purple', light: '#7041C6', dark: '#BA9AFF' },
  { id: 'white', swatch: '#FFFFFF', zh: '白色', en: 'White', light: '#52525B', dark: '#F4F4F5' },
] as const;

export type AccentId = (typeof ACCENT_COLORS)[number]['id'] | `#${string}`;
export type AccentColor = { id: AccentId; swatch: string; light: string; dark: string; foreground?: string };

// Shared with the pre-paint bootstrap; accept only complete six-digit HEX colors.
export function customAccentColor(value: string | null | undefined): AccentColor | null {
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) return null;
  const hex = value.toUpperCase() as AccentId;
  const channels = [1, 3, 5].map(index => {
    const c = parseInt(hex.slice(index, index + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return { id: hex, swatch: hex, light: hex, dark: hex, foreground: luminance > 0.179 ? '#000000' : '#FFFFFF' };
}

export function findAccentColor(value: string | null | undefined): AccentColor | null {
  return ACCENT_COLORS.find(color => color.id === value) ?? customAccentColor(value);
}

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
