// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { cubeMove, SOLVED_3X3 } from '@cuberoot/puzzle-solvers/timer-333-cube';
import type { LiveSmartCubeAnchor } from '@cuberoot/shared/smart-cube/anchor';
import type { LiveCubeStateProps } from '@/app/[lang]/timer/_components/LiveCubeState';
import type { BluetoothCubeHandle } from '@/lib/bluetooth';
import TrainingCubePreview from '@/app/[lang]/timer/_components/TrainingCubePreview';

const views = vi.hoisted(() => new Map<string, LiveCubeStateProps>());
vi.mock('@/i18n/tr', () => ({ tr: ({ en }: { en: string }) => en }));
vi.mock('@/app/[lang]/timer/_components/LiveCubeState', () => ({ default: (props: LiveCubeStateProps) => {
  views.set(props.displayOrientation!, props);
  return createElement('span', null, props.moves.join(' '));
} }));

it('keeps each preview in connection order with independent moves and live sensor samples', async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const sources = new Map<string, LiveSmartCubeAnchor>();
  const onSource = (id: string, source: LiveSmartCubeAnchor | null) => {
    if (source) sources.set(id, source); else sources.delete(id);
  };
  const gyros = { current: new Map([
    ['one', { quat: { x: 0, y: 0, z: 0, w: 1 }, calibration: null }],
    ['two', { quat: { x: 1, y: 0, z: 0, w: 0 }, calibration: null }],
  ]) };
  const cubes = ['one', 'two'].map(id => ({ status: { connected: true, deviceId: id, brand: 'gan-v4' }, facelets: SOLVED_3X3 }) as BluetoothCubeHandle);
  const render = (ids = ['one', 'two']) => root.render(createElement(StrictMode, null, ids.map(id => {
    const index = id === 'one' ? 0 : 1;
    return createElement(TrainingCubePreview, { key: id, id, number: index + 1, name: `GAN ${id}`, cube: cubes[index],
      status: index === 0 ? 'running' : 'preparing', orientation: index === 0 ? '' : 'x', mode: '3d', useGyro: true, calibrateToken: 0, gyros, onSource });
  })));
  try {
    await act(async () => render());
    expect([...host.querySelectorAll('figure')].map(node => node.dataset.cubeId)).toEqual(['one', 'two']);
    expect(host.textContent).toContain('Timing');
    expect(host.textContent).toContain('Scrambling');
    expect(views.get('')?.algAnchored).toBe(true);
    expect(views.get('x')?.algAnchored).toBe(true);
    const secondSource = sources.get('two');
    await act(async () => {
      sources.get('two')!.move('R', 20);
      cubes[1] = { ...cubes[1], facelets: cubeMove(SOLVED_3X3, 'R') };
      render();
    });
    expect(views.get('')?.moves).toEqual([]);
    expect(views.get('x')?.moves).toEqual(['R']);
    expect(sources.get('two')).toBe(secondSource);
    gyros.current.get('two')!.quat = { x: 0, y: 1, z: 0, w: 0 };
    expect(views.get('x')?.quatRef?.current).toEqual({ x: 0, y: 1, z: 0, w: 0 });
    expect(views.get('')?.quatRef?.current).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    await act(async () => render(['two']));
    expect(sources.has('one')).toBe(false);
    expect(sources.get('two')).toBe(secondSource);
    expect(views.get('x')?.moves).toEqual(['R']);
  } finally {
    await act(async () => root.unmount()); host.remove(); views.clear();
  }
  expect(sources.size).toBe(0);
});
