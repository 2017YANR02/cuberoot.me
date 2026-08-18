/**
 * orientation.ts — pure quaternion math for the smart-cube gyroscope feed.
 *
 * NO DOM, NO three.js, NO BLE. Everything here is a plain function over
 * `{w,x,y,z}` records so it can be unit-tested in the Node vitest environment
 * (see tests/bluetooth_orientation.test.ts). The three.js side of the bridge
 * lives in _components/SimCubeView.tsx, which just copies the result into
 * `world.cube.quaternion`.
 *
 * ── The two unknowns, and why only one of them is a constant ──────────────
 *
 * A sample is NOT "the cube's orientation". Writing C for the cube's pose in
 * the room, what the packet actually carries is
 *
 *        qRaw = W ⊗ C ⊗ M⁻¹
 *
 *   W — the SENSOR'S WORLD frame relative to the room. An IMU fuses gravity, so
 *       its +Z is up; the heading (the yaw about that +Z) is whatever the fusion
 *       initialised to when the cube powered on. **W IS NOT A CONSTANT.** It
 *       differs between sessions, and because a cube powers on resting on a
 *       face, its yaw lands on some multiple of 90°.
 *   M — the MOUNTING: how the sensor board sits inside the cube. This one IS a
 *       hardware constant, and it is what `BRAND_SENSOR_BASIS` records.
 *
 * Every step below is classified by which of the two it cancels. Getting that
 * wrong is not a rounding error: it is how a live heading ends up baked into a
 * table of hardware constants (see the HISTORY note in knob 1).
 *
 * ── The three knobs, and which problem each one actually solves ────────────
 *
 * 1. CALIBRATION (`reference` / q0) — cancels W.
 *    We capture the raw sample at the moment the user says "this is how the
 *    cube is sitting right now" and thereafter show
 *
 *        qDisplay = B ⊗ (q0⁻¹ ⊗ qRaw) ⊗ B⁻¹   ← BODY-frame / RIGHT composition
 *
 *    Substitute the model and the reason is immediate:
 *
 *        q0⁻¹ ⊗ qRaw = M ⊗ (C₀⁻¹ ⊗ C) ⊗ M⁻¹
 *
 *    W is gone, and what survives is THE ROTATION THE CUBE ITSELF MADE, written
 *    in sensor axes. That is exactly the quantity this app is about: a user who
 *    says "I did x'" is making a claim about the cube's own axes, never about
 *    the room's.
 *
 *    HISTORY, and the reason this comment is this long. This used to be
 *    `qRaw ⊗ q0⁻¹` — the world-frame/left composition, which cancels M and
 *    leaves W. It was argued for on the grounds that a yaw about the ROOM's
 *    vertical should read as a yaw about the SCREEN's up axis whatever the grip.
 *    That is true, and it is the wrong thing to want, because the same property
 *    puts the live per-power-cycle heading in W straight onto the screen. It
 *    cost two rounds of "the axes are 90° out": each time the surviving yaw was
 *    measured on hardware and written into `BRAND_SENSOR_BASIS` as if it were
 *    the mounting, and each time it was a heading that had already moved on.
 *    Sprint 31's `rotY90X270` and its retraction are both exactly that.
 *    So: **a yaw never belongs in the brand table.** If one reaches the screen,
 *    the composition is wrong, not the table.
 *
 *    Grip no longer matters either, which is the other half of the same win: a
 *    body-frame delta reports the cube's own rotation, so a physical x' renders
 *    as x' whether the cube was calibrated square, tilted, or facing sideways.
 *    Calibration then decides one thing only — which pose reads as home on
 *    screen — and that is all it should ever have decided.
 *
 * 2. SENSOR BASIS (`basis` / B) — the MOUNTING, and nothing else.
 *    The delta above is the cube's own rotation but written in SENSOR axes, and
 *    the renderer wants cube axes, so B is a change of basis — a similarity
 *    transform, not a multiplication:
 *
 *        qDisplay = B ⊗ (q0⁻¹ ⊗ qRaw) ⊗ B⁻¹,    B = M⁻¹
 *
 *    B comes from the small named table below, keyed by brand, and it has one
 *    job: undo the mounting. Note that a bare axis negation like (x,y,z) →
 *    (−x,y,z) is improper (det −1) and therefore NOT expressible as a
 *    quaternion at all — the `negX`-style entries are the proper 180° rotations,
 *    which is what a real sensor mounting difference actually is.
 *
 * 3. MIRROR (`mirror`) — fixes a HANDEDNESS mismatch.
 *    Negating (x,y,z) conjugates the quaternion, i.e. reverses the sense of
 *    every rotation. This is the knob for "the cube turns the right amount
 *    about the right axis, but the wrong way round" — a left-handed sensor
 *    convention. Because conjugation commutes with the similarity transform in
 *    (2) (conj(B ⊗ q ⊗ B⁻¹) = B ⊗ conj(q) ⊗ B⁻¹, since conj(B⁻¹) = B), the
 *    order of knobs 2 and 3 does not matter; the test asserts that.
 *
 * ── Smoothing ─────────────────────────────────────────────────────────────
 * BLE gyro samples land at roughly 20-50 Hz, below the 60 fps render loop, so
 * raw samples visibly step. `slerpTowards` runs an exponential follow with a
 * ~40 ms time constant: frame-rate independent, converges, never overshoots.
 * A physical slice turn is different: it rotates the sensor-bearing core by a
 * whole quarter/half turn, so the live mirror temporarily uses the shorter
 * time constant below instead of letting repeated M/E/S turns outrun it.
 *
 * ── Settling ──────────────────────────────────────────────────────────────
 * A cube that has stopped moving near a whole orientation is at it; see the
 * `snapWhenSettled` block below for why leaving the last few degrees in is the
 * actual cause of "the cube on screen is permanently crooked".
 *
 * ── Dev-only synthetic source ─────────────────────────────────────────────
 * We own zero smart cubes, so `window.__cuberootFakeQuat` lets a dev build (or
 * Playwright) drive the whole path with a synthetic sample stream. See
 * `readDevQuatSource`.
 */

/** Unit quaternion, scalar-first field order (w) to match the wire formats the
 *  GAN / QiYi / MoYu gyro packets use. three.js is x,y,z,w — convert at the
 *  boundary, never in the middle. */
export interface Quat {
  w: number;
  x: number;
  y: number;
  z: number;
}

/** No rotation. */
export const QUAT_IDENTITY: Quat = Object.freeze({ w: 1, x: 0, y: 0, z: 0 });

const EPS = 1e-9;

/** a ⊗ b — Hamilton product, "apply b first, then a" in world-frame terms. */
export function quatMul(a: Quat, b: Quat): Quat {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

/** Conjugate — negates (x,y,z). For a unit quaternion this is also the inverse
 *  and, read as a rotation, the reversed rotation. This IS the mirror knob. */
export function quatConjugate(q: Quat): Quat {
  return { w: q.w, x: -q.x, y: -q.y, z: -q.z };
}

/** Inverse. Unit quaternions take the cheap path (conjugate); we normalize
 *  first so a slightly-off sensor sample can't inflate the result. */
export function quatInverse(q: Quat): Quat {
  return quatConjugate(quatNormalize(q));
}

export function quatLength(q: Quat): number {
  return Math.hypot(q.w, q.x, q.y, q.z);
}

/** Scale to unit norm. A zero/degenerate quaternion degrades to identity
 *  rather than producing NaN (BLE packets do occasionally arrive all-zero). */
export function quatNormalize(q: Quat): Quat {
  const n = quatLength(q);
  if (!Number.isFinite(n) || n < EPS) return { ...QUAT_IDENTITY };
  return { w: q.w / n, x: q.x / n, y: q.y / n, z: q.z / n };
}

export function quatDot(a: Quat, b: Quat): number {
  return a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Shortest rotation angle between two orientations, radians in [0, π].
 *
 * `|dot|` handles the double cover (q and −q are the same orientation, and must
 * not report a spurious ~2π). The atan2 form is deliberate: THREE's angleTo
 * uses `2·acos(|dot|)`, whose derivative blows up as dot → 1, so two identical
 * orientations come back as ~3e-8 rad instead of ~0. That is still far under
 * the 1e-4 "did it move" gate the render loop uses, but it makes exact-equality
 * assertions impossible to write. atan2(|v|, |w|) is accurate at both ends.
 */
export function quatAngleTo(a: Quat, b: Quat): number {
  const r = quatMul(quatInverse(a), quatNormalize(b));
  return 2 * Math.atan2(Math.hypot(r.x, r.y, r.z), Math.abs(r.w));
}

/** Spherical linear interpolation, taking the short way round. */
export function quatSlerp(from: Quat, to: Quat, t: number): Quat {
  const a = quatNormalize(from);
  let b = quatNormalize(to);
  if (t <= 0) return a;
  if (t >= 1) return b;
  let cos = quatDot(a, b);
  if (cos < 0) {
    // Double cover: flip one end so we interpolate along the short arc.
    b = { w: -b.w, x: -b.x, y: -b.y, z: -b.z };
    cos = -cos;
  }
  if (cos > 1 - 1e-9) {
    // Nearly identical — lerp + renormalize (slerp is numerically unstable here).
    return quatNormalize({
      w: a.w + (b.w - a.w) * t,
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    });
  }
  const theta = Math.acos(cos);
  const sin = Math.sin(theta);
  const sa = Math.sin((1 - t) * theta) / sin;
  const sb = Math.sin(t * theta) / sin;
  return quatNormalize({
    w: a.w * sa + b.w * sb,
    x: a.x * sa + b.x * sb,
    y: a.y * sa + b.y * sb,
    z: a.z * sa + b.z * sb,
  });
}

/** Default follow time constant, ms. ~40 ms keeps 20-50 Hz BLE samples from
 *  stepping visibly at 60 fps without adding a perceptible lag. */
export const ORIENTATION_TAU_MS = 40;

/** Slice turns rotate the sensor-bearing core by 90/180 degrees. Preserve the
 * spherical interpolation, but let that exceptional jump settle within the
 * live layer animation instead of trailing it by several visible frames. */
export const SLICE_ORIENTATION_TAU_MS = 20;

/** Keep the faster follow active long enough to cover one BLE slice batch and
 * its 80-120 ms layer animation. A later pair extends the window. */
export const SLICE_ORIENTATION_FOLLOW_MS = 180;

/** One frame of exponential follow toward `target`.
 *  alpha = 1 − e^(−dt/τ) makes the result frame-rate independent: halving dt
 *  and doing it twice lands in the same place. */
export function slerpTowards(current: Quat, target: Quat, dtMs: number, tauMs = ORIENTATION_TAU_MS): Quat {
  if (!(dtMs > 0)) return quatNormalize(current);
  if (!(tauMs > 0)) return quatNormalize(target);
  const alpha = 1 - Math.exp(-dtMs / tauMs);
  return quatSlerp(current, target, Math.min(1, Math.max(0, alpha)));
}

// ── Sensor basis table ────────────────────────────────────────────────────
//
// Every entry is a PROPER rotation (a quaternion can express nothing else).
// The `neg*` names are the 180° turns about that axis — the physically real
// "the sensor board is mounted flipped" case — not the improper single-axis
// sign flip, which no rotation can produce.

export type SensorBasisName =
  | 'identity'
  | 'swapXY'
  | 'swapXZ'
  | 'swapYZ'
  | 'negX'
  | 'negY'
  | 'negZ'
  | 'rotX90'
  | 'rotY90'
  | 'rotZ90'
  | 'rotX270'
  | 'rotY270'
  | 'rotZ270';

const R2 = Math.SQRT1_2; // sin(90°) · (1/√2) for the 180° diagonal turns
const C45 = Math.cos(Math.PI / 4);
const S45 = Math.sin(Math.PI / 4);

export const SENSOR_BASES: Readonly<Record<SensorBasisName, Quat>> = Object.freeze({
  /** No remap. */
  identity: { w: 1, x: 0, y: 0, z: 0 },
  /** 180° about (1,1,0)/√2 — x↔y, z→−z. */
  swapXY: { w: 0, x: R2, y: R2, z: 0 },
  /** 180° about (1,0,1)/√2 — x↔z, y→−y. */
  swapXZ: { w: 0, x: R2, y: 0, z: R2 },
  /** 180° about (0,1,1)/√2 — y↔z, x→−x. */
  swapYZ: { w: 0, x: 0, y: R2, z: R2 },
  /** 180° about X — keeps x, negates y and z. */
  negX: { w: 0, x: 1, y: 0, z: 0 },
  /** 180° about Y — keeps y, negates x and z. */
  negY: { w: 0, x: 0, y: 1, z: 0 },
  /** 180° about Z — keeps z, negates x and y. */
  negZ: { w: 0, x: 0, y: 0, z: 1 },
  /** +90° about X — y→z, z→−y. */
  rotX90: { w: C45, x: S45, y: 0, z: 0 },
  /** +90° about Y — z→x, x→−z. */
  rotY90: { w: C45, x: 0, y: S45, z: 0 },
  /** +90° about Z — x→y, y→−x. */
  rotZ90: { w: C45, x: 0, y: 0, z: S45 },
  /** −90° about X — z→y, y→−z. THE Z-up → Y-up change of basis. */
  rotX270: { w: C45, x: -S45, y: 0, z: 0 },
  /** −90° about Y — x→z, z→−x. */
  rotY270: { w: C45, x: 0, y: -S45, z: 0 },
  /** −90° about Z — y→x, x→−y. */
  rotZ270: { w: C45, x: 0, y: 0, z: -S45 },
});

/**
 * THE MOUNTING (M) — the one hardware fact in this file. Everything in
 * `BRAND_SENSOR_BASIS` is derived from it, so this is the thing to re-measure,
 * and the table is not somewhere to record a second opinion.
 *
 * Read it as: the cube's own axes (x through the R face, y through U, z through
 * F), written in sensor coordinates.
 *
 *     cube x → sensor +x      cube y → sensor +z      cube z → sensor −y
 *
 * That is `rotX90`: an entirely ordinary **Z-up** IMU — the axis out of the top
 * of the cube is the one the AHRS calls +Z — with no extra yaw. The renderer is
 * Y-up, so the basis that undoes it is the single factor `M⁻¹ = rotX270`.
 *
 * No yaw appears here and none ever should: a mounting yaw and the sensor's
 * power-on heading are indistinguishable in one measurement, and the heading is
 * the one that moves. See knob 1's HISTORY note — that confusion is what put a
 * 90° yaw in this file twice.
 *
 * HOW IT WAS MEASURED (2026-08-01, GAN v4, and the protocol for re-measuring):
 * calibrate, then make ONE whole-cube rotation and say which one the screen
 * made. `x'` came out as `z` and `z` came out as `x`; `y` was already right.
 * Those two sentences pin all three axes, and they agree with each other — one
 * observation cannot tell a mounting apart from a heading, two crossing ones can.
 */
export const MEASURED_SENSOR_MOUNT: Quat = SENSOR_BASES.rotX90;

/**
 * Per-brand sensor basis.
 *
 * The default is no longer `identity`. Reported from real hardware: a physical
 * `y` — the cube turned about its own vertical — rendered on screen as a `z`,
 * a tumble about the depth axis. Nothing brand-specific produces that. It is
 * the signature of a **Z-up** sensor frame handed straight to a **Y-up**
 * renderer: the IMU calls the axis out of the top of the cube +Z (the ordinary
 * AHRS convention), three.js calls it +Y, and a yaw about the one arrives as a
 * roll about the other. The change of basis that reconciles them is a −90°
 * rotation about X (`rotX270`: sensor z → screen y), applied as the similarity
 * in knob 2 above.
 *
 * It is a PROPER rotation, so it cannot and does not change handedness —
 * `BRAND_MIRROR` stays a separate question and stays false.
 *
 * Every row is `MEASURED_SENSOR_MOUNT`'s inverse and nothing else; the test
 * asserts that literally, so a row can only move by re-measuring the mounting.
 *
 * RETRACTED, and left written down so it is not rediscovered: a second round
 * once put `rotY90X270` here — `rotX270` with a 90° yaw composed on — because a
 * physical `x` was reported rendering as `z`. That yaw was the sensor's
 * power-on HEADING, not the mounting, and the world-frame composition then in
 * use was what let it reach the screen at all (knob 1's HISTORY note). Its only
 * effect was to make the same complaint come back inverted one session later.
 * The composition is fixed; the table goes back to the mounting alone.
 *
 * Still per-brand: every row currently holds the same value because one cube is
 * all that has been measured, and if some brand mounts its IMU differently that
 * one row changes — which is exactly the granularity this table exists for.
 * What no row may ever hold is a yaw.
 *
 * Keyed by plain string rather than the `CubeBrand` union from ./types on
 * purpose: the drivers in this directory are being rewritten in parallel, and
 * an unknown key here is a silent fall-through, not a build break.
 */
export const BRAND_SENSOR_BASIS: Readonly<Record<string, SensorBasisName>> = Object.freeze({
  'gan-v2': 'rotX270',  // Z-up IMU (see above)
  'gan-v3': 'rotX270',  // Z-up IMU
  'gan-v4': 'rotX270',  // the cube MEASURED_SENSOR_MOUNT was measured on
  gocube: 'rotX270',    // Z-up IMU
  qiyi: 'rotX270',      // Z-up IMU
  giiker: 'rotX270',    // Z-up IMU
  moyu: 'rotX270',      // Z-up IMU
  unknown: 'rotX270',   // Z-up IMU
});

/** Brand → basis name. An unknown or absent brand gets the same treatment as
 *  the `unknown` row, not `identity` — "we didn't recognise the cube" is not a
 *  reason to believe its IMU is Y-up when no cube we have seen is. */
export function sensorBasisForBrand(brand: string | null | undefined): SensorBasisName {
  if (!brand) return BRAND_SENSOR_BASIS.unknown;
  return BRAND_SENSOR_BASIS[brand] ?? BRAND_SENSOR_BASIS.unknown;
}

/** Per-brand mirror flag.
 *
 * UNVERIFIED — same story as the basis table. `false` everywhere; flip a single
 * row the first time a real cube is seen yawing backwards. Note again that this
 * is NOT something recalibrating can fix (see the header). */
export const BRAND_MIRROR: Readonly<Record<string, boolean>> = Object.freeze({
  'gan-v2': false,  // UNVERIFIED — no hardware
  'gan-v3': false,  // UNVERIFIED — no hardware
  'gan-v4': false,  // UNVERIFIED — no hardware
  gocube: false,    // UNVERIFIED — no hardware
  qiyi: false,      // UNVERIFIED — no hardware
  giiker: false,    // UNVERIFIED — no hardware
  moyu: false,      // UNVERIFIED — no hardware
  unknown: false,   // UNVERIFIED — no hardware
});

export function mirrorForBrand(brand: string | null | undefined): boolean {
  if (!brand) return false;
  return BRAND_MIRROR[brand] ?? false;
}

// ── The pipeline ──────────────────────────────────────────────────────────

export interface OrientationOptions {
  /** Sensor axis remap (see SENSOR_BASES). Default 'identity'. */
  basis?: SensorBasisName;
  /** Reverse the sense of every rotation (handedness fix). Default false. */
  mirror?: boolean;
}

/**
 * Capture a calibration reference from the current raw sample.
 * Just a normalized copy — kept as a named function so call sites read as
 * intent ("this pose is now upright") rather than as a copy.
 */
export function calibrate(raw: Quat): Quat {
  return quatNormalize(raw);
}

/**
 * raw sample (+ optional calibration reference) → quaternion to hand three.js.
 *
 *     qDisplay = B ⊗ mirror?( q0⁻¹ ⊗ qRaw ) ⊗ B⁻¹
 *
 * `reference == null` means "not calibrated yet" and the raw sample passes
 * through the basis/mirror stages unchanged.
 */
export function applyOrientation(
  raw: Quat,
  reference: Quat | null,
  opts: OrientationOptions = {},
): Quat {
  const { basis = 'identity', mirror = false } = opts;
  const q = quatNormalize(raw);
  // BODY-frame composition — reference FIRST. This is the line that cancels the
  // sensor's power-on heading; flipping it to `quatMul(q, quatInverse(reference))`
  // puts a live yaw on screen, which reads as "the axes are 90° out" and has
  // twice been mistaken for a mounting. See header note 1.
  let out = reference ? quatMul(quatInverse(reference), q) : q;
  if (mirror) out = quatConjugate(out);
  if (basis !== 'identity') {
    const b = SENSOR_BASES[basis];
    out = quatMul(quatMul(b, out), quatConjugate(b));
  }
  return quatNormalize(out);
}

// ── Settling onto a whole orientation ─────────────────────────────────────
//
// WHY THIS EXISTS — the "屏幕上的魔方一直是歪的，校准也没用" report.
//
// Calibration zeroes the display AT THE INSTANT OF THE TAP and only then. The
// reference it captures is whatever pose the cube was in at that moment, which
// for a hand-held cube is always a few degrees off a whole orientation: the
// user's grip, a cube still rocking on the table, a sensor whose own zero is
// not level. From then on the screen shows the delta from THAT pose, so every
// later rest pose renders a few degrees skewed — permanently, and tapping
// calibrate again just bakes in a fresh small error. That is the whole reported
// symptom, including the part where re-calibrating does not help: the error the
// user sees is never the one calibration is able to remove.
//
// The fix is to make "at rest" mean something. A cube that has stopped moving
// near a whole orientation is, physically, AT that orientation — nobody balances
// a cube 4° off level. So once the pose has held still for a moment we retarget
// the smoothing onto the nearest of the 24, and the existing exponential follow
// glides it there over a few frames instead of snapping.
//
// Two guards keep this honest:
//   - the snap only fires within SNAP_MAX_RAD, so a cube genuinely held at 45°
//     is left alone and keeps reading 45°;
//   - it needs SNAP_AFTER_MS of stillness, so it can never fight a rotation in
//     progress — during a turn the true pose is always what's shown.

/** All 24 orientations of a cube, as unit quaternions.
 *
 *  Built rather than typed out: the group generated by quarter turns about X
 *  and Y closes at exactly 24 elements, and a table of hand-written literals is
 *  a place for a typo to hide. The test asserts the count and the closure. */
function buildCubeOrientations(): Quat[] {
  const gens = [SENSOR_BASES.rotX90, SENSOR_BASES.rotY90];
  const out: Quat[] = [{ ...QUAT_IDENTITY }];
  // q and −q are the same orientation, so dedupe on |dot| rather than on the
  // components — otherwise the same rotation enters twice under both signs.
  const known = (q: Quat): boolean => out.some((o) => Math.abs(quatDot(o, q)) > 1 - 1e-6);
  for (let i = 0; i < out.length; i++) {
    for (const g of gens) {
      const next = quatNormalize(quatMul(g, out[i]));
      if (!known(next)) out.push(next);
    }
  }
  return out;
}

export const CUBE_ORIENTATIONS: readonly Quat[] = Object.freeze(buildCubeOrientations());

/** Nearest whole cube orientation to `q`, with how far away it was. */
export function nearestCubeOrientation(q: Quat): { quat: Quat; angleRad: number } {
  const n = quatNormalize(q);
  let best = CUBE_ORIENTATIONS[0];
  let bestAngle = Infinity;
  for (const o of CUBE_ORIENTATIONS) {
    const a = quatAngleTo(n, o);
    if (a < bestAngle) {
      bestAngle = a;
      best = o;
    }
  }
  return { quat: { ...best }, angleRad: bestAngle };
}

/** How far off a whole orientation the pose may be and still be treated as
 *  resting on it. Adjacent orientations are a quarter turn apart, so anything
 *  under 45° is unambiguous; half of that leaves a wide band in which a pose is
 *  reported exactly as measured. */
export const SNAP_MAX_RAD = (22.5 * Math.PI) / 180;

/** How long the pose must hold still before it is considered at rest. Long
 *  enough to sit out the pause between two turns of a solve, short enough that
 *  putting the cube down looks immediate. */
export const SNAP_AFTER_MS = 260;

/** Below this a frame-to-frame change is sensor noise, not motion. */
export const SNAP_STILL_EPS_RAD = 0.02; // ~1.1°

export interface SnapOptions {
  maxRad?: number;
  afterMs?: number;
}

/**
 * The pose to aim the smoothing at: normally `target`, but the nearest whole
 * orientation once the cube has been still for long enough and is close enough.
 *
 * Pure and total — `stillMs` is accumulated by the caller (see
 * `advanceStillMs`) so this stays a function of its arguments and nothing else.
 */
export function snapWhenSettled(target: Quat, stillMs: number, opts: SnapOptions = {}): Quat {
  const { maxRad = SNAP_MAX_RAD, afterMs = SNAP_AFTER_MS } = opts;
  if (!(stillMs >= afterMs)) return quatNormalize(target);
  const near = nearestCubeOrientation(target);
  return near.angleRad <= maxRad ? near.quat : quatNormalize(target);
}

/** Accumulate stillness: `dtMs` more of it if the pose barely moved, otherwise
 *  back to zero. Split out so the rule is testable without a render loop. */
export function advanceStillMs(prev: Quat | null, next: Quat, stillMs: number, dtMs: number): number {
  if (!prev) return 0;
  return quatAngleTo(prev, next) <= SNAP_STILL_EPS_RAD ? stillMs + Math.max(0, dtMs) : 0;
}

// ── Dev-only synthetic source (no hardware in the building) ───────────────

/**
 * What `window.__cuberootFakeQuat` may hold:
 *   - a Quat            → a fixed pose
 *   - (tMs) => Quat     → an animated pose, sampled with performance.now()
 *   - null / undefined  → no synthetic source (production default)
 *
 * Playwright usage (drives a steady yaw):
 *
 *   window.__cuberootFakeQuat = (t) => {
 *     const a = (t / 2000) * Math.PI;          // half a turn per 2 s
 *     return { w: Math.cos(a / 2), x: 0, y: Math.sin(a / 2), z: 0 };
 *   };
 */
export type DevQuatSource = Quat | ((tMs: number) => Quat | null) | null | undefined;

declare global {
  interface Window {
    /** Dev/e2e only — see DevQuatSource. Never set in production code. */
    __cuberootFakeQuat?: DevQuatSource;
  }
}

function isQuatLike(v: unknown): v is Quat {
  if (typeof v !== 'object' || v === null) return false;
  const q = v as Partial<Quat>;
  return [q.w, q.x, q.y, q.z].every((n) => typeof n === 'number' && Number.isFinite(n));
}

/** Read one sample from the synthetic source, or null when none is installed.
 *  Safe to call in SSR (returns null) and safe against a garbage global. */
export function readDevQuatSource(tMs: number): Quat | null {
  if (typeof window === 'undefined') return null;
  const src = window.__cuberootFakeQuat;
  if (src == null) return null;
  try {
    const v = typeof src === 'function' ? src(tMs) : src;
    return isQuatLike(v) ? quatNormalize(v) : null;
  } catch {
    return null;
  }
}
