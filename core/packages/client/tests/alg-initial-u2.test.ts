import { expect, it } from 'vitest';
import { canonicalizeInitialU2 } from '@cuberoot/shared/alg-html';
import { regenerateMirrorAlgs } from '@cuberoot/shared/alg-mirror';

it('normalizes only initial U2 prime and retains formatting and metadata', () => {
  const entry = { alg: "U2' F' L' U' L U2' F", algHtml: "<u><s>U2'</s></u> F' L' U' L <em>U2'</em> F", source: 'test' };
  expect(canonicalizeInitialU2(entry)).toEqual({
    ...entry, alg: "U2 F' L' U' L U2' F", algHtml: "<u><s>U2</s></u> F' L' U' L <em>U2'</em> F",
  });
  expect(entry.alg.startsWith("U2'")).toBe(true);
  expect(canonicalizeInitialU2({ alg: " (U2' R) U2'" }).alg).toBe(" (U2 R) U2'");
  expect(canonicalizeInitialU2({ alg: "U2'R U2'" }).alg).toBe("U2R U2'");
  for (const alg of ["R U2'", "Uw2' R", "u2' R", "y U2' R", "U' R", 'U2 R']) {
    expect(canonicalizeInitialU2({ alg }).alg).toBe(alg);
  }
});

it('keeps regenerated mirror rows canonical without dropping their marks', () => {
  const result = regenerateMirrorAlgs({ id: 1, algs: [[{ alg: "U2 R U2' R'", algHtml: "<s>U2</s> R U2' R'" }], [], [], []] },
    { id: 2, algs: [[], [], [], []] });
  const mirror = result.algsById.get(2)![1][0];
  expect(mirror.alg).toBe("U2 L' U2 L");
  expect(mirror.algHtml).toBe("<s>U2</s> L' U2 L");
});
