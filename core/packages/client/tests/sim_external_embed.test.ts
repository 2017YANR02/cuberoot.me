import { describe, expect, it, vi } from 'vitest';
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
});
