// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import LiveCubeState from '@cuberoot/timer-ui/LiveCubeState';
import { Quaternion, Vector3 } from 'three';
import { SENSOR_BASES, quatMul, quatConjugate } from '@cuberoot/shared/smart-cube/orientation';
import { CUBE_ORIENTATIONS } from '@cuberoot/shared/timer';
import type { BluetoothCubeHandle } from '@/lib/bluetooth';
import TrainingCubePreview, { type TrainingCubeGyro } from '@/app/[lang]/timer/_components/TrainingCubePreview';
import { SOLVED_3X3 } from '@cuberoot/puzzle-solvers/timer-333-cube';
const sim = vi.hoisted(() => ({ mount: vi.fn(), setQuaternion: vi.fn() }));
vi.mock('@cuberoot/puzzle-render-core/sim/mountSimWorld', () => ({ mountSimWorld: sim.mount }));
vi.mock('@/i18n/tr', () => ({ tr: ({ en }: { en: string }) => en }));

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

it('recalibrates only the selected training preview while both cubes remain stationary', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  const root = createRoot(host);
  sim.mount.mockClear();
  sim.mount.mockImplementation(() => ({ dispose() {}, invalidate() {}, world: {
    controller: { touch() {} }, scene: { rotation: { set() {} }, updateMatrix() {} },
    cube: { quaternion: { set: vi.fn() }, updateMatrix() {},
      twister: { setup() {}, push() {}, backlog: 0, remainingTicks: 0, accelerateRealtime() {} }, instancedRenderer: { setStickering() {} } },
  } }));
  const gyros = { current: new Map<string, TrainingCubeGyro>([
    ['one', { quat: { w: Math.SQRT1_2, x: Math.SQRT1_2, y: 0, z: 0 }, calibration: null }],
    ['two', { quat: { w: Math.SQRT1_2, x: 0, y: Math.SQRT1_2, z: 0 }, calibration: null }],
  ]) };
  const onSource = vi.fn();
  const render = (firstToken: number, secondToken: number, count = 2) => act(async () => root.render(createElement('div', null,
    ['one', 'two'].slice(0, count).map((id, index) => createElement(TrainingCubePreview, {
      key: id, id, number: index + 1, name: id,
      cube: { status: { deviceId: id, brand: 'gan-v4', connected: true }, facelets: SOLVED_3X3 } as BluetoothCubeHandle,
      status: index === 0 ? 'running' : 'preparing', orientation: '', mode: '3d', useGyro: true,
      calibrateToken: index === 0 ? firstToken : secondToken, gyros, onSource,
    })),
  )));
  try {
    await render(0, 0, 1);
    await vi.waitFor(async () => { await act(async () => {}); expect(sim.mount).toHaveBeenCalledOnce(); });
    await render(0, 0);
    await vi.waitFor(async () => { await act(async () => {}); expect(sim.mount).toHaveBeenCalledTimes(2); });
    const worlds = sim.mount.mock.results.map(result => result.value.world);
    const frame = () => worlds.forEach((world, index) => sim.mount.mock.calls[index][0].onFrame(world, 16));
    frame();
    const firstPose = worlds[0].cube.quaternion.set.mock.calls.at(-1);
    expect(worlds[1].cube.quaternion.set.mock.calls.at(-1)[3]).toBeCloseTo(Math.SQRT1_2);
    gyros.current.get('two')!.calibration = { ...gyros.current.get('two')!.quat! };
    await render(0, 1);
    frame();
    // Calibration eases toward the new reference instead of snapping in one frame.
    expect(Math.abs(worlds[1].cube.quaternion.set.mock.calls.at(-1)[2])).toBeCloseTo(0.6111234402475233, 8);
    expect(worlds[0].cube.quaternion.set.mock.calls.at(-1)).toEqual(firstPose);
    for (let i = 0; i < 90; i++) frame();
    const secondPose = worlds[1].cube.quaternion.set.mock.calls.at(-1);
    expect(secondPose[3]).toBeCloseTo(1, 6);
    expect(worlds[0].cube.quaternion.set.mock.calls.at(-1)).toEqual(firstPose);
    gyros.current.get('one')!.calibration = { ...gyros.current.get('one')!.quat! };
    await render(1, 1);
    frame();
    expect(Math.abs(worlds[0].cube.quaternion.set.mock.calls.at(-1)[0])).toBeCloseTo(0.6111234402475233, 8);
    for (let i = 0; i < 90; i++) frame();
    expect(worlds[0].cube.quaternion.set.mock.calls.at(-1)[3]).toBeCloseTo(1, 6);
    expect(worlds[1].cube.quaternion.set.mock.calls.at(-1)).toEqual(secondPose);
    expect(sim.mount).toHaveBeenCalledTimes(2);
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
