// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressiveImage } from '@/components/ProgressiveImage';
import { coverPreviewSrc } from '@/lib/recon-video-cover';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe('progressive image decoding', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement('div');
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    vi.restoreAllMocks();
  });
  const render = (src = '/full.jpg') => createElement(ProgressiveImage, { src, previewSrc: '/tiny.jpg', alt: 'Cover' });
  function prepareImage(img: HTMLImageElement, decode: () => Promise<void>) {
    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 128 });
    Object.defineProperty(img, 'decode', { configurable: true, value: decode });
  }

  it('shows the small preview while waiting for full-image decode, keeping native lazy loading', async () => {
    await act(async () => root.render(render()));
    const preview = host.querySelector<HTMLImageElement>('.progressive-image-preview')!;
    prepareImage(preview, async () => {});
    await act(async () => preview.dispatchEvent(new Event('load')));
    expect(host.firstElementChild?.getAttribute('data-preview-ready')).toBe('true');

    let finish!: () => void;
    const full = host.querySelector<HTMLImageElement>('.progressive-image-full')!;
    prepareImage(full, () => new Promise(resolve => { finish = resolve; }));
    expect(full.getAttribute('loading')).toBe('lazy');
    await act(async () => full.dispatchEvent(new Event('load')));
    expect(host.firstElementChild?.getAttribute('data-state')).toBe('loading');
    await act(async () => finish());
    expect(host.firstElementChild?.getAttribute('data-state')).toBe('ready');
  });

  it('keeps a successful preview if the original image fails', async () => {
    await act(async () => root.render(render()));
    const preview = host.querySelector<HTMLImageElement>('.progressive-image-preview')!;
    prepareImage(preview, async () => {});
    await act(async () => preview.dispatchEvent(new Event('load')));
    await act(async () => host.querySelector('img.progressive-image-full')!.dispatchEvent(new Event('error')));
    expect(host.firstElementChild?.getAttribute('data-state')).toBe('error');
    expect(host.firstElementChild?.getAttribute('data-preview-ready')).toBe('true');
    expect(host.contains(preview)).toBe(true);
  });

  it('reports full-image failure so the caller can switch to another video cover', async () => {
    const onError = vi.fn();
    await act(async () => root.render(createElement(ProgressiveImage, {
      src: '/failed.jpg', previewSrc: '/tiny.jpg', alt: '', onError,
    })));
    await act(async () => host.querySelector('.progressive-image-preview')!.dispatchEvent(new Event('error')));
    expect(onError).not.toHaveBeenCalled();
    await act(async () => host.querySelector('.progressive-image-full')!.dispatchEvent(new Event('error')));
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('does not reveal a replacement image when the previous decode finishes late', async () => {
    await act(async () => root.render(render()));
    let finishOld!: () => void;
    const oldImage = host.querySelector<HTMLImageElement>('.progressive-image-full')!;
    prepareImage(oldImage, () => new Promise(resolve => { finishOld = resolve; }));
    await act(async () => oldImage.dispatchEvent(new Event('load')));
    await act(async () => root.render(render('/replacement.jpg')));
    await act(async () => finishOld());
    expect(host.firstElementChild?.getAttribute('data-state')).toBe('loading');
    expect(host.querySelector('.progressive-image-full')?.getAttribute('src')).toBe('/replacement.jpg');
  });

  it('reveals cached images that completed before a load handler was attached', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(128);
    await act(async () => root.render(render()));
    expect(host.firstElementChild?.getAttribute('data-state')).toBe('ready');
  });
});

describe('cover preview sources', () => {
  it('uses small provider thumbnails without rewriting unknown or signed providers', () => {
    expect(coverPreviewSrc({ kind: 'yt', id: 'abc123' }, 'unused')).toBe('https://img.youtube.com/vi/abc123/default.jpg');
    expect(coverPreviewSrc({ kind: 'bili', id: 'BV1' }, 'https://i1.hdslb.com/bfs/archive/test.jpg'))
      .toBe('https://i1.hdslb.com/bfs/archive/test.jpg@64w_36h_1c.webp');
    expect(coverPreviewSrc({ kind: 'bili', id: 'BV1' }, 'https://hdslb.com.example.org/test.jpg')).toBeNull();
    expect(coverPreviewSrc({ kind: 'douyin', id: 'video' }, 'https://example.org/signed.jpg?token=example')).toBeNull();
  });
});
