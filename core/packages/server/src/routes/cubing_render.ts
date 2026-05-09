/**
 * Server-side 2D unfolded-net renderer using cubing.js.
 *
 * Why this exists: scramble-display (cubing.org) is a web component, so it
 * requires a DOM. linkedom gives us a fast, dependency-free DOM in Node so
 * that cubing.js's puzzle SVG templates + KPuzzle pattern application can run
 * on the server. Output is a plain SVG string suitable for image/svg+xml.
 *
 * Reuses the same renderer as /battle and /timer (client-side scramble-display)
 * for visual parity.
 */
import { parseHTML } from 'linkedom';
import { puzzles } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';

// One DOM per process, lazily initialised. Each request parses its own SVG
// document inside this DOM, so concurrent requests don't share elements.
let domReady: Promise<void> | null = null;

function ensureDom(): Promise<void> {
  if (domReady) return domReady;
  domReady = (async () => {
    const { document, window } = parseHTML('<!DOCTYPE html><html><body></body></html>');
    // cubing.js queries globalThis.document / window for SVG namespace + element creation.
    (globalThis as unknown as { document: typeof document }).document = document;
    (globalThis as unknown as { window: typeof window }).window = window;
  })();
  return domReady;
}

/** Map our event/puzzle id → cubing.js puzzleLoader key. */
function puzzleLoaderKey(event: string): string | null {
  switch (event) {
    case '222': return '2x2x2';
    case '333': return '3x3x3';
    case '444': return '4x4x4';
    case '555': return '5x5x5';
    case '666': return '6x6x6';
    case '777': return '7x7x7';
    case 'minx': case 'megaminx': return 'megaminx';
    case 'pyram': case 'pyraminx': return 'pyraminx';
    case 'skewb': return 'skewb';
    case 'sq1': case 'square1': return 'square1';
    default: return null;
  }
}

const SVG_XMLNS = 'http://www.w3.org/2000/svg';

/**
 * Render a 2D unfolded-net SVG for the given puzzle + scramble.
 *
 * @param event   puzzle id ('333' / 'minx' / 'sq1' / ...)
 * @param scramble alg in the puzzle's notation; '' = solved
 * @param invert  if true, applies the alg's inverse (matches the `case=` URL semantic)
 * @returns SVG string (no enclosing <html>), or null if the event isn't supported
 */
export async function renderPuzzleNetSVG(
  event: string,
  scramble: string,
  invert = false,
): Promise<string | null> {
  const key = puzzleLoaderKey(event);
  if (!key) return null;
  const loader = puzzles[key];
  if (!loader) return null;

  await ensureDom();

  // Apply alg to defaultPattern. Empty string → solved. `invert=true` matches
  // /v1/visualcube.svg's `case=` semantics (the state the alg solves).
  const kpuzzle = await loader.kpuzzle();
  let pattern = kpuzzle.defaultPattern();
  const trimmed = (scramble ?? '').trim();
  if (trimmed) {
    try {
      const alg = new Alg(trimmed);
      pattern = pattern.applyAlg(invert ? alg.invert() : alg);
    } catch {
      // Bad notation → fall through with solved pattern.
    }
  }

  // Load svg template (string), parse with linkedom, walk the orbits, swap fills.
  const svgTemplate = await loader.svg();
  const { document } = parseHTML(`<!DOCTYPE html><html><body>${svgTemplate}</body></html>`);
  const svgElem = document.querySelector('svg');
  if (!svgElem) return null;

  // Collect each sticker's solved fill BEFORE we mutate, so position-based lookup works.
  const solvedFill: Record<string, string> = {};
  for (const orbitDef of kpuzzle.definition.orbits) {
    for (let idx = 0; idx < orbitDef.numPieces; idx++) {
      for (let ori = 0; ori < orbitDef.numOrientations; ori++) {
        const id = `${orbitDef.orbitName}-l${idx}-o${ori}`;
        const el = svgElem.querySelector(`#${id}`);
        if (!el) continue;
        // svg template uses inline style="fill: #...". Read the raw attribute.
        const style = el.getAttribute('style') ?? '';
        const m = style.match(/fill:\s*([^;]+)/i);
        solvedFill[id] = m ? m[1].trim() : '#888';
      }
    }
  }

  // For each (orbit, idx, ori) in the SVG, look up where this slot's piece IS in the
  // current pattern, then paint with that origin's solved color.
  for (const orbitDef of kpuzzle.definition.orbits) {
    const orbitData = pattern.patternData[orbitDef.orbitName];
    if (!orbitData) continue;
    for (let idx = 0; idx < orbitDef.numPieces; idx++) {
      const fromIdx = orbitData.pieces[idx];
      const fromOriShift = orbitData.orientation[idx];
      for (let ori = 0; ori < orbitDef.numOrientations; ori++) {
        const id = `${orbitDef.orbitName}-l${idx}-o${ori}`;
        const el = svgElem.querySelector(`#${id}`);
        if (!el) continue;
        const sourceOri = (orbitDef.numOrientations - fromOriShift + ori) % orbitDef.numOrientations;
        const sourceId = `${orbitDef.orbitName}-l${fromIdx}-o${sourceOri}`;
        const fill = solvedFill[sourceId] ?? solvedFill[id] ?? '#888';
        el.setAttribute('style', `fill: ${fill}`);
      }
    }
  }

  // Make sure the namespace round-trips.
  if (!svgElem.getAttribute('xmlns')) svgElem.setAttribute('xmlns', SVG_XMLNS);
  return svgElem.outerHTML;
}
