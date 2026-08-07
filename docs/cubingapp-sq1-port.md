# CubingApp Square-1 CS and CSP port

## Source snapshot

- Application: <https://cubingapp.com/algorithms/SQ1-Cube-Shape> and <https://cubingapp.com/algorithms/SQ1-CSP>
- Repository: <https://github.com/spencerchubb/cubingapp>
- Commit: `613a49885dc618023368e5f0c2a25024b8c7e9a5`
- Input files: `tanstack/src/routes/algorithms/algs/SQ1-Cube-Shape.json` and `SQ1-CSP.json`

The checked-in SQL is generated from that source snapshot:

```powershell
Set-Location core
pnpm --filter @cuberoot/alg-build exec tsx gen_cubingapp_sq1_sql.mts D:/cube/cubingapp
```

## Coverage

The existing CS library keeps every existing case name and database id so saved progress remains valid. The import:

- adds the missing `Left 4-2 / Perpendicular Edges` case;
- replaces the duplicated left-hand formula on `Pair / Right 5-1` with the correct right-hand formula;
- adds five source-only alternative formulas to their existing cases;
- leaves the site's extra solved card in place.

The resulting CS set has 170 cards: all 169 source shapes plus the site's solved card, with 178 formulas.

CSP is imported in source order with all 179 cases and 203 formulas. Its subgroup labels use the site's `Slice` spelling. Case names retain CubingApp's `(Odd)` and `(Even)` labels. Each setup is the inverse of its first solving formula and every formula entry records `source: cubingapp`.

Both sets use the existing Square-1 flat renderer. CS is grey because only shape matters; CSP keeps full piece colours because parity recognition depends on them. Both hide the equator and use the non-compact face gap. The shared thumbnail plan feeds the catalog, PDF export, trainer and mixed-set trainer, so those consumers cannot drift into different pictures.

CubingApp's page-level random `before` and `after` rotation strings are not copied: CubeRoot's existing trainer owns case setup and randomisation. The source cases, formulas, order, odd/even labels and recognition states are preserved.

## Verification

`tests/sq1-cubingapp-port.test.ts` reads the migration payload and locks the case counts, formula counts, subgroup distribution, odd/even split, source tags and setup inversions. The migration itself checks the final database counts and aborts if the existing CS baseline is not the expected one.

## MIT license notice

Copyright (c) 2024 Spencer Chubb

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
