// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PuzzleImageStudio, { type PuzzleImageStudioProps } from '@/components/puzzle-image/PuzzleImageStudio';
import { DEFAULTS } from '@/lib/puzzle-image/defaults';
import { renderSpecSvg } from '@/lib/puzzle-image/render';
import { saveBlob, svgBlob } from '@/lib/puzzle-image/image-export';
import { NATIVE_PUZZLES, NATIVE_PUZZLE_IDS } from '@cuberoot/puzzle-solvers/native-puzzles';
import { renderNativePuzzleSvg } from '@cuberoot/puzzle-render-core/native-puzzle-svg';

vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));
vi.mock('@/lib/puzzle-image/render', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/puzzle-image/render')>();
  return { ...actual, renderSpecSvg: vi.fn(actual.renderSpecSvg) };
});
vi.mock('@/lib/puzzle-image/image-export', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/puzzle-image/image-export')>();
  return { ...actual, saveBlob: vi.fn(), svgBlob: vi.fn(actual.svgBlob) };
});

describe('native 2D image studio preview and export boundary', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  async function render(patch: Partial<PuzzleImageStudioProps> = {}) {
    await act(async () => root.render(createElement(PuzzleImageStudio, {
      // Native IDs have no ImageSpec representation. This deliberately valid
      // three-by-three fallback would produce a plausible but incorrect image
      // if the exact-state export gate regressed.
      spec: { ...DEFAULTS, algorithm: "R U R'" },
      onSpecChange: vi.fn(),
      engineOnly: true,
      staticFallbackExact: false,
      engineSvg: null,
      ...patch,
    })));
  }

  function exportButton(label: string): HTMLButtonElement {
    const button = [...host.querySelectorAll<HTMLButtonElement>('.vc-exports button')]
      .find((el) => el.textContent?.trim() === label);
    expect(button).toBeDefined();
    return button!;
  }

  it('keeps missing native frames out of the three-by-three preview and both export menus', async () => {
    await render();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Waiting for the exact image');
    expect(host.querySelector('.vc-preview svg')).toBeNull();
    expect(exportButton('Copy').disabled).toBe(true);
    expect(exportButton('Download').disabled).toBe(true);
    await act(async () => exportButton('Download').click());
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(renderSpecSvg).not.toHaveBeenCalled();
    expect(saveBlob).not.toHaveBeenCalled();
  });

  it('clears a stale frame on failure, explains how to retry, and restores export only for a new accurate frame', async () => {
    const svg = renderNativePuzzleSvg('superz', 'R UFR');
    await render({ engineSvg: svg });
    expect(exportButton('Download').disabled).toBe(false);
    await render({ engineSvg: svg, engineSvgUnavailable: true });
    expect(host.querySelector('[role="status"]')?.textContent).toContain('The 2D image is unavailable');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Close and reopen');
    expect(host.querySelector('.vc-preview svg')).toBeNull();
    expect(exportButton('Copy').disabled).toBe(true);
    expect(exportButton('Download').disabled).toBe(true);
    expect(renderSpecSvg).not.toHaveBeenCalled();
    await render({ engineSvg: svg });
    expect(host.querySelector('.vc-preview svg')?.getAttribute('aria-label')).toBe('superz');
    expect(exportButton('Download').disabled).toBe(false);
  });

  it.each(NATIVE_PUZZLE_IDS)('exports the exact displayed %s SVG without a spec renderer', async (id) => {
    const svg = renderNativePuzzleSvg(id, '');
    await render({ engineSvg: svg });
    const preview = host.querySelector<SVGElement>('.vc-preview svg');
    expect(preview?.getAttribute('aria-label')).toBe(id);
    expect(preview?.querySelectorAll('polygon')).toHaveLength(NATIVE_PUZZLES[id].visibleFacelets);
    expect(exportButton('Copy').disabled).toBe(false);
    expect(exportButton('Download').disabled).toBe(false);

    await act(async () => exportButton('Download').click());
    const svgButton = [...host.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
      .find((button) => button.textContent?.trim() === 'SVG');
    expect(svgButton).toBeDefined();
    await act(async () => svgButton!.click());
    expect(saveBlob).toHaveBeenCalledTimes(1);
    const exported = vi.mocked(svgBlob).mock.calls[0]?.[0];
    expect(exported).toBeTruthy();
    const downloaded = new DOMParser().parseFromString(exported!, 'image/svg+xml').documentElement;
    expect(downloaded.getAttribute('aria-label')).toBe(id);
    expect(downloaded.getAttribute('viewBox')).toBe(preview!.getAttribute('viewBox'));
    expect([...downloaded.querySelectorAll('polygon')].map((p) => [p.getAttribute('points'), p.getAttribute('fill')]))
      .toEqual([...preview!.querySelectorAll('polygon')].map((p) => [p.getAttribute('points'), p.getAttribute('fill')]));
    expect(renderSpecSvg).not.toHaveBeenCalled();
  });
});
