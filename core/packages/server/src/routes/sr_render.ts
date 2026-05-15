/**
 * Server-side iso/top render for sq1 / megaminx / pyraminx / skewb via sr-puzzlegen.
 *
 * Mirrors client-side `PuzzleSVG` + `VisualCubeEditorPage` rendering path:
 * sr-puzzlegen.SVG() mounts an <svg> into a host element using
 * `document.createElementNS`. linkedom provides a Node DOM, same one already
 * used by cubing_render.ts for net rendering.
 *
 * Variants this covers:
 *   sq1  iso, megaminx iso, megaminx top, pyraminx iso, skewb iso
 * skewb-top uses @cuberoot/shared/skewb-pyramid-svg (pure string, no DOM).
 */
import { parseHTML } from 'linkedom';
import { SVG as srSVG } from 'sr-puzzlegen';
import { renderSkewbPyramidSvgParametric } from '@cuberoot/shared/skewb-pyramid-svg';

let domReady: Promise<void> | null = null;
function ensureDom(): Promise<void> {
  if (domReady) return domReady;
  domReady = (async () => {
    const { document, window } = parseHTML('<!DOCTYPE html><html><body></body></html>');
    (globalThis as unknown as { document: typeof document }).document = document;
    (globalThis as unknown as { window: typeof window }).window = window;
  })();
  return domReady;
}

type Puzzle = 'sq1' | 'megaminx' | 'pyraminx' | 'skewb';
type Variant = 'iso' | 'top';

function srTypeOf(puzzle: Puzzle, variant: Variant): string | null {
  if (puzzle === 'sq1') return 'square1';
  if (puzzle === 'megaminx') return variant === 'top' ? 'megaminx-top' : 'megaminx';
  if (puzzle === 'pyraminx') return 'pyraminx';
  if (puzzle === 'skewb') return variant === 'top' ? null : 'skewb';
  return null;
}

/** Reverse a skewb alg token-by-token (R → R', R' → R, R2 → R2). */
function invertSkewbAlg(alg: string): string {
  return alg.trim().split(/\s+/).filter(Boolean).reverse().map((t) => {
    if (t.endsWith("'")) return t.slice(0, -1);
    if (t.endsWith('2')) return t;
    return t + "'";
  }).join(' ');
}

// Match client canonicalSq1Alg (sq1_svg.ts) — sr-puzzlegen's sq1 parser needs
// `(t, b)` with comma+space and `/` as its own token.
const SQ1_TOKEN_RE = /(\/)|\(?\s*(-?\d+)\s*(?:,\s*|\s+|(?=-?\d))(-?\d+)\s*\)?/g;
function canonicalSq1Alg(alg: string): string {
  const tokens: string[] = [];
  const re = new RegExp(SQ1_TOKEN_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(alg)) !== null) {
    if (m[1] === '/') tokens.push('/');
    else tokens.push(`(${m[2]}, ${m[3]})`);
  }
  return tokens.join(' ');
}

/** Parse `r=y30x-30` style into sr-puzzlegen rotations. Drops z. */
function parseRotations(
  r: string | undefined,
  puzzle: Puzzle,
): { x?: number; y?: number; z?: number }[] | undefined {
  if (!r) return undefined;
  const matches = [...r.matchAll(/([xy])(-?\d{1,3})/g)];
  if (matches.length === 0) return undefined;
  // sq1 / pyraminx use Z-up internally — promote y→z (matches client editor).
  const promote = (axis: string): string =>
    (puzzle === 'sq1' || puzzle === 'pyraminx') && axis === 'y' ? 'z' : axis;
  return matches.slice(0, 2).map((m) => ({
    [promote(m[1])]: parseInt(m[2], 10),
  })) as { x?: number; y?: number; z?: number }[];
}

export async function renderSrPuzzlegenSVG(
  puzzle: Puzzle,
  variant: Variant,
  alg: string,
  isCase: boolean,
  rotationsParam: string | undefined,
  size: number,
): Promise<string | null> {
  // skewb-top: local 2D fan renderer (pure string, no DOM).
  if (puzzle === 'skewb' && variant === 'top') {
    const trimmed = (alg ?? '').trim();
    const scramble = isCase ? invertSkewbAlg(trimmed) : trimmed;
    const rotations = parseRotations(rotationsParam, puzzle);
    try {
      const svg = renderSkewbPyramidSvgParametric(scramble, rotations);
      // Renderer returns inline svg with implicit size; force width/height.
      return svg.replace(
        /<svg\b([^>]*)>/,
        (_m: string, attrs: string) => `<svg${attrs} width="${size}" height="${size}">`,
      );
    } catch (err) {
      console.warn('[sr_render] skewb-top failed', err);
      return null;
    }
  }

  const type = srTypeOf(puzzle, variant);
  if (!type) return null;
  await ensureDom();

  const doc = (globalThis as unknown as { document: Document }).document;
  const host = doc.createElement('div');

  const trimmed = (alg ?? '').trim();
  const norm = puzzle === 'sq1' && trimmed ? canonicalSq1Alg(trimmed) : trimmed;
  const puzzleOpts: { alg?: string; case?: string; rotations?: { x?: number; y?: number; z?: number }[] } = {};
  if (norm) {
    if (isCase) puzzleOpts.case = norm;
    else puzzleOpts.alg = norm;
  }
  const rotations = parseRotations(rotationsParam, puzzle);
  if (rotations) puzzleOpts.rotations = rotations;

  try {
    srSVG(host as unknown as HTMLElement, type as never, {
      width: size,
      height: size,
      puzzle: puzzleOpts,
    });
  } catch (err) {
    console.warn('[sr_render] failed', puzzle, variant, err);
    return null;
  }
  const svg = host.querySelector('svg');
  if (!svg) return null;
  if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return svg.outerHTML;
}
