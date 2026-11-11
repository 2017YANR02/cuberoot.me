import { pyraNetGeometry } from '@cuberoot/puzzle-render-core/pyraminx-svg';
import { classifyPhotoColors, type CubeColor, type StickerSample } from '@cuberoot/shared/cube-photo/recognize';
import { homography, project, type Point, type Quad } from '@cuberoot/shared/cube-photo/geometry';
import type { PhotoPixels } from '@cuberoot/shared/cube-photo/detect';

export type PhotoPuzzle = 'skewb' | 'pyraminx' | 'sq1';
export const PUZZLE_PHOTO_SETS = { skewb: ['sarahs-advanced'], pyraminx: ['l3e', 'l4e'], sq1: ['pbl', 'ep', 'parity'] } as const;
export const PUZZLE_PHOTO_FACES = { skewb: ['F', 'R', 'B', 'L', 'U', 'D'], pyraminx: ['F', 'R', 'L', 'D'], sq1: ['F', 'R', 'B', 'L', 'U', 'D'] } as const;
export const PHOTO_FACE_NAMES: Record<string, { zh: string; en: string }> = {
  F: { zh: '前面', en: 'Front' }, R: { zh: '右面', en: 'Right' }, B: { zh: '后面', en: 'Back' },
  L: { zh: '左面', en: 'Left' }, U: { zh: '顶面', en: 'Top' }, D: { zh: '底面', en: 'Bottom' },
};
export const PYRA_VERTICES: Record<string, string[]> = { F: ['U', 'R', 'L'], D: ['L', 'R', 'B'], L: ['B', 'U', 'L'], R: ['U', 'B', 'R'] };
const p = (x: number, y: number): Point => ({ x, y });
const rect = (x0: number, y0: number, x1: number, y1: number) => [p(x0, y0), p(x1, y0), p(x1, y1), p(x0, y1)];

// Reuse the renderer's sticker ordering, normalized to a triangle pointing up.
const pyraCells = (() => {
  const cells = pyraNetGeometry().cells.filter(c => c.face === 0);
  const xs = cells.flatMap(c => c.points.map(v => v[0])), ys = cells.flatMap(c => c.points.map(v => v[1]));
  const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
  return cells.map(c => c.points.map(([a, b]) => p((a - x) / w, (b - y) / h)));
})();

/** Square-1 slots in each photographed square face, in the notation engine's frame. */
export const SQ1_LAYER_SLOTS = { U: [0, 2, 3, 5, 6, 8, 9, 11], D: [12, 13, 15, 16, 18, 19, 21, 22] };
export const SQ1_SIDE_SLOTS: Record<string, number[]> = {
  F: [0, 11, 9, 22, 12, 13], R: [9, 8, 6, 13, 15, 16],
  B: [6, 5, 3, 16, 18, 19], L: [3, 2, 0, 19, 21, 22],
};

export function puzzlePhotoCells(puzzle: PhotoPuzzle, face: string): Point[][] {
  if (puzzle === 'pyraminx') return pyraCells;
  if (puzzle === 'skewb') return [
    [p(.5, 0), p(1, .5), p(.5, 1), p(0, .5)],
    [p(0, 0), p(.5, 0), p(0, .5)], [p(1, 0), p(1, .5), p(.5, 0)],
    [p(0, 1), p(0, .5), p(.5, 1)], [p(1, 1), p(.5, 1), p(1, .5)],
  ];
  if (face !== 'U' && face !== 'D') {
    const cut = (1 - Math.tan(Math.PI / 12)) / 2, cuts = [0, cut, 1 - cut, 1];
    const middleCut = face === 'B' ? 1 - cut : cut;
    return [0, 1, 2].map(i => rect(cuts[i], 0, cuts[i + 1], 100 / 275))
      .concat([rect(0, 100 / 275, middleCut, 175 / 275), rect(middleCut, 100 / 275, 1, 175 / 275)])
      .concat([0, 1, 2].map(i => rect(cuts[i], 175 / 275, cuts[i + 1], 1)));
  }
  let angle = face === 'U' ? 105 : -105;
  const edgePoint = (deg: number) => {
    const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180), scale = .5 / Math.max(Math.abs(c), Math.abs(s));
    return p(.5 + c * scale, .5 + s * scale);
  };
  return Array.from({ length: 8 }, (_, i) => {
    const corner = (i % 2 === 0) === (face === 'U'), end = angle + (corner ? 60 : 30);
    const points = [p(.5, .5), edgePoint(angle)];
    for (let vertex = 45 + 90 * Math.ceil((angle - 45) / 90); vertex < end; vertex += 90) if (vertex > angle) points.push(edgePoint(vertex));
    points.push(edgePoint(end)); angle = end; return points;
  });
}

export function initialPhotoBounds(puzzle: PhotoPuzzle, width: number, height: number): Point[] {
  const s = Math.min(width, height) * .7, x = (width - s) / 2, y = (height - s) / 2;
  return puzzle === 'pyraminx' ? [p(width / 2, y), p(x + s, y + s), p(x, y + s)] : rect(x, y, x + s, y + s);
}

/** Triangular faces must be photographed straight on; quadrilaterals rectify perspective. */
export function projectPhotoPoint(bounds: Point[], point: Point): Point {
  if (bounds.length === 3) {
    const [a, b, c] = bounds, u = point.x - .5 * (1 - point.y), v = point.y - u;
    return p(a.x * (1 - point.y) + b.x * u + c.x * v, a.y * (1 - point.y) + b.y * u + c.y * v);
  }
  const h = homography(bounds as Quad);
  if (!h) throw new Error('invalid-grid');
  return project(h, point.x, point.y);
}

/** Average an interior patch in face coordinates, avoiding seams and clipped pixels. */
export function samplePuzzlePhoto(pixels: PhotoPixels, bounds: Point[], cells: Point[][], corrections: Record<number, CubeColor> = {}): StickerSample[] {
  const colors = cells.map(cell => {
    const center = p(cell.reduce((n, v) => n + v.x, 0) / cell.length, cell.reduce((n, v) => n + v.y, 0) / cell.length);
    const rgb: [number, number, number] = [0, 0, 0];
    let count = 0;
    for (const vertex of cell) for (const fraction of [0, .06, .12]) {
      const at = projectPhotoPoint(bounds, p(center.x + (vertex.x - center.x) * fraction, center.y + (vertex.y - center.y) * fraction));
      const x = Math.round(at.x), y = Math.round(at.y);
      if (x < 0 || y < 0 || x >= pixels.width || y >= pixels.height) continue;
      const offset = (y * pixels.width + x) * 4;
      for (let channel = 0; channel < 3; channel++) rgb[channel] += pixels.data[offset + channel];
      count++;
    }
    return rgb.map(v => count ? v / count : 0) as [number, number, number];
  });
  return classifyPhotoColors(colors).map((sample, index) => corrections[index]
    ? { ...sample, color: corrections[index], corrected: true, reliable: true } : sample);
}
