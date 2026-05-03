# @cuberoot/visualcube

TypeScript Rubik's cube SVG renderer. Forked from sr-visualizer (npm) which itself ports the original PHP visualcube by Cride5. Long-term plan: progressively port remaining PHP features into TS.

## License

LGPL-3, see COPYING and COPYING.LESSER. Original PHP visualcube (c) Cride5; sr-visualizer (c) Tyler Decker.

## Origin

- sr-visualizer (TS port we forked from): https://github.com/tdecker91/visualcube
- Original PHP visualcube: https://github.com/Cride5/visualcube

## PHP to TS Port Roadmap

sr-visualizer (the TS source we forked) ports most of PHP visualcube but is missing some features. Priorities reflect the cuberoot.me use cases (algdb, recon, training preview). See `_php_reference/` for the spec.

### Implemented
- [x] Core 3D cube projection + face render order (z-sort)
- [x] NxN cube rendering (`cubeSize`, PHP `pzl`)
- [x] Algorithm simulation (`algorithm` / `case`, PHP `alg` / `case`) — TS-only engine, not ported from PHP, supports SiGN wide-move `Rw`/`r` and slice `M E S`. Parser also accepts the four PHP `fcs_format_alg` extensions: backtick `` ` `` as prime alias, `(R U R' U')3` repeat groups, `2R` single inner-layer (uppercase, expands to `2r R'`), `2-5r` range slices (expands to `5r R'` etc). Inner-layer / range expansions are degenerate on `cubeSize=3` but accepted without error.
- [x] Custom colour scheme (`colorScheme`, PHP `sch`) — abbreviation + comma-separated list + 3/6-digit hex
- [x] Facelet Definition (`facelets` string, PHP `fd`) — `parseFaceletDefinitions` is wired up in `index.ts`; upstream README's "still to implement" note is stale
- [x] Facelet Colours (`stickerColors`, PHP `fc`) via `parseFaceletColors`
- [x] 22 stage masks (`mask`, PHP `stage`): fl, f2l, ll, cll, ell, oll, ocll, oell, coll, ocell, wv, vh, els, cls, cmll, cross, f2l_3, f2l_2, f2l_sm, f2l_1, f2b, line
- [x] Extended 3x3 stage masks (Yan/Kira PHP additions, `cubeSize=3` only) — data-driven via PHP-format 54-char strings:
  - Block-building: `2x2x2`, `2x2x3`, `112`, `122`, `222_fl`, `222_bl`, `222_br`
  - Cross variants: `cross_partial` (PHP "Cross"), `cross_fr`, `cross_br`, `cross_fb`, `cross_lr`
  - X-Cross variants: `xcross_fr`, `xcross_br`, `xcross_fl`, `xcross_bl`, `xxcross`
  - F2L progress: `dec`, `tec_fr`, `tec_fl`, `tec_bl`, `tec_br`, `pair`
  - EO/orbit: `eo_orbit`, `eo_outer_orbit`
  - EOLR/EOLS/L5EF: `eolrb_r`, `eolrb_l`, `eolrb_f`, `eolrb_b`, `eols`, `l5ef`
  - Roux: `fb`, `sb`, `fb1`, `fb2`, `sb1`, `sb2`, `roux_co`, `roux_dr`, `roux_dronly`
  - Square-1 first-block shapes: `sq_rdf`, `sq_fdr`, `sq_dfr`
  - DR (Domino Reduction): `dr`, `dr_r`, `dr_r_u2_rp`, `dr_r_u_rp`, `dr_r_up_rp`, `dr_u`
  - Mehta: `mehta_sq`, `mehta_belt2`, `mehta_eole2`, `mehta_tdr`
- [x] Mask post-rotation (`maskAlg`, PHP `stage=cross-x2`) — TS extracts the suffix into a separate option, equivalent
- [x] Plan view (`view: 'plan'`, PHP `view=plan`) with OLL side-rim stickers
- [x] Arrows (`arrows`, PHP `arw`) — straight + curved (s3 via-sticker), per-arrow colour, `-s` scale, `-i` influence
- [x] Cube + sticker opacity (`cubeOpacity`/`stickerOpacity`, PHP `co`/`fo`) — covers PHP `view=trans`
- [x] Background colour, cube base colour, projection distance (`backgroundColor`/`cubeColor`/`dist`)
- [x] PHP query-string compatibility (`parseOptions`) — `pzl size view stage r alg case fc sch bg cc co fo dist arw fd`
- [x] Repeat-count syntax in `fc` / `sch` / `fd` (PHP V0.6.5) — pre-pass `expandRepeats` in `parsing/repeatExpand.ts` turns `y20r6` into 20 y's + 6 r's; bypassed for comma-separated values; applied identically to all three options
- [x] Extended colour palette (PHP V0.6.6) — `z` zero `#1B1B1B`, `f` forest `#006600`, `i` lpink `#FF99FF`, `e` cream `#EEE8AA`, `c` cyan `#88DDFF`, `v` navy `#3375B2`, `a` tan `#885500`. Hex values verbatim from `_php_reference/index.php` $ZERO/$FOREST/$LPINK/$CREAM/$CYAN/$NAVY/$TAN. PHP `u` (custom placeholder, six spaces) intentionally not mapped — it has no defined hex in PHP.

### Pending — High priority

### Pending — Medium priority
- [ ] Per-cube-size mask sets for 2x2 / 4x4 / 5x5 / 6x6 / 7x7 (PHP `index.php` lines 749+) — currently TS masks only fire for `cubeSize=3`
- [ ] Algorithm support for cubes >3x3 — PHP comment says "Currently unavailable for 4x4 cubes or above" but Yan's `fcs_doperm` actually handles NxN; TS simulator should follow
- [ ] `oriented` (`o`) / `blank` (`n`) facelet definitions render colour: TS has the enum but check the silver/grey tones match PHP exactly
- [ ] Default arrow colour option (`ac`, PHP) — TS parser logs `Currently param 'ac' is unsupported`
- [ ] Configurable `outlineWidth` / `strokeWidth` / `viewbox` exposed as documented public options (already in interface, not in any preset)

### Pending — Low / probably won't port
- [ ] Multi-format output: `gif | jpg | tiff | ico` (PHP `fmt`) — PHP shells out to ImageMagick; in browser we ship SVG and `cubePNG()` already does canvas rasterise. PNG covers 99%.
- [ ] Cookie-configurable defaults (PHP `ENABLE_COOKIES`) — React state + per-call options replace this
- [ ] MySQL image cache (`vcache` table, PHP `ENABLE_CACHE`) — server-side concern, irrelevant in-browser
- [ ] `MAX_PZL_DIM = 52` hard cap — keep as soft warning; nobody renders 52x52
- [ ] PHP `index.php` script-extension routing (`.png`/`.svg`/etc URL suffix) — was URL-rewrite trick, not API surface

### Modernization (separate from feature parity)
- [x] svg.js@2 → native template-literal SVG strings (no library) — `cube/drawing.ts` builds output as plain strings, single function `renderCubeSVG(opts): string` is the new pure-string entry point. `cubeSVG(container, opts)` kept as a thin DOM shim (sets `innerHTML`). Zero runtime deps; works in Node (SSR-ready). Dropped ~80KB from any page that imports visualcube; collapsed the React `<VisualCube>` data-URI roundtrip into a single string build (consumers now call `renderCubeSVG()` and `encodeURIComponent` it directly — no detached `<div>`, no `querySelector`, no `XMLSerializer`).
- [~] Tighten TS strict mode — `strict: true` now inherits from base; only `noImplicitAny: false` and `strictNullChecks: false` remain explicitly off. Five of the seven strict sub-flags (strictFunctionTypes, strictBindCallApply, noImplicitThis, useUnknownInCatchVariables, alwaysStrict) are on. Remaining gaps live in the older vendored files (parsing/, simulation/, geometry/, stickers/, drawing/), mostly because `ICubeOptions` has every field optional but consumers rely on the merged-with-defaults pattern — fixing properly needs a `ResolvedICubeOptions` (defaults applied) shape threaded through. Tighten file-by-file.
- [ ] Export `Mask`/`Face`/`Axis` enum members as proper typed unions (currently `mask?: Masking` works but downstream callers pass raw strings)
- [ ] `cubePNG` uses `setTimeout` with no delay — replace with proper await on svg load event
- [ ] Replace `parseInt(paramValue) || N` patterns that swallow `0` as falsy in option parser
- [ ] Add unit tests for option parsing + mask geometry (golden SVG snapshots)
