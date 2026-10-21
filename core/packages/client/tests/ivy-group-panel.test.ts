// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import GroupTheoryPanel, { type SimEngineCube } from '@/app/[lang]/sim/GroupTheoryPanel';

const kernel = vi.hoisted(() => ({
  solvable: true,
  facts: () => ({ order: 29160n, reorientations: 1n, turningOrder: 29160n, reassembly: 58320n, index: 2n, orbits: [], moveNames: ['R', 'L', 'D', 'B'] }),
  rebuildFromString: vi.fn((text: string) => { if (text.includes('U')) throw new Error('bad: U'); }),
  currentOrder: () => 3,
  solveString: () => "R'",
}));
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
vi.mock('@/app/[lang]/sim/engine/pgBindings', () => ({ createBinding: () => kernel }));

it('keeps U playback callbacks safe and restores live analysis on RLDB history', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const cube: SimEngineCube = {
    history: { init: '', moves: ['U'] }, callbacks: [], complete: false,
    twister: { setup: vi.fn(), push: vi.fn() },
  };
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(GroupTheoryPanel, {
      puzzle: 'ivy', getWorld: () => ({ puzzleKind: 'ivy', cube }),
    })));
    expect(host.textContent).toContain('含 U 的实时群分析与群论还原尚未支持');
    expect(kernel.rebuildFromString).not.toHaveBeenCalled();
    await act(async () => { cube.history.moves = ['R']; cube.callbacks.forEach(cb => cb()); });
    expect(kernel.rebuildFromString).toHaveBeenCalledWith('R');
    expect(host.textContent).not.toContain('尚未支持');
    await act(async () => { cube.history.moves = ['R', 'U']; cube.callbacks.forEach(cb => cb()); });
    expect(host.textContent).toContain('尚未支持');
    expect(kernel.rebuildFromString).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
  }
  expect(cube.callbacks).toHaveLength(0);
});
