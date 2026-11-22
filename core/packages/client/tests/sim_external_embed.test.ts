import { describe, expect, it, vi } from 'vitest';
import { Object3D } from 'three';
import { parseSimEmbedParams } from '@/lib/sim-embed';
import { attachEmbeddedSimInteraction } from '@/components/sim-embed/attachEmbeddedSimInteraction';
import type World from '@/app/[lang]/sim/engine/world';

const toucher = vi.hoisted(() => ({ init: vi.fn(), destroy: vi.fn() }));
vi.mock('@/app/[lang]/sim/Toucher', () => ({
  default: class { init = toucher.init; destroy = toucher.destroy; },
}));

describe('external simulator parameters', () => {
  it('preserves forward and inverse setup semantics', () => {
    expect(parseSimEmbedParams(new URLSearchParams('alg=R+U')).setup).toBe('R U');
    const inverse = parseSimEmbedParams(new URLSearchParams('alg=R&case=U'));
    expect(inverse.alg).toBe('U');
    expect(inverse.setup).toBeUndefined();
    expect(parseSimEmbedParams(new URLSearchParams('alg=R&case=')).alg).toBe('');
  });

  it('bounds public input and keeps invalid angles finite', () => {
    const props = parseSimEmbedParams(new URLSearchParams('puzzle=999&yaw=Infinity&pitch=-999&drag=0&lockView=1'));
    expect(props.puzzle).toBe('5x5');
    expect(props.sceneRot.x).toBe(-Math.PI / 2);
    expect(props.sceneRot.y).toBe(-33.75 * Math.PI / 180);
    expect(props.interactionMode).toBe('none');
    expect(props.lockView).toBe(true);
  });
});

describe('embedded pointer policy', () => {
  const makeWorld = () => ({
    puzzleKind: 3,
    width: 380,
    height: 380,
    scale: 1,
    controller: { userTwist: [], touch: vi.fn(), onOrbit: null },
  }) as unknown as World;

  it('does not attach any pointer input when dragging is disabled', () => {
    toucher.init.mockClear();
    const world = makeWorld();
    attachEmbeddedSimInteraction({ world, dom: {} as HTMLElement, mode: 'none' })();
    expect(toucher.init).not.toHaveBeenCalled();
    expect(world.controller.onOrbit).toBeNull();
    expect(world.controller.userTwist).toEqual([]);
  });

  it('routes ordinary view drags to the camera and releases its pointer handler', () => {
    const scene = { rotation: { x: 0, y: 0 }, updateMatrix: vi.fn() };
    const world = Object.assign(makeWorld(), { scene });
    const dom = {} as HTMLElement;
    const detach = attachEmbeddedSimInteraction({ world, dom, mode: 'view' });
    expect(toucher.init).toHaveBeenCalledWith(dom, world.controller.touch);
    expect(world.controller.dragEmpty).toBe('view');
    expect(world.controller.paintMode).toBe(true);
    world.controller.onOrbit?.(10, 5);
    expect(scene.rotation.x).not.toBe(0);
    expect(scene.rotation.y).not.toBe(0);
    expect(scene.updateMatrix).toHaveBeenCalledOnce();
    detach();
    expect(toucher.destroy).toHaveBeenCalled();
    expect(world.controller.onOrbit).toBeNull();
  });

  it('locks orbit while retaining manual layer turns and cleans up callbacks', () => {
    const world = makeWorld();
    const onUserMove = vi.fn();
    const detach = attachEmbeddedSimInteraction({ world, dom: {} as HTMLElement, mode: 'turn', lockView: true, onUserMove });
    expect(world.controller.paintMode).toBe(false);
    expect(world.controller.turnsLocked).toBe(false);
    // A locked orbit must not access the scene at all (this fixture has none).
    expect(() => world.controller.onOrbit?.(100, 50)).not.toThrow();
    world.controller.userTwist[0]({ value: 'R' } as Parameters<typeof world.controller.userTwist[0]>[0]);
    expect(onUserMove).toHaveBeenCalledWith('R');
    detach();
    expect(world.controller.userTwist).toEqual([]);
    expect(world.controller.onOrbit).toBeNull();
  });

  it('keeps the view at the edge while accumulating extra drag within one gesture', () => {
    const scene = new Object3D();
    const world = Object.assign(makeWorld(), { scene });
    const allowUserLayerTurn = vi.fn(() => false);
    const detach = attachEmbeddedSimInteraction({
      world, dom: {} as HTMLElement, mode: 'turn', wholeCubeDrag: 'rotate-only',
      orbitSnapDegrees: 30, allowUserLayerTurn,
    });
    const touch = toucher.init.mock.lastCall![1];

    world.controller.onOrbit?.(61, 0);
    expect(scene.rotation.y).toBeCloseTo(Math.PI / 6);
    expect(allowUserLayerTurn).not.toHaveBeenCalled();

    touch({ type: 'mouseup' });
    touch({ type: 'mousedown' });
    world.controller.onOrbit?.(8, 0);
    expect(allowUserLayerTurn).not.toHaveBeenCalled();
    world.controller.onOrbit?.(9, 0);
    expect(allowUserLayerTurn).toHaveBeenCalledExactlyOnceWith("y'");
    expect(scene.rotation.y).toBeCloseTo(Math.PI / 6);
    detach();
  });

  it('follows a downward drag with leftward drift while at the left edge', () => {
    const scene = new Object3D();
    scene.rotation.y = -Math.PI / 6;
    const world = Object.assign(makeWorld(), { scene });
    const allowUserLayerTurn = vi.fn(() => false);
    const detach = attachEmbeddedSimInteraction({
      world, dom: {} as HTMLElement, mode: 'turn', wholeCubeDrag: 'rotate-only',
      orbitSnapDegrees: 30, allowUserLayerTurn,
    });

    world.controller.onOrbit?.(-8, 0);
    world.controller.onOrbit?.(-15, 20);
    expect(scene.rotation.y).toBeCloseTo(-Math.PI / 6);
    expect(allowUserLayerTurn).not.toHaveBeenCalled();

    world.controller.onOrbit?.(-8, 51);
    expect(allowUserLayerTurn).toHaveBeenCalledExactlyOnceWith("x'");
    expect(scene.rotation.x).toBeCloseTo(Math.PI / 6);
    expect(scene.rotation.y).toBeCloseTo(-Math.PI / 6);
    detach();
  });

  it.each([
    { width: 340, height: 600, scale: 1, dragEdge: 340 },
    { width: 700, height: 500, scale: 0.76, dragEdge: 380 },
    { width: 230, height: 460, scale: 1, dragEdge: 320 },
  ])('scales a snap drag for a $width × $height canvas', ({ dragEdge, ...dimensions }) => {
    const scene = new Object3D();
    const world = Object.assign(makeWorld(), { scene }, dimensions);
    const allowUserLayerTurn = vi.fn(() => false);
    const detach = attachEmbeddedSimInteraction({
      world, dom: {} as HTMLElement, mode: 'turn', wholeCubeDrag: 'rotate-only',
      orbitSnapDegrees: 30, allowUserLayerTurn,
    });

    world.controller.onOrbit?.(dragEdge * 0.10, 0);
    expect(scene.rotation.y).toBeCloseTo(0.38);
    world.controller.onOrbit?.(dragEdge * 0.075, 0);
    expect(scene.rotation.y).toBeCloseTo(Math.PI / 6);
    expect(allowUserLayerTurn).not.toHaveBeenCalled();
    world.controller.onOrbit?.(dragEdge * 0.01, 0);
    expect(allowUserLayerTurn).toHaveBeenCalledExactlyOnceWith("y'");
    detach();
  });
});
