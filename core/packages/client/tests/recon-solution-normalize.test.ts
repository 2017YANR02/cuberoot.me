import { describe, expect, it } from 'vitest';
import { normalizeReconSolution } from '@cuberoot/shared/recon-completion';

describe('normalizeReconSolution', () => {
  it('folds the reported standalone AUF into the preceding PLL stage', () => {
    const solution = [
      "U U U F R U' R' U' R U R' F' R U R' U' R' F R F' // PLL-Y",
      "U' // AUF",
    ].join('\n');

    expect(normalizeReconSolution(solution)).toBe(
      "U U U F R U' R' U' R U R' F' R U R' U' R' F R F' U' // PLL-Y",
    );
  });

  it('folds multi-move and consecutive AUF lines without changing the stage label', () => {
    expect(normalizeReconSolution([
      "l  R U R' // G Layer - 1 tip",
      "U u' b' // auf",
      "U2 // AUF",
    ].join('\n'))).toBe("l  R U R' U u' b' U2 // G Layer - 1 tip");
  });

  it('normalizes comment spacing while leaving non-AUF labels alone', () => {
    expect(normalizeReconSolution("R U//PLL\nU // pre-AUF\nU'//AUF?"))
      .toBe("R U // PLL\nU // pre-AUF\nU' // AUF?");
  });

  it('keeps AUF when there is no preceding algorithm stage to receive it', () => {
    expect(normalizeReconSolution("U'//AUF\n\n// note"))
      .toBe("U' // AUF\n\n// note");
  });

  it('does not merge into a preceding comment-only line', () => {
    expect(normalizeReconSolution("// PLL\nU' // AUF"))
      .toBe("// PLL\nU' // AUF");
  });
});
