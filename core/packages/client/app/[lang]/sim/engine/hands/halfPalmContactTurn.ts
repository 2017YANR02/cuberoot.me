import * as THREE from 'three';
import { SIZE } from '../define';
import type { FingerName } from './handModel';

const NAMES: FingerName[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];

/** Roll a resting pad in its contact plane, about its existing contact witness.
 * Uses the aligned 3x3 grip envelope, not recorder state or rendered diagnostics.
 * The turn fades in at the end of the upward half-grip route. */
export class HalfPalmContactTurn {
  private readonly anchors = Object.fromEntries(NAMES.map(name => [name, {
    point: new THREE.Vector3(), rotation: new THREE.Quaternion(), axis: 2, distance: Infinity,
  }])) as Record<FingerName, { point: THREE.Vector3; rotation: THREE.Quaternion; axis: number; distance: number }>;
  private readonly toRig = new THREE.Matrix4();
  private readonly fromRig = new THREE.Matrix4();
  private readonly local = new THREE.Vector3();
  private readonly normal = new THREE.Vector3();

  begin(parent: THREE.Object3D | null): void {
    if (parent) this.fromRig.copy(parent.matrixWorld); else this.fromRig.identity();
    this.toRig.copy(this.fromRig).invert();
    for (const anchor of Object.values(this.anchors)) anchor.distance = Infinity;
  }

  consider(name: FingerName, point: THREE.Vector3): void {
    this.local.copy(point).applyMatrix4(this.toRig);
    const anchor = this.anchors[name];
    const { x, y, z } = this.local;
    const tx = stickerEdgeDistanceSq(x), ty = stickerEdgeDistanceSq(y), tz = stickerEdgeDistanceSq(z);
    // Opposite faces have the same tangential bounds. Only the nearer
    // plane on each axis can improve the witness, including at sign ties.
    const half = SIZE * 1.5;
    const dx = (Math.abs(x) - half) ** 2 + ty + tz;
    const dy = (Math.abs(y) - half) ** 2 + tx + tz;
    const dz = (Math.abs(z) - half) ** 2 + tx + ty;
    const distance = Math.min(dx, dy, dz);
    if (distance < anchor.distance) {
      anchor.distance = distance;
      anchor.axis = distance === dx ? 0 : distance === dy ? 1 : 2;
      anchor.point.copy(point);
    }
  }

  finish(angle: number, mirror: number): void {
    for (const [name, anchor] of Object.entries(this.anchors)) {
      // The thumb retains its opposing grip. Taper the turn down the finger
      // fan so the short little finger does not take the index's full swivel.
      const fan = name === 'thumb' ? 0 : name === 'ring' ? .75 : name === 'pinky' ? .45 : 1;
      // The grip envelope provides a swivel axis only near a sticker. Fade
      // out in free space, where the closest sticker can change abruptly.
      const contact = 1 - THREE.MathUtils.smoothstep(Math.sqrt(anchor.distance), 6, 24);
      this.normal.set(0, 0, 0).setComponent(anchor.axis, 1).transformDirection(this.fromRig);
      anchor.rotation.setFromAxisAngle(this.normal, angle * fan * contact * (anchor.axis === 0 ? 1 : mirror));
    }
  }

  transform(name: FingerName, position: THREE.Vector3, quaternion?: THREE.Quaternion): void {
    const anchor = this.anchors[name];
    position.sub(anchor.point).applyQuaternion(anchor.rotation).add(anchor.point);
    quaternion?.premultiply(anchor.rotation);
  }
}

function stickerEdgeDistanceSq(value: number): number {
  const center = THREE.MathUtils.clamp(Math.round(value / SIZE), -1, 1) * SIZE;
  return Math.max(0, Math.abs(value - center) - 28) ** 2;
}
