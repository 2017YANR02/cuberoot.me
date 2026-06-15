// PLL performer fingertrick library — PURE data/logic. NO DOM, NO React.
//
// Drives the articulated <ClawdHands> overlay (components/ClawdHands.tsx) in lockstep
// with the /sim cuber THREE engine's per-move tween clock. Everything here is a plain
// function or const table so it is unit-testable in a node environment.
//
// Design source: .tmp/deskpet-pll-design.md sections 3,4,5.
//   - HandPose = 9-channel pose vector per hand (section 3).
//   - HOME-delta model: every trick is authored as a delta from a neutral HOME grip and
//     RETURNS to HOME, so poses never accumulate drift across a 12-move alg.
//   - The engine tween clock is replicated exactly so fingertip + sticker share one curve:
//       tweenDuration(d) = frames*(2 - 2/(d+1)), frames=30           (group.ts:15)
//       ease-out-quad     e = 1 - (p-1)^2                            (tweener.ts:25-26)

// ─────────────────────────────────────────────────────────────────────────────
// 1. HandPose — 9 animatable channels per hand (design section 3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One hand's pose. A fixed-length 9-number tuple; channel meaning is positional:
 *
 *   [0] shoulderPitch  raise/lower the whole arm        (deg, + = lift)
 *   [1] elbowFlex      forearm bend                     (deg, 0..~110)
 *   [2] wristPronation roll the palm (drives x/y/z)     (deg, + = pronate)
 *   [3] wristFlex      push/pull a layer (R/L/F push)   (deg, + = flex toward cube)
 *   [4] wristUlnarDev  the U-flick                      (deg, + = ulnar/down-flick)
 *   [5] thumbCurl      thumb flexion                    (deg, + = curl in)
 *   [6] thumbOppose    thumb opposition (across palm)   (deg, + = oppose)
 *   [7] indexCurl      F1 — the R/L pusher finger       (deg, + = curl in)
 *   [8] fingersCurl    F2 — coupled middle/ring/pinky   (deg, applied x{1.0,0.85,0.70})
 *
 * Authored in degrees; ClawdHands maps each channel onto its joint <g> transform.
 */
export type HandPose = readonly [
  number, number, number, number, number, number, number, number, number,
];

/** Number of channels in a HandPose. */
export const POSE_DOF = 9 as const;

/** Channel index constants (avoid magic numbers when authoring tricks). */
export const CH = {
  shoulderPitch: 0,
  elbowFlex: 1,
  wristPronation: 2,
  wristFlex: 3,
  wristUlnarDev: 4,
  thumbCurl: 5,
  thumbOppose: 6,
  indexCurl: 7,
  fingersCurl: 8,
} as const;

/** F2 coupled-finger sympathetic curl scale (middle / ring / pinky). */
export const F2_COUPLING: readonly [number, number, number] = [1.0, 0.85, 0.7];

/** Which hand a trick is performed by. `both` = whole-cube rotation (two-wrist). */
export type ActiveHand = 'left' | 'right' | 'both';

/**
 * Neutral two-hand speedsolve HOME grip (delta baseline).
 *
 * The arm's RESTING posture (shoulders raised, elbows out, forearms angling in so
 * the hands reach the cube's lower-left / lower-right corners) lives in the RIG
 * base angles (ClawdHands.jointTransforms: shoulderBase/elbowBase/wristBase). HOME
 * here only adds the resting FINGER cup — index + coupled fingers curling onto the
 * R/L faces and the thumb lightly opposed near the U-layer front edge — so the
 * hands look like they're gripping, not splayed open. Every fingertrick is a delta
 * ADDED to this and removed again (HOME at p∈{0,1}).
 */
export const HOME: HandPose = [
  0, // shoulderPitch — rig base holds the arm raised
  0, // elbowFlex     — rig base holds the elbow bent
  0, // wristPronation
  0, // wristFlex
  0, // wristUlnarDev
  18, // thumbCurl    — thumb resting curl onto the U front edge
  14, // thumbOppose  — thumb across toward the cube face
  34, // indexCurl    — index wrapped onto the R/L face
  30, // fingersCurl  — coupled group cupping the lower corner
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. Engine clock replication (group.ts:15 / tweener.ts:25-26)
// ─────────────────────────────────────────────────────────────────────────────

/** Engine animation frame budget for a 90° turn. Mirrors CubeGroup.frames. */
export const ENGINE_FRAMES = 30 as const;

/**
 * Showcase frame budget for a 90° turn at 1× speed. SLOWER than the /sim default
 * (ENGINE_FRAMES=30 ≈ 0.5s) so the fingertricks are legible — ~700ms/quarter-turn @ 60Hz
 * (spec §5.8). The overlay sets CubeGroup.frames = round(SHOWCASE_FRAMES / speed) at
 * runtime, and derives the hand window from THIS SAME constant, so the duration the test
 * locks is the duration the feature ships (no 36-vs-30 drift).
 */
export const SHOWCASE_FRAMES = 42 as const;

/** Engine rAF tick rate assumption (tweener advances exactly 1 tick / rAF ≈ 60Hz). */
export const ENGINE_TICK_HZ = 60 as const;

/**
 * Move tween duration in TICKS (= rAF frames), keyed off move magnitude `d` in 90° units.
 * Exact mirror of `CubeGroup.tweenDuration` (group.ts:15) but parameterized on the live
 * frame budget so the showcase tempo flows through ONE formula:
 *   tweenDuration(1) = frames; tweenDuration(2) ≈ frames*1.33; tweenDuration(0.5) = 0.5*frames.
 */
export function tweenDuration(d: number, frames: number = ENGINE_FRAMES): number {
  return frames * (2 - 2 / (d + 1));
}

/**
 * Convert a move magnitude to the wall-clock ms the hand-pose rAF must run for, so the
 * fingertip + sticker land together. SINGLE source of truth for the move window:
 *   windowMs = tweenDuration(d, round(SHOWCASE_FRAMES / speed)) * (1000/60)
 * `speed` is the chip multiplier (0.5 / 1 / 1.5); higher = faster = fewer frames.
 */
export function tweenDurationMs(d: number, speed = 1): number {
  const liveFrames = Math.max(6, Math.round(SHOWCASE_FRAMES / speed));
  return tweenDuration(d, liveFrames) * (1000 / ENGINE_TICK_HZ);
}

/** The live CubeGroup.frames the engine should use for a given speed chip. */
export function liveEngineFrames(speed = 1): number {
  return Math.max(6, Math.round(SHOWCASE_FRAMES / speed));
}

/**
 * Ease-out-quad, replicated bit-for-bit from `tweener.ts:25-26`:
 *   elapsed = p - 1;  e = 1 - elapsed*elapsed   ===   1 - (p-1)^2
 * `p` is normalized progress in [0,1]; returns eased fraction in [0,1].
 */
export function easeOutQuad(p: number): number {
  const x = clamp01(p) - 1;
  return 1 - x * x;
}

function clamp01(p: number): number {
  return p < 0 ? 0 : p > 1 ? 1 : p;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Move family classifier (design section 4) + decorator stripping
// ─────────────────────────────────────────────────────────────────────────────

/** Finger-trick UTF-8 decorators kept inline in `AlgEntry.alg` (alg.ts:12). */
const DECORATORS = /[·↑↓←→]/g;
/** Grouping brackets some DB algs wrap around triggers — not real moves. */
const BRACKETS = /[()[\]]/g;

/**
 * Strip finger-trick decorators + grouping brackets and split an alg string into plain
 * move tokens. SINGLE tokenizer for the whole performer — use these tokens for BOTH
 * `new TwistAction(token)` and `family(token)` lookup. (The overlay imports this; it does
 * not keep its own copy, so the cube driver and the trick lookup can never diverge.)
 */
export function tokenizeAlg(alg: string): string[] {
  return alg
    .replace(DECORATORS, ' ')
    .replace(BRACKETS, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Inverse of an alg (token order reversed, each move's direction flipped). Used as the
 * scramble so playing the displayed alg ALWAYS returns to solved by construction
 * (alg ∘ inverse(alg) = identity). Built on the shared tokenizer so brackets/decorators
 * are stripped consistently.
 */
export function invertAlg(alg: string): string {
  return tokenizeAlg(alg)
    .map((tok) => {
      if (tok.endsWith('2')) return tok;
      if (tok.endsWith("'")) return tok.slice(0, -1);
      return tok + "'";
    })
    .reverse()
    .join(' ');
}

/**
 * Family keys the FINGERTRICKS table is keyed by. These are the *base* move
 * families (modifiers prime/double are layered on top by the scheduler).
 */
export type MoveFamily =
  | 'R'
  | 'L'
  | 'U'
  | 'F'
  | 'B'
  | 'D'
  | 'M' // M/E/S middle-slice family
  | 'wide' // Rw/Uw/Lw/... any wide turn
  | 'x'
  | 'y'
  | 'z';

/** Parsed view of a token: family + modifiers (matches TwistAction semantics). */
export interface ParsedMove {
  /** Original token (decorators already stripped). */
  token: string;
  /** Base family used to key FINGERTRICKS. */
  family: MoveFamily;
  /** Single letter the trick anchors to (R/L/U/F/B/D/M/E/S/x/y/z). */
  base: string;
  /** true = prime (`'`) — mirror the flick direction. */
  reverse: boolean;
  /** 1 | 2 (| n) — double = two sub-beats. */
  times: number;
  /** true = wide (Rw / r / Uw …). */
  wide: boolean;
}

/**
 * Classify a single move token into its base family + modifiers. Self-contained
 * (does NOT import the THREE-dependent TwistAction) but applies the SAME notation
 * rules: trailing `'`, trailing digit count, `w`/lowercase = wide.
 */
export function parseMove(token: string): ParsedMove | null {
  const t = token.trim();
  if (!t) return null;
  const m = t.match(/^([0-9]*)([bsfdeulmrxyzBSFDEULMRXYZ])(w?)('?)(\d*)('?)$/);
  if (!m) return null;
  const letter = m[2];
  const isWideMark = m[3] === 'w';
  // Lowercase face letter (r/u/f/l/d/b) is also a wide turn in SiGN-ish notation,
  // but lowercase x/y/z are whole-cube rotations (NOT wide).
  const lower = letter.toLowerCase();
  const isRotation = lower === 'x' || lower === 'y' || lower === 'z';
  const isSliceM = lower === 'm' || lower === 'e' || lower === 's';
  const lowerFaceWide = !isRotation && !isSliceM && letter === lower;
  const wide = isWideMark || lowerFaceWide;

  const reverse = (m[4] + m[6]).length === 1;
  const times = m[5].length === 0 ? 1 : parseInt(m[5], 10);

  const base = isRotation ? lower : letter.toUpperCase();

  let family: MoveFamily;
  if (isRotation) family = lower as MoveFamily; // x | y | z
  else if (wide) family = 'wide';
  else if (isSliceM) family = 'M'; // M/E/S share one slice trick
  else family = base as MoveFamily; // R | L | U | F | B | D

  return { token: t, family, base, reverse, times, wide };
}

/** Convenience: just the family key (throws on unparseable token). */
export function family(token: string): MoveFamily {
  const p = parseMove(token);
  if (!p) throw new Error(`unparseable move token: "${token}"`);
  return p.family;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. FINGERTRICKS table (design section 4)
// ─────────────────────────────────────────────────────────────────────────────

/** Cube layer / axis the active fingertip is projected onto for anchoring. */
export type AnchorLayer = 'R' | 'L' | 'U' | 'D' | 'F' | 'B' | 'M' | 'cube';

export interface Fingertrick {
  /** Which hand performs the base (un-primed) trick. */
  activeHand: ActiveHand;
  /**
   * Target pose DELTA from HOME (added to HOME at the turn peak). Sparse: only
   * the channels this trick actuates are non-zero. Length === POSE_DOF.
   */
  delta: HandPose;
  /** Mirror partner delta for the OTHER hand when activeHand==='both'. If absent
   *  and activeHand==='both', `delta` is mirrored automatically (sign-flip the
   *  pronation/ulnar/flex lateral channels). */
  deltaOther?: HandPose;
  /** Which layer's representative cubelet to project for fingertip anchoring. */
  anchor: AnchorLayer;
  /** Whole-cube rotation? (drives world.scene.rotation + engine x/y/z reorient). */
  rotation?: boolean;
}

const Z: HandPose = [0, 0, 0, 0, 0, 0, 0, 0, 0];

/** Helper: build a sparse delta from {channel: value} pairs. */
function delta(parts: Partial<Record<keyof typeof CH, number>>): HandPose {
  const d = [...Z] as number[];
  for (const k in parts) {
    d[CH[k as keyof typeof CH]] = parts[k as keyof typeof CH]!;
  }
  return d as unknown as HandPose;
}

/**
 * Base fingertrick table — keyed by MoveFamily. All 21 PLLs reuse these ~11 entries;
 * prime/double modifiers are applied by the scheduler (mirror + sub-beats), so the
 * table only encodes the canonical (un-primed, single) trick. Real-CFOP-grounded.
 */
export const FINGERTRICKS: Record<MoveFamily, Fingertrick> = {
  // Classic right-index R push: index extends then flexes up, slight shoulder lift,
  // wrist flexes toward the cube.
  R: {
    activeHand: 'right',
    delta: delta({ indexCurl: 34, shoulderPitch: 6, wristFlex: 14, fingersCurl: 8 }),
    anchor: 'R',
  },
  // L mirrors R on the left hand.
  L: {
    activeHand: 'left',
    delta: delta({ indexCurl: 34, shoulderPitch: 6, wristFlex: 14, fingersCurl: 8 }),
    anchor: 'L',
  },
  // Two-hand U convention: left-index home U-flick — ulnar deviation + F2 curl pulse.
  U: {
    activeHand: 'left',
    delta: delta({ wristUlnarDev: 26, fingersCurl: 18, indexCurl: 10 }),
    anchor: 'U',
  },
  // F: right-hand wrist pronation roll + thumb push on the front face.
  F: {
    activeHand: 'right',
    delta: delta({ wristPronation: 22, thumbCurl: 24, thumbOppose: 14 }),
    anchor: 'F',
  },
  // D: left hand reaches under (shoulder down) + coupled-finger underside push.
  D: {
    activeHand: 'left',
    delta: delta({ shoulderPitch: -16, fingersCurl: 22, wristFlex: 10 }),
    anchor: 'D',
  },
  // B: the awkward far-hand move — exaggerated regrip + wrist reach. Kept short/subtle.
  B: {
    activeHand: 'right',
    delta: delta({ shoulderPitch: 14, wristFlex: 20, elbowFlex: 16, indexCurl: 12 }),
    anchor: 'B',
  },
  // M/E/S slice: BOTH hands scissor the middle layer with opposing pronation.
  M: {
    activeHand: 'both',
    delta: delta({ wristPronation: 18, fingersCurl: 12 }),
    deltaOther: delta({ wristPronation: -18, fingersCurl: 12 }),
    anchor: 'M',
  },
  // Wide turn: same family feel + forearm assist (elbow), both fingers engaged. Reads
  // heavier. Anchored on R by default; the scheduler can re-point via the base letter.
  wide: {
    activeHand: 'right',
    delta: delta({ indexCurl: 30, fingersCurl: 24, elbowFlex: 18, wristFlex: 16, shoulderPitch: 8 }),
    anchor: 'R',
  },
  // Whole-cube x: both wrists + both elbows roll the cube toward the viewer.
  x: {
    activeHand: 'both',
    delta: delta({ wristPronation: 16, elbowFlex: 22, shoulderPitch: -6 }),
    deltaOther: delta({ wristPronation: 16, elbowFlex: 22, shoulderPitch: -6 }),
    anchor: 'cube',
    rotation: true,
  },
  // Whole-cube y: the PLL AUF regrip — both wrists rotate horizontally.
  y: {
    activeHand: 'both',
    delta: delta({ wristPronation: 24, thumbOppose: 10 }),
    deltaOther: delta({ wristPronation: -24, thumbOppose: 10 }),
    anchor: 'cube',
    rotation: true,
  },
  // Whole-cube z: both wrists tilt sideways.
  z: {
    activeHand: 'both',
    delta: delta({ wristPronation: 20, wristUlnarDev: 14 }),
    deltaOther: delta({ wristPronation: -20, wristUlnarDev: -14 }),
    anchor: 'cube',
    rotation: true,
  },
};

/** Lateral channels whose sign flips when auto-mirroring `both` to the other hand. */
const LATERAL_CHANNELS: readonly (keyof typeof CH)[] = [
  'wristPronation',
  'wristFlex',
  'wristUlnarDev',
];

/** Auto-mirror a delta for the opposite hand (used when deltaOther is absent). */
function mirrorDelta(d: HandPose): HandPose {
  const out = [...d] as number[];
  for (const c of LATERAL_CHANNELS) out[CH[c]] = -out[CH[c]];
  return out as unknown as HandPose;
}

/**
 * Apply the `reverse` (prime) modifier: mirror the flick direction by negating the
 * trick's lateral/push channels. Primes flick the opposite way (R' pulls where R pushes).
 */
export function applyPrime(d: HandPose, reverse: boolean): HandPose {
  if (!reverse) return d;
  const out = [...d] as number[];
  // Negate the push/flick/roll channels; leave reach/curl posture channels intact so
  // the hand still grips, just flicks the other direction.
  for (const c of ['wristFlex', 'wristUlnarDev', 'wristPronation'] as const) {
    out[CH[c]] = -out[CH[c]];
  }
  // The active pusher finger flips between index (push) and coupled fingers (pull).
  const idx = out[CH.indexCurl];
  out[CH.indexCurl] = out[CH.fingersCurl];
  out[CH.fingersCurl] = idx;
  return out as unknown as HandPose;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Phase scheduler — prep / turn / settle (design section 5.4)
// ─────────────────────────────────────────────────────────────────────────────

/** Phase split fractions within one move's duration (sum to 1). */
export const PHASES = { prep: 0.35, turn: 0.5, settle: 0.15 } as const;

export type PhaseName = 'prep' | 'turn' | 'settle';

export interface PhaseSample {
  /** Which phase the given progress falls in. */
  phase: PhaseName;
  /** Eased local progress within the phase, [0,1]. */
  localEased: number;
  /**
   * Overall pose-amplitude factor in [0,1]:
   *   prep   ramps 0 → 1 (reach toward trick peak),
   *   turn   holds ~1    (peak push while the layer tweens),
   *   settle ramps 1 → 0 (release back toward HOME).
   * Multiply the trick delta by this and add to HOME to get the live pose.
   */
  amplitude: number;
}

/**
 * Sample the phase scheduler at normalized move progress `p` in [0,1].
 * Uses the engine's ease-out-quad inside each phase so fingertip + sticker share
 * the identical curve. Amplitude follows the prep→turn→settle envelope.
 */
export function samplePhase(p: number): PhaseSample {
  const t = clamp01(p);
  const prep: number = PHASES.prep;
  const turn: number = PHASES.turn;
  const turnEnd = prep + turn;
  if (t < prep) {
    const local = prep === 0 ? 1 : t / prep;
    const e = easeOutQuad(local);
    return { phase: 'prep', localEased: e, amplitude: e };
  }
  if (t < turnEnd) {
    const local = turn === 0 ? 1 : (t - prep) / turn;
    return { phase: 'turn', localEased: easeOutQuad(local), amplitude: 1 };
  }
  const settleSpan = 1 - turnEnd;
  const local = settleSpan === 0 ? 1 : (t - turnEnd) / settleSpan;
  const e = easeOutQuad(local);
  return { phase: 'settle', localEased: e, amplitude: 1 - e };
}

/**
 * Compute the live HandPose for the ACTIVE hand at move progress `p`, given a trick
 * and its prime/double modifiers. HOME-delta model: pose = HOME + amplitude*delta, so
 * at p=0 and p=1 the pose equals HOME exactly (no drift across an alg).
 *
 * `which` selects which hand to compute when the trick uses both ('left'|'right').
 * For single-hand tricks, the non-active hand always returns HOME.
 */
export function poseAt(
  trick: Fingertrick,
  parsed: Pick<ParsedMove, 'reverse' | 'times'>,
  p: number,
  which: 'left' | 'right',
): HandPose {
  // Is this hand active for this trick?
  const handActive =
    trick.activeHand === 'both' || trick.activeHand === which;
  if (!handActive) return HOME;

  // Pick the per-hand base delta.
  let base: HandPose;
  if (trick.activeHand === 'both') {
    if (which === 'right') base = trick.delta;
    else base = trick.deltaOther ?? mirrorDelta(trick.delta);
  } else {
    base = trick.delta;
  }
  base = applyPrime(base, parsed.reverse);

  // Double (times===2) splits the turn phase into two sub-beats within the longer
  // tweenDuration(2) window; the amplitude dips between beats so two flicks read.
  const amp = doubleAmplitude(p, parsed.times);

  const out = new Array(POSE_DOF) as number[];
  for (let i = 0; i < POSE_DOF; i++) out[i] = HOME[i] + amp * base[i];
  return out as unknown as HandPose;
}

/**
 * Amplitude envelope including the double-flick sub-beats. For times<=1 this is just
 * `samplePhase(p).amplitude`. For times===2, the turn phase contains two eased pushes
 * with a dip between them so the viewer sees two distinct flicks. Always 0 at p∈{0,1}.
 */
export function doubleAmplitude(p: number, times: number): number {
  const t = clamp01(p);
  if (times <= 1) return samplePhase(t).amplitude;
  const { prep, turn } = PHASES;
  const turnEnd = prep + turn;
  if (t < prep) return samplePhase(t).amplitude; // shared ramp-up
  if (t >= turnEnd) return samplePhase(t).amplitude; // shared settle
  // Inside the turn window: two half-beats, each a 0→1→(dip) sine-ish via easeOutQuad.
  const local = (t - prep) / turn; // 0..1 across the turn phase
  const beat = local < 0.5 ? local / 0.5 : (local - 0.5) / 0.5;
  // each beat eases up to 1 then back to a dip floor of ~0.55 so it never returns HOME mid-move
  const up = easeOutQuad(beat < 0.5 ? beat / 0.5 : 1 - (beat - 0.5) / 0.5);
  return 0.55 + 0.45 * up;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Resolution helper — token → (trick, parsed) in one call
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolvedMove extends ParsedMove {
  trick: Fingertrick;
  /** ticks (engine frames) this move animates over. */
  durationTicks: number;
}

/** Resolve a plain move token to its parsed form + fingertrick + duration. */
export function resolveMove(token: string): ResolvedMove | null {
  const parsed = parseMove(token);
  if (!parsed) return null;
  const trick = FINGERTRICKS[parsed.family];
  if (!trick) return null;
  return { ...parsed, trick, durationTicks: tweenDuration(parsed.times) };
}

/** Resolve a whole alg string to an ordered list of resolved moves. */
export function resolveAlg(alg: string): ResolvedMove[] {
  return tokenizeAlg(alg)
    .map(resolveMove)
    .filter((m): m is ResolvedMove => m !== null);
}
