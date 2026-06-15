/**
 * sr-puzzlegen `PolygonRenderer.renderPolygons` sorts by `face.centroid.z` in
 * world space (after object + group transforms). For sq1, `square1Corner` /
 * `square1Edge` / `square1Middle` override the centroids of their `#333`
 * inner faces to fixed points in piece-local frame to force them BEFORE
 * outward stickers in the painter sort.
 *
 * That hack only holds near the renderer's default view — at moderate user
 * tilts (e.g. sq1 `x=-62°, z=-37°`) the override z' ends up above an
 * adjacent piece's outward sticker, leaking a dark sliver onto the colored
 * face at the corner/edge kerf cuts.
 *
 * Real kerf cuts contain no sticker geometry, so a `#333` face is only ever
 * "wrong" when its screen-space projection overlaps a colored sticker. Fix:
 * render `#333` inner faces in a separate first pass; colored stickers
 * always paint over them. Visible kerf cuts still show gray (no sticker
 * covers them), and the leak disappears.
 */

let patched = false;

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
