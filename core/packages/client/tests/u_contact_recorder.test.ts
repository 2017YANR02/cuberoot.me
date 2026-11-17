import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import { FACE } from '@cuberoot/puzzle-render-core/engine/define';
import { contactAnchor, measureIndexContact, measureMaterialSlip, readDiagnosticPieces } from '@/app/[lang]/sim/engine/hands/uContactGeometry';

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
