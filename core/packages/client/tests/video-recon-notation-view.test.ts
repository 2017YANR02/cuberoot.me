// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { VideoSolveAnalysis } from '@/app/[lang]/video-recon/VideoSolveAnalysis';

vi.mock('@cuberoot/shared/recon-completion', () => ({
  checkReconCompletion: async () => ({ status: 'solved' }),
}));
vi.mock('@/lib/video-recon/solve-analysis', async original => ({
  ...await original<typeof import('@/lib/video-recon/solve-analysis')>(),
  analyzeVideoSolve: vi.fn(async () => ({
    solved: true,
    result: { text: "R' // cross", seconds: 1, scramble: 'R', lines: [] },
  })),
}));
vi.mock('@/components/ReconNotationBlock', () => ({
  ReconNotationBlock: ({ captionHeader }: { captionHeader: string }) => createElement('p', null, captionHeader),
}));

it('places the shared toolbar before the video result and copies the camera notation from the raw view', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const clipboard = vi.fn(async () => {});
  vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { clipboard: { writeText: clipboard } }));
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const onReady = vi.fn();
  const clickTab = (index: number) => act(async () => host.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index].click());
  try {
    await act(async () => root.render(createElement(VideoSolveAnalysis, {
      scramble: 'R', steps: [], measured: [], fps: 30, start: 0, end: 1, position: 0,
      sourceAlgorithm: "x U'", onSeek: vi.fn(), onOpeningView: vi.fn(),
      draftTarget: { scramble: 'R', onReady },
    })));
    const notation = host.querySelector<HTMLDivElement>('.detail-scramble-solution')!;
    expect(host.querySelector('.detail-notation-toolbar')?.nextElementSibling).toBe(notation);
    expect(host.querySelectorAll('[role="tab"]')).toHaveLength(3);
    expect(notation.hidden).toBe(false);
    await clickTab(1);
    expect(notation.hidden).toBe(true);
    expect(host.querySelector('.detail-source-text')?.textContent).toBe("R\nx U'");
    await act(async () => host.querySelector<HTMLButtonElement>('button.detail-source-copy')!.click());
    expect(clipboard).toHaveBeenCalledWith("R\nx U'");
    await clickTab(0);
    expect(notation.hidden).toBe(false);
    expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ solution: "R' // cross" }));
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
