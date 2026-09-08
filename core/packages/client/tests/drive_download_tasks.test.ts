// @vitest-environment jsdom

import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 1 },
  t: (zh: string) => zh,
  access: vi.fn(),
  download: vi.fn(),
  picker: vi.fn(),
}));

vi.mock('@/hooks/useT', () => ({ useT: () => mocks.t }));
vi.mock('@/i18n/tr', () => ({ useLang: () => 'zh', tr: ({ zh }: { zh: string }) => zh }));
vi.mock('@/lib/auth-store', () => ({
  useAuthStore: (select: (state: unknown) => unknown) => select({ user: mocks.user, login: vi.fn() }),
}));
vi.mock('@/components/BackHome', () => ({ default: () => null }));
vi.mock('@/components/HeaderToggles', () => ({ default: () => null }));
vi.mock('@/components/AppLink', () => ({ default: () => null }));
vi.mock('nuqs', async (importOriginal) => ({
  ...await importOriginal<typeof import('nuqs')>(),
  useQueryState: (key: string) => [key === 'view' ? 'members' : null, vi.fn()],
}));
vi.mock('@/lib/drive-api', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/drive-api')>(),
  createDriveAccess: mocks.access,
  downloadDriveFile: mocks.download,
  fetchDrive: vi.fn(async () => ({
    allowed: true, isAdmin: false, uploads: [], breadcrumbs: [],
    quota: { limitBytes: 1024, usedBytes: 8, reservedBytes: 0 },
    nodes: [{ id: 'video', name: 'test.mp4', kind: 'file', mimeType: 'video/mp4', sizeBytes: 8,
      parentId: null, shared: false, createdAt: '2026-09-07', updatedAt: '2026-09-07' }],
  })),
}));

import DrivePage from '@/app/[lang]/drive/page';

describe('Drive download task startup', () => {
  let host: HTMLDivElement;
  let root: Root;
  let seek: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.clearAllMocks();
    seek = vi.fn();
    mocks.access.mockResolvedValue({ url: 'https://example.test/video' });
    mocks.picker.mockResolvedValue({ createWritable: vi.fn(async () => ({ seek })) });
    mocks.download.mockImplementation(async (_url, size, _sink, options) => {
      options.onProgress(size);
      return size;
    });
    vi.stubGlobal('showSaveFilePicker', mocks.picker);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(createElement(StrictMode, null, createElement(DrivePage))));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });

  function clickDownload() {
    const button = host.querySelector<HTMLButtonElement>('button[aria-label="下载 test.mp4"]');
    expect(button).not.toBeNull();
    button!.click();
  }

  it('starts every download after previous tasks have rendered', async () => {
    for (let count = 1; count <= 4; count++) {
      await act(async () => clickDownload());
      expect(mocks.access).toHaveBeenCalledTimes(count);
      expect(mocks.download).toHaveBeenCalledTimes(count);
    }
    expect(host.textContent).not.toContain('测速中');
  });

  it('registers both tasks when save dialogs resolve in the same batch', async () => {
    await act(async () => { clickDownload(); clickDownload(); });
    expect(mocks.access).toHaveBeenCalledTimes(2);
    expect(mocks.download).toHaveBeenCalledTimes(2);
  });

  it('does not start a task when the save dialog is cancelled', async () => {
    mocks.picker.mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'));
    await act(async () => clickDownload());
    expect(mocks.access).not.toHaveBeenCalled();
    expect(mocks.download).not.toHaveBeenCalled();
  });

  function stallAfterProgress() {
    mocks.download.mockImplementationOnce((_url, _size, _sink, options) => new Promise((_resolve, reject) => {
      options.onProgress(4);
      options.signal.addEventListener('abort', () => reject(new DOMException('Paused', 'AbortError')), { once: true });
    }));
  }

  it('resumes using the last written offset after a pause', async () => {
    stallAfterProgress();
    await act(async () => clickDownload());
    const pause = host.querySelector<HTMLButtonElement>('button[aria-label="暂停下载 test.mp4"]');
    expect(pause).not.toBeNull();
    await act(async () => pause!.click());
    const resume = host.querySelector<HTMLButtonElement>('button[aria-label="继续下载 test.mp4"]');
    expect(resume).not.toBeNull();
    await act(async () => resume!.click());
    expect(mocks.download).toHaveBeenCalledTimes(2);
    expect(mocks.download.mock.calls[1][3].offset).toBe(4);
    expect(seek).toHaveBeenCalledWith(4);
    expect(host.textContent).not.toContain('测速中');
  });

  it('keeps a cancelled task removed and starts the next download', async () => {
    stallAfterProgress();
    await act(async () => clickDownload());
    const cancel = host.querySelector<HTMLButtonElement>('button[aria-label="取消下载 test.mp4"]');
    expect(cancel).not.toBeNull();
    await act(async () => cancel!.click());
    expect(host.textContent).not.toContain('下载任务');
    await act(async () => clickDownload());
    expect(mocks.download).toHaveBeenCalledTimes(2);
    expect(mocks.download.mock.calls[1][3].offset).toBe(0);
  });
});
