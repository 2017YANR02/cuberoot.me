import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/utils/analytics_helpers.js', () => ({ getIp: vi.fn(() => '127.0.0.1') }));
vi.mock('../src/utils/recon_helpers.js', () => ({ checkRateLimit: vi.fn() }));

import {
  resetWeChatPcOpenSdkCacheForTest,
  wechatPcOpenSdkRoutes,
} from '../src/routes/wechat_pc_opensdk.js';
import { checkRateLimit } from '../src/utils/recon_helpers.js';

const ORIGINAL_APP_ID = process.env.WECHAT_LOGIN_APP_ID;
const ORIGINAL_SECRET = process.env.WECHAT_LOGIN_APP_SECRET;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('WeChat PC OpenSDK ticket route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWeChatPcOpenSdkCacheForTest();
    process.env.WECHAT_LOGIN_APP_ID = 'wx_test_app';
    process.env.WECHAT_LOGIN_APP_SECRET = 'test-secret';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (ORIGINAL_APP_ID === undefined) delete process.env.WECHAT_LOGIN_APP_ID;
    else process.env.WECHAT_LOGIN_APP_ID = ORIGINAL_APP_ID;
    if (ORIGINAL_SECRET === undefined) delete process.env.WECHAT_LOGIN_APP_SECRET;
    else process.env.WECHAT_LOGIN_APP_SECRET = ORIGINAL_SECRET;
  });

  it('returns disabled without calling WeChat when website app credentials are missing', async () => {
    delete process.env.WECHAT_LOGIN_APP_ID;
    delete process.env.WECHAT_LOGIN_APP_SECRET;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await wechatPcOpenSdkRoutes.request('/wechat/pc-opensdk-ticket', { method: 'POST' });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ disabled: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reuses access_token while issuing a fresh one-use ticket for every action', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token', expires_in: 7200 }))
      .mockResolvedValueOnce(jsonResponse({ ticket: 'ticket-one', expires_in: 300 }))
      .mockResolvedValueOnce(jsonResponse({ ticket: 'ticket-two', expires_in: 300 }));
    vi.stubGlobal('fetch', fetchMock);

    const first = await wechatPcOpenSdkRoutes.request('/wechat/pc-opensdk-ticket', { method: 'POST' });
    const second = await wechatPcOpenSdkRoutes.request('/wechat/pc-opensdk-ticket', { method: 'POST' });

    expect(await first.json()).toEqual({ appId: 'wx_test_app', ticket: 'ticket-one', expiresIn: 300 });
    expect(await second.json()).toEqual({ appId: 'wx_test_app', ticket: 'ticket-two', expiresIn: 300 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/cgi-bin/token?');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/cgi-bin/pcopensdk/ticket?');
    expect(String(fetchMock.mock.calls[2][0])).toContain('/cgi-bin/pcopensdk/ticket?');
    expect(checkRateLimit).toHaveBeenCalledTimes(2);
  });

  it('refreshes an invalid access_token once and retries the ticket request', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'stale-token', expires_in: 7200 }))
      .mockResolvedValueOnce(jsonResponse({ errcode: 40014, errmsg: 'invalid access_token' }))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'fresh-token', expires_in: 7200 }))
      .mockResolvedValueOnce(jsonResponse({ ticket: 'fresh-ticket', expires_in: 300 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await wechatPcOpenSdkRoutes.request('/wechat/pc-opensdk-ticket', { method: 'POST' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ appId: 'wx_test_app', ticket: 'fresh-ticket', expiresIn: 300 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('returns a safe no-store error without exposing upstream credentials or tokens', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'private-token', expires_in: 7200 }))
      .mockResolvedValueOnce(jsonResponse({ errcode: -11034, errmsg: 'not authorized' }));
    vi.stubGlobal('fetch', fetchMock);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await wechatPcOpenSdkRoutes.request('/wechat/pc-opensdk-ticket', { method: 'POST' });
    const text = await response.text();

    expect(response.status).toBe(502);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(JSON.parse(text)).toEqual({ error: 'WeChat sharing is temporarily unavailable' });
    expect(text).not.toContain('private-token');
    expect(text).not.toContain('test-secret');
    expect(text).not.toContain('not authorized');
    expect(consoleSpy).toHaveBeenCalledOnce();
  });
});
