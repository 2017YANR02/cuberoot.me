// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import LiveCubeState from '@cuberoot/timer-ui/LiveCubeState';
import { Quaternion, Vector3 } from 'three';
import { SENSOR_BASES, quatMul, quatConjugate } from '@cuberoot/shared/smart-cube/orientation';
import { CUBE_ORIENTATIONS } from '@cuberoot/shared/timer';
const sim = vi.hoisted(() => ({ mount: vi.fn(), setQuaternion: vi.fn() }));
vi.mock('@cuberoot/puzzle-render-core/sim/mountSimWorld', () => ({ mountSimWorld: sim.mount }));

// Independent renderer convention: written x/y/z turn clockwise about +X/+Y/+Z.
const axes = { x: new Vector3(1, 0, 0), y: new Vector3(0, 1, 0), z: new Vector3(0, 0, 1) };
function pose(alg: string): Quaternion {
  const q = new Quaternion();
  for (const token of alg.split(/\s+/).filter(Boolean)) {
    const angle = -Math.PI / 2 * (token.includes('2') ? 2 : 1) * (token.endsWith("'") ? -1 : 1);
    q.premultiply(new Quaternion().setFromAxisAngle(axes[token[0] as keyof typeof axes], angle));
  }
  return q;
}

describe('live training gyro agrees with the renderer', () => {
  for (const { value: orientation } of CUBE_ORIENTATIONS) {
    for (const token of ['x', "x'", 'y', "y'", 'z', "z'"]) {
      it(`${orientation || 'normal'}: ${token}`, async () => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        const host = document.createElement('div');
        const root = createRoot(host);
        sim.mount.mockClear();
        sim.setQuaternion.mockClear();
        sim.mount.mockImplementation(() => ({ dispose() {}, invalidate() {}, world: {
          controller: { touch() {} }, scene: { rotation: { set() {} }, updateMatrix() {} },
          cube: { quaternion: { set: sim.setQuaternion }, updateMatrix() {},
            twister: { setup() {}, push() {}, backlog: 0, remainingTicks: 0, accelerateRealtime() {} }, instancedRenderer: { setStickering() {} } },
        } }));
        const mount = SENSOR_BASES.rotX90;
        const quatRef = { current: { w: 1, x: 0, y: 0, z: 0 } };
        try {
          await act(async () => root.render(createElement(LiveCubeState, {
            mode: '3d', moves: [], algAnchored: true, facelets: null,
            displayOrientation: orientation, quatRef, sensorBasis: 'rotX270',
          })));
          await vi.waitFor(() => expect(sim.mount).toHaveBeenCalledOnce());
          const grip = pose(orientation);
          const expected = pose(token);
          // A viewer-frame turn expressed in the device's physical-color frame.
          const physical = grip.clone().invert().multiply(expected).multiply(grip);
          quatRef.current = quatMul(quatMul(mount, physical), quatConjugate(mount));
          const options = sim.mount.mock.calls[0][0];
          options.onFrame(sim.mount.mock.results[0].value.world, 16);
          const [x, y, z, w] = sim.setQuaternion.mock.calls.at(-1)!;
          expect(Math.abs(new Quaternion(x, y, z, w).dot(expected))).toBeCloseTo(1, 8);
        } finally {
          await act(async () => root.unmount());
          vi.unstubAllGlobals();
        }
      });
    }
  }
});
