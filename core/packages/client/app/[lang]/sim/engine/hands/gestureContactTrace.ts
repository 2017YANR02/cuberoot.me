// Optional calibration observer. It samples displayed frames and never feeds
// the measured pose back into playback.
import * as THREE from 'three';
import { SIZE } from '@cuberoot/puzzle-render-core/engine/define';
import CubeGroup from '@cuberoot/puzzle-render-core/engine/nxn/group';
import type Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import type { HandDiagnosticFrame, HandSide } from './handsRig';
import type { FingerName, HandModel } from './handModel';
import { isMiddleSliceStroke, M_SINGLE, FOUR_INNER_ROLL } from './middleSliceMotion';
import { FingerSurfaceSampler } from './fingerCollision';
import { contactAnchor, measureIndexContact, measureMaterialSlip, readDiagnosticPieces, type MaterialAnchor } from './uContactGeometry';

interface Participant {
  hand: HandSide;
  finger: FingerName;
  surface: 'pad' | 'nail';
  role: 'active' | 'support';
}
function participants(frame: HandDiagnosticFrame, order: number): Participant[] {
  const active = frame.active, g = active?.gesture;
  if (!active || !g) return [];
  const support = frame.wideSupport;
  const stable: Participant[] = support ? support.fingers.map(finger => ({
    hand: support.hand, finger, surface: 'pad', role: 'support',
  })) : [];
  if (g.kind === 'weld') return stable;
  const marked = frame.marked;
  const hand = g.hand;
  const angle = Math.abs(active.angle);
  const middleRelay = g.style === 'middleSlicePad' && g.finger2 === 'pinky';
  const secondQuarter = middleRelay ? angle >= Math.PI / 2 : angle > Math.PI / 2;
  if (order === 3 && !marked && isMiddleSliceStroke(g.style) && !middleRelay) {
    const degrees = THREE.MathUtils.radToDeg(angle);
    if (degrees > M_SINGLE.release + 1e-7) return stable;
    const surface = degrees + 1e-7 >= M_SINGLE.nail ? 'nail' : 'pad';
    const ring: Participant = { hand, finger: g.finger, surface, role: 'active' };
    if (degrees > M_SINGLE.rollStart && degrees + 1e-7 < M_SINGLE.nail)
      return [ring, { ...ring, surface: 'nail' }, ...stable];
    return [ring, ...stable];
  }
  const finger = secondQuarter && g.finger2 ? g.finger2 : g.finger;
  const rollingIndex = !marked && active.cls === 'high' && (active.axis === 'z' || active.axis === 'y')
    && g.finger === 'index' && (g.style === 'topPush' || g.style === 'downPush' || g.style === 'indexHook');
  if (rollingIndex && secondQuarter && !g.finger2) return [];
  const handoff = THREE.MathUtils.degToRad(g.style === 'indexHook' ? 65 : 60);
  const surface = marked?.contact ?? (g.style === 'middleSliceNail' || g.style === 'sliceNail' || rollingIndex && !secondQuarter && angle >= handoff ? 'nail' : 'pad');
  const rollingRing = !marked && g.style === 'middleSlicePad' && !middleRelay;
  const degrees = THREE.MathUtils.radToDeg(angle);
  const afterRoll = rollingRing && degrees >= FOUR_INNER_ROLL.endDegrees;
  const list: Participant[] = [{ hand, finger, surface: afterRoll ? 'nail' : surface, role: 'active' }, ...stable];
  if (rollingRing && !afterRoll && degrees > FOUR_INNER_ROLL.startDegrees)
    list.push({ hand, finger, surface: 'nail', role: 'active' });
  if (middleRelay) list.push({ hand, finger: 'thumb', surface: 'pad', role: 'support' },
    { hand, finger: 'index', surface: 'pad', role: 'support' });
  if (marked?.finger === 'middle') {
    list.push({hand, finger: 'thumb', surface: 'pad', role: 'support'}, {hand, finger: 'ring', surface: 'pad', role: 'support'});
    const other = hand === 'R' ? 'L' : 'R';
    const supportGrip = frame.grips[other];
    if (!stable.length && active.axis === 'y' && active.cls === 'high' && (supportGrip === 'half' || supportGrip === 'halfDown')) {
      list.push({ hand: other, finger: 'thumb', surface: 'pad', role: 'support' },
        { hand: other, finger: 'middle', surface: 'pad', role: 'support' });
    }
  } else if (active.axis === 'y' && active.cls === 'low') {
    for (const side of ['L','R'] as const) list.push({hand: side, finger: 'thumb', surface: 'pad', role: 'support'});
  }
  return list;
}

export function nailPoints(model: HandModel, finger: FingerName, toCube: THREE.Matrix4, includeFreeEdge = false) {
  const mesh = model.nailMeshes?.find(m => m.userData.nail?.finger === finger);
  if (!mesh) return [];
  mesh.updateWorldMatrix(true, false);
  const positions = mesh.geometry.getAttribute('position'), normals = mesh.geometry.getAttribute('normal');
  const matrix = toCube.clone().multiply(mesh.matrixWorld);
  const freeEdgeStart = mesh.geometry.userData.freeEdgeVertexStart ?? Infinity;
  const plateCount = mesh.geometry.userData.nailPlateVertexCount ?? 0;
  return Array.from({length: positions.count}, (_, vertex) => ({vertex: -1 - vertex,
    pad: normals.getZ(vertex) < -.5 || (includeFreeEdge && (vertex < plateCount || vertex >= freeEdgeStart)),
    point: new THREE.Vector3().fromBufferAttribute(positions, vertex).applyMatrix4(matrix)}));
}

export class GestureContactTrace {
  private readonly samplers = new WeakMap<HandModel, FingerSurfaceSampler>();
  private readonly anchors = new Map<string, MaterialAnchor>();
  private gesture: HandDiagnosticFrame['preparedGesture'] | null = null;
  private bucket = -1;
  private readonly samples: ReturnType<GestureContactTrace['sample']>[] = [];

  reset(): void { this.gesture = null; this.bucket = -1; this.anchors.clear(); }
  clear(): void { this.reset(); this.samples.length = 0; }
  read() { return this.samples; }

  observe(frame: HandDiagnosticFrame, cube: Cube): void {
    if (frame.event !== 'frame') return;
    const active = frame.active;
    if (!active?.gesture || (active.gesture.kind !== 'flick' && !frame.wideSupport)) { this.reset(); return; }
    if (this.gesture !== active.gesture) { this.reset(); this.gesture = active.gesture; }
    const degrees = THREE.MathUtils.radToDeg(Math.abs(active.angle)) + 1e-7;
    const singleM = cube.order === 3 && active.gesture.kind === 'flick' && !frame.marked
      && isMiddleSliceStroke(active.gesture.style) && !active.gesture.finger2;
    // Sample the short nail stroke between the usual 15° snapshots.
    const bucket = singleM && degrees >= M_SINGLE.rollStart && degrees <= M_SINGLE.release + 1
      ? 100 + Math.floor(degrees) : Math.floor(degrees / 15);
    if (bucket === this.bucket) return;
    this.bucket = bucket;
    const pieces = readDiagnosticPieces(cube);
    cube.updateWorldMatrix(true, false);
    const toCube = cube.matrixWorld.clone().invert();
    for (const participant of participants(frame, cube.order)) {
      const sample = this.sample(frame, participant, pieces, toCube, 32 * (1 - cube.instancedRenderer.stickerGap), cube.order);
      this.samples.push(sample);
      if (this.samples.length > 600) this.samples.shift();
    }
  }

  private sample(frame: HandDiagnosticFrame, p: Participant, pieces: ReturnType<typeof readDiagnosticPieces>, toCube: THREE.Matrix4, half: number, order: number) {
    const model = frame.models[p.hand];
    const active = frame.active!, g = active.gesture;
    const slidingRing = order === 3 && g?.kind === 'flick' && g.style === 'middleSliceNail' && !g.finger2;
    let points;
    if (p.surface === 'nail') points = nailPoints(model, p.finger, toCube, slidingRing);
    else {
      let sampler = this.samplers.get(model);
      if (!sampler) { sampler = new FingerSurfaceSampler(model); this.samplers.set(model, sampler); }
      points = sampler.samplePoints(p.finger);
      for (const value of points) value.point.applyMatrix4(toCube);
    }
    const measurement = measureIndexContact(points, pieces, half);
    const key = p.hand + p.finger + p.surface;
    let anchor = this.anchors.get(key);
    if (!anchor || (slidingRing && measurement.contacts.length && !measurement.contacts.some(c => c.stickerId === anchor!.stickerId))) {
      // The nail gets its own witness vertex on the sticker established by the pad.
      const pad = !frame.marked && p.surface === 'nail' ? this.anchors.get(p.hand + p.finger + 'pad') : undefined;
      let contacts = measurement.contacts;
      if (pad && !slidingRing) {
        contacts = contacts.filter(c => c.stickerId === pad.stickerId);
      } else if (p.role === 'active' && p.finger === 'ring' && g?.kind === 'flick'
        && (g.style === 'middleSliceNail' || g.style === 'middleSlicePad')) {
        // D7 and B7 start on the same edge. The first displayed frame can
        // already be oblique, with a neighbouring outer sticker under the pad.
        const axis = CubeGroup.AXIS_VECTOR.x;
        const center = new THREE.Vector3(0, -SIZE, -SIZE).applyAxisAngle(axis, active.angle);
        const normal = (g.style === 'middleSliceNail' ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(0, 0, -1))
          .applyAxisAngle(axis, active.angle);
        const position = new THREE.Vector3();
        const middle = new THREE.Vector3(0, -SIZE, 0).applyAxisAngle(axis, active.angle);
        const targetPieces = pieces.filter(piece => {
          position.setFromMatrixPosition(piece.matrix);
          return position.distanceToSquared(center) < .001 || (slidingRing && position.distanceToSquared(middle) < .001);
        });
        contacts = contacts.filter(c => targetPieces.some(piece => piece.initial === c.pieceInitial)
          && position.fromArray(c.normalCube).dot(normal) > .999);
      }
      const first = contactAnchor({ ...measurement, contacts, nearest: null });
      if (first?.startedInContact) {
        anchor = first;
        this.anchors.set(key, anchor);
      }
    }
    return { ...p, atMs: frame.atMs, phase: frame.hands[p.hand].phase, axis: frame.active!.axis,
      layer: frame.active!.cls, angle: frame.active!.angle, profile: frame.marked?.profile,
      anchor, contacts: measurement.contacts.map(c => c.stickerId), penetration: measurement.penetration.depthU,
      slip: measureMaterialSlip(anchor ?? null, points, pieces, measurement, half) };
  }
}
