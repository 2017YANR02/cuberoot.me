// Subset of packages/client-vite/src/utils/cubingScramble.ts — the (id → cubing-icons
// class) table only. EventIcon uses this to look up non-WCA event glyphs.
// The full cubingScramble.ts pulls cubing/scramble + worker bridges; we only
// need this static table for icon rendering.

export const TWIZZLE_NONWCA_APPEND: ReadonlyArray<{ id: string; iconClass: string }> = [
  { id: 'fto', iconClass: 'unofficial-fto' },
  { id: 'master_tetraminx', iconClass: 'unofficial-mtetram' },
  { id: 'kilominx', iconClass: 'unofficial-kilominx' },
  { id: 'redi_cube', iconClass: 'unofficial-redi' },
  { id: 'baby_fto', iconClass: 'unofficial-baby_fto' },
];
