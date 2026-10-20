// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import GroupTheoryPanel, { type SimWorldView } from '@/app/[lang]/sim/GroupTheoryPanel';

const fixture = vi.hoisted(() => ({
  rebuild: vi.fn(),
  factsOnly: false,
  facts: { order: 1n, turningOrder: 1n, reorientations: 1n, reassembly: 1n, index: 1n, orbits: [], moveNames: [] },
}));
vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));
vi.mock('@/app/[lang]/sim/engine/pgBindings', () => ({ createBinding: () => ({
  solvable: false,
  hasLiveState: !fixture.factsOnly,
  facts: () => fixture.facts,
  rebuildFromString: fixture.rebuild,
  currentOrder: () => 1,
}) }));

let root: Root;
let host: HTMLDivElement;
let nextFrame = 0;
const frames = new Map<number, FrameRequestCallback>();
beforeEach(() => {
  fixture.factsOnly = false; fixture.rebuild.mockClear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { frames.set(++nextFrame, fn); return nextFrame; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove(); frames.clear(); vi.unstubAllGlobals();
});
const mount = async (getWorld: () => SimWorldView | null) => {
  await act(async () => {
    root.render(createElement(GroupTheoryPanel, { puzzle: 'pyraminx', getWorld }));
    await vi.dynamicImportSettled();
  });
};

it('removes the live-state subscription on close and attaches only one on reopen', async () => {
  const world: SimWorldView = { puzzleKind: 'pyraminx', cube: {
    history: { init: 'U', moves: ['R'] }, callbacks: [], complete: false,
    twister: { setup() {}, push() {} },
  } };
  const getWorld = () => world;
  // Hard iteration bound: catches callback accumulation without running a real kernel.
  for (let round = 0; round < 3; round++) {
    await mount(getWorld);
    expect(world.cube.callbacks).toHaveLength(1);
    expect(fixture.rebuild).toHaveBeenCalledTimes(round * 2 + 1);
    await act(async () => world.cube.callbacks.forEach(cb => cb()));
    expect(fixture.rebuild).toHaveBeenCalledTimes(round * 2 + 2);
    await act(async () => root.render(null));
    expect(world.cube.callbacks).toHaveLength(0);
    expect(frames.size).toBe(0);
  }
});

it('cancels pending engine attachment when closed before the world is ready', async () => {
  await mount(() => null);
  expect(frames.size).toBe(1);
  const pending = [...frames.values()][0];
  await act(async () => root.render(null));
  expect(frames.size).toBe(0);
  // A stale queued callback cannot restart polling after unmount.
  await act(async () => pending(0));
  expect(frames.size).toBe(0);
  expect(fixture.rebuild).not.toHaveBeenCalled();
});

it('does not poll for an engine when displaying facts-only puzzles', async () => {
  fixture.factsOnly = true;
  const getWorld = vi.fn(() => null);
  await mount(getWorld);
  expect(host.textContent).toContain('structure only');
  expect(frames.size).toBe(0);
  expect(getWorld).not.toHaveBeenCalled();
});
