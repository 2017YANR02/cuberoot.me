# CubeRoot structural puzzle icons

These are site-owned vectors, separate from the vendored cubing/icons originals.
The simulator and `/icon` consume the same generated `puzzle-*` map. The gallery
uses the simulator's bilingual names and downloads the same SVG it displays.

`core/packages/client/scripts/generate-puzzle-icons.mts` projects the exact
PuzzleGeometry definitions in `sim/pgCatalog.ts`. Cube, tetrahedron and
dodecahedron glyphs show one face; octahedron glyphs use a diamond silhouette;
icosahedron glyphs show the visible solid, not a pentagonal minx substitute.
All cuts are retained, including the order-dependent cuts on large puzzles.
The 96-unit artwork has balanced margins and constant-width transparent gaps;
dense patterns use narrower gaps. Fill and line art inherit `currentColor`.

Visible seams alone cannot express the complete turning mechanism: Little Chop
and Dino, for example, can have matching face subdivisions. Do not invent extra
seams just to make such projects look different. Curvy Copter keeps the existing
curved SVG because its planar PG approximation cannot depict physical curves.

`gear.svg` is the existing authored Gear Cube artwork, moved from the gallery's
private copy so the project menu no longer uses the Super Gear icon. `custom.svg`
is a cutting-plane symbol for the custom geometry editor.

From `core/`:

```sh
pnpm --filter @cuberoot/client exec node scripts/generate-puzzle-icons.mts
pnpm --filter @cuberoot/event-icon generate
```

Add `--check` to the first command to compare without writing. Review the full
set in `/zh/icon#icons-puzzle`, as well as at small sizes in `/zh/sim`.
`puzzle-icon-catalog.test.ts` verifies every catalog entry, raw SVG/map agreement,
gallery coverage and bilingual name reuse. Upstream drift checks exclude this
directory.
