import {
  availableLetteringGlyphs, buildLetteringSegments, buildPatternSegments,
  getLetteringPattern, LETTERING_GLYPHS, LETTERING_ORDERS,
  type LetteringGlyph, type LetteringOrder,
} from './lettering-alg';

export type CharacterPlan = {
  character: string;
  order: LetteringOrder;
  pattern: readonly string[];
  segments: string[];
  source: 'designed' | 'font';
};

export type CharacterError =
  | { code: 'input' | 'font' | 'detail' }
  | { code: 'order'; minimum: LetteringOrder };

/** Count visible characters, keeping supplementary Han and presentation selectors intact. */
export function fitsCharacterInput(value: string): boolean {
  const segments = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value);
  let count = 0;
  for (const _ of segments) if (++count > 1) return false;
  return true;
}

// Text/emoji presentation selectors do not change the monochrome target shape.
function normalizeCharacter(input: string): string {
  return input.trim().replace(/[\uFE0E\uFE0F]$/u, '');
}

export function validateCharacter(input: string, order: LetteringOrder): CharacterError | null {
  const character = normalizeCharacter(input);
  if (!/^(?:[A-Za-z]|\p{Unified_Ideograph}|\p{Symbol})$/u.test(character)) return { code: 'input' };
  if (Object.hasOwn(LETTERING_GLYPHS, character)) {
    const minimum = LETTERING_ORDERS.find(value => availableLetteringGlyphs(value).includes(character as LetteringGlyph))!;
    if (order < minimum) return { code: 'order', minimum };
  }
  return null;
}

/** Local browser font → tightly bounded, aspect-preserving glyph → area-sampled binary grid. */
function rasterizeCharacter(character: string, size: number, threshold = 0.45): string[] | null {
  const canvas = document.createElement('canvas');
  const sample = 8;
  canvas.width = canvas.height = size * sample;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.font = '400 100px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';
  const bounds = ctx.measureText(character);
  const width = bounds.actualBoundingBoxLeft + bounds.actualBoundingBoxRight;
  const height = bounds.actualBoundingBoxAscent + bounds.actualBoundingBoxDescent;
  if (!(width > 0 && height > 0)) return null;
  const scale = (canvas.width - 2) / Math.max(width, height);
  ctx.translate((canvas.width - width * scale) / 2, (canvas.height - height * scale) / 2);
  ctx.scale(scale, scale);
  // Only alpha is sampled; canvas ink is independent of the site's theme.
  ctx.fillText(character, bounds.actualBoundingBoxLeft, bounds.actualBoundingBoxAscent);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const pattern = Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, column) => {
    let coverage = 0;
    for (let y = 0; y < sample; y++) for (let x = 0; x < sample; x++) {
      coverage += pixels[((row * sample + y) * canvas.width + column * sample + x) * 4 + 3];
    }
    return coverage / (sample * sample * 255) >= threshold ? '1' : '0';
  }).join(''));
  return pattern.some(row => row.includes('1')) ? pattern : null;
}

/** Separate strokes need an empty cell between them. Counts both horizontal and vertical cuts. */
export function requiredPatternSize(pattern: readonly string[]): number {
  const lines = [...pattern, ...pattern.map((_, x) => pattern.map(row => row[x]).join(''))];
  return Math.max(5, ...lines.map(line => (line.match(/1+/g)?.length ?? 0) * 2 - 1));
}

function topology(pattern: readonly string[]): string {
  const n = pattern.length;
  const seen = new Set<number>();
  let strokes = 0;
  let holes = 0;
  for (let start = 0; start < n * n; start++) {
    if (seen.has(start)) continue;
    const ink = pattern[Math.floor(start / n)][start % n];
    const queue = [start];
    seen.add(start);
    let border = false;
    for (let head = 0; head < queue.length; head++) {
      const y = Math.floor(queue[head] / n), x = queue[head] % n;
      if (!x || !y || x === n - 1 || y === n - 1) border = true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || (ink === '0' && dx && dy)) continue;
        const ny = y + dy, nx = x + dx, next = ny * n + nx;
        if (ny < 0 || nx < 0 || ny >= n || nx >= n || seen.has(next) || pattern[ny][nx] !== ink) continue;
        seen.add(next); queue.push(next);
      }
    }
    if (ink === '1') strokes++;
    else if (!border) holes++;
  }
  return `${strokes}:${holes}`;
}

/** Structural heuristic, not OCR: preserve components, enclosed spaces and stroke locations. */
export function preservesCharacter(reference: readonly string[], candidate: readonly string[]): boolean {
  if (candidate.length < requiredPatternSize(reference) || topology(reference) !== topology(candidate)) return false;
  const points = (pattern: readonly string[]) => pattern.flatMap((row, y) => [...row].flatMap((pixel, x) =>
    pixel === '1' ? [[(x + 0.5) / pattern.length, (y + 0.5) / pattern.length]] : []));
  const a = points(reference), b = points(candidate);
  if (!a.length || !b.length) return false;
  const distance = (from: number[][], to: number[][]) => from.reduce((sum, p) => sum + Math.min(...to.map(q =>
    Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1])))), 0) / from.length;
  return Math.max(distance(a, b), distance(b, a)) <= 0.55 / candidate.length;
}

export function createCharacterPlan(input: string, order: LetteringOrder): CharacterPlan | CharacterError {
  const error = validateCharacter(input, order);
  if (error) return error;
  const character = normalizeCharacter(input);
  if (Object.hasOwn(LETTERING_GLYPHS, character)) {
    const glyph = character as LetteringGlyph;
    return { character, order, pattern: getLetteringPattern(glyph, order),
      segments: buildLetteringSegments(glyph, order), source: 'designed' };
  }
  const reference = rasterizeCharacter(character, 63);
  const missing = rasterizeCharacter('\u{10FFFF}', 63);
  if (!reference || reference.join('') === missing?.join('')) return { code: 'font' };
  const candidates = new Map<LetteringOrder, string[]>();
  for (const candidateOrder of LETTERING_ORDERS) {
    if (candidateOrder < 7 || candidateOrder - 2 < requiredPatternSize(reference)) continue;
    for (const threshold of [0.45, 0.35, 0.25, 0.55]) {
      const pattern = rasterizeCharacter(character, candidateOrder - 2, threshold);
      if (pattern && preservesCharacter(reference, pattern)) { candidates.set(candidateOrder, pattern); break; }
    }
  }
  const minimum = candidates.keys().next().value;
  if (!minimum) return { code: 'detail' };
  const pattern = candidates.get(order);
  if (!pattern) {
    // Sampling is not monotonic: a larger grid can occasionally align worse with a stroke.
    const next = [...candidates.keys()].find(candidateOrder => candidateOrder > order);
    return next ? { code: 'order', minimum: next } : { code: 'detail' };
  }
  return { character, order, pattern, segments: buildPatternSegments(pattern, order), source: 'font' };
}
