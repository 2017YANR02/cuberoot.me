import {
  applyOrientation, calibrate, mirrorForBrand, quatInverse, quatLength, quatMul, sensorBasisForBrand, type Quat,
} from '@cuberoot/shared/smart-cube/orientation';
import { notationQuaternion } from '@cuberoot/shared/timer/reconstruct/gyro-orient';
import { PRACTICE_GRIP } from '../practice-smart-cube';

type RotationStep = { pose: string; rotation: string };
type Sample = { quat: Quat; at: number };

const START_SAMPLE_MAX_AGE_MS = 600;
const CALIBRATION_SAMPLE_MAX_AGE_MS = 1500;
const MAX_SAMPLE_GAP_MS = 150;
const MIN_HOLD_SAMPLE_SPAN_MS = 50;
const HOLD_MS = 140;
const MAX_HEADING_ERROR = 25 * Math.PI / 180;
const MIN_UP_ALIGNMENT = 0.5;
const HOLD_HEADING_TOLERANCE = 6 * Math.PI / 180;
const START_GRIP = notationQuaternion(PRACTICE_GRIP);
const INVERSE_START_GRIP = quatInverse(START_GRIP);

/** Keeps BLE samples off the render path. A settled target is reported once per step. */
export class LessonRotationTracker {
  readonly liveOrientation: { current: Quat | null } = { current: null };
  private latest?: Sample;
  private reference?: Quat;
  private displayReference?: Quat;
  private manuallyCalibrated = false;
  private pending?: { step: RotationStep; inverseTarget: Quat; hold?: { heading: number; at: number }; confirmed: boolean };

  start(at: number) {
    this.pending = undefined;
    if (this.manuallyCalibrated) return;
    const sample = this.latest;
    this.setReference(sample && at - sample.at <= START_SAMPLE_MAX_AGE_MS ? sample.quat : undefined);
  }

  calibrateGrip(at: number): boolean {
    const sample = this.latest;
    if (!sample || at - sample.at > CALIBRATION_SAMPLE_MAX_AGE_MS) return false;
    this.manuallyCalibrated = true;
    this.setReference(sample.quat);
    return true;
  }

  reset() {
    this.latest = undefined;
    this.manuallyCalibrated = false;
    this.setReference(undefined);
  }

  private setReference(raw?: Quat) {
    this.reference = raw ? calibrate(raw) : undefined;
    this.displayReference = this.reference;
    this.liveOrientation.current = this.reference ? START_GRIP : null;
    this.pending = undefined;
  }

  observe(quat: Quat, at: number, step: RotationStep | undefined, brand: string | undefined): boolean {
    const norm = quatLength(quat);
    if (!Number.isFinite(norm) || norm < 0.5 || norm > 1.5) {
      this.latest = undefined;
      if (this.pending) this.pending.hold = undefined;
      return false;
    }
    const gap = this.latest ? at - this.latest.at : Infinity;
    this.latest = { quat, at };
    this.displayReference ??= calibrate(quat);
    const relative = applyOrientation(quat, this.displayReference, { basis: sensorBasisForBrand(brand), mirror: mirrorForBrand(brand) });
    this.liveOrientation.current = quatMul(START_GRIP, relative);
    if (!this.reference || !step || !/^y[2']?$/.test(step.rotation)) {
      this.pending = undefined;
      return false;
    }

    if (this.pending?.step !== step) {
      // The sensor reports body-frame motion from the yellow-up starting grip.
      const target = quatMul(INVERSE_START_GRIP, notationQuaternion(step.pose));
      this.pending = { step, inverseTarget: quatInverse(target), confirmed: false };
    }
    const pending = this.pending;
    if (pending.confirmed) return false;
    // Compare the target front center's horizontal bearing. A twist angle can
    // change under combined hand tilt even when that center stays in front.
    const { w, x, y, z } = quatMul(relative, pending.inverseTarget);
    const upAlignment = 1 - 2 * (x * x + z * z);
    const frontX = 2 * (x * z + w * y);
    const frontZ = 1 - 2 * (x * x + y * y);
    const heading = Math.atan2(frontX, frontZ);
    if (upAlignment < MIN_UP_ALIGNMENT || Math.abs(heading) > MAX_HEADING_ERROR) {
      pending.hold = undefined;
      return false;
    }
    if (!pending.hold || gap > MAX_SAMPLE_GAP_MS || Math.abs(heading - pending.hold.heading) > HOLD_HEADING_TOLERANCE) {
      pending.hold = { heading, at };
    }
    return this.confirm(step, at);
  }

  confirmationAt(step: RotationStep | undefined): number | undefined {
    const { pending, latest } = this;
    if (!step || pending?.step !== step || pending.confirmed || !pending.hold || !latest) return undefined;
    // A single in-range packet can be part of a turn passing through the target.
    if (latest.at - pending.hold.at < MIN_HOLD_SAMPLE_SPAN_MS) return undefined;
    return pending.hold.at + HOLD_MS;
  }

  confirm(step: RotationStep | undefined, at: number): boolean {
    const deadline = this.confirmationAt(step);
    if (deadline === undefined || at < deadline || !this.pending) return false;
    this.pending.confirmed = true;
    return true;
  }
}
