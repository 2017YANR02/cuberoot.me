// Paper-color helpers for the /paint artboard.
//
// The artboard background ("paper") is a user-chosen document property. To keep
// content readable, the default ink (stroke / text / glyph color) follows the
// paper: near-black ink on light paper, near-white ink on dark paper. The fill
// gray (#cbd5e1) is intentionally NOT derived — it reads on both.

export const DEFAULT_PAPER = '#f5f6f8';

// Ink for light paper (near-black) and dark paper (near-white). These mirror the
// historical theme-locked content colors so light-paper docs are unchanged.
const INK_LIGHT = '#111827';
const INK_DARK = '#f5f6f8';

// Translucent grid-dot derivations (color-mix, no hand-written rgba).
const DOT_LIGHT = 'color-mix(in srgb, #000 14%, transparent)';
const DOT_DARK = 'color-mix(in srgb, #fff 16%, transparent)';

// Parse #rgb / #rrggbb into [r,g,b] 0..255. Returns null for anything else
// (e.g. color-mix / named colors) so callers can fall back to "light".
function parseHex(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Relative luminance (sRGB, linearized), 0..1.
function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 1; // treat unknown as light
  const lin = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

export function isPaperDark(hex: string): boolean {
  return luminance(hex) < 0.5;
}

export interface PaperInk {
  ink: string; // default stroke / text / glyph color for this paper
  gridDot: string; // translucent dot color for this paper
}

export function paperInk(hex: string): PaperInk {
  return isPaperDark(hex)
    ? { ink: INK_DARK, gridDot: DOT_DARK }
    : { ink: INK_LIGHT, gridDot: DOT_LIGHT };
}
