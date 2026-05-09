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
    // Ensure xmlns is present so the standalone SVG parses outside the document
    if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    return new XMLSerializer().serializeToString(svg);
  } finally {
    try { wrap.remove(); } catch { /* swallow */ }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function waitForSvg(player: any, timeoutMs: number): Promise<SVGSVGElement | null> {
  const deadline = Date.now() + timeoutMs;
  // First, wait for shadowRoot to have an svg
  while (Date.now() < deadline) {
    const root: ShadowRoot | null = player.shadowRoot ?? null;
    const svg = root?.querySelector?.('svg') ?? null;
    if (svg) {
      // Give cubing.js one more frame to apply setupAlg state
      await raf();
      await raf();
      return svg as SVGSVGElement;
    }
    await raf();
  }
  return null;
}

function raf(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
