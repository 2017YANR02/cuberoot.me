import type { ChooseSet, DitherCluster, PaletteColor, RGB } from '../state/types';
import { getFullPalette, getGradPalette, getPalettesExcludingColors, getPalettesReplacingDarkest } from './palette';
import { initialRangePopulation, populateScalarOpts } from './ranges';

/** First-stage choose: a set of methods × initial param grids. */
export function buildChooseSets(palette: PaletteColor[]): ChooseSet[] {
  const sets: ChooseSet[] = [];
  const grad = getGradPalette(palette);
  const full = getFullPalette(palette);

  if (grad.length >= 2) {
    sets.push({
      id: 'gradient',
      method: 'gradient',
      palette: grad,
      opts: initialRangePopulation(grad, [0.55, 0.65, 0.75], [0.35, 0.45]),
      displayKey: 'mosaic.method.gradient',
    });
  }
  if (full.length >= 2) {
    sets.push({
      id: 'errorDiffusion',
      method: 'errorDiffusion',
      palette: full,
      opts: [0.4, 1.0, 1.8, 2.9, 3.8, 5.7],
      displayKey: 'mosaic.method.errorDiffusion',
    });
    sets.push({
      id: 'ordered',
      method: 'ordered',
      palette: full,
      opts: [-8, -3.5, -1.5, 1.0, 4.0, 6.2],
      displayKey: 'mosaic.method.ordered',
    });
    for (const pal of getPalettesExcludingColors(palette)) {
      sets.push({
        id: `errorDiffusion_wo_${pal.excludedName}`,
        method: 'errorDiffusion',
        palette: pal.colors,
        opts: [1.0, 2.5, 3.5, 6.2],
        displayKey: 'mosaic.method.errorDiffusionWithout',
      });
    }
  }
  return sets;
}

/** Second-stage variant-choose: clusters (optional palette variation) × scalar variants. */
export function buildVariantClusters(
  palette: PaletteColor[],
  base: ChooseSet,
  opt: number | number[],
): DitherCluster[] {
  if (base.method === 'gradient' || base.method === 'closest') {
    // These use different second-stage logic — variant clusters only for dither methods.
    return [];
  }

  const scalarOpt = opt as number;
  const fullLen = palette.filter(p => p.available).length;
  const replacements = getPalettesReplacingDarkest(palette);
  const doesntLookDifferent = base.method === 'ordered' && scalarOpt > 0;

  const nonNeg = base.method === 'errorDiffusion';
  const opts = populateScalarOpts(base.opts as number[], scalarOpt, nonNeg);

  if (base.palette.length !== fullLen || replacements.length <= 1 || doesntLookDifferent) {
    return [{
      labelKey: base.displayKey,
      chooseSet: base,
      variants: opts as Array<number | number[]>,
    }];
  }

  return replacements.map(r => ({
    labelKey: 'mosaic.method.withDark',
    labelArg: r.darkColor,
    chooseSet: { ...base, palette: r.colors as RGB[] },
    variants: opts as Array<number | number[]>,
  }));
}
