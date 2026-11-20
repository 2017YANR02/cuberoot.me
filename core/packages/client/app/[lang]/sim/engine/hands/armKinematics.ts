import { MathUtils, Quaternion, Vector3 } from 'three';

/** Analytic shoulder–elbow–wrist chain, evaluated in body coordinates. The
 * outward/downward pole gives each side a repeatable bend plane on seeks. */
export interface WristEnvelope { neutral: Vector3; radial: Vector3; minForward?: number }
export const WRIST_BEND_MAX = 80 * Math.PI / 180;
const defaultMinForward = Math.cos(WRIST_BEND_MAX);
export const WRIST_RADIAL_SIN = Math.sin(25 * Math.PI / 180);
export const WRIST_ULNAR_SIN = Math.sin(40 * Math.PI / 180);

export const ELBOW_FLEX_MAX = MathUtils.degToRad(150);
const FOREARM_HARD = Math.PI / 2;
const PRONATION_SOFT = MathUtils.degToRad(70);
const SUPINATION_SOFT = MathUtils.degToRad(75);

function minimumArmReach(upper: number, fore: number, maxFlex: number) {
  return Math.sqrt(upper ** 2 + fore ** 2 + 2 * upper * fore * Math.cos(maxFlex));
}

/** In a flexed elbow, neutral (thumb up) points toward the shoulder in the
 * plane perpendicular to the forearm. Positive anatomical angles pronate
 * either hand. All inputs are expressed in the same coordinate system. */
export class ForearmRotation {
  private readonly neutral = new Vector3();
  private readonly radial = new Vector3();
  private readonly cross = new Vector3();
  private readonly turn = new Quaternion();
  private previous: number | null = null;
  settling = false;

  reset(): void { this.previous = null; this.settling = false; }

  angle(fore: Vector3, towardShoulder: Vector3, thumb: Vector3, side: 'L' | 'R'): number {
    const n = this.neutral.copy(towardShoulder).addScaledVector(fore, -fore.dot(towardShoulder));
    if (n.lengthSq() < 1e-10) {
      n.set(0, 1, 0).addScaledVector(fore, -fore.y);
      if (n.lengthSq() < 1e-10) n.set(0, 0, 1).addScaledVector(fore, -fore.z);
    }
    n.normalize();
    const r = this.radial.copy(thumb).addScaledVector(fore, -fore.dot(thumb)).normalize();
    return (side === 'R' ? -1 : 1) * Math.atan2(fore.dot(this.cross.crossVectors(n, r)), n.dot(r));
  }

  apply(rotation: Quaternion, fore: Vector3, angle: number, side: 'L' | 'R', dtMs: number): number {
    const soft = angle >= 0 ? PRONATION_SOFT : SUPINATION_SOFT;
    const excess = Math.max(0, Math.abs(angle) - soft);
    const range = FOREARM_HARD - soft;
    let bounded = excess ? Math.sign(angle) * (soft + range * Math.tanh(excess / range)) : angle;
    // A target passing directly behind the thumb-up axis has two equally
    // distant stops. Avoid flipping the displayed forearm between frames.
    const target = bounded;
    if (this.previous !== null && dtMs > 0) {
      const step = MathUtils.degToRad(480) * dtMs / 1000;
      bounded = MathUtils.clamp(bounded, this.previous - step, this.previous + step);
    }
    this.settling = Math.abs(target - bounded) > 1e-6;
    this.previous = bounded;
    rotation.premultiply(this.turn.setFromAxisAngle(fore, (side === 'R' ? -1 : 1) * (bounded - angle)));
    return bounded;
  }
}

export class ArmKinematics {
  readonly upper = new Vector3();
  readonly fore = new Vector3();
  private readonly axis = new Vector3();
  private readonly pole = new Vector3();
  private readonly preference = new Vector3();

  private readonly tangent = new Vector3();
  private readonly candidate = new Vector3();
  private readonly back = new Vector3();

  /** Choose the shortest shoulder correction among the wrist-cone candidates,
   * projecting the upper arm onto the elbow-flexion boundary if needed. */
  shoulderCorrection(fromWrist: Vector3, upperLength: number, foreLength: number, wrist: WristEnvelope, out: Vector3, maxFlex = ELBOW_FLEX_MAX): void {
    const {neutral, radial} = wrist;
    const minForward = wrist.minForward ?? defaultMinForward;
    let best = Infinity;
    const score = (direction: Vector3) => {
      if (direction.dot(neutral) < minForward - 1e-7 || direction.dot(radial) < -WRIST_RADIAL_SIN - 1e-7
        || direction.dot(radial) > WRIST_ULNAR_SIN + 1e-7) return;
      const delta = this.back.copy(fromWrist).addScaledVector(direction, -foreLength);
      const length = delta.length();
      if (length < 1e-10) return;
      // Preserve the wrist and its admissible direction. Adjust the upper
      // segment on its sphere if this direction would fold the elbow too far.
      delta.multiplyScalar(1 / length);
      const dot = delta.dot(direction);
      if (dot < Math.cos(maxFlex)) {
        delta.addScaledVector(direction, -dot);
        if (delta.lengthSq() < 1e-16) {
          delta.copy(radial).addScaledVector(direction, -radial.dot(direction));
          if (delta.lengthSq() < 1e-16) delta.copy(neutral).addScaledVector(direction, -neutral.dot(direction));
        }
        delta.normalize().multiplyScalar(Math.sin(maxFlex)).addScaledVector(direction, Math.cos(maxFlex));
      }
      delta.multiplyScalar(upperLength).addScaledVector(direction, foreLength).sub(fromWrist);
      const error = delta.length();
      if (error < best) {
        best = error;
        out.copy(delta);
      }
    };
    out.set(0, 0, 0);
    score(neutral);
    score(this.candidate.copy(fromWrist).normalize());
    score(this.candidate.negate());
    const onPlane = (normal: Vector3, bound: number) => {
      const axis = this.axis.copy(fromWrist).addScaledVector(normal, -normal.dot(fromWrist));
      if (axis.lengthSq() < 1e-16) return;
      axis.normalize().multiplyScalar(Math.sqrt(1 - bound * bound));
      score(this.candidate.copy(normal).multiplyScalar(bound).add(axis));
      score(this.candidate.copy(normal).multiplyScalar(bound).sub(axis));
    };
    onPlane(neutral, minForward);
    onPlane(radial, -WRIST_RADIAL_SIN);
    onPlane(radial, WRIST_ULNAR_SIN);
    // A half-grip cone tilts toward the target forearm. Its axis and the
    // anatomical radial axis need not be orthogonal.
    const dot = neutral.dot(radial), determinant = 1 - dot * dot;
    if (determinant < 1e-10) return;
    for (const lateral of [-WRIST_RADIAL_SIN, WRIST_ULNAR_SIN]) {
      const base = this.axis.copy(neutral).multiplyScalar((minForward - dot * lateral) / determinant)
        .addScaledVector(radial, (lateral - dot * minForward) / determinant);
      const radiusSq = 1 - base.lengthSq();
      if (radiusSq < -1e-10) continue;
      const normal = this.tangent.crossVectors(neutral, radial).multiplyScalar(Math.sqrt(Math.max(0, radiusSq) / determinant));
      score(this.candidate.copy(base).add(normal));
      score(this.candidate.copy(base).sub(normal));
    }
  }

  solve(target: Vector3, preferredFore: Vector3, upperLength: number, foreLength: number, side: 'L' | 'R', wrist?: WristEnvelope, elbowLimit: boolean | number = true): boolean {
    const minForward = wrist?.minForward ?? defaultMinForward;
    const distance = target.length();
    const axis = this.axis.copy(target);
    if (distance > 1e-9) axis.divideScalar(distance);
    else axis.set(0, 0, 1);
    const maxFlex = typeof elbowLimit === 'number' ? elbowLimit : ELBOW_FLEX_MAX;
    const minimum = elbowLimit === false ? Math.abs(upperLength - foreLength) + 1e-8 : minimumArmReach(upperLength, foreLength, maxFlex);
    const reach = MathUtils.clamp(distance, minimum, upperLength + foreLength);
    const along = (upperLength ** 2 - foreLength ** 2 + reach ** 2) / (2 * reach);
    const height = Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2));
    const pole = this.pole.set(side === 'R' ? -.55 : .55, -1, -.25);
    pole.addScaledVector(axis, -pole.dot(axis));
    if (pole.lengthSq() < 1e-8) pole.set(0, 0, 1).addScaledVector(axis, -axis.z);
    pole.normalize();
    const preference = this.preference.copy(preferredFore).normalize().negate();
    preference.addScaledVector(axis, -preference.dot(axis));
    // The projection points to the elbow on the reach circle that best
    // preserves the bounded wrist orientation. Use the anatomical pole only
    // for an axial target, where the forearm gives no bend-plane information.
    if (preference.lengthSq() > 1e-10) pole.copy(preference).normalize();
    const place = (poleDirection: Vector3) => {
      this.upper.copy(axis).multiplyScalar(along).addScaledVector(poleDirection, height);
      this.fore.copy(axis).multiplyScalar(reach).sub(this.upper);
      this.back.copy(this.fore).multiplyScalar(-1 / foreLength);
      return !wrist || (this.back.dot(wrist.neutral) >= minForward - 1e-7
        && this.back.dot(wrist.radial) >= -WRIST_RADIAL_SIN - 1e-7 && this.back.dot(wrist.radial) <= WRIST_ULNAR_SIN + 1e-7);
    };
    const reachable = Math.abs(distance - reach) < 1e-7;
    const valid = place(pole);
    if (valid || !wrist || height < 1e-9) return reachable && valid;
    // On the elbow circle each wrist plane intersects in at most two points.
    // Among admissible intersections choose the smallest swing from the desired
    // forearm. This lets the elbow move before asking the torso to translate.
    const tangent = this.tangent.crossVectors(axis, pole).normalize();
    let best = Infinity;
    const intersect = (normal: Vector3, bound: number) => {
      const x = height * pole.dot(normal), y = height * tangent.dot(normal);
      const radius = Math.hypot(x, y);
      const offset = bound * foreLength - (along - reach) * axis.dot(normal);
      if (radius < 1e-10 || Math.abs(offset) > radius + 1e-7 * foreLength) return;
      const center = Math.atan2(y, x), angle = Math.acos(MathUtils.clamp(offset / radius, -1, 1));
      for (const theta of [center - angle, center + angle]) {
        const distance = Math.abs(Math.atan2(Math.sin(theta), Math.cos(theta)));
        if (distance >= Math.abs(best)) continue;
        this.candidate.copy(pole).multiplyScalar(Math.cos(theta)).addScaledVector(tangent, Math.sin(theta));
        if (place(this.candidate)) best = Math.atan2(Math.sin(theta), Math.cos(theta));
      }
    };
    intersect(wrist.neutral, minForward);
    intersect(wrist.radial, -WRIST_RADIAL_SIN);
    intersect(wrist.radial, WRIST_ULNAR_SIN);
    if (!Number.isFinite(best)) { place(pole); return false; }
    place(this.candidate.copy(pole).multiplyScalar(Math.cos(best)).addScaledVector(tangent, Math.sin(best)));
    return reachable;
  }
}
