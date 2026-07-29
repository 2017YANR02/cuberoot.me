/**
 * Plan-view sticker simplification — the recognition-oriented "show only what you
 * actually read" layer, ported from MeiCubeTool's `view=plan simplify Config` panel.
 *
 * A plan image carries two rings of information: the U face (N² stickers) and the
 * side rim (4N stickers, drawn by `renderOLLStickers`). Most of those stickers are
 * noise for recognition — what a solver reads is a bar, a pair of headlights, an
 * opposite-colour pair. This module decides, per sticker, whether it is drawn at all.
 *
 * Pipeline (order is load-bearing — it is the original's, and later passes override
 * earlier ones):
 *
 *   1. class rule   auto-classify each of the 4 rim strips / 8 U corner-edge pairs
 *   2. forceShow    explicit index list turns stickers back ON
 *   3. forceHide    explicit index list turns stickers OFF
 *   4. hideGrey     every masked ("don't care") rim sticker goes OFF   ← the `ngs` knob
 *   5. showYellow   every last-layer-coloured sticker comes back ON
 *
 * Index spaces exposed to callers (both 1-based, both puzzle-facing rather than
 * renderer-facing so a URL written against them survives any renderer refactor):
 *
 *   side ring  1..4N   clockwise from the image's top-left corner:
 *                      1..N top strip L→R, then right T→B, bottom R→L, left B→T.
 *   up         1..N²   U-face row-major as it appears in the image, 1 = top-left.
 *
 * Both were verified against this renderer's own geometry by rendering a uniquely
 * coloured cube and sorting the emitted polygons by centroid — see
 * tests/plan-simplify.test.ts, which re-derives the mapping and fails if the
 * projection ever changes.
 *
 * SCOPE: the class rules read a 3-sticker window (corner, edge, corner) and are
 * therefore 3x3-only, exactly as in the original. On any other N the class layer is
 * skipped (everything visible) while steps 2-5 still apply.
 */
import { Face, AllFaces } from './constants.js'
import { ColorCode } from './../colors.js'
import { ColorNameToCode, ColorAbbreviationToCode } from './../constants.js'

export type PlanSideRule = 'all' | 'bar' | 'oppline' | 'cece' | 'light' | 'oppbar' | 'ecec'
export type PlanUpRule = 'all' | 'bar' | 'baroppbar'

export interface PlanSimplifyOptions {
  /** Side-rim class threshold. 'all' (default) = no auto rule. */
  side?: PlanSideRule
  /** U-face class threshold. 'all' (default) = no auto rule. */
  up?: PlanUpRule
  /** Force-show every sticker painted the last-layer (U) colour. Default true — it is
   *  what makes the auto rules safe: the case's own information can never vanish. */
  showYellow?: boolean
  /** `side=<csv>&up=<csv>` — 1-based indices forced back ON, after the class rule. */
  forceShow?: string
  /** `side=<csv>&up=<csv>` — 1-based indices forced OFF, after `forceShow`. */
  forceHide?: string
  /** Drop the masked ("don't care") rim stickers. The `ngs` query knob. */
  hideGrey?: boolean
}

export interface PlanVisibility {
  /** Indexed 0..4N-1 by ring position - 1. */
  side: boolean[]
  /** Indexed 0..N²-1 by U-face row-major position. */
  up: boolean[]
}

/** Is any part of this option set actually asking for something? */
export function planSimplifyActive(o: PlanSimplifyOptions | undefined): boolean {
  if (!o) return false
  return (
    (o.side !== undefined && o.side !== 'all') ||
    (o.up !== undefined && o.up !== 'all') ||
    !!o.forceShow || !!o.forceHide || !!o.hideGrey
  )
}

// ── colour identity ────────────────────────────────────────────────────────────
//
// The rules are written over colour IDs 1..6 laid out so that opposite faces are the
// adjacent pairs (1,2) (3,4) (5,6) — the original used W/Y, O/R, G/B for exactly this.
// Anything the scheme does not name (the mask grey, a hand-set stickerColor) is 7,
// which never equals anything and is never "opposite" to anything.
const ID_FACE_ORDER = [Face.U, Face.D, Face.R, Face.L, Face.F, Face.B]
const UNKNOWN_ID = 7
/** The last layer's colour — the U face's. `showYellow` protects this one. */
const TOP_ID = 1

/**
 * Fold a colour to one comparable form: names/abbreviations to their hex code,
 * `#abc` to `#aabbcc`, lower case. The same grey reaches the renderer as `'darkGray'`,
 * `'d'` or `'#404040'` depending on the caller, and all three must compare equal.
 */
function norm(raw: string): string {
  const v = String(raw).trim()
  const named = ColorNameToCode[v] || ColorAbbreviationToCode[v] || v
  const hex = named.toLowerCase()
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(hex)
  return short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : hex
}

function makeColorIds(colorScheme: { [face: number]: string }): (color: string) => number {
  const table = new Map<string, number>()
  ID_FACE_ORDER.forEach((face, i) => {
    const c = colorScheme[face]
    // First writer wins: a scheme with duplicate colours (the `view=oll` preset paints
    // five faces the same grey) must not have its later faces shadow the earlier ones.
    if (c && !table.has(norm(c))) table.set(norm(c), i + 1)
  })
  return (color: string) => table.get(norm(color)) ?? UNKNOWN_ID
}

/** Opposite faces, in ID space: (1,2) (3,4) (5,6). Unknown is opposite to nothing. */
function opp(a: number, b: number): boolean {
  if (a === UNKNOWN_ID || b === UNKNOWN_ID) return false
  return Math.abs(a - b) === 1 && Math.min(a, b) % 2 === 1
}

// ── index spaces ───────────────────────────────────────────────────────────────

/**
 * Ring position (1-based) → index into the flat 6N² sticker array.
 *
 * The rim is the row of each side face that touches U. Measured from this renderer's
 * plan projection: the top strip of the image is the B face read right-to-left, then
 * R, then F, then L, each also right-to-left in its own frame.
 */
export function ringStickerIndex(ring: number, cubeSize: number): number {
  const N = cubeSize
  const k = ring - 1
  const strip = Math.floor(k / N) // 0 top, 1 right, 2 bottom, 3 left
  const face = [Face.B, Face.R, Face.F, Face.L][strip]
  const col = N - 1 - (k % N)
  return AllFaces.indexOf(face) * N * N + col
}

/** U-face position (1-based, row-major from the image's top-left) → flat index. */
export function upStickerIndex(up: number, _cubeSize: number): number {
  return up - 1 // U is face 0 and its row-major order IS the image order (probe-verified)
}

/** Parse `side=1,2&up=3` into two 1-based index lists. Junk tokens are dropped. */
export function parseIndexList(raw: string | undefined): { side: number[]; up: number[] } {
  const out = { side: [] as number[], up: [] as number[] }
  if (!raw) return out
  for (const chunk of raw.split('&')) {
    const eq = chunk.indexOf('=')
    if (eq < 0) continue
    const key = chunk.slice(0, eq).trim()
    if (key !== 'side' && key !== 'up') continue
    for (const tok of chunk.slice(eq + 1).split(',')) {
      const n = parseInt(tok.trim(), 10)
      if (Number.isFinite(n) && n >= 1) out[key].push(n)
    }
  }
  return out
}

// ── the class rules ────────────────────────────────────────────────────────────
//
// One rim strip is classified from a 6-wide window over the ring: p = the last sticker
// of the previous strip (shares a corner cubie with A), then A B C = this strip's
// corner / edge / corner, then D E = the next strip's first two. Lower code = stronger,
// more specific pattern. The UI's radio buttons pick a THRESHOLD: every strip whose
// code is strictly below it is drawn, the rest is erased.

const SIDE_THRESHOLD: Record<PlanSideRule, number> = {
  all: 0, bar: 14, oppline: 23, cece: 33, light: 43, oppbar: 53, ecec: 63,
}
const UP_THRESHOLD: Record<PlanUpRule, number> = { all: 0, bar: 12, baroppbar: 22 }

const NO_MATCH_SIDE = 71
const NO_MATCH_UP = 31

function sideType(p: number, a: number, b: number, c: number, d: number, e: number): number {
  if (a === b && b === c && a !== TOP_ID) return 11 // 3-bar
  if (a === b && b !== c && a !== TOP_ID) return 12 // 2-bar, left
  if (a !== b && b === c && b !== TOP_ID) return 13 // 2-bar, right
  if (a === c && opp(a, b) && a !== TOP_ID) return 21 // X · oppX · X
  if (p === b && a === c && a !== TOP_ID && b !== TOP_ID) return 31 // alternating, backwards
  if (a === c && b === d && a !== TOP_ID && b !== TOP_ID) return 32 // alternating, forwards
  if (a === c && a !== TOP_ID) return 41 // headlights
  if (opp(a, b) && a !== TOP_ID && b !== TOP_ID) return 51 // opposite pair, left
  if (opp(b, c) && b !== TOP_ID && c !== TOP_ID) return 52 // opposite pair, right
  if (b === d && c === e && b !== TOP_ID && c !== TOP_ID) return 61
  return NO_MATCH_SIDE
}

/** Which window slots [p,A,B,C,D,E] a class keeps. '*' = leave whatever is there. */
const SIDE_KEEP: Record<number, string> = {
  11: '*111**', 12: '*110**', 13: '*011**', 21: '*111**', 31: '1111**',
  32: '*1111*', 41: '*101**', 51: '*110**', 52: '*011**', 61: '**1111',
  [NO_MATCH_SIDE]: '000000',
}

function upType(a: number, b: number): number {
  if (a === b && a !== TOP_ID) return 11
  if (opp(a, b) && a !== TOP_ID && b !== TOP_ID) return 21
  return NO_MATCH_UP
}

/** The 8 corner+edge U pairs, 1-based (the centre is never part of a pair). */
const UP_PAIRS: [number, number][] = [[1, 2], [1, 4], [3, 2], [3, 6], [7, 4], [7, 8], [9, 6], [9, 8]]

/**
 * Resolve which plan-view stickers to draw.
 *
 * `stickerColors` is the FINAL 6N² colour array (mask applied, algorithm applied) —
 * i.e. exactly what the renderer is about to paint.
 */
export function resolvePlanVisibility(args: {
  stickerColors: string[]
  cubeSize: number
  colorScheme: { [face: number]: string }
  maskColor?: string
  options: PlanSimplifyOptions
}): PlanVisibility {
  const { stickerColors, cubeSize: N, colorScheme, options } = args
  const idOf = makeColorIds(colorScheme)
  const maskFill = norm(typeof args.maskColor === 'string' ? args.maskColor : ColorCode.DarkGray)

  const ringColor = (ring: number) => stickerColors[ringStickerIndex(ring, N)] ?? ''
  const upColor = (i: number) => stickerColors[upStickerIndex(i, N)] ?? ''
  const ringId = (ring: number) => idOf(ringColor(ring))
  const upId = (i: number) => idOf(upColor(i))

  const sideRule = options.side ?? 'all'
  const upRule = options.up ?? 'all'
  // The class rules read a corner/edge/corner window — 3x3 only, as in the original.
  const classable = N === 3

  // ── 1. class layer ───────────────────────────────────────────────────────────
  const side = new Array<boolean>(4 * N).fill(true)
  const up = new Array<boolean>(N * N).fill(true)

  if (classable && sideRule !== 'all') {
    // Padded ring window: slot 0 = ring 12, slots 1..12 = ring 1..12, 13/14 = ring 1/2.
    const slot = new Array<boolean>(15).fill(false)
    const ringAt = (s: number) => (s === 0 ? 12 : s <= 12 ? s : s - 12)
    const types = [1, 2, 3, 4].map((strip) => {
      const base = (strip - 1) * 3
      const c = (s: number) => ringId(ringAt(base + s))
      return sideType(c(0), c(1), c(2), c(3), c(4), c(5))
    })
    let threshold = SIDE_THRESHOLD[sideRule]
    const best = Math.min(...types)
    // Never render an empty picture: if the ask is stricter than anything present,
    // relax it to the whole decade of the best pattern that IS present.
    if (threshold <= best) threshold = best + 4
    types.forEach((t, i) => {
      if (t >= threshold) return
      const keep = SIDE_KEEP[t] ?? ''
      const base = i * 3
      for (let s = 0; s < keep.length; s++) {
        if (keep[s] !== '*') slot[base + s] = keep[s] === '1'
      }
    })
    // The padding slots are the real ring positions seen a second time; OR them back
    // (they may only turn a sticker ON) — a strip's explicit 0 must not win over a
    // neighbour's deliberate 1 on the shared corner.
    if (slot[0]) slot[12] = true
    if (slot[13]) slot[1] = true
    if (slot[14]) slot[2] = true
    for (let r = 1; r <= 12; r++) side[r - 1] = slot[r]
  }

  if (classable && upRule !== 'all') {
    up.fill(false)
    const types = UP_PAIRS.map(([a, b]) => upType(upId(a), upId(b)))
    let threshold = UP_THRESHOLD[upRule]
    const best = Math.min(...types)
    if (threshold <= best) threshold = best + 3
    types.forEach((t, i) => {
      if (t >= threshold) return
      up[UP_PAIRS[i][0] - 1] = true
      up[UP_PAIRS[i][1] - 1] = true
    })
  }

  // ── 2/3. explicit overrides ──────────────────────────────────────────────────
  const apply = (raw: string | undefined, value: boolean) => {
    const list = parseIndexList(raw)
    for (const r of list.side) if (r <= 4 * N) side[r - 1] = value
    for (const i of list.up) if (i <= N * N) up[i - 1] = value
  }
  apply(options.forceShow, true)
  apply(options.forceHide, false)

  // ── 4. drop the "don't care" greys (rim only — the U face keeps its greys) ────
  if (options.hideGrey) {
    for (let r = 1; r <= 4 * N; r++) if (norm(ringColor(r)) === maskFill) side[r - 1] = false
  }

  // ── 5. the case's own colour always survives ─────────────────────────────────
  if (options.showYellow ?? true) {
    for (let r = 1; r <= 4 * N; r++) if (ringId(r) === TOP_ID) side[r - 1] = true
    for (let i = 1; i <= N * N; i++) if (upId(i) === TOP_ID) up[i - 1] = true
  }

  return { side, up }
}
