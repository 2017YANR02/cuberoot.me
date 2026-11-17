import * as THREE from 'three';
import type Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import type HandsRig from './handsRig';
import type { HandDiagnosticFrame } from './handsRig';
import { IndexSkinSampler, contactAnchor, measureIndexContact, measureMaterialSlip, readDiagnosticPieces,
  type MaterialAnchor } from './uContactGeometry';

type Checkpoint = 'start' | '45deg' | '90deg' | 'after-return';
function pose(frame: HandDiagnosticFrame) {
  // Copy scalar data only. No Three objects or live model references escape in logs.
  return { atMs: frame.atMs, event: frame.event,
    gripRequest: frame.gripRequest ? { ...frame.gripRequest, sides: [...frame.gripRequest.sides] } : null,
    preparedGesture: frame.preparedGesture ? structuredClone(frame.preparedGesture) : null,
    grips: frame.grips, hands: frame.hands,
    active: frame.active ? { ...frame.active, gesture: frame.active.gesture ? { ...frame.active.gesture } : null } : null };
}
type Pose = ReturnType<typeof pose>;
interface CheckpointRecord {
  checkpoint: Checkpoint;
  targetAngleDeg: number;
  cubeAngleDeg: number;
  handDriverAngleDeg: number;
  cubeAngleErrorDeg: number;
  sampling: 'observed-frame';
  pose: Pose;
  measurement: ReturnType<typeof measureIndexContact>;
  slip: ReturnType<typeof measureMaterialSlip>;
  measurementMs: number;
}
interface URecord {
  id: number;
  action: 'U';
  status: 'prepared' | 'turning' | 'returning' | 'complete' | 'interrupted';
  reason?: string;
  startedAtMs: number;
  startGrips: HandDiagnosticFrame['grips'];
  preparedGesture: Pose['preparedGesture'];
  checkpoints: Partial<Record<Checkpoint, CheckpointRecord>>;
  frames: Pose[];
  droppedFrames: number;
  maxFrameGapMs: number;
  missingCheckpoints: Checkpoint[];
}

export interface URecorderApi {
  start(): void;
  stop(): void;
  clear(): void;
  read(): ReturnType<UContactRecorder['read']>;
  json(): string;
}

/** Dev-only, opt-in observer. It never seeks, freezes, reposes, or advances the animation. */
export class UContactRecorder {
  private enabled = false;
  private rig: HandsRig | null = null;
  private unsubscribe: (() => void) | null = null;
  private records: URecord[] = [];
  private stateFrames: Pose[] = [];
  private gripEvents: Pose[] = [];
  private droppedStateFrames = 0;
  private droppedGripEvents = 0;
  private lastGripState: string | null = null;
  private nextId = 1;
  private active: { record: URecord; cube: Cube; skin: IndexSkinSampler; anchor: MaterialAnchor | null;
    probeInitial: number; startInverse: THREE.Matrix4; lastAngle: number; lastAt: number } | null = null;
  private error: string | null = null;

  constructor(private getCube: () => Cube | null) {}

  readonly api: URecorderApi = {
    start: () => this.start(), stop: () => this.stop(), clear: () => this.clear(),
    read: () => this.read(), json: () => JSON.stringify(this.read(), null, 2),
  };

  bind(rig: HandsRig): void {
    this.interrupt('hand-model-replaced');
    this.unsubscribe?.();
    this.rig = rig;
    this.lastGripState = null;
    this.subscribe();
  }
  private subscribe(): void {
    this.unsubscribe = this.enabled && this.rig ? this.rig.subscribeDiagnostics(frame => {
      try { this.observe(frame); } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
        this.interrupt('measurement-error');
        this.enabled = false;
        this.unsubscribe?.();
        this.unsubscribe = null;
      }
    }) : null;
  }
  start(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.error = null;
    this.lastGripState = null;
    this.subscribe();
  }
  stop(): void {
    this.interrupt('recording-stopped');
    this.enabled = false;
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
  clear(): void {
    this.active = null; this.records = []; this.error = null;
    this.stateFrames = []; this.gripEvents = []; this.lastGripState = null;
    this.droppedStateFrames = 0; this.droppedGripEvents = 0;
  }
  dispose(): void { this.stop(); this.rig = null; }

  read() {
    return structuredClone({
      version: 3, enabled: this.enabled, ready: this.rig?.getLoadState().hands === 'ready', error: this.error,
      scope: 'all observed hand grip states; 3x3 prepared single right-index U contact checkpoints in every grip, including home/up/down/half combinations; no drag, U2, U-prime, push or pin',
      gestureMeaning: 'preparedGesture is the existing selected motion, not a calibration verdict; both-home U uses hook, other grips currently use the existing unstyled sweep',
      gripStateMeaning: 'home/up/down/half or null for unclassified orientation; grips are logical bases/targets, not proof of arrival; inspect hands.phase and actual root transforms. grip-request/grip-set transforms still describe the last applied pose until the next frame',
      units: 'cube-local units (cubie pitch 64)',
      geometry: 'ideal 64-unit cubie boxes and nominal sticker rectangles; excludes sticker thickness, rounded corners and visible-material details',
      skin: 'all dominant-index vertices for penetration; distal palmar-half vertices for contact (pad proxy)',
      contactBandU: [0, 2.5],
      sampling: 'actual frames only; 45deg is the first observed crossing, 90deg uses committed cube plus the last displayed hand pose; inspect both angles',
      coverage: 'checkpoint geometry only, not continuous collision verification; slip is net fixed-skin-point displacement, not accumulated frictional slip',
      limits: { records: 20, framesPerRecord: 600, stateFrames: 1200, gripEvents: 200 },
      stateFrames: this.stateFrames, gripEvents: this.gripEvents,
      droppedStateFrames: this.droppedStateFrames, droppedGripEvents: this.droppedGripEvents,
      records: this.records,
    });
  }

  private interrupt(reason: string): void {
    if (!this.active) return;
    this.active.record.status = 'interrupted';
    this.active.record.reason = reason;
    this.finish();
  }
  private finish(): void {
    if (!this.active) return;
    this.active.record.missingCheckpoints = (['start', '45deg', '90deg', 'after-return'] as const)
      .filter(k => !this.active!.record.checkpoints[k]);
    this.active = null;
  }

  private angle(cube: Cube): number {
    const a = this.active!;
    const matrix = cube.instancedRenderer.getCubeletRenderMatrix(a.probeInitial, new THREE.Matrix4());
    if (!matrix) throw new Error('Tracked top-layer cubie is missing');
    matrix.multiply(a.startInverse);
    // U rotates about -Y. A tracked cubie's transform includes both tween and committed orientation.
    return Math.atan2(matrix.elements[2], matrix.elements[0]) * 180 / Math.PI;
  }

  private capture(checkpoint: Checkpoint, angle: number, frame: HandDiagnosticFrame): void {
    const a = this.active!;
    const began = performance.now();
    const pieces = readDiagnosticPieces(a.cube), points = a.skin.sample(a.cube);
    if (!points.some(p => p.pad)) throw new Error('No distal palmar index vertices available');
    const measurement = measureIndexContact(points, pieces, 32 * (1 - a.cube.instancedRenderer.stickerGap));
    if (checkpoint === 'start') a.anchor = contactAnchor(measurement);
    const target = checkpoint === 'start' ? 0 : checkpoint === '45deg' ? 45 : 90;
    a.record.checkpoints[checkpoint] = {
      checkpoint, targetAngleDeg: target, cubeAngleDeg: angle,
      handDriverAngleDeg: frame.hands.R.flickAngle * 180 / Math.PI,
      cubeAngleErrorDeg: angle - target, sampling: 'observed-frame', pose: pose(frame), measurement,
      slip: measureMaterialSlip(a.anchor, points, pieces, measurement, 32 * (1 - a.cube.instancedRenderer.stickerGap)),
      measurementMs: performance.now() - began,
    };
  }

  private observe(frame: HandDiagnosticFrame): void {
    // Grip observation is independent of the U contact experiment (and of skinned asset geometry).
    const snapshot = pose(frame);
    this.stateFrames.push(snapshot);
    if (this.stateFrames.length > 1200) { this.stateFrames.shift(); this.droppedStateFrames++; }
    const state = JSON.stringify([frame.grips.R, frame.grips.L, frame.hands.R.phase, frame.hands.L.phase]);
    if (state !== this.lastGripState || frame.event !== 'frame') {
      this.gripEvents.push(snapshot);
      if (this.gripEvents.length > 200) { this.gripEvents.shift(); this.droppedGripEvents++; }
    }
    this.lastGripState = state;
    if (frame.event === 'grip-request' || frame.event === 'grip-set') {
      this.interrupt('grip-changed'); return;
    }
    if (['reset', 'disabled', 'dispose'].includes(frame.event)) { this.interrupt(frame.event); return; }
    const cube = this.getCube();
    if (!cube || cube.order !== 3) { this.interrupt('puzzle-changed'); return; }
    if (frame.event === 'prepare-u') {
      this.interrupt('new-action-before-return');
      const probe = cube.cubelets.get(8); // Current UBR slot, regardless of scramble / original identity.
      if (!probe) throw new Error('No cubie in UBR slot');
      const matrix = cube.instancedRenderer.getCubeletRenderMatrix(probe.initial, new THREE.Matrix4());
      if (!matrix) throw new Error('No render matrix for UBR cubie');
      const record: URecord = { id: this.nextId++, action: 'U', status: 'prepared', startedAtMs: frame.atMs,
        startGrips: { ...frame.grips }, preparedGesture: snapshot.preparedGesture,
        checkpoints: {}, frames: [snapshot], droppedFrames: 0,
        maxFrameGapMs: 0, missingCheckpoints: [] };
      this.records.push(record);
      if (this.records.length > 20) this.records.shift();
      this.active = { record, cube, skin: new IndexSkinSampler(frame.models.R), anchor: null,
        probeInitial: probe.initial, startInverse: matrix.invert(), lastAngle: 0, lastAt: frame.atMs };
      this.capture('start', 0, frame);
      return;
    }
    const a = this.active;
    if (!a) return;
    if (a.cube !== cube) { this.interrupt('puzzle-changed'); return; }
    const record = a.record;
    if (frame.event === 'frame') {
      record.maxFrameGapMs = Math.max(record.maxFrameGapMs, frame.atMs - a.lastAt);
      a.lastAt = frame.atMs;
      if (record.frames.length < 600) record.frames.push(pose(frame)); else record.droppedFrames++;
    }
    if (frame.atMs - record.startedAtMs > 30_000) { this.interrupt('observation-timeout'); return; }
    const angle = this.angle(cube);
    const otherLayer = Object.entries(cube.table.groups).some(([axis, layers]) => layers.some((g, i) =>
      (axis !== 'y' || i !== 2) && Math.abs(g.angle) > 1e-8));
    if (otherLayer || angle < -1e-4 || angle > 90.001 || angle < a.lastAngle - 0.01) {
      this.interrupt('turn-reversed-or-other-move'); return;
    }
    if (frame.event === 'end-u') {
      if (Math.abs(angle - 90) > 0.001) { this.interrupt('turn-ended-without-quarter-turn'); return; }
      this.capture('90deg', angle, frame);
      record.status = 'returning';
    } else if (frame.event === 'frame') {
      if (angle > 0 && record.status === 'prepared') record.status = 'turning';
      if (record.status === 'turning' && angle >= 45 && angle < 90 && !record.checkpoints['45deg']) {
        this.capture('45deg', angle, frame);
      }
      if (record.status === 'returning' && frame.hands.R.phase === 'stable') {
        this.capture('after-return', angle, frame);
        record.status = 'complete';
        this.finish();
      }
    }
    a.lastAngle = angle;
  }
}

declare global { interface Window { __simHandRecorder?: URecorderApi } }
