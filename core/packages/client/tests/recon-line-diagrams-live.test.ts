// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ReconLineDiagramProvider } from '@/components/ReconLineDiagrams';
import type { ReconF2lAnnotations } from '@/lib/recon-f2l-links';

const mocks = vi.hoisted(() => ({ annotations: vi.fn(), load: vi.fn(), unmount: vi.fn() }));
vi.mock('@/lib/recon-f2l-links', () => ({ reconF2lAnnotations: mocks.annotations }));
vi.mock('@cuberoot/shared/alg', async original => ({
  ...await original<typeof import('@cuberoot/shared/alg')>(), loadAlg: mocks.load,
}));
vi.mock('@cuberoot/shared/timer/reconstruct/library-correction', () => ({
  identifyLibraryCase: async () => ({ sticker: { kind: 'raw', tag: 'recognized', attrs: {} } }),
}));
vi.mock('@/lib/alg_thumb_plan', () => ({ cubeThumbParams: (_puzzle: string, _set: string, sticker: { tag: string }) => ({ mask: sticker.tag || 'fallback', view: 'oll' }) }));
vi.mock('@/components/VisualCube', () => ({ VisualCube: (props: { faceletColors?: string; mask?: string }) => {
  useEffect(() => () => mocks.unmount(), []);
  return createElement('span', { 'data-diagram': props.faceletColors ?? props.mask });
} }));
let root: Root, host: HTMLDivElement;
let requests: Array<{ publish: (diagrams: ReconF2lAnnotations['diagrams']) => void; finish: (value: ReconF2lAnnotations) => void }>;
const diagrams = () => new Map([[0, [{ colors: 'RG', facelets: 'stable-state' }]]]);
async function render(text: string, scramble = 'R U', index = 0) {
  await act(async () => root.render(createElement(ReconLineDiagramProvider, { text, scramble, enabled: true,
    children: diagramAt => createElement('div', null, diagramAt(index)),
  })));
}
beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  requests = [];
  mocks.annotations.mockImplementation((_scramble, _text, publish) => new Promise(finish => requests.push({ publish, finish })));
  mocks.load.mockResolvedValue({ cases: [] });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it('keeps the same F2L image mounted while later turns and asynchronous annotations update', async () => {
  await render('R // RG');
  await act(async () => requests[0].publish(diagrams()));
  const image = host.querySelector('[data-diagram]');
  expect(image).not.toBeNull();
  await render('R // RG\nU');
  expect(host.querySelector('[data-diagram]')).toBe(image);
  await act(async () => requests[1].finish({ diagrams: diagrams(), links: new Map() }));
  expect(host.querySelector('[data-diagram]')).toBe(image);
  expect(mocks.unmount).toHaveBeenCalledTimes(0);
});

it.each(['scramble', 'line'] as const)('invalidates a changed %s and ignores a stale request', async change => {
  await render('R // RG');
  await act(async () => requests[0].publish(diagrams()));
  await render(change === 'line' ? 'F // RG' : 'R // RG', change === 'scramble' ? 'F U' : 'R U');
  expect(host.querySelector('[data-diagram]')).toBeNull();
  await act(async () => requests[0].finish({ diagrams: diagrams(), links: new Map() }));
  expect(host.querySelector('[data-diagram]')).toBeNull();
});

it('keeps the recognized library mask while a later row triggers another library request', async () => {
  await render('R // OLL');
  await vi.waitFor(() => expect(host.querySelector('[data-diagram]')?.getAttribute('data-diagram')).toBe('recognized'));
  const image = host.querySelector('[data-diagram]');
  mocks.load.mockImplementation(() => new Promise(() => {}));
  await render('R // OLL\nU');
  expect(host.querySelector('[data-diagram]')).toBe(image);
  expect(image?.getAttribute('data-diagram')).toBe('recognized');
  expect(mocks.unmount).toHaveBeenCalledTimes(0);
});


it('invalidates an unchanged label when an earlier move changes its pre-line state', async () => {
  await render('R\nU // RG', 'R U', 1);
  await act(async () => requests[0].publish(new Map([[1, diagrams().get(0)!]])));
  expect(host.querySelector('[data-diagram]')).not.toBeNull();
  await render('F\nU // RG', 'R U', 1);
  expect(host.querySelector('[data-diagram]')).toBeNull();
});
