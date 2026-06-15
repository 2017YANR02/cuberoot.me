import type { PaletteColor, RGB } from '../state/types';

export const DEFAULT_PALETTE: PaletteColor[] = [
  { available: false, rgb: [  0,   0,   0], name: 'Black',  notation: 'D', grad: true,  tryDitherWo: true  },
  { available: true,  rgb: [  0,   0, 255], name: 'Blue',   notation: 'B', grad: true,  tryDitherWo: true  },
  { available: true,  rgb: [  0, 255,   0], name: 'Green',  notation: 'G', grad: false, tryDitherWo: true  },
  { available: true,  rgb: [255,   0,   0], name: 'Red',    notation: 'R', grad: true,  tryDitherWo: false },
  { available: false, rgb: [255, 105, 180], name: 'Pink',   notation: 'P', grad: true,  tryDitherWo: true  },
  { available: true,  rgb: [255, 153,   0], name: 'Orange', notation: 'O', grad: true,  tryDitherWo: false },
  { available: true,  rgb: [255, 255,   0], name: 'Yellow', notation: 'Y', grad: true,  tryDitherWo: false },
  { available: true,  rgb: [255, 255, 255], name: 'White',  notation: 'W', grad: true,  tryDitherWo: false },
];

export function newColor(): PaletteColor {
  return { available: false, rgb: [128, 128, 128], name: 'NewColor', notation: 'N', grad: true, tryDitherWo: false };
}

export function getFullPalette(palette: PaletteColor[]): RGB[] {
  return palette.filter(p => p.available).map(p => p.rgb);
}

export function getGradPalette(palette: PaletteColor[]): RGB[] {
  return palette
    .filter(p => p.available && p.grad)
    .map(p => p.rgb)
    .sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
}

/** Palettes with each "tryDitherWo" color removed — for producing diffusion variants. */
export function getPalettesExcludingColors(palette: PaletteColor[]): Array<{ colors: RGB[]; excludedName: string }> {
  const out: Array<{ colors: RGB[]; excludedName: string }> = [];
  palette.forEach((c, i) => {
    if (!c.available || !c.tryDitherWo) return;
    const colors = palette.filter((p, j) => p.available && j !== i).map(p => p.rgb);
    out.push({ colors, excludedName: c.name });
  });
  return out;
}

/** For variant-choose: palette variations where the darkest color is replaced with
 *  another equally-dark color. Returns one entry per candidate darkest color. */
export function getPalettesReplacingDarkest(palette: PaletteColor[]): Array<{ colors: RGB[]; darkColor: string }> {
  const avail = palette.filter(p => p.available);
  if (avail.length === 0) return [];
  const tone = (rgb: RGB) => rgb[0] + rgb[1] + rgb[2];
  const darkestTone = Math.min(...avail.map(p => tone(p.rgb)));
  const darkIdx = avail.map((p, i) => tone(p.rgb) === darkestTone ? i : -1).filter(i => i >= 0);

  return darkIdx.map(idx => {
    const rest: RGB[] = [];
    for (let i = 0; i < avail.length; i++) if (i !== idx) rest.push(avail[i].rgb);
    return { colors: [avail[idx].rgb, ...rest], darkColor: avail[idx].name };
  });
}

/** Lookup: rgb "r;g;b" → {name, notation}. */
export function buildColorLookup(palette: PaletteColor[]) {
  const nameMap = new Map<string, string>();
  const letterMap = new Map<string, string>();
  for (const p of palette) {
    const key = p.rgb.join(';');
    nameMap.set(key, p.name);
    letterMap.set(key, p.notation);
  }
  return {
    name: (rgb: RGB) => nameMap.get(rgb.join(';')) ?? rgb.join(';'),
    letter: (rgb: RGB) => letterMap.get(rgb.join(';')) ?? '?',
  };
}

/** Validate a palette JSON blob loaded from file. */
export function validatePalette(data: unknown): { valid: true } | { valid: false; msg: string } {
  if (!Array.isArray(data)) return { valid: false, msg: 'Not an array' };
  if (data.length === 0) return { valid: false, msg: 'Empty palette' };
  const required = ['available', 'rgb', 'name', 'grad'];
  for (let i = 0; i < data.length; i++) {
    const c = data[i] as Record<string, unknown>;
    for (const k of required) {
      if (!(k in c)) return { valid: false, msg: `Color #${i} missing "${k}"` };
    }
    const rgb = c.rgb as unknown;
    if (!Array.isArray(rgb) || rgb.length !== 3 || rgb.some(v => typeof v !== 'number')) {
      return { valid: false, msg: `Color #${i} has invalid RGB` };
    }
    if (typeof c.name !== 'string' || c.name.length < 1 || c.name.length > 25) {
      return { valid: false, msg: `Color #${i} has invalid name` };
    }
    if (c.notation !== undefined && (typeof c.notation !== 'string' || (c.notation as string).length > 5)) {
      return { valid: false, msg: `Color #${i} has invalid notation` };
    }
  }
  return { valid: true };
}
