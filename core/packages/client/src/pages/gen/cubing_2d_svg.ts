/**
 * Extract a static unfolded-net SVG string for a single scramble using
 * cubing.js TwistyPlayer in `visualization: '2D'` mode.
 *
 * cubing.js renders the 2D net inside a custom element's shadow DOM. We mount
 * the player off-screen, wait for the shadow SVG to settle, then serialize.
 * Used by the PDF generator to embed scramble preview images.
 *
 * Re-uses the same EVENT_TO_PUZZLE map as `<ScramblePreview2D>`.
 */

const EVENT_TO_PUZZLE: Record<string, string> = {
  '222': '2x2x2',
  '333': '3x3x3', '333oh': '3x3x3', '333bf': '3x3x3', '333fm': '3x3x3', '333mbf': '3x3x3',
  '444': '4x4x4', '444bf': '4x4x4',
  '555': '5x5x5', '555bf': '5x5x5',
  '666': '6x6x6',
  '777': '7x7x7',
  'pyram': 'pyraminx',
  'skewb': 'skewb',
  'sq1': 'square1',
  'minx': 'megaminx',
  'clock': 'clock',
};

function normalizeAlg(puzzle: string, alg: string): string {
  if (puzzle !== 'square1') return alg;
  return alg.replace(/(-?\d+,-?\d+)/g, '($1)');
}

let hiddenHost: HTMLDivElement | null = null;
function getHiddenHost(): HTMLDivElement {
  if (hiddenHost && hiddenHost.isConnected) return hiddenHost;
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:600px;height:450px;visibility:hidden;pointer-events:none;';
  document.body.appendChild(div);
  hiddenHost = div;
  return div;
}

/**
 * Build a single TwistyPlayer 2D for `(event, scramble)` and return its inner
 * SVG outerHTML once stable. Returns null if the puzzle isn't supported by
 * cubing.js's 2D visualization.
 */
export async function getScramble2DSvg(event: string, scramble: string, timeoutMs = 4000): Promise<string | null> {
  const puzzle = EVENT_TO_PUZZLE[event];
  if (!puzzle) return null;

  const mod = await import('cubing/twisty');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctor = (mod as any).TwistyPlayer || (mod as any).default;
  const host = getHiddenHost();
  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:600px;height:450px;';
  host.appendChild(wrap);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let player: any = null;
  try {
    player = new Ctor({
      puzzle,
      visualization: '2D',
      experimentalSetupAlg: normalizeAlg(puzzle, scramble),
      alg: '',
      controlPanel: 'none',
      background: 'none',
      hintFacelets: 'none',
      viewerLink: 'none',
    });
    player.style.width = '600px';
    player.style.height = '450px';
    wrap.appendChild(player);

    const svg = await waitForSvg(player, timeoutMs);
    if (!svg) return null;
    // svg2pdf.js can't see styles applied via shadow-root adoptedStyleSheets,
    // and cubing.js wires its 2D paints through them. Solution: clone the SVG,
    // inline fill/stroke/opacity from getComputedStyle onto every element, AND
    // pull adoptedStyleSheets cssText into a <style> child as belt-and-braces.
    const cloned = svg.cloneNode(true) as SVGSVGElement;
    inlinePaintStyles(svg, cloned);
    embedAdoptedStyleSheets(svg, cloned);
    if (!cloned.getAttribute('xmlns')) cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    return new XMLSerializer().serializeToString(cloned);
  } finally {
    try { wrap.remove(); } catch { /* swallow */ }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function waitForSvg(player: any, timeoutMs: number): Promise<SVGSVGElement | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const svg = findSvgDeep(player);
    if (svg) {
      // Give cubing.js one more frame to apply setupAlg state
      await raf();
      await raf();
      return svg;
    }
    await raf();
  }
  return null;
}

/** TwistyPlayer's SVG lives inside nested shadow roots
 *  (player → scene-wrapper → 2D-puzzle → svg). Walk all shadow roots. */
function findSvgDeep(node: Node | null): SVGSVGElement | null {
  if (!node) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root: ShadowRoot | null = (node as any).shadowRoot ?? null;
  if (root) {
    const direct = root.querySelector('svg');
    if (direct) return direct as SVGSVGElement;
    // recurse into every element in the shadow root
    for (const el of Array.from(root.querySelectorAll('*'))) {
      const found = findSvgDeep(el);
      if (found) return found;
    }
  }
  // also check light DOM children (TwistyPlayer rarely needs this but cheap)
  if (node instanceof Element) {
    for (const el of Array.from(node.children)) {
      const found = findSvgDeep(el);
      if (found) return found;
    }
  }
  return null;
}

/** Walk live + clone in lockstep, inline paint props from getComputedStyle. */
function inlinePaintStyles(live: Element, clone: Element): void {
  const liveKids = live.children;
  const cloneKids = clone.children;
  if (liveKids.length !== cloneKids.length) return;
  copyPaintStyle(live, clone);
  for (let i = 0; i < liveKids.length; i++) {
    inlinePaintStyles(liveKids[i], cloneKids[i]);
  }
}

const SVG_PAINT_PROPS = [
  'fill', 'fill-opacity',
  'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linejoin', 'stroke-linecap',
  'opacity',
];

function copyPaintStyle(live: Element, clone: Element): void {
  const cs = window.getComputedStyle(live);
  const parts: string[] = [];
  for (const prop of SVG_PAINT_PROPS) {
    const v = cs.getPropertyValue(prop);
    if (!v) continue;
    if (clone.hasAttribute(prop)) continue;  // attribute already wins
    parts.push(`${prop}:${v}`);
  }
  if (parts.length) {
    const existing = clone.getAttribute('style') ?? '';
    const sep = existing && !existing.endsWith(';') ? ';' : '';
    clone.setAttribute('style', existing + sep + parts.join(';'));
  }
}

/** Find every shadow root from the live SVG up to the document; concatenate
 *  their adoptedStyleSheets' cssText into a `<style>` prepended to the clone. */
function embedAdoptedStyleSheets(live: SVGSVGElement, clone: SVGSVGElement): void {
  const sheetsCss: string[] = [];
  let node: Node | null = live;
  while (node) {
    const root = node.getRootNode?.() as ShadowRoot | Document | null;
    if (root && 'adoptedStyleSheets' in root) {
      const sheets = (root as ShadowRoot).adoptedStyleSheets ?? [];
      for (const sheet of sheets) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            sheetsCss.push(rule.cssText);
          }
        } catch { /* cross-origin or detached */ }
      }
    }
    node = (root as ShadowRoot)?.host ?? null;
  }
  if (sheetsCss.length === 0) return;
  const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleEl.textContent = sheetsCss.join('\n');
  clone.insertBefore(styleEl, clone.firstChild);
}

function raf(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
