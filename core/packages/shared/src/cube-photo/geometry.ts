/** Image coordinates, shared by detection, SVG overlays and local exports. */
export interface Point { x: number; y: number }
export type Quad = [Point, Point, Point, Point];
/** Back/top, left/top, front/top, right/top, left/bottom, front/bottom, right/bottom. */
export type CubeCorners = [Point, Point, Point, Point, Point, Point, Point];
export type FaceName = 'top' | 'left' | 'right';
export const FACE_NAMES: FaceName[] = ['top', 'left', 'right'];
export const FACE_INDICES: Record<FaceName, [number, number, number, number]> = {
  top: [0, 3, 2, 1], left: [1, 2, 5, 4], right: [2, 3, 6, 5],
};
export type Homography = [number, number, number, number, number, number, number, number];

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export function faceQuad(corners: CubeCorners, face: FaceName): Quad {
  return FACE_INDICES[face].map(i => corners[i]) as Quad;
}

/** Unit square -> quadrilateral. Perspective divisions happen BEFORE drawing the grid. */
export function homography(q: Quad): Homography | null {
  const [a, b, c, d] = q;
  const dx = a.x - b.x + c.x - d.x, dy = a.y - b.y + c.y - d.y;
  const bx = b.x - c.x, by = b.y - c.y, dx2 = d.x - c.x, dy2 = d.y - c.y;
  const det = bx * dy2 - dx2 * by;
  if (Math.abs(det) < 1e-6) return null;
  const g = (dx * dy2 - dx2 * dy) / det, h = (bx * dy - dx * by) / det;
  return [b.x - a.x + g * b.x, d.x - a.x + h * d.x, a.x,
    b.y - a.y + g * b.y, d.y - a.y + h * d.y, a.y, g, h];
}

export function project(h: Homography, u: number, v: number): Point {
  const denominator = h[6] * u + h[7] * v + 1;
  return { x: (h[0] * u + h[1] * v + h[2]) / denominator, y: (h[3] * u + h[4] * v + h[5]) / denominator };
}

export function validQuad(q: Quad, minArea = 4): boolean {
  if (q.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return false;
  const cross = q.map((a, i) => {
    const b = q[(i + 1) % 4], c = q[(i + 2) % 4];
    return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  });
  if (!cross.every(v => v > 0) && !cross.every(v => v < 0)) return false;
  const area = Math.abs(q.reduce((n, p, i) => n + p.x * q[(i + 1) % 4].y - p.y * q[(i + 1) % 4].x, 0)) / 2;
  const h = homography(q);
  return area >= minArea && !!h && [1, 1 + h[6], 1 + h[7], 1 + h[6] + h[7]].every(v => v > 0.05);
}

export interface GridSegment { a: Point; b: Point; inferred: boolean; boundary: boolean }
export function faceGrid(q: Quad, face: FaceName, size: 2 | 3 | 4 = 3): GridSegment[] {
  const h = homography(q);
  if (!h || !validQuad(q)) return [];
  const segments: GridSegment[] = [];
  for (let i = 0; i <= size; i++) {
    const t = i / size, boundary = i === 0 || i === size;
    segments.push({ a: project(h, 0, t), b: project(h, 1, t), inferred: size !== 2 && face !== 'top' && i > 1, boundary });
    if (face === 'top' || size === 2) segments.push({ a: project(h, t, 0), b: project(h, t, 1), inferred: false, boundary });
    else {
      segments.push({ a: project(h, t, 0), b: project(h, t, 1 / size), inferred: false, boundary });
      segments.push({ a: project(h, t, 1 / size), b: project(h, t, 1), inferred: true, boundary });
    }
  }
  return segments;
}

/** Manual starting template; NEVER returned as an automatic detection. */
export function manualCorners(width: number, height: number): CubeCorners {
  const s = Math.min(width * 0.38, height * 0.36), x = width / 2, y = height * 0.42;
  return [
    { x, y: y - s * 0.8 }, { x: x - s, y: y - s * 0.4 }, { x, y }, { x: x + s, y: y - s * 0.4 },
    { x: x - s, y: y + s * 0.65 }, { x, y: y + s * 1.05 }, { x: x + s, y: y + s * 0.65 },
  ];
}
