// Optional calibration observer. It samples displayed frames and never feeds
// the measured pose back into playback.
import * as THREE from 'three';
import { SIZE } from '@cuberoot/puzzle-render-core/engine/define';
import CubeGroup from '@cuberoot/puzzle-render-core/engine/nxn/group';
import type Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import type { HandDiagnosticFrame, HandSide } from './handsRig';
import type { FingerName, HandModel } from './handModel';
import { isSliceNail, SLICE_NAIL_CONTACT_END } from './mixedGripPush';
import { isMiddleSliceStroke, MARKED_M_RELEASE, M_SINGLE, FOUR_INNER_ROLL } from './middleSliceMotion';
import { fingerBearing, strokeTangent } from './strokeGeometry';
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
  if (order !== 3) {
    const relay = Math.abs(active.angle) >= Math.PI / 2;
    const finger = relay && g.finger2 ? g.finger2 : g.finger;
    const other = g.hand === 'R' ? 'L' : 'R';
    const support: Participant[] = stable.length ? stable : (['thumb', 'index', 'middle', 'ring', 'pinky'] as const)
      .map(finger => ({ hand: other, finger, surface: 'pad', role: 'support' }));
    const digits = g.finger2 && Math.abs(Math.abs(active.angle) - Math.PI / 2) <= Math.PI / 12
      ? [g.finger, g.finger2] : [finger];
    return [...digits.flatMap(name => (['pad', 'nail'] as const).map(surface => ({
      hand: g.hand, finger: name, surface, role: 'active' as const,
    }))), ...support];
  }
  const marked = frame.marked;
  const hand = g.hand;
  const angle = Math.abs(active.angle);
  const middleRelay = g.style === 'middleSlicePad' && g.finger2 === 'pinky';
  const secondQuarter = middleRelay ? angle >= Math.PI / 2 : angle > Math.PI / 2;
  if (g.style === 'upperRingRelay') {
    const degrees = THREE.MathUtils.radToDeg(angle);
    const first: Participant = { hand, finger: 'index', surface: 'nail', role: 'active' };
    const second: Participant = { hand, finger: 'ring', surface: 'nail', role: 'active' };
    if (Math.abs(degrees - 90) < 1e-6) return [first, second, ...stable];
    return [degrees < 90 ? first : second, ...stable];
  }
  if (g.style === 'upPush') {
    const degrees = THREE.MathUtils.radToDeg(angle);
    const contact: Participant = { hand, finger: 'index', surface: degrees < 60 ? 'nail' : 'pad', role: 'active' };
    return degrees > 45 && degrees < 60 ? [contact, { ...contact, surface: 'pad' }, ...stable] : [contact, ...stable];
  }
  if (order === 3 && !marked && isMiddleSliceStroke(g.style) && !middleRelay) {
    const degrees = THREE.MathUtils.radToDeg(angle);
    if (g.style === 'markedRingNail') {
      return degrees <= MARKED_M_RELEASE + 1e-7 ? [{ hand, finger: 'ring', surface: 'nail', role: 'active' }, ...stable] : stable;
    }
    if (degrees > M_SINGLE.release + 1e-7) return stable;
    const surface = degrees + 1e-7 >= M_SINGLE.nail ? 'nail' : 'pad';
    const ring: Participant = { hand, finger: g.finger, surface, role: 'active' };
    if (degrees > M_SINGLE.rollStart && degrees + 1e-7 < M_SINGLE.nail)
      return [ring, { ...ring, surface: 'nail' }, ...stable];
    return [ring, ...stable];
  }
  if (order === 3 && isSliceNail(g.style)) {
    const degrees = THREE.MathUtils.radToDeg(angle);
    const start = g.style === 'sliceNailDouble' && degrees >= 90 - 1e-7 ? 90 : 0;
    if (degrees - start > SLICE_NAIL_CONTACT_END + 1e-7) return stable;
  }
  const finger = secondQuarter && g.finger2 ? g.finger2 : g.finger;
  const rollingIndex = !marked && active.cls === 'high' && (active.axis === 'z' || active.axis === 'y')
    && g.finger === 'index' && (g.style === 'topPush' || g.style === 'downPush' || g.style === 'indexHook');
  if (rollingIndex && secondQuarter && !g.finger2) return [];
  const handoff = THREE.MathUtils.degToRad(g.style === 'indexHook' ? 65 : 60);
  const surface = marked?.contact ?? (g.style === 'frontIndexNail' || g.style === 'frontThumbNail' || g.style === 'middleSliceNail' || isSliceNail(g.style) || rollingIndex && !secondQuarter && angle >= handoff ? 'nail' : 'pad');
  const rollingRing = !marked && g.style === 'middleSlicePad' && !middleRelay;
  const degrees = THREE.MathUtils.radToDeg(angle);
  const afterRoll = rollingRing && degrees >= FOUR_INNER_ROLL.endDegrees;
  const list: Participant[] = [{ hand, finger, surface: afterRoll ? 'nail' : surface, role: 'active' }, ...stable];
  // Lower hooks can bear on the free nail edge. Sample both surfaces so
  // the witness, rather than the finger label, determines which one drove.
  if (order === 3 && !marked && g.style === 'lowerHook')
    list.push({ hand, finger, surface: 'nail', role: 'active' });
  if (order === 3 && active.axis === 'y' && g.style === 'downPush' && g.finger2 === 'middle'
    && Math.abs(degrees - 90) < 1e-6) {
    list.push(secondQuarter
      ? { hand, finger: 'index', surface: 'nail', role: 'active' }
      : { hand, finger: 'middle', surface: 'pad', role: 'active' });
  }
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
    const markedRing = active.gesture.kind === 'flick' && active.gesture.style === 'markedRingNail';
    const bucket = markedRing ? Math.floor(degrees) : cube.order !== 3 && active.gesture.kind === 'flick' && active.cls === 'mid' ? Math.floor(degrees / 5) : singleM && degrees >= M_SINGLE.rollStart && degrees <= M_SINGLE.release + 1
      ? 100 + Math.floor(degrees) : Math.floor(degrees / 15);
    if (bucket === this.bucket) return;
    this.bucket = bucket;
    const pieces = readDiagnosticPieces(cube);
    cube.updateWorldMatrix(true, false);
    const toCube = cube.matrixWorld.clone().invert();
    const moving = new Set(active.layers.flatMap(layer =>
      cube.table.groups[active.axis][layer].cubelets.map(piece => piece.initial)));
    for (const participant of participants(frame, cube.order)) {
      const sample = this.sample(frame, participant, pieces, moving, toCube, 32 * (1 - cube.instancedRenderer.stickerGap), cube.order);
      this.samples.push(sample);
      if (this.samples.length > 600) this.samples.shift();
    }
  }

  private sample(frame: HandDiagnosticFrame, p: Participant, pieces: ReturnType<typeof readDiagnosticPieces>, moving: ReadonlySet<number>, toCube: THREE.Matrix4, half: number, order: number) {
    const model = frame.models[p.hand];
    const active = frame.active!, g = active.gesture;
    const slidingRing = order === 3 && g?.kind === 'flick' && g.style === 'middleSliceNail' && !g.finger2;
    let points;
    if (p.surface === 'nail') {
      points = nailPoints(model, p.finger, toCube, order !== 3 || slidingRing || g?.kind === 'flick' && (g.style === 'markedRingNail' || g.style === 'lowerHook' || g.style === 'frontIndexNail' || g.style === 'frontThumbNail'));
      if (order === 3 && g?.kind === 'flick' && isSliceNail(g.style) && p.role === 'active') {
        // Keep the full plate for penetration. Measure slip at the same loaded tip
        // vertex across the stroke, even as another part of the curved plate comes closer.
        const plate = model.nailMeshes?.find(mesh => mesh.userData.nail.finger === 'index');
        if (plate) {
          const { nailPlateVertexCount, freeEdgeVertexStart } = plate.geometry.userData;
          const columns = (2 * nailPlateVertexCount - freeEdgeVertexStart) / 2;
          const tip = nailPlateVertexCount - Math.ceil(columns / 2) + (p.hand === 'R' ? 4 : -4);
          points.forEach((point, i) => { point.pad = i === tip; });
        }
      }
    } else {
      let sampler = this.samplers.get(model);
      if (!sampler) { sampler = new FingerSurfaceSampler(model); this.samplers.set(model, sampler); }
      points = sampler.samplePoints(p.finger);
      for (const value of points) value.point.applyMatrix4(toCube);
    }
    const eligiblePieces = order === 3 ? pieces : pieces.filter(piece => moving.has(piece.initial) === (p.role === 'active'));
    const measurement = measureIndexContact(points, eligiblePieces, half);
    // The same vertex starts a new material anchor on a different piece at 90°.
    const secondNail = g?.kind === 'flick' && g.style === 'sliceNailDouble' && Math.abs(active.angle) >= Math.PI / 2 - 1e-9;
    const key = p.hand + p.finger + p.surface + (secondNail ? '2' : '');
    let anchor = this.anchors.get(key);
    if (!anchor || (slidingRing && measurement.contacts.length && !measurement.contacts.some(c => c.stickerId === anchor!.stickerId))) {
      // The nail gets its own witness vertex on the sticker established by the pad.
      const pad = !frame.marked && p.surface === 'nail' ? this.anchors.get(p.hand + p.finger + 'pad') : undefined;
      let contacts = measurement.contacts;
      if (pad && !slidingRing) {
        contacts = contacts.filter(c => c.stickerId === pad.stickerId);
      } else if (order === 3 && p.role === 'active' && p.finger === 'ring' && g?.kind === 'flick'
        && isMiddleSliceStroke(g.style)) {
        // D7 and B7 start on the same edge. The first displayed frame can
        // already be oblique, with a neighbouring outer sticker under the pad.
        const axis = CubeGroup.AXIS_VECTOR.x;
        const center = new THREE.Vector3(0, -SIZE, -SIZE).applyAxisAngle(axis, active.angle);
        const normal = (g.style !== 'middleSlicePad' ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(0, 0, -1))
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
    // A point on a stationary neighbour cannot drive the selected layer.
    const quarter = order !== 3 && active.halfTurn && g?.kind === 'flick' && !g.finger2
      ? Number(Math.abs(active.angle) >= Math.PI / 2) : p.role === 'active' && g?.kind === 'flick' && g.finger2 === p.finger ? 1 : secondNail ? 1 : 0;
    const target = p.role === 'active' ? active.bearing : undefined;
    const rotation = new THREE.Quaternion().setFromAxisAngle(CubeGroup.AXIS_VECTOR[active.axis],
      active.angle - Math.sign(active.angle) * quarter * Math.PI / 2);
    const normal = target?.normal.clone().applyQuaternion(rotation);
    const center = target?.center.clone().applyQuaternion(rotation);
    const eligible = measurement.contacts.filter(c => {
      if (moving.has(c.pieceInitial) !== (p.role === 'active')) return false;
      if (!center || !normal) return true;
      const piece = pieces.find(piece => piece.initial === c.pieceInitial)!;
      const faceCenter = new THREE.Vector3().setFromMatrixPosition(piece.matrix)
        .addScaledVector(new THREE.Vector3(...c.normalCube), SIZE / 2);
      // Marked starts can lie near an edge. Resolve the finite face rectangle
      // in piece coordinates rather than choosing a neighbouring sticker.
      const local = faceCenter.sub(center).applyQuaternion(rotation.clone().invert());
      return normal.dot(new THREE.Vector3(...c.normalCube)) > .99
        && Math.max(Math.abs(local.x), Math.abs(local.y), Math.abs(local.z)) < SIZE / 2;
    });
    const witness = eligible.find(c => c.stickerId === anchor?.stickerId)
      ?? eligible.sort((a, b) => a.gapU - b.gapU)[0];
    const bearing = fingerBearing(model, p.finger, toCube);
    let surfaceNormal: THREE.Vector3 | null = null;
    if (witness && p.surface === 'pad') {
      surfaceNormal = this.samplers.get(model)!.vertexNormal(p.finger, witness.witnessVertex, toCube);
    } else if (witness) {
      const mesh = model.nailMeshes!.find(m => m.userData.nail.finger === p.finger)!;
      surfaceNormal = new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('normal'), -1 - witness.witnessVertex)
        .applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(toCube.clone().multiply(mesh.matrixWorld)));
    }
    const geometry = {
      distal: bearing.distal.toArray(), pad: bearing.pad.toArray(), nail: bearing.nail.toArray(),
      nearest: order !== 3 && !witness && measurement.nearest ? { sticker: measurement.nearest.stickerId,
        gap: measurement.nearest.gapU, margin: measurement.nearest.edgeMarginU,
        distance: measurement.nearest.distanceToRectangleU } : undefined,
      contact: witness ? { sticker: witness.stickerId, piece: witness.pieceInitial, point: witness.pointCube,
        localPoint: witness.pointPiece, uv: witness.uvU, stickerNormal: witness.normalCube, surfaceNormal: surfaceNormal?.toArray(),
        tangent: p.role === 'active' ? strokeTangent(active.axis, active.angle, new THREE.Vector3(...witness.pointCube)).toArray() : null,
        gap: witness.gapU } : null,
    };
    const driving = p.role === 'active' && (order === 3 || !active.halfTurn ||
      quarter === Number(Math.abs(active.angle) >= Math.PI / 2));
    return { ...p, quarter, driving, geometry, atMs: frame.atMs, phase: frame.hands[p.hand].phase, axis: frame.active!.axis,
      layer: active.cls, layers: active.layers, angle: frame.active!.angle, profile: frame.marked?.profile,
      anchor, contacts: measurement.contacts.map(c => c.stickerId), penetration: measurement.penetration.depthU,
      slip: measureMaterialSlip(anchor ?? null, points, pieces, measurement, half) };
  }
}
