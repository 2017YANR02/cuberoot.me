/**
 * Puzzle sticker and exported-art colours are domain identity colours, not UI
 * theme colours. UI chrome in draw-canvas.css still uses the site theme tokens.
 */
export const DRAW_TRANSPARENT = '#00000000';
export const DRAW_NEUTRAL_STICKER = '#777777';
export const DRAW_FONT_COLOR = '#111111';
export const DRAW_STROKE_COLOR = '#000000';

export const CUBE_FACE_COLORS = {
  white: '#ffffff',
  yellow: '#ffd500',
  red: '#b71234',
  orange: '#ff5800',
  blue: '#0046ad',
  green: '#009b48',
} as const;

export const DRAW_STICKER_PALETTE = [
  CUBE_FACE_COLORS.white,
  CUBE_FACE_COLORS.yellow,
  CUBE_FACE_COLORS.red,
  CUBE_FACE_COLORS.orange,
  CUBE_FACE_COLORS.blue,
  CUBE_FACE_COLORS.green,
  '#888888',
  '#333333',
] as const;

export const SKEWB_STICKER_PALETTE = [
  DRAW_TRANSPARENT,
  '#033fff',
  '#f3ff00',
  '#d10707',
  '#ff8806',
  '#206606',
  '#3d3d3d',
  '#f5f3db',
  DRAW_NEUTRAL_STICKER,
] as const;

export const PYRAMINX_STICKER_PALETTE = SKEWB_STICKER_PALETTE;

export const SQ1_STICKER_PALETTE = [
  DRAW_TRANSPARENT,
  '#033fff',
  '#f3ff00',
  '#d10707',
  '#206606',
  '#ff8806',
  '#3d3d3d',
  '#f5f3db',
  DRAW_NEUTRAL_STICKER,
] as const;

export const FTO_STICKER_PALETTE = [
  DRAW_TRANSPARENT,
  '#ffffff',
  '#deff26',
  '#0fcc09',
  '#2997fd',
  '#d80f0f',
  '#8830e3',
  '#ff9900',
  '#666666',
  '#3d3d3d',
  '#f5f3db',
  DRAW_NEUTRAL_STICKER,
] as const;

export const MEGAMINX_STICKER_PALETTE = [
  DRAW_TRANSPARENT,
  '#033fff',
  '#f3ff00',
  '#d10707',
  '#b112d8',
  '#206606',
  '#ebf076',
  '#4dd800',
  '#ff8806',
  '#f18886',
  '#60a8f1',
  '#3d3d3d',
  '#f5f3db',
  DRAW_NEUTRAL_STICKER,
] as const;
