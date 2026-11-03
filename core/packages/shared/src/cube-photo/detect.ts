import { distance, faceQuad, homography, lerp, project, validQuad, type CubeCorners, type Point, type Quad } from './geometry';

export interface PhotoPixels { width: number; height: number; data: Uint8ClampedArray }
export interface CubePhotoCandidate {
  corners: CubeCorners;
  /** Image-evidence scores, NOT calibrated probabilities. */
  topSupport: number;
  sideSupport: number;
}
export interface CubePhotoDetection {
  candidates: CubePhotoCandidate[];
  lineCount: number;
  reason: 'ok' | 'no-grid' | 'no-edges';
}
interface Line { angle: number; rho: number; votes: number }
interface Edges { width: number; height: number; strength: Float32Array; gx: Float32Array; gy: Float32Array }
const PI = Math.PI;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const angleDistance = (a: number, b: number) => Math.min(Math.abs(a - b), PI - Math.abs(a - b));

/** RGB gradients retain boundaries between colours with similar luminance. */
function edgesOf(image: PhotoPixels): Edges {
  const { width: w, height: h, data } = image;
  const size = w * h, raw = new Float32Array(size), gx = new Float32Array(size), gy = new Float32Array(size);
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    const i = y * w + x;
    let best = 0;
    for (let c = 0; c < 3; c++) {
      const at = (dx: number, dy: number) => data[((y + dy) * w + x + dx) * 4 + c];
      const dx = at(1, -1) + 2 * at(1, 0) + at(1, 1) - at(-1, -1) - 2 * at(-1, 0) - at(-1, 1);
      const dy = at(-1, 1) + 2 * at(0, 1) + at(1, 1) - at(-1, -1) - 2 * at(0, -1) - at(1, -1);
      const magnitude = Math.hypot(dx, dy) / 1020;
      if (magnitude > best) { best = magnitude; gx[i] = dx; gy[i] = dy; }
    }
    raw[i] = best;
  }
  // Two-pixel tolerance for bevels/gaps. Coordinates describe grid cell boundaries,
  // while a physical cube often has TWO sticker edges flanking each boundary.
  const strength = new Float32Array(size);
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    let m = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const value = raw[(y + dy) * w + x + dx];
      m = Math.max(m, value / (value + 0.16) * (1 - 0.07 * (dx * dx + dy * dy)));
    }
    strength[y * w + x] = m;
  }
  return { width: w, height: h, strength, gx, gy };
}

function houghLines(edges: Edges): Line[] {
  const { width: w, height: h, gx, gy } = edges;
  const radius = Math.ceil(Math.hypot(w, h)), bins = radius * 2 + 1, angles = 180;
  const votes = new Float32Array(bins * angles);
  const cos = Array.from({ length: angles }, (_, i) => Math.cos(i * PI / angles));
  const sin = Array.from({ length: angles }, (_, i) => Math.sin(i * PI / angles));
  for (let y = 3; y < h - 3; y += 2) for (let x = 3; x < w - 3; x += 2) {
    const i = y * w + x, magnitude = Math.hypot(gx[i], gy[i]) / 1020;
    if (magnitude < 0.09) continue;
    let normal = Math.atan2(gy[i], gx[i]);
    if (normal < 0) normal += PI;
    const angle = Math.round(normal * angles / PI);
    for (let offset = -4; offset <= 4; offset++) {
      const a = (angle + offset + angles) % angles;
      const rho = Math.round(x * cos[a] + y * sin[a]) + radius;
      votes[a * bins + rho] += Math.min(magnitude, 0.5);
    }
  }
  const peaks: Line[] = [];
  for (let a = 0; a < angles; a++) for (let r = 1; r < bins - 1; r++) {
    const value = votes[a * bins + r];
    if (value < 3 || value < votes[a * bins + r - 1] || value < votes[a * bins + r + 1]) continue;
    peaks.push({ angle: a * PI / angles, rho: r - radius, votes: value });
  }
  peaks.sort((a, b) => b.votes - a.votes);
  const selected: Line[] = [];
  for (const line of peaks) {
    if (selected.some(other => {
      const wrap = Math.abs(other.angle - line.angle) > PI / 2;
      return angleDistance(other.angle, line.angle) < 5 * PI / 180 && Math.abs(other.rho - (wrap ? -line.rho : line.rho)) < 7;
    })) continue;
    selected.push(line);
    if (selected.length === 100) break;
  }
  return selected;
}

function intersect(a: Line, b: Line): Point | null {
  const ax = Math.cos(a.angle), ay = Math.sin(a.angle), bx = Math.cos(b.angle), by = Math.sin(b.angle);
  const det = ax * by - ay * bx;
  if (Math.abs(det) < 0.15) return null;
  return { x: (a.rho * by - ay * b.rho) / det, y: (ax * b.rho - a.rho * bx) / det };
}

function lineSupport(e: Edges, a: Point, b: Point): number {
  if (!Number.isFinite(a.x + a.y + b.x + b.y)) return 0;
  const count = clamp(Math.ceil(distance(a, b) / 5), 10, 40);
  let sum = 0;
  for (let j = 1; j < count; j++) {
    const p = lerp(a, b, j / count), x = Math.round(p.x), y = Math.round(p.y);
    if (x >= 2 && x < e.width - 2 && y >= 2 && y < e.height - 2) sum += e.strength[y * e.width + x];
  }
  return sum / (count - 1);
}

/** Prefer uniform cell interiors; repeated texture alone is not a cube grid. */
function cellCoherence(image: PhotoPixels, q: Quad, rows = 3): number {
  const h = homography(q);
  if (!h) return 0;
  let total = 0;
  for (let y = 0; y < rows; y++) for (let x = 0; x < 3; x++) {
    const colors: number[][] = [];
    for (const [du, dv] of [[0.5, 0.5], [0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]]) {
      const p = project(h, (x + du) / 3, (y + dv) / 3), px = Math.round(p.x), py = Math.round(p.y);
      if (px < 0 || py < 0 || px >= image.width || py >= image.height) return 0;
      const i = (py * image.width + px) * 4;
      colors.push([image.data[i], image.data[i + 1], image.data[i + 2]]);
    }
    const variance = colors.slice(1).reduce((sum, rgb) => sum + Math.hypot(...rgb.map((c, i) => c - colors[0][i])) / 441.7, 0) / 4;
    total += Math.max(0, 1 - variance * 3);
  }
  return total / (rows * 3);
}

function topScore(image: PhotoPixels, e: Edges, q: Quad): number {
  if (!validQuad(q, image.width * image.height * 0.008)) return 0;
  if (q.some(p => p.x < 2 || p.y < 2 || p.x > e.width - 3 || p.y > e.height - 3)) return 0;
  const lengths = q.map((p, i) => distance(p, q[(i + 1) % 4]));
  if (Math.min(...lengths) < 30 || Math.max(...lengths) / Math.min(...lengths) > 3.2) return 0;
  const h = homography(q)!;
  let support = 0, internal = 0;
  for (let j = 0; j <= 3; j++) {
    const s = (lineSupport(e, project(h, 0, j / 3), project(h, 1, j / 3))
      + lineSupport(e, project(h, j / 3, 0), project(h, j / 3, 1))) / 2;
    support += s;
    if (j === 1 || j === 2) internal += s;
  }
  // Both internal grid directions must be supported: a lone object outline fails.
  const i1 = lineSupport(e, project(h, 1 / 3, 0), project(h, 1 / 3, 1));
  const i2 = lineSupport(e, project(h, 0, 1 / 3), project(h, 1, 1 / 3));
  return (support / 4 * 0.5 + internal / 2 * 0.3 + Math.min(i1, i2) * 0.2) * (0.55 + 0.45 * cellCoherence(image, q));
}

function lineFamilies(lines: Line[]): Line[][] {
  const seeds: number[] = [];
  const ordered = [...lines].sort((a, b) => {
    const strength = (l: Line) => lines.reduce((s, x) => s + (angleDistance(x.angle, l.angle) < 10 * PI / 180 ? x.votes : 0), 0);
    return strength(b) - strength(a);
  });
  for (const l of ordered) {
    if (seeds.every(a => angleDistance(a, l.angle) > 20 * PI / 180)) seeds.push(l.angle);
    if (seeds.length === 6) break;
  }
  return seeds.map(a => lines.filter(l => angleDistance(l.angle, a) < 13 * PI / 180).slice(0, 22));
}

function boundaryPairs(lines: Line[], w: number, h: number): [Line, Line][] {
  const center = { x: w / 2, y: h / 2 };
  const offset = (l: Line, ref: Line) => {
    const sign = Math.cos(l.angle - ref.angle) < 0 ? -1 : 1;
    return sign * (l.rho - center.x * Math.cos(l.angle) - center.y * Math.sin(l.angle));
  };
  const pairs: { pair: [Line, Line]; score: number }[] = [];
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const a = lines[i], b = lines[j], ao = offset(a, a), bo = offset(b, a), gap = Math.abs(ao - bo);
    if (gap < Math.min(w, h) * 0.09 || gap > Math.max(w, h) * 0.8) continue;
    let score = 0;
    for (const t of [1 / 3, 2 / 3]) {
      const target = ao + (bo - ao) * t;
      let best = 0;
      for (const l of lines) {
        if (l === a || l === b) continue;
        const delta = Math.abs(offset(l, a) - target);
        best = Math.max(best, Math.max(0, 1 - delta / (gap * 0.17)) * Math.sqrt(l.votes));
      }
      score += best;
    }
    if (score > 1) pairs.push({ pair: [a, b], score: score + 0.15 * Math.sqrt(a.votes * b.votes) });
  }
  // Ranking uses approximately parallel offsets. Keep a wider bounded beam:
  // real perspective makes opposite edges converge, so the right pair can rank
  // below parallel keyboard/background edges even though its 2D grid fits well.
  return pairs.sort((a, b) => b.score - a.score).slice(0, 80).map(p => p.pair);
}

function asTop(points: Point[]): Quad | null {
  const center = { x: points.reduce((s, p) => s + p.x, 0) / 4, y: points.reduce((s, p) => s + p.y, 0) / 4 };
  const sorted = [...points].sort((a, b) => Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x));
  const first = sorted.reduce((best, p, i) => p.y < sorted[best].y ? i : best, 0);
  const q = sorted.map((_, i) => sorted[(i + first) % 4]) as Quad;
  // Prototype capture contract: top above both side faces, up to moderate roll.
  const spanX = Math.max(...q.map(p => p.x)) - Math.min(...q.map(p => p.x));
  const spanY = Math.max(...q.map(p => p.y)) - Math.min(...q.map(p => p.y));
  if (q[2].y < Math.max(q[1].y, q[3].y) - spanY * 0.1 || spanY / spanX > 1.1 || spanY / spanX < 0.16) return null;
  return q;
}

function refineTop(image: PhotoPixels, edges: Edges, original: Quad): { q: Quad; score: number } {
  let q = original.map(p => ({ ...p })) as Quad, score = topScore(image, edges, q);
  for (const step of [4, 2, 1]) for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < 4; i++) for (const axis of ['x', 'y'] as const) for (const sign of [-1, 1]) {
      const proposal = q.map(p => ({ ...p })) as Quad;
      proposal[i][axis] += sign * step;
      const next = topScore(image, edges, proposal);
      if (next > score) { q = proposal; score = next; }
    }
  }
  return { q, score };
}

/** Extrusion in homogeneous coordinates keeps all three faces projectively consistent.
 * Only the first side row is scored; lower rows can be covered by a hand. */
function extrude(q: Quad, dx: number, dy: number, dw: number): CubeCorners | null {
  const h = homography(q);
  if (!h) return null;
  const lower = (u: number, v: number) => {
    const weight = 1 + h[6] * u + h[7] * v;
    const p = project(h, u, v), z = weight + dw;
    return z > 0.1 ? { x: (p.x * weight + dx) / z, y: (p.y * weight + dy) / z } : { x: NaN, y: NaN };
  };
  const corners: CubeCorners = [q[0], q[3], q[2], q[1], lower(0, 1), lower(1, 1), lower(1, 0)];
  if (!validQuad(faceQuad(corners, 'left')) || !validQuad(faceQuad(corners, 'right'))) return null;
  if (corners[5].y <= corners[2].y) return null;
  return corners;
}

function sideScore(image: PhotoPixels, edges: Edges, corners: CubeCorners): number {
  const scores = (['left', 'right'] as const).map(face => {
    const q = faceQuad(corners, face), h = homography(q)!;
    const row = lineSupport(edges, project(h, 0, 1 / 3), project(h, 1, 1 / 3));
    let columns = 0;
    for (let i = 0; i <= 3; i++) columns += lineSupport(edges, project(h, i / 3, 0.03), project(h, i / 3, 1 / 3));
    return (row * 0.6 + columns / 4 * 0.4) * (0.6 + cellCoherence(image, q, 1) * 0.4);
  });
  return (scores[0] + scores[1]) * 0.35 + Math.min(...scores) * 0.3;
}

function fitSides(image: PhotoPixels, edges: Edges, q: Quad): { corners: CubeCorners; score: number } | null {
  const size = (distance(q[2], q[1]) + distance(q[2], q[3])) / 2;
  let best: { corners: CubeCorners; score: number; params: number[] } | null = null;
  const h = homography(q)!, weight = 1 + h[6] + h[7];
  // The front vertical edge need not be visible down to the bottom of the cube.
  for (const angle of [60, 75, 90, 105, 120]) for (const factor of [0.65, 0.9, 1.15, 1.4, 1.7]) for (const dw of [-0.15, 0, 0.15]) {
    const dx = Math.cos(angle * PI / 180) * size * factor * weight + q[2].x * dw;
    const dy = Math.sin(angle * PI / 180) * size * factor * weight + q[2].y * dw;
    const corners = extrude(q, dx, dy, dw);
    if (!corners) continue;
    const score = sideScore(image, edges, corners);
    if (!best || score > best.score) best = { corners, score, params: [dx, dy, dw] };
  }
  if (!best) return null;
  for (const step of [size * 0.1, size * 0.04, 2]) for (let pass = 0; pass < 2; pass++) for (let i = 0; i < 3; i++) for (const sign of [-1, 1]) {
    const params: number[] = [...best.params];
    if (i === 2) {
      const delta = sign * step / (size * 3);
      params[0] += q[2].x * delta; params[1] += q[2].y * delta; params[2] += delta;
    } else params[i] += sign * step;
    if (Math.abs(params[2]) > 0.45) continue;
    const corners = extrude(q, params[0], params[1], params[2]);
    if (!corners || distance(corners[2], corners[5]) < size * 0.5 || distance(corners[2], corners[5]) > size * 2) continue;
    const score = sideScore(image, edges, corners);
    if (score > best.score) best = { corners, score, params };
  }
  return best;
}

/** Training-free, bounded, single-frame prototype. No model, remote call, or hidden template fallback. */
export function detectCubePhoto(image: PhotoPixels): CubePhotoDetection {
  if (image.width < 32 || image.height < 32 || image.width > 720 || image.height > 720
    || image.data.length !== image.width * image.height * 4) throw new Error('invalid_image_dimensions');
  const edges = edgesOf(image), lines = houghLines(edges);
  if (lines.length < 8) return { candidates: [], lineCount: lines.length, reason: 'no-edges' };
  const families = lineFamilies(lines), pairs = families.map(f => boundaryPairs(f, image.width, image.height));
  const proposals: { q: Quad; score: number }[] = [];
  for (let i = 0; i < families.length; i++) for (let j = i + 1; j < families.length; j++) {
    if (angleDistance(families[i][0].angle, families[j][0].angle) < 25 * PI / 180) continue;
    for (const a of pairs[i]) for (const b of pairs[j]) {
      const points = [intersect(a[0], b[0]), intersect(a[0], b[1]), intersect(a[1], b[1]), intersect(a[1], b[0])];
      if (points.some(p => !p)) continue;
      const q = asTop(points as Point[]);
      if (!q) continue;
      const score = topScore(image, edges, q);
      if (score > 0.32) proposals.push({ q, score });
    }
  }
  proposals.sort((a, b) => b.score - a.score);
  const distinct: typeof proposals = [];
  for (const p of proposals) {
    if (distinct.some(x => x.q.reduce((s, q, i) => s + distance(q, p.q[i]), 0) / 4 < 12)) continue;
    distinct.push(p);
    if (distinct.length === 16) break;
  }
  const candidates: CubePhotoCandidate[] = [];
  for (const p of distinct) {
    const top = refineTop(image, edges, p.q), sides = fitSides(image, edges, top.q);
    if (!sides || top.score < 0.42 || sides.score < 0.32) continue;
    candidates.push({ corners: sides.corners, topSupport: top.score, sideSupport: sides.score });
  }
  candidates.sort((a, b) => (b.topSupport * 0.6 + b.sideSupport * 0.4) - (a.topSupport * 0.6 + a.sideSupport * 0.4));
  return { candidates: candidates.slice(0, 4), lineCount: lines.length, reason: candidates.length ? 'ok' : 'no-grid' };
}
