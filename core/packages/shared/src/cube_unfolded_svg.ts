/**
 * Render an NxN cube state as an unfolded WCA-net SVG (white-top / green-front).
 *
 * Pure string output, no DOM, no async, no shadow root, no styles. Every fill
 * is inlined as an attribute so svg2pdf.js renders perfectly.
 *
 * Layout (in cell units, viewBox 0 0 4N+5*GAP 3N+4*GAP):
 *
 *           [U]
 *      [L] [F] [R] [B]
 *           [D]
 *
 * State simulator is the shared `nnn_sim.ts` (cstimer port). Per-face flip
 * convention matches cstimer's `nnnImage.face` — L/B mirror horizontally, D
 * mirrors vertically — so the unfolded view shows each face as if viewed
 * from outside in standard orientation (U/D with F at the bottom-edge/top-edge,
 * L/F/R/B with U at top).
 *
 * Was previously on visualcube `CubeData` (face arrays + .map() per turn). At
 * N=300 that allocates a 90000-element Array per face-rotation × ~6000 moves
 * → seconds of GC pressure. The cstimer sim is in-place Uint8Array, faster +
 * unified with mirror-blocks renderer.
 */
import { simulateNxN, simulateNxNIds, FACE_D, FACE_L, FACE_B, FACE_U, FACE_R, FACE_F } from './nnn_sim';

// Mask option shape. Structurally identical to the client's `lib/puzzle-image/
// mask-core` types (StickerId is just a string), so client callers keep passing
// their own `MaskRenderOptions` unchanged — declared here so this shared module
// carries no `@/…` client dependency. mask-core stays the client's authoring source.
export type StickerId = string;
export interface RenderMask { ids: Set<StickerId>; color: string; }
export interface MaskRenderOptions { mask?: RenderMask; stickerIds?: boolean; }

// WCA colors keyed by cstimer face id (D L B U R F = 0..5). Matches tnoodle
// CubePuzzle.java defaultColorScheme.
const WCA_COLORS: string[] = [
  '#FFFF00', // D yellow
  '#FF8000', // L orange (heraldic tincture)
  '#0000FF', // B blue
  '#FFFFFF', // U white
  '#FF0000', // R red
  '#00FF00', // F green
];

// Tnoodle CubePuzzle: cubieSize=10, gap=2 → gap-as-fraction-of-cubie = 0.2.
// Stickers stroke is svglite default (1px on cubieSize=10) → 0.1 of a cubie.
// Exported: the /sim interactive net (_SimCubeNet) shares the layout constants so
// the paint editor, the engine companion export and this reference stay aligned.
const STROKE_COLOR = '#000000';
export const GAP = 0.2;           // gap between faces, in cell units (matches tnoodle 2/10)
export const STROKE_W = 0.1;      // sticker outline, relative to 1×1 cell (matches tnoodle 1/10)

const PUZZLE_TO_N: Record<string, number> = {
  '2x2x2': 2, '3x3x3': 3, '4x4x4': 4, '5x5x5': 5, '6x6x6': 6, '7x7x7': 7,
};

export function isUnfoldablePuzzle(puzzleId: string): boolean {
  return puzzleId in PUZZLE_TO_N;
}

const EVENT_TO_PUZZLE: Record<string, string> = {
  '222': '2x2x2',
  '333': '3x3x3', '333oh': '3x3x3', '333bf': '3x3x3', '333fm': '3x3x3', '333ft': '3x3x3',
  '333mbf': '3x3x3', '333mbo': '3x3x3',
  '444': '4x4x4', '444bf': '4x4x4',
  '555': '5x5x5', '555bf': '5x5x5',
  '666': '6x6x6',
  '777': '7x7x7',
  // Crazy 3×3 (crz3a) is mechanically a standard 3×3 — reuse the 3×3 unfolded net.
  crz3a: '3x3x3',
};

/** Synthetic id for high-order NxN (N ≥ 8) without a WCA event: `nxn8`..`nxn300`. */
const NXN_HIGH_RE = /^nxn(\d+)$/;
export function eventToCubeSize(event: string): number | null {
  const p = EVENT_TO_PUZZLE[event];
  if (p) return PUZZLE_TO_N[p] ?? null;
  const m = NXN_HIGH_RE.exec(event);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 2 && n <= 300) return n;
  }
  return null;
}

/** Parse a WCA scramble string and return the SVG unfolded-net for the resulting cube state. */
export function renderUnfoldedSvgForEvent(event: string, scramble: string, opts?: MaskRenderOptions): string | null {
  const N = eventToCubeSize(event);
  if (!N) return null;
  return renderUnfoldedSvg(N, scramble, opts);
}

/** cstimer face id (D L B U R F = 0..5) → canonical face letter. */
export const CUBE_FACE_LETTERS = ['D', 'L', 'B', 'U', 'R', 'F'] as const;

/**
 * Canonical NxN sticker id — `${FACE}${row * N + col}` where row/col are read on
 * the face AS DRAWN in the unfolded net (row 0 on top, col 0 on the left). That
 * is the same space as the arrow DSL (`U0U2`) and `ICubeOptions.stickerColors`.
 */
export function cubeStickerId(N: number, face: number, row: number, col: number): StickerId {
  return `${CUBE_FACE_LETTERS[face]}${row * N + col}`;
}

/** Canonical sticker id for a solved-frame posit index (the value `simulateNxNIds` carries). */
export function cubeStickerIdFromPosit(N: number, positIndex: number): StickerId {
  const s2 = N * N;
  const f = Math.floor(positIndex / s2);
  const rem = positIndex % s2;
  const y = Math.floor(rem / N);
  const x = rem % N;
  const col = (f === FACE_L || f === FACE_B) ? N - 1 - x : x;
  const row = (f === FACE_D) ? N - 1 - y : y;
  return cubeStickerId(N, f, row, col);
}

/**
 * Shared SVG assembler. Both entry points — renderUnfoldedSvg (scramble-driven
 * reference) and renderUnfoldedStateSvg (/sim engine companion, state-driven) —
 * emit through here, so layout, stroke, attribute order and every byte of the
 * markup match by construction instead of by parallel porting.
 * `cell(f, i, j)` = fill (+ optional data-sid) for face f, drawn col i, drawn row j.
 */
function emitUnfolded(N: number, cell: (f: number, i: number, j: number) => { color: string; sid?: string }): string {
  // Tnoodle CubePuzzle layout — same width/height as before:
  //   total width  = (cubie+gap)*4 + gap = 4*N + 5*GAP
  //   total height = (cubie+gap)*3 + gap = 3*N + 4*GAP
  const w = 4 * N + 5 * GAP;
  const h = 3 * N + 4 * GAP;
  // Face origin (NW corner of N×N grid) keyed by cstimer face id 0..5.
  const FACE_OFFSETS: [number, number][] = [];
  FACE_OFFSETS[FACE_D] = [2 * GAP + N,       3 * GAP + 2 * N];
  FACE_OFFSETS[FACE_L] = [GAP,                2 * GAP + N];
  FACE_OFFSETS[FACE_B] = [4 * GAP + 3 * N,   2 * GAP + N];
  FACE_OFFSETS[FACE_U] = [2 * GAP + N,       GAP];
  FACE_OFFSETS[FACE_R] = [3 * GAP + 2 * N,   2 * GAP + N];
  FACE_OFFSETS[FACE_F] = [2 * GAP + N,       2 * GAP + N];

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">`);

  for (let f = 0; f < 6; f++) {
    const [ox, oy] = FACE_OFFSETS[f];
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const { color, sid } = cell(f, i, j);
        parts.push(
          `<rect x="${ox + i}" y="${oy + j}" width="1" height="1" fill="${color}"${sid ? ` data-sid="${sid}"` : ''} stroke="${STROKE_COLOR}" stroke-width="${STROKE_W}"/>`,
        );
      }
    }
  }
  parts.push('</svg>');
  return parts.join('');
}

export function renderUnfoldedSvg(N: number, scramble: string, opts?: MaskRenderOptions): string {
  // Fast path (no mask, no ids): keep the Uint8Array color model — at N=300 the
  // Int32 id model would be 4x the memory for no gain.
  const tracked = !!(opts?.mask || opts?.stickerIds);
  const posit = tracked ? simulateNxNIds(N, scramble) : simulateNxN(N, scramble);
  const s2 = N * N;

  return emitUnfolded(N, (f, i, j) => {
    // L/B faces mirror horizontally relative to internal posit (verbatim cstimer
    // convention); D face mirrors vertically.
    const x = (f === FACE_L || f === FACE_B) ? N - 1 - i : i;
    const y = (f === FACE_D) ? N - 1 - j : j;
    const v = posit[f * s2 + y * N + x];
    let color: string;
    if (tracked) {
      const masked = opts?.mask?.ids.has(cubeStickerIdFromPosit(N, v)) ?? false;
      color = masked ? opts!.mask!.color : WCA_COLORS[Math.floor(v / s2)];
    } else {
      color = WCA_COLORS[v];
    }
    return { color, sid: opts?.stickerIds ? cubeStickerId(N, f, j, i) : undefined };
  });
}

/**
 * State-driven unfolded net for the /sim engine companion: the caller supplies
 * the fill per drawn cell (face id f in cstimer order D L B U R F, row/col as
 * drawn in the net — row 0 top, col 0 left). Same assembler as the reference →
 * byte-identical chrome; only the fills differ by whatever state/palette the
 * engine provides.
 */
export function renderUnfoldedStateSvg(N: number, colorAt: (f: number, row: number, col: number) => string): string {
  return emitUnfolded(N, (f, i, j) => ({ color: colorAt(f, j, i) }));
}
