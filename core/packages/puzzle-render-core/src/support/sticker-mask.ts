/** Runtime-neutral facelet mask primitives shared by NxN and Square-1 renderers. */
export type FaceletMask = 0 | 1 | 2 | 3 | 4 | 5;
export const FM_REGULAR = 0 as const;
export const FM_DIM = 1 as const;
export const FM_IGNORED = 2 as const;
export const FM_ORIENTED = 3 as const;
export const FM_ORIENTED2 = 4 as const;
export const FM_OUTLINE = 5 as const;

export type StickeringMaskFn = (initial: number, face: number) => FaceletMask;

const MASK_VISIBILITY: Record<FaceletMask, number> = {
  [FM_REGULAR]: 5,
  [FM_OUTLINE]: 4,
  [FM_ORIENTED]: 3,
  [FM_ORIENTED2]: 3,
  [FM_DIM]: 2,
  [FM_IGNORED]: 1,
};

export function mergeStickeringMaskFns(
  masks: readonly (StickeringMaskFn | null | undefined)[],
): StickeringMaskFn | null {
  const active = masks.filter((mask): mask is StickeringMaskFn => !!mask);
  if (active.length === 0) return null;
  if (active.length === 1) return active[0];
  return (initial, face) => {
    let visible = active[0](initial, face);
    for (let i = 1; i < active.length; i++) {
      const value = active[i](initial, face);
      if (MASK_VISIBILITY[value] > MASK_VISIBILITY[visible]) visible = value;
      if (visible === FM_REGULAR) break;
    }
    return visible;
  };
}

export const FM_FIXED_COLOR: Partial<Record<FaceletMask, string>> = {
  [FM_IGNORED]: '#666666',
  [FM_ORIENTED]: '#44ddcc',
  [FM_ORIENTED2]: '#fffdaa',
};

export const FM_DIM_WHITE = '#dddddd';

export function dimFaceletColor(hex: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const value = parseInt(match[1], 16);
  if (value === 0xffffff) return FM_DIM_WHITE;
  const half = (shift: number): string =>
    (((value >> shift) & 0xff) >> 1).toString(16).padStart(2, '0');
  return `#${half(16)}${half(8)}${half(0)}`;
}

export function faceletDisplayColor(code: FaceletMask, base: string): string {
  return FM_FIXED_COLOR[code] ?? (code === FM_DIM ? dimFaceletColor(base) : base);
}
