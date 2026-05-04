import { cubeRotations } from './../constants.js'
import { TurnType } from '../simulation.js'
import { TurnAbbreviation, AlgorithmUnit, possibleMoves } from '../constants.js'

export interface Turn {
  move: AlgorithmUnit
  turnType: TurnType
  slices: number
}

const turnRegex = /([2-9]+)?([UuFfRrDdLlBbMESxyz])(w)?(\d+\'|\'\d+|\d+|\')?/g

const Opposite: Record<TurnType, TurnType> = {
  [TurnType.None]: TurnType.None,
  [TurnType.Clockwise]: TurnType.CounterClockwise,
  [TurnType.CounterClockwise]: TurnType.Clockwise,
  [TurnType.Double]: TurnType.Double,
}

/**
 * Pre-process the algorithm string to expand notation extensions that the
 * core regex tokenizer below does not understand directly. Mirrors the
 * rewriting passes in PHP visualcube's `fcs_format_alg` (see
 * `_php_reference/cube_lib.php` ~line 1235).
 *
 * Passes (in order):
 *   1. Backtick `` ` `` → prime `'` (alt prime alias used by some loggers).
 *   2. Repeat groups `(R U R' U')3` → `R U R' U' R U R' U' R U R' U'`.
 *      Trailing count optional; without it the parens are dropped (count = 1).
 *      Nested groups not supported (matches PHP).
 *   2.5. Uppercase-wide range `m-NUw[mods]` (cubing.js notation) →
 *      lowercase form `m-Nu[mods]` so Pass 3 handles it. Special-cases:
 *        `1-NUw` → `NUw` (1-N is just N-layer wide).
 *        `1-2Uw` → `Uw` (default 2-layer wide).
 *   3. Range slices `2-Nf` (lower 2..N, lowercase wide-face) → ` Nf F'` /
 *      `m-Nr` for m>2 → ` Nr (m-1)r'`. Prime / 2 variants follow PHP.
 *   4. Single inner-layer `2R` (uppercase, NOT followed by `w`) → ` 2r R'`.
 *      `mR` for m>2 → ` mr (m-1)r'`. Prime / 2 variants follow PHP.
 *      Negative-lookahead `(?!w)` keeps this from consuming `3Rw` notation.
 *
 * After these passes the string contains only tokens the regex understands
 * (wide moves and outer-block moves like `Nrw`/`Nr`). For cubeSize=3 most of
 * the inner-layer / range expansions are degenerate but accepted.
 *
 * Deliberate divergences from PHP `fcs_format_alg`:
 *   - Pass order: PHP runs repeat groups AFTER range/inner-layer; we do it
 *     before. Functionally equivalent in practice because Pass 3/4 also re-scan
 *     the expanded text.
 *   - PHP rewrites lowercase slice `m e s` → `x R' L` style; we skip that pass
 *     since the existing tokenizer below handles uppercase `M E S` directly.
 *     If a caller ever feeds lowercase slice notation it'll throw.
 *   - The `2'` / `'2` normalization at Pass 1b is greedy: `R 2 ' U` (typo with
 *     stray space) collapses unexpectedly. PHP has the same behaviour.
 */
function preprocessAlgorithm(algorithm: string): string {
  let r = algorithm

  // Pass 1: backtick → prime.
  r = r.replace(/`/g, "'")

  // Pass 1b: PHP also normalizes `2'` and `'2` to `2` (double turn is
  // self-inverse on a single face). Doing this here lets later passes match
  // the simpler PHP pattern.
  r = r.replace(/2'|'2/g, '2')

  // Pass 2: repeat groups `(...)N`. Run repeatedly in case multiple groups
  // are present. No nesting support.
  r = r.replace(/(\([^()]+?\))([2-9])?/g, (_m, group: string, count?: string) => {
    const inner = group.slice(1, -1)
    const n = count ? parseInt(count, 10) : 1
    const pieces: string[] = []
    for (let i = 0; i < n; i++) pieces.push(inner)
    return ' ' + pieces.join(' ') + ' '
  })

  // Pass 2.5: Normalize uppercase-wide range notation `m-NUw[mods]` (cubing.js
  // style) into lowercase `m-Nu[mods]` so Pass 3 can handle it. `1-N` is a
  // special case (lower bound is the outer layer) — it's just N-layer wide.
  r = r.replace(/(?<=^|[\s()'])(\d+)-(\d+)([UDLRFB])w([23]?'?)/g, (_m, lo: string, hi: string, face: string, mod: string) => {
    const lower = parseInt(lo, 10);
    const upper = parseInt(hi, 10);
    if (lower === 1) {
      // `1-N` = N-layer wide. `1-2Xw` collapses to default `Xw`.
      if (upper === 2) return ` ${face}w${mod}`;
      return ` ${upper}${face}w${mod}`;
    }
    return ` ${lower}-${upper}${face.toLowerCase()}${mod}`;
  });

  // Pass 3: range slices `m-Nr` for lowercase wide faces (PHP fcs_format_alg).
  // Examples: `2-4r` → ` 4r R'`; `3-5r` → ` 5r 2r'`; `2-4r'` → ` 4r' R`;
  // `2-4r2` → ` 4r2 R2` (already normalized to `4r2 R2`).
  // Lookbehind `(?<=^|[\s()'])` ensures the leading digit starts a token, so
  // we don't accidentally split tokens like `R2-3r` (not a real notation
  // anyway, but defensive).
  r = r.replace(/(?<=^|[\s()'])([2-9])-([2-9])([udlrfb])([23]?'?)/g, (_m, lower: string, upper: string, face: string, mod: string) => {
    const upperFace = face.toUpperCase()
    const hasPrime = mod.indexOf("'") >= 0
    const power = mod.replace("'", '') // "" | "2" | "3"
    if (lower === '2') {
      // 2-Nr → ` Nr R'`  /  2-Nr' → ` Nr' R`
      if (!hasPrime) return ` ${upper}${face}${power} ${upperFace}${power}'`
      return ` ${upper}${face}${power}' ${upperFace}${power}`
    }
    // m-Nr (m>2) → ` Nr (m-1)r'`  /  m-Nr' → ` Nr' (m-1)r`
    const inner = String(parseInt(lower, 10) - 1)
    if (!hasPrime) return ` ${upper}${face}${power} ${inner}${face}${power}'`
    return ` ${upper}${face}${power}' ${inner}${face}${power}`
  })

  // Pass 4: single inner-layer `mU/D/L/R/F/B` (uppercase, NOT followed by `w`).
  // `2R` → ` 2r R'`; `2R'` → ` 2r' R`; `mR` (m>2) → ` mr (m-1)r'`.
  // The `(?!w)` negative lookahead prevents this from matching `3Rw` (which is
  // outer-block notation handled by the main turnRegex). The uppercase set
  // guarantees we only catch single-layer notation, not slice/rotation.
  // Lookbehind `(?<=^|[\s()'])` ensures the leading digit starts a token —
  // otherwise `U2R` (no space) would be mis-rewritten by the leading `2R`.
  r = r.replace(/(?<=^|[\s()'])([2-9][0-9]?)([UDLRFB])(?!w)([23]?'?)/g, (_m, layers: string, face: string, mod: string) => {
    const lowerFace = face.toLowerCase()
    const hasPrime = mod.indexOf("'") >= 0
    const power = mod.replace("'", '')
    if (layers === '2') {
      if (!hasPrime) return ` 2${lowerFace}${power} ${face}${power}'`
      return ` 2${lowerFace}${power}' ${face}${power}`
    }
    const inner = String(parseInt(layers, 10) - 1)
    if (!hasPrime) return ` ${layers}${lowerFace}${power} ${inner}${lowerFace}${power}'`
    return ` ${layers}${lowerFace}${power}' ${inner}${lowerFace}${power}`
  })

  return r
}

/**
 * Takes in an algorithm string and parses the turns from it
 * algorithm string format should be moves separated by a single space
 * (ex. "U R2 L' x")
 *
 * https://www.worldcubeassociation.org/regulations/#article-12-notation
 *
 * Also accepts the PHP visualcube extensions: backtick prime alias,
 * `(...)N` repeat groups, `2-5r` range slices, `2R` single inner layer.
 * See `preprocessAlgorithm` for spec.
 */
export function parseAlgorithm(algorithm: string): Turn[] {
  if (!algorithm) {
    return []
  }
  algorithm = preprocessAlgorithm(algorithm)
  let turns: Turn[] = []
  let match
  // Reset regex state — turnRegex is module-level and stateful (`g` flag).
  turnRegex.lastIndex = 0
  do {
    match = turnRegex.exec(algorithm)
    if (match) {
      let rawSlices: string = match[1]
      let rawFace: string = match[2]
      let outerBlockIndicator = match[3]
      let rawType = match[4] || TurnAbbreviation.Clockwise // Default to clockwise
      let isLowerCaseMove = rawFace === rawFace.toLowerCase() && cubeRotations.indexOf(rawFace) === -1

      if (isLowerCaseMove) {
        rawFace = rawFace.toUpperCase()
      }

      // Lowercase wide-face moves (`r` `u` `f` …) default to 2 slices, but
      // honor an explicit leading digit so Pass 3/4 expansions like `3r 2r'`
      // (produced from `2-3r` / `3R`) actually do 3-layer-wide and 2-layer-wide
      // turns instead of both collapsing to `Rw`.
      let turn: Turn = {
        move: getMove(rawFace),
        turnType: getTurnType(rawType),
        slices: isLowerCaseMove
          ? (rawSlices ? parseInt(rawSlices, 10) : 2)
          : getSlices(rawSlices, outerBlockIndicator),
      }

      turns.push(turn)
    }
  } while (match)

  return turns
}

export function parseCase(algorithm: string): Turn[] {
  return parseAlgorithm(algorithm)
    .map(turn => {
      return <Turn>{
        turnType: Opposite[turn.turnType],
        move: turn.move,
        slices: turn.slices,
      }
    })
    .reverse()
}

function getSlices(rawSlices: string | undefined, outerBlockIndicator: string | undefined): number {
  if (outerBlockIndicator && !rawSlices) {
    return 2
  } else if (!outerBlockIndicator && rawSlices) {
    throw new Error(`Invalid move: Cannot specify num slices if outer block move indicator 'w' is not present`)
  } else if (!outerBlockIndicator && !rawSlices) {
    return 1
  } else {
    return parseInt(rawSlices!)
  }
}

function getMove(rawFace: string): AlgorithmUnit {
  if (possibleMoves.indexOf(rawFace) < 0) {
    throw new Error(`Invalid move (${rawFace}): Possible turn faces are [U R F L D B M E S x y z]`)
  } else return rawFace as AlgorithmUnit
}

function getTurnType(rawType: string): TurnType {
  switch (rawType) {
    case TurnAbbreviation.Clockwise:
      return TurnType.Clockwise
    case TurnAbbreviation.CounterClockwise:
      return TurnType.CounterClockwise
    case TurnAbbreviation.Double:
    case TurnAbbreviation.DoubleCounter1:
    case TurnAbbreviation.DoubleCounter2:
      return TurnType.Double
    default:
      // Attempt to parse non standard turn type
      // (for invalid but reasonable moves like "y3")
      let reversed = false
      if (rawType.charAt(0) === "'") {
        reversed = true
        rawType = rawType.substring(1, rawType.length)
      } else if (rawType.charAt(rawType.length - 1) === "'") {
        reversed = true
      }

      let turns = parseInt(rawType) % 4

      if (isNaN(turns)) {
        throw new Error(`Invalid move modifier (${rawType})`)
      }

      if (turns === 0) {
        return TurnType.None
      }

      if (turns === 3) {
        reversed = !reversed
        turns = 1
      }

      if (turns == 2) {
        return TurnType.Double
      }

      return reversed ? TurnType.CounterClockwise : TurnType.Clockwise
  }
}
