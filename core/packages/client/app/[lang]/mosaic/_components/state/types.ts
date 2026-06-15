export type RGB = [number, number, number];

export type Method = 'gradient' | 'closest' | 'ordered' | 'errorDiffusion';

export interface PaletteColor {
  available: boolean;
  rgb: RGB;
  name: string;
  notation: string;
  grad: boolean;
  tryDitherWo: boolean;
}

/** A method + initial params — one card shown in the method-choose stage. */
export interface ChooseSet {
  id: string;
  method: Method;
  palette: RGB[];
  /** For gradient: array of uniform-range arrays (one per thumbnail).
   *  For others: array of float ratios (one per thumbnail).
   */
  opts: number[] | number[][];
  displayKey: string;
}

export type Stage = 'upload' | 'crop' | 'choose-method' | 'choose-variant' | 'adjust' | 'palette';

export interface ImageEffects {
  brightness: number;     // -0.8 .. 0.8
  contrast: number;       // -0.8 .. 0.8
  saturation: number;     // 0 .. 0.9
  hue: number;            // -1 .. 1
  vibrance: number;       // -1 .. 1
  noise: number;          // 0 .. 1
  sharpenAmount: number;  // 0 .. 5 (unsharp strength combined w/ radius)
}

export const DEFAULT_EFFECTS: ImageEffects = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  vibrance: 0,
  noise: 0,
  sharpenAmount: 0,
};

export interface CropConfig {
  cubeDimen: number;          // 1 = pixel art, 3 = 3x3 cubes
  cubeWidth: number;          // width in cubes (e.g. 20)
  cubeHeight: number;         // height in cubes (e.g. 30)
}

export interface PdfConfig {
  blockWidthCubes: number;
  blockHeightCubes: number;
  drawLetters: boolean;
  bwPrinter: boolean;
  bottomToTop: boolean;
}

export const DEFAULT_PDF_CONFIG: PdfConfig = {
  blockWidthCubes: 3,
  blockHeightCubes: 4,
  drawLetters: true,
  bwPrinter: false,
  bottomToTop: true,
};

/** Selection state after stage 2 / 3. */
export interface MethodSelection {
  chooseSet: ChooseSet;
  /** Selected opt — matches chooseSet.opts element type. */
  opt: number | number[];
}

/** Dithering "cluster" (sub-group shown at the variant-choose stage).
 *  Gradient method uses `number[][]` (each element is a ranges array);
 *  dither methods use `number[]` (each element is a ratio scalar).
 */
export interface DitherCluster {
  labelKey: string;
  labelArg?: string;
  chooseSet: ChooseSet;
  variants: Array<number | number[]>;
}
