# @cuberoot/visualcube

TypeScript Rubik's cube SVG renderer. Forked from sr-visualizer (npm) which itself ports the original PHP visualcube by Cride5. Long-term plan: progressively port remaining PHP features into TS.

## License

LGPL-3, see COPYING and COPYING.LESSER. Original PHP visualcube (c) Cride5; sr-visualizer (c) Tyler Decker.

## Origin

- sr-visualizer (TS port we forked from): https://github.com/tdecker91/visualcube
- Original PHP visualcube: https://github.com/Cride5/visualcube

## Usage

This package is `private: true` (monorepo only, not published). Three entry points:

### 1. Programmatic — `renderCubeSVG(options)` → SVG string

```ts
import { renderCubeSVG } from '@cuberoot/visualcube'

const svg = renderCubeSVG({
  cubeSize: 3,
  case: "R U R' U'",                    // STATE = solved after applying inverse
  view: 'plan',
  mask: 'oll' as any,                   // or import { Masking }
  arrows: 'U0U2,U6U8',
  defaultArrowColor: 'red',
  width: 256,
  height: 256,
})
// → '<svg xmlns="..." width="256" ...>...</svg>'
```

Pure function, no DOM, safe in Node (used server-side at `/api/visualcube.svg`).
For DOM mounting use `cubeSVG(container, options)`; for canvas rasterisation `cubePNG(container, options)`.

`renderCubeSVG` also accepts a PHP-style query string — handy for porting URLs:

```ts
renderCubeSVG('?pzl=3&alg=R+U+R%27+U%27&arw=U0U2-blue&ac=red&size=256')
```

### 2. HTTP — `GET /api/visualcube.svg` (server)

Simplified URL API, returns `image/svg+xml` (cached 24h). Seven params:

| Param  | Values | Default |
|--------|--------|---------|
| `alg`  | WCA notation. Renders the STATE produced by inverting the alg from solved (i.e. the case the alg solves) | Sune |
| `view` | `iso` / `plan` / `f2l` / `oll` / `pll` / `pll-iso` (combinations of plan-view + LL/F2L mask) / `trans` (PHP visualcube preset: silver semi-transparent shell) | `iso` |
| `mask` | Explicit `Masking` enum value, overrides view-derived mask | — |
| `size` | Pixel dimension, clamped to [32, 1000] | 256 |
| `bg`   | Hex (with/without `#`) or named CSS colour (alpha-only) | transparent |
| `cc`   | Cube shell colour, hex or CSS name (PHP `cc`) | black (silver when `view=trans`) |
| `co`   | Cube shell opacity 0-100 (PHP `co`) | 100 (50 when `view=trans`) |

```
https://www.cuberoot.me/api/visualcube.svg?alg=R+U+R%27+U%27+R+U2+R%27&view=oll&size=128
```

This endpoint does NOT accept the full PHP query API (no `arw` / `ac` / `sch` / `fc` / `fd`). For arbitrary configurations, use the programmatic API in your own server route.

### 3. React — `<VisualCube>` component (client)

```tsx
import { VisualCube } from '@/components/VisualCube'

<VisualCube algorithm="R U R' U R U2 R'" view="oll" size={88} />
```

Thin wrapper that emits an `<img src="/api/visualcube.svg?...">`. Use this anywhere a 3x3 case preview is needed (algdb, recon, training). Hand-written `<rect>` SVG cubes are a bug — see the project-level `visualcube` skill.

## ICubeOptions ↔ PHP query parameters

| `ICubeOptions` field | PHP param | Type / notes |
|---|---|---|
| `cubeSize` | `pzl` | NxN size (default 3) |
| `width` / `height` | `size` | Pixels; PHP `size` sets both |
| `view` | `view` | `'plan'` enables top-down + side-rim OLL stickers |
| `mask` | `stage` | `Masking` enum — see "Implemented" stage list below |
| `maskAlg` | `stage=cross-x2` suffix | Post-rotation applied to mask |
| `viewportRotations` | `r` | `[Axis, deg][]` — viewport orientation |
| `algorithm` | `alg` | WCA notation; renders the resulting state |
| `case` | `case` | WCA notation; renders the *inverse* state (the case to solve) |
| `stickerColors` | `fc` | Per-sticker colour (54 chars or comma list) |
| `colorScheme` | `sch` | Face → colour map (6 chars / 6 colours) |
| `facelets` | `fd` | Per-sticker `FaceletDefinition` (U/F/R/D/L/B/o/n/t) |
| `backgroundColor` | `bg` | SVG background |
| `cubeColor` | `cc` | Plastic colour |
| `cubeOpacity` / `stickerOpacity` | `co` / `fo` | 0–100 |
| `dist` | `dist` | Camera distance, default 5 |
| `arrows` | `arw` | `Arrow[]` or `'U0U2-red,U6U8'` string |
| `defaultArrowColor` | `ac` | Fallback colour for arrows without one (`ac=t` ignored) |

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
- [x] Transparent shell preset (PHP `view=trans`) — `parseOptions` maps to `cubeColor='silver'` + `cubeOpacity=50`; explicit `cc`/`co` still win. (PHP also turns blank `n` facelets into real transparent — that subtlety is NOT ported, blank stays dark gray.)
- [x] Arrows (`arrows`, PHP `arw`) — straight + curved (s3 via-sticker), per-arrow colour, `-s` scale, `-i` influence
- [x] Default arrow colour (`defaultArrowColor`, PHP `ac`) — applied to arrows that don't specify a per-arrow colour; PHP semantics: `ac=t` (transparent) is ignored, falls back to gray
- [x] Cube + sticker opacity (`cubeOpacity`/`stickerOpacity`, PHP `co`/`fo`) — covers PHP `view=trans`
- [x] Background colour, cube base colour, projection distance (`backgroundColor`/`cubeColor`/`dist`)
- [x] PHP query-string compatibility (`parseOptions`) — `pzl size view stage r alg case fc sch bg cc co fo dist arw ac fd`
- [x] Repeat-count syntax in `fc` / `sch` / `fd` (PHP V0.6.5) — pre-pass `expandRepeats` in `parsing/repeatExpand.ts` turns `y20r6` into 20 y's + 6 r's; bypassed for comma-separated values; applied identically to all three options
- [x] Extended colour palette (PHP V0.6.6) — `z` zero `#1B1B1B`, `f` forest `#006600`, `i` lpink `#FF99FF`, `e` cream `#EEE8AA`, `c` cyan `#88DDFF`, `v` navy `#3375B2`, `a` tan `#885500`. Hex values verbatim from `_php_reference/index.php` $ZERO/$FOREST/$LPINK/$CREAM/$CYAN/$NAVY/$TAN. PHP `u` (custom placeholder, six spaces) intentionally not mapped — it has no defined hex in PHP.

### Pending — High priority

### Pending — Medium priority
- [ ] Per-cube-size mask sets for 2x2 / 4x4 / 5x5 / 6x6 / 7x7 (PHP `index.php` lines 749+) — currently TS masks only fire for `cubeSize=3`
- [ ] Algorithm support for cubes >3x3 — PHP comment says "Currently unavailable for 4x4 cubes or above" but Yan's `fcs_doperm` actually handles NxN; TS simulator should follow
- [ ] `oriented` (`o`) / `blank` (`n`) facelet definitions render colour: TS has the enum but check the silver/grey tones match PHP exactly
- [ ] Configurable `outlineWidth` / `strokeWidth` / `viewbox` exposed as documented public options (already in interface, not in any preset)

### Pending — Low / probably won't port
- [ ] Multi-format output: `gif | jpg | tiff | ico` (PHP `fmt`) — PHP shells out to ImageMagick; in browser we ship SVG and `cubePNG()` already does canvas rasterise. PNG covers 99%.
- [ ] Cookie-configurable defaults (PHP `ENABLE_COOKIES`) — React state + per-call options replace this
- [ ] MySQL image cache (`vcache` table, PHP `ENABLE_CACHE`) — server-side concern, irrelevant in-browser
- [ ] `MAX_PZL_DIM = 52` hard cap — keep as soft warning; nobody renders 52x52
- [ ] PHP `index.php` script-extension routing (`.png`/`.svg`/etc URL suffix) — was URL-rewrite trick, not API surface

### Modernization (separate from feature parity)
- [x] svg.js@2 → native template-literal SVG strings (no library) — `cube/drawing.ts` builds output as plain strings, single function `renderCubeSVG(opts): string` is the new pure-string entry point. `cubeSVG(container, opts)` kept as a thin DOM shim (sets `innerHTML`). Zero runtime deps; works in Node (SSR-ready). Dropped ~80KB from any page that imports visualcube; collapsed the React `<VisualCube>` data-URI roundtrip into a single string build (consumers now call `renderCubeSVG()` and `encodeURIComponent` it directly — no detached `<div>`, no `querySelector`, no `XMLSerializer`).
- [x] Tighten TS strict mode — full `strict: true` inherited from base. Internal `ResolvedCubeOptions` type captures the merged-with-defaults shape so the renderer can use required fields without optional-chaining noise; public `ICubeOptions` keeps every field optional.
- [ ] Export `Mask`/`Face`/`Axis` enum members as proper typed unions (currently `mask?: Masking` works but downstream callers pass raw strings)
- [ ] `cubePNG` uses `setTimeout` with no delay — replace with proper await on svg load event
- [ ] Replace `parseInt(paramValue) || N` patterns that swallow `0` as falsy in option parser
- [ ] Add unit tests for option parsing + mask geometry (golden SVG snapshots)
