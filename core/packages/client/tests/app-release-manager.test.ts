// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ReleaseManager from '../app/[lang]/download/ReleaseManager';
const api = vi.hoisted(() => ({ status: vi.fn(), publish: vi.fn() }));
vi.mock('../lib/app-release-api', () => ({ fetchAppReleaseStatus: api.status, publishAppRelease: api.publish }));
vi.mock('../i18n/tr', () => ({ tr: (v: { en: string }) => v.en }));
let root: Root, node: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  node = document.createElement('div'); document.body.append(node); root = createRoot(node);
  api.status.mockReset(); api.publish.mockReset();
});
afterEach(async () => { await act(async () => root.unmount()); node.remove(); });
it('does not offer publication before the backend is configured', async () => {
  api.status.mockResolvedValue({ configured: false, commit: null, runs: [], pending: null });
  await act(async () => root.render(createElement(ReleaseManager, { onPublished: vi.fn() })));
  expect(node.textContent).toContain('not configured');
  expect(node.querySelector('textarea')).toBeNull();
  expect(api.publish).not.toHaveBeenCalled();
});
it('blocks duplicate publication while the build service confirms a request', async () => {
  api.status.mockResolvedValue({ configured: true, commit: 'a'.repeat(40), runs: [], pending: { requestId: 'test-request', state: 'unknown' } });
  await act(async () => root.render(createElement(ReleaseManager, { onPublished: vi.fn() })));
  expect(node.querySelector('textarea')!.disabled).toBe(true);
  const button = [...node.querySelectorAll('button')].find(b => b.textContent === 'Publish release')!;
  expect(button.disabled).toBe(true);
  expect(node.textContent).toContain('waiting for the build service');
});
it('refreshes download manifests on completed runs and distinguishes partial failures', async () => {
  const refresh = vi.fn();
  api.status.mockResolvedValue({ configured: true, commit: 'a'.repeat(40), pending: null,
    runs: [{ id: 1, versionName: '1.0.1', status: 'completed', conclusion: 'failure', url: 'https://github.com/2017YANR02/cuberoot.me/actions/runs/1' }] });
  await act(async () => root.render(createElement(ReleaseManager, { onPublished: refresh })));
  expect(refresh).toHaveBeenCalledOnce();
  expect(node.textContent).toContain('Incomplete');
  expect(node.textContent).not.toContain('Published');
});
