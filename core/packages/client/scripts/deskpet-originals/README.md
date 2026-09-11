# Original pet animation collection

12 selected designs (11, 14, 15, 18, 19, 23, 25, 26, 27, 38, 60, 61), each with 48 articulated SVG scenes. The two collections contain 24 scenes each. Approved concept images remain in the local project review folder `.tmp/png/original-pets-selected`.

Run from `core/packages/client`:

```
node scripts/deskpet-originals/build-originals.mjs
node scripts/deskpet-originals/build-originals.mjs --check
```

`characters/` owns the 12 individual layered rigs and attachment anchors. `scenes.mjs` owns bilingual story copy and collection order. `motion.mjs` maps each story to joint keyframes, with species-specific movement. `props.mjs` positions existing shared pet props for the character using them. The CSS timeline builder is shared with Root Beast in `scripts/deskpet-animation.mjs`.

The generated manifest is the single runtime source for pet selection, random play, gallery thumbnails and the existing seekable story player. Do not edit generated SVGs by hand. Increment the manifest version in the generator after changes to published assets, which have immutable cache headers.

Art is native vector or pixel geometry, with paper/feather/scale layers rather than baked raster textures. No external fonts, images, scripts or CDN resources are needed. Props face the animal when used privately; thumbnail backgrounds belong to the existing gallery theme, not to the transparent assets.

Review each character at thumbnail and enlarged sizes, including the beginning, action peak and return pose of all 48 scenes. Inspect silhouettes, eye clearance, short appendages, prop contact, scene bounds, and loop continuity. Lobster bodies stay rigid; motion comes from claws, antennae, legs and tail.
