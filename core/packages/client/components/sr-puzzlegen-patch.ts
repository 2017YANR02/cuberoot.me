/**
 * sr-puzzlegen runtime patches, applied once when the module first loads.
 *
 * (1) PolygonRenderer.renderPolygons — gray inner-face painter fix.
 *     sr sorts polygons by `face.centroid.z` in world space (after object + group
 *     transforms). For sq1, `square1Corner`/`square1Edge`/`square1Middle` override the
 *     centroids of their `#333` inner faces to fixed points in piece-local frame to force
 *     them BEFORE outward stickers in the painter sort. That hack only holds near the
 *     renderer's default view — at moderate user tilts the override z' ends up above an
 *     adjacent piece's outward sticker, leaking a dark sliver onto the colored face at the
 *     kerf cuts. Real kerf cuts contain no sticker geometry, so a `#333` face is only ever
 *     "wrong" when its screen-space projection overlaps a colored sticker. Fix: render
 *     `#333` inner faces in a separate first pass; colored stickers always paint over them.
 *
 * (2) PolygonRenderer.render — caller-controlled camera distance so the image panel's
 *     透视 (perspective) slider drives the sr preview, matching the sim's left 3D. sr's
 *     Camera is hardcoded (perspective π/2, then translate z=−5, scale 4); we rebuild
 *     `camera.matrix` each frame from `srCamDist`, keeping scale ∝ distance so the puzzle
 *     stays the same on-screen size — only the foreshortening changes. See setSrPerspective.
 */

let patched = false;

// sr's native camera: `Matrix4.perspective(π/2,1,0.1,1000).translate(0,0,-5).scale(4,4,1)`.
const SR_NATIVE_DIST = 5;
const SR_NATIVE_SCALE = 4;

/** Camera distance for the NEXT sr render (set by PuzzleSVG before each `mod.SVG`). */
let srCamDist = SR_NATIVE_DIST;

/**
 * Set the sr camera distance for the next render. `null` → native (identical matrix,
 * a no-op vs unpatched sr). Larger distance = flatter (camera farther, more orthographic);
 * smaller = stronger perspective. The scale tracks distance so apparent size is constant.
 * PuzzleSVG calls this before every `mod.SVG`, so each render is self-consistent and other
 * sr consumers (which pass no distance → null) keep native behaviour.
 */
export function setSrPerspective(dist: number | null): void {
  srCamDist = dist == null ? SR_NATIVE_DIST : dist;
}

function isInnerGray(p: { face?: { color?: unknown } }): boolean {
  const c = p.face?.color;
  if (!c || typeof c !== 'object') return false;
  const v = (c as { value?: unknown }).value;
  return typeof v === 'string' && v.toLowerCase() === '#333';
}

export function patchSrPuzzlegen(mod: unknown): void {
  if (patched) return;
  const Proto = (mod as { Rendering?: { PolygonRenderer?: { prototype?: Record<string, unknown> } } })
    ?.Rendering?.PolygonRenderer?.prototype;
  if (!Proto || typeof Proto.renderPolygons !== 'function') return;
  patched = true;

  // (2) camera-distance injection — wrap the base render, rebuilding camera.matrix from
  //     srCamDist. Matrix4 is reached off the live instance (camera.matrix.constructor) so
  //     no module export is needed; the ops mirror sr's own Camera constructor exactly.
  const origRender = Proto.render;
  if (typeof origRender === 'function') {
    Proto.render = function (
      this: unknown,
      scene: unknown,
      camera: { matrix?: { constructor: unknown } },
    ) {
      if (camera?.matrix && srCamDist !== SR_NATIVE_DIST) {
        const M4 = camera.matrix.constructor as {
          perspective: (fov: number, aspect: number, near: number, far: number) => {
            translate: (x: number, y: number, z: number) => void;
            scale: (x: number, y: number, z: number) => void;
          };
        };
        const m = M4.perspective(Math.PI / 2, 1, 0.1, 1000);
        m.translate(0, 0, -srCamDist);
        const s = SR_NATIVE_SCALE * (srCamDist / SR_NATIVE_DIST);
        m.scale(s, s, 1);
        camera.matrix = m as unknown as { constructor: unknown };
      }
      return (origRender as (scene: unknown, camera: unknown) => void).call(this, scene, camera);
    };
  }

  // (1) gray painter fix
  Proto.renderPolygons = function (this: {
    polygons: Array<{ centroid: { z: number }; face?: { color?: unknown } }>;
    drawPolygon: (p: unknown) => void;
  }) {
    const cmp = (a: { centroid: { z: number } }, b: { centroid: { z: number } }) =>
      a.centroid.z - b.centroid.z;
    const gray = this.polygons.filter(isInnerGray).sort(cmp);
    const colored = this.polygons.filter((p) => !isInnerGray(p)).sort(cmp);
    gray.forEach((p) => this.drawPolygon(p));
    colored.forEach((p) => this.drawPolygon(p));
  };
}
