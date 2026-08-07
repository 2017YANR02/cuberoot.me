# CubingApp Square-1 algorithm ports

## Source snapshot

- Application: <https://cubingapp.com/algorithms/SQ1-Cube-Shape>, <https://cubingapp.com/algorithms/SQ1-CSP>, <https://cubingapp.com/algorithms/SQ1-CP>, <https://cubingapp.com/algorithms/SQ1-EO>, <https://cubingapp.com/algorithms/SQ1-EP>, and <https://cubingapp.com/algorithms/SQ1-OBL>
- Repository: <https://github.com/spencerchubb/cubingapp>
- Commit: `613a49885dc618023368e5f0c2a25024b8c7e9a5`
- Input files: `tanstack/src/routes/algorithms/algs/SQ1-{Cube-Shape,CSP,CP,EO,EP,OBL}.json`

The checked-in SQL is generated from that source snapshot:

```powershell
Set-Location core
pnpm --filter @cuberoot/alg-build exec tsx gen_cubingapp_sq1_sql.mts D:/cube/cubingapp
pnpm --filter @cuberoot/alg-build exec tsx gen_cubingapp_sq1_stages_sql.mts D:/cube/cubingapp
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

### CP, EO, EP, and OBL

CP already contained all eight CubingApp formulas. Migration 0108 keeps its eight ids, case names and 20 existing alternatives while restoring CubingApp's source order and `Top Adj` / `Top Opp` / `Top Solved` groups.

EO keeps its seven ids and ten existing formulas, adds six source-only alternatives, and preserves the source notes in bilingual formula metadata. Its final coverage is seven cases and 16 formulas.

EP is merged by physical Square-1 state rather than by visible labels. Seventeen source cases match existing states; those retain their ids, names, formulas and saved progress. The other 23 source states add 24 formulas, producing 72 cases and 76 formulas after the site's 32 additional cases. New source names retain CubingApp's `&` separator because `Ua & Ua` and the existing `Ua / Ua` are different physical states; mechanically changing the separator would silently create a name collision.

OBL is imported in source order with all 185 cases and 185 formulas across one through six slices. It uses the same flat Square-1 renderer as the catalog, PDF and trainer. The OBL plan applies the existing EO face-only mask, so recognition images show both face colours but no side stickers or equator. This is an alias in the shared mask function, not a duplicate renderer or a new simulator-stage option.

## Verification

`tests/sq1-cubingapp-port.test.ts` and `tests/sq1-cubingapp-stages-port.test.ts` read the migration payloads and lock case counts, formula counts, subgroup distributions, mappings, source tags, setup inversions and renderability. The migrations check their final database counts and abort if an existing baseline is not the expected one.

## MIT license notice

Copyright (c) 2024 Spencer Chubb

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
