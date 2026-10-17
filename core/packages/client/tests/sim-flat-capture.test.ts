// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import SimCaptureGroup from '@/components/puzzle-image/SimCaptureGroup';
import { saveBlob, svgToRasterBlob } from '@/lib/puzzle-image/image-export';
import { exportSimSvg } from '@/app/[lang]/sim/sim_svg_export';

vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }));
vi.mock('@/app/[lang]/sim/sim_svg_export', () => ({
  exportSimSvg: vi.fn(() => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>'),
}));
vi.mock('@/lib/puzzle-image/image-export', async (original) => ({
  ...await original<typeof import('@/lib/puzzle-image/image-export')>(),
  saveBlob: vi.fn(),
  svgToRasterBlob: vi.fn().mockResolvedValue(new Blob(['png'], { type: 'image/png' })),
}));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('captures the current DOM frame and CSS paint instead of the hidden 3D scene', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  const board = document.createElement('div');
  board.innerHTML = '<style>.flat-test-pin { fill: rgb(255, 0, 0); }</style><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><g transform="rotate(30)"><circle r="4" class="flat-test-pin" /></g></svg>';
  document.body.append(host, board);
  const svg = board.querySelector('svg')!;
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ width: 400, height: 200 } as DOMRect);
  const getCanvas = vi.fn(() => null);
  const getWorld = vi.fn(() => ({} as never));
  const getRenderer = vi.fn(() => ({} as never));
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(SimCaptureGroup, {
      simBridge: { getSvg: () => svg, getCanvas, getWorld, getRenderer, setup: '', alg: 'UR1+' },
    })));
    const button = (label: string) => [...host.querySelectorAll('button')]
      .find((candidate) => candidate.textContent?.trim() === label)!;
    expect(button('Record MP4').disabled).toBe(true);
    // Export reads the live board at click time, not an earlier companion image.
    svg.querySelector('g')!.setAttribute('transform', 'rotate(60)');
    await act(async () => button('Snapshot').click());
    const [source, dimensions] = vi.mocked(svgToRasterBlob).mock.calls[0];
    expect(source).toContain('rotate(60)');
    expect(source).toContain('fill: rgb(255, 0, 0)');
    expect(dimensions).toMatchObject({ width: 400, height: 200 });
    await act(async () => button('SVG').click());
    expect(saveBlob).toHaveBeenCalledTimes(2);
    expect(vi.mocked(saveBlob).mock.calls[0][0].type).toBe('image/png');
    expect(vi.mocked(saveBlob).mock.calls[1][0].type).toBe('image/svg+xml;charset=utf-8');
    expect(getCanvas).not.toHaveBeenCalled();
    expect(getWorld).not.toHaveBeenCalled();
    expect(getRenderer).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    host.remove(); board.remove();
  }
});

it('rasterizes the live PG scene without waiting for the upstream offscreen screenshot', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const scene = {};
  const camera = {};
  const screenshot = vi.fn(() => new Promise<string>(() => {}));
  const player = {
    experimentalScreenshot: screenshot,
    experimentalCurrentVantages: async () => [{ camera: async () => camera, scene: { scene: async () => scene } }],
    getBoundingClientRect: () => ({ width: 184, height: 184 }),
  };
  try {
    await act(async () => root.render(createElement(SimCaptureGroup, {
      simBridge: { getCanvas: () => null, getWorld: () => null, getRenderer: () => null,
        getTwistyPlayer: () => player, setup: '', alg: 'R Rw' },
    })));
    for (const label of ['Snapshot', 'SVG']) {
      await act(async () => [...host.querySelectorAll('button')]
        .find(button => button.textContent?.trim() === label)!.click());
    }
    expect(screenshot).not.toHaveBeenCalled();
    expect(exportSimSvg).toHaveBeenCalledTimes(2);
    expect(exportSimSvg).toHaveBeenLastCalledWith({ world: { scene, camera, width: 184, height: 184 }, srgbColors: true });
    expect(svgToRasterBlob).toHaveBeenCalledWith(expect.stringContaining('<path'), { width: 2048, height: 2048 });
    expect(saveBlob).toHaveBeenCalledTimes(2);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
