import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import { FACE } from '@cuberoot/puzzle-render-core/engine/define';
import { contactAnchor, measureIndexContact, measureMaterialSlip, readDiagnosticPieces } from '@/app/[lang]/sim/engine/hands/uContactGeometry';
import { UContactRecorder } from '@/app/[lang]/sim/engine/hands/uContactRecorder';
import HandsRig, { gripQuat, classifyHandGesture, type HandGripNames } from '@/app/[lang]/sim/engine/hands/handsRig';
import type { HandDiagnosticFrame } from '@/app/[lang]/sim/engine/hands/handsRig';
import type { HandModel } from '@/app/[lang]/sim/engine/hands/handModel';

const point = (x: number, y: number, z: number, vertex = 0, pad = true) => ({ vertex, pad, point: new THREE.Vector3(x, y, z) });
const piece = { initial: 8, matrix: new THREE.Matrix4().makeTranslation(64, 64, -64), faces: [FACE.B] };

describe('U contact geometry', () => {
  it('does not label a separated start or an off-edge anchor as contact slip', () => {
    const separated = measureIndexContact([point(64, 64, -101)], [piece]);
    const touchingPoints = [point(66, 64, -97)];
    const touching = measureIndexContact(touchingPoints, [piece]);
    const acquired = measureMaterialSlip(contactAnchor(separated), touchingPoints, [piece], touching)!;
    expect(acquired.tangentialDisplacementU).toBe(2);
    expect(acquired.startedInContact).toBe(false);
    expect(acquired.anchorInContact).toBe(true);
    expect(acquired.contactAtBothCheckpoints).toBe(false);
    const edgePoints = [point(94, 64, -97), point(65, 64, -97, 1)];
    const offEdge = measureMaterialSlip(contactAnchor(touching), edgePoints, [piece], measureIndexContact(edgePoints, [piece]))!;
    expect(offEdge.contactOnReference).toBe(true); // A different skin vertex still touches.
    expect(offEdge.anchorEdgeMarginU).toBe(-2);
    expect(offEdge.anchorInContact).toBe(false);
    expect(offEdge.contactAtBothCheckpoints).toBe(false);
  });

  it('tracks the same physical B0 sticker through 45 and 90 degrees, excluding rigid rotation from slip', () => {
    const start = [point(64, 64, -97)];
    const anchor = contactAnchor(measureIndexContact(start, [piece]));
    expect(anchor?.stickerId).toBe('B0');
    for (const degrees of [45, 90]) {
      const rotation = new THREE.Matrix4().makeRotationY(-degrees * Math.PI / 180);
      const moving = { ...piece, matrix: rotation.clone().multiply(piece.matrix) };
      const points = start.map(p => ({ ...p, point: p.point.clone().applyMatrix4(rotation) }));
      const measured = measureIndexContact(points, [moving]);
      expect(measured.nearest?.stickerId).toBe('B0');
      expect(measured.nearest?.gapU).toBeCloseTo(1);
      expect(measured.nearest?.currentSlot).toBe(degrees === 90 ? 'R0' : null);
      expect(measureMaterialSlip(anchor, points, [moving], measured)?.tangentialDisplacementU).toBeCloseTo(0);
      points[0].point.add(new THREE.Vector3(2, 0, 0).transformDirection(rotation).multiplyScalar(2));
      expect(measureMaterialSlip(anchor, points, [moving], measured)?.tangentialDisplacementU).toBeCloseTo(2);
    }
  });

  it('distinguishes separation, finite sticker borders, penetration and coexisting contact', () => {
    expect(measureIndexContact([point(64, 64, -101)], [piece]).state).toBe('separated');
    const edge = measureIndexContact([point(94, 64, -96)], [piece]);
    expect(edge.contacts).toHaveLength(0);
    expect(edge.nearest?.edgeMarginU).toBe(-2);
    const mixed = measureIndexContact([point(64, 64, -95.9), point(65, 64, -97, 1), point(64, 64, -94, 2, false)], [piece]);
    expect(mixed.nearest?.gapU).toBeCloseTo(-0.1);
    expect(mixed.contacts[0].witnessVertex).toBe(1);
    expect(mixed.penetration.depthU).toBe(2);
    expect(mixed.penetration.vertex).toBe(2);
    expect(mixed.state).toBe('penetrating');
  });

  it('reads live moving and committed engine matrices, including the replacement sticker at the home position', () => {
    const cube = new Cube(3);
    try {
      const group = cube.table.groups.y[2];
      expect(group.drag()).toBe(true);
      group.angle = Math.PI / 4;
      const moving = readDiagnosticPieces(cube).find(p => p.initial === 8)!;
      const points = [point(0, 0, -33)];
      points[0].point.applyMatrix4(moving.matrix);
      expect(measureIndexContact(points, [moving]).nearest?.currentSlot).toBeNull();
      group.angle = Math.PI / 2;
      group.drop();
      const home = measureIndexContact([point(64, 64, -97)], readDiagnosticPieces(cube));
      expect(home.nearest?.homePiece).toBe('UBL');
      expect(home.nearest?.stickerId).toBe('L0');
      expect(home.nearest?.currentSlot).toBe('B0');
    } finally { cube.dispose(); }
  });
});

function fixture(grips: HandGripNames = { R: 'home', L: 'home' }) {
  const cube = new Cube(3);
  const group = new THREE.Group(), tip = new THREE.Bone();
  tip.name = 'index-finger-phalanx-distal'; tip.position.set(64, 64, -100);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([64, 64, -97], 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0], 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0], 4));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
  group.add(tip, mesh); group.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([tip]));
  group.quaternion.copy(gripQuat(grips.R ?? 'home'));
  const model = { group, meshes: [mesh], fingers: { index: { tip } } } as unknown as HandModel;
  let listener: ((frame: HandDiagnosticFrame) => void) | undefined;
  const rig = {
    subscribeDiagnostics(fn: typeof listener) { listener = fn; return () => { listener = undefined; }; },
    getLoadState: () => ({ hands: 'ready' }),
  } as unknown as HandsRig;
  const recorder = new UContactRecorder(() => cube);
  recorder.bind(rig);
  let time = 0;
  const emit = (event: HandDiagnosticFrame['event'], phase: HandDiagnosticFrame['hands']['R']['phase'] = 'stable', handAngle = 0) => {
    const hand = { phase, grip: [0, 0, 0, 1], position: [0, 0, 0], quaternion: [0, 0, 0, 1], flickAngle: handAngle, decay: 0 };
    listener?.({ atMs: time += 16, event, grips, preparedGesture: event === 'prepare-u'
      ? classifyHandGesture('y', 'high', 1, grips, { quarters: 1 }) : undefined,
      hands: { L: { ...hand, phase: 'stable' }, R: hand }, active: null, models: { L: model, R: model } });
  };
  return { cube, group, recorder, emit, cleanup() { recorder.dispose(); cube.dispose(); geometry.dispose(); mesh.material.dispose(); } };
}

describe('read-only U recorder', () => {
  it.each((['home', 'up', 'down', 'half'] as const).flatMap(R =>
    (['home', 'up', 'down', 'half'] as const).map(L => ({ R, L })),
  ))('measures four actual checkpoints in R=$R L=$L using the rotated skin', ({ R, L }) => {
    const f = fixture({ R, L });
    try {
      f.recorder.start(); f.emit('prepare-u');
      const start = f.recorder.read().records[0].checkpoints.start!;
      // This controlled vertex is 1 U from B/D/U/F respectively after the grip rotation.
      expect(start.measurement.nearest?.currentFace).toBe({ home: 'B', up: 'D', down: 'U', half: 'F' }[R]);
      expect(start.measurement.nearest?.gapU).toBeCloseTo(1);
      expect(start.slip?.anchorInContact).toBe(true);
      const layer = f.cube.table.groups.y[2];
      layer.drag(); layer.angle = Math.PI / 4;
      f.emit('frame', 'turning', layer.angle);
      layer.angle = Math.PI / 2; layer.drop();
      f.emit('end-u', 'turning', Math.PI / 4);
      f.emit('frame', 'returning'); f.emit('frame');
      const run = f.recorder.read().records[0];
      expect(run.status).toBe('complete');
      expect(run.startGrips).toEqual({ R, L });
      expect(run.preparedGesture).toEqual(classifyHandGesture('y', 'high', 1, { R, L }));
      expect(run.missingCheckpoints).toEqual([]);
      for (const key of ['start', '45deg', '90deg', 'after-return'] as const) {
        const checkpoint = run.checkpoints[key]!;
        expect(checkpoint.pose.grips).toEqual({ R, L });
        expect(checkpoint.measurement.padVertices).toBe(1);
        expect(Number.isFinite(checkpoint.measurement.nearest!.gapU)).toBe(true);
        expect(Number.isFinite(checkpoint.measurement.penetration.depthU)).toBe(true);
        expect(Number.isFinite(checkpoint.slip!.tangentialDisplacementU)).toBe(true);
      }
      // Static finger below U follows no moving piece: the reference must not be forced to UBR.
      if (R === 'up') expect(run.checkpoints['90deg']?.slip?.tangentialDisplacementU).toBeCloseTo(0);
    } finally { f.cleanup(); }
  });

  it('keeps independent bounded grip history, interrupts contact on regrip, and clears both histories', () => {
    const f = fixture();
    try {
      f.recorder.start(); f.emit('prepare-u'); f.emit('grip-request', 'regripping');
      expect(f.recorder.read().records[0].reason).toBe('grip-changed');
      for (let i = 0; i < 1205; i++) f.emit('frame');
      const data = f.recorder.read();
      expect(data.stateFrames).toHaveLength(1200);
      expect(data.droppedStateFrames).toBe(7);
      expect(data.gripEvents.map(p => p.event)).toEqual(['prepare-u', 'grip-request', 'frame']);
      data.gripEvents[0].grips.R = 'half';
      expect(f.recorder.read().gripEvents[0].grips.R).toBe('home');
      for (let i = 0; i < 205; i++) f.emit('grip-set');
      expect(f.recorder.read().gripEvents).toHaveLength(200);
      expect(f.recorder.read().droppedGripEvents).toBe(8);
      f.recorder.clear();
      expect(f.recorder.read().stateFrames).toEqual([]);
      expect(f.recorder.read().gripEvents).toEqual([]);
      expect(f.recorder.read().droppedStateFrames).toBe(0);
      f.recorder.stop(); f.emit('frame');
      expect(f.recorder.read().stateFrames).toEqual([]);
    } finally { f.cleanup(); }
  });

  it('is opt-in and records actual crossing, commit hand lag, return, and detached snapshots', () => {
    const f = fixture();
    try {
      f.emit('prepare-u');
      expect(f.recorder.read().records).toHaveLength(0);
      f.recorder.start(); f.emit('prepare-u');
      const layer = f.cube.table.groups.y[2];
      layer.drag(); layer.angle = 47 * Math.PI / 180;
      f.group.rotation.y = -layer.angle;
      f.emit('frame', 'turning', layer.angle);
      layer.angle = Math.PI / 2; layer.drop();
      // The cube committed, but the hand still shows the previously rendered 47-degree pose.
      f.emit('end-u', 'turning', 47 * Math.PI / 180);
      f.emit('frame', 'returning');
      f.group.rotation.y = 0;
      f.emit('frame');
      const run = f.recorder.read().records[0];
      expect(run.status).toBe('complete');
      expect(run.missingCheckpoints).toEqual([]);
      expect(run.checkpoints['45deg']?.cubeAngleDeg).toBeCloseTo(47);
      expect(run.checkpoints['45deg']?.cubeAngleErrorDeg).toBeCloseTo(2);
      expect(run.checkpoints['90deg']?.handDriverAngleDeg).toBeCloseTo(47);
      expect(run.checkpoints['90deg']?.cubeAngleDeg).toBeCloseTo(90);
      expect(run.checkpoints['after-return']?.measurement.nearest?.stickerId).toBe('L0');
      expect(run.frames.some(p => p.hands.R.phase === 'returning')).toBe(true);
      run.startGrips.R = 'down';
      expect(f.recorder.read().records[0].startGrips.R).toBe('home');
      expect(layer.angle).toBe(0);
    } finally { f.cleanup(); }
  });

  it('reports skipped milestones, interrupts on reset, bounds frames, and unsubscribes on stop', () => {
    const f = fixture();
    try {
      f.recorder.start(); f.emit('prepare-u');
      const layer = f.cube.table.groups.y[2];
      layer.drag(); layer.angle = Math.PI / 2; layer.drop();
      f.emit('end-u', 'turning'); f.emit('frame');
      expect(f.recorder.read().records[0].missingCheckpoints).toEqual(['45deg']);
      f.emit('prepare-u');
      for (let i = 0; i < 610; i++) f.emit('frame');
      f.emit('reset');
      const run = f.recorder.read().records[1];
      expect(run.status).toBe('interrupted');
      expect(run.reason).toBe('reset');
      expect(run.frames).toHaveLength(600);
      expect(run.droppedFrames).toBe(11);
      f.recorder.stop(); f.emit('prepare-u');
      expect(f.recorder.read().records).toHaveLength(2);
      f.recorder.clear(); expect(f.recorder.read().records).toHaveLength(0);
    } finally { f.cleanup(); }
  });
});
