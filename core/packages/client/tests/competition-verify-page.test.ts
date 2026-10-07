// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('nuqs', () => ({ parseAsString: {}, useQueryState: () => ['/zh'] }));
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
vi.mock('@/components/HeaderToggles', () => ({ default: () => null }));
vi.mock('@/lib/api-base', () => ({ apiUrl: (path: string) => path }));
import CompetitionVerifyPage from '@/app/[lang]/competition-verify/page';
afterEach(() => { vi.unstubAllGlobals(); });
it('explains an nginx IP ban without treating it as a broken image, then renders a successful retry', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(null, { status: 403 }))
    .mockResolvedValueOnce(new Response('<html>Forbidden</html>', { status: 403, headers: { 'retry-after': '121' } }))
    .mockResolvedValueOnce(new Response(null, { status: 403 }))
    .mockResolvedValueOnce(Response.json({ id: 'test', image: 'data:image/svg+xml;base64,PHN2Zy8+' }));
  vi.stubGlobal('fetch', fetcher);
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    await act(async () => { root.render(createElement(CompetitionVerifyPage)); });
    expect(host.querySelector('[role="status"]')?.textContent).toContain('请约 3 分钟后重试');
    expect(host.querySelector('img')).toBeNull();
    expect((host.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { (host.querySelector('button[type="button"]') as HTMLButtonElement).click(); });
    expect(host.querySelector('img')?.getAttribute('src')).toBe('data:image/svg+xml;base64,PHN2Zy8+');
    expect(host.querySelector('[role="status"]')?.textContent).toBe('');
    expect(fetcher).toHaveBeenCalledTimes(4);
  } finally { await act(async () => root.unmount()); host.remove(); }
});

it('returns an already allowed visitor without requesting or displaying a captcha', async () => {
  const replace = vi.fn();
  vi.stubGlobal('window', { location: { replace } });
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetcher);
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => { root.render(createElement(CompetitionVerifyPage)); });
    expect(replace).toHaveBeenCalledWith('/zh');
    expect(fetcher).toHaveBeenCalledExactlyOnceWith('/v1/competition-access/check', expect.objectContaining({ credentials: 'include', cache: 'no-store' }));
    expect(host.querySelector('form')).toBeNull();
    expect(host.textContent).not.toContain('输入验证码');
  } finally { await act(async () => root.unmount()); }
});

it('keeps a failed access check retryable without pretending a captcha is required', async () => {
  const replace = vi.fn();
  vi.stubGlobal('window', { location: { replace } });
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetcher);
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => { root.render(createElement(CompetitionVerifyPage)); });
    expect(host.querySelector('form')).toBeNull();
    expect(host.textContent).toContain('暂时无法确认访问状态');
    expect(replace).not.toHaveBeenCalled();
    await act(async () => { (host.querySelector('button') as HTMLButtonElement).click(); });
    expect(replace).toHaveBeenCalledWith('/zh');
    expect(fetcher).toHaveBeenCalledTimes(2);
  } finally { await act(async () => root.unmount()); }
});
