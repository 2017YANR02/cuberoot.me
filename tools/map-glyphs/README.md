# Self-hosted MapLibre label glyphs

SDF glyph PBFs for the `/wca/comp` globe view (`GlobeMapClient.tsx`). Upstream the
OpenFreeMap style points `glyphs` at `tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf`;
we serve them from here instead so no font data is fetched off a third-party host.

Served by static.cuberoot.me (nginx, CORS `*`); in dev by `app/tools/[...slug]/route.ts`.
Referenced via `staticUrl('/tools/map-glyphs/{fontstack}/{range}.pbf')`.

## Why only 189 files

MapLibre rasterizes CJK ideographs, kana and hangul **locally** from a system font
(`localIdeographFontFamily`, default `'sans-serif'`) and never requests those ranges.
That is the whole reason this mirror is viable: the full font stack is ~33 MB per
weight, of which **29 MB is CJK** that never crosses the network.

So we mirror only what MapLibre actually asks a glyph server for:

| block | ranges | why |
|---|---|---|
| `U+0000–U+2E7F` | 0-255 … 11776-12031 | Latin, Cyrillic, Greek, Arabic, Hebrew, Devanagari, Thai, Ethiopic, … |
| `U+A000–U+ABFF` | 40960-41215 … 43776-44031 | Latin Ext-D, Vai, Hangul Jamo Ext |
| `U+FB00–U+FEFF` | 64256-64511 … 65024-65279 | Latin/Hebrew/Arabic presentation forms |

× 3 fontstacks (`Noto Sans Regular` / `Bold` / `Italic` — every `text-font` the
Liberty style uses) = 189 files, ~11 MB.

A world tour of 64 cities at z5/z9/z12, in both label languages, touched 18 distinct
ranges — well inside this set. The extra ranges are headroom so an unvisited region
never renders blank labels.

## Refresh / extend

```sh
# one file
curl -o "Noto Sans Regular/0-255.pbf" \
  "https://tiles.openfreemap.org/fonts/Noto%20Sans%20Regular/0-255.pbf"
```

To re-derive which ranges are actually needed, hook `window.fetch` in the browser,
filter for `/fonts/`, then pan the map across the regions you care about — that is
how the 18-range figure above was measured.

If a label ever renders blank, the missing range is the first thing to check:
`Network → *.pbf → 404`. Adding it is one `curl` plus a commit.

Glyphs are derived from Noto Sans (SIL OFL 1.1) as packaged by OpenFreeMap.
