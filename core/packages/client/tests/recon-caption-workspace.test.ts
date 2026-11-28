// @vitest-environment jsdom
import { act, createElement, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import ReconCaptionEditor from '@/app/[lang]/recon/submit/ReconCaptionDialog';
import type { VideoReviewSurface } from '@/app/[lang]/video-recon/VideoReconClient';
import { paintCaption } from '@/lib/video-tools/recon-captions';
import { useVideoViewport } from '@/hooks/useVideoViewport';
import { downloadBlob } from '@/lib/scramble-dist/download';
import { renderReconVideo } from '@/lib/video-tools/export';

const [cube, cubingCube] = vi.hoisted(() => Array.from({ length: 2 }, () => ({ capture: vi.fn(), draw: vi.fn(), dispose: vi.fn(), setSolidFoundation: vi.fn() })));
vi.mock('@/lib/video-tools/caption-cube', () => ({
  createCaptionCube: (_scramble: string, _solution: string, _cues: unknown, engine: string) => engine === 'cubing' ? cubingCube : cube,
}));
vi.mock('@/lib/video-tools/caption-crop', () => ({ detectCaptionCrop: async () => undefined }));
vi.mock('@/lib/video-tools/recon-captions', async original => ({
  ...await original<typeof import('@/lib/video-tools/recon-captions')>(), paintCaption: vi.fn(),
}));
vi.mock('@/lib/scramble-dist/download', () => ({ downloadBlob: vi.fn() }));
vi.mock('@/lib/video-tools/export', () => ({ renderReconVideo: vi.fn() }));
vi.mock('@/hooks/useT', () => {
  const t = (_zh: string, en: string) => en;
  return { useT: () => t };
});

it('previews and exports the verified cues from one review surface, and drops stale output after reanalysis', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(vi.fn().mockReturnValue({ clearRect: vi.fn(), drawImage: vi.fn() }));
  Object.defineProperty(document, 'fonts', { configurable: true, value: { load: async () => [] } });
  const host = document.createElement('div');
  const root = createRoot(host);
  const overlay = document.createElement('div'), settings = document.createElement('div');
  const playerMenu = document.createElement('div');
  const dialog = document.createElement('dialog');
  dialog.open = true;
  const stage = document.createElement('div');
  stage.className = 'video-recon-stage';
  const frame = document.createElement('div');
  frame.className = 'video-recon-player-frame';
  frame.append(stage);
  stage.append(overlay);
  dialog.append(host, frame, settings, playerMenu);
  document.body.append(dialog);
  const readReviewPlaybackTime = vi.fn((now: number) => 1.2 + now * .25 / 1000);
  const workspace = { setPreviewFraming: vi.fn(), readReviewPlaybackTime } as unknown as VideoReviewSurface['workspace'];
  const file = new File(['movie'], 'source.mp4');
  const output = new File(['encoded'], 'source-sub.mp4');
  const draft = { solution: 'R', cues: [{ text: 'R', start: .6, end: 1.5, marks: [{ start: .78, end: 1.24 }] }] };
  const onUse = vi.fn();
  const onApply = vi.fn();
  const setSolidFoundation = vi.fn();
  function show(presentedTimestamp: number, recognized = true, cubeEngine: VideoReviewSurface['cubeEngine'] = 'three', solidFoundation = false, running = false) {
    const view = { presentedTimestamp, running, position: 1.9, duration: 2, videoSize: { width: 480, height: 640 } } as VideoReviewSurface['view'];
    return act(async () => root.render(createElement(ReconCaptionEditor, {
      file, solution: '', scramble: "R'", event: '3x3', recognition: recognized ? draft : undefined, review: { view, workspace, overlay, settings, playerMenu, cubeEngine, solidFoundation, setSolidFoundation }, onUse, onApply: recognized ? onApply : undefined,
    })));
  }
  try {
    vi.mocked(paintCaption).mockReturnValue({ x: 240, y: 180, width: 150, height: 30 });
    await show(.8);
    expect(host.querySelector('video')).toBeNull();
    const layer = overlay.querySelector('.recon-caption-layer') as HTMLCanvasElement;
    expect([layer?.width, layer?.height]).toEqual([480, 640]);
    expect(settings.querySelector('textarea')).toBeNull();
    expect(settings.querySelector('input[type="number"]')).toBeNull();
    const animation = playerMenu.querySelector<HTMLButtonElement>('[aria-label="Animation"]')!;
    expect(settings.querySelector('[aria-label="Animation"]')).toBeNull();
    await act(async () => animation.click());
    expect(overlay.querySelector('.recon-caption-cube-handle')).toBeNull();
    await act(async () => animation.click());
    const caption = overlay.querySelector<HTMLButtonElement>('.recon-caption-text-handle')!;
    const cubeHandle = overlay.querySelector<HTMLButtonElement>('.recon-caption-cube-handle')!;
    const viewportZoom = vi.fn();
    for (const type of ['wheel', 'gesturestart', 'gesturechange', 'gestureend']) {
      overlay.addEventListener(type, viewportZoom);
    }
    const wheel = new WheelEvent('wheel', { ctrlKey: true, deltaY: -100 * Math.log(1.25), bubbles: true, cancelable: true });
    await act(async () => caption.dispatchEvent(wheel));
    expect(wheel.defaultPrevented).toBe(true);
    expect(vi.mocked(paintCaption).mock.lastCall?.[5].size).toBe(80);
    expect(cube.capture.mock.lastCall).toEqual([.8, 149]);
    const gesture = (type: string, scale: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      cubeHandle.dispatchEvent(Object.assign(event, { scale }));
      return event;
    };
    await act(async () => {
      expect(gesture('gesturestart', 1).defaultPrevented).toBe(true);
      expect(gesture('gesturechange', 1.25).defaultPrevented).toBe(true);
      gesture('gestureend', 1.25);
    });
    expect(viewportZoom).not.toHaveBeenCalled();
    overlay.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true }));
    expect(viewportZoom).toHaveBeenCalledOnce();
    expect(cube.capture.mock.lastCall).toEqual([.8, 186]);
    expect(vi.mocked(paintCaption).mock.lastCall?.[5].size).toBe(80);
    const panel = () => overlay.querySelector('[role="dialog"][aria-label="Caption style"]');
    await act(async () => caption.click());
    expect(caption.getAttribute('aria-expanded')).toBe('true');
    expect(panel()?.querySelectorAll('input[type="number"]')).toHaveLength(2);
    await act(async () => panel()?.querySelector<HTMLButtonElement>('[aria-label="Font"]')!.click());
    expect(panel()?.querySelector('[role="option"]')).not.toBeNull();
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    expect(panel()?.querySelector('[role="option"]')).toBeNull();
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    expect(panel()).toBeNull();
    await act(async () => caption.click());
    expect(panel()).not.toBeNull();
    await act(async () => settings.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(panel()).toBeNull();
    cube.dispose.mockClear();
    await show(1.2, true, 'cubing');
    expect(cube.dispose).toHaveBeenCalledOnce();
    expect(cubingCube.capture.mock.lastCall).toEqual([1.2, 186]);
    expect(playerMenu.querySelector('[aria-label="Solid black cube seams"]')).toBeNull();
    const currentCube = overlay.querySelector<HTMLButtonElement>('.recon-caption-cube-handle')!;
    const cubePanel = () => overlay.querySelector('[role="dialog"][aria-label="Cube appearance"]');
    await act(async () => currentCube.click());
    const choices = [...cubePanel()!.querySelectorAll<HTMLButtonElement>('[role="option"]')];
    expect(choices.map(choice => choice.textContent)).toEqual(['Transparent', 'Black']);
    expect(choices[0].getAttribute('aria-selected')).toBe('true');
    await act(async () => choices[1].click());
    expect(setSolidFoundation).toHaveBeenCalledWith(true);
    await show(1.2, true, 'cubing', true);
    expect(cubingCube.setSolidFoundation).toHaveBeenLastCalledWith(true);
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    expect(cubePanel()).toBeNull();
    expect(document.activeElement).toBe(currentCube);

    const bounds = { width: 480, height: 640, left: 0, top: 0 } as DOMRect;
    vi.spyOn(layer!, 'getBoundingClientRect').mockReturnValue(bounds);
    vi.spyOn(currentCube, 'getBoundingClientRect').mockReturnValue(bounds);
    currentCube.setPointerCapture = vi.fn();
    currentCube.hasPointerCapture = () => true;
    const pointer = (type: string, clientX: number) => currentCube.dispatchEvent(Object.assign(
      new MouseEvent(type, { bubbles: true, clientX, clientY: 20 }), { pointerId: 1, isPrimary: true }));
    await act(async () => {
      pointer('pointerdown', 20);
      pointer('pointermove', 60);
      pointer('pointerup', 60);
      currentCube.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    });
    expect(cubePanel()).toBeNull();
    expect(parseFloat(currentCube.style.left)).toBeGreaterThan(0);
    expect(cubingCube.dispose).not.toHaveBeenCalled();
    expect(overlay.querySelector('.recon-caption-layer') as HTMLCanvasElement).toBe(layer);
    const [, cues, time, , , style] = vi.mocked(paintCaption).mock.lastCall!;
    expect(time).toBe(1.2);
    expect(cues[0].turns[0]).toMatchObject({ from: .78, to: 1.24 });
    // The playhead can stay on the same video frame while the cube renders
    // multiple interpolated positions at the display's refresh rate.
    let tick: FrameRequestCallback | undefined;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { tick = callback; return 1; });
    vi.stubGlobal('cancelAnimationFrame', () => { tick = undefined; });
    await show(1.2, true, 'cubing', true, true);
    act(() => tick?.(16));
    expect(cubingCube.capture.mock.lastCall).toEqual([1.204, 186]);
    act(() => tick?.(32));
    expect(cubingCube.capture.mock.lastCall).toEqual([1.208, 186]);
    expect(vi.mocked(paintCaption).mock.lastCall?.[2]).toBe(1.2);
    await show(1.2, true, 'cubing', true);
    expect(cubingCube.capture.mock.lastCall).toEqual([1.2, 186]);

    let finish!: (file: File) => void;
    vi.mocked(renderReconVideo).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const button = (text: string) => [...settings.querySelectorAll('button')].find(b => b.textContent === text);
    const selectUse = async (label: string) => {
      await act(async () => settings.querySelector<HTMLButtonElement>('[aria-label="Use video reconstruction"]')!.click());
      const items = [...dialog.querySelectorAll<HTMLButtonElement>('[role="option"]')];
      expect(items.map(item => item.textContent)).toEqual(['Reconstruction only', 'Reconstruction and video']);
      await act(async () => items.find(item => item.textContent === label)!.click());
    };
    await selectUse('Reconstruction only');
    expect(onApply).toHaveBeenCalledOnce();
    expect(renderReconVideo).not.toHaveBeenCalled();
    await act(async () => button('Export')!.click());
    expect(renderReconVideo).toHaveBeenCalledWith(file, cues, expect.objectContaining({ ...style, size: 80, cubeScale: 1.25 }),
      expect.any(Function), expect.any(AbortSignal), cubingCube, undefined);
    const ring = frame.querySelector(':scope > [role="progressbar"]');
    const updateProgress = vi.mocked(renderReconVideo).mock.lastCall![3];
    act(() => updateProgress(54));
    expect(ring?.getAttribute('aria-valuenow')).toBe('54');
    expect(ring?.querySelector('rect')?.getAttribute('stroke-dashoffset')).toBe('46');
    expect(settings.textContent).not.toContain('54%');
    act(() => updateProgress(100));
    expect(ring?.getAttribute('aria-valuenow')).toBe('99');
    expect(downloadBlob).not.toHaveBeenCalled();
    await act(async () => finish(output));
    expect(downloadBlob).toHaveBeenCalledExactlyOnceWith(output.name, output);
    expect(ring?.getAttribute('aria-valuenow')).toBe('100');
    expect(button('Download')).toBeUndefined();
    await selectUse('Reconstruction and video');
    expect(onUse).toHaveBeenCalledExactlyOnceWith(output);
    expect(renderReconVideo).toHaveBeenCalledOnce();
    expect(downloadBlob).toHaveBeenCalledOnce();
    await show(0, false);
    expect(settings.querySelector('[aria-label="Use video reconstruction"]')).toBeNull();
    await show(1.2, true, 'cubing', true);
    vi.mocked(renderReconVideo).mockResolvedValueOnce(output);
    await selectUse('Reconstruction and video');
    expect(renderReconVideo).toHaveBeenCalledTimes(2);
    expect(onUse).toHaveBeenCalledTimes(2);
    expect(downloadBlob).toHaveBeenCalledOnce();
    await show(0, false);
    expect(button('Export')?.disabled).toBe(true);
  } finally {
    act(() => root.unmount());
    dialog.remove();
    vi.mocked(paintCaption).mockReset();
    Reflect.deleteProperty(document, 'fonts');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});

it('scales the review frame by the same pinch ratio as the overlays, once per gesture', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  const root = createRoot(host);
  function Frame() {
    const ref = useRef<HTMLDivElement>(null);
    const viewport = useVideoViewport(ref, true, false, 'modified');
    return createElement('div', { ref, style: viewport.style });
  }
  try {
    act(() => root.render(createElement(Frame)));
    const frame = host.firstElementChild as HTMLElement;
    const pinchWheel = (factor: number) => frame.dispatchEvent(new WheelEvent('wheel', {
      ctrlKey: true, deltaY: -100 * Math.log(factor), bubbles: true, cancelable: true,
    }));
    const gesture = (type: string, scale: number) =>
      frame.dispatchEvent(Object.assign(new Event(type, { bubbles: true, cancelable: true }), { scale }));
    act(() => { pinchWheel(1.25); });
    expect(frame.style.transform).toContain('scale(1.25)');
    act(() => { pinchWheel(1 / 1.25); });
    expect(frame.style.transform).toBe('');
    act(() => {
      gesture('gesturestart', 1);
      gesture('gesturechange', 1.25);
      pinchWheel(1.25);
      gesture('gestureend', 1.25);
    });
    expect(frame.style.transform).toContain('scale(1.25)');
  } finally {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});
